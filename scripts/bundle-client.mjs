#!/usr/bin/env node
// Zero-dependency bundler for the Design Studio client half. The browser
// artifact must be one self-contained ModuleLoader factory, so source modules
// under lib/client/src are concatenated in dependency order. Installs consume
// the committed lib/client.js and never run a build script.
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = join(root, 'lib', 'client', 'src')
const target = join(root, 'lib', 'client.js')

const ORDER = [
  'runtime.js',
  'styles.js',
  'labels.js',
  'primitives.js',
  'api.js',
  'element-picker.js',
  'scaled-preview.js',
  'assets-modal.js',
  'history.js',
  'studio-view.js',
  'settings.js',
  'index.js',
]

function stripModuleSyntax(source) {
  return source
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .filter((line) => !/^\s*import\s+/.test(line))
    .map((line) => line.replace(/^(\s*)export\s+/, '$1'))
    .join('\n')
    .trim()
}

const body = ORDER.map((file) => {
  const source = readFileSync(join(srcDir, file), 'utf8')
  return `// ---- ${file} ----\n${stripModuleSyntax(source)}`
}).join('\n\n')

const output = `// GENERATED FILE — do not edit by hand.
// Source: lib/client/src/*.js. Regenerate with: npm run build:client
window.__ModuleLoader__.load({
  id: '@sal7one/dsh-design-studio',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const React = require('react')
    const h = React.createElement

${body.split('\n').map((line) => (line ? '    ' + line : '')).join('\n')}

    exports.inject = inject
    exports.apply = apply
    return module.exports
  },
})
`

if (process.argv.includes('--check')) {
  let current = ''
  try {
    current = readFileSync(target, 'utf8')
  } catch {
    current = ''
  }
  if (current !== output) {
    console.error('lib/client.js is stale — run: npm run build:client')
    process.exit(1)
  }
  console.log('lib/client.js is up to date (' + output.length + ' bytes)')
} else {
  writeFileSync(target, output)
  console.log('wrote lib/client.js (' + output.length + ' bytes)')
}
