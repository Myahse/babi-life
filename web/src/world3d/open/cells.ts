import type { Box } from './geo'

// A chunk's small parts (its buildings' ledges, parapets, air-conditioners,
// pilasters: the « trim », the tin roofs' steps, and the shade at the walls' foot) are most of its
// triangles, and only make a difference near the view. Cut into a grid of
// squares, they're drawn (and cast shadows, and are sent to the GPU at all)
// only in the squares round the view, not across the whole chunk, 600 m
// wide; behind the camera, a square is left out by its bounds.

/** Squares across a chunk (about 150 m each). */
export const CELLS = 4
/** The meshes cut into squares. */
export const CELLED = new Set(['trim', 'contact', 'tin', 'tinLow'])
/** Cut into squares and kept whole as well: the plain tin roofs, drawn whole in the chunks far from the view. */
export const ALSO_WHOLE = new Set(['tinLow'])

/** Index arrays in 16 bits when the vertices fit, else 32. */
export type Index = Uint16Array | Uint32Array
/** A mesh's arrays (chunkJob's Arrays), whatever their element types. */
export type Parts = { position: Float32Array; uv: Float32Array; normal: Int8Array; color?: Uint8Array | Float32Array; colorSize?: number; lotBc?: Int16Array; index: Index }

/** A mesh in a chunk's squares: `name@cell`, cell = column + row × CELLS. */
export const cellName = (name: string, cell: number) => `${name}@${cell}`
/** The mesh's own name and its square (undefined: the whole chunk). */
export function cellOf(name: string): [string, number | undefined] {
  const at = name.indexOf('@')
  return at < 0 ? [name, undefined] : [name.slice(0, at), Number(name.slice(at + 1))]
}
/** A square's bounds in the chunk's box. */
export function cellBox(b: Box, cell: number): Box {
  const [i, j] = [cell % CELLS, Math.floor(cell / CELLS)]
  const [w, d] = [(b.x1 - b.x0) / CELLS, (b.z1 - b.z0) / CELLS]
  return { x0: b.x0 + i * w, x1: b.x0 + (i + 1) * w, z0: b.z0 + j * d, z1: b.z0 + (j + 1) * d }
}

/**
 * A mesh cut into the chunk's squares. A building's triangles all go to the
 * square of its middle (lotBc), so none is cut in two; the rest (the power
 * lines' poles and wires) to the square of their first corner.
 */
export function splitCells(a: Parts, box: Box): Map<number, Parts> {
  const nt = a.index.length / 3
  const cellOfTri = new Uint8Array(nt)
  const count = new Uint32Array(CELLS * CELLS)
  const [w, d] = [(box.x1 - box.x0) / CELLS, (box.z1 - box.z0) / CELLS]
  const clamp = (v: number) => Math.min(CELLS - 1, Math.max(0, Math.floor(v)))
  for (let t = 0; t < nt; t++) {
    const v = a.index[t * 3]
    const building = a.lotBc && a.lotBc[v * 3 + 2] >= 0
    const [x, z] = building ? [a.lotBc![v * 3], a.lotBc![v * 3 + 1]] : [a.position[v * 3], a.position[v * 3 + 2]]
    const c = clamp((x - box.x0) / w) + clamp((z - box.z0) / d) * CELLS
    cellOfTri[t] = c
    count[c]++
  }
  // The triangles sorted by square (a counting sort), each square's run then copied out.
  const start = new Uint32Array(CELLS * CELLS + 1)
  for (let c = 0; c < CELLS * CELLS; c++) start[c + 1] = start[c] + count[c]
  const order = new Uint32Array(nt)
  const fill = start.slice(0, CELLS * CELLS)
  for (let t = 0; t < nt; t++) order[fill[cellOfTri[t]]++] = t
  const out = new Map<number, Parts>()
  const nv = a.position.length / 3
  const remap = new Int32Array(nv).fill(-1)
  for (let c = 0; c < CELLS * CELLS; c++) {
    if (!count[c]) continue
    // The vertices this square's triangles use, in order, and the triangles renumbered on them.
    const used: number[] = []
    const tris = new Uint32Array(count[c] * 3)
    let k = 0
    for (let o = start[c]; o < start[c + 1]; o++) {
      const t = order[o]
      for (let e = 0; e < 3; e++) {
        const v = a.index[t * 3 + e]
        if (remap[v] < 0) {
          remap[v] = used.length
          used.push(v)
        }
        tris[k++] = remap[v]
      }
    }
    for (const v of used) remap[v] = -1
    const pick = <T extends Float32Array | Int8Array | Uint8Array | Int16Array>(src: T, size: number): T => {
      const dst = new (src.constructor as new (n: number) => T)(used.length * size)
      for (let i = 0; i < used.length; i++) for (let s = 0; s < size; s++) dst[i * size + s] = src[used[i] * size + s]
      return dst
    }
    out.set(c, {
      position: pick(a.position, 3),
      uv: pick(a.uv, 2),
      normal: pick(a.normal, 3),
      color: a.color && pick(a.color, a.colorSize ?? 3),
      colorSize: a.colorSize,
      lotBc: a.lotBc && pick(a.lotBc, 3),
      index: used.length <= 65535 ? Uint16Array.from(tris) : tris,
    })
  }
  return out
}
