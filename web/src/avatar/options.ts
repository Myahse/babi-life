import type { Look } from '../lib/types'
import { t } from '../lib/i18n'

// Everything a player can pick in the Sim creator. Ids are stored in the
// Sim's `look` (JSON) on the server, so never rename one: add a new one.

export type Choice = { id: string; label: string }

export const SKIN_TONES = ['#f6d5b4', '#f1c9a0', '#dca87a', '#c28a5c', '#b07a4a', '#a46c42', '#8a5532', '#7a4a2a', '#6e4024', '#583119', '#4a2814', '#3f2210', '#2e180b']
export const HAIR_COLORS = ['#141010', '#2e1b12', '#5a3418', '#8a5a2b', '#c49a4a', '#e8c872', '#8f2a2a', '#c2410c', '#6d28d9', '#1d4ed8', '#d8d2c8']
export const EYE_COLORS = ['#2b1a10', '#4a2c18', '#6b4423', '#8a6a3a', '#2f4f3a', '#2b4466', '#5b6470']
export const OUTFIT_COLORS = ['#ff7a00', '#00a862', '#2a6cf0', '#d6336c', '#7b5cff', '#f2b705', '#14213d', '#f4efe6', '#b02e0c', '#0f9d8a', '#7a1f3d', '#556b2f', '#c9a227', '#f783ac', '#74c0fc', '#8a5a2b', '#17171a', '#ffffff']

export const BODIES: Choice[] = [
  { id: 'mince', label: t('Mince') },
  { id: 'moyen', label: t('Moyen') },
  { id: 'fort', label: t('Costaud') },
  { id: 'rond', label: t('Rondelet') },
]

export const HAIRS: Choice[] = [
  { id: 'short', label: t('Court') },
  { id: 'bald', label: t('Rasé') },
  { id: 'afro', label: t('Afro') },
  { id: 'braids', label: t('Tresses') },
  { id: 'locks', label: t('Dreads') },
  { id: 'bun', label: t('Chignon') },
  { id: 'weave', label: t('Tissage') },
  { id: 'headwrap', label: t('Foulard') },
  { id: 'cornrows', label: t('Nattes collées') },
  { id: 'twists', label: t('Vanilles') },
  { id: 'ponytail', label: t('Queue de cheval') },
  { id: 'puffs', label: t('Macarons') },
  { id: 'bob', label: t('Carré') },
  { id: 'degrade', label: t('Dégradé avec trait') },
  { id: 'mohawk', label: t('Iroquoise') },
]

export const BEARDS: Choice[] = [
  { id: 'none', label: t('Aucune') },
  { id: 'moustache', label: t('Moustache') },
  { id: 'bouc', label: t('Bouc') },
  { id: 'full', label: t('Barbe') },
  { id: 'collier', label: t('Collier') },
  { id: 'longue', label: t('Barbe longue') },
]

export const ACCESSORIES: Choice[] = [
  { id: 'none', label: t('Rien') },
  { id: 'glasses', label: t('Lunettes') },
  { id: 'earrings', label: t("Boucles d'oreilles") },
  { id: 'chain', label: t('Chaîne en or') },
  { id: 'cap', label: t('Casquette') },
  { id: 'capback', label: t("Casquette à l'envers") },
  { id: 'sunglasses', label: t('Lunettes de soleil') },
  { id: 'beanie', label: t('Bonnet') },
  { id: 'hat', label: t('Chapeau') },
  { id: 'buckethat', label: t('Bob') },
  { id: 'bandana', label: t('Bandana') },
  { id: 'headphones', label: t('Casque audio') },
  { id: 'watch', label: t('Montre') },
  { id: 'bag', label: t('Sac en bandoulière') },
  { id: 'beads', label: t('Collier de perles') },
  { id: 'kufi', label: t('Bonnet de prière') },
  { id: 'croix', label: t('Croix') },
  { id: 'chapelet', label: t('Chapelet') },
  { id: 'couronne', label: t('Couronne') },
]
/** Worn only with the Pack Prestige (the Boutique): the server refuses them otherwise. */
export const PRESTIGE_ACCESSORIES = new Set(['couronne'])

