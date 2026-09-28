import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export function useElementWidth(ref) {
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const update = () => setWidth(Math.round(element.clientWidth))
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return width
}

// Counts a displayed number up to its target, arcade-scoreboard style.
export function useCountUp(target, duration = 450) {
  const [value, setValue] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    const start = from.current
    if (start === target) return
    let frame
    const began = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - began) / duration)
      const next = Math.round(start + (target - start) * t)
      from.current = next
      setValue(next)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])
  return value
}

// True after the first painted frame, so CSS transitions can start from an initial position.
export function useArrived(key) {
  const [arrived, setArrived] = useState(false)
  useEffect(() => {
    setArrived(false)
    let inner
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setArrived(true))
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [key])
  return arrived
}
