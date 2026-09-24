import { useState } from 'react'
import { BADGES } from '../../data/student.js'
import { say, sfx } from '../../sound.js'
import { Panel, Sprite } from './pieces.jsx'

const FILTERS = [
  ['all', 'ALL'],
  ['earned', 'EARNED'],
  ['locked', 'LOCKED'],
]

function BadgeIcon({ badge }) {
  if (badge.glyph) return <span className="badge-glyph">{badge.glyph}</span>
  if (badge.sprite === 'power') return <Sprite kind="pellet" className="badge-sprite badge-power" />
  if (badge.sprite.startsWith('ghost-')) return <Sprite kind="ghost" color={badge.sprite.slice(6)} className="badge-sprite" />
  return <Sprite kind={badge.sprite} className="badge-sprite" />
}

export function BadgeCase({ onNotify }) {
  const [filter, setFilter] = useState('all')
  const earnedCount = BADGES.filter((badge) => badge.earnedOn).length
  const shown = BADGES.filter((badge) => filter === 'all' || (filter === 'earned') === Boolean(badge.earnedOn))

  const inspect = (badge) => {
    if (badge.earnedOn) {
      sfx.coin()
      say(badge.name.toLowerCase())
      onNotify(`${badge.name} // EARNED ${badge.earnedOn}`)
    } else {
      sfx.denied()
      onNotify(`LOCKED // ${badge.goal.toUpperCase()}`)
    }
  }

  const chooseFilter = (value) => {
    sfx.select()
    setFilter(value)
  }

  return (
    <Panel title="BADGES EARNED" meta={`${earnedCount}/${BADGES.length} COLLECTED`}>
      <div className="dash-tabs" role="group" aria-label="Filter badges">
        {FILTERS.map(([value, label]) => (
          <button key={value} type="button" className="dash-tab" aria-pressed={filter === value} onClick={() => chooseFilter(value)}>
            {label}
          </button>
        ))}
      </div>

      <ul className="badge-grid">
        {shown.map((badge) => (
          <li key={badge.name}>
            <button type="button" className={`badge-tile${badge.earnedOn ? '' : ' is-locked'}`} onClick={() => inspect(badge)}>
              <span className="badge-emblem">
                <BadgeIcon badge={badge} />
              </span>
              <span className="badge-name">{badge.name}</span>
              <span className="badge-goal">{badge.goal}</span>
              <span className="badge-status">{badge.earnedOn ? `EARNED ${badge.earnedOn}` : 'LOCKED'}</span>
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
