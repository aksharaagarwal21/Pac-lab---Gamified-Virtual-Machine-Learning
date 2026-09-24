import { useId, useMemo, useState } from 'react'
import { CHART_THEME, ChartFrame, Legend, LineChart } from '../../components/lab/charts.jsx'
import { ExplainBox, MetricGrid, PinnedComparison, Select, SimFooter, SimPanel, Slider, Toggle, fixed, percent, pyList } from '../../components/lab/simKit.jsx'
import { gaussian, mean, pca2D, projectedVariance, seeded } from '../../lib/ml.js'

const DATASETS = [
  { value: 'correlated', label: 'Correlated features' },
  { value: 'elongated', label: 'Strongly elongated cloud' },
  { value: 'round', label: 'Uncorrelated (round) cloud' },
  { value: 'scales', label: 'Income vs age (different scales)' },
]

const AXIS_NAMES = {
  correlated: ['x₁', 'x₂'],
  elongated: ['x₁', 'x₂'],
  round: ['x₁', 'x₂'],
  scales: ['Income (₹ thousands)', 'Age (years)'],
}

const round2 = (v) => Math.round(v * 100) / 100

function makeDataset(kind) {
  const random = seeded({ correlated: 51, elongated: 52, round: 53, scales: 54 }[kind])
  return Array.from({ length: 60 }, () => {
    const a = gaussian(random)
    const b = gaussian(random)
    if (kind === 'correlated') return { x: round2(a), y: round2(0.8 * a + 0.55 * b) }
    if (kind === 'elongated') return { x: round2(a), y: round2(a + 0.15 * b) }
    if (kind === 'round') return { x: round2(a), y: round2(0.95 * b) }
    return { x: round2(50 + 20 * a), y: round2(35 + 8 * (0.5 * a + 0.87 * b)) }
  })
}

const populationStd = (values) => {
  const m = mean(values)
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)))
}

// Centre the data (and optionally scale each feature to unit variance).
function prepare(raw, standardize) {
  const mx = mean(raw.map((p) => p.x))
  const my = mean(raw.map((p) => p.y))
  const sx = standardize ? populationStd(raw.map((p) => p.x)) : 1
  const sy = standardize ? populationStd(raw.map((p) => p.y)) : 1
  return raw.map((p) => ({ x: (p.x - mx) / sx, y: (p.y - my) / sy }))
}

const toDegrees = (radians) => (((radians * 180) / Math.PI) % 180 + 180) % 180

function pythonCode(raw, standardize) {
  return `# PCA in two dimensions from first principles (standard library only)
import math

x1 = ${pyList(raw.map((p) => p.x), 2)}
x2 = ${pyList(raw.map((p) => p.y), 2)}
STANDARDIZE = ${standardize ? 'True' : 'False'}
n = len(x1)

def centre(values):
    m = sum(values) / n
    centred = [v - m for v in values]
    if STANDARDIZE:
        s = math.sqrt(sum(v * v for v in centred) / n)
        centred = [v / s for v in centred]
    return centred

a, b = centre(x1), centre(x2)
cov_aa = sum(v * v for v in a) / n
cov_bb = sum(v * v for v in b) / n
cov_ab = sum(u * v for u, v in zip(a, b)) / n

half, root = (cov_aa + cov_bb) / 2, math.sqrt(((cov_aa - cov_bb) / 2) ** 2 + cov_ab ** 2)
eigenvalues = [half + root, half - root]
pc1 = (eigenvalues[0] - cov_bb, cov_ab) if abs(cov_ab) > 1e-12 else ((1, 0) if cov_aa >= cov_bb else (0, 1))
length = math.hypot(*pc1)
pc1 = (pc1[0] / length, pc1[1] / length)

total = sum(eigenvalues)
print("covariance:", [[round(cov_aa, 3), round(cov_ab, 3)], [round(cov_ab, 3), round(cov_bb, 3)]])
print("eigenvalues:", [round(e, 3) for e in eigenvalues])
print("explained variance ratio:", [round(e / total, 3) for e in eigenvalues])
print("PC1 direction:", [round(c, 3) for c in pc1], "angle:", round(math.degrees(math.atan2(pc1[1], pc1[0])) % 180, 1))

scores = [u * pc1[0] + v * pc1[1] for u, v in zip(a, b)]
print("first five PC1 scores:", [round(s, 3) for s in scores[:5]])
print("reconstruction MSE with 1 component:", round(eigenvalues[1], 4))
`
}

