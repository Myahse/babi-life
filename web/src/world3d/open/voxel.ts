import { pointInRing, type XZ } from './geo'

// Buildings in blocks, like Minecraft: a footprint from the map is laid on a
// grid of CELL-metre squares fixed to the world (the same grid in every
// chunk, on every phone), the squares whose centre falls inside are kept,
// and the outline of those squares becomes the building's. Walls then run
// only north–south or east–west, and a slanting street front comes out in
// steps. A storey (3 m) is two blocks high.

export const CELL = 1.5

/**
 * The outline of a footprint in blocks: a ring of grid corners, the right
 * way round for the game. Courtyards are filled; of a footprint the grid
 * cuts in two, the bigger part stays. A footprint smaller than one block
 * gets the block holding its centre.
 */
export function blockRing(ring: XZ[], holes: XZ[][] = [], centre?: XZ): XZ[] {
  let [x0, z0, x1, z1] = [Infinity, Infinity, -Infinity, -Infinity]
  for (const [x, z] of ring) [x0, z0, x1, z1] = [Math.min(x0, x), Math.min(z0, z), Math.max(x1, x), Math.max(z1, z)]
  const [i0, j0, i1, j1] = [Math.floor(x0 / CELL), Math.floor(z0 / CELL), Math.floor(x1 / CELL), Math.floor(z1 / CELL)]
  const cells = new Set<string>()
  for (let i = i0; i <= i1; i++)
    for (let j = j0; j <= j1; j++) {
      const p: XZ = [(i + 0.5) * CELL, (j + 0.5) * CELL]
      if (pointInRing(p, ring) && !holes.some((h) => pointInRing(p, h))) cells.add(`${i},${j}`)
    }
  if (!cells.size) {
    const [cx, cz] = centre ?? [(x0 + x1) / 2, (z0 + z1) / 2]
    cells.add(`${Math.floor(cx / CELL)},${Math.floor(cz / CELL)}`)
  }
  return outline(cells)
}

/**
 * The outline of a set of grid squares ("i,j"): every side of a square with
 * no square beyond it, chained corner to corner. Squares touching only by a
 * corner are kept apart (the walk always takes the leftmost turn). Of the
 * loops found, the one enclosing the most wins; corners along a straight
 * run are dropped.
 */
export function outline(cells: Set<string>): XZ[] {
  const has = (i: number, j: number) => cells.has(`${i},${j}`)
  // Directed edges, square on their left (counter-clockwise in x, z).
  const from = new Map<string, [number, number][]>()
  const add = (a: [number, number], b: [number, number]) => {
    const k = `${a[0]},${a[1]}`
    const l = from.get(k)
    if (l) l.push(b)
    else from.set(k, [b])
  }
  for (const key of cells) {
    const [i, j] = key.split(',').map(Number)
    if (!has(i, j - 1)) add([i, j], [i + 1, j])
    if (!has(i + 1, j)) add([i + 1, j], [i + 1, j + 1])
    if (!has(i, j + 1)) add([i + 1, j + 1], [i, j + 1])
    if (!has(i - 1, j)) add([i, j + 1], [i, j])
  }
  const loops: [number, number][][] = []
  for (;;) {
    const startKey = from.keys().next().value as string | undefined
    if (startKey === undefined) break
    const start = startKey.split(',').map(Number) as [number, number]
    const loop: [number, number][] = [start]
    let prev: [number, number] | null = null
    let at = start
    for (let guard = 0; guard < 100000; guard++) {
      const k = `${at[0]},${at[1]}`
      const outs = from.get(k)
      if (!outs?.length) break
      // Where two loops touch at a corner, turn left: each square keeps its own loop.
      let pick = 0
      if (outs.length > 1 && prev) {
        const [dx, dz] = [at[0] - prev[0], at[1] - prev[1]]
        const turn = (b: [number, number]) => dx * (b[1] - at[1]) - dz * (b[0] - at[0])
        pick = outs.reduce((best, b, n) => (turn(b) > turn(outs[best]) ? n : best), 0)
      }
      const next = outs.splice(pick, 1)[0]
      if (!outs.length) from.delete(k)
      prev = at
      at = next
      if (at[0] === start[0] && at[1] === start[1]) break
      loop.push(at)
    }
    if (loop.length >= 4) loops.push(loop)
  }
  const area = (l: [number, number][]) => l.reduce((s, [x, z], n) => s + x * l[(n + 1) % l.length][1] - l[(n + 1) % l.length][0] * z, 0) / 2
  // The outer loops wind one way (positive area), holes the other: the biggest outer one.
  const best = loops.filter((l) => area(l) > 0).sort((a, b) => area(b) - area(a))[0] ?? loops[0] ?? []
  // Corners only: drop the points in the middle of a straight run.
  const corners = best.filter((p, n) => {
    const a = best[(n + best.length - 1) % best.length]
    const b = best[(n + 1) % best.length]
    return (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]) !== 0
  })
  return corners.map(([i, j]) => [i * CELL, j * CELL])
}
