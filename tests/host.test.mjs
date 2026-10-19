import test from 'node:test'
import assert from 'node:assert/strict'
import { apply, inject as injectedServices, name } from '../lib/index.js'

// A tiny virtual filesystem with the exact `fs` contract the plugin uses.
function makeFs() {
  const files = new Map()
  let rev = 0
  const base = '/work'
  const normalize = (p) => {
    const abs = p.startsWith('/') ? p : base + '/' + p
    const parts = []
    for (const seg of abs.split('/')) {
      if (!seg || seg === '.') continue
      if (seg === '..') parts.pop()
      else parts.push(seg)
    }
    return '/' + parts.join('/')
  }
  const absOf = (p, cwd) => normalize(p.startsWith('/') ? p : (cwd || base) + '/' + p)
  const target = (path) => ({ targetKey: path, displayPath: path })
  const isDir = (path) => [...files.keys()].some((p) => p.startsWith(path + '/'))
  return {
    files,
    async resolve(path, opts) { return target(absOf(path, opts && opts.cwd)) },
    processPath(t) { return t.targetKey },
    contains(parent, child) {
      return child.targetKey === parent.targetKey || child.targetKey.startsWith(parent.targetKey + '/')
    },
    async stat(t) {
      const f = files.get(t.targetKey)
      if (f) return { type: 'file', version: 'v' + f.rev, size: f.content.length }
      if (isDir(t.targetKey)) return { type: 'directory', version: 'v0' }
      return undefined
    },
    async listDir(t) {
      const prefix = t.targetKey.replace(/\/+$/, '') + '/'
      const entries = new Map()
      for (const [p, f] of files) {
        if (!p.startsWith(prefix)) continue
        const rest = p.slice(prefix.length)
        if (!rest) continue
        const first = rest.split('/')[0]
        if (rest.includes('/')) {
          if (!entries.has(first)) entries.set(first, { name: first, type: 'directory', target: target(prefix + first), version: 'v0' })
        } else {
          entries.set(first, { name: first, type: 'file', target: target(p), version: 'v' + f.rev, size: f.content.length })
        }
      }
      return [...entries.values()].sort((a, b) => (a.name < b.name ? -1 : 1))
    },
    async readText(t) {
      const f = files.get(t.targetKey)
      if (!f) throw new Error('ENOENT ' + t.targetKey)
      return f.content
    },
    async readBytes(t, _signal, maxBytes) {
      const f = files.get(t.targetKey)
      if (!f) throw new Error('ENOENT ' + t.targetKey)
      const bytes = Buffer.from(f.content, 'utf8')
      if (bytes.length > maxBytes) throw new Error('too large')
      return new Uint8Array(bytes)
    },
    async writeText(t, content) {
      const existed = files.has(t.targetKey)
      const f = { content, rev: ++rev }
      files.set(t.targetKey, f)
      return { operation: existed ? 'update' : 'create', version: 'v' + f.rev, before: null, after: content }
    },
  }
}

function makeSubprocess() {
  const calls = []
  return {
    calls,
    async resolveExecutable(command) { return '/usr/bin/' + command },
    spawn(spec) {
      calls.push(spec)
      return {
        done: Promise.resolve({ exitCode: 0, signal: null }),
        collected: {
          stdout: { readFrom: () => ({ text: '', lossy: false }) },
          stderr: { readFrom: () => ({ text: '', lossy: false }) },
        },
        terminate() {},
      }
    },
  }
}

