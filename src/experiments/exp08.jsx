import { buildTree, countLeaves, impurityOf } from '../lib/ml.js'
import DecisionTreeSim, { makeTreeData, treeAccuracy } from './sims/DecisionTreeSim.jsx'
import { posttest, pretest } from './quiz/exp08.js'

function cachedByInt(fn) {
  const cache = new Map()
  return (value) => {
    const key = Math.round(value)
    if (!cache.has(key)) cache.set(key, fn(key))
    return cache.get(key)
  }
}

const AXIS = makeTreeData('axis', 81)
const ROOT_GINI = impurityOf(AXIS)
const NOISY = { train: makeTreeData('noisy', 81), test: makeTreeData('noisy', 82) }
const XOR = { train: makeTreeData('xor', 81), test: makeTreeData('xor', 82) }

const depthMetrics = (data) => (depth) => {
  const tree = buildTree(data.train, { maxDepth: depth })
  const train = treeAccuracy(tree, data.train)
  const test = treeAccuracy(tree, data.test)
  return {
    y: 100 * test,
    metrics: [
      { label: 'Training accuracy', value: `${(100 * train).toFixed(1)}%` },
      { label: 'Test accuracy', value: `${(100 * test).toFixed(1)}%` },
      { label: 'Leaves', value: String(countLeaves(tree)) },
    ],
  }
}

