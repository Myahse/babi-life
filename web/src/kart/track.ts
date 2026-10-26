import * as THREE from 'three'

// The circuit of Babi Karting: a closed loop laid flat, about 760 m round, the
// road 13 m wide. The middle line is a Catmull-Rom spline through the corners
// below, sampled every metre; everything else (the edges, the kerbs, the
// tyre walls, where a kart is along the lap and how far off the middle) is
// read from those samples.

export type Track = {
  /** Metres round. */
  length: number
  /** Half the road's width. */
  half: number
  /** A sample per metre: the middle line, its direction (unit), the distance from the start line. */
  x: Float32Array
  z: Float32Array
  tx: Float32Array
  tz: Float32Array
  n: number
  /** The item boxes (rows across the road) and the boost pads: a distance along the lap, an offset across. */
  boxes: { s: number; d: number }[]
  pads: { s: number; d: number }[]
  /** The coins (lines of them along the road) and the ramps (across the whole road, where along the lap). */
  coins: { s: number; d: number }[]
  ramps: number[]
}

/** The corners, in metres: the start straight runs along +x at the bottom. */
const CORNERS: [number, number][] = [
  [-60, 70],
  [40, 70],
  [95, 62],
  [118, 30],
  [102, 0],
  [70, -8],
  [52, -30],
  [66, -62],
  [100, -78],
  [112, -108],
  [82, -128],
  [20, -122],
  [-10, -100],
  [-4, -66],
  [-30, -44],
  [-72, -52],
  [-108, -40],
  [-118, -5],
  [-100, 40],
]

export const HALF = 6.5
export const LAPS = 3

/** A closed track through `corners` (the karting's by default), `half` its half-width. */
export function buildTrack(corners: [number, number][] = CORNERS, half = HALF): Track {
  const curve = new THREE.CatmullRomCurve3(
    corners.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    true,
    'centripetal',
  )
  const length = curve.getLength()
  const n = Math.round(length)
  const x = new Float32Array(n)
  const z = new Float32Array(n)
  const tx = new Float32Array(n)
  const tz = new Float32Array(n)
  const p = new THREE.Vector3()
  const t = new THREE.Vector3()
  for (let i = 0; i < n; i++) {
    // The start line a little way along the bottom straight.
    const u = (i / n + 0.03) % 1
    curve.getPointAt(u, p)
    curve.getTangentAt(u, t)
    x[i] = p.x
    z[i] = p.z
    const l = Math.hypot(t.x, t.z) || 1
    tx[i] = t.x / l
    tz[i] = t.z / l
  }
  // Item boxes in rows of four across the road, three times a lap; boost pads on the straights' way out of the bends.
  const boxes = [0.2, 0.52, 0.8].flatMap((k) => [-4.5, -1.5, 1.5, 4.5].map((d) => ({ s: Math.round(k * n), d })))
  const pads = [
    { s: Math.round(0.36 * n), d: -2.5 },
    { s: Math.round(0.66 * n), d: 2.5 },
    { s: Math.round(0.93 * n), d: 0 },
  ]
  // Lines of five coins, swinging from one side of the road to the other round the lap; two ramps.
  const coins = [0.08, 0.28, 0.44, 0.6, 0.74, 0.88].flatMap((k, j) => [0, 1, 2, 3, 4].map((c) => ({ s: Math.round(k * n) + c * 3, d: [-3.5, 0, 3.5][j % 3] })))
  const ramps = [Math.round(0.42 * n), Math.round(0.97 * n)]
  return { length: n, half, x, z, tx, tz, n, boxes, pads, coins, ramps }
}

/**
 * A point at distance `s` along the lap and `d` metres across: `d` counts
 * along the side vector (−tz, tx), which is the driver's right hand.
 */
export function pointAt(tr: Track, s: number, d = 0): [number, number] {
  const i = ((Math.floor(s) % tr.n) + tr.n) % tr.n
  return [tr.x[i] - tr.tz[i] * d, tr.z[i] + tr.tx[i] * d]
}

/**
 * Where a point is on the track: the nearest sample (searched around `hint`
 * when there is one, all round otherwise), the distance along the lap, and
 * the signed offset across (along the side vector, see pointAt).
 */
export function locate(tr: Track, px: number, pz: number, hint = -1): { i: number; s: number; d: number } {
  let best = 0
  let bestD = Infinity
  const scan = (i: number) => {
    const j = ((i % tr.n) + tr.n) % tr.n
    const dd = (tr.x[j] - px) ** 2 + (tr.z[j] - pz) ** 2
    if (dd < bestD) {
      bestD = dd
      best = j
    }
  }
  if (hint < 0) for (let i = 0; i < tr.n; i++) scan(i)
  else for (let k = -30; k <= 30; k++) scan(hint + k)
  const d = (px - tr.x[best]) * -tr.tz[best] + (pz - tr.z[best]) * tr.tx[best]
  // Along: the sample, plus how far past it (projected on the way).
  const along = (px - tr.x[best]) * tr.tx[best] + (pz - tr.z[best]) * tr.tz[best]
  return { i: best, s: best + along, d }
}

/** The heading (rotation about y, three.js style: 0 faces +z) of the way at a sample. */
export const headingAt = (tr: Track, i: number) => Math.atan2(tr.tx[i], tr.tz[i])
