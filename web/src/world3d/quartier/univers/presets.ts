// « Mon quartier »'s own worlds (update « mon-quartier », gen.ts): the style of each commune's quartiers, as the
// server names them (backend game/univers.go UniversPreset). A world is about 1.1 km across, closed on its four
// sides by what really closes a quartier of Abidjan (the lagoon, the sea's beach, the forest and the hills, the
// motorway on its embankment, the railway, a boulevard with the city beyond); each style has three layouts
// (variants) the player picks from at the first visit. No text here: the names are in names.ts (t()).

/** What closes a side: water, a beach and the sea, the forest, the hills, the motorway, the railway, a boulevard with the city beyond. */
export type EdgeKind = 'lagune' | 'mer' | 'foret' | 'colline' | 'autoroute' | 'rail' | 'ville'
/** North, east, south, west (the street's metres: x east, z south). */
export type Sides = [n: EdgeKind, e: EdgeKind, s: EdgeKind, w: EdgeKind]

export type PresetId = 'cocody' | 'yopougon' | 'plateau' | 'marche' | 'marcory' | 'koumassi' | 'abobo' | 'plage' | 'bingerville' | 'rural' | 'ville'

export type Preset = {
  id: PresetId
  /** The three layouts' sides. */
  layouts: [Sides, Sides, Sides]
  /** The main road's and the avenue's class (the street's road classes, tiles.ts: what the game builds along them, fill.ts). */
  main: string
  avenue: string
  /** The side streets' class, and the share of them in laterite (unpaved). */
  side: string
  unpaved: number
  /** Metres between two side streets, and how much they wind. */
  block: number
  wobble: number
  /** Share of the side streets' fronts given to villas in their garden (else the game's houses, fill.ts). */
  villas: number
  /** Towers along the main road and the avenue (the Plateau's), and their height range (m). */
  towers: number
  towerH: [number, number]
  /** Trees along the streets (share of 25 m steps), and palms among them. */
  trees: number
  palms: number
  /** Plots of green between the houses (fields, gardens): share of the side streets' fronts. */
  green: number
  /** The far city: towers of the Plateau seen beyond, the town's blocks, none. */
  skyline: 'plateau' | 'ville' | 'none'
}

const P = (id: PresetId, layouts: [Sides, Sides, Sides], o: Omit<Preset, 'id' | 'layouts'>): Preset => ({ id, layouts, ...o })

