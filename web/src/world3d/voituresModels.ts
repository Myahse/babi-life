import * as THREE from 'three'
import { Kit, NX, NZ, PX, PY, PZ, R, type Mat, type Reg, type V3, type VoituresTier } from './voituresKit'

// The vehicles of « voitures réalistes » (voituresKit.ts), built once per model and tier and shared:
// the body (with its lamps, plates, grille, trim) in one geometry, the glass in another, one wheel
// drawn four times (instanced, so it spins and steers). Each keeps today's size and stance
// (vehicles.tsx): the seats, the riders, the apprenti's step and the collisions line up as before.
// Real size, in metres, nose towards +x, +z its right (the kerb side).

export type ModelKey = 'taxi' | 'woro' | 'saloon' | 'berline' | 'suv' | '4x4' | 'limo' | 'cruiser' | 'pickup' | 'hyper' | 'gbaka' | 'sotra' | 'coach' | 'moto'
type Tier = Exclude<VoituresTier, 'off'>

/** One wheel's place: x, y (its centre), z, whether it steers, which side (+1 right). */
export type WheelAt = [number, number, number, boolean, 1 | -1]
export type Built = {
  body: THREE.BufferGeometry
  glass: THREE.BufferGeometry | null
  wheel: THREE.BufferGeometry | null
  wheels: WheelAt[]
  /** The wheels' radius (their spin) and the wheelbase (their steer). */
  r: number
  base: number
  /** The length (the night beam starts at its nose). */
  len: number
  tris: number
}

// What the parts are made of.
const paint = (tint = 1): Mat => ({ reg: R.paint, slot: 1, tint })
const paint2 = (tint = 1): Mat => ({ reg: R.paint, slot: 2, tint })
/** The body's sides: the paint, dust low down. */
const SIDE: Mat = { reg: R.paint, slot: 1, fit: { faces: [PX, NX, PZ, NZ], reg: R.side } }
const SIDE2: Mat = { reg: R.paint, slot: 2, fit: { faces: [PX, NX, PZ, NZ], reg: R.side } }
const solid = (reg: Reg, c: string, tint = 1): Mat => ({ reg, c, tint })
const BLACK = solid(R.plastic, '#202328')
const RUBBER = solid(R.rubber, '#18181a')
const CHROME = solid(R.chrome, '#d9dee5')
const DARKMETAL = solid(R.metal, '#3a3f46')
const INTERIOR = solid(R.interior, '#2a2622')
const SEAT = solid(R.seat, '#3b3530')
const HEADLAMP: Mat = { reg: R.head, c: '#ffffff', fit: { faces: [PX], reg: R.headLens } }
const TAILLAMP: Mat = { reg: R.tail, c: '#ffffff', fit: { faces: [NX], reg: R.tailLens } }
const AMBER = solid(R.amber, '#ff9f1c')
const fitted = (reg: Reg, faces: number[], c = '#ffffff', base: Reg = R.matte): Mat => ({ reg: base, c, fit: { faces, reg } })
// Glass colours (the glass material takes the vertex colour): the windscreen a little lighter. Up
// close on « normal » and « haute » the lighter a tint the more of the inside it shows (voituresKit.ts
// glassMaterial); each car has its own (Car.glass), the gbaka and the bus keep the dark ones.
const GLASS = '#1d262f'
const SCREEN = '#27323e'
const TINTED = '#0b0f14'

type Car = {
  len: number
  wide: number
  r: number
  axles: number[]
  c0: number
  c1: number
  top: number
  /** The roof's x range, and how far the windscreen and the rear glass run out at their feet. */
  roof: [number, number]
  front: number
  rear: number
  pillars: number[]
  pillarColor?: string
  tint?: boolean
  /** Its glass's tint up close (light: the inside seen through it; dark: a limousine's privacy glass). */
  glass: string
  lamps: { y: number; w: number; h: number }
  grille: 'bar' | 'wide' | 'black' | 'horseshoe'
  bumper: 'black' | 'paint' | 'chrome'
  hub: 'alloy' | 'steel'
  hubColor?: string
  tyre: number
  mirrors: 'paint' | 'black' | 'second'
  chromeLine?: boolean
  cladding?: boolean
  flares?: number
  step?: boolean
  rails?: 'rails' | 'rack'
  bullbar?: boolean
  spare?: boolean
  taxi?: boolean
  band?: boolean
  bed?: boolean
  wing?: boolean
  rearSecond?: boolean
  stripe?: boolean
  seams: number[]
}

const CARS: Record<'saloon' | 'berline' | 'suv' | '4x4' | 'limo' | 'cruiser' | 'pickup' | 'hyper', Car> = {
  // The small saloon (the taxi compteur, the woro-woro, the plain car): low bonnet, both screens well sloped, a real boot.
  saloon: { len: 4.4, wide: 1.66, r: 0.32, axles: [1.32, -1.32], c0: 0.32, c1: 0.88, top: 1.44, roof: [-0.95, 0.35], front: 0.6, rear: 0.5, pillars: [-0.3], glass: '#6d8496', lamps: { y: 0.7, w: 0.3, h: 0.14 }, grille: 'bar', bumper: 'black', hub: 'steel', tyre: 0.24, mirrors: 'paint', seams: [0.9, -0.3, -1.4] },
  // The Plateau's big berline: long and low, chrome along the sides and on the grille.
  berline: { len: 4.9, wide: 1.82, r: 0.34, axles: [1.5, -1.5], c0: 0.3, c1: 0.84, top: 1.38, roof: [-1.25, 0.35], front: 0.62, rear: 0.55, pillars: [-0.45], glass: '#5a7080', lamps: { y: 0.66, w: 0.36, h: 0.12 }, grille: 'bar', bumper: 'paint', hub: 'alloy', tyre: 0.25, mirrors: 'paint', chromeLine: true, seams: [0.95, -0.45, -1.75] },
  suv: { len: 4.6, wide: 1.82, r: 0.38, axles: [1.45, -1.45], c0: 0.4, c1: 1.1, top: 1.8, roof: [-2.0, 0.55], front: 0.45, rear: 0.06, pillars: [0.05, -1.15], glass: '#62798a', lamps: { y: 0.85, w: 0.32, h: 0.14 }, grille: 'bar', bumper: 'black', hub: 'alloy', tyre: 0.27, mirrors: 'paint', rails: 'rails', flares: 0.04, seams: [0.95, 0.05, -1.15] },
  // The up-country 4×4: high off the ground, big wheels, upright glass, bull bar, spare wheel, roof rack, steps.
  '4x4': { len: 4.8, wide: 1.92, r: 0.44, axles: [1.55, -1.55], c0: 0.5, c1: 1.2, top: 2.02, roof: [-2.2, 0.8], front: 0.3, rear: 0.03, pillars: [-0.35, -1.55], glass: '#728a99', lamps: { y: 0.98, w: 0.3, h: 0.16 }, grille: 'wide', bumper: 'black', hub: 'steel', hubColor: '#3a3d42', tyre: 0.32, mirrors: 'black', cladding: true, flares: 0.08, step: true, rails: 'rack', bullbar: true, spare: true, seams: [1.05, -0.35, -1.55] },
  limo: { len: 6.4, wide: 1.84, r: 0.34, axles: [2.35, -2.35], c0: 0.3, c1: 0.84, top: 1.4, roof: [-2.1, 1.3], front: 0.55, rear: 0.5, pillars: [-1.95, -0.85, 0.25], tint: true, glass: '#151b21', lamps: { y: 0.66, w: 0.36, h: 0.12 }, grille: 'bar', bumper: 'paint', hub: 'alloy', tyre: 0.25, mirrors: 'paint', chromeLine: true, seams: [1.75, 0.25, -0.85, -1.95] },
  // The Savane Cruiser: upright and boxy, black cladding, wide grille with three bars, steps, rails.
  cruiser: { len: 4.92, wide: 1.98, r: 0.42, axles: [1.5, -1.48], c0: 0.52, c1: 1.28, top: 2.06, roof: [-2.15, 0.95], front: 0.25, rear: 0.03, pillars: [-0.15], pillarColor: '#202328', tint: true, glass: '#2b3a45', lamps: { y: 1.16, w: 0.32, h: 0.1 }, grille: 'wide', bumper: 'black', hub: 'alloy', hubColor: '#b8bdc4', tyre: 0.3, mirrors: 'black', cladding: true, flares: 0.08, step: true, rails: 'rails', seams: [1.15, -0.15, -1.6] },
  // The Baobab double-cab pick-up: tall, wide black arches, the bed with its sport bar.
  pickup: { len: 5.4, wide: 2.0, r: 0.46, axles: [1.7, -1.7], c0: 0.58, c1: 1.3, top: 2.08, roof: [-0.95, 1.25], front: 0.3, rear: 0, pillars: [0.2], pillarColor: '#202328', tint: true, glass: '#3d4f5c', lamps: { y: 1.2, w: 0.36, h: 0.12 }, grille: 'black', bumper: 'black', hub: 'steel', hubColor: '#2b2f36', tyre: 0.32, mirrors: 'black', flares: 0.12, bed: true, stripe: true, seams: [1.5, 0.2, -1.0] },
  // The Éclair: low and wide, a small canopy, the rear in the second colour, the wing.
  hyper: { len: 4.55, wide: 2.04, r: 0.36, axles: [1.36, -1.4], c0: 0.2, c1: 0.74, top: 1.16, roof: [-0.95, 0.2], front: 0.6, rear: 0.25, pillars: [], tint: true, glass: '#24303a', lamps: { y: 0.54, w: 0.42, h: 0.07 }, grille: 'horseshoe', bumper: 'paint', hub: 'alloy', hubColor: '#9aa0a6', tyre: 0.3, mirrors: 'second', wing: true, rearSecond: true, seams: [0.55, -0.55] },
}