export const OUTFITS: Choice[] = [
  { id: 'pagne', label: t('Pagne wax') },
  { id: 'boubou', label: t('Grand boubou') },
  { id: 'casual', label: t('Jean & tee-shirt') },
  { id: 'robe', label: t('Robe de soirée') },
  { id: 'suit', label: t('Costume') },
  { id: 'jersey', label: t('Maillot des Éléphants') },
  { id: 'debardeur', label: t('Débardeur & short') },
  { id: 'survet', label: t('Survêtement') },
  { id: 'basket', label: t('Tenue de basket') },
  { id: 'chemise-pagne', label: t('Chemise en pagne') },
  { id: 'kaba', label: t('Kaba') },
  { id: 'bazin', label: t('Bazin brodé') },
  { id: 'chemise', label: t('Chemise & pantalon') },
  { id: 'uniforme', label: t('Uniforme scolaire') },
  { id: 'jupe', label: t('Top & jupe') },
  { id: 'blouson', label: t('Blouson & jean') },
  { id: 'salopette', label: t('Salopette') },
  { id: 'souscorps', label: t('Sous-corps & culotte') },
  { id: 'jogging', label: t('Jogging & tee-shirt') },
  { id: 'sweat', label: t('Sweat à capuche & jogging') },
  { id: 'soutane', label: t('Soutane de prêtre') },
  { id: 'pasteur', label: t('Tenue de pasteur') },
  { id: 'imam', label: t("Tenue d'imam") },
  { id: 'abaya', label: t('Abaya & voile') },
  { id: 'blouse', label: t('Blouse blanche') },
  { id: 'bleu', label: t('Bleu de travail') },
  { id: 'policier', label: t('Uniforme de policier') },
  { id: 'gendarme', label: t('Uniforme de gendarme') },
  { id: 'cuisinier', label: t('Tenue de cuisinier') },
  { id: 'infirmier', label: t("Tenue d'infirmier") },
  { id: 'vigile', label: t('Tenue de vigile') },
  { id: 'soeur', label: t('Habit de religieuse') },
  { id: 'maillot', label: t('Maillot de bain') },
]

export const MARKS: Choice[] = [
  { id: 'none', label: t('Aucun') },
  { id: 'pansement', label: t('Pansement') },
  { id: 'griffures', label: t('Griffures') },
  { id: 'genou', label: t('Genou bandé') },
  { id: 'bagarre', label: t('Tout ça') },
]

export const PATTERNS: Choice[] = [
  { id: 'cercles', label: t('Cercles') },
  { id: 'losanges', label: t('Losanges') },
  { id: 'feuilles', label: t('Feuilles') },
  { id: 'rayures', label: t('Rayures') },
  { id: 'points', label: t('Pois') },
  { id: 'zigzag', label: t('Zigzag') },
  { id: 'damier', label: t('Damier') },
  { id: 'kente', label: t('Kente') },
]
/** The boutiques' own prints (backend game/clothes.go): worn by those who bought a piece with one. */
export const PIECE_PATTERNS: Choice[] = [
  { id: 'bogolan', label: t('Bogolan') },
  { id: 'madras', label: t('Madras') },
  { id: 'fleurs', label: t('Fleurs') },
  { id: 'leopard', label: t('Léopard') },
  { id: 'camo', label: t('Camouflage') },
  { id: 'adinkra', label: t('Adinkra') },
  { id: 'azur', label: t('Azur') },
  { id: 'polo', label: t('Rayures du polo') },
]

/*
 * Looks for each age (« looks-age » in the admin's « Mises à jour »): the
 * baby's grenouillère and tétine, the child's cartable and couettes, the
 * teen's oversized tee and earbuds. lookAt() keeps what a Sim wears to what
 * fits its age: a baby's things come off when it grows up.
 */
