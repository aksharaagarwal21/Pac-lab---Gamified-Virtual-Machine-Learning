import { useId, useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { CHART_THEME, ChartFrame, Legend, LineChart } from '../../components/lab/charts.jsx'
import { ExplainBox, MetricGrid, PinnedComparison, Select, SimFooter, SimPanel, Slider, Toggle, fixed, percent, pyList } from '../../components/lab/simKit.jsx'
import { gaussian, linearKernel, rbfKernel, seeded, trainSvm } from '../../lib/ml.js'

const DATASETS = [
  { value: 'separable', label: 'Linearly separable' },
  { value: 'outlier', label: 'Separable with one outlier' },
  { value: 'overlap', label: 'Overlapping classes' },
  { value: 'circles', label: 'Concentric circles' },
]

const KERNELS = [
  { value: 'linear', label: 'Linear' },
  { value: 'rbf', label: 'RBF (Gaussian)' },
]

const CLASSES = [
  { value: '1', label: 'Class +1 (yellow)' },
  { value: '0', label: 'Class −1 (pink)' },
]

const EXTENT = 3.6
const GRID = 44
const MAX_ADDED = 20
const r2 = (v) => Math.round(v * 100) / 100

// Sixty labelled points (label 1 = class +1, label 0 = class −1). Seed 61 is the training set, 62 the test set.
export function makeSvmData(kind, seed) {
  const random = seeded(seed)
  return Array.from({ length: 60 }, (_, i) => {
    const label = i % 2
    const g = () => gaussian(random)
    if (kind === 'overlap') {
      const c = label ? [0.8, 0.6] : [-0.8, -0.6]
      return { x: r2(c[0] + 0.95 * g()), y: r2(c[1] + 0.95 * g()), label }
    }
    if (kind === 'circles') {
      const angle = random() * Math.PI * 2
      const radius = label ? 0.2 + random() * 1.1 : 2.0 + random() * 1.0
      return { x: r2(radius * Math.cos(angle) + 0.35 * g()), y: r2(radius * Math.sin(angle) + 0.35 * g()), label }
    }
    if (kind === 'outlier' && seed === 61 && i === 1) return { x: -1.6, y: -0.2, label: 1 }
    const c = label ? [1.4, 1.0] : [-1.4, -1.0]
    return { x: r2(c[0] + 0.6 * g()), y: r2(c[1] + 0.6 * g()), label }
  })
}

export function fitSvm(points, kernel, C, gamma) {
  return trainSvm(points, C, { kernel: kernel === 'rbf' ? rbfKernel(gamma) : linearKernel, maxIterations: 600 })
}

export const svmAccuracy = (model, points) => points.filter((p) => (model.decision(p) >= 0 ? 1 : 0) === p.label).length / points.length

export const formatParam = (value) => (value >= 10 ? value.toFixed(0) : value >= 1 ? value.toFixed(1) : value >= 0.1 ? value.toFixed(2) : value.toFixed(3))

// Where each training point sits relative to the margin, using the functional margin y·f(x).
function marginRoles(model, points) {
  const roles = { outside: 0, onMargin: 0, inside: 0, wrong: 0 }
  points.forEach((p) => {
    const m = (p.label ? 1 : -1) * model.decision(p)
    if (m < 0) roles.wrong++
    else if (m < 0.95) roles.inside++
    else if (m <= 1.05) roles.onMargin++
    else roles.outside++
  })
  return roles
}

// Marching squares: line segments where the decision function crosses `level`.
function contourPath(values, level, toX, toY) {
  let path = ''
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      const corners = [
        [i, j],
        [i + 1, j],
        [i + 1, j + 1],
        [i, j + 1],
      ]
      const hits = []
      for (let e = 0; e < 4; e++) {
        const [ai, aj] = corners[e]
        const [bi, bj] = corners[(e + 1) % 4]
        const va = values[ai][aj] - level
        const vb = values[bi][bj] - level
        if (va * vb < 0) {
          const t = va / (va - vb)
          hits.push([toX(ai + t * (bi - ai)), toY(aj + t * (bj - aj))])
        }
      }
      for (let h = 0; h + 1 < hits.length; h += 2) {
        path += `M${hits[h][0].toFixed(1)} ${hits[h][1].toFixed(1)}L${hits[h + 1][0].toFixed(1)} ${hits[h + 1][1].toFixed(1)}`
      }
    }
  }
  return path
}

