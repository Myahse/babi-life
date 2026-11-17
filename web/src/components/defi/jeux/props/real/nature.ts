import type { Builder, Q, Recipe, V } from './kit'

// « Mini-jeux réalistes »: the lagoon and the beach (shell, crab, a live fish, the wave, palms), the
// animals of the parks and the zoo (lion, giraffe, elephant, monkey, parrot, crocodile, turtle, a
// bird, a butterfly), and the sky (the plane, a cloud, the sun, the moon, a star). Still blocks, but
// rounded where the beast is, with fur, hide and feather tiles. Same sizes as the old props.

/** Turns a point of a prop drawn facing +z by an angle round y (the old props turned their group; here every block). */
const turn = (a: number) => {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return (x: number, y: number, z: number, k = 1): V => [(x * c + z * s) * k, y * k, (-x * s + z * c) * k]
}

/** Four legs, tapering, with darker hooves or paws. */
function legs(b: Builder, at: (x: number, y: number, z: number) => V, a: number, k: number, xz: [number, number][], h: number, w: number, c: string, foot: string, tile: string) {
  for (const [x, z] of xz) {
    b.box(at(x, h / 2 + 0.03, z), [w * k, (h - 0.06) * k, w * k], c, { tile, r: [0, a, 0] })
    b.box(at(x, 0.03, z), [w * 1.05 * k, 0.06 * k, w * 1.1 * k], foot, { r: [0, a, 0] })
  }
}

/** Two eyes on a head's front: the white, the dark pupil (k: the prop's scale). */
function eyes(b: Builder, at: (x: number, y: number, z: number) => V, xs: number, y: number, z: number, r: number, k: number, white = '#f8f9fa') {
  for (const x of [-xs, xs]) {
    b.ball(at(x, y, z), r * k, white, { seg: 6 })
    b.ball(at(x * 1.05, y, z + r * 0.6), r * 0.55 * k, '#111111', { seg: 5 })
  }
}

