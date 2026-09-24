import { useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Activity, ArrowRight, BookOpenCheck, GraduationCap, LayoutDashboard, School, Search, TriangleAlert, Trophy, Users, Zap } from 'lucide-react'
import { FacultyShell } from '../../components/faculty/FacultyShell.jsx'
import { QuickSearch } from '../../components/faculty/QuickSearch.jsx'
import { LoadState, StatusPill, formatNumber, formatPercent, timeAgo } from '../../components/faculty/facultyUi.jsx'
import { CountUp, RankRace, SectionPanel, SectionTabs, useSectionTab } from '../../components/faculty/interactive.jsx'
import { labNumber } from '../../data/labs.js'
import { getFaculty } from '../../facultySession.js'
import { useFacultyData } from '../../lib/facultyApi.js'
import { usePageMeta } from '../../meta.js'
import { say, sfx } from '../../sound.js'

const SECTION_IDS = ['overview', 'classes', 'leaderboard', 'attention']

const REASONS = {
  failed: 'Failed a posttest',
  inactive: 'Inactive 14+ days',
  behind: 'Falling behind',
  low_scores: 'Low posttest scores',
}

const CLASS_SORTS = {
  name: (a, b) => a.code.localeCompare(b.code),
  xp: (a, b) => b.avgXp - a.avgXp,
  posttest: (a, b) => (b.avgPosttest ?? 0) - (a.avgPosttest ?? 0),
  inactive: (a, b) => b.inactive - a.inactive,
}

const CLASS_METRICS = [
  { id: 'avgXp', label: 'Average XP', value: (c) => c.avgXp, format: (v) => `${formatNumber(Math.round(v))} XP` },
  { id: 'avgPosttest', label: 'Avg posttest', value: (c) => c.avgPosttest ?? 0, format: (v) => formatPercent(v) },
  { id: 'avgCleared', label: 'Avg cleared', value: (c) => c.avgCleared, format: (v) => `${v.toFixed(1)} / 10` },
  { id: 'finished', label: 'Finished all 10', value: (c) => c.finished, format: (v) => `${Math.round(v)} student${Math.round(v) === 1 ? '' : 's'}` },
  { id: 'active', label: 'Active this week', value: (c) => (c.students ? c.activeWeek / c.students : 0), format: (v) => formatPercent(v) },
]

const DEPARTMENT_METRICS = {
  xp: { label: 'Average XP', value: (d) => d.avgXp, format: (v) => formatNumber(Math.round(v)) },
  posttest: { label: 'Avg posttest', value: (d) => d.avgPosttest, format: (v) => formatPercent(v) },
  active: { label: 'Active this week', value: (d) => d.activeShare, format: (v) => formatPercent(v) },
}

function ClassCard({ entry, alerts }) {
  return (
    <li>
      <Link to="/faculty/class/$classCode" params={{ classCode: entry.code }} className={`fc-class-card${entry.isMine ? ' is-mine' : ''}`} onClick={() => sfx.enter()}>
        <span className="fc-class-top">
          <span className="fc-class-code">{entry.code}</span>
          {entry.isMine && <span className="hm-you">YOUR CLASS</span>}
        </span>
        <span className="fc-class-dept">{entry.departmentName}</span>
        <span className="fc-class-meta">
          Semester {entry.semester} · Room {entry.room}
        </span>

        <span className="fc-class-figures">
          <span>
            <strong>{entry.students}</strong>
            <small>Students</small>
          </span>
          <span>
            <strong>{formatNumber(entry.avgXp)}</strong>
            <small>Avg XP</small>
          </span>
          <span>
            <strong>{formatPercent(entry.avgPosttest)}</strong>
            <small>Avg posttest</small>
          </span>
        </span>

        <span className="fc-class-progress">
          <span className="fc-class-progress-top">
            <span>Average progress</span>
            <span>{entry.avgCleared} / 10 experiments</span>
          </span>
          <span className="lab-meter fc-anim-fill" aria-hidden="true">
            <span style={{ width: `${entry.avgCleared * 10}%` }} />
          </span>
        </span>

        <span className="fc-class-foot">
          <span>{entry.advisor.name}</span>
          <span className="fc-class-flags">
            <span className="fc-flag is-active">{entry.activeWeek} active this week</span>
            {alerts > 0 && <span className="fc-flag is-inactive">{alerts} need attention</span>}
          </span>
        </span>
        <span className="fc-class-go" aria-hidden="true">
          Open class <ArrowRight />
        </span>
      </Link>
    </li>
  )
}

