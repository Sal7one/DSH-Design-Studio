import { Btn, Err, Log } from './primitives.js'
import { call } from './api.js'

function fmtTime(at) {
  const d = new Date(at)
  return isNaN(d.getTime()) ? String(at || '') : d.toLocaleString()
}

export function HistoryPanel({ slug, onChanged }) {
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
      Btn({ label: '↶ Undo last edit', onClick: undo, disabled: busy !== '' || !data || !current }),
      Btn({ label: '↻ Refresh', onClick: refresh, disabled: busy !== '' }),
    ),
    Err({ text: err }),
    Log({ text: busy || log }),
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
                        disabled: busy !== '',
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
