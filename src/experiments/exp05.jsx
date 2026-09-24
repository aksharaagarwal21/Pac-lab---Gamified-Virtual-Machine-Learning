import { gaussian, mean, pca2D, projectedVariance, seeded } from '../lib/ml.js'
import PcaSim from './sims/PcaSim.jsx'
import { posttest, pretest } from './quiz/exp05.js'

// Fixed correlated cloud for the rotation activity (centred on its mean).
const CLOUD = (() => {
  const random = seeded(51)
  const raw = Array.from({ length: 60 }, () => {
    const a = gaussian(random)
    const b = gaussian(random)
    return { x: a, y: 0.8 * a + 0.55 * b }
  })
  const mx = mean(raw.map((p) => p.x))
  const my = mean(raw.map((p) => p.y))
  return raw.map((p) => ({ x: p.x - mx, y: p.y - my }))
})()
const CLOUD_PCA = pca2D(CLOUD)
const CLOUD_PC1_ANGLE = ((((Math.atan2(CLOUD_PCA.components[0].vector[1], CLOUD_PCA.components[0].vector[0]) * 180) / Math.PI) % 180) + 180) % 180

// Eigenvalues of a standardized six-feature dataset for the "how many components" activity.
const EIGENVALUES = [3.1, 1.4, 0.7, 0.4, 0.25, 0.15]
const EIGEN_TOTAL = EIGENVALUES.reduce((sum, v) => sum + v, 0)

