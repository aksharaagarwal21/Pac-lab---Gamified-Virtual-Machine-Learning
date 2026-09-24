import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Code, LockKeyhole, Maximize, Minimize, Play, RotateCcw, Save, Volume2 } from 'lucide-react'
import { fullscreenElement, toggleElementFullscreen } from '../../components/lab/quizGameKit.jsx'
import { say, sfx } from '../../sound.js'
import { RAW, COLUMNS, POINTS, TRAIN_COUNT, buildPipeline, display, lineMetrics, pythonCode } from './preprocessingArcadeModel.js'
import { LEVELS, REPAIRS, createAdventure, adventureReducer, scaleMission } from './preprocessingAdventureFlow.js'
import './preprocessingAdventure.css'

const Pac = ({ className = '', style }) => <span className={`pg-pac ${className}`} style={style} aria-hidden="true"><i /></span>
const METHODS = { mean: ['Average', 'Share the total equally'], median: ['Middle', 'Use the middle of the sorted values'], mode: ['Most common', 'Use the value seen most often'] }
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

function useMotion(motion, dispatch) {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    setProgress(0)
    if (!motion) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const duration = reduced ? 80 : ({ line: 3300, bridge: 1350, scale: 1300, ticket: 1200, boss: 900, store: 650, lock: 650 }[motion.kind] ?? 1000)
    let frame, elapsed = 0, previous = performance.now()
    const tick = now => {
      if (!document.hidden) elapsed += Math.min(50, now - previous)
      previous = now
      const p = Math.min(1, elapsed / duration)
      setProgress(p)
      if (p < 1) frame = requestAnimationFrame(tick)
      else dispatch({ type: 'FINISH_MOTION', motion })
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [motion, dispatch])
  return progress
}

function PullBlock({ onPull }) {
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const origin = useRef(null), dragged = useRef(false)
  const clear = () => { origin.current = null; setOffset({ x: 0, y: 0 }) }
  return <button type="button" className="pg-broken" aria-label="Pull out the missing block" style={{ '--dx': `${offset.x}px`, '--dy': `${offset.y}px` }}
    onPointerDown={e => { if (e.button !== 0) return; origin.current = { x: e.clientX, y: e.clientY }; dragged.current = false; e.currentTarget.setPointerCapture(e.pointerId) }}
    onPointerMove={e => { if (origin.current) setOffset({ x: e.clientX - origin.current.x, y: e.clientY - origin.current.y }) }}
    onPointerUp={e => {
      if (!origin.current) return
      const far = Math.hypot(e.clientX - origin.current.x, e.clientY - origin.current.y) > 32
      clear(); if (far) { dragged.current = true; onPull() }
    }} onPointerCancel={clear} onLostPointerCapture={clear}
    onClick={() => { if (!dragged.current) onPull(); dragged.current = false }}>
    <b>?</b><small>PULL ME OUT</small><span>or click / Enter</span>
  </button>
}

function Knob({ label, value, min, max, step, onChange, format = display, disabled }) {
  const id = useRef(`pg-knob-${label.replace(/\W/g, '')}`).current
  return <div className="pg-knob"><div><label htmlFor={id}>{label}</label><output htmlFor={id}>{format(value)}</output></div>
    <div className="pg-knob-control"><button type="button" aria-label={`Decrease ${label}`} disabled={disabled || value <= min} onClick={() => onChange(Number(clamp(value - step, min, max).toFixed(3)))}>−</button>
      <input id={id} type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={e => onChange(Number(e.target.value))} />
      <button type="button" aria-label={`Increase ${label}`} disabled={disabled || value >= max} onClick={() => onChange(Number(clamp(value + step, min, max).toFixed(3)))}>+</button></div>
  </div>
}

