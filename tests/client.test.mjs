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
    class Component {
      constructor(props) {
        this.props = props || {}
        this.state = {}
      }
      setState(next) {
        const patch = typeof next === 'function' ? next(this.state, this.props) : next
        this.state = Object.assign({}, this.state, patch)
      }
    }
    return { createElement: (type, props, ...children) => ({ type, props, children }), Component }
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
  assert.equal(bySlot('settings.section').length, 1)

  const view = bySlot('conversation.view')[0]
  assert.equal(view.options.id, 'design-studio')
  assert.equal(view.options.order, 20)
  assert.equal('inject' in view.options, false, 'obsolete slot inject face is gone')
  assert.equal(typeof view.component, 'function')

  const studio = bySlot('settings.section').find((entry) => entry.options.id === 'design-studio')
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
      defaultStyleScope: 'design',
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
    'Preferences',
    'All designs',
    'Vision transport',
    'Review style',
    'Default style apply scope',
    'Reasoning effort',
    'Viewport width',
    'Viewport height',
    'Design agent preset',
    'Auto-verify after Ask DeepSeek',
    'Delete designs when their chat is deleted',
    'Save changes',
    'Up to date',
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
      [demo], 'demo', null, 'index', false, '', '', false, '', '', 0, '', '', '',
      null, null, null, '', [], false, '', false, null, 'preview', 'desktop', false,
      'design', 'design', null, null, null, false, false, '', '', false, [], false, [], false,
      '', '', null, false, null, 0,
    ]
    if (overrides && overrides.systems) seeds[0] = overrides.systems
    if (overrides && overrides.workspaceTab) seeds[23] = overrides.workspaceTab
    if (overrides && overrides.stylePreview) seeds[28] = overrides.stylePreview
    if (overrides && overrides.styleTour) seeds[30] = overrides.styleTour
    if (overrides && overrides.keyState) seeds[15] = overrides.keyState
    if (overrides && overrides.harnessState) seeds[16] = overrides.harnessState
    if (overrides && overrides.selection) seeds[22] = overrides.selection
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
  for (const label of ['Designs', 'Assets', 'Preview', 'Agent', 'Review', 'Upload', 'Settings', 'Fit', '1:1', 'Open ↗', 'demo', 'Finish & freeze design']) {
    assert.ok(text.includes(label), 'studio workspace renders ' + label)
  }
  const frozenDemo = Object.assign({}, demo, {
    frozen: true,
    freeze: { at: '2026-10-20T00:00:00.000Z', implementation: 'S:\\projects\\example-app', note: '', finalSnapshot: 'snap-1' },
  })
  const frozenText = renderWith({ systems: [frozenDemo] })
  for (const label of ['Design frozen — implementation mode', 'Thaw design', 'S:\\projects\\example-app']) {
    assert.ok(frozenText.includes(label), 'frozen workspace renders ' + label)
  }
  assert.ok(!frozenText.includes('Finish & freeze design'), 'frozen workspace hides the freeze button')
  const secondDemo = Object.assign({}, demo, { slug: 'second-design', frozen: false, freeze: null })
  const switcherText = renderWith({ systems: [demo, secondDemo] })
  assert.ok(switcherText.includes('second-design'), 'preview includes a design switcher for every design')
  const tourStyle = { id: 'liquid-glass', name: 'Liquid Glass', zh: '液态玻璃', vars: { '--bg': '#fff', '--gold': '#0071e3' } }
  const tourText = renderWith({
    stylePreview: tourStyle,
    styleTour: { styles: [tourStyle], index: 0 },
  })
  for (const label of ['Style tour', 'Liquid Glass', 'Apply to this page', 'Apply to all pages', 'Close']) {
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

test('embedded all designs renders the library shell', async () => {
  const React = {
    useState(initial) {
      return [typeof initial === 'function' ? initial() : initial, () => {}]
    },
    useEffect() {},
    createElement(type, props, ...children) {
      return { type, props: props || {}, children }
    },
  }
  globalThis.React = React
  globalThis.h = React.createElement
  const { AllDesignsView } = await import('../lib/client/src/settings.js?all-designs-test')
  const tree = AllDesignsView({ embedded: true })

  function flatten(node) {
    if (node === null || node === undefined || node === false) return ''
    if (typeof node === 'string' || typeof node === 'number') return String(node)
    if (Array.isArray(node)) return node.map(flatten).join(' ')
    if (typeof node === 'object') return flatten(node.children)
    return ''
  }

  const text = flatten(tree)
  for (const label of ['designs', 'workspaces', 'Refresh', 'Sweep orphans', 'Loading designs…']) {
    assert.ok(text.includes(label), 'embedded All designs renders ' + label)
  }
  assert.equal(text.includes('Every design across every workspace'), false, 'embedded mode omits its duplicate hero')
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
  for (const label of ['1440 × 1600', '100%']) {
    assert.ok(previewText.includes(label), 'scaled preview renders ' + label)
  }

  const assetsText = flattenTree(AssetsModal({ slug: 'demo', onClose() {} }))
  for (const label of ['Asset library', 'Upload images', 'Drop images here']) {
    assert.ok(assetsText.includes(label), 'asset modal renders ' + label)
  }
})

test('QaLens design draft queues reviewed context only for the same live target', async () => {
  const { AppPanel } = await import('../lib/client/src/app-panel.js?qalens-draft-test')
  const { captureAndroidSelection } = await import('../lib/client/src/android-change-draft.js')
  const { runtime } = await import('../lib/client/src/runtime.js')
  const saved = { React: globalThis.React, h: globalThis.h, fetch: globalThis.fetch, ctx: runtime.ctx }
  const target = { package: 'com.example.app', projectRoot: '/workspace/app' }
  const view = { target, companion: { connected: true, connectionInstance: 'instance-a', connectionRevision: 4, url: 'http://127.0.0.1:8765', selection: { id: 'one', screen: 'Home', actions: ['tap'] }, component: { content: { package: target.package, component: { tag: 'HOME', role: 'Button', label: 'private-label', attributes: [{ name: 'token', value: 'private-token' }] } } } }, claim: { state: 'candidate', reason: 'Only a tag', candidates: [] }, mismatch: '' }
  const pin = captureAndroidSelection(view, target, 0)
  const sent = []
  let response = view
  runtime.ctx = { get: () => ({ binding: () => ({ session: { prompt: async (...args) => { sent.push(args); return { ok: true } } } }) }) }
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ ok: true, data: response }) })
  const react = (seeds) => ({
    useState(initial) { return [seeds.length ? seeds.shift() : initial, () => {}] },
    useEffect() {}, useRef() { return { current: 0 } },
    createElement(type, props, ...children) { return { type, props: props || {}, children } },
  })
  function find(node, predicate) {
    if (!node || typeof node !== 'object') return null
    if (predicate(node)) return node
    for (const child of (node.children || []).flat(Infinity)) { const match = find(child, predicate); if (match) return match }
    return null
  }
  try {
    globalThis.React = react(['qalens', false, true]); globalThis.h = React.createElement
    const shell = AppPanel({ slug: 'demo', sessionId: 'chat' })
    const panel = find(shell, n => typeof n.type === 'function' && n.type.name === 'QaLensPanel')
    assert.ok(panel)
    function render(busy = false) {
      globalThis.React = react(['http://127.0.0.1:8765', view, '', '', busy, target.package, target.projectRoot, '', target, [pin], 'Improve spacing', '', true])
      globalThis.h = React.createElement
      return panel.type(panel.props)
    }
    const waiting = render(true)
    assert.equal(find(waiting, n => n.type === 'textarea').props.disabled, true)
    assert.equal(find(waiting, n => n.type === 'input' && n.props.placeholder === 'com.example.app').props.disabled, true)
    assert.equal(find(waiting, n => n.type === 'input' && n.props.placeholder === '/absolute/path/to/project').props.disabled, true)
    let button = find(render(), n => n.props && n.props.label === 'Ask DeepSeek to investigate')
    assert.equal(button.props.disabled, false)
    await button.props.onClick()
    assert.equal(sent.length, 1)
    assert.equal(sent[0][1], 'queue')
    assert.match(sent[0][0][0].text, /Do not edit files/)
    assert.match(sent[0][0][0].text, /Improve spacing/)
    assert.doesNotMatch(sent[0][0][0].text, /private-label|private-token/)
    response = { ...view, companion: { ...view.companion, connectionRevision: 5 } }
    button = find(render(), n => n.props && n.props.label === 'Ask DeepSeek to investigate')
    await button.props.onClick()
    assert.equal(sent.length, 1, 'a changed connection cannot queue the stale draft')
  } finally {
    globalThis.React = saved.React; globalThis.h = saved.h; globalThis.fetch = saved.fetch; runtime.ctx = saved.ctx
  }
})

