import { useId } from 'react'
import { Brain, Check, FastForward, Heart, Map as MapIcon, Pause, Play, RotateCcw, Star } from 'lucide-react'
import { READY_STEPS, SPEEDS, testCursor } from './game.js'
import { useArrived, useCountUp } from './hooks.js'
import { DATA, ENEMIES, MODELS, N, POINTS, TOLERANCE, foldName, livesFor, num, pct, predictAt } from './model.js'
import { EnemyIcon, PlayerIcon } from './sprites.jsx'

export const foldSizes = (k) => Array.from({ length: k }, (_, i) => Math.ceil((N - i) / k))

// "F1 F3 F4 F5", or compact ranges ("F1–F2, F4–F10") when there are many folds.
export function foldList(k, exclude) {
  const folds = Array.from({ length: k }, (_, i) => i).filter((i) => i !== exclude)
  if (k <= 5) return folds.map(foldName).join(' ')
  const parts = []
  let start = folds[0]
  folds.forEach((f, i) => {
    const next = folds[i + 1]
    if (next !== f + 1) {
      parts.push(start === f ? foldName(f) : `${foldName(start)}–${foldName(f)}`)
      start = next
    }
  })
  return parts.join(', ')
}

export function Hearts({ total, left }) {
  return (
    <span className="cvm-hearts" role="img" aria-label={`${left} of ${total} lives left`}>
      {Array.from({ length: total }, (_, i) => (
        <Heart key={i} className={i < left ? 'is-full' : 'is-lost'} aria-hidden="true" />
      ))}
    </span>
  )
}

export function Stars({ count, total = 5 }) {
  return (
    <span className="cvm-stars" role="img" aria-label={`${count} of ${total} stars`}>
      {Array.from({ length: total }, (_, i) => (
        <Star key={i} className={i < count ? 'is-earned' : undefined} aria-hidden="true" />
      ))}
    </span>
  )
}

export function ScoreNumber({ value }) {
  const shown = useCountUp(value)
  return <>{String(shown).padStart(6, '0')}</>
}

// ---------- HUD ----------

export function ArcadeHUD({ game }) {
  const { k, plan, round, phase, score, energy, modelId } = game
  const active = Boolean(plan) && phase !== 'setup'
  const fold = active ? plan.folds[round] : null
  const total = fold ? livesFor(fold.samples.length) : livesFor(foldSizes(k)[0])
  const testFold = active ? round : 0
  const lives = active && phase !== 'transition' ? energy : total
  return (
    <dl className="cvm-hud" aria-label="Game status">
      <div>
        <dt>LEVEL</dt>
        <dd>CV-{String(k).padStart(2, '0')}</dd>
      </div>
      <div>
        <dt>ROUND</dt>
        <dd>{active ? `${Math.min(round + 1, k)} / ${k}` : `– / ${k}`}</dd>
      </div>
      <div>
        <dt>SCORE</dt>
        <dd className="is-score">
          <ScoreNumber value={score} />
        </dd>
      </div>
      <div>
        <dt>LIVES</dt>
        <dd>
          <Hearts total={total} left={lives} />
        </dd>
      </div>
      <div>
        <dt>TEST FOLD</dt>
        <dd className="is-test">{foldName(testFold)}</dd>
      </div>
      <div className="cvm-hud-wide">
        <dt>TRAINING</dt>
        <dd className="is-train">{foldList(k, testFold)}</dd>
      </div>
      <div>
        <dt>MODEL</dt>
        <dd>{MODELS[modelId].name.toUpperCase()}</dd>
      </div>
    </dl>
  )
}

// ---------- Dataset → zones strip (setup and fold rotation) ----------

