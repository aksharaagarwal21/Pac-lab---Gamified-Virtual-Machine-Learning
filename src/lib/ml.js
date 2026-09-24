// Small, dependency-free ML algorithms used by the experiment simulations.
// Points: regression { x, y }; classification { x, y, label } with label 0 or 1.

// ---------- Random numbers (seeded so every student sees the same data) ----------

export function seeded(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function gaussian(random) {
  const u = Math.max(random(), 1e-12)
  const v = random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export function shuffle(items, random) {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

// ---------- Statistics ----------

export const mean = (values) => values.reduce((sum, v) => sum + v, 0) / values.length

export function variance(values) {
  const m = mean(values)
  return values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length
}

export const std = (values) => Math.sqrt(variance(values))

// Solves A·x = b with Gaussian elimination and partial pivoting.
export function solve(matrix, rhs) {
  const n = rhs.length
  const m = matrix.map((row, i) => [...row, rhs[i]])
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let row = col + 1; row < n; row++) if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row
    ;[m[col], m[pivot]] = [m[pivot], m[col]]
    if (Math.abs(m[col][col]) < 1e-12) continue
    for (let row = 0; row < n; row++) {
      if (row === col) continue
      const factor = m[row][col] / m[col][col]
      for (let c = col; c <= n; c++) m[row][c] -= factor * m[col][c]
    }
  }
  return m.map((row, i) => (Math.abs(row[i]) < 1e-12 ? 0 : row[n] / row[i]))
}

// ---------- Regression ----------

export function leastSquares(points) {
  const mx = mean(points.map((p) => p.x))
  const my = mean(points.map((p) => p.y))
  const sxx = points.reduce((sum, p) => sum + (p.x - mx) ** 2, 0)
  const sxy = points.reduce((sum, p) => sum + (p.x - mx) * (p.y - my), 0)
  const slope = sxx === 0 ? 0 : sxy / sxx
  return { slope, intercept: my - slope * mx }
}

export function regressionMetrics(points, predict) {
  const residuals = points.map((p) => p.y - predict(p.x))
  const mse = mean(residuals.map((r) => r * r))
  const my = mean(points.map((p) => p.y))
  const total = points.reduce((sum, p) => sum + (p.y - my) ** 2, 0)
  const sse = residuals.reduce((sum, r) => sum + r * r, 0)
  return {
    mse,
    rmse: Math.sqrt(mse),
    mae: mean(residuals.map(Math.abs)),
    r2: total === 0 ? 0 : 1 - sse / total,
  }
}

// Full-batch gradient descent on MSE for y = slope·x + intercept. Returns every step.
export function gradientDescent(points, start, { steps = 80, rate = 0.05 } = {}) {
  let { slope, intercept } = start
  const n = points.length
  const path = []
  for (let i = 0; i <= steps; i++) {
    const residuals = points.map((p) => slope * p.x + intercept - p.y)
    path.push({ slope, intercept, mse: mean(residuals.map((r) => r * r)) })
    const gradSlope = (2 / n) * points.reduce((sum, p, k) => sum + residuals[k] * p.x, 0)
    const gradIntercept = (2 / n) * residuals.reduce((sum, r) => sum + r, 0)
    slope -= rate * gradSlope
    intercept -= rate * gradIntercept
  }
  return path
}

// Polynomial least squares (with a tiny ridge term for numerical stability).
export function polyFit(points, degree) {
  const size = degree + 1
  const xtx = Array.from({ length: size }, () => Array(size).fill(0))
  const xty = Array(size).fill(0)
  for (const p of points) {
    const powers = Array.from({ length: size }, (_, k) => p.x ** k)
    for (let r = 0; r < size; r++) {
      xty[r] += powers[r] * p.y
      for (let c = 0; c < size; c++) xtx[r][c] += powers[r] * powers[c]
    }
  }
  for (let d = 0; d < size; d++) xtx[d][d] += 1e-8
  return solve(xtx, xty)
}

export const polyPredict = (coefficients, x) => coefficients.reduce((sum, c, k) => sum + c * x ** k, 0)

// Splits indices 0..n-1 into k shuffled folds of near-equal size.
export function kFolds(n, k, random) {
  const order = shuffle(
    Array.from({ length: n }, (_, i) => i),
    random,
  )
  return Array.from({ length: k }, (_, fold) => order.filter((_, i) => i % k === fold))
}

// ---------- Classification helpers ----------

export function confusion(actual, predicted) {
  let tp = 0
  let fp = 0
  let tn = 0
  let fn = 0
  actual.forEach((a, i) => {
    if (a === 1 && predicted[i] === 1) tp++
    else if (a === 0 && predicted[i] === 1) fp++
    else if (a === 0 && predicted[i] === 0) tn++
    else fn++
  })
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp)
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn)
  return {
    tp,
    fp,
    tn,
    fn,
    accuracy: (tp + tn) / actual.length,
    precision,
    recall,
    f1: precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall),
  }
}

