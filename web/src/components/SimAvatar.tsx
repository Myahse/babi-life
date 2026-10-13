import { useId } from 'react'
import type { Look, Sim } from '../lib/types'

export const SKIN_TONES = ['#f3cfa3', '#d9a066', '#b97a45', '#965a30', '#744220', '#4f2c15']
export const HAIR_COLORS = ['#1c1410', '#3d2414', '#6e4120', '#b8862f', '#8f2a2a']
export const OUTFIT_COLORS = ['#ff7a00', '#00b86b', '#2a6cf0', '#e0306a', '#7b5cff', '#ffc233', '#f4efe6']
export const HAIRS = [
  { id: 'braids', label: 'Tresses' },
  { id: 'afro', label: 'Afro' },
  { id: 'short', label: 'Court' },
  { id: 'headwrap', label: 'Foulard' },
  { id: 'locks', label: 'Dreads' },
  { id: 'bald', label: 'Rasé' },
]
export const OUTFITS = [
  { id: 'pagne', label: 'Pagne wax' },
  { id: 'boubou', label: 'Boubou' },
  { id: 'casual', label: 'Jean & tee' },
  { id: 'suit', label: 'Costume' },
  { id: 'jersey', label: 'Éléphants' },
]

const OUTLINE = '#2a1810'
const VIEW = { full: '0 0 120 180', bust: '6 4 108 128', head: '18 2 84 84' } as const

type Props = {
  look: Look
  gender: Sim['gender']
  /** Width in px. */
  size?: number
  crop?: keyof typeof VIEW
  animated?: boolean
}

/** Shift a hex colour towards black (amount < 0) or white (amount > 0). */
function tint(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16)
  const mix = (c: number) => Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount)
  const [r, g, b] = [mix(n >> 16), mix((n >> 8) & 255), mix(n & 255)]
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

/**
 * The player's Sim: a chibi character drawn in SVG so every combination of
 * skin, hair and outfit works without art assets.
 */
