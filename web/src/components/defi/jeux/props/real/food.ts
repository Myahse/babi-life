import type { Builder, Q, Recipe, V } from './kit'

// « Mini-jeux réalistes »: the food and the kitchen, as you'd see them at the garbadrome, the maquis,
// the market: the attiéké's grains, the fried fish's scales and grill bars, glossy alloco, the sauces,
// the plastic plate, the enamel bowl with its chipped rim, the sooty aluminium pot, the calabash.
// Each recipe keeps the old prop's size (about a unit, standing on y = 0, the front to +z).


/* ---------- Shared bits ---------- */

/** A plastic plate (melamine): a low lathe, its rim, the well. Food sits from y ≈ 0.06. */
export function plasticPlate(b: Builder, r = 0.5, c = '#e8f1e4', rim = '#9cc79a') {
  b.lathe([0, 0, 0], [[0.001, 0], [r * 0.62, 0], [r * 0.7, 0.03], [r * 0.72, 0.045], [r * 0.98, 0.075], [r, 0.08], [r * 0.97, 0.085], [r * 0.7, 0.06], [0.001, 0.06]], c, { tile: 'plastic', seg: 18 })
  b.ring([0, 0.081, 0], r * 0.95, 0.012, rim, { seg: 22 })
}

/** An enamel bowl: white inside, coloured outside, the dark rim, chips. Its inside floor at y ≈ 0.05. */
export function enamelBowl(b: Builder, r = 0.42, h = 0.24, c = '#2c6fb5', inside = '#f4f2ea') {
  b.lathe([0, 0, 0], [[0.001, 0], [r * 0.6, 0], [r * 0.66, 0.02], [r * 0.95, h * 0.85], [r, h]], c, { tile: 'enamel', seg: 16 })
  b.lathe([0, 0, 0], [[r * 0.97, h], [r * 0.92, h * 0.85], [r * 0.6, 0.05], [0.001, 0.05]], inside, { tile: 'enamel', seg: 16 })
  b.ring([0, h, 0], r * 0.985, 0.014, '#1e2a3a', { seg: 20 })
}

/** A heap of attiéké: a domed mound in the grains' own tile, a few loose grains around. */
export function attiekeHeap(b: Builder, p: V, r: number, h: number, q: Q) {
  b.lathe(p, [[0.001, 0], [r, 0], [r * 0.95, h * 0.35], [r * 0.7, h * 0.8], [r * 0.3, h], [0.001, h * 1.02]], '#ffffff', { tile: 'attieke', seg: q.lo ? 10 : 14 })
  if (!q.lo) for (let i = 0; i < 6; i++) b.box([p[0] + Math.cos(i * 2.4) * r * 1.08, p[1] + 0.01, p[2] + Math.sin(i * 2.4) * r * 1.08], [0.035, 0.025, 0.035], '#f6ebc7')
}

/** A slice of fried tuna (the garba's thon): the round darne, its crisped skin, the cut face with its bone. */
export function darne(b: Builder, p: V, s = 1, rot = 0) {
  const [x, y, z] = p
  b.cyl([x, y + 0.06 * s, z], 0.2 * s, 0.12 * s, '#9a5418', { tile: 'grill', seg: 10, s: [1, 1, 0.78], r: [0, rot, 0] })
  b.cyl([x, y + 0.122 * s, z], 0.17 * s, 0.006, '#e8bd84', { tile: 'crust', seg: 10, s: [1, 1, 0.78], r: [0, rot, 0] })
  b.cyl([x, y + 0.128 * s, z], 0.035 * s, 0.008, '#f3ead8', { seg: 6 })
}

/** Onion rings, sliced thin and purple. */
export function onionRings(b: Builder, p: V, n = 2) {
  for (let i = 0; i < n; i++) b.ring([p[0] + i * 0.09, p[1] + i * 0.012, p[2] - i * 0.05], 0.07 - i * 0.012, 0.014, i % 2 ? '#c06aa0' : '#a64d8a', { seg: 10 })
}

/** A tomato slice: the red round, the seeds' pale lobes on top. */
export function tomatoSlice(b: Builder, p: V, r = 0.09) {
  b.cyl(p, r, 0.025, '#ffffff', { tile: 'seeds', fit: true, seg: 10 })
}

/** A small red piment, its green stem. */
export function piment(b: Builder, p: V, rot = 0, c = '#d61f1f', len = 0.14) {
  const r = Math.max(0.028, len * 0.17)
  b.cone([p[0], p[1] + (r - 0.028), p[2]], r, len, c, { tile: 'gloss', seg: 7, r: [0, rot, Math.PI / 2] })
  b.cyl([p[0] - Math.cos(rot) * len * 0.55, p[1] + (r - 0.028), p[2] + Math.sin(rot) * len * 0.55], r * 0.4, len * 0.35, '#2b8a3e', { seg: 5, r: [0, rot, Math.PI / 2] })
}

