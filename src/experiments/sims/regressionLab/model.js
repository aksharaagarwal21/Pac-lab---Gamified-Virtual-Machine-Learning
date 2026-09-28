import { gaussian, seeded } from '../../../lib/ml.js'

// Pure simulation logic for the Linear Regression lab. No React, so it can be unit-tested.

export const DOMAIN = { x: [0, 10], y: [0, 20] }
export const POINT_LIMITS = { min: 3, max: 100 }
export const SAMPLE_RANGE = { min: 5, max: 100 }
// X positions of the three line handles used in Edit Model and Generate Data.
export const HANDLE_X = { left: 1, centre: 5, right: 9 }

export const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value))
export const round2 = (value) => Math.round(value * 100) / 100
export const at = (line, x) => line.slope * x + line.intercept
export const pickLine = (line) => ({ slope: line.slope, intercept: line.intercept })

export const clampPoint = (x, y) => ({ x: round2(clamp(x, ...DOMAIN.x)), y: round2(clamp(y, ...DOMAIN.y)) })

let counter = 0
export const nextId = (prefix = 'p') => `${prefix}${++counter}`

// The Experiment 2 starting dataset: y ≈ 1.6x + 2 with small, repeatable noise.
export const ORIGINAL_POINTS = [
  [1, 3.2],
  [2, 5.1],
  [3, 6.4],
  [4, 9.0],
  [5, 9.3],
  [6, 12.1],
  [7, 12.9],
  [8, 15.4],
  [9, 16.0],
].map(([x, y], i) => ({ id: `o${i + 1}`, x, y }))

// Accepts "3.5", " -2 ", "−2" (typographic minus) and "3,5". Returns null for anything that is not a finite number.
export function parseNumber(text) {
  const cleaned = String(text).trim().replace(/−/g, '-').replace(',', '.')
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : null
}

// ---------- Least squares and metrics ----------

// status: 'ok' | 'empty' | 'single' | 'same-x'. Degenerate cases fall back to a flat line at the mean of y.
export function fitLine(points) {
  const n = points.length
  if (n === 0) return { slope: 0, intercept: 0, status: 'empty' }
  const mx = points.reduce((s, p) => s + p.x, 0) / n
  const my = points.reduce((s, p) => s + p.y, 0) / n
  if (n === 1) return { slope: 0, intercept: my, status: 'single' }
  let sxx = 0
  let sxy = 0
  for (const p of points) {
    sxx += (p.x - mx) ** 2
    sxy += (p.x - mx) * (p.y - my)
  }
  if (sxx < 1e-12) return { slope: 0, intercept: my, status: 'same-x' }
  const slope = sxy / sxx
  return { slope, intercept: my - slope * mx, status: 'ok' }
}

// Predictions, residuals and error metrics of any line on the points. r2 is null when every y is equal (SST = 0).
export function evaluateLine(points, line) {
  const n = points.length
  const rows = points.map((p, index) => {
    const predicted = at(line, p.x)
    return { id: p.id, index, x: p.x, y: p.y, predicted, residual: p.y - predicted }
  })
  if (n === 0) return { rows, n, sse: 0, mse: 0, mae: 0, rmse: 0, r2: null, sst: 0 }
  const my = points.reduce((s, p) => s + p.y, 0) / n
  let sse = 0
  let sae = 0
  let sst = 0
  for (const row of rows) {
    sse += row.residual ** 2
    sae += Math.abs(row.residual)
    sst += (row.y - my) ** 2
  }
  const mse = sse / n
  return { rows, n, sse, mse, mae: sae / n, rmse: Math.sqrt(mse), sst, r2: sst > 1e-12 ? 1 - sse / sst : null }
}

// How the least-squares fit changes when the outlier is included.
export function outlierImpact(points, outlierId) {
  const without = points.filter((p) => p.id !== outlierId)
  if (without.length < 2 || without.length === points.length) return null
  const summary = (data) => {
    const line = fitLine(data)
    const { mse, r2 } = evaluateLine(data, line)
    return { slope: line.slope, intercept: line.intercept, mse, r2 }
  }
  return { before: summary(without), after: summary(points) }
}

// ---------- Formatting (never shows NaN or Infinity) ----------

const MINUS = '−'

export function fmt(value, digits = 2) {
  if (!Number.isFinite(value)) return '—'
  const text = value.toFixed(digits)
  return Number(text) === 0 ? (0).toFixed(digits) : text.replace('-', MINUS)
}

