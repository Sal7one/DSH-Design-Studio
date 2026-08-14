# Design Studio UI (dynamic half)

The visible UI — the **Design Studio tab** (live preview, 📸 Shot, 👁 Review, 🎯 Select,
the Design Agent chat, file drops) plus Settings → Design Studio / All designs — is a
**dynamic Cordis plugin**. Dynamic packages exist only in the running harness process:
they are defined and run through the session's `cordis_define` + `cordis_run` tooling,
and they disappear on restart. The persistent bundle (`lib/index.js`) is the
restart-safe host; this folder adds the UI while running.

## Files

- `host.js` — HOST half. Client RPC handlers (`studio.*`), the **design-agent engine**
  (spawns a real harness subagent that lists/reads/edits the design files across
  multiple tool calls, with live `fs/observed` activity), screenshot capture
  (`screencapture`, hard shell timeout), image picker priority + per-image vision
  descriptions, vision-review transports (harness `llm` seam when an `openrouter`
  route exists, else the plugin's own curl client), and the dynamic `design_studio`
  tool (skipped when the bundle already registered it).
- `client.js` — CLIENT half. Plain-JS React (`React.createElement`, no JSX) registered
  in slots: `conversation.view` (id `design-studio`), `settings.section`
  (ids `all-designs`, `design-studio`), `tool.view.cordis` (key `self`).

## How to run

In a harness session with dynamic-plugin tooling:

1. `cordis_define` — new plugin, `idPrefix` of your choice, `code.host` = the full
   contents of `host.js`, `code.client` = the full contents of `client.js`.
2. `cordis_run` — the client half needs one approval (approval policy `ask`).
3. The **Design Studio** tab appears in the conversation view. The agent chat header
   shows a version marker (currently **Design Agent v13**) — check it after an update
   to confirm the new client is loaded (hard-refresh the page).

Re-run after every harness restart. The data (designs, presets, config, agent history)
lives on disk under `temp_design_folder/` and survives restarts.

## Compatibility

`host.js` ports the removed host-level `shell` service to the `subprocess` seam
(every command is bounded by a SIGTERM→SIGKILL shell watchdog — the dynamic sandbox
has no `AbortController` or timers), hard-injects
`fs`/`subprocess`/`webServer`/`credentials`/`llm`/`attachments`/`timer` so apply never
runs before its integration points, tolerates the bundle already owning the
`/design-studio` route and the `design_studio` tool, and serializes agent-history
writes per system so live activity can never clobber the final reply. The design agent
runs on the harness `subagents` service (`spawn`/`fork` in-process providers) — the
same engine as the built-in `subagent` tool — with a wall-clock timeout and cleanup.
See the repo README's compatibility notes for the underlying traps.
