import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { Link2, Lock, LockOpen, Mail, MailCheck, Pencil, RefreshCw, Search, Send, Trash2, UserMinus, UserPlus, Users } from 'lucide-react'
import { CopyButton } from '../../components/CopyButton.jsx'
import { FacultyShell } from '../../components/faculty/FacultyShell.jsx'
import { Breadcrumbs, Field, LoadState, timeAgo } from '../../components/faculty/facultyUi.jsx'
import { CountUp } from '../../components/faculty/interactive.jsx'
import { LIMITS, canReceiveMail, classroomErrors, joinPath, normalizeClassroom, parseEmails } from '../../lib/classrooms.js'
import { facultyFetch, useFacultyData } from '../../lib/facultyApi.js'
import { usePageMeta } from '../../meta.js'
import { say, sfx } from '../../sound.js'

const STATUS = { joined: 'Joined', invited: 'Invited', not_invited: 'Not invited' }
const STATUS_ORDER = { joined: 0, invited: 1, not_invited: 2 }
const ROWS = 60

const plural = (count, word, many = `${word}s`) => `${count} ${count === 1 ? word : many}`
const joinLink = (code) => `${window.location.origin}${joinPath(code)}`

// Compose links with every student in Bcc, for teachers sending the invite themselves.
function composeLinks(recipients, { subject, text }) {
  const bcc = recipients.join(',')
  const query = (fields) =>
    Object.entries(fields)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&')
  return {
    mailto: `mailto:?${query({ bcc, subject, body: text })}`,
    gmail: `https://mail.google.com/mail/?${query({ view: 'cm', fs: '1', bcc, su: subject, body: text })}`,
  }
}

function ClassroomHead({ classroom }) {
  const link = joinLink(classroom.code)
  return (
    <section className="fc-class-head" aria-labelledby="cr-room-title">
      <div className="cr-head-text">
        <p className="hm-kicker">
          {classroom.section} · {classroom.departmentName}
        </p>
        <h1 id="cr-room-title" className="fc-hero-title">
          {classroom.name}
        </h1>
        <p className="fc-hero-lead">{classroom.description || `Semester ${classroom.semester}`}</p>
        <span className={`fc-flag ${classroom.isOpen ? 'is-active' : 'is-inactive'}`}>
          {classroom.isOpen ? 'Open: students can join' : 'Closed to new students'}
        </span>
      </div>
      <div className="cr-join-card">
        <span className="lab-muted">Class code</span>
        <strong className="cr-code">{classroom.code}</strong>
        <code className="cr-link">{link}</code>
        <div className="cr-join-actions">
          <CopyButton text={link} label="Copy link" icon={Link2} />
          <CopyButton text={classroom.code} label="Copy code" />
        </div>
      </div>
    </section>
  )
}

function InviteResult({ result }) {
  const notes = []
  if (result.skipped) notes.push(`${plural(result.skipped, 'sample address', 'sample addresses')} on a test domain skipped (they cannot receive email).`)
  if (result.invalid.length) notes.push(`Not valid, skipped: ${result.invalid.join(', ')}`)
  const noteList = notes.map((note) => (
    <small key={note} className="lab-muted">
      {note}
    </small>
  ))

  if (result.emailed) {
    return (
      <div className="cr-result" role="status">
        <MailCheck aria-hidden="true" />
        <div>
          <strong>Invite emailed to {plural(result.emailed, 'student')}.</strong>
          {noteList}
        </div>
      </div>
    )
  }

  const links = composeLinks(result.recipients, result.message)
  return (
    <div className="cr-result" role="status">
      <Mail aria-hidden="true" />
      <div>
        <strong>Invite ready for {plural(result.invited, 'address', 'addresses')}.</strong>
        <p className="lab-muted">Send it from your own email, with the students in Bcc so they do not see each other's addresses.</p>
        <div className="cr-result-actions">
          <a className="lab-btn lab-btn-primary" href={links.gmail} target="_blank" rel="noreferrer">
            <Send aria-hidden="true" />
            Open in Gmail
          </a>
          <a className="lab-btn" href={links.mailto}>
            <Mail aria-hidden="true" />
            Open in email app
          </a>
          <CopyButton text={result.recipients.join(', ')} label="Copy addresses" />
          <CopyButton text={`${result.message.subject}\n\n${result.message.text}`} label="Copy message" />
        </div>
        <small className="lab-muted">If some addresses are missing in the email that opens, use Copy addresses and paste them into Bcc.</small>
        <details className="cr-preview">
          <summary>Preview the message</summary>
          <pre>{`Subject: ${result.message.subject}\n\n${result.message.text}`}</pre>
        </details>
        {noteList}
      </div>
    </div>
  )
}

