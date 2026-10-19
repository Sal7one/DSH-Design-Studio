# Third-party notices

## dsh-ui-ux-pro-max (style atlas data)

The style catalog in `lib/data/style-atlas.json` is an adapted, attributed
snapshot of design-style metadata and theme tokens from:

- **Project:** dsh-ui-ux-pro-max
- **Owner:** dsh-ui-ux-pro-max contributors
- **Repository:** https://github.com/ChenYiming-aaa/dsh-ui-ux-pro-max
- **License:** MIT
- **Upstream data:** https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
  (MIT; data lineage `56ea9cf`, 2026-10-15)
- **Upstream copyright:** Copyright (c) 2024 Next Level Builder

The Design Studio plugin is independent: it does not vendor the
dsh-ui-ux-pro-max repository, depend on its package, or require it at install
or runtime. A one-off importer (`scripts/import-style-atlas.mjs`) reads a local
research checkout and commits the normalized JSON; the running plugin only
reads that committed JSON.

Changes made for this integration: style records were normalized into one
schema, theme tokens mapped to Design Studio CSS variables, and only the
fields needed by the gallery/apply flow were retained. Attribution is shown in
the Style Atlas UI and in this file.

### MIT License

Copyright (c) 2026 dsh-ui-ux-pro-max contributors
Copyright (c) 2024 Next Level Builder

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
