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
import { delimiter, extname, dirname, isAbsolute, join } from "node:path";
import { stat } from "node:fs/promises";
import { isSlug } from "./util.js";
import { inspectProject, runtimeAdapter, tagContextFor } from "./app-adapters.js";

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
  buildCommand: [],
  installCommand: [],
  javaHome: "",
  androidHome: "",
  buildTimeoutMs: 600000,
  startTimeoutMs: 60000,
  requestTimeoutMs: 30000,
};

export function routeTagCandidates(route) {
  const raw = String(route || "").trim();
  const normalized = raw
    .replace(/\{[^}]*\}/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const upper = normalized.toUpperCase();
  return [...new Set([upper, "NAV_" + upper, "ROUTE_" + upper, "SCREEN_" + upper, "DESTINATION_" + upper].filter(Boolean))];
}

export function normalizeCommandArgv(value, field) {
  if (!Array.isArray(value) || value.length === 0) return [];
  if (value.length > 32) throw new Error(field + " has too many arguments");
  return value.map((item) => {
    const text = String(item);
    if (!text || text.length > 500 || /[\n\r]/.test(text)) throw new Error("invalid " + field + " argument");
    return text;
  });
}

export function expandCommandArgv(argv, projectRoot, apk) {
  return (argv || []).map((item) => String(item)
    .replace(/\{projectRoot\}/g, projectRoot || "")
    .replace(/\{apk\}/g, apk || ""));
}

export function gradleInvocation(projectRoot, buildTask) {
  const root = String(projectRoot || "").trim();
  if (!root || !isAbsolute(root) || /[\n\r]/.test(root)) throw new Error("projectRoot must be an absolute path");
  const task = String(buildTask || "").trim();
  if (!/^[A-Za-z0-9:_\- ]{1,160}$/.test(task)) throw new Error("invalid Gradle build task");
  const gradlew = join(root, process.platform === "win32" ? "gradlew.bat" : "gradlew");
  return { cwd: root, argv: [gradlew, "--console=plain", task], gradlew, task };
}

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


