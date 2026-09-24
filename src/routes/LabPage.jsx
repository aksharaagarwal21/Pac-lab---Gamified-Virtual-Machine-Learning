import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { ArrowLeft, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { ComingSoon, StageBody, STAGES } from '../components/maze/LabStages.jsx'
import { MazeShell } from '../components/maze/MazeShell.jsx'
import { LAB_CONTENT } from '../data/labContent.js'
import { getLab } from '../data/labs.js'
import { usePageMeta } from '../meta.js'
import { useProgress } from '../progress.js'
import { say, sfx } from '../sound.js'

export default function LabPage() {
  const { labId } = useParams({ strict: false })
  const lab = getLab(labId)
  const content = LAB_CONTENT[lab.id]
  const progress = useProgress()
  const navigate = useNavigate()
  const panelRef = useRef(null)
  const [stageIndex, setStageIndex] = useState(0)

  const stage = STAGES[stageIndex]
  const StageIcon = stage.icon
  const doneTasks = progress.tasks[lab.id] ?? []
  const bestStars = progress.cleared[lab.id]?.stars ?? 0
  const kicker = lab.final ? 'CHAMPIONSHIP' : `EXPERIMENT ${String(lab.id).padStart(2, '0')}`
  const isLastStage = stageIndex === STAGES.length - 1

  usePageMeta(`${lab.title} | ML Maze`, `${kicker} of the ML Maze: ${lab.title}.`)

  useEffect(() => {
    setStageIndex(0)
    say(`${lab.final ? 'Championship' : `Experiment ${lab.id}`}. ${lab.title}.`)
  }, [lab.id, lab.final, lab.title])

  const goTo = (index) => {
    if (index < 0 || index >= STAGES.length || index === stageIndex) return
    sfx.select()
    setStageIndex(index)
    if (panelRef.current && panelRef.current.getBoundingClientRect().top < 0) {
      panelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const jumpToStage = (stageId) => goTo(STAGES.findIndex((item) => item.id === stageId))

  // Arrow keys move between stages in the vertical tab list.
  const onTabKeyDown = (event) => {
    const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }
    if (!(event.key in keys)) return
    event.preventDefault()
    const next = (stageIndex + keys[event.key] + STAGES.length) % STAGES.length
    goTo(next)
    document.getElementById(`mz-tab-${STAGES[next].id}`)?.focus()
  }

  const backToMaze = () => {
    sfx.back()
    navigate({ to: '/student' })
  }

  return (
    <MazeShell>
      <div className="mz-progress-bar" style={{ '--fill': `${((stageIndex + 1) / STAGES.length) * 100}%` }} aria-hidden="true" />

      <main className="mz-container">
        <div className="mz-lab-top">
          <Link to="/student" className="mz-back" onClick={() => sfx.back()}>
            <ArrowLeft aria-hidden="true" />
            BACK TO MAZE
          </Link>
          <span className="mz-lab-meta">
            {kicker} · {lab.tier} · {lab.xp} XP{bestStars > 0 ? ` · CLEARED ${bestStars}/3 STARS` : ''}
          </span>
        </div>

        <div className="mz-lab">
          <aside className="mz-side" aria-label="Mission stages">
            <div className="mz-side-num" aria-hidden="true">
              {String(lab.id).padStart(2, '0')}
            </div>
            <p className="mz-side-kicker">CURRENT MISSION</p>
            <h1 className="mz-side-title">{lab.mission}</h1>

            <div className="mz-tabs" role="tablist" aria-orientation="vertical" aria-label={`${lab.title} stages`}>
              {STAGES.map((item, index) => {
                const Icon = item.icon
                const selected = index === stageIndex
                return (
                  <button
                    key={item.id}
                    id={`mz-tab-${item.id}`}
                    type="button"
                    role="tab"
                    className="mz-tab"
                    aria-selected={selected}
                    aria-controls="mz-stage-panel"
                    tabIndex={selected ? 0 : -1}
                    onClick={() => goTo(index)}
                    onKeyDown={onTabKeyDown}
                  >
                    <Icon aria-hidden="true" />
                    {item.label}
                    {doneTasks.includes(item.id) && <Check className="mz-tab-done" aria-label="complete" />}
                  </button>
                )
              })}
            </div>
          </aside>

          <section ref={panelRef} id="mz-stage-panel" className="mz-panel" role="tabpanel" aria-labelledby={`mz-tab-${stage.id}`}>
            <div className="mz-panel-head">
              <h2 className="mz-panel-title">
                <StageIcon aria-hidden="true" />
                {stage.title}
              </h2>
              <span className="mz-online">SYSTEM ONLINE</span>
            </div>

            <div className="mz-panel-body">
              {content ? (
                <StageBody
                  key={`${lab.id}-${stage.id}`}
                  stageId={stage.id}
                  lab={lab}
                  content={content}
                  doneTasks={doneTasks}
                  bestStars={bestStars}
                  onJump={jumpToStage}
                />
              ) : (
                <ComingSoon lab={lab} stage={stage} />
              )}
            </div>

            <div className="mz-panel-foot">
              <button type="button" className="mz-btn" onClick={() => goTo(stageIndex - 1)} disabled={stageIndex === 0}>
                <ChevronLeft aria-hidden="true" />
                Previous
              </button>
              {isLastStage ? (
                <button type="button" className="mz-btn mz-btn-primary" onClick={backToMaze} disabled={Boolean(content) && bestStars === 0}>
                  Back to maze
                  <ChevronRight aria-hidden="true" />
                </button>
              ) : (
                <button type="button" className="mz-btn mz-btn-primary" onClick={() => goTo(stageIndex + 1)}>
                  Continue
                  <ChevronRight aria-hidden="true" />
                </button>
              )}
            </div>
          </section>
        </div>
      </main>
    </MazeShell>
  )
}
