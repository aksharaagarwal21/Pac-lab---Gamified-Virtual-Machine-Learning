import { useEffect, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Heart,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Star,
} from 'lucide-react'
import { clearLab, completeTask, getQuiz, saveQuizRun, useProgress } from '../../progress.js'
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
import '../../redlight.css'
import { createSceneState, drawScene, updateScene } from './redLightScene.js'

const KEY_ACTIONS = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
}

const TOUCH_KEYS = [
  { action: 'left', label: 'Move left', icon: ArrowLeft },
  { action: 'up', label: 'Move forward', icon: ArrowUp },
  { action: 'down', label: 'Move backward', icon: ArrowDown },
  { action: 'right', label: 'Move right', icon: ArrowRight },
]

const TEAM = [
  { name: 'YOU', number: '256', color: '#f5c518', x: 0.5 },
  { name: 'BYTE', number: '111', color: '#22d3ee', x: 0.35 },
  { name: 'PINKY', number: '042', color: '#ff6fae', x: 0.65 },
  { name: 'CLYDE', number: '017', color: '#ff8a3d', x: 0.22 },
]

const CROWD = [
  { x: 0.12, y: 0.57, speed: 0.82, color: '#a78bfa' },
  { x: 0.25, y: 0.48, speed: 0.73, color: '#22d3ee' },
  { x: 0.39, y: 0.54, speed: 0.9, color: '#fb7185' },
  { x: 0.52, y: 0.45, speed: 0.69, color: '#f97316' },
  { x: 0.62, y: 0.58, speed: 0.78, color: '#34d399' },
  { x: 0.73, y: 0.5, speed: 0.86, color: '#60a5fa' },
  { x: 0.84, y: 0.56, speed: 0.75, color: '#f472b6' },
  { x: 0.91, y: 0.47, speed: 0.67, color: '#facc15' },
]

const blankRun = (total) => ({
  answers: Array(total).fill(null),
  correct: 0,
  mistakes: 0,
  xp: 0,
  coins: 0,
  combo: 0,
  bestCombo: 0,
})

const initialWorld = () => ({
  scene: createSceneState(),
  move: 0,
  x: 0.5,
  keys: { up: false, down: false, left: false, right: false },
  team: TEAM.map((member) => ({ ...member, alive: true, deathAt: 0 })),
  crowd: CROWD.map((runner) => ({ ...runner, offset: 0 })),
  advancing: false,
})


