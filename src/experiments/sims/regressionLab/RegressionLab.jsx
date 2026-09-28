import { useEffect, useMemo, useRef, useState } from 'react'
import { Code, Hand, Maximize2, Minimize2, Redo2, RotateCcw, Save, Sparkles, Spline, Undo2 } from 'lucide-react'
import { SegmentedControl } from '../../../components/lab/interactive/controls.jsx'
import { useEditSession, useFullscreen, useHistory, useMediaQuery, useTween } from '../../../components/lab/interactive/hooks.js'
import {
  DOMAIN,
  HINTS,
  ORIGINAL_POINTS,
  POINT_LIMITS,
  SAMPLE_RANGE,
  adoptForGeneration,
  at,
  clamp,
  clampPoint,
  dragLine,
  equation,
  evaluateLine,
  fitLine,
  fmt,
  generateDataset,
  hintForDataDrag,
  hintForLineDrag,
  initialDoc,
  isGenerated,
  makeOutlier,
  nextId,
  nudgeLine,
  outlierImpact,
  pickLine,
  pythonCode,
  randomSpec,
  regenerate,
  resizeGenerated,
  round2,
  suggestPoint,
  toManual,
} from './model.js'
import { RegressionGraph } from './RegressionGraph.jsx'
import { ChallengePanel, DatasetTable, EquationPanel, HintPanel, LabPath, LearningObjectives, MetricsPanel, OutlierImpact, PointInspector, PredictionPanel } from './panels.jsx'
import { GeneratorPanel, LabToolbar } from './LabToolbar.jsx'
import '../../../components/lab/interactive/interactive.css'
import './regressionLab.css'

const MODES = [
  { value: 'data', label: 'Edit Data', icon: Hand },
  { value: 'model', label: 'Edit Model', icon: Spline },
  { value: 'generate', label: 'Generate Data', icon: Sparkles },
]
const MODE_NAME = { data: 'Edit Data', model: 'Edit Model', generate: 'Generate Data' }
const MODE_LESSON = {
  data: '“Data determines the model.” Drag points — the line is recalculated from them.',
  model: '“Changing the model changes predictions and error.” The data is locked.',
  generate: 'Datasets can follow an underlying relationship plus noise.',
}
const MODE_CHIP = {
  data: 'Drag any point · double-click to add one',
  model: 'Drag ▢ to shift the line · drag ● to tilt it',
  generate: 'Move the dashed line — the data follows',
  challenge: 'Fit the line by eye: drag ▢ and ●',
}
const NO_VIEW = { residuals: false, squares: false, prediction: false }
const lineEnds = (line) => [at(line, DOMAIN.x[0]), at(line, DOMAIN.x[1])]
const meanY = (points) => points.reduce((sum, p) => sum + p.y, 0) / points.length

