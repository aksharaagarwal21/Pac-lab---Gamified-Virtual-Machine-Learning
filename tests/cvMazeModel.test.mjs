import test from 'node:test'
import assert from 'node:assert/strict'
import { createGame, currentFold, reducer, stepDuration, testCursor } from '../src/experiments/sims/cvMaze/game.js'
import { DATA, N, POINTS, QUIZ, TOLERANCE, diagnose, livesFor, luckySplit, pythonCode, runCrossValidation, stabilityOf, starsFor } from '../src/experiments/sims/cvMaze/model.js'

const act = (state, ...actions) => actions.reduce((s, a) => reducer(s, typeof a === 'string' ? { type: a } : a), state)

// Plays every round to the final screen the way the component would.
function playRun(state) {
  let s = act(state, 'BEGIN')
  for (let guard = 0; s.phase !== 'final' && guard < 5000; guard++) {
    if (s.phase === 'training') s = act(s, 'EAT', 'TRAINED')
    else if (s.phase === 'foldResult') s = act(s, 'NEXT')
    else s = act(s, 'ADVANCE')
  }
  return s
}

test('every sample is the unseen test sample exactly once', () => {
  for (const k of [3, 5, 10]) {
    const plan = runCrossValidation({ k, modelId: 'balanced' })
    const tested = plan.folds.flatMap((f) => f.testIdx).sort((a, b) => a - b)
    assert.deepEqual(tested, DATA.map((_, i) => i))
    for (const fold of plan.folds) {
      assert.equal(fold.trainIdx.length + fold.testIdx.length, N)
      assert.ok(fold.trainIdx.every((i) => !fold.testIdx.includes(i)), 'training never sees the test fold')
    }
  }
})

test('fold scores and hits come from real predictions within the tolerance', () => {
  const plan = runCrossValidation({ k: 5, modelId: 'balanced' })
  for (const fold of plan.folds) {
    for (const s of fold.samples) assert.equal(s.correct, Math.abs(s.y - s.predicted) <= TOLERANCE)
    assert.equal(fold.score, fold.correct / fold.samples.length)
  }
  const mean = plan.folds.reduce((sum, f) => sum + f.score, 0) / plan.k
  assert.ok(Math.abs(plan.summary.cvScore - mean) < 1e-12)
})

test('the three models tell the underfit / good / overfit story', () => {
  const run = (modelId) => runCrossValidation({ k: 5, modelId }).summary
  assert.equal(run('simple').diagnosis.id, 'underfit')
  assert.equal(run('balanced').diagnosis.id, 'good')
  const overfit = run('overfit')
  assert.equal(overfit.diagnosis.id, 'overfit')
  assert.ok(overfit.trainScore > run('balanced').trainScore, 'the overfitted model aces training')
  assert.ok(overfit.cvScore < run('balanced').cvScore, 'but loses on unseen folds')
})

test('diagnosis, stability and star thresholds', () => {
  assert.equal(diagnose(0.99, 0.62).id, 'overfit')
  assert.equal(diagnose(0.5, 0.5).id, 'underfit')
  assert.equal(diagnose(0.8, 0.78).id, 'good')
  assert.equal(stabilityOf([0.8, 0.8, 0.8]).label, 'VERY STABLE')
  assert.equal(stabilityOf([0, 1, 0, 1]).bonus, false)
  assert.equal(starsFor(1), 5)
  assert.equal(starsFor(0), 0)
  assert.equal(livesFor(8), 5)
})

test('a full game reaches the final screen with a consistent score', () => {
  const s = playRun(act(createGame(), 'START'))
  assert.equal(s.phase, 'final')
  assert.equal(s.results.length, s.k)
  const correct = s.results.reduce((sum, r) => sum + r.correct, 0)
  const clears = s.results.reduce((sum, r) => sum + r.bonus, 0)
  assert.equal(s.score, correct * POINTS.correct + clears + s.stabilityBonus)
  for (const r of s.results) {
    assert.equal(r.correct + r.wrong, r.total)
    assert.equal(r.bonus, r.crashed ? 0 : POINTS.foldClear)
  }
  assert.deepEqual(s.runs.map((r) => r.modelId), ['balanced'])
})

test('a consistently bad model gets no stability bonus', () => {
  const s = playRun(act(createGame({ k: 3, modelId: 'overfit' }), 'START'))
  assert.equal(s.plan.summary.stability.bonus, true, 'its fold scores are similar…')
  assert.equal(s.stabilityBonus, 0, '…but similarly poor')
  assert.equal(playRun(act(createGame({ k: 3 }), 'START')).stabilityBonus, POINTS.stability)
})

test('running out of lives crashes the model but the fold is still evaluated', () => {
  let s = act(createGame({ modelId: 'overfit' }), 'START', 'BEGIN', 'ADVANCE', 'TRAINED')
  while (s.phase !== 'test') s = act(s, 'ADVANCE')
  const fold = currentFold(s)
  while (s.phase === 'test') s = act(s, 'ADVANCE')
  const result = s.results[0]
  assert.equal(result.total, fold.samples.length)
  assert.equal(result.correct, fold.correct)
  assert.equal(result.crashed, fold.wrong >= livesFor(fold.samples.length))
})

test('skip finishes a fold with the same result as playing it', () => {
  const start = act(createGame(), 'START', 'BEGIN', 'SKIP', 'SKIP', 'SKIP', 'ADVANCE', 'ADVANCE')
  assert.equal(start.phase, 'test')
  assert.equal(testCursor(start).sub, 2, 'first sample already resolved')
  const skipped = act(start, 'SKIP')
  let played = start
  while (played.phase === 'test') played = act(played, 'ADVANCE')
  assert.deepEqual(skipped.results, played.results)
  assert.equal(skipped.score, played.score)
})

test('pause stops the clock; setup choices are locked once playing', () => {
  const paused = act(createGame(), 'START', 'BEGIN', 'TOGGLE_PAUSE')
  assert.equal(stepDuration(paused), null)
  assert.equal(act(paused, 'ADVANCE').phase, 'transition')
  assert.equal(act(paused, { type: 'SET_K', k: 10 }).k, 5)
})

test('bonus level, quiz and restart', () => {
  let s = playRun(act(createGame(), 'START'))
  const before = s.score
  s = act(s, 'OPEN_BONUS', 'RUN_LUCKY', { type: 'LUCKY_ANSWER', answer: 'no' }, 'OPEN_QUIZ')
  assert.equal(s.lucky.answer, 'no')
  for (const q of QUIZ) s = act(s, { type: 'QUIZ_ANSWER', choice: q.answer }, { type: 'QUIZ_ANSWER', choice: 0 }, 'QUIZ_NEXT')
  assert.equal(s.phase, 'complete')
  assert.equal(s.score, before + QUIZ.length * POINTS.quiz, 'a second answer to the same question is ignored')
  const again = act(s, 'RESTART')
  assert.equal(again.phase, 'setup')
  assert.equal(again.runs.length, 1, 'played runs are kept for comparison')
})

test('lucky split spread brackets the CV score; python export is self-contained', () => {
  const stats = luckySplit('balanced', 60)
  const cv = runCrossValidation({ k: 5, modelId: 'balanced' }).summary.cvScore
  assert.ok(stats.worst < cv && cv < stats.best)
  assert.equal(stats.buckets.reduce((sum, b) => sum + b.count, 0), 60)
  const code = pythonCode(5, 3)
  assert.match(code, /K = 5/)
  assert.match(code, /DEGREE = 3/)
  assert.doesNotMatch(code, /import (numpy|sklearn)/)
})
