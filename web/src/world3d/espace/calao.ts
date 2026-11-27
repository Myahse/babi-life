import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// The Calao rocket kit (L'espace, the update « espace »; backend game/espace.go: Rocket, RocketHeavy, Capsule,
// MarsShip): the agency Astrélia's launcher in blocks, the game's one shared space asset. Built in plain three.js
// (no React), so every scene takes it as it is: the pad in the street (spatioport.tsx), the launch and the way
// back (LaunchView.tsx, Retour.tsx), the station's dock and the Moon's lander (D's scenes) — `<primitive
// object={calao.root} />`, or `group.add(calao.root)`.
//
//   - Calao-1 (crewed): a white core with the agency's orange band and its hornbill, two side boosters, a
//     second stage, the Pirogue capsule on top under its escape tower. About 46 m tall.
//   - Calao Lourd (Mars): a longer core, four boosters, a wider second stage, the Grande Pirogue under a
//     fairing. About 70 m tall.
//   - The Pirogue alone (the way back): its heat shield, the drogue and main parachutes, the floats for the sea,
//     the retro-rockets for the steppe.
//
// One unit is one metre; y = 0 is the bottom of the engines; the rocket's front (its hornbill) faces +z. Each
// part is one merged geometry with vertex colours (one draw), all sharing one material; the flames are their own,
// lit by setFlame. Every part is a Group of its own, so a scene can let it go (the boosters, the first stage, the
// fairing, the tower at staging): `parts.stage1.removeFromParent()`, or move it in the scene's frame
// (`scene.attach(parts.boosters[0])`) and let it fall.

export type CalaoModel = 'calao-1' | 'calao-lourd'

/** The agency's colours (the band, the capsule, the shield…). */
export const CALAO_COLORS = {
  white: '#f4f4f1',
  shade: '#dcdcd6',
  orange: '#ff7a00',
  navy: '#1c3d6e',
  sky: '#74c0fc',
  dark: '#2b2f36',
  steel: '#868e96',
  shield: '#5b3a1e',
  gold: '#f2b632',
  chute: '#ff7a00',
  chuteAlt: '#ffffff',
  float: '#ffd43b',
} as const

export type CalaoParts = {
  root: THREE.Group
  model: CalaoModel
  /** Height to the tip (m), and the core's width. */
  height: number
  width: number
  /** The side boosters (2 or 4), each with its own flame. */
  boosters: THREE.Group[]
  /** The core's first stage (its engines, the band, the hornbill). */
  stage1: THREE.Group
  /** The second stage, the capsule and what's on it ride on it after the first staging. */
  stage2: THREE.Group
  /** The Pirogue (Calao-1) or the Grande Pirogue (Calao Lourd), on top of stage2. */
  capsule: THREE.Group
  /** The escape tower (Calao-1) or the fairing's two halves (Calao Lourd), let go once high. */
  tower?: THREE.Group
  fairing?: [THREE.Group, THREE.Group]
  /** The flames: the core's, each booster's, the second stage's (setFlame). */
  flames: { core: THREE.Group; boosters: THREE.Group[]; stage2: THREE.Group }
  /** Where each stage's bottom is (m from the rocket's base): the staging's seams. */
  seams: { stage2: number; capsule: number }
}

export type PirogueParts = {
  root: THREE.Group
  /** The capsule's body (the windows, the orange stripe), its heat shield under it. */
  body: THREE.Group
  shield: THREE.Group
  /** The parachutes: the two drogues, then the three mains (hidden until shown). */
  drogues: THREE.Group
  mains: THREE.Group
  /** The yellow floats round it after a splashdown; the retro-rockets' puff for the steppe. */
  floats: THREE.Group
  retro: THREE.Group
  /** The re-entry's glow round the shield (setPlasma). */
  plasma: THREE.Group
}

/* ---------- The blocks ---------- */

/** How a block is drawn: '' the painted body, 'm' bare metal (the bells, the rings), 'g' lit from within (windows, hot metal, lamps). */
export type BoxTag = '' | 'm' | 'g'
type Box = [x: number, y: number, z: number, w: number, h: number, d: number, color: string, tag?: BoxTag]

/**
 * Boxes merged into one geometry, their colours in the vertices. `shade`: how much darker each box's bottom
 * is than its top (a soft light from above, baked in: the blocks read as volumes even in flat light).
 */
export function mergeBoxes(boxes: Box[], shade = 0.12): THREE.BufferGeometry {
  const parts = boxes.map(([x, y, z, w, h, d, color]) => {
    const g = new THREE.BoxGeometry(w, h, d)
    const c = new THREE.Color(color)
    const n = g.attributes.position.count
    const pos = g.attributes.position
    const cols = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const k = pos.getY(i) < 0 ? 1 - shade : 1
      cols.set([c.r * k, c.g * k, c.b * k], i * 3)
    }
    g.translate(x, y, z)
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3))
    g.deleteAttribute('uv')
    return g
  })
  const g = mergeGeometries(parts, false)!
  parts.forEach((p) => p.dispose())
  return g
}

