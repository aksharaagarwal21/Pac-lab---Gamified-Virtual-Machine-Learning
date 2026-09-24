import { useId, useMemo, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { CHART_THEME, ChartFrame, Legend, LineChart } from '../../components/lab/charts.jsx'
import { ExplainBox, MetricGrid, PinnedComparison, Select, SimFooter, SimPanel, Slider, fixed, pyList } from '../../components/lab/simKit.jsx'
import { confusion, logLoss, seeded, sigmoid } from '../../lib/ml.js'

const DATASETS = [
  { value: 'overlap', label: 'Overlapping classes' },
  { value: 'separable', label: 'Perfectly separable' },
  { value: 'imbalanced', label: 'Imbalanced (few passes)' },
]

// Forty students: hours studied (0–10) and whether they passed.
function makeStudents(kind) {
  const random = seeded({ overlap: 41, separable: 42, imbalanced: 43 }[kind])
  return Array.from({ length: 40 }, () => {
    const x = Math.round((0.25 + random() * 9.5) * 10) / 10
    if (kind === 'separable') return { x, label: x > 5 ? 1 : 0 }
    const p = sigmoid(kind === 'imbalanced' ? 1.2 * x - 9 : 1.1 * x - 5.5)
    return { x, label: random() < p ? 1 : 0 }
  }).sort((a, b) => a.x - b.x)
}

// Newton's method on scikit-learn's default objective: ½w² + Σ log loss (C = 1, intercept not penalised).
function fitLogistic(points) {
  let w = 0
  let b = 0
  for (let iteration = 0; iteration < 60; iteration++) {
    let gw = w
    let gb = 0
    let hww = 1
    let hwb = 0
    let hbb = 0
    for (const p of points) {
      const q = sigmoid(w * p.x + b)
      const r = q - p.label
      const s = q * (1 - q)
      gw += r * p.x
      gb += r
      hww += s * p.x * p.x
      hwb += s * p.x
      hbb += s
    }
    const det = hww * hbb - hwb * hwb
    if (Math.abs(det) < 1e-12) break
    const dw = (hbb * gw - hwb * gb) / det
    const db = (hww * gb - hwb * gw) / det
    w -= dw
    b -= db
    if (Math.abs(dw) + Math.abs(db) < 1e-10) break
  }
  return { w, b }
}

function rocCurve(points, probability) {
  const positives = points.filter((p) => p.label === 1).length
  const negatives = points.length - positives
  const curve = Array.from({ length: 101 }, (_, i) => {
    const threshold = 1 - i / 100
    let tp = 0
    let fp = 0
    points.forEach((p) => {
      if (probability(p) >= threshold) {
        if (p.label === 1) tp++
        else fp++
      }
    })
    return { x: negatives ? fp / negatives : 0, y: positives ? tp / positives : 0, threshold }
  })
  const auc = curve.slice(1).reduce((area, point, i) => area + ((point.x - curve[i].x) * (point.y + curve[i].y)) / 2, 0)
  return { curve, auc }
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

function pythonCode(points, threshold) {
  return `# Logistic regression with gradient descent (standard library only).
# Gradient descent approximates the exact fit, so numbers differ slightly from the simulation.
import math

hours = ${pyList(points.map((p) => p.x), 1)}
passed = ${pyList(points.map((p) => p.label))}
THRESHOLD = ${threshold}

w, b, rate = 0.0, 0.0, 0.05
for step in range(20000):
    gw = w  # L2 penalty, like scikit-learn's default C = 1
    gb = 0.0
    for x, y in zip(hours, passed):
        error = 1 / (1 + math.exp(-(w * x + b))) - y
        gw += error * x
        gb += error
    w -= rate * gw / len(hours)
    b -= rate * gb / len(hours)

probabilities = [1 / (1 + math.exp(-(w * x + b))) for x in hours]
predicted = [1 if p >= THRESHOLD else 0 for p in probabilities]
tp = sum(1 for y, p in zip(passed, predicted) if y == 1 and p == 1)
fp = sum(1 for y, p in zip(passed, predicted) if y == 0 and p == 1)
fn = sum(1 for y, p in zip(passed, predicted) if y == 1 and p == 0)
tn = sum(1 for y, p in zip(passed, predicted) if y == 0 and p == 0)

print(f"w = {w:.3f}, b = {b:.3f}, boundary at {(math.log(THRESHOLD / (1 - THRESHOLD)) - b) / w:.2f} hours")
print(f"TP={tp} FP={fp} FN={fn} TN={tn}")
print(f"accuracy = {(tp + tn) / len(passed):.3f}")
print(f"precision = {tp / (tp + fp) if tp + fp else 0:.3f}, recall = {tp / (tp + fn) if tp + fn else 0:.3f}")
`
}

export default function LogisticSim({ onSaveResult, onUsePython }) {
  const clipId = useId().replace(/:/g, '')
  const [dataset, setDataset] = useState('overlap')
  const [w, setW] = useState(0.5)
  const [b, setB] = useState(-2)
  const [threshold, setThreshold] = useState(0.5)
  const [pinned, setPinned] = useState(null)

  const points = useMemo(() => makeStudents(dataset), [dataset])
  const probability = (p) => sigmoid(w * p.x + b)
  const predicted = points.map((p) => (probability(p) >= threshold ? 1 : 0))
  const matrix = confusion(
    points.map((p) => p.label),
    predicted,
  )
  const loss = logLoss(points, probability)
  const roc = useMemo(() => rocCurve(points, (p) => sigmoid(w * p.x + b)), [points, w, b])
  const bestFit = useMemo(() => fitLogistic(points), [points])
  const boundary = w !== 0 ? (Math.log(threshold / (1 - threshold)) - b) / w : null
  const positives = points.filter((p) => p.label === 1).length
  const currentRoc = roc.curve.reduce((best, point) => (Math.abs(point.threshold - threshold) < Math.abs(best.threshold - threshold) ? point : best), roc.curve[0])

  const current = {
    label: `w ${w.toFixed(2)}, b ${b.toFixed(2)}, threshold ${threshold.toFixed(2)}`,
    metrics: [
      { label: 'Accuracy', value: fixed(matrix.accuracy) },
      { label: 'Precision', value: fixed(matrix.precision) },
      { label: 'Recall', value: fixed(matrix.recall) },
      { label: 'F1', value: fixed(matrix.f1) },
      { label: 'Log loss', value: fixed(loss) },
      { label: 'AUC', value: fixed(roc.auc) },
    ],
  }

  const fit = () => {
    setW(clamp(Math.round(bestFit.w * 100) / 100, -1, 3))
    setB(clamp(Math.round(bestFit.b * 100) / 100, -12, 4))
  }

  const reset = () => {
    setDataset('overlap')
    setW(0.5)
    setB(-2)
    setThreshold(0.5)
  }

  const save = () =>
    onSaveResult({
      title: `P(pass) = σ(${w.toFixed(2)}·hours ${b >= 0 ? '+' : '−'} ${Math.abs(b).toFixed(2)}) at threshold ${threshold.toFixed(2)} · ${DATASETS.find((d) => d.value === dataset).label}`,
      metrics: current.metrics,
      explanation: `The model predicts a pass for students above ${boundary === null ? 'no boundary (w = 0)' : `${boundary.toFixed(2)} hours`}. It found ${matrix.tp} of ${positives} actual passes (recall ${fixed(matrix.recall)}), and ${matrix.fp} of its pass predictions were wrong (precision ${fixed(matrix.precision)}). ${
        dataset === 'imbalanced' ? `With only ${positives} passes out of ${points.length}, always predicting "fail" would already score ${fixed((points.length - positives) / points.length)} accuracy, so precision and recall are more informative.` : ''
      }`,
    })

  return (
    <>
      <SimPanel
        kicker="FROM SCORES TO PROBABILITIES"
        title="Logistic regression workbench"
        intro="Each dot is a student: hours studied and whether they passed. The curve turns hours into a probability of passing; the threshold turns that probability into a yes/no prediction."
      >
        <div className="lab-sim-controls">
          <Select label="Dataset" value={dataset} onChange={setDataset} options={DATASETS} />
          <Slider label="Weight w" min={-1} max={3} step={0.05} value={w} onChange={setW} digits={2} />
          <Slider label="Bias b" min={-12} max={4} step={0.1} value={b} onChange={setB} digits={2} />
          <Slider label="Threshold" min={0.05} max={0.95} step={0.01} value={threshold} onChange={setThreshold} digits={2} />
          <div className="lab-actions lab-actions-start">
            <button type="button" className="lab-btn lab-btn-primary" onClick={fit}>
              Fit model
            </button>
            <button type="button" className="lab-btn" onClick={reset}>
              <RotateCcw aria-hidden="true" />
              Reset activity
            </button>
          </div>
        </div>
        <MetricGrid metrics={current.metrics} />
        {dataset === 'separable' && (
          <p className="lab-muted">
            On perfectly separable data, unregularised logistic regression never finishes: the weight keeps growing. The fit here uses scikit-learn’s default L2 penalty (C = 1), which keeps it finite.
          </p>
        )}
      </SimPanel>

      <SimPanel title="The sigmoid curve and decision boundary" dark>
        <Legend
          items={[
            { label: 'Passed (label 1)', color: CHART_THEME.accent },
            { label: 'Failed (label 0)', color: CHART_THEME.danger },
            { label: 'P(pass)', color: CHART_THEME.primary },
            { label: 'Decision boundary', color: CHART_THEME.mint },
          ]}
        />
        <div className="lab-chart-box lab-chart-wide">
          <ChartFrame xDomain={[0, 10]} yDomain={[-0.1, 1.1]} xLabel="Hours studied" yLabel="Probability of passing" label="Sigmoid probability curve with student outcomes">
            {({ sx, sy, width, height, pad }) => (
              <>
                <defs>
                  <clipPath id={clipId}>
                    <rect x={pad.left} y={pad.top} width={width - pad.left - pad.right} height={height - pad.top - pad.bottom} />
                  </clipPath>
                </defs>
                <g clipPath={`url(#${clipId})`}>
                  <line x1={sx(0)} x2={sx(10)} y1={sy(threshold)} y2={sy(threshold)} stroke="rgba(203, 213, 225, 0.45)" strokeDasharray="6 5" />
                  {boundary !== null && boundary >= 0 && boundary <= 10 && (
                    <line x1={sx(boundary)} x2={sx(boundary)} y1={sy(-0.1)} y2={sy(1.1)} stroke={CHART_THEME.mint} strokeWidth="2.5" strokeDasharray="8 6" />
                  )}
                  <polyline
                    fill="none"
                    stroke={CHART_THEME.primary}
                    strokeWidth="3"
                    points={Array.from({ length: 101 }, (_, i) => {
                      const x = i / 10
                      return `${sx(x)},${sy(sigmoid(w * x + b))}`
                    }).join(' ')}
                  />
                  {points.map((p, i) => {
                    const jitter = ((i % 5) - 2) * 0.018
                    const wrong = predicted[i] !== p.label
                    return (
                      <circle
                        key={i}
                        cx={sx(p.x)}
                        cy={sy(p.label + (p.label ? -jitter : jitter))}
                        r="6"
                        fill={p.label ? CHART_THEME.accent : CHART_THEME.danger}
                        stroke={wrong ? '#ffffff' : '#030712'}
                        strokeWidth={wrong ? 2.5 : 1.5}
                      >
                        <title>{`${p.x} hours, ${p.label ? 'passed' : 'failed'}, P(pass) = ${probability(p).toFixed(2)}${wrong ? ' (misclassified)' : ''}`}</title>
                      </circle>
                    )
                  })}
                </g>
              </>
            )}
          </ChartFrame>
        </div>
        <p className="lab-muted">
          {boundary === null
            ? 'With w = 0 every student gets the same probability, so there is no boundary.'
            : `Predicted pass for more than ${boundary.toFixed(2)} hours. White rings mark misclassified students.`}
        </p>
      </SimPanel>

      <div className="lab-sim-columns">
        <SimPanel title="Confusion matrix">
          <div className="lab-table-wrap">
            <table className="lab-table lab-confusion">
              <caption className="mz-sr-only">Confusion matrix at the current threshold</caption>
              <thead>
                <tr>
                  <th scope="col">Actual ↓ / Predicted →</th>
                  <th scope="col">Pass</th>
                  <th scope="col">Fail</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Pass</th>
                  <td className="is-good">TP {matrix.tp}</td>
                  <td className="is-bad">FN {matrix.fn}</td>
                </tr>
                <tr>
                  <th scope="row">Fail</th>
                  <td className="is-bad">FP {matrix.fp}</td>
                  <td className="is-good">TN {matrix.tn}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="lab-muted">
            Precision = TP / (TP + FP). Recall = TP / (TP + FN). Lower the threshold to catch more passes (recall up), raise it to be more certain (precision up).
          </p>
        </SimPanel>

        <SimPanel title={`ROC curve · AUC ${fixed(roc.auc)}`}>
          <div className="lab-chart-box">
            <LineChart
              series={[
                { label: 'ROC', points: roc.curve, color: CHART_THEME.violet },
                { label: 'Random guess', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], color: 'rgba(148, 163, 184, 0.6)', dashed: true },
              ]}
              marker={{ x: currentRoc.x, y: currentRoc.y }}
              xLabel="False positive rate"
              yLabel="True positive rate"
              yMin={0}
              label="ROC curve across all thresholds"
            />
          </div>
          <p className="lab-muted">The dot marks your threshold. AUC measures how well the probabilities rank passes above fails, independent of the threshold.</p>
        </SimPanel>
      </div>

      <PinnedComparison pinned={pinned} current={current} />

      <ExplainBox>
        The weight sets how steeply probability rises with study hours and the bias shifts where it rises. Fitting chooses them to minimise log loss.
        The threshold does not change the model, only the trade-off between false positives and false negatives, which is why precision, recall and the ROC curve
        matter more than accuracy on imbalanced data.
      </ExplainBox>

      <SimFooter onPin={() => setPinned(current)} onSave={save} onPython={() => onUsePython(pythonCode(points, threshold))} />
    </>
  )
}
