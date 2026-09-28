// Python Speed Code: students type a whole experiment program by hand, part by part, typing-test style.
// Finishing every part once is required before the next experiment unlocks (see progress.js).

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight, Check, Download, Keyboard, Lock, Play, RotateCcw, Timer, Trophy } from 'lucide-react'
import { LABS } from '../../../data/labs.js'
import { runPython } from '../../../lib/python.js'
import { finishSpeedCode, labStatus, resetSpeedAttempt, saveSpeedPart, useProgress } from '../../../progress.js'
import { sfx } from '../../../sound.js'
import { PART_SEPARATOR, accuracy, assembleProgram, backspace, charStates, formatTime, isDone, startTyping, totals, typeText, wpm } from './typingModel.js'
import './speedCode.css'

const pctText = (value) => `${Math.round(value * 100)}%`

// ---------- Code view: the target code, coloured as it is typed, with a gliding caret ----------

function CodeView({ target, typed, firstLine, focused, blocked, shake }) {
  const boxRef = useRef(null)
  const anchorRef = useRef(null)
  const caretRef = useRef(null)
  const caret = typed.length
  const states = useMemo(() => charStates(typed, target), [typed, target])

  const lines = []
  let start = 0
  target.split('\n').forEach((text, row) => {
    const end = start + text.length
    const segments = []
    let segStart = start
    const flush = (to) => {
      if (to > segStart) segments.push({ from: segStart, to, state: states[segStart] })
      segStart = to
    }
    for (let i = start; i < end; i++) {
      if (i === caret) {
        flush(i)
        segments.push({ caret: true, key: `c${i}` })
      }
      if (states[i] !== states[segStart]) flush(i)
    }
    flush(end)
    if (caret === end) segments.push({ caret: true, key: `c${end}` })
    const newlineBad = end < target.length && states[end] === 'bad'
    lines.push({ row, start, end, segments, newlineBad, current: caret >= start && caret <= end })
    start = end + 1
  })

  // Shake on a refused key (blocked by a mistake, or a paste): restart the animation each time.
  useEffect(() => {
    const box = boxRef.current
    if (!box || !shake) return
    box.classList.remove('is-shaking')
    void box.offsetWidth
    box.classList.add('is-shaking')
  }, [shake])

  // Glide the caret to the anchor and keep it in view.
  useLayoutEffect(() => {
    const box = boxRef.current
    const anchor = anchorRef.current
    const caretEl = caretRef.current
    if (!box || !anchor || !caretEl) return
    const x = anchor.offsetLeft
    const y = anchor.offsetTop
    caretEl.style.transform = `translate(${x}px, ${y}px)`
    caretEl.classList.remove('is-idle')
    const timer = setTimeout(() => caretEl.classList.add('is-idle'), 600)
    // Offsets are relative to the code box (the caret's and the anchor's positioned parent).
    const margin = 60
    const top = y < box.scrollTop + margin || y > box.scrollTop + box.clientHeight - margin ? Math.max(0, y - box.clientHeight / 2) : box.scrollTop
    const left = x < box.scrollLeft + margin || x > box.scrollLeft + box.clientWidth - margin ? Math.max(0, x - box.clientWidth / 2) : box.scrollLeft
    if (top !== box.scrollTop || left !== box.scrollLeft) box.scrollTo({ top, left, behavior: 'smooth' })
    return () => clearTimeout(timer)
  }, [caret, target])

  return (
    <div ref={boxRef} className={`sc-code${focused ? ' is-focused' : ''}${blocked ? ' is-blocked' : ''}`}>
      <span ref={caretRef} className="sc-caret" aria-hidden="true" />
      {lines.map((line) => (
        <div key={line.row} className={`sc-line${line.current ? ' is-current' : ''}`}>
          <span className="sc-ln" aria-hidden="true">
            {firstLine + line.row}
          </span>
          <span className="sc-text">
            {line.segments.map((seg) =>
              seg.caret ? (
                <span key={seg.key} ref={anchorRef} className="sc-anchor" />
              ) : (
                <span key={seg.from} className={`sc-${seg.state}`}>
                  {target.slice(seg.from, seg.to)}
                </span>
              ),
            )}
            {line.newlineBad && <span className="sc-bad sc-nl">↵</span>}
          </span>
        </div>
      ))}
    </div>
  )
}

