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
test('a matched app can be reviewed without a source checkout', () => {
  const view = sample()
  view.target.projectRoot = ''
  view.claim = { state: 'unavailable', reason: 'Configure the Android project root first.', candidates: [] }
  const pin = captureAndroidSelection(view, { ...target, projectRoot: '' }, 0)
  assert.ok(pin)
  assert.equal(pin.claim.state, 'unavailable')
  assert.equal(pin.projectRoot, '')
})
test('a scanned target cannot pin the same package from a different phone', () => {
  const view = sample()
  view.target.serial = 'phone-b'
  view.companion.connectedTarget = { serial: 'phone-a', package: target.package }
  assert.equal(captureAndroidSelection(view, { ...target, serial: 'phone-b' }), null)
  view.companion.connectedTarget.serial = 'phone-b'
  assert.ok(captureAndroidSelection(view, { ...target, serial: 'phone-b' }))
  view.target.serial = 'phone-c'
  assert.equal(captureAndroidSelection(view, { ...target, serial: 'phone-b' }), null)
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