export function signed(value, digits = 2) {
  if (!Number.isFinite(value)) return '—'
  if (Number(value.toFixed(digits)) === 0) return (0).toFixed(digits)
  return `${value > 0 ? '+' : MINUS}${Math.abs(value).toFixed(digits)}`
}

// "1.72x + 2.14" / "−1.50x − 0.40"
export function lineTerms(line, digits = 2) {
  const b = Number(line.intercept.toFixed(digits))
  return `${fmt(line.slope, digits)}x ${b < 0 ? MINUS : '+'} ${fmt(Math.abs(line.intercept), digits)}`
}

export const equation = (line, digits = 2) => `Ŷ = ${lineTerms(line, digits)}`

// ---------- Line handles ----------

// Centre handle: shift the whole line vertically (slope unchanged).
// End handles: tilt the line about the centre handle, so the slope changes.
export function dragLine(line, handle, y) {
  const [y0, y1] = DOMAIN.y
  const cx = HANDLE_X.centre
  if (handle === 'centre') {
    const yc = clamp(y, y0, y1)
    return { slope: line.slope, intercept: yc - line.slope * cx }
  }
  const hx = HANDLE_X[handle]
  const yc = at(line, cx)
  // Keep the opposite end handle on the graph while rotating.
  let lo = Math.max(y0, 2 * yc - y1)
  let hi = Math.min(y1, 2 * yc - y0)
  if (lo > hi) [lo, hi] = [y0, y1]
  const slope = (clamp(y, lo, hi) - yc) / (hx - cx)
  return { slope, intercept: yc - slope * cx }
}

export const nudgeLine = (line, handle, dy) => dragLine(line, handle, at(line, HANDLE_X[handle]) + dy)

// ---------- Data generation ----------

export const noiseSd = (level) => 0.25 + clamp(level, 0, 1) * 3.25
export const noiseLevelFor = (sd) => clamp((sd - 0.25) / 3.25, 0, 1)
export const noiseLabel = (level) => (level < 1 / 3 ? 'Low' : level < 2 / 3 ? 'Medium' : 'High')

const GEN_X = [0.4, 9.6]

// Each generated observation is fully determined by (seed, index), so growing the sample keeps existing points.
function sampleAt(seed, index) {
  const random = seeded((Math.imul(seed | 0, 2654435761) ^ Math.imul(index + 1, 40503)) >>> 0)
  return { gi: index, x: round2(GEN_X[0] + random() * (GEN_X[1] - GEN_X[0])), eps: gaussian(random) }
}

// A generated point keeps its standardized noise `eps`; its y always follows the underlying line.
export const placeGenerated = (point, line, noise) => ({
  ...point,
  y: round2(clamp(at(line, point.x) + noiseSd(noise) * point.eps, ...DOMAIN.y)),
})

export const isGenerated = (point) => point.eps != null

export function generateDataset({ line, noise, size, seed }) {
  return Array.from({ length: size }, (_, i) => placeGenerated({ id: nextId('g'), ...sampleAt(seed, i) }, line, noise))
}

export const regenerate = (points, line, noise) => points.map((p) => (isGenerated(p) ? placeGenerated(p, line, noise) : p))

export function resizeGenerated(points, size, { line, noise, seed }) {
  const generated = points.filter(isGenerated)
  if (size <= generated.length) {
    const keep = new Set(generated.slice(0, Math.max(0, size)).map((p) => p.id))
    return points.filter((p) => !isGenerated(p) || keep.has(p.id))
  }
  let next = generated.reduce((max, p) => Math.max(max, p.gi ?? -1), -1) + 1
  const extra = Array.from({ length: size - generated.length }, () => placeGenerated({ id: nextId('g'), ...sampleAt(seed, next++) }, line, noise))
  return [...points, ...extra]
}

// Turn existing data into "generated" data without moving it: each point's residual from `line`
// becomes its noise, and the noise level is set to match the residual spread. The outlier stays fixed.
export function adoptForGeneration(points, line, outlierId) {
  const fitted = points.filter((p) => p.id !== outlierId)
  const rms = fitted.length ? Math.sqrt(fitted.reduce((s, p) => s + (p.y - at(line, p.x)) ** 2, 0) / fitted.length) : 0
  const noise = round2(noiseLevelFor(rms))
  const sd = noiseSd(noise)
  const adopted = points.map((p, i) => {
    const { eps: _eps, gi: _gi, ...rest } = p
    return p.id === outlierId ? rest : { ...rest, gi: i, eps: (p.y - at(line, p.x)) / sd }
  })
  return { noise, points: adopted }
}

