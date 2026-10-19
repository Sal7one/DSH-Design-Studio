# Device UI trees → Design Studio reconstruction

Research note for importing a real Android/iOS app screen into Design Studio as a
read-only, editable mockup. QaLense is the reference on the capture side, but it
does not reconstruct screens itself.

## Short answer

- **Do not modify a third-party app.** Use ADB `uiautomator` (universal Android)
  or Appium/XCUITest (cross-platform) to read a hierarchy, plus a screenshot.
- **For our own Jetpack Compose apps**, integrate QaLense as a
  `debugImplementation` only. That gives the richest tree: Compose semantics,
  roles/actions, bounds, windows and tree paths. Production stays untouched.
- **QaLense alone is not enough for “any app.”** Its inspection is visible
  Compose semantics from attached roots; native Views, WebViews and private
  state are explicitly outside it.
- **Never reconstruct from the tree alone.** Trees carry structure and text but
  no colors, fonts, corner radii, images or elevation. Combine:
  - screenshot for visual truth,
  - UI tree for geometry, text and semantics,
  - style inference for an editable approximation.
- Label the result honestly: **“Reconstructed from a captured UI tree; styling is
  approximated.”** It is not a port of the app and must stay a read-only mockup.

## Capture options

| Source | App modification | Structure | Style | Platform | Notes |
|---|---|---|---|---|---|
| ADB `uiautomator dump` + `screencap` | none | good for native Views; limited Compose | screenshot only | Android | best universal fallback; Python stdlib |
| QaLense SDK + local bridge | QA/debug build only | best for Compose (`InspectNode`: bounds, role, actions, parentId, windows) | screenshot only | Android Compose | Python bridge already exists; native/WebView outside |
| Appium / WebDriverAgent | none | good | screenshot only | Android/iOS | heavier server/driver stack; best cross-platform |
| AccessibilityService helper | none (install + consent) | good for any app | screenshot only | Android | continuous/event capture; privacy-sensitive; not Playwright-style DOM |
| `adb shell dumpsys` / Layout Inspector | debuggable app | view hierarchy; Compose limited | limited | Android | not a reliable general capture API |
| Root/Xposed | yes | deep | no | Android | reject: security, distribution and support risk |

### ADB universal baseline (no dependency)

```text
adb shell uiautomator dump --compressed /sdcard/window.xml
adb exec-out cat /sdcard/window.xml
adb exec-out screencap -p
```

Each node carries `bounds`, `class`, `text`, `resource-id`, `content-desc`,
`clickable`, `scrollable`, `checkable`, `checked`, `enabled`, `focused` and
`package`. Convert `[l,t][r,b]` to a normalized rectangle. Take the screenshot
immediately before/after the dump; Android UI can change between calls.

Limits: Compose often exposes only merged semantics; WebView/Flutter/Canvas can
appear as one node; secure windows and system overlays differ; no colors/fonts;
status/navigation bar insets must be accounted for.

### QaLense bridge (best for our Compose apps)

QaLense's local bridge already exposes a Python service over loopback:
`/api/snapshot`, `/api/component`, `/api/screenshot`, `/api/query`,
`/api/command` and pairing/forwarding. Its `InspectionSnapshot` contains
`screen`, `device`, `nodes` and warnings; each node has an `id`, `parentId`,
`tag`, `label`, `role`, `text`, `description`, `actions`, `bounds`, enabled
state and dp sizes.

That is almost exactly the shape Design Studio needs. Add an **exporter** around
the existing bridge rather than changing the SDK:

1. Connect/pair as the desktop already does.
2. Read `/api/snapshot` and `/api/screenshot`.
3. Write a portable bundle:
   ```text
   capture.dsui/
     manifest.json   source, package, activity, device, density, viewport, hashes
     tree.json       {screen, viewport, windows, nodes}
     screen.png      masked screenshot
   ```
4. Design Studio imports the bundle; it does not call QaLense at runtime and has
   no Python/QaLense dependency.

This is a one-way export. QaLense remains a separate, optional QA tool.

## Design Studio import pipeline

