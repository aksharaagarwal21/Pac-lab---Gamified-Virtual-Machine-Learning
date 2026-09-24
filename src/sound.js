import { useEffect } from 'react'

// Arcade sound effects are synthesized with the Web Audio API (no audio files),
// and voice lines use the browser's built-in speech synthesis.
// Browsers keep audio locked until the visitor's first click or key press.

const MUTE_KEY = 'pac-lab-muted'

let ctx = null
let master = null
let muted = readMuted()
let chompStep = 0

function readMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

function hasUserActivation() {
  return navigator.userActivation ? navigator.userActivation.hasBeenActive : true
}

function getAudio() {
  if (muted || !hasUserActivation()) return null
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return null
    ctx = new AudioCtx()
    master = ctx.createGain()
    master.gain.value = 0.5
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function tone({ type = 'square', from, to = from, at = 0, dur, vol = 0.1 }) {
  const ac = getAudio()
  if (!ac) return
  const start = ac.currentTime + at
  const end = start + dur
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(from, start)
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, end)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(vol, start + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, end)
  osc.connect(gain)
  gain.connect(master)
  osc.start(start)
  osc.stop(end + 0.02)
}

function notes(freqs, { step, dur = step, type, vol, at = 0 }) {
  freqs.forEach((from, i) => tone({ type, from, at: at + i * step, dur, vol }))
}

// Chiptune take on the doll's "mugunghwa" song, one note per green-light beat.
const DOLL_SONG = [659.25, 659.25, 783.99, 659.25, 587.33, 659.25, 523.25, 587.33, 659.25, 523.25]

export const sfx = {
  hover: () => tone({ from: 1320, dur: 0.035, vol: 0.04 }),
  type: () => tone({ from: 1700 + Math.random() * 400, dur: 0.018, vol: 0.03 }),
  select: () => notes([660, 990], { step: 0.07, dur: 0.09, vol: 0.09 }),
  back: () => notes([990, 660], { step: 0.07, dur: 0.09, vol: 0.09 }),
  enter: () => notes([392, 523.25, 659.25, 783.99, 1046.5], { step: 0.055, dur: 0.08, vol: 0.09 }),
  replay: () => tone({ type: 'triangle', from: 220, to: 880, dur: 0.28, vol: 0.25 }),
  // Classic "waka": alternate a falling and a rising sweep on each pellet.
  chomp: () => {
    const rising = chompStep++ % 2 === 1
    tone({ type: 'triangle', from: rising ? 240 : 560, to: rising ? 560 : 240, dur: 0.1, vol: 0.35 })
  },
  ghost: () => {
    tone({ from: 140, to: 1100, dur: 0.2, vol: 0.08 })
    tone({ type: 'triangle', from: 280, to: 2200, dur: 0.2, vol: 0.15 })
  },
  reveal: () => {
    notes([523.25, 659.25, 783.99, 1046.5], { step: 0.09, dur: 0.12, vol: 0.08 })
    tone({ type: 'triangle', from: 1046.5, at: 0.36, dur: 0.6, vol: 0.25 })
    tone({ from: 783.99, at: 0.36, dur: 0.6, vol: 0.05 })
  },
  coin: () => {
    tone({ from: 987.77, dur: 0.08, vol: 0.09 })
    tone({ from: 1318.51, at: 0.08, dur: 0.4, vol: 0.09 })
  },
  powerUp: () => {
    notes([261.63, 329.63, 392, 523.25, 659.25, 783.99, 1046.5], { step: 0.05, dur: 0.07, vol: 0.07 })
    tone({ type: 'triangle', from: 1046.5, to: 2093, at: 0.35, dur: 0.3, vol: 0.2 })
  },
  // Byte physics
  grab: () => tone({ type: 'triangle', from: 320, to: 760, dur: 0.09, vol: 0.2 }),
  whoosh: () => tone({ from: 900, to: 180, dur: 0.2, vol: 0.04 }),
  boing: () => tone({ type: 'triangle', from: 520, to: 260, dur: 0.1, vol: 0.18 }),
  bonk: (strength = 1) => {
    tone({ type: 'triangle', from: 190, to: 55, dur: 0.18, vol: 0.2 + 0.3 * strength })
    tone({ from: 95, to: 60, dur: 0.07, vol: 0.05 + 0.06 * strength })
  },
  dizzy: () => notes([988, 880, 784, 698, 784, 880], { step: 0.07, dur: 0.09, type: 'triangle', vol: 0.12 }),
  wake: () => notes([440, 660, 880], { step: 0.07, dur: 0.1, type: 'triangle', vol: 0.16 }),
  notice: () => notes([523.25, 392], { step: 0.12, dur: 0.16, vol: 0.08 }),
  denied: () => notes([196, 147], { step: 0.13, dur: 0.18, vol: 0.09 }),
  // Red Light, Green Light
  songNote: (beat) => {
    tone({ from: DOLL_SONG[beat % DOLL_SONG.length], dur: 0.16, vol: 0.07 })
    if (beat % 2 === 0) tone({ type: 'triangle', from: 130.81, dur: 0.12, vol: 0.18 })
  },
  redLight: () => {
    tone({ type: 'sawtooth', from: 110, dur: 0.4, vol: 0.06 })
    notes([880, 660, 880], { step: 0.1, dur: 0.09, vol: 0.07 })
  },
  // Pac-Man style death: a warbling fall followed by two pops.
  eliminated: () => {
    for (let k = 0; k < 8; k++) tone({ type: 'triangle', from: 880 - k * 70, to: 520 - k * 50, at: k * 0.1, dur: 0.1, vol: 0.2 })
    notes([196, 196], { step: 0.12, dur: 0.07, vol: 0.1, at: 0.85 })
  },
  gameOver: () => notes([392, 330, 262, 196], { step: 0.24, dur: 0.3, type: 'triangle', vol: 0.22 }),
}