export const BABY_OUTFITS: Choice[] = [
  { id: 'grenouillere', label: t('Grenouillère') },
  { id: 'body', label: t('Body & couche') },
  { id: 'robe-bebe', label: t('Petite robe') },
  { id: 'pagne-bebe', label: t('Ensemble en pagne') },
  { id: 'salopette-bebe', label: t('Petite salopette') },
]
export const KID_OUTFITS: Choice[] = [
  { id: 'tee-short', label: t('Tee-shirt & short') },
  { id: 'robe-volants', label: t('Robe à volants') },
  { id: 'ensemble-pagne', label: t('Ensemble en pagne') },
  { id: 'pyjama', label: t('Pyjama') },
]
export const TEEN_OUTFITS: Choice[] = [
  { id: 'oversize', label: t('Tee large & cargo') },
  { id: 'crop', label: t('Crop top & jean') },
  { id: 'maillot-club', label: t('Maillot de club') },
]
export const BABY_HAIRS: Choice[] = [
  { id: 'short', label: t('Petits cheveux') },
  { id: 'bald', label: t('Crâne lisse') },
  { id: 'touffe', label: t('Petite touffe') },
  { id: 'puffs', label: t('Petits macarons') },
]
export const KID_HAIRS: Choice[] = [
  { id: 'couettes', label: t('Couettes') },
  { id: 'nattes-perles', label: t('Nattes à perles') },
]
export const BABY_ACCESSORIES: Choice[] = [
  { id: 'none', label: t('Rien') },
  { id: 'tetine', label: t('Tétine') },
  { id: 'bavoir', label: t('Bavoir') },
  { id: 'bonnet-bebe', label: t('Bonnet de bébé') },
  { id: 'hochet', label: t('Hochet') },
]
export const KID_ACCESSORIES: Choice[] = [
  { id: 'cartable', label: t('Cartable') },
  { id: 'barrettes', label: t('Barrettes') },
  { id: 'sucette', label: t('Sucette') },
]
export const TEEN_ACCESSORIES: Choice[] = [
  { id: 'ecouteurs', label: t('Écouteurs') },
  { id: 'sac-a-dos', label: t('Sac à dos') },
]
/** Every id the age looks bring: closed with « looks-age » (backend sims ageLookIDs). */
export const AGE_LOOK_IDS = new Set([...BABY_OUTFITS, ...KID_OUTFITS, ...TEEN_OUTFITS, ...KID_HAIRS, ...BABY_ACCESSORIES, ...KID_ACCESSORIES, ...TEEN_ACCESSORIES].map((c) => c.id).concat('touffe').filter((id) => id !== 'none'))

const ids = (list: Choice[]) => new Set(list.map((c) => c.id))
const BABY_OUTFIT_IDS = ids(BABY_OUTFITS)
/** Jobs and the clergy: not for a child or a teen. */
const GROWN_OUTFITS = new Set(['soutane', 'pasteur', 'imam', 'blouse', 'bleu', 'policier', 'gendarme', 'cuisinier', 'infirmier', 'vigile', 'soeur'])
/** What a child may wear of the grown-ups' clothes. */
const KID_OK = new Set(['pagne', 'boubou', 'casual', 'jersey', 'debardeur', 'survet', 'basket', 'chemise-pagne', 'uniforme', 'salopette', 'jogging', 'sweat', 'kaba', 'maillot', 'chemise', 'blouson', 'jupe', 'abaya'])
const KID_ACC_OK = new Set(['cap', 'capback', 'buckethat', 'beanie', 'bandana', 'glasses', 'sunglasses', 'earrings', 'beads', 'watch', 'croix', 'chapelet', 'kufi', 'headphones'])
/** Only for the little ones. */
const KID_ONLY = new Set(['robe-volants', 'ensemble-pagne', 'cartable', 'sucette', 'couettes'])

/** The outfits a Sim of that age can pick. */
export function outfitsFor(stage: string, femme: boolean): Choice[] {
  const mine = (list: Choice[]) => list.filter((o) => femme || !FEMME_OUTFITS.has(o.id))
  if (stage === 'bebe') return mine(BABY_OUTFITS)
  if (stage === 'enfant') return mine([...KID_OUTFITS, ...OUTFITS.filter((o) => KID_OK.has(o.id))])
  if (stage === 'ado') return mine([...TEEN_OUTFITS, ...KID_OUTFITS.filter((o) => !KID_ONLY.has(o.id)), ...OUTFITS.filter((o) => !GROWN_OUTFITS.has(o.id))])
  return mine([...OUTFITS, ...TEEN_OUTFITS, ...KID_OUTFITS.filter((o) => !KID_ONLY.has(o.id))])
}
export function hairsFor(stage: string): Choice[] {
  if (stage === 'bebe') return BABY_HAIRS
  if (stage === 'enfant') return [...KID_HAIRS, ...HAIRS]
  return [...HAIRS, ...KID_HAIRS.filter((h) => !KID_ONLY.has(h.id))]
}
export function accessoriesFor(stage: string): Choice[] {
  if (stage === 'bebe') return BABY_ACCESSORIES
  if (stage === 'enfant') return [ACCESSORIES[0], ...KID_ACCESSORIES, ...ACCESSORIES.filter((a) => KID_ACC_OK.has(a.id))]
  if (stage === 'ado') return [ACCESSORIES[0], ...TEEN_ACCESSORIES, ...KID_ACCESSORIES.filter((a) => a.id !== 'sucette'), ...ACCESSORIES.slice(1)]
  return [...ACCESSORIES, ...TEEN_ACCESSORIES, ...KID_ACCESSORIES.filter((a) => !KID_ONLY.has(a.id))]
}
export function beardsFor(stage: string): Choice[] {
  if (stage === 'bebe' || stage === 'enfant') return []
  if (stage === 'ado') return BEARDS.filter((b) => b.id === 'none' || b.id === 'moustache')
  return BEARDS
}

