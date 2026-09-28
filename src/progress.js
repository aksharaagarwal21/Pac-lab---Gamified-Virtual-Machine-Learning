import { useSyncExternalStore } from 'react'
import { LABS } from './data/labs.js'
import { studentFetch } from './lib/studentApi.js'
import { getStudent, getStudentAuth } from './session.js'

// Maze progress (cleared labs, XP, coins, completed tasks, quizzes), kept per student in this
// browser and saved to the server, so it survives logging out and switching devices.

const EMPTY = { cleared: {}, xp: 0, coins: 0, tasks: {}, quizzes: {}, typing: {}, savedAt: 0 }
const listeners = new Set()
let cache = { key: null, value: EMPTY }

const storageKey = () => `ml-maze-progress:${getStudent() ?? 'guest'}`

function read() {
  const key = storageKey()
  if (cache.key === key) return cache.value
  let value = EMPTY
  try {
    const saved = localStorage.getItem(key)
    if (saved) value = { ...EMPTY, ...JSON.parse(saved) }
  } catch {
    // Unreadable or blocked storage: start from empty progress.
  }
  cache = { key, value }
  return value
}

function store(next) {
  const key = storageKey()
  cache = { key, value: next }
  try {
    localStorage.setItem(key, JSON.stringify(next))
  } catch {
    // Storage unavailable: progress still lasts for this visit.
  }
  listeners.forEach((listener) => listener())
}

function write(next) {
  store({ ...next, savedAt: Date.now() })
  scheduleSync()
}

// ---------- server sync ----------

const SYNC_DELAY = 600
let syncTimer = null
let syncing = null
let dirty = false

function scheduleSync() {
  dirty = true
  clearTimeout(syncTimer)
  syncTimer = setTimeout(() => {
    flushProgress().catch(() => {})
  }, SYNC_DELAY)
}

// Sends unsaved progress to the server now. Resolves once it is saved (or nothing was pending).
export async function flushProgress() {
  clearTimeout(syncTimer)
  if (syncing) await syncing.catch(() => {})
  if (!dirty || !getStudentAuth()?.token) return
  dirty = false
  syncing = studentFetch('/state', { method: 'PUT', body: { state: read() } })
    .catch((error) => {
      dirty = true
      throw error
    })
    .finally(() => {
      syncing = null
    })
  return syncing
}

// Right after sign-in: keep whichever copy is newer, this browser's or the server's.
export async function adoptServerProgress(serverState) {
  const local = read()
  if (serverState && (serverState.savedAt ?? 0) >= (local.savedAt ?? 0)) {
    store({ ...EMPTY, ...serverState })
    dirty = false
    return
  }
  if (local.savedAt) {
    dirty = true
    await flushProgress().catch(() => {})
  }
}

// Last chance to save when the tab is closed or hidden.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    if (dirty && getStudentAuth()?.token) studentFetch('/state', { method: 'PUT', body: { state: read() }, keepalive: true }).catch(() => {})
  })
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const useProgress = () => useSyncExternalStore(subscribe, read, read)
export const getProgress = read

export const totalStars = (progress) => Object.values(progress.cleared).reduce((sum, lab) => sum + lab.stars, 0)

// Experiments whose Python Speed Code must be typed out in full once before the next one opens.
export const SPEED_CODE_LABS = [1, 2, 3]

export const speedCodeRequired = (labId) => SPEED_CODE_LABS.includes(labId)
export const speedCodeDone = (progress, labId) => (progress.typing?.[labId]?.completions ?? 0) > 0

// A lab opens once the previous one is cleared and, where required, its Speed Code is complete.
export function labStatus(progress, labId) {
  if (progress.cleared[labId]) return 'cleared'
  if (labId === 1) return 'ready'
  const previous = labId - 1
  if (progress.cleared[previous] && (!speedCodeRequired(previous) || speedCodeDone(progress, previous))) return 'ready'
  return 'locked'
}

// Why a lab is locked, in words a student can act on (null when it is open).
export function lockReason(progress, labId) {
  if (labStatus(progress, labId) !== 'locked') return null
  const previous = labId - 1
  const quiz = !progress.cleared[previous]
  const code = speedCodeRequired(previous) && !speedCodeDone(progress, previous)
  if (quiz && code) return `Pass the Experiment ${previous} posttest and finish its Python Speed Code first.`
  if (quiz) return `Clear Experiment ${previous} first.`
  return `Finish the Python Speed Code in Experiment ${previous} first.`
}

