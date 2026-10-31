# Design → Compose: bridge decision memo

Research date: 2026-10-31. Scope: ten independent briefs (R1–R10) on closing the gap
between Design Studio mockups (`design-studio/<slug>/`) and a private Kotlin/Compose
Multiplatform app. Plugin checked out at v2.7.7.

This memo is repo-local: nothing here is installed into a DSH profile, and no code
was changed by the research agents.

## Verdict

1. **Build the deterministic half, not a converter.** Token export (CSS → Kotlin) and a
   browser-vs-Compose visual gate are worth building; HTML/CSS → Compose layout codegen
   is not, for this codebase, today.
2. **Adopt exactly three things**, all licence-clean: Roborazzi for Compose screenshots
   (Apache-2.0), Inter as the shared typeface (OFL-1.1), and the DTCG vocabulary as the
   token sidecar's shape. Everything else is either dead, cloud-only, or a new dependency
   the plugin is not allowed to take.
3. **The frozen mockup is the baseline.** Do not introduce a mutable Compose golden image.
   The design system already records a freeze with a content-addressed snapshot; render
   *that* in Chrome, render the app in Roborazzi, and score the pair. There is no baseline
   to "update until green".
4. **The plugin stays the orchestrator, not a code writer.** It parses, captures, runs the
   configured Gradle task, scores, and reports into its profile store. The agent (or the
   owner) writes generated Kotlin into the app repo.

## 0. Corrections to the brief

