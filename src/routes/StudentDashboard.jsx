import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { BadgeCase } from '../components/dashboard/BadgeCase.jsx'
import { LevelMaze } from '../components/dashboard/LevelMaze.jsx'
import { ChallengePanel, MissionPanel } from '../components/dashboard/MissionPanels.jsx'
import { PlayerHero, StatTiles } from '../components/dashboard/PlayerHero.jsx'
import { Leaderboard, RunLog, SkillStats } from '../components/dashboard/ProgressPanels.jsx'
import { usePageMeta } from '../meta.js'
import { getStudent, signOutStudent } from '../session.js'
import { say, sfx } from '../sound.js'

export default function StudentDashboard() {
  const navigate = useNavigate()
  const playerId = getStudent() ?? 'ML-2026-001'
  const [toast, setToast] = useState(null)
  const toastTimer = useRef()

  usePageMeta('Student HQ | PAC-LAB', 'Your PAC-LAB student dashboard: level progress, badges, skills and class high scores.')

  useEffect(() => {
    sfx.powerUp()
    say('Welcome back, player one.')
    return () => clearTimeout(toastTimer.current)
  }, [])

  const notify = useCallback((text) => {
    clearTimeout(toastTimer.current)
    setToast({ id: Date.now(), text })
    toastTimer.current = setTimeout(() => setToast(null), 2800)
  }, [])

  const logout = () => {
    sfx.back()
    say('Game over. See you soon.')
    signOutStudent()
    navigate({ to: '/login' })
  }

  return (
    <main className="arcade-shell">
      <header className="arcade-header">
        <span className="header-mark" aria-hidden="true" />
        <span>PAC-LAB // STUDENT HQ</span>
        <span className="status-light">PLAYER 1 ONLINE</span>
      </header>

      <div className="dash-stage">
        <PlayerHero playerId={playerId} onLogout={logout} />
        <StatTiles />
        <LevelMaze onNotify={notify} />
        <div className="dash-row dash-row-split">
          <MissionPanel onNotify={notify} />
          <ChallengePanel onNotify={notify} />
        </div>
        <BadgeCase onNotify={notify} />
        <div className="dash-row dash-row-thirds">
          <SkillStats />
          <RunLog />
          <Leaderboard playerId={playerId} />
        </div>
      </div>

      <div className="dash-toast-wrap" role="status" aria-live="polite">
        {toast && (
          <p key={toast.id} className="dash-toast">
            {toast.text}
          </p>
        )}
      </div>

      <footer className="arcade-footer">
        <span>© 2026 PAC-LAB</span>
        <span>KEEP CHOMPING</span>
      </footer>
    </main>
  )
}
