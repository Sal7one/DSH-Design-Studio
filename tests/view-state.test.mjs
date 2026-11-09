import test from 'node:test'
import assert from 'node:assert/strict'
import { runtime } from '../lib/client/src/runtime.js'
import { readRetained, useRetainedState, writeRetained } from '../lib/client/src/view-state.js'

// A component instance: hook slots survive re-renders of the same mount, not a remount.
function mount(component, props) {
  const slots = []
  const effects = []
  const render = () => {
    let index = 0
    globalThis.React = {
      useState(initial) {
        const n = index++
        if (!(n in slots)) slots[n] = typeof initial === 'function' ? initial() : initial
        return [slots[n], (value) => { slots[n] = typeof value === 'function' ? value(slots[n]) : value }]
      },
      useRef(initial) { return { current: initial } },
      useEffect(fn) { effects.push(fn) },
      createElement(type, props, ...children) { return { type, props: props || {}, children } },
    }
    globalThis.h = globalThis.React.createElement
    return component(props)
  }
  return { render, effects }
}

function find(node, predicate) {
  if (!node || typeof node !== 'object') return null
  if (predicate(node)) return node
  for (const child of (node.children || []).flat(Infinity)) {
    const found = find(child, predicate)
    if (found) return found
  }
  return null
}

// Each test gets a plugin context and a private storage; Node's own global sessionStorage is restored after.
function withStudio(fn) {
  const saved = { ctx: runtime.ctx, React: globalThis.React, h: globalThis.h, sessionStorage: globalThis.sessionStorage, window: globalThis.window, fetch: globalThis.fetch }
  const store = new Map()
  globalThis.sessionStorage = {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, String(value)) },
    removeItem: (key) => { store.delete(key) },
  }
  runtime.ctx = {}
  globalThis.window = { addEventListener() {}, removeEventListener() {} }
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ ok: true, data: { qalensEnabled: true } }) })
  return Promise.resolve().then(() => fn(store)).finally(() => {
    runtime.ctx = saved.ctx
    globalThis.React = saved.React; globalThis.h = saved.h; globalThis.window = saved.window; globalThis.fetch = saved.fetch
    globalThis.sessionStorage = saved.sessionStorage
  })
}

test('the App target and QaLens setting survive leaving and reopening the Studio tab', () => withStudio(async () => {
  const { AppPanel } = await import('../lib/client/src/app-panel.js?retained-target')
  const first = mount(AppPanel, { slug: 'demo' })
  let tree = first.render()
  assert.equal(find(tree, n => n.type === 'select').props.value, 'choose')
  // The feature check reports QaLens enabled, and the user picks it.
  const dispose = first.effects.find(fn => String(fn).includes('refreshFeatures'))()
  await new Promise(resolve => setImmediate(resolve))
  dispose()
  tree = first.render()
  find(tree, n => n.type === 'select').props.onChange({ target: { value: 'qalens' } })
  assert.equal(find(first.render(), n => n.type === 'select').props.value, 'qalens')

  // Switching to Chat unmounts the view; returning mounts a new instance with empty hook slots.
  const reopened = mount(AppPanel, { slug: 'demo' }).render()
  assert.equal(find(reopened, n => n.type === 'select').props.value, 'qalens')
  assert.ok(find(reopened, n => typeof n.type === 'function' && n.type.name === 'QaLensPanel'))

  // Another design keeps its own target.
  assert.equal(find(mount(AppPanel, { slug: 'other' }).render(), n => n.type === 'select').props.value, 'choose')
}))

test('a pending or failed feature check shows the chooser without forgetting the saved target', () => withStudio(async () => {
  const { AppPanel } = await import('../lib/client/src/app-panel.js?retained-pending')
  writeRetained('design:demo', 'appTarget', 'qalens')
  writeRetained('studio', 'qalensEnabled', false)
  const tree = mount(AppPanel, { slug: 'demo' }).render()
  assert.equal(find(tree, n => n.type === 'select').props.value, 'choose')
  assert.equal(readRetained('design:demo', 'appTarget', 'choose'), 'qalens')
  writeRetained('studio', 'qalensEnabled', true)
  assert.equal(find(mount(AppPanel, { slug: 'demo' }).render(), n => n.type === 'select').props.value, 'qalens')
}))

test('retained values restore from sessionStorage after a plugin reload', () => withStudio((store) => {
  writeRetained('session:s1', 'tab', 'app')
  assert.equal(store.get('dsh-design-studio:session:s1:tab'), '"app"')
  runtime.ctx = {}
  assert.equal(readRetained('session:s1', 'tab', 'preview'), 'app')
  writeRetained('session:s1', 'tab', undefined)
  assert.equal(store.has('dsh-design-studio:session:s1:tab'), false)
}))

test('consecutive functional updates compose before a re-render', () => withStudio(() => {
  const view = mount(() => useRetainedState('design:demo:qalens', 'pins', []), {})
  const [, setPins] = view.render()
  setPins(pins => [...pins, 'first'])
  setPins(pins => [...pins, 'second'])
  assert.deepEqual(view.render()[0], ['first', 'second'])
  assert.deepEqual(mount(() => useRetainedState('design:demo:qalens', 'pins', []), {}).render()[0], ['first', 'second'])
}))

test('without a plugin context nothing is retained', () => withStudio((store) => {
  runtime.ctx = null
  writeRetained('session:none', 'tab', 'app')
  assert.equal(readRetained('session:none', 'tab', 'preview'), 'preview')
  assert.equal(store.size, 0)
}))
