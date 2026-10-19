# Changelog

All notable changes to `@sal7one/dsh-design-studio` are documented here.

## 2.6.2 — 2026-10-20

Built-in design→freeze→implementation routing.

- The injected DSH system-prompt section now states the workflow automatically:
  design phase is the default; do not implement until approved/frozen; approving
  with done / looks good / LGTM / freeze triggers freeze; frozen means implement
  in the current project, never edit the mockup; “freeze and implement” does both
  without another confirmation.
- Freeze defaults to the current conversation project, so operators do not need
  to write “mockup only”, “when I say freeze…”, or “implement the frozen design”
  in every project prompt.
- Expanded the system-prompt test to assert the design-phase, LGTM, default
  project, no-path-ask, and freeze-and-implement rules.

## 2.6.1 — 2026-10-20

Freeze project defaults and selector.

- Freeze no longer requires typing a path. The implementation target defaults to
  the **current conversation project** (session cwd), falling back to the host
  cwd only when no session project is available.
- Added `studio.project`: returns the current project plus recent implementation
  targets. The freeze modal shows a **project selector** (This project / Recent /
  Other path) instead of a raw path input by default.
- Tool `freeze` uses the same session-aware default when `implementation` is
  omitted; `list`/`all` still expose the recorded target.
- Tests cover the session default (`/work/project`) and the selector endpoint.

## 2.6.0 — 2026-10-20

Design freeze: an explicit design → implementation handoff.

- Added `freeze` / `unfreeze` tool + API actions and a large **❄ Finish & freeze
  design** button. Freeze captures a final snapshot, refreshes the zip, records
  the design stamp, optional implementation target and handoff note in
  `_studio/freeze/<slug>.json`.
- Freeze is read-only: `list`/`all` expose `frozen` and the freeze record; write,
  style apply, asset upload/import/delete, ingest, history restore/undo,
  selection save, delete, and design-agent chat are rejected. Read, snapshot,
  review, zip, and open remain available.
- UI: frozen banner with implementation target, read-only/disabled edit paths
  (Select, Styles, History, Assets, design agent, Delete) and an explicit Thaw
  confirmation.
- Agent knowledge: `AGENTS.md`, the repo skill, and the handbook now say frozen
  means implementation mode — work in the recorded target, never the mockup.
- Freeze cleanup is included in design deletion; freeze is a tool/context guard,
  not a filesystem ACL.

## 2.5.0 — 2026-10-20

Repo-local Design Studio knowledge and skill.

- Added `docs/design-studio-handbook.md`: design-system layout, UI map, tool
  actions, create/edit/selection workflows, style tour, history, vision,
  responsive/accessibility checks, assets, safety, and maintainer verification.
- Added `skills/design-studio/SKILL.md`: a reusable working procedure for agents
  building, editing, previewing, styling, snapshotting, and reviewing mockups.
- Added `AGENTS.md` and `skills/README.md` so repo agents know where the material
  lives. These are explicitly **not installed into the DSH profile yet**.
- Packaged the handbook, skill folder, and AGENTS.md; version 2.5.0.

## 2.4.6 — 2026-10-20

Assets full-view top spacing.

- The full-screen Asset library overlay now starts below the OS/window controls
  (56px top padding, 48px on narrow screens), so its Upload/Refresh/Close row no
  longer collides with the window buttons.

## 2.4.5 — 2026-10-20

Cancellable delete confirmation.

- The Delete action now shows a **Cancel** button while armed, so the confirmation
  can be dismissed without switching tabs. Changing the selected design still
  disarms it automatically.

## 2.4.4 — 2026-10-20

Workspace tab row spacing.

- Added breathing room above the Preview/Styles/Agent/Assets/History/Review/
  Upload/Settings tab row so it no longer sits flush against the Create row.

## 2.4.3 — 2026-10-20

Vision-readiness warning.

- The selection editor now warns when the current harness model has no image
  input and no OpenRouter key is configured: DeepSeek can still edit files, but
  it cannot see the rendered preview and visual judgment is unreliable.
- When a text-only model has an OpenRouter key configured, a lighter note says
  screenshot checks use the vision fallback.
- Added a render test covering the warning. 98 checks, 8 tests.

## 2.4.2 — 2026-10-20

Selection default action.

- Pressing **Enter** in the selection editor now sends the request to
  **Ask DeepSeek** instead of saving the edit request without sending.
  Shift+Enter still inserts a newline; IME composition Enter is ignored.
- “Save only” remains available and its log now makes clear the request was
  not sent. The modal hint spells out Enter / Shift+Enter / Ask / Save only.

