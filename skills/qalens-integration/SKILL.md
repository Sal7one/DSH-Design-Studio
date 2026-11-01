---
name: qalens-integration
description: Help a consenting Android team evaluate, install, verify or remove the optional QaLens SDK and connect it to the DeepSeek Harness Design Studio companion. Do not use for ordinary web mockup work or assume QaLens is required.
---

# Optional QaLens + Design Studio integration

Use this skill when a user explicitly wants the QaLens connection or asks to
integrate QaLens into a host Android app. For setup and acceptance details read
[the companion integration guide](../../docs/QALENS_INTEGRATION.md). The
existing Design Studio mockup skill covers ordinary HTML/CSS work; this skill
does not replace it.

1. Check the installed plugin version, its Settings → Design Studio companion
   setting, and the team's intent. `qalens.enabled` is off by default. Enabling
   it is separate from installing an Android SDK or running a local workbench;
   never add dependencies or instrument an app merely because Design Studio is
   installed.
2. Before changing a host, inspect its instructions, Gradle modules, all actual
   build variants and shipping graphs, Application/Startup, Compose roots,
   navigation, DI and privacy policy. Select an approved QA variant and a
   verified SDK revision/artifact source. `com.qalens` coordinates or a local
   Maven preview do not imply a public Maven release.
3. If authorized, follow the chosen SDK revision's public integration guide.
   Preserve host startup, UI, network and exception behavior. Keep active SDK
   artifacts and experimental source maps out of every shipping graph and
   merged manifest; where shared code needs it, use the matching no-op facade.
   A runtime flag and a release-built active AAR do not establish isolation.
4. Connect to the existing loopback QaLens workbench, use its phone-approved
   pairing flow and keep sessions/tokens private. Use one device input
   controller. Do not iframe or rewrite QaLens, bypass approval, or infer host
   runtime behavior from an SDK sample.
5. Source-map instrumentation is a **separate experimental opt-in**. Preserve
   manual/custom tags and treat tag matches as candidates; `verified` means a
   matching runtime source reference and local hash, not verified APK identity.
   Do not promise all Compose nodes, stable IDs, source access, or model reasoning.
6. Verify actual dependency graphs and merged manifests for all production
   variants, then separately test QA startup, pairing and a live selection on an
   authorized device with synthetic data. Distinguish compilation, fixture,
   emulator, host runtime and real-model evidence in the handoff. Report exact
   versions, changes, privacy assumptions, unverified checks and rollback.

The present Design Studio Appium build/API boundary has a known command and
same-origin preview security risk. Do not add an automated source-edit/build
workflow until it is addressed. Review all model-bound context: tags, routes,
paths and UI values may be sensitive. A read-only prompt in the ordinary main
chat is advisory, not a sandbox.
