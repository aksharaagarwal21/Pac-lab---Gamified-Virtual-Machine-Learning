import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CircleDollarSign, Flame, Gauge, Maximize, Minimize, Pause, Play, RotateCcw, Star, Zap } from 'lucide-react'
import { clearLab, completeTask, getQuiz, nextUnlockBlocker, saveQuizRun, useProgress } from '../../progress.js'
import { say, sfx } from '../../sound.js'
import {
  COMBO_COINS,
  COMBO_EVERY,
  fullscreenElement,
  isTyping,
  LETTERS,
  LEVEL_REWARD,
  PASS_RATIO,
  Review,
  starsFor,
  toggleElementFullscreen,
} from './quizGameKit.jsx'
import { createRace, LANE_COLORS, QUESTION_LEAD } from './raceEngine.js'
import '../../race.css'

const SPEED_BONUS_RATIO = 0.75
const SPEED_BONUS_COINS = 2
const KMH_PER_SPEED = 9
const KEY_ACTIONS = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right' }
const TOUCH_KEYS = [
  { action: 'left', label: 'Steer left', icon: ArrowLeft },
  { action: 'right', label: 'Steer right', icon: ArrowRight },
  { action: 'down', label: 'Brake', icon: ArrowDown },
  { action: 'up', label: 'Boost', icon: ArrowUp },
]

const blankRun = (total) => ({ answers: Array(total).fill(null), correct: 0, xp: 0, coins: 0, combo: 0, bestCombo: 0 })

