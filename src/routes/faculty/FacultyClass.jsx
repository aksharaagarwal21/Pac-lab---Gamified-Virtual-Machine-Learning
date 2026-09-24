import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { Activity, ArrowRight, BookOpenCheck, ChevronDown, FlaskConical, LayoutDashboard, Medal, Search, Target, TriangleAlert, Trophy, Users, Zap } from 'lucide-react'
import { FacultyShell } from '../../components/faculty/FacultyShell.jsx'
import { QuickSearch } from '../../components/faculty/QuickSearch.jsx'
import {
  Breadcrumbs,
  LoadState,
  MiniMeter,
  STATUS_META,
  STATUS_ORDER,
  StatusPill,
  formatNumber,
  formatPercent,
  timeAgo,
  formatDateTime,
} from '../../components/faculty/facultyUi.jsx'
import { CountUp, Drawer, ExperimentTrack, RankRace, SectionPanel, SectionTabs, StatusDonut, useSectionTab } from '../../components/faculty/interactive.jsx'
import { Legend } from '../../components/lab/charts.jsx'
import { levelFor } from '../../data/achievements.js'
import { labNumber } from '../../data/labs.js'
import { useFacultyData } from '../../lib/facultyApi.js'
import { usePageMeta } from '../../meta.js'
import { say, sfx } from '../../sound.js'

const SECTION_IDS = ['overview', 'students', 'leaderboard', 'experiments', 'activity']
const STATUS_COLORS = { excelling: '#f5c518', on_track: '#34d399', attention: '#fb923c', inactive: '#ff5c8a' }

const SORTS = {
  rank: (a, b) => a.rank - b.rank,
  name: (a, b) => a.name.localeCompare(b.name),
  cleared: (a, b) => b.cleared - a.cleared || a.rank - b.rank,
  posttest: (a, b) => (b.avgPosttest ?? -1) - (a.avgPosttest ?? -1),
  active: (a, b) => new Date(b.lastActiveAt ?? 0) - new Date(a.lastActiveAt ?? 0),
}

const BOARD_METRICS = [
  { id: 'xp', label: 'XP', value: (s) => s.xp, format: (v) => `${formatNumber(Math.round(v))} XP` },
  { id: 'stars', label: 'Stars', value: (s) => s.stars, format: (v) => `${Math.round(v)} stars` },
  { id: 'cleared', label: 'Experiments cleared', value: (s) => s.cleared, format: (v) => `${Math.round(v)} / 10` },
  { id: 'posttest', label: 'Avg posttest', value: (s) => s.avgPosttest ?? 0, format: (v) => formatPercent(v) },
]