function Demo({ level, onClose }) {
  const dialog = useRef(null)
  useEffect(() => { dialog.current?.showModal() }, [])
  return <dialog ref={dialog} className="pg-demo" onCancel={e => { e.preventDefault(); onClose() }} aria-labelledby="pg-demo-title">
    <p className="pg-eyebrow">WATCH FIRST · PRACTICE NEXT</p><h4 id="pg-demo-title">{LEVELS[level].title}</h4>
    <div className={`pg-demo-scene demo-${level}`} aria-hidden="true">
      {level === 0 && <><span className="pg-demo-card">TEST 11</span><span className="pg-demo-vault"><LockKeyhole /> VAULT</span></>}
      {level === 1 && <><span className="pg-demo-gap">?</span><span className="pg-demo-fill">4</span><div className="pg-demo-track" /></>}
      {level === 2 && <><span className="pg-demo-tower" /><span className="pg-demo-fence">SAFE FENCE</span></>}
      {level === 3 && <><span className="pg-demo-ticket">DELHI</span><div className="pg-demo-bits"><span>0<small>Chennai</small></span><span>1<small>Delhi</small></span><span>0<small>Mumbai</small></span></div></>}
      {level === 4 && <><span className="pg-demo-raw">50</span><span className="pg-demo-machine">SCALE</span><span className="pg-demo-scaled">0.5</span></>}
      {level === 5 && <><div className="pg-demo-line" /><Pac className="pg-demo-rider" /><span className="pg-demo-pellets">●　●　●　●</span></>}
      <span className="pg-demo-cursor">↖</span>
    </div>
    {level === 1 && <p className="pg-demo-example">Small example: 2 + 4 + 6 = 12. Share 12 between 3 values → average 4. Your bridge will use the real training values.</p>}
    {level === 4 && <p className="pg-demo-example">Small example: on a 0–100 scale, 50 is halfway, so min–max turns it into 0.5.</p>}
    <p>{LEVELS[level].demo}</p><button type="button" className="pg-primary" onClick={onClose} autoFocus>My turn <ArrowRight size={17} /></button>
  </dialog>
}

function Recipe({ s, data }) {
  if (!s.method) return null
  const col = REPAIRS[s.repairIndex].key.split(':')[1]
  const values = RAW.slice(0, TRAIN_COUNT).map(r => r[col]).filter(v => v !== null)
  const sorted = [...values].sort((a, b) => a - b)
  const midpoint = Math.floor(sorted.length / 2)
  return <details className="pg-details"><summary>How was {display(data.stats[col][s.method])} calculated?</summary>
    {s.method === 'mean' && <p>{values.map(display).join(' + ')} = {display(values.reduce((a, b) => a + b, 0))}. Divide by {values.length} observed values → <b>{display(data.stats[col].mean)}</b>.</p>}
    {s.method === 'median' && <><div className="pg-number-chips">{sorted.map((v, i) => <span key={i} className={i === midpoint || (sorted.length % 2 === 0 && i === midpoint - 1) ? 'is-middle' : ''}>{display(v)}</span>)}</div><p>Sort first. {sorted.length % 2 ? 'Use the highlighted middle value.' : 'Average the two highlighted middle values.'} Result: {display(data.stats[col].median)}.</p></>}
    {s.method === 'mode' && <p>{display(data.stats[col].mode)} occurs {data.stats[col].count} times. {data.stats[col].modes.length > 1 ? 'Several numbers tie; this game picks the smallest tied number. An average or median is often more useful here.' : 'It is the most common observed value.'}</p>}
    <p>Only observed training values are used. Missing cells and the test rows are excluded.</p>
  </details>
}

