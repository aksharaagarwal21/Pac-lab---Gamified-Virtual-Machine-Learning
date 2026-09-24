import { useId } from 'react'

// Original vector Staunton set, with turned bases and engraved details.
export function ChessPiece({ type, color }) {
  const id = useId().replaceAll(':', '')
  const light = color === 'w'
  const body = `url(#${id}-body)`
  const trim = `url(#${id}-trim)`
  const outline = light ? '#52483b' : '#422335'
  const highlight = light ? '#fffbed' : '#ffccaf'
  const shade = light ? '#81705a' : '#863f4b'
  return <svg viewBox="0 0 80 88" aria-hidden="true" className={`cc-piece-art is-${color}`}>
    <defs>
      <linearGradient id={`${id}-body`} x1="0" x2="1" y1="0" y2=".2">
        <stop offset="0" stopColor={light ? '#b5a080' : '#934252'} />
        <stop offset=".22" stopColor={light ? '#f0dfb9' : '#e89280'} />
        <stop offset=".42" stopColor={light ? '#fff6d9' : '#ffc3a1'} />
        <stop offset=".65" stopColor={light ? '#e5cda1' : '#d67972'} />
        <stop offset="1" stopColor={light ? '#9e8667' : '#793b4c'} />
      </linearGradient>
      <linearGradient id={`${id}-trim`} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor={highlight} /><stop offset=".35" stopColor={light ? '#ecd4ad' : '#e99782'} />
        <stop offset="1" stopColor={shade} />
      </linearGradient>
    </defs>
    <ellipse cx="40" cy="81" rx="29" ry="5" fill="#071020" opacity=".4" />
    <g fill={body} stroke={outline} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
      {type === 'p' && <>
        <path d="M31 39 C33 49 31 58 25 65 H55 C49 58 47 49 49 39Z" />
        <circle cx="40" cy="25" r="13" />
        <path d="M33 17 Q37 13 43 15" fill="none" stroke={highlight} strokeWidth="2.3" opacity=".75" />
        <path d="M30 38 Q40 35 50 38 L51 42 Q40 45 29 42Z" fill={trim} />
        <path d="M35 47 Q36 55 31 61" fill="none" stroke={highlight} opacity=".55" />
      </>}
      {type === 'r' && <>
        <path d="M26 31 L29 56 L24 65 H56 L51 56 L54 31Z" />
        <path d="M22 13 H30 V21 H36 V13 H44 V21 H50 V13 H58 V30 L53 36 H27 L22 30Z" />
        <path d="M25 28 H55 M29 37 H51 M30 55 H50" fill="none" stroke={shade} />
        <path d="M34 40 V54 M46 40 V54" fill="none" stroke={highlight} opacity=".5" />
        <path d="M25 61 H55 L58 66 H22Z" fill={trim} />
        <path d="M38 41 H42 V50 H38Z" fill={shade} strokeWidth=".7" />
      </>}
      {type === 'n' && <>
        <path d="M22 66 C23 57 27 50 35 44 L40 36 L30 38 L24 44 L15 41 L13 34 L23 22 L30 20 L33 8 L40 17 C56 16 65 34 60 49 L54 65Z" />
        <path d="M41 19 C57 23 61 37 56 51 L50 61 L39 61 C48 47 50 37 43 30" fill={shade} stroke="none" opacity=".55" />
        <path d="M44 22 L51 26 M49 29 L56 32 M52 36 L58 39 M52 43 L58 46 M49 50 L55 53" fill="none" stroke={outline} strokeWidth="1.5" />
        <path d="M30 23 L35 14 L36 24 M17 36 L23 37 L25 33" fill="none" />
        <path d="M28 28 Q32 24 37 27" fill="none" strokeWidth="2" />
        <circle cx="32" cy="29" r="2.4" fill={outline} /><circle cx="32.5" cy="28.5" r=".7" fill={highlight} stroke="none" />
        <circle cx="21" cy="33" r="1.2" fill={outline} stroke="none" />
        <path d="M26 57 Q29 50 36 47" fill="none" stroke={highlight} strokeWidth="2" opacity=".65" />
      </>}
      {type === 'b' && <>
        <path d="M33 42 C35 52 32 59 25 65 H55 C48 58 45 52 47 42Z" />
        <path d="M40 10 C34 17 23 25 25 33 C26 40 32 43 40 43 C49 43 56 37 55 30 C54 23 45 16 40 10Z" />
        <circle cx="40" cy="9" r="3.3" fill={trim} />
        <path d="M45 19 L35 33" fill="none" stroke={outline} strokeWidth="3" />
        <path d="M31 29 Q31 23 36 20" fill="none" stroke={highlight} strokeWidth="2" opacity=".8" />
        <path d="M29 43 Q40 39 51 43 L50 47 H30Z" fill={trim} />
        <path d="M33 51 Q34 57 30 61" fill="none" stroke={highlight} opacity=".6" />
      </>}
      {type === 'q' && <>
        <path d="M28 39 C32 52 30 59 24 65 H56 C50 59 48 52 52 39Z" />
        <path d="M27 39 L19 18 L30 28 L31 13 L40 26 L49 13 L50 28 L61 18 L53 39Z" />
        {[[19,16],[31,11],[40,8],[49,11],[61,16]].map(([x,y]) => <circle key={x} cx={x} cy={y} r="3" fill={trim} />)}
        <path d="M40 11 V25 M27 34 Q40 38 53 34" fill="none" stroke={shade} />
        <path d="M27 39 H53 V44 Q40 47 27 44Z" fill={trim} />
        <path d="M34 48 L31 59 M40 49 V60 M46 48 L49 59" fill="none" stroke={shade} opacity=".7" />
        <circle cx="40" cy="41" r="2" fill={highlight} strokeWidth=".7" />
      </>}
      {type === 'k' && <>
        <path d="M28 39 C32 51 31 59 24 65 H56 C49 59 48 51 52 39Z" />
        <path d="M36 6 H44 V13 H51 V20 H44 V28 H36 V20 H29 V13 H36Z" fill={trim} />
        <path d="M39 8 V18 H32" fill="none" stroke={highlight} opacity=".75" />
        <path d="M40 32 C31 17 19 23 22 33 L27 43 H53 L58 33 C61 23 49 17 40 32Z" />
        <path d="M40 33 V42 M27 29 Q31 26 36 33" fill="none" stroke={highlight} opacity=".65" />
        <path d="M27 43 H53 V48 Q40 51 27 48Z" fill={trim} />
        <path d="M33 53 L31 60 M47 53 L49 60" fill="none" stroke={shade} />
      </>}
      <path d="M25 63 Q40 60 55 63 L58 67 Q40 71 22 67Z" fill={trim} />
      <path d="M24 68 H56 L63 75 V79 Q40 85 17 79 V75Z" fill={body} />
      <path d="M20 74 Q40 78 60 74 M18 79 Q40 83 62 79" fill="none" stroke={shade} />
      <path d="M26 70 Q39 73 54 70" fill="none" stroke={highlight} opacity=".65" />
    </g>
  </svg>
}
