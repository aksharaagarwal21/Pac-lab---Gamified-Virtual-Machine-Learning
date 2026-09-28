// Cross Validation Maze — board geometry in real pixels (so text stays readable at any width).

const MARGIN = 26 // left corridor the player uses to change rows
const LANE = 34 // corridor above each row of rooms
const GAP = 12
const HEADER = 30
const PELLET_ROW = 22

// Every fold is a room. Training rooms hold glowing pellets; the test room is locked.
export function overviewLayout(width, plan, testFold) {
  const k = plan.folds.length
  const narrow = width < 560
  const cols = narrow ? (k === 10 ? 4 : 3) : Math.min(k, 5)
  const rows = Math.ceil(k / cols)
  const roomW = (width - 2 * MARGIN - (cols - 1) * GAP) / cols
  const maxN = Math.max(...plan.folds.map((f) => f.testIdx.length))
  const pelletCols = Math.max(2, Math.min(5, Math.floor((roomW - 16) / 24), maxN))
  const pelletRows = Math.ceil(maxN / pelletCols)
  const roomH = HEADER + pelletRows * PELLET_ROW + 12

  const rooms = plan.folds.map((fold, i) => {
    const row = Math.floor(i / cols)
    const col = i % cols
    const x = MARGIN + col * (roomW + GAP)
    const y = LANE + row * (roomH + LANE)
    const stepX = (roomW - 16) / pelletCols
    const pellets = fold.testIdx.map((id, j) => {
      const pr = Math.floor(j / pelletCols)
      const pcRaw = j % pelletCols
      const pc = pr % 2 === 0 ? pcRaw : pelletCols - 1 - pcRaw // serpentine eating order
      return { id, x: x + 8 + stepX * (pc + 0.5), y: y + HEADER + pr * PELLET_ROW + PELLET_ROW / 2 }
    })
    return { fold: i, row, x, y, w: roomW, h: roomH, door: { x: x + roomW / 2, y }, lane: y - LANE / 2, pellets, test: i === testFold }
  })

  // Route: corridor → door → every pellet → door → corridor, room after room (test room skipped).
  const points = [{ x: MARGIN / 2, y: rooms[0].lane }]
  const marks = []
  let row = 0
  for (const room of rooms) {
    if (room.test) continue
    if (room.row !== row) {
      points.push({ x: MARGIN / 2, y: points[points.length - 1].y }, { x: MARGIN / 2, y: room.lane })
      row = room.row
    }
    points.push({ x: room.door.x, y: room.lane }, { x: room.door.x, y: room.door.y + 10 })
    for (const pellet of room.pellets) {
      points.push({ x: pellet.x, y: pellet.y })
      marks.push({ id: pellet.id, point: points.length - 1 })
    }
    points.push({ x: room.door.x, y: room.door.y + 10 }, { x: room.door.x, y: room.lane })
  }
  const dist = [0]
  for (let i = 1; i < points.length; i++) dist.push(dist[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y))
  const route = { points, dist, length: dist[dist.length - 1], marks: marks.map((m) => ({ id: m.id, at: dist[m.point] })) }

  return { width, height: LANE + rows * (roomH + LANE) - LANE + 16, rooms, route }
}

// Position and heading after travelling `distance` along the route.
export function pointAlong(route, distance) {
  const { points, dist } = route
  if (distance <= 0) return { ...points[0], dir: 'right' }
  let i = 1
  while (i < points.length - 1 && dist[i] < distance) i++
  const a = points[i - 1]
  const b = points[i]
  const span = dist[i] - dist[i - 1] || 1
  const t = Math.min(1, (distance - dist[i - 1]) / span)
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, dir: heading(a, b) }
}

export function heading(from, to) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return 'right'
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left'
  return dy >= 0 ? 'down' : 'up'
}

// The unseen zone: sample nodes on a serpentine path, with walls between the rows.
export function testLayout(width, count) {
  const narrow = width < 560
  const cols = count <= 4 ? count : count <= 8 ? 4 : narrow ? 4 : 5
  const rows = Math.ceil(count / cols)
  const pad = 18
  const entry = 44
  const cellW = (width - 2 * pad - entry) / cols
  const cellH = narrow ? 96 : 104
  const top = 18
  const left = pad + entry
  const nodes = Array.from({ length: count }, (_, i) => {
    const r = Math.floor(i / cols)
    const c = r % 2 === 0 ? i % cols : cols - 1 - (i % cols)
    return { x: left + cellW * (c + 0.5), y: top + cellH * (r + 0.5) }
  })
  const walls = []
  for (let r = 0; r < rows - 1; r++) {
    const y = top + cellH * (r + 1)
    const turnRight = r % 2 === 0
    const gapHalf = Math.min(34, cellW * 0.32)
    if (turnRight) walls.push({ x1: pad, y1: y, x2: left + cellW * (cols - 0.5) - gapHalf, y2: y })
    else walls.push({ x1: left + cellW * 0.5 + gapHalf, y1: y, x2: width - pad, y2: y })
  }
  // Short pillars between neighbouring cells give the zone its maze look without blocking the path.
  const pillars = []
  for (let r = 0; r < rows; r++) {
    for (let c = 1; c < cols; c++) {
      const x = left + cellW * c
      const y0 = top + cellH * r
      pillars.push({ x, y1: y0 + 8, y2: y0 + cellH / 2 - 24 }, { x, y1: y0 + cellH / 2 + 24, y2: y0 + cellH - 8 })
    }
  }
  return {
    width,
    height: top + rows * cellH + 18,
    nodes,
    walls,
    pillars,
    entrance: { x: pad + entry / 2, y: top + cellH / 2 },
    frame: { x: pad / 2, y: 6, w: width - pad, h: top + rows * cellH + 6 },
  }
}