function InvitePanel({ classroom, roster, mailEnabled, onInvited }) {
  const [includeSection, setIncludeSection] = useState(true)
  const [emails, setEmails] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const parsed = useMemo(() => parseEmails(emails), [emails])
  const joined = new Set(roster.filter((p) => p.status === 'joined').map((p) => p.email))
  const waiting = roster.filter((p) => p.inSection && p.status !== 'joined')
  const reachable = waiting.filter((p) => canReceiveMail(p.email))
  const samples = waiting.length - reachable.length
  // Same rules as the server: no one who already joined, no reserved test domains.
  const recipients = new Set([...(includeSection ? reachable.map((p) => p.email) : []), ...parsed.valid.filter((email) => !joined.has(email) && canReceiveMail(email))])

  const submit = async (event) => {
    event.preventDefault()
    if (busy || !recipients.size) return
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const data = await facultyFetch(`/classrooms/${classroom.id}/invite`, { method: 'POST', body: { section: includeSection, emails, send: mailEnabled } })
      setResult(data)
      setEmails('')
      sfx.coin()
      say(mailEnabled ? 'Invites sent.' : 'Invite ready.')
      onInvited()
    } catch (inviteError) {
      setError(inviteError.message)
      sfx.denied()
    } finally {
      setBusy(false)
    }
  }

  const emailHint = parsed.valid.length
    ? `${plural(parsed.valid.length, 'address', 'addresses')} found${parsed.invalid.length ? ` · not valid: ${parsed.invalid.slice(0, 3).join(', ')}` : ''}`
    : `Paste the ${classroom.section} list from a spreadsheet or an email: one per line or separated by commas. Students who have not registered yet can sign up from the link.`

  return (
    <section className="hm-panel" aria-labelledby="cr-invite-title">
      <div className="hm-panel-head">
        <h2 id="cr-invite-title" className="hm-panel-title">
          Invite students
        </h2>
        <span className={`fc-flag ${mailEnabled ? 'is-active' : 'cr-flag-muted'}`}>{mailEnabled ? 'Sends email' : 'Send from your email'}</span>
      </div>
      <form className="cr-form" onSubmit={submit} noValidate>
        <label className="cr-check">
          <input type="checkbox" checked={includeSection} onChange={(event) => setIncludeSection(event.target.checked)} />
          <span>
            <strong>Everyone registered in {classroom.section} who has not joined</strong>
            <small>
              {plural(waiting.length, 'student')}
              {samples ? ` · ${samples} of them are sample accounts that cannot receive email` : ''}
            </small>
          </span>
        </label>
        <Field id="cr-invite-emails" label={`More email addresses (up to ${LIMITS.emails})`} hint={emailHint}>
          <textarea
            id="cr-invite-emails"
            className="lab-input cr-textarea"
            rows={4}
            value={emails}
            onChange={(event) => {
              setEmails(event.target.value)
              setError(null)
            }}
            placeholder={'riya.kapoor@college.edu\narjun.nair@college.edu'}
            aria-describedby="cr-invite-emails-note"
          />
        </Field>
        {!mailEnabled && (
          <p className="lab-muted cr-note">
            Automatic email is not set up on this server, so PAC-LAB prepares the invite and you send it from your own email. An administrator can turn on
            sending (see DEPLOY.md).
          </p>
        )}
        <div className="lab-actions">
          <button type="submit" className="lab-btn lab-btn-primary" disabled={busy || !recipients.size}>
            {mailEnabled ? <Send aria-hidden="true" /> : <Mail aria-hidden="true" />}
            {busy ? (mailEnabled ? 'Sending…' : 'Preparing…') : `${mailEnabled ? 'Email the invite' : 'Prepare the invite'} (${recipients.size})`}
          </button>
        </div>
        {error && (
          <p className="cr-message is-error" role="alert">
            {error}
          </p>
        )}
      </form>
      {result && <InviteResult result={result} />}
    </section>
  )
}

