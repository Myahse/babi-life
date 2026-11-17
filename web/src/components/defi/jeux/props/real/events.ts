import type { Builder, Q, Recipe, V } from './kit'

// « Mini-jeux réalistes »: the street's happenings (the update « evenements-joues »): the rain's
// muddy puddle and the gbaka splashing through it, the umbrella, the kids' plastic-bag hat, the
// generator of the power cut, the car stuck in the mud, the opening's ribbon, the open gutter.
// Same sizes as the old props (the gbaka and the car lie along x, the front to +x).

/** A wheel along z (its axle across): the tyre, the rim, the hub. */
function wheel(b: Builder, p: V, r: number, q: Q) {
  b.cyl(p, r, 0.12, '#212529', { tile: 'soot', seg: q.lo ? 10 : 14, r: [Math.PI / 2, 0, 0] })
  b.cyl([p[0], p[1], p[2] + Math.sign(p[2]) * 0.004], r * 0.55, 0.125, '#adb5bd', { tile: 'metal', seg: 8, r: [Math.PI / 2, 0, 0] })
  if (!q.lo) b.cyl([p[0], p[1], p[2] + Math.sign(p[2]) * 0.008], r * 0.2, 0.128, '#495057', { seg: 6, r: [Math.PI / 2, 0, 0] })
}

