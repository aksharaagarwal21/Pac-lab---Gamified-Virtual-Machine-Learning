// Cross Validation Maze — the real machine learning behind the game.
// Everything the game shows (hits, misses, fold scores, CV score) is computed here with
// genuine k-fold cross-validation on Experiment 3's dataset: forty noisy samples of a cubic.

import { gaussian, kFolds, mean, seeded, shuffle, solve, std } from '../../../lib/ml.js'

export const N = 40
export const NOISE = 0.2
// A prediction "survives" a sample (counts as correct) when |actual − predicted| ≤ TOLERANCE.
export const TOLERANCE = 0.25
export const DEFAULT_SEED = 1

const round3 = (v) => Math.round(v * 1000) / 1000
export const trend = (x) => 1.2 * x ** 3 - 0.8 * x

// Same generator and seed as the Experiment 3 workbench, so both activities share one dataset.
export const DATA = (() => {
  const random = seeded(303)
  return Array.from({ length: N }, (_, i) => {
    const x = round3(-1 + (2 * i) / (N - 1))
    return { id: i + 1, x, y: round3(1.2 * x ** 3 - 0.8 * x + NOISE * gaussian(random)) }
  })
})()

export const K_OPTIONS = [
  { k: 3, tag: 'EASY' },
  { k: 5, tag: 'NORMAL' },
  { k: 10, tag: 'ADVANCED' },
]

export const MODELS = {
  simple: {
    id: 'simple',
    name: 'Simple',
    degree: 1,
    kind: 'Straight line · degree 1',
    blurb: 'A shallow model. Too rigid to bend with the curve.',
  },
  balanced: {
    id: 'balanced',
    name: 'Balanced',
    degree: 3,
    kind: 'Cubic curve · degree 3',
    blurb: 'A reasonable model. Flexible enough to follow the trend.',
  },
  overfit: {
    id: 'overfit',
    name: 'Overfitted',
    degree: 20,
    kind: 'Wiggly curve · degree 20',
    blurb: 'A high-complexity model. Bends to chase every training point.',
  },
}
export const MODEL_ORDER = ['simple', 'balanced', 'overfit']

// Enemy types describe how hard a sample is, based on the data itself.
export const ENEMIES = {
  typical: { name: 'Normal ghost', meaning: 'Typical sample close to the trend' },
  noisy: { name: 'Glitch ghost', meaning: 'Noisy sample: its y sits far from the trend' },
  edge: { name: 'Edge ghost', meaning: 'Unusual sample at the edge of the x range' },
}

export function sampleKind(point) {
  if (Math.abs(point.y - trend(point.x)) > 1.5 * NOISE) return 'noisy'
  if (Math.abs(point.x) >= 0.85) return 'edge'
  return 'typical'
}

export const POINTS = { correct: 100, foldClear: 500, stability: 1000, quiz: 200 }

// ---------- Polynomial model ----------
// Least squares in the Legendre basis: the same polynomials as the workbench, but numerically
// stable enough for the degree-20 "Overfitted" model. A tiny ridge term keeps the solve well posed.

function legendre(x, degree) {
  const p = [1, x]
  for (let n = 1; n < degree; n++) p.push(((2 * n + 1) * x * p[n] - n * p[n - 1]) / (n + 1))
  return p.slice(0, degree + 1)
}

export function fitPolynomial(points, degree) {
  const size = degree + 1
  const gram = Array.from({ length: size }, () => Array(size).fill(0))
  const rhs = Array(size).fill(0)
  for (const point of points) {
    const f = legendre(point.x, degree)
    for (let r = 0; r < size; r++) {
      rhs[r] += f[r] * point.y
      for (let c = 0; c < size; c++) gram[r][c] += f[r] * f[c]
    }
  }
  for (let d = 0; d < size; d++) gram[d][d] += 1e-3
  return solve(gram, rhs)
}

export const predictAt = (coefficients, x) => legendre(x, coefficients.length - 1).reduce((sum, value, i) => sum + value * coefficients[i], 0)

