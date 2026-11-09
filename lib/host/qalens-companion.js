// Client for the existing, separately hosted QaLens workbench. Selection previews are read-only;
// live calls (tree, screenshot, logs, data, SQL, tap/type/scroll) run only when an operator or
// agent asks, and a device command is never retried. The desktop session stays in this closure.
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { request } from "node:http";
import { isAbsolute, join } from "node:path";

const MAX_RESPONSE = 2 * 1024 * 1024;
const REQUEST_TIMEOUT = 5000;
const DETECT_TIMEOUT = 800;
// Port the QaLens workbench uses unless started with --port (tools/local-bridge/server.py).
export const DEFAULT_WORKBENCH_URL = "http://127.0.0.1:8765";
const MAX_SCREENSHOT = 16 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const COMMAND_TIMEOUT = 8000;
const SQL_DEADLINE = 12000;
const DEVICE_SERIAL = /^[A-Za-z0-9_.:\[\]-]{1,128}$/;
const PACKAGE_NAME = /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)+$/;

function loopbackOrigin(value) {
  if (!/^http:\/\/127\.0\.0\.1:[0-9]{1,5}\/?$/.test(String(value))) {
    throw new Error("QaLens workbench must use http://127.0.0.1:<port> with no path or credentials");
  }
  let url;
  try { url = new URL(String(value)); } catch (_) { throw new Error("Enter a QaLens workbench URL on 127.0.0.1"); }
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || !url.port || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("QaLens workbench must use http://127.0.0.1:<port> with no path or credentials");
  }
  return url.origin;
}

function statusMessage(status) {
  return status === 401 || status === 403 ? "QaLens authorization expired. Reconnect the workbench."
    : status === 409 ? "QaLens device connection changed. Try again."
      : status === 503 ? "QaLens phone is not connected. Pair in the workbench."
        : "QaLens request failed (HTTP " + status + ").";
}

// `detail` surfaces the device's own short error text (for example "XPath is ambiguous (3
// matches)") for live calls; selection polling keeps the fixed messages.
function readJson(origin, path, { session, connection, body, timeout = REQUEST_TIMEOUT, detail = false, binary = false } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, origin);
    const bytes = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const limit = binary ? MAX_SCREENSHOT : MAX_RESPONSE;
    const req = request(url, {
      method: bytes ? "POST" : "GET",
      headers: {
        ...(session ? { "X-Qalens-Session": session } : {}),
        ...(connection ? { "X-Qalens-Connection": connection } : {}),
        ...(bytes ? { "Content-Type": "application/json", "Content-Length": bytes.length } : {}),
      },
      timeout,
      agent: false,
    }, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        const fail = (message) => { const error = new Error(message); error.status = res.statusCode; reject(error); };
        if (!detail || res.statusCode === 401 || res.statusCode === 403) { res.resume(); fail(statusMessage(res.statusCode)); return; }
        const chunks = [];
        let size = 0;
        res.on("data", (chunk) => { size += chunk.length; if (size <= 65536) chunks.push(chunk); });
        res.on("end", () => {
          let text = "";
          try { const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")); if (typeof parsed.error === "string") text = parsed.error.replace(/\s+/g, " ").trim().slice(0, 300); } catch (_) {}
          fail(text ? "QaLens: " + text : statusMessage(res.statusCode));
        });
        res.on("error", () => fail(statusMessage(res.statusCode)));
        return;
      }
      let size = 0;
      const chunks = [];
      res.on("data", (chunk) => {
        size += chunk.length;
        if (size > limit) req.destroy(new Error("QaLens response is too large."));
        else chunks.push(chunk);
      });
      res.on("end", () => {
        const data = Buffer.concat(chunks);
        if (binary) {
          if (data.length > 8 && data.subarray(0, 8).equals(PNG_SIGNATURE)) resolve(data);
          else reject(new Error("QaLens returned an invalid screenshot."));
          return;
        }
        try {
          const result = JSON.parse(data.toString("utf8"));
          if (!result || typeof result !== "object" || Array.isArray(result) || result.ok === false) throw new Error();
          resolve(result);
        } catch (_) { reject(new Error("QaLens returned an invalid response.")); }
      });
      res.on("error", () => reject(new Error("QaLens response was interrupted.")));
    });
    req.on("timeout", () => req.destroy(new Error("QaLens request timed out.")));
    req.on("error", () => reject(new Error("QaLens is unavailable or timed out.")));
    if (bytes) req.write(bytes);
    req.end();
  });
}

