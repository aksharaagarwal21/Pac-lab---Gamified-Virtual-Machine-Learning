// The same painter's-algorithm perspective as the Grand Prix, with a following
// camera and articulated runners. Simulation time is independent of frame rate.
const TAU = Math.PI * 2
const clamp = (x, a, b) => Math.max(a, Math.min(b, x))
const ease = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt))
const STEP_DISTANCE = 300
const COLORS = ['#22d3ee', '#ff6fae', '#ff8a3d', '#a78bfa']

export function createSceneState() {
  return { time: 0, distance: 0, speed: 0, stride: 0, lean: 0, cameraX: 0,
    turn: 1, light: 0, phase: 'ready', phaseAge: 10, dustClock: 0,
    particles: [], eliminated: new Set(), lastStep: -1 }
}

export function updateScene(world, phase, dt, reducedMotion) {
  const s = world.scene
  if (phase === 'paused') return
  s.time += dt
  if (phase !== s.phase) {
    s.phase = phase
    s.phaseAge = 0
  } else s.phaseAge += dt
  const green = phase === 'green'
  const horizontal = green ? Number(world.keys.right) - Number(world.keys.left) : 0
  const forward = green ? Number(world.keys.up) - Number(world.keys.down) * 0.5 : 0
  // Acceleration eases in; red light stops movement immediately.
  s.speed = green ? ease(s.speed, forward * 0.48, 9, dt) : 0
  const previous = world.move
  world.move = clamp(world.move + s.speed * dt, 0, 1)
  s.distance += (world.move - previous) * STEP_DISTANCE
  const oldX = world.x
  world.x = clamp(world.x + horizontal * dt * 0.46, 0.12, 0.88)
  const moving = Math.abs(world.move - previous) / Math.max(dt, 0.001) + Math.abs(world.x - oldX) / Math.max(dt, 0.001)
  s.stride += moving * dt * 25
  s.lean = ease(s.lean, horizontal * 0.15, 10, dt)
  s.cameraX = ease(s.cameraX, (world.x - 0.5) * 550, 4, dt)
  s.turn = ease(s.turn, green || phase === 'advance' ? -1 : 1, 7, dt)
  s.light = ease(s.light, green || phase === 'advance' ? 1 : 0, 5, dt)
  world.team[0].x = world.x

  world.team.forEach((member, i) => {
    if (!member.alive && !s.eliminated.has(i)) {
      s.eliminated.add(i)
      member.deathTime = s.time
      member.deathDistance = s.distance
      if (!reducedMotion) for (let n = 0; n < 32; n++) {
        const angle = n * 2.39996
        s.particles.push({ kind: 'burst', member: i, x: 0, y: -0.4,
          vx: Math.cos(angle) * (0.3 + n % 4 * 0.2), vy: -0.6 - (n % 7) * 0.18,
          life: 1.35, max: 1.35, color: n % 3 ? member.color : '#fff4d2' })
      }
    }
  })
  s.dustClock += moving * dt
  if (s.dustClock > 0.07 && !reducedMotion) {
    s.dustClock = 0
    for (let i = 0; i < world.team.length; i++) if (world.team[i].alive) {
      s.particles.push({ kind: 'dust', member: i, x: Math.sin(s.stride + i) * 0.14,
        y: 0, vx: -s.lean * 2, vy: -0.12, life: 0.6, max: 0.6, color: '#e8bd7d' })
    }
  }
  for (const p of s.particles) {
    p.life -= dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.vy += (p.kind === 'burst' ? 1.4 : -0.05) * dt
  }
  s.particles = s.particles.filter(p => p.life > 0)
  // Feed a bounded footstep/pellet cue back to the component's existing sound layer.
  const step = Math.floor(s.stride / Math.PI)
  if (moving > 0.1 && step !== s.lastStep) {
    s.lastStep = step
    return true
  }
  return false
}

