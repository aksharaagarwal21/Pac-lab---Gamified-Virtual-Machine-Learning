import { QuizRace } from '../components/lab/QuizRace.jsx'
import { RedLightQuiz } from '../components/lab/RedLightQuiz.jsx'
import PreprocessingSim from './sims/PreprocessingSim.jsx'
import { posttest, pretest } from './quiz/exp01.js'

// Experiment content shape (all experiments follow it):
// aim, procedure, results: content blocks (see ContentBlocks.jsx)
// theory: { activity: { tasks: [...] }, notes: blocks }; each task has predict, manipulate, evaluate(value), chart, observe, limit, reason
// pretest / posttest: [{ level, prompt, options, answer, explain }]
// quizGame (optional): component that plays the pretest and posttest as a game instead of one-question-at-a-time MCQs
// simulation: React component; python: { title, intro, predict, repair, build, explore, reference }
// references: [{ text, url? }]; contributors: [{ name, role }]

const BASE_VALUES = [42, 45, 47, 48, 49, 50, 50, 51, 52, 53, 54, 55, 55, 56, 57, 58, 60, 61, 63, 64]
const BASE_SUM = BASE_VALUES.reduce((sum, v) => sum + v, 0)

// Keep Experiment 1's existing Grand Prix pretest, but give only its posttest the
// Red Light / Green Light survival format requested for this experiment.
function ExperimentOneQuiz(props) {
  return props.kind === 'posttest' ? <RedLightQuiz {...props} /> : <QuizRace {...props} />
}

