const sigmoid = (z) => 1 / (1 + Math.exp(-z))

// Solves a 3x3 linear system with Gaussian elimination (partial pivoting).
function solve3(matrix, rhs) {
  const m = matrix.map((row, i) => [...row, rhs[i]])
  for (let col = 0; col < 3; col++) {
    let pivot = col
    for (let row = col + 1; row < 3; row++) {
      if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row
    }
    ;[m[col], m[pivot]] = [m[pivot], m[col]]
    for (let row = 0; row < 3; row++) {
      if (row === col) continue
      const factor = m[row][col] / m[col][col]
      for (let c = col; c < 4; c++) m[row][c] -= factor * m[col][c]
    }
  }
  return m.map((row, i) => row[3] / row[i])
}

// Two-feature logistic regression with the same objective as scikit-learn's default
// LogisticRegression (L2 penalty, C = 1, unpenalised intercept), solved with Newton's method.
export function trainLogistic(features, labels, maxSteps = 50) {
  let w1 = 0
  let w2 = 0
  let b = 0

  for (let step = 0; step < maxSteps; step++) {
    const gradient = [w1, w2, 0]
    const hessian = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 0],
    ]
    features.forEach(([x1, x2], i) => {
      const p = sigmoid(w1 * x1 + w2 * x2 + b)
      const residual = p - labels[i]
      const weight = p * (1 - p)
      const v = [x1, x2, 1]
      for (let r = 0; r < 3; r++) {
        gradient[r] += residual * v[r]
        for (let c = 0; c < 3; c++) hessian[r][c] += weight * v[r] * v[c]
      }
    })
    const [d1, d2, d3] = solve3(hessian, gradient)
    w1 -= d1
    w2 -= d2
    b -= d3
    if (Math.abs(d1) + Math.abs(d2) + Math.abs(d3) < 1e-12) break
  }

  const predict = ([x1, x2]) => (w1 * x1 + w2 * x2 + b > 0 ? 1 : 0)
  const score = (rows, answers) => rows.filter((row, i) => predict(row) === answers[i]).length / rows.length
  return { w1, w2, b, predict, score }
}

// Formats a number the way Python's print() shows a float (1 -> "1.0").
export const pythonFloat = (value) => (Number.isInteger(value) ? value.toFixed(1) : String(value))
