import * as THREE from 'three'

// What follows a water's edge, for the landmarks set on the shore (places.ts ON_SHORE gives them the
// edge's line in their own frame): its stretches and the land's side, bands and flat ribbons at a
// distance in from the edge, points set along it. The Baie de Cocody's promenade (baie.tsx), the
// beach of Port-Bouët (plage.tsx).

export type At = { p: [number, number, number]; s: [number, number, number]; ry?: number; c?: string }

/** The water's edge as the landmark uses it: `line` in its frame, its middle at (0, 0) on the land's side. */
export function alongShore(line: [number, number][]) {
  // The stretches, their length along the line from its start, their direction.
  const segs = line.slice(1).map((b, i) => {
    const a = line[i]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 0.001
    return { a, b, len, tx: (b[0] - a[0]) / len, tz: (b[1] - a[1]) / len }
  })
  // The land's side: toward the middle (0, 0) from the stretch nearest it.
  const nearest = segs.reduce((best, sg) => (Math.hypot((sg.a[0] + sg.b[0]) / 2, (sg.a[1] + sg.b[1]) / 2) < Math.hypot((best.a[0] + best.b[0]) / 2, (best.a[1] + best.b[1]) / 2) ? sg : best), segs[0])
  const mid = [(nearest.a[0] + nearest.b[0]) / 2, (nearest.a[1] + nearest.b[1]) / 2]
  const side = -nearest.tz * -mid[0] + nearest.tx * -mid[1] >= 0 ? 1 : -1
  // A band from `o0` to `o1` metres in from the edge, at height y, thick t: a block a stretch.
  const band = (o0: number, o1: number, y: number, t: number): At[] =>
    segs.map((sg) => {
      const [nx, nz] = [-sg.tz * side, sg.tx * side]
      const o = (o0 + o1) / 2
      return { p: [(sg.a[0] + sg.b[0]) / 2 + nx * o, y, (sg.a[1] + sg.b[1]) / 2 + nz * o], s: [sg.len + 0.35, t, o1 - o0], ry: -Math.atan2(sg.tz, sg.tx) }
    })
  // Points every `step` metres along the edge, `o` in from it: x, z, and the turn that faces the land.
  const total = segs.reduce((s, sg) => s + sg.len, 0)
  const at = (d: number, o: number): [number, number, number] => {
    let k = 0
    while (k < segs.length - 1 && d > segs[k].len) d -= segs[k++].len
    const sg = segs[k]
    const u = Math.min(1, d / sg.len)
    const [nx, nz] = [-sg.tz * side, sg.tx * side]
    return [sg.a[0] + (sg.b[0] - sg.a[0]) * u + nx * o, sg.a[1] + (sg.b[1] - sg.a[1]) * u + nz * o, Math.atan2(nx, nz)]
  }
  const every = (step: number, o: number, from = step / 2) => {
    const out: [number, number, number][] = []
    for (let d = from; d < total - 1; d += step) out.push(at(d, o))
    return out
  }
  // Where along the edge the landmark's middle is: its letters and kiosks stand there, no bench in front of them.
  let dMid = 0
  {
    let acc = 0
    let best = Infinity
    for (const sg of segs) {
      const dd = Math.hypot((sg.a[0] + sg.b[0]) / 2, (sg.a[1] + sg.b[1]) / 2)
      if (dd < best) (best = dd), (dMid = acc + sg.len / 2)
      acc += sg.len
    }
  }
  // A flat ribbon from `o0` to `o1` in from the edge, at height y: one surface that bends with the
  // shore (blocks a stretch left wedges open on the outside of each bend).
  const ribbon = (o0: number, o1: number, y: number) => {
    // At each point of the line, the land's side: the two stretches' sides averaged, mitred.
    const normals = line.map((_, i) => {
      const a = segs[Math.max(0, i - 1)]
      const b = segs[Math.min(segs.length - 1, i)]
      let [nx, nz] = [-(a.tz + b.tz) * side, (a.tx + b.tx) * side]
      const l = Math.hypot(nx, nz) || 1
      ;[nx, nz] = [nx / l, nz / l]
      const cos = Math.max(0.5, nx * -a.tz * side + nz * a.tx * side)
      return [nx / cos, nz / cos]
    })
    const pos: number[] = []
    const idx: number[] = []
    line.forEach(([x, z], i) => {
      const [nx, nz] = normals[i]
      pos.push(x + nx * o0, y, z + nz * o0, x + nx * o1, y, z + nz * o1)
      if (i) {
        const k = i * 2
        // Wound to face up whichever side the land is on.
        if (side > 0) idx.push(k - 2, k - 1, k, k - 1, k + 1, k)
        else idx.push(k - 2, k, k - 1, k - 1, k, k + 1)
      }
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setIndex(idx)
    g.computeVertexNormals()
    return g
  }
  return { segs, side, total, at, every, band, ribbon, dMid }
}
