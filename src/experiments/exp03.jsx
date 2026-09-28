import { gaussian, kFolds, mean, polyFit, polyPredict, seeded } from '../lib/ml.js'
import CVMaze from './sims/cvMaze/CVMaze.jsx'
import { posttest, pretest } from './quiz/exp03.js'

// Fixed data for the "tune the degree" activity: a noisy cubic, scored with real 5-fold cross-validation.
const THEORY_DATA = (() => {
  const random = seeded(77)
  return Array.from({ length: 30 }, (_, i) => {
    const x = -1 + (2 * i) / 29
    return { x, y: 1.2 * x ** 3 - 0.8 * x + 0.2 * gaussian(random) }
  })
})()
const THEORY_FOLDS = kFolds(THEORY_DATA.length, 5, seeded(7))
const squaredError = (points, coefficients) => mean(points.map((p) => (p.y - polyPredict(coefficients, p.x)) ** 2))
const degreeScores = new Map()

function scoreDegree(degree) {
  if (!degreeScores.has(degree)) {
    const cv = mean(
      THEORY_FOLDS.map((testIndices) => {
        const test = new Set(testIndices)
        const coefficients = polyFit(
          THEORY_DATA.filter((_, i) => !test.has(i)),
          degree,
        )
        return squaredError(
          testIndices.map((i) => THEORY_DATA[i]),
          coefficients,
        )
      }),
    )
    degreeScores.set(degree, { cv, train: squaredError(THEORY_DATA, polyFit(THEORY_DATA, degree)) })
  }
  return degreeScores.get(degree)
}

