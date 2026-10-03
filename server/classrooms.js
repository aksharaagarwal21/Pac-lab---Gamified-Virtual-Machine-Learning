// Classrooms, like Google Classroom: a teacher opens one for a section, shares its join code or link
// and emails the invite to the section; students join from the link. A classroom accepts the students
// registered in its section plus any other email address the teacher invited.
//
// The routers are mounted in server/app.js after the sign-in checks, so req.userId is the signed-in
// faculty member (facultyClassrooms) or student (studentClassrooms).

import crypto from 'node:crypto'
import express from 'express'
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  LIMITS,
  canReceiveMail,
  classroomError,
  inviteMessage,
  isJoinCode,
  joinPath,
  normalizeClassroom,
  normalizeJoinCode,
  parseEmails,
} from '../src/lib/classrooms.js'
import { pool } from './db.js'
import { mailEnabled, sendToMany } from './mailer.js'

const route = (handler) => (req, res, next) => Promise.resolve(handler(req, res)).catch(next)

// Same definitions as server/schema.sql, for databases set up before classrooms existed.
export async function ensureClassroomTables(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS classrooms (
      id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      join_code CHAR(7) NOT NULL UNIQUE,
      name VARCHAR(80) NOT NULL,
      description VARCHAR(300) NOT NULL DEFAULT '',
      class_id SMALLINT UNSIGNED NOT NULL,
      faculty_id VARCHAR(16) NOT NULL,
      is_open BOOLEAN NOT NULL DEFAULT TRUE,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_classroom_section (faculty_id, class_id),
      CONSTRAINT fk_classroom_class FOREIGN KEY (class_id) REFERENCES classes (id),
      CONSTRAINT fk_classroom_faculty FOREIGN KEY (faculty_id) REFERENCES faculty (id) ON DELETE CASCADE
    )`)
  await db.query(`
    CREATE TABLE IF NOT EXISTS classroom_members (
      classroom_id INT UNSIGNED NOT NULL,
      student_id VARCHAR(16) NOT NULL,
      joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (classroom_id, student_id),
      INDEX idx_member_student (student_id),
      CONSTRAINT fk_member_classroom FOREIGN KEY (classroom_id) REFERENCES classrooms (id) ON DELETE CASCADE,
      CONSTRAINT fk_member_student FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE
    )`)
  await db.query(`
    CREATE TABLE IF NOT EXISTS classroom_invites (
      classroom_id INT UNSIGNED NOT NULL,
      email VARCHAR(120) NOT NULL,
      invited_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (classroom_id, email),
      CONSTRAINT fk_invite_classroom FOREIGN KEY (classroom_id) REFERENCES classrooms (id) ON DELETE CASCADE
    )`)
}

// Creates the tables (when missing) once per server instance, the first time a classroom route runs,
// so an existing database such as the hosted one needs no manual migration.
let tablesReady = null

function ready(req, res, next) {
  tablesReady ??= ensureClassroomTables(pool).catch((error) => {
    tablesReady = null
    throw error
  })
  tablesReady.then(() => next(), next)
}

const randomCode = () => Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]).join('')

// Runs write(code) with a fresh join code, retrying in the unlikely case that the code is taken.
async function withFreshCode(write) {
  for (let attempt = 1; ; attempt++) {
    const code = randomCode()
    try {
      await write(code)
      return code
    } catch (error) {
      if (error.code !== 'ER_DUP_ENTRY' || !/join_code/.test(error.sqlMessage ?? '') || attempt === 5) throw error
    }
  }
}

// Base of the join links in emails: APP_URL when set, otherwise the site the teacher is using.
function siteUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, '')
  const origin = req.get('origin')
  if (/^https?:\/\/[\w.-]+(:\d+)?$/i.test(origin ?? '')) return origin
  return `${req.get('x-forwarded-proto') ?? req.protocol}://${req.get('host')}`
}

const CLASSROOM = `
  SELECT r.id, r.join_code, r.name, r.description, r.is_open, r.created_at, r.class_id,
         c.code AS section, c.semester, d.name AS department_name,
         f.full_name AS teacher_name, f.email AS teacher_email,
         (SELECT COUNT(*) FROM classroom_members m WHERE m.classroom_id = r.id) AS members,
         (SELECT COUNT(*) FROM students s WHERE s.class_id = r.class_id) AS section_size,
         (SELECT COUNT(*) FROM classroom_invites i WHERE i.classroom_id = r.id) AS invited
  FROM classrooms r
  JOIN classes c ON c.id = r.class_id
  JOIN departments d ON d.id = c.department_id
  JOIN faculty f ON f.id = r.faculty_id`

