// Pseudo-3D arcade racer behind the game-mode quizzes (see QuizRace.jsx).
// The road uses the classic 90s projection: every segment ahead of the camera is projected to the
// screen, curves bend the road by accumulating an x offset, and sprites are painted back to front,
// clipped wherever a nearer hill hides them. The engine knows nothing about React: it reports what
// happens through handlers.current.onTick / onGo / onGate / onPellet / onFinish.

const SEGMENT = 200
const ROAD = 2000
const LANES = 4
const RUMBLE = 3
const DRAW = 260
const CAMERA_HEIGHT = 1000
const CAMERA_DEPTH = 1 / Math.tan((50 * Math.PI) / 180)
const PLAYER_Z = CAMERA_HEIGHT * CAMERA_DEPTH
const FOG_DENSITY = 4
const PELLET_EVERY = 7
const APPROACH = 120
const FINISH_AFTER = 90
const START_SEG = 12
const CENTRIFUGAL = 0.12
const LANE_MAGNET = 0.6

// Speeds are in road segments per second.
export const SPEED = { min: 6, cruise: 22, max: 40 }
export const GATE_FIRST = 330
export const GATE_GAP = 360
// A question is shown once its gate is this many segments ahead.
export const QUESTION_LEAD = 300
export const LANE_COLORS = ['#22d3ee', '#ff6fae', '#ff8a3d', '#a78bfa']

