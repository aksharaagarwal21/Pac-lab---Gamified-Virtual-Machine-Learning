import { useId, useMemo, useState } from 'react'
import { FastForward, RotateCcw, SkipForward, StepForward } from 'lucide-react'
import { CHART_THEME, ChartFrame, Legend, LineChart } from '../../components/lab/charts.jsx'
import { ExplainBox, MetricGrid, PinnedComparison, Select, SimFooter, SimPanel, Slider, Toggle, percent, pyList } from '../../components/lab/simKit.jsx'
import { seeded } from '../../lib/ml.js'

const DATASETS = [
  { value: 'and', label: 'AND gate' },
  { value: 'or', label: 'OR gate' },
  { value: 'xor', label: 'XOR gate' },
  { value: 'separable', label: 'Two separable groups' },
  { value: 'narrow', label: 'Groups with a narrow gap' },
  { value: 'overlap', label: 'Overlapping groups' },
]

const INITS = [
  { value: 'zero', label: 'Zero weights' },
  { value: 'poor', label: 'Poor start (w₁ = 1, w₂ = −1, b = 0.5)' },
]

export const INITIAL_WEIGHTS = { zero: [0, 0, 0], poor: [1, -1, 0.5] }
const GATES = new Set(['and', 'or', 'xor'])
const MAX_EPOCHS = 100
const GRID = 28
const r2 = (v) => Math.round(v * 100) / 100
const fmt = (v, digits = 3) => {
  const text = v.toFixed(digits)
  return Number(text) === 0 ? (0).toFixed(digits) : text
}
// A term written after another one, e.g. "+ 0.20" or "− 0.10".
const signed = (v, digits = 2) => `${Number(v.toFixed(digits)) < 0 ? '−' : '+'} ${fmt(Math.abs(v), digits)}`

export function makePerceptronData(kind) {
  const gate = { and: [0, 0, 0, 1], or: [0, 1, 1, 1], xor: [0, 1, 1, 0] }[kind]
  if (gate) {
    return [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ].map(([x, y], i) => ({ x, y, label: gate[i] }))
  }
  const random = seeded({ separable: 101, narrow: 102, overlap: 103 }[kind])
  const points = []
  while (points.length < 40) {
    const x = r2(-3 + 6 * random())
    const y = r2(-3 + 6 * random())
    const distance = (x + y - 0.6) / Math.SQRT2
    const gap = kind === 'separable' ? 0.6 : kind === 'narrow' ? 0.12 : 0
    if (Math.abs(distance) < gap) continue
    let label = distance > 0 ? 1 : 0
    if (kind === 'overlap' && Math.abs(distance) < 0.9 && random() < 0.35) label = 1 - label
    points.push({ x, y, label })
  }
  return points
}

export const predictPerceptron = ([w1, w2, b], p) => (w1 * p.x + w2 * p.y + b >= 0 ? 1 : 0)
export const misclassified = (weights, points) => points.filter((p) => predictPerceptron(weights, p) !== p.label).length

export function freshState(init) {
  return { weights: INITIAL_WEIGHTS[init], index: 0, epoch: 0, epochErrors: 0, history: [], last: null, converged: false }
}

// Process one training sample with the perceptron learning rule.
export function stepSample(points, rate, state) {
  const p = points[state.index]
  const [w1, w2, b] = state.weights
  const z = w1 * p.x + w2 * p.y + b
  const prediction = z >= 0 ? 1 : 0
  const error = p.label - prediction
  const weights = error !== 0 ? [w1 + rate * error * p.x, w2 + rate * error * p.y, b + rate * error] : state.weights
  const epochErrors = state.epochErrors + (error !== 0 ? 1 : 0)
  const last = { index: state.index, z, prediction, error, before: state.weights, after: weights }
  if (state.index + 1 < points.length) return { ...state, weights, index: state.index + 1, epochErrors, last }
  const epoch = state.epoch + 1
  return { ...state, weights, index: 0, epoch, epochErrors: 0, last, history: [...state.history, { x: epoch, y: epochErrors }], converged: epochErrors === 0 }
}

export function runEpoch(points, rate, state) {
  let next = stepSample(points, rate, state)
  while (next.index !== 0) next = stepSample(points, rate, next)
  return next
}

