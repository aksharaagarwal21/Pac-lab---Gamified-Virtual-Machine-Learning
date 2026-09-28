import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'

// Reusable hooks for the interactive experiment simulations.

// ---------- Undo / redo ----------

const HISTORY_LIMIT = 120

function historyReducer(state, action) {
  switch (action.type) {
    case 'set': {
      const next = typeof action.update === 'function' ? action.update(state.present) : action.update
      if (next === state.present) return state
      // Transient updates (every frame of a drag) replace the present without adding an undo step.
      if (action.transient) return { ...state, present: next }
      return { past: [...state.past, state.present].slice(-HISTORY_LIMIT), present: next, future: [] }
    }
    case 'undo':
      if (!state.past.length) return state
      return { past: state.past.slice(0, -1), present: state.past[state.past.length - 1], future: [state.present, ...state.future] }
    case 'redo':
      if (!state.future.length) return state
      return { past: [...state.past, state.present], present: state.future[0], future: state.future.slice(1) }
    default:
      return state
  }
}

export function useHistory(initial) {
  const [state, dispatch] = useReducer(historyReducer, undefined, () => ({
    past: [],
    present: typeof initial === 'function' ? initial() : initial,
    future: [],
  }))
  const set = useCallback((update, { transient = false } = {}) => dispatch({ type: 'set', update, transient }), [])
  const undo = useCallback(() => dispatch({ type: 'undo' }), [])
  const redo = useCallback(() => dispatch({ type: 'redo' }), [])
  return { present: state.present, set, undo, redo, canUndo: state.past.length > 0, canRedo: state.future.length > 0 }
}

// Groups rapid edits of the same control (slider, arrow keys, typing) into one undo step.
// Returns true when this edit continues the previous one.
export function useEditSession(gap = 800) {
  const last = useRef({ key: null, at: 0 })
  return useCallback(
    (key) => {
      const now = performance.now()
      const continues = last.current.key === key && now - last.current.at < gap
      last.current = { key, at: now }
      return continues
    },
    [gap],
  )
}

// ---------- Motion ----------

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(query).matches)
  useEffect(() => {
    const list = window.matchMedia?.(query)
    if (!list) return undefined
    const update = () => setMatches(list.matches)
    update()
    list.addEventListener('change', update)
    return () => list.removeEventListener('change', update)
  }, [query])
  return Boolean(matches)
}

export const usePrefersReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)')

function blendFrames(from, to, amount) {
  const out = {}
  for (const key in to) {
    const a = from[key]
    const b = to[key]
    out[key] = a && a.length === b.length ? b.map((value, i) => a[i] + (value - a[i]) * amount) : b
  }
  return out
}

// Smoothly animates a frame of named numeric arrays ({ key: [x, y] }) towards `target`.
// With `instant` (e.g. while dragging) the target is shown immediately so interaction never lags.
export function useTween(target, { instant = false, duration = 240 } = {}) {
  const reduced = usePrefersReducedMotion()
  const shown = useRef(target)
  const [, repaint] = useReducer((n) => n + 1, 0)
  const skip = instant || reduced
  if (skip) shown.current = target

  useEffect(() => {
    if (skip || shown.current === target) return undefined
    const from = shown.current
    const start = performance.now()
    let frame = requestAnimationFrame(function step(now) {
      const t = Math.min(1, (now - start) / duration)
      shown.current = t === 1 ? target : blendFrames(from, target, 1 - (1 - t) ** 3)
      repaint()
      if (t < 1) frame = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(frame)
  }, [target, skip, duration])

  return shown.current
}

// True for a short moment after `value` changes: used to flash updated numbers.
export function usePulse(value, duration = 700) {
  const [on, setOn] = useState(false)
  const previous = useRef(value)
  useEffect(() => {
    if (Object.is(previous.current, value)) return undefined
    previous.current = value
    setOn(true)
    const timer = setTimeout(() => setOn(false), duration)
    return () => clearTimeout(timer)
  }, [value, duration])
  return on
}

// ---------- Layout ----------

export function useElementSize(ref) {
  const [size, setSize] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return undefined
    const measure = () => {
      const width = element.clientWidth
      const height = element.clientHeight
      setSize((current) => (current.width === width && current.height === height ? current : { width, height }))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return size
}

// Native fullscreen on the element when available; otherwise a fixed full-window overlay.
export function useFullscreen(ref) {
  const [native, setNative] = useState(false)
  const [overlay, setOverlay] = useState(false)

  useEffect(() => {
    const update = () => setNative(Boolean(ref.current) && document.fullscreenElement === ref.current)
    document.addEventListener('fullscreenchange', update)
    return () => document.removeEventListener('fullscreenchange', update)
  }, [ref])

  useEffect(() => {
    if (!overlay) return undefined
    const close = (event) => event.key === 'Escape' && setOverlay(false)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', close)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', close)
    }
  }, [overlay])

  const enter = useCallback(async () => {
    const element = ref.current
    if (element?.requestFullscreen && document.fullscreenEnabled !== false) {
      try {
        await element.requestFullscreen()
        return
      } catch {
        // Fall through to the overlay (e.g. iframe without allowfullscreen, iOS Safari).
      }
    }
    setOverlay(true)
  }, [ref])

  const exit = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
    setOverlay(false)
  }, [])

  const active = native || overlay
  return { active, overlay, enter, exit, toggle: active ? exit : enter }
}
