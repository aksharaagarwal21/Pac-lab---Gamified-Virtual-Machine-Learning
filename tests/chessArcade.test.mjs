import test from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { HISTORY, START_FEN, newChessRun, makeTurn, playAnswer, playOpponent, chessForRun, rankMoves } from '../src/components/lab/chessArcadeModel.js'
import { pretest } from '../src/experiments/quiz/exp02.js'

test('the 20-question historical line ends in the recorded 30...Rh2# checkmate', () => {
  assert.equal(HISTORY.length, 60)
  assert.equal(pretest.length, 20)
  assert.equal(new Chess(START_FEN).turn(), 'b')
  let run = newChessRun()
  for (const question of pretest) {
    const turn = makeTurn(run, question)
    assert.equal(turn.onHistory, true)
    assert.equal(turn.choices.length, 4)
    assert.equal(new Set(turn.choices.map((c) => c.square)).size, 4)
    for (const choice of turn.choices) {
      const board = chessForRun(run)
      assert.equal(choice.move.from, turn.from, 'all answers move the same highlighted piece')
      assert.notEqual(choice.square, turn.from)
      assert.ok(board.move(choice.move), 'every choice resolves to a legal move')
      if (!choice.portal) assert.equal(choice.square, choice.move.to)
    }
    run = playAnswer(run, question, question.answer, turn).run
    if (!run.outcome) run = playOpponent(run).run
  }
  assert.equal(run.score, 20)
  assert.equal(run.index, 20)
  assert.equal(run.onHistory, true)
  assert.equal(run.outcome, 'checkmate-win')
  assert.equal(chessForRun(run).history().at(-1), 'Rh2#')
  assert.equal(chessForRun(run).isCheckmate(), true)
  assert.equal(makeTurn(run, pretest[0]), null)
})

test('all three wrong first answers branch legally and receive a computed reply', () => {
  for (const index of [0, 2, 3]) {
    const run = newChessRun()
    const turn = makeTurn(run, pretest[0])
    const answer = playAnswer(run, pretest[0], index, turn)
    assert.equal(answer.correct, false)
    assert.equal(answer.run.score, 0)
    assert.equal(answer.run.onHistory, false)
    const reply = playOpponent(answer.run)
    assert.ok(reply.move)
    assert.equal(chessForRun(reply.run).turn(), 'b')
    assert.equal(reply.run.moves.length, 2)
    const next = makeTurn(reply.run, pretest[1])
    assert.equal(next.choices.length, 4)
    assert.equal(next.onHistory, false)
  }
})

test('a mixed 20-turn run remains legal and never silently jumps back to history', () => {
  let run = newChessRun()
  for (let i = 0; i < 20 && !run.outcome; i++) {
    const question = pretest[i]
    const turn = makeTurn(run, question)
    const choice = i % 4 === 0 ? (question.answer + 1) % 4 : question.answer
    run = playAnswer(run, question, choice, turn).run
    if (!run.outcome) run = playOpponent(run).run
    assert.equal(run.onHistory, false)
    assert.equal(chessForRun(run).fen(), run.fen)
    assert.equal(run.answers.filter((v) => v !== null).length, i + 1)
  }
  assert.ok(run.outcome)
  assert.ok(run.index <= 20)
})

test('engine prioritizes checkmate, handles promotion, and never mutates its input', () => {
  const game = new Chess('7k/5Q2/6K1/8/8/8/8/8 w - - 0 1')
  const fen = game.fen()
  const best = rankMoves(game)[0]
  assert.ok(best.san.includes('#'))
  assert.equal(game.fen(), fen)
  const promotion = new Chess('7k/P7/6K1/8/8/8/8/8 w - - 0 1')
  const ranked = rankMoves(promotion)
  assert.ok(ranked.some((move) => move.promotion === 'q'))
  assert.ok(ranked.every((move) => !move.promotion || move.promotion === 'q'))
})

test('invalid answer indices cannot change the run', () => {
  const run = newChessRun()
  const turn = makeTurn(run, pretest[0])
  for (const choice of [-1, 4, null, 0.5]) assert.equal(playAnswer(run, pretest[0], choice, turn), null)
  assert.equal(run.fen, START_FEN)
  assert.equal(run.index, 0)
})
