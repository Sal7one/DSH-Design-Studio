import { Btn, Err, Log } from './primitives.js'
import { call } from './api.js'

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

export function StyleAtlas({ slug, frozen, onPreview, onTour, onChanged, onCreated }) {
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
      const res = await call('studio.styles.create', { styleId: style.id, fontMode })
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