## 2.4.1 — 2026-10-20

Run-banner lifecycle fix.

- The Ask-DeepSeek banner no longer sticks at “request sent — waiting for it to
  pick up the edit…” after the main turn is already done. The client now polls
  the session binding instead of relying only on subscription transitions, so a
  run that starts before the panel mounts (or ends without a final event) still
  reaches `running`/`finished`.
- If the pickup is never observed, the banner becomes “watch the main chat” after
  8s instead of waiting forever.
- Finished/untracked banners auto-clear after 8s; the × remains for immediate
  dismissal. Switching tabs is no longer required.

## 2.4.0 — 2026-10-20

Style tour, random-next preview, reversible applies, and per-edit auto snapshots.

### Added — style tour and safe apply flow

- The Styles tab stays a **grid by default**. A large **Try them now** button opens
  a **horizontal style tour** over the current design: prev/next arrows, a
  scrollable style strip, and automatic live token preview as you flip. Arrow
  keys (`←`/`→`) auto-try the previous/next style; Escape closes.
- The style tour sits **above** the preview; its card strip scrolls
  horizontally without scrolling the page vertically. A **Fit** toggle (default
  on) scales the whole preview device to the available height and centers it;
  switch to **1:1** for actual size. Starting a tour scrolls the Studio back to
  the preview instead of leaving you at the gallery position.
- Preview bar keeps **Try another random** beside Apply with breathing room,
  plus Apply/Revert. Switching styles stays in the live preview without writing.
- **Apply is reversible**: before applying a style, the host captures a
  `before-style` snapshot. The returned `beforeSnapshot` drives an **Undo apply**
  action in the Styles panel and the preview bar, alongside History restore.
- **Auto snapshots after AI edits**: the design-agent turn now captures a snapshot
  when it finishes, and debounced file-change captures were widened to 2.2s so
  one batch/prompt settles into one snapshot. Existing style applies also capture
  the pre-style state.
- Tests now target `tests/host.test.mjs` and `tests/client.test.mjs` explicitly so
  ignored research checkouts are never discovered by `npm test`.

## 2.3.0 — 2026-10-20

Attributed style atlas, live style previews, and save/create from style.

### Added — style atlas integration

- Committed `lib/data/style-atlas.json` with **88 styles** adapted from
  **dsh-ui-ux-pro-max** (MIT) and its upstream `ui-ux-pro-max-skill` (MIT);
  see `THIRD_PARTY_NOTICES.md`. The plugin has no runtime dependency on either
  repository or package.
- New **Styles** tab: search, category/status filters, font mood
  (auto/serif/sans/mono), random style, palette swatches, Try, Apply, New, and
  “Save current token.css as…”.
- **Try** previews a style live in the current design by setting CSS variables
  on the preview iframe — no files are touched until Apply. The preview bar
  offers Apply or Revert.
- **Apply** writes a generated `css/token.css`, preserving design-specific
  custom tokens (e.g. `--abaya`) while replacing the core palette, type and
  radii. History auto-captures the change.
- **New** creates a complete design system from a style (`css/token.css`,
  html/css/js scaffold and brief), then selects it.
- **Save current** stores the current `token.css` as a custom style under
  `_studio/styles/`; custom styles appear in the same gallery and can be applied
  to current designs or used to create new ones.
- Host APIs/actions: `studio.styles.list/apply/save/delete/create` and
  `style_list/style_apply/style_save/style_delete/style_create`.

## 2.2.0 — 2026-10-19

Content-addressed edit history with undo and restore.

### Added — content-addressed edit history

- Each design system now has a snapshot tree under `_studio/history/<slug>/`:
  `objects/<sha256>` file blobs, `trees/<sha256>.json` sorted path/hash/size
  manifests, and an `index.json` of parent-linked snapshots with a head cursor.
  Unchanged files share one blob; snapshots never duplicate file bytes.
- Auto-capture after edits settle (debounced from the host change detector),
  a baseline snapshot for pre-existing designs, and manual checkpoints.
- `design_studio` actions `history`, `snapshot_save`, `snapshot_restore`,
  `snapshot_undo` plus `studio.history.*` APIs.
- New **History** tab in the Studio: snapshot list, current marker, manual
  snapshot, undo last edit, and two-click restore. Restoring keeps later
  snapshots, so a state can be restored again; preview/outline/assets reload.

## 2.1.0 — 2026-10-19

Settings redesign, DeepSeek-vision-era options, an asset pipeline, a large Studio workspace, and a real file split.

