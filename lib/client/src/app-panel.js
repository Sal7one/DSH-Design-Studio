import { Btn, Err, Log } from './primitives.js'
import { call } from './api.js'
import { runtime } from './runtime.js'
import { framePixels, changedRegions, flattenTree, labelForRegion } from './frame-diff.js'


// The App surface is one panel: a live Android app through the background
// Appium bridge when a session exists, otherwise the Compose Desktop target.
function apCall(method, args) {
  return call('studio.android.' + method, args || {})
}

export function AppPanel({ slug, sessionId }) {
  const [mode, setMode] = React.useState('android')

  React.useEffect(() => {
    let cancelled = false
    async function detect() {
      let android = true
      try {
        const res = await apCall('status', { slug })
        if (res.ok && res.data && res.data.session) {
          android = true
        } else {
          const compose = await call('studio.app.status', {})
          android = !(compose.ok && compose.data && compose.data.configured)
        }
      } catch (_) {}
      if (!cancelled) setMode(android ? 'android' : 'compose')
    }
    detect()
    const timer = setInterval(detect, 3000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [slug])

  return mode === 'android' ? h(AndroidPanel, { slug, sessionId }) : h(ComposePanel, { slug })
}

function AndroidPanel({ slug, sessionId }) {
  const [status, setStatus] = React.useState(null)
  const [shot, setShot] = React.useState(null)
  const [nodes, setNodes] = React.useState([])
  const [selected, setSelected] = React.useState(null)
  const [locator, setLocator] = React.useState(null)
  const [hoverNode, setHoverNode] = React.useState(null)
  const [live, setLive] = React.useState(true)
  const [busy, setBusy] = React.useState('')
  const [err, setErr] = React.useState('')
  const [log, setLog] = React.useState('')
  const [editMsg, setEditMsg] = React.useState('')
  const [regions, setRegions] = React.useState([])
  const [changed, setChanged] = React.useState(0)
  const [history, setHistory] = React.useState([])
  const [context, setContext] = React.useState(null)
  const [configOpen, setConfigOpen] = React.useState(false)
  const [selectionOpen, setSelectionOpen] = React.useState(false)
  const [form, setForm] = React.useState({ url: 'http://127.0.0.1:4723', appPackage: '', appActivity: '', deviceName: 'Android', projectRoot: '', buildTask: ':app:assembleDebug', apkPath: 'app/build/outputs/apk/debug/app-debug.apk' })
  const inFlight = React.useRef(false)
  const autoConnectRef = React.useRef(false)
  const skipAutoRef = React.useRef(false)
  const baselineRef = React.useRef(null)
  const shotImgRef = React.useRef(null)
  const hoverSeq = React.useRef(0)
  const lastHoverAt = React.useRef(0)

  function applyStatus(data) {
    setStatus(data)
    const cfg = (data && data.config) || {}
    const caps = cfg.capabilities || {}
    setForm({
      url: cfg.url || 'http://127.0.0.1:4723',
      appPackage: caps['appium:appPackage'] || '',
      appActivity: caps['appium:appActivity'] || '',
      deviceName: caps['appium:deviceName'] || 'Android',
      projectRoot: cfg.projectRoot || '',
      buildTask: cfg.buildTask || ':app:assembleDebug',
      apkPath: cfg.apkPath || 'app/build/outputs/apk/debug/app-debug.apk',
    })
  }

  async function refreshStatus() {
    const res = await apCall('status', { slug })
    if (res.ok) applyStatus(res.data)
    else setErr(res.error || 'could not read the Android target')
  }

  async function loadHistory() {
    const res = await apCall('history', { slug })
    if (res.ok) setHistory(res.data || [])
  }

  async function loadContext(tag) {
    const res = await apCall('context', { slug, tag: tag || undefined })
    if (res.ok) setContext(res.data)
  }

  async function refreshAll() {
    if (inFlight.current) return
    inFlight.current = true
    try {
      const [shotRes, treeRes] = await Promise.all([apCall('shot', { slug }), apCall('tree', { slug })])
      if (shotRes.ok) setShot({ url: shotRes.data.path, w: shotRes.data.w, h: shotRes.data.h, ts: Date.now() })
      else {
        setErr(shotRes.error || 'screenshot failed')
        refreshStatus().catch(() => {})
      }
      if (treeRes.ok) setNodes(treeRes.data.nodes || [])
    } finally {
      inFlight.current = false
    }
  }

  React.useEffect(() => {
    refreshStatus().catch((e) => setErr(String((e && e.message) || e)))
    loadHistory().catch(() => {})
    loadContext('').catch(() => {})
  }, [slug])

  React.useEffect(() => {
    if (!live || !status || !status.session) return undefined
    let cancelled = false
    refreshAll()
    const timer = setInterval(() => {
      if (!cancelled) refreshAll()
    }, 3000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [live, slug, status && status.session && status.session.id])

  React.useEffect(() => {
    if (!status) return
    if (status.session) {
      autoConnectRef.current = false
      return
    }
    const caps = (status.config && status.config.capabilities) || {}
    if (!caps['appium:appPackage']) return
    if (skipAutoRef.current || autoConnectRef.current) return
    autoConnectRef.current = true
    let cancelled = false
    ;(async () => {
      setBusy('reconnecting Android app…')
      try {
        const res = await apCall('connect', { slug })
        if (!cancelled && res.ok) {
          setLog('reconnected ' + (res.data && res.data.session ? res.data.session.id : ''))
          await refreshStatus()
          await refreshAll()
        }
      } catch (_) {
      } finally {
        if (!cancelled) setBusy('')
      }
    })()
    return () => { cancelled = true }
  }, [slug, status && status.session && status.session.id, status && status.config && status.config.capabilities && status.config.capabilities['appium:appPackage']])

  async function saveAndConnect() {
    setBusy('binding Android app…')
    setErr('')
    try {
      const saved = await apCall('config.save', {
        slug,
        patch: {
          url: form.url,
          capabilities: {
            'appium:appPackage': form.appPackage,
            'appium:appActivity': form.appActivity,
            'appium:deviceName': form.deviceName,
          },
          projectRoot: form.projectRoot,
          buildTask: form.buildTask,
          apkPath: form.apkPath,
        },
      })
      if (!saved.ok) {
        setErr(saved.error || 'could not save the Android target')
        return
      }
      const connected = await apCall('connect', { slug })
      if (!connected.ok) {
        setErr(connected.error || 'could not connect the Android app')
        return
      }
      skipAutoRef.current = false
      setConfigOpen(false)
      setLog('connected ' + (connected.data && connected.data.session ? connected.data.session.id : 'Android app'))
      await refreshStatus()
      await refreshAll()
      await loadHistory()
    } finally {
      setBusy('')
    }
  }

  async function disconnect() {
    skipAutoRef.current = true
    setBusy('disconnecting…')
    try {
      await apCall('disconnect', {})
      setStatus((prev) => (prev ? Object.assign({}, prev, { session: null }) : prev))
      setLog('disconnected')
    } finally {
      setBusy('')
    }
  }

  async function restart() {
    setBusy('restarting app…')
    setErr('')
    try {
      const res = await apCall('restart', { slug })
      if (!res.ok) {
        setErr(res.error || 'restart failed')
        return
      }
      setLog('restarted ' + (res.data && res.data.appId ? res.data.appId : 'app'))
      await refreshAll()
    } finally {
      setBusy('')
    }
  }

  async function capture() {
    setBusy('saving frame to project…')
    setErr('')
    try {
      const res = await apCall('capture', { slug })
      if (!res.ok) {
        setErr(res.error || 'capture failed')
        return
      }
      setLog('saved ' + res.data.entry.designPath + (res.data.snapshot ? ' · history snapshot' : ''))
      await loadHistory()
    } finally {
      setBusy('')
    }
  }

  function onShotMove(e) {
    if (!shot || !shot.w || !shot.h) return
    const now = Date.now()
    if (now - lastHoverAt.current < 70) return
    lastHoverAt.current = now
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.round(((e.clientX - rect.left) / rect.width) * shot.w)
    const y = Math.round(((e.clientY - rect.top) / rect.height) * shot.h)
    const seq = ++hoverSeq.current
    apCall('hover', { slug, x, y }).then((res) => {
      if (seq !== hoverSeq.current) return
      setHoverNode(res.ok && res.data ? res.data.node : null)
    })
  }

  function onShotLeave() {
    hoverSeq.current += 1
    setHoverNode(null)
  }

  function hoverTreeNode(node) {
    setHoverNode(node || null)
  }

  function onShotClick(e) {
    if (!shot || !shot.w || !shot.h) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.round(((e.clientX - rect.left) / rect.width) * shot.w)
    const y = Math.round(((e.clientY - rect.top) / rect.height) * shot.h)
    apCall('select', { slug, x, y }).then((res) => {
      if (res.ok) {
        setSelected(res.data.node)
        setLocator(res.data.locator)
        setSelectionOpen(true)
        loadContext(res.data.node.resourceId || '').catch(() => {})
      } else setErr(res.error || 'select failed')
    })
  }

  function selectNode(node) {
    apCall('select', { slug, index: node.index }).then((res) => {
      if (res.ok) {
        setSelected(res.data.node)
        setLocator(res.data.locator)
        setSelectionOpen(true)
        loadContext(res.data.node.resourceId || '').catch(() => {})
      } else setErr(res.error || 'select failed')
    })
  }

  function pinBaseline() {
    const img = shotImgRef.current
    if (!img) return
    const px = framePixels(img, 200)
    if (!px) return
    baselineRef.current = px
    setRegions([])
    setChanged(0)
    setLog('baseline re-pinned — later frames compare against this one')
  }

  function onShotLoad(e) {
    const img = e.currentTarget
    shotImgRef.current = img
    const px = framePixels(img, 200)
    if (!px) return
    if (!baselineRef.current) {
      baselineRef.current = px
      return
    }
    const diff = changedRegions(baselineRef.current, px, { threshold: 55, cell: 4 })
    const palette = (nodes || [])
      .filter((n) => n && n.bounds && shot && shot.w && shot.h)
      .map((n) => ({
        label: (n.text || n.contentDesc || n.resourceId || n.className || '').slice(0, 46),
        rect: { x: n.bounds.x / shot.w, y: n.bounds.y / shot.h, w: n.bounds.w / shot.w, h: n.bounds.h / shot.h },
      }))
    setRegions(diff.regions.map((r) => Object.assign({}, r, { label: labelForRegion(r, palette) })))
    setChanged(diff.changed)
  }

  async function sendRequest() {
    if (!selected || !editMsg.trim()) return
    setBusy('sending request…')
    setErr('')
    try {
      const sessionsSvc = runtime && runtime.ctx && typeof runtime.ctx.get === 'function' ? runtime.ctx.get('sessions') : null
      const binding = sessionsSvc && typeof sessionsSvc.binding === 'function' && sessionId ? sessionsSvc.binding(sessionId) : undefined
      if (!binding || !binding.session || typeof binding.session.prompt !== 'function') {
        setErr('main chat is not reachable from this panel — send the request in the conversation instead')
        return
      }
      const b = selected.bounds || {}
      const detail = [
        'Design Studio Android project "' + slug + '": change request.',
        'Selected node: class=' + (selected.className || '?') + ', text=' + JSON.stringify(selected.text || '') + ', content-desc=' + JSON.stringify(selected.contentDesc || '') + ', resource-id=' + JSON.stringify(selected.resourceId || '') + ', bounds=' + JSON.stringify(b) + ', clickable=' + selected.clickable + ', enabled=' + selected.enabled + '.',
        locator ? 'Locator: ' + locator.using + '=' + locator.value + '.' : '',
        'Request: ' + editMsg.trim(),
        'Apply this to the Android app source, then rebuild/install and restart it (design_studio action=android_restart, slug "' + slug + '") so the project App tab updates. Verify with android_tree/android_shot.',
      ].filter(Boolean).join('\n')
      const sent = await binding.session.prompt([{ type: 'text', text: detail }], 'queue')
      if (!sent || sent.ok !== true) {
        setErr('main chat rejected the request — send it in the conversation instead')
        return
      }
      setEditMsg('')
      setSelectionOpen(false)
      setLog('request sent — I edit the app, rebuild, restart, and this tab refreshes')
    } catch (e) {
      setErr(String((e && e.message) || e))
    } finally {
      setBusy('')
    }
  }

  const session = status && status.session
  const reachable = Boolean(status && status.appium && status.appium.reachable)
  const hoverBox = hoverNode && hoverNode.bounds && shot && shot.w && shot.h
    ? {
        left: (hoverNode.bounds.x / shot.w) * 100 + '%',
        top: (hoverNode.bounds.y / shot.h) * 100 + '%',
        width: (hoverNode.bounds.w / shot.w) * 100 + '%',
        height: (hoverNode.bounds.h / shot.h) * 100 + '%',
      }
    : null
  const box = selected && selected.bounds && shot && shot.w && shot.h
    ? {
        left: (selected.bounds.x / shot.w) * 100 + '%',
        top: (selected.bounds.y / shot.h) * 100 + '%',
        width: (selected.bounds.w / shot.w) * 100 + '%',
        height: (selected.bounds.h / shot.h) * 100 + '%',
      }
    : null

  return h(
    'div',
    { className: 'ds-app' },
    h(
      'div',
      { className: 'ds-panel-head' },
      h('span', { className: 'ds-caps' }, 'Android app'),
      h('span', { className: 'ds-hint' }, status ? (session ? 'connected · ' + session.id : 'not connected') + (reachable ? '' : ' · Appium offline') : 'loading…'),
    ),
    context
      ? h('div', { className: 'ds-hint' },
          'Screen: ' + (context.screenLabel || '(no SCREEN_ tag)') + ' · activity ' + (context.activity || 'unknown') + (context.routes.length ? ' · ' + context.routes.length + ' routes' : '') + (context.files ? ' · ' + context.files + ' source files' : ''))
      : null,
    context && context.routes.length
      ? h('details', { className: 'ds-hint' },
          h('summary', null, 'App routes · ' + context.routes.length),
          context.routes.slice(0, 30).map((route, i) => h('div', { key: 'route-' + i }, route.route + '  ·  ' + route.kind + '  ·  ' + route.file)),
        )
      : null,
    h(
    ),
    h(
      'div',
      { className: 'ds-actions' },
      session
        ? h(Btn, { label: 'Disconnect', onClick: disconnect, disabled: busy !== '' })
        : h(Btn, { label: 'Connect Android app', primary: true, onClick: () => setConfigOpen(true), disabled: busy !== '' }),
      session ? h(Btn, { label: live ? 'Pause live' : 'Go live', onClick: () => setLive(!live), disabled: busy !== '' }) : null,
      session ? h(Btn, { label: 'Refresh', onClick: refreshAll, disabled: busy !== '' }) : null,
      session ? h(Btn, { label: 'Restart app', onClick: restart, disabled: busy !== '' }) : null,
      session ? h(Btn, { label: 'Save frame', onClick: capture, disabled: busy !== '' || !shot }) : null,
      shot ? h(Btn, { label: 'Re-pin baseline', onClick: pinBaseline }) : null,
      session ? h(Btn, { label: 'Configure', onClick: () => setConfigOpen(true), disabled: busy !== '' }) : null,
    ),
    h(Err, { text: err }),
    h(Log, { text: log }),
    busy ? h('div', { className: 'ds-hint' }, busy) : null,
    !session && status
      ? h('div', { className: 'ds-hint' },
          'This design project has no live Android app. Bind it to an app with Appium to see and change the real UI here.',
          status.appium && status.appium.error ? h('div', { className: 'ds-hint' }, String(status.appium.error)) : null)
      : null,
    shot
      ? h('div', null,
          h('div', { className: 'ds-hint', style: { marginBottom: '6px' } }, 'Hover to highlight a part; click it to select and request a change.'),
          h('div', { className: 'ds-hint', style: { marginBottom: '6px' } },
            regions.length
              ? regions.length + ' changed region' + (regions.length === 1 ? '' : 's') + ' · ' + (changed * 100).toFixed(1) + '% of pixels differ from the baseline'
              : 'baseline pinned — changes since the last pin are outlined'),
          h('div', { className: 'ds-app-frame', style: { position: 'relative', lineHeight: '0', maxWidth: '420px' } },
            h('img', {
              ref: shotImgRef,
              src: shot.url,
              alt: 'Android app screenshot',
              onClick: onShotClick,
              onMouseMove: onShotMove,
              onMouseLeave: onShotLeave,
              onLoad: onShotLoad,
              style: { width: '100%', display: 'block', borderRadius: '10px', border: '1px solid var(--ds-border, #2a3142)', cursor: 'crosshair' },
            }),
            regions.map((r, i) => h('div', {
              key: 'ap-region-' + i,
              title: r.label || 'changed region',
              style: {
                position: 'absolute', left: r.x * 100 + '%', top: r.y * 100 + '%', width: r.w * 100 + '%', height: r.h * 100 + '%',
                border: '1.5px solid #ff5d73', background: 'rgba(255,93,115,.10)', borderRadius: '4px', pointerEvents: 'none',
              },
            })),
            hoverBox ? h('div', {
              key: 'ap-hover',
              style: {
                position: 'absolute',
                left: hoverBox.left,
                top: hoverBox.top,
                width: hoverBox.width,
                height: hoverBox.height,
                border: '1.5px dashed #3be1ec',
                background: 'rgba(59,225,236,.08)',
                borderRadius: '4px',
                pointerEvents: 'none',
              },
            }) : null,
            box ? h('div', {
              style: {
                position: 'absolute', left: box.left, top: box.top, width: box.width, height: box.height,
                border: '2px solid #ff5d73', background: 'rgba(255,93,115,.12)', borderRadius: '4px', pointerEvents: 'none',
              },
            }) : null,
          ),
          regions.length ? h('div', { className: 'ds-hint' }, regions.slice(0, 5).map((r) => r.label || 'region').join(' · ')) : null,
        )
      : null,
    selected
      ? h(
          'div',
          { className: 'ds-row', style: { alignItems: 'center' } },
          h('span', { className: 'ds-hint' }, 'Selected: ' + String(selected.text || selected.contentDesc || selected.resourceId || selected.className || 'node').slice(0, 48)),
          h(Btn, { label: 'Request change', primary: true, onClick: () => setSelectionOpen(true), disabled: busy !== '' }),
          h(Btn, { label: 'Tap', onClick: () => apCall('tap', { slug, index: selected.index }).then((r) => setLog(r.ok ? 'tapped node ' + selected.index : r.error || 'tap failed')), disabled: busy !== '' }),
        )
      : null,
    selected && selectionOpen
      ? h(
          'div',
          { className: 'ds-modal-backdrop', onClick: (e) => { if (e.target === e.currentTarget) setSelectionOpen(false) } },
          h(
            'div',
            { className: 'ds-modal' },
            h('div', { className: 'ds-modal-title' }, h('span', null, 'Selected part'), h('span', { className: 'ds-sel-path' }, slug)),
            h('div', { className: 'ds-hint' }, (selected.className || 'node') + '  #' + selected.index),
            h('div', { className: 'ds-hint' }, 'bounds ' + (selected.bounds ? selected.bounds.x + ',' + selected.bounds.y + ' ' + selected.bounds.w + '×' + selected.bounds.h : '—') + (selected.clickable ? ' · clickable' : '')),
            selected.text ? h('div', { className: 'ds-hint' }, 'text: ' + selected.text) : null,
            selected.contentDesc ? h('div', { className: 'ds-hint' }, 'content-desc: ' + selected.contentDesc) : null,
            selected.resourceId ? h('div', { className: 'ds-hint' }, 'id: ' + selected.resourceId) : null,
            locator ? h('div', { className: 'ds-hint' }, 'locator: ' + locator.using + ' = ' + locator.value) : null,
            context && context.tag && context.tag.definitions && context.tag.definitions.length
              ? h('div', { className: 'ds-hint' }, 'source: ' + context.tag.definitions.slice(0, 3).map((d) => d.file + ':' + d.line + (d.function ? ' (' + d.function + ')' : '')).join(', ') + (context.tag.usages && context.tag.usages.length ? ' · used in ' + context.tag.usages.length + ' places' : ''))
              : selected.resourceId
                ? h('div', { className: 'ds-hint' }, 'source: no testTag match in ' + (context && context.projectRoot ? context.projectRoot : 'the project'))
                : h('div', { className: 'ds-hint' }, 'source: no test tag on this node — add Modifier.testTag(...) to map it to source'),
            h('label', { className: 'ds-field' },
              h('span', null, 'What should change here?'),
              h('input', {
                className: 'ds-input',
                value: editMsg,
                autoFocus: true,
                placeholder: 'e.g. make this button coral and shorter',
                onChange: (e) => setEditMsg(e.target.value),
                onKeyDown: (e) => { if (e.key === 'Enter' && !e.isComposing && editMsg.trim()) sendRequest() },
              }),
            ),
            h('div', { className: 'ds-row' },
              h(Btn, { label: busy ? 'Sending…' : 'Ask DeepSeek', primary: true, onClick: sendRequest, disabled: busy !== '' || !editMsg.trim() }),
              h(Btn, { label: 'Tap node', onClick: () => apCall('tap', { slug, index: selected.index }).then((r) => setLog(r.ok ? 'tapped node ' + selected.index : r.error || 'tap failed')) }),
              locator ? h(Btn, { label: 'Copy locator', onClick: () => { try { navigator.clipboard.writeText(locator.using + '=' + locator.value); setLog('locator copied') } catch (_) {} } }) : null,
              h(Btn, { label: 'Close', onClick: () => setSelectionOpen(false) }),
            ),
            h('span', { className: 'ds-hint' }, 'The request is queued into this conversation with the node identity and locator; I edit the app source, rebuild, restart, and this tab refreshes.'),
          ),
        )
      : null,
    nodes.length
      ? h('div', { className: 'ds-app-tree', style: { maxHeight: '240px', overflow: 'auto', font: '11px ui-monospace, monospace', border: '1px solid var(--ds-border, #2a3142)', borderRadius: '10px', padding: '6px 8px' } },
          nodes.slice(0, 500).map((node) =>
            h('div', {
              key: node.index,
              style: { paddingLeft: 2 + node.depth * 12 + 'px', cursor: 'pointer', whiteSpace: 'nowrap', borderRadius: '4px', background: selected && selected.index === node.index ? 'rgba(255,93,115,.16)' : (hoverNode && hoverNode.index === node.index ? 'rgba(59,225,236,.12)' : 'transparent') },
              onMouseEnter: () => hoverTreeNode(node),
              onMouseLeave: () => hoverTreeNode(null),
              onClick: () => selectNode(node),
              title: node.className + ' ' + (node.resourceId || ''),
            }, (node.text || node.contentDesc || node.resourceId || node.className || 'node').slice(0, 110)),
          ),
        )
      : null,
    history.length
      ? h('div', null,
          h('div', { className: 'ds-caps' }, 'Project app history'),
          h('div', { className: 'ds-chips', style: { marginTop: '6px' } },
            history.slice(-6).reverse().map((entry, i) =>
              h('img', {
                key: 'hist-' + i,
                src: '/design-studio/' + slug + '/' + entry.designPath,
                alt: 'App capture ' + entry.at,
                title: entry.at + ' · ' + (entry.treeHash || ''),
                style: { width: '72px', height: '128px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--ds-border, #2a3142)' },
              }),
            ),
          ),
        )
      : null,
    configOpen
      ? h('div', { className: 'ds-modal-backdrop', onClick: (e) => { if (e.target === e.currentTarget) setConfigOpen(false) } },
          h('div', { className: 'ds-modal' },
            h('div', { className: 'ds-modal-title' }, h('span', null, 'Connect Android app'), h('span', { className: 'ds-sel-path' }, slug)),
            h('p', { className: 'ds-hint' }, 'Bind this design project to its Android app through Appium. The session, captures and history stay with this project.'),
            h('label', { className: 'ds-field' }, h('span', null, 'Appium URL'), h('input', { className: 'ds-input', value: form.url, onChange: (e) => setForm(Object.assign({}, form, { url: e.target.value })) })),
            h('label', { className: 'ds-field' }, h('span', null, 'appPackage'), h('input', { className: 'ds-input', value: form.appPackage, onChange: (e) => setForm(Object.assign({}, form, { appPackage: e.target.value })) })),
            h('label', { className: 'ds-field' }, h('span', null, 'appActivity'), h('input', { className: 'ds-input', value: form.appActivity, onChange: (e) => setForm(Object.assign({}, form, { appActivity: e.target.value })) })),
            h('label', { className: 'ds-field' }, h('span', null, 'deviceName'), h('input', { className: 'ds-input', value: form.deviceName, onChange: (e) => setForm(Object.assign({}, form, { deviceName: e.target.value })) })),
            h('label', { className: 'ds-field' }, h('span', null, 'Project root (absolute)'), h('input', { className: 'ds-input', placeholder: '/absolute/path/to/project', value: form.projectRoot, onChange: (e) => setForm(Object.assign({}, form, { projectRoot: e.target.value })) })),
            h('label', { className: 'ds-field' }, h('span', null, 'Gradle build task'), h('input', { className: 'ds-input', value: form.buildTask, onChange: (e) => setForm(Object.assign({}, form, { buildTask: e.target.value })) })),
            h('label', { className: 'ds-field' }, h('span', null, 'APK path (relative to project root)'), h('input', { className: 'ds-input', value: form.apkPath, onChange: (e) => setForm(Object.assign({}, form, { apkPath: e.target.value })) })),
            h('div', { className: 'ds-row' },
              h(Btn, { label: busy ? 'Connecting…' : 'Save & Connect', primary: true, onClick: saveAndConnect, disabled: busy !== '' }),
              h(Btn, { label: 'Cancel', onClick: () => setConfigOpen(false), disabled: busy !== '' }),
            ),
            h('span', { className: 'ds-hint' }, 'Appium must be running (appium --address 127.0.0.1) with the uiautomator2 driver and a device.'),
          ),
        )
      : null,
  )
}

function ComposePanel({ slug }) {
  const [status, setStatus] = React.useState(null)
  const [frame, setFrame] = React.useState(null)
  const [regions, setRegions] = React.useState([])
  const [changed, setChanged] = React.useState(0)
  const [live, setLive] = React.useState(false)
  const [tree, setTree] = React.useState('')
  const [nodeCount, setNodeCount] = React.useState(0)
  const [logs, setLogs] = React.useState('')
  const [busy, setBusy] = React.useState('')
  const [err, setErr] = React.useState('')
  const [log, setLog] = React.useState('')

  const baselineRef = React.useRef(null)
  const nodesRef = React.useRef([])
  const treeRawRef = React.useRef(null)
  const busyRef = React.useRef(false)
  const imgRef = React.useRef(null)

  async function refresh() {
    const res = await call('studio.app.status', {})
    if (res.ok) {
      setStatus(res.data)
      if (res.data && res.data.state === 'ready') setLive(true)
    } else setErr(res.error || 'could not read app status')
  }

  React.useEffect(() => {
    refresh().catch((e) => setErr(String((e && e.message) || e)))
  }, [])

  async function loadTree() {
    const res = await call('studio.app.tree', {})
    if (!res.ok) return
    const text = String((res.data && res.data.text) || '')
    setTree(text.length > TREE_CAP ? text.slice(0, TREE_CAP) + '\n… (truncated)' : text)
    try {
      const parsed = JSON.parse(text)
      treeRawRef.current = parsed
      setNodeCount(flattenTree(parsed).count)
    } catch (_) {
      treeRawRef.current = null
      nodesRef.current = []
      setNodeCount(0)
    }
  }

  // Poll while live and ready. A slow capture is skipped rather than queued.
  React.useEffect(() => {
    if (!live || !status || status.state !== 'ready') return undefined
    let disposed = false
    async function tick() {
      if (busyRef.current) return
      busyRef.current = true
      try {
        const res = await call('studio.app.frame', { slug })
        if (!disposed && res.ok) setFrame(Object.assign({}, res.data, { at: Date.now() }))
      } catch (_) {
      } finally {
        busyRef.current = false
      }
    }
    tick()
    const timer = setInterval(tick, POLL_MS)
    return () => {
      disposed = true
      clearInterval(timer)
    }
  }, [live, status && status.state, slug])

  async function start() {
    setBusy('starting… (first Gradle run compiles)')
    setErr('')
    setLog('')
    try {
      const res = await call('studio.app.start', {})
      if (!res.ok) {
        setErr(res.error || 'could not start the app')
        return
      }
      await refresh()
      baselineRef.current = null
      setRegions([])
      setChanged(0)
      setLive(true)
      setLog('app ready — live review on; the first frame becomes the baseline')
      loadTree().catch(() => {})
    } catch (e) {
      setErr(String((e && e.message) || e))
    } finally {
      setBusy('')
    }
  }

  async function stop() {
    setBusy('stopping…')
    try {
      await call('studio.app.stop', {})
      setLive(false)
      setFrame(null)
      baselineRef.current = null
      setRegions([])
      setChanged(0)
      await refresh()
      setLog('stopped')
    } catch (e) {
      setErr(String((e && e.message) || e))
    } finally {
      setBusy('')
    }
  }

  function rePin() {
    const img = imgRef.current
    if (!img) {
      setLog('no frame to pin yet')
      return
    }
    const px = framePixels(img, 200)
    if (!px) {
      setLog('could not read the frame')
      return
    }
    baselineRef.current = px
    setRegions([])
    setChanged(0)
    setLog('baseline pinned — later frames compare against this one')
  }

  async function reload() {
    setBusy('reloading…')
    try {
      const res = await call('studio.app.reload', {})
      if (!res.ok) {
        setErr(res.error || 'reload failed')
        return
      }
      setLog(String((res.data && res.data.text) || 'reloaded'))
      await loadTree()
    } catch (e) {
      setErr(String((e && e.message) || e))
    } finally {
      setBusy('')
    }
  }

  async function runLogs() {
    const res = await call('studio.app.logs', {})
    if (!res.ok) {
      setErr(res.error || 'could not read logs')
      return
    }
    const text = String((res.data && res.data.text) || '')
    setLogs(text.length > LOG_CAP ? text.slice(0, LOG_CAP) + '\n… (truncated)' : text)
  }

  function onFrameLoad(e) {
    const img = e.currentTarget
    imgRef.current = img
    const px = framePixels(img, 200)
    if (!px) return
    if (!baselineRef.current) {
      baselineRef.current = px
      return
    }
    if (treeRawRef.current) {
      nodesRef.current = flattenTree(treeRawRef.current, { w: frame.w, h: frame.h }).nodes
    }
    const diff = changedRegions(baselineRef.current, px, { threshold: 55, cell: 4 })
    const labeled = diff.regions.map((r) => Object.assign({}, r, { label: labelForRegion(r, nodesRef.current) }))
    setRegions(labeled)
    setChanged(diff.changed)
  }

  const configured = Boolean(status && status.configured)
  const state = status ? status.state : 'unknown'
  const running = state === 'ready'
  const disabled = busy !== ''

  return h(
    'div',
    { className: 'ds-app' },
    h(
      'div',
      { className: 'ds-panel-head' },
      h('span', { className: 'ds-caps' }, 'Compose app'),
      h(
        'span',
        { className: 'ds-hint' },
        status === null
          ? 'loading…'
          : configured
            ? status.project + ' · ' + state + (nodeCount ? ' · tree ' + nodeCount + ' nodes' : '')
            : 'not configured',
      ),
    ),
    !configured
      ? h(
          'div',
          { className: 'ds-hint' },
          'No app is configured for this studio yet.'
        )
      : h(
          'div',
          { className: 'ds-actions' },
          h(Btn, { label: running ? 'Reload UI' : 'Start app', primary: true, onClick: running ? reload : start, disabled }),
          h(Btn, { label: live ? 'Pause live' : 'Go live', onClick: () => setLive(!live), disabled: disabled || !running }),
          h(Btn, { label: 'Re-pin baseline', onClick: rePin, disabled: disabled || !frame }),
          h(Btn, { label: 'Tree', onClick: () => loadTree().catch((e) => setErr(String(e))), disabled: disabled || !running }),
          h(Btn, { label: 'Logs', onClick: () => runLogs(), disabled: disabled || !running }),
          h(Btn, { label: 'Stop', onClick: stop, disabled: disabled || !running }),
        ),
    h(Err, { text: err }),
    h(Log, { text: log }),
    busy ? h('div', { className: 'ds-hint' }, busy) : null,
    configured && running && frame
      ? h(
          'div',
          { className: 'ds-app-review' },
          h(
            'div',
            { className: 'ds-hint' },
            regions.length
              ? regions.length + ' changed region' + (regions.length === 1 ? '' : 's') + ' · ' + pct(changed) + ' of pixels differ from the pinned baseline'
              : live
                ? 'watching for changes against the pinned baseline…'
                : 'paused — last frame shown',
          ),
          h(
            'div',
            { className: 'ds-app-frame', style: { position: 'relative', lineHeight: '0' } },
            h('img', {
              src: frame.path + '?t=' + frame.at,
              alt: 'Live Compose app frame',
              onLoad: onFrameLoad,
              style: { width: '100%', display: 'block', borderRadius: '10px', border: '1px solid var(--ds-border, #2a3142)' },
            }),
            regions.map((r, i) =>
              h('div', {
                key: 'r' + i,
                title: (r.label || 'changed region') + ' · ' + pct(r.w) + ' × ' + pct(r.h),
                style: {
                  position: 'absolute',
                  left: r.x * 100 + '%',
                  top: r.y * 100 + '%',
                  width: r.w * 100 + '%',
                  height: r.h * 100 + '%',
                  border: '1.5px solid #ff5d73',
                  background: 'rgba(255, 93, 115, 0.10)',
                  borderRadius: '4px',
                  pointerEvents: 'none',
                },
              }),
            ),
            regions.length
              ? null
              : h('div', {
                  style: {
                    position: 'absolute',
                    left: '8px',
                    bottom: '8px',
                    font: '11px ui-monospace, monospace',
                    color: '#9aa6ba',
                    background: 'rgba(11,14,20,0.72)',
                    padding: '3px 7px',
                    borderRadius: '6px',
                    lineHeight: '1.4',
                  },
                }, 'baseline pinned'),
          ),
          regions.length
            ? h(
                'div',
                { className: 'ds-app-regions' },
                regions.slice(0, 8).map((r, i) =>
                  h(
                    'div',
                    { key: 'row' + i, className: 'ds-hint', style: { display: 'flex', gap: '8px', alignItems: 'baseline' } },
                    h('b', null, r.label || 'region ' + (i + 1)),
                    h(
                      'span',
                      null,
                      'x ' + Math.round(r.x * frame.w) + '–' + Math.round((r.x + r.w) * frame.w) +
                        ' · y ' + Math.round(r.y * frame.h) + '–' + Math.round((r.y + r.h) * frame.h),
                    ),
                  ),
                ),
              )
            : null,
        )
      : null,
    configured && !running
      ? h('div', { className: 'ds-hint' }, state === 'starting' ? 'starting the app…' : 'App is not running — press Start app to render it here.')
      : null,
    tree
      ? h(
          'details',
          { className: 'ds-app-details' },
          h('summary', null, 'Semantic tree' + (nodeCount ? ' · ' + nodeCount + ' nodes' : '')),
          h('pre', { style: { maxHeight: '280px', overflow: 'auto', fontSize: '11px', whiteSpace: 'pre-wrap' } }, tree),
        )
      : null,
    logs
      ? h(
          'details',
          { className: 'ds-app-details' },
          h('summary', null, 'App logs'),
          h('pre', { style: { maxHeight: '220px', overflow: 'auto', fontSize: '11px', whiteSpace: 'pre-wrap' } }, logs),
        )
      : null,
    configured && status && status.error ? h(Err, { text: status.error }) : null,
  )

}
