// Android/Appium inside Design Studio.
//
// A design system can carry an Android app target. This module owns the
// Appium session, the live UI tree, screenshots, selection, and the bridge
// from a running app back into the project's files and Design Studio history.
//
// Per-project config lives in the profile at _studio/appium/<slug>.json.
// Live frames live at _studio/appium/<slug>/frames/live.png.
// Explicit captures are copied into the design project at
// assets/images/app/ and a Design Studio history snapshot is taken.

import { createHash, randomUUID } from "node:crypto";
import { dirname } from "node:path";
import { isSlug } from "./util.js";

const DEFAULT_CAPABILITIES = {
  platformName: "Android",
  "appium:automationName": "UiAutomator2",
  "appium:deviceName": "Android",
  "appium:appPackage": "",
  "appium:appActivity": "",
  "appium:noReset": true,
  "appium:newCommandTimeout": 86400,
};

const DEFAULT_CONFIG = {
  url: "http://127.0.0.1:4723",
  capabilities: DEFAULT_CAPABILITIES,
  projectRoot: "",
  buildTask: ":app:assembleDebug",
  apkPath: "app/build/outputs/apk/debug/app-debug.apk",
  startTimeoutMs: 60000,
  requestTimeoutMs: 30000,
};

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
}

function pngSize(buf) {
  if (!buf || buf.length < 24) return null;
  if (buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function decodeXml(value) {
  return String(value)
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      try { return String.fromCodePoint(parseInt(hex, 16)); } catch (_) { return ""; }
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      try { return String.fromCodePoint(Number(dec)); } catch (_) { return ""; }
    });
}

function attrsOf(text) {
  const attrs = {};
  const re = /([\w:.-]+)="([^"]*)"/g;
  let match;
  while ((match = re.exec(text))) attrs[match[1]] = decodeXml(match[2]);
  return attrs;
}

function parseBounds(text) {
  const match = /\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]/.exec(String(text || ""));
  if (!match) return null;
  const x1 = Number(match[1]);
  const y1 = Number(match[2]);
  const x2 = Number(match[3]);
  const y2 = Number(match[4]);
  return { x: x1, y: y1, w: Math.max(0, x2 - x1), h: Math.max(0, y2 - y1) };
}

// Accepts both uiautomator2 7 (<node class="...">) and Appium 3
// (the class name is the element tag) page sources.
export function parseUiTree(xml) {
  const nodes = [];
  const stack = [];
  let depth = 0;
  const re = /<([A-Za-z][\w.$:-]*)([^>]*?)(\/?)>|<\/\s*([A-Za-z][\w.$:-]*)\s*>/g;
  let match;
  while ((match = re.exec(xml))) {
    if (match[4]) {
      if (stack.length) stack.pop();
      depth = Math.max(0, depth - 1);
      continue;
    }
    const tag = match[1];
    if (tag === "hierarchy") {
      stack.push(null);
      depth += 1;
      if (match[3] === "/") { stack.pop(); depth = Math.max(0, depth - 1); }
      continue;
    }
    const attrs = attrsOf(match[2] || "");
    let bounds = parseBounds(attrs.bounds);
    if (!bounds && nodes.length === 0) {
      const w = Number(attrs.width);
      const h = Number(attrs.height);
      if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) bounds = { x: 0, y: 0, w, h };
    }
    const node = {
      index: nodes.length,
      depth,
      bounds,
      text: attrs.text || "",
      resourceId: attrs["resource-id"] || "",
      contentDesc: attrs["content-desc"] || "",
      className: attrs.class || tag,
      package: attrs.package || "",
      clickable: attrs.clickable === "true",
      enabled: attrs.enabled !== "false",
      checkable: attrs.checkable === "true",
      checked: attrs.checked === "true",
      selected: attrs.selected === "true",
      focused: attrs.focused === "true" || attrs["a11y-focused"] === "true",
      attrs,
    };
    nodes.push(node);
    stack.push(node);
    depth += 1;
    if (match[3] === "/") { stack.pop(); depth = Math.max(0, depth - 1); }
  }
  return nodes;
}

function xpathLiteral(value) {
  const text = String(value);
  if (!text.includes('"')) return '"' + text + '"';
  if (!text.includes("'")) return "'" + text + "'";
  const args = [];
  text.split('"').forEach((part, index, parts) => {
    if (part) args.push('"' + part + '"');
    if (index < parts.length - 1) args.push("'\"'");
  });
  return "concat(" + args.join(", ") + ")";
}

