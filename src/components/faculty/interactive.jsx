import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearch } from '@tanstack/react-router'
import { X } from 'lucide-react'
import { sfx } from '../../sound.js'
import './faculty-sections.css'

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// ---------- Sections: headings at the top of the page, one visible section at a time ----------

// The open section lives in ?tab= so refresh, back and shared links reopen the same section.
export function useSectionTab(ids) {
  const search = useSearch({ strict: false })
  const location = useLocation()
  const navigate = useNavigate()
  const tab = ids.includes(search.tab) ? search.tab : ids[0]
  const setTab = useCallback(
    (next) => navigate({ to: location.pathname, search: (previous) => ({ ...previous, tab: next }), replace: true, resetScroll: false }),
    [navigate, location.pathname],
  )
  return [tab, setTab]
}

export function SectionTabs({ idBase, label, sections, active, onChange, context, actions }) {
  const sentinelRef = useRef(null)
  const listRef = useRef(null)
  const [indicator, setIndicator] = useState(null)
  const layoutKey = sections.map((section) => `${section.id}:${section.count ?? ''}`).join('|')

  useLayoutEffect(() => {
    const list = listRef.current
    const update = () => {
      const button = list?.querySelector('[aria-selected="true"]')
      if (!button) return
      setIndicator({ left: button.offsetLeft, width: button.offsetWidth })
      if (button.offsetLeft < list.scrollLeft) list.scrollLeft = button.offsetLeft - 12
      else if (button.offsetLeft + button.offsetWidth > list.scrollLeft + list.clientWidth) {
        list.scrollLeft = button.offsetLeft + button.offsetWidth - list.clientWidth + 12
      }
    }
    update()
    document.fonts?.ready?.then(update)
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [active, layoutKey])

  const change = (id) => {
    if (id === active) return
    sfx.select()
    onChange(id)
    // If the reader has scrolled into a long section, bring the new one to the top.
    const start = sentinelRef.current?.offsetTop ?? 0
    if (window.scrollY > start) window.scrollTo({ top: start, behavior: reducedMotion() ? 'auto' : 'smooth' })
  }

  const onKeyDown = (event) => {
    const index = sections.findIndex((section) => section.id === active)
    const targets = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: sections.length - 1 }
    if (!(event.key in targets)) return
    event.preventDefault()
    const next = sections[(targets[event.key] + sections.length) % sections.length]
    change(next.id)
    document.getElementById(`${idBase}-tab-${next.id}`)?.focus()
  }

  return (
    <>
      <div ref={sentinelRef} aria-hidden="true" />
      <div className="fc-sections">
        <div className="mz-container fc-sections-inner">
          {context && <span className="fc-sections-context">{context}</span>}
          <div className="fc-sections-list" role="tablist" aria-label={label} ref={listRef} onKeyDown={onKeyDown}>
            {sections.map(({ id, label: text, icon: Icon, count, tone }) => (
              <button
                key={id}
                id={`${idBase}-tab-${id}`}
                type="button"
                role="tab"
                aria-selected={active === id}
                aria-controls={`${idBase}-panel`}
                tabIndex={active === id ? 0 : -1}
                className={`fc-section-tab${tone ? ` is-${tone}` : ''}`}
                onClick={() => change(id)}
              >
                {Icon && <Icon aria-hidden="true" />}
                <span>{text}</span>
                {count !== undefined && count !== null && <span className="fc-section-count">{count}</span>}
              </button>
            ))}
            {indicator && <span className="fc-sections-indicator" style={{ transform: `translateX(${indicator.left}px)`, width: indicator.width }} aria-hidden="true" />}
          </div>
          {actions && <div className="fc-sections-actions">{actions}</div>}
        </div>
      </div>
    </>
  )
}

export function SectionPanel({ idBase, active, children }) {
  return (
    <div key={active} id={`${idBase}-panel`} role="tabpanel" aria-labelledby={`${idBase}-tab-${active}`} className="fc-section-panel">
      {children}
    </div>
  )
}

// ---------- Animated numbers ----------

export function CountUp({ value, format = (v) => Math.round(v).toLocaleString('en-IN'), duration = 900 }) {
  const [shown, setShown] = useState(() => (reducedMotion() ? value : 0))
  const fromRef = useRef(0)

  useEffect(() => {
    if (reducedMotion()) {
      setShown(value)
      fromRef.current = value
      return undefined
    }
    const from = fromRef.current
    const start = performance.now()
    let frame
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const current = from + (value - from) * (1 - (1 - t) ** 3)
      fromRef.current = current
      setShown(current)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, duration])

  return <>{format(shown)}</>
}

// ---------- Ranked bars that slide into their new order when the metric changes ----------