const text = (value, max = 512) => typeof value === "string" ? value.slice(0, max) : "";
const texts = (value, count = 8, max = 512) => Array.isArray(value) ? value.filter(item => typeof item === "string").slice(0, count).map(item => item.slice(0, max)) : [];
const integer = (value) => Number.isFinite(value) ? Math.round(value) : 0;
const size = (value) => value && typeof value === "object" ? { width: integer(value.width), height: integer(value.height) } : { width: 0, height: 0 };

function normalizeNode(node) {
  const b = node.bounds && typeof node.bounds === "object" ? node.bounds : {};
  return {
    id: text(node.id, 128), parentId: text(node.parentId, 128) || null, windowId: text(node.windowId, 128) || null,
    tag: text(node.tag, 256), label: text(node.label), text: texts(node.text), description: texts(node.description, 4),
    role: text(node.role, 64), value: typeof node.value === "string" ? node.value.slice(0, 512) : null,
    state: typeof node.state === "string" ? node.state.slice(0, 256) : null, enabled: node.enabled !== false,
    bounds: { left: integer(b.left), top: integer(b.top), right: integer(b.right), bottom: integer(b.bottom) },
    actions: texts(node.actions, 8, 32),
  };
}

function normalizeSnapshot(result) {
  return {
    screen: text(result.screen, 256), route: text(result.route, 256),
    capturedAtMillis: Number.isFinite(result.capturedAtMillis) ? result.capturedAtMillis : Date.now(),
    selectedId: text(result.selectedId, 128) || null, viewport: size(result.viewport), screenViewport: size(result.screenViewport),
    omittedNodes: Number.isSafeInteger(result.omittedNodes) ? result.omittedNodes : 0,
    nodes: (Array.isArray(result.nodes) ? result.nodes : []).slice(0, 1000).filter(node => node && typeof node.id === "string" && node.id).map(normalizeNode),
  };
}

function normalizeEvents(result) {
  const entry = (item) => ({ time: Number.isFinite(item.time) ? item.time : null, type: text(item.type, 32), tag: text(item.tag, 128), message: text(item.message, 2048) });
  const list = (value) => (Array.isArray(value) ? value : []).filter(item => item && typeof item === "object").slice(-100);
  return {
    logs: list(result.logs).map(entry), events: list(result.events).map(entry),
    network: list(result.network).map(item => ({
      time: Number.isFinite(item.time) ? item.time : null, method: text(item.method, 16), url: text(item.url, 2048),
      status: Number.isFinite(item.status) ? item.status : null, error: text(item.error, 512) || null,
      durationMs: Number.isFinite(item.durationMs) ? item.durationMs : null,
      requestPreview: text(item.requestPreview, 4096) || null, responsePreview: text(item.responsePreview, 4096) || null,
    })),
    omitted: { logs: integer(result.omittedLogs), events: integer(result.omittedEvents), network: integer(result.omittedNetwork) },
  };
}

function normalizeData(result) {
  const sources = {};
  for (const [name, values] of Object.entries(result.dataSources && typeof result.dataSources === "object" ? result.dataSources : {}).slice(0, 30)) {
    if (!values || typeof values !== "object") continue;
    sources[name.slice(0, 200)] = Object.fromEntries(Object.entries(values).slice(0, 300).map(([key, value]) => [key.slice(0, 200), String(value).slice(0, 2048)]));
  }
  return { dataSources: sources, omittedFields: integer(result.omittedFields), omittedSources: integer(result.omittedSources) };
}

