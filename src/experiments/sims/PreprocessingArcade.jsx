import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Code, Maximize, Minimize, RotateCcw, Save, Undo2 } from 'lucide-react'
import { Slider } from '../../components/lab/simKit.jsx'
import { fullscreenElement, toggleElementFullscreen } from '../../components/lab/quizGameKit.jsx'
import { sfx } from '../../sound.js'
import { RAW, TRAIN_COUNT, COLUMNS, POINTS, freshBoard, buildPipeline, display, lineMetrics, pythonCode, mean } from './preprocessingArcadeModel.js'
import './preprocessingArcade.css'

const ROOMS = ['Repair blocks', 'Outlier boss', 'City decoder', 'Scale machine', 'Leakage lock', 'Line rider']
const METHODS = { mean: ['Average', 'Add the observed numbers, then divide by their count.'], median: ['Middle', 'Sort the observed numbers and use the middle value.'], mode: ['Most common', 'Use the value that appears most often.'] }
const ORDER = ['SPLIT', 'FIT', 'TRANSFORM', 'TRAIN']
const FLOW = { SPLIT: 'Set test rows aside', FIT: 'Learn cleaning rules from train only', TRANSFORM: 'Apply those rules to both sets', TRAIN: 'Train the model on cleaned training rows' }

function Pac({ className = '' }) { return <span className={`pa-pac ${className}`} aria-hidden="true" /> }

function MissingBlock({ label, pulled, onPull }) {
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [pulling, setPulling] = useState(false)
  const gesture = useRef(null)
  const suppressClick = useRef(false)
  const cleanup = () => { gesture.current = null; setOffset({ x: 0, y: 0 }); setPulling(false) }
  return <button type="button" className={`pa-block is-missing${pulled ? ' is-pulled' : ''}${pulling ? ' is-grabbed' : ''}`}
    aria-label={`${pulled ? 'Empty socket' : 'Pull out missing block'}: ${label}`} disabled={pulled}
    style={{ '--pull-x': `${offset.x}px`, '--pull-y': `${offset.y}px` }}
    onPointerDown={e => {
      if (e.button !== 0) return
      suppressClick.current = false
      gesture.current = { x: e.clientX, y: e.clientY }
      e.currentTarget.setPointerCapture(e.pointerId); setPulling(true); sfx.grab()
    }}
    onPointerMove={e => { if (gesture.current) setOffset({ x: e.clientX - gesture.current.x, y: e.clientY - gesture.current.y }) }}
    onPointerUp={e => {
      if (!gesture.current) return
      const distance = Math.hypot(e.clientX - gesture.current.x, e.clientY - gesture.current.y)
      cleanup()
      if (distance >= 40) { suppressClick.current = true; onPull() }
    }}
    onPointerCancel={cleanup} onLostPointerCapture={cleanup}
    onClick={() => { if (suppressClick.current) { suppressClick.current = false; return } onPull() }}>
    <span className="pa-block-face"><b>{pulled ? '+' : '?'}</b><small>{pulled ? 'EMPTY SOCKET' : 'PULL / CLICK'}</small></span>
  </button>
}

function Choice({ active, children, onClick, disabled = false }) {
  return <button type="button" className={`pa-choice${active ? ' is-active' : ''}`} aria-pressed={active} onClick={onClick} disabled={disabled}>{children}</button>
}

