// PAC-LAB API: student and faculty sign-in, saved student progress, classrooms, and class, student
// and leaderboard data from MySQL. The app is shared by the local server (server/index.js) and the
// Vercel serverless function (api/index.js).

import 'dotenv/config'
import express from 'express'
import { createSession, endSession, hashPassword, readSession, verifyPassword } from './auth.js'
import { classroomPreview, facultyClassrooms, studentClassrooms } from './classrooms.js'
import { pool } from './db.js'
import { normalizeRegistration, registrationError } from '../src/lib/registration.js'
import { loadState, saveState } from './studentSync.js'

const app = express()
app.use(express.json({ limit: '200kb' }))

const route = (handler) => (req, res, next) => Promise.resolve(handler(req, res)).catch(next)
const DAY = 864e5

const requireSession = (role) => (req, res, next) => {
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '')
  const session = readSession(token, role)
  if (!session) {
    res.status(401).json({ error: 'Your session has ended. Please sign in again.' })
    return
  }
  req.userId = session.id
  req.token = token
  next()
}

app.get('/api/health', route(async (req, res) => {
  await pool.query('SELECT 1')
  res.json({ ok: true })
}))

// ---------- students: sign-in and saved progress ----------

app.post('/api/student/login', route(async (req, res) => {
  const id = String(req.body?.studentId ?? '').trim().toUpperCase()
  const password = String(req.body?.password ?? '')
  const [[student]] = await pool.query(
    `SELECT s.id, s.first_name, s.last_name, s.password_hash, c.code AS class_code
     FROM students s JOIN classes c ON c.id = s.class_id WHERE s.id = ?`,
    [id],
  )
  if (!student?.password_hash || !verifyPassword(password, student.password_hash)) {
    res.status(401).json({ error: 'Roll number or password is incorrect.' })
    return
  }
  await pool.query('UPDATE students SET last_active_at = NOW() WHERE id = ?', [id])
  await pool.query(`INSERT INTO activity_log (student_id, event, detail, created_at) VALUES (?, 'login', 'Signed in', NOW())`, [id])
  res.json({
    token: createSession('student', id),
    student: { id, name: `${student.first_name} ${student.last_name}`, className: student.class_code },
    state: await loadState(pool, id),
  })
}))

// ---------- students: registration ----------

