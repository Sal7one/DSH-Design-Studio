// @sal7one/dsh-design-studio — persistent Design Studio host for the DSH harness.
//
// What it owns (independent of the dynamic studio-2 plugin that renders the UI):
//   - the `design_studio` model tool (scaffold/read/write/zip/reveal design systems under
//     temp_design_folder/, identity-preset CRUD + apply, OpenRouter vision review GOOD|POOR)
//   - the /design-studio live-preview HTTP route
//   - a system-prompt section routing operator design briefs into the studio
// Coexistence: if the dynamic plugin already registered the same tool or route, registrations
// are skipped defensively (the handlers are identical).
//
// ZERO RUNTIME DEPENDENCIES on purpose: the tool definition below is plain
// JSON Schema (what dsh-tools' defineTool would generate), so this bundle
// imports nothing and installs/resolves the same way on the npm distribution
// (`npx @deepseek-ai/dsh`) and a source checkout — no workspace: links, no
// node_modules resolution from the plugin's own directory.
// (node:crypto below is a Node builtin, not a package dependency.)

import { randomUUID } from "node:crypto";

const name = "dsh-design-studio";
// fs + subprocess are the host-level capabilities; the old `shell` executor
// service moved into session presets in the current base, so shell semantics
// are built here on top of the subprocess seam (see sh()).
//
// The other services are HARD injects even though the code reads them via
// ctx.get(): apply runs as soon as its injections resolve, and a one-time
// ctx.get() taken before e.g. webServer (which waits on webStartup) exists
// returns undefined and silently skips the route/tool/section registration.
// Hard-injecting makes apply wait until every integration point exists.
const inject = ["fs", "subprocess", "webServer", "systemPrompt", "llm", "credentials", "attachments", "tools"];

const STUDIO_DIR = "temp_design_folder";
const KEY_REF = "OPENROUTER_API_KEY";
const VISION_COOLDOWN_MS = 10 * 60 * 1000;
const READ_CAP = 400 * 1024;
const IMAGE_CAP = 12 * 1024 * 1024;
const LOGO_CAP = 2 * 1024 * 1024;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

