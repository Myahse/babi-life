import { useSyncExternalStore } from 'react'
import { ameriquesLookAt } from './lookAmeriques'
import { afriqueLookAt } from './countryStyleAfrique'
import { europeLookAt } from './europeStyle'
import { moyenOrientLookAt } from './moyenOrientStyle'
import { oceanieLookAt } from './oceanieStyle'
import { asieLookAt } from './asieStyle'

// The country's own look in the street (the updates « pays-burkina », « pays-usa », « pays-canada », « pays-france »; backend
// world/pays.go): what Abidjan has everywhere (the woro-woro and the gbakas, the pagnes, the palms on the
// beaches, the game's own houses under tin along the streets where the map has none) changes with the country
// the Sim is in. Told by the place's position (the chunk workers know only that), so it needs no world:
// across the Atlantic, the Americas; north of Côte d'Ivoire's border, the Sahel of Burkina Faso.

export type CountryLook = {
  /** 'ci', 'bf', 'us', 'ca', or a country of the Americas (lookAmeriques.ts). */
  id: string
  /** The vehicles on the roads, drawn in these shares (vehicles.tsx kinds); the woro's colours there (New York's cabs). */
  traffic: ('taxi' | 'woro' | 'car' | 'moto')[]
  woro?: { color: string; trim: string }
  /** The passers-by's clothes: Abidjan's (pagnes, boubous), the Sahel's (more boubous and bazin), or the West's (jeans, jackets; coats and beanies in Montréal). */
  clothes: 'abidjan' | 'sahel' | 'west' | /** Africa's (countryStyleAfrique.ts): the Maghreb's and Egypt's, the big cities' of the east and the south. */ 'nord' | 'ville' | /** The Gulf's (moyenOrientStyle.ts): the white thobe, the black abaya. */ 'golfe'
  coats?: boolean
  /** Coconut palms on the beaches (else plain trees). */
  palms: boolean
  /** The game's own houses where the map has none (Abidjan's cours communes, under tin): not in the Americas' cities, mapped to the last building. */
  fill: boolean
  /** The passers-by's first names there (talk.ts), the walls' colours (buildings.ts), mopeds in the street's sounds (ambience.ts). */
  names?: { femme: string[]; homme: string[] }
  facades?: string[]
  mopeds?: boolean
  /** A mild winter (the Mediterranean of Nice and Marseille): no snow lying (snow.ts). */
  mild?: boolean
}

export const COUNTRY_LOOKS: Record<'ci' | 'bf' | 'us' | 'ca' | 'fr', CountryLook> = {
  ci: { id: 'ci', traffic: ['taxi', 'taxi', 'woro', 'woro', 'woro', 'car', 'car', 'car', 'moto'], clothes: 'abidjan', palms: true, fill: true },
  // Ouaga, « la ville des deux-roues »: mopeds and motos everywhere, the green taxis, fewer cars.
  bf: { id: 'bf', traffic: ['moto', 'moto', 'moto', 'moto', 'moto', 'woro', 'car', 'car'], woro: { color: '#2f9e44', trim: '#f8f9fa' }, clothes: 'sahel', palms: true, fill: true },
  // New York: the yellow cabs and the cars.
  us: { id: 'us', traffic: ['woro', 'woro', 'woro', 'car', 'car', 'car', 'car', 'car'], woro: { color: '#f7c600', trim: '#1a1a1a' }, clothes: 'west', palms: false, fill: false },
  // Montréal: cars, a few taxis, coats.
  ca: { id: 'ca', traffic: ['car', 'car', 'car', 'car', 'car', 'woro', 'moto'], woro: { color: '#f8f9fa', trim: '#1c3f94' }, clothes: 'west', coats: true, palms: false, fill: false },
  // France (the update « pays-france »): the small cars, the scooters weaving between them, the dark taxis with their light; coats.
  fr: { id: 'fr', traffic: ['car', 'car', 'car', 'car', 'moto', 'moto', 'moto', 'woro'], woro: { color: '#2b2f36', trim: '#f1f3f5' }, clothes: 'west', coats: true, palms: false, fill: false },
}

// The American South (Miami, Houston, New Orleans, Los Angeles, Phoenix, Honolulu): palms along the streets.
const US_SOUTH: CountryLook = { ...COUNTRY_LOOKS.us, palms: true }

// The French Riviera and Provence (Nice, Marseille): palms on the promenades, a mild winter, lighter clothes.
const FR_SOUTH: CountryLook = { ...COUNTRY_LOOKS.fr, palms: true, coats: false, mild: true }

/** Whether a point of western Europe is in France: its box with the neighbours' corners cut off (Belgium, Germany, Switzerland,
 *  Italy, Spain, England), and Corsica. Roughly the borders, enough for the cities of the game. */
export function inFrance(lat: number, lng: number) {
  if (lat > 41.3 && lat < 43.1 && lng > 8.5 && lng < 9.6) return true
  if (lat < 42.3 || lat > 51.2 || lng < -5.3 || lng > 8.3) return false
  if (lat > 50.1 && lng > 3.2) return false
  if (lat > 49.05 && lng > 6.6) return false
  if (lat > 46.15 && lat < 47.55 && lng > 6.3) return false
  if (lat < 45.9 && lng > 7.5) return false
  if (lat < 42.45 && lng < 3.2) return false
  if (lat < 43.35 && lng < -1.75) return false
  if (lat > 50 && lng < 1.6) return false
  return true
}