function OverviewSection({ data, faculty, onShowDepartment, onOpen }) {
  const { totals, classes, alerts } = data
  const [metric, setMetric] = useState('xp')

  const departments = useMemo(() => {
    const groups = new Map()
    classes.forEach((c) => {
      if (!groups.has(c.department)) groups.set(c.department, { code: c.department, name: c.departmentName, classes: [] })
      groups.get(c.department).classes.push(c)
    })
    return [...groups.values()].map((d) => {
      const students = d.classes.reduce((sum, c) => sum + c.students, 0)
      const withPost = d.classes.filter((c) => c.avgPosttest !== null)
      return {
        ...d,
        students,
        avgXp: students ? d.classes.reduce((sum, c) => sum + c.avgXp * c.students, 0) / students : 0,
        avgPosttest: withPost.length ? withPost.reduce((sum, c) => sum + c.avgPosttest, 0) / withPost.length : 0,
        activeShare: students ? d.classes.reduce((sum, c) => sum + c.activeWeek, 0) / students : 0,
      }
    })
  }, [classes])
  const [selected, setSelected] = useState(() => classes.find((c) => c.isMine)?.department ?? departments[0]?.code)
  const current = departments.find((d) => d.code === selected)
  const measure = DEPARTMENT_METRICS[metric]
  const max = Math.max(1e-9, ...departments.map((d) => measure.value(d)))
  const mine = classes.filter((c) => c.isMine)
  const alertsFor = (code) => alerts.filter((a) => a.className === code).length
  const urgent = [...alerts].sort((a, b) => Number(b.isMine) - Number(a.isMine)).slice(0, 5)

  const stats = [
    { label: 'Classes', value: totals.classes, icon: School },
    { label: 'Students', value: totals.students, icon: Users },
    { label: 'Average XP', value: totals.avgXp, icon: Zap },
    { label: 'Experiments cleared', value: totals.experimentsCleared, icon: BookOpenCheck },
    { label: 'Active this week', value: totals.activeWeek, icon: Activity },
  ]

  return (
    <>
      <section className="fc-hero" aria-labelledby="fc-hero-title">
        <div>
          <p className="hm-kicker">FACULTY CONSOLE · {data.academicYear}</p>
          <h1 id="fc-hero-title" className="fc-hero-title">
            Welcome, {faculty?.name}
          </h1>
          <p className="fc-hero-lead">
            Use the headings above to switch between classes, the leaderboard and students who need attention. {formatNumber(totals.eventsWeek)} learning events
            this week.
          </p>
        </div>
        <GraduationCap className="fc-hero-icon" aria-hidden="true" />
      </section>

      <ul className="hm-stats fc-stats" aria-label="All classes at a glance">
        {stats.map(({ label, value, icon: Icon }) => (
          <li key={label} className="hm-stat">
            <Icon aria-hidden="true" />
            <span className="hm-stat-value">
              <CountUp value={value} />
            </span>
            <span className="hm-stat-label">{label}</span>
          </li>
        ))}
      </ul>

      <div className="fc-overview-grid">
        <section className="hm-panel" aria-labelledby="fc-dept-title">
          <div className="hm-panel-head">
            <h2 id="fc-dept-title" className="hm-panel-title">
              Departments
            </h2>
            <div className="hm-segment" role="group" aria-label="Compare departments by">
              {Object.entries(DEPARTMENT_METRICS).map(([id, option]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={metric === id}
                  onClick={() => {
                    setMetric(id)
                    sfx.select()
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <ul className="fc-dept-chart">
            {departments.map((d) => (
              <li key={d.code}>
                <button
                  type="button"
                  className={`fc-dept-bar${selected === d.code ? ' is-selected' : ''}`}
                  aria-pressed={selected === d.code}
                  onClick={() => {
                    setSelected(d.code)
                    sfx.select()
                  }}
                >
                  <span className="fc-dept-code">{d.code}</span>
                  <span className="fc-dept-track" aria-hidden="true">
                    <span style={{ width: `${(measure.value(d) / max) * 100}%` }} />
                  </span>
                  <span className="fc-dept-value">{measure.format(measure.value(d))}</span>
                </button>
              </li>
            ))}
          </ul>
          {current && (
            <div className="fc-dept-detail" aria-live="polite">
              <p>
                <strong>{current.name}</strong>
                <span className="lab-muted">
                  {current.classes.length} classes · {current.students} students
                </span>
              </p>
              <div className="fc-dept-classes">
                {current.classes.map((c) => (
                  <Link key={c.code} to="/faculty/class/$classCode" params={{ classCode: c.code }} className="fc-class-chip">
                    {c.code}
                    <small>{formatNumber(c.avgXp)} XP</small>
                  </Link>
                ))}
              </div>
              <button type="button" className="lab-btn" onClick={() => onShowDepartment(current.code)}>
                Show {current.code} classes
                <ArrowRight aria-hidden="true" />
              </button>
            </div>
          )}
        </section>

        <section className="hm-panel" aria-labelledby="fc-mine-title">
          <div className="hm-panel-head">
            <h2 id="fc-mine-title" className="hm-panel-title">
              My classes
            </h2>
            <span className="lab-pill">{mine.length}</span>
          </div>
          {mine.length ? (
            <ul className="fc-mine-list">
              {mine.map((c) => (
                <li key={c.code}>
                  <Link to="/faculty/class/$classCode" params={{ classCode: c.code }} className="fc-mine-card" onClick={() => sfx.enter()}>
                    <span className="fc-class-code">{c.code}</span>
                    <span className="fc-mine-figures">
                      <span>
                        <strong>{c.students}</strong> students
                      </span>
                      <span>
                        <strong>{formatNumber(c.avgXp)}</strong> avg XP
                      </span>
                      <span>
                        <strong>{alertsFor(c.code)}</strong> need attention
                      </span>
                    </span>
                    <span className="lab-meter fc-anim-fill" aria-hidden="true">
                      <span style={{ width: `${c.avgCleared * 10}%` }} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="lab-muted">You are not the advisor of any class. Browse every class in the Classes section.</p>
          )}
          <button type="button" className="lab-btn" onClick={() => onOpen('classes')}>
            Browse all {classes.length} classes
            <ArrowRight aria-hidden="true" />
          </button>
        </section>
      </div>

      <section className="hm-panel" aria-labelledby="fc-urgent-title">
        <div className="hm-panel-head">
          <h2 id="fc-urgent-title" className="hm-panel-title">
            Needs attention now
          </h2>
          <button type="button" className="lab-btn" onClick={() => onOpen('attention')}>
            See all {alerts.length}
            <ArrowRight aria-hidden="true" />
          </button>
        </div>
        <ul className="fc-alert-list">
          {urgent.map((a) => (
            <AlertRow key={a.id} alert={a} />
          ))}
        </ul>
      </section>
    </>
  )
}

function AlertRow({ alert }) {
  return (
    <li className="fc-alert-row">
      <StatusPill status={alert.status} />
      <span className="fc-student-cell">
        <Link to="/faculty/student/$studentId" params={{ studentId: alert.id }} className="fc-link">
          {alert.name}
        </Link>
        <small>
          {alert.id} ·{' '}
          <Link to="/faculty/class/$classCode" params={{ classCode: alert.className }} className="fc-link">
            {alert.className}
          </Link>
          {alert.isMine && ' · your class'}
        </small>
      </span>
      <span className="fc-reasons">
        {alert.reasons.map((reason) => (
          <span key={reason} className={`fc-reason is-${reason}`}>
            {REASONS[reason]}
          </span>
        ))}
      </span>
      <span className="fc-alert-meta">
        <span>{!alert.currentExperiment ? 'All cleared' : alert.started ? `On ${labNumber(alert.currentExperiment)}` : 'Not started'}</span>
        <small>{timeAgo(alert.lastActiveAt)}</small>
      </span>
    </li>
  )
}

function ClassesSection({ classes, alerts, department, setDepartment }) {
  const [query, setQuery] = useState('')
  const [mineOnly, setMineOnly] = useState(false)
  const [sort, setSort] = useState('name')
  const departments = ['ALL', ...new Set(classes.map((c) => c.department))]
  const visible = useMemo(() => {
    const text = query.trim().toLowerCase()
    return classes
      .filter((c) => department === 'ALL' || c.department === department)
      .filter((c) => !mineOnly || c.isMine)
      .filter((c) => !text || `${c.code} ${c.departmentName} ${c.advisor.name}`.toLowerCase().includes(text))
      .sort(CLASS_SORTS[sort])
  }, [classes, department, mineOnly, query, sort])

  return (
    <section className="hm-panel" aria-labelledby="fc-classes-title">
      <div className="hm-panel-head">
        <h1 id="fc-classes-title" className="hm-panel-title">
          Classes <span className="lab-pill">{visible.length}</span>
        </h1>
        <button
          type="button"
          className="lab-btn fc-mine"
          aria-pressed={mineOnly}
          onClick={() => {
            setMineOnly(!mineOnly)
            sfx.select()
          }}
        >
          {mineOnly ? 'Showing my classes' : 'Show only my classes'}
        </button>
      </div>

      <div className="fc-toolbar">
        <div className="hm-segment fc-dept" role="group" aria-label="Department">
          {departments.map((code) => (
            <button
              key={code}
              type="button"
              aria-pressed={department === code}
              onClick={() => {
                setDepartment(code)
                sfx.select()
              }}
            >
              {code === 'ALL' ? 'All' : code}
            </button>
          ))}
        </div>
        <label className="fc-search">
          <Search aria-hidden="true" />
          <span className="mz-sr-only">Filter classes</span>
          <input type="search" placeholder="Filter by class or advisor" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <label className="fc-sort">
          <span>Sort</span>
          <select className="lab-select" value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="name">Class code</option>
            <option value="xp">Average XP</option>
            <option value="posttest">Average posttest</option>
            <option value="inactive">Most inactive</option>
          </select>
        </label>
      </div>

      {visible.length ? (
        <ul className="fc-class-grid">
          {visible.map((entry) => (
            <ClassCard key={entry.code} entry={entry} alerts={alerts.filter((a) => a.className === entry.code).length} />
          ))}
        </ul>
      ) : (
        <p className="lab-muted">No classes match these filters.</p>
      )}
    </section>
  )
}

function LeaderboardSection({ classes }) {
  const [metricId, setMetricId] = useState('avgXp')
  const metric = CLASS_METRICS.find((m) => m.id === metricId)

  return (
    <section className="hm-panel" aria-labelledby="fc-board-title">
      <div className="hm-panel-head">
        <h1 id="fc-board-title" className="hm-panel-title">
          Class leaderboard
        </h1>
        <div className="hm-segment fc-wrap-segment" role="group" aria-label="Rank classes by">
          {CLASS_METRICS.map((m) => (
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
      <p className="lab-muted">Pick a measure and watch the classes re-rank.</p>
      <RankRace
        label={`Classes ranked by ${metric.label.toLowerCase()}`}
        format={metric.format}
        items={classes.map((c) => ({
          key: c.code,
          name: c.code,
          value: metric.value(c),
          highlight: c.isMine,
          title: (
            <>
              <Link to="/faculty/class/$classCode" params={{ classCode: c.code }} className="fc-link">
                {c.code}
              </Link>
              <small>{c.departmentName}</small>
            </>
          ),
          meta: c.topStudent && (
            <>
              Top student:{' '}
              <Link to="/faculty/student/$studentId" params={{ studentId: c.topStudent.id }} className="fc-link">
                {c.topStudent.name}
              </Link>
            </>
          ),
        }))}
      />
    </section>
  )
}

function AttentionSection({ alerts, classes }) {
  const [reason, setReason] = useState('all')
  const [classCode, setClassCode] = useState('ALL')
  const [mineOnly, setMineOnly] = useState(false)
  const [limit, setLimit] = useState(25)

  const scoped = alerts.filter((a) => (classCode === 'ALL' || a.className === classCode) && (!mineOnly || a.isMine))
  const rows = scoped.filter((a) => reason === 'all' || a.reasons.includes(reason))
  const count = (key) => scoped.filter((a) => a.reasons.includes(key)).length

  return (
    <section className="hm-panel" aria-labelledby="fc-attention-title">
      <div className="hm-panel-head">
        <h1 id="fc-attention-title" className="hm-panel-title">
          Students who need attention <span className="lab-pill">{rows.length}</span>
        </h1>
        <button
          type="button"
          className="lab-btn fc-mine"
          aria-pressed={mineOnly}
          onClick={() => {
            setMineOnly(!mineOnly)
            setLimit(25)
            sfx.select()
          }}
        >
          {mineOnly ? 'Showing my classes' : 'Only my classes'}
        </button>
      </div>

      <div className="fc-toolbar">
        <div className="fc-chips" role="group" aria-label="Filter by reason">
          {[['all', 'All reasons', scoped.length], ...Object.entries(REASONS).map(([key, label]) => [key, label, count(key)])].map(([key, label, n]) => (
            <button
              key={key}
              type="button"
              className="fc-chip"
              aria-pressed={reason === key}
              onClick={() => {
                setReason(key)
                setLimit(25)
                sfx.select()
              }}
            >
              {label}
              <span>{n}</span>
            </button>
          ))}
        </div>
        <label className="fc-sort">
          <span>Class</span>
          <select
            className="lab-select"
            value={classCode}
            onChange={(event) => {
              setClassCode(event.target.value)
              setLimit(25)
            }}
          >
            <option value="ALL">All classes</option>
            {classes.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code}
              </option>
            ))}
          </select>
        </label>
      </div>

      {rows.length ? (
        <ul className="fc-alert-list">
          {rows.slice(0, limit).map((a) => (
            <AlertRow key={a.id} alert={a} />
          ))}
        </ul>
      ) : (
        <p className="lab-muted">Nobody matches these filters.</p>
      )}
      {rows.length > limit && (
        <button type="button" className="lab-btn fc-more" onClick={() => setLimit(limit + 25)}>
          Show {Math.min(25, rows.length - limit)} more
        </button>
      )}
    </section>
  )
}

export default function FacultyHome() {
  const faculty = getFaculty()
  const { data, error } = useFacultyData('/overview')
  const [tab, setTab] = useSectionTab(SECTION_IDS)
  const [department, setDepartment] = useState('ALL')

  usePageMeta('Faculty Console | ML Maze', 'Class-wise student progress, dashboards and leaderboards for faculty.')

  useEffect(() => {
    say('Faculty console. Choose a section at the top.')
  }, [])

  const sections = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'classes', label: 'Classes', icon: School, count: data?.classes.length },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
    { id: 'attention', label: 'Needs attention', icon: TriangleAlert, count: data?.alerts.length, tone: 'alert' },
  ]

  return (
    <FacultyShell>
      <SectionTabs idBase="fc-home" label="Faculty console sections" sections={sections} active={tab} onChange={setTab} context="CONSOLE" actions={<QuickSearch />} />
      <main className="mz-container lab-page hm-page fc-page">
        {!data ? (
          <LoadState error={error} what="classes" />
        ) : (
          <SectionPanel idBase="fc-home" active={tab}>
            {tab === 'overview' && (
              <OverviewSection
                data={data}
                faculty={faculty}
                onOpen={setTab}
                onShowDepartment={(code) => {
                  setDepartment(code)
                  setTab('classes')
                }}
              />
            )}
            {tab === 'classes' && <ClassesSection classes={data.classes} alerts={data.alerts} department={department} setDepartment={setDepartment} />}
            {tab === 'leaderboard' && <LeaderboardSection classes={data.classes} />}
            {tab === 'attention' && <AttentionSection alerts={data.alerts} classes={data.classes} />}
          </SectionPanel>
        )}
      </main>
    </FacultyShell>
  )
}
