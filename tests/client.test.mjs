import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

function loadClientModule() {
  const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  let definition = null
  const created = []
  const head = {
    children: [],
    appendChild(node) {
      node.parentNode = this
      this.children.push(node)
    },
    removeChild(node) {
      const index = this.children.indexOf(node)
      if (index !== -1) this.children.splice(index, 1)
      node.parentNode = null
    },
  }
  const document = {
    head,
    createElement(tag) {
      created.push(tag)
      return { tag, id: '', textContent: '', parentNode: null }
    },
  }
  const sandbox = {
    window: {
      __ModuleLoader__: {
        load(moduleDefinition) { definition = moduleDefinition },
      },
    },
    document,
    console,
  }
  vm.runInNewContext(source, sandbox, { filename: 'lib/client.js' })
  assert.ok(definition, 'client registers itself with the module loader')
  assert.equal(definition.id, '@sal7one/dsh-design-studio')
  assert.equal(created.length, 0, 'the lazy factory performs no DOM work')
  const module = definition.factory((specifier) => {
    assert.equal(specifier, 'react')
    return { createElement: (type, props, ...children) => ({ type, props, children }) }
  })
  assert.equal(typeof module.apply, 'function')
  assert.deepEqual([...module.inject], ['slots'])
  return { module, head, created }
}

test('client half registers current slots and owns its style lifecycle', () => {
  const { module, head, created } = loadClientModule()
  const registrations = []
  const localeRegistrations = []
  const dictionaries = {}
  const effects = []
  const locale = {
    register(namespace, language, dictionary) {
      localeRegistrations.push({ namespace, language })
      dictionaries[language] = dictionary
      return () => {}
    },
    bind() {
      return (key) => dictionaries.en[key] || key
    },
  }
  const ctx = {
    slots: {
      inject(slotName, callback) {
        return callback()
      },
      register(options, component) {
        registrations.push({ options, component })
        return () => {}
      },
    },
    get(name) {
      return name === 'locale' ? locale : undefined
    },
    effect(callback) {
      const disposer = callback()
      effects.push(disposer)
      return disposer
    },
    on() {
      return () => {}
    },
  }

  module.apply(ctx)

  assert.equal(created.filter((tag) => tag === 'style').length, 1, 'one style tag is mounted')
  assert.equal(head.children.length, 1)
  assert.equal(effects.length, 3, 'style + English + Chinese dictionary effects')

  const bySlot = (name) => registrations.filter((entry) => entry.options.name === name)
  assert.equal(bySlot('conversation.view').length, 1)
  assert.equal(bySlot('settings.section').length, 2)

  const view = bySlot('conversation.view')[0]
  assert.equal(view.options.id, 'design-studio')
  assert.equal(view.options.order, 20)
  assert.equal('inject' in view.options, false, 'obsolete slot inject face is gone')
  assert.equal(typeof view.component, 'function')

  const allDesigns = bySlot('settings.section').find((entry) => entry.options.id === 'all-designs')
  const studio = bySlot('settings.section').find((entry) => entry.options.id === 'design-studio')
  assert.equal(allDesigns.options.label(), 'All designs')
  assert.equal(studio.options.label(), 'Design Studio')
  assert.deepEqual(localeRegistrations.map((entry) => entry.language).sort(), ['en', 'zh'])

  for (const disposer of effects) {
    if (typeof disposer === 'function') disposer()
  }
  assert.equal(head.children.length, 0, 'disposal removes the style tag')
})

