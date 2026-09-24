import { useEffect, useId, useRef, useState } from 'react'
import { Check, Download, Play, RotateCcw, Square } from 'lucide-react'
import { runPython, stopPython } from '../../lib/python.js'
import { sfx } from '../../sound.js'

const TABS = [
  { id: 'predict', label: 'Predict' },
  { id: 'repair', label: 'Repair' },
  { id: 'build', label: 'Build' },
  { id: 'explore', label: 'Explore' },
]
const CHECKPOINTS = ['predict', 'repair', 'build']
const PASS_MARK = 'ALL TESTS PASSED'

// Plain textarea editor with line numbers. Tab indents; Escape then Tab leaves; Ctrl/⌘ + Enter runs.
function CodeEditor({ id, value, onChange, onRun, fileName }) {
  const escapeArmed = useRef(false)
  const lines = value.split('\n').length

  const onKeyDown = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault()
      onRun()
      return
    }
    if (event.key === 'Escape') {
      escapeArmed.current = true
      return
    }
    if (event.key === 'Tab' && !escapeArmed.current) {
      event.preventDefault()
      const { selectionStart, selectionEnd } = event.target
      const next = `${value.slice(0, selectionStart)}    ${value.slice(selectionEnd)}`
      onChange(next)
      requestAnimationFrame(() => {
        event.target.selectionStart = selectionStart + 4
        event.target.selectionEnd = selectionStart + 4
      })
      return
    }
    escapeArmed.current = false
  }

  return (
    <div className="lab-editor">
      <div className="lab-editor-bar">
        <span>{fileName}</span>
        <span>Python · Ctrl / ⌘ + Enter to run</span>
      </div>
      <div className="lab-editor-body">
        <pre className="lab-editor-gutter" aria-hidden="true">
          {Array.from({ length: lines }, (_, i) => i + 1).join('\n')}
        </pre>
        <textarea
          id={id}
          className="lab-editor-input"
          value={value}
          spellCheck="false"
          autoCapitalize="off"
          autoComplete="off"
          wrap="off"
          rows={Math.max(8, lines + 1)}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          aria-label={`${fileName} code editor`}
        />
      </div>
    </div>
  )
}

