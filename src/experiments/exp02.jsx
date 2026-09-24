import { leastSquares, regressionMetrics } from '../lib/ml.js'
import RegressionSim from './sims/RegressionSim.jsx'
import { posttest, pretest } from './quiz/exp02.js'
import { ChessPretest } from '../components/lab/ChessPretest.jsx'

// Fixed observations for the Theory activities: y ≈ 0.8x + 0.3 with small, repeatable noise.
const NOISE = [0.21, -0.35, 0.12, 0.4, -0.18, 0.05, -0.27, 0.33, -0.08, 0.16, -0.4, 0.28, -0.1]
const POINTS = NOISE.map((noise, i) => {
  const x = -3 + i * 0.5
  return { x, y: 0.8 * x + 0.3 + noise }
})
const MEAN_Y = POINTS.reduce((sum, p) => sum + p.y, 0) / POINTS.length

export default {
  aim: [
    {
      p: 'To understand the concept of linear regression, implement a simple linear regression model using Python, and evaluate model performance using standard regression metrics (MAE, MSE, RMSE, R²).',
    },
    { h2: 'Learning outcomes' },
    {
      list: [
        'Explain the regression line y = b₀ + b₁x and interpret its intercept and slope.',
        'Compute residuals and explain how ordinary least squares chooses the best-fit line.',
        'Calculate and compare MAE, MSE, RMSE and R².',
        'Describe how gradient descent reaches the least-squares solution step by step.',
        'Recognise when a straight line is not appropriate, such as curved data or strong outliers.',
      ],
    },
  ],

  theory: {
    activity: {
      tasks: [
        {
          title: 'Find the direction of the trend',
          shortTitle: 'Find the direction of the trend',
          subtitle: 'Connect slope to residual error.',
          predict: {
            prompt: 'Starting with a flat line, what happens to error as the slope approaches the positive trend?',
            options: ['It initially decreases', 'It must increase', 'It never changes'],
            answer: 0,
          },
          manipulate: { label: 'Slope', min: -2, max: 2, step: 0.05, initial: 0, digits: 2 },
          evaluate: (slope) => {
            const metrics = regressionMetrics(POINTS, (x) => slope * x + MEAN_Y)
            return {
              y: metrics.rmse,
              metrics: [
                { label: 'RMSE', value: metrics.rmse.toFixed(3) },
                { label: 'MAE', value: metrics.mae.toFixed(3) },
                { label: 'Slope', value: slope.toFixed(3) },
              ],
            }
          },
          chart: { xLabel: 'Slope', yLabel: 'RMSE' },
          observe:
            'A slope near the observed trend shortens many residuals. Overshooting increases the squared residuals again: increasing a parameter does not always improve the fit.',
          limit: 'A curved relationship cannot be represented perfectly by one straight line. Try the curved preset in Simulation.',
          reason: {
            prompt: 'Why is the lowest point of the loss landscape useful?',
            options: ['It minimizes mean squared error on these observations.', 'It guarantees perfect predictions on future data.'],
            answer: 0,
            explain: 'The minimum is the best line for the training observations; performance on new data still has to be checked on a test set.',
          },
        },
        {
          title: 'Move the line without rotating it',
          shortTitle: 'Move the line without rotating it',
          subtitle: 'Connect the intercept to the average residual.',
          predict: {
            prompt: 'With the slope fixed at 0.8, what happens to MSE as the line slides from low to high?',
            options: ['It falls, then rises again (a U-shape)', 'It keeps falling', 'It does not change'],
            answer: 0,
          },
          manipulate: { label: 'Intercept', min: -2, max: 2, step: 0.05, initial: -2, digits: 2 },
          evaluate: (intercept) => {
            const metrics = regressionMetrics(POINTS, (x) => 0.8 * x + intercept)
            const meanResidual = POINTS.reduce((sum, p) => sum + p.y - (0.8 * p.x + intercept), 0) / POINTS.length
            return {
              y: metrics.mse,
              metrics: [
                { label: 'MSE', value: metrics.mse.toFixed(3) },
                { label: 'Average residual', value: meanResidual.toFixed(3) },
              ],
            }
          },
          chart: { xLabel: 'Intercept', yLabel: 'MSE' },
          observe:
            'Too low a line leaves most residuals positive; too high leaves them negative. MSE is smallest exactly where the average residual is zero, so the line passes through the centre of the data.',
          limit: 'The best intercept depends on the slope. Changing one parameter moves the best value of the other, which is why both are fitted together.',
          reason: {
            prompt: 'For a fixed slope, the intercept with the lowest MSE makes the average residual equal to…',
            options: ['zero', 'the slope', 'one'],
            answer: 0,
            explain: 'Setting the derivative of MSE with respect to the intercept to zero gives mean(actual − predicted) = 0.',
          },
        },
        {
          title: 'Give one observation a surprising value',
          shortTitle: 'Give one observation a surprising value',
          subtitle: 'Connect squared error to outliers.',
          predict: {
            prompt: 'One observation at x = 3 becomes more and more extreme. What happens to the least-squares slope?',
            options: ['It changes noticeably', 'It stays exactly the same', 'It becomes zero'],
            answer: 0,
          },
          manipulate: { label: 'Extra height of the last observation', min: 0, max: 12, step: 0.25, initial: 0, digits: 2 },
          evaluate: (extra) => {
            const shifted = POINTS.map((p, i) => (i === POINTS.length - 1 ? { x: p.x, y: p.y + extra } : p))
            const fit = leastSquares(shifted)
            const metrics = regressionMetrics(shifted, (x) => fit.slope * x + fit.intercept)
            return {
              y: fit.slope,
              metrics: [
                { label: 'Fitted slope', value: fit.slope.toFixed(3) },
                { label: 'Fitted intercept', value: fit.intercept.toFixed(3) },
                { label: 'R²', value: metrics.r2.toFixed(3) },
              ],
            }
          },
          chart: { xLabel: 'Extra height', yLabel: 'Fitted slope' },
          observe:
            'Least squares squares every residual, so one large residual can outweigh many small ones. The fitted line tilts toward the outlier and R² drops.',
          limit: 'Investigate outliers before fitting. Robust alternatives such as Huber regression reduce their influence.',
          reason: {
            prompt: 'Why is least squares sensitive to outliers?',
            options: ['Squaring makes large residuals count much more', 'It ignores large residuals', 'It fits the median instead of the mean'],
            answer: 0,
            explain: 'A residual of 10 contributes 100 to the sum of squares, as much as 100 residuals of size 1.',
          },
        },
      ],
    },
    notes: [
      { h2: '2.1 What Is Regression?' },
      {
        p: 'Regression is a supervised learning task where the model learns a mapping from input features to a continuous numerical output (the target variable). Unlike classification, which predicts discrete categories, regression predicts real-valued quantities such as house prices, temperature or sales.',
      },
      { h2: '2.2 Linear Regression' },
      {
        p: 'Linear regression assumes that the target is (approximately) a straight-line function of the inputs. It is simple, fast, easy to interpret, and a baseline for more complex models.',
      },
      { h2: '2.3 Simple Linear Regression' },
      { p: 'When there is a single input feature x, the model equation is:' },
      { eq: 'y = b₀ + b₁ · x' },
      {
        list: [
          'y is the predicted target value.',
          'b₀ (intercept) is the value of y when x = 0.',
          'b₁ (coefficient/slope) is the change in y for a one-unit increase in x.',
          'x is the input feature.',
        ],
      },
      { h2: '2.4 Multiple Linear Regression' },
      { p: 'When there are n input features, the model generalises to:' },
      { eq: 'y = b₀ + b₁x₁ + b₂x₂ + … + bₙxₙ' },
      { p: 'Each coefficient bᵢ represents the contribution of feature xᵢ to the prediction, holding all other features constant.' },
      { h2: '2.5 Residuals and the Least-Squares Method' },
      { p: 'A residual is the difference between the actual value and the predicted value for a data point:' },
      { eq: 'Residual = y_actual − y_predicted' },
      {
        p: 'The ordinary least-squares (OLS) method finds the coefficients that minimise the sum of squared residuals. This ensures the fitted line is as close as possible to the observed data points. For one feature the solution has a closed form:',
      },
      { eq: 'b₁ = Σ(xᵢ − x̄)(yᵢ − ȳ) / Σ(xᵢ − x̄)²      b₀ = ȳ − b₁x̄' },
      { h2: '2.6 Model Evaluation Metrics' },
      { p: 'The quality of a regression model is assessed using several metrics:' },
      {
        table: {
          head: ['Metric', 'Formula', 'Meaning'],
          rows: [
            ['MAE', 'mean(|y − ŷ|)', 'Average size of the errors, in the target’s units.'],
            ['MSE', 'mean((y − ŷ)²)', 'Average squared error; penalises large errors heavily.'],
            ['RMSE', '√MSE', 'Typical error size, back in the target’s units.'],
            ['R²', '1 − SS_res / SS_tot', 'Share of the variance in y explained by the model (1 is perfect).'],
          ],
        },
      },
      { h2: '2.7 Gradient Descent' },
      {
        p: 'Instead of the closed-form solution, the coefficients can be found iteratively. Gradient descent repeatedly moves each parameter a small step against the gradient of the loss:',
      },
      { eq: 'b ← b − α · ∂MSE/∂b     (α is the learning rate)' },
      {
        p: 'A learning rate that is too small converges slowly; one that is too large overshoots the minimum and can diverge. For linear regression the MSE surface is a bowl with a single minimum, so gradient descent reaches the same answer as OLS.',
      },
      { h2: '2.8 Assumptions' },
      {
        list: [
          [{ b: 'Linearity: ' }, 'the relationship between features and target is linear.'],
          [{ b: 'Independence: ' }, 'observations are independent of each other.'],
          [{ b: 'Homoscedasticity: ' }, 'residuals have constant variance across fitted values.'],
          [{ b: 'Normality: ' }, 'residuals are approximately normally distributed (important for confidence intervals).'],
          [{ b: 'No multicollinearity: ' }, 'features are not highly correlated with each other.'],
        ],
      },
      {
        note: {
          title: 'Check the residuals.',
          text: 'A residual plot with a visible pattern (such as a curve or a funnel) means a straight line is not capturing the relationship.',
        },
      },
    ],
  },

  procedure: [
    { h2: '4.1 V-Lab Workflow' },
    {
      steps: [
        'Load the dataset (e.g., California Housing or a provided CSV) and inspect features and target.',
        'Split the data into training set (80%) and test set (20%).',
        'Create a LinearRegression model and fit it on the training data.',
        'Use the trained model to predict target values on the test set.',
        "Retrieve and interpret the model's intercept and coefficients.",
        'Compute evaluation metrics: MAE, MSE, RMSE, R².',
        'Analyse the results — assess whether the model adequately captures the relationship.',
      ],
    },
    { h2: '4.2 Input → Process → Output' },
    {
      table: {
        head: ['Stage', 'Details'],
        rows: [
          ['Input', 'Dataset with numerical features and a continuous target variable.'],
          ['Process', 'Train-test split → Model fitting (OLS) → Prediction on test set.'],
          ['Output', 'Predicted values, intercept, coefficients, MAE, MSE, RMSE, R².'],
        ],
      },
    },
  ],

  results: [
    { p: 'After completing the experiment, students should observe and interpret:' },
    {
      list: [
        'The intercept (b₀) — the baseline predicted value when all features are zero.',
        'The coefficients — each coefficient indicates how much the target changes per unit change in that feature.',
        'Positive coefficients indicate a direct relationship; negative coefficients indicate an inverse relationship.',
        'MAE and RMSE should be compared against the scale of the target variable to assess practical significance.',
        'R² close to 1 indicates the model captures most of the variance; values near 0 suggest a poor fit.',
      ],
    },
    {
      p: 'Students should recognise that a good R² on the test set indicates the model generalises well. A large gap between training R² and test R² may indicate overfitting.',
    },
  ],

  pretest,
  posttest,
  pretestGame: ChessPretest,

  simulation: RegressionSim,

  python: {
    title: 'Fit a line from first principles',
    intro: 'Predict an outcome. Repair a mistake. Build a working function.',
    predict: {
      question: 'What will Python print?',
      task: 'Read the code and choose an output. Run it to test your reasoning.',
      fileName: 'linear_regression.py',
      code: 'slope, intercept = 2, 1\nx = 3\nprint(slope * x + intercept)\n',
      options: ['6', '7', '9'],
      answer: 1,
    },
    repair: {
      question: 'Repair the MSE function',
      task: 'mse() should return the mean of the squared residuals. For actual [3, 5, 7] and predicted [2, 5, 9] the answer is 5/3. Fix the bug so the program prints 1.6666666666666667.',
      fileName: 'mse.py',
      code: 'def mse(actual, predicted):\n    return sum(a - p for a, p in zip(actual, predicted)) / len(actual)\n\nprint(mse([3, 5, 7], [2, 5, 9]))\n',
      expected: '1.6666666666666667',
      hint: 'Each residual must be squared before averaging, otherwise positive and negative errors cancel out.',
    },
    build: {
      question: 'Build a least-squares fit',
      task: 'Complete fit_line(xs, ys) so it returns (slope, intercept) using the least-squares formulas b₁ = Σ(x − x̄)(y − ȳ) / Σ(x − x̄)² and b₀ = ȳ − b₁x̄.',
      fileName: 'fit_line.py',
      code: 'def fit_line(xs, ys):\n    # 1. compute the mean of xs and ys\n    # 2. compute the slope with the least-squares formula\n    # 3. compute the intercept\n    return 0.0, 0.0\n',
      tests: `def _close(a, b):
    return abs(a - b) < 1e-9

slope, intercept = fit_line([0, 1, 2, 3], [1, 3, 5, 7])
assert _close(slope, 2) and _close(intercept, 1), "points on y = 2x + 1 should give slope 2 and intercept 1"
slope, intercept = fit_line([1, 2, 3], [2, 2, 2])
assert _close(slope, 0) and _close(intercept, 2), "a flat set of points should give slope 0 and intercept 2"
slope, intercept = fit_line([1, 2, 3, 4], [2, 3, 5, 6])
assert _close(slope, 1.4) and _close(intercept, 0.5), "fit_line([1, 2, 3, 4], [2, 3, 5, 6]) should give slope 1.4 and intercept 0.5"
print("ALL TESTS PASSED")`,
      hint: 'mean_x = sum(xs) / len(xs). The numerator is sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys)).',
    },
    explore: {
      question: 'Explore freely',
      task: 'Use "Use this data in Python" in the visual activity to load your current points and line, or experiment with your own numbers.',
      fileName: 'explore.py',
      code: 'hours = [1, 2, 3, 4, 5]\nscores = [52, 57, 61, 68, 71]\n\nn = len(hours)\nmx, my = sum(hours) / n, sum(scores) / n\nslope = sum((x - mx) * (y - my) for x, y in zip(hours, scores)) / sum((x - mx) ** 2 for x in hours)\nprint("slope:", slope, "intercept:", my - slope * mx)\n',
    },
    reference: [
      {
        title: 'Linear regression with scikit-learn',
        code: `import numpy as np
from sklearn.datasets import fetch_california_housing
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split

X, y = fetch_california_housing(return_X_y=True)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

model = LinearRegression().fit(X_train, y_train)
pred = model.predict(X_test)

print("Intercept:", model.intercept_)
print("Coefficients:", model.coef_)
print("MAE:", mean_absolute_error(y_test, pred))
mse = mean_squared_error(y_test, pred)
print("MSE:", mse, "RMSE:", np.sqrt(mse))
print("R2:", r2_score(y_test, pred))`,
      },
    ],
  },

  references: [
    { text: 'James, G., Witten, D., Hastie, T. & Tibshirani, R. (2021). An Introduction to Statistical Learning (2nd ed.), Chapter 3: Linear Regression. Springer.', url: 'https://www.statlearning.com/' },
    { text: 'Géron, A. (2022). Hands-On Machine Learning with Scikit-Learn, Keras, and TensorFlow (3rd ed.), Chapter 4. O\'Reilly Media.' },
    { text: 'Montgomery, D. C., Peck, E. A. & Vining, G. G. (2021). Introduction to Linear Regression Analysis (6th ed.). Wiley.' },
    { text: 'scikit-learn User Guide — Ordinary Least Squares', url: 'https://scikit-learn.org/stable/modules/linear_model.html#ordinary-least-squares' },
    { text: 'Google Machine Learning Crash Course — Linear regression', url: 'https://developers.google.com/machine-learning/crash-course/linear-regression' },
  ],

  contributors: [{ name: 'PAC-LAB Virtual ML Lab team', role: 'Content, simulation and review' }],
}