export const NATURE: Record<string, Recipe> = {
  /** A scallop shell: the ribs fanning out, pink to coral, the hinge's little ears. */
  coquillage: (b, q) => {
    const at = turn(0.3)
    const n = q.lo ? 7 : 11
    for (let k = 0; k < n; k++) {
      const a = -0.9 + (k * 1.8) / (n - 1)
      const mid = 1 - Math.abs(k - (n - 1) / 2) / ((n - 1) / 2)
      b.box(at(Math.sin(a) * 0.22, 0.04 + mid * 0.05, -0.18 + Math.cos(a) * 0.22), [0.07, 0.08 + mid * 0.04, 0.44 - (1 - mid) * 0.1], k % 2 ? '#ffc9c9' : '#ffa8a8', { tile: 'skin', r: [0, 0.3 + a, 0] })
    }
    b.box(at(0, 0.05, -0.2), [0.24, 0.08, 0.08], '#f08c8c', { tile: 'skin', r: [0, 0.3, 0] })
  },

  /** A lagoon crab: the orange shell's bumps, the eyes on stalks, the two big pincers raised, three legs a side. */
  crabe: (b, q) => {
    b.ball([0, 0.18, 0], 0.27, '#e8590c', { tile: 'hide', seg: q.lo ? 8 : 12, s: [1, 0.36, 0.72] })
    b.ball([0, 0.22, -0.02], 0.22, '#f76707', { tile: 'skin', seg: 10, s: [1, 0.3, 0.7] })
    for (const x of [-0.08, 0.08]) {
      b.cyl([x, 0.3, 0.14], 0.015, 0.12, '#e8590c', { seg: 5 })
      b.ball([x, 0.37, 0.14], 0.035, '#111111', { seg: 6 })
    }
    for (const sd of [-1, 1]) {
      b.cyl([sd * 0.3, 0.24, 0.18], 0.04, 0.18, '#e8590c', { tile: 'hide', seg: 6, r: [0.9, 0, sd * 0.6] })
      b.ball([sd * 0.37, 0.33, 0.28], 0.08, '#d9480f', { tile: 'hide', seg: 8, s: [1, 0.8, 1.2] })
      b.cone([sd * 0.34, 0.42, 0.3], 0.03, 0.12, '#d9480f', { seg: 5 })
      b.cone([sd * 0.41, 0.4, 0.3], 0.028, 0.08, '#d9480f', { seg: 5, r: [0, 0, -sd * 0.4] })
      for (const z of [-0.14, -0.02, 0.1]) {
        b.box([sd * 0.33, 0.13, z], [0.18, 0.035, 0.035], '#d9480f', { tile: 'hide', r: [0, 0, sd * -0.6] })
        b.box([sd * 0.43, 0.04, z], [0.03, 0.12, 0.03], '#d9480f', { r: [0, 0, sd * 0.3] })
      }
    }
  },

  /** A live fish on its little stand: the blue body's scales, the yellow fins and tail, the white bands, the eye. */
  'poisson-vivant': (b, q) => {
    const at = turn(0.25)
    b.ball(at(0, 0.27, 0), 0.22, '#1c7ed6', { tile: 'scales', seg: q.lo ? 10 : 14, s: [1.5, 1, 0.5], r: [0, 0.25, 0] })
    b.cone(at(-0.43, 0.27, 0), 0.2, 0.24, '#fcc419', { tile: 'fabric', seg: 4, s: [1, 1, 0.3], r: [0, 0.25, Math.PI / 2] })
    b.cone(at(0, 0.5, 0), 0.08, 0.16, '#fcc419', { tile: 'fabric', seg: 4, s: [1.6, 1, 0.25], r: [0, 0.25, -0.3] })
    for (const [x, r] of [[0.05, 0.226], [-0.15, 0.205]]) b.cyl(at(x, 0.27, 0), r, 0.05, '#f8f9fa', { seg: 12, s: [1, 1, 0.55], r: [0, 0.25, Math.PI / 2], open: true })
    for (const sd of [-1, 1]) {
      b.ball(at(0.2, 0.31, sd * 0.085), 0.035, '#f8f9fa', { seg: 6 })
      b.ball(at(0.21, 0.31, sd * 0.105), 0.02, '#111111', { seg: 5 })
    }
    b.box(at(0, 0.03, 0), [0.2, 0.06, 0.12], '#1864ab', { tile: 'plastic', r: [0, 0.25, 0] })
    b.box(at(0, 0.09, 0), [0.03, 0.1, 0.03], '#1864ab', { tile: 'plastic', r: [0, 0.25, 0] })
  },

  /** A breaking wave: the deep water stepping up to the crest, the curl falling over, the white foam on top and at its foot, spray. */
  vague: (b, q) => {
    const A = -0.8
    const at = (x: number, y: number, z: number): V => turn(A)(x * 0.8, y, z)
    const W = 0.88
    for (const [y, z, h, d, c] of [[0.06, 0, 0.12, 0.8, '#1c7ed6'], [0.24, -0.18, 0.26, 0.4, '#228be6'], [0.44, -0.12, 0.16, 0.36, '#339af0'], [0.57, 0.0, 0.12, 0.34, '#4dabf7'], [0.5, 0.21, 0.12, 0.12, '#4dabf7'], [0.4, 0.27, 0.1, 0.08, '#74c0fc']] as const) b.box(at(0, y, z), [W, h, d], c, { tile: 'water', r: [0, A, 0] })
    for (const [y, z, h, d, c] of [[0.65, -0.02, 0.06, 0.3, '#ffffff'], [0.58, 0.2, 0.06, 0.14, '#e7f5ff'], [0.13, 0.3, 0.04, 0.12, '#e7f5ff']] as const) b.box(at(0, y, z), [W + 0.02, h, d], c, { tile: 'foam', r: [0, A, 0] })
    if (!q.lo) for (let i = 0; i < 6; i++) b.ball(at(-0.35 + i * 0.14, 0.72 + (i % 2) * 0.05, 0.05 + (i % 3) * 0.06), 0.035, '#ffffff', { tile: 'foam', seg: 5 })
  },

  /** A palm (the oil palm): the ringed trunk, the fronds' leaflets arching out, the bunch of red nuts. */
  palmier: (b, q) => frond(b, q, [0, 0, 0], 6, 0, ['#7a5230', '#94683c'], '#2b8a3e', '#37b24d', '#e8590c', 0.16, 0.17, 1.04, 8),

  /** A coconut palm leaning: the grey trunk curving, the long drooping fronds, the green-brown nuts. */
  cocotier: (b, q) => frond(b, q, [-0.15, 0, 0], 7, 0.006, ['#8a6440', '#a07850'], '#2f9e44', '#40c057', '#5c3d1e', 0.13, 0.16, 1.12, 7),

  /** A lion: tawny fur, the dark shaggy mane, the muzzle, the tail's tuft. */
  lion: (b, q) => {
    const A = 0.55
    const k = 0.9
    const at = (x: number, y: number, z: number) => turn(A)(x, y, z, k)
    legs(b, at, A, k, [[0.13, 0.22], [-0.13, 0.22], [0.13, -0.24], [-0.13, -0.24]], 0.28, 0.12, '#d4a03a', '#a07028', 'fur')
    b.ball(at(0, 0.42, -0.02), 0.25 * k, '#e0a548', { tile: 'fur', seg: q.lo ? 8 : 12, s: [0.85, 0.65, 1.45], r: [0, A, 0] })
    b.ball(at(0, 0.6, 0.3), 0.3 * k, '#8a4b14', { tile: 'fur', seg: q.lo ? 8 : 12, s: [1.05, 1, 0.6], r: [0, A, 0] })
    b.ball(at(0, 0.58, 0.42), 0.17 * k, '#e8b04f', { tile: 'fur', seg: 10, s: [1.05, 1, 0.9], r: [0, A, 0] })
    b.ball(at(0, 0.5, 0.54), 0.08 * k, '#f3d08c', { tile: 'fur', seg: 8, s: [1.2, 0.8, 0.9], r: [0, A, 0] })
    b.box(at(0, 0.55, 0.585), [0.07 * k, 0.04 * k, 0.03 * k], '#3d2412', { r: [0, A, 0] })
    eyes(b, at, 0.08, 0.64, 0.52, 0.025, k, '#f3d08c')
    for (const x of [-0.12, 0.12]) b.ball(at(x, 0.74, 0.4), 0.04 * k, '#d4a03a', { seg: 6 })
    b.cyl(at(0, 0.5, -0.5), 0.02 * k, 0.32 * k, '#d4a03a', { seg: 5, r: [0.6 + 0, A, 0] })
    b.ball(at(0, 0.38, -0.62), 0.05 * k, '#8a4b14', { tile: 'fur', seg: 6 })
  },

  /** A giraffe: long legs, the patched coat, the long neck with its mane, the ossicones, the long head. */
  girafe: (b, q) => {
    const A = 0.55
    const k = 0.85
    const at = (x: number, y: number, z: number) => turn(A)(x, y, z, k)
    legs(b, at, A, k, [[0.11, 0.18], [-0.11, 0.18], [0.11, -0.18], [-0.11, -0.18]], 0.54, 0.07, '#f2c14e', '#5c3a1c', 'fur')
    b.ball(at(0, 0.66, 0), 0.22 * k, '#f2c14e', { tile: 'fur', seg: q.lo ? 8 : 12, s: [0.8, 0.65, 1.35], r: [0, A, 0] })
    const T = 0.25
    const neck = (y: number, z = 0): V => at(0, 0.72 + y * Math.cos(T), 0.2 + y * Math.sin(T) + z)
    b.cyl(neck(0.34), 0.065 * k, 0.7 * k, '#f2c14e', { tile: 'fur', seg: 8, top: 0.05 * k, r: [T, A, 0] })
    b.box(neck(0.34, -0.07), [0.035 * k, 0.62 * k, 0.035 * k], '#9c5a1a', { tile: 'fur', r: [T, A, 0] })
    b.ball(neck(0.72, 0.06), 0.1 * k, '#f2c14e', { tile: 'fur', seg: 8, s: [0.8, 0.75, 1.5], r: [T, A, 0] })
    b.ball(neck(0.69, 0.2), 0.06 * k, '#e0a548', { tile: 'fur', seg: 6, r: [T, A, 0] })
    for (const x of [-0.05, 0.05]) {
      b.cyl(at(x, 0.72 + 0.84 * Math.cos(T), 0.2 + 0.84 * Math.sin(T) + 0.02), 0.014 * k, 0.08 * k, '#9c5a1a', { seg: 5 })
      b.ball(at(x, 0.72 + 0.88 * Math.cos(T), 0.2 + 0.88 * Math.sin(T) + 0.02), 0.022 * k, '#5c3a1c', { seg: 5 })
      b.ball(at(x * 1.8, 0.72 + 0.76 * Math.cos(T), 0.2 + 0.76 * Math.sin(T) + 0.1), 0.018 * k, '#111111', { seg: 5 })
    }
    // The patches on the coat.
    const spots: [number, number, number][] = [[0.161, 0.7, 0.1], [0.161, 0.62, -0.12], [-0.161, 0.68, -0.02], [-0.161, 0.6, 0.16], [0.05, 0.79, -0.15], [-0.07, 0.79, 0.05], [0.161, 0.58, 0.18], [-0.161, 0.74, -0.18]]
    for (const [x, y, z] of spots.slice(0, q.lo ? 4 : 8)) b.box(at(x * 1.05, y, z), [Math.abs(x) > 0.1 ? 0.012 : 0.1 * k, Math.abs(x) > 0.1 ? 0.09 * k : 0.012, 0.1 * k], '#9c5a1a', { r: [0, A, 0] })
    b.cyl(at(0, 0.58, -0.32), 0.012 * k, 0.22 * k, '#9c5a1a', { seg: 4, r: [0.3, A, 0] })
  },

  /** An elephant: wrinkled grey hide, the big ears pink inside, the trunk curling down, ivory tusks. */
  elephant: (b, q) => {
    const A = 0.5
    const k = 0.85
    const at = (x: number, y: number, z: number) => turn(A)(x, y, z, k)
    legs(b, at, A, k, [[0.15, 0.2], [-0.15, 0.2], [0.15, -0.22], [-0.15, -0.22]], 0.36, 0.17, '#868e96', '#d8d2c4', 'hide')
    b.ball(at(0, 0.52, -0.02), 0.32 * k, '#949ca6', { tile: 'hide', seg: q.lo ? 10 : 14, s: [0.95, 0.8, 1.25], r: [0, A, 0] })
    b.ball(at(0, 0.64, 0.4), 0.22 * k, '#949ca6', { tile: 'hide', seg: q.lo ? 8 : 12, s: [1, 0.95, 0.85], r: [0, A, 0] })
    for (const sd of [-1, 1]) {
      b.ball(at(sd * 0.28, 0.64, 0.34), 0.22 * k, '#adb5bd', { tile: 'hide', seg: 8, s: [0.2, 1, 0.75], r: [0, A + sd * 0.35, 0] })
      b.ball(at(sd * 0.3, 0.64, 0.36), 0.15 * k, '#e5b8b8', { tile: 'skin', seg: 8, s: [0.2, 1, 0.7], r: [0, A + sd * 0.35, 0] })
    }
    // The trunk: overlapping rings tapering down and curling forward at the tip.
    for (const [y, z, r, t] of [[0.5, 0.6, 0.075, 0.2], [0.38, 0.63, 0.065, 0.15], [0.26, 0.65, 0.057, 0.1], [0.15, 0.68, 0.05, 0.2], [0.07, 0.74, 0.045, 0.7]]) b.cyl(at(0, y, z), r * k, 0.15 * k, '#868e96', { tile: 'hide', seg: 8, top: r * 0.92 * k, r: [t, A, 0] })
    for (const x of [-0.11, 0.11]) b.cone(at(x, 0.42, 0.66), 0.03 * k, 0.2 * k, '#fff9db', { tile: 'gloss', seg: 6, r: [1.6, A, 0] })
    eyes(b, at, 0.14, 0.7, 0.57, 0.022, k, '#3a3a3a')
    b.cyl(at(0, 0.5, -0.42), 0.02 * k, 0.24 * k, '#868e96', { seg: 5, r: [0.2, A, 0] })
  },

  /** A monkey sitting: brown fur, the pale face and belly, big ears, a banana in its hands, the curling tail. */
  singe: (b, q) => {
    b.ball([0, 0.27, -0.02], 0.2, '#7a4a24', { tile: 'fur', seg: q.lo ? 8 : 12, s: [0.9, 1, 0.8] })
    b.ball([0, 0.27, 0.08], 0.13, '#d2a679', { tile: 'fur', seg: 8, s: [0.9, 1, 0.5] })
    for (const x of [-0.11, 0.11]) {
      b.ball([x, 0.07, 0.14], 0.08, '#7a4a24', { tile: 'fur', seg: 6, s: [0.9, 0.8, 1.5] })
      b.cyl([x * 1.9, 0.3, 0.08], 0.04, 0.24, '#7a4a24', { tile: 'fur', seg: 6, r: [Math.PI / 2, 0, 0] })
    }
    b.cyl([0, 0.3, 0.24], 0.03, 0.24, '#fcc419', { tile: 'skin', seg: 6, r: [0.3, 0, Math.PI / 2] })
    b.ball([0, 0.62, 0], 0.17, '#7a4a24', { tile: 'fur', seg: q.lo ? 8 : 12 })
    b.ball([0, 0.6, 0.1], 0.12, '#e8c39e', { tile: 'skin', seg: 8, s: [1, 0.95, 0.6] })
    b.ball([0, 0.54, 0.16], 0.07, '#d2a679', { tile: 'skin', seg: 6, s: [1.2, 0.7, 0.7] })
    eyes(b, (x, y, z) => [x, y, z], 0.05, 0.65, 0.15, 0.025, 1, '#3d2412')
    for (const x of [-0.18, 0.18]) b.ball([x, 0.63, 0], 0.06, '#e8c39e', { tile: 'skin', seg: 6, s: [0.5, 1, 1] })
    b.ring([0.16, 0.12, -0.24], 0.1, 0.022, '#7a4a24', { tile: 'fur', arc: Math.PI * 1.4, seg: 10, r: [Math.PI / 2, 0, 0] })
  },

  /** A grey-green parrot on its perch: the feathers, red head, blue wings, the hooked beak, the long red tail. */
  perroquet: (b, q) => {
    b.cyl([0, 0.05, 0], 0.03, 0.5, '#8a5a32', { tile: 'wood', seg: 6, r: [0, 0, Math.PI / 2] })
    for (const x of [-0.2, 0.2]) b.box([x, 0.02, 0], [0.06, 0.04, 0.2], '#8a5a32', { tile: 'wood' })
    for (const x of [-0.05, 0.05]) b.box([x, 0.09, 0.02], [0.04, 0.06, 0.06], '#495057')
    b.ball([0, 0.3, 0], 0.15, '#2f9e44', { tile: 'feather', seg: q.lo ? 8 : 12, s: [0.85, 1.25, 0.8] })
    b.ball([0, 0.28, 0.08], 0.1, '#fab005', { tile: 'feather', seg: 8, s: [0.8, 1.2, 0.5] })
    for (const x of [-0.13, 0.13]) b.ball([x, 0.32, -0.02], 0.12, '#1c7ed6', { tile: 'feather', seg: 8, s: [0.3, 1.25, 0.8] })
    b.ball([0, 0.56, 0.02], 0.12, '#e03131', { tile: 'feather', seg: q.lo ? 8 : 10 })
    b.ball([0, 0.56, 0.12], 0.06, '#f1f3f5', { seg: 6, s: [1, 1, 0.6] })
    b.cone([0, 0.52, 0.17], 0.04, 0.09, '#343a40', { tile: 'gloss', seg: 6, r: [2.2, 0, 0] })
    eyes(b, (x, y, z) => [x, y, z], 0.1, 0.59, 0.06, 0.022, 1)
    b.box([0, 0.06, -0.14], [0.1, 0.32, 0.03], '#e03131', { tile: 'feather', r: [0.5, 0, 0] })
    b.box([0, -0.05, -0.2], [0.07, 0.08, 0.03], '#1c7ed6', { tile: 'feather', r: [0.5, 0, 0] })
  },

  /** A crocodile: the ridged olive hide, the long snout with its teeth, the yellow eyes on top, the tail, the splayed legs. */
  crocodile: (b, q) => {
    const A = 1.0
    const k = 0.78
    const at = (x: number, y: number, z: number) => turn(A)(x, y, z, k)
    b.ball(at(0, 0.12, 0), 0.25 * k, '#4f772d', { tile: 'hide', seg: q.lo ? 8 : 12, s: [0.8, 0.42, 1.45], r: [0, A, 0] })
    b.box(at(0, 0.12, 0.45), [0.26 * k, 0.13 * k, 0.3 * k], '#4f772d', { tile: 'hide', r: [0, A, 0] })
    b.box(at(0, 0.1, 0.7), [0.18 * k, 0.09 * k, 0.32 * k], '#5c8a35', { tile: 'hide', r: [0, A, 0] })
    b.box(at(0, 0.06, 0.66), [0.19 * k, 0.012, 0.34 * k], '#e9ecef', { tile: 'keys', r: [0, A, 0] })
    for (const x of [-0.07, 0.07]) {
      b.ball(at(x, 0.22, 0.48), 0.04 * k, '#5c8a35', { tile: 'hide', seg: 6 })
      b.ball(at(x, 0.235, 0.51), 0.022 * k, '#fcc419', { seg: 5 })
    }
    for (const [z, w, h] of [[-0.44, 0.24, 0.13], [-0.7, 0.15, 0.1], [-0.92, 0.08, 0.07]]) b.box(at(0, 0.03 + h / 2, z), [w * k, h * k, 0.28 * k], '#4f772d', { tile: 'hide', r: [0, A, 0] })
    const ridges = q.lo ? [-0.24, 0.08, -0.44] : [-0.6, -0.44, -0.24, -0.08, 0.08, 0.24]
    for (const z of ridges) for (const x of [-0.05, 0.05]) b.box(at(x, 0.21 - Math.max(0, -z - 0.3) * 0.15, z), [0.04 * k, 0.05 * k, 0.07 * k], '#3a5a20', { tile: 'hide', r: [0, A, 0] })
    for (const [x, z] of [[0.22, 0.2], [-0.22, 0.2], [0.22, -0.2], [-0.22, -0.2]]) b.box(at(x, 0.04, z), [0.16 * k, 0.07 * k, 0.1 * k], '#3a5a20', { tile: 'hide', r: [0, A + (x > 0 ? 0.3 : -0.3), 0] })
  },

  /** A turtle: the domed shell's plates, the lighter rim, the scaly head and legs, the little tail. */
  tortue: (b, q) => {
    const A = 0.5
    const at = turn(A)
    for (const [x, z] of [[0.2, 0.18], [-0.2, 0.18], [0.2, -0.18], [-0.2, -0.18]]) b.ball(at(x, 0.05, z), 0.07, '#82c91e', { tile: 'hide', seg: 6, s: [1.2, 0.7, 1] })
    b.ball(at(0, 0.11, 0.38), 0.08, '#82c91e', { tile: 'hide', seg: 8, s: [1, 0.9, 1.25] })
    eyes(b, at, 0.04, 0.14, 0.44, 0.015, 1, '#111111')
    b.cone(at(0, 0.05, -0.36), 0.03, 0.1, '#82c91e', { seg: 5, r: [-Math.PI / 2, A, 0] })
    b.cyl([0, 0.1, 0], 0.36, 0.06, '#5c940d', { tile: 'hide', seg: 10 })
    b.ball([0, 0.12, 0], 0.32, '#2b8a3e', { tile: 'hide', half: true, seg: q.lo ? 8 : 12, s: [1, 0.55, 1] })
    // The plates: a hexagon on top, six round it.
    b.cyl([0, 0.295, 0], 0.09, 0.01, '#5c940d', { seg: 6 })
    if (!q.lo) for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      b.cyl([Math.cos(a) * 0.19, 0.24, Math.sin(a) * 0.19], 0.07, 0.01, '#5c940d', { seg: 6, r: [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5] })
    }
  },

  /** A little blue bird: round, feathered, the white breast, the orange beak and legs, folded wings and tail. */
  oiseau: (b, q) => {
    const A = 0.4
    const at = turn(A)
    for (const x of [-0.05, 0.05]) b.box(at(x, 0.06, 0), [0.02, 0.12, 0.02], '#f08c00', { r: [0, A, 0] })
    b.ball(at(0, 0.24, 0), 0.16, '#339af0', { tile: 'feather', seg: q.lo ? 8 : 12, s: [1, 0.85, 1.2], r: [0, A, 0] })
    b.ball(at(0, 0.23, 0.06), 0.13, '#e7f5ff', { tile: 'feather', seg: 8, s: [0.8, 0.75, 1], r: [0, A, 0] })
    b.ball(at(0, 0.4, 0.1), 0.11, '#339af0', { tile: 'feather', seg: 10, r: [0, A, 0] })
    b.cone(at(0, 0.39, 0.23), 0.032, 0.09, '#f08c00', { tile: 'gloss', seg: 5, r: [Math.PI / 2, A, 0] })
    eyes(b, at, 0.06, 0.43, 0.18, 0.02, 1)
    for (const sd of [-1, 1]) b.ball(at(sd * 0.13, 0.27, -0.03), 0.12, '#1864ab', { tile: 'feather', seg: 8, s: [0.3, 0.65, 1.15], r: [0, A, 0] })
    b.box(at(0, 0.24, -0.25), [0.12, 0.025, 0.2], '#1864ab', { tile: 'feather', r: [-0.5, A, 0] })
  },

  /** A butterfly: the dark body, the orange wings with their black veins and white spots, the antennae. */
  papillon: (b, q) => {
    b.cyl([0, 0.06, 0], 0.03, 0.4, '#212529', { tile: 'fur', seg: 6, r: [Math.PI / 2, 0, 0] })
    b.ball([0, 0.07, 0.23], 0.04, '#212529', { seg: 6 })
    for (const sd of [-1, 1]) {
      const T = sd * 0.22
      const at = (x: number, y: number, z: number): V => [x * Math.cos(T) - y * Math.sin(T), 0.06 + x * Math.sin(T) + y * Math.cos(T), z]
      b.cyl(at(sd * 0.22, 0, 0.1), 0.2, 0.012, '#f76707', { tile: 'feather', seg: 10, s: [1.1, 1, 0.8], r: [0, 0, T] })
      b.cyl(at(sd * 0.17, 0, -0.12), 0.15, 0.012, '#fd7e14', { tile: 'feather', seg: 10, s: [1, 1, 0.75], r: [0, 0, T] })
      b.ring(at(sd * 0.22, 0.008, 0.1), 0.19, 0.012, '#212529', { seg: 12, s: [1.1, 1, 0.8], r: [0, 0, T] })
      b.cyl(at(sd * 0.36, 0.01, 0.17), 0.04, 0.004, '#ffffff', { seg: 8, r: [0, 0, T] })
      if (!q.lo) b.cyl(at(sd * 0.25, 0.01, -0.16), 0.035, 0.004, '#212529', { seg: 8, r: [0, 0, T] })
    }
    for (const sd of [-1, 1]) b.cyl([sd * 0.04, 0.16, 0.32], 0.006, 0.18, '#212529', { seg: 4, r: [0.9, sd * -0.4, 0] })
  },

  /** An airliner: the white fuselage, the windows' row, the swept wings and engines, the green tail with its orange line. */
  avion: (b, q) => {
    b.cyl([0, 0.25, 0], 0.11, 0.8, '#f8f9fa', { tile: 'plastic', seg: 12, r: [Math.PI / 2, 0, 0] })
    b.ball([0, 0.25, 0.4], 0.11, '#f8f9fa', { tile: 'plastic', seg: 12, s: [1, 1, 1.5] })
    b.cone([0, 0.27, -0.5], 0.11, 0.24, '#f8f9fa', { tile: 'plastic', seg: 12, s: [1, 1, 0.7], r: [-Math.PI / 2, 0, 0] })
    b.on('glass').box([0, 0.29, 0.5], [0.16, 0.05, 0.06], '#1b2a3a', { r: [-0.4, 0, 0] }).on('solid')
    for (const s of [-1, 1]) {
      b.box([s * 0.32, 0.23, -0.02], [0.6, 0.03, 0.22], '#dee2e6', { tile: 'alu', r: [0, s * 0.35, 0] })
      b.cyl([s * 0.3, 0.17, 0.08], 0.05, 0.18, '#adb5bd', { tile: 'alu', seg: 10, r: [Math.PI / 2, 0, 0] })
      b.cyl([s * 0.3, 0.17, 0.17], 0.035, 0.01, '#212529', { seg: 10, r: [Math.PI / 2, 0, 0] })
      b.box([s * 0.62, 0.23, -0.14], [0.06, 0.031, 0.1], '#f08c00')
      if (!q.lo) for (let i = 0; i < 7; i++) b.box([s * 0.109, 0.28, 0.28 - i * 0.08], [0.004, 0.03, 0.03], '#1b2a3a')
      b.box([s * 0.111, 0.25, 0.05], [0.004, 0.025, 0.6], '#f08c00')
    }
    b.box([0, 0.44, -0.52], [0.03, 0.3, 0.18], '#2f9e44', { tile: 'plastic', r: [-0.3, 0, 0] })
    b.box([0, 0.3, -0.54], [0.4, 0.025, 0.12], '#dee2e6', { tile: 'alu' })
    for (const z of [0.3, -0.12]) b.box([0, 0.065, z], [0.025, 0.13, 0.025], '#495057', { tile: 'metal' })
    b.cyl([0, 0.03, 0.3], 0.03, 0.03, '#212529', { seg: 8, r: [0, 0, Math.PI / 2] })
    for (const x of [-0.05, 0.05]) b.cyl([x, 0.03, -0.12], 0.03, 0.03, '#212529', { seg: 8, r: [0, 0, Math.PI / 2] })
  },

  /** A cloud: puffs of white piled up, the flatter grey belly under. */
  nuage: (b, q) => {
    b.ball([0, 0.3, 0], 0.28, '#ffffff', { tile: 'plain', seg: q.lo ? 8 : 12 })
    b.ball([-0.3, 0.2, 0.02], 0.2, '#f8f9fa', { tile: 'plain', seg: q.lo ? 7 : 10 })
    b.ball([0.3, 0.22, 0], 0.22, '#f8f9fa', { tile: 'plain', seg: q.lo ? 7 : 10 })
    b.ball([0.12, 0.42, -0.05], 0.2, '#ffffff', { tile: 'plain', seg: q.lo ? 7 : 10 })
    b.ball([0, 0.12, 0], 0.42, '#dee2e6', { tile: 'plain', seg: 10, s: [1, 0.25, 0.45] })
  },

  /** The sun: a glowing disc, the brighter face, the rays around. */
  soleil: (b) => {
    b.on('glow')
    b.cyl([0, 0.5, 0], 0.27, 0.16, '#fcc419', { tile: 'skin', seg: 16, r: [Math.PI / 2, 0, 0] })
    b.cyl([0, 0.5, 0.06], 0.2, 0.06, '#ffe066', { seg: 16, r: [Math.PI / 2, 0, 0] })
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2
      b.cone([-Math.sin(a) * 0.39, 0.5 + Math.cos(a) * 0.39, 0], 0.07, 0.18, '#ff922b', { seg: 4, s: [1, 1, 0.5], r: [0, 0, a] })
    }
    b.on('solid')
  },

  /** The crescent moon, glowing pale gold. */
  lune: (b) => {
    b.on('glow')
    const n = 9
    for (let i = 0; i < n; i++) {
      const a = -1.25 + (i * 2.5) / (n - 1)
      const r = 0.12 * (1 - Math.abs(a) / 1.6) + 0.035
      b.ball([-Math.cos(a) * 0.28 + 0.06, 0.4 + Math.sin(a) * 0.28, 0], r, '#ffd43b', { tile: 'skin', seg: 8, s: [1, 1, 0.8] })
    }
    b.on('solid')
  },

  /** A star: the five points, glowing gold, a lighter heart. */
  etoile: (b) => {
    b.on('glow')
    b.cyl([0, 0.37, 0], 0.17, 0.14, '#fcc419', { seg: 5, r: [Math.PI / 2, 0, 0] })
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2
      b.cone([-Math.sin(a) * 0.28, 0.37 + Math.cos(a) * 0.28, 0], 0.13, 0.3, '#fcc419', { seg: 4, s: [1, 1, 0.5], r: [0, 0, a] })
    }
    b.cyl([0, 0.37, 0.07], 0.09, 0.02, '#fff3bf', { seg: 5, r: [Math.PI / 2, 0, 0] })
    b.on('solid')
  },
}