let voices = []

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  const loadVoices = () => {
    voices = window.speechSynthesis.getVoices()
  }
  loadVoices()
  window.speechSynthesis.onvoiceschanged = loadVoices
}

function pickVoice() {
  const english = voices.filter((voice) => /^en[-_]/i.test(voice.lang))
  return english.find((voice) => /zira|samantha|google us english|aria|jenny/i.test(voice.name)) || english[0] || null
}

// Voice assistant ("Byte" the monster): spoken lines can be switched off on their own,
// while click and game sounds keep playing. Components read this state to animate Byte.
const VOICE_KEY = 'pac-lab-voice'
const assistantListeners = new Set()
let assistant = { enabled: readVoiceEnabled(), speaking: false, text: '' }
let speechId = 0
let captionTimer

function readVoiceEnabled() {
  try {
    return localStorage.getItem(VOICE_KEY) !== 'off'
  } catch {
    return true
  }
}

function updateAssistant(patch) {
  assistant = { ...assistant, ...patch }
  assistantListeners.forEach((listener) => listener())
}

export const getAssistant = () => assistant

export function subscribeAssistant(listener) {
  assistantListeners.add(listener)
  return () => assistantListeners.delete(listener)
}

// Ends a line: Byte closes its mouth, and the caption fades shortly after.
function finishSpeech(id) {
  if (id !== speechId) return
  clearTimeout(captionTimer)
  updateAssistant({ speaking: false })
  captionTimer = setTimeout(() => {
    if (id === speechId) updateAssistant({ text: '' })
  }, 1200)
}

function stopSpeech() {
  speechId++
  clearTimeout(captionTimer)
  window.speechSynthesis?.cancel()
  updateAssistant({ speaking: false, text: '' })
}