export function PythonStudio({ lab, practice, seed }) {
  const id = useId()
  const [tab, setTab] = useState('predict')
  const [codes, setCodes] = useState(() => Object.fromEntries(TABS.map((t) => [t.id, practice[t.id].code])))
  const [result, setResult] = useState(null)
  const [running, setRunning] = useState(false)
  const [loadedOnce, setLoadedOnce] = useState(false)
  const [prediction, setPrediction] = useState(null)
  const [passed, setPassed] = useState([])
  const cell = practice[tab]

  // "Use this data in Python" from the simulation opens Explore with that code.
  useEffect(() => {
    if (!seed) return
    setCodes((current) => ({ ...current, explore: seed }))
    setTab('explore')
    setResult(null)
  }, [seed])

  const pass = (checkpoint) => {
    setPassed((current) => (current.includes(checkpoint) ? current : [...current, checkpoint]))
    sfx.coin()
  }

  const run = async () => {
    if (running) return
    setRunning(true)
    setResult({ ok: true, output: loadedOnce ? 'Running…' : 'Loading Python (first run only)…', pending: true })
    const source = tab === 'build' ? `${codes.build}\n\n${cell.tests}` : codes[tab]
    const outcome = await runPython(source)
    setLoadedOnce(true)
    setRunning(false)

    let verdict = null
    if (outcome.ok && tab === 'predict' && prediction !== null) {
      const correct = practice.predict.options[prediction] === outcome.output.trim()
      verdict = correct ? 'Your prediction matched the output.' : `The output was ${outcome.output.trim()}, not ${practice.predict.options[prediction]}.`
      if (correct) pass('predict')
    }
    if (outcome.ok && tab === 'repair') {
      const fixed = outcome.output.trim() === String(cell.expected).trim()
      verdict = fixed ? 'Fixed! The output is now correct.' : `Not fixed yet. Expected output: ${cell.expected}`
      if (fixed) pass('repair')
    }
    if (tab === 'build') {
      const ok = outcome.ok && outcome.output.includes(PASS_MARK)
      verdict = ok ? 'All tests passed.' : 'Some tests failed. Read the error above and try again.'
      if (ok) pass('build')
    }
    setResult({ ...outcome, verdict })
    if (!outcome.ok && !outcome.stopped) sfx.denied()
  }

  const stop = () => {
    stopPython()
    setRunning(false)
    setLoadedOnce(false)
  }

  const reset = () => {
    setCodes((current) => ({ ...current, [tab]: practice[tab].code }))
    setResult(null)
    sfx.back()
  }

  const save = () => {
    const blob = new Blob([codes[tab]], { type: 'text/x-python' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `experiment-${String(lab.id).padStart(2, '0')}-${tab}.py`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return (
    <section className="lab-python" aria-labelledby={`${id}-title`}>
      <p className="lab-kicker">PYTHON PRACTICE STUDIO</p>
      <h3 id={`${id}-title`} className="lab-subtitle">
        {practice.title}
      </h3>
      <p className="lab-p">{practice.intro}</p>
      <span className="lab-pill">
        {passed.length} / {CHECKPOINTS.length} checkpoints
      </span>

      <div className="lab-python-tabs" role="tablist" aria-label="Python practice">
        {TABS.map((item, index) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className="lab-python-tab"
            onClick={() => {
              setTab(item.id)
              setResult(null)
              sfx.select()
            }}
          >
            <small>{String(index + 1).padStart(2, '0')}</small> {item.label}
            {passed.includes(item.id) && <Check aria-label="passed" />}
          </button>
        ))}
      </div>

      <div className="lab-python-brief">
        <h4 className="lab-subtitle">{cell.question}</h4>
        <p className="lab-p">{cell.task}</p>
        {tab === 'predict' && (
          <fieldset className="lab-question">
            <legend className="lab-question-text">Your prediction</legend>
            <div className="lab-options lab-options-row">
              {practice.predict.options.map((option, index) => (
                <label key={option} className={`lab-option lab-option-compact${prediction === index ? ' is-chosen' : ''}`}>
                  <input type="radio" name={`${id}-prediction`} checked={prediction === index} onChange={() => setPrediction(index)} />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {cell.hint && (
          <details className="lab-hint">
            <summary>Hint</summary>
            <p className="lab-p">{cell.hint}</p>
          </details>
        )}
      </div>

      <CodeEditor
        id={`${id}-editor`}
        fileName={cell.fileName ?? 'experiment.py'}
        value={codes[tab]}
        onChange={(value) => setCodes((current) => ({ ...current, [tab]: value }))}
        onRun={run}
      />
      <p className="lab-muted">Tab indents code. Escape then Tab leaves the editor; Shift + Tab moves back.</p>

      <div className="lab-actions lab-actions-start">
        <button type="button" className="lab-btn lab-btn-primary" onClick={run} disabled={running}>
          <Play aria-hidden="true" />
          Run code
        </button>
        <button type="button" className="lab-btn" onClick={stop} disabled={!running}>
          <Square aria-hidden="true" />
          Stop
        </button>
        <button type="button" className="lab-btn" onClick={reset}>
          <RotateCcw aria-hidden="true" />
          Reset cell
        </button>
        <button type="button" className="lab-btn" onClick={save}>
          <Download aria-hidden="true" />
          Save code
        </button>
      </div>

      {result && (
        <div className={`lab-console${result.ok ? '' : ' is-error'}`} aria-live="polite">
          <p className="lab-console-label">{result.pending ? 'RUNNING' : result.ok ? 'OUTPUT' : 'ERROR'}</p>
          <pre>{result.output || '(no output)'}</pre>
          {result.verdict && <p className="lab-console-verdict">{result.verdict}</p>}
        </div>
      )}

      <p className="lab-muted">Python loads when you first run code.</p>
      <p className="lab-muted">Runs use browser Python with its standard library. Your code is not uploaded. Work stays in this page session; use Save code to keep a copy.</p>

      {practice.reference && (
        <details className="lab-hint">
          <summary>Reference examples from the laboratory manual</summary>
          {practice.reference.map((example) => (
            <div key={example.title} className="lab-reference">
              <p className="lab-question-text">{example.title}</p>
              <pre className="lab-code">
                <code>{example.code}</code>
              </pre>
            </div>
          ))}
        </details>
      )}
    </section>
  )
}
