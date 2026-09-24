import { useEffect, useMemo, useRef, useState } from 'react'

// 3D surface of mean squared error for every (slope, intercept) line, drawn on a canvas.
// Drag to orbit; the view buttons give keyboard users the same control.

export const SLOPE_RANGE = [-3, 3]
export const INTERCEPT_RANGE = [-4, 4]
const HEIGHT = 340
const VIEWS = {
  reset: { yaw: -0.75, pitch: 0.55 },
  front: { yaw: 0, pitch: 0.12 },
  top: { yaw: 0, pitch: 1.45 },
}

export const mseAt = (points, slope, intercept) =>
  points.reduce((sum, p) => sum + (slope * p.x + intercept - p.y) ** 2, 0) / points.length

const toUnit = (value, [min, max]) => -1 + (2 * (value - min)) / (max - min)
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function ErrorLandscape({ points, slope, intercept, best }) {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const dragRef = useRef(null)
  const [view, setView] = useState(VIEWS.reset)
  const [orbit, setOrbit] = useState(false)
  const [quality, setQuality] = useState('auto')
  const [width, setWidth] = useState(600)

  const surface = useMemo(() => {
    const n = quality === 'low' ? 16 : quality === 'high' ? 44 : 30
    let max = 0
    const values = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => {
        const s = SLOPE_RANGE[0] + ((SLOPE_RANGE[1] - SLOPE_RANGE[0]) * i) / (n - 1)
        const b = INTERCEPT_RANGE[0] + ((INTERCEPT_RANGE[1] - INTERCEPT_RANGE[0]) * j) / (n - 1)
        const m = mseAt(points, s, b)
        max = Math.max(max, m)
        return m
      }),
    )
    return { n, values, max }
  }, [points, quality])

  useEffect(() => {
    const element = wrapRef.current
    const observer = new ResizeObserver(() => setWidth(element.clientWidth))
    observer.observe(element)
    setWidth(element.clientWidth)
    return () => observer.disconnect()
  }, [])

  // Gentle auto-rotation while "Orbit view" is on.
  useEffect(() => {
    if (!orbit || prefersReducedMotion()) return undefined
    let frame
    const spin = () => {
      setView((current) => ({ ...current, yaw: current.yaw + 0.006 }))
      frame = requestAnimationFrame(spin)
    }
    frame = requestAnimationFrame(spin)
    return () => cancelAnimationFrame(frame)
  }, [orbit])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(HEIGHT * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, HEIGHT)

    const scale = Math.min(width, HEIGHT * 1.7) * 0.34
    const cx = width / 2
    const cy = HEIGHT * 0.62
    const cosYaw = Math.cos(view.yaw)
    const sinYaw = Math.sin(view.yaw)
    const cosPitch = Math.cos(view.pitch)
    const sinPitch = Math.sin(view.pitch)
    // X = slope, Z = intercept, Y = height (MSE). Larger depth is closer to the viewer.
    const project = (X, Y, Z) => {
      const x1 = X * cosYaw - Z * sinYaw
      const z1 = X * sinYaw + Z * cosYaw
      return { x: cx + x1 * scale, y: cy - (Y * cosPitch - z1 * sinPitch) * scale, depth: Y * sinPitch + z1 * cosPitch }
    }
    const heightOf = (mse) => Math.min(1, mse / surface.max) * 0.95
    const line = (a, b, color, lineWidth = 1) => {
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.strokeStyle = color
      ctx.lineWidth = lineWidth
      ctx.stroke()
    }

    // Floor grid.
    for (let k = -1; k <= 1.0001; k += 0.25) {
      line(project(k, 0, -1), project(k, 0, 1), 'rgba(59, 90, 148, 0.35)')
      line(project(-1, 0, k), project(1, 0, k), 'rgba(59, 90, 148, 0.35)')
    }
    line(project(-1.1, 0, 0), project(1.1, 0, 0), '#f5c518', 2)
    line(project(0, 0, -1.1), project(0, 0, 1.1), '#22d3ee', 2)

    // Surface quads, far to near.
    const { n, values } = surface
    const quads = []
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < n - 1; j++) {
        const corners = [
          [i, j],
          [i + 1, j],
          [i + 1, j + 1],
          [i, j + 1],
        ].map(([a, b]) => project(-1 + (2 * a) / (n - 1), heightOf(values[a][b]), -1 + (2 * b) / (n - 1)))
        const level = (values[i][j] + values[i + 1][j + 1]) / (2 * surface.max)
        quads.push({ corners, depth: corners.reduce((sum, c) => sum + c.depth, 0) / 4, level })
      }
    }
    quads.sort((a, b) => a.depth - b.depth)
    for (const quad of quads) {
      ctx.beginPath()
      quad.corners.forEach((c, k) => (k ? ctx.lineTo(c.x, c.y) : ctx.moveTo(c.x, c.y)))
      ctx.closePath()
      ctx.fillStyle = `hsla(${255 - 25 * quad.level}, 70%, ${38 + 34 * (1 - quad.level)}%, 0.92)`
      ctx.fill()
      ctx.strokeStyle = 'rgba(8, 14, 32, 0.35)'
      ctx.lineWidth = 0.6
      ctx.stroke()
    }

    // Least-squares solution (mint diamond) and the current line (amber sphere with a height marker).
    if (best) {
      const p = project(toUnit(best.slope, SLOPE_RANGE), heightOf(best.mse), toUnit(best.intercept, INTERCEPT_RANGE))
      ctx.beginPath()
      ctx.moveTo(p.x, p.y - 7)
      ctx.lineTo(p.x + 7, p.y)
      ctx.lineTo(p.x, p.y + 7)
      ctx.lineTo(p.x - 7, p.y)
      ctx.closePath()
      ctx.fillStyle = '#34d399'
      ctx.fill()
    }
    const currentMse = mseAt(points, slope, intercept)
    const X = toUnit(Math.max(SLOPE_RANGE[0], Math.min(SLOPE_RANGE[1], slope)), SLOPE_RANGE)
    const Z = toUnit(Math.max(INTERCEPT_RANGE[0], Math.min(INTERCEPT_RANGE[1], intercept)), INTERCEPT_RANGE)
    const top = project(X, heightOf(currentMse), Z)
    line(project(X, 0, Z), top, '#a3e635', 2)
    ctx.beginPath()
    ctx.arc(top.x, top.y, 7, 0, Math.PI * 2)
    ctx.fillStyle = '#f5c518'
    ctx.fill()
    ctx.strokeStyle = '#030712'
    ctx.lineWidth = 2
    ctx.stroke()
  }, [surface, view, slope, intercept, best, width, points])

  const onPointerDown = (event) => {
    dragRef.current = { x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
    setOrbit(false)
  }
  const onPointerMove = (event) => {
    if (!dragRef.current) return
    const dx = event.clientX - dragRef.current.x
    const dy = event.clientY - dragRef.current.y
    dragRef.current = { x: event.clientX, y: event.clientY }
    setView((current) => ({ yaw: current.yaw + dx * 0.01, pitch: Math.max(0.05, Math.min(1.5, current.pitch + dy * 0.008)) }))
  }
  const onPointerUp = () => {
    dragRef.current = null
  }

  const currentMse = mseAt(points, slope, intercept)

  return (
    <div className="lab-landscape">
      <div className="lab-landscape-head">
        <div>
          <p className="lab-kicker">SCIENTIFIC INSTRUMENT</p>
          <h4 className="lab-subtitle">The error landscape</h4>
        </div>
        <div className="lab-control lab-landscape-quality">
          <label htmlFor="landscape-quality">View quality</label>
          <select id="landscape-quality" className="lab-select" value={quality} onChange={(event) => setQuality(event.target.value)}>
            <option value="auto">Auto</option>
            <option value="low">Low</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>
      <p className="lab-p">
        Every position is a different line. Height is the mean squared error on your current observations. The amber sphere is your line; the mint diamond is the least-squares solution.
      </p>
      <div className="lab-actions lab-actions-start">
        <button type="button" className="lab-btn" onClick={() => { setView(VIEWS.reset); setOrbit(false) }}>
          Reset view
        </button>
        <button type="button" className="lab-btn lab-toggle" aria-pressed={orbit} onClick={() => setOrbit((on) => !on)}>
          Orbit view
        </button>
        <button type="button" className="lab-btn" onClick={() => { setView(VIEWS.front); setOrbit(false) }}>
          Front view
        </button>
        <button type="button" className="lab-btn" onClick={() => { setView(VIEWS.top); setOrbit(false) }}>
          Top view
        </button>
      </div>
      <div ref={wrapRef} className="lab-landscape-canvas">
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: `${HEIGHT}px` }}
          role="img"
          aria-label={`Error surface. Current line MSE ${currentMse.toFixed(3)}${best ? `; least-squares MSE ${best.mse.toFixed(3)}` : ''}.`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>
      <p className="lab-muted">Drag to orbit. Use the view buttons with a keyboard. Camera movement changes only the view.</p>
      <p className="lab-landscape-axes">
        <span>X: slope</span>
        <span>Y: MSE (squared Y units)</span>
        <span>Z: intercept</span>
      </p>
    </div>
  )
}
