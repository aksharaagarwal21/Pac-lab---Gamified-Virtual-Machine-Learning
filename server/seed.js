// Generates a large, realistic dataset for the faculty console: departments, faculty, ~50 students
// per class, experiment progress, quiz attempts, simulation runs, badges and an activity log.
// Deterministic: the same seed always produces the same data (dates are relative to "now").

import { BADGES } from '../src/data/achievements.js'
import { LABS } from '../src/data/labs.js'
import { gaussian, seeded } from '../src/lib/ml.js'
import { DEMO_FACULTY_PASSWORD } from './accounts.js'
import { hashPassword } from './auth.js'

const DAY = 864e5
const HOUR = 36e5
const MINUTE = 6e4

const DEPARTMENTS = [
  { code: 'AIML', name: 'Artificial Intelligence and Machine Learning', sections: ['A', 'B', 'C'], semester: 5 },
  { code: 'CSE', name: 'Computer Science and Engineering', sections: ['A', 'B', 'C'], semester: 5 },
  { code: 'DS', name: 'Data Science', sections: ['A', 'B'], semester: 5 },
  { code: 'IT', name: 'Information Technology', sections: ['A', 'B'], semester: 7 },
  { code: 'ECE', name: 'Electronics and Communication Engineering', sections: ['A', 'B'], semester: 7 },
]

const FACULTY = [
  ['Dr. Kavitha Raman', 'Professor'],
  ['Dr. Arvind Menon', 'Associate Professor'],
  ['Prof. Nisha Iyer', 'Assistant Professor'],
  ['Dr. Rahul Deshpande', 'Associate Professor'],
  ['Prof. Meera Krishnan', 'Assistant Professor'],
  ['Dr. Sanjay Kulkarni', 'Professor'],
  ['Prof. Anjali Nair', 'Assistant Professor'],
  ['Dr. Vikram Sethi', 'Associate Professor'],
  ['Prof. Deepa Subramanian', 'Assistant Professor'],
  ['Dr. Imran Qureshi', 'Associate Professor'],
  ['Prof. Lakshmi Venkatesh', 'Assistant Professor'],
  ['Dr. Rohan Mehta', 'Professor'],
  ['Prof. Farah Siddiqui', 'Assistant Professor'],
  ['Dr. Suresh Pillai', 'Associate Professor'],
]

const FIRST_NAMES = [
  'Aarav', 'Aditi', 'Aditya', 'Akash', 'Ananya', 'Anika', 'Arjun', 'Aryan', 'Avni', 'Bhavya', 'Charan', 'Deepika', 'Dev', 'Diya', 'Divya',
  'Gautam', 'Gayatri', 'Harini', 'Harsh', 'Isha', 'Ishaan', 'Jahnavi', 'Karan', 'Kavya', 'Keerthana', 'Krishna', 'Lakshmi', 'Madhav',
  'Manav', 'Meera', 'Mohit', 'Nandini', 'Naveen', 'Neha', 'Nikhil', 'Nitya', 'Pooja', 'Pranav', 'Priya', 'Rahul', 'Raj', 'Riya', 'Rohit',
  'Saanvi', 'Sahil', 'Sai', 'Sakshi', 'Sameer', 'Sanjana', 'Shreya', 'Siddharth', 'Sneha', 'Srinivas', 'Tanvi', 'Tarun', 'Uday', 'Varun',
  'Vedant', 'Vidya', 'Vikram', 'Vishnu', 'Yash', 'Zara', 'Aisha', 'Farhan', 'Sana', 'Joel', 'Maria', 'Nathan', 'Rebecca', 'Harpreet',
  'Gurleen', 'Manpreet', 'Lavanya', 'Pavithra', 'Sowmya', 'Karthik', 'Vignesh', 'Dinesh', 'Monisha', 'Swathi', 'Abhinav', 'Rakesh',
  'Ritika', 'Tejas', 'Omkar', 'Pallavi', 'Kunal', 'Anjali',
]

