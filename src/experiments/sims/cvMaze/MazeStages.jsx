import { useEffect, useMemo, useRef, useState } from 'react'
import { TRAINING_MS, testCursor } from './game.js'
import { useArrived, useElementWidth } from './hooks.js'
import { heading, overviewLayout, pointAlong, testLayout } from './layout.js'
import { ENEMIES, POINTS, foldName, num } from './model.js'
import { EnemySample, PixelLock, PlayerModel } from './sprites.jsx'

const DOOR = 11

function roomWalls({ x, y, w, h, door }) {
  return `M${door.x - DOOR} ${y} H${x + 6} Q${x} ${y} ${x} ${y + 6} V${y + h - 6} Q${x} ${y + h} ${x + 6} ${y + h} H${x + w - 6} Q${x + w} ${y + h} ${x + w} ${y + h - 6} V${y + 6} Q${x + w} ${y} ${x + w - 6} ${y} H${door.x + DOOR}`
}

const place = (point) => `translate(${point.x}px, ${point.y}px)`

// ---------- Training: every fold is a room; the player collects the training rooms' samples ----------

export function OverviewMaze({ game, onEat, onTrained }) {
  const { plan, round, phase, step, trained, paused, speed, modelId } = game
  const boxRef = useRef(null)
  const playerRef = useRef(null)
  const width = useElementWidth(boxRef)
  const layout = useMemo(() => (width > 0 ? overviewLayout(width, plan, round) : null), [width, plan, round])
  const [dir, setDir] = useState('right')
  const elapsed = useRef(0)
  const eaten = useRef(trained)
  const callbacks = useRef({ onEat, onTrained })
  callbacks.current = { onEat, onTrained }

  // Game loop: the player glides along the route; crossing a pellet trains on that sample.
  useEffect(() => {
    if (!layout || phase !== 'training' || paused) return
    const { route } = layout
    const total = TRAINING_MS[modelId]
    let frame
    let last = performance.now()
    const tick = (now) => {
      elapsed.current += (now - last) * speed
      last = now
      const t = Math.min(1, elapsed.current / total)
      const at = pointAlong(route, t * route.length)
      if (playerRef.current) {
        playerRef.current.style.transition = 'none'
        playerRef.current.style.transform = place(at)
      }
      setDir(at.dir)
      const reached = route.marks.filter((mark) => mark.at <= t * route.length + 0.5).length
      while (eaten.current < reached) {
        eaten.current++
        callbacks.current.onEat()
      }
      if (t >= 1) callbacks.current.onTrained()
      else frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [layout, phase, paused, speed, modelId])

  // Outside training the player walks to the locked zone and waits at its gate.
  useEffect(() => {
    if (!layout || !playerRef.current) return
    if (phase === 'training') {
      if (elapsed.current === 0) playerRef.current.style.transform = place(layout.route.points[0])
      return
    }
    const room = layout.rooms[round]
    const target = step >= 2 ? { x: room.door.x, y: room.door.y + 12 } : { x: room.door.x, y: room.lane }
    const from = pointAlong(layout.route, layout.route.length)
    setDir(heading(from, target))
    playerRef.current.style.transition = `transform ${Math.round(700 / speed)}ms ease-in-out`
    playerRef.current.style.transform = place(target)
  }, [layout, phase, step, round, speed])

  const eatenIds = useMemo(() => new Set(layout ? layout.route.marks.slice(0, trained).map((m) => m.id) : []), [layout, trained])
  const lastEaten = layout && trained > 0 ? layout.route.marks[trained - 1] : null
  const lastPellet = lastEaten && layout.rooms.flatMap((r) => r.pellets).find((p) => p.id === lastEaten.id)
  const opening = phase === 'ready' && step >= 2
  const power = modelId === 'overfit'

  return (
    <div ref={boxRef} className="cvm-board">
      {layout && (
        <svg className="cvm-svg" width={layout.width} height={layout.height} viewBox={`0 0 ${layout.width} ${layout.height}`} role="img" aria-label={`Maze with ${plan.k} fold zones. ${foldName(round)} is the locked unseen zone; the model trains on the other folds.`}>
          <defs>
            <pattern id="cvm-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="8" height="8" className="cvm-hatch-bg" />
              <line x1="0" y1="0" x2="0" y2="8" className="cvm-hatch-line" />
            </pattern>
          </defs>
          {layout.rooms.map((room) => (
            <g key={room.fold} className={`cvm-room${room.test ? ' is-test' : ' is-train'}${room.test && opening ? ' is-opening' : ''}`}>
              <rect x={room.x} y={room.y} width={room.w} height={room.h} rx="6" className="cvm-room-fill" fill={room.test ? 'url(#cvm-hatch)' : undefined} />
              <path d={roomWalls(room)} className="cvm-wall" />
              {room.test && <rect x={room.door.x - DOOR} y={room.y - 3} width={DOOR * 2} height="6" className="cvm-gate" />}
              <text x={room.x + 9} y={room.y + 19} className="cvm-room-label">
                {foldName(room.fold)} · {room.test ? 'UNSEEN' : 'TRAIN'}
              </text>
              {room.pellets.map((pellet) =>
                room.test ? (
                  <circle key={pellet.id} cx={pellet.x} cy={pellet.y} r="3.5" className="cvm-pellet is-hidden" />
                ) : (
                  <circle key={pellet.id} cx={pellet.x} cy={pellet.y} r="4" className={`cvm-pellet${eatenIds.has(pellet.id) ? ' is-eaten' : ''}`} />
                ),
              )}
              {room.test && (
                <g transform={`translate(${room.x + room.w / 2}, ${room.y + room.h / 2 + 6}) scale(${Math.min(1, (room.w - 10) / 88)})`} className="cvm-room-lock">
                  <rect x="-44" y="-17" width="88" height="34" rx="5" className="cvm-lock-plate" />
                  <g transform="translate(-28, 1)">
                    <PixelLock scale={0.9} />
                  </g>
                  <text x="-14" y="-2" className="cvm-lock-text">
                    UNSEEN
                  </text>
                  <text x="-14" y="10" className="cvm-lock-text">
                    ZONE
                  </text>
                </g>
              )}
            </g>
          ))}
          {lastPellet && phase === 'training' && (
            <text key={trained} x={lastPellet.x} y={lastPellet.y - 10} className="cvm-pop is-train">
              +1
            </text>
          )}
          <g ref={playerRef} className="cvm-player-pos">
            <PlayerModel dir={dir} mood={power && phase === 'training' ? 'power' : 'normal'} size={11} />
          </g>
        </svg>
      )}
    </div>
  )
}

// ---------- Test: the unseen fold becomes its own maze of ghosts ----------

const RESULT_TAG = { correct: `✓ CORRECT +${POINTS.correct}`, wrong: '✕ MISS', crash: '✕ MISS' }

export function TestMaze({ game }) {
  const { plan, round, phase, speed, modelId, crashed } = game
  const fold = plan.folds[round]
  const n = fold.samples.length
  const boxRef = useRef(null)
  const width = useElementWidth(boxRef)
  const layout = useMemo(() => (width > 0 ? testLayout(width, n) : null), [width, n])
  const arrived = useArrived(`${round}-${width > 0}`)
  const done = phase === 'foldResult'
  const { index: rawIndex, sub: rawSub } = testCursor(game)
  const index = Math.min(rawIndex, n - 1)
  const sub = done ? 3 : rawSub
  const sample = fold.samples[index]

  if (!layout) return <div ref={boxRef} className="cvm-board" />

  const target = arrived ? layout.nodes[index] : layout.entrance
  const from = index === 0 ? layout.entrance : layout.nodes[index - 1]
  const hit = sub === 2 && !sample.correct
  const mood = crashed ? 'crashed' : hit ? 'hit' : 'normal'

  const nodeState = (i) => {
    const s = fold.samples[i]
    if (i < index || (i === index && sub >= 2)) return s.correct ? 'defeated' : 'missed'
    if (i === index) return sub === 1 ? 'scan' : 'approach'
    return 'idle'
  }

  return (
    <div ref={boxRef} className={`cvm-board cvm-test-board${modelId === 'overfit' ? ' is-overfit' : ''}`}>
      <svg className="cvm-svg" width={layout.width} height={layout.height} viewBox={`0 0 ${layout.width} ${layout.height}`} role="img" aria-label={`Unseen zone ${foldName(round)} with ${n} test samples.`}>
        <rect {...{ x: layout.frame.x, y: layout.frame.y, width: layout.frame.w, height: layout.frame.h }} rx="10" className="cvm-zone-frame" />
        {layout.walls.map((w, i) => (
          <line key={i} {...w} className="cvm-wall cvm-wall-thick" />
        ))}
        {layout.pillars.map((p, i) => (
          <line key={i} x1={p.x} x2={p.x} y1={p.y1} y2={p.y2} className="cvm-wall cvm-wall-thin" />
        ))}
        <text x={layout.entrance.x} y={layout.entrance.y - 22} className="cvm-entry-label">
          IN
        </text>
        {fold.samples.map((s, i) => {
          const node = layout.nodes[i]
          const state = nodeState(i)
          return (
            <g key={s.id} transform={`translate(${node.x}, ${node.y})`} className={`cvm-node is-${state}`}>
              <circle r="5" cy="22" className={`cvm-pellet is-test${state === 'defeated' ? ' is-eaten' : ''}`} />
              <g transform="translate(0, -6)">
                <EnemySample kind={s.kind} state={state === 'scan' ? 'scan' : state === 'approach' ? 'approach' : state} />
              </g>
              {state === 'scan' && <circle r="24" cy="-4" className="cvm-scan" />}
              <text y="42" className="cvm-node-id">
                #{s.id}
              </text>
              {state === 'missed' && (
                <text y="-30" className="cvm-node-mark is-miss">
                  ✕
                </text>
              )}
              {state === 'defeated' && (
                <text y="-30" className="cvm-node-mark is-hit">
                  ✓
                </text>
              )}
            </g>
          )
        })}
        <g className="cvm-player-pos" style={{ transform: place(target), transition: arrived ? `transform ${Math.round(420 / speed)}ms linear` : 'none' }}>
          <g transform="translate(0, -6)">
            <PlayerModel dir={heading(from, layout.nodes[index])} mood={mood} size={12} />
          </g>
        </g>
        {!done && sub === 1 && (
          <text x={layout.nodes[index].x} y={layout.nodes[index].y - 44} className="cvm-tag is-predict">
            PREDICTING…
          </text>
        )}
        {!done && sub === 2 && (
          <g key={`${round}-${index}`}>
            <text x={layout.nodes[index].x} y={layout.nodes[index].y - 44} className={`cvm-tag ${sample.correct ? 'is-hit' : 'is-miss'}`}>
              {RESULT_TAG[sample.correct ? 'correct' : 'wrong']}
            </text>
            {!sample.correct && (
              <text x={layout.nodes[index].x} y={layout.nodes[index].y + 58} className="cvm-tag is-miss is-small">
                PREDICTION ERROR {num(Math.abs(sample.error))}
              </text>
            )}
          </g>
        )}
      </svg>
      <p className="mz-sr-only" aria-live="polite">
        {!done && sub === 2 ? `Sample ${sample.id}: predicted ${num(sample.predicted)}, actual ${num(sample.y)}. ${sample.correct ? 'Correct.' : 'Wrong.'} ${ENEMIES[sample.kind].meaning}.` : ''}
      </p>
    </div>
  )
}
