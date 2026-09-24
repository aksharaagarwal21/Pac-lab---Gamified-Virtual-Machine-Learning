import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { MazeBoard } from '../components/maze/MazeBoard.jsx'
import { MazeShell } from '../components/maze/MazeShell.jsx'
import { Toast, useToast } from '../components/maze/useToast.jsx'
import { LABS } from '../data/labs.js'
import { usePageMeta } from '../meta.js'
import { nextLab, useProgress } from '../progress.js'
import { say, sfx } from '../sound.js'

export default function MazeHome() {
  const progress = useProgress()
  const navigate = useNavigate()
  const { toast, notify } = useToast()

  usePageMeta('ML Maze | PAC-LAB', 'Navigate the ML Maze: master each machine learning model and collect every star.')

  useEffect(() => {
    say('Welcome to the M L maze. Select your mission.')
  }, [])

  const clearedCount = Object.keys(progress.cleared).length
  const percent = Math.round((clearedCount / LABS.length) * 100)
  const upcoming = nextLab(progress)

  const openLab = (lab, status) => {
    if (status === 'locked') {
      sfx.denied()
      notify(`LOCKED // CLEAR EXPERIMENT ${lab.id - 1} FIRST`)
      return
    }
    sfx.enter()
    navigate({ to: '/student/lab/$labId', params: { labId: String(lab.id) } })
  }

  return (
    <MazeShell>
      <main className="mz-container">
        <section className="mz-hero" aria-labelledby="mz-hero-title">
          <div>
            <span className="mz-quest">SEMESTER QUEST 01</span>
            <h1 id="mz-hero-title" className="mz-hero-title">
              <span>LEARN.</span>
              <span>TRAIN.</span>
              <span className="mz-glow">LEVEL UP.</span>
            </h1>
            <p className="mz-hero-copy">
              Navigate the maze, master each model, and collect every star. Your machine learning adventure starts here.
            </p>
          </div>

          <div className="mz-progress-card">
            <div className="mz-progress-head">
              <span className="mz-progress-label">COURSE PROGRESS</span>
              <span className="mz-progress-value">{percent}%</span>
            </div>
            <div className="mz-track" role="progressbar" aria-label="Course progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
              <span className="mz-track-fill" style={{ '--fill': `${percent}%` }} />
            </div>
            <div className="mz-progress-foot">
              <span>
                {clearedCount}/{LABS.length} labs cleared
              </span>
              <span>{upcoming ? `Next: +${upcoming.xp} XP` : 'Maze complete'}</span>
            </div>
          </div>
        </section>

        <section className="mz-maze" aria-labelledby="mz-maze-title">
          <span className="mz-corner mz-corner-tl" aria-hidden="true" />
          <span className="mz-corner mz-corner-br" aria-hidden="true" />
          <div className="mz-maze-inner">
            <div className="mz-maze-head">
              <div>
                <p className="mz-eyebrow">SELECT YOUR MISSION</p>
                <h2 id="mz-maze-title" className="mz-maze-title">
                  THE LEARNING MAZE
                </h2>
              </div>
              <div className="mz-legend">
                <span style={{ '--dot': 'var(--mz-yellow)' }}>READY</span>
                <span style={{ '--dot': 'var(--mz-lock)' }}>LOCKED</span>
              </div>
            </div>
            <MazeBoard progress={progress} onOpen={openLab} />
          </div>
        </section>
      </main>
      <Toast toast={toast} />
    </MazeShell>
  )
}