/** A palm: the trunk in rings (bending with `lean`), the crown of fronds arching down, the nuts under them. */
function frond(b: Builder, q: Q, o: V, rings: number, lean: number, trunk: [string, string], leaf: string, leaf2: string, nut: string, w: number, step: number, top: number, n: number) {
  for (let i = 0; i < rings; i++) b.cyl([o[0] + i * i * lean, o[1] + 0.08 + i * step, o[2]], w / 2 - i * 0.003, step * 0.96, i % 2 ? trunk[0] : trunk[1], { tile: 'wood', seg: 7, top: w / 2 - i * 0.003 - 0.006, r: [0, i * 0.4, 0] })
  const cx = o[0] + rings * rings * lean + 0.02
  const cy = o[1] + top
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + 0.2
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    // Each frond: two segments, the inner rising a little, the outer drooping.
    const up = k % 2 ? 0.35 : 0.1
    b.box([cx + ca * 0.2, cy + Math.sin(up) * 0.18, o[2] - sa * 0.2], [0.4, 0.02, 0.15], k % 2 ? leaf : leaf2, { tile: 'leaf', r: [0, a, up] })
    b.box([cx + ca * 0.47, cy + Math.sin(up) * 0.36 - 0.1, o[2] - sa * 0.47], [0.3, 0.02, 0.12], k % 2 ? leaf : leaf2, { tile: 'leaf', r: [0, a, -0.6] })
  }
  b.ball([cx, cy + 0.04, o[2]], 0.08, leaf, { tile: 'leaf', seg: 6 })
  const nuts: V[] = [[0.08, -0.08, 0.06], [-0.08, -0.07, 0.05], [0.02, -0.09, -0.08], [0.09, -0.13, -0.02]]
  for (const [x, y, z] of nuts.slice(0, q.lo ? 3 : 4)) b.ball([cx + x, cy + y, o[2] + z], w * 0.55, nut, { tile: 'gloss', seg: 7 })
}
