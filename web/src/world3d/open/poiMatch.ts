import type { XZ } from './geo'

// The game's real places, found on the map. Mapbox's tiles carry the points
// of interest of OpenStreetMap (a hospital, a market, a town hall…) with their
// name and their exact position; a game place is moved onto the one that has
// its name, and is the right kind of place, nearby. Invented places stay where
// the game puts them.

export type Poi = { name: string; cls: string; maki: string; type: string; at: XZ }

/** Words that say nothing about which place it is. */
const STOP = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'et', 'a', 'au', 'aux', 'en', 'the', 'of', 'sur'])
/** Words that say what kind of place it is, not which one: they count for less. */
const GENERIC = new Set(['marche', 'chu', 'hopital', 'mairie', 'gare', 'maquis', 'eglise', 'mosquee', 'stade', 'universite', 'hotel', 'college', 'lycee', 'ecole', 'centre', 'grand', 'grande', 'place', 'rue', 'boulevard', 'commune', 'quartier', 'pharmacie', 'clinique', 'restaurant', 'bar', 'cathedrale', 'basilique', 'terrain', 'parc', 'palais', 'sante', 'general', 'routiere', 'municipal', 'municipale'])

export function words(name: string): string[] {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w && !STOP.has(w))
}

/** The map icons (maki) that fit each kind of game place. */
const FITS: Record<string, string[]> = {
  health: ['hospital', 'doctor', 'pharmacy', 'dentist'],
  market: ['shop', 'grocery', 'marketplace', 'convenience'],
  mall: ['shop', 'grocery', 'clothing-store', 'convenience'],
  mairie: ['town-hall', 'embassy', 'building'],
  office: ['building', 'town-hall', 'bank', 'commercial'],
  worship: ['religious-christian', 'religious-muslim', 'place-of-worship', 'religious-jewish'],
  sport: ['stadium', 'pitch', 'soccer', 'basketball', 'fitness-centre', 'swimming'],
  universite: ['college', 'school', 'library'],
  school: ['school', 'college'],
  hotel: ['lodging'],
  transport: ['bus', 'airport', 'rail', 'car', 'ferry', 'airfield'],
  club: ['bar', 'nightclub', 'music', 'theatre'],
  maquis: ['restaurant', 'bar', 'fast-food', 'cafe'],
  restaurant: ['restaurant', 'fast-food', 'cafe'],
  culture: ['museum', 'theatre', 'monument', 'art-gallery', 'cinema', 'music', 'attraction'],
  police: ['police'],
  beach: ['beach', 'swimming', 'park'],
  lagune: ['harbor', 'ferry', 'park', 'viewpoint'],
}

/** How well a map name matches a game name: the share of the game name's (weighted) words found. */
function nameScore(game: string[], map: Set<string>) {
  let have = 0
  let all = 0
  for (const w of game) {
    const k = GENERIC.has(w) ? 0.5 : 1
    all += k
    if (map.has(w)) have += k
  }
  return all ? have / all : 0
}

/**
 * The map's point for a game place, or null. A near-certain name is enough
 * within 3 km; a looser one must be the right kind of place and within 1.2 km.
 */
export function matchPoi(place: { name: string; kind: string; at: XZ }, pois: Poi[]): Poi | null {
  const game = words(place.name)
  if (!game.length) return null
  const fits = FITS[place.kind] ?? []
  let best: { poi: Poi; score: number; d: number } | null = null
  for (const poi of pois) {
    const d = Math.hypot(poi.at[0] - place.at[0], poi.at[1] - place.at[1])
    if (d > 3000) continue
    const score = nameScore(game, new Set(words(poi.name)))
    const fit = fits.includes(poi.maki)
    const ok = (score >= 0.85 && (fit || score === 1)) || (score >= 0.6 && fit) || (score >= 0.4 && fit && d < 1200)
    if (!ok) continue
    // The best name first; between equals, the nearest.
    if (!best || score > best.score + 0.01 || (Math.abs(score - best.score) <= 0.01 && d < best.d)) best = { poi, score, d }
  }
  return best?.poi ?? null
}
