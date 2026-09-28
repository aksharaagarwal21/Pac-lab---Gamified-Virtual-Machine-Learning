import { useRef, useState } from 'react'
import { CHART_THEME, formatTick, niceTicks } from '../charts.jsx'
import { useElementSize } from './hooks.js'

const PAD = { left: 50, right: 18, top: 16, bottom: 44 }

// A responsive SVG plot whose drawing units are real pixels (so squares stay square).
// Children receive scales plus `startDrag(event, { move(x, y, first), end(moved) })`, which
// captures the pointer and reports positions in data coordinates.
export function PlotSurface({
  xDomain,
  yDomain,
  xLabel,
  yLabel,
  label,
  fill = false,
  aspect = 0.62,
  minHeight = 280,
  maxHeight = 560,
  onBackgroundPointerDown,
  onBackgroundDoubleClick,
  overlay,
  children,
}) {
  const boxRef = useRef(null)
  const svgRef = useRef(null)
  const drag = useRef(null)
  const [dragging, setDragging] = useState(false)
  const size = useElementSize(boxRef)

  const width = Math.max(260, size.width || 640)
  const height = fill ? Math.max(minHeight, size.height || 420) : Math.round(Math.min(maxHeight, Math.max(minHeight, width * aspect)))
  const [x0, x1] = xDomain
  const [y0, y1] = yDomain
  const plot = { left: PAD.left, right: width - PAD.right, top: PAD.top, bottom: height - PAD.bottom }
  const sx = (x) => plot.left + ((x - x0) / (x1 - x0)) * (plot.right - plot.left)
  const sy = (y) => plot.bottom - ((y - y0) / (y1 - y0)) * (plot.bottom - plot.top)
  const pxPerY = (plot.bottom - plot.top) / (y1 - y0)

  const toData = (event) => {
    const box = svgRef.current.getBoundingClientRect()
    const px = ((event.clientX - box.left) / box.width) * width
    const py = ((event.clientY - box.top) / box.height) * height
    return [x0 + ((px - plot.left) / (plot.right - plot.left)) * (x1 - x0), y0 + ((plot.bottom - py) / (plot.bottom - plot.top)) * (y1 - y0)]
  }

  const startDrag = (event, handlers) => {
    if (event.button > 0) return
    event.preventDefault()
    event.stopPropagation()
    svgRef.current?.setPointerCapture?.(event.pointerId)
    drag.current = { ...handlers, pointerId: event.pointerId, moved: false }
    setDragging(true)
  }

  const onPointerMove = (event) => {
    const current = drag.current
    if (!current || event.pointerId !== current.pointerId) return
    const [x, y] = toData(event)
    current.move(x, y, !current.moved)
    current.moved = true
  }

  const finish = (event) => {
    const current = drag.current
    if (!current || event.pointerId !== current.pointerId) return
    drag.current = null
    setDragging(false)
    current.end?.(current.moved)
  }

  const tickCount = width < 460 ? 5 : 10
  const scale = { sx, sy, pxPerY, plot, width, height, xDomain, yDomain, startDrag, toData }

  return (
    <div ref={boxRef} className={`ix-plot${fill ? ' is-fill' : ''}${dragging ? ' is-dragging' : ''}`}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        aria-label={label}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        onLostPointerCapture={finish}
        onPointerDown={(event) => onBackgroundPointerDown?.(event, toData(event), scale)}
        onDoubleClick={(event) => onBackgroundDoubleClick?.(...toData(event))}
      >
        <rect x={plot.left} y={plot.top} width={plot.right - plot.left} height={plot.bottom - plot.top} className="ix-plot-bg" />
        {niceTicks(x0, x1, tickCount).map((tick) => (
          <g key={`x${tick}`} aria-hidden="true">
            <line x1={sx(tick)} x2={sx(tick)} y1={plot.top} y2={plot.bottom} stroke={CHART_THEME.grid} />
            <text x={sx(tick)} y={plot.bottom + 18} textAnchor="middle" className="lab-chart-tick">
              {formatTick(tick)}
            </text>
          </g>
        ))}
        {niceTicks(y0, y1, tickCount).map((tick) => (
          <g key={`y${tick}`} aria-hidden="true">
            <line x1={plot.left} x2={plot.right} y1={sy(tick)} y2={sy(tick)} stroke={CHART_THEME.grid} />
            <text x={plot.left - 8} y={sy(tick) + 4} textAnchor="end" className="lab-chart-tick">
              {formatTick(tick)}
            </text>
          </g>
        ))}
        <g aria-hidden="true">
          <line x1={plot.left} x2={plot.right} y1={plot.bottom} y2={plot.bottom} stroke={CHART_THEME.axis} strokeWidth="1.5" />
          <line x1={plot.left} x2={plot.left} y1={plot.top} y2={plot.bottom} stroke={CHART_THEME.axis} strokeWidth="1.5" />
          {xLabel && (
            <text x={(plot.left + plot.right) / 2} y={height - 6} textAnchor="middle" className="lab-chart-label">
              {xLabel}
            </text>
          )}
          {yLabel && (
            <text x={14} y={(plot.top + plot.bottom) / 2} textAnchor="middle" className="lab-chart-label" transform={`rotate(-90 14 ${(plot.top + plot.bottom) / 2})`}>
              {yLabel}
            </text>
          )}
        </g>
        {children(scale)}
      </svg>
      {overlay}
    </div>
  )
}
