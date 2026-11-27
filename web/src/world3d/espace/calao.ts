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

type Box = [x: number, y: number, z: number, w: number, h: number, d: number, color: string]

/** Boxes merged into one geometry, their colours in the vertices. */
export function mergeBoxes(boxes: Box[]): THREE.BufferGeometry {
  const parts = boxes.map(([x, y, z, w, h, d, color]) => {
    const g = new THREE.BoxGeometry(w, h, d)
    g.translate(x, y, z)
    const c = new THREE.Color(color)
    const n = g.attributes.position.count
    const cols = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) cols.set([c.r, c.g, c.b], i * 3)
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3))
    g.deleteAttribute('uv')
    return g
  })
  const g = mergeGeometries(parts, false)!
  parts.forEach((p) => p.dispose())
  return g
}

let solid: THREE.MeshLambertMaterial | null = null
/** The kit's one material (vertex colours, lit like the rest of the game). */
export const calaoMaterial = () => (solid ??= new THREE.MeshLambertMaterial({ vertexColors: true }))
let glow: THREE.MeshBasicMaterial | null = null
/** The flames' and the glows' (vertex colours, additive, unlit, no fog). */
export const flameMaterial = () => (glow ??= new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }))

const geoCache = new Map<string, THREE.BufferGeometry>()
function part(key: string, boxes: () => Box[], material: THREE.Material = calaoMaterial()): THREE.Mesh {
  let g = geoCache.get(key)
  if (!g) {
    g = mergeBoxes(boxes())
    geoCache.set(key, g)
  }
  const m = new THREE.Mesh(g, material)
  m.castShadow = material === calaoMaterial()
  m.receiveShadow = false
  return m
}

/** A round body in blocks: a square column with its corners cut (an octagon of boxes), from y0 to y1. */
function column(boxes: Box[], cx: number, cz: number, w: number, y0: number, y1: number, color: string, side = color) {
  const h = y1 - y0
  const y = y0 + h / 2
  boxes.push([cx, y, cz, w * 0.72, h, w, color])
  boxes.push([cx, y, cz, w, h, w * 0.72, side])
}

/** A nose in steps (each a little narrower), from y0, n steps of h each. */
function nose(boxes: Box[], cx: number, cz: number, w: number, y0: number, steps: number, h: number, color: string, tip = color) {
  for (let i = 0; i < steps; i++) {
    const k = 1 - (i + 1) / (steps + 1)
    column(boxes, cx, cz, w * k, y0 + i * h, y0 + (i + 1) * h, i === steps - 1 ? tip : color)
  }
}

/** Engine bells under a stage (dark, each a small stepped cone), centred on (cx, cz). */
function bells(boxes: Box[], cx: number, cz: number, at: [number, number][], size: number, y1: number) {
  for (const [dx, dz] of at) {
    boxes.push([cx + dx, y1 - size * 0.25, cz + dz, size * 0.55, size * 0.5, size * 0.55, CALAO_COLORS.steel])
    boxes.push([cx + dx, y1 - size * 0.75, cz + dz, size * 0.8, size * 0.5, size * 0.8, CALAO_COLORS.dark])
  }
}

/** The hornbill (le calao), the agency's mark, in blocks on a face (z: the face; 7 × 6, top row first). */
const HORNBILL = ['..oo...', '.oooo..', 'kkkwkk.', '.kkkkkk', '..kk.kk', '..k...k']
function hornbill(boxes: Box[], cx: number, cy: number, z: number, cell: number) {
  const col: Record<string, string> = { o: CALAO_COLORS.orange, k: '#16181d', w: '#ffffff' }
  HORNBILL.forEach((row, r) =>
    [...row].forEach((ch, k) => {
      if (ch === '.') return
      boxes.push([cx + (k - 3) * cell, cy - r * cell, z, cell, cell, cell * 0.3, col[ch]])
    }),
  )
}

/* ---------- The flames ---------- */

