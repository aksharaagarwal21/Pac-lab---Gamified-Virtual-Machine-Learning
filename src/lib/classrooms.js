// Classroom rules shared by the faculty and student pages and the API (server/classrooms.js),
// so the browser and the server always agree on codes, names and invite lists.

import { RULES } from './registration.js'

// Join codes skip look-alike characters (0/O, 1/I/L) so students can copy them from a board or an email.
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const CODE_LENGTH = 7
const CODE_PATTERN = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`)

export const LIMITS = { name: 80, description: 300, emails: 200 }

// "abc d23-4k" → "ABCD234K": spaces and dashes are ignored and letters upper-cased.
export const normalizeJoinCode = (value) => String(value ?? '').replace(/[\s-]+/g, '').toUpperCase()
export const isJoinCode = (code) => CODE_PATTERN.test(code)
export const joinPath = (code) => `/join/${code}`

export function normalizeClassroom(input = {}) {
  return {
    name: String(input.name ?? '').trim().replace(/\s+/g, ' '),
    description: String(input.description ?? '').trim(),
    classCode: String(input.classCode ?? '').trim().toUpperCase(),
  }
}

// Field-by-field problems with a normalised classroom ({} when everything is valid).
export function classroomErrors(form) {
  const errors = {}
  if (form.name.length < 3) errors.name = 'Give the classroom a name (at least 3 characters).'
  else if (form.name.length > LIMITS.name) errors.name = `At most ${LIMITS.name} characters.`
  if (form.description.length > LIMITS.description) errors.description = `At most ${LIMITS.description} characters.`
  if (!form.classCode) errors.classCode = 'Choose the section this classroom is for.'
  return errors
}

export const classroomError = (form) => Object.values(classroomErrors(form))[0] ?? null

// Email addresses in pasted text: one per line, separated by commas or semicolons, or "Name <email>".
// Words without an @ (names, headings from a spreadsheet) are ignored; anything else with an @ that
// is not a valid address is returned in `invalid` so the page can point it out.
export function parseEmails(text) {
  const valid = new Set()
  const invalid = new Set()
  for (const token of String(text ?? '').split(/[\s,;<>()"']+/)) {
    if (!token.includes('@')) continue
    const email = token.toLowerCase().replace(/^mailto:/, '')
    if (email.length <= 120 && RULES.email.test(email)) valid.add(email)
    else invalid.add(token)
  }
  return { valid: [...valid], invalid: [...invalid] }
}

// Reserved test domains (RFC 2606 / 6761) never receive mail; the sample students use them.
const RESERVED_DOMAIN = /(^|\.)(test|example|invalid|localhost)$|(^|\.)example\.(com|net|org)$/i
export const canReceiveMail = (email) => !RESERVED_DOMAIN.test(String(email).split('@').pop())

// Invite wording, used for emails the server sends and for the copy-and-send fallback.
export function inviteMessage({ name, section, teacher, link, code }) {
  return {
    subject: `Join ${name} on PAC-LAB`,
    text: [
      `${teacher} invited you to join the classroom "${name}" (section ${section}) on PAC-LAB.`,
      '',
      `Join here: ${link}`,
      `Class code: ${code}`,
      '',
      'Sign in with your roll number (or register first if you are new to PAC-LAB), then press Join.',
    ].join('\n'),
  }
}
