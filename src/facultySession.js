// Faculty sign-in: keeps the API token and profile for this browser tab.

const FACULTY_KEY = 'pac-lab-faculty'

let memoryFaculty = null

export function getFaculty() {
  try {
    const saved = sessionStorage.getItem(FACULTY_KEY)
    return saved ? JSON.parse(saved) : memoryFaculty
  } catch {
    return memoryFaculty
  }
}

export function signInFaculty(session) {
  memoryFaculty = session
  try {
    sessionStorage.setItem(FACULTY_KEY, JSON.stringify(session))
  } catch {
    // Storage unavailable: the in-memory value keeps the faculty member signed in.
  }
}

export function signOutFaculty() {
  memoryFaculty = null
  try {
    sessionStorage.removeItem(FACULTY_KEY)
  } catch {
    // Nothing stored to clear.
  }
}
