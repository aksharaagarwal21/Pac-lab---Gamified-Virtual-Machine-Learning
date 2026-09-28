// Cross Validation Maze — game state machine. Pure, so the whole game can be played in tests.
//
// Phases: intro → setup → (transition → training → ready → test → foldResult) × k → final
//         → bonus → quiz → complete
// Timed phases advance on ADVANCE (the component schedules it); training advances when the
// player has eaten every training pellet (TRAINED); the rest wait for the student.

import { DEFAULT_SEED, POINTS, QUIZ, livesFor, luckySplit, runCrossValidation } from './model.js'

export const SPEEDS = [1, 2, 3]
export const QUIZ_LENGTH = QUIZ.length
export const READY_STEPS = ['READY!', 'MODEL TRAINED', 'UNSEEN ZONE OPENING…', 'GO!']
const READY_MS = [650, 850, 1300, 550]
const TEST_MS = [420, 650, 800] // move to sample → predicting → result
const TRANSITION_MS = 1700
export const TRAINING_MS = { simple: 5200, balanced: 5200, overfit: 3200 }

export function createGame(overrides = {}) {
  return {
    phase: 'intro',
    k: 5,
    modelId: 'balanced',
    seed: DEFAULT_SEED,
    speed: 1,
    paused: false,
    plan: null,
    round: 0,
    step: 0,
    trained: 0,
    energy: 0,
    crashed: false,
    correct: 0,
    wrong: 0,
    score: 0,
    results: [],
    stabilityBonus: 0,
    runs: [],
    lucky: null,
    quiz: null,
    event: null,
    ...overrides,
  }
}

export const currentFold = (state) => state.plan?.folds[state.round] ?? null

// Test phase: every sample takes three steps.
export function testCursor(state) {
  return { index: Math.floor(state.step / 3), sub: state.step % 3 }
}

export function stepDuration(state) {
  if (state.paused) return null
  if (state.phase === 'transition') return TRANSITION_MS
  if (state.phase === 'ready') return READY_MS[state.step]
  if (state.phase === 'test') return TEST_MS[state.step % 3]
  return null
}

function enterTraining(state) {
  const fold = currentFold(state)
  return { ...state, phase: 'training', step: 0, trained: 0, energy: livesFor(fold.samples.length), crashed: false, correct: 0, wrong: 0 }
}

// Applies the prediction for one test sample: points for a hit, a lost life for a miss.
function resolveSample(state, index) {
  const sample = currentFold(state).samples[index]
  const id = (state.event?.id ?? 0) + 1
  if (sample.correct) {
    return { ...state, correct: state.correct + 1, score: state.score + POINTS.correct, event: { id, type: 'correct', index } }
  }
  const energy = Math.max(0, state.energy - 1)
  const crashedNow = energy === 0 && !state.crashed
  return { ...state, wrong: state.wrong + 1, energy, crashed: state.crashed || energy === 0, event: { id, type: crashedNow ? 'crash' : 'wrong', index } }
}

function finishFold(state) {
  const fold = currentFold(state)
  const bonus = state.crashed ? 0 : POINTS.foldClear
  const result = {
    fold: state.round,
    correct: state.correct,
    wrong: state.wrong,
    total: fold.samples.length,
    score: fold.score,
    trainScore: fold.trainScore,
    mse: fold.mse,
    crashed: state.crashed,
    bonus,
    points: state.correct * POINTS.correct + bonus,
  }
  return {
    ...state,
    phase: 'foldResult',
    step: fold.samples.length * 3,
    score: state.score + bonus,
    results: [...state.results, result],
    event: { id: (state.event?.id ?? 0) + 1, type: 'stageClear' },
  }
}

function finishRun(state) {
  const { summary, k, modelId, degree } = state.plan
  // Consistency only earns the bonus when it is consistently good: a model that fails every fold alike is not "stable" in a useful sense.
  const stabilityBonus = summary.stability.bonus && summary.diagnosis.id === 'good' ? POINTS.stability : 0
  const run = { k, modelId, degree, trainScore: summary.trainScore, cvScore: summary.cvScore, cvStd: summary.cvStd, cvMse: summary.cvMse, gap: summary.diagnosis.gap }
  const runs = [...state.runs.filter((r) => r.k !== k || r.modelId !== modelId), run]
  return { ...state, phase: 'final', paused: false, stabilityBonus, score: state.score + stabilityBonus, runs, event: { id: (state.event?.id ?? 0) + 1, type: 'complete' } }
}

