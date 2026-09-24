import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { getAssistant, say, setVoiceEnabled, sfx, subscribeAssistant } from '../sound.js'

const GRAVITY = 2600 // px/s²
const WALL_BOUNCE = 0.55
const FLOOR_BOUNCE = 0.42
const BOUNCE_MIN = 260 // floor hits slower than this stop bouncing (px/s)
const HARD_LANDING = 1100 // impact speed that leaves Byte dizzy (px/s)
const MAX_THROW = 2800 // px/s
const EDGE = 10
const DRAG_THRESHOLD = 6 // px of movement before a press becomes a drag
const POSITION_KEY = 'pac-lab-byte-x'

const SPIN_TO_TALK = 900 // degrees of spin in one flight before Byte complains
const SPIN_TO_DIZZY = 1440 // degrees of spin in one flight that make Byte dizzy
const TWIRL_TO_DIZZY = Math.PI * 4 // two full circles while being carried

// Byte's reactions. Each entry: the lines, and the minimum gap (ms) since Byte last spoke.
const LINES = {
  grab: {
    gap: 1800,
    lines: [
      'Whoa! Where are we going?',
      'Hey! Put me down!',
      'Is this a hug or a kidnapping?',
      'Careful, I bruise like a banana!',
      'My feet are not touching anything!',
    ],
  },
  throwUp: {
    gap: 0,
    lines: ['I believe I can fly!', 'To infinity and beyond!', 'Houston, we have a problem!', 'Gradient ascent!', 'Wheeeeee!'],
  },
  throwSide: {
    gap: 0,
    lines: ['Yeet!', 'I am a paper airplane!', 'Incoming monster!', 'Watch out below!', 'Weeee, sideways!'],
  },
  ceiling: {
    gap: 0,
    lines: ['Ouch! Who put a ceiling there?', 'My horns! My beautiful horns!', 'Bonk! Head first!', 'I am overfitting to the ceiling!'],
  },
  wall: {
    gap: 1800,
    lines: ['Not the wall!', 'Bonk! Excuse me, wall.', 'That wall came out of nowhere!'],
  },
  spin: {
    gap: 600,
    lines: [
      'Stop spinning me, I just ate pellets!',
      'The room is doing the tornado dance!',
      'Am I a washing machine now?',
      'My weights are all shuffled!',
      'My eye is going round and round!',
    ],
  },
  softLanding: {
    gap: 250,
    lines: ['Nailed it!', 'Ten out of ten landing!', 'Smooth like butter.', 'Gradient descent complete!'],
  },
  wake: {
    gap: 0,
    lines: [
      "I'm okay! I'm okay!",
      'Ouch, my horns!',
      'Again! Again!',
      'Who turned the floor upside down?',
      'I saw pixel stars!',
      'Rebooting brain... done!',
    ],
  },
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const pick = (lines) => lines[Math.floor(Math.random() * lines.length)]
const normaliseAngle = (angle) => ((((angle % 360) + 540) % 360) - 180)
// Byte's resting "floor" sits above page footers.
const bottomGap = () => (window.innerWidth < 640 ? 92 : 76)
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function MonsterArt() {
  return (
    <svg className="va-monster" viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="va-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a78bfa" />
          <stop offset="1" stopColor="#6d28d9" />
        </linearGradient>
      </defs>
      <path d="M17 15 L12 2 L26 11 Z" fill="#f5c518" />
      <path d="M47 15 L52 2 L38 11 Z" fill="#f5c518" />
      <rect x="15" y="52" width="11" height="9" rx="4" fill="#4c1d95" />
      <rect x="38" y="52" width="11" height="9" rx="4" fill="#4c1d95" />
      <path d="M9 36 C9 19 19 9 32 9 C45 9 55 19 55 36 V48 C55 54 51 57 45 57 H19 C13 57 9 54 9 48 Z" fill="url(#va-body)" />
      <g className="va-eye">
        <circle cx="32" cy="28" r="10" fill="#fff" />
        <circle cx="33.5" cy="29" r="5.5" fill="#22d3ee" />
        <circle cx="34" cy="29.5" r="2.4" fill="#0b1026" />
        <circle cx="31.5" cy="26.5" r="1.4" fill="#fff" />
      </g>
      <g className="va-spiral">
        <circle cx="32" cy="28" r="10" fill="#fff" />
        <path
          d="M32 28 m-1 0 a1 1 0 1 1 2 0 a3 3 0 1 1 -6 0 a5 5 0 1 1 10 0 a7 7 0 1 1 -14 0"
          fill="none"
          stroke="#6d28d9"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </g>
      <path className="va-eyelid" d="M22 29 Q32 36 42 29" fill="none" stroke="#1e0b3d" strokeWidth="3" strokeLinecap="round" />
      <g className="va-mouth">
        <path d="M21 42 Q32 52 43 42 Z" fill="#1e0b3d" />
        <path d="M25 42.5 L27.5 46.5 L30 42.5 Z M34 42.5 L36.5 46.5 L39 42.5 Z" fill="#fff" />
      </g>
    </svg>
  )
}

// Byte, the monster voice assistant. Click to switch the voice on or off; drag to carry or throw.
export function VoiceAssistant() {
  const { enabled, speaking, text } = useSyncExternalStore(subscribeAssistant, getAssistant, getAssistant)
  const [mode, setMode] = useState('rest') // rest | dragging | flying | dizzy | waking
  const [placement, setPlacement] = useState({ left: false, below: false })
  const wrapperRef = useRef(null)
  const spinRef = useRef(null)
  const bodyRef = useRef(null)

  // Simulation state lives in a ref so the animation loop never re-renders React.
  const sim = useRef({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    angle: 0,
    size: 64,
    maxX: 0,
    floor: 0,
    mode: 'rest',
    samples: [],
    timers: [],
    raf: 0,
    lastTime: 0,
    lastLine: -Infinity,
    pressed: false,
    dragged: false,
    hardLanding: false,
    left: false,
    below: false,
  })

  const changeMode = (next) => {
    sim.current.mode = next
    setMode(next)
  }

  const render = () => {
    const s = sim.current
    wrapperRef.current.style.transform = `translate3d(${s.x}px, ${s.y}px, 0)`
    spinRef.current.style.transform = `rotate(${s.angle}deg)`
    // Keep the speech bubble on screen: open toward the middle, and below Byte near the top.
    const left = s.x + s.size / 2 < window.innerWidth / 2
    const below = s.y < 150
    if (left !== s.left || below !== s.below) {
      s.left = left
      s.below = below
      setPlacement({ left, below })
    }
  }

  const measure = () => {
    const s = sim.current
    s.size = wrapperRef.current.offsetWidth
    s.maxX = window.innerWidth - s.size - EDGE
    s.floor = window.innerHeight - bottomGap() - s.size
  }

  const later = (ms, fn) => sim.current.timers.push(setTimeout(fn, ms))

  const clearLater = () => {
    sim.current.timers.forEach(clearTimeout)
    sim.current.timers = []
  }

  // Byte reacts to being thrown around, without repeating itself or talking over every bump.
  const chatter = (reaction) => {
    const s = sim.current
    const { gap, lines } = LINES[reaction]
    const now = performance.now()
    if (now - s.lastLine < gap) return
    const line = pick(lines.filter((candidate) => candidate !== s.lastSaid))
    s.lastLine = now
    s.lastSaid = line
    say(line)
  }

  const squash = (strength) => {
    bodyRef.current?.animate?.(
      [
        { transform: 'scale(1, 1)' },
        { transform: `scale(${1 + 0.35 * strength}, ${1 - 0.3 * strength})`, offset: 0.25 },
        { transform: `scale(${1 - 0.1 * strength}, ${1 + 0.12 * strength})`, offset: 0.6 },
        { transform: 'scale(1, 1)' },
      ],
      { duration: 380, easing: 'ease-out' },
    )
  }

  const savePosition = () => {
    try {
      localStorage.setItem(POSITION_KEY, String(sim.current.x / sim.current.maxX))
    } catch {
      // Storage unavailable: Byte just starts in its default corner next time.
    }
  }

  const settleUpright = () => {
    const s = sim.current
    const spin = spinRef.current
    s.angle = normaliseAngle(s.angle)
    spin.style.transition = 'none'
    render()
    void spin.offsetWidth
    spin.style.transition = 'transform 0.3s ease-out'
    s.angle = 0
    render()
    later(320, () => {
      spin.style.transition = ''
    })
  }

  const land = () => {
    const s = sim.current
    s.vx = 0
    s.vy = 0
    settleUpright()
    savePosition()
    if (!s.hardLanding) {
      changeMode('rest')
      if (s.thrown && Math.random() < 0.75) chatter('softLanding')
      s.thrown = false
      return
    }
    s.thrown = false
    s.hardLanding = false
    changeMode('dizzy')
    sfx.dizzy()
    later(1700, () => {
      changeMode('waking')
      sfx.wake()
      chatter('wake')
      later(650, () => changeMode('rest'))
    })
  }

  const step = (now) => {
    const s = sim.current
    const dt = Math.min(0.032, (now - s.lastTime) / 1000)
    s.lastTime = now

    if (s.mode === 'dragging') {
      // Tilt toward the direction Byte is being carried.
      const first = s.samples[0]
      const last = s.samples[s.samples.length - 1]
      const carrySpeed = first && last && last.t > first.t ? (last.x - first.x) / ((last.t - first.t) / 1000) : 0
      s.angle += (clamp(carrySpeed * 0.012, -28, 28) - s.angle) * Math.min(1, dt * 12)
      render()
    } else if (s.mode === 'flying') {
      s.vy += GRAVITY * dt
      s.x += s.vx * dt
      s.y += s.vy * dt
      const turn = s.vx * dt * 0.35
      s.angle += turn
      s.spun += Math.abs(turn)
      if (s.spun > SPIN_TO_TALK && !s.spinComment) {
        s.spinComment = true
        chatter('spin')
      }
      if (s.spun > SPIN_TO_DIZZY) s.hardLanding = true

      if (s.x < EDGE || s.x > s.maxX) {
        s.x = clamp(s.x, EDGE, s.maxX)
        s.vx = -s.vx * WALL_BOUNCE
        if (Math.abs(s.vx) > 300) sfx.boing()
        if (Math.abs(s.vx) > 500) chatter('wall')
      }
      if (s.y < EDGE && s.vy < 0) {
        s.y = EDGE
        s.vy = -s.vy * WALL_BOUNCE
        sfx.boing()
        if (!s.ceilingComment) {
          s.ceilingComment = true
          chatter('ceiling')
        }
      }
      if (s.y >= s.floor) {
        s.y = s.floor
        if (s.vy > 0) {
          const impact = s.vy
          if (impact > HARD_LANDING) s.hardLanding = true
          if (impact > BOUNCE_MIN) {
            const strength = Math.min(1, impact / 1800)
            squash(strength)
            sfx.bonk(strength)
            s.vy = -impact * FLOOR_BOUNCE
          } else {
            s.vy = 0
            s.angle = normaliseAngle(s.angle)
          }
          s.vx *= 0.82
        }
        if (s.vy === 0) {
          // Sliding along the floor: friction slows Byte and turns it upright.
          s.vx *= Math.pow(0.02, dt)
          s.angle *= Math.pow(0.002, dt)
          if (Math.abs(s.vx) < 12) {
            render()
            land()
            return
          }
        }
      }
      render()
    }

    s.raf = requestAnimationFrame(step)
  }

  const startLoop = () => {
    const s = sim.current
    cancelAnimationFrame(s.raf)
    s.lastTime = performance.now()
    s.raf = requestAnimationFrame(step)
  }

  const startDrag = () => {
    const s = sim.current
    clearLater()
    spinRef.current.style.transition = ''
    s.vx = 0
    s.vy = 0
    s.hardLanding = false
    s.samples = []
    s.thrown = false
    s.spun = 0
    s.spinComment = false
    s.ceilingComment = false
    s.twirl = 0
    s.twirled = false
    s.lastDirection = null
    s.prevX = s.startX
    s.prevY = s.startY
    changeMode('dragging')
    sfx.grab()
    chatter('grab')
    startLoop()
  }

  const release = () => {
    const s = sim.current
    const first = s.samples[0]
    const last = s.samples[s.samples.length - 1]
    let vx = 0
    let vy = 0
    if (first && last && last.t - first.t > 8) {
      const seconds = (last.t - first.t) / 1000
      vx = (last.x - first.x) / seconds
      vy = (last.y - first.y) / seconds
    }
    const speed = Math.hypot(vx, vy)
    if (speed > MAX_THROW) {
      vx *= MAX_THROW / speed
      vy *= MAX_THROW / speed
    }

    if (prefersReducedMotion()) {
      cancelAnimationFrame(s.raf)
      s.y = s.floor
      s.angle = 0
      render()
      savePosition()
      changeMode('rest')
      return
    }

    s.vx = vx
    s.vy = vy
    s.thrown = speed > 900
    // Swinging Byte round in circles leaves it dizzy once it lands.
    if (s.twirled) s.hardLanding = true
    if (s.thrown) {
      sfx.whoosh()
      chatter(vy < -700 ? 'throwUp' : 'throwSide')
    }
    changeMode('flying')
    startLoop()
  }

  const onPointerDown = (event) => {
    if (event.button !== 0) return
    const s = sim.current
    s.pressed = true
    s.dragged = false
    s.pointerId = event.pointerId
    s.startX = event.clientX
    s.startY = event.clientY
    s.grabX = event.clientX - s.x
    s.grabY = event.clientY - s.y
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event) => {
    const s = sim.current
    if (!s.pressed || event.pointerId !== s.pointerId) return
    if (!s.dragged) {
      if (Math.hypot(event.clientX - s.startX, event.clientY - s.startY) < DRAG_THRESHOLD) return
      s.dragged = true
      startDrag()
    }
    // Add up how much the carry direction turns; two full circles count as spinning Byte.
    const dx = event.clientX - s.prevX
    const dy = event.clientY - s.prevY
    if (Math.hypot(dx, dy) > 4) {
      const direction = Math.atan2(dy, dx)
      if (s.lastDirection !== null) {
        let delta = direction - s.lastDirection
        if (delta > Math.PI) delta -= 2 * Math.PI
        if (delta < -Math.PI) delta += 2 * Math.PI
        s.twirl += delta
        if (Math.abs(s.twirl) > TWIRL_TO_DIZZY) {
          s.twirl = 0
          s.twirled = true
          chatter('spin')
        }
      }
      s.lastDirection = direction
      s.prevX = event.clientX
      s.prevY = event.clientY
    }

    const now = performance.now()
    s.x = clamp(event.clientX - s.grabX, EDGE, s.maxX)
    s.y = clamp(event.clientY - s.grabY, EDGE, s.floor)
    s.samples = [...s.samples.filter((sample) => sample.t > now - 90), { x: s.x, y: s.y, t: now }]
    render()
  }

  const onPointerUp = (event) => {
    const s = sim.current
    if (!s.pressed || event.pointerId !== s.pointerId) return
    s.pressed = false
    if (s.dragged) release()
  }

  const onClick = () => {
    const s = sim.current
    // The click that ends a drag should not also toggle the voice.
    if (s.dragged) {
      s.dragged = false
      return
    }
    setVoiceEnabled(!enabled)
  }

  useLayoutEffect(() => {
    const s = sim.current
    measure()
    let ratio = null
    try {
      const saved = parseFloat(localStorage.getItem(POSITION_KEY))
      if (Number.isFinite(saved)) ratio = saved
    } catch {
      // No saved position: use the default corner.
    }
    s.x = ratio === null ? window.innerWidth - s.size - 16 : clamp(ratio * s.maxX, EDGE, s.maxX)
    s.y = s.floor
    render()

    const onResize = () => {
      measure()
      s.x = clamp(s.x, EDGE, s.maxX)
      s.y = s.mode === 'flying' || s.mode === 'dragging' ? Math.min(s.y, s.floor) : s.floor
      render()
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(s.raf)
      s.timers.forEach(clearTimeout)
    }
  }, [])

  const classes = [
    'va',
    `is-${mode}`,
    enabled ? '' : 'is-asleep',
    speaking ? 'is-talking' : '',
    placement.left ? 'is-left' : '',
    placement.below ? 'is-below' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div ref={wrapperRef} className={classes}>
      {enabled && text && (
        <p key={text} className="va-bubble">
          <span className="va-name">BYTE</span>
          {text}
        </p>
      )}
      <button
        type="button"
        className="va-button"
        aria-label="Voice assistant"
        aria-pressed={enabled}
        title={`Voice assistant is ${enabled ? 'on' : 'off'}. Click to switch it, or drag to throw Byte.`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={onClick}
        onDragStart={(event) => event.preventDefault()}
      >
        <span ref={spinRef} className="va-spin">
          <span ref={bodyRef} className="va-body">
            <MonsterArt />
          </span>
          <span className="va-stars" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          {!enabled && (
            <span className="va-zzz" aria-hidden="true">
              z
            </span>
          )}
        </span>
      </button>
    </div>
  )
}
