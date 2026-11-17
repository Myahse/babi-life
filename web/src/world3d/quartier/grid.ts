// Mon quartier's land (backend game/quartier.go): a grid of size × size cells of `cell` metres, row by
// row, one letter a cell. Where a cell is in the 3D scene (the land's middle at 0, rows going +z), who
// can walk where, and the way from one cell to another.

export type XZ = [number, number]

export const T = {
  grass: '.',
  road: 'r',
  water: 'e',
  bridge: 'p',
  tree: 'a',
  house: 'M',
  board: 'B',
  gate: 'E',
} as const

export class Land {
  constructor(
    public grid: string,
    public size: number,
    public cell: number,
  ) {}
  at(x: number, y: number) {
    return x < 0 || y < 0 || x >= this.size || y >= this.size ? '' : this.grid[y * this.size + x]
  }
  /** A cell's middle, in metres. */
  center(x: number, y: number): XZ {
    const h = this.size / 2
    return [(x - h + 0.5) * this.cell, (y - h + 0.5) * this.cell]
  }
  /** The cell under a point (null off the land). */
  cellOf(px: number, pz: number): [number, number] | null {
    const h = this.size / 2
    const x = Math.floor(px / this.cell + h)
    const y = Math.floor(pz / this.cell + h)
    return x < 0 || y < 0 || x >= this.size || y >= this.size ? null : [x, y]
  }
  /** Walked on: the ground, the roads and bridges, the yard round the house; not water, trees or boards. */
  walkable(x: number, y: number) {
    const t = this.at(x, y)
    return t === T.grass || t === T.road || t === T.bridge || t === T.gate || t === T.house
  }
  /** The cells of a kind. */
  all(tile: string) {
    const out: [number, number][] = []
    for (let i = 0; i < this.grid.length; i++) if (this.grid[i] === tile) out.push([i % this.size, Math.floor(i / this.size)])
    return out
  }
  /** The shortest way from one cell to another (the cells after the first, in order), on foot; null: no way. Roads are a little quicker. */
  path(from: [number, number], to: [number, number]): [number, number][] | null {
    const n = this.size
    if (!this.walkable(to[0], to[1])) return null
    const start = from[1] * n + from[0]
    const goal = to[1] * n + to[0]
    const dist = new Float32Array(n * n).fill(Infinity)
    const prev = new Int32Array(n * n).fill(-1)
    dist[start] = 0
    // A small heap would be quicker; a 40 × 40 land is 1 600 cells, a plain scan of the open ones is enough.
    const open = new Set([start])
    while (open.size) {
      let best = -1
      for (const i of open) if (best < 0 || dist[i] < dist[best]) best = i
      open.delete(best)
      if (best === goal) break
      const bx = best % n
      const by = Math.floor(best / n)
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const x = bx + dx
        const y = by + dy
        if (!this.walkable(x, y)) continue
        const i = y * n + x
        const t = this.grid[i]
        const step = t === T.road || t === T.bridge || t === T.gate ? 0.8 : 1
        if (dist[best] + step < dist[i]) {
          dist[i] = dist[best] + step
          prev[i] = best
          open.add(i)
        }
      }
    }
    if (prev[goal] < 0 && goal !== start) return null
    const out: [number, number][] = []
    for (let i = goal; i !== start && i >= 0; i = prev[i]) out.push([i % n, Math.floor(i / n)])
    return out.reverse()
  }
}

/** The land with some cells changed (the owner's work not yet paid): a road laid over water is a bridge, as on the server. */
export function withPending(grid: string, size: number, pending: Map<number, string>) {
  if (!pending.size) return grid
  const g = grid.split('')
  for (const [i, t] of pending) g[i] = t === T.road && (g[i] === T.water || g[i] === T.bridge) ? T.bridge : t
  void size
  return g.join('')
}

/** What a cell would cost to become a tile (0: it already is, or can't). */
export function costOf(was: string, tool: string, prices: Record<string, number>) {
  if (was === T.house || was === T.board || was === T.gate) return 0
  const want = tool === T.road && (was === T.water || was === T.bridge) ? T.bridge : tool
  if (want === T.tree && was !== T.grass && was !== T.tree) return 0
  return want === was ? 0 : (prices[want] ?? 0)
}

/** A small seeded random (the residents' looks and wanderings). */
export function seeded(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}
