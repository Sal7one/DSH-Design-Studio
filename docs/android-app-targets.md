# Android app targets

The Appium target shipped in **2.8.0**; the QaLens companion described below is
experimental work in this checkout and may not be in the published package. A
target is a property of a Design Studio design system. Choose a target in the
**App** tab; no Android SDK is installed or selected automatically.

The capability used to live in a second bundle,
`@sal7one/dsh-design-studio-appium`. That bundle is retired; Appium is part of
the Design Studio host now. There is no second tool, no second preview prefix and
no second tab.

## QaLens companion (experimental)

The companion is **off by default**. In **Settings → Design Studio**, enable
**Enable QaLens companion** and press **Save changes**, then choose **Android ·
QaLens** in the App target selector. Enabling does not install an SDK, start a
workbench, or pair a phone. This read-only integration uses an existing QaLens workbench for its Compose mirror and selection; Design Studio
shows the selected component and a source claim. It does not embed or replace
the workbench, edit source, or automatically build the app. **Appium fallback**
and **Compose Desktop** remain separate modes. Avoid sending Appium actions and
QaLens mirror controls to the same device at the same time.

1. Open **Project settings** in the QaLens companion and save the app's package and project root.
   A package mismatch, or a missing package, prevents a source claim. QaLens
   target settings are stored separately from Appium; re-enter them once if an
   earlier experimental checkout used the shared Appium target.
2. Run the existing QaLens workbench on this machine and enter its exact
   `http://127.0.0.1:<port>` URL in the companion, then choose **Attach** and
   **Open QaLens**. Only numeric IPv4 loopback HTTP origins are accepted.
3. In QaLens, pair a debug/QA build and approve on the phone. Select on the
   phone, or turn on **Link selections** in the workbench before selecting
   there. The companion reads while its App tab and browser are visible.
4. Review the source badge. `verified` means a unique runtime source reference
   matched a debug source-map entry and the current local source SHA-256. It
   does **not** independently establish the installed APK's build identity.
   A tag-only match is `candidate`; duplicate locations are `ambiguous`, changed
   source is `stale`, and missing data is `unavailable`. Runtime node IDs and
   generated tags are not stable identifiers.

Alternatively, before launching the harness set `DSH_QALENS_CHECKOUT` to the
absolute QaLens checkout path and use **Start QaLens** after enabling the setting. Optional host settings
are `DSH_QALENS_PYTHON` (Python executable) and `DSH_QALENS_DATA_DIR` (absolute
path). These are trusted server settings, not browser-supplied commands. A
sidecar started by the plugin is stopped on disconnect or plugin unload; an
attached workbench is left running. Turning off the setting stops an owned
sidecar or detaches an attached workbench; it does not stop the external process.
The desktop session and phone connection
nonce remain in host memory, and polling does not issue phone controls. QaLens
creates a bounded in-memory component preview on selection; no file is saved by
this companion. Node metadata is refreshed at most every five seconds while the
selection remains unchanged.

### Draft an Android design investigation

Select a component in QaLens and choose **Pin selection** in Design Studio.
Pin up to eight elements from the same connected target, write one shared intent,
and open **Review request before sending** before choosing **Ask DeepSeek to
investigate** or **Copy draft**. The selection and draft appear side by side on
wide screens. Switching the App target or another workspace tab keeps the draft
in memory and pauses QaLens polling while its panel is hidden. Drafts are cleared
when changing design projects or reloading the page. Quick prompts help start a
request. The main-chat handoff asks for a read-only plan; it does not itself edit, build, install, or operate the
app. The normal main-chat agent retains its usual tool permissions: the read-only
instruction is advisory, not a sandbox. Pins are in-memory snapshots, not proof that the current screen or APK
is unchanged. A connection or project change blocks sending until reselected.

The reviewed request includes package, source-root path, screen/route, test tag,
actions, and source claim candidates. It excludes component labels, values,
attributes, screenshots, and source snippets. Tags, routes, and paths can themselves
contain sensitive data. Component details may still be viewed locally and can contain
sensitive data. Claims describe capture time; they are not revalidated for every
pinned element on send. Review the displayed request before sending it to a model
provider.

Source maps are the experimental debug-only `qalens.source-map` v1 files under
`<module>/build/generated/qalens-source-map/debug/qalens/source-map.json`.
Source references additionally require an app built with the experimental
source-link support and explicit QaLens source-sharing opt-in. Older builds may
only yield tag candidates. Do not ship the map in release artifacts. Component
values, source paths and snippets can be sensitive; do not expose the local
workbench or Design Studio server to untrusted users or networks.

**Existing security limitation:** the Appium target's custom build/install argv
and the Studio API's Origin-only boundary can permit local command execution.
The opt-in setting is a preference, not a security boundary against an untrusted
local process or same-origin preview. Use only in a trusted local environment.
Existing same-origin preview frames can
also potentially invoke parent-page APIs; an Origin check or a JavaScript-readable
session token alone does not isolate untrusted preview content. Do not add an
Android edit/build workflow until the command boundary and preview isolation are
hardened. Restricting executable names alone is insufficient because Gradle builds
run project-controlled code.

