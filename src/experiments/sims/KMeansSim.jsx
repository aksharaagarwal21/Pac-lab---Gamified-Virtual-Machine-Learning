import { useId, useMemo, useState } from 'react'
import { FastForward, RefreshCw, StepForward } from 'lucide-react'
import { CHART_THEME, ChartFrame, Legend, LineChart } from '../../components/lab/charts.jsx'
import { ExplainBox, MetricGrid, PinnedComparison, Select, SimFooter, SimPanel, Slider, Toggle, fixed, pyList } from '../../components/lab/simKit.jsx'
import { assignClusters, gaussian, inertia, kMeans, kMeansPlusPlus, seeded, silhouette, updateCentroids } from '../../lib/ml.js'

const DATASETS = [
  { value: 'blobs', label: 'Four compact groups' },
  { value: 'five', label: 'Five compact groups' },
  { value: 'unequal', label: 'Unequal sizes and spreads' },
  { value: 'moons', label: 'Two interlocking moons' },
  { value: 'uniform', label: 'No real groups (uniform)' },
]

const INITS = [
  { value: 'plusplus', label: 'k-means++' },
  { value: 'random', label: 'Random points' },
  { value: 'manual', label: 'Click to place' },
]

export const CLUSTER_COLORS = ['#22d3ee', '#f5c518', '#ff5c8a', '#34d399', '#a78bfa', '#fb923c', '#60a5fa', '#f472b6']
const EXTENT = 4.5
const GRID = 40
const r2 = (v) => Math.round(v * 100) / 100

export function makeKMeansData(kind) {
  const random = seeded({ blobs: 71, five: 72, unequal: 73, moons: 74, uniform: 75 }[kind])
  const g = () => gaussian(random)
  if (kind === 'blobs' || kind === 'five') {
    const centres =
      kind === 'blobs'
        ? [
            [-2.2, 1.8],
            [2.0, 2.1],
            [-1.6, -2.0],
            [2.3, -1.5],
          ]
        : [
            [-2.6, 2.2],
            [0, 2.6],
            [2.6, 2.0],
            [-1.5, -2.2],
            [1.9, -2.0],
          ]
    const spread = kind === 'blobs' ? 0.55 : 0.5
    return Array.from({ length: kind === 'blobs' ? 80 : 90 }, (_, i) => {
      const c = centres[i % centres.length]
      return { x: r2(c[0] + spread * g()), y: r2(c[1] + spread * g()) }
    })
  }
  if (kind === 'unequal') {
    return Array.from({ length: 80 }, (_, i) => {
      if (i < 60) return { x: r2(-1.2 + 1.1 * g()), y: r2(0.2 + 1.1 * g()) }
      if (i < 70) return { x: r2(2.6 + 0.3 * g()), y: r2(2.2 + 0.3 * g()) }
      return { x: r2(2.6 + 0.3 * g()), y: r2(-2.2 + 0.3 * g()) }
    })
  }
  if (kind === 'moons') {
    return Array.from({ length: 80 }, (_, i) => {
      const t = random() * Math.PI
      if (i % 2) return { x: r2(-1.0 + 2 * Math.cos(t) + 0.15 * g()), y: r2(-0.4 + 2 * Math.sin(t) + 0.15 * g()) }
      return { x: r2(1.0 - 2 * Math.cos(t) + 0.15 * g()), y: r2(0.4 - 2 * Math.sin(t) + 0.15 * g()) }
    })
  }
  return Array.from({ length: 80 }, () => ({ x: r2(-3 + 6 * random()), y: r2(-3 + 6 * random()) }))
}

function randomInit(points, k, random) {
  const chosen = new Set()
  while (chosen.size < Math.min(k, points.length)) chosen.add(Math.floor(random() * points.length))
  return [...chosen].map((i) => ({ x: points[i].x, y: points[i].y }))
}

// Best of ten k-means++ runs, like scikit-learn's n_init=10.
export function bestKMeans(points, k) {
  let best = null
  for (let s = 0; s < 10; s++) {
    const model = kMeans(points, k, seeded(100 + s))
    if (!best || model.inertia < best.inertia) best = model
  }
  return best
}

// Lloyd's algorithm from given centroids, recording inertia after every assignment.
export function runLloyd(points, start, maxIterations = 100) {
  let centroids = start
  let assignments = assignClusters(points, centroids)
  const trace = [{ inertia: inertia(points, assignments, centroids), moved: points.length, centroids }]
  for (let i = 0; i < maxIterations; i++) {
    centroids = updateCentroids(points, assignments, centroids)
    const next = assignClusters(points, centroids)
    const moved = next.filter((a, j) => a !== assignments[j]).length
    assignments = next
    trace.push({ inertia: inertia(points, assignments, centroids), moved, centroids })
    if (!moved) break
  }
  return { trace, assignments, centroids }
}