// ---------- Typing one part ----------

function TypingPart({ part, index, count, fileName, firstLine, onDone, onExit }) {
  const target = part.code
  const inputRef = useRef(null)
  const [typing, setTyping] = useState(() => startTyping(target))
  const typingRef = useRef(typing)
  const [clock, setClock] = useState({ startedAt: null, paused: 0, blurAt: null, now: 0 })
  const [focused, setFocused] = useState(false)
  const [notice, setNotice] = useState('')
  const [shake, setShake] = useState(0)
  const finished = useRef(false)

  const elapsed = clock.startedAt == null ? 0 : Math.max(0, (clock.blurAt ?? clock.now) - clock.startedAt - clock.paused)
  const liveWpm = wpm(typing.correctKeys, elapsed)
  const progress = typing.typed.length / target.length

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true })
  }, [])

  // Clock ticks only while the student is typing in the box.
  useEffect(() => {
    if (clock.startedAt == null || clock.blurAt != null) return
    const timer = setInterval(() => setClock((c) => ({ ...c, now: performance.now() })), 250)
    return () => clearInterval(timer)
  }, [clock.startedAt, clock.blurAt])

  useEffect(() => {
    if (finished.current || !isDone(typing, target)) return
    finished.current = true
    const now = performance.now()
    const ms = Math.max(1, now - (clock.startedAt ?? now) - clock.paused)
    onDone({ keys: typing.keys, correctKeys: typing.correctKeys, ms })
  }, [typing, target, clock, onDone])

  const begin = () =>
    setClock((c) => (c.startedAt == null ? { startedAt: performance.now(), paused: 0, blurAt: null, now: performance.now() } : c))

  // Keys are applied to a ref first, so fast typing never works from a stale state.
  const apply = (update) => {
    if (finished.current) return
    begin()
    const next = update(typingRef.current)
    typingRef.current = next
    setTyping(next)
    if (next.blocked) {
      setShake((n) => n + 1)
      sfx.denied()
    } else setNotice('')
  }

  const onKeyDown = (event) => {
    if (event.key === 'Backspace') {
      event.preventDefault()
      apply((t) => backspace(t, event.ctrlKey || event.altKey || event.metaKey))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      apply((t) => typeText(t, '\n', target))
    } else if (event.key === 'Tab') {
      event.preventDefault()
      apply((t) => typeText(t, '\t', target))
    } else if (event.key === 'Escape') {
      event.currentTarget.blur()
    }
  }

  const onInput = (event) => {
    const { value } = event.target
    event.target.value = ''
    const kind = event.nativeEvent.inputType ?? ''
    if (!value || kind.startsWith('insertFromPaste') || kind.startsWith('insertFromDrop')) return
    apply((t) => typeText(t, value, target))
  }

  const refuse = (event) => {
    event.preventDefault()
    setNotice('Paste is turned off. Typing it yourself is how the code sticks.')
    setShake((n) => n + 1)
    sfx.denied()
  }

  const restart = () => {
    typingRef.current = startTyping(target)
    setTyping(typingRef.current)
    setClock({ startedAt: null, paused: 0, blurAt: null, now: 0 })
    setNotice('')
    inputRef.current?.focus({ preventScroll: true })
    sfx.back()
  }

  const onFocus = () => {
    setFocused(true)
    setClock((c) => (c.blurAt == null ? c : { ...c, paused: c.paused + performance.now() - c.blurAt, blurAt: null, now: performance.now() }))
  }
  const onBlur = () => {
    setFocused(false)
    setClock((c) => (c.startedAt == null || c.blurAt != null ? c : { ...c, blurAt: performance.now() }))
  }

  return (
    <div className="sc-typing">
      <header className="sc-part-head">
        <p className="sc-kicker">
          PART {index + 1} / {count}
        </p>
        <h4 className="sc-part-title">{part.title}</h4>
        <p className="sc-part-explain">{part.explain}</p>
        <ol className="sc-part-dots" aria-hidden="true">
          {Array.from({ length: count }, (_, i) => (
            <li key={i} className={i < index ? 'is-done' : i === index ? 'is-now' : undefined} />
          ))}
        </ol>
      </header>

      <dl className="sc-hud" aria-label="Typing statistics">
        <div>
          <dt>WPM</dt>
          <dd className="is-wpm">{Math.round(liveWpm)}</dd>
        </div>
        <div>
          <dt>ACCURACY</dt>
          <dd>{pctText(accuracy(typing.keys, typing.correctKeys))}</dd>
        </div>
        <div>
          <dt>TIME</dt>
          <dd>{formatTime(elapsed)}</dd>
        </div>
        <div>
          <dt>PROGRESS</dt>
          <dd>{pctText(progress)}</dd>
        </div>
        <span className="sc-hud-bar" style={{ '--p': progress }} aria-hidden="true" />
      </dl>

      <div className="sc-editor">
        <div className="sc-editor-bar">
          <span>
            <Keyboard aria-hidden="true" /> {fileName}
          </span>
          <span>
            lines {firstLine}–{firstLine + target.split('\n').length - 1}
          </span>
        </div>
        <div className="sc-stage" onMouseDown={(e) => { e.preventDefault(); inputRef.current?.focus({ preventScroll: true }) }}>
          <CodeView target={target} typed={typing.typed} firstLine={firstLine} focused={focused} blocked={typing.blocked} shake={shake} />
          <textarea
            ref={inputRef}
            className="sc-input"
            aria-label={`Type part ${index + 1} of the program exactly as shown`}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
            onKeyDown={onKeyDown}
            onInput={onInput}
            onPaste={refuse}
            onDrop={refuse}
            onCut={(e) => e.preventDefault()}
            onFocus={onFocus}
            onBlur={onBlur}
          />
          {!focused && (
            <div className="sc-unfocused" aria-hidden="true">
              <Keyboard />
              <span>{clock.startedAt == null ? 'Click here and start typing' : 'Paused · click to keep typing'}</span>
            </div>
          )}
        </div>
      </div>

      <p className={`sc-notice${notice || typing.blocked ? ' is-warn' : ''}`} role="status">
        {typing.blocked ? 'Fix the red characters first: press Backspace.' : notice || 'Type the code exactly as shown. Enter fills in the next line’s indentation. Mistakes turn red: backspace to fix them.'}
      </p>

      <div className="sc-actions">
        <button type="button" className="lab-btn" onClick={restart}>
          <RotateCcw aria-hidden="true" />
          Restart part
        </button>
        <button type="button" className="lab-btn" onClick={onExit}>
          Save &amp; exit
        </button>
      </div>
    </div>
  )
}