export default {
  aim: [
    {
      p: 'To build a decision tree classifier, understand how splits are chosen using Gini impurity and information gain, visualise the resulting decision regions, and control overfitting with maximum depth, minimum leaf size and pruning.',
    },
    { h2: 'Learning outcomes' },
    {
      list: [
        'Describe the structure of a decision tree: root, internal nodes, branches and leaves.',
        'Compute Gini impurity, entropy and information gain for a split.',
        'Explain the greedy, top-down CART algorithm and its axis-aligned decision boundaries.',
        'Recognise overfitting in deep trees and control it with pre-pruning and cost-complexity pruning.',
        'Train, visualise and interpret a decision tree with scikit-learn.',
      ],
    },
  ],

  theory: {
    activity: {
      tasks: [
        {
          title: 'Slide the threshold of the first split',
          shortTitle: 'Slide the threshold of the first split',
          subtitle: 'Connect a split to impurity decrease.',
          predict: {
            prompt: 'The root node asks “x₂ ≤ threshold?”. As the threshold moves from 0.5 to 9.5, how does the weighted Gini impurity of the two child nodes behave?',
            options: ['It dips lowest at the threshold that best separates the classes', 'It stays equal to the root impurity', 'It is lowest at the extremes'],
            answer: 0,
          },
          manipulate: { label: 'Threshold on x₂', min: 0.5, max: 9.5, step: 0.5, initial: 0.5, digits: 1 },
          evaluate: (threshold) => {
            const left = AXIS.filter((p) => p.y <= threshold)
            const right = AXIS.filter((p) => p.y > threshold)
            const weighted = (left.length * impurityOf(left) + right.length * impurityOf(right)) / AXIS.length
            const describe = (group) => `n ${group.length}, Gini ${impurityOf(group).toFixed(3)}`
            return {
              y: weighted,
              metrics: [
                { label: 'Left (yes)', value: describe(left) },
                { label: 'Right (no)', value: describe(right) },
                { label: 'Weighted Gini', value: weighted.toFixed(3) },
                { label: 'Gini decrease', value: (ROOT_GINI - weighted).toFixed(3) },
              ],
            }
          },
          chart: { xLabel: 'Threshold on x₂', yLabel: 'Weighted Gini' },
          observe: `The root node starts with Gini ${ROOT_GINI.toFixed(3)}. Thresholds near the edges barely change anything because one child keeps almost all the samples. Around x₂ = 7 the upper group becomes mostly class 1, giving the lowest weighted impurity and the largest decrease.`,
          limit: 'Children are weighted by their size: a tiny pure group cannot make up for a large mixed one.',
          reason: {
            prompt: 'How does CART choose the root split?',
            options: [
              'It tries every feature and threshold and keeps the one with the largest impurity decrease',
              'It always splits the first feature at its median',
              'It picks the threshold that gives equal-sized children',
            ],
            answer: 0,
            explain: 'The same search repeats at every node on the samples that reach it.',
          },
        },
        {
          title: 'Grow a tree on noisy labels',
          shortTitle: 'Grow a tree on noisy labels',
          subtitle: 'Connect depth to overfitting.',
          predict: {
            prompt: '15% of the training labels are flipped at random. As max depth grows from 1 to 10, what happens?',
            options: [
              'Training accuracy climbs towards 100% while test accuracy stops improving after a few levels',
              'Both keep rising together',
              'Both fall steadily',
            ],
            answer: 0,
          },
          manipulate: { label: 'Max depth', min: 1, max: 10, step: 1, initial: 1 },
          evaluate: cachedByInt(depthMetrics(NOISY)),
          chart: { xLabel: 'Max depth', yLabel: 'Test accuracy (%)' },
          observe:
            'The first few levels capture the real rectangles and test accuracy rises to about 80%. After that the tree spends its new leaves isolating mislabelled points: training accuracy keeps climbing and the number of leaves grows several-fold, but test accuracy does not improve.',
          limit: 'Without a limit, a tree keeps splitting until every leaf is pure, which on noisy data means memorising the noise.',
          reason: {
            prompt: 'Which setting would you choose for this data?',
            options: ['A small depth (about 3) found with cross-validation', 'The deepest tree, because it has the best training accuracy', 'Depth 1, because it is simplest'],
            answer: 0,
            explain: 'It matches the best test accuracy with far fewer leaves, making it simpler and more reliable.',
          },
        },
        {
          title: 'Solve a checkerboard greedily',
          shortTitle: 'Solve a checkerboard greedily',
          subtitle: 'Connect greedy splitting to its blind spots.',
          predict: {
            prompt: 'Class 1 fills two diagonal quadrants of a 2 × 2 checkerboard. How does test accuracy change with max depth?',
            options: ['It stays near 50% for several levels, then jumps', 'It is perfect at depth 2', 'It rises smoothly from depth 1'],
            answer: 0,
          },
          manipulate: { label: 'Max depth', min: 1, max: 8, step: 1, initial: 1 },
          evaluate: cachedByInt(depthMetrics(XOR)),
          chart: { xLabel: 'Max depth', yLabel: 'Test accuracy (%)' },
          observe:
            'Two perfect splits (x₁ ≤ 5 and x₂ ≤ 5) would solve the checkerboard, but either one alone leaves both halves half class 0 and half class 1. With almost no impurity decrease available, the greedy search picks splits that follow random noise, and it takes several levels before the squares are isolated.',
          limit: 'Choosing the locally best split does not guarantee the globally best tree.',
          reason: {
            prompt: 'Why does the tree not find the two perfect splits at depth 2?',
            options: [
              'It evaluates one split at a time and cannot see that two splits together separate the classes',
              'Decision trees cannot split at 5',
              'Gini impurity is undefined for balanced classes',
            ],
            answer: 0,
            explain: 'Searching all combinations of splits is computationally intractable, so CART is greedy.',
          },
        },
      ],
    },
    notes: [
      { h2: '2.1 Structure of a Decision Tree' },
      {
        p: 'A decision tree is a flowchart of questions. The root node holds all training samples; each internal node tests one feature against a threshold (for example x₂ ≤ 6.95) and sends samples down the “yes” or “no” branch; each leaf predicts the majority class of the training samples that reach it.',
      },
      { h2: '2.2 Measuring Impurity' },
      { eq: 'Gini(t) = 1 − Σₖ pₖ²          Entropy(t) = −Σₖ pₖ log₂ pₖ' },
      {
        table: {
          head: ['Class mix at a node', 'Gini', 'Entropy (bits)'],
          rows: [
            ['100% / 0%', '0.000', '0.000'],
            ['90% / 10%', '0.180', '0.469'],
            ['75% / 25%', '0.375', '0.811'],
            ['50% / 50%', '0.500', '1.000'],
          ],
        },
      },
      { h2: '2.3 Choosing a Split' },
      { eq: 'Impurity decrease = I(parent) − (n_left/n)·I(left) − (n_right/n)·I(right)' },
      {
        p: 'For every feature, CART sorts the values and tests the midpoint between each pair of consecutive values. The split with the largest impurity decrease is kept. With entropy, this decrease is called information gain.',
      },
      { h2: '2.4 The CART Algorithm' },
      {
        steps: [
          'Start with all training samples at the root.',
          'Find the feature and threshold with the largest impurity decrease.',
          'Split the samples into two child nodes.',
          'Repeat recursively on each child.',
          'Stop when a node is pure, reaches max_depth, has fewer than min_samples_split samples, or no split keeps min_samples_leaf samples on both sides.',
          'Label each leaf with its majority class (and class proportions for predict_proba).',
        ],
      },
      { p: 'The search is greedy: each split is locally optimal, but the tree as a whole is not guaranteed to be the best possible tree.' },
      { h2: '2.5 Overfitting and Pruning' },
      {
        p: 'A fully grown tree can reach 100% training accuracy by giving noisy points their own leaves. Trees are therefore high-variance models, and their complexity must be controlled:',
      },
      {
        table: {
          head: ['Technique', 'scikit-learn parameter', 'Effect'],
          rows: [
            ['Limit depth', [{ code: 'max_depth' }], 'Caps the number of questions per prediction'],
            ['Minimum node size to split', [{ code: 'min_samples_split' }], 'Stops splitting small nodes'],
            ['Minimum leaf size', [{ code: 'min_samples_leaf' }], 'Every leaf averages over several samples'],
            ['Limit leaves', [{ code: 'max_leaf_nodes' }], 'Grows the best leaves first up to a limit'],
            ['Cost-complexity pruning', [{ code: 'ccp_alpha' }], 'Removes subtrees whose gain does not justify α per extra leaf'],
          ],
        },
      },
      { h2: '2.6 Strengths and Limitations' },
      {
        list: [
          'Easy to interpret and explain as if–then rules; no feature scaling needed.',
          'Handles non-linear relationships and feature interactions.',
          'Provides feature importances from the impurity decrease of each feature’s splits.',
          'Boundaries are axis-aligned, so diagonal boundaries need many splits.',
          'Unstable: small changes in the data can produce a very different tree.',
          'Greedy splitting can miss patterns such as XOR that need several splits together.',
        ],
      },
    ],
  },

  procedure: [
    { h2: '4.1 V-Lab Workflow' },
    {
      steps: [
        'Load a labelled dataset (for example scikit-learn’s breast cancer or iris dataset).',
        'Split the data into stratified training and test sets.',
        'Train a DecisionTreeClassifier with default settings and compare training and test accuracy.',
        'Print the rules with export_text or draw them with plot_tree, and inspect feature_importances_.',
        'Tune max_depth and min_samples_leaf with GridSearchCV (5-fold cross-validation).',
        'Optionally compute cost_complexity_pruning_path and choose ccp_alpha by cross-validation.',
        'Evaluate the final tree once on the test set with a confusion matrix.',
      ],
    },
    { h2: '4.2 Input → Process → Output' },
    {
      table: {
        head: ['Stage', 'Details'],
        rows: [
          ['Input', 'Labelled numerical (or encoded categorical) features.'],
          ['Process', 'Recursive greedy splitting by impurity decrease → stopping or pruning rules.'],
          ['Output', 'Tree of if–then rules, predicted classes, class probabilities, feature importances.'],
        ],
      },
    },
    { h2: '4.3 Key scikit-learn Tools' },
    {
      table: {
        head: ['Task', 'Class, attribute or function'],
        rows: [
          ['Build a tree', [{ code: "DecisionTreeClassifier(criterion='gini', max_depth=3, random_state=42)" }]],
          ['Show the rules', [{ code: 'export_text(model, feature_names=names)' }, ', ', { code: 'plot_tree(model)' }]],
          ['Feature importance', [{ code: 'model.feature_importances_' }]],
          ['Tree size', [{ code: 'model.get_depth()' }, ', ', { code: 'model.get_n_leaves()' }]],
          ['Pruning path', [{ code: 'model.cost_complexity_pruning_path(X_train, y_train)' }]],
        ],
      },
    },
  ],

  results: [
    { p: 'After completing the experiment, students should observe and interpret:' },
    {
      list: [
        'The root split chosen by the largest impurity decrease and the rectangular regions produced by the tree.',
        'Training accuracy rising towards 100% with depth while test accuracy levels off or falls (overfitting).',
        'How a larger minimum leaf size or a smaller maximum depth simplifies the tree and can improve test accuracy.',
        'The staircase approximation of a diagonal boundary and the difficulty greedy splitting has with XOR patterns.',
        'That Gini impurity and entropy usually produce similar trees.',
      ],
    },
    {
      note: {
        title: 'Conclusion.',
        text: 'Decision trees turn data into readable rules by greedily choosing the purest splits. Their flexibility makes them prone to overfitting, so depth, leaf size or pruning must be tuned with cross-validation.',
      },
    },
  ],

  pretest,
  posttest,

  simulation: DecisionTreeSim,

  python: {
    title: 'Impurity, gain and the best split',
    intro: 'Predict an outcome. Repair a mistake. Build a working function.',
    predict: {
      question: 'What will Python print?',
      task: 'A node holds labels [1, 1, 1, 0]. What is its Gini impurity?',
      fileName: 'gini.py',
      code: 'labels = [1, 1, 1, 0]\np = sum(labels) / len(labels)\nprint(1 - p * p - (1 - p) * (1 - p))\n',
      options: ['0.375', '0.5', '0.75'],
      answer: 0,
    },
    repair: {
      question: 'Repair the weighted impurity',
      task: 'The left child has 4 samples with Gini 0.375 and the right child has 2 samples with Gini 0. The weighted impurity of the split should be 0.25. Fix the bug.',
      fileName: 'weighted.py',
      code: 'n_left, gini_left = 4, 0.375\nn_right, gini_right = 2, 0.0\nweighted = (gini_left + gini_right) / 2\nprint(round(weighted, 4))\n',
      expected: '0.25',
      hint: 'Weight each child’s impurity by its number of samples, then divide by the total number of samples.',
    },
    build: {
      question: 'Build the split scorer',
      task: 'Complete gini(labels) for a list of 0/1 labels (return 0 for an empty list) and gini_gain(parent, left, right), the parent’s Gini minus the size-weighted Gini of the two children.',
      fileName: 'split_score.py',
      code: 'def gini(labels):\n    # 1 - p1^2 - p0^2, or 0.0 for an empty list\n    return 0.0\n\n\ndef gini_gain(parent, left, right):\n    # gini(parent) - weighted gini of the children\n    return 0.0\n',
      tests: `assert abs(gini([0, 0, 1, 1]) - 0.5) < 1e-9, "gini([0, 0, 1, 1]) should be 0.5"
assert gini([1, 1, 1]) == 0, "a pure node has Gini 0"
assert gini([]) == 0, "an empty node has Gini 0"
assert abs(gini_gain([0, 0, 1, 1], [0, 0], [1, 1]) - 0.5) < 1e-9, "a perfect split of a 50/50 node gains 0.5"
assert abs(gini_gain([0, 1, 0, 1], [0, 1], [0, 1])) < 1e-9, "a split that leaves both sides 50/50 gains nothing"
assert abs(gini_gain([0, 0, 0, 1, 1, 1], [0, 0, 0, 1], [1, 1]) - 0.25) < 1e-9, "0.5 - (4 * 0.375 + 2 * 0) / 6 = 0.25"
print("ALL TESTS PASSED")`,
      hint: 'gini_gain = gini(parent) - (len(left) * gini(left) + len(right) * gini(right)) / len(parent).',
    },
    explore: {
      question: 'Explore freely',
      task: 'Use "Use this data in Python" in the visual activity to grow the same tree in Python and print its rules, or search for the best threshold on the small dataset below.',
      fileName: 'explore.py',
      code: 'hours = [1, 2, 3, 4, 5, 6, 7, 8]\npassed = [0, 0, 0, 1, 0, 1, 1, 1]\n\ndef gini(labels):\n    if not labels:\n        return 0.0\n    p = sum(labels) / len(labels)\n    return 1 - p * p - (1 - p) * (1 - p)\n\nfor a, b in zip(hours, hours[1:]):\n    t = (a + b) / 2\n    left = [y for x, y in zip(hours, passed) if x <= t]\n    right = [y for x, y in zip(hours, passed) if x > t]\n    weighted = (len(left) * gini(left) + len(right) * gini(right)) / len(passed)\n    print(f"hours <= {t}: weighted Gini = {weighted:.3f}")\n',
    },
    reference: [
      {
        title: 'Tuned decision tree with readable rules',
        code: `from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import GridSearchCV, train_test_split
from sklearn.tree import DecisionTreeClassifier, export_text

data = load_breast_cancer()
X_train, X_test, y_train, y_test = train_test_split(data.data, data.target, stratify=data.target, random_state=42)

full = DecisionTreeClassifier(random_state=42).fit(X_train, y_train)
print("Unrestricted tree: depth", full.get_depth(), "leaves", full.get_n_leaves(),
      "train", round(full.score(X_train, y_train), 3), "test", round(full.score(X_test, y_test), 3))

grid = {"max_depth": [2, 3, 4, 5, None], "min_samples_leaf": [1, 5, 10, 20]}
search = GridSearchCV(DecisionTreeClassifier(random_state=42), grid, cv=5).fit(X_train, y_train)
best = search.best_estimator_
print("Best parameters:", search.best_params_, "test accuracy:", round(best.score(X_test, y_test), 3))
print(export_text(best, feature_names=list(data.feature_names)))`,
      },
    ],
  },

  references: [
    { text: 'Breiman, L., Friedman, J., Olshen, R. & Stone, C. (1984). Classification and Regression Trees. Wadsworth.' },
    { text: 'Quinlan, J. R. (1986). Induction of decision trees. Machine Learning, 1(1), 81–106.', url: 'https://doi.org/10.1007/BF00116251' },
    { text: 'James, G., Witten, D., Hastie, T. & Tibshirani, R. (2021). An Introduction to Statistical Learning (2nd ed.), Chapter 8: Tree-Based Methods. Springer.', url: 'https://www.statlearning.com/' },
    { text: 'Hastie, T., Tibshirani, R. & Friedman, J. (2009). The Elements of Statistical Learning (2nd ed.), Section 9.2. Springer.', url: 'https://hastie.su.domains/ElemStatLearn/' },
    { text: 'scikit-learn User Guide — Decision Trees', url: 'https://scikit-learn.org/stable/modules/tree.html' },
  ],

  contributors: [{ name: 'PAC-LAB Virtual ML Lab team', role: 'Content, simulation and review' }],
}
