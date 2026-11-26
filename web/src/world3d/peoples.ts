import { countryLookNow } from './countryStyle'

// « Persos du monde » (the update « persos-monde »; avatar/options.ts randomLook): the people one meets in each
// country, and where it matters in each city or commune: a weighted mix of peoples, each with its range of skin
// tones, hair, hair colours, eye colours and face features. Every range is wide (no one face for a people), every
// look dignified. The diaspora is there: Barbès and Matonge, Peckham and Kreuzberg, the Bronx and Queens, the
// Liberdade of São Paulo, Dubai's South Asians.
//
// A region adds its country with one line in PLACES (its id as countryStyle.ts lookAt gives it):
//     jp: mix('est-asie:96 *sud-est-asie:2 *europe-ouest:1 *sud-asie:1'),
// and a city or a commune of its own in CITIES (by its commune id, or by its centre: within 70 km).
// A `*` before a people: its first names are its own (GROUP_NAMES), not the country's (world3d/talk.ts nameFor).
// Côte d'Ivoire and Burkina Faso have no entry: their passers-by are drawn as they always were.

/** One look's range: [value, weight] lists. */
type W = [string, number][]
export type People = {
  skins: W
  hairF: W
  hairM: W
  hairColors: W
  eyes: W
  eyeShape: W
  nose: W
  lips: W
  brows: W
  /** The share with freckles. */
  freckles: number
  beards?: W
}
/** A place's mix: each people with its weight; `own`: named by its own first names (GROUP_NAMES). */
export type Mix = { group: string; weight: number; own: boolean }[]

/** « a:3 b:2 » → [[a, 3], [b, 2]] (an empty id: ''). */
const w = (s: string): W =>
  s
    .trim()
    .split(/\s+/)
    .map((x) => {
      const i = x.lastIndexOf(':')
      const id = x.slice(0, i)
      return [id === '-' ? '' : id, Number(x.slice(i + 1))]
    })
const mix = (s: string): Mix => w(s).map(([g, n]) => ({ group: g.replace(/^\*/, ''), weight: n, own: g.startsWith('*') }))

/* ---------- The colours ---------- */

// Skins (avatar/options.ts SKIN_TONES, then WORLD_SKIN_TONES).
const FAIR = 'fbe7da:2 f8dcc8:3 f3cfc0:3 eabca8:2 f6d5b4:3 e6c3a2:2'
const MID_EU = 'f8dcc8:2 f3cfc0:2 f6d5b4:3 e6c3a2:3 f1c9a0:2 e0b88f:2 eabca8:1'
const OLIVE = 'f1c9a0:2 e6c3a2:2 e0b88f:3 c9a074:3 dca87a:2 b38b5e:1 f6d5b4:1'
const SLAV = 'fbe7da:1 f8dcc8:3 f3cfc0:3 f6d5b4:3 e6c3a2:2 eabca8:1'
const AFRO = 'c28a5c:1 b07a4a:2 a46c42:2 8a5532:3 7a4a2a:3 6e4024:3 583119:3 4a2814:2 3f2210:2 2e180b:1'
const AFRO_MIX = 'dca87a:1 c28a5c:2 b07a4a:3 a46c42:3 8a5532:3 7a4a2a:2 6e4024:2 583119:1 4a2814:1'
const HORN = 'b07a4a:2 a46c42:3 8a5532:3 7a4a2a:3 6e4024:2 583119:1'
const MAGHREB = 'f6d5b4:1 f1c9a0:2 e0b88f:3 dca87a:3 c9a074:3 c28a5c:2 b38b5e:2 b07a4a:1 8a5532:1'
const ARAB = 'f1c9a0:2 e0b88f:3 dca87a:3 c9a074:3 c28a5c:2 b38b5e:2 b07a4a:1'
const PERSIAN = 'f6d5b4:2 f1c9a0:3 e6c3a2:2 e0b88f:3 dca87a:2 c9a074:2'
const EAST_ASIA = 'f3d7b6:4 e8c49b:4 f6d5b4:2 d9b084:2 f1c9a0:1'
const SE_ASIA = 'e8c49b:2 d9b084:3 c99a6b:4 b8875a:3 c28a5c:1 a46c42:1'
const S_ASIA = 'dca87a:1 c48a5e:3 a8734a:4 b07a4a:2 8c5a3a:3 6f452c:2 c9a074:1'
const MESTIZO = 'e0b88f:2 dca87a:2 c08a5f:3 c28a5c:3 b97a52:3 b07a4a:2 f1c9a0:1'
const INDIGENOUS = 'c08a5f:2 b97a52:4 a0673f:3 b07a4a:2 8a5532:1'
const PACIFIC = 'c28a5c:1 b97a52:2 9a6440:4 a0673f:2 7e5034:3 8a5532:1'
const MELANESIAN = '7e5034:2 6e4024:3 583119:3 4a2814:2 9a6440:1'
const ABORIGINAL = '8a5532:2 7a4a2a:3 6e4024:3 583119:2 7e5034:2'
// Hair colours (avatar/options.ts HAIR_COLORS, then WORLD_HAIR_COLORS).
const H_MID = 'cbb68a:1 a88a5c:2 c49a4a:1 7a5838:3 8a5a2b:3 5a3418:4 6b3a20:3 2e1b12:3 7a2e1a:1 a8441c:1 141010:1'
const H_DARK = '141010:4 2e1b12:4 5a3418:3 6b3a20:2 7a5838:1'
const H_BLACK = '141010:8 2e1b12:3 5a3418:1'
const H_CELTIC = 'a8441c:3 c9774a:2 7a2e1a:2 8a5a2b:2 5a3418:3 6b3a20:2 cbb68a:2 e8c872:1 2e1b12:1'
// Eyes (avatar/options.ts EYE_COLORS).
const E_LIGHT = '2b4466:5 5b6470:3 2f4f3a:3 8a6a3a:2 6b4423:2 4a2c18:1'
const E_MID = '2b4466:2 5b6470:1 2f4f3a:2 8a6a3a:3 6b4423:4 4a2c18:3 2b1a10:1'
const E_DARK = '2b1a10:4 4a2c18:4 6b4423:3 8a6a3a:1'
const E_DARK_SOME_LIGHT = '2b1a10:3 4a2c18:4 6b4423:4 8a6a3a:2 2f4f3a:1 2b4466:1'

const people = (o: { skins: string; hairF: string; hairM: string; hair: string; eyes: string; eyeShape: string; nose: string; lips: string; brows?: string; freckles?: number; beards?: string }): People => ({
  skins: w(o.skins).map(([c, n]) => [`#${c}`, n]),
  hairF: w(o.hairF),
  hairM: w(o.hairM),
  hairColors: w(o.hair).map(([c, n]) => [`#${c}`, n]),
  eyes: w(o.eyes).map(([c, n]) => [`#${c}`, n]),
  eyeShape: w(o.eyeShape),
  nose: w(o.nose),
  lips: w(o.lips),
  brows: w(o.brows ?? '-:5 fins:2 epais:2'),
  freckles: o.freckles ?? 0,
  beards: o.beards ? w(o.beards) : undefined,
})

/* ---------- The peoples ---------- */

const EU_F = 'lisse-long:5 ondule:4 boucle:2 carre-frange:1 bob:3 ponytail:3 tresse-lisse:1 chignon-top:2 raie-cote:1 bun:1'
const EU_M = 'raie-cote:5 short:4 buzz:3 ondule:1 boucle:1 bald:1 man-bun:1 degrade:1'