const LAST_NAMES = [
  'Sharma', 'Verma', 'Iyer', 'Nair', 'Menon', 'Reddy', 'Rao', 'Patel', 'Shah', 'Gupta', 'Agarwal', 'Kulkarni', 'Deshpande', 'Joshi',
  'Pillai', 'Krishnan', 'Subramanian', 'Venkatesh', 'Raman', 'Chatterjee', 'Banerjee', 'Mukherjee', 'Das', 'Ghosh', 'Bose', 'Singh',
  'Kaur', 'Gill', 'Malhotra', 'Kapoor', 'Mehta', 'Bhat', 'Hegde', 'Shetty', 'Naidu', 'Chowdary', 'Varma', 'Mishra', 'Pandey', 'Tiwari',
  'Dubey', 'Saxena', 'Srivastava', 'Yadav', 'Khan', 'Qureshi', 'Siddiqui', 'Fernandes', 'Dsouza', 'Thomas', 'George', 'Mathew', 'Jacob',
  'Kumar', 'Prasad', 'Chandran', 'Balakrishnan', 'Ramesh', 'Suresh', 'Arora', 'Bajaj', 'Sethi', 'Ahuja', 'Tandon', 'Goyal', 'Jain',
  'Rastogi', 'Sinha', 'Thakur', 'Rathore',
]

const STEP_LABELS = ['Aim', 'Theory', 'Pretest', 'Procedure', 'Simulation', 'Results & Analysis', 'Posttest', 'References']

const pct = (v) => `${(100 * Math.min(1, Math.max(0, v))).toFixed(1)}%`
const fixed = (v, d = 3) => v.toFixed(d)

// Plausible saved simulation results per experiment, better for stronger students (q from 0 to 1).
const SIMULATIONS = {
  1: (q, r) => ({ title: 'Cleaning pipeline: median imputation + scaling', metrics: [['Rows kept', pct(0.88 + 0.1 * r())], ['Test accuracy', pct(0.7 + 0.25 * q)], ['Leakage gap', `${(6 * (1.1 - q) * r()).toFixed(1)} pts`]] }),
  2: (q, r) => ({ title: 'Least-squares fit on the study-hours data', metrics: [['R²', fixed(0.55 + 0.4 * q)], ['RMSE', fixed(9 - 5 * q + r(), 2)], ['Slope', fixed(4.2 + r() * 0.6, 2)]] }),
  3: (q, r) => ({ title: '5-fold cross-validation, polynomial degree 3', metrics: [['Mean CV accuracy', pct(0.72 + 0.2 * q)], ['Fold std', fixed(0.02 + 0.05 * r())], ['Test accuracy', pct(0.7 + 0.22 * q)]] }),
  4: (q, r) => ({ title: 'Logistic regression at threshold 0.50', metrics: [['Accuracy', pct(0.74 + 0.2 * q)], ['F1', fixed(0.68 + 0.25 * q)], ['AUC', fixed(0.8 + 0.17 * q + 0.02 * r())]] }),
  5: (q, r) => ({ title: 'Projection onto PC1 (standardized)', metrics: [['Variance captured', pct(0.7 + 0.23 * q)], ['PC1 explains', pct(0.9 + 0.03 * r())], ['Reconstruction MSE', fixed(0.3 - 0.2 * q, 4)]] }),
  6: (q, r) => ({ title: 'RBF SVM on concentric circles', metrics: [['Training accuracy', pct(0.9 + 0.1 * q)], ['Test accuracy', pct(0.78 + 0.18 * q)], ['Support vectors', String(Math.round(18 + 30 * r()))]] }),
  7: (q, r) => ({ title: 'K-means with k = 4 (k-means++)', metrics: [['Inertia (WCSS)', fixed(42.8 + 140 * (1 - q) * r(), 1)], ['Silhouette', fixed(0.45 + 0.29 * q)], ['Iterations', String(Math.round(1 + 6 * r()))]] }),
  8: (q, r) => ({ title: 'Decision tree, max depth 3', metrics: [['Training accuracy', pct(0.85 + 0.14 * q)], ['Test accuracy', pct(0.76 + 0.2 * q)], ['Leaves', String(Math.round(4 + 10 * r()))]] }),
  9: (q, r) => ({ title: 'Random forest with 50 trees', metrics: [['Forest test accuracy', pct(0.78 + 0.1 * q)], ['Single tree test accuracy', pct(0.72 + 0.08 * q)], ['Out-of-bag accuracy', pct(0.75 + 0.08 * q)]] }),
  10: (q, r) => ({ title: 'Perceptron on two separable groups', metrics: [['Epochs', String(Math.round(3 + 12 * (1 - q) * r()))], ['Training accuracy', pct(0.9 + 0.1 * q)], ['Learning rate η', fixed(0.1, 2)]] }),
}