export default {
  aim: [
    {
      p: 'To evaluate machine learning models reliably using k-fold cross-validation, compare it with a single train–test split, and use cross-validated scores to choose model complexity without overfitting or leaking information.',
    },
    { h2: 'Learning outcomes' },
    {
      list: [
        'Describe the hold-out method and explain why a single split can give an unreliable estimate.',
        'Carry out k-fold, stratified k-fold and leave-one-out cross-validation.',
        'Summarise fold scores with a mean and standard deviation and interpret the spread.',
        'Use cross-validation to compare hyperparameter settings and detect underfitting and overfitting.',
        'Avoid leakage by placing pre-processing inside pipelines and keeping a final untouched test set.',
      ],
    },
  ],

  theory: {
    activity: {
      tasks: [
        {
          title: 'Change the number of folds',
          shortTitle: 'Change the number of folds',
          subtitle: 'Connect k to training data and computation.',
          predict: {
            prompt: 'A dataset has 100 samples. As k grows, what happens to the data each model trains on?',
            options: ['It grows, but more models must be trained', 'It shrinks', 'It stays the same'],
            answer: 0,
          },
          manipulate: { label: 'Number of folds (k)', min: 2, max: 20, step: 1, initial: 2 },
          evaluate: (k) => {
            const folds = Math.round(k)
            const validation = 100 / folds
            return {
              y: 100 - validation,
              metrics: [
                { label: 'Training rows per round', value: (100 - validation).toFixed(1) },
                { label: 'Validation rows per round', value: validation.toFixed(1) },
                { label: 'Models to train', value: String(folds) },
              ],
            }
          },
          chart: { xLabel: 'k', yLabel: 'Training rows' },
          observe:
            'Each round trains on (k − 1)/k of the data. More folds means each model sees more data, so the estimate is less pessimistic, but you pay with k separate training runs.',
          limit: 'With k = number of samples you get leave-one-out: maximum training data, maximum cost.',
          reason: {
            prompt: 'Why are k = 5 and k = 10 popular choices?',
            options: ['They balance training data per round against computation', 'scikit-learn only allows those values', 'They remove all bias and variance'],
            answer: 0,
            explain: 'Five or ten folds train on 80–90% of the data while needing only a handful of fits.',
          },
        },
        {
          title: 'Average more fold scores',
          shortTitle: 'Average more fold scores',
          subtitle: 'Connect averaging to a steadier estimate.',
          predict: {
            prompt: 'Each fold score has a spread of about ±0.06. What happens when you average more fold scores?',
            options: ['The estimate becomes steadier', 'The estimate becomes less reliable', 'Nothing changes'],
            answer: 0,
          },
          manipulate: { label: 'Fold scores averaged', min: 1, max: 20, step: 1, initial: 1 },
          evaluate: (count) => {
            const m = Math.round(count)
            const spread = 0.06 / Math.sqrt(m)
            return {
              y: spread,
              metrics: [
                { label: 'Spread of one score', value: '0.060' },
                { label: 'Spread of the average', value: spread.toFixed(3) },
              ],
            }
          },
          chart: { xLabel: 'Scores averaged', yLabel: 'Spread (std)' },
          observe:
            'If scores were independent, the spread of their average would shrink like 1/√m. Fold scores share training data, so the real gain is smaller, but averaging still steadies the estimate compared with one split.',
          limit: 'Repeated k-fold (running k-fold several times with different shuffles) averages even more scores.',
          reason: {
            prompt: 'Why report fold scores as mean ± standard deviation?',
            options: ['It shows the expected score and how much it varies between splits', 'It doubles the accuracy', 'It hides the worst fold'],
            answer: 0,
            explain: 'The mean estimates performance; the standard deviation shows how sensitive that estimate is to the data split.',
          },
        },
        {
          title: 'Tune the model’s complexity',
          shortTitle: 'Tune the model’s complexity',
          subtitle: 'Connect model flexibility to validation error.',
          predict: {
            prompt: 'A polynomial is fitted to noisy cubic data. As the degree increases, what happens to cross-validated error?',
            options: ['It falls, then rises again', 'It always falls', 'It always rises'],
            answer: 0,
          },
          manipulate: { label: 'Polynomial degree', min: 1, max: 9, step: 1, initial: 1 },
          evaluate: (value) => {
            const degree = Math.round(value)
            const { cv, train } = scoreDegree(degree)
            return {
              y: Math.min(cv, 0.3),
              metrics: [
                { label: 'Training MSE', value: train.toFixed(4) },
                { label: '5-fold CV MSE', value: cv.toFixed(4) },
              ],
            }
          },
          chart: { xLabel: 'Degree', yLabel: 'CV MSE' },
          observe:
            'Low degrees underfit, so both errors are high. Around the true complexity the cross-validated error is lowest. Higher degrees keep lowering training error but chase noise, so validation error climbs.',
          limit: 'If you try many settings, the best cross-validated score is itself slightly optimistic. Nested cross-validation or a final test set corrects this.',
          reason: {
            prompt: 'Why choose the degree with the lowest cross-validated error instead of the lowest training error?',
            options: ['Training error keeps falling with complexity and rewards overfitting', 'Training error is harder to compute', 'Cross-validation always picks degree 1'],
            answer: 0,
            explain: 'Only error measured on held-out data reveals when extra flexibility stops helping.',
          },
        },
      ],
    },
    notes: [
      { h2: '2.1 Why Evaluation Needs Unseen Data' },
      {
        p: 'A model is useful only if it performs well on new data. Scores computed on the training data are optimistic, because the model has already seen those samples and may have memorised their noise. Evaluation must therefore use data the model did not learn from.',
      },
      { h2: '2.2 The Hold-out Method' },
      {
        p: 'The simplest approach splits the data once into a training set and a test (or validation) set, for example 80/20. It is fast, but the score depends on which samples happen to land in the test set. On small datasets, a different random split can give a noticeably different result.',
      },
      { h2: '2.3 k-Fold Cross-Validation' },
      {
        steps: [
          'Shuffle the data (unless order matters) and split it into k folds of roughly equal size.',
          'For each fold i = 1 … k: train the model on the other k − 1 folds and evaluate it on fold i.',
          'Collect the k validation scores and summarise them.',
        ],
      },
      { eq: 'CV score = (1/k) · Σᵢ scoreᵢ         report mean ± standard deviation' },
      { p: 'Every sample is used for validation exactly once and for training k − 1 times, so all data contributes to both jobs.' },
      { h2: '2.4 Stratified k-Fold' },
      {
        p: 'For classification, stratified k-fold keeps the class proportions of the full dataset in every fold. This matters when classes are imbalanced: a plain random fold might contain very few examples of the rare class.',
      },
      { h2: '2.5 Leave-One-Out Cross-Validation (LOOCV)' },
      {
        p: 'LOOCV is k-fold with k equal to the number of samples: each model is trained on all but one sample and tested on that one. It uses the maximum training data but requires n model fits and its estimate can have high variance.',
      },
      { h2: '2.6 Choosing k: Bias, Variance and Cost' },
      {
        table: {
          head: ['Method', 'Training data per model', 'Models trained', 'Typical use'],
          rows: [
            ['Hold-out (80/20)', '80%', '1', 'Very large datasets, quick checks'],
            ['5-fold', '80%', '5', 'Common default'],
            ['10-fold', '90%', '10', 'Common default, smaller datasets'],
            ['Leave-one-out', 'n − 1 samples', 'n', 'Very small datasets'],
          ],
        },
      },
      { h2: '2.7 Hyperparameter Tuning with Cross-Validation' },
      {
        p: [
          'Hyperparameters (such as polynomial degree, tree depth or regularisation strength) are chosen by comparing their cross-validated scores. ',
          { code: 'GridSearchCV' },
          ' tries every combination in a grid and keeps the best. Because the best of many scores is slightly optimistic, keep a separate test set for the final evaluation, or use nested cross-validation: an inner loop tunes, an outer loop estimates performance.',
        ],
      },
      { h2: '2.8 Avoiding Leakage in Cross-Validation' },
      {
        list: [
          'Put scaling, imputation and feature selection inside a Pipeline so they are fitted on each training fold only.',
          'Never tune on the final test set.',
          ['For time series, use ', { code: 'TimeSeriesSplit' }, ' so models are always trained on the past and tested on the future.'],
          'Keep related samples (for example several rows from the same patient) in the same fold with GroupKFold.',
        ],
      },
    ],
  },

  procedure: [
    { h2: '4.1 V-Lab Workflow' },
    {
      steps: [
        'Load a dataset (for example the scikit-learn breast cancer or diabetes dataset) and hold back a final test set (20%).',
        'Build a Pipeline with the pre-processing steps and the model.',
        'Choose a splitter: KFold (regression) or StratifiedKFold (classification) with shuffle=True and a fixed random_state.',
        'Run cross_val_score on the training data and record the score of every fold.',
        'Compute the mean and standard deviation of the fold scores.',
        'Compare with single train–test splits using several different random_state values.',
        'Tune one hyperparameter with GridSearchCV, then refit the best model on all training data and evaluate it once on the test set.',
      ],
    },
    { h2: '4.2 Input → Process → Output' },
    {
      table: {
        head: ['Stage', 'Details'],
        rows: [
          ['Input', 'Training data, a model or pipeline, a choice of k and the hyperparameters to compare.'],
          ['Process', 'Split into k folds → train on k − 1 folds → validate on the remaining fold → repeat k times.'],
          ['Output', 'Per-fold scores, mean ± standard deviation, the best hyperparameters and a final test score.'],
        ],
      },
    },
    { h2: '4.3 Key scikit-learn Tools' },
    {
      table: {
        head: ['Task', 'Class or function'],
        rows: [
          ['Plain folds', [{ code: 'KFold(n_splits=5, shuffle=True, random_state=42)' }]],
          ['Class-balanced folds', [{ code: 'StratifiedKFold(n_splits=5)' }]],
          ['Score every fold', [{ code: 'cross_val_score(model, X, y, cv=5)' }]],
          ['Tune hyperparameters', [{ code: 'GridSearchCV(pipeline, param_grid, cv=5)' }]],
          ['Time-ordered data', [{ code: 'TimeSeriesSplit(n_splits=5)' }]],
        ],
      },
    },
  ],

  results: [
    { p: 'After completing the experiment, students should observe and interpret:' },
    {
      list: [
        'The individual fold scores and how much they differ from each other.',
        'The cross-validated mean ± standard deviation, and how it compares with the range of scores from single 80/20 splits.',
        'The effect of k: more folds train each model on more data but require more fits.',
        'The validation curve: training error falls steadily with model complexity, while cross-validated error falls and then rises.',
        'The hyperparameter chosen by cross-validation, and whether its final test score agrees with the cross-validated estimate.',
      ],
    },
    {
      note: {
        title: 'Conclusion.',
        text: 'Cross-validation gives a more reliable, data-efficient estimate of performance than a single split and is the standard tool for model selection. The final test set should still be used only once, at the end.',
      },
    },
  ],

  pretest,
  posttest,

  simulation: CVMaze,

  python: {
    title: 'Build cross-validation from first principles',
    intro: 'Predict an outcome. Repair a mistake. Build a working function.',
    predict: {
      question: 'What will Python print?',
      task: 'Ten indices are dealt into five folds with slicing. How many indices end up in the first fold?',
      fileName: 'folds.py',
      code: 'indices = list(range(10))\nfolds = [indices[i::5] for i in range(5)]\nprint(len(folds[0]))\n',
      options: ['2', '5', '10'],
      answer: 0,
    },
    repair: {
      question: 'Repair the training split',
      task: 'In each round the training set should contain every sample except the current test fold, so with 10 samples and 5 folds each training set has 8 samples. Fix the bug so the program prints [8, 8, 8, 8, 8].',
      fileName: 'kfold_bug.py',
      code: 'data = list(range(10))\nk = 5\nfolds = [data[i::k] for i in range(k)]\n\nsizes = []\nfor test in folds:\n    train = [x for x in data]\n    sizes.append(len(train))\nprint(sizes)\n',
      expected: '[8, 8, 8, 8, 8]',
      hint: 'Leave out the rows that belong to the test fold: add a condition to the list comprehension.',
    },
    build: {
      question: 'Build the k-fold helpers',
      task: 'Complete k_fold_indices(n, k), which deals indices 0…n−1 into k folds (fold i gets indices i, i+k, i+2k, …), and cv_summary(scores), which returns (mean, population standard deviation).',
      fileName: 'kfold.py',
      code: 'def k_fold_indices(n, k):\n    # return a list of k lists of indices\n    return []\n\n\ndef cv_summary(scores):\n    # return (mean, population standard deviation)\n    return 0.0, 0.0\n',
      tests: `folds = k_fold_indices(10, 3)
assert len(folds) == 3, "k_fold_indices(10, 3) should return 3 folds"
assert sorted(i for fold in folds for i in fold) == list(range(10)), "every index 0-9 should appear exactly once"
assert max(map(len, folds)) - min(map(len, folds)) <= 1, "fold sizes should differ by at most one"
assert folds[0] == [0, 3, 6, 9], "fold 0 should be [0, 3, 6, 9]"
mean, std = cv_summary([0.8, 0.9, 1.0])
assert abs(mean - 0.9) < 1e-9, "the mean of [0.8, 0.9, 1.0] is 0.9"
assert abs(std - 0.0816496580927726) < 1e-9, "the population std of [0.8, 0.9, 1.0] is about 0.0816"
print("ALL TESTS PASSED")`,
      hint: 'Slicing with a step does the dealing: list(range(n))[i::k]. For the std, average the squared differences from the mean, then take the square root.',
    },
    explore: {
      question: 'Explore freely',
      task: 'Use "Use this data in Python" in the visual activity to load full k-fold code for your chosen degree and k, or experiment below.',
      fileName: 'explore.py',
      code: 'scores = [0.81, 0.79, 0.84, 0.62, 0.80]\nmean = sum(scores) / len(scores)\nstd = (sum((s - mean) ** 2 for s in scores) / len(scores)) ** 0.5\nprint(f"accuracy = {mean:.3f} ± {std:.3f}")\nprint("worst fold:", min(scores))\n',
    },
    reference: [
      {
        title: 'Cross-validating a pipeline',
        code: `from sklearn.datasets import load_breast_cancer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

X, y = load_breast_cancer(return_X_y=True)
model = make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000))
cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

scores = cross_val_score(model, X, y, cv=cv)
print("Fold scores:", scores)
print(f"Accuracy: {scores.mean():.3f} ± {scores.std():.3f}")`,
      },
      {
        title: 'Tuning with GridSearchCV and a final test set',
        code: `from sklearn.model_selection import GridSearchCV, train_test_split

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)
grid = GridSearchCV(model, {"logisticregression__C": [0.01, 0.1, 1, 10]}, cv=cv)
grid.fit(X_train, y_train)

print("Best C:", grid.best_params_, "CV score:", grid.best_score_)
print("Test score:", grid.score(X_test, y_test))`,
      },
    ],
  },

  references: [
    { text: 'James, G., Witten, D., Hastie, T. & Tibshirani, R. (2021). An Introduction to Statistical Learning (2nd ed.), Chapter 5: Resampling Methods. Springer.', url: 'https://www.statlearning.com/' },
    { text: 'Hastie, T., Tibshirani, R. & Friedman, J. (2009). The Elements of Statistical Learning (2nd ed.), Section 7.10: Cross-Validation. Springer.' },
    { text: 'Kohavi, R. (1995). A study of cross-validation and bootstrap for accuracy estimation and model selection. Proceedings of IJCAI, 1137–1145.' },
    { text: 'Cawley, G. C. & Talbot, N. L. C. (2010). On over-fitting in model selection and subsequent selection bias in performance evaluation. JMLR, 11, 2079–2107.' },
    { text: 'scikit-learn User Guide — Cross-validation: evaluating estimator performance', url: 'https://scikit-learn.org/stable/modules/cross_validation.html' },
    { text: 'Raschka, S. (2018). Model Evaluation, Model Selection, and Algorithm Selection in Machine Learning. arXiv:1811.12808.', url: 'https://arxiv.org/abs/1811.12808' },
  ],

  contributors: [{ name: 'PAC-LAB Virtual ML Lab team', role: 'Content, simulation and review' }],
}