export const PEOPLES: Record<string, People> = {
  // Europe: the north (Scandinavia, the Baltic), the west (France, Britain, Germany, Benelux), the south (the Mediterranean), the east.
  'europe-nord': people({ skins: FAIR, hairF: EU_F, hairM: EU_M, hair: 'efe0b0:3 e8c872:4 d9bf7f:4 cbb68a:4 a88a5c:3 c49a4a:2 7a5838:2 8a5a2b:1 c9774a:1 a8441c:1', eyes: E_LIGHT, eyeShape: '-:5 amande:3 tombant:2', nose: '-:5 fin:3 aquilin:1', lips: '-:5 fines:4 pleines:1', freckles: 0.22 }),
  'europe-ouest': people({ skins: MID_EU, hairF: EU_F, hairM: EU_M, hair: H_MID + ' e8c872:1 d9bf7f:1', eyes: E_MID, eyeShape: '-:5 amande:3 tombant:2', nose: '-:5 fin:2 aquilin:2', lips: '-:5 fines:3 pleines:2', freckles: 0.12 }),
  'europe-celte': people({ skins: FAIR, hairF: EU_F, hairM: EU_M, hair: H_CELTIC, eyes: E_LIGHT, eyeShape: '-:5 amande:3 tombant:2', nose: '-:5 fin:3', lips: '-:5 fines:3 pleines:1', freckles: 0.35 }),
  'europe-sud': people({ skins: OLIVE, hairF: 'lisse-long:4 ondule:5 boucle:4 bob:2 ponytail:3 chignon-top:2 tresse-lisse:1 bun:1', hairM: 'short:4 raie-cote:3 buzz:3 boucle:2 ondule:1 bald:1 degrade:2', hair: H_DARK + ' 7a5838:1 8a5a2b:1', eyes: E_DARK_SOME_LIGHT, eyeShape: '-:4 amande:5 tombant:1', nose: '-:4 aquilin:3 fin:1 large:1', lips: '-:5 pleines:3 fines:1', freckles: 0.04 }),
  'europe-est': people({ skins: SLAV, hairF: EU_F, hairM: EU_M, hair: H_MID + ' cbb68a:2 d9bf7f:1', eyes: E_LIGHT, eyeShape: '-:5 amande:3 tombant:2', nose: '-:5 fin:2 large:1', lips: '-:5 fines:3 pleines:1', freckles: 0.08 }),
  turc: people({ skins: OLIVE, hairF: 'lisse-long:4 ondule:4 boucle:2 ponytail:2 hijab:3 chignon-top:1', hairM: 'short:4 raie-cote:2 buzz:3 degrade:3 boucle:1', hair: H_DARK, eyes: E_DARK_SOME_LIGHT, eyeShape: '-:4 amande:5 tombant:1', nose: '-:4 aquilin:4 large:1', lips: '-:5 pleines:3 fines:1', beards: 'none:4 full:3 moustache:2 bouc:1' }),
  // Africa: the west and the centre (Abidjan's own hairdos), the Horn, the Afro-descendants of the Americas.
  afrique: people({ skins: AFRO, hairF: 'braids:4 afro:3 bun:2 weave:3 headwrap:2 locks:2 cornrows:2 twists:3 puffs:1 bob:1 tresses-longues:2 perruque:1', hairM: 'short:5 bald:2 afro:1 locks:2 degrade:3 cornrows:1 twists:1 taper:2', hair: H_BLACK, eyes: E_DARK, eyeShape: '-:5 amande:4 tombant:1', nose: '-:4 large:5 fin:1', lips: '-:4 pleines:6', brows: '-:6 epais:2 fins:2' }),
  corne: people({ skins: HORN, hairF: 'boucle:3 boucles-afro:3 braids:3 hijab:3 ondule:1 bun:2 afro:1', hairM: 'short:5 boucles-afro:2 buzz:2 afro:1 degrade:2', hair: H_BLACK, eyes: E_DARK, eyeShape: '-:4 amande:6', nose: '-:5 fin:3 aquilin:2', lips: '-:6 pleines:3 fines:1' }),
  antilles: people({ skins: AFRO_MIX, hairF: 'braids:3 afro:2 boucles-afro:3 weave:2 twists:2 locks:1 bun:2 puffs:1 headwrap:1 lisse-long:1', hairM: 'short:4 degrade:4 locks:2 afro:1 boucles-afro:1 twists:1 bald:1', hair: H_BLACK + ' 6b3a20:1', eyes: E_DARK, eyeShape: '-:5 amande:4 tombant:1', nose: '-:5 large:4 fin:1', lips: '-:5 pleines:5' }),
  'afro-am': people({ skins: AFRO_MIX, hairF: 'braids:3 afro:3 boucles-afro:2 weave:2 twists:2 locks:2 bun:2 puffs:1 perruque:1 tresses-longues:1', hairM: 'short:4 degrade:4 locks:2 cornrows:2 afro:1 bald:2 taper:1', hair: H_BLACK + ' 6b3a20:1', eyes: E_DARK, eyeShape: '-:5 amande:4 tombant:1', nose: '-:5 large:4 fin:1', lips: '-:5 pleines:5' }),
  'afro-bresil': people({ skins: AFRO_MIX + ' 4a2814:1', hairF: 'boucles-afro:4 braids:3 afro:2 twists:1 locks:1 bun:2 headwrap:1 lisse-long:1', hairM: 'short:4 degrade:4 buzz:2 locks:1 afro:1 boucles-afro:1 bald:1', hair: H_BLACK, eyes: E_DARK, eyeShape: '-:5 amande:4 tombant:1', nose: '-:5 large:4 fin:1', lips: '-:5 pleines:5' }),
  // North Africa and the Middle East: the Maghreb's Arabs and Amazigh, the Levant and the Gulf, Persia.
  maghreb: people({ skins: MAGHREB, hairF: 'lisse-long:3 ondule:4 boucle:4 hijab:5 ponytail:2 chignon-top:1 bun:1', hairM: 'short:4 boucle:2 buzz:3 degrade:4 raie-cote:1 bald:1', hair: H_DARK + ' 7a5838:1 8a5a2b:1 a8441c:0.3', eyes: E_DARK_SOME_LIGHT, eyeShape: '-:4 amande:5 tombant:1', nose: '-:4 aquilin:4 fin:1 large:1', lips: '-:5 pleines:3 fines:1', beards: 'none:4 full:3 bouc:2 moustache:1 collier:1' }),
  arabe: people({ skins: ARAB, hairF: 'lisse-long:3 ondule:3 boucle:2 hijab:6 ponytail:1 chignon-top:1', hairM: 'short:5 buzz:2 degrade:3 boucle:1 raie-cote:2', hair: H_DARK, eyes: E_DARK_SOME_LIGHT, eyeShape: '-:4 amande:5 tombant:1', nose: '-:4 aquilin:4 large:1', lips: '-:5 pleines:3 fines:1', beards: 'none:3 full:4 bouc:2 moustache:1 collier:2' }),
  persan: people({ skins: PERSIAN, hairF: 'lisse-long:4 ondule:4 hijab:4 boucle:1 ponytail:1 chignon-top:1', hairM: 'short:4 raie-cote:3 buzz:2 boucle:1 degrade:2', hair: H_DARK + ' 7a5838:1', eyes: E_DARK_SOME_LIGHT, eyeShape: '-:4 amande:5 tombant:1', nose: '-:4 aquilin:5 fin:1', lips: '-:5 pleines:2 fines:2', beards: 'none:4 full:3 bouc:2 collier:1' }),
  // Asia: the east (China, Japan, Korea), the south-east, the south.
  'est-asie': people({ skins: EAST_ASIA, hairF: 'lisse-long:5 carre-frange:4 ponytail:3 bob:2 chignon-top:2 ondule:1 tresse-lisse:1', hairM: 'raie-cote:5 short:4 buzz:2 ondule:1 man-bun:0.5', hair: '141010:7 2e1b12:4 5a3418:2 7a5838:1', eyes: '2b1a10:5 4a2c18:4 6b4423:2', eyeShape: 'bride:6 amande:3 -:1', nose: '-:5 fin:3 large:2', lips: '-:6 fines:2 pleines:2', brows: '-:5 fins:3 epais:2' }),
  'sud-est-asie': people({ skins: SE_ASIA, hairF: 'lisse-long:5 ponytail:3 carre-frange:2 bob:2 hijab:2 chignon-top:2 ondule:1', hairM: 'short:5 raie-cote:4 buzz:2 ondule:1 degrade:1', hair: '141010:7 2e1b12:4 5a3418:1', eyes: E_DARK, eyeShape: 'bride:3 amande:5 -:2', nose: '-:5 large:4 fin:1', lips: '-:5 pleines:4 fines:1' }),
  'sud-asie': people({ skins: S_ASIA, hairF: 'lisse-long:5 tresse-lisse:4 ondule:3 bun:2 ponytail:2 hijab:2 boucle:1', hairM: 'short:5 raie-cote:4 ondule:2 buzz:2 turban:1.5 degrade:1 boucle:1', hair: '141010:7 2e1b12:4 5a3418:1', eyes: E_DARK, eyeShape: 'amande:6 -:3 tombant:1', nose: '-:4 aquilin:3 large:2 fin:1', lips: '-:5 pleines:4 fines:1', brows: '-:4 epais:4 fins:2', beards: 'none:5 full:3 moustache:2 bouc:1 longue:0.5' }),
  'asie-centrale': people({ skins: 'f3d7b6:2 e8c49b:3 f1c9a0:2 e0b88f:2 d9b084:2 f6d5b4:1', hairF: 'lisse-long:5 tresse-lisse:3 ponytail:2 hijab:2 bun:1', hairM: 'short:5 raie-cote:3 buzz:3', hair: H_BLACK + ' 5a3418:2', eyes: E_DARK_SOME_LIGHT, eyeShape: 'bride:4 amande:4 -:2', nose: '-:6 aquilin:2 large:1', lips: '-:6 fines:2 pleines:1' }),
  // The Americas: the mestizos, the first peoples, the Caribbean's English-speaking islands.
  'latino-metis': people({ skins: MESTIZO, hairF: 'lisse-long:5 ondule:4 boucle:2 ponytail:3 tresse-lisse:2 bun:1 chignon-top:1 boucles-afro:1', hairM: 'short:5 degrade:3 raie-cote:2 buzz:2 boucle:1 ondule:1', hair: H_DARK + ' 7a5838:1', eyes: E_DARK + ' 8a6a3a:1', eyeShape: '-:4 amande:5 bride:1 tombant:1', nose: '-:5 large:3 aquilin:2', lips: '-:5 pleines:3 fines:2', beards: 'none:5 moustache:2 bouc:2 full:1' }),
  autochtone: people({ skins: INDIGENOUS, hairF: 'tresse-lisse:5 lisse-long:5 ponytail:2 bun:1 chignon-top:1', hairM: 'short:4 lisse-long:1 raie-cote:2 buzz:2 ponytail:1', hair: '141010:8 2e1b12:3', eyes: E_DARK, eyeShape: 'amande:5 bride:3 -:2', nose: '-:4 aquilin:3 large:3', lips: '-:6 pleines:2 fines:2', beards: 'none:8 moustache:1' }),
  caraibes: people({ skins: AFRO_MIX, hairF: 'braids:3 afro:2 boucles-afro:2 locks:2 weave:2 twists:2 bun:2 puffs:1', hairM: 'short:4 degrade:4 locks:3 afro:1 twists:1 bald:1', hair: H_BLACK, eyes: E_DARK, eyeShape: '-:5 amande:4 tombant:1', nose: '-:5 large:4 fin:1', lips: '-:5 pleines:5' }),
  // Oceania: the Pacific's peoples (Polynesia, Melanesia), Australia's first peoples.
  pacifique: people({ skins: PACIFIC, hairF: 'lisse-long:3 ondule:4 boucle:3 boucles-afro:2 chignon-top:2 bun:2 tresse-lisse:1', hairM: 'short:4 buzz:3 man-bun:2 boucle:2 degrade:2 ondule:1', hair: '141010:7 2e1b12:4 5a3418:1', eyes: E_DARK, eyeShape: '-:5 amande:4 bride:1', nose: '-:4 large:6', lips: '-:5 pleines:5', beards: 'none:5 full:2 bouc:2 moustache:1' }),
  melanesie: people({ skins: MELANESIAN, hairF: 'afro:3 boucles-afro:4 boucle:2 braids:1 bun:2 short:1', hairM: 'short:5 afro:2 boucles-afro:2 buzz:2 bald:1', hair: '141010:7 2e1b12:3 c49a4a:0.5', eyes: E_DARK, eyeShape: '-:5 amande:4 tombant:1', nose: '-:4 large:6', lips: '-:5 pleines:5' }),
  'premiers-oceanie': people({ skins: ABORIGINAL, hairF: 'boucle:4 ondule:3 boucles-afro:2 lisse-long:1 ponytail:2 bun:1', hairM: 'short:4 boucle:3 buzz:2 ondule:2 bald:1', hair: '141010:5 2e1b12:4 5a3418:2 8a5a2b:1 c49a4a:0.5', eyes: E_DARK, eyeShape: '-:5 amande:3 tombant:2', nose: '-:4 large:6', lips: '-:5 pleines:4 fines:1', beards: 'none:4 full:4 bouc:1' }),
}

