import { hash, type XZ } from './geo'

// Which kind of tower a tall building is (towers.ts), worked out the same way for the near chunks
// (towers.ts addTower) and for the horizon's blocks (tiles.ts farBlockOf, OpenWorld's FarBlocks), so
// the skyline seen from across the lagoon is the towers one meets up close. Its own small module: the
// map's parser (tiles.ts) reads it without pulling in the buildings' builders.

/** From this height (m) a building is a tower. */
export const TOWER_FROM = 30

export const TOWER_KINDS = ['verre', 'grille', 'gradins', 'couronne', 'ailettes'] as const
export type TowerKind = (typeof TOWER_KINDS)[number]

/** Glass tints (the vertex colour over the curtain wall): blue, bronze, silver, green, teal. */
export const TOWER_GLASS = ['#86aed2', '#c49a70', '#d5dde4', '#8fbfae', '#78a3c4', '#a9bfd6']
export const TOWER_CONCRETE = ['#f4f1ea', '#ecebe6', '#efe6d6']

/**
 * A tower's kind from where it stands (`c`, the outline's middle), its height and its outline's box
 * (`minSide`: its narrower side, `rectLike`: whether it fills its box). Null: too narrow for a tower.
 */
export function towerKind(c: XZ, H: number, minSide: number, rectLike: boolean): TowerKind | null {
  if (minSide < 9) return null
  const r = hash(c[0] * 41, c[1] * 43, 7)
  let kind: TowerKind = H >= 54 && r < 0.3 ? 'couronne' : r < 0.5 ? 'verre' : r < 0.7 ? 'grille' : r < 0.85 ? 'gradins' : 'ailettes'
  if (H < 36 && kind !== 'grille') kind = r < 0.6 ? 'grille' : 'ailettes'
  if (kind === 'gradins' && (!rectLike || minSide < 18)) kind = 'verre'
  return kind
}

/** Which of the tints a tower's walls take (glass or concrete, by its kind). */
export const towerTint = (c: XZ, kind: TowerKind) => (kind !== 'grille' ? Math.floor(hash(c[1] * 5, c[0] * 3, 9) * TOWER_GLASS.length) : Math.floor(hash(c[0], c[1], 11) * TOWER_CONCRETE.length))
