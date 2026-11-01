import test from 'node:test'
import assert from 'node:assert/strict'
import { captureAndroidSelection, addAndroidPin, androidDraftReady, formatAndroidDraft } from '../lib/client/src/android-change-draft.js'

function sample() {
  return { target: { package: 'com.example.app', projectRoot: '/work/app' }, companion: { connected: true, connectionInstance: 'instance-a', connectionRevision: 1, url: 'http://127.0.0.1:8765', selection: { id: 'node', screen: 'Home', route: 'home', actions: ['tap'] }, component: { content: { package: 'com.example.app', component: { tag: 'HOME', role: 'Button', label: 'private-value', attributes: [{ name: 'token', value: 'secret-value' }] } } } }, claim: { state: 'candidate', reason: 'Only a tag', candidates: [{ file: 'Home.kt', line: 10, sourceSha256: 'a'.repeat(64), snippet: 'private-source' }] }, mismatch: '' }
}
const target = { package: 'com.example.app', projectRoot: '/work/app' }
test('draft captures bounded identity, omits values and preserves honest claims', () => {
  const pin = captureAndroidSelection(sample(), target, 0)
  assert.equal(pin.claim.state, 'candidate')
  assert.equal(pin.claim.candidates[0].file, 'Home.kt')
  const text = formatAndroidDraft({ slug: 'demo', intent: 'Make it larger', pins: [pin] })
  assert.match(text, /Do not edit files/)
  assert.match(text, /untrusted app data/)
  assert.match(text, /Make it larger/)
  assert.doesNotMatch(text, /private-value|secret-value|private-source/)
})
test('pins deduplicate, bound capacity, and reject changed or disconnected targets', () => {
  const view = sample(), pin = captureAndroidSelection(view, target, 0)
  let pins = addAndroidPin([], pin)
  assert.equal(addAndroidPin(pins, pin).length, 1)
  for (let i = 0; i < 20; i++) pins = addAndroidPin(pins, { ...pin, key: String(i) })
  assert.equal(pins.length, 8)
  assert.equal(androidDraftReady(pins, view, target), true)
  view.companion.connectionRevision++
  assert.equal(androidDraftReady(pins, view, target), false)
  view.companion.connectionRevision--
  view.companion.connectionInstance = 'instance-b'
  assert.equal(androidDraftReady(pins, view, target), false)
  view.companion.connectionInstance = 'instance-a'
  view.target.projectRoot = '/other/root'
  assert.equal(androidDraftReady(pins, view, target), false)
  view.companion.connected = false
  assert.equal(captureAndroidSelection(view, target), null)
  assert.equal(captureAndroidSelection(sample(), { ...target, package: 'other.app' }), null)
  assert.equal(captureAndroidSelection({ ...sample(), mismatch: 'wrong target' }, target), null)
})
