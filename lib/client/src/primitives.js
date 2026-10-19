export function Err(props) {
  return props.text ? h('div', { className: 'ds-err' }, String(props.text)) : null
}

export function Log(props) {
  return props.text ? h('div', { className: 'ds-log' }, String(props.text)) : null
}

export function Btn(props) {
  return h(
    'button',
    { className: 'ds-btn' + (props.primary ? ' ds-btn-primary' : ''), onClick: props.onClick, disabled: props.disabled === true, title: props.title || '' },
    props.label,
  )
}

export function Field(props) {
  const attrs = {
    className: 'ds-input',
    value: props.value,
    onChange: (e) => props.onChange(e.target.value),
    placeholder: props.placeholder || '',
    type: props.type || 'text',
  }
  return h(
    'label',
    { className: 'ds-field' },
    h('span', { className: 'ds-field-label' }, props.label),
    h('input', attrs),
    props.hint ? h('span', { className: 'ds-hint' }, props.hint) : null,
  )
}

export function listVal(x) {
  if (Array.isArray(x)) return x.join(', ')
  return typeof x === 'string' ? x : ''
}

export function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (typeof FileReader === 'undefined') {
      reject(new Error('FileReader unavailable in this client'))
      return
    }
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result))
    fr.onerror = () => reject(new Error('read failed'))
    fr.readAsDataURL(file)
  })
}

export function readAsText(file) {
  return new Promise((resolve, reject) => {
    if (typeof FileReader === 'undefined') {
      reject(new Error('FileReader unavailable in this client'))
      return
    }
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result))
    fr.onerror = () => reject(new Error('read failed'))
    fr.readAsText(file)
  })
}
