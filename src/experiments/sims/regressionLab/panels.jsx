import { useEffect, useRef } from 'react'
import { CheckCircle2, Circle, Eye, Lightbulb, RotateCcw, Trash2, X } from 'lucide-react'
import { InfoTip, NumberField } from '../../../components/lab/interactive/controls.jsx'
import { usePulse } from '../../../components/lab/interactive/hooks.js'
import { DOMAIN, FLOW, at, fmt, lineTerms, signed } from './model.js'

const MINUS = '−'

function Card({ title, tip, className = '', children, actions }) {
  return (
    <section className={`lr-card ${className}`} aria-label={title}>
      <header className="lr-card-head">
        <h5>{title}</h5>
        {tip}
        {actions}
      </header>
      {children}
    </section>
  )
}

function Flash({ value, children, className = '' }) {
  const on = usePulse(value)
  return <span className={`lr-flash${on ? ' is-on' : ''} ${className}`}>{children}</span>
}

// ---------- Equation ----------

export function EquationPanel({ line, mode, genLine, change, fitStatus, editable, showSnap, onSlope, onIntercept, onSnap }) {
  const badges = usePulse(change.stamp, 1400)
  const slopeOn = badges && change.slope
  const interceptOn = badges && change.intercept
  const b = Number(line.intercept.toFixed(2))
  return (
    <Card
      title="Regression equation"
      className="lr-equation"
      tip={
        <InfoTip label="What does the equation mean?" align="end">
          The model predicts ŷ (y-hat) for any x by multiplying x by the slope and adding the intercept.
        </InfoTip>
      }
    >
      <p className="lr-eq-template">
        Ŷ = <var className="is-m">m</var>x + <var className="is-b">b</var>
        <span className="lr-eq-keys">
          <span>
            <var className="is-m">m</var> = slope
          </span>
          <span>
            <var className="is-b">b</var> = intercept
          </span>
        </span>
      </p>
      <p className="lr-eq-live" aria-live="polite" aria-atomic="true">
        Ŷ = <Flash value={line.slope.toFixed(2)} className="is-m">{fmt(line.slope)}</Flash>x {b < 0 ? MINUS : '+'}{' '}
        <Flash value={line.intercept.toFixed(2)} className="is-b">{fmt(Math.abs(line.intercept))}</Flash>
      </p>
      <div className="lr-eq-badges" aria-live="polite">
        {slopeOn && <span className="lr-badge is-m">Slope changed</span>}
        {interceptOn && <span className="lr-badge is-b">Intercept changed</span>}
      </div>
      {mode === 'generate' && (
        <p className="lr-note">
          Underlying relationship (dashed): <strong>y = {lineTerms(genLine)}</strong> + noise. The solid line is the model fitted to the noisy points.
        </p>
      )}
      {fitStatus === 'same-x' && mode !== 'model' && <p className="lr-warn">All X values are identical, so the slope cannot be calculated. Showing a flat line at the mean of Y.</p>}
      {editable && (
        <div className="lr-eq-inputs">
          <NumberField label="Slope m" value={line.slope} min={-50} max={50} step={0.05} onChange={onSlope} compact />
          <NumberField label="Intercept b" value={line.intercept} min={-100} max={100} step={0.1} onChange={onIntercept} compact />
          {showSnap && (
            <button type="button" className="lab-btn lr-btn-sm" onClick={onSnap}>
              Snap to least squares
            </button>
          )}
        </div>
      )}
    </Card>
  )
}

// ---------- Metrics ----------

const METRIC_TIPS = {
  MSE: 'Mean Squared Error: the average squared difference between the actual and predicted values. Lower is better.',
  MAE: 'Mean Absolute Error: the average absolute prediction error, in the units of Y. Lower is better.',
  'R²': 'Shows how much of the variation in the data is explained by the model. 1 is perfect, 0 is no better than predicting the average; it can go negative for a very poor line.',
  SSE: 'Sum of Squared Errors: the total squared prediction error, Σ(yᵢ − ŷᵢ)². It is the total area of the error squares.',
}