function LineBoard({ m, b }) {
  const X = x => 48 + x / 5 * 440, Y = y => 250 - y / 14 * 214
  return <svg className="pa-line-chart" viewBox="0 0 530 290" role="img" aria-label={`Line y equals ${m} x plus ${b}. Yellow dots follow y equals 2 x plus 1. Pink gaps show prediction errors.`}>
    <defs><clipPath id="pa-plot-clip"><rect x="48" y="20" width="440" height="230" /></clipPath></defs>
    <rect width="530" height="290" rx="12" fill="#080f27" />
    {[0, 2, 4, 6, 8, 10, 12, 14].map(y => <g key={y}><path d={`M48 ${Y(y)} H488`} stroke="#213254" strokeDasharray="3 5" /><text x="36" y={Y(y) + 4} textAnchor="end">{y}</text></g>)}
    {POINTS.map(p => <g key={p.x}><path d={`M${X(p.x)} 20 V250`} stroke="#213254" /><text x={X(p.x)} y="270" textAnchor="middle">{p.x}</text></g>)}
    <text x="505" y="270">x</text><text x="21" y="24">y</text>
    <g clipPath="url(#pa-plot-clip)">
      <path className="pa-fit-line" d={`M${X(0)} ${Y(b)} L${X(5)} ${Y(m * 5 + b)}`} stroke="#22d3ee" strokeWidth="4" />
      {POINTS.map(p => {
        const prediction = m * p.x + b, hit = Math.abs(prediction - p.y) <= 0.35
        return <g key={p.x}><path d={`M${X(p.x)} ${Y(p.y)} V${Y(prediction)}`} stroke="#ff6fae" strokeWidth="2" strokeDasharray="4 4" />
          <circle cx={X(p.x)} cy={Y(p.y)} r="7" fill={hit ? '#54e9ad' : '#ffd659'} />
          <path transform={`translate(${X(p.x)},${Y(prediction)})`} d="M0 0 L6 -6 A8 8 0 1 0 6 6 Z" fill={hit ? '#54e9ad' : '#f5c518'} />
        </g>
      })}
    </g>
    <circle cx={X(0)} cy={Y(b)} r="9" fill="none" stroke="#ff8a3d" strokeWidth="2" />
  </svg>
}

