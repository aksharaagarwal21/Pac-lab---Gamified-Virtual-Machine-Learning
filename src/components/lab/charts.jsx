// Small SVG chart primitives shared by the Theory activities and the simulations.

export const CHART_THEME = {
  grid: '#13254a',
  axis: '#2a3d66',
  text: '#94a3b8',
  primary: '#22d3ee',
  accent: '#f5c518',
  danger: '#ff5c8a',
  violet: '#a78bfa',
  mint: '#34d399',
}

export function niceTicks(min, max, count = 5) {
  if (min === max) return [min]
  const raw = (max - min) / count
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw)
  const ticks = []
  for (let value = Math.ceil(min / step) * step; value <= max + step / 1e6; value += step) {
    ticks.push(Number(value.toFixed(10)))
  }
  return ticks
}

export const formatTick = (value) => {
  if (Math.abs(value) >= 1000) return `${Math.round(value / 100) / 10}k`
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)))
}

// A plotting frame: gives children scale functions and draws axes, grid and labels.
export function ChartFrame({ width = 560, height = 300, xDomain, yDomain, xLabel, yLabel, label, children, onPointer }) {
  const pad = { left: 52, right: 16, top: 14, bottom: 44 }
  const [x0, x1] = xDomain
  const [y0, y1] = yDomain
  const sx = (value) => pad.left + ((value - x0) / (x1 - x0 || 1)) * (width - pad.left - pad.right)
  const sy = (value) => height - pad.bottom - ((value - y0) / (y1 - y0 || 1)) * (height - pad.top - pad.bottom)
  const invert = (px, py) => [
    x0 + ((px - pad.left) / (width - pad.left - pad.right)) * (x1 - x0),
    y0 + ((height - pad.bottom - py) / (height - pad.top - pad.bottom)) * (y1 - y0),
  ]

  const handlePointer = (event) => {
    if (!onPointer) return
    const box = event.currentTarget.getBoundingClientRect()
    const px = ((event.clientX - box.left) / box.width) * width
    const py = ((event.clientY - box.top) / box.height) * height
    if (px < pad.left || px > width - pad.right || py < pad.top || py > height - pad.bottom) return
    onPointer(...invert(px, py))
  }

  return (
    <svg className="lab-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} onClick={handlePointer}>
      {niceTicks(x0, x1).map((tick) => (
        <g key={`x${tick}`}>
          <line x1={sx(tick)} x2={sx(tick)} y1={pad.top} y2={height - pad.bottom} stroke={CHART_THEME.grid} />
          <text x={sx(tick)} y={height - pad.bottom + 18} textAnchor="middle" className="lab-chart-tick">
            {formatTick(tick)}
          </text>
        </g>
      ))}
      {niceTicks(y0, y1).map((tick) => (
        <g key={`y${tick}`}>
          <line x1={pad.left} x2={width - pad.right} y1={sy(tick)} y2={sy(tick)} stroke={CHART_THEME.grid} />
          <text x={pad.left - 8} y={sy(tick) + 4} textAnchor="end" className="lab-chart-tick">
            {formatTick(tick)}
          </text>
        </g>
      ))}
      <line x1={pad.left} x2={width - pad.right} y1={height - pad.bottom} y2={height - pad.bottom} stroke={CHART_THEME.axis} strokeWidth="1.5" />
      <line x1={pad.left} x2={pad.left} y1={pad.top} y2={height - pad.bottom} stroke={CHART_THEME.axis} strokeWidth="1.5" />
      {xLabel && (
        <text x={(pad.left + width - pad.right) / 2} y={height - 6} textAnchor="middle" className="lab-chart-label">
          {xLabel}
        </text>
      )}
      {yLabel && (
        <text x={14} y={(pad.top + height - pad.bottom) / 2} textAnchor="middle" className="lab-chart-label" transform={`rotate(-90 14 ${(pad.top + height - pad.bottom) / 2})`}>
          {yLabel}
        </text>
      )}
      {children({ sx, sy, width, height, pad })}
    </svg>
  )
}

const extent = (values, padding = 0.08) => {
  let min = Math.min(...values)
  let max = Math.max(...values)
  if (min === max) {
    min -= 1
    max += 1
  }
  const span = max - min
  return [min - span * padding, max + span * padding]
}

// Line chart of one or more series sampled over x, with an optional highlighted point.
export function LineChart({ series, xLabel, yLabel, marker, label, yMin }) {
  const xs = series.flatMap((s) => s.points.map((p) => p.x))
  const ys = series.flatMap((s) => s.points.map((p) => p.y))
  const [ymin, ymax] = extent(ys)
  return (
    <ChartFrame xDomain={[Math.min(...xs), Math.max(...xs)]} yDomain={[yMin ?? ymin, ymax]} xLabel={xLabel} yLabel={yLabel} label={label}>
      {({ sx, sy }) => (
        <>
          {series.map((s) => (
            <polyline
              key={s.label}
              fill="none"
              stroke={s.color ?? CHART_THEME.primary}
              strokeWidth="2.5"
              strokeDasharray={s.dashed ? '6 5' : undefined}
              points={s.points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')}
            />
          ))}
          {marker && (
            <circle cx={sx(marker.x)} cy={sy(marker.y)} r="7" fill={CHART_THEME.accent} stroke="#030712" strokeWidth="2" />
          )}
        </>
      )}
    </ChartFrame>
  )
}

export function Legend({ items }) {
  return (
    <ul className="lab-legend">
      {items.map((item) => (
        <li key={item.label}>
          <span className="lab-legend-swatch" style={{ background: item.color }} aria-hidden="true" />
          {item.label}
        </li>
      ))}
    </ul>
  )
}
