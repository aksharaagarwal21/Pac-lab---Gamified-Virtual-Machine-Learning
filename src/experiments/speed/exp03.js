// Experiment 3 speed code: k-fold cross-validation written from scratch, typed part by part.

export const speedTest = {
  title: 'K-fold cross-validation from scratch',
  fileName: 'cross_validation.py',
  parts: [
    {
      title: 'Generate a noisy dataset',
      explain: 'Forty points on the line y = 2x + 1 with random noise. A fixed seed makes every run give the same numbers.',
      code: `import random

random.seed(3)
xs = [i / 10 for i in range(40)]
ys = [2 * x + 1 + random.gauss(0, 0.5) for x in xs]
print("samples:", len(xs))`,
    },
    {
      title: 'Deal the samples into k folds',
      explain: 'Shuffle the indices, then deal them like cards: fold i gets positions i, i + k, i + 2k and so on.',
      code: `def k_fold_indices(n, k):
    order = list(range(n))
    random.shuffle(order)
    return [order[i::k] for i in range(k)]`,
    },
    {
      title: 'The model and its error',
      explain: 'A least-squares line is the model. MSE scores it on whichever points it is given.',
      code: `def fit_line(xs, ys):
    n = len(xs)
    mx, my = sum(xs) / n, sum(ys) / n
    top = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    bottom = sum((x - mx) ** 2 for x in xs)
    slope = top / bottom
    return slope, my - slope * mx


def mse(xs, ys, slope, intercept):
    errors = [(y - (slope * x + intercept)) ** 2 for x, y in zip(xs, ys)]
    return sum(errors) / len(errors)`,
    },
    {
      title: 'Cross-validate',
      explain: 'Each fold takes one turn as the unseen test set. The model trains on every other fold and is scored only on the hidden one.',
      code: `def cross_validate(xs, ys, k):
    scores = []
    for test in k_fold_indices(len(xs), k):
        hidden = set(test)
        train = [i for i in range(len(xs)) if i not in hidden]
        slope, intercept = fit_line([xs[i] for i in train], [ys[i] for i in train])
        scores.append(mse([xs[i] for i in test], [ys[i] for i in test], slope, intercept))
    return scores`,
    },
    {
      title: 'Summarize and compare k',
      explain: 'The CV score is the mean of the fold scores; their spread shows how much one lucky or unlucky split could mislead you.',
      code: `def summarize(scores):
    mean = sum(scores) / len(scores)
    std = (sum((s - mean) ** 2 for s in scores) / len(scores)) ** 0.5
    return mean, std


for k in (3, 5, 10):
    scores = cross_validate(xs, ys, k)
    mean, std = summarize(scores)
    print(f"k={k}: folds {[round(s, 2) for s in scores]}")
    print(f"     CV MSE = {mean:.3f} +/- {std:.3f}")`,
    },
  ],
}