### Added — asset library

- New `assets/assets.json` manifest with sha256, MIME, byte size, image dimensions,
  `alt`, and timestamps. Listing is self-healing: files written by any tool are
  backfilled; external deletions drop out.
- `design_studio` actions `asset_list`, `asset_upload`, `asset_import`, `asset_delete`
  and the matching `/design-studio/__api/studio.asset.*` endpoints.
- Uploads are sha256-deduplicated, names sanitized/unique, images stored under
  `assets/images/`, other files under `assets/files/`; `asset_import` can pull the
  operator's attachment path directly (verified with the court portrait).
- New **🗂 Assets** modal in the Studio: thumbnails, dimensions/size/MIME, upload by
  drop or picker, lightbox, copy path / copy `<img>`, delete, and a manifest note.
  Preview captures (`preview*.png`) are intentionally excluded from the library.

### Changed — large Studio workspace with a default Preview tab

- The Studio tab now has a 300px library (Designs, Assets, Outline) and a wide tabbed
  work area: **Preview / Agent / Assets / Review / Upload / Settings**. **Preview is the
  default open tab** and is a normal tab next to Agent/Assets/Settings — not a modal and
  not a top-right panel. Assets has its own large inline library tab.
- The preview renders a **centered device frame**. Switching Desktop/Tablet/Mobile
  resizes the whole frame, not just the iframe; the surrounding stage uses the panel
  background, so there is no blinding white strip to the right.
- The **Settings** tab hides the library and spans the full Studio width; the standalone
  Settings page uses a two-column grid at wide widths. This makes the Studio and its
  settings larger and easier to read/modify.
- **Open ↗ is a host action, not a link.** The DSH in-app browser was intercepting
  `<a target="_blank">` and failing with “The page could not load”; the button calls
  `studio.openPreview`, which launches the OS default browser (`rundll32` on Windows,
  `open` on macOS, `xdg-open` on Linux) through the subprocess seam. The URL bar is a
  button that does the same. **Copy URL** remains for manual paste.
- The preview uses a fixed viewport so the design keeps its desktop/tablet/mobile layout
  instead of falling into the mobile breakpoint inside a narrow DSH panel.
- The open Studio now polls the selected design's stamp every 1.5s and reloads the
  Preview (and outline/assets) when files change elsewhere, so no tab switch is needed.

### Added — modern vision settings

- **Vision-first Settings page**: a status card reports the current harness model,
  its `inputModalities`, and whether the harness key is needed; `Refresh status`
  re-reads live capabilities.
- **Vision transport** segmented control (`auto` / `harness` / `openrouter`).
- **Review style** (`strict` / `balanced` / `lenient`) now shapes the review prompt.
- **Reasoning effort** options now include `auto` and `max` (mapped to `high` for the
  OpenRouter fallback), alongside off/low/medium/high.
- **Capture viewport** width/height are configurable (640–2560 × 720–3000) and used by
  the headless snapshot.
- **Design agent preset** select (spawn-provider children) and an **auto-verify**
  toggle that gates the post-edit design-agent pass.
- OpenRouter fallback, its advanced request options, and identity presets are now
  collapsed disclosures instead of a single wall of fields.

### Changed — file structure

- Host split into `lib/host/` modules: `constants`, `util`, `node-io`, `config`,
  `vision`, `preview`, `presets`, `assets`, `history`; `lib/index.js` is now the
  orchestrator for design systems, the agent, HTTP/tool registration.
- Client split into `lib/client/src/` modules (`runtime`, `styles`, `labels`,
  `primitives`, `api`, `element-picker`, `scaled-preview`, `assets-modal`,
  `history`, `studio-view`, `settings`, `index`).
  `lib/client.js` is generated by `scripts/bundle-client.mjs` and remains a
  self-contained ModuleLoader bundle. **Installs still need no build step.**
- `npm run build:client` regenerates the bundle; `npm run check` fails if the committed
  bundle is stale.
- Removed the one-off split helpers after the refactor.

## 2.0.0 — 2026-10-19

Modernization for the DSH **0.2.x** harness line, plus the distribution fix for issue #1.

### Fixed — installation and distribution

- Removed `"private": true`; added `publishConfig.access: "public"`, repository,
  homepage, bugs, keywords, `engines.dsh` and `dsh.manifestVersion: 1`, so the npm
  registry can host the package instead of forcing a git fallback.
- Added `locale/en.json`, `locale/zh.json` and `icon.svg` for the plugin inventory.
- Added `scripts/check.mjs`, host/client smoke tests, and CI/publish workflows.
- Corrected install instructions to use `Sal7one/DSH-Design-Studio` (the README used
  a wrong owner and a `#main` branch that does not exist) and to prefer npm.