let solid: THREE.MeshStandardMaterial | null = null
/** The kit's painted body (vertex colours; a satin paint, a little sheen where the sun hits). */
export const calaoMaterial = () => (solid ??= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.58, metalness: 0.06 }))
let metal: THREE.MeshStandardMaterial | null = null
/** Bare metal: the engine bells, the docking ring, the grid fins, the tower's truss. */
export const metalMaterial = () => (metal ??= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.3 }))
let lit: THREE.MeshBasicMaterial | null = null
/** What shines by itself: the capsule's windows, the lamps. */
export const litMaterial = () => (lit ??= new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }))
let glow: THREE.MeshBasicMaterial | null = null
/** The flames' and the glows' (vertex colours, additive, unlit, no fog). */
export const flameMaterial = () => (glow ??= new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }))

const geoCache = new Map<string, THREE.BufferGeometry>()
const cached = (key: string, f: () => THREE.BufferGeometry) => geoCache.get(key) ?? (geoCache.set(key, f()), geoCache.get(key)!)
/**
 * A part: its painted blocks as one mesh, its metal and its lit blocks as one child mesh each (at most three
 * draws). `material` given (the flames, the glows): every block in it, one draw.
 */
function part(key: string, boxes: () => Box[], material?: THREE.Material): THREE.Mesh {
  if (material) {
    const m = new THREE.Mesh(cached(key, () => mergeBoxes(boxes(), 0)), material)
    m.castShadow = false
    return m
  }
  let all: Box[] | null = null
  const of = (tag: BoxTag) => {
    all ??= boxes()
    const list = all.filter((b) => (b[7] ?? '') === tag)
    return list.length ? mergeBoxes(list) : null
  }
  const body = cached(`${key}:`, () => of('') ?? new THREE.BufferGeometry())
  const m = new THREE.Mesh(body, calaoMaterial())
  m.castShadow = true
  for (const [tag, mat] of [['m', metalMaterial()], ['g', litMaterial()]] as const) {
    const k = `${key}:${tag}`
    if (!geoCache.has(k)) geoCache.set(k, of(tag) ?? EMPTY)
    const g = geoCache.get(k)!
    if (g === EMPTY) continue
    const c = new THREE.Mesh(g, mat)
    c.castShadow = tag === 'm'
    m.add(c)
  }
  return m
}
const EMPTY = new THREE.BufferGeometry()

/**
 * A round body in blocks: three boxes crossed (a twelve-sided column, its corners stepped), from y0 to y1.
 * `side`: the colour of the flanks (a shade of the face's, so it reads round).
 */
function column(boxes: Box[], cx: number, cz: number, w: number, y0: number, y1: number, color: string, side = color, tag?: BoxTag) {
  const h = y1 - y0
  const y = y0 + h / 2
  boxes.push([cx, y, cz, w * 0.7, h, w, color, tag])
  boxes.push([cx, y, cz, w, h, w * 0.7, side, tag])
  boxes.push([cx, y, cz, w * 0.88, h, w * 0.88, side, tag])
}

/** A nose in steps, rounded like an ogive (each step narrower faster near the tip), from y0, n steps of h each. */
function nose(boxes: Box[], cx: number, cz: number, w: number, y0: number, steps: number, h: number, color: string, tip = color, side = color) {
  for (let i = 0; i < steps; i++) {
    const k = Math.cos(((i + 0.5) / steps) * Math.PI * 0.5) ** 0.8
    column(boxes, cx, cz, w * k, y0 + i * h, y0 + (i + 1) * h, i === steps - 1 ? tip : color, i === steps - 1 ? tip : side)
  }
}

/** Thin seams round a white body (the panels' joints), every `every` metres between y0 and y1. */
function seams(boxes: Box[], w: number, y0: number, y1: number, every: number, color = '#c9cdd2') {
  for (let y = y0 + every; y < y1 - 0.4; y += every) column(boxes, 0, 0, w * 1.006, y - 0.04, y + 0.04, color)
}

/** An engine bell under a stage: the turbopump's block, the bell flaring in three steps, its dark throat. */
function bell(boxes: Box[], x: number, z: number, size: number, y1: number) {
  const { steel, dark } = CALAO_COLORS
  boxes.push([x, y1 - size * 0.12, z, size * 0.42, size * 0.24, size * 0.42, '#5c636e', 'm'])
  const tiers = [0.48, 0.66, 0.84]
  tiers.forEach((k, i) => {
    const y = y1 - size * (0.24 + i * 0.26 + 0.13)
    boxes.push([x, y, z, size * k * 0.72, size * 0.26, size * k, i === 2 ? steel : '#9aa1ab', 'm'])
    boxes.push([x, y, z, size * k, size * 0.26, size * k * 0.72, i === 2 ? steel : '#9aa1ab', 'm'])
  })
  // The throat seen from below, and the nozzle's lip.
  boxes.push([x, y1 - size * 1.02, z, size * 0.56, 0.05, size * 0.56, dark])
  boxes.push([x, y1 - size * 1.02, z, size * 0.9, 0.04, size * 0.9, '#3d434c', 'm'])
}

