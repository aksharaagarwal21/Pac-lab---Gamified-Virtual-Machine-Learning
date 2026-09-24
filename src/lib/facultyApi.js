import { useEffect, useState } from 'react'
import { getFaculty, signOutFaculty } from '../facultySession.js'

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

const OFFLINE = 'Cannot reach the PAC-LAB server. Start it with "npm run server" and try again.'

export async function facultyFetch(path, { method = 'GET', body } = {}) {
  const token = getFaculty()?.token
  let response
  try {
    response = await fetch(`/api/faculty${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(OFFLINE, 0)
  }
  const data = await response.json().catch(() => null)
  if (response.status === 401 && path !== '/login') signOutFaculty()
  if (!response.ok) throw new ApiError(data?.error ?? (response.status >= 500 ? OFFLINE : `Request failed (${response.status}).`), response.status)
  return data
}

// Loads one API path; refetches when the path changes.
export function useFacultyData(path) {
  const [state, setState] = useState({ path: null, data: null, error: null })

  useEffect(() => {
    let cancelled = false
    facultyFetch(path).then(
      (data) => !cancelled && setState({ path, data, error: null }),
      (error) => !cancelled && setState({ path, data: null, error }),
    )
    return () => {
      cancelled = true
    }
  }, [path])

  return state.path === path ? state : { path, data: null, error: null }
}
