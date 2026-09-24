import crypto from 'node:crypto'

// Passwords are stored as scrypt$<salt>$<hash> (Node's built-in scrypt, no extra dependency).
export function hashPassword(password) {
  const salt = crypto.randomBytes(16)
  const hash = crypto.scryptSync(password, salt, 64)
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`
}

export function verifyPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored).split('$')
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false
  const expected = Buffer.from(hashHex, 'hex')
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length)
  return crypto.timingSafeEqual(expected, actual)
}

// In-memory sessions for faculty and students: signing in again is needed after the API server restarts.
const SESSION_MS = 8 * 60 * 60 * 1000
const sessions = new Map()

export function createSession(role, id) {
  const token = crypto.randomBytes(32).toString('hex')
  sessions.set(token, { role, id, expires: Date.now() + SESSION_MS })
  return token
}

export function readSession(token, role) {
  const session = token && sessions.get(token)
  if (!session || session.role !== role) return null
  if (session.expires < Date.now()) {
    sessions.delete(token)
    return null
  }
  return session
}

export const endSession = (token) => sessions.delete(token)