const shapeClassroom = (row) => ({
  id: row.id,
  code: row.join_code,
  name: row.name,
  description: row.description,
  isOpen: Boolean(row.is_open),
  createdAt: row.created_at,
  section: row.section,
  semester: row.semester,
  departmentName: row.department_name,
  teacher: { name: row.teacher_name, email: row.teacher_email },
  members: row.members,
  sectionSize: row.section_size,
  invited: row.invited,
})

// What a student sees of a classroom they joined.
const studentView = (row, joinedAt) => ({
  id: row.id,
  code: row.join_code,
  name: row.name,
  description: row.description,
  section: row.section,
  departmentName: row.department_name,
  teacher: { name: row.teacher_name, email: row.teacher_email },
  members: row.members,
  joinedAt,
})

async function findByCode(value) {
  const code = normalizeJoinCode(value)
  if (!isJoinCode(code)) return null
  const [[row]] = await pool.query(`${CLASSROOM} WHERE r.join_code = ?`, [code])
  return row ?? null
}

const NO_CLASSROOM = 'No classroom has this code. Check the link or the code with your teacher.'

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`)

function inviteHtml({ name, section, teacher, link, code }) {
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#0b0f19">
  <p><strong>${escapeHtml(teacher)}</strong> invited you to join <strong>${escapeHtml(name)}</strong> (section ${escapeHtml(section)}) on PAC-LAB.</p>
  <p><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 18px;border-radius:6px;background:#f5c518;color:#0b0f19;font-weight:bold;text-decoration:none">Join the classroom</a></p>
  <p>Or open PAC-LAB, go to Classrooms and enter the class code <strong style="font-family:monospace;font-size:17px;letter-spacing:2px">${escapeHtml(code)}</strong>.</p>
  <p style="color:#555">Sign in with your roll number (or register first if you are new to PAC-LAB), then press Join.</p>
</div>`
}

// ---------- faculty ----------

export const facultyClassrooms = express.Router()
facultyClassrooms.use(ready)

// The signed-in teacher's classrooms, and the sections they can open a new one for.
facultyClassrooms.get('/', route(async (req, res) => {
  const [rows] = await pool.query(`${CLASSROOM} WHERE r.faculty_id = ? ORDER BY r.created_at DESC, r.id DESC`, [req.userId])
  const [sections] = await pool.query(
    `SELECT c.code, c.semester, d.name AS department_name, COUNT(s.id) AS students
     FROM classes c JOIN departments d ON d.id = c.department_id LEFT JOIN students s ON s.class_id = c.id
     GROUP BY c.id, d.id ORDER BY d.id, c.section`,
  )
  const taken = new Set(rows.map((row) => row.section))
  res.json({
    classrooms: rows.map(shapeClassroom),
    sections: sections.map((s) => ({ code: s.code, semester: s.semester, departmentName: s.department_name, students: s.students, taken: taken.has(s.code) })),
    mailEnabled: mailEnabled(),
  })
}))

facultyClassrooms.post('/', route(async (req, res) => {
  const form = normalizeClassroom(req.body)
  const invalid = classroomError(form)
  if (invalid) {
    res.status(400).json({ error: invalid })
    return
  }
  const [[section]] = await pool.query('SELECT id, code FROM classes WHERE code = ?', [form.classCode])
  if (!section) {
    res.status(400).json({ error: 'Choose the section from the list.' })
    return
  }
  const [[existing]] = await pool.query('SELECT name FROM classrooms WHERE faculty_id = ? AND class_id = ?', [req.userId, section.id])
  const duplicate = () => res.status(409).json({ error: `You already have a classroom for ${section.code}${existing ? `: "${existing.name}"` : ''}.` })
  if (existing) {
    duplicate()
    return
  }

  let id
  try {
    await withFreshCode(async (code) => {
      const [result] = await pool.query('INSERT INTO classrooms (join_code, name, description, class_id, faculty_id) VALUES (?, ?, ?, ?, ?)', [
        code,
        form.name,
        form.description,
        section.id,
        req.userId,
      ])
      id = result.insertId
    })
  } catch (error) {
    // A double click can race past the check above; the unique key catches it.
    if (error.code === 'ER_DUP_ENTRY') {
      duplicate()
      return
    }
    throw error
  }
  const [[row]] = await pool.query(`${CLASSROOM} WHERE r.id = ?`, [id])
  res.status(201).json({ classroom: shapeClassroom(row) })
}))

// The classroom in the URL when it belongs to the signed-in teacher; otherwise answers 404.
async function ownClassroom(req, res) {
  const id = Number(req.params.id)
  const [[row]] = await pool.query(`${CLASSROOM} WHERE r.id = ? AND r.faculty_id = ?`, [Number.isInteger(id) ? id : 0, req.userId])
  if (!row) res.status(404).json({ error: 'Classroom not found.' })
  return row
}