export default function PcaSim({ onSaveResult, onUsePython }) {
  const clipId = useId().replace(/:/g, '')
  const [dataset, setDataset] = useState('correlated')
  const [standardize, setStandardize] = useState(false)
  const [angle, setAngle] = useState(0)
  const [showComponents, setShowComponents] = useState(true)
  const [showProjections, setShowProjections] = useState(true)
  const [pinned, setPinned] = useState(null)

  const raw = useMemo(() => makeDataset(dataset), [dataset])
  const points = useMemo(() => prepare(raw, standardize), [raw, standardize])
  const pca = useMemo(() => pca2D(points), [points])
  const radians = (angle * Math.PI) / 180
  const direction = [Math.cos(radians), Math.sin(radians)]
  const captured = projectedVariance(points, radians)
  const total = pca.totalVariance
  const pc1Angle = toDegrees(Math.atan2(pca.components[0].vector[1], pca.components[0].vector[0]))
  const ratios = pca.components.map((c) => c.value / total)

  const extent = Math.max(...points.flatMap((p) => [Math.abs(p.x), Math.abs(p.y)])) * 1.15
  const curve = useMemo(
    () => Array.from({ length: 91 }, (_, i) => ({ x: i * 2, y: (100 * projectedVariance(points, (i * 2 * Math.PI) / 180)) / total })),
    [points, total],
  )

  const current = {
    label: `${angle}° · ${standardize ? 'standardized' : 'raw scale'}`,
    metrics: [
      { label: 'Variance captured', value: percent(captured / total) },
      { label: 'Reconstruction MSE', value: fixed(total - captured, 4) },
      { label: 'PC1 angle', value: `${pc1Angle.toFixed(1)}°` },
      { label: 'PC1 explains', value: percent(ratios[0]) },
      { label: 'PC2 explains', value: percent(ratios[1]) },
    ],
  }

  const save = () =>
    onSaveResult({
      title: `Projection at ${angle}° on "${DATASETS.find((d) => d.value === dataset).label}" (${standardize ? 'standardized' : 'raw scale'})`,
      metrics: current.metrics,
      explanation: `Your direction keeps ${percent(captured / total)} of the variance; the best possible single direction (PC1 at ${pc1Angle.toFixed(1)}°) keeps ${percent(ratios[0])}. ${
        ratios[0] > 0.85
          ? 'One component summarises this data well, so reducing from 2D to 1D loses little information.'
          : 'The variance is spread across both directions, so dropping PC2 would lose a noticeable share of the information.'
      }${dataset === 'scales' && !standardize ? ' Without standardization, income dominates only because it is measured in larger numbers.' : ''}`,
    })

  return (
    <>
      <SimPanel
        kicker="FIND THE DIRECTION OF MOST VARIANCE"
        title="PCA workbench"
        intro="Sixty samples with two features, centred on their mean. Rotate the projection line: every point drops onto it, and the spread of those shadows is the variance that one dimension can keep."
      >
        <div className="lab-sim-controls">
          <Select label="Dataset" value={dataset} onChange={setDataset} options={DATASETS} />
          <Slider label="Projection angle" min={0} max={179} step={1} value={angle} onChange={setAngle} suffix="°" />
          <div className="lab-actions lab-actions-start">
            <button type="button" className="lab-btn lab-btn-primary" onClick={() => setAngle(Math.round(pc1Angle) % 180)}>
              Snap to PC1
            </button>
          </div>
          <Toggle label="Standardize features" checked={standardize} onChange={setStandardize} />
          <Toggle label="Show PC1 and PC2" checked={showComponents} onChange={setShowComponents} />
          <Toggle label="Show projections" checked={showProjections} onChange={setShowProjections} />
        </div>
        <MetricGrid metrics={current.metrics} />
      </SimPanel>

      <div className="lab-sim-columns">
        <SimPanel title="Data and projection" dark>
          <Legend
            items={[
              { label: 'Samples', color: CHART_THEME.primary },
              { label: 'Projection line', color: CHART_THEME.accent },
              { label: 'PC1', color: CHART_THEME.mint },
              { label: 'PC2', color: CHART_THEME.violet },
            ]}
          />
          <div className="lab-chart-box">
            <ChartFrame
              width={440}
              height={440}
              xDomain={[-extent, extent]}
              yDomain={[-extent, extent]}
              xLabel={`${AXIS_NAMES[dataset][0]} (centred${standardize ? ', standardized' : ''})`}
              yLabel={AXIS_NAMES[dataset][1]}
              label="Centred samples with the projection line and principal components"
            >
              {({ sx, sy, width, height, pad }) => {
                const far = extent * 2
                return (
                  <>
                    <defs>
                      <clipPath id={clipId}>
                        <rect x={pad.left} y={pad.top} width={width - pad.left - pad.right} height={height - pad.top - pad.bottom} />
                      </clipPath>
                    </defs>
                    <g clipPath={`url(#${clipId})`}>
                      {showProjections &&
                        points.map((p, i) => {
                          const t = p.x * direction[0] + p.y * direction[1]
                          return (
                            <line key={`proj${i}`} x1={sx(p.x)} y1={sy(p.y)} x2={sx(t * direction[0])} y2={sy(t * direction[1])} stroke="rgba(255, 92, 138, 0.45)" strokeWidth="1.2" />
                          )
                        })}
                      <line x1={sx(-far * direction[0])} y1={sy(-far * direction[1])} x2={sx(far * direction[0])} y2={sy(far * direction[1])} stroke={CHART_THEME.accent} strokeWidth="2.5" />
                      {points.map((p, i) => (
                        <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="4.5" fill={CHART_THEME.primary} opacity="0.9" />
                      ))}
                      {showComponents &&
                        pca.components.map((component, i) => {
                          const length = 2 * Math.sqrt(component.value)
                          return (
                            <line
                              key={`pc${i}`}
                              x1={sx(0)}
                              y1={sy(0)}
                              x2={sx(length * component.vector[0])}
                              y2={sy(length * component.vector[1])}
                              stroke={i === 0 ? CHART_THEME.mint : CHART_THEME.violet}
                              strokeWidth="4"
                              strokeLinecap="round"
                            />
                          )
                        })}
                    </g>
                  </>
                )
              }}
            </ChartFrame>
          </div>
          <p className="lab-muted">Pink segments are reconstruction errors: the information lost when a point is replaced by its shadow on the line. Arrow length is two standard deviations along each component.</p>
        </SimPanel>

        <SimPanel title="Variance captured at every angle" dark>
          <div className="lab-chart-box">
            <LineChart
              series={[{ label: 'Variance captured (%)', points: curve, color: CHART_THEME.accent }]}
              marker={{ x: angle, y: (100 * captured) / total }}
              xLabel="Projection angle (degrees)"
              yLabel="Variance captured (%)"
              yMin={0}
              label="Share of variance captured by a projection at each angle"
            />
          </div>
          <p className="lab-muted">The peak is PC1 ({pc1Angle.toFixed(1)}°); the lowest point, 90° away, is PC2.</p>

          <p className="lab-question-text">Explained variance (scree)</p>
          <div className="lab-bars">
            {pca.components.map((component, i) => (
              <div key={i}>
                <div className="lab-bar-top">
                  <span>
                    PC{i + 1} · eigenvalue {fixed(component.value, 3)}
                  </span>
                  <strong>{percent(ratios[i])}</strong>
                </div>
                <div className="lab-bar" aria-hidden="true">
                  <span style={{ width: `${ratios[i] * 100}%`, background: i === 0 ? CHART_THEME.mint : CHART_THEME.violet }} />
                </div>
              </div>
            ))}
          </div>
        </SimPanel>
      </div>

      <PinnedComparison pinned={pinned} current={current} />

      <ExplainBox>
        PCA rotates the axes to line up with the directions of greatest spread. PC1 captures the most variance a single direction can hold, PC2 the rest, and
        the two are perpendicular and uncorrelated. Keeping only PC1 compresses the data from two numbers to one, losing exactly the variance along PC2.
        Because variance depends on units, features on very different scales should be standardized first.
      </ExplainBox>

      <SimFooter onPin={() => setPinned(current)} onSave={save} onPython={() => onUsePython(pythonCode(raw, standardize))} />
    </>
  )
}
