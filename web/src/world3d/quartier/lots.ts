import type { Place, QuartierArea, QuartierView, World } from '../../lib/types'
import { openAt } from '../../game/rules'
import { t as tr } from '../../lib/i18n'
import type { XZ } from '../open/geo'
import type { QLot } from './store'
import type { Front, UniversInfo } from './univers/gen'
import { universLatLng, type UPlace } from './univers/places'

// « Mon quartier »'s lots (update « mon-quartier »): everything its world's view marks: the home, one's own
// buildings and free lots (the server's numbers, laid out along the world's streets, univers/gen.ts), the world's
// places (the commune's maquis, boutiques, grin, school, church or mosque, terrain, pharmacy, market…,
// univers/places.ts), and the other players of the commune round it (GET /quartiers/{id}/area) as the
// neighbours living in the world's other houses, whose own quartiers one can visit.

/** Free lots shown (the nearest), besides the one « À faire maintenant » points to: the others come next, as they're built on. */
const FREE_SHOWN = 6

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
  /** The quartier shown (one's own: the owner's view; a visit: the public one). */
  view: QuartierView
  visiting: boolean
  univ: UniversInfo
  places: UPlace[]
  area: QuartierArea | null
  gameMinutes: number
}

const spot = (f: Front): { at: XZ; lat: number; lng: number; dir: number } => ({ at: f.at, ...universLatLng(f.at), dir: f.dir })

/** Every lot of the world's view. */
export function buildLots({ world, view, visiting, univ, places, area, gameMinutes }: LotsInput): QLot[] {
  const out: QLot[] = []
  const who = view.ownerName || view.name
  out.push({ id: 'home', kind: 'home', ...spot(univ.home), name: visiting ? tr('Chez {0}', { 0: who }) : tr('Chez toi'), what: visiting ? tr('Sa maison') : tr('Ta maison'), icon: 'house', owner: view.owner, ownerName: view.ownerName, level: view.level })
  // The lots: built on (one's own, or the friend's), else free (one's own only: the nearest few, and the one « À faire maintenant » points to).
  let free = 0
  for (let n = 0; n < univ.lots.length; n++) {
    const b = view.buildings.find((x) => (x.lot ?? x.slot) === n)
    const f = univ.lots[n]
    if (b) {
      const label = b.label || kindLabel(world, b.kind)
      out.push({ id: `lot:${n}`, kind: visiting ? 'player' : 'mine', ...spot(f), name: label, what: visiting ? tr('Chez {0}', { 0: who }) : tr('À toi · niveau {0}', { 0: b.level }), icon: b.icon || 'store', owner: view.owner, ownerName: view.ownerName, level: b.level, open: b.opened && (!b.staffMax || b.staff > 0), placeId: `quartier:${b.id}`, slot: n, buildingId: b.id })
    } else if (!visiting && (free++ < FREE_SHOWN || n === view.todo?.lot)) out.push({ id: `lot:${n}`, kind: 'free', ...spot(f), name: tr('Terrain libre'), what: tr('Construire ici'), icon: 'hammer', slot: n })
  }
  // The world's places.
  for (const p of places) out.push({ id: `place:${p.id}`, kind: 'place', at: p.at, lat: p.lat, lng: p.lng, dir: 0, name: p.name || kindLabel(world, p.kind), what: kindLabel(world, p.kind), icon: world.kinds[p.kind]?.icon ?? 'map-pin', open: placeOpen(world, p, gameMinutes), placeId: p.id })
  // The commune's other players: the neighbours' houses (the nearest, friends first).
  const others = [
    ...(area?.quartiers ?? []).filter((q) => q.owner !== view.owner).map((q) => ({ owner: q.owner, ownerName: q.ownerName, friend: q.friend, locked: q.locked, level: q.level, quartier: q.name })),
    ...(area?.homes ?? []).filter((h) => h.owner !== view.owner && !area?.quartiers.some((q) => q.owner === h.owner)).map((h) => ({ owner: h.owner, ownerName: h.ownerName, friend: h.friend, locked: false, level: 0, quartier: '' })),
  ].sort((a, b) => Number(b.friend) - Number(a.friend))
  // (One's friends living elsewhere, in other communes, come to live in the world too: their houses lead to their worlds.)
  const communeName = (id: string) => world.cities.flatMap((c) => c.communes).find((c) => c.id === id)?.name ?? ''
  const near = others.filter((o) => o.friend).length
  const far = visiting ? [] : (area?.friends ?? []).filter((f) => f.owner !== view.owner && !others.some((o) => o.owner === f.owner)).map((f) => ({ owner: f.owner, ownerName: f.ownerName, friend: true, locked: false, level: f.level, quartier: f.name, commune: communeName(f.commune) }))
  const all: ((typeof others)[number] & { commune?: string })[] = [...others.slice(0, near), ...far, ...others.slice(near)]
  all.slice(0, univ.neighbours.length).forEach((o, i) => {
    out.push({ id: `home:${o.owner}`, kind: o.quartier ? 'player' : 'player-home', ...spot(univ.neighbours[i]), name: tr('Maison de {0}', { 0: o.ownerName }), what: o.locked ? tr('Amis seulement') : o.commune ? tr('Ton ami·e · à {0}', { 0: o.commune }) : o.friend ? tr('Ton ami·e') : o.quartier ? tr('Quartier de {0}', { 0: o.ownerName }) : tr('Un joueur'), icon: 'house', owner: o.owner, ownerName: o.ownerName, friend: o.friend, locked: o.locked, level: o.level || undefined })
  })
  return out
}
