import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { bytesToB64, dirOf } from "./util.js";

export function createNodeIo({ subprocess }) {
let nodeExec = null;

const NODE_MKDIR = "const fs=require('node:fs');try{fs.mkdirSync(process.argv[1],{recursive:true})}catch(e){console.error(e&&e.message||String(e));process.exit(1)}";

const NODE_WRITE_B64 = [
  "const fs=require('node:fs'),path=require('node:path');",
  "const out=[];process.stdin.on('data',c=>out.push(c));",
  "process.stdin.on('end',()=>{try{",
  "const p=process.argv[1];fs.mkdirSync(path.dirname(p),{recursive:true});",
  "fs.writeFileSync(p,Buffer.from(Buffer.concat(out).toString('ascii'),'base64'));",
  "}catch(e){console.error(e&&e.message||String(e));process.exit(1)}});",
].join("");

const NODE_RM = [
  "const fs=require('node:fs');let bad=false;",
  "for(const p of process.argv.slice(1)){try{fs.rmSync(p,{recursive:true,force:true})}catch(e){console.error(p+': '+e.message);bad=true}}",
  "if(bad)process.exit(1)",
].join("");

async function nodeExecutable() {
  if (nodeExec !== null) return nodeExec;
  try {
    nodeExec = await subprocess.resolveExecutable("node");
  } catch (_) {
    nodeExec = null;
  }
  // Desktop hosts run inside Electron; plain `node` is preferred, but the
  // harness executable can run the same script when ELECTRON_RUN_AS_NODE is
  // in effect and no system Node is on PATH.
  if (!nodeExec) nodeExec = process.execPath;
  return nodeExec;
}

async function runNode(script, args, opts) {
  const options = opts || {};
  const timeoutMs = typeof options.timeoutMs === "number" && options.timeoutMs > 0
    ? Math.min(options.timeoutMs, 2147483000)
    : 30000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const handle = subprocess.spawn({
      argv: [await nodeExecutable(), "-e", script].concat(args.map(String)),
      cwd: options.cwd || process.cwd(),
      env: process.versions.electron ? Object.assign({}, process.env, { ELECTRON_RUN_AS_NODE: "1" }) : process.env,
      stdio: {
        stdin: typeof options.stdin === "string" ? { data: options.stdin } : "ignore",
        stdout: { maxBytes: 64 * 1024, spill: { maxBytes: 1024 * 1024 } },
        stderr: { maxBytes: 64 * 1024, spill: { maxBytes: 1024 * 1024 } },
      },
      graceMs: 15000,
      signal: controller.signal,
    });
    const outcome = await handle.done;
    const outReader = handle.collected.stdout;
    const errReader = handle.collected.stderr;
    const out = outReader ? outReader.readFrom(0).text : "";
    const err = errReader ? errReader.readFrom(0).text : "";
    if (controller.signal.aborted) throw new Error("node helper timed out");
    return { exitCode: outcome.exitCode, stdout: out, stderr: err };
  } finally {
    clearTimeout(timer);
  }
}

async function ensureDir(absPath) {
  const res = await runNode(NODE_MKDIR, [absPath], { cwd: process.cwd() });
  if (res.exitCode !== 0) throw new Error("mkdir failed: " + String(res.stderr || "").trim());
}

async function writeBytes(absPath, bytes) {
  const res = await runNode(NODE_WRITE_B64, [absPath], { stdin: bytesToB64(bytes), timeoutMs: 60000 });
  if (res.exitCode !== 0) throw new Error("binary write failed: " + String(res.stderr || "").trim());
}

async function removePaths(paths, cwd) {
  if (!paths || !paths.length) return;
  const clean = paths
    .map((path) => (path && typeof path === "object" && typeof path.targetKey === "string" ? path.targetKey : path))
    .filter((path) => typeof path === "string" && path);
  if (!clean.length) return;
  const res = await runNode(NODE_RM, clean, { cwd: cwd || process.cwd(), timeoutMs: 60000 });
  if (res.exitCode !== 0) throw new Error("remove failed: " + String(res.stderr || "").trim());
}

async function launchDetached(command, args, cwd) {
  await new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(command, args, {
        cwd: cwd || process.cwd(),
        detached: true,
        stdio: "ignore",
        windowsHide: false,
      });
    } catch (err) {
      reject(err);
      return;
    }
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
    child.once("error", reject);
  });
}