function quad(c, a, b, d, e, color) {
  c.fillStyle = color
  c.beginPath()
  c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(d.x, d.y); c.lineTo(e.x, e.y)
  c.closePath(); c.fill()
}
function text(c, label, x, y, size, color = '#fff') {
  c.font = `${Math.max(6, size)}px "Press Start 2P", monospace`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillStyle = '#071020'; c.fillText(label, x + 1, y + 2)
  c.fillStyle = color; c.fillText(label, x, y)
}
function ellipse(c, x, y, rx, ry, color) {
  c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill()
}

// Jointed limbs, foreshortened alternating steps, head bob and a shaded tracksuit.
function runner(c, p, member, stride, moving, lean, reducedMotion, deathAge) {
  const size = p.scale * 138
  if (deathAge > 0.32 || size < 2) return
  const gait = moving && !reducedMotion ? Math.sin(stride) : 0
  const bounce = moving && !reducedMotion ? Math.abs(Math.cos(stride)) * 0.035 : 0
  c.save(); c.translate(p.x, p.y); c.scale(size, size)
  ellipse(c, 0, 0.01, 0.26, 0.065, 'rgba(0,0,0,.35)')
  if (deathAge >= 0) {
    c.globalAlpha = Math.max(0, 1 - deathAge / 0.32)
    c.rotate(deathAge * 1.4)
  }
  c.translate(0, -bounce); c.rotate(reducedMotion ? 0 : lean)
  const limb = (x, y, angle, length, width, color, shoe = false) => {
    c.save(); c.translate(x, y); c.rotate(angle)
    c.fillStyle = color; c.fillRect(-width / 2, 0, width, length)
    c.fillStyle = '#72b9ad'; c.fillRect(-width / 2, 0, 0.022, length * 0.75)
    if (shoe) { c.fillStyle = '#e5eaf0'; c.fillRect(-width / 2 - 0.025, length - 0.045, width + 0.05, 0.09) }
    c.restore()
  }
  limb(-0.085, -0.37, gait * 0.42, 0.35 - Math.max(0, gait) * 0.06, 0.13, '#13594f', true)
  limb(0.085, -0.37, -gait * 0.42, 0.35 + Math.min(0, gait) * 0.06, 0.13, '#217e6b', true)
  limb(-0.2, -0.72, -gait * 0.55 + 0.13, 0.31, 0.11, '#217e6b')
  limb(0.2, -0.72, gait * 0.55 - 0.13, 0.31, 0.11, '#319b83')
  c.fillStyle = '#176d5d'; c.fillRect(-0.18, -0.76, 0.36, 0.4)
  c.fillStyle = '#319b83'; c.fillRect(-0.18, -0.76, 0.07, 0.38)
  c.fillStyle = member.color; c.fillRect(-0.19, -0.76, 0.38, 0.065)
  c.fillStyle = '#e7eece'; c.fillRect(-0.13, -0.64, 0.26, 0.15)
  // Paint type at screen resolution; sub-pixel font sizes vary between canvas backends.
  c.save(); c.scale(1 / size, 1 / size)
  c.font = `bold ${Math.max(6, size * 0.09)}px monospace`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillStyle = '#123f37'; c.fillText(member.number || '067', 0, -0.56 * size)
  c.restore()
  c.fillStyle = '#e3ac82'; c.fillRect(-0.12, -0.96, 0.24, 0.2)
  c.fillStyle = '#252139'; c.fillRect(-0.14, -1.02, 0.28, 0.17)
  c.fillStyle = '#3b3150'; c.fillRect(-0.14, -1.02, 0.1, 0.07)
  if (member.name === 'YOU') {
    c.fillStyle = '#f5c518'; c.beginPath(); c.moveTo(0, -0.91)
    const mouth = 0.25 + Math.abs(gait) * 0.35
    c.arc(0, -0.91, 0.092, mouth, TAU - mouth); c.closePath(); c.fill()
  }
  c.restore()
  if (member.name && size > 28 && deathAge < 0) {
    text(c, member.name, p.x, p.y - size * 1.18, clamp(size * 0.072, 6, 12), member.color)
    if (member.name === 'YOU') {
      c.fillStyle = '#f5c518'; c.beginPath(); c.moveTo(p.x - 4, p.y - size * 1.09)
      c.lineTo(p.x + 4, p.y - size * 1.09); c.lineTo(p.x, p.y - size * 1.04); c.fill()
    }
  }
}