/** Where the glass goes: its own kit up close (the glass material), the body's far off (one draw). */
type Glass = (s: V3, p: V3, c: string, rot?: V3) => void

/** A far wheel (or a pair across the vehicle): a hexagonal disc, both faces the two-tone rim, the side the tread. */
function farWheel(k: Kit, r: number, w: number, p: V3) {
  k.cyl(r, w, p, 6, { reg: R.rimFar, c: '#ffffff' }, R.tread)
}

/** Far off (past the detail distance): the silhouette in a dozen boxes, one draw, ~100 triangles. The lamps stay (by night the streets are lines of white and red). */
function farCar(k: Kit, c: Car, opt: { taxi?: boolean; band?: boolean }): WheelAt[] {
  const { len, wide, r, c0, c1, top } = c
  const hl = len / 2
  const [rx0, rx1] = c.roof
  k.box([len, c1 - c0, wide], [0, (c0 + c1) / 2, 0], paint())
  if (c.rearSecond) k.box([1.1, c1 - c0 + 0.06, wide + 0.01], [-hl + 0.55, (c0 + c1) / 2 + 0.03, 0], paint2())
  if (opt.band) k.box([len + 0.02, 0.2, wide + 0.02], [0, c0 + 0.12, 0], paint2())
  if (c.cladding) k.box([len + 0.02, 0.24, wide + 0.03], [0, c0 + 0.1, 0], BLACK)
  const back = c.bed ? rx0 : rx0 - c.rear
  k.prism([[back, c1 - 0.01], [rx1 + c.front, c1 - 0.01], [rx1, top - 0.05], [rx0, top - 0.05]], wide - 0.16, 0, solid(R.glassFar, c.tint ? TINTED : GLASS))
  k.box([rx1 - rx0, 0.07, wide - 0.14], [(rx0 + rx1) / 2, top - 0.035, 0], c.rearSecond ? paint2() : paint())
  if (c.bed) k.box([rx0 + hl - 0.1, 0.34, wide], [(rx0 - hl) / 2, c1 + 0.17, 0], paint())
  // (The wheels as six-sided discs: the light rim in its dark tyre, still read 60 m off.)
  for (const a of c.axles) farWheel(k, r, wide + 0.04, [a, r, 0])
  k.box([0.05, c.lamps.h, wide - 0.16], [hl + 0.005, c.lamps.y, 0], solid(R.head, '#ffffff'))
  k.box([0.05, c.lamps.h, wide - 0.2], [-hl - 0.005, c.lamps.y, 0], solid(R.tail, '#ffffff'))
  if (opt.taxi) k.box([0.26, 0.13, 0.62], [(rx0 + rx1) / 2, top + 0.065, 0], solid(R.lit, '#f7d33b'))
  if (c.spare) k.box([0.26, r * 2, r * 2], [-hl - 0.16, c0 + 0.62, 0], RUBBER)
  return []
}

