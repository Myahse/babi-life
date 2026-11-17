import type { Builder, Recipe, V } from './kit'

// « Mini-jeux réalistes »: sport and games (the balls, the goal and the hoop, the weights, the
// racket, the boules, the controller, cards, dice, draughts, chips), what moves (the kart, the bike,
// the pirogue, the buoy, the surfboard), the darts, the rope, the mat, the stopwatch, the cup and the
// medal. Same sizes as the old props.

/** A rod between two points of the xy plane (at depth z): a bike's tube, an easel's leg. */
export function rod(b: Builder, a: [number, number], e: [number, number], t: number, c: string, z = 0, tile = 'metal') {
  const dx = e[0] - a[0]
  const dy = e[1] - a[1]
  b.cyl([(a[0] + e[0]) / 2, (a[1] + e[1]) / 2, z], t, Math.hypot(dx, dy), c, { tile, seg: 6, r: [0, 0, Math.atan2(-dx, dy)] })
}

/** A wheel standing in the xy plane: tyre, rim, hub (and spokes for a bike). */
function wheel(b: Builder, p: V, r: number, t: number, spokes: number) {
  b.ring(p, r, t, '#212529', { tile: 'plastic', seg: 18, r: [Math.PI / 2, 0, 0] })
  b.ring(p, r - t * 0.9, t * 0.3, '#adb5bd', { tile: 'metal', seg: 16, r: [Math.PI / 2, 0, 0] })
  b.cyl(p, 0.035, 0.08, '#868e96', { tile: 'metal', seg: 8, r: [Math.PI / 2, 0, 0] })
  for (let k = 0; k < spokes; k++) b.box(p, [0.006, (r - t) * 2, 0.006], '#ced4da', { r: [0, 0, (k * Math.PI) / spokes] })
}