function advance(state) {
  switch (state.phase) {
    case 'transition':
      return enterTraining(state)
    case 'ready':
      return state.step < READY_STEPS.length - 1 ? { ...state, step: state.step + 1 } : { ...state, phase: 'test', step: 0 }
    case 'test': {
      const total = currentFold(state).samples.length * 3
      const step = state.step + 1
      let next = { ...state, step }
      if (step % 3 === 2) next = resolveSample(next, Math.floor(step / 3))
      return step >= total ? finishFold(next) : next
    }
    default:
      return state
  }
}

// Fast-forwards the current phase (for teachers, or students who already get the idea).
function skip(state) {
  switch (state.phase) {
    case 'transition':
      return enterTraining(state)
    case 'training':
      return { ...state, phase: 'ready', step: 0, trained: currentFold(state).trainIdx.length }
    case 'ready':
      return { ...state, phase: 'test', step: 0 }
    case 'test': {
      const total = currentFold(state).samples.length
      let next = state
      const { index, sub } = testCursor(state)
      for (let i = sub >= 2 ? index + 1 : index; i < total; i++) next = resolveSample(next, i)
      return finishFold(next)
    }
    default:
      return state
  }
}

export function reducer(state, action) {
  switch (action.type) {
    case 'START':
      return { ...state, phase: 'setup' }
    case 'SET_K':
      return state.phase === 'setup' ? { ...state, k: action.k } : state
    case 'SET_MODEL':
      return state.phase === 'setup' ? { ...state, modelId: action.modelId } : state
    case 'BEGIN': {
      const plan = runCrossValidation({ k: state.k, modelId: state.modelId, seed: state.seed })
      return { ...state, plan, phase: 'transition', round: 0, step: 0, score: 0, results: [], stabilityBonus: 0, paused: false, lucky: null, quiz: null }
    }
    case 'ADVANCE':
      return state.paused ? state : advance(state)
    case 'EAT':
      return state.phase === 'training' ? { ...state, trained: Math.min(state.trained + 1, currentFold(state).trainIdx.length) } : state
    case 'TRAINED':
      return state.phase === 'training' ? { ...state, phase: 'ready', step: 0, trained: currentFold(state).trainIdx.length } : state
    case 'SKIP':
      return skip({ ...state, paused: false })
    case 'NEXT':
      if (state.phase !== 'foldResult') return state
      return state.round + 1 < state.plan.k ? { ...state, phase: 'transition', round: state.round + 1, step: 0 } : finishRun(state)
    case 'TOGGLE_PAUSE':
      return ['transition', 'training', 'ready', 'test'].includes(state.phase) ? { ...state, paused: !state.paused } : state
    case 'SET_SPEED':
      return { ...state, speed: action.speed }
    case 'REPLAY':
      return { ...state, phase: 'setup', modelId: action.modelId ?? state.modelId, plan: null, paused: false, results: [], score: 0 }
    case 'OPEN_BONUS':
      return { ...state, phase: 'bonus', lucky: { stats: luckySplit(state.plan.modelId), stage: 'intro', answer: null } }
    case 'RUN_LUCKY':
      return { ...state, lucky: { ...state.lucky, stage: 'ask' } }
    case 'LUCKY_ANSWER':
      return { ...state, lucky: { ...state.lucky, stage: 'reveal', answer: action.answer } }
    case 'OPEN_QUIZ':
      return { ...state, phase: 'quiz', quiz: { index: 0, answers: [] } }
    case 'QUIZ_ANSWER': {
      const { index, answers } = state.quiz
      if (answers[index] != null) return state
      const right = action.choice === QUIZ[index].answer
      return { ...state, score: state.score + (right ? POINTS.quiz : 0), quiz: { index, answers: [...answers, action.choice] } }
    }
    case 'QUIZ_NEXT':
      return state.quiz.index + 1 < QUIZ.length ? { ...state, quiz: { ...state.quiz, index: state.quiz.index + 1 } } : { ...state, phase: 'complete' }
    case 'RESTART':
      return createGame({ phase: 'setup', k: state.k, modelId: state.modelId, speed: state.speed, runs: state.runs })
    default:
      return state
  }
}

export function quizCorrect(state) {
  return state.quiz ? state.quiz.answers.filter((choice, i) => choice === QUIZ[i].answer).length : 0
}
