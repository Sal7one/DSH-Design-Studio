import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createQaLensCompanion } from "../lib/host/qalens-companion.js";

test("a missing sidecar executable fails promptly and remains stopped", { timeout: 2000 }, async () => {
  const bridge = createQaLensCompanion();
  await assert.rejects(() => bridge.start({ checkout: process.cwd(), python: "/dsh-does-not-exist/python" }), /Could not start QaLens/);
  assert.equal((await bridge.stop()).state, "stopped");
});

async function fixture() {
  const state = { connected: true, phase: "connected", connectionId: "phone-a", selectedId: "node-a", snapshotNodes: null, snapshotFailure: 0, failed: 0, requests: [], hold: null };
  const secret = "test-secret-not-for-client";
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    state.requests.push({ path: req.url, method: req.method, headers: req.headers, body: Buffer.concat(chunks).toString() });
    const reply = (status, payload) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(payload)); };
    if (req.url === "/api/bootstrap") return reply(200, { ok: true, session: secret });
    if (req.headers["x-qalens-session"] !== secret) return reply(401, { ok: false });
    if (state.failed) return reply(state.failed, { ok: false, error: secret });
    if (req.url === "/api/workbench") return reply(200, { ok: true, phase: state.phase, connected: state.connected, connectionId: state.connectionId, privateValue: secret });
    if (req.url === "/api/selection") return reply(200, { ok: true, selectedId: state.selectedId, connectionId: state.connectionId });
    if (req.url === "/api/snapshot") {
      if (state.snapshotFailure) return reply(state.snapshotFailure, { ok: false, error: secret });
      return reply(200, { ok: true, connectionId: state.connectionId, screen: "Home", route: "home", nodes: state.snapshotNodes || [{ id: state.selectedId, sourceRef: "a".repeat(64), actions: ["tap"] }] });
    }
    if (req.url === "/api/component") {
      if (req.headers["x-qalens-connection"] !== state.connectionId) return reply(409, { ok: false });
      const { id } = JSON.parse(Buffer.concat(chunks).toString());
      if (state.hold) await state.hold;
      return reply(200, { ok: true, document: { content: { component: { id, tag: "HOME_BUTTON" } } } });
    }
    reply(404, { ok: false });
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  return { state, secret, url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => server.close(resolve)) };
}

test("reads selection and cached component without exposing session or issuing controls", async () => {
  const f = await fixture();
  const bridge = createQaLensCompanion({ minimumIntervalMs: 0 });
  try {
    await bridge.attach(f.url);
    const first = await bridge.poll();
    assert.equal(first.connected, true);
    assert.deepEqual(first.selection, { id: "node-a", sourceRef: "a".repeat(64), actions: ["tap"], screen: "Home", route: "home", snapshotWarning: "" });
    assert.equal(first.component.content.component.tag, "HOME_BUTTON");
    assert(!JSON.stringify(first).includes(f.secret));
    await bridge.poll();
    assert.equal(f.state.requests.filter(r => r.path === "/api/component").length, 1);
    assert.equal(f.state.requests.filter(r => r.path === "/api/snapshot").length, 1);
    assert.deepEqual(new Set(f.state.requests.map(r => r.path)), new Set(["/api/bootstrap", "/api/workbench", "/api/selection", "/api/snapshot", "/api/component"]));
    f.state.connectionId = "phone-b";
    f.state.selectedId = "node-b";
    assert.equal((await bridge.poll()).selection.id, "node-b");
    assert.equal(f.state.requests.filter(r => r.path === "/api/component").length, 2);
    f.state.selectedId = null;
    assert.equal((await bridge.poll()).component, null);
  } finally { await bridge.stop(); await f.close(); }
});

test("duplicate snapshot IDs cannot provide a verified source reference", async () => {
  const f = await fixture();
  const bridge = createQaLensCompanion({ minimumIntervalMs: 0 });
  f.state.snapshotNodes = [{ id: "node-a", sourceRef: "a".repeat(64) }, { id: "node-a", sourceRef: "b".repeat(64) }];
  try {
    await bridge.attach(f.url);
    const result = await bridge.poll();
    assert.equal(result.selection.sourceRef, null);
    assert.match(result.selection.snapshotWarning, /ambiguous/);
    assert.equal(result.component.content.component.id, "node-a");
  } finally { await bridge.stop(); await f.close(); }
});

