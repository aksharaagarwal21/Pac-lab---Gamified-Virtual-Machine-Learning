import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { say, sfx } from '../sound.js'

export default function AuthForm({ role, subtitle, idLabel, idPlaceholder, accent, onSignIn, loadingNote = 'PLAYER READY // LOADING LAB...' }) {
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    say(role === 'STUDENT' ? 'Player one. Ready.' : 'Player two. Ready.')
  }, [role])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (onSignIn) {
      if (submitted) return
      setSubmitted(true)
      setError(null)
      const form = new FormData(event.currentTarget)
      const userId = String(form.get('userId')).trim().toUpperCase()
      try {
        // onSignIn may return a promise; a rejection shows its message and re-enables the form.
        await onSignIn(userId || idPlaceholder, String(form.get('password') ?? ''))
      } catch (signInError) {
        setSubmitted(false)
        setError(signInError.message || 'Sign-in failed.')
        sfx.denied()
        say('Access denied.')
      }
      return
    }
    setSubmitted(true)
    // Let the coin sound finish before the demo-mode announcement.
    setTimeout(() => {
      sfx.notice()
      say('Demo mode. Accounts not connected yet.')
    }, 520)
  }

  return (
    <main className="arcade-shell">
      <header className="arcade-header">
        <span className="header-mark" aria-hidden="true" />
        <span>PAC-LAB // {role} LOGIN</span>
        <span className="status-light">READY</span>
      </header>

      <section className="auth-stage">
        <div className={`auth-card auth-card-${accent}`}>
          <div className="auth-card-head">
            <span className={`ghost ghost-${accent === 'student' ? 'pink' : 'cyan'} player-avatar`} aria-hidden="true">
              <span className="ghost-eye">
                <span />
              </span>
              <span className="ghost-eye">
                <span />
              </span>
            </span>
            <div>
              <h1 className="auth-title">{role} LOGIN</h1>
              <p className="auth-subtitle">{subtitle}</p>
            </div>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="auth-field">
              <span>{idLabel}</span>
              <input type="text" name="userId" placeholder={idPlaceholder} autoComplete="username" required />
            </label>
            <label className="auth-field">
              <span>PASSWORD</span>
              <input type="password" name="password" placeholder="••••••••" autoComplete="current-password" required />
            </label>
            <button className="arcade-button auth-submit" type="submit" disabled={submitted && Boolean(onSignIn)}>
              INSERT COIN &amp; START
            </button>
            {submitted && <p className="auth-note">{onSignIn ? loadingNote : 'DEMO MODE // ACCOUNTS NOT CONNECTED YET'}</p>}
            {error && (
              <p className="auth-note is-error" role="alert">
                {error}
              </p>
            )}
          </form>

          <div className="auth-links">
            <Link to="/login">SWITCH PLAYER</Link>
            <Link to="/">BACK TO TITLE</Link>
          </div>
        </div>
      </section>

      <footer className="arcade-footer">
        <span>© 2026 PAC-LAB</span>
        <span>HIGH SCORE AWAITS</span>
      </footer>
    </main>
  )
}
