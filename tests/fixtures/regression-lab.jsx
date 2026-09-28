import React from 'react'
import { createRoot } from 'react-dom/client'
import RegressionLab from '../../src/experiments/sims/regressionLab/RegressionLab.jsx'
import '../../src/styles.css'
import '../../src/maze.css'
import '../../src/lab.css'

window.__saved = []
createRoot(document.getElementById('root')).render(
  <div className="mz-shell"><div className="lab-page">
    <RegressionLab onSaveResult={(result) => window.__saved.push(result)} onUsePython={(code) => (window.__python = code)} />
  </div></div>,
)
