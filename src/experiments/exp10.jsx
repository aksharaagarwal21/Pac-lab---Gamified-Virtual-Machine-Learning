import PerceptronSim, { freshState, makePerceptronData, misclassified, runEpoch, trainToConvergence } from './sims/PerceptronSim.jsx'
import { posttest, pretest } from './quiz/exp10.js'

const AND = makePerceptronData('and')
const XOR = makePerceptronData('xor')
const weightsText = (w) => w.map((v) => (Math.abs(v) < 5e-4 ? '0.00' : v.toFixed(2))).join(', ')

// Weights after each epoch on the AND gate (zero start, η = 0.1).
const AND_EPOCHS = (() => {
  let state = freshState('zero')
  const states = [state]
  while (!state.converged && state.epoch < 50) {
    state = runEpoch(AND, 0.1, state)
    states.push(state)
  }
  return states
})()

const XOR_EPOCHS = (() => {
  let state = freshState('zero')
  const states = [state]
  for (let i = 0; i < 20; i++) {
    state = runEpoch(XOR, 0.1, state)
    states.push(state)
  }
  return states
})()

const RATE_LIMIT = 300
const rateCache = new Map()
function epochsForRate(exponent) {
  const key = exponent.toFixed(2)
  if (!rateCache.has(key)) rateCache.set(key, trainToConvergence(AND, 10 ** exponent, freshState('poor'), RATE_LIMIT))
  return rateCache.get(key)
}

