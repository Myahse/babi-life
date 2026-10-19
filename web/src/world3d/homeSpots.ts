import type { Furniture, Plot } from '../lib/types'
import type { HomeSpot } from './Walker'

type XZ = [number, number]

/**
 * In one's own house, the things done at home are done on its furniture:
 * sleeping in the bed (or on the natte), the shower, cooking at the
 * gazinière, the TV or the phone call from the sofa (or a chair). The house
 * stands at `center`, turned `rot0`, its lot `w` × `d` metres; a piece's
 * front is its +z, as FurnitureSet turns it. Action id → where it's done.
 */
export function homeSpotsOf(plot: Plot, [w, d]: [number, number], center: XZ, rot0: number, catalog: Furniture[]): Record<string, HomeSpot> {
  const out: Record<string, HomeSpot> = {}
  const [c, s] = [Math.cos(rot0), Math.sin(rot0)]
  const toWorld = (u: number, v: number): XZ => [center[0] + u * c + v * s, center[1] - u * s + v * c]
  for (const piece of plot.furniture ?? []) {
    const f = catalog.find((x) => x.id === piece[4])
    if (!f) continue
    const [fw, fd] = piece[3] % 2 ? [f.d, f.w] : [f.w, f.d]
    const [pu, pv] = [piece[0] + fw / 2 - w / 2, piece[2] + fd / 2 - d / 2]
    // The piece's own frame (as FurnitureSet turns it): its front is +z.
    const turn = piece[3] % 2 ? -Math.PI / 2 : 0
    const rot = rot0 + turn
    const [lc, ls] = [Math.cos(turn), Math.sin(turn)]
    const half = f.d / 2
    const at = (x: number, y: number, z: number, face: number, pose: HomeSpot['pose'], lying = false, ids: string[] = []): void => {
      const [u, v] = [pu + x * lc + z * ls, pv - x * ls + z * lc]
      // Where the Sim walks to first: just in front of the piece.
      const [ax, az] = [pu + (half + 0.6) * ls, pv + (half + 0.6) * lc]
      const spot: HomeSpot = { at: toWorld(u, v), y, rot: rot + face, pose, lying, from: toWorld(ax, az) }
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
      case 'douche':
        at(0, 0.08, 0, 0, 'wash', false, ['shower'])
        break
    }
  }
  return out
}
