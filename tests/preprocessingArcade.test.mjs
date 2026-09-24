import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { RAW, freshBoard, buildPipeline, statistics, lineMetrics, pythonCode } from '../src/experiments/sims/preprocessingArcadeModel.js'

const repairs = { '2:age': 'mean', '8:age': 'median', '3:salary': 'median', '9:salary': 'mean', '9:city': 'mode' }
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} should equal ${b}`)

test('missing blocks remain missing until repaired; raw database is not mutated', () => {
  const original = JSON.stringify(RAW)
  const initial = buildPipeline(freshBoard())
  assert.equal(initial.missing, 5)
  assert.equal(buildPipeline({ ...freshBoard(), pulled: ['2:age'] }).missing, 5)
  const fixed = buildPipeline({ ...freshBoard(), repairs })
  assert.equal(fixed.missing, 0); assert.equal(fixed.filled, 5)
  close(fixed.rows[2].age, 37.375); close(fixed.rows[8].age, 36.5)
  assert.equal(fixed.rows[9].city, 'Delhi')
  assert.equal(JSON.stringify(RAW), original)
})

test('mode handles category frequencies and numeric ties deterministically', () => {
  assert.equal(statistics(['Delhi', 'Mumbai', 'Delhi']).mode, 'Delhi')
  assert.deepEqual(statistics([5, 2, 5, 2]).modes, [2, 5])
  assert.equal(statistics([5, 2, 5, 2]).mode, 2)
  assert.equal(statistics(['Delhi']).mean, null)
})

test('deleting a row changes the fit and keeps stable row IDs', () => {
  const result = buildPipeline({ ...freshBoard(), repairs, removed: [2, 9] })
  assert.equal(result.rows.length, 10); assert.equal(result.missing, 0)
  assert.deepEqual(result.rows.filter(r => r.split === 'test').map(r => r.id), [10, 11])
  assert.equal(result.filled, 2)
  assert.equal(result.rows.find(r => r.id === 8).age, 35)
})

test('outlier clipping recalculates learned salary replacements', () => {
  const kept = buildPipeline({ ...freshBoard(), repairs })
  const clipped = buildPipeline({ ...freshBoard(), repairs, outlier: 'clip' })
  assert.ok(clipped.fence < 250000)
  assert.equal(clipped.rows[6].salary, clipped.fence)
  assert.ok(clipped.rows[9].salary < kept.rows[9].salary)
  assert.equal(clipped.rows.length, kept.rows.length)
})

test('one-hot categories and fitted scalers use training rows only', () => {
  const result = buildPipeline({ ...freshBoard(), repairs, scaling: 'standard' })
  for (const col of ['age', 'salary']) {
    const values = result.processed.filter(r => r.split === 'train').map(r => r[col])
    close(values.reduce((a, b) => a + b, 0) / values.length, 0)
    close(values.reduce((a, b) => a + b * b, 0) / values.length, 1)
  }
  result.processed.forEach(r => assert.equal(result.cities.reduce((n, c) => n + r[`city_${c}`], 0), 1))
  const row = result.processed.find(r => r.row === 11)
  close(row.age, (27 - result.scales.age.mean) / result.scales.age.std)
})

test('line mission error measures the chosen slope and intercept', () => {
  assert.deepEqual(lineMetrics(2, 1), { mse: 0, hits: 6 })
  assert.equal(lineMetrics(2, 2).mse, 1)
  assert.ok(lineMetrics(0.5, 4).hits < 6)
})

test('Python export reproduces per-cell repairs, deletions and every transform setting', t => {
  if (spawnSync('python', ['--version']).status !== 0) return t.skip('Python is not installed')
  for (const scaling of ['none', 'minmax', 'standard']) for (const encoding of ['label', 'onehot']) for (const outlier of ['keep', 'clip']) for (const removed of [[], [2, 9]]) {
    const board = { ...freshBoard(), repairs, scaling, encoding, outlier, removed }
    const expected = buildPipeline(board).processed
    const script = pythonCode(board, 2, 1) + '\nimport json\nprint(json.dumps(rows))\n'
    const run = spawnSync('python', ['-c', script], { encoding: 'utf8' })
    assert.equal(run.status, 0, run.stderr)
    const actual = JSON.parse(run.stdout.trim().split('\n').at(-1))
    assert.equal(actual.length, expected.length)
    expected.forEach((row, i) => Object.entries(row).forEach(([key, value]) => {
      if (typeof value === 'number') close(actual[i][key], value)
      else assert.equal(actual[i][key], value)
    }))
  }
})
