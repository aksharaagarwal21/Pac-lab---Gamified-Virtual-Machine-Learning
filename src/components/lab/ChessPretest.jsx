import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Check, ChevronRight, Flag, Maximize, Minimize, RotateCcw, Volume2, VolumeX, X } from 'lucide-react'
import { Chess } from 'chess.js'
import { completeTask, getQuiz, saveQuiz, useProgress } from '../../progress.js'
import { getStudent } from '../../session.js'
import { sfx } from '../../sound.js'
import { Review, fullscreenElement, toggleElementFullscreen } from './quizGameKit.jsx'
import { ALL_SQUARES, FILES, MATCH, PIECE_NAMES, newChessRun, playAnswer } from './chessArcadeModel.js'
import './chessPretest.css'
import { ChessPiece as Piece } from './ChessPiece.jsx'

const LETTERS = 'ABCD'
const COLORS = ['#62dce8', '#f4cd68', '#c5a0fa', '#f28da8']
// Black's perspective: Alekhine's pieces sit nearest the player.
const SQUARES = [...ALL_SQUARES].reverse()
const position = (square) => ({ x: 7 - FILES.indexOf(square[0]), y: Number(square[1]) - 1 })
function Ghost({ className = '' }) {
  return <svg className={`cc-ghost ${className}`} viewBox="0 0 32 36" aria-hidden="true"><path d="M2 34V16a14 14 0 0 1 28 0v18l-5-4-5 4-4-4-5 4-5-4z" fill="currentColor" /><ellipse cx="12" cy="16" rx="4" ry="5" fill="#fff6e1" /><ellipse cx="23" cy="16" rx="4" ry="5" fill="#fff6e1" /><circle cx="13" cy="17" r="2" fill="#142139" /><circle cx="24" cy="17" r="2" fill="#142139" /></svg>
}

function boardPieces(fen) {
  return new Chess(fen).board().flat().filter(Boolean).map((p) => ({ ...p, id: p.square }))
}

const outcomeTitle = { 'checkmate-win': 'CHECKMATE!', 'checkmate-loss': 'KING CAUGHT', stalemate: 'STALEMATE', draw: 'DRAWN GAME', 'moves-complete': '20 MOVES PLAYED' }

