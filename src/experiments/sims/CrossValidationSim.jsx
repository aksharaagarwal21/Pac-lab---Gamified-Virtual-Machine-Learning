import { useId, useMemo, useState } from 'react'
import { Shuffle } from 'lucide-react'
import { CHART_THEME, ChartFrame, Legend, LineChart } from '../../components/lab/charts.jsx'
import { ExplainBox, MetricGrid, PinnedComparison, SimFooter, SimPanel, Slider, Toggle, fixed, pyList } from '../../components/lab/simKit.jsx'
import { gaussian, kFolds, mean, polyFit, polyPredict, seeded, shuffle, std } from '../../lib/ml.js'

const N = 40
const MAX_DEGREE = 10
const CURVE_CAP = 0.5 // validation-curve values above this are clipped so the chart stays readable
const FOLD_ROWS_SHOWN = 10

const round3 = (v) => Math.round(v * 1000) / 1000

// A cubic trend with noise, x in [−1, 1] so polynomial fits stay numerically stable.
const DATA = (() => {
  const random = seeded(303)
  return Array.from({ length: N }, (_, i) => {
    const x = -1 + (2 * i) / (N - 1)
    return { x: round3(x), y: round3(1.2 * x ** 3 - 0.8 * x + 0.2 * gaussian(random)) }
  })
})()

const mse = (points, coefficients) => mean(points.map((p) => (p.y - polyPredict(coefficients, p.x)) ** 2))

function crossValidate(degree, folds) {
  const scores = folds.map((testIndices) => {
    const test = new Set(testIndices)
    const coefficients = polyFit(
      DATA.filter((_, i) => !test.has(i)),
      degree,
    )
    return mse(
      testIndices.map((i) => DATA[i]),
      coefficients,
    )
  })
  return { scores, mean: mean(scores), std: std(scores) }
}

// Twenty different random 80/20 splits show how much a single hold-out score can vary.
function holdOutSpread(degree) {
  const results = Array.from({ length: 20 }, (_, s) => {
    const order = shuffle(
      DATA.map((_, i) => i),
      seeded(900 + s),
    )
    const cut = Math.round(N * 0.8)
    const coefficients = polyFit(
      order.slice(0, cut).map((i) => DATA[i]),
      degree,
    )
    return mse(
      order.slice(cut).map((i) => DATA[i]),
      coefficients,
    )
  })
  return { min: Math.min(...results), max: Math.max(...results) }
}

function pythonCode(degree, k) {
  return `# k-fold cross-validation for a polynomial model (standard library only)
# Folds are shuffled with Python's random module, so fold scores differ slightly from the simulation.
import random

xs = ${pyList(DATA.map((p) => p.x))}
ys = ${pyList(DATA.map((p) => p.y))}
DEGREE = ${degree}
K = ${k}
random.seed(0)

def fit(points, degree):
    size = degree + 1
    A = [[sum(x ** (r + c) for x, _ in points) + (1e-8 if r == c else 0) for c in range(size)] for r in range(size)]
    b = [sum(y * x ** r for x, y in points) for r in range(size)]
    for col in range(size):
        pivot = max(range(col, size), key=lambda r: abs(A[r][col]))
        A[col], A[pivot] = A[pivot], A[col]
        b[col], b[pivot] = b[pivot], b[col]
        for r in range(size):
            if r != col:
                f = A[r][col] / A[col][col]
                A[r] = [a - f * c for a, c in zip(A[r], A[col])]
                b[r] -= f * b[col]
    return [b[i] / A[i][i] for i in range(size)]

def predict(coefs, x):
    return sum(c * x ** i for i, c in enumerate(coefs))

indices = list(range(len(xs)))
random.shuffle(indices)
folds = [indices[i::K] for i in range(K)]
scores = []
for i, test in enumerate(folds):
    train = [(xs[j], ys[j]) for j in indices if j not in test]
    coefs = fit(train, DEGREE)
    mse = sum((ys[j] - predict(coefs, xs[j])) ** 2 for j in test) / len(test)
    scores.append(mse)
    print(f"fold {i + 1}: MSE = {mse:.4f}")

mean = sum(scores) / K
std = (sum((s - mean) ** 2 for s in scores) / K) ** 0.5
print(f"CV MSE = {mean:.4f} ± {std:.4f}")
`
}

