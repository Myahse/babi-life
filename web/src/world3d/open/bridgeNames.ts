// Abidjan's big bridges, recognised by the name the map gives them, with the
// name everyone calls them by and how each is built (for the 3D world).

export type BridgeKind = 'fhb' | 'cdg' | 'hkb' | 'yop' | 'ado'

/** Which of the big bridges a road's map name is, if any. */
export function bridgeKind(name?: string): BridgeKind | null {
  if (!name) return null
  const n = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  // A bridge, not the boulevard named after the same man: the name says « pont ».
  if (!/\bpont\b/.test(n) && !/\bhkb\b/.test(n)) return null
  if (n.includes('konan bedie') || n.includes('konan-bedie') || /\bhkb\b/.test(n)) return 'hkb'
  if (n.includes('alassane ouattara') || n.includes('alassane-ouattara')) return 'ado'
  if (n.includes('gaulle')) return 'cdg'
  if (n.includes('houphouet')) return 'fhb'
  if (n.includes('4e pont') || n.includes('4eme pont') || n.includes('quatrieme pont')) return 'yop'
  return null
}

/** The name on the bridge's label. */
export const BRIDGE_LABEL: Record<BridgeKind, string> = {
  fhb: '1er pont · FHB',
  cdg: '2e pont · De Gaulle',
  hkb: '3e pont · HKB',
  yop: '4e pont',
  ado: '5e pont · Alassane-Ouattara',
}

/**
 * How each one stands on the lagoon: the distance between its piers and their
 * kind. FHB: 8 spans of 46.5 m, a prestressed box girder, the railway on a
 * lower level under the road (Structurae). HKB: 30 spans of 50 m, twin box
 * girders on one crosshead carried by two round 2 m piles (Bouygues / AFGC).
 * The 5e pont's viaducts and the 2e and 4e ponts: no published detail found,
 * so their spans and piers are estimates.
 */
export const BRIDGE_BUILD: Record<BridgeKind | 'default', { span: number; pier: 'wall' | 'twin-round' | 'twin-square' | 'round'; girder: number; rail?: boolean; twin?: boolean }> = {
  default: { span: 30, pier: 'wall', girder: 0.9 },
  fhb: { span: 46.5, pier: 'wall', girder: 2.6, rail: true },
  cdg: { span: 40, pier: 'twin-square', girder: 1.8 },
  hkb: { span: 50, pier: 'twin-round', girder: 2.2, twin: true },
  yop: { span: 40, pier: 'round', girder: 1.8 },
  ado: { span: 40, pier: 'round', girder: 1.6 },
}