/** The look as worn at that age: what doesn't fit comes off (a baby's grenouillère on a child, a beard on a child, a cartable on a grown-up). Only the creator's own pieces are looked at: the towel, a work uniform stay. */
export function lookAt<L extends Look>(look: L, stage = 'adulte'): L {
  const baby = stage === 'bebe'
  const outfits = new Set(outfitsFor(stage, true).map((o) => o.id))
  const known = (list: Choice[], id: string) => list.some((c) => c.id === id)
  const out: L = { ...look }
  // A baby in another outfit keeps its plain onesie (BlockBaby); grown, the baby clothes become a child's or a grown-up's.
  if (!baby && look.outfit && !outfits.has(look.outfit) && (BABY_OUTFIT_IDS.has(look.outfit) || known(KID_OUTFITS, look.outfit) || (stage === 'enfant' && known(OUTFITS, look.outfit))))
    out.outfit = stage === 'enfant' ? 'tee-short' : 'casual'
  if (!baby && (look.hair === 'touffe' || look.hair === 'couettes') && !hairsFor(stage).some((h) => h.id === look.hair)) out.hair = look.hair === 'couettes' ? 'puffs' : 'short'
  if (look.beard && !beardsFor(stage).some((b) => b.id === look.beard)) out.beard = 'none'
  const accs = new Set(accessoriesFor(stage).map((a) => a.id))
  const worn = accessoriesOf(look).filter((a) => accs.has(a) || !ACCESSORY_SLOT[a])
  out.accessory = worn.length ? worn.join(',') : 'none'
  return out
}

/** Outfits that use the wax pattern. */
export const WAX_OUTFITS = new Set(['pagne', 'boubou', 'robe', 'chemise-pagne', 'kaba', 'ensemble-pagne', 'pagne-bebe'])
/** Outfits only women wear (a man who picks one gets the nearest men's outfit). */
export const FEMME_OUTFITS = new Set(['robe', 'kaba', 'jupe', 'abaya', 'soeur', 'robe-bebe', 'robe-volants', 'crop'])
/** Hairdos a cap or a hat goes over: they're drawn short under it. */
export const TALL_HAIR = new Set(['afro', 'bun', 'headwrap', 'puffs', 'mohawk', 'ponytail'])
/** Accessories worn on the head (a hat, a cap…). */
export const HEADWEAR = new Set(['cap', 'capback', 'beanie', 'hat', 'buckethat', 'bandana', 'headphones', 'kufi'])

/*
 * Several accessories at once: glasses, a bag, a watch, a chain… Look.accessory
 * holds them as a list, « glasses,bag,watch » (one alone, or « none », as
 * before). One per place on the body: one thing on the head, one pair of
 * glasses, earrings, one thing round the neck, a watch, a bag. Five at most.
 */
export const MAX_ACCESSORIES = 5
export const ACCESSORY_SLOT: Record<string, string> = {
  cap: 'head', capback: 'head', beanie: 'head', hat: 'head', buckethat: 'head', bandana: 'head', headphones: 'head', kufi: 'head', couronne: 'head',
  glasses: 'eyes', sunglasses: 'eyes',
  earrings: 'ears',
  chain: 'neck', beads: 'neck', croix: 'neck', chapelet: 'hand',
  watch: 'wrist',
  bag: 'bag',
  tetine: 'mouth', bavoir: 'neck', 'bonnet-bebe': 'head', hochet: 'hand',
  cartable: 'bag', barrettes: 'clips', sucette: 'hand',
  ecouteurs: 'ears', 'sac-a-dos': 'bag',
}