export const accuracy = (points, predict) => points.filter((p) => predict(p) === p.label).length / points.length

// ---------- Logistic regression (one feature) ----------

export const sigmoid = (z) => 1 / (1 + Math.exp(-z))

export function logisticFit1D(points, { steps = 3000, rate = 0.1 } = {}) {
  let w = 0
  let b = 0
  const n = points.length
  for (let i = 0; i < steps; i++) {
    let gw = 0
    let gb = 0
    for (const p of points) {
      const error = sigmoid(w * p.x + b) - p.label
      gw += error * p.x
      gb += error
    }
    w -= (rate * gw) / n
    b -= (rate * gb) / n
  }
  return { w, b }
}

export function logLoss(points, probability) {
  const eps = 1e-12
  return mean(points.map((p) => {
    const q = Math.min(1 - eps, Math.max(eps, probability(p)))
    return -(p.label * Math.log(q) + (1 - p.label) * Math.log(1 - q))
  }))
}

// ---------- PCA (two dimensions) ----------

export function pca2D(points) {
  const mx = mean(points.map((p) => p.x))
  const my = mean(points.map((p) => p.y))
  const n = points.length
  const a = points.reduce((s, p) => s + (p.x - mx) ** 2, 0) / n
  const c = points.reduce((s, p) => s + (p.y - my) ** 2, 0) / n
  const b = points.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / n
  const half = (a + c) / 2
  const root = Math.sqrt(((a - c) / 2) ** 2 + b * b)
  const values = [half + root, half - root]
  const vectorFor = (lambda) => {
    if (Math.abs(b) > 1e-12) {
      const v = [lambda - c, b]
      const length = Math.hypot(...v)
      return [v[0] / length, v[1] / length]
    }
    return a >= c ? (lambda === values[0] ? [1, 0] : [0, 1]) : lambda === values[0] ? [0, 1] : [1, 0]
  }
  return {
    center: [mx, my],
    covariance: [
      [a, b],
      [b, c],
    ],
    components: values.map((value) => ({ value, vector: vectorFor(value) })),
    totalVariance: a + c,
  }
}

// Variance of the data projected onto a unit direction at `angle` radians.
export function projectedVariance(points, angle) {
  const u = [Math.cos(angle), Math.sin(angle)]
  const mx = mean(points.map((p) => p.x))
  const my = mean(points.map((p) => p.y))
  return mean(points.map((p) => ((p.x - mx) * u[0] + (p.y - my) * u[1]) ** 2))
}

// ---------- K-means ----------

const squaredDistance = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2

export function kMeansPlusPlus(points, k, random) {
  const centroids = [points[Math.floor(random() * points.length)]]
  while (centroids.length < k) {
    const weights = points.map((p) => Math.min(...centroids.map((c) => squaredDistance(p, c))))
    const total = weights.reduce((s, w) => s + w, 0)
    let target = random() * total
    let chosen = points[points.length - 1]
    for (let i = 0; i < points.length; i++) {
      target -= weights[i]
      if (target <= 0) {
        chosen = points[i]
        break
      }
    }
    centroids.push(chosen)
  }
  return centroids.map((c) => ({ x: c.x, y: c.y }))
}

