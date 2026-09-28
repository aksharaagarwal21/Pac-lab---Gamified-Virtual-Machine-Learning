import { useEffect, useId, useRef, useState } from 'react'
import { Info } from 'lucide-react'

// Small accessible controls shared by the interactive simulations.

// A term explanation: shows on hover or keyboard focus, toggles on tap, closes with Escape.
export function InfoTip({ label, children, align = 'center' }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  return (
    <span className={`ix-tip is-${align}${open ? ' is-open' : ''}`} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        className="ix-tip-btn"
        aria-label={label}
        aria-describedby={id}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}
      >
        <Info aria-hidden="true" />
      </button>
      <span role="tooltip" id={id} className="ix-tip-bubble">
        {children}
      </span>
    </span>
  )
}

// Numeric input that never commits invalid values. Valid in-range edits are applied live;
// out-of-range numbers are clamped when the field loses focus; anything else reverts.
export function NumberField({ label, value, onChange, min = -Infinity, max = Infinity, step = 0.1, digits = 2, disabled = false, compact = false, hideLabel = false }) {
  const id = useId()
  const [draft, setDraft] = useState(() => format(value, digits))
  const [error, setError] = useState(null)
  const focused = useRef(false)
  const emitted = useRef(value)

  // Show outside changes (e.g. dragging on the graph) even while focused, but never
  // overwrite what the student is typing with the value they just produced.
  useEffect(() => {
    if (!focused.current || Math.abs(value - emitted.current) > 1e-6) {
      emitted.current = value
      setDraft(format(value, digits))
      setError(null)
    }
  }, [value, digits])

  const emit = (number) => {
    emitted.current = number
    onChange(number)
  }

  const parse = (text) => {
    const cleaned = text.trim().replace(/−/g, '-').replace(',', '.')
    if (cleaned === '' || cleaned === '-' || cleaned === '.') return null
    const number = Number(cleaned)
    return Number.isFinite(number) ? number : null
  }

  const edit = (text) => {
    setDraft(text)
    const number = parse(text)
    if (number == null) return setError('Enter a number')
    if (number < min || number > max) return setError(`Use ${format(min, 0)} to ${format(max, 0)}`)
    setError(null)
    emit(number)
  }

  const commit = () => {
    focused.current = false
    const number = parse(draft)
    if (number != null && (number < min || number > max)) {
      const clamped = Math.min(max, Math.max(min, number))
      emit(clamped)
      setDraft(format(clamped, digits))
    } else {
      setDraft(format(value, digits))
    }
    setError(null)
  }

  return (
    <span className={`ix-number${compact ? ' is-compact' : ''}${error ? ' is-invalid' : ''}`}>
      <label htmlFor={id} className={hideLabel ? 'mz-sr-only' : undefined}>
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck="false"
        value={draft}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onFocus={(event) => {
          focused.current = true
          event.target.select()
        }}
        onChange={(event) => edit(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault()
            const next = Math.min(max, Math.max(min, Number(((parse(draft) ?? value) + (event.key === 'ArrowUp' ? step : -step)).toFixed(6))))
            setDraft(format(next, digits))
            setError(null)
            emit(next)
          }
        }}
      />
      {error && (
        <span id={`${id}-error`} className="ix-number-error" role="alert">
          {error}
        </span>
      )}
    </span>
  )
}

const format = (value, digits) => (Number.isFinite(value) ? value.toFixed(digits) : '')

// A radio-style group of buttons (e.g. interaction modes).
export function SegmentedControl({ label, value, options, onChange }) {
  const refs = useRef([])
  const move = (index) => {
    const option = options[(index + options.length) % options.length]
    onChange(option.value)
    refs.current[(index + options.length) % options.length]?.focus()
  }
  return (
    <div className="ix-segmented" role="radiogroup" aria-label={label}>
      {options.map((option, index) => {
        const Icon = option.icon
        const checked = option.value === value
        return (
          <button
            key={option.value}
            ref={(node) => (refs.current[index] = node)}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            className="ix-segment"
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                event.preventDefault()
                move(index + 1)
              } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                event.preventDefault()
                move(index - 1)
              }
            }}
          >
            {Icon && <Icon aria-hidden="true" />}
            <span>{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// An on/off chip for view layers such as residuals.
export function ToggleChip({ label, checked, onChange, icon: Icon, disabled = false }) {
  return (
    <button type="button" className="ix-chip" aria-pressed={checked} disabled={disabled} onClick={() => onChange(!checked)}>
      {Icon && <Icon aria-hidden="true" />}
      {label}
    </button>
  )
}