test('QaLens scanner selects an installed app without typing a package or source root', async () => {
  const { AppPanel } = await import('../lib/client/src/app-panel.js?scanner')
  const saved = { React: globalThis.React, h: globalThis.h, fetch: globalThis.fetch }
  const calls = [], slots = [], effects = []
  let deviceList = [{ serial: 'emulator-5554', state: 'device', description: 'model:Pixel' }]
  let appList = [{ package: 'example.qa' }]
  const view = { companion: { state: 'ready', connected: true, connectedTarget: { serial: 'emulator-5554', package: 'example.qa' }, url: 'http://127.0.0.1:8765' }, target: { package: '', projectRoot: '' } }
  function react(seeds) { return { useState(initial) { return [seeds.length ? seeds.shift() : initial, () => {}] }, useRef(initial) { return { current: initial } }, useEffect() {}, createElement(type, props, ...children) { return { type, props: props || {}, children } } } }
  function find(node, fn) { if (!node || typeof node !== 'object') return null; if (fn(node)) return node; for (const child of (node.children || []).flat(Infinity)) { const found = find(child, fn); if (found) return found } return null }
  globalThis.React = react(['qalens', false, true, '']); globalThis.h = React.createElement
  const shell = AppPanel({ slug: 'demo' })
  const panel = find(shell, n => typeof n.type === 'function' && n.type.name === 'QaLensPanel')
  function render() {
    let i = 0
    globalThis.React = { useState(initial) { const n = i++; if (!(n in slots)) slots[n] = initial; return [slots[n], value => { slots[n] = typeof value === 'function' ? value(slots[n]) : value }] }, useRef(initial) { return { current: initial } }, useEffect(fn) { effects.push(fn) }, createElement(type, props, ...children) { return { type, props: props || {}, children } } }
    globalThis.h = React.createElement
    return panel.type(panel.props)
  }
  slots[1] = view
  globalThis.fetch = async (url, options) => {
    const method = String(url).split('/').at(-1), body = JSON.parse(options.body)
    calls.push({ method, body })
    const data = method === 'studio.qalens.devices' ? { devices: deviceList }
      : method === 'studio.qalens.apps' ? { apps: appList }
        : method === 'studio.qalens.target.save' ? { package: body.package, projectRoot: body.projectRoot, ...(body.serial ? { serial: body.serial } : {}) } : {}
    return { ok: true, json: async () => ({ ok: true, data }) }
  }
  try {
    let button = find(render(), n => n.props && n.props.label === 'Scan for QaLens apps')
    assert.ok(button); await button.props.onClick()
    assert.deepEqual(calls.map(c => c.method), ['studio.qalens.devices', 'studio.qalens.apps'])
    button = find(render(), n => n.props && n.props.label === 'Use this app')
    assert.ok(button); assert.equal(button.props.disabled, false)
    await button.props.onClick()
    assert.deepEqual(calls.at(-1).body, { slug: 'demo', package: 'example.qa', projectRoot: '', serial: 'emulator-5554' })
    assert.equal(find(render(), n => n.type === 'input' && n.props.placeholder === 'com.example.app').props.value, 'example.qa')
    slots[5] = 'previous.app'; slots[6] = '/work/previous'; slots[8] = { package: 'previous.app', projectRoot: '/work/previous' }
    button = find(render(), n => n.props && n.props.label === 'Use this app')
    await button.props.onClick()
    assert.deepEqual(calls.at(-1).body, { slug: 'demo', package: 'example.qa', projectRoot: '', serial: 'emulator-5554' }, 'a different app must not inherit the previous app source folder')
    appList = [{ package: 'other.qa' }, { package: 'example.qa' }]
    await find(render(), n => n.props && n.props.label === 'Scan for QaLens apps').props.onClick()
    const appSelect = find(render(), n => n.type === 'select' && find(n, child => child.type === 'option' && child.props.value === 'other.qa'))
    assert.equal(appSelect.props.value, 'example.qa', 'the currently connected app is selected when present')
    assert.match(find(appSelect, n => n.type === 'option' && n.props.value === 'example.qa').children.join(''), /connected/)
    deviceList = [{ serial: 'phone-1', state: 'device' }, { serial: 'phone-2', state: 'device' }, { serial: 'phone-3', state: 'unauthorized' }]
    const previousAppsCalls = calls.filter(c => c.method === 'studio.qalens.apps').length
    await find(render(), n => n.props && n.props.label === 'Scan for QaLens apps').props.onClick()
    assert.equal(calls.filter(c => c.method === 'studio.qalens.apps').length, previousAppsCalls, 'multiple devices require an explicit choice')
    const deviceSelect = find(render(), n => n.type === 'select' && find(n, child => child.type === 'option' && child.props.value === 'phone-2'))
    assert.ok(deviceSelect)
    assert.equal(find(deviceSelect, n => n.type === 'option' && n.props.value === 'phone-3').props.disabled, true)
    await deviceSelect.props.onChange({ target: { value: 'phone-2' } })
    assert.deepEqual(calls.at(-1).body, { serial: 'phone-2' })
  } finally { globalThis.React = saved.React; globalThis.h = saved.h; globalThis.fetch = saved.fetch }
})

