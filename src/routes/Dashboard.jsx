import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronRight, Coins, Crown, Flag, FlaskConical, Footprints, Lock, Medal, Star, Target, Trophy, Zap } from 'lucide-react'
import { Select } from '../components/lab/simKit.jsx'
import { MazeShell } from '../components/maze/MazeShell.jsx'
import { BADGES, levelFor } from '../data/achievements.js'
import { CLASSES, classLeaderboard, classRanking, readClass, saveClass } from '../data/classes.js'
import { LABS, labNumber } from '../data/labs.js'
import { usePageMeta } from '../meta.js'
import { labStatus, totalStars, useProgress } from '../progress.js'
import { getStudent } from '../session.js'
import { say, sfx } from '../sound.js'

const BADGE_ICONS = { Footprints, Flag, FlaskConical, Star, Target, Medal, Coins, Crown }
const STATUS_LABEL = { cleared: 'Cleared', ready: 'Ready', locked: 'Locked' }
const TOP_ROWS = 10

function Leaderboard({ roster, ranking, className, view, onView }) {
  const you = roster.find((row) => row.isYou)
  const rows = roster.slice(0, TOP_ROWS)
  if (you && you.rank > TOP_ROWS) rows.push(you)

  return (
    <section className="hm-panel" aria-labelledby="hm-board-title">
      <div className="hm-panel-head">
        <h2 id="hm-board-title" className="hm-panel-title">
          Leaderboard
        </h2>
        <div className="hm-segment" role="tablist" aria-label="Leaderboard view">
          {[
            ['class', `My class (${className})`],
            ['all', 'All classes'],
          ].map(([value, label]) => (
            <button key={value} type="button" role="tab" aria-selected={view === value} onClick={() => onView(value)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="lab-table-wrap">
        {view === 'class' ? (
          <table className="lab-table hm-board">
            <caption className="mz-sr-only">{className} leaderboard</caption>
            <thead>
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">Student</th>
                <th scope="col">Cleared</th>
                <th scope="col">Stars</th>
                <th scope="col">XP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={row.isYou ? 'is-you' : undefined}>
                  <td className="hm-rank">{row.rank <= 3 ? <Medal aria-label={`Rank ${row.rank}`} className={`hm-medal is-${row.rank}`} /> : row.rank}</td>
                  <td>
                    {row.id}
                    {row.isYou && <span className="hm-you">YOU</span>}
                  </td>
                  <td>
                    {row.cleared}/{LABS.length}
                  </td>
                  <td>{row.stars}</td>
                  <td className="hm-xp-cell">{row.xp.toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="lab-table hm-board">
            <caption className="mz-sr-only">Class ranking by average XP</caption>
            <thead>
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">Class</th>
                <th scope="col">Students</th>
                <th scope="col">Average XP</th>
                <th scope="col">Top student</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((entry) => (
                <tr key={entry.className} className={entry.isYours ? 'is-you' : undefined}>
                  <td className="hm-rank">{entry.rank}</td>
                  <td>
                    {entry.className}
                    {entry.isYours && <span className="hm-you">YOURS</span>}
                  </td>
                  <td>{entry.students}</td>
                  <td className="hm-xp-cell">{entry.averageXp.toLocaleString('en-IN')}</td>
                  <td>{entry.topStudent.isYou ? 'You' : entry.topStudent.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {import.meta.env.DEV && <p className="lab-muted">Classmates are sample data until student accounts are connected to a server.</p>}
    </section>
  )
}

export default function Dashboard() {
  const progress = useProgress()
  const studentId = getStudent() ?? 'ML-2026-001'
  const [className, setClassName] = useState(() => readClass(studentId))
  const [view, setView] = useState('class')

  const xp = progress.xp
  const stars = totalStars(progress)
  const cleared = Object.keys(progress.cleared).length
  const level = levelFor(xp)
  const you = { id: studentId, className, xp, cleared, stars }
  const roster = classLeaderboard(className, you)
  const position = roster.find((row) => row.isYou).rank
  const ranking = classRanking(you)
  const earnedCount = BADGES.filter((badge) => badge.earned(progress)).length

  usePageMeta('Dashboard | ML Virtual Lab', 'Your XP, badges, experiment progress and class leaderboard.')

  useEffect(() => {
    say(`Dashboard. You are number ${position} in your class.`)
    // Only on arrival, not every time the rank changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const changeClass = (value) => {
    setClassName(value)
    saveClass(studentId, value)
    sfx.select()
  }

  const stats = [
    { label: 'Total XP', value: xp.toLocaleString('en-IN'), icon: Zap },
    { label: 'Coins', value: progress.coins.toLocaleString('en-IN'), icon: Coins },
    { label: 'Stars', value: `${stars} / ${LABS.length * 3}`, icon: Star },
    { label: 'Experiments cleared', value: `${cleared} / ${LABS.length}`, icon: Flag },
  ]

  return (
    <MazeShell>
      <main className="mz-container lab-page hm-page">
        <section className="hm-dash-head" aria-labelledby="hm-player">
          <div className="hm-player">
            <p className="hm-kicker">PLAYER DASHBOARD</p>
            <h1 id="hm-player" className="hm-player-id">
              {studentId}
            </h1>
            <p className="hm-player-level">
              Level {level.level} · {level.name}
            </p>
            <div className="hm-xp">
              <div className="hm-xp-top">
                <span>{xp.toLocaleString('en-IN')} XP</span>
                <span>{level.next ? `${(level.next.min - xp).toLocaleString('en-IN')} XP to ${level.next.name}` : 'Top level reached'}</span>
              </div>
              <div className="lab-meter" role="progressbar" aria-label="Progress to next level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level.progress * 100)}>
                <span style={{ width: `${level.progress * 100}%` }} />
              </div>
            </div>
          </div>

          <div className="hm-rank-card">
            <Trophy aria-hidden="true" />
            <p className="hm-rank-num">#{position}</p>
            <p className="lab-muted">
              of {roster.length} students in {className}
            </p>
            <Select label="Your class" value={className} onChange={changeClass} options={CLASSES.map((name) => ({ value: name, label: name }))} />
          </div>
        </section>

        <ul className="hm-stats" aria-label="Your totals">
          {stats.map(({ label, value, icon: Icon }) => (
            <li key={label} className="hm-stat">
              <Icon aria-hidden="true" />
              <span className="hm-stat-value">{value}</span>
              <span className="hm-stat-label">{label}</span>
            </li>
          ))}
        </ul>

        <div className="hm-dash-grid">
          <Leaderboard
            roster={roster}
            ranking={ranking}
            className={className}
            view={view}
            onView={(value) => {
              setView(value)
              sfx.select()
            }}
          />

          <section className="hm-panel" aria-labelledby="hm-badges-title">
            <div className="hm-panel-head">
              <h2 id="hm-badges-title" className="hm-panel-title">
                Badges
              </h2>
              <span className="lab-pill">
                {earnedCount} / {BADGES.length}
              </span>
            </div>
            <ul className="hm-badges">
              {BADGES.map((badge) => {
                const Icon = BADGE_ICONS[badge.icon]
                const earned = badge.earned(progress)
                return (
                  <li key={badge.id} className={`hm-badge${earned ? ' is-earned' : ''}`}>
                    <span className="hm-badge-icon">{earned ? <Icon aria-hidden="true" /> : <Lock aria-hidden="true" />}</span>
                    <span>
                      <strong>{badge.name}</strong>
                      <small>{badge.goal}</small>
                      <span className="mz-sr-only">{earned ? '(earned)' : '(locked)'}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>

        <section className="hm-panel" aria-labelledby="hm-progress-title">
          <div className="hm-panel-head">
            <h2 id="hm-progress-title" className="hm-panel-title">
              Experiment progress
            </h2>
            <Link to="/student/maze" className="lab-back">
              Open the maze
              <ChevronRight aria-hidden="true" />
            </Link>
          </div>
          <ol className="hm-progress">
            {LABS.map((lab) => {
              const status = labStatus(progress, lab.id)
              const labStars = progress.cleared[lab.id]?.stars ?? 0
              const row = (
                <>
                  <span className="hm-progress-num">{labNumber(lab.id)}</span>
                  <span className="hm-progress-title">{lab.title}</span>
                  <span className="hm-progress-stars" role="img" aria-label={`${labStars} of 3 stars`}>
                    {[0, 1, 2].map((i) => (
                      <Star key={i} className={i < labStars ? 'is-earned' : undefined} aria-hidden="true" />
                    ))}
                  </span>
                  <span className={`hm-status is-${status}`}>{STATUS_LABEL[status]}</span>
                </>
              )
              return (
                <li key={lab.id}>
                  {status === 'locked' ? (
                    <div className="hm-progress-row is-locked">{row}</div>
                  ) : (
                    <Link to="/student/lab/$labId" params={{ labId: String(lab.id) }} className="hm-progress-row">
                      {row}
                    </Link>
                  )}
                </li>
              )
            })}
          </ol>
        </section>
      </main>
    </MazeShell>
  )
}
