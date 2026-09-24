import { sigmoid } from '../lib/ml.js'
import LogisticSim from './sims/LogisticSim.jsx'
import { posttest, pretest } from './quiz/exp04.js'

// Twenty fixed predictions for the threshold activity (probability of the positive class and the true label).
const PROBABILITIES = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 0.98]
const LABELS = [0, 0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 1]

export default {
  aim: [
    {
      p: 'To build a logistic regression model for binary classification, interpret its predicted probabilities and decision boundary, and evaluate it with a confusion matrix, precision, recall, F1 score and the ROC curve.',
    },
    { h2: 'Learning outcomes' },
    {
      list: [
        'Explain how the sigmoid function turns a linear score into a probability.',
        'Interpret the weights, the log-odds and the decision boundary of a logistic regression model.',
        'Describe how log loss is used to fit the model and why regularisation matters.',
        'Build and read a confusion matrix and compute accuracy, precision, recall and F1.',
        'Choose a classification threshold for a task and interpret the ROC curve and AUC.',
      ],
    },
  ],

  theory: {
    activity: {
      tasks: [
        {
          title: 'Squash a score into a probability',
          shortTitle: 'Squash a score into a probability',
          subtitle: 'Connect the linear score z to the sigmoid.',
          predict: {
            prompt: 'As the score z grows from very negative to very positive, what happens to the probability σ(z)?',
            options: ['It rises smoothly from 0 to 1 in an S-shape', 'It rises in a straight line forever', 'It jumps from 0 to 1 at z = 1'],
            answer: 0,
          },
          manipulate: { label: 'Score z = w·x + b', min: -6, max: 6, step: 0.1, initial: -6, digits: 1 },
          evaluate: (z) => {
            const p = sigmoid(z)
            return {
              y: p,
              metrics: [
                { label: 'Probability σ(z)', value: p.toFixed(3) },
                { label: 'Odds p / (1 − p)', value: Math.exp(z).toFixed(3) },
                { label: 'Class at 0.5', value: p >= 0.5 ? 'Positive (1)' : 'Negative (0)' },
              ],
            }
          },
          chart: { xLabel: 'z', yLabel: 'σ(z)' },
          observe:
            'The sigmoid is steepest at z = 0, where the probability is exactly 0.5. Far from zero it flattens out toward 0 or 1, so the model becomes confident. Each unit increase in z multiplies the odds by e ≈ 2.72.',
          limit: 'The boundary between the classes is where z = 0 (for a 0.5 threshold). Logistic regression therefore draws a straight-line (linear) boundary in feature space.',
          reason: {
            prompt: 'Why not use linear regression to predict probabilities directly?',
            options: ['A straight line can predict values below 0 or above 1', 'A straight line is harder to compute', 'Probabilities must be whole numbers'],
            answer: 0,
            explain: 'The sigmoid keeps every output inside 0–1, so it can be read as a probability.',
          },
        },
        {
          title: 'Move the decision threshold',
          shortTitle: 'Move the decision threshold',
          subtitle: 'Connect the threshold to precision and recall.',
          predict: {
            prompt: 'Twenty samples already have predicted probabilities. As you raise the threshold, what happens to recall?',
            options: ['It falls: fewer actual positives are caught', 'It rises', 'It never changes'],
            answer: 0,
          },
          manipulate: { label: 'Threshold', min: 0.05, max: 0.95, step: 0.05, initial: 0.05, digits: 2 },
          evaluate: (threshold) => {
            let tp = 0
            let fp = 0
            let fn = 0
            PROBABILITIES.forEach((p, i) => {
              const predicted = p >= threshold - 1e-9 ? 1 : 0
              if (predicted && LABELS[i]) tp++
              else if (predicted && !LABELS[i]) fp++
              else if (!predicted && LABELS[i]) fn++
            })
            const precision = tp + fp ? tp / (tp + fp) : 0
            const recall = tp + fn ? tp / (tp + fn) : 0
            return {
              y: recall,
              metrics: [
                { label: 'TP / FP / FN', value: `${tp} / ${fp} / ${fn}` },
                { label: 'Precision', value: precision.toFixed(3) },
                { label: 'Recall', value: recall.toFixed(3) },
              ],
            }
          },
          chart: { xLabel: 'Threshold', yLabel: 'Recall' },
          observe:
            'A low threshold labels almost everything positive: recall is high but many predictions are false alarms. A high threshold only accepts confident predictions: precision rises while more positives are missed.',
          limit: 'The model and its probabilities never changed — only the decision rule did. Choose the threshold from the real costs of each mistake.',
          reason: {
            prompt: 'When would you choose a low threshold?',
            options: ['When missing a positive costs much more than a false alarm', 'When false alarms are very costly', 'Never: 0.5 is always correct'],
            answer: 0,
            explain: 'Screening for a serious disease accepts extra false alarms to avoid missing sick patients.',
          },
        },
        {
          title: 'Pay for a confident mistake',
          shortTitle: 'Pay for a confident mistake',
          subtitle: 'Connect predicted probability to log loss.',
          predict: {
            prompt: 'A sample truly belongs to class 1. As its predicted probability drops toward 0, what happens to its log loss?',
            options: ['It grows very steeply', 'It decreases', 'It stays constant'],
            answer: 0,
          },
          manipulate: { label: 'Predicted probability for the true class', min: 0.01, max: 0.99, step: 0.01, initial: 0.99, digits: 2 },
          evaluate: (p) => {
            const loss = -Math.log(p)
            return {
              y: loss,
              metrics: [
                { label: 'Log loss −ln(p)', value: loss.toFixed(3) },
                { label: 'Correct at 0.5?', value: p >= 0.5 ? 'Yes' : 'No' },
              ],
            }
          },
          chart: { xLabel: 'Predicted probability', yLabel: 'Log loss' },
          observe:
            'Log loss is small when the model is confident and right, about 0.69 at p = 0.5, and explodes as a wrong prediction becomes confident (4.6 at p = 0.01). Training minimises the average log loss over all samples.',
          limit: 'Accuracy only counts right or wrong, so it cannot tell a barely-correct 0.51 from a confident 0.99. Log loss can, which makes it a smooth target for optimisation.',
          reason: {
            prompt: 'Why is log loss used to train logistic regression instead of accuracy?',
            options: ['It rewards well-calibrated probabilities and is smooth to optimise', 'It ignores probabilities', 'It always equals accuracy'],
            answer: 0,
            explain: 'A smooth, convex loss lets gradient-based solvers find the best weights reliably.',
          },
        },
      ],
    },
    notes: [
      { h2: '2.1 Classification versus Regression' },
      {
        p: 'Classification predicts a category instead of a number. In binary classification there are two classes, usually encoded as 1 (positive, e.g. "spam", "disease", "pass") and 0 (negative). Logistic regression is a linear model for binary classification that predicts the probability of the positive class.',
      },
      { h2: '2.2 The Sigmoid Function' },
      { eq: 'σ(z) = 1 / (1 + e⁻ᶻ)' },
      {
        p: 'The sigmoid maps any real number to the range (0, 1). σ(0) = 0.5, large positive z gives values near 1 and large negative z gives values near 0.',
      },
      { h2: '2.3 The Logistic Regression Model' },
      { eq: 'z = b₀ + b₁x₁ + … + bₙxₙ       P(y = 1 | x) = σ(z)' },
      { p: 'Rearranging shows that the model is linear in the log-odds:' },
      { eq: 'ln( p / (1 − p) ) = b₀ + b₁x₁ + … + bₙxₙ' },
      {
        p: 'A coefficient bᵢ changes the log-odds by bᵢ for a one-unit increase in xᵢ, which multiplies the odds by e^bᵢ (the odds ratio).',
      },
      { h2: '2.4 Decision Boundary and Threshold' },
      {
        p: 'To make a yes/no prediction, the probability is compared with a threshold (0.5 by default). The decision boundary is the set of points where the probability equals the threshold; for logistic regression it is a straight line (or hyperplane). Changing the threshold trades false positives against false negatives without retraining the model.',
      },
      { h2: '2.5 Training with Log Loss' },
      { eq: 'Log loss = −(1/n) Σ [ yᵢ·ln(pᵢ) + (1 − yᵢ)·ln(1 − pᵢ) ]' },
      {
        p: [
          'The weights are found by minimising log loss (equivalently, maximising the likelihood). The loss is convex, so solvers such as lbfgs or gradient descent reach the global minimum. scikit-learn adds L2 regularisation by default; the parameter ',
          { code: 'C' },
          ' is the inverse of its strength (smaller C = stronger regularisation). Without regularisation, perfectly separable data makes the weights grow without limit.',
        ],
      },
      { h2: '2.6 Evaluation Metrics' },
      {
        table: {
          head: ['Metric', 'Formula', 'Question it answers'],
          rows: [
            ['Accuracy', '(TP + TN) / total', 'How many predictions are correct overall?'],
            ['Precision', 'TP / (TP + FP)', 'Of the predicted positives, how many are right?'],
            ['Recall (sensitivity)', 'TP / (TP + FN)', 'Of the actual positives, how many were found?'],
            ['Specificity', 'TN / (TN + FP)', 'Of the actual negatives, how many were recognised?'],
            ['F1 score', '2·P·R / (P + R)', 'A single balance of precision and recall.'],
            ['ROC-AUC', 'Area under TPR vs FPR', 'How well are positives ranked above negatives?'],
          ],
        },
      },
      { h2: '2.7 Imbalanced Classes' },
      {
        p: [
          'When one class is rare, accuracy is misleading: always predicting the majority class can look excellent. Use precision, recall, F1 and ROC-AUC (or precision–recall curves), stratified splits, a tuned threshold, or ',
          { code: 'class_weight="balanced"' },
          ' to give the rare class more weight.',
        ],
      },
      { h2: '2.8 More Than Two Classes' },
      {
        p: 'Logistic regression extends to several classes either by training one binary model per class (one-vs-rest) or with multinomial (softmax) regression, which outputs a probability for every class that sums to 1.',
      },
    ],
  },

  procedure: [
    { h2: '4.1 V-Lab Workflow' },
    {
      steps: [
        'Load a binary classification dataset (for example the scikit-learn breast cancer dataset) and check the class balance.',
        'Split into training (80%) and test (20%) sets with stratify=y so both keep the same class proportions.',
        'Build a pipeline with StandardScaler and LogisticRegression, and fit it on the training data.',
        'Predict classes with predict and probabilities with predict_proba on the test set.',
        'Compute the confusion matrix, accuracy, precision, recall and F1 (classification_report).',
        'Plot the ROC curve and compute ROC-AUC from the predicted probabilities.',
        'Try different thresholds and interpret the coefficients as odds ratios (e^coefficient).',
      ],
    },
    { h2: '4.2 Input → Process → Output' },
    {
      table: {
        head: ['Stage', 'Details'],
        rows: [
          ['Input', 'Numerical features and a binary target (0/1).'],
          ['Process', 'Stratified split → scaling → fit by minimising log loss → probabilities → threshold.'],
          ['Output', 'Class probabilities, predicted labels, coefficients, confusion matrix, precision, recall, F1, ROC-AUC.'],
        ],
      },
    },
    { h2: '4.3 Key scikit-learn Tools' },
    {
      table: {
        head: ['Task', 'Class or function'],
        rows: [
          ['Model', [{ code: 'LogisticRegression(C=1.0, max_iter=1000)' }]],
          ['Probabilities', [{ code: 'model.predict_proba(X_test)[:, 1]' }]],
          ['Confusion matrix', [{ code: 'confusion_matrix(y_test, y_pred)' }]],
          ['Precision, recall, F1', [{ code: 'classification_report(y_test, y_pred)' }]],
          ['ROC curve and AUC', [{ code: 'roc_curve(y_test, proba)' }, ', ', { code: 'roc_auc_score(y_test, proba)' }]],
        ],
      },
    },
  ],

  results: [
    { p: 'After completing the experiment, students should observe and interpret:' },
    {
      list: [
        'The fitted weight and bias, and where the decision boundary lies (for example, the number of study hours at which a pass is predicted).',
        'The confusion matrix at the default threshold of 0.5, and what each false positive and false negative means in the problem.',
        'How precision and recall move in opposite directions as the threshold changes, while the ROC-AUC stays the same.',
        'Why accuracy alone is misleading on the imbalanced dataset.',
        'How regularisation keeps the fit finite on perfectly separable data.',
      ],
    },
    {
      note: {
        title: 'Conclusion.',
        text: 'Logistic regression provides interpretable probabilities with a linear decision boundary. The right threshold and evaluation metric depend on the cost of each kind of error.',
      },
    },
  ],

  pretest,
  posttest,

  simulation: LogisticSim,

  python: {
    title: 'Classify from first principles',
    intro: 'Predict an outcome. Repair a mistake. Build a working function.',
    predict: {
      question: 'What will Python print?',
      task: 'The sigmoid of a score of zero is rounded to two decimals. Choose the output, then run the code.',
      fileName: 'sigmoid.py',
      code: 'import math\n\nz = 0\nprint(round(1 / (1 + math.exp(-z)), 2))\n',
      options: ['0.0', '0.5', '1.0'],
      answer: 1,
    },
    repair: {
      question: 'Repair the sigmoid',
      task: 'sigmoid(2) should be about 0.881, but this version returns a probability for the wrong class. Fix the formula so the program prints 0.881.',
      fileName: 'sigmoid_bug.py',
      code: 'import math\n\ndef sigmoid(z):\n    return 1 / (1 + math.exp(z))\n\nprint(round(sigmoid(2), 3))\n',
      expected: '0.881',
      hint: 'The sigmoid is 1 / (1 + e^(−z)). Check the sign inside math.exp.',
    },
    build: {
      question: 'Build the evaluation helpers',
      task: 'Complete confusion_counts(actual, predicted), which returns (tp, fp, fn, tn), and precision_recall(tp, fp, fn), which returns (precision, recall) and uses 0.0 when a denominator is zero.',
      fileName: 'metrics.py',
      code: 'def confusion_counts(actual, predicted):\n    # return (tp, fp, fn, tn)\n    return 0, 0, 0, 0\n\n\ndef precision_recall(tp, fp, fn):\n    # return (precision, recall); use 0.0 if a denominator is zero\n    return 0.0, 0.0\n',
      tests: `assert confusion_counts([1, 0, 1, 1, 0], [1, 1, 0, 1, 0]) == (2, 1, 1, 1), "expected tp=2, fp=1, fn=1, tn=1"
assert confusion_counts([0, 0], [0, 0]) == (0, 0, 0, 2), "two correct negatives give tn=2"
p, r = precision_recall(2, 1, 1)
assert abs(p - 2 / 3) < 1e-9 and abs(r - 2 / 3) < 1e-9, "precision and recall should both be 2/3"
p, r = precision_recall(0, 0, 3)
assert p == 0.0 and r == 0.0, "no predicted positives should give precision 0.0 without crashing"
p, r = precision_recall(4, 0, 1)
assert p == 1.0 and abs(r - 0.8) < 1e-9, "tp=4, fp=0, fn=1 gives precision 1.0 and recall 0.8"
print("ALL TESTS PASSED")`,
      hint: 'Loop over zip(actual, predicted) and count each of the four combinations. Guard each division with an if.',
    },
    explore: {
      question: 'Explore freely',
      task: 'Use "Use this data in Python" in the visual activity to train on the simulation’s students, or try your own thresholds below.',
      fileName: 'explore.py',
      code: 'probabilities = [0.1, 0.35, 0.4, 0.55, 0.62, 0.8, 0.9]\nactual = [0, 0, 1, 0, 1, 1, 1]\n\nfor threshold in (0.3, 0.5, 0.7):\n    predicted = [1 if p >= threshold else 0 for p in probabilities]\n    tp = sum(a and p for a, p in zip(actual, predicted))\n    fp = sum((not a) and p for a, p in zip(actual, predicted))\n    fn = sum(a and not p for a, p in zip(actual, predicted))\n    print(threshold, "precision", round(tp / (tp + fp), 2), "recall", round(tp / (tp + fn), 2))\n',
    },
    reference: [
      {
        title: 'Logistic regression on the breast cancer dataset',
        code: `from sklearn.datasets import load_breast_cancer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

X, y = load_breast_cancer(return_X_y=True)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)

model = make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000)).fit(X_train, y_train)
proba = model.predict_proba(X_test)[:, 1]
y_pred = (proba >= 0.5).astype(int)

print(confusion_matrix(y_test, y_pred))
print(classification_report(y_test, y_pred))
print("ROC-AUC:", roc_auc_score(y_test, proba))`,
      },
    ],
  },

  references: [
    { text: 'James, G., Witten, D., Hastie, T. & Tibshirani, R. (2021). An Introduction to Statistical Learning (2nd ed.), Chapter 4: Classification. Springer.', url: 'https://www.statlearning.com/' },
    { text: 'Hosmer, D. W., Lemeshow, S. & Sturdivant, R. X. (2013). Applied Logistic Regression (3rd ed.). Wiley.' },
    { text: 'Fawcett, T. (2006). An introduction to ROC analysis. Pattern Recognition Letters, 27(8), 861–874.' },
    { text: 'scikit-learn User Guide — Logistic regression', url: 'https://scikit-learn.org/stable/modules/linear_model.html#logistic-regression' },
    { text: 'Google Machine Learning Crash Course — Classification', url: 'https://developers.google.com/machine-learning/crash-course/classification' },
  ],

  contributors: [{ name: 'PAC-LAB Virtual ML Lab team', role: 'Content, simulation and review' }],
}
