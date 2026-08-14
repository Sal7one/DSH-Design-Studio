# design_prompts_forcoders — pulseboard

Source of truth for this design: the operator brief ("Pulseboard — AI-powered incident-management dashboard", this conversation).
Identity preset applied: none (this system defines its own tokens in css/style.css).

## What this screen is

A single-page incident-management overview for an on-call engineering lead: KPIs, system health,
active incidents (with filters/states), service status, activity timeline, incident drawer, and
create-incident modal. Fictional product — realistic DEMO data only (js/app.js, labeled as mock).

## Layout (top to bottom / left to right)

1. Left sidebar — logo, workspace switcher, nav (Overview/Incidents/Services/On-call/Analytics), user profile.
2. Top bar — page title, date-range, search, notifications with badge, Create incident, theme toggle.
3. KPI row — 4 cards with trend indicator + sparkline.
4. System health chart (24h, incident spike marked) + Activity timeline panel.
5. Active incidents — severity/status filter chips, table with severity badges, owner avatar,
   duration, status pill, row menu; loading / empty / error states (demo switches, honest).
6. Service status — 6 services with health, latency, error rate, mini chart.
7. Footer — design decisions + reusable-component notes.

## Interactions

- Row click (or Enter) opens a right drawer: timeline, responders, acknowledge / resolve / escalate.
- Create incident modal adds a row + activity entry + toast.
- Filter chips (severity + status) and search actually filter; empty state is a feature.
- Light/dark theme toggle; default dark. Keyboard: Esc closes, visible focus rings, aria labels.

## Data this screen needs (when wired to a real backend)

- Incidents: list + detail (severity, status, service, owner, startedAt, updates, responders).
- KPIs: active count, MTTR, services healthy, on-call pages — with trends.
- System health series (rpm, 24h) + per-service latency/error-rate series.
- Activity feed. Actions: acknowledge/resolve/escalate/create (server-gated endpoints).

## Non-negotiables (user_need.md section 3, applied)

- Read-only mockup now; when wired, mutations must be server-gated (never self-authorized).
- Honest states: loading skeleton, real empty state, error + retry; no fabricated live numbers.
- Severity/status never communicated by color alone (icons + text + aria labels).
- Dark premium B2B look: charcoal/navy, one electric-blue accent, no stock gradients/illustrations.

## Design language

Charcoal/navy surfaces (#0b0f19 bg, #101828 panels), 1px borders, electric blue #2f81f7 accent,
semantic status colors, dense but breathable. Desktop-first; mobile collapses the sidebar, stacks
KPIs, converts the table to cards, and makes drawer/modal full-width sheets.
