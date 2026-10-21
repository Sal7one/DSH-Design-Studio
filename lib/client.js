// GENERATED FILE — do not edit by hand.
// Source: lib/client/src/*.js. Regenerate with: npm run build:client
window.__ModuleLoader__.load({
  id: '@sal7one/dsh-design-studio',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const React = require('react')
    const h = React.createElement

    // ---- runtime.js ----
    // Shared client runtime set by apply(); components never close over the plugin context.
    const runtime = { ctx: null, t: (key) => key }

    // ---- styles.js ----
    // Generated from the legacy client. CSS is registered by apply(), not the factory.
    const DS_CSS = [
          // ---------- studio theme (follows DeepSeek harness tokens — light + dark) ----------
          '.ds-root,.ds-settings{--ds-bg:var(--dsw-alias-bg-base);--ds-panel:var(--dsw-alias-bg-layer-1);--ds-panel2:var(--dsw-alias-bg-layer-2);--ds-border:var(--dsw-alias-border-l1);--ds-border2:var(--dsw-alias-border-l2);--ds-text:var(--dsw-alias-label-primary);--ds-muted:var(--dsw-alias-label-secondary);--ds-accent:var(--dsw-alias-brand-primary);--ds-ok:var(--dsw-alias-state-success-primary);--ds-warn:var(--dsw-alias-state-warn-primary);--ds-err:var(--dsw-alias-state-error-primary)}',
          '.ds-root{display:flex;flex-direction:column;height:100%;min-height:0;overflow:auto;background:var(--ds-bg);color:var(--ds-text);font-size:13px;padding:0}',
          '.ds-mono{font-family:ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace}',
          '.ds-caps{font-size:10px;letter-spacing:.12em;text-transform:uppercase;font-weight:700;color:var(--ds-muted)}',
          '.ds-ok-text{color:var(--ds-ok)}',
          '.ds-muted{color:var(--ds-muted)}',
          '.ds-err{color:var(--ds-err);font-size:12px}',
          '.ds-log{color:var(--ds-muted);font-size:12px}',
          '.ds-hint{color:var(--ds-muted);font-size:11px}',
          '.ds-panel{background:var(--ds-panel);border:1px solid var(--ds-border);border-radius:12px}',
          '.ds-panel-head{border-bottom:1px solid var(--ds-border);padding:12px 16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
          '.ds-btn{display:inline-flex;align-items:center;gap:6px;background:var(--ds-panel2);border:1px solid var(--ds-border);color:var(--ds-text);border-radius:8px;padding:7px 14px;font-size:12px;font-family:ui-monospace,"JetBrains Mono",monospace;cursor:pointer}',
          '.ds-btn:hover:not(:disabled){border-color:var(--ds-border2)}',
          '.ds-btn:disabled{opacity:.5;cursor:default}',
          '.ds-btn-primary{background:var(--ds-accent);border-color:transparent;color:var(--ds-bg);font-weight:700}',
          '.ds-btn-primary:hover:not(:disabled){opacity:.88}',
          '.ds-input{background:var(--ds-panel2);border:1px solid var(--ds-border);color:var(--ds-text);border-radius:8px;padding:8px 12px;font-size:12px;font-family:ui-monospace,"JetBrains Mono",monospace;min-width:140px}',
          '.ds-input:focus{outline:none;border-color:var(--ds-accent)}',
          '.ds-select{background:var(--ds-panel2);border:1px solid var(--ds-border);color:var(--ds-text);border-radius:8px;padding:7px 10px;font-size:12px;max-width:340px}',
          // ---------- header + system chips ----------
          '.ds-top{padding:20px 24px 0;display:flex;flex-direction:column;gap:14px}',
          '.ds-top-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}',
          '.ds-title{font-size:20px;font-weight:700;letter-spacing:-.01em}',
          '.ds-actions{margin-left:auto;display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
          '.ds-chips{display:flex;gap:8px;flex-wrap:wrap}',
          '.ds-chip{display:inline-flex;align-items:center;gap:7px;background:var(--ds-panel2);border:1px solid var(--ds-border);color:var(--ds-muted);border-radius:8px;padding:7px 12px;font-family:ui-monospace,"JetBrains Mono",monospace;font-size:12px;cursor:pointer}',
          '.ds-chip:hover{border-color:var(--ds-border2);color:var(--ds-text)}',
          '.ds-chip.on{border-color:var(--ds-accent);color:var(--ds-accent)}',
          // ---------- main workspace ----------
          '.ds-workspace-shell{display:flex;flex-direction:column;gap:10px;min-height:0;width:100%;min-width:0}',
          '.ds-workspace-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:0 24px;margin-top:12px;margin-bottom:2px}',
          '.ds-design-switcher{display:flex;align-items:center;gap:6px;min-width:0}',
          '.ds-design-switcher .ds-select{max-width:260px;min-width:180px;padding:6px 9px;font-size:11px}',
          '.ds-freeze-btn{padding:9px 15px;border:1px solid var(--ds-accent);border-radius:8px;background:color-mix(in srgb,var(--ds-accent) 12%,var(--ds-panel));color:var(--ds-text);font:inherit;font-size:12px;font-weight:700;letter-spacing:.02em;cursor:pointer;white-space:nowrap}',
          '.ds-freeze-btn:hover{border-color:var(--ds-text);background:color-mix(in srgb,var(--ds-accent) 18%,var(--ds-panel));transform:translateY(-1px)}',
          '.ds-freeze-btn:disabled{opacity:.5;cursor:not-allowed;transform:none}',
          '.ds-freeze-state{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--ds-accent);border:1px solid var(--ds-accent);border-radius:999px;padding:5px 10px;white-space:nowrap}',
          '.ds-freeze-banner{display:flex;align-items:center;gap:12px;margin:0 24px;padding:12px 14px;border:1px solid var(--ds-accent);border-radius:10px;background:color-mix(in srgb,var(--ds-accent) 8%,var(--ds-panel));flex-wrap:wrap}',
          '.ds-freeze-banner-icon{font-size:20px}',
          '.ds-freeze-banner-copy{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}',
          '.ds-freeze-banner-copy b{font-size:12px;letter-spacing:.02em}',
          '.ds-freeze-banner-copy span{font-size:11px;color:var(--ds-muted);overflow-wrap:anywhere}',
          '.ds-freeze-banner-copy .ds-hint{font-size:10px}',
          '.ds-freeze-modal{max-width:560px;width:min(560px,94vw);display:flex;flex-direction:column;gap:10px}',
          '.ds-freeze-modal .ds-field{display:flex;flex-direction:column;gap:4px;font-size:11px;color:var(--ds-muted)}',
          '.ds-freeze-modal .ds-field .ds-input{width:100%}',
          '.ds-freeze-modal .ds-field .ds-select{width:100%}',
          '.ds-main{display:grid;grid-template-columns:300px minmax(0,1fr);grid-template-areas:"left content";gap:16px;padding:0 24px 18px;min-height:0;width:100%;min-width:0}',
          '.ds-main.tab-settings,.ds-main.tab-preview{grid-template-columns:minmax(0,1fr);grid-template-areas:"content"}',
          '.ds-main.tab-settings .ds-library-col,.ds-main.tab-preview .ds-library-col{display:none}',
          '.ds-main.tab-preview .ds-side-col{display:none}',
          '.ds-library-col{grid-area:left}',
          '.ds-preview-col{grid-area:content;min-width:0}',
          '.ds-side-col{grid-area:content;display:flex;flex-direction:column;gap:12px;min-width:0}',
          '.ds-library{display:flex;flex-direction:column;gap:8px;padding:12px}',
          '.ds-lib-list{display:flex;flex-direction:column;gap:4px;max-height:210px;overflow:auto}',
          '.ds-lib-item{display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;border:1px solid transparent;border-radius:7px;background:transparent;color:var(--ds-text);cursor:pointer;font:inherit;text-align:left}',
          '.ds-lib-item:hover{border-color:var(--ds-border)}',
          '.ds-lib-item.on{border-color:var(--ds-accent);background:color-mix(in srgb,var(--ds-accent) 9%,transparent)}',
          '.ds-lib-item b{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
          '.ds-lib-badges{display:flex;gap:4px;margin-left:auto;flex:0 0 auto}',
          '.ds-lib-badges .ds-badge{font-size:9px;padding:1px 4px}',
          '.ds-asset-mini{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}',
          '.ds-asset-mini-item{aspect-ratio:1;padding:0;border:1px solid var(--ds-border);border-radius:6px;overflow:hidden;background:var(--ds-panel2);cursor:pointer}',
          '.ds-asset-mini-item:hover{border-color:var(--ds-accent)}',
          '.ds-asset-mini-item img{width:100%;height:100%;object-fit:cover;display:block}',
          '.ds-workspace-tabs{display:flex;align-items:center;gap:2px;padding:4px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-panel);width:fit-content;max-width:100%;overflow:auto}',
          '.ds-workspace-tabs .ds-seg{border:0;border-radius:6px;padding:6px 12px;font-size:12px;background:transparent;color:var(--ds-muted);cursor:pointer}',
          '.ds-workspace-tabs .ds-seg.on{background:var(--ds-panel2);color:var(--ds-text);font-weight:600}',
          '.ds-side-col .ds-agent{height:calc(100vh - 330px);min-height:520px;flex:1}',
          '.ds-side-review{display:flex;flex-direction:column;gap:12px;padding:14px}',
          '.ds-side-col.tab-agent .ds-side-upload,.ds-side-col.tab-agent .ds-side-review{display:none}',
          '.ds-side-col.tab-review .ds-agent,.ds-side-col.tab-review .ds-side-upload{display:none}',
          '.ds-side-col.tab-upload .ds-agent,.ds-side-col.tab-upload .ds-side-review{display:none}',
          '.ds-side-col.tab-settings .ds-agent,.ds-side-col.tab-settings .ds-side-upload,.ds-side-col.tab-settings .ds-side-review{display:none}',
          '.ds-side-col.tab-assets .ds-agent,.ds-side-col.tab-assets .ds-side-upload,.ds-side-col.tab-assets .ds-side-review{display:none}',
          '.ds-side-col.tab-history .ds-agent,.ds-side-col.tab-history .ds-side-upload,.ds-side-col.tab-history .ds-side-review{display:none}',
          '.ds-side-col.tab-styles .ds-agent,.ds-side-col.tab-styles .ds-side-upload,.ds-side-col.tab-styles .ds-side-review{display:none}',
          '.ds-workspace-styles{min-height:560px}',
          '.ds-styles{display:flex;flex-direction:column;gap:12px}',
          '.ds-style-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
          '.ds-style-tools .ds-input{flex:1;min-width:180px}',
          '.ds-style-save{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px;border:1px dashed var(--ds-border);border-radius:8px}',
          '.ds-style-save .ds-input{flex:1;min-width:150px}',
          '.ds-style-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(235px,1fr));gap:10px}',
          '.ds-style-card{display:flex;flex-direction:column;gap:8px;padding:10px;border:1px solid var(--ds-border);border-radius:10px;background:var(--ds-panel);min-width:0}',
          '.ds-style-card:hover{border-color:var(--ds-border2)}',
          '.ds-style-card.featured{background:var(--ds-panel2);border-color:var(--ds-border2);padding:14px}',
          '.ds-style-pager-shell{display:grid;grid-template-columns:38px minmax(0,1fr) 38px;gap:8px;align-items:stretch}',
          '.ds-style-pager-nav{align-self:center;width:38px;height:56px;border:1px solid var(--ds-border);border-radius:9px;background:var(--ds-panel);color:var(--ds-text);font-size:26px;line-height:1;cursor:pointer}',
          '.ds-style-pager-nav:hover{border-color:var(--ds-accent);color:var(--ds-accent)}',
          '.ds-style-pager-stage{min-width:0}',
          '.ds-style-pager-meta{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 2px 6px}',
          '.ds-style-pager-strip{display:flex;gap:5px;align-items:center;overflow-x:auto;padding:4px 2px 8px;scrollbar-width:thin}',
          '.ds-style-pager-dot{flex:0 0 auto;width:18px;height:18px;border-radius:50%;border:2px solid transparent;opacity:.38;cursor:pointer;padding:0}',
          '.ds-style-pager-dot.on{opacity:1;border-color:var(--ds-text);transform:scale(1.18)}',
          '.ds-vision-warning{margin:8px 0 2px;padding:8px 10px;border:1px solid var(--ds-warn);border-radius:8px;background:color-mix(in srgb,var(--ds-warn) 11%,transparent);color:var(--ds-text);font-size:11px;line-height:1.45}',
          '.ds-vision-warning b{color:var(--ds-warn)}',
          '.ds-vision-note{margin:8px 0 2px;padding:7px 10px;border:1px dashed var(--ds-border2);border-radius:8px;background:var(--ds-panel);color:var(--ds-muted);font-size:11px;line-height:1.45}',
          '.ds-style-apply-notice{display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--ds-ok);border-radius:8px;background:color-mix(in srgb,var(--ds-ok) 10%,transparent);font-size:12px}',
          '.ds-style-preview-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-left:10px}',
          '.ds-try-tour{display:flex;align-items:center;gap:10px;width:100%;padding:13px 16px;border:1px solid var(--ds-accent);border-radius:10px;background:linear-gradient(135deg,color-mix(in srgb,var(--ds-accent) 18%,var(--ds-panel)),var(--ds-panel2));color:var(--ds-text);cursor:pointer;font:inherit;text-align:left}',
          '.ds-try-tour:hover{border-color:var(--ds-text);transform:translateY(-1px)}',
          '.ds-try-tour:disabled{opacity:.5;cursor:not-allowed;transform:none}',
          '.ds-try-tour-icon{font-size:20px}',
          '.ds-try-tour span:nth-child(2){font-size:14px;font-weight:700;letter-spacing:.01em}',
          '.ds-try-tour-hint{margin-left:auto;font-size:11px;color:var(--ds-muted)}',
          '.ds-style-tour{display:flex;flex-direction:column;gap:6px;border-bottom:1px solid var(--ds-border);background:var(--ds-panel2);padding:8px 10px 10px}',
          '.ds-style-tour-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
          '.ds-style-tour-head b{font-size:12px;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
          '.ds-style-tour-row{display:flex;align-items:stretch;gap:6px}',
          '.ds-style-tour-nav{flex:0 0 30px;border:1px solid var(--ds-border);border-radius:7px;background:var(--ds-panel);color:var(--ds-text);font-size:20px;cursor:pointer}',
          '.ds-style-tour-nav:hover{border-color:var(--ds-accent);color:var(--ds-accent)}',
          '.ds-style-tour-track{display:flex;gap:7px;overflow-x:auto;scroll-snap-type:x mandatory;padding:2px 1px 5px;flex:1;min-width:0}',
          '.ds-style-tour-card{flex:0 0 156px;display:flex;flex-direction:column;gap:5px;padding:7px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-panel);color:var(--ds-text);cursor:pointer;text-align:left;scroll-snap-align:center}',
          '.ds-style-tour-card.on{border-color:var(--ds-accent);box-shadow:0 0 0 1px var(--ds-accent);background:var(--ds-panel2)}',
          '.ds-style-tour-card b{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
          '.ds-style-tour-card .ds-hint{font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
          '.ds-style-tour-swatches{display:flex;height:15px;border-radius:4px;overflow:hidden}',
          '.ds-style-tour-swatches i{flex:1}',
          '.ds-style-swatches{display:flex;height:32px;border:1px solid var(--ds-border);border-radius:7px;overflow:hidden}',
          '.ds-style-swatches i{flex:1}',
          '.ds-style-sample{display:flex;align-items:center;gap:6px;padding:8px 10px;border:1px solid;min-height:44px;overflow:hidden}',
          '.ds-style-sample-title{font-size:18px;font-weight:700;line-height:1;margin-right:auto}',
          '.ds-style-sample-chip{display:inline-flex;align-items:center;padding:4px 8px;border-radius:999px;font-size:10px;line-height:1.2;font-family:inherit;white-space:nowrap}',
          '.ds-style-sample-chip.ghost{background:transparent;border:1px solid;color:inherit;opacity:.8}',
          '.ds-style-head{display:flex;align-items:center;gap:6px;flex-wrap:wrap}',
          '.ds-style-head b{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
          '.ds-style-tag{margin:0;color:var(--ds-muted);font-size:11px;line-height:1.4;min-height:2.8em;overflow:hidden}',
          '.ds-style-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;color:var(--ds-muted);font-size:10px}',
          '.ds-style-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:auto}',
          '.ds-style-actions .ds-btn{padding:5px 8px;font-size:10px}',
          '.ds-style-attribution{max-width:90ch}',
          '.ds-style-attribution a{color:var(--ds-accent)}',
          '.ds-style-preview-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:7px 12px;border-bottom:1px solid var(--ds-border);background:color-mix(in srgb,var(--ds-accent) 8%,var(--ds-panel))}',
          '.ds-style-preview-bar b{font-size:12px}',
          '.ds-style-preview-bar .ds-toolbar-gap{flex:1}',
          '.ds-workspace-settings{border:1px solid var(--ds-border);border-radius:8px;padding:14px;background:var(--ds-panel)}',
          '.ds-workspace-history{min-height:520px}',
          '.ds-history{display:flex;flex-direction:column;gap:12px;min-height:520px}',
          '.ds-history-list{display:flex;flex-direction:column;gap:8px;max-height:calc(100vh - 430px);overflow:auto}',
          '.ds-history-item{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-panel)}',
          '.ds-history-item.on{border-color:var(--ds-accent);background:color-mix(in srgb,var(--ds-accent) 8%,transparent)}',
          '.ds-history-main{display:flex;flex-direction:column;gap:4px;min-width:0}',
          '.ds-history-title{display:flex;align-items:center;gap:6px;flex-wrap:wrap}',
          '.ds-history-title b{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
          '.ds-history-actions{flex:0 0 auto}',
          '.ds-history-note{max-width:72ch}',
          '.ds-workspace-assets{min-height:520px}',
          '.ds-assets-embedded{display:flex;flex-direction:column;gap:10px;min-height:520px;padding:14px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-panel)}',
          '.ds-assets-embedded .ds-overlay-head{padding:0;border:0;background:transparent}',
          '.ds-assets-embedded .ds-overlay-body{flex:1;min-height:420px;overflow:auto;padding:0}',
          '.ds-preview-stage{position:relative;display:flex;justify-content:flex-start;align-items:flex-start;width:100%;min-width:0;min-height:440px;padding:18px;background:var(--ds-panel2);overflow:auto}',
          '.ds-preview-stage.is-fit{height:clamp(300px,58vh,660px);min-height:300px;align-items:center;overflow:hidden}',
          '.ds-device-frame{position:relative;flex:0 0 auto;margin:0 auto;overflow:hidden;border:1px solid var(--ds-border2);border-radius:10px;background:#fff;box-shadow:0 18px 50px rgba(0,0,0,.28)}',
          '.ds-device-frame iframe{display:block;border:0;background:#fff}',
          '.ds-scaled-badge{position:absolute;right:12px;bottom:12px;padding:3px 7px;border-radius:4px;background:rgba(0,0,0,.62);color:#fff;font:10px/1.4 ui-monospace,"JetBrains Mono",monospace;pointer-events:none}',
          '.ds-col{display:flex;flex-direction:column;gap:16px;min-width:0}',
          // ---------- outline side panel ----------
          '.ds-outline{max-height:340px;overflow:auto;display:flex;flex-direction:column}',
          '.ds-outline-body{padding:10px 12px;display:flex;flex-direction:column;gap:6px}',
          '.ds-outline-file{font-family:ui-monospace,"JetBrains Mono",monospace;font-size:11px;font-weight:700;color:var(--ds-accent);margin-top:6px}',
          '.ds-outline-item{padding:3px 8px;border-left:2px solid var(--ds-border2);font-size:11px;color:var(--ds-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
          '.ds-outline-item.section{color:var(--ds-warn)}',
          '.ds-outline-item.heading{color:var(--ds-text)}',
          // ---------- preview card ----------
          '.ds-preview-card{display:flex;flex-direction:column;min-height:0;overflow:hidden;flex:1}',
          '.ds-chrome{height:44px;border-bottom:1px solid var(--ds-border);display:flex;align-items:center;gap:10px;padding:0 14px;background:var(--ds-panel2)}',
          '.ds-dots{display:flex;gap:6px}',
          '.ds-dot{width:10px;height:10px;border-radius:50%;background:var(--ds-muted)}',
          '.ds-dot.r{background:var(--ds-err)}.ds-dot.y{background:var(--ds-warn)}.ds-dot.g{background:var(--ds-ok)}',
          '.ds-url{flex:1;max-width:420px;background:var(--ds-bg);border:1px solid var(--ds-border);border-radius:4px;display:flex;align-items:center;gap:6px;padding:4px 10px;color:var(--ds-muted);font-family:ui-monospace,"JetBrains Mono",monospace;font-size:11px;overflow:hidden;white-space:nowrap}',
          '.ds-live{display:flex;align-items:center;gap:6px;border:1px solid var(--ds-ok);border-radius:4px;padding:3px 10px;font-size:9px;letter-spacing:.14em;text-transform:uppercase;font-weight:700;color:var(--ds-ok);font-family:ui-monospace,"JetBrains Mono",monospace}',
          '.ds-live .pulse{width:7px;height:7px;border-radius:50%;background:var(--ds-ok);box-shadow:0 0 8px var(--ds-ok);animation:dsPulse 1.6s ease-in-out infinite}',
          '.ds-chrome .ds-btn{padding:4px 10px;font-size:11px}',
          '.ds-chrome .ds-select{padding:4px 8px;font-size:11px;max-width:220px}',
          '.ds-chrome-gap{flex:1}',
          '@keyframes dsPulse{0%,100%{opacity:1}50%{opacity:.35}}',
          '.ds-frame-holder{flex:1;display:block;min-height:0;overflow:visible}',
          '.ds-frame-ph{display:flex;flex-direction:column;align-items:center;gap:14px;color:var(--ds-muted)}',
          '.ds-frame-ph .glyph{font-size:44px;opacity:.5}',
          '.ds-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
          '.ds-toolbar-gap{flex:1}',
          // ---------- agent chat ----------
          '.ds-agent{display:flex;flex-direction:column;height:400px;overflow:hidden}',
          '.ds-agent-inline{margin:0 0 2px;padding:8px 10px;border:1px solid var(--ds-err);border-radius:8px;background:color-mix(in srgb,var(--ds-err) 10%,transparent)}',
          '.ds-agent-working{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--ds-muted);padding:2px 0}',
          '.ds-activity{font-family:ui-monospace,"JetBrains Mono",monospace;font-size:11px;color:var(--ds-muted);border-left:2px solid var(--ds-border2);padding:2px 8px;white-space:pre-wrap;word-break:break-word}',
          '.ds-agent-body{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px}',
          '.ds-msg{display:flex;align-items:flex-start;gap:9px}',
          '.ds-msg.me{justify-content:flex-end}',
          '.ds-ava{width:28px;height:28px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:14px;flex:0 0 auto}',
          '.ds-ava.agent{background:var(--ds-panel2);color:var(--ds-accent)}',
          '.ds-ava.you{background:var(--ds-panel2);color:var(--ds-muted)}',
          '.ds-ava.review{background:var(--ds-panel2);color:var(--ds-warn)}',
          '.ds-file-input{display:none}',
          '.ds-bubble{position:relative;max-width:85%;background:var(--ds-panel);border:1px solid var(--ds-border);border-radius:8px;padding:9px 12px;font-size:13px;line-height:1.5;white-space:pre-wrap;word-break:break-word}',
          '.ds-msg.me .ds-bubble{background:var(--ds-panel2);border-color:var(--ds-accent)}',
          '.ds-copy{position:absolute;top:6px;right:6px;background:var(--ds-panel2);border:1px solid var(--ds-border);color:var(--ds-muted);border-radius:4px;padding:2px 7px;font-size:10px;cursor:pointer;opacity:.55}',
          '.ds-copy:hover{opacity:1;color:var(--ds-accent);border-color:var(--ds-accent)}',
          '.ds-agent-foot{border-top:1px solid var(--ds-border);padding:12px;display:flex;gap:8px}',
          '.ds-agent-foot .ds-input{flex:1}',
          // ---------- drop zones ----------
          '.ds-drops{display:grid;grid-template-columns:1fr 1fr;gap:14px}',
          '.ds-drop{border:2px dashed var(--ds-border);border-radius:10px;padding:16px;display:flex;flex-direction:column;align-items:center;gap:8px;color:var(--ds-muted);font-size:11px;text-align:center;cursor:pointer;transition:border-color .15s;background:transparent;width:100%}',
          '.ds-drop:hover{border-color:var(--ds-accent)}',
          '.ds-drop.docs:hover{border-color:var(--ds-ok)}',
          '.ds-drop.on{border-color:var(--ds-accent);color:var(--ds-accent)}',
          '.ds-drop .glyph{font-size:26px}',
          // ---------- vision review ----------
          '.ds-vision-thumb{width:100%;aspect-ratio:16/9;background:var(--ds-panel2);border:1px solid var(--ds-border);border-radius:6px;display:flex;align-items:center;justify-content:center;overflow:hidden}',
          '.ds-vision-thumb img{width:100%;height:100%;object-fit:cover}',
          '.ds-vision-thumb .glyph{font-size:30px;color:var(--ds-muted)}',
          '.ds-verdict-row{display:flex;gap:8px;width:100%}',
          '.ds-verdict-cell{flex:1;border:1px solid var(--ds-border);border-radius:6px;padding:7px 8px;text-align:center;font-size:11px;font-weight:700;font-family:ui-monospace,"JetBrains Mono",monospace;color:var(--ds-muted);opacity:.55}',
          '.ds-verdict-cell.on-good{border-color:var(--ds-ok);color:var(--ds-ok);opacity:1}',
          '.ds-verdict-cell.on-poor{border-color:var(--ds-err);color:var(--ds-err);opacity:1}',
          // ---------- footer ----------
          '.ds-foot{border-top:1px solid var(--ds-border);background:var(--ds-bg);padding:8px 24px;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}',
          '.ds-foot .ds-caps{font-size:9px}',
          '.ds-foot .good{color:var(--ds-ok)}',
          '.ds-foot .bad{color:var(--ds-err)}',
          '.ds-status-pill{display:flex;align-items:center;gap:6px;background:var(--ds-panel2);border:1px solid var(--ds-border);border-radius:4px;padding:3px 10px}',
          '.ds-status-pill .dot{width:7px;height:7px;border-radius:50%;background:var(--ds-ok);box-shadow:0 0 8px var(--ds-ok)}',
          // ---------- select mode (element picker) ----------
          '.ds-sel-panel{border-top:1px solid var(--ds-border);padding:12px 16px;display:flex;flex-direction:column;gap:10px;background:var(--ds-panel)}',
          '.ds-sel-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
          '.ds-sel-path{font-family:ui-monospace,"JetBrains Mono",monospace;font-size:12px;color:var(--ds-accent);word-break:break-all}',
          '.ds-sel-chain{display:flex;flex-wrap:wrap;gap:6px;align-items:center}',
          '.ds-sel-node{background:var(--ds-panel2);border:1px solid var(--ds-border);border-radius:6px;padding:3px 9px;font-family:ui-monospace,"JetBrains Mono",monospace;font-size:10px;color:var(--ds-muted);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
          '.ds-sel-node.target{border-color:var(--ds-warn);color:var(--ds-warn)}',
          '.ds-sel-sep{color:var(--ds-border);font-family:ui-monospace,monospace;font-size:10px}',
          '.ds-sel-styles{font-family:ui-monospace,"JetBrains Mono",monospace;font-size:10.5px;color:var(--ds-muted);line-height:1.6;word-break:break-all}',
          // ---------- select popup (modal chat for ONE element change) ----------
          '.ds-modal-backdrop{position:fixed;inset:0;background:rgba(4,8,18,.55);display:flex;align-items:center;justify-content:center;z-index:1000;padding:16px}',
          '.ds-modal{width:min(560px,92vw);max-height:82vh;overflow:auto;background:var(--ds-panel);border:1px solid var(--ds-border2);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:12px;box-shadow:0 24px 64px rgba(0,0,0,.45)}',
          '.ds-modal-title{display:flex;align-items:center;gap:8px;font-weight:700;font-size:14px;flex-wrap:wrap}',
          '.ds-modal-input{width:100%;resize:vertical;min-height:64px;background:var(--ds-panel2);border:1px solid var(--ds-border);color:var(--ds-text);border-radius:8px;padding:10px 12px;font-size:13px;font-family:ui-monospace,"JetBrains Mono",monospace;box-sizing:border-box}',
          '.ds-modal-input:focus{outline:none;border-color:var(--ds-accent)}',
          '.ds-modal-reply{background:var(--ds-panel2);border:1px solid var(--ds-border);border-radius:8px;padding:10px 12px;font-size:12.5px;line-height:1.5;white-space:pre-wrap;word-break:break-word}',
          // working state: mini, out of the preview's way, with a spinner
          '.ds-spinner-row{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--ds-muted);padding:2px 0}',
          '.ds-spinner{width:12px;height:12px;border:2px solid var(--ds-border2);border-top-color:var(--ds-accent);border-radius:50%;animation:dsSpin .8s linear infinite;flex:0 0 auto}',
          '@keyframes dsSpin{to{transform:rotate(360deg)}}',
          '.ds-modal-backdrop.ds-clear{background:transparent;pointer-events:none}',
          '.ds-modal-backdrop.ds-clear .ds-modal{pointer-events:auto}',
          '.ds-modal-mini{position:fixed;left:auto;top:auto;right:16px;bottom:16px;width:380px;max-width:92vw;max-height:50vh}',
          // ---------- badges + empty states ----------
          '.ds-badge{font-size:9px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;border-radius:4px;padding:2px 8px;border:1px solid;white-space:nowrap}',
          '.ds-badge.blue{color:var(--ds-accent);border-color:var(--ds-accent);background:transparent}',
          '.ds-badge.green{color:var(--ds-ok);border-color:var(--ds-ok);background:transparent}',
          '.ds-badge.amber{color:var(--ds-warn);border-color:var(--ds-warn);background:transparent}',
          '.ds-empty{color:var(--ds-muted);padding:22px;border:1px dashed var(--ds-border);border-radius:10px;text-align:center}',
          // ---------- settings + all designs (transparent, native) ----------
          '.ds-settings{display:flex;flex-direction:column;gap:14px;font-size:13px;color:var(--dsw-alias-label-primary);background:transparent}',
          '.ds-section{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:14px;display:flex;flex-direction:column;gap:10px;background:transparent;margin-bottom:0}',
          '.ds-section h3{margin:0;font-size:13px}',
          '.ds-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}',
          '.ds-field{display:flex;flex-direction:column;gap:4px;font-size:12px}',
          '.ds-field-label{color:var(--dsw-alias-label-secondary);font-size:11px}',
          '.ds-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
          '.ds-runbar{display:flex;align-items:center;gap:10px;margin:10px 14px 0;padding:10px 14px;border:1px solid var(--ds-accent);border-radius:10px;background:var(--ds-panel2);color:var(--ds-text);font-size:12px}',
          '.ds-runbar.done{border-color:var(--ds-ok);color:var(--ds-ok)}',
          '.ds-runbar-text{flex:1;min-width:0}',
          '.ds-runbar-time{font-family:ui-monospace,"JetBrains Mono",monospace;font-size:11px;color:var(--ds-muted)}',
          '.ds-runbar-x{background:transparent;border:0;color:var(--ds-muted);font-size:15px;line-height:1;padding:2px 6px;cursor:pointer}',
          '.ds-runbar-x:hover{color:var(--ds-text)}',
          '.ds-check{display:flex;gap:6px;align-items:center;font-size:12px}',
          '.ds-preset-list{display:flex;flex-direction:column;gap:6px;max-height:200px;overflow:auto}',
          '.ds-preset-item{border:1px solid var(--dsw-alias-border-l1);border-radius:6px;padding:8px 10px;cursor:pointer;display:flex;justify-content:space-between;gap:8px;align-items:center;background:transparent}',
          '.ds-preset-item:hover{border-color:var(--dsw-alias-brand-primary)}',
          '.ds-colorchip{display:inline-block;width:10px;height:10px;border-radius:3px;border:1px solid var(--dsw-alias-border-l2);margin-right:2px;vertical-align:middle}',
          '.ds-runpanel{display:flex;flex-direction:column;gap:6px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);font-size:12px;color:var(--dsw-alias-label-primary)}',
          '.ds-runpanel-title{font-weight:700}',
          '.ds-runpanel-body{display:flex;flex-direction:column;gap:4px;color:var(--dsw-alias-label-secondary)}',
          // ---------- asset library overlay ----------
          '.ds-btn{text-decoration:none}',
          '.ds-chrome{flex-wrap:wrap;height:auto;min-height:44px;padding:6px 14px}',
          '.ds-url{min-width:0;text-decoration:none;cursor:pointer;text-align:left}.ds-url:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}',
          '.ds-external{margin-left:6px;font-size:11px;color:var(--dsw-alias-label-secondary)}',
          '.ds-overlay{position:fixed;inset:0;z-index:10000;display:flex;flex-direction:column;gap:10px;padding:16px;background:rgba(8,10,14,.62);backdrop-filter:blur(10px)}',
          '.ds-assets-modal{padding-top:max(56px,env(safe-area-inset-top))}',
          '.ds-overlay-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:8px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1)}',
          '.ds-overlay-title{display:flex;align-items:center;gap:10px;min-width:0}',
          '.ds-overlay-title b{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
          '.ds-overlay-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
          '.ds-overlay-body{flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;gap:10px;overflow:auto;padding:6px}',
          '.ds-assets-body{align-items:stretch}',
          '.ds-drop{display:flex;flex-direction:column;gap:4px;align-items:center;justify-content:center;min-height:100px;padding:18px;border:1px dashed var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-1);cursor:pointer;text-align:center}',
          '.ds-drop.is-drag{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2)}',
          '.ds-asset-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px;width:100%}',
          '.ds-asset-card{display:flex;flex-direction:column;gap:8px;min-width:0;padding:10px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);cursor:pointer}',
          '.ds-asset-card:hover{border-color:var(--dsw-alias-border-l2)}',
          '.ds-asset-thumb{display:flex;align-items:center;justify-content:center;aspect-ratio:4/3;overflow:hidden;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-layer-2)}',
          '.ds-asset-thumb img{display:block;width:100%;height:100%;object-fit:cover}',
          '.ds-asset-glyph{font-size:28px;color:var(--dsw-alias-label-secondary)}',
          '.ds-asset-meta{display:flex;flex-direction:column;gap:3px;min-width:0}',
          '.ds-asset-meta b{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
          '.ds-asset-path{font-family:ui-monospace,"JetBrains Mono",monospace;font-size:10px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
          '.ds-asset-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:auto}',
          '.ds-asset-actions .ds-btn{padding:5px 8px;font-size:10px}',
          '.ds-asset-light{position:fixed;inset:0;z-index:10001;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,.72)}',
          '.ds-asset-light-inner{display:flex;flex-direction:column;gap:12px;max-width:min(1100px,92vw);max-height:90vh;overflow:auto;padding:14px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1)}',
          '.ds-asset-light-inner img{max-width:100%;max-height:62vh;object-fit:contain;border-radius:8px;background:var(--dsw-alias-bg-layer-2)}',
          '.ds-asset-light-meta{display:flex;flex-direction:column;gap:4px}',
          '.ds-asset-light-meta code{font-size:11px;color:var(--dsw-alias-label-secondary)}',
          '@media (max-width:700px){.ds-overlay{padding:10px}.ds-assets-modal{padding-top:48px}.ds-overlay-head{align-items:flex-start}.ds-overlay-actions{width:100%}.ds-asset-grid{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}}',
          // ---------- settings: vision-first layout ----------
          '.ds-settings-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:2px 0 12px;border-bottom:1px solid var(--dsw-alias-border-l1);position:sticky;top:0;z-index:2;background:var(--dsw-alias-bg-base)}',
          '.ds-settings-head h3{margin:0;font-size:15px;letter-spacing:-.01em}',
          '.ds-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}',
          '.ds-card-head h3{margin:0;font-size:13px}',
          '.ds-status-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;padding:3px 9px;font-size:10px;font-family:ui-monospace,"JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--dsw-alias-label-secondary);white-space:nowrap}',
          '.ds-status-chip::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-label-secondary)}',
          '.ds-status-chip.ok{border-color:var(--dsw-alias-state-success-primary);color:var(--dsw-alias-state-success-primary)}',
          '.ds-status-chip.ok::before{background:var(--dsw-alias-state-success-primary);box-shadow:0 0 8px var(--dsw-alias-state-success-primary)}',
          '.ds-status-chip.warn{border-color:var(--dsw-alias-state-warn-primary);color:var(--dsw-alias-state-warn-primary)}',
          '.ds-status-chip.warn::before{background:var(--dsw-alias-state-warn-primary)}',
          '.ds-vision-status{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding:11px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1)}',
          '.ds-kv{display:flex;flex-direction:column;gap:2px;min-width:0}',
          '.ds-k{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--dsw-alias-label-secondary)}',
          '.ds-v{font-size:12px;overflow-wrap:anywhere;color:var(--dsw-alias-label-primary)}',
          '.ds-grid-2{grid-template-columns:repeat(2,minmax(0,1fr))}',
          '.ds-grid-3{grid-template-columns:repeat(3,minmax(0,1fr))}',
          '.ds-segmented{display:inline-flex;gap:2px;padding:3px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:transparent;width:fit-content}',
          '.ds-seg{border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);padding:6px 10px;font-size:11px;font-family:ui-monospace,"JetBrains Mono",monospace;cursor:pointer}',
          '.ds-seg:hover:not(.on){color:var(--dsw-alias-label-primary)}',
          '.ds-seg.on{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-weight:700}',
          '.ds-disclosure{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:transparent}',
          '.ds-disclosure>summary{display:flex;align-items:center;gap:8px;padding:12px 14px;cursor:pointer;list-style:none;font-size:13px;font-weight:700}',
          '.ds-disclosure>summary::-webkit-details-marker{display:none}',
          '.ds-disclosure>summary::before{content:"▸";color:var(--dsw-alias-label-secondary);font-size:11px}',
          '.ds-disclosure[open]>summary::before{content:"▾"}',
          '.ds-disclosure>summary .ds-hint{margin-left:auto;font-weight:400}',
          '.ds-disclosure-body{display:flex;flex-direction:column;gap:12px;padding:0 14px 14px}',
          '.ds-disclosure.ds-nested{background:var(--dsw-alias-bg-layer-1)}',
          '.ds-note{padding:9px 11px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);font-size:11px;line-height:1.5;color:var(--dsw-alias-label-secondary)}',
          '@media (min-width:900px){.ds-settings{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:14px;align-items:start}.ds-settings-head{grid-column:1/-1}}',
          '@media (max-width:700px){.ds-grid-2,.ds-grid-3,.ds-vision-status{grid-template-columns:1fr}.ds-settings-head{position:static;flex-direction:column}.ds-settings-head .ds-row{width:100%}}',
          '@media (max-width:1100px){.ds-main{grid-template-columns:1fr;grid-template-areas:"left" "content"}.ds-main.tab-settings,.ds-main.tab-preview{grid-template-columns:1fr;grid-template-areas:"content"}.ds-side-col .ds-agent{height:480px;min-height:420px}}',
        ].join('\n')

    // One style tag for the plugin's classes (theme tokens come from CSS vars).
    // Registration and cleanup belong to apply(), not the lazy factory.
    function installCss(cssText) {
      const style = document.createElement('style')
      style.id = 'ds-studio-css'
      style.textContent = cssText
      document.head.appendChild(style)
      return () => {
        if (style.parentNode) style.parentNode.removeChild(style)
      }
    }

    // ---- labels.js ----
    // Client UI labels (locale-registered in apply).
      const labelsEn = {
        'tab.designStudio': 'Design Studio',
        'section.allDesigns': 'All designs',
        'section.designStudio': 'Design Studio',
        'title.designStudio': 'Design Studio',
      }
      const labelsZh = {
        'tab.designStudio': '设计工作室',
        'section.allDesigns': '全部设计',
        'section.designStudio': '设计工作室',
        'title.designStudio': '设计工作室',
      }

    // ---- primitives.js ----
    function Err(props) {
      return props.text ? h('div', { className: 'ds-err' }, String(props.text)) : null
    }

    function Log(props) {
      return props.text ? h('div', { className: 'ds-log' }, String(props.text)) : null
    }

    function Btn(props) {
      return h(
        'button',
        { className: 'ds-btn' + (props.primary ? ' ds-btn-primary' : ''), onClick: props.onClick, disabled: props.disabled === true, title: props.title || '' },
        props.label,
      )
    }

    function Field(props) {
      const attrs = {
        className: 'ds-input',
        value: props.value,
        onChange: (e) => props.onChange(e.target.value),
        placeholder: props.placeholder || '',
        type: props.type || 'text',
      }
      return h(
        'label',
        { className: 'ds-field' },
        h('span', { className: 'ds-field-label' }, props.label),
        h('input', attrs),
        props.hint ? h('span', { className: 'ds-hint' }, props.hint) : null,
      )
    }

    function listVal(x) {
      if (Array.isArray(x)) return x.join(', ')
      return typeof x === 'string' ? x : ''
    }

    function readAsDataUrl(file) {
      return new Promise((resolve, reject) => {
        if (typeof FileReader === 'undefined') {
          reject(new Error('FileReader unavailable in this client'))
          return
        }
        const fr = new FileReader()
        fr.onload = () => resolve(String(fr.result))
        fr.onerror = () => reject(new Error('read failed'))
        fr.readAsDataURL(file)
      })
    }

    function readAsText(file) {
      return new Promise((resolve, reject) => {
        if (typeof FileReader === 'undefined') {
          reject(new Error('FileReader unavailable in this client'))
          return
        }
        const fr = new FileReader()
        fr.onload = () => resolve(String(fr.result))
        fr.onerror = () => reject(new Error('read failed'))
        fr.readAsText(file)
      })
    }

    // ---- api.js ----
    // ---------- data channel: same-origin JSON API on the bundle's own route ----------
    async function call(method, args) {
      try {
        const res = await fetch('/design-studio/__api/' + method, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(args || {}),
        })
        if (!res.ok) return { ok: false, error: 'HTTP ' + res.status }
        return await res.json()
      } catch (err) {
        return { ok: false, error: String((err && err.message) || err) }
      }
    }

    // ---- element-picker.js ----
    // ---------- element picker (runs against the same-origin preview iframe) ----------
    function cssPathOf(el) {
      const path = []
      let cur = el
      while (cur && cur.nodeType === 1 && cur.tagName && cur.tagName.toLowerCase() !== 'html') {
        let seg = cur.tagName.toLowerCase()
        if (cur.id) {
          seg += '#' + cur.id
          path.unshift(seg)
          break
        }
        let nth = 1
        let sib = cur.previousElementSibling
        while (sib) {
          if (sib.tagName === cur.tagName) nth++
          sib = sib.previousElementSibling
        }
        seg += ':nth-of-type(' + nth + ')'
        path.unshift(seg)
        cur = cur.parentElement
      }
      return path.join(' > ')
    }

    function describeSelection(doc, el) {
      const win = doc.defaultView
      const cs = win.getComputedStyle(el)
      const styleKeys = ['background-color', 'color', 'border-radius', 'padding', 'margin', 'font-size', 'font-weight', 'display', 'position', 'width', 'height', 'gap', 'flex-direction', 'align-items', 'justify-content', 'border', 'box-shadow']
      const styles = {}
      for (const k of styleKeys) styles[k] = cs.getPropertyValue(k)
      const rect = el.getBoundingClientRect()
      const hierarchy = []
      let cur = el
      while (cur && cur.nodeType === 1 && hierarchy.length < 10) {
        const ccs = win.getComputedStyle(cur)
        hierarchy.unshift({
          tag: cur.tagName.toLowerCase(),
          id: cur.id || null,
          classes: cur.className && typeof cur.className === 'string' ? String(cur.className).split(/\s+/).filter(Boolean).slice(0, 8) : [],
          cssPath: cssPathOf(cur),
          styles: {
            background: ccs.getPropertyValue('background-color'),
            padding: ccs.getPropertyValue('padding'),
            'border-radius': ccs.getPropertyValue('border-radius'),
            'font-size': ccs.getPropertyValue('font-size'),
            display: ccs.getPropertyValue('display'),
            gap: ccs.getPropertyValue('gap'),
          },
        })
        cur = cur.parentElement
      }
      return {
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        classes: el.className && typeof el.className === 'string' ? String(el.className).split(/\s+/).filter(Boolean).slice(0, 8) : [],
        cssPath: cssPathOf(el),
        classPath: el.className && typeof el.className === 'string' ? String(el.className).trim().split(/\s+/).filter(Boolean).join('.') : '',
        text: String(el.textContent || '').trim().slice(0, 60),
        snippet: String(el.outerHTML || '').slice(0, 600),
        rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
        styles: styles,
        hierarchy: hierarchy,
      }
    }

    function injectSelector(frameEl, onSelect, onExit) {
      if (!frameEl) return false
      const doc = frameEl.contentDocument
      if (!doc || !doc.body || doc.__dsSelActive) return false
      doc.__dsSelActive = true
      const style = doc.createElement('style')
      style.id = 'ds-sel-style'
      style.textContent = [
        '.ds-sel-hover{outline:2px dashed #4d8eff !important;outline-offset:-2px;cursor:crosshair !important}',
        '.ds-sel-selected{outline:2px solid #ffb95f !important;outline-offset:-2px;box-shadow:0 0 0 9999px rgba(6,14,32,.35) !important}',
        '.ds-sel-tag{position:fixed;z-index:2147483647;pointer-events:none;background:#0b1326;color:#adc6ff;border:1px solid #adc6ff;font:11px ui-monospace,monospace;padding:2px 8px;border-radius:4px;max-width:60vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      ].join('\n')
      doc.head.appendChild(style)
      const tag = doc.createElement('div')
      tag.className = 'ds-sel-tag'
      tag.style.display = 'none'
      doc.body.appendChild(tag)
      let hoverEl = null
      const over = (e) => {
        if (hoverEl) hoverEl.classList.remove('ds-sel-hover')
        hoverEl = e.target
        if (hoverEl && hoverEl.nodeType === 1) {
          hoverEl.classList.add('ds-sel-hover')
          const cls = hoverEl.className && typeof hoverEl.className === 'string' && hoverEl.className.trim() ? '.' + String(hoverEl.className).trim().split(/\s+/).join('.') : ''
          tag.textContent = hoverEl.tagName.toLowerCase() + cls
          tag.style.display = 'block'
          tag.style.left = Math.min(e.clientX + 12, doc.documentElement.clientWidth - 220) + 'px'
          tag.style.top = (e.clientY + 14) + 'px'
        }
      }
      const click = (e) => {
        if (e.target === tag || !e.target || e.target.nodeType !== 1) return
        e.preventDefault()
        e.stopPropagation()
        const payload = describeSelection(doc, e.target)
        if (hoverEl) hoverEl.classList.remove('ds-sel-hover')
        e.target.classList.add('ds-sel-selected')
        onSelect(payload)
      }
      const key = (e) => {
        if (e.key === 'Escape') onExit()
      }
      doc.addEventListener('mouseover', over, true)
      doc.addEventListener('click', click, true)
      doc.addEventListener('keydown', key, true)
      doc.__dsSelCleanup = () => {
        doc.removeEventListener('mouseover', over, true)
        doc.removeEventListener('click', click, true)
        doc.removeEventListener('keydown', key, true)
        const s = doc.getElementById('ds-sel-style')
        if (s && s.parentNode) s.parentNode.removeChild(s)
        if (tag && tag.parentNode) tag.parentNode.removeChild(tag)
        if (hoverEl) hoverEl.classList.remove('ds-sel-hover')
        doc.__dsSelActive = false
      }
      return true
    }

    // ---- scaled-preview.js ----
    // Fixed-viewport preview used inside the Studio's optional Preview tab.
    // The iframe renders at a real desktop/tablet/mobile CSS width and is scaled
    // to the available column, so the design never falls into its mobile layout
    // just because the DSH panel is narrow.
    const SIZES = {
      desktop: { label: 'Desktop', w: 1440, h: 1600 },
      tablet: { label: 'Tablet', w: 834, h: 1180 },
      mobile: { label: 'Mobile', w: 390, h: 844 },
    }

    function href(slug, tick) {
      return '/design-studio/' + encodeURIComponent(slug) + '/html/index.html?v=' + tick
    }

    function ScaledPreview({ slug, tick, viewport, fit, onLoad, setFrameRef }) {
      const size = SIZES[viewport] || SIZES.desktop
      const [scale, setScale] = React.useState(1)
      const wrapRef = React.useRef ? React.useRef(null) : { current: null }

      React.useEffect(() => {
        function measure() {
          const el = wrapRef.current
          if (!el) return
          const availableW = Math.max(1, (el.clientWidth || 1) - 36)
          const availableH = fit ? Math.max(1, (el.clientHeight || 1) - 36) : Infinity
          setScale(fit ? Math.max(0.1, Math.min(1, availableW / size.w, availableH / size.h)) : 1)
        }
        measure()
        window.addEventListener('resize', measure)
        let observer = null
        if (typeof ResizeObserver !== 'undefined') {
          observer = new ResizeObserver(measure)
          if (wrapRef.current) observer.observe(wrapRef.current)
        }
        return () => {
          window.removeEventListener('resize', measure)
          if (observer) observer.disconnect()
        }
      }, [viewport, fit])

      React.useEffect(() => {
        // Keep the left edge reachable when 1:1 is wider than the conversation
        // pane (for example with the DeepSeek sidebar open).
        if (wrapRef.current) wrapRef.current.scrollLeft = 0
      }, [slug, viewport, fit])

      const width = Math.round(size.w * scale)
      const height = Math.round(size.h * scale)

      return h(
        'div',
        { className: 'ds-preview-stage' + (fit ? ' is-fit' : ''), ref: wrapRef },
        h(
          'div',
          { className: 'ds-device-frame', style: { width: width + 'px', height: height + 'px' } },
          h('iframe', {
            className: 'ds-scaled-frame',
            key: slug + ':' + tick,
            ref: setFrameRef,
            src: href(slug, tick),
            title: slug + ' preview at ' + size.label,
            onLoad,
            style: {
              width: size.w + 'px',
              height: size.h + 'px',
              transform: 'scale(' + scale + ')',
              transformOrigin: 'top left',
            },
          }),
        ),
        h('span', { className: 'ds-scaled-badge' }, size.w + ' × ' + size.h + ' · ' + Math.round(scale * 100) + '%'),
      )
    }

    const PREVIEW_SIZES = SIZES

    // ---- assets-modal.js ----
    function assetUrl(slug, asset) {
      const rel = String(asset.path || '').split('/').map(encodeURIComponent).join('/')
      return '/design-studio/' + encodeURIComponent(slug) + '/' + rel + '?v=' + String(asset.hash || '').slice(0, 12)
    }

    function formatBytes(bytes) {
      if (typeof bytes !== 'number' || bytes < 0) return '—'
      if (bytes < 1024) return bytes + ' B'
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
      return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
    }

    function escapeAttr(value) {
      return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    }

    function htmlSnippet(asset) {
      const alt = escapeAttr(asset.alt || asset.name || '')
      const src = escapeAttr('../' + String(asset.path || ''))
      return '<img src="' + src + '" alt="' + alt + '" loading="lazy">'
    }

    function AssetsModal({ slug, frozen, onClose, embedded }) {
      const [assets, setAssets] = React.useState(null)
      const [err, setErr] = React.useState('')
      const [busy, setBusy] = React.useState('')
      const [copied, setCopied] = React.useState('')
      const [selected, setSelected] = React.useState(null)
      const [confirmPath, setConfirmPath] = React.useState('')
      const [drag, setDrag] = React.useState(false)
      const fileInput = React.useRef ? React.useRef(null) : null

      async function refresh() {
        const res = await call('studio.assets', { slug })
        if (res.ok) setAssets(res.data)
        else setErr(res.error || 'could not list assets')
      }

      React.useEffect(() => {
        refresh().catch((e) => setErr(String((e && e.message) || e)))
      }, [slug])

      React.useEffect(() => {
        function onKey(event) {
          if (event.key !== 'Escape') return
          if (selected) setSelected(null)
          else onClose()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [selected, onClose])

      async function copy(text, label) {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(label)
          window.setTimeout(() => setCopied(''), 1600)
        } catch (_) {
          setErr('clipboard unavailable — select and copy the path manually')
        }
      }

      async function uploadFiles(fileList) {
        if (frozen) {
          setErr('design frozen — thaw it before changing assets')
          return
        }
        const files = Array.prototype.slice.call(fileList || []).filter((file) => file && /^image\//.test(file.type || ''))
        if (!files.length) {
          setErr('Drop image files (PNG, JPEG, WebP, GIF or SVG).')
          return
        }
        setBusy('uploading…')
        setErr('')
        try {
          for (const file of files) {
            const dataUrl = await readAsDataUrl(file)
            const res = await call('studio.asset.upload', { slug, name: file.name, dataUrl })
            if (!res.ok) {
              setErr(res.error || ('could not upload ' + file.name))
              break
            }
          }
          await refresh()
        } catch (e) {
          setErr(String((e && e.message) || e))
        } finally {
          setBusy('')
          if (fileInput && fileInput.current) fileInput.current.value = ''
        }
      }

      async function removeAsset(asset) {
        if (frozen) {
          setErr('design frozen — thaw it before deleting assets')
          return
        }
        if (confirmPath !== asset.path) {
          setConfirmPath(asset.path)
          return
        }
        setConfirmPath('')
        setBusy('deleting…')
        setErr('')
        try {
          const res = await call('studio.asset.delete', { slug, path: asset.path })
          if (!res.ok) {
            setErr(res.error || 'delete failed')
            return
          }
          if (selected && selected.path === asset.path) setSelected(null)
          await refresh()
        } catch (e) {
          setErr(String((e && e.message) || e))
        } finally {
          setBusy('')
        }
      }

      const list = assets || []
      const images = list.filter((asset) => String(asset.mime || '').startsWith('image/'))
      const files = list.filter((asset) => !String(asset.mime || '').startsWith('image/'))

      function assetCard(asset) {
        const isImage = String(asset.mime || '').startsWith('image/')
        const dims = asset.width && asset.height ? asset.width + ' × ' + asset.height : '—'
        return h(
          'div',
          {
            key: asset.path,
            className: 'ds-asset-card',
            onClick: () => setSelected(asset),
            title: asset.path,
          },
          h(
            'div',
            { className: 'ds-asset-thumb' },
            isImage
              ? h('img', { src: assetUrl(slug, asset), alt: asset.alt || asset.name, loading: 'lazy' })
              : h('span', { className: 'ds-asset-glyph', 'aria-hidden': 'true' }, '▤'),
          ),
          h(
            'div',
            { className: 'ds-asset-meta' },
            h('b', null, asset.name),
            h('span', { className: 'ds-hint' }, dims + ' · ' + formatBytes(asset.bytes) + ' · ' + (asset.mime || 'file')),
            h('code', { className: 'ds-asset-path' }, asset.path),
          ),
          h(
            'div',
            { className: 'ds-asset-actions' },
            Btn({
              label: copied === 'path:' + asset.path ? 'Copied ✓' : 'Copy path',
              onClick: (event) => {
                if (event) event.stopPropagation()
                copy('../' + asset.path, 'path:' + asset.path)
              },
            }),
            h(
              'button',
              {
                type: 'button',
                className: 'ds-btn',
                onClick: (event) => {
                  if (event) event.stopPropagation()
                  copy(htmlSnippet(asset), 'html:' + asset.path)
                },
              },
              copied === 'html:' + asset.path ? 'Copied ✓' : 'Copy <img>',
            ),
            Btn({
              label: confirmPath === asset.path ? 'Confirm delete?' : 'Delete',
              onClick: (event) => {
                if (event) event.stopPropagation()
                removeAsset(asset)
              },
              disabled: frozen,
            }),
          ),
        )
      }

      return h(
        'div',
        {
          className: embedded ? 'ds-assets-embedded' : 'ds-overlay ds-assets-modal',
          role: embedded ? undefined : 'dialog',
          'aria-modal': embedded ? undefined : 'true',
          'aria-label': 'Design assets',
        },
        h(
          'div',
          { className: 'ds-overlay-head' },
          h(
            'div',
            { className: 'ds-overlay-title' },
            h('span', { className: 'ds-caps' }, 'Asset library'),
            h('b', null, slug),
            h('span', { className: 'ds-hint' }, list.length + ' asset' + (list.length === 1 ? '' : 's') + ' · sha256 manifest'),
          ),
          h(
            'div',
            { className: 'ds-overlay-actions' },
            h(
              'label',
              { className: 'ds-btn ds-btn-primary' },
              busy || 'Upload images',
              h('input', {
                ref: fileInput,
                type: 'file',
                accept: 'image/*',
                multiple: true,
                disabled: frozen,
                style: { display: 'none' },
                onChange: (event) => uploadFiles(event.target.files),
              }),
            ),
            Btn({ label: '↻ Refresh', onClick: refresh, disabled: busy !== '' }),
            Btn({ label: '✕ Close', onClick: onClose }),
          ),
        ),
        frozen ? h('div', { className: 'ds-vision-note' }, 'Design frozen — upload and delete are disabled until it is thawed. You can still copy paths and inspect assets.') : null,
        h(
          'div',
          { className: 'ds-overlay-body ds-assets-body' },
          Err({ text: err }),
          h(
            'div',
            {
              className: 'ds-drop' + (drag ? ' is-drag' : ''),
              onDragOver: (event) => {
                event.preventDefault()
                setDrag(true)
              },
              onDragLeave: () => setDrag(false),
              onDrop: (event) => {
                event.preventDefault()
                setDrag(false)
                uploadFiles(event.dataTransfer.files)
              },
              onClick: () => {
                if (frozen) {
                  setErr('design frozen — thaw it before uploading assets')
                  return
                }
                if (fileInput && fileInput.current) fileInput.current.click()
              },
            },
            h('b', null, drag ? 'Drop to upload' : 'Drop images here, or click to choose'),
            h('span', { className: 'ds-hint' }, 'PNG, JPEG, WebP, GIF or SVG · max 12MB · stored under assets/images/'),
          ),
          assets === null
            ? h('div', { className: 'ds-hint' }, 'loading assets…')
            : list.length === 0
              ? h('div', { className: 'ds-empty' }, 'No assets yet. Upload the first image — it will be deduplicated by sha256 and added to assets/assets.json.')
              : h(
                  'div',
                  { className: 'ds-asset-grid' },
                  images.map(assetCard),
                  files.map(assetCard),
                ),
          selected
            ? h(
                'div',
                { className: 'ds-asset-light', onClick: () => setSelected(null) },
                h(
                  'div',
                  { className: 'ds-asset-light-inner', onClick: (event) => event.stopPropagation() },
                  h('img', { src: assetUrl(slug, selected), alt: selected.alt || selected.name }),
                  h(
                    'div',
                    { className: 'ds-asset-light-meta' },
                    h('b', null, selected.name),
                    h('code', null, selected.path),
                    h('span', { className: 'ds-hint' }, (selected.width && selected.height ? selected.width + ' × ' + selected.height + ' · ' : '') + formatBytes(selected.bytes)),
                    h(
                      'div',
                      { className: 'ds-row' },
                      Btn({ label: 'Copy path', onClick: () => copy('../' + selected.path, 'path:' + selected.path) }),
                      Btn({ label: 'Copy <img>', onClick: () => copy(htmlSnippet(selected), 'html:' + selected.path) }),
                      Btn({ label: 'Close', onClick: () => setSelected(null) }),
                    ),
                  ),
                ),
              )
            : null,
        ),
      )
    }

    // ---- history.js ----
    function fmtTime(at) {
      const d = new Date(at)
      return isNaN(d.getTime()) ? String(at || '') : d.toLocaleString()
    }

    function HistoryPanel({ slug, frozen, onChanged }) {
      const [data, setData] = React.useState(null)
      const [err, setErr] = React.useState('')
      const [busy, setBusy] = React.useState('')
      const [log, setLog] = React.useState('')
      const [confirmId, setConfirmId] = React.useState('')

      async function refresh() {
        const res = await call('studio.history.list', { slug })
        if (res.ok) setData(res.data)
        else setErr(res.error || 'could not load history')
      }

      React.useEffect(() => {
        refresh().catch((e) => setErr(String((e && e.message) || e)))
      }, [slug])

      async function saveSnapshot() {
        setBusy('saving snapshot…')
        setErr('')
        try {
          const res = await call('studio.history.save', { slug, reason: 'manual' })
          if (!res.ok) {
            setErr(res.error || 'snapshot failed')
            return
          }
          setLog(res.data && res.data.duplicate ? 'no changes to snapshot' : 'snapshot saved')
          await refresh()
        } catch (e) {
          setErr(String((e && e.message) || e))
        } finally {
          setBusy('')
        }
      }

      async function restore(snapshot) {
        if (confirmId !== snapshot.id) {
          setConfirmId(snapshot.id)
          setLog('')
          return
        }
        setConfirmId('')
        setBusy('restoring #' + snapshot.seq + '…')
        setErr('')
        try {
          const res = await call('studio.history.restore', { slug, snapshotId: snapshot.id })
          if (!res.ok) {
            setErr(res.error || 'restore failed')
            return
          }
          setLog('restored #' + snapshot.seq + ' (' + res.data.files + ' files)')
          await refresh()
          if (typeof onChanged === 'function') await onChanged()
        } catch (e) {
          setErr(String((e && e.message) || e))
        } finally {
          setBusy('')
        }
      }

      async function undo() {
        setBusy('undoing…')
        setErr('')
        try {
          const res = await call('studio.history.undo', { slug })
          if (!res.ok) {
            setErr(res.error || 'undo failed')
            return
          }
          setLog('undid to #' + res.data.seq + ' (' + res.data.files + ' files)')
          setConfirmId('')
          await refresh()
          if (typeof onChanged === 'function') await onChanged()
        } catch (e) {
          setErr(String((e && e.message) || e))
        } finally {
          setBusy('')
        }
      }

      const snapshots = data && Array.isArray(data.snapshots) ? data.snapshots.slice().reverse() : []
      const current = data && data.head ? data.head : null

      return h(
        'div',
        { className: 'ds-panel ds-history' },
        h(
          'div',
          { className: 'ds-panel-head' },
          h('span', { className: 'ds-caps' }, 'Edit history'),
          h('span', { className: 'ds-hint' }, data ? data.count + ' snapshots' : '—'),
          h('span', { className: 'ds-toolbar-gap' }),
          Btn({ label: '⏺ Snapshot now', onClick: saveSnapshot, disabled: busy !== '' }),
          Btn({ label: '↶ Undo last edit', onClick: undo, disabled: busy !== '' || !data || !current || frozen }),
          Btn({ label: '↻ Refresh', onClick: refresh, disabled: busy !== '' }),
        ),
        Err({ text: err }),
        Log({ text: busy || log }),
        frozen ? h('div', { className: 'ds-vision-note' }, 'Design frozen — restore and undo are disabled until it is thawed. Snapshots can still be inspected.') : null,
        data === null
          ? h('div', { className: 'ds-hint' }, 'loading snapshots…')
          : snapshots.length === 0
            ? h('div', { className: 'ds-empty' }, 'No snapshots yet. One is created on the next edit, or save the current state now.')
            : h(
                'div',
                { className: 'ds-history-list' },
                snapshots.map((snap) =>
                  h(
                    'div',
                    { key: snap.id, className: 'ds-history-item' + (snap.id === current ? ' on' : '') },
                    h(
                      'div',
                      { className: 'ds-history-main' },
                      h(
                        'div',
                        { className: 'ds-history-title' },
                        h('span', { className: 'ds-badge ' + (snap.id === current ? 'green' : 'blue') }, '#' + snap.seq),
                        h('b', null, snap.reason || 'snapshot'),
                        snap.id === current ? h('span', { className: 'ds-caps good' }, 'current') : null,
                      ),
                      h(
                        'span',
                        { className: 'ds-hint' },
                        fmtTime(snap.at) + ' · ' + (snap.files || 0) + ' files · tree ' + String(snap.tree || '').slice(0, 12),
                      ),
                    ),
                    h(
                      'div',
                      { className: 'ds-history-actions' },
                      snap.id === current
                        ? null
                        : Btn({
                            label: confirmId === snap.id ? 'Confirm restore?' : 'Restore',
                            onClick: () => restore(snap),
                            disabled: busy !== '' || frozen,
                          }),
                    ),
                  ),
                ),
              ),
        h(
          'p',
          { className: 'ds-hint ds-history-note' },
          'Content-addressed trees: unchanged files share one blob, and every snapshot keeps a parent link. Restoring moves the head cursor; later snapshots are not deleted, so you can restore them again.',
        ),
      )
    }

    // ---- style-atlas.js ----
    const FONT_MODES = [
      ['auto', 'Auto'],
      ['serif', 'Serif'],
      ['sans', 'Sans'],
      ['mono', 'Mono'],
    ]

    function swatch(style, key) {
      const vars = style.vars || {}
      return vars[key] || vars['--panel'] || '#888888'
    }

    function StyleAtlas({ slug, frozen, sessionId, onPreview, onTour, onChanged, onCreated }) {
      const [data, setData] = React.useState(null)
      const [query, setQuery] = React.useState('')
      const [category, setCategory] = React.useState('all')
      const [status, setStatus] = React.useState('active')
      const [fontMode, setFontMode] = React.useState('auto')
      const [busy, setBusy] = React.useState('')
      const [err, setErr] = React.useState('')
      const [log, setLog] = React.useState('')
      const [confirmId, setConfirmId] = React.useState('')
      const [confirmDelete, setConfirmDelete] = React.useState('')
      const [saveName, setSaveName] = React.useState('')
      const [saveDesc, setSaveDesc] = React.useState('')
      const [lastApply, setLastApply] = React.useState(null)

      async function refresh(mode) {
        const res = await call('studio.styles.list', { fontMode: mode || fontMode })
        if (res.ok) setData(res.data)
        else setErr(res.error || 'could not load the style atlas')
      }

      React.useEffect(() => {
        refresh().catch((e) => setErr(String((e && e.message) || e)))
      }, [slug])

      function changeFontMode(mode) {
        setFontMode(mode)
        refresh(mode).catch(function () {})
      }

      async function applyStyle(style) {
        if (confirmId !== style.id) {
          setConfirmId(style.id)
          setLog('')
          return
        }
        setConfirmId('')
        setBusy('applying ' + style.name + '…')
        setErr('')
        try {
          const res = await call('studio.styles.apply', { slug, styleId: style.id, fontMode })
          if (!res.ok) {
            setErr(res.error || 'apply failed')
            return
          }
          setLog('applied ' + style.name + ' — token.css updated')
          if (res.data && res.data.beforeSnapshot) {
            setLastApply({ name: style.name, snapshotId: res.data.beforeSnapshot })
          }
          if (typeof onChanged === 'function') await onChanged()
        } catch (e) {
          setErr(String((e && e.message) || e))
        } finally {
          setBusy('')
        }
      }

      async function undoApply() {
        if (!lastApply || !lastApply.snapshotId) return
        setBusy('undoing style apply…')
        setErr('')
        try {
          const res = await call('studio.history.restore', { slug, snapshotId: lastApply.snapshotId })
          if (!res.ok) {
            setErr(res.error || 'undo failed')
            return
          }
          setLog('reverted style ' + lastApply.name)
          setLastApply(null)
          if (typeof onChanged === 'function') await onChanged()
        } catch (e) {
          setErr(String((e && e.message) || e))
        } finally {
          setBusy('')
        }
      }

      async function createStyle(style) {
        setBusy('creating from ' + style.name + '…')
        setErr('')
        try {
          const res = await call('studio.styles.create', { styleId: style.id, fontMode, sessionId })
          if (!res.ok) {
            setErr(res.error || 'create failed')
            return
          }
          setLog('created ' + res.data.slug + ' from ' + style.name)
          if (typeof onCreated === 'function') await onCreated(res.data.slug)
        } catch (e) {
          setErr(String((e && e.message) || e))
        } finally {
          setBusy('')
        }
      }

      async function saveCurrent() {
        const name = saveName.trim()
        if (!name) {
          setErr('give the style a name first')
          return
        }
        setBusy('saving current style…')
        setErr('')
        try {
          const res = await call('studio.styles.save', { slug, name, description: saveDesc })
          if (!res.ok) {
            setErr(res.error || 'save failed')
            return
          }
          setLog('saved custom style ' + res.data.style.id)
          setSaveName('')
          setSaveDesc('')
          await refresh()
        } catch (e) {
          setErr(String((e && e.message) || e))
        } finally {
          setBusy('')
        }
      }

      async function deleteCustom(style) {
        if (confirmDelete !== style.id) {
          setConfirmDelete(style.id)
          return
        }
        setConfirmDelete('')
        setBusy('deleting ' + style.name + '…')
        setErr('')
        try {
          const res = await call('studio.styles.delete', { styleId: style.id })
          if (!res.ok) {
            setErr(res.error || 'delete failed')
            return
          }
          setLog('deleted custom style ' + style.id)
          await refresh()
        } catch (e) {
          setErr(String((e && e.message) || e))
        } finally {
          setBusy('')
        }
      }

      function randomStyle() {
        const list = (data && data.styles ? data.styles : []).filter((s) => !s.status || s.status !== 'deprecated')
        if (!list.length) return
        const pick = list[Math.floor(Math.random() * list.length)]
        if (typeof onPreview === 'function') onPreview(Object.assign({}, pick, { fontMode }), list)
      }

      const styles = data && Array.isArray(data.styles) ? data.styles : []
      const categories = ['all'].concat(Array.from(new Set(styles.map((s) => s.category).filter(Boolean))))
      const q = query.trim().toLowerCase()
      const filtered = styles.filter((s) => {
        if (category !== 'all' && s.category !== category) return false
        if (status !== 'all' && (s.status || 'active') !== status) return false
        if (!q) return true
        return [s.id, s.name, s.zh, s.tag, s.category, s.description].join(' ').toLowerCase().includes(q)
      })

      function renderStyleCard(style, featured) {
        return h(
          'div',
          { key: style.id, className: 'ds-style-card' + (featured ? ' featured' : '') },
          h(
            'div',
            { className: 'ds-style-swatches' },
            h('i', { style: { background: swatch(style, '--bg') } }),
            h('i', { style: { background: swatch(style, '--panel-2') } }),
            h('i', { style: { background: swatch(style, '--gold') } }),
            h('i', { style: { background: swatch(style, '--gold-soft') } }),
          ),
          h(
            'div',
            {
              className: 'ds-style-sample',
              style: {
                background: swatch(style, '--bg'),
                color: swatch(style, '--text'),
                borderColor: swatch(style, '--border'),
                fontFamily: swatch(style, '--font-body'),
                borderRadius: swatch(style, '--radius'),
              },
            },
            h('span', { className: 'ds-style-sample-title' }, 'Aa'),
            h('span', { className: 'ds-style-sample-chip', style: { background: swatch(style, '--gold'), color: swatch(style, '--bg') } }, 'Action'),
            h('span', { className: 'ds-style-sample-chip ghost', style: { borderColor: swatch(style, '--border') } }, 'Chip'),
          ),
          h(
            'div',
            { className: 'ds-style-head' },
            h('b', null, style.name),
            style.zh ? h('span', { className: 'ds-hint' }, style.zh) : null,
            h('span', { className: 'ds-badge ' + (style.status === 'deprecated' ? 'amber' : style.source === 'custom' ? 'blue' : 'green') }, style.source === 'custom' ? 'custom' : style.status || 'active'),
          ),
          h('p', { className: 'ds-style-tag' }, style.tag || style.description || ''),
          h(
            'div',
            { className: 'ds-style-meta' },
            h('span', { className: 'ds-mono' }, 'radius ' + ((style.theme && style.theme.radius) || '—') + 'px'),
            h('span', { className: 'ds-mono' }, (style.theme && style.theme.font) || 'font'),
            style.complexity ? h('span', { className: 'ds-hint' }, style.complexity) : null,
          ),
          h(
            'div',
            { className: 'ds-style-actions' },
            Btn({
              label: '👁 Try',
              onClick: () => {
                if (typeof onPreview === 'function') onPreview(Object.assign({}, style, { fontMode }), filtered)
              },
              disabled: busy !== '',
            }),
            Btn({
              label: confirmId === style.id ? 'Confirm apply?' : 'Apply',
              onClick: () => applyStyle(style),
              disabled: busy !== '' || frozen,
            }),
            Btn({ label: '＋ New', onClick: () => createStyle(style), disabled: busy !== '' || frozen }),
            style.source === 'custom'
              ? Btn({ label: confirmDelete === style.id ? 'Confirm delete?' : 'Delete', onClick: () => deleteCustom(style), disabled: busy !== '' || frozen })
              : null,
          ),
        )
      }

      return h(
        'div',
        { className: 'ds-panel ds-styles' },
        h(
          'div',
          { className: 'ds-panel-head' },
          h('span', { className: 'ds-caps' }, 'Style atlas'),
          h('span', { className: 'ds-hint' }, data ? data.count + ' looks · ' + (data.attribution ? data.attribution.license : 'MIT') : '—'),
          h('span', { className: 'ds-toolbar-gap' }),
          Btn({ label: '🎲 Random style', onClick: randomStyle, disabled: busy !== '' || !styles.length }),
          Btn({ label: '↻ Refresh', onClick: () => refresh(), disabled: busy !== '' }),
        ),
        Err({ text: err }),
        Log({ text: busy || log }),
        frozen ? h('div', { className: 'ds-vision-note' }, 'Design frozen — style Apply/New/Save/Delete and the style tour are disabled until it is thawed.') : null,
        lastApply && lastApply.snapshotId
          ? h(
              'div',
              { className: 'ds-style-apply-notice' },
              h('span', null, 'Applied ' + lastApply.name + ' — snapshot saved.'),
              h('span', { className: 'ds-toolbar-gap' }),
              Btn({ label: '↶ Undo apply', onClick: undoApply, disabled: busy !== '' }),
            )
          : null,
        h(
          'div',
          { className: 'ds-style-tools' },
          h('input', {
            className: 'ds-input',
            placeholder: 'Search styles, colors, products…',
            value: query,
            onChange: (e) => setQuery(e.target.value),
          }),
          h(
            'select',
            { className: 'ds-select', value: category, onChange: (e) => setCategory(e.target.value) },
            categories.map((c) => h('option', { key: c, value: c }, c === 'all' ? 'All categories' : c)),
          ),
          h(
            'select',
            { className: 'ds-select', value: status, onChange: (e) => setStatus(e.target.value) },
            h('option', { value: 'active' }, 'Recommended'),
            h('option', { value: 'supplemental' }, 'Supplementary'),
            h('option', { value: 'deprecated' }, 'Deprecated'),
            h('option', { value: 'all' }, 'All statuses'),
          ),
          h(
            'div',
            { className: 'ds-segmented', role: 'group', 'aria-label': 'Font mood' },
            FONT_MODES.map(([key, label]) =>
              h(
                'button',
                {
                  key,
                  type: 'button',
                  className: 'ds-seg' + (fontMode === key ? ' on' : ''),
                  'aria-pressed': fontMode === key ? 'true' : 'false',
                  onClick: () => changeFontMode(key),
                },
                label,
              ),
            ),
          ),
        ),
        h(
          'div',
          { className: 'ds-style-save' },
          h('input', { className: 'ds-input', placeholder: 'Save current token.css as…', value: saveName, onChange: (e) => setSaveName(e.target.value) }),
          h('input', { className: 'ds-input', placeholder: 'Description (optional)', value: saveDesc, onChange: (e) => setSaveDesc(e.target.value) }),
          Btn({ label: '💾 Save current', onClick: saveCurrent, disabled: busy !== '' || !saveName.trim() || frozen }),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'ds-try-tour',
            disabled: busy !== '' || !filtered.length || typeof onTour !== 'function' || frozen,
            onClick: () => {
              if (typeof onTour === 'function') onTour(filtered)
            },
          },
          h('span', { className: 'ds-try-tour-icon', 'aria-hidden': 'true' }, '✨'),
          h('span', null, 'Try them now'),
          h('span', { className: 'ds-try-tour-hint' }, 'arrow through styles on your current design'),
        ),
        data === null
          ? h('div', { className: 'ds-hint' }, 'loading style atlas…')
          : filtered.length === 0
            ? h('div', { className: 'ds-empty' }, 'No styles match those filters.')
            : h(
                'div',
                { className: 'ds-style-grid' },
                filtered.map((style) => renderStyleCard(style, false)),
              ),
        data && data.attribution
          ? h(
              'p',
              { className: 'ds-hint ds-style-attribution' },
              'Style data adapted with attribution from ',
              h('a', { href: data.attribution.repository, target: '_blank', rel: 'noopener noreferrer' }, data.attribution.project),
              ' (MIT), originally from ',
              h('a', { href: data.attribution.upstream, target: '_blank', rel: 'noopener noreferrer' }, 'ui-ux-pro-max-skill'),
              '. Design Studio is independent and does not require that project.',
            )
          : null,
      )
    }

    // ---- studio-view.js ----
    function relHref(slug, rel) {
      const parts = String(rel || '').split('/').map(encodeURIComponent).join('/')
      return '/design-studio/' + encodeURIComponent(slug) + '/' + parts
    }

    function assetHref(slug, asset) {
      const rel = String(asset.path || '').split('/').map(encodeURIComponent).join('/')
      return '/design-studio/' + encodeURIComponent(slug) + '/' + rel + '?v=' + String(asset.hash || '').slice(0, 12)
    }

    function styleColor(style, key) {
      const vars = (style && style.vars) || {}
      return vars[key] || vars['--accent'] || '#c9a227'
    }

    // ================= workspace view (conversation.view tab) =================
    function StudioView(props) {
      // `sessionId` is a standard prop of conversation.view in the current
      // slot contract. The old conditional `useSession()` fallback violated
      // React's hook order and is gone.
      const sessionId = props && props.sessionId ? String(props.sessionId) : ''
      const [systems, setSystems] = React.useState(null)
      const [selected, setSelected] = React.useState('')
      const [newSlug, setNewSlug] = React.useState('')
      const [zipPath, setZipPath] = React.useState('')
      const [tick, setTick] = React.useState(0)
      const [busy, setBusy] = React.useState('')
      const [log, setLog] = React.useState('')
      const [err, setErr] = React.useState('')
      const [review, setReview] = React.useState(null)
      const [keyState, setKeyState] = React.useState(null)
      const [harnessState, setHarnessState] = React.useState(null)
      const [agentMsg, setAgentMsg] = React.useState('')
      const [agentHistory, setAgentHistory] = React.useState([])
      const [agentBusy, setAgentBusy] = React.useState(false)
      const [agentImage, setAgentImage] = React.useState('')
      const [selectMode, setSelectMode] = React.useState(false)
      const [selection, setSelection] = React.useState(null)
      const [workspaceTab, setWorkspaceTab] = React.useState('preview')
      const [previewViewport, setPreviewViewport] = React.useState('desktop')
      const [previewFit, setPreviewFit] = React.useState(true)
      const [stylePreview, setStylePreview] = React.useState(null)
      const [styleApplied, setStyleApplied] = React.useState(null)
      const [styleTour, setStyleTour] = React.useState(null)
      const [freezeOpen, setFreezeOpen] = React.useState(false)
      const [thawOpen, setThawOpen] = React.useState(false)
      const [freezeTarget, setFreezeTarget] = React.useState('')
      const [freezeNote, setFreezeNote] = React.useState('')
      const [freezeCustom, setFreezeCustom] = React.useState(false)
      const [projectOptions, setProjectOptions] = React.useState([])
      const [projectLoading, setProjectLoading] = React.useState(false)
      const stylePreviewRef = React.useRef ? React.useRef(null) : { current: null }
      const stylePoolRef = React.useRef ? React.useRef([]) : { current: [] }
      const styleTourTrackRef = React.useRef ? React.useRef(null) : { current: null }
      const [assets, setAssets] = React.useState([])
      const [assetsOpen, setAssetsOpen] = React.useState(false)
      const stampRef = React.useRef ? React.useRef('') : { current: '' }
      const [editMsg, setEditMsg] = React.useState('')
      const [dsReply, setDsReply] = React.useState('')
      const [outline, setOutline] = React.useState(null)
      let editInputEl = null
      const setEditInputRef = (el) => {
        editInputEl = el
      }
      let frameEl = null
      const setFrameRef = (el) => {
        frameEl = el
      }
      let imgInputEl = null
      let docInputEl = null
      const setImgInputRef = (el) => {
        imgInputEl = el
      }
      const setDocInputRef = (el) => {
        docInputEl = el
      }
      let agentBodyEl = null
      const setAgentBodyRef = (el) => {
        agentBodyEl = el
      }
      const [confirmDelete, setConfirmDelete] = React.useState(false)
      // Ask-DeepSeek run tracking: a live banner in this tab while DeepSeek
      // works (queued -> running -> finished), then auto-verify detection.
      const [dsRun, setDsRun] = React.useState(null)
      const [runTick, setRunTick] = React.useState(0)
      const selectedRef = React.useRef ? React.useRef(selected) : { current: selected }

      // Keep the agent chat pinned to the newest entry while it works.
      React.useEffect(() => {
        if (agentBodyEl) agentBodyEl.scrollTop = agentBodyEl.scrollHeight
      }, [agentHistory, agentBusy, err])

      // Switching the selected design system always re-arms the delete confirm.
      React.useEffect(() => {
        setConfirmDelete(false)
      }, [selected])

      // ---- Ask-DeepSeek live banner: track the main conversation's turn state ----
      React.useEffect(() => {
        if (!dsRun || dsRun.phase === 'finished' || dsRun.phase === 'untracked') return
        let binding = null
        try {
          const sessionsSvc = runtime.ctx.get('sessions')
          binding = sessionsSvc && typeof sessionsSvc.binding === 'function' && sessionId ? sessionsSvc.binding(sessionId) : undefined
        } catch (_) {}
        const face = binding && binding.session
        if (!face || typeof face.subscribe !== 'function') {
          setDsRun((prev) => (prev && prev.phase === 'queued' ? { ...prev, phase: 'untracked' } : prev))
          return
        }
        let lastRunning = false
        try {
          lastRunning = Boolean(face.getSnapshot().running)
        } catch (_) {}
        const unsub = face.subscribe(() => {
          let running = false
          try {
            running = Boolean(face.getSnapshot().running)
          } catch (_) {
            return
          }
          if (running && !lastRunning) {
            setDsRun((prev) => (prev && (prev.phase === 'queued' || prev.phase === 'untracked') ? { ...prev, phase: 'running' } : prev))
          } else if (!running && lastRunning) {
            setDsRun((prev) => (prev && prev.phase === 'running' ? { ...prev, phase: 'finished', finishedAt: Date.now() } : prev))
          }
          lastRunning = running
        })
        return unsub
      }, [dsRun ? dsRun.phase : null, sessionId])

      // While queued/running, tick the elapsed clock once per second.
      React.useEffect(() => {
        if (!dsRun || dsRun.phase === 'finished' || dsRun.phase === 'untracked') return
        const timer = setInterval(() => setRunTick((n) => n + 1), 1000)
        return () => clearInterval(timer)
      }, [dsRun ? dsRun.phase : null])

      // Subscription events are not guaranteed when the panel mounts after the
      // main turn already started (or when a turn ends without a final event).
      // Poll the binding so queued/running cannot stick forever, and give up on
      // an unobserved pickup after a short grace period.
      React.useEffect(() => {
        if (!dsRun || dsRun.phase === 'finished' || dsRun.phase === 'untracked') return
        const poll = () => {
          let binding = null
          try {
            const sessionsSvc = runtime.ctx.get('sessions')
            binding = sessionsSvc && typeof sessionsSvc.binding === 'function' && sessionId ? sessionsSvc.binding(sessionId) : undefined
          } catch (_) {}
          const face = binding && binding.session
          if (!face || typeof face.getSnapshot !== 'function') return
          let running = false
          try {
            running = Boolean(face.getSnapshot().running)
          } catch (_) {
            return
          }
          if (running) {
            setDsRun((prev) => (prev && (prev.phase === 'queued' || prev.phase === 'untracked') ? { ...prev, phase: 'running' } : prev))
            return
          }
          setDsRun((prev) => {
            if (!prev) return prev
            if (prev.phase === 'running') return { ...prev, phase: 'finished', finishedAt: Date.now() }
            if (prev.phase === 'queued' && Date.now() - (prev.startedAt || 0) > 8000) return { ...prev, phase: 'untracked' }
            return prev
          })
        }
        const timer = setInterval(poll, 1000)
        return () => clearInterval(timer)
      }, [dsRun ? dsRun.phase : null, sessionId])

      // A finished/untracked run is information, not a permanent badge. Clear it
      // automatically; the × button is still available for immediate dismissal.
      React.useEffect(() => {
        if (!dsRun || (dsRun.phase !== 'finished' && dsRun.phase !== 'untracked')) return
        const timer = setTimeout(() => setDsRun(null), 8000)
        return () => clearTimeout(timer)
      }, [dsRun ? dsRun.phase : null])

      // After DeepSeek finishes, watch the design-agent history for the
      // AUTO-VERIFY reply so the banner can say the result was verified.
      React.useEffect(() => {
        if (!dsRun || dsRun.phase !== 'finished' || dsRun.verified) return
        let stopped = false
        const finishedAt = dsRun.finishedAt || Date.now()
        const deadline = Date.now() + 120000
        const timer = setInterval(() => {
          if (stopped) return
          if (Date.now() > deadline) {
            clearInterval(timer)
            return
          }
          call('studio.agent.history', { slug: selected })
            .then((r) => {
              if (stopped || !r.ok || !Array.isArray(r.data)) return
              const hasVerifyReply = r.data.some((e) => e && e.role === 'design-agent' && typeof e.at === 'string' && new Date(e.at).getTime() >= finishedAt - 3000)
              if (hasVerifyReply) {
                clearInterval(timer)
                setDsRun((prev) => (prev && prev.phase === 'finished' ? { ...prev, verified: true } : prev))
              }
            })
            .catch(() => {})
        }, 2000)
        return () => {
          stopped = true
          clearInterval(timer)
        }
      }, [dsRun ? dsRun.phase : null, dsRun ? dsRun.verified : false, selected])

      async function deleteSelected() {
        if (!selected) return
        if (!confirmDelete) {
          setConfirmDelete(true)
          return
        }
        setConfirmDelete(false)
        setBusy('deleting…')
        setErr('')
        try {
          const res = await call('studio.delete', { slug: selected })
          if (!res.ok) {
            setErr(res.error || 'delete failed')
            return
          }
          setLog('deleted ' + selected + ' (folder, zip, reviews, agent history)')
          setSelected('')
          await refresh()
        } catch (e) {
          setErr(String((e && e.message) || e))
        } finally {
          setBusy('')
        }
      }

      function openFreeze() {
        setFreezeTarget('')
        setFreezeNote('')
        setFreezeCustom(false)
        setProjectOptions([])
        setFreezeOpen(true)
        setProjectLoading(true)
        call('studio.project', { sessionId })
          .then((res) => {
            if (!res.ok || !res.data) {
              setFreezeCustom(true)
              return
            }
            const options = Array.isArray(res.data.options) ? res.data.options : []
            setProjectOptions(options)
            setFreezeTarget(res.data.defaultPath || (options[0] && options[0].path) || '')
          })
          .catch(() => setFreezeCustom(true))
          .finally(() => setProjectLoading(false))
      }

      async function freezeDesign() {
        if (!selected) return
        setBusy('freezing design…')
        setErr('')
        try {
          const res = await call('studio.freeze', {
            slug: selected,
            implementation: freezeTarget.trim(),
            note: freezeNote.trim(),
            sessionId,
          })
          if (!res.ok) {
            setErr(res.error || 'freeze failed')
            return
          }
          setFreezeOpen(false)
          setStylePreview(null)
          stylePreviewRef.current = null
          setLog('design frozen — ' + selected + ' is read-only; implementation target: ' + ((res.data && res.data.implementation) || freezeTarget.trim() || 'not recorded'))
          await refresh()
          setTick((t) => t + 1)
        } catch (e) {
          setErr(String((e && e.message) || e))
        } finally {
          setBusy('')
        }
      }

      async function thawDesign() {
        if (!selected) return
        setBusy('thawing design…')
        setErr('')
        try {
          const res = await call('studio.unfreeze', { slug: selected, confirm: true })
          if (!res.ok) {
            setErr(res.error || 'thaw failed')
            return
          }
          setThawOpen(false)
          setLog('design thawed — ' + selected + ' is editable again')
          await refresh()
          setTick((t) => t + 1)
        } catch (e) {
          setErr(String((e && e.message) || e))
        } finally {
          setBusy('')
        }
      }

      async function refresh() {
        const listArgs = {}
        if (sessionId) listArgs.sessionId = sessionId
        const sys = await call('studio.list', listArgs)
        const cfg = await call('studio.config')
        if (sys.ok) {
          setSystems(sys.data)
          setSelected((prev) => (prev && sys.data.some((s) => s.slug === prev) ? prev : sys.data.length ? sys.data[0].slug : ''))
        } else {
          setErr(sys.error || 'list failed')
        }
        if (cfg.ok && cfg.data) {
          if (cfg.data.key) setKeyState(cfg.data.key)
          setHarnessState(cfg.data.harness || null)
        }
      }

      React.useEffect(() => {
        refresh().catch((e) => setErr(String((e && e.message) || e)))
      }, [])

      async function loadAssets() {
        if (!selected) {
          setAssets([])
          return
        }
        const slug = selected
        const res = await call('studio.assets', { slug })
        if (selectedRef.current !== slug) return
        if (res.ok) setAssets(res.data)
        else setErr(res.error || 'could not load assets')
      }

      React.useEffect(() => {
        loadAssets().catch(function () {})
      }, [selected, tick])

      // Keep the latest known stamp for the selected design. The poll below only
      // reloads when this actually changes, so it never fights local interactions.
      React.useEffect(() => {
        const current = (systems || []).find((s) => s.slug === selected)
        if (current && current.stamp && current.stamp.hash) stampRef.current = current.stamp.hash
      }, [systems, selected])

      // Live refresh: the host has no file watcher for arbitrary edits, so a light
      // stamp poll keeps the open Preview tab in sync when files change elsewhere.
      React.useEffect(() => {
        if (!selected) return undefined
        let cancelled = false
        let inFlight = false
        async function poll() {
          if (cancelled || inFlight) return
          inFlight = true
          try {
            const args = {}
            if (sessionId) args.sessionId = sessionId
            const res = await call('studio.list', args)
            if (cancelled || !res.ok || !Array.isArray(res.data)) return
            const next = res.data.find((s) => s.slug === selected)
            if (!next) {
              setSystems(res.data)
              setSelected('')
              return
            }
            setSystems(res.data)
            if (!next.stamp || !next.stamp.hash) return
            if (stampRef.current && next.stamp.hash !== stampRef.current) {
              stampRef.current = next.stamp.hash
              setTick((t) => t + 1)
            } else {
              stampRef.current = next.stamp.hash
            }
          } catch (_) {
            // A transient API failure must not spam the console or stop the poll.
          } finally {
            inFlight = false
          }
        }
        const timer = setInterval(poll, 1500)
        return () => {
          cancelled = true
          clearInterval(timer)
        }
      }, [selected, sessionId])

      React.useEffect(() => {
        if (workspaceTab !== 'preview' && selectMode) setSelectMode(false)
      }, [workspaceTab])

      React.useEffect(() => {
        if (!selectMode) {
          if (frameEl && frameEl.contentDocument && frameEl.contentDocument.__dsSelCleanup) frameEl.contentDocument.__dsSelCleanup()
          return
        }
        // ONE click = one selection: capture the element, exit select mode,
        // and open the change popup (autofocus handled by the selection effect).
        injectSelector(frameEl, (sel) => {
          setSelection(sel)
          setSelectMode(false)
          setDsReply('')
        }, () => setSelectMode(false))
      }, [selectMode, selected, tick])

      // When the change popup opens, put the cursor straight into the input.
      React.useEffect(() => {
        if (selection && editInputEl) editInputEl.focus()
      }, [selection])

      async function saveSelection() {
        if (!selected || !selection) return
        setBusy('saving request…')
        setErr('')
        try {
          const req = editMsg.trim() || '(no request text — the operator will explain the desired change in chat)'
          const res = await call('studio.selection.save', { slug: selected, selection: selection, request: req })
          if (!res.ok) {
            setErr(res.error || 'save failed')
            return
          }
          setLog('edit request saved → ' + res.data.path + ' — not sent; press Ask DeepSeek when ready')
          setSelection(null)
          setEditMsg('')
          setDsReply('')
        } catch (e) {
          setErr(String((e && e.message) || e))
        } finally {
          setBusy('')
        }
      }

      async function clearSelectionRequest() {
        if (!selected) return
        setBusy('clearing…')
        setErr('')
        try {
          const res = await call('studio.selection.clear', { slug: selected })
          if (!res.ok) {
            setErr(res.error || 'clear failed')
            return
          }
          setSelection(null)
          setEditMsg('')
          setLog('edit request cleared for ' + selected)
        } catch (e) {
          setErr(String((e && e.message) || e))
        } finally {
          setBusy('')
        }
      }

      function quickRequest(text) {
        setEditMsg(text)
      }

      // DeepSeek flow: the MAIN conversation agent is the primary editor.
      // Save the element reference (EDIT_REQUEST.md), then hand the request to
      // the main chat through the retained Session binding. DeepSeek applies
      // the change itself and invokes the design agent on its own when it
      // needs a visual read (design_studio action agent reports back).
      async function askDeepSeek() {
        if (!selected || !selection) return
        const ask = editMsg.trim()
        if (!ask) return
        setBusy('saving request…')
        setErr('')
        try {
          const saveRes = await call('studio.selection.save', { slug: selected, selection: selection, request: ask, verifyAfter: true, sessionId })
          if (!saveRes.ok) {
            setErr(saveRes.error || 'save failed')
            return
          }
          setBusy('sending to DeepSeek…')
          const promptText =
            'Design Studio: in the "' + selected + '" mockup I selected element "' + (selection.cssPath || selection.tag) + '"' +
            (selection.classPath ? ' (classes: ' + selection.classPath + ')' : '') +
            ' and asked: ' + ask + '. ' +
            'The full element reference is saved at ' + ((sel && sel.root) ? sel.root : 'the design root') + '/' + selected + '/EDIT_REQUEST.md — read it and apply the change to the mockup files yourself with your file tools (you are the primary editor, not the design agent). ' +
            'When you need a visual read you cannot make yourself, invoke the design agent (design_studio action agent, slug "' + selected + '") with a precise question — it will inspect the files and report back to you, then you finish the edit. ' +
            'Reply with a short summary of what you changed.'
          // Current public send path: the retained Session binding's
          // `prompt(content, mode)`. The old scoped `conversation.send` no
          // longer exists in the current client composition.
          let binding = null
          let reachNote = ''
          try {
            const sessionsSvc = runtime.ctx.get('sessions')
            if (!sessionsSvc || typeof sessionsSvc.binding !== 'function') {
              reachNote = 'sessions service unavailable'
            } else {
              binding = sessionId ? sessionsSvc.binding(sessionId) : undefined
              if (!binding) reachNote = 'no retained binding for this conversation'
            }
          } catch (e) {
            reachNote = String((e && e.message) || e)
          }
          if (!binding || !binding.session || typeof binding.session.prompt !== 'function') {
            setErr('main chat not reachable' + (reachNote ? ' (' + reachNote + ')' : '') + ' — use "Save only" and ask DeepSeek in the main conversation instead')
            return
          }
          const sent = await binding.session.prompt([{ type: 'text', text: promptText }], 'queue')
          if (!sent || sent.ok !== true) {
            const why = sent && sent.error ? (sent.error.message || sent.error.code || JSON.stringify(sent.error)) : 'unknown error'
            setErr('main chat rejected the request: ' + why + ' — use "Save only" and ask DeepSeek in the main conversation instead')
            return
          }
          setDsRun({ phase: 'queued', request: ask, startedAt: Date.now(), finishedAt: null, verified: false })
          setRunTick(0)
          setLog('sent to DeepSeek in the main chat — it edits the files itself, and the studio auto-runs a design-agent verification after the edits settle')
          setSelection(null)
          setEditMsg('')
          setDsReply('')
        } catch (e) {
          setErr(String((e && e.message) || e))
        } finally {
          setBusy('')
        }
      }

      async function askDesignAgent() {
        if (!selected || !selection) return
        const ask = editMsg.trim()
        if (!ask) return
        setBusy('design agent working…')
        setErr('')
        setDsReply('')
        try {
          const msg =
            'The operator selected element "' + (selection.cssPath || selection.tag) + '"' +
            (selection.classPath ? ' (classes: ' + selection.classPath + ')' : '') +
            ' and asked: ' + ask +
            '. Edit the design files yourself to change that element (which css rules/classes to edit, values, layout notes). Also include any related cleanup needed to make the change coherent — e.g. when removing the element, also remove/clean its now-empty wrapper and styles that only served it. Then reply with a short summary of the edits.'
          const agentAskArgs = { slug: selected, message: msg }
          if (sessionId) agentAskArgs.sessionId = sessionId
          const res = await call('studio.agent', agentAskArgs)
          if (!res.ok || !res.data || !res.data.ok) {
            if (res.data && Array.isArray(res.data.history)) setAgentHistory(res.data.history)
            setErr((res.data && res.data.notes) || res.error || 'design agent failed')
            return
          }
          const reply = String(res.data.reply || '')
          setDsReply(reply + '\n\n— design agent (' + (res.data.model || 'harness agent') + ') — files edited')
          setAgentHistory(res.data.history || [])
          setTick((t) => t + 1) // reload the live preview so the change is visible
          await refresh()
          setEditMsg('')
        } catch (e) {
          setErr(String((e && e.message) || e))
        } finally {
          setBusy('')
        }
      }

      React.useEffect(() => {
        if (!selected) {
          setReview(null)
          setAgentHistory([])
          return
        }
        call('studio.review.get', { slug: selected })
          .then((r) => setReview(r.ok && r.data ? r.data : null))
          .catch(() => setReview(null))
        call('studio.agent.history', { slug: selected })
          .then((r) => setAgentHistory(r.ok && Array.isArray(r.data) ? r.data : []))
          .catch(() => setAgentHistory([]))
      }, [selected])

      React.useEffect(() => {
        if (!selected) {
          setOutline(null)
          return
        }
        call('studio.outline', { slug: selected })
          .then((r) => setOutline(r.ok && r.data ? r.data : null))
          .catch(() => setOutline(null))
      }, [selected, tick])

      // Live activity: while the design agent works, poll the persisted history
      // so its tool steps (reads/edits) appear in the chat as they happen.
      React.useEffect(() => {
        if (!agentBusy || !selected) return
        const timer = setInterval(() => {
          call('studio.agent.history', { slug: selected })
            .then((r) => {
              if (r.ok && Array.isArray(r.data)) setAgentHistory(r.data)
            })
            .catch(() => {})
        }, 1200)
        return () => clearInterval(timer)
      }, [agentBusy, selected])

      async function sendAgent() {
        const msg = agentMsg.trim()
        if (!selected || !msg || (sel && sel.frozen)) return
        const slug = selected
        setAgentBusy(true)
        setErr('')
        try {
          const agentArgs = { slug, message: msg }
          if (agentImage) agentArgs.images = [agentImage]
          if (sessionId) agentArgs.sessionId = sessionId
          const res = await call('studio.agent', agentArgs)
          if (selectedRef.current !== slug) return
          if (!res.ok || !res.data || !res.data.ok) {
            if (res.data && Array.isArray(res.data.history)) setAgentHistory(res.data.history)
            setErr((res.data && res.data.notes) || res.error || 'design agent failed')
            return
          }
          setAgentHistory(res.data.history || [])
          setAgentMsg('')
          setTick((t) => t + 1) // the agent edited the files itself — reload the preview
          setLog('design agent finished (harness engine) — preview reloaded with its edits')
        } catch (e) {
          setErr(String((e && e.message) || e))
        } finally {
          setAgentBusy(false)
        }
      }

      function copyText(text) {
        return function () {
          try {
            if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(String(text)).then(
                () => setLog('copied to clipboard'),
                () => setLog('copy failed'),
              )
            } else {
              setLog('clipboard unavailable in this client')
            }
          } catch (_) {
            setLog('copy failed')
          }
        }
      }

      async function createSystem() {
        const slug = newSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
        if (!slug) return
        setBusy('creating…')
        setErr('')
        try {
          const createArgs = { slug }
          if (sessionId) createArgs.sessionId = sessionId
          const res = await call('studio.create', createArgs)
          if (!res.ok) {
            setErr(res.error || 'create failed')
            return
          }
          await refresh()
          setSelected(slug)
          setLog('created ' + slug + (res.data.sessionId ? ' (bound to this conversation)' : ''))
        } catch (e) {
          setErr(String((e && e.message) || e))
        } finally {
          setBusy('')
          setNewSlug('')
        }
      }

      async function zipSelected() {
        if (!selected) return
        setBusy('zipping…')
        setErr('')
        setZipPath('')
        try {
          const res = await call('studio.zip', { slug: selected })
          if (!res.ok) {
            setErr(res.error || 'zip failed')
            return
          }
          setZipPath(res.data.zip)
          setLog('zip ready: ' + res.data.zip)
        } catch (e) {
          setErr(String((e && e.message) || e))
        } finally {
          setBusy('')
        }
      }

      async function revealZip() {
        if (!selected || !zipPath) return
        setBusy('opening…')
        setErr('')
        try {
          const res = await call('studio.reveal', { slug: selected })
          if (!res.ok) {
            setErr(res.error || 'open failed')
            return
          }
          setLog('file manager opened for ' + res.data.revealed)
        } catch (e) {
          setErr(String((e && e.message) || e))
        } finally {
          setBusy('')
        }
      }

      async function capturePreview() {
        if (!selected || (sel && sel.frozen)) return
        setBusy('capturing preview…')
        setErr('')
        try {
          const res = await call('studio.snapshot', { slug: selected })
          if (!res.ok) {
            setErr(res.error || 'preview capture failed')
            return
          }
          const r = res.data || {}
          setAgentImage(r.dest || '')
          setLog(
            'preview captured → ' + r.dest +
            (r.w && r.h ? ' (' + r.w + '×' + r.h + ')' : '') +
            ' — it is selected for Review / the design agent',
          )
          await refresh()
        } catch (e) {
          setErr(String((e && e.message) || e))
        } finally {
          setBusy('')
        }
      }

      async function openInSystemBrowser(slug) {
        if (!slug) return
        setErr('')
        try {
          const res = await call('studio.openPreview', { slug })
          if (!res.ok) {
            setErr(res.error || 'could not launch the system browser')
            return
          }
          setLog('opened in your system browser: ' + (res.data && res.data.url ? res.data.url : ''))
        } catch (e) {
          setErr(String((e && e.message) || e))
        }
      }

      async function reloadAfterHistory() {
        await refresh()
        setTick((t) => t + 1)
      }

      function applyStyleToFrame(style) {
        if (!style || !frameEl || !frameEl.contentDocument) return false
        const root = frameEl.contentDocument.documentElement
        const vars = style.vars || {}
        for (const key of Object.keys(vars)) {
          if (vars[key] !== undefined && vars[key] !== null && vars[key] !== '') {
            root.style.setProperty(key, String(vars[key]))
          }
        }
        root.setAttribute('data-style-preview', style.id || '')
        return true
      }

      function previewStyle(style, pool) {
        if (!style) return
        stylePoolRef.current = Array.isArray(pool) && pool.length ? pool : [style]
        stylePreviewRef.current = style
        setStyleApplied(null)
        setStyleTour(null)
        setStylePreview(style)
        setWorkspaceTab('preview')
        applyStyleToFrame(style)
      }

      function tryAnotherStyle() {
        if (!stylePreview) return
        const pool = (stylePoolRef.current || []).filter((s) => s.id !== stylePreview.id)
        if (!pool.length) return
        const pick = Object.assign({}, pool[Math.floor(Math.random() * pool.length)], { fontMode: stylePreview.fontMode || 'auto' })
        stylePreviewRef.current = pick
        setStyleApplied(null)
        setStylePreview(pick)
        applyStyleToFrame(pick)
      }

      function startStyleTour(styles) {
        const pool = (Array.isArray(styles) ? styles : []).filter((s) => s && s.id)
        if (!pool.length) return
        const first = pool[0]
        stylePoolRef.current = pool
        stylePreviewRef.current = first
        setStyleApplied(null)
        setStyleTour({ styles: pool, index: 0 })
        setStylePreview(first)
        setWorkspaceTab('preview')
        applyStyleToFrame(first)
        try {
          if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') window.scrollTo({ top: 0, behavior: 'smooth' })
          if (typeof document !== 'undefined') {
            const root = document.querySelector('.ds-root')
            if (root) root.scrollTop = 0
          }
        } catch (_) {}
      }

      function goTour(index) {
        if (!styleTour || !styleTour.styles.length) return
        const count = styleTour.styles.length
        const next = ((index % count) + count) % count
        const style = styleTour.styles[next]
        stylePreviewRef.current = style
        setStyleApplied(null)
        setStylePreview(style)
        setStyleTour(Object.assign({}, styleTour, { index: next }))
        applyStyleToFrame(style)
      }

      function stepTour(delta) {
        if (!styleTour) return
        goTour(styleTour.index + delta)
      }

      function closeStyleTour() {
        setStyleTour(null)
        clearStylePreview(true)
      }

      React.useEffect(() => {
        if (!styleTour || workspaceTab !== 'preview') return undefined
        function onKey(event) {
          const tag = event.target && event.target.tagName ? String(event.target.tagName).toLowerCase() : ''
          if (tag === 'input' || tag === 'textarea' || tag === 'select') return
          if (event.key === 'ArrowRight') {
            event.preventDefault()
            goTour(styleTour.index + 1)
          } else if (event.key === 'ArrowLeft') {
            event.preventDefault()
            goTour(styleTour.index - 1)
          } else if (event.key === 'Escape') {
            event.preventDefault()
            closeStyleTour()
          }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [styleTour, workspaceTab])

      React.useEffect(() => {
        if (!styleTour || !styleTourTrackRef.current) return
        const track = styleTourTrackRef.current
        const el = track.querySelector('[data-tour-index="' + styleTour.index + '"]')
        if (!el) return
        const left = el.offsetLeft - track.clientWidth / 2 + el.offsetWidth / 2
        if (typeof track.scrollTo === 'function') {
          track.scrollTo({ left: Math.max(0, left), behavior: 'smooth' })
        } else {
          track.scrollLeft = Math.max(0, left)
        }
      }, [styleTour])

      function clearStylePreview(reload) {
        stylePreviewRef.current = null
        setStylePreview(null)
        setStyleTour(null)
        if (reload !== false) {
          setStyleApplied(null)
          setTick((t) => t + 1)
        }
      }

      async function applyPreviewStyle() {
        if (!stylePreview) return
        if (sel && sel.frozen) {
          setErr('design is frozen — thaw it before applying a style')
          return
        }
        setBusy('applying style…')
        setErr('')
        try {
          const res = await call('studio.styles.apply', { slug: selected, styleId: stylePreview.id, fontMode: stylePreview.fontMode })
          if (!res.ok) {
            setErr(res.error || 'style apply failed')
            return
          }
          setLog('applied style ' + stylePreview.name + ' — snapshot saved')
          setStyleApplied({ name: stylePreview.name, beforeSnapshot: res.data && res.data.beforeSnapshot ? res.data.beforeSnapshot : null })
          stylePreviewRef.current = null
          setStylePreview(null)
          setStyleTour(null)
          await refresh()
          setTick((t) => t + 1)
        } catch (e) {
          setErr(String((e && e.message) || e))
        } finally {
          setBusy('')
        }
      }

      async function undoStyleApply() {
        if (!styleApplied || !styleApplied.beforeSnapshot) return
        setBusy('reverting style…')
        setErr('')
        try {
          const res = await call('studio.history.restore', { slug: selected, snapshotId: styleApplied.beforeSnapshot })
          if (!res.ok) {
            setErr(res.error || 'revert failed')
            return
          }
          setLog('reverted style ' + styleApplied.name)
          setStyleApplied(null)
          await refresh()
          setTick((t) => t + 1)
        } catch (e) {
          setErr(String((e && e.message) || e))
        } finally {
          setBusy('')
        }
      }

      async function reloadAfterStyle() {
        stylePreviewRef.current = null
        setStylePreview(null)
        setStyleApplied(null)
        setStyleTour(null)
        await refresh()
        setTick((t) => t + 1)
      }

      async function handleStyleCreated(slug) {
        stylePreviewRef.current = null
        setStylePreview(null)
        setStyleApplied(null)
        setStyleTour(null)
        await refresh()
        setSelected(slug)
        setWorkspaceTab('preview')
        setTick((t) => t + 1)
      }

      React.useEffect(() => {
        if (workspaceTab === 'preview' && stylePreview && frameEl) applyStyleToFrame(stylePreview)
      }, [workspaceTab, stylePreview, tick])

      React.useEffect(() => {
        selectedRef.current = selected
        stylePreviewRef.current = null
        setStylePreview(null)
        setStyleApplied(null)
        setStyleTour(null)
        stylePoolRef.current = []
        setFreezeOpen(false)
        setThawOpen(false)
        setFreezeTarget('')
        setFreezeNote('')
        setSelection(null)
        setSelectMode(false)
        setEditMsg('')
        setDsReply('')
        setAgentImage('')
        setAgentMsg('')
        setAgentHistory([])
        setAssets([])
        setReview(null)
        setOutline(null)
        setZipPath('')
        setDsRun(null)
        setRunTick(0)
      }, [selected])

      async function postReviewNote(text) {
        try {
          const n = await call('studio.agent.note', { slug: selected, role: 'review', text: String(text) })
          if (n.ok && Array.isArray(n.data)) setAgentHistory(n.data)
        } catch (_) {}
      }

      async function runReview() {
        if (!selected) return
        const effective = agentImage || (selImages().length ? selImages()[0] : '')
        setBusy('reviewing…')
        setErr('')
        setReview(null)
        try {
          const reviewArgs = { slug: selected }
          if (effective) reviewArgs.image = effective
          const res = await call('vision.review', reviewArgs)
          if (!res.ok) {
            setErr(res.error || 'review failed')
            postReviewNote('🔎 vision review failed: ' + (res.error || 'unknown error'))
            return
          }
          if (!res.data.ok) {
            setReview({ failed: true, notes: res.data.notes })
            postReviewNote('🔎 vision review: NO VERDICT — ' + res.data.notes)
            return
          }
          setReview({
            ok: res.data.ok,
            notes: res.data.notes,
            model: res.data.model,
            transport: res.data.transport || null,
            harnessFallback: res.data.harnessFallback || null,
            at: new Date().toISOString(),
          })
          postReviewNote('🔎 vision review: ' + (res.data.ok ? 'GOOD' : 'POOR') + ' — ' + res.data.notes + (res.data.model ? ' (model: ' + res.data.model + (res.data.transport ? ', via ' + res.data.transport : '') + ')' : ''))
          setLog('review complete via ' + (res.data.transport || 'unknown transport') + ' (soft signal — never a gate)')
        } catch (e) {
          setErr(String((e && e.message) || e))
        } finally {
          setBusy('')
        }
      }

      function selImages() {
        const sel = (systems || []).find((s) => s.slug === selected)
        if (!sel) return []
        // Only real, non-empty image files are listable — a 0-byte artifact
        // would render as a broken thumbnail ("review target" alt text).
        return sel.files.filter((f) => f.path.indexOf('assets/images/') === 0 && (f.size || 0) > 0).map((f) => f.path)
      }

      async function ingestFilesFrom(fileList, zone) {
        if (!selected) {
          setLog('select a design system first')
          return
        }
        if (sel && sel.frozen) {
          setLog('design is frozen — thaw it before uploading files')
          return
        }
        if (!fileList || !fileList.length) return
        setBusy('uploading…')
        setErr('')
        try {
          const items = []
          for (let i = 0; i < fileList.length; i++) {
            const f = fileList[i]
            const isImage = f.type && f.type.indexOf('image/') === 0
            items.push({
              name: f.name,
              kind: isImage ? 'image' : 'code',
              dataUrl: isImage ? await readAsDataUrl(f) : undefined,
              text: isImage ? undefined : await readAsText(f),
            })
          }
          const cleanItems = items.map((it) => {
            const out = { name: it.name, kind: it.kind }
            if (it.dataUrl) out.dataUrl = it.dataUrl
            if (typeof it.text === 'string') out.text = it.text
            return out
          })
          const res = await call('studio.ingest', { slug: selected, files: cleanItems })
          if (!res.ok) {
            setErr(res.error || 'ingest failed')
            return
          }
          const okItems = res.data.filter((r) => r.ok)
          const badItems = res.data.filter((r) => !r.ok)
          const img = okItems.find((r) => r.kind === 'image')
          if (img) setAgentImage(img.dest)
          setLog(
            'uploaded: ' + (okItems.map((r) => r.dest).join(', ') || '(nothing)') + (badItems.length ? ' — ' + badItems.length + ' rejected' : ''),
          )
          await refresh()
        } catch (e) {
          setErr(String((e && e.message) || e))
        } finally {
          setBusy('')
        }
      }

      const images = selImages()
      const sel = (systems || []).find((s) => s.slug === selected) || null

      const dsElapsedSec = dsRun ? Math.max(0, Math.round((((dsRun.phase === 'finished' && dsRun.finishedAt) || Date.now()) - dsRun.startedAt) / 1000)) : 0
      const dsElapsed = dsRun ? (dsElapsedSec ? Math.floor(dsElapsedSec / 60) + 'm ' + String(dsElapsedSec % 60).padStart(2, '0') + 's' : 'starting…') : ''
      const visionInfo = harnessState && harnessState.vision ? harnessState.vision : null
      const hasOpenRouterKey = !!(keyState && keyState.configured)
      const noVisionWarning = !!(visionInfo && visionInfo.available === false && !hasOpenRouterKey)
      const fallbackVisionNote = !!(visionInfo && visionInfo.available === false && hasOpenRouterKey)
      const dsRunText = !dsRun
        ? ''
        : dsRun.phase === 'queued'
          ? '🤖 DeepSeek: request sent — waiting for it to pick up the edit…'
          : dsRun.phase === 'running'
            ? '🤖 DeepSeek is working on your change…'
            : dsRun.phase === 'untracked'
              ? '🤖 DeepSeek: request sent — watch the main chat for progress'
              : dsRun.verified
                ? '✅ DeepSeek finished — design agent verified the result'
                : '✅ DeepSeek finished — see the main chat'

      return h(
        'div',
        { className: 'ds-root' },
        dsRun
          ? h(
              'div',
              { className: 'ds-runbar' + (dsRun.phase === 'finished' ? ' done' : '') },
              dsRun.phase === 'queued' || dsRun.phase === 'running' ? h('span', { className: 'ds-spinner' }) : null,
              h('span', { className: 'ds-runbar-text', title: dsRun.request }, dsRunText),
              h('span', { className: 'ds-runbar-time' }, dsElapsed),
              h(
                'button',
                { className: 'ds-runbar-x', onClick: () => setDsRun(null), title: 'dismiss' },
                '×',
              ),
            )
          : null,
        // ---- top: title + actions ----
        h(
          'div',
          { className: 'ds-top' },
          h(
            'div',
            { className: 'ds-top-row' },
            h('div', { className: 'ds-title' }, runtime.t('title.designStudio')),
            h('span', { className: 'ds-caps' }, sessionId ? 'chat ' + String(sessionId).slice(0, 12) + '…' : 'no chat binding'),
            h(
              'div',
              { className: 'ds-actions' },
              Btn({ label: '⚙ Settings', onClick: () => { setWorkspaceTab('settings') }, disabled: !sel, title: 'Open the full-width Design Studio settings tab' }),
              Btn({ label: 'Open ↗', onClick: () => openInSystemBrowser(sel && sel.slug), disabled: !sel, title: 'Open in your OS browser (bypasses the DSH in-app browser)' }),
              Btn({ label: '🗜 Export zip', primary: true, onClick: zipSelected, disabled: busy !== '' || !sel }),
              zipPath ? Btn({ label: 'Open folder', onClick: revealZip, disabled: busy !== '' }) : null,
              zipPath ? h('span', { className: 'ds-hint' }, zipPath) : null,
              Btn({
                label: confirmDelete ? '⚠ Confirm delete ' + (sel ? sel.slug : '') + '?' : '🗑 Delete',
                onClick: deleteSelected,
                disabled: busy !== '' || !sel || !!(sel && sel.frozen),
                title: sel && sel.frozen ? 'Thaw the design before deleting it' : 'Deletes the SELECTED design system (highlight its card in the library first)',
              }),
              confirmDelete
                ? Btn({
                    label: 'Cancel',
                    onClick: () => setConfirmDelete(false),
                    disabled: busy !== '',
                    title: 'Keep this design system and disarm the delete confirmation',
                  })
                : null,
            ),
          ),
          h(
            'div',
            { className: 'ds-row' },
            h('input', {
              className: 'ds-input',
              placeholder: 'new-project',
              value: newSlug,
              onChange: (e) => setNewSlug(e.target.value),
              onKeyDown: (e) => {
                const composing = e.isComposing || (e.nativeEvent && e.nativeEvent.isComposing)
                if (e.key === 'Enter' && !composing) createSystem()
              },
            }),
            Btn({ label: 'Create', primary: true, onClick: createSystem, disabled: busy !== '' }),
            Btn({ label: 'Refresh', onClick: () => refresh().catch((e) => setErr(String((e && e.message) || e))), disabled: busy !== '' }),
          ),
          Err({ text: err }),
          Log({ text: busy || log }),
        ),
        // ---- main grid: preview | tools ----
        sel
          ? h(
              'div',
              { className: 'ds-workspace-shell' },
              h(
                'div',
                { className: 'ds-workspace-bar' },
                h(
                  'div',
                  { className: 'ds-workspace-tabs' },
                  [['preview', 'Preview'], ['styles', 'Styles'], ['agent', 'Agent'], ['assets', 'Assets'], ['history', 'History'], ['review', 'Review'], ['upload', 'Upload'], ['settings', 'Settings']].map(([key, label]) =>
                    h(
                      'button',
                      {
                        key,
                        type: 'button',
                        className: 'ds-seg' + (workspaceTab === key ? ' on' : ''),
                        'aria-pressed': workspaceTab === key ? 'true' : 'false',
                        onClick: () => setWorkspaceTab(key),
                      },
                      label,
                    ),
                  ),
                ),
                systems && systems.length
                  ? h(
                      'label',
                      { className: 'ds-design-switcher', title: 'Switch design — each design has its own mockup, history, assets and freeze state' },
                      h('span', { className: 'ds-caps' }, 'Design'),
                      h(
                        'select',
                        {
                          className: 'ds-select',
                          value: selected,
                          onChange: (e) => setSelected(e.target.value),
                        },
                        systems.map((s) => h('option', { key: s.slug, value: s.slug }, s.slug + (s.frozen ? ' 🔒' : ''))),
                      ),
                    )
                  : null,
                h('span', { className: 'ds-toolbar-gap' }),
                sel && sel.frozen
                  ? h('span', { className: 'ds-freeze-state', title: 'Design Studio is read-only while frozen' }, '🔒 Design frozen')
                  : h(
                      'button',
                      {
                        type: 'button',
                        className: 'ds-freeze-btn',
                        onClick: openFreeze,
                        disabled: busy !== '',
                        title: 'Hand off this mockup as read-only and switch to implementation work',
                      },
                      '❄ Finish & freeze design',
                    ),
              ),
              sel && sel.frozen
                ? h(
                    'div',
                    { className: 'ds-freeze-banner' },
                    h('span', { className: 'ds-freeze-banner-icon', 'aria-hidden': 'true' }, '🔒'),
                    h(
                      'div',
                      { className: 'ds-freeze-banner-copy' },
                      h('b', null, 'Design frozen — implementation mode'),
                      h('span', null, sel.freeze && sel.freeze.implementation ? 'Edit: ' + sel.freeze.implementation : 'No implementation target recorded.'),
                      h('span', { className: 'ds-hint' }, 'Design Studio is read-only. AI write, style, asset, history-restore and design-agent actions are blocked until you thaw it.'),
                    ),
                    Btn({
                      label: 'Thaw design',
                      onClick: () => setThawOpen(true),
                      disabled: busy !== '',
                      title: 'Re-enable Design Studio editing for this design',
                    }),
                  )
                : null,
              h(
                'div',
                { className: 'ds-main' + (workspaceTab === 'settings' ? ' tab-settings' : '') + (workspaceTab === 'preview' ? ' tab-preview' : '') },
                h(
                  'div',
                  { className: 'ds-col ds-library-col' },
                h(
                  'div',
                  { className: 'ds-panel ds-library' },
                  h(
                    'div',
                    { className: 'ds-panel-head' },
                    h('span', { className: 'ds-caps' }, 'Designs'),
                    h('span', { className: 'ds-hint' }, systems ? systems.length + ' total' : '—'),
                  ),
                  systems === null
                    ? h('div', { className: 'ds-hint' }, 'loading…')
                    : systems.length === 0
                      ? h('div', { className: 'ds-hint' }, 'No design systems yet.')
                      : h(
                          'div',
                          { className: 'ds-lib-list' },
                          systems.map((s) =>
                            h(
                              'button',
                              {
                                key: s.slug,
                                type: 'button',
                                className: 'ds-lib-item' + (s.slug === selected ? ' on' : ''),
                                onClick: () => setSelected(s.slug),
                                title: s.slug + (s.stamp && s.stamp.at ? ' — modified ' + String(s.stamp.at).replace('T', ' ').slice(0, 19) : ''),
                              },
                              h('b', null, s.slug),
                              h(
                                'span',
                                { className: 'ds-lib-badges' },
                                s.hasPreview ? h('span', { className: 'ds-badge green' }, 'preview') : null,
                                s.hasPrompts ? h('span', { className: 'ds-badge blue' }, 'brief') : null,
                                s.hasTokenCss ? h('span', { className: 'ds-badge amber' }, 'tokens') : null,
                              ),
                            ),
                          ),
                        ),
                ),
                h(
                  'div',
                  { className: 'ds-panel ds-library' },
                  h(
                    'div',
                    { className: 'ds-panel-head' },
                    h('span', { className: 'ds-caps' }, 'Assets'),
                    h('span', { className: 'ds-hint' }, assets.length + ' total'),
                    h('span', { className: 'ds-toolbar-gap' }),
                    Btn({ label: 'Manage', onClick: () => setAssetsOpen(true) }),
                  ),
                  assets.filter((a) => String(a.mime || '').startsWith('image/')).length === 0
                    ? h('div', { className: 'ds-hint' }, 'No images yet — open Assets to upload, import or copy a path.')
                    : h(
                        'div',
                        { className: 'ds-asset-mini' },
                        assets
                          .filter((a) => String(a.mime || '').startsWith('image/'))
                          .slice(0, 6)
                          .map((a) =>
                            h(
                              'button',
                              { key: a.path, type: 'button', className: 'ds-asset-mini-item', onClick: () => setAssetsOpen(true), title: a.path + ' — ' + (a.width || '?') + '×' + (a.height || '?') },
                              h('img', { src: assetHref(selected, a), alt: a.alt || a.name, loading: 'lazy' }),
                            ),
                          ),
                      ),
                ),
                h(
                  'div',
                  { className: 'ds-panel ds-outline' },
                  h('div', { className: 'ds-panel-head' }, h('span', { className: 'ds-caps' }, 'Outline'), h('span', { className: 'ds-hint' }, sel.count + ' files' + (sel.stamp && sel.stamp.at ? ' · modified ' + String(sel.stamp.at).replace('T', ' ').slice(0, 19) : '')), h('span', { className: 'ds-hint ds-mono' }, sel.stamp && sel.stamp.hash ? 'stamp ' + String(sel.stamp.hash).slice(0, 8) : '')),
                  h(
                    'div',
                    { className: 'ds-outline-body' },
                    outline === null
                      ? h('div', { className: 'ds-hint' }, 'loading…')
                      : outline.sections.map((s) =>
                          h(
                            'div',
                            { key: s.file },
                            h('div', { className: 'ds-outline-file' }, s.file),
                            s.items.length
                              ? s.items.map((it, i) => h('div', { key: i, className: 'ds-outline-item' + (it.kind === 'section' ? ' section' : it.kind === 'heading' ? ' heading' : '') }, it.label))
                              : h('div', { className: 'ds-hint' }, '(no sections — add headings/comments)'),
                          ),
                        ),
                  ),
                ),
              ),
              workspaceTab === 'preview'
                ? h(
                    'div',
                    { className: 'ds-col ds-preview-col' },
                    h(
                      'div',
                      { className: 'ds-panel ds-preview-card' },
                  !styleTour && (stylePreview || styleApplied)
                    ? h(
                        'div',
                        { className: 'ds-style-preview-bar' },
                        stylePreview
                          ? h(
                              'span',
                              { className: 'ds-caps' },
                              'Trying style',
                            )
                          : h('span', { className: 'ds-caps good' }, 'Applied'),
                        h('b', null, (stylePreview || styleApplied).name),
                        h('span', { className: 'ds-hint' }, stylePreview ? 'preview only — files unchanged' : 'snapshot saved'),
                        h('span', { className: 'ds-toolbar-gap' }),
                        h(
                          'div',
                          { className: 'ds-style-preview-actions' },
                          stylePreview
                            ? Btn({ label: '🎲 Try another random', onClick: tryAnotherStyle, disabled: busy !== '' })
                            : null,
                          stylePreview
                            ? Btn({ label: 'Apply style', primary: true, onClick: applyPreviewStyle, disabled: busy !== '' || !!(sel && sel.frozen) })
                            : null,
                          stylePreview
                            ? Btn({ label: 'Revert', onClick: () => clearStylePreview(true), disabled: busy !== '' })
                            : null,
                          !stylePreview && styleApplied && styleApplied.beforeSnapshot
                            ? Btn({ label: '↶ Undo apply', onClick: undoStyleApply, disabled: busy !== '' })
                            : null,
                          !stylePreview && styleApplied
                            ? Btn({ label: 'Dismiss', onClick: () => setStyleApplied(null), disabled: busy !== '' })
                            : null,
                        ),
                      )
                    : null,
                  h(
                    'div',
                    { className: 'ds-chrome' },
                    h('div', { className: 'ds-dots' }, h('i', { className: 'ds-dot r' }), h('i', { className: 'ds-dot y' }), h('i', { className: 'ds-dot g' })),
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'ds-url',
                        onClick: () => openInSystemBrowser(sel.slug),
                        title: 'Open this preview in your OS browser (bypasses the DSH in-app browser)',
                      },
                      h('span', null, '🔒'),
                      '/design-studio/' + sel.slug + '/html/index.html',
                      h('span', { className: 'ds-external', 'aria-hidden': 'true' }, '↗'),
                    ),
                    h('div', { className: 'ds-live', title: 'Auto-refreshes when the design files change' }, h('span', { className: 'pulse' }), 'Live · auto'),
                    h('span', { className: 'ds-chrome-gap' }),
                    Btn({ label: selectMode ? '✋ Stop selecting' : '🎯 Select', onClick: () => { setSelectMode(!selectMode); setSelection(null) }, disabled: busy !== '' || !!(sel && sel.frozen), title: sel && sel.frozen ? 'Design is frozen — thaw it before selecting changes' : '' }),
                    Btn({ label: '↻ Reload', onClick: () => setTick((t) => t + 1) }),
                    h(
                      'div',
                      { className: 'ds-segmented', role: 'group', 'aria-label': 'Preview viewport' },
                      Object.keys(PREVIEW_SIZES).map((key) =>
                        h(
                          'button',
                          {
                            key,
                            type: 'button',
                            className: 'ds-seg' + (previewViewport === key ? ' on' : ''),
                            'aria-pressed': previewViewport === key ? 'true' : 'false',
                            onClick: () => setPreviewViewport(key),
                          },
                          PREVIEW_SIZES[key].label,
                        ),
                      ),
                    ),
                    Btn({ label: previewFit ? '1:1' : 'Fit', onClick: () => setPreviewFit(!previewFit), title: previewFit ? 'Show actual size (page may scroll)' : 'Scale the whole preview to fit the screen' }),
                    Btn({ label: '🗂 Assets', onClick: () => setAssetsOpen(true) }),
                    Btn({ label: '📷 Capture', onClick: capturePreview, disabled: busy !== '' || !sel.hasPreview || sel.frozen }),
                    Btn({ label: '👁 Review', primary: true, onClick: runReview, disabled: busy !== '' }),
                    Btn({
                      label: 'Open ↗',
                      onClick: () => openInSystemBrowser(sel.slug),
                      title: 'Open in your OS browser (bypasses the DSH in-app browser)',
                    }),
                  ),
                  styleTour
                    ? h(
                        'div',
                        { className: 'ds-style-tour' },
                        h(
                          'div',
                          { className: 'ds-style-tour-head' },
                          h('span', { className: 'ds-caps' }, 'Style tour · ' + (styleTour.index + 1) + ' / ' + styleTour.styles.length),
                          h('b', null, (styleTour.styles[styleTour.index] || {}).name || ''),
                          h('span', { className: 'ds-hint' }, '← → auto-tries each style · files unchanged'),
                          h('span', { className: 'ds-toolbar-gap' }),
                          Btn({ label: 'Apply style', primary: true, onClick: applyPreviewStyle, disabled: busy !== '' || !!(sel && sel.frozen) }),
                          Btn({ label: 'Close', onClick: closeStyleTour, disabled: busy !== '' }),
                        ),
                        h(
                          'div',
                          { className: 'ds-style-tour-row' },
                          h('button', { type: 'button', className: 'ds-style-tour-nav', onClick: () => stepTour(-1), title: 'Previous style', 'aria-label': 'Previous style' }, '‹'),
                          h(
                            'div',
                            { className: 'ds-style-tour-track', ref: styleTourTrackRef },
                            styleTour.styles.map((tourStyle, index) =>
                              h(
                                'button',
                                {
                                  key: tourStyle.id,
                                  type: 'button',
                                  className: 'ds-style-tour-card' + (index === styleTour.index ? ' on' : ''),
                                  'data-tour-index': index,
                                  title: tourStyle.name,
                                  onClick: () => goTour(index),
                                },
                                h(
                                  'span',
                                  { className: 'ds-style-tour-swatches' },
                                  h('i', { style: { background: styleColor(tourStyle, '--bg') } }),
                                  h('i', { style: { background: styleColor(tourStyle, '--gold') } }),
                                  h('i', { style: { background: styleColor(tourStyle, '--gold-soft') } }),
                                ),
                                h('b', null, tourStyle.name),
                                h('span', { className: 'ds-hint' }, tourStyle.zh || tourStyle.tag || ''),
                              ),
                            ),
                          ),
                          h('button', { type: 'button', className: 'ds-style-tour-nav', onClick: () => stepTour(1), title: 'Next style', 'aria-label': 'Next style' }, '›'),
                        ),
                      )
                    : null,
                  h(
                    'div',
                    { className: 'ds-frame-holder' },
                    sel.hasPreview
                      ? h(ScaledPreview, {
                          slug: selected,
                          tick,
                          viewport: previewViewport,
                          fit: previewFit,
                          setFrameRef,
                          onLoad: () => {
                            if (stylePreviewRef.current) applyStyleToFrame(stylePreviewRef.current)
                            if (selectMode) injectSelector(frameEl, (s) => { setSelection(s); setSelectMode(false); setDsReply('') }, () => setSelectMode(false))
                          },
                        })
                      : h(
                          'div',
                          { className: 'ds-frame-ph' },
                          h('span', { className: 'glyph' }, '▦'),
                          h('p', { className: 'ds-mono' }, 'No html/index.html yet — the live preview appears once it exists.'),
                        ),
                  ),
                  selectMode
                    ? h('div', { className: 'ds-hint', style: { padding: '0 16px 10px' } }, 'Hover to highlight — click ONE component. The selector closes and a change popup opens.')
                    : null,
                  selection
                    ? h(
                        'div',
                        {
                          className: 'ds-modal-backdrop' + (busy !== '' ? ' ds-clear' : ''),
                          onClick: (e) => {
                            if (e.target === e.currentTarget) {
                              setSelection(null)
                              setEditMsg('')
                              setDsReply('')
                            }
                          },
                        },
                        h(
                          'div',
                          { className: 'ds-modal' + (busy !== '' ? ' ds-modal-mini' : '') },
                          busy !== ''
                            ? h('div', { className: 'ds-spinner-row' }, h('span', { className: 'ds-spinner' }), h('span', null, busy))
                            : null,
                          h(
                            'div',
                            { className: 'ds-modal-title' },
                            h('span', null, '🎯 Change this'),
                            h('span', { className: 'ds-sel-path' }, selection.cssPath || selection.tag),
                            selection.rect ? h('span', { className: 'ds-hint' }, selection.rect.w + '×' + selection.rect.h + 'px') : null,
                          ),
                          h(
                            'div',
                            { className: 'ds-sel-styles' },
                            'radius ' + (selection.styles['border-radius'] || '—') +
                              ' · bg ' + (selection.styles['background-color'] || '—') +
                              ' · padding ' + (selection.styles.padding || '—') +
                              ' · font ' + (selection.styles['font-size'] || '—') +
                              (selection.text ? ' · text: "' + selection.text + '"' : ''),
                          ),
                          h(
                            'div',
                            { className: 'ds-row' },
                            ['Change this radius to ', 'Change this color to ', 'Restyle this component: '].map((tpl) =>
                              h(
                                'button',
                                { key: tpl, className: 'ds-chip', onClick: () => quickRequest(tpl) },
                                tpl.replace(/[: ]+$/, '').replace('Change this radius to', 'Radius').replace('Change this color to', 'Color').replace('Restyle this component:', 'Component'),
                              ),
                            ),
                          ),
                          noVisionWarning
                            ? h(
                                'div',
                                { className: 'ds-vision-warning' },
                                h('b', null, 'No image-capable model active. '),
                                'DeepSeek can edit the files but cannot see the rendered preview. Visual judgment is unreliable here; configure an OpenRouter vision model for visual checks.',
                              )
                            : fallbackVisionNote
                              ? h(
                                  'div',
                                  { className: 'ds-vision-note' },
                                  'Text-only model: screenshot checks use the configured OpenRouter vision fallback.',
                                )
                              : null,
                          h('textarea', {
                            className: 'ds-modal-input',
                            ref: setEditInputRef,
                            placeholder: 'What should change on this element? e.g. make this radius 12px',
                            value: editMsg,
                            onChange: (e) => setEditMsg(e.target.value),
                            onKeyDown: (e) => {
                              const composing = e.isComposing || (e.nativeEvent && e.nativeEvent.isComposing)
                              if (e.key === 'Enter' && !e.shiftKey && !composing) {
                                e.preventDefault()
                                askDeepSeek()
                              }
                            },
                          }),
                          dsReply ? h('div', { className: 'ds-modal-reply' }, String(dsReply)) : null,
                          h(
                            'div',
                            { className: 'ds-row' },
                            Btn({ label: '🤖 Ask DeepSeek', primary: true, onClick: askDeepSeek, disabled: busy !== '' || !editMsg.trim() }),
                            Btn({ label: '◈ Make external agent do it', onClick: askDesignAgent, disabled: busy !== '' || !editMsg.trim() }),
                            Btn({ label: '💾 Save only', onClick: saveSelection, disabled: busy !== '' || !editMsg.trim() }),
                            Btn({ label: 'Close', onClick: () => { setSelection(null); setEditMsg(''); setDsReply('') } }),
                          ),
                          h('span', { className: 'ds-hint' }, 'Enter sends this to DeepSeek now; Shift+Enter adds a line. Ask DeepSeek writes the request to ' + sel.slug + '/EDIT_REQUEST.md and queues it in your main chat — DeepSeek edits the files itself and the studio auto-runs a design-agent verification when the edits settle. "Make external agent do it" keeps the agent-chat flow. Save only writes the request file without sending. One element at a time; pick again with 🎯 Select.'),
                        ),
                      )
                    : null,
                ),
              )
                : null,
              h(
                'div',
                { className: 'ds-col ds-side-col tab-' + workspaceTab },
                // design agent chat
                h(
                  'div',
                  { className: 'ds-panel ds-agent' },
                  h(
                    'div',
                    { className: 'ds-panel-head' },
                    h('span', { className: 'ds-caps' }, 'Design Agent'),
                    h('span', { className: 'ds-caps ds-ok-text' }, 'active: ' + (sel ? sel.slug : '—')),
                    h('span', { className: 'ds-hint' }, 'harness agent engine — reads & edits the files itself'),
                    h('span', { className: 'ds-toolbar-gap' }),
                    h(
                      'select',
                      { className: 'ds-select', value: agentImage, onChange: (e) => setAgentImage(e.target.value) },
                      h('option', { value: '' }, images.length ? '🖼 (none — no image attached)' : 'no images uploaded yet'),
                      images.map((p) => h('option', { key: p, value: p }, p)),
                    ),
                  ),
                  h(
                    'div',
                    { className: 'ds-agent-body', ref: setAgentBodyRef },
                    agentImage
                      ? h('div', { className: 'ds-activity', style: { borderLeftColor: 'var(--ds-accent)' } }, '🖼 selected: ' + agentImage + ' — "the image" in your message means THIS one; pick "(no image)" to detach.')
                      : null,
                    err
                      ? h('div', { className: 'ds-err ds-agent-inline' }, '⚠ ' + String(err))
                      : null,
                    agentBusy
                      ? h(
                          'div',
                          { className: 'ds-agent-working' },
                          h('span', { className: 'ds-spinner' }),
                          ' design agent is working on the files…',
                        )
                      : null,
                    agentHistory.length === 0
                      ? h('div', { className: 'ds-empty' }, 'No messages yet. Ask the design agent anything — it lists, reads and edits the design files itself, then summarizes.')
                      : agentHistory.map((e, i) => {
                          if (e.role === 'activity') {
                            return h('div', { key: i, className: 'ds-activity' }, '✎ ' + String(e.text || ''))
                          }
                          const me = e.role === 'operator'
                          return h(
                            'div',
                            { key: i, className: 'ds-msg' + (me ? ' me' : '') },
                            me
                              ? null
                              : h('span', { className: 'ds-ava ' + (e.role === 'review' ? 'review' : 'agent') }, e.role === 'review' ? '👁' : '◈'),
                            h(
                              'div',
                              { className: 'ds-bubble' },
                              String(e.text || ''),
                              h(
                                'button',
                                {
                                  className: 'ds-copy',
                                  title: 'Copy message',
                                  onClick: () => copyText(e.text)(),
                                },
                                'copy',
                              ),
                            ),
                            me ? h('span', { className: 'ds-ava you' }, '▶') : null,
                          )
                        }),
                  ),
                  h(
                    'div',
                    { className: 'ds-agent-foot' },
                    h('input', {
                      className: 'ds-input',
                      placeholder: 'Message Design Agent… (it will read + edit the files itself)',
                      value: agentMsg,
                      readOnly: !!(sel && sel.frozen),
                      onChange: (e) => setAgentMsg(e.target.value),
                      onKeyDown: (e) => {
                        const composing = e.isComposing || (e.nativeEvent && e.nativeEvent.isComposing)
                        if (e.key === 'Enter' && !e.shiftKey && !composing && !agentBusy && !(sel && sel.frozen)) sendAgent()
                      },
                    }),
                    Btn({ label: agentBusy ? '…' : 'Send', primary: true, onClick: sendAgent, disabled: agentBusy || agentMsg.trim() === '' || !!(sel && sel.frozen), title: sel && sel.frozen ? 'Design is frozen — thaw it before asking the design agent to edit' : '' }),
                  ),
                ),
                // file drop-ins
                h(
                  'div',
                  { className: 'ds-panel ds-side-upload', style: { padding: '14px' } },
                  h('span', { className: 'ds-caps' }, 'File upload'),
                  h('div', { className: 'ds-drops', style: { marginTop: '10px' } },
                    h('button', { type: 'button', className: 'ds-drop', onClick: () => { if (imgInputEl) imgInputEl.click() } }, h('span', { className: 'glyph' }, '🖼'), 'Choose images → assets/images'),
                    h('button', { type: 'button', className: 'ds-drop docs', onClick: () => { if (docInputEl) docInputEl.click() } }, h('span', { className: 'glyph' }, '▤'), 'Choose .md / code → references'),
                  ),
                  h('input', {
                    type: 'file',
                    multiple: true,
                    accept: 'image/*',
                    className: 'ds-file-input',
                    ref: setImgInputRef,
                    onChange: (e) => {
                      const fl = e.target.files
                      ingestFilesFrom(fl, 'images')
                      e.target.value = ''
                    },
                  }),
                  h('input', {
                    type: 'file',
                    multiple: true,
                    accept: '.md,.txt,.json,.js,.css,.html,.csv,.log,.yaml,.yml',
                    className: 'ds-file-input',
                    ref: setDocInputRef,
                    onChange: (e) => {
                      const fl = e.target.files
                      ingestFilesFrom(fl, 'docs')
                      e.target.value = ''
                    },
                  }),
                ),
                // vision review
                h(
                  'div',
                  { className: 'ds-panel ds-side-review' },
                  h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
                    h('span', { className: 'ds-caps' }, 'Vision Review'),
                    h('div', { className: 'ds-row' },
                      Btn({ label: '📷 Capture', onClick: capturePreview, disabled: busy !== '' || !selected || !!(sel && sel.frozen) }),
                      h('span', { className: 'ds-caps' }, harnessState && harnessState.vision && harnessState.vision.available ? 'harness vision' : 'openrouter'),
                    ),
                  ),
                  h('div', { className: 'ds-vision-thumb' },
                    images.length
                      ? h('img', { src: relHref(selected, agentImage || images[0]), alt: 'review target' })
                      : h('span', { className: 'glyph' }, '▣'),
                  ),
                  images.length === 0 ? h('div', { className: 'ds-hint' }, 'no image yet — drop one into the Images zone above (the 🖼 selector in the Design Agent panel picks which one)') : null,
                  h('div', { className: 'ds-verdict-row' },
                    h('div', { className: 'ds-verdict-cell' + (review && !review.failed && review.ok ? ' on-good' : '') }, 'GOOD'),
                    h('div', { className: 'ds-verdict-cell' + (review && !review.failed && !review.ok ? ' on-poor' : '') }, 'POOR'),
                  ),
                  review
                    ? review.failed
                      ? h('div', { className: 'ds-hint' }, 'no verdict — ' + String(review.notes || ''))
                      : h('div', { className: 'ds-hint' }, String(review.notes || '') + ' · ' + (review.model || 'model') + (review.transport ? ' · via ' + review.transport : ''))
                    : null,
                ),
                workspaceTab === 'settings'
                  ? h('div', { className: 'ds-workspace-settings' }, h(SettingsView))
                  : null,
                workspaceTab === 'assets'
                  ? h(
                      'div',
                      { className: 'ds-workspace-assets' },
                      h(AssetsModal, {
                        key: 'assets-embed-' + selected,
                        slug: selected,
                        frozen: !!(sel && sel.frozen),
                        embedded: true,
                        onClose: () => setWorkspaceTab('agent'),
                      }),
                    )
                  : null,
                workspaceTab === 'styles'
                  ? h(
                      'div',
                      { className: 'ds-workspace-styles' },
                      h(StyleAtlas, {
                        key: 'styles-' + selected,
                        slug: selected,
                        frozen: !!(sel && sel.frozen),
                        sessionId,
                        onPreview: previewStyle,
                        onTour: startStyleTour,
                        onChanged: reloadAfterStyle,
                        onCreated: handleStyleCreated,
                      }),
                    )
                  : null,
                workspaceTab === 'history'
                  ? h(
                      'div',
                      { className: 'ds-workspace-history' },
                      h(HistoryPanel, { key: 'history-' + selected, slug: selected, frozen: !!(sel && sel.frozen), onChanged: reloadAfterHistory }),
                    )
                  : null,
              ),
            )
          )
          : h('div', { className: 'ds-empty' }, 'Select a design system.'),
        // ---- footer status (honest values only) ----
        h(
          'div',
          { className: 'ds-foot' },
          h(
            'div',
            { style: { display: 'flex', gap: '18px', alignItems: 'center' } },
            h('span', { className: 'ds-caps' }, 'design systems: ' + (systems ? systems.length : '—')),
            h('span', { className: 'ds-caps' }, 'selected files: ' + (sel ? sel.count : '—')),
            h('span', { className: 'ds-caps' }, 'key: ' + (keyState && keyState.configured ? 'configured' : 'no key')),
            h('span', { className: 'ds-caps' }, 'transport: ' + (harnessState && harnessState.vision && harnessState.vision.available ? 'harness' : 'openrouter')),
          ),
          h(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
            h('span', { className: 'ds-status-pill' }, h('span', { className: 'dot' }), h('span', { className: 'ds-caps good' }, 'studio live')),
            h('span', { className: 'ds-caps' }, 'preview /design-studio/' + (sel ? sel.slug : '<slug>') + '/html/index.html'),
          ),
        ),
        sel && freezeOpen
          ? h(
              'div',
              {
                className: 'ds-modal-backdrop',
                onClick: (e) => {
                  if (e.target === e.currentTarget && busy === '') setFreezeOpen(false)
                },
              },
              h(
                'div',
                { className: 'ds-modal ds-freeze-modal' },
                h('div', { className: 'ds-modal-title' }, h('span', null, '❄ Finish & freeze design'), h('span', { className: 'ds-sel-path' }, sel.slug)),
                h('p', { className: 'ds-hint' }, 'Freeze this mockup as the source of truth. Studio writes, styles, assets, history restores and design-agent edits are blocked until you explicitly thaw it. The implementation project defaults to the current project; pick another from the list or use Other path.'),
                h(
                  'label',
                  { className: 'ds-field' },
                  h('span', null, 'Implementation project'),
                  projectLoading
                    ? h('span', { className: 'ds-hint' }, 'Detecting this project…')
                    : freezeCustom || !projectOptions.length
                      ? h('input', { className: 'ds-input', placeholder: 'Project path (optional — defaults to this project)', value: freezeTarget, onChange: (e) => setFreezeTarget(e.target.value) })
                      : h(
                          'select',
                          {
                            className: 'ds-select',
                            value: freezeTarget,
                            onChange: (e) => {
                              if (e.target.value === '__custom__') {
                                setFreezeCustom(true)
                                setFreezeTarget('')
                              } else {
                                setFreezeTarget(e.target.value)
                              }
                            },
                          },
                          projectOptions.map((option) => h('option', { key: option.path, value: option.path }, option.label + ' — ' + option.path)),
                          h('option', { value: '__custom__' }, 'Other path…'),
                        ),
                  freezeCustom && projectOptions.length
                    ? h('button', { type: 'button', className: 'ds-chip', onClick: () => { setFreezeCustom(false); setFreezeTarget(projectOptions[0].path) } }, 'Use this project')
                    : null,
                ),
                h('label', { className: 'ds-field' }, h('span', null, 'Handoff note (optional)'), h('textarea', { className: 'ds-modal-input', placeholder: 'Constraints, branch, or what to implement first…', value: freezeNote, onChange: (e) => setFreezeNote(e.target.value) })),
                h('div', { className: 'ds-row' },
                  Btn({ label: '❄ Freeze design', primary: true, onClick: freezeDesign, disabled: busy !== '' || projectLoading }),
                  Btn({ label: 'Cancel', onClick: () => setFreezeOpen(false), disabled: busy !== '' }),
                ),
                h('span', { className: 'ds-hint' }, 'The freeze captures a final snapshot and refreshes the zip. It does not copy or modify the implementation.'),
              ),
            )
          : null,
        sel && thawOpen
          ? h(
              'div',
              {
                className: 'ds-modal-backdrop',
                onClick: (e) => {
                  if (e.target === e.currentTarget && busy === '') setThawOpen(false)
                },
              },
              h(
                'div',
                { className: 'ds-modal ds-freeze-modal' },
                h('div', { className: 'ds-modal-title' }, h('span', null, '🔓 Thaw design?'), h('span', { className: 'ds-sel-path' }, sel.slug)),
                h('p', { className: 'ds-hint' }, 'This re-enables Design Studio edits, styles, assets, history restores and the design agent. Only thaw when the design itself needs to change; implementation work should stay in the frozen target.'),
                h('div', { className: 'ds-row' },
                  Btn({ label: '🔓 Thaw design', primary: true, onClick: thawDesign, disabled: busy !== '' }),
                  Btn({ label: 'Keep frozen', onClick: () => setThawOpen(false), disabled: busy !== '' }),
                ),
              ),
            )
          : null,
        assetsOpen && selected
          ? h(AssetsModal, {
              key: 'assets-modal-' + selected,
              slug: selected,
              frozen: !!(sel && sel.frozen),
              onClose: () => {
                setAssetsOpen(false)
                loadAssets().catch(function () {})
              },
            })
          : null,
      )
    }

    // ---- settings.js ----
    // ================= settings section =================
    function SettingsView() {
      const [key, setKey] = React.useState(null)
      const [harness, setHarness] = React.useState(null)
      const [agentPresets, setAgentPresets] = React.useState([])
      const [form, setForm] = React.useState(null)
      const [keyValue, setKeyValue] = React.useState('')
      const [presets, setPresets] = React.useState(null)
      const [pf, setPf] = React.useState(null)
      const [applySlug, setApplySlug] = React.useState('')
      const [systems, setSystems] = React.useState([])
      const [log, setLog] = React.useState('')
      const [err, setErr] = React.useState('')
      const [busy, setBusy] = React.useState('')

      function clone(value) {
        return JSON.parse(JSON.stringify(value))
      }

      async function refresh(opts) {
        const request = opts && opts.refresh ? { refresh: true } : {}
        const c = await call('studio.config', request)
        if (c.ok && c.data) {
          setKey(c.data.key)
          setHarness(c.data.harness || null)
          setAgentPresets(Array.isArray(c.data.agentPresets) ? c.data.agentPresets : [])
          setForm(clone(c.data.config))
        } else {
          setErr(c.error || 'config load failed')
        }
        const p = await call('studio.presets')
        if (p.ok) setPresets(p.data)
        const s = await call('studio.list', {})
        if (s.ok) setSystems(s.data)
      }

      React.useEffect(() => {
        refresh().catch((e) => setErr(String((e && e.message) || e)))
      }, [])

      function setFormValue(name, value) {
        setForm((prev) => {
          const next = clone(prev || {})
          const parts = String(name).split('.')
          let target = next
          for (let i = 0; i < parts.length - 1; i++) {
            if (!target[parts[i]] || typeof target[parts[i]] !== 'object') target[parts[i]] = {}
            target = target[parts[i]]
          }
          target[parts[parts.length - 1]] = value
          return next
        })
      }

      async function saveConfig() {
        if (!form) return
        setBusy('saving…')
        setErr('')
        try {
          const res = await call('studio.config.save', { patch: form })
          if (!res.ok) {
            setErr(res.error || 'save failed')
            return
          }
          setForm(clone(res.data))
          setLog('settings saved — applies to the next review, capture or agent turn')
        } catch (e) {
          setErr(String((e && e.message) || e))
        } finally {
          setBusy('')
        }
      }

      async function refreshStatus() {
        setBusy('refreshing…')
        setErr('')
        try {
          const c = await call('studio.config', { refresh: true })
          if (!c.ok || !c.data) {
            setErr(c.error || 'status refresh failed')
            return
          }
          setKey(c.data.key)
          setHarness(c.data.harness || null)
          setAgentPresets(Array.isArray(c.data.agentPresets) ? c.data.agentPresets : [])
          setForm(clone(c.data.config))
          setLog('vision status refreshed')
        } catch (e) {
          setErr(String((e && e.message) || e))
        } finally {
          setBusy('')
        }
      }

      async function saveKeyAction() {
        setBusy('saving key…')
        setErr('')
        try {
          const res = await call('studio.config.setKey', { value: keyValue })
          if (!res.ok) {
            setErr(res.error || 'key save failed')
            return
          }
          setKey(res.data)
          setKeyValue('')
          setLog('key stored (its value is never rendered or logged)')
        } catch (e) {
          setErr(String((e && e.message) || e))
        } finally {
          setBusy('')
        }
      }

      async function clearKeyAction() {
        setBusy('clearing key…')
        setErr('')
        try {
          const res = await call('studio.config.clearKey', {})
          if (!res.ok) {
            setErr(res.error || 'clear failed')
            return
          }
          setKey(res.data)
          setLog('key removed')
        } catch (e) {
          setErr(String((e && e.message) || e))
        } finally {
          setBusy('')
        }
      }

      function blankPreset() {
        return {
          id: '',
          name: '',
          colors: { bg: '', panel: '', panel2: '', border: '', text: '', muted: '', accent: '', ok: '', warn: '', err: '', info: '' },
          radius: '',
          spacing: '',
          fonts: { body: '', display: '', mono: '' },
        }
      }

      function loadPreset(p) {
        setPf({
          id: p.id || '',
          name: p.name || '',
          colors: {
            bg: p.colors && p.colors.bg ? p.colors.bg : '',
            panel: p.colors && p.colors.panel ? p.colors.panel : '',
            panel2: p.colors && p.colors.panel2 ? p.colors.panel2 : '',
            border: p.colors && p.colors.border ? p.colors.border : '',
            text: p.colors && p.colors.text ? p.colors.text : '',
            muted: p.colors && p.colors.muted ? p.colors.muted : '',
            accent: p.colors && p.colors.accent ? p.colors.accent : '',
            ok: p.colors && p.colors.ok ? p.colors.ok : '',
            warn: p.colors && p.colors.warn ? p.colors.warn : '',
            err: p.colors && p.colors.err ? p.colors.err : '',
            info: p.colors && p.colors.info ? p.colors.info : '',
          },
          radius: p.radius || '',
          spacing: p.spacing === null || p.spacing === undefined ? '' : String(p.spacing),
          fonts: {
            body: p.fonts && p.fonts.body ? p.fonts.body : '',
            display: p.fonts && p.fonts.display ? p.fonts.display : '',
            mono: p.fonts && p.fonts.mono ? p.fonts.mono : '',
          },
        })
      }

      function setPfValue(name, value) {
        setPf((prev) => {
          const next = clone(prev || blankPreset())
          const parts = name.split('.')
          if (parts.length === 2) next[parts[0]][parts[1]] = value
          else next[name] = value
          return next
        })
      }

      async function savePresetAction() {
        if (!pf) return
        setBusy('saving preset…')
        setErr('')
        try {
          const clean = {}
          for (const k of Object.keys(pf.colors)) {
            if (pf.colors[k] && pf.colors[k].trim()) clean[k] = pf.colors[k].trim()
          }
          const fonts = {}
          for (const k of Object.keys(pf.fonts)) {
            if (pf.fonts[k] && pf.fonts[k].trim()) fonts[k] = pf.fonts[k].trim()
          }
          const preset = { id: String(pf.id || '').trim(), name: String(pf.name || '').trim(), colors: clean }
          if (pf.radius && pf.radius.trim()) preset.radius = pf.radius.trim()
          if (pf.spacing && pf.spacing.trim() !== '') preset.spacing = Number(pf.spacing)
          if (Object.keys(fonts).length) preset.fonts = fonts
          const res = await call('studio.preset.save', { preset })
          if (!res.ok) {
            setErr(res.error || 'preset save failed')
            return
          }
          setLog('preset ' + res.data.id + ' saved (version ' + res.data.version + ')')
          await refresh()
        } catch (e) {
          setErr(String((e && e.message) || e))
        } finally {
          setBusy('')
        }
      }

      async function deletePresetAction() {
        if (!pf || !pf.id) return
        setBusy('deleting…')
        setErr('')
        try {
          const res = await call('studio.preset.delete', { id: pf.id })
          if (!res.ok) {
            setErr(res.error || 'delete failed')
            return
          }
          setPf(null)
          setLog('preset removed')
          await refresh()
        } catch (e) {
          setErr(String((e && e.message) || e))
        } finally {
          setBusy('')
        }
      }

      async function applyPresetAction() {
        if (!pf || !pf.id || !applySlug) return
        setBusy('applying…')
        setErr('')
        try {
          const res = await call('studio.preset.apply', { slug: applySlug, presetId: pf.id })
          if (!res.ok) {
            setErr(res.error || 'apply failed')
            return
          }
          setLog(
            'applied to ' + applySlug + ': ' + res.data.tokenCss +
              (res.data.copied.length ? ' + logos ' + res.data.copied.join(', ') : '') +
              (res.data.missing.length ? ' — missing (skipped honestly): ' + res.data.missing.join(', ') : ''),
          )
        } catch (e) {
          setErr(String((e && e.message) || e))
        } finally {
          setBusy('')
        }
      }

      if (!form) {
        return h(
          'div',
          { className: 'ds-settings' },
          Err({ text: err }),
          h('div', { className: 'ds-empty' }, 'Loading Design Studio settings…'),
        )
      }

      const vision = harness && harness.vision ? harness.vision : null
      const harnessActive = Boolean(vision && vision.available)
      const transport = form.visionTransport || 'auto'
      const reviewStyle = form.reviewStyle || 'strict'
      const effort = form.effort || 'off'
      const capture = form.capture || { width: 1440, height: 1700 }
      const fields = ['bg', 'panel', 'panel2', 'border', 'text', 'muted', 'accent', 'ok', 'warn', 'err', 'info']
      const keyLine = key
        ? key.supported
          ? key.configured
            ? 'Key configured (source ' + (key.source || '?') + (key.writable ? ', writable' : ', read-only source') + '). Value never rendered.'
            : 'No fallback key configured (reference OPENROUTER_API_KEY).'
          : 'Credential service unavailable in this host.'
        : 'Checking key status…'

      const statusChip = h(
        'span',
        { className: 'ds-status-chip ' + (harnessActive ? 'ok' : 'warn') },
        harnessActive ? 'Harness vision' : 'Fallback only',
      )

      const transportOptions = [
        ['auto', 'Auto'],
        ['harness', 'Harness'],
        ['openrouter', 'OpenRouter'],
      ]

      const visionCard = h(
        'section',
        { className: 'ds-section' },
        h(
          'div',
          { className: 'ds-card-head' },
          h('div', null, h('h3', null, 'Vision'), h('p', { className: 'ds-hint' }, 'Reviews and image reads.')),
          statusChip,
        ),
        h(
          'div',
          { className: 'ds-vision-status' },
          h('div', { className: 'ds-kv' }, h('span', { className: 'ds-k' }, 'Current model'), h('span', { className: 'ds-v' }, vision ? vision.provider + '/' + vision.model : '—')),
          h('div', { className: 'ds-kv' }, h('span', { className: 'ds-k' }, 'Input'), h('span', { className: 'ds-v' }, vision && vision.modalities && vision.modalities.length ? vision.modalities.join(' + ') : 'unknown')),
          h('div', { className: 'ds-kv' }, h('span', { className: 'ds-k' }, 'Harness key'), h('span', { className: 'ds-v' }, harnessActive ? 'not needed' : 'OpenRouter fallback')),
        ),
        h(
          'div',
          { className: 'ds-grid ds-grid-3' },
          h(
            'label',
            { className: 'ds-field' },
            h('span', { className: 'ds-field-label' }, 'Vision transport'),
            h(
              'div',
              { className: 'ds-segmented', role: 'group', 'aria-label': 'Vision transport' },
              transportOptions.map(([value, label]) =>
                h(
                  'button',
                  {
                    key: value,
                    type: 'button',
                    className: 'ds-seg' + (transport === value ? ' on' : ''),
                    'aria-pressed': transport === value ? 'true' : 'false',
                    onClick: () => setFormValue('visionTransport', value),
                  },
                  label,
                ),
              ),
            ),
          ),
          h(
            'label',
            { className: 'ds-field' },
            h('span', { className: 'ds-field-label' }, 'Review style'),
            h(
              'select',
              { className: 'ds-select', value: reviewStyle, onChange: (e) => setFormValue('reviewStyle', e.target.value) },
              [['strict', 'Strict — catch visual defects'], ['balanced', 'Balanced — clear issues only'], ['lenient', 'Lenient — broken only']].map(([value, label]) =>
                h('option', { key: value, value }, label),
              ),
            ),
          ),
          h(
            'label',
            { className: 'ds-field' },
            h('span', { className: 'ds-field-label' }, 'Reasoning effort'),
            h(
              'select',
              { className: 'ds-select', value: effort, onChange: (e) => setFormValue('effort', e.target.value) },
              [['auto', 'Auto (model default)'], ['off', 'Off'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['max', 'Max']].map(([value, label]) =>
                h('option', { key: value, value }, label),
              ),
            ),
          ),
        ),
        h(
          'p',
          { className: 'ds-hint' },
          harnessActive
            ? 'The harness model sees images directly; the OpenRouter key is only a fallback. Capture renders the actual served preview at the viewport below.'
            : 'The current model does not advertise image input. Configure the OpenRouter fallback below, or switch to a vision-capable model in Settings → Models.',
        ),
      )

      const captureCard = h(
        'section',
        { className: 'ds-section' },
        h(
          'div',
          { className: 'ds-card-head' },
          h('div', null, h('h3', null, 'Capture'), h('p', { className: 'ds-hint' }, 'Headless Edge / Chrome renders the served preview.')),
          h('span', { className: 'ds-status-chip' }, 'optional'),
        ),
        h(
          'div',
          { className: 'ds-grid ds-grid-2' },
          Field({ label: 'Viewport width (px)', value: String(capture.width), type: 'number', onChange: (v) => setFormValue('capture.width', Number(v)) }),
          Field({ label: 'Viewport height (px)', value: String(capture.height), type: 'number', onChange: (v) => setFormValue('capture.height', Number(v)) }),
        ),
        h('p', { className: 'ds-hint' }, '640–2560 wide, 720–3000 tall. The snapshot action returns the image to the model and saves it under assets/images/.'),
      )

      const behaviorCard = h(
        'section',
        { className: 'ds-section' },
        h(
          'div',
          { className: 'ds-card-head' },
          h('div', null, h('h3', null, 'Behavior'), h('p', { className: 'ds-hint' }, 'Design agent and lifecycle.')),
        ),
        h(
          'div',
          { className: 'ds-grid ds-grid-2' },
          h(
            'label',
            { className: 'ds-field' },
            h('span', { className: 'ds-field-label' }, 'Design agent preset'),
            h(
              'select',
              { className: 'ds-select', value: form.agentPreset || '', onChange: (e) => setFormValue('agentPreset', e.target.value) },
              [h('option', { key: '', value: '' }, 'Inherit current agent')].concat(
                agentPresets.map((preset) =>
                  h('option', { key: preset.id, value: preset.id }, preset.name + (preset.name !== preset.id ? ' · ' + preset.id : '')),
                ),
              ),
            ),
            h('span', { className: 'ds-hint' }, agentPresets.length ? 'Spawn-provider children only.' : 'No presets discovered; the child inherits the current agent.'),
          ),
          h(
            'label',
            { className: 'ds-field' },
            h('span', { className: 'ds-field-label' }, 'Auto-verify after Ask DeepSeek'),
            h(
              'label',
              { className: 'ds-check' },
              h('input', {
                type: 'checkbox',
                checked: form.autoVerify !== false,
                onChange: (e) => setFormValue('autoVerify', e.target.checked),
              }),
              'Run a design-agent verification when the coding agent’s edits settle',
            ),
          ),
          h(
            'label',
            { className: 'ds-field' },
            h('span', { className: 'ds-field-label' }, 'Lifecycle'),
            h(
              'label',
              { className: 'ds-check' },
              h('input', {
                type: 'checkbox',
                checked: Boolean(form.autoDeleteWithSession),
                onChange: (e) => setFormValue('autoDeleteWithSession', e.target.checked),
              }),
              'Delete a design system when its chat is deleted (default off)',
            ),
          ),
        ),
      )

      const fallbackCard = h(
        'details',
        { className: 'ds-disclosure', open: !harnessActive },
        h(
          'summary',
          null,
          'OpenRouter fallback',
          h('span', { className: 'ds-hint' }, key && key.configured ? 'key configured' : 'no key'),
        ),
        h(
          'div',
          { className: 'ds-disclosure-body' },
          h('p', { className: 'ds-note' }, 'Only used when the harness route cannot accept images, or when you force OpenRouter above. The key is a credential reference and its value is never rendered.'),
          h('div', { className: 'ds-row' }, h('span', { className: 'ds-hint' }, keyLine)),
          h(
            'div',
            { className: 'ds-row' },
            h('input', {
              className: 'ds-input',
              type: 'password',
              placeholder: key && key.configured ? '•••••• — key stored (paste a new one to replace)' : 'no key — paste an OpenRouter fallback key',
              value: keyValue,
              onChange: (e) => setKeyValue(e.target.value),
              autoComplete: 'off',
            }),
            Btn({ label: 'Save key', onClick: saveKeyAction, disabled: busy !== '' }),
            Btn({ label: 'Clear key', onClick: clearKeyAction, disabled: busy !== '' }),
          ),
          Field({
            label: 'Fallback models (comma-separated)',
            value: listVal(form.visionModels),
            onChange: (v) => setFormValue('visionModels', v),
            hint: 'failed models cool down 10 min; when all are cooling they are all tried anyway',
          }),
          h(
            'details',
            { className: 'ds-disclosure ds-nested' },
            h('summary', null, 'Advanced request options'),
            h(
              'div',
              { className: 'ds-disclosure-body' },
              h(
                'div',
                { className: 'ds-grid ds-grid-2' },
                Field({ label: 'Temperature', value: String(form.options.temperature), type: 'number', onChange: (v) => setFormValue('options.temperature', Number(v)) }),
                Field({ label: 'max_tokens cap', value: String(form.options.maxTokens), type: 'number', onChange: (v) => setFormValue('options.maxTokens', Number(v)) }),
                Field({ label: 'Base URL', value: form.options.baseUrl, onChange: (v) => setFormValue('options.baseUrl', v) }),
                Field({ label: 'Quantizations (comma-separated)', value: listVal(form.options.quantizations), onChange: (v) => setFormValue('options.quantizations', v) }),
                Field({ label: 'Only providers (comma-separated, empty = any)', value: listVal(form.options.onlyProviders), onChange: (v) => setFormValue('options.onlyProviders', v) }),
              ),
              h(
                'label',
                { className: 'ds-field' },
                h('span', { className: 'ds-field-label' }, 'Provider routing'),
                h(
                  'label',
                  { className: 'ds-check' },
                  h('input', { type: 'checkbox', checked: Boolean(form.options.providerRouting), onChange: (e) => setFormValue('options.providerRouting', e.target.checked) }),
                  'sort=throughput routing',
                ),
                h(
                  'label',
                  { className: 'ds-check' },
                  h('input', { type: 'checkbox', checked: Boolean(form.options.allowFallbacks), onChange: (e) => setFormValue('options.allowFallbacks', e.target.checked) }),
                  'allow_fallbacks',
                ),
                h(
                  'label',
                  { className: 'ds-check' },
                  h('input', { type: 'checkbox', checked: Boolean(form.options.includeUsage), onChange: (e) => setFormValue('options.includeUsage', e.target.checked) }),
                  'include_usage',
                ),
                h(
                  'label',
                  { className: 'ds-check' },
                  h('input', { type: 'checkbox', checked: Boolean(form.options.reasoningExclude), onChange: (e) => setFormValue('options.reasoningExclude', e.target.checked) }),
                  'reasoning.exclude',
                ),
              ),
            ),
          ),
        ),
      )

      const presetsCard = h(
        'details',
        { className: 'ds-disclosure' },
        h(
          'summary',
          null,
          'Identity presets',
          h('span', { className: 'ds-hint' }, presets ? presets.length + ' saved' : 'loading…'),
        ),
        h(
          'div',
          { className: 'ds-disclosure-body' },
          presets === null
            ? h('div', { className: 'ds-hint' }, 'loading…')
            : presets.length === 0
              ? h('div', { className: 'ds-hint' }, 'No presets yet — create one below.')
              : h(
                  'div',
                  { className: 'ds-preset-list' },
                  presets.map((p) =>
                    h(
                      'div',
                      { key: p.id, className: 'ds-preset-item', onClick: () => loadPreset(p) },
                      h('span', null, p.name, h('span', { className: 'ds-hint' }, ' · ' + p.id)),
                      h(
                        'span',
                        null,
                        ['bg', 'panel', 'text', 'accent', 'ok', 'warn', 'err'].map((k) =>
                          p.colors && p.colors[k] && typeof p.colors[k] === 'string' && p.colors[k].indexOf('#') === 0
                            ? h('span', { key: k, className: 'ds-colorchip', style: { backgroundColor: p.colors[k] } })
                            : null,
                        ),
                      ),
                    ),
                  ),
                ),
          pf
            ? h(
                'div',
                { className: 'ds-grid ds-grid-2' },
                Field({ label: 'Preset id (slug)', value: pf.id, onChange: (v) => setPfValue('id', v) }),
                Field({ label: 'Name', value: pf.name, onChange: (v) => setPfValue('name', v) }),
                Field({ label: 'Radius (e.g. 12px)', value: pf.radius, onChange: (v) => setPfValue('radius', v) }),
                Field({ label: 'Spacing (px number)', value: pf.spacing, onChange: (v) => setPfValue('spacing', v) }),
                Field({ label: 'fonts.body', value: pf.fonts.body, onChange: (v) => setPfValue('fonts.body', v) }),
                Field({ label: 'fonts.display', value: pf.fonts.display, onChange: (v) => setPfValue('fonts.display', v) }),
                Field({ label: 'fonts.mono', value: pf.fonts.mono, onChange: (v) => setPfValue('fonts.mono', v) }),
              )
            : null,
          pf
            ? h(
                'details',
                { className: 'ds-disclosure ds-nested' },
                h('summary', null, 'Palette tokens'),
                h(
                  'div',
                  { className: 'ds-disclosure-body ds-grid ds-grid-2' },
                  fields.map((k) =>
                    Field({ key: k, label: 'colors.' + k, value: pf.colors[k] || '', placeholder: '#rrggbb', onChange: (v) => setPfValue('colors.' + k, v) }),
                  ),
                ),
              )
            : null,
          h(
            'div',
            { className: 'ds-row' },
            Btn({ label: 'New preset', onClick: () => setPf(blankPreset()), disabled: busy !== '' }),
            Btn({ label: 'Save preset', primary: true, onClick: savePresetAction, disabled: busy !== '' || !pf }),
            Btn({ label: 'Delete preset', onClick: deletePresetAction, disabled: busy !== '' || !pf || !pf.id }),
            h('span', { className: 'ds-toolbar-gap' }),
            h(
              'select',
              { className: 'ds-select', value: applySlug, onChange: (e) => setApplySlug(e.target.value) },
              h('option', { value: '' }, 'design system to apply to…'),
              systems.map((s) => h('option', { key: s.slug, value: s.slug }, s.slug)),
            ),
            Btn({ label: 'Apply → token.css', onClick: applyPresetAction, disabled: busy !== '' || !pf || !pf.id || !applySlug }),
          ),
          h('span', { className: 'ds-hint' }, 'Apply writes css/token.css and copies only the logo files the preset store actually holds.'),
        ),
      )

      return h(
        'div',
        { className: 'ds-settings' },
        h(
          'div',
          { className: 'ds-settings-head' },
          h('div', null, h('h3', null, 'Design Studio'), h('p', { className: 'ds-hint' }, 'Vision, capture and agent behavior for this profile.')),
          h(
            'div',
            { className: 'ds-row' },
            Btn({ label: busy || 'Save changes', primary: true, onClick: saveConfig, disabled: busy !== '' }),
            Btn({ label: 'Refresh status', onClick: refreshStatus, disabled: busy !== '' }),
          ),
        ),
        Err({ text: err }),
        Log({ text: log }),
        visionCard,
        captureCard,
        behaviorCard,
        fallbackCard,
        presetsCard,
      )
    }

    // ================= all-designs settings section =================
    function AllDesignsView() {
      const [all, setAll] = React.useState(null)
      const [err, setErr] = React.useState('')
      const [busy, setBusy] = React.useState('')
      const [log, setLog] = React.useState('')
      const [confirmSlug, setConfirmSlug] = React.useState('')

      async function refresh() {
        const a = await call('studio.list', {})
        if (a.ok) setAll(a.data)
        else setErr(a.error || 'list failed')
      }

      React.useEffect(() => {
        refresh().catch((e) => setErr(String((e && e.message) || e)))
      }, [])

      async function doDelete(slug) {
        if (confirmSlug !== slug) {
          setConfirmSlug(slug)
          return
        }
        setConfirmSlug('')
        setBusy('deleting…')
        setErr('')
        try {
          const res = await call('studio.delete', { slug })
          if (!res.ok) {
            setErr(res.error || 'delete failed')
            return
          }
          setLog('deleted ' + slug + ' (folder, zip, reviews, agent history)')
          await refresh()
        } catch (e) {
          setErr(String((e && e.message) || e))
        } finally {
          setBusy('')
        }
      }

      async function doSweep() {
        setBusy('sweeping…')
        setErr('')
        try {
          const res = await call('studio.sweep', {})
          if (!res.ok) {
            setErr(res.error || 'sweep failed')
            return
          }
          setLog(res.data.note + (res.data.swept.length ? ' — removed: ' + res.data.swept.join(', ') : ''))
          await refresh()
        } catch (e) {
          setErr(String((e && e.message) || e))
        } finally {
          setBusy('')
        }
      }

      return h(
        'div',
        { className: 'ds-settings' },
        h(
          'div',
          { className: 'ds-settings-head' },
          h('div', null, h('h3', null, 'All designs'), h('p', { className: 'ds-hint' }, 'Every registered design system, across workspaces and conversations. Legacy profile designs remain listed.')),
          Btn({ label: 'Refresh', onClick: refresh, disabled: busy !== '' }),
        ),
        Err({ text: err }),
        Log({ text: busy || log }),
        h(
          'div',
          { className: 'ds-section' },
          all === null
            ? h('div', { className: 'ds-hint' }, 'loading…')
            : all.length === 0
              ? h('div', { className: 'ds-empty' }, 'No design systems anywhere yet.')
              : all.map((s) =>
                  h(
                    'div',
                    { key: s.slug, className: 'ds-preset-item' },
                    h(
                      'span',
                      null,
                      h('b', null, s.slug),
                      h(
                        'span',
                        { className: 'ds-hint' },
                        ' · chat: ' +
                          (s.sessionId ? (s.orphan ? 'deleted (was ' + s.sessionId + ')' : s.sessionId) : 'none (unbound legacy)') +
                          ' · ' + s.count + ' file' + (s.count === 1 ? '' : 's') +
                          (s.frozen ? ' · frozen' : '') +
                          (s.root ? ' · ' + s.root : '') +
                          (s.createdAt ? ' · created ' + String(s.createdAt).slice(0, 10) : ''),
                      ),
                    ),
                    h(
                      'span',
                      { className: 'ds-row' },
                      s.orphan ? h('span', { className: 'ds-badge amber' }, 'orphaned') : null,
                      s.frozen ? h('span', { className: 'ds-badge amber' }, 'frozen') : null,
                      Btn({ label: confirmSlug === s.slug ? 'Confirm delete?' : 'Delete', onClick: () => doDelete(s.slug), disabled: busy !== '' || !!s.frozen, title: s.frozen ? 'Thaw this design before deleting it' : '' }),
                    ),
                  ),
                ),
          h(
            'div',
            { className: 'ds-row' },
            Btn({ label: 'Sweep orphans now', onClick: doSweep, disabled: busy !== '' }),
            h('span', { className: 'ds-hint' }, 'Sweep only deletes when auto-delete is ON (Design Studio → Behavior); default is never auto-delete.'),
          ),
        ),
      )
    }

    // ---- index.js ----
    const inject = ['slots']

    function apply(ctx) {
      const slots = ctx.slots
      if (slots === undefined) return

      runtime.ctx = ctx

      // Optional locale seat: the tab/section labels follow the active language
      // without a remount. The rest of the studio UI is English-only.
      let t = (key) => labelsEn[key] || key
      const locale = ctx.get('locale')
      if (locale && typeof locale.register === 'function' && typeof locale.bind === 'function') {
        ctx.effect(() => locale.register('dsh-design-studio', 'en', labelsEn))
        ctx.effect(() => locale.register('dsh-design-studio', 'zh', labelsZh))
        t = locale.bind('dsh-design-studio')
      }
      runtime.t = t

      // One style tag for the plugin's classes; owned by apply(), not the factory.
      if (typeof document !== 'undefined') {
        ctx.effect(() => installCss(DS_CSS))
      }

      slots.inject('conversation.view', () =>
        slots.register({
          name: 'conversation.view',
          id: 'design-studio',
          order: 20,
          label: () => t('tab.designStudio'),
        }, StudioView),
      )
      slots.inject('settings.section', () =>
        slots.register({ name: 'settings.section', id: 'all-designs', order: 14, label: () => t('section.allDesigns') }, AllDesignsView),
      )
      slots.inject('settings.section', () =>
        slots.register({ name: 'settings.section', id: 'design-studio', order: 25, label: () => t('section.designStudio') }, SettingsView),
      )
    }

    exports.inject = inject
    exports.apply = apply
    return module.exports
  },
})
