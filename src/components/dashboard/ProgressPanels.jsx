import { PLAYER, RIVALS, RUNS, SKILLS } from '../../data/student.js'
import { formatNumber, Panel } from './pieces.jsx'

const MAX_SKILL = 10
const PLACES = ['1ST', '2ND', '3RD', '4TH', '5TH', '6TH']

export function SkillStats() {
  return (
    <Panel title="SKILL STATS" meta={`MAX ${MAX_SKILL}`}>
      <ul className="skill-list">
        {SKILLS.map((skill, row) => (
          <li key={skill.name} className="skill-row">
            <span className="skill-name">{skill.name}</span>
            <span className="skill-blocks" role="img" aria-label={`${skill.value} of ${MAX_SKILL}`}>
              {Array.from({ length: MAX_SKILL }, (_, index) => {
                const lit = index < skill.value
                return <span key={index} className={lit ? 'is-lit' : undefined} style={lit ? { '--i': row * 2 + index } : undefined} />
              })}
            </span>
            <span className="skill-value">{skill.value}</span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

export function RunLog() {
  return (
    <Panel title="RECENT RUNS" meta={`LAST ${RUNS.length}`}>
      <ol className="run-log">
        {RUNS.map((run) => (
          <li key={`${run.name}-${run.when}`} className="run-row">
            <span className="run-level">{run.level}</span>
            <span className="run-name">{run.name}</span>
            <span className="run-xp">+{run.xp} XP</span>
            <span className="run-result">{run.result}</span>
            <span className="run-when">{run.when}</span>
          </li>
        ))}
      </ol>
    </Panel>
  )
}

export function Leaderboard({ playerId }) {
  const rows = [...RIVALS, { id: playerId, score: PLAYER.hiScore, isYou: true }].sort((a, b) => b.score - a.score)

  return (
    <Panel title="HIGH SCORES" meta="YOUR CLASS">
      <ol className="score-list">
        {rows.map((row, index) => (
          <li key={row.isYou ? 'you' : row.id} className={`score-row${row.isYou ? ' is-you' : ''}`}>
            <span className="score-rank">{PLACES[index]}</span>
            <span className="score-name">
              {row.id}
              {row.isYou && <span className="score-you">YOU</span>}
            </span>
            <span className="score-points">{formatNumber(row.score)}</span>
          </li>
        ))}
      </ol>
    </Panel>
  )
}
