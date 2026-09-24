import { useId } from 'react'
import { Code, Pin, Save } from 'lucide-react'

// Building blocks shared by every experiment's visual simulation.

export function SimPanel({ kicker, title, intro, children, dark = false }) {
  const id = useId()
  return (
    <section className={`lab-sim-panel${dark ? ' is-dark' : ''}`} aria-labelledby={`${id}-title`}>
      {kicker && <p className="lab-kicker">{kicker}</p>}
      <h4 id={`${id}-title`} className="lab-subtitle">
        {title}
      </h4>
      {intro && <p className="lab-p">{intro}</p>}
      {children}
    </section>
  )
}

export function Slider({ label, min, max, step, value, onChange, digits = 0, disabled = false, suffix = '', format }) {
  const id = useId()
  return (
    <div className="lab-control">
      <div className="lab-control-top">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>
          {format ? format(value) : value.toFixed(digits)}
          {suffix}
        </output>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  )
}

export function Select({ label, value, onChange, options }) {
  const id = useId()
  return (
    <div className="lab-control">
      <label htmlFor={id}>{label}</label>
      <select id={id} className="lab-select" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export function Toggle({ label, checked, onChange }) {
  return (
    <button type="button" className="lab-btn lab-toggle" aria-pressed={checked} onClick={() => onChange(!checked)}>
      {label}: {checked ? 'on' : 'off'}
    </button>
  )
}

export function MetricGrid({ metrics }) {
  return (
    <dl className="lab-metrics lab-metrics-row">
      {metrics.map((metric) => (
        <div key={metric.label}>
          <dt>{metric.label}</dt>
          <dd>{metric.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function ExplainBox({ title = 'Explain what changed', children }) {
  return (
    <SimPanel title={title}>
      <p className="lab-p">{children}</p>
    </SimPanel>
  )
}

// Shows pinned metrics next to the current ones so students can compare two settings.
export function PinnedComparison({ pinned, current }) {
  if (!pinned) return null
  return (
    <div className="lab-table-wrap">
      <table className="lab-table">
        <caption className="mz-sr-only">Pinned comparison</caption>
        <thead>
          <tr>
            <th scope="col">Metric</th>
            <th scope="col">Pinned ({pinned.label})</th>
            <th scope="col">Current</th>
          </tr>
        </thead>
        <tbody>
          {current.metrics.map((metric, index) => (
            <tr key={metric.label}>
              <td>{metric.label}</td>
              <td>{pinned.metrics[index]?.value ?? '—'}</td>
              <td>{metric.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function SimFooter({ onPin, onSave, onPython }) {
  return (
    <div className="lab-actions lab-actions-start">
      <button type="button" className="lab-btn" onClick={onPin}>
        <Pin aria-hidden="true" />
        Pin comparison
      </button>
      <button type="button" className="lab-btn lab-btn-primary" onClick={onSave}>
        <Save aria-hidden="true" />
        Save to Results
      </button>
      <button type="button" className="lab-btn" onClick={onPython}>
        <Code aria-hidden="true" />
        Use this data in Python
      </button>
    </div>
  )
}

export const fixed = (value, digits = 3) => (Number.isFinite(value) ? value.toFixed(digits) : '—')
export const percent = (value) => `${(value * 100).toFixed(1)}%`

// Python list literal for "Use this data in Python".
export const pyList = (values, digits = 3) => `[${values.map((v) => (typeof v === 'number' ? Number(v.toFixed(digits)) : JSON.stringify(v))).join(', ')}]`
