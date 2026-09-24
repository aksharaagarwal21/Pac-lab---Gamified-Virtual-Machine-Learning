import { LABS } from './labs.js'

// Player levels by total XP (all ten experiments together are worth 3,580 XP).
export const LEVELS = [
  { level: 1, name: 'Rookie', min: 0 },
  { level: 2, name: 'Explorer', min: 250 },
  { level: 3, name: 'Challenger', min: 700 },
  { level: 4, name: 'Expert', min: 1500 },
  { level: 5, name: 'Master', min: 2500 },
  { level: 6, name: 'Legend', min: 3580 },
]

export function levelFor(xp) {
  const current = [...LEVELS].reverse().find((entry) => xp >= entry.min)
  const next = LEVELS.find((entry) => entry.min > xp) ?? null
  return { ...current, next, progress: next ? (xp - current.min) / (next.min - current.min) : 1 }
}

const clearedCount = (progress) => Object.keys(progress.cleared).length
const anyTask = (progress, task) => Object.values(progress.tasks).some((done) => done.includes(task))

// Badges are earned from real progress. `icon` names match lucide-react icons.
export const BADGES = [
  {
    id: 'first-steps',
    name: 'First Steps',
    goal: 'Complete any step of any experiment.',
    icon: 'Footprints',
    earned: (p) => Object.values(p.tasks).some((done) => done.length > 0),
  },
  { id: 'first-clear', name: 'First Clear', goal: 'Clear your first experiment.', icon: 'Flag', earned: (p) => clearedCount(p) >= 1 },
  { id: 'scientist', name: 'Lab Scientist', goal: 'Save a simulation result.', icon: 'FlaskConical', earned: (p) => anyTask(p, 'simulation') },
  {
    id: 'perfect-run',
    name: 'Perfect Run',
    goal: 'Earn 3 stars in an experiment.',
    icon: 'Star',
    earned: (p) => Object.values(p.cleared).some((lab) => lab.stars === 3),
  },
  {
    id: 'quiz-ace',
    name: 'Quiz Ace',
    goal: 'Score 100% in a posttest.',
    icon: 'Target',
    earned: (p) => Object.values(p.quizzes ?? {}).some((lab) => lab.posttest?.finished && lab.posttest.score === lab.posttest.answers.length),
  },
  { id: 'halfway', name: 'Halfway There', goal: 'Clear 5 experiments.', icon: 'Medal', earned: (p) => clearedCount(p) >= 5 },
  { id: 'collector', name: 'Coin Collector', goal: 'Collect 150 coins.', icon: 'Coins', earned: (p) => p.coins >= 150 },
  { id: 'legend', name: 'Maze Legend', goal: `Clear all ${LABS.length} experiments.`, icon: 'Crown', earned: (p) => clearedCount(p) >= LABS.length },
]
