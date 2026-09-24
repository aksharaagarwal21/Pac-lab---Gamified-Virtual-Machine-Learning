// Saves a student's maze progress (the same object the browser keeps) and mirrors it into the
// faculty tables: experiment progress, quiz attempts, badges and the activity log.

import { BADGES } from '../src/data/achievements.js'
import { LABS } from '../src/data/labs.js'

const STEP_IDS = ['aim', 'theory', 'pretest', 'procedure', 'simulation', 'results', 'posttest', 'references']
const KINDS = ['pretest', 'posttest']
const LAB_IDS = new Set(LABS.map((lab) => String(lab.id)))
// Upper bound per question on a game-mode quiz's best bonus (QuizRace.jsx and RedLightQuiz.jsx in src/components/lab stay under it).
const RACE_BONUS_CAP = { xp: 20, coins: 11 }

const toInt = (value, min, max) => {
  const number = Math.round(Number(value))
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : min
}

// Keeps only well-formed data; XP and coins are recalculated from cleared experiments plus racing-quiz bonuses.
export function sanitizeState(input) {
  const source = input && typeof input === 'object' ? input : {}
  const cleared = {}
  for (const [id, entry] of Object.entries(source.cleared ?? {})) {
    if (LAB_IDS.has(id) && entry && Number.isInteger(entry.stars) && entry.stars >= 1 && entry.stars <= 3) cleared[id] = { stars: entry.stars }
  }

  const tasks = {}
  for (const [id, list] of Object.entries(source.tasks ?? {})) {
    if (LAB_IDS.has(id) && Array.isArray(list)) tasks[id] = [...new Set(list.filter((task) => typeof task === 'string' && task.length <= 20))].slice(0, 12)
  }

  const quizzes = {}
  for (const [id, lab] of Object.entries(source.quizzes ?? {})) {
    if (!LAB_IDS.has(id) || !lab || typeof lab !== 'object') continue
    for (const kind of KINDS) {
      const record = lab[kind]
      if (!record || !Array.isArray(record.answers) || record.answers.length > 50) continue
      const answers = record.answers.map((answer) => (Number.isInteger(answer) && answer >= 0 && answer <= 3 ? answer : null))
      const clean = { answers, score: toInt(record.score, 0, answers.length), finished: Boolean(record.finished) }
      if (record.bonus && typeof record.bonus === 'object') {
        clean.bonus = {
          xp: toInt(record.bonus.xp, 0, answers.length * RACE_BONUS_CAP.xp),
          coins: toInt(record.bonus.coins, 0, answers.length * RACE_BONUS_CAP.coins),
        }
      }
      quizzes[id] = { ...quizzes[id], [kind]: clean }
    }
  }

  const clearedLabs = LABS.filter((lab) => cleared[lab.id])
  const quizBonus = (field) =>
    Object.values(quizzes).reduce((sum, lab) => sum + KINDS.reduce((total, kind) => total + (lab[kind]?.bonus?.[field] ?? 0), 0), 0)
  return {
    cleared,
    xp: clearedLabs.reduce((sum, lab) => sum + lab.xp, 0) + quizBonus('xp'),
    coins: clearedLabs.reduce((sum, lab) => sum + cleared[lab.id].stars * 10, 0) + quizBonus('coins'),
    tasks,
    quizzes,
    savedAt: toInt(source.savedAt, 0, Date.now() + 864e5),
  }
}

// The saved progress, or one rebuilt from the faculty tables for accounts that never saved any.
export async function loadState(db, studentId) {
  const [[row]] = await db.query('SELECT state FROM student_state WHERE student_id = ?', [studentId])
  if (row) return row.state
  const [progress] = await db.query('SELECT experiment_id, status, stars, steps_completed FROM experiment_progress WHERE student_id = ?', [studentId])
  if (!progress.length) return null
  const state = { cleared: {}, tasks: {}, quizzes: {}, savedAt: 0 }
  for (const p of progress) {
    if (p.status === 'cleared') {
      state.cleared[p.experiment_id] = { stars: p.stars }
      state.tasks[p.experiment_id] = [...STEP_IDS]
    } else {
      state.tasks[p.experiment_id] = STEP_IDS.slice(0, p.steps_completed)
    }
  }
  return sanitizeState(state)
}

