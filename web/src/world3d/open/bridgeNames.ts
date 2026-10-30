import { t } from '../../lib/i18n'
// Abidjan's big bridges, recognised by the name the map gives them, with the
// name everyone calls them by and how each is built (for the 3D world).

export type BridgeKind = 'fhb' | 'cdg' | 'hkb' | 'yop' | 'ado'

/** Lower case, no accents, « 4ᵉ » read as « 4e ». */
const fold = (name: string) => name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/**
 * The map sometimes names a big bridge's roadway after the boulevard it
 * carries (« Boulevard Aimé Henri Konan Bédié » for the 3e pont's deck),
 * the bridge's name going to its footway. A long bridge (250 m and more,
 * no small bridge over a drain) named after one of the big bridges' men is
 * that bridge: it gets the bridge's own name. Only seen for the 3e pont.
 */
export function bigBridgeName(name: string | undefined, length: number): string | undefined {
  if (!name || bridgeKind(name) || length < 250) return name
  const n = fold(name)
  if (n.includes('konan bedie') || n.includes('konan-bedie')) return t('Pont Henri-Konan-Bédié')
  // Not the other boulevards: the one named after Houphouët-Boigny crosses
  // viaducts that aren't the 1er pont.
  return name
}

/** Which of the big bridges a road's map name is, if any. */
export function bridgeKind(name?: string): BridgeKind | null {
  if (!name) return null
  const n = fold(name)
  // A bridge, not the boulevard named after the same man: the name says « pont ».
  if (!/\bpont\b/.test(n) && !/\bhkb\b/.test(n)) return null
  if (n.includes('konan bedie') || n.includes('konan-bedie') || /\bhkb\b/.test(n)) return 'hkb'
  if (n.includes('alassane ouattara') || n.includes('alassane-ouattara')) return 'ado'
  if (n.includes('gaulle')) return 'cdg'
  if (n.includes('houphouet')) return 'fhb'
  if (n.includes('4e pont') || n.includes('4eme pont') || n.includes('quatrieme pont')) return 'yop'
  return null
}

/**
 * How high a bridge's deck goes. The big lagoon bridges and the small ones:
 * 8 m. A big road's bridge that isn't one of them is a flyover over a
 * crossroads, like the Solibra interchange (Shinzo Abe, 17 to 20 m, AIP /
 * Fratmat): 14 m here, so the roads under it pass with room to spare. From
 * the road's class and name only, so every piece of it agrees.
 */
export const FLYOVER_HEIGHT = 14
export function deckTop(cls: string, name?: string) {
  return !bridgeKind(name) && ['motorway', 'trunk', 'primary'].includes(cls) ? FLYOVER_HEIGHT : 8
}

/** The name on the bridge's label. */
export const BRIDGE_LABEL: Record<BridgeKind, string> = {
  fhb: t('1er pont · FHB'),
  cdg: t('2e pont · De Gaulle'),
  hkb: t('3e pont · HKB'),
  yop: t('4e pont'),
  ado: t('5e pont · Alassane-Ouattara'),
}

/**
 * How each one stands on the lagoon: the distance between its piers and their
 * kind. FHB: 8 spans of 46.5 m, a prestressed box girder, the railway on a
 * lower level under the road (Structurae). HKB: 30 spans of 50 m, twin box
 * girders on one crosshead carried by two round 2 m piles (Bouygues / AFGC).
 * The 5e pont's viaducts and the 2e and 4e ponts: no published detail found,
 * so their spans and piers are estimates.
 */
export type BridgeBuild = {
  span: number
  pier: 'wall' | 'twin-round' | 'twin-square' | 'round'
  girder: number
  /** The FHB: the railway on a lower level, inside the girder. */
  rail?: boolean
  /** The HKB: two box girders side by side. */
  twin?: boolean
  /** Precast beams under the deck (the 2e pont), not one box. */
  beams?: boolean
  /** A barrier down the middle between the two directions. */
  median?: boolean
  /** Lamp posts along the deck, every so many metres. */
  lamps?: number
  /** Light studs along the edges (the 2e pont and the FHB). */
  studs?: boolean
  /** The deck's width (m), when it's known (else the road's). */
  width?: number
  /** Lanes each way. */
  lanes: number
}

/**
 * FHB: 24.85 m wide, 14 m of road and two 4 m pavements (Structurae); light
 * studs added on it and on the 2e pont (Abidjan.net). HKB: 28 m, 2×3 lanes
 * (Burkina24). 4e pont: 2×3 lanes (afrique-sur7). Lamp spacing, the medians
 * and the 2e and 5e ponts' widths are estimates.
 */
export const BRIDGE_BUILD: Record<BridgeKind | 'default', BridgeBuild> = {
  default: { span: 30, pier: 'wall', girder: 0.9, lanes: 1 },
  // The box must hold the train: its depth here is an estimate.
  fhb: { span: 46.5, pier: 'wall', girder: 5.4, rail: true, studs: true, lamps: 31, width: 24.85, lanes: 2 },
  cdg: { span: 40, pier: 'twin-square', girder: 1.8, beams: true, studs: true, lamps: 30, width: 21, lanes: 2 },
  hkb: { span: 50, pier: 'twin-round', girder: 2.2, twin: true, median: true, lamps: 40, width: 28, lanes: 3 },
  yop: { span: 40, pier: 'round', girder: 1.8, median: true, lamps: 36, width: 27, lanes: 3 },
  ado: { span: 40, pier: 'round', girder: 1.6, median: true, lamps: 36, width: 26, lanes: 3 },
}