// What still stands between this lab and the next one opening (null when nothing does).
export function nextUnlockBlocker(progress, labId) {
  if (!LABS.some((lab) => lab.id === labId + 1)) return null
  if (speedCodeRequired(labId) && !speedCodeDone(progress, labId)) return 'Finish the Python Speed Code (Simulation → Python practice) to unlock the next level.'
  return null
}

export const nextLab = (progress) => LABS.find((lab) => !progress.cleared[lab.id]) ?? null

export function completeTask(labId, taskId) {
  const progress = read()
  const done = progress.tasks[labId] ?? []
  if (done.includes(taskId)) return
  write({ ...progress, tasks: { ...progress.tasks, [labId]: [...done, taskId] } })
}

// Saves a pretest or posttest attempt: { answers, score, finished }.
export function saveQuiz(labId, kind, record) {
  const progress = read()
  const lab = progress.quizzes?.[labId] ?? {}
  write({ ...progress, quizzes: { ...progress.quizzes, [labId]: { ...lab, [kind]: record } } })
}

export const getQuiz = (progress, labId, kind) => progress.quizzes?.[labId]?.[kind] ?? null

// Saves a finished game-mode quiz run (see QuizRace.jsx) and pays out its bonus XP and coins.
// Only the part above the best earlier run is paid, so replaying a quiz cannot farm rewards.
export function saveQuizRun(labId, kind, record, earned) {
  const progress = read()
  const lab = progress.quizzes?.[labId] ?? {}
  const best = lab[kind]?.bonus ?? { xp: 0, coins: 0 }
  const award = { xp: Math.max(0, earned.xp - best.xp), coins: Math.max(0, earned.coins - best.coins) }
  const bonus = { xp: best.xp + award.xp, coins: best.coins + award.coins }

  write({
    ...progress,
    xp: progress.xp + award.xp,
    coins: progress.coins + award.coins,
    quizzes: { ...progress.quizzes, [labId]: { ...lab, [kind]: { ...record, bonus } } },
  })
  return award
}

// Records a quiz clear. XP comes with the first clear; coins and stars only for new stars.
export function clearLab(labId, stars) {
  const progress = read()
  const lab = LABS.find((entry) => entry.id === labId)
  const previous = progress.cleared[labId]
  const newStars = Math.max(0, stars - (previous?.stars ?? 0))
  const reward = { xp: previous ? 0 : lab.xp, coins: newStars * 10, stars: newStars }
  const done = progress.tasks[labId] ?? []

  write({
    ...progress,
    xp: progress.xp + reward.xp,
    coins: progress.coins + reward.coins,
    cleared: { ...progress.cleared, [labId]: { stars: Math.max(stars, previous?.stars ?? 0) } },
    tasks: { ...progress.tasks, [labId]: done.includes('quiz') ? done : [...done, 'quiz'] },
  })
  return reward
}

// ---------- Python Speed Code ----------
// typing[labId] = { attempt: { parts: [{ keys, correctKeys, ms } | null] }, best, last, completions }

export function saveSpeedPart(labId, index, stats) {
  const progress = read()
  const lab = progress.typing?.[labId] ?? {}
  const parts = [...(lab.attempt?.parts ?? [])]
  parts[index] = stats
  write({ ...progress, typing: { ...progress.typing, [labId]: { ...lab, attempt: { parts } } } })
}

// Records a finished run (all parts typed). The best run is the one with the highest WPM.
export function finishSpeedCode(labId, result) {
  const progress = read()
  const lab = progress.typing?.[labId] ?? {}
  const best = !lab.best || result.wpm > lab.best.wpm ? result : lab.best
  write({
    ...progress,
    typing: { ...progress.typing, [labId]: { best, last: result, completions: (lab.completions ?? 0) + 1, attempt: null } },
  })
}

export function resetSpeedAttempt(labId) {
  const progress = read()
  const lab = progress.typing?.[labId]
  if (!lab?.attempt) return
  write({ ...progress, typing: { ...progress.typing, [labId]: { ...lab, attempt: null } } })
}