/** The hornbill (le calao), the agency's mark, in blocks on a face (z: the face; 7 × 6, top row first). */
const HORNBILL = ['..oo...', '.oooo..', 'kkkwkk.', '.kkkkkk', '..kk.kk', '..k...k']
function hornbill(boxes: Box[], cx: number, cy: number, z: number, cell: number, back = false) {
  const col: Record<string, string> = { o: CALAO_COLORS.orange, k: '#16181d', w: '#ffffff' }
  HORNBILL.forEach((row, r) =>
    [...row].forEach((ch, k) => {
      if (ch === '.') return
      boxes.push([cx + (back ? 3 - k : k - 3) * cell, cy - r * cell, z, cell, cell, cell * 0.3, col[ch]])
    }),
  )
}

/** The agency's name in blocks, letters stacked down a face (3 × 5 cells each), the É's accent over it. */
const LETTERS: Record<string, string[]> = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  S: ['###', '#..', '###', '..#', '###'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  E: ['###', '#..', '##.', '#..', '###'],
  L: ['#..', '#..', '#..', '#..', '###'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
}
function lettering(boxes: Box[], word: string, top: number, z: number, cell: number, color: string) {
  let y = top
  for (const ch of word) {
    const accent = ch === 'É'
    const rows = LETTERS[accent ? 'E' : ch]
    if (accent) boxes.push([cell, y + cell * 0.9, z, cell, cell * 0.6, cell * 0.25, color])
    rows.forEach((row, r) => [...row].forEach((c, k) => c === '#' && boxes.push([(k - 1) * cell, y - r * cell, z, cell, cell, cell * 0.25, color])))
    y -= cell * 6.6
  }
}

/* ---------- The flames ---------- */

/**
 * A flame, layered: a wide dim halo at the nozzle, the orange envelope tapering away, the yellow body, the white
 * core and its shock diamonds (1.8 m long at scale 1, hanging down from y = 0).
 */
function flame(key: string, w: number): THREE.Group {
  const g = new THREE.Group()
  const m = part(`flame:${key}:${w}`, () => {
    const b: Box[] = [
      // The halo round the nozzle (dim: added, it glows).
      [0, -0.08, 0, w * 1.5, 0.16, w * 1.5, '#5a2200'],
      // The envelope, orange to red as it thins.
      [0, -0.3, 0, w * 1.05, 0.6, w * 1.05, '#c24e00'],
      [0, -0.85, 0, w * 0.9, 0.5, w * 0.9, '#a83a00'],
      [0, -1.3, 0, w * 0.7, 0.4, w * 0.7, '#7a2600'],
      [0, -1.65, 0, w * 0.45, 0.3, w * 0.45, '#4a1500'],
      // The body, yellow.
      [0, -0.35, 0, w * 0.75, 0.7, w * 0.75, '#b88a10'],
      [0, -0.9, 0, w * 0.55, 0.4, w * 0.55, '#8a5a08'],
      // The core, white hot near the nozzle.
      [0, -0.2, 0, w * 0.5, 0.4, w * 0.5, '#fff6d8'],
    ]
    // The shock diamonds down the core.
    for (let i = 0; i < 4; i++) b.push([0, -0.48 - i * 0.26, 0, w * (0.34 - i * 0.05), 0.1, w * (0.34 - i * 0.05), '#ffe9a8'])
    return b
  }, flameMaterial())
  m.frustumCulled = false
  g.add(m)
  g.visible = false
  g.userData.flame = true
  return g
}

/** Lights a flame group (power 0: out; 1: full, its length its scale), flickering with t (seconds). */
export function setFlame(g: THREE.Group | undefined, power: number, t = 0, length = 1) {
  if (!g) return
  g.visible = power > 0.01
  if (!g.visible) return
  const f = 1 + 0.07 * Math.sin(t * 41 + g.id) + 0.05 * Math.sin(t * 67 + g.id * 0.3)
  const wide = 0.85 + 0.15 * power + 0.04 * Math.sin(t * 53 + g.id)
  g.scale.set(wide, Math.max(0.05, power * length * f), wide)
}

/** Lights every flame of a Calao at once (the core and the boosters; the second stage's apart). */
export function setCalaoFlames(p: CalaoParts, core: number, boosters: number, stage2: number, t = 0, length = 1) {
  setFlame(p.flames.core, core, t, length)
  p.flames.boosters.forEach((b) => setFlame(b, boosters, t, length))
  setFlame(p.flames.stage2, stage2, t, length * 0.7)
}

/* ---------- The Calao ---------- */

type Spec = { core: number; coreTop: number; width: number; boosters: [number, number][]; bW: number; bTop: number; s2W: number; s2Top: number; heavy: boolean }
const SPECS: Record<CalaoModel, Spec> = {
  'calao-1': { core: 2, coreTop: 26, width: 3.6, boosters: [[3.1, 0], [-3.1, 0]], bW: 2.2, bTop: 18, s2W: 3.0, s2Top: 35.5, heavy: false },
  'calao-lourd': { core: 2.5, coreTop: 36, width: 4.8, boosters: [[4.1, 0], [-4.1, 0], [0, 4.1], [0, -4.1]], bW: 2.6, bTop: 24, s2W: 4.4, s2Top: 49, heavy: true },
}

/** The core's first stage. */
function stage1Boxes(s: Spec): Box[] {
  const b: Box[] = []
  const { white, shade, orange, navy } = CALAO_COLORS
  const w = s.width
  const top = s.coreTop
  // The engine bay: dark, its thermal blanket ring, the skirt flaring a little at the bottom.
  column(b, 0, 0, w * 1.06, s.core - 0.6, s.core - 0.1, '#30353c')
  column(b, 0, 0, w * 1.02, s.core - 0.1, s.core + 1.4, '#3d434c', '#353a42')
  column(b, 0, 0, w * 1.03, s.core + 0.5, s.core + 0.62, '#6a717c', '#6a717c', 'm')
  // The white body, its panel seams.
  column(b, 0, 0, w, s.core + 1.4, top - 1.2, white, shade)
  seams(b, w, s.core + 1.4, top - 1.2, 3.1)
  // The livery: the orange band between two navy pinstripes near the top.
  column(b, 0, 0, w * 1.02, top - 4.3, top - 2.6, orange, '#ec6f00')
  column(b, 0, 0, w * 1.025, top - 4.6, top - 4.35, navy)
  column(b, 0, 0, w * 1.025, top - 2.55, top - 2.3, navy)
  // The roll marks on the flanks: black and white quarters.
  for (const sx of [1, -1]) {
    b.push([sx * w * 0.503, top - 6.6, sx * w * 0.17, 0.05, 1.6, w * 0.34, '#16181d'])
    b.push([sx * w * 0.503, top - 8.2, -sx * w * 0.17, 0.05, 1.6, w * 0.34, '#16181d'])
  }
  // The hornbill on its front under the band, the agency's name down it; the hornbill on its back too.
  hornbill(b, 0, top - 5.2, w * 0.515, w * 0.1)
  hornbill(b, 0, top - 5.2, -w * 0.515, w * 0.1, true)
  lettering(b, 'ASTRÉLIA', top - 8.4, w * 0.508, w * 0.075, navy)
  // The interstage (dark), its ribs, where the second stage lets go.
  column(b, 0, 0, w * 1.0, top - 1.2, top, '#2f343b', '#2a2e34')
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    b.push([Math.cos(a) * w * 0.42, top - 0.6, Math.sin(a) * w * 0.42, 0.16, 1.2, 0.16, '#5c636e', 'm'])
  }
  // The four grid fins folded against the interstage (a lattice each).
  for (const [fx, fz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const cx = fx * (w * 0.5 + 0.08)
    const cz = fz * (w * 0.5 + 0.08)
    const along = (u: number) => (fx ? [cx, cz + u] : [cx + u, cz]) as [number, number]
    const fw = w * 0.32
    for (const u of [-fw / 2, 0, fw / 2]) {
      const [x, z] = along(u)
      b.push([x, top - 1.9, z, fx ? 0.12 : 0.07, fw, fx ? 0.07 : 0.12, '#8a919c', 'm'])
    }
    for (const v of [-fw / 2, 0, fw / 2]) {
      const [x, z] = along(0)
      b.push([x, top - 1.9 + v, z, fx ? 0.12 : fw, 0.07, fx ? fw : 0.12, '#8a919c', 'm'])
    }
  }
  // The engines under it: five for the Calao-1 (a cross), nine for the Lourd (three by three).
  const spread = w * 0.27
  const at: [number, number][] = s.heavy ? [-1, 0, 1].flatMap((i) => [-1, 0, 1].map((k) => [i * spread, k * spread] as [number, number])) : [[0, 0], [spread, 0], [-spread, 0], [0, spread], [0, -spread]]
  for (const [x, z] of at) bell(b, x, z, w * (s.heavy ? 0.26 : 0.3), s.core - 0.6)
  return b
}

/** A side booster: white, its seams, an ogive nose with a dark tip, its band, four little fins, its engine. */
function boosterBoxes(s: Spec): Box[] {
  const b: Box[] = []
  const { white, shade, orange, navy } = CALAO_COLORS
  const bw = s.bW
  column(b, 0, 0, bw * 1.04, s.core - 0.2, s.core + 0.9, '#3d434c', '#353a42')
  column(b, 0, 0, bw, s.core + 0.9, s.bTop, white, shade)
  seams(b, bw, s.core + 0.9, s.bTop, 2.8)
  column(b, 0, 0, bw * 1.03, s.bTop - 2.6, s.bTop - 1.5, orange, '#ec6f00')
  column(b, 0, 0, bw * 1.035, s.bTop - 2.85, s.bTop - 2.62, navy)
  nose(b, 0, 0, bw, s.bTop, 5, 0.85, white, '#2b2f36', shade)
  // Fins at the foot, navy.
  for (const [fx, fz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) b.push([fx * (bw * 0.5 + 0.35), s.core + 1.5, fz * (bw * 0.5 + 0.35), fx ? 0.7 : 0.1, 1.8, fz ? 0.7 : 0.1, navy])
  bell(b, 0, 0, bw * 0.62, s.core - 0.2)
  return b
}

/** The second stage (white, its seams, a navy ring and the agency's orange stripe; its one engine hidden in the interstage). */
function stage2Boxes(s: Spec): Box[] {
  const b: Box[] = []
  const { white, shade, orange, navy } = CALAO_COLORS
  column(b, 0, 0, s.s2W, s.coreTop, s.s2Top, white, shade)
  seams(b, s.s2W, s.coreTop, s.s2Top, 2.6)
  column(b, 0, 0, s.s2W * 1.03, s.s2Top - 1.5, s.s2Top - 0.9, navy)
  column(b, 0, 0, s.s2W * 1.025, s.s2Top - 2.1, s.s2Top - 1.75, orange)
  // The adapter under the capsule, metal.
  column(b, 0, 0, s.s2W * 0.98, s.s2Top - 0.35, s.s2Top, '#7d8590', '#7d8590', 'm')
  bell(b, 0, 0, s.s2W * 0.5, s.coreTop + 0.1)
  return b
}

/**
 * The Pirogue capsule (seated on y = 0, ~3.8 m tall, 3.3 wide): navy, a cone in six steps, the orange stripe,
 * two framed windows in front and one each side, the hatch, the thruster quads, the docking ring on top.
 */
function pirogueBoxes(scale = 1): Box[] {
  const b: Box[] = []
  const { navy, orange, shield } = CALAO_COLORS
  const k = scale
  const hi = '#24497f'
  // The heat shield's rim (the shield itself is the Pirogue's own part); seated on a rocket, this ring shows.
  column(b, 0, 0, 3.3 * k, 0, 0.3 * k, shield, '#4a2f18')
  const tiers: [number, number, number, string][] = [
    [0.3, 0.85, 3.15, navy],
    [0.85, 1.45, 2.95, navy],
    [1.45, 1.8, 2.82, orange],
    [1.8, 2.35, 2.5, navy],
    [2.35, 2.85, 2.15, navy],
    [2.85, 3.3, 1.75, navy],
  ]
  for (const [y0, y1, w, c] of tiers) {
    column(b, 0, 0, w * k, y0 * k, y1 * k, c, c === navy ? '#173562' : '#ec6f00')
    // A light seam on each step's top edge.
    if (c === navy) column(b, 0, 0, w * k * 1.004, y1 * k - 0.03, y1 * k, hi)
  }
  // The docking ring and its cap, metal.
  column(b, 0, 0, 1.3 * k, 3.3 * k, 3.6 * k, '#b4bac3', '#b4bac3', 'm')
  column(b, 0, 0, 0.95 * k, 3.6 * k, 3.85 * k, '#c9ced6', '#c9ced6', 'm')
  // Two framed windows on its front, one on each flank (the glass lit from within).
  const f = 1.475 * k
  for (const x of [-0.6, 0.6]) {
    b.push([x * k, 1.15 * k, f + 0.02, 0.74 * k, 0.6 * k, 0.05, '#0d1a2e'])
    b.push([x * k, 1.15 * k, f + 0.05, 0.56 * k, 0.44 * k, 0.04, '#9fd8ff', 'g'])
  }
  b.push([-f - 0.02, 1.15 * k, 0, 0.05, 0.6 * k, 0.74 * k, '#0d1a2e'])
  b.push([-f - 0.05, 1.15 * k, 0, 0.04, 0.44 * k, 0.56 * k, '#9fd8ff', 'g'])
  // The hatch on its right flank: its light frame, the panel, the orange handle.
  b.push([f + 0.02, 1.05 * k, 0, 0.05, 0.95 * k, 1.05 * k, '#c9ced6'])
  b.push([f + 0.05, 1.05 * k, 0, 0.04, 0.8 * k, 0.9 * k, '#2a4f86'])
  b.push([f + 0.09, 1.05 * k, 0.25 * k, 0.06, 0.12 * k, 0.28 * k, orange])
  // The thruster quads round the upper steps: a dark block, its little nozzles.
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const r = 1.1 * k
    b.push([dx * r, 2.6 * k, dz * r, dx ? 0.22 : 0.34, 0.34 * k, dz ? 0.22 : 0.34, '#2b2f36'])
    b.push([dx * (r + 0.14), 2.6 * k, dz * (r + 0.14), dx ? 0.08 : 0.1, 0.1, dz ? 0.08 : 0.1, '#868e96', 'm'])
  }
  // The agency's little hornbill over the windows, its name on the stripe's back.
  hornbill(b, 0, 2.72 * k, 1.09 * k, 0.075 * k)
  return b
}

/** The Grande Pirogue (Mars): the Pirogue on its living module, the two folded solar wings in cells. */
function grandePirogueBoxes(): Box[] {
  const b: Box[] = pirogueBoxes(1.25).map(([x, y, z, w, h, d, c, t]) => [x, y + 6, z, w, h, d, c, t] as Box)
  const { white, shade, navy, gold } = CALAO_COLORS
  column(b, 0, 0, 3.8, 0, 6, white, shade)
  seams(b, 3.8, 0, 6, 1.5)
  column(b, 0, 0, 3.9, 2.6, 3.2, navy)
  // The folded solar wings: gold cells on a dark frame.
  for (const sx of [1, -1]) {
    b.push([sx * 2.0, 3, 0, 0.1, 4.8, 2.6, '#3b3220'])
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) b.push([sx * 2.06, 1.2 + i * 1.2, -0.6 + j * 1.2, 0.06, 1.05, 1.05, (i + j) % 2 ? gold : '#d99b1f'])
  }
  return b
}