### Added — harness-native vision and preview capture

- Vision capability is detected, not assumed: the studio reads
  `ctx.agentDefaultModel.currentSelection()` and
  `ctx.llm.resolveModelInfo(provider, model)` for `inputModalities`.
- When the current model accepts images, `review` and image descriptions run on the
  harness route (`attachments.saveImage` + `llm.stream` with an `ImageBlock`) with
  **no OpenRouter key** (`transport: harness`). Selected images are attached directly
  to the design-agent prompt instead of being pre-described by OpenRouter.
- New `visionTransport` config (`auto` | `harness` | `openrouter`) and a Settings
  control; `auto` prefers the harness and falls back to OpenRouter only when needed.
- New `design_studio` action `snapshot` and a **📷 Capture** button: a local headless
  Edge/Chrome/Chromium renders the actual served preview to
  `assets/images/preview-*.png` and returns it as an attached image block, so the model
  can inspect the rendered design instead of guessing from source. No npm browser
  dependency; a missing browser is reported honestly.
- Verified on `0.2.1-rc.2`: `deepseek-account/deepseek-flash` reports
  `["text","image"]`; harness review returned `VERDICT: GOOD` with the OpenRouter key
  unconfigured, and the design agent described an attached preview correctly.

### Changed — host runtime

- Design-agent chat now uses `ctx.subagents.startActivation({ provider, label, request,
  signal, delivery })` with `delivery: 'caller'`, `cwd` set to the design system and
  `maxDepth: 1` (the child is depth 1; 1 lets it run and blocks grandchildren). The persona is prepended to the prompt; the removed `persona` request
  field is gone.
- Session identity reads `exec.agent.id` (and `ctx.agents.list()` for liveness). The
  removed host `sessions` service is no longer used.
- The OpenRouter fallback uses Node's built-in `fetch` instead of `curl` and temporary
  request/response files. The API key travels only in the request header.
- ZIP export uses a built-in store-only ZIP writer; binary writes/deletes use a small
  Node helper through the subprocess seam; reveal opens the OS file manager
  (`open -R`, Explorer, `xdg-open`). No `sh`, `curl`, `zip`, `base64` or
  `screencapture` dependency remains.
- Path comparisons are normalized for Windows (`\` vs `/`), so freshness stamps and
  live activity now work on Windows.
- `temp_design_folder/` is created automatically on first use.
- Prompt preview URL is derived from `webServer.getOrigin()` instead of a hardcoded
  `127.0.0.1:3080`.
- Auto-delete config is now actually loaded (`autoDeleteWithSession`), so the sweep
  setting survives restarts.
- The leaked 12-minute agent-run race timer is cleared when the run settles.
- `fs/observed`, the prompt section, and the tool registration are owned by
  `ctx.effect`, so HMR/unload disposes them.

### Changed — client runtime

- `dsh.client.inject` now lists real current packages
  (`dsh-client-ui-conversation`, `dsh-client-ui-settings`, `dsh-client-ui-session`,
  `dsh-client-locale`) and sets `immediately: true`; the removed
  `@deepseek-ai/dsh-client-runtime` entry is gone.
- `conversation.view` uses the standard `props.sessionId`; the obsolete slot
  `inject` face and the conditional `useSession()` hook call were removed.
- “Ask DeepSeek” sends through `sessions.binding(id).session.prompt(..., 'queue')`
  instead of the removed `conversation.send` path, and now passes `verifyAfter` +
  `sessionId` so the post-edit design-agent verification is actually armed.
- The style tag is mounted and disposed by `apply()` instead of the lazy factory.
- Primary tab/section labels are localized through the client locale service.
- Removed the buggy **📸 Shot** screenshot-capture UI and its host API.

### Removed

- `lib` screenshot functions (`captureScreenRegion`, `screenshotSystem`,
  `studio.screenshot`).
- The unused `codingModel` setting (the design agent uses the harness default model).
- The legacy `dynamic/` prototype (reference-only code that could not survive restart).

### Compatibility

- Requires DSH `>=0.2.0-rc.2 <0.3.0` (tested on `0.2.1-rc.2`) and Node >= 22.
- Zero runtime dependencies; no install-time build step.

## 1.2.3 — earlier

- Design Studio tab, live preview, element picker, design agent, freshness stamps,
  vision review, identity presets, and the two-agent apply flow. See the git history
  for the 1.x changes.
