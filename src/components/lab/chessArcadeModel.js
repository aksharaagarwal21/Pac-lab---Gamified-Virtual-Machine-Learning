import { Chess } from 'chess.js'

// Bogoljubov–Alekhine, World Championship, game 8, 19 September 1929.
// Score cross-checked with IM Max Illingworth's annotated game:
// https://canberraacademyofchess.com.au/learning-alekhine
export const MATCH = {
  white: 'Efim Bogoljubov', black: 'Alexander Alekhine',
  event: 'World Championship · Game 8 · 1929',
  source: 'https://canberraacademyofchess.com.au/learning-alekhine',
}
export const MATCH_PGN = `1. d4 Nf6 2. c4 b6 3. Nc3 Bb7 4. f3 d5 5. cxd5 Nxd5
6. e4 Nxc3 7. bxc3 e6 8. Bb5+ Nd7 9. Ne2 Be7 10. O-O a6
11. Bd3 c5 12. Bb2 Qc7 13. f4 Nf6 14. Ng3 h5 15. Qe2 h4
16. Nh1 Nh5 17. Qg4 O-O-O 18. Rae1 Kb8 19. f5 e5 20. d5 c4
21. Bc2 Bc5+ 22. Nf2 g6 23. fxg6 Rdg8 24. Bc1 Bc8 25. Qf3 Rxg6
26. Kh1 Ng3+ 27. hxg3 hxg3+ 28. Nh3 Bxh3 29. gxh3 Rxh3+ 30. Kg2 Rh2# 0-1`
const replay = new Chess()
replay.loadPgn(MATCH_PGN)
export const HISTORY = replay.history({ verbose: true })
export const START_PLY = 21 // Immediately before 11...c5: 20 Black decisions remain.
export const START_FEN = HISTORY[START_PLY].before
export const PIECE_NAMES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' }
export const FILES = 'abcdefgh'
export const ALL_SQUARES = Array.from({ length: 64 }, (_, i) => `${FILES[i % 8]}${8 - Math.floor(i / 8)}`)
const VALUES = { p: 100, n: 320, b: 335, r: 500, q: 900, k: 0 }
const spec = (move) => ({ from: move.from, to: move.to, ...(move.promotion ? { promotion: move.promotion } : {}) })
const uniqueMoves = (moves) => moves.filter((move) => !move.promotion || move.promotion === 'q')
const priority = (move) => (move.san.includes('#') ? 100000 : 0) + (VALUES[move.captured] ?? 0) * 10 - (move.captured ? VALUES[move.piece] : 0) + (move.san.includes('+') ? 40 : 0) + (move.promotion ? 800 : 0)

function evaluate(game) {
  let score = 0
  for (const row of game.board()) for (const piece of row) {
    if (!piece) continue
    const file = FILES.indexOf(piece.square[0])
    const rank = Number(piece.square[1])
    const center = 7 - Math.abs(3.5 - file) - Math.abs(4.5 - rank)
    const advance = piece.color === 'w' ? rank - 2 : 7 - rank
    const positional = piece.type === 'p' ? advance * 8 : piece.type === 'k' ? -center * 2 : center * 4
    score += (piece.color === 'w' ? 1 : -1) * (VALUES[piece.type] + positional)
  }
  return score * (game.turn() === 'w' ? 1 : -1)
}

// Small deterministic alpha-beta opponent; runs in a worker in the UI.
// Two plies, ordered captures/checks, bounded node count. Not a grandmaster engine.
function search(game, depth, alpha, beta, budget, ply = 0) {
  budget.nodes++
  if (depth === 0 || budget.nodes >= budget.max) return evaluate(game)
  const moves = game.moves({ verbose: true })
  if (!moves.length) return game.isCheck() ? -100000 + ply : 0
  let best = -Infinity
  moves.sort((a, b) => priority(b) - priority(a))
  for (const move of moves) {
    if (move.san.includes('#')) return 100000 - ply
    game.move(spec(move))
    const value = -search(game, depth - 1, -beta, -alpha, budget, ply + 1)
    game.undo()
    best = Math.max(best, value)
    alpha = Math.max(alpha, value)
    if (alpha >= beta) break
  }
  return best
}

export function rankMoves(game, candidates = uniqueMoves(game.moves({ verbose: true })), depth = 2) {
  const budget = { nodes: 0, max: 3500 }
  return [...candidates].sort((a, b) => priority(b) - priority(a)).map((move) => {
    if (move.san.includes('#')) return { ...move, score: 100000 }
    game.move(spec(move))
    const score = -search(game, depth - 1, -Infinity, Infinity, budget, 1)
    game.undo()
    return { ...move, score }
  }).sort((a, b) => b.score - a.score || priority(b) - priority(a))
}