/** The escape tower over the Pirogue: its adapter, a red-and-white truss, the motor and its four nozzles, the nose and its spike. */
function towerBoxes(): Box[] {
  const b: Box[] = []
  const red = '#e03131'
  const { white } = CALAO_COLORS
  column(b, 0, 0, 1.15, 0, 0.45, '#9aa1ab', '#9aa1ab', 'm')
  column(b, 0, 0, 0.85, 0.45, 0.8, '#c9ced6', '#c9ced6', 'm')
  // The truss: four posts, rungs and braces.
  for (const [x, z] of [[-0.32, -0.32], [0.32, -0.32], [-0.32, 0.32], [0.32, 0.32]]) b.push([x, 2.2, z, 0.1, 2.8, 0.1, red])
  for (let i = 0; i < 5; i++) {
    const y = 0.85 + i * 0.68
    const c = i % 2 ? white : red
    b.push([0, y, 0.32, 0.74, 0.08, 0.08, c])
    b.push([0, y, -0.32, 0.74, 0.08, 0.08, c])
    b.push([0.32, y, 0, 0.08, 0.08, 0.74, c])
    b.push([-0.32, y, 0, 0.08, 0.08, 0.74, c])
  }
  // The motor: red, a white band, the four abort nozzles angled out.
  column(b, 0, 0, 0.8, 3.6, 5.5, red, '#c92a2a')
  column(b, 0, 0, 0.84, 4.5, 4.75, white)
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    b.push([dx * 0.48, 3.8, dz * 0.48, dx ? 0.22 : 0.26, 0.3, dz ? 0.22 : 0.26, '#5c636e', 'm'])
    b.push([dx * 0.62, 3.68, dz * 0.62, dx ? 0.14 : 0.2, 0.2, dz ? 0.14 : 0.2, '#2b2f36', 'm'])
  }
  nose(b, 0, 0, 0.8, 5.5, 3, 0.25, white, white, CALAO_COLORS.shade)
  b.push([0, 6.5, 0, 0.07, 0.6, 0.07, '#868e96', 'm'])
  return b
}

