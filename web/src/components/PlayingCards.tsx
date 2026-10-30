import { memo } from 'react'
import { t } from '../lib/i18n'

// The cards of 8 américain, in the game's own look: the suits drawn in pixels like the blocks of
// the street, the figures as little blocky Ivorians (the valet in his cap, the dame in her wax
// headwrap with gold earrings, the roi crowned like a chief), the backs a wax print in the game's
// orange and green. Pure drawing: the rules are the server's (backend game/huit.go).

/** A card: 0–51 is suit × 13 + value − 1, 52 and 53 the jokers (lib/types.ts HuitStep). */
export const SUITS = ['♣', '♦', '♥', '♠']
export const SUIT_NAMES = [t('trèfle'), t('carreau'), t('cœur'), t('pique')]
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'V', 'D', 'R']
export const isJoker = (c: number) => c >= 52
export const rankOf = (c: number) => (isJoker(c) ? 0 : (c % 13) + 1)
export const suitOf = (c: number) => (isJoker(c) ? -1 : Math.floor(c / 13))
export const isRed = (c: number) => (isJoker(c) ? c === 52 : suitOf(c) === 1 || suitOf(c) === 2)
export const RED = '#e3263a'
export const INK = '#161a2b'
/** The paper: a warm white, not a screen's. */
const PAPER = '#fffaf0'
/** Height for a width. */
export const cardH = (w: number) => Math.round(w * 1.42)

/** « l'as de cœur », « le 7 de pique », « la dame de trèfle », « un joker ». */
export function cardName(c: number) {
  if (isJoker(c)) return t('un joker')
  // Each as one sentence, for the catalogue (« the queen of clubs »).
  const suit = SUIT_NAMES[suitOf(c)]
  const r = rankOf(c)
  if (r === 1) return t("l'as de {suit}", { suit })
  if (r === 11) return t('le valet de {suit}', { suit })
  if (r === 12) return t('la dame de {suit}', { suit })
  if (r === 13) return t('le roi de {suit}', { suit })
  return t('le {r} de {suit}', { r, suit })
}