export function assignClusters(points, centroids) {
  return points.map((p) => {
    let best = 0
    centroids.forEach((c, i) => {
      if (squaredDistance(p, c) < squaredDistance(p, centroids[best])) best = i
    })
    return best
  })
}

export function updateCentroids(points, assignments, centroids) {
  return centroids.map((c, i) => {
    const members = points.filter((_, j) => assignments[j] === i)
    return members.length ? { x: mean(members.map((p) => p.x)), y: mean(members.map((p) => p.y)) } : c
  })
}

export const inertia = (points, assignments, centroids) =>
  points.reduce((sum, p, i) => sum + squaredDistance(p, centroids[assignments[i]]), 0)

// Mean silhouette coefficient: (b − a) / max(a, b) per point, where a is the mean distance to its own
// cluster and b the mean distance to the nearest other cluster. Singleton clusters score 0 (as in scikit-learn).
export function silhouette(points, assignments) {
  const clusters = [...new Set(assignments)]
  if (clusters.length < 2) return 0
  const scores = points.map((p, i) => {
    const sums = new Map()
    const counts = new Map()
    points.forEach((q, j) => {
      if (i === j) return
      const c = assignments[j]
      sums.set(c, (sums.get(c) ?? 0) + Math.sqrt(squaredDistance(p, q)))
      counts.set(c, (counts.get(c) ?? 0) + 1)
    })
    const own = assignments[i]
    if (!counts.get(own)) return 0
    const a = sums.get(own) / counts.get(own)
    let b = Infinity
    counts.forEach((count, c) => {
      if (c !== own) b = Math.min(b, sums.get(c) / count)
    })
    return b === Infinity ? 0 : (b - a) / Math.max(a, b)
  })
  return mean(scores)
}

export function kMeans(points, k, random, maxIterations = 50) {
  let centroids = kMeansPlusPlus(points, k, random)
  let assignments = assignClusters(points, centroids)
  for (let i = 0; i < maxIterations; i++) {
    const next = updateCentroids(points, assignments, centroids)
    const nextAssignments = assignClusters(points, next)
    const moved = nextAssignments.some((a, j) => a !== assignments[j])
    centroids = next
    assignments = nextAssignments
    if (!moved) break
  }
  return { centroids, assignments, inertia: inertia(points, assignments, centroids) }
}

// ---------- Decision trees (CART with Gini impurity, features x and y) ----------

const gini = (points) => {
  if (!points.length) return 0
  const p1 = points.filter((p) => p.label === 1).length / points.length
  return 1 - p1 * p1 - (1 - p1) * (1 - p1)
}

const entropy = (points) => {
  if (!points.length) return 0
  const p1 = points.filter((p) => p.label === 1).length / points.length
  return [p1, 1 - p1].reduce((sum, p) => (p > 0 ? sum - p * Math.log2(p) : sum), 0)
}

export const impurityOf = (points, criterion = 'gini') => (criterion === 'entropy' ? entropy(points) : gini(points))

const majority = (points) => (points.filter((p) => p.label === 1).length * 2 >= points.length ? 1 : 0)

