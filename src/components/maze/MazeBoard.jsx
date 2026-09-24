import { Fragment, useLayoutEffect, useRef, useState } from 'react'
import { Lock, Star } from 'lucide-react'
import { LABS } from '../../data/labs.js'
import { labStatus, nextLab } from '../../progress.js'
import { GhostIcon } from './sprites.jsx'

// Desktop board geometry in px. Labs 1-5 run left to right on the top row, the track
// U-turns on the right, and labs 6-10 run back right to left on the bottom row.
const ROW_Y = [110, 440]
const BOARD_HEIGHT = 680
const EDGE = 140 // room left of the first column and right of the last
const TURN = 125 // how far the U-turn swings out past the last column
const CORNER = 65
const RING = 70 // node circle radius plus its glow ring
const FINAL_RING = 90 // the championship diamond's half-width plus clearance
const PAC_GAP = 96 // distance from a node centre to Pac-Man
const POWER_SEGMENT = 7

// Ghosts guard the track right after these labs.
const GHOSTS = {
  4: { label: 'QUIZ BOSS', color: 'var(--mz-ghost-pink)' },
  9: { label: 'FINAL GATE', color: 'var(--mz-cyan)' },
}

function useElementWidth(ref) {
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const update = () => setWidth(element.clientWidth)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])

  return width
}

function buildLayout(width) {
  const step = (width - EDGE * 2) / 4
  const columnX = (column) => EDGE + step * column
  const [top, bottom] = ROW_Y
  const turnX = columnX(4) + TURN

  const spots = LABS.map((lab, index) => {
    const row = index < 5 ? 0 : 1
    return { x: columnX(row === 0 ? index : 9 - index), y: ROW_Y[row], row }
  })

  const track = [
    `M24 ${top}`,
    `H${turnX - CORNER}`,
    `A${CORNER} ${CORNER} 0 0 1 ${turnX} ${top + CORNER}`,
    `V${bottom - CORNER}`,
    `A${CORNER} ${CORNER} 0 0 1 ${turnX - CORNER} ${bottom}`,
    `H${columnX(0)}`,
  ].join(' ')

  // Segment N is the stretch of track from lab N to lab N + 1.
  const segments = LABS.slice(0, -1).map((lab, index) => {
    const from = spots[index]
    const to = spots[index + 1]

    if (from.row !== to.row) {
      return { id: lab.id, pellets: [1 / 3, 2 / 3].map((f) => ({ x: turnX, y: top + (bottom - top) * f })) }
    }

    const direction = Math.sign(to.x - from.x)
    const start = from.x + direction * RING
    const end = to.x - direction * (LABS[index + 1].final ? FINAL_RING : RING)
    const along = (fraction) => start + (end - start) * fraction
    const ghost = GHOSTS[lab.id]
    // On narrow desktops a ghost's stretch of track only has room for the ghost itself.
    const roomForPellets = Math.abs(end - start) >= 120
    const fractions = ghost ? (roomForPellets ? [0.12, 0.88] : []) : [0.25, 0.5, 0.75]

    return {
      id: lab.id,
      pellets: fractions.map((f) => ({ x: along(f), y: from.y, power: lab.id === POWER_SEGMENT && f === 0.5 })),
      ghost: ghost && { ...ghost, x: along(0.5), y: from.y },
    }
  })

  return { spots, track, segments }
}

const place = ({ x, y }) => ({ '--x': `${x}px`, '--y': `${y}px` })

export function MazeBoard({ progress, onOpen }) {
  const boardRef = useRef(null)
  const width = useElementWidth(boardRef)
  const layout = buildLayout(width)
  const current = nextLab(progress)
  const here = current && layout.spots[current.id - 1]
  const pacGap = current?.final ? PAC_GAP + 16 : PAC_GAP

  // Pellets and ghosts behind Pac-Man have been eaten; only the track ahead keeps them.
  const ahead = current ? layout.segments.filter((segment) => segment.id >= current.id) : []

  return (
    <div ref={boardRef} className="mz-board" style={{ '--board-height': `${BOARD_HEIGHT}px` }}>
      {width > 0 && (
        <svg className="mz-path" width={width} height={BOARD_HEIGHT} viewBox={`0 0 ${width} ${BOARD_HEIGHT}`} aria-hidden="true">
          <path d={layout.track} />
        </svg>
      )}

      {ahead.map((segment) => (
        <Fragment key={segment.id}>
          {segment.pellets.map((pellet, index) => (
            <span key={index} className={`mz-pellet${pellet.power ? ' mz-power' : ''}`} style={place(pellet)} aria-hidden="true" />
          ))}
          {segment.ghost && (
            <div className="mz-ghost" style={{ ...place(segment.ghost), '--ghost': segment.ghost.color }} aria-hidden="true">
              <span className="mz-ghost-label">{segment.ghost.label}</span>
              <GhostIcon className="mz-ghost-body" />
            </div>
          )}
        </Fragment>
      ))}

      {here && (
        <>
          <span
            className={`mz-you-pac${here.row === 1 ? ' is-left' : ''}`}
            style={place({ x: here.x + (here.row === 0 ? -pacGap : pacGap), y: here.y })}
            aria-hidden="true"
          />
          <span className={`mz-you-label${current.final ? ' is-final' : ''}`} style={place(here)} aria-hidden="true">
            YOU ARE HERE
          </span>
        </>
      )}

      <ol className="mz-nodes">
        {LABS.map((lab, index) => {
          const status = labStatus(progress, lab.id)
          const stars = progress.cleared[lab.id]?.stars ?? 0
          const kicker = lab.final ? 'CHAMPIONSHIP' : `EXPERIMENT ${lab.id}`

          return (
            <li
              key={lab.id}
              className={`mz-node is-${status}${lab.final ? ' is-final' : ''}`}
              style={{ ...place(layout.spots[index]), '--orb-offset': lab.final ? '76px' : '48px' }}
            >
              <button type="button" className="mz-node-hit" onClick={() => onOpen(lab, status)}>
                <span className={`mz-orb${lab.final ? ' mz-orb-diamond' : ''}`}>
                  <span className="mz-orb-face">
                    {status === 'locked' ? (
                      <Lock aria-hidden="true" />
                    ) : (
                      <span className="mz-orb-num">{String(lab.id).padStart(2, '0')}</span>
                    )}
                  </span>
                </span>
                <span className="mz-node-kicker">{kicker}</span>
                <span className="mz-node-title">{lab.title}</span>
                <span className="mz-node-meta">
                  {lab.tier}
                  <i aria-hidden="true" />
                  {lab.xp} XP
                </span>
                <span className="mz-node-stars" role="img" aria-label={`${stars} of 3 stars`}>
                  {[0, 1, 2].map((starIndex) => (
                    <Star key={starIndex} className={starIndex < stars ? 'is-earned' : undefined} aria-hidden="true" />
                  ))}
                </span>
                <span className="mz-sr-only">{status === 'locked' ? '(locked)' : status === 'cleared' ? '(cleared)' : '(ready)'}</span>
              </button>
              {lab.id === 5 && <span className="mz-power-mobile" aria-hidden="true" />}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
