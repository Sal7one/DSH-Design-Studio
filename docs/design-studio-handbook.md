# Design Studio handbook

Knowledge for agents and maintainers working with the Design Studio plugin. This
is a repo-local handbook; it is not installed into a DSH profile.

## 1. What this plugin is

A persistent Design Studio in the **current workspace** under
`design-studio/`, with:

- a `design_studio` agent tool (create/read/write/zip/history/styles/assets/review/agent);
- a `/design-studio/<slug>/html/index.html` live-preview route;
- the built-in Design Studio conversation tab (preview, pages, styles, agent,
  assets, history, review, upload; its ⚙ Settings button opens the shared
  DeepSeek Design Studio settings page);
- identity presets, attribution-backed style atlas, content-addressed history,
  vision review, and a real harness-subagent design agent.

All design systems are **UI mockups**. They are not applications, games, ports,
or runtime integrations.

## 2. Non-negotiable mockup rules

- HTML + CSS + minimal presentation JS only.
- No game engines, turn/win logic, state machines, persistence, auth, network
  calls, business rules, or real endpoints.
- Interactive states are visual or trivial DOM toggles.
- Data is read-only demo data. Never fabricate live numbers; empty/loading/error
  states must be honest.
- No secrets, keys, tokens, or private production URLs.
- Use local assets or the asset library; credit third-party data and code.

## 3. Design system layout

```text
<workspace>/design-studio/<slug>/
  html/index.html
  css/style.css
  css/token.css
  js/app.js
  design_prompts_forcoders.md
  assets/assets.json
  assets/images/*
  _studio/history/<slug>/{objects,trees,index.json}
  EDIT_REQUEST.md            # created by element selection
  preview.png                # captured preview
```

Global config/presets and the slug registry stay in the profile; legacy designs
made before workspace-local storage remain readable from `temp_design_folder/`.

`design_prompts_forcoders.md` is the implementation brief: visual direction,
layout, type, color, interaction/state notes, responsive behavior, constraints.
Keep it in sync with the files.

## 4. UI map

Tabs: **Preview, Pages, Styles, Agent, Assets, History, Review, Upload**.
The workspace **⚙ Settings** button opens the one shared DeepSeek settings
surface; the conversation tab does not mount a second settings page.

The workspace bar above the tabs includes a **Design** selector. It lists every
visible design, marks frozen ones with 🔒, and switches the preview, files,
history, assets, styles and freeze state. Studio-wide settings (vision, capture
size, agent preset) are global, not per design.

- **Preview** — live iframe, `1:1` (default, large design area with scrolling) /
  `Fit` (scales the whole device into the stage), desktop/tablet/mobile frame,
  element Select, snapshot/review,
  OS-browser open. The style tour appears above the iframe while active.
- **Styles** — gallery grid (default) and a large **Try them now** button that
  opens the horizontal style tour above the preview. `←`/`→` auto-try styles;
  Apply captures a pre-style snapshot and exposes Undo.
- **Agent** — design-agent chat, separate from the main conversation.
- **Assets** — embedded asset library; the full-screen overlay has top clearance
  for OS window controls. Upload/import dedupe by sha256.
- **History** — snapshot list, restore, undo.
- **Review** — capture and vision review; shows harness/OpenRouter route.
- **Upload** — file drop-in.
- **Pages** — artboard canvas for multiple business pages. New pages live at
  `pages/<id>.html`, with page CSS/JS/token overrides under `css/pages` and
  `js/pages`. The Preview toolbar has a Page selector. Create a page only for a
  new business screen/flow; sidebars, drawers, modals, tabs and filters are
  in-page overlays with a blurred/inert backdrop, not pages.

### Page-scoped styles

The Styles tab has **This page / All pages** scope; the default is configurable
in **Settings → Design Studio → Default style apply scope**. Page scope writes
`css/pages/<id>.tokens.css` and leaves `css/token.css` untouched; All pages scope
writes the shared tokens. Pages share assets and the shared `style.css`. Zip,
freeze, history, and design delete operate on the whole design root, so every
page is included.
- **Settings → Design Studio** — one settings entry with **Preferences** and
  **All designs** tabs. Preferences covers vision transport/models, review style,
  default style apply scope, capture size, agent preset and related options. All
  designs groups the library by workspace with search, status filters, counts,
  latest ZIP dates and preview/zip/show-in-folder/delete actions.

Selection flow: clicking an element opens the change editor. **Enter** sends to
Ask DeepSeek; **Shift+Enter** adds a line; **Save only** writes
`EDIT_REQUEST.md` without sending. A no-vision warning appears when the active
model cannot see images. Delete is a two-step action with a Cancel button.

## 5. Tool actions

Use the `design_studio` tool. Read files with the read tool after listing; never
assume a file exists.