export default {
  aim: [
    {
      p: 'To implement a single-layer artificial neural network (the perceptron), train it with the perceptron learning rule, visualise how its decision boundary changes with each update, and understand why it can learn linearly separable problems such as AND and OR but not XOR.',
    },
    { h2: 'Learning outcomes' },
    {
      list: [
        'Relate a biological neuron to an artificial neuron with weights, bias and an activation function.',
        'Compute a perceptron’s output and apply the learning rule w ← w + η(y − ŷ)x by hand.',
        'Interpret the decision boundary and weight vector geometrically.',
        'Explain the convergence theorem and the role of the learning rate and starting weights.',
        'Explain why XOR needs a hidden layer and how multilayer networks overcome the perceptron’s limits.',
      ],
    },
  ],

  theory: {
    activity: {
      tasks: [
        {
          title: 'Train a perceptron on the AND gate',
          shortTitle: 'Train a perceptron on the AND gate',
          subtitle: 'Connect mistakes to weight updates.',
          predict: {
            prompt: 'Starting from zero weights with η = 0.1, what happens to the number of misclassified AND inputs as training proceeds epoch by epoch?',
            options: ['It reaches zero after a few epochs and the weights stop changing', 'It stays constant', 'It keeps changing forever'],
            answer: 0,
          },
          manipulate: { label: 'Epochs completed', min: 0, max: AND_EPOCHS.length - 1, step: 1, initial: 0 },
          evaluate: (value) => {
            const index = Math.max(0, Math.min(AND_EPOCHS.length - 1, Math.round(value)))
            const state = AND_EPOCHS[index]
            const wrong = misclassified(state.weights, AND)
            return {
              y: wrong,
              metrics: [
                { label: 'Weights (w₁, w₂, b)', value: weightsText(state.weights) },
                { label: 'Misclassified now', value: `${wrong} of 4` },
                { label: 'Mistakes during this epoch', value: index === 0 ? '—' : String(state.history[index - 1].y) },
                { label: 'Status', value: state.converged ? 'Converged' : 'Training' },
              ],
            }
          },
          chart: { xLabel: 'Epochs completed', yLabel: 'Misclassified inputs' },
          observe: `With all weights at zero, z = 0 for every input, so the neuron outputs 1 everywhere and gets three of four AND inputs wrong. Each mistake shifts the weights; after ${AND_EPOCHS.length - 2} epochs the line separates (1, 1) from the other inputs, and the next epoch makes no mistakes, so the weights stop changing.`,
          limit: 'Training stops as soon as a separating line is found; it is not necessarily the widest-margin line.',
          reason: {
            prompt: 'Why can a single perceptron learn AND?',
            options: ['A straight line can separate (1, 1) from the other three inputs', 'AND has more 1s than 0s', 'The learning rate was small'],
            answer: 0,
            explain: 'AND is linearly separable, so the convergence theorem guarantees success.',
          },
        },
        {
          title: 'Change the learning rate from a poor start',
          shortTitle: 'Change the learning rate from a poor start',
          subtitle: 'Connect η to the speed of learning.',
          predict: {
            prompt: 'The weights start at w₁ = 1, w₂ = −1, b = 0.5, a badly placed line. How does the learning rate affect the number of epochs needed to learn AND?',
            options: ['Small rates need far more epochs than larger rates', 'The learning rate has no effect', 'Larger rates always fail to converge'],
            answer: 0,
          },
          manipulate: { label: 'log₁₀ η', min: -2, max: 0.5, step: 0.1, initial: -2, digits: 1 },
          evaluate: (exponent) => {
            const state = epochsForRate(exponent)
            return {
              y: state.epoch,
              metrics: [
                { label: 'Learning rate η', value: (10 ** exponent).toFixed(3) },
                { label: 'Epochs', value: state.converged ? String(state.epoch) : `${RATE_LIMIT}+ (not converged)` },
                { label: 'Final weights', value: weightsText(state.weights) },
              ],
            }
          },
          chart: { xLabel: 'log₁₀ η', yLabel: 'Epochs to converge' },
          observe:
            'Each update moves the weights by η times the input. With a tiny η the badly placed starting line creeps towards a solution and needs many epochs; with a larger η it jumps there in a handful. With zero starting weights the rate would make no difference at all: every weight is then a multiple of η, so every prediction is the same.',
          limit: 'The perceptron still converges for any positive η on separable data; the rate changes how long it takes, and how the start compares with the updates.',
          reason: {
            prompt: 'Why does a small learning rate slow learning from this start?',
            options: [
              'The starting weights are large compared with each update, so many updates are needed to move the line',
              'Small rates make the data non-separable',
              'The step function ignores small weights',
            ],
            answer: 0,
            explain: 'The number of updates depends on the start measured in units of η.',
          },
        },
        {
          title: 'Try to learn XOR',
          shortTitle: 'Try to learn XOR',
          subtitle: 'Connect linear separability to the limits of one neuron.',
          predict: {
            prompt: 'The same perceptron is trained on XOR for 20 epochs. What happens to the mistakes it makes in each epoch?',
            options: ['They never reach zero', 'They reach zero after a few epochs', 'They reach zero after exactly 20 epochs'],
            answer: 0,
          },
          manipulate: { label: 'Epoch', min: 1, max: 20, step: 1, initial: 1 },
          evaluate: (value) => {
            const index = Math.max(1, Math.min(20, Math.round(value)))
            const state = XOR_EPOCHS[index]
            return {
              y: state.history[index - 1].y,
              metrics: [
                { label: 'Mistakes during this epoch', value: String(state.history[index - 1].y) },
                { label: 'Misclassified after the epoch', value: `${misclassified(state.weights, XOR)} of 4` },
                { label: 'Weights (w₁, w₂, b)', value: weightsText(state.weights) },
              ],
            }
          },
          chart: { xLabel: 'Epoch', yLabel: 'Mistakes in the epoch' },
          observe:
            'XOR outputs 1 for (0, 1) and (1, 0) but 0 for (0, 0) and (1, 1), the opposite corners. Any line that puts both 1s on one side also captures at least one 0, so every epoch contains mistakes. After a couple of epochs the updates undo each other: the weights change during every pass but end each epoch exactly where they started, cycling forever instead of converging.',
          limit: 'Training for longer or changing the learning rate cannot fix this: one neuron can only draw one straight line.',
          reason: {
            prompt: 'What change lets a neural network learn XOR?',
            options: ['Add a hidden layer, for example OR and NAND neurons feeding an AND neuron', 'Use a much larger learning rate', 'Remove the bias term'],
            answer: 0,
            explain: 'The hidden layer creates new features in which XOR becomes linearly separable.',
          },
        },
      ],
    },
    notes: [
      { h2: '2.1 From Biological to Artificial Neurons' },
      {
        p: 'A biological neuron receives signals through dendrites, combines them in the cell body and fires along its axon when the combined signal exceeds a threshold. McCulloch and Pitts (1943) modelled this as a threshold logic unit, and Rosenblatt (1958) added a learning rule, creating the perceptron.',
      },
      {
        table: {
          head: ['Biological neuron', 'Artificial neuron'],
          rows: [
            ['Dendrites (inputs)', 'Input features x₁ … x_d'],
            ['Synapse strength', 'Weights w₁ … w_d'],
            ['Firing threshold', 'Bias b'],
            ['Cell body (summation)', 'z = w·x + b'],
            ['Firing / not firing', 'Activation: ŷ = step(z)'],
          ],
        },
      },
      { h2: '2.2 The Perceptron Model' },
      { eq: 'z = w₁x₁ + w₂x₂ + … + w_dx_d + b          ŷ = 1 if z ≥ 0, otherwise 0' },
      {
        p: 'The decision boundary w·x + b = 0 is a straight line (a hyperplane in more dimensions). The weight vector w is perpendicular to it and points towards the side predicted as class 1; the bias moves the line away from the origin.',
      },
      { h2: '2.3 The Perceptron Learning Rule' },
      { eq: 'wᵢ ← wᵢ + η(y − ŷ)xᵢ          b ← b + η(y − ŷ)' },
      {
        table: {
          head: ['Label y', 'Prediction ŷ', 'y − ŷ', 'Effect'],
          rows: [
            ['1', '1', '0', 'Correct: no change'],
            ['0', '0', '0', 'Correct: no change'],
            ['1', '0', '+1', 'Add ηx: the line tilts to include the point'],
            ['0', '1', '−1', 'Subtract ηx: the line tilts to exclude the point'],
          ],
        },
      },
      { h2: '2.4 Training Algorithm' },
      {
        steps: [
          'Initialise the weights and bias (for example to zero) and choose a learning rate η.',
          'For each training sample, compute z = w·x + b and ŷ = step(z).',
          'If ŷ ≠ y, update the weights and bias with the learning rule.',
          'After a full pass (an epoch), stop if there were no mistakes; otherwise repeat.',
          'Stop after a maximum number of epochs if the data is not separable.',
        ],
      },
      { h2: '2.5 Convergence and the Learning Rate' },
      {
        p: 'Perceptron convergence theorem (Novikoff, 1962): if a hyperplane separates the training data with margin γ and all points lie within radius R, the perceptron makes at most (R/γ)² mistakes before it classifies every point correctly. A narrow margin means potentially more mistakes. The final line depends on the starting weights, the learning rate and the order of the samples, and is not in general the maximum-margin line.',
      },
      {
        p: 'With zero starting weights, the learning rate only scales the weights and never changes a prediction. With non-zero starting weights it matters: small rates move slowly away from the starting line.',
      },
      { h2: '2.6 Logic Gates and Linear Separability' },
      {
        table: {
          head: ['Gate', 'Outputs for (0,0), (0,1), (1,0), (1,1)', 'Linearly separable?', 'Example weights (w₁, w₂, b)'],
          rows: [
            ['AND', '0, 0, 0, 1', 'Yes', '(1, 1, −1.5)'],
            ['OR', '0, 1, 1, 1', 'Yes', '(1, 1, −0.5)'],
            ['NAND', '1, 1, 1, 0', 'Yes', '(−1, −1, 1.5)'],
            ['XOR', '0, 1, 1, 0', 'No', 'None exist'],
          ],
        },
      },
      {
        p: 'Minsky and Papert (1969) showed that single-layer perceptrons cannot compute XOR. A two-layer network can: hidden neurons compute OR and NAND, and an output neuron combines them with AND.',
      },
      { h2: '2.7 Towards Multilayer Neural Networks' },
      {
        list: [
          'Multilayer perceptrons (MLPs) stack layers of neurons, so they can form non-linear decision boundaries.',
          'They replace the step function with differentiable activations (sigmoid, tanh, ReLU).',
          'Backpropagation computes the gradient of the loss for every weight, and gradient descent updates them.',
          'With enough hidden neurons, a network with one hidden layer can approximate any continuous function (universal approximation theorem).',
        ],
      },
      { h2: '2.8 Limitations of the Perceptron' },
      {
        list: [
          'Only linear decision boundaries; fails on non-separable data such as XOR.',
          'Never settles on non-separable data (the pocket algorithm keeps the best weights seen).',
          'Outputs hard labels with no probability or confidence.',
          'Any separating line is accepted, so it may generalise worse than a maximum-margin classifier.',
        ],
      },
    ],
  },

  procedure: [
    { h2: '4.1 V-Lab Workflow' },
    {
      steps: [
        'Create the truth tables for AND, OR and XOR as training data.',
        'Implement the perceptron: weighted sum, step activation and learning rule.',
        'Train on AND and OR, recording the mistakes per epoch and the final weights; verify the outputs.',
        'Train on XOR and observe that the mistakes never reach zero.',
        'Repeat with different learning rates and starting weights, and compare the number of epochs.',
        'Train scikit-learn’s Perceptron on a linearly separable dataset and report the accuracy.',
        'Solve XOR with a two-layer network (hand-set weights or MLPClassifier).',
      ],
    },
    { h2: '4.2 Input → Process → Output' },
    {
      table: {
        head: ['Stage', 'Details'],
        rows: [
          ['Input', 'Numerical features with binary labels (for example logic gate truth tables).'],
          ['Process', 'Weighted sum → step activation → compare with label → update weights on mistakes → repeat for epochs.'],
          ['Output', 'Learned weights and bias, decision boundary, predictions, mistakes per epoch.'],
        ],
      },
    },
    { h2: '4.3 Key scikit-learn Tools' },
    {
      table: {
        head: ['Task', 'Class or attribute'],
        rows: [
          ['Perceptron', [{ code: 'Perceptron(eta0=0.1, max_iter=100, shuffle=False)' }]],
          ['Learned weights and bias', [{ code: 'model.coef_' }, ', ', { code: 'model.intercept_' }]],
          ['Epochs run', [{ code: 'model.n_iter_' }]],
          ['Multilayer network', [{ code: "MLPClassifier(hidden_layer_sizes=(4,), activation='tanh')" }]],
        ],
      },
    },
  ],

  results: [
    { p: 'After completing the experiment, students should observe and interpret:' },
    {
      list: [
        'The step-by-step weight updates and how each mistake moves the decision line.',
        'Convergence on AND, OR and separable data, with zero mistakes in the final epoch.',
        'Mistakes that never stop on XOR and overlapping data.',
        'The effect of the learning rate and starting weights on the number of epochs.',
        'A two-layer network that computes XOR correctly.',
      ],
    },
    {
      note: {
        title: 'Conclusion.',
        text: 'The perceptron learns a linear decision boundary by correcting its weights after every mistake and is guaranteed to converge on linearly separable data. Its failure on XOR shows why neural networks need hidden layers and differentiable activations trained with backpropagation.',
      },
    },
  ],

  pretest,
  posttest,

  simulation: PerceptronSim,

  python: {
    title: 'Neurons, updates and logic gates',
    intro: 'Predict an outcome. Repair a mistake. Build a working function.',
    predict: {
      question: 'What will Python print?',
      task: 'A perceptron has weights (0.5, −0.5) and bias 0.2. What does it output for the input (1, 2)?',
      fileName: 'neuron.py',
      code: 'w1, w2, b = 0.5, -0.5, 0.2\nx1, x2 = 1, 2\nz = w1 * x1 + w2 * x2 + b\nprint(1 if z >= 0 else 0)\n',
      options: ['0', '1', '-0.3'],
      answer: 0,
    },
    repair: {
      question: 'Repair the learning rule',
      task: 'Trained on the AND gate from zero weights with η = 0.1, the perceptron should end with weights [0.2, 0.1, -0.2]. The error term is wrong. Fix it.',
      fileName: 'learn_and.py',
      code: 'X = [(0, 0), (0, 1), (1, 0), (1, 1)]\nY = [0, 0, 0, 1]\nw1, w2, b = 0.0, 0.0, 0.0\nrate = 0.1\n\nfor epoch in range(10):\n    for (x1, x2), label in zip(X, Y):\n        prediction = 1 if w1 * x1 + w2 * x2 + b >= 0 else 0\n        error = prediction - label\n        w1 += rate * error * x1\n        w2 += rate * error * x2\n        b += rate * error\n\nprint([round(w1, 2), round(w2, 2), round(b, 2)])\n',
      expected: '[0.2, 0.1, -0.2]',
      hint: 'The error must be label − prediction, so a missed 1 pushes the weights towards the input.',
    },
    build: {
      question: 'Build a perceptron',
      task: 'Complete predict(weights, bias, x), returning 1 when the weighted sum plus bias is ≥ 0, and update(weights, bias, x, label, rate), returning the new (weights, bias) after one application of the perceptron learning rule.',
      fileName: 'perceptron.py',
      code: 'def predict(weights, bias, x):\n    # step(w · x + b)\n    return 0\n\n\ndef update(weights, bias, x, label, rate):\n    # return (new_weights, new_bias)\n    return weights, bias\n',
      tests: `assert predict([1, 1], -1.5, [1, 1]) == 1, "AND weights should output 1 for (1, 1)"
assert predict([1, 1], -1.5, [0, 1]) == 0, "AND weights should output 0 for (0, 1)"
assert predict([0, 0], 0, [5, 5]) == 1, "a sum of exactly 0 fires"
w, b = update([0.0, 0.0], 0.0, [1, 0], 0, 0.5)
assert w == [-0.5, 0.0] and b == -0.5, "predicting 1 for label 0 should subtract rate * x from the weights and rate from the bias"
w, b = update([1.0, 1.0], -1.5, [1, 1], 1, 0.5)
assert w == [1.0, 1.0] and b == -1.5, "a correct prediction should not change anything"
print("ALL TESTS PASSED")`,
      hint: 'error = label - predict(weights, bias, x); new weights are [w + rate * error * xi for w, xi in zip(weights, x)].',
    },
    explore: {
      question: 'Explore freely',
      task: 'Use "Use this data in Python" in the visual activity to train the same perceptron in Python, or explore the two-layer network below that solves XOR.',
      fileName: 'explore.py',
      code: 'def step(z):\n    return 1 if z >= 0 else 0\n\ndef xor_network(x1, x2):\n    h_or = step(1 * x1 + 1 * x2 - 0.5)      # hidden neuron 1: OR\n    h_nand = step(-1 * x1 - 1 * x2 + 1.5)   # hidden neuron 2: NAND\n    return step(1 * h_or + 1 * h_nand - 1.5)  # output neuron: AND\n\nfor x1 in (0, 1):\n    for x2 in (0, 1):\n        print(f"XOR({x1}, {x2}) = {xor_network(x1, x2)}")\n',
    },
    reference: [
      {
        title: 'Perceptron and a small MLP with scikit-learn',
        code: `import numpy as np
from sklearn.datasets import make_classification
from sklearn.linear_model import Perceptron
from sklearn.model_selection import train_test_split
from sklearn.neural_network import MLPClassifier

X, y = make_classification(n_samples=300, n_features=2, n_redundant=0, n_clusters_per_class=1, class_sep=2.0, random_state=42)
X_train, X_test, y_train, y_test = train_test_split(X, y, random_state=42)
model = Perceptron(eta0=0.1, max_iter=100, random_state=42).fit(X_train, y_train)
print("Perceptron test accuracy:", round(model.score(X_test, y_test), 3), "weights:", model.coef_.round(2), "bias:", model.intercept_.round(2))

X_xor = np.array([[0, 0], [0, 1], [1, 0], [1, 1]])
y_xor = np.array([0, 1, 1, 0])
print("Perceptron on XOR:", Perceptron(max_iter=100).fit(X_xor, y_xor).score(X_xor, y_xor))
mlp = MLPClassifier(hidden_layer_sizes=(4,), activation="tanh", solver="lbfgs", random_state=1).fit(X_xor, y_xor)
print("MLP on XOR:", mlp.score(X_xor, y_xor), mlp.predict(X_xor))`,
      },
    ],
  },

  references: [
    { text: 'Rosenblatt, F. (1958). The perceptron: a probabilistic model for information storage and organization in the brain. Psychological Review, 65(6), 386–408.', url: 'https://doi.org/10.1037/h0042519' },
    { text: 'McCulloch, W. S. & Pitts, W. (1943). A logical calculus of the ideas immanent in nervous activity. Bulletin of Mathematical Biophysics, 5, 115–133.', url: 'https://doi.org/10.1007/BF02478259' },
    { text: 'Minsky, M. & Papert, S. (1969). Perceptrons: An Introduction to Computational Geometry. MIT Press.' },
    { text: 'Novikoff, A. B. J. (1962). On convergence proofs on perceptrons. Proceedings of the Symposium on the Mathematical Theory of Automata, 12, 615–622.' },
    { text: 'Goodfellow, I., Bengio, Y. & Courville, A. (2016). Deep Learning, Chapter 6: Deep Feedforward Networks. MIT Press.', url: 'https://www.deeplearningbook.org/' },
    { text: 'scikit-learn User Guide — Perceptron and Neural network models (supervised)', url: 'https://scikit-learn.org/stable/modules/linear_model.html#perceptron' },
  ],

  contributors: [{ name: 'PAC-LAB Virtual ML Lab team', role: 'Content, simulation and review' }],
}