export function RankRace({ items, format, label }) {
  const rowRefs = useRef(new Map())
  const previousTops = useRef(new Map())
  const sorted = [...items].sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
  const max = Math.max(1e-9, ...items.map((item) => item.value))

  useLayoutEffect(() => {
    rowRefs.current.forEach((element, key) => {
      if (!element) return
      const top = element.offsetTop
      const previous = previousTops.current.get(key)
      if (previous !== undefined && previous !== top && !reducedMotion() && element.animate) {
        element.animate([{ transform: `translateY(${previous - top}px)` }, { transform: 'translateY(0)' }], { duration: 480, easing: 'cubic-bezier(.2,.8,.2,1)' })
      }
      previousTops.current.set(key, top)
    })
  })

  return (
    <ol className="fc-race" aria-label={label}>
      {sorted.map((item, index) => (
        <li
          key={item.key}
          ref={(element) => {
            if (element) rowRefs.current.set(item.key, element)
            else rowRefs.current.delete(item.key)
          }}
          className={`fc-race-row${index < 3 ? ` is-top is-${index + 1}` : ''}${item.highlight ? ' is-highlight' : ''}`}
        >
          <span className="fc-race-rank">{index + 1}</span>
          <span className="fc-race-main">
            <span className="fc-race-title">{item.title}</span>
            <span className="fc-race-bar" aria-hidden="true">
              <span style={{ width: `${(Math.max(0, item.value) / max) * 100}%` }} />
            </span>
            {item.meta && <span className="fc-race-meta">{item.meta}</span>}
          </span>
          <span className="fc-race-value">{format(item.value)}</span>
        </li>
      ))}
    </ol>
  )
}

// ---------- Side drawer for quick previews ----------

export function Drawer({ open, title, onClose, children, footer }) {
  const panelRef = useRef(null)
  const closeRef = useRef(null)
  const onCloseRef = useRef(onClose)
  const titleId = useId()
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return undefined
    const previous = document.activeElement
    closeRef.current?.focus()
    const onKey = (event) => {
      if (event.key === 'Escape') onCloseRef.current()
      if (event.key !== 'Tab' || !panelRef.current) return
      const focusable = [...panelRef.current.querySelectorAll('a[href], button:not([disabled]), [tabindex="0"]')]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fc-drawer-layer">
      <div className="fc-drawer-backdrop" onClick={() => onCloseRef.current()} aria-hidden="true" />
      <aside ref={panelRef} className="fc-drawer" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="fc-drawer-head">
          <h2 id={titleId} className="hm-panel-title">
            {title}
          </h2>
          <button ref={closeRef} type="button" className="fc-icon-btn" aria-label="Close preview" onClick={() => onCloseRef.current()}>
            <X aria-hidden="true" />
          </button>
        </header>
        <div className="fc-drawer-body">{children}</div>
        {footer && <footer className="fc-drawer-foot">{footer}</footer>}
      </aside>
    </div>
  )
}

// ---------- Donut chart with selectable slices ----------

export function StatusDonut({ segments, total, centerLabel, onSelect }) {
  const [focus, setFocus] = useState(null)
  const radius = 70
  const circumference = 2 * Math.PI * radius
  const focused = segments.find((segment) => segment.key === focus)
  let offset = 0

  return (
    <div className="fc-donut">
      <svg viewBox="0 0 200 200" role="img" aria-label={segments.map((segment) => `${segment.label}: ${segment.value}`).join(', ')}>
        <circle cx="100" cy="100" r={radius} fill="none" stroke="#111d36" strokeWidth="26" />
        {segments.map((segment) => {
          const length = total ? (segment.value / total) * circumference : 0
          const slice = (
            <circle
              key={segment.key}
              className={`fc-donut-seg${focus === segment.key ? ' is-focus' : ''}`}
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth="26"
              strokeDasharray={`${Math.max(0, length - 2)} ${circumference}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 100 100)"
              onMouseEnter={() => setFocus(segment.key)}
              onMouseLeave={() => setFocus(null)}
              onClick={() => onSelect?.(segment.key)}
            />
          )
          offset += length
          return slice
        })}
        <text x="100" y="98" textAnchor="middle" className="fc-donut-num">
          {focused ? focused.value : total}
        </text>
        <text x="100" y="120" textAnchor="middle" className="fc-donut-label">
          {focused ? focused.label : centerLabel}
        </text>
      </svg>
      <ul className="fc-donut-legend">
        {segments.map((segment) => (
          <li key={segment.key}>
            <button
              type="button"
              className={focus === segment.key ? 'is-focus' : undefined}
              onMouseEnter={() => setFocus(segment.key)}
              onMouseLeave={() => setFocus(null)}
              onFocus={() => setFocus(segment.key)}
              onBlur={() => setFocus(null)}
              onClick={() => onSelect?.(segment.key)}
            >
              <span className="fc-dot" style={{ background: segment.color }} aria-hidden="true" />
              <span>{segment.label}</span>
              <strong>{segment.value}</strong>
              <small>{total ? Math.round((segment.value / total) * 100) : 0}%</small>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------- Ten-step experiment track ----------

const TRACK_STATUS = { cleared: 'Cleared', in_progress: 'In progress', ready: 'Ready to start', locked: 'Locked' }

export function ExperimentTrack({ experiments, selected, onSelect }) {
  return (
    <ol className="fc-track" aria-label="Experiment track">
      {experiments.map((e) => {
        const text = `Experiment ${e.id}, ${e.title}: ${TRACK_STATUS[e.status]}${e.stars ? `, ${e.stars} stars` : ''}`
        const body = (
          <>
            <span className="fc-track-dot">{String(e.id).padStart(2, '0')}</span>
            <span className="fc-track-label">{e.mission}</span>
          </>
        )
        return (
          <li key={e.id} className={`fc-track-node is-${e.status}${selected === e.id ? ' is-selected' : ''}`}>
            {onSelect ? (
              <button type="button" aria-label={text} title={text} aria-pressed={selected === e.id} onClick={() => onSelect(e.id)}>
                {body}
              </button>
            ) : (
              <span title={text}>{body}</span>
            )}
          </li>
        )
      })}
    </ol>
  )
}