// Options mirror scikit-learn: maxDepth, minSamples (min_samples_split), minLeaf (min_samples_leaf), criterion.
export function buildTree(points, options = {}, depth = 0) {
  const { maxDepth = 3, minSamples = 2, minLeaf = 1, criterion = 'gini', chooseFeatures = () => ['x', 'y'] } = options
  const measure = (group) => impurityOf(group, criterion)
  const counts = [points.filter((p) => p.label === 0).length, points.filter((p) => p.label === 1).length]
  const impurity = measure(points)
  const leaf = { leaf: true, prediction: majority(points), counts, depth, impurity }
  if (depth >= maxDepth || points.length < minSamples || counts[0] === 0 || counts[1] === 0) return leaf

  let best = null
  for (const feature of chooseFeatures()) {
    const values = [...new Set(points.map((p) => p[feature]))].sort((a, b) => a - b)
    for (let i = 1; i < values.length; i++) {
      const threshold = (values[i - 1] + values[i]) / 2
      const left = points.filter((p) => p[feature] <= threshold)
      const right = points.filter((p) => p[feature] > threshold)
      if (left.length < minLeaf || right.length < minLeaf) continue
      const weighted = (left.length * measure(left) + right.length * measure(right)) / points.length
      if (!best || weighted < best.impurity - 1e-12) best = { feature, threshold, impurity: weighted, left, right }
    }
  }
  // Like scikit-learn, a split is kept unless it makes impurity worse.
  if (!best || best.impurity > impurity + 1e-12) return leaf

  return {
    leaf: false,
    feature: best.feature,
    threshold: best.threshold,
    counts,
    depth,
    impurity,
    left: buildTree(best.left, options, depth + 1),
    right: buildTree(best.right, options, depth + 1),
  }
}

export const predictTree = (node, p) => (node.leaf ? node.prediction : predictTree(p[node.feature] <= node.threshold ? node.left : node.right, p))

export const countLeaves = (node) => (node.leaf ? 1 : countLeaves(node.left) + countLeaves(node.right))

export const treeDepth = (node) => (node.leaf ? node.depth : Math.max(treeDepth(node.left), treeDepth(node.right)))

// ---------- Random forest ----------

// Each tree is grown on a bootstrap sample and remembers which training indices it saw (inBag) for OOB scoring.
// maxFeatures 1: each split considers one random feature (sqrt(2) ≈ 1); maxFeatures 2: both features (plain bagging).
export function buildForest(points, { trees = 25, maxDepth = 4, minLeaf = 1, maxFeatures = 1, bootstrap = true, random }) {
  return Array.from({ length: trees }, () => {
    const indices = Array.from({ length: points.length }, (_, i) => (bootstrap ? Math.floor(random() * points.length) : i))
    const sample = indices.map((i) => points[i])
    const chooseFeatures = maxFeatures >= 2 ? () => ['x', 'y'] : () => [random() < 0.5 ? 'x' : 'y']
    const tree = buildTree(sample, { maxDepth, minLeaf, chooseFeatures })
    tree.inBag = new Set(indices)
    return tree
  })
}

// Out-of-bag accuracy: each training point is voted on only by the trees that never saw it.
export function oobScore(forest, points) {
  let correct = 0
  let counted = 0
  points.forEach((p, i) => {
    let votes = 0
    let voters = 0
    forest.forEach((tree) => {
      if (tree.inBag && !tree.inBag.has(i)) {
        votes += predictTree(tree, p)
        voters++
      }
    })
    if (voters) {
      counted++
      if ((votes * 2 >= voters ? 1 : 0) === p.label) correct++
    }
  })
  return counted ? correct / counted : null
}

export function forestVote(forest, p) {
  const votes = forest.reduce((sum, tree) => sum + predictTree(tree, p), 0)
  return { label: votes * 2 >= forest.length ? 1 : 0, share: votes / forest.length }
}

// ---------- Perceptron ----------

// One pass over the data. Labels are 0/1; the perceptron uses the step activation.
export function perceptronEpoch(points, weights, { rate = 0.1 } = {}) {
  let [w1, w2, b] = weights
  let errors = 0
  for (const p of points) {
    const output = w1 * p.x + w2 * p.y + b >= 0 ? 1 : 0
    const error = p.label - output
    if (error !== 0) {
      errors++
      w1 += rate * error * p.x
      w2 += rate * error * p.y
      b += rate * error
    }
  }
  return { weights: [w1, w2, b], errors }
}