| Claim in the pack | What the evidence says |
|---|---|
| "JetBrains Relay" | It was **Google's** Relay for Figma + Relay for Android Studio: alpha as of 2025-02-10 ([archived docs](http://web.archive.org/web/20250316084315/https://developer.android.com/develop/ui/compose/tooling/relay)), reported "going away soon" in a 2025 Compose newsletter ([jetc.dev #256](https://jetc.dev/issues/256.html)), and its docs URL has 302-redirected to the Compose index since 2025-05-05 ([CDX](http://web.archive.org/cdx/search/cdx?url=developer.android.com/develop/ui/compose/tooling/relay&output=json&from=2025&to=2026)). Treat as retired; licence was proprietary and is unverified. |
| Plugin "v1.2.3" | The checkout is **2.7.7** (`package.json`, tag v2.7.7, 2026-10-22). |
| `htmlconvertercompose` converts HTML | It converts HTML **to `AnnotatedString`**, not composables or layout ([README](https://github.com/cbeyls/HtmlConverterCompose)). |
| Figma is the design source | It is not. The source is HTML/CSS from this plugin. Every Figma-input converter is therefore a category mismatch, not a shortcut. |

## 1. Adopt

| Thing | Why | Licence / cost |
|---|---|---|
| **Roborazzi 1.77.0** as the Compose renderer | Only surveyed option that is KMP-native: `roborazzi-compose-desktop`, `recordRoborazziDesktop`, `build/outputs/roborazzi`, `@Preview(widthDp, heightDp, fontScale)`; test-only, no runtime impact. | Apache-2.0. Test dependency + one Gradle plugin line. |
| **Inter**, served in the mockup and bundled in the app | The mockups already name Inter; Chrome falls back to system-ui, Compose falls back to Roboto. Without one font, every text diff is noise. | OFL-1.1. ~0.88 MB variable TTF. |
| **DTCG-style token sidecar** | Gives the export a stable, tool-readable shape (modes, types) without a runtime dependency. | Format spec / CG report; no licence obligation for using the vocabulary. |
| **The existing headless-Chrome capture** | Already in the plugin; reuse the launch flags (`--force-device-scale-factor=1`, fixed window) but capture to the profile store, not the design folder. | Already shipped. |

Why not the other renderers: Paparazzi 2.x is alpha-only (last stable 1.3.5, 2024-11-06)
and Android-layoutlib only; Google's Compose Preview Screenshot Testing is Android-only,
needs AGP 9.5 test suites, and its standalone plugin is documented as no longer maintained
([docs](https://developer.android.com/studio/preview/compose-screenshot-testing)).

## 2. Build

### 2.1 Token export (`token_export`)

New host module `lib/host/tokens.js`, wired as `createTokens(...)` next to the other
factories. One action, no Gradle.

**Parsing rules for the real token CSS** (validated against the frozen Hearth mockup:
49 tokens, two blocks, 28 light overrides, 25 colors, 14 px dimensions, 3 em trackings,
3 shadows, 1 easing curve, 3 font families):

- strip `/* … */` before scanning, then read `selector { --name: value; }` blocks;
- merge in cascade order: `:root` → `html[data-theme="…"]` → page token overrides
  (`css/pages/<id>.tokens.css`) when exporting a page;
- classify by name and value: color (`#hex`, `rgb[a]()`, `hsl[a]()`), dimension (`px`),
  tracking (`em`), font stack, shadow/glow, easing;
- `var(--x)` references are emitted as Kotlin aliases, not re-resolved;
- unrepresentable values (box-shadows, `color-mix()`, `backdrop-filter`) are **kept as
  commented raw strings and listed in `warnings`** — never silently dropped;
- ordering is source order within each block; the header carries the design stamp hash,
  never a timestamp.

**Outputs** (profile store, never the design folder):

- `_studio/exports/<slug>/tokens.json` — modes, typed values, source stamp, warnings;
- `_studio/exports/<slug>/DesignTokens.kt` — `object Dark`, `object Light`, dimens,
  type sizes, families; a package name from config (default `com.goodchat.design`);
- `Theme.kt` is **hand-written once** per app, not regenerated: a `CompositionLocal`
  `DsTokens` plus a derived Material 3 `ColorScheme` so stock components inherit the
  palette. M3 alone cannot carry radii, shadows, or a third accent mode.

Regeneration is byte-stable; a `--check` mode (hash in header vs recomputed) makes drift
fail review. The action works while a design is frozen, because it only reads.

### 2.2 Match gate (`match`)

The gate compares the **frozen mockup** with the **current app**, at one viewport:

1. refuse unless `frozen: true` and the current stamp matches the freeze snapshot —
   "design not frozen — freeze it first so the baseline cannot move";
2. browser PNG via a new `capturePreviewToPath(slug, {width,height,dest})` — the existing
   `capturePreviewToSystem` writes `assets/images/preview-*.png` *inside* the design and
   therefore bumps the stamp and history; do not reuse it;
3. Compose PNGs: run `./gradlew <configured task>` in `compose.project` (Roborazzi writes
   `build/outputs/roborazzi`), or use `composeDir` for CI/pre-generated PNGs;
4. diff, score, write a run report and one ledger row; return the failure text.

**Metrics** (plain JS, PNG decode via `node:zlib`; no dependency):

- align by integer offset in ±6 px on a 4× downscale; report any non-zero offset;
- `layout` = edge recall: browser edge pixels covered by Compose edges dilated 2 px;
- `color` = mean ΔE76 on flat, non-text pixels;
- `match` = 100 × (1 − changed fraction), where a pixel is changed when ΔE > 4 and it is
  not in the AA/text mask (local gradient in either image);
- regions = 6×8 grid; report the worst three cells with pixel coordinates.

**Gate defaults**, calibrated, not copied: `layout ≥ 0.97`, `color ≤ 4`, `match ≥ 95`,
`offset = 0`. Failure text is one line, for example:

> design match 91% (layout 0.94, color ΔE 4.1) — worst: header band (y 0–112), card grid
> (x 640–960, y 224–448), accent fill #3BE1EC vs #35D6E0. No baseline was changed.

**No Compose golden, no baseline update.** The ledger is append-only; an owner may
"mark accepted" in the Port panel, which records reviewer/time/PNG hashes for that run.
Because the only reference is the frozen snapshot, the classic "update the baseline until
it passes" loop does not exist: were the mockup to change, the design stamp changes and
every prior row becomes `stale` instead of quietly green.

Ledger row: `schemaVersion, slug, pageId, design{stampHash, snapshotId, frozenAt},
viewport{w,h,scale}, browser{sha256,url,at}, compose{sha256,task,project,commit?},
tokens{sha256}, metrics{match,layout,color,offset,worst[]}, thresholds, status,
review{by,at,decision}|null, notes`.

### 2.3 Port panel

Add a `port` entry to the tab array in `lib/client/src/studio-view.js` (the
`[['preview', …], …]` list rendered at the top) and a `PortPanel` component in
`lib/client/src/port-panel.js`, following the `AssetsModal`/`HistoryPanel` pattern.
It shows: configured project (or the empty state), page list with last score/status,
"Run match", the latest diff image, worst regions, and "Mark accepted" (owner-only).
A `Compose` block in `settings.js` holds project path, module, task, viewports, and
package name; labels go in `labels.js` (en + zh).

### 2.4 File-by-file change plan

| File | Change |
|---|---|
| `lib/host/tokens.js` | new: `parseTokenCss`, `buildTokenModel`, `renderKotlin`, `exportTokens` |
| `lib/host/match.js` | new: `decodePng`, `toLab`, `edgeMap`, `align`, `scorePair`, `runMatch` |
| `lib/host/gradle.js` | new: `createGradleRunner` with per-project lock, argv-only spawn, timeout/grace |
| `lib/host/preview.js` | add `capturePreviewToPath` (no design-folder writes) |
| `lib/host/config.js` | `compose: {project, module, task, packageName, viewports}` defaults + validation |
| `lib/index.js` | wire factories; tool enum + cases `token_export`, `match`, `match_report`; api `studio.tokens.export`, `studio.match.run/report/approve`; do **not** add these to the frozen-block sets |
| `lib/client/src/port-panel.js` | new panel |
| `lib/client/src/studio-view.js` | tab entry + render branch |
| `lib/client/src/settings.js` | Compose config block |
| `lib/client/src/labels.js` | `tab.port`, panel strings, en/zh |
| `tests/host.test.mjs` | parser, stability, diff fixtures, config validation |

## 3. Refuse

### 3.1 Figma→Compose converters

| Project | Licence | Last commit | Emits layout | Usable |
|---|---|---|---|---|
| CaelumF/FigmaToCompose | **unverified (no LICENSE)** | 2022-08-28 | yes | no |
| cinkhangin/composer | Apache-2.0 | 2026-07-27 | visual designer, not importer | partly |
| naver/design-to-ui | Apache-2.0 | 2026-08-11 | via Claude + Figma MCP | recipe only |
| Variables Converter | Apache-2.0 | 2026-06-11 | tokens only | yes (tokens) |
| Style Dictionary `compose/object` | Apache-2.0 | 2026-10-28 | tokens only | yes (tokens) |

Reject all as vendoring candidates. The only layout-capable one has no licence file and
targets Compose rc-02; the rest are Figma-input. Rejecting the unlicensed one is
mandatory under the pack's own rule.

### 3.2 General HTML/CSS→Compose codegen

No maintained generator exists: the two closest tools stop at `AnnotatedString`
(cbeyls) and Compose-for-Web DOM (Foso, last push 2023). `float`, `backdrop-filter`,
pseudo-elements, and `grid-template-areas` have no faithful equivalent; an annotated
subset covering six primitives could generate ~80% of static structure, but the real
mockups carry no `data-compose` annotations, and a regenerating generator competes with
hand-edited Compose. **Defer**, do not refuse forever: revisit if porting throughput
exceeds ~3 screens/week, and then generate against `data-ds` primitives rather than
generic `Box` trees.

### 3.3 Cloud design-to-code

Builder.io is the only surveyed tool that emits Compose, and it is cloud-only and
Figma-input ([pricing](https://www.builder.io/pricing)). Supernova ships tokens/docs, not
UI code; Locofy and Anima have no Kotlin route; DhiWise redirects to Rocket.new. Privacy is
the deciding factor: Figma plugins can read every layer by default, and Builder.io's
no-training carve-out applies only to Team/Enterprise. Our design source never leaves the
Mac today; keep it that way.

### 3.4 Things that look reasonable but are not

- **Style Dictionary at runtime**: it is a Node dependency, and the plugin's zero-dep,
  no-install-build promise is a feature. Parse the 49-token CSS directly; keep the
  `compose/object` output shape as a reference.
- **A single "match %" as the only gate**: it hides a 2 px shift behind a global score.
  Report layout, colour, and match separately, plus regions.
- **A mutable Compose golden**: rejected in §2.2.
- **The plugin writing generated code into the app repo**: it runs Gradle in the repo
  (build output only) but writes files only to its profile store. Generated Kotlin is
  applied by the agent under review. This keeps the write contract ("design-system folder
  only") intact and keeps the plugin usable by other owners.

## 4. First two slices

### Slice 1 — Token export (S)

Deliver `token_export` end-to-end: parser, Kotlin renderer, profile artifacts, tests, docs.

Acceptance:

- [ ] The Hearth token file (copied as a test fixture) parses to 49 tokens, 2 modes,
      28 light overrides; values classified
      (25 color, 14 dimension, 3 em, 3 shadow/glow, 1 easing, 3 families).
- [ ] Two runs produce identical `DesignTokens.kt` bytes; header carries the stamp hash
      and source path, not a timestamp.
- [ ] `warning`s list every unrepresentable token (shadows, `var()`-composed values);
      nothing is dropped silently.
- [ ] Works while frozen; does not bump the design stamp; writes only under
      `_studio/exports/<slug>/`.
- [ ] No new dependency; `npm run check` and `npm test` green; unit tests cover the parser,
      alias handling, and stability.
- [ ] `action=token_export` returns a summary + suggested repo path; it does not write
      into the repo.

### Slice 2 — Match gate (M)

Deliver `match` + `Port` panel: frozen-design check, browser capture to profile, Gradle
runner with lock, diff metrics, ledger, UI states.

Acceptance:

- [ ] Unfrozen design → error "design not frozen — freeze it first so the baseline cannot
      move"; no capture, no Gradle.
- [ ] No Compose project → typed state `{configured:false, reason:"…"}` in `list` and the
      panel; `match` returns the setup hint, no side effects.
- [ ] Second concurrent run → "a match run is already in progress for <project> (started
      <ISO>); wait or cancel"; never two Gradle processes in one project.
- [ ] Identical PNGs → 100 / layout 1.0 / ΔE 0; a 6 px shift → offset 6 → gate fails
      with "layout offset"; a hue shift → colour fail; a missing card → worst-region line.
- [ ] Capture dimensions must equal the requested viewport; a mismatch fails with the
      actual size.
- [ ] Report + ledger written under `_studio/ports/<slug>/`; repo untouched except
      Gradle's own build outputs.
- [ ] "Mark accepted" is UI-only and records reviewer/time/hashes; there is no tool
      action to approve a run or move a baseline.
- [ ] Tests build PNG fixtures in code (no binary fixtures) and cover 100/partial/fail.

Non-goals for both slices: layout codegen, component-tree diffing, Android instrumentation,
font-scale 200%, multi-viewport in one run, per-node `testTag` ↔ `data-ds` mapping.

## 5. Risks and decision triggers

- **Text rasterisation** differs between Skia (Compose) and Chrome. Mask AA, pin one OS in
  CI, bundle the same font, and never claim pixel identity — the gate is about structure
  and palette, not glyphs.
- **Desktop target assumption**: Roborazzi's desktop path needs a JVM/desktop target and
  headless-capable Skiko. If the app only has Android, fall back to Robolectric with
  `@Config(qualifiers="w390dp-h844dp-mdpi")`; the diff logic is unchanged.
- **Version drift** is the recurring cost: CMP trails Jetpack Compose by 1–3 months and the
  compiler plugin must match Kotlin. Keeping the emitted surface to tokens + screenshots
  (not Compose API calls) limits the blast radius.
- **Stage gate**: do not enforce the gate in CI until it has been calibrated on at least
  three known-good and three known-bad pairs at the target viewport.
- **Revisit codegen** only if porting throughput becomes the bottleneck; the annotation
  contract in R7 is the starting design if that happens.

## Evidence

- Relay: [archived overview](http://web.archive.org/web/20250316084315/https://developer.android.com/develop/ui/compose/tooling/relay),
  [capture history](http://web.archive.org/cdx/search/cdx?url=developer.android.com/develop/ui/compose/tooling/relay&output=json&from=2025&to=2026),
  [jetc.dev #256](https://jetc.dev/issues/256.html).
- Roborazzi: [repo](https://github.com/takahirom/roborazzi) (Apache-2.0),
  [Compose Desktop/KMP guide](https://github.com/takahirom/roborazzi/blob/main/docs/topics/compose_multiplatform.md),
  [Maven artifact](https://repo1.maven.org/maven2/io/github/takahirom/roborazzi/roborazzi-compose-desktop/).
- Paparazzi / Google screenshot testing: [Paparazzi](https://github.com/cashapp/paparazzi),
  [Compose Preview Screenshot Testing](https://developer.android.com/studio/preview/compose-screenshot-testing).
- Tokens: [DTCG 2025.10](https://www.designtokens.org/tr/2025.10/format/),
  [Style Dictionary Compose format](https://styledictionary.com/reference/hooks/formats/),
  [Inter / OFL](https://github.com/rsms/inter/blob/master/LICENSE.txt).
- Diff practice: [pixelmatch](https://github.com/mapbox/pixelmatch) (ISC),
  [Playwright screenshot assertions](https://playwright.dev/docs/api/class-pageassertions),
  [Chromatic threshold](https://www.chromatic.com/docs/threshold/).
- HTML/CSS tools: [HtmlConverterCompose](https://github.com/cbeyls/HtmlConverterCompose),
  [Foso HTML→Compose HTML](https://github.com/Foso/HtmlToComposeHTMLConverter).
- Market: [Builder.io pricing](https://www.builder.io/pricing), [Supernova pricing](https://www.supernova.io/pricing),
  [Figma plugin security](https://help.figma.com/hc/en-us/articles/360042532714),
  [CMP compatibility](https://kotlinlang.org/docs/multiplatform/compose-compatibility-and-versioning.html).
- Plugin internals: `lib/index.js:1710` (`apiDispatch`), `:1876` (route),
  `:1945` (action enum), `:1996` (tool dispatch), `lib/host/preview.js` (capture),
  `lib/host/node-io.js` (`subprocess.spawn`), `lib/client/src/studio-view.js:1308` (tabs),
  `lib/client/src/index.js:31` (slot registration).