The Appium instructions below describe the fallback mode.

## What it does

- Live screenshot and **uiautomator2** tree of the running app.
- **Hover** highlights the element under the pointer before you click.
- **Click** opens a selection popup with class, text, content-desc, resource-id,
  bounds and locator, plus a change-request field.
- **Ask DeepSeek** queues the selected node and request into the conversation.
- **Capture** copies the current frame into the project at
  `assets/images/app/` and creates a Design Studio history snapshot.
- **Restart** terminates and relaunches the configured app through Appium.
- Per-project Appium session with a host keepalive, long command timeout and
  automatic reconnect on tab mount when a target is configured.

The plugin **inspects and drives** the app and can run the configured Gradle
build and install the APK through **Build & install**. It never edits source
files. The project config carries the source root, JDK, Android SDK, Gradle
task and APK path.

## Requirements

| Requirement | Notes |
| --- | --- |
| Appium 3 server | Default `http://127.0.0.1:4723`; bind to loopback, Appium has no auth. |
| UiAutomator2 driver | `appium driver install uiautomator2`. |
| Android device/emulator | Visible to `adb devices`; API level supported by the app. |
| App installed | Debug APK installed with `adb install -r`; `noReset` is the default. |
| Node 22 | Same requirement as the plugin. |
| JDK + Android SDK | Needed for **Build & install**; set `javaHome` and `androidHome` in the target config. |

Use a **visible** emulator. A headless emulator is visible to ADB but does not
appear in Android Studio's **Running Devices**; start it without `-no-window`.

## Bind a project

1. Install the app's debug APK.
2. In Design Studio, select the project, open **App**, choose **Android · Appium**,
   then select **Connect Android app**.
3. Fill the target:

| Field | Example |
| --- | --- |
| Appium URL | `http://127.0.0.1:4723` |
| appPackage | `com.example.app` |
| appActivity | `.MainActivity` |
| deviceName | `emulator-5554` |
| Project root | absolute path to the Gradle repository |
| Gradle build task | `:app:assembleDebug` |
| APK path | `app/build/outputs/apk/debug/app-debug.apk` |
| JAVA_HOME | absolute JDK path used by Gradle |
| ANDROID_HOME | absolute Android SDK path containing `platform-tools/adb` |

`projectRoot`, `buildTask` and `apkPath` are stored per design system so a later
change request knows which existing project to edit and rebuild. They are not
used to execute anything by themselves.

The same values are available to agents through:

```text
design_studio action=android_config       slug=<slug>
design_studio action=android_config_save  slug=<slug> patch={...}
design_studio action=android_connect      slug=<slug>
```

## The change loop

```text
select node in App tab
  -> popup with locator + request
  -> agent edits the project's source
  -> App tab: Build & install
     (./gradlew <buildTask>, then adb install -r <projectRoot>/<apkPath>)
  -> restart through Appium
  -> android_shot / android_capture
```

Useful manual commands (JDK and SDK must be on the environment):