/* ---------- The places ---------- */

// The countries: the peoples one meets in their streets (the first, the country's own; `*`, named by their own first names).
const EU_DIASPORA = '*afrique:4 *maghreb:3 *sud-asie:1 *est-asie:1'
export const PLACES: Record<string, Mix> = {
  // France: Europeans, the Maghreb, sub-Saharan Africa, the Antilles, Asia (Paris and its suburbs, CITIES below).
  fr: mix('europe-ouest:60 europe-sud:6 *maghreb:13 *afrique:10 *antilles:4 *est-asie:3 *sud-est-asie:1 *sud-asie:1 *turc:1'),
  // North America: very mixed.
  us: mix('europe-ouest:50 *afro-am:14 *latino-metis:18 *est-asie:5 *sud-asie:2 *sud-est-asie:2 europe-sud:3 *arabe:1 *autochtone:1 *afrique:2 *pacifique:0.3'),
  ca: mix('europe-ouest:62 *est-asie:8 *sud-asie:7 *afrique:4 *caraibes:2 *arabe:3 *sud-est-asie:3 *autochtone:4 *latino-metis:2 *antilles:1 europe-sud:2'),
  // Europe: fair in the north (with its diaspora), olive in the south, the east's.
  be: mix(`europe-ouest:66 *maghreb:12 *afrique:12 *turc:4 europe-sud:3 *est-asie:1 *sud-asie:1`),
  gb: mix('europe-ouest:66 europe-celte:6 *sud-asie:10 *afrique:7 *caraibes:4 *est-asie:3 *arabe:1 europe-est:2 *sud-est-asie:1'),
  ie: mix(`europe-celte:80 europe-ouest:8 europe-est:4 ${EU_DIASPORA}`),
  de: mix('europe-ouest:72 *turc:9 europe-est:5 *arabe:4 europe-sud:3 *afrique:3 *maghreb:1 *est-asie:1 *sud-asie:1 *persan:1'),
  nl: mix('europe-ouest:70 *turc:5 *maghreb:6 *caraibes:6 *sud-est-asie:3 *afrique:3 europe-est:2 *sud-asie:2 *est-asie:1'),
  lu: mix(`europe-ouest:64 europe-sud:18 ${EU_DIASPORA}`),
  ch: mix(`europe-ouest:66 europe-sud:12 europe-est:4 *turc:2 *afrique:3 *maghreb:2 *sud-asie:2 *est-asie:2 *corne:1`),
  at: mix(`europe-ouest:72 europe-est:12 *turc:6 *arabe:3 *afrique:2 *est-asie:1 *persan:1`),
  mc: mix(`europe-sud:46 europe-ouest:42 ${EU_DIASPORA}`),
  it: mix('europe-sud:86 europe-est:3 *maghreb:3 *afrique:3 *sud-asie:2 *est-asie:2 *latino-metis:1'),
  es: mix('europe-sud:84 *maghreb:5 *latino-metis:6 europe-est:2 *afrique:2 *est-asie:1'),
  pt: mix('europe-sud:86 *afrique:6 *latino-metis:2 *afro-bresil:2 *sud-asie:1 europe-est:1 *est-asie:1'),
  gr: mix('europe-sud:90 europe-est:3 *arabe:2 *sud-asie:2 *afrique:1 *est-asie:1'),
  hr: mix('europe-est:55 europe-sud:42 *afrique:1 *est-asie:1'),
  se: mix('europe-nord:78 *arabe:6 *corne:3 *persan:2 europe-est:3 *afrique:2 *sud-asie:2 *est-asie:2 *latino-metis:1'),
  no: mix('europe-nord:82 *corne:3 *sud-asie:3 europe-est:4 *arabe:3 *afrique:2 *sud-est-asie:2 *est-asie:1'),
  dk: mix('europe-nord:84 *arabe:4 *turc:3 europe-est:3 *corne:2 *sud-asie:2 *est-asie:1 *afrique:1'),
  fi: mix('europe-nord:90 europe-est:4 *corne:2 *arabe:2 *est-asie:1 *afrique:1'),
  is: mix('europe-nord:92 europe-est:5 *sud-est-asie:2 *afrique:1'),
  pl: mix('europe-est:96 europe-ouest:2 *est-asie:1 *afrique:1'),
  cz: mix('europe-est:94 europe-ouest:3 *sud-est-asie:2 *afrique:1'),
  hu: mix('europe-est:94 europe-ouest:3 *est-asie:2 *afrique:1'),
  ro: mix('europe-est:84 europe-sud:12 *est-asie:2 *afrique:1 *arabe:1'),
  bg: mix('europe-est:82 europe-sud:10 turc:7 *afrique:1'),
  rs: mix('europe-est:94 europe-sud:4 *est-asie:1 *afrique:1'),
  ua: mix('europe-est:96 asie-centrale:2 *afrique:1 *est-asie:1'),
  ru: mix('europe-est:82 asie-centrale:10 *est-asie:3 turc:3 *afrique:1 *arabe:1'),
  tr: mix('turc:84 persan:4 europe-sud:6 *arabe:4 *afrique:1 europe-est:1'),
  // Latin America and the Caribbean: mestizos and first peoples, the Afro-descendants, the European South Americans.
  mx: mix('latino-metis:70 autochtone:18 europe-sud:9 *afro-am:1 *est-asie:1 *europe-ouest:1'),
  gt: mix('latino-metis:52 autochtone:42 europe-sud:5 *afrique:1'),
  sv: mix('latino-metis:86 autochtone:4 europe-sud:9 *afrique:1'),
  hn: mix('latino-metis:84 autochtone:7 caraibes:5 europe-sud:4'),
  ni: mix('latino-metis:72 europe-sud:14 caraibes:8 autochtone:6'),
  cr: mix('latino-metis:62 europe-sud:28 caraibes:6 autochtone:2 *est-asie:2'),
  pa: mix('latino-metis:64 caraibes:14 autochtone:12 europe-sud:8 *est-asie:2'),
  cu: mix('latino-metis:30 europe-sud:46 afro-bresil:22 *est-asie:1 *afrique:1'),
  ht: mix('antilles:94 latino-metis:4 europe-sud:1 *arabe:1'),
  do: mix('latino-metis:66 afro-bresil:20 europe-sud:12 *est-asie:1 antilles:1'),
  jm: mix('caraibes:90 latino-metis:4 *sud-asie:2 *est-asie:2 europe-ouest:2'),
  pr: mix('latino-metis:66 europe-sud:20 afro-bresil:12 *afro-am:2'),
  tt: mix('caraibes:40 sud-asie:38 latino-metis:18 *est-asie:2 europe-ouest:1 *arabe:1'),
  gy: mix('sud-asie:40 caraibes:30 latino-metis:18 autochtone:10 *est-asie:1 europe-sud:1'),
  sr: mix('sud-asie:28 caraibes:36 sud-est-asie:14 latino-metis:12 autochtone:4 *est-asie:3 europe-ouest:3'),
  gp: mix('antilles:78 latino-metis:6 *sud-asie:6 europe-ouest:9 *arabe:1'),
  mq: mix('antilles:78 latino-metis:6 *sud-asie:5 europe-ouest:10 *arabe:1'),
  gf: mix('antilles:44 latino-metis:12 europe-ouest:12 *afro-bresil:10 autochtone:6 *sud-est-asie:6 *est-asie:4 antilles:6'),
  co: mix('latino-metis:62 europe-sud:22 afro-bresil:10 autochtone:4 *arabe:1 *est-asie:1'),
  ve: mix('latino-metis:64 europe-sud:24 afro-bresil:8 autochtone:3 *arabe:1'),
  ec: mix('latino-metis:70 autochtone:16 europe-sud:6 afro-bresil:7 *est-asie:1'),
  pe: mix('latino-metis:56 autochtone:30 europe-sud:8 afro-bresil:2 *est-asie:4'),
  bo: mix('latino-metis:52 autochtone:42 europe-sud:5 *est-asie:1'),
  py: mix('latino-metis:86 europe-sud:10 autochtone:2 *est-asie:2'),
  uy: mix('europe-sud:80 latino-metis:10 afro-bresil:8 *est-asie:1 autochtone:1'),
  ar: mix('europe-sud:72 latino-metis:22 autochtone:3 *est-asie:1 *arabe:1 *afrique:1'),
  cl: mix('latino-metis:58 europe-sud:34 autochtone:6 *afro-bresil:1 *est-asie:1'),
  // Brazil: brancos, pardos and pretos (Salvador, CITIES below), the Japanese of São Paulo.
  br: mix('europe-sud:42 latino-metis:40 afro-bresil:14 *est-asie:2 autochtone:1 *arabe:1'),
  // Africa: the Maghreb's Arab and Amazigh ranges, the Horn's, the mixes of the south and of the islands (the rest of the continent drawn as it always was).
  ma: mix('maghreb:96 *afrique:2 europe-ouest:2'),
  dz: mix('maghreb:97 *afrique:2 europe-ouest:1'),
  tn: mix('maghreb:96 *afrique:2 europe-ouest:2'),
  ly: mix('maghreb:88 arabe:6 afrique:5 *sud-asie:1'),
  eg: mix('maghreb:70 arabe:24 corne:4 *afrique:1 europe-sud:1'),
  mr: mix('maghreb:44 afrique:56'),
  sd: mix('arabe:30 corne:40 afrique:30'),
  et: mix('corne:94 afrique:5 *arabe:1'),
  so: mix('corne:98 *arabe:2'),
  dj: mix('corne:86 arabe:10 *afrique:2 *sud-asie:1 europe-ouest:1'),
  ke: mix('afrique:92 corne:3 *sud-asie:3 *arabe:1 europe-ouest:1'),
  tz: mix('afrique:92 *arabe:3 *sud-asie:3 corne:1 europe-ouest:1'),
  za: mix('afrique:72 europe-ouest:9 latino-metis:9 *sud-asie:4 *est-asie:1 *europe-sud:1 caraibes:4'),
  na: mix('afrique:86 europe-ouest:7 latino-metis:7'),
  bw: mix('afrique:94 europe-ouest:3 *sud-asie:2 latino-metis:1'),
  zw: mix('afrique:96 europe-ouest:2 *sud-asie:1 latino-metis:1'),
  mg: mix('sud-est-asie:34 afrique:46 latino-metis:12 *sud-asie:3 *est-asie:2 europe-ouest:3'),
  cv: mix('afro-bresil:50 latino-metis:36 afrique:10 europe-sud:4'),
  // The Middle East (the region « monde-moyen-orient-oceanie »): Arab, Persian, the Gulf's many South and Southeast Asians.
  sa: mix('arabe:76 *sud-asie:12 *sud-est-asie:5 corne:3 *afrique:2 *maghreb:2'),
  ae: mix('*sud-asie:44 arabe:22 *sud-est-asie:12 *europe-ouest:6 *persan:4 *est-asie:3 *afrique:3 *maghreb:2 *corne:2 *europe-est:2'),
  qa: mix('*sud-asie:42 arabe:30 *sud-est-asie:14 *maghreb:3 *afrique:3 *europe-ouest:4 *corne:2 *persan:2'),
  kw: mix('arabe:50 *sud-asie:30 *sud-est-asie:12 *persan:3 *afrique:2 *europe-ouest:2 corne:1'),
  bh: mix('arabe:52 *sud-asie:32 *sud-est-asie:8 persan:5 *europe-ouest:2 *afrique:1'),
  om: mix('arabe:64 *sud-asie:24 corne:4 *sud-est-asie:5 persan:2 *afrique:1'),
  ye: mix('arabe:84 corne:12 afrique:3 *sud-asie:1'),
  iq: mix('arabe:80 persan:14 turc:5 *sud-asie:1'),
  sy: mix('arabe:86 persan:4 turc:6 europe-sud:3 corne:1'),
  lb: mix('arabe:84 europe-sud:6 persan:3 *sud-est-asie:3 corne:2 *afrique:2'),
  jo: mix('arabe:92 maghreb:2 *sud-asie:2 *sud-est-asie:2 corne:2'),
  ps: mix('arabe:96 maghreb:2 europe-sud:2'),
  il: mix('europe-sud:34 arabe:22 maghreb:14 europe-est:16 europe-ouest:6 corne:5 *sud-est-asie:2 *afrique:1'),
  ir: mix('persan:84 turc:10 arabe:4 asie-centrale:2'),
  // Asia (the region « monde-asie »).
  cn: mix('est-asie:96 asie-centrale:2 sud-est-asie:1 *europe-ouest:1'),
  hk: mix('est-asie:90 *sud-est-asie:5 *sud-asie:2 *europe-ouest:3'),
  tw: mix('est-asie:96 sud-est-asie:3 *europe-ouest:1'),
  jp: mix('est-asie:96 *sud-est-asie:2 *europe-ouest:1 *sud-asie:1'),
  kr: mix('est-asie:97 *sud-est-asie:2 *europe-ouest:1'),
  mn: mix('est-asie:30 asie-centrale:70'),
  kz: mix('asie-centrale:66 europe-est:28 turc:4 *est-asie:2'),
  uz: mix('asie-centrale:84 persan:8 europe-est:6 turc:2'),
  vn: mix('sud-est-asie:62 est-asie:36 *europe-ouest:1 *sud-asie:1'),
  th: mix('sud-est-asie:72 est-asie:24 *sud-asie:2 *europe-ouest:2'),
  la: mix('sud-est-asie:84 est-asie:16'),
  kh: mix('sud-est-asie:92 est-asie:7 *europe-ouest:1'),
  mm: mix('sud-est-asie:76 est-asie:10 sud-asie:14'),
  my: mix('sud-est-asie:58 est-asie:24 sud-asie:8 *sud-asie:2 *europe-ouest:2 *arabe:1 *afrique:1'),
  sg: mix('est-asie:70 sud-est-asie:14 sud-asie:9 *sud-asie:2 *europe-ouest:4 *afrique:1'),
  id: mix('sud-est-asie:90 est-asie:4 melanesie:3 *arabe:1 *sud-asie:1 *europe-ouest:1'),
  bn: mix('sud-est-asie:80 est-asie:12 *sud-asie:6 *europe-ouest:2'),
  ph: mix('sud-est-asie:88 est-asie:6 latino-metis:4 *europe-ouest:2'),
  in: mix('sud-asie:98 est-asie:1 *europe-ouest:1'),
  pk: mix('sud-asie:90 persan:8 asie-centrale:2'),
  bd: mix('sud-asie:96 sud-est-asie:4'),
  lk: mix('sud-asie:96 sud-est-asie:2 *europe-ouest:2'),
  np: mix('sud-asie:68 est-asie:30 *europe-ouest:2'),
  bt: mix('est-asie:56 sud-asie:44'),
  mv: mix('sud-asie:84 arabe:6 *europe-ouest:6 corne:2 *est-asie:2'),
  // Oceania: Australia and New Zealand mixed, the Pacific's islands.
  au: mix('europe-ouest:58 europe-celte:8 *est-asie:9 *sud-asie:6 *sud-est-asie:4 premiers-oceanie:4 europe-sud:5 *arabe:2 *pacifique:2 *afrique:1 *corne:1'),
  nz: mix('europe-ouest:58 europe-celte:6 pacifique:22 *est-asie:7 *sud-asie:4 *sud-est-asie:2 *afrique:1'),
  fj: mix('melanesie:44 pacifique:12 sud-asie:38 *est-asie:3 europe-ouest:3'),
  pg: mix('melanesie:96 pacifique:3 *europe-ouest:1'),
  vu: mix('melanesie:96 pacifique:2 *europe-ouest:2'),
  nc: mix('melanesie:44 europe-ouest:30 pacifique:12 sud-est-asie:6 *maghreb:2 latino-metis:6'),
  pf: mix('pacifique:78 europe-ouest:12 est-asie:6 latino-metis:4'),
  to: mix('pacifique:98 *europe-ouest:1 *est-asie:1'),
  ws: mix('pacifique:98 *europe-ouest:1 *est-asie:1'),
}