function apply(ctx) {
  const fs = ctx.fs;
  const subprocess = ctx.subprocess;
  const tools = ctx.get("tools");
  const webServer = ctx.get("webServer");
  const credentials = ctx.get("credentials");
  const llm = ctx.get("llm");
  const attachments = ctx.get("attachments");
  const systemPrompt = ctx.get("systemPrompt");

  const visionCooldown = new Map();
  const contextCache = new Map();

  let rootTarget = null;
  const root = async () => {
    if (rootTarget === null) rootTarget = await fs.resolve(STUDIO_DIR);
    return rootTarget;
  };
  const rootPath = async () => fs.processPath(await root());
  const isSlug = (s) => typeof s === "string" && SLUG_RE.test(s);

  function cleanRel(rel) {
    if (typeof rel !== "string") return null;
    if (rel.startsWith("/") || rel.includes("\\") || rel.includes("\0")) return null;
    const out = [];
    for (const p of rel.split("/")) {
      if (p === "" || p === ".") continue;
      if (p === "..") return null;
      out.push(p);
    }
    return out.length ? out.join("/") : null;
  }

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

  // Shell semantics on the subprocess seam (the session-scoped `shell`
  // executor no longer exists at host level). Runs the command string via
  // `sh -c` with bounded collected output, an abort-driven timeout, and a
  // result shape compatible with the previous shell.run() consumers:
  // { exitCode, signal, timedOut, stdout: {text, truncated}, stderr: {text, truncated} }.
  //
  // The shell is resolved through the platform's own resolveExecutable
  // (PATH lookup first, /bin/sh as a fallback) instead of hard-coding
  // /bin/sh — on hosts where /bin/sh is not directly spawnable this is the
  // difference between a working plugin and `spawn /bin/sh ENOENT`.
  let resolvedShell = null;

  async function resolveShell() {
    if (resolvedShell !== null) return resolvedShell;
    try {
      resolvedShell = await subprocess.resolveExecutable("sh");
    } catch (_) {
      resolvedShell = null;
    }
    if (resolvedShell === null) {
      try {
        resolvedShell = await subprocess.resolveExecutable("/bin/sh");
      } catch (_) {
        resolvedShell = null;
      }
    }
    if (resolvedShell === null) {
      throw new Error("no POSIX shell available on this host (sh is not on PATH and /bin/sh is missing) — this operation needs one");
    }
    return resolvedShell;
  }

  async function sh(request) {
    const timeoutMs = typeof request.timeoutMs === "number" && request.timeoutMs > 0
      ? Math.min(request.timeoutMs, 2147483000)
      : 120000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const shell = await resolveShell();
      const handle = subprocess.spawn({
        argv: [shell, "-c", request.command],
        cwd: typeof request.workdir === "string" ? request.workdir : await rootPath(),
        stdio: {
          stdin: typeof request.stdin === "string" ? { data: request.stdin } : "ignore",
          stdout: {
            maxBytes: typeof request.stdoutMaxBytes === "number" ? request.stdoutMaxBytes : 1024 * 1024,
            spill: { maxBytes: 16 * 1024 * 1024 },
          },
          stderr: {
            maxBytes: 1024 * 1024,
            spill: { maxBytes: 16 * 1024 * 1024 },
          },
        },
        graceMs: 5000,
        signal: controller.signal,
        env: request.env && typeof request.env === "object" ? request.env : undefined,
      });
      const outcome = await handle.done;
      const outReader = handle.collected.stdout;
      const errReader = handle.collected.stderr;
      const outRead = outReader ? outReader.readFrom(0) : { text: "", lossy: false };
      const errRead = errReader ? errReader.readFrom(0) : { text: "", lossy: false };
      return {
        exitCode: outcome.exitCode,
        signal: outcome.signal,
        timedOut: controller.signal.aborted,
        stdout: { text: outRead.text, truncated: outRead.lossy },
        stderr: { text: errRead.text, truncated: errRead.lossy },
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async function mkdirs(dirs) {
    if (!dirs || !dirs.length) return;
    const res = await sh({ command: "mkdir -p " + dirs.map((d) => JSON.stringify(d)).join(" "), workdir: await rootPath() });
    if (res.exitCode !== 0) throw new Error("mkdir failed: " + String((res.stderr && res.stderr.text) || "").trim());
  }

  function parentOf(rel) {
    const parts = rel.split("/");
    parts.pop();
    return parts.join("/");
  }

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

  function bytesToB64(bytes) {
    let s = "";
    const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(s);
  }

  // ---------- config ----------
  const DEFAULT_CONFIG = {
    codingModel: "deepseek-chat",
    visionModels: ["openai/gpt-4o-mini"],
    effort: "off",
    options: {
      baseUrl: "https://openrouter.ai/api/v1",
      temperature: 0,
      maxTokens: 512,
      providerRouting: true,
      quantizations: ["fp8", "bf16", "fp16", "fp32", "unknown"],
      onlyProviders: [],
      allowFallbacks: true,
      includeUsage: true,
      reasoningExclude: false,
    },
  };

  async function loadConfig() {
    const parsed = await readJson("_studio/config.json");
    if (!parsed || typeof parsed !== "object") return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    return {
      codingModel: typeof parsed.codingModel === "string" && parsed.codingModel.trim() ? parsed.codingModel : DEFAULT_CONFIG.codingModel,
      visionModels: Array.isArray(parsed.visionModels) && parsed.visionModels.length ? parsed.visionModels.map(String).filter(Boolean) : DEFAULT_CONFIG.visionModels.slice(),
      effort: ["off", "low", "medium", "high"].includes(parsed.effort) ? parsed.effort : DEFAULT_CONFIG.effort,
      options: Object.assign({}, DEFAULT_CONFIG.options, parsed.options && typeof parsed.options === "object" ? parsed.options : {}),
    };
  }

  async function resolveKey() {
    if (credentials === undefined) return null;
    try {
      const r = await credentials.resolve(KEY_REF);
      return r ? r.value : null;
    } catch (_) {
      return null;
    }
  }

  // ---------- per-system metadata: which conversation owns each design system ----------
  async function systemsMeta() {
    const parsed = await readJson("_studio/systems.json");
    return parsed && typeof parsed.systems === "object" ? parsed.systems : {};
  }

  async function systemsMetaSave(meta) {
    await writeJson("_studio/systems.json", { systems: meta });
  }

  // ---------- design stamp (freshness for the coding agent) ----------
  // Every write inside a design system bumps a random hash + ISO modified
  // date stored in the system meta (no history — latest status only). Both
  // agents see it through design_studio list/agent contexts, so the coding
  // agent can compare its remembered hash with the latest one.
  const stampLocks = new Map();

  let designRootAbs = null;
  ensureDesignRoot().catch(function () {});

  async function ensureDesignRoot() {
    designRootAbs = await rootPath();
  }

  function designSlugFor(absPath) {
    if (designRootAbs === null || typeof absPath !== "string") return null;
    const prefix = designRootAbs + "/";
    if (!absPath.startsWith(prefix)) return null;
    const seg = absPath.slice(prefix.length).split("/")[0];
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

  ctx.on("fs/observed", (target, observation, actor) => {
    if (actor === undefined) return; // actor-less observations record nothing useful
    try {
      const p = fs.processPath(target);
      const slug = designSlugFor(p);
      if (slug === null) return;
      const v = observation && observation.kind === "present" ? observation.version : "absent";
      const last = seenVersions.get(p);
      if (last !== undefined && last !== v) {
        bumpDesignStamp(slug).catch(function () {});
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
  });

  function liveSessionIds() {
    const sessions = ctx.get("sessions");
    try {
      if (sessions === undefined || typeof sessions.list !== "function") return null;
      const set = new Set();
      for (const s of sessions.list()) {
        if (s && s.id) set.add(String(s.id));
      }
      return set;
    } catch (_) {
      return null;
    }
  }

  // Shell-free, cross-platform recursive delete: the harness's own Node
  // performs fs.rmSync on absolute paths, so deletion works even on hosts
  // with no POSIX shell (the ENOENT machines).
  async function removePaths(paths) {
    if (!paths || !paths.length) return;
    const script =
      "const fs=require('node:fs');" +
      "let bad=false;" +
      "for(const p of process.argv.slice(1)){try{fs.rmSync(p,{recursive:true,force:true})}catch(e){console.error(p+': '+e.message);bad=true}}" +
      "if(bad)process.exit(1)";
    const handle = subprocess.spawn({
      argv: [process.execPath, "-e", script].concat(paths.map(String)),
      cwd: await rootPath(),
      stdio: {
        stdin: "ignore",
        stdout: { maxBytes: 4096, spill: { maxBytes: 65536 } },
        stderr: { maxBytes: 16384, spill: { maxBytes: 65536 } },
      },
      graceMs: 15000,
    });
    const outcome = await handle.done;
    const errReader = handle.collected.stderr;
    const errText = errReader ? errReader.readFrom(0).text : "";
    if (outcome.exitCode !== 0) throw new Error("remove failed: " + String(errText || "").trim());
  }

  async function deleteSystem(slug) {
    if (!isSlug(slug)) throw new Error("invalid slug");
    const sys = await resolveSystem(slug);
    if (!(await fs.stat(sys))) throw new Error("unknown design system: " + slug);
    const root = await rootPath();
    const zipT = await fs.resolve("_zips/" + slug + ".zip", { cwd: root });
    const reviewT = await fs.resolve("_studio/reviews/" + slug + ".json", { cwd: root });
    const agentT = await fs.resolve("_studio/agents/" + slug + ".json", { cwd: root });
    const requestT = await fs.resolve("_studio/requests/" + slug + ".json", { cwd: root });
    await removePaths([fs.processPath(sys), fs.processPath(zipT), fs.processPath(reviewT), fs.processPath(agentT), fs.processPath(requestT)]);
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
      out.push({ slug: e.name, sessionId: sysSessionId, orphan, createdAt: sysMeta.createdAt || null, stamp: sysMeta.stamp && typeof sysMeta.stamp === "object" ? { hash: String(sysMeta.stamp.hash || ""), at: String(sysMeta.stamp.at || "") } : null, count: files.length, hasPrompts, hasPreview, hasTokenCss, files });
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
    return { slug, created: true, sessionId: bound };
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

  async function zipSystem(slug) {
    const sys = await resolveSystem(slug);
    if (!(await fs.stat(sys))) throw new Error("unknown design system: " + slug);
    await mkdirs(["_zips"]);
    // Files only (find -type f): empty folders and .DS_Store never appear in the archive.
    const res = await sh({
      command: "find " + JSON.stringify(slug) + " -type f ! -name '.DS_Store' -print | zip -q -@ " + JSON.stringify("_zips/" + slug + ".zip"),
      workdir: await rootPath(),
      timeoutMs: 60000,
    });
    if (res.exitCode !== 0) throw new Error("zip failed: " + String((res.stderr && res.stderr.text) || "").trim());
    return { zip: STUDIO_DIR + "/_zips/" + slug + ".zip", slug };
  }

  async function revealZip(slug) {
    const zipRel = "_zips/" + slug + ".zip";
    const t = await fs.resolve(zipRel, { cwd: await rootPath() });
    if (!(await fs.stat(t))) throw new Error("no zip yet for " + slug + " — zip the design system first");
    const res = await sh({ command: "open -R " + JSON.stringify(fs.processPath(t)), timeoutMs: 15000 });
    if (res.exitCode !== 0) throw new Error("open failed: " + String((res.stderr && res.stderr.text) || "").trim());
    return { revealed: zipRel };
  }

  // ---------- presets ----------
  const PRESETS_DIR = "_presets";
  const COLOR_RE = /^(#[0-9a-fA-F]{3,8}|var\(--[\w-]+\)|[a-z]+)$/;

  async function listPresets() {
    const entries = await fs.listDir(await fs.resolve(PRESETS_DIR, { cwd: await rootPath() }));
    const out = [];
    for (const e of entries) {
      if (e.type !== "file" || !e.name.includes(".json")) continue;
      try {
        const p = JSON.parse(await fs.readText(e.target));
        out.push({
          id: p.id || e.name.replace(/\.json$/, ""), name: p.name || p.id || e.name.replace(/\.json$/, ""),
          colors: p.colors && typeof p.colors === "object" ? p.colors : {},
          logos: p.logos && typeof p.logos === "object" ? p.logos : {},
          fonts: p.fonts && typeof p.fonts === "object" ? p.fonts : {},
          radius: p.radius ?? null, spacing: p.spacing ?? null,
          components: p.components && typeof p.components === "object" ? p.components : {},
          version: typeof p.version === "number" ? p.version : 1,
        });
      } catch (err) {
        out.push({ id: e.name.replace(/\.json$/, ""), name: e.name.replace(/\.json$/, ""), error: "unreadable: " + String((err && err.message) || err) });
      }
    }
    out.sort((a, b) => (a.id < b.id ? -1 : 1));
    return out;
  }

  function renderTokenCss(p) {
    const c = p.colors || {};
    const f = p.fonts || {};
    const lines = ["/* GENERATED from identity preset: " + p.id + " (do not hand-edit; regenerate on apply) */", ":root {"];
    for (const k of ["bg", "panel", "panel2", "border", "text", "muted", "accent", "ok", "warn", "err", "info"]) {
      if (typeof c[k] === "string") lines.push("  --" + k + ": " + c[k] + ";");
    }
    if (typeof p.radius === "string") lines.push("  --radius: " + p.radius + ";");
    if (typeof p.spacing === "number") lines.push("  --space: " + p.spacing + "px;");
    if (typeof f.body === "string") lines.push("  --font-body: " + f.body + ";");
    if (typeof f.display === "string") lines.push("  --font-display: " + f.display + ";");
    if (typeof f.mono === "string") lines.push("  --font-mono: " + f.mono + ";");
    lines.push("}");
    return lines.join("\n") + "\n";
  }

  function validatePreset(p) {
    if (!p || typeof p !== "object") throw new Error("preset must be an object");
    if (typeof p.id !== "string" || !SLUG_RE.test(p.id)) throw new Error("preset id must match [a-z0-9][a-z0-9-]*");
    if (typeof p.name !== "string" || !p.name.trim()) throw new Error("preset name is required");
    if (!p.colors || typeof p.colors !== "object" || typeof p.colors.bg !== "string") throw new Error("preset needs at least colors.bg");
    for (const k of Object.keys(p.colors)) {
      if (typeof p.colors[k] !== "string" || !COLOR_RE.test(p.colors[k])) throw new Error("invalid color value for " + k);
    }
    if (p.radius !== undefined && p.radius !== null && typeof p.radius !== "string") throw new Error("radius must be a string (e.g. 12px)");
    if (p.spacing !== undefined && p.spacing !== null && typeof p.spacing !== "number") throw new Error("spacing must be a number (px)");
    return true;
  }

  async function savePreset(preset) {
    validatePreset(preset);
    const next = Object.assign({}, preset, { version: (typeof preset.version === "number" ? preset.version : 1) + 1 });
    await fs.writeText(await fs.resolve(PRESETS_DIR + "/" + preset.id + ".json", { cwd: await rootPath() }), JSON.stringify(next, null, 2));
    await fs.writeText(await fs.resolve(PRESETS_DIR + "/" + preset.id + ".token.css", { cwd: await rootPath() }), renderTokenCss(preset));
    return { id: next.id, name: next.name, version: next.version };
  }

  async function deletePreset(id) {
    if (!isSlug(id)) throw new Error("invalid preset id");
    const root = await rootPath();
    const jt = await fs.resolve(PRESETS_DIR + "/" + id + ".json", { cwd: root });
    const ct = await fs.resolve(PRESETS_DIR + "/" + id + ".token.css", { cwd: root });
    await removePaths([fs.processPath(jt), fs.processPath(ct)]);
    return { id, removed: true };
  }

  async function applyPreset(slug, presetId) {
    if (!isSlug(slug)) throw new Error("invalid slug");
    if (!isSlug(presetId)) throw new Error("invalid preset id");
    const pt = await fs.resolve(PRESETS_DIR + "/" + presetId + ".json", { cwd: await rootPath() });
    if (!(await fs.stat(pt))) throw new Error("unknown preset: " + presetId);
    const preset = JSON.parse(await fs.readText(pt));
    const sys = await resolveSystem(slug);
    if (!(await fs.stat(sys))) throw new Error("unknown design system: " + slug);
    const rp = fs.processPath(sys);
    await fs.writeText(await fs.resolve("css/token.css", { cwd: rp }), renderTokenCss(preset));
    const logos = preset.logos && typeof preset.logos === "object" ? preset.logos : {};
    const copied = [];
    const missing = [];
    const presetRoot = await fs.resolve(PRESETS_DIR, { cwd: await rootPath() });
    for (const k of Object.keys(logos)) {
      const srcRel = cleanRel(String(logos[k]));
      if (srcRel === null) { missing.push(k + " (bad path)"); continue; }
      const src = await fs.resolve(srcRel, { cwd: fs.processPath(presetRoot) });
      const s = await fs.stat(src);
      if (!s || s.type !== "file") { missing.push(k + " (" + srcRel + " not found in the preset store)"); continue; }
      const dstRel = "assets/logos/" + srcRel.split("/").pop();
      const bytes = await fs.readBytes(src, undefined, LOGO_CAP);
      const relFile = slug + "/" + dstRel;
      const parent = parentOf(relFile);
      if (parent) await mkdirs([parent]);
      const res = await sh({ command: "base64 -d > " + JSON.stringify(relFile), workdir: await rootPath(), stdin: bytesToB64(bytes), timeoutMs: 30000 });
      if (res.exitCode !== 0) missing.push(k + " (copy failed)");
      else copied.push(dstRel);
    }
    // token.css was overwritten above, so the design changed even with no logos.
    await bumpDesignStamp(slug).catch(function () {});
    return { slug, presetId, tokenCss: "css/token.css", copied, missing };
  }

  // ---------- vision review ----------
  function buildPrompt(brief) {
    return [
      "You are a STRICT mobile/web UI reviewer. The attached screenshot is the final screen of an app built to this brief:",
      '"""' + String(brief).slice(0, 900) + '"""', "",
      "Judge ONLY the visual quality against the brief. POOR if it looks like an unstyled/plain list, has no real",
      "colour or visual hierarchy, uses placeholder/lorem text, has overlapping/cut-off/misaligned elements, or is",
      "otherwise something a user would call ugly or broken. GOOD if it looks like a real, cleanly laid-out app that",
      "matches what was asked (e.g. uses cards/colour/spacing when the brief wanted that).", "",
      "Reply in EXACTLY this shape, nothing else:", "VERDICT: GOOD|POOR",
      "<one short sentence naming the specific visual strengths or problems you see>",
    ].join("\n");
  }

  function parseVisualVerdict(text) {
    const t = String(text || "").trim();
    const m = /verdict\s*[:\-]?\s*(good|poor|pass|fail)/i.exec(t);
    const token = (m ? m[1] : (/\bgood\b/i.test(t) && !/\bpoor\b/i.test(t) ? "good" : /\bpoor\b/i.test(t) ? "poor" : "")).toLowerCase();
    const ok = token === "good" || token === "pass";
    const notes = t.replace(/verdict\s*[:\-]?\s*(good|poor|pass|fail)\s*[.\-:—–]?/i, "").replace(/^[\s—–.:\-]+/, "").replace(/\s+/g, " ").trim().slice(0, 260);
    return { ok, notes: notes || (ok ? "looks acceptable" : "no specifics given") };
  }

  const MIME_BY_EXT = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml" };

  function harnessRouteAvailable() {
    if (llm === undefined || attachments === undefined) return false;
    try {
      return llm.listProviders().some((p) => p && p.id === "openrouter");
    } catch (_) {
      return false;
    }
  }

  function dataUrlToBytes(dataUrl) {
    const m = /^data:([^;,]+)?;base64,(.*)$/s.exec(dataUrl);
    if (!m) return null;
    let bin;
    try { bin = atob(m[2]); } catch (_) { return null; }
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function flattenContent(content, reasoning) {
    if (typeof content === "string") return content.trim() ? content : reasoning ? String(reasoning) : "";
    if (Array.isArray(content)) {
      const joined = content.map((c) => (c && typeof c === "object" && typeof c.text === "string" ? c.text : "")).join(" ");
      return joined.trim() ? joined : reasoning ? String(reasoning) : "";
    }
    return reasoning ? String(reasoning) : "";
  }

  async function reviewOnce(model, dataUrl, prompt, cfg, key) {
    const options = cfg.options || {};
    let ctxLen = contextCache.get(model);
    if (typeof ctxLen !== "number") {
      try {
        const base = String(options.baseUrl || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
        const tmp = "_studio/.tmp/m-" + Date.now() + ".json";
        const r = await sh({ command: "curl -sS -m 30 -o " + JSON.stringify(tmp) + " " + JSON.stringify(base + "/models/" + model) + ' -H "authorization: Bearer $DS_OR_KEY"', workdir: await rootPath(), timeoutMs: 40000, env: { DS_OR_KEY: key }, stdoutMaxBytes: 4096 });
        if (r.exitCode === 0) {
          const j = JSON.parse(await fs.readText(await fs.resolve(tmp, { cwd: await rootPath() })));
          const d = j && j.data;
          const n = d && (typeof d.context_length === "number" ? d.context_length : d.top_provider && typeof d.top_provider.context_length === "number" ? d.top_provider.context_length : null);
          if (typeof n === "number") ctxLen = n;
        }
        sh({ command: "rm -f " + JSON.stringify(tmp), workdir: await rootPath() }).catch(function () {});
      } catch (_) {}
    }
    const cap = typeof options.maxTokens === "number" && options.maxTokens > 0 ? options.maxTokens : 512;
    const fitted = typeof ctxLen === "number" && ctxLen > 0 ? Math.max(64, Math.min(cap, ctxLen - 8000)) : Math.min(cap, 8192);
    const body = {
      model, temperature: typeof options.temperature === "number" ? options.temperature : 0, max_tokens: fitted,
      messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: dataUrl } }] }],
    };
    if (options.includeUsage) body.include_usage = true;
    if (cfg.effort && cfg.effort !== "off") {
      body.reasoning = { effort: cfg.effort };
      if (options.reasoningExclude) body.reasoning.exclude = true;
    }
    if (options.providerRouting) {
      const routing = {
        sort: "throughput",
        quantizations: Array.isArray(options.quantizations) && options.quantizations.length ? options.quantizations : ["fp8", "bf16", "fp16", "fp32", "unknown"],
      };
      if (Array.isArray(options.onlyProviders) && options.onlyProviders.length) routing.only = options.onlyProviders;
      if (options.allowFallbacks === false) routing.allow_fallbacks = false;
      body.provider = routing;
    }
    const base = String(options.baseUrl || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
    const tmpBody = "_studio/.tmp/req-" + Date.now() + "-" + Math.floor(Math.random() * 1e6) + ".json";
    const tmpOut = tmpBody + ".out";
    try {
      await writeJson(tmpBody, body);
      const res = await sh({
        command: "curl -sS -m 120 -o " + JSON.stringify(tmpOut) + ' -w "%{http_code}" -X POST ' + JSON.stringify(base + "/chat/completions") +
          ' -H "content-type: application/json" -H "authorization: Bearer $DS_OR_KEY" --data-binary @"' + tmpBody + '"',
        workdir: await rootPath(), timeoutMs: 130000, env: { DS_OR_KEY: key }, stdoutMaxBytes: 4096,
      });
      if (res.exitCode !== 0 || res.timedOut) return { error: "curl failed (exit " + String(res.exitCode) + ")" };
      const status = parseInt(String((res.stdout && res.stdout.text) || "").trim(), 10) || 0;
      const outT = await fs.resolve(tmpOut, { cwd: await rootPath() });
      if (!(await fs.stat(outT))) return { error: "no response body" };
      const raw = await fs.readText(outT);
      if (status === 401 || status === 403) return { error: "auth failed (HTTP " + status + ") — check the OPENROUTER_API_KEY value", fatal: true };
      if (status === 429) return { error: "rate limited (HTTP 429)" };
      if (status >= 500) return { error: "provider error (HTTP " + status + ")" };
      if (status !== 200) return { error: "HTTP " + status + (raw ? ": " + String(raw).slice(0, 160) : "") };
      let rootJson;
      try { rootJson = JSON.parse(raw); } catch (_) { return { error: "non-JSON response" }; }
      const choice = rootJson.choices && rootJson.choices[0];
      const msg = choice && choice.message;
      const content = msg && typeof msg === "object" ? flattenContent(msg.content, msg.reasoning || msg.reasoning_content) : "";
      if (!content || !String(content).trim()) return { error: "empty model output" };
      return { content: String(content), model: rootJson.model || model, usage: rootJson.usage || null };
    } finally {
      sh({ command: "rm -f " + JSON.stringify(tmpBody) + " " + JSON.stringify(tmpOut), workdir: await rootPath() }).catch(function () {});
    }
  }

  async function visionReview(args) {
    try {
      const slug = args && args.slug;
      if (!isSlug(slug)) return { ok: false, notes: "invalid slug", model: null };
      const cfg = await loadConfig();
      const models = cfg.visionModels;
      if (!models.length) return { ok: false, notes: "no vision model configured", model: null };
      const key = await resolveKey();
      if (!key) return { ok: false, notes: "OpenRouter key not configured (credential reference OPENROUTER_API_KEY)", model: null };
      let dataUrl = null;
      const image = args && args.image;
      if (typeof image === "string" && image.startsWith("data:image/")) {
        if (image.length > IMAGE_CAP) return { ok: false, notes: "image too large (>12MB decoded)", model: null };
        dataUrl = image;
      } else if (typeof image === "string" && image.length) {
        const t = await resolveInSystem(slug, image);
        const info = await fs.stat(t);
        if (!info || info.type !== "file") return { ok: false, notes: "image not found: " + image, model: null };
        if ((info.size || 0) === 0) return { ok: false, notes: "image is empty (0 bytes): " + image + " — re-upload it", model: null };
        const bytes = await fs.readBytes(t, undefined, IMAGE_CAP);
        const ext = "." + (String(image).split(".").pop() || "png").toLowerCase();
        dataUrl = "data:" + (MIME_BY_EXT[ext] || "image/png") + ";base64," + bytesToB64(bytes);
      } else {
        return { ok: false, notes: "no image provided — drop a screenshot into the design system or pass an image path", model: null };
      }
      let brief = args && typeof args.brief === "string" && args.brief.trim() ? args.brief : slug;
      try {
        const t = await resolveInSystem(slug, "design_prompts_forcoders.md");
        const text = await fs.readText(t);
        brief = String(text).slice(0, 2000);
      } catch (_) {}
      const prompt = buildPrompt(brief);
      const now = Date.now();
      const hot = models.filter((m) => (visionCooldown.get(m) || 0) <= now);
      const tryList = hot.length ? hot : models;
      for (const m of tryList) {
        const r = await reviewOnce(m, dataUrl, prompt, cfg, key);
        if (r.error) {
          visionCooldown.set(m, Date.now() + VISION_COOLDOWN_MS);
          if (r.fatal) return { ok: false, notes: r.error, model: m, transport: "curl" };
          continue;
        }
        visionCooldown.delete(m);
        const verdict = parseVisualVerdict(r.content);
        const review = { slug, ok: verdict.ok, notes: verdict.notes, model: r.model, at: new Date().toISOString(), usage: r.usage, transport: "curl" };
        try { await writeJson("_studio/reviews/" + slug + ".json", review); } catch (_) {}
        return { ok: verdict.ok, notes: verdict.notes, model: r.model, transport: "curl", usage: r.usage };
      }
      return { ok: false, notes: "all vision models failed (cooling or unreachable): " + models.join(", "), model: null, transport: "curl" };
    } catch (err) {
      return { ok: false, notes: String((err && err.message) || err), model: null };
    }
  }

  // ---------- design agent chat (operator <-> design agent, persisted per system) ----------
  async function agentHistoryLoad(slug) {
    const parsed = await readJson("_studio/agents/" + slug + ".json");
    return parsed && Array.isArray(parsed.entries) ? parsed.entries : [];
  }

  // Per-slug tail promise: concurrent appends (live activity lines racing the
  // final reply) can never clobber each other — history writes are serialized.
  const historyLocks = new Map();

  async function agentHistoryAppend(slug, role, text) {
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

  async function describeAttachedImages(slug, mentioned, message) {
    if (!mentioned.length) return "";
    const cfg = await loadConfig();
    const key = await resolveKey();
    const notes = [];
    // One vision description PER image, written in the context of the operator's
    // request, so the child agent can't confuse the picker selection with
    // whatever image the design files already reference.
    for (const p of mentioned.slice(0, 2)) {
      let dataUrl = null;
      try {
        const t = await resolveInSystem(slug, p);
        const info = await fs.stat(t);
        if (info && info.type === "file") {
          if ((info.size || 0) === 0) {
            notes.push("- " + p + ": the file is empty (0 bytes) — say so and ask the operator to re-upload.");
            continue;
          }
          const bytes = await fs.readBytes(t, undefined, IMAGE_CAP);
          const ext = "." + (String(p).split(".").pop() || "png").toLowerCase();
          dataUrl = "data:" + (MIME_BY_EXT[ext] || "image/png") + ";base64," + bytesToB64(bytes);
        }
      } catch (_) {}
      if (dataUrl === null) {
        notes.push("- " + p + ": the file is not readable; say so and ask the operator to re-upload.");
        continue;
      }
      if (!key || !cfg.visionModels.length) {
        notes.push("- " + p + ": no vision model is configured, so you cannot see pixels; reason from the design files and say so.");
        continue;
      }
      const visPrompt = [
        'The design-studio operator is asking: """' + String(message || "").slice(0, 300) + '"""',
        "The attached image is " + p + " — the operator EXPLICITLY selected it in the studio image picker.",
        "Describe it FACTUALLY for a coding agent that cannot see it, in terms that help fulfil the request above: dominant background colors with hex approximations, accent colors, overall mood, layout zones (top to bottom), and anything to preserve (logos, patterns, text placement).",
        "Under 140 words, plain text, no markdown fences.",
      ].join("\n");
      let desc = null;
      let descModel = null;
      for (const m of cfg.visionModels) {
        const r = await textOnce(m, visPrompt, cfg, key, [dataUrl]);
        if (!r.error) {
          desc = r.content;
          descModel = r.model;
          break;
        }
      }
      notes.push("- " + p + (desc ? " (described by " + descModel + "): " + desc : ": the vision model could not describe it; reason from the design files and say so."));
    }
    return [
      "## The operator SELECTED these image(s) in the studio image picker this turn (in selection order):",
      notes.join("\n"),
      'When the operator says "the image", "this image", or "the background image" without a filename, they mean the FIRST selected image above — prefer it over any other asset already referenced in the files.',
    ].join("\n");
  }

  async function textOnce(model, prompt, cfg, key, imageUrls) {
    const options = cfg.options || {};
    const fitted = Math.min(options.maxTokens && options.maxTokens > 0 ? Math.min(options.maxTokens, 4096) : 900, 4096);
    const images = Array.isArray(imageUrls)
      ? imageUrls.filter((u) => typeof u === "string" && u.startsWith("data:image/")).slice(0, 3)
      : typeof imageUrls === "string" && imageUrls.startsWith("data:image/") ? [imageUrls] : [];
    const content = images.length
      ? [{ type: "text", text: prompt }].concat(images.map((u) => ({ type: "image_url", image_url: { url: u } })))
      : prompt;
    const body = {
      model,
      temperature: typeof options.temperature === "number" ? options.temperature : 0.3,
      max_tokens: Math.max(64, fitted),
      messages: [{ role: "user", content: content }],
    };
    if (options.includeUsage) body.include_usage = true;
    if (cfg.effort && cfg.effort !== "off") {
      body.reasoning = { effort: cfg.effort };
      if (options.reasoningExclude) body.reasoning.exclude = true;
    }
    if (options.providerRouting) {
      const routing = {
        sort: "throughput",
        quantizations: Array.isArray(options.quantizations) && options.quantizations.length ? options.quantizations : ["fp8", "bf16", "fp16", "fp32", "unknown"],
      };
      if (Array.isArray(options.onlyProviders) && options.onlyProviders.length) routing.only = options.onlyProviders;
      if (options.allowFallbacks === false) routing.allow_fallbacks = false;
      body.provider = routing;
    }
    const base = String(options.baseUrl || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
    const tmpBody = "_studio/.tmp/agent-" + Date.now() + "-" + Math.floor(Math.random() * 1e6) + ".json";
    const tmpOut = tmpBody + ".out";
    try {
      await writeJson(tmpBody, body);
      const res = await sh({
        command: "curl -sS -m 120 -o " + JSON.stringify(tmpOut) + ' -w "%{http_code}" -X POST ' + JSON.stringify(base + "/chat/completions") +
          ' -H "content-type: application/json" -H "authorization: Bearer $DS_OR_KEY" --data-binary @"' + tmpBody + '"',
        workdir: await rootPath(), timeoutMs: 130000, env: { DS_OR_KEY: key }, stdoutMaxBytes: 4096,
      });
      if (res.exitCode !== 0 || res.timedOut) return { error: "curl failed (exit " + String(res.exitCode) + ")" };
      const status = parseInt(String((res.stdout && res.stdout.text) || "").trim(), 10) || 0;
      const outT = await fs.resolve(tmpOut, { cwd: await rootPath() });
      if (!(await fs.stat(outT))) return { error: "no response body" };
      const raw = await fs.readText(outT);
      if (status === 401 || status === 403) return { error: "auth failed (HTTP " + status + ") — check the OPENROUTER_API_KEY value", fatal: true };
      if (status === 429) return { error: "rate limited (HTTP 429)" };
      if (status >= 500) return { error: "provider error (HTTP " + status + ")" };
      if (status !== 200) return { error: "HTTP " + status + (raw ? ": " + String(raw).slice(0, 160) : "") };
      let rootJson;
      try { rootJson = JSON.parse(raw); } catch (_) { return { error: "non-JSON response" }; }
      const choice = rootJson.choices && rootJson.choices[0];
      const msg = choice && choice.message;
      const contentOut = msg && typeof msg === "object" ? flattenContent(msg.content, msg.reasoning || msg.reasoning_content) : "";
      if (!contentOut || !String(contentOut).trim()) return { error: "empty model output" };
      return { content: String(contentOut), model: rootJson.model || model, usage: rootJson.usage || null };
    } finally {
      sh({ command: "rm -f " + JSON.stringify(tmpBody) + " " + JSON.stringify(tmpOut), workdir: await rootPath() }).catch(function () {});
    }
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
      // The child agent runs on the harness default model (text). When the
      // operator picks/mentions an image, a vision pre-pass on the operator's
      // configured vision model describes it (per image, in the context of the
      // request) so the child can act on it without guessing which asset is meant.
      const imageNotes = await describeAttachedImages(slug, mentioned, message.trim());

      // The UI passes its live conversation's sessionId explicitly; the design
      // system's stored owner is only the fallback (it can be stale).
      const callerSessionId = typeof args.sessionId === "string" && args.sessionId ? args.sessionId : null;
      const parent = findParentAgent(callerSessionId || (sysInfo ? sysInfo.sessionId : null));
      if (parent === null) return { ok: false, notes: "no live conversation agent in this process — make sure a conversation is open and try again", history: await agentHistoryLoad(slug) };
      const subagentsSvc = ctx.get("subagents");
      if (subagentsSvc === undefined || typeof subagentsSvc.start !== "function") return { ok: false, notes: "subagent service unavailable in this host", history: await agentHistoryLoad(slug) };
      const provider = pickSubagentProvider(subagentsSvc);
      if (provider === null) return { ok: false, notes: "no subagent provider registered in this harness (need the spawn/fork in-process provider)", history: await agentHistoryLoad(slug) };

      // Live activity: observe fs events inside the design system while the child works.
      const designRootPath = await rootPath();
      const absPrefix = designRootPath + "/" + slug + "/";
      fsListener = ctx.on("fs/observed", (target, observation) => {
        try {
          const p = fs.processPath(target);
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
      try {
        run = await subagentsSvc.start(provider, {
          label: "design-agent:" + slug,
          prompt: [{ type: "text", text: prompt }],
          parent,
          signal: controller.signal,
          persona: buildAgentPersona(slug),
        });
        const outcome = await Promise.race([
          run.result.then((r) => ({ kind: "result", value: r })),
          new Promise((resolve) => setTimeout(() => resolve({ kind: "timeout" }), runTimeoutMs)),
        ]);
        if (outcome.kind === "timeout") {
          await run.dispose().catch(function () {});
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
        return { ok: true, reply: text, model: "harness-" + provider + "-agent", history: finalHistory };
      } finally {
        clearTimeout(watchdog);
        if (run !== null) {
          run.dispose().catch(function () {});
        }
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

  async function keyInfo() {
    if (credentials === undefined) {
      return { supported: false, configured: false, source: null, writable: false, note: "credential service unavailable in this host" };
    }
    try {
      const info = await credentials.describe(KEY_REF);
      return { supported: true, configured: Boolean(info.configured), source: info.source || null, writable: Boolean(info.writable) };
    } catch (err) {
      return { supported: true, configured: false, source: null, writable: false, note: String((err && err.message) || "describe failed") };
    }
  }

  async function saveConfig(patch) {
    const cfg = await loadConfig();
    if (patch && typeof patch === "object") {
      if (patch.codingModel !== undefined) {
        if (typeof patch.codingModel !== "string" || !patch.codingModel.trim()) throw new Error("codingModel must be a non-empty string");
        cfg.codingModel = patch.codingModel.trim();
      }
      if (patch.visionModels !== undefined) {
        const list = Array.isArray(patch.visionModels)
          ? patch.visionModels.map(String).map((s) => s.trim()).filter(Boolean)
          : String(patch.visionModels).split(",").map((s) => s.trim()).filter(Boolean);
        if (!list.length) throw new Error("at least one vision model is required");
        cfg.visionModels = list;
      }
      if (patch.effort !== undefined) {
        if (!["off", "low", "medium", "high"].includes(patch.effort)) throw new Error("effort must be one of off|low|medium|high");
        cfg.effort = patch.effort;
      }
      if (patch.autoDeleteWithSession !== undefined) cfg.autoDeleteWithSession = Boolean(patch.autoDeleteWithSession);
      if (patch.options !== undefined && typeof patch.options === "object") {
        const o = patch.options;
        const n = cfg.options;
        if (o.baseUrl !== undefined) {
          const b = String(o.baseUrl).replace(/\/+$/, "");
          if (!/^https?:\/\//.test(b)) throw new Error("baseUrl must start with http(s)://");
          n.baseUrl = b;
        }
        if (o.temperature !== undefined) {
          const t = Number(o.temperature);
          if (!(t >= 0 && t <= 2)) throw new Error("temperature must be 0..2");
          n.temperature = t;
        }
        if (o.maxTokens !== undefined) {
          const m = Number(o.maxTokens);
          if (!(m >= 16 && m <= 128000)) throw new Error("maxTokens must be 16..128000");
          n.maxTokens = Math.floor(m);
        }
        if (o.providerRouting !== undefined) n.providerRouting = Boolean(o.providerRouting);
        if (o.quantizations !== undefined) n.quantizations = (Array.isArray(o.quantizations) ? o.quantizations : String(o.quantizations).split(",").map((s) => s.trim()).filter(Boolean)).map(String);
        if (o.onlyProviders !== undefined) n.onlyProviders = (Array.isArray(o.onlyProviders) ? o.onlyProviders : String(o.onlyProviders).split(",").map((s) => s.trim()).filter(Boolean)).map(String);
        if (o.allowFallbacks !== undefined) n.allowFallbacks = Boolean(o.allowFallbacks);
        if (o.includeUsage !== undefined) n.includeUsage = Boolean(o.includeUsage);
        if (o.reasoningExclude !== undefined) n.reasoningExclude = Boolean(o.reasoningExclude);
      }
    }
    await writeJson("_studio/config.json", cfg);
    return cfg;
  }

  function classifyFile(name, kind) {
    if (kind === "image") return "image";
    const ext = (String(name).split(".").pop() || "").toLowerCase();
    if (["png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "bmp", "avif"].includes(ext)) return "image";
    if (["txt", "csv", "log"].includes(ext)) return "text";
    return "code";
  }

  async function writeDataUrl(slug, dest, dataUrl) {
    const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
    if (!m) throw new Error("malformed data URL");
    const isB64 = m[2] === ";base64";
    const payload = m[3];
    if (isB64) {
      if (!payload || !payload.trim()) throw new Error("file is empty (no content received)");
      if (payload.length > IMAGE_CAP) throw new Error("file too large (>12MB decoded)");
      const relFile = slug + "/" + dest;
      const parent = parentOf(relFile);
      if (parent) await mkdirs([parent]);
      const res = await sh({ command: "base64 -d > " + JSON.stringify(relFile), workdir: await rootPath(), stdin: payload, timeoutMs: 30000 });
      if (res.exitCode !== 0) throw new Error("decode failed");
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
    lines.push("You are the primary editor (the main DeepSeek coding agent): apply the operator request by editing this design system's html/css/js (start at the target component, walk up the hierarchy if the request covers a row/section). Keep mock data honest. When you need vision or a screenshot you cannot take yourself, invoke the design agent (design_studio action agent with this slug) with a precise question and use its report. Then clear this request (design_studio selection_clear).");
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
    await removePaths([fs.processPath(t)]);
    await bumpDesignStamp(slug).catch(function () {});
    return { cleared: true };
  }

  async function captureScreenRegion(screen) {
    if (!screen || typeof screen !== "object") return { dataUrl: null, note: "no screen region provided" };
    const x = Math.round(Number(screen.x));
    const y = Math.round(Number(screen.y));
    const w = Math.round(Number(screen.w));
    const h = Math.round(Number(screen.h));
    if (!(w >= 40 && h >= 40) || !Number.isFinite(x + y + w + h)) return { dataUrl: null, note: "invalid screen region" };
    const tmp = "_studio/.tmp/shot-" + Date.now() + ".png";
    try {
      const res = await sh({ command: "screencapture -x -R " + x + "," + y + "," + w + "," + h + " " + JSON.stringify(tmp), workdir: await rootPath(), timeoutMs: 15000 });
      if (res.exitCode !== 0) return { dataUrl: null, note: "screencapture failed (exit " + res.exitCode + ")" };
      const t = await fs.resolve(tmp, { cwd: await rootPath() });
      const info = await fs.stat(t);
      if (!info || info.type !== "file" || !info.size) return { dataUrl: null, note: "screencapture produced no file" };
      const bytes = await fs.readBytes(t, undefined, IMAGE_CAP);
      return { dataUrl: "data:image/png;base64," + bytesToB64(bytes), w, h };
    } catch (err) {
      return { dataUrl: null, note: "screencapture unavailable: " + String((err && err.message) || err) };
    } finally {
      sh({ command: "rm -f " + JSON.stringify(tmp), workdir: await rootPath() }).catch(function () {});
    }
  }

  async function screenshotSystem(slug, screen) {
    if (!isSlug(slug)) throw new Error("invalid slug");
    const sys = await resolveSystem(slug);
    if (!(await fs.stat(sys))) throw new Error("unknown design system: " + slug);
    const cap = await captureScreenRegion(screen);
    if (!cap.dataUrl) throw new Error(cap.note);
    const dest = "assets/images/shot-" + Date.now() + ".png";
    const relFile = slug + "/" + dest;
    const parent = parentOf(relFile);
    if (parent) await mkdirs([parent]);
    const m = /^data:image\/png;base64,(.*)$/s.exec(cap.dataUrl);
    const res = await sh({ command: "base64 -d > " + JSON.stringify(relFile), workdir: await rootPath(), stdin: m[1], timeoutMs: 30000 });
    if (res.exitCode !== 0) throw new Error("screenshot write failed");
    await bumpDesignStamp(slug).catch(function () {});
    return { dest, w: cap.w, h: cap.h, source: "screen" };
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
  if (systemPrompt !== undefined) {
    systemPrompt.section({
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
        "   http://127.0.0.1:3080/design-studio/<slug>/html/index.html (the Design Studio tab shows it in an iframe when",
        "   the studio plugin is running in that session).",
        "Use design_studio actions: list, create, read, write, zip, presets, preset_save, preset_apply, preset_delete,",
        "review (vision review of a screenshot, returns GOOD|POOR), config (OpenRouter vision settings).",
      ].join("\n"),
    });
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
    switch (method) {
      case "studio.ping": return { studio: STUDIO_DIR, previewRoute: "/design-studio/<slug>/html/index.html" };
      case "studio.list": return await listSystems(a.sessionId);
      case "studio.create": return await createSystem(a.slug, typeof a.sessionId === "string" && a.sessionId ? a.sessionId : null);
      case "studio.sweep": return await sweepOrphans();
      case "studio.delete": return await deleteSystem(a.slug);
      case "studio.config": {
        let harness = null;
        if (llm !== undefined) {
          try {
            const providers = llm.listProviders();
            harness = { routeRegistered: providers.some((p) => p && p.id === "openrouter"), providers: providers.map((p) => (p && p.id) || null).filter(Boolean) };
          } catch (_) {
            harness = { routeRegistered: false, providers: [] };
          }
        }
        return { config: await loadConfig(), key: await keyInfo(), harness };
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
      case "studio.reveal": return await revealZip(a.slug);
      case "studio.agent": return await designAgentChat(a);
      case "studio.agent.history": return await agentHistoryLoad(a.slug);
      case "studio.agent.note": {
        if (!isSlug(a.slug)) throw new Error("invalid slug");
        if (!/^[a-z-]{1,20}$/.test(String(a.role || ""))) throw new Error("invalid role");
        return await agentHistoryAppend(a.slug, String(a.role), String(a.text || ""));
      }
      case "studio.review.get": return await readJson("_studio/reviews/" + a.slug + ".json");
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
        if (a.verifyAfter) armPostEditVerify(a.slug, a.request, a.sessionId);
        return r;
      }
      case "studio.selection.clear": return await clearEditRequest(a.slug);
      case "studio.screenshot": return await screenshotSystem(a.slug, a.screen);
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
        // The dynamic studio plugin (or another package) already owns the identical route.
        ctx.logger?.warn?.("dsh-design-studio: /design-studio route already registered; using the existing one:", String((err && err.message) || err));
        return () => {};
      }
    });
  }

  const tool = {
    name: "design_studio",
    description:
      "Manage the Design Studio under temp_design_folder/: list/create/read/write/zip design systems (html+css+js mockups), reveal the zip in Finder, CRUD identity presets (apply writes css/token.css + copies logo assets), chat with the design agent (a real harness subagent that lists, reads and edits the design files itself; persisted per-system history), persist the OpenRouter vision-model config, and run a vision review (image + brief -> honest GOOD|POOR verdict from the operator-chosen OpenRouter model). Writes are scoped to temp_design_folder/ design-system folders only. The OpenRouter key is a credential reference (OPENROUTER_API_KEY) and its value is never returned or rendered. VISION: you cannot see image pixels yourself — for ANY visual read of a design, a palette, a screenshot, or an asset in assets/images/, do not guess: use action review (one vision verdict + notes on an image) or action agent (the design agent, whose message may mention an asset filename and it gets a vision description of that image automatically); the design agent's reply comes back to you as this tool's result. DESIGN SYSTEMS ARE UI MOCKUPS ONLY: html + css + minimal presentation js — never full app or game logic (a tic-tac-toe design shows the board look, not playable rules); every create scaffolds a color palette + typography in css/token.css and design_prompts_forcoders.md. FRESHNESS STAMP: the list/all actions return each design system's stamp {hash, at} — a fresh random hash bumped on EVERY design change (no history, latest status only) with the last-modified ISO date. Before editing a design, run list and compare the hash with the one you remembered from your last edit; if it differs, someone else (design agent, operator, another session) changed the design since. OPERATOR⇄DESIGN-AGENT CHAT: the operator talks to the design agent through this tool (action agent; every message, activity line and reply is persisted per system). ALWAYS call action agent_history with the slug before concluding a design was reverted, broken, or missing a file — and before restoring or 'fixing' design files — so you see exactly what the operator asked and what the design agent did; the stamp in list/all tells you when the design last changed.",
    // Plain JSON Schema (what dsh-tools' defineTool generates from the typed
    // spec) so the bundle needs no runtime import.
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["list", "all", "create", "read", "write", "zip", "reveal", "presets", "preset_save", "preset_apply", "preset_delete", "review", "agent", "agent_history", "sweep", "delete", "config"], description: "Which studio operation to run." },
        slug: { type: "string", description: "Design-system slug (lowercase letters, digits, dashes), e.g. homelab-command-center." },
        path: { type: "string", description: "File path inside the design system, e.g. css/style.css." },
        content: { type: "string", description: "Full new file content for write." },
        preset: { type: "object", additionalProperties: true, description: "Preset JSON for preset_save: {id, name, colors:{bg,panel,panel2,border,text,muted,accent,ok,warn,err,info}, logos?{mark,wordmark,favicon}, fonts?{body,display,mono}, radius?\"12px\", spacing?16, components?{...}}." },
        presetId: { type: "string", description: "Preset id for preset_apply or preset_delete." },
        image: { type: "string", description: "For review: an image path inside the design system (e.g. assets/images/shot.png) or a data:image/...;base64 URL." },
        brief: { type: "string", description: "For review: optional brief override; defaults to the design system design_prompts_forcoders.md." },
        message: { type: "string", description: "For agent: the message to send to the design agent (a real harness subagent that lists/reads/edits the design files itself; multiple tool calls per message)." },
        images: { type: "array", items: { type: "string" }, description: "For agent: optional asset image paths to attach (e.g. [\"assets/images/shot-1.png\"]); explicitly selected images take priority over any other asset, and mentioning a filename in the message also auto-attaches it." },
        patch: { type: "object", additionalProperties: true, description: "For config: partial config patch {codingModel?, visionModels?[], effort?(\"off\"|\"low\"|\"medium\"|\"high\"), options?{baseUrl?, temperature?, maxTokens?, providerRouting?, quantizations?[], onlyProviders?[], allowFallbacks?, includeUsage?, reasoningExclude?}}." },
      },
      required: ["action"],
    },
    output: {
      schema: { type: "string" },
      render: (_args, value) => [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
    },
    async execute(args, exec) {
      const execSessionId = exec && exec.agent && exec.agent.sessionId ? String(exec.agent.sessionId) : null;
      switch (args.action) {
        case "list": {
          const systems = await listSystems(null);
          return JSON.stringify(systems.map((s) => ({
            slug: s.slug, sessionId: s.sessionId, orphan: s.orphan, files: s.count, hasPrompts: s.hasPrompts, hasPreview: s.hasPreview, hasTokenCss: s.hasTokenCss,
            stamp: s.stamp,
            images: s.files.filter((f) => f.path.startsWith("assets/images/") && (f.size || 0) > 0).map((f) => f.path),
          })), null, 2);
        }
        case "all": {
          const systems = await listSystems(null);
          return JSON.stringify(systems.map((s) => ({ slug: s.slug, sessionId: s.sessionId, orphan: s.orphan, createdAt: s.createdAt, files: s.count, hasPreview: s.hasPreview, stamp: s.stamp })), null, 2);
        }
        case "create": {
          const r = await createSystem(args.slug, execSessionId);
          return "created design system " + args.slug + " (html/css/js + design_prompts_forcoders.md; no empty folders)" + (r.sessionId ? " bound to this conversation (" + r.sessionId + ")" : " (no conversation binding)");
        }
        case "read": return (await readSystemFile(args.slug, args.path)).content;
        case "write": {
          const r = await writeSystemFile(args.slug, args.path, args.content);
          return "wrote " + r.bytes + " bytes to " + args.slug + "/" + r.path;
        }
        case "zip": return "zip written: " + (await zipSystem(args.slug)).zip + " (files only; empty folders excluded)";
        case "reveal": return "Finder opened for " + (await revealZip(args.slug)).revealed;
        case "agent": {
          const r = await designAgentChat(args);
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
        case "review": {
          const r = await visionReview(args);
          if (!r.ok) return "NO REVIEW: " + r.notes;
          return "VERDICT: " + (r.ok ? "GOOD" : "POOR") + " — " + r.notes + " (model: " + r.model + ", transport: " + (r.transport || "unknown") + ")";
        }
        case "config": {
          const cfg = await loadConfig();
          const keyConfigured = Boolean(await resolveKey());
          return JSON.stringify({ config: cfg, key: { configured: keyConfigured, ref: KEY_REF }, harnessOpenRouterRoute: harnessRouteAvailable() }, null, 2);
        }
        default:
          throw new Error("unknown action: " + String(args.action));
      }
    },
  };

  if (tools !== undefined && tools.get("design_studio") === undefined) {
    tools.register(tool);
  } else if (tools === undefined) {
    // No host-level tool registry in this composition (tools are session-scoped);
    // the dynamic studio plugin registers the identical tool for its session.
  } else {
    // The dynamic studio plugin already registered the identical tool; skip the duplicate.
  }
}

export { apply, inject, name };
