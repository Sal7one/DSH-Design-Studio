---
name: design-studio
description: Build, edit, preview, style, snapshot, and review Design Studio UI mockups through the design_studio tool. Use for landing pages, dashboards, app screens, style exploration, selected-element edits, and visual reviews. Mockups only — no app or game logic.
---

# Design Studio

Use this skill when a request is a design brief or a change to a Design Studio
mockup. Read [the handbook](../../docs/design-studio-handbook.md) for the full
reference; this skill is the working procedure.

## First moves

1. Check whether a design system already exists:
   ```text
   design_studio action=list
   ```
2. If creating, choose a lowercase slug and call `action=create`.
3. If editing, compare the returned stamp hash with your last known value. A
   changed stamp means another editor touched the files; trust the current files
   and re-read before editing.
4. Read `design_prompts_forcoders.md` and the relevant HTML/CSS before changing
   anything.

Never invent file contents or claim a design exists without checking.

## Hard rules

- HTML + CSS + minimal presentation JS only.
- No game engines, win/turn logic, state machines, persistence, auth, network
  calls, business rules, or real endpoints.
- Demo data is read-only and honest. Never fabricate live numbers.
- No secrets, keys, private URLs, or production endpoints.
- Writes stay inside the design system folder.
- Use the style atlas attribution and `THIRD_PARTY_NOTICES.md` as-is.

## Create workflow

```text
design_studio action=create slug=<slug>
```

Then write:

- `html/index.html` — semantic structure and real content order
- `css/token.css` — palette + typography tokens
- `css/style.css` — layout, components, responsive states
- `js/app.js` — presentation-only interactions (or leave minimal)
- `design_prompts_forcoders.md` — the full brief: direction, layout, type,
  color, states, responsiveness, constraints

Check the rendered result with `action=snapshot`, fix overflow/contrast/focus,
then `action=zip` and report:

```text
http://<harness-origin>/design-studio/<slug>/html/index.html
```

## Edit workflow

1. For a selected element, read `EDIT_REQUEST.md`. It contains the target
   selector, classes, computed styles, snippet, and operator request.
2. Read the target and its parent layout. Prefer targeted `edit` changes.
3. Apply the change and clean up anything that only existed for the old state
   (empty wrappers, dead rules, orphaned classes).
4. Re-snapshot if the change is visual.
5. Reply with a short file-level summary.

The main conversation agent is the primary editor. Call the design agent only
for a precise visual question; it is not a substitute for editing files.

## Design freeze (implementation mode)

A design system can be frozen as a read-only handoff.

- `design_studio action=list` returns `frozen: true` and a `freeze` record with
  `implementation` and `finalSnapshot`.
- The implementation target defaults to the current conversation project (the
  UI shows a project selector); if a record is empty, ask the operator.
- While frozen, **do not edit the mockup**. Do not call write, style apply/asset
  changes, history restores, ingest, delete, or the design agent.
- Work in the recorded `freeze.implementation` target instead. If it is empty,
  ask the operator where the implementation lives.
- Only the operator thaws it. `action=unfreeze` is for an explicit operator
  request, not a workaround.
- Read/snapshot/review/zip/open remain allowed. Freeze is a tool/context guard,
  not a filesystem ACL.

If the operator asks for a design change while a design is frozen, clarify:
implementation change (work in the target) or design change (ask them to thaw).

When you believe a design is complete, ask one `ask_user_question` with exactly
three choices: **Keep refining**, **Freeze only**, **Freeze & implement**. Act on
the answer; ask once per design, not after every edit. Skip the gate when the
operator already approved or asked to implement. If the question tool is
unavailable, use a short numbered question with the same choices.

## Styles

- `design_studio action=style_list` lists styles; `style_apply` applies one.
- The UI opens a grid by default. **Try them now** runs a horizontal tour above
  the preview; arrow keys auto-preview each style on the current design.
- Style apply captures a `before-style` snapshot and exposes Undo apply.
- Preserve design-specific custom CSS variables when applying styles.
- Never import the style data from the research checkout at runtime; the atlas is
  vendored and attributed.

## History and safety

- Every design has content-addressed snapshots under `_studio/history/<slug>/`.
- Auto-capture follows edits; style applies and design-agent turns also snapshot.
- Use `action=snapshot_save` before a broad refactor if you want a named point.
- `action=snapshot_undo` moves to the parent snapshot; `snapshot_restore`
  restores a specific one. Restores are reversible.
- Do not delete or rewrite history to “clean up”; it is the evidence trail.

## Vision

- If the active model supports image input, `snapshot` returns an inspectable
  image and `review` can judge it.
- If it does not, a warning appears in the selection editor. Do not claim to
  have seen pixels. Use `review` only if the OpenRouter fallback is configured;
  otherwise reason from files and state that visual verification is unavailable.
- A design-agent reply is not proof pixels look correct unless it actually had a
  visual route.

## Assets

- Use `asset_list`, `asset_import` (local path), `asset_upload` (data URL), and
  `asset_delete`.
- Assets are sha256-deduplicated and recorded in `assets/assets.json`.
- Respect ownership and privacy; do not re-host proprietary images.

## Quality gate

Before declaring done:

- Desktop/tablet/mobile layouts hold; no horizontal overflow.
- Focus states are visible; buttons/links are real elements.
- Body/muted contrast is readable.
- Reduced motion is respected.
- Empty/loading/error states are honest.
- `design_prompts_forcoders.md` matches what was built.
- Preview URL works; zip is refreshed.

For plugin code changes, use `npm run build:client`, `npm run check`, and
`npm test`.
