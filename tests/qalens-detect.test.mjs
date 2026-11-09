import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createQaLensCompanion, DEFAULT_WORKBENCH_URL } from '../lib/host/qalens-companion.js'
import { runtime } from '../lib/client/src/runtime.js'
import { readRetained, writeRetained } from '../lib/client/src/view-state.js'

async function workbench(secret = 'workbench-secret') {
  const requests = []
  const server = createServer((req, res) => {
    requests.push({ url: req.url, session: req.headers['x-qalens-session'] })
    res.setHeader('content-type', 'application/json')
    if (req.url === '/api/bootstrap') return res.end(JSON.stringify({ ok: true, session: secret }))
    res.statusCode = 404
    res.end('{"ok":false}')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  return { url: `http://127.0.0.1:${server.address().port}`, requests, close: () => new Promise(resolve => server.close(resolve)) }
}

test('detect finds a loopback workbench without returning its session or reaching other hosts', async () => {
  const bench = await workbench()
  try {
    const companion = createQaLensCompanion()
    const found = await companion.detect([bench.url + '/', 'http://example.com:8765', 'http://localhost:1234', 'not a url'])
    assert.ok(found.includes(bench.url))
    assert.ok(!found.some(origin => !origin.startsWith('http://127.0.0.1:')), 'only loopback origins are probed')
    assert.ok(!JSON.stringify(found).includes('workbench-secret'))
    assert.ok(bench.requests.every(request => request.url === '/api/bootstrap' && request.session === undefined), 'the probe only reads bootstrap')
    assert.equal(DEFAULT_WORKBENCH_URL, 'http://127.0.0.1:8765')
    assert.equal(companion.status().state, 'stopped', 'detecting does not attach')
  } finally { await bench.close() }
})

// ── client: one-click attach, remembered reattach, and revocation ─────────────────────────────────
function find(node, predicate) {
  if (!node || typeof node !== 'object') return null
  if (predicate(node)) return node
  for (const child of (node.children || []).flat(Infinity)) {
    const found = find(child, predicate)
    if (found) return found
  }
  return null
}

async function qalensPanel(fetchData, { remember } = {}) {
  const { AppPanel } = await import('../lib/client/src/app-panel.js?qalens-detect')
  const calls = []
  const saved = { React: globalThis.React, h: globalThis.h, fetch: globalThis.fetch, window: globalThis.window, document: globalThis.document, ctx: runtime.ctx }
  runtime.ctx = {}
  if (remember) for (const [key, value] of Object.entries(remember)) writeRetained('design:demo:qalens', key, value)
  globalThis.window = { addEventListener() {}, removeEventListener() {} }
  globalThis.document = { hidden: true, addEventListener() {}, removeEventListener() {} }
  globalThis.fetch = async (url, options) => {
    const method = String(url).split('/').at(-1)
    const body = JSON.parse(options.body)
    calls.push({ method, body })
    return { ok: true, json: async () => ({ ok: true, data: fetchData(method, body) }) }
  }
  const slots = [], effects = []
  const render = (component, props) => {
    let i = 0
    globalThis.React = {
      useState(initial) { const n = i++; if (!(n in slots)) slots[n] = initial; return [slots[n], (value) => { slots[n] = typeof value === 'function' ? value(slots[n]) : value }] },
      useRef(initial) { return { current: initial } },
      useEffect(fn) { effects.push(fn) },
      createElement(type, props, ...children) { return { type, props: props || {}, children } },
    }
    globalThis.h = globalThis.React.createElement
    return component(props)
  }
  // Mount the App panel only to obtain the QaLensPanel element, then drive that panel's own hooks.
  // App panel hooks in order: target, busy, QaLens enabled, features error, sidecar available.
  const seeds = ['qalens', false, true, '', false]
  globalThis.React = { useState: initial => [seeds.length ? seeds.shift() : initial, () => {}], useRef: initial => ({ current: initial }), useEffect() {}, createElement: (type, props, ...children) => ({ type, props: props || {}, children }) }
  globalThis.h = globalThis.React.createElement
  const element = find(AppPanel({ slug: 'demo' }), n => typeof n.type === 'function' && n.type.name === 'QaLensPanel')
  const restore = () => { Object.assign(globalThis, { React: saved.React, h: saved.h, fetch: saved.fetch, window: saved.window, document: saved.document }); runtime.ctx = saved.ctx }
  return { calls, slots, effects, render: () => render(element.type, element.props), restore }
}

async function runDetection(panel) {
  panel.slots[1] = { companion: { state: 'stopped', url: '' }, target: { package: '', projectRoot: '' } }
  panel.render()
  const detect = panel.effects.find(fn => String(fn).includes('studio.qalens.detect'))
  assert.ok(detect, 'the panel registers its detection effect')
  detect()
  await new Promise(resolve => setImmediate(resolve))
  await new Promise(resolve => setImmediate(resolve))
}

test('a detected workbench is offered for one click, not attached silently', async () => {
  const panel = await qalensPanel(method => (method === 'studio.qalens.detect' ? { attached: '', found: ['http://127.0.0.1:8765'] } : {}))
  try {
    await runDetection(panel)
    assert.deepEqual(panel.calls.map(call => call.method).filter(m => m !== 'studio.qalens.target'), ['studio.qalens.detect'])
    const offer = find(panel.render(), n => n.props && n.props.label === 'Attach to QaLens at 127.0.0.1:8765')
    assert.ok(offer, 'the detected workbench is the primary action')
    await offer.props.onClick()
    assert.deepEqual(panel.calls.at(-2), { method: 'studio.qalens.attach', body: { url: 'http://127.0.0.1:8765' } })
    assert.equal(readRetained('design:demo:qalens', 'autoAttach', false), true)
  } finally { panel.restore() }
})

test('a remembered workbench reattaches when the panel opens, until the user disconnects', async () => {
  const panel = await qalensPanel(
    method => (method === 'studio.qalens.detect' ? { attached: '', found: ['http://127.0.0.1:8765'] } : method === 'studio.qalens.attach' ? { url: 'http://127.0.0.1:8765' } : {}),
    { remember: { url: 'http://127.0.0.1:8765/', autoAttach: true } },
  )
  try {
    await runDetection(panel)
    assert.ok(panel.calls.some(call => call.method === 'studio.qalens.attach' && call.body.url === 'http://127.0.0.1:8765'), 'reattached without a click')
    panel.slots[1] = { companion: { state: 'ready', url: 'http://127.0.0.1:8765' }, target: { package: '', projectRoot: '' } }
    await find(panel.render(), n => n.props && n.props.label === 'Disconnect').props.onClick()
    assert.equal(readRetained('design:demo:qalens', 'autoAttach', true), false, 'Disconnect revokes the remembered reattach')
  } finally { panel.restore() }
})

test('without a detected workbench or a configured sidecar the panel explains how to start one', async () => {
  const panel = await qalensPanel(method => (method === 'studio.qalens.detect' ? { attached: '', found: [] } : {}))
  try {
    await runDetection(panel)
    const tree = panel.render()
    assert.equal(find(tree, n => n.props && n.props.label === 'Start QaLens'), null, 'Start needs DSH_QALENS_CHECKOUT on the host')
    assert.ok(find(tree, n => n.type === 'p' && String(n.children.join('')).includes('tools/local-bridge/server.py --gui')))
  } finally { panel.restore() }
})

test('disabling QaLens forgets every remembered reattach', async () => {
  const { AppPanel } = await import('../lib/client/src/app-panel.js?qalens-revoke')
  const saved = { React: globalThis.React, h: globalThis.h, fetch: globalThis.fetch, window: globalThis.window, ctx: runtime.ctx }
  runtime.ctx = {}
  writeRetained('design:one:qalens', 'autoAttach', true)
  writeRetained('design:two:qalens', 'autoAttach', true)
  const effects = []
  globalThis.window = { addEventListener() {}, removeEventListener() {} }
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ ok: true, data: { qalensEnabled: false, qalensSidecar: false } }) })
  globalThis.React = { useState: initial => [initial, () => {}], useRef: initial => ({ current: initial }), useEffect(fn) { effects.push(fn) }, createElement: (type, props, ...children) => ({ type, props: props || {}, children }) }
  globalThis.h = globalThis.React.createElement
  try {
    AppPanel({ slug: 'one' })
    const dispose = effects.find(fn => String(fn).includes('refreshFeatures'))()
    await new Promise(resolve => setImmediate(resolve))
    dispose()
    assert.equal(readRetained('design:one:qalens', 'autoAttach', false), false)
    assert.equal(readRetained('design:two:qalens', 'autoAttach', false), false)
  } finally { Object.assign(globalThis, { React: saved.React, h: saved.h, fetch: saved.fetch, window: saved.window }); runtime.ctx = saved.ctx }
})
