import { runtime } from './runtime.js'

// ---------- data channel: same-origin JSON API on the bundle's own route ----------
export async function call(method, args) {
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
