# Identity presets

A preset is a reusable brand identity (colors, logos, fonts, spacing, components). Applying a preset to a
design system writes token.css (the CSS variables) and copies the logo assets into assets/logos/.

Format: one JSON file per preset, matching docs/DESIGN_STUDIO.md section 2. The token.css beside it is the
rendered output of the same data (regenerated, never hand-edited).

Files here are SEED content for the DSH plugin (P3: identity presets in settings). The plugin will own the
durable store; these files are just the reference shape.

- sal7one-dark.json + sal7one-dark.token.css — the dashboard's dark theme (the homelab-command-center mockup
  already consumes these exact CSS variables).