function freshRun(points, k, init, seed) {
  const start = init === 'manual' ? [] : init === 'random' ? randomInit(points, k, seeded(500 + seed)) : kMeansPlusPlus(points, k, seeded(500 + seed))
  return { start, centroids: start, assignments: null, trails: start.map((c) => [c]), history: [], iteration: 0, moved: null, phase: 'assign' }
}

function assignStep(points, run) {
  const assignments = assignClusters(points, run.centroids)
  const moved = run.assignments ? assignments.filter((a, i) => a !== run.assignments[i]).length : points.length
  const done = run.assignments !== null && moved === 0
  return {
    ...run,
    assignments,
    moved,
    phase: done ? 'done' : 'update',
    history: [...run.history, { x: run.iteration, y: inertia(points, assignments, run.centroids) }],
  }
}

function updateStep(points, run) {
  const centroids = updateCentroids(points, run.assignments, run.centroids)
  return { ...run, centroids, trails: run.trails.map((trail, i) => [...trail, centroids[i]]), iteration: run.iteration + 1, phase: 'assign' }
}

function pythonCode(points, start) {
  return `# K-means (Lloyd's algorithm) from the simulation's starting centroids (standard library only)
import math

x = ${pyList(points.map((p) => p.x), 2)}
y = ${pyList(points.map((p) => p.y), 2)}
centroids = ${`[${start.map((c) => `(${r2(c.x)}, ${r2(c.y)})`).join(', ')}]`}
points = list(zip(x, y))

def nearest(p):
    return min(range(len(centroids)), key=lambda i: math.dist(p, centroids[i]))

labels = [nearest(p) for p in points]
inertia = sum(math.dist(p, centroids[l]) ** 2 for p, l in zip(points, labels))
print(f"start: inertia = {inertia:.2f}")

for iteration in range(1, 101):
    new_centroids = []
    for i in range(len(centroids)):
        members = [p for p, l in zip(points, labels) if l == i]
        if members:
            new_centroids.append((sum(m[0] for m in members) / len(members), sum(m[1] for m in members) / len(members)))
        else:
            new_centroids.append(centroids[i])
    centroids = new_centroids
    new_labels = [nearest(p) for p in points]
    moved = sum(1 for a, b in zip(labels, new_labels) if a != b)
    labels = new_labels
    inertia = sum(math.dist(p, centroids[l]) ** 2 for p, l in zip(points, labels))
    print(f"iteration {iteration}: inertia = {inertia:.2f}, points reassigned = {moved}")
    if moved == 0:
        break

print("centroids:", [(round(cx, 2), round(cy, 2)) for cx, cy in centroids])
print("cluster sizes:", [labels.count(i) for i in range(len(centroids))])
`
}

