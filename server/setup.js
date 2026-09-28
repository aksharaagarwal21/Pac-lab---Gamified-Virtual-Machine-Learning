// Creates the PAC-LAB database, its tables and a large sample dataset.
// Usage: npm run db:setup   (reads the connection settings from .env)
// Warning: this resets all data, including progress saved by students who signed in.

import 'dotenv/config'
import { DEMO_FACULTY, DEMO_FACULTY_PASSWORD, DEMO_STUDENTS, DEMO_STUDENT_PASSWORD } from './accounts.js'
import { setupDatabase } from './setupDatabase.js'

try {
  await setupDatabase()
  console.log(`Faculty sign-in: ${DEMO_FACULTY.join(', ')} (or any FAC-ML-001 to FAC-ML-014) with password "${DEMO_FACULTY_PASSWORD}".`)
  console.log(`Student sign-in: ${DEMO_STUDENTS.map((s) => s.id).join(', ')} with password "${DEMO_STUDENT_PASSWORD}".`)
} catch (error) {
  console.error('Database setup failed:', error.message)
  process.exitCode = 1
}
