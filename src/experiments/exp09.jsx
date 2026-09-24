import { buildForest, buildTree, predictTree, seeded } from '../lib/ml.js'
import RandomForestSim, { forestCurves, makeForestData, voteLabel } from './sims/RandomForestSim.jsx'
import { posttest, pretest } from './quiz/exp09.js'

function cachedByInt(fn) {
  const cache = new Map()
  return (value) => {
    const key = Math.round(value)
    if (!cache.has(key)) cache.set(key, fn(key))
    return cache.get(key)
  }
}

function lazy(fn) {
  let value
  return () => (value ??= fn())
}

const accuracy = (predict, points) => points.filter((p) => predict(p) === p.label).length / points.length
const forestAccuracy = (forest, points) =>
  accuracy((p) => voteLabel(forest.reduce((sum, tree) => sum + predictTree(tree, p), 0), forest.length), points)
const pct = (v) => `${(100 * v).toFixed(1)}%`

const NOISY = lazy(() => ({ train: makeForestData('noisy', 91), test: makeForestData('noisy', 92, 400) }))
const TREES_RUN = lazy(() => {
  const { train, test } = NOISY()
  const forest = buildForest(train, { trees: 100, maxDepth: 10, random: seeded(7) })
  const single = buildTree(train, { maxDepth: 10 })
  return { curves: forestCurves(forest, train, test), single: accuracy((p) => predictTree(single, p), test) }
})