// Drop the generated-noise bookkeeping when the student takes manual control of a point.
export const toManual = ({ id, x, y }) => ({ id, x, y })

export const PRESETS = [
  { id: 'positive', label: 'Positive relationship', symbol: '↗', line: { slope: 1.6, intercept: 2 }, noise: 0.12, size: 20, seed: 21, note: 'points generally rise as X increases, so the fitted slope is positive.' },
  { id: 'negative', label: 'Negative relationship', symbol: '↘', line: { slope: -1.5, intercept: 17.5 }, noise: 0.12, size: 20, seed: 22, note: 'points generally fall as X increases, so the fitted slope is negative.' },
  { id: 'weak', label: 'Weak relationship', symbol: '≈', line: { slope: 0.7, intercept: 6.5 }, noise: 0.75, size: 30, seed: 23, note: 'a visible trend but lots of noise. Notice the larger errors and lower R².' },
  { id: 'none', label: 'No relationship', symbol: '○', line: { slope: 0, intercept: 10 }, noise: 0.9, size: 30, seed: 24, note: 'no clear linear pattern, so the slope is close to 0 and R² is close to 0.' },
]

export function randomSpec(random = Math.random) {
  const slope = round2((random() < 0.5 ? -1 : 1) * (0.4 + random() * 1.0))
  const centre = 8 + random() * 4
  return {
    line: { slope, intercept: round2(centre - slope * 5) },
    noise: round2(0.08 + random() * 0.4),
    size: 12 + Math.floor(random() * 19),
    seed: Math.floor(random() * 1e9),
  }
}

// A point far from the current trend at a high-leverage x, placed on the side with more room.
export function makeOutlier(line) {
  const x = 8.8
  const predicted = at(line, x)
  const room = { up: DOMAIN.y[1] - predicted, down: predicted - DOMAIN.y[0] }
  const up = room.up >= room.down
  const distance = Math.max(6, Math.min(9, (up ? room.up : room.down) - 0.6))
  return clampPoint(x, predicted + (up ? distance : -distance))
}

// A sensible spot for a new point: the widest gap in x, slightly above the current line.
export function suggestPoint(points, line) {
  const xs = [DOMAIN.x[0] + 0.5, ...points.map((p) => p.x).sort((a, b) => a - b), DOMAIN.x[1] - 0.5]
  let best = { gap: -1, x: 5 }
  for (let i = 1; i < xs.length; i++) {
    const gap = xs[i] - xs[i - 1]
    if (gap > best.gap) best = { gap, x: (xs[i] + xs[i - 1]) / 2 }
  }
  return clampPoint(best.x, at(line, best.x) + 1.5)
}

// ---------- Learning hints ----------

export const HINTS = {
  welcome: 'Observe the dataset and its regression line, then drag any point to see what happens.',
  data: 'Edit Data: drag points or edit the table. The line is recalculated from the data — data determines the model.',
  model: 'Edit Model: the data is locked. Drag the centre handle to shift the line or an end handle to tilt it — changing the model changes predictions and error.',
  generate: 'Generate Data: move or tilt the dashed line and the data regenerates around it. Try the Noise and Number of Data Points sliders.',
  steeper: 'Notice: a steeper slope means Y changes more for every unit increase in X.',
  flatter: 'Notice: a flatter slope means Y changes less for every unit increase in X.',
  intercept: 'Notice: you changed the intercept while keeping the same slope.',
  dataDrag: 'Data determines the model: moving one point moved the least-squares line with it.',
  outlier: 'Notice: extreme observations can strongly influence a regression model.',
  outlierAdded: 'Notice how one extreme data point can influence the regression line. Drag it farther away and watch the slope.',
  mseDown: 'Nice! The line is now closer to the data points overall.',
  mseUp: 'The prediction error increased. Look at the residual distances.',
  noiseUp: 'More noise means the points follow the underlying relationship less closely — harder for the model to learn.',
  noiseDown: 'Less noise: the points hug the underlying line, so the relationship is easier to learn.',
  sizeUp: 'More observations can give a more reliable estimate of the underlying relationship — but not a guarantee of a better model.',
  sizeDown: 'With fewer observations, each single point pulls harder on the fitted line.',
  generating: 'The data followed your line. The fitted model (solid) estimates it from the noisy points.',
  residuals: 'Each vertical segment is a residual: actual y minus predicted ŷ.',
  squares: 'Least Squares Linear Regression searches for the line that minimizes the total squared error.',
  prediction: 'Drag the marker along the X-axis: the model predicts ŷ by reading the line at that x.',
  challenge: 'Hide-and-fit: drag the handles until your line fits the data. Watch Your MSE fall.',
  reveal: 'The best-fit line is the line that minimizes prediction error. No other straight line has a lower MSE on these points.',
  pointAdded: 'New point added. Drag it and watch the line respond.',
  pointDeleted: 'Point removed — the model was recalculated without it.',
  random: 'Random dataset generated. Before looking at the equation, guess the sign of the slope.',
  newSample: 'A new random sample from the same underlying line. Notice how the fitted line changes a little from sample to sample.',
  sameX: 'All X values are identical, so the slope cannot be calculated. The line shows the mean of Y instead.',
}

