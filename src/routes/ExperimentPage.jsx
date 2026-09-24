import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, Check, FileText } from 'lucide-react'
import { ContentBlocks } from '../components/lab/ContentBlocks.jsx'
import { QuizStep } from '../components/lab/QuizStep.jsx'
import { SimulationStep } from '../components/lab/SimulationStep.jsx'
import { TheoryStep } from '../components/lab/TheoryStep.jsx'
import { MazeShell } from '../components/maze/MazeShell.jsx'
import { getLab, labNumber } from '../data/labs.js'
import { useExperiment } from '../experiments/index.js'
import { useSessionResult } from '../lib/sessionResults.js'
import { usePageMeta } from '../meta.js'
import { completeTask, useProgress } from '../progress.js'
import { say, sfx } from '../sound.js'

export const STEPS = [
  { id: 'aim', label: 'Aim', subtitle: 'Build intuition, one step at a time.' },
  { id: 'theory', label: 'Theory', subtitle: 'Discover the mechanism.' },
  { id: 'pretest', label: 'Pretest', subtitle: 'Check what you already know.' },
  { id: 'procedure', label: 'Procedure', subtitle: 'Follow the lab workflow.' },
  { id: 'simulation', label: 'Simulation', subtitle: 'Change, compare, explain.' },
  { id: 'results', label: 'Results & Analysis', subtitle: 'Review your evidence.' },
  { id: 'posttest', label: 'Posttest', subtitle: 'Show what you learned.' },
  { id: 'references', label: 'References & Contributors', subtitle: 'Credit the sources.' },
]

// Steps that count as complete once opened; the others complete through their activity.
const READ_STEPS = ['aim', 'procedure', 'results', 'references']
const MODES_KEY = 'pac-lab-reading-modes'

function readModes() {
  try {
    return { focus: false, reading: false, ...JSON.parse(localStorage.getItem(MODES_KEY)) }
  } catch {
    return { focus: false, reading: false }
  }
}

function readStep(key) {
  try {
    const saved = Number(sessionStorage.getItem(key))
    return Number.isInteger(saved) && saved >= 0 && saved < STEPS.length ? saved : 0
  } catch {
    return 0
  }
}

function SessionResult({ labId, onOpenSimulation }) {
  const result = useSessionResult(labId)

  if (!result) {
    return (
      <div className="lab-session is-empty">
        <FileText aria-hidden="true" />
        <div>
          <p className="lab-subtitle">No session result yet.</p>
          <p className="lab-muted">Run the simulation first. Its metrics and explanation will appear here without storing uploaded data.</p>
        </div>
        <button type="button" className="lab-btn lab-btn-primary" onClick={onOpenSimulation}>
          Open simulation
          <ArrowRight aria-hidden="true" />
        </button>
      </div>
    )
  }

  return (
    <div className="lab-session">
      <p className="lab-kicker">YOUR SESSION RESULT</p>
      <h4 className="lab-subtitle">{result.title}</h4>
      <dl className="lab-metrics">
        {result.metrics.map((metric) => (
          <div key={metric.label}>
            <dt>{metric.label}</dt>
            <dd>{metric.value}</dd>
          </div>
        ))}
      </dl>
      {result.explanation && <p className="lab-p">{result.explanation}</p>}
      <p className="lab-muted">Saved at {new Date(result.savedAt).toLocaleTimeString()} · kept for this browser tab only</p>
      <button type="button" className="lab-btn" onClick={onOpenSimulation}>
        Back to simulation
      </button>
    </div>
  )
}

function StepBody({ step, lab, content, missing, goTo }) {
  if (!content) {
    return missing ? (
      <div className="lab-coming">
        <p className="lab-kicker">IN PREPARATION</p>
        <h3 className="lab-doc-title">Content coming soon</h3>
        <p className="lab-p">The {step.label.toLowerCase()} for {lab.title} is being prepared by the course team.</p>
      </div>
    ) : (
      <p className="lab-muted" role="status">
        Loading experiment…
      </p>
    )
  }

  const Quiz = content.quizGame ?? QuizStep
  const Pretest = content.pretestGame ?? Quiz

  switch (step.id) {
    case 'aim':
      return (
        <ContentBlocks blocks={content.aim} />
      )
    case 'theory':
      return <TheoryStep lab={lab} theory={content.theory} />
    case 'pretest':
      return <Pretest key="pretest" lab={lab} kind="pretest" questions={content.pretest} />
    case 'procedure':
      return (
        <ContentBlocks blocks={content.procedure} />
      )
    case 'simulation':
      return <SimulationStep lab={lab} content={content} />
    case 'results':
      return (
        <>
          <ContentBlocks blocks={content.results} />
          <SessionResult labId={lab.id} onOpenSimulation={() => goTo(STEPS.findIndex((s) => s.id === 'simulation'))} />
        </>
      )
    case 'posttest':
      return <Quiz key="posttest" lab={lab} kind="posttest" questions={content.posttest} />
    default:
      return (
        <>
          <h3 className="lab-doc-title">References</h3>
          <ol className="lab-refs">
            {content.references.map((reference) => (
              <li key={reference.text}>
                {reference.url ? (
                  <a href={reference.url} target="_blank" rel="noreferrer">
                    {reference.text}
                  </a>
                ) : (
                  reference.text
                )}
              </li>
            ))}
          </ol>
          <h3 className="lab-doc-title">Contributors</h3>
          <ul className="lab-contributors">
            {content.contributors.map((person) => (
              <li key={`${person.name}-${person.role}`}>
                <strong>{person.name}</strong>
                <span>{person.role}</span>
              </li>
            ))}
          </ul>
        </>
      )
  }
}