// ---------- Linear support vector machine (soft margin) ----------

export const linearKernel = (p, q) => p.x * q.x + p.y * q.y
export const rbfKernel = (gamma) => (p, q) => Math.exp(-gamma * ((p.x - q.x) ** 2 + (p.y - q.y) ** 2))

// Soft-margin linear SVM trained with simplified SMO (Platt). Labels 0/1 become −1/+1.
export function trainLinearSvm(points, C, options) {
  return trainSvm(points, C, { ...options, kernel: linearKernel })
}

// Soft-margin kernel SVM (simplified SMO). decision(p) > 0 predicts label 1.
export function trainSvm(points, C, { kernel: kernelFn = linearKernel, tolerance = 1e-3, maxPasses = 15, maxIterations = 400 } = {}) {
  const n = points.length
  const y = points.map((p) => (p.label === 1 ? 1 : -1))
  const matrix = points.map((p) => points.map((q) => kernelFn(p, q)))
  const kernel = (i, j) => matrix[i][j]
  const alphas = new Array(n).fill(0)
  const random = seeded(1)
  let b = 0
  let passes = 0
  let iterations = 0

  const output = (i) => {
    let sum = b
    for (let k = 0; k < n; k++) if (alphas[k] > 0) sum += alphas[k] * y[k] * kernel(k, i)
    return sum
  }

  while (passes < maxPasses && iterations < maxIterations) {
    iterations++
    let changed = 0
    for (let i = 0; i < n; i++) {
      const errorI = output(i) - y[i]
      if (!((y[i] * errorI < -tolerance && alphas[i] < C) || (y[i] * errorI > tolerance && alphas[i] > 0))) continue
      let j = Math.floor(random() * (n - 1))
      if (j >= i) j++
      const errorJ = output(j) - y[j]
      const oldI = alphas[i]
      const oldJ = alphas[j]
      const low = y[i] !== y[j] ? Math.max(0, oldJ - oldI) : Math.max(0, oldI + oldJ - C)
      const high = y[i] !== y[j] ? Math.min(C, C + oldJ - oldI) : Math.min(C, oldI + oldJ)
      if (low === high) continue
      const eta = 2 * kernel(i, j) - kernel(i, i) - kernel(j, j)
      if (eta >= 0) continue
      alphas[j] = Math.min(high, Math.max(low, oldJ - (y[j] * (errorI - errorJ)) / eta))
      if (Math.abs(alphas[j] - oldJ) < 1e-6) continue
      alphas[i] = oldI + y[i] * y[j] * (oldJ - alphas[j])
      const b1 = b - errorI - y[i] * (alphas[i] - oldI) * kernel(i, i) - y[j] * (alphas[j] - oldJ) * kernel(i, j)
      const b2 = b - errorJ - y[i] * (alphas[i] - oldI) * kernel(i, j) - y[j] * (alphas[j] - oldJ) * kernel(j, j)
      if (alphas[i] > 0 && alphas[i] < C) b = b1
      else if (alphas[j] > 0 && alphas[j] < C) b = b2
      else b = (b1 + b2) / 2
      changed++
    }
    passes = changed === 0 ? passes + 1 : 0
  }

  const w1 = alphas.reduce((sum, a, i) => sum + a * y[i] * points[i].x, 0)
  const w2 = alphas.reduce((sum, a, i) => sum + a * y[i] * points[i].y, 0)
  const norm = Math.hypot(w1, w2)
  const active = alphas.map((a, i) => ({ a: a * y[i], point: points[i] })).filter((entry) => Math.abs(entry.a) > 1e-6)
  return {
    // w and marginWidth are only meaningful for the linear kernel.
    w: [w1, w2],
    b,
    marginWidth: norm === 0 ? Infinity : 2 / norm,
    supportVectors: points.filter((_, i) => alphas[i] > 1e-6),
    decision: (p) => active.reduce((sum, entry) => sum + entry.a * kernelFn(entry.point, p), b),
  }
}
