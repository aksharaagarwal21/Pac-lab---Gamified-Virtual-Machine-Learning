import { useId } from 'react'
import { PlotSurface } from '../../../components/lab/interactive/PlotSurface.jsx'
import { DOMAIN, HANDLE_X, fmt, signed } from './model.js'

const HANDLES = ['left', 'centre', 'right']
const HANDLE_LABEL = { left: 'Left end handle: tilt the line', centre: 'Centre handle: move the line up or down', right: 'Right end handle: tilt the line' }

// Linear interpolation along a displayed line given its y at both ends of the X domain.
const lineY = (ends, x) => ends[0] + ((ends[1] - ends[0]) * (x - DOMAIN.x[0])) / (DOMAIN.x[1] - DOMAIN.x[0])

/**
 * The interactive scatter plot. Positions come from `frame` (the animated view of the data);
 * numbers in callouts come from `rows` (the exact current values).
 *
 * lines: { model: ends, best?: ends, gen?: ends } where ends = [y at x=0, y at x=10]
 * editable: which line has handles ('model' | 'gen' | null)
 */
export function RegressionGraph({
  frame,
  rows,
  lines,
  editable,
  pointsDraggable,
  show,
  selectedId,
  hoverId,
  outlierId,
  predictX,
  predicted,
  fill,
  modeChip,
  onSelect,
  onHover,
  onPointDrag,
  onHandleDrag,
  onHandleKey,
  onPredictDrag,
  onAddAt,
}) {
  const clipId = `lr-clip-${useId().replace(/:/g, '')}`
  const posOf = (row) => frame[`p:${row.id}`] ?? [row.x, row.y]
  const focusRow = rows.find((row) => row.id === (hoverId ?? selectedId))
  const handleEnds = editable ? lines[editable] : null

  const startPointDrag = (event, row, scale) => {
    onSelect(row.id)
    if (!pointsDraggable) {
      event.stopPropagation()
      return
    }
    onPointDrag.start(row.id)
    scale.startDrag(event, {
      move: (x, y, first) => onPointDrag.move(row.id, x, y, first),
      end: (moved) => onPointDrag.end(row.id, moved),
    })
  }

  const startHandleDrag = (event, handle, scale) => {
    onHandleDrag.start(editable, handle)
    scale.startDrag(event, {
      move: (_x, y, first) => onHandleDrag.move(editable, handle, y, first),
      end: (moved) => onHandleDrag.end(editable, handle, moved),
    })
  }

  const startPredictDrag = (event, scale, x) => {
    if (x != null) onPredictDrag(x, true)
    scale.startDrag(event, { move: (px, _y, first) => onPredictDrag(px, first), end: () => {} })
  }

  return (
    <PlotSurface
      xDomain={DOMAIN.x}
      yDomain={DOMAIN.y}
      xLabel="X (input feature)"
      yLabel="Y (target)"
      label="Interactive regression graph. Use the dataset table or the point inspector to edit values with the keyboard."
      fill={fill}
      overlay={modeChip}
      onBackgroundPointerDown={(event, [x], scale) => {
        if (show.prediction) startPredictDrag(event, scale, x)
        else onSelect(null)
      }}
      onBackgroundDoubleClick={pointsDraggable ? onAddAt : undefined}
    >
      {(scale) => {
        const { sx, sy, plot, pxPerY } = scale
        const model = lines.model
        return (
          <>
            <defs>
              <clipPath id={clipId}>
                <rect x={plot.left} y={plot.top} width={plot.right - plot.left} height={plot.bottom - plot.top} />
              </clipPath>
            </defs>

            <g clipPath={`url(#${clipId})`}>
              {show.squares &&
                rows.map((row) => {
                  const [x, y] = posOf(row)
                  const yHat = lineY(model, x)
                  const side = Math.abs(y - yHat) * pxPerY
                  if (side < 0.5) return null
                  const left = sx(x) + side > plot.right ? sx(x) - side : sx(x)
                  return (
                    <rect
                      key={`sq-${row.id}`}
                      className={`lr-square${row.id === selectedId ? ' is-selected' : ''}`}
                      x={left}
                      y={sy(Math.max(y, yHat))}
                      width={side}
                      height={side}
                    />
                  )
                })}

              {show.residuals &&
                rows.map((row) => {
                  const [x, y] = posOf(row)
                  return (
                    <line
                      key={`res-${row.id}`}
                      className={`lr-residual${row.residual >= 0 ? ' is-positive' : ' is-negative'}${row.id === selectedId ? ' is-selected' : ''}`}
                      x1={sx(x)}
                      x2={sx(x)}
                      y1={sy(y)}
                      y2={sy(lineY(model, x))}
                    />
                  )
                })}

              {lines.best && <line className="lr-line is-best" x1={sx(DOMAIN.x[0])} x2={sx(DOMAIN.x[1])} y1={sy(lines.best[0])} y2={sy(lines.best[1])} />}
              {lines.gen && <line className="lr-line is-gen" x1={sx(DOMAIN.x[0])} x2={sx(DOMAIN.x[1])} y1={sy(lines.gen[0])} y2={sy(lines.gen[1])} />}
              <line className="lr-line is-model" x1={sx(DOMAIN.x[0])} x2={sx(DOMAIN.x[1])} y1={sy(model[0])} y2={sy(model[1])} />

              {show.prediction && predicted != null && (
                <g className="lr-predict" aria-hidden="true">
                  <line className="lr-predict-guide" x1={sx(predictX)} x2={sx(predictX)} y1={plot.bottom} y2={sy(lineY(model, predictX))} />
                  <line className="lr-predict-guide" x1={plot.left} x2={sx(predictX)} y1={sy(lineY(model, predictX))} y2={sy(lineY(model, predictX))} />
                  <rect className="lr-predict-dot" x={sx(predictX) - 6} y={sy(lineY(model, predictX)) - 6} width="12" height="12" transform={`rotate(45 ${sx(predictX)} ${sy(lineY(model, predictX))})`} />
                </g>
              )}
            </g>

            {rows.map((row) => {
              const [x, y] = posOf(row)
              const selected = row.id === selectedId
              const outlier = row.id === outlierId
              return (
                <g
                  key={row.id}
                  className={`lr-point${selected ? ' is-selected' : ''}${outlier ? ' is-outlier' : ''}${pointsDraggable ? ' is-draggable' : ''}`}
                  transform={`translate(${sx(x)} ${sy(y)})`}
                  onPointerDown={(event) => startPointDrag(event, row, scale)}
                  onPointerEnter={() => onHover(row.id)}
                  onPointerLeave={() => onHover(null)}
                  data-point={row.index + 1}
                >
                  <circle className="lr-point-hit" r="15" />
                  {selected && <circle className="lr-point-ring" r="11" />}
                  <circle className="lr-point-dot" r={selected ? 7 : 6} />
                </g>
              )
            })}

            {show.prediction && predicted != null && (
              <g
                className="lr-predict-handle"
                transform={`translate(${sx(predictX)} ${plot.bottom})`}
                onPointerDown={(event) => startPredictDrag(event, scale)}
                data-testid="predict-handle"
              >
                <circle r="16" className="lr-point-hit" />
                <path d="M0 -2 L8 12 L-8 12 Z" />
              </g>
            )}

            {show.prediction && predicted != null && (
              <PredictLabel x={sx(predictX)} y={sy(Math.min(DOMAIN.y[1], Math.max(DOMAIN.y[0], lineY(model, predictX))))} plot={plot} text={`ŷ = ${fmt(predicted)}`} />
            )}

            {handleEnds &&
              HANDLES.map((handle) => {
                const hx = HANDLE_X[handle]
                const hy = lineY(handleEnds, hx)
                return (
                  <g
                    key={handle}
                    className={`lr-handle is-${handle}${editable === 'gen' ? ' is-gen' : ''}`}
                    transform={`translate(${sx(hx)} ${sy(hy)})`}
                    role="slider"
                    tabIndex={0}
                    aria-label={HANDLE_LABEL[handle]}
                    aria-orientation="vertical"
                    aria-valuemin={DOMAIN.y[0]}
                    aria-valuemax={DOMAIN.y[1]}
                    aria-valuenow={Number(hy.toFixed(2))}
                    aria-valuetext={`Line height at x = ${hx}: ${fmt(hy)}`}
                    data-handle={handle}
                    onPointerDown={(event) => startHandleDrag(event, handle, scale)}
                    onKeyDown={(event) => {
                      const step = event.shiftKey ? 1 : 0.1
                      const dy = { ArrowUp: step, ArrowRight: step, ArrowDown: -step, ArrowLeft: -step }[event.key]
                      if (dy == null) return
                      event.preventDefault()
                      onHandleKey(editable, handle, dy)
                    }}
                  >
                    <circle className="lr-point-hit" r="18" />
                    {handle === 'centre' ? (
                      <>
                        <rect className="lr-handle-body" x="-10" y="-10" width="20" height="20" rx="5" />
                        <path className="lr-handle-glyph" d="M0 -6 L3.5 -2 H-3.5 Z M0 6 L3.5 2 H-3.5 Z" />
                      </>
                    ) : (
                      <>
                        <circle className="lr-handle-body" r="9" />
                        <circle className="lr-handle-glyph" r="2.6" />
                      </>
                    )}
                  </g>
                )
              })}

            {focusRow && <Callout row={focusRow} pos={posOf(focusRow)} scale={scale} outlier={focusRow.id === outlierId} />}
          </>
        )
      }}
    </PlotSurface>
  )
}