export async function saveState(pool, studentId, rawState) {
  const state = sanitizeState(rawState)
  const now = new Date()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()
    await connection.query(
      'INSERT INTO student_state (student_id, state) VALUES (?, ?) AS incoming ON DUPLICATE KEY UPDATE state = incoming.state',
      [studentId, JSON.stringify(state)],
    )

    // Experiment progress: every cleared experiment plus the one the student has reached next.
    const [previous] = await connection.query('SELECT experiment_id, status, started_at, cleared_at, time_spent_min FROM experiment_progress WHERE student_id = ?', [studentId])
    const before = new Map(previous.map((row) => [row.experiment_id, row]))
    const progressRows = []
    const newlyCleared = []
    for (const lab of LABS) {
      const old = before.get(lab.id)
      const steps = Math.min(8, (state.tasks[lab.id] ?? []).filter((task) => STEP_IDS.includes(task)).length)
      const done = state.cleared[lab.id]
      if (done) {
        progressRows.push([studentId, lab.id, 'cleared', 8, done.stars, lab.xp, done.stars * 10, old?.time_spent_min ?? 0, old?.started_at ?? now, old?.cleared_at ?? now])
        if (old?.status !== 'cleared') newlyCleared.push({ lab, stars: done.stars })
        continue
      }
      const reached = lab.id === 1 || state.cleared[lab.id - 1]
      if (reached && (steps > 0 || lab.id > 1)) {
        progressRows.push([studentId, lab.id, steps > 0 ? 'in_progress' : 'ready', steps, 0, 0, 0, old?.time_spent_min ?? 0, old?.started_at ?? now, null])
      }
      if (reached) break
    }
    await connection.query('DELETE FROM experiment_progress WHERE student_id = ?', [studentId])
    if (progressRows.length) {
      await connection.query(
        `INSERT INTO experiment_progress (student_id, experiment_id, status, steps_completed, stars, xp_earned, coins_earned, time_spent_min, started_at, cleared_at) VALUES ?`,
        [progressRows],
      )
    }

    // Quiz attempts: one row per fully answered pretest or posttest.
    const [previousQuizzes] = await connection.query('SELECT experiment_id, kind, score, submitted_at FROM quiz_attempts WHERE student_id = ?', [studentId])
    const submittedAt = new Map(previousQuizzes.map((q) => [`${q.experiment_id}:${q.kind}:${q.score}`, q.submitted_at]))
    const quizRows = []
    const newQuizzes = []
    for (const [labId, lab] of Object.entries(state.quizzes)) {
      for (const kind of KINDS) {
        const record = lab[kind]
        if (!record?.answers.length || record.answers.some((answer) => answer === null)) continue
        const key = `${labId}:${kind}:${record.score}`
        if (!submittedAt.has(key)) newQuizzes.push({ labId: Number(labId), kind, score: record.score, total: record.answers.length })
        quizRows.push([studentId, Number(labId), kind, 1, record.score, record.answers.length, submittedAt.get(key) ?? now])
      }
    }
    await connection.query('DELETE FROM quiz_attempts WHERE student_id = ?', [studentId])
    if (quizRows.length) {
      await connection.query('INSERT INTO quiz_attempts (student_id, experiment_id, kind, attempt_no, score, total, submitted_at) VALUES ?', [quizRows])
    }

    // Badges, using the same rules as the student dashboard.
    const [previousBadges] = await connection.query('SELECT badge_id, earned_at FROM student_badges WHERE student_id = ?', [studentId])
    const earnedAt = new Map(previousBadges.map((b) => [b.badge_id, b.earned_at]))
    const earned = BADGES.filter((badge) => badge.earned(state))
    await connection.query('DELETE FROM student_badges WHERE student_id = ?', [studentId])
    if (earned.length) {
      await connection.query('INSERT INTO student_badges (student_id, badge_id, earned_at) VALUES ?', [earned.map((badge) => [studentId, badge.id, earnedAt.get(badge.id) ?? now])])
    }

    const events = [
      ...newQuizzes.map((q) => [studentId, q.labId, 'quiz_submit', `${q.kind === 'pretest' ? 'Pretest' : 'Posttest'} ${q.score}/${q.total}`, now]),
      ...newlyCleared.map(({ lab, stars }) => [studentId, lab.id, 'experiment_cleared', `${lab.title} cleared with ${stars} star${stars === 1 ? '' : 's'}`, now]),
      ...earned.filter((badge) => !earnedAt.has(badge.id)).map((badge) => [studentId, null, 'badge_earned', `Earned ${badge.name}`, now]),
    ]
    if (events.length) await connection.query('INSERT INTO activity_log (student_id, experiment_id, event, detail, created_at) VALUES ?', [events])
    await connection.query('UPDATE students SET last_active_at = ? WHERE id = ?', [now, studentId])

    await connection.commit()
    return state
  } catch (error) {
    await connection.rollback().catch(() => {})
    throw error
  } finally {
    connection.release()
  }
}
