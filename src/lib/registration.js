// Student registration rules, shared by the registration page and the API (server/app.js),
// so the browser and the server always agree on what is valid.

export const RULES = {
  studentId: /^[A-Z0-9][A-Z0-9-]{3,15}$/,
  name: /^[\p{L}][\p{L} .'-]{0,39}$/u,
  email: /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/,
  passwordMin: 8,
  passwordMax: 72,
}

// Trims and normalises raw form input: upper-case roll number and class, lower-case email.
export function normalizeRegistration(input = {}) {
  const text = (value) => String(value ?? '').trim()
  return {
    studentId: text(input.studentId).toUpperCase(),
    firstName: text(input.firstName).replace(/\s+/g, ' '),
    lastName: text(input.lastName).replace(/\s+/g, ' '),
    email: text(input.email).toLowerCase(),
    classCode: text(input.classCode).toUpperCase(),
    password: String(input.password ?? ''),
  }
}

// Field-by-field problems with a normalised form ({} when everything is valid).
export function registrationErrors(form) {
  const errors = {}
  if (!RULES.studentId.test(form.studentId)) errors.studentId = 'Use 4–16 letters, digits or dashes, e.g. ML-2026-123.'
  if (!RULES.name.test(form.firstName)) errors.firstName = 'Enter your first name (letters only).'
  if (!RULES.name.test(form.lastName)) errors.lastName = 'Enter your last name (letters only).'
  if (form.email.length > 120 || !RULES.email.test(form.email)) errors.email = 'Enter a valid email address.'
  if (!form.classCode) errors.classCode = 'Choose your class.'
  if (form.password.length < RULES.passwordMin) errors.password = `At least ${RULES.passwordMin} characters.`
  else if (form.password.length > RULES.passwordMax) errors.password = `At most ${RULES.passwordMax} characters.`
  return errors
}

// The first problem as one message, or null when the form is valid.
export function registrationError(form) {
  return Object.values(registrationErrors(form))[0] ?? null
}
