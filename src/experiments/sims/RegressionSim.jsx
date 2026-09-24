import { useEffect, useId, useMemo, useState } from 'react'
import { Plus, RotateCcw } from 'lucide-react'
import { CHART_THEME, ChartFrame, LineChart } from '../../components/lab/charts.jsx'
import { ExplainBox, MetricGrid, PinnedComparison, Select, SimFooter, SimPanel, Slider, Toggle, fixed, pyList } from '../../components/lab/simKit.jsx'
import { gaussian, gradientDescent, leastSquares, regressionMetrics, seeded } from '../../lib/ml.js'
import { ErrorLandscape, SLOPE_RANGE, mseAt } from './ErrorLandscape.jsx'

const DATASETS = [
  { value: 'linear', label: 'A linear trend' },
  { value: 'noisy', label: 'A noisy linear trend' },
  { value: 'curved', label: 'A curved relationship' },
  { value: 'outlier', label: 'A linear trend with one outlier' },
]

const round2 = (v) => Math.round(v * 100) / 100

function makeDataset(kind) {
  const random = seeded({ linear: 11, noisy: 12, curved: 13, outlier: 11 }[kind])
  const points = Array.from({ length: 30 }, (_, i) => {
    const x = -3 + (6 * i) / 29
    const noise = gaussian(random)
    const y = kind === 'curved' ? 0.35 * x * x - 1 + 0.3 * noise : 0.8 * x + 0.3 + (kind === 'noisy' ? 1.2 : 0.35) * noise
    return { x: round2(x), y: round2(y) }
  })
  if (kind === 'outlier') points.push({ x: 2.5, y: -4 })
  return points
}

// Step size 1/L, where L bounds the curvature of MSE, keeps gradient descent stable on any dataset.
function stableRate(points) {
  const a = points.reduce((s, p) => s + p.x * p.x, 0) / points.length
  const b = points.reduce((s, p) => s + p.x, 0) / points.length
  const largestEigen = (a + 1) / 2 + Math.sqrt(((a - 1) / 2) ** 2 + b * b)
  return 1 / (2 * largestEigen)
}

const X_DOMAIN = [-4, 4]
const Y_DOMAIN = [-5, 5]

function pythonCode(points, slope, intercept) {
  return `# Linear regression from first principles (standard library only)
xs = ${pyList(points.map((p) => p.x), 2)}
ys = ${pyList(points.map((p) => p.y), 2)}
n = len(xs)

def metrics(slope, intercept):
    residuals = [y - (slope * x + intercept) for x, y in zip(xs, ys)]
    mse = sum(r * r for r in residuals) / n
    mean_y = sum(ys) / n
    r2 = 1 - sum(r * r for r in residuals) / sum((y - mean_y) ** 2 for y in ys)
    return mse, mse ** 0.5, sum(abs(r) for r in residuals) / n, r2

mean_x, mean_y = sum(xs) / n, sum(ys) / n
best_slope = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys)) / sum((x - mean_x) ** 2 for x in xs)
best_intercept = mean_y - best_slope * mean_x

print("Your line:          slope=%.3f intercept=%.3f" % (${slope}, ${intercept}))
print("  MSE=%.4f RMSE=%.4f MAE=%.4f R2=%.4f" % metrics(${slope}, ${intercept}))
print("Least-squares line: slope=%.3f intercept=%.3f" % (best_slope, best_intercept))
print("  MSE=%.4f RMSE=%.4f MAE=%.4f R2=%.4f" % metrics(best_slope, best_intercept))
`
}

