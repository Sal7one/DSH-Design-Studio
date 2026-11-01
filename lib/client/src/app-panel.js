import { Btn, Err, Log } from './primitives.js'
import { call } from './api.js'
import { runtime } from './runtime.js'
import { framePixels, changedRegions, flattenTree, labelForRegion } from './frame-diff.js'
import { captureAndroidSelection, addAndroidPin, androidDraftReady, formatAndroidDraft } from './android-change-draft.js'


function apCall(method, args) {
  return call('studio.android.' + method, args || {})
}

const stoppedAppiumProjects = new Set()
function appiumWasDisconnected(slug) {
  if (stoppedAppiumProjects.has(slug)) return true
  try { return globalThis.sessionStorage && globalThis.sessionStorage.getItem('ds-appium-disconnected:' + slug) === '1' } catch (_) { return false }
}
function rememberAppiumDisconnect(slug, disconnected) {
  if (disconnected) stoppedAppiumProjects.add(slug)
  else stoppedAppiumProjects.delete(slug)
  try {
    if (disconnected) globalThis.sessionStorage && globalThis.sessionStorage.setItem('ds-appium-disconnected:' + slug, '1')
    else globalThis.sessionStorage && globalThis.sessionStorage.removeItem('ds-appium-disconnected:' + slug)
  } catch (_) {}
}