/** A flame: a long hot block, its white core, its orange tail (1 m long at scale 1, hanging down from y = 0). */
function flame(key: string, w: number): THREE.Group {
  const g = new THREE.Group()
  const m = part(`flame:${key}:${w}`, () => [
    [0, -0.5, 0, w, 1, w, '#ff8c1a'],
    [0, -0.35, 0, w * 0.6, 0.7, w * 0.6, '#fff3bf'],
    [0, -1.1, 0, w * 0.75, 0.6, w * 0.75, '#ff5a00'],
    [0, -1.6, 0, w * 0.45, 0.5, w * 0.45, '#b33c00'],
  ], flameMaterial())
  m.castShadow = false
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
  const f = 1 + 0.08 * Math.sin(t * 41 + g.id) + 0.05 * Math.sin(t * 67)
  g.scale.set(0.8 + 0.2 * power, Math.max(0.05, power * length * f), 0.8 + 0.2 * power)
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
  const { white, shade, orange, dark } = CALAO_COLORS
  const w = s.width
  // The engines' skirt, then the white body with a shade on its sides.
  column(b, 0, 0, w * 1.02, s.core - 0.6, s.core + 1.2, dark)
  column(b, 0, 0, w, s.core + 1.2, s.coreTop - 0.8, white, shade)
  // The agency's orange band near the top, a thin navy line under it, the roll marks (black and white) low.
  column(b, 0, 0, w * 1.03, s.coreTop - 4.2, s.coreTop - 2.6, orange)
  column(b, 0, 0, w * 1.035, s.coreTop - 4.6, s.coreTop - 4.2, CALAO_COLORS.navy)
  for (let i = 0; i < 4; i++) b.push([i % 2 ? w * 0.36 : -w * 0.36, s.core + 3 + 0.9, w * 0.505, w * 0.28, 1.8, 0.06, '#16181d'])
  // The interstage (dark), where the second stage lets go.
  column(b, 0, 0, w * 0.98, s.coreTop - 0.8, s.coreTop, dark)
  // The hornbill on its front, under the band.
  hornbill(b, 0, s.coreTop - 6, w * 0.515, w * 0.11)
  // The engines under it: three for the Calao-1, five for the Lourd.
  const spread = w * 0.28
  bells(b, 0, 0, s.heavy ? [[0, 0], [spread, spread], [-spread, spread], [spread, -spread], [-spread, -spread]] : [[0, 0], [spread, 0], [-spread, 0]], w * 0.38, s.core - 0.6)
  return b
}

/** A side booster: white, a nose in steps, its engine, its own band. */
function boosterBoxes(s: Spec): Box[] {
  const b: Box[] = []
  column(b, 0, 0, s.bW, s.core - 0.2, s.bTop, CALAO_COLORS.white, CALAO_COLORS.shade)
  column(b, 0, 0, s.bW * 1.04, s.bTop - 2.4, s.bTop - 1.6, CALAO_COLORS.orange)
  nose(b, 0, 0, s.bW, s.bTop, 3, 1.1, CALAO_COLORS.white, CALAO_COLORS.shade)
  bells(b, 0, 0, [[0, 0]], s.bW * 0.55, s.core - 0.2)
  return b
}

/** The second stage (white, a navy ring, its one engine hidden in the interstage). */
function stage2Boxes(s: Spec): Box[] {
  const b: Box[] = []
  column(b, 0, 0, s.s2W, s.coreTop, s.s2Top, CALAO_COLORS.white, CALAO_COLORS.shade)
  column(b, 0, 0, s.s2W * 1.03, s.s2Top - 1.4, s.s2Top - 0.8, CALAO_COLORS.navy)
  bells(b, 0, 0, [[0, 0]], s.s2W * 0.45, s.coreTop + 0.1)
  return b
}

/** The Pirogue capsule (seated on y = 0, ~3.8 m tall, 3.2 wide): navy, stepped, an orange stripe, two windows. */
function pirogueBoxes(scale = 1): Box[] {
  const b: Box[] = []
  const { navy, orange, sky, shield } = CALAO_COLORS
  const k = scale
  // The heat shield under it is the Pirogue's own part (pirogue()); seated on a rocket, a thin ring of it shows.
  column(b, 0, 0, 3.2 * k, 0, 0.35 * k, shield)
  column(b, 0, 0, 3.1 * k, 0.35 * k, 1.5 * k, navy)
  column(b, 0, 0, 3.15 * k, 1.5 * k, 1.85 * k, orange)
  column(b, 0, 0, 2.5 * k, 1.85 * k, 2.9 * k, navy)
  column(b, 0, 0, 1.6 * k, 2.9 * k, 3.5 * k, navy)
  // The docking hatch on top.
  column(b, 0, 0, 0.9 * k, 3.5 * k, 3.85 * k, CALAO_COLORS.steel)
  // Two windows on its front, one on each side.
  b.push([-0.55 * k, 1.0 * k, 1.56 * k, 0.6 * k, 0.5 * k, 0.06, sky])
  b.push([0.55 * k, 1.0 * k, 1.56 * k, 0.6 * k, 0.5 * k, 0.06, sky])
  b.push([1.56 * k, 1.0 * k, 0, 0.06, 0.5 * k, 0.6 * k, sky])
  b.push([-1.56 * k, 1.0 * k, 0, 0.06, 0.5 * k, 0.6 * k, sky])
  // The agency's little hornbill over the windows.
  hornbill(b, 0, 2.6 * k, 1.27 * k, 0.09 * k)
  return b
}

