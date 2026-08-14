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

Works with **both** distributions of the harness:

- the npm distribution (`npx @deepseek-ai/dsh web`), and
- a source checkout (`git clone …/deepseek-harness && pnpm install && pnpm dsh web`).

The bundle is **plain JavaScript — no build step**, and its dependencies are plain
npm semver ranges (`^4.0.1` / `^0.1.0-rc.5` — no `workspace:` protocol), so it
installs into either:

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

## Plain-English setup (non-power users)

You don't need to understand any of the internals. From a fresh machine:

1. **Install Node.js** (v22 or newer) from nodejs.org.
2. **Start the harness.** Open a terminal and run:
   ```sh
   npx @deepseek-ai/dsh web
   ```
   (First run downloads everything; afterwards it starts quickly.) A browser window
   opens at `http://127.0.0.1:3080` — that's the harness Web UI.
3. **Install this plugin** (same terminal, or stop the server first with Ctrl+C and run):
   ```sh
   dsh plugin --profile web add "github:sal7two/dsh-design-studio#main"
   ```
   then start the server again if you stopped it.
4. **Open the Design Studio tab** in the harness Web UI. If it isn't there, tell the
   assistant in the chat: *"load the Design Studio dynamic plugin from
   `dynamic/host.js` and `dynamic/client.js` in the dsh-design-studio repo"* — it can
   run the two files through `cordis_define` + `cordis_run` for you, and the tab appears.
5. **Optional — vision features:** in the tab, go to Settings → Design Studio and paste
   an OpenRouter API key (it's stored safely; never shown again). Without it, everything
   except image review/description still works.
6. **Design something.** Create a design system (or just describe a screen to the
   assistant — it routes briefs into the studio automatically), then chat with the
   Design Agent in the tab: it reads and edits the files itself. The live preview URL is
   `http://127.0.0.1:3080/design-studio/<name>/html/index.html`.

## What survives a restart ("on launch")

- ✅ **Everything the bundle provides is launch-persistent:** the `design_studio` tool
  (create/read/write/zip, presets, vision review, the design-agent chat), the
  `/design-studio/...` preview route, and the design-brief prompt section. After
  `dsh plugin add` once, every future launch has them — including the design agent,
  which the assistant can drive from plain chat with no UI at all.
- ✅ **All data survives:** designs, presets, config, and agent history live on disk
  under `temp_design_folder/`.
- ⚠️ **The visual tab is a dynamic plugin** and must be re-run after each server
  restart (step 4 above). The platform's launch-persistent UI mechanism (`dsh.client`
  bundles) exists but requires the UI to be built as a TypeScript/tsdown client
  package — tracked as a follow-up; the tool-only workflow above needs nothing extra.

## Requirements

- Node ≥ 22 and the harness (npm distribution ≥ `0.1.0-rc.5`, or a source checkout of
  the same generation) with the standard host services
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