Common actions:

| Goal | Action |
|---|---|
| Discover systems | `list`, `all` |
| Create scaffold | `create` |
| Read a file | `read` |
| Write a complete file | `write` |
| Package | `zip`, `reveal` |
| Capture preview PNG | `snapshot` |
| Open OS browser | `open` |
| Asset library | `asset_list`, `asset_upload`, `asset_import`, `asset_delete` |
| Edit history | `history`, `snapshot_save`, `snapshot_restore`, `snapshot_undo` |
| Styles | `style_list`, `style_apply`, `style_save`, `style_delete`, `style_create` |
| Identity presets | `presets`, `preset_save`, `preset_apply`, `preset_delete` |
| Vision review | `review` |
| Design agent | `agent`, `agent_history` |
| Vision settings | `config` |

The preview URL is:

```text
http://<harness-origin>/design-studio/<slug>/html/index.html
```

Use `open` when the DSH in-app browser is unsuitable; it launches the OS browser.

## 6. Create a new mockup

1. Pick a lowercase slug.
2. `design_studio create` (scaffolds tokens, CSS, HTML, JS, prompts).
3. Write the brief in `design_prompts_forcoders.md`.
4. Build the page in `html/index.html` + `css/style.css` + `css/token.css`.
5. Keep `js/app.js` presentational only.
6. Snapshot and inspect the rendered preview. Fix overflow, contrast, focus,
   and responsive breakpoints.
7. `zip`; report the live preview URL.

Before designing, check `design_studio list` so you do not overwrite or duplicate
an existing system.

## 7. Edit an existing mockup

- Run `design_studio list` first and compare the returned stamp hash with your
  last known value. If it changed, someone else edited the design; trust the
  current files.
- Read the relevant files before editing. Prefer targeted `edit` changes over
  rewriting whole files.
- Keep visual changes coherent with the design language and token vocabulary.
- Re-snapshot after meaningful visual changes.
- Use manual `snapshot_save` before broad or risky refactors; style apply and
  AI edits already snapshot automatically.

## 8. Selected-element edits

The UI element picker writes `EDIT_REQUEST.md` with the selector, classes, style
snapshot, and operator request, then:

- **Enter / Ask DeepSeek** sends the request to the main conversation. The main
  agent is the primary editor.
- **Make external agent do it** sends the request to the design-agent chat.
- **Save only** writes the request without sending.

As the primary editor:

1. Read `EDIT_REQUEST.md`.
2. Read the target component and parent layout.
3. Apply the change with file tools.
4. Ensure cleanup (for example, remove now-empty wrappers or dead rules).
5. Re-snapshot when the change is visual.
6. Reply with a short, file-level summary.

The design agent should only be called for a precise question it can answer, not
as a replacement for the primary editor.

## 9. Styles and the style tour

- The Styles tab is a **grid by default**.
- **Try them now** opens a horizontal style tour above the preview. Each flip
  auto-previews that style on the current design; `←`/`→` step, Apply keeps it,
  Close reverts.
- Applying captures a `before-style` snapshot and exposes Undo apply in the
  preview bar and Styles panel; History can restore it later.
- **Try another random** picks from the current filtered pool.
- Style data is attributed to `dsh-ui-ux-pro-max` (MIT). Keep
  `THIRD_PARTY_NOTICES.md` intact.
- The atlas is vendored; never make the plugin depend on the research checkout
  or a submodule.

## 10. History

History is content-addressed:

```text
_studio/history/<slug>/objects/<sha256>
_studio/history/<slug>/trees/<sha256>.json
_studio/history/<slug>/index.json
```

Snapshots are parent-linked with a head cursor. Restore writes the tree and
moves the head; it never deletes later snapshots. Auto-capture is debounced
(approximately 2.2s after edits settle); design-agent turns capture explicitly;
style apply captures the pre-style state.

- `history` lists snapshots.
- `snapshot_restore` restores a specific snapshot.
- `snapshot_undo` moves to the parent of the current head.
- A restore first captures a `before-restore` state so the operation is reversible.

## 11. Vision and review

Two routes:

1. **Harness vision** when the active model advertises image input.
2. **OpenRouter fallback** when configured with a vision model.

Without either, the selection editor warns: the model can edit files but cannot
see the rendered preview. Do not claim visual verification in that state. The
design agent must reason from files and say so.

`review` returns a `GOOD | POOR` verdict and notes. `snapshot` writes a PNG and
returns it as an attached image when the harness supports images. Capture and
review can fail gracefully; treat failures as evidence limits, not as a pass.

## 12. Vision for device captures

The repo includes research for importing real device UI trees (QaLense,
uiautomator, Appium) in
[device-ui-reconstruction.md](device-ui-reconstruction.md). That pipeline is not
shipped yet. Do not claim a live device import or "any app" reconstruction.