test("rechecks source reference for a reused node ID without repeated previews for unchanged metadata", async () => {
  const f = await fixture();
  let time = 10000;
  const bridge = createQaLensCompanion({ minimumIntervalMs: 0, now: () => time });
  try {
    await bridge.attach(f.url);
    assert.equal((await bridge.poll()).selection.sourceRef, "a".repeat(64));
    time += 5000;
    await bridge.poll();
    assert.equal(f.state.requests.filter(r => r.path === "/api/component").length, 1);
    f.state.snapshotNodes = [{ id: "node-a", sourceRef: "b".repeat(64), actions: ["type"] }];
    time += 5000;
    const result = await bridge.poll();
    assert.equal(result.selection.sourceRef, "b".repeat(64));
    assert.deepEqual(result.selection.actions, ["type"]);
    assert.equal(f.state.requests.filter(r => r.path === "/api/component").length, 2);
  } finally { await bridge.stop(); await f.close(); }
});

test("clears cached data on lost authorization and never returns response errors", async () => {
  const f = await fixture();
  const bridge = createQaLensCompanion({ minimumIntervalMs: 0 });
  try {
    await bridge.attach(f.url); await bridge.poll();
    f.state.failed = 401;
    const result = await bridge.poll();
    assert.equal(result.component, null);
    assert.equal(result.selection, null);
    assert.equal(result.connected, false);
    assert.equal(result.state, "disconnected");
    assert(!JSON.stringify(result).includes(f.secret));
  } finally { await bridge.stop(); await f.close(); }
});

test("snapshot failure drops the reference but preserves a component; authorization loss clears both", async () => {
  const f = await fixture();
  let time = 10000;
  const bridge = createQaLensCompanion({ minimumIntervalMs: 0, now: () => time });
  try {
    await bridge.attach(f.url);
    await bridge.poll();
    time += 5000; f.state.snapshotFailure = 502;
    const partial = await bridge.poll();
    assert.equal(partial.selection.sourceRef, null);
    assert.match(partial.selection.snapshotWarning, /unavailable/);
    assert(partial.component);
    time += 5000; f.state.snapshotFailure = 403;
    const denied = await bridge.poll();
    assert.equal(denied.selection, null);
    assert.equal(denied.component, null);
    assert.equal(denied.state, "disconnected");
  } finally { await bridge.stop(); await f.close(); }
});

test("drops an in-flight component when the phone selection changes", async () => {
  const f = await fixture();
  const bridge = createQaLensCompanion({ minimumIntervalMs: 0 });
  let release;
  f.state.hold = new Promise(resolve => { release = resolve; });
  try {
    await bridge.attach(f.url);
    const promise = bridge.poll();
    while (!f.state.requests.some(r => r.path === "/api/component")) await new Promise(resolve => setTimeout(resolve, 5));
    f.state.selectedId = "node-b";
    release();
    const result = await promise;
    assert.equal(result.component, null);
    assert.match(result.error, /selection changed/i);
    assert.equal((await bridge.poll()).selection.id, "node-b");
  } finally { release(); await bridge.stop(); await f.close(); }
});

test("stop invalidates an in-flight component without stopping an attached server", async () => {
  const f = await fixture();
  const bridge = createQaLensCompanion({ minimumIntervalMs: 0 });
  let release;
  f.state.hold = new Promise(resolve => { release = resolve; });
  try {
    await bridge.attach(f.url);
    const promise = bridge.poll();
    while (!f.state.requests.some(r => r.path === "/api/component")) await new Promise(resolve => setTimeout(resolve, 5));
    await bridge.stop();
    release();
    assert.equal((await promise).component, null);
    assert.equal(bridge.status().state, "stopped");
    assert.equal((await fetch(f.url + "/api/bootstrap")).status, 200);
  } finally { release(); await bridge.stop(); await f.close(); }
});