export default {
  aim: [
    {
      p: 'To classify data with a Random Forest, understand how bootstrap sampling, random feature selection and majority voting turn many unstable decision trees into a stable, accurate ensemble, and to evaluate it with out-of-bag and test accuracy.',
    },
    { h2: 'Learning outcomes' },
    {
      list: [
        'Explain ensemble learning and why averaging reduces variance.',
        'Describe bootstrap sampling, bagging and random feature selection at each split.',
        'Estimate generalisation with the out-of-bag (OOB) score.',
        'Study the effect of the number of trees, tree depth and max_features.',
        'Train, tune and interpret a random forest (including feature importance) with scikit-learn.',
      ],
    },
  ],

  theory: {
    activity: {
      tasks: [
        {
          title: 'Add trees to the vote',
          shortTitle: 'Add trees to the vote',
          subtitle: 'Connect the number of trees to accuracy.',
          predict: {
            prompt: 'Deep trees (max depth 10) are grown on bootstrap samples of noisy data. As the forest grows from 1 to 100 trees, how does test accuracy change?',
            options: ['It rises quickly, then levels off', 'It keeps rising steadily to 100%', 'It falls because the forest overfits'],
            answer: 0,
          },
          manipulate: { label: 'Number of trees', min: 1, max: 100, step: 1, initial: 1 },
          evaluate: cachedByInt((trees) => {
            const run = TREES_RUN()
            const forest = run.curves.testCurve[trees - 1].y / 100
            return {
              y: 100 * forest,
              metrics: [
                { label: 'Forest test accuracy', value: pct(forest) },
                { label: 'Single deep tree', value: pct(run.single) },
                { label: 'Out-of-bag accuracy', value: `${run.curves.oobCurve[trees - 1].y.toFixed(1)}%` },
              ],
            }
          }),
          chart: { xLabel: 'Number of trees', yLabel: 'Test accuracy (%)' },
          observe:
            'One bootstrapped tree is no better than a single tree. The first ten or so trees add most of the improvement; after about 25 trees the curve flattens because each new tree barely changes the majority vote.',
          limit: 'Adding trees does not make a forest overfit. It only reduces variance, and that benefit runs out.',
          reason: {
            prompt: 'Why does accuracy stop improving after enough trees?',
            options: [
              'The average vote has stabilised; the remaining errors come from bias and the correlation between trees',
              'The forest runs out of training data',
              'Later trees are ignored',
            ],
            answer: 0,
            explain: 'Averaging removes the independent part of the trees’ errors, not the part they share.',
          },
        },
        {
          title: 'Let every tree grow deeper',
          shortTitle: 'Let every tree grow deeper',
          subtitle: 'Connect tree depth to the benefit of voting.',
          predict: {
            prompt: 'A single tree and a 50-tree forest use the same max depth. As depth grows from 1 to 10 on noisy data, what happens?',
            options: [
              'The single tree’s test accuracy drops at large depths while the forest stays high',
              'Both drop together',
              'The forest drops faster than the single tree',
            ],
            answer: 0,
          },
          manipulate: { label: 'Max depth', min: 1, max: 10, step: 1, initial: 1 },
          evaluate: cachedByInt((depth) => {
            const { train, test } = NOISY()
            const tree = buildTree(train, { maxDepth: depth })
            const forest = buildForest(train, { trees: 50, maxDepth: depth, random: seeded(7) })
            const forestTest = forestAccuracy(forest, test)
            return {
              y: 100 * forestTest,
              metrics: [
                { label: 'Forest test accuracy', value: pct(forestTest) },
                { label: 'Single tree test accuracy', value: pct(accuracy((p) => predictTree(tree, p), test)) },
                { label: 'Forest training accuracy', value: pct(forestAccuracy(forest, train)) },
              ],
            }
          }),
          chart: { xLabel: 'Max depth', yLabel: 'Forest test accuracy (%)' },
          observe:
            'Shallow trees underfit whether alone or together. Beyond depth 3 the single tree starts memorising noise and its test accuracy falls, while the forest keeps its accuracy even though its training accuracy approaches 100%.',
          limit: 'Because voting controls variance, random forests usually grow deep, unpruned trees.',
          reason: {
            prompt: 'Why can a forest use deep trees that would overfit alone?',
            options: [
              'Each deep tree overfits differently, so their errors partly cancel in the vote',
              'The forest prunes each tree automatically',
              'Deep trees have no variance',
            ],
            answer: 0,
            explain: 'Deep trees have low bias; the ensemble removes much of their high variance.',
          },
        },
        {
          title: 'Change the training set',
          shortTitle: 'Change the training set',
          subtitle: 'Connect ensembles to stability.',
          predict: {
            prompt: 'We draw eight different training sets from the same noisy source. How much does a single deep tree’s test accuracy vary compared with a forest’s?',
            options: ['The single tree varies much more', 'The forest varies much more', 'They vary equally'],
            answer: 0,
          },
          manipulate: { label: 'Training set number', min: 1, max: 8, step: 1, initial: 1 },
          evaluate: cachedByInt((index) => {
            const { test } = NOISY()
            const train = makeForestData('noisy', 299 + index)
            const tree = buildTree(train, { maxDepth: 10 })
            const forest = buildForest(train, { trees: 50, maxDepth: 10, random: seeded(index) })
            const treeTest = accuracy((p) => predictTree(tree, p), test)
            return {
              y: 100 * treeTest,
              metrics: [
                { label: 'Single tree test accuracy', value: pct(treeTest) },
                { label: 'Forest test accuracy', value: pct(forestAccuracy(forest, test)) },
                { label: 'Forest advantage', value: `${(100 * (forestAccuracy(forest, test) - treeTest)).toFixed(1)} points` },
              ],
            }
          }),
          chart: { xLabel: 'Training set number', yLabel: 'Single tree test accuracy (%)' },
          observe:
            'The chart shows the single tree: its accuracy jumps around by several points from one training set to the next. The forest’s accuracy (in the metrics) stays in a narrower, higher band, because each tree’s idiosyncrasies are outvoted.',
          limit: 'Lower variance means results you can trust more: retraining on new data gives a similar model.',
          reason: {
            prompt: 'Which statement describes the forest compared with one deep tree?',
            options: ['Similar bias, much lower variance', 'Much higher bias, same variance', 'Higher bias and higher variance'],
            answer: 0,
            explain: 'The trees are just as flexible, but their average is far more stable.',
          },
        },
      ],
    },
    notes: [
      { h2: '2.1 Ensemble Learning' },
      {
        p: 'An ensemble combines several models to get a prediction that is better than any one of them. Ensembles work best when the members are individually accurate but make different mistakes. Decision trees are ideal members: they are flexible (low bias) but unstable (high variance).',
      },
      { h2: '2.2 Bootstrap Sampling and Bagging' },
      {
        p: 'A bootstrap sample draws n rows from the n training rows with replacement. On average it contains about 63.2% of the distinct rows; the other 36.8% are out-of-bag for that model. Bagging (bootstrap aggregating) trains one model per bootstrap sample and aggregates their predictions.',
      },
      { eq: 'P(row not selected) = (1 − 1/n)ⁿ → 1/e ≈ 0.368' },
      { h2: '2.3 Random Feature Selection' },
      {
        p: 'If one feature is very strong, every bagged tree will split on it first and the trees will be highly correlated. A random forest considers only a random subset of max_features features at each split (by default √d for classification), which decorrelates the trees.',
      },
      { eq: 'Var(average of B trees) = ρσ² + (1 − ρ)σ²/B' },
      { p: 'More trees shrink the second term; less correlation (smaller ρ) lowers the floor set by the first term.' },
      { h2: '2.4 The Random Forest Algorithm' },
      {
        steps: [
          'For b = 1 to B: draw a bootstrap sample of the training data.',
          'Grow a decision tree on it; at every node, choose the best split among a random subset of max_features features.',
          'Grow each tree deep (typically without pruning).',
          'To classify a new point, collect every tree’s prediction and output the majority vote (scikit-learn averages class probabilities).',
        ],
      },
      { h2: '2.5 Out-of-Bag Evaluation' },
      {
        p: 'Each training row is out-of-bag for roughly a third of the trees. Predicting every row with only those trees gives the OOB accuracy, an almost free estimate of generalisation that needs no separate validation set.',
      },
      { h2: '2.6 Feature Importance' },
      {
        list: [
          'Mean decrease in impurity (feature_importances_): the total impurity reduction from splits on each feature, averaged over trees. Fast, but computed on training data and biased towards features with many distinct values.',
          'Permutation importance: shuffle one feature in held-out data and measure the drop in score. Slower, but more reliable.',
        ],
      },
      { h2: '2.7 Key Hyperparameters' },
      {
        table: {
          head: ['Parameter', 'Meaning', 'Typical effect'],
          rows: [
            [[{ code: 'n_estimators' }], 'Number of trees', 'More trees → more stable, slower; accuracy plateaus'],
            [[{ code: 'max_features' }], 'Features tried at each split', 'Smaller → more diverse trees'],
            [[{ code: 'max_depth' }], 'Depth limit per tree', 'None (fully grown) is common'],
            [[{ code: 'min_samples_leaf' }], 'Minimum samples per leaf', 'Larger → smoother predictions'],
            [[{ code: 'bootstrap, oob_score' }], 'Sampling and OOB evaluation', 'oob_score=True reports oob_score_'],
          ],
        },
      },
      { h2: '2.8 Strengths and Limitations' },
      {
        list: [
          'Strong accuracy out of the box with little tuning; robust to noise and outliers.',
          'Handles non-linear boundaries and feature interactions; no scaling needed.',
          'Trees train in parallel (n_jobs=-1).',
          'Less interpretable than a single tree; larger models and slower predictions.',
          'Cannot extrapolate beyond the range of the training data.',
          'Gradient boosting often achieves higher accuracy on tabular data, at the cost of more tuning.',
        ],
      },
    ],
  },

  procedure: [
    { h2: '4.1 V-Lab Workflow' },
    {
      steps: [
        'Load a labelled dataset (for example scikit-learn’s breast cancer dataset).',
        'Split the data into stratified training and test sets.',
        'Train a single DecisionTreeClassifier as a baseline and record its test accuracy.',
        'Train a RandomForestClassifier with n_estimators=200 and oob_score=True; compare OOB and test accuracy with the baseline.',
        'Plot test accuracy against the number of trees to see where it levels off.',
        'Tune max_features and min_samples_leaf with cross-validation.',
        'Inspect feature_importances_ and confirm the top features with permutation_importance on the test set.',
      ],
    },
    { h2: '4.2 Input → Process → Output' },
    {
      table: {
        head: ['Stage', 'Details'],
        rows: [
          ['Input', 'Labelled features (numerical or encoded categorical).'],
          ['Process', 'Bootstrap samples → deep trees with random feature subsets at each split → aggregate by voting.'],
          ['Output', 'Predicted classes and probabilities, OOB score, feature importances.'],
        ],
      },
    },
    { h2: '4.3 Key scikit-learn Tools' },
    {
      table: {
        head: ['Task', 'Class, attribute or function'],
        rows: [
          ['Build a forest', [{ code: "RandomForestClassifier(n_estimators=200, max_features='sqrt', oob_score=True, n_jobs=-1, random_state=42)" }]],
          ['OOB estimate', [{ code: 'model.oob_score_' }]],
          ['Individual trees', [{ code: 'model.estimators_' }]],
          ['Importance', [{ code: 'model.feature_importances_' }, ', ', { code: 'permutation_importance(model, X_test, y_test)' }]],
          ['Class probabilities', [{ code: 'model.predict_proba(X)' }]],
        ],
      },
    },
  ],

  results: [
    { p: 'After completing the experiment, students should observe and interpret:' },
    {
      list: [
        'Forest test accuracy rising over the first trees and levelling off, without overfitting as trees are added.',
        'A forest of deep trees outperforming a single deep tree on noisy data.',
        'The diversity of individual trees trained on different bootstrap samples.',
        'The OOB accuracy as an estimate of test accuracy computed from training data alone.',
        'The effect of random feature selection compared with plain bagging.',
      ],
    },
    {
      note: {
        title: 'Conclusion.',
        text: 'Random forests reduce the variance of decision trees by averaging many decorrelated trees grown on bootstrap samples. They are accurate, robust and easy to use, trading away the simple interpretability of a single tree.',
      },
    },
  ],

  pretest,
  posttest,

  simulation: RandomForestSim,

  python: {
    title: 'Bootstraps, votes and out-of-bag rows',
    intro: 'Predict an outcome. Repair a mistake. Build a working function.',
    predict: {
      question: 'What will Python print?',
      task: 'Five trees vote for a point. What does the majority vote predict?',
      fileName: 'vote.py',
      code: 'votes = [1, 0, 1, 1, 0]\nprint(1 if sum(votes) * 2 >= len(votes) else 0)\n',
      options: ['1', '0', '0.6'],
      answer: 0,
    },
    repair: {
      question: 'Repair the bootstrap sample',
      task: 'A bootstrap sample must be drawn with replacement, so with 100 rows it should contain repeated rows. The check should print "True True". Fix the sampling line.',
      fileName: 'bootstrap.py',
      code: 'import random\n\nrandom.seed(1)\nrows = list(range(100))\nsample = random.sample(rows, len(rows))\nprint(len(sample) == len(rows), len(set(sample)) < len(rows))\n',
      expected: 'True True',
      hint: 'random.sample draws without replacement. Use random.choice(rows) once for each row instead.',
    },
    build: {
      question: 'Build the voting helpers',
      task: 'Complete majority_vote(predictions) (1 when at least half the votes are 1, otherwise 0), vote_share(predictions) (the fraction of votes for class 1) and out_of_bag(n, sample_indices) (a sorted list of the row indices from 0 to n − 1 that never appear in the sample).',
      fileName: 'forest_helpers.py',
      code: 'def majority_vote(predictions):\n    return 0\n\n\ndef vote_share(predictions):\n    return 0.0\n\n\ndef out_of_bag(n, sample_indices):\n    return []\n',
      tests: `assert majority_vote([1, 0, 1, 1, 0]) == 1, "three of five votes are 1"
assert majority_vote([0, 0, 1]) == 0, "two of three votes are 0"
assert majority_vote([1, 0]) == 1, "a tie goes to class 1"
assert abs(vote_share([1, 0, 1, 1]) - 0.75) < 1e-9, "vote_share([1, 0, 1, 1]) should be 0.75"
assert out_of_bag(5, [0, 0, 3, 3, 1]) == [2, 4], "rows 2 and 4 were never sampled"
assert out_of_bag(3, [2, 1, 0]) == [], "every row was sampled"
print("ALL TESTS PASSED")`,
      hint: 'For out_of_bag, use sorted(set(range(n)) - set(sample_indices)).',
    },
    explore: {
      question: 'Explore freely',
      task: 'Use "Use this data in Python" in the visual activity to grow the whole forest in Python, or check how the share of distinct rows in a bootstrap sample approaches 1 − 1/e ≈ 0.632.',
      fileName: 'explore.py',
      code: 'import random\n\nrandom.seed(0)\nfor n in [10, 100, 1000, 10000]:\n    rows = range(n)\n    shares = [len(set(random.choice(rows) for _ in rows)) / n for _ in range(20)]\n    print(f"n = {n:5d}: average share of distinct rows = {sum(shares) / len(shares):.3f}")\n',
    },
    reference: [
      {
        title: 'Forest vs single tree with OOB and importances',
        code: `from sklearn.datasets import load_breast_cancer
from sklearn.ensemble import RandomForestClassifier
from sklearn.inspection import permutation_importance
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier

data = load_breast_cancer()
X_train, X_test, y_train, y_test = train_test_split(data.data, data.target, stratify=data.target, random_state=42)

tree = DecisionTreeClassifier(random_state=42).fit(X_train, y_train)
forest = RandomForestClassifier(n_estimators=200, oob_score=True, n_jobs=-1, random_state=42).fit(X_train, y_train)
print("Single tree test accuracy:", round(tree.score(X_test, y_test), 3))
print("Forest OOB accuracy:", round(forest.oob_score_, 3), "test accuracy:", round(forest.score(X_test, y_test), 3))

result = permutation_importance(forest, X_test, y_test, n_repeats=10, random_state=42)
for i in result.importances_mean.argsort()[::-1][:5]:
    print(f"{data.feature_names[i]:25s} {result.importances_mean[i]:.3f}")`,
      },
    ],
  },

  references: [
    { text: 'Breiman, L. (2001). Random forests. Machine Learning, 45(1), 5–32.', url: 'https://doi.org/10.1023/A:1010933404324' },
    { text: 'Breiman, L. (1996). Bagging predictors. Machine Learning, 24(2), 123–140.', url: 'https://doi.org/10.1007/BF00058655' },
    { text: 'James, G., Witten, D., Hastie, T. & Tibshirani, R. (2021). An Introduction to Statistical Learning (2nd ed.), Section 8.2: Bagging, Random Forests, Boosting. Springer.', url: 'https://www.statlearning.com/' },
    { text: 'Hastie, T., Tibshirani, R. & Friedman, J. (2009). The Elements of Statistical Learning (2nd ed.), Chapter 15: Random Forests. Springer.', url: 'https://hastie.su.domains/ElemStatLearn/' },
    { text: 'scikit-learn User Guide — Ensembles: random forests', url: 'https://scikit-learn.org/stable/modules/ensemble.html#random-forests' },
  ],

  contributors: [{ name: 'PAC-LAB Virtual ML Lab team', role: 'Content, simulation and review' }],
}
