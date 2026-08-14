// Design Studio — HOST half (dynamic cordis plugin, plain JS)
// Interfaces used (all queried via cordis_inspect before writing):
//   fs (resolve/stat/readText/readBytes/listDir/writeText/processPath/contains)
//   subprocess (spawn) — shell semantics built in sh() with a SIGTERM→SIGKILL watchdog
//   credentials (describe/resolve/set/unset) — OpenRouter key, reference OPENROUTER_API_KEY
//   webServer (register, kind:'prefix', path:'/design-studio') — live-preview route
//   llm + attachments — harness provider seam (preferred for reviews when an openrouter route exists)
//   agents + subagents — the design agent is a REAL harness subagent (spawn provider)
//   harness (handle/defineTool/registerTool) — client RPC + the design_studio tool
// NOTE: the dynamic host sandbox exposes no AbortController, no timers, and no
// module imports — everything is plain JS against ctx + harness only.
return {
  // fs + subprocess are the host-level capabilities; the session-scoped
  // `shell` executor no longer exists at host level, so shell semantics are
  // built on the subprocess seam in sh(). The remaining services are hard
  // injects so apply never runs before its integration points exist.
  inject: ['fs', 'subprocess', 'webServer', 'credentials', 'llm', 'attachments', 'timer'],
  apply(ctx) {
    const fs = ctx.fs
    const subprocess = ctx.subprocess
    const credentials = ctx.get('credentials')
    const webServer = ctx.get('webServer')
    // The harness's own provider seam: when an 'openrouter' adapter route is registered
    // (the persistent dsh-openrouter composition package), vision reviews go through
    // ctx.llm.stream + ctx.attachments. Otherwise the plugin's curl client is the fallback —
    // and every review reports which transport it actually used.
    const llm = ctx.get('llm')
    const attachments = ctx.get('attachments')

    const STUDIO_DIR = 'temp_design_folder'
    const KEY_REF = 'OPENROUTER_API_KEY'
    const VISION_COOLDOWN_MS = 10 * 60 * 1000
    const READ_CAP = 400 * 1024
    const IMAGE_CAP = 12 * 1024 * 1024
    const LOGO_CAP = 2 * 1024 * 1024
    const visionCooldown = new Map() // model -> cooldown-until epoch ms
    const contextCache = new Map() // model -> OpenRouter context_length
    const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/

    let rootTarget = null
    const root = async () => {
      if (rootTarget === null) rootTarget = await fs.resolve(STUDIO_DIR)
      return rootTarget
    }
    const rootPath = async () => fs.processPath(await root())

    const isSlug = (s) => typeof s === 'string' && SLUG_RE.test(s)

    function cleanRel(rel) {
      if (typeof rel !== 'string') return null
      if (rel.startsWith('/') || rel.indexOf('\\') !== -1 || rel.indexOf('\0') !== -1) return null
      const out = []
      for (const p of rel.split('/')) {
        if (p === '' || p === '.') continue
        if (p === '..') return null
        out.push(p)
      }
      if (!out.length) return null
      return out.join('/')
    }

    async function resolveSystem(slug) {
      if (!isSlug(slug)) throw new Error('invalid slug: ' + String(slug))
      return await fs.resolve(slug, { cwd: await rootPath() })
    }

    async function resolveInSystem(slug, rel) {
      const r = cleanRel(rel)
      if (r === null) throw new Error('invalid path: ' + String(rel))
      const sys = await resolveSystem(slug)
      const target = await fs.resolve(r, { cwd: fs.processPath(sys) })
      if (!fs.contains(sys, target)) throw new Error('path escapes the design system')
      return target
    }

    // Shell semantics on the subprocess seam: /bin/sh -c with bounded
    // collected output and a shell.run()-compatible result shape.
    // NOTE: the dynamic host sandbox exposes no AbortController and no
    // timers, so this wrapper enforces NO timeout of its own. Instead every
    // command is wrapped in a shell-level watchdog that escalates
    // SIGTERM -> SIGKILL, so no RPC can hang forever.
    async function sh(request) {
      const watchdogSecs = typeof request.timeoutSecs === 'number' && request.timeoutSecs > 0 ? Math.floor(request.timeoutSecs) : 125
      const wrapped = '( ' + request.command + ' ) & cpid=$!; ( sleep ' + watchdogSecs + '; kill $cpid 2>/dev/null; sleep 2; kill -9 $cpid 2>/dev/null ) & wpid=$!; wait $cpid; rc=$?; kill $wpid 2>/dev/null; wait $wpid 2>/dev/null; exit $rc'
      const handle = subprocess.spawn({
        argv: ['/bin/sh', '-c', wrapped],
        cwd: typeof request.workdir === 'string' ? request.workdir : await rootPath(),
        stdio: {
          stdin: typeof request.stdin === 'string' ? { data: request.stdin } : 'ignore',
          stdout: {
            maxBytes: typeof request.stdoutMaxBytes === 'number' ? request.stdoutMaxBytes : 1024 * 1024,
            spill: { maxBytes: 16 * 1024 * 1024 },
          },
          stderr: {
            maxBytes: 1024 * 1024,
            spill: { maxBytes: 16 * 1024 * 1024 },
          },
        },
        graceMs: 5000,
        env: request.env && typeof request.env === 'object' ? request.env : undefined,
      })
      const outcome = await handle.done
      const outReader = handle.collected.stdout
      const errReader = handle.collected.stderr
      const outRead = outReader ? outReader.readFrom(0) : { text: '', lossy: false }
      const errRead = errReader ? errReader.readFrom(0) : { text: '', lossy: false }
      return {
        exitCode: outcome.exitCode,
        signal: outcome.signal,
        timedOut: false,
        stdout: { text: outRead.text, truncated: outRead.lossy },
        stderr: { text: errRead.text, truncated: errRead.lossy },
      }
    }

    async function mkdirs(dirs) {
      if (!dirs || !dirs.length) return
      const cmd = 'mkdir -p ' + dirs.map((d) => JSON.stringify(d)).join(' ')
      const res = await sh({ command: cmd, workdir: await rootPath() })
      if (res.exitCode !== 0) throw new Error('mkdir failed: ' + String((res.stderr && res.stderr.text) || '').trim())
    }

    function parentOf(rel) {
      const parts = rel.split('/')
      parts.pop()
      return parts.join('/')
    }

    async function writeJson(rel, value) {
      const parent = parentOf(rel)
      if (parent) await mkdirs([parent])
      const t = await fs.resolve(rel, { cwd: await rootPath() })
      await fs.writeText(t, JSON.stringify(value, null, 2))
    }

    async function readJson(rel) {
      const t = await fs.resolve(rel, { cwd: await rootPath() })
      const info = await fs.stat(t)
      if (!info) return null
      const raw = await fs.readText(t)
      try {
        return JSON.parse(raw)
      } catch (_) {
        return null
      }
    }

    function bytesToB64(bytes) {
      let s = ''
      const CH = 0x8000
      for (let i = 0; i < bytes.length; i += CH) {
        s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH))
      }
      return btoa(s)
    }

    // ---------- OpenRouter config (non-secret; the KEY lives only in the credentials seam) ----------
    const DEFAULT_CONFIG = {
      codingModel: 'deepseek-chat',
      visionModels: ['openai/gpt-4o-mini'],
      effort: 'off',
      autoDeleteWithSession: false,
      options: {
        baseUrl: 'https://openrouter.ai/api/v1',
        temperature: 0,
        maxTokens: 512,
        providerRouting: true,
        quantizations: ['fp8', 'bf16', 'fp16', 'fp32', 'unknown'],
        onlyProviders: [],
        allowFallbacks: true,
        includeUsage: true,
        reasoningExclude: false,
      },
    }

    async function loadConfig() {
      const parsed = await readJson('_studio/config.json')
      if (!parsed || typeof parsed !== 'object') return JSON.parse(JSON.stringify(DEFAULT_CONFIG))
      return {
        codingModel: typeof parsed.codingModel === 'string' && parsed.codingModel.trim() ? parsed.codingModel : DEFAULT_CONFIG.codingModel,
        visionModels: Array.isArray(parsed.visionModels) && parsed.visionModels.length ? parsed.visionModels.map(String).filter(Boolean) : DEFAULT_CONFIG.visionModels.slice(),
        effort: ['off', 'low', 'medium', 'high'].indexOf(parsed.effort) !== -1 ? parsed.effort : DEFAULT_CONFIG.effort,
        autoDeleteWithSession: parsed.autoDeleteWithSession === true,
        options: Object.assign({}, DEFAULT_CONFIG.options, parsed.options && typeof parsed.options === 'object' ? parsed.options : {}),
      }
    }

    async function saveConfig(patch) {
      const cfg = await loadConfig()
      if (patch && typeof patch === 'object') {
        if (patch.codingModel !== undefined) {
          if (typeof patch.codingModel !== 'string' || !patch.codingModel.trim()) throw new Error('codingModel must be a non-empty string')
          cfg.codingModel = patch.codingModel.trim()
        }
        if (patch.visionModels !== undefined) {
          const list = Array.isArray(patch.visionModels)
            ? patch.visionModels.map(String).map((s) => s.trim()).filter(Boolean)
            : String(patch.visionModels).split(',').map((s) => s.trim()).filter(Boolean)
          if (!list.length) throw new Error('at least one vision model is required')
          cfg.visionModels = list
        }
        if (patch.effort !== undefined) {
          if (['off', 'low', 'medium', 'high'].indexOf(patch.effort) === -1) throw new Error('effort must be one of off|low|medium|high')
          cfg.effort = patch.effort
        }
        if (patch.autoDeleteWithSession !== undefined) cfg.autoDeleteWithSession = Boolean(patch.autoDeleteWithSession)
        if (patch.options !== undefined && typeof patch.options === 'object') {
          const o = patch.options
          const n = cfg.options
          if (o.baseUrl !== undefined) {
            const b = String(o.baseUrl).replace(/\/+$/, '')
            if (!/^https?:\/\//.test(b)) throw new Error('baseUrl must start with http(s)://')
            n.baseUrl = b
          }
          if (o.temperature !== undefined) {
            const t = Number(o.temperature)
            if (!(t >= 0 && t <= 2)) throw new Error('temperature must be 0..2')
            n.temperature = t
          }
          if (o.maxTokens !== undefined) {
            const m = Number(o.maxTokens)
            if (!(m >= 16 && m <= 128000)) throw new Error('maxTokens must be 16..128000')
            n.maxTokens = Math.floor(m)
          }
          if (o.providerRouting !== undefined) n.providerRouting = Boolean(o.providerRouting)
          if (o.quantizations !== undefined) {
            n.quantizations = (Array.isArray(o.quantizations) ? o.quantizations : String(o.quantizations).split(',').map((s) => s.trim()).filter(Boolean)).map(String)
          }
          if (o.onlyProviders !== undefined) {
            n.onlyProviders = (Array.isArray(o.onlyProviders) ? o.onlyProviders : String(o.onlyProviders).split(',').map((s) => s.trim()).filter(Boolean)).map(String)
          }
          if (o.allowFallbacks !== undefined) n.allowFallbacks = Boolean(o.allowFallbacks)
          if (o.includeUsage !== undefined) n.includeUsage = Boolean(o.includeUsage)
          if (o.reasoningExclude !== undefined) n.reasoningExclude = Boolean(o.reasoningExclude)
        }
      }
      await writeJson('_studio/config.json', cfg)
      return cfg
    }

    async function keyInfo() {
      if (credentials === undefined) {
        return { supported: false, configured: false, source: null, writable: false, note: 'credential service unavailable in this host' }
      }
      try {
        const info = await credentials.describe(KEY_REF)
        return { supported: true, configured: Boolean(info.configured), source: info.source || null, writable: Boolean(info.writable) }
      } catch (err) {
        return { supported: true, configured: false, source: null, writable: false, note: String(err && err.message) || 'describe failed' }
      }
    }

    async function resolveKey() {
      if (credentials === undefined) return null
      try {
        const r = await credentials.resolve(KEY_REF)
        return r ? r.value : null
      } catch (_) {
        return null
      }
    }

    // ---------- per-system metadata: which conversation owns each design system ----------
    async function systemsMeta() {
      const parsed = await readJson('_studio/systems.json')
      if (!parsed || typeof parsed.systems !== 'object') return {}
      return parsed.systems
    }

    async function systemsMetaSave(meta) {
      await writeJson('_studio/systems.json', { systems: meta })
    }

    function liveSessionIds() {
      const sessions = ctx.get('sessions')
      try {
        if (sessions === undefined || typeof sessions.list !== 'function') return null
        const set = new Set()
        for (const s of sessions.list()) {
          if (s && s.id) set.add(String(s.id))
        }
        return set
      } catch (_) {
        return null
      }
    }

    function initiatorSessionId() {
      const agents = ctx.get('agents')
      try {
        const a = agents && typeof agents.currentInitiator === 'function' ? agents.currentInitiator() : undefined
        return a && a.sessionId ? String(a.sessionId) : null
      } catch (_) {
        return null
      }
    }

    async function deleteSystem(slug) {
      if (!isSlug(slug)) throw new Error('invalid slug')
      const sys = await resolveSystem(slug)
      const info = await fs.stat(sys)
      if (!info) throw new Error('unknown design system: ' + slug)
      const res = await sh({
        command:
          'rm -rf ' + JSON.stringify(slug) +
          ' && rm -f ' + JSON.stringify('_zips/' + slug + '.zip') +
          ' ' + JSON.stringify('_studio/reviews/' + slug + '.json') +
          ' ' + JSON.stringify('_studio/agents/' + slug + '.json') +
          ' ' + JSON.stringify('_studio/requests/' + slug + '.json'),
        workdir: await rootPath(),
        timeoutMs: 30000,
      })
      if (res.exitCode !== 0) throw new Error('delete failed: ' + String((res.stderr && res.stderr.text) || '').trim())
      const meta = await systemsMeta()
      delete meta[slug]
      await systemsMetaSave(meta)
      return { slug, removed: true }
    }

    async function sweepOrphans() {
      const cfg = await loadConfig()
      if (!cfg.autoDeleteWithSession) return { swept: [], note: 'auto-delete is OFF (default) — designs are kept even when their chat is deleted' }
      const liveIds = liveSessionIds()
      if (liveIds === null) return { swept: [], note: 'session store unavailable — sweep skipped (nothing deleted)' }
      const meta = await systemsMeta()
      const swept = []
      for (const slug of Object.keys(meta)) {
        const m = meta[slug] || {}
        if (typeof m.sessionId !== 'string' || !m.sessionId) continue
        if (liveIds.has(m.sessionId)) continue
        await deleteSystem(slug)
        swept.push(slug)
      }
      return { swept, note: swept.length ? 'deleted designs whose chat no longer exists' : 'no orphaned designs' }
    }

    // ---------- workspace: design systems ----------
    async function listSystems(filterSessionId) {
      await sweepOrphans().catch(function () {})
      const meta = await systemsMeta()
      const liveIds = liveSessionIds()
      const r = await root()
      const entries = await fs.listDir(r)
      const slugs = []
      for (const e of entries) {
        if (e.type !== 'directory') continue
        if (e.name === '_zips' || e.name === '_presets' || e.name === '_studio') continue
        if (e.name.indexOf('.') === 0) continue
        slugs.push(e.name)
      }
      slugs.sort()
      const out = []
      for (const slug of slugs) {
        const sysMeta = meta[slug] || {}
        let sysSessionId = typeof sysMeta.sessionId === 'string' && sysMeta.sessionId ? sysMeta.sessionId : null
        // One-time adoption: an unbound (legacy) design system joins the conversation that first
        // lists it, so every design system has exactly one owning chat and per-chat filtering is strict.
        if (sysSessionId === null && filterSessionId !== undefined && filterSessionId !== null) {
          sysSessionId = String(filterSessionId)
          meta[slug] = { sessionId: sysSessionId, createdAt: sysMeta.createdAt || new Date().toISOString() }
          await systemsMetaSave(meta)
        }
        if (filterSessionId !== undefined && filterSessionId !== null && sysSessionId !== String(filterSessionId)) continue
        const orphan = sysSessionId !== null && liveIds !== null && !liveIds.has(sysSessionId)
        const sys = await resolveSystem(slug)
        const files = []
        let hasPrompts = false
        let hasPreview = false
        let hasTokenCss = false
        async function walk(dirRel, target) {
          const kids = await fs.listDir(target)
          for (const k of kids) {
            const rel = dirRel ? dirRel + '/' + k.name : k.name
            if (k.type === 'directory') {
              await walk(rel, k.target)
            } else {
              files.push({ path: rel, size: k.size ?? null })
              if (rel === 'design_prompts_forcoders.md') hasPrompts = true
              if (rel === 'html/index.html') hasPreview = true
              if (rel === 'css/token.css') hasTokenCss = true
            }
          }
        }
        await walk('', sys)
        files.sort((a, b) => (a.path < b.path ? -1 : 1))
        out.push({ slug, sessionId: sysSessionId, orphan, createdAt: sysMeta.createdAt || null, count: files.length, hasPrompts, hasPreview, hasTokenCss, files })
      }
      return out
    }

    function indexTemplate(slug) {
      return [
        '<!doctype html>',
        '<html lang="en">',
        '<head>',
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<title>' + slug + '</title>',
        '<link rel="stylesheet" href="../css/style.css">',
        '<link rel="stylesheet" href="../css/token.css">',
        '</head>',
        '<body>',
        '<header class="topbar"><div class="title">' + slug + '</div><div class="subtitle">design mockup · read-only</div></header>',
        '<main id="main"></main>',
        '<script src="../js/app.js"></script>',
        '</body>',
        '</html>',
        '',
      ].join('\n')
    }

    const CSS_TEMPLATE = [
      ':root { color-scheme: dark; }',
      '* { box-sizing: border-box; }',
      'html, body { margin: 0; padding: 0; }',
      'body {',
      '  background: var(--bg, #0b0e14);',
      '  color: var(--text, #e6ebf5);',
      '  font-family: var(--font-body, system-ui, sans-serif);',
      '  font-size: 16px;',
      '  min-height: 100vh;',
      '}',
      '.topbar { display: flex; align-items: center; gap: 1rem; padding: 0.9rem 1.5rem;',
      '  border-bottom: 1px solid var(--border, #24304a); background: var(--panel, #141a26); }',
      '.title { font-size: 1.2rem; font-weight: 700; }',
      '.subtitle { font-size: 0.72rem; color: var(--muted, #8894ab); text-transform: uppercase; letter-spacing: 0.5px; }',
      'main { padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1rem; }',
      '.panel { background: var(--panel, #141a26); border: 1px solid var(--border, #24304a);',
      '  border-radius: var(--radius, 12px); padding: 1rem; }',
      '',
    ].join('\n')

    const JS_TEMPLATE = [
      '// ===== MOCK DATA — wire to real endpoints (see design_prompts_forcoders.md) =====',
      '(function () {',
      "  var main = document.getElementById('main');",
      "  main.innerHTML = '<div class=\"panel\">Nothing needs you. (Honest empty state — replace with the real screen per design_prompts_forcoders.md)</div>';",
      '})();',
      '',
    ].join('\n')

    // Starter palette + typography. Every design system owns its tokens; the
    // coding agent refines these per design_prompts_forcoders.md (Color palette / Typography).
    const DEFAULT_TOKEN_CSS = [
      '/* Generated scaffold — refine per design_prompts_forcoders.md (Color palette / Typography) */',
      ':root {',
      '  color-scheme: dark;',
      '  /* palette */',
      '  --bg: #0b0e14;',
      '  --panel: #141a26;',
      '  --panel2: #1c2434;',
      '  --border: #24304a;',
      '  --text: #e6ebf5;',
      '  --muted: #8894ab;',
      '  --accent: #4d8eff;',
      '  --ok: #34c77b;',
      '  --warn: #f2b64d;',
      '  --err: #ef5a6d;',
      '  --info: #5ab3f0;',
      '  /* typography */',
      '  --font-body: system-ui, -apple-system, sans-serif;',
      '  --font-display: system-ui, -apple-system, sans-serif;',
      '  --font-mono: ui-monospace, "SF Mono", Menlo, monospace;',
      '  --radius: 12px;',
      '  --space: 16px;',
      '}',
      '',
    ].join('\n')

    function promptsTemplate(slug) {
      return [
        '# design_prompts_forcoders — ' + slug,
        '',
        'Source of truth for this design: /user_need.md (the homelab custom dashboard spec).',
        'Data source for the service grid: /ops/service-index.json (generated by /scripts/gen-service-index.py).',
        'Identity preset applied: (none yet — apply one from Settings → Design Studio, which writes css/token.css).',
        '',
        '## Scope (NON-NEGOTIABLE)',
        '',
        'This is a UI MOCKUP, not an application. Build ONLY:',
        '- html/index.html — semantic structure of the screen (no inline logic)',
        '- css/style.css + css/token.css — visual design (palette, typography, layout)',
        '- js/app.js — MINIMAL presentation js only (render mock data, toggle tabs/states, show/hide)',
        '',
        'NEVER write app logic: no game engines or win/turn logic (e.g. a tic-tac-toe design shows',
        'the board LOOK, not playable rules), no state machines, no persistence, no business rules,',
        'no fetch calls. Interactive states are mocked visually or with trivial DOM toggling.',
        '',
        '## What this screen is',
        '',
        '<TBD — one sentence.>',
        '',
        '## Layout (top to bottom)',
        '',
        '<TBD>',
        '',
        '## Color palette (css/token.css)',
        '',
        'Define the palette here as --bg / --panel / --panel2 / --border / --text / --muted /',
        '--accent / --ok / --warn / --err / --info. Every component reads these tokens; never',
        'hardcode colors in style.css.',
        '',
        '<TBD — list the palette and where each color is used>',
        '',
        '## Typography (css/token.css)',
        '',
        'Define --font-body / --font-display / --font-mono plus a small type scale (sizes, weights).',
        'Describe where each style is used.',
        '',
        '<TBD>',
        '',
        '## Outline (structure of this design system)',
        '',
        '- html/index.html: <list the main sections/elements>',
        '- css/style.css: <list the component sections>',
        '- css/token.css: palette + typography tokens',
        '- js/app.js: <list the minimal presentation functions>',
        '',
        '## Data this screen needs (wire these; the mockup uses mock data in js/app.js)',
        '',
        '<TBD>',
        '',
        '## Non-negotiables (from user_need.md section 3)',
        '',
        '- Read-only projection; no client-side authority.',
        '- Honest empty states; never a fabricated number.',
        '- Never render secret VALUES (env var names only).',
        '- Consolidate, don\u2019t add a 7th surface.',
        '- Respect hardware constraints (M2 Pro / 16 GB, one phone, Mac sleeps, no LAN wildcard DNS).',
        '',
        '## Design language',
        '',
        '<TBD>',
        '',
      ].join('\n')
    }

    async function createSystem(slug, sessionId) {
      if (!isSlug(slug)) throw new Error('slug must match [a-z0-9][a-z0-9-]* (lowercase letters, digits, dashes)')
      const sys = await resolveSystem(slug)
      const info = await fs.stat(sys)
      if (info) throw new Error('design system already exists: ' + slug)
      // Only directories that will actually hold the scaffold files; empty asset/video/reference
      // folders are created on demand by ingest/preset-apply, so empty dirs never appear in output.
      await mkdirs([slug + '/html', slug + '/css', slug + '/js'])
      const rp = fs.processPath(sys)
      await fs.writeText(await fs.resolve('html/index.html', { cwd: rp }), indexTemplate(slug))
      await fs.writeText(await fs.resolve('css/style.css', { cwd: rp }), CSS_TEMPLATE)
      await fs.writeText(await fs.resolve('css/token.css', { cwd: rp }), DEFAULT_TOKEN_CSS)
      await fs.writeText(await fs.resolve('js/app.js', { cwd: rp }), JS_TEMPLATE)
      await fs.writeText(await fs.resolve('design_prompts_forcoders.md', { cwd: rp }), promptsTemplate(slug))
      const meta = await systemsMeta()
      const bound = typeof sessionId === 'string' && sessionId ? sessionId : null
      meta[slug] = { sessionId: bound, createdAt: new Date().toISOString() }
      await systemsMetaSave(meta)
      return { slug, created: true, sessionId: bound }
    }

    async function readSystemFile(slug, path) {
      const t = await resolveInSystem(slug, path)
      const info = await fs.stat(t)
      if (!info) throw new Error('not found: ' + path)
      if (info.type !== 'file') throw new Error('not a file: ' + path)
      const text = await fs.readText(t)
      if (text.length > READ_CAP) throw new Error('file too large to show (' + text.length + ' bytes)')
      return { path, content: text, bytes: text.length }
    }

    async function writeSystemFile(slug, path, content) {
      if (typeof content !== 'string') throw new Error('content must be a string')
      const r = cleanRel(path)
      if (r === null) throw new Error('invalid path: ' + String(path))
      const sys = await resolveSystem(slug)
      const t = await fs.resolve(r, { cwd: fs.processPath(sys) })
      if (!fs.contains(sys, t)) throw new Error('path escapes the design system')
      const parent = parentOf(r)
      if (parent) {
        const res = await sh({ command: 'mkdir -p ' + JSON.stringify(fs.processPath(sys) + '/' + parent) })
        if (res.exitCode !== 0) throw new Error('mkdir failed')
      }
      await fs.writeText(t, content)
      return { path: r, bytes: content.length }
    }

    async function zipSystem(slug) {
      const sys = await resolveSystem(slug)
      const info = await fs.stat(sys)
      if (!info) throw new Error('unknown design system: ' + slug)
      await mkdirs(['_zips'])
      // Zip only real files (find -type f), so empty folders (assets/images, assets/videos,
      // references, or an empty html/css/js) never appear in the archive; .DS_Store excluded.
      const res = await sh({
        command: 'find ' + JSON.stringify(slug) + " -type f ! -name '.DS_Store' ! -name 'EDIT_REQUEST.md' -print | zip -q -@ " + JSON.stringify('_zips/' + slug + '.zip'),
        workdir: await rootPath(),
        timeoutMs: 60000,
      })
      if (res.exitCode !== 0) throw new Error('zip failed: ' + String((res.stderr && res.stderr.text) || '').trim())
      return { zip: STUDIO_DIR + '/_zips/' + slug + '.zip', slug }
    }

    async function revealZip(slug) {
      if (!isSlug(slug)) throw new Error('invalid slug')
      const zipRel = '_zips/' + slug + '.zip'
      const t = await fs.resolve(zipRel, { cwd: await rootPath() })
      const info = await fs.stat(t)
      if (!info) throw new Error('no zip yet for ' + slug + ' — zip the design system first')
      const abs = fs.processPath(t)
      const res = await sh({ command: 'open -R ' + JSON.stringify(abs), timeoutMs: 15000 })
      if (res.exitCode !== 0) throw new Error('open failed: ' + String((res.stderr && res.stderr.text) || '').trim())
      return { revealed: zipRel }
    }

    // ---------- file drop-ins ----------
    function classifyFile(name, kind) {
      if (kind === 'image') return 'image'
      const ext = (String(name).split('.').pop() || '').toLowerCase()
      if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp', 'avif'].indexOf(ext) !== -1) return 'image'
      if (['txt', 'csv', 'log'].indexOf(ext) !== -1) return 'text'
      return 'code'
    }

    async function writeDataUrl(slug, dest, dataUrl) {
      const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl)
      if (!m) throw new Error('malformed data URL')
      const isB64 = m[2] === ';base64'
      const payload = m[3]
      if (isB64) {
        if (!payload || !payload.trim()) throw new Error('file is empty (no content received)')
        if (payload.length > IMAGE_CAP) throw new Error('file too large (>12MB decoded)')
        const relFile = slug + '/' + dest
        const parent = parentOf(relFile)
        if (parent) await mkdirs([parent])
        const res = await sh({
          command: 'base64 -d > ' + JSON.stringify(relFile),
          workdir: await rootPath(),
          stdin: payload,
          timeoutMs: 30000,
        })
        if (res.exitCode !== 0) throw new Error('decode failed')
      } else {
        await writeSystemFile(slug, dest, decodeURIComponent(payload))
      }
    }

    async function ingestFiles(slug, files) {
      if (!Array.isArray(files)) throw new Error('files must be an array')
      const sys = await resolveSystem(slug)
      const info = await fs.stat(sys)
      if (!info) throw new Error('unknown design system: ' + slug)
      const results = []
      for (const f of files) {
        const name = String((f && f.name) || '').replace(/[^A-Za-z0-9._-]/g, '_')
        if (!name) {
          results.push({ name: '(unnamed)', ok: false, error: 'empty file name' })
          continue
        }
        const rel = cleanRel(name)
        if (rel === null) {
          results.push({ name, ok: false, error: 'invalid file name' })
          continue
        }
        const kind = classifyFile(name, f && f.kind)
        const destDir = kind === 'image' ? 'assets/images' : 'references'
        const dest = destDir + '/' + rel
        try {
          if (f && typeof f.dataUrl === 'string' && f.dataUrl.indexOf('data:') === 0) {
            await writeDataUrl(slug, dest, f.dataUrl)
          } else if (f && typeof f.text === 'string') {
            if (!f.text.length) throw new Error('file is empty (no content received)')
            await writeSystemFile(slug, dest, f.text)
          } else {
            throw new Error('no content (need dataUrl or text)')
          }
          results.push({ name, ok: true, dest, kind })
        } catch (err) {
          results.push({ name, ok: false, error: String((err && err.message) || err) })
        }
      }
      return results
    }

    // ---------- identity presets ----------
    const PRESETS_DIR = '_presets'
    const COLOR_RE = /^(#[0-9a-fA-F]{3,8}|var\(--[\w-]+\)|[a-z]+)$/

    function summarizePreset(p, fileName) {
      return {
        id: (p && p.id) || String(fileName || '').replace(/\.json$/, ''),
        name: (p && p.name) || (p && p.id) || String(fileName || '').replace(/\.json$/, ''),
        colors: p && p.colors && typeof p.colors === 'object' ? p.colors : {},
        logos: p && p.logos && typeof p.logos === 'object' ? p.logos : {},
        fonts: p && p.fonts && typeof p.fonts === 'object' ? p.fonts : {},
        radius: p && p.radius !== undefined ? p.radius : null,
        spacing: p && p.spacing !== undefined ? p.spacing : null,
        components: p && p.components && typeof p.components === 'object' ? p.components : {},
        version: p && typeof p.version === 'number' ? p.version : 1,
      }
    }

    async function listPresets() {
      const t = await fs.resolve(PRESETS_DIR, { cwd: await rootPath() })
      const entries = await fs.listDir(t)
      const out = []
      for (const e of entries) {
        if (e.type !== 'file' || e.name.indexOf('.json') === -1) continue
        try {
          const raw = await fs.readText(e.target)
          out.push(summarizePreset(JSON.parse(raw), e.name))
        } catch (err) {
          out.push({ id: e.name.replace(/\.json$/, ''), name: e.name.replace(/\.json$/, ''), error: 'unreadable: ' + String((err && err.message) || err) })
        }
      }
      out.sort((a, b) => (a.id < b.id ? -1 : 1))
      return out
    }

    function validatePreset(p) {
      if (!p || typeof p !== 'object') throw new Error('preset must be an object')
      if (typeof p.id !== 'string' || !SLUG_RE.test(p.id)) throw new Error('preset id must match [a-z0-9][a-z0-9-]*')
      if (typeof p.name !== 'string' || !p.name.trim()) throw new Error('preset name is required')
      if (!p.colors || typeof p.colors !== 'object' || typeof p.colors.bg !== 'string') throw new Error('preset needs at least colors.bg')
      for (const k of Object.keys(p.colors)) {
        if (typeof p.colors[k] !== 'string' || !COLOR_RE.test(p.colors[k])) throw new Error('invalid color value for ' + k)
      }
      if (p.radius !== undefined && p.radius !== null && typeof p.radius !== 'string') throw new Error('radius must be a string (e.g. 12px)')
      if (p.spacing !== undefined && p.spacing !== null && typeof p.spacing !== 'number') throw new Error('spacing must be a number (px)')
      if (p.fonts !== undefined && p.fonts !== null && typeof p.fonts !== 'object') throw new Error('fonts must be an object')
      return true
    }

    function renderTokenCss(p) {
      const c = p.colors || {}
      const f = p.fonts || {}
      const lines = []
      lines.push('/* GENERATED from identity preset: ' + p.id + ' (do not hand-edit; regenerate on apply) */')
      lines.push(':root {')
      const colorKeys = ['bg', 'panel', 'panel2', 'border', 'text', 'muted', 'accent', 'ok', 'warn', 'err', 'info']
      for (const k of colorKeys) {
        if (typeof c[k] === 'string') lines.push('  --' + k + ': ' + c[k] + ';')
      }
      if (typeof p.radius === 'string') lines.push('  --radius: ' + p.radius + ';')
      if (typeof p.spacing === 'number') lines.push('  --space: ' + p.spacing + 'px;')
      if (typeof f.body === 'string') lines.push('  --font-body: ' + f.body + ';')
      if (typeof f.display === 'string') lines.push('  --font-display: ' + f.display + ';')
      if (typeof f.mono === 'string') lines.push('  --font-mono: ' + f.mono + ';')
      lines.push('}')
      return lines.join('\n') + '\n'
    }

    async function savePreset(preset) {
      validatePreset(preset)
      const next = Object.assign({}, preset, { version: (typeof preset.version === 'number' ? preset.version : 1) + 1 })
      const t = await fs.resolve(PRESETS_DIR + '/' + preset.id + '.json', { cwd: await rootPath() })
      await fs.writeText(t, JSON.stringify(next, null, 2))
      const cssT = await fs.resolve(PRESETS_DIR + '/' + preset.id + '.token.css', { cwd: await rootPath() })
      await fs.writeText(cssT, renderTokenCss(preset))
      return summarizePreset(next, preset.id + '.json')
    }

    async function deletePreset(id) {
      if (!isSlug(id)) throw new Error('invalid preset id')
      const res = await sh({
        command: 'rm -f ' + JSON.stringify(PRESETS_DIR + '/' + id + '.json') + ' ' + JSON.stringify(PRESETS_DIR + '/' + id + '.token.css'),
        workdir: await rootPath(),
      })
      if (res.exitCode !== 0) throw new Error('rm failed')
      return { id, removed: true }
    }

    async function applyPreset(slug, presetId) {
      if (!isSlug(slug)) throw new Error('invalid slug')
      if (!isSlug(presetId)) throw new Error('invalid preset id')
      const pt = await fs.resolve(PRESETS_DIR + '/' + presetId + '.json', { cwd: await rootPath() })
      const pinfo = await fs.stat(pt)
      if (!pinfo) throw new Error('unknown preset: ' + presetId)
      const preset = JSON.parse(await fs.readText(pt))
      const sys = await resolveSystem(slug)
      const sinfo = await fs.stat(sys)
      if (!sinfo) throw new Error('unknown design system: ' + slug)
      const rp = fs.processPath(sys)
      await fs.writeText(await fs.resolve('css/token.css', { cwd: rp }), renderTokenCss(preset))
      const logos = preset.logos && typeof preset.logos === 'object' ? preset.logos : {}
      const copied = []
      const missing = []
      const presetRoot = await fs.resolve(PRESETS_DIR, { cwd: await rootPath() })
      for (const k of Object.keys(logos)) {
        const srcRel = cleanRel(String(logos[k]))
        if (srcRel === null) {
          missing.push(k + ' (bad path)')
          continue
        }
        // Preset logo paths are relative to the preset store (_presets/), not the studio root.
        const src = await fs.resolve(srcRel, { cwd: fs.processPath(presetRoot) })
        const s = await fs.stat(src)
        if (!s || s.type !== 'file') {
          missing.push(k + ' (' + srcRel + ' not found in the preset store)')
          continue
        }
        const dstRel = 'assets/logos/' + srcRel.split('/').pop()
        const bytes = await fs.readBytes(src, undefined, LOGO_CAP)
        const relFile = slug + '/' + dstRel
        const parent = parentOf(relFile)
        if (parent) await mkdirs([parent])
        const res = await sh({
          command: 'base64 -d > ' + JSON.stringify(relFile),
          workdir: await rootPath(),
          stdin: bytesToB64(bytes),
          timeoutMs: 30000,
        })
        if (res.exitCode !== 0) {
          missing.push(k + ' (copy failed)')
        } else {
          copied.push(dstRel)
        }
      }
      return { slug, presetId, tokenCss: 'css/token.css', copied, missing }
    }

    // ---------- element selection → edit request (Select mode in the preview) ----------
    async function writeEditRequest(slug, selection, request) {
      if (!isSlug(slug)) throw new Error('invalid slug')
      const sys = await resolveSystem(slug)
      const info = await fs.stat(sys)
      if (!info) throw new Error('unknown design system: ' + slug)
      const sel = selection && typeof selection === 'object' ? selection : {}
      const lines = [
        '# Edit request — ' + slug,
        '',
        'Saved: ' + new Date().toISOString(),
        '',
        '## Target',
        '',
        '- tag: ' + (sel.tag || '?'),
        '- cssPath: ' + (sel.cssPath || '?'),
        '- classPath: ' + String(sel.classPath || ''),
        '- classes: ' + JSON.stringify(sel.classes || []),
        '- rect: ' + JSON.stringify(sel.rect || {}),
        '- text: ' + String(sel.text || ''),
        '- snippet:',
        '',
        '```html',
        String(sel.snippet || '').slice(0, 600),
        '```',
        '',
        '## Hierarchy (outermost → target)',
        '',
      ]
      for (const node of sel.hierarchy || []) {
        const name = node.tag + (node.id ? '#' + node.id : '') + (node.classes && node.classes.length ? '.' + node.classes.join('.') : '')
        lines.push('- ' + name + '  (' + node.cssPath + ')')
        lines.push('  styles: ' + JSON.stringify(node.styles || {}))
      }
      lines.push('', '## Styles (target)', '', '```json', JSON.stringify(sel.styles || {}, null, 2), '```', '')
      lines.push('## Operator request', '', request ? String(request) : '(none)', '')
      lines.push('## Instructions for the coding agent', '')
      lines.push('Apply the operator request by editing this design system\u2019s html/css/js (start at the target component, walk up the hierarchy if the request covers a row/section). Keep mock data honest. Then clear this request (design_studio selection_clear).')
      lines.push('')
      await writeSystemFile(slug, 'EDIT_REQUEST.md', lines.join('\n'))
      const hist = (await readJson('_studio/requests/' + slug + '.json')) || { slug, entries: [] }
      if (!Array.isArray(hist.entries)) hist.entries = []
      hist.entries.push({ at: new Date().toISOString(), request: String(request || ''), selection: sel })
      hist.entries = hist.entries.slice(-20)
      await writeJson('_studio/requests/' + slug + '.json', hist)
      return { path: slug + '/EDIT_REQUEST.md', request: String(request || '') }
    }

    async function clearEditRequest(slug) {
      if (!isSlug(slug)) throw new Error('invalid slug')
      const sys = await resolveSystem(slug)
      const info = await fs.stat(sys)
      if (!info) throw new Error('unknown design system: ' + slug)
      const res = await sh({ command: 'rm -f ' + JSON.stringify(slug + '/EDIT_REQUEST.md'), workdir: await rootPath() })
      if (res.exitCode !== 0) throw new Error('clear failed')
      return { cleared: true }
    }

    // ---------- vision review (OpenRouter) ----------
    function buildPrompt(brief) {
      return [
        'You are a STRICT mobile/web UI reviewer. The attached screenshot is the final screen of an app built to this brief:',
        '"""' + String(brief).slice(0, 900) + '"""',
        '',
        'Judge ONLY the visual quality against the brief. POOR if it looks like an unstyled/plain list, has no real',
        'colour or visual hierarchy, uses placeholder/lorem text, has overlapping/cut-off/misaligned elements, or is',
        'otherwise something a user would call ugly or broken. GOOD if it looks like a real, cleanly laid-out app that',
        'matches what was asked (e.g. uses cards/colour/spacing when the brief wanted that).',
        '',
        'Reply in EXACTLY this shape, nothing else:',
        'VERDICT: GOOD|POOR',
        '<one short sentence naming the specific visual strengths or problems you see>',
      ].join('\n')
    }

    function parseVisualVerdict(text) {
      const t = String(text || '').trim()
      const m = /verdict\s*[:\-]?\s*(good|poor|pass|fail)/i.exec(t)
      const token = (m ? m[1] : (/\bgood\b/i.test(t) && !/\bpoor\b/i.test(t) ? 'good' : /\bpoor\b/i.test(t) ? 'poor' : '')).toLowerCase()
      const ok = token === 'good' || token === 'pass'
      const notes = t
        .replace(/verdict\s*[:\-]?\s*(good|poor|pass|fail)\s*[.\-:—–]?/i, '')
        .replace(/^[\s—–.:\-]+/, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 260)
      return { ok, notes: notes || (ok ? 'looks acceptable' : 'no specifics given') }
    }

    function flattenContent(content, reasoning) {
      if (typeof content === 'string') {
        if (content.trim()) return content
        if (reasoning) return String(reasoning)
        return ''
      }
      if (Array.isArray(content)) {
        const parts = content.map((c) => (c && typeof c === 'object' && typeof c.text === 'string' ? c.text : ''))
        const joined = parts.join(' ')
        if (joined.trim()) return joined
        if (reasoning) return String(reasoning)
        return ''
      }
      return reasoning ? String(reasoning) : ''
    }

    // ---------- harness provider-seam vision path (preferred when the openrouter route exists) ----------
    function harnessRouteAvailable() {
      if (llm === undefined || attachments === undefined) return false
      try {
        return llm.listProviders().some((p) => p && p.id === 'openrouter')
      } catch (_) {
        return false
      }
    }

    function dataUrlToBytes(dataUrl) {
      const m = /^data:([^;,]+)?;base64,(.*)$/s.exec(dataUrl)
      if (!m) return null
      let bin
      try {
        bin = atob(m[2])
      } catch (_) {
        return null
      }
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      return bytes
    }

    async function harnessReviewOnce(model, dataUrl, prompt, cfg) {
      if (llm === undefined) return { error: 'llm service unavailable in this host' }
      if (attachments === undefined) return { error: 'attachment service unavailable in this host' }
      const bytes = dataUrlToBytes(dataUrl)
      if (bytes === null) return { error: 'image encoding not supported by the attachment seam' }
      const mimeMatch = /^data:([^;,]+)/.exec(dataUrl)
      const mime = mimeMatch ? mimeMatch[1] : ''
      if (['image/png', 'image/jpeg', 'image/webp', 'image/gif'].indexOf(mime) === -1) {
        return { error: 'media type not accepted by the attachment seam: ' + mime }
      }
      let ref
      try {
        ref = await attachments.saveImage({ data: bytes, mediaType: mime, name: 'design-studio-review' })
      } catch (err) {
        return { error: 'attachment saveImage rejected: ' + String((err && err.message) || err) }
      }
      let maxTokens = cfg.options && typeof cfg.options.maxTokens === 'number' && cfg.options.maxTokens > 0 ? cfg.options.maxTokens : 512
      try {
        const info = await llm.resolveModelInfo('openrouter', model)
        const ctxLen = info && info.context && typeof info.context.contextWindow === 'number' ? info.context.contextWindow : null
        if (ctxLen) maxTokens = Math.max(64, Math.min(maxTokens, ctxLen - 8000))
      } catch (_) {}
      const message = Object.freeze({
        id: 'ds-review-' + Date.now() + '-' + Math.floor(Math.random() * 1e6),
        role: 'user',
        content: Object.freeze([
          Object.freeze({ type: 'text', text: prompt }),
          Object.freeze({ type: 'image', attachment: ref }),
        ]),
        source: { kind: 'plugin', plugin: 'design-studio' },
      })
      const options = {
        provider: 'openrouter',
        model: model,
        messages: Object.freeze([message]),
        maxTokens: maxTokens,
      }
      if (cfg.options && typeof cfg.options.temperature === 'number') options.temperature = cfg.options.temperature
      if (cfg.effort && cfg.effort !== 'off') options.reasoningEffort = cfg.effort
      let text = ''
      let usage = null
      try {
        for await (const chunk of llm.stream(options)) {
          if (chunk.type === 'text-delta') {
            text += chunk.text
          } else if (chunk.type === 'block-end' && chunk.block && chunk.block.type === 'text') {
            text = chunk.block.text
          } else if (chunk.type === 'usage') {
            usage = chunk.usage
          } else if (chunk.type === 'finish' && chunk.reason && chunk.reason.kind === 'error') {
            const f = chunk.reason.failure
            return { error: 'stream error: ' + String((f && f.message) || (f && f.code) || 'unknown') }
          }
        }
      } catch (err) {
        return { error: 'stream failed: ' + String((err && err.message) || err) }
      }
      if (!text || !text.trim()) return { error: 'empty model output' }
      return { content: text, model: model, usage: usage }
    }

    async function tryHarnessReview(models, dataUrl, prompt, cfg) {
      const failures = []
      for (const m of models) {
        const r = await harnessReviewOnce(m, dataUrl, prompt, cfg)
        if (!r.error) return { result: r }
        failures.push(m + ': ' + r.error)
      }
      return {
        result: null,
        note: 'the harness openrouter route failed for every model (' + failures.join(' | ') + ') — fell back to the plugin curl client',
      }
    }

    async function learnContextLength(model, options, key) {
      if (!/^[A-Za-z0-9._\-/:]+$/.test(model)) return null
      const base = String((options && options.baseUrl) || 'https://openrouter.ai/api/v1').replace(/\/+$/, '')
      const tmp = '_studio/.tmp/m-' + Date.now() + '.json'
      try {
        const res = await sh({
          command: 'curl -sS -m 30 -o ' + JSON.stringify(tmp) + ' ' + JSON.stringify(base + '/models/' + model) + ' -H "authorization: Bearer $DS_OR_KEY"',
          workdir: await rootPath(),
          timeoutMs: 40000,
          env: { DS_OR_KEY: key },
          stdoutMaxBytes: 4096,
        })
        if (res.exitCode !== 0) return null
        const t = await fs.resolve(tmp, { cwd: await rootPath() })
        const info = await fs.stat(t)
        if (!info) return null
        const raw = await fs.readText(t)
        const j = JSON.parse(raw)
        const d = j && j.data
        const n = d && (typeof d.context_length === 'number' ? d.context_length : d.top_provider && typeof d.top_provider.context_length === 'number' ? d.top_provider.context_length : null)
        if (typeof n === 'number') {
          contextCache.set(model, n)
          return n
        }
        return null
      } catch (_) {
        return null
      } finally {
        sh({ command: 'rm -f ' + JSON.stringify(tmp), workdir: await rootPath() }).catch(function () {})
      }
    }

    async function fitMaxTokens(model, options, key) {
      let ctxLen = contextCache.get(model)
      if (typeof ctxLen !== 'number') {
        ctxLen = await learnContextLength(model, options, key)
      }
      const cap = options && typeof options.maxTokens === 'number' && options.maxTokens > 0 ? options.maxTokens : 512
      if (typeof ctxLen === 'number' && ctxLen > 0) {
        const reserved = 8000 // prompt + image + response headroom
        return Math.max(64, Math.min(cap, ctxLen - reserved))
      }
      return Math.min(cap, 8192) // honest fallback: the operator's cap, never a hardcoded model ceiling
    }

    async function reviewOnce(model, dataUrl, prompt, cfg, key) {
      const options = cfg.options || {}
      const fitted = await fitMaxTokens(model, options, key)
      const body = {
        model: model,
        temperature: typeof options.temperature === 'number' ? options.temperature : 0,
        max_tokens: fitted,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
      }
      if (options.includeUsage) body.include_usage = true
      if (cfg.effort && cfg.effort !== 'off') {
        body.reasoning = { effort: cfg.effort }
        if (options.reasoningExclude) body.reasoning.exclude = true
      }
      if (options.providerRouting) {
        const routing = {
          sort: 'throughput',
          quantizations: Array.isArray(options.quantizations) && options.quantizations.length ? options.quantizations : ['fp8', 'bf16', 'fp16', 'fp32', 'unknown'],
        }
        if (Array.isArray(options.onlyProviders) && options.onlyProviders.length) routing.only = options.onlyProviders
        if (options.allowFallbacks === false) routing.allow_fallbacks = false
        body.provider = routing
      }
      const base = String(options.baseUrl || 'https://openrouter.ai/api/v1').replace(/\/+$/, '')
      const tmpBody = '_studio/.tmp/req-' + Date.now() + '-' + Math.floor(Math.random() * 1e6) + '.json'
      const tmpOut = tmpBody + '.out'
      try {
        await writeJson(tmpBody, body)
        const cmd =
          'curl -sS -m 120 -o ' + JSON.stringify(tmpOut) +
          ' -w "%{http_code}" -X POST ' + JSON.stringify(base + '/chat/completions') +
          ' -H "content-type: application/json" -H "authorization: Bearer $DS_OR_KEY"' +
          ' --data-binary @"' + tmpBody + '"'
        const res = await sh({
          command: cmd,
          workdir: await rootPath(),
          timeoutMs: 130000,
          env: { DS_OR_KEY: key },
          stdoutMaxBytes: 4096,
        })
        if (res.exitCode !== 0 || res.timedOut || res.aborted) {
          return { error: 'curl failed (exit ' + String(res.exitCode) + (res.timedOut ? ', timed out' : '') + ')' }
        }
        const status = parseInt(String((res.stdout && res.stdout.text) || '').trim(), 10) || 0
        const outT = await fs.resolve(tmpOut, { cwd: await rootPath() })
        const outInfo = await fs.stat(outT)
        if (!outInfo) return { error: 'no response body' }
        const raw = await fs.readText(outT)
        if (status === 401 || status === 403) {
          return { error: 'auth failed (HTTP ' + status + ') — check the OPENROUTER_API_KEY value', fatal: true }
        }
        if (status === 429) return { error: 'rate limited (HTTP 429)' }
        if (status >= 500) return { error: 'provider error (HTTP ' + status + ')' }
        if (status !== 200) {
          const ctxMatch = /maximum context length is (\d+)/i.exec(raw)
          if (ctxMatch) contextCache.set(model, parseInt(ctxMatch[1], 10))
          return { error: 'HTTP ' + status + (raw ? ': ' + String(raw).slice(0, 160) : '') }
        }
        let rootJson
        try {
          rootJson = JSON.parse(raw)
        } catch (_) {
          return { error: 'non-JSON response' }
        }
        const choice = rootJson.choices && rootJson.choices[0]
        const msg = choice && choice.message
        const content = msg && typeof msg === 'object' ? flattenContent(msg.content, msg.reasoning || msg.reasoning_content) : ''
        if (!content || !String(content).trim()) return { error: 'empty model output' }
        return { content: String(content), model: rootJson.model || model, usage: rootJson.usage || null }
      } finally {
        try {
          await sh({ command: 'rm -f ' + JSON.stringify(tmpBody) + ' ' + JSON.stringify(tmpOut), workdir: await rootPath() })
        } catch (_) {}
      }
    }

    const MIME_BY_EXT = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
    }

    async function promptsBrief(slug) {
      try {
        const t = await resolveInSystem(slug, 'design_prompts_forcoders.md')
        const info = await fs.stat(t)
        if (!info) return slug
        const text = await fs.readText(t)
        return String(text).slice(0, 2000)
      } catch (_) {
        return slug
      }
    }

    async function readFileTextCapped(slug, path, cap) {
      try {
        const t = await resolveInSystem(slug, path)
        const info = await fs.stat(t)
        if (!info || info.type !== 'file') return ''
        const text = await fs.readText(t)
        return String(text).slice(0, cap)
      } catch (_) {
        return ''
      }
    }

    // ---------- outline (the design system structure agents see in the side panel) ----------
    function outlineItemsOf(rel, text) {
      const lines = String(text || '').split('\n')
      const items = []
      if (rel.indexOf('.html') !== -1) {
        for (const ln of lines) {
          const t = ln.trim()
          const h = /<(h[1-4])\b[^>]*>(.*?)<\/\1>/i.exec(t)
          if (h) {
            items.push({ kind: 'heading', label: h[1] + ' ' + String(h[2]).replace(/<[^>]*>/g, '').trim().slice(0, 60) })
            continue
          }
          const el = /<(section|header|main|footer|nav|aside|article|div|form|button|ul|table)\b[^>]*>/i.exec(t)
          if (el) {
            const id = /id="([^"]+)"/i.exec(el[0])
            const cls = /class="([^"]+)"/i.exec(el[0])
            const name = id ? '#' + id[1] : cls ? '.' + String(cls[1]).trim().split(/\s+/).join('.') : null
            if (name) items.push({ kind: 'element', label: el[1] + name })
          }
        }
      } else if (rel.indexOf('.css') !== -1) {
        for (const ln of lines) {
          const t = ln.trim()
          const cm = /\/\*\s*(.*?)\s*\*\//.exec(t)
          if (cm) {
            items.push({ kind: 'section', label: '§ ' + String(cm[1]).slice(0, 60) })
            continue
          }
          const sel = /^([.#][\w-]+|[a-z][\w-]*)\s*(?:,|{)/.exec(t)
          if (sel && t.indexOf('{') !== -1) items.push({ kind: 'selector', label: sel[1].slice(0, 60) })
        }
      } else {
        for (const ln of lines) {
          const t = ln.trim()
          const cm = /\/\/\s*(.*)$/.exec(t)
          if (cm) {
            items.push({ kind: 'section', label: '§ ' + String(cm[1]).slice(0, 60) })
            continue
          }
          const fn = /function\s+([\w$]+)\s*\(/.exec(t)
          if (fn) items.push({ kind: 'function', label: 'ƒ ' + fn[1] })
        }
      }
      return items.slice(0, 80)
    }

    async function outlineOfSystem(slug) {
      if (!isSlug(slug)) throw new Error('invalid slug')
      const systems = await listSystems(null)
      const sysInfo = systems.find((s) => s.slug === slug)
      if (!sysInfo) throw new Error('unknown design system: ' + slug)
      const sections = []
      for (const rel of ['html/index.html', 'css/token.css', 'css/style.css', 'js/app.js']) {
        const f = sysInfo.files.find((x) => x.path === rel)
        if (!f) continue
        const text = await readFileTextCapped(slug, rel, 400000)
        sections.push({ file: rel, items: outlineItemsOf(rel, text) })
      }
      return {
        slug,
        files: sysInfo.files.map((f) => ({ path: f.path, size: f.size })),
        sections,
      }
    }

    // ---------- apply design-agent guidance as real file edits ----------
    function extractJsonArray(text) {
      const t = String(text || '')
      const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(t)
      const body = fenced ? fenced[1] : t
      const start = body.indexOf('[')
      const end = body.lastIndexOf(']')
      if (start === -1 || end === -1 || end <= start) return null
      return body.slice(start, end + 1)
    }

    // Ask the design model for exact find/replace operations against the REAL
    // file contents, apply them via fs, and return an honest per-edit report.
    // This is what makes "Ask Design Agent" change the design instead of
    // handing the operator a block of text.
    async function applyAgentEdits(slug, guidance, selection) {
      if (!isSlug(slug)) throw new Error('invalid slug')
      if (typeof guidance !== 'string' || !guidance.trim()) throw new Error('no guidance to apply')
      const cfg = await loadConfig()
      const models = cfg.visionModels
      if (!models.length) return { applied: false, note: 'no model configured for applying edits' }
      const key = await resolveKey()
      if (!key) return { applied: false, note: 'OpenRouter key not configured — cannot apply edits' }
      const sel = selection && typeof selection === 'object' ? selection : null
      const files = {
        'html/index.html': await readFileTextCapped(slug, 'html/index.html', 60000),
        'css/style.css': await readFileTextCapped(slug, 'css/style.css', 60000),
        'css/token.css': await readFileTextCapped(slug, 'css/token.css', 30000),
        'js/app.js': await readFileTextCapped(slug, 'js/app.js', 60000),
      }
      const selCtx = sel ? [
        '## Operator selection context',
        '- selected element: ' + (sel.cssPath || sel.tag || '?'),
        '- classes: ' + (sel.classPath || '(none)') + (Array.isArray(sel.classes) && sel.classes.length ? ' (' + sel.classes.join(' ') + ')' : ''),
        '- element snippet (exactly as rendered):',
        '```html',
        String(sel.snippet || '').slice(0, 800),
        '```',
        '- parent chain (outermost → target): ' + (Array.isArray(sel.hierarchy) && sel.hierarchy.length ? sel.hierarchy.map((n) => n.tag + (n.id ? '#' + n.id : '') + (n.classes && n.classes.length ? '.' + n.classes.join('.') : '')).join(' > ') : '(unknown)'),
        '- selected element computed styles: ' + JSON.stringify(sel.styles || {}),
        '',
        'SCOPE: the operator selected ONE element, but the edit may also touch closely related markup and styles needed to make the change coherent. When REMOVING an element, also remove its now-empty wrapper, any background/border/tile styles that only served it, and related CSS rules — leaving a stray background tile behind is a failure. When restyling, adjust the matching rules. Never change unrelated sections, and keep this a UI MOCKUP (no app/game logic).',
      ].join('\n') : ''
      const prompt = [
        'You are the Design Studio APPLY step for design system "' + slug + '". The design agent already produced this guidance:',
        '"""' + String(guidance).slice(0, 3000) + '"""',
        selCtx,
        '',
        'Current REAL file contents:',
        '=== html/index.html ===',
        files['html/index.html'],
        '=== css/style.css ===',
        files['css/style.css'],
        '=== css/token.css ===',
        files['css/token.css'],
        '=== js/app.js ===',
        files['js/app.js'],
        '',
        'Apply the guidance to the files. Reply with ONLY a JSON array, nothing else:',
        '[{"file": "html/index.html", "find": "<exact substring that exists in the file>", "replace": "<replacement>"}, ...]',
        'Rules: "find" must be an EXACT verbatim substring of the current file (copy it character-for-character). Use the smallest unique find. To append a new rule, use the last line of the file as find and that line + new rule as replace. Keep this a UI MOCKUP (no app/game logic). Max 12 operations. If the guidance cannot be applied safely, return [].',
      ].join('\n')
      let reply = null
      let usedModel = null
      for (const m of models) {
        const r = await textOnce(m, prompt, cfg, key, undefined)
        if (!r.error) {
          reply = r.content
          usedModel = r.model
          break
        }
      }
      if (reply === null) return { applied: false, note: 'no model available to apply the edits' }
      const jsonText = extractJsonArray(reply)
      if (jsonText === null) return { applied: false, note: 'model did not return edit JSON (guidance kept in chat)' }
      let ops
      try {
        ops = JSON.parse(jsonText)
      } catch (_) {
        return { applied: false, note: 'model returned malformed edit JSON (guidance kept in chat)' }
      }
      if (!Array.isArray(ops)) return { applied: false, note: 'model returned a non-array edit payload' }
      const results = []
      let changed = 0
      for (const op of ops.slice(0, 12)) {
        const f = op && op.file
        if (!f || !Object.prototype.hasOwnProperty.call(files, f)) {
          results.push({ file: String(f || '?'), ok: false, note: 'unknown file' })
          continue
        }
        if (typeof op.find !== 'string' || typeof op.replace !== 'string') {
          results.push({ file: f, ok: false, note: 'bad operation' })
          continue
        }
        const current = files[f]
        if (op.find.length === 0) {
          results.push({ file: f, ok: false, note: 'empty find' })
          continue
        }
        if (current.indexOf(op.find) === -1) {
          results.push({ file: f, ok: false, note: 'find not found in file' })
          continue
        }
        const next = current.split(op.find).join(op.replace)
        await writeSystemFile(slug, f, next)
        files[f] = next
        changed++
        results.push({ file: f, ok: true, note: 'applied' })
      }
      const summary = results.map((r) => (r.ok ? '✓' : '✗') + ' ' + r.file + (r.note && r.note !== 'applied' ? ' (' + r.note + ')' : '')).join(' · ')
      return { applied: changed > 0, changed, model: usedModel, results, summary }
    }

    async function captureScreenRegion(screen) {
      if (!screen || typeof screen !== 'object') return { dataUrl: null, note: 'no screen region provided' }
      const x = Math.round(Number(screen.x))
      const y = Math.round(Number(screen.y))
      const w = Math.round(Number(screen.w))
      const h = Math.round(Number(screen.h))
      if (!(w >= 40 && h >= 40) || !Number.isFinite(x + y + w + h)) return { dataUrl: null, note: 'invalid screen region' }
      const tmp = '_studio/.tmp/shot-' + Date.now() + '.png'
      try {
        // Shell-level hard timeout (the dynamic sandbox has no JS timers):
        // if screencapture stalls (macOS permission dialog etc.) it is killed
        // after 15s instead of hanging the RPC forever.
        const cmd = '( screencapture -x -R ' + x + ',' + y + ',' + w + ',' + h + ' ' + JSON.stringify(tmp) + ' ) & cpid=$!; ( sleep 12; kill $cpid 2>/dev/null; sleep 2; kill -9 $cpid 2>/dev/null ) & wpid=$!; wait $cpid; rc=$?; kill $wpid 2>/dev/null; wait $wpid 2>/dev/null; exit $rc'
        const res = await sh({ command: cmd, workdir: await rootPath(), timeoutSecs: 20 })
        if (res.exitCode !== 0) return { dataUrl: null, note: 'screencapture failed (exit ' + res.exitCode + ')' }
        const t = await fs.resolve(tmp, { cwd: await rootPath() })
        const info = await fs.stat(t)
        if (!info || info.type !== 'file' || !info.size) return { dataUrl: null, note: 'screencapture produced no file' }
        const bytes = await fs.readBytes(t, undefined, IMAGE_CAP)
        return { dataUrl: 'data:image/png;base64,' + bytesToB64(bytes), w: w, h: h }
      } catch (err) {
        return { dataUrl: null, note: 'screencapture unavailable: ' + String((err && err.message) || err) }
      } finally {
        sh({ command: 'rm -f ' + JSON.stringify(tmp), workdir: await rootPath() }).catch(function () {})
      }
    }

    async function screenshotSystem(slug, screen) {
      if (!isSlug(slug)) throw new Error('invalid slug')
      const sys = await resolveSystem(slug)
      const info = await fs.stat(sys)
      if (!info) throw new Error('unknown design system: ' + slug)
      const cap = await captureScreenRegion(screen)
      if (!cap.dataUrl) throw new Error(cap.note)
      const dest = 'assets/images/shot-' + Date.now() + '.png'
      const relFile = slug + '/' + dest
      const parent = parentOf(relFile)
      if (parent) await mkdirs([parent])
      const m = /^data:image\/png;base64,(.*)$/s.exec(cap.dataUrl)
      const res = await sh({ command: 'base64 -d > ' + JSON.stringify(relFile), workdir: await rootPath(), stdin: m[1], timeoutMs: 30000 })
      if (res.exitCode !== 0) throw new Error('screenshot write failed')
      return { dest, w: cap.w, h: cap.h, source: 'screen' }
    }

    async function tryCurlReview(models, dataUrl, prompt, cfg, key) {
      const now = Date.now()
      const hot = models.filter((m) => (visionCooldown.get(m) || 0) <= now)
      const tryList = hot.length ? hot : models
      const skipped = hot.length && hot.length < models.length ? models.filter((m) => hot.indexOf(m) === -1) : []
      for (const m of tryList) {
        const r = await reviewOnce(m, dataUrl, prompt, cfg, key)
        if (r.error) {
          visionCooldown.set(m, Date.now() + VISION_COOLDOWN_MS)
          if (r.fatal) return { review: null, fatal: r.error, model: m, skipped }
          continue
        }
        visionCooldown.delete(m)
        return { review: r, model: m, skipped }
      }
      return { review: null, skipped }
    }

    async function visionReview(args) {
      const slug = args && args.slug
      try {
        if (!isSlug(slug)) return { ok: false, notes: 'invalid slug', model: null }
        const cfg = await loadConfig()
        const models = cfg.visionModels
        if (!models.length) return { ok: false, notes: 'no vision model configured (Settings → Design Studio)', model: null }
        const key = await resolveKey()
        if (!key) return { ok: false, notes: 'OpenRouter key not configured (credential reference OPENROUTER_API_KEY)', model: null }
        let dataUrl = null
        const image = args && args.image
        if (typeof image === 'string' && image.indexOf('data:image/') === 0) {
          if (image.length > IMAGE_CAP) return { ok: false, notes: 'image too large (>12MB decoded)', model: null }
          dataUrl = image
        } else if (typeof image === 'string' && image.length) {
          const t = await resolveInSystem(slug, image)
          const info = await fs.stat(t)
          if (!info || info.type !== 'file') return { ok: false, notes: 'image not found: ' + image, model: null }
          if ((info.size || 0) === 0) return { ok: false, notes: 'image is empty (0 bytes): ' + image + ' — re-upload it', model: null }
          const bytes = await fs.readBytes(t, undefined, IMAGE_CAP)
          const ext = '.' + (String(image).split('.').pop() || 'png').toLowerCase()
          const mime = MIME_BY_EXT[ext] || 'image/png'
          dataUrl = 'data:' + mime + ';base64,' + bytesToB64(bytes)
        } else {
          return { ok: false, notes: 'no image provided — drop a screenshot into the design system or pass an image path', model: null }
        }
        const brief = args && typeof args.brief === 'string' && args.brief.trim() ? args.brief : await promptsBrief(slug)
        const prompt = buildPrompt(brief)

        // Preferred path: the harness provider seam (ctx.llm + ctx.attachments) when an openrouter
        // adapter route is registered — the persistent dsh-openrouter composition package provides it.
        let harnessFallback = null
        if (harnessRouteAvailable()) {
          const hr = await tryHarnessReview(models, dataUrl, prompt, cfg)
          if (hr.result) {
            const verdict = parseVisualVerdict(hr.result.content)
            const review = { slug: slug, ok: verdict.ok, notes: verdict.notes, model: hr.result.model, at: new Date().toISOString(), usage: hr.result.usage, transport: 'harness-llm' }
            try {
              await writeJson('_studio/reviews/' + slug + '.json', review)
            } catch (_) {}
            return { ok: verdict.ok, notes: verdict.notes, model: hr.result.model, transport: 'harness-llm', usage: hr.result.usage }
          }
          harnessFallback = hr.note
        }

        // Fallback: the plugin's own curl client (works with only fs+shell+credentials, which are always queried).
        const cr = await tryCurlReview(models, dataUrl, prompt, cfg, key)
        if (cr.fatal) return { ok: false, notes: cr.fatal, model: cr.model, transport: 'curl', harnessFallback }
        if (cr.review) {
          const verdict = parseVisualVerdict(cr.review.content)
          const review = {
            slug: slug,
            ok: verdict.ok,
            notes: verdict.notes,
            model: cr.review.model,
            at: new Date().toISOString(),
            usage: cr.review.usage,
            transport: 'curl',
            harnessFallback,
          }
          try {
            await writeJson('_studio/reviews/' + slug + '.json', review)
          } catch (_) {}
          return { ok: verdict.ok, notes: verdict.notes, model: cr.review.model, transport: 'curl', harnessFallback, coolingSkipped: cr.skipped, usage: cr.review.usage }
        }
        return {
          ok: false,
          notes: 'all vision models failed (cooling or unreachable): ' + models.join(', '),
          model: null,
          transport: 'curl',
          harnessFallback,
          coolingSkipped: cr.skipped,
        }
      } catch (err) {
        return { ok: false, notes: String((err && err.message) || err), model: null }
      }
    }

    // ---------- design agent chat (operator <-> design model, persisted per system) ----------
    async function agentHistoryLoad(slug) {
      const parsed = await readJson('_studio/agents/' + slug + '.json')
      if (!parsed || !Array.isArray(parsed.entries)) return []
      return parsed.entries
    }

    const historyLocks = new Map() // slug -> tail promise; serializes concurrent appends

    async function agentHistoryAppend(slug, role, text) {
      const prev = historyLocks.get(slug) || Promise.resolve()
      const next = prev.then(async () => {
        const history = await agentHistoryLoad(slug)
        history.push({ role, text: String(text).slice(0, 4000), at: new Date().toISOString() })
        const capped = history.slice(-50)
        await writeJson('_studio/agents/' + slug + '.json', { slug, entries: capped })
        return capped
      })
      historyLocks.set(slug, next.catch(function () {}))
      return next
    }

    // The design agent is a REAL harness subagent: it runs on the harness agent
    // engine (default model route, deployment coding tools + design_studio), so
    // it can list/read/edit the design files and take MULTIPLE tool calls per
    // operator message. No custom model client, no harness-in-harness.
    function findParentAgent(ownerSessionId) {
      const agentsSvc = ctx.get('agents')
      if (agentsSvc === undefined) return null
      try {
        const init = typeof agentsSvc.currentInitiator === 'function' ? agentsSvc.currentInitiator() : undefined
        if (init && init.id) return init
      } catch (_) {}
      let list = []
      try {
        list = typeof agentsSvc.list === 'function' ? agentsSvc.list() : []
      } catch (_) {}
      if (ownerSessionId) {
        const match = list.find((a) => a && a.id && String(a.id) === String(ownerSessionId))
        if (match) return match
      }
      if (list.length === 1) return list[0]
      let roots = []
      try {
        roots = typeof agentsSvc.roots === 'function' ? agentsSvc.roots() : []
      } catch (_) {}
      if (roots.length === 1) return roots[0]
      return null
    }

    function pickSubagentProvider(subagentsSvc) {
      let names = []
      try {
        names = typeof subagentsSvc.list === 'function' ? subagentsSvc.list() : []
      } catch (_) {}
      if (names.indexOf('spawn') !== -1) return 'spawn'
      if (names.indexOf('fork') !== -1) return 'fork'
      return names.length ? names[0] : null
    }

    // The dynamic host sandbox exposes no AbortController; the in-process driver
    // only uses signal.aborted / addEventListener / removeEventListener, so a
    // never-aborting stand-in satisfies it. A wall-clock race on the harness
    // timer service + run.dispose() provides the real timeout.
    function neverSignal() {
      return { aborted: false, addEventListener() {}, removeEventListener() {} }
    }

    function buildAgentPersona(slug) {
      return [
        'You are the Design Studio design agent for design system "' + slug + '".',
        'The design system is a UI MOCKUP ONLY: html + css + minimal presentation js. Never introduce app or game logic (a tic-tac-toe design shows the board LOOK, not playable rules), no state machines, no persistence, no business rules, no fetch calls. Interactive states are mocked visually or with trivial DOM toggling.',
        'You have file tools and the design_studio tool. The operator sends you design requests. ACT ON THEM: list files (design_studio action list), read the relevant files, then edit them yourself with your file tools (prefer targeted edits over full rewrites), and keep working until the change is coherent — you may take multiple tool calls per message. After editing, reply with a short summary of exactly what you changed and why (file-level, under 250 words).',
        'Read design_prompts_forcoders.md first when a request changes structure or palette. All colors must go through css/token.css tokens; never hardcode colors in style.css.',
        'Mock data must stay honest: empty/loading states, never fabricated live numbers, never real secrets.',
      ].join('\n')
    }

    function buildAgentPrompt(slug, message, history, brief, treeLines, filesText, imageNotes, designRootPath) {
      const recent = history
        .slice(0, -1)
        .slice(-6)
        .map((e) => (e.role === 'operator' ? 'Operator' : e.role === 'coding-agent' ? 'Coding agent' : e.role === 'review' ? 'Review' : e.role === 'activity' ? '' : 'Design agent') + (e.role === 'activity' ? '' : ': ') + e.text)
        .filter((s) => s.length)
        .join('\n')
      return [
        'Design system: "' + slug + '" — absolute path: ' + designRootPath + '/' + slug,
        '',
        'Design brief (design_prompts_forcoders.md):',
        '"""' + String(brief).slice(0, 1200) + '"""',
        '',
        '## Current design tree (the REAL files on disk):',
        (treeLines && treeLines.length ? treeLines.join('\n') : '(no files yet)'),
        '',
        '## Key file contents (truncated):',
        (filesText || '(no files yet)'),
        '',
        imageNotes || '## Uploaded images: none attached this turn (mention a filename to attach one).',
        '',
        'Recent conversation:',
        recent || '(none yet)',
        '',
        'Operator message:',
        '"""' + String(message).slice(0, 2000) + '"""',
        '',
        'Work the request with your tools: inspect, edit, verify, then reply with a concise summary of the changes. If a change needs information you cannot get from the files, say so honestly instead of guessing.',
      ].join('\n')
    }

    async function describeAttachedImages(slug, mentioned, message) {
      if (!mentioned.length) return ''
      const cfg = await loadConfig()
      const key = await resolveKey()
      const notes = []
      // One vision description PER image, written in the context of the operator's
      // request, so the child agent can't confuse the picker selection with
      // whatever image the design files already reference.
      for (const p of mentioned.slice(0, 2)) {
        let dataUrl = null
        try {
          const t = await resolveInSystem(slug, p)
          const info = await fs.stat(t)
          if (info && info.type === 'file') {
            if ((info.size || 0) === 0) {
              notes.push('- ' + p + ': the file is empty (0 bytes) — say so and ask the operator to re-upload.')
              continue
            }
            const bytes = await fs.readBytes(t, undefined, IMAGE_CAP)
            const ext = '.' + (String(p).split('.').pop() || 'png').toLowerCase()
            const mime = MIME_BY_EXT[ext] || 'image/png'
            dataUrl = 'data:' + mime + ';base64,' + bytesToB64(bytes)
          }
        } catch (_) {}
        if (dataUrl === null) {
          notes.push('- ' + p + ': the file is not readable; say so and ask the operator to re-upload.')
          continue
        }
        if (!key || !cfg.visionModels.length) {
          notes.push('- ' + p + ': no vision model is configured, so you cannot see pixels; reason from the design files and say so.')
          continue
        }
        const visPrompt = [
          'The design-studio operator is asking: """' + String(message || '').slice(0, 300) + '"""',
          'The attached image is ' + p + ' — the operator EXPLICITLY selected it in the studio image picker.',
          'Describe it FACTUALLY for a coding agent that cannot see it, in terms that help fulfil the request above: dominant background colors with hex approximations, accent colors, overall mood, layout zones (top to bottom), and anything to preserve (logos, patterns, text placement).',
          'Under 140 words, plain text, no markdown fences.',
        ].join('\n')
        let desc = null
        let descModel = null
        for (const m of cfg.visionModels) {
          const r = await textOnce(m, visPrompt, cfg, key, [dataUrl])
          if (!r.error) {
            desc = r.content
            descModel = r.model
            break
          }
        }
        notes.push('- ' + p + (desc ? ' (described by ' + descModel + '): ' + desc : ': the vision model could not describe it; reason from the design files and say so.'))
      }
      return [
        '## The operator SELECTED these image(s) in the studio image picker this turn (in selection order):',
        notes.join('\n'),
        'When the operator says "the image", "this image", or "the background image" without a filename, they mean the FIRST selected image above — prefer it over any other asset already referenced in the files.',
      ].join('\n')
    }

    async function textOnce(model, prompt, cfg, key, imageUrls) {
      const options = cfg.options || {}
      const fitted = Math.min(options.maxTokens && options.maxTokens > 0 ? Math.min(options.maxTokens, 4096) : 900, 4096)
      const images = Array.isArray(imageUrls)
        ? imageUrls.filter((u) => typeof u === 'string' && u.indexOf('data:image/') === 0).slice(0, 3)
        : (typeof imageUrls === 'string' && imageUrls.indexOf('data:image/') === 0 ? [imageUrls] : [])
      const content = images.length
        ? [
            { type: 'text', text: prompt },
          ].concat(images.map((u) => ({ type: 'image_url', image_url: { url: u } })))
        : prompt
      const body = {
        model: model,
        temperature: typeof options.temperature === 'number' ? options.temperature : 0.3,
        max_tokens: Math.max(64, fitted),
        messages: [{ role: 'user', content: content }],
      }
      if (options.includeUsage) body.include_usage = true
      if (cfg.effort && cfg.effort !== 'off') {
        body.reasoning = { effort: cfg.effort }
        if (options.reasoningExclude) body.reasoning.exclude = true
      }
      if (options.providerRouting) {
        const routing = {
          sort: 'throughput',
          quantizations: Array.isArray(options.quantizations) && options.quantizations.length ? options.quantizations : ['fp8', 'bf16', 'fp16', 'fp32', 'unknown'],
        }
        if (Array.isArray(options.onlyProviders) && options.onlyProviders.length) routing.only = options.onlyProviders
        if (options.allowFallbacks === false) routing.allow_fallbacks = false
        body.provider = routing
      }
      const base = String(options.baseUrl || 'https://openrouter.ai/api/v1').replace(/\/+$/, '')
      const tmpBody = '_studio/.tmp/agent-' + Date.now() + '-' + Math.floor(Math.random() * 1e6) + '.json'
      const tmpOut = tmpBody + '.out'
      try {
        await writeJson(tmpBody, body)
        const cmd =
          'curl -sS -m 120 -o ' + JSON.stringify(tmpOut) +
          ' -w "%{http_code}" -X POST ' + JSON.stringify(base + '/chat/completions') +
          ' -H "content-type: application/json" -H "authorization: Bearer $DS_OR_KEY"' +
          ' --data-binary @"' + tmpBody + '"'
        const res = await sh({
          command: cmd,
          workdir: await rootPath(),
          timeoutMs: 130000,
          env: { DS_OR_KEY: key },
          stdoutMaxBytes: 4096,
        })
        if (res.exitCode !== 0 || res.timedOut || res.aborted) return { error: 'curl failed (exit ' + String(res.exitCode) + ')' }
        const status = parseInt(String((res.stdout && res.stdout.text) || '').trim(), 10) || 0
        const outT = await fs.resolve(tmpOut, { cwd: await rootPath() })
        const outInfo = await fs.stat(outT)
        if (!outInfo) return { error: 'no response body' }
        const raw = await fs.readText(outT)
        if (status === 401 || status === 403) return { error: 'auth failed (HTTP ' + status + ') — check the OPENROUTER_API_KEY value', fatal: true }
        if (status === 429) return { error: 'rate limited (HTTP 429)' }
        if (status >= 500) return { error: 'provider error (HTTP ' + status + ')' }
        if (status !== 200) return { error: 'HTTP ' + status + (raw ? ': ' + String(raw).slice(0, 160) : '') }
        let rootJson
        try {
          rootJson = JSON.parse(raw)
        } catch (_) {
          return { error: 'non-JSON response' }
        }
        const choice = rootJson.choices && rootJson.choices[0]
        const msg = choice && choice.message
        const content = msg && typeof msg === 'object' ? flattenContent(msg.content, msg.reasoning || msg.reasoning_content) : ''
        if (!content || !String(content).trim()) return { error: 'empty model output' }
        return { content: String(content), model: rootJson.model || model, usage: rootJson.usage || null }
      } finally {
        try {
          await sh({ command: 'rm -f ' + JSON.stringify(tmpBody) + ' ' + JSON.stringify(tmpOut), workdir: await rootPath() })
        } catch (_) {}
      }
    }

    async function designAgentChat(args) {
      const slug = args && args.slug
      const message = args && args.message
      let fsListener = null
      const touched = new Map()
      let activityCount = 0
      try {
        if (!isSlug(slug)) return { ok: false, notes: 'invalid slug', history: [] }
        if (typeof message !== 'string' || !message.trim()) return { ok: false, notes: 'message is required', history: await agentHistoryLoad(slug) }
        const history = await agentHistoryAppend(slug, 'operator', message.trim())
        const brief = await promptsBrief(slug)
        const systems = await listSystems(null)
        const sysInfo = systems.find((s) => s.slug === slug)
        const treeLines = (sysInfo && sysInfo.files ? sysInfo.files : []).map((f) => '- ' + f.path + (f.size !== null && f.size !== undefined ? ' (' + f.size + ' bytes)' : ''))
        const filesText = [
          '=== html/index.html ===\n' + (await readFileTextCapped(slug, 'html/index.html', 7000)),
          '=== css/style.css ===\n' + (await readFileTextCapped(slug, 'css/style.css', 9000)),
          '=== js/app.js ===\n' + (await readFileTextCapped(slug, 'js/app.js', 9000)),
          '=== css/token.css ===\n' + (await readFileTextCapped(slug, 'css/token.css', 3000)),
        ].join('\n\n')
        // Uploaded images: EXPLICIT picker selections first (they take priority),
        // then any image the operator mentioned by filename in the message.
        // 0-byte artifacts are never eligible for selection or mention-matching.
        const sysImages = (sysInfo && sysInfo.files ? sysInfo.files : [])
          .filter((f) => f.path.indexOf('assets/images/') === 0 && (f.size || 0) > 0)
          .map((f) => f.path)
        const explicit = Array.isArray(args.images) ? args.images.map(String) : []
        const msgLower = String(message).toLowerCase()
        const mentioned = []
        for (const p of explicit) {
          if (sysImages.indexOf(p) !== -1 && mentioned.indexOf(p) === -1) mentioned.push(p)
        }
        for (const p of sysImages) {
          const base = String(p.split('/').pop() || '').toLowerCase()
          if (base && msgLower.indexOf(base) !== -1 && mentioned.indexOf(p) === -1) mentioned.push(p)
        }
        // The child agent runs on the harness default model (text). When the
        // operator picks/mentions an image, a vision pre-pass on the operator's
        // configured vision model describes it (per image, in the context of the
        // request) so the child can act on it without guessing which asset is meant.
        const imageNotes = await describeAttachedImages(slug, mentioned, message.trim())

        const parent = findParentAgent(sysInfo ? sysInfo.sessionId : null)
        if (parent === null) return { ok: false, notes: 'no live conversation agent in this process — make sure this conversation is open and try again', history: await agentHistoryLoad(slug) }
        const subagentsSvc = ctx.get('subagents')
        if (subagentsSvc === undefined || typeof subagentsSvc.start !== 'function') return { ok: false, notes: 'subagent service unavailable in this host', history: await agentHistoryLoad(slug) }
        const provider = pickSubagentProvider(subagentsSvc)
        if (provider === null) return { ok: false, notes: 'no subagent provider registered in this harness (need the spawn/fork in-process provider)', history: await agentHistoryLoad(slug) }

        // Live activity: observe fs events inside the design system while the child works.
        const designRootPath = await rootPath()
        const absPrefix = designRootPath + '/' + slug + '/'
        fsListener = ctx.on('fs/observed', (target, observation) => {
          try {
            const p = fs.processPath(target)
            const i = p.indexOf(absPrefix)
            if (i === -1) return
            const rel = p.slice(i + absPrefix.length) || '(root)'
            const kind = observation && observation.kind ? String(observation.kind) : 'touch'
            const key = rel + ':' + kind
            if (touched.has(key) || activityCount >= 40) return
            touched.set(key, Date.now())
            activityCount++
            agentHistoryAppend(slug, 'activity', kind + ' ' + rel).catch(function () {})
          } catch (_) {}
        })

        await agentHistoryAppend(slug, 'activity', 'design agent started on the harness ' + provider + ' engine')

        const effectiveMessage =
          message.trim() +
          (explicit.length
            ? '\n\n[Studio picker: the operator selected ' + explicit.join(', ') + ' in the image dropdown — any reference to "the image", "this image", or "the background" without a filename means THIS selection; prefer it over any other asset already referenced in the files.]'
            : '')
        const prompt = buildAgentPrompt(slug, effectiveMessage, history, brief, treeLines, filesText, imageNotes, designRootPath)
        const run = await subagentsSvc.start(provider, {
          label: 'design-agent:' + slug,
          prompt: [{ type: 'text', text: prompt }],
          parent: parent,
          signal: neverSignal(),
          persona: buildAgentPersona(slug),
        })

        const runTimeoutMs = 12 * 60 * 1000
        const outcome = await Promise.race([
          run.result.then((r) => ({ kind: 'result', value: r })),
          ctx.timeout(runTimeoutMs).then(() => ({ kind: 'timeout' })),
        ])
        if (outcome.kind === 'timeout') {
          try {
            await run.dispose()
          } catch (_) {}
          await agentHistoryAppend(slug, 'activity', 'design agent timed out after 12 min')
          return { ok: false, notes: 'design agent timed out (12 min) — ask again with a narrower request', history: await agentHistoryLoad(slug) }
        }
        try {
          await run.dispose()
        } catch (_) {}
        const result = outcome.value
        const text = (result && Array.isArray(result.output) ? result.output : [])
          .filter((b) => b && b.type === 'text')
          .map((b) => String(b.text || ''))
          .join('\n')
          .trim()
        if (result && result.stopReason !== 'completed') {
          await agentHistoryAppend(slug, 'activity', 'design agent stopped: ' + result.stopReason)
          if (!text) return { ok: false, notes: 'design agent stopped: ' + String(result.stopReason), history: await agentHistoryLoad(slug) }
        }
        if (!text) return { ok: false, notes: 'design agent produced no reply', history: await agentHistoryLoad(slug) }
        const finalHistory = await agentHistoryAppend(slug, 'design-agent', text)
        return { ok: true, reply: text, model: 'harness-' + provider + '-agent', history: finalHistory }
      } catch (err) {
        return { ok: false, notes: String((err && err.message) || err), history: await agentHistoryLoad(slug) }
      } finally {
        if (fsListener) {
          try {
            fsListener()
          } catch (_) {}
        }
      }
    }

    // ---------- live-preview route (iframe source for the client) ----------
    const TEXT_EXTS = ['.html', '.css', '.js', '.mjs', '.json', '.md', '.txt', '.svg', '.map', '.csv', '.xml', '.ts', '.py', '.sh', '.yml', '.yaml', '.kt', '.java', '.log']
    const MIME_SERVE = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.mjs': 'text/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.md': 'text/markdown; charset=utf-8',
      '.txt': 'text/plain; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.map': 'application/json; charset=utf-8',
      '.csv': 'text/csv; charset=utf-8',
      '.xml': 'application/xml; charset=utf-8',
      '.ts': 'text/plain; charset=utf-8',
      '.py': 'text/plain; charset=utf-8',
      '.sh': 'text/plain; charset=utf-8',
      '.yml': 'text/plain; charset=utf-8',
      '.yaml': 'text/plain; charset=utf-8',
      '.kt': 'text/plain; charset=utf-8',
      '.java': 'text/plain; charset=utf-8',
      '.log': 'text/plain; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.ico': 'image/x-icon',
      '.avif': 'image/avif',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.woff2': 'font/woff2',
    }

    function failResponse(res, code, msg) {
      res.statusCode = code
      res.setHeader('content-type', 'text/plain; charset=utf-8')
      res.setHeader('cache-control', 'no-store')
      res.end(String(msg))
    }

    if (webServer !== undefined) {
      ctx.effect(() => {
        try {
          return webServer.register({
            kind: 'prefix',
            path: '/design-studio',
          handler: async (req, res) => {
            try {
              if (req.method !== 'GET' && req.method !== 'HEAD') return failResponse(res, 405, 'method not allowed')
              const raw = String(req.url || '').split('?')[0]
              const restRaw = raw.indexOf('/design-studio') === 0 ? raw.slice('/design-studio'.length) : ''
              const segs = []
              for (const s of restRaw.split('/')) {
                if (s === '') continue
                let dec = s
                try {
                  dec = decodeURIComponent(s)
                } catch (_) {}
                if (dec === '..' || dec.indexOf('\\') !== -1 || dec.indexOf('\0') !== -1) return failResponse(res, 400, 'bad path')
                segs.push(dec)
              }
              if (!segs.length) return failResponse(res, 404, 'no design system in path')
              const slug = segs[0]
              if (!isSlug(slug) || slug === '_zips' || slug === '_presets' || slug === '_studio') return failResponse(res, 404, 'unknown design system')
              let rel = segs.slice(1).join('/')
              if (!rel || rel === 'index.html') rel = 'html/index.html'
              const sys = await resolveSystem(slug)
              const target = await fs.resolve(rel, { cwd: fs.processPath(sys) })
              if (!fs.contains(sys, target)) return failResponse(res, 404, 'outside design system')
              const info = await fs.stat(target)
              if (!info || info.type !== 'file') return failResponse(res, 404, 'not found: ' + rel)
              const ext = '.' + (rel.split('.').pop() || '').toLowerCase()
              const isText = TEXT_EXTS.indexOf(ext) !== -1
              res.statusCode = 200
              res.setHeader('content-type', MIME_SERVE[ext] || 'application/octet-stream')
              res.setHeader('cache-control', 'no-store')
              res.setHeader('x-content-type-options', 'nosniff')
              if (req.method === 'HEAD') {
                res.end()
              } else if (isText) {
                const text = await fs.readText(target)
                res.end(text)
              } else {
                const bytes = await fs.readBytes(target, undefined, 20 * 1024 * 1024)
                res.end(bytes)
              }
            } catch (err) {
              failResponse(res, 500, String((err && err.message) || err))
            }
          },
        })
      } catch (err) {
        // A persistent package (e.g. @sal7one/dsh-design-studio) may already own this prefix
        // with an identical handler — continue without a second registration.
        console.error('design-studio: preview route already registered elsewhere; using the existing one:', String((err && err.message) || err))
        return function noop() {}
      }
      })
    }

    // ---------- client RPC ----------
    function handle(name, fn) {
      ctx.effect(() =>
        harness.handle(name, async (args) => {
          try {
            return { ok: true, data: await fn(args || {}) }
          } catch (err) {
            return { ok: false, error: String((err && err.message) || err) }
          }
        }),
      )
    }

    handle('studio.ping', async () => ({ studio: STUDIO_DIR, previewRoute: webServer !== undefined ? '/design-studio/<slug>/html/index.html' : null }))
    handle('studio.list', async (a) => listSystems(a.sessionId))
    handle('studio.create', async (a) => createSystem(a.slug, a.sessionId !== undefined ? a.sessionId : initiatorSessionId()))
    handle('studio.sweep', async () => sweepOrphans())
    handle('studio.delete', async (a) => deleteSystem(a.slug))
    handle('studio.read', async (a) => readSystemFile(a.slug, a.path))
    handle('studio.outline', async (a) => outlineOfSystem(a.slug))
    handle('studio.apply', async (a) => applyAgentEdits(a.slug, a.guidance, a.selection))
    handle('studio.write', async (a) => writeSystemFile(a.slug, a.path, a.content))
    handle('studio.zip', async (a) => zipSystem(a.slug))
    handle('studio.reveal', async (a) => revealZip(a.slug))
    handle('studio.agent', async (a) => designAgentChat(a))
    handle('studio.agent.history', async (a) => {
      if (!isSlug(a.slug)) throw new Error('invalid slug')
      return agentHistoryLoad(a.slug)
    })
    handle('studio.agent.note', async (a) => {
      if (!isSlug(a.slug)) throw new Error('invalid slug')
      if (!/^[a-z-]{1,20}$/.test(String(a.role || ''))) throw new Error('invalid role')
      return agentHistoryAppend(a.slug, String(a.role), String(a.text || ''))
    })
    handle('studio.ingest', async (a) => ingestFiles(a.slug, a.files))
    handle('studio.presets', async () => listPresets())
    handle('studio.preset.get', async (a) => {
      if (!isSlug(a.id)) throw new Error('invalid preset id')
      const parsed = await readJson(PRESETS_DIR + '/' + a.id + '.json')
      if (!parsed) throw new Error('unknown preset: ' + a.id)
      return summarizePreset(parsed, String(a.id) + '.json')
    })
    handle('studio.preset.save', async (a) => savePreset(a.preset))
    handle('studio.preset.delete', async (a) => deletePreset(a.id))
    handle('studio.preset.apply', async (a) => applyPreset(a.slug, a.presetId))
    handle('studio.config', async () => {
      let harness = null
      if (llm !== undefined) {
        try {
          const providers = llm.listProviders()
          harness = { routeRegistered: providers.some((p) => p && p.id === 'openrouter'), providers: providers.map((p) => (p && p.id) || null).filter(Boolean) }
        } catch (_) {
          harness = { routeRegistered: false, providers: [] }
        }
      }
      return { config: await loadConfig(), key: await keyInfo(), harness }
    })
    handle('studio.config.save', async (a) => saveConfig(a.patch))
    handle('studio.config.setKey', async (a) => {
      if (credentials === undefined) throw new Error('credential service unavailable in this host')
      if (typeof a.value !== 'string' || !a.value.trim()) throw new Error('empty key — use clearKey to remove it')
      try {
        await credentials.set(KEY_REF, a.value.trim())
      } catch (err) {
        throw new Error('key not stored: ' + String((err && err.message) || err) + ' (a read-only source may be shadowing OPENROUTER_API_KEY)')
      }
      return keyInfo()
    })
    handle('studio.config.clearKey', async () => {
      if (credentials === undefined) throw new Error('credential service unavailable in this host')
      try {
        await credentials.unset(KEY_REF)
      } catch (err) {
        throw new Error('key not removed: ' + String((err && err.message) || err))
      }
      return keyInfo()
    })
    handle('studio.review.get', async (a) => {
      if (!isSlug(a.slug)) throw new Error('invalid slug')
      return readJson('_studio/reviews/' + a.slug + '.json')
    })
    handle('studio.selection.save', async (a) => writeEditRequest(a.slug, a.selection, a.request))
    handle('studio.selection.clear', async (a) => clearEditRequest(a.slug))
    handle('studio.screenshot', async (a) => screenshotSystem(a.slug, a.screen))
    handle('vision.review', async (a) => visionReview(a))

    // ---------- dynamic tool for the coding agent ----------
    const tool = harness.defineTool({
      name: 'design_studio',
      description:
        'Manage the Design Studio under temp_design_folder/: list/create/read/write/zip design systems (html+css+js mockups), reveal the zip in Finder, CRUD identity presets (apply writes css/token.css + copies logo assets), chat with the design agent (persisted per-system history), list/delete design systems across conversations (all), sweep orphaned designs when auto-delete is opted in, persist the OpenRouter vision-model config, run a vision review (image + brief -> honest GOOD|POOR verdict from the operator-chosen OpenRouter model, via the harness llm route when an openrouter provider is registered, else the plugin curl client), and read/clear the pending operator edit request (edit_request reads <slug>/EDIT_REQUEST.md saved by the operator\u2019s Select mode in the preview; after applying the requested html/css/js changes, run selection_clear). Writes are scoped to temp_design_folder/ design-system folders only. The OpenRouter key is a credential reference (OPENROUTER_API_KEY) and its value is never returned or rendered. DESIGN SYSTEMS ARE UI MOCKUPS ONLY: html + css + minimal presentation js — never full app or game logic (a tic-tac-toe design shows the board look, not playable rules); every create scaffolds a color palette + typography in css/token.css and design_prompts_forcoders.md.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['list', 'all', 'create', 'read', 'write', 'zip', 'reveal', 'presets', 'preset_save', 'preset_apply', 'preset_delete', 'review', 'agent', 'agent_history', 'sweep', 'delete', 'config', 'edit_request', 'selection_clear'],
            description: 'Which studio operation to run.',
          },
          slug: { type: 'string', description: 'Design-system slug (lowercase letters, digits, dashes), e.g. homelab-command-center.' },
          path: { type: 'string', description: 'File path inside the design system, e.g. css/style.css.' },
          content: { type: 'string', description: 'Full new file content for write.' },
          preset: {
            type: 'object',
            additionalProperties: true,
            description:
              'Preset JSON for preset_save: {id, name, colors:{bg,panel,panel2,border,text,muted,accent,ok,warn,err,info}, logos?{mark,wordmark,favicon}, fonts?{body,display,mono}, radius?"12px", spacing?16, components?{...}}.',
          },
          presetId: { type: 'string', description: 'Preset id for preset_apply or preset_delete.' },
          image: {
            type: 'string',
            description: 'For review: an image path inside the design system (e.g. assets/images/shot.png) or a data:image/...;base64 URL.',
          },
          brief: { type: 'string', description: 'For review: optional brief override; defaults to the design system design_prompts_forcoders.md.' },
          message: { type: 'string', description: 'For agent: the message to send to the design agent (a real harness subagent that lists/reads/edits the design files itself).' },
          images: {
            type: 'array',
            items: { type: 'string' },
            description: 'For agent: optional asset image paths to attach (e.g. ["assets/images/shot-1.png"]); the design agent sees the actual image content and can extract colors or use it as a background. Mentioning a filename in the message also auto-attaches it.',
          },
          request: { type: 'string', description: 'For edit requests: the operator request text (normally read from the design system EDIT_REQUEST.md).' },
          patch: {
            type: 'object',
            additionalProperties: true,
            description:
              'For config: partial config patch {codingModel?, visionModels?[], effort?("off"|"low"|"medium"|"high"), options?{baseUrl?, temperature?, maxTokens?, providerRouting?, quantizations?[], onlyProviders?[], allowFallbacks?, includeUsage?, reasoningExclude?}}.',
          },
        },
        required: ['action'],
      },
      output: {
        schema: { type: 'string' },
        render(_call, value) {
          const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
          return [{ type: 'text', text }]
        },
      },
      async execute(args) {
        switch (args.action) {
          case 'list': {
            const systems = await listSystems(null)
            return JSON.stringify(
              systems.map((s) => ({
                slug: s.slug,
                sessionId: s.sessionId,
                orphan: s.orphan,
                files: s.count,
                hasPrompts: s.hasPrompts,
                hasPreview: s.hasPreview,
                hasTokenCss: s.hasTokenCss,
                images: s.files.filter((f) => f.path.indexOf('assets/images/') === 0).map((f) => f.path),
              })),
              null,
              2,
            )
          }
          case 'all': {
            const systems = await listSystems(null)
            return JSON.stringify(
              systems.map((s) => ({ slug: s.slug, sessionId: s.sessionId, orphan: s.orphan, createdAt: s.createdAt, files: s.count, hasPreview: s.hasPreview })),
              null,
              2,
            )
          }
          case 'create': {
            const r = await createSystem(args.slug, initiatorSessionId())
            return 'created design system ' + args.slug + ' (html/css/js + design_prompts_forcoders.md; no empty folders)' + (r.sessionId ? ' bound to this conversation (' + r.sessionId + ')' : ' (no conversation binding)')
          }
          case 'read': {
            const r = await readSystemFile(args.slug, args.path)
            return r.content
          }
          case 'write': {
            const r = await writeSystemFile(args.slug, args.path, args.content)
            return 'wrote ' + r.bytes + ' bytes to ' + args.slug + '/' + r.path
          }
          case 'zip': {
            const r = await zipSystem(args.slug)
            return 'zip written: ' + r.zip
          }
          case 'reveal': {
            const r = await revealZip(args.slug)
            return 'Finder opened for ' + r.revealed
          }
          case 'agent': {
            const r = await designAgentChat(args)
            if (!r.ok) return 'NO REPLY: ' + r.notes
            return 'design agent (' + r.model + '): ' + r.reply
          }          case 'agent_history': {
            return JSON.stringify(await agentHistoryLoad(args.slug), null, 2)
          }
          case 'sweep': {
            const r = await sweepOrphans()
            return r.note + (r.swept.length ? ' — removed: ' + r.swept.join(', ') : '')
          }
          case 'delete': {
            await deleteSystem(args.slug)
            return 'design system removed: ' + args.slug + ' (folder, zip, reviews, agent history)'
          }
          case 'presets':
            return JSON.stringify(await listPresets(), null, 2)
          case 'preset_save': {
            const r = await savePreset(args.preset)
            return 'preset ' + r.id + ' saved (version ' + r.version + ')'
          }
          case 'preset_apply': {
            const r = await applyPreset(args.slug, args.presetId)
            return (
              'applied preset ' + r.presetId + ' to ' + r.slug + ': wrote ' + r.tokenCss +
              (r.copied.length ? '; copied logos: ' + r.copied.join(', ') : '') +
              (r.missing.length ? '; missing logos (skipped honestly): ' + r.missing.join(', ') : '')
            )
          }
          case 'preset_delete': {
            await deletePreset(args.presetId)
            return 'preset removed: ' + args.presetId
          }
          case 'review': {
            const r = await visionReview(args)
            if (!r.ok) return 'NO REVIEW: ' + r.notes
            return 'VERDICT: ' + (r.ok ? 'GOOD' : 'POOR') + ' — ' + r.notes + ' (model: ' + r.model + ', transport: ' + (r.transport || 'unknown') + ')'
          }
          case 'config': {
            const cfg = await loadConfig()
            const ki = await keyInfo()
            const harness = harnessRouteAvailable()
            return JSON.stringify({ config: cfg, key: ki, harnessOpenRouterRoute: harness }, null, 2)
          }
          case 'edit_request': {
            try {
              const r = await readSystemFile(args.slug, 'EDIT_REQUEST.md')
              return 'PENDING EDIT REQUEST for ' + args.slug + ' (apply it, then run selection_clear):\n\n' + r.content
            } catch (_) {
              return 'no pending edit request for ' + args.slug
            }
          }
          case 'selection_clear': {
            await clearEditRequest(args.slug)
            return 'edit request cleared for ' + args.slug
          }
          default:
            throw new Error('unknown action: ' + String(args.action))
        }
      },
    })
    ctx.effect(() => {
      const toolsSvc = ctx.get('tools')
      if (toolsSvc !== undefined && typeof toolsSvc.get === 'function' && toolsSvc.get('design_studio') !== undefined) {
        // A persistent package already registered the studio tool; skip the duplicate.
        return function noop() {}
      }
      return harness.registerTool(ctx, tool)
    })
  },
}
