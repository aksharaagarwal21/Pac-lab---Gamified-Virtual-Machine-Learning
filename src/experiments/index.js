import { useEffect, useState } from 'react'

// Experiment content modules, loaded only when a student opens that experiment.
// Each module's default export follows the shape documented in exp01.jsx.
const LOADERS = {
  1: () => import('./exp01.jsx'),
  2: () => import('./exp02.jsx'),
  3: () => import('./exp03.jsx'),
  4: () => import('./exp04.jsx'),
  5: () => import('./exp05.jsx'),
  6: () => import('./exp06.jsx'),
  7: () => import('./exp07.jsx'),
  8: () => import('./exp08.jsx'),
  9: () => import('./exp09.jsx'),
  10: () => import('./exp10.jsx'),
}

export function useExperiment(labId) {
  const [state, setState] = useState({ labId: null, content: null, missing: false })

  useEffect(() => {
    let cancelled = false
    const loader = LOADERS[labId]
    if (!loader) {
      setState({ labId, content: null, missing: true })
      return undefined
    }
    loader().then((module) => {
      if (!cancelled) setState({ labId, content: module.default, missing: false })
    })
    return () => {
      cancelled = true
    }
  }, [labId])

  return state.labId === labId ? state : { labId, content: null, missing: false }
}