export function ChessPretest({ lab, questions }) {
  const progress = useProgress()
  const saved = getQuiz(progress, lab.id, 'pretest')
  const stageRef = useRef(null)
  const workerRef = useRef(null)
  const timerRef = useRef(null)
  const requestRef = useRef(0)
  const lockedRef = useRef(true)
  const dragRef = useRef(null)
  const suppressClick = useRef(false)
  const handlers = useRef({})
  const draftKey = `pac-chess-v1:${getStudent() ?? 'guest'}:${lab.id}`
  const [draft] = useState(() => {
    try {
      const value = JSON.parse(sessionStorage.getItem(draftKey))
      if (value?.run?.answers?.length === questions.length && !value.run.outcome && Array.isArray(value.run.moves)) return value
    } catch { /* A new run is always available when session storage is blocked. */ }
    return null
  })
  const [run, setRun] = useState(draft?.run ?? newChessRun(questions.length))
  const runRef = useRef(run)
  const [pieces, setPieces] = useState(() => boardPieces(run.fen))
  const [phase, setPhase] = useState('ready')
  const [turn, setTurn] = useState(null)
  const [toast, setToast] = useState(null)
  const [lastMove, setLastMove] = useState(null)
  const [moves, setMoves] = useState([])
  const [drag, setDrag] = useState(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [muted, setMuted] = useState(false)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const [selected, setSelected] = useState(true)
  const question = questions[Math.min(run.index, questions.length - 1)]
  const playable = phase === 'playing' && turn && !lockedRef.current

  const sound = (name) => { if (!muted) sfx[name]?.() }
  const storeDraft = (next, pending) => {
    try { sessionStorage.setItem(draftKey, JSON.stringify({ run: next, pending })) } catch { /* Optional resume storage. */ }
  }
  const update = (next) => { runRef.current = next; setRun(next) }

  const animateMove = (move, fen) => {
    if (!move) return
    setLastMove(move)
    setMoves((old) => [...old, move].slice(-8))
    // Keep piece identities between squares so CSS can animate the movement.
    setPieces((old) => {
      const board = boardPieces(fen)
      const mover = old.find((p) => p.square === move.from)
      return board.map((p) => {
        if (p.square === move.to) return { ...p, id: mover?.id ?? p.square }
        const existing = old.find((item) => item.square === p.square && item.color === p.color && item.type === p.type)
        // Castling moves the rook as well; assign its existing identity.
        const castleRook = move.piece === 'k' && Math.abs(FILES.indexOf(move.from[0]) - FILES.indexOf(move.to[0])) === 2 && p.type === 'r' && p.color === move.color
          ? old.find((item) => item.type === 'r' && item.color === move.color && item.square === `${move.to[0] === 'c' ? 'a' : 'h'}${move.to[1]}`) : null
        return { ...p, id: existing?.id ?? castleRook?.id ?? `new-${p.square}-${runRef.current.moves.length}` }
      })
    })
  }

  const finish = (next) => {
    lockedRef.current = true
    update(next)
    setTurn(null)
    setPhase('finished')
    const finished = next.answers.every((answer) => answer !== null)
    saveQuiz(lab.id, 'pretest', { answers: next.answers, score: next.score, finished })
    if (finished) completeTask(lab.id, 'pretest')
    try { sessionStorage.removeItem(draftKey) } catch { /* Optional resume storage. */ }
    sound(next.outcome === 'checkmate-win' ? 'powerUp' : 'notice')
  }

  const request = (next, type) => {
    if (!workerRef.current) return
    const id = ++requestRef.current
    workerRef.current.postMessage({ id, type, run: next, question: questions[next.index] })
  }

  handlers.current.receive = (data) => {
    if (data.id !== requestRef.current) return
    if (data.error) { setError('The chess opponent could not finish its turn. Retry from this position.'); return }
    update(data.run)
    animateMove(data.move, data.run.fen)
    storeDraft(data.run, false)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      if (data.run.outcome) { finish(data.run); return }
      setTurn(data.turn)
      setSelected(true)
      lockedRef.current = false
      setPhase('playing')
    }, data.move ? 280 : 0)
  }

  useEffect(() => {
    const worker = new Worker(new URL('./chessArcadeWorker.js', import.meta.url), { type: 'module' })
    workerRef.current = worker
    worker.onmessage = ({ data }) => handlers.current.receive(data)
    worker.onerror = () => setError('The chess opponent could not load. Refresh this page to reconnect.')
    const change = () => setFullscreen(fullscreenElement() === stageRef.current)
    document.addEventListener('fullscreenchange', change)
    document.addEventListener('webkitfullscreenchange', change)
    return () => {
      worker.terminate(); workerRef.current = null; clearTimeout(timerRef.current)
      document.removeEventListener('fullscreenchange', change)
      document.removeEventListener('webkitfullscreenchange', change)
    }
  }, [])

  const start = (resume = false) => {
    clearTimeout(timerRef.current)
    const next = resume && draft ? draft.run : newChessRun(questions.length)
    update(next); setPieces(boardPieces(next.fen)); setTurn(null); setToast(null); setLastMove(null); setMoves([]); setError(null)
    setPhase('thinking'); lockedRef.current = true
    storeDraft(next, Boolean(resume && draft?.pending))
    request(next, resume && draft?.pending ? 'reply' : 'turn')
    sound('enter')
    stageRef.current?.focus({ preventScroll: true })
  }

  const choose = (index) => {
    if (lockedRef.current || phase !== 'playing' || !turn) return
    lockedRef.current = true
    const current = runRef.current
    const result = playAnswer(current, questions[current.index], index, turn)
    if (!result) { lockedRef.current = false; return }
    const { run: next, move, correct, portal } = result
    setToast({ correct, prompt: questions[current.index].prompt, answer: questions[current.index].options[questions[current.index].answer], explanation: questions[current.index].explain, portal })
    setTurn(null); setDrag(null); setPhase('thinking')
    update(next); animateMove(move, next.fen)
    saveQuiz(lab.id, 'pretest', { answers: next.answers, score: next.score, finished: false })
    storeDraft(next, true)
    sound(correct ? 'coin' : 'ghost')
    timerRef.current = setTimeout(() => {
      if (next.outcome) finish(next)
      else request(next, 'reply')
    }, 280)
  }

  const pointerDown = (event, square) => {
    if (!playable || square !== turn.from || event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { x: event.clientX, y: event.clientY, from: square, moving: false }
    setSelected(true)
  }
  const pointerMove = (event) => {
    const active = dragRef.current
    if (!active) return
    if (Math.hypot(event.clientX - active.x, event.clientY - active.y) > 5) active.moving = true
    if (active.moving) setDrag({ x: event.clientX - active.x, y: event.clientY - active.y, from: active.from })
  }
  const pointerUp = (event) => {
    const active = dragRef.current
    dragRef.current = null; setDrag(null)
    if (!active?.moving) return
    suppressClick.current = true
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-chess-choice]')
    if (target && stageRef.current?.contains(target)) choose(Number(target.dataset.chessChoice))
    // A synthetic click follows pointerup; clear suppression after it, even on an invalid drop.
    setTimeout(() => { suppressClick.current = false }, 0)
  }

  const targets = new Map(playable ? turn.choices.map((choice, i) => [choice.square, { ...choice, index: i }]) : [])
  const resultRecord = { answers: run.answers, score: run.score }
  const count = run.answers.filter((answer) => answer !== null).length

  return <section className={`cc-stage${expanded ? ' is-expanded' : ''}`} data-phase={phase} ref={stageRef} tabIndex={-1} aria-label="Checkmate Club: Experiment 2 pretest"
    onKeyDown={(event) => {
      if (/^[1-4]$/.test(event.key) && !event.repeat && !/INPUT|TEXTAREA/.test(event.target.tagName)) { event.preventDefault(); choose(Number(event.key) - 1) }
      if (event.key === 'Escape') setExpanded(false)
    }}>
    <header className="cc-header">
      <div className="cc-brand"><span className="cc-pac" /><div><span className="cc-eyebrow">PAC-LAB ARCADE / VOL. 02</span><h3>CHECKMATE CLUB<span>™</span></h3></div></div>
      <div className="cc-tools">
        <span className="cc-live"><i /> PRETEST</span>
        <button type="button" aria-label={muted ? 'Enable chess sound' : 'Mute chess sound'} onClick={() => setMuted(!muted)}>{muted ? <VolumeX /> : <Volume2 />}</button>
        <button type="button" aria-label={fullscreen || expanded ? 'Exit fullscreen' : 'Enter fullscreen'} onClick={() => {
          if (document.fullscreenEnabled || document.webkitFullscreenEnabled) toggleElementFullscreen(stageRef.current)
          else setExpanded(!expanded)
        }}>{fullscreen || expanded ? <Minimize /> : <Maximize />}</button>
      </div>
    </header>

    <div className="cc-layout">
      <aside className="cc-sidebar">
        <div className="cc-story"><span className="cc-eyebrow">THE CHAMPIONSHIP FILES</span><h4>20 moves.<br /><em>One king.</em></h4><p>Step into Alekhine’s shoes.<br />Turn your knowledge into checkmate.</p>
          <div className="cc-match"><span>1929</span><div><strong>BOGOLJUBOV vs ALEKHINE</strong><small>World Championship · Game 8</small></div><ArrowUpRight /></div>
        </div>
        <div className="cc-scoreline"><div><small>YOUR SCORE</small><strong>{String(run.score * 100).padStart(4, '0')}<span> PTS</span></strong></div><div><small>ACCURACY</small><strong>{count ? Math.round(run.score / count * 100) : '—'}<span>{count ? '%' : ''}</span></strong></div></div>

        <div className="cc-question-panel">
          <div className="cc-question-head"><span><i /> {phase === 'finished' ? 'RUN COMPLETE' : phase === 'ready' ? 'HOW TO PLAY' : 'YOUR NEXT MOVE'}</span><small>{String(Math.min(run.index + 1, 20)).padStart(2, '0')} / 20</small></div>
          {phase === 'ready' ? <div className="cc-instructions"><h4>Think. Move. Chomp.</h4><p>Answer each regression question by moving the glowing piece to its lettered square.</p><ol><li><b>01</b> Read the question and four answers.</li><li><b>02</b> Drag the glowing piece, or click it then a square. Keys 1–4 also work.</li><li><b>03</b> Your opponent replies automatically. Keep playing!</li></ol><p className="cc-fine">Correct answers follow history to 30…Rh2#. A mistake starts a new line against the computer; checkmate in 20 is then no longer guaranteed.</p><button type="button" className="cc-start" onClick={() => start(Boolean(draft))}>{draft ? 'RESUME GAME' : 'LET’S PLAY'}<ChevronRight /></button>{draft && <button type="button" className="cc-text-button" onClick={() => start(false)}>Start a fresh run</button>}</div>
          : phase === 'finished' ? <div className="cc-result"><Flag /><h4>{outcomeTitle[run.outcome] ?? 'RUN COMPLETE'}</h4><p><strong>{run.score} / {questions.length}</strong> correct answers</p><p>{count === questions.length ? 'Pretest saved. Continue to Procedure and Simulation to build your skills.' : `The chess game ended after ${count} questions. Replay to finish all 20 and complete the pretest.`}</p>{run.outcome === 'moves-complete' && <p>The 20-turn challenge is over. This position has not reached checkmate.</p>}<button type="button" className="cc-start" onClick={() => start(false)}><RotateCcw /> PLAY AGAIN</button></div>
          : <>
            <div className="cc-question-copy"><span className="cc-topic">LINEAR REGRESSION <span>•</span> {question.level}</span><h4>{phase === 'thinking' ? 'Your move is in. Opponent responding…' : question.prompt}</h4></div>
            {phase === 'playing' && <div className="cc-answers">{question.options.map((answer, index) => {
              const choice = turn?.choices[index]
              return <button type="button" key={index} data-chess-choice={index} className="cc-answer" style={{ '--choice': COLORS[index] }} disabled={!playable} onClick={() => choose(index)} aria-label={`Answer ${LETTERS[index]}: ${answer}, square ${choice?.square}`}><span className="cc-answer-key">{LETTERS[index]}</span><span>{answer}</span><small>{choice?.square}{choice?.portal && <><br />↪ {choice.move.to}</>}</small></button>
            })}</div>}
            {phase === 'thinking' && <div className="cc-thinking"><Ghost /><span className="cc-pellets">••••••••</span><span className="cc-pac" /></div>}
            <div className="cc-feedback" role="status" aria-live="polite">{toast ? <><span className={toast.correct ? 'is-correct' : 'is-wrong'}>{toast.correct ? <Check /> : <X />}{toast.correct ? 'Correct. Nice move!' : `Not quite. ${toast.answer}`}</span><p>{toast.explanation}</p></> : <p>The glowing piece is yours. Match an answer to its square.</p>}</div>
          </>}
        </div>
      </aside>

      <main className="cc-arena">
        <div className="cc-player cc-opponent"><div className="cc-avatar"><Ghost /></div><div><strong>Efim Bogoljubov</strong><span>{run.onHistory ? 'HISTORICAL OPPONENT' : 'COMPUTER OPPONENT'} <i>•</i> WHITE</span></div><span className="cc-player-status">{phase === 'thinking' ? 'THINKING…' : '1929'}</span></div>
        <div className="cc-board-wrap">
          <div className="cc-board" role="group" aria-label="Chess board, Black at the bottom">
            {SQUARES.map((square) => {
              const pos = position(square)
              const target = targets.get(square)
              const piece = pieces.find((p) => p.square === square)
              const active = playable && square === turn.from
              const last = lastMove && (square === lastMove.from || square === lastMove.to)
              return <button type="button" key={square} data-square={square} data-chess-choice={target?.index}
                className={`cc-square ${(pos.x + pos.y) % 2 ? 'is-dark' : 'is-light'}${active ? ' is-active' : ''}${active && selected ? ' is-selected' : ''}${target ? ' is-target' : ''}${last ? ' is-last' : ''}`}
                style={{ '--choice': target ? COLORS[target.index] : undefined }}
                aria-label={`${square}${piece ? ` ${piece.color === 'b' ? 'black' : 'white'} ${PIECE_NAMES[piece.type]}` : ''}${active ? ', selected piece' : ''}${target ? `, answer ${LETTERS[target.index]}: ${question.options[target.index]}${target.portal ? `, portal to ${target.move.to}` : ''}` : ''}`}
                aria-disabled={!active && !target} tabIndex={active || target ? 0 : -1}
                onPointerDown={(event) => pointerDown(event, square)} onPointerMove={pointerMove} onPointerUp={pointerUp}
                onPointerCancel={() => { dragRef.current = null; setDrag(null) }}
                onClick={() => { if (suppressClick.current) return; if (active) { setSelected(true); sound('select') } else if (target) choose(target.index) }}>
                {pos.x === 0 && <span className="cc-rank">{square[1]}</span>}{pos.y === 7 && <span className="cc-file">{square[0]}</span>}
                {target && <span className="cc-target-letter">{LETTERS[target.index]}<small>{target.portal ? `↪ ${target.move.to}` : square}</small></span>}
                {active && <span className="cc-active-corners" />}
              </button>
            })}
            <div className="cc-pieces" aria-hidden="true">{pieces.map((piece) => {
              const pos = position(piece.square)
              const active = playable && piece.square === turn?.from
              const dragging = drag?.from === piece.square
              return <div key={piece.id} className={`cc-piece${active ? ' is-glowing' : ''}${dragging ? ' is-dragging' : ''}`} style={{ left: `${pos.x * 12.5}%`, top: `${pos.y * 12.5}%`, transform: dragging ? `translate(${drag.x}px, ${drag.y}px)` : undefined }}><Piece type={piece.type} color={piece.color} /></div>
            })}</div>
            {lastMove && <div key={`${run.moves.length}-${lastMove.to}`} className="cc-chomp-trail" style={{ left: `${position(lastMove.to).x * 12.5}%`, top: `${position(lastMove.to).y * 12.5}%` }}><span className="cc-pac" /></div>}
            {phase === 'ready' && <div className="cc-board-badge"><span className="cc-pac" /> YOUR SEAT IS READY <span>BLACK TO MOVE</span></div>}
          </div>
        </div>
        <div className="cc-player cc-you"><div className="cc-avatar"><span className="cc-pac" /></div><div><strong>You as Alexander Alekhine</strong><span>PLAYER 01 <i>•</i> BLACK / CORAL PIECES</span></div><span className="cc-player-status">{phase === 'playing' ? turn.inCheck ? 'IN CHECK' : 'YOUR TURN' : phase === 'finished' ? 'GG!' : 'READY'}</span></div>
        <div className="cc-board-caption"><span className="cc-caption-dot" /><span>{playable ? `Move your ${PIECE_NAMES[turn.piece]} from ${turn.from}.` : 'One piece. Four answers. Your next move.'}</span><span className="cc-line-badge">{run.onHistory ? 'HISTORY LINE' : 'YOUR OWN LINE'}</span></div>
        <div className="cc-move-strip" aria-label="Recent chess moves"><span>MOVES</span>{moves.length ? moves.map((move, i) => <span key={`${i}-${move.san}`} className={move.color === 'b' ? 'is-black' : ''}>{move.color === 'b' ? '…' : ''}{move.san}</span>) : <small>Start at 11… · Finish at 30…Rh2#</small>}</div>
      </main>
    </div>
    {error && <div className="cc-error" role="alert">{error}<button type="button" onClick={() => { setError(null); request(runRef.current, new Chess(runRef.current.fen).turn() === 'w' ? 'reply' : 'turn') }}>Retry turn</button></div>}
    <footer className="cc-footer"><div className="cc-progress" aria-label={`${count} of 20 questions answered`}>{questions.map((q, i) => <i key={i} className={run.answers[i] === null ? '' : run.answers[i] === q.answer ? 'is-correct' : 'is-wrong'} />)}<span>{count}/20</span></div><span>DRAG & DROP <i>·</i> CLICK TO MOVE <i>·</i> KEYS 1–4</span></footer>
    <details className="cc-rules"><summary>Game notes & original match <ArrowUpRight /></summary><p>You play the final 20 Black turns of {MATCH.white} vs {MATCH.black}, {MATCH.event}. Correct quiz answers reproduce Alekhine’s recorded moves through 30…Rh2#. After any wrong answer the computer chooses replies using a short tactical search. The new line may end early or reach the 20-turn limit without mate.</p><p>Only the glowing piece can move. When that piece has fewer than four legal destinations, squares marked ↪ are answer portals: drop there to choose the answer and the piece lands on the displayed legal destination. Sometimes several answers must share one forced move. Promotions use a queen.</p><a href={MATCH.source} target="_blank" rel="noreferrer">Read the annotated historical game <ArrowUpRight /></a></details>
    {phase === 'finished' && <Review questions={questions} record={resultRecord} />}
    {phase === 'ready' && saved?.finished && <p className="cc-previous">Previous pretest: {saved.score}/{questions.length} correct. Play again to set a new score.</p>}
  </section>
}
