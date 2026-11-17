import type { Recipe, V } from './kit'
import { rod } from './sport'

// « Mini-jeux réalistes »: music, worship and culture (the guitar, the balafon, the turntable, the
// rosary, the Bible and the Coran on its stand, the prayer mat, the cross, the church candle, the
// painter's easel, the carved statue and mask, cameras, the poster, the screen, the remote, the clap,
// the cinema tickets). Same sizes as the old props.

const GOLD = '#e8b923'

export const CULTURE: Record<string, Recipe> = {
  /** An acoustic guitar lying down: the spruce top, the sound hole and its rosette, the bridge, the neck and its frets, six strings. */
  guitare: (b, q) => {
    const R = 0.25
    const cs = Math.cos(R)
    const sn = Math.sin(R)
    const at = (x: number, y: number, z = 0): V => [0.1 + x * cs + z * sn, y, -x * sn + z * cs]
    b.cyl(at(-0.28, 0.05), 0.25, 0.1, '#d9822b', { tile: 'wood', seg: 16 })
    b.cyl(at(-0.02, 0.05), 0.19, 0.1, '#d9822b', { tile: 'wood', seg: 16 })
    b.cyl(at(-0.28, 0.101), 0.24, 0.004, '#e9b46a', { tile: 'wood', seg: 16 })
    b.cyl(at(-0.02, 0.101), 0.18, 0.004, '#e9b46a', { tile: 'wood', seg: 16 })
    b.ring(at(-0.13, 0.104), 0.09, 0.008, '#7a4a20', { seg: 14 })
    b.cyl(at(-0.13, 0.104), 0.075, 0.004, '#1a0f06', { seg: 14 })
    b.box(at(-0.36, 0.11), [0.04, 0.02, 0.18], '#2b1a0e', { tile: 'wood', r: [0, R, 0] })
    b.box(at(0.32, 0.08), [0.52, 0.04, 0.08], '#5c3a1c', { tile: 'wood', r: [0, R, 0] })
    if (!q.lo) for (let i = 0; i < 6; i++) b.box(at(0.12 + i * 0.07, 0.101), [0.006, 0.004, 0.08], '#ced4da', { r: [0, R, 0] })
    b.box(at(0.63, 0.08), [0.14, 0.04, 0.12], '#2b1a0e', { tile: 'wood', r: [0, R, 0] })
    for (const z of [-0.04, 0.04]) for (const x of [0.6, 0.66]) b.cyl(at(x, 0.08, z * 1.9), 0.012, 0.04, '#c8ccd2', { tile: 'metal', seg: 5, r: [Math.PI / 2, R, 0] })
    for (let i = 0; i < 6; i++) b.box(at(0.13, 0.107, -0.025 + i * 0.01), [0.98, 0.003, 0.003], '#e9ecef', { r: [0, R, 0] })
  },

  /** The balafon: the frame of sticks, the wooden keys shortening along, the calabash resonators hanging, a mallet. */
  balafon: (b, q) => {
    for (const x of [-0.5, 0.5])
      for (const z of [0.17, -0.17]) b.box([x, 0.22, z], [0.05, 0.44, 0.05], '#5c3a1c', { tile: 'wood' })
    for (const z of [0.17, -0.17]) b.cyl([0, 0.42, z], 0.025, 1.1, '#5c3a1c', { tile: 'wood', seg: 6, r: [0, 0, Math.PI / 2] })
    for (let i = 0; i < 8; i++) {
      const x = -0.42 + i * 0.12
      b.box([x, 0.47, 0], [0.1, 0.045, 0.5 - i * 0.025], i % 2 ? '#d4a15a' : '#c58b4a', { tile: 'wood' })
      b.ball([x, 0.3 + i * 0.006, 0], 0.1 - i * 0.006, '#b5651d', { tile: 'gourd', seg: q.lo ? 6 : 8 })
      if (!q.lo) b.box([x, 0.395, 0], [0.006, 0.05, 0.006], '#3d2412')
    }
    b.box([0.1 + Math.sin(0.6) * 0.0, 0.52, 0.12], [0.02, 0.02, 0.36], '#3d2412', { tile: 'wood', r: [0, 0.6, 0] })
    b.ball([0.1 + Math.sin(0.6) * 0.19, 0.52, 0.12 + Math.cos(0.6) * 0.19], 0.04, '#212529', { tile: 'fabric', seg: 6 })
  },

  /** The DJ's turntable: brushed deck, the black record with its grooves and label, the tone arm, knobs, the green light. */
  platine: (b, q) => {
    b.box([0, 0.06, 0], [0.9, 0.12, 0.66], '#495057', { tile: 'alu' })
    b.cyl([-0.1, 0.125, 0], 0.29, 0.01, '#868e96', { tile: 'alu', seg: 20 })
    b.cyl([-0.1, 0.135, 0], 0.28, 0.012, '#111111', { tile: 'gloss', seg: 24 })
    if (!q.lo) for (const r of [0.24, 0.2, 0.16]) b.ring([-0.1, 0.142, 0], r, 0.003, '#343a40', { seg: 22 })
    b.cyl([-0.1, 0.143, 0], 0.09, 0.006, '#e03131', { tile: 'paper', seg: 14 })
    b.cyl([0.32, 0.16, -0.22], 0.04, 0.08, '#ced4da', { tile: 'metal', seg: 8 })
    b.box([0.32 - Math.sin(-0.75) * 0.18, 0.18, -0.22 + Math.cos(-0.75) * 0.18], [0.02, 0.02, 0.36], '#ced4da', { tile: 'metal', r: [0, -0.75, 0] })
    b.box([0.32 - Math.sin(-0.75) * 0.37, 0.16, -0.22 + Math.cos(-0.75) * 0.37], [0.05, 0.03, 0.06], '#212529', { r: [0, -0.75, 0] })
    for (const z of [-0.05, 0.08, 0.21]) b.cyl([0.36, 0.14, z], 0.03, 0.04, '#f8f9fa', { tile: 'plastic', seg: 8 })
    b.box([0.36, 0.122, 0.0], [0.04, 0.006, 0.3], '#212529')
    b.on('glow').box([-0.36, 0.122, 0.28], [0.08, 0.006, 0.04], '#69db7c').on('solid')
  },

  /** A rosary: the wooden beads in their loop, the larger ones each decade, the tail and the little gold cross. */
  chapelet: (b, q) => {
    const n = q.lo ? 16 : 24
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2
      b.ball([Math.sin(a) * 0.26, 0.035, -0.08 - Math.cos(a) * 0.24], k % 6 === 0 ? 0.045 : 0.03, '#7f4f24', { tile: 'wood', seg: 6 })
    }
    for (let k = 0; k < 3; k++) b.ball([0, 0.03, 0.2 + k * 0.07], 0.03, '#7f4f24', { tile: 'wood', seg: 6 })
    b.box([0, 0.025, 0.5], [0.05, 0.04, 0.22], GOLD, { tile: 'metal' })
    b.box([0, 0.025, 0.45], [0.15, 0.04, 0.05], GOLD, { tile: 'metal' })
  },

  /** A Bible: the black leather cover, the gilt-edged pages, the gold cross, the red ribbon marker. */
  bible: (b) => {
    const R = 0.2
    b.box([0, 0.09, 0], [0.52, 0.18, 0.7], '#212529', { tile: 'fabric', r: [0, R, 0], bevel: 0.02 })
    b.box([0.012, 0.09, 0.005], [0.5, 0.14, 0.69], '#efe0b0', { tile: 'book', r: [0, R, 0] })
    const at = (x: number, z: number): V => [x * Math.cos(R) + z * Math.sin(R), 0.181, -x * Math.sin(R) + z * Math.cos(R)]
    b.box(at(0, -0.02), [0.06, 0.006, 0.36], GOLD, { tile: 'metal', r: [0, R, 0] })
    b.box(at(0, -0.08), [0.24, 0.006, 0.06], GOLD, { tile: 'metal', r: [0, R, 0] })
    b.box(at(-0.1, 0.36), [0.04, 0.006, 0.12], '#c92a2a', { tile: 'fabric', r: [-0.6, R, 0] })
  },

  /** The Coran on its carved wooden stand (the rahle): the green cover with its gold border and medallion. */
  coran: (b, q) => {
    for (const a of [-0.55, 0.55]) b.box([0, 0.17 * Math.cos(a), 0.17 * Math.sin(a)], [0.5, 0.36, 0.03], '#9c6230', { tile: 'wood', r: [a, 0, 0] })
    if (!q.lo) for (const a of [-0.55, 0.55]) b.box([0, 0.12 * Math.cos(a), 0.12 * Math.sin(a) + Math.sign(a) * 0.016], [0.2, 0.1, 0.005], '#6b3e1d', { r: [a, 0, 0] })
    const T = 0.35
    const at = (x: number, y: number, z: number): V => [x, 0.3 + y * Math.cos(T) - z * Math.sin(T), y * Math.sin(T) + z * Math.cos(T)]
    b.box(at(0, 0, 0), [0.5, 0.12, 0.6], '#1f6e43', { tile: 'fabric', r: [T, 0, 0] })
    b.box(at(0.01, 0, 0.002), [0.48, 0.08, 0.6], '#efe0b0', { tile: 'book', r: [T, 0, 0] })
    for (const [x, z, w, d] of [[0, 0.27, 0.44, 0.03], [0, -0.27, 0.44, 0.03], [0.21, 0, 0.03, 0.54], [-0.21, 0, 0.03, 0.54]]) b.box(at(x, 0.061, z), [w, 0.005, d], GOLD, { tile: 'metal', r: [T, 0, 0] })
    for (const r of [0, 0.785]) b.box(at(0, 0.063, 0), [0.16, 0.005, 0.16], GOLD, { tile: 'metal', r: [T, r, 0] })
    b.box(at(0, 0.067, 0), [0.07, 0.005, 0.07], '#1f6e43', { r: [T, 0.785, 0] })
  },

  /** A prayer mat: the velvet's border, the green field, the mihrab arch pointing ahead, the gold fringes. */
  'tapis-priere': (b, q) => {
    b.box([0, 0.012, 0], [0.6, 0.024, 1.0], '#a61e4d', { tile: 'thread' })
    b.box([0, 0.02, 0.02], [0.48, 0.024, 0.84], '#1f6e43', { tile: 'thread' })
    b.box([0, 0.026, 0.12], [0.36, 0.024, 0.56], '#c2255c', { tile: 'thread' })
    b.cyl([0, 0.026, -0.16], 0.18, 0.024, '#c2255c', { tile: 'thread', seg: 12, arc: Math.PI, r: [0, Math.PI / 2, 0] })
    b.box([0, 0.034, 0.18], [0.1, 0.01, 0.1], GOLD, { r: [0, 0.785, 0] })
    if (!q.lo) b.cyl([0, 0.034, -0.22], 0.05, 0.08, GOLD, { seg: 6 })
    for (let i = 0; i < (q.lo ? 5 : 9); i++) {
      const x = -0.27 + (i * 0.54) / (q.lo ? 4 : 8)
      for (const z of [0.53, -0.53]) b.box([x, 0.008, z], [0.02, 0.012, 0.07], GOLD, { tile: 'thread' })
    }
  },

  /** A wooden cross on its stone base. */
  croix: (b) => {
    b.box([0, 0.05, 0], [0.4, 0.1, 0.3], '#868e96', { tile: 'cement' })
    b.box([0, 0.13, 0], [0.28, 0.06, 0.2], '#adb5bd', { tile: 'cement' })
    b.box([0, 0.58, 0], [0.12, 0.86, 0.1], '#8a5a2b', { tile: 'wood' })
    b.box([0, 0.76, 0], [0.56, 0.12, 0.1], '#8a5a2b', { tile: 'wood' })
  },

  /** A church candle on its brass stick: the turned foot, the wax with its drips, the flame. */
  cierge: (b, q) => {
    b.lathe([0, 0, 0], [[0.001, 0], [0.24, 0], [0.2, 0.06], [0.08, 0.08], [0.06, 0.14], [0.1, 0.16], [0.15, 0.18], [0.001, 0.18]], GOLD, { tile: 'metal', seg: 14 })
    b.cyl([0, 0.48, 0], 0.09, 0.6, '#fff9db', { tile: 'soap', seg: 12 })
    if (!q.lo) for (let k = 0; k < 3; k++) b.box([Math.cos(k * 2.1) * 0.085, 0.72 - k * 0.04, Math.sin(k * 2.1) * 0.085], [0.025, 0.12 + k * 0.04, 0.025], '#fff3c4')
    b.box([0, 0.81, 0], [0.012, 0.05, 0.012], '#212529')
    b.on('glow')
    b.cone([0, 0.88, 0], 0.05, 0.14, '#ff922b', { seg: 7 })
    b.cone([0, 0.86, 0.01], 0.025, 0.07, '#ffe066', { seg: 6 })
    b.on('solid')
  },

  /** The painter's easel: the three legs, the ledge, the canvas in its gilt frame (a landscape: sky, hills, the sun). */
  tableau: (b) => {
    rod(b, [-0.3, 0], [-0.18, 1.0], 0.025, '#8a5a32', 0.05, 'wood')
    rod(b, [0.3, 0], [0.18, 1.0], 0.025, '#8a5a32', 0.05, 'wood')
    b.box([0, 0.4, -0.32], [0.05, 0.8, 0.05], '#8a5a32', { tile: 'wood', r: [0.25, 0, 0] })
    b.box([0, 0.3, 0.1], [0.66, 0.05, 0.08], '#8a5a32', { tile: 'wood' })
    const T = -0.12
    const at = (x: number, y: number, z: number): V => [x, 0.6 + y * Math.cos(T) - z * Math.sin(T), 0.06 + y * Math.sin(T) + z * Math.cos(T)]
    b.box(at(0, 0, 0), [0.72, 0.56, 0.04], GOLD, { tile: 'metal', r: [T, 0, 0] })
    b.box(at(0, 0.06, 0.02), [0.62, 0.36, 0.01], '#74c0fc', { tile: 'fabric', r: [T, 0, 0] })
    b.box(at(0, -0.18, 0.02), [0.62, 0.12, 0.01], '#40c057', { tile: 'fabric', r: [T, 0, 0] })
    b.box(at(-0.15, -0.08, 0.025), [0.24, 0.12, 0.01], '#2f9e44', { tile: 'fabric', r: [T, 0, 0.3] })
    b.cyl(at(0.18, 0.15, 0.028), 0.05, 0.01, '#fcc419', { seg: 10, r: [T + Math.PI / 2, 0, 0] })
  },

  /** A carved ebony statue on its stone plinth: the seated figure, arms down, the tall head, white eyes. */
  statue: (b, q) => {
    b.box([0, 0.12, 0], [0.42, 0.24, 0.42], '#adb5bd', { tile: 'cement' })
    b.box([0, 0.26, 0], [0.34, 0.04, 0.34], '#ced4da', { tile: 'cement' })
    const E = '#3b2414'
    b.box([0, 0.3, 0], [0.24, 0.04, 0.2], E, { tile: 'wood' })
    for (const x of [-0.06, 0.06]) b.box([x, 0.44, 0], [0.08, 0.24, 0.09], E, { tile: 'wood' })
    b.ball([0, 0.7, 0], 0.13, '#4a2e1a', { tile: 'wood', seg: 8, s: [0.85, 1.2, 0.6] })
    b.ball([0, 0.68, 0.06], 0.05, '#4a2e1a', { tile: 'wood', seg: 6 })
    for (const x of [-0.14, 0.14]) b.box([x, 0.66, 0], [0.05, 0.32, 0.06], E, { tile: 'wood' })
    b.cyl([0, 0.88, 0], 0.035, 0.06, E, { tile: 'wood', seg: 6 })
    b.ball([0, 1.01, 0.01], 0.1, '#4a2e1a', { tile: 'wood', seg: 8, s: [0.8, 1.15, 0.85] })
    b.ball([0, 1.12, -0.02], 0.06, E, { tile: 'wood', seg: 6, s: [1, 0.8, 1] })
    for (const x of [-0.035, 0.035]) b.box([x, 1.02, 0.085], [0.035, 0.012, 0.01], '#f1dcb0')
    if (!q.lo) b.box([0, 0.98, 0.09], [0.025, 0.05, 0.02], E)
  },

  /** A carved wooden mask on its stand: the long face, slit eyes, the ridge of the nose, the white kaolin lines, the horns. */
  masque: (b, q) => {
    b.box([0, 0.03, 0], [0.32, 0.06, 0.22], '#3d2412', { tile: 'wood' })
    b.box([0, 0.2, -0.06], [0.05, 0.3, 0.05], '#3d2412', { tile: 'wood' })
    const T = -0.15
    const at = (x: number, y: number, z: number): V => [x, 0.6 + y * Math.cos(T) - z * Math.sin(T), y * Math.sin(T) + z * Math.cos(T)]
    b.ball(at(0, 0, 0), 0.24, '#9c5a1a', { tile: 'wood', seg: 10, s: [0.75, 1.15, 0.35], r: [T, 0, 0] })
    b.box(at(0, -0.33, 0), [0.12, 0.08, 0.07], '#9c5a1a', { tile: 'wood', r: [T, 0, 0] })
    for (const sd of [-1, 1]) {
      b.box(at(sd * 0.08, 0.08, 0.075), [0.1, 0.03, 0.02], '#111111', { r: [T, 0, -sd * 0.15] })
      b.box(at(sd * 0.12, -0.06, 0.07), [0.025, 0.12, 0.01], '#f8f9fa', { r: [T, 0, 0] })
      b.cone(at(sd * 0.1, 0.38, -0.01), 0.03, 0.2, '#6b3e1d', { tile: 'wood', seg: 5, r: [T, 0, -sd * 0.25] })
    }
    b.box(at(0, 0, 0.09), [0.06, 0.2, 0.05], '#7f4f24', { tile: 'wood', r: [T, 0, 0] })
    b.box(at(0, -0.2, 0.075), [0.12, 0.04, 0.03], '#c92a2a', { r: [T, 0, 0] })
    if (!q.lo) b.box(at(0, 0.22, 0.07), [0.035, 0.12, 0.01], '#f8f9fa', { r: [T, 0, 0] })
  },

  /** A camera: the textured black body, the silver top plate, the lens rings and its blue glass, the shutter button, the flash. */
  'appareil-photo': (b) => {
    b.box([0, 0.2, 0], [0.66, 0.4, 0.28], '#212529', { tile: 'sponge' })
    b.box([0, 0.35, 0], [0.67, 0.1, 0.285], '#adb5bd', { tile: 'alu' })
    b.box([-0.05, 0.44, 0], [0.22, 0.1, 0.2], '#212529', { tile: 'plastic' })
    b.cyl([0.22, 0.42, 0], 0.04, 0.04, '#e03131', { tile: 'plastic', seg: 8 })
    b.cyl([0.12, 0.42, 0.04], 0.035, 0.03, '#868e96', { tile: 'keys', seg: 8 })
    b.cyl([0, 0.2, 0.2], 0.15, 0.14, '#343a40', { tile: 'keys', seg: 16, r: [Math.PI / 2, 0, 0] })
    b.cyl([0, 0.2, 0.26], 0.12, 0.04, '#111111', { tile: 'plastic', seg: 16, r: [Math.PI / 2, 0, 0] })
    b.on('glass').cyl([0, 0.2, 0.282], 0.09, 0.01, '#4dabf7', { seg: 16, r: [Math.PI / 2, 0, 0] }).on('solid')
    b.on('glow').box([-0.22, 0.42, 0.06], [0.12, 0.05, 0.08], '#f8f9fa', { tile: 'foam' }).on('solid')
  },

  /** A film poster on its stand: the frame, the invented poster (« La nuit de Babi »), the two pins. */
  affiche: (b) => {
    for (const x of [-0.32, 0.32]) b.box([x, 0.45, -0.03], [0.05, 0.9, 0.05], '#495057', { tile: 'metal' })
    b.box([0, 0.58, 0], [0.72, 0.62, 0.03], '#f8f9fa', { tile: 'plastic' })
    b.box([0, 0.58, 0.017], [0.6, 0.54, 0.006], '#ffffff', { tile: 'poster', fit: true })
    for (const x of [-0.27, 0.27]) b.cyl([x, 0.86, 0.025], 0.02, 0.02, '#e03131', { tile: 'gloss', seg: 6, r: [Math.PI / 2, 0, 0] })
    b.on('glass').box([0, 0.58, 0.024], [0.62, 0.56, 0.004], '#ffffff').on('solid')
  },

  /** A film camera on its tripod: the body, the lens, the two reels on top, the red record light. */
  camera: (b, q) => {
    for (const a of [-0.4, 0.4]) b.box([Math.sin(a) * 0.21, 0.21, 0], [0.035, 0.44, 0.035], '#495057', { tile: 'metal', r: [0, 0, a] })
    b.box([0, 0.21, -Math.sin(0.4) * 0.21], [0.035, 0.44, 0.035], '#495057', { tile: 'metal', r: [-0.4, 0, 0] })
    b.cyl([0, 0.43, 0], 0.06, 0.04, '#343a40', { tile: 'metal', seg: 8 })
    b.box([0, 0.56, 0], [0.26, 0.26, 0.5], '#343a40', { tile: 'sponge' })
    b.cyl([0, 0.56, 0.32], 0.1, 0.16, '#212529', { tile: 'keys', seg: 12, top: 0.08, r: [Math.PI / 2, 0, 0] })
    b.on('glass').cyl([0, 0.56, 0.405], 0.07, 0.01, '#4dabf7', { seg: 12, r: [Math.PI / 2, 0, 0] }).on('solid')
    for (const z of [0.12, -0.17]) {
      b.cyl([0, 0.86, z], 0.15, 0.06, '#212529', { tile: 'plastic', seg: 14, r: [0, 0, Math.PI / 2] })
      if (!q.lo) for (let k = 0; k < 3; k++) b.box([0, 0.86, z], [0.065, 0.24, 0.03], '#343a40', { r: [(k * Math.PI) / 3, 0, 0] })
      b.cyl([0, 0.86, z], 0.05, 0.08, '#adb5bd', { tile: 'metal', seg: 8, r: [0, 0, Math.PI / 2] })
    }
    b.on('glow').box([0.14, 0.62, -0.1], [0.02, 0.05, 0.05], '#ff2d2d').on('solid')
  },

  /** A flat screen on its foot: the thin black frame, the lit picture (an app's tiles). */
  ecran: (b) => {
    b.box([0, 0.02, 0], [0.36, 0.04, 0.22], '#343a40', { tile: 'alu' })
    b.box([0, 0.14, -0.02], [0.06, 0.22, 0.04], '#343a40', { tile: 'alu' })
    b.box([0, 0.5, 0], [1.0, 0.6, 0.04], '#212529', { tile: 'plastic' })
    b.on('glow').box([0, 0.5, 0.021], [0.94, 0.54, 0.004], '#ffffff', { tile: 'phone', fit: true }).on('solid')
    b.box([0, 0.215, 0.02], [0.06, 0.012, 0.006], '#868e96')
  },

  /** A TV remote: the black body, the red power key, the number pad, the round arrow pad. */
  telecommande: (b) => {
    const R = 0.35
    const cs = Math.cos(R)
    const sn = Math.sin(R)
    const at = (x: number, z: number): V => [x * cs + z * sn, 0.082, -x * sn + z * cs]
    b.box([0, 0.04, 0], [0.2, 0.08, 0.7], '#212529', { tile: 'plastic', r: [0, R, 0], bevel: 0.03 })
    b.cyl(at(0.05, -0.28), 0.025, 0.012, '#e03131', { tile: 'gloss', seg: 8 })
    for (let k = 0; k < 9; k++) b.box(at(((k % 3) - 1) * 0.05, 0.06 + Math.floor(k / 3) * 0.06), [0.035, 0.012, 0.035], '#adb5bd', { tile: 'plastic', r: [0, R, 0] })
    b.cyl(at(0, -0.12), 0.05, 0.012, '#495057', { tile: 'plastic', seg: 12 })
    b.cyl(at(0, -0.12), 0.02, 0.018, '#1c7ed6', { tile: 'plastic', seg: 8 })
  },

  /** The film clap: the slate with its chalk lines, the striped sticks, the top one raised. */
  clap: (b, q) => {
    const T = -0.25
    const at = (x: number, y: number, z = 0): V => [x, y * Math.cos(T) - z * Math.sin(T), y * Math.sin(T) + z * Math.cos(T)]
    b.box(at(0, 0.25), [0.7, 0.5, 0.05], '#212529', { tile: 'chalkboard', fit: true, r: [T, 0, 0] })
    b.box(at(0, 0.53), [0.7, 0.07, 0.05], '#212529', { tile: 'plastic', r: [T, 0, 0] })
    for (let k = 0; k < 4; k++) b.box(at(-0.26 + k * 0.17, 0.53, 0.026), [0.05, 0.1, 0.004], '#ffffff', { r: [T, 0, -0.6] })
    // The raised stick, hinged at the left.
    const A = 0.35
    const top = (u: number, v: number, w = 0): V => at(-0.35 + u * Math.cos(A) - v * Math.sin(A), 0.58 + u * Math.sin(A) + v * Math.cos(A), w)
    b.box(top(0.35, 0.035), [0.7, 0.07, 0.05], '#212529', { tile: 'plastic', r: [T, 0, A] })
    if (!q.lo) for (let k = 0; k < 4; k++) b.box(top(0.09 + k * 0.17, 0.035, 0.026), [0.05, 0.1, 0.004], '#ffffff', { r: [T, 0, A + 0.6] })
    b.cyl(at(-0.35, 0.57, 0.03), 0.02, 0.02, '#adb5bd', { tile: 'metal', seg: 6, r: [Math.PI / 2 + T, 0, 0] })
  },

  /** Two cinema tickets: the coloured stubs, their perforation, the printed seat, the gold seal. */
  'billet-cinema': (b) => {
    ;[0, 1].forEach((k) => {
      const R = k ? -0.15 : 0.25
      const cs = Math.cos(R)
      const sn = Math.sin(R)
      const o: V = [k * 0.08 - 0.04, 0.01 + k * 0.022, k * 0.12 - 0.06]
      const at = (x: number, z: number, y = 0): V => [o[0] + x * cs + z * sn, o[1] + y, o[2] - x * sn + z * cs]
      b.box(o, [0.72, 0.02, 0.32], k ? '#e03131' : '#f08c00', { tile: 'paper', r: [0, R, 0] })
      for (const z of [-0.12, -0.06, 0, 0.06, 0.12]) b.box(at(0.2, z, 0.011), [0.02, 0.003, 0.03], '#fff3bf', { r: [0, R, 0] })
      b.box(at(-0.1, 0, 0.011), [0.26, 0.003, 0.18], '#fff3bf', { tile: 'page', fit: true, r: [0, R, 0] })
      b.cyl(at(0.28, 0, 0.012), 0.045, 0.004, GOLD, { tile: 'metal', seg: 8 })
    })
  },
}