// Classes a new student can join (shown on the registration page).
app.get('/api/student/classes', route(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT c.code, c.section, c.semester, d.name AS department
     FROM classes c JOIN departments d ON d.id = c.department_id ORDER BY d.name, c.section`,
  )
  res.json({ classes: rows.map((c) => ({ code: c.code, department: c.department, section: c.section, semester: c.semester })) })
}))

app.post('/api/student/register', route(async (req, res) => {
  const form = normalizeRegistration(req.body)
  const invalid = registrationError(form)
  if (invalid) {
    res.status(400).json({ error: invalid })
    return
  }

  const [[cls]] = await pool.query('SELECT id, code FROM classes WHERE code = ?', [form.classCode])
  if (!cls) {
    res.status(400).json({ error: 'Please choose your class from the list.' })
    return
  }
  const [[taken]] = await pool.query(
    'SELECT (SELECT COUNT(*) FROM students WHERE id = ?) AS id_taken, (SELECT COUNT(*) FROM students WHERE email = ?) AS email_taken',
    [form.studentId, form.email],
  )
  if (taken.id_taken) {
    res.status(409).json({ error: 'This roll number is already registered. Sign in instead.' })
    return
  }
  if (taken.email_taken) {
    res.status(409).json({ error: 'This email is already registered to another roll number.' })
    return
  }

  try {
    await pool.query(
      `INSERT INTO students (id, class_id, first_name, last_name, email, password_hash, enrolled_on, last_active_at)
       VALUES (?, ?, ?, ?, ?, ?, CURDATE(), NOW())`,
      [form.studentId, cls.id, form.firstName, form.lastName, form.email, hashPassword(form.password)],
    )
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'This roll number or email is already registered. Sign in instead.' })
      return
    }
    throw error
  }
  await pool.query(`INSERT INTO activity_log (student_id, event, detail, created_at) VALUES (?, 'login', 'Registered and signed in', NOW())`, [form.studentId])

  res.status(201).json({
    token: createSession('student', form.studentId),
    student: { id: form.studentId, name: `${form.firstName} ${form.lastName}`, className: cls.code },
    state: null,
  })
}))

// What a classroom join link shows before the student signs in.
app.get('/api/student/join/:code', classroomPreview)

app.use('/api/student', requireSession('student'))

app.get('/api/student/state', route(async (req, res) => {
  res.json({ state: await loadState(pool, req.userId) })
}))

app.put('/api/student/state', route(async (req, res) => {
  if (!req.body?.state || typeof req.body.state !== 'object') {
    res.status(400).json({ error: 'Missing progress data.' })
    return
  }
  const state = await saveState(pool, req.userId, req.body.state)
  res.json({ ok: true, savedAt: state.savedAt })
}))

app.post('/api/student/logout', (req, res) => {
  endSession(req.token)
  res.json({ ok: true })
})

// Classrooms the student joined, and joining or leaving one (server/classrooms.js).
app.use('/api/student', studentClassrooms)

// ---------- faculty: shared queries ----------

const STUDENT_STATS = `
  SELECT v.id, v.class_id, v.first_name, v.last_name, v.email, v.last_active_at,
         v.xp, v.coins, v.stars, v.cleared, v.current_experiment,
         post.avg_post, pre.avg_pre, COALESCE(fail.failed_current, 0) AS failed_current
  FROM v_student_summary v
  LEFT JOIN (
    SELECT student_id, AVG(best) AS avg_post
    FROM (
      SELECT student_id, experiment_id, MAX(score / total) AS best
      FROM quiz_attempts WHERE kind = 'posttest'
      GROUP BY student_id, experiment_id
    ) b
    GROUP BY student_id
  ) post ON post.student_id = v.id
  LEFT JOIN (
    SELECT student_id, AVG(score / total) AS avg_pre FROM quiz_attempts WHERE kind = 'pretest' GROUP BY student_id
  ) pre ON pre.student_id = v.id
  LEFT JOIN (
    SELECT q.student_id, COUNT(*) AS failed_current
    FROM quiz_attempts q
    JOIN experiment_progress p ON p.student_id = q.student_id AND p.experiment_id = q.experiment_id AND p.status <> 'cleared'
    WHERE q.kind = 'posttest' AND q.score * 2 < q.total
    GROUP BY q.student_id
  ) fail ON fail.student_id = v.id`

const median = (values) => {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

// Excelling / on track / needs attention / inactive, judged against the student's own class.
function statusFor(student, classMedianCleared) {
  const idleDays = student.last_active_at ? (Date.now() - new Date(student.last_active_at).getTime()) / DAY : Infinity
  if (student.cleared >= 10 || (student.cleared >= 8 && (student.avg_post ?? 0) >= 0.85)) return 'excelling'
  if (idleDays >= 14) return 'inactive'
  if (student.failed_current > 0 || (student.avg_post !== null && student.avg_post < 0.6) || student.cleared <= classMedianCleared - 3) return 'attention'
  return 'on_track'
}

function shapeStudent(row, rank, classMedianCleared) {
  return {
    id: row.id,
    name: `${row.first_name} ${row.last_name}`,
    email: row.email,
    rank,
    xp: row.xp,
    coins: row.coins,
    stars: row.stars,
    cleared: row.cleared,
    currentExperiment: row.current_experiment ?? (row.cleared < 10 ? row.cleared + 1 : null),
    started: row.current_experiment !== null || row.cleared > 0,
    avgPosttest: row.avg_post,
    avgPretest: row.avg_pre,
    failedCurrent: row.failed_current,
    lastActiveAt: row.last_active_at,
    status: statusFor(row, classMedianCleared),
  }
}

const dayKeys = (days) =>
  Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.now() - (days - 1 - i) * DAY)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })

// ---------- faculty: sign-in ----------

app.post('/api/faculty/login', route(async (req, res) => {
  const id = String(req.body?.facultyId ?? '').trim().toUpperCase()
  const password = String(req.body?.password ?? '')
  const [[faculty]] = await pool.query(
    `SELECT f.id, f.full_name, f.email, f.designation, f.password_hash, d.code AS department
     FROM faculty f JOIN departments d ON d.id = f.department_id WHERE f.id = ?`,
    [id],
  )
  if (!faculty || !verifyPassword(password, faculty.password_hash)) {
    res.status(401).json({ error: 'Faculty ID or password is incorrect.' })
    return
  }
  res.json({
    token: createSession('faculty', faculty.id),
    faculty: { id: faculty.id, name: faculty.full_name, email: faculty.email, designation: faculty.designation, department: faculty.department },
  })
}))

app.use('/api/faculty', requireSession('faculty'))

app.post('/api/faculty/logout', (req, res) => {
  endSession(req.token)
  res.json({ ok: true })
})

// Classrooms the teacher opened for their sections, with invites and rosters (server/classrooms.js).
app.use('/api/faculty/classrooms', facultyClassrooms)

// ---------- faculty: overview of every class ----------

app.get('/api/faculty/overview', route(async (req, res) => {
  const [classes] = await pool.query(`
    SELECT c.id, c.code, c.section, c.semester, c.academic_year, c.room,
           d.code AS department_code, d.name AS department_name,
           f.id AS advisor_id, f.full_name AS advisor_name,
           COUNT(v.id) AS students,
           COALESCE(ROUND(AVG(v.xp)), 0) AS avg_xp,
           COALESCE(ROUND(AVG(v.cleared), 1), 0) AS avg_cleared,
           COALESCE(SUM(v.cleared), 0) AS total_cleared,
           COALESCE(SUM(v.cleared = 10), 0) AS finished,
           COALESCE(SUM(v.last_active_at >= NOW() - INTERVAL 7 DAY), 0) AS active_week,
           COALESCE(SUM(v.last_active_at IS NULL OR v.last_active_at < NOW() - INTERVAL 14 DAY), 0) AS inactive
    FROM classes c
    JOIN departments d ON d.id = c.department_id
    JOIN faculty f ON f.id = c.advisor_id
    LEFT JOIN v_student_summary v ON v.class_id = c.id
    GROUP BY c.id, d.id, f.id
    ORDER BY d.id, c.section`)

  const [posttest] = await pool.query(`
    SELECT s.class_id, AVG(b.best) AS avg_post
    FROM (SELECT student_id, experiment_id, MAX(score / total) AS best FROM quiz_attempts WHERE kind = 'posttest' GROUP BY student_id, experiment_id) b
    JOIN students s ON s.id = b.student_id
    GROUP BY s.class_id`)

  const [tops] = await pool.query(`
    SELECT class_id, id, first_name, last_name, xp FROM (
      SELECT v.*, ROW_NUMBER() OVER (PARTITION BY v.class_id ORDER BY v.xp DESC, v.stars DESC, v.id) AS position
      FROM v_student_summary v
    ) ranked WHERE position = 1`)

  const [[totals]] = await pool.query(`
    SELECT (SELECT COUNT(*) FROM quiz_attempts) AS quiz_attempts,
           (SELECT COUNT(*) FROM simulation_runs) AS simulation_runs,
           (SELECT COUNT(*) FROM activity_log WHERE created_at >= NOW() - INTERVAL 7 DAY) AS events_week`)

  // Students who need attention or are inactive, across every class.
  const [allStudents] = await pool.query(`${STUDENT_STATS} ORDER BY v.class_id`)
  const rowsByClass = new Map()
  allStudents.forEach((row) => {
    if (!rowsByClass.has(row.class_id)) rowsByClass.set(row.class_id, [])
    rowsByClass.get(row.class_id).push(row)
  })
  const classById = new Map(classes.map((c) => [c.id, c]))
  const alerts = []
  rowsByClass.forEach((rows, classId) => {
    const classMedian = median(rows.map((row) => row.cleared))
    rows.forEach((row) => {
      const student = shapeStudent(row, 0, classMedian)
      if (student.status !== 'attention' && student.status !== 'inactive') return
      const reasons = []
      if (student.failedCurrent > 0) reasons.push('failed')
      if (student.status === 'inactive') reasons.push('inactive')
      if (row.cleared <= classMedian - 3) reasons.push('behind')
      if (student.avgPosttest !== null && student.avgPosttest < 0.6) reasons.push('low_scores')
      alerts.push({
        id: student.id,
        name: student.name,
        className: classById.get(classId)?.code,
        isMine: classById.get(classId)?.advisor_id === req.userId,
        status: student.status,
        reasons,
        cleared: student.cleared,
        currentExperiment: student.currentExperiment,
        started: student.started,
        avgPosttest: student.avgPosttest,
        lastActiveAt: student.lastActiveAt,
      })
    })
  })
  alerts.sort(
    (a, b) =>
      Number(b.reasons.includes('failed')) - Number(a.reasons.includes('failed')) ||
      new Date(a.lastActiveAt ?? 0) - new Date(b.lastActiveAt ?? 0),
  )

  const postByClass = new Map(posttest.map((row) => [row.class_id, row.avg_post]))
  const topByClass = new Map(tops.map((row) => [row.class_id, { id: row.id, name: `${row.first_name} ${row.last_name}`, xp: row.xp }]))
  const shaped = classes.map((c) => ({
    code: c.code,
    department: c.department_code,
    departmentName: c.department_name,
    section: c.section,
    semester: c.semester,
    academicYear: c.academic_year,
    room: c.room,
    advisor: { id: c.advisor_id, name: c.advisor_name },
    isMine: c.advisor_id === req.userId,
    students: c.students,
    avgXp: c.avg_xp,
    avgCleared: c.avg_cleared,
    totalCleared: c.total_cleared,
    finished: c.finished,
    activeWeek: c.active_week,
    inactive: c.inactive,
    avgPosttest: postByClass.get(c.id) ?? null,
    topStudent: topByClass.get(c.id) ?? null,
  }))
  const students = shaped.reduce((sum, c) => sum + c.students, 0)

  res.json({
    academicYear: shaped[0]?.academicYear ?? '',
    totals: {
      classes: shaped.length,
      students,
      avgXp: students ? Math.round(shaped.reduce((sum, c) => sum + c.avgXp * c.students, 0) / students) : 0,
      experimentsCleared: shaped.reduce((sum, c) => sum + c.totalCleared, 0),
      activeWeek: shaped.reduce((sum, c) => sum + c.activeWeek, 0),
      quizAttempts: totals.quiz_attempts,
      simulationRuns: totals.simulation_runs,
      eventsWeek: totals.events_week,
    },
    classes: shaped,
    alerts,
  })
}))

// ---------- faculty: quick search for students and classes ----------

app.get('/api/faculty/search', route(async (req, res) => {
  const query = String(req.query.q ?? '').trim().slice(0, 60)
  if (query.length < 2) {
    res.json({ students: [], classes: [] })
    return
  }
  const like = `%${query.replace(/[\\%_]/g, (character) => `\\${character}`)}%`
  const [students] = await pool.query(
    `SELECT s.id, s.first_name, s.last_name, c.code AS class_code
     FROM students s JOIN classes c ON c.id = s.class_id
     WHERE s.id LIKE ? OR CONCAT(s.first_name, ' ', s.last_name) LIKE ?
     ORDER BY s.first_name, s.last_name LIMIT 8`,
    [like, like],
  )
  const [classes] = await pool.query(
    `SELECT c.code, d.name AS department_name FROM classes c JOIN departments d ON d.id = c.department_id
     WHERE c.code LIKE ? OR d.name LIKE ? ORDER BY c.code LIMIT 5`,
    [like, like],
  )
  res.json({
    students: students.map((s) => ({ id: s.id, name: `${s.first_name} ${s.last_name}`, className: s.class_code })),
    classes: classes.map((c) => ({ code: c.code, departmentName: c.department_name })),
  })
}))

// ---------- faculty: one class (students, leaderboard, experiments, activity) ----------

app.get('/api/faculty/classes/:code', route(async (req, res) => {
  const [[info]] = await pool.query(
    `SELECT c.id, c.code, c.section, c.semester, c.academic_year, c.room,
            d.code AS department_code, d.name AS department_name,
            f.id AS advisor_id, f.full_name AS advisor_name, f.email AS advisor_email, f.designation AS advisor_designation
     FROM classes c JOIN departments d ON d.id = c.department_id JOIN faculty f ON f.id = c.advisor_id
     WHERE c.code = ?`,
    [String(req.params.code).toUpperCase()],
  )
  if (!info) {
    res.status(404).json({ error: 'Class not found.' })
    return
  }

  const [rows] = await pool.query(`${STUDENT_STATS} WHERE v.class_id = ? ORDER BY v.xp DESC, v.stars DESC, v.id`, [info.id])
  const classMedian = median(rows.map((row) => row.cleared))
  const students = rows.map((row, index) => shapeStudent(row, index + 1, classMedian))

  const [experiments] = await pool.query(
    `SELECT e.id, e.title, e.mission, e.tier,
            COALESCE(SUM(p.status = 'cleared'), 0) AS cleared,
            COALESCE(SUM(p.status IN ('ready', 'in_progress')), 0) AS working,
            ROUND(AVG(CASE WHEN p.status = 'cleared' THEN p.stars END), 2) AS avg_stars,
            ROUND(AVG(CASE WHEN p.status = 'cleared' THEN p.time_spent_min END)) AS avg_minutes
     FROM experiments e
     LEFT JOIN experiment_progress p ON p.experiment_id = e.id AND p.student_id IN (SELECT id FROM students WHERE class_id = ?)
     GROUP BY e.id ORDER BY e.id`,
    [info.id],
  )
  const [quizzes] = await pool.query(
    `SELECT q.experiment_id,
            AVG(CASE WHEN q.kind = 'pretest' THEN q.score / q.total END) AS pretest,
            AVG(CASE WHEN q.kind = 'posttest' AND q.score * 2 >= q.total THEN q.score / q.total END) AS posttest
     FROM quiz_attempts q JOIN students s ON s.id = q.student_id
     WHERE s.class_id = ? GROUP BY q.experiment_id`,
    [info.id],
  )
  const [daily] = await pool.query(
    `SELECT DATE_FORMAT(a.created_at, '%Y-%m-%d') AS day, COUNT(*) AS events, COUNT(DISTINCT a.student_id) AS students
     FROM activity_log a JOIN students s ON s.id = a.student_id
     WHERE s.class_id = ? AND a.created_at >= CURDATE() - INTERVAL 27 DAY
     GROUP BY day`,
    [info.id],
  )

  const quizByExperiment = new Map(quizzes.map((row) => [row.experiment_id, row]))
  const dailyByDay = new Map(daily.map((row) => [row.day, row]))

  res.json({
    class: {
      code: info.code,
      department: info.department_code,
      departmentName: info.department_name,
      section: info.section,
      semester: info.semester,
      academicYear: info.academic_year,
      room: info.room,
      advisor: { id: info.advisor_id, name: info.advisor_name, email: info.advisor_email, designation: info.advisor_designation },
      isMine: info.advisor_id === req.userId,
    },
    students,
    experiments: experiments.map((e) => ({
      id: e.id,
      title: e.title,
      mission: e.mission,
      tier: e.tier,
      cleared: e.cleared,
      working: e.working,
      avgStars: e.avg_stars,
      avgMinutes: e.avg_minutes,
      avgPretest: quizByExperiment.get(e.id)?.pretest ?? null,
      avgPosttest: quizByExperiment.get(e.id)?.posttest ?? null,
    })),
    activity: dayKeys(28).map((day) => ({ day, events: dailyByDay.get(day)?.events ?? 0, students: dailyByDay.get(day)?.students ?? 0 })),
  })
}))

// ---------- faculty: one student (the student's dashboard as faculty see it) ----------

app.get('/api/faculty/students/:id', route(async (req, res) => {
  const id = String(req.params.id).toUpperCase()
  const [[row]] = await pool.query(`${STUDENT_STATS} WHERE v.id = ?`, [id])
  if (!row) {
    res.status(404).json({ error: 'Student not found.' })
    return
  }

  const [[info]] = await pool.query(
    `SELECT c.code, c.semester, c.academic_year, d.code AS department_code, d.name AS department_name, f.full_name AS advisor_name, s.enrolled_on
     FROM students s JOIN classes c ON c.id = s.class_id JOIN departments d ON d.id = c.department_id JOIN faculty f ON f.id = c.advisor_id
     WHERE s.id = ?`,
    [id],
  )
  const [classmates] = await pool.query('SELECT id, cleared FROM v_student_summary WHERE class_id = ? ORDER BY xp DESC, stars DESC, id', [row.class_id])
  const [[overall]] = await pool.query(
    `SELECT (SELECT COUNT(*) FROM v_student_summary WHERE xp > ?) + 1 AS position, (SELECT COUNT(*) FROM students) AS total`,
    [row.xp],
  )
  const classRank = classmates.findIndex((mate) => mate.id === id) + 1
  const student = shapeStudent(row, classRank, median(classmates.map((mate) => mate.cleared)))

  const [experiments] = await pool.query(
    `SELECT e.id, e.title, e.mission, e.tier, e.xp, p.status, p.steps_completed, p.stars, p.time_spent_min, p.started_at, p.cleared_at,
            (SELECT MAX(q.score) FROM quiz_attempts q WHERE q.student_id = ? AND q.experiment_id = e.id AND q.kind = 'pretest') AS pretest,
            (SELECT MAX(q.score) FROM quiz_attempts q WHERE q.student_id = ? AND q.experiment_id = e.id AND q.kind = 'posttest') AS posttest,
            (SELECT COUNT(*) FROM quiz_attempts q WHERE q.student_id = ? AND q.experiment_id = e.id AND q.kind = 'posttest') AS posttest_attempts
     FROM experiments e
     LEFT JOIN experiment_progress p ON p.experiment_id = e.id AND p.student_id = ?
     ORDER BY e.id`,
    [id, id, id, id],
  )
  const [badges] = await pool.query(
    `SELECT b.id, b.name, b.goal, b.icon, sb.earned_at FROM badges b
     LEFT JOIN student_badges sb ON sb.badge_id = b.id AND sb.student_id = ?
     ORDER BY b.sort_order`,
    [id],
  )
  const [activity] = await pool.query(
    `SELECT a.event, a.detail, a.created_at, a.experiment_id FROM activity_log a
     WHERE a.student_id = ? AND a.event <> 'open_step'
     ORDER BY a.created_at DESC LIMIT 25`,
    [id],
  )
  const [quizzes] = await pool.query(
    `SELECT q.experiment_id, e.title, q.kind, q.attempt_no, q.score, q.total, q.submitted_at
     FROM quiz_attempts q JOIN experiments e ON e.id = q.experiment_id
     WHERE q.student_id = ? ORDER BY q.submitted_at DESC LIMIT 40`,
    [id],
  )
  const [simulations] = await pool.query(
    `SELECT r.experiment_id, r.title, r.metrics, r.saved_at FROM simulation_runs r WHERE r.student_id = ? ORDER BY r.saved_at DESC LIMIT 8`,
    [id],
  )
  const [heat] = await pool.query(
    `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day, COUNT(*) AS events FROM activity_log
     WHERE student_id = ? AND created_at >= CURDATE() - INTERVAL 55 DAY GROUP BY day`,
    [id],
  )
  const heatByDay = new Map(heat.map((h) => [h.day, h.events]))

  res.json({
    student: {
      ...student,
      className: info.code,
      departmentName: info.department_name,
      semester: info.semester,
      advisor: info.advisor_name,
      enrolledOn: info.enrolled_on,
      classSize: classmates.length,
      overallRank: overall.position,
      overallTotal: overall.total,
    },
    experiments: experiments.map((e) => ({
      id: e.id,
      title: e.title,
      mission: e.mission,
      xp: e.xp,
      status: e.status ?? 'locked',
      steps: e.steps_completed ?? 0,
      stars: e.stars ?? 0,
      minutes: e.time_spent_min ?? 0,
      startedAt: e.started_at,
      clearedAt: e.cleared_at,
      pretest: e.pretest,
      posttest: e.posttest,
      posttestAttempts: e.posttest_attempts,
    })),
    badges: badges.map((b) => ({ id: b.id, name: b.name, goal: b.goal, icon: b.icon, earnedAt: b.earned_at })),
    activity: activity.map((a) => ({ event: a.event, detail: a.detail, at: a.created_at, day: a.day, experimentId: a.experiment_id })),
    quizzes: quizzes.map((q) => ({ experimentId: q.experiment_id, title: q.title, kind: q.kind, attempt: q.attempt_no, score: q.score, total: q.total, at: q.submitted_at })),
    simulations: simulations.map((s) => ({ experimentId: s.experiment_id, title: s.title, metrics: s.metrics, at: s.saved_at })),
    heat: dayKeys(56).map((day) => ({ day, events: heatByDay.get(day) ?? 0 })),
  })
}))

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }))

app.use((error, req, res, next) => {
  console.error(error)
  if (res.headersSent) return next(error)
  const offline = ['ECONNREFUSED', 'ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR', 'ER_NO_SUCH_TABLE'].includes(error.code)
  res.status(offline ? 503 : 500).json({ error: offline ? 'The database is not ready. Run "npm run db:setup" and check .env.' : 'Something went wrong on the server.' })
})

export default app