// Everyone the classroom concerns: the section's students, members from other sections and invited
// addresses, each marked joined, invited or not invited yet.
async function rosterFor(classroom) {
  const [students] = await pool.query(
    `SELECT s.id, s.first_name, s.last_name, s.email, s.class_id, m.joined_at, i.invited_at
     FROM students s
     LEFT JOIN classroom_members m ON m.classroom_id = ? AND m.student_id = s.id
     LEFT JOIN classroom_invites i ON i.classroom_id = ? AND i.email = s.email
     WHERE s.class_id = ? OR m.student_id IS NOT NULL`,
    [classroom.id, classroom.id, classroom.class_id],
  )
  const [invites] = await pool.query(
    `SELECT i.email, i.invited_at, s.id, s.first_name, s.last_name
     FROM classroom_invites i LEFT JOIN students s ON s.email = i.email
     WHERE i.classroom_id = ?`,
    [classroom.id],
  )
  const listed = new Set(students.map((s) => s.email))
  return [
    ...students.map((s) => ({
      id: s.id,
      name: `${s.first_name} ${s.last_name}`,
      email: s.email,
      inSection: s.class_id === classroom.class_id,
      status: s.joined_at ? 'joined' : s.invited_at ? 'invited' : 'not_invited',
      joinedAt: s.joined_at,
      invitedAt: s.invited_at,
    })),
    ...invites
      .filter((invite) => !listed.has(invite.email))
      .map((invite) => ({
        id: invite.id,
        name: invite.id ? `${invite.first_name} ${invite.last_name}` : null,
        email: invite.email,
        inSection: false,
        status: 'invited',
        joinedAt: null,
        invitedAt: invite.invited_at,
      })),
  ]
}

facultyClassrooms.get('/:id', route(async (req, res) => {
  const row = await ownClassroom(req, res)
  if (!row) return
  res.json({ classroom: shapeClassroom(row), roster: await rosterFor(row), mailEnabled: mailEnabled() })
}))

// Rename, change the description, or open / close the classroom to new students.
facultyClassrooms.patch('/:id', route(async (req, res) => {
  const row = await ownClassroom(req, res)
  if (!row) return
  const form = normalizeClassroom({ name: req.body?.name ?? row.name, description: req.body?.description ?? row.description, classCode: row.section })
  const invalid = classroomError(form)
  if (invalid) {
    res.status(400).json({ error: invalid })
    return
  }
  const isOpen = typeof req.body?.isOpen === 'boolean' ? req.body.isOpen : Boolean(row.is_open)
  await pool.query('UPDATE classrooms SET name = ?, description = ?, is_open = ? WHERE id = ?', [form.name, form.description, isOpen, row.id])
  res.json({ classroom: shapeClassroom({ ...row, name: form.name, description: form.description, is_open: isOpen }) })
}))

// A new join code: the old code and link stop working (for example after they were shared too widely).
facultyClassrooms.post('/:id/code', route(async (req, res) => {
  const row = await ownClassroom(req, res)
  if (!row) return
  const code = await withFreshCode((fresh) => pool.query('UPDATE classrooms SET join_code = ? WHERE id = ?', [fresh, row.id]))
  res.json({ code })
}))

facultyClassrooms.delete('/:id', route(async (req, res) => {
  const row = await ownClassroom(req, res)
  if (!row) return
  await pool.query('DELETE FROM classrooms WHERE id = ?', [row.id])
  res.json({ ok: true })
}))

facultyClassrooms.delete('/:id/members/:studentId', route(async (req, res) => {
  const row = await ownClassroom(req, res)
  if (!row) return
  await pool.query('DELETE FROM classroom_members WHERE classroom_id = ? AND student_id = ?', [row.id, String(req.params.studentId).toUpperCase()])
  res.json({ ok: true })
}))

