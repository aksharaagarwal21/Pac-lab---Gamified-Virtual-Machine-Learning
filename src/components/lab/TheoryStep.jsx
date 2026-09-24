import { useId, useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { completeTask } from '../../progress.js'
import { sfx } from '../../sound.js'
import { LineChart } from './charts.jsx'
import { ContentBlocks } from './ContentBlocks.jsx'
import { VideoSlot } from './VideoSlot.jsx'

const SAMPLES = 61

function ChoiceGroup({ name, legend, options, value, onChange, disabled, correct }) {
  return (
    <fieldset className="lab-question">
      <legend className="lab-question-text">{legend}</legend>
      <div className="lab-options">
        {options.map((option, index) => {
          let state = ''
          if (correct !== undefined && index === correct) state = ' is-correct'
          else if (correct !== undefined && index === value) state = ' is-wrong'
          return (
            <label key={option} className={`lab-option lab-option-compact${value === index ? ' is-chosen' : ''}${state}`}>
              <input type="radio" name={name} checked={value === index} disabled={disabled} onChange={() => onChange(index)} />
              <span>{option}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

// One "predict → manipulate → observe → reason" task. The content file supplies evaluate(value).
function TaskCard({ task, onDone }) {
  const id = useId()
  const { manipulate } = task
  const [prediction, setPrediction] = useState(null)
  const [value, setValue] = useState(manipulate.initial)
  const [moved, setMoved] = useState(false)
  const [reason, setReason] = useState(null)
  const [checked, setChecked] = useState(false)

  const result = task.evaluate(value)
  const curve = useMemo(
    () =>
      Array.from({ length: SAMPLES }, (_, i) => {
        const x = manipulate.min + ((manipulate.max - manipulate.min) * i) / (SAMPLES - 1)
        return { x, y: task.evaluate(x).y }
      }),
    [task, manipulate],
  )

  const checkReasoning = () => {
    setChecked(true)
    if (reason === task.reason.answer) {
      sfx.coin()
      onDone()
    } else {
      sfx.denied()
    }
  }

  return (
    <div className="lab-task-card">
      <h4 className="lab-task-title">{task.title}</h4>
      <p className="lab-muted">{task.subtitle}</p>

      <ChoiceGroup
        name={`${id}-predict`}
        legend={`1 · Predict: ${task.predict.prompt}`}
        options={task.predict.options}
        value={prediction}
        onChange={(index) => {
          setPrediction(index)
          sfx.select()
        }}
      />

      <div className="lab-manipulate">
        <label className="lab-question-text" htmlFor={`${id}-slider`}>
          2 · Manipulate: {manipulate.label}
        </label>
        <div className="lab-slider-row">
          <input
            id={`${id}-slider`}
            type="range"
            min={manipulate.min}
            max={manipulate.max}
            step={manipulate.step}
            value={value}
            disabled={prediction === null}
            onChange={(event) => {
              setValue(Number(event.target.value))
              setMoved(true)
            }}
          />
          <output htmlFor={`${id}-slider`} className="lab-slider-value">
            {value.toFixed(manipulate.digits ?? 0)}
          </output>
        </div>
        {prediction === null && <p className="lab-muted">Choose a prediction to unlock this control.</p>}

        <dl className="lab-metrics">
          {result.metrics.map((metric) => (
            <div key={metric.label}>
              <dt>{metric.label}</dt>
              <dd>{metric.value}</dd>
            </div>
          ))}
        </dl>

        <div className="lab-chart-box">
          <LineChart
            series={[{ label: task.chart.yLabel, points: curve }]}
            marker={{ x: value, y: result.y }}
            xLabel={task.chart.xLabel}
            yLabel={task.chart.yLabel}
            label={`${task.chart.yLabel} as ${manipulate.label} changes`}
          />
        </div>
      </div>

      {moved && (
        <div className="lab-observe">
          <p className="lab-question-text">3 · Observe and explain</p>
          <p className="lab-p">{task.observe}</p>
          {task.limit && (
            <p className="lab-p">
              <strong>Test the limit.</strong> {task.limit}
            </p>
          )}
          <p className="lab-muted">
            Your prediction was {prediction === task.predict.answer ? 'right.' : `"${task.predict.options[prediction]}". The observed answer: "${task.predict.options[task.predict.answer]}".`}
          </p>
        </div>
      )}

      {moved && (
        <>
          <ChoiceGroup
            name={`${id}-reason`}
            legend={`4 · Check your reasoning: ${task.reason.prompt}`}
            options={task.reason.options}
            value={reason}
            disabled={checked && reason === task.reason.answer}
            correct={checked ? task.reason.answer : undefined}
            onChange={(index) => {
              setReason(index)
              setChecked(false)
            }}
          />
          {checked && (
            <p className={`lab-feedback${reason === task.reason.answer ? ' is-good' : ' is-bad'}`} role="status">
              <strong>{reason === task.reason.answer ? 'Well reasoned.' : 'Not quite.'}</strong> {task.reason.explain}
            </p>
          )}
          <div className="lab-actions">
            <button type="button" className="lab-btn lab-btn-primary" onClick={checkReasoning} disabled={reason === null || (checked && reason === task.reason.answer)}>
              Check reasoning
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export function TheoryStep({ lab, theory }) {
  const [taskIndex, setTaskIndex] = useState(0)
  const [done, setDone] = useState([])
  const tasks = theory.activity.tasks

  const markDone = (index) => {
    const next = done.includes(index) ? done : [...done, index]
    setDone(next)
    if (next.length === tasks.length) completeTask(lab.id, 'theory')
  }

  return (
    <>
      <VideoSlot lab={lab} />

      <section className="lab-activity" aria-labelledby="lab-activity-title">
        <p className="lab-kicker">DISCOVER THE MECHANISM</p>
        <h3 id="lab-activity-title" className="lab-title">
          {theory.activity.heading ?? 'Make a prediction. Test the idea.'}
        </h3>
        <div className="lab-task-tabs" role="tablist" aria-label="Theory activities">
          {tasks.map((task, index) => (
            <button
              key={task.title}
              type="button"
              role="tab"
              aria-selected={index === taskIndex}
              className="lab-task-tab"
              onClick={() => {
                setTaskIndex(index)
                sfx.select()
              }}
            >
              {String(index + 1).padStart(2, '0')} · {task.shortTitle ?? task.title}
              {done.includes(index) && <Check className="lab-task-done" aria-label="complete" />}
            </button>
          ))}
        </div>
        <TaskCard key={taskIndex} task={tasks[taskIndex]} onDone={() => markDone(taskIndex)} />
      </section>

      <details className="lab-notes" open>
        <summary>Complete Study Notes</summary>
        <div className="lab-notes-body">
          <h3 className="lab-doc-title">Theory</h3>
          <ContentBlocks blocks={theory.notes} />
        </div>
      </details>
    </>
  )
}