/** The accessories worn, in the order they were put on. */
export function accessoriesOf(l: { accessory?: string }): string[] {
  return (l.accessory ?? '').split(',').filter((a) => a && a !== 'none')
}

/** Is this one worn? */
export const hasAcc = (l: { accessory?: string }, id: string) => accessoriesOf(l).includes(id)

/** What's on the head (or « none »). */
export const headwearOf = (l: { accessory?: string }) => accessoriesOf(l).find((a) => HEADWEAR.has(a)) ?? 'none'

/** Put one on or take it off: « none » takes everything off; one per place on the body, five at most (the oldest goes). */
export function toggleAccessory(current: string, id: string): string {
  if (id === 'none') return 'none'
  let list = accessoriesOf({ accessory: current })
  if (list.includes(id)) list = list.filter((a) => a !== id)
  else {
    list = list.filter((a) => ACCESSORY_SLOT[a] !== ACCESSORY_SLOT[id] || !ACCESSORY_SLOT[id])
    list.push(id)
    if (list.length > MAX_ACCESSORIES) list = list.slice(list.length - MAX_ACCESSORIES)
  }
  return list.length ? list.join(',') : 'none'
}

/** Each accessory's own colour, when the player hasn't chosen one. */
export function accessoryColor(l: { accessory?: string; accessoryColor?: string; outfitColor?: string }, id: string): string {
  if (l.accessoryColor) return l.accessoryColor
  if (id === 'glasses' || id === 'sunglasses' || id === 'headphones') return '#17171a'
  if (id === 'hat') return '#c9a227'
  if (id === 'beads') return '#d6336c'
  if (id === 'kufi') return '#f8f9fa'
  if (id === 'chapelet' || id === 'bag') return '#6b4423'
  if (id === 'watch') return '#d8d8de'
  const kids: Record<string, string> = { tetine: '#74c0fc', bavoir: '#f8f9fa', 'bonnet-bebe': '#ffc8dd', hochet: '#ffd43b', cartable: '#2a6cf0', barrettes: '#f783ac', sucette: '#ff6b6b', ecouteurs: '#f8f9fa', 'sac-a-dos': '#17171a' }
  if (kids[id]) return kids[id]
  if (HEADWEAR.has(id)) return l.outfitColor === '#f4efe6' ? '#14213d' : (l.outfitColor ?? '#14213d')
  return '#e8b93c'
}
/** Outfits that cover the hair (the veil): no hairdo shows. */
export const VEILED = new Set(['abaya', 'soeur'])
/** Uniforms that come with their own headwear (unless something else is on the head). */
export const UNIFORM_HATS: Record<string, string> = { policier: 'kepi', gendarme: 'beret', cuisinier: 'toque', vigile: 'cap' }

export const DEFAULT_LOOK: Look = {
  skin: SKIN_TONES[5],
  hair: 'headwrap',
  hairColor: HAIR_COLORS[0],
  outfit: 'pagne',
  outfitColor: OUTFIT_COLORS[0],
  body: t('moyen'),
  height: 1,
  eyes: EYE_COLORS[0],
  beard: 'none',
  accessory: 'earrings',
  pattern: 'cercles',
  bottomColor: '',
  shoeColor: '',
  accessoryColor: '',
  marks: 'none',
  wear: 'neuf',
}

/** The model's height at scale 1, in metres. */
export const BASE_HEIGHT = { femme: 1.65, homme: 1.76 }
/** What the creator allows, in metres. */
export const HEIGHT_RANGE = { min: 1.4, max: 2.5 }
export const metres = (scale: number, gender: 'femme' | 'homme') => BASE_HEIGHT[gender] * scale
export const scaleFor = (m: number, gender: 'femme' | 'homme') => m / BASE_HEIGHT[gender]