/** Whether a point of North America is in Canada: north of the 49th parallel west of the Great Lakes (Alaska aside), north of the
 *  45th east of them (Maine's north tip aside). Roughly the border, enough for the cities of the game. */
function inCanada(lat: number, lng: number) {
  if (lng < -141) return false
  if (lng < -95) return lat > 49
  // (Nova Scotia, east of Maine; Toronto, on the north shore of Lake Ontario.)
  if (lng > -67) return lat > 43.4
  if (lng > -80.5 && lng < -76.3 && lat > 43.4) return true
  return lat > 45 && !(lng > -71.1 && lat < 47.5)
}

// English Canada (Toronto, Vancouver, Calgary, Edmonton, Winnipeg, Halifax): its own first names in the street.
const CA_EN: CountryLook = {
  ...COUNTRY_LOOKS.ca,
  names: {
    femme: ['Emma', 'Olivia', 'Sarah', 'Jessica', 'Emily', 'Hannah', 'Priya', 'Megan', 'Chloé', 'Ashley', 'Mei', 'Amanda'],
    homme: ['Liam', 'Noah', 'Ethan', 'Ryan', 'Tyler', 'Matthew', 'Arjun', 'Connor', 'Daniel', 'Jordan', 'Kevin', 'Brandon'],
  },
}

/** The country's look at a position: Latin America and the Caribbean (lookAmeriques.ts); the rest of the Americas (lng west of −30°),
 *  Canada past its border (its English side west of Ottawa and in Nova Scotia); Burkina north of Côte d'Ivoire (lat above 10.9°). */
export function lookAt(lat: number, lng: number): CountryLook {
  // Oceania, Asia east of 63° E and the Middle East (oceanieStyle.ts, asieStyle.ts, moyenOrientStyle.ts) before Europe's box: Tehran and Beirut are as far north as Seville.
  const far = oceanieLookAt(lat, lng) ?? asieLookAt(lat, lng) ?? moyenOrientLookAt(lat, lng)
  if (far) return far
  // France first (the rest of Europe after it).
  if (inFrance(lat, lng)) return lat < 44.2 && lng > 3.5 ? FR_SOUTH : COUNTRY_LOOKS.fr
  // L'Europe (europeStyle.ts): north of the Mediterranean (Tunis and Algiers, south of it, Africa's).
  if (lat > 34 && lng > -30 && !(lat < 37.6 && lng < 12)) return europeLookAt(lat, lng)
  const latam = ameriquesLookAt(lat, lng)
  if (latam) return latam
  // The rest of Africa (countryStyleAfrique.ts): its nearest city's country.
  const af = afriqueLookAt(lat, lng)
  if (af) return af
  if (lng < -30) return inCanada(lat, lng) ? (lng < -76.3 || lng > -67 ? CA_EN : COUNTRY_LOOKS.ca) : lat < 34.2 ? US_SOUTH : COUNTRY_LOOKS.us
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
/** A passer-by's outfit for the country: Abidjan's kept; in the West, the pagnes and boubous turned into jeans and jackets (coats in Montréal and in France), from a number in [0, 1). */
export function outfitFor(outfit: string, r: number, look = current, femme?: boolean): string {
  // The Gulf: the white thobe for the men, the abaya for the women, more than the street's jeans.
  if (look.clothes === 'golfe') return ['pagne', 'boubou', 'kaba', 'bazin', 'chemise-pagne', 'ensemble-pagne', 'robe', 'jupe', 'souscorps', 'debardeur'].includes(outfit) && r < 0.8 ? (femme ? 'abaya' : 'imam') : outfit
  // The Sahel: the boubou and the bazin more than the street's tee-shirts.
  if (look.clothes === 'sahel') return ['debardeur', 'souscorps', 'jersey', 'survet'].includes(outfit) && r < 0.6 ? ['boubou', 'bazin', 'boubou', 'pagne'][Math.floor(r * 6.6) % 4] : outfit
  // The Maghreb and Egypt: the abaya and the djellaba (as the abaya), jeans and shirts; the big cities of the east and the south: more jeans than pagnes.
  if (look.clothes === 'nord') return outfit === 'kaba' || outfit === 'robe' ? 'abaya' : ['pagne', 'boubou', 'bazin', 'chemise-pagne', 'ensemble-pagne', 'souscorps', 'debardeur'].includes(outfit) ? ['chemise', 'casual', 'polo', 'jogging', 'blouson'][Math.floor(r * 5)] : outfit
  if (look.clothes === 'ville') return ['pagne', 'kaba', 'bazin', 'boubou', 'ensemble-pagne'].includes(outfit) && r < 0.7 ? WEST_TOPS[Math.floor(r * 10) % WEST_TOPS.length] : outfit
  if (look.clothes !== 'west') return outfit
  if (!['pagne', 'boubou', 'kaba', 'bazin', 'chemise-pagne', 'abaya', 'souscorps', 'debardeur', 'ensemble-pagne'].includes(outfit)) return look.coats && r < 0.5 ? COATS[Math.floor(r * 8) % COATS.length] : outfit
  return look.coats ? COATS[Math.floor(r * COATS.length)] : WEST_TOPS[Math.floor(r * WEST_TOPS.length)]
}
