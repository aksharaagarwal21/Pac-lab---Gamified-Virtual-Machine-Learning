import { useId, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { CHART_THEME, ChartFrame, Legend, LineChart } from '../../components/lab/charts.jsx'
import { ExplainBox, MetricGrid, PinnedComparison, Select, SimFooter, SimPanel, Slider, Toggle, percent, pyList } from '../../components/lab/simKit.jsx'
import { buildForest, buildTree, countLeaves, predictTree, seeded } from '../../lib/ml.js'

const DATASETS = [
  { value: 'noisy', label: 'Rectangles with 12% label noise' },
  { value: 'circle', label: 'Noisy circle' },
  { value: 'diagonal', label: 'Diagonal boundary' },
  { value: 'xor', label: 'Checkerboard (XOR)' },
]

const FEATURE_MODES = [
  { value: '1', label: '1 random feature per split (random forest)' },
  { value: '2', label: 'Both features per split (bagging)' },
]

const MAX_TREES = 100
const GRID = 40
const r1 = (v) => Math.round(v * 10) / 10

// Points on 0–10 × 0–10. Seed 91 gives 120 training points; seed 92 gives 400 test points.
export function makeForestData(kind, seed, n = 120) {
  const random = seeded(seed)
  return Array.from({ length: n }, () => {
    const x = r1(random() * 10)
    const y = r1(random() * 10)
    let label
    if (kind === 'diagonal') label = y > x ? 1 : 0
    else if (kind === 'xor') label = (x > 5) !== (y > 5) ? 1 : 0
    else if (kind === 'circle') label = (x - 5) ** 2 + (y - 5) ** 2 < 9 ? 1 : 0
    else label = (x > 6 && y > 3) || (x <= 6 && y > 7) ? 1 : 0
    if (random() < (kind === 'noisy' || kind === 'circle' ? 0.12 : 0.03)) label = 1 - label
    return { x, y, label }
  })
}

export const voteLabel = (votes, trees) => (votes * 2 >= trees ? 1 : 0)

// Test accuracy (and out-of-bag accuracy) after each tree is added, computed incrementally.
export function forestCurves(forest, train, test) {
  const testVotes = new Array(test.length).fill(0)
  const oob = train.map(() => ({ votes: 0, voters: 0 }))
  const testCurve = []
  const oobCurve = []
  forest.forEach((tree, t) => {
    test.forEach((p, i) => {
      testVotes[i] += predictTree(tree, p)
    })
    train.forEach((p, i) => {
      if (!tree.inBag.has(i)) {
        oob[i].votes += predictTree(tree, p)
        oob[i].voters++
      }
    })
    const n = t + 1
    testCurve.push({ x: n, y: (100 * test.filter((p, i) => voteLabel(testVotes[i], n) === p.label).length) / test.length })
    let counted = 0
    let correct = 0
    train.forEach((p, i) => {
      if (oob[i].voters) {
        counted++
        if (voteLabel(oob[i].votes, oob[i].voters) === p.label) correct++
      }
    })
    oobCurve.push({ x: n, y: counted ? (100 * correct) / counted : 0 })
  })
  return { testCurve, oobCurve }
}

function leafRegions(node, bounds = { x0: 0, x1: 10, y0: 0, y1: 10 }) {
  if (node.leaf) return [{ ...bounds, prediction: node.prediction }]
  const low = node.feature === 'x' ? { ...bounds, x1: node.threshold } : { ...bounds, y1: node.threshold }
  const high = node.feature === 'x' ? { ...bounds, x0: node.threshold } : { ...bounds, y0: node.threshold }
  return [...leafRegions(node.left, low), ...leafRegions(node.right, high)]
}

function MiniTree({ tree, index, test }) {
  const size = 120
  const s = (v) => (v / 10) * size
  const accuracy = test.filter((p) => predictTree(tree, p) === p.label).length / test.length
  return (
    <figure className="lab-forest-tree">
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Tree ${index + 1} decision regions`}>
        {leafRegions(tree).map((r, i) => (
          <rect
            key={i}
            x={s(r.x0)}
            y={size - s(r.y1)}
            width={s(r.x1 - r.x0)}
            height={s(r.y1 - r.y0)}
            fill={r.prediction ? CHART_THEME.accent : CHART_THEME.danger}
            opacity="0.55"
            stroke="#030712"
            strokeWidth="0.8"
          />
        ))}
      </svg>
      <figcaption>
        Tree {index + 1} · {countLeaves(tree)} leaves · {percent(accuracy)}
      </figcaption>
    </figure>
  )
}

function pythonCode(train, test, trees, maxDepth, featuresPerSplit) {
  return `# Random forest from scratch (standard library only).
# Python's random numbers differ from the simulation's, so the numbers will be close but not identical.
import random

random.seed(42)
train_x1 = ${pyList(train.map((p) => p.x), 1)}
train_x2 = ${pyList(train.map((p) => p.y), 1)}
train_label = ${pyList(train.map((p) => p.label))}
test_x1 = ${pyList(test.map((p) => p.x), 1)}
test_x2 = ${pyList(test.map((p) => p.y), 1)}
test_label = ${pyList(test.map((p) => p.label))}
N_TREES = ${trees}
MAX_DEPTH = ${maxDepth}
FEATURES_PER_SPLIT = ${featuresPerSplit}

def gini(n, ones):
    if n == 0:
        return 0.0
    p = ones / n
    return 1 - p * p - (1 - p) * (1 - p)

def build(rows, features_per_split, depth=0):
    n = len(rows)
    ones = sum(r[2] for r in rows)
    node = {"prediction": 1 if ones * 2 >= n else 0}
    if depth >= MAX_DEPTH or n < 2 or ones in (0, n):
        return node
    features = [0, 1] if features_per_split == 2 else [random.randrange(2)]
    best = None
    for f in features:
        ordered = sorted(rows, key=lambda r: r[f])
        left_n = left_ones = 0
        for i in range(n - 1):
            left_n += 1
            left_ones += ordered[i][2]
            if ordered[i][f] == ordered[i + 1][f]:
                continue
            w = (left_n * gini(left_n, left_ones) + (n - left_n) * gini(n - left_n, ones - left_ones)) / n
            if best is None or w < best[0] - 1e-12:
                best = (w, f, (ordered[i][f] + ordered[i + 1][f]) / 2)
    if best is None or best[0] > gini(n, ones) + 1e-12:
        return node
    _, f, t = best
    node["feature"], node["threshold"] = f, t
    node["left"] = build([r for r in rows if r[f] <= t], features_per_split, depth + 1)
    node["right"] = build([r for r in rows if r[f] > t], features_per_split, depth + 1)
    return node

def predict(node, row):
    while "feature" in node:
        node = node["left"] if row[node["feature"]] <= node["threshold"] else node["right"]
    return node["prediction"]

def accuracy(predictions, rows):
    return sum(p == r[2] for p, r in zip(predictions, rows)) / len(rows)

train = list(zip(train_x1, train_x2, train_label))
test = list(zip(test_x1, test_x2, test_label))

single = build(train, features_per_split=2)
print("single tree test accuracy:", round(accuracy([predict(single, r) for r in test], test), 3))

forest, in_bag = [], []
for _ in range(N_TREES):
    indices = [random.randrange(len(train)) for _ in train]  # bootstrap: sample with replacement
    forest.append(build([train[i] for i in indices], FEATURES_PER_SPLIT))
    in_bag.append(set(indices))

votes = [0] * len(test)
for t, tree in enumerate(forest, start=1):
    for i, r in enumerate(test):
        votes[i] += predict(tree, r)
    if t in (1, 5, 10, 25, 50, 100) or t == N_TREES:
        predictions = [1 if v * 2 >= t else 0 for v in votes]
        print(f"forest with {t:3d} trees: test accuracy {accuracy(predictions, test):.3f}")

correct = counted = 0
for i, r in enumerate(train):
    outside = [predict(tree, r) for tree, bag in zip(forest, in_bag) if i not in bag]
    if outside:
        counted += 1
        correct += (1 if sum(outside) * 2 >= len(outside) else 0) == r[2]
print("out-of-bag accuracy:", round(correct / counted, 3))
print("average unique training rows per tree:", round(sum(len(b) for b in in_bag) / N_TREES / len(train), 3))
`
}

export default function RandomForestSim({ onSaveResult, onUsePython }) {
  const clipId = useId().replace(/:/g, '')
  const [dataset, setDataset] = useState('noisy')
  const [trees, setTrees] = useState(25)
  const [maxDepth, setMaxDepth] = useState(10)
  const [features, setFeatures] = useState('1')
  const [seed, setSeed] = useState(7)
  const [showShare, setShowShare] = useState(true)
  const [pinned, setPinned] = useState(null)

  const train = useMemo(() => makeForestData(dataset, 91), [dataset])
  const test = useMemo(() => makeForestData(dataset, 92, 400), [dataset])
  const fullForest = useMemo(
    () => buildForest(train, { trees: MAX_TREES, maxDepth, maxFeatures: Number(features), random: seeded(seed) }),
    [train, maxDepth, features, seed],
  )
  const forest = fullForest.slice(0, trees)
  const single = useMemo(() => buildTree(train, { maxDepth }), [train, maxDepth])
  const curves = useMemo(() => forestCurves(fullForest, train, test), [fullForest, train, test])

  const forestTest = curves.testCurve[trees - 1].y / 100
  const oob = curves.oobCurve[trees - 1].y / 100
  const singleTest = test.filter((p) => predictTree(single, p) === p.label).length / test.length
  const avgLeaves = forest.reduce((sum, tree) => sum + countLeaves(tree), 0) / forest.length

  const grid = useMemo(() => {
    const cell = 10 / GRID
    const cells = []
    for (let i = 0; i < GRID; i++) {
      for (let j = 0; j < GRID; j++) {
        const p = { x: (i + 0.5) * cell, y: (j + 0.5) * cell }
        let votes = 0
        for (let t = 0; t < trees; t++) votes += predictTree(fullForest[t], p)
        cells.push({ i, j, share: votes / trees })
      }
    }
    return cells
  }, [fullForest, trees])

  const current = {
    label: `${trees} tree${trees === 1 ? '' : 's'} · depth ≤ ${maxDepth} · ${features === '1' ? 'random feature' : 'bagging'} · ${DATASETS.find((d) => d.value === dataset).label}`,
    metrics: [
      { label: 'Forest test accuracy', value: percent(forestTest) },
      { label: 'Single tree test accuracy', value: percent(singleTest) },
      { label: 'Out-of-bag accuracy', value: percent(oob) },
      { label: 'Trees', value: String(trees) },
      { label: 'Avg. leaves per tree', value: avgLeaves.toFixed(1) },
    ],
  }

  const save = () => {
    const gain = forestTest - singleTest
    onSaveResult({
      title: current.label,
      metrics: current.metrics,
      explanation: `The forest scores ${percent(forestTest)} on 400 unseen points, ${gain >= 0 ? `${(100 * gain).toFixed(1)} points above` : `${(100 * -gain).toFixed(1)} points below`} a single tree of the same depth (${percent(singleTest)}). Its out-of-bag estimate, computed without any test data, is ${percent(oob)}. ${
        trees < 10
          ? 'With so few trees the vote is still unstable; adding trees usually raises accuracy until it levels off.'
          : 'Each tree overfits its own bootstrap sample in a different way, and majority voting cancels much of that noise.'
      }${features === '2' ? ' With both features available at every split the trees are more alike (plain bagging), so there is less diversity to average out.' : ''}`,
    })
  }

  const cellSize = 10 / GRID

  return (
    <>
      <SimPanel
        kicker="MANY TREES · ONE VOTE"
        title="Random forest workbench"
        intro="Every tree is grown on its own bootstrap sample of the training data and may only look at a random feature at each split. Individually the trees are noisy; together their majority vote is steadier and more accurate."
      >
        <div className="lab-sim-controls">
          <Select label="Dataset" value={dataset} onChange={setDataset} options={DATASETS} />
          <Slider label="Number of trees" min={1} max={MAX_TREES} step={1} value={trees} onChange={setTrees} />
          <Slider label="Max depth per tree" min={1} max={10} step={1} value={maxDepth} onChange={setMaxDepth} />
          <Select label="Features considered per split" value={features} onChange={setFeatures} options={FEATURE_MODES} />
          <Toggle label="Shade by vote share" checked={showShare} onChange={setShowShare} />
        </div>
        <div className="lab-actions lab-actions-start">
          <button type="button" className="lab-btn" onClick={() => setSeed(seed + 1)}>
            <RefreshCw aria-hidden="true" />
            Grow a new forest
          </button>
        </div>
        <MetricGrid metrics={current.metrics} />
      </SimPanel>

      <div className="lab-sim-columns">
        <SimPanel title="The forest’s decision map" dark>
          <Legend
            items={[
              { label: 'Class 1', color: CHART_THEME.accent },
              { label: 'Class 0', color: CHART_THEME.danger },
            ]}
          />
          <div className="lab-chart-box">
            <ChartFrame width={440} height={440} xDomain={[0, 10]} yDomain={[0, 10]} xLabel="Feature x₁" yLabel="Feature x₂" label="Training points over the forest's majority-vote regions">
              {({ sx, sy, width, height, pad }) => (
                <>
                  <defs>
                    <clipPath id={clipId}>
                      <rect x={pad.left} y={pad.top} width={width - pad.left - pad.right} height={height - pad.top - pad.bottom} />
                    </clipPath>
                  </defs>
                  <g clipPath={`url(#${clipId})`}>
                    {grid.map((c) => {
                      const label = c.share >= 0.5 ? 1 : 0
                      const strength = showShare ? Math.abs(c.share - 0.5) * 2 : 1
                      return (
                        <rect
                          key={`${c.i}-${c.j}`}
                          x={sx(c.i * cellSize)}
                          y={sy((c.j + 1) * cellSize)}
                          width={sx(cellSize) - sx(0) + 0.5}
                          height={sy(0) - sy(cellSize) + 0.5}
                          fill={label ? CHART_THEME.accent : CHART_THEME.danger}
                          opacity={0.05 + 0.3 * strength}
                        />
                      )
                    })}
                    {train.map((p, i) => {
                      let votes = 0
                      for (const tree of forest) votes += predictTree(tree, p)
                      const wrong = voteLabel(votes, forest.length) !== p.label
                      return (
                        <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="4.5" fill={p.label ? CHART_THEME.accent : CHART_THEME.danger} stroke={wrong ? '#ffffff' : '#030712'} strokeWidth={wrong ? 2.2 : 1}>
                          <title>{`(${p.x}, ${p.y}) class ${p.label}: ${votes} of ${forest.length} trees vote class 1`}</title>
                        </circle>
                      )
                    })}
                  </g>
                </>
              )}
            </ChartFrame>
          </div>
          <p className="lab-muted">
            {showShare ? 'Faint areas are close votes; strong colour means the trees agree.' : 'Colour shows the majority vote only.'} White rings mark training points the forest gets wrong.
          </p>
        </SimPanel>

        <SimPanel title="Accuracy as trees are added" dark>
          <div className="lab-chart-box">
            <LineChart
              series={[
                { label: 'Forest test accuracy', points: curves.testCurve, color: CHART_THEME.accent },
                { label: 'Out-of-bag accuracy', points: curves.oobCurve, color: CHART_THEME.violet, dashed: true },
                { label: 'Single tree', points: [{ x: 1, y: 100 * singleTest }, { x: MAX_TREES, y: 100 * singleTest }], color: CHART_THEME.danger, dashed: true },
              ]}
              marker={{ x: trees, y: 100 * forestTest }}
              xLabel="Number of trees"
              yLabel="Accuracy (%)"
              yMin={50}
              label="Forest test accuracy and out-of-bag accuracy for 1 to 100 trees, with a single tree for comparison"
            />
          </div>
          <Legend
            items={[
              { label: 'Forest (test set)', color: CHART_THEME.accent },
              { label: 'Out-of-bag (dashed)', color: CHART_THEME.violet },
              { label: 'Single tree (dashed)', color: CHART_THEME.danger },
            ]}
          />
          <p className="lab-muted">
            Accuracy climbs quickly over the first trees and then levels off: more trees do not cause overfitting, they just stop helping. The out-of-bag curve estimates the same thing using only training data.
          </p>
        </SimPanel>
      </div>

      <SimPanel title="Six members of the forest" dark>
        <p className="lab-muted">Each tree saw a different bootstrap sample and different features, so each carves the plane differently. Captions show each tree’s own test accuracy.</p>
        <div className="lab-forest-grid">
          {fullForest.slice(0, 6).map((tree, i) => (
            <MiniTree key={`${seed}-${i}`} tree={tree} index={i} test={test} />
          ))}
        </div>
      </SimPanel>

      <PinnedComparison pinned={pinned} current={current} />

      <ExplainBox>
        A single deep tree has low bias but high variance: a slightly different training set gives a very different tree. A random forest grows many such
        trees on bootstrap samples and restricts each split to a random subset of features, which makes the trees disagree in different places. Their
        errors partly cancel in the majority vote, so the forest keeps the flexibility of deep trees with much less variance. The roughly one third of rows
        each tree never sees provide a free out-of-bag estimate of accuracy.
      </ExplainBox>

      <SimFooter onPin={() => setPinned(current)} onSave={save} onPython={() => onUsePython(pythonCode(train, test, trees, maxDepth, Number(features)))} />
    </>
  )
}
