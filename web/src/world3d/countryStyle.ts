import { useSyncExternalStore } from 'react'

// The country's own look in the street (the updates « pays-burkina », « pays-usa », « pays-canada »; backend
// world/pays.go): what Abidjan has everywhere (the woro-woro and the gbakas, the pagnes, the palms on the
// beaches, the game's own houses under tin along the streets where the map has none) changes with the country
// the Sim is in. Told by the place's position (the chunk workers know only that), so it needs no world:
// across the Atlantic, the Americas; north of Côte d'Ivoire's border, the Sahel of Burkina Faso.

export type CountryLook = {
  id: 'ci' | 'bf' | 'us' | 'ca'
  /** The vehicles on the roads, drawn in these shares (vehicles.tsx kinds); the woro's colours there (New York's cabs). */
  traffic: ('taxi' | 'woro' | 'car' | 'moto')[]
  woro?: { color: string; trim: string }
  /** The passers-by's clothes: Abidjan's (pagnes, boubous), the Sahel's (more boubous and bazin), or the West's (jeans, jackets; coats and beanies in Montréal). */
  clothes: 'abidjan' | 'sahel' | 'west'
  coats?: boolean
  /** Coconut palms on the beaches (else plain trees). */
  palms: boolean
  /** The game's own houses where the map has none (Abidjan's cours communes, under tin): not in the Americas' cities, mapped to the last building. */
  fill: boolean
}

export const COUNTRY_LOOKS: Record<CountryLook['id'], CountryLook> = {
  ci: { id: 'ci', traffic: ['taxi', 'taxi', 'woro', 'woro', 'woro', 'car', 'car', 'car', 'moto'], clothes: 'abidjan', palms: true, fill: true },
  // Ouaga, « la ville des deux-roues »: mopeds and motos everywhere, the green taxis, fewer cars.
  bf: { id: 'bf', traffic: ['moto', 'moto', 'moto', 'moto', 'moto', 'woro', 'car', 'car'], woro: { color: '#2f9e44', trim: '#f8f9fa' }, clothes: 'sahel', palms: true, fill: true },
  // New York: the yellow cabs and the cars.
  us: { id: 'us', traffic: ['woro', 'woro', 'woro', 'car', 'car', 'car', 'car', 'car'], woro: { color: '#f7c600', trim: '#1a1a1a' }, clothes: 'west', palms: false, fill: false },
  // Montréal: cars, a few taxis, coats.
  ca: { id: 'ca', traffic: ['car', 'car', 'car', 'car', 'car', 'woro', 'moto'], woro: { color: '#f8f9fa', trim: '#1c3f94' }, clothes: 'west', coats: true, palms: false, fill: false },
}

// The American South (Miami, Houston, New Orleans, Los Angeles, Phoenix, Honolulu): palms along the streets.
const US_SOUTH: CountryLook = { ...COUNTRY_LOOKS.us, palms: true }

/** Whether a point of North America is in Canada: north of the 49th parallel west of the Great Lakes (Alaska aside), north of the
 *  45th east of them (Maine's north tip aside). Roughly the border, enough for the cities of the game. */
function inCanada(lat: number, lng: number) {
  if (lng < -141) return false
  if (lng < -95) return lat > 49
  return lat > 45 && !(lng > -71.1 && lat < 47.5)
}

/** The country's look at a position: the Americas (lng west of −30°), Canada past its border; Burkina north of Côte d'Ivoire (lat above 10.9°). */
export function lookAt(lat: number, lng: number): CountryLook {
  if (lng < -30) return inCanada(lat, lng) ? COUNTRY_LOOKS.ca : lat < 34.2 ? US_SOUTH : COUNTRY_LOOKS.us
  if (lat > 10.9) return COUNTRY_LOOKS.bf
  return COUNTRY_LOOKS.ci
}

let current: CountryLook = COUNTRY_LOOKS.ci
const subs = new Set<() => void>()
/** The look of where the Sim is now (OpenWorld sets it on arriving in a commune). */
export function setCountryLook(l: CountryLook) {
  if (l === current) return
  current = l
  subs.forEach((f) => f())
}
export const countryLookNow = () => current
export const useCountryLook = () =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => void subs.delete(f)),
    () => current,
  )

const WEST_TOPS = ['casual', 'chemise', 'sweat', 'blouson', 'polo', 'oversize', 'jogging']
const COATS = ['blouson', 'sweat', 'blouson', 'survet', 'sweat']
/** A passer-by's outfit for the country: Abidjan's kept; in the West, the pagnes and boubous turned into jeans and jackets (coats in Montréal), from a number in [0, 1). */
export function outfitFor(outfit: string, r: number, look = current): string {
  // The Sahel: the boubou and the bazin more than the street's tee-shirts.
  if (look.clothes === 'sahel') return ['debardeur', 'souscorps', 'jersey', 'survet'].includes(outfit) && r < 0.6 ? ['boubou', 'bazin', 'boubou', 'pagne'][Math.floor(r * 6.6) % 4] : outfit
  if (look.clothes !== 'west') return outfit
  if (!['pagne', 'boubou', 'kaba', 'bazin', 'chemise-pagne', 'abaya', 'souscorps', 'debardeur', 'ensemble-pagne'].includes(outfit)) return look.coats && r < 0.5 ? COATS[Math.floor(r * 8) % COATS.length] : outfit
  return look.coats ? COATS[Math.floor(r * COATS.length)] : WEST_TOPS[Math.floor(r * WEST_TOPS.length)]
}
