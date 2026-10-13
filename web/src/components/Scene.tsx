// Key art: golden hour over the Plateau, seen from the lagoon. Pure SVG so it
// stays sharp on every screen and weighs a few kilobytes.

const TOWERS: [x: number, w: number, h: number][] = [
  [470, 46, 150], [520, 38, 210], [562, 54, 170], [700, 40, 250], [744, 58, 190], [806, 34, 230], [846, 50, 160],
  [900, 44, 120], [420, 40, 100], [950, 60, 90],
]

export function Scene({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 1440 900" preserveAspectRatio="xMidYMax slice" aria-hidden>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1d1650" />
          <stop offset="0.35" stopColor="#5b2a86" />
          <stop offset="0.58" stopColor="#d9466f" />
          <stop offset="0.72" stopColor="#ff8a3d" />
          <stop offset="0.8" stopColor="#ffc15e" />
        </linearGradient>
        <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff6c8" />
          <stop offset="0.6" stopColor="#ffd36b" />
          <stop offset="1" stopColor="#ff9a3d" />
        </radialGradient>
        <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffd36b" stopOpacity="0.7" />
          <stop offset="1" stopColor="#ff8a3d" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c0507a" />
          <stop offset="0.35" stopColor="#5a2f80" />
          <stop offset="1" stopColor="#161245" />
        </linearGradient>
        <linearGradient id="city" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5c2e78" />
          <stop offset="1" stopColor="#3a1f5e" />
        </linearGradient>
      </defs>

      <rect width="1440" height="900" fill="url(#sky)" />

      {/* Stars fading into the dusk */}
      {[...Array(28)].map((_, i) => (
        <circle key={i} cx={(i * 211) % 1440} cy={(i * 97) % 260} r={i % 4 === 0 ? 1.8 : 1.1} fill="#fff" opacity={0.25 + ((i * 37) % 50) / 100} />
      ))}

      <circle cx="720" cy="560" r="300" fill="url(#glow)" />
      <circle cx="720" cy="560" r="118" fill="url(#sun)" />

      {/* Soft clouds */}
      <g fill="#ffb4a0" opacity="0.45">
        <ellipse cx="300" cy="380" rx="160" ry="18" />
        <ellipse cx="380" cy="364" rx="90" ry="16" />
        <ellipse cx="1150" cy="420" rx="190" ry="16" />
        <ellipse cx="1060" cy="404" rx="80" ry="14" />
      </g>

      {/* Birds */}
      <g stroke="#3a1f5e" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.7">
        <path d="M980 300 q10 -10 20 0 q10 -10 20 0" />
        <path d="M1040 270 q8 -8 16 0 q8 -8 16 0" />
        <path d="M940 330 q7 -7 14 0 q7 -7 14 0" />
      </g>

      {/* Far hills */}
      <path d="M0 610 Q200 560 420 600 T880 590 T1440 600 V640 H0Z" fill="#7a3a7f" opacity="0.55" />

      {/* Plateau skyline */}
      <g fill="url(#city)">
        {TOWERS.map(([x, w, h], i) => (
          <rect key={i} x={x} y={640 - h} width={w} height={h} rx="3" />
        ))}
        {/* La Pyramide */}
        <path d="M600 640 L600 560 L612 560 L612 530 L628 530 L628 500 L648 500 L648 470 L668 470 L668 640Z" />
        {/* Cathédrale Saint-Paul and its leaning spire */}
        <path d="M1010 640 L1010 590 Q1060 560 1110 590 L1110 640Z" />
        <path d="M1046 600 L1080 420 L1090 424 L1064 600Z" />
        <rect x="1078" y="408" width="6" height="22" transform="rotate(12 1081 419)" />
        {/* Antenna */}
        <rect x="718" y="350" width="4" height="42" />
      </g>
      {/* Lit windows */}
      <g fill="#ffd36b" opacity="0.75">
        {TOWERS.flatMap(([x, w, h], i) =>
          [...Array(Math.floor(h / 26))].map((_, j) => (j + i) % 3 === 0 ? <rect key={`${i}-${j}`} x={x + 8 + ((j * 13) % Math.max(w - 16, 1))} y={640 - h + 14 + j * 24} width="6" height="8" rx="1" /> : null),
        )}
      </g>

      {/* Lagoon */}
      <rect y="640" width="1440" height="260" fill="url(#water)" />
      <g fill="#ffd36b">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <rect key={i} x={720 - (130 - i * 14)} y={652 + i * 18} width={(130 - i * 14) * 2} height="5" rx="2.5" opacity={0.75 - i * 0.09}>
            <animate attributeName="x" values={`${720 - (130 - i * 14)};${728 - (130 - i * 14)};${720 - (130 - i * 14)}`} dur={`${3 + i * 0.4}s`} repeatCount="indefinite" />
          </rect>
        ))}
      </g>
      <g fill="#3a1f5e" opacity="0.35">
        {TOWERS.map(([x, w, h], i) => (
          <rect key={i} x={x} y="642" width={w} height={h * 0.35} rx="3" />
        ))}
      </g>

      {/* Bridge with a gbaka crossing it */}
      <g>
        <rect x="0" y="664" width="1440" height="9" fill="#2b1850" />
        {[...Array(16)].map((_, i) => (
          <rect key={i} x={40 + i * 92} y="673" width="10" height="30" fill="#2b1850" />
        ))}
        <g>
          <animateTransform attributeName="transform" type="translate" from="-160 0" to="1600 0" dur="18s" repeatCount="indefinite" />
          <rect x="0" y="640" width="66" height="26" rx="6" fill="#ffc233" />
          <rect x="6" y="645" width="44" height="9" rx="2" fill="#2b1850" opacity="0.7" />
          <rect x="54" y="645" width="9" height="9" rx="2" fill="#2b1850" opacity="0.7" />
          <rect x="0" y="657" width="66" height="4" fill="#00b86b" />
          <circle cx="14" cy="666" r="5" fill="#1d1236" />
          <circle cx="52" cy="666" r="5" fill="#1d1236" />
        </g>
      </g>

      {/* Pirogue */}
      <g transform="translate(980 760)">
        <animateTransform attributeName="transform" type="translate" values="980 760; 990 764; 980 760" dur="5s" repeatCount="indefinite" />
        <path d="M0 0 Q70 18 140 0 L128 12 Q70 26 12 12Z" fill="#1d1236" />
        <path d="M70 -4 L70 -46 M58 -40 L82 -40" stroke="#1d1236" strokeWidth="4" strokeLinecap="round" />
        <circle cx="70" cy="-52" r="7" fill="#1d1236" />
      </g>

      {/* Foreground palms */}
      <Palm x={90} y={900} scale={1.25} />
      <Palm x={1340} y={900} scale={1.05} flip />
      <Palm x={1220} y={900} scale={0.7} />
    </svg>
  )
}

function Palm({ x, y, scale, flip }: { x: number; y: number; scale: number; flip?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})`} fill="#140d33">
      <path d="M-8 0 Q-2 -160 30 -300 L40 -298 Q12 -160 10 0Z" />
      <g transform="translate(35 -300)">
        <path d="M0 0 Q-80 -40 -150 10 Q-80 -20 0 6Z" />
        <path d="M0 0 Q-60 -90 -120 -80 Q-60 -60 0 6Z" />
        <path d="M0 0 Q20 -90 90 -100 Q30 -60 4 6Z" />
        <path d="M0 0 Q80 -40 160 10 Q80 -18 0 6Z" />
        <path d="M0 0 Q60 20 110 90 Q50 30 -4 8Z" />
        <path d="M0 0 Q-60 20 -100 90 Q-40 30 4 8Z" />
        <circle cx="-4" cy="10" r="9" />
        <circle cx="10" cy="12" r="8" />
      </g>
    </g>
  )
}