function carBody(k: Kit, glassPrism: (pts: [number, number][], d: number, c: string) => void, c: Car, d: number, low: boolean, opt: { taxi?: boolean; band?: boolean; clear?: boolean; plate: number; number: number }): WheelAt[] {
  const { len, wide, r, c0, c1, top } = c
  const hl = len / 2
  const cw = wide - 0.16
  const [rx0, rx1] = c.roof
  const pil = c.pillarColor ? solid(R.paint, c.pillarColor) : paint()
  const side = low ? paint() : SIDE
  // The body: in one colour (the hypercar's back in the second).
  if (c.rearSecond) {
    k.box([len - 1.1, c1 - c0, wide], [0.55, (c0 + c1) / 2, 0], side)
    k.box([1.1, c1 - c0 + 0.06, wide], [-hl + 0.55, (c0 + c1) / 2 + 0.03, 0], low ? paint2() : SIDE2)
  } else k.box([len, c1 - c0, wide], [0, (c0 + c1) / 2, 0], side)
  // The bonnet a step up over the engine, the boot lid behind (a saloon's).
  if (!low && !c.bed) {
    const bx0 = rx1 + c.front * 0.7
    if (hl - bx0 > 0.4) k.box([hl - bx0 - 0.08, 0.04, wide - 0.12], [(hl + bx0) / 2 - 0.02, c1 + 0.02, 0], paint(0.98))
    const tx0 = rx0 - c.rear * 0.7
    if (c.rear > 0.2 && tx0 + hl > 0.4) k.box([tx0 + hl - 0.08, 0.03, wide - 0.12], [(tx0 - hl) / 2 + 0.02, c1 + 0.015, 0], paint(0.98))
  }
  // Bumpers at both ends, the lower black cladding, a woro-woro's band.
  const bump = c.bumper === 'paint' ? paint(0.95) : c.bumper === 'chrome' ? CHROME : BLACK
  for (const s of [1, -1]) k.box([0.16, c.cladding ? 0.3 : 0.22, wide + 0.04], [s * (hl + 0.04), c0 + (c.cladding ? 0.04 : 0.1), 0], bump)
  if (c.cladding) k.box([len - 0.1, 0.24, wide + 0.04], [0, c0 + 0.1, 0], BLACK)
  if (opt.band) k.box([len + 0.02, 0.2, wide + 0.02], [0, c0 + 0.12, 0], paint2())
  // The wheel arches: black lips over the wheels (wide flares on the big ones).
  for (const a of c.axles)
    for (const s of [1, -1]) {
      if (c.flares) {
        k.box([r * 2.5, 0.14, c.flares + 0.04], [a, c0 + r * 1.3, s * (wide / 2 + c.flares / 2)], BLACK)
        for (const e of [-1, 1]) k.box([0.12, 0.3, c.flares + 0.04], [a + e * r * 1.2, c0 + r * 1.3 - 0.2, s * (wide / 2 + c.flares / 2)], BLACK)
      } else if (!low && 2 * r > c0) k.box([r * 2 + 0.12, 0.05, 0.02], [a, Math.min(2 * r + 0.04, c1 - 0.08), s * (wide / 2 + 0.006)], BLACK, undefined, false)
      // A dark well behind the wheel, so the body doesn't show through the gap.
      if (!low) k.box([r * 2 + 0.06, 0.1, wide - 0.1], [a, c0 + 0.04, 0], RUBBER, undefined, false)
    }

  // The glasshouse: the roof, the glass in one sloped piece (or upright), the pillars proud of it.
  const gy0 = c1 - 0.02
  const gy1 = top - 0.06
  const cabH = top - c1
  if (c.bed) {
    // A pick-up's cab: upright glass at the back.
    glassPrism([[rx0 - 0.02, gy0], [rx1 + c.front + 0.02, gy0], [rx1, gy1], [rx0 - 0.02, gy1]], cw + 0.01, c.glass)
  } else glassPrism([[rx0 - c.rear - 0.02, gy0], [rx1 + c.front + 0.02, gy0], [rx1, gy1], [rx0, gy1]], cw + 0.01, c.glass)
  k.box([rx1 - rx0 + 0.04, 0.08, cw + 0.02], [(rx0 + rx1) / 2, top - 0.04, 0], c.rearSecond ? paint2() : paint(0.97))
  const slope = (xb: number, xt: number) => {
    const dx = xt - xb
    return { len: Math.hypot(dx, cabH), ang: Math.atan2(-dx, cabH), mid: [(xb + xt) / 2, c1 + cabH / 2] as [number, number] }
  }
  const A = slope(rx1 + c.front, rx1)
  for (const s of [1, -1]) k.box([0.07, A.len, 0.06], [A.mid[0], A.mid[1], s * (cw / 2 - 0.01)], c.rearSecond ? paint2() : pil, [0, 0, A.ang])
  if (c.rear > 0.08) {
    const C = slope(rx0 - c.rear, rx0)
    for (const s of [1, -1]) k.box([0.1, C.len, 0.06], [C.mid[0], C.mid[1], s * (cw / 2 - 0.01)], c.rearSecond ? paint2() : paint(), [0, 0, C.ang])
  } else for (const s of [1, -1]) k.box([c.pillarColor ? 0.36 : 0.12, cabH, 0.06], [rx0 + (c.pillarColor ? 0.18 : 0.04), c1 + cabH / 2, s * (cw / 2 - 0.01)], paint())
  for (const x of c.pillars) for (const s of [1, -1]) k.box([0.09, cabH, 0.06], [x, c1 + cabH / 2, s * (cw / 2 - 0.01)], pil)
  if (low) {
    // Far off: the glass in the body's draw, the wheels too.
    const wheelR = c.hub === 'alloy' ? R.rimAlloy : R.rimSteel
    for (const a of c.axles) for (const s of [1, -1]) k.cyl(r, c.tyre, [a, r, s * (wide / 2 - 0.1)], 8, { reg: wheelR, c: '#ffffff' }, R.tread)
  }

  // Mirrors at the windscreen's foot.
  const mir = c.mirrors === 'black' ? BLACK : c.mirrors === 'second' ? paint2() : paint()
  for (const s of [1, -1]) {
    k.box([0.09, 0.12, 0.17], [rx1 + c.front - 0.12, c1 + 0.13, s * (wide / 2 + 0.07)], mir)
    if (!low) k.box([0.05, 0.04, 0.1], [rx1 + c.front - 0.1, c1 + 0.08, s * (wide / 2 + 0.01)], BLACK, undefined, false)
  }
  // Lamps: the headlamps' lenses, the tail lamps, the indicators at the corners.
  const L = c.lamps
  for (const s of [1, -1]) {
    k.box([0.05, L.h, L.w], [hl + 0.005, L.y, s * (wide / 2 - L.w / 2 - 0.08)], HEADLAMP)
    if (!c.wing) k.box([0.05, L.h * 1.2, 0.28], [-hl - 0.005, L.y + 0.02, s * (wide / 2 - 0.2)], TAILLAMP)
    else if (s > 0) k.box([0.05, 0.07, wide - 0.3], [-hl - 0.005, c1 - 0.14, 0], TAILLAMP)
    if (!low) k.box([0.04, 0.06, 0.1], [hl + 0.003, L.y - L.h / 2 - 0.04, s * (wide / 2 - 0.08)], AMBER, undefined, false)
  }
  // The grille.
  const gw = c.grille === 'wide' ? wide * 0.7 : c.grille === 'black' ? wide * 0.78 : c.grille === 'horseshoe' ? 0.36 : wide * 0.42
  const gh = c.grille === 'wide' ? 0.4 : c.grille === 'black' ? 0.46 : c.grille === 'horseshoe' ? 0.32 : 0.16
  const gy = c.grille === 'horseshoe' ? c0 + 0.28 : c.grille === 'bar' ? L.y : c1 - 0.3
  k.box([0.05, gh, gw], [hl + 0.012, gy, 0], fitted(R.grille, [PX], '#ffffff', R.plastic))
  if (c.grille === 'wide') for (let i = 0; i < 3; i++) k.box([0.02, 0.035, gw - 0.06], [hl + 0.045, gy + 0.13 - i * 0.13, 0], CHROME, undefined, false)
  if (c.grille === 'bar' && (c.chromeLine || d >= 1)) k.box([0.03, 0.03, gw + 0.04], [hl + 0.04, gy + gh / 2 + 0.02, 0], CHROME, undefined, false)
  if (c.grille === 'black') k.box([0.03, 0.07, wide * 0.8], [hl + 0.05, c1 - 0.52, 0], CHROME, undefined, false)
  // Plates, front and back (invented numbers).
  const plate = R.plates[opt.plate % R.plates.length]
  const bumpFace = hl + 0.12
  k.box([0.02, 0.11, 0.5], [bumpFace + 0.01, c0 + (c.cladding ? 0.08 : 0.12), 0], fitted(plate, [PX], '#ffffff', R.matte), undefined, false)
  k.box([0.02, 0.11, 0.5], [-bumpFace - 0.01, c0 + (c.cladding ? 0.08 : 0.12), 0], fitted(plate, [NX], '#ffffff', R.matte), undefined, false)

  // The taxi compteur: its lit roof sign, its number on the front doors.
  if (opt.taxi) {
    k.box([0.26, 0.13, 0.62], [(rx0 + rx1) / 2, top + 0.065, 0], { reg: R.lit, c: '#f7f3e8', fit: { faces: [PX, NX], reg: R.taxiSign } })
    k.box([0.3, 0.03, 0.66], [(rx0 + rx1) / 2, top + 0.01, 0], BLACK, undefined, false)
    if (!low) for (const s of [1, -1]) k.box([0.42, 0.12, 0.004], [rx1 + 0.05, c1 - 0.2, s * (wide / 2 + 0.003)], fitted(R.taxiNumber[opt.number % 2], [PZ, NZ], '#ffffff'), undefined, false)
  }
  // Roof rails on their feet (and a 4×4's rack with its bars).
  if (c.rails) {
    const rl = rx1 - rx0 - 0.3
    const rc = (rx0 + rx1) / 2 - 0.05
    for (const s of [1, -1]) {
      k.box([rl, 0.04, 0.05], [rc, top + 0.09, s * (cw / 2 - 0.08)], DARKMETAL, undefined, false)
      if (!low) for (const fx of [-0.5, 0.5]) k.box([0.08, 0.08, 0.06], [rc + fx * (rl - 0.06), top + 0.04, s * (cw / 2 - 0.08)], BLACK, undefined, false)
    }
    if (c.rails === 'rack' || d >= 2) for (const fx of [-0.35, 0, 0.35]) k.box([0.05, 0.03, cw - 0.12], [rc + fx * rl, top + 0.12, 0], CHROME, undefined, false)
  }
  // The chrome line along the sides, a pick-up's stripe.
  if (c.chromeLine) for (const s of [1, -1]) k.box([len - 0.6, 0.03, 0.01], [0, c1 - 0.08, s * (wide / 2 + 0.006)], CHROME, undefined, false)
  if (c.stripe) for (const s of [1, -1]) k.box([len * 0.55, 0.06, 0.01], [-0.6, c1 - 0.22, s * (wide / 2 + 0.006)], solid(R.matte, '#c3c7cf'), undefined, false)

  if (!low) {
    // Door seams, the handles, the sill.
    for (const s of [1, -1]) {
      for (const x of c.seams) k.box([0.022, c1 - c0 - 0.1, 0.01], [x, (c0 + c1) / 2 + 0.03, s * (wide / 2 + 0.004)], BLACK, undefined, false)
      for (const x of c.seams.slice(0, -1)) k.box([0.18, 0.04, 0.025], [x - 0.3, c1 - 0.13, s * (wide / 2 + 0.012)], CHROME, undefined, false)
      if (c.step) k.box([c.axles[0] - c.axles[c.axles.length - 1] - r * 2.6, 0.05, 0.22], [(c.axles[0] + c.axles[c.axles.length - 1]) / 2, c0 - 0.08, s * (wide / 2 + 0.07)], DARKMETAL)
    }
    // The wipers, the antenna, a side repeater, the fuel cap, the exhaust (the finer tier).
    if (d >= 2) {
      for (const z of [-0.3, 0.25]) k.box([0.03, 0.025, 0.46], [rx1 + c.front - 0.06, c1 + 0.04, z], BLACK, [0, 0.25, 0], false)
      k.box([0.015, 0.4, 0.015], [rx0 + 0.25, top + 0.2, -cw * 0.3], BLACK, [0, 0, 0.25], false)
      for (const s of [1, -1]) k.box([0.08, 0.035, 0.01], [hl - 0.72, c1 - 0.16, s * (wide / 2 + 0.008)], AMBER, undefined, false)
      k.box([0.14, 0.1, 0.01], [-hl + 0.8, c1 - 0.18, wide / 2 + 0.006], paint(0.9), undefined, false)
      k.cyl(0.04, 0.16, [-hl - 0.02, c0 + 0.02, -wide / 2 + 0.35], 8, CHROME, R.chrome, [0, Math.PI / 2, 0])
    }
    // The inside, seen through the glass: one's own ride (its people are real Sims), or on « normal »
    // and « haute » every car's (its light glass shows it), with a driver at the wheel.
    if (opt.clear || d >= 1) cabin(k, c, !!opt.clear, opt.plate)
  }

  // The 4×4's bull bar, its spare wheel on the tailgate.
  if (c.bullbar) {
    const bar = DARKMETAL
    for (const s of [1, -1]) {
      k.box([0.07, 0.62, 0.07], [hl + 0.22, c0 + 0.2, s * 0.42], bar)
      if (!low) k.box([0.07, 0.07, 0.36], [hl + 0.22, c0 + 0.46, s * 0.62], bar)
    }
    k.box([0.07, 0.07, 0.92], [hl + 0.22, c0 + 0.48, 0], bar)
    if (!low) k.box([0.07, 0.07, 0.92], [hl + 0.22, c0 + 0.14, 0], bar)
  }
  if (c.spare) {
    k.cyl(r, 0.26, [-hl - 0.16, c0 + 0.62, 0], low ? 8 : 12, { reg: R.matte, c: '#3a3d42' }, R.tread, [0, Math.PI / 2, 0])
    if (!low) k.cyl(r * 0.82, 0.04, [-hl - 0.3, c0 + 0.62, 0], 12, solid(R.matte, '#24262a'), R.matte, [0, Math.PI / 2, 0])
  }
  // The pick-up's bed: its sides and tailgate over the body, a black floor, the sport bar behind the cab.
  if (c.bed) {
    const bx1 = rx0 - 0.08
    const bl = bx1 + hl
    const bx = (bx1 - hl) / 2
    for (const s of [1, -1]) k.box([bl, 0.34, 0.1], [bx, c1 + 0.17, s * (wide / 2 - 0.05)], paint())
    k.box([0.12, 0.34, wide - 0.1], [-hl + 0.06, c1 + 0.17, 0], paint())
    k.box([bl - 0.1, 0.02, wide - 0.2], [bx, c1 + 0.01, 0], solid(R.plastic, '#15171b'), undefined, false)
    for (const s of [1, -1]) k.box([0.1, 0.9, 0.1], [rx0 - 0.25, c1 + 0.45, s * (wide / 2 - 0.2)], BLACK)
    k.box([0.1, 0.1, wide - 0.3], [rx0 - 0.25, c1 + 0.88, 0], BLACK)
    k.box([0.6, 0.08, wide * 0.62], [hl - 0.05, c0 - 0.08, 0], CHROME)
  }
  // The hypercar's wing on its struts, the chrome curve down its flanks, the intake behind the door.
  if (c.wing) {
    for (const s of [1, -1]) k.box([0.12, 0.22, 0.05], [-hl + 0.25, c1 + 0.12, s * 0.5], paint2())
    k.box([0.36, 0.04, wide - 0.2], [-hl + 0.22, c1 + 0.24, 0], paint2())
    for (const s of [1, -1]) {
      k.box([0.07, top - c0 - 0.1, 0.02], [-0.55, (c0 + top) / 2, s * (wide / 2 + 0.01)], CHROME, undefined, false)
      k.box([1.5, 0.05, 0.02], [0.2, c0 + 0.08, s * (wide / 2 + 0.01)], CHROME, undefined, false)
      k.box([0.5, 0.3, 0.01], [-0.85, (c0 + c1) / 2 + 0.05, s * (wide / 2 + 0.005)], solid(R.plastic, '#0b0c0f'), undefined, false)
    }
  }
  const at: WheelAt[] = []
  for (const a of c.axles) for (const s of [1, -1] as const) at.push([a, r, s * (wide / 2 - 0.1), a > 0, s])
  return at
}

