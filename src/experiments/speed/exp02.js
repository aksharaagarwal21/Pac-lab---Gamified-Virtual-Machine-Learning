// Experiment 2 speed code: linear regression written from scratch, typed part by part.

export const speedTest = {
  title: 'Linear regression from scratch',
  fileName: 'linear_regression.py',
  parts: [
    {
      title: 'Load the data',
      explain: 'Hours studied (x) and exam scores (y) for eight students. The model will learn how y changes with x.',
      code: `hours = [1, 2, 3, 4, 5, 6, 7, 8]
scores = [52, 55, 61, 64, 70, 72, 79, 83]
print("samples:", len(hours))`,
    },
    {
      title: 'Fit the line with least squares',
      explain: 'The slope is the covariance of x and y divided by the variance of x. The best line always passes through the two means.',
      code: `def mean(values):
    return sum(values) / len(values)


def fit_line(xs, ys):
    mx, my = mean(xs), mean(ys)
    top = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    bottom = sum((x - mx) ** 2 for x in xs)
    slope = top / bottom
    return slope, my - slope * mx`,
    },
    {
      title: 'Make predictions',
      explain: 'A prediction is just the line evaluated at x: y = slope * x + intercept.',
      code: `def predict(slope, intercept, xs):
    return [slope * x + intercept for x in xs]`,
    },
    {
      title: 'Measure the error',
      explain: 'MSE averages the squared residuals. R2 compares that error with simply predicting the mean every time.',
      code: `def mse(actual, predicted):
    return mean([(a - p) ** 2 for a, p in zip(actual, predicted)])


def r2(actual, predicted):
    my = mean(actual)
    ss_res = sum((a - p) ** 2 for a, p in zip(actual, predicted))
    ss_tot = sum((a - my) ** 2 for a in actual)
    return 1 - ss_res / ss_tot`,
    },
    {
      title: 'Learn the line with gradient descent',
      explain: 'Instead of the formula, start at zero and repeatedly step against the gradient of the MSE. It should reach the same line.',
      code: `def gradient_descent(xs, ys, rate=0.02, steps=5000):
    slope, intercept = 0.0, 0.0
    n = len(xs)
    for _ in range(steps):
        errors = [slope * x + intercept - y for x, y in zip(xs, ys)]
        slope -= rate * 2 * sum(e * x for e, x in zip(errors, xs)) / n
        intercept -= rate * 2 * sum(errors) / n
    return slope, intercept`,
    },
    {
      title: 'Train, evaluate and predict',
      explain: 'Fit the line, report its error, compare it with gradient descent and predict a new student.',
      code: `slope, intercept = fit_line(hours, scores)
predicted = predict(slope, intercept, hours)
print(f"score = {slope:.2f} * hours + {intercept:.2f}")
print(f"MSE = {mse(scores, predicted):.3f}")
print(f"R2 = {r2(scores, predicted):.3f}")

gd_slope, gd_intercept = gradient_descent(hours, scores)
print(f"gradient descent: slope {gd_slope:.2f}, intercept {gd_intercept:.2f}")
print("9 hours ->", round(slope * 9 + intercept, 1))`,
    },
  ],
}
