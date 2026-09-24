import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'
import { getFaculty, signOutFaculty } from '../../facultySession.js'
import { facultyFetch } from '../../lib/facultyApi.js'
import { say, sfx } from '../../sound.js'
import { Backdrop } from '../maze/MazeShell.jsx'
import { PacLogo } from '../maze/sprites.jsx'

const initials = (name = '') =>
  name
    .replace(/^(Dr|Prof)\.\s*/, '')
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

function useFacultyLogout() {
  const navigate = useNavigate()
  return () => {
    sfx.back()
    say('Signed out.')
    facultyFetch('/logout', { method: 'POST' }).catch(() => {})
    signOutFaculty()
    navigate({ to: '/login' })
  }
}

function FacultyMenu() {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)
  const logout = useFacultyLogout()
  const faculty = getFaculty()

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

  return (
    <div className="mz-avatar" ref={menuRef}>
      <button
        type="button"
        className="mz-avatar-button"
        aria-label="Faculty menu"
        aria-expanded={open}
        aria-controls="fc-faculty-menu"
        onClick={() => {
          sfx.select()
          setOpen((isOpen) => !isOpen)
        }}
      >
        {initials(faculty?.name) || 'F'}
      </button>
      {open && (
        <div id="fc-faculty-menu" className="mz-menu">
          <span className="mz-menu-label">SIGNED IN AS</span>
          <span className="mz-menu-id">{faculty?.name}</span>
          <span className="fc-menu-meta">
            {faculty?.id} · {faculty?.designation}
          </span>
          <button type="button" className="mz-btn mz-btn-sm" onClick={logout}>
            <LogOut aria-hidden="true" />
            LOG OUT
          </button>
        </div>
      )}
    </div>
  )
}

export function FacultyShell({ children }) {
  const faculty = getFaculty()
  const logout = useFacultyLogout()

  return (
    <div className="mz-shell">
      <Backdrop />
      <header className="mz-nav">
        <div className="mz-container mz-nav-inner">
          <Link to="/faculty" className="mz-brand">
            <PacLogo className="mz-logo" />
            <span>
              <span className="mz-brand-name">ML MAZE</span>
              <span className="mz-brand-tag">FACULTY CONSOLE</span>
            </span>
          </Link>

          <nav className="mz-links" aria-label="Faculty">
            <Link to="/faculty" activeOptions={{ exact: true }} className="mz-link">
              Classes
            </Link>
          </nav>

          <div className="mz-stats">
            <span className="mz-chip fc-role-chip">
              <span className="mz-chip-value">{faculty?.department ?? 'FACULTY'}</span>
              <span className="mz-chip-unit">DEPT</span>
            </span>
            <FacultyMenu />
            <button type="button" className="mz-logout" onClick={logout} aria-label="Log out">
              <LogOut aria-hidden="true" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>
      {children}
    </div>
  )
}
