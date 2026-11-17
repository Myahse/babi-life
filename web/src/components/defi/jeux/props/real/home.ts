import type { Recipe, V } from './kit'

// « Mini-jeux réalistes »: the house, the bathroom, the hairdresser's, the tailor's, clothes, care.
// Same sizes as the old props (about a unit, on y = 0, the front to +z).

export const HOME: Record<string, Recipe> = {
  /** A bar of « Kama » soap on its plastic dish, a few bubbles. */
  savon: (b, q) => {
    b.box([0, 0.03, 0], [0.72, 0.06, 0.5], '#4dabf7', { tile: 'plastic' })
    for (let i = 0; i < 4; i++) b.box([-0.24 + i * 0.16, 0.065, 0], [0.05, 0.012, 0.4], '#339af0')
    b.box([0, 0.14, 0], [0.5, 0.14, 0.32], '#f3d9a4', { tile: 'soap', fit: true, bevel: 0.035 })
    if (!q.lo) for (let i = 0; i < 3; i++) b.on('glass').ball([0.2 - i * 0.12, 0.24 + (i % 2) * 0.05, 0.12], 0.05 + i * 0.01, '#ffffff', { seg: 6 }).on('solid')
  },

  /** A kitchen sponge: yellow, the green scrub on top, its holes. */
  eponge: (b) => {
    b.box([0, 0.12, 0], [0.7, 0.24, 0.45], '#ffd43b', { tile: 'sponge' })
    b.box([0, 0.27, 0], [0.7, 0.07, 0.45], '#2f9e44', { tile: 'fabric' })
  },

  /** A striped towel over its little wooden stand. */
  serviette: (b) => {
    for (const x of [-0.42, 0.42]) b.box([x, 0.35, 0], [0.06, 0.7, 0.3], '#a0703e', { tile: 'wood' })
    b.cyl([0, 0.68, 0], 0.03, 0.9, '#a0703e', { tile: 'wood', seg: 6, r: [0, 0, Math.PI / 2] })
    for (const z of [-0.06, 0.06]) b.box([0, 0.42, z], [0.7, 0.52, 0.03], '#e64980', { tile: 'fabric' })
    for (const z of [-0.08, 0.08]) b.box([0, 0.3, z], [0.71, 0.06, 0.02], '#ffffff', { tile: 'fabric' })
  },

  /** The house's balai: the long fan of palm ribs tied with coloured string. */
  balai: (b, q) => {
    const n = q.lo ? 9 : 15
    for (let i = 0; i < n; i++) {
      const a = (i / (n - 1) - 0.5) * 0.5
      b.box([Math.sin(a) * 0.45, 0.05, -Math.cos(a) * 0.45 + 0.35], [0.025, 0.025, 0.95], i % 3 ? '#c9a55a' : '#b48a3e', { tile: 'straw', r: [0, a, 0] })
    }
    b.cyl([0, 0.06, -0.1], 0.07, 0.16, '#e03131', { seg: 8, r: [Math.PI / 2, 0, 0], tile: 'thread' })
  },

  /** A plastic bucket of water, its handle, a cup floating. */
  seau: (b, q) => {
    b.lathe([0, 0, 0], [[0.001, 0], [0.3, 0], [0.4, 0.6], [0.43, 0.62], [0.42, 0.64]], '#1c7ed6', { tile: 'plastic', seg: 16 })
    b.ring([0, 0.5, 0], 0.4, 0.012, '#1864ab', { seg: 18 })
    b.on('glass').cyl([0, 0.52, 0], 0.39, 0.02, '#8fd0ff', { seg: 16, tile: 'water' }).on('solid')
    b.ring([0, 0.64, 0], 0.42, 0.016, '#adb5bd', { arc: Math.PI, r: [Math.PI / 2, 0, 0], seg: 12, tile: 'metal' })
    if (!q.lo) b.lathe([0.12, 0.47, 0.05], [[0.001, 0], [0.09, 0], [0.11, 0.08]], '#f08c00', { tile: 'plastic', seg: 10 })
  },

  /** The iron: steel sole, blue body, the black handle and its wire. */
  'fer-a-repasser': (b) => {
    b.cyl([0, 0.04, 0], 0.32, 0.08, '#c8ccd2', { tile: 'alu', seg: 3, s: [1.6, 1, 1] })
    b.cyl([0.04, 0.16, 0], 0.27, 0.16, '#1c7ed6', { tile: 'plastic', seg: 3, top: 0.22, s: [1.6, 1, 1] })
    b.box([0.1, 0.4, 0], [0.5, 0.08, 0.1], '#212529', { tile: 'plastic' })
    for (const x of [-0.12, 0.32]) b.box([x, 0.31, 0], [0.06, 0.16, 0.08], '#212529')
    b.cyl([0.5, 0.18, 0], 0.02, 0.4, '#212529', { seg: 5, r: [0, 0, 1.2] })
  },

  /** The laundry: a plastic basin heaped with clothes. */
  linge: (b, q) => {
    b.lathe([0, 0, 0], [[0.001, 0], [0.38, 0], [0.5, 0.26], [0.53, 0.28]], '#e03131', { tile: 'plastic', seg: 16 })
    const c = ['#ffffff', '#1c7ed6', '#ffd43b', '#2f9e44', '#e64980']
    for (let i = 0; i < (q.lo ? 4 : 7); i++) b.box([Math.cos(i * 2.3) * 0.18, 0.26 + (i % 3) * 0.06, Math.sin(i * 2.3) * 0.18], [0.36, 0.08, 0.26], c[i % 5], { tile: i % 2 ? 'fabric' : 'twill', r: [0.2, i, 0.15] })
  },

  /** A table lamp: wooden foot, cream shade, the bulb lit. */
  lampe: (b) => {
    b.cyl([0, 0.03, 0], 0.22, 0.06, '#7a4a20', { tile: 'wood', seg: 12 })
    b.cyl([0, 0.3, 0], 0.04, 0.5, '#7a4a20', { tile: 'wood', seg: 8 })
    b.on('glow').ball([0, 0.6, 0], 0.08, '#fff3bf', { seg: 8 }).on('solid')
    b.cyl([0, 0.7, 0], 0.32, 0.36, '#f1e3c4', { top: 0.2, tile: 'fabric', seg: 14, open: true })
  },

  /** A small vase, a flower. */
  fleur: (b) => {
    b.lathe([0, 0, 0], [[0.001, 0], [0.14, 0], [0.2, 0.15], [0.1, 0.32], [0.12, 0.36]], '#1c7ed6', { tile: 'enamel', seg: 12 })
    b.cyl([0, 0.55, 0], 0.016, 0.45, '#2f9e44', { seg: 5 })
    for (let i = 0; i < 6; i++) b.ball([Math.cos(i * 1.05) * 0.09, 0.82, Math.sin(i * 1.05) * 0.09], 0.08, '#e64980', { seg: 6, s: [1, 0.5, 1] })
    b.ball([0, 0.84, 0], 0.06, '#ffd43b', { seg: 6 })
    b.box([0.1, 0.5, 0], [0.22, 0.01, 0.08], '#2f9e44', { tile: 'leaf', r: [0, 0, 0.4] })
  },

  /** A potted plant: terracotta pot with its rim, long leaves. */
  plante: (b, q) => {
    b.lathe([0, 0, 0], [[0.001, 0], [0.2, 0], [0.28, 0.36], [0.31, 0.37], [0.31, 0.44], [0.001, 0.44]], '#c4622d', { tile: 'earth', seg: 12 })
    b.disc([0, 0.441, 0], 0.27, '#4a3020', { tile: 'earth' })
    const n = q.lo ? 6 : 10
    for (let i = 0; i < n; i++) b.box([Math.cos(i * 2.4) * 0.12, 0.75, Math.sin(i * 2.4) * 0.12], [0.1, 0.7, 0.012], i % 2 ? '#2f8a3a' : '#40a050', { tile: 'leaf', r: [Math.sin(i * 2.4) * 0.45, -i * 2.4, Math.cos(i * 2.4) * 0.45] })
  },

  /** A gift box: wrapped paper, the ribbon cross and bow. */
  cadeau: (b) => {
    b.box([0, 0.25, 0], [0.6, 0.5, 0.6], '#e03131', { tile: 'paper' })
    b.box([0, 0.25, 0], [0.62, 0.52, 0.1], '#ffd43b', { tile: 'fabric' })
    b.box([0, 0.25, 0], [0.1, 0.52, 0.62], '#ffd43b', { tile: 'fabric' })
    for (const s of [-1, 1]) b.ring([s * 0.09, 0.56, 0], 0.08, 0.025, '#fab005', { r: [Math.PI / 2, 0, 0], seg: 10 })
  },

  /** A baby bottle: the milk, the graduations, the blue ring and teat. */
  biberon: (b) => {
    b.on('glass').cyl([0, 0.3, 0], 0.16, 0.6, '#f8f9fa', { seg: 12 }).on('solid')
    b.cyl([0, 0.22, 0], 0.15, 0.42, '#fffaf0', { seg: 12, tile: 'plain' })
    for (let i = 0; i < 4; i++) b.box([0, 0.12 + i * 0.1, 0.155], [0.08, 0.01, 0.01], '#4dabf7')
    b.cyl([0, 0.63, 0], 0.17, 0.08, '#4dabf7', { seg: 12, tile: 'plastic' })
    b.ball([0, 0.72, 0], 0.08, '#f4c98a', { seg: 8, s: [1, 1.4, 1] })
  },

  /** Medicines: a box with the green cross, a blister, pills. */
  medicament: (b, q) => {
    b.box([-0.15, 0.2, 0], [0.5, 0.4, 0.22], '#f8f9fa', { tile: 'paper' })
    b.box([-0.15, 0.25, 0.115], [0.12, 0.04, 0.01], '#2f9e44')
    b.box([-0.15, 0.25, 0.115], [0.04, 0.12, 0.01], '#2f9e44')
    b.box([-0.15, 0.1, 0.115], [0.36, 0.05, 0.01], '#1c7ed6')
    b.box([0.3, 0.015, 0.1], [0.36, 0.03, 0.24], '#ced4da', { tile: 'alu' })
    if (!q.lo) for (let i = 0; i < 6; i++) b.ball([0.2 + (i % 3) * 0.1, 0.035, 0.04 + Math.floor(i / 3) * 0.12], 0.035, '#ffffff', { seg: 6, half: true })
  },

  /** A round table mirror on its foot. */
  miroir: (b) => {
    b.cyl([0, 0.02, 0], 0.22, 0.04, '#adb5bd', { tile: 'metal', seg: 12 })
    b.cyl([0, 0.2, 0], 0.025, 0.36, '#adb5bd', { tile: 'metal', seg: 6 })
    b.cyl([0, 0.62, 0], 0.32, 0.05, '#c9a227', { tile: 'metal', seg: 18, r: [Math.PI / 2, 0, 0] })
    b.cyl([0, 0.62, 0.028], 0.28, 0.01, '#dbeaf5', { tile: 'water', seg: 18, r: [Math.PI / 2, 0, 0] })
  },

  /** The hairdresser's comb laid flat. */
  peigne: (b, q) => {
    b.box([0, 0.025, -0.15], [0.9, 0.05, 0.12], '#212529', { tile: 'plastic' })
    const n = q.lo ? 10 : 16
    for (let i = 0; i < n; i++) b.box([-0.42 + (i * 0.84) / (n - 1), 0.02, 0.05], [0.025, 0.04, 0.3], '#212529')
  },

  /** Open scissors: crossed steel blades, red rings. */
  ciseaux: (b) => {
    for (const s of [-1, 1]) {
      b.box([-0.12, 0.02, s * 0.02], [0.56, 0.02, 0.06], '#c8ccd2', { tile: 'alu', r: [0, s * 0.22, 0] })
      b.ring([0.3, 0.02, s * 0.14], 0.1, 0.025, '#e03131', { seg: 10 })
    }
    b.cyl([0.08, 0.035, 0], 0.025, 0.02, '#495057', { seg: 6 })
  },

  /** The barber's razor (tondeuse): the body, the comb head, its cord. */
  rasoir: (b) => {
    b.box([0.1, 0.06, 0], [0.6, 0.12, 0.16], '#343a40', { tile: 'plastic' })
    b.box([-0.25, 0.06, 0], [0.1, 0.1, 0.18], '#c8ccd2', { tile: 'alu' })
    for (let i = 0; i < 6; i++) b.box([-0.31, 0.06, -0.075 + i * 0.03], [0.04, 0.08, 0.012], '#868e96')
    b.box([0.1, 0.125, 0], [0.12, 0.012, 0.06], '#2f9e44')
  },

  /** A hair dryer standing on its handle. */
  'seche-cheveux': (b) => {
    b.cyl([0, 0.25, 0], 0.06, 0.5, '#e64980', { seg: 8, tile: 'plastic' })
    b.cyl([0.05, 0.56, 0], 0.15, 0.5, '#e64980', { seg: 12, tile: 'plastic', r: [Math.PI / 2, 0, 0] })
    b.cyl([0.05, 0.56, 0.3], 0.1, 0.14, '#343a40', { seg: 10, r: [Math.PI / 2, 0, 0] })
    b.cyl([0.05, 0.56, -0.25], 0.15, 0.01, '#868e96', { seg: 12, r: [Math.PI / 2, 0, 0], tile: 'keys' })
  },

  /** A jar of shea cream and a tube. */
  creme: (b) => {
    b.cyl([-0.15, 0.15, 0], 0.22, 0.3, '#fff3bf', { seg: 14, tile: 'plastic' })
    b.cyl([-0.15, 0.31, 0], 0.2, 0.02, '#f8f0d8', { seg: 14 })
    b.cyl([-0.15, 0.15, 0], 0.225, 0.12, '#2f9e44', { seg: 14, open: true, tile: 'plastic' })
    b.cyl([0.3, 0.06, 0.05], 0.07, 0.45, '#f8f9fa', { top: 0.04, seg: 8, r: [0, 0, Math.PI / 2], tile: 'plastic' })
    b.cyl([0.06, 0.06, 0.05], 0.05, 0.07, '#e8590c', { seg: 8, r: [0, 0, Math.PI / 2] })
  },

  /** Perfume: the faceted glass, the amber scent, the gold neck and black cap. */
  parfum: (b) => {
    b.on('glass').box([0, 0.22, 0], [0.4, 0.44, 0.2], '#fff3bf').on('solid')
    b.box([0, 0.17, 0], [0.34, 0.32, 0.15], '#f59f00', { tile: 'gloss' })
    b.cyl([0, 0.48, 0], 0.05, 0.08, '#c9a227', { seg: 8, tile: 'metal' })
    b.box([0, 0.58, 0], [0.16, 0.12, 0.12], '#212529', { tile: 'plastic' })
  },

  /** Nail varnish: two bottles. */
  vernis: (b) => {
    for (const [x, c, s] of [[-0.12, '#c92a2a', 1], [0.18, '#f783ac', 0.8]] as [number, string, number][]) {
      b.on('glass').box([x, 0.12 * s, 0], [0.2 * s, 0.24 * s, 0.16 * s], '#ffffff').on('solid')
      b.box([x, 0.1 * s, 0], [0.17 * s, 0.18 * s, 0.13 * s], c, { tile: 'gloss' })
      b.cyl([x, 0.36 * s, 0], 0.05 * s, 0.24 * s, '#212529', { seg: 8 })
    }
  },

  /** Hair extensions: long strands, sewn into the weft. */
  meche: (b, q) => {
    b.box([0, 0.05, -0.38], [0.8, 0.06, 0.06], '#c92a2a', { tile: 'fabric' })
    const n = q.lo ? 8 : 14
    for (let i = 0; i < n; i++) b.box([-0.36 + (i * 0.72) / (n - 1), 0.025, 0.04], [0.05, 0.03, 0.8], i % 2 ? '#1a1410' : '#2b2018', { tile: 'thread', r: [0, (i - n / 2) * 0.02, 0] })
  },

  /** A folded wax pagne, the folds showing. */
  pagne: (b) => {
    for (let i = 0; i < 3; i++) b.box([0, 0.06 + i * 0.1, 0], [0.9 - i * 0.02, 0.1, 0.7], '#ffffff', { tile: 'wax' })
    for (let i = 0; i < 3; i++) b.box([0, 0.06 + i * 0.1, 0.352], [0.88, 0.02, 0.01], '#1a2a6c')
  },

  /** A folded shirt as in a shop: collar, buttons, pocket. */
  chemise: (b) => {
    b.box([0, 0.08, 0], [0.8, 0.16, 0.7], '#e7f5ff', { tile: 'fabric' })
    b.box([0, 0.18, -0.25], [0.36, 0.06, 0.16], '#e7f5ff', { tile: 'fabric' })
    for (let i = 0; i < 4; i++) b.cyl([0, 0.162, -0.12 + i * 0.13], 0.02, 0.01, '#ced4da', { seg: 6 })
    b.box([0.2, 0.162, 0.05], [0.16, 0.006, 0.16], '#d0ebff', { tile: 'fabric' })
  },

  /** A boubou laid flat, gold embroidery round the neck. */
  boubou: (b) => {
    b.box([0, 0.05, 0], [1.1, 0.1, 0.9], '#1c7ed6', { tile: 'fabric' })
    b.ring([0, 0.1, -0.15], 0.15, 0.025, '#fab005', { seg: 12 })
    b.box([0, 0.1, 0.1], [0.06, 0.012, 0.4], '#fab005', { tile: 'thread' })
  },

  /** A sneaker pair. */
  chaussure: (b) => {
    for (const z of [-0.18, 0.18]) {
      b.box([0, 0.04, z], [0.8, 0.08, 0.3], '#f8f9fa', { tile: 'plastic' })
      b.box([-0.05, 0.17, z], [0.6, 0.2, 0.28], '#1c7ed6', { tile: 'twill' })
      b.box([0.28, 0.14, z], [0.2, 0.12, 0.27], '#1c7ed6', { tile: 'twill' })
      for (let i = 0; i < 3; i++) b.box([0.1 - i * 0.1, 0.28, z], [0.03, 0.012, 0.2], '#ffffff')
    }
  },

  /** A handbag: leather, flap, gold clasp, handle. */
  sac: (b) => {
    b.box([0, 0.25, 0], [0.7, 0.5, 0.25], '#8a4b20', { tile: 'skin' })
    b.box([0, 0.38, 0.13], [0.68, 0.24, 0.02], '#743c18', { tile: 'skin' })
    b.box([0, 0.27, 0.145], [0.08, 0.06, 0.02], '#fab005', { tile: 'metal' })
    b.ring([0, 0.5, 0], 0.22, 0.025, '#5c2e10', { arc: Math.PI, r: [Math.PI / 2, 0, 0], seg: 12 })
  },

  /** A cap. */
  casquette: (b) => {
    b.ball([0, 0.02, 0], 0.3, '#e03131', { half: true, seg: 12, tile: 'twill' })
    b.box([0, 0.03, 0.36], [0.5, 0.025, 0.3], '#c92a2a', { tile: 'twill' })
    b.ball([0, 0.32, 0], 0.03, '#c92a2a', { seg: 6 })
  },

  /** Two wooden spools of thread. */
  bobine: (b) => {
    for (const [x, c] of [[-0.18, '#e03131'], [0.18, '#1c7ed6']] as [number, string][]) {
      for (const y of [0.025, 0.475]) b.cyl([x, y, 0], 0.15, 0.05, '#c8a273', { tile: 'wood', seg: 10 })
      b.cyl([x, 0.25, 0], 0.12, 0.4, c, { tile: 'thread', seg: 12 })
    }
  },

  /** A bolt of wax cloth, a length unrolled to the front. */
  tissu: (b) => {
    b.cyl([0, 0.2, -0.2], 0.2, 0.9, '#ffffff', { tile: 'wax', seg: 12, r: [0, 0, Math.PI / 2] })
    b.box([0, 0.01, 0.2], [0.9, 0.02, 0.6], '#ffffff', { tile: 'wax' })
  },

  /** The tailor's black sewing machine, gold lines, on its board; the wheel, the needle. */
  'machine-a-coudre': (b, q) => {
    b.box([0, 0.04, 0], [1.0, 0.08, 0.5], '#8a5a30', { tile: 'wood' })
    b.box([0.25, 0.3, 0], [0.18, 0.44, 0.24], '#1a1a1e', { tile: 'metal' })
    b.box([-0.05, 0.5, 0], [0.75, 0.16, 0.22], '#1a1a1e', { tile: 'metal' })
    b.box([-0.35, 0.33, 0], [0.12, 0.2, 0.18], '#1a1a1e', { tile: 'metal' })
    b.cyl([-0.36, 0.17, 0], 0.012, 0.1, '#c8ccd2', { seg: 5 })
    b.cyl([0.4, 0.45, 0], 0.13, 0.05, '#c8ccd2', { tile: 'alu', seg: 12, r: [0, 0, Math.PI / 2] })
    if (!q.lo) for (const x of [-0.25, 0.05]) b.box([x, 0.585, 0.112], [0.14, 0.02, 0.006], '#c9a227')
    b.box([-0.36, 0.09, 0.1], [0.4, 0.012, 0.3], '#ffffff', { tile: 'wax' })
  },

  /** Party balloons on strings, tied to a weight. */
  'ballon-fete': (b) => {
    for (const [p, c] of [[[-0.2, 0.75, 0], '#e03131'], [[0.18, 0.85, -0.05], '#ffd43b'], [[0, 0.65, 0.15], '#1c7ed6']] as [V, string][]) {
      b.ball(p, 0.2, c, { seg: 10, s: [1, 1.2, 1], tile: 'gloss' })
      b.cyl([p[0] / 2, p[1] / 2 - 0.05, p[2] / 2], 0.006, p[1] - 0.15, '#868e96', { seg: 4, r: [p[2], 0, -p[0] * 0.6] })
    }
    b.box([0, 0.05, 0], [0.14, 0.1, 0.14], '#495057', { tile: 'metal' })
  },

  /** A teddy bear sitting. */
  peluche: (b) => {
    b.ball([0, 0.25, 0], 0.22, '#b07a45', { seg: 10, tile: 'fabric', s: [1, 1.1, 0.9] })
    b.ball([0, 0.58, 0], 0.17, '#b07a45', { seg: 10, tile: 'fabric' })
    for (const s of [-1, 1]) {
      b.ball([s * 0.13, 0.72, 0], 0.06, '#8a5a30', { seg: 6, tile: 'fabric' })
      b.ball([s * 0.22, 0.3, 0.05], 0.07, '#b07a45', { seg: 6, tile: 'fabric', s: [1, 1.6, 1] })
      b.ball([s * 0.12, 0.06, 0.12], 0.08, '#b07a45', { seg: 6, tile: 'fabric', s: [1, 0.8, 1.4] })
      b.ball([s * 0.06, 0.62, 0.15], 0.02, '#111111', { seg: 5 })
    }
    b.ball([0, 0.54, 0.16], 0.06, '#e8c89a', { seg: 6 })
  },

  /** A wooden toy: stacking rings on their peg. */
  jouet: (b) => {
    b.cyl([0, 0.03, 0], 0.25, 0.06, '#a0703e', { tile: 'wood', seg: 12 })
    b.cyl([0, 0.3, 0], 0.04, 0.5, '#a0703e', { tile: 'wood', seg: 8 })
    const c = ['#e03131', '#f08c00', '#ffd43b', '#2f9e44', '#1c7ed6']
    for (let i = 0; i < 5; i++) b.ring([0, 0.1 + i * 0.09, 0], 0.2 - i * 0.03, 0.045, c[i], { seg: 12, tile: 'gloss' })
  },
}
