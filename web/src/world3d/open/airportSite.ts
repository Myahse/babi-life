import type { XZ } from './geo'

// Every city's airport, drawn by the game the same way wherever it is (airport.tsx GenericAirport), Abidjan's
// Port-Bouët aside (its own model, kept as it is): how big (a hub, an international airport, a regional one),
// the language of its signs, its name as they write it there, and where it stands against its runway: the
// map's own (OpenStreetMap's runways, merged from the chunks' clipped pieces), or, where the map has none, one
// the game lays out behind the terminal. Nothing here is per city: what a new region's airports need is their
// place (kind « aeroport ») and their city's country.

export type AirportTier = 'hub' | 'major' | 'regional'
export type SignLang = 'fr' | 'en' | 'es' | 'pt'

/** The world's big hubs (by their place's ID, the regions' files): the biggest terminal, the most gates. */
const HUBS = new Set([
  'nyc-jfk', 'los-angeles-aeroport', 'chicago-aeroport', 'atlanta-aeroport', 'denver-aeroport', 'houston-aeroport', 'miami-aeroport', 'newark-aeroport', 'seattle-aeroport',
  'toronto-aeroport', 'vancouver-aeroport', 'mtl-aeroport', 'saopaulo-aeroport', 'rio-aeroport', 'cdmx-aeroport', 'bogota-aeroport', 'lima-aeroport', 'santiago-aeroport', 'baires-aeroport', 'panama-aeroport',
  'paris-cdg', 'ldn-aeroport', 'francfort-aeroport', 'ams-aeroport', 'mad-aeroport', 'bcn-aeroport', 'munich-aeroport', 'rome-aeroport', 'istanbul-aeroport', 'moscou-aeroport',
  'lagos-aeroport', 'johannesburg-aeroport', 'le-caire-aeroport', 'addis-abeba-aeroport', 'nairobi-aeroport', 'casablanca-aeroport',
])

/** A hub, an international airport (its name says so) or a regional one (Korhogo, Bobo-Dioulasso). */
export function airportTier(p: { id: string; name: string }): AirportTier {
  if (HUBS.has(p.id)) return 'hub'
  return /internation|intercontinental|world airport/i.test(p.name) ? 'major' : 'regional'
}

/**
 * The sizes (metres): the ground it clears round its middle, the terminal's length and depth, its gates, the
 * tower's height, the runway laid out where the map has none (its length, how far behind the terminal).
 */
export const TIER: Record<AirportTier, { clear: number; length: number; depth: number; gates: number; tower: number; runway: number; behind: number }> = {
  hub: { clear: 190, length: 340, depth: 44, gates: 7, tower: 62, runway: 3800, behind: 330 },
  major: { clear: 130, length: 200, depth: 34, gates: 4, tower: 42, runway: 3000, behind: 260 },
  regional: { clear: 75, length: 90, depth: 24, gates: 2, tower: 22, runway: 2100, behind: 190 },
}

const EN = new Set(['us', 'gb', 'ie', 'gh', 'ng', 'lr', 'sl', 'gm', 'ke', 'tz', 'ug', 'za', 'zm', 'zw', 'na', 'bw', 'mw', 'jm', 'tt', 'gy', 'bs', 'bb', 'et', 'sd', 'ss', 'so', 'mt', 'au', 'nz', 'in', 'pk', 'ph', 'sg'])
const ES = new Set(['es', 'mx', 'gt', 'sv', 'hn', 'ni', 'cr', 'pa', 'cu', 'do', 'pr', 'co', 've', 'ec', 'pe', 'bo', 'py', 'uy', 'ar', 'cl', 'gq'])
const PT = new Set(['pt', 'br', 'ao', 'mz', 'cv', 'gw', 'st'])
const FR = new Set(['ci', 'bf', 'fr', 'be', 'ch', 'lu', 'mc', 'sn', 'ml', 'gn', 'tg', 'bj', 'ne', 'cm', 'ga', 'cg', 'cd', 'td', 'cf', 'mg', 'dj', 'ht', 'gp', 'mq', 'gf', 'ma', 'dz', 'tn', 'mr', 'bi', 'rw', 'km', 'sc', 'mu'])
/** Canada's French side (its cities by ID): the rest of Canada writes English. */
const QUEBEC = new Set(['montreal', 'quebec', 'gatineau', 'sherbrooke', 'trois-rivieres'])

/** The language of the airport's signs: its country's, where it's one of the four (else English, as the world's airports write theirs). */
export function signLang(city: { id: string; country?: string }): SignLang {
  const c = city.country ?? 'ci'
  if (c === 'ca') return QUEBEC.has(city.id) ? 'fr' : 'en'
  if (FR.has(c)) return 'fr'
  if (ES.has(c)) return 'es'
  if (PT.has(c)) return 'pt'
  return EN.has(c) ? 'en' : 'en'
}

/**
 * The airport's name as it's written there: the game's names are French (« Aéroport international Pearson de
 * Toronto »); in English « Toronto Pearson International Airport », in Spanish « Aeropuerto Internacional Jorge
 * Chávez », in Portuguese « Aeroporto Internacional de São Paulo Guarulhos ». A name already local is kept.
 */
