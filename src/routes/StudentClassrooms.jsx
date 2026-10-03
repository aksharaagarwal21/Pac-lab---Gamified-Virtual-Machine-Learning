import { useCallback, useEffect, useState } from 'react'
import { DoorOpen, LogIn, Mail, Users } from 'lucide-react'
import { MazeShell } from '../components/maze/MazeShell.jsx'
import { CODE_LENGTH, isJoinCode, normalizeJoinCode } from '../lib/classrooms.js'
import { studentFetch } from '../lib/studentApi.js'
import { usePageMeta } from '../meta.js'
import { say, sfx } from '../sound.js'

const formatDate = (value) => new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

function JoinWithCode({ onJoined }) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  const submit = async (event) => {
    event.preventDefault()
    const code = normalizeJoinCode(value)
    if (!isJoinCode(code)) {
      setMessage({ error: true, text: `Class codes have ${CODE_LENGTH} letters and digits. Check the code from your teacher.` })
      sfx.denied()
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      const { classroom, alreadyMember } = await studentFetch(`/join/${code}`, { method: 'POST' })
      setValue('')
      setMessage({ text: alreadyMember ? `You are already in ${classroom.name}.` : `You joined ${classroom.name}.` })
      sfx.coin()
      say(alreadyMember ? 'Already joined.' : 'Joined. Welcome to the class.')
      onJoined()
    } catch (joinError) {
      setMessage({ error: true, text: joinError.message })
      sfx.denied()
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="cr-code-form" onSubmit={submit} noValidate>
      <label htmlFor="cr-join-code">Class code</label>
      <div className="cr-code-row">
        <input
          id="cr-join-code"
          className="lab-input cr-code-input"
          type="text"
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            setMessage(null)
          }}
          placeholder="e.g. K7M2QXP"
          maxLength={CODE_LENGTH + 4}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-describedby="cr-join-code-note"
        />
        <button type="submit" className="lab-btn lab-btn-primary" disabled={busy || !value.trim()}>
          <LogIn aria-hidden="true" />
          {busy ? 'Joining…' : 'Join'}
        </button>
      </div>
      <small id="cr-join-code-note" className={`cr-message${message?.error ? ' is-error' : ''}`} role={message ? (message.error ? 'alert' : 'status') : undefined}>
        {message?.text ?? 'Your teacher shares the code in class or in the invite email.'}
      </small>
    </form>
  )
}

function ClassroomCard({ classroom, onLeave }) {
  const [leaving, setLeaving] = useState(false)

  const leave = async () => {
    if (!window.confirm(`Leave ${classroom.name}? You can join again with the code while the classroom is open.`)) return
    setLeaving(true)
    try {
      await studentFetch(`/classrooms/${classroom.id}`, { method: 'DELETE' })
      sfx.back()
      onLeave()
    } catch {
      setLeaving(false)
      sfx.denied()
    }
  }

  return (
    <li className="fc-class-card cr-card is-static">
      <span className="fc-class-top">
        <span className="fc-class-code">{classroom.section}</span>
        <span className="lab-pill">Code {classroom.code}</span>
      </span>
      <span className="cr-card-name">{classroom.name}</span>
      <span className="fc-class-meta">{classroom.departmentName}</span>
      {classroom.description && <p className="cr-card-text">{classroom.description}</p>}
      <span className="cr-card-teacher">
        <span>{classroom.teacher.name}</span>
        <a href={`mailto:${classroom.teacher.email}`} className="fc-link">
          <Mail aria-hidden="true" />
          Email teacher
        </a>
      </span>
      <span className="fc-class-foot">
        <span>
          <Users aria-hidden="true" className="cr-inline-icon" />
          {classroom.members} student{classroom.members === 1 ? '' : 's'} joined
        </span>
        <span>You joined {formatDate(classroom.joinedAt)}</span>
      </span>
      <button type="button" className="lab-btn cr-small" onClick={leave} disabled={leaving}>
        <DoorOpen aria-hidden="true" />
        {leaving ? 'Leaving…' : 'Leave classroom'}
      </button>
    </li>
  )
}

export default function StudentClassrooms() {
  const [state, setState] = useState({ classrooms: null, error: null })

  usePageMeta('My Classrooms | ML Virtual Lab', 'The classrooms you joined, and joining a new one with a class code.')

  const load = useCallback(() => {
    studentFetch('/classrooms').then(
      ({ classrooms }) => setState({ classrooms, error: null }),
      (error) => setState((current) => ({ ...current, error })),
    )
  }, [])

  useEffect(() => {
    load()
    say('Your classrooms.')
  }, [load])

  const { classrooms, error } = state

  return (
    <MazeShell>
      <main className="mz-container lab-page hm-page cr-page">
        <section className="fc-hero" aria-labelledby="cr-mine-title">
          <div>
            <p className="hm-kicker">CLASSROOMS</p>
            <h1 id="cr-mine-title" className="fc-hero-title">
              My classrooms
            </h1>
            <p className="fc-hero-lead">Open the link in your teacher's invite email, or type the class code here.</p>
          </div>
          <JoinWithCode onJoined={load} />
        </section>

        {error && !classrooms ? (
          <div className="fc-state is-error" role="alert">
            <p className="hm-panel-title">Could not load your classrooms</p>
            <p className="lab-muted">{error.message}</p>
          </div>
        ) : !classrooms ? (
          <div className="fc-state" role="status">
            <span className="fc-loader" aria-hidden="true" />
            <p className="lab-muted">Loading classrooms…</p>
          </div>
        ) : classrooms.length ? (
          <ul className="fc-class-grid">
            {classrooms.map((classroom) => (
              <ClassroomCard key={classroom.id} classroom={classroom} onLeave={load} />
            ))}
          </ul>
        ) : (
          <div className="fc-state">
            <p className="hm-panel-title">No classrooms yet</p>
            <p className="lab-muted">When your teacher sends a classroom invite, open its link or enter the class code above.</p>
          </div>
        )}
      </main>
    </MazeShell>
  )
}