export default function CrossValidationSim({ onSaveResult, onUsePython }) {
  const clipId = useId().replace(/:/g, '')
  const [degree, setDegree] = useState(3)
  const [k, setK] = useState(5)
  const [leaveOneOut, setLeaveOneOut] = useState(false)
  const [seed, setSeed] = useState(1)
  const [selectedFold, setSelectedFold] = useState(0)
  const [pinned, setPinned] = useState(null)

  const folds = useMemo(() => kFolds(N, leaveOneOut ? N : k, seeded(seed)), [k, leaveOneOut, seed])
  const cv = useMemo(() => crossValidate(degree, folds), [degree, folds])
  const trainMse = useMemo(() => mse(DATA, polyFit(DATA, degree)), [degree])
  const spread = useMemo(() => holdOutSpread(degree), [degree])
  const curve = useMemo(
    () =>
      Array.from({ length: MAX_DEGREE }, (_, i) => {
        const d = i + 1
        return { degree: d, train: mse(DATA, polyFit(DATA, d)), cv: crossValidate(d, folds).mean }
      }),
    [folds],
  )
  const bestDegree = curve.reduce((best, row) => (row.cv < best.cv ? row : best), curve[0]).degree

  const fold = Math.min(selectedFold, folds.length - 1)
  const testSet = new Set(folds[fold])
  const foldCoefficients = useMemo(
    () =>
      polyFit(
        DATA.filter((_, i) => !testSet.has(i)),
        degree,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [degree, folds, fold],
  )
  const rowsShown = folds.slice(0, FOLD_ROWS_SHOWN)
  const kLabel = leaveOneOut ? `leave-one-out (${N} folds)` : `${k}-fold`

  const current = {
    label: `degree ${degree}, ${kLabel}`,
    metrics: [
      { label: 'CV MSE (mean)', value: fixed(cv.mean, 4) },
      { label: 'CV MSE (std)', value: fixed(cv.std, 4) },
      { label: 'Training MSE', value: fixed(trainMse, 4) },
      { label: 'Single 80/20 split range', value: `${fixed(spread.min, 3)}–${fixed(spread.max, 3)}` },
    ],
  }

  const verdict =
    degree < bestDegree && cv.mean > curve[bestDegree - 1].cv * 1.2
      ? `Degree ${degree} underfits: both training and validation error are high. Cross-validation prefers degree ${bestDegree}.`
      : degree > bestDegree && cv.mean > curve[bestDegree - 1].cv * 1.2
        ? `Degree ${degree} overfits: training error keeps falling but validation error rises. Cross-validation prefers degree ${bestDegree}.`
        : `Degree ${degree} is close to the best cross-validated choice (degree ${bestDegree}).`

  const save = () =>
    onSaveResult({
      title: `Polynomial degree ${degree} evaluated with ${kLabel} cross-validation`,
      metrics: current.metrics,
      explanation: `${verdict} A single 80/20 split could have reported anywhere from ${fixed(spread.min, 3)} to ${fixed(spread.max, 3)}; averaging over folds gives a steadier estimate of ${fixed(cv.mean, 4)}.`,
    })

  const width = 640
  const labelWidth = 70
  const scoreWidth = 90
  const rowHeight = 26
  const cellWidth = (width - labelWidth - scoreWidth) / N

  return (
    <>
      <SimPanel
        kicker="SPLIT, TRAIN, VALIDATE, REPEAT"
        title="Cross-validation workbench"
        intro="Forty noisy samples follow a cubic curve. Choose a polynomial degree and a number of folds. Every fold takes a turn as the validation set while the model trains on the rest."
      >
        <div className="lab-sim-controls">
          <Slider label="Polynomial degree" min={1} max={MAX_DEGREE} step={1} value={degree} onChange={setDegree} />
          <Slider label="Number of folds (k)" min={2} max={10} step={1} value={k} onChange={setK} disabled={leaveOneOut} />
          <Toggle label="Leave-one-out" checked={leaveOneOut} onChange={setLeaveOneOut} />
          <button
            type="button"
            className="lab-btn"
            onClick={() => {
              setSeed((s) => s + 1)
              setSelectedFold(0)
            }}
          >
            <Shuffle aria-hidden="true" />
            Reshuffle folds
          </button>
        </div>
        <MetricGrid metrics={current.metrics} />
        <p className="lab-p" aria-live="polite">
          {verdict}
        </p>
      </SimPanel>

      <div className="lab-sim-columns">
        <SimPanel title="Fold map" dark>
          <p className="lab-muted">Each row is one round. Pink cells are that round’s validation samples. Select a row to see its fit.</p>
          <div className="lab-chart-box lab-chart-wide">
            <svg className="lab-chart" viewBox={`0 0 ${width} ${rowsShown.length * rowHeight + 8}`} role="img" aria-label={`${kLabel} fold map`}>
              {rowsShown.map((testIndices, row) => {
                const inTest = new Set(testIndices)
                const score = cv.scores[row]
                return (
                  <g key={row} style={{ cursor: 'pointer' }} onClick={() => setSelectedFold(row)}>
                    <text x={0} y={row * rowHeight + 18} className="lab-chart-label" fill={row === fold ? CHART_THEME.accent : undefined}>
                      Fold {row + 1}
                    </text>
                    {DATA.map((_, i) => (
                      <rect
                        key={i}
                        x={labelWidth + i * cellWidth + 1}
                        y={row * rowHeight + 5}
                        width={cellWidth - 2}
                        height={rowHeight - 8}
                        rx="2"
                        fill={inTest.has(i) ? CHART_THEME.danger : 'rgba(34, 211, 238, 0.3)'}
                        stroke={row === fold ? CHART_THEME.accent : 'none'}
                      />
                    ))}
                    <text x={width} y={row * rowHeight + 18} textAnchor="end" className="lab-chart-tick">
                      {Math.min(score, 99).toFixed(3)}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
          {folds.length > FOLD_ROWS_SHOWN && <p className="lab-muted">Showing the first {FOLD_ROWS_SHOWN} of {folds.length} folds.</p>}
        </SimPanel>

        <SimPanel title={`Fit on fold ${fold + 1}`} dark>
          <Legend
            items={[
              { label: 'Training samples', color: CHART_THEME.primary },
              { label: 'Validation samples', color: CHART_THEME.danger },
              { label: `Degree ${degree} fit`, color: CHART_THEME.accent },
            ]}
          />
          <div className="lab-chart-box lab-chart-wide">
            <ChartFrame xDomain={[-1.1, 1.1]} yDomain={[-1.2, 1.2]} xLabel="x" yLabel="y" label={`Polynomial fit for fold ${fold + 1}`}>
              {({ sx, sy, width: w, height: h, pad }) => (
                <>
                  <defs>
                    <clipPath id={clipId}>
                      <rect x={pad.left} y={pad.top} width={w - pad.left - pad.right} height={h - pad.top - pad.bottom} />
                    </clipPath>
                  </defs>
                  <g clipPath={`url(#${clipId})`}>
                    <polyline
                      fill="none"
                      stroke={CHART_THEME.accent}
                      strokeWidth="3"
                      points={Array.from({ length: 121 }, (_, i) => {
                        const x = -1.1 + (2.2 * i) / 120
                        return `${sx(x)},${sy(Math.max(-3, Math.min(3, polyPredict(foldCoefficients, x))))}`
                      }).join(' ')}
                    />
                    {DATA.map((p, i) =>
                      testSet.has(i) ? (
                        <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="6" fill="none" stroke={CHART_THEME.danger} strokeWidth="2.5" />
                      ) : (
                        <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="4.5" fill={CHART_THEME.primary} />
                      ),
                    )}
                  </g>
                </>
              )}
            </ChartFrame>
          </div>
          <p className="lab-muted">Validation MSE on this fold: {fixed(cv.scores[fold], 4)}</p>
        </SimPanel>
      </div>

      <SimPanel kicker="MODEL SELECTION" title="Validation curve">
        <Legend
          items={[
            { label: 'Training MSE', color: CHART_THEME.primary },
            { label: 'Cross-validated MSE', color: CHART_THEME.accent },
          ]}
        />
        <div className="lab-chart-box">
          <LineChart
            series={[
              { label: 'Training MSE', points: curve.map((row) => ({ x: row.degree, y: Math.min(row.train, CURVE_CAP) })), color: CHART_THEME.primary },
              { label: 'Cross-validated MSE', points: curve.map((row) => ({ x: row.degree, y: Math.min(row.cv, CURVE_CAP) })), color: CHART_THEME.accent },
            ]}
            marker={{ x: degree, y: Math.min(cv.mean, CURVE_CAP) }}
            xLabel="Polynomial degree"
            yLabel="MSE"
            yMin={0}
            label="Training and cross-validated MSE for polynomial degrees 1 to 10"
          />
        </div>
        <p className="lab-muted">
          Lowest cross-validated MSE at degree {bestDegree}. Values above {CURVE_CAP} are clipped so the chart stays readable.
        </p>
      </SimPanel>

      <PinnedComparison pinned={pinned} current={current} />

      <ExplainBox>
        Training error always falls as the model gets more flexible, so it cannot choose the degree. Cross-validation scores each setting on data held out
        from training, averaged over k rounds, which exposes overfitting and gives a steadier estimate than one lucky or unlucky split. Larger k uses more data
        for training in each round but costs more fits.
      </ExplainBox>

      <SimFooter onPin={() => setPinned(current)} onSave={save} onPython={() => onUsePython(pythonCode(degree, leaveOneOut ? N : k))} />
    </>
  )
}
