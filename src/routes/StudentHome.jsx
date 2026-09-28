import { useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowRight,
  Boxes,
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  Code,
  Eraser,
  ExternalLink,
  FlaskConical,
  GitBranch,
  Layers,
  LayoutDashboard,
  Lock,
  Minimize2,
  PlayCircle,
  Split,
  Star,
  ToggleRight,
  Trees,
  TrendingUp,
  Trophy,
} from 'lucide-react'
import { MazeShell } from '../components/maze/MazeShell.jsx'
import { GhostIcon } from '../components/maze/sprites.jsx'
import { LABS, labNumber } from '../data/labs.js'
import { usePageMeta } from '../meta.js'
import { labStatus, lockReason, nextLab, totalStars, useProgress } from '../progress.js'
import { say, sfx } from '../sound.js'

const LAB_ICONS = { 1: Eraser, 2: TrendingUp, 3: Layers, 4: ToggleRight, 5: Minimize2, 6: Split, 7: Boxes, 8: GitBranch, 9: Trees, 10: BrainCircuit }
const STATUS_TEXT = { cleared: 'CLEARED', ready: 'READY', locked: 'LOCKED' }
const STATUS_LABEL = { cleared: 'Cleared', ready: 'Ready', locked: 'Locked' }
const PELLETS = 14

const RESOURCES = [
  { title: 'scikit-learn guide', url: 'https://scikit-learn.org/stable/user_guide.html' },
  { title: 'UCI datasets', url: 'https://archive.ics.uci.edu/' },
  { title: 'Kaggle datasets', url: 'https://www.kaggle.com/datasets' },
  { title: 'ML Crash Course', url: 'https://developers.google.com/machine-learning/crash-course' },
  { title: 'Python tutorial', url: 'https://docs.python.org/3/tutorial/' },
]

// Wheel geometry in SVG units (viewBox −180…180). Segment 0 sits at the top.
const OUTER = 170
const INNER = 74
const GAP_DEGREES = 1.4

function segmentPath(index, count) {
  const span = 360 / count
  const toRadians = (degrees) => (degrees * Math.PI) / 180
  const start = toRadians(-90 - span / 2 + index * span + GAP_DEGREES / 2)
  const end = toRadians(-90 - span / 2 + (index + 1) * span - GAP_DEGREES / 2)
  const point = (radius, angle) => `${(radius * Math.cos(angle)).toFixed(2)} ${(radius * Math.sin(angle)).toFixed(2)}`
  return `M ${point(OUTER, start)} A ${OUTER} ${OUTER} 0 0 1 ${point(OUTER, end)} L ${point(INNER, end)} A ${INNER} ${INNER} 0 0 0 ${point(INNER, start)} Z`
}

// Game-style selection wheel: hover or arrow keys choose an experiment, click or Enter opens it.
function MissionWheel({ progress, selected, onSelect, onOpen }) {
  const count = LABS.length
  const lab = LABS[selected]

  const onKeyDown = (event) => {
    const moves = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }
    if (event.key in moves) {
      event.preventDefault()
      onSelect((selected + moves[event.key] + count) % count, true)
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      onSelect(event.key === 'Home' ? 0 : count - 1, true)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onOpen(selected)
    }
  }

  return (
    <div className="hx-wheel-wrap">
      <svg
        className="hx-wheel"
        viewBox="-180 -180 360 360"
        role="listbox"
        tabIndex={0}
        aria-label="Experiments"
        aria-activedescendant={`hx-seg-${selected}`}
        onKeyDown={onKeyDown}
      >
        <defs>
          <radialGradient id="hx-active-fill" cx="0" cy="0" r={OUTER} gradientUnits="userSpaceOnUse">
            <stop offset="0.45" stopColor="#3a1420" />
            <stop offset="1" stopColor="#ff5c3a" />
          </radialGradient>
        </defs>
        {LABS.map((item, index) => {
          const status = labStatus(progress, item.id)
          const Icon = status === 'locked' ? Lock : LAB_ICONS[item.id]
          const angle = ((-90 + index * (360 / count)) * Math.PI) / 180
          const radius = (OUTER + INNER) / 2
          return (
            <g
              key={item.id}
              id={`hx-seg-${index}`}
              role="option"
              aria-selected={index === selected}
              aria-label={`Experiment ${item.id}: ${item.title}, ${STATUS_LABEL[status]}`}
              className={`hx-seg is-${status}${index === selected ? ' is-active' : ''}`}
              onPointerEnter={(event) => event.pointerType === 'mouse' && onSelect(index)}
              // Touch: the first tap selects, a second tap opens.
              onClick={() => (index === selected ? onOpen(index) : onSelect(index, true))}
            >
              <path className="hx-seg-shape" d={segmentPath(index, count)} />
              <Icon className="hx-seg-icon" x={radius * Math.cos(angle) - 15} y={radius * Math.sin(angle) - 15} width={30} height={30} aria-hidden="true" />
            </g>
          )
        })}
        <circle className="hx-wheel-center" r={INNER - 10} />
        <text className="hx-wheel-num" y="6" aria-hidden="true">
          {labNumber(lab.id)}
        </text>
        <text className="hx-wheel-status" y="32" aria-hidden="true">
          {STATUS_TEXT[labStatus(progress, lab.id)]}
        </text>
      </svg>
      <p className="hx-wheel-hint">
        <span>
          <kbd>←</kbd>
          <kbd>→</kbd>
          Rotate
        </span>
        <span>
          <kbd>Enter</kbd>
          Open
        </span>
      </p>
    </div>
  )
}

