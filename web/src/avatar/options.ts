import type { Look } from '../lib/types'

// Everything a player can pick in the Sim creator. Ids are stored in the
// Sim's `look` (JSON) on the server, so never rename one: add a new one.

export type Choice = { id: string; label: string }

export const SKIN_TONES = ['#f1c9a0', '#dca87a', '#c28a5c', '#a46c42', '#8a5532', '#6e4024', '#583119', '#3f2210']
export const HAIR_COLORS = ['#141010', '#2e1b12', '#5a3418', '#8a5a2b', '#c49a4a', '#8f2a2a', '#d8d2c8']
export const EYE_COLORS = ['#2b1a10', '#4a2c18', '#6b4423', '#2f4f3a', '#2b4466']
export const OUTFIT_COLORS = ['#ff7a00', '#00a862', '#2a6cf0', '#d6336c', '#7b5cff', '#f2b705', '#14213d', '#f4efe6', '#b02e0c']

export const BODIES: Choice[] = [
  { id: 'mince', label: 'Mince' },
  { id: 'moyen', label: 'Moyen' },
  { id: 'fort', label: 'Costaud' },
  { id: 'rond', label: 'Rondelet' },
]

export const HAIRS: Choice[] = [
  { id: 'short', label: 'Court' },
  { id: 'bald', label: 'Rasé' },
  { id: 'afro', label: 'Afro' },
  { id: 'braids', label: 'Tresses' },
  { id: 'locks', label: 'Dreads' },
  { id: 'bun', label: 'Chignon' },
  { id: 'weave', label: 'Tissage' },
  { id: 'headwrap', label: 'Foulard' },
]

export const BEARDS: Choice[] = [
  { id: 'none', label: 'Aucune' },
  { id: 'moustache', label: 'Moustache' },
  { id: 'bouc', label: 'Bouc' },
  { id: 'full', label: 'Barbe' },
]

export const ACCESSORIES: Choice[] = [
  { id: 'none', label: 'Rien' },
  { id: 'glasses', label: 'Lunettes' },
  { id: 'earrings', label: "Boucles d'oreilles" },
  { id: 'chain', label: 'Chaîne en or' },
  { id: 'cap', label: 'Casquette' },
  { id: 'capback', label: "Casquette à l'envers" },
]

export const OUTFITS: Choice[] = [
  { id: 'pagne', label: 'Pagne wax' },
  { id: 'boubou', label: 'Grand boubou' },
  { id: 'casual', label: 'Jean & tee-shirt' },
  { id: 'robe', label: 'Robe de soirée' },
  { id: 'suit', label: 'Costume' },
  { id: 'jersey', label: 'Maillot des Éléphants' },
  { id: 'debardeur', label: 'Débardeur & short' },
  { id: 'survet', label: 'Survêtement' },
  { id: 'basket', label: 'Tenue de basket' },
]

export const MARKS: Choice[] = [
  { id: 'none', label: 'Aucun' },
  { id: 'pansement', label: 'Pansement' },
  { id: 'griffures', label: 'Griffures' },
  { id: 'genou', label: 'Genou bandé' },
  { id: 'bagarre', label: 'Tout ça' },
]

export const PATTERNS: Choice[] = [
  { id: 'cercles', label: 'Cercles' },
  { id: 'losanges', label: 'Losanges' },
  { id: 'feuilles', label: 'Feuilles' },
  { id: 'rayures', label: 'Rayures' },
]

/** Outfits that use the wax pattern. */
export const WAX_OUTFITS = new Set(['pagne', 'boubou', 'robe'])

export const DEFAULT_LOOK: Look = {
  skin: SKIN_TONES[5],
  hair: 'headwrap',
  hairColor: HAIR_COLORS[0],
  outfit: 'pagne',
  outfitColor: OUTFIT_COLORS[0],
  body: 'moyen',
  height: 1,
  eyes: EYE_COLORS[0],
  beard: 'none',
  accessory: 'earrings',
  pattern: 'cercles',
  bottomColor: '',
  shoeColor: '',
  accessoryColor: '',
  marks: 'none',
}