test('settings view renders the vision-first layout', async () => {
  const states = [
    { supported: true, configured: false, source: null, writable: true },
    { vision: { available: true, provider: 'deepseek-account', model: 'deepseek-flash', modalities: ['text', 'image'] } },
    [{ id: 'standard', name: 'standard' }],
    {
      visionModels: ['openai/gpt-4o-mini'],
      effort: 'off',
      visionTransport: 'auto',
      reviewStyle: 'strict',
      autoVerify: true,
      capture: { width: 1440, height: 1700 },
      agentPreset: '',
      autoDeleteWithSession: false,
      options: {
        baseUrl: 'https://openrouter.ai/api/v1',
        temperature: 0,
        maxTokens: 512,
        providerRouting: true,
        quantizations: ['fp8'],
        onlyProviders: [],
        allowFallbacks: true,
        includeUsage: true,
        reasoningExclude: false,
      },
    },
    '',
    [],
    null,
    '',
    [{ slug: 'demo' }],
    '',
    '',
    '',
  ]
  const React = {
    useState(initial) {
      return [states.length ? states.shift() : typeof initial === 'function' ? initial() : initial, () => {}]
    },
    useEffect() {},
    createElement(type, props, ...children) {
      return { type, props: props || {}, children }
    },
  }
  globalThis.React = React
  globalThis.h = React.createElement

  const { SettingsView } = await import('../lib/client/src/settings.js?render-test')
  const tree = SettingsView()

  function flatten(node) {
    if (node === null || node === undefined || node === false) return ''
    if (typeof node === 'string' || typeof node === 'number') return String(node)
    if (Array.isArray(node)) return node.map(flatten).join(' ')
    if (typeof node === 'object') return flatten(node.children)
    return ''
  }

  const text = flatten(tree)
  for (const label of [
    'Harness vision',
    'Vision transport',
    'Review style',
    'Reasoning effort',
    'Viewport width',
    'Viewport height',
    'Design agent preset',
    'Auto-verify after Ask DeepSeek',
    'OpenRouter fallback',
    'Identity presets',
  ]) {
    assert.ok(text.includes(label), 'settings renders ' + label)
  }
})

function flattenTree(node) {
  if (node === null || node === undefined || node === false) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(flattenTree).join(' ')
  if (typeof node === 'object') return flattenTree(node.children)
  return ''
}

test('studio workspace renders its library, tabs and default preview tab', async () => {
  const demo = {
    slug: 'demo',
    sessionId: 'session-1',
    count: 3,
    hasPreview: true,
    hasPrompts: true,
    hasTokenCss: true,
    stamp: { hash: 'abc12345-0000-0000-0000-000000000000', at: '2026-10-19T19:00:00.000Z' },
    files: [{ path: 'assets/images/x.png', size: 120 }],
  }
  const makeReact = (overrides) => {
    const seeds = [
      [demo], 'demo', '', '', 0, '', '', '', null, null, null, '', [], false, '', false, null,
      'preview', 'desktop', true, null, null, null, [], false, '', '', null, false, null, 0,
    ]
    if (overrides && overrides.workspaceTab) seeds[17] = overrides.workspaceTab
    if (overrides && overrides.stylePreview) seeds[20] = overrides.stylePreview
    if (overrides && overrides.styleTour) seeds[22] = overrides.styleTour
    if (overrides && overrides.keyState) seeds[9] = overrides.keyState
    if (overrides && overrides.harnessState) seeds[10] = overrides.harnessState
    if (overrides && overrides.selection) seeds[16] = overrides.selection
    let index = 0
    return {
      useState(initial) {
        const value = index < seeds.length ? seeds[index++] : typeof initial === 'function' ? initial() : initial
        return [value, () => {}]
      },
      useEffect() {},
      useRef() {
        return { current: null }
      },
      createElement(type, props, ...children) {
        return { type, props: props || {}, children }
      },
    }
  }
  const renderWith = (overrides) => {
    globalThis.React = makeReact(overrides)
    globalThis.h = React.createElement
    return flattenTree(StudioView({ sessionId: 'session-1' }))
  }
  globalThis.window = {
    innerWidth: 1440,
    innerHeight: 900,
    location: { origin: 'http://127.0.0.1:1234' },
    addEventListener() {},
    removeEventListener() {},
  }
  const { StudioView } = await import('../lib/client/src/studio-view.js?studio-view-test')
  const text = renderWith({})
  for (const label of ['Designs', 'Assets', 'Preview', 'Agent', 'Review', 'Upload', 'Settings', 'Open ↗', 'demo']) {
    assert.ok(text.includes(label), 'studio workspace renders ' + label)
  }
  const tourStyle = { id: 'liquid-glass', name: 'Liquid Glass', zh: '液态玻璃', vars: { '--bg': '#fff', '--gold': '#0071e3' } }
  const tourText = renderWith({
    stylePreview: tourStyle,
    styleTour: { styles: [tourStyle], index: 0 },
  })
  for (const label of ['Style tour', 'Liquid Glass', 'Apply style', 'Close']) {
    assert.ok(tourText.includes(label), 'style tour renders ' + label)
  }
  const selection = {
    tag: 'a',
    cssPath: 'body > a.brand',
    classPath: 'brand',
    classes: ['brand'],
    rect: { x: 10, y: 10, w: 120, h: 40 },
    styles: { 'border-radius': '12px', 'background-color': '#fff', padding: '4px', 'font-size': '1rem' },
    text: 'Sand & Stone',
    html: '<a class="brand">Sand &amp; Stone</a>',
  }
  const warningText = renderWith({
    keyState: { configured: false },
    harnessState: { vision: { available: false, reason: 'current model advertises text input only' } },
    selection,
  })
  assert.ok(warningText.includes('No image-capable model active'), 'selection warns when vision is unavailable')
})

