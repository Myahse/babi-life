import { kindOf, type Furniture, type Plot } from '../lib/types'
import type { HomeSpot } from './Walker'

type XZ = [number, number]

/**
 * In one's own house, the things done at home are done on its furniture:
 * sleeping in the bed (or on the natte), the shower, cooking at the
 * gazinière, the TV or the phone call from the sofa (or a chair), homework
 * and the Golvo delivery at the table. The house
 * stands at `center`, turned `rot0`, its lot `w` × `d` metres; a piece's
 * front is its +z, as FurnitureSet turns it. Action id → where it's done.
 */
export function homeSpotsOf(plot: Plot, [w, d]: [number, number], center: XZ, rot0: number, catalog: Furniture[]): Record<string, HomeSpot> {
  const out: Record<string, HomeSpot> = {}
  const [c, s] = [Math.cos(rot0), Math.sin(rot0)]
  const toWorld = (u: number, v: number): XZ => [center[0] + u * c + v * s, center[1] - u * s + v * c]
  // The walls: a block at body height in the cell (lot coordinates, from its middle).
  const walls = new Set(plot.blocks.filter((b) => b[1] === 1).map((b) => `${b[0]},${b[2]}`))
  const wallAt = (u: number, v: number) => walls.has(`${Math.floor(u + w / 2)},${Math.floor(v + d / 2)}`)
  // The ground floor's cells under each piece: a spot inside another piece (a stove's front against the fridge) won't do.
  const under = new Map<string, number>()
  ;(plot.furniture ?? []).forEach((piece, k) => {
    const f = catalog.find((x) => x.id === piece[4])
    if (!f || piece[1] > 0) return
    const [fw, fd] = piece[3] % 2 ? [f.d, f.w] : [f.w, f.d]
    for (let x = 0; x < fw; x++) for (let z = 0; z < fd; z++) under.set(`${piece[0] + x},${piece[2] + z}`, k)
  })
  // The TV and the seats one could watch it from (chosen after: the one turned most towards it).
  let tv: { at: XZ; rot: number; y?: number; w?: number; h?: number } | null = null
  // The game console: its screen, and in front of it (no seat facing it: a pouf on the floor).
  let pad: { at: XZ; rot: number; front: HomeSpot } | null = null
  const seats: HomeSpot[] = []
  // Every bed, both sides of a double one: where the family sleeps (the parents, in a family's home).
  const beds: HomeSpot[] = []
  let basin = false
  for (const [k, piece] of (plot.furniture ?? []).entries()) {
    const f = catalog.find((x) => x.id === piece[4])
    // Upstairs (a duplex's bedrooms): the Sim walks on the ground floor, so the pieces down there.
    if (!f || piece[1] > 0) continue
    const [fw, fd] = piece[3] % 2 ? [f.d, f.w] : [f.w, f.d]
    const [pu, pv] = [piece[0] + fw / 2 - w / 2, piece[2] + fd / 2 - d / 2]
    // The piece's own frame (as FurnitureSet turns it): its front is +z.
    const turn = (-piece[3] * Math.PI) / 2
    const rot = rot0 + turn
    const [lc, ls] = [Math.cos(turn), Math.sin(turn)]
    const half = f.d / 2
    const at = (x: number, y: number, z: number, face: number, pose: HomeSpot['pose'], lying = false, ids: string[] = [], stool = false, turnable = false): HomeSpot => {
      const place = (sx: number, sz: number, sface: number, front: number, frontX = 0): HomeSpot => {
        const [u, v] = [pu + sx * lc + sz * ls, pv - sx * ls + sz * lc]
        // Where the Sim walks to first: just in front of the piece (or behind, turned round; or at its side).
        const [au, av] = [pu + frontX * lc + front * ls, pv - frontX * ls + front * lc]
        const other = (a: number, b: number) => {
          const at = under.get(`${Math.floor(a + w / 2)},${Math.floor(b + d / 2)}`)
          return at !== undefined && at !== k
        }
        return { at: toWorld(u, v), y, rot: rot + sface, pose, lying, from: toWorld(au, av), stool, wall: wallAt(u, v) || wallAt(au, av) || other(u, v) || other(au, av) }
      }
      // Up against a wall on that side: the other side of the piece, if it's free there.
      let spot = place(x, z, face, half + 0.6)
      // (Not a seat: sitting on its back would be sitting the wrong way round; the toilets can turn to the room.)
      if (spot.wall && !lying && (pose !== 'sit' || turnable)) {
        const other = place(-x, -z, face + Math.PI, -(half + 0.6))
        if (!other.wall) spot = other
        // Both blocked (a fridge in front of the stove, the wall behind): at its side, turned to it.
        else if (pose !== 'sit')
          for (const side of [1, -1]) {
            const beside = place(side * (f.w / 2 + 0.4), 0, -side * (Math.PI / 2), 0, side * (f.w / 2 + 0.8))
            if (!beside.wall) {
              spot = beside
              break
            }
          }
      }
      for (const id of ids) out[id] ??= spot
      return spot
    }
    // The finer pieces are where they do what their plain piece does (a canopy bed is a bed), at their own size.
    const big = f.w >= 3
    switch (kindOf(f)) {
      case 'lit':
        beds.push(at(-0.45, 0.64, half - 0.15, 0, 'sleep', true, ['sleep', 'nap', 'passer-nuit']), at(0.45, 0.64, half - 0.15, 0, 'sleep', true))
        break
      case 'natte':
        beds.push(at(0, 0.16, half - 0.1, 0, 'sleep', true, ['sleep', 'nap', 'passer-nuit']))
        break
      case 'canape':
        if (f.id === 'canape-cuir') seats.push(at(-1.0, 0.05, -0.45, 0, 'sit', false, ['watch-tv', 'call-family']), at(-0.33, 0.05, -0.45, 0, 'sit'), at(0.33, 0.05, -0.45, 0, 'sit'))
        else if (big) seats.push(at(-0.82, 0.05, 0.15, 0, 'sit', false, ['watch-tv', 'call-family']), at(0, 0.05, 0.15, 0, 'sit'), at(0.82, 0.05, 0.15, 0, 'sit'))
        else seats.push(at(-0.45, 0.05, 0.15, 0, 'sit', false, ['watch-tv', 'call-family']), at(0.45, 0.05, 0.15, 0, 'sit'))
        break
      case 'chaises':
        seats.push(at(0, 0.05, 0.05, 0, 'sit', false, ['watch-tv', 'call-family']))
        break
      case 'tele': {
        // The screen, on the piece's front (+z): the big ones hang higher, wider.
        const [y, sw, sh, z] = f.id === 'tele-geante' ? [1.35, 1.84, 1.02, -half + 0.095] : f.id === 'tele-led' ? [0.95, 1.26, 0.7, -half + 0.25] : [0.85, 0.84, 0.46, 0.05]
        tv = { at: toWorld(pu + z * ls, pv + z * lc), rot, y, w: sw, h: sh }
        break
      }
      case 'console': {
        const z = -half + 0.255
        pad = { at: toWorld(pu + z * ls, pv + z * lc), rot, front: at(0, 0.05, half + 0.9, Math.PI, 'write', false, [], true) }
        break
      }
      case 'gaziniere':
        at(0, 0, half + 0.45, Math.PI, 'cook', false, ['cook-attieke'])
        break
      case 'frigo':
        // Taken out of the fridge: standing at its door.
        at(0, 0, half + 0.5, Math.PI, 'snack', false, ['frigo'])
        break
      case 'table':
        // Sitting at the side of the table: on a stool, or the marble table's own chair.
        at(0.75, 0.05, 0, -Math.PI / 2, 'write', false, ['devoirs'], f.id === 'table')
        at(0.75, 0.05, 0, -Math.PI / 2, 'eat', false, ['golvo'], f.id === 'table')
        break
      case 'douche':
        at(0, 0.08, 0, 0, 'wash', false, ['shower'])
        // The teeth, standing at the shower's tap (if there's no washbasin or toilets to stand by).
        if (f.unlocks?.includes('dents')) at(0, 0.08, half + 0.35, Math.PI, 'brush', false, ['dents'])
        break
      case 'lavabo': {
        // The teeth at the washbasin, in front of the mirror: always there when there is one.
        const spot = at(f.w > 1 ? -0.45 : 0, 0, half + 0.38, Math.PI, 'brush')
        if (!out.dents || !basin) out.dents = spot
        basin = true
        break
      }
      case 'wc':
        // Sitting on the toilets, turned to face the room.
        at(0, 0.05, -0.05, 0, 'toilet', false, ['toilettes'], false, true)
        break
    }
  }
  beds.forEach((b, i) => (out[`bed:${i}`] = b))
  seats.forEach((b, i) => (out[`seat:${i}`] = b))
  // Watching TV: from the seat that faces it best (and not too far), turned to the screen; the screen comes on.
  if (tv && seats.length) {
    const t = tv as { at: XZ; rot: number }
    const score = (s: HomeSpot) => {
      const [dx, dz] = [t.at[0] - s.at[0], t.at[1] - s.at[1]]
      const len = Math.hypot(dx, dz) || 1
      return (Math.sin(s.rot) * dx + Math.cos(s.rot) * dz) / len - len * 0.04
    }
    const seat = seats.reduce((a, b) => (score(b) > score(a) ? b : a))
    // Sitting as the seat faces, the head turned a little towards the screen (never more than a third of a turn round).
    const toTv = Math.atan2(t.at[0] - seat.at[0], t.at[1] - seat.at[1])
    const turn = Math.max(-0.5, Math.min(0.5, Math.atan2(Math.sin(toTv - seat.rot), Math.cos(toTv - seat.rot))))
    out['watch-tv'] = { ...seat, rot: seat.rot + turn, screen: t }
  }
  // The console's games: from the seat facing its screen best (not further than 4 m), the controller in the hands; else on a pouf in front of it.
  if (pad) {
    const p = pad as { at: XZ; rot: number; front: HomeSpot }
    const facing = (s: HomeSpot) => {
      const [dx, dz] = [p.at[0] - s.at[0], p.at[1] - s.at[1]]
      const len = Math.hypot(dx, dz) || 1
      return len > 4 ? -9 : (Math.sin(s.rot) * dx + Math.cos(s.rot) * dz) / len - len * 0.04
    }
    const best = seats.reduce<HomeSpot | null>((a, b) => (facing(b) > (a ? facing(a) : 0.5) ? b : a), null)
    const spot: HomeSpot = { ...(best ?? p.front), pose: 'write', screen: { at: p.at, rot: p.rot, y: 0.82, w: 0.84, h: 0.47 } }
    for (const id of ['maison-foot', 'maison-course', 'maison-combat']) out[id] = spot
  }
  // A baby's things are done on the floor in front of a piece, the mother kneeling with it (ActionProps):
  // the biberon, the bouillie, the rattle, the cuddle and the little accidents in front of the sofa (or the bed), the bath in front of the shower.
  // (Turned away from the piece, into the room: whoever is with the baby kneels there, not in a wall — the natte lies along one.)
  const away = (s: HomeSpot) => (Math.hypot(s.from[0] - s.at[0], s.from[1] - s.at[1]) > 0.1 ? Math.atan2(s.from[0] - s.at[0], s.from[1] - s.at[1]) : Math.atan2(center[0] - s.from[0], center[1] - s.from[1]))
  const onFloor = (s: HomeSpot): HomeSpot => ({ at: s.from, from: s.from, y: 0, rot: away(s), pose: 'busy', lying: false, wall: s.wall })
  const seat = out['call-family'] ?? out.sleep
  if (seat) for (const id of ['biberon', 'bouillie', 'hochet', 'calin', 'caca', 'pipi', 'vomir', 'pleurer']) out[id] ??= onFloor(seat)
  // (Crying: the fists to the eyes.)
  if (out.pleurer) out.pleurer = { ...out.pleurer, pose: 'cry' }
  const bath = out.shower ?? seat
  if (bath) out['bain-bebe'] ??= onFloor(bath)
  // Calling the family from the sofa: sitting, the phone at the ear.
  if (out['call-family']) out['call-family'] = { ...out['call-family'], pose: 'call' }
  // The pool (a raised basin, build/Zones.tsx): in from its rim, then lengths along it.
  for (const z of plot.zones ?? []) {
    if (z[4] !== 'piscine' || out.nager) continue
    const [cu, cv] = [z[0] + z[2] / 2 - w / 2, z[1] + z[3] / 2 - d / 2]
    const along = z[2] >= z[3]
    const long = Math.max(z[2], z[3])
    // The Sim's front is its +z: turned a quarter to swim along the lot's x.
    const rot = rot0 + (along ? Math.PI / 2 : 0)
    const from: XZ = along ? toWorld(cu, cv + z[3] / 2 + 0.6) : toWorld(cu + z[2] / 2 + 0.6, cv)
    out.nager = { at: toWorld(cu, cv), y: 0.42, rot, pose: 'swim', lying: false, from, swim: Math.max(0.5, long / 2 - 1.3) }
  }
  return out
}
