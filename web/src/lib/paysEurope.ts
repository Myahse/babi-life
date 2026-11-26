import { t } from './i18n'
import { EUROPE_BORDERS, EUROPE_RAIL } from './europeData'

// L'Europe (backend world/europe.go, the update « pays-europe »; France is its own): its countries, their flags,
// and the roads between them: one country to another only through a chain of land borders (no road to Iceland;
// the United Kingdom through the Channel tunnel, by France). France's cities join the network as they come.
export type EuropeId = 'be' | 'gb' | 'de' | 'it' | 'es' | 'pt' | 'ch' | 'nl' | 'ie' | 'at' | 'pl' | 'cz' | 'hu' | 'gr' | 'se' | 'no' | 'dk' | 'fi' | 'ro' | 'bg' | 'hr' | 'rs' | 'ua' | 'ru' | 'tr' | 'is' | 'lu' | 'mc'
export const EUROPE_COUNTRIES: Record<EuropeId, { name: () => string; flag: string; land: 'europe' }> = {
  be: { name: () => t('Belgique'), flag: '🇧🇪', land: 'europe' },
  gb: { name: () => t('Royaume-Uni'), flag: '🇬🇧', land: 'europe' },
  de: { name: () => t('Allemagne'), flag: '🇩🇪', land: 'europe' },
  it: { name: () => t('Italie'), flag: '🇮🇹', land: 'europe' },
  es: { name: () => t('Espagne'), flag: '🇪🇸', land: 'europe' },
  pt: { name: () => t('Portugal'), flag: '🇵🇹', land: 'europe' },
  ch: { name: () => t('Suisse'), flag: '🇨🇭', land: 'europe' },
  nl: { name: () => t('Pays-Bas'), flag: '🇳🇱', land: 'europe' },
  ie: { name: () => t('Irlande'), flag: '🇮🇪', land: 'europe' },
  at: { name: () => t('Autriche'), flag: '🇦🇹', land: 'europe' },
  pl: { name: () => t('Pologne'), flag: '🇵🇱', land: 'europe' },
  cz: { name: () => t('Tchéquie'), flag: '🇨🇿', land: 'europe' },
  hu: { name: () => t('Hongrie'), flag: '🇭🇺', land: 'europe' },
  gr: { name: () => t('Grèce'), flag: '🇬🇷', land: 'europe' },
  se: { name: () => t('Suède'), flag: '🇸🇪', land: 'europe' },
  no: { name: () => t('Norvège'), flag: '🇳🇴', land: 'europe' },
  dk: { name: () => t('Danemark'), flag: '🇩🇰', land: 'europe' },
  fi: { name: () => t('Finlande'), flag: '🇫🇮', land: 'europe' },
  ro: { name: () => t('Roumanie'), flag: '🇷🇴', land: 'europe' },
  bg: { name: () => t('Bulgarie'), flag: '🇧🇬', land: 'europe' },
  hr: { name: () => t('Croatie'), flag: '🇭🇷', land: 'europe' },
  rs: { name: () => t('Serbie'), flag: '🇷🇸', land: 'europe' },
  ua: { name: () => t('Ukraine'), flag: '🇺🇦', land: 'europe' },
  ru: { name: () => t('Russie'), flag: '🇷🇺', land: 'europe' },
  tr: { name: () => t('Turquie'), flag: '🇹🇷', land: 'europe' },
  is: { name: () => t('Islande'), flag: '🇮🇸', land: 'europe' },
  lu: { name: () => t('Luxembourg'), flag: '🇱🇺', land: 'europe' },
  mc: { name: () => t('Monaco'), flag: '🇲🇨', land: 'europe' },
}

/** Whether a road joins two countries: the same, or a chain of land borders (mirrors backend world/europe.go roadLinked). */
export function roadLinked(a: string, b: string): boolean {
  if (a === b) return true
  const okA = a in EUROPE_BORDERS
  const okB = b in EUROPE_BORDERS
  if (!okA || !okB) return !okA && !okB
  const seen = new Set([a])
  const next = [a]
  while (next.length) {
    for (const n of EUROPE_BORDERS[next.shift()!] ?? []) {
      if (n === b) return true
      if (!seen.has(n)) (seen.add(n), next.push(n))
    }
  }
  return false
}

// Velora, Europe's high-speed train (an invented brand; backend world/europeRail.go): from a city's great station
// to another's wherever a road joins their countries, a train every 90 minutes from 6 h to 21 h.
const RAIL_EVERY = 90
const RAIL_FIRST = 6 * 60
const RAIL_LAST = 21 * 60
export const VELORA = '#5f3dc4'
const km = (a: number, b: number, c: number, d: number) => {
  const r = Math.PI / 180
  const x = Math.sin(((c - a) * r) / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(((d - b) * r) / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(x))
}
const roundTo = (v: number, step: number) => Math.max(step, Math.round(v / step) * step)

/** The next Velora between two cities (mirrors the backend's RailTripFrom): game minutes (the wait included), a seat's fare, its departure, where it arrives; null when there's none. */
export function veloraQuote(from: { id: string; country?: string; island?: boolean }, to: { id: string; country?: string; island?: boolean }, now: number) {
  const a = EUROPE_RAIL[from.id]
  const b = EUROPE_RAIL[to.id]
  if (!a || !b || from.id === to.id || from.island || to.island || !roadLinked(from.country ?? 'ci', to.country ?? 'ci')) return null
  const day = now - (now % (24 * 60))
  const at = now % (24 * 60)
  const next = at <= RAIL_FIRST ? RAIL_FIRST : RAIL_FIRST + Math.ceil((at - RAIL_FIRST) / RAIL_EVERY) * RAIL_EVERY
  if (next > RAIL_LAST) return null
  const rails = km(a[2], a[3], b[2], b[3]) * 1.15
  return { minutes: 15 + Math.floor(rails / 14) + (next - at), fare: Math.max(5000, roundTo(rails * 55, 500)), departs: day + next, commune: b[0], station: { commune: a[0], place: a[1] } }
}
