import type { Look } from '../lib/types'

// Everything a player can pick in the Sim creator. Ids are stored in the
// Sim's `look` (JSON) on the server, so never rename one: add a new one.

export type Choice = { id: string; label: string }

export const SKIN_TONES = ['#f6d5b4', '#f1c9a0', '#dca87a', '#c28a5c', '#b07a4a', '#a46c42', '#8a5532', '#7a4a2a', '#6e4024', '#583119', '#4a2814', '#3f2210', '#2e180b']
export const HAIR_COLORS = ['#141010', '#2e1b12', '#5a3418', '#8a5a2b', '#c49a4a', '#e8c872', '#8f2a2a', '#c2410c', '#6d28d9', '#1d4ed8', '#d8d2c8']
export const EYE_COLORS = ['#2b1a10', '#4a2c18', '#6b4423', '#8a6a3a', '#2f4f3a', '#2b4466', '#5b6470']
export const OUTFIT_COLORS = ['#ff7a00', '#00a862', '#2a6cf0', '#d6336c', '#7b5cff', '#f2b705', '#14213d', '#f4efe6', '#b02e0c', '#0f9d8a', '#7a1f3d', '#556b2f', '#c9a227', '#f783ac', '#74c0fc', '#8a5a2b', '#17171a', '#ffffff']

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
  { id: 'cornrows', label: 'Nattes collées' },
  { id: 'twists', label: 'Vanilles' },
  { id: 'ponytail', label: 'Queue de cheval' },
  { id: 'puffs', label: 'Macarons' },
  { id: 'bob', label: 'Carré' },
  { id: 'degrade', label: 'Dégradé avec trait' },
  { id: 'mohawk', label: 'Iroquoise' },
]

export const BEARDS: Choice[] = [
  { id: 'none', label: 'Aucune' },
  { id: 'moustache', label: 'Moustache' },
  { id: 'bouc', label: 'Bouc' },
  { id: 'full', label: 'Barbe' },
  { id: 'collier', label: 'Collier' },
  { id: 'longue', label: 'Barbe longue' },
]

export const ACCESSORIES: Choice[] = [
  { id: 'none', label: 'Rien' },
  { id: 'glasses', label: 'Lunettes' },
  { id: 'earrings', label: "Boucles d'oreilles" },
  { id: 'chain', label: 'Chaîne en or' },
  { id: 'cap', label: 'Casquette' },
  { id: 'capback', label: "Casquette à l'envers" },
  { id: 'sunglasses', label: 'Lunettes de soleil' },
  { id: 'beanie', label: 'Bonnet' },
  { id: 'hat', label: 'Chapeau' },
  { id: 'buckethat', label: 'Bob' },
  { id: 'bandana', label: 'Bandana' },
  { id: 'headphones', label: 'Casque audio' },
  { id: 'watch', label: 'Montre' },
  { id: 'bag', label: 'Sac en bandoulière' },
  { id: 'beads', label: 'Collier de perles' },
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
  { id: 'chemise-pagne', label: 'Chemise en pagne' },
  { id: 'kaba', label: 'Kaba' },
  { id: 'bazin', label: 'Bazin brodé' },
  { id: 'chemise', label: 'Chemise & pantalon' },
  { id: 'uniforme', label: 'Uniforme scolaire' },
  { id: 'jupe', label: 'Top & jupe' },
  { id: 'blouson', label: 'Blouson & jean' },
  { id: 'salopette', label: 'Salopette' },
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
  { id: 'points', label: 'Pois' },
  { id: 'zigzag', label: 'Zigzag' },
  { id: 'damier', label: 'Damier' },
  { id: 'kente', label: 'Kente' },
]