function PredictLabel({ x, y, plot, text }) {
  const width = 92
  const left = Math.min(plot.right - width, x + 12)
  const top = Math.max(plot.top, y - 34)
  return (
    <g className="lr-callout is-predict" transform={`translate(${left} ${top})`} aria-hidden="true">
      <rect width={width} height="24" rx="6" />
      <text x={width / 2} y="16" textAnchor="middle">
        {text}
      </text>
    </g>
  )
}

function Callout({ row, pos, scale, outlier }) {
  const { sx, sy, plot } = scale
  const width = 158
  const height = 94
  const px = sx(pos[0])
  const py = sy(pos[1])
  const left = px + 16 + width > plot.right ? px - 16 - width : px + 16
  const top = Math.min(plot.bottom - height, Math.max(plot.top, py - height / 2))
  return (
    <g className="lr-callout" transform={`translate(${left} ${top})`} pointerEvents="none" aria-hidden="true">
      <rect width={width} height={height} rx="8" />
      <text x="10" y="18" className="lr-callout-title">
        Point {row.index + 1}
        {outlier ? ' · outlier' : ''}
      </text>
      <text x="10" y="36">x = {fmt(row.x)}</text>
      <text x="10" y="52">Actual y = {fmt(row.y)}</text>
      <text x="10" y="68">Predicted ŷ = {fmt(row.predicted)}</text>
      <text x="10" y="84" className={row.residual >= 0 ? 'is-positive' : 'is-negative'}>
        Residual = {signed(row.residual)}
      </text>
    </g>
  )
}