export default function RegressionLab({ onSaveResult, onUsePython }) {
  const rootRef = useRef(null)
  const history = useHistory(initialDoc)
  const setDoc = history.set
  const doc = history.present
  const { points, mode } = doc
  const fullscreen = useFullscreen(rootRef)
  const wide = useMediaQuery('(min-width: 900px)')
  const continues = useEditSession()

  const [selectedId, setSelectedId] = useState(null)
  const [hoverId, setHoverId] = useState(null)
  const [view, setView] = useState(NO_VIEW)
  const [predictX, setPredictX] = useState(7)
  const [challenge, setChallenge] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [hint, setHint] = useState(HINTS.welcome)
  const [done, setDone] = useState(() => new Set(['observe']))
  const [change, setChange] = useState({ slope: false, intercept: false, stamp: 0 })
  const changeKind = useRef(null)
  const dragStart = useRef(null)

  // ---------- Derived model state ----------
  const fit = useMemo(() => fitLine(points), [points])
  const activeChallenge = mode === 'model' ? challenge : null
  const hideBest = Boolean(activeChallenge && !activeChallenge.revealed)
  const model = mode === 'model' ? doc.manualLine : fit
  const evaluation = useMemo(() => evaluateLine(points, model), [points, model])
  const bestMse = useMemo(() => evaluateLine(points, fit).mse, [points, fit])
  const outlier = points.find((p) => p.id === doc.outlierId) ?? null
  const impact = useMemo(() => (outlier ? outlierImpact(points, outlier.id) : null), [points, outlier])
  const selectedRow = evaluation.rows.find((row) => row.id === selectedId) ?? null
  const generatedCount = points.filter(isGenerated).length
  const manualCount = points.length - generatedCount
  const xs = points.map((p) => p.x)
  const dataRange = points.length ? [Math.min(...xs), Math.max(...xs)] : null
  const latest = useRef(null)
  latest.current = { doc, fit, evaluation }

  // Undo can leave Edit Model mode; the challenge only exists there.
  useEffect(() => {
    if (mode !== 'model' && challenge) setChallenge(null)
  }, [mode, challenge])

  // Flag which coefficient changed. Handle drags say what the student did (shift vs tilt).
  const shownLine = useRef(model)
  useEffect(() => {
    const previous = shownLine.current
    shownLine.current = model
    const slope = Math.abs(model.slope - previous.slope) >= 0.005
    const intercept = Math.abs(model.intercept - previous.intercept) >= 0.005
    const kind = changeKind.current
    changeKind.current = null
    if (!slope && !intercept) return
    setChange((c) => ({ slope: kind ? kind === 'slope' : slope, intercept: kind ? kind === 'intercept' : intercept, stamp: c.stamp + 1 }))
  }, [model])

  // Everything drawn on the graph animates between states, except while dragging.
  const showBestLine = Boolean(activeChallenge?.revealed)
  const target = useMemo(() => {
    const frame = { model: lineEnds(model) }
    for (const p of points) frame[`p:${p.id}`] = [p.x, p.y]
    if (mode === 'generate') frame.gen = lineEnds(doc.genLine)
    if (showBestLine) frame.best = lineEnds(fit)
    return frame
  }, [points, model, mode, doc.genLine, fit, showBestLine])
  const frame = useTween(target, { instant: dragging })

  const markDone = (...ids) => setDone((prev) => (ids.every((id) => prev.has(id)) ? prev : new Set([...prev, ...ids])))
  const leaveModel = (d) => (d.mode === 'model' ? 'data' : d.mode)

  // ---------- Modes ----------
  const switchMode = (next) => {
    if (next === mode) return
    setChallenge(null)
    setDoc(
      (d) => {
        const line = pickLine(fitLine(d.points))
        if (next === 'model') return { ...d, mode: next, manualLine: line }
        if (next === 'generate') {
          const adopted = adoptForGeneration(d.points, line, d.outlierId)
          return { ...d, mode: next, genLine: line, noise: adopted.noise, points: adopted.points }
        }
        return { ...d, mode: next }
      },
      { transient: true },
    )
    setHint(HINTS[next])
  }

  // ---------- Graph interactions ----------
  const pointDrag = {
    start: () => {
      dragStart.current = { fit: latest.current.fit }
      setDragging(true)
    },
    move: (id, x, y, first) => {
      const spot = clampPoint(x, y)
      setDoc((d) => ({ ...d, points: d.points.map((p) => (p.id === id ? { id, ...spot } : p)) }), { transient: !first })
    },
    end: (id, moved) => {
      setDragging(false)
      if (!moved) return
      const { fit: after, doc: d } = latest.current
      setHint(hintForDataDrag({ before: dragStart.current.fit, after, isOutlier: id === d.outlierId }))
      markDone('drag', 'metrics')
    },
  }

  const applyLine = (d, target, line) => (target === 'model' ? { ...d, manualLine: line } : { ...d, genLine: line, points: regenerate(d.points, line, d.noise) })
  const lineOf = (d, target) => (target === 'model' ? d.manualLine : d.genLine)

  const handleDrag = {
    start: (target) => {
      const { doc: d, evaluation: ev } = latest.current
      dragStart.current = { line: lineOf(d, target), mse: ev.mse }
      setDragging(true)
    },
    move: (target, handle, y, first) => {
      changeKind.current = handle === 'centre' ? 'intercept' : 'slope'
      setDoc((d) => applyLine(d, target, dragLine(lineOf(d, target), handle, y)), { transient: !first })
    },
    end: (target, handle, moved) => {
      setDragging(false)
      if (!moved) return
      const { doc: d, evaluation: ev } = latest.current
      setHint(hintForLineDrag({ handle, before: dragStart.current.line, after: lineOf(d, target), mseBefore: dragStart.current.mse, mseAfter: ev.mse, generating: target === 'gen' }))
    },
  }

  const handleKey = (target, handle, dy) => {
    const before = lineOf(doc, target)
    const after = nudgeLine(before, handle, dy)
    changeKind.current = handle === 'centre' ? 'intercept' : 'slope'
    setDoc((d) => applyLine(d, target, nudgeLine(lineOf(d, target), handle, dy)), { transient: continues(`handle-${target}-${handle}`) })
    const mseAfter = target === 'model' ? evaluateLine(points, after).mse : evaluation.mse
    setHint(hintForLineDrag({ handle, before, after, mseBefore: evaluation.mse, mseAfter, generating: target === 'gen' }))
  }

  const setLineValue = (key, value) => {
    changeKind.current = key
    setDoc((d) => ({ ...d, manualLine: { ...d.manualLine, [key]: value } }), { transient: continues(`line-${key}`) })
  }

  const snapToBest = () => {
    setDoc((d) => ({ ...d, manualLine: pickLine(fitLine(d.points)) }))
    setHint('This is the least-squares line: no other straight line has a lower MSE on these points.')
  }

  const editPoint = (id, patch) => {
    const key = Object.keys(patch)[0]
    setDoc(
      (d) => ({
        ...d,
        points: d.points.map((p) => {
          if (p.id !== id) return p
          const next = { ...p, ...patch }
          return toManual({ ...next, ...clampPoint(next.x, next.y) })
        }),
      }),
      { transient: continues(`edit-${id}-${key}`) },
    )
    markDone('drag', 'metrics')
  }

  const movePrediction = (x) => {
    setPredictX(round2(clamp(x, ...DOMAIN.x)))
    markDone('predict')
  }

  const toggleView = (key, on) => {
    setView((v) => ({ ...v, [key]: on }))
    if (!on) return
    if (key === 'residuals') markDone('residuals')
    if (key === 'squares') markDone('squares')
    if (key === 'prediction') markDone('predict')
    setHint(HINTS[key])
  }

  // ---------- Data actions ----------
  const addPoint = (x, y) => {
    if (points.length >= POINT_LIMITS.max) return
    const spot = x == null ? suggestPoint(points, model) : clampPoint(x, y)
    const id = nextId('p')
    setDoc((d) => ({ ...d, mode: leaveModel(d), points: [...d.points, { id, ...spot }] }))
    setSelectedId(id)
    setHint(HINTS.pointAdded)
  }

  const deletePoint = (id = selectedId) => {
    if (!id || points.length <= POINT_LIMITS.min || !points.some((p) => p.id === id)) return
    setDoc((d) => ({ ...d, mode: leaveModel(d), points: d.points.filter((p) => p.id !== id), outlierId: d.outlierId === id ? null : d.outlierId }))
    setSelectedId(null)
    setHint(HINTS.pointDeleted)
  }

  const addOutlier = () => {
    if (outlier || points.length >= POINT_LIMITS.max) return
    const spot = makeOutlier(fit)
    const id = nextId('out')
    setDoc((d) => ({ ...d, mode: leaveModel(d), points: [...d.points, { id, ...spot }], outlierId: id }))
    setSelectedId(id)
    setHint(HINTS.outlierAdded)
    markDone('outlier')
  }

  const removeOutlier = () => {
    setDoc((d) => ({ ...d, points: d.points.filter((p) => p.id !== d.outlierId), outlierId: null }))
    setSelectedId(null)
    setHint('Outlier removed — the line settles back towards the main pattern.')
  }

  const replaceData = (next, extra = {}) => {
    setDoc((d) => {
      let result = { ...d, ...extra, mode: leaveModel(d), points: next, outlierId: null }
      // In Generate Data mode, hand-made data is adopted so it still follows the line.
      if (result.mode === 'generate' && !next.some(isGenerated)) {
        const line = pickLine(fitLine(next))
        const adopted = adoptForGeneration(next, line, null)
        result = { ...result, genLine: line, noise: adopted.noise, points: adopted.points }
      }
      return result
    })
    setSelectedId(null)
  }

  const applySpec = (spec, message) => {
    replaceData(generateDataset(spec), { genLine: spec.line, noise: spec.noise, seed: spec.seed })
    setHint(message)
  }

  const changeNoise = (noise) => {
    const previous = doc.noise
    setDoc((d) => ({ ...d, noise, points: regenerate(d.points, d.genLine, noise) }), { transient: continues('noise') })
    if (noise !== previous) setHint(noise > previous ? HINTS.noiseUp : HINTS.noiseDown)
    markDone('noise')
  }

  const changeSize = (size) => {
    const wanted = Math.min(size, POINT_LIMITS.max - manualCount)
    const next = resizeGenerated(points, wanted, { line: doc.genLine, noise: doc.noise, seed: doc.seed })
    setDoc((d) => ({ ...d, points: next }), { transient: continues('size') })
    setHint(wanted >= generatedCount ? HINTS.sizeUp : HINTS.sizeDown)
  }

  const newSample = () => {
    const seed = Math.floor(Math.random() * 1e9)
    const fresh = generateDataset({ line: doc.genLine, noise: doc.noise, size: Math.max(SAMPLE_RANGE.min, generatedCount), seed })
    setDoc((d) => ({ ...d, seed, points: [...d.points.filter((p) => !isGenerated(p)), ...fresh] }))
    setSelectedId(null)
    setHint(HINTS.newSample)
  }

  // ---------- Challenge ----------
  const startLine = (tilt) => {
    const centre = meanY(points) + (tilt ? (Math.random() - 0.5) * 6 : 0)
    const slope = tilt ? round2((Math.random() - 0.5) * 2) : 0
    return { slope, intercept: round2(centre - slope * 5) }
  }

  const startChallenge = (tilt = false) => {
    const line = startLine(tilt)
    setDoc((d) => ({ ...d, mode: 'model', manualLine: line }))
    setChallenge({ revealed: false })
    setHint(HINTS.challenge)
    markDone('fit')
  }

  const reveal = () => {
    setChallenge({ revealed: true })
    setHint(HINTS.reveal)
    markDone('reveal')
  }

  // ---------- History ----------
  const resetAll = () => {
    setDoc(initialDoc())
    setView(NO_VIEW)
    setChallenge(null)
    setSelectedId(null)
    setHoverId(null)
    setPredictX(7)
    setHint(HINTS.welcome)
  }

  const onKeyDown = (event) => {
    if (event.target.closest('input, textarea, select')) return
    const key = event.key.toLowerCase()
    if ((event.ctrlKey || event.metaKey) && !event.altKey) {
      if (key === 'z' && !event.shiftKey) history.undo()
      else if ((key === 'z' && event.shiftKey) || key === 'y') history.redo()
      else return
      event.preventDefault()
    } else if ((event.key === 'Delete' || event.key === 'Backspace') && selectedRow && mode === 'data') {
      event.preventDefault()
      deletePoint()
    }
  }

  // ---------- Results ----------
  const save = () => {
    const gap = evaluation.mse - bestMse
    onSaveResult?.({
      title: `${equation(model)} · ${points.length} points · ${MODE_NAME[mode]}`,
      metrics: [
        { label: 'MSE', value: fmt(evaluation.mse, 3) },
        { label: 'MAE', value: fmt(evaluation.mae, 3) },
        { label: 'R²', value: evaluation.r2 == null ? '—' : fmt(evaluation.r2, 3) },
        { label: 'SSE', value: fmt(evaluation.sse, 3) },
        { label: 'Least-squares MSE', value: fmt(bestMse, 3) },
      ],
      explanation:
        gap < 1e-3
          ? 'This line is the least-squares solution: no other straight line has a lower training MSE on these points.'
          : `This line's MSE is ${fmt(gap, 3)} above the least-squares minimum (${equation(fit)}).`,
    })
  }

  // ---------- Render ----------
  const full = fullscreen.active
  const editable = mode === 'model' ? 'model' : mode === 'generate' ? 'gen' : null
  const chip = activeChallenge ? MODE_CHIP.challenge : MODE_CHIP[mode]
  const predicted = at(model, predictX)
  const legend = [
    { key: 'data', label: 'Data point', className: 'is-data' },
    { key: 'model', label: activeChallenge ? 'Your line' : mode === 'model' ? 'Model line (yours)' : 'Least-squares line', className: 'is-model' },
    mode === 'generate' && { key: 'gen', label: 'Underlying relationship', className: 'is-gen' },
    showBestLine && { key: 'best', label: 'Best fit', className: 'is-best' },
    view.residuals && { key: 'res', label: 'Residual', className: 'is-residual' },
    view.squares && { key: 'sq', label: 'Squared error', className: 'is-square' },
    outlier && { key: 'out', label: 'Outlier', className: 'is-outlier' },
  ].filter(Boolean)

  return (
    <>
      <section
        ref={rootRef}
        className={`lr-lab${full ? ' is-full' : ''}${fullscreen.overlay ? ' is-overlay' : ''}`}
        aria-label="Linear regression lab"
        onKeyDown={onKeyDown}
        data-mode={mode}
      >
        <header className="lr-head">
          <div className="lr-head-title">
            <p className="lab-kicker">INTERACTIVE LAB · LINEAR REGRESSION</p>
            <h4 className="lr-title">Regression Workbench</h4>
          </div>
          <div className="lr-head-actions">
            <button type="button" className="lr-icon-btn" onClick={history.undo} disabled={!history.canUndo} aria-label="Undo" title="Undo (Ctrl+Z)">
              <Undo2 aria-hidden="true" />
            </button>
            <button type="button" className="lr-icon-btn" onClick={history.redo} disabled={!history.canRedo} aria-label="Redo" title="Redo (Ctrl+Shift+Z)">
              <Redo2 aria-hidden="true" />
            </button>
            <button type="button" className="lab-btn lr-btn-sm" onClick={resetAll}>
              <RotateCcw aria-hidden="true" />
              Reset
            </button>
            <button type="button" className="lab-btn lr-btn-sm lr-full-btn" onClick={fullscreen.toggle} aria-pressed={full}>
              {full ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
              {full ? 'Exit Full Screen' : '⛶ Full Screen'}
            </button>
          </div>
          <div className="lr-head-modes">
            <SegmentedControl label="Interaction mode" value={mode} options={MODES} onChange={switchMode} />
            <p className="lr-mode-lesson">{MODE_LESSON[mode]}</p>
          </div>
          <LabPath done={done} />
        </header>

        <div className="lr-stage">
          <ul className="lr-legend" aria-label="Graph legend">
            {legend.map((item) => (
              <li key={item.key} className={item.className}>
                <span aria-hidden="true" />
                {item.label}
              </li>
            ))}
          </ul>
          <div className="lr-graph">
            <RegressionGraph
              frame={frame}
              rows={evaluation.rows}
              lines={{ model: frame.model, gen: frame.gen, best: frame.best }}
              editable={editable}
              pointsDraggable={mode === 'data'}
              show={view}
              selectedId={selectedId}
              hoverId={dragging ? null : hoverId}
              outlierId={doc.outlierId}
              predictX={predictX}
              predicted={predicted}
              fill={full && wide}
              modeChip={<p className="lr-mode-chip">{chip}</p>}
              onSelect={setSelectedId}
              onHover={setHoverId}
              onPointDrag={pointDrag}
              onHandleDrag={handleDrag}
              onHandleKey={handleKey}
              onPredictDrag={movePrediction}
              onAddAt={(x, y) => addPoint(x, y)}
            />
          </div>
        </div>

        <div className="lr-tools">
          <LabToolbar
            view={view}
            onView={toggleView}
            data={{
              canAdd: points.length < POINT_LIMITS.max,
              canDelete: Boolean(selectedRow) && points.length > POINT_LIMITS.min,
              hasOutlier: Boolean(outlier),
              onAdd: () => addPoint(),
              onDelete: () => deletePoint(),
              onAddOutlier: addOutlier,
              onRemoveOutlier: removeOutlier,
              onResetData: () => {
                replaceData(ORIGINAL_POINTS)
                setHint('Back to the original experiment dataset.')
              },
              onRandom: () => applySpec(randomSpec(), HINTS.random),
            }}
            challenge={{
              active: Boolean(activeChallenge),
              revealed: Boolean(activeChallenge?.revealed),
              onStart: () => startChallenge(false),
              onReveal: reveal,
              onTryAgain: () => startChallenge(true),
            }}
          />
        </div>

        <div className="lr-gen">
          <GeneratorPanel
            generating={mode === 'generate'}
            noise={doc.noise}
            size={mode === 'generate' ? generatedCount : points.length}
            sizeMax={POINT_LIMITS.max - manualCount}
            onPreset={(preset) => applySpec(preset, `${preset.label}: ${preset.note}`)}
            onNoise={changeNoise}
            onSize={changeSize}
            onNewSample={newSample}
            onGenerateMode={() => switchMode('generate')}
          />
        </div>

        <aside className="lr-side" aria-label="Model details">
          <EquationPanel
            line={model}
            mode={mode}
            genLine={doc.genLine}
            change={change}
            fitStatus={fit.status}
            editable={mode === 'model'}
            showSnap={!hideBest}
            onSlope={(value) => setLineValue('slope', value)}
            onIntercept={(value) => setLineValue('intercept', value)}
            onSnap={snapToBest}
          />
          {activeChallenge && (
            <ChallengePanel
              challenge={activeChallenge}
              mse={evaluation.mse}
              bestMse={bestMse}
              onReveal={reveal}
              onTryAgain={() => startChallenge(true)}
              onEnd={() => {
                setChallenge(null)
                setHint(HINTS.model)
              }}
            />
          )}
          <MetricsPanel evaluation={evaluation} bestMse={bestMse} showBest={mode === 'model' && !hideBest} yours={Boolean(activeChallenge)} />
          <HintPanel hint={hint} />
          {view.squares && (
            <p className="lr-squares-note">
              Total area of the squares: <strong>SSE = Σ(yᵢ − ŷᵢ)² = {fmt(evaluation.sse)}</strong>. Least Squares Linear Regression searches for the line that minimizes the total squared error.
            </p>
          )}
          {impact && !hideBest && <OutlierImpact impact={impact} />}
          {view.prediction && <PredictionPanel x={predictX} line={model} dataRange={dataRange} onX={movePrediction} onClose={() => toggleView('prediction', false)} />}
          <PointInspector
            row={selectedRow}
            total={points.length}
            editable={mode === 'data'}
            outlier={selectedRow?.id === doc.outlierId}
            canDelete={points.length > POINT_LIMITS.min}
            onEdit={editPoint}
            onDelete={() => deletePoint()}
          />
          <DatasetTable rows={evaluation.rows} selectedId={selectedId} outlierId={doc.outlierId} editable={mode === 'data'} onSelect={setSelectedId} onEdit={editPoint} />
          <LearningObjectives />
        </aside>
      </section>

      <div className="lab-actions lab-actions-start lr-footer">
        <button type="button" className="lab-btn lab-btn-primary" onClick={save}>
          <Save aria-hidden="true" />
          Save to Results
        </button>
        <button type="button" className="lab-btn" onClick={() => onUsePython?.(pythonCode(points, model))}>
          <Code aria-hidden="true" />
          Use this data in Python
        </button>
      </div>
    </>
  )
}