/** Colours an outfit starts with when it's picked: the kit of the Éléphants is orange. */
export const OUTFIT_DEFAULT_COLOR: Record<string, string> = { jersey: '#ff8200', suit: '#1f2a44', debardeur: '#f8f9fa', basket: '#1d428a', uniforme: '#c8b07a', chemise: '#74c0fc', bazin: '#0f9d8a', blouson: '#3d64a8', salopette: '#3d64a8', souscorps: '#f4f4f4', jogging: '#f4efe6', sweat: '#6c7280', soutane: '#17171a', pasteur: '#17171a', imam: '#f8f9fa', abaya: '#14213d', blouse: '#f8f9fa', bleu: '#1d4ed8', policier: '#8ec5ee', gendarme: '#6b7a4a', cuisinier: '#f8f9fa', infirmier: '#e7f5ff', vigile: '#17171a', soeur: '#5b6470', grenouillere: '#bde0fe', body: '#f8f9fa', 'robe-bebe': '#ffc8dd', 'pagne-bebe': '#ff7a00', 'salopette-bebe': '#74c0fc', 'tee-short': '#f2b705', 'robe-volants': '#f783ac', 'ensemble-pagne': '#00a862', pyjama: '#74c0fc', oversize: '#f4efe6', crop: '#d6336c', 'maillot-club': '#7a1f3d' }

/** Sims made before the creator grew: fill the new fields. */
export function fullLook(look: Look): Required<Look> {
  return { ...(DEFAULT_LOOK as Required<Look>), ...stripUndefined(look) }
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '')) as Partial<T>
}

export function randomLook(gender: 'femme' | 'homme', random: () => number = Math.random): Required<Look> {
  const pick = <T,>(a: readonly T[]) => {
    const n = random()
    const u = Number.isFinite(n) ? n - Math.floor(n) : 0
    return a[Math.min(Math.floor(u * a.length), a.length - 1)]
  }
  const femme = gender === 'femme'
  const hairs = femme ? ['braids', 'afro', 'bun', 'weave', 'headwrap', 'locks', 'short', 'cornrows', 'twists', 'ponytail', 'puffs', 'bob'] : ['short', 'bald', 'afro', 'locks', 'short', 'degrade', 'cornrows', 'twists', 'mohawk']
  const outfits = femme ? ['pagne', 'boubou', 'casual', 'robe', 'jersey', 'debardeur', 'survet', 'kaba', 'jupe', 'chemise-pagne', 'blouson', 'salopette', 'bazin', 'jogging', 'sweat', 'abaya', 'souscorps'] : ['pagne', 'boubou', 'casual', 'suit', 'jersey', 'debardeur', 'survet', 'basket', 'chemise-pagne', 'bazin', 'chemise', 'blouson', 'salopette', 'souscorps', 'souscorps', 'jogging', 'sweat', 'imam', 'bleu']
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
    // One accessory, sometimes two or three (glasses and a watch, earrings and a bag…).
    accessory: (() => {
      const pool = femme ? ['earrings', 'earrings', 'glasses', 'chain', 'none', 'sunglasses', 'beads', 'bag', 'watch', 'bandana'] : ['none', 'chain', 'glasses', 'cap', 'capback', 'sunglasses', 'watch', 'beanie', 'hat', 'buckethat', 'headphones', 'bag']
      let worn = 'none'
      const n = random() < 0.55 ? 1 : random() < 0.7 ? 2 : 3
      for (let k = 0; k < n; k++) worn = toggleAccessory(worn, pick(pool))
      return worn
    })(),
    pattern: pick(PATTERNS).id,
    bottomColor: '',
    shoeColor: '',
    accessoryColor: '',
    marks: random() < 0.12 ? pick(MARKS.slice(1)).id : 'none',
    wear: 'neuf',
  }
}

export const BOTTOM_COLORS = ['#3d64a8', '#2b2f45', '#141416', '#f4efe6', '#8a5a2b', '#4f6b3a', '#b02e0c', '#c8b07a', '#7a1f3d', '#74c0fc', '#f2b705']
export const SHOE_COLORS = ['#f4f4f4', '#141416', '#6b4423', '#8a5a2b', '#e8d9b5', '#ff7a00', '#2a6cf0', '#d6336c', '#00a862', '#c9a227']
export const ACCESSORY_COLORS = ['#e8b93c', '#d8d8de', '#17171a', '#b02e0c', '#2a6cf0', '#00a862', '#ff7a00', '#f783ac', '#f4efe6', '#7b5cff']

