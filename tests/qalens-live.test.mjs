import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { join } from "node:path";
import { createQaLensCompanion } from "../lib/host/qalens-companion.js";
import { createQaLensLive } from "../lib/host/qalens-live.js";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const node = (id, extra) => ({ id, tag: "", text: [], description: [], role: "", enabled: true, bounds: { left: 0, top: 0, right: 300, bottom: 150 }, actions: [], ...extra });
const SCREENS = {
  home: { screen: "Home", route: "home", nodes: [node("1", { tag: "pay", role: "Button", text: ["Pay"], actions: ["tap"] }), node("2", { text: ["24,580.00 SAR"] })] },
  receipt: { screen: "Receipt", route: "receipt", nodes: [node("9", { tag: "receipt.title", text: ["Payment sent"] })] },
};

async function workbench() {
  const state = { screen: "home", connectionId: "conn-1", app: "com.example.bank", commands: [], headers: [], sqlPolls: 0 };
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
    const reply = (status, payload) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(payload)); };
    if (req.url === "/api/bootstrap") return reply(200, { ok: true, session: "s" });
    if (req.headers["x-qalens-session"] !== "s") return reply(401, { ok: false });
    if (req.url === "/api/workbench") return reply(200, { ok: true, connected: true, connectionId: state.connectionId, connection: { serial: "emulator-5554", package: state.app } });
    if (req.headers["x-qalens-connection"] !== state.connectionId) return reply(409, { ok: false, error: "stale" });
    state.headers.push(req.url);
    const id = state.connectionId;
    switch (req.url) {
      case "/api/snapshot": return reply(200, { ok: true, connectionId: id, ...SCREENS[state.screen] });
      case "/api/selectors": return reply(200, { ok: true, connectionId: id, suggestions: [{ title: "Test tag", xpath: "//node[@tag='pay']", matches: 1, stability: "tag" }] });
      case "/api/component": return reply(200, { ok: true, document: { content: { activity: "com.example.bank.MainActivity", viewport: { density: 2.625 } } } });
      case "/api/command":
        state.commands.push(body);
        if (body.xpath === "//node[@text='Gone']") return reply(409, { ok: false, error: "XPath is ambiguous (3 matches); scope it to a parent" });
        if (body.tag === "pay" || body.id === "1") state.screen = "receipt";
        return reply(200, { ok: true, accepted: true, id: "1", action: body.action });
      case "/api/events": return reply(200, { ok: true, connectionId: id, logs: [{ time: 1, type: "LOG", tag: "Pay", message: "payment failed: timeout" }], events: [],
        network: [{ time: 2, method: "POST", url: "https://bank/pay", status: 504, responsePreview: "{\"balance\":\"24580.00\"}" }] });
      case "/api/data": return reply(200, { ok: true, connectionId: id, dataSources: { session: { user: "Abdullah" } } });
      case "/api/screenshot": res.writeHead(200, { "content-type": "image/png" }); return res.end(PNG);
      case "/api/sql":
        if (body.action === "start") return reply(200, { ok: true, connectionId: id, id: "q1", phase: "running" });
        if (++state.sqlPolls < 2) return reply(200, { ok: true, connectionId: id, id: "q1", phase: "running" });
        return reply(200, { ok: true, connectionId: id, id: "q1", phase: "complete", result: { columns: ["id", "amount"], rows: [{ id: 1, amount: 45 }], durationMs: 3 } });
      default: return reply(404, { ok: false });
    }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  return { state, url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => server.close(resolve)) };
}

async function setup(t, target = { package: "com.example.bank", projectRoot: "" }) {
  const bench = await workbench();
  const companion = createQaLensCompanion({ wait: () => Promise.resolve() });
  await companion.attach(bench.url);
  const store = new Map();
  const live = createQaLensLive({
    companion, loadTarget: async () => target, readJson: async (rel) => store.get(rel) ?? null, writeJson: async (rel, value) => { store.set(rel, structuredClone(value)); },
    ensureDir: async () => {}, globalRootPath: async () => "/profile", join, wait: () => Promise.resolve(),
  });
  t.after(async () => { await companion.stop(); await bench.close(); });
  return { bench, live, store };
}

test("act taps through the connection-bound workbench, reports the change and records a replayable step", async (t) => {
  const { bench, live, store } = await setup(t);
  const report = await live.act("bank", { op: "tap", nodeId: "1" });
  assert.match(report, /^tap accepted on Button "Pay" #pay\nscreen: Home → Receipt/);
  assert.match(report, /appeared: Node "Payment sent" #receipt\.title/);
  assert.match(report, /flow: step 1 recorded \(tag pay\)/);
  assert.deepEqual(bench.state.commands[0], { action: "tap", id: "1" });
  const saved = store.get("_studio/qalens/bank.flow.json");
  assert.equal(saved.activity, "com.example.bank.MainActivity");
  assert.deepEqual(saved.steps[0].expect, { kind: "tag", value: "receipt.title", xpath: "//node[@tag='receipt.title']" });
  assert.match(await live.test("bank", { name: "pay" }), /onNodeWithTag\("pay"\)\.performClick\(\)[\s\S]*onNodeWithTag\("receipt\.title"\)\.assertExists\(\)/);

  bench.state.screen = "home";
  assert.match(await live.replay("bank"), /Replayed 1 of 1 steps:\n1\. tap Button "Pay" #pay ok$/);
  assert.deepEqual(bench.state.commands[1], { action: "tap", tag: "pay" });
  assert.equal(await live.flow("bank", { op: "clear" }), "Flow cleared.");
  await assert.rejects(() => live.flow("../escape"), /design slug/);
});

test("a design bound to another app never operates the connected one", async (t) => {
  const { bench, live } = await setup(t, { package: "com.other.app", projectRoot: "" });
  await assert.rejects(() => live.act("bank", { op: "tap", nodeId: "1" }), /connected to com\.example\.bank but design bank targets com\.other\.app/);
  assert.equal(bench.state.commands.length, 0);
});

test("device refusals reach the agent verbatim and are never retried", async (t) => {
  const { bench } = await setup(t);
  const companion = createQaLensCompanion();
  await companion.attach(bench.url);
  await assert.rejects(() => companion.command({ action: "tap", xpath: "//node[@text='Gone']" }), /QaLens: XPath is ambiguous \(3 matches\); scope it to a parent/);
  assert.equal(bench.state.commands.filter(c => c.xpath === "//node[@text='Gone']").length, 1);
  await companion.stop();
});

test("evidence, logs, network, SQL and screenshots read the live app", async (t) => {
  const { live } = await setup(t);
  const evidence = await live.evidence("bank");
  assert.equal(evidence.problems.counts.failedRequests, 1);
  assert.match(await live.network("bank", { failed: true }), /POST https:\/\/bank\/pay → 504[\s\S]*response: \{"balance":"24580\.00"\}/);
  assert.match(await live.logs("bank", { filter: "timeout" }), /Pay: payment failed: timeout/);
  assert.match(await live.data("bank", { filter: "abd" }), /session › user = Abdullah/);
  assert.equal(live.formatTrace(await live.trace("bank", { nodeId: "2" })).split("\n")[1].startsWith("- network response: POST https://bank/pay → 504"), true);
  assert.match(await live.sql("bank", { database: "db1", query: "select id, amount from tx" }), /^id \| amount\n1 \| 45\n\(1 row, 3 ms\)$/);
  assert.deepEqual((await live.shot("bank")).png, PNG);
  assert.match(live.formatAudit(await live.audit("bank")), /^Audit of Home:/);
});
