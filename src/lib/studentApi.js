import { getStudentAuth } from '../session.js'

const OFFLINE = 'Cannot reach the PAC-LAB server. Start it with "npm run server" and try again.'

export async function studentFetch(path, { method = 'GET', body, keepalive = false } = {}) {
  const token = getStudentAuth()?.token
  let response
  try {
    response = await fetch(`/api/student${path}`, {
      method,
      keepalive,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    const error = new Error(OFFLINE)
    error.status = 0
    throw error
  }
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error(data?.error ?? (response.status >= 500 ? OFFLINE : `Request failed (${response.status}).`))
    error.status = response.status
    throw error
  }
  return data
}
