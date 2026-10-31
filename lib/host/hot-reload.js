// Compose Hot Reload bridge (optional).
//
// Design Studio can host a *real* Compose Desktop app instead of a mockup when
// the configured project exposes Compose Hot Reload's MCP server
// (`hotMcpServer`, CMP 1.12+). This module is a tiny stdio MCP client:
// newline-delimited JSON-RPC 2.0 over the harness subprocess seam, no deps.
//
// It owns the process lifecycle, exposes the four primitives a design review
// needs (reload, screenshot, semantic tree, logs), and stores captures in the
// profile store so the design-system folder stays untouched (and its freshness
// stamp does not move on every screenshot).
//
// It never writes into the app repo: Gradle owns its build directory, and the
// agent owns code edits.

import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { readPngSize } from "./util.js";

const CLIENT_INFO = { name: "dsh-design-studio", version: "2.7.8-dev" };
const PROTOCOL_VERSION = "2025-06-18";
const LOG_LINES = 200;

// macOS window-server capture. Compose Hot Reload's take_screenshot is a screen
// grab, so a covered app window yields whatever is in front. CGWindowID + 
// `screencapture -l` captures the window itself, occluded or not. Compiled once
// on first use and cached in the profile.
const WINID_SWIFT = `import CoreGraphics
import Foundation
let opts: CGWindowListOption = [.optionAll, .excludeDesktopElements]
guard let infos = CGWindowListCopyWindowInfo(opts, kCGNullWindowID) as? [[String: Any]] else { exit(1) }
for w in infos {
    let layer = w[kCGWindowLayer as String] as? Int ?? -1
    if layer != 0 { continue }
    let num = w[kCGWindowNumber as String] as? Int ?? 0
    let name = w[kCGWindowName as String] as? String ?? ""
    let b = w[kCGWindowBounds as String] as? [String: Any] ?? [:]
    let width = Int((b["Width"] as? Double) ?? 0)
    let height = Int((b["Height"] as? Double) ?? 0)
    print("\\(num)\\t\\(name)\\t\\(width)\\t\\(height)")
}
`;

