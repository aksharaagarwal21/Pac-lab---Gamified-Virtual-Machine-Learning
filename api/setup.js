// One-time database setup on Vercel, for when the database cannot be reached from your own
// computer (for example a firewall that blocks MySQL over TLS).
//
// Disabled unless the SETUP_TOKEN environment variable is set. To use it:
//   1. add SETUP_TOKEN (a long random string) in Vercel and redeploy
//   2. POST /api/setup with the header  x-setup-token: <that string>
//   3. remove SETUP_TOKEN from Vercel and redeploy, which turns this endpoint off again
// Warning: it resets all data, exactly like "npm run db:setup".

import crypto from 'node:crypto'
import { setupDatabase } from '../server/setupDatabase.js'

const sameSecret = (a, b) => {
  const x = crypto.createHash('sha256').update(String(a)).digest()
  const y = crypto.createHash('sha256').update(String(b)).digest()
  return crypto.timingSafeEqual(x, y)
}

export default async function handler(req, res) {
  const expected = process.env.SETUP_TOKEN
  if (!expected || expected.length < 24) return res.status(404).json({ error: 'Not found.' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' })
  if (!sameSecret(req.headers['x-setup-token'] ?? '', expected)) return res.status(401).json({ error: 'Wrong setup token.' })

  const lines = []
  try {
    const result = await setupDatabase((line) => lines.push(line))
    res.status(200).json({ ok: true, ...result, log: lines })
  } catch (error) {
    res.status(500).json({ ok: false, error: `${error.code ?? ''} ${error.message}`.trim(), log: lines })
  }
}