// ---------- Result tiles ----------

function Stats({ result, big = false }) {
  return (
    <dl className={`sc-stats${big ? ' is-big' : ''}`}>
      <div className="is-main">
        <dt>WPM</dt>
        <dd>{Math.round(result.wpm)}</dd>
      </div>
      <div>
        <dt>Accuracy</dt>
        <dd>{pctText(result.accuracy)}</dd>
      </div>
      <div>
        <dt>Time</dt>
        <dd>{formatTime(result.ms)}</dd>
      </div>
    </dl>
  )
}

function UnlockNote({ lab, progress }) {
  const next = LABS.find((entry) => entry.id === lab.id + 1)
  if (!next) return null
  const status = labStatus(progress, next.id)
  if (status !== 'locked') {
    return (
      <div className="sc-unlock is-open">
        <Trophy aria-hidden="true" />
        <p>
          <b>Experiment {next.id} is unlocked.</b> {next.title}
        </p>
        <Link className="lab-btn lab-btn-primary" to="/student/lab/$labId" params={{ labId: String(next.id) }}>
          Go to Experiment {next.id} <ArrowRight aria-hidden="true" />
        </Link>
      </div>
    )
  }
  return (
    <div className="sc-unlock">
      <Lock aria-hidden="true" />
      <p>
        <b>Speed Code complete.</b> Pass this experiment’s posttest as well to unlock Experiment {next.id}.
      </p>
    </div>
  )
}