export function MetricsPanel({ evaluation, bestMse, showBest, yours }) {
  const cards = [
    { key: 'MSE', label: yours ? 'Your MSE' : 'MSE', value: evaluation.mse, formula: '(1/n) Σ(yᵢ − ŷᵢ)²' },
    { key: 'MAE', label: 'MAE', value: evaluation.mae, formula: '(1/n) Σ|yᵢ − ŷᵢ|' },
    { key: 'R²', label: 'R²', value: evaluation.r2, formula: '1 − SSE / Σ(yᵢ − ȳ)²' },
    { key: 'SSE', label: 'SSE', value: evaluation.sse, formula: 'Σ(yᵢ − ŷᵢ)²' },
  ]
  return (
    <section className="lr-metrics" aria-label="Model metrics">
      {cards.map((card) => (
        <div key={card.key} className="lr-metric" data-metric={card.key}>
          <div className="lr-metric-top">
            <span>{card.label}</span>
            <InfoTip label={`What is ${card.key}?`} align={card.key === 'R²' || card.key === 'SSE' ? 'end' : 'start'}>
              {METRIC_TIPS[card.key]}
              {card.key === 'R²' && card.value == null && ' It is undefined here because every Y value is the same.'}
            </InfoTip>
          </div>
          <Flash value={fmt(card.value)} className="lr-metric-value">
            {card.value == null ? '—' : fmt(card.value)}
          </Flash>
          <span className="lr-metric-formula">{card.formula}</span>
        </div>
      ))}
      {showBest && (
        <p className="lr-note lr-metrics-best">
          Least-squares minimum MSE for this data: <strong>{fmt(bestMse)}</strong>
        </p>
      )}
    </section>
  )
}

// ---------- "You fit it" challenge ----------

export function ChallengePanel({ challenge, mse, bestMse, onReveal, onTryAgain, onEnd }) {
  const difference = mse - bestMse
  return (
    <Card
      title="You fit it"
      className="lr-challenge"
      actions={
        <button type="button" className="lr-icon-btn" onClick={onEnd} aria-label="End challenge">
          <X aria-hidden="true" />
        </button>
      }
    >
      <p className="lr-challenge-score">
        Your MSE: <Flash value={fmt(mse)}>{fmt(mse)}</Flash>
      </p>
      {challenge.revealed ? (
        <>
          <dl className="lr-compare">
            <div>
              <dt>Your MSE</dt>
              <dd>{fmt(mse)}</dd>
            </div>
            <div>
              <dt>Best-fit MSE</dt>
              <dd>{fmt(bestMse)}</dd>
            </div>
            <div>
              <dt>Difference</dt>
              <dd className={difference < 0.01 ? 'is-good' : ''}>{fmt(Math.max(0, difference))}</dd>
            </div>
          </dl>
          <p className="lr-note">
            {difference < 0.01 ? 'Excellent — your line matches the least-squares solution. ' : ''}
            The best-fit line is the line that minimizes prediction error. You can keep adjusting your line to close the gap.
          </p>
        </>
      ) : (
        <p className="lr-note">The best-fit line is hidden. Drag the centre handle to shift your line and the end handles to tilt it until the MSE stops falling.</p>
      )}
      <div className="lr-row">
        {!challenge.revealed && (
          <button type="button" className="lab-btn lab-btn-primary lr-btn-sm" onClick={onReveal}>
            <Eye aria-hidden="true" />
            Reveal Best Fit
          </button>
        )}
        <button type="button" className="lab-btn lr-btn-sm" onClick={onTryAgain}>
          <RotateCcw aria-hidden="true" />
          Try Again
        </button>
      </div>
    </Card>
  )
}

// ---------- Hint ----------

export function HintPanel({ hint }) {
  return (
    <div className="lr-hint" role="status" aria-live="polite">
      <Lightbulb aria-hidden="true" />
      <p key={hint}>{hint}</p>
    </div>
  )
}

// ---------- Selected point ----------

export function PointInspector({ row, total, editable, outlier, canDelete, onEdit, onDelete }) {
  if (!row) {
    return (
      <Card title="Selected point" className="lr-inspector">
        <p className="lr-note">Click a point on the graph or a row in the table to inspect it.</p>
      </Card>
    )
  }
  return (
    <Card
      title={`Point ${row.index + 1} of ${total}${outlier ? ' · outlier' : ''}`}
      className="lr-inspector"
      actions={
        editable && (
          <button type="button" className="lr-icon-btn" onClick={onDelete} disabled={!canDelete} aria-label={`Delete point ${row.index + 1}`}>
            <Trash2 aria-hidden="true" />
          </button>
        )
      }
    >
      <div className="lr-inspector-grid">
        <NumberField label="X" value={row.x} min={DOMAIN.x[0]} max={DOMAIN.x[1]} step={0.1} disabled={!editable} onChange={(x) => onEdit(row.id, { x })} compact />
        <NumberField label="Actual Y" value={row.y} min={DOMAIN.y[0]} max={DOMAIN.y[1]} step={0.1} disabled={!editable} onChange={(y) => onEdit(row.id, { y })} compact />
        <div className="lr-readout">
          <span>Predicted Ŷ</span>
          <strong>{fmt(row.predicted)}</strong>
        </div>
        <div className="lr-readout">
          <span>Residual</span>
          <strong className={row.residual >= 0 ? 'is-positive' : 'is-negative'}>{signed(row.residual)}</strong>
        </div>
      </div>
      <p className="lr-formula">
        Residual = y − ŷ = {fmt(row.y)} − {fmt(row.predicted)} = <strong>{signed(row.residual)}</strong>
      </p>
      {!editable && <p className="lr-note">Switch to Edit Data to change this point.</p>}
    </Card>
  )
}

