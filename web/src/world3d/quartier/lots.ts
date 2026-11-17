import type { Commune, Place, QuartierArea, QuartierView, World } from '../../lib/types'
import { openAt } from '../../game/rules'
import { t as tr } from '../../lib/i18n'
import { rng } from '../themes'
import { toLatLng, toLocal, type Origin, type XZ } from '../open/geo'
import type { QLot } from './store'

// « Mon quartier »'s lots (update « mon-quartier »): everything the quartier's view marks, as lots one plays one
// at a time: the home, one's own buildings and free lots (the server's lots, game.QuartierLotSpot), the commune's
// places round the home (maquis, boutiques, grins, the school, the church or the mosque, the terrain, the
// pharmacy, the market…), and the other players' quartiers and homes there (GET /quartiers/{id}/area).
// Free lots are set on a real street front from the map (snapLots), the same on every phone.

/** A place inside another (a club of the Rue Princesse) or the game's own spots aren't lots. */
const NOT_LOTS = new Set(['home', 'plot', 'zone', 'happening', 'soiree'])
/** The places with nothing to do on their own in the view (bus stops, the map's unnamed bits). */
const MINOR = new Set(['bus-stop', 'arret', 'woro', 'gbaka-stop', 'taxi'])
/** The commune's places the view marks at most: fewer on a weak phone. */
export const MAX_PLACES = 48
export const MAX_PLACES_LIGHT = 24
/** Of one kind at most (the map has a hundred boutiques round a home in Yopougon): the rest of the kinds get a place too. */
const PER_KIND = 5
/** The kinds a quartier is made of first (the maquis, the boutique, the grin, the school, the church or mosque, the terrain, the pharmacy, the market…). */
const FIRST = ['maquis', 'boutique', 'grin', 'school', 'worship', 'church', 'mosque', 'field', 'pitch', 'sport', 'pharmacie', 'market', 'salon', 'barbier', 'health', 'restaurant', 'couture', 'club']
/** Free lots shown (the nearest), besides the one « À faire maintenant » points to: the rest are built on later. */
const FREE_SHOWN = 6

/** Where the home is in the street when it hasn't been drawn yet (OpenWorld homeSpot / lotSpot: the same draw). */
export function homeGuess(world: World, sim: { id: string; city: string; homeCity: string; homeCommune: string; housing: string }, center: { lat: number; lng: number }): { lat: number; lng: number } {
  const c = world.cities.find((x) => x.id === sim.homeCity)?.communes.find((x) => x.id === sim.homeCommune)
  if (!c) return center
  // The server's centre is the home's lot where it was set on the map; else the commune's centre, and the street
  // draws the home from the Sim's id.
  if (Math.abs(center.lat - c.lat) > 1e-5 || Math.abs(center.lng - c.lng) > 1e-5) return center
  const own = sim.housing === 'maison'
  const r = rng(own ? `lot${sim.id}` : `home${sim.id}`)
  const a = r() * Math.PI * 2
  const d = own ? 140 + r() * 300 : 120 + r() * 260
  return toLatLng({ lat: c.lat, lng: c.lng }, [Math.cos(a) * d, Math.sin(a) * d])
}

/** The way a building's or place's kind is said in the view. */
const kindLabel = (world: World, kind: string) => world.kinds[kind]?.label ?? kind

/** Open now: one of its kind's actions is (and it isn't shut). */
export function placeOpen(world: World, p: Place, gameMinutes: number): boolean {
  if (p.closed) return false
  const k = world.kinds[p.kind]
  if (!k?.interactions.length) return true
  return k.interactions.some((it) => openAt(it, gameMinutes))
}

export type LotsInput = {
  world: World
  commune: Commune
  /** The quartier shown (one's own: the owner's view; a visit: the public one). */
  view: QuartierView
  visiting: boolean
  /** Where its home is in the street (one's own: as the street draws it; a visit: the quartier's centre). The
   * quartier itself is centred where the server has it (backend game.StreetHome: the same home, drawn alike). */
  home: { lat: number; lng: number }
  area: QuartierArea | null
  /** The places of the street besides the commune's (the map's, the quartier's own). */
  extra?: Place[]
  /** The lot « À faire maintenant » points to (shown even if free and far). */
  todoLot?: number
  gameMinutes: number
  radius: number
  maxPlaces: number
}

