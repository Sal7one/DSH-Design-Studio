// Frame diffing for the App tab. Pure browser helpers: no deps, no canvas in
// the host. Frames are same-origin PNGs, so the client can read pixels.

export function framePixels(img, targetWidth = 180) {
  const nw = img && (img.naturalWidth || img.width || 0)
  const nh = img && (img.naturalHeight || img.height || 0)
  if (!nw || !nh) return null
  const scale = Math.min(1, targetWidth / nw)
  const w = Math.max(1, Math.round(nw * scale))
  const h = Math.max(1, Math.round(nh * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, w, h)
  return { data: ctx.getImageData(0, 0, w, h).data, w, h }
}

// Connected components of changed cells -> fractional boxes. Comparing at a
// coarse cell size keeps a 1.6s poll cheap and stops single antialiased pixels
// from becoming "regions".
export function changedRegions(prev, next, options) {
  const opts = options || {}
  if (!prev || !next) return { regions: [], changed: 0 }
  if (prev.w !== next.w || prev.h !== next.h) {
    return { regions: [{ x: 0, y: 0, w: 1, h: 1, cells: 0 }], changed: 1, resized: true }
  }
  const cell = opts.cell || 4
  const threshold = opts.threshold || 55
  const minCells = opts.minCells || 2
  const cols = Math.ceil(next.w / cell)
  const rows = Math.ceil(next.h / cell)
  const grid = new Uint16Array(cols * rows)
  let changedPixels = 0
  for (let y = 0; y < next.h; y += 1) {
    const row = Math.floor(y / cell) * cols
    for (let x = 0; x < next.w; x += 1) {
      const i = (y * next.w + x) * 4
      const d = Math.abs(next.data[i] - prev.data[i]) +
        Math.abs(next.data[i + 1] - prev.data[i + 1]) +
        Math.abs(next.data[i + 2] - prev.data[i + 2])
      if (d > threshold) {
        changedPixels += 1
        grid[row + Math.floor(x / cell)] += 1
      }
    }
  }
  const seen = new Uint8Array(grid.length)
  const regions = []
  const stack = []
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const start = r * cols + c
      if (seen[start] || grid[start] < 2) continue
      seen[start] = 1
      stack.length = 0
      stack.push(c, r)
      let minC = c
      let maxC = c
      let minR = r
      let maxR = r
      let count = 0
      while (stack.length) {
        const rr = stack.pop()
        const cc = stack.pop()
        count += 1
        if (cc < minC) minC = cc
        if (cc > maxC) maxC = cc
        if (rr < minR) minR = rr
        if (rr > maxR) maxR = rr
        for (let dr = -1; dr <= 1; dr += 1) {
          for (let dc = -1; dc <= 1; dc += 1) {
            const nc = cc + dc
            const nr = rr + dr
            if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue
            const ni = nr * cols + nc
            if (!seen[ni] && grid[ni] >= 2) {
              seen[ni] = 1
              stack.push(nc, nr)
            }
          }
        }
      }
      if (count < minCells) continue
      const x = (minC * cell) / next.w
      const y = (minR * cell) / next.h
      const w = ((maxC - minC + 1) * cell) / next.w
      const h = ((maxR - minR + 1) * cell) / next.h
      if (w * h < 0.0004) continue
      regions.push({ x, y, w, h, cells: count })
    }
  }
  regions.sort((a, b) => b.w * b.h - a.w * a.h)
  return { regions: regions.slice(0, 16), changed: changedPixels / (next.w * next.h) }
}

function rectOf(node) {
  if (!node || typeof node !== 'object') return null
  const n = (v) => typeof v === 'number' && Number.isFinite(v)
  const b = node.bounds || node.rect || node.frame || node.boundingBox || node.layoutBounds
  if (b && typeof b === 'object') {
    if (n(b.x) && n(b.y) && n(b.width) && n(b.height)) return { x: b.x, y: b.y, w: b.width, h: b.height }
    if (n(b.x) && n(b.y) && n(b.w) && n(b.h)) return { x: b.x, y: b.y, w: b.w, h: b.h }
    if (n(b.left) && n(b.top) && n(b.right) && n(b.bottom)) return { x: b.left, y: b.top, w: b.right - b.left, h: b.bottom - b.top }
    if (n(b.left) && n(b.top) && n(b.width) && n(b.height)) return { x: b.left, y: b.top, w: b.width, h: b.height }
  }
  if (n(node.x) && n(node.y) && n(node.width) && n(node.height)) return { x: node.x, y: node.y, w: node.width, h: node.height }
  return null
}

