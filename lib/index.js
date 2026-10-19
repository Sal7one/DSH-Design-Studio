// @sal7one/dsh-design-studio — persistent Design Studio host for the DSH harness.
//
// What it owns:
//   - the `design_studio` model tool (scaffold/read/write/zip/reveal design systems under
//     temp_design_folder/, identity-preset CRUD + apply, OpenRouter vision review GOOD|POOR)
//   - the /design-studio live-preview HTTP route + same-origin JSON API
//   - a system-prompt section routing operator design briefs into the studio
//
// ZERO RUNTIME DEPENDENCIES on purpose: the tool definition below is a plain
// JSON Schema (the same wire-level shape `dsh-tools` accepts), so this bundle
// imports nothing beyond Node builtins and resolves the same way from npm, a
// git checkout, or a local `link:` install.
//
// Cross-platform note: nothing here shells out. Binary writes and archive
// creation use Node's own `fs`/`zlib` through the subprocess seam, so the
// plugin works on Windows, macOS and Linux without `sh`, `curl`, `zip`,
// `base64` or `screencapture`.

import { randomUUID } from "node:crypto";
import { STUDIO_DIR, KEY_REF, READ_CAP, IMAGE_CAP } from "./host/constants.js";
import { toPosix, isSlug, cleanRel, dataUrlToBytes, makeZip, classifyFile } from "./host/util.js";
import { createNodeIo } from "./host/node-io.js";
import { createConfig } from "./host/config.js";
import { createVision } from "./host/vision.js";
import { createPreview } from "./host/preview.js";
import { createPresets } from "./host/presets.js";
import { createAssets } from "./host/assets.js";
import { createHistory } from "./host/history.js";
import { createStyles } from "./host/styles.js";

const name = "dsh-design-studio";
// Hard injects make apply() wait until every integration point exists.
// `agents` and `subagents` stay optional reads (ctx.get) because a headless
// composition may not mount delegation; the design-agent chat reports that
// honestly instead of blocking the whole host half.
const inject = ["fs", "subprocess", "webServer", "systemPrompt", "llm", "credentials", "attachments", "tools"];