function doll(c, x, y, size, turn) {
  c.save(); c.translate(x, y); c.scale(size, size)
  ellipse(c, 0, 0, 0.45, 0.07, 'rgba(0,0,0,.3)')
  c.fillStyle = '#f5d6b8'
  c.fillRect(-0.2, -0.42, 0.14, 0.4); c.fillRect(0.06, -0.42, 0.14, 0.4)
  c.fillStyle = '#342139'
  c.fillRect(-0.23, -0.07, 0.18, 0.09); c.fillRect(0.05, -0.07, 0.18, 0.09)
  c.fillStyle = '#ef8c24'; c.beginPath(); c.moveTo(-0.22, -1.04)
  c.lineTo(0.22, -1.04); c.lineTo(0.35, -0.41); c.lineTo(-0.35, -0.41); c.fill()
  c.fillStyle = '#ffc43d'; c.fillRect(-0.23, -1.04, 0.46, 0.18)
  c.fillStyle = '#f4c599'
  c.fillRect(-0.35, -1.02, 0.12, 0.43); c.fillRect(0.23, -1.02, 0.12, 0.43)
  c.save(); c.translate(0, -1.23)
  c.scale(0.3 + Math.abs(turn) * 0.7, 1)
  ellipse(c, -0.23, 0.03, 0.09, 0.14, '#382136')
  ellipse(c, 0.23, 0.03, 0.09, 0.14, '#382136')
  c.fillStyle = turn > 0 ? '#f4c599' : '#382136'; c.fillRect(-0.2, -0.2, 0.4, 0.39)
  c.fillStyle = '#382136'; c.fillRect(-0.22, -0.23, 0.44, 0.11)
  if (turn > 0) {
    c.fillStyle = '#231727'; c.fillRect(-0.12, -0.03, 0.055, 0.055); c.fillRect(0.065, -0.03, 0.055, 0.055)
    c.fillStyle = '#bb4054'; c.fillRect(-0.04, 0.11, 0.08, 0.025)
  } else { c.fillStyle = '#513248'; c.fillRect(-0.14, -0.08, 0.08, 0.25) }
  c.restore(); c.restore()
}