function SettingsPanel({ classroom, onChanged }) {
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [values, setValues] = useState({ name: '', description: '' })
  const [busy, setBusy] = useState(null)
  const [message, setMessage] = useState(null)

  const form = normalizeClassroom({ ...values, classCode: classroom.section })
  const errors = editing ? classroomErrors(form) : {}

  // Runs one change, then reloads the page data; `done` may return a confirmation to show.
  const run = async (action, request, done) => {
    setBusy(action)
    setMessage(null)
    try {
      const data = await request()
      sfx.select()
      const text = done?.(data)
      setMessage(text ? { text } : null)
      onChanged()
    } catch (actionError) {
      setMessage({ text: actionError.message, error: true })
      sfx.denied()
    } finally {
      setBusy(null)
    }
  }

  const path = `/classrooms/${classroom.id}`

  const toggleOpen = () =>
    run(
      'open',
      () => facultyFetch(path, { method: 'PATCH', body: { isOpen: !classroom.isOpen } }),
      () => (classroom.isOpen ? 'Closed. New students cannot join until you open it again.' : 'Open. Students can join with the code or link.'),
    )

  const save = (event) => {
    event.preventDefault()
    if (Object.keys(errors).length) {
      sfx.denied()
      return
    }
    run('save', () => facultyFetch(path, { method: 'PATCH', body: { name: form.name, description: form.description } }), () => {
      setEditing(false)
      return 'Saved.'
    })
  }

  const resetCode = () => {
    if (!window.confirm(`Make a new class code? The code ${classroom.code} and its link stop working. Students who already joined stay in the classroom.`)) return
    run('code', () => facultyFetch(`${path}/code`, { method: 'POST' }), (data) => `New code: ${data.code}. Share the new link with students who have not joined yet.`)
  }

  const remove = async () => {
    if (!window.confirm(`Delete "${classroom.name}"? Everyone who joined is removed from it. This cannot be undone.`)) return
    setBusy('delete')
    setMessage(null)
    try {
      await facultyFetch(path, { method: 'DELETE' })
      sfx.back()
      say('Classroom deleted.')
      navigate({ to: '/faculty/classrooms' })
    } catch (deleteError) {
      setBusy(null)
      setMessage({ text: deleteError.message, error: true })
      sfx.denied()
    }
  }

  return (
    <section className="hm-panel" aria-labelledby="cr-settings-title">
      <div className="hm-panel-head">
        <h2 id="cr-settings-title" className="hm-panel-title">
          Settings
        </h2>
      </div>

      {editing ? (
        <form className="cr-form" onSubmit={save} noValidate>
          <Field id="cr-edit-name" label="Classroom name" error={errors.name}>
            <input
              id="cr-edit-name"
              className="lab-input"
              type="text"
              maxLength={LIMITS.name}
              value={values.name}
              onChange={(event) => setValues({ ...values, name: event.target.value })}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'cr-edit-name-note' : undefined}
            />
          </Field>
          <Field id="cr-edit-description" label="Description" error={errors.description}>
            <textarea
              id="cr-edit-description"
              className="lab-input cr-textarea"
              rows={2}
              maxLength={LIMITS.description}
              value={values.description}
              onChange={(event) => setValues({ ...values, description: event.target.value })}
              aria-invalid={Boolean(errors.description)}
              aria-describedby={errors.description ? 'cr-edit-description-note' : undefined}
            />
          </Field>
          <div className="lab-actions">
            <button type="submit" className="lab-btn lab-btn-primary" disabled={busy === 'save'}>
              {busy === 'save' ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="lab-btn" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <ul className="cr-settings">
          <li>
            <span>
              <strong>{classroom.isOpen ? 'Accepting new students' : 'Not accepting new students'}</strong>
              <small>Close the classroom once everyone has joined, so the link stops working for others.</small>
            </span>
            <button type="button" className="lab-btn" onClick={toggleOpen} disabled={Boolean(busy)}>
              {classroom.isOpen ? <Lock aria-hidden="true" /> : <LockOpen aria-hidden="true" />}
              {classroom.isOpen ? 'Close' : 'Open'}
            </button>
          </li>
          <li>
            <span>
              <strong>Name and description</strong>
              <small>Students see these on their Classrooms page.</small>
            </span>
            <button
              type="button"
              className="lab-btn"
              disabled={Boolean(busy)}
              onClick={() => {
                setValues({ name: classroom.name, description: classroom.description })
                setMessage(null)
                setEditing(true)
              }}
            >
              <Pencil aria-hidden="true" />
              Edit
            </button>
          </li>
          <li>
            <span>
              <strong>Class code</strong>
              <small>Make a new code if the link was shared outside the section.</small>
            </span>
            <button type="button" className="lab-btn" onClick={resetCode} disabled={Boolean(busy)}>
              <RefreshCw aria-hidden="true" />
              New code
            </button>
          </li>
          <li>
            <span>
              <strong>Delete classroom</strong>
              <small>Removes the classroom, its members and invites. Student progress is not affected.</small>
            </span>
            <button type="button" className="lab-btn cr-danger" onClick={remove} disabled={Boolean(busy)}>
              <Trash2 aria-hidden="true" />
              Delete
            </button>
          </li>
        </ul>
      )}
      {message && (
        <p className={`cr-message${message.error ? ' is-error' : ''}`} role={message.error ? 'alert' : 'status'}>
          {message.text}
        </p>
      )}
    </section>
  )
}