/** One half of the Lourd's fairing (side: +1 or −1, along x), from the second stage's top. */
function fairingBoxes(side: 1 | -1, w: number): Box[] {
  const b: Box[] = []
  const half: Box[] = []
  column(half, 0, 0, w, 0, 11, CALAO_COLORS.white, CALAO_COLORS.shade)
  seams(half, w, 0, 11, 2.7)
  column(half, 0, 0, w * 1.02, 8.3, 9.2, CALAO_COLORS.orange, '#ec6f00')
  column(half, 0, 0, w * 1.025, 8.05, 8.3, CALAO_COLORS.navy)
  nose(half, 0, 0, w, 11, 6, 1.2, CALAO_COLORS.white, '#2b2f36', CALAO_COLORS.shade)
  hornbill(half, 0, 6.6, w * 0.515, w * 0.09)
  // Each box cut in two along x: this side's half; the seam between them dark.
  for (const [x, y, z, bw, h, d, c, t] of half) {
    const lo = side > 0 ? Math.max(x - bw / 2, 0.02) : x - bw / 2
    const hi = side > 0 ? x + bw / 2 : Math.min(x + bw / 2, -0.02)
    if (hi - lo > 0.01) b.push([(lo + hi) / 2, y, z, hi - lo, h, d, c, t])
  }
  return b
}