export function drawScene(c, W, H, world, phase, total, reducedMotion) {
  const s = world.scene
  const wide = W / H > 1.25
  const center = W * (wide ? 0.38 : 0.5)
  const motion = reducedMotion ? 0 : clamp(Math.abs(s.speed) * 2, 0, 1)
  const horizon = H * (0.35 + (reducedMotion ? 0 : Math.sin(s.stride * 2) * motion * 0.002))
  const focal = H * 0.95
  const horizontalScale = Math.min(1, W / H / 1.65)
  const runnerScale = Math.min(1, W / H / 1.15)
  const project = (x, z, elevation = 0) => {
    const scale = focal / Math.max(65, z)
    return { x: center + (x - s.cameraX) * scale * horizontalScale, y: horizon + (230 - elevation) * scale, scale }
  }
  const green = s.light
  const shake = phase === 'red' && !reducedMotion ? Math.max(0, 1 - s.phaseAge / 0.42) : 0
  c.save()
  c.imageSmoothingEnabled = false
  if (shake) c.translate(Math.sin(s.phaseAge * 64) * shake * 5, Math.cos(s.phaseAge * 51) * shake * 3)
  const sky = c.createLinearGradient(0, 0, 0, horizon + 30)
  sky.addColorStop(0, '#050a24'); sky.addColorStop(0.6, '#342052'); sky.addColorStop(1, '#e69685')
  c.fillStyle = sky; c.fillRect(-8, -8, W + 16, H + 16)
  for (let i = 0; i < 65; i++) {
    c.fillStyle = `rgba(213,233,255,${0.25 + (reducedMotion ? 0.3 : (1 + Math.sin(s.time + i)) * 0.2)})`
    c.fillRect(((i * 0.618034 * W - s.cameraX * 0.035) % W + W) % W, (i * 0.414214 % 1) * horizon * 0.75, 2, 2)
  }
  // Striped sunset and distant mountains echo the pretest's synthwave skyline.
  const sunX = center - s.cameraX * 0.08
  c.save(); c.beginPath(); c.arc(sunX, horizon * 0.64, H * 0.145, 0, TAU); c.clip()
  const sun = c.createLinearGradient(0, horizon * 0.2, 0, horizon)
  sun.addColorStop(0, '#ffdc70'); sun.addColorStop(1, '#f05b92'); c.fillStyle = sun
  c.fillRect(sunX - H * 0.16, 0, H * 0.32, horizon + 10)
  c.fillStyle = '#542c5b'
  for (let i = 0; i < 7; i++) c.fillRect(sunX - H * 0.16, horizon * 0.6 + i * H * 0.018, H * 0.32, 2 + i)
  c.restore()
  for (let layer = 0; layer < 2; layer++) {
    c.fillStyle = layer ? '#253050' : '#453458'; c.beginPath(); c.moveTo(-10, horizon)
    for (let i = -1; i <= 26; i++) c.lineTo(i * W / 24 - s.cameraX * (0.04 + layer * 0.06), horizon - H * (0.025 + Math.abs(Math.sin(i * 2.2 + layer)) * 0.09))
    c.lineTo(W + 10, horizon + 10); c.lineTo(-10, horizon + 10); c.fill()
  }

  c.fillStyle = '#24392e'; c.fillRect(-8, horizon, W + 16, H)
  // Real world-space strips approach the camera continuously; question changes
  // never reset the camera or teleport the squad back to the start.
  const first = Math.floor(s.distance / 65)
  for (let i = first + 90; i >= first; i--) {
    const near = i * 65 - s.distance + 80
    const far = near + 65
    const a = project(-620, near), b = project(620, near), d = project(620, far), e = project(-620, far)
    const fog = clamp(far / 4800, 0, 0.9)
    quad(c, a, b, d, e, i % 2 ? '#777455' : '#85815b')
    for (const side of [-1, 1]) {
      quad(c, project(side * 620, near), project(side * 655, near), project(side * 655, far), project(side * 620, far), i % 2 ? '#22b4da' : '#174276')
    }
    if (i % 3 === 0) for (let lane = -2; lane <= 2; lane++) {
      quad(c, project(lane * 205 - 2, near), project(lane * 205 + 2, near), project(lane * 205 + 2, far), project(lane * 205 - 2, far), '#b3b381')
    }
    c.globalAlpha = fog * 0.75; quad(c, a, b, d, e, '#ba909b'); c.globalAlpha = 1
  }

  const endZ = Math.max(1050, total * STEP_DISTANCE + 1500 - s.distance)
  // Enclosing pink playground walls, with receding panels and blue arcade trim.
  for (const side of [-1, 1]) {
    quad(c, project(side * 850, 500), project(side * 850, endZ), project(side * 850, endZ, 250), project(side * 850, 500, 250), '#6a4b68')
    const wallFirst = Math.floor(s.distance / 95)
    for (let i = wallFirst + 70; i >= wallFirst; i--) {
      const z = i * 95 - s.distance + 500
      if (z < 500 || z > endZ) continue
      quad(c, project(side * 849, z), project(side * 849, z + 80), project(side * 849, z + 80, 230), project(side * 849, z, 230), i % 2 ? '#896379' : '#795a74')
      quad(c, project(side * 848, z, 230), project(side * 848, z + 95, 230), project(side * 848, z + 95, 250), project(side * 848, z, 250), '#34799d')
    }
  }
  const end = project(0, endZ)
  const wallL = project(-1900, endZ, 550), wallR = project(1900, endZ)
  c.fillStyle = '#bf8b96'; c.fillRect(wallL.x, wallL.y, wallR.x - wallL.x, wallR.y - wallL.y)
  for (let i = -8; i <= 8; i++) {
    const p = project(i * 210, endZ, 160)
    c.fillStyle = '#704469'; c.fillRect(p.x - 28 * p.scale, p.y, 56 * p.scale, 160 * p.scale)
    ellipse(c, p.x, p.y, 28 * p.scale, 32 * p.scale, '#704469')
  }
  // Branching tree, giant turning doll and sentries at the end of the field.
  const tree = project(-160, endZ - 20)
  const treeScale = Math.max(H * 0.00026, tree.scale)
  c.strokeStyle = '#3e2d3e'; c.lineWidth = Math.max(2, 32 * treeScale)
  c.beginPath(); c.moveTo(tree.x, tree.y); c.lineTo(tree.x, tree.y - 550 * treeScale)
  for (let i = 0; i < 7; i++) {
    c.moveTo(tree.x, tree.y - (210 + i * 42) * treeScale)
    c.lineTo(tree.x + (i % 2 ? 1 : -1) * (130 + i * 19) * treeScale, tree.y - (330 + i * 36) * treeScale)
  }
  c.stroke()
  const dollP = project(0, endZ - 90)
  doll(c, dollP.x, dollP.y, Math.max(H * 0.105, 280 * dollP.scale), s.turn)
  for (const side of [-1, 1]) {
    const p = project(side * 480, endZ - 120)
    c.fillStyle = '#db2e70'; c.fillRect(p.x - p.scale * 45, p.y - p.scale * 185, p.scale * 90, p.scale * 185)
    ellipse(c, p.x, p.y - p.scale * 200, p.scale * 49, p.scale * 54, '#e13a7f')
    ellipse(c, p.x, p.y - p.scale * 200, p.scale * 33, p.scale * 38, '#0b162d')
    text(c, side < 0 ? '○' : '△', p.x, p.y - p.scale * 200, p.scale * 36)
  }
  text(c, 'FINISH', end.x, end.y + 12, clamp(end.scale * 50, 7, 16), '#ffe17c')

  const sprites = []
  // Neon fence posts, lamps and pellets all share the same depth projection.
  for (let i = first; i < first + 60; i++) {
    const z = i * 65 - s.distance + 80
    if (z < 90) continue
    if (i % 3 === 0) for (const side of [-1, 1]) sprites.push({ z, draw() {
      const p = project(side * 685, z)
      c.fillStyle = '#123452'; c.fillRect(p.x - 7 * p.scale, p.y - 110 * p.scale, 14 * p.scale, 110 * p.scale)
      c.fillStyle = green > 0.5 ? '#68f7b7' : '#ff6198'; c.fillRect(p.x - 10 * p.scale, p.y - 120 * p.scale, 20 * p.scale, 18 * p.scale)
    } })
    if (i % 2 === 0) for (let lane = -2; lane <= 2; lane++) sprites.push({ z, draw() {
      const p = project(lane * 205, z, 9)
      const r = Math.max(1, p.scale * 7)
      ellipse(c, p.x, p.y, r * 1.8, r * 0.7, 'rgba(31,25,23,.2)')
      ellipse(c, p.x, p.y - r, r, r, '#ffe9a8')
    } })
  }
  world.crowd.forEach((npc, i) => {
    const z = 780 + (i % 4) * 300 + Math.sin(i * 4.1) * 120 + s.distance * (npc.speed - 0.8) * 0.18
    sprites.push({ z, draw() {
      const p = project((npc.x - 0.5) * 1120, z)
      runner(c, { ...p, scale: p.scale * runnerScale }, { color: COLORS[i % 4], number: String(60 + i * 17).padStart(3, '0') }, s.stride * npc.speed + i, phase === 'green' && Math.abs(s.speed) > 0.025, Math.sin(s.stride + i) * 0.025, reducedMotion, -1)
    } })
  })
  const teamPoint = i => {
    const member = world.team[i]
    const behind = member.alive ? 0 : s.distance - member.deathDistance
    const p = project((member.x - 0.5) * 850, (i === 0 ? 470 : 570 + (i % 2) * 95) - behind)
    return { ...p, scale: p.scale * runnerScale }
  }
  world.team.forEach((member, i) => {
    const z = i === 0 ? 470 : 570 + (i % 2) * 95
    sprites.push({ z, draw() {
      const age = member.alive ? -1 : s.time - member.deathTime
      runner(c, teamPoint(i), member, s.stride + i * 0.75, phase === 'green' && (Math.abs(s.speed) > 0.025 || Math.abs(s.lean) > 0.015), i === 0 ? s.lean : s.lean * 0.5, reducedMotion, age)
    } })
  })
  sprites.sort((a, b) => b.z - a.z).forEach(sprite => sprite.draw())
  for (const p of s.particles) {
    const origin = teamPoint(p.member), size = origin.scale * 138
    c.globalAlpha = p.life / p.max * (p.kind === 'dust' ? 0.35 : 1)
    c.fillStyle = p.color
    const r = p.kind === 'dust' ? (1 - p.life / p.max) * size * 0.13 + 2 : size * 0.035
    c.fillRect(origin.x + p.x * size, origin.y + p.y * size, r, r)
  }
  c.globalAlpha = 1

  // A scanning cone locks onto the actual eliminated squad member.
  if (phase === 'red' && s.phaseAge < 0.8 && !reducedMotion) {
    const victim = world.team.findIndex(m => !m.alive && s.time - m.deathTime < 0.8)
    if (victim >= 0) {
      const p = teamPoint(victim)
      c.fillStyle = `rgba(255,60,104,${0.15 * (1 - s.phaseAge / 0.8)})`
      c.beginPath(); c.moveTo(dollP.x, dollP.y - H * 0.12); c.lineTo(p.x - 35, p.y); c.lineTo(p.x + 35, p.y); c.fill()
    }
  }
  if (motion > 0.5 && !reducedMotion) {
    c.strokeStyle = `rgba(255,229,176,${motion * 0.16})`; c.lineWidth = 2
    for (let i = 0; i < 12; i++) {
      const side = i % 2 ? 1 : -1
      const y = H * (0.5 + (i * 0.137 + s.distance * 0.0015) % 0.5)
      c.beginPath(); c.moveTo(center + side * W * 0.37, y); c.lineTo(center + side * W * 0.46, y + H * 0.08); c.stroke()
    }
  }
  if (phase === 'advance' && !reducedMotion) {
    c.globalAlpha = Math.max(0, 1 - s.phaseAge / 0.5)
    for (let i = 0; i < 20; i++) {
      const angle = i / 20 * TAU, radius = 30 + s.phaseAge * H * 0.65
      c.fillStyle = i % 2 ? '#f5c518' : '#6effbf'
      c.fillRect(center + Math.cos(angle) * radius, H * 0.65 + Math.sin(angle) * radius * 0.45, 5, 5)
    }
    c.globalAlpha = 1
  }
  if ((phase === 'green' || phase === 'red' || phase === 'advance') && s.phaseAge < 1.1) {
    c.save()
    c.globalAlpha = reducedMotion ? 1 : Math.min(1, (1.1 - s.phaseAge) * 3)
    const pop = reducedMotion ? 1 : 1 + Math.exp(-s.phaseAge * 9) * 0.28
    c.translate(center, H * 0.2); c.scale(pop, pop)
    text(c, phase === 'advance' ? 'CHECKPOINT!' : phase === 'green' ? 'GREEN LIGHT' : 'RED LIGHT', 0, 0, clamp(H * 0.027, 10, 28), phase === 'red' ? '#ff8aa0' : '#a2ffc7')
    c.restore()
  }
  const vignette = c.createRadialGradient(center, H * 0.55, H * 0.2, center, H * 0.5, Math.max(W, H) * 0.8)
  vignette.addColorStop(0, 'rgba(3,6,20,0)'); vignette.addColorStop(1, 'rgba(3,6,20,.65)')
  c.fillStyle = vignette; c.fillRect(0, 0, W, H)
  c.fillStyle = 'rgba(3,6,15,.07)'
  for (let y = 0; y < H; y += 4) c.fillRect(0, y, W, 1)
  c.restore()
}
