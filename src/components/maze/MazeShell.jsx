import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { CircleDollarSign, LogOut, Star, Zap } from 'lucide-react'
import { studentFetch } from '../../lib/studentApi.js'
import { flushProgress, totalStars, useProgress } from '../../progress.js'
import { getStudent, getStudentAuth, signOutStudent } from '../../session.js'
import { say, sfx } from '../../sound.js'
import { PacLogo } from './sprites.jsx'

// Fixed pseudo-random star positions so the backdrop is identical on every render.
const STARS = Array.from({ length: 36 }, (_, i) => ({
  x: `${(i * 37.7 + 3) % 100}%`,
  y: `${(i * 61.3 + 7) % 100}%`,
  delay: `${(i % 7) * 0.45}s`,
}))

const initials = (name) =>
  (name ?? '')
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

// Saves any progress not yet on the server, then signs the student out.
function useStudentLogout() {
  const navigate = useNavigate()
  const [leaving, setLeaving] = useState(false)

  const logout = async () => {
    if (leaving) return
    setLeaving(true)
    sfx.back()
    say('Progress saved. See you soon.')
    await Promise.race([flushProgress().catch(() => {}), new Promise((resolve) => setTimeout(resolve, 3000))])
    studentFetch('/logout', { method: 'POST' }).catch(() => {})
    signOutStudent()
    navigate({ to: '/login' })
  }

  return { logout, leaving }
}

function PlayerMenu() {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)
  const { logout, leaving } = useStudentLogout()
  const playerId = getStudent() ?? 'ML-2026-001'
  const name = getStudentAuth()?.name

  useEffect(() => {
    if (!open) return
    const closeOnOutside = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const toggle = () => {
    sfx.select()
    setOpen((isOpen) => !isOpen)
  }

  return (
    <div className="mz-avatar" ref={menuRef}>
      <button
        type="button"
        className="mz-avatar-button"
        aria-label="Player menu"
        aria-expanded={open}
        aria-controls="mz-player-menu"
        onClick={toggle}
      >
        {initials(name) || 'S1'}
      </button>
      {open && (
        <div id="mz-player-menu" className="mz-menu">
          <span className="mz-menu-label">SIGNED IN AS</span>
          <span className="mz-menu-id">{name ?? playerId}</span>
          {name && <span className="fc-menu-meta">{playerId}</span>}
          <button type="button" className="mz-btn mz-btn-sm" onClick={logout} disabled={leaving}>
            <LogOut aria-hidden="true" />
            {leaving ? 'SAVING…' : 'LOG OUT'}
          </button>
        </div>
      )}
    </div>
  )
}

function MazeNav() {
  const progress = useProgress()
  const { logout, leaving } = useStudentLogout()

  const chips = [
    { icon: Zap, value: progress.xp, unit: 'XP' },
    { icon: CircleDollarSign, value: progress.coins, unit: 'COINS' },
    { icon: Star, value: totalStars(progress), unit: 'STARS' },
  ]

  return (
    <header className="mz-nav mz-nav-student">
      <div className="mz-container mz-nav-inner">
        <Link to="/student" className="mz-brand">
          <PacLogo className="mz-logo" />
          <span>
            <span className="mz-brand-name">ML MAZE</span>
            <span className="mz-brand-tag">VIRTUAL LEARNING ARCADE</span>
          </span>
        </Link>

        <nav className="mz-links" aria-label="Main">
          <Link to="/student" activeOptions={{ exact: true }} className="mz-link">
            Home
          </Link>
          <Link to="/student/maze" className="mz-link">
            Experiments
          </Link>
          <Link to="/student/dashboard" className="mz-link">
            Dashboard
          </Link>
          <Link to="/student/classrooms" className="mz-link">
            Classrooms
          </Link>
        </nav>

        <div className="mz-stats">
          {chips.map(({ icon: Icon, value, unit }) => (
            <span key={unit} className="mz-chip">
              <Icon aria-hidden="true" />
              <span className="mz-chip-value">{value}</span>
              <span className="mz-chip-unit">{unit}</span>
            </span>
          ))}
          <PlayerMenu />
          <button type="button" className="mz-logout" onClick={logout} disabled={leaving} aria-label="Log out">
            <LogOut aria-hidden="true" />
            <span>{leaving ? 'Saving…' : 'Logout'}</span>
          </button>
        </div>
      </div>
    </header>
  )
}

export function Backdrop() {
  return (
    <div className="mz-backdrop" aria-hidden="true">
      {STARS.map((star, i) => (
        <span key={i} className="mz-star" style={{ '--x': star.x, '--y': star.y, '--delay': star.delay }} />
      ))}
    </div>
  )
}

export function MazeShell({ children }) {
  return (
    <div className="mz-shell">
      <Backdrop />
      <MazeNav />
      {children}
    </div>
  )
}
