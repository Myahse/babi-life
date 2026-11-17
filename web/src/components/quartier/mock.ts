import { api } from '../../lib/api'
import type { HubView, QuartierBuilding, QuartierView } from '../../world3d/quartier/types'
import type { QuartierArea } from '../../lib/types'
import { presetForCommune } from '../../world3d/quartier/univers/presets'

// A stand-in for the quartier's server (development: /jeu?quartierMock), so the world, the HUD, the hub and
// the visits can be played before the server's side is there. Kept in the tab (sessionStorage) once asked.

const KEY = 'babi.quartierMock'

export function quartierMockOn(): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (new URLSearchParams(location.search).has('quartierMock')) sessionStorage.setItem(KEY, '1')
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/** Where the mock's quartiers stand: round the commune the Sim is in (set by the game's screen). */
export const mockHint = { commune: 'cocody', lat: 5.36, lng: -3.99 }

const M = 1 / 111320
const at = (lat: number, lng: number, east: number, north: number) => ({ lat: lat + north * M, lng: lng + (east * M) / Math.cos((lat * Math.PI) / 180) })

const mine = new Map<string, QuartierView>()

function building(id: number, kind: string, slot: number, c: { lat: number; lng: number }, east: number, north: number, extra: Partial<QuartierBuilding> = {}): QuartierBuilding {
  return { id, kind, label: kind, icon: 'store', slot, ...at(c.lat, c.lng, east, north), heading: Math.atan2(-east, -north), level: 1, opened: true, staff: 1, perDay: 3200, pending: 4800, ...extra }
}

export function mockQuartier(simId: string): QuartierView {
  const had = mine.get(simId)
  if (had) return had
  const c = { lat: mockHint.lat, lng: mockHint.lng }
  const v = {
    owner: simId,
    name: 'Mon quartier',
    commune: mockHint.commune,
    center: c,
    radius: 300,
    level: 2,
    reputation: 120,
    next: { level: 3, reputation: 300 },
    buildings: [building(1, 'maison', 0, c, ...lotSpot(0), { perDay: 0, pending: 0 }), building(2, 'boutique', 1, c, ...lotSpot(1)), building(3, 'maquis', 2, c, ...lotSpot(2), { perDay: 5200, pending: 7400 })],
    unlocks: [
      { kind: 'salon', level: 2, price: 180000, locked: false },
      { kind: 'cabine', level: 2, price: 60000, locked: false },
      { kind: 'terrain', level: 3, price: 400000, locked: true },
    ],
    todo: { id: 'open-salon', text: 'Ouvre ton salon de coiffure au carrefour', target: at(c.lat, c.lng, ...lotSpot(3)), kind: 'build', lot: 3 },
    lots: Array.from({ length: 30 }, (_, i) => ({ lot: i, ...at(c.lat, c.lng, ...lotSpot(i)), heading: 0, building: i < 3 ? i + 1 : 0 })),
    visitsMode: 'tous',
    univers: { seed: 4242, preset: presetForCommune(mockHint.commune), variant: 0, variants: 3, chosen: false },
  } as unknown as QuartierView
  mine.set(simId, v)
  return v
}

/** The layout picked in the mock (POST quartier/univers). */
export function mockPick(simId: string, variant: number) {
  const v = mockQuartier(simId)
  if (v.univers) v.univers = { ...v.univers, variant, chosen: true }
}

/** Where the mock's buildings sit round its anchor (metres east and north): only their lot's number matters, the world lays them out (world3d/quartier/univers/gen.ts). */
export function lotSpot(lot: number): [number, number] {
  const rings = [
    [6, 75],
    [10, 185],
    [14, 310],
  ]
  let i = lot
  let ring = 0
  while (ring < rings.length - 1 && i >= rings[ring][0]) ((i -= rings[ring][0]), ring++)
  const [n, r0] = rings[ring]
  const a = ((i + 0.5 * (ring % 2)) * 2 * Math.PI) / n + 0.35 * ring
  const r = r0 + 16 * Math.sin(lot * 2.399)
  return [r * Math.cos(a), r * Math.sin(a)]
}

/** The neighbourhood round a quartier: Bintou's quartier and two players' homes. */
export function mockArea(owner: string): QuartierArea {
  const b = mockPublic('mock-bintou')
  return {
    center: { lat: mockHint.lat, lng: mockHint.lng },
    radius: 600,
    quartiers: owner === 'mock-bintou' ? [] : [{ owner: 'mock-bintou', ownerName: 'Bintou', name: b.name, level: b.level, center: b.center, friend: true, mine: false, locked: false, buildings: b.buildings }],
    homes: [
      { owner: 'mock-yao', ownerName: 'Yao', ...at(mockHint.lat, mockHint.lng, 220, -160), friend: false, mine: false },
      { owner: 'mock-awa', ownerName: 'Awa', ...at(mockHint.lat, mockHint.lng, -260, -90), friend: true, mine: false },
    ],
  }
}

export function mockPublic(owner: string): QuartierView {
  const c = at(mockHint.lat, mockHint.lng, -140, 120)
  return ({
    owner,
    ownerName: 'Bintou',
    name: 'Quartier Bintou',
    commune: mockHint.commune,
    center: c,
    radius: 300,
    level: 4,
    reputation: 820,
    buildings: [building(11, 'maquis', 0, c, 30, 10), building(12, 'boutique', 1, c, -40, 20), building(13, 'pharmacie', 2, c, 10, -50)],
    visitsMode: 'tous',
    univers: { seed: 777, preset: presetForCommune(mockHint.commune), variant: 1, variants: 3, chosen: true },
  } as unknown) as QuartierView
}

export function mockHub(): HubView {
  return {
    online: 412,
    communes: [
      { commune: 'plateau', name: 'Plateau', online: 86, highlights: ['Pyramide', 'Tour F', 'bureaux'] },
      { commune: 'treichville', name: 'Treichville', online: 74, highlights: ['Rue 12', 'Palais des sports'] },
      { commune: 'yopougon', name: 'Yopougon', online: 121, highlights: ['Rue Princesse ce soir'] },
      { commune: 'cocody', name: 'Cocody', online: 58, highlights: ['Riviera', 'Université'] },
    ],
    events: [{ title: 'Match au stade FHB', at: new Date(Date.now() + 3 * 3600_000).toISOString(), commune: 'plateau', kind: 'match', count: 38 }],
  }
}

/** The quartier's calls as the game's screen makes them: the server's (lib/api.ts), or the mock's in development. */
export const quartierApi = {
  quartier: (id: string) => (quartierMockOn() ? Promise.resolve(mockQuartier(id)) : api.quartier(id)),
  quartierPublic: (owner: string) => (quartierMockOn() ? Promise.resolve(mockPublic(owner)) : api.quartierPublic(owner)),
  quartierVisit: (id: string, owner: string) => (quartierMockOn() ? Promise.resolve(mockPublic(owner)) : api.quartierVisit(id, owner)),
  quartierHub: () => (quartierMockOn() ? Promise.resolve(mockHub()) : api.quartierHub()),
  quartierArea: (owner: string) => (quartierMockOn() ? Promise.resolve(mockArea(owner)) : api.quartierArea(owner)),
}