/**
 * The cities and the communes where the mix isn't the country's: by commune id (exact), else by the city's centre
 * (the nearest within 70 km): [lat, lng, mix]. Paris and Brussels with their diaspora, London's, New York's and
 * Toronto's very mixed streets, Salvador's Afro-Brazilians, Dubai's, Mumbai's.
 */
const COMMUNES: Record<string, Mix> = {
  'paris-barbes': mix('*afrique:36 *maghreb:28 europe-ouest:24 *antilles:5 *sud-asie:4 *est-asie:2 *corne:1'),
  'paris-saint-denis': mix('*afrique:30 *maghreb:28 europe-ouest:24 *antilles:6 *sud-asie:6 *est-asie:3 *turc:2 europe-sud:1'),
  'paris-montreuil': mix('*afrique:32 europe-ouest:38 *maghreb:18 *antilles:4 *est-asie:4 *sud-asie:2 europe-sud:2'),
  'paris-la-defense': mix('europe-ouest:62 *maghreb:12 *afrique:10 *est-asie:6 *sud-asie:4 *antilles:3 europe-sud:3'),
  'brux-matonge': mix('*afrique:58 europe-ouest:26 *maghreb:10 *antilles:2 *sud-asie:2 *est-asie:2'),
  'ldn-peckham': mix('*afrique:42 *caraibes:18 europe-ouest:26 *sud-asie:6 *est-asie:3 europe-est:3 *latino-metis:2'),
  'ber-kreuzberg': mix('europe-ouest:52 *turc:28 *arabe:8 *afrique:4 europe-sud:4 *est-asie:2 *persan:2'),
  'ams-zuidoost': mix('*caraibes:34 *afrique:26 europe-ouest:22 *sud-asie:8 *sud-est-asie:4 *turc:2 *maghreb:4'),
  'nyc-bronx': mix('*latino-metis:42 *afro-am:30 *afrique:10 europe-ouest:8 *caraibes:4 *sud-asie:3 *est-asie:2 *arabe:1'),
  'nyc-queens': mix('europe-ouest:22 *latino-metis:26 *est-asie:20 *sud-asie:14 *afro-am:10 *caraibes:3 *sud-est-asie:3 *arabe:2'),
  'nyc-manhattan': mix('europe-ouest:44 *latino-metis:20 *afro-am:13 *est-asie:12 *sud-asie:4 *afrique:3 europe-sud:2 *arabe:1 *caraibes:1'),
  'mtl-cdn': mix('europe-ouest:44 *sud-asie:12 *est-asie:12 *antilles:10 *arabe:8 *maghreb:6 *afrique:4 *sud-est-asie:4'),
  'saopaulo-centro': mix('europe-sud:40 latino-metis:32 afro-bresil:12 *est-asie:12 *arabe:3 autochtone:1'),
  'salvador-pelourinho': mix('afro-bresil:72 latino-metis:20 europe-sud:7 autochtone:1'),
  'salvador-barra': mix('afro-bresil:58 latino-metis:26 europe-sud:15 *europe-ouest:1'),
  'cdmx-centro': mix('latino-metis:72 autochtone:18 europe-sud:8 *est-asie:1 *europe-ouest:1'),
}
const CITY_SPOTS: [number, number, Mix][] = [
  // France
  [48.86, 2.34, mix('europe-ouest:50 europe-sud:4 *maghreb:16 *afrique:16 *antilles:5 *est-asie:5 *sud-asie:2 *sud-est-asie:1 *turc:1')],
  [43.29, 5.37, mix('europe-sud:28 europe-ouest:34 *maghreb:26 *afrique:6 *antilles:2 *est-asie:2 *sud-asie:1 arabe:1')],
  [45.76, 4.83, mix('europe-ouest:62 europe-sud:6 *maghreb:18 *afrique:8 *est-asie:3 *antilles:2 *turc:1')],
  [50.64, 3.06, mix('europe-ouest:70 *maghreb:16 *afrique:8 *est-asie:2 *antilles:2 europe-est:2')],
  // Europe's capitals and big cities
  [50.85, 4.35, mix('europe-ouest:52 *maghreb:20 *afrique:16 *turc:5 europe-sud:4 *sud-asie:1 *est-asie:2')],
  [51.51, -0.13, mix('europe-ouest:46 europe-celte:3 *sud-asie:16 *afrique:12 *caraibes:6 *est-asie:6 europe-est:4 europe-sud:3 *arabe:2 *latino-metis:1 *sud-est-asie:1')],
  [53.48, -2.24, mix('europe-ouest:62 europe-celte:4 *sud-asie:16 *afrique:8 *caraibes:3 *est-asie:4 europe-est:2 *arabe:1')],
  [52.52, 13.4, mix('europe-ouest:64 *turc:12 europe-est:7 *arabe:7 *afrique:3 europe-sud:3 *est-asie:2 *sud-est-asie:1 *persan:1')],
  [50.11, 8.68, mix('europe-ouest:58 *turc:12 europe-est:9 europe-sud:6 *arabe:5 *afrique:4 *sud-asie:3 *est-asie:2 *maghreb:1')],
  [52.37, 4.9, mix('europe-ouest:56 *maghreb:12 *turc:7 *caraibes:9 *sud-est-asie:4 *afrique:5 *sud-asie:3 *est-asie:2 europe-est:2')],
  [59.33, 18.07, mix('europe-nord:66 *arabe:9 *corne:6 *persan:4 europe-est:4 *afrique:3 *sud-asie:3 *est-asie:2 *latino-metis:2 *turc:1')],
  [59.91, 10.75, mix('europe-nord:70 *corne:6 *sud-asie:8 *arabe:5 europe-est:4 *afrique:3 *sud-est-asie:2 *est-asie:2')],
  [41.9, 12.5, mix('europe-sud:84 europe-est:3 *afrique:4 *sud-asie:3 *est-asie:3 *maghreb:2 *latino-metis:1')],
  [40.42, -3.7, mix('europe-sud:76 *latino-metis:12 *maghreb:5 europe-est:2 *afrique:3 *est-asie:2')],
  [38.72, -9.14, mix('europe-sud:78 *afrique:10 *afro-bresil:4 latino-metis:2 *sud-asie:3 *est-asie:2 europe-est:1')],
  [41.01, 28.98, mix('turc:80 europe-sud:5 *arabe:7 persan:3 *afrique:2 europe-est:2 asie-centrale:1')],
  [55.76, 37.62, mix('europe-est:80 asie-centrale:12 turc:3 *est-asie:3 *afrique:1 *arabe:1')],
  // North America
  [40.76, -73.99, mix('europe-ouest:34 *latino-metis:26 *afro-am:20 *est-asie:11 *sud-asie:4 *afrique:2 *caraibes:2 europe-sud:1')],
  [34.05, -118.24, mix('*latino-metis:46 europe-ouest:28 *est-asie:12 *afro-am:8 *sud-est-asie:3 *persan:1 *sud-asie:1 *pacifique:1')],
  [25.77, -80.19, mix('*latino-metis:56 europe-sud:10 *afro-am:12 *caraibes:6 *antilles:6 europe-ouest:9 *est-asie:1')],
  [29.76, -95.37, mix('*latino-metis:42 europe-ouest:26 *afro-am:20 *est-asie:6 *sud-asie:4 *afrique:2')],
  [41.88, -87.62, mix('europe-ouest:34 *afro-am:28 *latino-metis:28 *est-asie:6 *sud-asie:2 europe-est:2')],
  [33.75, -84.39, mix('*afro-am:48 europe-ouest:36 *latino-metis:6 *est-asie:4 *afrique:3 *sud-asie:3')],
  [38.9, -77.04, mix('*afro-am:42 europe-ouest:38 *latino-metis:10 *est-asie:4 *afrique:3 *corne:2 *sud-asie:1')],
  [42.33, -83.05, mix('*afro-am:74 europe-ouest:14 *latino-metis:7 *arabe:4 *est-asie:1')],
  [29.96, -90.06, mix('*afro-am:56 europe-ouest:34 *latino-metis:6 *sud-est-asie:3 *est-asie:1')],
  [21.3, -157.86, mix('*est-asie:36 pacifique:22 europe-ouest:22 *sud-est-asie:14 *latino-metis:4 *afro-am:2')],
  [37.77, -122.42, mix('europe-ouest:40 *est-asie:30 *latino-metis:14 *sud-est-asie:6 *afro-am:5 *sud-asie:5')],
  [43.65, -79.38, mix('europe-ouest:40 *sud-asie:14 *est-asie:14 *afrique:5 *caraibes:5 *sud-est-asie:7 *arabe:4 *latino-metis:3 europe-sud:4 europe-est:2 *autochtone:1 *corne:1')],
  [49.26, -123.11, mix('europe-ouest:42 *est-asie:30 *sud-asie:10 *sud-est-asie:8 *autochtone:3 *arabe:2 *latino-metis:2 *afrique:1 *persan:2')],
  [45.5, -73.58, mix('europe-ouest:56 *antilles:9 *maghreb:8 *arabe:5 *afrique:6 *est-asie:5 *sud-asie:4 *latino-metis:4 europe-sud:3')],
  // Latin America
  [-22.91, -43.18, mix('latino-metis:42 europe-sud:34 afro-bresil:22 *est-asie:1 autochtone:1')],
  [-12.97, -38.51, mix('afro-bresil:62 latino-metis:26 europe-sud:11 autochtone:1')],
  [-23.55, -46.63, mix('europe-sud:46 latino-metis:32 afro-bresil:12 *est-asie:7 *arabe:2 autochtone:1')],
  [-34.61, -58.37, mix('europe-sud:76 latino-metis:18 autochtone:2 *est-asie:2 *afrique:1 *arabe:1')],
  // Africa
  [-33.93, 18.42, mix('latino-metis:42 afrique:38 europe-ouest:16 *sud-asie:2 *est-asie:1 *europe-sud:1')],
  [-26.2, 28.05, mix('afrique:78 europe-ouest:12 latino-metis:4 *sud-asie:4 *est-asie:1 *europe-sud:1')],
  [-29.86, 31.02, mix('afrique:64 sud-asie:24 europe-ouest:10 latino-metis:2')],
  [-1.29, 36.82, mix('afrique:90 corne:3 *sud-asie:4 europe-ouest:2 *arabe:1')],
  [-4.05, 39.67, mix('afrique:84 arabe:8 *sud-asie:6 corne:2')],
  [-6.16, 39.2, mix('afrique:70 arabe:24 *sud-asie:6')],
  // The Middle East and Asia (their regions land them: these are ready)
  [25.2, 55.27, mix('*sud-asie:48 arabe:16 *sud-est-asie:13 *europe-ouest:7 *persan:4 *est-asie:3 *afrique:3 *maghreb:2 *corne:2 *europe-est:2')],
  [32.09, 34.78, mix('europe-sud:30 europe-est:22 maghreb:16 europe-ouest:12 arabe:8 corne:7 *sud-est-asie:3 *afrique:2')],
  [31.78, 35.23, mix('arabe:38 europe-sud:24 europe-est:14 maghreb:10 europe-ouest:8 corne:5 *afrique:1')],
  [35.68, 139.69, mix('est-asie:95 *sud-est-asie:2 *europe-ouest:2 *sud-asie:1')],
  [34.69, 135.5, mix('est-asie:97 *sud-est-asie:2 *europe-ouest:1')],
  [37.57, 126.98, mix('est-asie:96 *sud-est-asie:2 *europe-ouest:1 *sud-asie:1')],
  [31.23, 121.47, mix('est-asie:96 *europe-ouest:2 *sud-est-asie:1 *afrique:1')],
  [23.13, 113.26, mix('est-asie:92 *afrique:3 *sud-est-asie:3 *arabe:1 *europe-ouest:1')],
  [19.08, 72.88, mix('sud-asie:97 *est-asie:1 *europe-ouest:1 *arabe:1')],
  [28.61, 77.21, mix('sud-asie:98 *europe-ouest:1 *est-asie:1')],
  [30.73, 76.78, mix('sud-asie:98 *europe-ouest:1 est-asie:1')],
  [1.35, 103.82, mix('est-asie:66 sud-est-asie:15 sud-asie:9 *sud-asie:3 *europe-ouest:5 *afrique:1 *arabe:1')],
  [3.14, 101.69, mix('sud-est-asie:46 est-asie:30 sud-asie:12 *sud-asie:4 *arabe:3 *europe-ouest:3 *afrique:2')],
  [13.76, 100.5, mix('sud-est-asie:64 est-asie:30 *sud-asie:3 *europe-ouest:3')],
  // Oceania
  [-33.87, 151.21, mix('europe-ouest:46 europe-celte:5 *est-asie:16 *sud-asie:9 *sud-est-asie:6 *arabe:4 europe-sud:5 *pacifique:3 premiers-oceanie:2 *afrique:2 *corne:1 *latino-metis:1')],
  [-37.81, 144.96, mix('europe-ouest:46 europe-sud:9 *est-asie:14 *sud-asie:12 *sud-est-asie:7 *corne:3 *arabe:3 *afrique:2 premiers-oceanie:2 *pacifique:2')],
  [-36.85, 174.76, mix('europe-ouest:46 pacifique:28 *est-asie:14 *sud-asie:8 *sud-est-asie:3 *afrique:1')],
]