export default function StudentHome() {
  const progress = useProgress()
  const navigate = useNavigate()
  const upcoming = nextLab(progress)
  const [selected, setSelected] = useState(() => (upcoming ? upcoming.id - 1 : 0))
  const [note, setNote] = useState('')

  const lab = LABS[selected]
  const status = labStatus(progress, lab.id)
  const stars = progress.cleared[lab.id]?.stars ?? 0
  const cleared = Object.keys(progress.cleared).length
  const nextLink = upcoming ? { to: '/student/lab/$labId', params: { labId: String(upcoming.id) } } : { to: '/student/maze' }

  usePageMeta('Home | ML Virtual Lab', 'Learn machine learning by playing it: ten hands-on experiments in an arcade virtual lab.')

  useEffect(() => {
    say('Welcome to the machine learning virtual lab.')
  }, [])

  const select = (index, fromKeyboard = false) => {
    if (index === selected) return
    setSelected(index)
    setNote('')
    if (fromKeyboard) sfx.select()
  }

  const open = (index) => {
    const target = LABS[index]
    if (labStatus(progress, target.id) === 'locked') {
      setSelected(index)
      setNote(`Locked. ${lockReason(progress, target.id)}`)
      sfx.denied()
      return
    }
    sfx.enter()
    navigate({ to: '/student/lab/$labId', params: { labId: String(target.id) } })
  }

  const tiles = [
    { label: 'Learn', text: 'Watch the lesson, then predict before you test.', shape: 'circle', color: '#5b8cff', icon: <PlayCircle aria-hidden="true" />, link: nextLink },
    { label: 'Simulate', text: 'Drag sliders, break models, see why.', shape: 'square', color: '#34d399', icon: <FlaskConical aria-hidden="true" />, link: nextLink },
    { label: 'Explore', text: 'Wander the ML Maze and unlock levels.', shape: 'tag', color: '#ff8a3d', icon: <GhostIcon />, link: { to: '/student/maze' } },
    { label: 'Code', text: 'Predict, repair and build real Python.', shape: 'rounded', color: '#f5c518', icon: <Code aria-hidden="true" />, link: nextLink },
    { label: 'Compete', text: 'Earn XP and climb your class board.', shape: 'circle', color: '#a78bfa', icon: <Trophy aria-hidden="true" />, link: { to: '/student/dashboard' } },
  ]

  return (
    <MazeShell>
      <main className="mz-container lab-page hm-page">
        <section className="hx-hero" aria-labelledby="hx-title">
          <p className="hx-pill">ML VIRTUAL LAB · {LABS.length} EXPERIMENTS</p>
          <h1 id="hx-title" className="hx-title">
            Learn machine learning <em>by playing it.</em>
          </h1>
          <div className="hx-chomp" aria-hidden="true">
            <div className="hx-chomp-pellets">
              {Array.from({ length: PELLETS }, (_, i) => (
                <span key={i} className="hx-chomp-pellet" style={{ left: `${((i + 0.5) / PELLETS) * 100}%` }} />
              ))}
            </div>
            <span className="hx-chomp-pac" />
          </div>
          <p className="hx-sub">Clean data, fit lines, split trees and train a neuron — one arcade level at a time.</p>
          <div className="hx-actions">
            <Link {...nextLink} className="lab-btn lab-btn-primary">
              {upcoming ? `Start Experiment ${labNumber(upcoming.id)}` : 'Replay the maze'}
              <ArrowRight aria-hidden="true" />
            </Link>
            <Link to="/student/dashboard" className="lab-btn">
              <LayoutDashboard aria-hidden="true" />
              Dashboard
            </Link>
          </div>

          <nav className="hx-tiles" aria-label="Ways to level up">
            {tiles.map((tile) => (
              <Link key={tile.label} {...tile.link} className={`hx-tile is-${tile.shape}`} style={{ '--tile': tile.color }}>
                {tile.icon}
                <strong>{tile.label}</strong>
                <small>{tile.text}</small>
              </Link>
            ))}
          </nav>
        </section>

        <section className="hx-mission" aria-labelledby="hx-mission-title">
          <MissionWheel progress={progress} selected={selected} onSelect={select} onOpen={open} />

          <div className="hx-info">
            <h2 id="hx-mission-title" className="lab-kicker">
              PICK YOUR MISSION
            </h2>
            <p className="hx-info-num">EXPERIMENT {labNumber(lab.id)}</p>
            <h3 className="hx-info-title" aria-live="polite">
              {lab.title}
            </h3>
            <div className="hx-info-meta">
              <span>{lab.tier}</span>
              <span>+{lab.xp} XP</span>
              <span className={`hm-status is-${status}`}>{STATUS_LABEL[status]}</span>
              <span className="hx-info-stars" role="img" aria-label={`${stars} of 3 stars`}>
                {[0, 1, 2].map((i) => (
                  <Star key={i} className={i < stars ? 'is-earned' : undefined} aria-hidden="true" />
                ))}
              </span>
            </div>
            {note && (
              <p className="hx-locked-note" role="status">
                {note}
              </p>
            )}
            <div className="lab-actions">
              <button type="button" className="lab-btn" aria-label="Previous experiment" onClick={() => select((selected + LABS.length - 1) % LABS.length, true)}>
                <ChevronLeft aria-hidden="true" />
              </button>
              <button type="button" className="lab-btn lab-btn-primary" onClick={() => open(selected)}>
                {status === 'locked' ? (
                  <>
                    <Lock aria-hidden="true" />
                    Locked
                  </>
                ) : (
                  <>
                    Open experiment
                    <ArrowRight aria-hidden="true" />
                  </>
                )}
              </button>
              <button type="button" className="lab-btn" aria-label="Next experiment" onClick={() => select((selected + 1) % LABS.length, true)}>
                <ChevronRight aria-hidden="true" />
              </button>
            </div>
            <dl className="hx-mini">
              <div>
                <dt>Cleared</dt>
                <dd>
                  {cleared}/{LABS.length}
                </dd>
              </div>
              <div>
                <dt>XP</dt>
                <dd>{progress.xp.toLocaleString('en-IN')}</dd>
              </div>
              <div>
                <dt>Stars</dt>
                <dd>{totalStars(progress)}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="hx-guide" aria-labelledby="hx-guide-title">
          <h2 id="hx-guide-title" className="hx-guide-title">
            FIELD GUIDE
          </h2>
          {RESOURCES.map((resource) => (
            <a key={resource.url} className="hx-chip" href={resource.url} target="_blank" rel="noreferrer">
              {resource.title}
              <ExternalLink aria-hidden="true" />
              <span className="mz-sr-only">(opens in a new tab)</span>
            </a>
          ))}
        </section>

        <section className="hx-final" aria-labelledby="hx-final-title">
          <div>
            <h2 id="hx-final-title" className="hx-final-title">
              Ready, player one?
            </h2>
            <p>{upcoming ? `Your next mission: ${upcoming.title}.` : 'Every mission cleared. Go for three stars everywhere.'}</p>
          </div>
          <Link {...nextLink} className="lab-btn">
            Continue
            <ArrowRight aria-hidden="true" />
          </Link>
        </section>
      </main>
    </MazeShell>
  )
}
