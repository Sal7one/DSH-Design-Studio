# Optional QaLens integration for Design Studio

This guide is for a developer or agent who **wants** to connect an Android
Compose app to Design Studio through QaLens. It is not a prerequisite for
Design Studio's web mockups, Appium target, or Compose Desktop target. The
Design Studio plugin does not install the QaLens SDK, change an app, or bundle
a QaLens workbench or compiler. The host team chooses whether to use them.

The QaLens companion in this development version is experimental. Verify that
the installed Design Studio package actually includes it; an older npm release
may not. A repository checkout, a locally linked plugin, an npm release, a
QaLens SDK checkout, a Maven artifact, and an installed APK are different
things. Record their exact versions or Git revisions rather than assuming they
match.

## Install Design Studio

If Design Studio is already installed, do not install it again. Otherwise use
its [installation instructions](../README.md#quick-start) and the host's
approved DSH profile. The documented registry command has this form:

```sh
dsh plugin --profile desktop add @sal7one/dsh-design-studio
```

Check the installed package version and the README for compatible Node/DSH
versions. Do not assume a published version contains the experimental companion.
For development or evaluation, the documented local-link install can instead
point to a reviewed checkout containing these changes. Reload the plugin and
refresh the client after installing or changing it; avoid interrupting an active
team session. Enabling the companion is a separate setting below.

The `qalens-integration` agent skill in this package is repo-local guidance.
Installing the plugin does not itself prove DSH or another agent runtime has
discovered that skill. Follow the host's actual skill-loading instructions if
it should be available to agents; do not silently copy or enable it globally.

## What is optional

| Piece | Needed for | Independent choice |
| --- | --- | --- |
| Design Studio plugin | Web design and optional App surfaces | No QaLens SDK or Python is required for the web editor. |
| QaLens companion setting | Reading a paired workbench selection in Design Studio | Off by default. Enable only when wanted; this changes no Android dependencies. |
| QaLens Android SDK | Inspecting a host's Compose UI through QaLens | Install only in an approved QA/debug host variant. |
| QaLens Python workbench | The separate local phone/PC inspector | Start separately, or explicitly start the configured sidecar. |
| Auto-tag compiler/source map | Experimental source references for supported Compose calls | Not required for normal QaLens selection; no automatic installation. |
| DeepseekHarness Android app source link | Separate on-device harness-to-QaLens integration | Not needed for the Design Studio desktop companion. |

Enabling the desktop companion is not consent to instrument an Android app or
share its data with an LLM. Obtain the host team's choice for SDK installation,
QA variants, privacy and optional evidence sources. The app can instead remain
unchanged and use its existing tools, including Appium where available.

## Before changing the host

Read the host's own agent instructions and inspect its actual `settings.gradle`,
version catalog, app and library modules, build types, flavors, application IDs,
`Application`, AndroidX Startup policy, Compose roots, navigation and DI owners.
Determine which variants ship and which QA variants are allowed to capture data.
Check the host's JDK, Gradle, AGP, Kotlin and Compose versions against the
**specific QaLens revision** being evaluated. The SDK's tested baseline is not a
general compatibility promise. Do not upgrade the host's toolchain or change its
network-security policy just to make the sample compile.

For the evaluated SDK's detailed public APIs and runtime limits, use its own
[integration guide](https://github.com/Sal7one/QaLense/blob/c5bb869/integration.md),
[agent integration runbook](https://github.com/Sal7one/QaLense/blob/c5bb869/docs/AI_INTEGRATION.md),
and [OSS integration contracts](https://github.com/Sal7one/QaLense/blob/c5bb869/docs/OSS_INTEGRATIONS.md).
They are revision-specific examples; inspect the actual version's APIs, build
configuration and release notes before use.

## Choose and verify an SDK distribution

`com.qalens` coordinates in a build file do **not** prove an artifact is
published on Maven Central or available to a company. Select one verified source:

1. **Composite build:** use a pinned, complete QaLens checkout with Gradle
   `includeBuild(...)`, subject to the host's dependency and plugin policies.
2. **Maven Local:** the SDK owner may publish a unique preview version to
   `mavenLocal()` for a single developer. Verify the artifact and exact version;
   avoid replacing different binaries under the same version. This is not a team
   distribution channel or a public release.
3. **Internal Maven repository:** have the owner publish a versioned artifact or
   verified internal repository bundle and configure the approved repository.
   Pin the same evaluated version across modules and keep credentials out of
   files, logs and agent prompts.

The SDK checkout's `scripts/release_internal.sh --version <unique-version>
--verify` creates its internal Maven bundle when that script exists in the
chosen revision; it does not publish it to the internet. Inspect its effects
before running it: it clears its own generated distribution directory. Avoid
publishing an artifact, changing organization repositories, or overwriting an
existing version unless requested.

For a simple app whose only variants are `debug` and `release`, this is the
**shape** of a Kotlin DSL dependency split. Replace the placeholder with an
artifact version that has actually been distributed to the chosen repository:

```kotlin
val qaLensVersion = "<verified-version>"

dependencies {
    debugImplementation("com.qalens:qalens-compose:$qaLensVersion")
    releaseImplementation("com.qalens:qalens-noop:$qaLensVersion")
}
```

This example assumes shared source calls QaLens in both variants, so release
needs the no-op facade to compile. If integration code is restricted to QA
source sets and shipping variants do not import QaLens, a release dependency is
not inherently required. Never add both active and no-op artifacts to the same
variant; they have overlapping APIs. A release-built AAR of an **active**
module is still active. A runtime `enabled = false` flag does not remove capture
code or manifest entries from a shipping build.

Real apps often have `qa`, `staging`, multiple flavors or shared feature modules.
Map dependencies to **every** real variant and module that imports the API. Do
not assume `debugImplementation` covers a custom QA build type, or that an app
module dependency flows backward to feature modules. Navigation and replay
artifacts are separate optional choices. The active `qalens-core` model module
may also appear in the no-op graph; compare actual resolved modules, not only
source declarations.

## Preserve host startup and behavior

The normal active SDK uses AndroidX Startup to install its overlay hooks. Adding
an active dependency can therefore activate SDK behavior before
`Application.onCreate()`; this is a substantive host change, even if the desktop
setting is off. Inspect the merged QA manifest and the host's initialization
policy first. Configure identity and agreed privacy in the **existing**
Application; do not replace it, its DI, callbacks, or the app's navigation.

If the team chooses the public Compose wrapper, use one `QaLensRoot` around the
existing root inside its existing theme, preserving insets and the NavHost. Check
the actual artifact's active/no-op APIs and `QaLensRoot` semantics before doing
so. `QaLens.configure` supplies configuration; it is not application-wide
installation. If the host deliberately removes QaLens's own Startup metadata,
the current SDK guide describes `QaLens.install(application)` for explicit
application-wide hooks. Do not remove the whole AndroidX Startup provider; it
may belong to other libraries. A runtime flag set in `Application.onCreate()`
cannot prevent an initializer that has already run.

Keep body capture, gallery copies, unmasked HD video, uploads, SQL/data access,
logs and other evidence paths within the host's explicit policy. The SDK has
its own defaults and optional hooks; inspect them rather than assuming that
installing a debug artifact means no collection. A password mask or text
redaction is not a guarantee that arbitrary screenshots or video are safe.
If the team wants network, Room, DataStore or Chucker hooks, use the SDK's public
contracts with the existing owners and prove actual host behavior separately.
Do not create a second DataStore, swallow network/coroutine errors, change
requests, or assume encrypted data can be decoded without the host's serializer.

## Enable and connect the desktop companion

1. In the installed **Settings → Design Studio**, enable **Enable QaLens
   companion**, then choose **Save changes**. The setting is opt-in and off by
   default. For agents using the tool, the equivalent is
   `design_studio action=config_save patch={"qalens":{"enabled":true}}` only
   when the operator has requested it. Do not silently enable it for all users.
2. Build and install the team's approved QaLens-enabled QA app. Start it on an
   authorized emulator or phone using synthetic/test data. The app must include
   an appropriate active SDK and its usual phone-facing control surface.
3. Start the existing local workbench from the chosen QaLens checkout:

   ```sh
   python3 tools/local-bridge/server.py --gui --port 0
   ```

   Run this from that checkout's root. Python 3 and `adb` are requirements for
   this optional workbench, not the Design Studio web editor. Use the printed
   loopback URL. Do not expose the server to a LAN or tunnel it to other users.
4. In Design Studio's **App** target selector, choose **Android · QaLens**.
   Under **Project settings**, save the QA app's actual installed package and
   the source project root. QaLens and Appium store separate targets. If an
   earlier experimental checkout used the shared Appium target, enter the
   QaLens target once again; neither setting changes the other. In **Connection**,
   attach the workbench URL, then **Open QaLens**. The companion accepts `http://127.0.0.1:<port>`; use the
   printed address, without credentials or a path.
5. In QaLens select the phone and installed app, choose **Connect**, and approve
   the request on the phone. Turn on **Link phone & web selection** when choosing
   elements in the workbench, or select on the phone. Select one visible Compose
   element and check that its identity appears in Design Studio. A package
   mismatch prevents source attribution.

Alternatively, the harness process may be started with an absolute
`DSH_QALENS_CHECKOUT` and optional `DSH_QALENS_PYTHON` and
`DSH_QALENS_DATA_DIR` host settings. After enabling the companion, **Start
QaLens** launches that trusted checkout as a sidecar. These are host environment
settings, not fields in a web request; setting them does not enable the
integration. Attaching to an already-running workbench is often easier when a
desktop launcher does not inherit shell environment variables.

The workbench remains its own window. Do not embed it in an iframe, proxy its
privileged endpoints, copy its tree/mirror into the plugin, or poll phone actions
to emulate selection. The PC API is internal and version-sensitive; use the
workbench shipped with the chosen SDK revision. Use only one input controller
on a device at a time: QaLens mirror control, Appium, or another automation
controller. Stop or pause the others before acting.

The companion keeps the desktop session and phone connection nonce in memory.
Never put either in documentation, issue reports, test output, shell history,
agent prompts or repositories. Reading a component creates a bounded,
in-memory preview in the workbench; it does not save a file. Values, tags,
routes, source paths and snippets can contain sensitive data. The App panel
shows what the draft will send; a user must review it before sending to a model.
The request asks the normal main-chat agent for a read-only investigation; that
instruction is **not** a tool sandbox and the agent retains normal permissions.

Disabling the setting stops an owned sidecar/detaches the companion. It does
not uninstall the SDK, revoke previously shared files or erase app data. An
attached workbench is a separate process and remains running: disconnect it in
its own UI and stop the phone inspector when access should end.

## Source claims and the optional auto-tag experiment

Ordinary QaLens inspection works without the experimental compiler. Test tags,
roles and actions can still be useful when no source map exists. The companion
reads local `qalens.source-map` version 1 files at the supported debug build
output path and compares the source hash. It reports:

- **verified**: a unique visible node source reference matches a map entry and
  the current local source SHA-256. This does not independently prove that the
  installed APK came from that build or that every merged semantic node maps
  one-to-one to source.
- **candidate**: a tag or alias suggests a location, without a source reference.
- **ambiguous**: multiple local locations match.
- **stale**: the current local source hash differs from the map.
- **unavailable**: the reference, matching target, map, source or support is
  missing. Do not turn it into a precise location by guessing.

Claim information in a pinned draft is a snapshot from capture time; it is not
revalidated for every pinned element when a request is sent. Re-select and
revalidate against the current screen and source before later work.

The [QaLensMoreInfo source-link guide](https://github.com/Sal7one/QaLensMoreInfo/blob/f57a4d1/docs/DEEPSEEK_SOURCE_LINK.md)
describes a **separate prototype**, a local Maven preview and its exact tested
fixture. That preview version is not a public release. It instruments only a
small configured set of symbols, has no general call-site registry or guaranteed
duplicate detection, and may be incompatible with the host's toolchain.
Existing tags and custom modifiers must be preserved; reused components and
screen-scoped tags can be ambiguous. The generator, its runtime and debug map
must not leak into shipping variants. Node references on supported elements
require a matching source-link-enabled SDK and explicit map exposure; older
binaries may yield only candidates. Do not promise tagging of every Compose
call, stable IDs, or Appium-equivalent coverage.

The Android DeepseekHarness's paired `qalens_snapshot` /
`qalens_source_candidates` tools are a **different integration** from this
Python workbench companion and have separate app installation, pairing and
source-sharing requirements. A desktop selection test does not prove the
Android harness, a local model, or agent reasoning works end to end.

## Verify and report

Use exact tasks and configuration names discovered in the host. Typical
read-only inspection commands are:

```sh
./gradlew :app:dependencies --configuration debugRuntimeClasspath
./gradlew :app:dependencies --configuration releaseRuntimeClasspath
adb devices -l
```

`:app`, `debug` and `release` are examples: enumerate the real application and
feature modules and **every** shipping runtime configuration. A production
gate should reject active QaLens, replay, bridge and experimental auto-tag
runtime/compiler artifacts; require the no-op facade where shared source needs
it. Inspect each production merged manifest and final packaged artifacts for
active QaLens components/permissions and any debug source map. Keep unrelated
host permissions intact. Successful Kotlin compilation alone is not release
isolation.

Then separately record actual observations:

1. **Plugin:** with the companion off, verify web/Appium/Compose workflows still
   work and no QaLens sidecar is started. Enable and save; verify only the
   explicitly chosen workbench is attached or started. Disable; verify the
   companion rejects reads and its owned process exits.
2. **Host builds:** build an approved QA variant and every relevant shipping
   variant, run the project's isolation gate and inspect dependency/manifest
   outputs. Report variants and exact artifacts/revisions.
3. **Device:** on a disposable emulator or authorized phone using synthetic data,
   launch the actual QA app, observe the expected overlay without a second one,
   and pair through the real phone-approval UI. Verify a selection, screen/route
   when provided, and source claim or an honest unavailable result. Test
   disconnect, denied approval and reconnect; a server bootstrap is not pairing.
4. **Design Studio:** open the separate workbench, select the same element on
   phone/web and confirm the App panel follows it; pin it, review the draft and
   explicitly send/copy only if appropriate. Check a package mismatch and hidden
   tab behavior. Never present a synthetic provider or mock DOM as a real model
   or a real-device end-to-end test.
5. **Host behavior:** verify the existing app navigation, accessibility, window
   behavior, error delivery and startup; test only chosen optional integrations.
   Report what was not tested, device/API level and whether a real model was used.

Troubleshooting: if no phone is listed, check USB debugging/ADB authorization; if
no QaLens app appears, confirm the installed package is the intended QA APK and
has the active SDK; if selection does not update, check phone approval, the
foreground app and **Link phone & web selection**. A denied/expired pairing or
401/403 needs a fresh approved connection, not a copied credential. An absent or
stale source map is not a bridge failure. Use the matching SDK's own PC guide for
version-specific behavior.

## Current security boundary

The companion setting is an opt-in preference, not a security boundary against
untrusted local processes or same-origin preview scripts. The existing Design
Studio Appium integration allows configurable build/install commands and its
local API relies on an Origin/Host boundary that does not isolate same-origin
preview content. Treat the environment and any preview code
as trusted; do not expose the harness to untrusted networks or content. Do not
add or promise an automated Android source-edit/build/install pipeline until
command execution and preview isolation have been addressed. A Gradle wrapper
allowlist alone is not a sandbox: Gradle build scripts and plugins execute code.

## Rollback

Turn off the companion in Settings and save. Disconnect an independently started
workbench and stop the phone inspector separately. Revert only the reviewed host
integration changes if the host team wants the SDK removed, then rebuild the
same QA and production variants and recheck dependency graphs and merged
manifests. Existing exports, recordings, gallery copies and captured data have
their own retention rules; disabling or removing the SDK does not erase them.
Do not delete them without a separate user request.
