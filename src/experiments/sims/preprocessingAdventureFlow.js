import { freshBoard, buildPipeline, RAW, lineMetrics, display } from './preprocessingArcadeModel.js'

export const LEVELS = [
  { title: 'Guard the test vault', short: 'Protect', goal: 'Move the two purple test cards into the vault, then lock it.', why: 'Training data teaches the model. Test data checks it later, like an unseen exam.', demo: 'Cards 11 and 12 are our unseen exam. Click each purple card to move it, then press Lock the vault.', learned: 'You set aside unseen test data before learning any cleaning rules.' },
  { title: 'Repair the block bridge', short: 'Repair', goal: 'Repair five gaps so Pac can cross the bridge.', why: 'A missing value is an empty space. A sensible replacement lets us keep the rest of the row.', demo: 'Pull the pink ? out, or click it. Choose a replacement block. Press Cross the bridge to test the repair.', learned: 'You repaired individual cells using values calculated from observed training data.' },
  { title: 'Meet the outlier boss', short: 'Inspect', goal: 'Find the unusually tall salary block. Decide how to handle it.', why: 'An outlier is a value far from the others. It deserves a closer look, but is not automatically an error.', demo: 'Tap the tallest salary block. You can keep the value, or drag the cap handle down to the glowing safety fence.', learned: 'You inspected an extreme value before deciding to keep or cap it.' },
  { title: 'Build the city switches', short: 'Encode', goal: 'Turn on only the switch that matches the ticket’s city.', why: 'A model needs numbers. A separate 0/1 switch for each city avoids pretending one city is larger than another.', demo: 'For a Delhi ticket, turn Delhi on and leave Chennai and Mumbai off. Then send the ticket across.', learned: 'You built one-hot encodings: one switch per city, exactly one on.' },
  { title: 'Launch through the scale gate', short: 'Scale', goal: 'Aim a value at the glowing gate, then launch it. Try two scales.', why: 'Scaling changes the units, not the information. It helps compare features such as age and salary.', demo: 'The gate marks the transformed value. Move the slider until your aim is inside it, then press Launch block.', learned: 'You used both min–max scaling and standardization with training-only statistics.' },
  { title: 'Ride your own line', short: 'Ride', goal: 'Lift the line to its first pellet, tilt it, then ride through all six.', why: 'In y = mx + b, b sets the starting height and m sets how much the line rises for each step right.', demo: 'First lift the line to the pellet at height 1. Then tilt it: the pellets rise by 2 for every step right. Press Ride the line to test it.', learned: 'You adjusted the intercept and slope, then tested your line against real prediction errors.' },
]
export const REPAIRS = [
  { key: '2:age', method: 'mean', hint: 'Try the average age. Mean adds the known ages and shares the total equally.' },
  { key: '3:salary', method: 'median', hint: 'Try the middle salary. Median is less affected by the one unusually large salary.' },
  { key: '9:city', method: 'mode', hint: 'A city is a name, not a number. Mode chooses the most common city.' },
  { key: '8:age', method: 'median', hint: 'Try the middle age this time. Mean and median can both be reasonable for these ages.' },
  { key: '9:salary', method: 'median', hint: 'One more salary gap. Median gives a typical value despite the very large salary.' },
]
export const createAdventure = () => ({
  started: false, level: 0, completed: [], board: freshBoard(), stored: [],
  repairIndex: 0, opened: false, method: null, bossFound: false, cap: 100,
  ticket: 0, bits: [0, 0, 0], scaleRound: 0, aim: 0,
  lineStep: 'lift', m: 0, b: 4, rideHits: null, motion: null,
  feedback: '', feedbackKind: 'info', revision: 0,
})

const note = (s, feedback, feedbackKind = 'info') => ({ ...s, feedback, feedbackKind })
const done = (s, board = s.board) => ({ ...s, board, motion: null, completed: [...s.completed, s.level], feedback: LEVELS[s.level].learned, feedbackKind: 'success', revision: s.revision + 1 })
const startMotion = (s, kind, data = {}) => ({ ...s, feedback: '', motion: { kind, ...data } })

