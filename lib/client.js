// Design Studio — CLIENT half (persistent dsh.client bundle, plain JS module-loader
// format — the same hand-written shape the shipped harness client packages use; no
// build step). Registered slots: conversation.view (id design-studio),
// settings.section (ids all-designs + design-studio). All data flows through
// same-origin fetch to the bundle host's /design-studio/__api/* JSON endpoints.
window.__ModuleLoader__.load({
  id: '@sal7one/dsh-design-studio',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const React = require('react')
    const h = React.createElement

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

    const inject = ['slots']

    function apply(ctx) {
      const slots = ctx.slots
      if (slots === undefined) return

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
          // ---------- main grid ----------
          '.ds-main{display:grid;grid-template-columns:240px minmax(0,1fr) 450px;gap:16px;padding:20px 24px 16px;min-height:0}',
          '.ds-col{display:flex;flex-direction:column;gap:16px;min-width:0}',
          // ---------- outline side panel ----------
          '.ds-outline{position:sticky;top:0;max-height:calc(100vh - 140px);overflow:auto;display:flex;flex-direction:column}',
          '.ds-outline-body{padding:10px 12px;display:flex;flex-direction:column;gap:6px}',
          '.ds-outline-file{font-family:ui-monospace,"JetBrains Mono",monospace;font-size:11px;font-weight:700;color:var(--ds-accent);margin-top:6px}',
          '.ds-outline-item{padding:3px 8px;border-left:2px solid var(--ds-border2);font-size:11px;color:var(--ds-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
          '.ds-outline-item.section{color:var(--ds-warn)}',
          '.ds-outline-item.heading{color:var(--ds-text)}',
          // ---------- preview card ----------
          '.ds-preview-card{display:flex;flex-direction:column;min-height:620px;overflow:hidden;flex:1}',
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
          '.ds-frame-holder{flex:1;background:var(--ds-bg);display:flex;align-items:center;justify-content:center;padding:14px;min-height:0}',
          '.ds-frame{width:100%;height:100%;min-height:520px;border:1px solid var(--ds-border);border-radius:4px;background:#fff}',
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
          '.ds-check{display:flex;gap:6px;align-items:center;font-size:12px}',
          '.ds-preset-list{display:flex;flex-direction:column;gap:6px;max-height:200px;overflow:auto}',
          '.ds-preset-item{border:1px solid var(--dsw-alias-border-l1);border-radius:6px;padding:8px 10px;cursor:pointer;display:flex;justify-content:space-between;gap:8px;align-items:center;background:transparent}',
          '.ds-preset-item:hover{border-color:var(--dsw-alias-brand-primary)}',
          '.ds-colorchip{display:inline-block;width:10px;height:10px;border-radius:3px;border:1px solid var(--dsw-alias-border-l2);margin-right:2px;vertical-align:middle}',
          '.ds-runpanel{display:flex;flex-direction:column;gap:6px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);font-size:12px;color:var(--dsw-alias-label-primary)}',
          '.ds-runpanel-title{font-weight:700}',
          '.ds-runpanel-body{display:flex;flex-direction:column;gap:4px;color:var(--dsw-alias-label-secondary)}',
          '@media (max-width:1180px){.ds-main{grid-template-columns:1fr}.ds-frame-holder{min-height:520px}}',
        ].join('\n')

    // One style tag for the plugin's classes (theme tokens come from CSS vars).
    function ensureCss() {
      if (typeof document === 'undefined' || document.getElementById('ds-studio-css')) return
      const style = document.createElement('style')
      style.id = 'ds-studio-css'
      style.textContent = DS_CSS
      document.head.appendChild(style)
    }
    ensureCss()

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

    // screen region of the preview iframe (macOS coordinates, for the host screencapture tooling)
    function screenRegionOf(frameEl) {
      try {
        if (!frameEl || typeof window === 'undefined') return null
        const r = frameEl.getBoundingClientRect()
        const chromeH = (window.outerHeight || 0) - (window.innerHeight || 0)
        return {
          x: Math.round((window.screenX || 0) + r.left),
          y: Math.round((window.screenY || 0) + (chromeH > 0 ? chromeH : 0) + r.top),
          w: Math.round(r.width),
          h: Math.round(r.height),
        }
      } catch (_) {
        return null
      }
    }

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

    // ================= workspace view (conversation.view tab) =================
    function StudioView(props) {
      // sessionId arrives as a framework-standard prop; the snapshot hook is the defensive fallback.
      let sessionId = props && props.sessionId ? String(props.sessionId) : ''
      if (!sessionId && props && typeof props.useSession === 'function') {
        try {
          const snap = props.useSession()
          if (snap && snap.sessionId) sessionId = String(snap.sessionId)
        } catch (_) {}
      }
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

      // Keep the agent chat pinned to the newest entry while it works.
      React.useEffect(() => {
        if (agentBodyEl) agentBodyEl.scrollTop = agentBodyEl.scrollHeight
      }, [agentHistory, agentBusy, err])

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

      React.useEffect(() => {
        const onMsg = (ev) => {
          const d = ev.data
          if (!d || d.source !== 'ds-selection') return
          if (d.type === 'select') setSelection(d.payload)
          if (d.type === 'exit') setSelectMode(false)
        }
        window.addEventListener('message', onMsg)
        return () => window.removeEventListener('message', onMsg)
      }, [])

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
          setLog('edit request saved → ' + res.data.path + ' — your coding agent will read it and apply the change')
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
          const res = await call('studio.agent', { slug: selected, message: msg })
          if (!res.ok || !res.data || !res.data.ok) {
            if (res.data && Array.isArray(res.data.history)) setAgentHistory(res.data.history)
            setErr((res.data && res.data.notes) || res.error || 'design agent failed')
            return
          }
          const reply = String(res.data.reply || '')
          setDsReply(reply + '\n\n— design agent (' + (res.data.model || 'harness agent') + ') — files edited')
          setAgentHistory(res.data.history || [])
          setTick(tick + 1) // reload the live preview so the change is visible
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
          setOutline(null)
          return
        }
        call('studio.review.get', { slug: selected })
          .then((r) => setReview(r.ok && r.data ? r.data : null))
          .catch(() => setReview(null))
        call('studio.agent.history', { slug: selected })
          .then((r) => setAgentHistory(r.ok && Array.isArray(r.data) ? r.data : []))
          .catch(() => setAgentHistory([]))
        call('studio.outline', { slug: selected })
          .then((r) => setOutline(r.ok && r.data ? r.data : null))
          .catch(() => setOutline(null))
      }, [selected])

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
        if (!selected || !msg) return
        setAgentBusy(true)
        setErr('')
        try {
          const agentArgs = { slug: selected, message: msg }
          if (agentImage) agentArgs.images = [agentImage]
          const res = await call('studio.agent', agentArgs)
          if (!res.ok || !res.data || !res.data.ok) {
            if (res.data && Array.isArray(res.data.history)) setAgentHistory(res.data.history)
            setErr((res.data && res.data.notes) || res.error || 'design agent failed')
            return
          }
          setAgentHistory(res.data.history || [])
          setAgentMsg('')
          setTick(tick + 1) // the agent edited the files itself — reload the preview
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
          setLog('Finder opened for ' + res.data.revealed)
        } catch (e) {
          setErr(String((e && e.message) || e))
        } finally {
          setBusy('')
        }
      }

      async function captureShot() {
        if (!selected) return
        const scr = screenRegionOf(frameEl)
        if (!scr) {
          setErr('cannot locate the preview on screen — make the Design Studio tab visible and try again')
          return
        }
        setBusy('capturing…')
        setErr('')
        try {
          const res = await call('studio.screenshot', { slug: selected, screen: scr })
          if (!res.ok) {
            setErr(res.error || 'screenshot failed')
            return
          }
          setAgentImage(res.data.dest)
          setLog('screenshot saved → ' + res.data.dest + ' (' + res.data.w + '×' + res.data.h + 'px) — hit 👁 Review to judge it')
          postReviewNote('📸 screenshot captured: ' + res.data.dest)
          await refresh()
        } catch (e) {
          setErr(String((e && e.message) || e))
        } finally {
          setBusy('')
        }
      }

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

      return h(
        'div',
        { className: 'ds-root' },
        // ---- top: title + actions ----
        h(
          'div',
          { className: 'ds-top' },
          h(
            'div',
            { className: 'ds-top-row' },
            h('div', { className: 'ds-title' }, 'Design Studio'),
            h('span', { className: 'ds-caps' }, sessionId ? 'chat ' + String(sessionId).slice(0, 12) + '…' : 'no chat binding'),
            h(
              'div',
              { className: 'ds-actions' },
              Btn({ label: '🗜 Export zip', primary: true, onClick: zipSelected, disabled: busy !== '' || !sel }),
              zipPath ? Btn({ label: 'Open folder', onClick: revealZip, disabled: busy !== '' }) : null,
              zipPath ? h('span', { className: 'ds-hint' }, zipPath) : null,
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
                if (e.key === 'Enter') createSystem()
              },
            }),
            Btn({ label: 'Create', primary: true, onClick: createSystem, disabled: busy !== '' }),
            Btn({ label: 'Refresh', onClick: () => refresh().catch((e) => setErr(String((e && e.message) || e))), disabled: busy !== '' }),
          ),
          systems === null
            ? h('div', { className: 'ds-empty' }, 'Loading design systems…')
            : systems.length === 0
              ? h('div', { className: 'ds-empty' }, 'No design systems in this conversation yet — create one above.')
              : h(
                  'div',
                  { className: 'ds-chips' },
                  systems.map((s) =>
                    h(
                      'button',
                      { key: s.slug, className: 'ds-chip' + (s.slug === selected ? ' on' : ''), onClick: () => setSelected(s.slug) },
                      s.slug,
                      s.hasPreview ? h('span', { className: 'ds-badge green' }, 'preview') : null,
                      s.hasPrompts ? h('span', { className: 'ds-badge blue' }, 'prompts') : null,
                      s.hasTokenCss ? h('span', { className: 'ds-badge amber' }, 'token.css') : null,
                    ),
                  ),
                ),
          Err({ text: err }),
          Log({ text: busy || log }),
        ),
        // ---- main grid: preview | tools ----
        sel
          ? h(
              'div',
              { className: 'ds-main' },
              h(
                'div',
                { className: 'ds-col' },
                h(
                  'div',
                  { className: 'ds-panel ds-outline' },
                  h('div', { className: 'ds-panel-head' }, h('span', { className: 'ds-caps' }, 'Outline'), h('span', { className: 'ds-hint' }, sel.count + ' files')),
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
              h(
                'div',
                { className: 'ds-col' },
                h(
                  'div',
                  { className: 'ds-panel ds-preview-card' },
                  h(
                    'div',
                    { className: 'ds-chrome' },
                    h('div', { className: 'ds-dots' }, h('i', { className: 'ds-dot r' }), h('i', { className: 'ds-dot y' }), h('i', { className: 'ds-dot g' })),
                    h('div', { className: 'ds-url' }, h('span', null, '🔒'), '/design-studio/' + sel.slug + '/html/index.html'),
                    h('div', { className: 'ds-live' }, h('span', { className: 'pulse' }), 'Live'),
                    h('span', { className: 'ds-chrome-gap' }),
                    Btn({ label: selectMode ? '✋ Stop selecting' : '🎯 Select', onClick: () => { setSelectMode(!selectMode); setSelection(null) }, disabled: busy !== '' }),
                    Btn({ label: '↻ Reload', onClick: () => setTick(tick + 1) }),
                    Btn({ label: '📸 Shot', onClick: captureShot, disabled: busy !== '' || !sel.hasPreview }),
                    Btn({ label: '👁 Review', primary: true, onClick: runReview, disabled: busy !== '' }),
                  ),
                  h(
                    'div',
                    { className: 'ds-frame-holder' },
                    sel.hasPreview
                      ? h('iframe', {
                          className: 'ds-frame',
                          key: selected + ':' + tick,
                          ref: setFrameRef,
                          src: '/design-studio/' + selected + '/html/index.html?v=' + tick,
                          title: selected,
                          onLoad: () => {
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
                          h('textarea', {
                            className: 'ds-modal-input',
                            ref: setEditInputRef,
                            placeholder: 'What should change on this element? e.g. make this radius 12px',
                            value: editMsg,
                            onChange: (e) => setEditMsg(e.target.value),
                            onKeyDown: (e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                saveSelection()
                              }
                            },
                          }),
                          dsReply ? h('div', { className: 'ds-modal-reply' }, String(dsReply)) : null,
                          h(
                            'div',
                            { className: 'ds-row' },
                            Btn({ label: '◈ Ask Design Agent', primary: true, onClick: askDesignAgent, disabled: busy !== '' || !editMsg.trim() }),
                            Btn({ label: '💾 Save for coding agent', onClick: saveSelection, disabled: busy !== '' || !editMsg.trim() }),
                            Btn({ label: 'Close', onClick: () => { setSelection(null); setEditMsg(''); setDsReply('') } }),
                          ),
                          h('span', { className: 'ds-hint' }, 'saves ' + sel.slug + '/EDIT_REQUEST.md with the full reference — the coding agent applies it. One element at a time; pick again with 🎯 Select.'),
                        ),
                      )
                    : null,
                ),
              ),
              h(
                'div',
                { className: 'ds-col' },
                // design agent chat
                h(
                  'div',
                  { className: 'ds-panel ds-agent' },
                  h(
                    'div',
                    { className: 'ds-panel-head' },
                    h('span', { className: 'ds-caps' }, 'Design Agent v10'),
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
                      onChange: (e) => setAgentMsg(e.target.value),
                      onKeyDown: (e) => {
                        if (e.key === 'Enter') sendAgent()
                      },
                    }),
                    Btn({ label: agentBusy ? '…' : 'Send', primary: true, onClick: sendAgent, disabled: agentBusy || agentMsg.trim() === '' }),
                  ),
                ),
                // file drop-ins
                h(
                  'div',
                  { className: 'ds-panel', style: { padding: '14px' } },
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
                  { className: 'ds-panel', style: { padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' } },
                  h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
                    h('span', { className: 'ds-caps' }, 'Vision Review'),
                    h('span', { className: 'ds-caps' }, harnessState && harnessState.routeRegistered ? 'harness-llm' : 'curl'),
                  ),
                  h('div', { className: 'ds-vision-thumb' },
                    images.length
                      ? h('img', { src: '/design-studio/' + selected + '/' + (agentImage || images[0]), alt: 'review target' })
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
              ),
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
            h('span', { className: 'ds-caps' }, 'transport: ' + (harnessState && harnessState.routeRegistered ? 'harness-llm' : 'curl')),
          ),
          h(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
            h('span', { className: 'ds-status-pill' }, h('span', { className: 'dot' }), h('span', { className: 'ds-caps good' }, 'studio live')),
            h('span', { className: 'ds-caps' }, 'preview /design-studio/' + (sel ? sel.slug : '<slug>') + '/html/index.html'),
          ),
        ),
      )
    }

    // ================= settings section =================
    function SettingsView() {
      const [cfg, setCfg] = React.useState(null)
      const [key, setKey] = React.useState(null)
      const [harness, setHarness] = React.useState(null)
      const [form, setForm] = React.useState(null)
      const [keyValue, setKeyValue] = React.useState('')
      const [presets, setPresets] = React.useState(null)
      const [pf, setPf] = React.useState(null)
      const [applySlug, setApplySlug] = React.useState('')
      const [systems, setSystems] = React.useState([])
      const [log, setLog] = React.useState('')
      const [err, setErr] = React.useState('')
      const [busy, setBusy] = React.useState('')

      async function refresh() {
        const c = await call('studio.config')
        if (c.ok) {
          setCfg(c.data.config)
          setKey(c.data.key)
          setHarness(c.data.harness || null)
          setForm(JSON.parse(JSON.stringify(c.data.config)))
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
          const next = JSON.parse(JSON.stringify(prev || {}))
          if (name.indexOf('options.') === 0) {
            const k = name.slice('options.'.length)
            if (next.options === undefined || next.options === null) next.options = {}
            next.options[k] = value
          } else {
            next[name] = value
          }
          return next
        })
      }

      async function saveConfig(verb) {
        if (!form) return
        setBusy(verb + '…')
        setErr('')
        try {
          const res = await call('studio.config.save', { patch: form })
          if (!res.ok) {
            setErr(res.error || 'save failed')
            return
          }
          setCfg(res.data)
          setForm(JSON.parse(JSON.stringify(res.data)))
          setLog(verb === 'Change' ? 'selection changed and persisted — the next vision review uses it' : 'config saved')
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
          const next = JSON.parse(JSON.stringify(prev || blankPreset()))
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
          const preset = {
            id: String(pf.id || '').trim(),
            name: String(pf.name || '').trim(),
            colors: clean,
          }
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
            'applied to ' + applySlug + ': ' + res.data.tokenCss + (res.data.copied.length ? ' + logos ' + res.data.copied.join(', ') : '') +
              (res.data.missing.length ? ' — missing (skipped honestly): ' + res.data.missing.join(', ') : ''),
          )
        } catch (e) {
          setErr(String((e && e.message) || e))
        } finally {
          setBusy('')
        }
      }

      const colorKeys = ['bg', 'panel', 'panel2', 'border', 'text', 'muted', 'accent', 'ok', 'warn', 'err', 'info']
      const keyLine = key
        ? key.supported
          ? key.configured
            ? 'Key configured (source ' + (key.source || '?') + (key.writable ? ', writable' : ', read-only source') + '). Value never rendered.'
            : 'Key not configured (reference OPENROUTER_API_KEY).'
          : 'Credential service unavailable in this host.'
        : 'Checking key status…'

      return h(
        'div',
        { className: 'ds-settings' },
        Err({ text: err }),
        Log({ text: busy || log }),

        h(
          'div',
          { className: 'ds-section' },
          h('h3', null, 'OpenRouter — vision model (operator-owned, persisted across sessions)'),
          harness && harness.routeRegistered
            ? h(
                'div',
                { className: 'ds-hint' },
                'The harness has an openrouter provider route registered (providers: ' +
                  (harness.providers || []).join(', ') +
                  '). Reviews go through ctx.llm + the attachment seam; the harness Settings → Models page owns the key and model selection. The fields below remain the fallback config for the plugin curl client.',
              )
            : h(
                'div',
                { className: 'ds-hint' },
                'No openrouter route in the harness yet — install the persistent dsh-openrouter composition package to move the key/model management into Settings → Models; until then the fields below drive the plugin curl client.',
              ),
          h('div', { className: 'ds-row' }, h('span', { className: 'ds-hint' }, keyLine)),
          h(
            'div',
            { className: 'ds-row' },
            h('input', {
              className: 'ds-input',
              type: 'password',
              placeholder: key && key.configured ? '•••••• — key stored (paste a new one to replace)' : 'no key — paste an OpenRouter key to enable vision reviews',
              value: keyValue,
              onChange: (e) => setKeyValue(e.target.value),
              autoComplete: 'off',
            }),
            Btn({ label: 'Save key', onClick: saveKeyAction, disabled: busy !== '' }),
            Btn({ label: 'Clear key', onClick: clearKeyAction, disabled: busy !== '' }),
          ),
          form
            ? h(
                'div',
                { className: 'ds-grid' },
                Field({
                  label: 'Coding model (this agent; persisted reference — never auto-swapped)',
                  value: form.codingModel,
                  onChange: (v) => setFormValue('codingModel', v),
                }),
                Field({
                  label: 'Vision model (comma-separated fallback list)',
                  value: listVal(form.visionModels),
                  onChange: (v) => setFormValue('visionModels', v),
                  hint: 'failed models cool down 10 min; when all are cooling they are all tried anyway',
                }),
                h(
                  'label',
                  { className: 'ds-field' },
                  h('span', { className: 'ds-field-label' }, 'Reasoning effort'),
                  h(
                    'select',
                    { className: 'ds-select', value: form.effort, onChange: (e) => setFormValue('effort', e.target.value) },
                    ['off', 'low', 'medium', 'high'].map((v) => h('option', { key: v, value: v }, v)),
                  ),
                  h('span', { className: 'ds-hint' }, 'off omits the reasoning block (non-reasoning models)'),
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
                    'Auto-delete a design system when its chat is deleted (default OFF — designs are never auto-deleted unless you opt in)',
                  ),
                ),
                Field({
                  label: 'Temperature',
                  value: String(form.options.temperature),
                  onChange: (v) => setFormValue('options.temperature', Number(v)),
                }),
                Field({
                  label: 'max_tokens cap (fitted per model context)',
                  value: String(form.options.maxTokens),
                  onChange: (v) => setFormValue('options.maxTokens', Number(v)),
                }),
                Field({
                  label: 'Base URL',
                  value: form.options.baseUrl,
                  onChange: (v) => setFormValue('options.baseUrl', v),
                }),
                h(
                  'label',
                  { className: 'ds-field' },
                  h('span', { className: 'ds-field-label' }, 'Provider routing'),
                  h(
                    'label',
                    { className: 'ds-check' },
                    h('input', {
                      type: 'checkbox',
                      checked: Boolean(form.options.providerRouting),
                      onChange: (e) => setFormValue('options.providerRouting', e.target.checked),
                    }),
                    'sort=throughput routing',
                  ),
                  h(
                    'label',
                    { className: 'ds-check' },
                    h('input', {
                      type: 'checkbox',
                      checked: Boolean(form.options.allowFallbacks),
                      onChange: (e) => setFormValue('options.allowFallbacks', e.target.checked),
                    }),
                    'allow_fallbacks',
                  ),
                  h(
                    'label',
                    { className: 'ds-check' },
                    h('input', {
                      type: 'checkbox',
                      checked: Boolean(form.options.includeUsage),
                      onChange: (e) => setFormValue('options.includeUsage', e.target.checked),
                    }),
                    'include_usage',
                  ),
                  h(
                    'label',
                    { className: 'ds-check' },
                    h('input', {
                      type: 'checkbox',
                      checked: Boolean(form.options.reasoningExclude),
                      onChange: (e) => setFormValue('options.reasoningExclude', e.target.checked),
                    }),
                    'reasoning.exclude',
                  ),
                ),
                Field({
                  label: 'Quantizations (comma-separated)',
                  value: listVal(form.options.quantizations),
                  onChange: (v) => setFormValue('options.quantizations', v),
                }),
                Field({
                  label: 'only providers (comma-separated, empty = any)',
                  value: listVal(form.options.onlyProviders),
                  onChange: (v) => setFormValue('options.onlyProviders', v),
                }),
              )
            : h('div', { className: 'ds-hint' }, 'loading…'),
          h(
            'div',
            { className: 'ds-row' },
            Btn({ label: 'Save', onClick: () => saveConfig('Save'), disabled: busy !== '' }),
            Btn({ label: 'Change', primary: true, onClick: () => saveConfig('Change'), disabled: busy !== '' }),
            h('span', { className: 'ds-hint' }, 'Save persists; Change persists + applies to the next vision call. Changing the model is always an operator action.'),
          ),
        ),

        h(
          'div',
          { className: 'ds-section' },
          h('h3', null, 'Identity presets (durable — one JSON per preset under temp_design_folder/_presets/)'),
          presets === null
            ? h('div', { className: 'ds-hint' }, 'loading…')
            : h(
                'div',
                { className: 'ds-preset-list' },
                presets.length === 0
                  ? h('div', { className: 'ds-hint' }, 'No presets yet — create one below.')
                  : presets.map((p) =>
                      h(
                        'div',
                        { key: p.id, className: 'ds-preset-item', onClick: () => loadPreset(p) },
                        h('span', null, p.name, h('span', { className: 'ds-hint' }, ' · ' + p.id)),
                        h(
                          'span',
                          null,
                          (['bg', 'panel', 'text', 'accent', 'ok', 'warn', 'err']).map((k) =>
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
                { className: 'ds-grid' },
                Field({ label: 'Preset id (slug)', value: pf.id, onChange: (v) => setPfValue('id', v) }),
                Field({ label: 'Name', value: pf.name, onChange: (v) => setPfValue('name', v) }),
                colorKeys.map((k) =>
                  Field({ label: 'colors.' + k, value: pf.colors[k] || '', onChange: (v) => setPfValue('colors.' + k, v), placeholder: '#rrggbb' }),
                ),
                Field({ label: 'Radius (e.g. 12px)', value: pf.radius, onChange: (v) => setPfValue('radius', v) }),
                Field({ label: 'Spacing (px number)', value: pf.spacing, onChange: (v) => setPfValue('spacing', v) }),
                Field({ label: 'fonts.body', value: pf.fonts.body, onChange: (v) => setPfValue('fonts.body', v) }),
                Field({ label: 'fonts.display', value: pf.fonts.display, onChange: (v) => setPfValue('fonts.display', v) }),
                Field({ label: 'fonts.mono', value: pf.fonts.mono, onChange: (v) => setPfValue('fonts.mono', v) }),
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
            Btn({ label: 'Apply preset → token.css + logos', onClick: applyPresetAction, disabled: busy !== '' || !pf || !pf.id || !applySlug }),
          ),
          h('span', { className: 'ds-hint' }, 'Apply writes css/token.css into the design system and copies any logo files the preset store actually holds; missing logos are reported, never faked.'),
        ),
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
        Err({ text: err }),
        Log({ text: busy || log }),
        h(
          'div',
          { className: 'ds-section' },
          h('h3', null, 'All design systems (every conversation)'),
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
                          (s.createdAt ? ' · created ' + String(s.createdAt).slice(0, 10) : ''),
                      ),
                    ),
                    h(
                      'span',
                      { className: 'ds-row' },
                      s.orphan ? h('span', { className: 'ds-badge amber' }, 'orphaned') : null,
                      Btn({ label: confirmSlug === s.slug ? 'Confirm delete?' : 'Delete', onClick: () => doDelete(s.slug), disabled: busy !== '' }),
                    ),
                  ),
                ),
          h(
            'div',
            { className: 'ds-row' },
            Btn({ label: 'Sweep orphans now', onClick: doSweep, disabled: busy !== '' }),
            h('span', { className: 'ds-hint' }, 'sweep only deletes when auto-delete is ON (Settings → Design Studio → Lifecycle); default is never auto-delete'),
          ),
        ),
      )
    }

    // ================= slot registrations =================
    slots.inject('conversation.view', () =>
      slots.register({ name: 'conversation.view', id: 'design-studio', order: 20, label: 'Design Studio' }, (props) => h(StudioView, props)),
    )
    slots.inject('settings.section', () =>
      slots.register({ name: 'settings.section', id: 'all-designs', order: 14, label: 'All designs' }, () => h(AllDesignsView)),
    )
    slots.inject('settings.section', () =>
      slots.register({ name: 'settings.section', id: 'design-studio', order: 25, label: 'Design Studio' }, () => h(SettingsView)),
    )
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  },
})
