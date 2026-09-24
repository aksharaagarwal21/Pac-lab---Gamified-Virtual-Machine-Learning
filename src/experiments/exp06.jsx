import SvmSim, { fitSvm, formatParam, makeSvmData, svmAccuracy } from './sims/SvmSim.jsx'
import { posttest, pretest } from './quiz/exp06.js'

// Training an SVM for every sampled slider value is costly, so cache results per value.
function cached(fn) {
  const cache = new Map()
  return (value) => {
    const key = value.toFixed(3)
    if (!cache.has(key)) cache.set(key, fn(value))
    return cache.get(key)
  }
}

const SEPARABLE = makeSvmData('separable', 61)
const OVERLAP = { train: makeSvmData('overlap', 61), test: makeSvmData('overlap', 62) }
const CIRCLES = { train: makeSvmData('circles', 61), test: makeSvmData('circles', 62) }

// Widest gap between the classes for a straight boundary with this tilt (degrees).
function gapForTilt(tilt) {
  const normal = ((tilt + 90) * Math.PI) / 180
  const project = (p) => p.x * Math.cos(normal) + p.y * Math.sin(normal)
  const pos = SEPARABLE.filter((p) => p.label).map(project)
  const neg = SEPARABLE.filter((p) => !p.label).map(project)
  return Math.max(Math.min(...pos) - Math.max(...neg), Math.min(...neg) - Math.max(...pos))
}

