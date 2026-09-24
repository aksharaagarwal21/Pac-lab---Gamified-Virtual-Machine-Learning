import { useEffect } from 'react'
import { useParams } from '@tanstack/react-router'
import { Award, ClipboardCheck, Coins, Flag, FlaskConical, Lock, LogIn, Star, Target, Trophy, Zap } from 'lucide-react'
import { FacultyShell } from '../../components/faculty/FacultyShell.jsx'
import {
  BADGE_ICONS,
  Breadcrumbs,
  LoadState,
  StatusPill,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
  timeAgo,
} from '../../components/faculty/facultyUi.jsx'
import { levelFor } from '../../data/achievements.js'
import { labNumber } from '../../data/labs.js'
import { useFacultyData } from '../../lib/facultyApi.js'
import { usePageMeta } from '../../meta.js'
import { say } from '../../sound.js'

const EVENT_ICONS = { login: LogIn, open_step: LogIn, quiz_submit: ClipboardCheck, simulation_saved: FlaskConical, experiment_cleared: Flag, badge_earned: Award }
const EXPERIMENT_STATUS = { cleared: 'Cleared', in_progress: 'In progress', ready: 'Ready', locked: 'Locked' }

function Stars({ count }) {
  return (
    <span className="hm-progress-stars" role="img" aria-label={`${count} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <Star key={i} className={i < count ? 'is-earned' : undefined} aria-hidden="true" />
      ))}
    </span>
  )
}

export default function FacultyStudent() {
  const { studentId } = useParams({ strict: false })
  const { data, error } = useFacultyData(`/students/${encodeURIComponent(studentId)}`)

  usePageMeta(`${studentId} | Faculty Console`, `Progress, badges and activity for student ${studentId}.`)

  useEffect(() => {
    if (data) say(`${data.student.name}. Rank ${data.student.rank} in ${data.student.className}.`)
  }, [data])

  if (!data) {
    return (
      <FacultyShell>
        <main className="mz-container lab-page hm-page fc-page">
          <Breadcrumbs items={[{ label: 'Classes', to: '/faculty' }, { label: studentId }]} />
          <LoadState error={error} what="student dashboard" />
        </main>
      </FacultyShell>
    )
  }

  const { student, experiments, badges, activity, quizzes, simulations, heat } = data
  const level = levelFor(student.xp)
  const earnedCount = badges.filter((badge) => badge.earnedAt).length
  const maxHeat = Math.max(1, ...heat.map((h) => h.events))
  const heatLevel = (events) => (events === 0 ? 0 : Math.min(4, Math.ceil((events / maxHeat) * 4)))
  const activeDays = heat.filter((h) => h.events > 0).length

  const stats = [
    { label: 'Total XP', value: formatNumber(student.xp), icon: Zap },
    { label: 'Coins', value: formatNumber(student.coins), icon: Coins },
    { label: 'Stars', value: `${student.stars} / 30`, icon: Star },
    { label: 'Experiments cleared', value: `${student.cleared} / 10`, icon: Flag },
    { label: 'Avg pretest → posttest', value: `${formatPercent(student.avgPretest)} → ${formatPercent(student.avgPosttest)}`, icon: Target },
  ]

  return (
    <FacultyShell>
      <main className="mz-container lab-page hm-page fc-page">
        <Breadcrumbs
          items={[
            { label: 'Classes', to: '/faculty' },
            { label: student.className, to: '/faculty/class/$classCode', params: { classCode: student.className } },
            { label: student.name },
          ]}
        />

        <section className="hm-dash-head" aria-labelledby="fc-student-name">
          <div className="hm-player">
            <p className="hm-kicker">STUDENT DASHBOARD</p>
            <h1 id="fc-student-name" className="fc-student-name">
              {student.name}
            </h1>
            <p className="fc-student-sub">
              {student.id} · {student.email}
            </p>
            <p className="hm-player-level">
              Level {level.level} · {level.name}
            </p>
            <div className="hm-xp">
              <div className="hm-xp-top">
                <span>{formatNumber(student.xp)} XP</span>
                <span>{level.next ? `${formatNumber(level.next.min - student.xp)} XP to ${level.next.name}` : 'Top level reached'}</span>
              </div>
              <div className="lab-meter" role="progressbar" aria-label="Progress to next level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level.progress * 100)}>
                <span style={{ width: `${level.progress * 100}%` }} />
              </div>
            </div>
            <p className="fc-student-sub">
              <StatusPill status={student.status} />
              <span>
                Last active {timeAgo(student.lastActiveAt)} · Enrolled {formatDate(student.enrolledOn)}
              </span>
            </p>
          </div>

          <div className="hm-rank-card">
            <Trophy aria-hidden="true" />
            <p className="hm-rank-num">#{student.rank}</p>
            <p className="lab-muted">
              of {student.classSize} students in {student.className}
            </p>
            <p className="fc-overall">
              #{formatNumber(student.overallRank)} of {formatNumber(student.overallTotal)} across all classes
            </p>
            <p className="lab-muted">
              {student.departmentName} · Semester {student.semester}
              <br />
              Advisor: {student.advisor}
            </p>
          </div>
        </section>

        <ul className="hm-stats" aria-label="Student totals">
          {stats.map(({ label, value, icon: Icon }) => (
            <li key={label} className="hm-stat">
              <Icon aria-hidden="true" />
              <span className="hm-stat-value">{value}</span>
              <span className="hm-stat-label">{label}</span>
            </li>
          ))}
        </ul>

        <div className="hm-dash-grid">
          <section className="hm-panel" aria-labelledby="fc-exp-title">
            <div className="hm-panel-head">
              <h2 id="fc-exp-title" className="hm-panel-title">
                Experiment progress
              </h2>
              <span className="lab-pill">{student.cleared} / 10 cleared</span>
            </div>
            <ol className="hm-progress">
              {experiments.map((e) => (
                <li key={e.id}>
                  <div className={`fc-sprogress-row${e.status === 'locked' ? ' is-locked' : ''}`}>
                    <span className="hm-progress-num">{labNumber(e.id)}</span>
                    <span className="fc-sprogress-title">
                      <strong>{e.title}</strong>
                      <small>
                        {e.status === 'cleared'
                          ? `Cleared ${formatDate(e.clearedAt)} · ${e.minutes} min`
                          : e.status === 'locked'
                            ? 'Unlocks after the previous experiment'
                            : `${e.steps} of 8 steps · started ${formatDate(e.startedAt)}`}
                      </small>
                    </span>
                    <span className="fc-sprogress-scores">
                      <span>Pre {e.pretest ?? '—'}</span>
                      <span aria-hidden="true">→</span>
                      <span className={e.posttest === null ? undefined : `fc-score ${e.posttest >= 10 ? 'is-pass' : 'is-fail'}`}>Post {e.posttest ?? '—'}</span>
                      {e.posttestAttempts > 1 && <small>{e.posttestAttempts} tries</small>}
                    </span>
                    <Stars count={e.stars} />
                    <span className={`hm-status is-${e.status}`}>{EXPERIMENT_STATUS[e.status]}</span>
                  </div>
                </li>
              ))}
            </ol>
            <p className="lab-muted">Quiz scores are out of 20. A posttest of 10 or more clears the experiment.</p>
          </section>

          <section className="hm-panel" aria-labelledby="fc-badges-title">
            <div className="hm-panel-head">
              <h2 id="fc-badges-title" className="hm-panel-title">
                Badges
              </h2>
              <span className="lab-pill">
                {earnedCount} / {badges.length}
              </span>
            </div>
            <ul className="hm-badges">
              {badges.map((badge) => {
                const Icon = BADGE_ICONS[badge.icon] ?? Award
                const earned = Boolean(badge.earnedAt)
                return (
                  <li key={badge.id} className={`hm-badge${earned ? ' is-earned' : ''}`}>
                    <span className="hm-badge-icon">{earned ? <Icon aria-hidden="true" /> : <Lock aria-hidden="true" />}</span>
                    <span>
                      <strong>{badge.name}</strong>
                      <small>{earned ? `Earned ${formatDate(badge.earnedAt)}` : badge.goal}</small>
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>

        <div className="fc-two-col">
          <section className="hm-panel" aria-labelledby="fc-activity-title">
            <div className="hm-panel-head">
              <h2 id="fc-activity-title" className="hm-panel-title">
                Activity
              </h2>
              <span className="lab-pill">{activeDays} active days in 8 weeks</span>
            </div>
            <div className="fc-heat" role="img" aria-label={`Activity over the last 8 weeks: active on ${activeDays} of 56 days`}>
              {heat.map((h) => (
                <span key={h.day} className={`fc-heat-cell is-${heatLevel(h.events)}`} title={`${formatDate(h.day)}: ${h.events} events`} />
              ))}
            </div>
            <ol className="fc-timeline">
              {activity.map((item, index) => {
                const Icon = EVENT_ICONS[item.event] ?? LogIn
                return (
                  <li key={`${item.at}-${index}`} className={`is-${item.event}`}>
                    <span className="fc-timeline-icon">
                      <Icon aria-hidden="true" />
                    </span>
                    <span>
                      <strong>{item.detail}</strong>
                      <small>
                        {item.experimentId ? `Experiment ${labNumber(item.experimentId)} · ` : ''}
                        {formatDateTime(item.at)}
                      </small>
                    </span>
                  </li>
                )
              })}
            </ol>
          </section>

          <section className="hm-panel" aria-labelledby="fc-quiz-title">
            <div className="hm-panel-head">
              <h2 id="fc-quiz-title" className="hm-panel-title">
                Quiz attempts
              </h2>
              <span className="lab-pill">{quizzes.length} latest</span>
            </div>
            {quizzes.length ? (
              <div className="lab-table-wrap">
                <table className="lab-table fc-quiz-table">
                  <caption className="mz-sr-only">Latest pretest and posttest attempts</caption>
                  <thead>
                    <tr>
                      <th scope="col">Experiment</th>
                      <th scope="col">Quiz</th>
                      <th scope="col">Score</th>
                      <th scope="col">Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quizzes.map((q, index) => (
                      <tr key={`${q.at}-${index}`}>
                        <td>
                          <span className="fc-student-cell">
                            <span>{labNumber(q.experimentId)}</span>
                            <small>{q.title}</small>
                          </span>
                        </td>
                        <td>
                          {q.kind === 'pretest' ? 'Pretest' : 'Posttest'}
                          {q.attempt > 1 ? ` #${q.attempt}` : ''}
                        </td>
                        <td>
                          <span className={q.kind === 'posttest' ? `fc-score ${q.score * 2 >= q.total ? 'is-pass' : 'is-fail'}` : undefined}>
                            {q.score}/{q.total}
                          </span>
                        </td>
                        <td className="fc-nowrap">{formatDateTime(q.at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="lab-muted">No quizzes submitted yet.</p>
            )}
          </section>
        </div>

        <section className="hm-panel" aria-labelledby="fc-sims-title">
          <div className="hm-panel-head">
            <h2 id="fc-sims-title" className="hm-panel-title">
              Saved simulation results
            </h2>
            <FlaskConical className="fc-panel-icon" aria-hidden="true" />
          </div>
          {simulations.length ? (
            <ul className="fc-sims">
              {simulations.map((sim, index) => (
                <li key={`${sim.at}-${index}`} className="fc-sim-card">
                  <span className="hm-progress-num">EXPERIMENT {labNumber(sim.experimentId)}</span>
                  <strong>{sim.title}</strong>
                  <span className="fc-metric-chips">
                    {sim.metrics.map((metric) => (
                      <span key={metric.label}>
                        {metric.label} <b>{metric.value}</b>
                      </span>
                    ))}
                  </span>
                  <small className="lab-muted">{formatDateTime(sim.at)}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="lab-muted">No simulation results saved yet.</p>
          )}
        </section>
      </main>
    </FacultyShell>
  )
}
