// zoo.tsx's collision list and the sizes it's drawn from: data only, so that the street (OpenWorld) can
// have it without loading the model, which comes lazily when near.

/** What a visitor walking the park can't go through (the park's own frame):
 * the enclosure walls, the cages, the gate's pillars, the ticket window, the
 * vendor's cart, the wall all round the park. The 12 m gate stays open. */
export const ZOO_SOLID: { x: number; z: number; hw: number; hd: number; rot: number; top?: number }[] = (() => {
  const out: { x: number; z: number; hw: number; hd: number; rot: number; top?: number }[] = []
  const ring = (cx: number, cz: number, w: number, d: number, top: number) => {
    out.push({ x: cx, z: cz + d / 2, hw: w / 2, hd: 0.25, rot: 0, top }, { x: cx, z: cz - d / 2, hw: w / 2, hd: 0.25, rot: 0, top })
    out.push({ x: cx + w / 2, z: cz, hw: 0.25, hd: d / 2, rot: 0, top }, { x: cx - w / 2, z: cz, hw: 0.25, hd: d / 2, rot: 0, top })
  }
  for (const [cx, cz, w, d] of [
    [-26, -14, 30, 26],
    [26, -16, 26, 20],
    [26, 14, 20, 14],
    [30, -42, 18, 12],
    [37, 31, 24, 12],
  ])
    ring(cx, cz, w, d, 1.8)
  for (const [cx, cz, w, d, h] of [
    [-24, 17, 16, 12, 8],
    [0, -42, 32, 16, 4.2],
    [-30, -42, 14, 10, 6],
  ])
    ring(cx, cz, w, d, h)
  out.push({ x: -6, z: 42, hw: 0.8, hd: 0.8, rot: 0, top: 7 }, { x: 6, z: 42, hw: 0.8, hd: 0.8, rot: 0, top: 7 })
  out.push({ x: -10, z: 44, hw: 2, hd: 1.5, rot: 0, top: 3.4 }, { x: 10, z: 46, hw: 1.1, hd: 0.6, rot: 0, top: 1.2 })
  out.push({ x: -36, z: 42, hw: 29, hd: 0.35, rot: 0, top: 2.4 }, { x: 36, z: 42, hw: 29, hd: 0.35, rot: 0, top: 2.4 })
  // The sides and the back, closing the park.
  out.push({ x: -65, z: -7, hw: 0.35, hd: 49, rot: 0, top: 2.4 }, { x: 65, z: -7, hw: 0.35, hd: 49, rot: 0, top: 2.4 })
  out.push({ x: 0, z: -56, hw: 65, hd: 0.35, rot: 0, top: 2.4 })
  return out
})()