export default {
  aim: [
    {
      p: 'To classify data with a Support Vector Machine (SVM), understand how the maximum-margin boundary is determined by support vectors, and study how the penalty parameter C, the kernel and the RBF parameter γ affect the boundary, underfitting and overfitting.',
    },
    { h2: 'Learning outcomes' },
    {
      list: [
        'Explain the maximum-margin idea and the role of support vectors.',
        'Distinguish hard-margin and soft-margin SVMs and interpret the hinge loss.',
        'Describe how C trades margin width against training errors.',
        'Use the kernel trick to separate non-linear data with the RBF kernel, and tune γ.',
        'Train, tune and evaluate an SVM classifier with scikit-learn.',
      ],
    },
  ],

  theory: {
    activity: {
      tasks: [
        {
          title: 'Tilt the boundary to widen the street',
          shortTitle: 'Tilt the boundary to widen the street',
          subtitle: 'Connect boundary orientation to margin width.',
          predict: {
            prompt: 'Many straight lines separate two well-spread classes. As you tilt a separating line, what happens to the widest gap you can keep around it?',
            options: ['It changes, and one tilt gives the widest street', 'It is the same for every line that separates the data', 'It is always widest for a horizontal line'],
            answer: 0,
          },
          manipulate: { label: 'Boundary tilt (degrees)', min: 0, max: 179, step: 1, initial: 160 },
          evaluate: (tilt) => {
            const gap = gapForTilt(tilt)
            return {
              y: Math.max(gap, 0),
              metrics: [
                { label: 'Margin width', value: gap > 0 ? gap.toFixed(2) : '0 (classes overlap)' },
                { label: 'Separates classes', value: gap > 0 ? 'Yes' : 'No' },
                { label: 'SVM choice', value: 'widest street' },
              ],
            }
          },
          chart: { xLabel: 'Boundary tilt (degrees)', yLabel: 'Margin width' },
          observe:
            'Several tilts separate the two classes, but the street around them has very different widths. The SVM picks the tilt at the peak, where the gap is widest and the closest points on each side are equally far away.',
          limit: 'Only the few points touching the edges of the widest street decide its position; these are the support vectors.',
          reason: {
            prompt: 'Why prefer the boundary with the widest margin?',
            options: [
              'It leaves the most room for new points to fall on the correct side, so it tends to generalise better',
              'It always passes through the class centres',
              'It uses every training point equally',
            ],
            answer: 0,
            explain: 'A boundary that barely squeezes between the classes misclassifies new points that land slightly off the training data.',
          },
        },
        {
          title: 'Raise the penalty C',
          shortTitle: 'Raise the penalty C',
          subtitle: 'Connect C to margin width and support vectors.',
          predict: {
            prompt: 'On overlapping classes, what happens to the margin as C increases from 0.01 to 100?',
            options: ['It gets narrower', 'It gets wider', 'It does not change'],
            answer: 0,
          },
          manipulate: { label: 'log₁₀ C', min: -2, max: 2, step: 0.1, initial: -2, digits: 1 },
          evaluate: cached((exponent) => {
            const model = fitSvm(OVERLAP.train, 'linear', 10 ** exponent, 1)
            return {
              y: model.marginWidth,
              metrics: [
                { label: 'C', value: formatParam(10 ** exponent) },
                { label: 'Margin width', value: model.marginWidth.toFixed(2) },
                { label: 'Support vectors', value: String(model.supportVectors.length) },
                { label: 'Test accuracy', value: `${(100 * svmAccuracy(model, OVERLAP.test)).toFixed(1)}%` },
              ],
            }
          }),
          chart: { xLabel: 'log₁₀ C', yLabel: 'Margin width' },
          observe:
            'A small C makes margin violations cheap, so the SVM keeps a wide street with many points inside it (many support vectors). As C grows, violations become expensive and the street narrows to fit the training points.',
          limit: 'Beyond a point, a larger C only chases individual noisy points and test accuracy stops improving.',
          reason: {
            prompt: 'What does a very large C risk on noisy data?',
            options: ['Overfitting to individual training points', 'Ignoring all training points', 'Removing every support vector'],
            answer: 0,
            explain: 'A large C favours zero training errors over a wide, stable margin.',
          },
        },
        {
          title: 'Tune the RBF kernel width γ',
          shortTitle: 'Tune the RBF kernel width γ',
          subtitle: 'Connect γ to underfitting and overfitting.',
          predict: {
            prompt: 'An RBF SVM (C = 1) learns a ring around a central cluster. As γ grows from 0.01 to 100, how does test accuracy behave?',
            options: ['It rises, peaks, then falls', 'It keeps rising', 'It keeps falling'],
            answer: 0,
          },
          manipulate: { label: 'log₁₀ γ', min: -2, max: 2, step: 0.1, initial: -2, digits: 1 },
          evaluate: cached((exponent) => {
            const model = fitSvm(CIRCLES.train, 'rbf', 1, 10 ** exponent)
            const testAccuracy = 100 * svmAccuracy(model, CIRCLES.test)
            return {
              y: testAccuracy,
              metrics: [
                { label: 'γ', value: formatParam(10 ** exponent) },
                { label: 'Training accuracy', value: `${(100 * svmAccuracy(model, CIRCLES.train)).toFixed(1)}%` },
                { label: 'Test accuracy', value: `${testAccuracy.toFixed(1)}%` },
                { label: 'Support vectors', value: String(model.supportVectors.length) },
              ],
            }
          }),
          chart: { xLabel: 'log₁₀ γ', yLabel: 'Test accuracy (%)' },
          observe:
            'With a tiny γ each point influences the whole plane, so the boundary is almost straight and cannot enclose the ring. Moderate γ bends it into a circle. A huge γ gives each point a tiny bubble of influence: training accuracy stays at 100% but test accuracy drops.',
          limit: 'As γ becomes very large almost every training point turns into a support vector, a warning sign of memorisation.',
          reason: {
            prompt: 'How should C and γ be chosen in practice?',
            options: ['With a cross-validated grid search on the training data', 'By picking the highest test accuracy', 'By always using the defaults'],
            answer: 0,
            explain: 'Tuning on the test set would leak it into model selection and overstate performance.',
          },
        },
      ],
    },
    notes: [
      { h2: '2.1 The Maximum-Margin Classifier' },
      {
        p: 'A Support Vector Machine separates two classes with a hyperplane w·x + b = 0 and predicts the class from the sign of the decision function f(x) = w·x + b. When many hyperplanes separate the data, the SVM chooses the one with the largest margin: the widest street that contains no training points.',
      },
      { eq: 'Margin edges: w·x + b = ±1       Margin width = 2 / ‖w‖' },
      { h2: '2.2 Hard-Margin SVM' },
      { p: 'With labels yᵢ ∈ {−1, +1}, maximising the margin is the same as minimising ‖w‖:' },
      { eq: 'minimise ½‖w‖²   subject to   yᵢ(w·xᵢ + b) ≥ 1 for every i' },
      { p: 'This only has a solution when the classes are perfectly linearly separable, and a single outlier can drag the boundary a long way.' },
      { h2: '2.3 Soft Margin and the Penalty C' },
      { eq: 'minimise ½‖w‖² + C·Σξᵢ   subject to   yᵢ(w·xᵢ + b) ≥ 1 − ξᵢ,  ξᵢ ≥ 0' },
      {
        p: 'Slack variables ξᵢ let points enter the margin (0 < ξᵢ ≤ 1) or cross the boundary (ξᵢ > 1). C prices those violations. A small C gives a wide, tolerant margin with more support vectors (more bias). A large C gives a narrow margin that tries to classify every training point (more variance).',
      },
      { h2: '2.4 Hinge Loss' },
      { eq: 'hinge(x, y) = max(0, 1 − y·f(x))' },
      {
        table: {
          head: ['y·f(x)', 'Position', 'Hinge loss'],
          rows: [
            ['≥ 1', 'On or beyond the correct margin edge', '0'],
            ['0 to 1', 'Correct side, but inside the margin', 'between 0 and 1'],
            ['< 0', 'Wrong side of the boundary', 'greater than 1'],
          ],
        },
      },
      { h2: '2.5 Support Vectors' },
      {
        p: 'In the dual solution each training point gets a multiplier αᵢ with 0 ≤ αᵢ ≤ C. Points with αᵢ = 0 lie safely outside the margin and do not affect the model. Points with 0 < αᵢ < C sit exactly on the margin edges; points with αᵢ = C are inside the margin or misclassified. Together these are the support vectors.',
      },
      { eq: 'f(x) = Σ αᵢ yᵢ K(xᵢ, x) + b   (sum over support vectors only)' },
      { h2: '2.6 The Kernel Trick' },
      {
        p: 'The dual form uses the data only through inner products xᵢ·xⱼ. Replacing them with a kernel K(xᵢ, xⱼ) = φ(xᵢ)·φ(xⱼ) trains a linear SVM in a transformed feature space φ without ever computing φ, which gives curved boundaries in the original space.',
      },
      {
        table: {
          head: ['Kernel', 'K(x, x′)', 'Typical use'],
          rows: [
            ['Linear', 'x·x′', 'Linearly separable or very high-dimensional data (e.g. text)'],
            ['Polynomial', '(γ·x·x′ + r)^d', 'Feature interactions of a known degree'],
            ['RBF (Gaussian)', 'exp(−γ‖x − x′‖²)', 'General-purpose default for non-linear boundaries'],
            ['Sigmoid', 'tanh(γ·x·x′ + r)', 'Rarely used; similar to a neural network layer'],
          ],
        },
      },
      { h2: '2.7 The RBF Parameter γ' },
      {
        p: 'γ sets how quickly a training point’s influence fades with distance. A small γ gives smooth, almost linear boundaries (risk of underfitting); a large γ gives tight bubbles around individual points (risk of overfitting). C and γ interact and should be tuned together, usually on a logarithmic grid with cross-validation.',
      },
      { h2: '2.8 Practical Notes' },
      {
        list: [
          'Always scale features (for example StandardScaler) because margins and RBF distances depend on units.',
          'SVC handles multi-class problems with one-vs-one voting.',
          'SVC gives decision_function scores; predict_proba requires probability=True.',
          'Kernel SVMs scale poorly beyond tens of thousands of samples; LinearSVC or SGDClassifier are faster for large, linear problems.',
          'SVMs are effective in high-dimensional spaces and memory-efficient at prediction time, since only support vectors are stored.',
        ],
      },
    ],
  },

  procedure: [
    { h2: '4.1 V-Lab Workflow' },
    {
      steps: [
        'Load a labelled dataset (for example scikit-learn’s breast cancer dataset or make_circles for a non-linear case).',
        'Split the data into training and test sets with stratification.',
        'Build a Pipeline of StandardScaler and SVC so that scaling is learned only from training data.',
        'Train a linear SVM, then inspect the number of support vectors and the test accuracy.',
        'Train an RBF SVM and compare it with the linear model.',
        'Tune C and γ with GridSearchCV over a logarithmic grid using 5-fold cross-validation.',
        'Evaluate the best model once on the test set with a confusion matrix and classification report.',
      ],
    },
    { h2: '4.2 Input → Process → Output' },
    {
      table: {
        head: ['Stage', 'Details'],
        rows: [
          ['Input', 'Numerical features with class labels.'],
          ['Process', 'Scale → choose kernel → solve the margin optimisation for C (and γ) → keep support vectors.'],
          ['Output', 'Decision boundary, support vectors, predicted classes, accuracy and confusion matrix.'],
        ],
      },
    },
    { h2: '4.3 Key scikit-learn Tools' },
    {
      table: {
        head: ['Task', 'Class, attribute or method'],
        rows: [
          ['Kernel SVM', [{ code: "SVC(kernel='rbf', C=1.0, gamma='scale')" }]],
          ['Fast linear SVM', [{ code: 'LinearSVC(C=1.0)' }]],
          ['Support vectors', [{ code: 'model.support_vectors_' }, ', ', { code: 'model.n_support_' }]],
          ['Signed distance to the boundary', [{ code: 'model.decision_function(X)' }]],
          ['Tune C and γ', [{ code: "GridSearchCV(pipe, {'svc__C': [...], 'svc__gamma': [...]}, cv=5)" }]],
        ],
      },
    },
  ],

  results: [
    { p: 'After completing the experiment, students should observe and interpret:' },
    {
      list: [
        'The maximum-margin boundary and the small set of support vectors that determine it.',
        'How increasing C narrows the margin, reduces the number of support vectors and can overfit noisy data.',
        'That a single outlier moves a large-C boundary far more than a small-C one.',
        'That a linear kernel underfits concentric circles while an RBF kernel separates them.',
        'The underfitting-to-overfitting pattern as γ grows, visible as a gap between training and test accuracy.',
      ],
    },
    {
      note: {
        title: 'Conclusion.',
        text: 'SVMs find the widest margin between classes, rely only on support vectors, and use kernels for non-linear boundaries. C and γ control the bias–variance trade-off and should be tuned with cross-validation.',
      },
    },
  ],

  pretest,
  posttest,

  simulation: SvmSim,

  python: {
    title: 'Margins, kernels and hinge loss',
    intro: 'Predict an outcome. Repair a mistake. Build a working function.',
    predict: {
      question: 'What will Python print?',
      task: 'A class +1 point has decision value f(x) = 0.4. What is its hinge loss?',
      fileName: 'hinge.py',
      code: 'y = 1\nf = 0.4\nprint(round(max(0, 1 - y * f), 2))\n',
      options: ['0.6', '0', '1.4'],
      answer: 0,
    },
    repair: {
      question: 'Repair the RBF kernel',
      task: 'With γ = 0.5, the RBF kernel between (0, 0) and (1, 1) should be exp(−0.5 · 2) ≈ 0.3679. Fix the bug.',
      fileName: 'rbf.py',
      code: 'import math\n\ngamma = 0.5\np, q = (0, 0), (1, 1)\nsquared_distance = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2\nk = math.exp(gamma * squared_distance)\nprint(round(k, 4))\n',
      expected: '0.3679',
      hint: 'The kernel must shrink as points move apart, so the exponent needs a minus sign.',
    },
    build: {
      question: 'Build the linear SVM helpers',
      task: 'Complete decision(w, b, point) returning w·x + b, predict(w, b, point) returning 1 when the decision is ≥ 0 and 0 otherwise, and margin_width(w) returning 2 / ‖w‖.',
      fileName: 'svm_helpers.py',
      code: 'import math\n\n\ndef decision(w, b, point):\n    # w[0] * x1 + w[1] * x2 + b\n    return 0.0\n\n\ndef predict(w, b, point):\n    # 1 if the decision value is >= 0, otherwise 0\n    return 0\n\n\ndef margin_width(w):\n    # 2 divided by the length of w\n    return 0.0\n',
      tests: `assert abs(decision([2, -1], 0.5, (1, 3)) - (-0.5)) < 1e-9, "decision([2, -1], 0.5, (1, 3)) should be -0.5"
assert predict([2, -1], 0.5, (1, 3)) == 0, "a negative decision value should predict 0"
assert predict([2, -1], 0.5, (2, 1)) == 1, "a positive decision value should predict 1"
assert predict([1, 1], -2, (1, 1)) == 1, "a point exactly on the boundary (decision 0) should predict 1"
assert abs(margin_width([3, 4]) - 0.4) < 1e-9, "margin_width([3, 4]) should be 2 / 5 = 0.4"
print("ALL TESTS PASSED")`,
      hint: 'Use math.hypot(w[0], w[1]) for the length of w.',
    },
    explore: {
      question: 'Explore freely',
      task: 'Use "Use this data in Python" in the visual activity to train the same SVM with SMO in Python, or compare candidate boundaries by their total hinge loss below.',
      fileName: 'explore.py',
      code: 'points = [((1, 2), 1), ((2, 3), 1), ((3, 3), 1), ((-1, -1), -1), ((-2, 0), -1), ((0, -2), -1)]\n\ndef total_hinge(w, b):\n    return sum(max(0, 1 - y * (w[0] * x[0] + w[1] * x[1] + b)) for x, y in points)\n\nfor w, b in [((1, 1), 0), ((0.5, 0.5), 0), ((0.2, 0.2), 0), ((1, 0), -1)]:\n    print("w =", w, "b =", b, "total hinge loss =", round(total_hinge(w, b), 3))\n',
    },
    reference: [
      {
        title: 'Linear vs RBF SVM with a tuned grid search',
        code: `from sklearn.datasets import make_circles
from sklearn.model_selection import GridSearchCV, train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

X, y = make_circles(n_samples=400, noise=0.15, factor=0.4, random_state=42)
X_train, X_test, y_train, y_test = train_test_split(X, y, stratify=y, random_state=42)

linear = make_pipeline(StandardScaler(), SVC(kernel="linear", C=1)).fit(X_train, y_train)
print("Linear test accuracy:", round(linear.score(X_test, y_test), 3))

pipe = make_pipeline(StandardScaler(), SVC(kernel="rbf"))
grid = {"svc__C": [0.1, 1, 10, 100], "svc__gamma": [0.01, 0.1, 1, 10]}
search = GridSearchCV(pipe, grid, cv=5).fit(X_train, y_train)
print("Best parameters:", search.best_params_)
print("RBF test accuracy:", round(search.score(X_test, y_test), 3))
print("Support vectors per class:", search.best_estimator_[-1].n_support_)`,
      },
    ],
  },

  references: [
    { text: 'Cortes, C. & Vapnik, V. (1995). Support-vector networks. Machine Learning, 20(3), 273–297.', url: 'https://doi.org/10.1007/BF00994018' },
    { text: 'Platt, J. (1998). Sequential Minimal Optimization: A Fast Algorithm for Training Support Vector Machines. Microsoft Research Technical Report MSR-TR-98-14.' },
    { text: 'James, G., Witten, D., Hastie, T. & Tibshirani, R. (2021). An Introduction to Statistical Learning (2nd ed.), Chapter 9: Support Vector Machines. Springer.', url: 'https://www.statlearning.com/' },
    { text: 'Hsu, C.-W., Chang, C.-C. & Lin, C.-J. A Practical Guide to Support Vector Classification. National Taiwan University.', url: 'https://www.csie.ntu.edu.tw/~cjlin/papers/guide/guide.pdf' },
    { text: 'scikit-learn User Guide — Support Vector Machines', url: 'https://scikit-learn.org/stable/modules/svm.html' },
  ],

  contributors: [{ name: 'PAC-LAB Virtual ML Lab team', role: 'Content, simulation and review' }],
}
