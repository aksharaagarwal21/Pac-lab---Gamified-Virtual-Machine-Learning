import { useEffect, useState } from 'react'
import { CURRENT_LEVEL, DAILY_CHALLENGE, LEVELS, objectiveProgress } from '../../data/student.js'
import { say, sfx } from '../../sound.js'
import { Meter, Panel } from './pieces.jsx'

function useTimeUntilMidnight() {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const midnight = new Date(now)
  midnight.setHours(24, 0, 0, 0)
  const seconds = Math.max(0, Math.floor((midnight.getTime() - now) / 1000))
  const pad = (value) => String(value).padStart(2, '0')
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`
}

export function MissionPanel({ onNotify }) {
  const level = CURRENT_LEVEL
  const progress = objectiveProgress(level)

  const resume = () => {
    sfx.enter()
    say(`Level ${level.id}. Resume.`)
    onNotify(`LOADING LEVEL ${level.id} // LAB WORKSPACE COMING SOON`)
  }

  return (
    <Panel title="CONTINUE MISSION" meta={`LEVEL ${level.id} OF ${LEVELS.length}`} className="mission-panel">
      <div className="mission-head">
        <h3 className="mission-title">{level.title}</h3>
        <p className="dash-copy">{level.topic}</p>
      </div>

      <ul className="objective-list">
        {level.objectives.map((objective) => (
          <li key={objective.text} className={objective.done ? 'is-done' : undefined}>
            <span className="objective-box" aria-hidden="true" />
            <span>{objective.text}</span>
            <span className="sr-only">{objective.done ? '(done)' : '(to do)'}</span>
          </li>
        ))}
      </ul>

      <div className="dash-meter-row">
        <Meter value={progress.done} max={progress.total} label={`Level ${level.id} objectives complete`} />
        <span className="meter-value">
          {progress.done}/{progress.total}
        </span>
      </div>

      <button className="arcade-button arcade-button-sm" type="button" onClick={resume}>
        RESUME LAB
      </button>
    </Panel>
  )
}

export function ChallengePanel({ onNotify }) {
  const [accepted, setAccepted] = useState(false)
  const timeLeft = useTimeUntilMidnight()

  const accept = () => {
    setAccepted(true)
    sfx.coin()
    say('Challenge accepted.')
    onNotify(`CHALLENGE ACCEPTED // +${DAILY_CHALLENGE.reward} XP ON CLEAR`)
  }

  return (
    <Panel title="DAILY CHALLENGE" meta={`ENDS IN ${timeLeft}`} className="challenge-panel">
      <div className="mission-head">
        <h3 className="mission-title">{DAILY_CHALLENGE.title}</h3>
        <p className="dash-copy">{DAILY_CHALLENGE.task}</p>
      </div>

      <dl className="challenge-facts">
        <div>
          <dt>REWARD</dt>
          <dd className="challenge-reward">+{DAILY_CHALLENGE.reward} XP</dd>
        </div>
        <div>
          <dt>DIFFICULTY</dt>
          <dd>
            <span className="difficulty" role="img" aria-label={`Difficulty ${DAILY_CHALLENGE.difficulty} of 3`}>
              {[0, 1, 2].map((index) => (
                <span key={index} className={index < DAILY_CHALLENGE.difficulty ? 'is-lit' : undefined} />
              ))}
            </span>
          </dd>
        </div>
      </dl>

      <button className="arcade-button arcade-button-sm" type="button" onClick={accept} disabled={accepted}>
        {accepted ? 'CHALLENGE ACCEPTED' : 'ACCEPT CHALLENGE'}
      </button>
    </Panel>
  )
}
