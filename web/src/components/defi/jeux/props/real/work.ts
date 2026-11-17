import type { Recipe } from './kit'

// « Mini-jeux réalistes »: money and papers, the office, the school, the shop's counter, the
// building site, the street (flags, stones, leaves), music. Invented brands only.

export const WORK: Record<string, Recipe> = {
  /** A little stack of « 5000 » notes, invented, and one lying across. */
  billet: (b, q) => {
    for (let i = 0; i < (q.lo ? 3 : 6); i++) b.box([0, 0.01 + i * 0.012, 0], [0.8, 0.01, 0.42], '#ffffff', { tile: 'note', fit: true, r: [0, (i % 3) * 0.04, 0] })
    b.box([0.1, 0.09, 0.05], [0.8, 0.01, 0.42], '#ffffff', { tile: 'note', fit: true, r: [0, 0.5, 0] })
  },

  /** Coins: a two-metal one lying, a stack beside. */
  piece: (b) => {
    b.cyl([-0.18, 0.03, 0], 0.22, 0.06, '#c9a227', { tile: 'metal', seg: 14 })
    b.cyl([-0.18, 0.062, 0], 0.13, 0.008, '#c8ccd2', { tile: 'alu', seg: 12 })
    for (let i = 0; i < 5; i++) b.cyl([0.22, 0.03 + i * 0.05, 0.05], 0.16, 0.045, i % 2 ? '#c8ccd2' : '#c9a227', { tile: 'metal', seg: 12 })
  },

  /** A bank card of « Banque Lagune ». */
  'carte-bancaire': (b) => {
    b.box([0, 0.015, 0], [0.86, 0.02, 0.54], '#1c5fb0', { tile: 'plastic', bevel: 0.01 })
    b.box([-0.22, 0.027, -0.05], [0.14, 0.004, 0.11], '#e0b030', { tile: 'metal' })
    b.box([0, 0.027, 0.15], [0.7, 0.004, 0.05], '#d0ebff')
  },

  /** A manila folder, papers sticking out, its label. */
  dossier: (b) => {
    b.box([0, 0.02, 0], [0.9, 0.04, 0.7], '#e0b46a', { tile: 'cardboard' })
    b.box([0.05, 0.05, -0.05], [0.8, 0.02, 0.66], '#ffffff', { tile: 'page', fit: true })
    b.box([0, 0.075, 0.02], [0.92, 0.03, 0.7], '#e8bf78', { tile: 'paper' })
    b.box([-0.2, 0.092, 0.15], [0.36, 0.004, 0.12], '#ffffff', { tile: 'page', fit: true })
  },

  /** A ballpoint pen: body, cap, clip. */
  stylo: (b) => {
    b.cyl([0, 0.04, 0], 0.035, 0.8, '#f8f9fa', { seg: 6, r: [0, 0, Math.PI / 2], tile: 'plastic' })
    b.cyl([-0.3, 0.04, 0], 0.04, 0.22, '#1c5fb0', { seg: 6, r: [0, 0, Math.PI / 2], tile: 'plastic' })
    b.box([-0.3, 0.085, 0], [0.18, 0.01, 0.02], '#1c5fb0')
    b.cone([0.44, 0.04, 0], 0.03, 0.08, '#adb5bd', { seg: 6, r: [0, 0, -Math.PI / 2] })
  },

  /** A rubber stamp on its ink pad. */
  tampon: (b) => {
    b.box([0.1, 0.03, 0.15], [0.6, 0.06, 0.4], '#212529', { tile: 'metal' })
    b.box([0.1, 0.062, 0.15], [0.5, 0.01, 0.3], '#364fc7', { tile: 'fabric' })
    b.box([-0.15, 0.06, -0.15], [0.34, 0.06, 0.22], '#212529')
    b.cyl([-0.15, 0.2, -0.15], 0.05, 0.22, '#7a4a20', { tile: 'wood', seg: 8 })
    b.ball([-0.15, 0.34, -0.15], 0.1, '#7a4a20', { tile: 'wood', seg: 8 })
  },

  /** A school notebook (cahier): its blue cover and label, open on a ruled page. */
  cahier: (b) => {
    b.box([-0.22, 0.02, 0], [0.44, 0.03, 0.62], '#1c7ed6', { tile: 'plastic' })
    b.box([0.22, 0.02, 0], [0.44, 0.03, 0.62], '#1c7ed6', { tile: 'plastic' })
    b.box([-0.21, 0.04, 0], [0.42, 0.01, 0.6], '#ffffff', { tile: 'ruled', fit: true })
    b.box([0.21, 0.04, 0], [0.42, 0.01, 0.6], '#ffffff', { tile: 'ruled', fit: true })
    b.box([0, 0.045, 0], [0.02, 0.012, 0.6], '#adb5bd')
  },

  /** A hardback school book « MATHS ». */
  livre: (b) => {
    b.box([0, 0.08, 0], [0.62, 0.16, 0.8], '#f1ead8', { tile: 'paper' })
    b.box([0, 0.165, 0], [0.66, 0.02, 0.84], '#c92a2a', { tile: 'book', fit: true })
    b.box([0, 0.0, 0], [0.66, 0.02, 0.84], '#c92a2a', { tile: 'plastic' })
    b.box([-0.33, 0.08, 0], [0.03, 0.18, 0.84], '#a61e1e', { tile: 'plastic' })
  },

  /** A folded newspaper « Le Lagunaire ». */
  journal: (b) => {
    b.box([0, 0.02, 0], [0.7, 0.04, 0.9], '#f1efe8', { tile: 'news', fit: true })
    b.box([0.02, 0.045, 0.02], [0.68, 0.01, 0.88], '#f4f2ec', { tile: 'news', fit: true, r: [0, 0.03, 0] })
  },

  /** A smartphone: its lit screen, the camera bump. */
  telephone: (b) => {
    b.box([0, 0.03, 0], [0.42, 0.06, 0.82], '#212529', { tile: 'metal', bevel: 0.03 })
    b.on('glow').box([0, 0.061, 0], [0.37, 0.004, 0.74], '#ffffff', { tile: 'phone', fit: true }).on('solid')
  },

  /** A laptop open: keyboard, trackpad, the lit screen. */
  ordinateur: (b) => {
    b.box([0, 0.025, 0.2], [0.9, 0.05, 0.6], '#adb5bd', { tile: 'alu' })
    b.box([0, 0.052, 0.12], [0.8, 0.006, 0.34], '#ffffff', { tile: 'keys', fit: true })
    b.box([0, 0.052, 0.4], [0.26, 0.006, 0.14], '#ced4da')
    b.box([0, 0.33, -0.12], [0.9, 0.58, 0.04], '#adb5bd', { tile: 'alu', r: [-0.2, 0, 0] })
    b.on('glow').box([0, 0.33, -0.095], [0.82, 0.5, 0.004], '#ffffff', { tile: 'screen', fit: true, r: [-0.2, 0, 0] }).on('solid')
  },

  /** A ticket: pale orange, the red band, the stub. */
  ticket: (b) => {
    b.box([0, 0.01, 0], [0.8, 0.012, 0.36], '#ffd8a8', { tile: 'paper' })
    b.box([-0.1, 0.017, 0], [0.5, 0.004, 0.08], '#e03131')
    for (let i = 0; i < 6; i++) b.box([0.25, 0.017, -0.15 + i * 0.06], [0.012, 0.004, 0.03], '#a6825a')
  },

  /** A passport, dark green, the gold emblem. */
  passeport: (b) => {
    b.box([0, 0.03, 0], [0.5, 0.06, 0.7], '#1b4a2c', { tile: 'twill', bevel: 0.015 })
    b.box([0.02, 0.03, 0], [0.48, 0.045, 0.68], '#f4efe0', { tile: 'paper' })
    b.cyl([0, 0.062, -0.05], 0.09, 0.004, '#c9a227', { seg: 10, tile: 'metal' })
  },

  /** An open cardboard box, its flaps up, the tape. */
  carton: (b) => {
    b.box([0, 0.25, 0], [0.8, 0.5, 0.6], '#c79a5a', { tile: 'cardboard' })
    b.box([0, 0.5, 0], [0.76, 0.01, 0.56], '#7a5a30')
    for (const s of [-1, 1]) b.box([0, 0.6, s * 0.36], [0.8, 0.22, 0.02], '#c79a5a', { tile: 'cardboard', r: [s * 0.4, 0, 0] })
  },

  /** A closed parcel: kraft, the tape cross, the address label. */
  colis: (b) => {
    b.box([0, 0.22, 0], [0.8, 0.44, 0.6], '#c79a5a', { tile: 'cardboard' })
    b.box([0, 0.22, 0], [0.82, 0.46, 0.1], '#b08046', { tile: 'plastic' })
    b.box([0.2, 0.442, 0.15], [0.26, 0.004, 0.18], '#ffffff', { tile: 'page', fit: true })
  },

  /** A calculator: the screen with its digits, the keys, the orange equals. */
  calculatrice: (b) => {
    b.box([0, 0.03, 0], [0.5, 0.06, 0.78], '#343a40', { tile: 'plastic', bevel: 0.02 })
    b.box([0, 0.062, -0.24], [0.4, 0.006, 0.16], '#a9c09a')
    b.box([0, 0.062, 0.1], [0.42, 0.006, 0.46], '#ffffff', { tile: 'keys', fit: true })
    b.box([0.15, 0.066, 0.29], [0.1, 0.008, 0.07], '#f08c00')
  },

  /** The blackboard on its feet: wooden frame, chalk sums on the green slate, the tray and its chalk. */
  'tableau-noir': (b) => {
    for (const x of [-0.5, 0.5]) b.box([x, 0.5, -0.05], [0.06, 1.0, 0.06], '#7a4a20', { tile: 'wood', r: [0.12, 0, 0] })
    b.box([0, 0.62, 0], [1.0, 0.66, 0.05], '#7a4a20', { tile: 'wood' })
    b.box([0, 0.62, 0.028], [0.92, 0.58, 0.01], '#ffffff', { tile: 'chalkboard', fit: true })
    b.box([0, 0.28, 0.06], [0.9, 0.03, 0.1], '#7a4a20', { tile: 'wood' })
    b.box([-0.2, 0.31, 0.06], [0.12, 0.025, 0.025], '#f8f9fa')
    b.box([0.1, 0.31, 0.06], [0.16, 0.06, 0.04], '#3a3a3a', { tile: 'fabric' })
  },

  /** Chalk: the box, sticks poking out, two lying in front. */
  craie: (b) => {
    b.box([0, 0.15, -0.1], [0.5, 0.3, 0.3], '#1c7ed6', { tile: 'cardboard' })
    for (let i = 0; i < 5; i++) b.cyl([-0.16 + i * 0.08, 0.34, -0.1], 0.03, 0.14, i === 2 ? '#ffd43b' : '#f8f9fa', { seg: 6, tile: 'cement' })
    for (const x of [-0.1, 0.15]) b.cyl([x, 0.03, 0.22], 0.03, 0.3, '#f8f9fa', { seg: 6, r: [0, x * 3, Math.PI / 2], tile: 'cement' })
  },

  /** The shop's cash register: drawer, keypad, the lit display. */
  'caisse-enregistreuse': (b) => {
    b.box([0, 0.12, 0], [0.9, 0.24, 0.7], '#495057', { tile: 'metal' })
    b.box([0, 0.06, 0.36], [0.8, 0.1, 0.04], '#343a40')
    b.box([0, 0.3, 0.1], [0.7, 0.14, 0.4], '#343a40', { tile: 'metal', r: [-0.3, 0, 0] })
    b.box([0, 0.38, 0.12], [0.6, 0.01, 0.32], '#ffffff', { tile: 'keys', fit: true, r: [-0.3, 0, 0] })
    b.box([0.2, 0.5, -0.25], [0.06, 0.4, 0.06], '#343a40')
    b.on('glow').box([0.2, 0.72, -0.25], [0.4, 0.14, 0.04], '#69db7c').on('solid')
  },

  /** The market's scale: the red body, its dial, the steel pan. */
  balance: (b) => {
    b.box([0, 0.25, 0], [0.6, 0.5, 0.4], '#c92a2a', { tile: 'metal' })
    b.cyl([0, 0.3, 0.205], 0.2, 0.02, '#f8f9fa', { seg: 16, r: [Math.PI / 2, 0, 0] })
    b.box([0.05, 0.33, 0.218], [0.02, 0.15, 0.006], '#212529', { r: [0, 0, 0.6] })
    b.lathe([0, 0.5, 0], [[0.001, 0], [0.3, 0.02], [0.42, 0.1]], '#c8ccd2', { tile: 'alu', seg: 16 })
  },

  /** A claw hammer: worn wooden handle, the steel head. */
  marteau: (b) => {
    b.box([0.1, 0.05, 0], [0.8, 0.08, 0.1], '#b5823f', { tile: 'wood' })
    b.box([-0.32, 0.08, 0], [0.12, 0.14, 0.42], '#5a5e64', { tile: 'metal' })
    b.box([-0.32, 0.08, 0.26], [0.1, 0.1, 0.12], '#5a5e64', { tile: 'metal' })
    b.box([-0.32, 0.08, -0.26], [0.06, 0.08, 0.14], '#5a5e64', { tile: 'metal', r: [0, 0, 0.2] })
  },

  /** Parpaings: grey breeze blocks with their holes, one across the other. */
  brique: (b) => {
    b.box([0, 0.12, 0], [0.8, 0.24, 0.4], '#a8a49c', { tile: 'cement' })
    b.box([0.05, 0.36, 0], [0.8, 0.24, 0.4], '#b2aea6', { tile: 'cement', r: [0, 1.4, 0] })
    for (const x of [-0.2, 0.2]) b.box([x, 0.241, 0], [0.26, 0.004, 0.2], '#4a4844')
  },

  /** Cement sacks: bulging paper bags, the red and yellow print of « Ciment Lagune ». */
  'sac-ciment': (b) => {
    b.box([0, 0.12, 0], [0.9, 0.24, 0.55], '#d8d0c0', { tile: 'paper', bevel: 0.07 })
    b.box([0, 0.12, 0.28], [0.5, 0.14, 0.01], '#e03131')
    b.box([0, 0.12, 0.282], [0.3, 0.06, 0.01], '#ffd43b')
    b.box([0.05, 0.36, 0], [0.9, 0.24, 0.55], '#d8d0c0', { tile: 'paper', bevel: 0.07, r: [0, 0.3, 0] })
  },

  /** A shovel lying: wooden handle, the steel blade. */
  pelle: (b) => {
    b.cyl([0.15, 0.04, 0], 0.035, 0.9, '#b5823f', { tile: 'wood', seg: 6, r: [0, 0, Math.PI / 2] })
    b.box([-0.42, 0.04, 0], [0.32, 0.03, 0.3], '#6b7078', { tile: 'metal' })
    b.box([0.62, 0.04, 0], [0.06, 0.06, 0.16], '#212529')
  },

  /** A wheelbarrow: the green tray, the wheel, the handles. */
  brouette: (b) => {
    b.lathe([0, 0.25, 0], [[0.001, 0], [0.28, 0], [0.42, 0.3]], '#2f9e44', { tile: 'metal', seg: 4, s: [1.3, 1, 1], r: [0, Math.PI / 4, 0] })
    b.cyl([0.6, 0.15, 0], 0.15, 0.08, '#212529', { seg: 12, r: [Math.PI / 2, 0, 0] })
    for (const z of [-0.2, 0.2]) {
      b.box([-0.2, 0.3, z], [1.1, 0.04, 0.04], '#495057', { tile: 'metal' })
      b.box([-0.3, 0.12, z], [0.04, 0.26, 0.04], '#495057')
    }
  },

  /** A yellow hard hat. */
  'casque-chantier': (b) => {
    b.ball([0, 0.04, 0], 0.32, '#fcc419', { half: true, seg: 12, tile: 'plastic' })
    b.cyl([0, 0.04, 0.03], 0.4, 0.03, '#fcc419', { seg: 14, tile: 'plastic' })
    b.box([0, 0.3, 0], [0.06, 0.06, 0.5], '#f59f00', { r: [0, 0, 0] })
  },

  /** The Ivorian flag on its pole: orange, white, green, the cloth's weave. */
  drapeau: (b) => {
    b.cyl([-0.4, 0.6, 0], 0.025, 1.2, '#adb5bd', { tile: 'alu', seg: 6 })
    b.ball([-0.4, 1.22, 0], 0.04, '#fab005', { seg: 6 })
    for (const [x, c] of [[-0.25, '#f77f00'], [0, '#ffffff'], [0.25, '#009e60']] as [number, string][]) b.box([x, 0.92, 0], [0.25, 0.48, 0.015], c, { tile: 'fabric' })
  },

  /** A microphone on its desk stand. */
  micro: (b) => {
    b.cyl([0, 0.02, 0], 0.2, 0.04, '#212529', { tile: 'metal', seg: 12 })
    b.cyl([0, 0.3, 0], 0.02, 0.56, '#868e96', { tile: 'alu', seg: 6 })
    b.cyl([0, 0.65, 0.04], 0.06, 0.22, '#212529', { seg: 8, r: [0.4, 0, 0] })
    b.ball([0, 0.78, 0.09], 0.085, '#adb5bd', { tile: 'keys', seg: 8 })
  },

  /** A megaphone: the white horn, the red rim, the handle. */
  megaphone: (b) => {
    b.cyl([0.05, 0.3, 0], 0.08, 0.6, '#f8f9fa', { top: 0.26, tile: 'plastic', seg: 12, r: [0, 0, -Math.PI / 2] })
    b.ring([0.35, 0.3, 0], 0.26, 0.03, '#e03131', { r: [0, 0, Math.PI / 2], seg: 14 })
    b.box([-0.1, 0.15, 0], [0.08, 0.22, 0.08], '#212529')
  },

  /** A referee's whistle on its red cord. */
  sifflet: (b) => {
    b.cyl([0, 0.08, 0], 0.1, 0.16, '#c8ccd2', { tile: 'alu', seg: 10, r: [Math.PI / 2, 0, 0] })
    b.box([0.14, 0.12, 0], [0.22, 0.06, 0.12], '#c8ccd2', { tile: 'alu' })
    b.ring([-0.25, 0.01, 0], 0.22, 0.012, '#e03131', { seg: 14 })
  },

  /** A sound speaker « BassMan », two woofers, the grille. */
  enceinte: (b) => {
    b.box([0, 0.45, 0], [0.55, 0.9, 0.45], '#212529', { tile: 'metal' })
    for (const [y, r] of [[0.28, 0.2], [0.66, 0.12]] as [number, number][]) {
      b.cyl([0, y, 0.226], r, 0.02, '#495057', { seg: 14, r: [Math.PI / 2, 0, 0], tile: 'keys' })
      b.cyl([0, y, 0.24], r * 0.35, 0.02, '#868e96', { seg: 10, r: [Math.PI / 2, 0, 0] })
    }
    b.on('glow').box([0.2, 0.85, 0.226], [0.04, 0.04, 0.01], '#69db7c').on('solid')
  },

  /** A djembe: carved goblet of wood, the goat skin, its ropes. */
  djembe: (b, q) => {
    b.lathe([0, 0, 0], [[0.001, 0], [0.22, 0], [0.2, 0.1], [0.12, 0.35], [0.12, 0.45], [0.3, 0.75], [0.32, 0.85], [0.001, 0.85]], '#7a4a20', { tile: 'wood', seg: 14 })
    b.cyl([0, 0.86, 0], 0.33, 0.03, '#e8d8b8', { tile: 'skin', seg: 14 })
    b.ring([0, 0.82, 0], 0.32, 0.02, '#c8a273', { seg: 16 })
    if (!q.lo) for (let i = 0; i < 8; i++) b.box([Math.cos(i * 0.785) * 0.24, 0.6, Math.sin(i * 0.785) * 0.24], [0.012, 0.45, 0.012], '#d8c8a0', { r: [Math.sin(i * 0.785) * 0.3, 0, -Math.cos(i * 0.785) * 0.3] })
  },

  /** The talking drum (tam-tam): hourglass body laced with cords, its curved stick. */
  'tam-tam': (b, q) => {
    b.lathe([0, 0, 0], [[0.001, 0], [0.24, 0], [0.24, 0.06], [0.12, 0.35], [0.24, 0.64], [0.24, 0.7], [0.001, 0.7]], '#8a5a30', { tile: 'wood', seg: 12 })
    for (const y of [0.0, 0.7]) b.cyl([0, y, 0], 0.26, 0.03, '#e8d8b8', { tile: 'skin', seg: 12 })
    if (!q.lo) for (let i = 0; i < 10; i++) b.box([Math.cos(i * 0.628) * 0.2, 0.35, Math.sin(i * 0.628) * 0.2], [0.01, 0.72, 0.01], '#c8a273')
    b.box([0.4, 0.04, 0.2], [0.4, 0.04, 0.04], '#5a3a1e', { tile: 'wood', r: [0, 0.5, 0.2] })
  },

  /** A grey stone and a pebble. */
  caillou: (b) => {
    b.ball([-0.1, 0.14, 0], 0.24, '#8a8a84', { tile: 'cement', seg: 6, s: [1.2, 0.7, 1] })
    b.ball([0.25, 0.07, 0.15], 0.11, '#a8a49c', { tile: 'cement', seg: 5, s: [1.2, 0.7, 1] })
  },

  /** A green leaf with its veins and stem. */
  feuille: (b) => {
    b.ball([0, 0.04, 0], 0.4, '#3f9e3a', { tile: 'leaf', seg: 8, s: [1.2, 0.06, 0.55] })
    b.box([0.55, 0.03, 0], [0.24, 0.02, 0.02], '#2b7a2e')
  },

  /** A football: white with black patches, faceted. */
  'ballon-foot': (b) => {
    b.ball([0, 0.3, 0], 0.3, '#f8f9fa', { seg: 10, tile: 'plastic' })
    for (let i = 0; i < 6; i++) b.ball([Math.cos(i * 1.05) * 0.24, 0.3 + (i % 2 ? 0.16 : -0.12), Math.sin(i * 1.05) * 0.24], 0.07, '#212529', { seg: 5 })
    b.ball([0, 0.59, 0], 0.07, '#212529', { seg: 5 })
  },

  /** An ID badge on its lanyard. */
  badge: (b) => {
    b.box([0, 0.02, 0.1], [0.4, 0.02, 0.56], '#ffffff', { tile: 'plastic' })
    b.box([-0.08, 0.032, 0.02], [0.14, 0.004, 0.18], '#a0703e')
    b.box([0.08, 0.032, 0.25], [0.2, 0.004, 0.04], '#495057')
    b.box([0, 0.032, -0.14], [0.4, 0.004, 0.06], '#1c7ed6')
    b.ring([0, 0.01, -0.45], 0.25, 0.02, '#1c7ed6', { seg: 12, arc: Math.PI, r: [0, Math.PI, 0] })
  },
}