/** A slice of alloco: the plantain cut on the slant, an oval round, glossy gold with its dark caramel rim. */
export function allocoSlice(b: Builder, p: V, rot = 0, tilt = 0, s = 1) {
  b.cyl(p, 0.075 * s, 0.045 * s, '#ffffff', { tile: 'alloco', fit: true, seg: 9, s: [1.5, 1, 1], r: [tilt, rot, 0] })
}

/** A pool of sauce lying on a plate. */
export function sauce(b: Builder, p: V, r: number, c: string) {
  b.cyl(p, r, 0.016, c, { tile: 'sauce', seg: 12, s: [1, 1, 0.8] })
}

/** A whole braised fish lying on its side (the carpe of the maquis): scales, grill bars, eye, fins, the forked tail. Nose to -x. */
export function braisedFish(b: Builder, p: V, s: number, q: Q, c = '#a85a1e') {
  const [x, y, z] = p
  b.ball([x, y + 0.11 * s, z], 0.3 * s, c, { tile: 'scales', seg: q.lo ? 10 : 14, s: [1.55, 0.62, 0.42] })
  // The grill bars across the side, on top of the scales.
  if (!q.lo) b.ball([x + 0.02 * s, y + 0.115 * s, z], 0.295 * s, '#c8823c', { tile: 'grill', seg: 12, s: [1.4, 0.6, 0.44] })
  // The head: darker, the gill line, the eye, the open mouth.
  b.ball([x - 0.36 * s, y + 0.1 * s, z], 0.15 * s, '#7a3a10', { tile: 'crust', seg: 8, s: [1, 0.95, 0.8] })
  b.box([x - 0.25 * s, y + 0.11 * s, z], [0.02 * s, 0.17 * s, 0.13 * s], '#5a2808')
  b.ball([x - 0.4 * s, y + 0.15 * s, z + 0.1 * s], 0.035 * s, '#f1ede0', { seg: 6 })
  b.ball([x - 0.405 * s, y + 0.15 * s, z + 0.125 * s], 0.017 * s, '#121212', { seg: 5 })
  b.box([x - 0.5 * s, y + 0.09 * s, z], [0.04 * s, 0.04 * s, 0.08 * s], '#3a1a06')
  // The tail, forked; the fins.
  b.box([x + 0.53 * s, y + 0.15 * s, z], [0.14 * s, 0.03 * s, 0.07 * s], '#6b3410', { r: [0, 0, 0.6], tile: 'straw' })
  b.box([x + 0.53 * s, y + 0.05 * s, z], [0.14 * s, 0.03 * s, 0.07 * s], '#6b3410', { r: [0, 0, -0.6], tile: 'straw' })
  b.box([x + 0.05 * s, y + 0.29 * s, z], [0.3 * s, 0.04 * s, 0.02 * s], '#6b3410', { tile: 'straw' })
  if (!q.lo) b.box([x - 0.12 * s, y + 0.06 * s, z + 0.1 * s], [0.12 * s, 0.02 * s, 0.05 * s], '#7a3a10', { r: [0.3, 0, -0.3], tile: 'straw' })
}

/** A glass bottle with its label (a tile), the shoulder, neck and crown cap. */
export function bottle(b: Builder, p: V, h: number, r: number, glass: string, label: string, cap: string, q: Q) {
  const [x, y, z] = p
  b.lathe([x, y, z], [[0.001, 0], [r * 0.92, 0], [r, 0.02], [r, h], [r * 0.9, h + 0.06], [r * 0.42, h + 0.16], [r * 0.36, h + 0.3], [r * 0.4, h + 0.32], [r * 0.4, h + 0.34], [0.001, h + 0.34]], glass, { tile: 'gloss', seg: q.lo ? 10 : 14 })
  b.cyl([x, y + h * 0.5, z], r * 1.02, h * 0.42, '#ffffff', { tile: label, fit: true, seg: q.lo ? 10 : 14, open: true })
  b.cyl([x, y + h + 0.35, z], r * 0.44, 0.04, cap, { tile: 'metal', seg: 10 })
}

/* ---------- The recipes ---------- */

