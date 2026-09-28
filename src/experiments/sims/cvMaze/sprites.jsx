// Original sprites for the Cross Validation Maze (SVG, drawn around the origin).

const FACING = { right: undefined, left: 'scale(-1 1)', up: 'rotate(-90)', down: 'rotate(90)' }

// The ML model: a round chomper with a tiny neural-network antenna.
export function PlayerModel({ dir = 'right', mood = 'normal', size = 13 }) {
  const s = size
  return (
    <g className={`cvm-player is-${mood}`}>
      <g transform={FACING[dir]}>
        <circle className="cvm-player-glow" r={s + 5} />
        <path className="cvm-jaw cvm-jaw-top" d={`M${-s} 0 A${s} ${s} 0 0 1 ${s} 0 Z`} />
        <path className="cvm-jaw cvm-jaw-bottom" d={`M${-s} 0 A${s} ${s} 0 0 0 ${s} 0 Z`} />
        <g className="cvm-jaw-top cvm-player-face">
          <circle cx={s * 0.12} cy={-s * 0.5} r={s * 0.17} className="cvm-player-eye" />
          <path d={`M${-s * 0.2} ${-s + 1} L${-s * 0.55} ${-s - 7} M${-s * 0.2} ${-s + 1} L${s * 0.25} ${-s - 8}`} className="cvm-player-wire" />
          <circle cx={-s * 0.55} cy={-s - 7} r="2.2" className="cvm-player-node" />
          <circle cx={s * 0.25} cy={-s - 8} r="2.2" className="cvm-player-node" />
        </g>
      </g>
    </g>
  )
}

// Pixel enemy (7 × 8 pixel grid). Its colour and trim say what kind of sample it is.
const BODY = ['..###..', '.#####.', '#######', '#######', '#######', '#######', '#######']
const FEET = ['#.#.#.#', '.#.#.#.']

function runs(row, y, p, x0, y0) {
  const rects = []
  let start = -1
  for (let x = 0; x <= row.length; x++) {
    if (row[x] === '#' && start < 0) start = x
    if (row[x] !== '#' && start >= 0) {
      rects.push(<rect key={`${y}-${start}`} x={x0 + start * p} y={y0 + y * p} width={(x - start) * p} height={p} />)
      start = -1
    }
  }
  return rects
}

export function EnemySample({ kind = 'typical', state = 'idle', p = 4 }) {
  const x0 = -3.5 * p
  const y0 = -4 * p
  return (
    <g className={`cvm-enemy is-${kind} is-${state}`}>
      <g className="cvm-enemy-body">
        {BODY.map((row, y) => runs(row, y, p, x0, y0))}
        {FEET.map((row, f) => (
          <g key={f} className={`cvm-enemy-feet f${f}`}>
            {runs(row, 7, p, x0, y0)}
          </g>
        ))}
        {kind === 'noisy' && <rect className="cvm-enemy-glitch" x={x0 - p} y={y0 + 4 * p} width={9 * p} height={p * 0.75} />}
      </g>
      <g className="cvm-enemy-eyes">
        <rect x={x0 + p} y={y0 + 2 * p} width={p * 2} height={p * 2} />
        <rect x={x0 + 4 * p} y={y0 + 2 * p} width={p * 2} height={p * 2} />
      </g>
      <g className="cvm-enemy-pupils">
        <rect x={x0 + 2 * p} y={y0 + 3 * p} width={p} height={p} />
        <rect x={x0 + 5 * p} y={y0 + 3 * p} width={p} height={p} />
      </g>
      {kind === 'edge' && (
        <text className="cvm-enemy-flag" x={x0 + 8 * p} y={y0 + p}>
          !
        </text>
      )}
    </g>
  )
}

// Small pixel padlock drawn around the origin.
export function PixelLock({ scale = 1 }) {
  return (
    <g className="cvm-lock" transform={`scale(${scale})`}>
      <path d="M-6 -4 V-9 A6 6 0 0 1 6 -9 V-4" className="cvm-lock-shackle" />
      <rect x="-9" y="-4" width="18" height="14" rx="2" className="cvm-lock-body" />
      <rect x="-1.5" y="0" width="3" height="5" className="cvm-lock-hole" />
    </g>
  )
}

// Inline icon versions for HTML panels (legend, HUD, cards).
export function PlayerIcon({ className = 'cvm-icon' }) {
  return (
    <svg className={className} viewBox="-18 -24 36 42" aria-hidden="true">
      <PlayerModel />
    </svg>
  )
}

export function EnemyIcon({ kind = 'typical', className = 'cvm-icon' }) {
  return (
    <svg className={className} viewBox="-18 -18 36 36" aria-hidden="true">
      <EnemySample kind={kind} />
    </svg>
  )
}