export const EVENTS: Record<string, Recipe> = {
  /** A muddy puddle on the road: the wet earth round it, the brown water reflecting the sky, ripples. */
  flaque: (b, q) => {
    b.cyl([0, 0.012, 0], 0.5, 0.024, '#6b5a45', { tile: 'earth', seg: 14, top: 0.46, s: [1, 1, 0.85] })
    b.cyl([0.03, 0.026, 0], 0.4, 0.01, '#5b7690', { tile: 'water', seg: 14, s: [1, 1, 0.82] })
    b.on('glass').cyl([0.03, 0.033, 0], 0.38, 0.004, '#d0ebff', { seg: 14, s: [1, 1, 0.8] }).on('solid')
    for (const [x, z, r] of q.lo ? [[-0.12, 0.08, 0.09]] : [[-0.12, 0.08, 0.09], [0.15, -0.1, 0.06], [0.05, 0.14, 0.04]]) b.ring([x, 0.036, z], r, 0.006, '#e7f5ff', { seg: 12 })
    if (!q.lo) for (let i = 0; i < 5; i++) b.ball([Math.cos(i * 1.3) * 0.48, 0.02, Math.sin(i * 1.3) * 0.4], 0.035, '#8a7a62', { tile: 'earth', seg: 5 })
  },

  /** The gbaka: the green and yellow minibus, its windows, the sliding door, headlights, the luggage tied on the roof rack. */
  gbaka: (b, q) => {
    b.box([0, 0.42, 0], [1.7, 0.56, 0.74], '#2f9e44', { tile: 'enamel', bevel: 0.06 })
    b.box([0, 0.24, 0], [1.72, 0.12, 0.76], '#fcc419', { tile: 'enamel' })
    b.box([0.05, 0.63, 0], [1.3, 0.18, 0.76], '#a5d8ff', { tile: 'gloss' })
    for (const x of [-0.45, -0.1, 0.25]) b.box([x, 0.63, 0], [0.05, 0.19, 0.78], '#2f9e44', { tile: 'enamel' })
    b.box([0.84, 0.56, 0], [0.04, 0.24, 0.64], '#a5d8ff', { tile: 'gloss', r: [0, 0, 0.15] })
    b.box([0.2, 0.42, 0.376], [0.42, 0.4, 0.01], '#2b8a3e', { tile: 'enamel' })
    if (!q.lo) b.box([0.4, 0.42, 0.385], [0.06, 0.02, 0.012], '#c8ccd2', { tile: 'metal' })
    b.box([0.86, 0.2, 0], [0.04, 0.08, 0.7], '#c8ccd2', { tile: 'metal' })
    b.on('glow')
    for (const z of [0.25, -0.25]) b.box([0.865, 0.32, z], [0.012, 0.07, 0.12], '#fff3bf')
    for (const z of [0.3, -0.3]) b.box([-0.865, 0.32, z], [0.012, 0.06, 0.06], '#ff6b6b')
    b.on('solid')
    // The rack, the luggage tied on it.
    for (const z of [-0.32, 0.32]) b.box([0, 0.73, z], [1.4, 0.03, 0.03], '#495057', { tile: 'metal' })
    b.box([-0.2, 0.81, 0], [0.6, 0.14, 0.5], '#e8590c', { tile: 'wax' })
    b.box([0.2, 0.79, 0.05], [0.3, 0.1, 0.36], '#5f3dc4', { tile: 'fabric' })
    if (!q.lo) b.box([-0.2, 0.885, 0], [0.04, 0.012, 0.54], '#212529')
    for (const x of [0.55, -0.55]) for (const z of [0.36, -0.36]) wheel(b, [x, 0.16, z], 0.16, q)
  },

  /** A big umbrella open: the eight panels red and white, the ribs, the curved wooden handle. */
  parapluie: (b, q) => {
    b.cyl([0, 0.42, 0], 0.018, 0.84, '#495057', { tile: 'metal', seg: 6 })
    b.ring([0.05, 0.05, 0], 0.05, 0.018, '#7a4a20', { tile: 'wood', arc: Math.PI, seg: 8, r: [Math.PI / 2, 0, Math.PI] })
    // The canopy (its inside too, seen from under), the red panels laid over every other eighth.
    b.lathe([0, 0.71, 0], [[0.5, 0], [0.001, 0.22]], '#ffffff', { tile: 'fabric', seg: 8, inside: '#e9ecef' })
    for (let i = 0; i < 4; i++) b.cyl([0, 0.822, 0], 0.503, 0.224, '#e03131', { tile: 'fabric', top: 0.001, seg: 2, open: true, arc: Math.PI / 4, r: [0, (i * Math.PI) / 2, 0] })
    if (!q.lo) for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4
      b.ball([Math.sin(a) * 0.5, 0.71, Math.cos(a) * 0.5], 0.015, '#adb5bd', { seg: 4 })
    }
    b.cyl([0, 0.96, 0], 0.02, 0.08, '#495057', { tile: 'metal', seg: 6 })
  },

  /** The kids' rain hat: a black plastic bag over the head, its handles knotted on top, a shine. */
  'sachet-pluie': (b, q) => {
    b.ball([0, 0.18, 0], 0.27, '#212529', { tile: 'gloss', seg: q.lo ? 8 : 12, s: [1, 0.75, 0.85] })
    b.cyl([0, 0.06, 0], 0.27, 0.12, '#212529', { tile: 'gloss', seg: q.lo ? 8 : 12, s: [1, 1, 0.85], open: true })
    for (const x of [-0.08, 0.08]) b.ring([x, 0.44, 0], 0.05, 0.015, '#343a40', { tile: 'gloss', seg: 8, r: [Math.PI / 2, 0, x * 4] })
    b.ball([0, 0.42, 0], 0.04, '#343a40', { tile: 'gloss', seg: 6 })
    b.box([0.16, 0.2, 0.2], [0.08, 0.1, 0.01], '#868e96', { r: [0, 0.6, 0] })
  },

  /** The generator: the red tubular frame, the tank and its cap, the panel with its sockets, the pull cord, the exhaust. */
  'groupe-electrogene': (b, q) => {
    b.box([0, 0.25, 0], [0.7, 0.36, 0.44], '#c92a2a', { tile: 'enamel' })
    b.box([0, 0.5, 0], [0.5, 0.12, 0.36], '#f03e3e', { tile: 'enamel', bevel: 0.04 })
    b.cyl([0.12, 0.58, 0], 0.05, 0.04, '#212529', { tile: 'plastic', seg: 8 })
    b.box([-0.2, 0.25, 0.225], [0.24, 0.2, 0.012], '#343a40', { tile: 'metal' })
    for (const x of [-0.26, -0.14]) b.cyl([x, 0.22, 0.234], 0.03, 0.01, '#f8f9fa', { seg: 8, r: [Math.PI / 2, 0, 0] })
    b.box([0.2, 0.25, 0.225], [0.18, 0.12, 0.012], '#ffd43b', { tile: 'page', fit: true })
    b.cyl([0.3, 0.3, -0.24], 0.03, 0.08, '#495057', { tile: 'soot', seg: 6, r: [Math.PI / 2, 0, 0] })
    b.box([0.3, 0.6, 0], [0.06, 0.06, 0.06], '#212529', { tile: 'plastic' })
    // The frame's tubes.
    for (const x of [-0.38, 0.38])
      for (const z of [-0.25, 0.25]) b.cyl([x, 0.3, z], 0.02, 0.6, '#343a40', { tile: 'metal', seg: 6 })
    for (const z of [-0.25, 0.25]) for (const y of [0.02, 0.6]) b.cyl([0, y, z], 0.02, 0.76, '#343a40', { tile: 'metal', seg: 6, r: [0, 0, Math.PI / 2] })
    if (!q.lo) b.on('glow').box([-0.2, 0.33, 0.233], [0.04, 0.02, 0.004], '#69db7c').on('solid')
  },

  /** A little car stuck in the mud: the orange body, the cabin and its windows, the lights, mud splashed up its sides. */
  voiture: (b, q) => {
    b.box([0, 0.3, 0], [1.3, 0.3, 0.64], '#f08c00', { tile: 'enamel', bevel: 0.06 })
    b.box([-0.08, 0.53, 0], [0.72, 0.2, 0.6], '#f08c00', { tile: 'enamel', bevel: 0.05 })
    b.box([-0.08, 0.53, 0], [0.6, 0.17, 0.62], '#a5d8ff', { tile: 'gloss' })
    b.box([0.31, 0.52, 0], [0.04, 0.17, 0.58], '#a5d8ff', { tile: 'gloss', r: [0, 0, 0.4] })
    b.box([0.66, 0.22, 0], [0.04, 0.06, 0.62], '#c8ccd2', { tile: 'metal' })
    b.on('glow')
    for (const z of [0.2, -0.2]) b.box([0.655, 0.33, z], [0.012, 0.06, 0.1], '#fff3bf')
    b.on('solid')
    for (const x of [0.4, -0.4]) for (const z of [0.33, -0.33]) wheel(b, [x, 0.14, z], 0.14, q)
    b.box([0, 0.04, 0], [1.5, 0.08, 0.9], '#6b5a45', { tile: 'earth' })
    if (!q.lo) for (let i = 0; i < 8; i++) b.box([-0.6 + i * 0.17, 0.2 + (i % 3) * 0.04, (i % 2 ? 1 : -1) * 0.323], [0.1, 0.05 + (i % 2) * 0.04, 0.008], '#6b5a45', { tile: 'earth' })
  },

  /** The opening's ribbon: two chrome posts, the red satin ribbon, the big bow in the middle. */
  ruban: (b) => {
    for (const x of [-0.42, 0.42]) {
      b.cyl([x, 0.35, 0], 0.03, 0.7, '#ced4da', { tile: 'alu', seg: 8 })
      b.cyl([x, 0.02, 0], 0.1, 0.04, '#adb5bd', { tile: 'alu', seg: 10 })
      b.ball([x, 0.71, 0], 0.04, '#ced4da', { tile: 'alu', seg: 6 })
    }
    b.box([0, 0.55, 0], [0.84, 0.06, 0.01], '#e03131', { tile: 'gloss' })
    for (const s of [-1, 1]) {
      b.ball([s * 0.07, 0.55, 0.01], 0.06, '#c92a2a', { tile: 'gloss', seg: 8, s: [1.3, 0.8, 0.4], r: [0, 0, -s * 0.5] })
      b.box([s * 0.05, 0.46, 0.012], [0.04, 0.14, 0.008], '#c92a2a', { tile: 'gloss', r: [0, 0, s * 0.3] })
    }
    b.ball([0, 0.55, 0.02], 0.03, '#fa5252', { tile: 'gloss', seg: 6 })
  },

  /** A length of open gutter: the cracked concrete sides, the green slime, the dirty water, a plastic bottle in it. */
  caniveau: (b, q) => {
    for (const z of [-0.3, 0.3]) b.box([0, 0.06, z], [1.1, 0.12, 0.16], '#adb5bd', { tile: 'cement' })
    b.box([0, 0.01, 0], [1.1, 0.02, 0.46], '#5c940d', { tile: 'sponge' })
    b.box([0, 0.03, 0], [1.08, 0.02, 0.44], '#748c7a', { tile: 'water' })
    if (!q.lo) {
      b.cyl([0.2, 0.045, 0.05], 0.035, 0.16, '#d0ebff', { tile: 'gloss', seg: 6, r: [0, 0.6, Math.PI / 2] })
      b.box([-0.3, 0.042, -0.08], [0.12, 0.01, 0.1], '#e03131', { tile: 'plastic', r: [0, 0.4, 0] })
    }
  },
}