/** Every lot of the quartier's view, in the street's lat/lng. */
export function buildLots({ world, commune, view, visiting, home, area, extra = [], todoLot, gameMinutes, radius, maxPlaces }: LotsInput): QLot[] {
  const o: Origin = view.center
  const out: QLot[] = []
  const who = view.ownerName || view.name
  out.push({ id: 'home', kind: 'home', lat: home.lat, lng: home.lng, heading: 0, name: visiting ? tr('Chez {0}', { 0: who }) : tr('Chez toi'), what: visiting ? tr('Sa maison') : tr('Ta maison'), icon: 'house', owner: view.owner, ownerName: view.ownerName, level: view.level })
  // One's own lots: the server's (built or free); a visit: its buildings.
  const lots = !visiting && view.lots?.length ? view.lots : view.buildings.map((b) => ({ lot: b.slot, lat: b.lat, lng: b.lng, heading: b.heading, building: b.id }))
  let free = 0
  for (const l of lots) {
    const b = l.building ? view.buildings.find((x) => x.id === l.building) : undefined
    const { lat, lng } = l
    if (b) {
      const label = b.label || kindLabel(world, b.kind)
      out.push({ id: `lot:${l.lot}`, kind: visiting ? 'player' : 'mine', lat, lng, heading: l.heading, name: label, what: visiting ? tr('Chez {0}', { 0: who }) : tr('À toi · niveau {0}', { 0: b.level }), icon: b.icon || 'store', owner: view.owner, ownerName: view.ownerName, level: b.level, open: b.opened && (!b.staffMax || b.staff > 0), placeId: `quartier:${b.id}`, slot: l.lot, buildingId: b.id })
    } else if (!visiting && (free++ < FREE_SHOWN || l.lot === todoLot)) out.push({ id: `lot:${l.lot}`, kind: 'free', lat, lng, heading: l.heading, name: tr('Terrain libre'), what: tr('Construire ici'), icon: 'hammer', slot: l.lot })
  }
  // The commune's places round the home: a few of each kind, spread from near to far, the quartier's kinds first.
  const seen = new Set<string>()
  const byKind = new Map<string, { p: Place; d: number }[]>()
  for (const p of [...commune.places, ...extra]) {
    if (p.parent || NOT_LOTS.has(p.kind) || MINOR.has(p.kind) || p.id.startsWith('quartier:') || !world.kinds[p.kind] || seen.has(p.id)) continue
    seen.add(p.id)
    const d = Math.hypot(...toLocal(o, p.lat, p.lng))
    if (d > radius) continue
    const list = byKind.get(p.kind) ?? []
    list.push({ p, d })
    byKind.set(p.kind, list)
  }
  const rank = (k: string) => (FIRST.includes(k) ? FIRST.indexOf(k) : FIRST.length)
  const places: { p: Place; d: number }[] = []
  for (const [, list] of [...byKind].sort((a, b) => rank(a[0]) - rank(b[0]))) {
    list.sort((a, b) => a.d - b.d)
    const n = Math.min(PER_KIND, list.length)
    for (let i = 0; i < n; i++) places.push(list[Math.floor((i * list.length) / n)])
  }
  places.length = Math.min(places.length, maxPlaces)
  for (const { p } of places) out.push({ id: `place:${p.id}`, kind: 'place', lat: p.lat, lng: p.lng, heading: 0, name: p.name || kindLabel(world, p.kind), what: kindLabel(world, p.kind), icon: world.kinds[p.kind]?.icon ?? 'map-pin', open: placeOpen(world, p, gameMinutes), placeId: p.id })
  // The other players round it: their quartiers' buildings (a friends-only one, its name alone) and their homes.
  for (const q of area?.quartiers ?? []) {
    if (q.owner === view.owner) continue
    if (q.locked || !q.buildings.length) {
      if (Math.hypot(...toLocal(o, q.center.lat, q.center.lng)) <= radius) out.push({ id: `q:${q.owner}`, kind: 'player', lat: q.center.lat, lng: q.center.lng, heading: 0, name: q.name, what: q.locked ? tr('Amis seulement') : tr('Quartier de {0}', { 0: q.ownerName }), icon: 'building-2', owner: q.owner, ownerName: q.ownerName, level: q.level, friend: q.friend, locked: q.locked })
      continue
    }
    for (const b of q.buildings) out.push({ id: `b:${q.owner}:${b.id}`, kind: 'player', lat: b.lat, lng: b.lng, heading: b.heading, name: b.label || kindLabel(world, b.kind), what: tr('Chez {0}', { 0: q.ownerName }), icon: b.icon || 'store', owner: q.owner, ownerName: q.ownerName, level: b.level, open: b.opened, friend: q.friend, slot: b.slot, buildingId: b.id })
  }
  for (const h of area?.homes ?? []) {
    if (h.owner === view.owner) continue
    out.push({ id: `home:${h.owner}`, kind: 'player-home', lat: h.lat, lng: h.lng, heading: 0, name: tr('Maison de {0}', { 0: h.ownerName }), what: h.friend ? tr('Ton ami·e') : tr('Un joueur'), icon: 'house', owner: h.owner, ownerName: h.ownerName, friend: h.friend })
  }
  return spread(out, o)
}