/** The driver's shirt (a few, by the car's variant), his skin. */
const SHIRTS = ['#2f5d8a', '#e9ecef', '#8a2f2f', '#3d6b3d']
const SKIN = '#5a3a24'

/**
 * A car's inside (left-hand drive: the driver at z -0.36): the dashboard (its top pad, the dials and the
 * radio on its face, the console under it), the steering wheel on its column, the seats. `own`: one's
 * own ride, whose people are real Sims (low seat backs, no driver drawn); else a driver in a few blocks.
 */
function cabin(k: Kit, c: Car, own: boolean, variant: number) {
  const [rx0, rx1] = c.roof
  const { c1, top } = c
  const cw = c.wide - 0.16
  const cabH = top - c1
  const x0 = rx1 + c.front * 0.12 - 0.05
  const x1 = rx1 + c.front * 0.8
  // The dashboard: a lighter top pad than a dark slab, its face fitted with the dials, the console under it.
  k.box([x1 - x0, 0.2, cw - 0.06], [(x0 + x1) / 2, c1 - 0.02, 0], solid(R.interior, '#4a4540'), undefined, false)
  k.box([0.012, 0.17, cw - 0.12], [x0 - 0.006, c1 - 0.025, 0], fitted(R.dash, [NX], '#ffffff', R.interior), undefined, false)
  k.box([0.3, 0.3, 0.22], [x0 - 0.12, c1 - 0.24, 0], solid(R.interior, '#2e2b28'), undefined, false)
  // The steering wheel, tilted to the driver, and its column into the dash.
  const sx = x0 - 0.1
  const sy = c1 + Math.min(0.12, cabH * 0.2)
  k.cyl(0.17, 0.035, [sx, sy, -0.36], 12, { reg: R.steer, c: '#ffffff' }, R.tread, [0, Math.PI / 2, -0.45], 'ZYX')
  k.box([0.2, 0.05, 0.05], [sx + 0.1, sy - 0.04, -0.36], BLACK, [0, 0, -0.45], false)
  // The seats: low backs in one's own ride (the Sims inside stay in sight), headrests in the others.
  const seat = solid(R.seat, ['#3b3530', '#2a2d33', '#5a4632', '#3a3f4a'][variant % 4])
  const seatX = -0.14
  const backH = own ? 0.3 : cabH * 0.6
  for (const s of [1, -1]) {
    k.box([0.1, backH, 0.46], [seatX, c1 - 0.06 + backH / 2, s * 0.38], seat, [0, 0, own ? 0 : -0.12], false)
    if (!own) {
      k.box([0.44, 0.1, 0.46], [seatX + 0.24, c1 - 0.12, s * 0.38], seat, undefined, false)
      k.box([0.08, 0.13, 0.24], [seatX - 0.04, c1 - 0.04 + backH + 0.08, s * 0.38], seat, undefined, false)
    }
  }
  if (!c.wing) k.box([0.12, own ? 0.3 : cabH * 0.5, cw - 0.12], [rx0 + 0.05 - (c.rear > 0.08 ? 0 : -0.1), c1 - 0.06 + (own ? 0.15 : cabH * 0.25), 0], seat, undefined, false)
  if (own) return
  // The driver: his back to the seat, his head under the roof, his hands on the wheel.
  const shirt = solid(R.matte, SHIRTS[variant % SHIRTS.length])
  const tx = seatX + 0.16
  k.box([0.22, cabH * 0.55, 0.36], [tx, c1 - 0.04 + cabH * 0.275, -0.36], shirt, undefined, false)
  k.box([0.17, 0.19, 0.16], [tx + 0.02, c1 + cabH * 0.66, -0.36], solid(R.matte, SKIN), undefined, false)
  for (const s of [1, -1]) k.box([sx - tx - 0.06, 0.07, 0.07], [(sx + tx) / 2 + 0.03, sy - 0.02, -0.36 + s * 0.14], shirt, undefined, false)
}