export const SPORT: Record<string, Recipe> = {
  /** A basketball: the pebbled orange leather, its black seams round and across. */
  'ballon-basket': (b, q) => {
    b.ball([0, 0.32, 0], 0.32, '#e8590c', { tile: 'sponge', seg: q.lo ? 12 : 16 })
    for (const r of [[0, 0, 0], [Math.PI / 2, 0, 0], [0, 0, Math.PI / 2]] as V[]) b.ring([0, 0.32, 0], 0.322, 0.012, '#2b1a0e', { seg: 24, r })
    if (!q.lo) for (const s of [-1, 1]) b.ring([s * 0.16, 0.32, 0], 0.28, 0.011, '#2b1a0e', { seg: 20, r: [0, 0, Math.PI / 2], s: [1, 1, 1] })
  },

  /** A football goal: white tubes, the net hanging back in its mesh, pegs in the ground. */
  but: (b, q) => {
    for (const x of [-0.55, 0.55]) {
      b.cyl([x, 0.36, 0.2], 0.035, 0.72, '#ffffff', { tile: 'plastic', seg: 8 })
      b.box([x, 0.02, -0.05], [0.05, 0.04, 0.5], '#dee2e6', { tile: 'metal' })
      b.cyl([x, 0.36, -0.05], 0.012, 0.86, '#dee2e6', { tile: 'metal', seg: 5, r: [0.607, 0, 0] })
    }
    b.cyl([0, 0.72, 0.2], 0.035, 1.17, '#ffffff', { tile: 'plastic', seg: 8, r: [0, 0, Math.PI / 2] })
    const cols = q.lo ? 7 : 13
    for (let i = 0; i < cols; i++) b.box([-0.55 + (i * 1.1) / (cols - 1), 0.36, -0.05], [0.008, 0.88, 0.008], '#e9ecef', { r: [0.607, 0, 0] })
    for (let i = 1; i < (q.lo ? 4 : 8); i++) {
      const y = (i * 0.72) / (q.lo ? 4 : 8)
      b.box([0, y, 0.2 - (0.72 - y) * 0.694], [1.1, 0.008, 0.008], '#e9ecef')
    }
  },

  /** A basketball hoop: the grey post on its base, the white backboard and its red square, the orange ring, the net. */
  'panier-basket': (b, q) => {
    b.box([0, 0.04, -0.25], [0.4, 0.08, 0.3], '#495057', { tile: 'cement' })
    b.cyl([0, 0.55, -0.25], 0.04, 1.0, '#868e96', { tile: 'metal', seg: 8 })
    b.box([0, 0.95, -0.12], [0.7, 0.45, 0.04], '#f8f9fa', { tile: 'plastic' })
    for (const [x, y, w, h] of [[0, 0.88, 0.24, 0.025], [0, 1.02, 0.24, 0.025], [-0.11, 0.95, 0.025, 0.16], [0.11, 0.95, 0.025, 0.16]]) b.box([x, y, -0.097], [w, h, 0.01], '#e03131')
    b.box([0, 0.8, -0.02], [0.06, 0.03, 0.14], '#e8590c', { tile: 'metal' })
    b.ring([0, 0.8, 0.07], 0.16, 0.016, '#f76707', { tile: 'metal', seg: 16 })
    const n = q.lo ? 6 : 10
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2
      b.box([Math.cos(a) * 0.13, 0.7, 0.07 + Math.sin(a) * 0.13], [0.008, 0.2, 0.008], '#f1f3f5', { r: [Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25] })
    }
    b.ring([0, 0.62, 0.07], 0.1, 0.008, '#f1f3f5', { seg: 10 })
  },

  /** A dumbbell: the knurled steel bar, the cast plates, the collars. */
  haltere: (b) => {
    b.cyl([0, 0.2, 0], 0.035, 0.8, '#adb5bd', { tile: 'keys', seg: 8, r: [0, 0, Math.PI / 2] })
    for (const x of [-0.3, 0.3]) {
      b.cyl([x, 0.2, 0], 0.2, 0.1, '#343a40', { tile: 'soot', seg: 10, r: [0, 0, Math.PI / 2] })
      b.cyl([x * 1.3, 0.2, 0], 0.15, 0.07, '#495057', { tile: 'soot', seg: 10, r: [0, 0, Math.PI / 2] })
      b.cyl([x * 1.48, 0.2, 0], 0.05, 0.04, '#ced4da', { tile: 'metal', seg: 8, r: [0, 0, Math.PI / 2] })
    }
  },

  /** A tennis racket lying down: the red frame, the strings' mesh, the throat, the wrapped grip. */
  raquette: (b, q) => {
    const R = 0.5
    const cs = Math.cos(R)
    const sn = Math.sin(R)
    const at = (x: number, z: number): V => [x * cs + z * sn, 0.04, -x * sn + z * cs]
    b.ring(at(0, -0.15), 0.3, 0.032, '#e03131', { tile: 'gloss', seg: 18, s: [0.78, 1, 1], r: [0, R, 0] })
    const n = q.lo ? 5 : 9
    for (let i = 0; i < n; i++) {
      const u = -0.2 + (i * 0.4) / (n - 1)
      b.box(at(u, -0.15), [0.006, 0.006, 0.56 - Math.abs(u) * 1.1], '#f1f3f5', { r: [0, R, 0] })
      const z = -0.38 + (i * 0.46) / (n - 1)
      b.box(at(0, z), [0.44 - Math.abs(z + 0.15) * 0.8, 0.006, 0.006], '#f1f3f5', { r: [0, R, 0] })
    }
    for (const s of [-1, 1]) b.box(at(s * 0.05, 0.22), [0.03, 0.05, 0.2], '#e03131', { tile: 'gloss', r: [0, R - s * 0.25, 0] })
    b.box(at(0, 0.45), [0.08, 0.08, 0.26], '#212529', { tile: 'thread', r: [0, R, 0] })
  },

  /** A volleyball net between two posts: the white top band, the black mesh, the weighted bases. */
  filet: (b, q) => {
    for (const x of [-0.55, 0.55]) {
      b.cyl([x, 0.42, 0], 0.035, 0.84, '#495057', { tile: 'metal', seg: 8 })
      b.cyl([x, 0.03, 0], 0.1, 0.06, '#343a40', { tile: 'soot', seg: 10 })
    }
    b.box([0, 0.78, 0], [1.06, 0.06, 0.012], '#ffffff', { tile: 'fabric' })
    b.box([0, 0.39, 0], [1.06, 0.03, 0.012], '#ffffff', { tile: 'fabric' })
    const rows = q.lo ? 4 : 7
    for (let i = 1; i < rows; i++) b.box([0, 0.39 + (i * 0.39) / rows, 0], [1.06, 0.006, 0.006], '#212529')
    const cols = q.lo ? 11 : 21
    for (let i = 0; i < cols; i++) b.box([-0.5 + (i * 1.0) / (cols - 1), 0.585, 0], [0.006, 0.39, 0.006], '#212529')
  },

  /** A bowling pin: the white lacquer, two red stripes at the neck. */
  quille: (b, q) => {
    b.lathe([0, 0, 0], [[0.001, 0], [0.1, 0], [0.15, 0.12], [0.16, 0.25], [0.12, 0.38], [0.07, 0.5], [0.075, 0.58], [0.1, 0.66], [0.07, 0.74], [0.001, 0.76]], '#f8f9fa', { tile: 'gloss', seg: q.lo ? 10 : 14 })
    b.cyl([0, 0.47, 0], 0.088, 0.035, '#e03131', { seg: 12, open: true, top: 0.078 })
    b.cyl([0, 0.53, 0], 0.074, 0.03, '#e03131', { seg: 12, open: true })
  },

  /** A steel pétanque boule with its engraved grooves, and the little wooden jack. */
  'boule-petanque': (b, q) => {
    b.ball([0, 0.26, 0], 0.26, '#ced4da', { tile: 'alu', seg: q.lo ? 12 : 16 })
    for (const t of [0.4, -0.4]) b.ring([0, 0.26, 0], 0.255, 0.008, '#495057', { seg: 24, r: [Math.PI / 2 + t, 0, 0] })
    b.ball([0.38, 0.07, 0.22], 0.07, '#f08c00', { tile: 'wood', seg: 8 })
  },

  /** A game controller: the dark grips, the cross, the four coloured buttons, the two sticks. */
  manette: (b) => {
    b.box([0, 0.08, 0], [0.66, 0.14, 0.3], '#343a40', { tile: 'plastic', bevel: 0.05 })
    for (const s of [-1, 1]) b.box([s * 0.26, 0.07, 0.14], [0.2, 0.13, 0.3], '#343a40', { tile: 'plastic', r: [0, -s * 0.35, 0], bevel: 0.05 })
    b.box([-0.2, 0.155, -0.01], [0.15, 0.025, 0.045], '#111111', { tile: 'plastic' })
    b.box([-0.2, 0.155, -0.01], [0.045, 0.025, 0.15], '#111111', { tile: 'plastic' })
    for (const [x, z, c] of [[0.24, -0.07, '#2f9e44'], [0.3, -0.01, '#e03131'], [0.18, -0.01, '#1c7ed6'], [0.24, 0.05, '#fab005']] as const) b.cyl([x, 0.155, z], 0.026, 0.025, c, { tile: 'gloss', seg: 8 })
    for (const x of [-0.07, 0.07]) {
      b.cyl([x, 0.16, 0.08], 0.04, 0.04, '#111111', { tile: 'plastic', seg: 10 })
      b.cyl([x, 0.185, 0.08], 0.045, 0.012, '#212529', { tile: 'sponge', seg: 10 })
    }
    b.on('glow').box([0, 0.152, -0.1], [0.08, 0.004, 0.02], '#4dabf7').on('solid')
  },

  /** Two playing cards: the blue back with its pattern, the ace of hearts on top. */
  'carte-jeu': (b) => {
    b.box([-0.1, 0.008, -0.04], [0.46, 0.012, 0.66], '#1c3f95', { tile: 'kente', r: [0, 0.35, 0] })
    b.box([-0.1, 0.0145, -0.04], [0.4, 0.002, 0.6], '#ffffff', { tile: 'thread', r: [0, 0.35, 0] })
    b.box([0.08, 0.022, 0.02], [0.46, 0.012, 0.66], '#ffffff', { tile: 'paper', r: [0, -0.12, 0] })
    // The heart: two lobes and the point.
    const cs = Math.cos(-0.12)
    const sn = Math.sin(-0.12)
    const at = (x: number, z: number): V => [0.08 + x * cs + z * sn, 0.03, 0.02 - x * sn + z * cs]
    for (const s of [-1, 1]) b.cyl(at(s * 0.065, -0.04), 0.08, 0.008, '#e03131', { seg: 10 })
    b.box(at(0, 0.04), [0.15, 0.008, 0.15], '#e03131', { r: [0, Math.PI / 4 - 0.12, 0] })
    for (const [x, z] of [[-0.17, -0.27], [0.17, 0.27]]) b.box(at(x, z), [0.04, 0.008, 0.06], '#e03131', { r: [0, -0.12, 0] })
  },

  /** A white die with its black pips, its corners rounded. */
  de: (b) => {
    const R = 0.5
    const cs = Math.cos(R)
    const sn = Math.sin(R)
    const at = (x: number, y: number, z: number): V => [x * cs + z * sn, y, -x * sn + z * cs]
    b.box([0, 0.25, 0], [0.5, 0.5, 0.5], '#f8f9fa', { tile: 'plastic', r: [0, R, 0], bevel: 0.04 })
    // The pips: little dark squares sunk in each face (five on top, two in front, three on the side).
    for (const [x, z] of [[0, 0], [-0.14, -0.14], [0.14, 0.14], [-0.14, 0.14], [0.14, -0.14]]) b.box(at(x, 0.5, z), [0.075, 0.014, 0.075], '#212529', { r: [0, R, 0] })
    for (const [x, y] of [[-0.13, 0.38], [0.13, 0.12]]) b.box(at(x, y, 0.25), [0.075, 0.075, 0.014], '#212529', { r: [0, R, 0] })
    for (const [z, y] of [[-0.14, 0.39], [0, 0.25], [0.14, 0.11]]) b.box(at(0.25, y, z), [0.014, 0.075, 0.075], '#212529', { r: [0, R, 0] })
  },

  /** A draughts board: the wooden frame, the light and dark squares, black and white pieces. */
  damier: (b, q) => {
    b.box([0, 0.04, 0], [1, 0.08, 1], '#6b3e1d', { tile: 'wood' })
    for (let k = 0; k < 64; k++) {
      const i = k % 8
      const j = Math.floor(k / 8)
      b.box([(i - 3.5) * 0.11, 0.084, (j - 3.5) * 0.11], [0.11, 0.008, 0.11], (i + j) % 2 ? '#3d2412' : '#f3d9a4', { tile: q.lo ? 'plain' : 'wood' })
    }
    for (const [i, j, t] of [[1, 0, 1], [3, 0, 1], [5, 0, 1], [0, 1, 1], [4, 1, 1], [2, 6, 0], [6, 6, 0], [1, 7, 0], [5, 7, 0], [3, 4, 0]]) {
      b.cyl([(i - 3.5) * 0.11, 0.105, (j - 3.5) * 0.11], 0.045, 0.035, t ? '#212529' : '#f8f9fa', { tile: 'gloss', seg: 10 })
      if (!q.lo) b.ring([(i - 3.5) * 0.11, 0.123, (j - 3.5) * 0.11], 0.028, 0.006, t ? '#495057' : '#ced4da', { seg: 8 })
    }
  },

  /** A stack of casino chips with their white edge marks, one black one lying beside. */
  jeton: (b, q) => {
    ;['#e03131', '#1c7ed6', '#2f9e44', '#e03131'].forEach((c, i) => {
      const p: V = [-0.08 + (i % 2) * 0.02, 0.035 + i * 0.07, 0]
      b.cyl(p, 0.2, 0.065, c, { tile: 'plastic', seg: 16 })
      if (!q.lo) for (let k = 0; k < 6; k++) b.box([p[0] + Math.cos(k * 1.047) * 0.19, p[1], Math.sin(k * 1.047) * 0.19], [0.03, 0.067, 0.06], '#ffffff', { r: [0, -k * 1.047, 0] })
      b.ring([p[0], p[1] + 0.034, 0], 0.13, 0.008, '#ffffff', { seg: 14 })
    })
    b.cyl([0.26, 0.035, 0.22], 0.2, 0.065, '#212529', { tile: 'plastic', seg: 16 })
    b.cyl([0.26, 0.07, 0.22], 0.11, 0.006, '#fab005', { tile: 'metal', seg: 14 })
  },

  /** A racing kart: the red tub, the yellow bumpers, the bucket seat, the engine behind, the fat slick tyres. */
  kart: (b, q) => {
    b.box([0, 0.12, 0], [0.5, 0.08, 0.9], '#e03131', { tile: 'gloss' })
    for (const z of [0.44, -0.44]) b.box([0, 0.16, z], [0.62, 0.1, 0.08], '#fab005', { tile: 'plastic' })
    b.box([0, 0.22, -0.12], [0.3, 0.12, 0.26], '#212529', { tile: 'fabric' })
    b.box([0, 0.36, -0.24], [0.3, 0.26, 0.06], '#212529', { tile: 'fabric', r: [-0.15, 0, 0] })
    b.box([0, 0.24, -0.38], [0.22, 0.16, 0.12], '#868e96', { tile: 'metal' })
    b.cyl([0.1, 0.32, -0.42], 0.03, 0.12, '#495057', { tile: 'soot', seg: 6, r: [Math.PI / 2, 0, 0] })
    b.box([0, 0.3, 0.26], [0.04, 0.18, 0.04], '#495057', { tile: 'metal', r: [0.7, 0, 0] })
    b.ring([0, 0.4, 0.33], 0.09, 0.02, '#212529', { tile: 'fabric', seg: 12, r: [0.7 - Math.PI / 2, 0, 0] })
    b.box([0, 0.2, 0.36], [0.16, 0.06, 0.02], '#ffffff', { tile: 'page', fit: true, r: [-0.3, 0, 0] })
    for (const [x, z] of [[0.34, 0.3], [-0.34, 0.3], [0.36, -0.3], [-0.36, -0.3]]) {
      b.cyl([x, 0.13, z], 0.13, z < 0 ? 0.16 : 0.12, '#212529', { tile: 'soot', seg: q.lo ? 10 : 14, r: [0, 0, Math.PI / 2] })
      b.cyl([x * 1.02, 0.13, z], 0.065, 0.13, '#ced4da', { tile: 'metal', seg: 8, r: [0, 0, Math.PI / 2] })
    }
  },

  /** A bicycle seen from the side: two spoked wheels, the blue frame's tubes, the saddle, the handlebar, the chainring. */
  velo: (b, q) => {
    for (const x of [-0.36, 0.36]) wheel(b, [x, 0.27, 0], 0.24, 0.03, q.lo ? 3 : 6)
    const B = '#1c7ed6'
    rod(b, [-0.36, 0.27], [-0.03, 0.27], 0.018, B)
    rod(b, [-0.36, 0.27], [-0.12, 0.58], 0.016, B)
    rod(b, [-0.03, 0.27], [-0.12, 0.6], 0.02, B)
    rod(b, [-0.12, 0.56], [0.24, 0.56], 0.02, B)
    rod(b, [-0.03, 0.27], [0.24, 0.56], 0.022, B)
    rod(b, [0.24, 0.62], [0.36, 0.27], 0.018, B)
    b.box([-0.14, 0.64, 0], [0.18, 0.04, 0.08], '#212529', { tile: 'fabric' })
    b.cyl([0.23, 0.66, 0], 0.016, 0.32, '#495057', { tile: 'metal', seg: 6, r: [Math.PI / 2, 0, 0] })
    for (const z of [-0.15, 0.15]) b.cyl([0.23, 0.66, z], 0.022, 0.06, '#212529', { tile: 'plastic', seg: 6, r: [Math.PI / 2, 0, 0] })
    b.cyl([-0.03, 0.27, 0.03], 0.07, 0.012, '#868e96', { tile: 'metal', seg: 12, r: [Math.PI / 2, 0, 0] })
    b.box([-0.03, 0.2, 0.06], [0.1, 0.03, 0.04], '#212529', { tile: 'plastic' })
    if (!q.lo) b.box([-0.19, 0.27, 0.035], [0.34, 0.008, 0.008], '#495057')
  },

  /** A dugout pirogue: the hollowed trunk, its painted bands in orange, white and green, the paddle across it. */
  pirogue: (b, q) => {
    const S = 0.88
    b.lathe([0, 0.04 * S, 0], [[0.001, 0], [0.12 * S, 0], [0.17 * S, 0.1 * S], [0.18 * S, 0.2 * S]], '#7f4f24', { tile: 'wood', seg: 12, s: [3.5, 1, 1], inside: '#5a3518' })
    b.box([-0.18 * S, 0.15 * S, 0.165 * S], [0.4 * S, 0.05 * S, 0.012], '#f08c00', { tile: 'wood' })
    b.box([0.18 * S, 0.15 * S, 0.165 * S], [0.4 * S, 0.05 * S, 0.012], '#2f9e44', { tile: 'wood' })
    b.box([0, 0.15 * S, 0.166 * S], [0.08 * S, 0.05 * S, 0.012], '#ffffff', { tile: 'wood' })
    for (const x of [-0.62, 0.62]) b.box([x * S, 0.22 * S, 0], [0.12 * S, 0.06 * S, 0.1 * S], '#6b3e1d', { tile: 'wood' })
    if (!q.lo) b.box([0, 0.12 * S, 0], [0.04 * S, 0.03 * S, 0.3 * S], '#5a3518', { tile: 'wood' })
    b.cyl([0.1 * S, 0.24 * S, 0], 0.02 * S, 0.6 * S, '#c08a50', { tile: 'wood', seg: 6, r: [Math.PI / 2, 0.5, 0] })
    b.box([(0.1 + Math.sin(0.5) * 0.36) * S, 0.24 * S, Math.cos(0.5) * 0.36 * S], [0.12 * S, 0.02 * S, 0.18 * S], '#c08a50', { tile: 'wood', r: [0, 0.5, 0] })
  },

  /** A lifebuoy standing: the white ring with its four red bands, the rope round it, on its little stand. */
  bouee: (b, q) => {
    b.ring([0, 0.36, 0], 0.26, 0.1, '#f8f9fa', { tile: 'plastic', seg: 20, r: [Math.PI / 2, 0, 0] })
    for (let k = 0; k < 4; k++) b.ring([0, 0.36, 0], 0.26, 0.103, '#e03131', { tile: 'plastic', seg: 4, arc: Math.PI / 4, r: [Math.PI / 2, k * (Math.PI / 2) + Math.PI / 8, 0] })
    if (!q.lo) b.ring([0, 0.36, 0], 0.37, 0.012, '#fab005', { tile: 'thread', seg: 20, r: [Math.PI / 2, 0, 0] })
    b.box([0, 0.03, -0.05], [0.3, 0.06, 0.12], '#495057', { tile: 'wood' })
  },

  /** A surfboard lying down: the glossy turquoise shell, the stringer, the orange stripes, the fin, the leash. */
  'planche-surf': (b, q) => {
    const R = 0.3
    const cs = Math.cos(R)
    const sn = Math.sin(R)
    const at = (x: number, y: number): V => [x * cs, y, -x * sn]
    b.ball([0, 0.05, 0], 1, '#22b8cf', { tile: 'gloss', seg: q.lo ? 12 : 18, s: [0.6, 0.05, 0.2], r: [0, R, 0] })
    b.box(at(0, 0.1), [1.0, 0.004, 0.012], '#ffffff', { r: [0, R, 0] })
    for (const x of [0.15, 0.25]) b.box(at(x, 0.098), [0.05, 0.006, 0.3], '#f76707', { r: [0, R, 0] })
    b.box(at(-0.5, 0.11), [0.1, 0.06, 0.02], '#1864ab', { tile: 'plastic', r: [0, R, 0] })
    if (!q.lo) b.ring(at(-0.58, 0.02), 0.08, 0.008, '#212529', { seg: 10 })
  },

  /** A dart: the steel point, the knurled tungsten barrel, the shaft, the crossed flights. */
  flechette: (b) => {
    const R = 0.4
    const cs = Math.cos(R)
    const sn = Math.sin(R)
    const at = (x: number): V => [x * cs, 0.08, -x * sn]
    b.cone(at(0.42), 0.02, 0.2, '#adb5bd', { tile: 'metal', seg: 6, r: [0, R, -Math.PI / 2] })
    b.cyl(at(0.2), 0.045, 0.25, '#495057', { tile: 'keys', seg: 8, r: [0, R, Math.PI / 2] })
    b.cyl(at(-0.05), 0.02, 0.3, '#212529', { tile: 'plastic', seg: 6, r: [0, R, Math.PI / 2] })
    b.box(at(-0.26), [0.2, 0.16, 0.008], '#e03131', { tile: 'plastic', r: [0, R, 0] })
    b.box(at(-0.26), [0.2, 0.008, 0.16], '#fab005', { tile: 'plastic', r: [0, R, 0] })
  },

  /** A dartboard on its wooden stand: the sisal rings red and white, the bullseye, a dart stuck in it. */
  cible: (b, q) => {
    b.box([0, 0.25, -0.12], [0.08, 0.5, 0.06], '#8a5a32', { tile: 'wood' })
    b.box([0, 0.03, -0.12], [0.4, 0.06, 0.3], '#8a5a32', { tile: 'wood' })
    ;['#212529', '#f8f9fa', '#e03131', '#f8f9fa', '#e03131', '#fab005'].forEach((c, i) => b.cyl([0, 0.52, -0.06 + i * 0.01], 0.42 - i * 0.075, 0.05, c, { tile: 'straw', seg: 20, r: [Math.PI / 2, 0, 0] }))
    if (!q.lo) for (let k = 0; k < 10; k++) b.box([0, 0.52, -0.005], [0.006, 0.8, 0.004], '#adb5bd', { r: [0, 0, (k * Math.PI) / 10] })
    b.cyl([0.06, 0.58, 0.13], 0.02, 0.2, '#495057', { tile: 'keys', seg: 6, r: [Math.PI / 2 + 0.2, -0.4, 0] })
    b.box([0.01, 0.6, 0.24], [0.012, 0.1, 0.08], '#1c7ed6', { tile: 'plastic', r: [0, -0.4, 0] })
  },

  /** A skipping rope on the ground, the yellow cord looped, the red wooden handles. */
  corde: (b) => {
    b.ring([0, 0.025, 0.05], 0.36, 0.022, '#fab005', { tile: 'thread', seg: 20, arc: Math.PI, r: [0, Math.PI, 0] })
    b.ring([0, 0.025, 0.05], 0.36, 0.022, '#fab005', { tile: 'thread', seg: 20, arc: Math.PI, s: [1, 1, 0.5] })
    for (const x of [-0.4, 0.4]) {
      b.cyl([x, 0.045, 0.16], 0.045, 0.24, '#e03131', { tile: 'wood', seg: 8, r: [Math.PI / 2, 0, 0] })
      b.cyl([x, 0.045, 0.29], 0.03, 0.02, '#495057', { tile: 'metal', seg: 8, r: [Math.PI / 2, 0, 0] })
    }
  },

  /** A yoga mat half rolled: the textured purple foam, the roll's spiral end, its strap. */
  'tapis-yoga': (b) => {
    b.box([0.1, 0.012, 0], [0.8, 0.024, 0.45], '#9c36b5', { tile: 'plastic' })
    b.cyl([-0.38, 0.11, 0], 0.11, 0.45, '#862e9c', { tile: 'plastic', seg: 12, r: [Math.PI / 2, 0, 0] })
    for (const z of [-0.226, 0.226]) {
      b.ring([-0.38, 0.11, z], 0.07, 0.008, '#5f1f6e', { seg: 12, r: [Math.PI / 2, 0, 0] })
      b.ring([-0.38, 0.11, z], 0.035, 0.008, '#5f1f6e', { seg: 10, r: [Math.PI / 2, 0, 0] })
    }
    b.ring([-0.38, 0.11, 0.1], 0.115, 0.012, '#212529', { tile: 'fabric', seg: 12, r: [0, 0, Math.PI / 2] })
  },

  /** A stopwatch: the chrome case, the white dial with its marks, the red hand, the crown and its button. */
  chrono: (b, q) => {
    b.box([0, 0.03, -0.02], [0.24, 0.06, 0.14], '#495057', { tile: 'plastic' })
    b.cyl([0, 0.33, 0], 0.3, 0.12, '#ced4da', { tile: 'alu', seg: 20, r: [Math.PI / 2, 0, 0] })
    b.cyl([0, 0.33, 0.05], 0.25, 0.04, '#ffffff', { tile: 'enamel', seg: 20, r: [Math.PI / 2, 0, 0] })
    for (let k = 0; k < 12; k++) if (!q.lo || k % 3 === 0) b.box([Math.sin((k * Math.PI) / 6) * 0.2, 0.33 + Math.cos((k * Math.PI) / 6) * 0.2, 0.072], [0.02, k % 3 ? 0.03 : 0.05, 0.006], '#212529', { r: [0, 0, -(k * Math.PI) / 6] })
    b.box([Math.sin(0.7) * 0.08, 0.33 + Math.cos(0.7) * 0.08, 0.078], [0.02, 0.17, 0.006], '#e03131', { r: [0, 0, -0.7] })
    b.cyl([0, 0.33, 0.08], 0.02, 0.012, '#212529', { seg: 8, r: [Math.PI / 2, 0, 0] })
    b.cyl([0, 0.66, 0], 0.04, 0.08, '#868e96', { tile: 'metal', seg: 8 })
    b.box([0, 0.72, 0], [0.14, 0.04, 0.08], '#e03131', { tile: 'plastic' })
    b.on('glass').cyl([0, 0.33, 0.075], 0.25, 0.01, '#ffffff', { seg: 20, r: [Math.PI / 2, 0, 0] }).on('solid')
  },

  /** A gold cup: the dark plinth with its plate, the stem, the bowl, two handles. */
  trophee: (b, q) => {
    b.box([0, 0.07, 0], [0.34, 0.14, 0.34], '#343a40', { tile: 'wood' })
    b.box([0, 0.07, 0.171], [0.18, 0.05, 0.006], '#e8b923', { tile: 'metal' })
    b.lathe([0, 0.14, 0], [[0.001, 0], [0.12, 0], [0.07, 0.06], [0.04, 0.08], [0.035, 0.2], [0.08, 0.24], [0.2, 0.33], [0.25, 0.48], [0.24, 0.5]], '#f2c230', { tile: 'metal', seg: q.lo ? 12 : 16, inside: '#c99a14' })
    for (const s of [-1, 1]) b.ring([s * 0.26, 0.5, 0], 0.08, 0.022, '#f2c230', { tile: 'metal', seg: 10, arc: Math.PI, r: [Math.PI / 2, s > 0 ? -Math.PI / 2 : Math.PI / 2, 0] })
  },

  /** A gold medal on its ribbon: the blue and red ribbon, the medal and its raised star. */
  medaille: (b) => {
    b.box([-0.08, 0.01, -0.2], [0.12, 0.02, 0.5], '#1c7ed6', { tile: 'fabric', r: [0, -0.35, 0] })
    b.box([0.08, 0.012, -0.2], [0.12, 0.02, 0.5], '#e03131', { tile: 'fabric', r: [0, 0.35, 0] })
    b.ring([0, 0.03, -0.03], 0.04, 0.012, '#e8b923', { tile: 'metal', seg: 8, r: [Math.PI / 2, 0, 0] })
    b.cyl([0, 0.03, 0.15], 0.2, 0.06, '#f2c230', { tile: 'metal', seg: 18 })
    b.ring([0, 0.06, 0.15], 0.17, 0.012, '#c99a14', { tile: 'metal', seg: 18 })
    b.cyl([0, 0.066, 0.15], 0.1, 0.012, '#e8b923', { tile: 'metal', seg: 5 })
  },
}