/** A Calao, ready to stand on its pad (y = 0 on the pad's deck). */
export function buildCalao(model: CalaoModel = 'calao-1'): CalaoParts {
  const s = SPECS[model]
  const root = new THREE.Group()
  root.name = model
  const stage1 = new THREE.Group()
  stage1.add(part(`s1:${model}`, () => stage1Boxes(s)))
  const core = flame(`core:${model}`, s.width * 0.8)
  core.position.y = s.core - 0.6 - s.width * 0.3
  stage1.add(core)
  root.add(stage1)

  const boosters: THREE.Group[] = []
  const bFlames: THREE.Group[] = []
  for (const [x, z] of s.boosters) {
    const g = new THREE.Group()
    g.position.set(x, 0, z)
    g.add(part(`b:${model}`, () => boosterBoxes(s)))
    const f = flame(`b:${model}`, s.bW * 0.62)
    f.position.y = s.core - 0.2 - s.bW * 0.62
    g.add(f)
    // The struts to the core, top and bottom, dark metal.
    const gap = Math.abs(x || z) - s.width / 2
    const strut = part(`strut:${model}:${x}:${z}`, () =>
      [s.bTop - 3, s.core + 2.4].map((y) => [-Math.sign(x) * (x ? gap / 2 : 0), y, -Math.sign(z) * (z ? gap / 2 : 0), x ? gap : 0.45, 0.45, z ? gap : 0.45, '#5c636e', 'm'] as Box),
    )
    g.add(strut)
    boosters.push(g)
    bFlames.push(f)
    root.add(g)
  }

  const stage2 = new THREE.Group()
  stage2.add(part(`s2:${model}`, () => stage2Boxes(s)))
  const f2 = flame(`s2:${model}`, s.s2W * 0.45)
  f2.position.y = s.coreTop + 0.1 - s.s2W * 0.5
  stage2.add(f2)
  root.add(stage2)

  const capsule = new THREE.Group()
  capsule.position.y = s.s2Top
  capsule.add(part(`cap:${model}`, () => (s.heavy ? grandePirogueBoxes() : pirogueBoxes())))
  stage2.add(capsule)

  let tower: THREE.Group | undefined
  let fairing: [THREE.Group, THREE.Group] | undefined
  let height: number
  if (s.heavy) {
    const halves = ([1, -1] as const).map((side) => {
      const g = new THREE.Group()
      g.position.y = s.s2Top
      g.add(part(`fair:${side}`, () => fairingBoxes(side, s.s2W * 1.02)))
      stage2.add(g)
      return g
    })
    fairing = [halves[0], halves[1]]
    height = s.s2Top + 11 + 6 * 1.2
  } else {
    tower = new THREE.Group()
    tower.position.y = s.s2Top + 3.85
    tower.add(part('tower', towerBoxes))
    stage2.add(tower)
    height = s.s2Top + 3.85 + 6.8
  }
  root.userData.height = height
  return { root, model, height, width: s.width, boosters, stage1, stage2, capsule, tower, fairing, flames: { core, boosters: bFlames, stage2: f2 }, seams: { stage2: s.coreTop, capsule: s.s2Top } }
}

