import React from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { PythonStudio } from '../../src/components/lab/PythonStudio.jsx'
import exp01 from '../../src/experiments/exp01.jsx'
import '../../src/styles.css'
import '../../src/maze.css'
import '../../src/lab.css'

// Experiment 1's Python studio, with a speed test short enough to finish in a test when ?short is set.
const short = new URLSearchParams(location.search).has('short')
const practice = short
  ? { ...exp01.python, speedTest: { ...exp01.python.speedTest, parts: exp01.python.speedTest.parts.slice(0, 2).map((p, i) => (i ? { ...p, code: 'print("done")' } : { ...p, code: 'x = [\n    1,\n]' })) } }
  : exp01.python

const Studio = () => (
  <div className="mz-shell"><div className="lab-page" style={{ padding: 24 }}>
    <PythonStudio lab={{ id: 1, title: 'Data preprocessing' }} practice={practice} />
  </div></div>
)
const rootRoute = createRootRoute({ component: Studio })
const labRoute = createRoute({ getParentRoute: () => rootRoute, path: '/student/lab/$labId', component: () => null })
const router = createRouter({ routeTree: rootRoute.addChildren([labRoute]), history: createMemoryHistory({ initialEntries: ['/'] }) })
createRoot(document.getElementById('root')).render(<RouterProvider router={router} />)