function LineGame({ s, p }) {
  const X = x => 48 + x * 85, Y = y => 270 - y * 18
  const riding = s.motion?.kind === 'line'
  const x = riding ? p * 5 : 0, y = s.m * x + s.b
  return <svg viewBox="0 0 540 310" className="pg-line" role="img" aria-label={`Your line starts at ${s.b} and rises ${s.m} per step. Collect the six pellets, starting at height one.`}>
    <defs><clipPath id="pg-line-area"><rect x="30" y="15" width="475" height="270" /></clipPath></defs>
    {[0, 2, 4, 6, 8, 10, 12].map(v => <g key={v}><path d={`M48 ${Y(v)} H490`} stroke="#263553" strokeDasharray="4 6" /><text x="31" y={Y(v) + 5}>{v}</text></g>)}
    {POINTS.map(pt => <g key={pt.x}><path d={`M${X(pt.x)} 25 V270`} stroke="#192b4b" /><text x={X(pt.x)} y="294" textAnchor="middle">{pt.x}</text></g>)}
    <text x="10" y="20">y</text><text x="504" y="294">x</text>
    <g clipPath="url(#pg-line-area)"><path d={`M${X(0)} ${Y(s.b)} L${X(5)} ${Y(s.m * 5 + s.b)}`} stroke="#47d6ed" strokeWidth="6" />
      {POINTS.map(pt => {
        const hit = Math.abs(s.m * pt.x + s.b - pt.y) <= 0.35, passed = riding && x >= pt.x
        return <g key={pt.x}>
          {passed && !hit && <path d={`M${X(pt.x)} ${Y(pt.y)} V${Y(s.m * pt.x + s.b)}`} stroke="#ff80a9" strokeWidth="2" strokeDasharray="3 3" />}
          <circle cx={X(pt.x)} cy={Y(pt.y)} r={passed && hit ? 10 : 7} fill={passed && hit ? '#62edaa' : '#ffda69'} />
          {passed && hit && <text x={X(pt.x)} y={Y(pt.y) - 18} textAnchor="middle" className="pg-collected">+1</text>}
        </g>
      })}
      <path transform={`translate(${X(x)},${Y(y)})`} d="M0 0 L11 -9 A14 14 0 1 0 11 9 Z" fill="#ffd44b" />
    </g>
    <text x="95" y="23" fill="#8be9f5">y = {s.m.toFixed(1)}x + {s.b.toFixed(1)}</text>
  </svg>
}