const GHOST_COLORS = ['#ff3b3b', '#ff6fae', '#22d3ee', '#ff8a3d']
const PIXEL_FONT = '"Press Start 2P", monospace'
const BODY_FONT = '"Chakra Petch", system-ui, sans-serif'

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const mix = (a, b, t) => `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const smooth = (t) => t * t * (3 - 2 * t)

const COLOR = {
  fog: rgb('#1c1244'),
  groundA: rgb('#0a1636'),
  groundB: rgb('#070f27'),
  roadA: rgb('#182244'),
  roadB: rgb('#141c3b'),
  rumbleA: rgb('#1f6bff'),
  rumbleB: rgb('#0a1a4a'),
  lane: rgb('#9fb3d9'),
  line: rgb('#f3efdc'),
}

// Fixed pseudo-random stars and skyline blocks so every frame matches.
const STARS = Array.from({ length: 70 }, (_, i) => ({ x: (i * 0.618034) % 1, y: ((i * 0.414214) % 1) * 0.42, phase: i * 1.7 }))
const SKYLINE = Array.from({ length: 64 }, (_, i) => 0.25 + (((i * 7919) % 13) / 13) * 0.75 * (i % 5 === 0 ? 1.4 : 1))
const HILLS = Array.from({ length: 48 }, (_, i) => 0.45 + 0.55 * Math.abs(Math.sin(i * 0.9) * Math.cos(i * 0.37)))

function poly(ctx, x1, y1, x2, y2, x3, y3, x4, y4, color) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.lineTo(x3, y3)
  ctx.lineTo(x4, y4)
  ctx.closePath()
  ctx.fill()
}

function wrapText(ctx, text, maxWidth, maxLines) {
  const lines = []
  let line = ''
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  lines.push(line)
  if (lines.length <= maxLines) return lines
  const kept = lines.slice(0, maxLines)
  kept[maxLines - 1] = `${kept[maxLines - 1].replace(/\s*\S+$/, '')}…`
  return kept
}

// Pac-Man style ghost outline: dome on top, wavy skirt at the bottom.
export function ghostPath(ctx, cx, bottom, width, height, t) {
  const r = width / 2
  const top = bottom - height
  const waves = 4
  const step = width / waves
  const lift = Math.sin(t * 10) > 0 ? 0.42 : 0.22
  ctx.beginPath()
  ctx.moveTo(cx - r, bottom)
  ctx.lineTo(cx - r, top + r)
  ctx.arc(cx, top + r, r, Math.PI, 0)
  ctx.lineTo(cx + r, bottom)
  for (let k = 0; k < waves; k++) {
    const x0 = cx + r - k * step
    ctx.lineTo(x0 - step / 2, bottom - step * lift)
    ctx.lineTo(x0 - step, bottom)
  }
  ctx.closePath()
}

export function ghostEyes(ctx, cx, y, width, lookX = 0, lookY = 0.4) {
  const rx = width * 0.12
  const ry = width * 0.15
  for (const side of [-1, 1]) {
    const ex = cx + side * width * 0.2
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.ellipse(ex, y, rx, ry, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#1e3a8a'
    ctx.beginPath()
    ctx.arc(ex + lookX * rx * 0.45, y + lookY * ry * 0.5, rx * 0.55, 0, Math.PI * 2)
    ctx.fill()
  }
}

export function createRace(canvas, { questions, handlers, startLabel = 'START', reducedMotion = false }) {
  const ctx = canvas.getContext('2d')
  const count = questions.length
  const gateSeg = (k) => GATE_FIRST + k * GATE_GAP
  const finishSeg = gateSeg(count - 1) + FINISH_AFTER
  const emit = (name, ...args) => handlers.current?.[name]?.(...args)

  // Curves and hills fade out around gates, the start and the finish, so every choice is made on a straight.
  function calm(i) {
    const k = clamp(Math.round((i - GATE_FIRST) / GATE_GAP), 0, count - 1)
    const distance = Math.min(Math.abs(i - gateSeg(k)), Math.abs(i - finishSeg), Math.max(0, i - START_SEG))
    return smooth(clamp((distance - 30) / 90, 0, 1))
  }
  const curve = (i) => (1.5 * Math.sin(i * 0.0095 + 0.7) + 0.8 * Math.sin(i * 0.027)) * calm(i)
  const hill = (i) => (1100 * Math.sin(i * 0.0072) + 420 * Math.sin(i * 0.021 + 1.3)) * calm(i)

  function isPellet(i) {
    if (i % PELLET_EVERY !== 0 || i < START_SEG + 20 || i >= finishSeg) return false
    const k = Math.max(0, Math.ceil((i - GATE_FIRST) / GATE_GAP))
    return !(k < count && gateSeg(k) - i <= APPROACH)
  }

  const laneCenter = (lane) => -1 + (2 * lane + 1) / LANES
  const laneOf = (x) => clamp(Math.floor(((x + 1) / 2) * LANES), 0, LANES - 1)

  const segs = Array.from({ length: DRAW }, () => ({}))
  const keys = { up: false, down: false, left: false, right: false }
  const snapshot = { mode: 'idle', countdown: 0, nextGate: 0, toGate: 0, lane: 1, speed: 0, speedRatio: 0 }
  let s = null

  function reset(mode) {
    s = {
      mode,
      paused: false,
      position: 0,
      playerX: laneCenter(1),
      speed: 0,
      steer: 0,
      time: s?.time ?? 0,
      countdown: 3,
      nextGate: 0,
      lastSeg: Math.floor(PLAYER_Z / SEGMENT),
      eaten: new Set(),
      sky: 0,
      shake: 0,
      flash: 0,
      flashColor: '#f5c518',
      particles: [],
    }
  }
  reset('idle')

  // ---------- simulation ----------

  function hitGate(correct) {
    const W = canvas.width
    const H = canvas.height
    if (correct) {
      s.flash = reducedMotion ? 0.15 : 0.35
      s.flashColor = '#f5c518'
      s.speed = Math.min(SPEED.max, s.speed + 5)
      for (let n = 0; n < 16; n++) {
        s.particles.push({ kind: 'coin', x: W / 2, y: H * 0.8, vx: (Math.random() - 0.5) * W * 0.5, vy: -H * (0.55 + Math.random() * 0.45), life: 1.1, max: 1.1 })
      }
    } else {
      s.flash = reducedMotion ? 0.2 : 0.45
      s.flashColor = '#ff2d55'
      s.shake = reducedMotion ? 0 : 0.5
      s.speed *= 0.55
      s.particles.push({ kind: 'ghost', x: W / 2 + (Math.random() - 0.5) * W * 0.1, y: H * 0.82, vx: 0, vy: -H * 0.28, life: 1.3, max: 1.3, color: GHOST_COLORS[Math.floor(Math.random() * 4)] })
    }
  }

  function update(dt) {
    s.time += dt
    s.flash = Math.max(0, s.flash - dt * 1.2)
    s.shake = Math.max(0, s.shake - dt)
    s.particles = s.particles.filter((p) => {
      p.life -= dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      if (p.kind === 'coin') p.vy += canvas.height * 1.6 * dt
      return p.life > 0
    })

    if (s.mode === 'idle') return
    if (s.mode === 'countdown') {
      s.countdown -= dt
      if (s.countdown <= 0) {
        s.mode = 'racing'
        emit('onGo')
      }
      return
    }

    const offroad = Math.abs(s.playerX) > 1
    let target = keys.up ? SPEED.max : keys.down ? SPEED.min : SPEED.cruise
    if (s.mode === 'finished') target = 0
    if (offroad) target = Math.min(target, SPEED.cruise * 0.5)
    const rate = keys.down || offroad || s.mode === 'finished' ? 2 : 1.1
    s.speed += (target - s.speed) * Math.min(1, dt * rate)
    s.position += s.speed * SEGMENT * dt

    const ratio = s.speed / SPEED.max
    const playerSeg = Math.floor((s.position + PLAYER_Z) / SEGMENT)
    const input = s.mode === 'finished' ? 0 : (keys.right ? 1 : 0) - (keys.left ? 1 : 0)
    s.playerX += input * dt * (0.9 + 1.2 * ratio)
    s.playerX -= dt * 2 * ratio * ratio * curve(playerSeg) * CENTRIFUGAL
    // With no steering input the car eases into the nearest lane, so students can read while driving.
    if (input === 0) {
      const settle = laneCenter(laneOf(s.playerX)) - s.playerX
      s.playerX += clamp(settle, -LANE_MAGNET * dt, LANE_MAGNET * dt)
    }
    s.playerX = clamp(s.playerX, -1.35, 1.35)
    s.steer += (input - s.steer) * Math.min(1, dt * 8)
    s.sky += curve(playerSeg) * ratio * dt
    if (offroad && !reducedMotion) s.shake = Math.max(s.shake, 0.08 * ratio)

    for (let i = s.lastSeg + 1; i <= playerSeg; i++) {
      if (!isPellet(i)) continue
      const lane = laneOf(s.playerX)
      if (Math.abs(s.playerX - laneCenter(lane)) < 0.2 && !s.eaten.has(i * LANES + lane)) {
        s.eaten.add(i * LANES + lane)
        emit('onPellet')
      }
    }
    s.lastSeg = playerSeg

    const front = (s.position + PLAYER_Z) / SEGMENT
    while (s.mode === 'racing' && s.nextGate < count && front >= gateSeg(s.nextGate)) {
      const lane = laneOf(s.playerX)
      const correct = lane === questions[s.nextGate].answer
      hitGate(correct)
      emit('onGate', s.nextGate, lane, correct, ratio)
      s.nextGate += 1
    }
    if (s.mode === 'racing' && front >= finishSeg) {
      s.mode = 'finished'
      s.flash = 0.3
      s.flashColor = '#ffffff'
      emit('onFinish')
    }
  }

  // ---------- drawing ----------

  function drawSky(W, H) {
    const horizon = H / 2
    const sky = ctx.createLinearGradient(0, 0, 0, horizon)
    sky.addColorStop(0, '#02040c')
    sky.addColorStop(0.55, '#0a1030')
    sky.addColorStop(1, '#2b0f4d')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, W, horizon + 1)

    for (const star of STARS) {
      ctx.globalAlpha = 0.35 + 0.35 * Math.sin(s.time * 2 + star.phase)
      ctx.fillStyle = '#eef2f7'
      const size = Math.max(1, H / 360)
      ctx.fillRect(star.x * W, star.y * H, size, size)
    }
    ctx.globalAlpha = 1

    // Striped synthwave sun.
    const radius = H * 0.19
    const sunX = W * 0.5
    const sunY = horizon - radius * 0.35
    const sun = ctx.createLinearGradient(0, sunY - radius, 0, sunY + radius)
    sun.addColorStop(0, '#f5c518')
    sun.addColorStop(0.6, '#ff8a3d')
    sun.addColorStop(1, '#ff5c8a')
    ctx.fillStyle = sun
    ctx.beginPath()
    ctx.arc(sunX, sunY, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#2b0f4d'
    for (let k = 0; k < 6; k++) {
      const y = sunY + radius * (0.05 + k * 0.17)
      ctx.fillRect(sunX - radius, y, radius * 2, radius * (0.02 + k * 0.022))
    }

    // Far hills and a blocky maze skyline, both scrolling with the road's curves.
    const farOffset = s.sky * W * 0.02
    const hillWidth = W / 16
    const hillStart = Math.floor(farOffset / hillWidth)
    ctx.fillStyle = '#170d36'
    ctx.beginPath()
    ctx.moveTo(0, horizon)
    for (let j = -1; j <= 17; j++) {
      const h = HILLS[(((hillStart + j) % HILLS.length) + HILLS.length) % HILLS.length] * H * 0.12
      ctx.lineTo(j * hillWidth - (((farOffset % hillWidth) + hillWidth) % hillWidth) + hillWidth / 2, horizon - h)
    }
    ctx.lineTo(W, horizon)
    ctx.closePath()
    ctx.fill()

    const nearOffset = s.sky * W * 0.05
    const blockWidth = W / 40
    const blockStart = Math.floor(nearOffset / blockWidth)
    const shift = ((nearOffset % blockWidth) + blockWidth) % blockWidth
    for (let j = -1; j <= 41; j++) {
      const h = SKYLINE[(((blockStart + j) % SKYLINE.length) + SKYLINE.length) % SKYLINE.length] * H * 0.07
      const x = j * blockWidth - shift
      ctx.fillStyle = '#081232'
      ctx.fillRect(x, horizon - h, blockWidth + 1, h)
      ctx.fillStyle = 'rgba(34, 211, 238, 0.55)'
      ctx.fillRect(x, horizon - h, blockWidth + 1, Math.max(1, H / 400))
    }

    const ground = ctx.createLinearGradient(0, horizon, 0, H)
    ground.addColorStop(0, mix(COLOR.fog, COLOR.groundB, 0))
    ground.addColorStop(0.3, mix(COLOR.fog, COLOR.groundB, 1))
    ctx.fillStyle = ground
    ctx.fillRect(0, horizon, W, H - horizon)
  }

  function drawSegment(W, seg, fog, maxy, gate) {
    const { i, X1, Y1, W1, X2, Y2, W2 } = seg
    const light = Math.floor(i / RUMBLE) % 2 === 0
    const partial = Y1 > maxy + 0.5
    if (partial) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, W, maxy)
      ctx.clip()
    }

    ctx.fillStyle = mix(light ? COLOR.groundA : COLOR.groundB, COLOR.fog, fog)
    ctx.fillRect(0, Y2, W, Math.min(Y1, maxy) - Y2 + 1)

    const r1 = W1 / 8
    const r2 = W2 / 8
    const rumble = mix(light ? COLOR.rumbleA : COLOR.rumbleB, COLOR.fog, fog)
    poly(ctx, X1 - W1 - r1, Y1, X1 - W1, Y1, X2 - W2, Y2, X2 - W2 - r2, Y2, rumble)
    poly(ctx, X1 + W1 + r1, Y1, X1 + W1, Y1, X2 + W2, Y2, X2 + W2 + r2, Y2, rumble)

    const markLine = i === gate || i === finishSeg || i === START_SEG
    const road = markLine ? mix(COLOR.line, COLOR.fog, fog) : mix(light ? COLOR.roadA : COLOR.roadB, COLOR.fog, fog)
    poly(ctx, X1 - W1, Y1, X1 + W1, Y1, X2 + W2, Y2, X2 - W2, Y2, road)

    const lane1 = (2 * W1) / LANES
    const lane2 = (2 * W2) / LANES

    // Colour the four answer lanes on the run-up to a gate.
    if (gate >= 0 && i < gate && i >= gate - APPROACH && light) {
      ctx.globalAlpha = 0.24 * (1 - fog)
      for (let l = 0; l < LANES; l++) {
        const a1 = X1 - W1 + lane1 * l
        const a2 = X2 - W2 + lane2 * l
        poly(ctx, a1, Y1, a1 + lane1, Y1, a2 + lane2, Y2, a2, Y2, LANE_COLORS[l])
      }
      ctx.globalAlpha = 1
    }

    if (light && !markLine) {
      const m1 = W1 / 32
      const m2 = W2 / 32
      const lane = mix(COLOR.lane, COLOR.fog, fog)
      for (let l = 1; l < LANES; l++) {
        const a1 = X1 - W1 + lane1 * l
        const a2 = X2 - W2 + lane2 * l
        poly(ctx, a1 - m1 / 2, Y1, a1 + m1 / 2, Y1, a2 + m2 / 2, Y2, a2 - m2 / 2, Y2, lane)
      }
    }
    if (partial) ctx.restore()
  }

  // Runs draw() clipped to the area above `clip`, skipping sprites that are fully hidden.
  function clipped(W, clip, top, bottom, draw) {
    if (top >= clip) return
    if (bottom <= clip) {
      draw()
      return
    }
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, W, clip)
    ctx.clip()
    draw()
    ctx.restore()
  }

  function drawPosts(W, seg) {
    const width = seg.W1 * 0.1
    const height = seg.W1 * 0.32
    if (width < 1) return
    for (const side of [-1, 1]) {
      const x = seg.X1 + side * seg.W1 * 1.22 - width / 2
      clipped(W, seg.clip, seg.Y1 - height, seg.Y1, () => {
        ctx.fillStyle = '#0a1a4a'
        ctx.fillRect(x, seg.Y1 - height, width, height)
        ctx.fillStyle = '#1f6bff'
        ctx.fillRect(x, seg.Y1 - height, width, height * 0.16)
        ctx.fillRect(x, seg.Y1 - height, Math.max(1, width * 0.12), height)
      })
    }
  }

  function drawDecorGhost(W, seg) {
    const index = Math.floor(seg.i / 45)
    const side = index % 2 === 0 ? -1 : 1
    const size = seg.W1 * 0.34
    if (size < 2) return
    const cx = seg.X1 + side * seg.W1 * (1.6 + 0.2 * Math.sin(index))
    const bottom = seg.Y1 - seg.W1 * (0.25 + 0.06 * Math.sin(s.time * 3 + index))
    clipped(W, seg.clip, bottom - size * 1.1, bottom, () => {
      ctx.fillStyle = GHOST_COLORS[index % GHOST_COLORS.length]
      ghostPath(ctx, cx, bottom, size, size * 1.05, s.time + index)
      ctx.fill()
      ghostEyes(ctx, cx, bottom - size * 0.62, size, -side, 0.2)
    })
  }

  function drawPellets(W, seg) {
    const radius = seg.W1 * 0.024
    if (radius < 0.6) return
    for (let lane = 0; lane < LANES; lane++) {
      if (s.eaten.has(seg.i * LANES + lane)) continue
      const cx = seg.X1 + seg.W1 * laneCenter(lane)
      const cy = seg.Y1 - radius * 2.4
      clipped(W, seg.clip, cy - radius, cy + radius, () => {
        ctx.fillStyle = '#ffd6a5'
        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, Math.PI * 2)
        ctx.fill()
      })
    }
  }

  function drawGate(W, seg, question) {
    const width = seg.W1 * 0.46
    if (width < 3) return
    const height = width * 1.3
    const bottom = seg.Y1
    clipped(W, seg.clip, bottom - height, bottom, () => {
      for (let lane = 0; lane < LANES; lane++) {
        const cx = seg.X1 + seg.W1 * laneCenter(lane)
        ctx.fillStyle = LANE_COLORS[lane]
        ghostPath(ctx, cx, bottom, width, height, s.time + lane)
        ctx.fill()
        ghostEyes(ctx, cx, bottom - height + width * 0.36, width * 0.8, 0, 0.6)

        const boxX = cx - width * 0.4
        const boxY = bottom - height + width * 0.6
        const boxW = width * 0.8
        const boxH = height - width * 0.6 - width * 0.2
        ctx.fillStyle = '#050b1a'
        ctx.fillRect(boxX, boxY, boxW, boxH)

        const letterSize = Math.max(6, width * 0.16)
        ctx.fillStyle = LANE_COLORS[lane]
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.font = `${letterSize}px ${PIXEL_FONT}`
        ctx.fillText('ABCD'[lane], cx, boxY + width * 0.05)

        if (width > 120) {
          const fontSize = clamp(width * 0.068, 10, 26)
          ctx.font = `600 ${fontSize}px ${BODY_FONT}`
          ctx.fillStyle = '#eef2f7'
          const lineHeight = fontSize * 1.15
          const textTop = boxY + width * 0.08 + letterSize
          const maxLines = Math.max(1, Math.floor((boxY + boxH - textTop - width * 0.03) / lineHeight))
          wrapText(ctx, question.options[lane], boxW * 0.9, maxLines).forEach((line, n) => {
            ctx.fillText(line, cx, textTop + n * lineHeight)
          })
        }
      }
    })
  }

  function drawArch(W, seg, label) {
    const postW = seg.W1 * 0.06
    const height = seg.W1 * 0.95
    if (postW < 1) return
    const left = seg.X1 - seg.W1 * 1.15
    const right = seg.X1 + seg.W1 * 1.15
    const bannerH = seg.W1 * 0.18
    const top = seg.Y1 - height
    clipped(W, seg.clip, top, seg.Y1, () => {
      ctx.fillStyle = '#1f6bff'
      ctx.fillRect(left - postW / 2, top, postW, height)
      ctx.fillRect(right - postW / 2, top, postW, height)
      const cells = 24
      const cell = (right - left) / cells
      for (let c = 0; c < cells; c++) {
        for (let row = 0; row < 2; row++) {
          ctx.fillStyle = (c + row) % 2 ? '#eef2f7' : '#03060f'
          ctx.fillRect(left + c * cell, top + row * (bannerH / 2), cell + 0.5, bannerH / 2 + 0.5)
        }
      }
      const fontSize = bannerH * 0.42
      if (fontSize >= 5) {
        ctx.font = `${fontSize}px ${PIXEL_FONT}`
        const textW = ctx.measureText(label).width + fontSize * 1.6
        ctx.fillStyle = '#03060f'
        ctx.fillRect(seg.X1 - textW / 2, top, textW, bannerH)
        ctx.fillStyle = '#f5c518'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(label, seg.X1, top + bannerH / 2)
      }
    })
  }

  function drawCar(W, H) {
    const cw = clamp(W * 0.16, 110, 300)
    const ch = cw * 0.46
    const ratio = s.speed / SPEED.max
    const offroad = Math.abs(s.playerX) > 1 && s.speed > 1
    const bounce = Math.sin(s.time * 38) * ratio * cw * 0.006 + (offroad && !reducedMotion ? (Math.random() - 0.5) * cw * 0.03 : 0)
    ctx.save()
    ctx.translate(W / 2 + s.steer * cw * 0.05, H - cw * 0.07 + bounce)
    ctx.rotate(s.steer * 0.03)

    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
    ctx.beginPath()
    ctx.ellipse(0, 0, cw * 0.56, ch * 0.13, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#0b0f1a'
    ctx.fillRect(-cw * 0.48, -ch * 0.36, cw * 0.18, ch * 0.36)
    ctx.fillRect(cw * 0.3, -ch * 0.36, cw * 0.18, ch * 0.36)

    if (keys.up && s.mode === 'racing') {
      for (const side of [-1, 1]) {
        const flame = ch * (0.14 + Math.random() * 0.12)
        ctx.fillStyle = '#ff8a3d'
        ctx.beginPath()
        ctx.ellipse(side * cw * 0.2, -ch * 0.2, cw * 0.035, flame, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#f5c518'
        ctx.beginPath()
        ctx.ellipse(side * cw * 0.2, -ch * 0.2, cw * 0.018, flame * 0.55, 0, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Cabin and rear window.
    ctx.fillStyle = '#d9a50b'
    poly(ctx, -cw * 0.37, -ch * 0.7, -cw * 0.25, -ch * 1.02, cw * 0.25, -ch * 1.02, cw * 0.37, -ch * 0.7, '#d9a50b')
    const glass = ctx.createLinearGradient(0, -ch, 0, -ch * 0.72)
    glass.addColorStop(0, '#0d1830')
    glass.addColorStop(1, '#1f3f8a')
    ctx.fillStyle = glass
    ctx.beginPath()
    ctx.moveTo(-cw * 0.31, -ch * 0.74)
    ctx.lineTo(-cw * 0.22, -ch * 0.97)
    ctx.lineTo(cw * 0.22, -ch * 0.97)
    ctx.lineTo(cw * 0.31, -ch * 0.74)
    ctx.closePath()
    ctx.fill()

    // Body.
    const body = ctx.createLinearGradient(0, -ch * 0.74, 0, -ch * 0.2)
    body.addColorStop(0, '#ffe066')
    body.addColorStop(1, '#d99a06')
    ctx.fillStyle = body
    ctx.beginPath()
    ctx.roundRect(-cw / 2, -ch * 0.74, cw, ch * 0.52, ch * 0.1)
    ctx.fill()

    ctx.fillStyle = '#b8860b'
    ctx.fillRect(-cw * 0.5, -ch * 0.82, cw, ch * 0.07)

    // Louvred tail-light strip; brighter while braking.
    const braking = keys.down || s.mode === 'finished'
    ctx.fillStyle = braking ? '#ff6b81' : '#e11d48'
    ctx.fillRect(-cw * 0.45, -ch * 0.64, cw * 0.9, ch * 0.13)
    ctx.fillStyle = 'rgba(3, 6, 15, 0.55)'
    for (let k = 1; k < 3; k++) ctx.fillRect(-cw * 0.45, -ch * 0.64 + k * ch * 0.043, cw * 0.9, Math.max(1, ch * 0.012))
    if (braking) {
      ctx.fillStyle = 'rgba(255, 45, 85, 0.25)'
      ctx.fillRect(-cw * 0.5, -ch * 0.7, cw, ch * 0.25)
    }

    ctx.fillStyle = '#1b2233'
    ctx.fillRect(-cw * 0.47, -ch * 0.32, cw * 0.94, ch * 0.1)

    // Pac-Man badge.
    const badge = ch * 0.085
    ctx.fillStyle = '#03060f'
    ctx.beginPath()
    ctx.arc(0, -ch * 0.43, badge * 1.35, 0, Math.PI * 2)
    ctx.fill()
    const mouth = 0.25 + 0.2 * Math.abs(Math.sin(s.time * 9))
    ctx.fillStyle = '#f5c518'
    ctx.beginPath()
    ctx.moveTo(0, -ch * 0.43)
    ctx.arc(0, -ch * 0.43, badge, mouth, Math.PI * 2 - mouth)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  function drawEffects(W, H) {
    const ratio = s.speed / SPEED.max
    if (ratio > 0.8 && !reducedMotion) {
      ctx.strokeStyle = `rgba(238, 242, 247, ${(ratio - 0.8) * 1.6})`
      ctx.lineWidth = Math.max(1, W / 700)
      for (let k = 0; k < 12; k++) {
        const side = k % 2 === 0 ? -1 : 1
        const y = H * (0.55 + ((k * 0.13 + s.time * 1.7) % 0.45))
        const x = W / 2 + side * W * (0.36 + ((k * 0.07) % 0.12))
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x + side * W * 0.1, y + H * 0.08)
        ctx.stroke()
      }
    }

    for (const p of s.particles) {
      ctx.globalAlpha = Math.min(1, (p.life / p.max) * 1.5)
      if (p.kind === 'coin') {
        const r = Math.max(4, W / 110)
        ctx.fillStyle = '#f5c518'
        ctx.beginPath()
        ctx.ellipse(p.x, p.y, r * Math.abs(Math.sin(p.life * 12)) + 1, r, 0, 0, Math.PI * 2)
        ctx.fill()
      } else {
        const size = W * 0.06
        ctx.fillStyle = p.color
        ghostPath(ctx, p.x, p.y, size, size * 1.05, s.time)
        ctx.fill()
        ghostEyes(ctx, p.x, p.y - size * 0.62, size, 0, -0.4)
      }
    }
    ctx.globalAlpha = 1

    if (s.flash > 0) {
      ctx.globalAlpha = Math.min(0.4, s.flash)
      ctx.fillStyle = s.flashColor
      ctx.fillRect(0, 0, W, H)
      ctx.globalAlpha = 1
    }
  }

  function render() {
    const W = canvas.width
    const H = canvas.height
    ctx.save()
    if (s.shake > 0) ctx.translate((Math.random() - 0.5) * s.shake * W * 0.02, (Math.random() - 0.5) * s.shake * H * 0.02)
    drawSky(W, H)

    const baseIndex = Math.floor(s.position / SEGMENT)
    const basePercent = s.position / SEGMENT - baseIndex
    const front = (s.position + PLAYER_Z) / SEGMENT
    const frontIndex = Math.floor(front)
    const playerY = hill(frontIndex) + (hill(frontIndex + 1) - hill(frontIndex)) * (front - frontIndex)
    const cameraY = playerY + CAMERA_HEIGHT
    const cameraX = s.playerX * ROAD
    const gate = s.nextGate < count && s.mode !== 'idle' ? gateSeg(s.nextGate) : -1
    const half = W / 2

    let maxy = H
    let x = 0
    let dx = -curve(baseIndex) * basePercent
    for (let n = 0; n < DRAW; n++) {
      const i = baseIndex + n
      const seg = segs[n]
      const z1 = i * SEGMENT - s.position
      const z2 = z1 + SEGMENT
      const s1 = CAMERA_DEPTH / z1
      const s2 = CAMERA_DEPTH / z2
      seg.i = i
      seg.z = z1
      seg.X1 = half + s1 * (x - cameraX) * half
      seg.Y1 = H / 2 - s1 * (hill(i) - cameraY) * (H / 2)
      seg.W1 = s1 * ROAD * half
      seg.X2 = half + s2 * (x + dx - cameraX) * half
      seg.Y2 = H / 2 - s2 * (hill(i + 1) - cameraY) * (H / 2)
      seg.W2 = s2 * ROAD * half
      seg.clip = maxy
      seg.fog = 1 - Math.exp(-((n / DRAW) ** 2) * FOG_DENSITY)
      x += dx
      dx += curve(i)
      if (z1 <= CAMERA_DEPTH || seg.Y2 >= seg.Y1 || seg.Y2 >= maxy) continue
      drawSegment(W, seg, seg.fog, maxy, gate)
      maxy = seg.Y2
    }

    for (let n = DRAW - 1; n > 0; n--) {
      const seg = segs[n]
      if (seg.z < PLAYER_Z * 0.7) continue
      ctx.globalAlpha = 1 - seg.fog * 0.8
      const i = seg.i
      if (i % 10 === 0) drawPosts(W, seg)
      if (i % 45 === 20) drawDecorGhost(W, seg)
      if (isPellet(i)) drawPellets(W, seg)
      if (i === START_SEG) drawArch(W, seg, startLabel)
      if (i === finishSeg) drawArch(W, seg, 'FINISH')
      if (i === gate) {
        ctx.globalAlpha = Math.max(0.45, 1 - seg.fog * 0.6)
        drawGate(W, seg, questions[s.nextGate])
      }
    }
    ctx.globalAlpha = 1

    drawCar(W, H)
    drawEffects(W, H)
    ctx.restore()
  }

  // ---------- loop and controls ----------

  function report() {
    snapshot.mode = s.mode
    snapshot.countdown = s.countdown
    snapshot.nextGate = s.nextGate
    snapshot.toGate = s.nextGate < count ? gateSeg(s.nextGate) - (s.position + PLAYER_Z) / SEGMENT : Infinity
    snapshot.lane = laneOf(s.playerX)
    snapshot.speed = s.speed
    snapshot.speedRatio = s.speed / SPEED.max
    emit('onTick', snapshot)
  }

  let raf = 0
  let last = performance.now()
  let dirty = true
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    if (!s.paused) {
      update(dt)
      render()
      report()
    } else if (dirty) {
      render()
    }
    dirty = false
    raf = requestAnimationFrame(frame)
  }

  function resize() {
    const rect = canvas.getBoundingClientRect()
    const density = Math.min(window.devicePixelRatio || 1, 1.5)
    const scale = Math.min(density, 1600 / Math.max(1, rect.width))
    canvas.width = Math.max(1, Math.round(rect.width * scale))
    canvas.height = Math.max(1, Math.round(rect.height * scale))
    dirty = true
  }

  const releaseKeys = () => {
    keys.up = keys.down = keys.left = keys.right = false
  }

  resize()
  raf = requestAnimationFrame(frame)

  return {
    start() {
      releaseKeys()
      reset('countdown')
    },
    stop() {
      releaseKeys()
      reset('idle')
    },
    pause() {
      releaseKeys()
      s.paused = true
      dirty = true
    },
    resume() {
      s.paused = false
      last = performance.now()
    },
    get mode() {
      return s.mode
    },
    setKey(name, down) {
      keys[name] = down
    },
    releaseKeys,
    resize,
    destroy() {
      cancelAnimationFrame(raf)
    },
  }
}
