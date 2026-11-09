// Agent and panel operations over an attached QaLens workbench: act-and-observe with a recorded
// flow, replay, generated UI tests, evidence, audits and source search. Device access goes
// through the companion; this module owns flows and the design target's app guard.
import { auditScreen, commandTarget, composeTest, describeNode, diffScreens, expectationFor, formatAudit, formatDiff, formatTrace,
  maestroFlow, outlineScreen, recentProblems, stableSelector, traceValue, visibleText, clip } from "./qalens-tools.js";
import { searchSource } from "./source-search.js";
import { isSlug } from "./util.js";

const FLOW_LIMIT = 100;
const SETTLE_TRIES = 5;
const SETTLE_MS = 350;

function signature(snapshot) {
  return JSON.stringify([snapshot.screen, snapshot.route, snapshot.nodes.map(n => [n.tag, n.text, n.value, n.role, n.bounds])]);
}

function sanitizeFlow(stored) {
  const flow = stored && typeof stored === "object" ? stored : {};
  const steps = Array.isArray(flow.steps) ? flow.steps : [];
  return {
    package: typeof flow.package === "string" ? flow.package.slice(0, 255) : "",
    activity: typeof flow.activity === "string" ? flow.activity.slice(0, 512) : "",
    steps: steps.slice(0, FLOW_LIMIT).filter(step => step && ["tap", "type", "scroll"].includes(step.op) && step.selector && typeof step.selector.xpath === "string"),
  };
}

