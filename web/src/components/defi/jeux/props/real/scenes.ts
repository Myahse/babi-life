import type { Recipe } from './kit'

// « Mini-jeux réalistes »: the sets of the played scenes that have their own 3D (in metres, as those
// scenes are): the grin's tea, the shower, the toilets.

export const SCENES: Record<string, Recipe> = {
  /** The grin's low table (Tea.tsx): a straw mat on the planks, the engraved aluminium tray, the little charcoal brazier glowing behind, the sugar box. */
  'tea-set': (b, q) => {
    for (let i = 0; i < 4; i++) b.box([-0.9 + i * 0.6, -0.04, 0], [0.59, 0.06, 1.2], i % 2 ? '#7a4a22' : '#84522a', { tile: 'wood' })
    b.box([0.05, -0.008, 0.05], [1.3, 0.008, 0.8], '#c9a55a', { tile: 'straw' })
    b.cyl([0.05, 0.0, 0], 0.42, 0.012, '#c8ccd2', { tile: 'alu', seg: 20, s: [1, 1, 0.72] })
    b.ring([0.05, 0.008, 0], 0.41, 0.008, '#a8acb2', { seg: 24, s: [1, 1, 0.72] })
    // The brazier: a little steel bucket on legs, the grid, the coals.
    b.lathe([-0.5, 0.0, -0.35], [[0.001, 0.04], [0.09, 0.04], [0.13, 0.17], [0.14, 0.18]], '#3b3f46', { tile: 'soot', seg: 12 })
    for (let k = 0; k < 3; k++) b.box([-0.5 + Math.cos(k * 2.1) * 0.08, 0.02, -0.35 + Math.sin(k * 2.1) * 0.08], [0.02, 0.04, 0.02], '#2a2c30')
    b.on('glow').cyl([-0.5, 0.175, -0.35], 0.12, 0.02, '#ffffff', { tile: 'embers', seg: 10 }).on('solid')
    // The sugar box and the green tea's packet, as at every grin.
    if (!q.lo) {
      b.box([0.42, 0.04, -0.28], [0.12, 0.08, 0.08], '#f8f9fa', { tile: 'paper' })
      b.box([0.42, 0.081, -0.28], [0.12, 0.002, 0.08], '#e03131')
      b.box([0.25, 0.03, -0.32], [0.1, 0.06, 0.04], '#2f9e44', { tile: 'paper', r: [0, 0.3, 0] })
    }
  },

  /** The grin's théière (Tea.tsx, in its pivot group): blue enamel belly, lid and knob, the long spout rising to the tip, the black handle. */
  'tea-pot': (b, q) => {
    b.lathe([0, -0.135, 0], [[0.001, 0], [0.07, 0], [0.105, 0.04], [0.11, 0.08], [0.085, 0.13], [0.06, 0.14], [0.001, 0.14]], '#2f7fd0', { tile: 'enamel', seg: q.lo ? 10 : 14 })
    b.lathe([0, 0.0, 0], [[0.062, 0], [0.05, 0.025], [0.001, 0.03]], '#1b4f86', { tile: 'enamel', seg: 12 })
    b.ball([0, 0.04, 0], 0.016, '#1f2a44', { seg: 6 })
    // The spout: from the belly up to the tip (where the hand holds the pot to pour).
    b.cyl([0.13, -0.05, 0], 0.022, 0.12, '#2f7fd0', { top: 0.014, tile: 'enamel', seg: 8, r: [0, 0, -0.85] })
    b.cyl([0.185, 0.03, 0], 0.014, 0.08, '#2f7fd0', { top: 0.011, tile: 'enamel', seg: 8, r: [0, 0, -0.45] })
    // The handle, an arc over the back.
    b.ring([-0.11, -0.04, 0], 0.05, 0.012, '#1f2a44', { arc: Math.PI, r: [Math.PI / 2, 0, Math.PI / 2], seg: 10 })
  },

  /** A small tea glass served, at the line: the amber tea under its foam (the served ones lined up). */
  'tea-served': (b) => {
    b.on('glass').cyl([0, 0.07, 0], 0.03, 0.14, '#ffffff', { seg: 10, open: true }).on('solid')
    b.cyl([0, 0.045, 0], 0.027, 0.08, '#ffffff', { tile: 'tea', fit: true, seg: 10 })
    b.cyl([0, 0.1, 0], 0.028, 0.03, '#ffffff', { tile: 'foam', seg: 10 })
  },

  /** The shower (Douche.tsx): the tiled wall, the chrome pipe and its head, the soap on its shelf, the bucket and its cup, the toothbrush glass, the drain. */
  'douche-set': (b, q) => {
    b.box([0, 1.4, -0.7], [3, 2.8, 0.1], '#cfe8f2', { tile: 'tiles' })
    b.box([0, 0.06, -0.64], [3, 0.12, 0.04], '#9cc8de', { tile: 'tiles' })
    b.cyl([0.6, 2.1, -0.58], 0.03, 1.2, '#c8ccd2', { tile: 'alu', seg: 8 })
    b.cyl([0.35, 2.65, -0.58], 0.03, 0.55, '#c8ccd2', { tile: 'alu', seg: 8, r: [0, 0, Math.PI / 2] })
    b.cyl([0.1, 2.62, -0.4], 0.03, 0.36, '#c8ccd2', { tile: 'alu', seg: 8, r: [Math.PI / 2, 0, 0] })
    b.cyl([0.1, 2.6, -0.25], 0.16, 0.08, '#adb5bd', { top: 0.12, tile: 'alu', seg: 14 })
    b.cyl([0.1, 2.555, -0.25], 0.15, 0.01, '#495057', { tile: 'keys', seg: 14 })
    b.box([0.6, 1.3, -0.6], [0.14, 0.08, 0.08], '#c8ccd2', { tile: 'alu' })
    // The soap's shelf and the soap; a toothbrush in its glass.
    b.box([-0.8, 1.1, -0.55], [0.4, 0.05, 0.2], '#ffffff', { tile: 'enamel' })
    b.box([-0.85, 1.17, -0.55], [0.22, 0.09, 0.12], '#ffd43b', { tile: 'soap', fit: true, bevel: 0.025 })
    b.on('glass').cyl([-0.66, 1.2, -0.55], 0.045, 0.14, '#e7f5ff', { seg: 8 }).on('solid')
    b.box([-0.66, 1.3, -0.55], [0.02, 0.24, 0.02], '#1c7ed6', { tile: 'plastic', r: [0, 0, 0.15] })
    b.box([-0.645, 1.41, -0.54], [0.03, 0.05, 0.035], '#f8f9fa', { tile: 'straw' })
    // The bucket and its cup, as in most of Abidjan's showers.
    if (!q.lo) {
      b.lathe([-1.1, 0, -0.2], [[0.001, 0], [0.18, 0], [0.24, 0.4], [0.26, 0.41]], '#1c7ed6', { tile: 'plastic', seg: 14 })
      b.on('glass').cyl([-1.1, 0.34, -0.2], 0.23, 0.02, '#8fd0ff', { tile: 'water', seg: 14 }).on('solid')
      b.lathe([-1.05, 0.33, -0.2], [[0.001, 0], [0.07, 0], [0.09, 0.08]], '#e8590c', { tile: 'plastic', seg: 10 })
      b.box([1.0, 0.03, -0.3], [0.5, 0.06, 0.3], '#ffd43b', { tile: 'sponge' })
    }
    b.cyl([0.4, 0.002, 0.2], 0.1, 0.006, '#868e96', { tile: 'keys', seg: 10 })
  },

  /** The toilets' room (Toilettes.tsx): the tiled wall, the basin on its foot with its tap, a mirror, the roll; the WC's ceramic bowl and tank. */
  'wc-room': (b, q) => {
    b.box([0, 1.3, -0.75], [3.6, 2.6, 0.1], '#d0ebff', { tile: 'tiles' })
    b.box([0, 0.5, -0.69], [3.6, 1.0, 0.02], '#a5d8ff', { tile: 'tiles' })
    b.lathe([-1.0, 0.79, -0.45], [[0.001, 0], [0.18, 0.02], [0.27, 0.12], [0.28, 0.13]], '#f8f9fa', { tile: 'enamel', seg: 14, s: [1, 1, 0.75] })
    b.box([-1.0, 0.45, -0.55], [0.12, 0.8, 0.12], '#e9ecef', { tile: 'enamel' })
    b.cyl([-1.0, 1.0, -0.62], 0.025, 0.2, '#c8ccd2', { tile: 'alu', seg: 8 })
    b.cyl([-1.0, 1.08, -0.54], 0.02, 0.18, '#c8ccd2', { tile: 'alu', seg: 8, r: [Math.PI / 2, 0, 0] })
    b.box([-1.0, 1.6, -0.69], [0.5, 0.6, 0.03], '#dbeaf5', { tile: 'water' })
    if (!q.lo) {
      b.cyl([0.75, 0.75, -0.62], 0.08, 0.14, '#f8f9fa', { tile: 'paper', seg: 10, r: [0, 0, Math.PI / 2] })
      b.box([0.75, 0.85, -0.68], [0.24, 0.03, 0.06], '#c8ccd2', { tile: 'alu' })
    }
  },

  /** The WC itself, in its group (Toilettes.tsx Wc): the ceramic bowl, the seat, the tank. */
  'wc-bowl': (b) => {
    b.lathe([0, 0, 0.15], [[0.001, 0], [0.16, 0], [0.18, 0.2], [0.25, 0.38], [0.26, 0.4]], '#f8f9fa', { tile: 'enamel', seg: 16, s: [1, 1, 1.15] })
    b.ring([0, 0.42, 0.17], 0.21, 0.035, '#e9ecef', { seg: 16, s: [1, 1, 1.15], tile: 'plastic' })
    b.disc([0, 0.37, 0.16], 0.17, '#a5d8ff', { tile: 'water', s: [1, 1, 1.1] })
    b.box([0, 0.7, -0.15], [0.5, 0.55, 0.2], '#f8f9fa', { tile: 'enamel' })
    b.box([0, 0.985, -0.15], [0.52, 0.04, 0.22], '#e9ecef', { tile: 'enamel' })
  },

  /** The braiseuse's grill (Griller.tsx): a cut steel drum on legs, sooty, its rim; the charcoal lumps over the glowing bed (the bed's flicker shows between them), the bars, her straw fan and the piment bowl. */
  'grill-set': (b, q) => {
    b.box([0, 0.35, 0], [6, 0.7, 2.2], '#4a4a4e', { tile: 'soot', fit: true })
    b.box([0, 0.71, 1.08], [6.04, 0.06, 0.08], '#5a5a60', { tile: 'metal' })
    b.box([0, 0.71, -1.08], [6.04, 0.06, 0.08], '#5a5a60', { tile: 'metal' })
    for (const x of [-2.9, 2.9]) for (const z of [-0.95, 0.95]) b.box([x, 0.05, z], [0.1, 0.1, 0.1], '#2a2a2e')
    const n = q.lo ? 40 : 80
    for (let i = 0; i < n; i++) b.box([-2.75 + ((i * 37) % 56) / 10 + ((i * 7) % 3) * 0.03, 0.775, -0.88 + ((i * 53) % 18) / 10], [0.28, 0.08 + (i % 3) * 0.03, 0.22], i % 4 ? '#2a2420' : '#3a302a', { tile: 'cement', r: [0, i, 0] })
    for (const z of [-0.75, -0.45, -0.15, 0.15, 0.45, 0.75]) b.cyl([0, 0.8, z], 0.022, 5.9, '#9aa0a6', { tile: 'alu', seg: 6, r: [0, 0, Math.PI / 2] })
    if (!q.lo) {
      b.box([3.35, 0.35, 0.6], [0.5, 0.02, 0.6], '#c9a55a', { tile: 'straw', r: [0.2, 0, 1.2] })
      b.lathe([-3.4, 0, 0.7], [[0.001, 0], [0.2, 0], [0.28, 0.16], [0.3, 0.17]], '#f4f2ea', { tile: 'enamel', seg: 12 })
      b.disc([-3.4, 0.14, 0.7], 0.26, '#c0391b', { tile: 'sauce' })
    }
  },
}

