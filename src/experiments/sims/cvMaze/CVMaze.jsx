// Experiment 3 — Cross Validation Maze. The arcade shell: state machine, timers and screen layout.
// Game rules live in game.js; the real k-fold cross-validation lives in model.js.

import { useEffect, useReducer, useRef, useState } from 'react'
import { createGame, reducer, stepDuration } from './game.js'
import { MODELS, TOLERANCE, num, pct, pctNumber, pythonCode } from './model.js'
import { OverviewMaze, TestMaze } from './MazeStages.jsx'
import { ArcadeHUD, ControlBar, FoldScoreboard, MLView, MazeLegend, MiniMap, PauseOverlay } from './panels.jsx'
import { CVQuiz, CVResults, CompleteScreen, CrashBanner, IntroScreen, LuckySplit, ReadyBanner, SetupScreen, StageClear, StageHeader, TransitionScreen } from './screens.jsx'
import './cvMaze.css'

const CRASH_MS = 1600
const PLAYING = ['transition', 'training', 'ready', 'test', 'foldResult']
const DIAGNOSIS_NOTE = {
  overfit: 'Training accuracy is far above the cross-validated accuracy: the model memorised the training folds.',
  underfit: 'Training and cross-validated accuracy are both low: the model is too simple for the curve.',
  good: 'Training and cross-validated accuracy are close: the model generalizes to unseen folds.',
}

export default function CVMaze({ onSaveResult, onUsePython }) {
  const [game, dispatch] = useReducer(reducer, undefined, () => createGame())
  const [savedPlan, setSavedPlan] = useState(null)
  const [crashing, setCrashing] = useState(false)
  const rootRef = useRef(null)
  const { phase, plan, paused, speed, event } = game

  // Timed phases (fold rotation, READY banner, each test sample) advance on their own.
  const duration = stepDuration(game)
  useEffect(() => {
    if (duration == null) return
    const timer = setTimeout(() => dispatch({ type: 'ADVANCE' }), duration / speed)
    return () => clearTimeout(timer)
  }, [duration, speed, phase, game.step, game.round])

  // "MODEL CRASHED!" flashes once when the last life is lost. Later samples must not cancel the
  // hide timer, so it lives in a ref and is only cleared on unmount.
  const crashTimer = useRef(null)
  useEffect(() => {
    if (event?.type !== 'crash') return
    setCrashing(true)
    clearTimeout(crashTimer.current)
    crashTimer.current = setTimeout(() => setCrashing(false), CRASH_MS / speed)
  }, [event]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => clearTimeout(crashTimer.current), [])

  // Keep the arcade in view when the screen changes (the results pages are taller than the maze).
  const screen = PLAYING.includes(phase) ? 'play' : phase
  useEffect(() => {
    const root = rootRef.current
    if (!root || screen === 'intro') return
    if (root.getBoundingClientRect().top < 0) root.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [screen])

  // P or Escape pauses while a round is running.
  useEffect(() => {
    if (!['transition', 'training', 'ready', 'test'].includes(phase)) return
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select')) return
      if (e.key === 'p' || e.key === 'P' || (e.key === 'Escape' && !paused)) {
        e.preventDefault()
        dispatch({ type: 'TOGGLE_PAUSE' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, paused])

  const saved = Boolean(plan) && savedPlan === plan
  const save = () => {
    if (!plan) return
    const { summary, k, modelId, degree } = plan
    onSaveResult?.({
      title: `${MODELS[modelId].name} model (degree ${degree}) · ${k}-fold cross-validation maze`,
      metrics: [
        { label: 'CV score', value: pct(summary.cvScore) },
        { label: 'Fold spread (±)', value: pct(summary.cvStd) },
        { label: 'Training score', value: pct(summary.trainScore) },
        { label: 'Generalization gap', value: `${pctNumber(Math.max(0, summary.diagnosis.gap))} points` },
        { label: 'CV MSE', value: num(summary.cvMse, 3) },
        { label: 'Fold scores', value: summary.scores.map(pct).join(' · ') },
      ],
      explanation: `${summary.diagnosis.label}. ${DIAGNOSIS_NOTE[summary.diagnosis.id]} Every one of the ${k} folds was the unseen test zone exactly once; the CV score is the mean of the ${k} fold scores (a prediction counts as correct within ±${TOLERANCE}).`,
    })
    setSavedPlan(plan)
  }
  const python = () => plan && onUsePython?.(pythonCode(plan.k, plan.degree))

  return (
    <div ref={rootRef} className={`cvm-arcade is-${phase}${plan?.modelId === 'overfit' ? ' is-overfit' : ''}`}>
      {phase === 'intro' && <IntroScreen onStart={() => dispatch({ type: 'START' })} />}

      {phase !== 'intro' && (
        <>
          <ArcadeHUD game={game} />
          {screen === 'setup' && (
            <div className="cvm-layout">
              <div className="cvm-main">
                <SetupScreen game={game} dispatch={dispatch} />
              </div>
              <aside className="cvm-side">
                <MLView game={game} />
                <MiniMap game={game} />
              </aside>
            </div>
          )}

          {screen === 'play' && (
            <div className="cvm-layout">
              <div className="cvm-main">
                {phase !== 'transition' && <StageHeader game={game} />}
                <div className="cvm-stage">
                  {phase === 'transition' && <TransitionScreen game={game} />}
                  {(phase === 'training' || phase === 'ready') && (
                    <OverviewMaze game={game} onEat={() => dispatch({ type: 'EAT' })} onTrained={() => dispatch({ type: 'TRAINED' })} />
                  )}
                  {(phase === 'test' || phase === 'foldResult') && <TestMaze game={game} />}
                  {phase === 'ready' && !paused && <ReadyBanner game={game} />}
                  {crashing && phase === 'test' && !paused && <CrashBanner />}
                  {phase === 'foldResult' && <StageClear game={game} dispatch={dispatch} />}
                  {paused && <PauseOverlay game={game} dispatch={dispatch} />}
                </div>
                <ControlBar game={game} dispatch={dispatch} />
              </div>
              <aside className="cvm-side">
                <MLView game={game} />
                <FoldScoreboard game={game} />
                <MiniMap game={game} />
              </aside>
            </div>
          )}

          {phase === 'final' && <CVResults game={game} dispatch={dispatch} onSave={save} onPython={python} saved={saved} />}
          {phase === 'bonus' && <LuckySplit game={game} dispatch={dispatch} />}
          {phase === 'quiz' && <CVQuiz game={game} dispatch={dispatch} />}
          {phase === 'complete' && <CompleteScreen game={game} dispatch={dispatch} onSave={save} onPython={python} saved={saved} />}

          <MazeLegend />
        </>
      )}
    </div>
  )
}