/** The model's height at scale 1, in metres. */
export const BASE_HEIGHT = { femme: 1.65, homme: 1.76 }
/** What the creator allows, in metres. */
export const HEIGHT_RANGE = { min: 1.4, max: 2.5 }
export const metres = (scale: number, gender: 'femme' | 'homme') => BASE_HEIGHT[gender] * scale
export const scaleFor = (m: number, gender: 'femme' | 'homme') => m / BASE_HEIGHT[gender]

/** Colours an outfit starts with when it's picked: the kit of the Éléphants is orange. */
export const OUTFIT_DEFAULT_COLOR: Record<string, string> = { jersey: '#ff8200', suit: '#1f2a44', debardeur: '#f8f9fa', basket: '#1d428a' }

/** Sims made before the creator grew: fill the new fields. */
export function fullLook(look: Look): Required<Look> {
  return { ...(DEFAULT_LOOK as Required<Look>), ...stripUndefined(look) }
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '')) as Partial<T>
}

export function randomLook(gender: 'femme' | 'homme', random: () => number = Math.random): Required<Look> {
  const pick = <T,>(a: readonly T[]) => a[Math.floor(random() * a.length)]
  const femme = gender === 'femme'
  const hairs = femme ? ['braids', 'afro', 'bun', 'weave', 'headwrap', 'locks', 'short'] : ['short', 'bald', 'afro', 'locks', 'short']
  const outfits = femme ? ['pagne', 'boubou', 'casual', 'robe', 'jersey', 'debardeur', 'survet'] : ['pagne', 'boubou', 'casual', 'suit', 'jersey', 'debardeur', 'survet', 'basket']
  const outfit = pick(outfits)
  return {
    skin: pick(SKIN_TONES.slice(2)),
    hair: pick(hairs),
    hairColor: random() < 0.75 ? HAIR_COLORS[0] : pick(HAIR_COLORS),
    outfit,
    outfitColor: OUTFIT_DEFAULT_COLOR[outfit] ?? pick(OUTFIT_COLORS),
    body: pick(BODIES).id,
    height: Math.round((0.94 + random() * 0.12) * 100) / 100,
    eyes: pick(EYE_COLORS.slice(0, 3)),
    beard: femme ? 'none' : pick(BEARDS).id,
    accessory: femme ? pick(['earrings', 'earrings', 'glasses', 'chain', 'none']) : pick(['none', 'chain', 'glasses', 'cap', 'capback']),
    pattern: pick(PATTERNS).id,
    bottomColor: '',
    shoeColor: '',
    accessoryColor: '',
    marks: random() < 0.12 ? pick(MARKS.slice(1)).id : 'none',
  }
}

export const BOTTOM_COLORS = ['#3d64a8', '#2b2f45', '#141416', '#f4efe6', '#8a5a2b', '#4f6b3a', '#b02e0c']
export const SHOE_COLORS = ['#f4f4f4', '#141416', '#6b4423', '#8a5a2b', '#e8d9b5', '#ff7a00', '#2a6cf0']
export const ACCESSORY_COLORS = ['#e8b93c', '#d8d8de', '#17171a', '#b02e0c', '#2a6cf0', '#00a862']

/** The colours an outfit's parts have when the player hasn't picked one. */
export function defaultColors(l: Required<Look>, femme: boolean) {
  const bottom: Record<string, string> = { pagne: femme ? l.outfitColor : '#2b2f45', jersey: '#f8f9fa', casual: '#3d64a8', debardeur: '#1f2a44', basket: l.outfitColor }
  const shoe: Record<string, string> = { debardeur: '#141416', basket: '#f8f9fa', survet: '#f4f4f4', pagne: femme ? '#8a5a2b' : '#6b4423', boubou: '#e8d9b5', robe: '#1c1c22', suit: '#141416', jersey: '#141416', casual: '#f4f4f4' }
  const outfit = l.outfit === 'robe' && !femme ? 'casual' : l.outfit
  return {
    bottom: bottom[outfit] ?? l.outfitColor,
    shoe: shoe[outfit] ?? '#f4f4f4',
    accessory: l.accessory === 'glasses' ? '#17171a' : l.accessory === 'cap' || l.accessory === 'capback' ? (l.outfitColor === '#f4efe6' ? '#14213d' : l.outfitColor) : '#e8b93c',
  }
}