export function createQaLensCompanion({ minimumIntervalMs = 1000, now = Date.now, wait = (ms) => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  const connectionInstance = randomUUID();
  let origin = "", session = "", owned = null, generation = 0, pending = null, lastPoll = 0;
  let phase = "disconnected", connected = false, connectedTarget = null, selection = null, component = null, error = "";
  let componentKey = "", snapshotAt = 0, snapshotSignature = "", connectionKey = "", connectionRevision = 0;
  const childStops = new Map();

  function clearSelection() { selection = null; component = null; componentKey = ""; snapshotAt = 0; snapshotSignature = ""; }
  function status() {
    return { state: session ? "ready" : (origin ? "disconnected" : "stopped"), url: origin,
      owned: Boolean(owned), phase, connected, connectedTarget, connectionInstance, connectionRevision, selection, component, error };
  }
  function reset() {
    generation++; connectionRevision++; connectionKey = ""; session = ""; origin = ""; phase = "disconnected"; connected = false; connectedTarget = null;
    clearSelection(); error = ""; lastPoll = 0; pending = null;
  }
  function stopChild(child) {
    if (!child || !child.pid || child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
    if (childStops.has(child)) return childStops.get(child);
    const stopping = new Promise((resolve) => {
      let timer;
      const done = () => { clearTimeout(timer); resolve(); };
      const failed = () => { child.removeListener("exit", done); done(); };
      child.once("exit", done);
      try { if (!child.kill("SIGTERM")) { failed(); return; } } catch (_) { failed(); return; }
      timer = setTimeout(() => { try { if (!child.kill("SIGKILL")) failed(); } catch (_) { failed(); } }, 3000);
      timer.unref();
    }).finally(() => childStops.delete(child));
    childStops.set(child, stopping);
    return stopping;
  }
  async function stop() {
    const child = owned;
    owned = null;
    reset();
    if (child) stopChild(child);
    await Promise.all([...childStops.values()]);
    return status();
  }
  async function attach(url) {
    const target = loopbackOrigin(url);
    const stopping = stop();
    const current = generation;
    await stopping;
    if (current !== generation) throw new Error("QaLens connection was cancelled.");
    origin = target;
    try {
      const boot = await readJson(origin, "/api/bootstrap");
      if (current !== generation) throw new Error("QaLens connection was cancelled.");
      if (typeof boot.session !== "string" || !boot.session || boot.session.length > 1024) throw new Error("QaLens bootstrap was invalid.");
      session = boot.session;
      return status();
    } catch (err) {
      if (current === generation) { session = ""; error = err.message; }
      throw err;
    }
  }
  // Only call with trusted host configuration, never with arguments from the web API.
  async function start({ checkout, python = "python3", dataDir } = {}) {
    if (!checkout || !isAbsolute(checkout) || typeof python !== "string" || !python || (dataDir && !isAbsolute(dataDir))) {
      throw new Error("Configure an absolute QaLens checkout (and absolute data directory, if set). ");
    }
    const stopping = stop();
    const current = generation;
    await stopping;
    if (current !== generation) throw new Error("QaLens start was cancelled.");
    const args = [join(checkout, "tools", "local-bridge", "server.py"), "--gui", "--port", "0"];
    if (dataDir) args.push("--data-dir", dataDir);
    const child = spawn(python, args, { cwd: checkout, stdio: ["ignore", "pipe", "ignore"], windowsHide: true });
    owned = child;
    let text = "";
    const address = await new Promise((resolve, reject) => {
      let timer;
      const done = (err, value) => {
        clearTimeout(timer); child.stdout.removeListener("data", onData);
        child.removeListener("error", onError); child.removeListener("exit", onExit);
        if (!err) child.stdout.resume();
        err ? reject(err) : resolve(value);
      };
      const onError = () => done(new Error("Could not start QaLens. Check the configured checkout and Python installation."));
      const onExit = () => done(new Error("QaLens exited before starting. Check its checkout and data directory."));
      const onData = (chunk) => {
        text = (text + chunk.toString("utf8")).slice(-4096);
        const match = text.match(/QaLens workbench: (http:\/\/127\.0\.0\.1:\d+)/);
        if (match) done(null, match[1]);
      };
      child.once("error", onError); child.once("exit", onExit); child.stdout.on("data", onData);
      timer = setTimeout(() => done(new Error("QaLens did not start in time.")), 15000);
      timer.unref();
    }).catch(async (err) => {
      if (owned === child) { owned = null; reset(); }
      await stopChild(child);
      throw err;
    });
    if (current !== generation || owned !== child) { await stopChild(child); throw new Error("QaLens start was cancelled."); }
    origin = loopbackOrigin(address);
    try {
      const boot = await readJson(origin, "/api/bootstrap");
      if (current !== generation || owned !== child) throw new Error("QaLens start was cancelled.");
      if (typeof boot.session !== "string" || !boot.session || boot.session.length > 1024) throw new Error("QaLens bootstrap was invalid.");
      if (child.exitCode !== null || child.signalCode !== null) throw new Error("QaLens exited before starting.");
      session = boot.session;
      child.once("exit", () => { if (owned === child) { owned = null; session = ""; connected = false; connectedTarget = null; phase = "disconnected"; clearSelection(); error = "QaLens stopped."; generation++; } });
      return status();
    } catch (err) {
      if (owned === child) { owned = null; reset(); }
      await stopChild(child);
      throw err;
    }
  }
  async function poll({ force = false } = {}) {
    if (!session) return status();
    while (pending) {
      if (!force) return pending;
      await pending;
      if (!session) return status();
    }
    if (!force && now() - lastPoll < Math.max(0, minimumIntervalMs)) return status();
    lastPoll = now();
    const current = generation, base = origin, secret = session;
    const run = (async () => {
      try {
        const bench = await readJson(base, "/api/workbench", { session: secret });
        if (current !== generation) return status();
        phase = typeof bench.phase === "string" ? bench.phase : "unknown";
        connected = bench.connected === true;
        const target = bench.connection;
        connectedTarget = connected && bench.connectionId && target && typeof target.serial === "string" && DEVICE_SERIAL.test(target.serial)
          && typeof target.package === "string" && target.package.length <= 255 && PACKAGE_NAME.test(target.package)
          ? { serial: target.serial, package: target.package } : null;
        error = "";
        if (!connected || !bench.connectionId) {
          if (connectionKey) { connectionKey = ""; connectionRevision++; }
          clearSelection(); return status();
        }
        const connection = bench.connectionId;
        if (connection !== connectionKey) { connectionKey = connection; connectionRevision++; }
        const selected = await readJson(base, "/api/selection", { session: secret });
        if (current !== generation) return status();
        if (selected.connectionId !== connection) throw new Error("QaLens device connection changed. Try again.");
        if (typeof selected.selectedId !== "string" || !selected.selectedId) { clearSelection(); return status(); }
        const id = selected.selectedId;
        const key = JSON.stringify([connection, id]);
        if (force || key !== componentKey || now() - snapshotAt >= 5000) {
          const changedId = key !== componentKey;
          if (changedId) clearSelection();
          let nodeDetails = { sourceRef: null, actions: [], screen: "", route: "", snapshotWarning: "" };
          let signature = "", snapshotSucceeded = false;
          try {
            const snapshot = await readJson(base, "/api/snapshot", { session: secret });
            if (current !== generation) return status();
            if (snapshot.connectionId !== connection) throw new Error("QaLens device connection changed. Try again.");
            const matches = Array.isArray(snapshot.nodes) ? snapshot.nodes.filter(node => node && node.id === id) : [];
            if (matches.length === 1) {
              const node = matches[0];
              signature = JSON.stringify(node);
              snapshotSucceeded = true;
              nodeDetails = {
                sourceRef: typeof node.sourceRef === "string" && /^[a-f0-9]{64}$/.test(node.sourceRef) ? node.sourceRef : null,
                actions: Array.isArray(node.actions) ? node.actions.filter(action => typeof action === "string").slice(0, 32).map(action => action.slice(0, 100)) : [],
                screen: typeof snapshot.screen === "string" ? snapshot.screen.slice(0, 256) : "",
                route: typeof snapshot.route === "string" ? snapshot.route.slice(0, 256) : "",
                snapshotWarning: "",
              };
            } else nodeDetails.snapshotWarning = "Selected node is missing or ambiguous in the current snapshot.";
          } catch (err) {
            if (err.status === 401 || err.status === 403 || err.status === 503 || err.message === "QaLens device connection changed. Try again.") throw err;
            nodeDetails.snapshotWarning = "Source reference and actions are unavailable from the current snapshot.";
          }
          let document = component;
          if (changedId || (snapshotSucceeded && signature !== snapshotSignature)) {
            const result = await readJson(base, "/api/component", { session: secret, connection, body: { id } });
            if (current !== generation) return status();
            if (!result.document || typeof result.document !== "object") throw new Error("QaLens component was unavailable.");
            document = result.document;
          }
          // The preview request may outlive the selection or device connection.
          const latest = await readJson(base, "/api/selection", { session: secret });
          if (current !== generation) return status();
          if (latest.connectionId !== connection || latest.selectedId !== id) throw new Error("QaLens selection changed. Try again.");
          component = document; componentKey = key;
          snapshotAt = now(); snapshotSignature = snapshotSucceeded ? signature : "";
          selection = { id, ...nodeDetails };
        }
      } catch (err) {
        if (current === generation) {
          clearSelection(); error = err.message || "QaLens is unavailable.";
          if (connectionKey) { connectionKey = ""; connectionRevision++; }
          connected = false; connectedTarget = null;
          if (err.status === 401 || err.status === 403) { session = ""; phase = "disconnected"; connected = false; }
          if (err.status === 503) { phase = "disconnected"; connected = false; }
        }
      }
      return status();
    })();
    pending = run;
    try { return await run; } finally { if (pending === run) pending = null; }
  }
  async function discover(path, body) {
    if (!session) throw new Error("Attach a QaLens workbench before scanning.");
    const current = generation;
    const result = await readJson(origin, path, { session, body, timeout: 15000 });
    if (current !== generation) throw new Error("QaLens connection changed during scanning.");
    return result;
  }
  async function devices() {
    const result = await discover("/api/devices", {});
    if (!Array.isArray(result.devices)) throw new Error("QaLens returned an invalid device list.");
    return result.devices.slice(0, 100).filter(d => d && typeof d.serial === "string" && DEVICE_SERIAL.test(d.serial))
      .map(d => ({ serial: d.serial, state: typeof d.state === "string" ? d.state.slice(0, 32) : "unknown",
        description: typeof d.description === "string" ? d.description.slice(0, 256) : "" }));
  }
  async function apps(serial) {
    if (typeof serial !== "string" || !DEVICE_SERIAL.test(serial)) throw new Error("Choose a valid device first.");
    const result = await discover("/api/apps", { serial });
    if (!Array.isArray(result.apps)) throw new Error("QaLens returned an invalid app list.");
    return result.apps.slice(0, 2000).filter(a => a && a.qalens === true && typeof a.package === "string"
      && a.package.length <= 255 && PACKAGE_NAME.test(a.package)).map(a => ({ package: a.package }));
  }
  // Read-only probe: which loopback workbenches answer /api/bootstrap. Sessions are never returned.
  async function detect(candidates = []) {
    const origins = [];
    for (const candidate of [...candidates, DEFAULT_WORKBENCH_URL]) {
      let candidateOrigin;
      try { candidateOrigin = loopbackOrigin(candidate); } catch (_) { continue; }
      if (!origins.includes(candidateOrigin)) origins.push(candidateOrigin);
    }
    const found = [];
    for (const candidateOrigin of origins.slice(0, 4)) {
      try {
        const boot = await readJson(candidateOrigin, "/api/bootstrap", { timeout: DETECT_TIMEOUT });
        if (typeof boot.session === "string" && boot.session) found.push(candidateOrigin);
      } catch (_) {}
    }
    return found;
  }
  // Every live call re-reads the workbench connection and sends it as X-Qalens-Connection, so a
  // call can never land on a phone or app that was reconnected in between.
  async function live() {
    if (!session) throw new Error("Attach a QaLens workbench first (Design Studio → App → QaLens).");
    const link = { current: generation, base: origin, secret: session };
    const bench = await readJson(link.base, "/api/workbench", { session: link.secret });
    if (link.current !== generation) throw new Error("QaLens connection changed. Try again.");
    if (bench.connected !== true || typeof bench.connectionId !== "string" || !bench.connectionId) {
      throw new Error("No app is connected in QaLens. Connect the app in the workbench and approve it on the phone.");
    }
    const target = bench.connection || {};
    link.connection = bench.connectionId;
    link.app = { package: typeof target.package === "string" && PACKAGE_NAME.test(target.package) ? target.package : "",
      serial: typeof target.serial === "string" && DEVICE_SERIAL.test(target.serial) ? target.serial : "" };
    return link;
  }
  async function liveCall(path, { body, timeout, binary = false, link: given } = {}) {
    const link = given || await live();
    const result = await readJson(link.base, path, { session: link.secret, connection: link.connection, body, timeout, detail: true, binary });
    if (link.current !== generation) throw new Error("QaLens connection changed. Try again.");
    if (!binary && typeof result.connectionId === "string" && result.connectionId !== link.connection) throw new Error("QaLens device connection changed. Try again.");
    return { result, link };
  }
  async function snapshot() {
    const { result, link } = await liveCall("/api/snapshot");
    return { ...normalizeSnapshot(result), app: link.app };
  }
  async function screenshot() {
    const { result, link } = await liveCall("/api/screenshot", { body: { includeOverlay: false }, timeout: COMMAND_TIMEOUT, binary: true });
    return { png: result, app: link.app };
  }
  async function query(xpath) {
    if (typeof xpath !== "string" || !xpath.trim() || xpath.length > 2048) throw new Error("Supply a QaLens XPath such as //node[@tag='save'].");
    const { result } = await liveCall("/api/query", { body: { xpath } });
    return { count: integer(result.count), omittedMatches: integer(result.omittedMatches), omittedNodes: integer(result.omittedNodes),
      nodes: (Array.isArray(result.nodes) ? result.nodes : []).slice(0, 100).map(node => ({ id: text(node && node.id, 128),
        attributes: node && node.attributes && typeof node.attributes === "object" ? Object.fromEntries(Object.entries(node.attributes).slice(0, 32).map(([k, v]) => [k.slice(0, 64), String(v).slice(0, 512)])) : {} })) };
  }
  async function selectors(id) {
    if (typeof id !== "string" || !id || id.length > 128) throw new Error("Supply a current node id.");
    const { result } = await liveCall("/api/selectors", { body: { id } });
    return (Array.isArray(result.suggestions) ? result.suggestions : []).slice(0, 8).filter(item => item && typeof item.xpath === "string")
      .map(item => ({ title: text(item.title, 128), xpath: item.xpath.slice(0, 2048), matches: integer(item.matches), stability: text(item.stability, 16) }));
  }
  async function command({ action, id, tag, xpath, text: typed, dx, dy } = {}) {
    if (!["tap", "type", "scroll"].includes(action)) throw new Error("Use tap, type or scroll.");
    const targets = { id, tag, xpath };
    const chosen = Object.entries(targets).filter(([, value]) => typeof value === "string" && value.trim());
    if (chosen.length !== 1) throw new Error("Target exactly one element: nodeId, tag or xpath.");
    const body = { action, [chosen[0][0]]: chosen[0][1] };
    if (action === "type") {
      if (typeof typed !== "string" || typed.length > 4096) throw new Error("Typing needs text of at most 4096 characters.");
      body.text = typed;
    }
    if (action === "scroll") {
      const x = Number(dx) || 0, y = Number(dy) || 0;
      if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 10000 || Math.abs(y) > 10000 || (!x && !y)) throw new Error("Scroll needs dx and/or dy within ±10000 pixels.");
      body.dx = x; body.dy = y;
    }
    const { result, link } = await liveCall("/api/command", { body, timeout: COMMAND_TIMEOUT });
    return { accepted: result.accepted === true, id: text(result.id, 128), action, app: link.app };
  }
  async function events() {
    const { result, link } = await liveCall("/api/events");
    return { ...normalizeEvents(result), app: link.app };
  }
  async function data() {
    const { result } = await liveCall("/api/data");
    return normalizeData(result);
  }
  async function componentDocument(id) {
    const { result } = await liveCall("/api/component", { body: { id } });
    return result.document && typeof result.document === "object" ? result.document : null;
  }
  async function sqlCatalog() {
    const { result } = await liveCall("/api/sql");
    return { databases: (Array.isArray(result.databases) ? result.databases : []).slice(0, 100).map(db => ({ id: text(db && db.id, 128), name: text(db && db.name, 200) })),
      saved: (Array.isArray(result.saved) ? result.saved : []).slice(0, 50).map(q => ({ name: text(q && q.name, 100), database: text(q && q.database, 128), sql: text(q && q.sql, 4096) })),
      maxRows: integer(result.maxRows) || 100 };
  }
  async function sql({ database, query: statement } = {}) {
    if (typeof database !== "string" || !database || database.length > 128) throw new Error("Choose a database id from qalens_sql without a query.");
    if (typeof statement !== "string" || !statement.trim() || statement.length > 4096) throw new Error("Supply one read-only SQL statement (at most 4096 characters).");
    const { result: started, link } = await liveCall("/api/sql", { body: { action: "start", database, sql: statement } });
    const id = text(started.id, 128);
    const deadline = now() + SQL_DEADLINE;
    while (now() < deadline) {
      await wait(250);
      const { result } = await liveCall("/api/sql", { body: { action: "status", id }, link });
      if (result.phase === "complete" && result.result) {
        const table = result.result;
        const columns = texts(table.columns, 30, 128);
        const cells = (row) => Array.isArray(row) ? row : row && typeof row === "object" ? columns.map(column => row[column]) : [];
        return { columns, rows: (Array.isArray(table.rows) ? table.rows : []).slice(0, 100).map(row => cells(row).slice(0, 30).map(cell => cell === null || cell === undefined ? null : String(cell).slice(0, 512))),
          limited: table.limited === true, durationMs: integer(table.durationMs) };
      }
      if (result.phase === "error" || result.phase === "cancelled") throw new Error("QaLens SQL " + result.phase + ": " + (text(result.error, 300) || "no detail"));
    }
    await liveCall("/api/sql", { body: { action: "cancel", id }, link }).catch(() => {});
    throw new Error("QaLens SQL did not finish within 12 seconds and was cancelled.");
  }
  return { attach, start, status, poll, stop, devices, apps, detect, snapshot, screenshot, query, selectors, command, events, data, componentDocument, sqlCatalog, sql };
}