export function trainToConvergence(points, rate, state, limit = MAX_EPOCHS) {
  let next = state
  while (!next.converged && next.epoch < limit) next = runEpoch(points, rate, next)
  return next
}

function boundarySegment([w1, w2, b], [lo, hi]) {
  const clamp = (v) => Math.max(-1e4, Math.min(1e4, v))
  if (Math.abs(w2) > 1e-9) return [{ x: lo, y: clamp(-(w1 * lo + b) / w2) }, { x: hi, y: clamp(-(w1 * hi + b) / w2) }]
  if (Math.abs(w1) > 1e-9) return [{ x: -b / w1, y: lo }, { x: -b / w1, y: hi }]
  return null
}

function NeuronDiagram({ weights, sample }) {
  const [w1, w2, b] = weights
  const inputs = [
    { label: 'x₁', value: sample ? sample.x : null, weight: w1, y: 30 },
    { label: 'x₂', value: sample ? sample.y : null, weight: w2, y: 80 },
    { label: '1', value: null, weight: b, y: 130, bias: true },
  ]
  return (
    <svg className="lab-neuron" viewBox="0 0 340 160" role="img" aria-label={`Perceptron with weights w1 ${fmt(w1)}, w2 ${fmt(w2)} and bias ${fmt(b)}`}>
      {inputs.map((input) => (
        <g key={input.label}>
          <line x1="44" y1={input.y} x2="170" y2="80" stroke={input.weight >= 0 ? CHART_THEME.primary : CHART_THEME.danger} strokeWidth={1.5 + Math.min(Math.abs(input.weight), 4)} opacity="0.8" />
          <circle cx="30" cy={input.y} r="16" fill="#0b1630" stroke="#2a3d66" strokeWidth="2" />
          <text x="30" y={input.y + 4} textAnchor="middle" className="lab-neuron-text">
            {input.value === null ? input.label : input.value}
          </text>
          <text x="104" y={(input.y + 80) / 2 - 6} textAnchor="middle" className="lab-neuron-weight">
            {input.bias ? 'b' : input.label === 'x₁' ? 'w₁' : 'w₂'} = {fmt(input.weight, 2)}
          </text>
        </g>
      ))}
      <circle cx="186" cy="80" r="22" fill="#0b1630" stroke={CHART_THEME.accent} strokeWidth="2.5" />
      <text x="186" y="86" textAnchor="middle" className="lab-neuron-sigma">
        Σ
      </text>
      <line x1="208" y1="80" x2="238" y2="80" stroke="#2a3d66" strokeWidth="2" />
      <rect x="238" y="58" width="48" height="44" rx="8" fill="#0b1630" stroke={CHART_THEME.mint} strokeWidth="2" />
      <path d="M248 90H262V70H276" fill="none" stroke={CHART_THEME.mint} strokeWidth="2.5" />
      <line x1="286" y1="80" x2="316" y2="80" stroke="#2a3d66" strokeWidth="2" />
      <text x="326" y="85" textAnchor="middle" className="lab-neuron-text">
        ŷ
      </text>
    </svg>
  )
}

function pythonCode(points, rate, init) {
  const [w1, w2, b] = INITIAL_WEIGHTS[init]
  return `# Perceptron learning rule from scratch (standard library only).
# Same data, order, learning rate and starting weights as the simulation, so the numbers match exactly.
X1 = ${pyList(points.map((p) => p.x), 2)}
X2 = ${pyList(points.map((p) => p.y), 2)}
LABELS = ${pyList(points.map((p) => p.label))}
RATE = ${Number(rate.toFixed(4))}
MAX_EPOCHS = ${MAX_EPOCHS}
w1, w2, b = ${w1}, ${w2}, ${b}

for epoch in range(1, MAX_EPOCHS + 1):
    errors = 0
    for x1, x2, label in zip(X1, X2, LABELS):
        prediction = 1 if w1 * x1 + w2 * x2 + b >= 0 else 0
        error = label - prediction
        if error != 0:
            errors += 1
            w1 += RATE * error * x1
            w2 += RATE * error * x2
            b += RATE * error
    print(f"epoch {epoch}: mistakes = {errors}, w1 = {w1:.3f}, w2 = {w2:.3f}, b = {b:.3f}")
    if errors == 0:
        print("converged: every training point is classified correctly")
        break
else:
    print(f"no convergence after {MAX_EPOCHS} epochs: the data may not be linearly separable")

correct = sum(1 for x1, x2, label in zip(X1, X2, LABELS) if (1 if w1 * x1 + w2 * x2 + b >= 0 else 0) == label)
print(f"training accuracy: {correct / len(LABELS):.3f}")
`
}