/** The colours an outfit's parts have when the player hasn't picked one. */
export function defaultColors(l: Required<Look>, femme: boolean) {
  const bottom: Record<string, string> = { pagne: femme ? l.outfitColor : '#2b2f45', jersey: '#f8f9fa', casual: '#3d64a8', debardeur: '#1f2a44', basket: l.outfitColor, 'chemise-pagne': '#2b2f45', chemise: '#2b2f45', uniforme: femme ? '#1d4ed8' : '#a08850', jupe: '#2b2f45', blouson: '#3d64a8', salopette: l.outfitColor, kaba: l.outfitColor, bazin: l.outfitColor, souscorps: '#3d64a8', jogging: '#6c7280', sweat: '#6c7280', soutane: l.outfitColor, pasteur: '#17171a', imam: '#f8f9fa', abaya: '#2b2f45', blouse: '#2b2f45', bleu: l.outfitColor, policier: '#1f2a44', gendarme: '#4f5b36', cuisinier: '#2b2f45', infirmier: l.outfitColor, vigile: '#17171a', soeur: l.outfitColor, 'tee-short': '#3d64a8', 'maillot-club': '#f8f9fa', 'robe-volants': l.outfitColor, 'ensemble-pagne': l.outfitColor, pyjama: l.outfitColor, oversize: '#6b7a4a', crop: '#3d64a8' }
  const shoe: Record<string, string> = { policier: '#141416', gendarme: '#141416', cuisinier: '#141416', infirmier: '#f4f4f4', vigile: '#141416', soeur: '#141416', souscorps: '#141416', jogging: '#f4f4f4', sweat: '#141416', soutane: '#141416', pasteur: '#141416', imam: '#e8d9b5', abaya: '#141416', blouse: '#f4f4f4', bleu: '#141416', 'chemise-pagne': '#6b4423', kaba: '#8a5a2b', bazin: '#e8d9b5', chemise: '#141416', uniforme: '#141416', jupe: '#f4f4f4', blouson: '#f4f4f4', salopette: '#f4f4f4', debardeur: '#141416', basket: '#f8f9fa', survet: '#f4f4f4', 'tee-short': '#2a6cf0', 'maillot-club': '#141416', 'robe-volants': '#d6336c', 'ensemble-pagne': '#8a5a2b', pyjama: '#74c0fc', oversize: '#f4f4f4', crop: '#f4f4f4', pagne: femme ? '#8a5a2b' : '#6b4423', boubou: '#e8d9b5', robe: '#1c1c22', suit: '#141416', jersey: '#141416', casual: '#f4f4f4' }
  const outfit = !femme && FEMME_OUTFITS.has(l.outfit) ? (l.outfit === 'kaba' ? 'boubou' : l.outfit === 'abaya' ? 'imam' : l.outfit === 'soeur' ? 'soutane' : 'casual') : l.outfit
  return {
    bottom: bottom[outfit] ?? l.outfitColor,
    shoe: shoe[outfit] ?? '#f4f4f4',
    accessory: accessoryColor({ ...l, accessoryColor: '' }, accessoriesOf(l)[0] ?? 'none'),
  }
}

/**
 * What a Sim wears at work, during a shift (the interaction "work"): the
 * nurse's outfit, the white coat for a doctor, the cook's whites at the
 * maquis, a shirt or a suit at the office and the mairie. Jobs without a
 * uniform (market, transport, DJ, hairdresser) keep the Sim's own clothes.
 * `level` counts from 0 (the first rung of the career).
 */
export function workLook(look: Look, career: string, level: number): Look {
  const outfit: string | undefined = (
    {
      sante: level >= 3 ? 'blouse' : 'infirmier',
      maquis: 'cuisinier',
      bureau: level >= 2 ? 'suit' : 'chemise',
      mairie: level >= 4 ? 'suit' : 'chemise',
      enseignement: 'chemise',
      // The tills and the shops in a shirt; the hotel, the chambers, the airport in a suit; the white coat, the police's.
      caisse: 'chemise',
      vente: 'chemise',
      hotellerie: level >= 1 ? 'suit' : 'chemise',
      droit: 'suit',
      pharmacie: 'blouse',
      police: 'policier',
      aerien: 'suit',
    } as Record<string, string>
  )[career]
  if (!outfit) return look
  // Office clothes are office colours: a dark suit, a white shirt over dark trousers.
  const colours = outfit === 'suit' ? { outfitColor: '#1f2a44', bottomColor: '#1f2a44' } : outfit === 'chemise' ? { outfitColor: '#f4f4f4', bottomColor: '#2b2f45' } : {}
  return { ...look, outfit, ...colours, accessory: accessoriesOf(look).filter((a) => a !== 'cap' && a !== 'capback').join(',') || 'none' }
}
