# Compose Desktop target (optional)

Design Studio normally previews HTML/CSS mockups. It can *instead* host the real
Compose Desktop app when that app exposes **Compose Hot Reload's MCP server**
(`hotMcpServer`). This is not a mockup: the preview is the compiled app, reloaded
in place.

The bridge is off until `app.project` is configured. Every other feature works
without it.

## Requirements

| Need | Version / check |
|---|---|
| Compose Multiplatform | **1.12+** for the built-in MCP server (the Compose Hot Reload plugin itself is bundled since 1.10). |
| Kotlin | 2.1.20+ (Compose Hot Reload requirement). |
| JVM target | compatible with **Java 21 or earlier**. |
| MCP task | `hotMcpServer`; with a custom `desktop` target the real task is `hotMcpServerDesktop`. |
| Run task | `hotRunDesktop` (or your JVM run task). `app_start` launches it when no application is connected. |
| Platform | the app must have a **desktop/JVM target**; Android-only modules are not supported by Compose Hot Reload. |

`compose-hot-reload` is Apache-2.0. Its MCP server is experimental; the tool names
below are read from `tools/list` at runtime, so a missing tool produces an honest
error instead of a false success.

## Configure

```jsonc
// design_studio action=config_save
{
  "app": {
    "project": "/absolute/path/to/your/compose/project",
    "task": "hotMcpServerDesktop",   // optional; use the target-suffixed task
    "runTask": "hotRunDesktop",      // optional; launched when no app is connected
    "initializeTimeoutMs": 120000,   // optional (5s..10min)
    "toolTimeoutMs": 60000           // optional (5s..10min)
  }
}
```

`app.project` must be absolute and contain the Gradle wrapper
(`gradlew`, or `gradlew.bat` on Windows). Anything else is rejected before a
process starts.

## Actions

| Action | What it does | Notes |
|---|---|---|
| `app_status` | Configured project, state, advertised MCP tools, last error | Never throws when unconfigured. |
| `app_start` | Initialize MCP, list tools, then launch `runTask` when no application is connected and wait for it | First run compiles the app; can take a minute. |
| `app_reload` | `reload` — applies changed classes to the running app | The loop: edit Compose → `app_reload` → `app_shot`. |
| `app_shot` | `take_screenshot`, writes a PNG to the profile store, returns it as an image attachment | Optional `slug` names the capture owner. |
| `app_tree` | `get_semantic_tree` — real Compose semantics | Useful to locate nodes before capturing/clicking. |
| `app_logs` | `get_logs` — recent runtime output and exceptions | |
| `app_call` | Invoke any advertised MCP tool (`click`, `type_text`, `scroll`, `resize_window`, `restart`, ...) | Use `app_tree` to get node ids and bounds; `app_call` returns text or an image attachment. |
| `app_stop` | Terminate the MCP server and the app run task | Also runs when the plugin is disposed. |

The client **App** tab exposes the same operations: Start/Reload, Capture,
Semantic tree, Logs, Stop, plus the latest screenshot.

### Live review and change highlighting

While the app is connected and the tab is open, the client polls `studio.app.frame`
every ~1.6s. The first frame becomes the baseline; every later frame is diffed
against it on a canvas (4px cells, connected components), and changed regions are
boxed over the image. Regions are named from the semantic tree when their centre
falls inside a node's bounds. `Re-pin baseline` makes the current frame the new
reference; `Pause live` stops polling. A successful `Reload UI` applies changed
classes; the next frame shows exactly what moved or recoloured.

## Storage and routes

- Captures: `<profile>/_studio/app/<owner>/shots/<file>.png` (profile store, not
  the design folder and not the app repo). `owner` is the design slug, or
  `_global`. On macOS they come from the window server (`CGWindowID` +
  `screencapture -l`), so a covered window still captures correctly; that image is
  2x Retina and includes the title bar. The MCP `take_screenshot` is the fallback
  (content only, but a screen grab that can capture the wrong window when covered).
- Served at `/design-studio/__app/shots/<owner>/<file>.png` (`GET`/`HEAD`,
  path-contained, `image/png`, `no-store`).
- Only PNG files are served; there is no directory listing.

## Lifecycle and safety

- The plugin spawns exactly one MCP session (per host), with **argv only** — no
  shell, no user-supplied command string. The Gradle task is validated as a task
  name and the project must contain a wrapper.
- Starting a different project stops the previous session first.
- Starting the app is lazy: only `app_start` (or a client action that implies it)
  runs Gradle.
- The plugin never writes into the app repo. Gradle writes its own build outputs;
  code edits stay with the agent/owner.
- App actions are allowed on frozen designs: they read the implementation and do
  not mutate the mockup.

## Limits (honest ones)

- **Desktop ≠ Android.** This is real Compose with real Material, but not Android
  insets, status bars, predictive back, or Android text metrics. Use it for
  layout/interaction/reload; use Roborazzi/layoutlib (or a device) when you need
  native sign-off.
- **Window sizing is manual.** `app_call` with `resize_window` (width/height in
  pixels) sets a phone-sized frame; the app itself still opens at the size its
  `main` requests.
- **Experimental MCP.** Tool names/arguments can change between Compose Hot
  Reload releases. `app_start` reports what the server advertises.
- **One session.** Two clients cannot both own `hotMcpServer`; if you also use an
  IDE MCP client, stop it before starting here.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `app.project has no Gradle wrapper` | wrong path, or the wrapper is missing. |
| `hotMcpServer exited before ready` | the project is not on CMP 1.12+, or the task name is wrong; the stderr tail is included in the error. |
| `did not answer initialize within …` | the app is compiling for the first time, or the task is not the MCP server; raise `initializeTimeoutMs`. |
| `does not expose take_screenshot` | older Compose Hot Reload: the MCP tool set is listed in the error. |
| `status` says `connected: false` after Start | `runTask` is wrong, or the app compiled but exited; check the app logs and the Gradle tail in the error. |

## Later

Input simulation (`click` / `type_text` / `scroll`) once their exact MCP argument
schemas are verified against a real app, window-size control for phone review, and
an Android screenshot path (Roborazzi) that reuses the same capture store.
