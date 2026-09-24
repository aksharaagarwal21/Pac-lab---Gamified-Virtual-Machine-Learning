import { useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import { usePageMeta } from '../meta.js'
import { say } from '../sound.js'

export default function LoginIndex() {
  usePageMeta('Choose Player | PAC-LAB Login', 'Pick your player: sign in to PAC-LAB as a student or as faculty.')

  useEffect(() => {
    say('Choose your player')
  }, [])

  return (
    <main className="arcade-shell">
      <header className="arcade-header">
        <span className="header-mark" aria-hidden="true" />
        <span>PAC-LAB // ACCESS GATE</span>
        <span className="status-light">SELECT PLAYER</span>
      </header>

      <section className="auth-stage">
        <h1 className="auth-title">CHOOSE YOUR PLAYER</h1>
        <div className="player-grid">
          <Link to="/login/student" className="player-card">
            <span className="pacman player-avatar" aria-hidden="true" />
            <strong>STUDENT</strong>
            <span>PLAY THE LEVELS</span>
          </Link>
          <Link to="/login/faculty" className="player-card">
            <span className="ghost ghost-cyan player-avatar" aria-hidden="true">
              <span className="ghost-eye">
                <span />
              </span>
              <span className="ghost-eye">
                <span />
              </span>
            </span>
            <strong>FACULTY</strong>
            <span>CONTROL THE MAZE</span>
          </Link>
        </div>
        <Link to="/" className="arcade-button auth-back">
          BACK TO TITLE
        </Link>
      </section>

      <footer className="arcade-footer">
        <span>© 2026 PAC-LAB</span>
        <span>1 CREDIT = 1 PLAYER</span>
      </footer>
    </main>
  )
}
