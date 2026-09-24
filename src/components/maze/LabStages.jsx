import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BookOpen,
  ChartColumn,
  Check,
  CircleHelp,
  Code,
  Database,
  Eye,
  EyeOff,
  Play,
  RotateCcw,
  Sparkles,
  Star,
  Target,
} from 'lucide-react'
import { pythonFloat, trainLogistic } from '../../lib/logistic.js'
import { clearLab, completeTask } from '../../progress.js'
import { say, sfx } from '../../sound.js'
import { GhostIcon } from './sprites.jsx'

export const STAGES = [
  { id: 'theory', label: 'Theory', title: 'THEORY', icon: BookOpen },
  { id: 'dataset', label: 'Dataset', title: 'DATASET', icon: Database },
  { id: 'code', label: 'Code Lab', title: 'CODE LAB', icon: Code },
  { id: 'visualize', label: 'Visualize', title: 'VISUALIZE', icon: ChartColumn },
  { id: 'tasks', label: 'Tasks', title: 'TASKS', icon: Target },
  { id: 'quiz', label: 'Quiz', title: 'QUIZ', icon: CircleHelp },
]

const stageNumber = (stageId) => String(STAGES.findIndex((stage) => stage.id === stageId) + 1).padStart(2, '0')

function StageIntro({ section }) {
  return (
    <>
      <p className="mz-stage">{section.stage}</p>
      <h3 className="mz-h2">
        {section.title} <em>{section.highlight}</em>
      </h3>
      <p className="mz-lead">{section.lead}</p>
    </>
  )
}

function GhostTip({ children }) {
  return (
    <div className="mz-tip">
      <GhostIcon className="mz-tip-ghost" />
      <div>
        <p className="mz-tip-label">GHOST TIP</p>
        <p className="mz-tip-text">{children}</p>
      </div>
    </div>
  )
}

// Trains the lab model on the training rows of the dataset.
function useTrainedModel(rows) {
  return useMemo(() => {
    const toPoint = (row) => [row.studied, row.slept]
    const train = rows.filter((row) => row.split === 'train')
    const test = rows.filter((row) => row.split === 'test')
    const model = trainLogistic(train.map(toPoint), train.map((row) => row.passed))
    return {
      model,
      trainCorrect: train.filter((row) => model.predict(toPoint(row)) === row.passed).length,
      trainTotal: train.length,
      testAccuracy: model.score(test.map(toPoint), test.map((row) => row.passed)),
      testCorrect: test.filter((row) => model.predict(toPoint(row)) === row.passed).length,
      testTotal: test.length,
    }
  }, [rows])
}

const CARD_ICONS = { database: Database, sparkles: Sparkles, target: Target }

function TheoryStage({ labId, section }) {
  useEffect(() => {
    completeTask(labId, 'theory')
  }, [labId])

  return (
    <>
      <StageIntro section={section} />
      <div className="mz-cards">
        {section.cards.map((card) => {
          const Icon = CARD_ICONS[card.icon]
          return (
            <article key={card.title} className="mz-card">
              <span className="mz-card-icon">
                <Icon aria-hidden="true" />
              </span>
              <h4 className="mz-card-title">{card.title}</h4>
              <p className="mz-card-copy">{card.copy}</p>
            </article>
          )
        })}
      </div>
      <GhostTip>{section.tip}</GhostTip>
    </>
  )
}

