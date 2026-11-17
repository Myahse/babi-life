import type { Recipe } from './kit'

// « Mini-jeux réalistes »: what's worn and what cares (the wax dress, the glasses, the watch, the
// beads, the rollers, the rug and the cushion, the candles), the clinic's things, the trolley, the
// driver's wheel and jerrycan, the vest, the cuffs. Same sizes as the old props.

export const CARE: Record<string, Recipe> = {
  /** A wax-print dress laid flat: the fitted bodice and its straps, the flared skirt in steps, the yellow belt, the hem's frill. */
  robe: (b, q) => {
    b.box([0, 0.03, -0.24], [0.34, 0.04, 0.28], '#ffffff', { tile: 'wax' })
    for (const x of [-0.12, 0.12]) b.box([x, 0.03, -0.42], [0.06, 0.03, 0.1], '#ffffff', { tile: 'wax' })
    for (let i = 0; i < 3; i++) b.box([0, 0.03 - i * 0.002, -0.04 + i * 0.16], [0.42 + i * 0.16, 0.04, 0.17], '#ffffff', { tile: 'wax' })
    b.box([0, 0.055, -0.1], [0.38, 0.03, 0.06], '#ffd43b', { tile: 'fabric' })
    if (!q.lo) b.box([0, 0.035, 0.38], [0.78, 0.035, 0.05], '#ffffff', { tile: 'fabric' })
  },

  /** Sunglasses standing on their arms: dark lenses (they shine), the red frame, the hinges. */
  lunettes: (b) => {
    for (const x of [-0.22, 0.22]) {
      b.on('glass').cyl([x, 0.19, 0.2], 0.16, 0.02, '#111111', { seg: 12, r: [Math.PI / 2, 0, 0] }).on('solid')
      b.ring([x, 0.19, 0.21], 0.17, 0.03, '#e03131', { tile: 'gloss', seg: 14, r: [Math.PI / 2, 0, 0] })
      b.box([x * 1.82, 0.16, -0.1], [0.04, 0.04, 0.62], '#e03131', { tile: 'gloss', r: [0.35, 0, 0] })
      b.box([x * 1.75, 0.2, 0.2], [0.05, 0.05, 0.05], '#adb5bd', { tile: 'metal' })
    }
    b.box([0, 0.27, 0.21], [0.12, 0.04, 0.04], '#e03131', { tile: 'gloss' })
  },

  /** A wristwatch laid flat: the stitched leather strap and its buckle, the gold case, the white dial, hands, the crown. */
  montre: (b, q) => {
    b.box([0, 0.02, 0], [0.2, 0.04, 0.92], '#5c3a21', { tile: 'fabric' })
    for (const z of [-0.3, -0.36]) b.box([0, 0.045, z], [0.04, 0.01, 0.03], '#2b1a0e')
    b.ring([0, 0.045, 0.38], 0.07, 0.012, '#d9a521', { tile: 'metal', seg: 8, s: [1.2, 1, 1] })
    b.cyl([0, 0.05, 0], 0.22, 0.08, '#fcc419', { tile: 'metal', seg: 16 })
    b.cyl([0, 0.095, 0], 0.17, 0.02, '#f8f9fa', { tile: 'enamel', seg: 16 })
    for (let k = 0; k < 12; k++) if (!q.lo || k % 3 === 0) b.box([Math.sin((k * Math.PI) / 6) * 0.14, 0.107, Math.cos((k * Math.PI) / 6) * 0.14], [0.012, 0.006, k % 3 ? 0.02 : 0.035], '#343a40', { r: [0, (k * Math.PI) / 6, 0] })
    b.box([0, 0.112, -0.05], [0.02, 0.008, 0.11], '#212529')
    b.box([0.04, 0.114, 0], [0.09, 0.008, 0.016], '#212529')
    b.cyl([0.25, 0.05, 0], 0.03, 0.05, '#fcc419', { tile: 'metal', seg: 8, r: [0, 0, Math.PI / 2] })
    b.on('glass').cyl([0, 0.106, 0], 0.17, 0.006, '#ffffff', { seg: 16 }).on('solid')
  },

  /** A necklace of glass beads in a loop (red, gold, green, black), the gold pendant at the front. */
  collier: (b, q) => {
    const n = q.lo ? 14 : 22
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      b.ball([Math.cos(a) * 0.36, 0.05, Math.sin(a) * 0.3 - 0.05], q.lo ? 0.06 : 0.05, ['#e03131', '#fcc419', '#2f9e44', '#1c1c1c'][i % 4], { tile: 'gloss', seg: 6 })
    }
    b.cone([0, 0.06, 0.37], 0.1, 0.16, '#fcc419', { tile: 'metal', seg: 4, r: [Math.PI / 2, 0, 0] })
    b.ball([0, 0.06, 0.29], 0.03, '#d9a521', { tile: 'metal', seg: 6 })
  },

  /** Three hair rollers: the coloured foam tubes, the clips, the bristle holes. */
  bigoudi: (b, q) => {
    for (const [x, y, c] of [[-0.14, 0.13, '#f783ac'], [0.14, 0.13, '#74c0fc'], [0, 0.36, '#ffd43b']] as const) {
      b.cyl([x, y, 0], 0.13, 0.6, c, { tile: 'sponge', seg: 10, r: [Math.PI / 2, 0, 0] })
      b.cyl([x, y, 0], 0.06, 0.62, '#495057', { seg: 8, r: [Math.PI / 2, 0, 0] })
      if (!q.lo) for (const z of [-0.18, 0, 0.18]) b.ring([x, y, z], 0.135, 0.012, '#ffffff', { seg: 10, r: [Math.PI / 2, 0, 0] })
      b.box([x, y + 0.14, 0], [0.04, 0.03, 0.56], '#f8f9fa', { tile: 'plastic' })
    }
  },

  /** A woven rug: dark border, red field, the gold diamonds, fringes at the ends. */
  tapis: (b, q) => {
    b.box([0, 0.015, 0], [1.0, 0.03, 0.7], '#1c1c3a', { tile: 'thread' })
    b.box([0, 0.025, 0], [0.86, 0.03, 0.56], '#c92a2a', { tile: 'thread' })
    b.box([0, 0.032, 0], [0.3, 0.03, 0.3], '#fcc419', { tile: 'thread', r: [0, Math.PI / 4, 0] })
    b.box([0, 0.038, 0], [0.14, 0.03, 0.14], '#1c1c3a', { tile: 'thread', r: [0, Math.PI / 4, 0] })
    for (const x of [-0.3, 0.3]) b.box([x, 0.035, 0], [0.1, 0.03, 0.1], '#fcc419', { tile: 'thread', r: [0, Math.PI / 4, 0] })
    if (!q.lo) for (const k of [-1, 1]) for (let i = 0; i < 9; i++) b.box([k * 0.54, 0.006, -0.32 + i * 0.08], [0.08, 0.01, 0.02], '#f1e3c4', { tile: 'thread' })
  },

  /** A puffy cushion in kente, the button pressed in the middle, tassels at the corners. */
  coussin: (b, q) => {
    b.box([0, 0.1, 0], [0.72, 0.2, 0.72], '#ffffff', { tile: 'kente', bevel: 0.08 })
    b.ball([0, 0.17, 0], 0.38, '#f1e6ff', { tile: 'kente', half: true, seg: q.lo ? 10 : 14, s: [1, 0.25, 1] })
    b.ball([0, 0.26, 0], 0.045, '#fcc419', { tile: 'fabric', seg: 6, s: [1, 0.6, 1] })
    for (const [x, z] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      b.ball([x * 0.37, 0.12, z * 0.37], 0.035, '#fcc419', { seg: 5 })
      b.cone([x * 0.41, 0.07, z * 0.41], 0.04, 0.1, '#fcc419', { tile: 'thread', seg: 6, r: [0, 0, Math.PI] })
    }
  },

  /** Two church candles on a brass saucer: wax drips, black wicks, flames lit. */
  bougie: (b, q) => {
    b.lathe([0, 0, 0], [[0.001, 0], [0.38, 0], [0.44, 0.05], [0.45, 0.06]], '#d9a521', { tile: 'metal', seg: 16 })
    for (const [x, h] of [[-0.13, 0.55], [0.17, 0.36]] as const) {
      b.cyl([x, 0.06 + h / 2, 0], 0.12, h, '#fff9db', { tile: 'soap', seg: 10 })
      b.cyl([x, 0.06 + h - 0.005, 0], 0.1, 0.02, '#f4ead0', { seg: 10 })
      if (!q.lo) for (let k = 0; k < 3; k++) b.box([x + Math.cos(k * 2.1) * 0.115, 0.06 + h - 0.04 - k * 0.03, Math.sin(k * 2.1) * 0.115], [0.03, 0.08 + k * 0.03, 0.03], '#fff3c4')
      b.box([x, 0.06 + h + 0.03, 0], [0.012, 0.05, 0.012], '#212529')
      b.on('glow')
      b.cone([x, 0.06 + h + 0.12, 0], 0.05, 0.16, '#ff922b', { seg: 7 })
      b.ball([x, 0.06 + h + 0.09, 0], 0.035, '#fff3bf', { seg: 6 })
      b.on('solid')
    }
  },

  /** A syringe lying down: the clear barrel with its graduations, the dose, the plunger, the needle. */
  seringue: (b) => {
    const r: [number, number, number] = [0, 0.3, Math.PI / 2]
    const cs = Math.cos(0.3)
    const sn = Math.sin(0.3)
    const at = (x: number): [number, number, number] => [x * cs, 0.1, -x * sn]
    b.cyl(at(0.08), 0.085, 0.36, '#ff8787', { tile: 'gloss', seg: 10, r })
    for (let i = 0; i < 4; i++) b.box([at(-0.1 + i * 0.1)[0], 0.185, at(-0.1 + i * 0.1)[2]], [0.012, 0.01, 0.06], '#495057', { r: [0, 0.3, 0] })
    b.cyl(at(-0.28), 0.1, 0.03, '#dee2e6', { tile: 'plastic', seg: 10, r })
    b.cyl(at(-0.4), 0.03, 0.22, '#dee2e6', { tile: 'plastic', seg: 6, r })
    b.cyl(at(-0.52), 0.1, 0.03, '#dee2e6', { tile: 'plastic', seg: 10, r })
    b.cyl(at(0.3), 0.04, 0.06, '#adb5bd', { tile: 'plastic', seg: 8, top: 0.03, r })
    b.cyl(at(0.45), 0.008, 0.26, '#ced4da', { tile: 'metal', seg: 4, r })
    b.on('glass').cyl(at(0), 0.1, 0.54, '#e7f5ff', { seg: 10, r }).on('solid')
  },

  /** A digital thermometer: the white body, the green screen lit with its reading, the blue button, the steel tip. */
  thermometre: (b) => {
    const R = 0.6
    const cs = Math.cos(R)
    const sn = Math.sin(R)
    const at = (z: number, y: number): [number, number, number] => [z * sn, y, z * cs]
    b.box(at(-0.1, 0.05), [0.2, 0.1, 0.62], '#f8f9fa', { tile: 'plastic', r: [0, R, 0] })
    b.box(at(0.3, 0.04), [0.1, 0.08, 0.22], '#f8f9fa', { tile: 'plastic', r: [0, R, 0] })
    b.box(at(0.44, 0.04), [0.05, 0.05, 0.12], '#adb5bd', { tile: 'metal', r: [0, R, 0] })
    b.box(at(-0.32, 0.105), [0.08, 0.03, 0.08], '#1c7ed6', { tile: 'plastic', r: [0, R, 0] })
    b.on('glow').box(at(-0.12, 0.101), [0.14, 0.006, 0.2], '#c3fae8', { tile: 'screen', fit: true, r: [0, R, 0] }).on('solid')
  },

  /** A stethoscope laid out: the steel earpieces and their black tips, the tube's curve, the chest piece. */
  stethoscope: (b, q) => {
    const S = 1.3
    const o = (x: number, y: number, z: number): [number, number, number] => [0.17 + x * S, y * S, z * S]
    b.ring(o(0, 0.035, -0.25), 0.22 * S, 0.025 * S, '#ced4da', { arc: Math.PI, tile: 'metal', seg: 12, r: [0, Math.PI, 0] })
    for (const x of [-0.22, 0.22]) {
      b.box(o(x, 0.035, -0.33), [0.05 * S, 0.05 * S, 0.16 * S], '#ced4da', { tile: 'metal' })
      b.ball(o(x, 0.04, -0.42), 0.05 * S, '#1a1a1a', { seg: 6 })
    }
    b.ring(o(-0.3, 0.035, -0.03), 0.3 * S, 0.03 * S, '#212529', { arc: Math.PI / 2, tile: 'plastic', seg: 10, r: [0, Math.PI / 2, 0] })
    b.box(o(-0.35, 0.035, 0.27), [0.12 * S, 0.06 * S, 0.06 * S], '#212529', { tile: 'plastic' })
    b.cyl(o(-0.46, 0.05, 0.27), 0.13 * S, 0.1 * S, '#adb5bd', { tile: 'alu', seg: 14 })
    b.cyl(o(-0.46, 0.105, 0.27), 0.1 * S, 0.02 * S, '#e9ecef', { tile: q.lo ? 'plain' : 'plastic', seg: 14 })
  },

  /** Two sticking plasters crossed: the skin-coloured strips with their air holes, the white pad. */
  pansement: (b) => {
    ;[-0.5, 0.5].forEach((t, n) => {
      const y = n * 0.025
      const cs = Math.cos(t)
      const sn = Math.sin(t)
      b.box([0, 0.012 + y, 0], [0.66, 0.024, 0.28], '#e8b07a', { tile: 'fabric', r: [0, t, 0] })
      for (const k of [-1, 1]) b.cyl([k * 0.33 * cs, 0.012 + y, -k * 0.33 * sn], 0.14, 0.024, '#e8b07a', { tile: 'fabric', seg: 10 })
      b.box([0, 0.027 + y, 0], [0.26, 0.012, 0.22], '#fff4e6', { tile: 'sponge', r: [0, t, 0] })
    })
  },

  /** A blood-pressure monitor: the white unit, its screen lit with the reading, the blue button, the navy cuff and its tube. */
  tensiometre: (b) => {
    b.box([-0.18, 0.1, 0], [0.46, 0.2, 0.4], '#f8f9fa', { tile: 'plastic' })
    b.box([-0.18, 0.205, 0], [0.32, 0.02, 0.22], '#212529', { tile: 'plastic', r: [-0.2, 0, 0] })
    b.on('glow').box([-0.18, 0.217, 0.0], [0.26, 0.004, 0.16], '#c3fae8', { tile: 'screen', fit: true, r: [-0.2, 0, 0] }).on('solid')
    b.cyl([-0.04, 0.21, 0.14], 0.04, 0.03, '#1c7ed6', { tile: 'plastic', seg: 8 })
    b.box([0.33, 0.05, 0.05], [0.34, 0.1, 0.6], '#1b3a6b', { tile: 'twill', r: [0, -0.15, 0] })
    b.box([0.33, 0.105, 0.05], [0.12, 0.01, 0.5], '#adb5bd', { tile: 'fabric', r: [0, -0.15, 0] })
    b.ring([0.1, 0.03, -0.18], 0.12, 0.02, '#495057', { arc: Math.PI, seg: 8 })
  },

  /** The supermarket trolley: the wire basket (bars), the chassis, the red handle, the grey castors. */
  chariot: (b, q) => {
    for (const [x, z] of [[-0.2, -0.3], [0.2, -0.3], [-0.16, 0.3], [0.16, 0.3]]) {
      b.cyl([x, 0.05, z], 0.05, 0.05, '#212529', { tile: 'plastic', seg: 8, r: [0, 0, Math.PI / 2] })
      b.box([x, 0.1, z], [0.03, 0.06, 0.03], '#868e96', { tile: 'metal' })
    }
    b.box([0, 0.12, 0], [0.42, 0.03, 0.7], '#868e96', { tile: 'metal' })
    for (const x of [-0.22, 0.22]) b.box([x, 0.32, -0.32], [0.03, 0.4, 0.03], '#868e96', { tile: 'metal' })
    b.box([0, 0.34, 0], [0.46, 0.03, 0.66], '#adb5bd', { tile: 'metal' })
    // The basket's wires: bars on each side.
    const bars = q.lo ? 4 : 7
    for (let i = 0; i < bars; i++) {
      const u = -0.3 + (i * 0.6) / (bars - 1)
      for (const x of [-0.23, 0.23]) b.box([x, 0.52, u], [0.012, 0.34, 0.012], '#c8ccd2', { tile: 'metal' })
      b.box([u * 0.7, 0.52, -0.32], [0.012, 0.36, 0.012], '#c8ccd2', { tile: 'metal' })
      b.box([u * 0.6, 0.5, 0.32], [0.012, 0.28, 0.012], '#c8ccd2', { tile: 'metal' })
    }
    for (const y of [0.45, 0.6, 0.7]) {
      for (const x of [-0.23, 0.23]) b.box([x, y, 0], [0.014, 0.014, 0.66], '#c8ccd2', { tile: 'metal' })
      b.box([0, y, -0.32], [0.48, 0.014, 0.014], '#c8ccd2', { tile: 'metal' })
      if (y < 0.66) b.box([0, y, 0.32], [0.42, 0.014, 0.014], '#c8ccd2', { tile: 'metal' })
    }
    b.cyl([0, 0.74, -0.4], 0.03, 0.56, '#e03131', { tile: 'plastic', seg: 8, r: [0, 0, Math.PI / 2] })
  },

  /** A car's steering wheel on its column: the leather rim, three spokes, the hub with its badge. */
  'volant-auto': (b, q) => {
    b.box([0, 0.03, -0.2], [0.3, 0.06, 0.3], '#343a40', { tile: 'plastic' })
    b.box([0, 0.22, -0.1], [0.1, 0.42, 0.1], '#343a40', { tile: 'plastic', r: [0.5, 0, 0] })
    const T = -0.75
    const at = (x: number, y: number, z = 0): [number, number, number] => [x, 0.48 + y * Math.cos(T) - z * Math.sin(T), y * Math.sin(T) + z * Math.cos(T)]
    b.ring(at(0, 0), 0.4, 0.06, '#1a1a1a', { tile: 'fabric', seg: q.lo ? 14 : 20, r: [T + Math.PI / 2, 0, 0] })
    b.box(at(0, 0), [0.8, 0.06, 0.04], '#495057', { tile: 'plastic', r: [T, 0, 0] })
    b.box(at(0, -0.2), [0.07, 0.4, 0.04], '#495057', { tile: 'plastic', r: [T, 0, 0] })
    b.cyl(at(0, 0, 0.03), 0.14, 0.08, '#212529', { tile: 'plastic', seg: 12, r: [T + Math.PI / 2, 0, 0] })
    b.cyl(at(0, 0, 0.075), 0.06, 0.02, '#adb5bd', { tile: 'metal', seg: 8, r: [T + Math.PI / 2, 0, 0] })
  },

  /** A red jerrycan of fuel: the X pressed in its side, the three-bar handle, the spout and its yellow cap. */
  essence: (b) => {
    b.box([0, 0.34, 0], [0.62, 0.68, 0.3], '#e03131', { tile: 'plastic' })
    for (const t of [-0.7, 0.7]) b.box([0, 0.32, 0.152], [0.07, 0.62, 0.02], '#c92a2a', { tile: 'plastic', r: [0, 0, t] })
    b.box([-0.08, 0.76, 0], [0.34, 0.06, 0.1], '#c92a2a', { tile: 'plastic' })
    for (const x of [-0.22, -0.08, 0.06]) b.box([x, 0.71, 0], [0.05, 0.08, 0.1], '#c92a2a', { tile: 'plastic' })
    b.cyl([0.22, 0.74, 0], 0.07, 0.14, '#c92a2a', { tile: 'plastic', seg: 8, top: 0.06, r: [0, 0, -0.4] })
    b.cyl([0.26, 0.82, 0], 0.075, 0.06, '#fcc419', { tile: 'plastic', seg: 8, r: [0, 0, -0.4] })
    b.box([0, 0.2, 0.152], [0.2, 0.08, 0.01], '#fcc419', { tile: 'paper' })
  },

  /** A hi-vis vest laid flat: the fluorescent mesh, the silver reflective bands (they catch the light), the zip. */
  gilet: (b) => {
    for (const k of [-1, 1]) {
      b.box([k * 0.2, 0.03, 0.08], [0.36, 0.05, 0.68], '#d8f000', { tile: 'sponge' })
      b.box([k * 0.3, 0.03, -0.38], [0.16, 0.05, 0.26], '#d8f000', { tile: 'sponge' })
      b.box([k * 0.13, 0.03, -0.27], [0.1, 0.05, 0.12], '#d8f000', { tile: 'sponge', r: [0, k * 0.5, 0] })
      b.on('glow')
      for (const z of [0.06, 0.28]) b.box([k * 0.2, 0.058, z], [0.36, 0.006, 0.07], '#c8ccd2', { tile: 'alu' })
      b.box([k * 0.3, 0.058, -0.3], [0.07, 0.006, 0.36], '#c8ccd2', { tile: 'alu' })
      b.on('solid')
    }
    b.box([0, 0.035, 0.1], [0.04, 0.05, 0.64], '#495057', { tile: 'keys' })
  },

  /** Handcuffs laid flat: two steel rings, the lock blocks, the chain's three links. */
  menottes: (b) => {
    for (const k of [-1, 1]) {
      b.ring([k * 0.3, 0.04, 0], 0.2, 0.04, '#adb5bd', { tile: 'metal', seg: 16 })
      b.box([k * 0.3 - k * 0.2, 0.05, 0], [0.12, 0.1, 0.16], '#868e96', { tile: 'metal' })
      b.box([k * 0.3 - k * 0.2, 0.101, 0.04], [0.03, 0.004, 0.03], '#343a40')
    }
    ;[-0.08, 0, 0.08].forEach((x, i) => b.ring([x, 0.03, 0], 0.035, 0.012, '#ced4da', { tile: 'metal', seg: 8, r: [i % 2 ? Math.PI / 2 : 0, 0, 0] }))
  },
}