/** The classroom (Ecole.tsx) for its desks: cement floor, walls painted cream over green, the blackboard and its chalk ledge, a map, the tables-bancs with a cahier and a slate on each. */
export function ecoleRoom(desks: { x: number; z: number }[]): Recipe {
  return (b, q) => {
    b.box([0, -0.05, 0], [12, 0.1, 12], '#c4b494', { tile: 'sand' })
    b.box([0, 1.6, -2.6], [12, 3.2, 0.1], '#f2e2b8', { tile: 'plain' })
    b.box([0, 0.6, -2.54], [12, 1.2, 0.02], '#2f8a5a', { tile: 'metal' })
    b.box([0, 1.2, -2.53], [12, 0.05, 0.03], '#1f5a3a')
    b.box([0, 1.75, -2.53], [3.6, 1.5, 0.04], '#6b4426', { tile: 'wood' })
    b.box([0, 1.75, -2.5], [3.4, 1.3, 0.04], '#ffffff', { tile: 'chalkboard', fit: true })
    b.box([0, 1.08, -2.45], [3.4, 0.05, 0.12], '#6b4426', { tile: 'wood' })
    b.box([-0.9, 1.12, -2.43], [0.14, 0.03, 0.03], '#f8f9fa')
    b.box([0.5, 1.13, -2.43], [0.2, 0.06, 0.06], '#3a3a3a', { tile: 'fabric' })
    if (!q.lo) {
      // A map pinned up, the class timetable, the teacher's desk.
      b.box([-2.9, 1.9, -2.54], [1.0, 0.7, 0.01], '#ffffff', { tile: 'news', fit: true })
      b.box([2.8, 1.9, -2.54], [0.7, 0.9, 0.01], '#ffffff', { tile: 'page', fit: true })
      b.box([2.3, 0.75, -2.0], [1.2, 0.06, 0.6], '#8a5a32', { tile: 'wood' })
      b.box([2.3, 0.37, -2.0], [1.1, 0.72, 0.55], '#6b4426', { tile: 'wood' })
      b.box([2.1, 0.79, -2.0], [0.3, 0.03, 0.22], '#1c7ed6', { tile: 'book', fit: true })
    }
    for (const d of desks) {
      const { x, z } = d
      // The table-banc: the slanted top, its pen groove, the shelf under, the bench, the steel frame.
      b.box([x, 0.5, z - 0.45], [0.9, 0.05, 0.5], '#8a5a32', { tile: 'wood', r: [0.06, 0, 0] })
      b.box([x, 0.53, z - 0.66], [0.8, 0.012, 0.03], '#5a3a1e')
      b.box([x, 0.36, z - 0.45], [0.84, 0.03, 0.4], '#6b4426', { tile: 'wood' })
      b.box([x, 0.28, z + 0.05], [0.9, 0.05, 0.3], '#6b4426', { tile: 'wood' })
      for (const sx of [-0.4, 0.4]) {
        b.box([x + sx, 0.25, z - 0.45], [0.04, 0.5, 0.04], '#3a3f46', { tile: 'metal' })
        b.box([x + sx, 0.14, z + 0.05], [0.04, 0.28, 0.04], '#3a3f46', { tile: 'metal' })
        b.box([x + sx, 0.06, z - 0.2], [0.04, 0.04, 0.55], '#3a3f46', { tile: 'metal' })
      }
      if (!q.lo) {
        b.box([x - 0.18, 0.535, z - 0.42], [0.3, 0.012, 0.22], '#ffffff', { tile: 'ruled', fit: true, r: [0.06, 0.1, 0] })
        b.box([x + 0.22, 0.535, z - 0.45], [0.24, 0.015, 0.18], '#2a2e2c', { tile: 'chalkboard', fit: true, r: [0.06, -0.15, 0] })
      }
    }
  }
}