```sh
cd /path/to/project
JAVA_HOME=/path/to/jdk ANDROID_HOME=$HOME/Library/Android/sdk \
  ./gradlew :app:assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Or build/install in one call (explicit only):

```text
design_studio action=android_build slug=<slug>
```

The result includes `buildMs`, `installMs`, `apk`, `restarted`, `restartError`
and a trimmed Gradle/adb log. A build timeout aborts the child through the
harness subprocess seam; a bad path/task is rejected before spawning. Building
runs the project's own Gradle code, so it is never automatic.

Then restart through the App tab, or:

```text
design_studio action=android_restart slug=<slug>
design_studio action=android_shot    slug=<slug>
design_studio action=android_capture slug=<slug>
```

## App editor

The Appium fallback has a two-column editor. Its former History tab was removed;
Capture still saves the frame in the project, and design snapshots remain in the
main Design Studio History. No saved captures were deleted:

- **Canvas** — live screenshot, hover highlight, selected/change outlines, capture.
- **Inspect** — selected node details, locator, source mapping, searchable tree.
- **Screens** — current `SCREEN_*`, destination chips and `android_navigate`.
- **Source** — project root, Gradle/APK/JDK/SDK config, tag source and last build log.

Selection is durable: after a tree refresh the plugin re-resolves the node by
resource-id (or text/class fallback) and shows a visible **stale** warning if the
node disappeared. The change request carries the current screen, app routes and
tag source/reuse count, so a reused component is not mistaken for a page-specific
one.

## Session behavior

- The host keeps the Appium session alive with a command every 60 seconds;
  `newCommandTimeout` is raised to 24 hours.
- The Appium panel reconnects automatically on entry if a target is configured.
  Explicit **Disconnect** suppresses this until you connect again, including
  across App tab switches and reloads in the same browser session.
- Sessions are validated before use and recovered when the server lost them.
- A session belongs to one design project; switching projects switches the
  target. The status for another project never reports someone else's session.

## Context awareness

`android_context` answers "where am I and where does this component live?":

- `activity` — the Appium current activity.
- `screen` / `screenLabel` — the first `SCREEN_*`, `PAGE_*`, `ROUTE_*` or
  `DESTINATION_*` resource-id in the current tree. If the app has no screen tag,
  this is empty and the activity is the honest fallback.
- `routes` — a static index of `composable(route = …)` and
  `navigation(route = …)` entries in `projectRoot`, resolved per module.
- `tag` — when a tag is supplied, its definition (`file:line`, enclosing
  function) and the places that call that composable.
- `routes` feed the Screens chips and `android_navigate`.

Requirements and limits:

- Enable `testTagsAsResourceId = true` at the Compose root, otherwise Appium
  sees no test tags and neither screen identity nor source lookup can work.
- Put `SCREEN_<NAME>` on a semantic node at each destination root, for example
  `Modifier.testTag("SCREEN_SETTINGS")`.
- The route index is static; routes built from runtime values or conditional
  graphs may be missing. Reuse detection is tag/function-level and does not
  build a full component graph.

## App adapters (any app)

The editor does not assume a framework. A source adapter declares what it can
expose; the UI and the graph contract stay the same.

| Adapter | Components | Routes | Tokens | Source |
| --- | --- | --- | --- | --- |
| `compose` | yes | yes | yes (color tokens) | yes |
| `runtime` | no | no | no | no — live tree only |

- **Runtime-only** is the fallback for any app with no supported source. The
  canvas, tree, selection, tap mode, screens from `NAV_*` tags, captures and
  build/install still work. Components/routes/tokens are reported as
  unsupported, never guessed.
- **Compose** is the reference adapter: `testTag` → enclosing composable →
  call-site usages, `composable(route=…)`/`navigation(route=…)`, and
  `val Name = Color(0x…)` tokens.
- **XML/Views are not supported.** They fall back to runtime-only. A new
  framework is a new adapter, not a core change.
- `android_context` returns `adapter`, `capabilities`, `components`, `routes`,
  `tokens`, plus `actualPackage`/`packageMismatch` when the foreground app is
  not the configured app.

### Generic build and install

Gradle remains the default preset, but an app can declare argv commands:

```json
{
  "buildCommand": ["{projectRoot}/gradlew", "--console=plain", ":app:assembleDebug"],
  "installCommand": ["/path/to/adb", "install", "-r", "{apk}"]
}
```

Commands are argv arrays, never shell strings; `{projectRoot}` and `{apk}` are
expanded. With no `installCommand`, the plugin installs `apkPath` through adb.
Configure via `android_config_save` until the Connect modal exposes these
fields.

## Screens and navigation

The App tab shows the current `SCREEN_*` and the static route list as **Screens**
chips. Clicking a route calls `android_navigate`, which looks for a matching
semantic tag on the current tree, in this order:

```text
NAV_<ROUTE>  ROUTE_<ROUTE>  SCREEN_<ROUTE>  DESTINATION_<ROUTE>
```

`<ROUTE>` is uppercased and path parameters are replaced with `_`
(`place_details/{placeID}` → `NAV_PLACE_DETAILS`). Example:

```kotlin
NavigationBarItem(
    modifier = Modifier.testTag("NAV_SETTINGS"),
    // ...
)
```

If nothing matches, the result is explicit:

```json
{ "ok": false, "supported": false, "route": "settings",
  "reason": "No routable test tag found. Add ... NAV_SETTINGS ..." }
```

Compose Navigation exposes no universal "go to route" API, so the plugin never
guesses or deep-links blind. Add tags to the controls that open destinations.

## Models and bounds

Compose exposes test tags as `resource-id` when
`testTagsAsResourceId = true` is set on the semantics owner. Without a tag, the
node still has class, text, content-desc and bounds; the locator falls back to
accessibility id, text XPath or class name.

Selection prefers the smallest node containing the point. Put `Modifier.testTag`
**before** padding, so the tagged bounds include the visual card/background:

```kotlin
Modifier
    .fillMaxWidth()
    .background(color)
    .testTag("HERO_CARD")
    .padding(22.dp)
```

Tagging after `.padding(22.dp)` shrinks the selectable bounds to the inner
content; clicks on the card's padding then fall through to the page root.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Device missing from Android Studio | Emulator was started with `-no-window`; restart it with a window. |
| Every click selects the page root | Point is outside every tagged node, or the foreground app changed; check the tree and tag/padding order. |
| Tree shows another app | Bring the target app forward; selection/tap refresh a tree older than 600ms. |
| Connect succeeds but no frame | Appium session created for a different package/activity, or the app crashed; check `android_status` and `adb logcat`. |
| Popup does not appear | The App tab is on a project without a live session; connect first. |
| Build fails after an edit | Read the Build log in the App tab; fix the project's Gradle error. Bad config is rejected before spawn. |

## Related

- [Compose Desktop target](compose-desktop.md) — the same App tab idea for a
  Compose Hot Reload desktop app.
- The design's **History** tab shows the `android-capture` snapshots created by
  the App tab.
