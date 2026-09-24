import { useSyncExternalStore } from 'react'

// Simulation results saved with "Save to Results". Kept for this browser tab only.

const KEY = 'pac-lab-sim-results'
const listeners = new Set()
let results = load()

function load() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY)) ?? {}
  } catch {
    return {}
  }
}

export function saveSessionResult(labId, result) {
  results = { ...results, [labId]: { ...result, savedAt: new Date().toISOString() } }
  try {
    sessionStorage.setItem(KEY, JSON.stringify(results))
  } catch {
    // Storage unavailable: the result still shows until the page reloads.
  }
  listeners.forEach((listener) => listener())
}

const subscribe = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useSessionResult(labId) {
  return useSyncExternalStore(subscribe, () => results[labId] ?? null, () => null)
}