// Invites the section (everyone registered in it who has not joined yet) and/or pasted addresses.
// With email set up (and send: true) the server emails them; otherwise it returns the message and
// the addresses for the teacher to send from their own email app. Either way they count as invited.
facultyClassrooms.post('/:id/invite', route(async (req, res) => {
  const row = await ownClassroom(req, res)
  if (!row) return
  const pasted = parseEmails(req.body?.emails)
  if (pasted.valid.length > LIMITS.emails) {
    res.status(400).json({ error: `Paste at most ${LIMITS.emails} addresses at a time.` })
    return
  }
  const [section] = req.body?.section ? await pool.query('SELECT email FROM students WHERE class_id = ?', [row.class_id]) : [[]]
  const [members] = await pool.query('SELECT s.email FROM classroom_members m JOIN students s ON s.id = m.student_id WHERE m.classroom_id = ?', [row.id])
  const joined = new Set(members.map((m) => m.email))
  const candidates = [...new Set([...section.map((s) => s.email), ...pasted.valid])].filter((email) => !joined.has(email))
  const recipients = candidates.filter(canReceiveMail)

  if (!recipients.length) {
    let error = 'Include the section or paste at least one email address.'
    if (candidates.length) error = `None of these ${candidates.length} addresses can receive email (they are sample accounts on a reserved test domain).`
    else if (section.length || pasted.valid.length) error = 'Everyone on this list has already joined.'
    else if (req.body?.section) error = `No students have registered in ${row.section} yet. Paste their email addresses instead.`
    res.status(400).json({ error, invalid: pasted.invalid })
    return
  }

  const link = `${siteUrl(req)}${joinPath(row.join_code)}`
  const details = { name: row.name, section: row.section, teacher: row.teacher_name, link, code: row.join_code }
  const message = inviteMessage(details)
  const send = mailEnabled() && req.body?.send === true
  if (send) {
    try {
      await sendToMany({ senderName: `${row.teacher_name} (PAC-LAB)`, replyTo: row.teacher_email, recipients, ...message, html: inviteHtml(details) })
    } catch (error) {
      console.error(error)
      res.status(502).json({ error: 'The email server did not accept the invite. Check the SMTP settings and try again.' })
      return
    }
  }

  await pool.query(
    `INSERT INTO classroom_invites (classroom_id, email, invited_at) VALUES ${recipients.map(() => '(?, ?, NOW())').join(', ')}
     ON DUPLICATE KEY UPDATE invited_at = NOW()`,
    recipients.flatMap((email) => [row.id, email]),
  )
  res.json({
    invited: recipients.length,
    emailed: send ? recipients.length : 0,
    skipped: candidates.length - recipients.length,
    invalid: pasted.invalid,
    recipients: send ? [] : recipients,
    message,
  })
}))

// ---------- students ----------

// What a join link shows before the student signs in: no member list and no addresses.
export const classroomPreview = [
  ready,
  route(async (req, res) => {
    const row = await findByCode(req.params.code)
    if (!row) {
      res.status(404).json({ error: NO_CLASSROOM })
      return
    }
    res.json({
      classroom: {
        code: row.join_code,
        name: row.name,
        section: row.section,
        departmentName: row.department_name,
        teacher: { name: row.teacher_name },
        isOpen: Boolean(row.is_open),
        members: row.members,
      },
    })
  }),
]

export const studentClassrooms = express.Router()

studentClassrooms.get('/classrooms', ready, route(async (req, res) => {
  const [joins] = await pool.query('SELECT classroom_id, joined_at FROM classroom_members WHERE student_id = ? ORDER BY joined_at DESC', [req.userId])
  if (!joins.length) {
    res.json({ classrooms: [] })
    return
  }
  const [rows] = await pool.query(`${CLASSROOM} WHERE r.id IN (?)`, [joins.map((j) => j.classroom_id)])
  const byId = new Map(rows.map((row) => [row.id, row]))
  res.json({ classrooms: joins.filter((j) => byId.has(j.classroom_id)).map((j) => studentView(byId.get(j.classroom_id), j.joined_at)) })
}))

studentClassrooms.post('/join/:code', ready, route(async (req, res) => {
  const row = await findByCode(req.params.code)
  if (!row) {
    res.status(404).json({ error: NO_CLASSROOM })
    return
  }
  const [[member]] = await pool.query('SELECT joined_at FROM classroom_members WHERE classroom_id = ? AND student_id = ?', [row.id, req.userId])
  if (member) {
    res.json({ classroom: studentView(row, member.joined_at), alreadyMember: true })
    return
  }
  if (!row.is_open) {
    res.status(403).json({ error: 'This classroom is not accepting new students right now. Ask your teacher to open it.' })
    return
  }

  const [[student]] = await pool.query('SELECT s.class_id, s.email, c.code AS section FROM students s JOIN classes c ON c.id = s.class_id WHERE s.id = ?', [
    req.userId,
  ])
  if (!student) {
    res.status(401).json({ error: 'Your session has ended. Please sign in again.' })
    return
  }
  const [[invite]] = await pool.query('SELECT 1 AS invited FROM classroom_invites WHERE classroom_id = ? AND email = ?', [row.id, student.email])
  if (student.class_id !== row.class_id && !invite) {
    res.status(403).json({
      error: `This classroom is for section ${row.section}, but your account is in ${student.section}. Ask your teacher to invite your email address.`,
    })
    return
  }

  await pool.query('INSERT IGNORE INTO classroom_members (classroom_id, student_id, joined_at) VALUES (?, ?, NOW())', [row.id, req.userId])
  res.status(201).json({ classroom: studentView({ ...row, members: row.members + 1 }, new Date()) })
}))

studentClassrooms.delete('/classrooms/:id', ready, route(async (req, res) => {
  const id = Number(req.params.id)
  await pool.query('DELETE FROM classroom_members WHERE classroom_id = ? AND student_id = ?', [Number.isInteger(id) ? id : 0, req.userId])
  res.json({ ok: true })
}))