function labelOf(node) {
  const text = node.text || node.name || node.label || node.role || node.id || node.className || node.class || ''
  return String(text).replace(/\s+/g, ' ').trim().slice(0, 64)
}

// Best-effort semantic-tree normaliser. Compose Hot Reload's exact node schema
// is not guaranteed; any node that carries a rectangle is used, children are
// walked through the common container keys, and boxes are expressed as
// fractions of the tree's own root extent.
export function flattenTree(root, image) {
  if (!root || typeof root !== 'object') return { nodes: [], root: null, count: 0 }
  const rootRect = rectOf(root)
  const raw = []
  function walk(node, depth) {
    if (!node || typeof node !== 'object' || depth > 14) return
    if (Array.isArray(node)) {
      node.forEach((child) => walk(child, depth))
      return
    }
    const rect = rectOf(node)
    if (rect && rect.w > 0 && rect.h > 0) raw.push({ label: labelOf(node), rect, depth })
    for (const key of ['children', 'nodes', 'items', 'content', 'elements']) {
      if (Array.isArray(node[key])) walk(node[key], depth + 1)
    }
  }
  walk(root, 0)
  if (!raw.length) return { nodes: [], root: null, count: 0 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const item of raw) {
    minX = Math.min(minX, item.rect.x)
    minY = Math.min(minY, item.rect.y)
    maxX = Math.max(maxX, item.rect.x + item.rect.w)
    maxY = Math.max(maxY, item.rect.y + item.rect.h)
  }
  const origin = rootRect || { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) }
  // Native captures include window chrome above the Compose root; when the
  // caller supplies the image size, offset and normalise into image space so
  // labels line up with the diff boxes.
  const imageW = image && image.w ? Number(image.w) : 0
  const imageH = image && image.h ? Number(image.h) : 0
  const offsetX = imageW > 0 ? Math.max(0, (imageW - origin.w) / 2) : 0
  const offsetY = imageH > 0 ? Math.max(0, imageH - origin.h) : 0
  const width = imageW > 0 ? imageW : origin.w
  const height = imageH > 0 ? imageH : origin.h
  const nodes = raw.map((item) => ({
    label: item.label,
    depth: item.depth,
    rect: {
      x: (item.rect.x - origin.x + offsetX) / width,
      y: (item.rect.y - origin.y + offsetY) / height,
      w: item.rect.w / width,
      h: item.rect.h / height,
    },
  }))
  return { nodes, root: origin, count: nodes.length }
}

export function labelForRegion(region, nodes) {
  if (!nodes || !nodes.length) return ''
  const cx = region.x + region.w / 2
  const cy = region.y + region.h / 2
  let best = null
  let bestArea = Infinity
  let bestCoverage = 0
  const regionArea = Math.max(1e-6, region.w * region.h)
  for (const node of nodes) {
    if (!node.label) continue
    const r = node.rect
    const ix = Math.max(0, Math.min(region.x + region.w, r.x + r.w) - Math.max(region.x, r.x))
    const iy = Math.max(0, Math.min(region.y + region.h, r.y + r.h) - Math.max(region.y, r.y))
    const coverage = (ix * iy) / regionArea
    const contains = cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h
    if (!contains && coverage < 0.15) continue
    const area = r.w * r.h
    if (coverable(area, coverage, bestArea, bestCoverage)) {
      bestArea = area
      bestCoverage = coverage
      best = node
    }
  }
  return best && best.label ? best.label : ''
}

function coverable(area, coverage, bestArea, bestCoverage) {
  if (coverage > bestCoverage + 0.2) return true
  if (Math.abs(coverage - bestCoverage) <= 0.2 && area < bestArea) return true
  return false
}