/* ---------- The Pirogue alone (the way back) ---------- */

/**
 * A parachute in blocks: a dome of cells over a disc of radius r (its top `lines` metres up, centred off the
 * capsule's axis by (ox, oz)), in radial gores of two colours, a white band round its skirt, the vent open at
 * its crown; its lines, thin, from the rim down to the capsule's top (the origin).
 */
function canopyBoxes(r: number, lines: number, a: string, b2: string, ox = 0, oz = 0): Box[] {
  const b: Box[] = []
  const n = 8
  const cell = r / n
  const gores = 8
  for (let i = -n; i < n; i++)
    for (let k = -n; k < n; k++) {
      const x = (i + 0.5) * cell
      const z = (k + 0.5) * cell
      const d = Math.hypot(x, z) / r
      if (d > 1 || d < 0.12) continue
      const y = lines + r * 0.5 * Math.sqrt(1 - d * d) - r * 0.1
      const g = Math.floor(((Math.atan2(z, x) + Math.PI) / (Math.PI * 2)) * gores)
      const c = d > 0.86 ? '#f8f9fa' : g % 2 ? a : b2
      // Tall enough to meet the next ring down (no gaps on the steep skirt).
      const slope = (0.5 * Math.min(0.97, d + 0.07)) / Math.sqrt(1 - Math.min(0.97, d + 0.07) ** 2)
      b.push([ox + x, y - slope * cell * 0.4, oz + z, cell * 1.02, cell * (0.45 + slope), cell * 1.02, c])
    }
  // The lines: from the rim's points down to the capsule's top, a chain of thin blocks each.
  const ends = 8
  for (let q = 0; q < ends; q++) {
    const ang = (q / ends) * Math.PI * 2
    const tx = ox + Math.cos(ang) * r * 0.95
    const tz = oz + Math.sin(ang) * r * 0.95
    const ty = lines - r * 0.1
    const len = Math.hypot(tx, ty, tz)
    const steps = Math.ceil(len / 0.7)
    for (let j = 0; j < steps; j++) {
      const t = (j + 0.5) / steps
      b.push([tx * t, ty * t, tz * t, 0.05, 0.75, 0.05, '#dee2e6'])
    }
  }
  return b
}

/** The re-entry's glow: the white-hot cup under the shield, its orange halo, the long trail of plasma up behind it and its sparks. */
function plasmaBoxes(): Box[] {
  const b: Box[] = [
    [0, -0.45, 0, 3.6, 0.3, 3.6, '#fff1c2'],
    [0, -0.3, 0, 4.4, 0.5, 4.4, '#d96500'],
    [0, -0.1, 0, 5.2, 0.7, 5.2, '#6a2400'],
    // The sheath round the flanks.
    [0, 1.4, 0, 3.9, 2.6, 3.9, '#5a1f00'],
    [0, 2.8, 0, 3.2, 1.8, 3.2, '#7a2c00'],
  ]
  // The wake, narrowing and reddening up behind.
  for (let i = 0; i < 7; i++) {
    const w = 3.2 - i * 0.36
    const c = ['#c2410c', '#b23a0a', '#9a3208', '#7c2d12', '#5c200c', '#40160a', '#2a0e06'][i]
    b.push([0, 5 + i * 2.2, 0, w, 2.3, w, c])
  }
  // Sparks peeling off.
  let seed = 3
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  for (let i = 0; i < 22; i++) {
    const y = 3 + rnd() * 16
    const sp = 1.6 + y * 0.08
    b.push([(rnd() - 0.5) * sp * 2, y, (rnd() - 0.5) * sp * 2, 0.22, 0.5, 0.22, rnd() > 0.5 ? '#ffb347' : '#ff7a1a'])
  }
  return b
}

