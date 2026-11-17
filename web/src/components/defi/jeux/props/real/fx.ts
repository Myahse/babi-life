import type { Recipe } from './kit'

// « Mini-jeux réalistes »: the little bits the games clean off and the little effects (a stain, dust,
// foam, a hair, a bit of eggshell, a drop, a flame, a bubble, a heart, a note). They stay stylised and
// readable at a glance (they're what the finger looks for), just made of the same materials.

export const FX: Record<string, Recipe> = {
  /** A stain: a dark wet splash, its thicker middle, drops flung round it. */
  tache: (b, q) => {
    b.cyl([0, 0.008, 0], 0.15, 0.016, '#6b4423', { tile: 'sauce', seg: 10, s: [1, 1, 0.85] })
    b.cyl([0.1, 0.01, 0.06], 0.08, 0.02, '#5c3a1c', { tile: 'sauce', seg: 8 })
    b.cyl([-0.09, 0.009, -0.07], 0.07, 0.018, '#6b4423', { tile: 'sauce', seg: 8 })
    for (const [x, z, r] of q.lo ? [[0.2, -0.1, 0.03]] : [[0.2, -0.1, 0.03], [-0.2, 0.08, 0.022], [0.04, 0.2, 0.018], [-0.06, -0.21, 0.015]]) b.cyl([x, 0.006, z], r, 0.012, '#5c3a1c', { seg: 6 })
    b.ball([0.02, 0.016, -0.02], 0.03, '#a07850', { tile: 'gloss', seg: 6, s: [1.6, 0.3, 1] })
  },

  /** A little heap of dust: grey powder, crumbs, a fluff. */
  poussiere: (b, q) => {
    b.cone([0, 0.06, 0], 0.16, 0.12, '#adb5bd', { tile: 'sand', seg: 8 })
    b.cyl([0, 0.005, 0], 0.2, 0.01, '#ced4da', { tile: 'sand', seg: 10 })
    for (const [x, z, r, c] of [[0.12, 0.06, 0.05, '#ced4da'], [-0.12, 0.04, 0.04, '#868e96'], [0.03, -0.13, 0.035, '#ced4da']] as const) b.ball([x, r * 0.6, z], r, c, { tile: 'sand', seg: 5 })
    if (!q.lo) b.ball([-0.05, 0.13, 0.03], 0.04, '#dee2e6', { tile: 'fabric', seg: 6, s: [1.4, 0.6, 1] })
  },

  /** Soap foam: white bubbles heaped, a few see-through ones catching the light. */
  mousse: (b, q) => {
    for (const [x, y, z, r, c] of [[0, 0.1, 0, 0.11, '#ffffff'], [0.1, 0.07, 0.04, 0.08, '#f1f3f5'], [-0.1, 0.07, 0.03, 0.08, '#ffffff'], [0.02, 0.07, -0.09, 0.08, '#e7f5ff'], [0.03, 0.19, 0.02, 0.06, '#ffffff']] as const) b.ball([x, y, z], r, c, { tile: 'plain', seg: q.lo ? 6 : 8 })
    if (!q.lo) {
      b.on('glass')
      b.ball([0.14, 0.17, -0.02], 0.045, '#d0ebff', { seg: 8 })
      b.ball([-0.12, 0.16, -0.06], 0.035, '#d0ebff', { seg: 8 })
      b.on('solid')
    }
  },

  /** A few curly black hairs, lying in a little tangle. */
  cheveu: (b) => {
    ;[-0.5, -0.25, 0, 0.25, 0.5].forEach((a, i) => {
      b.ring([Math.cos(a + 0.3) * 0.06, 0.012, -Math.sin(a + 0.3) * 0.06], 0.1 + (i % 2) * 0.04, 0.009, i % 2 ? '#2b1d18' : '#1a1110', { arc: Math.PI * (0.9 + (i % 3) * 0.3), seg: 9, r: [0, a * 2 + i, 0] })
    })
  },

  /** A bit of eggshell: the curved broken piece, cream outside, white inside, a crumb by it. */
  coquille: (b) => {
    b.lathe([0, 0.03, 0], [[0.001, 0], [0.07, 0.008], [0.12, 0.04], [0.15, 0.1], [0.152, 0.12]], '#efd9b4', { tile: 'skin', seg: 9, inside: '#fbf6ec', r: [0.5, 0.4, 0.3] })
    b.box([0.15, 0.01, 0.1], [0.06, 0.02, 0.05], '#efd9b4', { r: [0, 0.5, 0] })
    b.box([-0.14, 0.008, 0.08], [0.04, 0.016, 0.03], '#efd9b4', { r: [0, 1.2, 0] })
  },

  /** A drop of water: the round belly drawn to a point, clear blue, its white glint. */
  goutte: (b, q) => {
    b.on('glass')
    b.ball([0, 0.11, 0], 0.11, '#339af0', { seg: q.lo ? 8 : 12 })
    b.cone([0, 0.26, 0], 0.095, 0.17, '#339af0', { seg: q.lo ? 8 : 12 })
    b.on('solid')
    b.ball([0, 0.1, 0], 0.07, '#1c7ed6', { tile: 'water', seg: 8 })
    b.on('glow').ball([-0.04, 0.15, 0.08], 0.025, '#ffffff', { seg: 6 }).on('solid')
  },

  /** A flame: the orange tongue, two side licks, the yellow heart (it lights itself). */
  flamme: (b) => {
    b.on('glow')
    b.cone([0, 0.16, 0], 0.14, 0.32, '#f76707', { seg: 8 })
    b.cone([0.08, 0.1, 0.03], 0.07, 0.2, '#fa5252', { seg: 6, r: [0, 0, -0.3] })
    b.cone([-0.08, 0.09, 0.03], 0.07, 0.18, '#fa5252', { seg: 6, r: [0, 0, 0.3] })
    b.cone([0, 0.12, 0.06], 0.08, 0.2, '#ffd43b', { seg: 6 })
    b.ball([0, 0.05, 0.05], 0.06, '#fff3bf', { seg: 6 })
    b.on('solid')
  },

  /** A soap bubble: clear, a rainbow sheen on it (pale blue and pink bands), the window's glint. */
  bulle: (b, q) => {
    b.on('glass')
    b.ball([0, 0.18, 0], 0.18, '#a5d8ff', { seg: q.lo ? 10 : 14 })
    if (!q.lo) {
      b.ring([0, 0.2, 0], 0.172, 0.012, '#fcc2d7', { seg: 16, r: [0.3, 0, 0.2] })
      b.ring([0, 0.15, 0], 0.17, 0.01, '#c3fae8', { seg: 16, r: [-0.2, 0, 0.3] })
    }
    b.on('glow')
    b.ball([-0.07, 0.25, 0.12], 0.035, '#ffffff', { seg: 6 })
    b.ball([-0.1, 0.21, 0.13], 0.015, '#ffffff', { seg: 5 })
    b.on('solid')
  },

  /** A heart: two round lobes and the point, glossy red, glowing a little. */
  coeur: (b) => {
    b.on('glow')
    for (const s of [-1, 1]) b.ball([s * 0.1, 0.38, 0], 0.13, '#e03131', { seg: 10, s: [1, 1, 0.6] })
    b.box([0, 0.27, 0], [0.25, 0.25, 0.14], '#e03131', { r: [0, 0, Math.PI / 4], bevel: 0.02 })
    b.ball([-0.12, 0.43, 0.06], 0.035, '#ffc9c9', { seg: 6 })
    b.on('solid')
  },

  /** A musical note: the round black head, the stem, the flag. */
  'note-musique': (b) => {
    b.ball([-0.06, 0.07, 0], 0.075, '#111111', { tile: 'gloss', seg: 8, s: [1.3, 0.9, 0.7], r: [0, 0, 0.4] })
    b.box([0.025, 0.24, 0], [0.03, 0.34, 0.04], '#111111', { tile: 'gloss' })
    b.box([0.085, 0.37, 0], [0.14, 0.04, 0.04], '#111111', { tile: 'gloss', r: [0, 0, -0.7] })
    b.box([0.11, 0.3, 0], [0.03, 0.1, 0.04], '#111111', { tile: 'gloss', r: [0, 0, 0.5] })
  },
}