function makeHarness() {
  const fs = makeFs()
  const subprocess = makeSubprocess()
  const routes = []
  const sections = []
  const registeredTools = new Map()
  const activations = []
  const parent = { id: 'session-1', session: { header: { cwd: '/work/project' } } }
  const streamed = []

  const services = {
    fs,
    subprocess,
    attachments: {
      async saveImage(input) {
        return { attachmentId: 'att-1', mediaType: input.mediaType, bytes: input.data.length, width: 1, height: 1 }
      },
    },
    agentDefaultModel: {
      currentSelection: () => ({ provider: 'deepseek-account', model: 'deepseek-flash' }),
    },
    webServer: {
      getOrigin: () => 'http://127.0.0.1:4567',
      register(route) { routes.push(route); return () => {} },
    },
    systemPrompt: {
      section(section) { sections.push(section); return () => {} },
    },
    tools: {
      get(toolName) { return registeredTools.get(toolName) },
      register(definition) { registeredTools.set(definition.name, definition); return () => registeredTools.delete(definition.name) },
    },
    llm: {
      listProviders: () => [{ id: 'deepseek-account' }],
      async resolveModelInfo() { return { inputModalities: ['text', 'image'] } },
      stream(options) {
        streamed.push(options)
        return (async function* () {
          yield { type: 'text-delta', text: 'VERDICT: GOOD — warm sand, clear hierarchy.' }
          yield { type: 'finish', reason: { kind: 'stop' } }
        })()
      },
    },
    credentials: {
      describe: async () => ({ configured: false, writable: true }),
      resolve: async () => undefined,
      set: async () => {},
      unset: async () => {},
    },
    agents: {
      currentInitiator: () => parent,
      get: (id) => (id === parent.id ? parent : undefined),
      list: () => [parent],
      roots: () => [parent],
    },
    subagents: {
      list: () => ['spawn'],
      async startActivation(spec) {
        activations.push(spec)
        return {
          childId: 'child-1',
          result: Promise.resolve({ output: [{ type: 'text', text: 'done' }], stopReason: 'completed' }),
          dispose: async () => {},
        }
      },
    },
  }

  const listeners = new Map()
  const disposers = []
  const ctx = {
    ...services,
    get(serviceName) { return services[serviceName] },
    effect(callback) {
      const disposer = callback()
      if (typeof disposer === 'function') disposers.push(disposer)
      return disposer
    },
    on(eventName, listener) {
      listeners.set(eventName, listener)
      return () => listeners.delete(eventName)
    },
    logger: { warn() {} },
  }
  return { ctx, services, routes, sections, registeredTools, activations, parent, listeners, disposers, streamed }
}