// Byte's voice: high-pitched and quick, like a small arcade monster.
export function say(text) {
  if (muted || !assistant.enabled || !hasUserActivation() || !('speechSynthesis' in window)) return
  const synth = window.speechSynthesis
  const id = ++speechId
  const line = new SpeechSynthesisUtterance(text)
  const voice = pickVoice()
  if (voice) line.voice = voice
  line.lang = voice?.lang || 'en-US'
  line.rate = 1.05
  line.pitch = 1.8
  line.onend = () => finishSpeech(id)
  line.onerror = () => finishSpeech(id)

  clearTimeout(captionTimer)
  updateAssistant({ speaking: true, text })
  // Some browsers never fire onend, so the caption also clears after a generous estimate.
  captionTimer = setTimeout(() => finishSpeech(id), Math.max(2500, text.length * 110))

  const busy = synth.speaking || synth.pending
  synth.cancel()
  // Chrome can drop an utterance queued in the same tick as cancel().
  if (busy) setTimeout(() => synth.speak(line), 60)
  else synth.speak(line)
}

export function setMuted(value) {
  muted = value
  try {
    localStorage.setItem(MUTE_KEY, value ? '1' : '0')
  } catch {
    // Storage unavailable: mute still applies for this visit.
  }
  if (value) stopSpeech()
  else sfx.select()
}

export function setVoiceEnabled(value) {
  try {
    localStorage.setItem(VOICE_KEY, value ? 'on' : 'off')
  } catch {
    // Storage unavailable: the choice still applies for this visit.
  }
  if (!value) {
    stopSpeech()
    updateAssistant({ enabled: false })
    sfx.back()
    return
  }
  updateAssistant({ enabled: true })
  sfx.select()
  say('Byte here! Voice assistant is on.')
}

const HOVER_TARGETS = [
  '.arcade-button:not(:disabled)',
  '.player-card',
  '.auth-links a',
  '.mz-node-hit',
  '.mz-tab',
  '.mz-task',
  '.mz-btn:not(:disabled)',
  '.mz-option:not(:disabled)',
  '.mz-avatar-button',
  '.va-button',
  '.hx-seg',
  '.hx-tile',
  '.hx-chip',
].join(', ')

// First matching selector wins.
const CLICK_SOUNDS = [
  ['.replay-button', 'replay'],
  ['.player-card', 'select'],
  ['a.arcade-button[href="/login"]', 'enter'],
  ['a[href="/login"]', 'select'],
  ['a[href="/"]', 'back'],
]

// Interface sounds wired through document-level listeners so the page markup stays identical to the original.
export function useArcadeSounds() {
  useEffect(() => {
    let hovered = null
    let lastInvalid = 0

    const onPointerOver = (event) => {
      const el = event.target.closest?.(HOVER_TARGETS) ?? null
      if (el && el !== hovered) sfx.hover()
      hovered = el
    }
    const onFocusIn = (event) => {
      const el = event.target.closest?.(HOVER_TARGETS)
      if (el?.matches(':focus-visible')) sfx.hover()
    }
    const onClick = (event) => {
      const match = CLICK_SOUNDS.find(([selector]) => event.target.closest?.(selector))
      if (match) sfx[match[1]]()
    }
    const onInput = (event) => {
      if (event.target.matches?.('.auth-field input')) sfx.type()
    }
    const onSubmit = (event) => {
      if (event.target.matches?.('.auth-form')) sfx.coin()
    }
    // `invalid` fires once per empty required field; play a single buzz.
    const onInvalid = () => {
      const now = performance.now()
      if (now - lastInvalid > 300) sfx.denied()
      lastInvalid = now
    }
    const onKeyDown = (event) => {
      if (event.key?.toLowerCase() !== 'm' || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
      if (event.target.closest?.('input, textarea, [contenteditable]')) return
      setMuted(!muted)
    }

    document.addEventListener('mouseover', onPointerOver)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('click', onClick)
    document.addEventListener('input', onInput)
    document.addEventListener('submit', onSubmit)
    document.addEventListener('invalid', onInvalid, true)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('mouseover', onPointerOver)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('click', onClick)
      document.removeEventListener('input', onInput)
      document.removeEventListener('submit', onSubmit)
      document.removeEventListener('invalid', onInvalid, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])
}
