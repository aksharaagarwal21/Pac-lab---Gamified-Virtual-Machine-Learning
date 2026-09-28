import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DOMAIN,
  HANDLE_X,
  ORIGINAL_POINTS,
  adoptForGeneration,
  at,
  dragLine,
  evaluateLine,
  fitLine,
  fmt,
  generateDataset,
  lineTerms,
  makeOutlier,
  outlierImpact,
  parseNumber,
  regenerate,
  resizeGenerated,
  signed,
} from '../src/experiments/sims/regressionLab/model.js'

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} should equal ${b}`)
const pts = (pairs) => pairs.map(([x, y], i) => ({ id: `t${i}`, x, y }))

test('least squares matches the closed-form formulas', () => {
  const line = fitLine(pts([[1, 2], [2, 3], [3, 5], [4, 6]]))
  close(line.slope, 1.4)
  close(line.intercept, 0.5)
  assert.equal(line.status, 'ok')
  const exact = fitLine(pts([[0, 1], [1, 3], [2, 5], [3, 7]]))
  close(exact.slope, 2)
  close(exact.intercept, 1)
})

test('metrics: MSE, MAE, SSE and R² follow their definitions', () => {
  const data = pts([[1, 3], [2, 5], [3, 7]])
  const m = evaluateLine(data, { slope: 2, intercept: 0 }) // predictions 2, 4, 6 → residuals 1, 1, 1
  close(m.sse, 3)
  close(m.mse, 1)
  close(m.mae, 1)
  close(m.r2, 1 - 3 / 8)
  assert.deepEqual(m.rows.map((r) => r.residual), [1, 1, 1])
  const best = evaluateLine(data, fitLine(data))
  close(best.r2, 1)
  close(best.sse, 0)
})

test('the least-squares line has the lowest MSE of nearby lines', () => {
  const line = fitLine(ORIGINAL_POINTS)
  const best = evaluateLine(ORIGINAL_POINTS, line).mse
  for (const [ds, db] of [[0.05, 0], [-0.05, 0], [0, 0.1], [0, -0.1], [0.02, -0.1]]) {
    assert.ok(evaluateLine(ORIGINAL_POINTS, { slope: line.slope + ds, intercept: line.intercept + db }).mse > best)
  }
})

test('degenerate data never produces NaN or Infinity', () => {
  const sameX = fitLine(pts([[4, 1], [4, 5], [4, 9]]))
  assert.equal(sameX.status, 'same-x')
  assert.equal(sameX.slope, 0)
  close(sameX.intercept, 5)
  const flatY = evaluateLine(pts([[1, 2], [2, 2], [3, 2]]), { slope: 1, intercept: 0 })
  assert.equal(flatY.r2, null)
  assert.equal(fitLine([]).status, 'empty')
  assert.equal(fitLine(pts([[1, 1]])).status, 'single')
  const empty = evaluateLine([], { slope: 1, intercept: 0 })
  assert.ok([empty.mse, empty.mae, empty.sse].every(Number.isFinite))
  assert.equal(fmt(NaN), '—')
  assert.equal(fmt(Infinity), '—')
  assert.equal(fmt(-0.001), '0.00')
  assert.equal(signed(0.3), '+0.30')
  assert.equal(signed(-0.3), '−0.30')
  assert.equal(lineTerms({ slope: 1.5, intercept: -2 }), '1.50x − 2.00')
})

test('number parsing rejects invalid input', () => {
  assert.equal(parseNumber('3.5'), 3.5)
  assert.equal(parseNumber('−2'), -2)
  assert.equal(parseNumber('3,5'), 3.5)
  for (const bad of ['', '-', 'abc', '1e999', 'NaN']) assert.equal(parseNumber(bad), null)
})

test('centre handle shifts the intercept only; end handles tilt about the centre', () => {
  const line = { slope: 1.5, intercept: 2 }
  const shifted = dragLine(line, 'centre', at(line, HANDLE_X.centre) + 3)
  close(shifted.slope, 1.5)
  close(shifted.intercept, 5)
  const tilted = dragLine(line, 'right', at(line, HANDLE_X.right) + 2)
  assert.ok(tilted.slope > line.slope)
  close(at(tilted, HANDLE_X.centre), at(line, HANDLE_X.centre))
  // Rotation is limited so the opposite handle stays on the graph.
  const extreme = dragLine({ slope: 0, intercept: 10 }, 'right', 1e6)
  const leftY = at(extreme, HANDLE_X.left)
  assert.ok(leftY >= DOMAIN.y[0] - 1e-9 && at(extreme, HANDLE_X.right) <= DOMAIN.y[1] + 1e-9)
})

test('generated data follows its line, noise scales spread, and growing the sample keeps points', () => {
  const line = { slope: 1, intercept: 5 }
  const data = generateDataset({ line, noise: 0, size: 40, seed: 3 })
  const fit = fitLine(data)
  assert.ok(Math.abs(fit.slope - 1) < 0.15)
  const quiet = evaluateLine(data, line).mse
  const loud = evaluateLine(regenerate(data, line, 0.8), line).mse
  assert.ok(loud > quiet * 4)
  const moved = regenerate(data, { slope: 1, intercept: 7 }, 0)
  assert.ok(moved.every((p, i) => p.x === data[i].x))
  const bigger = resizeGenerated(data, 60, { line, noise: 0, seed: 3 })
  assert.equal(bigger.length, 60)
  assert.deepEqual(bigger.slice(0, 40), data)
  assert.equal(new Set(bigger.map((p) => p.id)).size, 60)
  assert.equal(resizeGenerated(bigger, 10, { line, noise: 0, seed: 3 }).length, 10)
  assert.ok(bigger.every((p) => p.y >= DOMAIN.y[0] && p.y <= DOMAIN.y[1]))
})

test('adopting data for generation keeps every point in place; the outlier stays manual', () => {
  const data = [...ORIGINAL_POINTS, { id: 'out', x: 8.8, y: 2 }]
  const line = fitLine(data)
  const { points, noise } = adoptForGeneration(data, line, 'out')
  const again = regenerate(points, line, noise)
  again.forEach((p, i) => close(p.y, data[i].y, 0.006))
  assert.equal(points.find((p) => p.id === 'out').eps, undefined)
})

test('an outlier is far from the trend and shifts the fitted slope', () => {
  const line = fitLine(ORIGINAL_POINTS)
  const spot = makeOutlier(line)
  assert.ok(Math.abs(spot.y - at(line, spot.x)) >= 6)
  const impact = outlierImpact([...ORIGINAL_POINTS, { id: 'out', ...spot }], 'out')
  assert.ok(Math.abs(impact.after.slope - impact.before.slope) > 0.2)
  assert.ok(impact.after.mse > impact.before.mse)
  assert.ok(impact.after.r2 < impact.before.r2)
})