export function FoldStrip({ k, testFold, fromFold = testFold, results = [], big = false }) {
  const arrived = useArrived(`${k}-${testFold}`)
  const shown = arrived ? testFold : fromFold
  const sizes = foldSizes(k)
  return (
    <div className={`cvm-strip${big ? ' is-big' : ''}`}>
      <div className="cvm-strip-track" style={{ '--k': k }}>
        <span className="cvm-strip-ghost" style={{ '--at': shown }} aria-hidden="true">
          <EnemyIcon className="cvm-strip-ghost-icon" />
        </span>
        {sizes.map((size, i) => {
          const test = i === shown
          const done = results.find((r) => r.fold === i)
          return (
            <div key={`${i}-${test}`} className={`cvm-fold-card${test ? ' is-test' : ' is-train'}`}>
              <strong>FOLD {i + 1}</strong>
              <span className="cvm-fold-dots" aria-hidden="true">
                {Array.from({ length: size }, (_, d) => (
                  <i key={d} />
                ))}
              </span>
              <em>{test ? 'TEST ZONE' : 'TRAIN'}</em>
              <small>{done ? `✓ ${pct(done.score)}` : `${size} samples`}</small>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------- Mini-map ----------

export function MiniMap({ game }) {
  const { k, round, results, plan, phase } = game
  const testFold = plan && phase !== 'setup' ? round : 0
  return (
    <section className="cvm-card cvm-minimap" aria-label="CV maze overview">
      <h5>
        <MapIcon aria-hidden="true" /> CV MAZE
      </h5>
      <ol className={`cvm-minimap-grid is-k${k}`}>
        {Array.from({ length: k }, (_, i) => {
          const test = i === testFold
          const done = results.some((r) => r.fold === i)
          return (
            <li key={`${i}-${test}`} className={`${test ? 'is-test' : 'is-train'}${done ? ' is-done' : ''}`}>
              <b>{foldName(i)}</b>
              <span>{test ? 'TEST' : 'TRAIN'}</span>
              {done && <Check aria-label="evaluated" />}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

// ---------- Scoreboard ----------

export function FoldScoreboard({ game }) {
  const { k, results, round, phase, correct, wrong, plan } = game
  const live = plan && ['transition', 'training', 'ready', 'test'].includes(phase)
  const mean = results.length ? results.reduce((s, r) => s + r.score, 0) / results.length : null
  return (
    <section className="cvm-card cvm-scoreboard" aria-label="Cross validation scoreboard">
      <h5>CROSS VALIDATION SCOREBOARD</h5>
      <ol>
        {Array.from({ length: k }, (_, i) => {
          const result = results.find((r) => r.fold === i)
          const playing = live && i === round
          return (
            <li key={i} className={result ? 'is-done' : playing ? 'is-live' : undefined}>
              <span>FOLD {i + 1}</span>
              <b>{result ? pct(result.score) : playing ? `▶ ${correct}/${correct + wrong}` : '--'}</b>
              <i aria-hidden="true">{result ? (result.crashed ? '✕' : '✓') : ''}</i>
            </li>
          )
        })}
      </ol>
      <p>
        MEAN SO FAR <b>{mean == null ? '--' : pct(mean)}</b>
      </p>
    </section>
  )
}

// ---------- ML View ----------

const PLOT = { w: 300, h: 168, pad: 12 }
const sx = (x) => PLOT.pad + ((x + 1.05) / 2.1) * (PLOT.w - 2 * PLOT.pad)
const sy = (y) => PLOT.h - PLOT.pad - ((Math.max(-1.3, Math.min(1.3, y)) + 1.1) / 2.2) * (PLOT.h - 2 * PLOT.pad)

function ModelPlot({ plan, round, trainedCount, showCurve, evaluated, current }) {
  const clip = useId().replace(/:/g, '')
  const fold = plan.folds[round]
  const order = plan.folds.filter((f) => f.fold !== round).flatMap((f) => f.testIdx)
  const learned = new Set(order.slice(0, trainedCount))
  const xs = Array.from({ length: 121 }, (_, i) => -1.05 + (2.1 * i) / 120)
  const curve = xs.map((x) => ({ x, y: predictAt(fold.coefficients, x) }))
  const band = [...curve.map((p) => `${sx(p.x)},${sy(p.y + TOLERANCE)}`), ...[...curve].reverse().map((p) => `${sx(p.x)},${sy(p.y - TOLERANCE)}`)].join(' ')
  return (
    <svg className="cvm-plot" viewBox={`0 0 ${PLOT.w} ${PLOT.h}`} role="img" aria-label={`Samples and the model fitted without ${foldName(round)}`}>
      <defs>
        <clipPath id={clip}>
          <rect x={PLOT.pad} y={PLOT.pad} width={PLOT.w - 2 * PLOT.pad} height={PLOT.h - 2 * PLOT.pad} />
        </clipPath>
      </defs>
      <rect x={PLOT.pad} y={PLOT.pad} width={PLOT.w - 2 * PLOT.pad} height={PLOT.h - 2 * PLOT.pad} className="cvm-plot-bg" />
      <line x1={PLOT.pad} x2={PLOT.w - PLOT.pad} y1={sy(0)} y2={sy(0)} className="cvm-plot-axis" />
      <g clipPath={`url(#${clip})`}>
        {showCurve && <polygon points={band} className="cvm-plot-band" />}
        {showCurve && <polyline points={curve.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')} className="cvm-plot-curve" />}
        {order.map((i) => (
          <circle key={i} cx={sx(DATA[i].x)} cy={sy(DATA[i].y)} r="3" className={`cvm-plot-train${learned.has(i) ? ' is-on' : ''}`} />
        ))}
        {fold.samples.map((s, i) =>
          i < evaluated ? <circle key={s.id} cx={sx(s.x)} cy={sy(s.y)} r="4" className={`cvm-plot-test${s.correct ? ' is-hit' : ' is-miss'}`} /> : null,
        )}
        {current && (
          <g>
            <line x1={sx(current.x)} x2={sx(current.x)} y1={sy(current.y)} y2={sy(current.predicted)} className="cvm-plot-error" />
            <circle cx={sx(current.x)} cy={sy(current.predicted)} r="4" className="cvm-plot-pred" />
            <circle cx={sx(current.x)} cy={sy(current.y)} r="6" className="cvm-plot-current" />
          </g>
        )}
      </g>
    </svg>
  )
}

function Rows({ rows }) {
  return (
    <dl className="cvm-ml-rows">
      {rows.map(([label, value, tone]) => (
        <div key={label} className={tone ? `is-${tone}` : undefined}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function MLView({ game }) {
  const { plan, round, phase, trained, modelId, k } = game
  const model = MODELS[modelId]
  let rows
  let note
  let plot = null

  if (!plan || phase === 'setup') {
    rows = [
      ['Dataset', `${N} samples · noisy cubic`],
      ['Task', 'Regression: predict y from x'],
      ['Model', model.kind],
      ['Folds', `${k} zones of ${foldSizes(k).at(-1)}–${foldSizes(k)[0]} samples`],
    ]
    note = `A prediction counts as correct when it lands within ±${TOLERANCE} of the actual y.`
  } else {
    const fold = plan.folds[round]
    const trainCount = fold.trainIdx.length
    const { index, sub } = testCursor(game)
    if (phase === 'transition' || phase === 'training') {
      rows = [
        ['Mode', 'TRAINING', 'train'],
        ['Training samples collected', `${phase === 'training' ? trained : 0} / ${trainCount}`, 'train'],
        ['Hidden test samples', `${fold.samples.length} 🔒`, 'test'],
      ]
      note = 'The model can learn from these samples. The unseen fold stays locked.'
      plot = { trainedCount: phase === 'training' ? trained : 0, showCurve: false, evaluated: 0 }
    } else if (phase === 'ready') {
      rows = [
        ['Trained on', `${trainCount} samples (${foldList(k, round)})`, 'train'],
        ['Training score', pct(fold.trainScore), 'train'],
        ['Training MSE', num(fold.trainMse, 3)],
        ['Status', READY_STEPS[game.step]],
      ]
      note = 'The model is now entering data it has never seen before.'
      plot = { trainedCount: trainCount, showCurve: true, evaluated: 0 }
    } else if (phase === 'test') {
      const s = fold.samples[Math.min(index, fold.samples.length - 1)]
      const shown = sub >= 1
      const judged = sub >= 2
      rows = [
        ['Sample', `#${s.id}  (${index + 1} of ${fold.samples.length})`],
        ['Input x', num(s.x)],
        ['Actual y', num(s.y), 'test'],
        ['Predicted ŷ', shown ? num(s.predicted) : '…', 'model'],
        ['Error |y − ŷ|', judged ? num(Math.abs(s.error)) : '…'],
        ['Result', judged ? (s.correct ? 'Correct ✓' : 'Wrong ✕') : shown ? 'PREDICTING…' : '—', judged ? (s.correct ? 'good' : 'bad') : undefined],
      ]
      note = `${ENEMIES[s.kind].name}: ${ENEMIES[s.kind].meaning}.`
      plot = { trainedCount: trainCount, showCurve: true, evaluated: judged ? index + 1 : index, current: shown ? s : null }
    } else {
      rows = [
        ['Fold', `${foldName(round)} evaluated`],
        ['Correct', `${fold.correct} / ${fold.samples.length}`, 'good'],
        ['Fold score', pct(fold.score), 'model'],
        ['Fold MSE', num(fold.mse, 3)],
      ]
      note = 'This fold score becomes one of the k numbers averaged into the CV score.'
      plot = { trainedCount: trainCount, showCurve: true, evaluated: fold.samples.length }
    }
  }

  return (
    <section className="cvm-card cvm-mlview" aria-label="ML view">
      <h5>
        <Brain aria-hidden="true" /> ML VIEW
      </h5>
      {plot && <ModelPlot plan={plan} round={round} {...plot} />}
      {plot && (
        <p className="cvm-plot-key">
          <span className="is-train">● training</span>
          <span className="is-test">○ test</span>
          {plot.showCurve && <span className="is-model">— model ±{TOLERANCE}</span>}
        </p>
      )}
      <Rows rows={rows} />
      <p className="cvm-note">{note}</p>
    </section>
  )
}

// ---------- Legend ----------

export function MazeLegend() {
  const items = [
    [<PlayerIcon key="p" />, 'Player', 'Machine learning model (a polynomial)'],
    [<span key="d" className="cvm-legend-dot" />, 'Pellets', 'Dataset samples (x, y)'],
    [<span key="t" className="cvm-legend-zone is-train" />, 'Training zone', 'Data used to train the model'],
    [<EnemyIcon key="e" />, 'Enemy zone', 'Unseen validation / test fold'],
    [<Star key="s" className="cvm-legend-star" aria-hidden="true" />, 'Score', `Prediction performance: +${POINTS.correct} per correct prediction`],
    [<Heart key="h" className="cvm-legend-heart" aria-hidden="true" />, 'Lives', 'How many misses the model can afford on unseen data'],
  ]
  return (
    <details className="cvm-legend">
      <summary>What the game means — legend</summary>
      <ul>
        {items.map(([icon, name, meaning]) => (
          <li key={name}>
            {icon}
            <b>{name}</b>
            <span>{meaning}</span>
          </li>
        ))}
        {Object.entries(ENEMIES).map(([kind, e]) => (
          <li key={kind}>
            <EnemyIcon kind={kind} />
            <b>{e.name}</b>
            <span>{e.meaning}</span>
          </li>
        ))}
      </ul>
      <p className="cvm-note">
        “Correct” means the prediction ŷ lands within ±{TOLERANCE} of the actual y. A fold’s score is the share of its samples predicted correctly.
      </p>
    </details>
  )
}

// ---------- Stability meter ----------

export function StabilityMeter({ stability, bonus }) {
  const blocks = Math.round(stability.level * 10)
  return (
    <section className="cvm-card cvm-stability" aria-label="Model stability">
      <h5>MODEL STABILITY</h5>
      <div className="cvm-meter" role="meter" aria-valuemin={0} aria-valuemax={10} aria-valuenow={blocks} aria-label={stability.label}>
        {Array.from({ length: 10 }, (_, i) => (
          <i key={i} className={i < blocks ? 'is-on' : undefined} style={{ '--i': i }} />
        ))}
      </div>
      <strong className={`cvm-stability-label is-${stability.bonus ? 'good' : 'warn'}`}>{stability.label}</strong>
      <p className="cvm-note">
        Fold scores vary by ±{stability.spread.toFixed(1)} points (standard deviation).
        {bonus > 0 && <b className="cvm-bonus"> STABILITY BONUS +{bonus}</b>}
      </p>
      <p className="cvm-note">Similar scores across different folds suggest that the model behaves consistently on unseen data.</p>
    </section>
  )
}

// ---------- Controls & pause ----------

const SKIP_LABEL = { transition: 'Skip', training: 'Skip training', ready: 'Skip intro', test: 'Finish fold' }

export function ControlBar({ game, dispatch }) {
  const { speed, paused, phase } = game
  const running = ['transition', 'training', 'ready', 'test'].includes(phase)
  return (
    <div className="cvm-controls" role="group" aria-label="Game controls">
      <div className="cvm-speed" role="group" aria-label="Animation speed">
        <span>SPEED</span>
        {SPEEDS.map((s) => (
          <button key={s} type="button" aria-pressed={speed === s} onClick={() => dispatch({ type: 'SET_SPEED', speed: s })}>
            {s}×
          </button>
        ))}
      </div>
      <button type="button" className="lab-btn cvm-btn-sm" onClick={() => dispatch({ type: 'TOGGLE_PAUSE' })} disabled={!running}>
        {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
        {paused ? 'Resume' : 'Pause'}
      </button>
      <button type="button" className="lab-btn cvm-btn-sm" onClick={() => dispatch({ type: 'SKIP' })} disabled={!running}>
        <FastForward aria-hidden="true" />
        {SKIP_LABEL[phase] ?? 'Skip'}
      </button>
      <button type="button" className="lab-btn cvm-btn-sm" onClick={() => dispatch({ type: 'RESTART' })}>
        <RotateCcw aria-hidden="true" />
        Restart
      </button>
    </div>
  )
}

export function pauseExplanation(game) {
  const { plan, round, phase, k } = game
  const fold = plan.folds[round]
  const name = `Fold ${round + 1}`
  const train = foldList(k, round)
  switch (phase) {
    case 'transition':
      return `The folds are rotating. ${name} now becomes the unseen test zone, and ${train} become training data. Every fold takes this role exactly once.`
    case 'training':
      return `${name} is hidden from training. The model is learning only from ${train} — ${fold.trainIdx.length} samples. It never sees the ${fold.samples.length} samples locked in ${name}.`
    case 'ready':
      return `Training is finished and the model is frozen. Next it is evaluated on ${name}, which it has never seen.`
    default:
      return `${name} is currently hidden from training. The model is being evaluated using only this unseen data: each ghost is one test sample, and the model survives it when its prediction lands within ±${TOLERANCE} of the actual value.`
  }
}

export function PauseOverlay({ game, dispatch }) {
  return (
    <div className="cvm-overlay cvm-pause" role="dialog" aria-modal="false" aria-labelledby="cvm-pause-title">
      <div className="cvm-overlay-card">
        <p className="cvm-pixel is-yellow">⏸ PAUSED</p>
        <h4 id="cvm-pause-title" className="cvm-pixel">
          WHAT IS HAPPENING?
        </h4>
        <p>{pauseExplanation(game)}</p>
        <button type="button" className="lab-btn lab-btn-primary" onClick={() => dispatch({ type: 'TOGGLE_PAUSE' })} autoFocus>
          <Play aria-hidden="true" />
          Resume
        </button>
      </div>
    </div>
  )
}