export function newChessRun(total = 20) {
  return { fen: START_FEN, moves: [], answers: Array(total).fill(null), index: 0, score: 0, onHistory: true, outcome: null }
}

export function chessForRun(run) {
  const game = new Chess(START_FEN)
  for (const move of run.moves) game.move(move)
  return game
}

function boardOutcome(game) {
  if (game.isCheckmate()) return game.turn() === 'w' ? 'checkmate-win' : 'checkmate-loss'
  if (game.isStalemate()) return 'stalemate'
  if (game.isDraw()) return 'draw'
  return null
}

export function makeTurn(run, question) {
  const game = chessForRun(run)
  if (run.outcome || game.isGameOver()) return null
  const historical = HISTORY[START_PLY + run.index * 2]
  const onHistory = run.onHistory && historical?.before === game.fen()
  const all = uniqueMoves(game.moves({ verbose: true }))
  const preferred = onHistory ? all.find((move) => move.san === historical.san) : rankMoves(game)[0]
  if (!preferred) return null
  const samePiece = all.filter((move) => move.from === preferred.from && move.to !== preferred.to)
  const alternatives = rankMoves(game, samePiece, 1)
  const chosen = [preferred, ...alternatives.slice(-3)]
  // The historical pawn/king sometimes has fewer than four legal destinations.
  // Additional answer portals route to an available move of that SAME piece.
  // Never invent a chess move, skip a turn, or teleport a piece on the actual board.
  const used = new Set(chosen.map((move) => move.to))
  used.add(preferred.from)
  const spare = ALL_SQUARES.filter((square) => !game.get(square) && !used.has(square))
    .sort((a, b) => {
      const dist = (s) => Math.abs(FILES.indexOf(s[0]) - FILES.indexOf(preferred.from[0])) + Math.abs(Number(s[1]) - Number(preferred.from[1]))
      return dist(a) - dist(b) || a.localeCompare(b)
    })
  const otherChoices = chosen.slice(1).map((move) => ({ square: move.to, move: spec(move), san: move.san, portal: false }))
  while (otherChoices.length < 3) {
    const move = alternatives[alternatives.length - 1] ?? preferred
    otherChoices.push({ square: spare.shift(), move: spec(move), san: move.san, portal: true })
  }
  let other = 0
  const choices = question.options.map((_, index) => index === question.answer
    ? { square: preferred.to, move: spec(preferred), san: preferred.san, portal: false }
    : otherChoices[other++])
  return { from: preferred.from, piece: preferred.piece, choices, onHistory, inCheck: game.isCheck() }
}

// Split player/opponent phases for immediate feedback and a visible reply animation.
export function playAnswer(run, question, choice, turn) {
  if (!turn || run.outcome || run.answers[run.index] !== null || !Number.isInteger(choice) || choice < 0 || choice > 3) return null
  const game = chessForRun(run)
  const selected = turn.choices[choice]
  const move = game.move(selected.move)
  const correct = choice === question.answer
  const answers = [...run.answers]
  answers[run.index] = choice
  const next = { ...run, answers, score: run.score + Number(correct), index: run.index + 1,
    moves: [...run.moves, spec(move)], fen: game.fen(), onHistory: run.onHistory && correct && turn.onHistory,
    outcome: boardOutcome(game) }
  return { run: next, move: { ...spec(move), san: move.san, color: move.color, piece: move.piece }, correct, portal: selected.portal }
}

export function playOpponent(run) {
  const game = chessForRun(run)
  if (run.outcome || game.isGameOver()) return { run: { ...run, outcome: run.outcome ?? boardOutcome(game) }, move: null }
  const historical = HISTORY[START_PLY + (run.index - 1) * 2 + 1]
  const scripted = run.onHistory && historical?.before === game.fen()
  const selected = scripted ? historical : rankMoves(game, undefined, 2)[0]
  if (!selected) return { run: { ...run, outcome: boardOutcome(game) }, move: null }
  const move = game.move(spec(selected))
  const next = { ...run, fen: game.fen(), moves: [...run.moves, spec(move)], onHistory: Boolean(scripted),
    outcome: boardOutcome(game) ?? (run.index >= run.answers.length ? 'moves-complete' : null) }
  return { run: next, move: { ...spec(move), san: move.san, color: move.color, piece: move.piece } }
}