/* ---------- The gbaka ---------- */

function gbakaBody(k: Kit, glass: Glass, glassPrism: (pts: [number, number][], d: number, c: string) => void, d: number, low: boolean, plate: number, motto: number): WheelAt[] {
  const [len, wide, r] = [5.3, 1.9, 0.36]
  const hl = len / 2
  const [c0, c1, top] = [0.42, 1.2, 2.0]
  const cw = wide - 0.1
  const side = low ? paint() : SIDE
  // The body below the windows, the windows' band, the roof: the stripe (second paint) and a white line.
  k.box([len, c1 - c0, wide], [0, (c0 + c1) / 2, 0], side)
  k.box([len + 0.02, 0.18, wide + 0.02], [-0.0, 1.06, 0], paint2())
  if (!low) k.box([len + 0.02, 0.03, wide + 0.03], [0, 1.165, 0], solid(R.matte, '#f5f5ef'), undefined, false)
  // The cabin: glass all round (the front sloped), the pillars and the roof in the paint.
  const frontX = hl - 0.45
  glass([frontX + hl - 0.08, top - c1 - 0.1, cw + 0.02], [(frontX - hl) / 2 + 0.02, (c1 + top) / 2 - 0.02, 0], GLASS)
  // The sloped front: the windscreen and the cab's side windows in one piece, the pillars on it.
  glassPrism([[frontX - 0.04, c1 - 0.02], [hl - 0.01, c1 - 0.02], [frontX - 0.04, top - 0.06]], cw, SCREEN)
  const fs = { len: Math.hypot(hl - frontX, top - c1), ang: Math.atan2(hl - frontX, top - c1) }
  if (!low) for (const s of [1, -1]) k.box([0.08, fs.len, 0.06], [(frontX + hl) / 2, (c1 + top) / 2, s * (cw / 2 + 0.01)], paint(), [0, 0, fs.ang])
  k.box([len - 0.4, 0.1, wide], [-0.2, top - 0.05, 0], paint(0.97))
  if (!low) for (const x of [frontX - 0.05, 0.45, -0.6, -1.65, -hl + 0.06]) for (const s of [1, -1]) if (!(s > 0 && x === 0.45)) k.box([0.1, top - c1, 0.06], [x, (c1 + top) / 2, s * (cw / 2 + 0.01)], paint())
  // The sliding door, open: the dark doorway down to the step, the seats inside, the door slid back.
  const [dx0, dx1] = [0.5, 1.45]
  k.box([dx1 - dx0, top - c0 - 0.2, 0.04], [(dx0 + dx1) / 2, (c0 + 0.1 + top - 0.1) / 2, wide / 2 + 0.005], INTERIOR)
  if (!low) {
    for (const x of [0.75, 1.2]) k.box([0.1, 0.5, 0.02], [x, c1 + 0.1, wide / 2 + 0.03], SEAT, undefined, false)
    k.box([dx1 - dx0 - 0.1, 0.06, 0.03], [(dx0 + dx1) / 2, c1 - 0.12, wide / 2 + 0.03], SEAT, undefined, false)
    k.box([dx1 - dx0, 0.05, 0.3], [(dx0 + dx1) / 2, c0 + 0.02, wide / 2 + 0.12], DARKMETAL)
  }
  k.box([dx1 - dx0, top - c0 - 0.2, 0.04], [(dx0 + dx1) / 2 - 1.0, (c0 + 0.1 + top - 0.1) / 2, wide / 2 + 0.05], paint())
  // The roof rack, loaded: sacks, a bundle, jerrycans, held down with rope.
  const [rx0, rx1] = [-2.2, 1.4]
  for (const s of [1, -1]) k.box([rx1 - rx0, 0.05, 0.05], [(rx0 + rx1) / 2, top + 0.14, s * (cw / 2 - 0.05)], DARKMETAL, undefined, false)
  if (!low) for (let i = 0; i <= 5; i++) for (const s of [1, -1]) k.box([0.04, 0.14, 0.04], [rx0 + ((rx1 - rx0) * i) / 5, top + 0.07, s * (cw / 2 - 0.05)], DARKMETAL, undefined, false)
  const load: [number, number, number, number, number, string, Reg][] = [
    [-1.75, 0.8, 0.42, 1.2, 0, '#7a5230', R.sack],
    [-0.85, 0.75, 0.34, 0.9, 0.2, '#2a6cf0', R.cloth],
    [0.0, 0.8, 0.46, 1.25, 0, '#c92a2a', R.cloth],
    [0.85, 0.5, 0.36, 0.45, 0.4, '#f2c230', R.matte],
    [0.85, 0.5, 0.36, 0.45, -0.4, '#f2c230', R.matte],
  ]
  for (const [x, l, h, w, z, col, reg] of low ? load.slice(0, 3) : load) k.box([l, h, w], [x, top + 0.04 + h / 2, z], { reg: R.matte, c: col, fit: { faces: [PX, NX, PY, PZ, NZ], reg } })
  if (d >= 2) {
    k.box([0.5, 0.3, 0.6], [-1.75, top + 0.6, 0.1], { reg: R.matte, c: '#d9c9a0', fit: { faces: [PX, NX, PY, PZ, NZ], reg: R.sack } }, [0, 0.3, 0])
    for (const x of [-1.3, 0.4]) k.box([0.03, 0.02, cw], [x, top + 0.5, 0], solid(R.matte, '#6b5a3a'), undefined, false)
  }
  // Lamps, the bumpers (bright metal), the grille, the plates, the motto on the back, the mirrors on their arms.
  for (const s of [1, -1]) {
    k.box([0.05, 0.16, 0.3], [hl + 0.005, 0.85, s * (wide / 2 - 0.25)], HEADLAMP)
    k.box([0.05, 0.3, 0.2], [-hl - 0.005, 0.95, s * (wide / 2 - 0.15)], TAILLAMP)
    k.box([0.18, 0.2, wide + 0.04], [s * (hl + 0.05), c0 + 0.08, 0], solid(R.metal, '#cfd2d4'))
    if (!low) k.box([0.04, 0.06, 0.1], [hl + 0.004, 0.72, s * (wide / 2 - 0.08)], AMBER, undefined, false)
    if (!low) k.box([0.12, 0.2, 0.08], [frontX + 0.15, c1 + 0.2, s * (wide / 2 + 0.2)], BLACK)
    if (!low) k.box([0.04, 0.04, 0.22], [frontX + 0.15, c1 + 0.1, s * (wide / 2 + 0.1)], BLACK, undefined, false)
  }
  k.box([0.04, 0.2, 0.7], [hl + 0.012, 0.62, 0], fitted(R.grille, [PX], '#ffffff', R.plastic))
  k.box([0.02, 0.11, 0.5], [hl + 0.15, c0 + 0.08, 0], fitted(R.plates[plate % 4], [PX]), undefined, false)
  k.box([0.02, 0.11, 0.5], [-hl - 0.15, c0 + 0.08, 0], fitted(R.plates[plate % 4], [NX]), undefined, false)
  if (!low) k.box([0.01, 0.18, wide - 0.4], [-hl - 0.006, c1 - 0.3, 0], fitted(R.mottos[motto % R.mottos.length], [NX]), undefined, false)
  else glass([0.02, top - c1 - 0.2, cw], [-hl, (c1 + top) / 2, 0], GLASS)
  if (low) for (const a of [-1.75, 1.75]) farWheel(k, r, wide + 0.04, [a, r, 0])
  if (!low) for (const a of [-1.75, 1.75]) k.box([r * 2 + 0.06, 0.1, wide - 0.1], [a, c0 + 0.03, 0], RUBBER, undefined, false)
  const at: WheelAt[] = []
  for (const a of [1.75, -1.75]) for (const s of [1, -1] as const) at.push([a, r, s * (wide / 2 - 0.1), a > 0, s])
  return at
}