test('Appium disconnect waits for pending reads and discards stale UI results', async () => {
  const { AppPanel } = await import('../lib/client/src/app-panel.js?disconnect-regression')
  const saved = { React: globalThis.React, h: globalThis.h, fetch: globalThis.fetch }
  const oldNode = { index: 0, text: 'Old element', className: 'View', resourceId: 'OLD', bounds: { x: 0, y: 0, w: 10, h: 10 } }
  const config = { capabilities: { 'appium:appPackage': 'example.app' }, projectRoot: '/work/app' }
  const values = [{ session: { id: 'one' }, appium: { reachable: true }, config }, { url: 'old.png', w: 10, h: 10 }, [oldNode], oldNode, { using: 'id', value: 'OLD' }, null, true, '', '', '', '', [], 0, { routes: [], navTargets: [], adapter: { capabilities: { source: false } } }, '', null, false, true, false, 'inspect', '', false, false, {}]
  const refs = []; const requests = []; const releases = {}
  function createReact(slots) {
    let stateIndex = 0, refIndex = 0
    return {
      useState(initial) { const i = stateIndex++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value }] },
      useRef(initial) { const i = refIndex++; return refs[i] || (refs[i] = { current: initial }) },
      useEffect() {}, createElement(type, props, ...children) { return { type, props: props || {}, children } },
    }
  }
  function find(node, fn) {
    if (!node || typeof node !== 'object') return null
    if (fn(node)) return node
    for (const child of (node.children || []).flat(Infinity)) { const found = find(child, fn); if (found) return found }
    return null
  }
  globalThis.fetch = async (url) => {
    const method = String(url).split('/').at(-1); requests.push(method)
    if (method === 'studio.android.shot' || method === 'studio.android.tree') {
      return await new Promise(resolve => { releases[method] = () => resolve({ ok: true, json: async () => ({ ok: true, data: method.endsWith('shot') ? { path: 'late.png', w: 10, h: 10 } : { nodes: [oldNode] } }) }) })
    }
    return { ok: true, json: async () => ({ ok: true, data: {} }) }
  }
  try {
    globalThis.React = createReact(['android']); globalThis.h = React.createElement
    const shell = AppPanel({ slug: 'demo', sessionId: 'chat' })
    const panel = find(shell, n => typeof n.type === 'function' && n.type.name === 'AndroidPanel')
    globalThis.React = createReact(values); globalThis.h = React.createElement
    const tree = panel.type(panel.props)
    refs[5].current = oldNode
    const refresh = find(tree, n => n.props && n.props.label === 'Refresh')
    const disconnect = find(tree, n => n.props && n.props.label === 'Disconnect')
    assert.ok(refresh && disconnect)
    const reading = refresh.props.onClick()
    const stopping = disconnect.props.onClick()
    assert.equal(values[1], null)
    assert.deepEqual(values[2], [])
    assert.equal(values[3], null)
    assert.equal(values[17], false)
    assert.equal(values[0].session, null)
    assert(!requests.includes('studio.android.disconnect'), 'wait for reads before disconnecting')
    releases['studio.android.shot'](); releases['studio.android.tree']()
    await Promise.all([reading, stopping])
    assert(requests.includes('studio.android.disconnect'))
    assert.equal(values[1], null, 'late screenshot must not reappear')
    assert.deepEqual(values[2], [], 'late tree must not reappear')
    assert.equal(values[3], null, 'late selection must not reappear')
    assert(!requests.includes('studio.android.history'))
  } finally { globalThis.React = saved.React; globalThis.h = saved.h; globalThis.fetch = saved.fetch }
})

