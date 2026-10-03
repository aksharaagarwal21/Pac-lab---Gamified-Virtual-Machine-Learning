import { useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowRight, Plus, Presentation, X } from 'lucide-react'
import { FacultyShell } from '../../components/faculty/FacultyShell.jsx'
import { Field, LoadState, formatDate } from '../../components/faculty/facultyUi.jsx'
import { LIMITS, classroomErrors, normalizeClassroom } from '../../lib/classrooms.js'
import { facultyFetch, useFacultyData } from '../../lib/facultyApi.js'
import { usePageMeta } from '../../meta.js'
import { say, sfx } from '../../sound.js'

// Fields with a hint underneath (others only show a note when invalid).
const HINTED = new Set(['classCode', 'description'])

function CreateClassroom({ sections, onCancel }) {
  const navigate = useNavigate()
  const [values, setValues] = useState({ name: '', classCode: '', description: '' })
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const form = normalizeClassroom(values)
  const errors = touched ? classroomErrors(form) : {}
  const control = (name) => ({
    id: `cr-new-${name}`,
    name,
    value: values[name],
    'aria-invalid': Boolean(errors[name]),
    'aria-describedby': errors[name] || HINTED.has(name) ? `cr-new-${name}-note` : undefined,
    onChange: (event) => {
      const { value } = event.target
      setValues((current) => ({
        ...current,
        [name]: value,
        // Picking a section suggests a name the teacher can still change.
        ...(name === 'classCode' && value && !current.name.trim() ? { name: `ML Lab · ${value}` } : {}),
      }))
      setError(null)
    },
  })

  const submit = async (event) => {
    event.preventDefault()
    if (busy) return
    setTouched(true)
    if (Object.keys(classroomErrors(form)).length) {
      sfx.denied()
      return
    }
    setBusy(true)
    try {
      const { classroom } = await facultyFetch('/classrooms', { method: 'POST', body: form })
      sfx.coin()
      say('Classroom created.')
      navigate({ to: '/faculty/classrooms/$classroomId', params: { classroomId: String(classroom.id) } })
    } catch (createError) {
      setBusy(false)
      setError(createError.message)
      sfx.denied()
    }
  }

  return (
    <section className="hm-panel" aria-labelledby="cr-new-title">
      <div className="hm-panel-head">
        <h2 id="cr-new-title" className="hm-panel-title">
          New classroom
        </h2>
        {onCancel && (
          <button type="button" className="lab-btn" onClick={onCancel}>
            <X aria-hidden="true" />
            Cancel
          </button>
        )}
      </div>
      <form className="cr-form" onSubmit={submit} noValidate>
        <div className="cr-form-row">
          <Field id="cr-new-classCode" label="Section" error={errors.classCode} hint="Each section gets its own classroom.">
            <select className="lab-select" {...control('classCode')}>
              <option value="">Choose a section</option>
              {sections.map((s) => (
                <option key={s.code} value={s.code} disabled={s.taken}>
                  {s.code} · {s.departmentName} · {s.students} registered{s.taken ? ' (you have a classroom)' : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field id="cr-new-name" label="Classroom name" error={errors.name}>
            <input className="lab-input" type="text" maxLength={LIMITS.name} placeholder="ML Lab · AIML-A" autoComplete="off" {...control('name')} />
          </Field>
        </div>
        <Field id="cr-new-description" label="Description (optional)" error={errors.description} hint="Shown to students, e.g. lab timings or room.">
          <textarea className="lab-input cr-textarea" rows={2} maxLength={LIMITS.description} placeholder="Thursday 2–4 pm, Lab TP-204" {...control('description')} />
        </Field>
        <div className="lab-actions">
          <button type="submit" className="lab-btn lab-btn-primary" disabled={busy}>
            <Plus aria-hidden="true" />
            {busy ? 'Creating…' : 'Create classroom'}
          </button>
        </div>
        {error && (
          <p className="cr-message is-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </section>
  )
}

function ClassroomCard({ classroom }) {
  const share = classroom.sectionSize ? Math.min(1, classroom.members / classroom.sectionSize) : 0
  return (
    <li>
      <Link
        to="/faculty/classrooms/$classroomId"
        params={{ classroomId: String(classroom.id) }}
        className="fc-class-card cr-card"
        onClick={() => sfx.enter()}
      >
        <span className="fc-class-top">
          <span className="fc-class-code">{classroom.section}</span>
          <span className={`fc-flag ${classroom.isOpen ? 'is-active' : 'is-inactive'}`}>{classroom.isOpen ? 'Open to join' : 'Closed'}</span>
        </span>
        <span className="cr-card-name">{classroom.name}</span>
        <span className="fc-class-meta">
          {classroom.departmentName} · Semester {classroom.semester}
        </span>
        <span className="fc-class-figures">
          <span>
            <strong>{classroom.members}</strong>
            <small>Joined</small>
          </span>
          <span>
            <strong>{classroom.sectionSize}</strong>
            <small>In section</small>
          </span>
          <span>
            <strong>{classroom.invited}</strong>
            <small>Invited</small>
          </span>
        </span>
        <span className="fc-class-progress">
          <span className="fc-class-progress-top">
            <span>Section joined</span>
            <span>{Math.round(share * 100)}%</span>
          </span>
          <span className="lab-meter fc-anim-fill" aria-hidden="true">
            <span style={{ width: `${share * 100}%` }} />
          </span>
        </span>
        <span className="fc-class-foot">
          <span>
            Code <code className="cr-code-inline">{classroom.code}</code>
          </span>
          <span>Created {formatDate(classroom.createdAt)}</span>
        </span>
        <span className="fc-class-go" aria-hidden="true">
          Open classroom <ArrowRight />
        </span>
      </Link>
    </li>
  )
}

export default function FacultyClassrooms() {
  const { data, error } = useFacultyData('/classrooms')
  const [creating, setCreating] = useState(false)

  usePageMeta('Classrooms | Faculty Console', 'Create a classroom for each section, share its join link and invite students by email.')

  useEffect(() => {
    say('Classrooms.')
  }, [])

  const showForm = creating || data?.classrooms.length === 0

  return (
    <FacultyShell>
      <main className="mz-container lab-page hm-page fc-page">
        <section className="fc-hero" aria-labelledby="cr-title">
          <div>
            <p className="hm-kicker">FACULTY CONSOLE · CLASSROOMS</p>
            <h1 id="cr-title" className="fc-hero-title">
              Your classrooms
            </h1>
            <p className="fc-hero-lead">
              Open a classroom for a section, then email the invite to its students or share the join link. Students join with their PAC-LAB account and you
              can see who has joined.
            </p>
          </div>
          {data && !showForm ? (
            <button
              type="button"
              className="lab-btn lab-btn-primary"
              onClick={() => {
                setCreating(true)
                sfx.select()
              }}
            >
              <Plus aria-hidden="true" />
              New classroom
            </button>
          ) : (
            <Presentation className="fc-hero-icon" aria-hidden="true" />
          )}
        </section>

        {!data ? (
          <LoadState error={error} what="classrooms" />
        ) : (
          <>
            {showForm && <CreateClassroom sections={data.sections} onCancel={data.classrooms.length ? () => setCreating(false) : null} />}
            {data.classrooms.length > 0 && (
              <section className="hm-panel" aria-labelledby="cr-list-title">
                <div className="hm-panel-head">
                  <h2 id="cr-list-title" className="hm-panel-title">
                    Classrooms <span className="lab-pill">{data.classrooms.length}</span>
                  </h2>
                </div>
                <ul className="fc-class-grid">
                  {data.classrooms.map((classroom) => (
                    <ClassroomCard key={classroom.id} classroom={classroom} />
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
    </FacultyShell>
  )
}
