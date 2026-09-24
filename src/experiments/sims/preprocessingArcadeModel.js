// Small, inspectable sample database. The final two rows are held out throughout.
export const RAW = [
  { age: 25, salary: 32000, city: 'Delhi', purchased: 'No' },
  { age: 32, salary: 48000, city: 'Mumbai', purchased: 'Yes' },
  { age: null, salary: 52000, city: 'Chennai', purchased: 'Yes' },
  { age: 41, salary: null, city: 'Delhi', purchased: 'No' },
  { age: 29, salary: 39000, city: 'Mumbai', purchased: 'No' },
  { age: 47, salary: 61000, city: 'Chennai', purchased: 'Yes' },
  { age: 35, salary: 250000, city: 'Delhi', purchased: 'Yes' },
  { age: 52, salary: 58000, city: 'Mumbai', purchased: 'No' },
  { age: null, salary: 45000, city: 'Delhi', purchased: 'Yes' },
  { age: 38, salary: null, city: null, purchased: 'No' },
  { age: 27, salary: 36000, city: 'Mumbai', purchased: 'No' },
  { age: 44, salary: 55000, city: 'Delhi', purchased: 'Yes' },
]
export const TRAIN_COUNT = 10
export const COLUMNS = ['age', 'salary', 'city']
export const POINTS = [0, 1, 2, 3, 4, 5].map(x => ({ x, y: 2 * x + 1 }))
export const freshBoard = () => ({ pulled: [], repairs: {}, removed: [], outlier: 'keep', encoding: 'onehot', scaling: 'none' })
export const mean = values => values.reduce((a, b) => a + b, 0) / values.length
export function quantile(values, q) {
  const sorted = [...values].sort((a, b) => a - b)
  const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}
export function statistics(values) {
  if (!values.length) return null
  const counts = new Map()
  values.forEach(v => counts.set(v, (counts.get(v) ?? 0) + 1))
  const count = Math.max(...counts.values())
  const modes = [...counts.keys()].filter(v => counts.get(v) === count).sort((a, b) => typeof a === 'number' ? a - b : a.localeCompare(b))
  const numeric = typeof values[0] === 'number'
  return { mean: numeric ? mean(values) : null, median: numeric ? quantile(values, 0.5) : null, mode: modes[0], modes, count }
}
export const display = value => value === null ? '?' : typeof value === 'number' ? value.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : value

export function buildPipeline(board) {
  const rows = RAW.map((row, id) => ({ ...row, id, split: id < TRAIN_COUNT ? 'train' : 'test' })).filter(r => !board.removed.includes(r.id))
  const observedSalary = rows.filter(r => r.split === 'train' && r.salary !== null).map(r => r.salary)
  const q1 = quantile(observedSalary, 0.25), q3 = quantile(observedSalary, 0.75)
  const fence = q3 + 1.5 * (q3 - q1), lowerFence = q1 - 1.5 * (q3 - q1)
  if (board.outlier === 'clip') rows.forEach(r => { if (r.salary !== null) r.salary = Math.max(lowerFence, Math.min(fence, r.salary)) })
  const stats = Object.fromEntries(COLUMNS.map(col => [col, statistics(rows.filter(r => r.split === 'train' && r[col] !== null).map(r => r[col]))]))
  let filled = 0
  rows.forEach(r => COLUMNS.forEach(col => {
    if (r[col] !== null) return
    const method = board.repairs[`${r.id}:${col}`]
    if (method && stats[col]?.[method] != null) { r[col] = stats[col][method]; filled++ }
  }))
  const missing = rows.reduce((sum, r) => sum + COLUMNS.filter(col => r[col] === null).length, 0)
  const cities = [...new Set(rows.filter(r => r.split === 'train' && r.city !== null).map(r => r.city))].sort()
  const scales = Object.fromEntries(['age', 'salary'].map(col => {
    const values = rows.filter(r => r.split === 'train' && r[col] !== null).map(r => r[col])
    const mu = mean(values)
    return [col, { min: Math.min(...values), max: Math.max(...values), mean: mu, std: Math.sqrt(mean(values.map(v => (v - mu) ** 2))) }]
  }))
  const processed = rows.map(r => {
    const result = { row: r.id + 1, split: r.split }
    for (const col of ['age', 'salary']) {
      const v = r[col], fit = scales[col]
      result[col] = v === null ? null : board.scaling === 'minmax' ? (v - fit.min) / (fit.max - fit.min || 1) : board.scaling === 'standard' ? (v - fit.mean) / (fit.std || 1) : v
    }
    if (board.encoding === 'onehot') cities.forEach(city => { result[`city_${city}`] = r.city === null ? null : Number(r.city === city) })
    else result.city = r.city === null ? null : cities.indexOf(r.city)
    result.purchased = Number(r.purchased === 'Yes')
    return result
  })
  return { rows, stats, missing, filled, fence, lowerFence, scales, cities, processed }
}