export function localName(name: string, lang: SignLang): string {
  const m = /^Aéroport( international)?\s+(.*)$/i.exec(name.trim())
  if (lang === 'fr' || !m) return name
  const intl = !!m[1]
  let rest = m[2]
  // The cities the game names in French, as they're written there.
  for (const [fr, en, es] of EXONYMS) rest = rest.replace(new RegExp(`(^|[\\s'’-])${fr}(?=$|[\\s-])`, 'u'), `$1${lang === 'es' ? es : lang === 'en' ? en : fr}`)
  if (lang === 'en') {
    rest = rest.replace(/-([A-Z]\.)-/g, ' $1 ').replace(/(\p{L}\.?)-(\p{Lu})/gu, '$1 $2')
    // « Pearson de Toronto » → « Toronto Pearson »; « de Vancouver » → « Vancouver ».
    const of = /^(?:(.*?)\s+)?(?:de |d'|d’|du )(.+)$/.exec(rest)
    if (of) rest = of[1] ? `${of[2]} ${of[1]}` : of[2]
    return `${rest} ${intl ? 'International Airport' : 'Airport'}`
  }
  rest = rest.replace(/(\p{L})-(\p{Lu})/gu, '$1 $2').replace(/^d['’]/, 'de ').replace(/^du /, lang === 'es' ? 'del ' : 'do ')
  if (lang === 'es') return `Aeropuerto${intl ? ' Internacional' : ''} ${rest}`
  return `Aeroporto${intl ? ' Internacional' : ''} ${rest}`
}

/** French names of cities in the airports' names: in English, and in Spanish. */
const EXONYMS: [string, string, string][] = [
  ['Londres', 'London', 'Londres'],
  ['Francfort', 'Frankfurt', 'Fráncfort'],
  ['Vienne', 'Vienna', 'Viena'],
  ['Copenhague', 'Copenhagen', 'Copenhague'],
  ['Varsovie', 'Warsaw', 'Varsovia'],
  ['Bucarest', 'Bucharest', 'Bucarest'],
  ['Moscou', 'Moscow', 'Moscú'],
  ['Athènes', 'Athens', 'Atenas'],
  ['Barcelone', 'Barcelona', 'Barcelona'],
  ['Brandebourg', 'Brandenburg', 'Brandeburgo'],
  ['Caire', 'Cairo', 'El Cairo'],
  ['Cap', 'Cape Town', 'Ciudad del Cabo'],
  ['Mexico', 'Mexico City', 'Ciudad de México'],
]

/** The signs' words in each language (French ones go through the game's translation, as Abidjan's do). */
export const SIGNS: Record<Exclude<SignLang, 'fr'>, { checkin: string; arrivals: string; departures: string; security: string; exit: string; gate: string; cafe: string; resto: string; shop: string; press: string; time: string; to: string; flight: string; status: string; boarding: string; delayed: string; onTime: string; none: string }> = {
  en: { checkin: 'CHECK-IN · AIR LAGUNE', arrivals: 'ARRIVALS', departures: 'DEPARTURES', security: 'SECURITY · GATES 1 – 6', exit: 'EXIT · TAXIS', gate: 'GATE', cafe: 'TARMAC CAFÉ', resto: 'FOOD COURT', shop: 'GIFTS & CRAFTS', press: 'NEWS · SOUVENIRS', time: 'TIME', to: 'DESTINATION', flight: 'FLIGHT', status: 'STATUS', boarding: 'BOARDING', delayed: 'DELAYED', onTime: 'ON TIME', none: 'NO FLIGHTS TODAY' },
  es: { checkin: 'FACTURACIÓN · AIR LAGUNE', arrivals: 'LLEGADAS', departures: 'SALIDAS', security: 'CONTROL DE SEGURIDAD · PUERTAS 1 – 6', exit: 'SALIDA · TAXIS', gate: 'PUERTA', cafe: 'CAFÉ DE LA PISTA', resto: 'RESTAURANTE', shop: 'ARTESANÍA', press: 'PRENSA · RECUERDOS', time: 'HORA', to: 'DESTINO', flight: 'VUELO', status: 'ESTADO', boarding: 'EMBARCANDO', delayed: 'RETRASADO', onTime: 'A TIEMPO', none: 'SIN VUELOS HOY' },
  pt: { checkin: 'CHECK-IN · AIR LAGUNE', arrivals: 'CHEGADAS', departures: 'PARTIDAS', security: 'CONTROLE DE SEGURANÇA · PORTÕES 1 – 6', exit: 'SAÍDA · TÁXIS', gate: 'PORTÃO', cafe: 'CAFÉ DA PISTA', resto: 'RESTAURANTE', shop: 'ARTESANATO', press: 'REVISTAS · LEMBRANÇAS', time: 'HORA', to: 'DESTINO', flight: 'VOO', status: 'SITUAÇÃO', boarding: 'EMBARQUE', delayed: 'ATRASADO', onTime: 'NO HORÁRIO', none: 'SEM VOOS HOJE' },
}

/** A runway, one straight line, end to end. */
export type Runway = [XZ, XZ]

/**
 * The map's runways, whole: each chunk has its piece of a runway (cut at the tile's edges), and the far tiles
 * their own coarser copy. Pieces on one line (the same heading within 3°, less than 40 m apart across) are one
 * runway, from the furthest end to the furthest end.
 */
export function mergeRunways(pieces: XZ[][]): Runway[] {
  type Line = { ux: number; uz: number; o: XZ; lo: number; hi: number }
  const lines: Line[] = []
  for (const pts of pieces) {
    if (pts.length < 2) continue
    const [a, b] = [pts[0], pts[pts.length - 1]]
    const l = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (l < 20) continue
    let [ux, uz] = [(b[0] - a[0]) / l, (b[1] - a[1]) / l]
    if (ux < 0 || (ux === 0 && uz < 0)) [ux, uz] = [-ux, -uz]
    const line = lines.find((m) => Math.abs(m.ux * uz - m.uz * ux) < 0.05 && Math.abs((a[0] - m.o[0]) * -m.uz + (a[1] - m.o[1]) * m.ux) < 40)
    const along = (m: { ux: number; uz: number; o: XZ }, p: XZ) => (p[0] - m.o[0]) * m.ux + (p[1] - m.o[1]) * m.uz
    if (!line) {
      const m = { ux, uz, o: a }
      lines.push({ ...m, lo: Math.min(along(m, a), along(m, b)), hi: Math.max(along(m, a), along(m, b)) })
      continue
    }
    line.lo = Math.min(line.lo, along(line, a), along(line, b))
    line.hi = Math.max(line.hi, along(line, a), along(line, b))
  }
  return lines.filter((m) => m.hi - m.lo > 500).map((m): Runway => [[m.o[0] + m.ux * m.lo, m.o[1] + m.uz * m.lo], [m.o[0] + m.ux * m.hi, m.o[1] + m.uz * m.hi]])
}

/** How far from a point a runway is (to its nearest point), and that point's place along it (0..1). */
function toRunway([a, b]: Runway, p: XZ) {
  const [dx, dz] = [b[0] - a[0], b[1] - a[1]]
  const l2 = dx * dx + dz * dz || 1
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2))
  return { d: Math.hypot(a[0] + dx * t - p[0], a[1] + dz * t - p[1]), t }
}

export type AirportSite = {
  /** Which way the terminal's front (its kerb, local +z) looks: away from its runway. */
  rot: number
  /** Its runway (the map's, or the one laid out), end to end in the street's metres. */
  runway: Runway
  /** Laid out by the game (the map has none here): the terminal's model draws it. */
  made: boolean
  /** How far the terminal stands moved back from its lot's middle, toward the street (m, along its +z): off the taxiways when the map's point is on the airfield. */
  shift: number
}

/**
 * Where an airport's terminal stands: on its lot (its middle, as the street lays it out), along its runway, its
 * kerb away from it and its gates toward it. The map's runway nearest the lot, within a few kilometres; where
 * the map has none, one laid out parallel behind the terminal (`rot`: the lot's own front, to its street).
 */
export function airportSite(at: XZ, rot: number, tier: AirportTier, runways: Runway[]): AirportSite {
  const size = TIER[tier]
  let best: { r: Runway; d: number; t: number } | null = null
  for (const r of runways) {
    const n = toRunway(r, at)
    if (n.d < (tier === 'hub' ? 4500 : 3500) && (!best || n.d < best.d)) best = { r, ...n }
  }
  if (best) {
    const [a, b] = best.r
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    const [ux, uz] = [(b[0] - a[0]) / l, (b[1] - a[1]) / l]
    // The side of the runway the lot is on (its street's side); on the runway's line itself, the side its street is.
    const side = (at[0] - a[0]) * -uz + (at[1] - a[1]) * ux
    const s = Math.abs(side) > 30 ? Math.sign(side) : Math.sign(Math.sin(rot) * -uz + Math.cos(rot) * ux) || 1
    const [nx, nz] = [-uz * s, ux * s]
    // Off its runway and its taxiway: the apron and the planes at the gates (some 100 m) behind the terminal.
    const need = size.depth / 2 + 150
    const across = Math.abs(side)
    return { rot: Math.atan2(nx, nz), runway: best.r, made: false, shift: across < need ? Math.min(need - across, size.clear) : 0 }
  }
  // None on the map: one laid out behind the terminal, parallel to it, its middle behind the terminal's.
  const [fx, fz] = [Math.sin(rot), Math.cos(rot)]
  const [ex, ez] = [Math.cos(rot), -Math.sin(rot)]
  const c: XZ = [at[0] - fx * size.behind, at[1] - fz * size.behind]
  const h = size.runway / 2
  return { rot, runway: [[c[0] - ex * h, c[1] - ez * h], [c[0] + ex * h, c[1] + ez * h]], made: true, shift: 0 }
}
