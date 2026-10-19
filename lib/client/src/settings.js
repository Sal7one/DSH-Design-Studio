import { call } from './api.js'
import { Btn, Field, Err, Log, listVal } from './primitives.js'

// ================= settings section =================
export function SettingsView() {
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
export function AllDesignsView() {
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
      h('div', null, h('h3', null, 'All designs'), h('p', { className: 'ds-hint' }, 'Every design system under temp_design_folder/, across conversations.')),
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
        h('span', { className: 'ds-hint' }, 'Sweep only deletes when auto-delete is ON (Design Studio → Behavior); default is never auto-delete.'),
      ),
    ),
  )
}