export function lineMetrics(m, b) {
  const errors = POINTS.map(p => m * p.x + b - p.y)
  return { mse: mean(errors.map(e => e ** 2)), hits: errors.filter(e => Math.abs(e) <= 0.35).length }
}

export function pythonCode(board, slope, intercept) {
  // Export the learner's exact per-cell choices, not a different global fill strategy.
  const literal = JSON.stringify(RAW).replace(/\bnull\b/g, 'None')
  return `# PAC-LAB block workshop: the exact choices from your arcade run.
from statistics import mean, pstdev

rows = ${literal}
repairs = ${JSON.stringify(board.repairs)}
removed = ${JSON.stringify(board.removed)}
outlier, encoding, scaling = ${JSON.stringify(board.outlier)}, ${JSON.stringify(board.encoding)}, ${JSON.stringify(board.scaling)}

def quantile(values, q):
    values = sorted(values)
    pos = (len(values) - 1) * q
    lo = int(pos)
    hi = min(lo + 1, len(values) - 1)
    return values[lo] + (values[hi] - values[lo]) * (pos - lo)

for i, row in enumerate(rows):
    row['row'] = i + 1
    row['split'] = 'train' if i < ${TRAIN_COUNT} else 'test'
rows = [r for i, r in enumerate(rows) if i not in removed]
train = [r for r in rows if r['split'] == 'train']
salaries = [r['salary'] for r in train if r['salary'] is not None]
q1, q3 = quantile(salaries, .25), quantile(salaries, .75)
if outlier == 'clip':
    for r in rows:
        if r['salary'] is not None:
            r['salary'] = min(q3 + 1.5 * (q3-q1), max(q1 - 1.5 * (q3-q1), r['salary']))
for col in ('age', 'salary', 'city'):
    observed = [r[col] for r in train if r[col] is not None]
    # Ties: smallest numeric value or alphabetically first category, as in the game.
    modes = sorted(set(observed), key=lambda v: (-observed.count(v), v))
    fill = {'mode': modes[0]}
    if col != 'city':
        fill.update(mean=mean(observed), median=quantile(observed, .5))
    for r in rows:
        key = str(r['row'] - 1) + ':' + col
        if r[col] is None and key in repairs:
            r[col] = fill[repairs[key]]
cities = sorted({r['city'] for r in train})
for col in ('age', 'salary'):
    values = [r[col] for r in train]
    lo, hi, mu, sigma = min(values), max(values), mean(values), pstdev(values)
    for r in rows:
        if scaling == 'minmax': r[col] = (r[col] - lo) / (hi - lo or 1)
        elif scaling == 'standard': r[col] = (r[col] - mu) / (sigma or 1)
for r in rows:
    if encoding == 'onehot':
        for city in cities: r['city_' + city] = int(r['city'] == city)
        del r['city']
    else: r['city'] = cities.index(r['city']) if r['city'] in cities else -1
    r['purchased'] = int(r['purchased'] == 'Yes')
    print(r)

# Separate toy line activity (not a model fitted to the customer table).
m, b = ${slope}, ${intercept}
points = [(x, 2*x+1) for x in range(6)]
print('Line MSE:', mean((m*x+b-y)**2 for x,y in points))
`
}