// Game-mode pretest / posttest: the whole quiz is one non-stop pseudo-3D race. Every question drops
// four ghost gates (A–D) across the road and the car answers by driving through one of them.
export function QuizRace({ lab, kind, questions }) {
  const progress = useProgress()
  const saved = getQuiz(progress, lab.id, kind)
  const record = saved?.finished ? saved : null
  const pretest = kind === 'posttest' ? getQuiz(progress, lab.id, 'pretest') : null
  const total = questions.length
  const title = kind === 'pretest' ? 'Pretest' : 'Posttest'

  const stageRef = useRef(null)
  const canvasRef = useRef(null)
  const engineRef = useRef(null)
  const handlersRef = useRef({})
  const controlsRef = useRef({})
  const speedRef = useRef(null)
  const meterRef = useRef(null)
  const scoreRef = useRef(null)
  const runRef = useRef(blankRun(total))
  const pelletsRef = useRef(0)
  const countRef = useRef(null)
  const goTimer = useRef()
  const phaseRef = useRef('ready')

  const [phase, setPhaseState] = useState('ready')
  const [count, setCount] = useState(3)
  const [go, setGo] = useState(false)
  const [view, setView] = useState({ gate: 0, showing: false, lane: 1 })
  const [run, setRun] = useState(runRef.current)
  const [toast, setToast] = useState(null)
  const [result, setResult] = useState(null)
  const [fullscreen, setFullscreen] = useState(false)

  const setPhase = (next) => {
    phaseRef.current = next
    setPhaseState(next)
  }

  const start = () => {
    runRef.current = blankRun(total)
    setRun(runRef.current)
    pelletsRef.current = 0
    if (scoreRef.current) scoreRef.current.textContent = '0'
    countRef.current = null
    setToast(null)
    setResult(null)
    setGo(false)
    engineRef.current.start()
    setPhase('countdown')
    stageRef.current.focus({ preventScroll: true })
    say('Get ready.')
  }

  const pause = () => {
    if (phaseRef.current !== 'countdown' && phaseRef.current !== 'racing') return
    engineRef.current.pause()
    setPhase('paused')
    sfx.back()
  }

  const resume = () => {
    if (phaseRef.current !== 'paused') return
    engineRef.current.resume()
    setPhase(engineRef.current.mode === 'countdown' ? 'countdown' : 'racing')
    stageRef.current.focus({ preventScroll: true })
    sfx.select()
  }

  const quit = () => {
    engineRef.current.stop()
    setToast(null)
    setPhase('ready')
    sfx.back()
  }

  const toggleFullscreen = () => {
    toggleElementFullscreen(stageRef.current)
    sfx.select()
  }

  useEffect(() => {
    controlsRef.current = { pause, resume, toggleFullscreen }
    handlersRef.current = {
      onTick(snap) {
        if (speedRef.current) speedRef.current.textContent = String(Math.round(snap.speed * KMH_PER_SPEED))
        if (meterRef.current) meterRef.current.style.transform = `scaleX(${Math.min(1, Math.max(0, 1 - snap.toGate / QUESTION_LEAD))})`
        const showing = snap.mode === 'racing' && snap.toGate <= QUESTION_LEAD
        setView((prev) => (prev.gate === snap.nextGate && prev.showing === showing && prev.lane === snap.lane ? prev : { gate: snap.nextGate, showing, lane: snap.lane }))
        if (snap.mode === 'countdown') {
          const value = Math.max(1, Math.ceil(snap.countdown))
          if (countRef.current !== value) {
            countRef.current = value
            setCount(value)
            sfx.select()
          }
        }
      },

      onGo() {
        setPhase('racing')
        setGo(true)
        sfx.enter()
        clearTimeout(goTimer.current)
        goTimer.current = setTimeout(() => setGo(false), 900)
      },

      onGate(index, lane, correct, speedRatio) {
        const question = questions[index]
        const previous = runRef.current
        const combo = correct ? previous.combo + 1 : 0
        const gained = { xp: 0, coins: 0, notes: [] }
        if (correct) {
          const base = LEVEL_REWARD[question.level] ?? LEVEL_REWARD.beginner
          gained.xp = base.xp
          gained.coins = base.coins
          if (combo % COMBO_EVERY === 0) {
            gained.coins += COMBO_COINS
            gained.notes.push(`COMBO ×${combo} +${COMBO_COINS}`)
          }
          if (speedRatio >= SPEED_BONUS_RATIO) {
            gained.coins += SPEED_BONUS_COINS
            gained.notes.push(`SPEED BONUS +${SPEED_BONUS_COINS}`)
          }
          sfx.coin()
        } else {
          sfx.ghost()
        }

        const next = {
          answers: previous.answers.map((answer, i) => (i === index ? lane : answer)),
          correct: previous.correct + (correct ? 1 : 0),
          xp: previous.xp + gained.xp,
          coins: previous.coins + gained.coins,
          combo,
          bestCombo: Math.max(previous.bestCombo, combo),
        }
        runRef.current = next
        setRun(next)
        setToast({ key: index, correct, lane, question, ...gained })
      },

      onPellet() {
        pelletsRef.current += 1
        if (scoreRef.current) scoreRef.current.textContent = String(pelletsRef.current * 10)
        sfx.chomp()
      },

      onFinish() {
        const finalRun = runRef.current
        const score = finalRun.correct
        const ratio = score / total
        const passed = kind === 'pretest' || ratio >= PASS_RATIO
        const award = saveQuizRun(lab.id, kind, { answers: finalRun.answers, score, finished: true }, { xp: finalRun.xp, coins: finalRun.coins })
        let clear = null
        if (kind === 'pretest') {
          completeTask(lab.id, 'pretest')
        } else if (passed) {
          completeTask(lab.id, 'posttest')
          clear = clearLab(lab.id, starsFor(ratio))
        }

        if (passed) {
          sfx.powerUp()
          say(kind === 'pretest' ? 'Pretest race complete.' : nextUnlockBlocker(progress, lab.id) ? 'Experiment cleared! Finish the Python speed code to unlock the next level.' : 'Experiment cleared! Next level unlocked.')
        } else {
          sfx.denied()
          say('Not cleared yet. Race again to unlock the next level.')
        }
        setToast(null)
        setResult({ score, ratio, passed, award, clear, run: finalRun, pellets: pelletsRef.current })
        setPhase('results')
      },
    }
  })

  useEffect(() => {
    const engine = createRace(canvasRef.current, {
      questions,
      handlers: handlersRef,
      startLabel: kind.toUpperCase(),
      reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    })
    engineRef.current = engine
    const observer = new ResizeObserver(() => engine.resize())
    observer.observe(stageRef.current)
    return () => {
      observer.disconnect()
      engine.destroy()
      clearTimeout(goTimer.current)
    }
  }, [questions, kind])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (isTyping(event.target) || event.ctrlKey || event.metaKey || event.altKey) return
      const current = phaseRef.current
      const active = current === 'countdown' || current === 'racing'
      if (event.code === 'KeyF') {
        event.preventDefault()
        controlsRef.current.toggleFullscreen()
        return
      }
      if (event.code === 'Escape' || event.code === 'KeyP') {
        if (active) {
          event.preventDefault()
          controlsRef.current.pause()
        } else if (current === 'paused' && event.code === 'KeyP') {
          controlsRef.current.resume()
        }
        return
      }
      if (!active) return
      const action = KEY_ACTIONS[event.code]
      if (action) {
        event.preventDefault()
        engineRef.current?.setKey(action, true)
      } else if (event.code === 'Space') {
        event.preventDefault()
      }
    }
    const onKeyUp = (event) => {
      const action = KEY_ACTIONS[event.code]
      if (action) engineRef.current?.setKey(action, false)
    }
    const onBlur = () => controlsRef.current.pause()
    const onVisibility = () => {
      if (document.hidden) controlsRef.current.pause()
    }
    const onFullscreen = () => {
      const inside = fullscreenElement() === stageRef.current
      setFullscreen(inside)
      if (!inside) controlsRef.current.pause()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVisibility)
    document.addEventListener('fullscreenchange', onFullscreen)
    document.addEventListener('webkitfullscreenchange', onFullscreen)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisibility)
      document.removeEventListener('fullscreenchange', onFullscreen)
      document.removeEventListener('webkitfullscreenchange', onFullscreen)
    }
  }, [])

  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(null), 6500)
    return () => clearTimeout(timer)
  }, [toast])

  const holdKey = (action, down) => (event) => {
    if (down) event.currentTarget.setPointerCapture?.(event.pointerId)
    engineRef.current?.setKey(action, down)
  }

  const question = questions[Math.min(view.gate, total - 1)]
  const showQuestion = view.showing && (phase === 'racing' || phase === 'paused')
  const fullscreenLabel = fullscreen ? 'Exit fullscreen' : 'Fullscreen'
  const FullscreenIcon = fullscreen ? Minimize : Maximize

  return (
    <section className="race" aria-labelledby={`race-${kind}-title`}>
      <div className="race-intro">
        <div>
          <p className="lab-kicker">KNOWLEDGE CHECK · ARCADE RACE</p>
          <h3 id={`race-${kind}-title`} className="lab-title">
            {title} Grand Prix
          </h3>
        </div>
        <p className="lab-muted">
          {total} questions · one non-stop run · steer into the right answer
        </p>
      </div>

      <div ref={stageRef} className={`race-stage is-${phase}`} tabIndex={-1} role="group" aria-label={`${title} racing game`}>
        <canvas ref={canvasRef} className="race-canvas" aria-hidden="true" />

        {phase !== 'ready' && (
          <div className="race-hud">
            <div className="race-top">
              <div className="race-panel race-status">
                <span className="race-label">{title.toUpperCase()}</span>
                <span className="race-gate">
                  GATE {Math.min(view.gate + 1, total)}/{total}
                </span>
                <ol className="race-pips" aria-label={`${run.correct} of ${total} correct so far`}>
                  {run.answers.map((answer, index) => (
                    <li
                      key={index}
                      className={answer === null ? (index === view.gate ? 'is-next' : undefined) : answer === questions[index].answer ? 'is-good' : 'is-bad'}
                    />
                  ))}
                </ol>
              </div>

              <div className="race-panel race-stats">
                <span className="race-stat">
                  <Zap aria-hidden="true" />
                  <b>{run.xp}</b> XP
                </span>
                <span className="race-stat">
                  <CircleDollarSign aria-hidden="true" />
                  <b>{run.coins}</b> COINS
                </span>
                <span className={`race-stat${run.combo >= 2 ? ' is-hot' : ''}`}>
                  <Flame aria-hidden="true" />×<b>{run.combo}</b>
                </span>
                <span className="race-stat">
                  <Gauge aria-hidden="true" />
                  <b ref={speedRef}>0</b> KM/H
                </span>
                <span className="race-stat race-stat-score">
                  SCORE <b ref={scoreRef}>0</b>
                </span>
              </div>

              <div className="race-buttons">
                {(phase === 'countdown' || phase === 'racing' || phase === 'paused') && (
                  <button type="button" className="race-icon-btn" onClick={phase === 'paused' ? resume : pause} aria-label={phase === 'paused' ? 'Resume' : 'Pause'}>
                    {phase === 'paused' ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
                  </button>
                )}
                <button type="button" className="race-icon-btn" onClick={toggleFullscreen} aria-label={fullscreenLabel}>
                  <FullscreenIcon aria-hidden="true" />
                </button>
              </div>
            </div>

            {showQuestion && (
              <div className="race-question" key={view.gate}>
                <div className="race-question-head">
                  <span className={`lab-level is-${question.level}`}>{question.level.toUpperCase()}</span>
                  <span className="race-label">
                    Q{view.gate + 1}/{total}
                  </span>
                  <span className="race-meter" aria-hidden="true">
                    <span ref={meterRef} />
                  </span>
                </div>
                <p className="race-prompt">{question.prompt}</p>
                <ol className="race-options">
                  {question.options.map((option, lane) => (
                    <li key={option} className={lane === view.lane ? 'is-aim' : undefined} style={{ '--lane': LANE_COLORS[lane] }}>
                      <span className="race-key" aria-hidden="true">
                        {LETTERS[lane]}
                      </span>
                      <span>{option}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div className="race-feed" role="status" aria-live="polite">
              {toast && (
                <div key={toast.key} className={`race-toast ${toast.correct ? 'is-good' : 'is-bad'}`}>
                  <p className="race-toast-title">{toast.correct ? `CORRECT! +${toast.xp} XP · +${toast.coins} COINS` : 'GHOSTED! WRONG GATE'}</p>
                  {toast.notes.length > 0 && <p className="race-toast-notes">{toast.notes.join(' · ')}</p>}
                  {!toast.correct && (
                    <p className="race-toast-answer">
                      You took {LETTERS[toast.lane]}. Answer: {LETTERS[toast.question.answer]}. {toast.question.options[toast.question.answer]}
                    </p>
                  )}
                  {toast.question.explain && <p className="race-toast-explain">{toast.question.explain}</p>}
                </div>
              )}
            </div>

            {phase === 'countdown' && (
              <p className="race-count" key={count}>
                {count}
              </p>
            )}
            {go && phase === 'racing' && <p className="race-count is-go">GO!</p>}

            <p className="race-legend" aria-hidden="true">
              <kbd>W</kbd>
              <kbd>S</kbd> speed · <kbd>A</kbd>
              <kbd>D</kbd> steer · <kbd>F</kbd> fullscreen · <kbd>Esc</kbd> pause
            </p>

            {(phase === 'countdown' || phase === 'racing') && (
              <div className="race-touch">
                {TOUCH_KEYS.map(({ action, label, icon: Icon }) => (
                  <button
                    key={action}
                    type="button"
                    className={`race-touch-btn is-${action}`}
                    aria-label={label}
                    onPointerDown={holdKey(action, true)}
                    onPointerUp={holdKey(action, false)}
                    onPointerCancel={holdKey(action, false)}
                    onLostPointerCapture={holdKey(action, false)}
                    onContextMenu={(event) => event.preventDefault()}
                  >
                    <Icon aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {phase === 'ready' && (
          <div className="race-overlay">
            <div className="race-card">
              <p className="race-kicker">
                {lab.mission} GRAND PRIX · {title.toUpperCase()}
              </p>
              <h4 className="race-title">Drive through the right answer</h4>
              <p className="race-copy">
                The whole {title.toLowerCase()} is one non-stop race. Each question drops four ghost gates across the road, one per lane (A to D from left to
                right). Steer into the lane of the correct option before you reach the gate. Brake if you need more reading time, boost for bonus coins.
              </p>
              <ul className="race-controls">
                <li>
                  <span>
                    <kbd>W</kbd>
                    <kbd>↑</kbd>
                  </span>
                  Boost
                </li>
                <li>
                  <span>
                    <kbd>S</kbd>
                    <kbd>↓</kbd>
                  </span>
                  Brake
                </li>
                <li>
                  <span>
                    <kbd>A</kbd>
                    <kbd>D</kbd>
                  </span>
                  Steer
                </li>
                <li>
                  <span>
                    <kbd>F</kbd>
                  </span>
                  Fullscreen
                </li>
                <li>
                  <span>
                    <kbd>Esc</kbd>
                  </span>
                  Pause
                </li>
              </ul>
              <ul className="race-rewards">
                {Object.entries(LEVEL_REWARD).map(([level, reward]) => (
                  <li key={level}>
                    <span className={`lab-level is-${level}`}>{level.toUpperCase()}</span>+{reward.xp} XP · +{reward.coins} coins
                  </li>
                ))}
                <li>
                  <Flame aria-hidden="true" />
                  {COMBO_EVERY} in a row: +{COMBO_COINS} coins
                </li>
                <li>
                  <Gauge aria-hidden="true" />
                  Correct at boost speed: +{SPEED_BONUS_COINS} coins
                </li>
              </ul>
              <p className="race-note">Bonus XP and coins go to your profile. Replays only pay out what beats your best {title.toLowerCase()} run.</p>
              {record && (
                <p className="race-last">
                  Last run: {record.score}/{total}
                  {record.bonus && ` · best bonus ${record.bonus.xp} XP, ${record.bonus.coins} coins`}
                </p>
              )}
              <div className="race-actions">
                <button type="button" className="lab-btn lab-btn-primary" onClick={start}>
                  <Play aria-hidden="true" />
                  {record ? 'Race again' : 'Start race'}
                </button>
                <button type="button" className="lab-btn" onClick={toggleFullscreen}>
                  <FullscreenIcon aria-hidden="true" />
                  {fullscreenLabel}
                </button>
              </div>
            </div>
          </div>
        )}

        {phase === 'paused' && (
          <div className="race-overlay">
            <div className="race-card is-compact">
              <p className="race-kicker">PAUSED</p>
              <h4 className="race-title">Take a breather</h4>
              <p className="race-copy">
                Gate {Math.min(view.gate + 1, total)} of {total} · {run.correct} correct so far.
              </p>
              <div className="race-actions">
                <button type="button" className="lab-btn lab-btn-primary" onClick={resume}>
                  <Play aria-hidden="true" />
                  Resume
                </button>
                <button type="button" className="lab-btn" onClick={start}>
                  <RotateCcw aria-hidden="true" />
                  Restart race
                </button>
                <button type="button" className="lab-btn" onClick={quit}>
                  Quit run
                </button>
              </div>
            </div>
          </div>
        )}

        {phase === 'results' && result && (
          <div className="race-overlay">
            <div className={`race-card${result.passed ? '' : ' is-fail'}`}>
              <p className="race-kicker">{kind === 'pretest' ? 'PRETEST COMPLETE' : result.passed ? 'EXPERIMENT CLEARED' : 'NOT CLEARED YET'}</p>
              <p className="race-score">
                {result.score} / {total}
                <span>{Math.round(result.ratio * 100)}%</span>
              </p>
              {kind === 'posttest' && result.passed && (
                <span className="race-stars" role="img" aria-label={`${starsFor(result.ratio)} of 3 stars`}>
                  {[0, 1, 2].map((index) => (
                    <Star key={index} className={index < starsFor(result.ratio) ? 'is-earned' : undefined} aria-hidden="true" />
                  ))}
                </span>
              )}
              <dl className="race-tiles">
                <div>
                  <dt>Run XP</dt>
                  <dd>{result.run.xp}</dd>
                </div>
                <div>
                  <dt>Run coins</dt>
                  <dd>{result.run.coins}</dd>
                </div>
                <div>
                  <dt>Best combo</dt>
                  <dd>×{result.run.bestCombo}</dd>
                </div>
                <div>
                  <dt>Pellet score</dt>
                  <dd>{result.pellets * 10}</dd>
                </div>
              </dl>
              <p className="race-copy">
                {result.award.xp || result.award.coins
                  ? `+${result.award.xp} XP and +${result.award.coins} coins added to your profile.`
                  : `No new bonus: your best ${title.toLowerCase()} run already earned ${record?.bonus?.xp ?? 0} XP and ${record?.bonus?.coins ?? 0} coins. Beat it to earn more.`}
                {result.clear && (result.clear.xp || result.clear.coins) ? ` Clear reward: +${result.clear.xp} XP, +${result.clear.coins} coins.` : ''}
              </p>
              <p className="race-copy">
                {kind === 'pretest'
                  ? `This shows what you already know. Work through Procedure and Simulation, then race the Posttest: ${Math.ceil(total * PASS_RATIO)} / ${total} correct gates there clears the experiment.`
                  : result.passed
                    ? (nextUnlockBlocker(progress, lab.id) ?? 'The next level is unlocked.')
                    : `You need ${Math.ceil(total * PASS_RATIO)} correct gates to clear this experiment and unlock the next level.`}
                {pretest?.finished && ` Pretest ${pretest.score}/${total} → Posttest ${result.score}/${total}.`}
              </p>
              <div className="race-actions">
                <button type="button" className="lab-btn lab-btn-primary" onClick={start}>
                  <RotateCcw aria-hidden="true" />
                  Race again
                </button>
                {fullscreen && (
                  <button type="button" className="lab-btn" onClick={toggleFullscreen}>
                    <Minimize aria-hidden="true" />
                    Exit fullscreen
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {record && (phase === 'ready' || phase === 'results') && <Review questions={questions} record={record} verb="you drove through" />}
    </section>
  )
}
