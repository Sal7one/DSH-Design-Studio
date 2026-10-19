import { runtime } from './runtime.js'
import { call } from './api.js'
import { Err, Log, Btn, Field, listVal, readAsDataUrl, readAsText } from './primitives.js'
import { cssPathOf, describeSelection, injectSelector } from './element-picker.js'
import { ScaledPreview, PREVIEW_SIZES } from './scaled-preview.js'
import { SettingsView } from './settings.js'
import { AssetsModal } from './assets-modal.js'
import { HistoryPanel } from './history.js'
import { StyleAtlas } from './style-atlas.js'

function assetHref(slug, asset) {
  return '/design-studio/' + encodeURIComponent(slug) + '/' + asset.path + '?v=' + String(asset.hash || '').slice(0, 12)
}

function styleColor(style, key) {
  const vars = (style && style.vars) || {}
  return vars[key] || vars['--accent'] || '#c9a227'
}

// ================= workspace view (conversation.view tab) =================
export function StudioView(props) {
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
    const res = await call('studio.assets', { slug: selected })
    if (res.ok) setAssets(res.data)
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
        if (!next || !next.stamp || !next.stamp.hash) return
        if (stampRef.current && next.stamp.hash !== stampRef.current) {
          stampRef.current = next.stamp.hash
          setSystems(res.data)
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
        'The full element reference is saved at temp_design_folder/' + selected + '/EDIT_REQUEST.md — read it and apply the change to the mockup files yourself with your file tools (you are the primary editor, not the design agent). ' +
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
    if (!selected || !msg) return
    setAgentBusy(true)
    setErr('')
    try {
      const agentArgs = { slug: selected, message: msg }
      if (agentImage) agentArgs.images = [agentImage]
      if (sessionId) agentArgs.sessionId = sessionId
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
      setLog('file manager opened for ' + res.data.revealed)
    } catch (e) {
      setErr(String((e && e.message) || e))
    } finally {
      setBusy('')
    }
  }

  async function capturePreview() {
    if (!selected) return
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
    stylePreviewRef.current = null
    setStylePreview(null)
    setStyleApplied(null)
    setStyleTour(null)
    stylePoolRef.current = []
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
            disabled: busy !== '' || !sel,
            title: 'Deletes the SELECTED design system (highlight its card in the library first)',
          }),
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
          ),
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
                        ? Btn({ label: 'Apply style', primary: true, onClick: applyPreviewStyle, disabled: busy !== '' })
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
                Btn({ label: selectMode ? '✋ Stop selecting' : '🎯 Select', onClick: () => { setSelectMode(!selectMode); setSelection(null) }, disabled: busy !== '' }),
                Btn({ label: '↻ Reload', onClick: () => setTick(tick + 1) }),
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
                Btn({ label: '📷 Capture', onClick: capturePreview, disabled: busy !== '' || !sel.hasPreview }),
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
                      Btn({ label: 'Apply style', primary: true, onClick: applyPreviewStyle, disabled: busy !== '' }),
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
                  Btn({ label: '📷 Capture', onClick: capturePreview, disabled: busy !== '' || !selected }),
                  h('span', { className: 'ds-caps' }, harnessState && harnessState.vision && harnessState.vision.available ? 'harness vision' : 'openrouter'),
                ),
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
            workspaceTab === 'settings'
              ? h('div', { className: 'ds-workspace-settings' }, h(SettingsView))
              : null,
            workspaceTab === 'assets'
              ? h(
                  'div',
                  { className: 'ds-workspace-assets' },
                  h(AssetsModal, {
                    slug: selected,
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
                    slug: selected,
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
                  h(HistoryPanel, { slug: selected, onChanged: reloadAfterHistory }),
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
    assetsOpen && selected
      ? h(AssetsModal, {
          slug: selected,
          onClose: () => {
            setAssetsOpen(false)
            loadAssets().catch(function () {})
          },
        })
      : null,
  )
}