export function scaleMission(s) {
  const result = buildPipeline(s.board), fit = result.scales.age
  const raw = RAW[3].age
  const standard = s.scaleRound === 1
  const target = standard ? (raw - fit.mean) / (fit.std || 1) : (raw - fit.min) / (fit.max - fit.min || 1)
  return { raw, fit, target, min: standard ? -2 : 0, max: standard ? 2 : 1,
    step: standard ? 0.1 : 0.01, mode: standard ? 'standard' : 'minmax',
    label: standard ? 'Z-score: distance from the average' : 'Min–max: squeeze into 0 to 1',
    hit: Math.abs(s.aim - target) <= (standard ? 0.11 : 0.045) }
}

// Central rules prevent skipped missions, duplicate awards and stale animation commits.
export function adventureReducer(s, action) {
  if (action.type === 'RESET') return createAdventure()
  if (action.type === 'START') return { ...s, started: true }
  if (!s.started) return s
  if (action.type === 'NAVIGATE') {
    if (s.motion || !Number.isInteger(action.level) || action.level < 0 || action.level > Math.min(s.completed.length, 5)) return s
    return { ...s, level: action.level, feedback: '' }
  }
  if (s.completed.includes(s.level)) return s
  if (s.level !== s.completed.length) return s
  if (s.motion && action.type !== 'FINISH_MOTION') return s
  if (action.type === 'FINISH_MOTION') {
    if (!s.motion || action.motion !== s.motion) return s
    const motion = s.motion
    s = { ...s, motion: null }
    if (motion.kind === 'store') return note({ ...s, stored: [...s.stored, motion.id] }, 'Test card protected. Training cards stay outside the vault.', 'success')
    if (motion.kind === 'lock') return done(s)
    if (motion.kind === 'bridge') {
      if (s.repairIndex === REPAIRS.length - 1) return done(s)
      return note({ ...s, repairIndex: s.repairIndex + 1, opened: false, method: null }, 'Bridge crossed! Let’s repair the next gap.', 'success')
    }
    if (motion.kind === 'boss') return done(s, { ...s.board, outlier: motion.choice })
    if (motion.kind === 'ticket') {
      if (s.ticket === 2) return done(s, { ...s.board, encoding: 'onehot' })
      return note({ ...s, ticket: s.ticket + 1, bits: [0, 0, 0] }, 'Ticket delivered! Build the switches for the next city.', 'success')
    }
    if (motion.kind === 'scale') {
      if (!motion.hit) return note(s, `Missed the gate. Aim near ${display(motion.target)} and try again. Nothing is lost.`, 'retry')
      const board = { ...s.board, scaling: motion.mode }
      if (s.scaleRound === 1) return done(s, board)
      return note({ ...s, board, scaleRound: 1, aim: 0 }, 'Min–max gate cleared! Now use a z-score: 0 means the average, +1 means one standard deviation above it.', 'success')
    }
    if (motion.kind === 'line') {
      const hits = lineMetrics(s.m, s.b).hits
      s = { ...s, rideHits: hits }
      return hits === 6 ? done(s) : note(s, `You collected ${hits}/6 pellets. ${s.m < 2 ? 'Tilt the line upward a little more.' : 'The line rises too quickly. Reduce the tilt.'} Try slope 2.`, 'retry')
    }
    return s
  }
  if (s.level === 0) {
    if (action.type === 'STORE') {
      if (![10, 11].includes(action.id)) return note(s, 'That is a training card. Keep it here to learn from. The two purple cards are for testing later.', 'retry')
      if (s.stored.includes(action.id)) return s
      return startMotion(s, 'store', { id: action.id })
    }
    if (action.type === 'LOCK') return s.stored.length === 2 ? startMotion(s, 'lock') : note(s, 'Put both purple test cards into the vault first.', 'retry')
  }
  if (s.level === 1) {
    const key = REPAIRS[s.repairIndex].key, col = key.split(':')[1]
    if (action.type === 'PULL') {
      if (s.opened) return s
      const repairs = { ...s.board.repairs }; delete repairs[key]
      return note({ ...s, opened: true, method: null, board: { ...s.board, repairs } }, 'Gap opened. Choose a replacement block below.', 'success')
    }
    if (action.type === 'FILL') {
      if (!s.opened) return note(s, 'Pull out the pink ? block first. You can click it too.', 'retry')
      if (!['mean', 'median', 'mode'].includes(action.method)) return s
      if (col === 'city' && action.method !== 'mode') return note(s, 'Cities cannot be averaged or sorted as numbers. Choose Mode: the most common city.', 'retry')
      const value = buildPipeline(s.board).stats[col][action.method]
      return note({ ...s, method: action.method, board: { ...s.board, repairs: { ...s.board.repairs, [key]: action.method } } }, `${action.method.toUpperCase()} gives ${display(value)}. The gap is repaired. Press Cross the bridge!`, 'success')
    }
    if (action.type === 'CROSS') return s.method ? startMotion(s, 'bridge') : note(s, 'Insert a replacement block before Pac crosses.', 'retry')
  }
  if (s.level === 2) {
    if (action.type === 'INSPECT') return action.id === 6 ? note({ ...s, bossFound: true }, 'You found ₹2,50,000: much bigger than the other salaries. It might still be real. Inspect first, then choose.', 'success') : note(s, 'Look for the tallest block: the salary far above the rest.', 'retry')
    if (action.type === 'CAP' && s.bossFound && Number.isFinite(action.value)) return { ...s, cap: Math.max(0, Math.min(100, action.value)) }
    if (action.type === 'HANDLE' && s.bossFound) {
      if (action.choice === 'keep') return startMotion(s, 'boss', { choice: 'keep' })
      if (action.choice === 'clip') return s.cap <= 5 ? startMotion(s, 'boss', { choice: 'clip' }) : note(s, 'Slide the cap handle all the way toward the glowing fence, then apply it.', 'retry')
    }
  }
  if (s.level === 3) {
    if (action.type === 'BIT' && [0, 1, 2].includes(action.index)) return { ...s, bits: s.bits.map((b, i) => i === action.index ? 1 - b : b), feedback: '' }
    if (action.type === 'SEND') {
      const cities = buildPipeline(s.board).cities
      return s.bits.every((b, i) => b === Number(i === s.ticket)) ? startMotion(s, 'ticket') : note(s, `Turn only ${cities[s.ticket]} ON. The other two switches should be OFF.`, 'retry')
    }
  }
  if (s.level === 4) {
    if (action.type === 'AIM' && Number.isFinite(action.value)) {
      const mission = scaleMission(s)
      return { ...s, aim: Math.max(mission.min, Math.min(mission.max, action.value)), feedback: '' }
    }
    if (action.type === 'LAUNCH') {
      const mission = scaleMission(s)
      return startMotion(s, 'scale', { hit: mission.hit, target: mission.target, mode: mission.mode })
    }
  }
  if (s.level === 5) {
    if (action.type === 'LIFT' && s.lineStep === 'lift' && Number.isFinite(action.value)) return { ...s, b: Math.max(0, Math.min(5, action.value)), feedback: '' }
    if (action.type === 'SET_START') return Math.abs(s.b - 1) <= 0.1 ? note({ ...s, lineStep: 'tilt' }, 'Starting height set! Now tilt the line so it rises 2 for each step right.', 'success') : note(s, 'The first pellet is at height 1. Move the lift slider to 1.', 'retry')
    if (action.type === 'TILT' && s.lineStep === 'tilt' && Number.isFinite(action.value)) return { ...s, m: Math.max(0, Math.min(3, action.value)), rideHits: null, feedback: '' }
    if (action.type === 'RIDE' && s.lineStep === 'tilt') return startMotion(s, 'line')
  }
  return s
}
