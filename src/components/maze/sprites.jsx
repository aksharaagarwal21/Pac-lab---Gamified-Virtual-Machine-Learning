// Pac-Man with its mouth open toward the upper right.
export function PacLogo({ className }) {
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden="true">
      <path fill="currentColor" d="M20 20 L37.93 18.43 A18 18 0 1 1 27.6 3.69 Z" />
    </svg>
  )
}

export function GhostIcon({ className, style }) {
  return (
    <svg className={className} style={style} viewBox="0 0 40 40" aria-hidden="true">
      <path fill="currentColor" d="M5 19a15 15 0 0 1 30 0v17l-5-3.5-5 3.5-5-3.5-5 3.5-5-3.5-5 3.5z" />
      <ellipse cx="14.5" cy="18" rx="4" ry="5" fill="#fff" />
      <ellipse cx="25.5" cy="18" rx="4" ry="5" fill="#fff" />
      <circle cx="15.5" cy="19" r="2" fill="#0b1633" />
      <circle cx="26.5" cy="19" r="2" fill="#0b1633" />
    </svg>
  )
}
