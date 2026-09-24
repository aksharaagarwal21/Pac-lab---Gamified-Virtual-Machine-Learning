import { useId, useMemo, useState } from 'react'
import { CHART_THEME, ChartFrame, Legend, LineChart } from '../../components/lab/charts.jsx'
import { ExplainBox, MetricGrid, PinnedComparison, Select, SimFooter, SimPanel, Slider, Toggle, percent, pyList } from '../../components/lab/simKit.jsx'
import { buildTree, countLeaves, predictTree, seeded, treeDepth } from '../../lib/ml.js'

const DATASETS = [
  { value: 'axis', label: 'Rectangular regions' },
  { value: 'diagonal', label: 'Diagonal boundary' },
  { value: 'xor', label: 'Checkerboard (XOR)' },
  { value: 'noisy', label: 'Rectangles with 15% label noise' },
]

const CRITERIA = [
  { value: 'gini', label: 'Gini impurity' },
  { value: 'entropy', label: 'Entropy (information gain)' },
]

const FEATURE_NAMES = { x: 'x₁', y: 'x₂' }
const r1 = (v) => Math.round(v * 10) / 10

// 120 points on 0–10 × 0–10 with labels 0/1. Seed 81 is the training set, 82 the test set.
export function makeTreeData(kind, seed) {
  const random = seeded(seed)
  return Array.from({ length: 120 }, () => {
    const x = r1(random() * 10)
    const y = r1(random() * 10)
    let label
    if (kind === 'diagonal') label = y > x ? 1 : 0
    else if (kind === 'xor') label = (x > 5) !== (y > 5) ? 1 : 0
    else label = (x > 6 && y > 3) || (x <= 6 && y > 7) ? 1 : 0
    if (random() < (kind === 'noisy' ? 0.15 : 0.03)) label = 1 - label
    return { x, y, label }
  })
}

export const treeAccuracy = (tree, points) => points.filter((p) => predictTree(tree, p) === p.label).length / points.length

// Leaf rectangles of the tree over the 0–10 square.
function leafRegions(node, bounds = { x0: 0, x1: 10, y0: 0, y1: 10 }, path = '') {
  if (node.leaf) return [{ ...bounds, node, path }]
  const low = node.feature === 'x' ? { ...bounds, x1: node.threshold } : { ...bounds, y1: node.threshold }
  const high = node.feature === 'x' ? { ...bounds, x0: node.threshold } : { ...bounds, y0: node.threshold }
  return [...leafRegions(node.left, low, `${path}L`), ...leafRegions(node.right, high, `${path}R`)]
}

// Bounds of the region a node covers, or null if the path no longer exists.
function regionForPath(root, path) {
  let node = root
  const bounds = { x0: 0, x1: 10, y0: 0, y1: 10 }
  for (const turn of path) {
    if (node.leaf) return null
    if (turn === 'L') node.feature === 'x' ? (bounds.x1 = node.threshold) : (bounds.y1 = node.threshold)
    else node.feature === 'x' ? (bounds.x0 = node.threshold) : (bounds.y0 = node.threshold)
    node = turn === 'L' ? node.left : node.right
  }
  return { ...bounds, node }
}

const NODE_W = 104
const NODE_H = 54
const LEVEL_H = 84

function layoutTree(root) {
  const nodes = []
  let leafIndex = 0
  const walk = (node, depth, path) => {
    if (node.leaf) {
      const x = leafIndex++
      nodes.push({ node, depth, x, path })
      return x
    }
    const lx = walk(node.left, depth + 1, `${path}L`)
    const rx = walk(node.right, depth + 1, `${path}R`)
    const x = (lx + rx) / 2
    nodes.push({ node, depth, x, path, lx, rx })
    return x
  }
  walk(root, 0, '')
  return { nodes, leaves: leafIndex, depth: Math.max(...nodes.map((n) => n.depth)) }
}

