import { DEFAULT_LOOK } from '../avatar/options'
import type { Look } from '../lib/types'

// Awa and Keke as « Samedi, c'est paiya ! » shows them (marketing/scripts/samedi-paiya.md):
// at home first (Awa's braids and kente, Keke's cap and Éléphants jersey), then dressed for the night.

const L = (look: Partial<Look>): Look => ({ ...DEFAULT_LOOK, ...look })

export const AWA_HOME = L({ skin: '#8a5532', hair: 'braids', hairColor: '#24160e', outfit: 'jupe', outfitColor: '#12a37a', pattern: 'kente', accessory: 'earrings,beads,watch,bag' })
/** The gold bazin dress, her jewels. */
export const AWA_NIGHT = L({ skin: '#8a5532', hair: 'braids', hairColor: '#24160e', outfit: 'robe', outfitColor: '#d9a521', accessory: 'earrings,beads,watch,bag', accessoryColor: '#f2c94c' })
export const KEKE_HOME = L({ skin: '#6e4024', hair: 'degrade', outfit: 'jersey', outfitColor: '#ff8200', accessory: 'capback,chain', accessoryColor: '#ff7a00' })
/** White bazin, the gold chain, sunglasses (at night, of course). */
export const KEKE_NIGHT = L({ skin: '#6e4024', hair: 'degrade', outfit: 'bazin', outfitColor: '#f8f9fa', accessory: 'chain,sunglasses', accessoryColor: '#f2c94c' })

export const PAIYA_LOOKS: Record<string, { look: Look; gender: 'femme' | 'homme' }> = {
  'awa-home': { look: AWA_HOME, gender: 'femme' },
  'awa-night': { look: AWA_NIGHT, gender: 'femme' },
  'keke-home': { look: KEKE_HOME, gender: 'homme' },
  'keke-night': { look: KEKE_NIGHT, gender: 'homme' },
}
