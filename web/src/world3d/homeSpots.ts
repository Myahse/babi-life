import type { Furniture, Plot } from '../lib/types'
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
  for (const piece of plot.furniture ?? []) {
    const f = catalog.find((x) => x.id === piece[4])
    // Upstairs (a duplex's bedrooms): the Sim walks on the ground floor, so the pieces down there.
    if (!f || piece[1] > 0) continue
    const [fw, fd] = piece[3] % 2 ? [f.d, f.w] : [f.w, f.d]
    const [pu, pv] = [piece[0] + fw / 2 - w / 2, piece[2] + fd / 2 - d / 2]
    // The piece's own frame (as FurnitureSet turns it): its front is +z.
    const turn = piece[3] % 2 ? -Math.PI / 2 : 0
    const rot = rot0 + turn
    const [lc, ls] = [Math.cos(turn), Math.sin(turn)]
    const half = f.d / 2
    const at = (x: number, y: number, z: number, face: number, pose: HomeSpot['pose'], lying = false, ids: string[] = [], stool = false): void => {
      const place = (sx: number, sz: number, sface: number, front: number): HomeSpot => {
        const [u, v] = [pu + sx * lc + sz * ls, pv - sx * ls + sz * lc]
        // Where the Sim walks to first: just in front of the piece (or behind, turned round).
        const [au, av] = [pu + front * ls, pv + front * lc]
        return { at: toWorld(u, v), y, rot: rot + sface, pose, lying, from: toWorld(au, av), stool, wall: wallAt(u, v) || wallAt(au, av) }
      }
      // Up against a wall on that side: the other side of the piece, if it's free there.
      let spot = place(x, z, face, half + 0.6)
      if (spot.wall && !lying) {
        const other = place(-x, -z, face + Math.PI, -(half + 0.6))
        if (!other.wall) spot = other
      }
      for (const id of ids) out[id] ??= spot
    }
    switch (f.id) {
      case 'lit':
        at(-0.45, 0.64, half - 0.15, 0, 'sleep', true, ['sleep', 'nap'])
        break
      case 'natte':
        at(0, 0.16, half - 0.1, 0, 'sleep', true, ['sleep', 'nap'])
        break
      case 'canape':
        at(-0.45, 0.05, 0.15, 0, 'sit', false, ['watch-tv', 'call-family'])
        break
      case 'chaises':
        at(0, 0.05, 0.05, 0, 'sit', false, ['watch-tv', 'call-family'])
        break
      case 'gaziniere':
        at(0, 0, half + 0.45, Math.PI, 'cook', false, ['cook-attieke'])
        break
      case 'table':
        // Sitting at the side of the table, on a stool: homework, the Golvo delivery.
        at(0.75, 0.05, 0, -Math.PI / 2, 'write', false, ['devoirs'], true)
        at(0.75, 0.05, 0, -Math.PI / 2, 'eat', false, ['golvo'], true)
        break
      case 'douche':
        at(0, 0.08, 0, 0, 'wash', false, ['shower'])
        break
    }
  }
  return out
}
