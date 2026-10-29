import type { Look } from '../../lib/types'

// What the perso is doing at each step of a played action, seen (components/defi/Gestes.tsx): a
// little scene that moves on with the combination, `k` from 0 (the first arrow) to 1 (done). The
// bed made as the arrows go, the brush scrubbing, the light going out, the perso lying down…

export type SceneId = 'lit' | 'dents' | 'lumiere' | 'coucher' | 'eau' | 'savon' | 'dos' | 'shampooing' | 'rincer' | 'secher'

const W = 220
const H = 120
/** Framed on the action (the room's empty corners left out). */
const VIEW = '40 4 176 112'

/** The perso from the front, in its colours, its arms as asked (radians from hanging down). */
function Perso({ look, x, y, armL = 0, armR = 0, s = 1, towel }: { look?: Look; x: number; y: number; armL?: number; armR?: number; s?: number; towel?: boolean }) {
  const skin = look?.skin ?? '#6e4024'
  const top = towel ? '#f4f1ea' : (look?.outfitColor ?? '#ff7a00')
  const arm = (side: -1 | 1, a: number) => (
    <rect x={side < 0 ? -15 : 11} y={-26} width="4" height="18" rx="2" fill={skin} transform={`rotate(${(side * a * 180) / Math.PI} ${side < 0 ? -13 : 13} -26)`} />
  )
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-7" y="-8" width="5" height="16" rx="2" fill={towel ? skin : (look?.bottomColor || '#2b3a55')} />
      <rect x="2" y="-8" width="5" height="16" rx="2" fill={towel ? skin : (look?.bottomColor || '#2b3a55')} />
      <rect x="-11" y="-30" width="22" height="24" rx="5" fill={top} />
      {arm(-1, armL)}
      {arm(1, armR)}
      <circle cx="0" cy="-39" r="9" fill={skin} />
      <rect x="-9" y="-48" width="18" height="6" rx="3" fill={look?.hairColor ?? '#141010'} />
    </g>
  )
}

const wave = (k: number, n = 3) => Math.sin(k * Math.PI * 2 * n)

export function StepScene({ id, k, look }: { id: SceneId; k: number; look?: Look }) {
  return (
    <svg width="100%" height="100%" viewBox={VIEW} preserveAspectRatio="xMidYMid meet" aria-hidden>
      <rect width={W} height={H} rx="14" fill={id === 'lumiere' && k >= 1 ? '#1d2147' : id === 'lit' || id === 'dents' || id === 'lumiere' || id === 'coucher' ? '#f6ead6' : '#dff1f8'} />
      {scene(id, Math.max(0, Math.min(1, k)), look)}
    </svg>
  )
}

function Bed({ cover = 1, pillow = 1 }: { cover?: number; pillow?: number }) {
  return (
    <g>
      <rect x="96" y="66" width="110" height="26" rx="4" fill="#8a5a32" />
      <rect x="96" y="56" width="8" height="40" fill="#6b4426" />
      <rect x="104" y="60" width="100" height="12" rx="4" fill="#fff" />
      <ellipse cx="118" cy="58" rx={11 * pillow} ry={6 * pillow} fill="#fff" stroke="#d9d2c2" />
      {/* The blanket pulled up over the bed, as far as it's got */}
      <rect x={204 - 86 * cover} y="58" width={86 * cover} height="16" rx="4" fill="#4dabf7" />
      <rect x="96" y="96" width="6" height="12" fill="#6b4426" />
      <rect x="200" y="96" width="6" height="12" fill="#6b4426" />
    </g>
  )
}