/** The heat shield under the Pirogue: its tiles, a dark joint between each, scorched round the rim. */
function shieldBoxes(): Box[] {
  const b: Box[] = []
  b.push([0, -0.12, 0, 3.2, 0.24, 2.3, '#2e1c0d'])
  b.push([0, -0.12, 0, 2.3, 0.24, 3.2, '#2e1c0d'])
  const n = 6
  const cell = 3.2 / n
  for (let i = 0; i < n; i++)
    for (let k = 0; k < n; k++) {
      const x = -1.6 + (i + 0.5) * cell
      const z = -1.6 + (k + 0.5) * cell
      if (Math.abs(x) + Math.abs(z) > 2.45) continue
      const rim = Math.hypot(x, z) > 1.15
      b.push([x, -0.27, z, cell * 0.9, 0.08, cell * 0.9, rim ? '#3b2412' : (i + k) % 2 ? CALAO_COLORS.shield : '#6b4524'])
    }
  return b
}

/** The floats' collar round the capsule after a splashdown: yellow, in segments, a darker seam between. */
function floatBoxes(): Box[] {
  const b: Box[] = []
  const r = 2.05
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    const c = i % 3 === 0 ? '#f2b632' : CALAO_COLORS.float
    b.push([Math.cos(a) * r, 0.75, Math.sin(a) * r, 0.95, 0.75, 0.95, c])
  }
  return b
}

/** The Pirogue alone, its shield down (y = 0 the shield's bottom), with its parachutes and floats to show. */
export function buildPirogue(): PirogueParts {
  const root = new THREE.Group()
  root.name = 'pirogue'
  const body = new THREE.Group()
  body.add(part('pirogue', () => pirogueBoxes()))
  root.add(body)
  const shield = new THREE.Group()
  shield.add(part('pirogue-shield', shieldBoxes))
  root.add(shield)
  // Two drogues first (small, high), then three mains (orange and white).
  const drogues = new THREE.Group()
  for (const x of [-1.8, 1.8]) {
    const d = part(`drogue:${x}`, () => canopyBoxes(1.4, 10, CALAO_COLORS.chute, CALAO_COLORS.chuteAlt, x, 0))
    d.position.set(0, 3.6, 0)
    d.castShadow = false
    drogues.add(d)
  }
  drogues.visible = false
  root.add(drogues)
  const mains = new THREE.Group()
  for (const [x, z] of [[-5.2, 2.4], [5.2, 2.4], [0, -5.4]] as const) {
    const m = part(`main:${x}:${z}`, () => canopyBoxes(4.6, 17, CALAO_COLORS.chute, CALAO_COLORS.chuteAlt, x, z))
    m.position.set(0, 3.6, 0)
    m.castShadow = false
    mains.add(m)
  }
  mains.visible = false
  root.add(mains)
  // The floats, yellow, round it on the sea.
  const floats = new THREE.Group()
  floats.add(part('floats', floatBoxes))
  floats.visible = false
  root.add(floats)
  // The retro-rockets' burst under it, just before the steppe.
  const retro = flame('retro', 2.6)
  retro.position.y = -0.3
  root.add(retro)
  const plasma = new THREE.Group()
  const pm = part('plasma', plasmaBoxes, flameMaterial())
  pm.frustumCulled = false
  plasma.add(pm)
  plasma.visible = false
  root.add(plasma)
  return { root, body, shield, drogues, mains, floats, retro, plasma }
}

/** The re-entry's glow (0: none; 1: the hottest), flickering with t. */
export function setPlasma(p: PirogueParts, heat: number, t = 0) {
  p.plasma.visible = heat > 0.02
  if (!p.plasma.visible) return
  const f = 1 + 0.06 * Math.sin(t * 37) + 0.04 * Math.sin(t * 59)
  p.plasma.scale.set(0.75 + 0.25 * heat, (0.3 + 0.7 * heat) * f, 0.75 + 0.25 * heat)
  p.plasma.rotation.y = t * 0.6
}

/** The parachutes as the way back goes: 'none', 'drogues', 'mains' (opening: 0..1 of their spread). */
export function setChutes(p: PirogueParts, which: 'none' | 'drogues' | 'mains', opening = 1) {
  p.drogues.visible = which === 'drogues'
  p.mains.visible = which === 'mains'
  const g = which === 'mains' ? p.mains : p.drogues
  const k = Math.max(0.15, Math.min(1, opening))
  g.scale.set(k, 0.6 + 0.4 * k, k)
}

/** The kit's height (m) for a model, without building it. */
export const calaoHeight = (model: CalaoModel) => (model === 'calao-lourd' ? SPECS[model].s2Top + 11 + 7.2 : SPECS[model].s2Top + 10.65)