test('opening the disconnected Appium panel only checks status', async () => {
  const { AppPanel } = await import('../lib/client/src/app-panel.js?no-auto-context')
  const saved = { React: globalThis.React, h: globalThis.h, fetch: globalThis.fetch }
  const effects = [], requests = []
  function react(seeds) {
    return {
      useState(initial) { return [seeds.length ? seeds.shift() : initial, () => {}] },
      useRef(initial) { return { current: initial } },
      useEffect(fn) { effects.push(fn) },
      createElement(type, props, ...children) { return { type, props: props || {}, children } },
    }
  }
  function find(node, fn) {
    if (!node || typeof node !== 'object') return null
    if (fn(node)) return node
    for (const child of (node.children || []).flat(Infinity)) { const found = find(child, fn); if (found) return found }
    return null
  }
  globalThis.fetch = async url => {
    requests.push(String(url).split('/').at(-1))
    return { ok: true, json: async () => ({ ok: true, data: { session: null, config: { capabilities: {} }, appium: { reachable: false } } }) }
  }
  try {
    globalThis.React = react(['android']); globalThis.h = React.createElement
    const panel = find(AppPanel({ slug: 'demo' }), n => typeof n.type === 'function' && n.type.name === 'AndroidPanel')
    globalThis.React = react([]); globalThis.h = React.createElement
    panel.type(panel.props)
    const mount = effects.find(fn => String(fn).includes('refreshStatus()'))
    assert.ok(mount)
    mount()
    await new Promise(resolve => setImmediate(resolve))
    assert.deepEqual(requests, ['studio.android.status'])
  } finally { globalThis.React = saved.React; globalThis.h = saved.h; globalThis.fetch = saved.fetch }
})

test('Appium refresh drops old screenshot and selection when the tree fails', async () => {
  const { AppPanel } = await import('../lib/client/src/app-panel.js?tree-failure')
  const saved = { React: globalThis.React, h: globalThis.h, fetch: globalThis.fetch }
  const node = { index: 0, text: 'Old', resourceId: 'OLD', className: 'View', bounds: { x: 0, y: 0, w: 10, h: 10 } }
  const status = { session: { id: 'one' }, config: { capabilities: {} }, appium: { reachable: true } }
  const values = [status, { url: 'old.png', w: 10, h: 10 }, [node], node, { using: 'id', value: 'OLD' }, null, true, '', '', '', '', [], 0, { routes: [], navTargets: [], adapter: { capabilities: { source: false } } }, '', null, false, true, false, 'inspect', '', false, false, {}]
  const refs = []
  function react(slots) {
    let si = 0, ri = 0
    return { useState(initial) { const i = si++; if (!(i in slots)) slots[i] = initial; return [slots[i], v => { slots[i] = typeof v === 'function' ? v(slots[i]) : v }] }, useRef(initial) { const i = ri++; return refs[i] || (refs[i] = { current: initial }) }, useEffect() {}, createElement(type, props, ...children) { return { type, props: props || {}, children } } }
  }
  function find(node, fn) { if (!node || typeof node !== 'object') return null; if (fn(node)) return node; for (const child of (node.children || []).flat(Infinity)) { const found = find(child, fn); if (found) return found } return null }
  globalThis.fetch = async url => {
    const method = String(url).split('/').at(-1)
    const response = method === 'studio.android.tree' ? { ok: false, error: 'tree failed' } : { ok: true, data: method === 'studio.android.shot' ? { path: 'new.png', w: 10, h: 10 } : status }
    return { ok: true, json: async () => response }
  }
  try {
    globalThis.React = react(['android']); globalThis.h = React.createElement
    const panel = find(AppPanel({ slug: 'demo' }), n => typeof n.type === 'function' && n.type.name === 'AndroidPanel')
    globalThis.React = react(values); globalThis.h = React.createElement
    const tree = panel.type(panel.props); refs[5].current = node
    await find(tree, n => n.props && n.props.label === 'Refresh').props.onClick()
    assert.equal(values[1], null)
    assert.deepEqual(values[2], [])
    assert.equal(values[3], null)
    assert.equal(values[17], false)
    assert.equal(values[8], 'tree failed')
  } finally { globalThis.React = saved.React; globalThis.h = saved.h; globalThis.fetch = saved.fetch }
})

test('app target switch is disabled during a pending operation', async () => {
  const { AppPanel } = await import('../lib/client/src/app-panel.js?busy-target')
  const saved = { React: globalThis.React, h: globalThis.h }
  try {
    const seeds = ['qalens', true]
    globalThis.React = { useState(initial) { return [seeds.length ? seeds.shift() : initial, () => {}] }, useEffect() {}, useRef(initial) { return { current: initial } }, createElement(type, props, ...children) { return { type, props: props || {}, children } } }
    globalThis.h = React.createElement
    const tree = AppPanel({ slug: 'demo' })
    const all = []; (function visit(n) { if (!n || typeof n !== 'object') return; all.push(n); for (const c of (n.children || []).flat(Infinity)) visit(c) })(tree)
    assert.equal(all.find(n => n.type === 'select' && n.props['aria-label'] === 'App target').props.disabled, true)
  } finally { globalThis.React = saved.React; globalThis.h = saved.h }
})

