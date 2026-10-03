import { useEffect, useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { normalizeJoinCode } from '../lib/classrooms.js'
import { studentFetch } from '../lib/studentApi.js'
import { usePageMeta } from '../meta.js'
import { getStudent, getStudentAuth, signOutStudent } from '../session.js'
import { say, sfx } from '../sound.js'

// Where a classroom invite link lands (/join/CODE). Signed-in students join with one press; others
// sign in or register first and come back here.
export default function JoinClassroom() {
  const { code: rawCode } = useParams({ strict: false })
  const code = normalizeJoinCode(rawCode)
  const [preview, setPreview] = useState({ classroom: null, error: null })
  const [signedIn, setSignedIn] = useState(() => Boolean(getStudent() && getStudentAuth()?.token))
  const [joining, setJoining] = useState(false)
  const [joined, setJoined] = useState(null)
  const [error, setError] = useState(null)

  usePageMeta('Join a Classroom | PAC-LAB', 'Join your teacher’s PAC-LAB classroom.')

  useEffect(() => {
    let cancelled = false
    studentFetch(`/join/${encodeURIComponent(code)}`).then(
      ({ classroom }) => {
        if (cancelled) return
        setPreview({ classroom, error: null })
        say(`Class invite. ${classroom.name}.`)
      },
      (previewError) => !cancelled && setPreview({ classroom: null, error: previewError }),
    )
    return () => {
      cancelled = true
    }
  }, [code])

  const join = async () => {
    if (joining) return
    setJoining(true)
    setError(null)
    try {
      const result = await studentFetch(`/join/${encodeURIComponent(code)}`, { method: 'POST' })
      setJoined(result)
      sfx.coin()
      say(result.alreadyMember ? 'You are already in this classroom.' : 'Joined. Welcome to the class.')
    } catch (joinError) {
      if (joinError.status === 401) {
        signOutStudent()
        setSignedIn(false)
      }
      setError(joinError.message)
      sfx.denied()
    } finally {
      setJoining(false)
    }
  }

  const { classroom } = preview
  const members = joined?.classroom.members ?? classroom?.members
  const next = { join: code }

  let body
  if (preview.error) {
    body = (
      <>
        <p className="auth-note is-error" role="alert">
          {preview.error.status === 404 ? 'NO CLASSROOM HAS THIS CODE. CHECK THE LINK WITH YOUR TEACHER.' : preview.error.message}
        </p>
        <Link to={signedIn ? '/student/classrooms' : '/login/student'} className="arcade-button auth-submit">
          {signedIn ? 'ENTER A CODE' : 'SIGN IN'}
        </Link>
      </>
    )
  } else if (!classroom) {
    body = (
      <p className="auth-note" role="status">
        LOADING CLASSROOM...
      </p>
    )
  } else {
    body = (
      <>
        <dl className="cr-invite">
          <div>
            <dt>CLASSROOM</dt>
            <dd>{classroom.name}</dd>
          </div>
          <div>
            <dt>SECTION</dt>
            <dd>
              {classroom.section} · {classroom.departmentName}
            </dd>
          </div>
          <div>
            <dt>TEACHER</dt>
            <dd>{classroom.teacher.name}</dd>
          </div>
          <div>
            <dt>JOINED</dt>
            <dd>
              {members} student{members === 1 ? '' : 's'}
            </dd>
          </div>
        </dl>

        {joined ? (
          <>
            <p className="auth-note cr-success" role="status">
              {joined.alreadyMember ? 'YOU ARE ALREADY IN THIS CLASSROOM.' : "YOU'RE IN! WELCOME TO THE CLASS."}
            </p>
            <Link to="/student/classrooms" className="arcade-button auth-submit" onClick={() => sfx.enter()}>
              MY CLASSROOMS
            </Link>
            <Link to="/student" className="cr-text-link">
              START PLAYING
            </Link>
          </>
        ) : !classroom.isOpen ? (
          <p className="auth-note is-error" role="alert">
            THIS CLASSROOM IS NOT ACCEPTING NEW STUDENTS RIGHT NOW. ASK YOUR TEACHER TO OPEN IT.
          </p>
        ) : signedIn ? (
          <>
            <p className="auth-subtitle">SIGNED IN AS {(getStudentAuth()?.name ?? getStudent()).toUpperCase()}</p>
            <button type="button" className="arcade-button auth-submit" onClick={join} disabled={joining}>
              {joining ? 'JOINING...' : 'JOIN CLASSROOM'}
            </button>
            <Link to="/login/student" search={next} className="cr-text-link">
              NOT YOU? SIGN IN AS SOMEONE ELSE
            </Link>
          </>
        ) : (
          <>
            <p className="auth-subtitle">SIGN IN WITH YOUR ROLL NUMBER TO JOIN.</p>
            <Link to="/login/student" search={next} className="arcade-button auth-submit" onClick={() => sfx.enter()}>
              SIGN IN TO JOIN
            </Link>
            <Link to="/register" search={next} className="cr-text-link">
              NEW TO PAC-LAB? REGISTER FIRST
            </Link>
          </>
        )}
        {error && (
          <p className="auth-note is-error" role="alert">
            {error}
          </p>
        )}
      </>
    )
  }

  return (
    <main className="arcade-shell">
      <header className="arcade-header">
        <span className="header-mark" aria-hidden="true" />
        <span>PAC-LAB // CLASS INVITE</span>
        <span className="status-light">JOIN</span>
      </header>

      <section className="auth-stage">
        <div className="auth-card auth-card-student auth-card-wide">
          <div className="auth-card-head">
            <span className="pacman player-avatar" aria-hidden="true" />
            <div>
              <h1 className="auth-title">CLASS INVITE</h1>
              <p className="auth-subtitle">CODE {code}</p>
            </div>
          </div>
          <div className="auth-form">{body}</div>
          <div className="auth-links">
            <Link to={signedIn ? '/student' : '/login'}>{signedIn ? 'BACK TO THE LAB' : 'SWITCH PLAYER'}</Link>
            <Link to="/">BACK TO TITLE</Link>
          </div>
        </div>
      </section>

      <footer className="arcade-footer">
        <span>© 2026 PAC-LAB</span>
        <span>1 CODE = 1 CLASS</span>
      </footer>
    </main>
  )
}
