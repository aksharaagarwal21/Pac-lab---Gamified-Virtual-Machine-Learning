import { Crosshair, Dices, Eye, Plus, RefreshCw, RotateCcw, Shuffle, Sparkles, SquareDashed, Target, Trash2, TriangleAlert, Waypoints } from 'lucide-react'
import { ToggleChip } from '../../../components/lab/interactive/controls.jsx'
import { Slider } from '../../../components/lab/simKit.jsx'
import { PRESETS, SAMPLE_RANGE, noiseLabel } from './model.js'

// Controls below the graph: view layers, data actions and the fitting challenge.
export function LabToolbar({ view, onView, data, challenge }) {
  return (
    <div className="lr-toolbar">
      <div className="lr-tool-group" role="group" aria-label="Show on graph">
        <span className="lr-tool-label">Show</span>
        <ToggleChip label="Residuals" icon={Waypoints} checked={view.residuals} onChange={(on) => onView('residuals', on)} />
        <ToggleChip label="Error Squares" icon={SquareDashed} checked={view.squares} onChange={(on) => onView('squares', on)} />
        <ToggleChip label="Prediction" icon={Crosshair} checked={view.prediction} onChange={(on) => onView('prediction', on)} />
      </div>

      <div className="lr-tool-group" role="group" aria-label="Change the data">
        <span className="lr-tool-label">Data</span>
        <button type="button" className="lab-btn lr-btn-sm" onClick={data.onAdd} disabled={!data.canAdd}>
          <Plus aria-hidden="true" />
          Add Point
        </button>
        <button type="button" className="lab-btn lr-btn-sm" onClick={data.onDelete} disabled={!data.canDelete}>
          <Trash2 aria-hidden="true" />
          Delete Selected
        </button>
        {data.hasOutlier ? (
          <button type="button" className="lab-btn lr-btn-sm lr-btn-outlier" onClick={data.onRemoveOutlier}>
            <TriangleAlert aria-hidden="true" />
            Remove Outlier
          </button>
        ) : (
          <button type="button" className="lab-btn lr-btn-sm lr-btn-outlier" onClick={data.onAddOutlier} disabled={!data.canAdd}>
            <TriangleAlert aria-hidden="true" />+ Add Outlier
          </button>
        )}
        <button type="button" className="lab-btn lr-btn-sm" onClick={data.onResetData}>
          <RotateCcw aria-hidden="true" />
          Reset Dataset
        </button>
        <button type="button" className="lab-btn lr-btn-sm" onClick={data.onRandom}>
          <Dices aria-hidden="true" />
          Random Dataset
        </button>
      </div>

      <div className="lr-tool-group" role="group" aria-label="Challenge">
        <span className="lr-tool-label">Challenge</span>
        {challenge.active ? (
          <>
            {!challenge.revealed && (
              <button type="button" className="lab-btn lab-btn-primary lr-btn-sm" onClick={challenge.onReveal}>
                <Eye aria-hidden="true" />
                Reveal Best Fit
              </button>
            )}
            <button type="button" className="lab-btn lr-btn-sm" onClick={challenge.onTryAgain}>
              <RefreshCw aria-hidden="true" />
              Try Again
            </button>
          </>
        ) : (
          <button type="button" className="lab-btn lab-btn-primary lr-btn-sm" onClick={challenge.onStart}>
            <Target aria-hidden="true" />
            Try Fitting the Line
          </button>
        )}
      </div>
    </div>
  )
}

// Presets, noise and sample size. Noise and size only reshape data in Generate Data mode.
export function GeneratorPanel({ generating, noise, size, sizeMax, onPreset, onNoise, onSize, onNewSample, onGenerateMode }) {
  return (
    <section className="lr-generator" aria-label="Data generator">
      <div className="lr-presets" role="group" aria-label="Dataset presets">
        {PRESETS.map((preset) => (
          <button key={preset.id} type="button" className="lr-preset" onClick={() => onPreset(preset)}>
            <span aria-hidden="true">{preset.symbol}</span>
            {preset.label}
          </button>
        ))}
      </div>
      <div className={`lr-gen-sliders${generating ? '' : ' is-locked'}`}>
        <Slider label="Noise" min={0} max={1} step={0.01} value={noise} onChange={onNoise} disabled={!generating} format={(value) => noiseLabel(value)} />
        <Slider
          label="Number of Data Points"
          min={SAMPLE_RANGE.min}
          max={Math.max(SAMPLE_RANGE.min, sizeMax)}
          step={1}
          value={Math.max(SAMPLE_RANGE.min, size)}
          onChange={onSize}
          disabled={!generating}
        />
        {generating ? (
          <button type="button" className="lab-btn lr-btn-sm" onClick={onNewSample}>
            <Shuffle aria-hidden="true" />
            New Sample
          </button>
        ) : (
          <button type="button" className="lab-btn lr-btn-sm" onClick={onGenerateMode}>
            <Sparkles aria-hidden="true" />
            Use Generate Data
          </button>
        )}
      </div>
      <p className="lr-note">
        {generating
          ? 'More noise makes the relationship harder for the model to learn. More observations can provide a more reliable estimate of the underlying relationship.'
          : 'Noise and sample size reshape generated data only, so your own data is never changed. Switch to Generate Data to use them.'}
      </p>
    </section>
  )
}