// ---------- The whole activity ----------

export function SpeedCode({ lab, speedTest }) {
  const progress = useProgress()
  const record = progress.typing?.[lab.id] ?? null
  const saved = record?.attempt?.parts ?? []
  const count = speedTest.parts.length
  const program = useMemo(() => assembleProgram(speedTest), [speedTest])
  const firstLines = useMemo(() => {
    let line = 1
    return speedTest.parts.map((part) => {
      const first = line
      line += (part.code + PART_SEPARATOR).split('\n').length - 1
      return first
    })
  }, [speedTest])

  const resumeAt = Math.max(0, saved.findIndex((p) => !p) >= 0 ? saved.findIndex((p) => !p) : saved.length)
  const [view, setView] = useState('overview')
  const [index, setIndex] = useState(0)
  const [partResult, setPartResult] = useState(null)
  const [finalResult, setFinalResult] = useState(null)
  const [run, setRun] = useState(null)

  const execute = async () => {
    setRun({ pending: true, ok: true, output: 'Loading Python and running your program…' })
    const outcome = await runPython(program)
    setRun(outcome)
  }

  const start = (at) => {
    setIndex(at)
    setView('typing')
    sfx.enter()
  }

  const onPartDone = (stats) => {
    const result = { ...stats, wpm: wpm(stats.correctKeys, stats.ms), accuracy: accuracy(stats.keys, stats.correctKeys) }
    saveSpeedPart(lab.id, index, stats)
    sfx.coin()
    if (index + 1 < count) {
      setPartResult(result)
      setView('partDone')
      return
    }
    const parts = [...saved]
    parts[index] = stats
    const total = { ...totals(parts), at: Date.now() }
    finishSpeedCode(lab.id, total)
    setFinalResult(total)
    setView('finished')
    sfx.powerUp?.()
    execute()
  }

  const again = () => {
    resetSpeedAttempt(lab.id)
    setRun(null)
    start(0)
  }

  const download = () => {
    const blob = new Blob([program], { type: 'text/x-python' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = speedTest.fileName
    link.click()
    URL.revokeObjectURL(link.href)
  }

  if (view === 'typing') {
    return (
      <section className="sc-root" aria-label="Python speed code">
        <TypingPart
          key={index}
          part={speedTest.parts[index]}
          index={index}
          count={count}
          fileName={speedTest.fileName}
          firstLine={firstLines[index]}
          onDone={onPartDone}
          onExit={() => setView('overview')}
        />
      </section>
    )
  }

  if (view === 'partDone') {
    return (
      <section className="sc-root" aria-label="Python speed code">
        <div className="sc-card sc-part-done">
          <p className="sc-kicker is-good">
            <Check aria-hidden="true" /> PART {index + 1} / {count} COMPLETE
          </p>
          <h4 className="sc-part-title">{speedTest.parts[index].title}</h4>
          <Stats result={partResult} />
          <p className="sc-muted">
            Next: <b>{speedTest.parts[index + 1].title}</b>. {count - index - 1} part{count - index - 1 === 1 ? '' : 's'} left before the program runs.
          </p>
          <button type="button" className="sc-go" onClick={() => start(index + 1)} autoFocus>
            NEXT PART <ArrowRight aria-hidden="true" />
          </button>
        </div>
      </section>
    )
  }

  if (view === 'finished' && finalResult) {
    const best = record?.best
    return (
      <section className="sc-root" aria-label="Python speed code">
        <div className="sc-card sc-finished">
          <p className="sc-kicker is-good">
            <Trophy aria-hidden="true" /> SPEED CODE COMPLETE
          </p>
          <h4 className="sc-part-title">You typed the whole {speedTest.fileName} by hand.</h4>
          <Stats result={finalResult} big />
          {best && best.at !== finalResult.at && <p className="sc-muted">Personal best: {Math.round(best.wpm)} WPM at {pctText(best.accuracy)} accuracy.</p>}
          {best && best.at === finalResult.at && (record?.completions ?? 0) > 1 && <p className="sc-muted is-good">New personal best!</p>}
        </div>

        <div className={`lab-console${run && !run.ok ? ' is-error' : ''}`} aria-live="polite">
          <p className="lab-console-label">{!run || run.pending ? 'RUNNING YOUR PROGRAM' : run.ok ? 'OUTPUT OF YOUR PROGRAM' : 'ERROR'}</p>
          <pre>{run?.output || '(no output)'}</pre>
        </div>

        <UnlockNote lab={lab} progress={progress} />

        <div className="sc-actions">
          <button type="button" className="lab-btn" onClick={execute} disabled={run?.pending}>
            <Play aria-hidden="true" />
            Run again
          </button>
          <button type="button" className="lab-btn" onClick={download}>
            <Download aria-hidden="true" />
            Download program
          </button>
          <button type="button" className="lab-btn" onClick={again}>
            <RotateCcw aria-hidden="true" />
            Type it again
          </button>
        </div>
      </section>
    )
  }

  // Overview
  const done = (record?.completions ?? 0) > 0
  const started = saved.some(Boolean)
  const chars = program.length
  return (
    <section className="sc-root" aria-label="Python speed code">
      <div className="sc-card sc-overview">
        <div className="sc-overview-head">
          <div>
            <p className="sc-kicker">
              <Timer aria-hidden="true" /> PYTHON SPEED CODE
            </p>
            <h4 className="sc-part-title">{speedTest.title}</h4>
          </div>
          <span className={`sc-badge${done ? ' is-done' : ''}`}>{done ? '✓ COMPLETED' : 'REQUIRED'}</span>
        </div>
        <p className="sc-muted">
          Type the complete program for this experiment ({chars.toLocaleString()} characters) in {count} parts. No copy and paste: you write every line yourself, then
          it runs in Python. {LABS.some((l) => l.id === lab.id + 1) && `Completing it once is required to unlock Experiment ${lab.id + 1}.`}
        </p>

        <ol className="sc-parts">
          {speedTest.parts.map((part, i) => {
            const stats = saved[i]
            return (
              <li key={part.title} className={stats ? 'is-done' : i === resumeAt ? 'is-next' : undefined}>
                <span className="sc-parts-num">{stats ? <Check aria-label="typed" /> : String(i + 1).padStart(2, '0')}</span>
                <span className="sc-parts-title">{part.title}</span>
                <span className="sc-parts-meta">
                  {stats ? `${Math.round(wpm(stats.correctKeys, stats.ms))} WPM` : `${part.code.split('\n').length} lines`}
                </span>
              </li>
            )
          })}
        </ol>

        {record?.best && (
          <p className="sc-muted">
            Best run: <b>{Math.round(record.best.wpm)} WPM</b> · {pctText(record.best.accuracy)} accuracy · {formatTime(record.best.ms)} · completed {record.completions}×
          </p>
        )}

        <div className="sc-actions">
          <button type="button" className="sc-go" onClick={() => start(started ? resumeAt : 0)}>
            {started ? `CONTINUE WITH PART ${resumeAt + 1}` : done ? 'TYPE IT AGAIN' : 'START SPEED CODE'} <ArrowRight aria-hidden="true" />
          </button>
          {started && (
            <button type="button" className="lab-btn" onClick={again}>
              <RotateCcw aria-hidden="true" />
              Start over
            </button>
          )}
        </div>
        <p className="sc-muted sc-rules">
          Enter fills in indentation for you · red means a mistake: backspace to fix it · the clock pauses when you click away
        </p>
      </div>
    </section>
  )
}