test('Appium disconnect survives an App panel unmount', async () => {
  const { AppPanel } = await import('../lib/client/src/app-panel.js?disconnect-remount')
  const saved = { React: globalThis.React, h: globalThis.h, fetch: globalThis.fetch }
  const requests = [], effects = []
  const status = { session: { id: 's' }, config: { capabilities: { 'appium:appPackage': 'test.app' } }, appium: { reachable: true } }
  function react(slots) {
    let i = 0
    return { useState(initial) { const n = i++; if (!(n in slots)) slots[n] = initial; return [slots[n], v => { slots[n] = typeof v === 'function' ? v(slots[n]) : v }] }, useRef(initial) { return { current: initial } }, useEffect(fn) { effects.push(fn) }, createElement(type, props, ...children) { return { type, props: props || {}, children } } }
  }
  function find(node, fn) { if (!node || typeof node !== 'object') return null; if (fn(node)) return node; for (const child of (node.children || []).flat(Infinity)) { const item = find(child, fn); if (item) return item } return null }
  globalThis.fetch = async url => { requests.push(String(url).split('/').at(-1)); return { ok: true, json: async () => ({ ok: true, data: {} }) } }
  try {
    globalThis.React = react(['android']); globalThis.h = React.createElement
    const child = find(AppPanel({ slug: 'disconnect-remount' }), n => typeof n.type === 'function' && n.type.name === 'AndroidPanel')
    globalThis.React = react([status]); globalThis.h = React.createElement
    const tree = child.type(child.props)
    await find(tree, n => n.props && n.props.label === 'Disconnect').props.onClick()
    assert.deepEqual(requests, ['studio.android.disconnect'])
    effects.length = 0
    globalThis.React = react(['android']); globalThis.h = React.createElement
    const reopened = find(AppPanel({ slug: 'disconnect-remount' }), n => typeof n.type === 'function' && n.type.name === 'AndroidPanel')
    globalThis.React = react([{ ...status, session: null }]); globalThis.h = React.createElement
    reopened.type(reopened.props)
    const auto = effects.find(fn => String(fn).includes('reconnecting Android app'))
    assert.ok(auto); auto(); await new Promise(resolve => setImmediate(resolve))
    assert.deepEqual(requests, ['studio.android.disconnect'], 'remount must not reconnect without explicit connect')
  } finally { globalThis.React = saved.React; globalThis.h = saved.h; globalThis.fetch = saved.fetch }
})

test('fallback selection tap marks target busy until input completes', async () => {
  const { AppPanel } = await import('../lib/client/src/app-panel.js?tap-busy')
  const saved = { React: globalThis.React, h: globalThis.h, fetch: globalThis.fetch }
  const node = { index: 0, text: 'Button', resourceId: 'BUTTON', className: 'View', bounds: { x: 0, y: 0, w: 10, h: 10 } }
  const status = { session: { id: 's' }, config: { capabilities: {} }, appium: { reachable: true } }
  const slots = [status, { url: 'shot', w: 10, h: 10 }, [node], node, { using: 'id', value: 'BUTTON' }, null, true, '', '', '', '', [], 0, { routes: [], navTargets: [], adapter: { capabilities: {} } }, '', null, false, true, false, 'inspect', '', false, false, {}]
  let release; const busy = []
  function react(values) { let i = 0; return { useState(initial) { const n = i++; if (!(n in values)) values[n] = initial; return [values[n], v => { values[n] = typeof v === 'function' ? v(values[n]) : v }] }, useRef(initial) { return { current: initial } }, useEffect() {}, createElement(type, props, ...children) { return { type, props: props || {}, children } } } }
  function find(node, fn) { if (!node || typeof node !== 'object') return null; if (fn(node)) return node; for (const child of (node.children || []).flat(Infinity)) { const item = find(child, fn); if (item) return item } return null }
  globalThis.fetch = async url => {
    const method = String(url).split('/').at(-1)
    if (method === 'studio.android.tap') return await new Promise(resolve => { release = () => resolve({ ok: true, json: async () => ({ ok: true, data: {} }) }) })
    const data = method === 'studio.android.shot' ? { path: 'new', w: 10, h: 10 } : method === 'studio.android.tree' ? { nodes: [node] } : status
    return { ok: true, json: async () => ({ ok: true, data }) }
  }
  try {
    globalThis.React = react(['android']); globalThis.h = React.createElement
    const child = find(AppPanel({ slug: 'tap-busy' }), n => typeof n.type === 'function' && n.type.name === 'AndroidPanel')
    child.props.onBusyChange = value => busy.push(value)
    globalThis.React = react(slots); globalThis.h = React.createElement
    const tree = child.type(child.props)
    const tapping = find(tree, n => n.props && n.props.label === 'Tap node').props.onClick()
    assert.deepEqual(busy, [true])
    release(); await tapping
    assert.deepEqual(busy, [true, false])
  } finally { globalThis.React = saved.React; globalThis.h = saved.h; globalThis.fetch = saved.fetch }
})

test('repeated screenshot taps cannot overlap or release the target switch early', async () => {
  const { AppPanel } = await import('../lib/client/src/app-panel.js?double-tap')
  const saved = { React: globalThis.React, h: globalThis.h, fetch: globalThis.fetch }
  const status = { session: { id: 's' }, config: { capabilities: {} }, appium: { reachable: true } }
  const slots = [status, { url: 'shot', w: 100, h: 100 }, [], null, null, null, true, '', '', '', '', [], 0, null, '', null, false, false, false, 'inspect', '', false, true, {}]
  let release, taps = 0; const busy = []
  function react(values) { let i = 0; return { useState(initial) { const n = i++; if (!(n in values)) values[n] = initial; return [values[n], v => { values[n] = typeof v === 'function' ? v(values[n]) : v }] }, useRef(initial) { return { current: initial } }, useEffect() {}, createElement(type, props, ...children) { return { type, props: props || {}, children } } } }
  function find(node, fn) { if (!node || typeof node !== 'object') return null; if (fn(node)) return node; for (const child of (node.children || []).flat(Infinity)) { const item = find(child, fn); if (item) return item } return null }
  globalThis.fetch = async url => {
    const method = String(url).split('/').at(-1)
    if (method === 'studio.android.tap') { taps++; return await new Promise(resolve => { release = () => resolve({ ok: true, json: async () => ({ ok: true, data: {} }) }) }) }
    const data = method === 'studio.android.shot' ? { path: 'new', w: 100, h: 100 } : method === 'studio.android.tree' ? { nodes: [] } : status
    return { ok: true, json: async () => ({ ok: true, data }) }
  }
  try {
    globalThis.React = react(['android']); globalThis.h = React.createElement
    const child = find(AppPanel({ slug: 'double-tap' }), n => typeof n.type === 'function' && n.type.name === 'AndroidPanel')
    child.props.onBusyChange = value => busy.push(value)
    globalThis.React = react(slots); globalThis.h = React.createElement
    const tree = child.type(child.props)
    const image = find(tree, n => n.type === 'img' && n.props.alt === 'Android app screenshot')
    const event = { clientX: 20, clientY: 20, currentTarget: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) } }
    image.props.onClick(event); image.props.onClick(event)
    assert.equal(taps, 1)
    assert.deepEqual(busy, [true])
    release(); await new Promise(resolve => setImmediate(resolve))
    assert.deepEqual(busy, [true, false])
  } finally { globalThis.React = saved.React; globalThis.h = saved.h; globalThis.fetch = saved.fetch }
})

