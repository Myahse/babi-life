import type { Recipe } from './kit'
import { piment } from './food'

// « Mini-jeux réalistes »: the treats and the kitchen's leftovers (the pastry, the fast food, the
// glace, the market's little things), the keys, the suitcase, the vote's urn and ballot, the shop's
// scanner. Same sizes as the old props (about a unit, on y = 0, the front to +z).

export const TREATS: Record<string, Recipe> = {
  /** A croissant: the rolled layers swelling to the middle, flaky gold, the tips curled in. */
  croissant: (b, q) => {
    for (let i = -2; i <= 2; i++) {
      const a = (i * Math.PI) / 5.5
      const r = [0.09, 0.13, 0.17, 0.13, 0.09][i + 2]
      // Each layer an egg along the crescent (its long axis on the curve), the ends thinner.
      b.ball([Math.sin(a) * 0.32, r * 0.75, -Math.cos(a) * 0.32 + 0.2], r, i % 2 ? '#c87a2a' : '#dd9a45', { tile: 'crust', seg: q.lo ? 8 : 10, s: [1.35, 0.75, 0.8], r: [0, -a, 0] })
      // The roll's ridge, darker, between the layers.
      if (!q.lo && i < 2) b.box([Math.sin(a + 0.28) * 0.32, r * 1.2, -Math.cos(a + 0.28) * 0.32 + 0.2], [0.03, 0.025, r * 1.7], '#9a5418', { r: [0, -a - 0.28, 0] })
    }
  },

  /** A burger in its paper: sesame bun, the patty with its grill marks, cheese melting over, lettuce, tomato. */
  burger: (b, q) => {
    b.box([0, 0.006, 0], [0.95, 0.012, 0.95], '#f1e3c4', { tile: 'paper', r: [0, 0.4, 0] })
    b.cyl([0, 0.07, 0], 0.38, 0.12, '#d9963f', { tile: 'crust', seg: 14 })
    b.cyl([0, 0.17, 0], 0.4, 0.1, '#5c3317', { tile: 'meat', seg: 14 })
    b.box([0, 0.225, 0], [0.62, 0.02, 0.62], '#fcc419', { r: [0, Math.PI / 4, 0] })
    for (const [x, z] of [[0.3, 0.3], [-0.3, 0.3], [0.3, -0.3]]) b.box([x * 0.95, 0.19, z * 0.95], [0.05, 0.08, 0.05], '#fcc419', { r: [0, Math.PI / 4, 0] })
    b.cyl([0, 0.255, 0], 0.43, 0.035, '#40c057', { tile: 'leaf', seg: 9 })
    b.cyl([0, 0.29, 0], 0.36, 0.035, '#e03131', { tile: 'seeds', seg: 12 })
    b.ball([0, 0.31, 0], 0.39, '#e0a04d', { tile: 'crust', half: true, s: [1, 0.6, 1], seg: q.lo ? 10 : 14 })
    if (!q.lo) for (let i = 0; i < 9; i++) {
      const a = i * 2.4
      const d = 0.08 + (i % 3) * 0.08
      b.box([Math.cos(a) * d, 0.31 + Math.sqrt(Math.max(0, 0.152 - d * d)) * 0.6, Math.sin(a) * d], [0.04, 0.015, 0.022], '#fff4d6', { r: [0, i, 0] })
    }
  },

  /** A pizza on its wooden board: the crust's blistered rim, the sauce, melted cheese, pepperoni, olives, basil. */
  pizza: (b, q) => {
    b.cyl([0, 0.02, 0], 0.54, 0.04, '#b07a44', { tile: 'wood', seg: 16, big: true })
    b.box([0.62, 0.02, 0], [0.22, 0.04, 0.1], '#b07a44', { tile: 'wood' })
    b.cyl([0, 0.07, 0], 0.5, 0.06, '#d9964a', { tile: 'crust', seg: 16 })
    b.cyl([0, 0.1, 0], 0.43, 0.012, '#c4381c', { tile: 'sauce', seg: 16 })
    b.cyl([0, 0.107, 0], 0.4, 0.012, '#f6c453', { tile: 'foam', seg: 14 })
    for (const [x, z] of [[0, 0], [0.22, 0.12], [-0.2, 0.15], [0.05, -0.25], [-0.18, -0.15], [0.25, -0.12], [0.02, 0.28]]) b.cyl([x, 0.12, z], 0.07, 0.016, '#b02020', { tile: 'meat', seg: 9 })
    if (!q.lo) {
      for (const [x, z] of [[0.12, 0.02], [-0.08, 0.12], [-0.05, -0.12], [0.3, 0.05]]) b.ring([x, 0.125, z], 0.02, 0.01, '#212529', { seg: 6 })
      for (const [x, z, r] of [[0.14, 0.24, 0], [-0.3, 0.0, 1], [0.14, -0.2, 2]]) b.box([x, 0.125, z], [0.1, 0.008, 0.05], '#2f9e44', { tile: 'leaf', r: [0, r, 0] })
    }
  },

  /** A glace in its cone: the waffle's crossed lines, a strawberry scoop and a chocolate one, a cherry. */
  glace: (b, q) => {
    b.cone([0, 0.26, 0], 0.17, 0.52, '#d9a35b', { tile: 'pine', seg: 10, r: [Math.PI, 0, 0] })
    b.cyl([0, 0.5, 0], 0.18, 0.04, '#c98f45', { tile: 'crust', seg: 10 })
    b.ball([0, 0.62, 0], 0.2, '#f783ac', { tile: 'foam', seg: q.lo ? 8 : 12 })
    b.ball([0, 0.84, 0], 0.17, '#7a4a24', { tile: 'foam', seg: q.lo ? 8 : 12 })
    // A drip running down the side.
    if (!q.lo) b.box([0.16, 0.55, 0.06], [0.04, 0.12, 0.04], '#f783ac', { r: [0, 0.4, 0] })
    b.ball([0, 1.02, 0], 0.05, '#e03131', { tile: 'gloss', seg: 8 })
    b.cyl([0.02, 1.08, 0], 0.006, 0.08, '#2b8a3e', { seg: 4, r: [0, 0, -0.4] })
  },

  /** A birthday cake on its stand: chocolate sponge, cream between, pink icing, the white piping, strawberries, three candles lit. */
  gateau: (b, q) => {
    b.cyl([0, 0.02, 0], 0.5, 0.04, '#e9ecef', { tile: 'enamel', seg: 16 })
    b.cyl([0, 0.14, 0], 0.42, 0.2, '#8b5a2b', { tile: 'crust', seg: 16 })
    b.cyl([0, 0.26, 0], 0.43, 0.04, '#fff4e6', { tile: 'foam', seg: 16 })
    b.cyl([0, 0.37, 0], 0.42, 0.18, '#f8a5c2', { tile: 'plastic', seg: 16 })
    b.ring([0, 0.46, 0], 0.4, 0.035, '#ffffff', { seg: q.lo ? 12 : 20, tile: 'foam' })
    b.ring([0, 0.29, 0], 0.43, 0.025, '#ffffff', { seg: q.lo ? 12 : 20, tile: 'foam' })
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      b.ball([Math.sin(a) * 0.3, 0.52, Math.cos(a) * 0.3], 0.05, '#e03131', { tile: 'seeds', seg: 6, s: [1, 1.2, 1] })
    }
    for (const x of [-0.12, 0, 0.12]) {
      b.cyl([x, 0.58, 0], 0.02, 0.22, '#74c0fc', { tile: 'twill', seg: 6 })
      b.box([x, 0.7, 0], [0.006, 0.03, 0.006], '#212529')
      b.on('glow').cone([x, 0.76, 0], 0.03, 0.08, '#ffd43b', { seg: 6 }).on('solid')
    }
  },

  /** A cocktail: the stemmed glass (see-through), the pink drink, the sugared rim, a cherry, the straw and a little paper umbrella. */
  cocktail: (b, q) => {
    b.cyl([0, 0.012, 0], 0.2, 0.024, '#dee2e6', { tile: 'gloss', seg: 12 })
    b.cyl([0, 0.22, 0], 0.025, 0.4, '#dee2e6', { tile: 'gloss', seg: 6 })
    b.cone([0, 0.6, 0], 0.29, 0.3, '#f06595', { tile: 'gloss', seg: 12, r: [Math.PI, 0, 0] })
    b.disc([0, 0.75, 0], 0.29, '#f783ac', { tile: 'foam', seg: 12 })
    b.on('glass').cone([0, 0.58, 0], 0.34, 0.36, '#e7f5ff', { seg: 12, r: [Math.PI, 0, 0] }).on('solid')
    b.ring([0, 0.76, 0], 0.33, 0.015, '#ffffff', { tile: 'foam', seg: 14 })
    b.ball([0.12, 0.8, 0.08], 0.06, '#c92a2a', { tile: 'gloss', seg: 8 })
    b.cyl([-0.1, 0.86, 0], 0.012, 0.32, '#f8f9fa', { tile: 'twill', seg: 5, r: [0, 0, 0.3] })
    if (!q.lo) {
      b.cone([-0.16, 1.01, 0], 0.18, 0.08, '#ffd43b', { tile: 'wax', seg: 8, r: [0, 0, 0.3] })
      b.ball([0.2, 0.76, -0.12], 0.06, '#2f9e44', { tile: 'skin', seg: 6, s: [1, 0.4, 1] })
    }
  },

  /** A striped paper tub of popcorn, heaped over the rim. */
  popcorn: (b, q) => {
    b.cyl([0, 0.27, 0], 0.22, 0.54, '#ffffff', { tile: 'paper', seg: 12, top: 0.26 })
    for (let k = 0; k < 6; k++) b.cyl([0, 0.27, 0], 0.222, 0.54, '#e03131', { tile: 'paper', seg: 12, top: 0.262, arc: Math.PI / 6, open: true, r: [0, (k * Math.PI) / 3, 0] })
    const n = q.lo ? 12 : 22
    for (let i = 0; i < n; i++) {
      const a = i * 2.4
      const d = (i % 4) * 0.065
      b.ball([Math.sin(a) * d, 0.58 + (3 - (i % 4)) * 0.04, Math.cos(a) * d], 0.075, i % 3 ? '#fff9db' : '#ffe066', { tile: 'foam', seg: 5, s: [1, 0.85, 1.1], r: [i, i * 0.7, 0] })
    }
  },

  /** Three sweets in twisted cellophane, each its colour and its stripes. */
  bonbon: (b, q) => {
    for (const [x, z, c, r] of [[-0.1, -0.18, '#f06595', 0.2], [0.18, 0.06, '#ffd43b', -0.4], [-0.15, 0.24, '#4dabf7', 0.6]] as const) {
      const cs = Math.cos(r)
      const sn = Math.sin(r)
      b.ball([x, 0.11, z], 0.13, c, { tile: 'gloss', seg: q.lo ? 8 : 10, s: [1.3, 0.85, 0.85], r: [0, r, 0] })
      for (const s of [-1, 1]) b.cone([x + cs * s * 0.22, 0.11, z - sn * s * 0.22], 0.09, 0.14, c, { tile: 'wax', seg: 6, r: [0, r, -s * Math.PI / 2] })
      if (!q.lo) b.ring([x, 0.11, z], 0.13, 0.012, '#ffffff', { seg: 10, r: [0, r, Math.PI / 2] })
    }
  },

  /** The maquis' menu card on its little stand: the burgundy cover, the cream page, the dishes and their prices. */
  menu: (b) => {
    b.box([0, 0.02, 0.02], [0.6, 0.04, 0.12], '#495057', { tile: 'metal' })
    b.box([0, 0.3, -0.12], [0.1, 0.56, 0.03], '#7a1538', { tile: 'fabric', r: [-0.5, 0, 0] })
    b.box([0, 0.39, 0], [0.56, 0.74, 0.05], '#a61e4d', { tile: 'fabric', r: [-0.2, 0, 0] })
    b.box([0, 0.39, 0.03], [0.46, 0.64, 0.01], '#fff4e6', { tile: 'page', fit: true, r: [-0.2, 0, 0] })
    b.box([0, 0.66, 0.08], [0.36, 0.05, 0.012], '#ffd43b', { r: [-0.2, 0, 0] })
  },

  /** The house keys on their ring, a red plastic tag. */
  cle: (b, q) => {
    b.ring([-0.28, 0.02, 0], 0.15, 0.018, '#adb5bd', { seg: 14, tile: 'metal' })
    for (const [r, c] of [[0.3, '#e8a33c'], [-0.5, '#c8ccd2']] as const) {
      const cs = Math.cos(r)
      const sn = Math.sin(r)
      const at = (u: number, w: number): [number, number, number] => [-0.28 + 0.15 * cs + u * cs - w * sn, 0.025, 0.15 * -sn - u * sn - w * cs]
      b.cyl(at(0.08, 0), 0.1, 0.03, c, { tile: 'metal', seg: 10 })
      b.box(at(0.38, 0), [0.42, 0.03, 0.06], c, { tile: 'metal', r: [0, r, 0] })
      for (let k = 0; k < 4; k++) b.box(at(0.28 + k * 0.06, 0.04 + (k % 2) * 0.02), [0.04, 0.03, 0.04 + (k % 2) * 0.03], c, { tile: 'metal', r: [0, r, 0] })
    }
    if (!q.lo) b.box([-0.36, 0.025, 0.26], [0.18, 0.05, 0.12], '#e03131', { tile: 'plastic', r: [0, 0.5, 0] })
  },

  /** A hard-shell suitcase: blue ribbed shell, the zip round it, corners, the telescopic handle, wheels. */
  valise: (b, q) => {
    b.box([0, 0.37, 0], [0.8, 0.62, 0.3], '#1971c2', { tile: 'plastic' })
    for (let i = 0; i < 4; i++) b.box([-0.27 + i * 0.18, 0.37, 0.152], [0.05, 0.56, 0.01], '#1864ab', { tile: 'plastic' })
    b.box([0, 0.37, 0], [0.81, 0.62, 0.04], '#343a40', { tile: 'twill' })
    for (const x of [-0.39, 0.39]) for (const y of [0.08, 0.66]) b.box([x, y, 0], [0.06, 0.06, 0.32], '#343a40', { tile: 'plastic' })
    for (const x of [-0.3, 0.3]) {
      b.cyl([x, 0.03, 0.1], 0.035, 0.04, '#212529', { seg: 8, r: [0, 0, Math.PI / 2] })
      b.cyl([x, 0.03, -0.1], 0.035, 0.04, '#212529', { seg: 8, r: [0, 0, Math.PI / 2] })
    }
    for (const x of [-0.11, 0.11]) b.box([x, 0.76, -0.1], [0.03, 0.18, 0.03], '#adb5bd', { tile: 'alu' })
    b.box([0, 0.86, -0.1], [0.28, 0.04, 0.06], '#212529', { tile: 'plastic' })
    if (!q.lo) b.box([0.25, 0.5, 0.165], [0.12, 0.08, 0.01], '#ffffff', { tile: 'page', fit: true })
  },

  /** The vote's urn: the see-through box, its blue frame and slot, ballots inside, the commission's seal. */
  urne: (b) => {
    b.box([0, 0.03, 0], [0.66, 0.06, 0.66], '#1864ab', { tile: 'plastic' })
    for (const [x, z, r] of [[0.05, 0.05, 0.4], [-0.12, -0.08, -0.3], [0.1, -0.1, 1.1]]) b.box([x, 0.09 + Math.abs(r) * 0.04, z], [0.26, 0.012, 0.18], '#f8f9fa', { tile: 'page', fit: true, r: [0.1, r, 0] })
    for (const [x, z] of [[-0.31, -0.31], [0.31, -0.31], [-0.31, 0.31], [0.31, 0.31]]) b.box([x, 0.36, z], [0.04, 0.6, 0.04], '#1864ab', { tile: 'plastic' })
    b.box([0, 0.68, 0], [0.66, 0.05, 0.66], '#1864ab', { tile: 'plastic' })
    b.box([0, 0.707, 0], [0.36, 0.006, 0.05], '#111111')
    b.box([0, 0.36, 0.33], [0.24, 0.12, 0.004], '#ffffff', { tile: 'page', fit: true })
    b.on('glass').box([0, 0.36, 0], [0.62, 0.6, 0.62], '#e7f5ff').on('solid')
  },

  /** A ballot: the candidates' colours in their boxes, names as grey lines, one box crossed in red. */
  bulletin: (b) => {
    b.box([0, 0.01, 0], [0.56, 0.02, 0.76], '#ffffff', { tile: 'paper', r: [0, 0.15, 0] })
    const cs = Math.cos(0.15)
    const sn = Math.sin(0.15)
    const at = (x: number, z: number): [number, number, number] => [x * cs + z * sn, 0.024, -x * sn + z * cs]
    ;['#f08c00', '#2f9e44', '#1c7ed6', '#e03131'].forEach((c, i) => {
      const z = -0.26 + i * 0.17
      b.box(at(-0.17, z), [0.12, 0.008, 0.12], c, { r: [0, 0.15, 0] })
      b.box(at(0.06, z), [0.24, 0.006, 0.025], '#868e96', { r: [0, 0.15, 0] })
      b.box(at(0.22, z), [0.07, 0.006, 0.07], '#495057', { r: [0, 0.15, 0] })
    })
    for (const r of [0.8, -0.8]) b.box(at(0.22, -0.09), [0.09, 0.008, 0.02], '#e03131', { r: [0, 0.15 + r, 0] })
  },

  /** The cashier's barcode gun on its base: the grip, the head, the red window lit, the green light. */
  scanner: (b) => {
    b.box([0, 0.04, 0], [0.4, 0.08, 0.4], '#343a40', { tile: 'plastic' })
    b.box([0, 0.3, -0.06], [0.14, 0.46, 0.16], '#212529', { tile: 'plastic', r: [-0.2, 0, 0] })
    b.box([0, 0.4, 0.03], [0.06, 0.1, 0.04], '#fcc419', { tile: 'plastic', r: [-0.2, 0, 0] })
    b.box([0, 0.6, 0.06], [0.26, 0.2, 0.42], '#343a40', { tile: 'plastic', r: [-0.2, 0, 0] })
    b.on('glow')
    b.box([0, 0.64, 0.27], [0.22, 0.14, 0.012], '#ff2d2d', { r: [-0.2, 0, 0] })
    b.box([0, 0.71, 0.0], [0.12, 0.012, 0.1], '#40c057', { r: [-0.2, 0, 0] })
    b.on('solid')
  },

  /** The half-baguette opened on its paper: the omelette folded in, onion, tomato, the piment. */
  omelette: (b, q) => {
    b.box([0, 0.005, 0], [0.95, 0.01, 0.45], '#efe6d2', { tile: 'paper', r: [0, 0.1, 0] })
    b.cyl([0, 0.1, -0.06], 0.13, 0.82, '#d9a35a', { tile: 'crust', seg: 9, s: [1, 1, 0.7], r: [0, 0, Math.PI / 2] })
    b.cyl([0, 0.08, 0.08], 0.11, 0.8, '#d9a35a', { tile: 'crust', seg: 9, arc: Math.PI, s: [1, 1, 0.8], r: [0.4, 0, Math.PI / 2] })
    b.box([0, 0.17, 0.0], [0.74, 0.06, 0.2], '#ffd43b', { tile: 'foam', r: [0.15, 0, 0] })
    b.box([0.12, 0.21, 0.02], [0.1, 0.02, 0.08], '#e9d8fd', { tile: 'onion' })
    if (!q.lo) b.box([-0.08, 0.21, 0.03], [0.08, 0.02, 0.07], '#e03131', { tile: 'seeds' })
    piment(b, [-0.24, 0.21, -0.02], 0.3, '#d61f1f', 0.12)
  },

  /** A bottle of bissap, deep red through the plastic, its white cap and paper label. */
  bissap: (b, q) => {
    b.lathe([0, 0, 0], [[0.001, 0], [0.13, 0], [0.14, 0.03], [0.14, 0.5], [0.1, 0.58], [0.065, 0.64], [0.065, 0.68], [0.001, 0.68]], '#9c1c3a', { tile: 'gloss', seg: q.lo ? 10 : 14 })
    b.cyl([0, 0.3, 0], 0.142, 0.2, '#f1e3c4', { tile: 'paper', seg: q.lo ? 10 : 14, open: true })
    b.cyl([0, 0.3, 0], 0.143, 0.04, '#2f9e44', { seg: q.lo ? 10 : 14, open: true })
    b.cyl([0, 0.71, 0], 0.07, 0.06, '#f1f3f5', { tile: 'plastic', seg: 10 })
    if (!q.lo) for (let i = 0; i < 3; i++) b.box([Math.cos(i * 2) * 0.1, 0.06 + i * 0.12, 0.1], [0.03, 0.02, 0.02], '#5a0d20')
  },

  /** A block of butter half unwrapped on its foil paper, a knife's cut. */
  beurre: (b) => {
    b.box([0, 0.01, 0], [0.55, 0.02, 0.45], '#dee2e6', { tile: 'alu' })
    b.box([0, 0.12, 0], [0.36, 0.18, 0.26], '#ffe8a3', { tile: 'soap' })
    b.box([0.12, 0.215, 0], [0.12, 0.012, 0.27], '#fff3c4', { r: [0, 0, -0.2] })
    b.box([-0.2, 0.06, 0], [0.04, 0.1, 0.28], '#ced4da', { tile: 'alu', r: [0, 0, 0.5] })
  },

  /** A heap of palm nuts (graine), red to black, glossy, in their basin. */
  graine: (b, q) => {
    b.lathe([0, 0, 0], [[0.001, 0], [0.3, 0], [0.42, 0.12], [0.44, 0.13]], '#495057', { tile: 'alu', seg: 14 })
    const n = q.lo ? 12 : 22
    for (let i = 0; i < n; i++) {
      const a = i * 2.39
      const d = Math.sqrt(i / n) * 0.34
      b.ball([Math.cos(a) * d, 0.12 + (0.34 - d) * 0.5, Math.sin(a) * d], 0.07, i % 3 === 0 ? '#3b1a0a' : i % 3 === 1 ? '#c2410c' : '#e8590c', { tile: 'gloss', seg: 6, s: [1, 0.85, 1.2], r: [0, a, 0] })
    }
  },

  /** Okra pods, ridged and green, their stalks, lying crossed. */
  gombo: (b, q) => {
    for (let i = 0; i < 3; i++) {
      const z = -0.16 + i * 0.16
      const r = (i - 1) * 0.3
      b.cone([0, 0.07, z], 0.07, 0.55, '#5c940d', { tile: 'pod', seg: 6, r: [0, r, Math.PI / 2] })
      b.cyl([Math.cos(r) * 0.31, 0.07, z - Math.sin(r) * 0.31], 0.035, 0.08, '#2b8a3e', { seg: 5, r: [0, r, Math.PI / 2] })
    }
    if (!q.lo) b.cone([0.05, 0.16, 0.0], 0.065, 0.5, '#66a80f', { tile: 'pod', seg: 6, r: [0, 1.2, Math.PI / 2] })
  },

  /** A knobbly ginger root, its pale cut end. */
  gingembre: (b) => {
    b.ball([0, 0.1, 0], 0.24, '#d9b380', { tile: 'skin', seg: 8, s: [1, 0.45, 0.45] })
    b.ball([0.18, 0.16, 0.08], 0.09, '#c9a06a', { tile: 'skin', seg: 7 })
    b.ball([-0.16, 0.15, -0.06], 0.08, '#c9a06a', { tile: 'skin', seg: 7 })
    b.ball([0.05, 0.17, -0.1], 0.07, '#c9a06a', { tile: 'skin', seg: 6 })
    b.cyl([-0.235, 0.1, 0], 0.08, 0.02, '#f1dfa6', { seg: 8, r: [0, 0, Math.PI / 2] })
  },

  /** A big land snail (the escargot of the market): its spiral shell, the soft grey body, the horns. */
  escargot: (b, q) => {
    b.ball([0.08, 0.06, 0], 0.36, '#a68a64', { tile: 'hide', seg: 10, s: [1, 0.2, 0.3] })
    b.cyl([0.38, 0.15, 0], 0.07, 0.14, '#a68a64', { tile: 'hide', seg: 8, r: [0, 0, -0.5] })
    for (const z of [-0.035, 0.035]) b.cyl([0.42, 0.28, z], 0.01, 0.14, '#8a7050', { seg: 4, r: [0, 0, -0.3] })
    // The shell: rings winding smaller to its tip.
    for (let k = 0; k < (q.lo ? 3 : 5); k++) b.ring([-0.05 + k * 0.01, 0.28 + k * 0.012, 0], 0.17 - k * 0.032, 0.07 - k * 0.01, k % 2 ? '#6b4a2b' : '#8a6238', { seg: 12, tile: 'crust', r: [Math.PI / 2, 0, 0] })
    b.ball([-0.05, 0.28, 0], 0.13, '#5a3d22', { tile: 'crust', seg: 8, s: [1, 1, 0.9] })
  },
}