export function SimAvatar({ look, gender, size = 160, crop = 'full', animated = true }: Props) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const [, , vw, vh] = VIEW[crop].split(' ').map(Number)
  const skin = look.skin
  const skinShade = tint(skin, -0.22)
  const cloth = look.outfit === 'jersey' ? '#ff7a00' : look.outfitColor
  const clothShade = tint(cloth, -0.25)
  const femme = gender === 'femme'
  const dress = femme && (look.outfit === 'pagne' || look.outfit === 'boubou')
  const robe = !femme && look.outfit === 'boubou'
  const clothFill = look.outfit === 'pagne' ? `url(#wax${id})` : `url(#cloth${id})`
  const trousers = look.outfit === 'suit' ? '#26324a' : look.outfit === 'jersey' ? '#ffffff' : look.outfit === 'pagne' ? '#2b2f45' : '#3563a8'
  const stroke = { stroke: OUTLINE, strokeWidth: 2.2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }

  return (
    <svg width={size} height={(size * vh) / vw} viewBox={VIEW[crop]} aria-label="Avatar du Sim" className={crop === 'full' ? 'overflow-visible' : 'overflow-hidden'}>
      <defs>
        <linearGradient id={`skin${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={tint(skin, 0.12)} />
          <stop offset="0.6" stopColor={skin} />
          <stop offset="1" stopColor={skinShade} />
        </linearGradient>
        <linearGradient id={`cloth${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={tint(cloth, 0.12)} />
          <stop offset="0.65" stopColor={cloth} />
          <stop offset="1" stopColor={clothShade} />
        </linearGradient>
        <linearGradient id={`hair${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={tint(look.hairColor, 0.18)} />
          <stop offset="1" stopColor={look.hairColor} />
        </linearGradient>
        <pattern id={`wax${id}`} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(12)">
          <rect width="14" height="14" fill={cloth} />
          <circle cx="7" cy="7" r="4.6" fill="none" stroke="#fff6e3" strokeWidth="1.8" />
          <circle cx="7" cy="7" r="1.8" fill={OUTLINE} />
          <path d="M0 0l3 3M14 0l-3 3M0 14l3-3M14 14l-3-3" stroke={tint(cloth, -0.35)} strokeWidth="1.6" />
        </pattern>
      </defs>

      <g className={animated ? 'sim-body' : undefined}>
        {crop === 'full' && <ellipse cx="60" cy="172" rx="30" ry="5" fill="#000" opacity="0.16" />}

        {/* Legs and shoes */}
        {crop === 'full' && (
          <g {...stroke}>
            {dress || robe ? (
              <>
                <rect x="48" y="146" width="10" height="20" rx="5" fill={`url(#skin${id})`} />
                <rect x="62" y="146" width="10" height="20" rx="5" fill={`url(#skin${id})`} />
              </>
            ) : (
              <>
                <rect x="45" y="126" width="14" height="40" rx="6" fill={trousers} />
                <rect x="61" y="126" width="14" height="40" rx="6" fill={tint(trousers, -0.12)} />
                {look.outfit === 'jersey' && (
                  <>
                    <rect x="46" y="150" width="12" height="14" rx="3" fill="#00b86b" strokeWidth="0" />
                    <rect x="62" y="150" width="12" height="14" rx="3" fill="#00b86b" strokeWidth="0" />
                  </>
                )}
              </>
            )}
            <path d="M41 168 Q41 160 50 160 L58 160 L58 170 L43 170 Q41 170 41 168Z" fill={look.outfit === 'suit' ? '#1c1c22' : '#f4f4f8'} />
            <path d="M79 168 Q79 160 70 160 L62 160 L62 170 L77 170 Q79 170 79 168Z" fill={look.outfit === 'suit' ? '#1c1c22' : '#f4f4f8'} />
          </g>
        )}

        {/* Long hair that falls behind the body */}
        <HairBack style={look.hair} fill={`url(#hair${id})`} stroke={stroke} />

        {/* Arms */}
        <g {...stroke}>
          <rect x="22" y="90" width="13" height="42" rx="6.5" transform="rotate(10 28 90)" fill={robe || look.outfit === 'suit' || look.outfit === 'boubou' ? clothFill : `url(#skin${id})`} />
          <rect x="85" y="90" width="13" height="42" rx="6.5" transform="rotate(-10 92 90)" fill={robe || look.outfit === 'suit' || look.outfit === 'boubou' ? clothFill : `url(#skin${id})`} />
          <circle cx="23" cy="131" r="6.5" fill={`url(#skin${id})`} />
          <circle cx="97" cy="131" r="6.5" fill={`url(#skin${id})`} />
          {(look.outfit === 'casual' || look.outfit === 'jersey' || (look.outfit === 'pagne' && !dress)) && (
            <>
              <path d="M30 88 Q36 86 40 90 L37 106 L25 103 Z" fill={clothFill} />
              <path d="M90 88 Q84 86 80 90 L83 106 L95 103 Z" fill={clothFill} />
            </>
          )}
        </g>

        {/* Torso */}
        <g {...stroke}>
          {dress ? (
            <path d="M38 96 Q38 85 48 84 L72 84 Q82 85 82 96 L94 154 Q60 163 26 154 Z" fill={clothFill} />
          ) : robe ? (
            <path d="M34 96 Q34 85 46 84 L74 84 Q86 85 86 96 L92 150 Q60 157 28 150 Z" fill={clothFill} />
          ) : (
            <path d="M35 96 Q35 85 46 84 L74 84 Q85 85 85 96 L86 132 Q60 138 34 132 Z" fill={clothFill} />
          )}
        </g>
        {dress && look.outfit === 'pagne' && <path d="M30 128 Q60 136 90 128" stroke={OUTLINE} strokeWidth="2" fill="none" opacity="0.5" />}
        {(look.outfit === 'boubou') && <path d="M52 86 Q60 100 68 86" stroke="#ffc233" strokeWidth="2.5" fill="none" />}
        {look.outfit === 'suit' && (
          <g {...stroke}>
            <path d="M50 84 L60 112 L70 84 Z" fill="#fff" />
            <path d="M60 90 L56 108 L60 116 L64 108 Z" fill={look.outfitColor === '#f4efe6' ? '#e0306a' : look.outfitColor} strokeWidth="1.6" />
            <path d="M50 84 L46 98 L56 104" fill="none" />
            <path d="M70 84 L74 98 L64 104" fill="none" />
          </g>
        )}
        {look.outfit === 'jersey' && (
          <g>
            <path d="M36 104 L84 104 L84 111 L36 111 Z" fill="#00b86b" />
            <text x="60" y="100" textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff" fontFamily="Baloo 2" stroke={OUTLINE} strokeWidth="0.6">10</text>
            <path d="M52 84 Q60 92 68 84" stroke="#00b86b" strokeWidth="3" fill="none" />
          </g>
        )}
        {look.outfit === 'casual' && <path d="M51 84 Q60 93 69 84" stroke={OUTLINE} strokeWidth="2" fill={`url(#skin${id})`} />}

        {/* Neck, ears and head */}
        <g {...stroke}>
          <path d="M53 76 L53 86 Q60 90 67 86 L67 76" fill={skinShade} />
          <circle cx="31" cy="56" r="6" fill={`url(#skin${id})`} />
          <circle cx="89" cy="56" r="6" fill={`url(#skin${id})`} />
          <ellipse cx="60" cy="52" rx="29" ry="30" fill={`url(#skin${id})`} />
        </g>
        {femme && (
          <g stroke={OUTLINE} strokeWidth="1.2">
            <circle cx="30" cy="64" r="3" fill="#ffc233" />
            <circle cx="90" cy="64" r="3" fill="#ffc233" />
          </g>
        )}

        {/* Face */}
        <ellipse cx="45" cy="64" rx="5" ry="3" fill="#ff6b6b" opacity="0.22" />
        <ellipse cx="75" cy="64" rx="5" ry="3" fill="#ff6b6b" opacity="0.22" />
        <g className={animated ? 'sim-eyes' : undefined}>
          <ellipse cx="49" cy="56" rx="5.2" ry="6.4" fill="#fff" stroke={OUTLINE} strokeWidth="1.8" />
          <ellipse cx="71" cy="56" rx="5.2" ry="6.4" fill="#fff" stroke={OUTLINE} strokeWidth="1.8" />
          <circle cx="50" cy="57" r="3.6" fill="#3a2214" />
          <circle cx="72" cy="57" r="3.6" fill="#3a2214" />
          <circle cx="51.3" cy="55.4" r="1.4" fill="#fff" />
          <circle cx="73.3" cy="55.4" r="1.4" fill="#fff" />
        </g>
        {femme ? (
          <g stroke={OUTLINE} strokeWidth="2" strokeLinecap="round" fill="none">
            <path d="M43.5 51 L41.5 49 M46 49.6 L45 47.2" />
            <path d="M76.5 51 L78.5 49 M74 49.6 L75 47.2" />
          </g>
        ) : (
          <g stroke={tint(look.hairColor, -0.1)} strokeWidth="2.8" strokeLinecap="round" fill="none">
            <path d="M43 46 Q49 43 54 46" />
            <path d="M66 46 Q71 43 77 46" />
          </g>
        )}
        <path d="M58 63 Q60 65 62 63" stroke={skinShade} strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M52 69 Q60 77 68 69 Q60 72 52 69Z" fill="#7a2323" stroke={OUTLINE} strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M55 70.4 Q60 72 65 70.4" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" />

        <HairFront style={look.hair} fill={`url(#hair${id})`} accent={look.outfitColor} stroke={stroke} />
      </g>
    </svg>
  )
}

