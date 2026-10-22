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
  const [dirty, setDirty] = React.useState(false)
  const [saved, setSaved] = React.useState(false)

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
      setDirty(false)
      setSaved(false)
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
    setDirty(true)
    setSaved(false)
    setErr('')
    setLog('')
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
      setDirty(false)
      setSaved(true)
      setLog('')
      setErr('')
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
      setDirty(false)
      setSaved(false)
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
        h('span', { className: 'ds-field-label' }, 'Default style apply scope'),
        h(
          'select',
          { className: 'ds-select', value: form.defaultStyleScope || 'design', onChange: (e) => setFormValue('defaultStyleScope', e.target.value) },
          [['design', 'All pages (project)'], ['page', 'This page only']].map(([value, label]) =>
            h('option', { key: value, value }, label),
          ),
        ),
        h('span', { className: 'ds-hint' }, 'Starting scope in Styles. Page overrides still win over global tokens.'),
      ),
      h(
        'div',
        { className: 'ds-field' },
        h('span', { className: 'ds-field-label' }, 'Auto-verify after Ask DeepSeek'),
        h(
          'label',
          { className: 'ds-toggle-row' },
          h('input', {
            type: 'checkbox',
            checked: form.autoVerify !== false,
            onChange: (e) => setFormValue('autoVerify', e.target.checked),
          }),
          h(
            'span',
            null,
            h('b', null, 'Run a verification pass'),
            h('span', { className: 'ds-hint' }, 'When the coding agent’s edits settle, ask the design agent to verify them.'),
          ),
        ),
      ),
      h(
        'div',
        { className: 'ds-field' },
        h('span', { className: 'ds-field-label' }, 'Lifecycle'),
        h(
          'label',
          { className: 'ds-toggle-row' },
          h('input', {
            type: 'checkbox',
            checked: Boolean(form.autoDeleteWithSession),
            onChange: (e) => setFormValue('autoDeleteWithSession', e.target.checked),
          }),
          h(
            'span',
            null,
            h('b', null, 'Delete designs when their chat is deleted'),
            h('span', { className: 'ds-hint' }, 'Off by default. Turning this on is not enough — press Save changes to apply it.'),
          ),
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
      { className: 'ds-settings-top' },
      h(
        'div',
        { className: 'ds-settings-title' },
        h('span', { className: 'ds-eyebrow' }, 'Settings · profile'),
        h('h3', null, 'Design Studio'),
        h('p', { className: 'ds-hint' }, 'Vision, capture and agent behavior for this profile. Changes are local until saved.'),
      ),
      h(
        'div',
        { className: 'ds-settings-actions' },
        h(
          'span',
          { className: 'ds-save-state ' + (dirty ? 'dirty' : saved ? 'saved' : 'clean') },
          dirty ? 'Unsaved changes' : saved ? 'Saved' : 'Up to date',
        ),
        Btn({ label: busy || (saved ? 'Saved' : 'Save changes'), primary: true, onClick: saveConfig, disabled: busy !== '' || !dirty }),
        Btn({ label: 'Refresh status', onClick: refreshStatus, disabled: busy !== '' }),
      ),
    ),
    dirty
      ? h(
          'div',
          { className: 'ds-unsaved' },
          h('b', null, 'You have unsaved changes'),
          h('span', null, 'Changes are not applied until you press Save changes.'),
        )
      : null,
    err ? h('div', { className: 'ds-settings-banner' }, Err({ text: err })) : null,
    log ? h('div', { className: 'ds-settings-banner' }, Log({ text: log })) : null,
    visionCard,
    captureCard,
    behaviorCard,
    fallbackCard,
    presetsCard,
  )
}

// ================= all-designs settings section =================
function designWorkspace(s) {
  const root = String(s.root || '')
  if (/[\\/]temp_design_folder[\\/]*$/i.test(root)) {
    return { key: 'legacy', label: 'Legacy profile designs', path: root }
  }
  const project = root.replace(/[\\/]design-studio[\\/]*$/i, '') || root
  return { key: project.toLowerCase(), label: project, path: project }
}