function DatasetStage({ labId, section }) {
  useEffect(() => {
    completeTask(labId, 'dataset')
  }, [labId])

  return (
    <>
      <StageIntro section={section} />
      <dl className="mz-facts">
        {section.facts.map(([label, value]) => (
          <div key={label} className="mz-fact">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mz-table-wrap">
        <table className="mz-table">
          <caption className="mz-sr-only">Student exam dataset</caption>
          <thead>
            <tr>
              <th scope="col">STUDENT</th>
              <th scope="col">HOURS STUDIED</th>
              <th scope="col">HOURS SLEPT</th>
              <th scope="col">RESULT</th>
              <th scope="col">SPLIT</th>
            </tr>
          </thead>
          <tbody>
            {section.rows.map((row) => (
              <tr key={row.id}>
                <td>{row.id}</td>
                <td className="is-num">{pythonFloat(row.studied)}</td>
                <td className="is-num">{pythonFloat(row.slept)}</td>
                <td>
                  <span className={`mz-tag ${row.passed ? 'mz-tag-pass' : 'mz-tag-fail'}`}>{row.passed ? 'PASS' : 'FAIL'}</span>
                </td>
                <td>
                  <span className={`mz-split${row.split === 'test' ? ' is-test' : ''}`}>{row.split.toUpperCase()}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <GhostTip>{section.tip}</GhostTip>
    </>
  )
}

const TOKEN = /(#.*$)|("[^"]*")|\b(from|import|print)\b|\b(\d+(?:\.\d+)?)\b|([A-Za-z_]\w*)(?=\()/g
const TOKEN_CLASS = ['tok-c', 'tok-s', 'tok-k', 'tok-n', 'tok-f']

function highlight(line) {
  const parts = []
  let last = 0
  for (const match of line.matchAll(TOKEN)) {
    if (match.index > last) parts.push(line.slice(last, match.index))
    const group = match.slice(1).findIndex((value) => value !== undefined)
    parts.push(
      <span key={match.index} className={TOKEN_CLASS[group]}>
        {match[0]}
      </span>,
    )
    last = match.index + match[0].length
  }
  if (last < line.length) parts.push(line.slice(last))
  return parts
}

function CodeStage({ labId, section, rows }) {
  const [output, setOutput] = useState([])
  const [running, setRunning] = useState(false)
  const timers = useRef([])
  const trained = useTrainedModel(rows)

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const run = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    const prediction = trained.model.predict(section.probe)
    const lines = [
      { text: `$ python ${section.file}`, tone: 'prompt' },
      { text: `Prediction for ${section.probe[0]}h study, ${section.probe[1]}h sleep: [${prediction}]` },
      { text: `Test accuracy: ${pythonFloat(trained.testAccuracy)}` },
    ]

    setOutput([])
    setRunning(true)
    sfx.enter()
    lines.forEach((line, index) => {
      const timer = setTimeout(() => {
        setOutput((shown) => [...shown, line])
        sfx.type()
        if (index === lines.length - 1) {
          setRunning(false)
          completeTask(labId, 'code')
          say(`Model trained. Test accuracy ${Math.round(trained.testAccuracy * 100)} percent.`)
        }
      }, 450 * (index + 1))
      timers.current.push(timer)
    })
  }

  const hasRun = output.length > 0

  return (
    <>
      <StageIntro section={section} />
      <div className="mz-editor">
        <div className="mz-editor-bar">
          <span className="mz-editor-file">
            <span className="mz-editor-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            {section.file}
          </span>
          <button type="button" className="mz-btn mz-btn-primary mz-btn-sm" onClick={run} disabled={running}>
            {hasRun && !running ? <RotateCcw aria-hidden="true" /> : <Play aria-hidden="true" />}
            {running ? 'RUNNING...' : hasRun ? 'RUN AGAIN' : 'RUN CODE'}
          </button>
        </div>
        <pre className="mz-code">
          <code>
            {section.lines.map((line, index) => (
              <span key={index} className="mz-code-line">
                {line ? highlight(line) : ' '}
              </span>
            ))}
          </code>
        </pre>
        <div className="mz-console" aria-live="polite">
          <p className="mz-console-label">OUTPUT</p>
          {hasRun ? (
            output.map((line) => (
              <p key={line.text} className={`mz-console-line${line.tone === 'prompt' ? ' is-prompt' : ''}`}>
                {line.text}
              </p>
            ))
          ) : (
            <p className="mz-console-line is-idle">Press RUN CODE to train the model.</p>
          )}
        </div>
      </div>
      <GhostTip>{section.tip}</GhostTip>
    </>
  )
}

// Returns the part of the line w1*x + w2*y + b = 0 that lies inside the chart area.
function boundarySegment({ w1, w2, b }, xMax, yMax) {
  const points = []
  if (w2 !== 0) {
    for (const x of [0, xMax]) {
      const y = -(w1 * x + b) / w2
      if (y >= 0 && y <= yMax) points.push([x, y])
    }
  }
  if (w1 !== 0) {
    for (const y of [0, yMax]) {
      const x = -(w2 * y + b) / w1
      if (x >= 0 && x <= xMax) points.push([x, y])
    }
  }
  return points.length >= 2 ? [points[0], points[points.length - 1]] : null
}

const CHART = { width: 720, height: 440, left: 70, right: 24, top: 20, bottom: 58 }

function VisualizeStage({ labId, section, rows }) {
  const [showBoundary, setShowBoundary] = useState(false)
  const trained = useTrainedModel(rows)

  const scaleX = (value) => CHART.left + (value / section.xMax) * (CHART.width - CHART.left - CHART.right)
  const scaleY = (value) => CHART.height - CHART.bottom - (value / section.yMax) * (CHART.height - CHART.top - CHART.bottom)
  const segment = boundarySegment(trained.model, section.xMax, section.yMax)
  const xTicks = Array.from({ length: section.xMax / 2 + 1 }, (_, i) => i * 2)
  const yTicks = Array.from({ length: section.yMax / 2 + 1 }, (_, i) => i * 2)

  const toggle = () => {
    const next = !showBoundary
    setShowBoundary(next)
    sfx.select()
    if (next) {
      completeTask(labId, 'visualize')
      say('Decision boundary revealed.')
    }
  }

  return (
    <>
      <StageIntro section={section} />
      <figure className="mz-chart" style={{ margin: '36px 0 0' }}>
        <div className="mz-chart-bar">
          <div className="mz-chart-legend">
            <span>
              <i className="mz-key mz-key-pass" />
              PASS
            </span>
            <span>
              <i className="mz-key mz-key-fail" />
              FAIL
            </span>
            <span>
              <i className="mz-key mz-key-test" />
              TEST STUDENT
            </span>
            {showBoundary && (
              <span>
                <i className="mz-key mz-key-line" />
                BOUNDARY
              </span>
            )}
          </div>
          <button type="button" className="mz-btn mz-btn-primary mz-btn-sm" onClick={toggle} aria-pressed={showBoundary}>
            {showBoundary ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            {showBoundary ? 'HIDE BOUNDARY' : 'SHOW BOUNDARY'}
          </button>
        </div>

        <svg viewBox={`0 0 ${CHART.width} ${CHART.height}`} role="img" aria-label="Scatter plot of hours studied against hours slept, coloured by exam result">
          <g className="mz-chart-grid">
            {xTicks.map((tick) => (
              <line key={`x${tick}`} x1={scaleX(tick)} x2={scaleX(tick)} y1={scaleY(0)} y2={scaleY(section.yMax)} />
            ))}
            {yTicks.map((tick) => (
              <line key={`y${tick}`} x1={scaleX(0)} x2={scaleX(section.xMax)} y1={scaleY(tick)} y2={scaleY(tick)} />
            ))}
          </g>
          <line className="mz-chart-axis" x1={scaleX(0)} x2={scaleX(section.xMax)} y1={scaleY(0)} y2={scaleY(0)} />
          <line className="mz-chart-axis" x1={scaleX(0)} x2={scaleX(0)} y1={scaleY(0)} y2={scaleY(section.yMax)} />
          {xTicks.map((tick) => (
            <text key={`xl${tick}`} x={scaleX(tick)} y={scaleY(0) + 24} textAnchor="middle">
              {tick}
            </text>
          ))}
          {yTicks.map((tick) => (
            <text key={`yl${tick}`} x={scaleX(0) - 14} y={scaleY(tick) + 5} textAnchor="end">
              {tick}
            </text>
          ))}
          <text x={(scaleX(0) + scaleX(section.xMax)) / 2} y={CHART.height - 8} textAnchor="middle">
            {section.xLabel}
          </text>
          <text x={18} y={(scaleY(0) + scaleY(section.yMax)) / 2} textAnchor="middle" transform={`rotate(-90 18 ${(scaleY(0) + scaleY(section.yMax)) / 2})`}>
            {section.yLabel}
          </text>

          {showBoundary && segment && (
            <line
              className="mz-boundary"
              x1={scaleX(segment[0][0])}
              y1={scaleY(segment[0][1])}
              x2={scaleX(segment[1][0])}
              y2={scaleY(segment[1][1])}
            />
          )}

          {rows.map((row) => (
            <circle
              key={row.id}
              cx={scaleX(row.studied)}
              cy={scaleY(row.slept)}
              r={row.split === 'test' ? 7 : 8}
              className={`${row.passed ? 'mz-dot-pass' : 'mz-dot-fail'}${row.split === 'test' ? ' mz-dot-test' : ''}`}
            >
              <title>{`${row.id}: ${row.studied}h studied, ${row.slept}h slept, ${row.passed ? 'PASS' : 'FAIL'} (${row.split})`}</title>
            </circle>
          ))}
        </svg>

        {showBoundary && (
          <p className="mz-chart-note">
            TRAIN ACCURACY {trained.trainCorrect}/{trained.trainTotal} · TEST ACCURACY {trained.testCorrect}/{trained.testTotal}
          </p>
        )}
      </figure>
      <GhostTip>{section.tip}</GhostTip>
    </>
  )
}

function TasksStage({ section, doneTasks, onJump }) {
  const doneCount = section.items.filter((task) => doneTasks.includes(task.id)).length
  const percent = Math.round((doneCount / section.items.length) * 100)

  return (
    <>
      <StageIntro section={section} />
      <div className="mz-task-progress">
        <div className="mz-track" role="progressbar" aria-label="Objectives complete" aria-valuemin={0} aria-valuemax={section.items.length} aria-valuenow={doneCount}>
          <span className="mz-track-fill" style={{ '--fill': `${percent}%` }} />
        </div>
        <span className="mz-task-count">
          {doneCount}/{section.items.length} OBJECTIVES
        </span>
      </div>
      <ul className="mz-tasks">
        {section.items.map((task) => {
          const done = doneTasks.includes(task.id)
          return (
            <li key={task.id}>
              <button type="button" className={`mz-task${done ? ' is-done' : ''}`} onClick={() => onJump(task.tab)}>
                <span className="mz-task-box" aria-hidden="true">
                  {done && <Check />}
                </span>
                <span className="mz-task-copy">
                  <span className="mz-task-text">{task.text}</span>
                  <span className="mz-task-hint">{done ? 'Complete' : task.hint}</span>
                </span>
                <span className="mz-task-stage">STAGE {stageNumber(task.tab)}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <GhostTip>{section.tip}</GhostTip>
    </>
  )
}

function QuizStage({ lab, section, bestStars }) {
  const blank = () => section.questions.map(() => null)
  const [answers, setAnswers] = useState(blank)
  const [result, setResult] = useState(null)
  const finishTimer = useRef()

  useEffect(() => () => clearTimeout(finishTimer.current), [])

  const finish = (score) => {
    if (score >= section.passMark) {
      const reward = clearLab(lab.id, score)
      setResult({ passed: true, score, reward })
      sfx.powerUp()
      say('Lab cleared! Quiz boss defeated.')
    } else {
      setResult({ passed: false, score })
      sfx.denied()
      say('The quiz boss wins this round. Try again.')
    }
  }

  const choose = (questionIndex, optionIndex) => {
    if (answers[questionIndex] !== null || result) return
    const next = answers.map((answer, i) => (i === questionIndex ? optionIndex : answer))
    setAnswers(next)
    if (optionIndex === section.questions[questionIndex].answer) sfx.coin()
    else sfx.denied()

    if (next.every((answer) => answer !== null)) {
      const score = next.filter((answer, i) => answer === section.questions[i].answer).length
      finishTimer.current = setTimeout(() => finish(score), 600)
    }
  }

  const retry = () => {
    clearTimeout(finishTimer.current)
    setAnswers(blank())
    setResult(null)
    sfx.replay()
  }

  return (
    <>
      <StageIntro section={section} />
      {bestStars > 0 && !result && (
        <p className="mz-quiz-status">
          CLEARED WITH {bestStars}/3 STARS{bestStars < 3 ? ' // REPLAY TO EARN MORE' : ''}
        </p>
      )}

      <ol className="mz-quiz">
        {section.questions.map((question, questionIndex) => {
          const picked = answers[questionIndex]
          const promptId = `mz-question-${questionIndex}`
          return (
            <li key={question.prompt} className="mz-question">
              <p className="mz-question-num">
                QUESTION {questionIndex + 1} OF {section.questions.length}
              </p>
              <p id={promptId} className="mz-question-text">
                {question.prompt}
              </p>
              <ul className="mz-options" aria-labelledby={promptId}>
                {question.options.map((option, optionIndex) => {
                  let state = ''
                  if (picked !== null && optionIndex === question.answer) state = ' is-correct'
                  else if (picked === optionIndex) state = ' is-wrong'
                  return (
                    <li key={option}>
                      <button
                        type="button"
                        className={`mz-option${state}`}
                        disabled={picked !== null}
                        onClick={() => choose(questionIndex, optionIndex)}
                      >
                        <span className="mz-option-key" aria-hidden="true">
                          {'ABCD'[optionIndex]}
                        </span>
                        {option}
                      </button>
                    </li>
                  )
                })}
              </ul>
              {picked !== null && (
                <p className={`mz-explain${picked === question.answer ? '' : ' is-wrong'}`}>
                  <strong>{picked === question.answer ? 'Correct! ' : 'Not quite. '}</strong>
                  {question.explain}
                </p>
              )}
            </li>
          )
        })}
      </ol>

      {result && (
        <div className={`mz-result${result.passed ? '' : ' is-fail'}`} role="status">
          <h4 className="mz-result-title">{result.passed ? 'LAB CLEARED!' : 'QUIZ BOSS WINS'}</h4>
          <span className="mz-result-stars" role="img" aria-label={`${result.score} of 3 stars`}>
            {[0, 1, 2].map((index) => (
              <Star key={index} className={index < result.score ? 'is-earned' : undefined} aria-hidden="true" />
            ))}
          </span>
          <p className="mz-result-stats">
            {result.passed
              ? `${result.score}/3 CORRECT · +${result.reward.xp} XP · +${result.reward.coins} COINS`
              : `${result.score}/3 CORRECT · ${section.passMark} NEEDED TO CLEAR`}
          </p>
          {(!result.passed || result.score < 3) && (
            <button type="button" className="mz-btn mz-btn-sm" onClick={retry}>
              <RotateCcw aria-hidden="true" />
              {result.passed ? 'REPLAY FOR 3 STARS' : 'TRY AGAIN'}
            </button>
          )}
        </div>
      )}
    </>
  )
}

export function ComingSoon({ lab, stage }) {
  return (
    <>
      <p className="mz-stage">STAGE {stageNumber(stage.id)} · BRIEFING</p>
      <h3 className="mz-h2">
        Lab under <em>construction.</em>
      </h3>
      <p className="mz-lead">
        The {stage.label} stage for {lab.title} is still being built. Check back soon to continue your run.
      </p>
      <GhostTip>New experiments open here as soon as the course team publishes them.</GhostTip>
    </>
  )
}

export function StageBody({ stageId, lab, content, doneTasks, bestStars, onJump }) {
  const rows = content.dataset.rows
  switch (stageId) {
    case 'theory':
      return <TheoryStage labId={lab.id} section={content.theory} />
    case 'dataset':
      return <DatasetStage labId={lab.id} section={content.dataset} />
    case 'code':
      return <CodeStage labId={lab.id} section={content.code} rows={rows} />
    case 'visualize':
      return <VisualizeStage labId={lab.id} section={content.visualize} rows={rows} />
    case 'tasks':
      return <TasksStage section={content.tasks} doneTasks={doneTasks} onJump={onJump} />
    default:
      return <QuizStage lab={lab} section={content.quiz} bestStars={bestStars} />
  }
}