function evaluate(points, coefficients) {
  const rows = points.map((point) => {
    const predicted = predictAt(coefficients, point.x)
    const error = point.y - predicted
    return { ...point, predicted, error, correct: Math.abs(error) <= TOLERANCE }
  })
  return {
    rows,
    hitRate: mean(rows.map((row) => (row.correct ? 1 : 0))),
    mse: mean(rows.map((row) => row.error ** 2)),
  }
}

// ---------- Game balance tied to the data ----------

// Lives per unseen zone: roughly 40% of its samples may be missed before the model "crashes".
export const livesFor = (testCount) => Math.ceil(testCount * 0.4) + 1

export function starsFor(accuracy) {
  if (accuracy >= 0.9) return 5
  if (accuracy >= 0.75) return 4
  if (accuracy >= 0.6) return 3
  if (accuracy >= 0.4) return 2
  return accuracy > 0 ? 1 : 0
}

// Spread of fold scores in percentage points → an arcade stability meter.
export function stabilityOf(scores) {
  const spread = std(scores) * 100
  const level = Math.max(0.05, Math.min(1, 1 - spread / 30))
  if (spread <= 6) return { spread, level, label: 'VERY STABLE', bonus: true }
  if (spread <= 12) return { spread, level, label: 'STABLE', bonus: true }
  if (spread <= 20) return { spread, level, label: 'MODERATE VARIATION', bonus: false }
  return { spread, level, label: 'HIGH VARIANCE', bonus: false }
}

// Compares the training score with the cross-validated score.
export function diagnose(trainScore, cvScore) {
  const gap = trainScore - cvScore
  if (gap >= 0.15) return { id: 'overfit', label: 'OVERFITTING!', gap }
  if (trainScore < 0.65 && cvScore < 0.65) return { id: 'underfit', label: 'UNDERFITTING', gap }
  return { id: 'good', label: 'GOOD GENERALIZATION', gap }
}

// ---------- k-fold cross-validation plan ----------

export function runCrossValidation({ k = 5, modelId = 'balanced', seed = DEFAULT_SEED } = {}) {
  const model = MODELS[modelId]
  const folds = kFolds(N, k, seeded(seed)).map((indices, fold) => {
    const testIdx = [...indices].sort((a, b) => a - b)
    const hidden = new Set(testIdx)
    const trainIdx = DATA.map((_, i) => i).filter((i) => !hidden.has(i))
    const coefficients = fitPolynomial(
      trainIdx.map((i) => DATA[i]),
      model.degree,
    )
    const train = evaluate(
      trainIdx.map((i) => DATA[i]),
      coefficients,
    )
    const test = evaluate(
      testIdx.map((i) => DATA[i]),
      coefficients,
    )
    const samples = test.rows.map((row) => ({ ...row, kind: sampleKind(row) }))
    const correct = samples.filter((s) => s.correct).length
    return {
      fold,
      testIdx,
      trainIdx,
      coefficients,
      trainScore: train.hitRate,
      trainMse: train.mse,
      samples,
      correct,
      wrong: samples.length - correct,
      score: test.hitRate,
      mse: test.mse,
    }
  })
  return { k, modelId, degree: model.degree, seed, folds, summary: summarize(folds) }
}

export function summarize(folds) {
  const scores = folds.map((f) => f.score)
  const mses = folds.map((f) => f.mse)
  const trainScore = mean(folds.map((f) => f.trainScore))
  const cvScore = mean(scores)
  return {
    scores,
    cvScore,
    cvStd: std(scores),
    cvMse: mean(mses),
    cvMseStd: std(mses),
    trainScore,
    trainMse: mean(folds.map((f) => f.trainMse)),
    stability: stabilityOf(scores),
    diagnosis: diagnose(trainScore, cvScore),
  }
}

// ---------- Bonus level: many single 80/20 splits ----------