export default {
  aim: [
    {
      p: 'To reduce the dimensionality of a dataset using Principal Component Analysis (PCA), interpret principal components and their explained variance, and choose how many components to keep while measuring the information lost.',
    },
    { h2: 'Learning outcomes' },
    {
      list: [
        'Explain why high-dimensional, correlated data can be summarised with fewer dimensions.',
        'Describe PCA as finding orthogonal directions of maximum variance (eigenvectors of the covariance matrix).',
        'Compute and interpret explained variance ratios and read a scree plot.',
        'Project data onto principal components, reconstruct it and relate the error to discarded variance.',
        'Explain why standardization matters and recognise the limitations of PCA.',
      ],
    },
  ],

  theory: {
    activity: {
      tasks: [
        {
          title: 'Rotate the projection direction',
          shortTitle: 'Rotate the projection direction',
          subtitle: 'Connect direction to captured variance.',
          predict: {
            prompt: 'Points are dropped onto a line through a stretched cloud. As the line rotates, how does the variance of the projected points behave?',
            options: ['It peaks along the long axis and is lowest across it', 'It is the same at every angle', 'It is largest across the short axis'],
            answer: 0,
          },
          manipulate: { label: 'Line angle (degrees)', min: 0, max: 179, step: 1, initial: 90 },
          evaluate: (angle) => {
            const captured = projectedVariance(CLOUD, (angle * Math.PI) / 180)
            const share = (100 * captured) / CLOUD_PCA.totalVariance
            return {
              y: share,
              metrics: [
                { label: 'Variance captured', value: `${share.toFixed(1)}%` },
                { label: 'Variance lost', value: `${(100 - share).toFixed(1)}%` },
                { label: 'PC1 angle', value: `${CLOUD_PC1_ANGLE.toFixed(1)}°` },
              ],
            }
          },
          chart: { xLabel: 'Angle (degrees)', yLabel: 'Variance captured (%)' },
          observe:
            'Along the long axis of the cloud the shadows spread widely, so most of the variance survives. Rotating 90° away squeezes the shadows together. The best angle is the first principal component; the worst is the second.',
          limit: 'Captured and lost variance always add up to 100%: what one direction keeps, the perpendicular direction loses.',
          reason: {
            prompt: 'What is the first principal component?',
            options: ['The direction with the largest projected variance', 'The first column of the dataset', 'The direction with the smallest variance'],
            answer: 0,
            explain: 'PC1 is chosen to keep as much of the data’s spread as a single direction can.',
          },
        },
        {
          title: 'Make the features more correlated',
          shortTitle: 'Make the features more correlated',
          subtitle: 'Connect correlation to compressibility.',
          predict: {
            prompt: 'Two standardized features become more and more correlated. What happens to the share of variance explained by PC1?',
            options: ['It grows', 'It shrinks', 'It stays at 50%'],
            answer: 0,
          },
          manipulate: { label: 'Correlation between the features', min: 0, max: 0.99, step: 0.01, initial: 0, digits: 2 },
          evaluate: (r) => {
            const share = ((1 + r) / 2) * 100
            return {
              y: share,
              metrics: [
                { label: 'Eigenvalues', value: `${(1 + r).toFixed(2)} and ${(1 - r).toFixed(2)}` },
                { label: 'PC1 explains', value: `${share.toFixed(1)}%` },
                { label: 'PC2 explains', value: `${(100 - share).toFixed(1)}%` },
              ],
            }
          },
          chart: { xLabel: 'Correlation', yLabel: 'PC1 share (%)' },
          observe:
            'For two standardized features with correlation r, the covariance matrix has eigenvalues 1 + r and 1 − r. Uncorrelated features split the variance evenly; strongly correlated ones pile nearly all of it onto PC1.',
          limit: 'Real datasets with dozens of correlated measurements often need only a handful of components to keep most of their variance.',
          reason: {
            prompt: 'Why can highly correlated features be compressed well?',
            options: ['They carry largely the same information along one direction', 'They have no variance', 'They are categorical'],
            answer: 0,
            explain: 'When features move together, one combined direction describes them almost completely.',
          },
        },
        {
          title: 'Choose how many components to keep',
          shortTitle: 'Choose how many components to keep',
          subtitle: 'Connect the scree plot to information kept.',
          predict: {
            prompt: 'A six-feature dataset has eigenvalues 3.1, 1.4, 0.7, 0.4, 0.25 and 0.15. As you keep more components, how does cumulative explained variance grow?',
            options: ['Quickly at first, then it levels off', 'In equal steps', 'It decreases'],
            answer: 0,
          },
          manipulate: { label: 'Components kept (k)', min: 1, max: 6, step: 1, initial: 1 },
          evaluate: (value) => {
            const k = Math.round(value)
            const kept = EIGENVALUES.slice(0, k).reduce((sum, v) => sum + v, 0)
            const share = (100 * kept) / EIGEN_TOTAL
            return {
              y: share,
              metrics: [
                { label: 'Cumulative explained', value: `${share.toFixed(1)}%` },
                { label: 'Reconstruction loss', value: `${(100 - share).toFixed(1)}%` },
                { label: 'Dimensions', value: `6 → ${k}` },
              ],
            }
          },
          chart: { xLabel: 'Components kept', yLabel: 'Cumulative variance (%)' },
          observe:
            'Components are sorted by eigenvalue, so the first few add a lot and the last few add little. Four components already keep over 93% of the variance while dropping a third of the dimensions.',
          limit: 'The discarded eigenvalues are exactly the variance you lose, so a 95% threshold means a 5% reconstruction loss.',
          reason: {
            prompt: 'How would you choose k for this dataset?',
            options: ['Keep enough components to reach about 90–95% of the variance', 'Always keep all six', 'Always keep exactly one'],
            answer: 0,
            explain: 'A cumulative threshold (or the elbow of the scree plot) balances compression against information loss.',
          },
        },
      ],
    },
    notes: [
      { h2: '2.1 Why Reduce Dimensionality?' },
      {
        p: 'Datasets often have many features, and many of them are correlated. High-dimensional data is harder to visualise, slower to model and more prone to overfitting (the curse of dimensionality). Dimensionality reduction represents each sample with fewer numbers while keeping as much useful structure as possible.',
      },
      { h2: '2.2 The Idea Behind PCA' },
      {
        p: 'Principal Component Analysis rotates the coordinate axes so that the first new axis (PC1) points in the direction of greatest variance, the second (PC2) captures the most remaining variance while being perpendicular to PC1, and so on. Dropping the last components keeps the most variance possible for the number of dimensions kept.',
      },
      { h2: '2.3 The Algorithm' },
      {
        steps: [
          'Standardize the features (mean 0, standard deviation 1), or at least centre them.',
          'Compute the covariance matrix C = (1/n)·XᵀX of the centred data.',
          'Find the eigenvectors and eigenvalues of C: C·v = λ·v.',
          'Sort the eigenvectors by decreasing eigenvalue; they are the principal components.',
          'Choose k components and form the matrix W_k from the first k eigenvectors.',
          'Project the data: Z = X·W_k (the principal component scores).',
        ],
      },
      { h2: '2.4 Explained Variance' },
      { eq: 'Explained variance ratio of PCᵢ = λᵢ / (λ₁ + λ₂ + … + λ_d)' },
      {
        p: 'The eigenvalue λᵢ is the variance of the data along component i. A scree plot shows these values; the cumulative ratio tells you how much information k components keep.',
      },
      { h2: '2.5 Reconstruction and Information Loss' },
      { eq: 'X̂ = Z·W_kᵀ + mean       Reconstruction MSE = λ_(k+1) + … + λ_d  (per sample, summed over features)' },
      { p: 'Mapping the scores back gives an approximation of the original data. The error equals the variance in the discarded components.' },
      { h2: '2.6 PCA and SVD' },
      {
        p: 'In practice PCA is computed with the singular value decomposition of the centred data matrix, X = U·S·Vᵀ. The rows of Vᵀ are the principal components and λᵢ = sᵢ² / n. This is more numerically stable than forming the covariance matrix.',
      },
      { h2: '2.7 Applications' },
      {
        list: [
          'Visualising high-dimensional data in 2D or 3D.',
          'Speeding up and regularising other models by using fewer, uncorrelated inputs.',
          'Noise reduction and image compression (keeping the strongest components).',
          'Exploring which features vary together through the component loadings.',
        ],
      },
      { h2: '2.8 Limitations' },
      {
        list: [
          'PCA is linear; curved (non-linear) structure needs kernel PCA, t-SNE or UMAP.',
          'High variance is not the same as usefulness: a low-variance direction may separate classes best.',
          'Results depend on feature scales, so standardize when units differ.',
          'Components are mixtures of features and can be harder to interpret than the originals.',
          'PCA must be fitted on training data only to avoid leakage.',
        ],
      },
    ],
  },

  procedure: [
    { h2: '4.1 V-Lab Workflow' },
    {
      steps: [
        'Load a multi-feature dataset (for example the scikit-learn wine dataset with 13 chemical measurements).',
        'Split into training and test sets, then standardize the features with StandardScaler fitted on the training set.',
        'Fit PCA on the standardized training data and inspect explained_variance_ratio_.',
        'Plot the scree plot and the cumulative explained variance; choose the number of components that reaches about 95%.',
        'Transform the data to two components and draw a scatter plot coloured by class.',
        'Reconstruct the data with inverse_transform and compute the reconstruction error.',
        'Compare a classifier trained on all features with one trained on the principal components (inside a Pipeline).',
      ],
    },
    { h2: '4.2 Input → Process → Output' },
    {
      table: {
        head: ['Stage', 'Details'],
        rows: [
          ['Input', 'Numerical dataset with many (often correlated) features.'],
          ['Process', 'Standardize → covariance / SVD → eigenvectors sorted by eigenvalue → keep k → project.'],
          ['Output', 'Principal components, explained variance ratios, lower-dimensional scores, reconstruction error.'],
        ],
      },
    },
    { h2: '4.3 Key scikit-learn Tools' },
    {
      table: {
        head: ['Task', 'Class, attribute or method'],
        rows: [
          ['Fit PCA', [{ code: 'PCA(n_components=0.95).fit(X_train_scaled)' }]],
          ['Variance per component', [{ code: 'pca.explained_variance_ratio_' }]],
          ['Component loadings', [{ code: 'pca.components_' }]],
          ['Project and reconstruct', [{ code: 'pca.transform(X)' }, ', ', { code: 'pca.inverse_transform(Z)' }]],
          ['Use inside a model', [{ code: 'make_pipeline(StandardScaler(), PCA(n_components=5), LogisticRegression())' }]],
        ],
      },
    },
  ],

  results: [
    { p: 'After completing the experiment, students should observe and interpret:' },
    {
      list: [
        'The direction of PC1 and why it follows the long axis of the data cloud.',
        'The explained variance ratio of each component and how many components reach 90–95% cumulative variance.',
        'That the reconstruction error when keeping k components equals the variance of the discarded components.',
        'How standardization changes the components when features are measured on very different scales.',
        'Whether a model trained on the principal components performs as well as one trained on all features, and how much faster or simpler it is.',
      ],
    },
    {
      note: {
        title: 'Conclusion.',
        text: 'PCA compresses correlated features into a few uncorrelated components that keep most of the variance. Choosing k is a trade-off between simplicity and information loss.',
      },
    },
  ],

  pretest,
  posttest,

  simulation: PcaSim,

  python: {
    title: 'Compute PCA from first principles',
    intro: 'Predict an outcome. Repair a mistake. Build a working function.',
    predict: {
      question: 'What will Python print?',
      task: 'Three components have eigenvalues 6, 3 and 1. What share of the variance does the first one explain?',
      fileName: 'explained.py',
      code: 'eigenvalues = [6, 3, 1]\nprint(eigenvalues[0] / sum(eigenvalues))\n',
      options: ['0.6', '0.9', '6'],
      answer: 0,
    },
    repair: {
      question: 'Repair the centring step',
      task: 'PCA starts by subtracting the mean. For [2, 4, 6, 8] the mean is 5, so the centred values should be [-3.0, -1.0, 1.0, 3.0]. Fix the bug.',
      fileName: 'centre.py',
      code: 'values = [2, 4, 6, 8]\nmean = sum(values) / 2\ncentred = [v - mean for v in values]\nprint(centred)\n',
      expected: '[-3.0, -1.0, 1.0, 3.0]',
      hint: 'The mean divides the sum by the number of values, not by 2.',
    },
    build: {
      question: 'Build the PCA helpers',
      task: 'Complete covariance(a, b), the population covariance of two lists, and explained_ratio(eigenvalues), which returns each eigenvalue divided by their total.',
      fileName: 'pca_helpers.py',
      code: 'def covariance(a, b):\n    # mean of (a_i - mean_a) * (b_i - mean_b)\n    return 0.0\n\n\ndef explained_ratio(eigenvalues):\n    # each eigenvalue divided by the sum of all eigenvalues\n    return []\n',
      tests: `assert abs(covariance([1, 2, 3], [2, 4, 6]) - 4 / 3) < 1e-9, "covariance([1, 2, 3], [2, 4, 6]) should be 4/3"
assert abs(covariance([1, 2, 3], [3, 2, 1]) + 2 / 3) < 1e-9, "opposite trends should give a negative covariance of -2/3"
assert abs(covariance([5, 5, 5], [1, 2, 3])) < 1e-9, "a constant list has zero covariance"
ratios = explained_ratio([6, 3, 1])
assert len(ratios) == 3 and all(abs(r - e) < 1e-9 for r, e in zip(ratios, [0.6, 0.3, 0.1])), "explained_ratio([6, 3, 1]) should be [0.6, 0.3, 0.1]"
print("ALL TESTS PASSED")`,
      hint: 'Compute both means first, then average the products of the deviations over len(a).',
    },
    explore: {
      question: 'Explore freely',
      task: 'Use "Use this data in Python" in the visual activity to run a full 2D PCA on the simulation’s data, or try your own points.',
      fileName: 'explore.py',
      code: 'import math\n\nheight = [150, 160, 165, 170, 180, 185]\nweight = [50, 56, 61, 65, 74, 80]\nn = len(height)\nmh, mw = sum(height) / n, sum(weight) / n\nr = sum((h - mh) * (w - mw) for h, w in zip(height, weight)) / math.sqrt(sum((h - mh) ** 2 for h in height) * sum((w - mw) ** 2 for w in weight))\nprint("correlation:", round(r, 3))\nprint("PC1 share if standardized:", round((1 + abs(r)) / 2, 3))\n',
    },
    reference: [
      {
        title: 'PCA on the wine dataset',
        code: `import numpy as np
from sklearn.datasets import load_wine
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

X, y = load_wine(return_X_y=True)
X_scaled = StandardScaler().fit_transform(X)

pca = PCA().fit(X_scaled)
print("Explained variance ratio:", np.round(pca.explained_variance_ratio_, 3))
print("Components for 95%:", np.argmax(np.cumsum(pca.explained_variance_ratio_) >= 0.95) + 1)

Z = PCA(n_components=2).fit_transform(X_scaled)   # 13 features -> 2 for plotting
print("Projected shape:", Z.shape)`,
      },
    ],
  },

  references: [
    { text: 'Jolliffe, I. T. & Cadima, J. (2016). Principal component analysis: a review and recent developments. Philosophical Transactions of the Royal Society A, 374, 20150202.', url: 'https://doi.org/10.1098/rsta.2015.0202' },
    { text: 'Jolliffe, I. T. (2002). Principal Component Analysis (2nd ed.). Springer.' },
    { text: 'James, G., Witten, D., Hastie, T. & Tibshirani, R. (2021). An Introduction to Statistical Learning (2nd ed.), Chapter 12: Unsupervised Learning. Springer.', url: 'https://www.statlearning.com/' },
    { text: 'Shlens, J. (2014). A Tutorial on Principal Component Analysis. arXiv:1404.1100.', url: 'https://arxiv.org/abs/1404.1100' },
    { text: 'scikit-learn User Guide — Principal component analysis (PCA)', url: 'https://scikit-learn.org/stable/modules/decomposition.html#pca' },
  ],

  contributors: [{ name: 'PAC-LAB Virtual ML Lab team', role: 'Content, simulation and review' }],
}