test('history panel renders its controls', async () => {
  const React = {
    useState(initial) {
      return [typeof initial === 'function' ? initial() : initial, () => {}]
    },
    useEffect() {},
    useRef() {
      return { current: null }
    },
    createElement(type, props, ...children) {
      return { type, props: props || {}, children }
    },
  }
  globalThis.React = React
  globalThis.h = React.createElement
  const { HistoryPanel } = await import('../lib/client/src/history.js?history-test')
  const text = flattenTree(HistoryPanel({ slug: 'demo', onChanged() {} }))
  for (const label of ['Edit history', 'Snapshot now', 'Undo last edit', 'loading snapshots']) {
    assert.ok(text.includes(label), 'history panel renders ' + label)
  }
})

test('style atlas renders its gallery controls', async () => {
  const React = {
    useState(initial) {
      return [typeof initial === 'function' ? initial() : initial, () => {}]
    },
    useEffect() {},
    useRef() {
      return { current: null }
    },
    createElement(type, props, ...children) {
      return { type, props: props || {}, children }
    },
  }
  globalThis.React = React
  globalThis.h = React.createElement
  const { StyleAtlas } = await import('../lib/client/src/style-atlas.js?atlas-test')
  const text = flattenTree(StyleAtlas({ slug: 'demo', onPreview() {}, onChanged() {}, onCreated() {} }))
  for (const label of ['Style atlas', 'Random style', 'Save current', 'Try them now', 'loading style atlas']) {
    assert.ok(text.includes(label), 'style atlas renders ' + label)
  }
})

test('scaled preview and asset modal render their controls', async () => {
  const React = {
    useState(initial) {
      return [typeof initial === 'function' ? initial() : initial, () => {}]
    },
    useEffect() {},
    useRef() {
      return { current: null }
    },
    createElement(type, props, ...children) {
      return { type, props: props || {}, children }
    },
  }
  globalThis.React = React
  globalThis.h = React.createElement
  globalThis.window = {
    innerWidth: 1440,
    innerHeight: 900,
    location: { origin: 'http://127.0.0.1:1234' },
    addEventListener() {},
    removeEventListener() {},
  }

  const { ScaledPreview } = await import('../lib/client/src/scaled-preview.js?modal-test')
  const { AssetsModal } = await import('../lib/client/src/assets-modal.js?modal-test')

  const previewText = flattenTree(ScaledPreview({ slug: 'demo', tick: 1, viewport: 'desktop' }))
  for (const label of ['1440 × 1600', '50%']) {
    assert.ok(previewText.includes(label), 'scaled preview renders ' + label)
  }

  const assetsText = flattenTree(AssetsModal({ slug: 'demo', onClose() {} }))
  for (const label of ['Asset library', 'Upload images', 'Drop images here']) {
    assert.ok(assetsText.includes(label), 'asset modal renders ' + label)
  }
})