function locatorFromNode(node) {
  if (node && node.resourceId) return { using: 'xpath', value: '//*[@resource-id="' + String(node.resourceId).replace(/"/g, '&quot;') + '"]' }
  if (node && node.contentDesc) return { using: 'accessibility id', value: node.contentDesc }
  if (node && node.text) return { using: 'xpath', value: '//*[@text="' + String(node.text).replace(/"/g, '&quot;') + '"]' }
  return { using: 'class name', value: (node && node.className) || 'android.view.View' }
}

export function AppPanel({ slug, sessionId, active = true, onBusyChange, onOpenSettings }) {
  const [mode, setMode] = React.useState('choose')
  const [targetBusy, setTargetBusy] = React.useState(false)
  const [qalensEnabled, setQaLensEnabled] = React.useState(false)
  const [featuresError, setFeaturesError] = React.useState('')
  const featureSequence = React.useRef(0)
  React.useEffect(() => {
    if (!active) return undefined
    let mounted = true
    async function refreshFeatures() {
      const sequence = ++featureSequence.current
      const result = await call('studio.features', {})
      if (!mounted || sequence !== featureSequence.current) return
      if (result.ok) { setQaLensEnabled(result.data.qalensEnabled === true); setFeaturesError('') }
      else { setQaLensEnabled(false); setFeaturesError(result.error || 'Could not read integration settings.') }
    }
    refreshFeatures()
    window.addEventListener('focus', refreshFeatures)
    window.addEventListener('design-studio-config-changed', refreshFeatures)
    return () => { mounted = false; window.removeEventListener('focus', refreshFeatures); window.removeEventListener('design-studio-config-changed', refreshFeatures) }
  }, [active])
  React.useEffect(() => { if (!qalensEnabled && mode === 'qalens') setMode('choose') }, [qalensEnabled, mode])
  const selectedMode = mode === 'qalens' && !qalensEnabled ? 'choose' : mode
  function markBusy(value) { setTargetBusy(value); if (onBusyChange) onBusyChange(value) }
  return h('div', { className: 'ds-app-section' },
    h('header', { className: 'ds-app-section-head' },
      h('div', null, h('h2', null, 'App'), h('p', null, 'Inspect a running app and prepare a design request.')),
      h('label', { className: 'ds-app-target' },
        h('span', null, 'App target'),
        h('select', { value: selectedMode, disabled: targetBusy, onChange: e => setMode(e.target.value), 'aria-label': 'App target' },
          h('option', { value: 'choose' }, 'Choose a target'),
          qalensEnabled ? h('option', { value: 'qalens' }, 'Android · QaLens') : null,
          h('option', { value: 'android' }, 'Android · Appium'),
          h('option', { value: 'compose' }, 'Compose Desktop')))),
    featuresError ? h('div', { className: 'ds-err', role: 'alert' }, featuresError) : null,
    selectedMode === 'choose' ? h('div', { className: 'ds-panel ds-app-choice' },
      h('h3', null, 'Choose an app target'),
      h('p', null, 'Use Android with Appium or Compose Desktop. QaLens is optional and can be enabled in Design Studio settings.'),
      qalensEnabled ? h('p', null, 'QaLens is enabled; select Android · QaLens above when you are ready to connect.') : null,
      !qalensEnabled && onOpenSettings ? h(Btn, { label: 'Open Design Studio settings', onClick: onOpenSettings }) : null) : null,
    qalensEnabled ? h('div', { hidden: selectedMode !== 'qalens' }, h(QaLensPanel, { slug, sessionId, active: active && selectedMode === 'qalens', onBusyChange: markBusy })) : null,
    h('div', { hidden: selectedMode !== 'android' }, h(AndroidPanel, { slug, sessionId, active: active && selectedMode === 'android', onBusyChange: markBusy })),
    active && selectedMode === 'compose' ? h(ComposePanel, { slug, onBusyChange: markBusy }) : null)
}

function QaLensPanel({ slug, sessionId, active, onBusyChange }) {
  const [url, setUrl] = React.useState('')
  const [view, setView] = React.useState(null)
  const [error, setError] = React.useState('')
  const [actionError, setActionError] = React.useState('')
  const [busy, setBusyState] = React.useState(false)
  function setBusy(value) { setBusyState(value); if (onBusyChange) onBusyChange(Boolean(value)) }
  const [targetPackage, setTargetPackage] = React.useState('')
  const [projectRoot, setProjectRoot] = React.useState('')
  const [targetMessage, setTargetMessage] = React.useState('')
  const [savedTarget, setSavedTarget] = React.useState(null)
  const [pins, setPins] = React.useState([])
  const [intent, setIntent] = React.useState('')
  const [draftMessage, setDraftMessage] = React.useState('')
  const [reviewOpen, setReviewOpen] = React.useState(false)
  const generation = React.useRef(0)

  React.useEffect(() => {
    let active = true
    call('studio.qalens.target', { slug }).then(result => {
      if (!active) return
      if (result.ok) { setTargetPackage(result.data.package || ''); setProjectRoot(result.data.projectRoot || ''); setSavedTarget(result.data) }
      else setActionError(result.error || 'Could not read project settings')
    })
    return () => { active = false }
  }, [slug])

  React.useEffect(() => {
    if (!active) return undefined
    let mounted = true
    let timer = null
    let inFlight = false
    async function poll() {
      if (!mounted || document.hidden || inFlight) return
      inFlight = true
      const current = generation.current
      const result = await call('studio.qalens.selection', { slug })
      inFlight = false
      if (!mounted) return
      if (current !== generation.current) { if (!document.hidden) timer = setTimeout(poll, 1500); return }
      if (result.ok) { setView(result.data); setError('') }
      else { setView(null); setError(result.error || 'Could not read QaLens') }
      if (mounted && !document.hidden) timer = setTimeout(poll, 1500)
    }
    function onVisibility() {
      clearTimeout(timer)
      if (!document.hidden) poll()
    }
    document.addEventListener('visibilitychange', onVisibility)
    poll()
    return () => { mounted = false; clearTimeout(timer); document.removeEventListener('visibilitychange', onVisibility) }
  }, [slug, active])

  async function connect(method, attachUrl) {
    setBusy(true); setError(''); setActionError(''); generation.current++
    try {
      const result = await call('studio.qalens.' + method, method === 'attach' ? { url: attachUrl || url } : {})
      if (!result.ok) { setView(null); setActionError(result.error || 'Could not connect'); return }
      const current = await call('studio.qalens.selection', { slug })
      if (current.ok) setView(current.data)
      else { setView(null); setError(current.error || 'Could not read QaLens') }
    } finally { setBusy(false) }
  }
  async function saveTarget() {
    setBusy(true); setActionError(''); setTargetMessage(''); generation.current++
    try {
      const result = await call('studio.qalens.target.save', { slug, package: targetPackage, projectRoot })
      if (!result.ok) { setActionError(result.error || 'Could not save project settings'); return }
      setTargetPackage(result.data.package); setProjectRoot(result.data.projectRoot); setSavedTarget(result.data)
      setTargetMessage('Project settings saved. Source claims will refresh shortly.')
    } finally { setBusy(false) }
  }
  const settingsSaved = savedTarget && targetPackage === savedTarget.package && projectRoot === savedTarget.projectRoot
  const currentPin = settingsSaved ? captureAndroidSelection(view, savedTarget) : null
  const ready = !!settingsSaved && androidDraftReady(pins, view, savedTarget)
  const draft = formatAndroidDraft({ slug, intent, pins })
  function pinSelection() {
    if (!currentPin) return
    setPins(existing => addAndroidPin(existing, currentPin))
    setDraftMessage('Selection captured. Pins are snapshots; reselect after changes.')
  }
  async function revalidateDraft() {
    const latest = await call('studio.qalens.selection', { slug, fresh: true })
    if (!latest.ok || !androidDraftReady(pins, latest.data, savedTarget)) {
      setView(latest.ok ? latest.data : null)
      setActionError('Connection or target changed. Reconnect and pin the current selections again.')
      return false
    }
    return true
  }
  async function copyDraft() {
    if (!ready || !reviewOpen || !intent.trim()) return
    setBusy(true); setActionError(''); setDraftMessage('')
    try {
      if (!await revalidateDraft()) return
      await navigator.clipboard.writeText(draft)
      setDraftMessage('Draft copied. Review the snapshot before using it.')
    } catch (_) { setActionError('Clipboard unavailable. Select and copy the review text below.') }
    finally { setBusy(false) }
  }
  async function askAboutDraft() {
    if (!ready || !reviewOpen || !intent.trim()) return
    setBusy(true); setActionError(''); setDraftMessage('')
    try {
      if (!await revalidateDraft()) return
      const sessions = runtime && runtime.ctx && typeof runtime.ctx.get === 'function' ? runtime.ctx.get('sessions') : null
      const binding = sessions && typeof sessions.binding === 'function' && sessionId ? sessions.binding(sessionId) : null
      if (!binding || !binding.session || typeof binding.session.prompt !== 'function') {
        setActionError('Main chat is unavailable. Copy the draft and paste it into the conversation.')
        return
      }
      const result = await binding.session.prompt([{ type: 'text', text: draft }], 'queue')
      if (!result || result.ok !== true) { setActionError('The main chat rejected the investigation request.'); return }
      setDraftMessage('Plan request queued. Main chat retains its normal tool permissions.')
    } catch (err) { setActionError(String((err && err.message) || err)) }
    finally { setBusy(false) }
  }
  const companion = (view && view.companion) || {}
  const content = companion.component && companion.component.content
  const component = content && content.component
  const claim = view && view.claim
  const candidates = claim && Array.isArray(claim.candidates) ? claim.candidates : []
  const targetChanged = !!(savedTarget && view && view.target && (savedTarget.package !== view.target.package || savedTarget.projectRoot !== view.target.projectRoot))
  async function reloadTarget() {
    setBusy(true); setActionError(''); setTargetMessage(''); generation.current++
    try {
      const result = await call('studio.qalens.target', { slug })
      if (!result.ok) { setActionError(result.error || 'Could not read project settings'); return }
      setTargetPackage(result.data.package || ''); setProjectRoot(result.data.projectRoot || ''); setSavedTarget(result.data)
      setTargetMessage('Project settings reloaded. Re-pin elements if the target changed.')
    } finally { setBusy(false) }
  }
  const statusText = !view ? 'Checking connection…' : companion.connected ? 'Phone connected' :
    companion.phase === 'awaiting-approval' ? 'Waiting for phone approval' : companion.url ? 'Phone not connected' : 'Not connected'
  return h('div', { className: 'ds-qa' },
    h('section', { className: 'ds-qa-connection ds-panel', 'aria-label': 'QaLens connection' },
      h('div', { className: 'ds-qa-connection-head' },
        h('div', null,
          h('div', { className: 'ds-qa-eyebrow' }, 'ANDROID INSPECTOR'),
          h('h3', null, 'QaLens'),
          h('div', { className: 'ds-qa-status', role: 'status' },
            h('span', { className: 'ds-qa-dot' + (companion.connected ? ' on' : ''), 'aria-hidden': 'true' }), statusText)),
        h('div', { className: 'ds-qa-actions' },
          companion.url && companion.state === 'ready' ? h('a', { className: 'ds-btn ds-btn-primary', href: companion.url, target: '_blank', rel: 'noopener noreferrer' }, 'Open QaLens') :
            h(Btn, { label: busy ? 'Starting…' : 'Start QaLens', primary: true, onClick: () => connect('start'), disabled: busy }),
          companion.url && companion.state !== 'ready' ? h(Btn, { label: 'Retry connection', onClick: () => connect('attach', companion.url), disabled: busy }) : null,
          h('details', { className: 'ds-qa-connection-menu' },
            h('summary', null, 'Connection'),
            h('div', { className: 'ds-qa-connection-form' },
              h('p', null, 'Attach to an existing local workbench, or start one configured on this host.'),
              h('label', { className: 'ds-field' }, h('span', null, 'Workbench URL'),
                h('input', { className: 'ds-input', value: url, disabled: busy, onChange: e => setUrl(e.target.value), placeholder: 'http://127.0.0.1:port' })),
              h('div', { className: 'ds-qa-actions' },
                h(Btn, { label: 'Attach', onClick: () => connect('attach'), disabled: busy || !url.trim() }),
                companion.url ? h(Btn, { label: 'Disconnect', onClick: () => connect('stop'), disabled: busy }) : null))))) ,
      !companion.connected ? h('p', { className: 'ds-qa-help' }, 'Open QaLens, connect your app and approve on the phone. Enable Link selections to follow your selection here.') : null,
      h('details', { className: 'ds-qa-settings' },
        h('summary', null, 'Project settings'),
        h('div', { className: 'ds-qa-settings-fields' },
          h('p', { className: 'ds-qa-help' }, 'Bind the app package and source root to check source claims.'),
          h('label', { className: 'ds-field' }, h('span', null, 'Android package'),
            h('input', { className: 'ds-input', value: targetPackage, disabled: busy, onChange: e => setTargetPackage(e.target.value), placeholder: 'com.example.app' })),
          h('label', { className: 'ds-field' }, h('span', null, 'Source project root'),
            h('input', { className: 'ds-input', value: projectRoot, disabled: busy, onChange: e => setProjectRoot(e.target.value), placeholder: '/absolute/path/to/project' })),
          h('div', { className: 'ds-qa-actions' },
            h(Btn, { label: 'Save project settings', onClick: saveTarget, disabled: busy || !targetPackage.trim() || !projectRoot.trim() }),
            h(Btn, { label: 'Reload settings', onClick: reloadTarget, disabled: busy })),
          targetMessage ? h('div', { className: 'ds-hint', role: 'status' }, targetMessage) : null)),
      actionError ? h(Err, { text: actionError }) : null,
      error ? h(Err, { text: error }) : null,
      companion.error ? h(Err, { text: companion.error }) : null,
      view && view.mismatch ? h('div', { className: 'ds-err' }, view.mismatch) : null,
      targetChanged ? h('div', { className: 'ds-err' }, 'Project settings changed elsewhere. Open Project settings and choose Reload settings.') : null,
      savedTarget && !settingsSaved ? h('div', { className: 'ds-qa-help' }, 'Save or reload project settings to use the current selection.') : null),
    h('div', { className: 'ds-qa-workspace' },
      h('section', { className: 'ds-qa-card ds-panel', 'aria-label': 'Selected element' },
        h('div', { className: 'ds-qa-card-head' },
          h('div', null, h('div', { className: 'ds-qa-eyebrow' }, 'SELECTED ELEMENT'),
            h('h3', null, component ? component.label || component.role || 'Selected element' : 'Choose an element')),
          component ? h(Btn, { label: 'Pin selection', onClick: pinSelection, disabled: !currentPin || pins.length >= 8 || busy }) : null),
        component ? h(React.Fragment, null,
          h('dl', { className: 'ds-qa-metadata' },
            h('div', null, h('dt', null, 'Tag'), h('dd', null, component.tag || 'None')),
            h('div', null, h('dt', null, 'Role'), h('dd', null, component.role || 'Unknown')),
            h('div', null, h('dt', null, 'Screen'), h('dd', null, (companion.selection && (companion.selection.screen || companion.selection.route)) || 'Unknown')),
            h('div', null, h('dt', null, 'Actions'), h('dd', null, (companion.selection && companion.selection.actions && companion.selection.actions.length) ? companion.selection.actions.join(', ') : 'Unavailable'))),
          companion.selection && companion.selection.snapshotWarning ? h('div', { className: 'ds-qa-help' }, companion.selection.snapshotWarning) : null,
          claim ? h('div', { className: 'ds-qa-source' },
            h('div', { className: 'ds-qa-source-head' }, h('strong', null, 'Source'), h('span', { className: 'ds-qa-claim' }, claim.state)),
            candidates.length ? h('div', { className: 'ds-qa-location' }, candidates[0].file + ':' + candidates[0].line + (candidates[0].symbol ? ' · ' + candidates[0].symbol : '')) : null,
            h('p', { className: 'ds-qa-help' }, claim.reason),
            candidates.length ? h('details', null, h('summary', null, 'Source evidence'),
              candidates.map((candidate, i) => h('div', { key: i, className: 'ds-qa-source-evidence' },
                h('div', null, candidate.file + ':' + candidate.line + (candidate.symbol ? ' · ' + candidate.symbol : '')),
                candidate.sourceSha256 ? h('div', { className: 'ds-qa-help' }, 'SHA-256: ' + candidate.sourceSha256) : null,
                candidate.snippet ? h('pre', null, candidate.snippet) : null))) : null) : null,
          h('details', { className: 'ds-qa-details' }, h('summary', null, 'Component details · may contain private values'),
            h('pre', null, JSON.stringify({ bounds: component.bounds || null, attributes: component.attributes || [], tree: content.tree || null }, null, 2).slice(0, 12000)))) :
          h('p', { className: 'ds-qa-empty' }, companion.connected ? 'Select an element in QaLens to see its details and source.' : 'Connect QaLens, then select an element on the phone or in the workbench.')),
      h('section', { className: 'ds-qa-card ds-panel', 'aria-label': 'Android design draft' },
        h('div', { className: 'ds-qa-card-head' },
          h('div', null, h('div', { className: 'ds-qa-eyebrow' }, 'DESIGN REQUEST'), h('h3', null, 'What should change?')),
          h('span', { className: 'ds-qa-count' }, pins.length + ' / 8 pinned')),
        h('p', { className: 'ds-qa-help' }, 'Pin elements to include them in one request. Pins are snapshots and can become stale.'),
        pins.length ? h('div', { className: 'ds-qa-pins' },
          pins.map((pin, index) => h('div', { className: 'ds-qa-pin', key: pin.key },
            h('span', null, (pin.tag || pin.role || 'Element') + ' · ' + (pin.screen || pin.route || 'screen unknown') + ' · ' + pin.claim.state),
            h(Btn, { label: 'Remove', onClick: () => setPins(items => items.filter((_, i) => i !== index)), disabled: busy }))),
          h(Btn, { label: 'Clear pins', onClick: () => setPins([]), disabled: busy })) :
          h('div', { className: 'ds-qa-empty ds-qa-empty-pin' }, 'No elements pinned yet.'),
        pins.length && !ready ? h('div', { className: 'ds-err' }, 'Connection, target, or settings changed. Clear pins and select again before sending.') : null,
        h('label', { className: 'ds-field ds-qa-intent' }, h('span', null, 'Describe your change'),
          h('textarea', { className: 'ds-input', value: intent, disabled: busy, maxLength: 4000, rows: 4, placeholder: 'For example, make the button easier to notice', onChange: e => setIntent(e.target.value) })),
        h('div', { className: 'ds-qa-suggestions', 'aria-label': 'Suggested requests' },
          ['Improve spacing and visual hierarchy', 'Review typography and contrast', 'Review accessibility and touch targets'].map(text =>
            h(Btn, { key: text, label: text, onClick: () => setIntent(text), disabled: busy }))),
        h('details', { className: 'ds-qa-review', open: reviewOpen, onToggle: e => setReviewOpen(e.currentTarget.open) },
          h('summary', null, 'Review request before sending'),
          h('p', { className: 'ds-qa-help' }, 'Tags, routes and paths can contain sensitive data. Main chat retains its normal tool permissions.'),
          h('pre', null, draft)),
        h('div', { className: 'ds-qa-actions' },
          h(Btn, { label: 'Ask DeepSeek to investigate', primary: true, onClick: askAboutDraft, disabled: busy || !ready || !intent.trim() || !reviewOpen }),
          h(Btn, { label: 'Copy draft', onClick: copyDraft, disabled: busy || !ready || !intent.trim() || !reviewOpen })),
        !reviewOpen && pins.length ? h('div', { className: 'ds-qa-help' }, 'Open the request review to enable sending or copying.') : null,
        draftMessage ? h('div', { className: 'ds-qa-help', role: 'status' }, draftMessage) : null)))
}

function AndroidPanel({ slug, sessionId, active, onBusyChange }) {
  const [status, setStatus] = React.useState(null)
  const [shot, setShot] = React.useState(null)
  const [nodes, setNodes] = React.useState([])
  const [selected, setSelected] = React.useState(null)
  const [locator, setLocator] = React.useState(null)
  const [hoverNode, setHoverNode] = React.useState(null)
  const [live, setLive] = React.useState(true)
  const [busy, setBusyState] = React.useState('')
  function setBusy(value) { setBusyState(value); if (onBusyChange) onBusyChange(Boolean(value)) }
  const [err, setErr] = React.useState('')
  const [log, setLog] = React.useState('')
  const [editMsg, setEditMsg] = React.useState('')
  const [regions, setRegions] = React.useState([])
  const [changed, setChanged] = React.useState(0)
  const [context, setContext] = React.useState(null)
  const [buildLog, setBuildLog] = React.useState('')
  const [buildInfo, setBuildInfo] = React.useState(null)
  const [configOpen, setConfigOpen] = React.useState(false)
  const [selectionOpen, setSelectionOpen] = React.useState(false)
  const [selectedStale, setSelectedStale] = React.useState(false)
  const [tab, setTab] = React.useState('inspect')
  const [treeQuery, setTreeQuery] = React.useState('')
  const [showChanges, setShowChanges] = React.useState(false)
  const [tapMode, setTapMode] = React.useState(false)
  const [form, setForm] = React.useState({ url: 'http://127.0.0.1:4723', appPackage: '', appActivity: '', deviceName: 'Android', projectRoot: '', buildTask: ':app:assembleDebug', apkPath: 'app/build/outputs/apk/debug/app-debug.apk', javaHome: '', androidHome: '' })
  const inFlight = React.useRef(false)
  const autoConnectRef = React.useRef(false)
  const skipAutoRef = React.useRef(appiumWasDisconnected(slug))
  const baselineRef = React.useRef(null)
  const shotImgRef = React.useRef(null)
  const selectedRef = React.useRef(null)
  const hoverSeq = React.useRef(0)
  const lastHoverAt = React.useRef(0)
  const runtimeEpoch = React.useRef(0)
  const pendingReads = React.useRef(new Set())
  const inputBusyRef = React.useRef(false)

  function trackedRead(method, args) {
    const pending = apCall(method, args)
    pendingReads.current.add(pending)
    pending.then(() => pendingReads.current.delete(pending), () => pendingReads.current.delete(pending))
    return pending
  }

  function clearRuntime() {
    runtimeEpoch.current += 1
    hoverSeq.current += 1
    selectedRef.current = null
    baselineRef.current = null
    shotImgRef.current = null
    setShot(null); setNodes([]); setSelected(null); setLocator(null); setHoverNode(null)
    setSelectedStale(false); setSelectionOpen(false); setContext(null)
    setRegions([]); setChanged(0); setShowChanges(false); setTapMode(false)
  }

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
      javaHome: cfg.javaHome || '',
      androidHome: cfg.androidHome || '',
    })
  }

  async function refreshStatus() {
    const epoch = runtimeEpoch.current
    const res = await trackedRead('status', { slug })
    if (epoch !== runtimeEpoch.current) return
    if (res.ok) {
      if (!res.data || !res.data.session) clearRuntime()
      applyStatus(res.data)
    } else setErr(res.error || 'could not read the Android target')
  }

  async function loadContext(tag) {
    const epoch = runtimeEpoch.current
    const res = await trackedRead('context', { slug, tag: tag || undefined })
    if (epoch === runtimeEpoch.current && res.ok) setContext(res.data)
  }

  async function navigateRoute(route) {
    if (!active || busy || inputBusyRef.current || !status || !status.session) return
    inputBusyRef.current = true
    setBusy('navigating to ' + route + '…')
    setErr('')
    try {
      const res = await apCall('navigate', { slug, route })
      if (!res.ok) {
        setErr(res.error || 'navigation failed')
        return
      }
      if (!res.data.ok) {
        setLog(res.data.reason || 'this app has no routable tag for ' + route)
        return
      }
      setLog('navigated to ' + route + ' · tapped ' + (res.data.node && res.data.node.resourceId ? res.data.node.resourceId : 'tag'))
      await refreshAll()
      await loadContext('').catch(() => {})
    } finally {
      inputBusyRef.current = false
      setBusy('')
    }
  }

  async function refreshAll() {
    if (inFlight.current) return
    inFlight.current = true
    const epoch = runtimeEpoch.current
    try {
      const [shotRes, treeRes] = await Promise.all([trackedRead('shot', { slug }), trackedRead('tree', { slug })])
      if (epoch !== runtimeEpoch.current) return
      if (!shotRes.ok || !treeRes.ok) {
        clearRuntime()
        setErr((!shotRes.ok && shotRes.error) || (!treeRes.ok && treeRes.error) || 'Could not refresh the app view')
        refreshStatus().catch(() => {})
        return
      }
      if (shotRes.ok) setShot({ url: shotRes.data.path, w: shotRes.data.w, h: shotRes.data.h, ts: Date.now() })
      else {
        setErr(shotRes.error || 'screenshot failed')
        refreshStatus().catch(() => {})
      }
      if (treeRes.ok) {
        const nextNodes = treeRes.data.nodes || []
        setNodes(nextNodes)
        const current = selectedRef.current
        loadContext(selectedRef.current && selectedRef.current.resourceId ? selectedRef.current.resourceId : '').catch(() => {})
        if (current) {
          const match = nextNodes.find((node) =>
            (current.resourceId && node.resourceId === current.resourceId) ||
            (!current.resourceId && current.text && node.text === current.text && node.className === current.className) ||
            (!current.resourceId && !current.text && current.contentDesc && node.contentDesc === current.contentDesc)
          )
          if (match) {
            selectedRef.current = match
            setSelected(match)
            setLocator(locatorFromNode(match))
            setSelectedStale(false)
          } else {
            setSelectedStale(true)
          }
        }
      }
    } finally {
      inFlight.current = false
    }
  }

  React.useEffect(() => {
    if (!active) return undefined
    function onKey(event) {
      if (event.key !== 'Escape') return
      setSelectionOpen(false)
      setConfigOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active])

  React.useEffect(() => {
    if (!active) return undefined
    clearRuntime()
    refreshStatus().catch((e) => setErr(String((e && e.message) || e)))
    return () => { runtimeEpoch.current += 1; hoverSeq.current += 1 }
  }, [slug, active])

  React.useEffect(() => {
    if (!active || !live || !status || !status.session) return undefined
    let cancelled = false
    refreshAll()
    const timer = setInterval(() => {
      if (!cancelled) refreshAll()
    }, 3000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [active, live, slug, status && status.session && status.session.id])

  React.useEffect(() => {
    if (!active || !status) return
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
        setBusy('')
      }
    })()
    return () => { cancelled = true }
  }, [active, slug, status && status.session && status.session.id, status && status.config && status.config.capabilities && status.config.capabilities['appium:appPackage']])

  async function buildInstall() {
    setBusy('building & installing…')
    setErr('')
    try {
      const res = await apCall('build', { slug })
      if (!res.ok) {
        setErr(res.error || 'build failed')
        return
      }
      setBuildInfo(res.data)
      setBuildLog(res.data.log || '')
      setShowChanges(false)
      setLog('built in ' + (res.data.buildMs / 1000).toFixed(1) + 's · installed in ' + (res.data.installMs / 1000).toFixed(1) + 's' + (res.data.restarted ? ' · restarted' : ''))
      if (!res.data.restarted && res.data.restartError) setErr(res.data.restartError)
      await refreshStatus()
      await refreshAll()
    } finally {
      setBusy('')
    }
  }

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
          javaHome: form.javaHome,
          androidHome: form.androidHome,
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
      rememberAppiumDisconnect(slug, false)
      setConfigOpen(false)
      setLog('connected ' + (connected.data && connected.data.session ? connected.data.session.id : 'Android app'))
      await refreshStatus()
      await refreshAll()
    } finally {
      setBusy('')
    }
  }

  async function disconnect() {
    skipAutoRef.current = true
    rememberAppiumDisconnect(slug, true)
    setBusy('disconnecting…')
    setErr('')
    clearRuntime()
    setStatus((prev) => (prev ? Object.assign({}, prev, { session: null }) : prev))
    try {
      await Promise.allSettled(Array.from(pendingReads.current))
      const result = await apCall('disconnect', {})
      if (!result.ok) { setErr(result.error || 'disconnect failed'); return }
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
      setShowChanges(false)
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
    } finally {
      setBusy('')
    }
  }

  async function tapSelected(index) {
    if (!active || busy || inputBusyRef.current || selectedStale || !status || !status.session) return
    inputBusyRef.current = true
    setBusy('tapping…')
    setErr('')
    try {
      const result = await apCall('tap', { slug, index })
      if (!result.ok) { setErr(result.error || 'tap failed'); return }
      setLog('tapped node ' + index)
      await refreshAll()
    } finally { inputBusyRef.current = false; setBusy('') }
  }

  function chooseSelected(node, locatorValue) {
    selectedRef.current = node
    setSelected(node)
    setLocator(locatorValue || locatorFromNode(node))
    setSelectedStale(false)
    setSelectionOpen(true)
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
    trackedRead('hover', { slug, x, y }).then((res) => {
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
    if (!active || busy || inputBusyRef.current || !status || !status.session || !shot || !shot.w || !shot.h) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.round(((e.clientX - rect.left) / rect.width) * shot.w)
    const y = Math.round(((e.clientY - rect.top) / rect.height) * shot.h)
    if (tapMode) {
      inputBusyRef.current = true
      setBusy('tapping (' + x + ', ' + y + ')…')
      apCall('tap', { slug, x, y })
        .then((res) => {
          if (res.ok) { setLog('tapped at (' + x + ', ' + y + ')'); return refreshAll(); }
          setErr(res.error || 'tap failed')
        })
        .finally(() => { inputBusyRef.current = false; setBusy('') })
      return
    }
    const epoch = runtimeEpoch.current
    trackedRead('select', { slug, x, y }).then((res) => {
      if (epoch !== runtimeEpoch.current) return
      if (res.ok) {
        chooseSelected(res.data.node, res.data.locator)
        loadContext(res.data.node.resourceId || '').catch(() => {})
      } else setErr(res.error || 'select failed')
    })
  }

  function selectNode(node) {
    const epoch = runtimeEpoch.current
    trackedRead('select', { slug, index: node.index }).then((res) => {
      if (epoch !== runtimeEpoch.current) return
      if (res.ok) {
        chooseSelected(res.data.node, res.data.locator)
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
      const sourceLine = context && context.tag && context.tag.definitions && context.tag.definitions.length
        ? 'Source: ' + context.tag.definitions.map((d) => d.file + ':' + d.line + (d.function ? ' (' + d.function + ')' : '')).join(', ') + (context.tag.usages && context.tag.usages.length ? ' · used in ' + context.tag.usages.length + ' places' : '')
        : ''
      const detail = [
        'Design Studio Android project "' + slug + '": change request.',
        selectedStale ? 'Warning: the selected node is no longer in the current tree; it may have moved or the screen changed.' : '',
        context ? 'Current screen: ' + (context.screenLabel || 'unknown') + ' (' + (context.activity || 'unknown activity') + ').' : '',
        screenRoutes.length ? 'App routes: ' + screenRoutes.slice(0, 12).map((r) => r.route).join(', ') + '.' : '',
        sourceLine,
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

  const sourceText = context && context.tag && context.tag.definitions && context.tag.definitions.length
    ? context.tag.definitions.map((d) => d.file + ':' + d.line + (d.function ? ' (' + d.function + ')' : '')).join(', ') + (context.tag.usages && context.tag.usages.length ? ' · used in ' + context.tag.usages.length + ' places' : '')
    : ''
  const filteredNodes = (treeQuery.trim()
    ? nodes.filter((node) => [node.text, node.contentDesc, node.resourceId, node.className].filter(Boolean).join(' ').toLowerCase().includes(treeQuery.trim().toLowerCase()))
    : nodes).slice(0, 300)
  const screenRoutes = context ? context.routes.filter((route) => route.kind !== 'navigation') : []
  const navTargets = context && Array.isArray(context.navTargets) ? context.navTargets : []
  const tabList = [['inspect', 'Inspect'], ['screens', 'Screens'], ['source', 'Source']]

  return h(
    'div',
    { className: 'ds-app' },
    h(
      'div',
      { className: 'ds-app-bar' },
      h(
        'div',
        { className: 'ds-app-title' },
        h('span', { className: 'ds-caps' }, 'Android app'),
        h('span', { className: 'ds-hint' }, status ? (session ? 'Connected' : 'Not connected') + (reachable ? '' : ' · Appium offline') : 'loading…'),
        context && context.screenLabel ? h('span', { className: 'ds-chip on' }, context.screenLabel) : null,
        context && context.adapter ? h('span', { className: 'ds-chip' }, context.adapter.label) : null,
        buildInfo ? h('span', { className: 'ds-chip' }, (buildInfo.buildMs / 1000).toFixed(1) + 's') : null,
      ),
      h(
        'div',
        { className: 'ds-app-toolbar' },
        session
          ? null
          : h(Btn, { label: 'Connect Android app', primary: true, onClick: () => setConfigOpen(true), disabled: busy !== '' }),
        session && status && status.config && status.config.projectRoot
          ? h(Btn, { label: 'Build & install', primary: true, onClick: buildInstall, disabled: busy !== '' })
          : null,
        session ? h(Btn, { label: 'Restart', onClick: restart, disabled: busy !== '' }) : null,
        session ? h(Btn, { label: 'Capture', onClick: capture, disabled: busy !== '' || !shot }) : null,
        session
          ? h('button', {
              type: 'button',
              className: 'ds-chip' + (tapMode ? ' on' : ''),
              title: tapMode ? 'Tap mode: clicking the app sends a tap' : 'Select mode: clicking inspects a node',
              onClick: () => setTapMode(!tapMode),
            }, tapMode ? 'Tap mode' : 'Select mode')
          : null,
        h(
          'details',
          { className: 'ds-app-more' },
          h('summary', null, 'More'),
          h(
            'div',
            { className: 'ds-app-menu' },
            session ? h(Btn, { label: live ? 'Pause live' : 'Go live', onClick: () => setLive(!live), disabled: busy !== '' }) : null,
            session ? h(Btn, { label: 'Refresh', onClick: refreshAll, disabled: busy !== '' }) : null,
            session ? h(Btn, { label: 'Disconnect', onClick: disconnect, disabled: busy !== '' }) : null,
            h(Btn, { label: 'Configure', onClick: () => setConfigOpen(true), disabled: busy !== '' }),
          ),
        ),
      ),
    ),
    err
      ? h('div', { className: 'ds-app-banner err' },
          h('span', null, err),
          h('button', { type: 'button', className: 'ds-app-x', onClick: () => setErr(''), title: 'Dismiss' }, '×'),
        )
      : null,
    log
      ? h('div', { className: 'ds-app-banner' },
          h('span', null, log),
          h('button', { type: 'button', className: 'ds-app-x', onClick: () => setLog(''), title: 'Dismiss' }, '×'),
        )
      : null,
    context && context.packageMismatch
      ? h('div', { className: 'ds-app-banner err' },
          h('span', null, 'Live session is on ' + context.actualPackage + ', but this project expects ' + context.package + '. Reconnect or foreground the target app.'),
        )
      : null,
    busy ? h('div', { className: 'ds-app-progress', title: busy }) : null,
    !session && status
      ? h('div', { className: 'ds-hint' }, 'Bind this project with Appium to inspect and edit the real UI.')
      : null,
    h(
      'div',
      { className: 'ds-app-editor' },
      h(
        'div',
        { className: 'ds-app-canvas' },
        shot
          ? h(
              'div',
              null,
              h('div', { className: 'ds-row', style: { justifyContent: 'space-between', marginBottom: '6px' } },
                h('span', { className: 'ds-hint' }, tapMode ? 'Tap mode: click sends a tap (use for navigation).' : 'Select mode: click inspects. Hover highlights.'),
                h('label', { className: 'ds-app-toggle' },
                  h('input', { type: 'checkbox', checked: showChanges, onChange: (e) => setShowChanges(e.target.checked) }),
                  'Changes' + (showChanges && changed ? ' · ' + (changed * 100).toFixed(0) + '%' : ''),
                ),
              ),
              h('div', { style: { position: 'relative', lineHeight: '0', maxWidth: '420px' } },
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
                showChanges ? regions.map((region, index) => h('div', {
                  key: 'ap-region-' + index,
                  title: region.label || 'changed region',
                  style: { position: 'absolute', left: region.x * 100 + '%', top: region.y * 100 + '%', width: region.w * 100 + '%', height: region.h * 100 + '%', border: '1.5px solid #ff5d73', background: 'rgba(255,93,115,.10)', borderRadius: '4px', pointerEvents: 'none' },
                })) : null,
                hoverBox ? h('div', { style: { position: 'absolute', left: hoverBox.left, top: hoverBox.top, width: hoverBox.width, height: hoverBox.height, border: '1.5px dashed #3be1ec', background: 'rgba(59,225,236,.08)', borderRadius: '4px', pointerEvents: 'none' } }) : null,
                box ? h('div', { style: { position: 'absolute', left: box.left, top: box.top, width: box.width, height: box.height, border: '2px solid #ff5d73', background: 'rgba(255,93,115,.12)', borderRadius: '4px', pointerEvents: 'none' } }) : null,
              ),
              h('div', { className: 'ds-row', style: { marginTop: '6px' } }, h(Btn, { label: 'Re-pin baseline', onClick: pinBaseline })),
            )
          : h('div', { className: 'ds-hint' }, session ? 'Waiting for the first frame…' : 'Connect an Android app to start.'),
        selected
          ? h(
              'div',
              { className: 'ds-row', style: { alignItems: 'center', marginTop: '10px', flexWrap: 'wrap' } },
              h('span', { className: 'ds-hint' }, 'Selected: ' + String(selected.text || selected.contentDesc || selected.resourceId || selected.className || 'node').slice(0, 52) + (selectedStale ? ' · stale' : '')),
              h(Btn, { label: 'Request change', primary: true, onClick: () => setSelectionOpen(true), disabled: busy !== '' }),
              h(Btn, { label: 'Tap', onClick: () => tapSelected(selected.index), disabled: busy !== '' || selectedStale || !session }),
            )
          : null,
      ),
      h(
        'div',
        null,
        h(
          'div',
          { className: 'ds-workspace-tabs', role: 'tablist' },
          tabList.map(([id, label]) => h('button', {
            key: id,
            type: 'button',
            role: 'tab',
            'aria-selected': tab === id,
            className: 'ds-seg' + (tab === id ? ' on' : ''),
            onClick: () => setTab(id),
          }, label)),
        ),
        tab === 'inspect'
          ? h(
              'div',
              { className: 'ds-panel', style: { padding: '12px' } },
              selected
                ? h(
                    'div',
                    null,
                    h('div', { className: 'ds-caps' }, (selected.className || 'node') + '  #' + selected.index),
                    selectedStale ? h('div', { className: 'ds-err' }, 'This selection is not in the current tree; the screen may have changed.') : null,
                    h('div', { className: 'ds-hint' }, 'bounds ' + (selected.bounds ? selected.bounds.x + ',' + selected.bounds.y + ' ' + selected.bounds.w + '×' + selected.bounds.h : '—') + (selected.clickable ? ' · clickable' : '')),
                    selected.text ? h('div', { className: 'ds-hint' }, 'text: ' + selected.text) : null,
                    selected.contentDesc ? h('div', { className: 'ds-hint' }, 'content-desc: ' + selected.contentDesc) : null,
                    selected.resourceId ? h('div', { className: 'ds-hint' }, 'id: ' + selected.resourceId) : null,
                    locator ? h('div', { className: 'ds-hint' }, 'locator: ' + locator.using + ' = ' + locator.value) : null,
                    sourceText ? h('div', { className: 'ds-hint' }, 'source: ' + sourceText) : null,
                    h('div', { className: 'ds-row', style: { marginTop: '8px' } },
                      h(Btn, { label: 'Request change', primary: true, onClick: () => setSelectionOpen(true), disabled: busy !== '' }),
                      locator ? h(Btn, { label: 'Copy locator', onClick: () => { try { navigator.clipboard.writeText(locator.using + '=' + locator.value); setLog('locator copied') } catch (_) {} } }) : null,
                    ),
                  )
                : h('div', { className: 'ds-hint' }, 'Click a part of the app, or pick a row from the tree.'),
              h('div', { className: 'ds-row', style: { margin: '10px 0 6px' } },
                h('input', { className: 'ds-input', placeholder: 'Filter tree by text, id or class…', value: treeQuery, onChange: (e) => setTreeQuery(e.target.value) }),
                h('span', { className: 'ds-hint' }, filteredNodes.length + '/' + nodes.length),
              ),
              h(
                'div',
                { className: 'ds-app-tree' },
                filteredNodes.map((node) => h('button', {
                  key: node.index,
                  type: 'button',
                  title: node.className + ' ' + (node.resourceId || ''),
                  style: { display: 'block', width: '100%', textAlign: 'left', border: 0, color: 'inherit', cursor: 'pointer', paddingLeft: 2 + node.depth * 10 + 'px', whiteSpace: 'nowrap', borderRadius: '4px', background: selected && selected.index === node.index ? 'rgba(255,93,115,.16)' : (hoverNode && hoverNode.index === node.index ? 'rgba(59,225,236,.12)' : 'transparent') },
                  onMouseEnter: () => hoverTreeNode(node),
                  onMouseLeave: () => hoverTreeNode(null),
                  onClick: () => selectNode(node),
                }, (node.text || node.contentDesc || node.resourceId || node.className || 'node').slice(0, 130))),
              ),
            )
          : tab === 'screens'
            ? h(
                'div',
                { className: 'ds-panel', style: { padding: '12px' } },
                context
                  ? h(
                      'div',
                      null,
                      h('div', { className: 'ds-caps' }, 'Current screen'),
                      h('div', { className: 'ds-hint' }, (context.screenLabel || 'no SCREEN_ tag') + ' · ' + (context.activity || 'unknown activity')),
                      h('div', { className: 'ds-caps', style: { marginTop: '10px' } }, 'On this screen · ' + navTargets.length),
                      navTargets.length
                        ? h('div', { className: 'ds-chips', style: { marginTop: '6px' } },
                            navTargets.map((target, index) => h('button', {
                              key: 'nav-' + index,
                              type: 'button',
                              className: 'ds-chip',
                              disabled: busy !== '',
                              title: target.tag,
                              onClick: () => navigateRoute(target.route),
                            }, target.label + '  ·  ' + target.tag)),
                          )
                        : h('div', { className: 'ds-hint' }, 'No tagged navigation controls on this screen. Add NAV_<DEST> to a button to make it tappable here.'),
                      h('details', { className: 'ds-hint', style: { marginTop: '10px' } },
                        h('summary', null, 'Project routes · ' + screenRoutes.length + ' (reference)'),
                        screenRoutes.map((route, index) => h('div', { key: 'route-' + index }, route.route + '  ·  ' + route.file)),
                      ),
                    )
                  : h('div', { className: 'ds-hint' }, 'No project context yet. Connect and refresh.'),
              )
            : tab === 'source'
              ? h(
                  'div',
                  { className: 'ds-panel', style: { padding: '12px' } },
                  h('div', { className: 'ds-caps' }, 'Source adapter'),
                  h('div', { className: 'ds-hint' }, context && context.adapter ? context.adapter.label + ' · ' + Object.keys(context.adapter.capabilities || {}).filter((key) => context.adapter.capabilities[key]).join(', ') : 'none'),
                  context && context.adapter && !context.adapter.capabilities.source
                    ? h('div', { className: 'ds-hint' }, context.adapter.reason || 'Runtime only; no source graph is available for this app.')
                    : null,
                  h('div', { className: 'ds-caps', style: { marginTop: '10px' } }, 'Project'),
                  h('div', { className: 'ds-hint' }, context && context.projectRoot ? context.projectRoot : 'projectRoot is not configured'),
                  h('div', { className: 'ds-hint' }, status && status.config ? (status.config.buildTask || '—') + ' → ' + (status.config.apkPath || '—') : ''),
                  h('div', { className: 'ds-hint' }, status && status.config ? 'JAVA_HOME ' + (status.config.javaHome || '(env)') + ' · ANDROID_HOME ' + (status.config.androidHome || '(env)') : ''),
                  h('div', { className: 'ds-caps', style: { marginTop: '10px' } }, 'Graph'),
                  h('div', { className: 'ds-hint' }, context && context.adapter && context.adapter.capabilities.source
                    ? (context.components || []).length + ' tagged components · ' + (context.tokens || []).length + ' color tokens · ' + screenRoutes.length + ' routes'
                    : 'Components, routes and tokens are unsupported for this app.'),
                  h('div', { className: 'ds-caps', style: { marginTop: '10px' } }, 'Selected tag'),
                  h('div', { className: 'ds-hint' }, sourceText || (context && context.adapter && !context.adapter.capabilities.source ? 'Runtime only — select by tree; no source mapping.' : 'No testTag match. Add Modifier.testTag(...) to map this part to source.')),
                  h('div', { className: 'ds-caps', style: { marginTop: '10px' } }, 'Build log'),
                  buildLog
                    ? h('details', null,
                        h('summary', { className: 'ds-hint' }, (buildInfo ? (buildInfo.buildMs / 1000).toFixed(1) + 's build · ' + (buildInfo.installMs / 1000).toFixed(1) + 's install' : 'last build') + (buildInfo && buildInfo.restarted ? ' · restarted' : '')),
                        h('pre', { style: { maxHeight: '240px', overflow: 'auto', fontSize: '10px', whiteSpace: 'pre-wrap' } }, buildLog.slice(-16000)),
                      )
                    : h('div', { className: 'ds-hint' }, 'No build yet. Use Build & install.'),
                )
              : null,
      ),
    ),
    selected && selectionOpen
      ? h(
          'div',
          { className: 'ds-modal-backdrop', onClick: (e) => { if (e.target === e.currentTarget) setSelectionOpen(false) } },
          h(
            'div',
            { className: 'ds-modal' },
            h('div', { className: 'ds-modal-title' }, h('span', null, 'Selected part'), h('span', { className: 'ds-sel-path' }, slug + (context && context.screenLabel ? ' · ' + context.screenLabel : ''))),
            selectedStale ? h('div', { className: 'ds-err' }, 'The node is stale — the tree changed after selection.') : null,
            h('div', { className: 'ds-hint' }, (selected.className || 'node') + '  #' + selected.index),
            h('div', { className: 'ds-hint' }, 'bounds ' + (selected.bounds ? selected.bounds.x + ',' + selected.bounds.y + ' ' + selected.bounds.w + '×' + selected.bounds.h : '—') + (selected.clickable ? ' · clickable' : '')),
            selected.text ? h('div', { className: 'ds-hint' }, 'text: ' + selected.text) : null,
            selected.contentDesc ? h('div', { className: 'ds-hint' }, 'content-desc: ' + selected.contentDesc) : null,
            selected.resourceId ? h('div', { className: 'ds-hint' }, 'id: ' + selected.resourceId) : null,
            locator ? h('div', { className: 'ds-hint' }, 'locator: ' + locator.using + ' = ' + locator.value) : null,
            sourceText ? h('div', { className: 'ds-hint' }, 'source: ' + sourceText) : null,
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
              h(Btn, { label: 'Tap node', onClick: () => tapSelected(selected.index), disabled: busy !== '' || selectedStale || !session }),
              locator ? h(Btn, { label: 'Copy locator', onClick: () => { try { navigator.clipboard.writeText(locator.using + '=' + locator.value); setLog('locator copied') } catch (_) {} } }) : null,
              h(Btn, { label: 'Close', onClick: () => setSelectionOpen(false) }),
            ),
            h('span', { className: 'ds-hint' }, 'Queued with node identity, screen, routes and source mapping.'),
          ),
        )
      : null,
    configOpen
      ? h(
          'div',
          { className: 'ds-modal-backdrop', onClick: (e) => { if (e.target === e.currentTarget) setConfigOpen(false) } },
          h(
            'div',
            { className: 'ds-modal' },
            h('div', { className: 'ds-modal-title' }, h('span', null, 'Connect Android app'), h('span', { className: 'ds-sel-path' }, slug)),
            h('p', { className: 'ds-hint' }, 'Bind this design project to its Android app through Appium. The session, captures and history stay with this project.'),
            h('label', { className: 'ds-field' }, h('span', null, 'Appium URL'), h('input', { className: 'ds-input', value: form.url, onChange: (e) => setForm(Object.assign({}, form, { url: e.target.value })) })),
            h('label', { className: 'ds-field' }, h('span', null, 'appPackage'), h('input', { className: 'ds-input', value: form.appPackage, onChange: (e) => setForm(Object.assign({}, form, { appPackage: e.target.value })) })),
            h('label', { className: 'ds-field' }, h('span', null, 'appActivity'), h('input', { className: 'ds-input', value: form.appActivity, onChange: (e) => setForm(Object.assign({}, form, { appActivity: e.target.value })) })),
            h('label', { className: 'ds-field' }, h('span', null, 'deviceName'), h('input', { className: 'ds-input', value: form.deviceName, onChange: (e) => setForm(Object.assign({}, form, { deviceName: e.target.value })) })),
            h('label', { className: 'ds-field' }, h('span', null, 'Project root (absolute)'), h('input', { className: 'ds-input', placeholder: '/absolute/path/to/project', value: form.projectRoot, onChange: (e) => setForm(Object.assign({}, form, { projectRoot: e.target.value })) })),
            h('label', { className: 'ds-field' }, h('span', null, 'JAVA_HOME'), h('input', { className: 'ds-input', placeholder: '/path/to/jdk', value: form.javaHome, onChange: (e) => setForm(Object.assign({}, form, { javaHome: e.target.value })) })),
            h('label', { className: 'ds-field' }, h('span', null, 'ANDROID_HOME'), h('input', { className: 'ds-input', placeholder: '/path/to/android/sdk', value: form.androidHome, onChange: (e) => setForm(Object.assign({}, form, { androidHome: e.target.value })) })),
            h('label', { className: 'ds-field' }, h('span', null, 'Gradle build task'), h('input', { className: 'ds-input', value: form.buildTask, onChange: (e) => setForm(Object.assign({}, form, { buildTask: e.target.value })) })),
            h('label', { className: 'ds-field' }, h('span', null, 'APK path (relative)'), h('input', { className: 'ds-input', value: form.apkPath, onChange: (e) => setForm(Object.assign({}, form, { apkPath: e.target.value })) })),
            h('div', { className: 'ds-row' },
              h(Btn, { label: busy ? 'Connecting…' : 'Save & Connect', primary: true, onClick: saveAndConnect, disabled: busy !== '' }),
              h(Btn, { label: 'Cancel', onClick: () => setConfigOpen(false), disabled: busy !== '' }),
            ),
            h('span', { className: 'ds-hint' }, 'Appium must be running on loopback with the uiautomator2 driver and a visible device.'),
          ),
        )
      : null,
  )
}

function ComposePanel({ slug, onBusyChange }) {
  const [status, setStatus] = React.useState(null)
  const [frame, setFrame] = React.useState(null)
  const [regions, setRegions] = React.useState([])
  const [changed, setChanged] = React.useState(0)
  const [live, setLive] = React.useState(false)
  const [tree, setTree] = React.useState('')
  const [nodeCount, setNodeCount] = React.useState(0)
  const [logs, setLogs] = React.useState('')
  const [busy, setBusyState] = React.useState('')
  function setBusy(value) { setBusyState(value); if (onBusyChange) onBusyChange(Boolean(value)) }
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
    buildLog
      ? h('details', { className: 'ds-hint' },
          h('summary', null, 'Build log' + (buildInfo ? ' · ' + (buildInfo.buildMs / 1000).toFixed(1) + 's build · ' + (buildInfo.installMs / 1000).toFixed(1) + 's install' : '')),
          h('pre', { style: { maxHeight: '180px', overflow: 'auto', fontSize: '10px', whiteSpace: 'pre-wrap', margin: '6px 0 0' } }, buildLog.slice(-12000)),
        )
      : null,
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