// ---------- Prediction ----------

export function PredictionPanel({ x, line, dataRange, onX, onClose }) {
  const y = at(line, x)
  const outside = dataRange && (x < dataRange[0] || x > dataRange[1])
  const b = Number(line.intercept.toFixed(2))
  return (
    <Card
      title="Make a prediction"
      className="lr-prediction"
      actions={
        <button type="button" className="lr-icon-btn" onClick={onClose} aria-label="Close prediction tool">
          <X aria-hidden="true" />
        </button>
      }
    >
      <div className="lr-row">
        <NumberField label="X =" value={x} min={DOMAIN.x[0]} max={DOMAIN.x[1]} step={0.5} onChange={onX} compact />
        <p className="lr-note">…or drag the ▲ marker along the X-axis.</p>
      </div>
      <div className="lr-derivation" aria-live="polite">
        <p>For x = {fmt(x)}</p>
        <p>Ŷ = mx + b</p>
        <p>
          Ŷ = ({fmt(line.slope)} × {fmt(x)}) {b < 0 ? MINUS : '+'} {fmt(Math.abs(line.intercept))}
        </p>
        <p className="lr-derivation-result">
          Ŷ = <Flash value={fmt(y)}>{fmt(y)}</Flash>
        </p>
      </div>
      {outside && <p className="lr-warn">x = {fmt(x)} is outside the observed data range, so this is extrapolation — treat it with extra caution.</p>}
    </Card>
  )
}

// ---------- Outlier impact ----------

export function OutlierImpact({ impact }) {
  const rows = [
    { label: 'Slope', key: 'slope' },
    { label: 'Intercept', key: 'intercept' },
    { label: 'MSE', key: 'mse' },
    { label: 'R²', key: 'r2' },
  ]
  return (
    <Card title="Outlier impact" className="lr-outlier">
      <table className="lr-mini-table">
        <thead>
          <tr>
            <th scope="col">Best fit</th>
            <th scope="col">Without</th>
            <th scope="col">With</th>
            <th scope="col">Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ label, key }) => {
            const before = impact.before[key]
            const after = impact.after[key]
            const delta = before == null || after == null ? null : after - before
            return (
              <tr key={key}>
                <th scope="row">{label}</th>
                <td>{before == null ? '—' : fmt(before)}</td>
                <td>{after == null ? '—' : fmt(after)}</td>
                <td className={delta != null && Math.abs(delta) >= 0.01 ? 'is-changed' : ''}>
                  <Flash value={delta == null ? '—' : fmt(delta)}>{delta == null ? '—' : signed(delta)}</Flash>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="lr-note">Notice how one extreme data point can influence the regression line. Drag it farther away and watch the change grow.</p>
    </Card>
  )
}

// ---------- Dataset table ----------