/* ---------- The SITRA bus (and the coaches up country) ---------- */

function busBody(k: Kit, glass: Glass, d: number, low: boolean, coach: boolean, plate: number): WheelAt[] {
  const [len, wide, r] = [11, 2.5, 0.5]
  const hl = len / 2
  const [c0, c1, top] = [0.45, 1.6, 3.05]
  const side = low ? paint() : SIDE
  k.box([len, c1 - c0, wide], [0, (c0 + c1) / 2, 0], side)
  // The skirt (second paint: green, or the company's colour) and the band over it (orange; black on a coach).
  k.box([len + 0.02, 0.62, wide + 0.02], [0, 0.78, 0], low ? paint2() : SIDE2)
  k.box([len + 0.03, 0.14, wide + 0.03], [0, 1.16, 0], solid(R.paint, coach ? '#1c1c1e' : '#ff7a00'))
  // Windows all along (the glass core), the pillars between, the roof.
  glass([len - 0.3, top - c1 - 0.3, wide - 0.06], [-0.1, (c1 + top - 0.25) / 2, 0], GLASS)
  glass([0.03, top - 1.0 - 0.32, wide - 0.2], [hl + 0.005, (1.0 + top - 0.32) / 2, 0], SCREEN)
  k.box([len, 0.28, wide], [0, top - 0.14, 0], paint(0.98))
  const posts = low ? [] : [-4.6, -3.6, -2.6, -1.6, -0.6, 0.4, 1.4, 2.4, 3.4]
  for (const x of posts) for (const s of [1, -1]) if (!(s > 0 && (Math.abs(x - 4.2) < 0.6 || Math.abs(x + 0.6) < 0.6))) k.box([0.12, top - c1 - 0.28, 0.04], [x, (c1 + top - 0.28) / 2, s * (wide / 2 - 0.01)], paint())
  k.box([0.3, top - c1, wide], [-hl + 0.15, (c1 + top) / 2, 0], paint())
  k.box([0.3, 0.35, wide], [hl - 0.15, 0.82 + 0.17, 0], paint())
  // The two doors on the kerb side: glass in black frames.
  for (const x of [4.2, -0.6]) {
    glass([1.0, 2.1, 0.03], [x, 1.55, wide / 2 + 0.012], GLASS)
    if (!low) {
      for (const e of [-1, 1]) k.box([0.06, 2.2, 0.04], [x + e * 0.53, 1.55, wide / 2 + 0.015], BLACK, undefined, false)
      k.box([0.03, 2.1, 0.04], [x, 1.55, wide / 2 + 0.02], BLACK, undefined, false)
    }
  }
  // The line's sign over the windscreen, lit; the roof's air box; the lamps, the bumpers, the mirrors on their arms.
  k.box([0.05, 0.3, wide - 0.5], [hl + 0.02, top - 0.17, 0], { reg: R.lit, c: '#ffffff', fit: { faces: [PX], reg: R.busLine } })
  k.box([3.2, 0.22, 1.6], [-1, top + 0.11, 0], solid(R.matte, '#dfe3e8'))
  if (!low) k.box([3.0, 0.03, 1.4], [-1, top + 0.235, 0], fitted(R.slats, [PY], '#dfe3e8'), undefined, false)
  for (const s of [1, -1]) {
    k.box([0.05, 0.2, 0.36], [hl + 0.005, 0.9, s * (wide / 2 - 0.3)], HEADLAMP)
    k.box([0.05, 0.36, 0.22], [-hl - 0.005, 1.0, s * (wide / 2 - 0.2)], TAILLAMP)
    k.box([0.18, 0.26, wide + 0.04], [s * (hl + 0.06), c0 + 0.1, 0], BLACK)
    if (!low) k.box([0.1, 0.36, 0.14], [hl - 0.05, 2.5, s * (wide / 2 + 0.38)], BLACK)
    if (!low) k.box([0.05, 0.05, 0.38], [hl - 0.05, 2.75, s * (wide / 2 + 0.2)], BLACK, undefined, false)
  }
  k.box([0.04, 0.3, 1.2], [hl + 0.012, 0.62, 0], fitted(R.grilleBus, [PX], '#ffffff', R.plastic))
  k.box([0.02, 0.11, 0.5], [hl + 0.16, c0 + 0.1, 0], fitted(R.plates[plate % 4], [PX]), undefined, false)
  k.box([0.02, 0.11, 0.5], [-hl - 0.16, c0 + 0.1, 0], fitted(R.plates[plate % 4], [NX]), undefined, false)
  if (!low) k.box([0.03, 0.8, wide - 0.6], [-hl - 0.005, 2.25, 0], solid(R.glassFar, GLASS), undefined, false)
  if (low) for (const a of [-3.6, 3.4]) farWheel(k, r, wide + 0.04, [a, r, 0])
  if (!low) for (const a of [-3.6, 3.4]) k.box([r * 2 + 0.06, 0.1, wide - 0.1], [a, c0 + 0.03, 0], RUBBER, undefined, false)
  void d
  const at: WheelAt[] = []
  for (const a of [3.4, -3.6]) for (const s of [1, -1] as const) at.push([a, r, s * (wide / 2 - 0.15), a > 0, s])
  return at
}

/* ---------- The moto ---------- */

