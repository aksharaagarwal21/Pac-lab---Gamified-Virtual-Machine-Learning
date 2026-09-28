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

// Signed session tokens: <payload>.<HMAC-SHA256>, where the payload holds the role, the user id and
// an expiry time. Any server instance holding SESSION_SECRET can check a token, so sign-ins survive
// restarts and work across Vercel's serverless instances.
const SESSION_MS = 8 * 60 * 60 * 1000

function sessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET is not set.')
  // Local development only: a per-process secret (everyone signs in again after a restart).
  sessionSecret.dev ??= crypto.randomBytes(32).toString('hex')
  return sessionSecret.dev
}

const sign = (payload) => crypto.createHmac('sha256', sessionSecret()).update(payload).digest('base64url')

// Tokens signed out before they expire (per instance; the browser also forgets its token).
const revoked = new Map()

export function createSession(role, id) {
  const payload = Buffer.from(JSON.stringify({ role, id, exp: Date.now() + SESSION_MS })).toString('base64url')
  return `${payload}.${sign(payload)}`
}

export function readSession(token, role) {
  if (typeof token !== 'string' || revoked.has(token)) return null
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null
  const expected = Buffer.from(sign(payload))
  const actual = Buffer.from(signature)
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null
  let session
  try {
    session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (session.role !== role || !(session.exp > Date.now())) return null
  return session
}

export function endSession(token) {
  const session = readSession(token, 'student') ?? readSession(token, 'faculty')
  if (!session) return
  revoked.set(token, session.exp)
  for (const [key, exp] of revoked) if (exp < Date.now()) revoked.delete(key)
}