test('opened App workspace stays mounted while hidden and workspace tabs lock during an operation', async () => {
  const { StudioView } = await import('../lib/client/src/studio-view.js?app-workspace-preservation')
  const saved = { React: globalThis.React, h: globalThis.h, window: globalThis.window }
  const demo = { slug: 'demo', sessionId: 'chat', files: [], stamp: { hash: 'abc', at: '' }, hasPreview: true }
  const base = [[demo], 'demo', null, 'index', false, '', '', false, '', '', 0, '', '', '', null, null, null, '', [], false, '', false, null, 'preview', 'desktop', false, 'design', 'design', null, null, null, false, false, '', '', false, [], false, [], false, '', '', null, false, null, 0, 'demo', false]
  function render(tab, opened, busy, studioBusy = '') {
    const seeds = [...base]; seeds[23] = tab; seeds[46] = opened; seeds[47] = busy; seeds[11] = studioBusy
    globalThis.React = { useState(initial) { return [seeds.length ? seeds.shift() : initial, () => {}] }, useRef(initial) { return { current: initial } }, useEffect() {}, createElement(type, props, ...children) { return { type, props: props || {}, children } } }
    globalThis.h = React.createElement
    return StudioView({ sessionId: 'chat' })
  }
  function find(node, fn) { if (!node || typeof node !== 'object') return null; if (fn(node)) return node; for (const child of (node.children || []).flat(Infinity)) { const item = find(child, fn); if (item) return item } return null }
  try {
    globalThis.window = { innerWidth: 1440, innerHeight: 900, location: { origin: 'http://127.0.0.1' }, addEventListener() {}, removeEventListener() {} }
    const unseen = render('preview', '', false)
    assert.equal(find(unseen, n => typeof n.type === 'function' && n.type.name === 'AppPanel'), null)
    const hidden = render('preview', 'demo', false)
    const panel = find(hidden, n => typeof n.type === 'function' && n.type.name === 'AppPanel')
    assert.ok(panel); assert.equal(panel.props.active, false)
    const container = find(hidden, n => n.props && n.props.className === 'ds-workspace-app')
    assert.equal(container.props.hidden, true)
    const busy = render('app', 'demo', true)
    const previewTab = find(busy, n => n.type === 'button' && n.children && n.children.includes('Preview'))
    assert.equal(previewTab.props.disabled, true)
    assert.equal(find(busy, n => n.type === 'input' && n.props.placeholder === 'new-project').props.disabled, true)
    assert.equal(find(busy, n => n.type === 'button' && n.children && n.children.includes('Create')).props.disabled, true)
    assert.equal(find(busy, n => n.type === 'button' && n.children && n.children.includes('Refresh')).props.disabled, true)
    assert.equal(find(busy, n => n.type === 'button' && n.children && n.children.includes('🗜 Export zip')).props.disabled, true)
    assert.equal(find(busy, n => n.type === 'button' && n.children && n.children.includes('❄ Finish & freeze design')).props.disabled, true)
    const otherBusy = render('app', 'demo', false, 'creating…')
    assert.equal(find(otherBusy, n => n.type === 'fieldset' && n.props.className === 'ds-workspace-app-controls').props.disabled, true)
    assert.equal(find(otherBusy, n => typeof n.type === 'function' && n.type.name === 'AppPanel').props.active, false)
    const overlapping = render('app', 'demo', true, 'zipping…')
    assert.equal(find(overlapping, n => typeof n.type === 'function' && n.type.name === 'AppPanel').props.active, true, 'an existing App operation must not be unmounted')
  } finally { globalThis.React = saved.React; globalThis.h = saved.h; globalThis.window = saved.window }
})

test('inactive Appium panel cannot auto-connect or send screenshot taps', async () => {
  const { AppPanel } = await import('../lib/client/src/app-panel.js?inactive-appium')
  const saved = { React: globalThis.React, h: globalThis.h, fetch: globalThis.fetch }
  const status = { session: null, config: { capabilities: { 'appium:appPackage': 'test.app' } }, appium: { reachable: true } }
  const slots = [status, { url: 'shot', w: 100, h: 100 }, [], null, null, null, true, '', '', '', '', [], 0, null, '', null, false, false, false, 'inspect', '', false, true, {}]
  const effects = [], requests = []
  function react(values) { let i = 0; return { useState(initial) { const n = i++; if (!(n in values)) values[n] = initial; return [values[n], () => {}] }, useRef(initial) { return { current: initial } }, useEffect(fn) { effects.push(fn) }, createElement(type, props, ...children) { return { type, props: props || {}, children } } } }
  function find(node, fn) { if (!node || typeof node !== 'object') return null; if (fn(node)) return node; for (const child of (node.children || []).flat(Infinity)) { const item = find(child, fn); if (item) return item } return null }
  globalThis.fetch = async url => { requests.push(String(url)); return { ok: true, json: async () => ({ ok: true, data: {} }) } }
  try {
    globalThis.React = react(['android']); globalThis.h = React.createElement
    const child = find(AppPanel({ slug: 'inactive', active: false }), n => typeof n.type === 'function' && n.type.name === 'AndroidPanel')
    assert.equal(child.props.active, false)
    effects.length = 0; globalThis.React = react(slots); globalThis.h = React.createElement
    const tree = child.type(child.props)
    const auto = effects.find(fn => String(fn).includes('reconnecting Android app'))
    auto()
    find(tree, n => n.type === 'img' && n.props.alt === 'Android app screenshot').props.onClick({ clientX: 10, clientY: 10, currentTarget: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) } })
    await new Promise(resolve => setImmediate(resolve))
    assert.deepEqual(requests, [])
  } finally { globalThis.React = saved.React; globalThis.h = saved.h; globalThis.fetch = saved.fetch }
})