export function createHotReload({ fs, subprocess, rootPath, loadConfig, writeBytes, ensureDir }) {
  let session = null;

  function logLine(session, line) {
    if (!line) return;
    session.logs.push(String(line).slice(0, 4000));
    if (session.logs.length > LOG_LINES) session.logs.splice(0, session.logs.length - LOG_LINES);
  }

  function stderrTail(session) {
    try {
      const reader = session.child && session.child.collected && session.child.collected.stderr;
      return reader ? String(reader.readFrom(0).text || "").trim().slice(-2000) : "";
    } catch (_) {
      return "";
    }
  }

  function writeMsg(session, msg) {
    if (!session || !session.child || !session.child.stdin || session.child.stdin.destroyed) {
      throw new Error("Compose app is not running — call app_start first");
    }
    session.child.stdin.write(JSON.stringify(msg) + "\n");
  }

  function notify(session, method, params) {
    writeMsg(session, { jsonrpc: "2.0", method, ...(params ? { params } : {}) });
  }

  function send(session, method, params, timeoutMs) {
    const id = ++session.seq;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        session.pending.delete(id);
        reject(new Error("hotMcpServer did not answer " + method + " within " + Math.round(timeoutMs / 1000) + "s"));
      }, timeoutMs);
      session.pending.set(id, { resolve, reject, timer, method });
      try {
        writeMsg(session, { jsonrpc: "2.0", id, method, params: params || {} });
      } catch (err) {
        clearTimeout(timer);
        session.pending.delete(id);
        reject(err);
      }
    });
  }

  function failPending(session, err) {
    for (const [, p] of session.pending) {
      clearTimeout(p.timer);
      p.reject(err);
    }
    session.pending.clear();
  }

  function consume(session, chunk) {
    session.buffer += chunk.toString("utf8");
    if (session.buffer.length > 2 * 1024 * 1024) {
      session.buffer = session.buffer.slice(-1024 * 1024);
      logLine(session, "[dsh] stdout buffer trimmed");
    }
    for (;;) {
      const idx = session.buffer.indexOf("\n");
      if (idx < 0) break;
      const line = session.buffer.slice(0, idx).trim();
      session.buffer = session.buffer.slice(idx + 1);
      if (!line) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch (_) {
        logLine(session, line); // Gradle/banner noise is expected; keep it for diagnostics.
        continue;
      }
      if (msg.id != null && session.pending.has(msg.id)) {
        const p = session.pending.get(msg.id);
        session.pending.delete(msg.id);
        clearTimeout(p.timer);
        if (msg.error) p.reject(new Error("hotMcpServer " + p.method + ": " + (msg.error.message || JSON.stringify(msg.error))));
        else p.resolve(msg.result);
        continue;
      }
      if (msg.method && msg.id != null) {
        // Server-initiated request: answer ping, reject anything else politely.
        try {
          if (msg.method === "ping") writeMsg(session, { jsonrpc: "2.0", id: msg.id, result: {} });
          else writeMsg(session, { jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: "method not supported by design studio" } });
        } catch (_) {}
        continue;
      }
      if (msg.method) logLine(session, "[" + msg.method + "] " + JSON.stringify(msg.params || {}).slice(0, 500));
    }
  }

  function onExit(session, outcome) {
    if (session.disposed) return;
    const err = new Error(
      session.state === "starting"
        ? "hotMcpServer exited before ready (code " + outcome.exitCode + ")" + (stderrTail(session) ? ": " + stderrTail(session) : "")
        : "hotMcpServer exited (code " + outcome.exitCode + ")" + (stderrTail(session) ? ": " + stderrTail(session) : ""),
    );
    if (session.state !== "error") {
      session.error = err.message;
      session.state = "stopped";
    }
    failPending(session, err);
    if (session.startReject) {
      session.startReject(err);
      session.startReject = null;
      session.startResolve = null;
    }
  }

  async function projectFor(cfg) {
    const project = String((cfg.app && cfg.app.project) || "").trim();
    if (!project) {
      throw new Error(
        'no Compose Desktop project configured — set it with design_studio action=config and patch {"app":{"project":"/absolute/path/to/project"}}',
      );
    }
    if (!project.startsWith("/") && !/^[A-Za-z]:[\\/]/.test(project)) {
      throw new Error("app.project must be an absolute path: " + project);
    }
    let target;
    try {
      target = await fs.resolve(project, { cwd: process.cwd() });
    } catch (err) {
      throw new Error("app.project cannot be resolved: " + String((err && err.message) || err));
    }
    const abs = fs.processPath(target);
    const wrapper = process.platform === "win32" ? "gradlew.bat" : "gradlew";
    let gradlewTarget;
    try {
      gradlewTarget = await fs.resolve(wrapper, { cwd: abs });
    } catch (_) {
      gradlewTarget = null;
    }
    const info = gradlewTarget ? await fs.stat(gradlewTarget) : undefined;
    if (!info || info.type !== "file") {
      throw new Error("app.project has no Gradle wrapper (" + wrapper + "): " + abs);
    }
    return { abs, gradlew: fs.processPath(gradlewTarget), task: String((cfg.app && cfg.app.task) || "hotMcpServer") };
  }

  function status(cfg) {
    const configured = Boolean(cfg && cfg.app && String(cfg.app.project || "").trim());
    return {
      configured,
      project: configured ? String(cfg.app.project) : "",
      task: configured ? String(cfg.app.task || "hotMcpServer") : "",
      runTask: configured ? String(cfg.app.runTask || "hotRunDesktop") : "",
      state: session ? session.state : "stopped",
      tools: session ? session.tools.slice() : [],
      error: session ? session.error : "",
      logs: session ? session.logs.slice(-40).join("\n") : "",
    };
  }

  async function start() {
    const cfg = await loadConfig();
    const proj = await projectFor(cfg);
    if (session && session.state === "ready" && session.project === proj.abs) return status(cfg);
    if (session && session.state === "starting" && session.project === proj.abs) {
      await session.startPromise;
      return status(cfg);
    }
    if (session) await stop();

    let child;
    const env = Object.assign({}, process.env);
    if (cfg.app && cfg.app.javaHome) env.JAVA_HOME = String(cfg.app.javaHome);
    try {
      child = subprocess.spawn({
        argv: [proj.gradlew, "--no-daemon", "--quiet", "--console=plain", proj.task],
        cwd: proj.abs,
        stdio: {
          stdin: "pipe",
          stdout: "pipe",
          stderr: { maxBytes: 64 * 1024, spill: { maxBytes: 1024 * 1024 } },
        },
        graceMs: 5000,
        env,
      });
    } catch (err) {
      throw new Error("could not start " + proj.task + ": " + String((err && err.message) || err));
    }

    const s = {
      project: proj.abs,
      child,
      state: "starting",
      seq: 0,
      pending: new Map(),
      buffer: "",
      logs: [],
      tools: [],
      runChild: null,
      error: "",
      disposed: false,
      startResolve: null,
      startReject: null,
      startPromise: null,
    };
    session = s;
    if (child.stdout) child.stdout.on("data", (chunk) => consume(s, chunk));
    if (child.stderr) child.stderr.on("data", (chunk) => logLine(s, String(chunk).slice(0, 2000)));
    child.done.then((outcome) => onExit(s, outcome)).catch((err) => onExit(s, { exitCode: -1, signal: null, err }));

    s.startPromise = (async () => {
      try {
        const initTimeout = Math.max(1000, Number(cfg.app && cfg.app.initializeTimeoutMs) || 120000);
        const init = await send(s, "initialize", {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: CLIENT_INFO,
        }, initTimeout);
        if (!init || typeof init !== "object") throw new Error("hotMcpServer returned a malformed initialize result");
        notify(s, "notifications/initialized");
        const toolTimeout = Math.max(1000, Number(cfg.app && cfg.app.toolTimeoutMs) || 60000);
        const listed = await send(s, "tools/list", {}, toolTimeout);
        s.tools = Array.isArray(listed && listed.tools) ? listed.tools.map((t) => String(t.name)) : [];
        s.state = "ready";
        if (!(await appConnected(s))) await launchApp(s, cfg, proj);
        if (s.startResolve) {
          s.startResolve();
          s.startResolve = null;
          s.startReject = null;
        }
      } catch (err) {
        s.error = String((err && err.message) || err);
        s.state = "error";
        try { child.terminate(); } catch (_) {}
        if (s.startReject) {
          s.startReject(err);
          s.startReject = null;
          s.startResolve = null;
        }
        throw err;
      }
    })();
    // The promise is awaited below; keep a handler so an early exit does not warn.
    s.startPromise.catch(() => {});
    await s.startPromise;
    return status(cfg);
  }

  async function appConnected(s) {
    if (!s.tools.includes("status")) return true;
    try {
      const result = await send(s, "tools/call", { name: "status", arguments: {} }, 15000);
      const parsed = JSON.parse(textOf(result) || "{}");
      return Boolean(parsed && parsed.connected);
    } catch (_) {
      return false;
    }
  }

  async function launchApp(s, cfg, proj) {
    if (!cfg.app || !cfg.app.runTask) return;
    const env = Object.assign({}, process.env);
    if (cfg.app.javaHome) env.JAVA_HOME = String(cfg.app.javaHome);
    let child;
    try {
      child = subprocess.spawn({
        argv: [proj.gradlew, "--no-daemon", "--quiet", "--console=plain", String(cfg.app.runTask)],
        cwd: proj.abs,
        stdio: {
          stdin: "ignore",
          stdout: { maxBytes: 64 * 1024, spill: { maxBytes: 1024 * 1024 } },
          stderr: { maxBytes: 64 * 1024, spill: { maxBytes: 1024 * 1024 } },
        },
        graceMs: 5000,
        env,
      });
    } catch (err) {
      throw new Error("could not start the app (" + cfg.app.runTask + "): " + String((err && err.message) || err));
    }
    s.runChild = child;
    child.done.then(() => { if (s.runChild === child) s.runChild = null; }).catch(() => { if (s.runChild === child) s.runChild = null; });
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (s.state !== "ready") break;
      if (await appConnected(s)) return;
    }
    const reader = child.collected && child.collected.stderr;
    const tail = reader ? String(reader.readFrom(0).text || "").trim().slice(-1500) : "";
    throw new Error("the app run task (" + cfg.app.runTask + ") did not connect a Compose application within 90s" + (tail ? ": " + tail : ""));
  }

  async function stop() {
    const s = session;
    if (!s) return { state: "stopped" };
    s.disposed = true;
    s.state = "stopping";
    try { if (s.runChild) s.runChild.terminate(); } catch (_) {}
    try { s.child.terminate(); } catch (_) {}
    try {
      await Promise.race([s.child.done.catch(() => {}), new Promise((resolve) => setTimeout(resolve, 4000))]);
    } catch (_) {}
    failPending(s, new Error("Compose app stopped"));
    if (session === s) session = null;
    return { state: "stopped" };
  }

  async function refreshTools(s) {
    const cfg = await loadConfig();
    const listed = await send(s, "tools/list", {}, Math.max(1000, Number(cfg.app && cfg.app.toolTimeoutMs) || 60000));
    s.tools = Array.isArray(listed && listed.tools) ? listed.tools.map((t) => String(t.name)) : [];
    return s.tools;
  }

  function requireReady() {
    if (!session || session.state !== "ready") {
      throw new Error("Compose app is not running — call app_start first");
    }
    return session;
  }

  async function callTool(name, args, timeoutMs) {
    const s = requireReady();
    if (s.tools.length && !s.tools.includes(name)) {
      throw new Error("hotMcpServer does not expose " + name + " (available: " + s.tools.join(", ") + ")");
    }
    const cfg = await loadConfig();
    const timeout = Math.max(1000, Number(timeoutMs) || Number(cfg.app && cfg.app.toolTimeoutMs) || 60000);
    const result = await send(s, "tools/call", { name, arguments: args || {} }, timeout);
    if (result && result.isError) {
      const text = textOf(result) || "tool call failed";
      throw new Error(name + ": " + text);
    }
    return result;
  }

  function textOf(result) {
    if (!result || !Array.isArray(result.content)) return "";
    return result.content
      .filter((c) => c && c.type === "text")
      .map((c) => String(c.text || ""))
      .join("\n")
      .trim();
  }

  function imageOf(result) {
    if (!result || !Array.isArray(result.content)) return null;
    for (const c of result.content) {
      if (c && c.type === "image" && typeof c.data === "string") {
        return { data: c.data, mimeType: c.mimeType || "image/png" };
      }
    }
    return null;
  }

  function shotSlug(slug) {
    return typeof slug === "string" && /^[a-z0-9][a-z0-9-]{0,63}$/.test(slug) ? slug : "_global";
  }

  let winidPromise = null;
  let winidCache = { title: "", id: 0, at: 0 };

  async function runCmd(argv, cwd, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const handle = subprocess.spawn({
        argv,
        cwd,
        stdio: {
          stdin: "ignore",
          stdout: { maxBytes: 65536, spill: { maxBytes: 262144 } },
          stderr: { maxBytes: 16384, spill: { maxBytes: 262144 } },
        },
        graceMs: 5000,
        signal: controller.signal,
      });
      const outcome = await handle.done;
      const out = handle.collected.stdout ? handle.collected.stdout.readFrom(0).text : "";
      const err = handle.collected.stderr ? handle.collected.stderr.readFrom(0).text : "";
      return { code: outcome.exitCode, out, err, aborted: controller.signal.aborted };
    } catch (err) {
      return { code: -1, out: "", err: String((err && err.message) || err), aborted: false };
    } finally {
      clearTimeout(timer);
    }
  }

  async function ensureWinid() {
    if (winidPromise) return winidPromise;
    winidPromise = (async () => {
      const root = await rootPath();
      const binTarget = await fs.resolve("_studio/bin/winid", { cwd: root });
      const binAbs = fs.processPath(binTarget);
      const info = await fs.stat(binTarget);
      if (info && info.type === "file") return binAbs;
      await ensureDir(dirname(binAbs));
      const srcTarget = await fs.resolve("_studio/bin/winid.swift", { cwd: root });
      await fs.writeText(srcTarget, WINID_SWIFT);
      const res = await runCmd(["/usr/bin/swiftc", "-O", fs.processPath(srcTarget), "-o", binAbs], process.cwd(), 180000);
      if (res.code !== 0 || res.aborted) {
        throw new Error("could not build the window-id helper: " + String(res.err || "").slice(0, 300));
      }
      return binAbs;
    })().catch((err) => {
      winidPromise = null;
      throw err;
    });
    return winidPromise;
  }

  async function listWindows(s) {
    if (!s.tools.includes("list_windows")) return [];
    const cfg = await loadConfig();
    const listed = await send(s, "tools/call", { name: "list_windows", arguments: {} }, Math.max(5000, Math.min(15000, Number(cfg.app && cfg.app.toolTimeoutMs) || 15000)));
    const text = textOf(listed);
    try {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  async function macCapture(session, abs) {
    if (process.platform !== "darwin") return null;
    try {
      const wins = (await listWindows(session))
        .filter((w) => w && Number(w.width) > 40 && Number(w.height) > 40)
        .sort((a, b) => Number(b.width) * Number(b.height) - Number(a.width) * Number(a.height));
      const pick = wins[0];
      if (!pick || !pick.title) return null;
      const title = String(pick.title);
      let id = 0;
      if (winidCache.title === title && Date.now() - winidCache.at < 2000) id = winidCache.id;
      if (!id) {
        const bin = await ensureWinid();
        const listing = await runCmd([bin], process.cwd(), 15000);
        if (listing.code !== 0) return null;
        let best = null;
        let bestDelta = Infinity;
        const wantedArea = Number(pick.width) * Number(pick.height);
        for (const line of listing.out.split("\n")) {
          const parts = line.split("\t");
          if (parts.length < 4 || parts[1] !== title) continue;
          const area = Number(parts[2]) * Number(parts[3]);
          const delta = Math.abs(area - wantedArea);
          if (delta < bestDelta) {
            bestDelta = delta;
            best = Number(parts[0]);
          }
        }
        id = best || 0;
        if (!id) return null;
        winidCache = { title, id, at: Date.now() };
      }
      let shot = await runCmd(["/usr/sbin/screencapture", "-l", String(id), "-o", "-x", abs], process.cwd(), 15000);
      if (shot.code !== 0) {
        // The window may have been recreated (reload/restart): refresh the id once.
        winidCache = { title: "", id: 0, at: 0 };
        return null;
      }
      const target = await fs.resolve(abs, { cwd: process.cwd() });
      const info = await fs.stat(target);
      if (!info || info.type !== "file" || !info.size) return null;
      const bytes = Buffer.from(await fs.readBytes(target, undefined, 20 * 1024 * 1024));
      return { bytes, window: title, source: "macos-window" };
    } catch (_) {
      return null;
    }
  }

  async function grab(slug, fixedFile) {
    const s = requireReady();
    const owner = shotSlug(slug);
    const file = fixedFile || (Date.now() + "-" + randomUUID().slice(0, 8) + ".png");
    const rel = "_studio/app/" + owner + "/shots/" + file;
    const target = await fs.resolve(rel, { cwd: await rootPath() });
    const abs = fs.processPath(target);
    await ensureDir(dirname(abs));
    let bytes = null;
    let size = null;
    let window = "";
    let source = "mcp";
    const native = await macCapture(s, abs);
    if (native) {
      bytes = native.bytes;
      size = readPngSize(bytes);
      window = native.window;
      source = native.source;
    } else {
      const result = await callTool("take_screenshot", {}, 60000);
      const img = imageOf(result);
      if (!img) throw new Error("take_screenshot returned no image (expected content[].type=image)");
      bytes = Buffer.from(img.data, "base64");
      size = readPngSize(bytes);
      window = textOf(result);
      await writeBytes(abs, bytes);
    }
    const text = (window ? window + " — " : "") + "captured via " + (source === "macos-window" ? "the macOS window server" : "Compose Hot Reload");
    return {
      file,
      owner,
      path: "/design-studio/__app/shots/" + owner + "/" + file,
      w: size ? size.width : null,
      h: size ? size.height : null,
      bytes: bytes.length,
      data: bytes,
      text,
      window,
      source,
    };
  }

  async function capture(slug) {
    await start();
    return await grab(slug);
  }

  async function screenshot(slug) {
    await start();
    return await grab(slug);
  }

  // Live review frame: same capture primitive, but a single overwritten file
  // per owner so a polling tab does not accumulate PNGs. The client compares
  // successive frames and overlays the changed regions.
  async function frame(slug) {
    const s = requireReady();
    const shot = await grab(slug, "live.png");
    return {
      owner: shot.owner,
      path: shot.path,
      w: shot.w,
      h: shot.h,
      bytes: shot.bytes,
      window: shot.window,
      source: shot.source,
      text: shot.text,
      ts: Date.now(),
      tools: s.tools.slice(),
    };
  }

  async function reload() {
    await start();
    const result = await callTool("reload", {}, 240000);
    return textOf(result) || "reloaded";
  }

  async function tree() {
    await start();
    const result = await callTool("get_semantic_tree", {}, 120000);
    return textOf(result);
  }

  async function logs() {
    await start();
    const result = await callTool("get_logs", {}, 60000);
    return textOf(result);
  }

  return { start, stop, status, screenshot, capture, frame, reload, tree, logs, callTool, refreshTools, projectFor };
}
