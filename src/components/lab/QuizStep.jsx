import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { clearLab, completeTask, getQuiz, nextUnlockBlocker, saveQuiz, useProgress } from '../../progress.js'
import { say, sfx } from '../../sound.js'

const LETTERS = 'ABCD'
const PASS_RATIO = 0.5

const starsFor = (ratio) => (ratio >= 0.9 ? 3 : ratio >= 0.7 ? 2 : 1)

function Summary({ kind, questions, record, pretest, reward, blocker, onRetake }) {
  const total = questions.length
  const ratio = record.score / total
  const passed = ratio >= PASS_RATIO

  return (
    <div className={`lab-summary${kind === 'posttest' && !passed ? ' is-fail' : ''}`} role="status">
      <p className="lab-kicker">{kind === 'pretest' ? 'PRETEST COMPLETE' : passed ? 'EXPERIMENT CLEARED' : 'NOT CLEARED YET'}</p>
      <p className="lab-summary-score">
        {record.score} / {total}
        <span>{Math.round(ratio * 100)}%</span>
      </p>
      {kind === 'pretest' ? (
        <p className="lab-p">
          This shows what you already know. Work through Procedure and Simulation, then take the Posttest: scoring at least {Math.ceil(total * PASS_RATIO)} / {total} there
          clears this experiment and unlocks the next level.
        </p>
      ) : (
        <p className="lab-p">
          {passed
            ? `You earned ${starsFor(ratio)} of 3 stars.${reward?.xp ? ` +${reward.xp} XP, +${reward.coins} coins.` : ''} ${blocker ?? 'The next level is unlocked.'}`
            : `You need ${Math.ceil(total * PASS_RATIO)} correct answers to clear this experiment and unlock the next level.`}
          {pretest?.finished && ` Pretest: ${pretest.score}/${total} → Posttest: ${record.score}/${total}.`}
        </p>
      )}

      <details className="lab-review">
        <summary>Review answers</summary>
        <ol>
          {questions.map((question, index) => {
            const chosen = record.answers[index]
            const correct = chosen === question.answer
            return (
              <li key={question.prompt} className={correct ? 'is-correct' : 'is-wrong'}>
                <p className="lab-review-q">{question.prompt}</p>
                <p className="lab-review-a">
                  {correct ? 'Correct' : 'Incorrect'}: you chose {chosen === null ? 'nothing' : `${LETTERS[chosen]}. ${question.options[chosen]}`}
                  {!correct && ` · Answer: ${LETTERS[question.answer]}. ${question.options[question.answer]}`}
                </p>
                {question.explain && <p className="lab-review-e">{question.explain}</p>}
              </li>
            )
          })}
        </ol>
      </details>

      <button type="button" className="lab-btn" onClick={onRetake}>
        <RotateCcw aria-hidden="true" />
        Retake {kind}
      </button>
    </div>
  )
}

