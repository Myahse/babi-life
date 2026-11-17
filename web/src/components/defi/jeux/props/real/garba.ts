import type { Builder, Q, Recipe } from './kit'
import { attiekeHeap, onionRings, piment, tomatoSlice } from './food'

// « Mini-jeux réalistes »: the garba's own scene (components/defi/Garba.tsx) in the concept's blocks.
// The garbadrome's bassine on its charcoal fire (sooty aluminium, the seething oil, the bricks, the
// concrete floor), the pieces of fried fish as they come out, then the plate at the maquis' table.
// Sizes are those of the scene (the bassine 6 wide), so nothing moves for the game.

/** The concrete floor of the garbadrome, oil stains, the drain. */
function floor(b: Builder, y: number, q: Q) {
  b.box([0, y - 0.15, 0], [9, 0.3, 8], '#9a958c', { tile: 'cement' })
  if (!q.lo) for (let i = 0; i < 5; i++) b.box([-3 + ((i * 37) % 60) / 10, y + 0.002, -3 + ((i * 53) % 60) / 10], [0.6 + (i % 3) * 0.3, 0.004, 0.4 + (i % 2) * 0.3], '#6e6a62')
}

export const GARBA: Record<string, Recipe> = {
  /** The bassine on its fire: black-bottomed aluminium, the rim, the two handles, the bricks and embers under it, the floor. */
  'garba-bassine': (b, q) => {
    floor(b, -0.62, q)
    // The three bricks the bassine sits on, the embers between them glowing.
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5
      b.box([Math.cos(a) * 2.1, -0.42, Math.sin(a) * 2.1], [0.9, 0.4, 0.5], '#a8553a', { tile: 'brick', r: [0, -a, 0] })
    }
    b.on('glow').cyl([0, -0.45, 0], 1.7, 0.12, '#ffffff', { tile: 'embers', seg: 14 }).on('solid')
    // The bassine itself: soot from the fire most of the way up, brushed aluminium at the lip.
    b.lathe([0, -0.2, 0], [[0.001, 0], [2.5, 0], [2.6, 0.08], [3.0, 0.6], [3.06, 0.62]], '#c2c5ca', { tile: 'soot', seg: q.lo ? 20 : 28 })
    b.ring([0, 0.41, 0], 3.02, 0.08, '#b5b9bf', { seg: 32, tile: 'alu' })
    for (const s of [-1, 1]) b.ring([s * 3.25, 0.38, 0], 0.3, 0.07, '#9a9ea4', { arc: Math.PI, r: [0, s > 0 ? Math.PI / 2 : -Math.PI / 2, 0], tile: 'alu' })
    // The oil, hot and golden (it lights itself).
    b.on('glow').cyl([0, 0.3, 0], 2.88, 0.04, '#d68a24', { tile: 'sauce', seg: q.lo ? 20 : 28 }).on('solid')
    // Pieces waiting at the rim on a grid (the tantie's draining rack).
    if (!q.lo) {
      b.box([0, 0.52, -2.75], [2.4, 0.03, 0.5], '#b8bcc2', { tile: 'alu' })
      for (let i = 0; i < 5; i++) b.box([-0.9 + i * 0.45, 0.56, -2.75], [0.3, 0.06, 0.3], '#9a5418', { tile: 'grill' })
    }
  },

  /** The darne of thon: the thick round slice, crisped skin, the pale cut face and its bone. */
  'garba-thon': (b) => {
    b.cyl([0, 0.14, 0], 0.55, 0.28, '#9a5418', { tile: 'grill', seg: 12, top: 0.53, s: [1, 1, 0.78] })
    b.cyl([0, 0.285, 0], 0.46, 0.012, '#e9c08a', { tile: 'crust', seg: 12, s: [1, 1, 0.78] })
    // The muscle's rings, the backbone in the middle.
    for (const r of [0.34, 0.22]) b.ring([0, 0.29, 0], r, 0.012, '#c98d55', { seg: 14, s: [1, 1, 0.78] })
    b.cyl([0, 0.3, 0], 0.09, 0.03, '#f3ead8', { seg: 8 })
    b.box([0, 0.31, 0], [0.05, 0.03, 0.05], '#8a5a32')
  },

  /** A length of chinchard: silver-blue skin crisped gold on top, its scales, the tail, the cut end. */
  'garba-chinchard': (b, q) => {
    b.ball([0, 0.13, 0], 0.5, '#7d8893', { tile: 'scales', seg: q.lo ? 10 : 14, s: [1.0, 0.26, 0.36] })
    b.ball([0.02, 0.17, 0], 0.46, '#d68a2e', { tile: 'grill', seg: 12, s: [0.98, 0.24, 0.26] })
    b.box([0, 0.13, 0.14], [0.86, 0.02, 0.03], '#e8e2d0')
    b.cyl([-0.47, 0.13, 0], 0.12, 0.04, '#ecc79a', { seg: 8, r: [0, 0, Math.PI / 2], s: [1, 1, 1.3] })
    b.cyl([-0.49, 0.13, 0], 0.03, 0.03, '#efe3cf', { seg: 6, r: [0, 0, Math.PI / 2] })
    for (const s of [-1, 1]) b.box([0.6, 0.13, s * 0.09], [0.28, 0.03, 0.09], '#4a3524', { r: [0, s * 0.7, 0], tile: 'straw' })
  },

  /** A chunk of carpe: the browned scales in rows, cut flesh at both ends. */
  'garba-carpe': (b) => {
    b.box([0, 0.17, 0], [0.8, 0.34, 0.6], '#a8601c', { tile: 'scales' })
    b.box([0, 0.335, 0], [0.74, 0.02, 0.54], '#c4782c', { tile: 'grill' })
    for (const x of [-0.405, 0.405]) {
      b.box([x, 0.17, 0], [0.012, 0.28, 0.52], '#ecc79a', { tile: 'crust' })
      b.box([x * 1.01, 0.2, 0], [0.012, 0.06, 0.06], '#efe3cf')
    }
  },

  /** The carpe's head: the eye, the open mouth, the gill, browned and crisp. */
  'garba-tete': (b, q) => {
    b.ball([0.02, 0.18, 0], 0.36, '#94511a', { tile: 'crust', seg: q.lo ? 8 : 12, s: [1, 0.55, 0.8] })
    b.ball([-0.32, 0.14, 0], 0.16, '#a8601c', { tile: 'grill', seg: 8, s: [1, 0.85, 1.2] })
    b.box([-0.44, 0.12, 0], [0.06, 0.08, 0.24], '#3a1a04')
    b.box([0.1, 0.3, 0], [0.04, 0.03, 0.5], '#5e2f0c')
    for (const s of [-1, 1]) {
      b.ball([-0.14, 0.27, s * 0.26], 0.07, '#f2efe6', { seg: 8, s: [1, 1, 0.5] })
      b.ball([-0.14, 0.27, s * 0.29], 0.035, '#1a0e06', { seg: 6, s: [1, 1, 0.5] })
    }
    b.box([0.34, 0.18, 0], [0.012, 0.3, 0.48], '#ecc79a', { tile: 'crust' })
  },

  /** The plate at the maquis: the wooden table, the big melamine plate, onion rings, tomato, piment (sizes of the scene: the plate 6 wide). */
  'garba-plate': (b, q) => {
    // The table: planks, their gaps, a wax cloth under the plate.
    for (let i = 0; i < 7; i++) b.box([-3.6 + i * 1.2, -0.26, 0], [1.16, 0.2, 8], i % 2 ? '#9a6a3c' : '#a6743f', { tile: 'wood' })
    b.box([0, -0.155, 0.2], [6.8, 0.012, 6.6], '#ffffff', { tile: 'wax' })
    b.lathe([0, -0.08, 0], [[0.001, 0], [2.6, 0], [2.7, 0.04], [2.95, 0.15], [3.0, 0.16], [2.95, 0.17], [2.45, 0.17], [2.4, 0.175], [0.001, 0.175]], '#e3efe0', { tile: 'plastic', seg: q.lo ? 22 : 32 })
    b.ring([0, 0.085, 0], 2.82, 0.03, '#5aa45a', { seg: 32 })
    onionRings(b, [1.3, 0.12, -1.1], 1)
    for (const [x, z] of [[1.3, -1.1], [1.6, -0.5]]) b.ring([x, 0.13, z], 0.28, 0.06, '#b0478a', { seg: 14 })
    tomatoSlice(b, [0.4, 0.13, -1.6], 0.32)
    piment(b, [-1.5, 0.16, 1.3], 0, '#d61f1f', 0.6)
    if (!q.lo) {
      piment(b, [-1.0, 0.16, 1.7], 0.5, '#2f9e44', 0.5)
      // The sachet of water and a spoon, as at the maquis.
      b.box([2.9, -0.06, 2.6], [0.8, 0.12, 0.5], '#ffffff', { tile: 'labelEau', fit: true, r: [0, 0.4, 0] })
    }
  },

  /** The attiéké left on the plate (scaled down as it's eaten). */
  'garba-mound': (b, q) => attiekeHeap(b, [0, -0.05, 0], 1.6, 0.26, q),

  /** One pinch of attiéké. */
  'garba-clump': (b, q) => attiekeHeap(b, [0, 0, 0], 0.2, 0.18, { lo: true, hi: q.hi }),

  /** A ball « pommée » in the palm. */
  'garba-boule': (b) => b.ball([0, 0.1, 0], 0.28, '#ffffff', { tile: 'attieke', seg: 10 }),
}