export const PRESETS: Record<PresetId, Preset> = {
  cocody: P('cocody', [['foret', 'autoroute', 'lagune', 'ville'], ['colline', 'ville', 'lagune', 'lagune'], ['autoroute', 'lagune', 'lagune', 'foret']], { main: 'secondary', avenue: 'tertiary', side: 'street', unpaved: 0, block: 105, wobble: 14, villas: 0.75, towers: 0, towerH: [0, 0], trees: 0.55, palms: 0.5, green: 0.15, skyline: 'plateau' }),
  yopougon: P('yopougon', [['autoroute', 'ville', 'lagune', 'foret'], ['ville', 'autoroute', 'foret', 'lagune'], ['foret', 'ville', 'autoroute', 'lagune']], { main: 'secondary', avenue: 'tertiary', side: 'street', unpaved: 0.3, block: 68, wobble: 6, villas: 0, towers: 0, towerH: [0, 0], trees: 0.18, palms: 0.3, green: 0.03, skyline: 'plateau' }),
  plateau: P('plateau', [['ville', 'lagune', 'lagune', 'lagune'], ['rail', 'lagune', 'lagune', 'ville'], ['autoroute', 'lagune', 'ville', 'lagune']], { main: 'primary', avenue: 'primary', side: 'secondary', unpaved: 0, block: 115, wobble: 0, villas: 0, towers: 70, towerH: [27, 96], trees: 0.35, palms: 0.4, green: 0.05, skyline: 'none' }),
  marche: P('marche', [['rail', 'autoroute', 'ville', 'lagune'], ['autoroute', 'rail', 'lagune', 'ville'], ['ville', 'rail', 'autoroute', 'ville']], { main: 'primary', avenue: 'secondary', side: 'street', unpaved: 0.1, block: 72, wobble: 3, villas: 0, towers: 4, towerH: [18, 36], trees: 0.15, palms: 0.2, green: 0.02, skyline: 'plateau' }),
  marcory: P('marcory', [['lagune', 'autoroute', 'ville', 'ville'], ['autoroute', 'lagune', 'ville', 'lagune'], ['ville', 'ville', 'lagune', 'autoroute']], { main: 'primary', avenue: 'secondary', side: 'street', unpaved: 0.05, block: 90, wobble: 5, villas: 0.3, towers: 3, towerH: [15, 30], trees: 0.35, palms: 0.4, green: 0.06, skyline: 'plateau' }),
  koumassi: P('koumassi', [['lagune', 'ville', 'autoroute', 'lagune'], ['autoroute', 'lagune', 'lagune', 'ville'], ['lagune', 'autoroute', 'ville', 'ville']], { main: 'secondary', avenue: 'tertiary', side: 'street', unpaved: 0.25, block: 72, wobble: 5, villas: 0.05, towers: 0, towerH: [0, 0], trees: 0.2, palms: 0.45, green: 0.03, skyline: 'plateau' }),
  abobo: P('abobo', [['foret', 'rail', 'ville', 'colline'], ['colline', 'ville', 'rail', 'foret'], ['rail', 'colline', 'autoroute', 'foret']], { main: 'secondary', avenue: 'tertiary', side: 'street', unpaved: 0.45, block: 70, wobble: 9, villas: 0, towers: 0, towerH: [0, 0], trees: 0.2, palms: 0.2, green: 0.06, skyline: 'plateau' }),
  plage: P('plage', [['lagune', 'ville', 'mer', 'autoroute'], ['autoroute', 'ville', 'mer', 'lagune'], ['ville', 'lagune', 'mer', 'foret']], { main: 'secondary', avenue: 'tertiary', side: 'street', unpaved: 0.35, block: 85, wobble: 7, villas: 0.2, towers: 0, towerH: [0, 0], trees: 0.15, palms: 0.85, green: 0.05, skyline: 'ville' }),
  bingerville: P('bingerville', [['colline', 'foret', 'lagune', 'autoroute'], ['foret', 'lagune', 'colline', 'ville'], ['lagune', 'colline', 'foret', 'autoroute']], { main: 'secondary', avenue: 'tertiary', side: 'street', unpaved: 0.3, block: 110, wobble: 22, villas: 0.45, towers: 0, towerH: [0, 0], trees: 0.7, palms: 0.35, green: 0.3, skyline: 'ville' }),
  rural: P('rural', [['foret', 'colline', 'foret', 'autoroute'], ['colline', 'foret', 'lagune', 'foret'], ['autoroute', 'foret', 'colline', 'foret']], { main: 'secondary', avenue: 'track', side: 'track', unpaved: 0.85, block: 130, wobble: 26, villas: 0.1, towers: 0, towerH: [0, 0], trees: 0.6, palms: 0.4, green: 0.45, skyline: 'none' }),
  ville: P('ville', [['foret', 'autoroute', 'colline', 'ville'], ['ville', 'foret', 'autoroute', 'colline'], ['colline', 'ville', 'foret', 'autoroute']], { main: 'secondary', avenue: 'tertiary', side: 'street', unpaved: 0.35, block: 90, wobble: 10, villas: 0.15, towers: 0, towerH: [0, 0], trees: 0.35, palms: 0.35, green: 0.12, skyline: 'ville' }),
}

export const presetOf = (id: string | undefined): Preset => PRESETS[(id as PresetId) ?? 'ville'] ?? PRESETS.ville

/** A commune's style when the server didn't say (the development mock): the server's table (backend game/univers.go). */
const COMMUNES: Record<string, PresetId> = { cocody: 'cocody', yopougon: 'yopougon', plateau: 'plateau', treichville: 'marche', adjame: 'marche', attecoube: 'marche', marcory: 'marcory', koumassi: 'koumassi', abobo: 'abobo', 'port-bouet': 'plage', 'bassam-france': 'plage', 'sp-centre': 'plage', bingerville: 'bingerville', 'man-centre': 'bingerville', anyama: 'rural', songon: 'rural', 'korhogo-centre': 'rural' }
export const presetForCommune = (commune: string): PresetId => COMMUNES[commune] ?? 'ville'