const starsFor = (ratio) => (ratio >= 0.9 ? 3 : ratio >= 0.7 ? 2 : 1)

export function buildDataset(now = new Date()) {
  const random = seeded(20260914)
  const between = (lo, hi) => lo + random() * (hi - lo)
  const int = (lo, hi) => Math.floor(between(lo, hi + 1))
  const pick = (list) => list[Math.floor(random() * list.length)]
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
  const noise = () => gaussian(random)

  const NOW = new Date(now)
  NOW.setSeconds(0, 0)
  const SEMESTER_START = new Date(NOW.getTime() - 76 * DAY)
  const at = (ms) => new Date(Math.min(ms, NOW.getTime()))
  const passwordHash = hashPassword(DEMO_FACULTY_PASSWORD)

  const departments = DEPARTMENTS.map((d, i) => [i + 1, d.code, d.name])
  const experiments = LABS.map((lab) => [lab.id, lab.title, lab.mission, lab.tier, lab.xp, Boolean(lab.final)])
  const badges = BADGES.map((badge, i) => [badge.id, badge.name, badge.goal, badge.icon, i + 1])

  // Classes and their advisors. FAC-ML-014 (the login form's example ID) advises AIML-A.
  const classSpecs = DEPARTMENTS.flatMap((d, di) => d.sections.map((section) => ({ department: d, departmentId: di + 1, section })))
  const facultyIds = FACULTY.map((_, i) => `FAC-ML-${String(i + 1).padStart(3, '0')}`)
  const advisorFor = (classIndex) => facultyIds[(classIndex + 13) % facultyIds.length]
  const facultyDepartment = new Map()
  classSpecs.forEach((spec, i) => {
    if (!facultyDepartment.has(advisorFor(i))) facultyDepartment.set(advisorFor(i), spec.departmentId)
  })
  const faculty = FACULTY.map(([name, designation], i) => {
    const id = facultyIds[i]
    const local = name.replace(/^(Dr|Prof)\.\s*/, '').toLowerCase().replace(/[^a-z]+/g, '.')
    return [id, name, `${local}@faculty.paclab.test`, facultyDepartment.get(id) ?? 1, designation, passwordHash]
  })
  const classes = classSpecs.map((spec, i) => [
    i + 1,
    `${spec.department.code}-${spec.section}`,
    spec.departmentId,
    spec.section,
    spec.department.semester,
    '2026-27',
    advisorFor(i),
    `${spec.department.code === 'ECE' ? 'EB' : 'TP'}-${int(1, 4)}${String(int(1, 20)).padStart(2, '0')}`,
  ])

  const students = []
  const progress = []
  const quizzes = []
  const simulations = []
  const studentBadges = []
  const activity = []
  const usedEmails = new Set()
  let sequence = 0

  classSpecs.forEach((spec, classIndex) => {
    const classId = classIndex + 1
    const classShift = between(-0.12, 0.12)
    const size = int(46, 54)

    for (let k = 0; k < size; k++) {
      sequence++
      const id = `ML-2026-${String(sequence).padStart(3, '0')}`
      const first = pick(FIRST_NAMES)
      const last = pick(LAST_NAMES)
      let email = `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '')
      if (usedEmails.has(email)) email = `${email}${sequence}`
      usedEmails.add(email)

      const enrolled = new Date(SEMESTER_START.getTime() - int(0, 5) * DAY)
      const engagement = clamp(random() * 0.75 + classShift + random() * 0.3, 0.02, 1)
      const skill = clamp(0.35 + random() * 0.6 + (engagement - 0.5) * 0.15, 0.3, 0.98)
      const neverStarted = random() < 0.04
      const dropout = !neverStarted && random() < 0.08
      const target = Math.round(clamp(engagement * 11 + (random() - 0.5) * 3, 1, 10))
      const lastActiveGoal = dropout
        ? SEMESTER_START.getTime() + between(0.25, 0.75) * (NOW - SEMESTER_START)
        : NOW.getTime() - between(0, 1) * (12 * (1 - engagement) + 0.4) * DAY
      let lastActive = null
      const log = (experimentId, event, detail, time) => {
        const when = at(time)
        activity.push([id, experimentId, event, detail, when])
        if (!lastActive || when > lastActive) lastActive = when
      }

      // Study sessions (a login followed by a few steps) on random days between two moments.
      const sessions = (experimentId, from, to) => {
        for (let day = from - (from % DAY); day < to; day += DAY) {
          if (random() > 0.3 + 0.6 * engagement) continue
          let time = Math.max(from + 10 * MINUTE, day + between(8, 22) * HOUR)
          if (time > to) break
          log(experimentId, 'login', 'Signed in', time)
          for (let s = int(1, 5); s > 0; s--) {
            time += between(4, 25) * MINUTE
            if (time > to) break
            log(experimentId, 'open_step', experimentId ? `Opened ${pick(STEP_LABELS)}` : 'Reviewed the dashboard', time)
          }
        }
      }

      const earned = new Map()
      const earn = (badgeId, time) => {
        if (!earned.has(badgeId)) earned.set(badgeId, at(time))
      }

      let clock = SEMESTER_START.getTime() + between(0.5, 8) * DAY
      let cleared = 0
      let coins = 0

      for (const lab of LABS) {
        if (neverStarted || clock >= lastActiveGoal) break
        const duration = Math.max(0.8, between(2.5, 9) * (1.35 - engagement)) * DAY
        const started = clock
        const finish = started + duration
        earn('first-steps', started + 20 * MINUTE)

        if (lab.id > target || finish > lastActiveGoal) {
          // The experiment this student is working on now.
          const until = Math.max(started + HOUR, lastActiveGoal)
          const steps = int(0, 7)
          sessions(lab.id, started, until)
          if (steps >= 3) {
            const score = clamp(Math.round(20 * (0.2 + 0.4 * skill) + noise() * 2.5), 2, 19)
            const time = started + 0.3 * (until - started)
            quizzes.push([id, lab.id, 'pretest', 1, score, 20, at(time)])
            log(lab.id, 'quiz_submit', `Pretest ${score}/20`, time)
          }
          if (steps >= 5 && random() < 0.6) {
            const run = SIMULATIONS[lab.id](skill, random)
            const time = started + 0.6 * (until - started)
            simulations.push([id, lab.id, run.title, JSON.stringify(run.metrics.map(([label, value]) => ({ label, value }))), at(time)])
            log(lab.id, 'simulation_saved', run.title, time)
            earn('scientist', time)
          }
          if (steps >= 7 && random() < 0.5) {
            const score = int(4, 9)
            const time = until - 30 * MINUTE
            quizzes.push([id, lab.id, 'posttest', 1, score, 20, at(time)])
            log(lab.id, 'quiz_submit', `Posttest ${score}/20 (not cleared)`, time)
          }
          progress.push([id, lab.id, steps ? 'in_progress' : 'ready', steps, 0, 0, 0, Math.round(steps * between(4, 10)), at(started), null])
          break
        }

        // A cleared experiment: pretest, simulations, one or more posttest attempts.
        sessions(lab.id, started, finish)
        const pretest = clamp(Math.round(20 * (0.2 + 0.4 * skill) + noise() * 2.5), 2, 19)
        quizzes.push([id, lab.id, 'pretest', 1, pretest, 20, at(started + 0.2 * duration)])
        log(lab.id, 'quiz_submit', `Pretest ${pretest}/20`, started + 0.2 * duration)

        for (let run = int(1, 4); run > 0; run--) {
          const sim = SIMULATIONS[lab.id](skill, random)
          const time = started + between(0.35, 0.65) * duration
          simulations.push([id, lab.id, sim.title, JSON.stringify(sim.metrics.map(([label, value]) => ({ label, value }))), at(time)])
          log(lab.id, 'simulation_saved', sim.title, time)
          earn('scientist', time)
        }

        const attempts = [clamp(Math.round(20 * (0.42 + 0.52 * skill) + noise() * 2.5), 4, 20)]
        while (attempts[attempts.length - 1] < 10) {
          const next = Math.min(20, attempts[attempts.length - 1] + int(2, 6))
          attempts.push(attempts.length === 2 ? Math.max(10, next) : next)
        }
        attempts.forEach((score, i) => {
          const time = started + duration * (0.75 + (0.25 * (i + 1)) / attempts.length) - 5 * MINUTE
          quizzes.push([id, lab.id, 'posttest', i + 1, score, 20, at(time)])
          log(lab.id, 'quiz_submit', `Posttest ${score}/20${score < 10 ? ' (not cleared)' : ''}`, time)
          if (score === 20) earn('quiz-ace', time)
        })

        const best = Math.max(...attempts)
        const stars = starsFor(best / 20)
        cleared++
        coins += stars * 10
        progress.push([id, lab.id, 'cleared', 8, stars, lab.xp, stars * 10, Math.round(between(35, 120) * (1.2 - 0.4 * skill)), at(started), at(finish)])
        log(lab.id, 'experiment_cleared', `${lab.title} cleared with ${stars} star${stars === 1 ? '' : 's'}`, finish)
        if (cleared === 1) earn('first-clear', finish)
        if (stars === 3) earn('perfect-run', finish)
        if (cleared === 5) earn('halfway', finish)
        if (coins >= 150) earn('collector', finish)
        if (cleared === LABS.length) earn('legend', finish)

        clock = finish + between(0.2, 2.5) * DAY
        if (cleared === LABS.length) sessions(null, clock, lastActiveGoal)
      }

      earned.forEach((time, badgeId) => {
        studentBadges.push([id, badgeId, time])
        const badge = BADGES.find((b) => b.id === badgeId)
        log(null, 'badge_earned', `Earned ${badge.name}`, time.getTime() + MINUTE)
      })

      students.push([id, classId, first, last, `${email}@students.paclab.test`, enrolled, lastActive])
    }
  })

  return [
    { table: 'departments', columns: ['id', 'code', 'name'], rows: departments },
    { table: 'faculty', columns: ['id', 'full_name', 'email', 'department_id', 'designation', 'password_hash'], rows: faculty },
    { table: 'classes', columns: ['id', 'code', 'department_id', 'section', 'semester', 'academic_year', 'advisor_id', 'room'], rows: classes },
    { table: 'experiments', columns: ['id', 'title', 'mission', 'tier', 'xp', 'is_final'], rows: experiments },
    { table: 'badges', columns: ['id', 'name', 'goal', 'icon', 'sort_order'], rows: badges },
    { table: 'students', columns: ['id', 'class_id', 'first_name', 'last_name', 'email', 'enrolled_on', 'last_active_at'], rows: students },
    {
      table: 'experiment_progress',
      columns: ['student_id', 'experiment_id', 'status', 'steps_completed', 'stars', 'xp_earned', 'coins_earned', 'time_spent_min', 'started_at', 'cleared_at'],
      rows: progress,
    },
    { table: 'quiz_attempts', columns: ['student_id', 'experiment_id', 'kind', 'attempt_no', 'score', 'total', 'submitted_at'], rows: quizzes },
    { table: 'simulation_runs', columns: ['student_id', 'experiment_id', 'title', 'metrics', 'saved_at'], rows: simulations },
    { table: 'student_badges', columns: ['student_id', 'badge_id', 'earned_at'], rows: studentBadges },
    { table: 'activity_log', columns: ['student_id', 'experiment_id', 'event', 'detail', 'created_at'], rows: activity },
  ]
}