test('style-created project selection waits for an App operation to finish', async () => {
  const { StudioView } = await import('../lib/client/src/studio-view.js?style-deferred')
  const saved = { React: globalThis.React, h: globalThis.h, window: globalThis.window, fetch: globalThis.fetch }
  const demo = { slug: 'demo', sessionId: 'chat', files: [], stamp: { hash: 'a' }, hasPreview: true }
  const created = { slug: 'created', sessionId: 'chat', files: [], stamp: { hash: 'b' }, hasPreview: true }
  const slots = [[demo], 'demo', null, 'index', false, '', '', false, '', '', 0, '', '', '', null, null, null, '', [], false, '', false, null, 'styles', 'desktop', false, 'design', 'design', null, null, null, false, false, '', '', false, [], false, [], false, '', '', null, false, null, 0, 'demo', false]
  const refs = []; let effects = []
  function render() {
    let si = 0, ri = 0; effects = []
    globalThis.React = { useState(initial) { const n = si++; if (!(n in slots)) slots[n] = initial; return [slots[n], v => { slots[n] = typeof v === 'function' ? v(slots[n]) : v }] }, useRef(initial) { const n = ri++; return refs[n] || (refs[n] = { current: initial }) }, useEffect(fn) { effects.push(fn) }, createElement(type, props, ...children) { return { type, props: props || {}, children } } }
    globalThis.h = React.createElement
    return StudioView({ sessionId: 'chat' })
  }
  function find(node, fn) { if (!node || typeof node !== 'object') return null; if (fn(node)) return node; for (const child of (node.children || []).flat(Infinity)) { const item = find(child, fn); if (item) return item } return null }
  globalThis.window = { innerWidth: 1440, innerHeight: 900, location: { origin: 'http://127.0.0.1' }, addEventListener() {}, removeEventListener() {} }
  globalThis.fetch = async url => ({ ok: true, json: async () => ({ ok: true, data: String(url).endsWith('studio.list') ? [demo, created] : {} }) })
  try {
    const tree = render()
    const app = find(tree, n => typeof n.type === 'function' && n.type.name === 'AppPanel')
    const atlas = find(tree, n => typeof n.type === 'function' && n.type.name === 'StyleAtlas')
    assert.ok(app && atlas)
    app.props.onBusyChange(true)
    await atlas.props.onCreated('created')
    assert.equal(slots[1], 'demo')
    assert.equal(slots[23], 'styles')
    app.props.onBusyChange(false)
    render()
    const deferred = effects.find(fn => String(fn).includes('pendingStyleProjectRef'))
    assert.ok(deferred); deferred()
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(slots[1], 'created')
    assert.equal(slots[23], 'preview')
  } finally { globalThis.React = saved.React; globalThis.h = saved.h; globalThis.window = saved.window; globalThis.fetch = saved.fetch }
})

test('App starts without QaLens and makes no companion calls until opted in', async () => {
  const { AppPanel } = await import('../lib/client/src/app-panel.js?qalens-opt-in')
  const saved = { React: globalThis.React, h: globalThis.h, fetch: globalThis.fetch, window: globalThis.window }
  const calls = [], effects = []
  function react(seeds) { return { useState(initial) { return [seeds.length ? seeds.shift() : initial, () => {}] }, useRef(initial) { return { current: initial } }, useEffect(fn) { effects.push(fn) }, createElement(type, props, ...children) { return { type, props: props || {}, children } } } }
  function find(node, fn) { if (!node || typeof node !== 'object') return null; if (fn(node)) return node; for (const child of (node.children || []).flat(Infinity)) { const item = find(child, fn); if (item) return item } return null }
  globalThis.fetch = async url => { calls.push(String(url).split('/').at(-1)); return { ok: true, json: async () => ({ ok: true, data: { qalensEnabled: false } }) } }
  globalThis.window = { addEventListener() {}, removeEventListener() {} }
  try {
    globalThis.React = react([]); globalThis.h = React.createElement
    const tree = AppPanel({ slug: 'demo' })
    assert.equal(find(tree, n => typeof n.type === 'function' && n.type.name === 'QaLensPanel'), null)
    assert.equal(find(tree, n => n.type === 'option' && n.props.value === 'qalens'), null)
    assert.equal(find(tree, n => n.type === 'select').props.value, 'choose')
    const check = effects.find(fn => String(fn).includes('refreshFeatures'))
    assert.ok(check); const dispose = check(); await new Promise(resolve => setImmediate(resolve))
    assert.deepEqual(calls, ['studio.features'])
    dispose()
    globalThis.React = react(['qalens', false, true, '']); globalThis.h = React.createElement
    const enabled = AppPanel({ slug: 'demo' })
    assert.ok(find(enabled, n => n.type === 'option' && n.props.value === 'qalens'))
    assert.ok(find(enabled, n => typeof n.type === 'function' && n.type.name === 'QaLensPanel'))
  } finally { globalThis.React = saved.React; globalThis.h = saved.h; globalThis.fetch = saved.fetch; globalThis.window = saved.window }
})