export default function RegressionSim({ onSaveResult, onUsePython }) {
  const clipId = useId().replace(/:/g, '')
  const [dataset, setDataset] = useState('linear')
  const [points, setPoints] = useState(() => makeDataset('linear'))
  const [slope, setSlope] = useState(0)
  const [intercept, setIntercept] = useState(0)
  const [adding, setAdding] = useState(false)
  const [newPoint, setNewPoint] = useState({ x: '0', y: '0' })
  const [selected, setSelected] = useState(0)
  const [path, setPath] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [pinned, setPinned] = useState(null)

  const predict = (x) => slope * x + intercept
  const metrics = regressionMetrics(points, predict)
  const bestLine = useMemo(() => leastSquares(points), [points])
  const best = { ...bestLine, mse: mseAt(points, bestLine.slope, bestLine.intercept) }
  const bestMetrics = regressionMetrics(points, (x) => bestLine.slope * x + bestLine.intercept)
  const sample = points[Math.min(selected, points.length - 1)]

  // Replay recorded gradient-descent steps on the sliders.
  useEffect(() => {
    if (!playing || !path) return undefined
    let index = 0
    const timer = setInterval(() => {
      index++
      if (index >= path.length) {
        setPlaying(false)
        clearInterval(timer)
        return
      }
      setSlope(path[index].slope)
      setIntercept(path[index].intercept)
    }, 45)
    return () => clearInterval(timer)
  }, [playing, path])

  const changeDataset = (value) => {
    setDataset(value)
    setPoints(makeDataset(value))
    setSelected(0)
    setPath(null)
  }

  const moveSlider = (setter) => (value) => {
    setPlaying(false)
    setter(value)
  }

  const addPoint = (x, y) => {
    setPoints((current) => [...current, { x: round2(x), y: round2(y) }])
    setSelected(points.length)
    setPath(null)
  }

  const reset = () => {
    changeDataset('linear')
    setSlope(0)
    setIntercept(0)
    setAdding(false)
    setPlaying(false)
  }

  const recordGradient = () => {
    const recorded = gradientDescent(points, { slope, intercept }, { steps: 80, rate: stableRate(points) })
    setPath(recorded)
    setPlaying(true)
  }

  const crossSection = useMemo(
    () =>
      Array.from({ length: 61 }, (_, i) => {
        const s = SLOPE_RANGE[0] + ((SLOPE_RANGE[1] - SLOPE_RANGE[0]) * i) / 60
        return { x: s, y: mseAt(points, s, intercept) }
      }),
    [points, intercept],
  )

  const current = {
    label: `slope ${slope.toFixed(2)}, intercept ${intercept.toFixed(2)}`,
    metrics: [
      { label: 'MSE', value: fixed(metrics.mse) },
      { label: 'RMSE', value: fixed(metrics.rmse) },
      { label: 'MAE', value: fixed(metrics.mae) },
      { label: 'R²', value: fixed(metrics.r2) },
    ],
  }

  const save = () =>
    onSaveResult({
      title: `y = ${slope.toFixed(2)}x + ${intercept.toFixed(2)} on "${DATASETS.find((d) => d.value === dataset).label}" (${points.length} samples)`,
      metrics: [...current.metrics, { label: 'Least-squares MSE', value: fixed(best.mse) }],
      explanation:
        metrics.mse - best.mse < 1e-3
          ? 'Your line matches the least-squares solution: no other straight line has lower training MSE on these points.'
          : `Your line's MSE is ${fixed(metrics.mse - best.mse)} above the least-squares minimum (slope ${bestLine.slope.toFixed(3)}, intercept ${bestLine.intercept.toFixed(3)}). ${
              dataset === 'curved' ? 'Even the best straight line leaves a pattern in the residuals because the relationship is curved.' : ''
            }`,
    })

  return (
    <>
      <SimPanel dark title="Fit the line">
        <ErrorLandscape points={points} slope={slope} intercept={intercept} best={best} />

        <div className="lab-chart-box">
          <p className="lab-question-text">2D error cross-section · intercept {intercept.toFixed(3)}</p>
          <LineChart
            series={[{ label: 'MSE', points: crossSection, color: CHART_THEME.violet }]}
            marker={{ x: Math.max(SLOPE_RANGE[0], Math.min(SLOPE_RANGE[1], slope)), y: mseAt(points, Math.max(SLOPE_RANGE[0], Math.min(SLOPE_RANGE[1], slope)), intercept) }}
            xLabel="Slope"
            yLabel="MSE"
            yMin={0}
            label="Mean squared error as the slope changes, at the current intercept"
          />
        </div>

        <MetricGrid
          metrics={[
            { label: 'Current MSE', value: fixed(metrics.mse, 4) },
            { label: 'Least-squares MSE', value: fixed(best.mse, 4) },
            { label: 'R²', value: fixed(metrics.r2) },
          ]}
        />
        <p className="lab-muted">MSE = mean((observed Y − predicted Y)²). RMSE = √MSE. This is training error; no unseen test set is being evaluated.</p>
      </SimPanel>

      <SimPanel title="Your line and its residuals">
        <div className="lab-sim-controls">
          <Select label="Dataset" value={dataset} onChange={changeDataset} options={DATASETS} />
          <Slider label="Slope" min={-3} max={3} step={0.05} value={slope} onChange={moveSlider(setSlope)} digits={2} />
          <Slider label="Intercept" min={-4} max={4} step={0.05} value={intercept} onChange={moveSlider(setIntercept)} digits={2} />
          <div className="lab-actions lab-actions-start">
            <button
              type="button"
              className="lab-btn lab-btn-primary"
              onClick={() => {
                setPlaying(false)
                setSlope(round2(bestLine.slope))
                setIntercept(round2(bestLine.intercept))
              }}
            >
              Fit line
            </button>
            <button type="button" className="lab-btn" onClick={reset}>
              <RotateCcw aria-hidden="true" />
              Reset activity
            </button>
          </div>
        </div>

        <MetricGrid metrics={current.metrics} />

        <div className="lab-chart-box lab-chart-wide">
          <ChartFrame
            xDomain={X_DOMAIN}
            yDomain={Y_DOMAIN}
            xLabel="X"
            yLabel="Y"
            label="Scatter plot of the samples with your fitted line and residuals"
            onPointer={adding ? addPoint : undefined}
          >
            {({ sx, sy, width, height, pad }) => (
              <>
                <defs>
                  <clipPath id={clipId}>
                    <rect x={pad.left} y={pad.top} width={width - pad.left - pad.right} height={height - pad.top - pad.bottom} />
                  </clipPath>
                </defs>
                <g clipPath={`url(#${clipId})`}>
                  {sample && (
                    <rect
                      x={sx(sample.x)}
                      y={sy(Math.max(sample.y, predict(sample.x)))}
                      width={Math.abs(sx(sample.x + Math.abs(sample.y - predict(sample.x))) - sx(sample.x))}
                      height={Math.abs(sy(0) - sy(Math.abs(sample.y - predict(sample.x))))}
                      fill="rgba(167, 139, 250, 0.18)"
                      stroke="rgba(167, 139, 250, 0.5)"
                    />
                  )}
                  {points.map((p, i) => (
                    <line key={`r${i}`} x1={sx(p.x)} x2={sx(p.x)} y1={sy(p.y)} y2={sy(predict(p.x))} stroke="rgba(255, 92, 138, 0.55)" strokeWidth="1.5" />
                  ))}
                  <line x1={sx(X_DOMAIN[0])} x2={sx(X_DOMAIN[1])} y1={sy(predict(X_DOMAIN[0]))} y2={sy(predict(X_DOMAIN[1]))} stroke={CHART_THEME.accent} strokeWidth="3" />
                  {points.map((p, i) => (
                    <circle
                      key={`p${i}`}
                      cx={sx(p.x)}
                      cy={sy(p.y)}
                      r={i === selected ? 7 : 5}
                      fill={CHART_THEME.primary}
                      stroke={i === selected ? '#fff' : '#030712'}
                      strokeWidth="2"
                      style={{ cursor: 'pointer' }}
                      onClick={(event) => {
                        event.stopPropagation()
                        setSelected(i)
                      }}
                    >
                      <title>{`Sample ${i + 1}: X ${p.x.toFixed(2)}, Y ${p.y.toFixed(2)}`}</title>
                    </circle>
                  ))}
                </g>
              </>
            )}
          </ChartFrame>
        </div>
      </SimPanel>

      <SimPanel title="Inspect or change the data" intro="Click a point to inspect it. Switch on Add points to place new samples, or enter coordinates below.">
        <div className="lab-sim-controls">
          <Toggle label="Add points" checked={adding} onChange={setAdding} />
          <label className="lab-control">
            X
            <input className="lab-input" type="number" step="0.1" value={newPoint.x} onChange={(e) => setNewPoint((p) => ({ ...p, x: e.target.value }))} />
          </label>
          <label className="lab-control">
            Y
            <input className="lab-input" type="number" step="0.1" value={newPoint.y} onChange={(e) => setNewPoint((p) => ({ ...p, y: e.target.value }))} />
          </label>
          <button
            type="button"
            className="lab-btn lab-btn-primary"
            onClick={() => {
              const x = Number(newPoint.x)
              const y = Number(newPoint.y)
              if (Number.isFinite(x) && Number.isFinite(y)) addPoint(x, y)
            }}
          >
            <Plus aria-hidden="true" />
            Add sample
          </button>
        </div>

        <Select
          label="Inspect sample"
          value={String(Math.min(selected, points.length - 1))}
          onChange={(value) => setSelected(Number(value))}
          options={points.map((p, i) => ({ value: String(i), label: `Sample ${i + 1}: X ${p.x.toFixed(2)}, Y ${p.y.toFixed(2)}` }))}
        />
        {sample && (
          <p className="lab-p" aria-live="polite">
            Sample {selected + 1}: X = {sample.x.toFixed(2)}, Y = {sample.y.toFixed(2)} · Predicted Y = {predict(sample.x).toFixed(3)} · Residual = {(sample.y - predict(sample.x)).toFixed(3)} · Squared residual ={' '}
            {((sample.y - predict(sample.x)) ** 2).toFixed(3)}
          </p>
        )}
        <details className="lab-hint">
          <summary>Inspect all {points.length} samples</summary>
          <div className="lab-table-wrap">
            <table className="lab-table">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">X</th>
                  <th scope="col">Y</th>
                  <th scope="col">Predicted</th>
                  <th scope="col">Residual</th>
                </tr>
              </thead>
              <tbody>
                {points.map((p, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{p.x.toFixed(2)}</td>
                    <td>{p.y.toFixed(2)}</td>
                    <td>{predict(p.x).toFixed(3)}</td>
                    <td>{(p.y - predict(p.x)).toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </SimPanel>

      <SimPanel kicker="FROM CALCULATION TO MOTION" title="Follow the gradient">
        <p className="lab-p">
          Record 80 full-batch gradient updates from your current line. Each step uses the actual derivative of MSE. A bounded step size keeps the updates stable for this dataset.
        </p>
        <div className="lab-actions lab-actions-start">
          <button type="button" className="lab-btn lab-btn-primary" onClick={recordGradient} disabled={playing}>
            {playing ? 'Descending…' : 'Record gradient steps'}
          </button>
        </div>
        {path && (
          <div className="lab-chart-box">
            <LineChart
              series={[{ label: 'MSE', points: path.map((step, i) => ({ x: i, y: step.mse })), color: CHART_THEME.mint }]}
              xLabel="Gradient step"
              yLabel="MSE"
              yMin={0}
              label="Training MSE after each gradient descent step"
            />
            <p className="lab-muted">
              Start MSE {fixed(path[0].mse)} → after {path.length - 1} steps {fixed(path[path.length - 1].mse)} (least-squares minimum {fixed(best.mse)}).
            </p>
          </div>
        )}
      </SimPanel>

      <PinnedComparison pinned={pinned} current={current} />

      <ExplainBox>
        Each vertical segment is a residual: observed Y minus predicted Y. Adjust the line, then use Fit line to find the least-squares solution for these points
        (R² {fixed(bestMetrics.r2)}). Gradient descent reaches the same bottom of the error bowl step by step. Training error does not measure performance on unseen data.
      </ExplainBox>

      <SimFooter onPin={() => setPinned(current)} onSave={save} onPython={() => onUsePython(pythonCode(points, slope, intercept))} />
    </>
  )
}