/** The Grande Pirogue (Mars): longer, with its living module and its two folded solar wings. */
function grandePirogueBoxes(): Box[] {
  const b: Box[] = pirogueBoxes(1.25).map(([x, y, z, w, h, d, c]) => [x, y + 6, z, w, h, d, c] as Box)
  const { white, shade, navy, gold } = CALAO_COLORS
  column(b, 0, 0, 3.8, 0, 6, white, shade)
  column(b, 0, 0, 3.9, 2.6, 3.2, navy)
  // The folded solar wings, gold, flat against it.
  b.push([2.0, 3, 0, 0.12, 4.6, 2.4, gold])
  b.push([-2.0, 3, 0, 0.12, 4.6, 2.4, gold])
  return b
}

/** The escape tower over the Pirogue: a thin red-and-white truss and its little motor. */
function towerBoxes(): Box[] {
  const b: Box[] = []
  b.push([0, 0.6, 0, 1.1, 1.2, 1.1, CALAO_COLORS.steel])
  for (let i = 0; i < 4; i++) b.push([0, 1.2 + i * 0.9 + 0.45, 0, 0.5, 0.9, 0.5, i % 2 ? '#e03131' : CALAO_COLORS.white])
  b.push([0, 5.1, 0, 0.75, 1.2, 0.75, '#e03131'])
  b.push([0, 6.0, 0, 0.4, 0.6, 0.4, CALAO_COLORS.white])
  return b
}

/** One half of the Lourd's fairing (side: +1 or −1, along x), from the second stage's top. */
function fairingBoxes(side: 1 | -1, w: number): Box[] {
  const b: Box[] = []
  const half: Box[] = []
  column(half, 0, 0, w, 0, 11, CALAO_COLORS.white, CALAO_COLORS.shade)
  column(half, 0, 0, w * 1.02, 8.5, 9.2, CALAO_COLORS.orange)
  nose(half, 0, 0, w, 11, 5, 1.4, CALAO_COLORS.white, CALAO_COLORS.shade)
  // Each box cut in two along x: this side's half.
  for (const [x, y, z, bw, h, d, c] of half) {
    const lo = side > 0 ? Math.max(x - bw / 2, 0) : x - bw / 2
    const hi = side > 0 ? x + bw / 2 : Math.min(x + bw / 2, 0)
    if (hi - lo > 0.01) b.push([(lo + hi) / 2, y, z, hi - lo, h, d, c])
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
  const core = flame(`core:${model}`, s.width * 0.75)
  core.position.y = s.core - 1.2
  stage1.add(core)
  root.add(stage1)

  const boosters: THREE.Group[] = []
  const bFlames: THREE.Group[] = []
  for (const [x, z] of s.boosters) {
    const g = new THREE.Group()
    g.position.set(x, 0, z)
    g.add(part(`b:${model}`, () => boosterBoxes(s)))
    const f = flame(`b:${model}`, s.bW * 0.6)
    f.position.y = s.core - 0.6
    g.add(f)
    // A strut to the core, dark (from the booster's middle to the core's side).
    const gap = Math.abs(x || z) - s.width / 2
    const strut = part(`strut:${model}:${x}:${z}`, () => [[-Math.sign(x) * (x ? gap / 2 : 0), s.bTop - 3, -Math.sign(z) * (z ? gap / 2 : 0), x ? gap : 0.4, 0.4, z ? gap : 0.4, CALAO_COLORS.dark]])
    g.add(strut)
    boosters.push(g)
    bFlames.push(f)
    root.add(g)
  }

  const stage2 = new THREE.Group()
  stage2.add(part(`s2:${model}`, () => stage2Boxes(s)))
  const f2 = flame(`s2:${model}`, s.s2W * 0.4)
  f2.position.y = s.coreTop - 0.2
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
    height = s.s2Top + 11 + 5 * 1.4
  } else {
    tower = new THREE.Group()
    tower.position.y = s.s2Top + 3.85
    tower.add(part('tower', towerBoxes))
    stage2.add(tower)
    height = s.s2Top + 3.85 + 6.3
  }
  root.userData.height = height
  return { root, model, height, width: s.width, boosters, stage1, stage2, capsule, tower, fairing, flames: { core, boosters: bFlames, stage2: f2 }, seams: { stage2: s.coreTop, capsule: s.s2Top } }
}

