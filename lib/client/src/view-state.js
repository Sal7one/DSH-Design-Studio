import { runtime } from './runtime.js'

// UI choices that must outlive the Studio component. The harness renders only the active
// conversation view, so switching to Chat unmounts Design Studio and discards its React state.
// Retained values live in memory on the plugin runtime (per page load) and in sessionStorage, so
// switching tabs or reloading the same window restores the tab, the selected design, the App
// target and in-progress drafts. Values must be JSON-serializable; storage failures are ignored.
// Nothing is retained without a mounted plugin context (`runtime.ctx`, set by apply()).
const RETAINED_PREFIX = 'dsh-design-studio:'

// One store per plugin context: a reloaded plugin starts empty and restores from sessionStorage.
const retainedByContext = new WeakMap()

function retainedMemory() {
  const owner = runtime.ctx
  if (!owner || typeof owner !== 'object') return null
  let memory = retainedByContext.get(owner)
  if (!memory) {
    memory = new Map()
    retainedByContext.set(owner, memory)
  }
  return memory
}

function retainedStorageKey(scope, key) {
  return RETAINED_PREFIX + scope + ':' + key
}

export function readRetained(scope, key, fallback) {
  const memory = retainedMemory()
  if (!memory) return fallback
  const id = retainedStorageKey(scope, key)
  if (memory.has(id)) return memory.get(id)
  try {
    const raw = globalThis.sessionStorage ? globalThis.sessionStorage.getItem(id) : null
    if (raw !== null && raw !== undefined) {
      const value = JSON.parse(raw)
      memory.set(id, value)
      return value
    }
  } catch (_) {}
  return fallback
}

export function writeRetained(scope, key, value) {
  const memory = retainedMemory()
  if (!memory) return
  const id = retainedStorageKey(scope, key)
  memory.set(id, value)
  try {
    if (!globalThis.sessionStorage) return
    if (value === undefined) globalThis.sessionStorage.removeItem(id)
    else globalThis.sessionStorage.setItem(id, JSON.stringify(value))
  } catch (_) {}
}

// useState whose value is retained for `scope` + `key` across unmounts: exactly one React.useState
// call holding the raw value, so callers keep their hook order. Functional updates resolve against
// the latest retained value, so consecutive updates in one event compose. The scope is read when
// the component mounts; views whose scope can change are keyed by it so they remount.
export function useRetainedState(scope, key, initial) {
  const [value, setValue] = React.useState(readRetained(scope, key, initial))
  const setRetained = (next) => {
    const resolved = typeof next === 'function' ? next(readRetained(scope, key, value)) : next
    writeRetained(scope, key, resolved)
    setValue(resolved)
  }
  return [value, setRetained]
}