function motoBody(k: Kit, d: number, low: boolean, crew: boolean): WheelAt[] {
  // A 125 cm³ as they run in the outer communes: the tank and side panels in the paint, a black seat, the
  // chrome fork and exhaust, the rack at the back (the moto-taxi's passenger's), the lit headlamp.
  const P = paint()
  k.box([0.46, 0.2, 0.26], [0.2, 0.84, 0], P)
  for (const s of [1, -1]) k.box([0.34, 0.2, 0.04], [-0.3, 0.64, s * 0.12], P)
  k.box([0.72, 0.1, 0.28], [-0.32, 0.84, 0], solid(R.seat, '#1d1d1f'))
  k.box([0.36, 0.3, 0.2], [-0.02, 0.48, 0], DARKMETAL)
  k.box([0.06, 0.04, 0.7], [0.5, 1.1, 0], BLACK, undefined, false)
  k.box([0.42, 0.04, 0.26], [-0.72, 0.86, 0], BLACK, undefined, false)
  k.box([0.9, 0.06, 0.06], [-0.1, 0.62, 0], BLACK, [0, 0, 0.25], false)
  k.box([0.5, 0.05, 0.14], [0.62, 0.62, 0], P, [0, 0, -0.5], false)
  k.box([0.12, 0.2, 0.18], [0.62, 0.95, 0], P)
  k.box([0.03, 0.1, 0.14], [0.685, 0.95, 0], HEADLAMP, undefined, false)
  k.box([0.03, 0.05, 0.1], [-0.94, 0.86, 0], TAILLAMP, undefined, false)
  for (const s of [1, -1]) k.box([0.05, 0.75, 0.05], [0.58, 0.66, s * 0.08], CHROME, [0, 0, 0.32], false)
  k.box([0.62, 0.07, 0.07], [-0.42, 0.42, 0.15], CHROME, [0, 0, 0.08], false)
  if (!low) {
    for (const s of [1, -1]) k.box([0.05, 0.4, 0.05], [-0.62, 0.48, s * 0.1], CHROME, [0, 0, -0.5], false)
    k.box([0.1, 0.1, 0.3], [-0.85, 0.52, 0], BLACK, undefined, false)
    k.box([0.02, 0.06, 0.18], [-0.9, 0.62, 0], fitted(R.plates[0], [NX]), undefined, false)
    if (d >= 1) for (const s of [1, -1]) k.box([0.06, 0.06, 0.06], [0.52, 1.1, s * 0.36], RUBBER, undefined, false)
    if (d >= 2) for (const s of [1, -1]) k.box([0.03, 0.12, 0.03], [0.48, 1.18, s * 0.26], CHROME, undefined, false)
  } else {
    for (const x of [0.62, -0.62]) farWheel(k, 0.3, 0.1, [x, 0.3, 0])
    // Far off, the rider is a few blocks in the moto's draw (the Sim itself only up close).
    if (crew) {
      k.box([0.3, 0.5, 0.34], [-0.25, 1.15, 0], solid(R.matte, '#3a5a8a'))
      k.box([0.24, 0.24, 0.22], [-0.2, 1.52, 0], solid(R.matte, '#5a3a24'))
      for (const s of [1, -1]) k.box([0.5, 0.14, 0.12], [0.0, 0.8, s * 0.14], solid(R.matte, '#2b2f36'))
    }
  }
  return [[0.62, 0.3, 0, true, 1], [-0.62, 0.3, 0, false, 1]]
}

/* ---------- The wheels ---------- */

const wheelCache = new Map<string, THREE.BufferGeometry>()
function wheelGeo(r: number, w: number, rim: Reg, hub: string, d: number) {
  const key = `${r}|${w}|${rim[0]}|${hub}|${d}`
  let g = wheelCache.get(key)
  if (g) return g
  const k = new Kit(0)
  const sides = d >= 1 ? 14 : 10
  k.cyl(r, w, [0, 0, 0], sides, { reg: rim, c: hub }, R.tread)
  // The hub's boss, standing out of the rim on both faces.
  if (d >= 1 && rim !== R.rimSpoke) k.cyl(r * 0.18, w + 0.03, [0, 0, 0], 8, { reg: R.chrome, c: '#c3c7cf' }, R.chrome)
  if (rim === R.rimSpoke) k.cyl(0.07, w + 0.06, [0, 0, 0], 8, { reg: R.chrome, c: '#c3c7cf' }, R.chrome)
  g = k.finish()
  wheelCache.set(key, g)
  return g
}

/* ---------- Built once per model ---------- */

const cache = new Map<string, Built>()
/** A model built (cached): its kind, the tier, see-through glass, far off (one draw), a variant (the plates, a gbaka's motto). */
export function buildModel(model: ModelKey, tier: Tier, clear: boolean, low: boolean, variant: number, crew = true): Built {
  const d = tier === 'simple' ? 0 : tier === 'normal' ? 1 : 2
  const key = `${model}|${low ? 'low' : d}|${clear ? 1 : 0}|${variant}|${crew && model === 'moto' && low ? 1 : 0}`
  let b = cache.get(key)
  if (b) return b
  const k = new Kit(low ? 0 : [0.2, 0.09, 0.05][d])
  const gk = low ? null : new Kit(0)
  const glass: Glass = (s, p, c, rot) => (gk ? gk.box(s, p, { reg: R.paint, c }, rot, false) : k.box(s, p, solid(R.glassFar, c), rot, false))
  const glassPrism = (pts: [number, number][], dz: number, c: string) => (gk ? gk.prism(pts, dz, 0, { reg: R.paint, c }) : k.prism(pts, dz, 0, solid(R.glassFar, c)))
  let at: WheelAt[]
  let r: number
  let len: number
  let wheel: THREE.BufferGeometry | null = null
  if (model === 'gbaka') {
    at = gbakaBody(k, glass, glassPrism, d, low, variant, variant)
    r = 0.36
    len = 5.3
    if (!low) wheel = wheelGeo(r, 0.26, R.rimSteel, '#ffffff', d)
  } else if (model === 'sotra' || model === 'coach') {
    at = busBody(k, glass, d, low, model === 'coach', variant)
    r = 0.5
    len = 11
    if (!low) wheel = wheelGeo(r, 0.3, R.rimSteel, '#ffffff', d)
  } else if (model === 'moto') {
    at = motoBody(k, d, low, crew)
    r = 0.3
    len = 1.9
    if (!low) wheel = wheelGeo(r, 0.1, R.rimSpoke, '#ffffff', d)
  } else {
    const spec = CARS[model === 'taxi' || model === 'woro' ? 'saloon' : model]
    // The private saloon has alloys; the taxis and woro-woros keep steel wheels.
    const c = model === 'saloon' ? { ...spec, hub: 'alloy' as const } : spec
    at = low ? farCar(k, c, { taxi: model === 'taxi', band: model === 'woro' }) : carBody(k, glassPrism, c, d, low, { taxi: model === 'taxi', band: model === 'woro', clear: clear && !low, plate: variant, number: variant })
    r = c.r
    len = c.len
    if (!low) wheel = wheelGeo(r, c.tyre, c.hub === 'alloy' ? R.rimAlloy : R.rimSteel, c.hubColor ?? '#ffffff', d)
  }
  const body = k.finish()
  const g = gk && gk.tris ? gk.finish() : null
  const fronts = at.filter((w) => w[3]).map((w) => w[0])
  const backs = at.filter((w) => !w[3]).map((w) => w[0])
  const base = fronts.length && backs.length ? Math.max(...fronts) - Math.min(...backs) : 2.6
  const wheelTris = wheel ? ((wheel.index?.count ?? 0) / 3) * at.length : 0
  b = { body, glass: g, wheel, wheels: at, r, base, len, tris: k.tris + (gk?.tris ?? 0) + wheelTris }
  cache.set(key, b)
  return b
}

/* ---------- The bicycle ---------- */

