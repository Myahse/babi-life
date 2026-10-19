// The shortest way on foot between two nearby points, round whatever is in
// the way: A* on a fine grid (a cell under a metre), then the corners cut
// wherever the way is clear, so the Sim walks straight where it can. The
// streets' graph (open/nav.ts) is for the long ways; this is for a tap a
// few steps off, or the bits between a street and a door.

type XZ = [number, number]

const SQRT2 = Math.SQRT2

/**
 * From a to b, keeping to where `free` says a body fits: the turning points
 * (a and b included), or null when there's no way within `pad` metres round
 * the two, or the area is too big for a grid.
 */
export function gridWay(a: XZ, b: XZ, free: (x: number, z: number) => boolean, cell = 0.75, pad = 20, maxCells = 300 * 300): XZ[] | null {
  const x0 = Math.min(a[0], b[0]) - pad
  const z0 = Math.min(a[1], b[1]) - pad
  const cols = Math.ceil((Math.abs(a[0] - b[0]) + 2 * pad) / cell) + 1
  const rows = Math.ceil((Math.abs(a[1] - b[1]) + 2 * pad) / cell) + 1
  if (cols * rows > maxCells) return null
  const N = cols * rows
  // What each cell is: 0 not known yet, 1 free, 2 taken (asked lazily: most are never looked at).
  const state = new Uint8Array(N)
  const at = (i: number): XZ => [x0 + (i % cols) * cell, z0 + Math.floor(i / cols) * cell]
  const open = (i: number) => {
    if (!state[i]) {
      const [x, z] = at(i)
      state[i] = free(x, z) ? 1 : 2
    }
    return state[i] === 1
  }
  const cellOf = (p: XZ) => Math.min(rows - 1, Math.max(0, Math.round((p[1] - z0) / cell))) * cols + Math.min(cols - 1, Math.max(0, Math.round((p[0] - x0) / cell)))
  const start = cellOf(a)
  state[start] = 1 // the Sim is where it is, even if it brushes something
  // The goal: its cell, or the nearest free one round it (a door on a wall).
  let goal = cellOf(b)
  if (!open(goal)) {
    let best = -1
    let bestD = Infinity
    const [gc, gr] = [goal % cols, Math.floor(goal / cols)]
    for (let dr = -4; dr <= 4; dr++)
      for (let dc = -4; dc <= 4; dc++) {
        const c = gc + dc
        const r = gr + dr
        if (c < 0 || r < 0 || c >= cols || r >= rows) continue
        const i = r * cols + c
        const d = dc * dc + dr * dr
        if (d < bestD && open(i)) [best, bestD] = [i, d]
      }
    if (best < 0) return null
    goal = best
  }
  const gx = goal % cols
  const gz = Math.floor(goal / cols)
  const h = (i: number) => {
    const dx = Math.abs((i % cols) - gx)
    const dz = Math.abs(Math.floor(i / cols) - gz)
    return Math.max(dx, dz) + (SQRT2 - 1) * Math.min(dx, dz)
  }
  const g = new Float32Array(N).fill(Infinity)
  const prev = new Int32Array(N).fill(-1)
  const closed = new Uint8Array(N)
  const heap = new MinHeap()
  g[start] = 0
  heap.push(start, h(start))
  let found = false
  let steps = 0
  while (heap.size) {
    const i = heap.pop()
    if (i === goal) {
      found = true
      break
    }
    if (closed[i]) continue
    closed[i] = 1
    if (++steps > 60000) return null
    const c = i % cols
    const r = Math.floor(i / cols)
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue
        const nc = c + dx
        const nr = r + dz
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue
        const j = nr * cols + nc
        if (closed[j] || !open(j)) continue
        // No cutting a corner between two blocked cells.
        if (dx && dz && (!open(r * cols + nc) || !open(nr * cols + c))) continue
        const d = g[i] + (dx && dz ? SQRT2 : 1)
        if (d < g[j]) {
          g[j] = d
          prev[j] = i
          heap.push(j, d + h(j))
        }
      }
  }
  if (!found) return null
  const cells: XZ[] = []
  for (let i = goal; i !== -1; i = prev[i]) cells.push(at(i))
  cells.reverse()
  cells[0] = a
  // The goal itself when it's free, else stop at the nearest free cell and step on (a door).
  cells.push(b)
  return smooth(cells, free, cell / 2)
}

/** Is the straight line from p to q clear (looked at every `step` metres)? */
export function clearLine(p: XZ, q: XZ, free: (x: number, z: number) => boolean, step = 0.35) {
  const d = Math.hypot(q[0] - p[0], q[1] - p[1])
  const n = Math.ceil(d / step)
  for (let k = 1; k < n; k++) if (!free(p[0] + ((q[0] - p[0]) * k) / n, p[1] + ((q[1] - p[1]) * k) / n)) return false
  return true
}

/** Keep only the turning points: from each one, as far ahead as the line stays clear. */
function smooth(pts: XZ[], free: (x: number, z: number) => boolean, step: number): XZ[] {
  if (pts.length <= 2) return pts
  const out: XZ[] = [pts[0]]
  let i = 0
  while (i < pts.length - 1) {
    let j = pts.length - 1
    while (j > i + 1 && !clearLine(pts[i], pts[j], free, step)) j--
    out.push(pts[j])
    i = j
  }
  return out
}

/** A binary heap of (cell, priority). */
class MinHeap {
  private items: number[] = []
  private keys: number[] = []
  get size() {
    return this.items.length
  }
  push(item: number, key: number) {
    const items = this.items
    const keys = this.keys
    let i = items.push(item) - 1
    keys.push(key)
    while (i > 0) {
      const p = (i - 1) >> 1
      if (keys[p] <= key) break
      items[i] = items[p]
      keys[i] = keys[p]
      i = p
    }
    items[i] = item
    keys[i] = key
  }
  pop() {
    const items = this.items
    const keys = this.keys
    const top = items[0]
    const item = items.pop()!
    const key = keys.pop()!
    if (items.length) {
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        if (l >= items.length) break
        const r = l + 1
        const c = r < items.length && keys[r] < keys[l] ? r : l
        if (keys[c] >= key) break
        items[i] = items[c]
        keys[i] = keys[c]
        i = c
      }
      items[i] = item
      keys[i] = key
    }
    return top
  }
}
