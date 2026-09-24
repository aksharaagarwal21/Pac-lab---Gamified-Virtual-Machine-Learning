import { useId } from 'react'

export const formatNumber = (value) => value.toLocaleString('en-US')

// Reuses the intro's pac-man, ghost and pellet shapes as static icons.
export function Sprite({ kind, color, className = '' }) {
  const classes = `sprite ${className}`.trim()

  if (kind === 'pac') return <span className={`pacman ${classes}`} aria-hidden="true" />
  if (kind === 'pellet') return <span className={`pellet ${classes}`} aria-hidden="true" />
  if (kind === 'star') return <span className={`star-shape ${classes}`} aria-hidden="true" />
  if (kind === 'ghost') {
    return (
      <span className={`ghost ghost-${color} ${classes}`} aria-hidden="true">
        <span className="ghost-eye">
          <span />
        </span>
        <span className="ghost-eye">
          <span />
        </span>
      </span>
    )
  }
  return null
}

export function Stars({ count, max = 3 }) {
  return (
    <span className="stars" role="img" aria-label={`${count} of ${max} stars`}>
      {Array.from({ length: max }, (_, index) => (
        <span key={index} className={`star-shape${index < count ? ' is-lit' : ''}`} />
      ))}
    </span>
  )
}

export function Meter({ value, max, label }) {
  const percent = Math.round((value / max) * 100)
  return (
    <div className="meter" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <span className="meter-fill" style={{ '--fill': `${percent}%` }} />
    </div>
  )
}

export function Panel({ title, meta, className = '', children }) {
  const titleId = useId()
  return (
    <section className={`dash-panel ${className}`.trim()} aria-labelledby={titleId}>
      <div className="dash-panel-head">
        <h2 id={titleId} className="dash-panel-title">
          {title}
        </h2>
        {meta && <div className="dash-panel-meta">{meta}</div>}
      </div>
      {children}
    </section>
  )
}