export function DatasetTable({ rows, selectedId, outlierId, editable, onSelect, onEdit }) {
  const scrollRef = useRef(null)
  useEffect(() => {
    const box = scrollRef.current
    const row = box?.querySelector('tr.is-selected')
    if (!box || !row) return
    // Scroll inside the table only, never the page.
    const top = row.offsetTop - box.querySelector('thead').offsetHeight
    if (top < box.scrollTop) box.scrollTop = top
    else if (row.offsetTop + row.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = row.offsetTop + row.offsetHeight - box.clientHeight
  }, [selectedId])

  return (
    <Card
      title={`Dataset · ${rows.length} points`}
      className="lr-dataset"
      tip={
        <InfoTip label="About the dataset table" align="end">
          Each row is one observation. Predicted Ŷ comes from the current line; Residual = Actual Y − Predicted Ŷ.
          {editable ? ' Edit X or Y to move the point on the graph.' : ' Switch to Edit Data to edit values.'}
        </InfoTip>
      }
    >
      <div className="lr-table-scroll" ref={scrollRef}>
        <table className="lr-table">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">X</th>
              <th scope="col">Actual Y</th>
              <th scope="col">Predicted Ŷ</th>
              <th scope="col">Residual</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className={`${row.id === selectedId ? 'is-selected' : ''}${row.id === outlierId ? ' is-outlier' : ''}`}
                onClick={() => onSelect(row.id)}
                aria-selected={row.id === selectedId}
              >
                <td>{row.index + 1}</td>
                {editable ? (
                  <>
                    <td onFocus={() => onSelect(row.id)}>
                      <NumberField label={`X of point ${row.index + 1}`} hideLabel compact value={row.x} min={DOMAIN.x[0]} max={DOMAIN.x[1]} onChange={(x) => onEdit(row.id, { x })} />
                    </td>
                    <td onFocus={() => onSelect(row.id)}>
                      <NumberField label={`Actual Y of point ${row.index + 1}`} hideLabel compact value={row.y} min={DOMAIN.y[0]} max={DOMAIN.y[1]} onChange={(y) => onEdit(row.id, { y })} />
                    </td>
                  </>
                ) : (
                  <>
                    <td>{fmt(row.x)}</td>
                    <td>{fmt(row.y)}</td>
                  </>
                )}
                <td>{fmt(row.predicted)}</td>
                <td className={row.residual >= 0 ? 'is-positive' : 'is-negative'}>{signed(row.residual)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ---------- Learning guidance ----------

export function LabPath({ done }) {
  const next = FLOW.find((step) => !done.has(step.id))
  const count = FLOW.filter((step) => done.has(step.id)).length
  return (
    <details className="lr-path">
      <summary>
        <span className="lr-path-count">
          Lab path {count}/{FLOW.length}
        </span>
        <span className="lr-path-bar" aria-hidden="true">
          {FLOW.map((step) => (
            <span key={step.id} className={done.has(step.id) ? 'is-done' : step === next ? 'is-next' : ''} />
          ))}
        </span>
        <span className="lr-path-next">{next ? `Next: ${next.label}` : 'All steps explored — keep experimenting!'}</span>
      </summary>
      <ol>
        {FLOW.map((step, i) => (
          <li key={step.id} className={done.has(step.id) ? 'is-done' : ''}>
            {done.has(step.id) ? <CheckCircle2 aria-hidden="true" /> : <Circle aria-hidden="true" />}
            <span>
              Step {i + 1}: {step.label}
              <span className="mz-sr-only">{done.has(step.id) ? ' (done)' : ''}</span>
            </span>
          </li>
        ))}
      </ol>
    </details>
  )
}

const OBJECTIVES = [
  ['What a regression line represents', 'The straight line that best describes how Y tends to change as X changes. It turns an input x into a prediction ŷ.'],
  ['What slope means', 'm tells you how much ŷ changes when x increases by 1. Positive slopes rise, negative slopes fall, and bigger |m| means steeper.'],
  ['What intercept means', 'b is the predicted value when x = 0 — where the line crosses the Y-axis. Changing b slides the line up or down.'],
  ['How data affects the model', 'The line is calculated from the data. Move a point in Edit Data and the whole line responds.'],
  ['What prediction means', 'Reading the line at a new x gives ŷ = mx + b, the model’s best guess for y.'],
  ['What residuals are', 'The vertical gap between an actual point and the line: residual = y − ŷ. Positive means the point is above the line.'],
  ['Why least squares minimizes squared error', 'Squaring makes every error positive and punishes big errors more. Least squares picks the one line whose squares have the smallest total area (SSE).'],
  ['What MSE and MAE represent', 'MSE is the average squared error; MAE is the average absolute error in Y’s units. Both are 0 for a perfect fit.'],
  ['What R² represents', 'The share of the variation in Y the line explains: 1 is perfect, 0 is no better than always predicting the average.'],
  ['How outliers affect regression', 'Because errors are squared, one extreme point can pull the line strongly towards itself.'],
  ['How noise influences model performance', 'Noisy data scatters around the true relationship, so the fitted line is less certain and R² drops.'],
  ['Why the line is calculated from data', 'We do not guess m and b — the formulas m = Σ(x−x̄)(y−ȳ)/Σ(x−x̄)² and b = ȳ − m·x̄ compute them from the observations.'],
]

export function LearningObjectives() {
  return (
    <details className="lr-objectives">
      <summary>What am I learning?</summary>
      <dl>
        {OBJECTIVES.map(([term, text]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd>{text}</dd>
          </div>
        ))}
      </dl>
    </details>
  )
}