/* ---------- The Pirogue alone (the way back) ---------- */

/** A parachute's canopy in blocks: a stepped dome in segments of two colours, its lines to the capsule. */
function canopyBoxes(r: number, lines: number, a: string, b2: string): Box[] {
  const b: Box[] = []
  const rings = 3
  for (let i = 0; i < rings; i++) {
    const w = r * 2 * (1 - i * 0.28)
    const y = lines + i * r * 0.22
    // A checker of the two colours round the ring (four quarters).
    for (let q = 0; q < 4; q++) {
      const sx = q % 2 ? 1 : -1
      const sz = q < 2 ? 1 : -1
      b.push([(sx * w) / 4, y, (sz * w) / 4, w / 2, r * 0.22, w / 2, (q + i) % 2 ? a : b2])
    }
  }
  // The lines, four thin ones down to the capsule's top.
  for (let q = 0; q < 4; q++) {
    const sx = q % 2 ? 1 : -1
    const sz = q < 2 ? 1 : -1
    const n = 6
    for (let j = 0; j < n; j++) {
      const t = (j + 0.5) / n
      b.push([sx * r * 0.75 * t, t * lines, sz * r * 0.75 * t, 0.06, lines / n, 0.06, '#e9ecef'])
    }
  }
  return b
}

/** The re-entry's glow: a hot orange cup under the shield and a long trail up behind it. */
function plasmaBoxes(): Box[] {
  return [
    [0, -0.4, 0, 3.8, 0.6, 3.8, '#ffb000'],
    [0, -0.1, 0, 4.2, 0.4, 4.2, '#ff5a00'],
    [0, 5.6, 0, 2.6, 3.4, 2.6, '#ff7a1a'],
    [0, 9, 0, 1.8, 3.6, 1.8, '#c2410c'],
    [0, 12.5, 0, 1.2, 3.6, 1.2, '#7c2d12'],
  ]
}

/** The Pirogue alone, its shield down (y = 0 the shield's bottom), with its parachutes and floats to show. */
export function buildPirogue(): PirogueParts {
  const root = new THREE.Group()
  root.name = 'pirogue'
  const body = new THREE.Group()
  body.add(part('pirogue', () => pirogueBoxes()))
  root.add(body)
  const shield = new THREE.Group()
  shield.add(part('pirogue-shield', () => [[0, -0.15, 0, 3.3, 0.3, 3.3, CALAO_COLORS.shield], [0, -0.32, 0, 2.6, 0.12, 2.6, '#3b2412']]))
  root.add(shield)
  // Two drogues first (small, high), then three mains (orange and white).
  const drogues = new THREE.Group()
  for (const x of [-1.6, 1.6]) {
    const d = part(`drogue`, () => canopyBoxes(1.2, 9, CALAO_COLORS.chute, CALAO_COLORS.chuteAlt))
    d.position.set(x, 3.6, 0)
    d.rotation.z = -x * 0.08
    drogues.add(d)
  }
  drogues.visible = false
  root.add(drogues)
  const mains = new THREE.Group()
  for (const [x, z] of [[-4.2, 1.2], [4.2, 1.2], [0, -3.6]] as const) {
    const m = part(`main`, () => canopyBoxes(4, 16, CALAO_COLORS.chute, CALAO_COLORS.chuteAlt))
    m.position.set(0, 3.6, 0)
    m.rotation.set(z * 0.05, 0, -x * 0.05)
    m.position.x = x * 0.2
    m.position.z = z * 0.2
    mains.add(m)
  }
  mains.visible = false
  root.add(mains)
  // The floats, yellow, round it on the sea.
  const floats = new THREE.Group()
  floats.add(part('floats', () => [[2.0, 0.9, 0, 1, 0.9, 1.6, CALAO_COLORS.float], [-2.0, 0.9, 0, 1, 0.9, 1.6, CALAO_COLORS.float], [0, 0.9, 2.0, 1.6, 0.9, 1, CALAO_COLORS.float], [0, 0.9, -2.0, 1.6, 0.9, 1, CALAO_COLORS.float]]))
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
  const f = 1 + 0.06 * Math.sin(t * 37)
  p.plasma.scale.set(0.7 + 0.3 * heat, heat * f, 0.7 + 0.3 * heat)
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
export const calaoHeight = (model: CalaoModel) => (model === 'calao-lourd' ? SPECS[model].s2Top + 11 + 7 : SPECS[model].s2Top + 10.15)
