import { ArrowRight, Check, ChevronRight, Code, Dice5, Gamepad2, RotateCcw, Save, TriangleAlert, Trophy, X } from 'lucide-react'
import { QUIZ_LENGTH, READY_STEPS, quizCorrect } from './game.js'
import { K_OPTIONS, MODELS, MODEL_ORDER, N, POINTS, QUIZ, TOLERANCE, foldName, num, pct, pctNumber, starsFor } from './model.js'
import { FoldStrip, Stars, StabilityMeter, foldList, foldSizes } from './panels.jsx'
import { EnemySample, PixelLock, PlayerModel } from './sprites.jsx'

// ---------- 1. Entry screen ----------

function IntroPreview() {
  const pellets = Array.from({ length: 9 }, (_, i) => 52 + i * 26)
  return (
    <svg className="cvm-preview" viewBox="0 0 420 150" role="img" aria-label="Preview: the model chomps training pellets and heads for a locked zone full of ghosts">
      <defs>
        <pattern id="cvm-prev-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="8" height="8" className="cvm-hatch-bg" />
          <line x1="0" y1="0" x2="0" y2="8" className="cvm-hatch-line" />
        </pattern>
        {/* Moves with the player, so pellets vanish as they are eaten and return when the loop restarts. */}
        <mask id="cvm-prev-eaten" maskUnits="userSpaceOnUse" x="0" y="0" width="420" height="150">
          <rect x="0" y="0" width="420" height="150" className="cvm-preview-reveal" />
        </mask>
      </defs>
      <rect x="6" y="6" width="408" height="138" rx="12" className="cvm-wall cvm-preview-frame" />
      <path d="M6 52 H150 M190 52 H290 M6 98 H90 M130 98 H290" className="cvm-wall" />
      <rect x="298" y="14" width="108" height="122" rx="8" fill="url(#cvm-prev-hatch)" className="cvm-preview-zone" />
      <path d="M298 14 H406 V136 H298 Z" className="cvm-wall cvm-wall-test" />
      <g transform="translate(352 38)">
        <PixelLock />
      </g>
      <text x="352" y="70" className="cvm-lock-text is-center">
        UNSEEN
      </text>
      <g transform="translate(330 108)">
        <EnemySample kind="typical" state="approach" p={3} />
      </g>
      <g transform="translate(376 108)">
        <EnemySample kind="noisy" state="approach" p={3} />
      </g>
      <g mask="url(#cvm-prev-eaten)">
        {pellets.map((x) => (
          <circle key={x} cx={x} cy="75" r="4" className="cvm-pellet cvm-preview-pellet" />
        ))}
      </g>
      <g className="cvm-preview-player">
        <PlayerModel size={12} />
      </g>
    </svg>
  )
}

export function IntroScreen({ onStart }) {
  return (
    <div className="cvm-intro">
      <p className="lab-kicker">EXPERIMENT 3 · SIMULATION</p>
      <h3 className="cvm-title">
        <Gamepad2 aria-hidden="true" /> CROSS VALIDATION MAZE
      </h3>
      <p className="cvm-subtitle">Can your model survive every unseen data zone?</p>
      <IntroPreview />
      <p className="cvm-tagline">Train on familiar zones. Survive the unseen ones.</p>
      <p className="cvm-lead">
        Your model will train using most of the dataset while one fold remains hidden. Enter the hidden zone and test whether your model can handle data it has never
        seen before.
      </p>
      <button type="button" className="cvm-start" onClick={onStart}>
        [ START GAME ]
      </button>
    </div>
  )
}

// ---------- 4–5. Choose k and model; dataset → maze zones ----------

