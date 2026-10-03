import { Link } from '@tanstack/react-router'
import { ChevronRight, Coins, Crown, Flag, FlaskConical, Footprints, Medal, Star, Target } from 'lucide-react'

export const BADGE_ICONS = { Footprints, Flag, FlaskConical, Star, Target, Medal, Coins, Crown }

export const STATUS_META = {
  excelling: { label: 'Excelling', hint: 'Cleared almost everything with strong posttest scores.' },
  on_track: { label: 'On track', hint: 'Progressing steadily.' },
  attention: { label: 'Needs attention', hint: 'Failed a posttest, low scores, or far behind the class.' },
  inactive: { label: 'Inactive', hint: 'No activity for 14 days or more.' },
}

export const STATUS_ORDER = ['excelling', 'on_track', 'attention', 'inactive']

export const formatNumber = (value) => Number(value ?? 0).toLocaleString('en-IN')
export const formatPercent = (ratio, digits = 0) => (ratio === null || ratio === undefined ? '—' : `${(ratio * 100).toFixed(digits)}%`)

export function timeAgo(value) {
  if (!value) return 'Never'
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 6e4)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  const months = Math.round(days / 30)
  return `${months} month${months === 1 ? '' : 's'} ago`
}

export const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—'

export function StatusPill({ status }) {
  const meta = STATUS_META[status] ?? STATUS_META.on_track
  return (
    <span className={`fc-status is-${status}`} title={meta.hint}>
      {meta.label}
    </span>
  )
}

export function MiniMeter({ value, max, label }) {
  const ratio = max ? Math.min(1, value / max) : 0
  return (
    <span className="fc-mini" role="img" aria-label={label ?? `${value} of ${max}`}>
      <span className="fc-mini-bar">
        <span style={{ width: `${ratio * 100}%` }} />
      </span>
      <span className="fc-mini-text">
        {value}/{max}
      </span>
    </span>
  )
}

export function Breadcrumbs({ items }) {
  return (
    <nav className="fc-crumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((item, index) => (
          <li key={item.label}>
            {item.to ? (
              <Link to={item.to} params={item.params}>
                {item.label}
              </Link>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
            {index < items.length - 1 && <ChevronRight aria-hidden="true" />}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export function LoadState({ error, what }) {
  if (!error) {
    return (
      <div className="fc-state" role="status">
        <span className="fc-loader" aria-hidden="true" />
        <p className="lab-muted">Loading {what}…</p>
      </div>
    )
  }
  return (
    <div className="fc-state is-error" role="alert">
      <p className="hm-panel-title">{error.status === 404 ? 'Not found' : error.status === 401 ? 'Session ended' : 'Could not load data'}</p>
      <p className="lab-muted">{error.message}</p>
      {error.status === 401 ? (
        <Link to="/login/faculty" className="lab-btn lab-btn-primary">
          Sign in again
        </Link>
      ) : (
        <Link to="/faculty" className="lab-btn">
          Back to classes
        </Link>
      )}
    </div>
  )
}

// A labelled form control; the hint or error below it has the id `${id}-note` for aria-describedby.
export function Field({ id, label, error, hint, children }) {
  return (
    <div className={`cr-field${error ? ' is-invalid' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {(error || hint) && (
        <small id={`${id}-note`} className={error ? 'cr-field-error' : 'cr-field-hint'}>
          {error ?? hint}
        </small>
      )}
    </div>
  )
}