function ExperimentPage({ labId }) {
  const lab = getLab(labId)
  const { content, missing } = useExperiment(lab.id)
  const progress = useProgress()
  const cardRef = useRef(null)
  const stepKey = `pac-lab-step-${lab.id}`
  const [stepIndex, setStepIndex] = useState(() => readStep(stepKey))
  const [modes, setModes] = useState(readModes)
  const step = STEPS[stepIndex]
  // Quiz ticks are also derived from saved attempts, so earlier attempts show as complete too.
  const pretestAnswers = progress.quizzes?.[lab.id]?.pretest?.answers
  const doneSteps = [
    ...(progress.tasks[lab.id] ?? []),
    ...(pretestAnswers?.length && pretestAnswers.every((answer) => answer !== null) ? ['pretest'] : []),
    ...(progress.cleared[lab.id] ? ['posttest'] : []),
  ]
  const isLast = stepIndex === STEPS.length - 1

  usePageMeta(`${lab.title} | ML Maze`, `Experiment ${lab.id} of the ML Maze virtual lab: ${lab.title}.`)

  useEffect(() => {
    say(`Experiment ${lab.id}. ${lab.title}.`)
  }, [lab.id, lab.title])

  useEffect(() => {
    try {
      sessionStorage.setItem(stepKey, String(stepIndex))
    } catch {
      // Storage unavailable: the step just resets on reload.
    }
    if (content && READ_STEPS.includes(step.id)) completeTask(lab.id, step.id)
  }, [stepIndex, stepKey, content, step.id, lab.id])

  const goTo = (index) => {
    if (index < 0 || index >= STEPS.length || index === stepIndex) return
    setStepIndex(index)
    sfx.select()
    if (cardRef.current && cardRef.current.getBoundingClientRect().top < 0) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const toggleMode = (name) => {
    const next = { ...modes, [name]: !modes[name] }
    setModes(next)
    sfx.select()
    try {
      localStorage.setItem(MODES_KEY, JSON.stringify(next))
    } catch {
      // Storage unavailable: the mode still applies until reload.
    }
  }

  return (
    <MazeShell>
      <div className="mz-progress-bar" style={{ '--fill': `${((stepIndex + 1) / STEPS.length) * 100}%` }} aria-hidden="true" />

      <main className={`mz-container lab-page${modes.focus ? ' is-focus' : ''}${modes.reading ? ' is-reading' : ''}`}>
        <div className="lab-top">
          <p className="lab-crumb-meta">
            EXPERIMENT {labNumber(lab.id)} · {lab.tier} · {lab.xp} XP
          </p>
          <div className="lab-top-row">
            <h1 className="lab-crumb-title">{lab.title}</h1>
            <Link to="/student/maze" className="lab-back" onClick={() => sfx.back()}>
              <ArrowLeft aria-hidden="true" />
              Back to Maze
            </Link>
          </div>

          <nav className="lab-tabs" aria-label="Experiment path">
            <ol>
              {STEPS.map((item, index) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="lab-tab"
                    aria-current={index === stepIndex ? 'step' : undefined}
                    onClick={() => goTo(index)}
                  >
                    {index + 1}. {item.label}
                    {doneSteps.includes(item.id) && <Check className="lab-tab-check" aria-label="complete" />}
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        </div>

        <article ref={cardRef} className="lab-content" aria-labelledby="lab-step-title">
          <header className="lab-content-head">
            <div>
              <p className="lab-step-kicker">
                STEP {stepIndex + 1} OF {STEPS.length}
              </p>
              <h2 id="lab-step-title" className="lab-step-title">
                {step.label}
              </h2>
              <p className="lab-step-sub">{step.subtitle}</p>
            </div>
            <div className="lab-modes">
              <button type="button" className="lab-mode-btn" aria-pressed={modes.focus} onClick={() => toggleMode('focus')}>
                Focus mode
              </button>
              <button type="button" className="lab-mode-btn" aria-pressed={modes.reading} onClick={() => toggleMode('reading')}>
                Reading mode
              </button>
            </div>
          </header>

          <div className="lab-card-body">
            <StepBody step={step} lab={lab} content={content} missing={missing} goTo={goTo} />
          </div>

          <footer className="lab-card-foot">
            {stepIndex === 0 ? (
              <Link to="/student/maze" className="lab-btn" onClick={() => sfx.back()}>
                <ArrowLeft aria-hidden="true" />
                Catalogue
              </Link>
            ) : (
              <button type="button" className="lab-btn" onClick={() => goTo(stepIndex - 1)}>
                <ArrowLeft aria-hidden="true" />
                Previous
              </button>
            )}
            {isLast ? (
              <Link to="/student/maze" className="lab-btn lab-btn-primary" onClick={() => sfx.back()}>
                Back to maze
                <ArrowRight aria-hidden="true" />
              </Link>
            ) : (
              <button type="button" className="lab-btn lab-btn-primary" onClick={() => goTo(stepIndex + 1)}>
                Next
                <ArrowRight aria-hidden="true" />
              </button>
            )}
          </footer>
        </article>
      </main>
    </MazeShell>
  )
}

// Remount per experiment so each keeps its own step and state.
export default function ExperimentRoute() {
  const { labId } = useParams({ strict: false })
  return <ExperimentPage key={labId} labId={labId} />
}