export type BuiltBike = {
  body: THREE.BufferGeometry
  /** One wheel (drawn twice, turning), the crank with its pedals (turning): null far off, where they're in the body. */
  wheel: THREE.BufferGeometry | null
  crank: THREE.BufferGeometry | null
  tris: number
}
/** Where the bike's parts are (vehicles.tsx Bicycle turns them; the rider's pose sits on the same saddle and bars as before). */
export const BIKE = { wheelX: 0.52, wheelY: 0.34, wheelR: 0.35, crank: [-0.05, 0.38] as [number, number] }

const bikes = new Map<string, BuiltBike>()
/**
 * A bicycle as the hire stations' and the Sims' own (nose towards +x): the frame in its paint (top,
 * down and seat tubes, the stays, the head tube), the fork, the bars and their grips, the saddle on its
 * post, the chain wheel and the chain to the rear sprocket, the kickstand; a basket in front (the hire
 * bikes'), or a rack behind. Up close the wheels (spokes cut out of a disc) and the crank are apart, to
 * turn; far off, the whole in one draw with flat two-tone wheels. Same saddle, bars and crank as the old
 * bike, so the riding pose lines up.
 */
export function buildBike(tier: Tier, low: boolean, basket: boolean): BuiltBike {
  const key = `${tier}|${low ? 1 : 0}|${basket ? 1 : 0}`
  let b = bikes.get(key)
  if (b) return b
  const k = new Kit(0)
  const P = paint()
  const DARK = solid(R.plastic, '#1b1b20')
  const METAL = solid(R.chrome, '#c3c7cf')
  const tube = (a: [number, number], c: [number, number], z: number, t: number, m: Mat) => {
    const [dx, dy] = [c[0] - a[0], c[1] - a[1]]
    k.box([Math.hypot(dx, dy) + t * 0.6, t, t], [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, z], m, [0, 0, Math.atan2(dy, dx)], false)
  }
  const bb = BIKE.crank
  const seat: [number, number] = [-0.18, 0.84]
  const headTop: [number, number] = [0.43, 0.88]
  const headLow: [number, number] = [0.46, 0.68]
  const rear: [number, number] = [-BIKE.wheelX, BIKE.wheelY]
  const front: [number, number] = [BIKE.wheelX, BIKE.wheelY]
  // The frame.
  tube(seat, headTop, 0, 0.05, P)
  tube(bb, headLow, 0, 0.055, P)
  tube(bb, seat, 0, 0.05, P)
  tube(headLow, headTop, 0, 0.06, P)
  if (!low)
    for (const s of [1, -1]) {
      tube(bb, rear, s * 0.045, 0.03, P)
      tube([seat[0] + 0.01, seat[1] - 0.04], rear, s * 0.045, 0.03, P)
      tube(headLow, front, s * 0.05, 0.03, METAL)
    }
  else {
    tube(bb, rear, 0, 0.04, P)
    tube(seat, rear, 0, 0.04, P)
    tube(headLow, front, 0, 0.04, METAL)
  }
  // The stem, the bars and their grips; the seat post and the saddle (wide behind, a nose in front).
  tube(headTop, [0.48, 1.06], 0, 0.04, METAL)
  k.box([0.05, 0.05, 0.56], [0.48, 1.08, 0], low ? DARK : METAL, undefined, false)
  if (!low) for (const s of [1, -1]) k.box([0.06, 0.06, 0.12], [0.48, 1.08, s * 0.25], DARK, undefined, false)
  tube(seat, [-0.2, 0.88], 0, 0.03, METAL)
  k.box([0.16, 0.06, 0.16], [-0.24, 0.9, 0], DARK, undefined, false)
  k.box([0.14, 0.05, 0.07], [-0.12, 0.9, 0], DARK, undefined, false)
  if (!low) {
    // The chain wheel, the chain's two runs to the sprocket, the kickstand, the mudguards, the reflector.
    k.cyl(0.1, 0.015, [bb[0], bb[1], 0.07], 14, { reg: R.metal, c: '#8a9098' }, R.metal)
    k.cyl(0.045, 0.015, [rear[0], rear[1], 0.07], 10, { reg: R.metal, c: '#8a9098' }, R.metal)
    tube([bb[0], bb[1] + 0.1], [rear[0], rear[1] + 0.045], 0.07, 0.014, DARKMETAL)
    tube([bb[0], bb[1] - 0.1], [rear[0], rear[1] - 0.045], 0.07, 0.014, DARKMETAL)
    tube([-0.14, 0.36], [-0.2, 0.02], -0.07, 0.025, DARK)
    k.box([0.36, 0.015, 0.06], [-0.48, 0.73, 0], DARK, [0, 0, -0.2], false)
    k.box([0.3, 0.015, 0.06], [0.56, 0.72, 0], DARK, [0, 0, 0.25], false)
    k.box([0.02, 0.04, 0.05], [-0.88, 0.62, 0], solid(R.reflector, '#ff3030'), undefined, false)
  }
  // A basket in front (wire, on its stays), or a rack over the back wheel.
  if (basket) {
    const bas: Mat = { reg: R.matte, c: '#ffffff', fit: { faces: [PX, NX, PZ, NZ, PY], reg: R.weave } }
    if (low) k.box([0.26, 0.2, 0.34], [0.62, 0.95, 0], solid(R.matte, '#3a3a3e'), undefined, false)
    else {
      for (const s of [1, -1]) k.box([0.26, 0.2, 0.012], [0.62, 0.95, s * 0.17], bas, undefined, false)
      for (const s of [1, -1]) k.box([0.012, 0.2, 0.34], [0.62 + s * 0.13, 0.95, 0], bas, undefined, false)
      k.box([0.26, 0.012, 0.34], [0.62, 0.855, 0], solid(R.matte, '#3a3a3e'), undefined, false)
      tube([0.5, 0.86], [0.52, 0.4], 0, 0.015, METAL)
    }
  } else if (!low) {
    k.box([0.36, 0.02, 0.14], [-0.5, 0.78, 0], DARKMETAL, undefined, false)
    for (const s of [1, -1]) tube([-0.66, 0.78], rear, s * 0.06, 0.015, DARKMETAL)
  }
  let wheel: THREE.BufferGeometry | null = null
  let crank: THREE.BufferGeometry | null = null
  if (low) {
    farWheel(k, BIKE.wheelR, 0.04, [rear[0], rear[1], 0])
    farWheel(k, BIKE.wheelR, 0.04, [front[0], front[1], 0])
  } else {
    // A wheel: its tyre, the spoked disc (the spokes' material cuts the clear between them), the hub.
    const w = new Kit(0)
    w.cyl(BIKE.wheelR, 0.04, [0, 0, 0], tier === 'simple' ? 14 : 20, { reg: R.rimBike, c: '#ffffff' }, R.tread)
    w.cyl(0.035, 0.1, [0, 0, 0], 8, { reg: R.chrome, c: '#c3c7cf' }, R.chrome)
    wheel = w.finish()
    // The crank about its axle: the arms on either side, the pedals with their reflectors.
    const c = new Kit(0)
    c.box([0.04, 0.04, 0.14], [0, 0, 0], METAL, undefined, false)
    for (const s of [1, -1]) {
      c.box([0.2, 0.03, 0.02], [s * 0.09, 0, s * 0.085], METAL, undefined, false)
      c.box([0.1, 0.03, 0.1], [s * 0.18, 0, s * 0.13], DARK, undefined, false)
      c.box([0.02, 0.02, 0.06], [s * 0.18 + 0.05, 0, s * 0.13], solid(R.amber, '#ffffff'), undefined, false)
    }
    crank = c.finish()
  }
  const body = k.finish()
  b = { body, wheel, crank, tris: k.tris + (wheel ? (wheel.index!.count / 3) * 2 : 0) + (crank ? crank.index!.count / 3 : 0) }
  bikes.set(key, b)
  return b
}