function designWhen(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function AllDesignsView() {
  const [all, setAll] = React.useState(null)
  const [err, setErr] = React.useState('')
  const [busy, setBusy] = React.useState('')
  const [log, setLog] = React.useState('')
  const [confirmSlug, setConfirmSlug] = React.useState('')
  const [query, setQuery] = React.useState('')
  const [filter, setFilter] = React.useState('all')

  async function refresh() {
    setErr('')
    const a = await call('studio.list', {})
    if (a.ok) setAll(Array.isArray(a.data) ? a.data : [])
    else setErr(a.error || 'list failed')
  }

  React.useEffect(() => {
    refresh().catch((e) => setErr(String((e && e.message) || e)))
  }, [])

  async function run(label, fn) {
    setBusy(label)
    setErr('')
    try {
      await fn()
    } catch (e) {
      setErr(String((e && e.message) || e))
    } finally {
      setBusy('')
    }
  }

  async function doOpen(s) {
    await run('opening preview…', async () => {
      const res = await call('studio.openPreview', { slug: s.slug })
      if (!res.ok) throw new Error(res.error || 'could not open preview')
      setLog('opened ' + s.slug + ' in the OS browser')
    })
  }

  async function doZip(s) {
    await run('zipping ' + s.slug + '…', async () => {
      const res = await call('studio.zip', { slug: s.slug })
      if (!res.ok) throw new Error(res.error || 'zip failed')
      setLog('zip ready for ' + s.slug + ' — ' + (res.data && res.data.files ? res.data.files + ' files' : 'written'))
      await refresh()
    })
  }

  async function doReveal(s) {
    await run('revealing zip…', async () => {
      const res = await call('studio.reveal', { slug: s.slug })
      if (!res.ok) throw new Error(res.error || 'reveal failed')
      setLog('revealed ' + s.slug + ' zip in the file manager')
      await refresh()
    })
  }

  async function doDelete(s) {
    if (confirmSlug !== s.slug) {
      setConfirmSlug(s.slug)
      return
    }
    setConfirmSlug('')
    await run('deleting ' + s.slug + '…', async () => {
      const res = await call('studio.delete', { slug: s.slug })
      if (!res.ok) throw new Error(res.error || 'delete failed')
      setLog('deleted ' + s.slug + ' — folder, zip, reviews and history removed')
      setAll((prev) => (Array.isArray(prev) ? prev.filter((item) => item.slug !== s.slug) : prev))
      await refresh()
    })
  }

  async function doSweep() {
    await run('sweeping orphaned designs…', async () => {
      const res = await call('studio.sweep', {})
      if (!res.ok) throw new Error(res.error || 'sweep failed')
      setLog(res.data.note + (res.data.swept.length ? ' — removed: ' + res.data.swept.join(', ') : ''))
      await refresh()
    })
  }

  const rows = Array.isArray(all) ? all : []
  const q = query.trim().toLowerCase()
  const visible = rows.filter((s) => {
    if (filter === 'frozen' && !s.frozen) return false
    if (filter === 'active' && (s.frozen || s.orphan)) return false
    if (filter === 'orphaned' && !s.orphan) return false
    if (!q) return true
    return [s.slug, s.root, s.sessionId].filter(Boolean).join(' ').toLowerCase().includes(q)
  })
  const groups = new Map()
  for (const s of visible) {
    const meta = designWorkspace(s)
    if (!groups.has(meta.key)) groups.set(meta.key, { meta, designs: [] })
    groups.get(meta.key).designs.push(s)
  }
  const groupList = Array.from(groups.values())
    .map((g) => ({ ...g, designs: g.designs.slice().sort((a, b) => String(a.slug).localeCompare(String(b.slug))) }))
    .sort((a, b) => {
      if (a.meta.key === 'legacy') return 1
      if (b.meta.key === 'legacy') return -1
      return a.meta.label.localeCompare(b.meta.label)
    })
  const frozen = rows.filter((s) => s.frozen).length
  const orphan = rows.filter((s) => s.orphan).length
  const workspaceCount = new Set(rows.map((s) => designWorkspace(s).key)).size

  return h(
    'div',
    { className: 'ds-settings ds-all' },
    h(
      'div',
      { className: 'ds-all-hero' },
      h(
        'div',
        null,
        h('span', { className: 'ds-caps' }, 'Library'),
        h('h3', null, 'All designs'),
        h('p', { className: 'ds-hint' }, 'Every design across every workspace, grouped by project. Open, export, reveal or clean up without digging through chats.'),
      ),
      Btn({ label: busy || 'Refresh', onClick: () => refresh(), disabled: busy !== '' }),
    ),
    h(
      'div',
      { className: 'ds-all-stats' },
      [['designs', rows.length], ['workspaces', workspaceCount], ['frozen', frozen], ['orphaned', orphan]].map(([label, value]) =>
        h('div', { key: label, className: 'ds-all-stat' }, h('b', null, String(value)), h('span', null, label)),
      ),
    ),
    h(
      'div',
      { className: 'ds-all-toolbar' },
      h('input', {
        className: 'ds-input',
        type: 'search',
        value: query,
        placeholder: 'Filter by design, workspace or chat…',
        'aria-label': 'Filter designs',
        onChange: (e) => setQuery(e.target.value),
      }),
      h(
        'div',
        { className: 'ds-segmented', role: 'group', 'aria-label': 'Filter designs' },
        [['all', 'All'], ['active', 'Active'], ['frozen', 'Frozen'], ['orphaned', 'Orphaned']].map(([key, label]) =>
          h(
            'button',
            {
              key,
              type: 'button',
              className: 'ds-seg' + (filter === key ? ' on' : ''),
              'aria-pressed': filter === key ? 'true' : 'false',
              onClick: () => setFilter(key),
            },
            label,
          ),
        ),
      ),
    ),
    h(Err, { text: err }),
    h(Log, { text: busy || log }),
    all === null
      ? h('div', { className: 'ds-all-empty' }, 'Loading designs…')
      : all.length === 0
        ? h('div', { className: 'ds-empty' }, 'No design systems yet. Create one from any conversation.')
        : groupList.length === 0
          ? h('div', { className: 'ds-empty' }, 'No designs match this filter.')
          : groupList.map((group) =>
              h(
                'section',
                { key: group.meta.key, className: 'ds-all-group' },
                h(
                  'div',
                  { className: 'ds-all-group-head' },
                  h(
                    'div',
                    null,
                    h('h4', null, group.meta.label),
                    h('p', { className: 'ds-hint' }, group.meta.path),
                  ),
                  h(
                    'div',
                    { className: 'ds-all-group-badges' },
                    h('span', { className: 'ds-badge blue' }, group.designs.length + ' design' + (group.designs.length === 1 ? '' : 's')),
                    group.designs.some((s) => s.frozen) ? h('span', { className: 'ds-badge amber' }, group.designs.filter((s) => s.frozen).length + ' frozen') : null,
                  ),
                ),
                h(
                  'div',
                  { className: 'ds-all-list' },
                  group.designs.map((s) =>
                    h(
                      'article',
                      { key: s.slug, className: 'ds-all-card' + (s.frozen ? ' is-frozen' : '') },
                      h(
                        'div',
                        { className: 'ds-all-card-main' },
                        h('span', { className: 'ds-all-mark', 'aria-hidden': 'true' }, s.frozen ? '🔒' : String(s.slug || '?').slice(0, 1).toUpperCase()),
                        h(
                          'div',
                          { className: 'ds-all-copy' },
                          h('div', { className: 'ds-all-title' }, h('b', null, s.slug), s.orphan ? h('span', { className: 'ds-badge amber' }, 'orphaned') : null, s.frozen ? h('span', { className: 'ds-badge amber' }, 'frozen') : null),
                          h('p', { className: 'ds-hint' }, s.count + ' file' + (s.count === 1 ? '' : 's') + (s.stamp && s.stamp.at ? ' · modified ' + designWhen(s.stamp.at) : '') + (s.createdAt ? ' · created ' + designWhen(s.createdAt) : '')),
                          h('p', { className: 'ds-all-zip' }, s.zip && s.zip.exists ? (s.zip.at ? 'ZIP · ' + designWhen(s.zip.at) + (s.zip.bytes ? ' · ' + Math.round(s.zip.bytes / 1024) + ' KB' : '') : 'ZIP · generated (date unavailable)') : 'ZIP · not generated yet'),
                          s.freeze && s.freeze.implementation ? h('p', { className: 'ds-all-implementation' }, '→ ' + s.freeze.implementation) : null,
                        ),
                      ),
                      h(
                        'div',
                        { className: 'ds-all-actions' },
                        confirmSlug === s.slug
                          ? h(
                              'span',
                              { className: 'ds-all-confirm' },
                              h('span', null, 'Delete this design?'),
                              Btn({ label: 'Cancel', onClick: () => setConfirmSlug(''), disabled: busy !== '' }),
                              Btn({ label: 'Delete', primary: true, onClick: () => doDelete(s), disabled: busy !== '' }),
                            )
                          : h(
                              'span',
                              { className: 'ds-all-action-row' },
                              Btn({ label: 'Preview ↗', onClick: () => doOpen(s), disabled: busy !== '' || s.hasPreview === false, title: 'Open the live preview in the OS browser' }),
                              Btn({ label: 'Zip', onClick: () => doZip(s), disabled: busy !== '' }),
                              Btn({ label: 'Show in folder', onClick: () => doReveal(s), disabled: busy !== '', title: 'Zip if needed, then reveal it in Explorer/Finder/file manager' }),
                              Btn({ label: 'Delete', onClick: () => doDelete(s), disabled: busy !== '' || !!s.frozen, title: s.frozen ? 'Thaw this design before deleting it' : 'Delete this design and its local artifacts' }),
                            ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
    h(
      'div',
      { className: 'ds-all-footer' },
      h('div', null, h('b', null, 'Orphan cleanup'), h('p', { className: 'ds-hint' }, 'Sweep only deletes designs whose creating chat is gone, and only when auto-delete is enabled in Design Studio → Behavior. Default is off.')),
      Btn({ label: 'Sweep orphans', onClick: doSweep, disabled: busy !== '' }),
    ),
  )
}
