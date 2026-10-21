# Repository guide

This repo is the `@sal7one/dsh-design-studio` DSH plugin. It ships the
`design_studio` agent tool, the Design Studio conversation tab, and the
`/design-studio` preview route.

## Design work

When the task is a design brief or an edit to a mockup:

1. Load the repo skill: `skills/design-studio/SKILL.md`.
2. Read `docs/design-studio-handbook.md` for the full workflow.
3. Use the `design_studio` tool; design files live in the workspace
   `design-studio/<slug>/` (legacy profile `temp_design_folder/` designs remain
   readable). Do not hand-assemble the layout or write outside the design folder.
4. Check `design_studio action=list` and the freshness stamp before editing.
5. If `frozen` is true, stop design work: do not write the mockup or call the
   design agent. Work in the recorded `freeze.implementation` target; if none is
   recorded, ask where the implementation lives. Only thaw on an explicit
   operator request.
6. Keep all mockups static: no app/game logic, state machines, persistence,
   network calls, business rules, or fabricated live data.
7. One design can have several business pages (`page_list`, `page_create`,
   `pages/<id>.html`). Create a page only for a new business screen/flow; keep
   sidebars, drawers, modals, tabs and filters as in-page overlays on the current
   page. Page-scoped styles go in `css/pages/<id>.tokens.css`; global tokens stay
   in `css/token.css`.
8. Capture a preview and inspect it for layout/contrast/responsive failures
   before declaring the design done.

These files are **repo-local**. They are not installed into a DSH profile yet;
do not assume the `design-studio` skill is in the DSH skill catalog.

## Plugin code

- Host code: `lib/host/`, orchestrator `lib/index.js`.
- Client source: `lib/client/src/`; `lib/client.js` is generated and committed.
- After client changes: `npm run build:client`.
- Validate: `npm run check` and `npm test`.
- Do not add a `prepare` script; the published package must not build on install.
- Do not package research clones or `temp_design_folder/`.

## Research

`research/` contains ignored reference checkouts (QaLense, style-atlas source).
They are not dependencies and must never be packaged. Read
`docs/device-ui-reconstruction.md` before proposing device UI-tree imports; that
pipeline is design research, not a shipped feature.
