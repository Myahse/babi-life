import { EPOCH } from '../game/rules'

// Power cuts (délestage): when the network can't keep up (the hot season, the evening peak), whole
// zones of a commune lose the power for an hour or three, in turn. A zone is a square of ZONE metres
// in the open world's frame (from the commune's origin); which ones are cut is a pure function of the
// commune, the zone and the game clock, like the happenings: every player in a zone sees the same
// dark streets, and nothing has to be stored or sent.

/** A zone's side (m): a few blocks of streets. */
export const ZONE = 800
/** A cut fits in a slot of 3 game hours. */
const SLOT = 180

export type PowerCut = { ix: number; iz: number; start: number; end: number }

/** A number in [0, 1) for a commune, a zone and a slot. */
function hash(commune: string, ix: number, iz: number, slot: number, salt: string) {
  let h = 2166136261
  for (const ch of `${commune}|${ix}|${iz}|${slot}|${salt}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  h = Math.imul(h ^ (h >>> 15), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/**
 * How likely a zone is cut in a slot starting at `start`: in the hot season (February to May) the
 * network is short, and most of all at the evening peak, when everyone is home with the fan on.
 */
function chance(start: number) {
  const d = new Date(EPOCH + start * 60000)
  const hot = d.getUTCMonth() >= 1 && d.getUTCMonth() <= 4
  const h = d.getUTCHours()
  const peak = h >= 18 && h < 24 ? 2.2 : h >= 12 && h < 18 ? 1 : h >= 6 ? 0.6 : 0.3
  return (hot ? 0.12 : 0.04) * peak
}

/** The cut on a zone at a game minute, or null when it has power. */
export function cutAt(commune: string, ix: number, iz: number, minutes: number): PowerCut | null {
  const slot = Math.floor(minutes / SLOT)
  const start = slot * SLOT
  if (hash(commune, ix, iz, slot, 'on') >= chance(start)) return null
  // An hour to the whole slot, starting somewhere in it.
  const len = 60 + Math.floor(hash(commune, ix, iz, slot, 'len') * (SLOT - 60))
  const from = start + Math.floor(hash(commune, ix, iz, slot, 'from') * (SLOT - len + 1))
  return minutes >= from && minutes < from + len ? { ix, iz, start: from, end: from + len } : null
}

/** The zone a point (open world frame, m) is in. */
export const zoneOf = (x: number, z: number): [number, number] => [Math.floor(x / ZONE), Math.floor(z / ZONE)]

/** The cut zones within `reach` zones of a point (what can be seen from there). */
export function cutsAround(commune: string, x: number, z: number, minutes: number, reach = 1): PowerCut[] {
  const [cx, cz] = zoneOf(x, z)
  const out: PowerCut[] = []
  for (let ix = cx - reach; ix <= cx + reach; ix++)
    for (let iz = cz - reach; iz <= cz + reach; iz++) {
      const c = cutAt(commune, ix, iz, minutes)
      if (c) out.push(c)
    }
  return out
}

/** Whether a point is in the dark (a cut zone among `cuts`). */
export function inCut(cuts: PowerCut[], x: number, z: number) {
  const [ix, iz] = zoneOf(x, z)
  return cuts.find((c) => c.ix === ix && c.iz === iz) ?? null
}