/** The suits on a 7 × 7 grid, like the street's blocks: trèfle, carreau, cœur, pique. */
const SUIT_PIXELS = [
  [t('..XXX..'), t('..XXX..'), 'XX.X.XX', 'XXXXXXX', 'XX.X.XX', t('...X...'), t('..XXX..')],
  [t('...X...'), t('..XXX..'), t('.XXXXX.'), 'XXXXXXX', t('.XXXXX.'), t('..XXX..'), t('...X...')],
  [t('.XX.XX.'), 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', t('.XXXXX.'), t('..XXX..'), t('...X...')],
  [t('...X...'), t('..XXX..'), t('.XXXXX.'), 'XXXXXXX', 'XXXXXXX', t('...X...'), t('..XXX..')],
]
/** Each suit's light: one pixel near the top, as the sun catches a block. */
const SUIT_SHINE: [number, number][] = [[2, 0], [3, 1], [1, 1], [3, 1]]

/** A suit in pixels, `size` px square (crisp at any size). */
export const PixelSuit = memo(function PixelSuit({ suit, size, color, flip }: { suit: number; size: number; color?: string; flip?: boolean }) {
  const fill = color ?? (suit === 1 || suit === 2 ? RED : INK)
  const rows = SUIT_PIXELS[suit]
  const [sx, sy] = SUIT_SHINE[suit]
  return (
    <svg width={size} height={size} viewBox="0 0 7 7" shapeRendering="crispEdges" style={flip ? { transform: 'rotate(180deg)' } : undefined} aria-hidden>
      {rows.flatMap((row, y) => [...row].map((ch, x) => (ch === 'X' ? <rect key={`${x},${y}`} x={x} y={y} width={1.02} height={1.02} fill={fill} /> : null)))}
      <rect x={sx} y={sy} width={1} height={1} fill="#fff" opacity={0.55} />
    </svg>
  )
})

/**
 * The figures on a 12 × 14 grid. k skin (K its shade), e eyes, h hair and beard, g gold, r the
 * suit's colour (R darker), w white, o orange and m green (the wax), l lips.
 */
const FIGURES: Record<'V' | 'D' | 'R', string[]> = {
  V: ['............', '...rrrrrr...', '..rrrrrrrr..', t('.RRRrrrrrr..'), '...kkkkkk...', '...kekkek...', t('...kkkkkK...'), '....kllk....', '..wwwwwwww..', '.wwrrwwrrww.', '.wwwwwwwwww.', '.wwrrwwrrww.', '.wwwwwwwwww.', '.wwwwwwwwww.'],
  D: ['...oommoo...', '..oommoomm..', '..mmoommoo..', '..ookkkkoo..', '...kekkek...', t('..gkkkkkKg..'), '..g.kllk.g..', '....kkkk....', '..rrrrrrrr..', '.rrorrrrorr.', '.rrrroorrrr.', '.rrorrrrorr.', '.rrrrrrrrrr.', '.rrrrrrrrrr.'],
  R: ['..g..gg..g..', '..gggggggg..', '..grggggrg..', '...kkkkkk...', '...kekkek...', t('...kkkkkK...'), '...khhhhk...', '....hhhh....', '..rrrrrrrr..', '.rrgrrrrgrr.', '.rrrggggrrr.', '.rrgrrrrgrr.', '.rrrrrrrrrr.', '.rrrrrrrrrr.'],
}
const SKIN = '#8a5534'
const SKIN_SHADE = '#6b3f24'

/** A figure in pixels, in its suit's colour. */
const PixelFigure = memo(function PixelFigure({ face, color, width }: { face: 'V' | 'D' | 'R'; color: string; width: number }) {
  const dark = color === RED ? '#a8152a' : '#000'
  const palette: Record<string, string> = { k: SKIN, K: SKIN_SHADE, e: '#141010', h: '#141010', g: '#ffc233', r: color, R: dark, w: '#f4f1ea', o: '#ff7a00', m: '#00b86b', l: '#b4323f' }
  const rows = FIGURES[face]
  return (
    <svg width={width} height={(width * 14) / 12} viewBox="0 0 12 14" shapeRendering="crispEdges" aria-hidden>
      {rows.flatMap((row, y) => [...row].map((ch, x) => (palette[ch] ? <rect key={`${x},${y}`} x={x} y={y} width={1.02} height={1.02} fill={palette[ch]} /> : null)))}
    </svg>
  )
})

/** Where the pips go on a card from 2 to 10 (x, y in the card's middle box, 0–1); those below the middle upside down. */
const PIPS: Record<number, [number, number][]> = {
  2: [[0.5, 0], [0.5, 1]],
  3: [[0.5, 0], [0.5, 0.5], [0.5, 1]],
  4: [[0, 0], [1, 0], [0, 1], [1, 1]],
  5: [[0, 0], [1, 0], [0.5, 0.5], [0, 1], [1, 1]],
  6: [[0, 0], [1, 0], [0, 0.5], [1, 0.5], [0, 1], [1, 1]],
  7: [[0, 0], [1, 0], [0.5, 0.25], [0, 0.5], [1, 0.5], [0, 1], [1, 1]],
  8: [[0, 0], [1, 0], [0.5, 0.25], [0, 0.5], [1, 0.5], [0.5, 0.75], [0, 1], [1, 1]],
  9: [[0, 0], [1, 0], [0, 0.33], [1, 0.33], [0.5, 0.5], [0, 0.67], [1, 0.67], [0, 1], [1, 1]],
  10: [[0, 0], [1, 0], [0.5, 0.17], [0, 0.33], [1, 0.33], [0, 0.67], [1, 0.67], [0.5, 0.83], [0, 1], [1, 1]],
}

/** A card face up: its value and suit in the corners, the pips (or the figure) in the middle. */
export function PlayingCard({ c, w = 58, dim, up, onClick, className = '' }: { c: number; w?: number; dim?: boolean; up?: boolean; onClick?: () => void; className?: string }) {
  const h = cardH(w)
  const color = isRed(c) ? RED : INK
  const Tag = onClick ? 'button' : 'div'
  const base = `relative block shrink-0 overflow-hidden text-left transition-[transform,filter] duration-200 ${dim ? 'brightness-[0.72] saturate-[0.6]' : ''} ${className}`
  const style = { width: w, height: h, borderRadius: Math.max(6, w * 0.13), background: PAPER, boxShadow: `inset 0 0 0 ${Math.max(1, w / 40)}px rgba(22,26,43,0.14), 0 ${w / 22}px 0 rgba(22,26,43,0.18), 0 ${w / 12}px ${w / 6}px -${w / 14}px rgba(0,0,0,0.55)${up ? ', 0 0 0 2.5px #ffc233' : ''}` }
  // The corner: the value in the game's round letters, the suit in pixels under it.
  const corner = (flip: boolean) => (
    <span className={`absolute flex flex-col items-center leading-none ${flip ? 'right-[5%] bottom-[4%] rotate-180' : 'top-[4%] left-[5%]'}`} style={{ color, width: w * 0.2 }}>
      <span className="font-display font-extrabold tracking-tighter" style={{ fontSize: w * (rankOf(c) === 10 ? 0.2 : 0.25), lineHeight: 1 }}>
        {VALUES[rankOf(c) - 1]}
      </span>
      <PixelSuit suit={suitOf(c)} size={Math.round(w * 0.13)} />
    </span>
  )
  if (isJoker(c)) {
    const gold = c === 52
    return (
      <Tag className={base} style={style} onClick={onClick} aria-label={t('Joker')}>
        <span className="absolute inset-[9%] grid place-items-center rounded-[18%]" style={{ background: gold ? 'repeating-conic-gradient(#ffc233 0 15deg, #ff7a00 15deg 30deg)' : 'repeating-conic-gradient(#d9dce8 0 15deg, #8e94ad 15deg 30deg)' }}>
          <span className="grid place-items-center rounded-full font-display font-extrabold text-white" style={{ width: w * 0.5, height: w * 0.5, background: gold ? RED : INK, fontSize: w * 0.3, boxShadow: '0 0 0 3px #fff' }}>
            ★
          </span>
        </span>
        <span className="absolute top-[5%] left-[7%] font-display leading-none font-extrabold [writing-mode:vertical-rl]" style={{ color: gold ? RED : INK, fontSize: w * 0.15 }}>
          {t('JOKER')}
        </span>
      </Tag>
    )
  }
  const r = rankOf(c)
  const s = suitOf(c)
  return (
    <Tag className={base} style={style} onClick={onClick} aria-label={cardName(c)}>
      {corner(false)}
      {corner(true)}
      {r >= 11 ? (
        // A figure: in its frame, in the suit's colour, the suit over its head.
        <span className="absolute inset-x-[26%] inset-y-[9%] flex flex-col items-center justify-between overflow-hidden rounded-[10%] pt-[12%]" style={{ background: s === 1 || s === 2 ? '#ffe8ea' : '#e9ebf4', boxShadow: `inset 0 0 0 ${Math.max(1.5, w / 30)}px ${color}` }}>
          <PixelSuit suit={s} size={Math.round(w * 0.16)} />
          <PixelFigure face={VALUES[r - 1] as 'V' | 'D' | 'R'} color={color} width={w * 0.44} />
        </span>
      ) : r === 1 ? (
        // The ace: one big suit, on a wax round.
        <span className="absolute inset-0 grid place-items-center">
          <span className="grid place-items-center rounded-full" style={{ width: w * 0.62, height: w * 0.62, background: `repeating-radial-gradient(circle, ${s === 1 || s === 2 ? '#ffe1e5' : '#e3e6f1'} 0 ${w * 0.05}px, ${PAPER} ${w * 0.05}px ${w * 0.1}px)` }}>
            <PixelSuit suit={s} size={Math.round(w * 0.4)} />
          </span>
        </span>
      ) : (
        // The pips, clear of the corners.
        <span className="absolute" style={{ left: w * 0.37, right: w * 0.37, top: h * 0.14, bottom: h * 0.14 }}>
          {PIPS[r].map(([x, y], k) => (
            <span key={k} className="absolute" style={{ left: `${x * 100}%`, top: `${y * 100}%`, transform: 'translate(-50%, -50%)' }}>
              <PixelSuit suit={s} size={Math.round(w * 0.15)} flip={y > 0.5} />
            </span>
          ))}
        </span>
      )}
    </Tag>
  )
}

/** The wax print on the backs: rounds and dots, orange and green, drawn once. */
const WAX = `url("data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' shape-rendering='crispEdges'><rect width='20' height='20' fill='#ff7a00'/><circle cx='10' cy='10' r='6.5' fill='none' stroke='#ffe3b8' stroke-width='2'/><circle cx='10' cy='10' r='2.6' fill='#00b86b'/><circle cx='0' cy='0' r='2.4' fill='#e05a00'/><circle cx='20' cy='0' r='2.4' fill='#e05a00'/><circle cx='0' cy='20' r='2.4' fill='#e05a00'/><circle cx='20' cy='20' r='2.4' fill='#e05a00'/></svg>",
)}")`

/** A card face down: the wax print in a white frame, the game's B in the middle. */
export function CardBack({ w = 22, className = '' }: { w?: number; className?: string }) {
  const h = cardH(w)
  return (
    <span className={`relative block shrink-0 ${className}`} style={{ width: w, height: h, borderRadius: Math.max(3, w * 0.13), background: '#fffaf0', padding: Math.max(1.5, w * 0.06), boxShadow: `0 ${Math.max(1, w / 22)}px 0 rgba(22,26,43,0.22), 0 ${w / 12}px ${w / 6}px -${w / 14}px rgba(0,0,0,0.55)` }}>
      <span className="relative block h-full w-full overflow-hidden" style={{ borderRadius: Math.max(2, w * 0.09), backgroundImage: WAX, backgroundSize: `${Math.max(6, w * 0.34)}px` }}>
        {w >= 30 && (
          <span className="absolute top-1/2 left-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#fffaf0] font-display font-extrabold text-[#e05a00]" style={{ width: w * 0.42, height: w * 0.42, fontSize: w * 0.28, lineHeight: 1, boxShadow: '0 0 0 2px #00b86b' }}>
            {t('B')}
          </span>
        )}
      </span>
    </span>
  )
}