export function locatorFor(node) {
  if (node.resourceId) return { using: "xpath", value: "//*[@resource-id=" + xpathLiteral(node.resourceId) + "]" };
  if (node.contentDesc) return { using: "accessibility id", value: node.contentDesc };
  if (node.text) return { using: "xpath", value: "//*[@text=" + xpathLiteral(node.text) + "]" };
  return { using: "class name", value: node.className };
}

function nodeAt(nodes, x, y) {
  let best = null;
  for (const node of nodes) {
    const b = node.bounds;
    if (!b || b.w <= 0 || b.h <= 0) continue;
    if (x < b.x || y < b.y || x > b.x + b.w || y > b.y + b.h) continue;
    if (!best || b.w * b.h < best.bounds.w * best.bounds.h) best = node;
  }
  return best;
}

function treeHash(xml) {
  return createHash("sha256").update(String(xml || "")).digest("hex").slice(0, 16);
}

export function createAppium({ fs, rootPath, readJson, writeJson, designFs, resolveSystem, writeBytes, ensureDir, bumpDesignStamp, captureHistory, attachments }) {
  let session = null;

  function requireSlug(slug) {
    if (!isSlug(slug)) throw new Error("invalid design system slug");
    return String(slug);
  }

  function configPath(slug) {
    return "_studio/appium/" + slug + ".json";
  }

  function framesPath(slug) {
    return "_studio/appium/" + slug + "/frames";
  }

  function historyPath(slug) {
    return "_studio/appium/" + slug + "/history.json";
  }

  async function loadConfig(slug) {
    requireSlug(slug);
    const parsed = await readJson(configPath(slug));
    const cfg = {
      url: DEFAULT_CONFIG.url,
      capabilities: Object.assign({}, DEFAULT_CONFIG.capabilities),
      startTimeoutMs: DEFAULT_CONFIG.startTimeoutMs,
      requestTimeoutMs: DEFAULT_CONFIG.requestTimeoutMs,
    };
    if (parsed && typeof parsed === "object") {
      if (typeof parsed.url === "string" && /^https?:\/\//.test(parsed.url)) cfg.url = parsed.url.replace(/\/+$/, "");
      if (parsed.capabilities && typeof parsed.capabilities === "object") cfg.capabilities = Object.assign(cfg.capabilities, parsed.capabilities);
      cfg.startTimeoutMs = clampInt(parsed.startTimeoutMs, 5000, 600000, cfg.startTimeoutMs);
      cfg.requestTimeoutMs = clampInt(parsed.requestTimeoutMs, 3000, 300000, cfg.requestTimeoutMs);
      if (typeof parsed.projectRoot === "string") cfg.projectRoot = parsed.projectRoot;
      if (typeof parsed.buildTask === "string") cfg.buildTask = parsed.buildTask;
      if (typeof parsed.apkPath === "string") cfg.apkPath = parsed.apkPath;
    }
    // Keep the session alive across tab switches and idle time.
    if (Number(cfg.capabilities["appium:newCommandTimeout"]) < 3600) cfg.capabilities["appium:newCommandTimeout"] = 86400;
    return cfg;
  }

  async function saveConfig(slug, patch) {
    requireSlug(slug);
    const cfg = await loadConfig(slug);
    if (!patch || typeof patch !== "object") throw new Error("config patch must be an object");
    if (patch.url !== undefined) {
      const url = String(patch.url || "").trim().replace(/\/+$/, "");
      if (!/^https?:\/\//.test(url)) throw new Error("url must start with http:// or https://");
      cfg.url = url;
    }
    if (patch.capabilities !== undefined) {
      if (!patch.capabilities || typeof patch.capabilities !== "object" || Array.isArray(patch.capabilities)) {
        throw new Error("capabilities must be an object");
      }
      for (const [key, value] of Object.entries(patch.capabilities)) {
        if (!/^[A-Za-z0-9:_-]{1,120}$/.test(key)) throw new Error("invalid capability name: " + key);
        if (value !== null && typeof value === "object") throw new Error("capability " + key + " must be a string, number or boolean");
        cfg.capabilities[key] = value;
      }
    }
    if (patch.startTimeoutMs !== undefined) cfg.startTimeoutMs = clampInt(patch.startTimeoutMs, 5000, 600000, cfg.startTimeoutMs);
    if (patch.requestTimeoutMs !== undefined) cfg.requestTimeoutMs = clampInt(patch.requestTimeoutMs, 3000, 300000, cfg.requestTimeoutMs);
    if (patch.projectRoot !== undefined) {
      const root = String(patch.projectRoot || "").trim();
      if (root && (!/^\//.test(root) || /[\n\r]/.test(root))) throw new Error("projectRoot must be an absolute path");
      cfg.projectRoot = root;
    }
    if (patch.buildTask !== undefined) {
      const task = String(patch.buildTask || "").trim();
      if (!/^[A-Za-z0-9:_\- ]{1,160}$/.test(task)) throw new Error("invalid Gradle build task");
      cfg.buildTask = task;
    }
    if (patch.apkPath !== undefined) {
      const apk = String(patch.apkPath || "").trim();
      if (!apk || apk.startsWith("/") || apk.includes("..") || /[\n\r]/.test(apk)) throw new Error("apkPath must be a relative path inside projectRoot");
      cfg.apkPath = apk;
    }
    await writeJson(configPath(slug), cfg);
    return cfg;
  }

  async function request(method, url, path, body, timeoutMs) {
    const full = url.replace(/\/+$/, "") + path;
    const timeout = Math.max(1000, Number(timeoutMs) || DEFAULT_CONFIG.requestTimeoutMs);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(full, {
        method,
        headers: { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await res.text();
      let parsed = null;
      try { parsed = text ? JSON.parse(text) : null; } catch (_) { parsed = null; }
      if (!res.ok) {
        const message = parsed && parsed.value && parsed.value.message ? parsed.value.message : String(text || "").slice(0, 400);
        throw new Error("Appium " + method + " " + path + " -> HTTP " + res.status + (message ? ": " + message : ""));
      }
      return parsed;
    } catch (err) {
      if (controller.signal.aborted) throw new Error("Appium " + method + " " + path + " timed out after " + Math.round(timeout / 1000) + "s");
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async function appiumStatus(cfg) {
    try {
      const res = await request("GET", cfg.url, "/status", undefined, 5000);
      return { reachable: true, value: res && res.value ? res.value : res };
    } catch (err) {
      return { reachable: false, error: String((err && err.message) || err) };
    }
  }

  async function validateSession() {
    if (!session || !session.id) return null;
    try {
      await request("GET", session.url, "/session/" + encodeURIComponent(session.id), undefined, 8000);
      return session;
    } catch (_) {
      if (session && session.keepAlive) clearInterval(session.keepAlive);
      session = null;
      return null;
    }
  }

  function sessionInfo() {
    if (!session) return null;
    return { id: session.id, slug: session.slug, createdAt: session.createdAt, capabilities: session.capabilities };
  }

  async function stopSession() {
    if (!session) return { stopped: true };
    try {
      await request("DELETE", session.url, "/session/" + encodeURIComponent(session.id), undefined, 15000);
    } catch (_) {}
    if (session.keepAlive) clearInterval(session.keepAlive);
    session = null;
    return { stopped: true };
  }

  async function startSession(slug) {
    requireSlug(slug);
    const cfg = await loadConfig(slug);
    if (session && session.id && session.slug === slug) {
      if (await validateSession()) return sessionInfo();
      session = null;
    } else if (session && session.slug !== slug) {
      await stopSession();
    }
    const caps = Object.assign({ platformName: "Android" }, cfg.capabilities || {});
    for (const key of Object.keys(caps)) {
      if (caps[key] === "" || caps[key] === null || caps[key] === undefined) delete caps[key];
    }
    let res;
    try {
      res = await request("POST", cfg.url, "/session", {
        capabilities: { alwaysMatch: caps, firstMatch: [{}] },
        desiredCapabilities: caps,
      }, cfg.startTimeoutMs);
    } catch (err) {
      throw new Error("could not start an Appium session: " + String((err && err.message) || err));
    }
    const value = (res && res.value) || {};
    const id = value.sessionId || (res && res.sessionId);
    if (!id) throw new Error("Appium did not return a sessionId");
    session = {
      id: String(id),
      slug,
      url: cfg.url,
      createdAt: new Date().toISOString(),
      capabilities: value.capabilities || caps,
      nodes: [],
      nodesAt: 0,
      sourceXml: "",
      shotW: 0,
      shotH: 0,
      shotAt: 0,
      keepAlive: null,
    };
    // Appium's newCommandTimeout resets on any command. A quiet tab switch must
    // not end the session, so keep it warm from the host.
    const sessionId = session.id;
    session.keepAlive = setInterval(() => {
      if (!session || session.id !== sessionId) return;
      request("GET", session.url, "/session/" + encodeURIComponent(sessionId), undefined, 8000).catch(function () {});
    }, 60000);
    return sessionInfo();
  }

  async function ensureSession(slug) {
    requireSlug(slug);
    if (!session) return await startSession(slug);
    if (session.slug !== slug) return await startSession(slug);
    if (!(await validateSession())) return await startSession(slug);
    return sessionInfo();
  }

  async function fetchSource(slug) {
    await ensureSession(slug);
    const res = await request("GET", session.url, "/session/" + encodeURIComponent(session.id) + "/source", undefined, 30000);
    const xml = String((res && res.value) || "");
    if (!xml.trim()) throw new Error("Appium returned an empty UI hierarchy");
    session.sourceXml = xml;
    session.nodes = parseUiTree(xml);
    session.nodesAt = Date.now();
    return session.nodes;
  }

  function rootBounds() {
    const first = session && session.nodes && session.nodes[0];
    return first && first.bounds ? first.bounds : null;
  }

  function toDevicePoint(x, y) {
    const root = rootBounds();
    if (!root || !session.shotW || !session.shotH || !root.w || !root.h) return { x, y };
    return { x: x * (root.w / session.shotW), y: y * (root.h / session.shotH) };
  }

  function toShotNode(node) {
    const root = rootBounds();
    if (!node || !node.bounds || !root || !session.shotW || !session.shotH || !root.w || !root.h) return node;
    const sx = session.shotW / root.w;
    const sy = session.shotH / root.h;
    return Object.assign({}, node, {
      bounds: {
        x: Math.round(node.bounds.x * sx),
        y: Math.round(node.bounds.y * sy),
        w: Math.round(node.bounds.w * sx),
        h: Math.round(node.bounds.h * sy),
      },
    });
  }

  function pickNode(target) {
    if (!session || !session.nodes.length) throw new Error("no UI tree yet — request the tree first");
    if (target.index !== undefined && target.index !== null) {
      const node = session.nodes[Number(target.index)];
      if (!node) throw new Error("no node at index " + target.index);
      return node;
    }
    const x = Number(target.x);
    const y = Number(target.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error("select needs x/y or index");
    const point = toDevicePoint(x, y);
    const node = nodeAt(session.nodes, point.x, point.y);
    if (!node) throw new Error("no node at (" + x + ", " + y + ")");
    return node;
  }

  async function screenshot(slug) {
    requireSlug(slug);
    await ensureSession(slug);
    const res = await request("GET", session.url, "/session/" + encodeURIComponent(session.id) + "/screenshot", undefined, 30000);
    const b64 = String((res && res.value) || "");
    if (!b64) throw new Error("Appium returned no screenshot");
    const bytes = Buffer.from(b64, "base64");
    const dir = framesPath(slug);
    const target = await fs.resolve(dir + "/live.png", { cwd: await rootPath() });
    const abs = fs.processPath(target);
    await ensureDir(dirname(abs));
    await writeBytes(abs, bytes);
    const size = pngSize(bytes);
    session.shotW = size ? size.width : 0;
    session.shotH = size ? size.height : 0;
    session.shotAt = Date.now();
    return {
      slug,
      file: "live.png",
      path: "/design-studio/__android/frames/" + slug + "/live.png?t=" + session.shotAt,
      w: size ? size.width : null,
      h: size ? size.height : null,
      bytes: bytes.length,
      ts: session.shotAt,
    };
  }

  async function tapAt(slug, x, y) {
    await ensureSession(slug);
    await request("POST", session.url, "/session/" + encodeURIComponent(session.id) + "/actions", {
      actions: [{
        type: "pointer",
        id: "finger",
        parameters: { pointerType: "touch" },
        actions: [
          { type: "pointerMove", duration: 0, x: Math.round(x), y: Math.round(y) },
          { type: "pointerDown", button: 0 },
          { type: "pause", duration: 80 },
          { type: "pointerUp", button: 0 },
        ],
      }],
    }, 30000);
  }

  async function restartApp(slug) {
    requireSlug(slug);
    await ensureSession(slug);
    const cfg = await loadConfig(slug);
    const appId = cfg.capabilities["appium:appPackage"] || cfg.capabilities.appPackage;
    if (!appId) throw new Error("no appPackage configured — set appium:appPackage before restarting the app");
    await request("POST", session.url, "/session/" + encodeURIComponent(session.id) + "/appium/device/terminate_app", { appId, options: {} }, 30000);
    await new Promise((resolve) => setTimeout(resolve, 600));
    await request("POST", session.url, "/session/" + encodeURIComponent(session.id) + "/appium/device/activate_app", { appId, options: {} }, 30000);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    return { restarted: true, appId };
  }

  async function status(slug) {
    requireSlug(slug);
    const cfg = await loadConfig(slug);
    await validateSession();
    const current = session && session.slug === slug ? sessionInfo() : null;
    return {
      slug,
      config: cfg,
      session: current,
      appium: await appiumStatus(cfg),
    };
  }

  async function tree(slug) {
    requireSlug(slug);
    const nodes = await fetchSource(slug);
    return {
      count: nodes.length,
      nodes: nodes.map(toShotNode),
      session: sessionInfo(),
      shot: session.shotW ? { w: session.shotW, h: session.shotH } : null,
      treeHash: treeHash(session.sourceXml),
    };
  }

  async function ensureNodes(slug, maxAgeMs) {
    if (!session || session.slug !== slug) return false;
    if (!session.nodes.length || Date.now() - (session.nodesAt || 0) > maxAgeMs) await fetchSource(slug);
    return true;
  }

  async function hover(slug, target) {
    requireSlug(slug);
    if (!session || session.slug !== slug) return null;
    await ensureNodes(slug, 2000);
    let node = null;
    if (target && target.index !== undefined && target.index !== null) {
      node = session.nodes[Number(target.index)] || null;
    } else {
      const x = Number(target && target.x);
      const y = Number(target && target.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      const point = toDevicePoint(x, y);
      node = nodeAt(session.nodes, point.x, point.y);
    }
    if (!node) return null;
    return { node: toShotNode(node), locator: locatorFor(node) };
  }

  async function select(slug, target) {
    requireSlug(slug);
    await ensureNodes(slug, 600);
    const node = pickNode(target || {});
    return { node: toShotNode(node), locator: locatorFor(node) };
  }

  async function tap(slug, target) {
    requireSlug(slug);
    await ensureNodes(slug, 600);
    const node = pickNode(target || {});
    const b = node.bounds;
    if (!b) throw new Error("selected node has no bounds");
    await tapAt(slug, b.x + b.w / 2, b.y + b.h / 2);
    return { tapped: node.index, at: { x: Math.round(b.x + b.w / 2), y: Math.round(b.y + b.h / 2) } };
  }

  async function history(slug) {
    requireSlug(slug);
    const parsed = await readJson(historyPath(slug));
    return parsed && Array.isArray(parsed.entries) ? parsed.entries : [];
  }

  async function capture(slug) {
    requireSlug(slug);
    const shot = await screenshot(slug);
    const source = await fs.resolve(framesPath(slug) + "/live.png", { cwd: await rootPath() });
    const bytes = await fs.readBytes(source, undefined, 20 * 1024 * 1024);
    const sys = await resolveSystem(slug);
    if (!sys) throw new Error("unknown design system: " + slug);
    const rel = "assets/images/app/app-" + Date.now() + ".png";
    const target = await designFs.resolve(rel, { cwd: fs.processPath(sys) });
    const abs = fs.processPath(target);
    await ensureDir(dirname(abs));
    await writeBytes(abs, Buffer.from(bytes));
    const cfg = await loadConfig(slug);
    const entry = {
      at: new Date().toISOString(),
      designPath: rel,
      shot: shot.path,
      treeHash: session ? treeHash(session.sourceXml) : "",
      appPackage: cfg.capabilities["appium:appPackage"] || cfg.capabilities.appPackage || "",
      width: shot.w,
      height: shot.h,
      bytes: bytes.length,
    };
    const parsed = await readJson(historyPath(slug));
    const entries = parsed && Array.isArray(parsed.entries) ? parsed.entries : [];
    entries.push(entry);
    await writeJson(historyPath(slug), { version: 1, slug, entries: entries.slice(-50) });
    await bumpDesignStamp(slug).catch(function () {});
    let snapshot = null;
    if (typeof captureHistory === "function") {
      snapshot = await captureHistory(slug, "android-capture").catch(function () { return null; });
    }
    const snapshotId = snapshot && snapshot.snapshot ? snapshot.snapshot.id : null;
    return { entry, snapshot: snapshotId, path: "/design-studio/" + slug + "/" + rel };
  }

  async function config(slug) {
    requireSlug(slug);
    return await loadConfig(slug);
  }

  return {
    status,
    config,
    saveConfig,
    connect: async (slug) => ({ session: await startSession(slug) }),
    disconnect: stopSession,
    tree,
    screenshot,
    hover,
    select,
    tap,
    restart: restartApp,
    history,
    capture,
    parseUiTree,
    locatorFor,
  };
}