const SIGNIFICANT = { slope: 0.02, mse: 0.02 }

export function hintForDataDrag({ before, after, isOutlier }) {
  if (after.status === 'same-x') return HINTS.sameX
  if (isOutlier) return HINTS.outlier
  if (Math.abs(after.slope - before.slope) > SIGNIFICANT.slope) {
    return `${Math.abs(after.slope) > Math.abs(before.slope) ? HINTS.steeper : HINTS.flatter} ${HINTS.dataDrag}`
  }
  return HINTS.dataDrag
}

export function hintForLineDrag({ handle, before, after, mseBefore, mseAfter, generating }) {
  const shape =
    handle === 'centre'
      ? HINTS.intercept
      : Math.abs(after.slope) > Math.abs(before.slope)
        ? HINTS.steeper
        : HINTS.flatter
  if (generating) return `${shape} ${HINTS.generating}`
  const change = mseAfter - mseBefore
  if (Math.abs(change) <= SIGNIFICANT.mse * Math.max(1, mseBefore)) return shape
  return `${shape} ${change < 0 ? HINTS.mseDown : HINTS.mseUp}`
}

// ---------- Experiment flow ----------

export const FLOW = [
  { id: 'observe', label: 'Observe the dataset and regression line' },
  { id: 'drag', label: 'Drag one point' },
  { id: 'metrics', label: 'Watch slope, intercept, equation and metrics change' },
  { id: 'residuals', label: 'Turn on Show Residuals' },
  { id: 'squares', label: 'Turn on Show Error Squares' },
  { id: 'fit', label: 'Try fitting the line yourself' },
  { id: 'reveal', label: 'Reveal the best-fit line' },
  { id: 'outlier', label: 'Add an outlier' },
  { id: 'noise', label: 'Experiment with noise' },
  { id: 'predict', label: 'Make a new prediction' },
]

export function initialDoc() {
  const line = pickLine(fitLine(ORIGINAL_POINTS))
  return { mode: 'data', points: ORIGINAL_POINTS, manualLine: line, genLine: line, noise: 0.12, seed: 7, outlierId: null }
}

// ---------- Python export ----------

const pyNumbers = (values) => `[${values.map((v) => Number(v.toFixed(2))).join(', ')}]`

export function pythonCode(points, line) {
  return `# Linear regression from first principles (standard library only)
xs = ${pyNumbers(points.map((p) => p.x))}
ys = ${pyNumbers(points.map((p) => p.y))}
n = len(xs)

def metrics(m, b):
    residuals = [y - (m * x + b) for x, y in zip(xs, ys)]
    sse = sum(r * r for r in residuals)
    mean_y = sum(ys) / n
    sst = sum((y - mean_y) ** 2 for y in ys)
    r2 = 1 - sse / sst if sst else float("nan")
    return sse / n, sum(abs(r) for r in residuals) / n, r2, sse

mean_x, mean_y = sum(xs) / n, sum(ys) / n
sxx = sum((x - mean_x) ** 2 for x in xs)
best_m = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys)) / sxx if sxx else 0.0
best_b = mean_y - best_m * mean_x

print("Lab line:           y = %.3fx + %.3f" % (${Number(line.slope.toFixed(4))}, ${Number(line.intercept.toFixed(4))}))
print("  MSE=%.4f MAE=%.4f R2=%.4f SSE=%.4f" % metrics(${Number(line.slope.toFixed(4))}, ${Number(line.intercept.toFixed(4))}))
print("Least-squares line: y = %.3fx + %.3f" % (best_m, best_b))
print("  MSE=%.4f MAE=%.4f R2=%.4f SSE=%.4f" % metrics(best_m, best_b))
`
}