export function luckySplit(modelId, trials = 200) {
  const degree = MODELS[modelId].degree
  const testCount = Math.round(N * 0.2)
  const splits = Array.from({ length: trials }, (_, t) => {
    const order = shuffle(
      DATA.map((_, i) => i),
      seeded(5000 + t),
    )
    const coefficients = fitPolynomial(
      order.slice(testCount).map((i) => DATA[i]),
      degree,
    )
    return evaluate(
      order.slice(0, testCount).map((i) => DATA[i]),
      coefficients,
    ).hitRate
  })
  const best = Math.max(...splits)
  const buckets = Array.from({ length: testCount + 1 }, (_, hits) => ({
    score: hits / testCount,
    count: splits.filter((s) => Math.round(s * testCount) === hits).length,
  }))
  return { trials, testCount, best, worst: Math.min(...splits), mean: mean(splits), buckets }
}

// ---------- Mini quiz ----------

export const QUIZ = [
  {
    q: 'In 5-Fold Cross Validation, how many folds train the model during one round?',
    options: ['1', '2', '4', '5'],
    answer: 2,
    explain: 'One fold is the unseen test zone, so the other k − 1 = 4 folds train the model.',
  },
  {
    q: 'Why does the test zone change every round?',
    options: ['To increase training speed', 'To evaluate different unseen samples', 'To create more features', 'To change the labels'],
    answer: 1,
    explain: 'Each round tests on a different fold, so every sample is used as unseen data exactly once.',
  },
  {
    q: 'Training accuracy = 99%, CV accuracy = 62%. What is happening?',
    options: ['Perfect generalization', 'Overfitting', 'Strong validation', 'Feature scaling'],
    answer: 1,
    explain: 'A large gap between training and cross-validated scores means the model memorised the training data.',
  },
]

// ---------- Formatting ----------

export function pct(value) {
  const v = Math.round(value * 1000) / 10
  return `${Number.isInteger(v) ? v : v.toFixed(1)}%`
}
export const pctNumber = (value) => pct(value).replace('%', '')
export const num = (value, digits = 2) => {
  if (!Number.isFinite(value)) return '—'
  if (Math.abs(value) >= 1000) return value.toExponential(1)
  return value.toFixed(digits)
}
export const foldName = (fold) => `F${fold + 1}`

// ---------- Python export ----------

export function pythonCode(k, degree) {
  const xs = DATA.map((p) => p.x).join(', ')
  const ys = DATA.map((p) => p.y).join(', ')
  return `# Cross Validation Maze: the ${k}-fold cross-validation behind the game (standard library only).
# A prediction "survives" a sample when |actual - predicted| <= ${TOLERANCE}.
# Folds are shuffled with Python's random module, so fold scores differ slightly from the game.
import random

xs = [${xs}]
ys = [${ys}]
K = ${k}
DEGREE = ${degree}
TOLERANCE = ${TOLERANCE}
random.seed(0)

def legendre(x, degree):
    p = [1.0, x]
    for n in range(1, degree):
        p.append(((2 * n + 1) * x * p[n] - n * p[n - 1]) / (n + 1))
    return p[:degree + 1]

def fit(points, degree):
    size = degree + 1
    A = [[1e-3 if r == c else 0.0 for c in range(size)] for r in range(size)]
    b = [0.0] * size
    for x, y in points:
        f = legendre(x, degree)
        for r in range(size):
            b[r] += f[r] * y
            for c in range(size):
                A[r][c] += f[r] * f[c]
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
    return sum(c * f for c, f in zip(coefs, legendre(x, len(coefs) - 1)))

indices = list(range(len(xs)))
random.shuffle(indices)
folds = [indices[i::K] for i in range(K)]
scores = []
for i, test in enumerate(folds):
    train = [(xs[j], ys[j]) for j in indices if j not in test]
    coefs = fit(train, DEGREE)
    hits = sum(abs(ys[j] - predict(coefs, xs[j])) <= TOLERANCE for j in test)
    score = hits / len(test)
    scores.append(score)
    print(f"Fold {i + 1}: {hits}/{len(test)} correct -> {score:.0%}")

cv = sum(scores) / K
spread = (sum((s - cv) ** 2 for s in scores) / K) ** 0.5
print(f"CV score = {cv:.1%} +/- {spread:.1%}")
`
}
