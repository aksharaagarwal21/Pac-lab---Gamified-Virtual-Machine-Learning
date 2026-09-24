import { useEffect, useState } from 'react'
import { BADGES, LEVELS, PLAYER, RIVALS } from '../../data/student.js'
import { formatNumber, Meter, Sprite } from './pieces.jsx'

function useCountUp(target, duration = 1200) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target)
      return
    }
    let frame
    const start = performance.now()
    const step = (now) => {
      const progress = Math.min(1, (now - start) / duration)
      setValue(Math.round(target * progress))
      if (progress < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])

  return value
}

export function PlayerHero({ playerId, onLogout }) {
  const score = useCountUp(PLAYER.hiScore)
  const xpToGo = PLAYER.xpNext - PLAYER.xp

  return (
    <section className="dash-panel dash-hero" aria-label="Player profile">
      <Sprite kind="pac" className="dash-avatar sprite-chomp" />

      <div className="dash-hero-main">
        <p className="dash-kicker">PLAYER 1 // WELCOME BACK</p>
        <h1 className="dash-player">{playerId}</h1>
        <p className="dash-rank">
          LVL {PLAYER.level} // {PLAYER.rank}
        </p>
        <div className="dash-xp">
          <div className="dash-xp-labels">
            <span>
              {formatNumber(PLAYER.xp)} / {formatNumber(PLAYER.xpNext)} XP
            </span>
            <span>
              {formatNumber(xpToGo)} XP TO LVL {PLAYER.level + 1}
            </span>
          </div>
          <Meter value={PLAYER.xp} max={PLAYER.xpNext} label="Experience toward next level" />
        </div>
      </div>

      <div className="dash-hero-side">
        <p className="dash-hiscore">
          <span className="stat-label">HI-SCORE</span>
          <span className="dash-hiscore-value">{formatNumber(score)}</span>
        </p>
        <button className="arcade-button arcade-button-sm" type="button" onClick={onLogout}>
          LOG OUT
        </button>
      </div>
    </section>
  )
}

export function StatTiles() {
  const ahead = RIVALS.filter((rival) => rival.score > PLAYER.hiScore).map((rival) => rival.score)
  const classRank = ahead.length + 1
  const cleared = LEVELS.filter((level) => level.status === 'cleared').length
  const earned = BADGES.filter((badge) => badge.earnedOn).length

  const tiles = [
    {
      label: 'CLASS RANK',
      value: `#${classRank}`,
      sub: ahead.length ? `${formatNumber(Math.min(...ahead) - PLAYER.hiScore)} PTS TO #${classRank - 1}` : 'TOP OF THE CLASS',
    },
    { label: 'LEVELS CLEARED', value: `${cleared}/${LEVELS.length}`, sub: `${Math.round((cleared / LEVELS.length) * 100)}% OF THE MAZE` },
    { label: 'BADGES', value: `${earned}/${BADGES.length}`, sub: `${BADGES.length - earned} LEFT TO UNLOCK` },
    { label: 'STREAK', value: `${PLAYER.streak} DAYS`, sub: `BEST: ${PLAYER.bestStreak} DAYS` },
  ]

  return (
    <ul className="dash-stats" aria-label="Player stats">
      {tiles.map((tile) => (
        <li key={tile.label} className="stat-tile">
          <span className="stat-label">{tile.label}</span>
          <span className="stat-value">{tile.value}</span>
          <span className="stat-sub">{tile.sub}</span>
        </li>
      ))}
    </ul>
  )
}