type Stroke = { stroke: string; strokeWidth: number; strokeLinejoin: 'round'; strokeLinecap: 'round' }

function HairBack({ style, fill, stroke }: { style: string; fill: string; stroke: Stroke }) {
  switch (style) {
    case 'afro':
      return <circle cx="60" cy="42" r="37" fill={fill} {...stroke} />
    case 'braids':
      return (
        <g fill={fill} {...stroke}>
          {[26, 33, 87, 94].map((x, i) => (
            <rect key={x} x={x - 3.5} y="42" width="7" height={i === 0 || i === 3 ? 66 : 76} rx="3.5" />
          ))}
        </g>
      )
    case 'locks':
      return (
        <g fill={fill} {...stroke}>
          {[28, 35, 85, 92].map((x, i) => (
            <rect key={x} x={x - 3.5} y="40" width="7" height={i % 3 === 0 ? 46 : 54} rx="3.5" />
          ))}
        </g>
      )
    default:
      return null
  }
}

function HairFront({ style, fill, accent, stroke }: { style: string; fill: string; accent: string; stroke: Stroke }) {
  switch (style) {
    case 'afro':
      return <path d="M31 50 Q31 24 60 23 Q89 24 89 50 Q82 35 60 35 Q38 35 31 50Z" fill={fill} {...stroke} />
    case 'short':
      return <path d="M31 50 Q30 22 60 21 Q90 22 89 50 Q85 36 74 33 Q60 30 46 33 Q35 36 31 50Z" fill={fill} {...stroke} />
    case 'braids':
      return (
        <g {...stroke}>
          <path d="M30 54 Q28 20 60 20 Q92 20 90 54 Q86 34 60 32 Q34 34 30 54Z" fill={fill} />
          <path d="M60 21 L60 32 M46 24 L44 34 M74 24 L76 34" strokeWidth="1.4" opacity="0.7" />
        </g>
      )
    case 'locks':
      return (
        <g {...stroke}>
          <path d="M30 52 Q29 21 60 20 Q91 21 90 52 Q84 34 60 33 Q36 34 30 52Z" fill={fill} />
          <path d="M40 30 L38 40 M50 27 L49 36 M70 27 L71 36 M80 30 L82 40" strokeWidth="1.4" opacity="0.6" />
        </g>
      )
    case 'headwrap': {
      const deep = tint(accent === '#f4efe6' ? '#ff7a00' : accent, -0.25)
      const main = accent === '#f4efe6' ? '#ff7a00' : accent
      return (
        <g {...stroke}>
          <path d="M28 56 Q22 14 60 8 Q98 14 92 56 Q86 38 60 36 Q34 38 28 56Z" fill={main} />
          <path d="M34 34 Q60 22 86 34" stroke="#fff" strokeOpacity="0.55" strokeWidth="3" fill="none" />
          <path d="M38 44 Q60 32 82 44" stroke={deep} strokeWidth="2.5" fill="none" />
          <ellipse cx="78" cy="14" rx="11" ry="8" fill={main} transform="rotate(-25 78 14)" />
          <ellipse cx="88" cy="22" rx="7" ry="5" fill={deep} transform="rotate(30 88 22)" />
        </g>
      )
    }
    default:
      return <path d="M44 30 Q52 25 60 26" stroke="#fff" strokeOpacity="0.45" strokeWidth="3" fill="none" strokeLinecap="round" />
  }
}
