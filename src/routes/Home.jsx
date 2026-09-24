import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { usePageMeta } from '../meta.js'
import { say, sfx } from '../sound.js'

const TARGETS = ['dot', 'dot', 'dot', 'dot', 'dot', 'pink', 'cyan', 'orange', 'red']

export default function Home() {
  const [run, setRun] = useState(0)
  const [revealed, setRevealed] = useState(false)

  usePageMeta('PAC-LAB | Virtual Machine Learning Lab', 'Enter PAC-LAB, an arcade-inspired virtual machine learning laboratory.')

  useEffect(() => {
    setRevealed(false)
    const timer = setTimeout(() => setRevealed(true), 2000)
    return () => clearTimeout(timer)
  }, [run])

  useEffect(() => {
    if (!revealed) return
    sfx.reveal()
    say('Welcome to Pac Lab')
  }, [revealed])

  // Each pellet and ghost disappears via the `target-eaten` animation; sound it the moment it's eaten.
  const onTargetEaten = (event) => {
    if (event.animationName !== 'target-eaten') return
    if (event.target.classList.contains('pellet')) sfx.chomp()
    else sfx.ghost()
  }

  return (
    <main className="arcade-shell">
      <header className="arcade-header" aria-label="PAC-LAB header">
        <span className="header-mark" aria-hidden="true" />
        <span>PAC-LAB // VIRTUAL ML</span>
        <span className="status-light">SYSTEM ONLINE</span>
      </header>

      <section key={run} className="game-stage" aria-label="Pac-Man machine learning intro">
        {!revealed && (
          <div className="chase-lane" aria-hidden="true">
            <div className="target-track" onAnimationEnd={onTargetEaten}>
              {TARGETS.map((target, index) => (
                <span key={`${target}-${index}`} className="target-slot">
                  <span
                    className={target === 'dot' ? 'pellet' : `ghost ghost-${target}`}
                    style={{ animationDelay: `${0.26 + index * 0.18}s` }}
                  >
                    {target !== 'dot' && (
                      <>
                        <span className="ghost-eye">
                          <span />
                        </span>
                        <span className="ghost-eye">
                          <span />
                        </span>
                      </>
                    )}
                  </span>
                </span>
              ))}
            </div>
            <div className="pac-runner">
              <span className="pacman" />
            </div>
          </div>
        )}

        {revealed && (
          <div className="reveal-panel">
            <div className="brand-lockup">
              <span className="logo-pac" aria-hidden="true" />
              <div className="brand-text">
                <h1 aria-label="PAC-LAB">PAC-LAB</h1>
                <p>VIRTUAL MACHINE LEARNING LAB</p>
              </div>
            </div>
            <p className="brand-copy">CHOMP THE DATA. TRAIN THE MODEL. BEAT THE SCORE.</p>
            <Link className="arcade-button" to="/login">
              ENTER THE LAB
            </Link>
          </div>
        )}

        {revealed && (
          <button className="arcade-button replay-button" type="button" onClick={() => setRun((count) => count + 1)}>
            REPLAY
          </button>
        )}
      </section>

      <footer className="arcade-footer">
        <span>© 2026 PAC-LAB</span>
        <span>INSERT CURIOSITY TO START</span>
      </footer>
    </main>
  )
}