const dayLabel = (day) => new Date(`${day}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
const longDay = (day) => new Date(`${day}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

const nowOn = (s, experiments) =>
  !s.currentExperiment ? 'All cleared' : !s.started ? 'Not started' : `${labNumber(s.currentExperiment)} · ${experiments.find((e) => e.id === s.currentExperiment)?.mission ?? ''}`

function PersonButton({ student, onPreview }) {
  return (
    <button type="button" className="fc-person" onClick={() => onPreview(student.id)}>
      <span>{student.name}</span>
      <small>{student.id}</small>
    </button>
  )
}

// ---------- Overview ----------

function OverviewSection({ info, students, experiments, activity, onStatus, onOpen, onExperiment, onPreview }) {
  const count = students.length
  const average = (pick) => (count ? students.reduce((sum, s) => sum + pick(s), 0) / count : 0)
  const withPosttest = students.filter((s) => s.avgPosttest !== null)
  const statusCounts = Object.fromEntries(STATUS_ORDER.map((key) => [key, students.filter((s) => s.status === key).length]))
  const whereNow = experiments
    .map((e) => ({ ...e, now: students.filter((s) => s.started && s.currentExperiment === e.id).length }))
    .filter((e) => e.now > 0)
  const nowMax = Math.max(1, ...whereNow.map((e) => e.now))
  const week = activity.slice(-7)
  const weekMax = Math.max(1, ...week.map((d) => d.events))

  const stats = [
    { label: 'Students', value: count, format: undefined, icon: Users },
    { label: 'Average XP', value: average((s) => s.xp), icon: Zap },
    { label: 'Avg experiments cleared', value: average((s) => s.cleared), format: (v) => `${v.toFixed(1)} / 10`, icon: BookOpenCheck },
    {
      label: 'Avg posttest',
      value: withPosttest.length ? withPosttest.reduce((sum, s) => sum + s.avgPosttest, 0) / withPosttest.length : 0,
      format: (v) => formatPercent(v),
      icon: Target,
    },
    { label: 'Finished all 10', value: students.filter((s) => s.cleared >= 10).length, icon: Trophy },
    { label: 'Need attention or inactive', value: statusCounts.attention + statusCounts.inactive, icon: TriangleAlert },
  ]

  return (
    <>
      <section className="fc-class-head" aria-labelledby="fc-class-title">
        <div>
          <p className="hm-kicker">{info.departmentName}</p>
          <h1 id="fc-class-title" className="fc-class-title">
            {info.code}
            {info.isMine && <span className="hm-you">YOUR CLASS</span>}
          </h1>
          <p className="fc-hero-lead">
            Semester {info.semester} · {info.academicYear} · Room {info.room}
          </p>
        </div>
        <div className="fc-advisor">
          <span className="lab-muted">Class advisor</span>
          <strong>{info.advisor.name}</strong>
          <span className="lab-muted">{info.advisor.designation}</span>
          <a href={`mailto:${info.advisor.email}`} className="fc-link">
            {info.advisor.email}
          </a>
        </div>
      </section>

      <ul className="hm-stats fc-stats" aria-label={`${info.code} at a glance`}>
        {stats.map(({ label, value, format, icon: Icon }) => (
          <li key={label} className="hm-stat">
            <Icon aria-hidden="true" />
            <span className="hm-stat-value">
              <CountUp value={value} format={format} />
            </span>
            <span className="hm-stat-label">{label}</span>
          </li>
        ))}
      </ul>

      <div className="fc-overview-grid is-three">
        <section className="hm-panel" aria-labelledby="fc-status-title">
          <div className="hm-panel-head">
            <h2 id="fc-status-title" className="hm-panel-title">
              Student status
            </h2>
          </div>
          <p className="lab-muted">Select a status to open those students.</p>
          <StatusDonut
            total={count}
            centerLabel="students"
            segments={STATUS_ORDER.map((key) => ({ key, label: STATUS_META[key].label, value: statusCounts[key], color: STATUS_COLORS[key] }))}
            onSelect={(key) => {
              sfx.select()
              onStatus(key)
              onOpen('students')
            }}
          />
        </section>

        <section className="hm-panel" aria-labelledby="fc-top-title">
          <div className="hm-panel-head">
            <h2 id="fc-top-title" className="hm-panel-title">
              Top of the class
            </h2>
            <Trophy className="fc-panel-icon" aria-hidden="true" />
          </div>
          <ol className="fc-top-list">
            {students.slice(0, 5).map((s) => (
              <li key={s.id}>
                <span className="hm-rank">{s.rank <= 3 ? <Medal className={`hm-medal is-${s.rank}`} aria-label={`Rank ${s.rank}`} /> : s.rank}</span>
                <PersonButton student={s} onPreview={onPreview} />
                <span className="hm-xp-cell">{formatNumber(s.xp)}</span>
              </li>
            ))}
          </ol>
          <button type="button" className="lab-btn" onClick={() => onOpen('leaderboard')}>
            Full leaderboard
            <ArrowRight aria-hidden="true" />
          </button>
        </section>

        <section className="hm-panel" aria-labelledby="fc-now-title">
          <div className="hm-panel-head">
            <h2 id="fc-now-title" className="hm-panel-title">
              Where students are now
            </h2>
            <FlaskConical className="fc-panel-icon" aria-hidden="true" />
          </div>
          {whereNow.length ? (
            <ul className="fc-dept-chart">
              {whereNow.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    className="fc-dept-bar"
                    onClick={() => {
                      sfx.select()
                      onExperiment(e.id)
                      onOpen('experiments')
                    }}
                  >
                    <span className="fc-dept-code">{labNumber(e.id)}</span>
                    <span className="fc-dept-track" aria-hidden="true">
                      <span style={{ width: `${(e.now / nowMax) * 100}%` }} />
                    </span>
                    <span className="fc-dept-value">
                      {e.now} <small>{e.mission}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="lab-muted">Everyone has either finished or not started.</p>
          )}
        </section>
      </div>

      <section className="hm-panel" aria-labelledby="fc-week-title">
        <div className="hm-panel-head">
          <h2 id="fc-week-title" className="hm-panel-title">
            This week
          </h2>
          <button type="button" className="lab-btn" onClick={() => onOpen('activity')}>
            Open activity
            <ArrowRight aria-hidden="true" />
          </button>
        </div>
        <div className="fc-week" role="img" aria-label={`Events in the last 7 days: ${week.map((d) => `${dayLabel(d.day)} ${d.events}`).join(', ')}`}>
          {week.map((d) => (
            <span key={d.day} className="fc-week-day">
              <span className="fc-week-track">
                <span className="fc-week-bar" style={{ height: `${(d.events / weekMax) * 100}%` }} />
              </span>
              <strong>{d.events}</strong>
              <small>{new Date(`${d.day}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short' })}</small>
            </span>
          ))}
        </div>
      </section>
    </>
  )
}

// ---------- Students ----------

function StudentsSection({ students, experiments, status, setStatus, onPreview }) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('rank')

  const counts = useMemo(() => Object.fromEntries(STATUS_ORDER.map((key) => [key, students.filter((s) => s.status === key).length])), [students])
  const rows = useMemo(() => {
    const text = query.trim().toLowerCase()
    return students
      .filter((s) => status === 'all' || s.status === status)
      .filter((s) => !text || `${s.name} ${s.id}`.toLowerCase().includes(text))
      .sort(SORTS[sort])
  }, [students, status, query, sort])

  return (
    <section className="hm-panel" aria-labelledby="fc-students-title">
      <div className="hm-panel-head">
        <h2 id="fc-students-title" className="hm-panel-title">
          Students <span className="lab-pill">{rows.length}</span>
        </h2>
      </div>
      <div className="fc-toolbar">
        <label className="fc-search">
          <Search aria-hidden="true" />
          <span className="mz-sr-only">Filter students</span>
          <input type="search" placeholder="Filter by name or roll number" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <label className="fc-sort">
          <span>Sort</span>
          <select className="lab-select" value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="rank">Rank (XP)</option>
            <option value="name">Name</option>
            <option value="cleared">Experiments cleared</option>
            <option value="posttest">Average posttest</option>
            <option value="active">Last active</option>
          </select>
        </label>
      </div>

      <div className="fc-chips" role="group" aria-label="Filter by status">
        {[['all', 'All students', students.length], ...STATUS_ORDER.map((key) => [key, STATUS_META[key].label, counts[key]])].map(([key, label, n]) => (
          <button
            key={key}
            type="button"
            className={`fc-chip is-${key}`}
            aria-pressed={status === key}
            onClick={() => {
              setStatus(key)
              sfx.select()
            }}
          >
            {key !== 'all' && <span className="fc-dot" style={{ background: STATUS_COLORS[key] }} aria-hidden="true" />}
            {label}
            <span>{n}</span>
          </button>
        ))}
      </div>

      <p className="lab-muted" aria-live="polite">
        Showing {rows.length} of {students.length}. Select a row for a quick look, or a name to open the full dashboard.
      </p>

      <div className="lab-table-wrap">
        <table className="lab-table fc-students">
          <caption className="mz-sr-only">Students in this class</caption>
          <thead>
            <tr>
              <th scope="col">Rank</th>
              <th scope="col">Student</th>
              <th scope="col">Level</th>
              <th scope="col">XP</th>
              <th scope="col">Cleared</th>
              <th scope="col">Stars</th>
              <th scope="col">Avg posttest</th>
              <th scope="col">Now on</th>
              <th scope="col">Last active</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const level = levelFor(s.xp)
              return (
                <tr
                  key={s.id}
                  className="fc-row"
                  onClick={(event) => {
                    if (event.target.closest('a, button')) return
                    onPreview(s.id)
                  }}
                >
                  <td className="hm-rank">{s.rank <= 3 ? <Medal aria-label={`Rank ${s.rank}`} className={`hm-medal is-${s.rank}`} /> : s.rank}</td>
                  <td>
                    <span className="fc-student-cell">
                      <Link to="/faculty/student/$studentId" params={{ studentId: s.id }} className="fc-link" onClick={() => sfx.enter()}>
                        {s.name}
                      </Link>
                      <small>{s.id}</small>
                    </span>
                  </td>
                  <td>
                    <span className="fc-level">
                      L{level.level} · {level.name}
                    </span>
                  </td>
                  <td className="hm-xp-cell">{formatNumber(s.xp)}</td>
                  <td>
                    <MiniMeter value={s.cleared} max={10} label={`${s.cleared} of 10 experiments cleared`} />
                  </td>
                  <td>{s.stars}</td>
                  <td>{formatPercent(s.avgPosttest)}</td>
                  <td className="fc-nowrap">{nowOn(s, experiments)}</td>
                  <td className="fc-nowrap">{timeAgo(s.lastActiveAt)}</td>
                  <td>
                    <button type="button" className="fc-peek" onClick={() => onPreview(s.id)} aria-label={`Quick look at ${s.name}`}>
                      <StatusPill status={s.status} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ---------- Leaderboard ----------

function LeaderboardSection({ students, onPreview }) {
  const [metricId, setMetricId] = useState('xp')
  const metric = BOARD_METRICS.find((m) => m.id === metricId)
  const podium = [...students].sort((a, b) => metric.value(b) - metric.value(a) || a.rank - b.rank).slice(0, 3)

  return (
    <section className="hm-panel" aria-labelledby="fc-board-title">
      <div className="hm-panel-head">
        <h2 id="fc-board-title" className="hm-panel-title">
          Class leaderboard
        </h2>
        <div className="hm-segment fc-wrap-segment" role="group" aria-label="Rank students by">
          {BOARD_METRICS.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={metricId === m.id}
              onClick={() => {
                setMetricId(m.id)
                sfx.select()
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <ol className="fc-podium" aria-label={`Top three by ${metric.label.toLowerCase()}`}>
        {podium.map((s, index) => (
          <li key={s.id} className={`fc-podium-card is-${index + 1}`}>
            <Medal className={`hm-medal is-${index + 1}`} aria-hidden="true" />
            <span className="fc-podium-rank">#{index + 1}</span>
            <button type="button" className="fc-podium-name" onClick={() => onPreview(s.id)}>
              {s.name}
            </button>
            <span className="fc-podium-xp">{metric.format(metric.value(s))}</span>
            <span className="lab-muted">
              {s.cleared}/10 cleared · {s.stars} stars
            </span>
          </li>
        ))}
      </ol>

      <RankRace
        label={`Students ranked by ${metric.label.toLowerCase()}`}
        format={metric.format}
        items={students.map((s) => ({
          key: s.id,
          name: s.name,
          value: metric.value(s),
          title: (
            <>
              <button type="button" className="fc-person-inline" onClick={() => onPreview(s.id)}>
                {s.name}
              </button>
              <small>{s.id}</small>
            </>
          ),
        }))}
      />
    </section>
  )
}

// ---------- Experiments ----------

function PeopleGroup({ title, people, empty, tone, onPreview }) {
  return (
    <div className={`fc-people${tone ? ` is-${tone}` : ''}`}>
      <p className="lab-question-text">
        {title} <span className="lab-pill">{people.length}</span>
      </p>
      {people.length ? (
        <div className="fc-people-list">
          {people.map((s) => (
            <PersonButton key={s.id} student={s} onPreview={onPreview} />
          ))}
        </div>
      ) : (
        <p className="lab-muted">{empty}</p>
      )}
    </div>
  )
}

function ExperimentsSection({ experiments, students, open, setOpen, onPreview }) {
  const classSize = students.length

  useEffect(() => {
    if (open) document.getElementById(`fc-exp-${open}`)?.scrollIntoView({ block: 'nearest' })
    // Only when arriving from the overview with an experiment already chosen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section className="hm-panel" aria-labelledby="fc-exp-title">
      <div className="hm-panel-head">
        <h2 id="fc-exp-title" className="hm-panel-title">
          Experiments
        </h2>
        <Legend
          items={[
            { label: 'Cleared', color: '#34d399' },
            { label: 'Working on it now', color: '#f5c518' },
          ]}
        />
      </div>
      <p className="lab-muted">Select an experiment to see who is working on it and who is stuck.</p>
      <ol className="fc-exp-list">
        {experiments.map((e) => {
          const expanded = open === e.id
          const working = students.filter((s) => s.started && s.currentExperiment === e.id)
          return (
            <li key={e.id} className={`fc-exp-item${expanded ? ' is-open' : ''}`}>
              <button
                type="button"
                className="fc-exp-row fc-exp-toggle"
                aria-expanded={expanded}
                aria-controls={`fc-exp-${e.id}`}
                onClick={() => {
                  sfx.select()
                  setOpen(expanded ? null : e.id)
                }}
              >
                <span className="fc-exp-num">{labNumber(e.id)}</span>
                <span className="fc-exp-title">
                  <strong>{e.title}</strong>
                  <small>
                    {e.mission} · {e.tier}
                  </small>
                </span>
                <span className="fc-exp-bars">
                  <span className="fc-exp-bar fc-anim-fill" aria-hidden="true">
                    <span className="is-cleared" style={{ width: `${classSize ? (e.cleared / classSize) * 100 : 0}%` }} />
                    <span className="is-working" style={{ width: `${classSize ? (e.working / classSize) * 100 : 0}%` }} />
                  </span>
                  <span className="fc-exp-bar-text">
                    {e.cleared} cleared · {e.working} working · {classSize - e.cleared - e.working} not reached
                  </span>
                </span>
                <span className="fc-exp-figures">
                  <span>
                    <strong>{e.avgStars ?? '—'}</strong>
                    <small>Avg stars</small>
                  </span>
                  <span>
                    <strong>
                      {formatPercent(e.avgPretest)} → {formatPercent(e.avgPosttest)}
                    </strong>
                    <small>Pretest → passing posttest</small>
                  </span>
                  <span>
                    <strong>{e.avgMinutes ? `${e.avgMinutes} min` : '—'}</strong>
                    <small>Avg time to clear</small>
                  </span>
                </span>
                <ChevronDown className="fc-exp-chevron" aria-hidden="true" />
              </button>
              {expanded && (
                <div id={`fc-exp-${e.id}`} className="fc-exp-details">
                  <PeopleGroup
                    title="Working on it now"
                    people={working.filter((s) => !s.failedCurrent)}
                    empty="Nobody is on this experiment right now."
                    onPreview={onPreview}
                  />
                  <PeopleGroup title="Failed the posttest" tone="bad" people={working.filter((s) => s.failedCurrent)} empty="No failed posttests." onPreview={onPreview} />
                  {e.id === 1 && <PeopleGroup title="Not started yet" people={students.filter((s) => !s.started)} empty="Everyone has started." onPreview={onPreview} />}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

// ---------- Activity ----------

function ActivitySection({ activity, classSize }) {
  const [metric, setMetric] = useState('events')
  // Start on yesterday: today is still in progress and would look unusually quiet.
  const [selected, setSelected] = useState(Math.max(0, activity.length - 2))
  const values = activity.map((d) => (metric === 'events' ? d.events : d.students))
  const max = Math.max(1, ...values)
  const total = activity.reduce((sum, d) => sum + d.events, 0)
  const averageEvents = total / activity.length
  const averageActive = activity.reduce((sum, d) => sum + d.students, 0) / activity.length
  const peak = activity.reduce((best, d) => (d.events > best.events ? d : best), activity[0])
  const day = activity[selected]
  const difference = averageEvents ? Math.round((day.events / averageEvents - 1) * 100) : 0

  return (
    <section className="hm-panel" aria-labelledby="fc-activity-title">
      <div className="hm-panel-head">
        <h2 id="fc-activity-title" className="hm-panel-title">
          Daily activity · last 28 days
        </h2>
        <div className="hm-segment" role="group" aria-label="Chart shows">
          {[
            ['events', 'Events'],
            ['students', 'Active students'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={metric === id}
              onClick={() => {
                setMetric(id)
                sfx.select()
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <ul className="fc-mini-stats">
        <li>
          <strong>
            <CountUp value={total} />
          </strong>
          <span>Events in 28 days</span>
        </li>
        <li>
          <strong>
            {Math.round(averageActive)} / {classSize}
          </strong>
          <span>Students active on an average day</span>
        </li>
        <li>
          <strong>{dayLabel(peak.day)}</strong>
          <span>Busiest day ({formatNumber(peak.events)} events)</span>
        </li>
      </ul>

      <div className="fc-activity" role="group" aria-label="Select a day to see its details">
        {activity.map((d, i) => (
          <button
            key={d.day}
            type="button"
            className={`fc-activity-col${i === selected ? ' is-selected' : ''}`}
            aria-pressed={i === selected}
            aria-label={`${dayLabel(d.day)}: ${d.events} events, ${d.students} active students`}
            onClick={() => {
              setSelected(i)
              sfx.select()
            }}
          >
            <span className="fc-activity-track">
              <span className="fc-activity-bar" style={{ height: `${(values[i] / max) * 100}%` }} />
            </span>
            <span className="fc-activity-day">{i % 7 === 0 || i === activity.length - 1 ? dayLabel(d.day) : ''}</span>
          </button>
        ))}
      </div>

      <div className="fc-day-detail" aria-live="polite">
        <strong>{longDay(day.day)}</strong>
        <span>
          <b>{formatNumber(day.events)}</b> events
        </span>
        <span>
          <b>{day.students}</b> of {classSize} students active ({formatPercent(classSize ? day.students / classSize : 0)})
        </span>
        <span className={difference >= 0 ? 'is-up' : 'is-down'}>
          {difference >= 0 ? `${difference}% above` : `${Math.abs(difference)}% below`} the 28-day average
        </span>
      </div>
    </section>
  )
}

// ---------- Quick look drawer ----------

function StudentPreview({ id }) {
  const { data, error } = useFacultyData(`/students/${encodeURIComponent(id)}`)
  if (!data) return <LoadState error={error} what="student" />
  const { student, experiments, activity } = data
  const level = levelFor(student.xp)

  return (
    <div className="fc-preview">
      <div className="fc-preview-top">
        <p className="fc-preview-name">{student.name}</p>
        <StatusPill status={student.status} />
      </div>
      <p className="lab-muted">
        {student.id} · #{student.rank} of {student.classSize} in {student.className} · last active {timeAgo(student.lastActiveAt)}
      </p>
      <div className="hm-xp">
        <div className="hm-xp-top">
          <span>
            Level {level.level} · {level.name}
          </span>
          <span>{formatNumber(student.xp)} XP</span>
        </div>
        <div className="lab-meter fc-anim-fill" aria-hidden="true">
          <span style={{ width: `${level.progress * 100}%` }} />
        </div>
      </div>
      <ul className="fc-preview-stats">
        <li>
          <strong>{student.cleared}/10</strong>
          <span>Cleared</span>
        </li>
        <li>
          <strong>{student.stars}</strong>
          <span>Stars</span>
        </li>
        <li>
          <strong>{formatPercent(student.avgPretest)}</strong>
          <span>Avg pretest</span>
        </li>
        <li>
          <strong>{formatPercent(student.avgPosttest)}</strong>
          <span>Avg posttest</span>
        </li>
      </ul>
      <p className="lab-question-text">Experiment track</p>
      <ExperimentTrack experiments={experiments} />
      <p className="lab-question-text">Recent activity</p>
      <ol className="fc-timeline is-compact">
        {activity.slice(0, 6).map((item, index) => (
          <li key={`${item.at}-${index}`} className={`is-${item.event}`}>
            <span className="fc-timeline-dot" aria-hidden="true" />
            <span>
              <strong>{item.detail}</strong>
              <small>{formatDateTime(item.at)}</small>
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

export default function FacultyClass() {
  const { classCode } = useParams({ strict: false })
  const { data, error } = useFacultyData(`/classes/${encodeURIComponent(classCode)}`)
  const [tab, setTab] = useSectionTab(SECTION_IDS)
  const [status, setStatus] = useState('all')
  const [openExperiment, setOpenExperiment] = useState(null)
  const [preview, setPreview] = useState(null)
  const closePreview = useCallback(() => setPreview(null), [])
  const openPreview = useCallback((id) => {
    sfx.enter()
    setPreview(id)
  }, [])

  usePageMeta(`${classCode} | Faculty Console`, `Students, leaderboard and experiment progress for class ${classCode}.`)

  useEffect(() => {
    if (data) say(`${data.class.code}. ${data.students.length} students.`)
  }, [data])

  const attention = data ? data.students.filter((s) => s.status === 'attention' || s.status === 'inactive').length : undefined
  const sections = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'students', label: 'Students', icon: Users, count: data?.students.length },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
    { id: 'experiments', label: 'Experiments', icon: FlaskConical },
    { id: 'activity', label: 'Activity', icon: Activity },
  ]
  const previewName = data?.students.find((s) => s.id === preview)?.name

  return (
    <FacultyShell>
      <SectionTabs
        idBase="fc-class"
        label={`${classCode} sections`}
        sections={sections}
        active={tab}
        onChange={setTab}
        context={
          <>
            {String(classCode).toUpperCase()}
            {attention ? <small className="fc-context-alert">{attention} need attention</small> : null}
          </>
        }
        actions={<QuickSearch />}
      />
      <main className="mz-container lab-page hm-page fc-page">
        <Breadcrumbs items={[{ label: 'Classes', to: '/faculty' }, { label: String(classCode).toUpperCase() }]} />
        {!data ? (
          <LoadState error={error} what={`class ${classCode}`} />
        ) : (
          <SectionPanel idBase="fc-class" active={tab}>
            {tab === 'overview' && (
              <OverviewSection
                info={data.class}
                students={data.students}
                experiments={data.experiments}
                activity={data.activity}
                onStatus={setStatus}
                onOpen={setTab}
                onExperiment={setOpenExperiment}
                onPreview={openPreview}
              />
            )}
            {tab === 'students' && <StudentsSection students={data.students} experiments={data.experiments} status={status} setStatus={setStatus} onPreview={openPreview} />}
            {tab === 'leaderboard' && <LeaderboardSection students={data.students} onPreview={openPreview} />}
            {tab === 'experiments' && (
              <ExperimentsSection experiments={data.experiments} students={data.students} open={openExperiment} setOpen={setOpenExperiment} onPreview={openPreview} />
            )}
            {tab === 'activity' && <ActivitySection activity={data.activity} classSize={data.students.length} />}
          </SectionPanel>
        )}

        <Drawer
          open={Boolean(preview)}
          title={previewName ? `Quick look · ${previewName}` : 'Quick look'}
          onClose={closePreview}
          footer={
            preview && (
              <Link to="/faculty/student/$studentId" params={{ studentId: preview }} className="lab-btn lab-btn-primary" onClick={() => sfx.enter()}>
                Open full dashboard
                <ArrowRight aria-hidden="true" />
              </Link>
            )
          }
        >
          {preview && <StudentPreview id={preview} />}
        </Drawer>
      </main>
    </FacultyShell>
  )
}