export const FOOD: Record<string, Recipe> = {
  /** A melamine plate. */
  assiette: (b) => plasticPlate(b, 0.5, '#f4f1e8', '#e07a3a'),

  /** Garba: on the plastic plate, the attiéké heaped, the fried thon, onion rings, tomato, piment, a drizzle of oil. */
  garba: (b, q) => {
    plasticPlate(b, 0.52, '#e3efe0', '#5aa45a')
    attiekeHeap(b, [-0.1, 0.06, -0.02], 0.27, 0.2, q)
    darne(b, [0.2, 0.06, 0.12], 1.05, 0.3)
    onionRings(b, [0.12, 0.09, -0.26], q.lo ? 1 : 3)
    tomatoSlice(b, [0.3, 0.075, -0.1])
    piment(b, [-0.27, 0.085, 0.27], 0.6)
    if (!q.lo) {
      piment(b, [-0.15, 0.085, 0.32], -0.3, '#2f9e44', 0.12)
    }
  },

  /** Alloco: the glossy fried plantain, diagonal slices, piment sauce and onions beside, on a plate. */
  alloco: (b, q) => {
    plasticPlate(b, 0.5, '#f4f1e8', '#d6336c')
    const n = q.lo ? 7 : 11
    for (let i = 0; i < n; i++) allocoSlice(b, [Math.cos(i * 2.1) * (0.05 + (i % 3) * 0.08) - 0.06, 0.08 + (i > 6 ? 0.04 : 0), Math.sin(i * 2.1) * (0.05 + (i % 3) * 0.08)], i * 1.3, 0.15 * (i % 3))
    sauce(b, [0.27, 0.07, 0.15], 0.1, '#c0391b')
    onionRings(b, [0.24, 0.085, -0.2], 2)
  },

  /** Attiéké: the heap in its calabash, a pinch of grains spilt. */
  attieke: (b, q) => {
    b.lathe([0, 0, 0], [[0.001, 0], [0.22, 0], [0.38, 0.1], [0.44, 0.22], [0.45, 0.25], [0.41, 0.24], [0.001, 0.09]], '#b8823e', { tile: 'gourd', seg: 16 })
    attiekeHeap(b, [0, 0.09, 0], 0.37, 0.3, q)
  },

  /** A whole braised carpe, lying on a bed of attiéké and onion, in a paper. */
  poisson: (b, q) => {
    b.box([0, 0.006, 0], [1.1, 0.012, 0.6], '#efe6d2', { tile: 'paper', r: [0, 0.08, 0] })
    braisedFish(b, [0, 0.01, 0], 1, q)
    if (!q.lo) {
      onionRings(b, [-0.15, 0.2, 0.05], 2)
      piment(b, [0.15, 0.22, 0.04], 0.5)
    }
  },

  /** Poulet braisé: the quarter with its drumstick, grill bars, on the plate with alloco and a piment. */
  poulet: (b, q) => {
    plasticPlate(b, 0.5, '#f4f1e8', '#e8590c')
    b.ball([-0.04, 0.15, 0], 0.22, '#b4621f', { tile: 'meat', seg: q.lo ? 8 : 12, s: [1.3, 0.62, 1] })
    if (!q.lo) b.ball([-0.04, 0.16, 0.02], 0.215, '#c97a34', { tile: 'grill', seg: 10, s: [1.25, 0.6, 0.95] })
    b.ball([0.24, 0.12, 0.14], 0.09, '#a4561a', { tile: 'meat', seg: 8, s: [1.4, 0.8, 0.9], r: [0, -0.6, 0] })
    b.cyl([0.36, 0.12, 0.24], 0.022, 0.12, '#f1e6cf', { seg: 6, r: [0, -0.6, Math.PI / 2] })
    for (let i = 0; i < 3; i++) allocoSlice(b, [-0.25 + i * 0.09, 0.085, 0.3], i)
    piment(b, [0.28, 0.085, -0.25], 1.2)
  },

  /** Brochettes: beef cubes grilled on their sticks, onion and green pepper between. */
  brochette: (b, q) => {
    for (const z of [-0.12, 0.12]) {
      b.cyl([0, 0.1, z], 0.012, 1.0, '#c8a273', { seg: 5, r: [0, 0, Math.PI / 2], tile: 'wood' })
      const n = q.lo ? 4 : 6
      for (let i = 0; i < n; i++) {
        const x = -0.36 + (i * 0.72) / (n - 1)
        if (i % 3 === 1) b.box([x, 0.1, z], [0.06, 0.12, 0.12], i % 2 ? '#3f8f3a' : '#d9b3d0', { tile: 'skin' })
        else b.box([x, 0.1, z], [0.12, 0.12, 0.12], '#7a3c18', { tile: 'grill', r: [0.2 * i, 0, 0.1] })
      }
    }
  },

  /** Foutou: the smooth pounded ball in its sauce graine, in the enamel bowl. */
  foutou: (b, q) => {
    enamelBowl(b, 0.45, 0.24, '#d9480f')
    b.disc([0, 0.19, 0], 0.4, '#b4401a', { tile: 'sauce', seg: 16 })
    b.ball([0, 0.22, 0], 0.22, '#f3e8c8', { tile: 'plain', seg: q.lo ? 10 : 14, s: [1, 0.72, 1] })
    if (!q.lo) {
      b.box([0.24, 0.2, 0.08], [0.1, 0.06, 0.08], '#6a3a20', { tile: 'meat' })
      b.box([-0.2, 0.2, -0.16], [0.09, 0.05, 0.1], '#5a2a14', { tile: 'meat', r: [0, 0.6, 0] })
    }
  },

  /** Riz sauce: the white rice heaped, the brown sauce arachide beside with its meat, on the plate. */
  riz: (b, q) => {
    plasticPlate(b, 0.5, '#f4f1e8', '#1c7ed6')
    b.lathe([-0.1, 0.06, 0], [[0.001, 0], [0.26, 0], [0.22, 0.09], [0.1, 0.15], [0.001, 0.16]], '#fbf8ef', { tile: 'rice', seg: 14 })
    sauce(b, [0.2, 0.07, 0.08], 0.2, '#9a4c1c')
    b.box([0.22, 0.1, 0.06], [0.1, 0.06, 0.09], '#6a3218', { tile: 'meat', r: [0, 0.4, 0] })
    if (!q.lo) b.box([0.13, 0.095, 0.16], [0.07, 0.05, 0.07], '#d6702a', { tile: 'skin' })
  },

  /** A baguette: the golden crust, the slashes, the pale floury ends. */
  pain: (b, q) => {
    b.cyl([0, 0.1, 0], 0.1, 0.95, '#d18a38', { tile: 'crust', seg: q.lo ? 8 : 10, r: [0, 0.2, Math.PI / 2], s: [1, 1, 0.82] })
    for (const x of [-0.42, 0.42]) b.ball([x * Math.cos(0.2), 0.1, -x * Math.sin(0.2)], 0.1, '#c27a2c', { tile: 'crust', seg: 8, s: [0.7, 0.82, 0.82] })
    const n = q.lo ? 3 : 5
    for (let i = 0; i < n; i++) {
      const x = -0.28 + (i * 0.56) / (n - 1)
      b.box([x * Math.cos(0.2), 0.19, -x * Math.sin(0.2)], [0.12, 0.012, 0.05], '#f2d7a0', { r: [0, 0.2 + 0.6, 0] })
    }
  },

  /** A ripe mango: green to orange-red, its stem and a leaf. */
  mangue: (b, q) => {
    b.ball([0, 0.26, 0], 0.27, '#f2a52b', { tile: 'skin', seg: q.lo ? 10 : 14, s: [1, 0.88, 0.8], r: [0, 0, 0.35] })
    if (!q.lo) b.ball([-0.08, 0.32, 0.03], 0.22, '#d9480f', { tile: 'skin', seg: 10, s: [0.9, 0.7, 0.85], r: [0, 0, 0.35] })
    b.cyl([0.06, 0.5, 0], 0.016, 0.07, '#5c3d1e', { seg: 5 })
    b.box([0.17, 0.53, 0], [0.24, 0.01, 0.09], '#2f8a3a', { tile: 'leaf', r: [0, 0.2, -0.3] })
  },

  /** A pineapple: the diamond-eyed body and its crown of stiff leaves. */
  ananas: (b, q) => {
    b.ball([0, 0.3, 0], 0.24, '#d49b2a', { tile: 'pine', seg: q.lo ? 8 : 12, s: [1, 1.3, 1] })
    const n = q.lo ? 6 : 10
    for (let i = 0; i < n; i++) b.box([Math.cos(i * 2.4) * 0.04, 0.68, Math.sin(i * 2.4) * 0.04], [0.04, 0.32 - (i % 3) * 0.06, 0.012], i % 2 ? '#2f8a3a' : '#4aa04a', { tile: 'leaf', r: [Math.sin(i * 2.4) * 0.5, -i * 2.4, Math.cos(i * 2.4) * 0.5] })
  },

  /** A hand of plantain-yellow bananas, freckled, joined at the stem. */
  banane: (b, q) => {
    for (let i = 0; i < 3; i++) {
      const z = (i - 1) * 0.15
      const n = q.lo ? 3 : 5
      for (let k = 0; k < n; k++) {
        const t = k / (n - 1)
        const x = -0.35 + t * 0.7
        const yy = 0.09 + Math.sin(t * Math.PI) * 0.12 * 0 + (1 - Math.cos((t - 0.5) * 2)) * 0.25
        b.box([x, yy + i * 0.02, z], [0.75 / n + 0.03, 0.1, 0.1], '#f2c94c', { tile: 'skin', r: [0, 0, (t - 0.5) * -1.0] })
      }
    }
    b.box([-0.42, 0.2, 0], [0.08, 0.09, 0.4], '#5c4a1e', { tile: 'wood' })
  },

  /** A coconut: the brown husked nut, an open half with its white flesh. */
  'noix-coco': (b, q) => {
    b.ball([-0.14, 0.24, 0], 0.24, '#6a4022', { tile: 'straw', seg: q.lo ? 8 : 12 })
    b.lathe([0.24, 0.0, 0.1], [[0.001, 0], [0.12, 0.01], [0.19, 0.08], [0.2, 0.15], [0.17, 0.15], [0.15, 0.09], [0.001, 0.06]], '#5c3a1e', { tile: 'straw', seg: 12 })
    b.disc([0.24, 0.135, 0.1], 0.165, '#f8f5ec', { seg: 12 })
  },

  /** Green glass bottle (a bottle of water from the shop). */
  bouteille: (b, q) => bottle(b, [0, 0, 0], 0.5, 0.13, '#2b7a3a', 'labelEau', '#d9d9d9', q),

  /** Beer: the big brown « Lagune » bottle and a glass with its foam. */
  biere: (b, q) => {
    bottle(b, [-0.12, 0, 0], 0.5, 0.13, '#4a2a10', 'labelBeer', '#e0b030', q)
    b.on('glass').cyl([0.22, 0.17, 0.08], 0.11, 0.34, '#f2f6f8', { top: 0.13, seg: 12, open: true }).on('solid')
    b.cyl([0.22, 0.14, 0.08], 0.105, 0.26, '#e0a020', { top: 0.12, seg: 12, tile: 'gloss' })
    b.cyl([0.22, 0.3, 0.08], 0.124, 0.06, '#ffffff', { seg: 12, tile: 'foam' })
  },

  /** A soda: the glass bottle of « Kola Djè », its label. */
  soda: (b, q) => {
    bottle(b, [0, 0, 0], 0.42, 0.12, '#3a1a0a', 'labelSoda', '#c92a2a', q)
  },

  /** A tall glass of bissap-coloured juice, ice, a straw. */
  jus: (b, q) => {
    b.on('glass').cyl([0, 0.3, 0], 0.17, 0.6, '#eef6fa', { top: 0.2, seg: 14, open: true }).on('solid')
    b.cyl([0, 0.24, 0], 0.16, 0.46, '#f08c00', { top: 0.185, seg: 14, tile: 'gloss' })
    if (!q.lo) for (let i = 0; i < 3; i++) b.on('glass').box([Math.cos(i * 2) * 0.07, 0.46, Math.sin(i * 2) * 0.07], [0.08, 0.08, 0.08], '#ffffff', { r: [i, i * 0.5, 0] }).on('solid')
    b.cyl([0.05, 0.55, 0], 0.016, 0.42, '#e64980', { seg: 6, r: [0, 0, -0.25] })
    b.cyl([-0.17, 0.58, 0.02], 0.08, 0.02, '#fab005', { seg: 10, r: [Math.PI / 2, 0, 0.3], tile: 'seeds' })
  },

  /** Le sachet d'eau: the soft pillow of water, crimped at both ends, its blue print, a corner bitten off. */
  'sachet-eau': (b, q) => {
    b.on('glass').ball([0, 0.1, 0], 0.32, '#d8ecfa', { seg: q.lo ? 8 : 12, s: [1, 0.3, 0.75] }).on('solid')
    b.box([0, 0.105, 0], [0.42, 0.012, 0.34], '#ffffff', { tile: 'labelEau', fit: true, r: [0, 0, 0] })
    for (const x of [-0.33, 0.33]) b.box([x, 0.08, 0], [0.06, 0.02, 0.42], '#e6f1f8', { tile: 'plastic' })
  },

  /** A café touba in its little glass cup on a saucer. */
  cafe: (b, q) => {
    b.cyl([0, 0.015, 0], 0.3, 0.03, '#f4f1e8', { seg: 14, tile: 'enamel' })
    b.lathe([0, 0.03, 0], [[0.001, 0], [0.12, 0], [0.17, 0.2], [0.18, 0.22]], '#f8f8f4', { tile: 'enamel', seg: 14 })
    b.disc([0, 0.22, 0], 0.165, '#3a1d0e', { tile: 'tea' })
    b.ring([0.2, 0.15, 0], 0.05, 0.014, '#f8f8f4', { r: [Math.PI / 2, 0, 0] })
    if (!q.lo) b.box([0.1, 0.035, 0.18], [0.16, 0.012, 0.02], '#c0c0c0', { tile: 'metal' })
  },

  /** Le thé du grin: the blue enamel théière, the little glass with its foam, sugar. */
  the: (b, q) => {
    b.lathe([-0.16, 0, 0], [[0.001, 0], [0.16, 0], [0.22, 0.12], [0.2, 0.26], [0.1, 0.32], [0.1, 0.36], [0.001, 0.37]], '#1c5fb0', { tile: 'enamel', seg: 14 })
    b.cyl([-0.16, 0.39, 0], 0.03, 0.05, '#163f78', { seg: 8 })
    b.cyl([0.06, 0.22, 0], 0.025, 0.24, '#1c5fb0', { seg: 6, r: [0, 0, -0.9], tile: 'enamel' })
    b.ring([-0.36, 0.2, 0], 0.08, 0.018, '#163f78', { r: [Math.PI / 2, 0, 0] })
    // The glass: amber tea under its thick foam.
    b.on('glass').cyl([0.26, 0.11, 0.12], 0.07, 0.22, '#f4f8fa', { top: 0.08, seg: 10, open: true }).on('solid')
    b.cyl([0.26, 0.07, 0.12], 0.066, 0.13, '#ffffff', { top: 0.072, seg: 10, tile: 'tea', fit: true })
    b.cyl([0.26, 0.17, 0.12], 0.076, 0.08, '#ffffff', { seg: 10, tile: 'foam' })
    if (!q.lo) for (let i = 0; i < 2; i++) b.box([0.06 + i * 0.07, 0.025, 0.28], [0.05, 0.05, 0.05], '#fbfbf6', { tile: 'rice' })
  },

  /** A glass of water. */
  verre: (b, q) => {
    b.on('glass').cyl([0, 0.21, 0], 0.15, 0.42, '#eef6fa', { top: 0.17, seg: 14, open: true }).on('solid')
    b.on('glass').cyl([0, 0.15, 0], 0.145, 0.28, '#9fd0f0', { top: 0.16, seg: 14 }).on('solid')
    if (!q.lo) b.cyl([0, 0.005, 0], 0.15, 0.01, '#d6e6ee', { seg: 14 })
  },

  /** Piment: two peppers, red and green, glossy. */
  piment: (b) => {
    piment(b, [-0.05, 0.03, -0.12], 0.3, '#d61f1f', 0.7)
    piment(b, [0.05, 0.03, 0.14], -0.4, '#2f9e44', 0.62)
  },

  /** A ripe tomato, its green star and stem. */
  tomate: (b, q) => {
    b.ball([0, 0.24, 0], 0.27, '#d9241f', { tile: 'gloss', seg: q.lo ? 10 : 14, s: [1, 0.82, 1] })
    for (let i = 0; i < 5; i++) b.box([Math.cos(i * 1.256) * 0.06, 0.46, Math.sin(i * 1.256) * 0.06], [0.12, 0.012, 0.03], '#2b8a3e', { r: [0, -i * 1.256, 0], tile: 'leaf' })
    b.cyl([0, 0.49, 0], 0.014, 0.06, '#2b8a3e', { seg: 5 })
  },

  /** A red onion: the papery skin's lines, its tip and roots; a half showing its rings. */
  oignon: (b, q) => {
    b.ball([-0.08, 0.22, 0], 0.24, '#8e2f6e', { tile: 'onion', seg: q.lo ? 10 : 12, s: [1, 0.92, 1] })
    b.cone([-0.08, 0.5, 0], 0.06, 0.14, '#b98a5e', { seg: 6, tile: 'onion' })
    if (!q.lo) {
      b.lathe([0.26, 0, 0.12], [[0.001, 0], [0.12, 0.02], [0.16, 0.1], [0.001, 0.12]], '#8e2f6e', { tile: 'onion', seg: 10 })
      b.disc([0.26, 0.121, 0.12], 0.14, '#e8c8dc', { tile: 'onion' })
    }
  },

  /** The marmite: aluminium, black with soot from the fire to halfway up, its lid and knob, the handles. */
  marmite: (b, q) => {
    b.cyl([0, 0.22, 0], 0.46, 0.44, '#c9ccd0', { tile: 'soot', fit: true, seg: q.lo ? 12 : 16 })
    b.ring([0, 0.44, 0], 0.46, 0.022, '#b8bcc2', { seg: 18 })
    b.lathe([0, 0.44, 0], [[0.47, 0], [0.4, 0.06], [0.1, 0.1], [0.001, 0.1]], '#c2c6cc', { tile: 'alu', seg: 16 })
    b.cyl([0, 0.57, 0], 0.05, 0.05, '#2a2a2e', { seg: 8 })
    for (const s of [-1, 1]) b.box([s * 0.52, 0.36, 0], [0.1, 0.04, 0.16], '#a8acb2', { tile: 'alu' })
  },

  /** A black frying pan, a fried egg in its oil, the long handle. */
  poele: (b, q) => {
    b.lathe([0, 0, 0], [[0.001, 0], [0.34, 0], [0.42, 0.1], [0.43, 0.1]], '#2a2b30', { tile: 'metal', seg: 16 })
    b.lathe([0, 0.012, 0], [[0.42, 0.088], [0.33, 0], [0.001, 0]], '#3a3b42', { tile: 'metal', seg: 16 })
    b.box([0.68, 0.08, 0], [0.5, 0.05, 0.08], '#5a3a20', { tile: 'wood', r: [0, 0, 0.1] })
    if (!q.lo) b.cyl([0.02, 0.025, 0], 0.2, 0.02, '#fbfbf6', { seg: 12, s: [1, 1, 0.85] })
    b.ball([0.04, 0.04, 0.02], 0.08, '#f5a90a', { half: true, seg: 8, tile: 'gloss' })
  },

  /** A wooden spoon (the louche of the marmite): carved bowl and long handle. */
  louche: (b) => {
    b.ball([-0.32, 0.06, 0], 0.13, '#b5823f', { tile: 'wood', half: true, seg: 10, s: [1.3, 0.6, 1], r: [Math.PI, 0, 0] })
    b.box([0.18, 0.04, 0], [0.8, 0.05, 0.06], '#b5823f', { tile: 'wood' })
    b.disc([-0.32, 0.061, 0], 0.11, '#8a5a28', { tile: 'wood', s: [1.3, 1, 1] })
  },

  /** A kitchen knife: the steel blade, its edge, the dark wood handle and rivets. */
  couteau: (b) => {
    b.box([-0.14, 0.02, 0], [0.62, 0.025, 0.14], '#c8ccd2', { tile: 'alu' })
    b.box([-0.14, 0.02, 0.07], [0.6, 0.02, 0.02], '#eef0f4')
    b.box([0.34, 0.03, 0], [0.36, 0.06, 0.12], '#3a2414', { tile: 'wood' })
    for (const x of [0.24, 0.42]) b.cyl([x, 0.062, 0], 0.016, 0.01, '#d0d0d0', { seg: 6 })
  },

  /** A steel fork. */
  fourchette: (b) => {
    b.box([0.15, 0.02, 0], [0.6, 0.025, 0.07], '#c8ccd2', { tile: 'alu' })
    b.box([-0.2, 0.02, 0], [0.12, 0.025, 0.16], '#c8ccd2', { tile: 'alu' })
    for (let i = 0; i < 4; i++) b.box([-0.34, 0.02, -0.06 + i * 0.04], [0.18, 0.02, 0.022], '#d4d8de')
  },

  /** A serving tray: aluminium with raised edges, the handles. */
  'plateau-service': (b) => {
    b.box([0, 0.02, 0], [1.0, 0.03, 0.7], '#c6cad0', { tile: 'alu' })
    for (const [p, s] of [[[0, 0.06, 0.34], [1.0, 0.07, 0.03]], [[0, 0.06, -0.34], [1.0, 0.07, 0.03]], [[0.49, 0.06, 0], [0.03, 0.07, 0.7]], [[-0.49, 0.06, 0], [0.03, 0.07, 0.7]]] as [V, V][]) b.box(p, s, '#b0b4ba', { tile: 'alu' })
    for (const s of [-1, 1]) b.box([s * 0.55, 0.08, 0], [0.06, 0.04, 0.24], '#9a9ea4', { tile: 'alu' })
  },

  /** The calabash: the halved gourd, its carved band, a little attiéké inside. */
  calebasse: (b) => {
    b.lathe([0, 0, 0], [[0.001, 0], [0.2, 0], [0.38, 0.12], [0.45, 0.26], [0.45, 0.3], [0.41, 0.29], [0.001, 0.08]], '#c7913e', { tile: 'gourd', seg: 16 })
    b.ring([0, 0.3, 0], 0.43, 0.016, '#7a4a1c', { seg: 18 })
  },

  /** The canari: the clay jar of cool water, its belly, the lid, a cup on top. */
  canari: (b) => {
    b.lathe([0, 0, 0], [[0.001, 0], [0.18, 0], [0.38, 0.18], [0.4, 0.3], [0.3, 0.52], [0.2, 0.58], [0.22, 0.62], [0.001, 0.62]], '#b5582a', { tile: 'earth', seg: 16 })
    b.ring([0, 0.4, 0], 0.37, 0.012, '#7a3a18', { seg: 18 })
    b.lathe([0, 0.62, 0], [[0.001, 0], [0.1, 0], [0.13, 0.08]], '#c7913e', { tile: 'gourd', seg: 10 })
  },

  /** The wooden mortar of the foutou, the dough inside. */
  mortier: (b) => {
    b.lathe([0, 0, 0], [[0.001, 0], [0.32, 0], [0.32, 0.08], [0.18, 0.14], [0.18, 0.3], [0.38, 0.55], [0.4, 0.7], [0.32, 0.7], [0.001, 0.48]], '#8a5a30', { tile: 'wood', seg: 14 })
    b.ball([0, 0.58, 0], 0.25, '#f3e8c8', { half: true, seg: 10, s: [1, 0.5, 1] })
  },

  /** The long pestle, standing. */
  pilon: (b) => {
    b.cyl([0, 0.8, 0], 0.06, 1.5, '#a87a48', { tile: 'wood', seg: 8 })
    b.cyl([0, 0.08, 0], 0.08, 0.16, '#8a5a30', { tile: 'wood', seg: 8 })
  },

  /** An egg-shaped yam, its rough bark, cut to its white flesh at one end. */
  igname: (b, q) => {
    b.cyl([0, 0.16, 0], 0.16, 0.9, '#6a4428', { top: 0.12, tile: 'earth', seg: q.lo ? 8 : 10, r: [0, 0, Math.PI / 2] })
    b.cyl([0.46, 0.16, 0], 0.12, 0.02, '#f6efdc', { seg: 10, r: [0, 0, Math.PI / 2] })
  },

  /** A corn cob, rows of kernels, the husk opened at the end. */
  mais: (b, q) => {
    b.cyl([0, 0.13, 0], 0.13, 0.8, '#f2c335', { top: 0.1, tile: 'beans', seg: q.lo ? 8 : 12, r: [0, 0, Math.PI / 2] })
    for (const a of [-0.5, 0.4, 1.2]) b.box([0.48, 0.13 + Math.sin(a) * 0.08, Math.cos(a) * 0.08], [0.32, 0.02, 0.1], '#a8c070', { tile: 'leaf', r: [a, 0, 0.2] })
  },

  /** Three eggs. */
  oeuf: (b, q) => {
    for (let i = 0; i < 3; i++) b.ball([(i - 1) * 0.26, 0.13, (i % 2) * 0.12], 0.12, '#f1e4cc', { tile: 'skin', seg: q.lo ? 8 : 10, s: [1, 1.25, 1] })
  },

  /** Beignets: golden puffs in a heap on paper. */
  beignet: (b, q) => {
    b.box([0, 0.006, 0], [0.8, 0.012, 0.7], '#efe6d2', { tile: 'news', fit: true })
    const n = q.lo ? 5 : 8
    for (let i = 0; i < n; i++) b.ball([Math.cos(i * 2.2) * (i > 4 ? 0.06 : 0.2), 0.11 + (i > 4 ? 0.13 : 0), Math.sin(i * 2.2) * (i > 4 ? 0.06 : 0.2)], 0.12, '#c97a28', { tile: 'crust', seg: 8, s: [1, 0.9, 1] })
  },

  /** Peanuts in a twist of newspaper. */
  arachide: (b, q) => {
    b.cone([0, 0.3, 0], 0.22, 0.6, '#efe6d2', { tile: 'news', seg: 8, r: [Math.PI, 0, 0] })
    const n = q.lo ? 4 : 8
    for (let i = 0; i < n; i++) b.ball([Math.cos(i * 2.4) * 0.12, 0.6 + (i % 2) * 0.05, Math.sin(i * 2.4) * 0.12], 0.05, '#c99a5c', { tile: 'crust', seg: 6, s: [1.4, 1, 1] })
  },

  /** The bar's beer bottle at the glass' scale (Bar.tsx GlassView: 18 cm of body, the neck to 0.25): « Lagune », its label and crown cap. */
  'bar-bottle': (b) => {
    b.lathe([0, 0, 0], [[0.001, 0], [0.033, 0], [0.035, 0.005], [0.035, 0.17], [0.03, 0.19], [0.015, 0.21], [0.013, 0.245], [0.015, 0.25], [0.001, 0.25]], '#4a2a10', { tile: 'gloss', seg: 12 })
    b.cyl([0, 0.085, 0], 0.0357, 0.07, '#ffffff', { tile: 'labelBeer', fit: true, seg: 12, open: true })
    b.cyl([0, 0.252, 0], 0.016, 0.01, '#e0b030', { tile: 'metal', seg: 8 })
  },

  /** The maquis' plastic table under the glass: its moulded top, caps and a wet ring. */
  'bar-table': (b) => {
    b.box([0, -0.01, 0], [0.6, 0.02, 0.3], '#d6336c', { tile: 'plastic' })
    b.cyl([0.2, 0.001, 0.08], 0.014, 0.004, '#e0b030', { tile: 'metal', seg: 8 })
    b.cyl([-0.24, 0.001, 0.1], 0.014, 0.004, '#c92a2a', { tile: 'metal', seg: 8, r: [0, 0, 0.1] })
    b.ring([0.18, 0.001, -0.06], 0.05, 0.004, '#b02a5c', { seg: 12 })
  },
}