export function createQaLensLive({ companion, loadTarget, readJson, writeJson, ensureDir, globalRootPath, join, wait = (ms) => new Promise(resolve => setTimeout(resolve, ms)) }) {
  const flows = new Map();

  const flowPath = (slug) => {
    if (!isSlug(slug)) throw new Error("Pass the design slug that owns this QaLens target.");
    return "_studio/qalens/" + slug + ".flow.json";
  };
  async function loadFlow(slug) {
    if (!flows.has(slug)) flows.set(slug, sanitizeFlow(await readJson(flowPath(slug))));
    return flows.get(slug);
  }
  async function saveFlow(slug, flow) {
    flows.set(slug, flow);
    await ensureDir(join(await globalRootPath(), "_studio", "qalens"));
    await writeJson(flowPath(slug), flow);
  }

  // A design project bound to one app never operates a different connected app.
  async function guard(slug, app) {
    if (!slug) return null;
    const target = await loadTarget(slug);
    if (target.package && app && app.package && app.package !== target.package) {
      throw new Error("QaLens is connected to " + app.package + " but design " + slug + " targets " + target.package + ". Connect the right app in QaLens.");
    }
    return target;
  }

  async function settle(before) {
    let previous = before ? signature(before) : "", latest = null;
    for (let i = 0; i < SETTLE_TRIES; i++) {
      await wait(SETTLE_MS);
      latest = await companion.snapshot();
      const current = signature(latest);
      if (i > 0 && current === previous) break;
      previous = current;
    }
    return latest;
  }

  async function screen(slug, { filter, limit } = {}) {
    const snapshot = await companion.snapshot();
    await guard(slug, snapshot.app);
    return outlineScreen(snapshot, { filter, limit });
  }

  async function shot(slug) {
    const result = await companion.screenshot();
    await guard(slug, result.app);
    return result;
  }

  async function find(slug, xpath) {
    const result = await companion.query(xpath);
    return result.count + " match" + (result.count === 1 ? "" : "es") + " for " + xpath + (result.omittedMatches ? " (" + result.omittedMatches + " not shown)" : "") + "\n"
      + result.nodes.map(node => "- " + node.id + " " + Object.entries(node.attributes).filter(([, v]) => v && v !== "false").map(([k, v]) => k + "=" + clip(v, 60)).join(" ")).join("\n");
  }

  function resolveNode(snapshot, { nodeId, tag }) {
    if (nodeId) return snapshot.nodes.find(node => node.id === nodeId) || null;
    if (tag) { const tagged = snapshot.nodes.filter(node => node.tag === tag); return tagged.length === 1 ? tagged[0] : null; }
    return null;
  }

  async function act(slug, { op, nodeId, tag, xpath, text, dx, dy, record = true } = {}) {
    const before = await companion.snapshot();
    const target = await guard(slug, before.app);
    let node = resolveNode(before, { nodeId, tag });
    if (!node && xpath) {
      const found = await companion.query(xpath);
      if (found.count !== 1) throw new Error("XPath matched " + found.count + " elements; it must match exactly one.");
      node = before.nodes.find(item => item.id === found.nodes[0].id) || null;
    }
    if (!node) throw new Error(nodeId ? "Node " + nodeId + " is not on the current screen; call qalens_screen again." : tag ? "Tag " + tag + " is missing or not unique on this screen." : "Target one element with nodeId, tag or xpath.");
    const selector = stableSelector(node, await companion.selectors(node.id).catch(() => []));
    const result = await companion.command({ action: op, id: node.id, text, dx, dy });
    const after = await settle(before);
    const diff = diffScreens(before, after);
    let recorded = "";
    if (record && slug && selector) {
      const flow = await loadFlow(slug);
      if (!flow.package) flow.package = (target && target.package) || before.app.package || "";
      if (!flow.activity) {
        const doc = await companion.componentDocument(node.id).catch(() => null);
        if (doc && doc.content && typeof doc.content.activity === "string") flow.activity = doc.content.activity.slice(0, 512);
      }
      const secret = op === "type" && node.label === "[protected]";
      const step = { op, selector, node: describeNode(node), screen: before.screen, route: before.route, at: Date.now(),
        ...(op === "type" ? { text: secret ? "" : String(text || ""), ...(secret ? { secret: true } : {}) } : {}),
        ...(op === "scroll" ? { dx: Number(dx) || 0, dy: Number(dy) || 0 } : {}),
        expect: expectationFor(diff, after) };
      if (flow.steps.length >= FLOW_LIMIT) flow.steps.shift();
      flow.steps.push(step);
      await saveFlow(slug, flow);
      recorded = "flow: step " + flow.steps.length + " recorded (" + selector.kind + " " + clip(selector.value, 60) + (selector.stability === "position" ? ", fragile tree position" : "") + ")";
    }
    return [op + (result.accepted ? " accepted" : " sent") + " on " + describeNode(node), ...formatDiff(diff), ...(recorded ? [recorded] : [])].join("\n");
  }

  async function logs(slug, { filter = "", limit = 50 } = {}) {
    const result = await companion.events();
    await guard(slug, result.app);
    const needle = String(filter).toLowerCase();
    const rows = result.logs.filter(log => !needle || (log.tag + " " + log.message).toLowerCase().includes(needle)).slice(-Math.max(1, Math.min(100, Number(limit) || 50)));
    const time = (t) => Number.isFinite(t) ? new Date(t).toISOString().slice(11, 23) : "";
    return (rows.length ? rows.map(log => time(log.time) + " " + log.tag + ": " + log.message).join("\n") : "No matching logs.")
      + (result.omitted.logs ? "\n(" + result.omitted.logs + " older logs omitted by QaLens)" : "");
  }

  async function network(slug, { filter = "", failed = false, limit = 30 } = {}) {
    const result = await companion.events();
    await guard(slug, result.app);
    const needle = String(filter).toLowerCase();
    const rows = result.network.filter(call => (!needle || call.url.toLowerCase().includes(needle)) && (!failed || call.error || (call.status ?? 0) >= 400))
      .slice(-Math.max(1, Math.min(100, Number(limit) || 30)));
    const time = (t) => Number.isFinite(t) ? new Date(t).toISOString().slice(11, 23) : "";
    if (!rows.length) return "No matching requests." + (result.network.length ? "" : " QaLens records network calls only when the app installs its OkHttp interceptor or a network sink.");
    return rows.map(call => time(call.time) + " " + call.method + " " + call.url + " → " + (call.status ?? "no status") + (call.error ? " error: " + call.error : "")
      + (call.durationMs !== null ? " (" + call.durationMs + " ms)" : "")
      + (call.requestPreview ? "\n  request: " + clip(call.requestPreview, 600) : "") + (call.responsePreview ? "\n  response: " + clip(call.responsePreview, 1200) : "")).join("\n");
  }

  async function data(slug, { filter = "" } = {}) {
    const result = await companion.data();
    const needle = String(filter).toLowerCase();
    const lines = [];
    for (const [name, values] of Object.entries(result.dataSources)) {
      for (const [key, value] of Object.entries(values)) if (!needle || (name + " " + key + " " + value).toLowerCase().includes(needle)) lines.push(name + " › " + key + " = " + clip(value, 300));
    }
    return lines.length ? lines.join("\n") : "No decoded app values" + (needle ? " match \"" + clip(filter, 60) + "\"" : "") + ". Values appear when the host app connects a DataStore/preferences source to QaLens.";
  }

  async function sql(slug, { database, query } = {}) {
    if (!query) {
      const catalog = await companion.sqlCatalog();
      return "Read-only SQL (max " + catalog.maxRows + " rows). Databases:\n" + (catalog.databases.map(db => "- " + db.id + " " + db.name).join("\n") || "- none")
        + (catalog.saved.length ? "\nSaved queries:\n" + catalog.saved.map(q => "- " + q.name + " [" + q.database + "]: " + q.sql).join("\n") : "");
    }
    const table = await companion.sql({ database, query });
    return [table.columns.join(" | "), ...table.rows.map(row => row.map(cell => cell === null ? "NULL" : clip(cell, 80)).join(" | "))].join("\n")
      + "\n(" + table.rows.length + " row" + (table.rows.length === 1 ? "" : "s") + (table.limited ? ", limited" : "") + ", " + table.durationMs + " ms)";
  }

  async function nodeFor(slug, nodeId) {
    const snapshot = await companion.snapshot();
    await guard(slug, snapshot.app);
    const id = nodeId || snapshot.selectedId;
    const node = id ? snapshot.nodes.find(item => item.id === id) : null;
    if (!node) throw new Error(id ? "Node " + id + " is not on the current screen." : "Select an element in QaLens or pass nodeId.");
    return { node, snapshot };
  }

  async function trace(slug, { text, nodeId } = {}) {
    const value = text || visibleText((await nodeFor(slug, nodeId)).node);
    const [events, values] = await Promise.all([companion.events(), companion.data().catch(() => null)]);
    return traceValue(value, { events, data: values });
  }

  async function source(slug, { nodeId, tag, text } = {}) {
    const target = await loadTarget(slug);
    if (!target.projectRoot) throw new Error("Set the Android source folder in Design Studio → App → QaLens → Project settings first.");
    let query = { tag: tag || "", texts: text ? [text] : [], descriptions: [] };
    if (!tag && !text) {
      const { node } = await nodeFor(slug, nodeId);
      query = { tag: node.tag, texts: [...node.text, ...(node.value ? [node.value] : [])], descriptions: node.description };
    }
    return { ...(await searchSource(target.projectRoot, query)), query };
  }

  async function audit(slug) {
    const snapshot = await companion.snapshot();
    await guard(slug, snapshot.app);
    let density = 0;
    const probe = snapshot.nodes.find(node => node.actions.length) || snapshot.nodes[0];
    if (probe) {
      const doc = await companion.componentDocument(probe.id).catch(() => null);
      const reported = doc && doc.content && doc.content.viewport && doc.content.viewport.density;
      if (Number.isFinite(reported) && reported > 0) density = reported;
    }
    return auditScreen(snapshot, { density });
  }

  async function flow(slug, { op = "list" } = {}) {
    const current = await loadFlow(slug);
    if (op === "clear") { await saveFlow(slug, { package: current.package, activity: current.activity, steps: [] }); return "Flow cleared."; }
    if (!current.steps.length) return "No steps recorded. Drive the app with qalens_act; each accepted action is recorded with its most stable selector.";
    return current.steps.map((step, i) => (i + 1) + ". " + step.op + " " + step.node + " [" + step.selector.kind + " " + clip(step.selector.value, 60) + "]"
      + (step.op === "type" ? (step.secret ? " (password not stored)" : " text=" + JSON.stringify(clip(step.text, 60))) : "")
      + (step.expect ? " → expect " + step.expect.kind + " " + clip(step.expect.value, 60) : "") + " on " + (step.screen || step.route || "?")).join("\n");
  }

  // Replays recorded steps after a restart or reinstall; stops at the first failure.
  async function replay(slug) {
    const current = await loadFlow(slug);
    if (!current.steps.length) return "No steps recorded.";
    const lines = [];
    for (const [i, step] of current.steps.entries()) {
      if (step.op === "type" && step.secret) { lines.push((i + 1) + ". stopped: the password is not stored; type it on the device, then continue manually."); break; }
      try {
        const target = commandTarget(step.selector);
        const before = await companion.snapshot();
        await guard(slug, before.app);
        await companion.command({ action: step.op, ...(target.tag ? { tag: target.tag } : { xpath: target.xpath }), text: step.text, dx: step.dx, dy: step.dy });
        const after = await settle(before);
        const missing = step.expect && !after.nodes.some(node => step.expect.kind === "tag" ? node.tag === step.expect.value : node.text.includes(step.expect.value));
        lines.push((i + 1) + ". " + step.op + " " + step.node + " ok" + (missing ? " — but expected " + step.expect.kind + " " + clip(step.expect.value, 60) + " did not appear" : ""));
        if (missing) break;
      } catch (error) {
        lines.push((i + 1) + ". " + step.op + " " + step.node + " failed: " + error.message);
        break;
      }
    }
    return "Replayed " + lines.length + " of " + current.steps.length + " steps:\n" + lines.join("\n");
  }

  async function test(slug, { format = "compose", name = "" } = {}) {
    const current = await loadFlow(slug);
    const subject = { ...current, name };
    return format === "maestro" ? maestroFlow(subject) : composeTest(subject, { testName: name });
  }

  async function evidence(slug) {
    const [events, values, snapshot] = await Promise.all([companion.events(), companion.data().catch(() => null), companion.snapshot().catch(() => null)]);
    await guard(slug, events.app);
    const selected = snapshot && snapshot.selectedId ? snapshot.nodes.find(node => node.id === snapshot.selectedId) : null;
    const value = selected ? visibleText(selected) : "";
    return { problems: recentProblems(events), trace: value ? traceValue(value, { events, data: values }) : null, selectedId: selected ? selected.id : null };
  }

  return { screen, shot, find, act, logs, network, data, sql, trace, source, audit, flow, replay, test, evidence, formatTrace, formatAudit };
}