export default function KMeansSim({ onSaveResult, onUsePython }) {
  const clipId = useId().replace(/:/g, '')
  const [dataset, setDataset] = useState('blobs')
  const [k, setK] = useState(4)
  const [init, setInit] = useState('plusplus')
  const [seed, setSeed] = useState(0)
  const [showRegions, setShowRegions] = useState(true)
  const [showTrails, setShowTrails] = useState(true)
  const [pinned, setPinned] = useState(null)
  const [run, setRun] = useState(() => freshRun(makeKMeansData('blobs'), 4, 'plusplus', 0))

  const points = useMemo(() => makeKMeansData(dataset), [dataset])
  const elbow = useMemo(() => Array.from({ length: 8 }, (_, i) => ({ x: i + 1, y: bestKMeans(points, i + 1).inertia })), [points])

  const restart = (changes) => {
    const next = { dataset, k, init, seed, ...changes }
    setDataset(next.dataset)
    setK(next.k)
    setInit(next.init)
    setSeed(next.seed)
    setRun(freshRun(makeKMeansData(next.dataset), next.k, next.init, next.seed))
  }

  const placing = run.centroids.length < k
  const done = run.phase === 'done'
  const currentInertia = run.assignments ? inertia(points, run.assignments, run.centroids) : null
  const score = useMemo(() => (run.assignments ? silhouette(points, run.assignments) : null), [points, run.assignments])
  const bestInertia = elbow[k - 1].y
  const stuck = done && currentInertia > bestInertia * 1.05

  const step = () => setRun((current) => (current.phase === 'update' ? updateStep(points, current) : assignStep(points, current)))
  const runAll = () =>
    setRun((current) => {
      let next = current
      for (let guard = 0; next.phase !== 'done' && guard < 400; guard++) next = next.phase === 'update' ? updateStep(points, next) : assignStep(points, next)
      return next
    })

  const place = (x, y) => {
    if (!placing || run.assignments) return
    const centroid = { x: r2(x), y: r2(y) }
    setRun({ ...run, start: [...run.start, centroid], centroids: [...run.centroids, centroid], trails: [...run.trails, [centroid]] })
  }

  const status = placing ? `Place ${k - run.centroids.length} more` : done ? (stuck ? 'Local minimum' : 'Converged') : run.assignments ? 'Running' : 'Ready'

  const current = {
    label: `k ${k} · ${INITS.find((i) => i.value === init).label} · ${DATASETS.find((d) => d.value === dataset).label}`,
    metrics: [
      { label: 'Iteration', value: String(run.iteration) },
      { label: 'Inertia (WCSS)', value: currentInertia === null ? '—' : fixed(currentInertia, 1) },
      { label: 'Silhouette', value: score === null ? '—' : fixed(score, 3) },
      { label: 'Points reassigned', value: run.moved === null ? '—' : String(run.moved) },
      { label: 'Status', value: status },
    ],
  }

  const save = () =>
    onSaveResult({
      title: current.label,
      metrics: current.metrics,
      explanation: `${done ? `K-means converged after ${run.iteration} iteration${run.iteration === 1 ? '' : 's'}` : `After ${run.iteration} iteration${run.iteration === 1 ? '' : 's'} (not yet converged)`} with inertia ${
        currentInertia === null ? 'not computed yet' : fixed(currentInertia, 1)
      }; the best of ten k-means++ runs reaches ${fixed(bestInertia, 1)} for k = ${k}. ${
        stuck ? 'This run is stuck in a local minimum: a different start (or several starts, n_init) finds a better solution. ' : ''
      }${
        dataset === 'moons'
          ? 'K-means assumes compact, roughly round clusters, so it cuts the moons with straight boundaries instead of following their shape.'
          : dataset === 'uniform'
            ? 'The data has no natural groups, so the elbow is unclear and silhouette scores stay low whatever k you choose.'
            : `A silhouette of ${score === null ? '—' : fixed(score, 3)} ${score !== null && score > 0.6 ? 'indicates well-separated clusters.' : 'suggests the clusters overlap or k does not match the structure.'}`
      }`,
    })

  const cellSize = (2 * EXTENT) / GRID

  return (
    <>
      <SimPanel
        kicker="ASSIGN · UPDATE · REPEAT"
        title="K-means clustering workbench"
        intro="Unlabelled points and k centroids. Each step either assigns every point to its nearest centroid or moves every centroid to the mean of its points. Step through Lloyd’s algorithm and watch the inertia fall until nothing changes."
      >
        <div className="lab-sim-controls">
          <Select label="Dataset" value={dataset} onChange={(value) => restart({ dataset: value })} options={DATASETS} />
          <Slider label="Number of clusters k" min={1} max={8} step={1} value={k} onChange={(value) => restart({ k: value })} />
          <Select label="Initialisation" value={init} onChange={(value) => restart({ init: value })} options={INITS} />
          <Toggle label="Show regions" checked={showRegions} onChange={setShowRegions} />
          <Toggle label="Show centroid trails" checked={showTrails} onChange={setShowTrails} />
        </div>
        <div className="lab-actions lab-actions-start">
          <button type="button" className="lab-btn lab-btn-primary" onClick={step} disabled={placing || done}>
            <StepForward aria-hidden="true" />
            {run.phase === 'update' ? 'Move centroids' : 'Assign points'}
          </button>
          <button type="button" className="lab-btn" onClick={runAll} disabled={placing || done}>
            <FastForward aria-hidden="true" />
            Run to convergence
          </button>
          <button type="button" className="lab-btn" onClick={() => restart({ seed: seed + 1 })}>
            <RefreshCw aria-hidden="true" />
            New start
          </button>
        </div>
        <MetricGrid metrics={current.metrics} />
        {init === 'manual' && placing && <p className="lab-muted">Click inside the plot to place centroid {run.centroids.length + 1} of {k}.</p>}
      </SimPanel>

      <div className="lab-sim-columns">
        <SimPanel title="Clusters and centroids" dark>
          <Legend
            items={[
              { label: 'Unassigned point', color: '#94a3b8' },
              { label: 'Centroid (ringed)', color: '#ffffff' },
              { label: 'Centroid trail', color: CHART_THEME.accent },
            ]}
          />
          <div className="lab-chart-box">
            <ChartFrame
              width={440}
              height={440}
              xDomain={[-EXTENT, EXTENT]}
              yDomain={[-EXTENT, EXTENT]}
              xLabel="Feature x₁"
              yLabel="Feature x₂"
              label="Data points coloured by cluster with centroids and their trails"
              onPointer={init === 'manual' ? place : undefined}
            >
              {({ sx, sy, width, height, pad }) => {
                const cells = []
                if (showRegions && run.centroids.length) {
                  for (let i = 0; i < GRID; i++) {
                    for (let j = 0; j < GRID; j++) {
                      const cx = -EXTENT + (i + 0.5) * cellSize
                      const cy = -EXTENT + (j + 0.5) * cellSize
                      const [owner] = assignClusters([{ x: cx, y: cy }], run.centroids)
                      cells.push(
                        <rect
                          key={`${i}-${j}`}
                          x={sx(cx - cellSize / 2)}
                          y={sy(cy + cellSize / 2)}
                          width={sx(cellSize) - sx(0) + 0.5}
                          height={sy(0) - sy(cellSize) + 0.5}
                          fill={CLUSTER_COLORS[owner]}
                          opacity="0.12"
                        />,
                      )
                    }
                  }
                }
                return (
                  <>
                    <defs>
                      <clipPath id={clipId}>
                        <rect x={pad.left} y={pad.top} width={width - pad.left - pad.right} height={height - pad.top - pad.bottom} />
                      </clipPath>
                    </defs>
                    <g clipPath={`url(#${clipId})`} style={init === 'manual' && placing ? { cursor: 'crosshair' } : undefined}>
                      <g>{cells}</g>
                      {points.map((p, i) => (
                        <circle
                          key={i}
                          cx={sx(p.x)}
                          cy={sy(p.y)}
                          r="4.5"
                          fill={run.assignments ? CLUSTER_COLORS[run.assignments[i]] : '#94a3b8'}
                          stroke="#030712"
                          strokeWidth="1"
                        />
                      ))}
                      {showTrails &&
                        run.trails.map(
                          (trail, i) =>
                            trail.length > 1 && (
                              <polyline
                                key={`trail${i}`}
                                points={trail.map((c) => `${sx(c.x)},${sy(c.y)}`).join(' ')}
                                fill="none"
                                stroke={CHART_THEME.accent}
                                strokeWidth="1.8"
                                strokeDasharray="4 4"
                              />
                            ),
                        )}
                      {run.centroids.map((c, i) => (
                        <g key={`c${i}`}>
                          <circle cx={sx(c.x)} cy={sy(c.y)} r="10" fill={CLUSTER_COLORS[i]} stroke="#ffffff" strokeWidth="3" />
                          <path d={`M${sx(c.x) - 4} ${sy(c.y) - 4}L${sx(c.x) + 4} ${sy(c.y) + 4}M${sx(c.x) + 4} ${sy(c.y) - 4}L${sx(c.x) - 4} ${sy(c.y) + 4}`} stroke="#030712" strokeWidth="2.2" />
                          <title>{`Centroid ${i + 1} at (${c.x.toFixed(2)}, ${c.y.toFixed(2)})`}</title>
                        </g>
                      ))}
                    </g>
                  </>
                )
              }}
            </ChartFrame>
          </div>
          <p className="lab-muted">Shaded regions show which centroid is nearest to every location. Boundaries between clusters are always straight lines.</p>
        </SimPanel>

        <SimPanel title="Inertia and the elbow" dark>
          <p className="lab-question-text">Inertia after each assignment</p>
          {run.history.length ? (
            <div className="lab-chart-box">
              <LineChart
                series={[{ label: 'Inertia', points: run.history, color: CHART_THEME.primary }]}
                marker={run.history[run.history.length - 1]}
                xLabel="Iteration"
                yLabel="Inertia"
                yMin={0}
                label="Inertia after each assignment step"
              />
            </div>
          ) : (
            <p className="lab-muted">Press “Assign points” to start. Inertia is the sum of squared distances from each point to its centroid.</p>
          )}

          <p className="lab-question-text">Elbow method (best of 10 starts)</p>
          <div className="lab-chart-box">
            <LineChart
              series={[{ label: 'Best inertia', points: elbow, color: CHART_THEME.accent }]}
              marker={{ x: k, y: bestInertia }}
              xLabel="Number of clusters k"
              yLabel="Inertia"
              yMin={0}
              label="Best inertia for each number of clusters"
            />
          </div>
          <p className="lab-muted">Inertia always falls as k grows. Look for the elbow, where adding another cluster stops paying off.</p>
        </SimPanel>
      </div>

      <PinnedComparison pinned={pinned} current={current} />

      <ExplainBox>
        K-means alternates two moves that can only lower the inertia: give every point to its nearest centroid, then move each centroid to the mean of its points.
        It stops when no point changes cluster. The result depends on the starting centroids, so k-means++ spreads the starts out and libraries rerun the
        algorithm several times. K-means also assumes compact, similar-sized, roughly round clusters, which is why it struggles with moons.
      </ExplainBox>

      <SimFooter
        onPin={() => setPinned(current)}
        onSave={save}
        onPython={() => onUsePython(pythonCode(points, run.start.length === k ? run.start : kMeansPlusPlus(points, k, seeded(500 + seed))))}
      />
    </>
  )
}