test("rejects nonliteral origins, redirects, and URL credentials", async () => {
  const bridge = createQaLensCompanion();
  for (const url of ["http://localhost:1234", "http://127.1:1234", "http://2130706433:1234", "http://user:pw@127.0.0.1:1234", "https://127.0.0.1:1234", "http://127.0.0.1:1234/path"]) {
    await assert.rejects(bridge.attach(url), /127\.0\.0\.1/);
  }
  const server = createServer((req, res) => { res.writeHead(302, { location: "http://example.com/" }); res.end(); });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try { await assert.rejects(bridge.attach(`http://127.0.0.1:${server.address().port}`), /HTTP 302/); }
  finally { await bridge.stop(); await new Promise(resolve => server.close(resolve)); }
});

test('a later stop cancels attach waiting for an owned sidecar to exit', async () => {
  const { mkdtemp, mkdir, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const checkout = await mkdtemp(join(tmpdir(), 'qalens-lifecycle-'));
  const scriptDir = join(checkout, 'tools', 'local-bridge');
  await mkdir(scriptDir, { recursive: true });
  await writeFile(join(scriptDir, 'server.py'), `
    const http = require('node:http');
    const server = http.createServer((req, res) => { res.setHeader('content-type','application/json'); res.end(JSON.stringify({ok:true,session:'fixture'})); });
    server.listen(0, '127.0.0.1', () => console.log('QaLens workbench: http://127.0.0.1:' + server.address().port));
    process.on('SIGTERM', () => setTimeout(() => process.exit(0), 200));
  `);
  const f = await fixture();
  const bridge = createQaLensCompanion();
  try {
    assert.equal((await bridge.start({ checkout, python: process.execPath })).owned, true);
    const attaching = bridge.attach(f.url);
    await bridge.stop();
    await assert.rejects(attaching, /cancelled/);
    assert.equal(bridge.status().state, 'stopped');
    assert.equal(f.state.requests.length, 0, 'cancelled attach never contacts the other workbench');
  } finally {
    await bridge.stop();
    await f.close();
    await rm(checkout, { recursive: true, force: true });
  }
});

test('connection revision changes on replacement and disconnect without exposing the nonce', async () => {
  const f = await fixture();
  const bridge = createQaLensCompanion({ minimumIntervalMs: 0 });
  try {
    await bridge.attach(f.url);
    const first = await bridge.poll();
    f.state.connectionId = 'phone-b';
    const replacement = await bridge.poll();
    assert.notEqual(first.connectionRevision, replacement.connectionRevision);
    assert(!JSON.stringify(replacement).includes('phone-b'));
    f.state.connected = false;
    const disconnected = await bridge.poll();
    assert.notEqual(replacement.connectionRevision, disconnected.connectionRevision);
    assert.equal(disconnected.connected, false);
  } finally { await bridge.stop(); await f.close(); }
});

test('forced reads bypass the cached interval and refresh the snapshot', async () => {
  const f = await fixture();
  const bridge = createQaLensCompanion({ minimumIntervalMs: 60000 });
  try {
    await bridge.attach(f.url);
    const before = await bridge.poll();
    f.state.snapshotNodes = [{ id: 'node-a', sourceRef: 'b'.repeat(64), actions: ['tap'] }];
    assert.equal((await bridge.poll()).selection.sourceRef, before.selection.sourceRef);
    assert.equal((await bridge.poll({ force: true })).selection.sourceRef, 'b'.repeat(64));
    f.state.connected = false;
    assert.equal((await bridge.poll({ force: true })).connected, false);
  } finally { await bridge.stop(); await f.close(); }
});

test('different manager instances never reuse the public connection scope', async () => {
  const f = await fixture();
  const first = createQaLensCompanion({ minimumIntervalMs: 0 });
  const second = createQaLensCompanion({ minimumIntervalMs: 0 });
  try {
    await first.attach(f.url); await second.attach(f.url);
    const a = await first.poll(), b = await second.poll();
    assert.equal(a.connectionRevision, b.connectionRevision);
    assert.notEqual(a.connectionInstance, b.connectionInstance);
  } finally { await first.stop(); await second.stop(); await f.close(); }
});
