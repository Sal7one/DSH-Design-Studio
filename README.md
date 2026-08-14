# @sal7one/dsh-design-studio

A **DeepSeek Harness plugin** that turns design mockups into a first-class workflow:
live previews, identity presets, screenshots, vision review, and a design-agent chat —
all backed by real files on disk under `temp_design_folder/`.

```text
dsh-design-studio/
├── package.json          # dsh.bundle manifest → ./cordis.patch.yml
├── cordis.patch.yml      # the composition layer this bundle contributes
├── README.md             # this file
├── LICENSE               # MIT
├── lib/index.js          # persistent HOST half: tool + route + prompt section
└── dynamic/              # the UI (tab, agent chat, Shot, Review) — a separate artifact
    ├── host.js           # RPC handlers, screenshot, agent engine, review transports
    ├── client.js         # browser UI: tab, settings sections, run panel
    └── README.md         # how to run the UI half
```

## What you get

- **`design_studio` agent tool** — list/create/read/write/zip/reveal design systems,
  identity-preset CRUD, vision review (GOOD|POOR), and the design-agent chat.
  Writes are scoped to `temp_design_folder/` design-system folders only.
- **A real design agent** — the `agent` action runs a **harness subagent** (spawn
  provider, design-studio persona) on the harness's default model route: it lists,
  reads and edits the design files itself across multiple tool calls, with live
  file activity and a persisted per-system history. Explicitly selected images
  (`images` or the UI picker) take priority and are pre-described by the operator's
  vision model, so "the image" always means the right one.
- **`/design-studio/<slug>/html/index.html` live-preview route** served by the harness web server.
- **A system-prompt section** that routes operator design briefs into the studio.
- **The Design Studio UI** (dynamic half): conversation tab with live preview iframe,
  📸 Shot (macOS `screencapture`), 👁 Review, 🎯 element picker, file drop zones,
  the Design Agent chat with live activity + inline errors, plus
  Settings → Design Studio / All designs.

## Install

The bundle is **plain JavaScript — no build step**, so GitHub installs work without
pnpm's `allowBuilds` dance:

```sh
dsh plugin --profile web add "github:sal7two/dsh-design-studio#main"
```

From a local checkout:

```sh
dsh plugin --profile web add -w /absolute/path/to/dsh-design-studio
```

> `-w` is only needed when your profile directory is a pnpm workspace root
> (`pnpm-workspace.yaml` with `packages: [., packages/*]`), and the path must be
> **absolute** — a bare relative path is misread as a GitHub `owner/repo` shorthand.
> `remove` takes the package name, not the path:
> `dsh plugin --profile web remove @sal7one/dsh-design-studio`.

The bundle row is **enabled by default**. To keep it installed but off, override it in
your profile's own `cordis.patch.yml` (profile layers apply after bundle layers and win
per row):

```yaml
- id: dsh-design-studio
  disabled: true
```

The UI half is a **dynamic Cordis plugin**: it runs in-process and is re-loaded through
the harness's `cordis_define` / `cordis_run` tooling (or any agent workflow that can run
dynamic packages). See `dynamic/README.md`.

## Requirements

- Node ≥ 22, DeepSeek Harness with the standard host services
  (`fs`, `subprocess`, `webServer`, `llm`, `credentials`, `attachments`, `systemPrompt`, `tools`).
- The design tree root must exist at the **server process workspace root** as
  `temp_design_folder/` (the route resolves against the server cwd, not any session's
  workspace — a symlink is fine).
- For vision review: an OpenRouter key stored under credential reference
  `OPENROUTER_API_KEY`, or a harness `openrouter` provider route.

## ⚠️ Compatibility notes — mistakes we already made so you don't have to

This plugin was built and broken against a moving harness base. The traps:

1. **`shell` is gone at host level.** The old `shell` executor (resolve/run) now lives
   in session presets. A host row that injects `shell` **waits forever silently** —
   no boot error, no route, no tool. Inject `subprocess` and build shell semantics
   yourself (see `lib/index.js` → `sh()`).
2. **Hard-inject everything you register against.** `apply()` runs as soon as its
   injections resolve, which can be *before* `webServer`/`tools`/`llm` exist. A one-time
   `ctx.get()` taken too early returns `undefined` and silently skips the route/tool/
   section registration. Put integration points in `inject` so apply waits.
3. **Provider keys collide with the built-in catalog.** The base ships `llm-pi-ai`,
   which natively declares `openrouter` (among others). Registering your own
   `openrouter` configurable provider throws `DUPLICATE_DIRECTORY` and **kills the whole
   web boot**. Check the target base's catalog before releasing a provider plugin.
4. **Commit `lib/`.** A harness checkout's `.gitignore` ignores `lib/` — a plugin
   committed inside one ships without its entry point. This repo lives at its own top
   level and ships plain JS, so `lib/index.js` is committed.
5. **Dynamic plugins die on restart.** Everything in `dynamic/` is in-memory by design.
   The bundle is the restart-safe part; the UI is re-run after a restart. Don't promise
   users a persistent tab from a dynamic package.

## Publishing

```sh
gh repo create sal7two/dsh-design-studio --public --source . --push
gh repo edit sal7two/dsh-design-studio --add-topic dsh --add-topic dsh-plugin
```

Then PR one entry into `awesome-deepseek-harness` (alphabetical, one PR per change,
carry the `#dsh` topic for discovery).

## License

MIT
