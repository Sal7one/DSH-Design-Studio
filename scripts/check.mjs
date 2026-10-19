#!/usr/bin/env node
// Dependency-free release checks: manifest shape, packaged files, syntax, and
// the two invariants that broke past installs (private:true, bad client injects).
import { readFileSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const failures = []
const notes = []

function check(ok, message) {
  if (ok) notes.push('ok   ' + message)
  else failures.push(message)
}

function readJson(rel) {
  return JSON.parse(readFileSync(join(root, rel), 'utf8'))
}

const pkg = readJson('package.json')
const patch = readFileSync(join(root, 'cordis.patch.yml'), 'utf8')
const en = readJson('locale/en.json')
const zh = readJson('locale/zh.json')
const readme = readFileSync(join(root, 'README.md'), 'utf8')
const changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8')

check(typeof pkg.name === 'string' && pkg.name.startsWith('@'), 'package name is a scoped npm name')
check(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(String(pkg.version)), 'package version is semver')
check(readme.includes('**' + pkg.version + ' —'), 'README top note matches package version')
check(changelog.includes('## ' + pkg.version + ' —'), 'CHANGELOG has an entry for the package version')
check(pkg.private !== true, 'package is publishable (private is absent/false)')
check(pkg.type === 'module', 'package is an ES module')
check(pkg.main === 'lib/index.js', 'main points at lib/index.js')
check(pkg.license === 'MIT', 'license is declared')
check(typeof pkg.repository?.url === 'string' && pkg.repository.url.includes('DSH-Design-Studio'), 'repository URL is declared')
check(typeof pkg.engines?.node === 'string', 'engines.node is declared')
check(typeof pkg.engines?.dsh === 'string' && pkg.engines.dsh.includes('0.2.'), 'engines.dsh targets the current 0.2 harness line')

check(pkg.dsh?.manifestVersion === 1, 'dsh.manifestVersion is 1')
check(pkg.dsh?.bundle?.patch === './cordis.patch.yml', 'dsh.bundle.patch is the bundle patch')
check(pkg.dsh?.client?.platform === 'web', 'dsh.client.platform is web')
check(pkg.dsh?.client?.immediately === true, 'dsh.client.immediately is true (tab registers at boot)')
const inject = Array.isArray(pkg.dsh?.client?.inject) ? pkg.dsh.client.inject : []
check(inject.includes('@deepseek-ai/dsh-client-ui-conversation'), 'client injects the conversation slot owner')
check(inject.includes('@deepseek-ai/dsh-client-ui-settings'), 'client injects the settings slot owner')
check(!inject.includes('@deepseek-ai/dsh-client-runtime'), 'client no longer injects the removed dsh-client-runtime package')

check(pkg.exports?.['.'] === './lib/index.js', 'exports "." is the host entry')
check(pkg.exports?.['./client'] === './lib/client.js', 'exports "./client" is the client entry')
check(pkg.exports?.['./icon'] === './icon.svg', 'exports "./icon"')
check(pkg.exports?.['./locale/*.json'] === './locale/*.json', 'exports locale JSON')

const files = Array.isArray(pkg.files) ? pkg.files : []
for (const required of ['lib', 'cordis.patch.yml', 'README.md', 'LICENSE', 'locale/*.json', 'icon.svg']) {
  check(files.includes(required), 'files includes ' + required)
}

check(patch.includes('name: "@sal7one/dsh-design-studio"'), 'bundle patch names the package')
check(en.meta?.title === 'Design Studio' && typeof en.meta?.description === 'string', 'English display metadata is complete')
check(typeof zh.meta?.title === 'string' && zh.meta.title.length > 0, 'Chinese display metadata is present')

let iconBytes = 0
try { iconBytes = statSync(join(root, 'icon.svg')).size } catch {}
check(iconBytes > 0 && iconBytes <= 256 * 1024, 'icon.svg exists and is within 256 KiB')

const hostFiles = ['lib/index.js', 'lib/host/constants.js', 'lib/host/util.js', 'lib/host/node-io.js', 'lib/host/config.js', 'lib/host/vision.js', 'lib/host/preview.js', 'lib/host/presets.js', 'lib/host/assets.js', 'lib/host/history.js', 'lib/host/styles.js']
const host = hostFiles.map((file) => readFileSync(join(root, file), 'utf8')).join('\n')
const client = readFileSync(join(root, 'lib/client.js'), 'utf8')
const settingsSource = readFileSync(join(root, 'lib/client/src/settings.js'), 'utf8')
const clientSources = ['runtime.js', 'styles.js', 'labels.js', 'primitives.js', 'api.js', 'element-picker.js', 'scaled-preview.js', 'assets-modal.js', 'history.js', 'style-atlas.js', 'studio-view.js', 'settings.js', 'index.js']
for (const file of hostFiles) {
  check(statSync(join(root, file)).size > 0, 'host module exists: ' + file)
}
for (const file of clientSources) {
  check(statSync(join(root, 'lib/client/src', file)).size > 0, 'client source exists: ' + file)
}
const bareImports = [...host.matchAll(/^\s*import\s+[^'"]*['"]([^'"]+)['"]/gm)].map((m) => m[1])
check(bareImports.every((spec) => spec.startsWith('node:') || spec.startsWith('./')), 'host imports only Node builtins and local modules (zero runtime dependencies)')
check(!/\bsubagentsSvc\.start\s*\(/.test(host), 'host uses the current startActivation contract, not the removed start()')
check(!/\bexec\.agent\.sessionId\b/.test(host), 'host uses Agent.id, not the removed Agent.sessionId')
check(!/\bcurl -sS|\bscreencapture -x|\bbase64 -d|\bsh -c/.test(host), 'host has no shell/curl/base64/screencapture dependency')
check(/startActivation/.test(host), 'host uses the current startActivation contract')
check(/harnessVisionInfo/.test(host), 'host detects harness image-input capability')
check(/createAssets/.test(host) && /asset_upload/.test(host), 'host exposes an asset pipeline')
check(/createHistory/.test(host) && /snapshot_restore/.test(host), 'host exposes content-addressed snapshot history')
check(/studio\.history/.test(client), 'client exposes the edit history panel')
const atlas = JSON.parse(readFileSync(join(root, 'lib/data/style-atlas.json'), 'utf8'))
check(atlas.count === 88 && atlas.styles.length === 88, 'style atlas contains 88 attributed styles')
check(/createStyles/.test(host) && /style_atlas|style-atlas|studio\.styles/.test(client), 'host/client expose the style atlas')
check(/studio\.styles/.test(client), 'client talks to the style atlas APIs')
check(/capturePreviewToSystem/.test(host), 'host can capture the rendered preview')
check(/openPreviewInSystem|openExternal/.test(host), 'host can launch the OS browser explicitly')
check(/ScaledPreview/.test(client) && /'preview'/.test(client), 'client opens the Preview tab by default')
check(/ds-library-col/.test(client) && /ds-workspace-tabs/.test(client), 'client puts designs/assets in a library and tabs the workspace')
check(/stampRef/.test(client) && /setInterval/.test(client), 'client polls the design stamp for live preview refresh')
check(/studio\.assets/.test(client), 'client lists the asset library')
check(/visionTransport/.test(host) && /visionTransport/.test(client), 'vision transport is configurable in host and client')
check(/reviewStyle/.test(host) && /reviewStyle/.test(settingsSource), 'review style is configurable in host and settings')
check(/capture\.width|Viewport width/.test(settingsSource), 'capture viewport is configurable in settings')
check(/Harness vision/.test(settingsSource), 'settings surfaces harness vision status')
check(client.includes("id: '@sal7one/dsh-design-studio'"), 'client module id matches the package name')
check(!/\binject:\s*\(sessionId\)/.test(client), 'client no longer uses the obsolete slot inject face')
check(!/\bconv\.send\s*\(/.test(client), 'client uses Session.prompt, not the removed conversation.send')
check(client.startsWith('// GENERATED FILE'), 'lib/client.js is the generated bundle')
{
  const bundle = spawnSync(process.execPath, [join(root, 'scripts/bundle-client.mjs'), '--check'], { encoding: 'utf8' })
  check(bundle.status === 0, 'client bundle is up to date (run npm run build:client)' + (bundle.status === 0 ? '' : '\n' + (bundle.stderr || '')))
}

for (const file of hostFiles.concat(['lib/client.js', 'lib/client/src/history.js', 'lib/client/src/style-atlas.js', 'lib/client/src/settings.js', 'lib/client/src/studio-view.js', 'scripts/check.mjs'])) {
  const run = spawnSync(process.execPath, ['--check', join(root, file)], { encoding: 'utf8' })
  check(run.status === 0, 'syntax: ' + file + (run.status === 0 ? '' : '\n' + (run.stderr || '')))
}

if (failures.length) {
  console.error('check failed (' + failures.length + '):')
  for (const failure of failures) console.error('  - ' + failure)
  process.exit(1)
}
console.log('design-studio checks passed (' + notes.length + ')')
