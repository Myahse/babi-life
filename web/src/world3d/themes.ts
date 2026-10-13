// How each commune looks: what fills the streets around the places you can
// visit. Add or tune a commune here; anything unknown falls back to its
// city's look, then to DEFAULT.

export type Filler = 'tower' | 'office' | 'villa' | 'cour' | 'shop' | 'colonial' | 'hut' | 'stall' | 'park' | 'church' | 'warehouse'

export type Theme = {
  ground: string // bare ground between lots
  grass: string
  side: 'asphalt' | 'laterite' // back streets
  /** Fillers to draw from, with weights. */
  fillers: Partial<Record<Filler, number>>
  trees: 'palm' | 'mango' | 'baobab' | 'mixed'
  pedestrians: number
  vehicles: number
  /** Woro-woro colour for this commune (taxis communaux). */
  woro: string
  water?: 'lagoon' | 'sea'
  /** The water comes right up behind the far row of buildings (default when there is water). */
  waterfront?: boolean
  backdrop?: 'mountains' | 'hills' | 'forest' | 'skyline'
  /** Tall buildings scale. */
  height: number
}

const DEFAULT: Theme = {
  ground: '#d9b27c',
  grass: '#86c66a',
  side: 'asphalt',
  fillers: { cour: 4, shop: 3, villa: 1, stall: 1, park: 1 },
  trees: 'mixed',
  pedestrians: 12,
  vehicles: 5,
  woro: '#ff7a00',
  height: 1,
}

const THEMES: Record<string, Partial<Theme>> = {
  plateau: { waterfront: false, fillers: { tower: 6, office: 3, park: 1, church: 0.5 }, trees: 'palm', pedestrians: 16, vehicles: 8, woro: '#ff7a00', water: 'lagoon', height: 1.6, ground: '#cdbb9b' },
  cocody: { fillers: { villa: 7, park: 2, office: 1 }, trees: 'mango', pedestrians: 7, vehicles: 5, woro: '#f2b705', water: 'lagoon', grass: '#6fbf5a' },
  yopougon: { fillers: { cour: 7, shop: 3, stall: 2 }, pedestrians: 22, vehicles: 7, woro: '#2a6cf0', side: 'laterite' },
  adjame: { fillers: { shop: 5, stall: 5, cour: 2, warehouse: 1 }, pedestrians: 26, vehicles: 10, woro: '#00a862', backdrop: 'skyline' },
  abobo: { fillers: { cour: 8, stall: 2, shop: 1 }, pedestrians: 22, vehicles: 6, woro: '#00a862', side: 'laterite', ground: '#d39a62' },
  treichville: { fillers: { colonial: 4, shop: 4, cour: 2, stall: 1 }, pedestrians: 18, vehicles: 7, woro: '#d6336c', water: 'lagoon', backdrop: 'skyline' },
  marcory: { fillers: { villa: 3, shop: 4, cour: 2, office: 1 }, pedestrians: 14, vehicles: 7, woro: '#d6336c' },
  koumassi: { fillers: { cour: 6, shop: 2, stall: 2 }, pedestrians: 18, vehicles: 6, woro: '#d6336c', water: 'lagoon', side: 'laterite' },
  'port-bouet': { fillers: { cour: 4, villa: 2, stall: 2, warehouse: 1 }, trees: 'palm', pedestrians: 12, vehicles: 5, woro: '#d6336c', water: 'sea', ground: '#e6cf9f' },
  attecoube: { fillers: { cour: 6, stall: 1, park: 1 }, trees: 'mango', pedestrians: 14, vehicles: 4, woro: '#00a862', water: 'lagoon', backdrop: 'forest', side: 'laterite' },
  // Other cities: one district each for now.
  'yakro-centre': { fillers: { villa: 3, office: 2, park: 3, shop: 1 }, trees: 'palm', pedestrians: 8, vehicles: 4, woro: '#2fb3e0', water: 'lagoon' },
  'bouake-centre': { fillers: { shop: 4, stall: 4, cour: 3 }, pedestrians: 18, vehicles: 6, woro: '#00a862', side: 'laterite', ground: '#d6a26a' },
  'bassam-france': { fillers: { colonial: 7, villa: 1, park: 1 }, trees: 'palm', pedestrians: 9, vehicles: 3, woro: '#ff7a00', water: 'sea', ground: '#e6cf9f' },
  'sp-centre': { fillers: { warehouse: 3, shop: 3, cour: 3 }, trees: 'palm', pedestrians: 12, vehicles: 6, woro: '#2a6cf0', water: 'sea' },
  'man-centre': { fillers: { cour: 5, shop: 2, stall: 2 }, trees: 'mango', pedestrians: 10, vehicles: 3, woro: '#00a862', side: 'laterite', backdrop: 'mountains', grass: '#5fb04c', ground: '#c98e5a' },
  'korhogo-centre': { fillers: { hut: 6, cour: 3, stall: 2 }, trees: 'baobab', pedestrians: 10, vehicles: 3, woro: '#f2b705', side: 'laterite', ground: '#d7a466', grass: '#b5b85a' },
  'daloa-centre': { fillers: { cour: 5, shop: 3, stall: 2 }, trees: 'mango', pedestrians: 12, vehicles: 4, woro: '#2a6cf0', side: 'laterite', backdrop: 'forest' },
}

export function themeFor(communeId: string): Theme {
  const t = { ...DEFAULT, ...THEMES[communeId] }
  return { ...t, waterfront: t.water ? t.waterfront !== false : false }
}

/** Where the water starts, on the far (−Z) side, for waterfront communes. */
export const SHORE_Z = -23

/** A tiny seeded RNG so a commune always looks the same. */
export function rng(seed: string) {
  let h = 2166136261
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

export function weighted<T extends string>(r: () => number, w: Partial<Record<T, number>>): T {
  const entries = Object.entries(w) as [T, number][]
  let x = r() * entries.reduce((s, [, v]) => s + v, 0)
  for (const [k, v] of entries) if ((x -= v) <= 0) return k
  return entries[0][0]
}