function pythonCode(train, test, kernel, C, gamma) {
  return `# Soft-margin SVM trained with simplified SMO (standard library only).
# SMO picks partners at random, so numbers can differ slightly from the simulation.
import math
import random

random.seed(1)
train_x1 = ${pyList(train.map((p) => p.x), 2)}
train_x2 = ${pyList(train.map((p) => p.y), 2)}
train_label = ${pyList(train.map((p) => p.label))}
test_x1 = ${pyList(test.map((p) => p.x), 2)}
test_x2 = ${pyList(test.map((p) => p.y), 2)}
test_label = ${pyList(test.map((p) => p.label))}
KERNEL = "${kernel}"
C = ${Number(C.toFixed(4))}
GAMMA = ${Number(gamma.toFixed(4))}

def kernel(p, q):
    if KERNEL == "linear":
        return p[0] * q[0] + p[1] * q[1]
    return math.exp(-GAMMA * ((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2))

X = list(zip(train_x1, train_x2))
y = [1 if label == 1 else -1 for label in train_label]
n = len(X)
K = [[kernel(a, b) for b in X] for a in X]
alpha = [0.0] * n
b = 0.0

def f_train(i):
    return b + sum(alpha[k] * y[k] * K[k][i] for k in range(n) if alpha[k] > 0)

passes = iterations = 0
while passes < 15 and iterations < 200:
    iterations += 1
    changed = 0
    for i in range(n):
        Ei = f_train(i) - y[i]
        if not ((y[i] * Ei < -1e-3 and alpha[i] < C) or (y[i] * Ei > 1e-3 and alpha[i] > 0)):
            continue
        j = random.randrange(n - 1)
        j += j >= i
        Ej = f_train(j) - y[j]
        ai, aj = alpha[i], alpha[j]
        if y[i] != y[j]:
            L, H = max(0, aj - ai), min(C, C + aj - ai)
        else:
            L, H = max(0, ai + aj - C), min(C, ai + aj)
        eta = 2 * K[i][j] - K[i][i] - K[j][j]
        if L == H or eta >= 0:
            continue
        alpha[j] = min(H, max(L, aj - y[j] * (Ei - Ej) / eta))
        if abs(alpha[j] - aj) < 1e-6:
            continue
        alpha[i] = ai + y[i] * y[j] * (aj - alpha[j])
        b1 = b - Ei - y[i] * (alpha[i] - ai) * K[i][i] - y[j] * (alpha[j] - aj) * K[i][j]
        b2 = b - Ej - y[i] * (alpha[i] - ai) * K[i][j] - y[j] * (alpha[j] - aj) * K[j][j]
        b = b1 if 0 < alpha[i] < C else b2 if 0 < alpha[j] < C else (b1 + b2) / 2
        changed += 1
    passes = passes + 1 if changed == 0 else 0

def decision(point):
    return b + sum(alpha[k] * y[k] * kernel(X[k], point) for k in range(n) if alpha[k] > 1e-6)

def accuracy(x1, x2, labels):
    return sum(1 for p, t in zip(zip(x1, x2), labels) if (1 if decision(p) >= 0 else 0) == t) / len(labels)

print("kernel:", KERNEL, "C:", C, "gamma:", GAMMA if KERNEL == "rbf" else "not used")
print("support vectors:", sum(1 for a in alpha if a > 1e-6))
print("training accuracy:", round(accuracy(train_x1, train_x2, train_label), 3))
print("test accuracy:", round(accuracy(test_x1, test_x2, test_label), 3))
if KERNEL == "linear":
    w = [sum(alpha[k] * y[k] * X[k][d] for k in range(n)) for d in range(2)]
    print("w:", [round(v, 3) for v in w], "b:", round(b, 3), "margin width:", round(2 / math.hypot(*w), 3))
`
}

