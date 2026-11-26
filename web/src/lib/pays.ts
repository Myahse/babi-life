import type { City, World } from './types'
import { t } from './i18n'
import { COUNTRIES_AMERIQUES, type AmeriquesId } from './paysAmeriques'
import { AFRIQUE_COUNTRIES, roadAcross, type AfriqueId } from './paysAfrique'
import { EUROPE_COUNTRIES, roadLinked, type EuropeId } from './paysEurope'

// Les pays (backend world/pays.go, the updates « pays-burkina », « pays-usa », « pays-canada »): the game's
// countries, their flags, their continent (a road joins only the countries of one), their cities.
export type CountryId = 'ci' | 'bf' | 'us' | 'ca' | AmeriquesId | AfriqueId | EuropeId
export const COUNTRIES: Record<CountryId, { name: () => string; flag: string; land: string }> = {
  ci: { name: () => t('Côte d’Ivoire'), flag: '🇨🇮', land: 'afrique' },
  bf: { name: () => t('Burkina Faso'), flag: '🇧🇫', land: 'afrique' },
  us: { name: () => t('États-Unis'), flag: '🇺🇸', land: 'amerique' },
  ca: { name: () => t('Canada'), flag: '🇨🇦', land: 'amerique' },
  ...COUNTRIES_AMERIQUES,
  ...AFRIQUE_COUNTRIES,
  ...EUROPE_COUNTRIES,
}
export const countryOf = (c: Pick<City, 'country'> | undefined): CountryId => ((c?.country ?? 'ci') in COUNTRIES ? ((c?.country ?? 'ci') as CountryId) : 'ci')
/** Whether a road joins two cities (the same continent; never to an island, Honolulu). */
export const sameLand = (a: Pick<City, 'country' | 'id' | 'island'>, b: Pick<City, 'country' | 'id' | 'island'>) => (a.id === b.id || (!a.island && !b.island)) && COUNTRIES[countryOf(a)].land === COUNTRIES[countryOf(b)].land && roadAcross(a, b) && roadLinked(countryOf(a), countryOf(b))
/** The countries the world sent (those open), Côte d'Ivoire first. */
export const countriesIn = (world: World): CountryId[] => (Object.keys(COUNTRIES) as CountryId[]).filter((k) => world.cities.some((c) => countryOf(c) === k))
/** A country's box on the map (west, south, east, north), from its cities. */
export function countryBounds(world: World, k: CountryId): [number, number, number, number] | null {
  // (The United States framed on the lower 48: Alaska and Hawaii are far off, reached by the flag's map moved there.)
  const pts = world.cities.filter((c) => countryOf(c) === k && !(k === 'us' && (c.island || c.lng < -140))).flatMap((c) => c.communes.flatMap((cm) => [cm, ...cm.places]))
  if (!pts.length) return null
  const lats = pts.map((p) => p.lat)
  const lngs = pts.map((p) => p.lng)
  const pad = 0.3
  return [Math.min(...lngs) - pad, Math.min(...lats) - pad, Math.max(...lngs) + pad, Math.max(...lats) + pad]
}