/* ---------- Where the Sim is ---------- */

let here: { lat: number; lng: number; commune: string } | null = null
/** Where the street is (world3d/open/OpenWorld.tsx, with setCountryLook): the commune and its position. */
export function setPeoplePlace(lat: number, lng: number, commune = '') {
  here = { lat, lng, commune }
}

/** The mix at a place: its commune's, its city's (the nearest centre within 70 km), its country's; null: drawn as always (Côte d'Ivoire, Burkina, an Africa not listed). */
export function mixAt(country: string, commune = '', lat?: number, lng?: number): Mix | null {
  if (!PLACES[country]) return null
  if (commune && COMMUNES[commune]) return COMMUNES[commune]
  if (lat !== undefined && lng !== undefined) {
    const k = Math.cos((lat * Math.PI) / 180)
    let best: Mix | null = null
    let d = (70 / 111) ** 2
    for (const [la, ln, m] of CITY_SPOTS) {
      const e = (la - lat) ** 2 + ((ln - lng) * k) ** 2
      if (e < d) (d = e), (best = m)
    }
    if (best) return best
  }
  return PLACES[country]
}
/** The mix where the Sim is now. */
export function mixHere(): Mix | null {
  const c = countryLookNow().id
  return mixAt(c, here?.commune, here?.lat, here?.lng)
}