export default function PerceptronSim({ onSaveResult, onUsePython }) {
  const clipId = useId().replace(/:/g, '')
  const arrowId = `${clipId}-arrow`
  const [dataset, setDataset] = useState('and')
  const [logRate, setLogRate] = useState(-1)
  const [init, setInit] = useState('zero')
  const [showRegions, setShowRegions] = useState(true)
  const [state, setState] = useState(() => freshState('zero'))
  const [pinned, setPinned] = useState(null)

  const rate = 10 ** logRate
  const points = useMemo(() => makePerceptronData(dataset), [dataset])
  const gate = GATES.has(dataset)
  const domain = gate ? [-0.5, 1.5] : [-3.5, 3.5]
  const wrong = misclassified(state.weights, points)
  const accuracy = 1 - wrong / points.length
  const limitReached = !state.converged && state.epoch >= MAX_EPOCHS
  const status = state.converged ? `Converged after ${state.epoch} epoch${state.epoch === 1 ? '' : 's'}` : limitReached ? `No convergence in ${MAX_EPOCHS} epochs` : state.epoch || state.last ? 'Training' : 'Ready'

  const reset = (changes = {}) => {
    const next = { dataset, init, ...changes }
    if (changes.dataset) setDataset(changes.dataset)
    if (changes.init) setInit(changes.init)
    setState(freshState(next.init))
  }

  const current = {
    label: `${DATASETS.find((d) => d.value === dataset).label} · η ${fmt(rate, 2)} · ${init === 'zero' ? 'zero start' : 'poor start'}`,
    metrics: [
      { label: 'Epoch', value: String(state.epoch) },
      { label: 'Training accuracy', value: percent(accuracy) },
      { label: 'Misclassified now', value: String(wrong) },
      { label: 'Weights (w₁, w₂, b)', value: state.weights.map((v) => fmt(v, 2)).join(', ') },
      { label: 'Status', value: status },
    ],
  }

  const save = () =>
    onSaveResult({
      title: current.label,
      metrics: current.metrics,
      explanation: `${
        state.converged
          ? `The perceptron found a line that separates the classes after ${state.epoch} epoch${state.epoch === 1 ? '' : 's'}: ${fmt(state.weights[0], 2)}·x₁ ${signed(state.weights[1])}·x₂ ${signed(state.weights[2])} = 0. By the perceptron convergence theorem this is guaranteed whenever such a line exists.`
          : limitReached
            ? `After ${MAX_EPOCHS} epochs it still misclassifies ${wrong} point${wrong === 1 ? '' : 's'}. No straight line can separate this data, so the learning rule keeps correcting mistakes forever; a hidden layer (a multilayer network) is needed.`
            : `Training has run for ${state.epoch} epoch${state.epoch === 1 ? '' : 's'} and ${wrong} point${wrong === 1 ? ' is' : 's are'} still misclassified.`
      }`,
    })

  const sample = points[state.index]
  const lastPoint = state.last ? points[state.last.index] : null
  const segment = boundarySegment(state.weights, domain)
  const previous = state.last && state.last.error !== 0 ? boundarySegment(state.last.before, domain) : null
  const cell = (domain[1] - domain[0]) / GRID

  return (
    <>
      <SimPanel
        kicker="ONE NEURON · ONE STRAIGHT LINE"
        title="Perceptron learning workbench"
        intro="A single artificial neuron adds up weighted inputs and fires (predicts 1) when the total reaches zero. Step through the training samples one at a time: every mistake nudges the weights, which moves and turns the decision line."
      >
        <div className="lab-sim-controls">
          <Select label="Dataset" value={dataset} onChange={(value) => reset({ dataset: value })} options={DATASETS} />
          <Slider label="Learning rate η (log scale)" min={-2} max={0.5} step={0.1} value={logRate} onChange={(value) => { setLogRate(value); setState(freshState(init)) }} format={(v) => fmt(10 ** v, 2)} />
          <Select label="Starting weights" value={init} onChange={(value) => reset({ init: value })} options={INITS} />
          <Toggle label="Shade predicted regions" checked={showRegions} onChange={setShowRegions} />
        </div>
        <div className="lab-actions lab-actions-start">
          <button type="button" className="lab-btn lab-btn-primary" onClick={() => setState(stepSample(points, rate, state))} disabled={state.converged || limitReached}>
            <StepForward aria-hidden="true" />
            Next sample
          </button>
          <button type="button" className="lab-btn" onClick={() => setState(runEpoch(points, rate, state))} disabled={state.converged || limitReached}>
            <SkipForward aria-hidden="true" />
            Run one epoch
          </button>
          <button type="button" className="lab-btn" onClick={() => setState(trainToConvergence(points, rate, state))} disabled={state.converged || limitReached}>
            <FastForward aria-hidden="true" />
            Train until converged
          </button>
          <button type="button" className="lab-btn" onClick={() => reset()}>
            <RotateCcw aria-hidden="true" />
            Reset
          </button>
        </div>
        <MetricGrid metrics={current.metrics} />
      </SimPanel>

      <div className="lab-sim-columns">
        <SimPanel title="Decision line" dark>
          <Legend
            items={[
              { label: 'Class 1', color: CHART_THEME.accent },
              { label: 'Class 0', color: CHART_THEME.danger },
              { label: 'Decision line', color: CHART_THEME.mint },
              { label: 'Next sample (dashed ring)', color: CHART_THEME.primary },
            ]}
          />
          <div className="lab-chart-box">
            <ChartFrame width={440} height={440} xDomain={domain} yDomain={domain} xLabel="Input x₁" yLabel="Input x₂" label="Training points with the perceptron's current decision line">
              {({ sx, sy, width, height, pad }) => {
                const [w1, w2] = state.weights
                const norm = Math.hypot(w1, w2)
                const centre = (domain[0] + domain[1]) / 2
                let arrow = null
                if (norm > 1e-9) {
                  const t = (w1 * centre + w2 * centre + state.weights[2]) / (norm * norm)
                  const foot = { x: centre - t * w1, y: centre - t * w2 }
                  const length = (domain[1] - domain[0]) * 0.14
                  arrow = { from: foot, to: { x: foot.x + (w1 / norm) * length, y: foot.y + (w2 / norm) * length } }
                }
                return (
                  <>
                    <defs>
                      <clipPath id={clipId}>
                        <rect x={pad.left} y={pad.top} width={width - pad.left - pad.right} height={height - pad.top - pad.bottom} />
                      </clipPath>
                      <marker id={arrowId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                        <path d="M0 0L10 5L0 10z" fill={CHART_THEME.mint} />
                      </marker>
                    </defs>
                    <g clipPath={`url(#${clipId})`}>
                      {showRegions &&
                        Array.from({ length: GRID * GRID }, (_, k) => {
                          const i = k % GRID
                          const j = Math.floor(k / GRID)
                          const centreCell = { x: domain[0] + (i + 0.5) * cell, y: domain[0] + (j + 0.5) * cell }
                          return (
                            <rect
                              key={k}
                              x={sx(domain[0] + i * cell)}
                              y={sy(domain[0] + (j + 1) * cell)}
                              width={sx(cell) - sx(0) + 0.5}
                              height={sy(0) - sy(cell) + 0.5}
                              fill={predictPerceptron(state.weights, centreCell) ? CHART_THEME.accent : CHART_THEME.danger}
                              opacity="0.13"
                            />
                          )
                        })}
                      {previous && (
                        <line x1={sx(previous[0].x)} y1={sy(previous[0].y)} x2={sx(previous[1].x)} y2={sy(previous[1].y)} stroke="#94a3b8" strokeWidth="2" strokeDasharray="6 6" />
                      )}
                      {segment && <line x1={sx(segment[0].x)} y1={sy(segment[0].y)} x2={sx(segment[1].x)} y2={sy(segment[1].y)} stroke={CHART_THEME.mint} strokeWidth="3" />}
                      {arrow && <line x1={sx(arrow.from.x)} y1={sy(arrow.from.y)} x2={sx(arrow.to.x)} y2={sy(arrow.to.y)} stroke={CHART_THEME.mint} strokeWidth="2.5" markerEnd={`url(#${arrowId})`} />}
                      {points.map((p, i) => {
                        const isWrong = predictPerceptron(state.weights, p) !== p.label
                        return (
                          <g key={i}>
                            <circle cx={sx(p.x)} cy={sy(p.y)} r={gate ? 12 : 5.5} fill={p.label ? CHART_THEME.accent : CHART_THEME.danger} stroke={isWrong ? '#ffffff' : '#030712'} strokeWidth={isWrong ? 2.5 : 1.5} />
                            {gate && (
                              <text x={sx(p.x)} y={sy(p.y) + 4} textAnchor="middle" className="lab-neuron-text" fill="#030712">
                                {p.label}
                              </text>
                            )}
                            <title>{`(${p.x}, ${p.y}) label ${p.label}${isWrong ? ', misclassified' : ''}`}</title>
                          </g>
                        )
                      })}
                      {lastPoint && <circle cx={sx(lastPoint.x)} cy={sy(lastPoint.y)} r={gate ? 18 : 10} fill="none" stroke="#ffffff" strokeWidth="2" />}
                      {!state.converged && sample && (
                        <circle cx={sx(sample.x)} cy={sy(sample.y)} r={gate ? 22 : 13} fill="none" stroke={CHART_THEME.primary} strokeWidth="2.5" strokeDasharray="5 4" />
                      )}
                    </g>
                  </>
                )
              }}
            </ChartFrame>
          </div>
          <p className="lab-muted">
            The arrow is the weight vector (w₁, w₂): it is perpendicular to the line and points towards the class 1 side. White rings mark misclassified points; the grey dashed line is the position before the last update.
          </p>
        </SimPanel>

        <SimPanel title="Inside the neuron" dark>
          <NeuronDiagram weights={state.weights} sample={lastPoint} />
          <div className="lab-update" aria-live="polite">
            {state.last ? (
              <>
                <p>
                  Sample {state.last.index + 1}: x = ({lastPoint.x}, {lastPoint.y}), label y = {lastPoint.label}
                </p>
                <p>
                  z = {fmt(state.last.before[0], 2)}·{lastPoint.x} {signed(state.last.before[1])}·{lastPoint.y} {signed(state.last.before[2])} = {fmt(state.last.z)}
                </p>
                <p>
                  ŷ = step(z) = {state.last.prediction} → error = y − ŷ = {state.last.error}
                </p>
                {state.last.error !== 0 ? (
                  <p className="is-update">
                    Update with η = {fmt(rate, 2)}: w₁ = {fmt(state.last.after[0])}, w₂ = {fmt(state.last.after[1])}, b = {fmt(state.last.after[2])}
                  </p>
                ) : (
                  <p className="is-correct">Correct prediction: the weights stay the same.</p>
                )}
              </>
            ) : (
              <p>Press “Next sample” to feed the first training point through the neuron.</p>
            )}
          </div>

          <p className="lab-question-text">Mistakes in each epoch</p>
          {state.history.length ? (
            <div className="lab-chart-box">
              <LineChart
                series={[{ label: 'Mistakes', points: state.history, color: CHART_THEME.accent }]}
                marker={state.history[state.history.length - 1]}
                xLabel="Epoch"
                yLabel="Mistakes"
                yMin={0}
                label="Number of training mistakes made in each epoch"
              />
            </div>
          ) : (
            <p className="lab-muted">An epoch is one pass through all {points.length} training samples. The chart appears after the first epoch.</p>
          )}
        </SimPanel>
      </div>

      <PinnedComparison pinned={pinned} current={current} />

      <ExplainBox>
        The perceptron predicts 1 when w₁x₁ + w₂x₂ + b ≥ 0, so its decision boundary is always a straight line. Whenever it makes a mistake it adds
        η·(y − ŷ)·x to the weights, tilting the line towards the misclassified point. If some line separates the classes (AND, OR, separable groups), the
        mistakes are guaranteed to stop after a finite number of updates. If none exists (XOR, overlapping groups), they never stop, which is why networks
        need hidden layers.
      </ExplainBox>

      <SimFooter onPin={() => setPinned(current)} onSave={save} onPython={() => onUsePython(pythonCode(points, rate, init))} />
    </>
  )
}