export default function PreprocessingArcade({ onSaveResult, onUsePython }) {
  const [room, setRoom] = useState(0)
  const [board, setBoard] = useState(freshBoard)
  const [selected, setSelected] = useState(null)
  const [message, setMessage] = useState('Find a pink ? block. Pull it out, or click it to open a socket.')
  const [touched, setTouched] = useState({})
  const [order, setOrder] = useState([])
  const [m, setM] = useState(0.5), [b, setB] = useState(4)
  const [saved, setSaved] = useState(false)
  const [full, setFull] = useState(false)
  const history = useRef([]), stage = useRef(null)
  const boardRef = useRef(board)
  boardRef.current = board
  const data = useMemo(() => buildPipeline(board), [board])
  const line = lineMetrics(m, b)
  const safe = ORDER.every((v, i) => order[i] === v)
  const badges = [data.missing === 0, Boolean(touched.outlier), Boolean(touched.encoding), Boolean(touched.scaling), safe, line.hits === POINTS.length]
  const count = badges.filter(Boolean).length
  const clean = data.missing === 0
  const selectedRow = selected === null ? null : Number(selected.split(':')[0])
  const selectedCol = selected?.split(':')[1]
  const currentStat = selectedCol ? data.stats[selectedCol] : null
  const selectedPulled = selected && board.pulled.includes(selected)

  useEffect(() => {
    const changed = () => setFull(fullscreenElement() === stage.current)
    document.addEventListener('fullscreenchange', changed)
    document.addEventListener('webkitfullscreenchange', changed)
    return () => { document.removeEventListener('fullscreenchange', changed); document.removeEventListener('webkitfullscreenchange', changed) }
  }, [])

  const edit = (change) => {
    const previous = boardRef.current
    history.current.push(previous)
    const next = { ...previous, ...change }
    boardRef.current = next; setBoard(next); setSaved(false)
  }
  const pull = key => {
    setSelected(key)
    if (!boardRef.current.pulled.includes(key)) edit({
      pulled: [...boardRef.current.pulled, key],
      repairs: Object.fromEntries(Object.entries(boardRef.current.repairs).filter(([cell]) => cell !== key)),
    })
    setMessage('Socket opened! Choose a replacement block from the toolbox, or drag one into the socket.'); sfx.whoosh()
  }
  const fill = (key, method) => {
    const col = key?.split(':')[1]
    if (!key || !boardRef.current.pulled.includes(key) || !METHODS[method] || (col === 'city' && method !== 'mode')) return
    edit({ repairs: { ...boardRef.current.repairs, [key]: method }, pulled: boardRef.current.pulled.filter(k => k !== key) })
    setMessage(`${method.toUpperCase()} block inserted: ${display(data.stats[col][method])}. This value comes from observed training data.`)
    setSelected(null); sfx.coin()
  }
  const pick = (key, value) => { edit({ [key]: value }); setTouched(t => ({ ...t, [key]: true })); sfx.select() }
  const go = next => { setRoom(next); setMessage(''); sfx.select() }
  const undo = () => {
    const previous = history.current.pop()
    if (previous) { boardRef.current = previous; setBoard(previous); setSelected(null); setSaved(false); setMessage('Last table change undone.'); sfx.back() }
  }
  const reset = () => {
    const initial = freshBoard(); boardRef.current = initial; setBoard(initial)
    history.current = []; setTouched({}); setOrder([]); setM(0.5); setB(4); setRoom(0); setSelected(null); setSaved(false)
    setMessage('Fresh game. Pull out a missing block to begin.'); sfx.replay()
  }
  const save = () => {
    if (count !== ROOMS.length) return
    onSaveResult({ title: 'Data Blocks Arcade — all six rooms complete', metrics: [
      { label: 'Rooms complete', value: `${count}/6` }, { label: 'Rows retained', value: `${data.rows.length}/${RAW.length}` },
      { label: 'Missing values filled', value: String(data.filled) }, { label: 'Rows deleted', value: String(board.removed.length) },
      { label: 'Outlier treatment', value: board.outlier === 'clip' ? `IQR cap ${display(data.fence)}` : 'Kept for investigation' },
      { label: 'Encoding / scaling', value: `${board.encoding} / ${board.scaling}` },
      { label: 'Toy line', value: `y = ${m}x + ${b}` }, { label: 'Toy line MSE', value: line.mse.toFixed(3) },
    ], explanation: `Repaired cells with individual mean, median or mode blocks; ${data.filled} filled and ${board.removed.length} rows removed. All imputation, outlier limits, category mappings and scalers use training rows only. The last two rows are held out. The separate toy line activity shows how slope and intercept affect prediction error.` })
    setSaved(true); sfx.powerUp()
  }
  const exportPython = async () => {
    if (!clean) return
    if (fullscreenElement() === stage.current) {
      try { await (document.exitFullscreen ?? document.webkitExitFullscreen)?.call(document) }
      catch { setMessage('Exit fullscreen, then open Python practice.'); return }
    }
    onUsePython(pythonCode(board, m, b))
  }

  return <section ref={stage} className={`pa-arcade${full ? ' is-fullscreen' : ''}`} aria-label="Data Blocks Arcade simulation">
    <header className="pa-header">
      <div className="pa-brand"><Pac /><div><p>EXPERIMENT 01 · LEARN BY PLAYING</p><h3>Data Blocks Arcade</h3></div></div>
      <div className="pa-score"><strong>{count * 100}</strong><span>ARCADE POINTS · THIS RUN</span></div>
      <button type="button" className="pa-icon" aria-label={full ? 'Exit fullscreen' : 'Fullscreen simulation'} onClick={() => toggleElementFullscreen(stage.current)}>{full ? <Minimize /> : <Maximize />}</button>
    </header>
    <nav className="pa-rooms" aria-label="Arcade rooms">{ROOMS.map((label, i) => <button type="button" key={label} onClick={() => go(i)} aria-current={room === i ? 'step' : undefined}><span>{badges[i] ? <Check size={14} /> : i + 1}</span>{label}</button>)}</nav>
    <div className="pa-room" key={room}>
      <div className="pa-room-title"><span className="pa-kicker">ROOM {room + 1} / 6</span><h4>{ROOMS[room]}</h4><span className={`pa-badge${badges[room] ? ' is-earned' : ''}`}>{badges[room] ? '★ ROOM CLEARED' : 'TAKE YOUR TIME · NO LIVES LOST'}</span></div>

      {room === 0 && <>
        <p className="pa-intro">Pull the pink missing blocks out of this sample database. Snap in a replacement and watch the table repair itself.</p>
        <div className="pa-play-layout">
          <div>
            <div className="pa-table-status"><span><b>{data.missing}</b> empty values left</span><span><b>{data.filled}</b> blocks repaired</span><button type="button" onClick={undo} disabled={!history.current.length}><Undo2 size={15} /> Undo</button></div>
            <div className="pa-table-scroll"><table className="pa-table"><caption>Sample customer records · rows 11–12 are held-out test data</caption><thead><tr><th>ROW</th>{COLUMNS.map(col => <th key={col}>{col.toUpperCase()}</th>)}</tr></thead><tbody>
              {data.rows.map(row => <tr key={row.id} className={row.split === 'test' ? 'is-test' : ''}><th scope="row">{String(row.id + 1).padStart(2, '0')}<small>{row.split}</small></th>
                {COLUMNS.map(col => {
                  const key = `${row.id}:${col}`, repaired = Boolean(board.repairs[key]), pulled = board.pulled.includes(key)
                  return <td key={col} className={selected === key ? 'is-target' : ''}
                    onDragOver={e => { if (pulled) e.preventDefault() }} onDrop={e => { e.preventDefault(); fill(key, e.dataTransfer.getData('text/plain')) }}>
                    {row[col] === null ? <div onClick={() => { if (pulled) setSelected(key) }}>
                      {pulled ? <button type="button" className="pa-socket" aria-label={`Choose replacement for row ${row.id + 1} ${col}`} onClick={() => setSelected(key)}><span className="pa-ejected" aria-hidden="true">?</span><span>+</span><small>DROP BLOCK</small></button>
                        : <MissingBlock label={`row ${row.id + 1}, ${col}`} pulled={false} onPull={() => pull(key)} />}
                    </div> : repaired ? <button type="button" className="pa-value is-repaired" key={`${key}-${board.repairs[key]}`} aria-label={`Replace ${board.repairs[key]} block in row ${row.id + 1} ${col}`} onClick={() => pull(key)}><b>{display(row[col])}</b><small>{board.repairs[key]} ✓ · swap</small></button>
                      : <span className={`pa-value${row.salary === 250000 && col === 'salary' ? ' is-outlier' : ''}`}><b>{display(row[col])}</b></span>}
                  </td>
                })}</tr>)}
            </tbody></table></div>
          </div>
          <aside className="pa-toolbox"><p className="pa-kicker">REPLACEMENT BLOCKS</p><h5>{selectedCol ? `Row ${selectedRow + 1} · ${selectedCol}` : 'Open a socket first'}</h5>
            {Object.entries(METHODS).map(([method, [name, hint]]) => {
              const disabled = !selectedPulled || (selectedCol === 'city' && method !== 'mode')
              return <button type="button" key={method} className={`pa-tool is-${method}`} disabled={disabled} draggable={!disabled}
                onDragStart={e => e.dataTransfer.setData('text/plain', method)} onClick={() => fill(selected, method)}>
                <span className="pa-tool-cube">{method === 'mean' ? 'μ' : method === 'median' ? '½' : '★'}</span>
                <span><strong>{method.toUpperCase()} {currentStat?.[method] != null ? `→ ${display(currentStat[method])}` : ''}</strong><small>{name} · {hint}</small></span>
              </button>
            })}
            {currentStat?.modes.length > 1 && selectedCol !== 'city' && <p className="pa-note">Mode tie: {currentStat.modes.length} values are equally common. Here we choose the smallest. Mean or median is often more useful for these numbers.</p>}
            {selectedCol === 'city' && <p className="pa-note">Cities are names. They have no numeric mean or median, so use mode.</p>}
            <button type="button" className="pa-delete-row" disabled={!selectedPulled} onClick={() => {
              edit({ removed: [...board.removed, selectedRow], pulled: board.pulled.filter(k => !k.startsWith(`${selectedRow}:`)) }); setSelected(null)
              setMessage('Entire row removed. Deletion fixes missingness but loses the other information in that row. Undo is available.'); sfx.back()
            }}>Or delete this entire row</button>
            <p className="pa-note">Drag a ? block at least 40 pixels, or click it. Then click a tool or drag it into the socket. Keyboard: Tab, then Enter.</p>
          </aside>
        </div>
        <p className="pa-tip">💡 A missing cell is a gap, not zero. Pulling it out opens the gap; inserting a block fills it. No real database is changed.</p>
      </>}

      {room === 1 && <>
        <p className="pa-intro">One salary block towers above the others. Inspect it, then choose whether to keep it or cap it at the training data’s IQR fence.</p>
        <div className="pa-boss-field" aria-label="Salary values compared with the IQR upper fence">
          {data.rows.filter(r => r.salary !== null).map(row => <div className={`pa-tower${row.id === 6 ? ' is-boss' : ''}`} key={row.id} style={{ '--height': `${Math.max(8, row.salary / 250000 * 100)}%` }}><span>{display(row.salary)}</span><div /><small>R{row.id + 1}</small></div>)}
        </div>
        <div className="pa-choice-row"><Choice active={touched.outlier && board.outlier === 'keep'} onClick={() => pick('outlier', 'keep')}>🔎 Keep & investigate<small>Big does not always mean wrong.</small></Choice><Choice active={touched.outlier && board.outlier === 'clip'} onClick={() => pick('outlier', 'clip')}>⚡ Cap the boss at {display(data.fence)}<small>Q3 + 1.5 × IQR, fitted on observed training salaries.</small></Choice></div>
        <p className="pa-tip">{board.outlier === 'clip' ? 'The tall block shrinks, but the row stays. Your mean / median replacements are recalculated from the capped training values.' : 'The extreme value pulls the mean upward. Try capping it and compare the repaired salary blocks in Room 1.'}</p>
      </>}

      {room === 2 && <>
        <p className="pa-intro">Turn city names into machine-readable blocks. Switch the decoder to see why numbered cities can be misleading.</p>
        <div className="pa-choice-row"><Choice active={touched.encoding && board.encoding === 'label'} onClick={() => pick('encoding', 'label')}>123 · Label encoding<small>One column of category numbers</small></Choice><Choice active={touched.encoding && board.encoding === 'onehot'} onClick={() => pick('encoding', 'onehot')}>▥ · One-hot encoding<small>One 0/1 column per city</small></Choice></div>
        <div className="pa-decoders">{data.cities.map((city, i) => <div className="pa-decode" key={city}><strong>{city}</strong><ArrowRight aria-hidden="true" /><div className="pa-bits" key={board.encoding}>{board.encoding === 'label' ? <span className="is-on">{i}</span> : data.cities.map((c, j) => <span key={c} className={i === j ? 'is-on' : ''}>{Number(i === j)}<small>{c}</small></span>)}</div></div>)}</div>
        <p className="pa-tip">{board.encoding === 'label' ? 'Chennai = 0, Delhi = 1, Mumbai = 2 does not mean Mumbai is twice Delhi. These numbers create a false order for a linear model.' : 'Each city gets its own switch. No city becomes “larger” than another. This is a good fit for unordered categories.'}</p>
      </>}

      {room === 3 && <>
        <p className="pa-intro">Age and salary use very different units. Send both through the scale machine so a distance-based model can compare them more fairly.</p>
        <div className="pa-choice-row">{[['none', 'Original units', 'See the size mismatch'], ['minmax', 'Min–max', '(x − min) / (max − min)'], ['standard', 'Z-score', '(x − mean) / std']].map(([value, label, hint]) => <Choice key={value} active={touched.scaling && board.scaling === value} onClick={() => pick('scaling', value)}>{label}<small>{hint}</small></Choice>)}</div>
        <div className="pa-scale-machine"><Pac /><span className="pa-machine-label">{board.scaling.toUpperCase()}</span>{['age', 'salary'].map(col => {
          const raw = data.rows.find(r => r.id === 0)?.[col], transformed = data.processed.find(r => r.row === 1)?.[col]
          return <div className="pa-scale-track" key={col}><strong>{col.toUpperCase()}</strong><span className="pa-mini-block">{display(raw)}</span><span className="pa-conveyor" aria-hidden="true">··············</span><span className="pa-mini-block is-output" key={`${col}-${board.scaling}`}>{display(transformed)}</span></div>
        })}</div>
        <p className="pa-tip">{board.scaling === 'none' ? '₹32,000 and 25 years are different scales. Try min–max to place training values between 0 and 1.' : board.scaling === 'minmax' ? 'Training values fit in 0–1. New test values can fall outside that range. The test set never chooses the minimum or maximum.' : 'A z-score of 0 is the training mean; +1 is one standard deviation above it. Negative values are normal.'}</p>
      </>}

      {room === 4 && <>
        <p className="pa-intro">Keep the test data behind the ghost lock. Click the four pipeline blocks in the correct order.</p>
        <div className="pa-split"><div><strong>TRAINING ZONE</strong><div className="pa-row-tokens">{data.rows.filter(r => r.split === 'train').map(r => <span key={r.id}>{r.id + 1}</span>)}</div><small>Learn fill values, encodings and scaling here.</small></div><div className="pa-test-vault"><span className="pa-ghost" aria-hidden="true">● ●</span><strong>TEST VAULT</strong><div className="pa-row-tokens"><span>11</span><span>12</span></div><small>Apply existing rules here. Never fit here.</small></div></div>
        <div className="pa-pipeline" aria-label="Your pipeline order">{ORDER.map((_, i) => <div key={i} className={order[i] ? 'is-filled' : ''}><b>{i + 1}</b><strong>{order[i] ?? 'EMPTY'}</strong><small>{FLOW[order[i]] ?? 'Choose a block below'}</small></div>)}</div>
        <div className="pa-choice-row">{['FIT', 'TRAIN', 'SPLIT', 'TRANSFORM'].map(value => <button type="button" className="pa-choice" key={value} disabled={order.includes(value)} onClick={() => { setOrder(o => [...o, value]); setSaved(false); sfx.select() }}>{value}</button>)}<button type="button" className="pa-choice" onClick={() => { setOrder([]); setSaved(false) }}><RotateCcw size={16} /> Retry order</button></div>
        <p className={`pa-tip${safe ? ' is-success' : ''}`} role="status">{safe ? 'Lock secured! Split → fit on train → transform both → train the model. That is the rule used by this game’s cleaning pipeline.' : order.length === 4 ? 'The ghost found a leak. Start by splitting, then learn the cleaning rules from training rows. Retry whenever you like.' : 'Hint: put the test rows away before any step learns from data.'}</p>
        <details className="pa-details"><summary>Why fitting on all rows changes the rules</summary><p>Observed training salary mean: {display(mean(RAW.slice(0, TRAIN_COUNT).filter(r => r.salary !== null).map(r => r.salary)))}. All-row mean: {display(mean(RAW.filter(r => r.salary !== null).map(r => r.salary)))}. Including held-out rows changes the fill value before the model is trained. These numbers use the original, unclipped table.</p></details>
      </>}

      {room === 5 && <>
        <p className="pa-intro">Bonus room: steer the line through all six pellets. Slope tilts it; intercept lifts it. This small toy dataset is separate from the customer table.</p>
        <div className="pa-line-layout"><LineBoard m={m} b={b} /><aside className="pa-toolbox"><p className="pa-equation">y = <b>{m.toFixed(1)}</b>x + <b>{b.toFixed(1)}</b></p>
          <Slider label="Slope m · tilt" min={0} max={3} step={0.1} value={m} digits={1} onChange={v => { setM(v); setSaved(false) }} />
          <Slider label="Intercept b · lift" min={0} max={5} step={0.1} value={b} digits={1} onChange={v => { setB(v); setSaved(false) }} />
          <div className="pa-line-score"><strong>{line.hits}/6</strong><span>PELLETS REACHED</span><small>Mean squared error: {line.mse.toFixed(3)}<br />Smaller is better. Pink gaps are errors.</small></div>
          <details className="pa-details"><summary>Need a hint?</summary><p>The first pellet is at (0, 1): try intercept 1. Each step right goes 2 up: try slope 2.</p></details>
        </aside></div>
        <p className={`pa-tip${badges[5] ? ' is-success' : ''}`} role="status">{badges[5] ? 'All pellets reached! You can see how slope and intercept work together to fit the data.' : 'Adjust both sliders. A pellet turns green when the line is within 0.35 units of it. Keep exploring — mistakes cost nothing.'}</p>
      </>}

      <div className="pa-message" role="status" aria-live="polite">{message || (badges[room] ? 'Room cleared. Explore more, or continue to the next room.' : 'Experiment with the blocks. Your choices are reversible.')}</div>
      <div className="pa-room-footer"><button type="button" className="lab-btn" disabled={room === 0} onClick={() => go(room - 1)}><ArrowLeft /> Previous room</button><span>{count} / 6 badges collected</span>{room < 5 && <button type="button" className="lab-btn lab-btn-primary" onClick={() => go(room + 1)}>Next room <ArrowRight /></button>}</div>
    </div>
    <details className="pa-details pa-output"><summary>Inspect your processed dataset · {data.rows.length} rows · {data.missing} missing values</summary><div className="pa-table-scroll"><table className="pa-output-table"><thead><tr>{Object.keys(data.processed[0]).map(col => <th key={col}>{col}</th>)}</tr></thead><tbody>{data.processed.map(row => <tr key={row.row}>{Object.values(row).map((v, i) => <td key={i}>{display(v)}</td>)}</tr>)}</tbody></table></div><p>Statistics are fitted on training rows only. Unrepaired cells stay missing until you fill them or delete their entire row.</p></details>
    <footer className="pa-actions"><button type="button" className="lab-btn" onClick={reset}><RotateCcw /> Restart workshop</button><button type="button" className="lab-btn" disabled={!clean} onClick={exportPython}><Code /> Use this data in Python</button><button type="button" className="lab-btn lab-btn-primary" disabled={count < 6} onClick={save}><Save /> {saved ? 'Saved to Results ✓' : 'Save completed run'}</button><small>{count < 6 ? 'Collect all six room badges to save. Repair all missing values to export to Python.' : 'All six rooms cleared. Save your choices and line result to Results & Analysis.'}</small></footer>
  </section>
}
