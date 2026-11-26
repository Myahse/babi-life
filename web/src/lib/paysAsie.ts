import { t } from './i18n'
import { ASIE_BORDERS, ASIE_RAIL } from './asieData'
import { EUROPE_BORDERS } from './europeData'
import { roadLinked } from './paysEurope'

// L'Asie (backend world/asie.go, the update « pays-asie »; the Middle East and Oceania are their own): its countries,
// their flags, and the roads between them: through land borders only (Europe's chain, paysEurope.ts roadLinked:
// Asia joins Russia; no road to the islands, nor across the Korean border; Singapore by the causeway).
export type AsieId = 'cn' | 'jp' | 'in' | 'kr' | 'th' | 'vn' | 'id' | 'sg' | 'my' | 'ph' | 'hk' | 'tw' | 'pk' | 'bd' | 'lk' | 'np' | 'kh' | 'la' | 'mm' | 'mn' | 'kz' | 'uz' | 'mv' | 'bn' | 'bt'
export const ASIE_COUNTRIES: Record<AsieId, { name: () => string; flag: string; land: 'asie' }> = {
  cn: { name: () => t('Chine'), flag: '🇨🇳', land: 'asie' },
  jp: { name: () => t('Japon'), flag: '🇯🇵', land: 'asie' },
  in: { name: () => t('Inde'), flag: '🇮🇳', land: 'asie' },
  kr: { name: () => t('Corée du Sud'), flag: '🇰🇷', land: 'asie' },
  th: { name: () => t('Thaïlande'), flag: '🇹🇭', land: 'asie' },
  vn: { name: () => t('Viêt Nam'), flag: '🇻🇳', land: 'asie' },
  id: { name: () => t('Indonésie'), flag: '🇮🇩', land: 'asie' },
  sg: { name: () => t('Singapour'), flag: '🇸🇬', land: 'asie' },
  my: { name: () => t('Malaisie'), flag: '🇲🇾', land: 'asie' },
  ph: { name: () => t('Philippines'), flag: '🇵🇭', land: 'asie' },
  hk: { name: () => t('Hong Kong'), flag: '🇭🇰', land: 'asie' },
  tw: { name: () => t('Taïwan'), flag: '🇹🇼', land: 'asie' },
  pk: { name: () => t('Pakistan'), flag: '🇵🇰', land: 'asie' },
  bd: { name: () => t('Bangladesh'), flag: '🇧🇩', land: 'asie' },
  lk: { name: () => t('Sri Lanka'), flag: '🇱🇰', land: 'asie' },
  np: { name: () => t('Népal'), flag: '🇳🇵', land: 'asie' },
  kh: { name: () => t('Cambodge'), flag: '🇰🇭', land: 'asie' },
  la: { name: () => t('Laos'), flag: '🇱🇦', land: 'asie' },
  mm: { name: () => t('Myanmar'), flag: '🇲🇲', land: 'asie' },
  mn: { name: () => t('Mongolie'), flag: '🇲🇳', land: 'asie' },
  kz: { name: () => t('Kazakhstan'), flag: '🇰🇿', land: 'asie' },
  uz: { name: () => t('Ouzbékistan'), flag: '🇺🇿', land: 'asie' },
  mv: { name: () => t('Maldives'), flag: '🇲🇻', land: 'asie' },
  bn: { name: () => t('Brunei'), flag: '🇧🇳', land: 'asie' },
  bt: { name: () => t('Bhoutan'), flag: '🇧🇹', land: 'asie' },
}

// Asia's borders joined to Europe's chain (never replacing what another region listed), so roadLinked sees them.
function joinBorders(m: Record<string, string[]>) {
  for (const [k, l] of Object.entries(m)) {
    const cur = EUROPE_BORDERS[k] ?? []
    EUROPE_BORDERS[k] = [...cur, ...l.filter((n) => !cur.includes(n))]
  }
}
joinBorders(ASIE_BORDERS)

/** Whether a position is in Asia's box (East, South, Southeast and Central Asia; the Middle East west of 63° E and New Guinea east of 141° E are others'). */
export const inAsia = (lat: number, lng: number) => lng >= 63 && lng < 150 && lat > -11 && lat < 56 && !(lng > 141 && lat < 0)

// Lumio, the high-speed train of China and Japan (an invented brand; backend world/asieRail.go): from a city's great
// station to another's wherever a road joins their countries, a train every hour from 6 h to 22 h.
const RAIL_EVERY = 60
const RAIL_FIRST = 6 * 60
const RAIL_LAST = 22 * 60
export const LUMIO = '#0b7285'
const km = (a: number, b: number, c: number, d: number) => {
  const r = Math.PI / 180
  const x = Math.sin(((c - a) * r) / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(((d - b) * r) / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(x))
}
const roundTo = (v: number, step: number) => Math.max(step, Math.round(v / step) * step)

/** The next Lumio between two cities (mirrors the backend's AsiaRailTripFrom): game minutes (the wait included), a seat's fare, its departure, where it arrives; null when there's none. */
export function lumioQuote(from: { id: string; country?: string; island?: boolean }, to: { id: string; country?: string; island?: boolean }, now: number) {
  const a = ASIE_RAIL[from.id]
  const b = ASIE_RAIL[to.id]
  if (!a || !b || from.id === to.id || from.island || to.island || !roadLinked(from.country ?? 'ci', to.country ?? 'ci')) return null
  const day = now - (now % (24 * 60))
  const at = now % (24 * 60)
  const next = at <= RAIL_FIRST ? RAIL_FIRST : RAIL_FIRST + Math.ceil((at - RAIL_FIRST) / RAIL_EVERY) * RAIL_EVERY
  if (next > RAIL_LAST) return null
  const rails = km(a[2], a[3], b[2], b[3]) * 1.15
  const minutes = 15 + Math.floor(rails / 14)
  return { minutes: Math.floor((minutes * 4) / 5) + (next - at), fare: Math.max(5000, roundTo(rails * 55, 500)), departs: day + next, commune: b[0], station: { commune: a[0], place: a[1] } }
}