Add a `device_capture`/import action to the plugin (Python is not a runtime
dependency; the importer accepts a bundle path):

1. Validate `manifest.json` + `tree.json` + image.
2. Create a design system with provenance:
   - `assets/images/device-screen.png` + asset manifest entry
   - `data/ui-tree.json`
   - `css/token.css` (palette sampled from the screenshot)
   - `css/style.css` + `html/index.html` (reconstruction)
   - `design_prompts_forcoders.md` with source app, device, viewport and limits
3. Capture a history snapshot; show in the existing mobile review frame.
4. Offer three honest views:
   - **Screenshot** — exact pixels.
   - **Reconstructed** — generated HTML/CSS.
   - **Overlay** — screenshot + tree boxes/labels.

The imported capture is read-only evidence. Editing it goes through the normal
Design Studio files/agent/history; no app network calls or game logic.

## Reconstruction algorithm

1. **Coordinate space**
   - Use the capture's viewport, not the phone's full screen, and subtract the
     window origin/insets.
   - Convert px → percentage of viewport; set the stage to the captured aspect
     ratio (e.g. 390 × 844).
   - Preserve z-order from tree order; clips from parent bounds.
2. **Node mapping**
   - Text/label: `Text`, `TextView`, `BasicText` → `<p>`/`<span>`.
   - Interactive: buttons/role=Button → `<button>`; fields → `<input>` or
     `<textarea>`; check/switch → checkbox/switch.
   - Images/icons: placeholder `<img>`/CSS box; optionally crop from screenshot.
   - Scroll containers: overflow container; fixed regions absolute.
   - Keep unknown nodes as neutral boxes so spacing survives.
3. **Styles**
   - Tree has no style. Sample the screenshot:
     - background/text/control colors around each node rectangle,
     - font size from node height/dp,
     - radius/shadow approximated from pixel edges.
   - Use Design Studio tokens for editability; the screenshot remains the visual
     reference.
   - Do not extract proprietary image assets unless the operator owns them.
4. **Output**
   - Absolute-positioned HTML/CSS is the most faithful first pass and easiest to
     edit.
   - A second “semantic” pass can infer flex/grid rows/columns later; do not
     block on it.

## Recommended roadmap for Design Studio

Phase 1 — **universal capture import**
- Python `uiautomator` + `screencap` CLI writes `capture.dsui`.
- Design Studio importer builds screenshot, tree JSON, absolute reconstruction
  and provenance.
- Overlay view; no app changes, no QaLense requirement.

Phase 2 — **QaLense exporter**
- Add an “Export to Design Studio” action to QaLense's local bridge.
- Use the existing `/api/snapshot` and `/api/screenshot`; do not fork the SDK.
- Compose semantics become the preferred tree for our apps.

Phase 3 — **better styling**
- Screenshot color sampling, crop icons/images, token generation, style-atlas
  re-skinning, editable semantic layout pass.
- Add a “capture freshness” stamp and privacy/masking checks.

Phase 4 — **other platforms**
- iOS: Appium/WebDriverAgent page source + screenshot.
- WebView/hybrid: Playwright DOM/accessibility tree + screenshot.
- Flutter: integration_test semantics / accessibility tree if available.

## QaLense source references

- `research/qalense/tools/local-bridge/server.py` — Python bridge endpoints.
- `research/qalense/tools/local-bridge/app.js` — snapshot tree/bounds rendering.
- `research/qalense/qalens-core/src/main/kotlin/com/qalens/QaLensModels.kt`
  — `InspectionSnapshot`, `InspectNode`.
- `research/qalense/qalens-compose/src/main/java/com/qalens/QaLensActivityInstaller.kt`
  — `ComposeSemanticsReader`, bounds/dp/role extraction.
- `research/qalense/docs/ARCHITECTURE.md` — Compose-only inspection boundaries.
- `research/qalense/tools/local-bridge/README.md` — bridge behavior, tree JSON,
  selectors and limits.

QaLense is MIT (Copyright © 2026 Saleh Alanazi). This research note does not
vendor QaLense; its clone is ignored under `research/qalense/`.