function TreeDiagram({ tree, criterion, selected, onSelect }) {
  const layout = useMemo(() => layoutTree(tree), [tree])
  const gap = NODE_W + 12
  const width = Math.max(layout.leaves * gap + 16, 360)
  const offset = (width - layout.leaves * gap) / 2
  const height = (layout.depth + 1) * LEVEL_H + 8
  const cx = (x) => offset + x * gap + gap / 2
  const cy = (depth) => 6 + depth * LEVEL_H

  return (
    <div className="lab-table-wrap">
      <svg className="lab-tree" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="group" aria-label="Decision tree diagram. Select a node to highlight its region.">
        {layout.nodes
          .filter((n) => !n.node.leaf)
          .map((n) => (
            <g key={`e${n.path}`} stroke="#2a3d66" strokeWidth="2" fill="none">
              <path d={`M${cx(n.x)} ${cy(n.depth) + NODE_H}C${cx(n.x)} ${cy(n.depth) + NODE_H + 18} ${cx(n.lx)} ${cy(n.depth + 1) - 18} ${cx(n.lx)} ${cy(n.depth + 1)}`} />
              <path d={`M${cx(n.x)} ${cy(n.depth) + NODE_H}C${cx(n.x)} ${cy(n.depth) + NODE_H + 18} ${cx(n.rx)} ${cy(n.depth + 1) - 18} ${cx(n.rx)} ${cy(n.depth + 1)}`} />
              <text x={(cx(n.x) + cx(n.lx)) / 2 - 6} y={cy(n.depth) + NODE_H + 22} className="lab-tree-edge" textAnchor="end">
                yes
              </text>
              <text x={(cx(n.x) + cx(n.rx)) / 2 + 6} y={cy(n.depth) + NODE_H + 22} className="lab-tree-edge">
                no
              </text>
            </g>
          ))}
        {layout.nodes.map((n) => {
          const { node } = n
          const isSelected = selected === n.path
          const color = node.leaf ? (node.prediction ? CHART_THEME.accent : CHART_THEME.danger) : CHART_THEME.primary
          return (
            <g
              key={`n${n.path}`}
              className="lab-tree-node"
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              aria-label={`${node.leaf ? `Leaf predicting class ${node.prediction}` : `Split ${FEATURE_NAMES[node.feature]} ≤ ${node.threshold.toFixed(2)}`}, ${node.counts[0] + node.counts[1]} samples`}
              onClick={() => onSelect(isSelected ? null : n.path)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelect(isSelected ? null : n.path)
                }
              }}
            >
              <rect
                x={cx(n.x) - NODE_W / 2}
                y={cy(n.depth)}
                width={NODE_W}
                height={NODE_H}
                rx="8"
                fill="#0b1630"
                stroke={isSelected ? '#ffffff' : color}
                strokeWidth={isSelected ? 3 : 1.6}
              />
              <text x={cx(n.x)} y={cy(n.depth) + 17} textAnchor="middle" className="lab-tree-title" fill={color}>
                {node.leaf ? `Class ${node.prediction}` : `${FEATURE_NAMES[node.feature]} ≤ ${node.threshold.toFixed(2)}`}
              </text>
              <text x={cx(n.x)} y={cy(n.depth) + 32} textAnchor="middle" className="lab-tree-text">
                {criterion} {node.impurity.toFixed(3)}
              </text>
              <text x={cx(n.x)} y={cy(n.depth) + 46} textAnchor="middle" className="lab-tree-text">
                n {node.counts[0] + node.counts[1]} · [{node.counts[0]}, {node.counts[1]}]
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function pythonCode(train, test, maxDepth, minLeaf, criterion) {
  return `# CART decision tree from scratch (standard library only)
import math

train_x1 = ${pyList(train.map((p) => p.x), 1)}
train_x2 = ${pyList(train.map((p) => p.y), 1)}
train_label = ${pyList(train.map((p) => p.label))}
test_x1 = ${pyList(test.map((p) => p.x), 1)}
test_x2 = ${pyList(test.map((p) => p.y), 1)}
test_label = ${pyList(test.map((p) => p.label))}
MAX_DEPTH = ${maxDepth}
MIN_SAMPLES_LEAF = ${minLeaf}
CRITERION = "${criterion}"
FEATURES = ["x1", "x2"]

def impurity(labels):
    if not labels:
        return 0.0
    p = sum(labels) / len(labels)
    if CRITERION == "entropy":
        return -sum(q * math.log2(q) for q in (p, 1 - p) if q > 0)
    return 1 - p * p - (1 - p) * (1 - p)

def build(rows, depth=0):
    labels = [r[2] for r in rows]
    ones = sum(labels)
    node = {"prediction": 1 if ones * 2 >= len(labels) else 0, "counts": (len(labels) - ones, ones)}
    current = impurity(labels)
    if depth >= MAX_DEPTH or len(rows) < 2 or ones == 0 or ones == len(labels):
        return node
    best = None
    for f in (0, 1):
        values = sorted(set(r[f] for r in rows))
        for a, b in zip(values, values[1:]):
            t = (a + b) / 2
            left = [r for r in rows if r[f] <= t]
            right = [r for r in rows if r[f] > t]
            if len(left) < MIN_SAMPLES_LEAF or len(right) < MIN_SAMPLES_LEAF:
                continue
            w = (len(left) * impurity([r[2] for r in left]) + len(right) * impurity([r[2] for r in right])) / len(rows)
            if best is None or w < best[0] - 1e-12:
                best = (w, f, t, left, right)
    if best is None or best[0] > current + 1e-12:
        return node
    node.update(feature=best[1], threshold=best[2], left=build(best[3], depth + 1), right=build(best[4], depth + 1))
    return node

def predict(node, row):
    while "feature" in node:
        node = node["left"] if row[node["feature"]] <= node["threshold"] else node["right"]
    return node["prediction"]

def show(node, indent=""):
    if "feature" not in node:
        print(f"{indent}predict class {node['prediction']}  (samples: {node['counts'][0]} class 0, {node['counts'][1]} class 1)")
        return
    name, t = FEATURES[node["feature"]], node["threshold"]
    print(f"{indent}if {name} <= {t:.2f}:")
    show(node["left"], indent + "    ")
    print(f"{indent}else:  # {name} > {t:.2f}")
    show(node["right"], indent + "    ")

def count_leaves(node):
    return 1 if "feature" not in node else count_leaves(node["left"]) + count_leaves(node["right"])

train = list(zip(train_x1, train_x2, train_label))
test = list(zip(test_x1, test_x2, test_label))
tree = build(train)
show(tree)
print("leaves:", count_leaves(tree))
print("training accuracy:", round(sum(predict(tree, r) == r[2] for r in train) / len(train), 3))
print("test accuracy:", round(sum(predict(tree, r) == r[2] for r in test) / len(test), 3))
`
}

export default function DecisionTreeSim({ onSaveResult, onUsePython }) {
  const clipId = useId().replace(/:/g, '')
  const [dataset, setDataset] = useState('axis')
  const [maxDepth, setMaxDepth] = useState(2)
  const [minLeaf, setMinLeaf] = useState(1)
  const [criterion, setCriterion] = useState('gini')
  const [showTest, setShowTest] = useState(false)
  const [selected, setSelected] = useState(null)
  const [pinned, setPinned] = useState(null)

  const train = useMemo(() => makeTreeData(dataset, 81), [dataset])
  const test = useMemo(() => makeTreeData(dataset, 82), [dataset])
  const tree = useMemo(() => buildTree(train, { maxDepth, minLeaf, criterion }), [train, maxDepth, minLeaf, criterion])
  const regions = useMemo(() => leafRegions(tree), [tree])
  const highlight = selected === null ? null : regionForPath(tree, selected)

  const trainAccuracy = treeAccuracy(tree, train)
  const testAccuracy = treeAccuracy(tree, test)
  const leaves = countLeaves(tree)
  const depthUsed = treeDepth(tree)

  const sweep = useMemo(() => {
    const trainCurve = []
    const testCurve = []
    for (let depth = 1; depth <= 10; depth++) {
      const model = buildTree(train, { maxDepth: depth, minLeaf, criterion })
      trainCurve.push({ x: depth, y: 100 * treeAccuracy(model, train) })
      testCurve.push({ x: depth, y: 100 * treeAccuracy(model, test) })
    }
    return { trainCurve, testCurve }
  }, [train, test, minLeaf, criterion])

  const current = {
    label: `depth ≤ ${maxDepth} · leaf ≥ ${minLeaf} · ${criterion} · ${DATASETS.find((d) => d.value === dataset).label}`,
    metrics: [
      { label: 'Training accuracy', value: percent(trainAccuracy) },
      { label: 'Test accuracy', value: percent(testAccuracy) },
      { label: 'Leaves', value: String(leaves) },
      { label: 'Depth used', value: String(depthUsed) },
      { label: 'Root split', value: tree.leaf ? 'none' : `${FEATURE_NAMES[tree.feature]} ≤ ${tree.threshold.toFixed(2)}` },
    ],
  }

  const change = (setter) => (value) => {
    setter(value)
    setSelected(null)
  }

  const save = () =>
    onSaveResult({
      title: current.label,
      metrics: current.metrics,
      explanation: `The tree uses ${leaves} leaves and a depth of ${depthUsed}; its first question is ${current.metrics[4].value}. ${
        trainAccuracy - testAccuracy > 0.1
          ? `Training accuracy (${percent(trainAccuracy)}) is well above test accuracy (${percent(testAccuracy)}): the deeper branches are memorising noise, so a smaller max depth or a larger minimum leaf size should generalise better.`
          : dataset === 'xor' && testAccuracy < 0.75
            ? 'On the checkerboard, any single split leaves both sides half and half, so the greedy search finds almost no gain until the tree is deep enough to isolate the squares.'
            : dataset === 'diagonal'
              ? `A tree can only draw axis-aligned boxes, so a diagonal boundary becomes a staircase that needs many leaves. Test accuracy is ${percent(testAccuracy)}.`
              : `Training and test accuracy are close (${percent(trainAccuracy)} vs ${percent(testAccuracy)}), so this tree generalises well.`
      }`,
    })

  return (
    <>
      <SimPanel
        kicker="ASK THE BEST QUESTION FIRST"
        title="Decision tree workbench"
        intro="Each split asks a yes/no question about one feature and picks the threshold that makes the two groups purest. Grow the tree deeper, require bigger leaves, and compare the regions it carves with the accuracy on unseen test points."
      >
        <div className="lab-sim-controls">
          <Select label="Dataset" value={dataset} onChange={change(setDataset)} options={DATASETS} />
          <Slider label="Max depth" min={1} max={10} step={1} value={maxDepth} onChange={change(setMaxDepth)} />
          <Slider label="Min samples per leaf" min={1} max={30} step={1} value={minLeaf} onChange={change(setMinLeaf)} />
          <Select label="Split criterion" value={criterion} onChange={change(setCriterion)} options={CRITERIA} />
          <Toggle label="Show test points" checked={showTest} onChange={setShowTest} />
        </div>
        <MetricGrid metrics={current.metrics} />
      </SimPanel>

      <div className="lab-sim-columns">
        <SimPanel title="Regions carved by the tree" dark>
          <Legend
            items={[
              { label: 'Class 1', color: CHART_THEME.accent },
              { label: 'Class 0', color: CHART_THEME.danger },
              { label: 'Selected node region', color: '#ffffff' },
            ]}
          />
          <div className="lab-chart-box">
            <ChartFrame width={440} height={440} xDomain={[0, 10]} yDomain={[0, 10]} xLabel="Feature x₁" yLabel="Feature x₂" label="Training points with the rectangular regions of each leaf">
              {({ sx, sy, width, height, pad }) => (
                <>
                  <defs>
                    <clipPath id={clipId}>
                      <rect x={pad.left} y={pad.top} width={width - pad.left - pad.right} height={height - pad.top - pad.bottom} />
                    </clipPath>
                  </defs>
                  <g clipPath={`url(#${clipId})`}>
                    {regions.map((region) => {
                      const total = region.node.counts[0] + region.node.counts[1]
                      const purity = total ? Math.max(...region.node.counts) / total : 1
                      return (
                        <rect
                          key={region.path || 'root'}
                          x={sx(region.x0)}
                          y={sy(region.y1)}
                          width={sx(region.x1) - sx(region.x0)}
                          height={sy(region.y0) - sy(region.y1)}
                          fill={region.node.prediction ? CHART_THEME.accent : CHART_THEME.danger}
                          opacity={0.06 + 0.2 * purity}
                          stroke="#030712"
                          strokeWidth="1.5"
                        />
                      )
                    })}
                    {(showTest ? test : train).map((p, i) => {
                      const wrong = predictTree(tree, p) !== p.label
                      return showTest ? (
                        <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="4.5" fill="none" stroke={p.label ? CHART_THEME.accent : CHART_THEME.danger} strokeWidth={wrong ? 2.8 : 1.6} />
                      ) : (
                        <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="4.5" fill={p.label ? CHART_THEME.accent : CHART_THEME.danger} stroke={wrong ? '#ffffff' : '#030712'} strokeWidth={wrong ? 2.2 : 1} />
                      )
                    })}
                    {highlight && (
                      <rect
                        className="lab-tree-highlight"
                        x={sx(highlight.x0)}
                        y={sy(highlight.y1)}
                        width={sx(highlight.x1) - sx(highlight.x0)}
                        height={sy(highlight.y0) - sy(highlight.y1)}
                        fill="rgba(255, 255, 255, 0.08)"
                        stroke="#ffffff"
                        strokeWidth="3"
                        strokeDasharray="8 5"
                      />
                    )}
                  </g>
                </>
              )}
            </ChartFrame>
          </div>
          <p className="lab-muted">
            {showTest ? 'Hollow circles are unseen test points; thick rings are misclassified.' : 'White outlines mark misclassified training points.'} Darker regions are purer leaves. Every boundary is parallel to an axis.
          </p>
        </SimPanel>

        <SimPanel title="Accuracy as the tree grows" dark>
          <div className="lab-chart-box">
            <LineChart
              series={[
                { label: 'Training accuracy', points: sweep.trainCurve, color: CHART_THEME.primary },
                { label: 'Test accuracy', points: sweep.testCurve, color: CHART_THEME.accent, dashed: true },
              ]}
              marker={{ x: maxDepth, y: 100 * testAccuracy }}
              xLabel="Max depth"
              yLabel="Accuracy (%)"
              yMin={40}
              label="Training and test accuracy for each maximum depth"
            />
          </div>
          <Legend
            items={[
              { label: 'Training', color: CHART_THEME.primary },
              { label: 'Test (dashed)', color: CHART_THEME.accent },
            ]}
          />
          <p className="lab-muted">
            A growing gap between the two curves is overfitting. The minimum leaf size and criterion you choose apply to every depth on this chart.
          </p>
        </SimPanel>
      </div>

      <SimPanel title={`The tree · ${leaves} leaves`} dark>
        <p className="lab-muted">Select any node to outline the region of the feature space it covers. Each node shows its question, impurity and samples as [class 0, class 1].</p>
        <TreeDiagram tree={tree} criterion={criterion} selected={selected} onSelect={setSelected} />
      </SimPanel>

      <PinnedComparison pinned={pinned} current={current} />

      <ExplainBox>
        A decision tree repeatedly picks the single feature and threshold that most reduce impurity, then solves each side separately. Deeper trees carve
        smaller boxes and eventually isolate individual noisy points, so training accuracy keeps rising while test accuracy stalls or falls. Limiting the
        depth or requiring larger leaves pre-prunes the tree. Because every split looks one step ahead, patterns like a checkerboard can hide from the
        greedy search.
      </ExplainBox>

      <SimFooter onPin={() => setPinned(current)} onSave={save} onPython={() => onUsePython(pythonCode(train, test, maxDepth, minLeaf, criterion))} />
    </>
  )
}
