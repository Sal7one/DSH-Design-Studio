import { Btn, Err, readAsDataUrl } from './primitives.js'
import { call } from './api.js'

function assetUrl(slug, asset) {
  return '/design-studio/' + encodeURIComponent(slug) + '/' + asset.path + '?v=' + String(asset.hash || '').slice(0, 12)
}

function formatBytes(bytes) {
  if (typeof bytes !== 'number' || bytes < 0) return '—'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

function htmlSnippet(asset) {
  const alt = String(asset.alt || asset.name || '').replace(/"/g, '&quot;')
  return '<img src="../' + asset.path + '" alt="' + alt + '" loading="lazy">'
}

export function AssetsModal({ slug, onClose, embedded }) {
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
            style: { display: 'none' },
            onChange: (event) => uploadFiles(event.target.files),
          }),
        ),
        Btn({ label: '↻ Refresh', onClick: refresh, disabled: busy !== '' }),
        Btn({ label: '✕ Close', onClick: onClose }),
      ),
    ),
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