export default function PreprocessingAdventure({ onSaveResult, onUsePython }) {
  const [s, dispatch] = useReducer(adventureReducer, undefined, createAdventure)
  const [demo, setDemo] = useState(false), [full, setFull] = useState(false), [saved, setSaved] = useState(false), [resetting, setResetting] = useState(false)
  const stage = useRef(null), heading = useRef(null), lastCount = useRef(0)
  const p = useMotion(s.motion, dispatch)
  const data = useMemo(() => buildPipeline(s.board), [s.board])
  const busy = Boolean(s.motion), cleared = s.completed.includes(s.level), finished = s.completed.length === 6
  const send = action => { if (!['LIFT', 'TILT', 'CAP', 'AIM'].includes(action.type)) sfx.select(); dispatch(action) }
  useEffect(() => {
    const changed = () => setFull(fullscreenElement() === stage.current)
    document.addEventListener('fullscreenchange', changed); document.addEventListener('webkitfullscreenchange', changed)
    return () => { document.removeEventListener('fullscreenchange', changed); document.removeEventListener('webkitfullscreenchange', changed) }
  }, [])
  useEffect(() => {
    if (s.completed.length > lastCount.current) sfx.powerUp()
    lastCount.current = s.completed.length
  }, [s.completed.length])
  useEffect(() => { if (s.feedbackKind === 'retry' && s.feedback) sfx.notice() }, [s.feedback, s.feedbackKind])
  useEffect(() => { if (s.started) heading.current?.focus({ preventScroll: true }) }, [s.level, s.started])
  const next = () => {
    send({ type: 'NAVIGATE', level: Math.min(s.level + 1, 5) })
    if (s.level + 1 === s.completed.length && !finished) setDemo(true)
  }
  const exportPython = async () => {
    if (!finished) return
    if (fullscreenElement() === stage.current) {
      try { await (document.exitFullscreen ?? document.webkitExitFullscreen)?.call(document) } catch { return }
    }
    onUsePython(pythonCode(s.board, s.m, s.b))
  }
  const save = () => {
    if (!finished) return
    onSaveResult({ title: 'Data Rescue — six guided missions completed', metrics: [
      { label: 'Missions completed', value: '6 / 6' }, { label: 'Missing values repaired', value: `${data.filled} / 5` },
      { label: 'Test rows protected', value: '2' }, { label: 'Outlier decision', value: s.board.outlier === 'clip' ? `Capped at ${display(data.fence)}` : 'Inspected and kept' },
      { label: 'City encoding', value: 'One-hot: three correct tickets' }, { label: 'Scaling', value: 'Min–max and z-score gates cleared' },
      { label: 'Final exported scaling', value: 'Standardization' }, { label: 'Toy line', value: `y = ${s.m}x + ${s.b}` },
      { label: 'Line pellets collected', value: `${s.rideHits} / 6` }, { label: 'Line mean squared error', value: lineMetrics(s.m, s.b).mse.toFixed(3) },
    ], explanation: `Test rows were protected first. Five missing cells were replaced using observed training values. The salary outlier was ${s.board.outlier === 'clip' ? 'capped using training-only IQR limits' : 'inspected and retained'}. Three city tickets were encoded correctly; both scale gates were passed. Finally, a separate toy line was tested by riding through all six target points. All preprocessing statistics use training rows only.` })
    setSaved(true)
  }

  const repair = REPAIRS[s.repairIndex], [rowId, col] = repair.key.split(':'), currentValue = data.rows.find(r => r.id === Number(rowId))?.[col]
  const scale = scaleMission(s)
  const scalePct = v => clamp((v - scale.min) / (scale.max - scale.min) * 100, 0, 100)
  const bossValue = data.fence + (250000 - data.fence) * s.cap / 100
  const instruction = cleared ? 'Mission complete. Follow the glowing path to continue.' : [
    s.stored.length < 2 ? `Move purple card ${s.stored.includes(10) ? '12' : '11'} into the vault.` : 'Both test cards are safe. Press Lock the vault.',
    !s.opened ? 'Pull the pink ? block out — or just click it.' : !s.method ? `Choose a replacement. ${repair.hint}` : 'The bridge is repaired. Press Cross the bridge.',
    !s.bossFound ? 'Tap the tallest salary tower.' : 'Keep the inspected value, or lower the cap handle to the fence.',
    `Turn only ${data.cities[s.ticket]} ON. Then press Send ticket.`,
    `Move your aim to the glowing gate near ${display(scale.target)}. Then press Launch block.`,
    s.lineStep === 'lift' ? 'Lift the line to height 1, then press Set starting height.' : 'Tilt the line to rise 2 per step, then press Ride the line.',
  ][s.level]

  return <section ref={stage} className="pg-adventure" aria-label="Data Rescue guided simulation">
    <header className="pg-header"><div className="pg-brand"><Pac /><div><span className="pg-eyebrow">EXPERIMENT 01 · PLAY TO LEARN</span><h3>Data Rescue</h3></div></div><div className="pg-score"><strong>{s.completed.length}/6</strong><span>MISSIONS</span></div><button type="button" className="pg-icon" aria-label={full ? 'Exit fullscreen' : 'Fullscreen simulation'} onClick={() => toggleElementFullscreen(stage.current)}>{full ? <Minimize /> : <Maximize />}</button></header>
    {!s.started ? <div className="pg-welcome"><div className="pg-welcome-art" aria-hidden="true"><div className="pg-maze-row"><span>25</span><span>?</span><span>DELHI</span><span>?</span><span>41</span></div><div className="pg-welcome-track"><Pac /><i /><i /><i /><span className="pg-ghost">● ●</span></div></div><p className="pg-eyebrow">YOUR FIRST DATA ADVENTURE</p><h4>Help Pac turn messy data into ready-to-use blocks.</h4><p>No experience needed. You’ll play one small mission at a time. Watch a short demo, try it yourself, and see why it works.</p><div className="pg-welcome-rules"><span><Check /> No timer</span><span><RotateCcw /> Unlimited retries</span><span><Play /> A demo in every mission</span></div><button type="button" className="pg-primary" onClick={() => { send({ type: 'START' }); setDemo(true) }}>Start with me <ArrowRight /></button><small>This adventure uses 12 sample customer records. No live database is changed.</small></div> : <>
      <nav className="pg-map" aria-label="Mission path">{LEVELS.map((level, i) => <button type="button" key={level.short} disabled={busy || i > s.completed.length} aria-current={s.level === i ? 'step' : undefined} onClick={() => send({ type: 'NAVIGATE', level: i })}><span>{s.completed.includes(i) ? <Check size={16} /> : i > s.completed.length ? <LockKeyhole size={14} /> : i + 1}</span>{level.short}</button>)}</nav>
      <main className="pg-mission">
        <div className="pg-title-row"><div><p className="pg-eyebrow">MISSION {s.level + 1} OF 6</p><h4 ref={heading} tabIndex={-1}>{LEVELS[s.level].title}</h4></div><button type="button" className="pg-secondary" disabled={busy} onClick={() => setDemo(true)}><Play size={16} /> Show me how</button></div>
        <div className="pg-coach"><span className="pg-guide" aria-hidden="true">● ●</span><div><small>{busy ? 'WATCH WHAT HAPPENS' : 'YOUR NEXT MOVE'}</small><p>{busy ? { store: 'The test card is moving safely into the vault.', lock: 'The unseen test data is now protected.', bridge: 'Pac is testing your repaired bridge!', boss: 'Applying your decision to the salary record.', ticket: 'Your city ticket is crossing the decoder.', scale: 'Watch whether the block reaches the target gate.', line: 'Pac is riding your line. Each green pellet is a close prediction.' }[s.motion.kind] : instruction}</p></div><button type="button" className="pg-icon" aria-label="Read the next instruction aloud" onClick={() => say(instruction)}><Volume2 size={18} /></button></div>

        {cleared ? <div className="pg-clear"><div className="pg-celebrate" aria-hidden="true"><Pac />{Array.from({ length: 10 }, (_, i) => <i key={i} style={{ '--i': i }} />)}</div><p className="pg-eyebrow">MISSION CLEARED · +1 BADGE</p><h5>{finished && s.level === 5 ? 'You rescued the data!' : 'You did it!'}</h5><p>{LEVELS[s.level].learned}</p>
          <div className="pg-recap">{s.level === 0 ? '10 training rows · 2 unseen test rows' : s.level === 1 ? '5 gaps repaired · all 12 rows kept' : s.level === 2 ? s.board.outlier === 'clip' ? `Salary capped at ${display(data.fence)} · row preserved` : 'Extreme salary inspected and kept' : s.level === 3 ? 'Chennai [1,0,0] · Delhi [0,1,0] · Mumbai [0,0,1]' : s.level === 4 ? 'Both scale gates passed · final dataset uses z-scores' : `y = ${s.m}x + ${s.b} · ${s.rideHits}/6 pellets collected`}</div>
          {s.level < 5 ? <button type="button" className="pg-primary" onClick={next}>Continue to {LEVELS[s.level + 1].short.toLowerCase()} <ArrowRight /></button> : <><button type="button" className="pg-primary" onClick={save}><Save size={18} /> {saved ? 'Saved to Results ✓' : 'Save my completed adventure'}</button><p className="pg-save-note" role="status">{saved ? 'Your results are available in Results & Analysis.' : 'Save to mark the simulation complete and keep your learning summary.'}</p></>}
        </div> : <>
          {s.level === 0 && <div className="pg-vault-game"><div className="pg-card-tray"><p>BLUE = LEARN NOW · PURPLE = TEST LATER</p><div className="pg-records">{RAW.map((r, i) => <button type="button" key={i} disabled={busy || s.stored.includes(i)} className={`${i >= 10 ? 'is-test' : ''}${s.stored.includes(i) ? 'is-stored' : ''}${s.motion?.kind === 'store' && s.motion.id === i ? 'is-flying' : ''}`} onClick={() => send({ type: 'STORE', id: i })} aria-label={`Move ${i >= 10 ? 'test' : 'training'} card ${i + 1} to vault`}><b>{String(i + 1).padStart(2, '0')}</b><small>{s.stored.includes(i) ? 'SAFE ✓' : i >= 10 ? 'TEST LATER' : 'LEARN NOW'}</small></button>)}</div></div><div className={`pg-vault${s.stored.length === 2 ? ' is-ready' : ''}`}><LockKeyhole size={38} /><h5>Unseen test vault</h5><div className="pg-vault-slots">{[10, 11].map(id => <span key={id} className={s.stored.includes(id) ? 'is-filled' : ''}>{s.stored.includes(id) ? id + 1 : '?'}</span>)}</div><p>{s.stored.length}/2 cards protected</p><button type="button" className="pg-primary" disabled={busy || s.stored.length < 2} onClick={() => send({ type: 'LOCK' })}>Lock the vault <LockKeyhole size={16} /></button></div></div>}

          {s.level === 1 && <div className="pg-repair-game"><div className="pg-step-dots">{['Pull the gap', 'Choose a block', 'Cross the bridge'].map((step, i) => <span key={step} className={i === (!s.opened ? 0 : !s.method ? 1 : 2) ? 'is-current' : ''}>{i + 1}. {step}</span>)}</div><p className="pg-stage-label">BRIDGE {s.repairIndex + 1}/5 · CUSTOMER ROW {Number(rowId) + 1} · MISSING {col.toUpperCase()}</p><div className="pg-bridge" key={s.repairIndex}><div className="pg-bridge-rider" style={{ left: `${5 + (s.motion?.kind === 'bridge' ? p : 0) * 86}%` }}><Pac /></div><div className="pg-bridge-deck"><div className="pg-platform"><span>KNOWN</span>{display(col === 'city' ? 'Delhi' : col === 'age' ? 25 : 32000)}</div><div className="pg-gap" onDragOver={e => { if (s.opened && !busy) e.preventDefault() }} onDrop={e => { e.preventDefault(); send({ type: 'FILL', method: e.dataTransfer.getData('text/plain') }) }}>
            {!s.opened ? <PullBlock onPull={() => send({ type: 'PULL' })} /> : s.method ? <div className="pg-inserted" key={s.method}><b>{display(currentValue)}</b><small>{METHODS[s.method][0]}</small></div> : <div className="pg-empty"><span className="pg-ejected">?</span><b>+</b><small>INSERT A BLOCK</small></div>}
          </div><div className="pg-platform"><span>KNOWN</span>{display(col === 'city' ? 'Mumbai' : col === 'age' ? 41 : 48000)}</div></div><div className="pg-water" aria-hidden="true">≈ ≈ ≈ ≈ ≈ ≈ ≈ ≈ ≈ ≈ ≈ ≈</div></div>
            <div className="pg-tools">{(col === 'city' ? ['mode'] : ['mean', 'median']).map(method => <button type="button" key={method} disabled={busy || !s.opened} aria-pressed={s.method === method} draggable={s.opened && !busy} onDragStart={e => e.dataTransfer.setData('text/plain', method)} onClick={() => send({ type: 'FILL', method })}><span className={`pg-tool-cube tool-${method}`}>{display(data.stats[col][method])}</span><strong>{METHODS[method][0]} <small>({method})</small></strong><span>{METHODS[method][1]}</span>{method === repair.method && <em>TRY THIS</em>}</button>)}</div>
            <p className="pg-plain-hint">{col === 'city' ? 'Names cannot be averaged. Delhi is the most common observed training city, so Mode fills this gap.' : 'The tool calculates the number for you. Choose a block to see the gap fill. No arithmetic test here.'}</p>
            <Recipe s={s} data={data} /><button type="button" className="pg-primary pg-main-action" disabled={busy || !s.method} onClick={() => send({ type: 'CROSS' })}>Cross the bridge <ArrowRight size={18} /></button>
          </div>}

          {s.level === 2 && <div className="pg-boss-game"><div className="pg-towers">{data.rows.filter(r => r.id < 10 && RAW[r.id].salary !== null).map(r => <button type="button" key={r.id} disabled={busy} aria-label={`Inspect row ${r.id + 1} salary ${r.salary}`} className={s.bossFound && r.id === 6 ? 'is-found' : ''} style={{ '--tower': `${Math.max(8, (r.id === 6 && s.bossFound ? bossValue : r.salary) / 250000 * 100)}%` }} onClick={() => send({ type: 'INSPECT', id: r.id })}><strong>{display(r.id === 6 && s.bossFound ? bossValue : r.salary)}</strong><span /><small>ROW {r.id + 1}</small></button>)}</div>
            {s.bossFound ? <div className="pg-boss-controls"><div><p className="pg-stage-label">OPTION 1 · KEEP IT</p><p>A high salary could be real. Keep the inspected record for further investigation.</p><button type="button" className="pg-secondary" disabled={busy} onClick={() => send({ type: 'HANDLE', choice: 'keep' })}>Keep the inspected salary</button></div><div><p className="pg-stage-label">OPTION 2 · TRY CAPPING</p><p>Lower the preview to the fence at <b>{display(data.fence)}</b>. The row stays.</p><Knob label="Cap handle · left is the fence" min={0} max={100} step={1} value={s.cap} disabled={busy} format={() => display(bossValue)} onChange={value => send({ type: 'CAP', value })} /><button type="button" className="pg-primary" disabled={busy} onClick={() => send({ type: 'HANDLE', choice: 'clip' })}>Apply the cap</button></div></div> : <p className="pg-plain-hint">Look for the tower far above all the others. Click it to investigate.</p>}
            <details className="pg-details"><summary>Where does the fence come from?</summary><p>The IQR rule measures the middle half of the observed training salaries. The upper fence is Q3 + 1.5 × (Q3 − Q1) = {display(data.fence)}. It flags unusual values; it does not prove they are mistakes.</p></details>
          </div>}

          {s.level === 3 && <div className="pg-city-game"><p className="pg-stage-label">TICKET {s.ticket + 1}/3</p><div className={`pg-city-ticket${s.motion?.kind === 'ticket' ? ' is-delivering' : ''}`}><span>DELIVER THIS CITY</span><strong>{data.cities[s.ticket]}</strong><Pac /></div><div className="pg-switches">{data.cities.map((city, i) => <button type="button" key={city} disabled={busy} aria-pressed={Boolean(s.bits[i])} className={s.bits[i] ? 'is-on' : ''} onClick={() => send({ type: 'BIT', index: i })}><span className="pg-switch-lamp" /><b>{s.bits[i]}</b><strong>{city}</strong><small>{s.bits[i] ? 'ON' : 'OFF'}</small></button>)}</div><div className="pg-bit-output">Your code: <b>[{s.bits.join(', ')}]</b></div><button type="button" className="pg-primary pg-main-action" disabled={busy} onClick={() => send({ type: 'SEND' })}>Send ticket <ArrowRight size={18} /></button><p className="pg-plain-hint">Match the name on the ticket. Exactly one switch should be on. This is called “one-hot encoding”.</p></div>}

          {s.level === 4 && <div className="pg-scale-game"><p className="pg-stage-label">GATE {s.scaleRound + 1}/2 · {scale.label}</p><div className="pg-scale-story"><span>Age <b>{scale.raw}</b></span><ArrowRight /><span className="pg-scale-machine">{s.scaleRound ? 'DISTANCE FROM AVERAGE' : 'SQUEEZE TO 0–1'}</span><ArrowRight /><span>Target <b>{display(scale.target)}</b></span></div><div className="pg-launch-field"><div className="pg-launch-track" /><div className="pg-target-gate" style={{ left: `${8 + scalePct(scale.target) * .84}%` }}><span>GOAL</span><i /></div><div className="pg-launch-block" style={{ left: `${8 + (s.motion?.kind === 'scale' ? p : 1) * scalePct(s.aim) * .84}%`, bottom: s.motion?.kind === 'scale' ? `${34 + Math.sin(p * Math.PI) * 70}px` : '34px' }}><Pac /><b>{display(s.aim)}</b></div><div className="pg-ruler-labels"><span>{scale.min}</span><span>{s.scaleRound ? '0 = average' : '0.5 = halfway'}</span><span>{scale.max}</span></div></div>
            <Knob label="Aim your block" value={s.aim} min={scale.min} max={scale.max} step={scale.step} disabled={busy} onChange={value => send({ type: 'AIM', value })} /><button type="button" className="pg-primary pg-main-action" disabled={busy} onClick={() => send({ type: 'LAUNCH' })}>Launch block <Play size={17} /></button><p className="pg-plain-hint">{s.scaleRound ? `This age is above the average ${display(scale.fit.mean)}, so its z-score is positive. Aim near ${display(scale.target)}.` : `${scale.fit.min} is the smallest training age and becomes 0. ${scale.fit.max} is the largest and becomes 1. ${scale.raw} belongs between them.`}</p>
            <details className="pg-details"><summary>Show the calculation</summary><p>{s.scaleRound ? `(${scale.raw} − ${display(scale.fit.mean)}) ÷ ${display(scale.fit.std)} = ${display(scale.target)}` : `(${scale.raw} − ${scale.fit.min}) ÷ (${scale.fit.max} − ${scale.fit.min}) = ${display(scale.target)}`}. The game uses unrounded values internally. The gate allows a small aiming margin.</p><p>Salary is transformed with its own training statistics too. Test rows reuse those same rules.</p></details>
          </div>}

          {s.level === 5 && <div className="pg-line-game"><div className="pg-step-dots"><span className={s.lineStep === 'lift' ? 'is-current' : ''}>1. Lift to the first pellet</span><span className={s.lineStep === 'tilt' ? 'is-current' : ''}>2. Tilt and ride</span></div><LineGame s={s} p={p} />{s.lineStep === 'lift' ? <><Knob label="Starting height · intercept b" min={0} max={5} step={0.5} value={s.b} disabled={busy} onChange={value => send({ type: 'LIFT', value })} /><button type="button" className="pg-primary pg-main-action" disabled={busy} onClick={() => send({ type: 'SET_START' })}>Set starting height</button></> : <><Knob label="Rise per step · slope m" min={0} max={3} step={0.1} value={s.m} disabled={busy} onChange={value => send({ type: 'TILT', value })} /><button type="button" className="pg-primary pg-main-action" disabled={busy} onClick={() => send({ type: 'RIDE' })}>Ride the line <Play size={17} /></button></>}<p className="pg-plain-hint">{s.motion?.kind === 'line' ? `${POINTS.filter(pt => pt.x <= p * 5 && Math.abs(s.m * pt.x + s.b - pt.y) <= .35).length}/6 pellets collected` : 'The yellow pellets show the target values. Pac follows your blue line. Pink gaps show missed predictions.'}</p><details className="pg-details"><summary>What does y = mx + b mean?</summary><p>x is the number of steps right. Multiply x by the slope m, then add the starting height b to get the predicted y. For these toy pellets, start at 1 and rise by 2 each step.</p><p>This bonus line uses a separate small dataset, not customer salaries. Current mean squared error: {lineMetrics(s.m, s.b).mse.toFixed(3)}. Smaller is better.</p></details></div>}

          <div className={`pg-feedback is-${s.feedbackKind}`} role="status" aria-live="polite">{s.feedback || LEVELS[s.level].why}</div>
          <div className="pg-learning-note"><strong>WHY THIS MATTERS</strong><p>{LEVELS[s.level].why}</p></div>
        </>}
      </main>
      <footer className="pg-footer"><button type="button" className="pg-secondary" disabled={busy || s.level === 0} onClick={() => send({ type: 'NAVIGATE', level: s.level - 1 })}><ArrowLeft size={16} /> Review previous</button><span>{cleared ? 'Badge earned — use Continue above.' : 'Complete this mission to open the next gate.'}</span><button type="button" className="pg-text-button" disabled={busy} onClick={() => setResetting(true)}><RotateCcw size={14} /> Restart</button></footer>
      {finished && <div className="pg-final-tools"><button type="button" className="pg-secondary" onClick={exportPython}><Code size={17} /> Explore these choices in Python</button><details className="pg-details"><summary>See the final processed dataset</summary><div className="pg-data-scroll"><table><thead><tr>{Object.keys(data.processed[0]).map(key => <th key={key}>{key}</th>)}</tr></thead><tbody>{data.processed.map(row => <tr key={row.row}>{Object.values(row).map((v, i) => <td key={i}>{display(v)}</td>)}</tr>)}</tbody></table></div></details></div>}
    </>}
    {demo && <Demo key={s.level} level={s.level} onClose={() => setDemo(false)} />}
    {resetting && <div className="pg-reset" role="group" aria-label="Restart this adventure"><p>Start over? Your unsaved mission progress will reset.</p><button type="button" className="pg-secondary" onClick={() => setResetting(false)}>Keep playing</button><button type="button" className="pg-primary" onClick={() => { dispatch({ type: 'RESET' }); setSaved(false); setResetting(false); setDemo(false) }}>Start a fresh adventure</button></div>}
  </section>
}