function apply(ctx) {
  const fs = ctx.fs;
  const subprocess = ctx.subprocess;
  const tools = ctx.get("tools");
  const webServer = ctx.get("webServer");
  const credentials = ctx.get("credentials");
  const llm = ctx.get("llm");
  const attachments = ctx.get("attachments");
  const systemPrompt = ctx.get("systemPrompt");

  const nodeIo = createNodeIo({ subprocess });
  const ensureDir = nodeIo.ensureDir;
  const writeBytes = nodeIo.writeBytes;
  const removePaths = nodeIo.removePaths;
  const revealInFileManager = nodeIo.revealInFileManager;

  let rootTarget = null;
  let rootReady = null;
  let designRootAbs = null;
  let designRootPosix = null;
  const root = async () => {
    if (rootTarget === null) {
      rootTarget = await fs.resolve(STUDIO_DIR);
      designRootAbs = fs.processPath(rootTarget);
      designRootPosix = toPosix(designRootAbs);
    }
    if (rootReady === null) rootReady = ensureDir(designRootAbs);
    await rootReady;
    return rootTarget;
  };
  const rootPath = async () => fs.processPath(await root());


  async function resolveSystem(slug) {
    if (!isSlug(slug)) throw new Error("invalid slug: " + String(slug));
    return await fs.resolve(slug, { cwd: await rootPath() });
  }

  async function resolveInSystem(slug, rel) {
    const r = cleanRel(rel);
    if (r === null) throw new Error("invalid path: " + String(rel));
    const sys = await resolveSystem(slug);
    const target = await fs.resolve(r, { cwd: fs.processPath(sys) });
    if (!fs.contains(sys, target)) throw new Error("path escapes the design system");
    return target;
  }

  // The harness `fs` service has no binary-write or mkdir operation, and no
  // POSIX shell can be assumed (Windows has neither `sh` nor `base64`).
  // These helpers run a tiny script with the harness's own Node executable:
  // one stable seam for mkdir, binary writes and recursive delete.

  let nodeExec = null;




  async function writeJson(rel, value) {
    // fs.writeText creates parent directories itself (writeFileAtomic mkdir -p),
    // so config/history writes never need a shell.
    const t = await fs.resolve(rel, { cwd: await rootPath() });
    await fs.writeText(t, JSON.stringify(value, null, 2));
  }

  async function readJson(rel) {
    const t = await fs.resolve(rel, { cwd: await rootPath() });
    const info = await fs.stat(t);
    if (!info) return null;
    try {
      return JSON.parse(await fs.readText(t));
    } catch (_) {
      return null;
    }
  }


  // ---------- domain modules ----------
  const config = createConfig({ ctx, credentials, llm, readJson, writeJson });
  const { loadConfig, saveConfig, keyInfo, resolveKey, harnessRouteAvailable, harnessVisionInfo, invalidateVisionCache } = config;

  const vision = createVision({ fs, llm, attachments, resolveInSystem, writeJson, loadConfig, resolveKey, harnessVisionInfo });
  const { visionReview, describeAttachedImages, loadMentionedImages } = vision;

  const preview = createPreview({
    fs,
    webServer,
    resolveSystem,
    rootPath,
    ensureDir,
    removePaths,
    findBrowser: nodeIo.findBrowser,
    runBrowserScreenshot: nodeIo.runBrowserScreenshot,
    loadConfig,
  });
  const { capturePreviewToSystem } = preview;

  const presets = createPresets({ fs, resolveSystem, rootPath, readJson, writeJson, writeBytes, removePaths, bumpDesignStamp });
  const { listPresets, savePreset, deletePreset, applyPreset } = presets;

  const assets = createAssets({ fs, rootPath, resolveSystem, readJson, writeJson, writeBytes, removePaths, bumpDesignStamp });
  const { list: listAssets, upload: uploadAsset, uploadFromPath: uploadAssetFromPath, remove: deleteAsset } = assets;

  const history = createHistory({ fs, rootPath, resolveSystem, readJson, writeJson, writeBytes, removePaths, bumpDesignStamp });
  const { list: listHistory, capture: captureHistory, restore: restoreHistory, undo: undoHistory } = history;

  const styles = createStyles({ fs, rootPath, resolveSystem, readJson, writeJson, removePaths, bumpDesignStamp });
  const { list: listStyles, apply: applyStyle, save: saveStyle, remove: deleteStyle, styleVars } = styles;

  // ---------- per-system metadata: which conversation owns each design system ----------
  async function systemsMeta() {
    const parsed = await readJson("_studio/systems.json");
    return parsed && typeof parsed.systems === "object" ? parsed.systems : {};
  }

  async function systemsMetaSave(meta) {
    await writeJson("_studio/systems.json", { systems: meta });
  }

  // ---------- design freeze (explicit design → implementation handoff) ----------
  // A frozen design is a read-only handoff point. The freeze record lives outside
  // the design files so zip/snapshot/history stay clean; list/all expose it so
  // every agent can see that the mockup is no longer the edit target.
  const FREEZE_DIR = "_studio/freeze";

  async function freezePath(slug) {
    return await fs.resolve(FREEZE_DIR + "/" + slug + ".json", { cwd: await rootPath() });
  }

  async function readFreeze(slug) {
    if (!isSlug(slug)) return null;
    const raw = await readJson(FREEZE_DIR + "/" + slug + ".json");
    return raw && raw.frozen === true ? raw : null;
  }

  function freezeMessage(slug, action, freeze) {
    const target = freeze && freeze.implementation
      ? " Implementation target: " + freeze.implementation + "."
      : " No implementation target was recorded.";
    return "DESIGN FROZEN: " + slug + " is a read-only handoff; " + action +
      " is blocked. Do not edit the mockup. Work in the implementation target instead." +
      target + " If the design itself must change, the operator must thaw it explicitly.";
  }

  async function assertWritable(slug, action) {
    const freeze = await readFreeze(slug);
    if (freeze) throw new Error(freezeMessage(slug, action || "this write", freeze));
  }

  async function freezeSystem(slug, implementation, note) {
    if (!isSlug(slug)) throw new Error("invalid slug: " + String(slug));
    const sys = await resolveSystem(slug);
    if (!(await fs.stat(sys))) throw new Error("unknown design system: " + slug);
    const existing = await readFreeze(slug);
    if (existing) return Object.assign({}, existing, { alreadyFrozen: true });
    const at = new Date().toISOString();
    const final = await captureHistory(slug, "freeze").catch(function () { return null; });
    let zip = null;
    try { zip = await zipSystem(slug); } catch (_) {}
    const meta = await systemsMeta();
    const stamp = meta[slug] && meta[slug].stamp ? meta[slug].stamp : null;
    const record = {
      schema: 1,
      slug,
      frozen: true,
      at,
      stamp: stamp ? { hash: String(stamp.hash || ""), at: String(stamp.at || "") } : null,
      finalSnapshot: final && final.snapshot ? final.snapshot.id : null,
      implementation: String(implementation || "").trim().slice(0, 1000),
      note: String(note || "").trim().slice(0, 2000),
    };
    await writeJson(FREEZE_DIR + "/" + slug + ".json", record);
    return Object.assign({}, record, { zip: zip ? zip.zip : null });
  }

  async function unfreezeSystem(slug, confirmation) {
    if (!isSlug(slug)) throw new Error("invalid slug: " + String(slug));
    if (confirmation !== true) throw new Error("unfreeze requires confirm:true");
    const sys = await resolveSystem(slug);
    if (!(await fs.stat(sys))) throw new Error("unknown design system: " + slug);
    const freeze = await readFreeze(slug);
    if (!freeze) return { slug, frozen: false, alreadyThawed: true };
    const thawedAt = new Date().toISOString();
    await writeJson(FREEZE_DIR + "/" + slug + ".json", Object.assign({}, freeze, {
      frozen: false,
      thawedAt,
    }));
    return { slug, frozen: false, thawedAt, implementation: freeze.implementation || "" };
  }

  // ---------- design stamp (freshness for the coding agent) ----------
  // Every write inside a design system bumps a random hash + ISO modified
  // date stored in the system meta (no history — latest status only). Both
  // agents see it through design_studio list/agent contexts, so the coding
  // agent can compare its remembered hash with the latest one.
  const stampLocks = new Map();

  function designSlugFor(absPath) {
    if (designRootPosix === null || typeof absPath !== "string") return null;
    const p = toPosix(absPath);
    const prefix = designRootPosix + "/";
    if (!p.startsWith(prefix)) return null;
    const seg = p.slice(prefix.length).split("/")[0];
    if (!seg || seg.startsWith("_") || !isSlug(seg)) return null;
    return seg;
  }

  async function bumpDesignStamp(slug) {
    const prev = stampLocks.get(slug) || Promise.resolve();
    const next = prev.then(async () => {
      const meta = await systemsMeta();
      const m = meta[slug] || {};
      m.stamp = { hash: randomUUID(), at: new Date().toISOString() };
      meta[slug] = m;
      await systemsMetaSave(meta);
      scheduleHistoryCapture(slug);
    });
    stampLocks.set(slug, next.catch(function () {}));
    return next;
  }

  // Write intent waterfalls fire before every fs.writeText/editText from ANY
  // editor (coding-agent tools, the design agent, the operator) — the
  // bulletproof change detector. We only bump; we never block the write.
  // Freshness detector: the harness read/write/edit tools emit 'fs/observed'
  // with the file's version after every access. A version that differs from
  // the last one we saw for that path means the file changed — no matter who
  // edited it (coding-agent tools, the design agent, any session) — so we
  // bump the design stamp. Baselines are seeded from directory-listing
  // versions in listSystems, so first reads never false-bump.
  const seenVersions = new Map(); // absolute path -> version token | "absent"
  const historyTimers = new Map();

  function scheduleHistoryCapture(slug) {
    const prev = historyTimers.get(slug);
    if (prev) clearTimeout(prev);
    historyTimers.set(slug, setTimeout(() => {
      historyTimers.delete(slug);
      captureHistory(slug, "auto").catch(function () {});
    }, 2200));
  }

  // ---------- post-edit auto-verification (guaranteed design-agent pass) ----------
  // The "Ask DeepSeek" flow arms this marker. The first REAL design change
  // made by the coding agent (detected above) starts a quiet-period debounce;
  // when the agent's edits settle, the design agent is spawned AUTOMATICALLY
  // as the verifier — no reliance on the coding agent choosing to call it.
  const VERIFY_DEBOUNCE_MS = 4000;
  const VERIFY_MAX_ARM_MS = 15 * 60 * 1000;
  const pendingVerify = new Map(); // slug -> { request, sessionId, timer, maxTimer, settled }

  function armPostEditVerify(slug, request, sessionId) {
    const prev = pendingVerify.get(slug);
    if (prev) {
      if (prev.timer) clearTimeout(prev.timer);
      if (prev.maxTimer) clearTimeout(prev.maxTimer);
    }
    const pend = {
      request: String(request || "").slice(0, 1000),
      sessionId: typeof sessionId === "string" && sessionId ? sessionId : null,
      armedAt: Date.now(),
      settled: false,
      timer: null,
      maxTimer: null,
    };
    pend.maxTimer = setTimeout(() => {
      pendingVerify.delete(slug); // the coding agent never edited — disarm
    }, VERIFY_MAX_ARM_MS);
    pendingVerify.set(slug, pend);
  }

  async function runPostEditVerify(slug) {
    const pend = pendingVerify.get(slug);
    if (!pend || pend.settled) return;
    pendingVerify.delete(slug); // no re-entry: the verifier's own edits must not re-arm
    if (pend.maxTimer) clearTimeout(pend.maxTimer);
    try {
      const verifyMsg =
        "AUTO-VERIFY (studio-triggered after the main coding agent edited this design): the coding agent (DeepSeek) was asked to apply this change: " +
        JSON.stringify(pend.request) +
        ". Verify it: read the current design files, check the edit actually matches the request, run a vision review if an image is involved (design_studio review), and fix only clear deviations yourself. Then reply under 250 words: what you verified and any fix you made (or 'verified OK — no fixes').";
      await designAgentChat({ slug, message: verifyMsg, sessionId: pend.sessionId || null });
    } catch (_) {}
  }

  ctx.effect(() => ctx.on("fs/observed", (target, observation, actor) => {
    if (actor === undefined) return; // actor-less observations record nothing useful
    try {
      const p = fs.processPath(target);
      const slug = designSlugFor(p);
      if (slug === null) return;
      const v = observation && observation.kind === "present" ? observation.version : "absent";
      const last = seenVersions.get(p);
      if (last !== undefined && last !== v) {
        bumpDesignStamp(slug).catch(function () {});
        scheduleHistoryCapture(slug);
        // Armed post-edit verification: a real change just landed. (Re)start
        // the quiet-period debounce so the verifier runs once the editor
        // settles — guaranteed design-agent involvement on the Ask-DeepSeek flow.
        const pend = pendingVerify.get(slug);
        if (pend && !pend.settled) {
          if (pend.timer) clearTimeout(pend.timer);
          pend.timer = setTimeout(() => {
            runPostEditVerify(slug).catch(function () {});
          }, VERIFY_DEBOUNCE_MS);
        }
      }
      seenVersions.set(p, v);
    } catch (_) {}
  }));

  function liveSessionIds() {
    // In the current host, a live session *is* a live Agent. The old host
    // `sessions` service no longer exists, so using it silently disabled
    // orphan detection and auto-sweep.
    const agents = ctx.get("agents");
    try {
      if (agents === undefined || typeof agents.list !== "function") return null;
      const set = new Set();
      for (const a of agents.list()) {
        if (a && a.id) set.add(String(a.id));
      }
      return set;
    } catch (_) {
      return null;
    }
  }

  // Cross-platform recursive delete through the same Node helper seam.

  async function deleteSystem(slug) {
    if (!isSlug(slug)) throw new Error("invalid slug");
    const sys = await resolveSystem(slug);
    if (!(await fs.stat(sys))) throw new Error("unknown design system: " + slug);
    await assertWritable(slug, "delete design system");
    const root = await rootPath();
    const zipT = await fs.resolve("_zips/" + slug + ".zip", { cwd: root });
    const reviewT = await fs.resolve("_studio/reviews/" + slug + ".json", { cwd: root });
    const agentT = await fs.resolve("_studio/agents/" + slug + ".json", { cwd: root });
    const requestT = await fs.resolve("_studio/requests/" + slug + ".json", { cwd: root });
    const freezeT = await freezePath(slug);
    await removePaths([fs.processPath(sys), fs.processPath(zipT), fs.processPath(reviewT), fs.processPath(agentT), fs.processPath(requestT), fs.processPath(freezeT)], root);
    const meta = await systemsMeta();
    delete meta[slug];
    await systemsMetaSave(meta);
    return { slug, removed: true };
  }

  async function sweepOrphans() {
    const cfg = await loadConfig();
    if (!cfg.autoDeleteWithSession) return { swept: [], note: "auto-delete is OFF (default) — designs are kept even when their chat is deleted" };
    const liveIds = liveSessionIds();
    if (liveIds === null) return { swept: [], note: "session store unavailable — sweep skipped (nothing deleted)" };
    const meta = await systemsMeta();
    const swept = [];
    for (const slug of Object.keys(meta)) {
      const m = meta[slug] || {};
      if (typeof m.sessionId !== "string" || !m.sessionId) continue;
      if (liveIds.has(m.sessionId)) continue;
      await deleteSystem(slug);
      swept.push(slug);
    }
    return { swept, note: swept.length ? "deleted designs whose chat no longer exists" : "no orphaned designs" };
  }

  // ---------- design systems ----------
  async function listSystems(filterSessionId) {
    await sweepOrphans().catch(function () {});
    const meta = await systemsMeta();
    const liveIds = liveSessionIds();
    const entries = await fs.listDir(await root());
    const out = [];
    for (const e of entries) {
      if (e.type !== "directory" || e.name === "_zips" || e.name === "_presets" || e.name === "_studio" || e.name.startsWith(".")) continue;
      const sysMeta = meta[e.name] || {};
      let sysSessionId = typeof sysMeta.sessionId === "string" && sysMeta.sessionId ? sysMeta.sessionId : null;
      // One-time adoption: an unbound (legacy) design system joins the
      // conversation that first lists it with a session filter, so every
      // design system has exactly one owning chat and per-chat filtering is
      // strict (an unbound system would otherwise show up in every tab).
      if (sysSessionId === null && filterSessionId !== undefined && filterSessionId !== null) {
        sysSessionId = String(filterSessionId);
        meta[e.name] = { sessionId: sysSessionId, createdAt: sysMeta.createdAt || new Date().toISOString() };
        await systemsMetaSave(meta);
      }
      if (filterSessionId !== undefined && filterSessionId !== null && sysSessionId !== String(filterSessionId)) continue;
      const orphan = sysSessionId !== null && liveIds !== null && !liveIds.has(sysSessionId);
      const sys = await resolveSystem(e.name);
      const files = [];
      let hasPrompts = false, hasPreview = false, hasTokenCss = false;
      async function walk(dirRel, target) {
        for (const k of await fs.listDir(target)) {
          const rel = dirRel ? dirRel + "/" + k.name : k.name;
          if (k.type === "directory") await walk(rel, k.target);
          else {
            files.push({ path: rel, size: k.size ?? null });
            // Seed the freshness baseline so first reads never false-bump.
            try {
              const p = fs.processPath(k.target);
              if (seenVersions.get(p) === undefined) {
                const v = k.version !== undefined ? k.version : (await fs.stat(k.target))?.version;
                seenVersions.set(p, v !== undefined ? v : "absent");
              }
            } catch (_) {}
            if (rel === "design_prompts_forcoders.md") hasPrompts = true;
            if (rel === "html/index.html") hasPreview = true;
            if (rel === "css/token.css") hasTokenCss = true;
          }
        }
      }
      await walk("", sys);
      files.sort((a, b) => (a.path < b.path ? -1 : 1));
      const freeze = await readFreeze(e.name);
      out.push({ slug: e.name, sessionId: sysSessionId, orphan, createdAt: sysMeta.createdAt || null, stamp: sysMeta.stamp && typeof sysMeta.stamp === "object" ? { hash: String(sysMeta.stamp.hash || ""), at: String(sysMeta.stamp.at || "") } : null, frozen: Boolean(freeze), freeze: freeze ? { at: String(freeze.at || ""), implementation: String(freeze.implementation || ""), note: String(freeze.note || ""), finalSnapshot: freeze.finalSnapshot || null } : null, count: files.length, hasPrompts, hasPreview, hasTokenCss, files });
    }
    out.sort((a, b) => (a.slug < b.slug ? -1 : 1));
    return out;
  }

  const CSS_TEMPLATE = [
    ":root { color-scheme: dark; }",
    "* { box-sizing: border-box; }",
    "html, body { margin: 0; padding: 0; }",
    "body { background: var(--bg, #0b0e14); color: var(--text, #e6ebf5);",
    "  font-family: var(--font-body, system-ui, sans-serif); font-size: 16px; min-height: 100vh; }",
    ".topbar { display: flex; align-items: center; gap: 1rem; padding: 0.9rem 1.5rem;",
    "  border-bottom: 1px solid var(--border, #24304a); background: var(--panel, #141a26); }",
    ".title { font-size: 1.2rem; font-weight: 700; }",
    ".subtitle { font-size: 0.72rem; color: var(--muted, #8894ab); text-transform: uppercase; letter-spacing: 0.5px; }",
    "main { padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1rem; }",
    ".panel { background: var(--panel, #141a26); border: 1px solid var(--border, #24304a);",
    "  border-radius: var(--radius, 12px); padding: 1rem; }",
    "",
  ].join("\n");

  const JS_TEMPLATE = [
    "// ===== MOCK DATA — wire to real endpoints (see design_prompts_forcoders.md) =====",
    "(function () {",
    "  var main = document.getElementById('main');",
    "  main.innerHTML = '<div class=\"panel\">Nothing needs you. (Honest empty state — replace with the real screen per design_prompts_forcoders.md)</div>';",
    "})();",
    "",
  ].join("\n");

  // Starter palette + typography. Every design system owns its tokens; the
  // coding agent refines these per design_prompts_forcoders.md (Color palette / Typography).
  const DEFAULT_TOKEN_CSS = [
    "/* Generated scaffold — refine per design_prompts_forcoders.md (Color palette / Typography) */",
    ":root {",
    "  color-scheme: dark;",
    "  /* palette */",
    "  --bg: #0b0e14;",
    "  --panel: #141a26;",
    "  --panel2: #1c2434;",
    "  --border: #24304a;",
    "  --text: #e6ebf5;",
    "  --muted: #8894ab;",
    "  --accent: #4d8eff;",
    "  --ok: #34c77b;",
    "  --warn: #f2b64d;",
    "  --err: #ef5a6d;",
    "  --info: #5ab3f0;",
    "  /* typography */",
    "  --font-body: system-ui, -apple-system, sans-serif;",
    "  --font-display: system-ui, -apple-system, sans-serif;",
    '  --font-mono: ui-monospace, "SF Mono", Menlo, monospace;',
    "  --radius: 12px;",
    "  --space: 16px;",
    "}",
    "",
  ].join("\n");

  function indexTemplate(slug) {
    return [
      "<!doctype html>", '<html lang="en">', "<head>", '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      "<title>" + slug + "</title>",
      '<link rel="stylesheet" href="../css/style.css">',
      '<link rel="stylesheet" href="../css/token.css">',
      "</head>", "<body>",
      '<header class="topbar"><div class="title">' + slug + '</div><div class="subtitle">design mockup · read-only</div></header>',
      '<main id="main"></main>',
      '<script src="../js/app.js"></script>',
      "</body>", "</html>", "",
    ].join("\n");
  }

  function promptsTemplate(slug) {
    return [
      "# design_prompts_forcoders — " + slug, "",
      "Source of truth for this design: /user_need.md (the homelab custom dashboard spec).",
      "Data source for the service grid: /ops/service-index.json (generated by /scripts/gen-service-index.py).",
      "Identity preset applied: (none yet — apply one from Settings → Design Studio, which writes css/token.css).",
      "", "## Scope (NON-NEGOTIABLE)", "",
      "This is a UI MOCKUP, not an application. Build ONLY:",
      "- html/index.html — semantic structure of the screen (no inline logic)",
      "- css/style.css + css/token.css — visual design (palette, typography, layout)",
      "- js/app.js — MINIMAL presentation js only (render mock data, toggle tabs/states, show/hide)",
      "",
      "NEVER write app logic: no game engines or win/turn logic (e.g. a tic-tac-toe design shows",
      "the board LOOK, not playable rules), no state machines, no persistence, no business rules,",
      "no fetch calls. Interactive states are mocked visually or with trivial DOM toggling.",
      "", "## What this screen is", "", "<TBD — one sentence.>", "", "## Layout (top to bottom)", "", "<TBD>",
      "", "## Color palette (css/token.css)", "",
      "Define the palette here as --bg / --panel / --panel2 / --border / --text / --muted /",
      "--accent / --ok / --warn / --err / --info. Every component reads these tokens; never",
      "hardcode colors in style.css.", "", "<TBD — list the palette and where each color is used>",
      "", "## Typography (css/token.css)", "",
      "Define --font-body / --font-display / --font-mono plus a small type scale (sizes, weights).",
      "Describe where each style is used.", "", "<TBD>",
      "", "## Outline (structure of this design system)", "",
      "- html/index.html: <list the main sections/elements>",
      "- css/style.css: <list the component sections>",
      "- css/token.css: palette + typography tokens",
      "- js/app.js: <list the minimal presentation functions>",
      "", "## Data this screen needs (wire these; the mockup uses mock data in js/app.js)", "", "<TBD>",
      "", "## Non-negotiables (from user_need.md section 3)", "",
      "- Read-only projection; no client-side authority.",
      "- Honest empty states; never a fabricated number.",
      "- Never render secret VALUES (env var names only).",
      "- Consolidate, don’t add a 7th surface.",
      "- Respect hardware constraints (M2 Pro / 16 GB, one phone, Mac sleeps, no LAN wildcard DNS).",
      "", "## Design language", "", "<TBD>", "",
    ].join("\n");
  }

  async function createSystem(slug, sessionId) {
    if (!isSlug(slug)) throw new Error("slug must match [a-z0-9][a-z0-9-]* (lowercase letters, digits, dashes)");
    const sys = await resolveSystem(slug);
    if (await fs.stat(sys)) throw new Error("design system already exists: " + slug);
    // Parent directories are created by fs.writeText itself, so scaffolding
    // needs no shell (empty asset/video/reference folders appear on demand).
    const rp = fs.processPath(sys);
    await fs.writeText(await fs.resolve("html/index.html", { cwd: rp }), indexTemplate(slug));
    await fs.writeText(await fs.resolve("css/style.css", { cwd: rp }), CSS_TEMPLATE);
    await fs.writeText(await fs.resolve("css/token.css", { cwd: rp }), DEFAULT_TOKEN_CSS);
    await fs.writeText(await fs.resolve("js/app.js", { cwd: rp }), JS_TEMPLATE);
    await fs.writeText(await fs.resolve("design_prompts_forcoders.md", { cwd: rp }), promptsTemplate(slug));
    const meta = await systemsMeta();
    const bound = typeof sessionId === "string" && sessionId ? sessionId : null;
    meta[slug] = { sessionId: bound, createdAt: new Date().toISOString(), stamp: { hash: randomUUID(), at: new Date().toISOString() } };
    await systemsMetaSave(meta);
    await captureHistory(slug, "initial").catch(function () {});
    return { slug, created: true, sessionId: bound };
  }

  async function applyStyleWithSnapshot(slug, styleId, fontMode) {
    await assertWritable(slug, "style apply");
    const before = await captureHistory(slug, "before-style").catch(function () { return null; });
    const result = await applyStyle(slug, styleId, { fontMode });
    return Object.assign({}, result, {
      beforeSnapshot: before && before.snapshot ? before.snapshot.id : null,
    });
  }

  async function createFromStyle(styleId, slug, sessionId, fontMode) {    const style = await styles.get(styleId);
    let target = typeof slug === "string" ? slug.trim() : "";
    if (!target) {
      const base = String(styleId).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "style";
      for (let i = 0; i < 20; i++) {
        const candidate = base + "-" + String(Math.floor(Math.random() * 9000) + 1000);
        const sys = await resolveSystem(candidate);
        if (!(await fs.stat(sys))) {
          target = candidate;
          break;
        }
      }
      if (!target) throw new Error("could not allocate a free slug for this style");
    }
    if (!isSlug(target)) throw new Error("slug must match [a-z0-9][a-z0-9-]*");
    await createSystem(target, sessionId);
    await applyStyle(target, styleId, { fontMode: fontMode || "auto" });
    return { slug: target, styleId, name: style.name };
  }

  async function readSystemFile(slug, path) {
    const t = await resolveInSystem(slug, path);
    const info = await fs.stat(t);
    if (!info) throw new Error("not found: " + path);
    if (info.type !== "file") throw new Error("not a file: " + path);
    const text = await fs.readText(t);
    if (text.length > READ_CAP) throw new Error("file too large to show (" + text.length + " bytes)");
    return { path, content: text, bytes: text.length };
  }

  async function writeSystemFile(slug, path, content) {
    if (typeof content !== "string") throw new Error("content must be a string");
    await assertWritable(slug, "write");
    const r = cleanRel(path);
    if (r === null) throw new Error("invalid path: " + String(path));
    const sys = await resolveSystem(slug);
    const t = await fs.resolve(r, { cwd: fs.processPath(sys) });
    if (!fs.contains(sys, t)) throw new Error("path escapes the design system");
    // Parent directories are created by fs.writeText itself.
    const outcome = await fs.writeText(t, content);
    if (outcome && outcome.version !== undefined) {
      try {
        seenVersions.set(fs.processPath(t), outcome.version);
      } catch (_) {}
    }
    // Await the bump (not fire-and-forget) so a list/read in the very next
    // tool call already sees the fresh stamp — no stamp race after writes.
    await bumpDesignStamp(slug).catch(function () {});
    return { path: r, bytes: content.length };
  }

  // ---------- zip (store-only, no external `zip` binary) ----------
  // A design system is a few small text files plus images, so a stored
  // (uncompressed) archive is both valid and inexpensive. This keeps zip
  // export working on Windows, where `find`/`zip` are not available.




  async function zipSystem(slug) {
    const sys = await resolveSystem(slug);
    if (!(await fs.stat(sys))) throw new Error("unknown design system: " + slug);
    const entries = [];
    let total = 0;
    async function walk(dirRel, target) {
      for (const k of await fs.listDir(target)) {
        const rel = dirRel ? dirRel + "/" + k.name : k.name;
        if (k.type === "directory") {
          await walk(rel, k.target);
        } else if (k.type === "file" && k.name !== ".DS_Store") {
          const bytes = await fs.readBytes(k.target, undefined, 32 * 1024 * 1024);
          total += bytes.length;
          if (total > 200 * 1024 * 1024) throw new Error("design system is too large to zip (>200MB)");
          entries.push({ name: slug + "/" + rel, bytes });
        }
      }
    }
    await walk("", sys);
    entries.sort((a, b) => (a.name < b.name ? -1 : 1));
    const zipRel = "_zips/" + slug + ".zip";
    const out = await fs.resolve(zipRel, { cwd: await rootPath() });
    const archive = makeZip(entries);
    await writeBytes(fs.processPath(out), archive);
    return { zip: STUDIO_DIR + "/" + zipRel, slug, files: entries.length, bytes: archive.length };
  }



  async function revealZip(slug) {
    const zipRel = "_zips/" + slug + ".zip";
    const t = await fs.resolve(zipRel, { cwd: await rootPath() });
    if (!(await fs.stat(t))) throw new Error("no zip yet for " + slug + " — zip the design system first");
    await revealInFileManager(fs.processPath(t), await rootPath());
    return { revealed: zipRel };
  }

  // Explicit OS-browser launch, bypassing the DSH in-app browser entirely.
  async function openPreviewInSystem(slug) {
    if (!isSlug(slug)) throw new Error("invalid slug");
    const sys = await resolveSystem(slug);
    if (!(await fs.stat(sys))) throw new Error("unknown design system: " + slug);
    if (webServer === undefined || typeof webServer.getOrigin !== "function") {
      throw new Error("web server unavailable — cannot resolve the preview URL");
    }
    const url = webServer.getOrigin() + "/design-studio/" + encodeURIComponent(slug) + "/html/index.html?open=" + Date.now();
    await nodeIo.openExternal(url);
    return { url };
  }


  // Edge/Chrome/Chromium are resolved from their usual install locations. This
  // is optional: the rest of the studio works without a browser.






  // ---------- presets ----------







  // ---------- design agent chat (operator <-> design agent, persisted per system) ----------
  async function agentHistoryLoad(slug) {
    if (!isSlug(slug)) return [];
    const parsed = await readJson("_studio/agents/" + slug + ".json");
    return parsed && Array.isArray(parsed.entries) ? parsed.entries : [];
  }

  // Per-slug tail promise: concurrent appends (live activity lines racing the
  // final reply) can never clobber each other — history writes are serialized.
  const historyLocks = new Map();

  async function agentHistoryAppend(slug, role, text) {
    if (!isSlug(slug)) throw new Error("invalid slug: " + String(slug));
    const prev = historyLocks.get(slug) || Promise.resolve();
    const next = prev.then(async () => {
      const history = await agentHistoryLoad(slug);
      history.push({ role, text: String(text).slice(0, 4000), at: new Date().toISOString() });
      const capped = history.slice(-50);
      await writeJson("_studio/agents/" + slug + ".json", { slug, entries: capped });
      return capped;
    });
    historyLocks.set(slug, next.catch(function () {}));
    return next;
  }

  async function promptsBrief(slug) {
    try {
      const t = await resolveInSystem(slug, "design_prompts_forcoders.md");
      return String(await fs.readText(t)).slice(0, 2000);
    } catch (_) {
      return slug;
    }
  }

  async function readFileTextCapped(slug, path, cap) {
    try {
      const t = await resolveInSystem(slug, path);
      const info = await fs.stat(t);
      if (!info || info.type !== "file") return "";
      return String(await fs.readText(t)).slice(0, cap);
    } catch (_) {
      return "";
    }
  }

  // The design agent is a REAL harness subagent: it runs on the harness agent
  // engine (default model route, deployment coding tools + design_studio), so
  // it can list/read/edit the design files and take MULTIPLE tool calls per
  // operator message. No custom model client, no harness-in-harness.
  function findParentAgent(ownerSessionId) {
    const agentsSvc = ctx.get("agents");
    if (agentsSvc === undefined) return null;
    try {
      const init = typeof agentsSvc.currentInitiator === "function" ? agentsSvc.currentInitiator() : undefined;
      if (init && init.id) return init;
    } catch (_) {}
    if (ownerSessionId) {
      // Direct live lookup by id (works even when several conversations are
      // open in this process); the HTTP API has no initiator boundary, so the
      // UI passes its own conversation's sessionId explicitly.
      try {
        const direct = typeof agentsSvc.get === "function" ? agentsSvc.get(ownerSessionId) : undefined;
        if (direct && direct.id) return direct;
      } catch (_) {}
    }
    let list = [];
    try {
      list = typeof agentsSvc.list === "function" ? agentsSvc.list() : [];
    } catch (_) {}
    if (ownerSessionId) {
      const match = list.find((a) => a && a.id && String(a.id) === String(ownerSessionId));
      if (match) return match;
    }
    if (list.length === 1) return list[0];
    let roots = [];
    try {
      roots = typeof agentsSvc.roots === "function" ? agentsSvc.roots() : [];
    } catch (_) {}
    if (roots.length === 1) return roots[0];
    return null;
  }

  function pickSubagentProvider(subagentsSvc) {
    let names = [];
    try {
      names = typeof subagentsSvc.list === "function" ? subagentsSvc.list() : [];
    } catch (_) {}
    if (names.includes("spawn")) return "spawn";
    if (names.includes("fork")) return "fork";
    return names.length ? names[0] : null;
  }

  function buildAgentPersona(slug) {
    return [
      'You are the Design Studio design agent for design system "' + slug + '".',
      "The design system is a UI MOCKUP ONLY: html + css + minimal presentation js. Never introduce app or game logic (a tic-tac-toe design shows the board LOOK, not playable rules), no state machines, no persistence, no business rules, no fetch calls. Interactive states are mocked visually or with trivial DOM toggling.",
      "You have file tools and the design_studio tool. The operator sends you design requests. ACT ON THEM: list files (design_studio action list), read the relevant files, then edit them yourself with your file tools (prefer targeted edits over full rewrites), and keep working until the change is coherent — you may take multiple tool calls per message. After editing, reply with a short summary of exactly what you changed and why (file-level, under 250 words).",
      "DESIGN CACHE DISCIPLINE (mandatory, every turn): at the START of every turn — even a bare 'ok', a greeting, or an ambiguous message — verify the design cache before doing anything else. Compare the DESIGN STAMP in your prompt with the stamp recorded in your last turn (the 'design cache:' line in the conversation). If they differ, the design changed since your last turn (operator edits, a coding agent synced it, or another session): the files in your prompt are the LATEST truth — adopt them, never restore or re-apply an older state you remember, and tell the operator what changed before continuing. If the stamp is unchanged, say so in one line and keep working from the current files. When the operator's message is vague or just 'ok', reply with the current design state (stamp + one-sentence description of the screen the mockup shows) and ask what change they want. Never skip this check and never claim a file is missing or reverted without comparing the cache first.",
      "Prefer the design_studio tool for reads: action list refreshes the file tree + stamp, action read reads any file, action agent_history shows the full operator conversation. Use your file tools for edits. If a request contradicts what the files show, trust the files and say so.",
      "You may also be invoked BY the main coding agent (DeepSeek) for vision or inspection support while IT applies a change: answer its question precisely (describe pixels, colors, layout, or file state), report back, and do not take over or redo its edit — in that mode the coding agent stays the primary editor.",
      "Read design_prompts_forcoders.md first when a request changes structure or palette. All colors must go through css/token.css tokens; never hardcode colors in style.css.",
      "Mock data must stay honest: empty/loading states, never fabricated live numbers, never real secrets.",
    ].join("\n");
  }

  function buildAgentPrompt(slug, message, history, brief, treeLines, filesText, imageNotes, designRootPath) {
    const recent = history
      .slice(0, -1)
      .slice(-6)
      .map((e) => (e.role === "operator" ? "Operator" : e.role === "coding-agent" ? "Coding agent" : e.role === "review" ? "Review" : e.role === "activity" ? "" : "Design agent") + (e.role === "activity" ? "" : ": ") + e.text)
      .filter((s) => s.length)
      .join("\n");
    // Design cache: the stamp the design agent last acted on vs the current one.
    const stampLine = treeLines && treeLines.length && /DESIGN STAMP/.test(treeLines[0]) ? String(treeLines[0]) : null;
    const curHash = stampLine ? String(stampLine.match(/hash\s+(\S+)/)?.[1] || "") : "";
    let lastCacheLine = null;
    for (let i = history.length - 1; i >= 0; i--) {
      const e = history[i];
      if (e && e.role === "activity" && /^design cache:/.test(String(e.text))) {
        lastCacheLine = String(e.text);
        break;
      }
    }
    let cacheStatus;
    if (!stampLine || !curHash) {
      cacheStatus = "DESIGN CACHE: no stamp available — list the system with design_studio action list first and treat the files below as the current truth.";
    } else if (lastCacheLine === null) {
      cacheStatus = "DESIGN CACHE: no recorded cache — this is your first turn on this design. The files below are the current truth; read them and confirm the design state in your reply.";
    } else {
      const prevHash = String(lastCacheLine.match(/hash\s+(\S+)/)?.[1] || "");
      cacheStatus =
        prevHash && prevHash === curHash
          ? "DESIGN CACHE: UNCHANGED since your last turn (last cache: " + lastCacheLine + " — the current stamp matches). The files below are still the truth; do NOT redo past changes, do NOT re-read every file unless the request needs it, and say in one line that the design is unchanged."
          : "DESIGN CACHE: CHANGED since your last turn (last cache: " + lastCacheLine + " — the current stamp differs). The design was modified outside your turns (operator edits, coding-agent sync, or another session). The files below ARE the latest state: adopt them as the truth, never restore an older state you remember, and tell the operator what changed.";
    }
    return [
      'Design system: "' + slug + '" — absolute path: ' + designRootPath + "/" + slug,
      "",
      "Design brief (design_prompts_forcoders.md):",
      '"""' + String(brief).slice(0, 1200) + '"""',
      "",
      "## Current design tree (the REAL files on disk):",
      treeLines && treeLines.length ? treeLines.join("\n") : "(no files yet)",
      "",
      cacheStatus,
      "",
      "## Key file contents (truncated):",
      filesText || "(no files yet)",
      "",
      imageNotes || "## Uploaded images: none attached this turn (mention a filename to attach one).",
      "",
      "Recent conversation:",
      recent || "(none yet)",
      "",
      "Operator message:",
      '"""' + String(message).slice(0, 2000) + '"""',
      "",
      "Work the request with your tools: inspect, edit, verify, then reply with a concise summary of the changes. If a change needs information you cannot get from the files, say so honestly instead of guessing.",
    ].join("\n");
  }




  async function designAgentChat(args) {
    const slug = args && args.slug;
    const message = args && args.message;
    let fsListener = null;
    const touched = new Map();
    let activityCount = 0;
    try {
      if (!isSlug(slug)) return { ok: false, notes: "invalid slug", history: [] };
      if (typeof message !== "string" || !message.trim()) return { ok: false, notes: "message is required", history: await agentHistoryLoad(slug) };
      const frozen = await readFreeze(slug);
      if (frozen) return { ok: false, notes: freezeMessage(slug, "design-agent chat", frozen), history: await agentHistoryLoad(slug), frozen: true };
      const history = await agentHistoryAppend(slug, "operator", message.trim());
      const brief = await promptsBrief(slug);
      const systems = await listSystems(null);
      const sysInfo = systems.find((s) => s.slug === slug);
      const treeLines = (sysInfo && sysInfo.files ? sysInfo.files : []).map((f) => "- " + f.path + (f.size !== null && f.size !== undefined ? " (" + f.size + " bytes)" : ""));
      if (sysInfo && sysInfo.stamp && sysInfo.stamp.hash) {
        treeLines.unshift("- DESIGN STAMP: hash " + sysInfo.stamp.hash + " · last modified " + sysInfo.stamp.at + " (bumped by every design change; the coding agent compares its remembered hash with this)");
      }
      const filesText = [
        "=== html/index.html ===\n" + (await readFileTextCapped(slug, "html/index.html", 7000)),
        "=== css/style.css ===\n" + (await readFileTextCapped(slug, "css/style.css", 9000)),
        "=== js/app.js ===\n" + (await readFileTextCapped(slug, "js/app.js", 9000)),
        "=== css/token.css ===\n" + (await readFileTextCapped(slug, "css/token.css", 3000)),
      ].join("\n\n");
      // Uploaded images: EXPLICIT picker selections first (they take priority),
      // then any image the operator mentioned by filename in the message.
      // 0-byte artifacts are never eligible for selection or mention-matching.
      const sysImages = (sysInfo && sysInfo.files ? sysInfo.files : [])
        .filter((f) => f.path.startsWith("assets/images/") && (f.size || 0) > 0)
        .map((f) => f.path);
      const explicit = Array.isArray(args.images) ? args.images.map(String) : [];
      const msgLower = String(message).toLowerCase();
      const mentioned = [];
      for (const p of explicit) {
        if (sysImages.includes(p) && !mentioned.includes(p)) mentioned.push(p);
      }
      for (const p of sysImages) {
        const base = String(p.split("/").pop() || "").toLowerCase();
        if (base && msgLower.includes(base) && !mentioned.includes(p)) mentioned.push(p);
      }
      // Prefer attaching the selected images directly when the harness model
      // advertises image input: the child inherits that route and can inspect
      // the pixels itself. Only describe them via OpenRouter when it cannot.
      const pickedImages = await loadMentionedImages(slug, mentioned);
      const cfg = await loadConfig();
      const visionInfo = await harnessVisionInfo();
      const canAttachImages = cfg.visionTransport !== "openrouter" && visionInfo.available &&
        attachments !== undefined && typeof attachments.saveImage === "function";
      const imageBlocks = [];
      let imageNotes = "";
      if (pickedImages.length) {
        if (canAttachImages) {
          const attachedPaths = [];
          for (const img of pickedImages) {
            if (img.error || img.mediaType === "image/svg+xml") continue;
            try {
              const ref = await attachments.saveImage({ data: img.bytes, mediaType: img.mediaType, name: img.path });
              imageBlocks.push({ type: "image", attachment: ref });
              attachedPaths.push(img.path);
            } catch (_) {}
          }
          if (imageBlocks.length) {
            imageNotes = [
              "## The operator SELECTED these image(s) in the studio image picker this turn (attached to this message, in selection order):",
              attachedPaths.map((p) => "- " + p).join("\n"),
              'Inspect the attached image(s) directly. When the operator says "the image", "this image", or "the background image" without a filename, they mean the FIRST attached image above — prefer it over any other asset already referenced in the files.',
            ].join("\n");
          }
        }
        if (!imageBlocks.length) {
          imageNotes = await describeAttachedImages(slug, mentioned, message.trim());
        }
      }

      // The UI passes its live conversation's sessionId explicitly; the design
      // system's stored owner is only the fallback (it can be stale).
      const callerSessionId = typeof args.sessionId === "string" && args.sessionId ? args.sessionId : null;
      const parent = findParentAgent(callerSessionId || (sysInfo ? sysInfo.sessionId : null));
      if (parent === null) return { ok: false, notes: "no live conversation agent in this process — make sure a conversation is open and try again", history: await agentHistoryLoad(slug) };
      const subagentsSvc = ctx.get("subagents");
      if (subagentsSvc === undefined || typeof subagentsSvc.startActivation !== "function") {
        return { ok: false, notes: "subagent service unavailable in this host (current contract: ctx.subagents.startActivation)", history: await agentHistoryLoad(slug) };
      }
      const provider = pickSubagentProvider(subagentsSvc);
      if (provider === null) return { ok: false, notes: "no subagent provider registered in this harness (need the spawn/fork in-process provider)", history: await agentHistoryLoad(slug) };

      // Live activity: observe fs events inside the design system while the child works.
      const designRootPath = await rootPath();
      const systemPath = designRootPath + "/" + slug;
      const absPrefix = toPosix(systemPath) + "/";
      fsListener = ctx.on("fs/observed", (target, observation) => {
        try {
          const p = toPosix(fs.processPath(target));
          const i = p.indexOf(absPrefix);
          if (i === -1) return;
          const rel = p.slice(i + absPrefix.length) || "(root)";
          const kind = observation && observation.kind ? String(observation.kind) : "touch";
          const key = rel + ":" + kind;
          if (touched.has(key) || activityCount >= 40) return;
          touched.set(key, Date.now());
          activityCount++;
          agentHistoryAppend(slug, "activity", kind + " " + rel).catch(function () {});
        } catch (_) {}
      });

      await agentHistoryAppend(slug, "activity", "design agent started on the harness " + provider + " engine");

      const effectiveMessage =
        message.trim() +
        (explicit.length
          ? '\n\n[Studio picker: the operator selected ' + explicit.join(", ") + ' in the image dropdown — any reference to "the image", "this image", or "the background" without a filename means THIS selection; prefer it over any other asset already referenced in the files.]'
          : "");
      const prompt = buildAgentPrompt(slug, effectiveMessage, history, brief, treeLines, filesText, imageNotes, designRootPath);

      const runTimeoutMs = 12 * 60 * 1000;
      const controller = new AbortController();
      const watchdog = setTimeout(() => controller.abort(), runTimeoutMs);
      let run = null;
      let disposed = false;
      let timeoutTimer = null;
      const disposeRun = async () => {
        if (disposed || run === null) return;
        disposed = true;
        try { await run.dispose(); } catch (_) {}
      };
      try {
        // Current subagent contract: startActivation returns a managed
        // activation. `delivery: 'caller'` keeps the child's reply out of the
        // main conversation (the studio surfaces it); the child's cwd is the
        // design system, and maxDepth 0 stops it from spawning its own agents.
        run = await subagentsSvc.startActivation({
          provider,
          label: "design-agent:" + slug,
          request: {
            prompt: [{ type: "text", text: buildAgentPersona(slug) + "\n\n" + prompt }].concat(imageBlocks),
            parent,
            cwd: systemPath,
            signal: controller.signal,
            // The child itself is depth 1, so maxDepth must be at least 1.
            // 1 lets it run but prevents it from spawning grandchildren.
            maxDepth: 1,
            ...(cfg.agentPreset && provider === "spawn" ? { agentPreset: cfg.agentPreset } : {}),
          },
          signal: controller.signal,
          delivery: "caller",
        });
        const outcome = await Promise.race([
          run.result.then((r) => ({ kind: "result", value: r })),
          new Promise((resolve) => {
            timeoutTimer = setTimeout(() => resolve({ kind: "timeout" }), runTimeoutMs);
          }),
        ]);
        if (timeoutTimer !== null) {
          clearTimeout(timeoutTimer);
          timeoutTimer = null;
        }
        if (outcome.kind === "timeout") {
          await disposeRun();
          await agentHistoryAppend(slug, "activity", "design agent timed out after 12 min");
          return { ok: false, notes: "design agent timed out (12 min) — ask again with a narrower request", history: await agentHistoryLoad(slug) };
        }
        const result = outcome.value;
        const text = (result && Array.isArray(result.output) ? result.output : [])
          .filter((b) => b && b.type === "text")
          .map((b) => String(b.text || ""))
          .join("\n")
          .trim();
        if (result && result.stopReason !== "completed") {
          await agentHistoryAppend(slug, "activity", "design agent stopped: " + result.stopReason);
          if (!text) return { ok: false, notes: "design agent stopped: " + String(result.stopReason), history: await agentHistoryLoad(slug) };
        }
        if (!text) return { ok: false, notes: "design agent produced no reply", history: await agentHistoryLoad(slug) };
        const finalHistory = await agentHistoryAppend(slug, "design-agent", text);
        // Persist the design cache this turn acted on so the NEXT turn can
        // detect drift: the stamp recorded here is compared on next invocation.
        try {
          const afterSystems = await listSystems(null);
          const afterInfo = afterSystems.find((s) => s.slug === slug);
          if (afterInfo && afterInfo.stamp && afterInfo.stamp.hash) {
            await agentHistoryAppend(slug, "activity", "design cache: stamp hash " + afterInfo.stamp.hash + " at " + afterInfo.stamp.at);
          }
        } catch (_) {}
        await captureHistory(
          slug,
          "agent: " + String(effectiveMessage || "").replace(/\s+/g, " ").slice(0, 80),
        ).catch(function () {});
        return { ok: true, reply: text, model: "harness-" + provider + "-agent", history: finalHistory };
      } finally {
        clearTimeout(watchdog);
        if (timeoutTimer !== null) clearTimeout(timeoutTimer);
        await disposeRun();
      }
    } catch (err) {
      return { ok: false, notes: String((err && err.message) || err), history: await agentHistoryLoad(slug) };
    } finally {
      if (fsListener) {
        try {
          fsListener();
        } catch (_) {}
      }
    }
  }

  // ---------- client JSON API (the persistent UI's data channel) ----------
  // The visual UI (lib/client.js, dsh.client face) calls these same-origin
  // endpoints instead of a dynamic-plugin RPC, so the tab works on every
  // launch with no session-scoped loading step.

  async function listAgentPresetOptions() {
    const service = ctx.get("agentPresets");
    if (service === undefined || typeof service.list !== "function") return [];
    try {
      const list = await service.list();
      return list.map((preset) => ({
        id: String(preset.id || preset.name || ""),
        name: String(preset.name || preset.id || ""),
        description: preset.description ? String(preset.description) : null,
      })).filter((preset) => preset.id);
    } catch (_) {
      return [];
    }
  }




  async function writeDataUrl(slug, dest, dataUrl) {
    const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
    if (!m) throw new Error("malformed data URL");
    const isB64 = m[2] === ";base64";
    const payload = m[3];
    if (isB64) {
      if (!payload || !payload.trim()) throw new Error("file is empty (no content received)");
      const bytes = dataUrlToBytes(dataUrl);
      if (!bytes) throw new Error("decode failed");
      if (bytes.length > IMAGE_CAP) throw new Error("file too large (>12MB decoded)");
      const sys = await resolveSystem(slug);
      const target = await fs.resolve(dest, { cwd: fs.processPath(sys) });
      if (!fs.contains(sys, target)) throw new Error("path escapes the design system");
      await writeBytes(fs.processPath(target), bytes);
      await bumpDesignStamp(slug).catch(function () {});
    } else {
      await writeSystemFile(slug, dest, decodeURIComponent(payload));
    }
  }

  async function ingestFiles(slug, files) {
    if (!Array.isArray(files)) throw new Error("files must be an array");
    const sys = await resolveSystem(slug);
    if (!(await fs.stat(sys))) throw new Error("unknown design system: " + slug);
    const results = [];
    for (const f of files) {
      const name = String((f && f.name) || "").replace(/[^A-Za-z0-9._-]/g, "_");
      if (!name) {
        results.push({ name: "(unnamed)", ok: false, error: "empty file name" });
        continue;
      }
      const rel = cleanRel(name);
      if (rel === null) {
        results.push({ name, ok: false, error: "invalid file name" });
        continue;
      }
      const kind = classifyFile(name, f && f.kind);
      const dest = (kind === "image" ? "assets/images" : "references") + "/" + rel;
      try {
        if (f && typeof f.dataUrl === "string" && f.dataUrl.startsWith("data:")) {
          await writeDataUrl(slug, dest, f.dataUrl);
        } else if (f && typeof f.text === "string") {
          if (!f.text.length) throw new Error("file is empty (no content received)");
          await writeSystemFile(slug, dest, f.text);
        } else {
          throw new Error("no content (need dataUrl or text)");
        }
        results.push({ name, ok: true, dest, kind });
      } catch (err) {
        results.push({ name, ok: false, error: String((err && err.message) || err) });
      }
    }
    return results;
  }

  async function writeEditRequest(slug, selection, request) {
    if (!isSlug(slug)) throw new Error("invalid slug");
    const sys = await resolveSystem(slug);
    if (!(await fs.stat(sys))) throw new Error("unknown design system: " + slug);
    const sel = selection && typeof selection === "object" ? selection : {};
    const lines = [
      "# Edit request — " + slug, "",
      "Saved: " + new Date().toISOString(), "",
      "## Target", "",
      "- tag: " + (sel.tag || "?"),
      "- cssPath: " + (sel.cssPath || "?"),
      "- classPath: " + String(sel.classPath || ""),
      "- classes: " + JSON.stringify(sel.classes || []),
      "- rect: " + JSON.stringify(sel.rect || {}),
      "- text: " + String(sel.text || ""),
      "- snippet:", "", "```html", String(sel.snippet || "").slice(0, 600), "```", "",
      "## Hierarchy (outermost → target)", "",
    ];
    for (const node of sel.hierarchy || []) {
      const nodeName = node.tag + (node.id ? "#" + node.id : "") + (node.classes && node.classes.length ? "." + node.classes.join(".") : "");
      lines.push("- " + nodeName + "  (" + node.cssPath + ")");
      lines.push("  styles: " + JSON.stringify(node.styles || {}));
    }
    lines.push("", "## Styles (target)", "", "```json", JSON.stringify(sel.styles || {}, null, 2), "```", "");
    lines.push("## Operator request", "", request ? String(request) : "(none)", "");
    lines.push("## Instructions for the coding agent", "");
    lines.push("You are the primary editor (the main DeepSeek coding agent): apply the operator request by editing this design system's html/css/js (start at the target component, walk up the hierarchy if the request covers a row/section). Keep mock data honest. When you need a visual read you cannot make yourself, invoke the design agent (design_studio action agent with this slug) with a precise question and use its report. Then clear this request (design_studio selection_clear).");
    lines.push("");
    await writeSystemFile(slug, "EDIT_REQUEST.md", lines.join("\n"));
    const hist = (await readJson("_studio/requests/" + slug + ".json")) || { slug, entries: [] };
    if (!Array.isArray(hist.entries)) hist.entries = [];
    hist.entries.push({ at: new Date().toISOString(), request: String(request || ""), selection: sel });
    hist.entries = hist.entries.slice(-20);
    await writeJson("_studio/requests/" + slug + ".json", hist);
    return { path: slug + "/EDIT_REQUEST.md", request: String(request || "") };
  }

  async function clearEditRequest(slug) {
    if (!isSlug(slug)) throw new Error("invalid slug");
    const sys = await resolveSystem(slug);
    if (!(await fs.stat(sys))) throw new Error("unknown design system: " + slug);
    const t = await fs.resolve("EDIT_REQUEST.md", { cwd: fs.processPath(sys) });
    await removePaths([fs.processPath(t)], await rootPath());
    await bumpDesignStamp(slug).catch(function () {});
    return { cleared: true };
  }

  function outlineItemsOf(rel, text) {
    const lines = String(text || "").split("\n");
    const items = [];
    if (rel.includes(".html")) {
      for (const ln of lines) {
        const t = ln.trim();
        const hd = /<(h[1-4])\b[^>]*>(.*?)<\/\1>/i.exec(t);
        if (hd) {
          items.push({ kind: "heading", label: hd[1] + " " + String(hd[2]).replace(/<[^>]*>/g, "").trim().slice(0, 60) });
          continue;
        }
        const el = /<(section|header|main|footer|nav|aside|article|div|form|button|ul|table)\b[^>]*>/i.exec(t);
        if (el) {
          const id = /id="([^"]+)"/i.exec(el[0]);
          const cls = /class="([^"]+)"/i.exec(el[0]);
          const name = id ? "#" + id[1] : cls ? "." + String(cls[1]).trim().split(/\s+/).join(".") : null;
          if (name) items.push({ kind: "element", label: el[1] + name });
        }
      }
    } else if (rel.includes(".css")) {
      for (const ln of lines) {
        const t = ln.trim();
        const cm = /\/\*\s*(.*?)\s*\*\//.exec(t);
        if (cm) {
          items.push({ kind: "section", label: "§ " + String(cm[1]).slice(0, 60) });
          continue;
        }
        const sel = /^([.#][\w-]+|[a-z][\w-]*)\s*(?:,|{)/.exec(t);
        if (sel && t.includes("{")) items.push({ kind: "selector", label: sel[1].slice(0, 60) });
      }
    } else {
      for (const ln of lines) {
        const t = ln.trim();
        const cm = /\/\/\s*(.*)$/.exec(t);
        if (cm) {
          items.push({ kind: "section", label: "§ " + String(cm[1]).slice(0, 60) });
          continue;
        }
        const fn = /function\s+([\w$]+)\s*\(/.exec(t);
        if (fn) items.push({ kind: "function", label: "ƒ " + fn[1] });
      }
    }
    return items.slice(0, 80);
  }

  async function outlineOfSystem(slug) {
    if (!isSlug(slug)) throw new Error("invalid slug");
    const systems = await listSystems(null);
    const sysInfo = systems.find((s) => s.slug === slug);
    if (!sysInfo) throw new Error("unknown design system: " + slug);
    const sections = [];
    for (const rel of ["html/index.html", "css/token.css", "css/style.css", "js/app.js"]) {
      const f = sysInfo.files.find((x) => x.path === rel);
      if (!f) continue;
      sections.push({ file: rel, items: outlineItemsOf(rel, await readFileTextCapped(slug, rel, 400000)) });
    }
    return { slug, files: sysInfo.files.map((f) => ({ path: f.path, size: f.size })), sections };
  }

  // ---------- registrations ----------
  let studioOrigin = "http://127.0.0.1:3080";
  if (webServer !== undefined && typeof webServer.getOrigin === "function") {
    try { studioOrigin = webServer.getOrigin(); } catch (_) {}
  }
  if (systemPrompt !== undefined) {
    ctx.effect(() => systemPrompt.section({
      name: "design-studio-routing",
      order: 150,
      text: [
        "Design briefs go through the Design Studio. When the operator describes a screen, app, landing page,",
        "dashboard, or mockup to design/build (like a product brief with layout, visual direction, interactions,",
        "states, or responsiveness), treat it as a design brief:",
        "1. Pick a slug and use the design_studio tool: create the system, then write html/index.html,",
        "   css/style.css, css/token.css (palette + typography), js/app.js, and design_prompts_forcoders.md",
        "   with the full brief.",
        "2. A design system is a UI MOCKUP ONLY: html + css + minimal presentation js. NEVER full app or",
        "   game logic — no game engines or win/turn logic (a tic-tac-toe design shows the board LOOK,",
        "   not playable rules), no state machines, no persistence, no business rules, no fetch calls.",
        "   Interactive states are mocked visually or with trivial DOM toggling.",
        "3. All data inside a mockup is READ-ONLY demo data (honest empty/loading/error states; never fabricated live numbers;",
        "   never real secrets or live endpoints).",
        "4. When done, zip it (design_studio action zip) and report the live preview URL",
        "   " + studioOrigin + "/design-studio/<slug>/html/index.html (the Design Studio tab shows it in an iframe when",
        "   the studio plugin is running in that session).",
        "Use design_studio actions: list, create, read, write, zip, snapshot, open, asset_list, asset_upload, asset_import, asset_delete, history, snapshot_save, snapshot_restore, snapshot_undo, style_list, style_apply, style_save, style_delete, style_create, presets, preset_save, preset_apply, preset_delete,",
        "review (vision review; harness first), agent (design agent), config (vision settings).",
      ].join("\n"),
    }));
  }

  const TEXT_EXTS = [".html", ".css", ".js", ".mjs", ".json", ".md", ".txt", ".svg", ".map", ".csv", ".xml", ".ts", ".py", ".sh", ".yml", ".yaml", ".kt", ".java", ".log"];
  const MIME_SERVE = {
    ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".md": "text/markdown; charset=utf-8",
    ".txt": "text/plain; charset=utf-8", ".svg": "image/svg+xml", ".map": "application/json; charset=utf-8", ".csv": "text/csv; charset=utf-8",
    ".xml": "application/xml; charset=utf-8", ".ts": "text/plain; charset=utf-8", ".py": "text/plain; charset=utf-8",
    ".sh": "text/plain; charset=utf-8", ".yml": "text/plain; charset=utf-8", ".yaml": "text/plain; charset=utf-8",
    ".kt": "text/plain; charset=utf-8", ".java": "text/plain; charset=utf-8", ".log": "text/plain; charset=utf-8",
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp",
    ".ico": "image/x-icon", ".avif": "image/avif", ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime", ".woff2": "font/woff2",
  };

  function failResponse(res, code, msg) {
    res.statusCode = code;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    res.end(String(msg));
  }

  function jsonResponse(res, code, value) {
    res.statusCode = code;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    res.end(JSON.stringify(value));
  }

  function readRequestBody(req, cap) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;
      req.on("data", (c) => {
        size += c.length;
        if (size > cap) {
          reject(new Error("request body too large"));
          req.destroy();
          return;
        }
        chunks.push(c);
      });
      req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      req.on("error", reject);
    });
  }

  async function apiDispatch(method, a) {
    const frozenBlocked = new Set([
      "studio.asset.upload", "studio.asset.import", "studio.asset.delete",
      "studio.history.restore", "studio.history.undo",
      "studio.preset.apply", "studio.ingest",
      "studio.selection.save", "studio.selection.clear",
    ]);
    if (a && a.slug && frozenBlocked.has(method)) await assertWritable(a.slug, method);
    switch (method) {
      case "studio.ping": return { studio: STUDIO_DIR, previewRoute: "/design-studio/<slug>/html/index.html" };
      case "studio.list": return await listSystems(a.sessionId);
      case "studio.freeze": return await freezeSystem(a.slug, a.implementation, a.note);
      case "studio.unfreeze": return await unfreezeSystem(a.slug, a.confirm === true);
      case "studio.assets": return await listAssets(a.slug);
      case "studio.asset.upload": return await uploadAsset(a.slug, a.name, a.dataUrl, a.alt);
      case "studio.asset.import": return await uploadAssetFromPath(a.slug, a.sourcePath, a.name, a.alt);
      case "studio.asset.delete": return await deleteAsset(a.slug, a.path);
      case "studio.history.list": return await listHistory(a.slug);
      case "studio.history.save": return await captureHistory(a.slug, a.reason || "manual");
      case "studio.history.restore": return await restoreHistory(a.slug, a.snapshotId);
      case "studio.history.undo": return await undoHistory(a.slug);
      case "studio.styles.list": return await listStyles(a.fontMode);
      case "studio.styles.apply": return await applyStyleWithSnapshot(a.slug, a.styleId, a.fontMode);
      case "studio.styles.save": return await saveStyle(a.slug, a.name, a.description);
      case "studio.styles.delete": return await deleteStyle(a.styleId);
      case "studio.styles.create": return await createFromStyle(a.styleId, a.slug, typeof a.sessionId === "string" && a.sessionId ? a.sessionId : null, a.fontMode);
      case "studio.create": return await createSystem(a.slug, typeof a.sessionId === "string" && a.sessionId ? a.sessionId : null);
      case "studio.sweep": return await sweepOrphans();
      case "studio.delete": return await deleteSystem(a.slug);
      case "studio.config": {
        if (a && a.refresh) invalidateVisionCache();
        const vision = await harnessVisionInfo();
        let harness = { routeRegistered: false, providers: [], vision };
        if (llm !== undefined) {
          try {
            const providers = llm.listProviders();
            harness = {
              routeRegistered: providers.some((p) => p && p.id === "openrouter"),
              providers: providers.map((p) => (p && p.id) || null).filter(Boolean),
              vision,
            };
          } catch (_) {}
        }
        return { config: await loadConfig(), key: await keyInfo(), harness, agentPresets: await listAgentPresetOptions() };
      }
      case "studio.config.save": return await saveConfig(a.patch);
      case "studio.config.setKey": {
        if (credentials === undefined) throw new Error("credential service unavailable in this host");
        if (typeof a.value !== "string" || !a.value.trim()) throw new Error("empty key — use clearKey to remove it");
        try {
          await credentials.set(KEY_REF, a.value.trim());
        } catch (err) {
          throw new Error("key not stored: " + String((err && err.message) || err));
        }
        return keyInfo();
      }
      case "studio.config.clearKey": {
        if (credentials === undefined) throw new Error("credential service unavailable in this host");
        try {
          await credentials.unset(KEY_REF);
        } catch (err) {
          throw new Error("key not removed: " + String((err && err.message) || err));
        }
        return keyInfo();
      }
      case "studio.zip": return await zipSystem(a.slug);
      case "studio.snapshot": return await capturePreviewToSystem(a.slug);
      case "studio.openPreview": return await openPreviewInSystem(a.slug);
      case "studio.reveal": return await revealZip(a.slug);
      case "studio.agent": return await designAgentChat(a);
      case "studio.agent.history": return await agentHistoryLoad(a.slug);
      case "studio.agent.note": {
        if (!isSlug(a.slug)) throw new Error("invalid slug");
        if (!/^[a-z-]{1,20}$/.test(String(a.role || ""))) throw new Error("invalid role");
        return await agentHistoryAppend(a.slug, String(a.role), String(a.text || ""));
      }
      case "studio.review.get": {
        if (!isSlug(a.slug)) throw new Error("invalid slug");
        return await readJson("_studio/reviews/" + a.slug + ".json");
      }
      case "vision.review": return await visionReview(a);
      case "studio.outline": return await outlineOfSystem(a.slug);
      case "studio.presets": return await listPresets();
      case "studio.preset.get": {
        if (!isSlug(a.id)) throw new Error("invalid preset id");
        const parsed = await readJson(PRESETS_DIR + "/" + a.id + ".json");
        if (!parsed) throw new Error("unknown preset: " + a.id);
        return {
          id: parsed.id || a.id, name: parsed.name || a.id,
          colors: parsed.colors && typeof parsed.colors === "object" ? parsed.colors : {},
          logos: parsed.logos && typeof parsed.logos === "object" ? parsed.logos : {},
          fonts: parsed.fonts && typeof parsed.fonts === "object" ? parsed.fonts : {},
          radius: parsed.radius ?? null, spacing: parsed.spacing ?? null,
          components: parsed.components && typeof parsed.components === "object" ? parsed.components : {},
          version: typeof parsed.version === "number" ? parsed.version : 1,
        };
      }
      case "studio.preset.save": {
        const r = await savePreset(a.preset);
        return { id: r.id, name: r.name, version: r.version };
      }
      case "studio.preset.delete": return await deletePreset(a.id);
      case "studio.preset.apply": return await applyPreset(a.slug, a.presetId);
      case "studio.ingest": return await ingestFiles(a.slug, a.files);
      case "studio.selection.save": {
        const r = await writeEditRequest(a.slug, a.selection, a.request);
        if (a.verifyAfter) {
          const cfg = await loadConfig();
          if (cfg.autoVerify) armPostEditVerify(a.slug, a.request, a.sessionId);
        }
        return r;
      }
      case "studio.selection.clear": return await clearEditRequest(a.slug);
      default:
        throw new Error("unknown api method: " + method);
    }
  }

  async function handleApi(req, res, segs) {
    const method = segs.join(".");
    let args = {};
    try {
      const body = await readRequestBody(req, 32 * 1024 * 1024);
      if (body.trim()) args = JSON.parse(body);
    } catch (err) {
      return jsonResponse(res, 400, { ok: false, error: "bad request body: " + String((err && err.message) || err) });
    }
    try {
      return jsonResponse(res, 200, { ok: true, data: await apiDispatch(method, args) });
    } catch (err) {
      return jsonResponse(res, 200, { ok: false, error: String((err && err.message) || err) });
    }
  }

  if (webServer !== undefined) {
    ctx.effect(() => {
      try {
        return webServer.register({
          kind: "prefix",
          path: "/design-studio",
          handler: async (req, res) => {
            try {
              const raw = String(req.url || "").split("?")[0];
              const isApi = raw.startsWith("/design-studio/__api");
              if (isApi) {
                if (req.method !== "POST") return failResponse(res, 405, "method not allowed");
              } else if (req.method !== "GET" && req.method !== "HEAD") {
                return failResponse(res, 405, "method not allowed");
              }
              const restRaw = raw.startsWith("/design-studio") ? raw.slice("/design-studio".length) : "";
              const segs = [];
              for (const s of restRaw.split("/")) {
                if (s === "") continue;
                let dec = s;
                try { dec = decodeURIComponent(s); } catch (_) {}
                if (dec === ".." || dec.includes("\\") || dec.includes("\0")) return failResponse(res, 400, "bad path");
                segs.push(dec);
              }
              if (!segs.length) return failResponse(res, 404, "no design system in path");
              if (segs[0] === "__api") return await handleApi(req, res, segs.slice(1));
              const slug = segs[0];
              if (!isSlug(slug) || slug === "_zips" || slug === "_presets" || slug === "_studio") return failResponse(res, 404, "unknown design system");
              let rel = segs.slice(1).join("/");
              if (!rel || rel === "index.html") rel = "html/index.html";
              const sys = await resolveSystem(slug);
              const target = await fs.resolve(rel, { cwd: fs.processPath(sys) });
              if (!fs.contains(sys, target)) return failResponse(res, 404, "outside design system");
              const info = await fs.stat(target);
              if (!info || info.type !== "file") return failResponse(res, 404, "not found: " + rel);
              const ext = "." + (rel.split(".").pop() || "").toLowerCase();
              res.statusCode = 200;
              res.setHeader("content-type", MIME_SERVE[ext] || "application/octet-stream");
              res.setHeader("cache-control", "no-store");
              res.setHeader("x-content-type-options", "nosniff");
              if (req.method === "HEAD") res.end();
              else if (TEXT_EXTS.includes(ext)) res.end(await fs.readText(target));
              else res.end(await fs.readBytes(target, undefined, 20 * 1024 * 1024));
            } catch (err) {
              failResponse(res, 500, String((err && err.message) || err));
            }
          },
        });
      } catch (err) {
        // Another mounted package already owns the route; keep booting.
        ctx.logger?.warn?.("dsh-design-studio: /design-studio route already registered; using the existing one:", String((err && err.message) || err));
        return () => {};
      }
    });
  }

  const tool = {
    name: "design_studio",
    description:
      "Manage the Design Studio under temp_design_folder/: list/create/read/write/zip design systems (html+css+js mockups), reveal the zip in the OS file manager, open the live preview in the OS default browser (bypasses the DSH in-app browser), manage the asset library (asset_list/asset_upload/asset_import/asset_delete with sha256 dedupe + manifest metadata), save/list/restore content-addressed snapshots (history/snapshot_save/snapshot_restore/snapshot_undo), apply/save/create attributed style-atlas looks (style_list/style_apply/style_save/style_create), CRUD identity presets (apply writes css/token.css + copies logo assets), chat with the design agent (a real harness subagent that lists, reads and edits the design files itself; persisted per-system history), persist the OpenRouter vision-model config, and run a vision review (image + brief -> honest GOOD|POOR verdict from the operator-chosen OpenRouter model). Writes are scoped to temp_design_folder/ design-system folders only. The OpenRouter key is a credential reference (OPENROUTER_API_KEY) and its value is never returned or rendered. VISION: action config reports harnessVision; when it is available (the current model advertises image input), call action snapshot to render the live preview to a PNG returned as an attached image you can inspect directly, and action review uses the harness model first (no OpenRouter key needed). When harness vision is unavailable, do not guess pixels: use action review (OpenRouter) or action agent; selected images are attached directly to the child when the harness supports images, otherwise they are described by the configured vision model. SNAPSHOT captures the actual served preview with a headless Edge/Chrome (install one to use it). DESIGN SYSTEMS ARE UI MOCKUPS ONLY: html + css + minimal presentation js — never full app or game logic (a tic-tac-toe design shows the board look, not playable rules); every create scaffolds a color palette + typography in css/token.css and design_prompts_forcoders.md. FRESHNESS STAMP: the list/all actions return each design system's stamp {hash, at} — a fresh random hash bumped on EVERY design change (content-addressed snapshots keep the version history) with the last-modified ISO date. Before editing a design, run list and compare the hash with the one you remembered from your last edit; if it differs, someone else (design agent, operator, another session) changed the design since. OPERATOR⇄DESIGN-AGENT CHAT: the operator talks to the design agent through this tool (action agent; every message, activity line and reply is persisted per system). ALWAYS call action agent_history with the slug before concluding a design was reverted, broken, or missing a file — and before restoring or 'fixing' design files — so you see exactly what the operator asked and what the design agent did; the stamp in list/all tells you when the design last changed. FREEZE: list/all report {frozen, freeze}; a frozen design is a read-only handoff. Never write, style, ingest, asset-edit, restore history, delete, or use the design agent on it. Work in the recorded freeze.implementation target instead (or ask the operator where to implement); only the operator thaws it. Mutating actions are rejected while frozen. Use action freeze to capture the final snapshot/zip and record the implementation target, and action unfreeze only when the operator explicitly asks.",
    // Plain JSON Schema (what dsh-tools' defineTool generates from the typed
    // spec) so the bundle needs no runtime import.
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["list", "all", "create", "read", "write", "zip", "snapshot", "open", "reveal", "freeze", "unfreeze", "presets", "preset_save", "preset_apply", "preset_delete", "asset_list", "asset_upload", "asset_import", "asset_delete", "history", "snapshot_save", "snapshot_restore", "snapshot_undo", "style_list", "style_apply", "style_save", "style_delete", "style_create", "review", "agent", "agent_history", "sweep", "delete", "config"], description: "Which studio operation to run." },
        slug: { type: "string", description: "Design-system slug (lowercase letters, digits, dashes), e.g. homelab-command-center." },
        path: { type: "string", description: "File path inside the design system, e.g. css/style.css (or assets/images/foo.png for asset_delete)." },
        content: { type: "string", description: "Full new file content for write." },
        name: { type: "string", description: "For asset_upload/asset_import: optional display/file name." },
        sourcePath: { type: "string", description: "For asset_import: an absolute or workspace-relative source image path." },
        dataUrl: { type: "string", description: "For asset_upload: data:image/...;base64 URL." },
        alt: { type: "string", description: "For asset_upload/asset_import: optional alt text stored in the asset manifest." },
        preset: { type: "object", additionalProperties: true, description: "Preset JSON for preset_save: {id, name, colors:{bg,panel,panel2,border,text,muted,accent,ok,warn,err,info}, logos?{mark,wordmark,favicon}, fonts?{body,display,mono}, radius?\"12px\", spacing?16, components?{...}}." },
        presetId: { type: "string", description: "Preset id for preset_apply or preset_delete." },
        snapshotId: { type: "string", description: "Snapshot id for snapshot_restore (from action history)." },
        reason: { type: "string", description: "Optional label for snapshot_save." },
        implementation: { type: "string", description: "For freeze: implementation path/repo to edit while the design is frozen. Optional but strongly recommended." },
        note: { type: "string", description: "For freeze: handoff note or constraints for implementation." },
        styleId: { type: "string", description: "Style atlas id for style_apply/style_delete/style_create." },
        fontMode: { type: "string", enum: ["auto", "serif", "sans", "mono"], description: "Optional font override when applying a style." },
        description: { type: "string", description: "Optional description when saving a custom style." },
        image: { type: "string", description: "For review: an image path inside the design system (e.g. assets/images/shot.png) or a data:image/...;base64 URL." },
        brief: { type: "string", description: "For review: optional brief override; defaults to the design system design_prompts_forcoders.md." },
        message: { type: "string", description: "For agent: the message to send to the design agent (a real harness subagent that lists/reads/edits the design files itself; multiple tool calls per message)." },
        images: { type: "array", items: { type: "string" }, description: "For agent: optional asset image paths to attach (e.g. [\"assets/images/shot-1.png\"]); explicitly selected images take priority over any other asset, and mentioning a filename in the message also auto-attaches it." },
        patch: { type: "object", additionalProperties: true, description: "For config: partial config patch {visionModels?[], visionTransport?(\"auto\"|\"harness\"|\"openrouter\"), reviewStyle?(\"strict\"|\"balanced\"|\"lenient\"), effort?(\"auto\"|\"off\"|\"low\"|\"medium\"|\"high\"|\"max\"), autoVerify?, capture?{width?,height?}, agentPreset?, autoDeleteWithSession?, options?{baseUrl?, temperature?, maxTokens?, providerRouting?, quantizations?[], onlyProviders?[], allowFallbacks?, includeUsage?, reasoningExclude?}}." },
      },
      required: ["action"],
    },
    output: {
      schema: {
        oneOf: [
          { type: "string" },
          {
            type: "object",
            additionalProperties: false,
            properties: {
              text: { type: "string" },
              image: { type: "object", additionalProperties: true },
            },
            required: ["text"],
          },
        ],
      },
      render: (_args, value) => {
        if (typeof value === "string") return [{ type: "text", text: value }];
        const blocks = [{ type: "text", text: String((value && value.text) || "") }];
        if (value && value.image && value.image.attachment) {
          blocks.push({ type: "image", attachment: value.image.attachment });
        }
        return blocks;
      },
    },
    async execute(args, exec) {
      // Current Agent identity is `id` (SessionId); `sessionId` on exec.agent
      // belonged to the pre-0.2 harness and silently produced unbound designs.
      const execSessionId = exec && exec.agent && exec.agent.id ? String(exec.agent.id) : null;
      const frozenBlockedTools = new Set([
        "write", "asset_upload", "asset_import", "asset_delete",
        "history_restore", "history_undo", "style_apply", "preset_apply",
        "agent", "delete",
      ]);
      if (args && args.slug && frozenBlockedTools.has(args.action)) {
        await assertWritable(args.slug, "action " + args.action);
      }
      switch (args.action) {
        case "list": {
          const systems = await listSystems(null);
          return JSON.stringify(systems.map((s) => ({
            slug: s.slug, sessionId: s.sessionId, orphan: s.orphan, files: s.count, hasPrompts: s.hasPrompts, hasPreview: s.hasPreview, hasTokenCss: s.hasTokenCss,
            stamp: s.stamp,
            frozen: s.frozen,
            freeze: s.freeze,
            images: s.files.filter((f) => f.path.startsWith("assets/images/") && (f.size || 0) > 0).map((f) => f.path),
          })), null, 2);
        }
        case "all": {
          const systems = await listSystems(null);
          return JSON.stringify(systems.map((s) => ({ slug: s.slug, sessionId: s.sessionId, orphan: s.orphan, createdAt: s.createdAt, files: s.count, hasPreview: s.hasPreview, stamp: s.stamp, frozen: s.frozen, freeze: s.freeze })), null, 2);
        }
        case "create": {
          const r = await createSystem(args.slug, execSessionId);
          return "created design system " + args.slug + " (html/css/js + design_prompts_forcoders.md; no empty folders)" + (r.sessionId ? " bound to this conversation (" + r.sessionId + ")" : " (no conversation binding)");
        }
        case "freeze": {
          const r = await freezeSystem(args.slug, args.implementation, args.note);
          return (r.alreadyFrozen ? "design already frozen: " : "design frozen: ") + args.slug +
            " — final snapshot " + String(r.finalSnapshot || "none").slice(0, 12) +
            (r.implementation ? "; implementation target: " + r.implementation : "; no implementation target recorded") +
            (r.zip ? "; zip refreshed" : "");
        }
        case "unfreeze": {
          const r = await unfreezeSystem(args.slug, true);
          return (r.alreadyThawed ? "design already thawed: " : "design thawed: ") + args.slug + " — mockup is editable again";
        }
        case "read": return (await readSystemFile(args.slug, args.path)).content;
        case "write": {
          const r = await writeSystemFile(args.slug, args.path, args.content);
          return "wrote " + r.bytes + " bytes to " + args.slug + "/" + r.path;
        }
        case "zip": return "zip written: " + (await zipSystem(args.slug)).zip + " (files only; empty folders excluded)";
        case "snapshot": {
          const r = await capturePreviewToSystem(args.slug);
          const summary = "preview captured: " + args.slug + "/" + r.dest +
            (r.w && r.h ? " (" + r.w + "x" + r.h + ")" : "") +
            " — inspect the attached image (or read it with read_image).";
          if (attachments !== undefined && typeof attachments.saveImage === "function") {
            try {
              const target = await resolveInSystem(args.slug, r.dest);
              const bytes = await fs.readBytes(target, undefined, IMAGE_CAP);
              const ref = await attachments.saveImage({ data: bytes, mediaType: "image/png", name: r.dest });
              return { text: summary, image: { attachment: ref } };
            } catch (_) {}
          }
          return summary;
        }
        case "open": {
          const r = await openPreviewInSystem(args.slug);
          return "opened in the system browser: " + r.url;
        }
        case "reveal": return "file manager opened for " + (await revealZip(args.slug)).revealed;
        case "agent": {
          const callArgs = execSessionId && !args.sessionId ? Object.assign({}, args, { sessionId: execSessionId }) : args;
          const r = await designAgentChat(callArgs);
          if (!r.ok) return "NO REPLY: " + r.notes;
          return "design agent (" + r.model + "): " + r.reply;
        }
        case "agent_history": return JSON.stringify(await agentHistoryLoad(args.slug), null, 2);
        case "sweep": {
          const r = await sweepOrphans();
          return r.note + (r.swept.length ? " — removed: " + r.swept.join(", ") : "");
        }
        case "delete": {
          await deleteSystem(args.slug);
          return "design system removed: " + args.slug + " (folder, zip, reviews, agent history)";
        }
        case "presets": return JSON.stringify(await listPresets(), null, 2);
        case "preset_save": {
          const r = await savePreset(args.preset);
          return "preset " + r.id + " saved (version " + r.version + ")";
        }
        case "preset_apply": {
          const r = await applyPreset(args.slug, args.presetId);
          return "applied preset " + r.presetId + " to " + r.slug + ": wrote " + r.tokenCss +
            (r.copied.length ? "; copied logos: " + r.copied.join(", ") : "") +
            (r.missing.length ? "; missing logos (skipped honestly): " + r.missing.join(", ") : "");
        }
        case "preset_delete": {
          await deletePreset(args.presetId);
          return "preset removed: " + args.presetId;
        }
        case "asset_list": return JSON.stringify(await listAssets(args.slug), null, 2);
        case "asset_upload": {
          const r = await uploadAsset(args.slug, args.name, args.dataUrl, args.alt);
          return (r.duplicate ? "asset already present: " : "asset added: ") + r.asset.path +
            (r.asset.width && r.asset.height ? " (" + r.asset.width + "x" + r.asset.height + ")" : "") +
            " — " + r.asset.bytes + " bytes";
        }
        case "asset_import": {
          const r = await uploadAssetFromPath(args.slug, args.sourcePath, args.name, args.alt);
          return (r.duplicate ? "asset already present: " : "asset imported: ") + r.asset.path +
            (r.asset.width && r.asset.height ? " (" + r.asset.width + "x" + r.asset.height + ")" : "") +
            " — " + r.asset.bytes + " bytes";
        }
        case "asset_delete": {
          const r = await deleteAsset(args.slug, args.path);
          return "asset removed: " + r.removed;
        }
        case "history": return JSON.stringify(await listHistory(args.slug), null, 2);
        case "snapshot_save": {
          const r = await captureHistory(args.slug, args.reason || "manual");
          return (r.duplicate ? "snapshot unchanged: " : "snapshot saved: ") + r.snapshot.id +
            " (#" + r.snapshot.seq + ", " + r.snapshot.files + " files, tree " + String(r.snapshot.tree).slice(0, 12) + ")";
        }
        case "snapshot_restore": {
          const r = await restoreHistory(args.slug, args.snapshotId);
          return "restored snapshot #" + r.seq + " (" + r.restored + ", " + r.files + " files, tree " + String(r.tree).slice(0, 12) + ")";
        }
        case "snapshot_undo": {
          const r = await undoHistory(args.slug);
          return "undid to snapshot #" + r.seq + " (" + r.restored + ", " + r.files + " files, tree " + String(r.tree).slice(0, 12) + ")";
        }
        case "style_list": {
          const l = await listStyles();
          return JSON.stringify({
            count: l.count,
            builtinCount: l.builtinCount,
            attribution: l.attribution,
            styles: l.styles.map((s) => ({ id: s.id, name: s.name, zh: s.zh, category: s.category, status: s.status, complexity: s.complexity, tag: s.tag, source: s.source })),
          }, null, 2);
        }
        case "style_apply": {
          const r = await applyStyleWithSnapshot(args.slug, args.styleId, args.fontMode);
          return "applied style " + r.applied + " (" + r.name + ") to " + args.slug + " — wrote " + r.tokenCss +
            (r.preserved ? "; preserved " + r.preserved + " design-specific tokens" : "");
        }
        case "style_save": {
          const r = await saveStyle(args.slug, args.name || args.styleId || "custom", args.description);
          return "saved custom style " + r.style.id + " (" + r.style.name + ") from " + args.slug;
        }
        case "style_delete": {
          const r = await deleteStyle(args.styleId);
          return "removed custom style: " + r.removed;
        }
        case "style_create": {
          const r = await createFromStyle(args.styleId, args.slug, execSessionId, args.fontMode);
          return "created design system " + r.slug + " from style " + r.styleId + " (" + r.name + "; full template)";
        }
        case "review": {
          const r = await visionReview(args);
          if (!r.ok) return "NO REVIEW: " + r.notes;
          return "VERDICT: " + (r.ok ? "GOOD" : "POOR") + " — " + r.notes + " (model: " + r.model + ", transport: " + (r.transport || "unknown") + ")";
        }
        case "config": {
          const cfg = await loadConfig();
          const keyConfigured = Boolean(await resolveKey());
          return JSON.stringify({ config: cfg, key: { configured: keyConfigured, ref: KEY_REF }, harnessOpenRouterRoute: harnessRouteAvailable(), harnessVision: await harnessVisionInfo(), agentPresets: await listAgentPresetOptions() }, null, 2);
        }
        default:
          throw new Error("unknown action: " + String(args.action));
      }
    },
  };

  if (tools !== undefined && tools.get("design_studio") === undefined) {
    ctx.effect(() => tools.register(tool));
  } else if (tools === undefined) {
    // No host-level tool registry in this composition (tools are session-scoped).
  } else {
    // Another mounted package already registered the identical tool; skip the duplicate.
  }
}

export { apply, inject, name };