function RosterPanel({ classroom, roster, onChanged }) {
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(ROWS)
  const [removing, setRemoving] = useState(null)
  const [error, setError] = useState(null)

  const sorted = useMemo(
    () => [...roster].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || (a.name ?? a.email).localeCompare(b.name ?? b.email)),
    [roster],
  )
  const text = query.trim().toLowerCase()
  const rows = sorted.filter((p) => (filter === 'all' || p.status === filter) && (!text || `${p.name ?? ''} ${p.id ?? ''} ${p.email}`.toLowerCase().includes(text)))
  const count = (status) => roster.filter((p) => p.status === status).length

  const remove = async (person) => {
    if (!window.confirm(`Remove ${person.name} from ${classroom.name}? They can join again with the code while the classroom is open.`)) return
    setRemoving(person.id)
    setError(null)
    try {
      await facultyFetch(`/classrooms/${classroom.id}/members/${encodeURIComponent(person.id)}`, { method: 'DELETE' })
      sfx.back()
      onChanged()
    } catch (removeError) {
      setError(removeError.message)
      sfx.denied()
    } finally {
      setRemoving(null)
    }
  }

  const filters = [
    ['all', 'Everyone', roster.length],
    ['joined', 'Joined', count('joined')],
    ['invited', 'Invited', count('invited')],
    ['not_invited', 'Not invited', count('not_invited')],
  ]

  return (
    <section className="hm-panel" aria-labelledby="cr-roster-title">
      <div className="hm-panel-head">
        <h2 id="cr-roster-title" className="hm-panel-title">
          Students <span className="lab-pill">{rows.length}</span>
        </h2>
      </div>
      <div className="fc-toolbar">
        <div className="fc-chips" role="group" aria-label="Show">
          {filters.map(([key, label, n]) => (
            <button
              key={key}
              type="button"
              className="fc-chip"
              aria-pressed={filter === key}
              onClick={() => {
                setFilter(key)
                setLimit(ROWS)
                sfx.select()
              }}
            >
              {label}
              <span>{n}</span>
            </button>
          ))}
        </div>
        <label className="fc-search">
          <Search aria-hidden="true" />
          <span className="mz-sr-only">Find a student</span>
          <input
            type="search"
            placeholder="Name, roll number or email"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setLimit(ROWS)
            }}
          />
        </label>
      </div>
      {error && (
        <p className="cr-message is-error" role="alert">
          {error}
        </p>
      )}

      {rows.length ? (
        <ul className="cr-roster">
          {rows.slice(0, limit).map((person) => (
            <li key={person.id ?? person.email} className="cr-roster-row">
              <span className="fc-student-cell">
                {person.id ? (
                  <Link to="/faculty/student/$studentId" params={{ studentId: person.id }} className="fc-link">
                    {person.name}
                  </Link>
                ) : (
                  <span className="lab-muted">Not registered yet</span>
                )}
                <small>
                  {person.id && `${person.id} · `}
                  {person.email}
                  {person.id && !person.inSection && ' · other section'}
                </small>
              </span>
              <span className={`cr-status is-${person.status}`}>{STATUS[person.status]}</span>
              <span className="cr-when">
                {person.status === 'joined'
                  ? `Joined ${timeAgo(person.joinedAt).toLowerCase()}`
                  : person.status === 'invited'
                    ? `Invited ${timeAgo(person.invitedAt).toLowerCase()}`
                    : ''}
              </span>
              <span className="cr-row-action">
                {person.status === 'joined' && (
                  <button type="button" className="lab-btn cr-small" onClick={() => remove(person)} disabled={removing === person.id}>
                    <UserMinus aria-hidden="true" />
                    {removing === person.id ? 'Removing…' : 'Remove'}
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="lab-muted">{roster.length ? 'Nobody matches these filters.' : `No students have registered in ${classroom.section} yet. Invite them by email above.`}</p>
      )}
      {rows.length > limit && (
        <button type="button" className="lab-btn fc-more" onClick={() => setLimit(limit + ROWS)}>
          Show {Math.min(ROWS, rows.length - limit)} more
        </button>
      )}
    </section>
  )
}

export default function FacultyClassroom() {
  const { classroomId } = useParams({ strict: false })
  const { data, error, reload } = useFacultyData(`/classrooms/${encodeURIComponent(classroomId)}`)
  const classroom = data?.classroom

  usePageMeta(`${classroom?.name ?? 'Classroom'} | Faculty Console`, 'Share the class code, invite the section by email and see who has joined.')

  const counts = { invited: 0, not_invited: 0 }
  data?.roster.forEach((person) => {
    if (person.status in counts) counts[person.status]++
  })
  const stats = classroom
    ? [
        { label: 'Joined', value: classroom.members, icon: UserPlus },
        { label: `Registered in ${classroom.section}`, value: classroom.sectionSize, icon: Users },
        { label: 'Invited, not joined yet', value: counts.invited, icon: MailCheck },
        { label: 'Not invited yet', value: counts.not_invited, icon: Mail },
      ]
    : []

  return (
    <FacultyShell>
      <main className="mz-container lab-page hm-page fc-page">
        <Breadcrumbs items={[{ label: 'Classrooms', to: '/faculty/classrooms' }, { label: classroom?.name ?? 'Classroom' }]} />
        {!data ? (
          <LoadState error={error} what="the classroom" />
        ) : (
          <>
            <ClassroomHead classroom={classroom} />
            <ul className="hm-stats fc-stats" aria-label={`${classroom.name} at a glance`}>
              {stats.map(({ label, value, icon: Icon }) => (
                <li key={label} className="hm-stat">
                  <Icon aria-hidden="true" />
                  <span className="hm-stat-value">
                    <CountUp value={value} />
                  </span>
                  <span className="hm-stat-label">{label}</span>
                </li>
              ))}
            </ul>
            <div className="cr-grid">
              <InvitePanel classroom={classroom} roster={data.roster} mailEnabled={data.mailEnabled} onInvited={reload} />
              <SettingsPanel classroom={classroom} onChanged={reload} />
            </div>
            <RosterPanel classroom={classroom} roster={data.roster} onChanged={reload} />
          </>
        )}
      </main>
    </FacultyShell>
  )
}