/** Outfits that use the wax pattern. */
export const WAX_OUTFITS = new Set(['pagne', 'boubou', 'robe', 'chemise-pagne', 'kaba'])
/** Outfits only women wear (a man who picks one gets the nearest men's outfit). */
export const FEMME_OUTFITS = new Set(['robe', 'kaba', 'jupe'])
/** Hairdos a cap or a hat goes over: they're drawn short under it. */
export const TALL_HAIR = new Set(['afro', 'bun', 'headwrap', 'puffs', 'mohawk', 'ponytail'])
/** Accessories worn on the head (a hat, a cap…). */
export const HEADWEAR = new Set(['cap', 'capback', 'beanie', 'hat', 'buckethat', 'bandana', 'headphones'])

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
export const OUTFIT_DEFAULT_COLOR: Record<string, string> = { jersey: '#ff8200', suit: '#1f2a44', debardeur: '#f8f9fa', basket: '#1d428a', uniforme: '#c8b07a', chemise: '#74c0fc', bazin: '#0f9d8a', blouson: '#3d64a8', salopette: '#3d64a8' }

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
  const hairs = femme ? ['braids', 'afro', 'bun', 'weave', 'headwrap', 'locks', 'short', 'cornrows', 'twists', 'ponytail', 'puffs', 'bob'] : ['short', 'bald', 'afro', 'locks', 'short', 'degrade', 'cornrows', 'twists', 'mohawk']
  const outfits = femme ? ['pagne', 'boubou', 'casual', 'robe', 'jersey', 'debardeur', 'survet', 'kaba', 'jupe', 'chemise-pagne', 'blouson', 'salopette', 'bazin'] : ['pagne', 'boubou', 'casual', 'suit', 'jersey', 'debardeur', 'survet', 'basket', 'chemise-pagne', 'bazin', 'chemise', 'blouson', 'salopette']
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
    accessory: femme ? pick(['earrings', 'earrings', 'glasses', 'chain', 'none', 'sunglasses', 'beads', 'bag', 'watch', 'bandana']) : pick(['none', 'chain', 'glasses', 'cap', 'capback', 'sunglasses', 'watch', 'beanie', 'hat', 'buckethat', 'headphones', 'bag']),
    pattern: pick(PATTERNS).id,
    bottomColor: '',
    shoeColor: '',
    accessoryColor: '',
    marks: random() < 0.12 ? pick(MARKS.slice(1)).id : 'none',
  }
}

export const BOTTOM_COLORS = ['#3d64a8', '#2b2f45', '#141416', '#f4efe6', '#8a5a2b', '#4f6b3a', '#b02e0c', '#c8b07a', '#7a1f3d', '#74c0fc', '#f2b705']
export const SHOE_COLORS = ['#f4f4f4', '#141416', '#6b4423', '#8a5a2b', '#e8d9b5', '#ff7a00', '#2a6cf0', '#d6336c', '#00a862', '#c9a227']
export const ACCESSORY_COLORS = ['#e8b93c', '#d8d8de', '#17171a', '#b02e0c', '#2a6cf0', '#00a862', '#ff7a00', '#f783ac', '#f4efe6', '#7b5cff']

/** The colours an outfit's parts have when the player hasn't picked one. */
export function defaultColors(l: Required<Look>, femme: boolean) {
  const bottom: Record<string, string> = { pagne: femme ? l.outfitColor : '#2b2f45', jersey: '#f8f9fa', casual: '#3d64a8', debardeur: '#1f2a44', basket: l.outfitColor, 'chemise-pagne': '#2b2f45', chemise: '#2b2f45', uniforme: femme ? '#1d4ed8' : '#a08850', jupe: '#2b2f45', blouson: '#3d64a8', salopette: l.outfitColor, kaba: l.outfitColor, bazin: l.outfitColor }
  const shoe: Record<string, string> = { 'chemise-pagne': '#6b4423', kaba: '#8a5a2b', bazin: '#e8d9b5', chemise: '#141416', uniforme: '#141416', jupe: '#f4f4f4', blouson: '#f4f4f4', salopette: '#f4f4f4', debardeur: '#141416', basket: '#f8f9fa', survet: '#f4f4f4', pagne: femme ? '#8a5a2b' : '#6b4423', boubou: '#e8d9b5', robe: '#1c1c22', suit: '#141416', jersey: '#141416', casual: '#f4f4f4' }
  const outfit = !femme && FEMME_OUTFITS.has(l.outfit) ? (l.outfit === 'kaba' ? 'boubou' : 'casual') : l.outfit
  return {
    bottom: bottom[outfit] ?? l.outfitColor,
    shoe: shoe[outfit] ?? '#f4f4f4',
    accessory: l.accessory === 'glasses' || l.accessory === 'sunglasses' || l.accessory === 'headphones' ? '#17171a' : l.accessory === 'hat' ? '#c9a227' : l.accessory === 'beads' ? '#d6336c' : l.accessory === 'bag' ? '#6b4423' : l.accessory === 'watch' ? '#d8d8de' : HEADWEAR.has(l.accessory) ? (l.outfitColor === '#f4efe6' ? '#14213d' : l.outfitColor) : '#e8b93c',
  }
}