// Pretest / posttest: one question at a time, with instant feedback and a saved attempt.
export function QuizStep({ lab, kind, questions }) {
  const progress = useProgress()
  const saved = getQuiz(progress, lab.id, kind)
  const pretest = getQuiz(progress, lab.id, 'pretest')
  const blank = { answers: questions.map(() => null), score: 0, finished: false }
  const record = saved ?? blank
  const submitted = record.answers.filter((answer) => answer !== null).length
  const firstOpen = record.answers.findIndex((answer) => answer === null)

  const [index, setIndex] = useState(firstOpen === -1 ? questions.length - 1 : firstOpen)
  const [choice, setChoice] = useState(null)
  const [reward, setReward] = useState(null)
  const question = questions[index]
  const revealed = record.answers[index] !== null
  const title = kind === 'pretest' ? 'Pretest' : 'Posttest'

  // Runs as soon as the last question is answered, so the step counts even if "See results" is never pressed.
  const complete = (score) => {
    if (kind === 'pretest') {
      completeTask(lab.id, 'pretest')
      return
    }
    if (score / questions.length >= PASS_RATIO) {
      completeTask(lab.id, 'posttest')
      setReward(clearLab(lab.id, starsFor(score / questions.length)))
      sfx.powerUp()
      say(nextUnlockBlocker(progress, lab.id) ? 'Experiment cleared! Finish the Python speed code to unlock the next level.' : 'Experiment cleared! Next level unlocked.')
    }
  }

  const submit = () => {
    if (choice === null) return
    const answers = record.answers.map((answer, i) => (i === index ? choice : answer))
    const score = answers.filter((answer, i) => answer === questions[i].answer).length
    saveQuiz(lab.id, kind, { answers, score, finished: false })
    if (choice === question.answer) sfx.coin()
    else sfx.denied()
    if (answers.every((answer) => answer !== null)) complete(score)
  }

  const next = () => {
    setChoice(null)
    if (record.answers.every((answer) => answer !== null)) {
      saveQuiz(lab.id, kind, { ...record, finished: true })
      sfx.notice()
      return
    }
    const nextOpen = record.answers.findIndex((answer, i) => answer === null && i > index)
    setIndex(nextOpen === -1 ? record.answers.findIndex((answer) => answer === null) : nextOpen)
    sfx.select()
  }

  const retake = () => {
    saveQuiz(lab.id, kind, blank)
    setIndex(0)
    setChoice(null)
    setReward(null)
    sfx.replay()
  }

  return (
    <section className="lab-quiz" aria-labelledby={`lab-${kind}-title`}>
      <div className="lab-quiz-top">
        <p className="lab-kicker">KNOWLEDGE CHECK</p>
        {!record.finished && (
          <span className="lab-pill">
            Question {index + 1} / {questions.length}
          </span>
        )}
      </div>
      <h3 id={`lab-${kind}-title`} className="lab-title">
        {title}
      </h3>
      <div className="lab-meter" role="progressbar" aria-label={`${title} progress`} aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={submitted}>
        <span style={{ width: `${(submitted / questions.length) * 100}%` }} />
      </div>
      <p className="lab-muted">
        {submitted} submitted · {questions.length - submitted} remaining
      </p>

      {record.finished ? (
        <Summary blocker={nextUnlockBlocker(progress, lab.id)} kind={kind} questions={questions} record={record} pretest={kind === 'posttest' ? pretest : null} reward={reward} onRetake={retake} />
      ) : (
        <>
          <span className={`lab-level is-${question.level}`}>{question.level.toUpperCase()}</span>
          <fieldset className="lab-question" key={index}>
            <legend className="lab-question-text">{question.prompt}</legend>
            <div className="lab-options">
              {question.options.map((option, optionIndex) => {
                const chosen = revealed ? record.answers[index] : choice
                let state = ''
                if (revealed && optionIndex === question.answer) state = ' is-correct'
                else if (revealed && optionIndex === chosen) state = ' is-wrong'
                return (
                  <label key={option} className={`lab-option${chosen === optionIndex ? ' is-chosen' : ''}${state}`}>
                    <input
                      type="radio"
                      name={`${kind}-${index}`}
                      checked={chosen === optionIndex}
                      disabled={revealed}
                      onChange={() => setChoice(optionIndex)}
                    />
                    <span className="lab-option-key" aria-hidden="true">
                      {LETTERS[optionIndex]}
                    </span>
                    <span>{option}</span>
                  </label>
                )
              })}
            </div>
          </fieldset>

          {revealed && (
            <p className={`lab-feedback${record.answers[index] === question.answer ? ' is-good' : ' is-bad'}`} role="status">
              <strong>{record.answers[index] === question.answer ? 'Correct.' : `Not quite. The answer is ${LETTERS[question.answer]}.`}</strong>{' '}
              {question.explain}
            </p>
          )}

          <div className="lab-actions">
            {revealed ? (
              <button type="button" className="lab-btn lab-btn-primary" onClick={next}>
                {submitted === questions.length ? 'See results' : 'Next question'}
              </button>
            ) : (
              <button type="button" className="lab-btn lab-btn-primary" onClick={submit} disabled={choice === null}>
                Submit answer
              </button>
            )}
          </div>
        </>
      )}
    </section>
  )
}
