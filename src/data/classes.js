import { seeded } from '../lib/ml.js'

// Sample classmates for the class leaderboards. Replace with real data once student accounts
// are connected to a backend; only the signed-in student's XP is real.

export const CLASSES = ['AIML-A', 'AIML-B', 'CSE-A', 'CSE-B', 'ECE-A']

const CLASS_SIZE = 14

function sampleClass(name, classIndex) {
  const random = seeded(4200 + classIndex * 97)
  return Array.from({ length: CLASS_SIZE }, (_, i) => {
    const cleared = Math.floor(random() * 7)
    const xp = Math.round([0, 120, 280, 480, 720, 1000, 1320][cleared] + random() * 90)
    return {
      id: `ML-2026-${String(classIndex * 20 + i + 101).padStart(3, '0')}`,
      className: name,
      xp,
      cleared,
      stars: Math.min(cleared * 3, Math.round(cleared * (1.6 + random() * 1.4))),
    }
  })
}

const SAMPLE = Object.fromEntries(CLASSES.map((name, index) => [name, sampleClass(name, index)]))

const byXp = (a, b) => b.xp - a.xp || b.stars - a.stars || a.id.localeCompare(b.id)

// Ranked roster for one class, with the signed-in student placed by their real XP.
export function classLeaderboard(className, you) {
  const others = SAMPLE[className].filter((student) => student.id !== you.id)
  const roster = className === you.className ? [...others, { ...you, isYou: true }] : others
  return roster.sort(byXp).map((student, index) => ({ ...student, rank: index + 1 }))
}

// Classes ranked by average XP.
export function classRanking(you) {
  return CLASSES.map((name) => {
    const roster = classLeaderboard(name, you)
    return {
      className: name,
      students: roster.length,
      averageXp: Math.round(roster.reduce((sum, s) => sum + s.xp, 0) / roster.length),
      topStudent: roster[0],
      isYours: name === you.className,
    }
  })
    .sort((a, b) => b.averageXp - a.averageXp)
    .map((entry, index) => ({ ...entry, rank: index + 1 }))
}

const CLASS_KEY = (studentId) => `pac-lab-class:${studentId}`

export function readClass(studentId) {
  try {
    const saved = localStorage.getItem(CLASS_KEY(studentId))
    return CLASSES.includes(saved) ? saved : CLASSES[0]
  } catch {
    return CLASSES[0]
  }
}

export function saveClass(studentId, className) {
  try {
    localStorage.setItem(CLASS_KEY(studentId), className)
  } catch {
    // Storage unavailable: the choice lasts for this visit.
  }
}
