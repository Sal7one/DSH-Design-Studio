#!/usr/bin/env node
// One-time importer for the attributed style atlas.
//
// Source research checkout (ignored, not shipped):
//   research/dsh-ui-ux-pro-max/
// Output committed into lib/data/style-atlas.json so the plugin remains
// completely independent of that checkout at runtime.
//
// The source project and its upstream data are MIT licensed; see
// THIRD_PARTY_NOTICES.md.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(process.argv[2] || join(root, 'research', 'dsh-ui-ux-pro-max'))
const meta = await import(pathToFileURL(join(source, 'tools', 'showcase', 'theme-data.mjs')).href)
const raw = JSON.parse(await readFile(join(source, 'data', 'index.json'), 'utf8'))

const styles = raw.domains.style.map((row, index) => {
  const id = row['Style ID']
  const t = meta.STYLE_META[id]
  if (!t || !t.theme) throw new Error('missing theme data for style: ' + id)
  return {
    id,
    no: Number(row.No) || index + 1,
    name: row['Style Category'],
    zh: t.zh,
    tag: t.tag,
    description: t.desc,
    category: row.Type,
    status: row.Status || 'active',
    complexity: row.Complexity,
    era: row['Era/Origin'],
    aliases: row.Aliases || '',
    keywords: String(row.Keywords || '').split(',').map((s) => s.trim()).filter(Boolean),
    primary: row['Primary Colors'],
    secondary: row['Secondary Colors'],
    light: row['Light Mode ✓'],
    dark: row['Dark Mode ✓'],
    performance: row.Performance,
    accessibility: row.Accessibility,
    mobile: row['Mobile-Friendly'],
    conversion: row['Conversion-Focused'],
    framework: row['Framework Compatibility'],
    bestFor: row['Best For'],
    avoid: row['Do Not Use For'],
    prompt: row['AI Prompt Keywords'],
    checklist: row['Implementation Checklist'],
    theme: t.theme,
  }
}).sort((a, b) => a.no - b.no)

const output = {
  version: 1,
  generatedAt: new Date().toISOString(),
  count: styles.length,
  attribution: {
    project: 'dsh-ui-ux-pro-max',
    owner: 'ChenYiming-aaa',
    repository: 'https://github.com/ChenYiming-aaa/dsh-ui-ux-pro-max',
    upstream: 'https://github.com/nextlevelbuilder/ui-ux-pro-max-skill',
    license: 'MIT',
    note: 'Style names, descriptions and theme tokens adapted from dsh-ui-ux-pro-max (MIT). The Design Studio plugin is independent and does not require or vendor that project.',
  },
  styles,
}

await mkdir(join(root, 'lib', 'data'), { recursive: true })
await writeFile(join(root, 'lib', 'data', 'style-atlas.json'), JSON.stringify(output, null, 2) + '\n', 'utf8')
console.log('wrote lib/data/style-atlas.json (' + styles.length + ' styles, ' + (JSON.stringify(output).length / 1024).toFixed(1) + ' KB)')