/** Two lots on top of each other (a place on a player's home) are set a little apart, so both can be tapped. */
function spread(lots: QLot[], o: Origin): QLot[] {
  const at = lots.map((l) => toLocal(o, l.lat, l.lng))
  for (let i = 0; i < lots.length; i++)
    for (let j = 0; j < i; j++) {
      const dx = at[i][0] - at[j][0]
      const dz = at[i][1] - at[j][1]
      const d = Math.hypot(dx, dz)
      if (d >= 14) continue
      const a = d > 0.01 ? Math.atan2(dz, dx) : (i * 2.4) % (Math.PI * 2)
      at[i] = [at[j][0] + Math.cos(a) * 14, at[j][1] + Math.sin(a) * 14]
      const ll = toLatLng(o, at[i])
      lots[i] = { ...lots[i], lat: ll.lat, lng: ll.lng }
    }
  return lots
}

/** The streets a free lot may stand along (not the motorway, not a footpath). */
export const SNAP_ROADS = 5

/**
 * Free lots set on a real street front: the nearest street within reach of the lot's place (segments
 * [ax, az, bx, bz, width] in metres round `o`), the lot a few metres back from its edge on the lot's side, facing
 * it. Never onto another lot. The server keeps it if it's near enough (game.LotSnap).
 */
export function snapLots(lots: QLot[], segs: Float32Array, o: Origin, reach = 55): QLot[] {
  const taken: XZ[] = lots.filter((l) => l.kind !== 'free').map((l) => toLocal(o, l.lat, l.lng))
  return lots.map((l) => {
    if (l.kind !== 'free') return l
    const [px, pz] = toLocal(o, l.lat, l.lng)
    let best: { x: number; z: number; nx: number; nz: number; w: number; d: number } | null = null
    for (let i = 0; i < segs.length; i += SNAP_ROADS) {
      const ax = segs[i]
      const az = segs[i + 1]
      const bx = segs[i + 2]
      const bz = segs[i + 3]
      const w = segs[i + 4]
      const dx = bx - ax
      const dz = bz - az
      const len2 = dx * dx + dz * dz
      if (len2 < 1) continue
      const k = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2))
      const x = ax + dx * k
      const z = az + dz * k
      const d = Math.hypot(px - x, pz - z)
      if (d > reach || (best && d >= best.d)) continue
      const len = Math.sqrt(len2)
      // The side of the street the lot's place is on.
      let nx = -dz / len
      let nz = dx / len
      if ((px - x) * nx + (pz - z) * nz < 0) ((nx = -nx), (nz = -nz))
      best = { x, z, nx, nz, w, d }
    }
    if (!best) return l
    const back = best.w / 2 + 9
    const at: XZ = [best.x + best.nx * back, best.z + best.nz * back]
    if (taken.some((q) => Math.hypot(q[0] - at[0], q[1] - at[1]) < 26)) return l
    taken.push(at)
    const ll = toLatLng(o, at)
    // Facing the street: its heading in the server's terms (east, north), towards the road.
    return { ...l, lat: ll.lat, lng: ll.lng, heading: Math.atan2(-best.nx, best.nz), snapped: true }
  })
}
