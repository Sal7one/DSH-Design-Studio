// ---------- element picker (runs against the same-origin preview iframe) ----------
export function cssPathOf(el) {
  const path = []
  let cur = el
  while (cur && cur.nodeType === 1 && cur.tagName && cur.tagName.toLowerCase() !== 'html') {
    let seg = cur.tagName.toLowerCase()
    if (cur.id) {
      seg += '#' + cur.id
      path.unshift(seg)
      break
    }
    let nth = 1
    let sib = cur.previousElementSibling
    while (sib) {
      if (sib.tagName === cur.tagName) nth++
      sib = sib.previousElementSibling
    }
    seg += ':nth-of-type(' + nth + ')'
    path.unshift(seg)
    cur = cur.parentElement
  }
  return path.join(' > ')
}

export function describeSelection(doc, el) {
  const win = doc.defaultView
  const cs = win.getComputedStyle(el)
  const styleKeys = ['background-color', 'color', 'border-radius', 'padding', 'margin', 'font-size', 'font-weight', 'display', 'position', 'width', 'height', 'gap', 'flex-direction', 'align-items', 'justify-content', 'border', 'box-shadow']
  const styles = {}
  for (const k of styleKeys) styles[k] = cs.getPropertyValue(k)
  const rect = el.getBoundingClientRect()
  const hierarchy = []
  let cur = el
  while (cur && cur.nodeType === 1 && hierarchy.length < 10) {
    const ccs = win.getComputedStyle(cur)
    hierarchy.unshift({
      tag: cur.tagName.toLowerCase(),
      id: cur.id || null,
      classes: cur.className && typeof cur.className === 'string' ? String(cur.className).split(/\s+/).filter(Boolean).slice(0, 8) : [],
      cssPath: cssPathOf(cur),
      styles: {
        background: ccs.getPropertyValue('background-color'),
        padding: ccs.getPropertyValue('padding'),
        'border-radius': ccs.getPropertyValue('border-radius'),
        'font-size': ccs.getPropertyValue('font-size'),
        display: ccs.getPropertyValue('display'),
        gap: ccs.getPropertyValue('gap'),
      },
    })
    cur = cur.parentElement
  }
  return {
    tag: el.tagName.toLowerCase(),
    id: el.id || null,
    classes: el.className && typeof el.className === 'string' ? String(el.className).split(/\s+/).filter(Boolean).slice(0, 8) : [],
    cssPath: cssPathOf(el),
    classPath: el.className && typeof el.className === 'string' ? String(el.className).trim().split(/\s+/).filter(Boolean).join('.') : '',
    text: String(el.textContent || '').trim().slice(0, 60),
    snippet: String(el.outerHTML || '').slice(0, 600),
    rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
    styles: styles,
    hierarchy: hierarchy,
  }
}

export function injectSelector(frameEl, onSelect, onExit) {
  if (!frameEl) return false
  const doc = frameEl.contentDocument
  if (!doc || !doc.body || doc.__dsSelActive) return false
  doc.__dsSelActive = true
  const style = doc.createElement('style')
  style.id = 'ds-sel-style'
  style.textContent = [
    '.ds-sel-hover{outline:2px dashed #4d8eff !important;outline-offset:-2px;cursor:crosshair !important}',
    '.ds-sel-selected{outline:2px solid #ffb95f !important;outline-offset:-2px;box-shadow:0 0 0 9999px rgba(6,14,32,.35) !important}',
    '.ds-sel-tag{position:fixed;z-index:2147483647;pointer-events:none;background:#0b1326;color:#adc6ff;border:1px solid #adc6ff;font:11px ui-monospace,monospace;padding:2px 8px;border-radius:4px;max-width:60vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
  ].join('\n')
  doc.head.appendChild(style)
  const tag = doc.createElement('div')
  tag.className = 'ds-sel-tag'
  tag.style.display = 'none'
  doc.body.appendChild(tag)
  let hoverEl = null
  const over = (e) => {
    if (hoverEl) hoverEl.classList.remove('ds-sel-hover')
    hoverEl = e.target
    if (hoverEl && hoverEl.nodeType === 1) {
      hoverEl.classList.add('ds-sel-hover')
      const cls = hoverEl.className && typeof hoverEl.className === 'string' && hoverEl.className.trim() ? '.' + String(hoverEl.className).trim().split(/\s+/).join('.') : ''
      tag.textContent = hoverEl.tagName.toLowerCase() + cls
      tag.style.display = 'block'
      tag.style.left = Math.min(e.clientX + 12, doc.documentElement.clientWidth - 220) + 'px'
      tag.style.top = (e.clientY + 14) + 'px'
    }
  }
  const click = (e) => {
    if (e.target === tag || !e.target || e.target.nodeType !== 1) return
    e.preventDefault()
    e.stopPropagation()
    const payload = describeSelection(doc, e.target)
    if (hoverEl) hoverEl.classList.remove('ds-sel-hover')
    e.target.classList.add('ds-sel-selected')
    onSelect(payload)
  }
  const key = (e) => {
    if (e.key === 'Escape') onExit()
  }
  doc.addEventListener('mouseover', over, true)
  doc.addEventListener('click', click, true)
  doc.addEventListener('keydown', key, true)
  doc.__dsSelCleanup = () => {
    doc.removeEventListener('mouseover', over, true)
    doc.removeEventListener('click', click, true)
    doc.removeEventListener('keydown', key, true)
    const s = doc.getElementById('ds-sel-style')
    if (s && s.parentNode) s.parentNode.removeChild(s)
    if (tag && tag.parentNode) tag.parentNode.removeChild(tag)
    if (hoverEl) hoverEl.classList.remove('ds-sel-hover')
    doc.__dsSelActive = false
  }
  return true
}