## 13. Responsive and accessibility checklist

- Desktop, tablet, and mobile frames all render.
- No horizontal overflow at the smallest supported width.
- Focus states are visible; links/buttons are real interactive elements.
- Contrast passes for body and muted text.
- Motion respects `prefers-reduced-motion`.
- Images have alt text; decorative SVGs are hidden from assistive tech.
- Empty/loading/error states are honest.
- Text remains readable at 1:1 by scrolling; use Fit for an overview.

## 14. Assets

- The manifest is `assets/assets.json`; images live under `assets/images/`.
- Upload/import deduplicates by sha256 and stores MIME, dimensions, and alt text.
- Do not extract or re-host proprietary assets without permission.
- Delete removes the manifest entry/file; confirm before destructive changes.

## 15. Design freeze

Freeze is the explicit handoff from design to implementation. It is **per design
system**, not a global switch.

- The Studio shows a large **❄ Finish & freeze design** button. Freezing captures
  a final snapshot, refreshes the zip, and records:
  - slug, timestamp, design stamp
  - final snapshot id
  - implementation target — **defaults to the current conversation project**
    (session cwd); the selector also lists other live chat projects, workspaces
    that already contain designs, and recent freeze targets, with a custom-path
    fallback
  - optional handoff note
- `design_studio list` / `all` return `frozen` plus the `freeze` record.
- While frozen:
  - `write`, style apply, asset upload/import/delete, ingest, history
    restore/undo, selection saves, delete, and design-agent chat are blocked
  - `read`, `list`, `snapshot`, `review`, `zip`, and `open` still work
  - the UI hides/disables edit paths and shows a read-only banner
- The implementation agent must **not** edit the mockup. It should work in the
  recorded `freeze.implementation` target. If no target was recorded, ask the
  operator where the implementation lives.
- Only the operator thaws the design. Thaw is an explicit confirmation; then the
  mockup becomes editable again.
- Freeze is a context/tool guard, not a filesystem security boundary. A direct
  file tool could still write the mockup; the agent instructions and tool guard
  are what prevent the normal flow. Detect changes after freeze as drift and do
  not silently treat them as the frozen state.

This is how to avoid the “design or code?” ambiguity: frozen means implementation
mode; unfrozen means design mode.

The plugin injects this workflow into the DSH system prompt, so operators do not
need to restate “build the mockup only”, “when I say freeze”, or “implement the
frozen design”. “Done / looks good / LGTM / freeze” is enough to trigger the
handoff; “freeze and implement” does both. Freeze defaults to the current
conversation project.

At design completion the agent should ask **one** native `ask_user_question`
with three choices — **Keep refining**, **Freeze only**, **Freeze & implement** —
and act on the answer. Ask once per **completed revision**, not after every tiny
edit. After **Keep refining** and the next revision, ask again with the native
question tool; do not substitute a plain-chat question while the tool is
available. Skip the gate when the operator already approved or asked to
implement. If the question tool is unavailable, use a short numbered question
with the same choices.

## 16. Safety

- Writes are scoped to the design system's `design-studio/<slug>/` folder
  (legacy profile designs remain under `temp_design_folder/<slug>/`); do not escape it.
- Never put credentials in mockups, prompts, snapshots, or asset manifests.
- The OpenRouter key is a credential reference; its value is never returned.
- Research clones under `research/` are reference-only and ignored; never package
  them.
- Do not add runtime dependencies without a clear maintenance reason.

## 17. Maintainer verification

For plugin changes:

```bash
npm run build:client
npm run check
npm test
```

`lib/client.js` is generated and committed. `npm test` targets the two test files
explicitly so ignored research checkouts are not discovered.

## 18. Storage and upgrades (2.7.0)

- New designs: `<workspace>/design-studio/<slug>/`. They are ordinary workspace
  files, readable by any agent scoped to that workspace. They stay visible in
  every conversation rooted at that workspace, not only the chat that created
  them; the session orphan sweep skips workspace designs.
- Profile `temp_design_folder/` retains global config, presets, the slug
  registry, and legacy designs made before 2.7.0.
- Legacy designs are **not auto-migrated**. They stay readable in the Studio,
  but a workspace-only agent may not have access to the profile path. New work
  should use a new workspace design.
- Slugs are unique across the registry and legacy designs; a same-slug create in
  another workspace is rejected rather than overwriting the registry.
- The plugin's fs service may be narrower than the workspace agent policy. When
  a design text write is denied, the plugin falls back to the same Node write
  seam used for binary assets; this is why workspace files still land.
- Preview, zip, assets, history, styles, freeze and delete resolve the registered
  root per design; list/all expose the absolute `root`.
- Delete removes the design's history directory as well as the design folder,
  zip, freeze record and request marker.