function scene(id: SceneId, k: number, look?: Look) {
  switch (id) {
    case 'lit':
      // Pulling the blanket up the bed, fluffing the pillow at the end.
      return (
        <g>
          <Bed cover={0.15 + 0.85 * k} pillow={k > 0.8 ? 1.15 : 0.85} />
          <Perso look={look} x={70} y={98} armR={-1.2 - 0.3 * wave(k, 2)} armL={-0.6} />
        </g>
      )
    case 'dents': {
      // In front of the mirror: the brush going to and fro, the foam growing.
      const bx = 112 + wave(k, 5) * 8
      return (
        <g>
          <rect x="140" y="14" width="60" height="70" rx="6" fill="#cfe8f2" stroke="#9aa1a8" strokeWidth="3" />
          <rect x="130" y="86" width="80" height="10" rx="3" fill="#fff" stroke="#c9d1d8" />
          <Perso look={look} x={100} y={104} armR={-2.6} s={1.15} />
          <rect x={bx} y="52" width="16" height="4" rx="2" fill="#4dabf7" />
          {[...Array(Math.round(k * 6))].map((_, i) => (
            <circle key={i} cx={98 + i * 3} cy={62 + (i % 2) * 3} r="2.5" fill="#fff" />
          ))}
        </g>
      )
    }
    case 'lumiere': {
      // The hand going to the switch; at the end, click: the room goes dark, the moon at the window.
      const off = k >= 1
      return (
        <g>
          <rect x="150" y="16" width="44" height="40" rx="3" fill={off ? '#0f1230' : '#9fd3ef'} stroke="#8a5a32" strokeWidth="3" />
          {off && <circle cx="180" cy="28" r="7" fill="#fff6d0" />}
          <circle cx="60" cy="14" r="8" fill={off ? '#3a3f6a' : '#ffe066'} />
          <rect x="124" y="54" width="12" height="18" rx="2" fill="#fff" stroke="#9aa1a8" />
          <rect x="127" y={off ? 64 : 57} width="6" height="6" rx="1" fill="#2b2b2b" />
          <Perso look={look} x={100} y={104} armR={-1.6 * Math.min(1, k * 1.3)} />
        </g>
      )
    }
    case 'coucher': {
      // Lying down little by little, the blanket over at the end.
      const lie = k
      return (
        <g>
          <Bed cover={k >= 1 ? 0.75 : 0} />
          <g transform={`translate(${70 + 60 * lie} ${100 - 34 * lie}) rotate(${-90 * lie})`}>
            <Perso look={look} x={0} y={0} />
          </g>
          {k >= 1 && (
            <text x="150" y="36" fontSize="16" fontWeight="800" fill="#7048e8">
              Zzz
            </text>
          )}
        </g>
      )
    }
    case 'eau':
    case 'rincer':
    case 'savon':
    case 'dos':
    case 'shampooing': {
      // Under the shower: the water running, the soap's bubbles, the back scrubbed, the head foamed.
      const water = id === 'eau' ? k : 1
      const foam = id === 'savon' ? k : id === 'shampooing' ? 0.4 : id === 'dos' ? 0.6 : id === 'rincer' ? 1 - k : 0
      return (
        <g>
          <rect x="70" y="8" width="80" height="6" rx="3" fill="#9aa1a8" />
          <rect x="104" y="8" width="6" height="18" fill="#9aa1a8" />
          <ellipse cx="107" cy="28" rx="12" ry="4" fill="#9aa1a8" />
          {[...Array(Math.round(water * 9))].map((_, i) => (
            <rect key={i} x={96 + (i % 9) * 3} y={34 + ((i * 7) % 6)} width="1.6" height="60" fill="#74c0fc" opacity="0.7" />
          ))}
          <Perso look={look} x={107} y={110} towel={false} armL={id === 'dos' ? -2.2 + wave(k, 3) * 0.3 : -0.4} armR={id === 'savon' ? -1 + wave(k, 4) * 0.4 : id === 'shampooing' ? -2.8 : -0.3} />
          {[...Array(Math.round(foam * 10))].map((_, i) => (
            <circle key={i} cx={id === 'shampooing' ? 99 + (i % 6) * 3 : 96 + (i * 7) % 24} cy={id === 'shampooing' ? 60 - (i % 3) * 3 : 82 + ((i * 5) % 18)} r="3" fill="#fff" stroke="#d0ebff" />
          ))}
          {id === 'shampooing' && [...Array(Math.round(k * 8))].map((_, i) => <circle key={`s${i}`} cx={98 + (i % 5) * 4} cy={56 - Math.floor(i / 5) * 4} r="3.4" fill="#fff" />)}
        </g>
      )
    }
    case 'secher':
      // The towel rubbed this way and that.
      return (
        <g>
          <Perso look={look} x={107} y={110} towel armL={-2 + wave(k, 3) * 0.3} armR={-2 - wave(k, 3) * 0.3} />
          <rect x={90 + wave(k, 3) * 6} y="40" width="34" height="10" rx="3" fill="#ff8fb1" />
        </g>
      )
  }
}