async function revealInFileManager(absPath, cwd) {
  const platform = process.platform;
  if (platform === "win32") {
    const direct = process.env.SystemRoot ? process.env.SystemRoot + "\\explorer.exe" : "";
    await launchDetached(direct && existsSync(direct) ? direct : "explorer.exe", ["/select," + absPath], cwd);
    return;
  }
  if (platform === "darwin") {
    await launchDetached("open", ["-R", absPath], cwd);
    return;
  }
  try {
    await launchDetached("xdg-open", [dirOf(absPath)], cwd);
  } catch (_) {
    await launchDetached("gio", ["open", dirOf(absPath)], cwd);
  }
}

async function openExternal(url) {
  const platform = process.platform;
  let command;
  let args;
  if (platform === "win32") {
    command = "rundll32.exe";
    args = ["url.dll,FileProtocolHandler", url];
  } else if (platform === "darwin") {
    command = "open";
    args = [url];
  } else {
    command = "xdg-open";
    args = [url];
  }
  let executable;
  try {
    executable = await subprocess.resolveExecutable(command);
  } catch (err) {
    throw new Error("system browser opener unavailable (" + command + "): " + String((err && err.message) || err));
  }
  const handle = subprocess.spawn({
    argv: [executable].concat(args),
    cwd: process.cwd(),
    stdio: {
      stdin: "ignore",
      stdout: { maxBytes: 4096, spill: { maxBytes: 65536 } },
      stderr: { maxBytes: 8192, spill: { maxBytes: 65536 } },
    },
    graceMs: 5000,
  });
  const timer = setTimeout(() => {
    try { handle.terminate(); } catch (_) {}
  }, 8000);
  try {
    const outcome = await handle.done;
    if (outcome.exitCode !== 0) {
      const errReader = handle.collected.stderr;
      const detail = String((errReader ? errReader.readFrom(0).text : "") || "").trim();
      throw new Error("system browser opener failed (exit " + outcome.exitCode + ")" + (detail ? ": " + detail.slice(0, 300) : ""));
    }
  } finally {
    clearTimeout(timer);
  }
  return { opened: url };
}

function findBrowserSync() {
  const platform = process.platform;
  const candidates = [];
  if (platform === "win32") {
    for (const root of [process.env["ProgramFiles(x86)"], process.env.ProgramFiles, process.env.LOCALAPPDATA]) {
      if (!root) continue;
      candidates.push(root + "\\Microsoft\\Edge\\Application\\msedge.exe");
      candidates.push(root + "\\Google\\Chrome\\Application\\chrome.exe");
    }
  } else if (platform === "darwin") {
    candidates.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    );
  } else {
    candidates.push(
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/usr/bin/microsoft-edge",
    );
  }
  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  return null;
}

async function findBrowser() {
  const direct = findBrowserSync();
  if (direct !== null) return direct;
  for (const command of ["msedge", "chrome", "chromium", "chromium-browser", "google-chrome", "microsoft-edge"]) {
    try {
      const executable = await subprocess.resolveExecutable(command);
      if (executable) return executable;
    } catch (_) {}
  }
  return null;
}

async function runBrowserScreenshot(browser, url, outPath, profileDir, headlessFlag, width, height, cwd) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const handle = subprocess.spawn({
      argv: [
        browser,
        headlessFlag,
        "--disable-gpu",
        "--hide-scrollbars",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-extensions",
        "--disable-background-networking",
        "--user-data-dir=" + profileDir,
        "--window-size=" + width + "," + height,
        "--force-device-scale-factor=1",
        "--virtual-time-budget=2500",
        "--run-all-compositor-stages-before-draw",
        "--screenshot=" + outPath,
        url,
      ],
      cwd: cwd || process.cwd(),
      stdio: {
        stdin: "ignore",
        stdout: { maxBytes: 8192, spill: { maxBytes: 65536 } },
        stderr: { maxBytes: 16384, spill: { maxBytes: 65536 } },
      },
      graceMs: 10000,
      signal: controller.signal,
    });
    const outcome = await handle.done;
    const errReader = handle.collected.stderr;
    return {
      exitCode: outcome.exitCode,
      stderr: errReader ? errReader.readFrom(0).text : "",
      timedOut: controller.signal.aborted,
    };
  } finally {
    clearTimeout(timer);
  }
}

  return { nodeExecutable, runNode, ensureDir, writeBytes, removePaths, revealInFileManager, openExternal, findBrowser, runBrowserScreenshot };
}