export default {
  aim: [
    {
      p: 'To prepare raw data for machine learning by handling missing values and outliers, encoding categorical features, scaling numerical features, and splitting the data without leaking information from the test set.',
    },
    { h2: 'Learning outcomes' },
    {
      list: [
        'Choose a suitable strategy for missing values (deletion, mean or median imputation).',
        'Detect outliers with the IQR rule and decide whether to keep, cap or remove them.',
        'Convert categorical columns with label encoding or one-hot encoding.',
        'Apply min-max scaling and standardization, and explain when each is useful.',
        'Explain data leakage and why pre-processing must be fitted on the training split only.',
      ],
    },
  ],

  theory: {
    activity: {
      tasks: [
        {
          title: 'Fill a gap next to an outlier',
          shortTitle: 'Mean or median?',
          subtitle: 'Connect imputation choices to extreme values.',
          predict: {
            prompt: 'One value in a column keeps growing into an extreme outlier. Which fill value moves more?',
            options: ['The mean moves more', 'The median moves more', 'Both move by the same amount'],
            answer: 0,
          },
          manipulate: { label: 'Size of the outlier (added to the largest value)', min: 0, max: 300, step: 5, initial: 0 },
          evaluate: (outlier) => {
            const meanFill = (BASE_SUM + outlier) / BASE_VALUES.length
            const medianFill = 53.5
            return {
              y: meanFill - medianFill,
              metrics: [
                { label: 'Mean fill value', value: meanFill.toFixed(2) },
                { label: 'Median fill value', value: medianFill.toFixed(2) },
                { label: 'Gap', value: (meanFill - medianFill).toFixed(2) },
              ],
            }
          },
          chart: { xLabel: 'Outlier size', yLabel: 'Mean − median' },
          observe:
            'The mean includes every value, so one extreme number drags it upward. The median only depends on the middle of the sorted values, so it does not move at all.',
          limit: 'If a column is skewed or has outliers, a mean fill invents values that are not typical of any real row.',
          reason: {
            prompt: 'When is median imputation the safer choice?',
            options: ['When the column is skewed or contains outliers', 'When the column is text', 'Only when no values are missing'],
            answer: 0,
            explain: 'The median is robust to extreme values, so it gives a more typical fill value for skewed columns.',
          },
        },
        {
          title: 'Let one feature dominate the distance',
          shortTitle: 'Why scale?',
          subtitle: 'Connect feature ranges to distance-based models.',
          predict: {
            prompt: 'Two customers differ by 10 years of age and 1.5 salary units. What happens as the salary is measured in ever smaller units (bigger numbers)?',
            options: ['Salary dominates the distance', 'Both features keep an equal share', 'Age dominates the distance'],
            answer: 0,
          },
          manipulate: { label: 'Salary unit multiplier', min: 1, max: 100, step: 1, initial: 1 },
          evaluate: (multiplier) => {
            const salary = (1.5 * multiplier) ** 2
            const share = (100 * salary) / (100 + salary)
            return {
              y: share,
              metrics: [
                { label: 'Salary share of distance', value: `${share.toFixed(1)}%` },
                { label: 'Age share of distance', value: `${(100 - share).toFixed(1)}%` },
              ],
            }
          },
          chart: { xLabel: 'Salary unit multiplier', yLabel: 'Salary share (%)' },
          observe:
            'Euclidean distance adds squared differences. When one feature uses much larger numbers, its squared difference swamps the others and the model effectively ignores age.',
          limit: 'Tree-based models split one feature at a time, so they are far less sensitive to scaling than k-NN, SVM or gradient-based models.',
          reason: {
            prompt: 'Why standardize features before k-nearest neighbours?',
            options: ['So each feature contributes on a comparable scale', 'To remove missing values', 'To turn numbers into categories'],
            answer: 0,
            explain: 'Scaling puts features on similar ranges, so distances reflect every feature instead of the one with the biggest units.',
          },
        },
        {
          title: 'Shrink the test set',
          shortTitle: 'How big a test set?',
          subtitle: 'Connect split size to how trustworthy a score is.',
          predict: {
            prompt: 'A model is about 85% accurate. As the test set gets smaller, what happens to the uncertainty of the measured accuracy?',
            options: ['It grows: the score becomes less reliable', 'It shrinks: the score becomes more reliable', 'It stays the same'],
            answer: 0,
          },
          manipulate: { label: 'Test share of 1,000 rows (%)', min: 5, max: 50, step: 1, initial: 20 },
          evaluate: (share) => {
            const testRows = Math.round(10 * share)
            const standardError = Math.sqrt((0.85 * 0.15) / testRows) * 100
            return {
              y: standardError,
              metrics: [
                { label: 'Test rows', value: String(testRows) },
                { label: 'Training rows', value: String(1000 - testRows) },
                { label: '± standard error', value: `${standardError.toFixed(2)} pts` },
              ],
            }
          },
          chart: { xLabel: 'Test share (%)', yLabel: 'Standard error (pts)' },
          observe:
            'Accuracy on few test rows swings a lot from sample to sample: its standard error is √(p(1−p)/n). A larger test set gives a steadier estimate but leaves fewer rows for training.',
          limit: 'This is why 70/30 or 80/20 splits are common, and why cross-validation (Experiment 3) reuses data for both jobs.',
          reason: {
            prompt: 'Why keep a separate test set at all?',
            options: ['To estimate performance on data the model has never seen', 'To make training faster', 'To fill in missing values'],
            answer: 0,
            explain: 'A held-out test set simulates future data. Scores on training data are always optimistic.',
          },
        },
      ],
    },
    notes: [
      { h2: '2.1 Why Pre-process Data?' },
      {
        p: 'Real-world data is messy: values go missing, sensors glitch, people type text in different ways, and features are measured on very different scales. Most learning algorithms assume clean numeric input, so pre-processing turns raw data into a form the model can learn from reliably. Poor pre-processing is one of the most common reasons a model performs badly.',
      },
      { h2: '2.2 Handling Missing Values' },
      {
        list: [
          [{ b: 'Deletion: ' }, 'drop rows (or columns) with missing values. Simple, but it wastes data and can bias results if values are not missing at random.'],
          [{ b: 'Mean imputation: ' }, 'replace a missing number with the column mean. Works for roughly symmetric columns, but is pulled by outliers.'],
          [{ b: 'Median imputation: ' }, 'replace with the median. Robust to outliers and skewed data.'],
          [{ b: 'Mode imputation: ' }, 'replace a missing category with the most frequent category.'],
          [{ b: 'Indicator column: ' }, 'add a 0/1 column recording that a value was missing, so the model can learn from the pattern.'],
        ],
      },
      { h2: '2.3 Outliers and the IQR Rule' },
      { p: 'An outlier is a value far from the rest. The interquartile range (IQR) rule flags values outside:' },
      { eq: 'Lower fence = Q1 − 1.5 × IQR     Upper fence = Q3 + 1.5 × IQR     (IQR = Q3 − Q1)' },
      {
        p: 'Outliers can be genuine (a very rich customer) or errors (a typo). Options are to keep them, cap (clip) them at the fences, transform the feature (for example with a logarithm) or remove them. Always check the cause before deleting data.',
      },
      { h2: '2.4 Encoding Categorical Features' },
      {
        list: [
          [{ b: 'Label (ordinal) encoding ' }, 'maps each category to an integer (Chennai → 0, Delhi → 1, Mumbai → 2). Suitable for ordered categories such as low < medium < high; otherwise it invents a false order.'],
          [{ b: 'One-hot encoding ' }, 'creates one 0/1 column per category. It avoids a false order, but adds columns; drop one column if a linear model must avoid perfect collinearity (the "dummy variable trap").'],
        ],
      },
      { h2: '2.5 Feature Scaling' },
      { p: 'Min-max scaling (normalization) maps a feature to the range 0 to 1:' },
      { eq: "x' = (x − min) / (max − min)" },
      { p: 'Standardization (z-score) gives the feature mean 0 and standard deviation 1:' },
      { eq: 'z = (x − μ) / σ' },
      {
        p: 'Scaling matters for distance-based and gradient-based models (k-NN, K-means, SVM, logistic regression, neural networks, PCA). Min-max scaling is sensitive to outliers; standardization is the usual default. Tree-based models (decision trees, random forests) are largely unaffected.',
      },
      { h2: '2.6 Train–Test Split and Data Leakage' },
      {
        p: 'Data is split into a training set (commonly 70–80%) used to fit the model and a test set used only for the final evaluation. Data leakage happens when information from the test set influences training — for example computing the scaler\'s mean, imputation values, or selected features on the full dataset before splitting. Leakage makes evaluation scores look better than the model will perform on genuinely new data.',
      },
      {
        note: {
          title: 'Rule of thumb.',
          text: ['Call ', { code: 'fit' }, ' or ', { code: 'fit_transform' }, ' on training data only, then use ', { code: 'transform' }, ' on validation and test data.'],
        },
      },
      { h2: '2.7 Pipelines' },
      {
        p: [
          'In scikit-learn, a ',
          { code: 'Pipeline' },
          ' or ',
          { code: 'ColumnTransformer' },
          ' chains imputation, encoding, scaling and the model into one object. Fitting the pipeline fits every step on training data only, which prevents leakage automatically — including inside cross-validation.',
        ],
      },
    ],
  },

  procedure: [
    { h2: '4.1 V-Lab Workflow' },
    {
      steps: [
        'Load the dataset (for example a customer table with Age, Salary, City and Purchased) and inspect its shape, data types and summary statistics.',
        'Count missing values in each column and decide on deletion or imputation (mean, median or mode).',
        'Detect outliers with the IQR rule or a box plot, then keep, cap or remove them after checking their cause.',
        'Encode categorical columns: label encoding for ordered categories, one-hot encoding for unordered ones.',
        'Split the data into training (80%) and test (20%) sets before fitting any pre-processing step.',
        'Fit the imputer and scaler on the training set, then transform both the training and the test sets.',
        'Verify the result: no missing values remain, categories are numeric and scaled features have the expected range or mean and standard deviation.',
      ],
    },
    { h2: '4.2 Input → Process → Output' },
    {
      table: {
        head: ['Stage', 'Details'],
        rows: [
          ['Input', 'Raw dataset with missing values, outliers, categorical columns and features on different scales.'],
          ['Process', 'Imputation → outlier handling → encoding → train–test split → scaling fitted on training data.'],
          ['Output', 'Clean, fully numeric training and test sets ready for a machine learning model.'],
        ],
      },
    },
    { h2: '4.3 Key scikit-learn Tools' },
    {
      table: {
        head: ['Task', 'Class or function'],
        rows: [
          ['Fill missing values', [{ code: 'SimpleImputer(strategy="median")' }]],
          ['One-hot encoding', [{ code: 'OneHotEncoder(handle_unknown="ignore")' }]],
          ['Standardization', [{ code: 'StandardScaler()' }]],
          ['Min-max scaling', [{ code: 'MinMaxScaler()' }]],
          ['Train–test split', [{ code: 'train_test_split(X, y, test_size=0.2, random_state=42)' }]],
          ['Combine steps', [{ code: 'ColumnTransformer' }, ' and ', { code: 'Pipeline' }]],
        ],
      },
    },
  ],

  results: [
    { p: 'After completing the experiment, students should observe and interpret:' },
    {
      list: [
        'How many rows each missing-value strategy keeps: deletion shrinks the dataset, imputation keeps every row.',
        'How the extreme salary pulls the mean (and the mean-based fill values) while the median stays stable.',
        'How IQR clipping changes the salary mean and standard deviation.',
        'That one-hot encoding creates one column per city, while label encoding creates a single numeric column with an artificial order.',
        'That after min-max scaling values lie between 0 and 1, and after standardization they have mean 0 and standard deviation 1.',
        'That choosing features (or fitting scalers and imputers) on all data before splitting produces a validation error far lower than the real-world error — a clear sign of data leakage.',
      ],
    },
    {
      note: {
        title: 'Conclusion.',
        text: 'Good pre-processing makes models more accurate and evaluations trustworthy. Every step that learns from data must be fitted on the training split only.',
      },
    },
  ],

  pretest,
  posttest,
  quizGame: ExperimentOneQuiz,

  simulation: PreprocessingSim,

  python: {
    title: 'Clean data from first principles',
    intro: 'Predict an outcome. Repair a mistake. Build a working function.',
    predict: {
      question: 'What will Python print?',
      task: 'A missing age is filled with 25 before summing. Read the code, choose an output, then run it to test your reasoning.',
      fileName: 'fill_missing.py',
      code: 'ages = [20, None, 30]\nfilled = [a if a is not None else 25 for a in ages]\nprint(sum(filled))\n',
      options: ['50', '75', 'Error'],
      answer: 1,
    },
    repair: {
      question: 'Repair the min-max scaler',
      task: 'This function should map [10, 20, 30] to [0.0, 0.5, 1.0], but the formula is wrong. Fix it so the program prints the correct list.',
      fileName: 'min_max.py',
      code: 'def min_max(values):\n    lo, hi = min(values), max(values)\n    return [(v - lo) / hi for v in values]\n\nprint(min_max([10, 20, 30]))\n',
      expected: '[0.0, 0.5, 1.0]',
      hint: 'Min-max scaling divides by the range of the data: (max − min), not max.',
    },
    build: {
      question: 'Build a standardizer',
      task: 'Complete standardize(values) so it returns z-scores (value − mean) / std, using the population standard deviation. Run to check it against the tests.',
      fileName: 'standardize.py',
      code: 'import math\n\ndef standardize(values):\n    # 1. compute the mean\n    # 2. compute the population standard deviation\n    # 3. return (v - mean) / std for every value\n    return values\n',
      tests: `def _close(a, b):
    return len(a) == len(b) and all(abs(x - y) < 1e-9 for x, y in zip(a, b))

assert _close(standardize([2, 4, 6]), [-1.224744871391589, 0.0, 1.224744871391589]), "standardize([2, 4, 6]) should be about [-1.2247, 0.0, 1.2247]"
z = standardize([10, 20, 30, 40])
assert abs(sum(z)) < 1e-9, "z-scores should average to 0"
assert abs(sum(v * v for v in z) / len(z) - 1) < 1e-9, "z-scores should have (population) variance 1"
print("ALL TESTS PASSED")`,
      hint: 'mean = sum(values) / len(values); std = math.sqrt(sum((v - mean) ** 2 for v in values) / len(values)).',
    },
    explore: {
      question: 'Explore freely',
      task: 'Experiment with your own cleaning ideas. Use "Use this data in Python" in the visual activity to load the exact pipeline you built.',
      fileName: 'explore.py',
      code: 'from statistics import mean, median\n\nsalaries = [32000, 48000, 52000, 39000, 61000, 250000, 58000]\nprint("mean:", mean(salaries))\nprint("median:", median(salaries))\n',
    },
    reference: [
      {
        title: 'Pipeline with scikit-learn',
        code: `import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

df = pd.read_csv("customers.csv")
X, y = df[["Age", "Salary", "City"]], df["Purchased"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

numeric = Pipeline([("impute", SimpleImputer(strategy="median")), ("scale", StandardScaler())])
preprocess = ColumnTransformer([
    ("num", numeric, ["Age", "Salary"]),
    ("cat", OneHotEncoder(handle_unknown="ignore"), ["City"]),
])

X_train_ready = preprocess.fit_transform(X_train)   # fit on training data only
X_test_ready = preprocess.transform(X_test)         # reuse the same statistics`,
      },
      {
        title: 'Detecting outliers with the IQR rule',
        code: `q1, q3 = df["Salary"].quantile([0.25, 0.75])
iqr = q3 - q1
df["Salary"] = df["Salary"].clip(q1 - 1.5 * iqr, q3 + 1.5 * iqr)`,
      },
    ],
  },

  references: [
    { text: 'Géron, A. (2022). Hands-On Machine Learning with Scikit-Learn, Keras, and TensorFlow (3rd ed.), Chapter 2. O\'Reilly Media.' },
    { text: 'scikit-learn User Guide — Preprocessing data', url: 'https://scikit-learn.org/stable/modules/preprocessing.html' },
    { text: 'scikit-learn User Guide — Imputation of missing values', url: 'https://scikit-learn.org/stable/modules/impute.html' },
    { text: 'scikit-learn User Guide — Common pitfalls: data leakage', url: 'https://scikit-learn.org/stable/common_pitfalls.html' },
    { text: 'Kaufman, S., Rosset, S., Perlich, C. & Stitelman, O. (2012). Leakage in data mining: formulation, detection, and avoidance. ACM TKDD, 6(4).' },
    { text: 'Ambroise, C. & McLachlan, G. J. (2002). Selection bias in gene extraction on the basis of microarray gene-expression data. PNAS, 99(10), 6562–6566.' },
  ],

  contributors: [
    { name: 'PAC-LAB Virtual ML Lab team', role: 'Content, simulation and review' },
  ],
}
