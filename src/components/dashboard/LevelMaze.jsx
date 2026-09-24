import { CURRENT_LEVEL, LEVELS, objectiveProgress } from '../../data/student.js'
import { say, sfx } from '../../sound.js'
import { Panel, Sprite, Stars } from './pieces.jsx'

export function LevelMaze({ onNotify }) {
  const cleared = LEVELS.filter((level) => level.status === 'cleared').length
  const currentProgress = objectiveProgress(CURRENT_LEVEL).percent

  const chooseLevel = (level) => {
    if (level.status === 'locked') {
      sfx.denied()
      onNotify(`LEVEL ${level.id} LOCKED // CLEAR LEVEL ${level.id - 1} FIRST`)
    } else if (level.status === 'current') {
      sfx.enter()
      say(`Level ${level.id}. ${currentProgress} percent complete.`)
      onNotify(`LEVEL ${level.id} // ${currentProgress}% COMPLETE`)
    } else {
      sfx.select()
      onNotify(`LEVEL ${level.id} CLEARED // ${level.stars}/3 STARS`)
    }
  }

  return (
    <Panel title="THE MAZE" meta={`${cleared}/${LEVELS.length} LEVELS CLEARED`}>
      <div className="maze-scroll">
        <ol className="maze-track">
          {LEVELS.map((level) => (
            <li key={level.id} className={`maze-stop is-${level.status}`}>
              <button
                type="button"
                className="maze-node"
                title={level.topic}
                aria-current={level.status === 'current' ? 'step' : undefined}
                onClick={() => chooseLevel(level)}
              >
                <span className="maze-icon">
                  {level.status === 'cleared' && <Sprite kind="pellet" className="maze-pellet" />}
                  {level.status === 'current' && <Sprite kind="pac" className="maze-pac sprite-chomp" />}
                  {level.status === 'locked' && <Sprite kind="ghost" color="frightened" className="maze-ghost" />}
                </span>
                <span className="maze-level">LV {level.id}</span>
                <span className="maze-title">{level.title}</span>
                {level.status === 'cleared' && <Stars count={level.stars} />}
                {level.status === 'current' && <span className="maze-progress">{currentProgress}%</span>}
                {level.status === 'locked' && <span className="maze-locked">LOCKED</span>}
              </button>
            </li>
          ))}
        </ol>
      </div>
    </Panel>
  )
}