export function createAppium({ fs, rootPath, readJson, writeJson, designFs, resolveSystem, writeBytes, ensureDir, bumpDesignStamp, captureHistory, attachments, subprocess }) {
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
      if (typeof parsed.javaHome === "string") cfg.javaHome = parsed.javaHome;
      if (typeof parsed.androidHome === "string") cfg.androidHome = parsed.androidHome;
      if (Array.isArray(parsed.buildCommand)) cfg.buildCommand = parsed.buildCommand.filter((item) => typeof item === "string");
      if (Array.isArray(parsed.installCommand)) cfg.installCommand = parsed.installCommand.filter((item) => typeof item === "string");
      cfg.buildTimeoutMs = clampInt(parsed.buildTimeoutMs, 30000, 1800000, cfg.buildTimeoutMs);
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
    if (patch.javaHome !== undefined) {
      const home = String(patch.javaHome || "").trim();
      if (home && (!isAbsolute(home) || /[\n\r]/.test(home))) throw new Error("javaHome must be an absolute path");
      cfg.javaHome = home;
    }
    if (patch.androidHome !== undefined) {
      const home = String(patch.androidHome || "").trim();
      if (home && (!isAbsolute(home) || /[\n\r]/.test(home))) throw new Error("androidHome must be an absolute path");
      cfg.androidHome = home;
    }
    if (patch.buildTimeoutMs !== undefined) cfg.buildTimeoutMs = clampInt(patch.buildTimeoutMs, 30000, 1800000, cfg.buildTimeoutMs);
    if (patch.buildCommand !== undefined) cfg.buildCommand = normalizeCommandArgv(patch.buildCommand, "buildCommand");
    if (patch.installCommand !== undefined) cfg.installCommand = normalizeCommandArgv(patch.installCommand, "installCommand");
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

  async function currentActivity(slug) {
    requireSlug(slug);
    await ensureSession(slug);
    try {
      const res = await request("GET", session.url, "/session/" + encodeURIComponent(session.id) + "/appium/device/current_activity", undefined, 15000);
      return String((res && res.value) || "");
    } catch (_) {
      return "";
    }
  }

  async function context(slug, options) {
    requireSlug(slug);
    const activity = await currentActivity(slug);
    await ensureNodes(slug, 600);
    const nodes = session ? session.nodes : [];
    const screenNode = nodes.find((node) => /^(SCREEN|PAGE|ROUTE|DESTINATION)_/i.test(node.resourceId || ""));
    const seen = new Set();
    const topTags = [];
    for (const node of nodes) {
      if (node.depth > 7 || !node.resourceId || seen.has(node.resourceId)) continue;
      seen.add(node.resourceId);
      topTags.push(node.resourceId);
      if (topTags.length >= 20) break;
    }
    const cfg = await loadConfig(slug);
    const tag = options && options.tag ? String(options.tag) : "";
    let project;
    try {
      const graph = await inspectProject(cfg.projectRoot || "");
      project = {
        adapter: graph.adapter,
        files: graph.files,
        routes: graph.routes,
        components: graph.components,
        tokens: graph.tokens,
        tag: tag ? tagContextFor(graph, tag) : null,
      };
    } catch (err) {
      project = {
        adapter: runtimeAdapter("Source inspection failed: " + String((err && err.message) || err)),
        files: 0,
        routes: [],
        components: [],
        tokens: [],
        tag: null,
        error: String((err && err.message) || err),
      };
    }
    const navTargets = [];
    const seenNav = new Set();
    for (const node of nodes) {
      const resourceId = node.resourceId || "";
      if (!/^(NAV|ROUTE|DESTINATION)_/i.test(resourceId) || seenNav.has(resourceId)) continue;
      seenNav.add(resourceId);
      navTargets.push({
        tag: resourceId,
        route: resourceId.replace(/^(NAV|ROUTE|DESTINATION)_/i, "").toLowerCase(),
        label: node.text || node.contentDesc || node.className || resourceId,
        clickable: node.clickable,
        bounds: node.bounds,
      });
    }
    const configuredPackage = cfg.capabilities["appium:appPackage"] || cfg.capabilities.appPackage || "";
    const actualPackage = nodes.length && nodes[0].package ? nodes[0].package : "";
    return {
      activity,
      package: configuredPackage,
      actualPackage,
      packageMismatch: Boolean(configuredPackage && actualPackage && configuredPackage !== actualPackage),
      navTargets,
      adapter: project.adapter,
      components: project.components || [],
      tokens: project.tokens || [],
      screen: screenNode ? screenNode.resourceId : "",
      screenLabel: screenNode ? screenNode.resourceId.replace(/^(SCREEN|PAGE|ROUTE|DESTINATION)_/i, "") : "",
      topTags,
      routes: project.routes || [],
      tag: project.tag || null,
      files: project.files || 0,
      projectRoot: cfg.projectRoot || "",
      error: project.error || "",
    };
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

  async function navigate(slug, route) {
    requireSlug(slug);
    if (!route || !String(route).trim()) throw new Error("navigate needs a route");
    await ensureSession(slug);
    await ensureNodes(slug, 600);
    const candidates = routeTagCandidates(route);
    const upperCandidates = new Set(candidates.map((value) => value.toUpperCase()));
    const node = session.nodes.find((candidate) => upperCandidates.has(String(candidate.resourceId || "").toUpperCase()));
    if (!node) {
      return {
        ok: false,
        supported: false,
        route: String(route),
        candidates,
        reason: "No routable test tag found. Add a tag such as " + candidates[candidates.length - 1] + " (or NAV_" + String(route).toUpperCase().replace(/[^A-Z0-9]+/g, "_") + ") to the control that opens this destination.",
      };
    }
    const bounds = node.bounds;
    if (!bounds) throw new Error("routable node has no bounds");
    const x = Math.round(bounds.x + bounds.w / 2);
    const y = Math.round(bounds.y + bounds.h / 2);
    await tapAt(slug, x, y);
    return { ok: true, supported: true, route: String(route), candidates, node: toShotNode(node), at: { x, y } };
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


  function tail(text, max) {
    const value = String(text || "");
    const limit = max || 12000;
    return value.length > limit ? value.slice(value.length - limit) : value;
  }

  async function fileStat(target) {
    try { return await stat(target); } catch (_) { return null; }
  }

  async function runProcess(argv, cwd, env, timeoutMs) {
    const controller = new AbortController();
    const timeout = Math.max(1000, Number(timeoutMs) || 600000);
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const handle = subprocess.spawn({
        argv,
        cwd,
        env,
        stdio: {
          stdin: "ignore",
          stdout: { maxBytes: 128 * 1024, spill: { maxBytes: 4 * 1024 * 1024 } },
          stderr: { maxBytes: 128 * 1024, spill: { maxBytes: 4 * 1024 * 1024 } },
        },
        graceMs: 5000,
        signal: controller.signal,
      });
      const outcome = await handle.done;
      const stdout = handle.collected && handle.collected.stdout ? handle.collected.stdout.readFrom(0).text : "";
      const stderr = handle.collected && handle.collected.stderr ? handle.collected.stderr.readFrom(0).text : "";
      return { exitCode: outcome.exitCode, stdout, stderr, timedOut: controller.signal.aborted };
    } finally {
      clearTimeout(timer);
    }
  }

  async function build(slug) {
    requireSlug(slug);
    if (!subprocess || typeof subprocess.spawn !== "function") throw new Error("the harness subprocess seam is unavailable");
    const cfg = await loadConfig(slug);
    const rootInfo = await fileStat(cfg.projectRoot);
    if (!rootInfo || !rootInfo.isDirectory()) throw new Error("projectRoot is not a directory: " + cfg.projectRoot);
    const customBuild = Array.isArray(cfg.buildCommand) && cfg.buildCommand.length > 0;
    const customInstall = Array.isArray(cfg.installCommand) && cfg.installCommand.length > 0;
    const apkAbs = cfg.apkPath ? join(cfg.projectRoot, cfg.apkPath) : "";
    const javaHome = cfg.javaHome || process.env.JAVA_HOME || "";
    const androidHome = cfg.androidHome || process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || "";

    let gradle = null;
    if (!customBuild) {
      gradle = gradleInvocation(cfg.projectRoot, cfg.buildTask);
      const gradlewInfo = await fileStat(gradle.gradlew);
      if (!gradlewInfo || !gradlewInfo.isFile()) throw new Error("Gradle wrapper not found: " + gradle.gradlew);
      if (!javaHome) throw new Error("javaHome is not configured and JAVA_HOME is not set");
      const javaInfo = await fileStat(javaHome);
      if (!javaInfo || !javaInfo.isDirectory()) throw new Error("javaHome is not a directory: " + javaHome);
    }

    let adbPath = "";
    if (!customInstall) {
      if (!androidHome) throw new Error("androidHome is not configured and ANDROID_HOME is not set");
      adbPath = join(androidHome, "platform-tools", process.platform === "win32" ? "adb.exe" : "adb");
      const adbInfo = await fileStat(adbPath);
      if (!adbInfo || !adbInfo.isFile()) throw new Error("adb not found: " + adbPath);
      if (!apkAbs) throw new Error("apkPath is required when no installCommand is configured");
    }

    const env = Object.assign({}, process.env);
    if (javaHome) {
      env.JAVA_HOME = javaHome;
      env.PATH = [join(javaHome, "bin"), env.PATH || ""].join(delimiter);
    }
    if (androidHome) {
      env.ANDROID_HOME = androidHome;
      env.ANDROID_SDK_ROOT = androidHome;
      env.PATH = [join(androidHome, "platform-tools"), env.PATH || ""].join(delimiter);
    }

    const buildArgv = customBuild
      ? expandCommandArgv(cfg.buildCommand, cfg.projectRoot, apkAbs)
      : gradle.argv;
    const buildLabel = customBuild ? "buildCommand" : "Gradle";
    const buildStarted = Date.now();
    let buildResult;
    try {
      buildResult = await runProcess(buildArgv, cfg.projectRoot, env, cfg.buildTimeoutMs);
    } catch (err) {
      throw new Error("could not start " + buildLabel + ": " + String((err && err.message) || err));
    }
    const buildMs = Date.now() - buildStarted;
    if (buildResult.timedOut) throw new Error(buildLabel + " timed out after " + Math.round(cfg.buildTimeoutMs / 1000) + "s\n" + tail(buildResult.stdout + "\n" + buildResult.stderr));
    if (buildResult.exitCode !== 0) throw new Error(buildLabel + " failed (exit " + buildResult.exitCode + ")\n" + tail(buildResult.stdout + "\n" + buildResult.stderr));

    const apkInfo = apkAbs ? await fileStat(apkAbs) : null;
    if (!customInstall && (!apkInfo || !apkInfo.isFile())) throw new Error("APK not found after build: " + apkAbs);

    const installStarted = Date.now();
    let installResult;
    if (customInstall) {
      const installArgv = expandCommandArgv(cfg.installCommand, cfg.projectRoot, apkAbs);
      try {
        installResult = await runProcess(installArgv, cfg.projectRoot, env, 180000);
      } catch (err) {
        throw new Error("could not start installCommand: " + String((err && err.message) || err));
      }
    } else {
      const device = String(cfg.capabilities["appium:deviceName"] || "").trim();
      const installArgs = [];
      if (device && !/^Android$/i.test(device)) installArgs.push("-s", device);
      installArgs.push("install", "-r", apkAbs);
      installResult = await runProcess([adbPath].concat(installArgs), cfg.projectRoot, env, 180000);
    }
    const installMs = Date.now() - installStarted;
    const installLabel = customInstall ? "installCommand" : "adb install";
    if (installResult.timedOut) throw new Error(installLabel + " timed out\n" + tail(installResult.stdout + "\n" + installResult.stderr));
    if (installResult.exitCode !== 0) throw new Error(installLabel + " failed (exit " + installResult.exitCode + ")\n" + tail(installResult.stdout + "\n" + installResult.stderr));

    let restarted = false;
    let restartError = "";
    try {
      const reachable = await appiumStatus(cfg);
      if (reachable.reachable) {
        await ensureSession(slug);
        await restartApp(slug);
        restarted = true;
      } else {
        restartError = reachable.error || "Appium is offline; app installed but not restarted";
      }
    } catch (err) {
      restartError = String((err && err.message) || err);
    }

    return {
      ok: true,
      buildMs,
      installMs,
      apk: apkAbs,
      apkBytes: apkInfo ? apkInfo.size : 0,
      buildMode: customBuild ? "command" : "gradle",
      installMode: customInstall ? "command" : "adb",
      restarted,
      restartError,
      log: tail(buildResult.stdout + "\n" + buildResult.stderr),
    };
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
    context,
    hover,
    select,
    tap,
    navigate,
    restart: restartApp,
    history,
    capture,
    build,
    parseUiTree,
    locatorFor,
  };
}
