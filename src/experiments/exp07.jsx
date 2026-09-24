import { silhouette } from '../lib/ml.js'
import KMeansSim, { bestKMeans, makeKMeansData, runLloyd } from './sims/KMeansSim.jsx'
import { posttest, pretest } from './quiz/exp07.js'

// Clustering for every sampled slider value is costly, so cache results per integer k.
function cachedByInt(fn) {
  const cache = new Map()
  return (value) => {
    const key = Math.round(value)
    if (!cache.has(key)) cache.set(key, fn(key))
    return cache.get(key)
  }
}

const BLOBS = makeKMeansData('blobs')
const FIVE = makeKMeansData('five')
const POOR_START = [
  { x: -3, y: 3 },
  { x: -2.6, y: 3 },
  { x: -3, y: 2.6 },
  { x: -2.6, y: 2.6 },
]
const POOR_RUN = runLloyd(BLOBS, POOR_START)
const BEST_FOUR = bestKMeans(BLOBS, 4).inertia

export default {
  aim: [
    {
      p: 'To group unlabelled data with the K-Means clustering algorithm, understand the assignment and update steps of Lloyd’s algorithm, and choose the number of clusters using inertia (the elbow method) and the silhouette score.',
    },
    { h2: 'Learning outcomes' },
    {
      list: [
        'Explain clustering as unsupervised learning and describe where it is used.',
        'Carry out the assignment and update steps of k-means by hand and in code.',
        'Interpret inertia and explain why it can only decrease during training.',
        'Explain why initialisation matters and how k-means++ and multiple starts help.',
        'Choose k with the elbow method and silhouette analysis, and recognise the limitations of k-means.',
      ],
    },
  ],

  theory: {
    activity: {
      tasks: [
        {
          title: 'Add clusters and watch the inertia',
          shortTitle: 'Add clusters and watch the inertia',
          subtitle: 'Connect k to inertia and the elbow.',
          predict: {
            prompt: 'The data has four natural groups. As k grows from 1 to 8, how does the best achievable inertia change?',
            options: ['It falls steeply until k = 4, then only slightly', 'It falls by the same amount for every extra cluster', 'It is lowest at k = 4 and rises afterwards'],
            answer: 0,
          },
          manipulate: { label: 'Number of clusters k', min: 1, max: 8, step: 1, initial: 1 },
          evaluate: cachedByInt((k) => {
            const model = bestKMeans(BLOBS, k)
            const previous = k > 1 ? bestKMeans(BLOBS, k - 1).inertia : null
            return {
              y: model.inertia,
              metrics: [
                { label: 'Inertia', value: model.inertia.toFixed(1) },
                { label: 'Drop from k − 1', value: previous === null ? '—' : (previous - model.inertia).toFixed(1) },
                { label: 'Silhouette', value: k > 1 ? silhouette(BLOBS, model.assignments).toFixed(3) : '—' },
              ],
            }
          }),
          chart: { xLabel: 'Number of clusters k', yLabel: 'Inertia' },
          observe:
            'Each of the first few clusters removes a large share of the inertia because it captures a real group. After k = 4 the new clusters only split existing groups, so the inertia barely moves: that bend is the elbow.',
          limit: 'Inertia keeps falling all the way to zero when every point has its own cluster, so the lowest inertia is never the right choice of k.',
          reason: {
            prompt: 'What does the elbow tell you?',
            options: ['The k after which extra clusters give little improvement', 'The k with the lowest inertia', 'The number of features'],
            answer: 0,
            explain: 'The elbow balances a compact description of the data against the number of clusters.',
          },
        },
        {
          title: 'Score the clusters with the silhouette',
          shortTitle: 'Score the clusters with the silhouette',
          subtitle: 'Connect k to cluster separation.',
          predict: {
            prompt: 'The data has five compact groups. How does the average silhouette score behave as k goes from 2 to 8?',
            options: ['It peaks at k = 5', 'It rises steadily with k', 'It is highest at k = 2'],
            answer: 0,
          },
          manipulate: { label: 'Number of clusters k', min: 2, max: 8, step: 1, initial: 2 },
          evaluate: cachedByInt((k) => {
            const model = bestKMeans(FIVE, k)
            const score = silhouette(FIVE, model.assignments)
            return {
              y: score,
              metrics: [
                { label: 'Silhouette', value: score.toFixed(3) },
                { label: 'Inertia', value: model.inertia.toFixed(1) },
                { label: 'Reading', value: score > 0.7 ? 'Strong structure' : score > 0.5 ? 'Reasonable structure' : 'Weak structure' },
              ],
            }
          }),
          chart: { xLabel: 'Number of clusters k', yLabel: 'Mean silhouette' },
          observe:
            'Too few clusters merge separate groups, so points sit close to another group. Too many split real groups, so points have near neighbours in another cluster. The silhouette is highest when the clusters match the five real groups.',
          limit: 'Unlike inertia, the silhouette can go down as k increases, so its maximum is a direct suggestion for k.',
          reason: {
            prompt: 'A point has silhouette close to 0. What does that mean?',
            options: ['It lies near the border between two clusters', 'It is exactly at its centroid', 'It belongs to no cluster'],
            answer: 0,
            explain: 'Its average distance to its own cluster is about the same as to the nearest other cluster.',
          },
        },
        {
          title: 'Run Lloyd’s algorithm from a poor start',
          shortTitle: 'Run Lloyd’s algorithm from a poor start',
          subtitle: 'Connect iterations to convergence and local minima.',
          predict: {
            prompt: 'All four centroids start bunched in one corner. As the algorithm iterates, what happens to inertia?',
            options: ['It never increases, and it stops once nothing changes', 'It goes up and down', 'It always reaches the best possible value'],
            answer: 0,
          },
          manipulate: { label: 'Iterations completed', min: 0, max: POOR_RUN.trace.length - 1, step: 1, initial: 0 },
          evaluate: (value) => {
            const index = Math.max(0, Math.min(POOR_RUN.trace.length - 1, Math.round(value)))
            const entry = POOR_RUN.trace[index]
            const last = index === POOR_RUN.trace.length - 1
            return {
              y: entry.inertia,
              metrics: [
                { label: 'Inertia', value: entry.inertia.toFixed(1) },
                { label: 'Points reassigned', value: index === 0 ? 'initial assignment' : String(entry.moved) },
                { label: 'Status', value: last ? 'Converged' : 'Still changing' },
                { label: 'Best possible (k = 4)', value: BEST_FOUR.toFixed(1) },
              ],
            }
          },
          chart: { xLabel: 'Iteration', yLabel: 'Inertia' },
          observe:
            'Each iteration lowers the inertia sharply at first, then by less, until no point changes cluster. But this run stops at a much higher inertia than the best solution: two centroids ended up sharing one group while another pair of groups was merged.',
          limit: 'K-means is guaranteed to converge, but only to a local minimum that depends on where it started.',
          reason: {
            prompt: 'How do practitioners avoid such poor local minima?',
            options: ['Use k-means++ and run several initialisations, keeping the lowest inertia', 'Run more iterations after convergence', 'Always set k to the number of points'],
            answer: 0,
            explain: 'scikit-learn does both by default: init="k-means++" with multiple runs (n_init).',
          },
        },
      ],
    },
    notes: [
      { h2: '2.1 Clustering' },
      {
        p: 'Clustering is unsupervised learning: the algorithm receives only features and must discover groups of similar points. It is used for customer segmentation, grouping documents, image compression (colour quantisation), anomaly detection and as a first look at unfamiliar data.',
      },
      { h2: '2.2 The K-Means Objective' },
      { p: 'K-means represents each of k clusters by its centroid μⱼ and seeks the partition that minimises the within-cluster sum of squares (inertia):' },
      { eq: 'J = Σᵢ ‖xᵢ − μ_c(i)‖²     where c(i) is the cluster of point i' },
      { h2: '2.3 Lloyd’s Algorithm' },
      {
        steps: [
          'Choose k and initialise k centroids (for example with k-means++).',
          'Assignment step: assign every point to its nearest centroid.',
          'Update step: move every centroid to the mean of the points assigned to it.',
          'Repeat steps 2 and 3 until no point changes cluster (or a maximum number of iterations is reached).',
        ],
      },
      {
        p: 'Neither step can increase J: the assignment picks the closest centroid for each point, and the mean is the position that minimises the squared distances within a cluster. Because there are finitely many partitions, the algorithm always terminates, but only at a local minimum.',
      },
      { h2: '2.4 Initialisation and k-means++' },
      {
        p: 'Random starting centroids can land close together and produce poor clusters. k-means++ picks the first centroid at random and each further centroid with probability proportional to D(x)², its squared distance from the nearest centroid already chosen. Running the algorithm several times (n_init) and keeping the lowest inertia further reduces the risk.',
      },
      { h2: '2.5 Choosing k' },
      {
        table: {
          head: ['Method', 'Idea', 'Choose'],
          rows: [
            ['Elbow method', 'Plot inertia against k', 'The bend where extra clusters stop reducing inertia much'],
            ['Silhouette analysis', 's = (b − a) / max(a, b) averaged over points, from −1 to +1', 'The k with the highest mean silhouette'],
            ['Domain knowledge', 'Business or scientific constraints', 'A k that is useful and interpretable'],
          ],
        },
      },
      { p: 'Here a is a point’s mean distance to the other members of its cluster and b is its mean distance to the points of the nearest other cluster.' },
      { h2: '2.6 Practical Considerations' },
      {
        list: [
          'Scale features first, since Euclidean distance is dominated by large-valued features.',
          'Each iteration costs O(n·k·d), so k-means scales well; MiniBatchKMeans handles very large datasets.',
          'Outliers pull centroids because the objective uses squared distances.',
          'Categorical data needs a different method (for example k-modes).',
        ],
      },
      { h2: '2.7 Limitations' },
      {
        list: [
          'k must be chosen in advance.',
          'Clusters are assumed to be compact, convex and of similar size and spread, so curved or nested shapes (moons, rings) are split incorrectly.',
          'Results depend on initialisation and can be local minima.',
          'Every point is forced into a cluster, even noise; DBSCAN, Gaussian mixture models or hierarchical clustering can be better choices.',
        ],
      },
    ],
  },

  procedure: [
    { h2: '4.1 V-Lab Workflow' },
    {
      steps: [
        'Load an unlabelled dataset (for example make_blobs, or the iris measurements without their species labels).',
        'Standardize the features with StandardScaler.',
        'Fit KMeans for k = 1 to 10 and record inertia_ for the elbow plot.',
        'Compute silhouette_score for k = 2 to 10 and compare it with the elbow.',
        'Fit the final model with the chosen k, init="k-means++" and n_init=10.',
        'Plot the clusters and cluster_centers_, and inspect the size of each cluster.',
        'Interpret each cluster using the original (unscaled) feature means.',
      ],
    },
    { h2: '4.2 Input → Process → Output' },
    {
      table: {
        head: ['Stage', 'Details'],
        rows: [
          ['Input', 'Unlabelled numerical features.'],
          ['Process', 'Scale → initialise centroids → repeat assignment and update until stable → keep the best of several runs.'],
          ['Output', 'Cluster label for each point, centroids, inertia and silhouette score.'],
        ],
      },
    },
    { h2: '4.3 Key scikit-learn Tools' },
    {
      table: {
        head: ['Task', 'Class, attribute or function'],
        rows: [
          ['Fit k-means', [{ code: "KMeans(n_clusters=4, init='k-means++', n_init=10, random_state=42)" }]],
          ['Cluster labels and centroids', [{ code: 'model.labels_' }, ', ', { code: 'model.cluster_centers_' }]],
          ['Inertia', [{ code: 'model.inertia_' }]],
          ['Silhouette score', [{ code: 'silhouette_score(X, labels)' }]],
          ['Large datasets', [{ code: 'MiniBatchKMeans(n_clusters=4)' }]],
        ],
      },
    },
  ],

  results: [
    { p: 'After completing the experiment, students should observe and interpret:' },
    {
      list: [
        'How the assignment and update steps move the centroids until no point changes cluster.',
        'That inertia never increases between iterations.',
        'Runs from different initialisations that converge to different inertia values (local minima).',
        'The elbow in the inertia curve and the peak of the silhouette score at the natural number of groups.',
        'Where k-means fails: interlocking moons, unequal cluster sizes and data with no real groups.',
      ],
    },
    {
      note: {
        title: 'Conclusion.',
        text: 'K-means is a fast, simple way to find compact groups in unlabelled data. Good results need scaled features, careful initialisation with several starts, and a k supported by the elbow method, silhouette analysis and domain knowledge.',
      },
    },
  ],

  pretest,
  posttest,

  simulation: KMeansSim,

  python: {
    title: 'Distances, centroids and assignments',
    intro: 'Predict an outcome. Repair a mistake. Build a working function.',
    predict: {
      question: 'What will Python print?',
      task: 'K-means measures Euclidean distance. How far is the point (1, 2) from the centroid (4, 6)?',
      fileName: 'distance.py',
      code: 'import math\n\nprint(math.dist((1, 2), (4, 6)))\n',
      options: ['5.0', '25', '7'],
      answer: 0,
    },
    repair: {
      question: 'Repair the centroid update',
      task: 'The centroid of (1, 1), (3, 5) and (5, 3) should be (3.0, 3.0). Fix the bug in the update step.',
      fileName: 'update.py',
      code: 'points = [(1, 1), (3, 5), (5, 3)]\ncx = sum(p[0] for p in points) / len(points[0])\ncy = sum(p[1] for p in points) / len(points[0])\nprint((cx, cy))\n',
      expected: '(3.0, 3.0)',
      hint: 'Divide by the number of points, not by the number of coordinates in one point.',
    },
    build: {
      question: 'Build the k-means helpers',
      task: 'Complete assign(points, centroids), returning the index of the nearest centroid for each point, and inertia(points, centroids, labels), returning the sum of squared distances from each point to its assigned centroid.',
      fileName: 'kmeans_helpers.py',
      code: 'import math\n\n\ndef assign(points, centroids):\n    # list with the index of the nearest centroid for every point\n    return []\n\n\ndef inertia(points, centroids, labels):\n    # sum of squared distances to the assigned centroids\n    return 0.0\n',
      tests: `points = [(0, 0), (1, 0), (9, 9), (10, 10)]
centroids = [(0.5, 0), (9.5, 9.5)]
assert assign(points, centroids) == [0, 0, 1, 1], "assign should return [0, 0, 1, 1]"
assert assign([(4, 4)], [(0, 0), (5, 5)]) == [1], "(4, 4) is nearer to (5, 5)"
assert abs(inertia(points, centroids, [0, 0, 1, 1]) - 1.5) < 1e-9, "inertia should be 0.25 + 0.25 + 0.5 + 0.5 = 1.5"
assert abs(inertia([(3, 4)], [(0, 0)], [0]) - 25) < 1e-9, "inertia uses squared distance, so (3, 4) to (0, 0) gives 25"
print("ALL TESTS PASSED")`,
      hint: 'For assign, use min(range(len(centroids)), key=lambda i: math.dist(p, centroids[i])).',
    },
    explore: {
      question: 'Explore freely',
      task: 'Use "Use this data in Python" in the visual activity to run the same k-means start in Python, or change the starting centroids below and compare the final inertia.',
      fileName: 'explore.py',
      code: 'import math\n\npoints = [(1, 1), (1.5, 2), (3, 4), (5, 7), (3.5, 5), (4.5, 5), (3.5, 4.5)]\ncentroids = [(1, 1), (5, 7)]\n\nfor iteration in range(1, 11):\n    labels = [min(range(len(centroids)), key=lambda i: math.dist(p, centroids[i])) for p in points]\n    new = []\n    for i in range(len(centroids)):\n        members = [p for p, l in zip(points, labels) if l == i]\n        new.append((sum(m[0] for m in members) / len(members), sum(m[1] for m in members) / len(members)))\n    inertia = sum(math.dist(p, new[l]) ** 2 for p, l in zip(points, labels))\n    print(f"iteration {iteration}: labels = {labels}, inertia = {inertia:.3f}")\n    if new == centroids:\n        break\n    centroids = new\n',
    },
    reference: [
      {
        title: 'Elbow and silhouette with scikit-learn',
        code: `from sklearn.cluster import KMeans
from sklearn.datasets import make_blobs
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler

X, _ = make_blobs(n_samples=400, centers=4, cluster_std=0.8, random_state=42)
X = StandardScaler().fit_transform(X)

for k in range(2, 9):
    model = KMeans(n_clusters=k, init="k-means++", n_init=10, random_state=42).fit(X)
    print(f"k={k}  inertia={model.inertia_:.1f}  silhouette={silhouette_score(X, model.labels_):.3f}")

final = KMeans(n_clusters=4, n_init=10, random_state=42).fit(X)
print("Cluster sizes:", [int((final.labels_ == c).sum()) for c in range(4)])
print("Centroids:", final.cluster_centers_.round(2))`,
      },
    ],
  },

  references: [
    { text: 'Lloyd, S. (1982). Least squares quantization in PCM. IEEE Transactions on Information Theory, 28(2), 129–137.', url: 'https://doi.org/10.1109/TIT.1982.1056489' },
    { text: 'Arthur, D. & Vassilvitskii, S. (2007). k-means++: The Advantages of Careful Seeding. Proceedings of the 18th ACM-SIAM Symposium on Discrete Algorithms, 1027–1035.' },
    { text: 'Rousseeuw, P. J. (1987). Silhouettes: a graphical aid to the interpretation and validation of cluster analysis. Journal of Computational and Applied Mathematics, 20, 53–65.', url: 'https://doi.org/10.1016/0377-0427(87)90125-7' },
    { text: 'James, G., Witten, D., Hastie, T. & Tibshirani, R. (2021). An Introduction to Statistical Learning (2nd ed.), Chapter 12: Unsupervised Learning. Springer.', url: 'https://www.statlearning.com/' },
    { text: 'scikit-learn User Guide — Clustering: K-means', url: 'https://scikit-learn.org/stable/modules/clustering.html#k-means' },
  ],

  contributors: [{ name: 'PAC-LAB Virtual ML Lab team', role: 'Content, simulation and review' }],
}