/** A value of a weighted list, from a number in [0, 1). */
export function weighted<T extends string>(list: [T, number][], u: number): T {
  let total = 0
  for (const [, n] of list) total += n
  let x = u * total
  for (const [v, n] of list) {
    if (x < n) return v
    x -= n
  }
  return list[list.length - 1][0]
}

/* ---------- First names (world3d/talk.ts nameFor) ---------- */

/** The first names of a people met far from its own country (its `*` in a mix). */
export const GROUP_NAMES: Record<string, { femme: string[]; homme: string[] }> = {
  afrique: { femme: ['Aminata', 'Fatou', 'Awa', 'Mariam', 'Grâce', 'Esther', 'Adjoa', 'Ngozi', 'Kadiatou', 'Merveille'], homme: ['Mamadou', 'Moussa', 'Ibrahima', 'Koffi', 'Yao', 'Emmanuel', 'Kwame', 'Chinedu', 'Seydou', 'Patrick'] },
  corne: { femme: ['Hiwot', 'Selam', 'Amina', 'Hodan', 'Meron', 'Ifrah'], homme: ['Dawit', 'Abdi', 'Yonas', 'Mohamed', 'Tesfaye', 'Liban'] },
  maghreb: { femme: ['Yasmine', 'Inès', 'Nadia', 'Leïla', 'Sarah', 'Amina', 'Rania', 'Salma', 'Kenza', 'Imane'], homme: ['Karim', 'Mehdi', 'Youssef', 'Bilal', 'Samir', 'Rachid', 'Nassim', 'Amine', 'Sofiane', 'Hakim'] },
  arabe: { femme: ['Layla', 'Nour', 'Rania', 'Maya', 'Hala', 'Lina', 'Dana', 'Yara'], homme: ['Omar', 'Ahmad', 'Khalil', 'Rami', 'Tarek', 'Fadi', 'Ziad', 'Hassan'] },
  persan: { femme: ['Shirin', 'Maryam', 'Parisa', 'Niloufar', 'Sara', 'Yasaman'], homme: ['Reza', 'Ali', 'Dariush', 'Kian', 'Arash', 'Behnam'] },
  turc: { femme: ['Elif', 'Zeynep', 'Ayşe', 'Merve', 'Esra', 'Defne'], homme: ['Mehmet', 'Emre', 'Can', 'Burak', 'Murat', 'Kerem'] },
  'est-asie': { femme: ['Mei', 'Lin', 'Yuki', 'Ji-woo', 'Hana', 'Xiaoling', 'Min-ji', 'Sakura', 'Jing', 'Aiko'], homme: ['Wei', 'Hiroshi', 'Min-jun', 'Kenji', 'Jun', 'Hao', 'Takumi', 'Seo-jun', 'Chen', 'Daniel'] },
  'sud-est-asie': { femme: ['Linh', 'Mai', 'Siti', 'Nur', 'Maria', 'Ploy', 'Thao', 'Ayu'], homme: ['Minh', 'Joshua', 'Arif', 'Somchai', 'Tuan', 'Rizal', 'Budi', 'Nam'] },
  'sud-asie': { femme: ['Priya', 'Aisha', 'Ananya', 'Simran', 'Fatima', 'Kavya', 'Nisha', 'Deepa'], homme: ['Arjun', 'Rahul', 'Imran', 'Vikram', 'Ravi', 'Sanjay', 'Aditya', 'Farhan'] },
  antilles: { femme: ['Maëva', 'Ketty', 'Océane', 'Laetitia', 'Nadège', 'Gwladys'], homme: ['Teddy', 'Kévin', 'Loïc', 'Mickaël', 'Joël', 'Willy'] },
  caraibes: { femme: ['Shanice', 'Kerry-Ann', 'Simone', 'Tanesha', 'Monique', 'Sasha'], homme: ['Andre', 'Damion', 'Kemar', 'Ricardo', 'Shane', 'Delroy'] },
  'afro-am': { femme: ['Keisha', 'Jasmine', 'Aaliyah', 'Tanisha', 'Imani', 'Brianna'], homme: ['Jamal', 'Marcus', 'Andre', 'Tyrone', 'Darnell', 'Malik'] },
  'latino-metis': { femme: ['María', 'Guadalupe', 'Valentina', 'Camila', 'Lucía', 'Daniela'], homme: ['José', 'Carlos', 'Luis', 'Miguel', 'Diego', 'Javier'] },
  autochtone: { femme: ['Citlali', 'Nayeli', 'Itzel', 'Sisa', 'Killa', 'Ayelen'], homme: ['Inti', 'Amaru', 'Yaotl', 'Tonatiuh', 'Lautaro', 'Kusi'] },
  'afro-bresil': { femme: ['Luana', 'Thaís', 'Jéssica', 'Raíssa', 'Ana', 'Francisca'], homme: ['Thiago', 'Wesley', 'Anderson', 'João', 'Rafael', 'Jefferson'] },
  'europe-ouest': { femme: ['Sophie', 'Emma', 'Julia', 'Anna', 'Laura', 'Claire'], homme: ['Thomas', 'Lukas', 'Pierre', 'Jan', 'Paul', 'Max'] },
  'europe-nord': { femme: ['Astrid', 'Ingrid', 'Freya', 'Saga', 'Linnea', 'Elin'], homme: ['Erik', 'Lars', 'Magnus', 'Oskar', 'Anders', 'Johan'] },
  'europe-sud': { femme: ['Giulia', 'Lucía', 'Maria', 'Sofia', 'Elena', 'Chiara'], homme: ['Marco', 'Javier', 'Giorgos', 'João', 'Luca', 'Andrea'] },
  'europe-est': { femme: ['Olga', 'Natalia', 'Kasia', 'Irina', 'Ewa', 'Daria'], homme: ['Piotr', 'Ivan', 'Andriy', 'Tomasz', 'Dmitri', 'Pavel'] },
  pacifique: { femme: ['Moana', 'Leilani', 'Mere', 'Sina', 'Losana', 'Tiare'], homme: ['Tane', 'Sione', 'Manaia', 'Ioane', 'Tavita', 'Malakai'] },
}
/** A Sikh's first name, his turban on. */
const SIKH = { femme: ['Harpreet', 'Simranjit', 'Jaspreet', 'Manpreet'], homme: ['Gurpreet', 'Harjit', 'Manpreet', 'Jaspreet', 'Amandeep', 'Simranjit'] }
const DIASPORA_NAMES = new Set(Object.values(GROUP_NAMES).flatMap((n) => [...n.femme, ...n.homme]))

/**
 * The first names a passer-by is called by: a people named by its own (its `*`), else the country's (`own`,
 * world3d/talk.ts), without those of the peoples that have their own (when enough are left). Null: the country's as always.
 */
export function namesFor(gender: 'femme' | 'homme', look: { peuple?: string; hair?: string } | undefined, own: string[]): string[] | null {
  const g = look?.peuple
  if (!g) return null
  if (look?.hair === 'turban') return SIKH[gender]
  const m = mixHere()
  const entry = m?.find((e) => e.group === g)
  if (entry?.own && GROUP_NAMES[g]) return GROUP_NAMES[g][gender]
  const left = own.filter((n) => !DIASPORA_NAMES.has(n))
  return left.length >= 4 ? left : null
}
