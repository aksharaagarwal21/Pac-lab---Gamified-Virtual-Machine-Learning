import { useState } from 'react'
import { Code, FlaskConical } from 'lucide-react'
import { saveSessionResult } from '../../lib/sessionResults.js'
import { completeTask } from '../../progress.js'
import { say, sfx } from '../../sound.js'
import { PythonStudio } from './PythonStudio.jsx'

const MODES = [
  { id: 'visual', label: 'Visual activity', hint: 'Change, compare, explain', icon: FlaskConical },
  { id: 'python', label: 'Python practice', hint: 'Predict, repair, build, speed code', icon: Code },
]

export function SimulationStep({ lab, content, onSaved }) {
  const [mode, setMode] = useState('visual')
  const [pythonSeed, setPythonSeed] = useState(null)
  const Visual = content.simulation

  const saveResult = (result) => {
    saveSessionResult(lab.id, result)
    completeTask(lab.id, 'simulation')
    sfx.coin()
    say('Saved to results.')
    onSaved?.()
  }

  const usePython = (code) => {
    setPythonSeed(code)
    setMode('python')
    sfx.select()
  }

  return (
    <>
      <div className="lab-sim-switch" role="tablist" aria-label="Simulation mode">
        {MODES.map(({ id, label, hint, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={mode === id}
            className="lab-sim-tab"
            onClick={() => {
              setMode(id)
              sfx.select()
            }}
          >
            <Icon aria-hidden="true" />
            <span>
              <strong>{label}</strong>
              <small>{hint}</small>
            </span>
          </button>
        ))}
      </div>

      {(mode === 'visual' || lab.id === 1) && (
        <div hidden={mode !== 'visual'}>
          <Visual lab={lab} onSaveResult={saveResult} onUsePython={usePython} />
        </div>
      )}
      {mode === 'python' && (
        <PythonStudio lab={lab} practice={content.python} seed={pythonSeed} />
      )}
    </>
  )
}
