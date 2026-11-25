import type { City, World } from './types'
import { t } from './i18n'

// Les pays (backend world/pays.go, the updates « pays-burkina », « pays-usa », « pays-canada »): the game's
// countries, their flags, their continent (a road joins only the countries of one), their cities.
export type CountryId = 'ci' | 'bf' | 'us' | 'ca'
export const COUNTRIES: Record<CountryId, { name: () => string; flag: string; land: 'afrique' | 'amerique' }> = {
  ci: { name: () => t('Côte d’Ivoire'), flag: '🇨🇮', land: 'afrique' },
  bf: { name: () => t('Burkina Faso'), flag: '🇧🇫', land: 'afrique' },
  us: { name: () => t('États-Unis'), flag: '🇺🇸', land: 'amerique' },
  ca: { name: () => t('Canada'), flag: '🇨🇦', land: 'amerique' },
}
export const countryOf = (c: Pick<City, 'country'> | undefined): CountryId => ((c?.country ?? 'ci') in COUNTRIES ? ((c?.country ?? 'ci') as CountryId) : 'ci')
/** Whether a road joins two cities (the same continent). */
export const sameLand = (a: Pick<City, 'country'>, b: Pick<City, 'country'>) => COUNTRIES[countryOf(a)].land === COUNTRIES[countryOf(b)].land
/** The countries the world sent (those open), Côte d'Ivoire first. */
export const countriesIn = (world: World): CountryId[] => (['ci', 'bf', 'us', 'ca'] as CountryId[]).filter((k) => world.cities.some((c) => countryOf(c) === k))
/** A country's box on the map (west, south, east, north), from its cities. */
export function countryBounds(world: World, k: CountryId): [number, number, number, number] | null {
  const pts = world.cities.filter((c) => countryOf(c) === k).flatMap((c) => c.communes.flatMap((cm) => [cm, ...cm.places]))
  if (!pts.length) return null
  const lats = pts.map((p) => p.lat)
  const lngs = pts.map((p) => p.lng)
  const pad = 0.3
  return [Math.min(...lngs) - pad, Math.min(...lats) - pad, Math.max(...lngs) + pad, Math.max(...lats) + pad]
}
