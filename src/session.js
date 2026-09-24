// Student sign-in: remembers the roll number and API token for this browser tab.
// Falls back to memory when sessionStorage is unavailable.

const STUDENT_KEY = 'pac-lab-student'
const AUTH_KEY = 'pac-lab-student-auth'

let memoryStudent = null
let memoryAuth = null

export function getStudent() {
  try {
    return sessionStorage.getItem(STUDENT_KEY) ?? memoryStudent
  } catch {
    return memoryStudent
  }
}

// { token, name, className } for the signed-in student, or null.
export function getStudentAuth() {
  try {
    const saved = sessionStorage.getItem(AUTH_KEY)
    return saved ? JSON.parse(saved) : memoryAuth
  } catch {
    return memoryAuth
  }
}

export function signInStudent(id, auth) {
  memoryStudent = id
  memoryAuth = auth
  try {
    sessionStorage.setItem(STUDENT_KEY, id)
    sessionStorage.setItem(AUTH_KEY, JSON.stringify(auth))
  } catch {
    // Storage unavailable: the in-memory values keep the player signed in.
  }
}

export function signOutStudent() {
  memoryStudent = null
  memoryAuth = null
  try {
    sessionStorage.removeItem(STUDENT_KEY)
    sessionStorage.removeItem(AUTH_KEY)
  } catch {
    // Nothing stored to clear.
  }
}
