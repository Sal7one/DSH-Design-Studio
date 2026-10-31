# Android app targets (Appium)

Status: shipped in **2.8.0**. An Android app target is a property of one Design
Studio design system. Select the project, open its **App** tab, and the plugin
drives the real installed app through Appium — the same project keeps its own
config, captures and history.

The capability used to live in a second bundle,
`@sal7one/dsh-design-studio-appium`. That bundle is retired; Appium is part of
the Design Studio host now. There is no second tool, no second preview prefix and
no second tab.

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
  automatic reconnect on tab mount.

The plugin **inspects and drives** the app. It does **not** edit source, run
Gradle or install an APK. The agent or operator does that; the project config
tells them where the source and build outputs are.

## Requirements

| Requirement | Notes |
| --- | --- |
| Appium 3 server | Default `http://127.0.0.1:4723`; bind to loopback, Appium has no auth. |
| UiAutomator2 driver | `appium driver install uiautomator2`. |
| Android device/emulator | Visible to `adb devices`; API level supported by the app. |
| App installed | Debug APK installed with `adb install -r`; `noReset` is the default. |
| Node 22 | Same requirement as the plugin. |
| JDK + Android SDK | Only needed when the agent/operator rebuilds the app. |

Use a **visible** emulator. A headless emulator is visible to ADB but does not
appear in Android Studio's **Running Devices**; start it without `-no-window`.

## Bind a project

1. Install the app's debug APK.
2. In Design Studio, select the project and open **App → Connect Android app**.
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
  -> ./gradlew <buildTask>
  -> adb install -r <projectRoot>/<apkPath>
  -> design_studio action=android_restart slug=<slug>
  -> android_shot / android_capture
```

Useful manual commands (JDK and SDK must be on the environment):

```sh
cd /path/to/project
JAVA_HOME=/path/to/jdk ANDROID_HOME=$HOME/Library/Android/sdk \
  ./gradlew :app:assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Then restart through the App tab, or:

```text
design_studio action=android_restart slug=<slug>
design_studio action=android_shot    slug=<slug>
design_studio action=android_capture slug=<slug>
```

## Session behavior

- The host keeps the Appium session alive with a command every 60 seconds;
  `newCommandTimeout` is raised to 24 hours.
- The App tab reconnects automatically when it mounts if a saved target exists.
  **Disconnect** is remembered until you connect again.
- Sessions are validated before use and recovered when the server lost them.
- A session belongs to one design project; switching projects switches the
  target. The status for another project never reports someone else's session.

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
| Build fails after an edit | Run the project's own Gradle task and fix its error; the plugin does not compile source. |

## Related

- [Compose Desktop target](compose-desktop.md) — the same App tab idea for a
  Compose Hot Reload desktop app.
- The design's **History** tab shows the `android-capture` snapshots created by
  the App tab.
