import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { CLASSES, saveClass } from '../data/classes.js'
import { normalizeRegistration, registrationErrors, RULES } from '../lib/registration.js'
import { studentFetch } from '../lib/studentApi.js'
import { usePageMeta } from '../meta.js'
import { adoptServerProgress } from '../progress.js'
import { signInStudent } from '../session.js'
import { say, sfx } from '../sound.js'

const EMPTY = { studentId: '', firstName: '', lastName: '', email: '', classCode: '', password: '', confirm: '' }

// Label names the field; the hint or error below it is linked with aria-describedby.
function Field({ label, name, error, hint, children }) {
  return (
    <div className={`auth-field${error ? ' is-invalid' : ''}`}>
      <label htmlFor={`reg-${name}`}>{label}</label>
      {children}
      {error ? (
        <small className="auth-field-error" id={`reg-${name}-note`}>
          {error}
        </small>
      ) : (
        hint && (
          <small className="auth-field-hint" id={`reg-${name}-note`}>
            {hint}
          </small>
        )
      )}
    </div>
  )
}

const HINTS = { studentId: true, password: true, classCode: true }

export default function StudentRegister() {
  const navigate = useNavigate()
  // Set when the student came from a classroom invite link: their class is that classroom's section.
  const { join } = useSearch({ strict: false })
  const [joining, setJoining] = useState(null)
  const [values, setValues] = useState(EMPTY)
  const [touched, setTouched] = useState({})
  const [classes, setClasses] = useState(null)
  const [classError, setClassError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  usePageMeta('Register | PAC-LAB', 'Create a PAC-LAB student account and start the machine learning maze.')

  useEffect(() => {
    say('New player. Enter your details.')
    studentFetch('/classes')
      .then(({ classes: list }) => setClasses(list))
      .catch((fetchError) => setClassError(fetchError.message))
  }, [])

  useEffect(() => {
    if (!join) return
    studentFetch(`/join/${join}`)
      .then(({ classroom }) => {
        setJoining(classroom)
        setValues((current) => (current.classCode ? current : { ...current, classCode: classroom.section }))
      })
      .catch(() => {})
  }, [join])

  const form = normalizeRegistration(values)
  const errors = registrationErrors(form)
  if (values.confirm !== values.password) errors.confirm = 'Passwords do not match.'
  const shown = (name) => (touched[name] || touched.all ? errors[name] : undefined)

  const update = (event) => {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    setError(null)
  }
  const blur = (event) => setTouched((current) => ({ ...current, [event.target.name]: true }))
  const input = (name) => ({
    id: `reg-${name}`,
    name,
    value: values[name],
    onChange: update,
    onBlur: blur,
    'aria-invalid': Boolean(shown(name)),
    'aria-describedby': shown(name) || HINTS[name] ? `reg-${name}-note` : undefined,
  })

  const submit = async (event) => {
    event.preventDefault()
    if (submitting) return
    setTouched({ all: true })
    if (Object.keys(errors).length) {
      sfx.denied()
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const { token, student, state } = await studentFetch('/register', { method: 'POST', body: form })
      signInStudent(student.id, { token, name: student.name, className: student.className })
      await adoptServerProgress(state)
      if (CLASSES.includes(student.className)) saveClass(student.id, student.className)
      sfx.coin()
      say(`Welcome to the maze, ${form.firstName}.`)
      setTimeout(() => navigate(join ? { to: '/join/$code', params: { code: join } } : { to: '/student' }), 900)
    } catch (registerError) {
      setSubmitting(false)
      setError(registerError.message || 'Registration failed.')
      sfx.denied()
      say('Registration failed.')
    }
  }

  return (
    <main className="arcade-shell">
      <header className="arcade-header">
        <span className="header-mark" aria-hidden="true" />
        <span>PAC-LAB // NEW PLAYER</span>
        <span className="status-light">REGISTER</span>
      </header>

      <section className="auth-stage">
        <div className="auth-card auth-card-student auth-card-wide">
          <div className="auth-card-head">
            <span className="pacman player-avatar" aria-hidden="true" />
            <div>
              <h1 className="auth-title">NEW PLAYER</h1>
              <p className="auth-subtitle">CREATE YOUR STUDENT ACCOUNT</p>
              {joining && <p className="auth-subtitle cr-joining">THEN JOIN: {joining.name.toUpperCase()}</p>}
            </div>
          </div>

          <form className="auth-form" onSubmit={submit} noValidate>
            <Field label="ROLL NUMBER" name="studentId" error={shown('studentId')} hint="Your college roll number, e.g. ML-2026-123">
              <input type="text" placeholder="ML-2026-123" autoComplete="username" autoCapitalize="characters" maxLength={16} required {...input('studentId')} />
            </Field>

            <div className="auth-row">
              <Field label="FIRST NAME" name="firstName" error={shown('firstName')}>
                <input type="text" placeholder="Riya" autoComplete="given-name" maxLength={40} required {...input('firstName')} />
              </Field>
              <Field label="LAST NAME" name="lastName" error={shown('lastName')}>
                <input type="text" placeholder="Kapoor" autoComplete="family-name" maxLength={40} required {...input('lastName')} />
              </Field>
            </div>

            <Field label="EMAIL" name="email" error={shown('email')}>
              <input type="email" placeholder="you@college.edu" autoComplete="email" maxLength={120} required {...input('email')} />
            </Field>

            <Field label="CLASS" name="classCode" error={shown('classCode') ?? classError} hint={classes ? undefined : 'Loading classes…'}>
              <select required disabled={!classes} {...input('classCode')}>
                <option value="">{classes ? 'Choose your class' : '…'}</option>
                {classes?.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} · {c.department} · Semester {c.semester}
                  </option>
                ))}
              </select>
            </Field>

            <div className="auth-row">
              <Field label="PASSWORD" name="password" error={shown('password')} hint={`${RULES.passwordMin}+ characters`}>
                <input type="password" placeholder="••••••••" autoComplete="new-password" maxLength={RULES.passwordMax} required {...input('password')} />
              </Field>
              <Field label="CONFIRM" name="confirm" error={shown('confirm')}>
                <input type="password" placeholder="••••••••" autoComplete="new-password" maxLength={RULES.passwordMax} required {...input('confirm')} />
              </Field>
            </div>

            <button className="arcade-button auth-submit" type="submit" disabled={submitting}>
              CREATE PLAYER
            </button>
            {submitting && <p className="auth-note">NEW PLAYER CREATED // LOADING LAB...</p>}
            {error && (
              <p className="auth-note is-error" role="alert">
                {error}
              </p>
            )}
          </form>

          <div className="auth-links">
            <Link to="/login/student" search={join ? { join } : {}}>
              HAVE AN ACCOUNT? SIGN IN
            </Link>
            <Link to="/">BACK TO TITLE</Link>
          </div>
        </div>
      </section>

      <footer className="arcade-footer">
        <span>© 2026 PAC-LAB</span>
        <span>INSERT COIN TO JOIN</span>
      </footer>
    </main>
  )
}
