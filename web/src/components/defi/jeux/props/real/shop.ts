import type { Recipe } from './kit'
import { piment, plantainHand } from './food'

// « Mini-jeux réalistes »: the défi des courses (components/defi/Courses.tsx) in the concept's blocks:
// the things of the shopping list as they stand on a supermarket shelf (about 0.2 m across, standing
// on y = 0, the front to +z, as their old pictures were), the shelving with its price strips, the
// trolley's wire basket. In metres, as that scene is.

const W = 0.2

export const SHOP: Record<string, Recipe> = {
  /** A 5 kg sack of rice: woven white plastic, the red band and its print, the stitched top. */
  'courses-riz': (b, q) => {
    b.box([0, 0.09, 0], [0.17, 0.18, 0.08], '#f1ebdc', { tile: 'fabric', bevel: 0.025 })
    b.box([0, 0.08, 0.041], [0.15, 0.06, 0.004], '#e03131', { tile: 'plastic' })
    b.box([0, 0.08, 0.044], [0.08, 0.03, 0.002], '#ffffff', { tile: 'page', fit: true })
    b.box([0, 0.185, 0], [0.16, 0.014, 0.05], '#c9bfa6', { tile: q.lo ? 'plain' : 'thread' })
  },

  /** A bottle of palm-kernel oil: the yellow PET bottle, the oil gold through it, the red cap, the label. */
  'courses-huile': (b, q) => {
    b.lathe([0, 0, 0], [[0.001, 0], [0.045, 0], [0.05, 0.01], [0.05, 0.13], [0.03, 0.165], [0.016, 0.18], [0.016, 0.19], [0.001, 0.19]], '#f5b70a', { tile: 'gloss', seg: q.lo ? 8 : 12 })
    b.cyl([0, 0.07, 0], 0.052, 0.06, '#fff3c4', { tile: 'page', fit: true, seg: q.lo ? 8 : 12, open: true })
    b.cyl([0, 0.2, 0], 0.019, 0.022, '#e03131', { tile: 'plastic', seg: 8 })
  },

  /** A box of sugar cubes: blue and white card, the cubes printed on it. */
  'courses-sucre': (b) => {
    b.box([0, 0.08, 0], [0.16, 0.16, 0.07], '#3b7ddd', { tile: 'paper' })
    b.box([0, 0.08, 0.036], [0.12, 0.1, 0.002], '#ffffff', { tile: 'paper' })
    for (const [x, y] of [[-0.02, 0.07], [0.02, 0.07], [0, 0.1]]) b.box([x, y, 0.039], [0.035, 0.035, 0.004], '#f1f3f5', { tile: 'sponge' })
  },

  /** A tin of milk powder: the white tin, its blue label and the cow's field, the gold lid. */
  'courses-lait': (b, q) => {
    b.cyl([0, 0.075, 0], 0.07, 0.15, '#f4f6fb', { tile: 'alu', seg: q.lo ? 10 : 14 })
    b.cyl([0, 0.07, 0], 0.071, 0.08, '#1c7ed6', { tile: 'paper', seg: q.lo ? 10 : 14, open: true })
    b.cyl([0, 0.06, 0], 0.072, 0.02, '#40c057', { seg: q.lo ? 10 : 14, open: true })
    b.cyl([0, 0.155, 0], 0.068, 0.012, '#e8b923', { tile: 'metal', seg: q.lo ? 10 : 14 })
  },

  /** Tomato paste: three little tins stacked, red with their white band. */
  'courses-tomate': (b, q) => {
    for (const [x, y] of [[-0.045, 0], [0.045, 0], [0, 0.07]]) {
      b.cyl([x, y + 0.035, 0], 0.042, 0.07, '#d6262f', { tile: 'alu', seg: q.lo ? 8 : 12 })
      b.cyl([x, y + 0.035, 0], 0.043, 0.022, '#ffffff', { tile: 'paper', seg: q.lo ? 8 : 12, open: true })
      b.cyl([x, y + 0.071, 0], 0.04, 0.004, '#c8ccd2', { tile: 'metal', seg: q.lo ? 8 : 12 })
    }
  },

  /** A net of purple onions, the red mesh's label. */
  'courses-oignon': (b, q) => {
    const n = q.lo ? 5 : 7
    for (let i = 0; i < n; i++) b.ball([Math.cos(i * 2.4) * 0.05 * (i ? 1 : 0), 0.04 + (i > 3 ? 0.06 : 0) + (i ? 0 : 0.03), Math.sin(i * 2.4) * 0.03], 0.042, i % 2 ? '#9c3d8f' : '#b04a9f', { tile: 'onion', seg: 7, s: [1, 0.9, 1] })
    b.on('glass').ball([0, 0.07, 0], 0.095, '#e03131', { seg: 8, s: [1, 0.85, 0.6] }).on('solid')
    b.box([0, 0.16, 0], [0.03, 0.03, 0.02], '#e03131', { tile: 'plastic' })
    b.box([0, 0.08, 0.06], [0.06, 0.04, 0.003], '#ffffff', { tile: 'page', fit: true })
  },

  /** A tray of piments under film: the white tray, the red and green chillies. */
  'courses-piment': (b, q) => {
    b.box([0, 0.012, 0], [0.18, 0.024, 0.1], '#f8f9fa', { tile: 'sponge' })
    for (let i = 0; i < (q.lo ? 4 : 6); i++) piment(b, [-0.05 + (i % 3) * 0.05, 0.03 + Math.floor(i / 3) * 0.02, -0.02 + Math.floor(i / 3) * 0.03], 0.3 * i, i % 3 ? '#e03131' : '#2f9e44', 0.08)
    b.on('glass').box([0, 0.03, 0], [0.18, 0.04, 0.1], '#ffffff').on('solid')
  },

  /** A baguette in its paper sleeve, standing slanted. */
  'courses-pain': (b) => {
    b.cyl([0.0, 0.1, 0], 0.03, 0.24, '#d9a05b', { tile: 'crust', seg: 8, r: [0, 0, -0.8] })
    for (let i = 0; i < 3; i++) b.box([-0.05 + i * 0.05, 0.06 + i * 0.05, 0.026], [0.03, 0.006, 0.006], '#a8692c', { r: [0, 0, -0.8 + 1.2] })
    b.box([-0.05, 0.05, 0], [0.07, 0.1, 0.07], '#f1e3c4', { tile: 'paper', r: [0, 0, -0.8] })
  },

  /** A tray of eggs: the moulded card, six brown eggs. */
  'courses-oeufs': (b) => {
    b.box([0, 0.02, 0], [0.19, 0.04, 0.1], '#b8a07a', { tile: 'cardboard' })
    for (let i = 0; i < 6; i++) b.ball([-0.06 + (i % 3) * 0.06, 0.06, -0.022 + Math.floor(i / 3) * 0.044], 0.026, '#f3e3c3', { tile: 'skin', seg: 7, s: [1, 1.3, 1] })
  },

  /** A bar of green soap in its card wrap. */
  'courses-savon': (b) => {
    b.box([0, 0.03, 0], [0.16, 0.06, 0.08], '#37b24d', { tile: 'soap', bevel: 0.015 })
    b.box([0, 0.03, 0], [0.06, 0.062, 0.082], '#ffffff', { tile: 'paper' })
  },

  /** A fish on its polystyrene tray under film: the silver-blue scales, the eye, the tail. */
  'courses-poisson': (b, q) => {
    b.box([0, 0.01, 0], [0.2, 0.02, 0.1], '#ffffff', { tile: 'sponge' })
    b.ball([0, 0.04, 0], 0.07, '#5c7c99', { tile: 'scales', seg: q.lo ? 8 : 10, s: [1.3, 0.4, 0.5] })
    b.box([0.1, 0.04, 0], [0.03, 0.04, 0.008], '#4a6680', { r: [0, 0, 0.5] })
    b.ball([-0.07, 0.05, 0.02], 0.008, '#111111', { seg: 4 })
    b.on('glass').box([0, 0.04, 0], [0.2, 0.05, 0.1], '#ffffff').on('solid')
  },

  /** A hand of plantains: the long angular fingers, yellow going black at the ends, fanned from their crown. */
  'courses-plantain': (b, q) => plantainHand(b, [-0.1, 0, 0.0], 0, 0.21, 0.02, '#e3b62a', q, q.lo ? 3 : 4, 0.2),

  /** A ball of attiéké in its plastic wrap, knotted, the orange tie. */
  'courses-attieke': (b, q) => {
    b.ball([0, 0.07, 0], 0.07, '#ffffff', { tile: 'attieke', seg: q.lo ? 8 : 10, s: [1, 0.95, 0.9] })
    b.on('glass').ball([0, 0.072, 0], 0.076, '#ffffff', { seg: 10, s: [1, 0.98, 0.92] }).on('solid')
    b.cone([0, 0.16, 0], 0.03, 0.05, '#f1f3f5', { seg: 6 })
    b.cyl([0, 0.145, 0], 0.016, 0.01, '#e8590c', { seg: 6 })
  },

  /** A bottle of water: the blue-tinted PET, the label (« Eau Lagon »), the blue cap. */
  'courses-eau': (b, q) => {
    b.on('glass').lathe([0, 0, 0], [[0.001, 0], [0.045, 0], [0.048, 0.01], [0.048, 0.13], [0.03, 0.17], [0.016, 0.185], [0.016, 0.19], [0.001, 0.19]], '#a5d8ff', { seg: q.lo ? 8 : 12 }).on('solid')
    b.cyl([0, 0.06, 0], 0.044, 0.1, '#74c0fc', { tile: 'water', seg: q.lo ? 8 : 12 })
    b.cyl([0, 0.08, 0], 0.049, 0.05, '#ffffff', { tile: 'labelEau', fit: true, seg: q.lo ? 8 : 12, open: true })
    b.cyl([0, 0.2, 0], 0.019, 0.022, '#1c7ed6', { tile: 'plastic', seg: 8 })
  },

  /** The aisle: the gondola's back in perforated steel, three shelves with their price strips (red, white labels), the uprights, the tiled floor. */
  'courses-aisle': (b, q) => {
    b.box([0, 0.6, -0.17], [6, 1.5, 0.04], '#e4e0d8', { tile: 'plain', big: true })
    // The pegboard's holes in rows, only on the stronger phones.
    if (!q.lo) for (let r = 0; r < 4; r++) for (let i = 0; i < 24; i++) b.box([-2.88 + i * 0.25, 0.3 + r * 0.4, -0.148], [0.02, 0.02, 0.004], '#b9b4aa')
    for (const y of [0.98, 0.58, 0.18]) {
      b.box([0, y - 0.015, -0.04], [6, 0.03, 0.3], '#c8ccd2', { tile: 'metal' })
      b.box([0, y - 0.035, 0.115], [6, 0.045, 0.012], '#e03131', { tile: 'plastic' })
      if (!q.lo) for (let i = 0; i < 22; i++) b.box([-2.9 + i * 0.27, y - 0.035, 0.123], [0.07, 0.03, 0.004], '#ffffff', { tile: 'page', fit: true })
    }
    for (const x of [-2.4, -1.2, 0, 1.2, 2.4]) b.box([x, 0.55, -0.14], [0.04, 1.4, 0.04], '#868e96', { tile: 'metal' })
    b.box([0, -0.5, 0.6], [6, 0.04, 2.4], '#e9e4da', { tile: 'tiles', big: true })
    // The aisle's sign above, hanging.
    if (!q.lo) b.box([0.6, 1.42, -0.05], [0.8, 0.16, 0.02], '#1c7ed6', { tile: 'plastic' })
  },

  /** The trolley's wire basket in front (the things land in it): the bars, the frame, the red handle. */
  'courses-trolley': (b, q) => {
    b.box([0, 0, 0], [0.46, 0.02, 0.22], '#c8ccd2', { tile: 'metal' })
    const n = q.lo ? 6 : 10
    for (let i = 0; i <= n; i++) {
      const x = -0.23 + (i * 0.46) / n
      for (const z of [-0.11, 0.11]) b.box([x, 0.1, z], [0.009, 0.2, 0.009], '#c8ccd2')
    }
    for (let i = 0; i <= 4; i++) for (const x of [-0.23, 0.23]) b.box([x, 0.1, -0.11 + i * 0.055], [0.009, 0.2, 0.009], '#c8ccd2')
    // Its chassis and castors down to the floor.
    for (const x of [-0.2, 0.2]) b.box([x, -0.14, 0], [0.02, 0.26, 0.02], '#868e96', { tile: 'metal' })
    for (const x of [-0.2, 0.2]) b.cyl([x, -0.27, 0], 0.03, 0.03, '#212529', { seg: 8, r: [Math.PI / 2, 0, 0] })
    for (const y of [0.1, 0.2]) {
      for (const z of [-0.11, 0.11]) b.box([0, y, z], [0.47, 0.01, 0.01], '#adb5bd', { tile: 'metal' })
      for (const x of [-0.23, 0.23]) b.box([x, y, 0], [0.01, 0.01, 0.23], '#adb5bd', { tile: 'metal' })
    }
    b.cyl([0.3, 0.22, 0], 0.016, 0.26, '#e03131', { tile: 'plastic', seg: 8, r: [Math.PI / 2, 0, 0] })
    for (const z of [-0.1, 0.1]) b.box([0.27, 0.21, z], [0.07, 0.012, 0.012], '#adb5bd', { tile: 'metal' })
  },
}

/** The products' recipe ids by their Courses id (Pixels.tsx PRODUCTS). */
export const shopId = (id: string) => `courses-${id}`
export const SHOP_W = W
