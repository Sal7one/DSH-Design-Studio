// Fixed-viewport preview used inside the Studio's optional Preview tab.
// The iframe renders at a real desktop/tablet/mobile CSS width and is scaled
// to the available column, so the design never falls into its mobile layout
// just because the DSH panel is narrow.
const SIZES = {
  desktop: { label: 'Desktop', w: 1440, h: 1600 },
  tablet: { label: 'Tablet', w: 834, h: 1180 },
  mobile: { label: 'Mobile', w: 390, h: 844 },
}

function href(slug, tick) {
  return '/design-studio/' + encodeURIComponent(slug) + '/html/index.html?v=' + tick
}

export function ScaledPreview({ slug, tick, viewport, fit, onLoad, setFrameRef }) {
  const size = SIZES[viewport] || SIZES.desktop
  const [scale, setScale] = React.useState(1)
  const wrapRef = React.useRef ? React.useRef(null) : { current: null }

  React.useEffect(() => {
    function measure() {
      const el = wrapRef.current
      if (!el) return
      const availableW = Math.max(1, (el.clientWidth || 1) - 36)
      const availableH = fit ? Math.max(1, (el.clientHeight || 1) - 36) : Infinity
      setScale(fit ? Math.max(0.1, Math.min(1, availableW / size.w, availableH / size.h)) : 1)
    }
    measure()
    window.addEventListener('resize', measure)
    let observer = null
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure)
      if (wrapRef.current) observer.observe(wrapRef.current)
    }
    return () => {
      window.removeEventListener('resize', measure)
      if (observer) observer.disconnect()
    }
  }, [viewport, fit])

  const width = Math.round(size.w * scale)
  const height = Math.round(size.h * scale)

  return h(
    'div',
    { className: 'ds-preview-stage' + (fit ? ' is-fit' : ''), ref: wrapRef },
    h(
      'div',
      { className: 'ds-device-frame', style: { width: width + 'px', height: height + 'px' } },
      h('iframe', {
        className: 'ds-scaled-frame',
        key: slug + ':' + tick,
        ref: setFrameRef,
        src: href(slug, tick),
        title: slug + ' preview at ' + size.label,
        onLoad,
        style: {
          width: size.w + 'px',
          height: size.h + 'px',
          transform: 'scale(' + scale + ')',
          transformOrigin: 'top left',
        },
      }),
    ),
    h('span', { className: 'ds-scaled-badge' }, size.w + ' × ' + size.h + ' · ' + Math.round(scale * 100) + '%'),
  )
}

export const PREVIEW_SIZES = SIZES