// Experiment 1's posttest: a continuous 20-question survival run. Correct answers turn the
// light green and unlock WASD movement; wrong answers turn it red and eliminate one squad member.
export function RedLightQuiz({ lab, kind, questions }) {
  const progress = useProgress()
  const saved = getQuiz(progress, lab.id, kind)
  const record = saved?.finished ? saved : null
  const pretest = getQuiz(progress, lab.id, 'pretest')
  const total = questions.length

  const stageRef = useRef(null)
  const canvasRef = useRef(null)
  const phaseRef = useRef('ready')
  const resumePhaseRef = useRef('question')
  const questionRef = useRef(0)
  const runRef = useRef(blankRun(total))
  const worldRef = useRef(initialWorld())
  const finishRef = useRef(() => {})
  const nextRef = useRef(() => {})
  const timersRef = useRef(new Set())
  const moveMeterRef = useRef(null)

  const [phase, setPhaseState] = useState('ready')
  const [questionIndex, setQuestionIndex] = useState(0)
  const [run, setRun] = useState(runRef.current)
  const [feedback, setFeedback] = useState(null)
  const [result, setResult] = useState(null)
  const [fullscreen, setFullscreen] = useState(false)

  const setPhase = (next) => {
    phaseRef.current = next
    setPhaseState(next)
  }

  const clearTimers = () => {
    timersRef.current.forEach((timer) => clearTimeout(timer))
    timersRef.current.clear()
  }

  const later = (callback, delay) => {
    const timer = setTimeout(() => {
      timersRef.current.delete(timer)
      callback()
    }, delay)
    timersRef.current.add(timer)
    return timer
  }

  const finish = (gameOver) => {
    if (phaseRef.current === 'results' || phaseRef.current === 'gameover') return
    clearTimers()
    const finalRun = runRef.current
    const score = finalRun.correct
    const ratio = score / total
    const survived = !gameOver && finalRun.answers.every((answer) => answer !== null)
    const passed = survived && ratio >= PASS_RATIO
    const award = saveQuizRun(lab.id, kind, { answers: finalRun.answers, score, finished: true }, { xp: finalRun.xp, coins: finalRun.coins })
    let clear = null
    if (passed) {
      completeTask(lab.id, 'posttest')
      clear = clearLab(lab.id, starsFor(ratio))
      sfx.powerUp()
      say('You survived all twenty questions. Experiment cleared!')
    } else {
      sfx.gameOver()
      say('Game over. Restart the posttest and protect your team.')
    }
    setFeedback(null)
    setResult({ score, ratio, passed, survived, gameOver, award, clear, run: finalRun })
    setPhase(gameOver ? 'gameover' : 'results')
  }
  finishRef.current = finish

  const nextQuestion = () => {
    const next = questionRef.current + 1
    worldRef.current.move = 0
    worldRef.current.advancing = false
    worldRef.current.keys.up = worldRef.current.keys.down = worldRef.current.keys.left = worldRef.current.keys.right = false
    if (moveMeterRef.current) moveMeterRef.current.style.transform = 'scaleX(0)'
    if (next >= total) {
      finishRef.current(false)
      return
    }
    questionRef.current = next
    setQuestionIndex(next)
    setFeedback(null)
    setPhase('question')
    say(`Question ${next + 1}. Choose one to four.`)
  }
  nextRef.current = nextQuestion

  const start = () => {
    clearTimers()
    runRef.current = blankRun(total)
    worldRef.current = initialWorld()
    questionRef.current = 0
    setQuestionIndex(0)
    setRun(runRef.current)
    setFeedback(null)
    setResult(null)
    setPhase('question')
    stageRef.current?.focus({ preventScroll: true })
    sfx.enter()
    say('Survival run started. Question one. Choose one to four.')
  }

  const quit = () => {
    clearTimers()
    worldRef.current.keys.up = worldRef.current.keys.down = worldRef.current.keys.left = worldRef.current.keys.right = false
    setFeedback(null)
    setPhase('ready')
    sfx.back()
  }

  const pause = () => {
    if (!['question', 'green'].includes(phaseRef.current)) return
    resumePhaseRef.current = phaseRef.current
    worldRef.current.keys.up = worldRef.current.keys.down = worldRef.current.keys.left = worldRef.current.keys.right = false
    setPhase('paused')
    sfx.back()
  }

  const resume = () => {
    if (phaseRef.current !== 'paused') return
    setPhase(resumePhaseRef.current)
    stageRef.current?.focus({ preventScroll: true })
    sfx.select()
  }

  const toggleFullscreen = () => {
    toggleElementFullscreen(stageRef.current)
    sfx.select()
  }

  const choose = (choice) => {
    if (phaseRef.current !== 'question') return
    const question = questions[questionRef.current]
    const previous = runRef.current
    const correct = choice === question.answer
    const combo = correct ? previous.combo + 1 : 0
    const reward = correct ? LEVEL_REWARD[question.level] ?? LEVEL_REWARD.beginner : { xp: 0, coins: 0 }
    const comboCoins = correct && combo % COMBO_EVERY === 0 ? COMBO_COINS : 0
    const next = {
      ...previous,
      answers: previous.answers.map((answer, index) => (index === questionRef.current ? choice : answer)),
      correct: previous.correct + (correct ? 1 : 0),
      mistakes: previous.mistakes + (correct ? 0 : 1),
      xp: previous.xp + (correct ? reward.xp : 0),
      coins: previous.coins + (correct ? reward.coins + comboCoins : 0),
      combo,
      bestCombo: Math.max(previous.bestCombo, combo),
    }
    runRef.current = next
    setRun(next)

    if (correct) {
      worldRef.current.move = 0
      worldRef.current.advancing = false
      setFeedback({ correct: true, choice, question, xp: reward.xp, coins: reward.coins + comboCoins, comboCoins })
      setPhase('green')
      sfx.coin()
      sfx.songNote(questionRef.current)
      say('Green light. Move!')
      return
    }

    const victim = previous.mistakes < 3 ? 3 - previous.mistakes : 0
    worldRef.current.team[victim].alive = false
    worldRef.current.team[victim].deathAt = performance.now()
    worldRef.current.keys.up = worldRef.current.keys.down = worldRef.current.keys.left = worldRef.current.keys.right = false
    setFeedback({ correct: false, choice, question, victim })
    setPhase('red')
    sfx.redLight()
    say(victim === 0 ? 'Red light. Player eliminated.' : `Red light. ${TEAM[victim].name} eliminated.`)
    later(() => sfx.eliminated(), 300)
    later(() => {
      if (victim === 0) finishRef.current(true)
      else nextRef.current()
    }, 2300)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    const stage = stageRef.current
    const ctx = canvas.getContext('2d')
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    let frameId = 0
    let last = performance.now()

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const density = Math.min(window.devicePixelRatio || 1, 1.5)
      const scale = Math.min(density, 1600 / Math.max(1, rect.width))
      canvas.width = Math.max(1, Math.round(rect.width * scale))
      canvas.height = Math.max(1, Math.round(rect.height * scale))
    }
    const observer = new ResizeObserver(resize)
    observer.observe(stage)
    resize()

    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const world = worldRef.current
      if (updateScene(world, phaseRef.current, dt, reducedMotion)) sfx.chomp()
      if (phaseRef.current === 'green') {
        if (moveMeterRef.current) moveMeterRef.current.style.transform = `scaleX(${world.move})`
        if (world.move >= 1 && !world.advancing) {
          world.advancing = true
          setPhase('advance')
          sfx.reveal()
          later(() => nextRef.current(), 500)
        }
      }

      drawScene(ctx, canvas.width, canvas.height, world, phaseRef.current, total, reducedMotion)
      frameId = requestAnimationFrame(frame)
    }
    frameId = requestAnimationFrame(frame)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frameId)
      clearTimers()
    }
  }, [total])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (isTyping(event.target) || event.ctrlKey || event.metaKey || event.altKey) return
      if (event.code === 'KeyF') {
        event.preventDefault()
        toggleElementFullscreen(stageRef.current)
        sfx.select()
        return
      }
      if (event.code === 'Escape' || event.code === 'KeyP') {
        if (['question', 'green'].includes(phaseRef.current)) {
          event.preventDefault()
          pause()
        } else if (phaseRef.current === 'paused' && event.code === 'KeyP') {
          resume()
        }
        return
      }
      if (phaseRef.current === 'question' && /^Digit[1-4]$/.test(event.code)) {
        event.preventDefault()
        choose(Number(event.code.slice(-1)) - 1)
        return
      }
      const action = KEY_ACTIONS[event.code]
      if (action && phaseRef.current === 'green') {
        event.preventDefault()
        worldRef.current.keys[action] = true
      }
    }
    const onKeyUp = (event) => {
      const action = KEY_ACTIONS[event.code]
      if (action) worldRef.current.keys[action] = false
    }
    const onBlur = () => {
      if (['question', 'green'].includes(phaseRef.current)) pause()
    }
    const onVisibility = () => {
      if (document.hidden && ['question', 'green'].includes(phaseRef.current)) pause()
    }
    const onFullscreen = () => {
      const inside = fullscreenElement() === stageRef.current
      setFullscreen(inside)
      if (!inside && ['question', 'green'].includes(phaseRef.current)) pause()
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
  })

  const holdKey = (action, down) => (event) => {
    if (down) event.currentTarget.setPointerCapture?.(event.pointerId)
    worldRef.current.keys[action] = down
  }

  const question = questions[questionIndex]
  const active = ['question', 'green', 'advance', 'red', 'paused'].includes(phase)
  const fullscreenLabel = fullscreen ? 'Exit fullscreen' : 'Fullscreen'
  const FullscreenIcon = fullscreen ? Minimize : Maximize
  const teammatesAlive = Math.max(0, 3 - Math.min(run.mistakes, 3))

  return (
    <section className="rl-game" aria-labelledby="rl-posttest-title">
      <div className="rl-intro">
        <div>
          <p className="lab-kicker">EXPERIMENT 01 · SURVIVAL ARCADE</p>
          <h3 id="rl-posttest-title" className="lab-title">
            Posttest: Red Light / Green Light
          </h3>
        </div>
        <p className="lab-muted">20 questions · 4-person squad · one continuous run</p>
      </div>

      <div ref={stageRef} className={`rl-stage is-${phase}`} tabIndex={-1} role="group" aria-label="Red light green light posttest game">
        <canvas ref={canvasRef} className="rl-canvas" aria-hidden="true" />

        {active && (
          <div className="rl-hud">
            <div className="rl-topbar">
              <div className="rl-status-card">
                <span className={`rl-light is-${phase === 'green' || phase === 'advance' ? 'green' : 'red'}`} aria-hidden="true" />
                <div>
                  <span className="rl-pixel-label">{phase === 'green' || phase === 'advance' ? 'GREEN LIGHT' : 'RED LIGHT'}</span>
                  <strong>
                    Q{Math.min(questionIndex + 1, total)}/{total}
                  </strong>
                </div>
              </div>

              <div className="rl-squad-card" aria-label={`${teammatesAlive} teammate shields remaining`}>
                {TEAM.map((member, index) => {
                  const alive = index === 0 ? run.mistakes < 4 : index <= teammatesAlive
                  return (
                    <span key={member.name} className={`rl-squad-member${alive ? '' : ' is-out'}${index === 0 ? ' is-player' : ''}`}>
                      {index === 0 ? <Heart aria-hidden="true" /> : <Shield aria-hidden="true" />}
                      <span>{member.name}</span>
                    </span>
                  )
                })}
              </div>

              <div className="rl-score-card">
                <span>
                  SCORE <b>{run.correct}</b>
                </span>
                <span>
                  XP <b>{run.xp}</b>
                </span>
                <span>
                  COINS <b>{run.coins}</b>
                </span>
              </div>

              <div className="rl-buttons">
                {['question', 'green', 'paused'].includes(phase) && (
                  <button type="button" className="rl-icon-btn" onClick={phase === 'paused' ? resume : pause} aria-label={phase === 'paused' ? 'Resume' : 'Pause'}>
                    {phase === 'paused' ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
                  </button>
                )}
                <button type="button" className="rl-icon-btn" onClick={toggleFullscreen} aria-label={fullscreenLabel}>
                  <FullscreenIcon aria-hidden="true" />
                </button>
              </div>
            </div>

            {phase === 'question' && question && (
              <div className="rl-question" key={questionIndex}>
                <div className="rl-question-head">
                  <span className={`lab-level is-${question.level}`}>{question.level.toUpperCase()}</span>
                  <span className="rl-question-count">CHALLENGE {questionIndex + 1} OF {total}</span>
                </div>
                <p className="rl-prompt">{question.prompt}</p>
                <div className="rl-options">
                  {question.options.map((option, index) => (
                    <button key={option} type="button" className="rl-option" onClick={() => choose(index)}>
                      <span className="rl-option-key">{index + 1}</span>
                      <span>
                        <b>{LETTERS[index]}.</b> {option}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="rl-option-hint">Click an answer or press 1–4</p>
              </div>
            )}

            {(phase === 'green' || phase === 'advance') && (
              <div className="rl-move-card" role="status" aria-live="polite">
                <p className="rl-move-title">CORRECT — GREEN LIGHT!</p>
                <p>Hold <kbd>W</kbd> to reach the next checkpoint. Use <kbd>A</kbd><kbd>D</kbd> to steer.</p>
                <span className="rl-move-meter"><span ref={moveMeterRef} /></span>
                {feedback?.comboCoins > 0 && <small>COMBO ×{run.combo} · +{feedback.comboCoins} bonus coins</small>}
              </div>
            )}

            {phase === 'red' && feedback && (
              <div className="rl-alert" role="status" aria-live="assertive">
                <p className="rl-alert-title">RED LIGHT — {TEAM[feedback.victim].name} ELIMINATED</p>
                <p>
                  You chose {LETTERS[feedback.choice]}. Correct answer: <b>{LETTERS[feedback.question.answer]}. {feedback.question.options[feedback.question.answer]}</b>
                </p>
                <small>{feedback.question.explain}</small>
              </div>
            )}

            <p className="rl-key-legend" aria-hidden="true">
              <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> MOVE ON GREEN · <kbd>1</kbd>–<kbd>4</kbd> ANSWER · <kbd>F</kbd> FULLSCREEN · <kbd>P</kbd> PAUSE
            </p>

            {phase === 'green' && (
              <div className="rl-touch" aria-label="Movement controls">
                {TOUCH_KEYS.map(({ action, label, icon: Icon }) => (
                  <button
                    key={action}
                    type="button"
                    className={`rl-touch-btn is-${action}`}
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
          <div className="rl-overlay">
            <div className="rl-card">
              <p className="rl-kicker">PAC-LAB SURVIVAL RUN · POSTTEST</p>
              <h4 className="rl-title">Answer. Wait for green. Run.</h4>
              <p className="rl-copy">
                Complete all 20 questions in one continuous game. A correct answer turns the light green and unlocks WASD movement to the next checkpoint. A wrong answer turns it red and eliminates one squad member.
              </p>
              <div className="rl-rules">
                <div><span className="rl-rule-icon is-green">●</span><strong>Correct</strong><small>Green light — hold W and move forward.</small></div>
                <div><span className="rl-rule-icon is-red">●</span><strong>Wrong</strong><small>Red light — lose one teammate shield.</small></div>
                <div><Shield aria-hidden="true" /><strong>3 shields</strong><small>Your three teammates protect you from the first three mistakes.</small></div>
                <div><Heart aria-hidden="true" /><strong>Final life</strong><small>A fourth mistake eliminates you: game over.</small></div>
              </div>
              <p className="rl-copy is-muted">No gore: eliminated runners dissolve into retro arcade pixels. The posttest ends when you clear question 20 or lose the player.</p>
              {record && <p className="rl-last">Last run: {record.score}/{total}{record.answers?.some((answer) => answer === null) ? ' · player eliminated early' : ' · course completed'}</p>}
              <div className="rl-actions">
                <button type="button" className="lab-btn lab-btn-primary" onClick={start}>
                  <Play aria-hidden="true" />
                  {record ? 'Start new run' : 'Start survival run'}
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
          <div className="rl-overlay">
            <div className="rl-card is-compact">
              <p className="rl-kicker">PAUSED</p>
              <h4 className="rl-title">Freeze, player.</h4>
              <p className="rl-copy">Question {questionIndex + 1} of {total} · {run.correct} correct · {teammatesAlive} teammate shields left.</p>
              <div className="rl-actions">
                <button type="button" className="lab-btn lab-btn-primary" onClick={resume}><Play aria-hidden="true" />Resume</button>
                <button type="button" className="lab-btn" onClick={start}><RotateCcw aria-hidden="true" />Restart</button>
                <button type="button" className="lab-btn" onClick={quit}>Quit run</button>
              </div>
            </div>
          </div>
        )}

        {(phase === 'results' || phase === 'gameover') && result && (
          <div className="rl-overlay">
            <div className={`rl-card${result.passed ? '' : ' is-fail'}`}>
              <p className="rl-kicker">{result.passed ? 'COURSE CLEARED' : 'GAME OVER'}</p>
              <h4 className="rl-title">{result.passed ? 'All 20 challenges complete!' : 'The player was eliminated.'}</h4>
              <p className="rl-final-score">{result.score}<span>/ {total}</span></p>
              {result.passed && (
                <span className="rl-stars" role="img" aria-label={`${starsFor(result.ratio)} of 3 stars`}>
                  {[0, 1, 2].map((index) => <Star key={index} className={index < starsFor(result.ratio) ? 'is-earned' : undefined} aria-hidden="true" />)}
                </span>
              )}
              <div className="rl-results-grid">
                <div><small>ACCURACY</small><strong>{Math.round(result.ratio * 100)}%</strong></div>
                <div><small>SQUAD LEFT</small><strong>{Math.max(0, 4 - result.run.mistakes)}/4</strong></div>
                <div><small>RUN XP</small><strong>{result.run.xp}</strong></div>
                <div><small>RUN COINS</small><strong>{result.run.coins}</strong></div>
              </div>
              <p className="rl-copy">
                {result.passed
                  ? 'You protected the player through the full posttest. The next experiment is unlocked.'
                  : `You made four mistakes before reaching question 20. Restart to attempt the complete run.`}
                {(result.award.xp || result.award.coins) && ` +${result.award.xp} XP and +${result.award.coins} coins added to your profile.`}
                {result.clear && (result.clear.xp || result.clear.coins) ? ` Clear reward: +${result.clear.xp} XP, +${result.clear.coins} coins.` : ''}
              </p>
              {pretest?.finished && <p className="rl-last">Pretest {pretest.score}/{total} → Posttest {result.score}/{total}</p>}
              <div className="rl-actions">
                <button type="button" className="lab-btn lab-btn-primary" onClick={start}><RotateCcw aria-hidden="true" />Play again</button>
                {fullscreen && <button type="button" className="lab-btn" onClick={toggleFullscreen}><Minimize aria-hidden="true" />Exit fullscreen</button>}
              </div>
            </div>
          </div>
        )}
      </div>

      {record && (phase === 'ready' || phase === 'results' || phase === 'gameover') && <Review questions={questions} record={record} verb="you selected" />}
    </section>
  )
}
