import { hashPassword } from './auth.js'

export const DEMO_FACULTY_PASSWORD = 'faculty@123'
export const DEMO_STUDENT_PASSWORD = 'student@123'

// Student accounts that can sign in. They start with no progress; each sits in a class
// advised by one of the demo faculty accounts below.
export const DEMO_STUDENTS = [
  { id: 'ML-2026-901', firstName: 'Riya', lastName: 'Kapoor', classCode: 'AIML-A' },
  { id: 'ML-2026-902', firstName: 'Arjun', lastName: 'Nair', classCode: 'CSE-A' },
  { id: 'ML-2026-903', firstName: 'Sneha', lastName: 'Reddy', classCode: 'ECE-A' },
]

export const DEMO_FACULTY = ['FAC-ML-014', 'FAC-ML-003', 'FAC-ML-010']

// Idempotent: adds the login columns/tables to an existing database and creates the demo
// student accounts if they are missing. Never resets saved progress or changed passwords.
export async function ensureAccounts(db) {
  const [[column]] = await db.query(
    `SELECT COUNT(*) AS present FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'students' AND column_name = 'password_hash'`,
  )
  if (!column.present) await db.query('ALTER TABLE students ADD COLUMN password_hash VARCHAR(200) NULL AFTER email')

  await db.query(`
    CREATE TABLE IF NOT EXISTS student_state (
      student_id VARCHAR(16) PRIMARY KEY,
      state JSON NOT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_state_student FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE
    )`)

  for (const demo of DEMO_STUDENTS) {
    const [[cls]] = await db.query('SELECT id FROM classes WHERE code = ?', [demo.classCode])
    if (!cls) continue
    await db.query(
      `INSERT IGNORE INTO students (id, class_id, first_name, last_name, email, enrolled_on, last_active_at)
       VALUES (?, ?, ?, ?, ?, CURDATE(), NULL)`,
      [demo.id, cls.id, demo.firstName, demo.lastName, `${demo.firstName}.${demo.lastName}.demo@students.paclab.test`.toLowerCase()],
    )
    const [[student]] = await db.query('SELECT password_hash FROM students WHERE id = ?', [demo.id])
    if (student && !student.password_hash) {
      await db.query('UPDATE students SET password_hash = ? WHERE id = ?', [hashPassword(DEMO_STUDENT_PASSWORD), demo.id])
    }
  }
}
