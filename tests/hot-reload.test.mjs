import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, statSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep, isAbsolute } from "node:path";
import { PassThrough } from "node:stream";
import { createHotReload } from "../lib/host/hot-reload.js";

const PNG_1X1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), "ds-hotreload-"));
  const project = join(root, "app");
  mkdirSync(project, { recursive: true });
  writeFileSync(join(project, "gradlew"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  return { root, project };
}

function fakeFs() {
  return {
    resolve: async (rel, opts) => ({ path: isAbsolute(rel) ? rel : join((opts && opts.cwd) || process.cwd(), rel) }),
    processPath: (target) => target.path,
    stat: async (target) => {
      try {
        const s = statSync(target.path);
        return { type: s.isDirectory() ? "dir" : "file", size: s.size };
      } catch (_) {
        return undefined;
      }
    },
    contains: (parent, child) => child.path === parent.path || child.path.startsWith(parent.path + sep),
  };
}

function fakeChild(handler) {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  let resolveDone;
  const done = new Promise((resolve) => { resolveDone = resolve; });
  let buffer = "";
  let seq = 0;
  stdin.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    for (;;) {
      const idx = buffer.indexOf("\n");
      if (idx < 0) break;
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch (_) { continue; }
      if (msg.id == null) continue; // notification
      const reply = (result) => stdout.write(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result }) + "\n");
      handler(msg, reply, () => seq++);
    }
  });
  return {
    stdin,
    stdout,
    stderr,
    collected: { stderr: { readFrom: () => ({ text: "" }) } },
    done,
    terminate() {
      resolveDone({ exitCode: 0, signal: null });
      stdout.end();
    },
    waitForExit: async () => true,
  };
}

function fakeServer(overrides) {
  return (msg, reply) => {
    const o = overrides || {};
    if (msg.method === "initialize") {
      if (o.noInitReply) return;
      reply({ protocolVersion: "2025-06-18", capabilities: {}, serverInfo: { name: "fake-hot", version: "1" } });
      return;
    }
    if (msg.method === "tools/list") {
      reply({ tools: [{ name: "reload" }, { name: "take_screenshot" }, { name: "get_semantic_tree" }, { name: "get_logs" }] });
      return;
    }
    if (msg.method === "tools/call") {
      const name = msg.params && msg.params.name;
      if (name === "reload") return reply({ content: [{ type: "text", text: "reloaded 3 classes" }] });
      if (name === "take_screenshot") return reply({ content: [{ type: "image", data: PNG_1X1, mimeType: "image/png" }, { type: "text", text: "window: main" }] });
      if (name === "get_semantic_tree") return reply({ content: [{ type: "text", text: '{"name":"root","bounds":{"w":390,"h":844}}' }] });
      if (name === "get_logs") return reply({ content: [{ type: "text", text: "line one\nline two" }] });
      return reply({ isError: true, content: [{ type: "text", text: "unknown tool" }] });
    }
  };
}

function makeBridge({ root, project, overrides, config } = {}) {
  const spawned = [];
  const fake = fakeChild(fakeServer(overrides));
  const hot = createHotReload({
    fs: fakeFs(),
    subprocess: { spawn: () => { spawned.push(fake); return fake; } },
    rootPath: async () => root,
    loadConfig: async () => ({
      app: Object.assign({ project, task: "hotMcpServer", initializeTimeoutMs: 2000, toolTimeoutMs: 2000 }, config || {}),
    }),
    writeBytes: async (abs, bytes) => writeFileSync(abs, Buffer.from(bytes)),
    ensureDir: async (dir) => mkdirSync(dir, { recursive: true }),
  });
  return { hot, fake, spawned };
}

test("starts, lists tools, and reloads through the MCP session", async () => {
  const { root, project } = makeRoot();
  const { hot, fake } = makeBridge({ root, project });
  try {
    const started = await hot.start();
    assert.equal(started.state, "ready");
    assert.deepEqual(started.tools, ["reload", "take_screenshot", "get_semantic_tree", "get_logs"]);
    assert.match(await hot.reload(), /reloaded 3 classes/);
    assert.match(await hot.tree(), /"name":"root"/);
    assert.match(await hot.logs(), /line one/);
  } finally {
    await hot.stop();
    rmSync(root, { recursive: true, force: true });
  }
});

test("captures a screenshot into the profile store and returns a served path", async () => {
  const { root, project } = makeRoot();
  const { hot } = makeBridge({ root, project });
  try {
    const shot = await hot.screenshot("hearth-desktop");
    assert.equal(shot.w, 1);
    assert.equal(shot.h, 1);
    assert.match(shot.path, /^\/design-studio\/__app\/shots\/hearth-desktop\/[a-z0-9-]+\.png$/);
    const abs = join(root, "_studio", "app", "hearth-desktop", "shots", shot.file);
    assert.equal(statSync(abs).isFile(), true);
    assert.equal(readFileSync(abs).subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  } finally {
    await hot.stop();
    rmSync(root, { recursive: true, force: true });
  }
});

test("unsanitized slugs cannot escape the app store", async () => {
  const { root, project } = makeRoot();
  const { hot } = makeBridge({ root, project });
  try {
    const shot = await hot.screenshot("../../etc");
    assert.equal(shot.owner, "_global");
    assert.match(shot.path, /^\/design-studio\/__app\/shots\/_global\//);
    assert.equal(statSync(join(root, "_studio", "app", "_global", "shots", shot.file)).isFile(), true);
  } finally {
    await hot.stop();
    rmSync(root, { recursive: true, force: true });
  }
});

test("refuses to start without an absolute configured project", async () => {
  const { root } = makeRoot();
  const { hot } = makeBridge({ root, project: "" });
  try {
    await assert.rejects(() => hot.start(), /no Compose Desktop project configured/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("refuses a project without a Gradle wrapper", async () => {
  const root = mkdtempSync(join(tmpdir(), "ds-hotreload-"));
  const project = join(root, "app");
  mkdirSync(project, { recursive: true });
  const { hot } = makeBridge({ root, project });
  try {
    await assert.rejects(() => hot.start(), /no Gradle wrapper/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects tool calls before the app is running", async () => {
  const { root, project } = makeRoot();
  const { hot } = makeBridge({ root, project });
  try {
    await assert.rejects(() => hot.callTool("reload", {}), /not running/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("times out cleanly when the MCP server never answers initialize", async () => {
  const { root, project } = makeRoot();
  const { hot } = makeBridge({ root, project, overrides: { noInitReply: true }, config: { initializeTimeoutMs: 120 } });
  try {
    await assert.rejects(() => hot.start(), /did not answer initialize/);
    const status = hot.status({ app: { project, task: "hotMcpServer" } });
    assert.equal(status.state, "error");
  } finally {
    await hot.stop();
    rmSync(root, { recursive: true, force: true });
  }
});