test('host half registers current contracts and exercises the studio flow', async () => {
  const harness = makeHarness()
  apply(harness.ctx)

  assert.equal(name, 'dsh-design-studio')
  assert.ok(injectedServices.includes('fs'))
  assert.ok(injectedServices.includes('tools'))
  assert.ok(injectedServices.includes('attachments'), 'the attachment seam is injected for harness vision')

  assert.equal(harness.sections.length, 1)
  assert.equal(harness.sections[0].name, 'design-studio-routing')
  assert.match(harness.sections[0].text, /http:\/\/127\.0\.0\.1:4567\/design-studio\/<slug>\/html\/index\.html/)
  assert.match(harness.sections[0].text, /DESIGN PHASE IS THE DEFAULT/)
  assert.match(harness.sections[0].text, /LGTM/)
  assert.match(harness.sections[0].text, /defaults to this\s+conversation's project/)
  assert.match(harness.sections[0].text, /never ask the operator for a path/)
  assert.match(harness.sections[0].text, /freeze and implement/)
  assert.match(harness.sections[0].text, /ask_user_question/)
  assert.match(harness.sections[0].text, /Design ready/)
  assert.match(harness.sections[0].text, /Keep refining/)
  assert.match(harness.sections[0].text, /Freeze & implement/)
  assert.match(harness.sections[0].text, /Ask this gate once per completed revision/)
  assert.match(harness.sections[0].text, /call ask_user_question\s+again/)
  assert.match(harness.sections[0].text, /do not substitute a plain-chat question/)
  assert.match(harness.sections[0].text, /Skip the gate when the operator already approved/)

  const route = harness.routes.find((r) => r.path === '/design-studio')
  assert.ok(route, '/design-studio route registered')
  assert.equal(route.kind, 'prefix')

  const tool = harness.registeredTools.get('design_studio')
  assert.ok(tool, 'design_studio tool registered')
  assert.equal(Array.isArray(tool.output.schema.oneOf), true, 'output accepts a string or an attached image')
  assert.equal(typeof tool.output.render, 'function')
  assert.equal(typeof tool.execute, 'function')

  const exec = { agent: { id: 'session-1' } }
  assert.deepEqual(JSON.parse(await tool.execute({ action: 'list' }, exec)), [])

  const created = await tool.execute({ action: 'create', slug: 'demo' }, exec)
  assert.match(created, /created design system demo/)
  assert.match(created, /bound to this conversation \(session-1\)/)
  assert.ok(harness.services.fs.files.has('/work/project/design-studio/demo/html/index.html'))
  assert.ok(harness.services.fs.files.has('/work/project/design-studio/demo/design_prompts_forcoders.md'))

  const firstList = JSON.parse(await tool.execute({ action: 'list' }, exec))
  assert.equal(firstList.length, 1)
  assert.equal(firstList[0].slug, 'demo')
  assert.equal(firstList[0].root, '/work/project/design-studio')
  assert.equal(firstList[0].sessionId, 'session-1')
  const firstStamp = firstList[0].stamp.hash
  assert.match(firstStamp, /^[0-9a-f-]{36}$/)

  const opened = await tool.execute({ action: 'open', slug: 'demo' }, exec)
  assert.match(opened, /opened in the system browser: http:\/\/127\.0\.0\.1:4567\/design-studio\/demo\/html\/index\.html\?open=/)

  await tool.execute({ action: 'write', slug: 'demo', path: 'css/style.css', content: '.topbar { color: red; }\n' }, exec)
  const secondList = JSON.parse(await tool.execute({ action: 'list' }, exec))
  assert.notEqual(secondList[0].stamp.hash, firstStamp, 'a write bumps the freshness stamp')

  const snapHistory = JSON.parse(await tool.execute({ action: 'history', slug: 'demo' }, exec))
  assert.ok(snapHistory.count >= 1, 'creation seeds a baseline snapshot')
  assert.equal(snapHistory.snapshots[0].reason, 'initial')
  const snap = await tool.execute({ action: 'snapshot_save', slug: 'demo', reason: 'test checkpoint' }, exec)
  assert.match(snap, /snapshot (saved|unchanged)/)
  const snapHistory2 = JSON.parse(await tool.execute({ action: 'history', slug: 'demo' }, exec))
  assert.ok(snapHistory2.count >= snapHistory.count)
  assert.equal(snapHistory2.snapshots[snapHistory2.snapshots.length - 1].current, true)

  const styleList = JSON.parse(await tool.execute({ action: 'style_list' }, exec))
  assert.equal(styleList.count, 88)
  assert.equal(styleList.styles[0].id, 'minimalism-and-swiss-style')
  const styleApplied = await tool.execute({ action: 'style_apply', slug: 'demo', styleId: 'minimalism-and-swiss-style' }, exec)
  assert.match(styleApplied, /applied style minimalism-and-swiss-style/)

  const agentResult = await tool.execute({ action: 'agent', slug: 'demo', message: 'Make it blue' }, exec)
  assert.match(agentResult, /design agent \(harness-spawn-agent\): done/)

  assert.equal(harness.activations.length, 1)
  const activation = harness.activations[0]
  assert.equal(activation.provider, 'spawn')
  assert.equal(activation.delivery, 'caller')
  assert.equal(activation.label, 'design-agent:demo')
  assert.equal(activation.request.parent, harness.parent)
  assert.equal(activation.request.cwd, '/work/project/design-studio/demo')
  assert.equal(activation.request.maxDepth, 1, 'the child is depth 1; 1 allows it and blocks grandchildren')
  assert.ok(activation.request.signal instanceof AbortSignal)
  assert.equal(activation.request.prompt.length, 1)
  assert.match(activation.request.prompt[0].text, /You are the Design Studio design agent for design system "demo"/)
  assert.match(activation.request.prompt[0].text, /Make it blue/)
  assert.ok(!('persona' in activation.request), 'persona travels in the prompt, not a removed request field')

  // With a vision-capable harness model, selected images are attached to the
  // child prompt instead of being described by OpenRouter first.
  harness.services.fs.files.set('/work/project/design-studio/demo/assets/images/palette.png', { content: 'fake-png-bytes', rev: 500 })
  const imageAgentResult = await tool.execute(
    { action: 'agent', slug: 'demo', message: 'Use palette.png as the palette', images: ['assets/images/palette.png'] },
    exec,
  )
  assert.match(imageAgentResult, /design agent \(harness-spawn-agent\): done/)
  assert.equal(harness.activations.length, 2)
  const imageActivation = harness.activations[1]
  assert.equal(imageActivation.request.prompt.length, 2)
  assert.equal(imageActivation.request.prompt[0].type, 'text')
  assert.equal(imageActivation.request.prompt[1].type, 'image')
  assert.equal(imageActivation.request.prompt[1].attachment.attachmentId, 'att-1')

  const history = JSON.parse(await tool.execute({ action: 'agent_history', slug: 'demo' }, exec))
  assert.ok(history.some((entry) => entry.role === 'operator' && entry.text === 'Make it blue'))
  assert.ok(history.some((entry) => entry.role === 'design-agent' && entry.text === 'done'))

  const zipResult = await tool.execute({ action: 'zip', slug: 'demo' }, exec)
  assert.match(zipResult, /_zips\/demo\.zip/)

  const presets = JSON.parse(await tool.execute({ action: 'presets' }, exec))
  assert.deepEqual(presets, [])

  const presetSave = await tool.execute(
    { action: 'preset_save', preset: { id: 'warm', name: 'Warm sand', colors: { bg: '#efe1c8', text: '#2e2419' }, radius: '12px' } },
    exec,
  )
  assert.match(presetSave, /preset warm saved/)
  const afterPreset = JSON.parse(await tool.execute({ action: 'presets' }, exec))
  assert.equal(afterPreset.length, 1)
  assert.equal(afterPreset[0].id, 'warm')
  const applied = await tool.execute({ action: 'preset_apply', slug: 'demo', presetId: 'warm' }, exec)
  assert.match(applied, /applied preset warm to demo/)
  const appliedCss = await tool.execute({ action: 'read', slug: 'demo', path: 'css/token.css' }, exec)
  assert.match(appliedCss, /--bg: #efe1c8/)

  // A fresh profile has no _presets/ directory; listing must return [] instead
  // of failing the whole Settings page.
  const realListDir = harness.services.fs.listDir
  harness.services.fs.listDir = async (target) => {
    if (target.targetKey.endsWith('/_presets')) throw new Error('ENOENT')
    return realListDir(target)
  }
  assert.deepEqual(JSON.parse(await tool.execute({ action: 'presets' }, exec)), [])
  harness.services.fs.listDir = realListDir

  const config = JSON.parse(await tool.execute({ action: 'config' }, exec))
  assert.equal('codingModel' in config.config, false, 'the dead codingModel setting is gone')
  assert.equal(config.config.visionTransport, 'auto')
  assert.equal(config.harnessOpenRouterRoute, false)
  assert.equal(config.harnessVision.available, true, 'the current model advertises image input')
  assert.deepEqual([...config.harnessVision.modalities], ['text', 'image'])

  const onePixelPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
  const review = await tool.execute({ action: 'review', slug: 'demo', image: onePixelPng }, exec)
  assert.match(review, /VERDICT: GOOD/)
  assert.match(review, /transport: harness/)
  assert.equal(harness.streamed.length, 1)
  assert.equal(harness.streamed[0].provider, 'deepseek-account')
  assert.equal(harness.streamed[0].model, 'deepseek-flash')
  assert.equal(harness.streamed[0].messages[0].content[0].type, 'text')
  assert.equal(harness.streamed[0].messages[0].content[1].type, 'image')

  // Design freeze: read-only handoff, guard all mutating tool paths, and thaw.
  const froze = await tool.execute({ action: 'freeze', slug: 'demo', implementation: '/work/impl', note: 'handoff' }, exec)
  assert.match(froze, /design frozen: demo/)
  const frozenList = JSON.parse(await tool.execute({ action: 'list' }, exec))
  assert.equal(frozenList[0].frozen, true)
  assert.equal(frozenList[0].freeze.implementation, '/work/impl')
  assert.match(frozenList[0].freeze.finalSnapshot, /^[0-9a-f-]{36}$/)
  await assert.rejects(
    () => tool.execute({ action: 'write', slug: 'demo', path: 'css/style.css', content: 'x' }, exec),
    /DESIGN FROZEN/,
  )
  await assert.rejects(
    () => tool.execute({ action: 'style_apply', slug: 'demo', styleId: 'minimalism-and-swiss-style' }, exec),
    /DESIGN FROZEN/,
  )
  await assert.rejects(
    () => tool.execute({ action: 'agent', slug: 'demo', message: 'edit it' }, exec),
    /DESIGN FROZEN/,
  )
  await assert.rejects(
    () => tool.execute({ action: 'delete', slug: 'demo' }, exec),
    /DESIGN FROZEN/,
  )
  await assert.rejects(
    () => tool.execute({ action: 'asset_delete', slug: 'demo', path: 'assets/images/x.png' }, exec),
    /DESIGN FROZEN/,
  )
  await assert.rejects(
    () => tool.execute({ action: 'history_undo', slug: 'demo' }, exec),
    /DESIGN FROZEN/,
  )
  await assert.rejects(
    () => tool.execute({ action: 'preset_apply', slug: 'demo', presetId: 'warm' }, exec),
    /DESIGN FROZEN/,
  )
  assert.match(await tool.execute({ action: 'read', slug: 'demo', path: 'css/token.css' }, exec), /:root/)
  assert.match(await tool.execute({ action: 'zip', slug: 'demo' }, exec), /_zips\/demo\.zip/)
  assert.match(await tool.execute({ action: 'freeze', slug: 'demo' }, exec), /already frozen/)
  assert.match(await tool.execute({ action: 'unfreeze', slug: 'demo' }, exec), /design thawed: demo/)
  const thawedList = JSON.parse(await tool.execute({ action: 'list' }, exec))
  assert.equal(thawedList[0].frozen, false)
  await tool.execute({ action: 'write', slug: 'demo', path: 'css/style.css', content: '.topbar { color: blue; }\n' }, exec)
  assert.match(await tool.execute({ action: 'unfreeze', slug: 'demo' }, exec), /already thawed/)
  assert.match(await tool.execute({ action: 'freeze', slug: 'demo' }, exec), /design frozen: demo/)
  const noTargetList = JSON.parse(await tool.execute({ action: 'list' }, exec))
  assert.equal(noTargetList[0].frozen, true)
  assert.equal(noTargetList[0].freeze.implementation, '/work/project')
  assert.match(await tool.execute({ action: 'unfreeze', slug: 'demo' }, exec), /design thawed: demo/)

  await assert.rejects(() => tool.execute({ action: 'read', slug: 'demo', path: '../escape' }, exec), /invalid path/)
})

test('route serves the API and the live preview', async () => {
  const harness = makeHarness()
  apply(harness.ctx)
  const route = harness.routes.find((r) => r.path === '/design-studio')

  function fakeRes() {
    return {
      statusCode: 0,
      headers: {},
      body: '',
      setHeader(key, value) { this.headers[key] = value },
      end(body) { this.body = body === undefined ? '' : String(body) },
    }
  }
  function fakeReq(method, url, body) {
    return {
      method,
      url,
      on(event, callback) {
        if (event === 'data' && body !== undefined) callback(Buffer.from(JSON.stringify(body)))
        if (event === 'end') callback()
      },
    }
  }

  const apiRes = fakeRes()
  await route.handler(fakeReq('POST', '/design-studio/__api/studio.ping'), apiRes)
  assert.equal(apiRes.statusCode, 200)
  const apiBody = JSON.parse(apiRes.body)
  assert.equal(apiBody.ok, true)
  assert.equal(apiBody.data.studio, 'temp_design_folder')

  const tool = harness.registeredTools.get('design_studio')
  await tool.execute({ action: 'create', slug: 'preview' }, { agent: { id: 'session-1' } })

  const pageRes = fakeRes()
  await route.handler(fakeReq('GET', '/design-studio/preview/html/index.html'), pageRes)
  assert.equal(pageRes.statusCode, 200)
  assert.match(pageRes.headers['content-type'], /text\/html/)
  assert.match(pageRes.body, /<!doctype html>/)

  const missingRes = fakeRes()
  await route.handler(fakeReq('GET', '/design-studio/preview/html/nope.html'), missingRes)
  assert.equal(missingRes.statusCode, 404)

  const freezeRes = fakeRes()
  await route.handler(fakeReq('POST', '/design-studio/__api/studio.freeze', { slug: 'preview', implementation: '/work/impl' }), freezeRes)
  assert.equal(freezeRes.statusCode, 200)
  const freezeBody = JSON.parse(freezeRes.body)
  assert.equal(freezeBody.ok, true)
  assert.equal(freezeBody.data.frozen, true)

  const projectRes = fakeRes()
  await route.handler(fakeReq('POST', '/design-studio/__api/studio.project', {}), projectRes)
  assert.equal(projectRes.statusCode, 200)
  const projectBody = JSON.parse(projectRes.body)
  assert.equal(projectBody.ok, true)
  assert.equal(projectBody.data.defaultPath, process.cwd())
  assert.ok(Array.isArray(projectBody.data.options))
  assert.equal(projectBody.data.options[0].label, 'This project')

  const sessionProjectRes = fakeRes()
  await route.handler(fakeReq('POST', '/design-studio/__api/studio.project', { sessionId: 'session-1' }), sessionProjectRes)
  assert.equal(JSON.parse(sessionProjectRes.body).data.defaultPath, '/work/project')

  const frozenWriteRes = fakeRes()
  await route.handler(fakeReq('POST', '/design-studio/__api/studio.history.undo', { slug: 'preview' }), frozenWriteRes)
  assert.equal(frozenWriteRes.statusCode, 200)
  assert.equal(JSON.parse(frozenWriteRes.body).ok, false)
  assert.match(frozenWriteRes.body, /DESIGN FROZEN/)

  const noConfirmRes = fakeRes()
  await route.handler(fakeReq('POST', '/design-studio/__api/studio.unfreeze', { slug: 'preview' }), noConfirmRes)
  assert.equal(noConfirmRes.statusCode, 200)
  assert.equal(JSON.parse(noConfirmRes.body).ok, false)
  assert.match(noConfirmRes.body, /confirm:true/)

  const thawRes = fakeRes()
  await route.handler(fakeReq('POST', '/design-studio/__api/studio.unfreeze', { slug: 'preview', confirm: true }), thawRes)
  assert.equal(thawRes.statusCode, 200)
  assert.equal(JSON.parse(thawRes.body).data.frozen, false)
})