test('App explains when an older host needs a plugin reload', async () => {
  const { AppPanel } = await import('../lib/client/src/app-panel.js?older-host')
  const saved = { React: globalThis.React, h: globalThis.h, fetch: globalThis.fetch, window: globalThis.window }
  const slots = [], effects = []
  function render() {
    let i = 0
    globalThis.React = {
      useState(initial) { const n = i++; if (!(n in slots)) slots[n] = initial; return [slots[n], value => { slots[n] = value }] },
      useRef(initial) { return { current: initial } },
      useEffect(fn) { effects.push(fn) },
      createElement(type, props, ...children) { return { type, props: props || {}, children } },
    }
    globalThis.h = React.createElement
    return AppPanel({ slug: 'demo', onOpenSettings() {} })
  }
  function flatten(node) { if (node == null || node === false) return ''; if (typeof node !== 'object') return String(node); if (Array.isArray(node)) return node.map(flatten).join(' '); return flatten(node.children || []) }
  function find(node, fn) { if (!node || typeof node !== 'object') return null; if (fn(node)) return node; for (const child of (node.children || []).flat(Infinity)) { const result = find(child, fn); if (result) return result } return null }
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ ok: false, error: 'unknown api method: studio.features' }) })
  globalThis.window = { addEventListener() {}, removeEventListener() {} }
  try {
    render()
    const dispose = effects.find(fn => String(fn).includes('refreshFeatures'))()
    await new Promise(resolve => setImmediate(resolve))
    const tree = render(), text = flatten(tree)
    assert.match(text, /reload.*plugin.*refresh/i)
    assert.doesNotMatch(text, /unknown api method/i)
    assert.match(text, /Android · Appium/)
    assert.match(text, /Compose Desktop/)
    assert.equal(find(tree, n => n.props && n.props.label === 'Open Design Studio settings'), null)
    dispose()
  } finally { globalThis.React = saved.React; globalThis.h = saved.h; globalThis.fetch = saved.fetch; globalThis.window = saved.window }
})

test('settings make QaLens an explicit saved opt-in', async () => {
  const { SettingsView } = await import('../lib/client/src/settings.js?qalens-opt-in')
  const saved = { React: globalThis.React, h: globalThis.h, fetch: globalThis.fetch, window: globalThis.window }
  const config = { visionModels: ['test'], options: {}, capture: { width: 1440, height: 1700 }, qalens: { enabled: false } }
  const slots = [null, null, [], config, '', null, null, '', [], '', '', '', false, false, 'preferences']
  const calls = [], events = []
  function render() {
    let i = 0
    globalThis.React = { useState(initial) { const n = i++; if (!(n in slots)) slots[n] = initial; return [slots[n], v => { slots[n] = typeof v === 'function' ? v(slots[n]) : v }] }, useEffect() {}, createElement(type, props, ...children) { return { type, props: props || {}, children } } }
    globalThis.h = React.createElement
    return SettingsView()
  }
  function flatten(node) { if (node == null || node === false) return ''; if (typeof node !== 'object') return String(node); if (Array.isArray(node)) return node.map(flatten).join(' '); return flatten(node.children || []) }
  function find(node, fn) { if (!node || typeof node !== 'object') return null; if (fn(node)) return node; for (const child of (node.children || []).flat(Infinity)) { const item = find(child, fn); if (item) return item } return null }
  globalThis.window = { dispatchEvent(event) { events.push(event.type) } }
  globalThis.fetch = async (url, opts) => { calls.push({ method: String(url).split('/').at(-1), body: JSON.parse(opts.body) }); return { ok: true, json: async () => ({ ok: true, data: slots[3] }) } }
  try {
    const tree = render()
    const label = find(tree, n => n.type === 'label' && flatten(n).includes('Enable QaLens companion'))
    assert.ok(label)
    const checkbox = find(label, n => n.type === 'input' && n.props.type === 'checkbox')
    assert.equal(checkbox.props.checked, false)
    checkbox.props.onChange({ target: { checked: true } })
    assert.equal(slots[3].qalens.enabled, true)
    assert.equal(calls.length, 0, 'toggling does not install, connect, or save')
    const save = find(render(), n => n.type === 'button' && n.children && n.children.includes('Save changes'))
    assert.equal(save.props.disabled, false)
    await save.props.onClick()
    assert.equal(calls.length, 1)
    assert.equal(calls[0].method, 'studio.config.save')
    assert.equal(calls[0].body.patch.qalens.enabled, true)
    assert.deepEqual(events, ['design-studio-config-changed'])
  } finally { globalThis.React = saved.React; globalThis.h = saved.h; globalThis.fetch = saved.fetch; globalThis.window = saved.window }
})

test('saving unrelated settings does not change a stale QaLens opt-in', async () => {
  const { SettingsView } = await import('../lib/client/src/settings.js?qalens-stale-form')
  const saved = { React: globalThis.React, h: globalThis.h, fetch: globalThis.fetch, window: globalThis.window }
  const form = { visionModels: ['test'], options: {}, capture: { width: 1440, height: 1700 }, reviewStyle: 'strict', qalens: { enabled: true } }
  const slots = [null, null, [], form, '', null, null, '', [], '', '', '', false, false, 'preferences']
  const calls = []
  function render() { let i = 0; globalThis.React = { useState(initial) { const n = i++; if (!(n in slots)) slots[n] = initial; return [slots[n], v => { slots[n] = typeof v === 'function' ? v(slots[n]) : v }] }, useEffect() {}, createElement(type, props, ...children) { return { type, props: props || {}, children } } }; globalThis.h = React.createElement; return SettingsView() }
  function flatten(n) { if (n == null || n === false) return ''; if (typeof n !== 'object') return String(n); if (Array.isArray(n)) return n.map(flatten).join(' '); return flatten(n.children || []) }
  function find(node, fn) { if (!node || typeof node !== 'object') return null; if (fn(node)) return node; for (const child of (node.children || []).flat(Infinity)) { const item = find(child, fn); if (item) return item } return null }
  globalThis.window = { dispatchEvent() {} }
  globalThis.fetch = async (url, opts) => { calls.push(JSON.parse(opts.body)); return { ok: true, json: async () => ({ ok: true, data: { ...slots[3], qalens: { enabled: false } } }) } }
  try {
    const label = find(render(), n => n.type === 'label' && flatten(n).includes('Review style'))
    find(label, n => n.type === 'select').props.onChange({ target: { value: 'balanced' } })
    const save = find(render(), n => n.type === 'button' && n.children && n.children.includes('Save changes'))
    await save.props.onClick()
    assert.equal('qalens' in calls[0].patch, false, 'an untouched stale opt-in must not be submitted')
    assert.equal(slots[3].qalens.enabled, false)
  } finally { globalThis.React = saved.React; globalThis.h = saved.h; globalThis.fetch = saved.fetch; globalThis.window = saved.window }
})