export function SetupScreen({ game, dispatch }) {
  const { k, modelId } = game
  const sizes = foldSizes(k)
  return (
    <div className="cvm-setup">
      <section aria-labelledby="cvm-k-title">
        <h4 id="cvm-k-title" className="cvm-pixel">
          SELECT CV LEVEL
        </h4>
        <div className="cvm-choice-row">
          {K_OPTIONS.map((option) => (
            <button key={option.k} type="button" className="cvm-choice" aria-pressed={k === option.k} onClick={() => dispatch({ type: 'SET_K', k: option.k })}>
              <strong>{option.k} FOLDS</strong>
              <em>{option.tag}</em>
              <small>
                {option.k} rounds · train on {Math.round(((option.k - 1) / option.k) * 100)}% · {foldSizes(option.k).at(-1)}–{foldSizes(option.k)[0]} test samples per zone
              </small>
            </button>
          ))}
        </div>
        <p className="cvm-explain">
          K determines how many groups the dataset is divided into. Every group becomes the unseen test zone once. This changes the cross-validation itself, not just
          the game difficulty: more folds means more training data per round, but more rounds to play.
        </p>
      </section>

      <section aria-labelledby="cvm-model-title">
        <h4 id="cvm-model-title" className="cvm-pixel">
          MODEL MODE
        </h4>
        <div className="cvm-choice-row">
          {MODEL_ORDER.map((id) => (
            <button key={id} type="button" className={`cvm-choice is-${id}`} aria-pressed={modelId === id} onClick={() => dispatch({ type: 'SET_MODEL', modelId: id })}>
              <strong>{MODELS[id].name.toUpperCase()}</strong>
              <em>{MODELS[id].kind}</em>
              <small>{MODELS[id].blurb}</small>
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="cvm-zones-title">
        <h4 id="cvm-zones-title" className="cvm-pixel">
          DATASET → MAZE ZONES
        </h4>
        <p className="cvm-explain">
          {N} samples are shuffled and dealt into {k} folds. Each glowing dot is one sample. In round 1, Fold 1 is the unseen test zone and {foldList(k, 0)} train the
          model.
        </p>
        <FoldStrip k={k} testFold={0} />
        <p className="cvm-note">
          Test zone: {sizes[0]} samples hidden · Training zones: {N - sizes[0]} samples the model may learn from.
        </p>
      </section>

      <div className="cvm-setup-go">
        <button type="button" className="cvm-start" onClick={() => dispatch({ type: 'BEGIN' })}>
          ENTER THE MAZE <ChevronRight aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

// ---------- 12. Fold rotation ----------

export function TransitionScreen({ game }) {
  const { k, round, results } = game
  return (
    <div className="cvm-transition">
      <p className="cvm-pixel is-yellow cvm-round">
        ROUND {round + 1} / {k}
      </p>
      <p className="cvm-pixel cvm-rotate-line">
        <span className="is-test">TEST: {foldName(round)}</span>
        <span className="is-train">TRAIN: {foldList(k, round)}</span>
      </p>
      <FoldStrip k={k} testFold={round} fromFold={Math.max(0, round - 1)} results={results} big />
      <p className="cvm-explain is-center">
        {round === 0
          ? 'Fold 1 is locked away as unseen data. The model may only learn from the other folds.'
          : `Fold ${round} has been evaluated. The test zone moves to Fold ${round + 1}. Every fold becomes the unseen fold exactly once.`}
      </p>
    </div>
  )
}

// ---------- 6–7. Training header and arcade banners ----------

export function StageHeader({ game }) {
  const { plan, round, phase, trained, modelId } = game
  const fold = plan.folds[round]
  if (phase === 'test' || phase === 'foldResult') {
    return (
      <div className="cvm-stage-head is-test">
        <strong className="cvm-pixel">UNSEEN ZONE · {foldName(round)}</strong>
        <span>Every ghost is a test sample the model has never seen. It survives a ghost when its prediction is within ±{TOLERANCE}.</span>
        {game.crashed && <b className="cvm-crash-tag">MODEL CRASHED · STILL EVALUATING</b>}
      </div>
    )
  }
  const power = modelId === 'overfit'
  return (
    <div className="cvm-stage-head">
      <strong className="cvm-pixel">TRAINING MODE</strong>
      <span>
        Training samples collected: <b className="is-train">{trained}</b> / {fold.trainIdx.length} · Hidden test samples: <b className="is-test">{fold.samples.length}</b>
      </span>
      {power && <b className="cvm-power-tag">POWER MODE ×2</b>}
      {phase === 'ready' && (
        <b className={`cvm-train-score${power ? ' is-power' : ''}`}>TRAINING SCORE: {pct(fold.trainScore)}</b>
      )}
    </div>
  )
}

export function ReadyBanner({ game }) {
  const { step } = game
  return (
    <div className="cvm-banner" aria-live="assertive">
      <p key={step} className={`cvm-banner-text is-step${step}`}>
        {READY_STEPS[step]}
      </p>
      {step >= 2 && <p className="cvm-banner-sub">The model is now entering data it has never seen before.</p>}
    </div>
  )
}

export function CrashBanner() {
  return (
    <div className="cvm-banner is-crash" aria-live="assertive">
      <p className="cvm-banner-text">MODEL CRASHED!</p>
      <p className="cvm-banner-sub">Too many prediction errors. The fold is still evaluated to the end.</p>
    </div>
  )
}

// ---------- 14. Round result ----------

export function StageClear({ game, dispatch }) {
  const { plan, round, k, results } = game
  const fold = plan.folds[round]
  const result = results.find((r) => r.fold === round)
  const last = round + 1 >= k
  const gap = fold.trainScore - fold.score
  return (
    <div className="cvm-overlay" role="dialog" aria-modal="false" aria-labelledby="cvm-clear-title">
      <div className="cvm-overlay-card cvm-clear">
        <h4 id="cvm-clear-title" className={`cvm-pixel cvm-clear-title${result.crashed ? ' is-crash' : ''}`}>
          {result.crashed ? 'MAZE FAILED!' : 'STAGE CLEAR!'}
        </h4>
        <p className="cvm-clear-sub">Fold {round + 1} completed</p>
        <dl className="cvm-clear-stats">
          <div>
            <dt>Test samples</dt>
            <dd>{result.total}</dd>
          </div>
          <div className="is-good">
            <dt>Correct</dt>
            <dd>{result.correct}</dd>
          </div>
          <div className="is-bad">
            <dt>Wrong</dt>
            <dd>{result.wrong}</dd>
          </div>
          <div className="is-main">
            <dt>Accuracy</dt>
            <dd>{pct(result.score)}</dd>
          </div>
          <div>
            <dt>Fold MSE</dt>
            <dd>{num(result.mse, 3)}</dd>
          </div>
          <div>
            <dt>Score</dt>
            <dd>{result.points.toLocaleString()}</dd>
          </div>
        </dl>
        <Stars count={starsFor(result.score)} />
        {result.crashed && <p className="cvm-note">No fold-clear bonus this time: the model ran out of lives. Its accuracy still counts.</p>}
        {gap >= 0.15 && (
          <div className="cvm-alert">
            <TriangleAlert aria-hidden="true" />
            <p>
              <b>⚠ OVERFITTING!</b> Training accuracy {pct(fold.trainScore)} · Validation accuracy {pct(fold.score)} · Gap {pctNumber(gap)} points
            </p>
          </div>
        )}
        <button type="button" className="cvm-start is-small" onClick={() => dispatch({ type: 'NEXT' })} autoFocus>
          {last ? 'SEE CV RESULTS' : 'NEXT LEVEL'} <ArrowRight aria-hidden="true" />
        </button>
        <p className="cvm-explain is-center">
          {last
            ? `Fold ${round + 1} has now been evaluated. Every fold has been the unseen zone exactly once.`
            : `Fold ${round + 1} has now been evaluated. Next, Fold ${round + 2} becomes unseen test data.`}
        </p>
      </div>
    </div>
  )
}

// ---------- 19–21. Final result ----------

const DIAGNOSIS_TEXT = {
  overfit: 'Your model memorized the training maze instead of learning patterns that work in new areas.',
  underfit: 'Your model is too simple: it misses in familiar and unseen zones alike, because it never learned the curve.',
  good: 'Training and unseen scores are close: the model learned a pattern that carries over to new data.',
}

function Generalization({ summary }) {
  const { diagnosis, trainScore, cvScore } = summary
  return (
    <section className={`cvm-card cvm-general is-${diagnosis.id}`} aria-label="Generalization">
      <h5>GENERALIZATION CHECK</h5>
      <p className={`cvm-pixel cvm-diagnosis is-${diagnosis.id}`}>
        {diagnosis.id === 'overfit' ? '⚠ ' : diagnosis.id === 'good' ? '✓ ' : '▼ '}
        {diagnosis.label}
      </p>
      <div className="cvm-bars">
        {[
          ['Training accuracy', trainScore, 'train'],
          ['Validation (CV) accuracy', cvScore, 'test'],
        ].map(([label, value, tone]) => (
          <div key={label} className="cvm-bar-row">
            <span>{label}</span>
            <div className="cvm-bar" title={`${label}: ${pct(value)}`}>
              <i className={`is-${tone}`} style={{ width: `${value * 100}%` }} />
            </div>
            <b>{pct(value)}</b>
          </div>
        ))}
      </div>
      <p className="cvm-gap">
        Generalization gap: <b>{pctNumber(Math.max(0, diagnosis.gap))} points</b>
      </p>
      <p className="cvm-explain">{DIAGNOSIS_TEXT[diagnosis.id]}</p>
    </section>
  )
}

function RunsTable({ runs }) {
  if (runs.length < 2) return null
  return (
    <div className="cvm-runs">
      <table>
        <caption>Models you have played this session</caption>
        <thead>
          <tr>
            <th scope="col">Model</th>
            <th scope="col">K</th>
            <th scope="col">Train</th>
            <th scope="col">CV score</th>
            <th scope="col">Gap</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={`${r.modelId}-${r.k}`}>
              <td>
                {MODELS[r.modelId].name} (deg {r.degree})
              </td>
              <td>{r.k}</td>
              <td>{pct(r.trainScore)}</td>
              <td>{pct(r.cvScore)}</td>
              <td>{pctNumber(Math.max(0, r.gap))} pts</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function CVResults({ game, dispatch, onSave, onPython, saved }) {
  const { plan, results, score, stabilityBonus, runs } = game
  const { summary, k } = plan
  const correct = results.reduce((s, r) => s + r.correct, 0)
  const clears = results.reduce((s, r) => s + r.bonus, 0)
  const others = MODEL_ORDER.filter((id) => id !== plan.modelId)
  return (
    <div className="cvm-final">
      <h3 className="cvm-title is-center">
        <Trophy aria-hidden="true" /> CV MAZE COMPLETE
      </h3>

      <section className="cvm-join" aria-label="Cross validation score">
        <h5 className="cvm-pixel">CROSS VALIDATION SCORE</h5>
        <ol className="cvm-join-tiles" style={{ '--k': k }}>
          {results.map((r) => (
            <li key={r.fold} style={{ '--i': r.fold, '--from': `${(r.fold - (k - 1) / 2) * 40}px` }} className={r.crashed ? 'is-crashed' : undefined}>
              <span>FOLD {r.fold + 1}</span>
              <b>{pct(r.score)}</b>
            </li>
          ))}
        </ol>
        <div className="cvm-formula">
          <p className="cvm-formula-rule">
            CV Score = (S₁ + S₂ + … + S<sub>k</sub>) / K
          </p>
          <p>= ({results.map((r) => pctNumber(r.score)).join(' + ')}) / {k}</p>
          <p className="cvm-formula-total">= {pct(summary.cvScore)}</p>
        </div>
        <p className="cvm-note is-center">
          Fold score = share of that fold’s samples predicted within ±{TOLERANCE}. The same folds give a CV MSE of {num(summary.cvMse, 3)} ± {num(summary.cvMseStd, 3)}.
        </p>
      </section>

      <div className="cvm-final-grid">
        <StabilityMeter stability={summary.stability} bonus={stabilityBonus} />
        <Generalization summary={summary} />
        <section className="cvm-card cvm-breakdown" aria-label="Arcade score">
          <h5>ARCADE SCORE</h5>
          <dl className="cvm-ml-rows">
            <div>
              <dt>Correct predictions × {POINTS.correct}</dt>
              <dd>{(correct * POINTS.correct).toLocaleString()}</dd>
            </div>
            <div>
              <dt>Fold-clear bonuses</dt>
              <dd>{clears.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Stability bonus</dt>
              <dd>{stabilityBonus.toLocaleString()}</dd>
            </div>
            <div className="is-model">
              <dt>Total</dt>
              <dd>{score.toLocaleString()}</dd>
            </div>
          </dl>
          <p className="cvm-note">The arcade score is a reward. The real metric is the CV score above: {pct(summary.cvScore)}.</p>
        </section>
      </div>

      <RunsTable runs={runs} />

      <section className="cvm-card cvm-replay" aria-label="Try another model">
        <h5>COMPARE MODELS ON THE SAME FOLDS</h5>
        <p className="cvm-note">
          {plan.modelId === 'overfit'
            ? 'Replay as Balanced to see what a model that generalizes looks like.'
            : 'Replay as Overfitted to watch a model ace training and struggle in the unseen zones.'}
        </p>
        <div className="cvm-actions">
          {others.map((id) => (
            <button key={id} type="button" className="lab-btn cvm-btn-sm" onClick={() => dispatch({ type: 'REPLAY', modelId: id })}>
              <RotateCcw aria-hidden="true" />
              Replay as {MODELS[id].name}
            </button>
          ))}
        </div>
      </section>

      <div className="cvm-actions cvm-final-actions">
        <button type="button" className="cvm-start is-small" onClick={() => dispatch({ type: 'OPEN_BONUS' })}>
          <Dice5 aria-hidden="true" /> BONUS LEVEL
        </button>
        <button type="button" className="lab-btn" onClick={() => dispatch({ type: 'OPEN_QUIZ' })}>
          Skip to quiz <ChevronRight aria-hidden="true" />
        </button>
        <button type="button" className="lab-btn lab-btn-primary" onClick={onSave} disabled={saved}>
          <Save aria-hidden="true" />
          {saved ? 'Saved' : 'Save to Results'}
        </button>
        <button type="button" className="lab-btn" onClick={onPython}>
          <Code aria-hidden="true" />
          Use this in Python
        </button>
      </div>
    </div>
  )
}

// ---------- 18. Lucky split bonus level ----------

function SplitHistogram({ stats, cvScore }) {
  const max = Math.max(...stats.buckets.map((b) => b.count))
  return (
    <figure className="cvm-hist">
      <figcaption>How {stats.trials} different random 80/20 splits of the same data scored</figcaption>
      <div className="cvm-hist-plot" role="img" aria-label={`Scores ranged from ${pct(stats.worst)} to ${pct(stats.best)}. Cross-validation average ${pct(cvScore)}.`}>
        {stats.buckets.map((b) => (
          <div key={b.score} className="cvm-hist-col" title={`${b.count} splits scored ${pct(b.score)}`}>
            <span className="cvm-hist-count">{b.count || ''}</span>
            <i className={b.score === stats.best ? 'is-best' : undefined} style={{ height: `${(b.count / max) * 100}%` }} />
            <small>{pctNumber(b.score)}</small>
          </div>
        ))}
        <span className="cvm-hist-mean" style={{ left: `${(cvScore * stats.testCount + 0.5) * (100 / (stats.testCount + 1))}%` }}>
          <b>CV {pct(cvScore)}</b>
        </span>
      </div>
      <p className="cvm-note">Bars: number of splits per test score (%). The dashed line marks your cross-validated score.</p>
    </figure>
  )
}

export function LuckySplit({ game, dispatch }) {
  const { lucky, plan, results } = game
  const { stats, stage, answer } = lucky
  const k = plan.k
  return (
    <div className="cvm-lucky">
      <p className="cvm-pixel is-yellow">
        <Dice5 aria-hidden="true" /> BONUS LEVEL
      </p>
      <h3 className="cvm-title">LUCKY SPLIT CHALLENGE</h3>
      {stage === 'intro' && (
        <>
          <p className="cvm-lead">
            Forget the folds. Split the data just once: {N - stats.testCount} samples train, {stats.testCount} are hidden for testing. One maze, one score. The model is
            the same {MODELS[plan.modelId].name.toLowerCase()} model you just played.
          </p>
          <button type="button" className="cvm-start" onClick={() => dispatch({ type: 'RUN_LUCKY' })}>
            RUN ONE RANDOM SPLIT
          </button>
        </>
      )}
      {stage !== 'intro' && (
        <div className="cvm-highscore">
          <p className="cvm-pixel cvm-highscore-title">HIGH SCORE!</p>
          <p className="cvm-highscore-value">{pct(stats.best)}</p>
          <p className="cvm-note is-center">accuracy on one random 80/20 split</p>
        </div>
      )}
      {stage === 'ask' && (
        <div className="cvm-question">
          <p className="cvm-q">Does this prove that your model is excellent?</p>
          <div className="cvm-choice-row is-tight">
            <button type="button" className="cvm-answer" onClick={() => dispatch({ type: 'LUCKY_ANSWER', answer: 'yes' })}>
              YES
            </button>
            <button type="button" className="cvm-answer" onClick={() => dispatch({ type: 'LUCKY_ANSWER', answer: 'no' })}>
              NO
            </button>
          </div>
        </div>
      )}
      {stage === 'reveal' && (
        <>
          <p className={`cvm-feedback ${answer === 'no' ? 'is-good' : 'is-bad'}`}>
            {answer === 'no' ? <Check aria-hidden="true" /> : <X aria-hidden="true" />}
            {answer === 'no' ? 'Correct: NO. One split proves very little.' : 'Not quite. The answer is NO: one split proves very little.'}
          </p>
          <div className="cvm-versus">
            <div className="cvm-versus-side">
              <h5 className="cvm-pixel">ONE RANDOM SPLIT</h5>
              <p className="cvm-versus-big">{pct(stats.best)}</p>
            </div>
            <p className="cvm-pixel cvm-vs">VS</p>
            <div className="cvm-versus-side">
              <h5 className="cvm-pixel">{k}-FOLD CV</h5>
              <ol>
                {results.map((r) => (
                  <li key={r.fold}>
                    <span>Fold {r.fold + 1}</span>
                    <b>{pct(r.score)}</b>
                  </li>
                ))}
              </ol>
              <p className="cvm-versus-avg">Average = {pct(plan.summary.cvScore)}</p>
            </div>
          </div>
          <SplitHistogram stats={stats} cvScore={plan.summary.cvScore} />
          <p className="cvm-explain">
            This split was the luckiest of {stats.trials} random splits. Others scored as low as {pct(stats.worst)}. One maze may have been easy. Cross Validation makes
            the model face several unseen zones.
          </p>
          <button type="button" className="cvm-start is-small" onClick={() => dispatch({ type: 'OPEN_QUIZ' })}>
            BONUS ROUND: QUIZ <ArrowRight aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  )
}

// ---------- 26. Mini quiz ----------

export function CVQuiz({ game, dispatch }) {
  const { index, answers } = game.quiz
  const question = QUIZ[index]
  const chosen = answers[index]
  const answered = chosen != null
  return (
    <div className="cvm-quiz">
      <p className="cvm-pixel is-yellow">BONUS ROUND: TEST YOUR KNOWLEDGE</p>
      <p className="cvm-quiz-count">
        QUESTION {index + 1} / {QUIZ_LENGTH}
      </p>
      <h4 className="cvm-q">{question.q}</h4>
      <div className="cvm-quiz-options">
        {question.options.map((option, i) => {
          const state = !answered ? '' : i === question.answer ? ' is-right' : i === chosen ? ' is-wrong' : ' is-dim'
          return (
            <button key={option} type="button" className={`cvm-answer${state}`} disabled={answered} onClick={() => dispatch({ type: 'QUIZ_ANSWER', choice: i })}>
              <b>{String.fromCharCode(65 + i)}</b> {option}
            </button>
          )
        })}
      </div>
      {answered && (
        <>
          <p className={`cvm-feedback ${chosen === question.answer ? 'is-good' : 'is-bad'}`}>
            {chosen === question.answer ? <Check aria-hidden="true" /> : <X aria-hidden="true" />}
            {chosen === question.answer ? `CORRECT! +${POINTS.quiz}` : `The answer is ${String.fromCharCode(65 + question.answer)}.`} {question.explain}
          </p>
          <button type="button" className="cvm-start is-small" onClick={() => dispatch({ type: 'QUIZ_NEXT' })} autoFocus>
            {index + 1 < QUIZ_LENGTH ? 'NEXT QUESTION' : 'FINISH'} <ArrowRight aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  )
}

// ---------- Experiment complete ----------

export function CompleteScreen({ game, dispatch, onSave, onPython, saved }) {
  const { plan, score } = game
  return (
    <div className="cvm-complete">
      <h3 className="cvm-title is-center">
        <Trophy aria-hidden="true" /> EXPERIMENT COMPLETE
      </h3>
      <dl className="cvm-clear-stats is-wide">
        <div className="is-main">
          <dt>{plan.k}-fold CV score</dt>
          <dd>{pct(plan.summary.cvScore)}</dd>
        </div>
        <div>
          <dt>Model</dt>
          <dd>{MODELS[plan.modelId].name}</dd>
        </div>
        <div>
          <dt>Quiz</dt>
          <dd>
            {quizCorrect(game)} / {QUIZ_LENGTH}
          </dd>
        </div>
        <div>
          <dt>Final score</dt>
          <dd>{score.toLocaleString()}</dd>
        </div>
      </dl>
      <blockquote className="cvm-takeaway">
        The model should not be judged by one lucky test set. Cross Validation repeatedly tests it on different unseen data to measure how well it truly generalizes.
      </blockquote>
      <div className="cvm-actions is-center">
        <button type="button" className="lab-btn lab-btn-primary" onClick={onSave} disabled={saved}>
          <Save aria-hidden="true" />
          {saved ? 'Saved' : 'Save to Results'}
        </button>
        <button type="button" className="lab-btn" onClick={onPython}>
          <Code aria-hidden="true" />
          Use this in Python
        </button>
        <button type="button" className="lab-btn" onClick={() => dispatch({ type: 'RESTART' })}>
          <RotateCcw aria-hidden="true" />
          Play again
        </button>
      </div>
    </div>
  )
}