export default function SvmSim({ onSaveResult, onUsePython }) {
  const clipId = useId().replace(/:/g, '')
  const [dataset, setDataset] = useState('separable')
  const [kernel, setKernel] = useState('linear')
  const [logC, setLogC] = useState(0)
  const [logGamma, setLogGamma] = useState(-0.3)
  const [addClass, setAddClass] = useState('1')
  const [added, setAdded] = useState([])
  const [showMargin, setShowMargin] = useState(true)
  const [showSupport, setShowSupport] = useState(true)
  const [showTest, setShowTest] = useState(false)
  const [pinned, setPinned] = useState(null)

  const C = 10 ** logC
  const gamma = 10 ** logGamma
  const base = useMemo(() => makeSvmData(dataset, 61), [dataset])
  const test = useMemo(() => makeSvmData(dataset, 62), [dataset])
  const train = useMemo(() => [...base, ...added], [base, added])
  const model = useMemo(() => fitSvm(train, kernel, C, gamma), [train, kernel, C, gamma])

  const trainAccuracy = svmAccuracy(model, train)
  const testAccuracy = svmAccuracy(model, test)
  const roles = marginRoles(model, train)
  const supportKeys = useMemo(() => new Set(model.supportVectors), [model])

  const grid = useMemo(() => {
    const step = (2 * EXTENT) / GRID
    return Array.from({ length: GRID + 1 }, (_, i) => Array.from({ length: GRID + 1 }, (_, j) => model.decision({ x: -EXTENT + i * step, y: -EXTENT + j * step })))
  }, [model])

  const sweep = useMemo(() => {
    const trainCurve = []
    const testCurve = []
    for (let exponent = -2; exponent <= 2.001; exponent += 0.25) {
      const m = fitSvm(train, kernel, 10 ** exponent, gamma)
      trainCurve.push({ x: exponent, y: 100 * svmAccuracy(m, train) })
      testCurve.push({ x: exponent, y: 100 * svmAccuracy(m, test) })
    }
    return { trainCurve, testCurve }
  }, [train, test, kernel, gamma])

  const current = {
    label: `${kernel === 'rbf' ? `RBF γ ${formatParam(gamma)}` : 'Linear'} · C ${formatParam(C)} · ${DATASETS.find((d) => d.value === dataset).label}`,
    metrics: [
      { label: 'Training accuracy', value: percent(trainAccuracy) },
      { label: 'Test accuracy', value: percent(testAccuracy) },
      { label: 'Support vectors', value: String(model.supportVectors.length) },
      { label: 'Margin violations', value: String(roles.inside + roles.wrong) },
      { label: 'Margin width', value: kernel === 'linear' && Number.isFinite(model.marginWidth) ? fixed(model.marginWidth, 3) : '—' },
    ],
  }

  const addPoint = (x, y) => {
    if (added.length >= MAX_ADDED) return
    setAdded([...added, { x: r2(x), y: r2(y), label: Number(addClass) }])
  }

  const save = () =>
    onSaveResult({
      title: `${current.label}${added.length ? ` · ${added.length} added point${added.length === 1 ? '' : 's'}` : ''}`,
      metrics: current.metrics,
      explanation: `The boundary is defined by ${model.supportVectors.length} support vectors; ${roles.inside + roles.wrong} training points sit inside the margin or on the wrong side. ${
        testAccuracy < trainAccuracy - 0.1
          ? `Training accuracy (${percent(trainAccuracy)}) is well above test accuracy (${percent(testAccuracy)}), a sign the boundary is fitting noise: try a smaller C${kernel === 'rbf' ? ' or γ' : ''}.`
          : dataset === 'circles' && kernel === 'linear'
            ? 'A straight line cannot separate a ring from its centre, so the linear kernel underfits; the RBF kernel can bend the boundary.'
            : `Test accuracy (${percent(testAccuracy)}) is close to training accuracy, so this setting generalises well.`
      }`,
    })

  const step = (2 * EXTENT) / GRID

  return (
    <>
      <SimPanel
        kicker="WIDEST STREET BETWEEN TWO CLASSES"
        title="Support vector machine workbench"
        intro="Sixty training points from two classes. The SVM retrains instantly: the solid line is the decision boundary, the dashed lines are the edges of the margin, and ringed points are the support vectors that hold the boundary in place."
      >
        <div className="lab-sim-controls">
          <Select label="Dataset" value={dataset} onChange={(value) => { setDataset(value); setAdded([]) }} options={DATASETS} />
          <Select label="Kernel" value={kernel} onChange={setKernel} options={KERNELS} />
          <Slider label="Penalty C (log scale)" min={-2} max={2} step={0.1} value={logC} onChange={setLogC} format={(v) => formatParam(10 ** v)} />
          <Slider label="RBF γ (log scale)" min={-2} max={2} step={0.1} value={logGamma} onChange={setLogGamma} format={(v) => formatParam(10 ** v)} disabled={kernel !== 'rbf'} />
          <Select label="Clicking the plot adds" value={addClass} onChange={setAddClass} options={CLASSES} />
          <div className="lab-actions lab-actions-start">
            <button type="button" className="lab-btn" onClick={() => setAdded([])} disabled={!added.length}>
              <Trash2 aria-hidden="true" />
              Clear added points
            </button>
          </div>
          <Toggle label="Show margin" checked={showMargin} onChange={setShowMargin} />
          <Toggle label="Ring support vectors" checked={showSupport} onChange={setShowSupport} />
          <Toggle label="Show test points" checked={showTest} onChange={setShowTest} />
        </div>
        <MetricGrid metrics={current.metrics} />
        {kernel !== 'rbf' && <p className="lab-muted">γ only affects the RBF kernel; switch the kernel to use it.</p>}
      </SimPanel>

      <div className="lab-sim-columns">
        <SimPanel title="Decision boundary and margin" dark>
          <Legend
            items={[
              { label: 'Class +1', color: CHART_THEME.accent },
              { label: 'Class −1', color: CHART_THEME.danger },
              { label: 'Boundary f(x) = 0', color: CHART_THEME.mint },
              { label: 'Margin f(x) = ±1', color: '#cbd5e1' },
            ]}
          />
          <div className="lab-chart-box">
            <ChartFrame
              width={440}
              height={440}
              xDomain={[-EXTENT, EXTENT]}
              yDomain={[-EXTENT, EXTENT]}
              xLabel="Feature x₁"
              yLabel="Feature x₂"
              label="Training points with the SVM decision regions, boundary and margin. Click to add a point."
              onPointer={addPoint}
            >
              {({ sx, sy, width, height, pad }) => {
                const toX = (i) => sx(-EXTENT + i * step)
                const toY = (j) => sy(-EXTENT + j * step)
                const cells = []
                for (let i = 0; i < GRID; i++) {
                  for (let j = 0; j < GRID; j++) {
                    const value = (grid[i][j] + grid[i + 1][j] + grid[i][j + 1] + grid[i + 1][j + 1]) / 4
                    cells.push(
                      <rect
                        key={`${i}-${j}`}
                        x={toX(i)}
                        y={toY(j + 1)}
                        width={toX(i + 1) - toX(i) + 0.5}
                        height={toY(j) - toY(j + 1) + 0.5}
                        fill={value >= 0 ? CHART_THEME.accent : CHART_THEME.danger}
                        opacity={0.06 + 0.16 * Math.min(Math.abs(value), 1)}
                      />,
                    )
                  }
                }
                return (
                  <>
                    <defs>
                      <clipPath id={clipId}>
                        <rect x={pad.left} y={pad.top} width={width - pad.left - pad.right} height={height - pad.top - pad.bottom} />
                      </clipPath>
                    </defs>
                    <g clipPath={`url(#${clipId})`} style={{ cursor: 'crosshair' }}>
                      <g>{cells}</g>
                      {showMargin && (
                        <>
                          <path d={contourPath(grid, 1, toX, toY)} stroke="#cbd5e1" strokeWidth="1.6" strokeDasharray="6 5" fill="none" />
                          <path d={contourPath(grid, -1, toX, toY)} stroke="#cbd5e1" strokeWidth="1.6" strokeDasharray="6 5" fill="none" />
                        </>
                      )}
                      <path d={contourPath(grid, 0, toX, toY)} stroke={CHART_THEME.mint} strokeWidth="3" fill="none" strokeLinecap="round" />
                      {showTest &&
                        test.map((p, i) => (
                          <circle key={`t${i}`} cx={sx(p.x)} cy={sy(p.y)} r="4.5" fill="none" stroke={p.label ? CHART_THEME.accent : CHART_THEME.danger} strokeWidth="1.6" opacity="0.8" />
                        ))}
                      {train.map((p, i) => {
                        const support = showSupport && supportKeys.has(p)
                        const wrong = (model.decision(p) >= 0 ? 1 : 0) !== p.label
                        const isAdded = i >= base.length
                        return (
                          <g key={i}>
                            {support && <circle cx={sx(p.x)} cy={sy(p.y)} r="10" fill="none" stroke="#ffffff" strokeWidth="2" />}
                            {isAdded ? (
                              <rect x={sx(p.x) - 5.5} y={sy(p.y) - 5.5} width="11" height="11" fill={p.label ? CHART_THEME.accent : CHART_THEME.danger} stroke="#030712" strokeWidth="1.5" transform={`rotate(45 ${sx(p.x)} ${sy(p.y)})`} />
                            ) : (
                              <circle cx={sx(p.x)} cy={sy(p.y)} r="5.5" fill={p.label ? CHART_THEME.accent : CHART_THEME.danger} stroke={wrong ? '#ffffff' : '#030712'} strokeWidth={wrong ? 2.5 : 1.5} />
                            )}
                            <title>{`(${p.x}, ${p.y}) class ${p.label ? '+1' : '−1'}, f(x) = ${model.decision(p).toFixed(2)}${support ? ', support vector' : ''}${wrong ? ', misclassified' : ''}`}</title>
                          </g>
                        )
                      })}
                    </g>
                  </>
                )
              }}
            </ChartFrame>
          </div>
          <p className="lab-muted">
            Click inside the plot to add a point (diamonds, up to {MAX_ADDED}). Adding a point far from the margin changes nothing; adding one inside the margin moves the boundary.
            {showTest ? ' Hollow circles are unseen test points.' : ''}
          </p>
        </SimPanel>

        <SimPanel title="Where the training points sit" dark>
          <div className="lab-bars">
            {[
              { label: 'Outside the margin (y·f > 1)', value: roles.outside, color: CHART_THEME.primary },
              { label: 'On the margin (y·f ≈ 1)', value: roles.onMargin, color: CHART_THEME.mint },
              { label: 'Inside the margin (0 ≤ y·f < 1)', value: roles.inside, color: CHART_THEME.violet },
              { label: 'Misclassified (y·f < 0)', value: roles.wrong, color: CHART_THEME.danger },
            ].map((row) => (
              <div key={row.label}>
                <div className="lab-bar-top">
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </div>
                <div className="lab-bar" aria-hidden="true">
                  <span style={{ width: `${(100 * row.value) / train.length}%`, background: row.color }} />
                </div>
              </div>
            ))}
          </div>
          <p className="lab-muted">Only points on or inside the margin have hinge loss max(0, 1 − y·f(x)) above zero, and only they can be support vectors.</p>

          <p className="lab-question-text">Accuracy as C changes</p>
          <div className="lab-chart-box">
            <LineChart
              series={[
                { label: 'Training accuracy', points: sweep.trainCurve, color: CHART_THEME.primary },
                { label: 'Test accuracy', points: sweep.testCurve, color: CHART_THEME.accent, dashed: true },
              ]}
              marker={{ x: logC, y: 100 * testAccuracy }}
              xLabel="log₁₀ C"
              yLabel="Accuracy (%)"
              yMin={0}
              label="Training and test accuracy across values of C"
            />
          </div>
          <Legend
            items={[
              { label: 'Training', color: CHART_THEME.primary },
              { label: 'Test (dashed)', color: CHART_THEME.accent },
            ]}
          />
        </SimPanel>
      </div>

      <PinnedComparison pinned={pinned} current={current} />

      <ExplainBox>
        An SVM keeps the widest possible street between the classes. C sets the price of a point inside the street: a small C accepts violations for a wider,
        steadier margin, a large C narrows the street to fit every training point. Kernels let the boundary bend. The RBF kernel compares points by distance, and
        γ decides how far each point’s influence reaches: too small and the boundary is almost straight, too large and it wraps around individual points.
      </ExplainBox>

      <SimFooter onPin={() => setPinned(current)} onSave={save} onPython={() => onUsePython(pythonCode(train, test, kernel, C, gamma))} />
    </>
  )
}
