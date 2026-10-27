import { hasAcc, toggleAccessory } from '../avatar/options'
import type { ClothingPiece, Look } from './types'

// The boutiques' pieces (backend game/clothes.go): what one puts on.

/** The look with the piece on: a whole outfit replaces the outfit, an accessory joins the others. */
export function wearPiece(look: Required<Look>, p: ClothingPiece): Required<Look> {
  if (p.kind === 'accessoire') {
    const accessory = hasAcc(look, p.accessory!) ? look.accessory : toggleAccessory(look.accessory, p.accessory!)
    return { ...look, accessory, accessoryColor: p.accessoryColor || look.accessoryColor }
  }
  return { ...look, outfit: p.outfit!, outfitColor: p.outfitColor || look.outfitColor, pattern: p.pattern || look.pattern, bottomColor: p.bottomColor ?? '', shoeColor: p.shoeColor || look.shoeColor }
}

/** Is the Sim wearing it now? */
export function wearing(look: Look, p: ClothingPiece) {
  if (p.kind === 'accessoire') return hasAcc(look, p.accessory!) && (!p.accessoryColor || look.accessoryColor === p.accessoryColor)
  return look.outfit === p.outfit && look.outfitColor === p.outfitColor && (!p.pattern || look.pattern === p.pattern)
}

/** The pieces this Sim can wear (the men's shops don't sell it a dress). */
export const forGender = (pieces: ClothingPiece[], gender: 'femme' | 'homme') => pieces.filter((p) => !p.gender || p.gender === gender)

/** The shops where pieces are bought, by the activity done there (backend game.ShopOf). */
export const SHOP_OF: Record<string, ClothingPiece['shop']> = { 'boutique-mode': 'mall', 'boutique-wax': 'marche' }
