// Shared pieces of the game-mode pretest / posttest components (QuizRace.jsx, RedLightQuiz.jsx).

export const LETTERS = 'ABCD'
export const PASS_RATIO = 0.5
// Bonus per correct answer. Whole runs must stay under RACE_BONUS_CAP in server/studentSync.js.
export const LEVEL_REWARD = {
  beginner: { xp: 10, coins: 2 },
  intermediate: { xp: 15, coins: 3 },
  advanced: { xp: 20, coins: 4 },
}
export const COMBO_EVERY = 3
export const COMBO_COINS = 5

export const starsFor = (ratio) => (ratio >= 0.9 ? 3 : ratio >= 0.7 ? 2 : 1)
export const isTyping = (target) => target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
export const fullscreenElement = () => document.fullscreenElement ?? document.webkitFullscreenElement ?? null

export function toggleElementFullscreen(element) {
  if (fullscreenElement()) {
    ;(document.exitFullscreen ?? document.webkitExitFullscreen)?.call(document)?.catch?.(() => {})
  } else {
    ;(element.requestFullscreen ?? element.webkitRequestFullscreen)?.call(element)?.catch?.(() => {})
  }
}

export function Review({ questions, record, verb = 'you chose' }) {
  return (
    <details className="lab-review">
      <summary>Review answers from your last run</summary>
      <ol>
        {questions.map((question, index) => {
          const chosen = record.answers[index]
          const correct = chosen === question.answer
          return (
            <li key={question.prompt} className={correct ? 'is-correct' : 'is-wrong'}>
              <p className="lab-review-q">{question.prompt}</p>
              <p className="lab-review-a">
                {chosen === null ? 'Not reached' : correct ? 'Correct' : 'Incorrect'}
                {chosen !== null && `: ${verb} ${LETTERS[chosen]}. ${question.options[chosen]}`}
                {!correct && ` · Answer: ${LETTERS[question.answer]}. ${question.options[question.answer]}`}
              </p>
              {question.explain && <p className="lab-review-e">{question.explain}</p>}
            </li>
          )
        })}
      </ol>
    </details>
  )
}
