// Read-only client for the existing, separately hosted QaLens workbench.
// The desktop session and connection nonce stay in this closure.
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { request } from "node:http";
import { isAbsolute, join } from "node:path";

const MAX_RESPONSE = 2 * 1024 * 1024;
const REQUEST_TIMEOUT = 5000;
const DETECT_TIMEOUT = 800;
// Port the QaLens workbench uses unless started with --port (tools/local-bridge/server.py).
export const DEFAULT_WORKBENCH_URL = "http://127.0.0.1:8765";
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

function readJson(origin, path, { session, connection, body, timeout = REQUEST_TIMEOUT } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, origin);
    const bytes = body === undefined ? null : Buffer.from(JSON.stringify(body));
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
        res.resume();
        const error = new Error(res.statusCode === 401 || res.statusCode === 403
          ? "QaLens authorization expired. Reconnect the workbench."
          : res.statusCode === 409 ? "QaLens device connection changed. Try again."
            : res.statusCode === 503 ? "QaLens phone is not connected. Pair in the workbench."
              : "QaLens request failed (HTTP " + res.statusCode + ").");
        error.status = res.statusCode;
        reject(error);
        return;
      }
      let size = 0;
      const chunks = [];
      res.on("data", (chunk) => {
        size += chunk.length;
        if (size > MAX_RESPONSE) req.destroy(new Error("QaLens response is too large."));
        else chunks.push(chunk);
      });
      res.on("end", () => {
        try {
          const result = JSON.parse(Buffer.concat(chunks).toString("utf8"));
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

export function createQaLensCompanion({ minimumIntervalMs = 1000, now = Date.now } = {}) {
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
  return { attach, start, status, poll, stop, devices, apps, detect };
}
