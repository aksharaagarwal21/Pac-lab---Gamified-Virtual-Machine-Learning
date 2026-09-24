import { useEffect, useId, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { facultyFetch } from '../../lib/facultyApi.js'
import { sfx } from '../../sound.js'

// Type a name, roll number or class code and jump straight to it.
export function QuickSearch() {
  const navigate = useNavigate()
  const listId = useId()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState({ students: [], classes: [] })
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  useEffect(() => {
    const text = query.trim()
    if (text.length < 2) {
      setResults({ students: [], classes: [] })
      setLoading(false)
      return undefined
    }
    let cancelled = false
    setLoading(true)
    const timer = setTimeout(() => {
      facultyFetch(`/search?q=${encodeURIComponent(text)}`)
        .then((data) => {
          if (cancelled) return
          setResults(data)
          setActive(0)
        })
        .catch(() => {})
        .finally(() => !cancelled && setLoading(false))
    }, 180)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query])

  const options = [
    ...results.classes.map((c) => ({
      key: `class-${c.code}`,
      kind: 'class',
      label: c.code,
      sub: c.departmentName,
      go: () => navigate({ to: '/faculty/class/$classCode', params: { classCode: c.code } }),
    })),
    ...results.students.map((s) => ({
      key: `student-${s.id}`,
      kind: 'student',
      label: s.name,
      sub: `${s.id} · ${s.className}`,
      go: () => navigate({ to: '/faculty/student/$studentId', params: { studentId: s.id } }),
    })),
  ]
  const showList = open && query.trim().length >= 2

  const choose = (option) => {
    sfx.enter()
    setOpen(false)
    setQuery('')
    option.go()
  }

  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActive((index) => Math.min(options.length - 1, index + 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) => Math.max(0, index - 1))
    } else if (event.key === 'Enter' && showList && options[active]) {
      event.preventDefault()
      choose(options[active])
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div
      className="fc-quick"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <label className="fc-search fc-quick-input">
        <Search aria-hidden="true" />
        <span className="mz-sr-only">Find a student or class</span>
        <input
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && options[active] ? `${listId}-option-${active}` : undefined}
          placeholder="Find a student or class…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
      </label>
      {showList && (
        <ul id={listId} role="listbox" className="fc-quick-list" aria-label="Search results">
          {options.map((option, index) => (
            <li
              key={option.key}
              id={`${listId}-option-${index}`}
              role="option"
              aria-selected={index === active}
              className={`fc-quick-option${index === active ? ' is-active' : ''}`}
              onMouseEnter={() => setActive(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(option)}
            >
              <span className={`fc-quick-kind is-${option.kind}`}>{option.kind === 'class' ? 'CLASS' : 'STUDENT'}</span>
              <span>
                <strong>{option.label}</strong>
                <small>{option.sub}</small>
              </span>
            </li>
          ))}
          {!options.length && <li className="fc-quick-empty">{loading ? 'Searching…' : 'No students or classes match.'}</li>}
        </ul>
      )}
    </div>
  )
}
