import * as THREE from 'three'
import type { Look } from '../../lib/types'
import { HEADWEAR, TALL_HAIR, UNIFORM_HATS, VEILED, accessoryColor, defaultColors, hasAcc, headwearOf } from '../options'
import { tint } from '../textures'
import { Kit, TX, frontness, type F, type Paint, type V3 } from './atlas'
import { grain, hairPx, hash, headPaint, isSide, shellPaint, waxBig, wearPx } from './paint'
import { FOREARM, HIP_Y, SHADE, SHIN, SKIN, THIGH, TOP, TORSO_BOTTOM, UPPER_ARM, WAIST_Y, dressFor, outer, outfitOf, type Dims, type LL, type TL } from './outfits'

// Builds one look of the detailed Sim (DetailHuman): every box of every body
// segment, painted into one atlas, merged into one mesh per segment, cached
// per look so every Sim dressed the same (the street's NPCs) shares it.

/** The head cube (BlockHuman's) and its hair layer, a texel bigger all round. */
export const H = 0.32
const SHELL = 0.34
export const NECK_Y = 1.36
export const SHOULDER_Y = 1.3
const BODY: Record<string, { w: number; limb: number; depth: number }> = {
  mince: { w: 0.88, limb: 0.88, depth: 0.9 },
  moyen: { w: 1, limb: 1, depth: 1 },
  fort: { w: 1.15, limb: 1.16, depth: 1.1 },
  rond: { w: 1.2, limb: 1.12, depth: 1.28 },
}
const GREY = '#d8d2c8'

export type Built = { material: THREE.Material; geos: Record<string, THREE.BufferGeometry>; boxes: number; tris: number; loose: boolean; d: Dims; atlas: number; /** The face's 16×16 texels as painted (the expressions: avatar/face.tsx). */ face?: Uint8ClampedArray }
export type BuildOpts = { femme: boolean; /** Accessories and beards off (a child seen in the street). */ young: boolean; /** A child's face (big head). */ child: boolean; /** On the toilets: the trousers down, the skirt hitched up. */ loo?: boolean }

const cache = new Map<string, Built>()
let built = 0
let spent = 0
/** How many looks have been built, and the milliseconds it took (the lab's counter). */
export const builtCount = () => built
export const builtMs = () => Math.round(spent)

function materialOf(t: THREE.Texture) {
  // alphaTest: the hair layer and the glasses' frames are see-through where there is nothing.
  return new THREE.MeshLambertMaterial({ map: t, alphaTest: 0.5 })
}

const skinP = (skin: string): Paint => (_f, _x, _y, _w, _h, ax, ay) => grain(skin, ax, ay, 0.025)
const knitP = (c: string): Paint => (_f, _x, _y, _w, _h, ax, ay) => (ax % 2 ? tint(c, -0.12) : grain(c, ax, ay, 0.08))
const clothP = (c: string, k = 0.06): Paint => (_f, _x, _y, _w, _h, ax, ay) => grain(c, ax, ay, k)

/* ---------- The head ---------- */

type HeadOpts = { femme: boolean; young: boolean; child: boolean; loose?: (v: boolean) => void }

/** The head cube, its nose and ears, the hair, the beard, what's on the head and the glasses. Sizes go with the head (a baby's is smaller). */
function addHead(k: Kit, l: Required<Look>, o: HeadOpts, size = H, seg = 'head', hangSeg = 'hang') {
  const z = size / H // the baby's head is smaller: everything on it too
  const S = SHELL * z
  const { femme, young, child } = o
  const skin = l.skin
  const outfit = outfitOf(l, femme)
  const acc = (id: string) => !young && hasAcc(l, id)
  const hw = headwearOf(l)
  const capOn = !young && HEADWEAR.has(hw) && hw !== 'headphones' && hw !== 'bandana'
  const veiled = femme && VEILED.has(l.outfit)
  const kufiOn = !young && (hasAcc(l, 'kufi') || (outfit === 'imam' && !HEADWEAR.has(hw)))
  const uniformHat = !young && !HEADWEAR.has(hw) ? UNIFORM_HATS[outfit] : undefined
  const style = veiled ? 'covered' : (capOn || kufiOn || uniformHat) && TALL_HAIR.has(l.hair) ? 'short' : l.hair
  const beard = young || child ? 'none' : l.beard
  const shades = acc('sunglasses')
  const elder = !child && l.hairColor === GREY
  const t16: V3 = [16, 16, 16]
  k.add(seg, { s: [size, size, size], p: [0, size / 2, 0], t: t16, paint: headPaint(l, { femme, child, elder, beard, shades, marks: young ? 'none' : l.marks }), bevel: 0.4, face: true })
  // The nose: a block one texel proud of the face, lit on top, the nostrils underneath.
  k.add(seg, {
    s: [0.06 * z, 0.05 * z, 0.02 * z],
    p: [0, size - 10.25 * TX * z, size / 2 + 0.01 * z],
    t: [3, 3, 1],
    paint: (f, x, y) => (f === 'ny' ? (x === 1 ? tint(skin, -0.25) : tint(skin, -0.5)) : f === 'py' ? tint(skin, 0.12) : f === 'pz' ? (y === 2 ? (x === 1 ? tint(skin, -0.05) : tint(skin, -0.3)) : x === 1 ? tint(skin, 0.1) : skin) : tint(skin, -0.12)),
    bevel: 0,
  })
  for (const s of [-1, 1])
    k.add(seg, {
      s: [0.026 * z, 0.07 * z, 0.05 * z],
      p: [s * (size / 2 + 0.013 * z), size * 0.47, -0.01 * z],
      t: [1, 4, 3],
      paint: (f, x, y) => ((f === 'px' && s > 0) || (f === 'nx' && s < 0) ? (x === 1 && y > 0 && y < 3 ? tint(skin, -0.3) : tint(skin, -0.04)) : tint(skin, -0.1)),
      bevel: 0.6,
    })
  const hc = tint(l.hairColor, 0.08)
  const hp: Paint = (_f, _x, _y, _w, _h, ax, ay) => hairPx(style, hc, ax, ay)
  const box = (s: V3, p: V3, paint: Paint | string, r?: V3, bevel = 0.6, into = seg) => k.add(into, { s: [s[0] * z, s[1] * z, s[2] * z], p: [p[0] * z, p[1] * z, p[2] * z], r, paint, bevel })
  const hz = H // positions below are for the grown-up's head, scaled by z
  if (style !== 'bald' && style !== 'mohawk' && style !== 'covered' && style !== 'headwrap') k.add(seg, { s: [S, S, S], p: [0, size / 2, 0], t: [17, 17, 17], paint: shellPaint(style, hc, femme), bevel: 0.3 })
  if (style === 'bald' || style === 'mohawk') {
    // Shaved: the stubble's shadow on the scalp, as a layer just over the head.
    k.add(seg, {
      s: [size + 0.004, size + 0.004, size + 0.004],
      p: [0, size / 2, 0],
      t: [16, 16, 16],
      paint: (f, x, y, w, _h, ax, ay) => {
        if (f === 'ny') return null
        if (f === 'py') return grain(tint(skin, -0.2), ax, ay, 0.1)
        const rows = f === 'pz' ? 2 : f === 'nz' ? 7 : Math.round(7 - 4 * frontness(f, x, w))
        return y < rows && (y < rows - 1 || (x + y) % 2) ? grain(tint(skin, -0.18), ax, ay, 0.1) : null
      },
      bevel: 0,
    })
  }
  const strands = (n: number, sz: number, len: number, bead?: string, front = 0) => {
    o.loose?.(true)
    for (let i = 0; i < n; i++) {
      // Round the back from ear to ear, longer down the back; then a few framing the face.
      const a = (i / (n - 1) - 0.5) * Math.PI * 1.2
      const [x, zz] = [Math.sin(a) * SHELL * 0.56, Math.min(-Math.cos(a) * SHELL * 0.56, -SHELL * 0.1)]
      const ln = len * (0.8 + Math.cos(a) * 0.2 + (hash(i, 7) - 0.5) * 0.14)
      box([sz, ln, sz], [x, hz * 0.62 - ln / 2, zz], (f, xx, y, ww, hh, ax, ay) => (y >= hh - 1 ? tint(hc, 0.22) : hp(f, xx, y, ww, hh, ax, ay)), undefined, 0.3, hangSeg)
      if (bead) box([sz * 1.4, sz * 1.2, sz * 1.4], [x, hz * 0.62 - ln - sz * 0.5, zz], (_f, xx) => (xx === 0 ? tint(bead, 0.3) : bead), undefined, 0.5, hangSeg)
    }
    for (let i = 0; i < front; i++)
      for (const s of [-1, 1]) {
        const ln = len * (0.55 + i * 0.1)
        const x = s * (SHELL / 2 + sz / 2 - 0.004)
        box([sz, ln, sz], [x, hz * 0.66 - ln / 2, 0.02 - i * (sz + 0.006)], hp, undefined, 0.3, hangSeg)
        if (bead) box([sz * 1.4, sz * 1.2, sz * 1.4], [x, hz * 0.66 - ln - sz * 0.5, 0.02 - i * (sz + 0.006)], bead, undefined, 0.5, hangSeg)
      }
  }
  const flat = (s: V3, p: V3) => {
    // A hanging sheet of hair (weave, bob, ponytail), in its swaying segment.
    o.loose?.(true)
    box(s, p, (f, x, y, w, h, ax, ay) => (y >= h - 1 && isSide(f) && (x + y) % 2 ? tint(hc, 0.15) : hp(f, x, y, w, h, ax, ay)), undefined, 0.4, hangSeg)
  }
  switch (style) {
    case 'afro':
      // Round volume in steps: a wide middle, a narrower crown, the sides down to the ears.
      box([0.5, 0.16, 0.46], [0, H + 0.03, -0.03], hp)
      box([0.42, 0.08, 0.38], [0, H + 0.14, -0.03], hp)
      box([0.54, 0.12, 0.42], [0, H - 0.08, -0.06], hp)
      box([0.46, 0.1, 0.16], [0, H - 0.16, -0.17], hp)
      break
    case 'locks':
      box([SHELL + 0.02, 0.05, SHELL + 0.02], [0, H + 0.03, -0.004], hp, undefined, 0.5)
      strands(12, 0.05, 0.3, undefined, 1)
      break
    case 'twists':
      strands(13, 0.042, 0.18)
      break
    case 'braids':
    case 'nattes-perles':
      strands(style === 'braids' ? 15 : 11, style === 'braids' ? 0.034 : 0.04, style === 'braids' ? 0.46 : 0.3, style === 'braids' ? (femme ? '#e8b93c' : undefined) : '#f2b705', 2)
      break
    case 'weave':
      // Long and straight: down the back and the sides, past the shoulders.
      flat([SHELL + 0.02, 0.36, 0.05], [0, H * 0.62 - 0.18, -SHELL / 2 - 0.012])
      for (const s of [-1, 1]) flat([0.05, 0.3, SHELL * 0.72], [s * (SHELL / 2 + 0.012), H * 0.62 - 0.15, -SHELL * 0.16])
      break
    case 'bob':
      // The carré: to the jaw all round.
      flat([SHELL + 0.02, H * 0.52, 0.04], [0, H * 0.42, -SHELL / 2 - 0.01])
      for (const s of [-1, 1]) flat([0.04, H * 0.52, SHELL * 0.95], [s * (SHELL / 2 + 0.01), H * 0.42, -0.012])
      break
    case 'ponytail':
      // Pulled back, tied, the tail down the back.
      box([0.09, 0.09, 0.06], [0, H * 0.82, -SHELL / 2 - 0.02], hp)
      box([0.1, 0.03, 0.03], [0, H * 0.82, -SHELL / 2 - 0.05], l.accessoryColor || '#d6336c', undefined, 0.4)
      flat([0.08, 0.22, 0.07], [0, H * 0.5, -SHELL / 2 - 0.07])
      break
    case 'puffs':
      for (const s of [-1, 1]) {
        box([0.16, 0.14, 0.16], [s * 0.12, H + 0.06, -0.02], hp)
        box([0.12, 0.05, 0.12], [s * 0.12, H + 0.15, -0.02], hp)
        box([0.1, 0.022, 0.1], [s * 0.12, H + 0.002, -0.02], '#f783ac', undefined, 0.3)
      }
      break
    case 'couettes':
      // Two bunches above the ears, each tied with its pink bobble.
      for (const s of [-1, 1]) {
        box([0.11, 0.12, 0.11], [s * H * 0.74, H * 0.78, -H * 0.12], hp)
        box([0.035, 0.06, 0.06], [s * H * 0.56, H * 0.78, -H * 0.12], (_f, x) => (x === 0 ? '#ffa8c8' : '#f783ac'), undefined, 0.4)
      }
      break
    case 'bun':
      box([0.14, 0.12, 0.14], [0, H + 0.07, -0.06], hp)
      box([0.15, 0.025, 0.15], [0, H + 0.022, -0.06], tint(hc, -0.3), undefined, 0.3)
      break
    case 'degrade':
      box([SHELL - 0.02, 0.04, SHELL - 0.02], [0, H + 0.03, 0], hp)
      break
    case 'mohawk':
      // The iroquoise: a crest down the middle, front to back, higher in the middle.
      box([0.08, 0.06, SHELL], [0, H + 0.02, -0.01], hp)
      box([0.07, 0.06, SHELL * 0.7], [0, H + 0.075, -0.02], hp)
      break
    case 'headwrap': {
      // The foulard in the outfit's wax: wrapped round, high at the back, the knot and its fan in front.
      const c = l.outfitColor
      const fold: Paint = (f, _x, y, _ww, _hh, ax, ay) => {
        const base = waxBig(c, l.pattern, ax, ay)
        if (!isSide(f)) return base
        return y % 4 === 0 ? tint(base, -0.22) : y % 4 === 1 ? tint(base, 0.08) : base
      }
      box([SHELL + 0.01, 0.15, SHELL + 0.01], [0, H - 0.03, -0.002], fold)
      box([SHELL - 0.02, 0.12, SHELL + 0.03], [0, H + 0.1, -0.02], fold, [-0.12, 0, 0])
      box([0.26, 0.08, 0.2], [0, H + 0.19, -0.06], fold, [-0.2, 0, 0])
      box([0.1, 0.07, 0.07], [0, H + 0.08, SHELL / 2 + 0.01], fold)
      for (const s of [-1, 1]) box([0.12, 0.1, 0.03], [s * 0.07, H + 0.14, SHELL / 2 - 0.01], fold, [-0.3, 0, s * -0.6])
      break
    }
    case 'touffe':
      box([0.05 / z, 0.05 / z, 0.06 / z], [0, H + 0.03 / z, 0.04 / z], hp)
      break
    case 'covered': {
      // The veil: over the head, round the face, down onto the shoulders; the sister's white band.
      const nun = outfit === 'soeur'
      const veil = nun ? tint(l.outfitColor, -0.15) : l.bottomColor || tint(l.outfitColor, 0.12)
      const vp: Paint = (f, x, y, _w, h, ax, ay) => (isSide(f) && f !== 'pz' && y > 2 && x % 4 === 0 ? tint(veil, -0.1) : y === h - 1 && isSide(f) ? tint(veil, -0.14) : grain(veil, ax, ay, 0.05))
      box([H * 1.2, H * 0.32, H * 1.2], [0, H * 1.0, -H * 0.02], vp)
      for (const s of [-1, 1]) box([H * 0.14, H * 1.1, H * 1.1], [s * H * 0.6, H * 0.36, -H * 0.06], vp)
      box([H * 1.2, H * 1.15, H * 0.14], [0, H * 0.38, -H * 0.62], vp)
      box([H * 1.2, H * 0.22, H * 1.2], [0, -H * 0.12, 0], (f, x, y, w, h, ax, ay) => (f === 'pz' && Math.abs(x - (w - 1) / 2) < 3 && y < 2 ? tint(veil, -0.2) : vp(f, x, y, w, h, ax, ay)))
      if (nun) box([H * 1.16, H * 0.14, H * 1.16], [0, H * 0.84, 0.004], '#f8f9fa', undefined, 0.4)
      break
    }
  }
  if (beard === 'full' || beard === 'longue') box([0.2, beard === 'longue' ? 0.1 : 0.04, 0.04], [0, beard === 'longue' ? -0.03 : 0.004, H / 2 - 0.006], (_f, _x, _y, _ww, _hh, ax, ay) => grain(tint(l.hairColor, 0.05), ax, ay, 0.24), undefined, 0.5)
  if (beard === 'bouc') box([0.08, 0.04, 0.03], [0, 0.005, H / 2 - 0.004], (_f, _x, _y, _w, _h, ax, ay) => grain(tint(l.hairColor, 0.05), ax, ay, 0.24), undefined, 0.5)

  /* What's on the head. */
  const ac = (id: string) => accessoryColor(l, id)
  if (acc('cap') || acc('capback')) {
    // The cap: its panels' seams and eyelets, the visor (forward, or back to front), the button on top.
    const c = ac(hw)
    const zs = acc('capback') ? -1 : 1
    box([H * 1.17, H * 0.3, H * 1.17], [0, H * 0.99, 0], (f, x, y, w, _h, ax, ay) => (isSide(f) && x % 6 === 0 ? tint(c, -0.15) : f === 'py' && (x === Math.floor(w / 2) || y === Math.floor(w / 2)) ? tint(c, -0.15) : isSide(f) && y === 1 && x % 6 === 3 ? tint(c, -0.35) : grain(c, ax, ay, 0.05)))
    box([H * 0.92, H * 0.07, H * 0.46], [0, H * 0.86, zs * H * 0.78], (f, _x, y, _w, h) => (f === 'ny' ? tint(c, -0.4) : f === 'py' && (y === 0 || y === h - 1) ? tint(c, 0.1) : tint(c, -0.2)), undefined, 0.4)
    box([H * 0.14, H * 0.05, H * 0.14], [0, H * 1.16, 0], tint(c, -0.25), undefined, 0.2)
    if (zs < 0) box([H * 0.5, H * 0.08, 0.012], [0, H * 0.92, H * 0.59], tint(c, -0.3), undefined, 0.2)
  }
  if (acc('beanie')) {
    const c = ac('beanie')
    box([H * 1.16, H * 0.46, H * 1.16], [0, H * 0.93, 0], knitP(c), undefined, 0.5)
    box([H * 1.2, H * 0.14, H * 1.2], [0, H * 0.68, 0], (f, x) => (isSide(f) && x % 2 ? tint(c, -0.3) : tint(c, -0.2)), undefined, 0.5)
    box([H * 0.22, H * 0.18, H * 0.22], [0, H * 1.24, 0], (_f, _x, _y, _w, _h, ax, ay) => grain(tint(c, 0.3), ax, ay, 0.2), undefined, 0.5)
  }
  if (acc('hat')) {
    const c = ac('hat')
    box([H * 1.9, H * 0.06, H * 1.9], [0, H * 0.98, 0], (f, x, y) => (f === 'py' && (x + y) % 3 === 0 ? tint(c, -0.08) : c), undefined, 0.5)
    box([H * 1.08, H * 0.42, H * 1.08], [0, H * 1.2, 0], (f, x, y) => (isSide(f) && (x + y) % 3 === 0 ? tint(c, -0.08) : f === 'py' && x > 3 && x < 11 && y > 6 && y < 9 ? tint(c, -0.12) : c), undefined, 0.6)
    box([H * 1.1, H * 0.1, H * 1.1], [0, H * 1.05, 0], tint(c, -0.45), undefined, 0.3)
  }
  if (acc('couronne')) {
    const g = '#e6b422'
    box([H * 1.1, H * 0.16, H * 1.1], [0, H * 0.98, 0], (f, x) => (isSide(f) && x % 4 === 2 ? '#f6d860' : g), undefined, 0.4)
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4
      box([H * 0.15, H * (i % 2 ? 0.2 : 0.24), H * 0.15], [Math.sin(a) * H * 0.48, H * 1.15, Math.cos(a) * H * 0.48], g, undefined, 0.5)
    }
    box([H * 0.14, H * 0.12, H * 0.06], [0, H * 0.98, H * 0.56], (_f, x, y) => (x === 0 && y === 0 ? '#ff8aa0' : '#d81b3f'), undefined, 0.2)
  }
  if (acc('buckethat')) {
    const c = ac('buckethat')
    box([H * 1.14, H * 0.38, H * 1.14], [0, H * 1.08, 0], (f, x, y, _w, _h, ax, ay) => (isSide(f) && y % 3 === 2 ? tint(c, -0.1) : f === 'py' && x % 4 === 0 ? tint(c, -0.08) : grain(c, ax, ay, 0.05)))
    box([H * 1.5, H * 0.06, H * 1.5], [0, H * 0.86, 0], (f, x, y) => (f === 'py' && (Math.min(x, y) < 3 || Math.max(x, y) > 20) && (x + y) % 2 ? tint(c, -0.2) : tint(c, -0.12)), undefined, 0.4)
  }
  if (acc('bandana')) {
    const c = ac('bandana')
    const pts: Paint = (_f, _x, _y, _w, _h, ax, ay) => waxBig(c, 'points', ax, ay)
    box([H * 1.16, H * 0.22, H * 1.16], [0, H * 0.86, 0], pts)
    box([H * 0.2, H * 0.2, H * 0.14], [0, H * 0.82, -H * 0.62], pts)
    for (const s of [-1, 1]) box([H * 0.12, H * 0.28, H * 0.05], [s * H * 0.08, H * 0.62, -H * 0.66], pts, [0, 0, s * 0.3])
  }
  if (acc('headphones')) {
    const c = ac('headphones')
    box([H * 1.2, H * 0.08, H * 0.18], [0, H * 1.2, 0], (f, x) => (f === 'ny' && x > 1 && x < 18 ? '#3a3a40' : c), undefined, 0.4)
    for (const s of [-1, 1]) {
      box([H * 0.08, H * 0.6, H * 0.14], [s * H * 0.6, H * 0.88, 0], c, undefined, 0.3)
      box([H * 0.16, H * 0.36, H * 0.36], [s * H * 0.6, H * 0.46, 0], (f, x, y, w, h) => ((f === 'px' && s > 0) || (f === 'nx' && s < 0)) && x > 0 && x < w - 1 && y > 0 && y < h - 1 ? tint(c, 0.18) : c, undefined, 0.6)
    }
  }
  if (kufiOn) {
    const c = hasAcc(l, 'kufi') ? ac('kufi') : '#f8f9fa'
    box([H * 1.08, H * 0.24, H * 1.08], [0, H * 1.0, 0], (f, x, y, _w, _h, ax, ay) => (isSide(f) && y === 1 && x % 3 === 0 ? tint(c, -0.25) : knitP(c)(f, x, y, 0, 0, ax, ay)), undefined, 0.5)
  }
  if (uniformHat === 'kepi') {
    box([H * 1.12, H * 0.34, H * 1.12], [0, H * 1.05, 0], '#1f2a44')
    box([H * 1.13, H * 0.08, H * 1.13], [0, H * 0.92, 0], '#c92a2a', undefined, 0.3)
    box([H * 0.9, H * 0.06, H * 0.4], [0, H * 0.88, H * 0.72], '#141416', undefined, 0.4)
    box([H * 0.14, H * 0.12, H * 0.04], [0, H * 1.08, H * 0.57], (_f, x, y) => (x === 0 && y === 0 ? '#fff4c2' : '#e8b93c'), undefined, 0.2)
  }
  if (uniformHat === 'beret') {
    box([H * 1.2, H * 0.2, H * 1.2], [H * 0.08, H * 1.02, 0], (f, _x, y, _w, _h, ax, ay) => (isSide(f) && y === 0 ? tint('#1f4f2a', -0.2) : grain('#1f4f2a', ax, ay, 0.06)), [0, 0, -0.18])
    box([H * 0.12, H * 0.14, H * 0.03], [-H * 0.3, H * 0.98, H * 0.6], '#e8b93c', undefined, 0.2)
  }
  if (uniformHat === 'toque') {
    box([H * 1.1, H * 0.18, H * 1.1], [0, H * 0.95, 0], '#f8f9fa', undefined, 0.5)
    box([H * 1.22, H * 0.55, H * 1.22], [0, H * 1.3, 0], (f, x, y) => (isSide(f) && x % 4 === 0 && y > 1 ? '#dfe3e8' : '#f1f3f5'), undefined, 0.6)
  }
  if (uniformHat === 'cap') {
    box([H * 1.17, H * 0.3, H * 1.17], [0, H * 0.99, 0], (f, x, y) => (f === 'pz' && y > 1 && y < 4 && x > 6 && x < 13 ? '#f2b705' : '#17171a'))
    box([H * 0.92, H * 0.07, H * 0.46], [0, H * 0.86, H * 0.78], '#0b0b0c', undefined, 0.4)
  }
  if (acc('barrettes')) {
    const c = ac('barrettes')
    for (const s of [-1, 0, 1]) box([H * 0.16, H * 0.07, H * 0.1], [s * H * 0.3, H * 1.09, H * 0.34 - Math.abs(s) * H * 0.06], s ? c : tint(c, 0.35), [0, 0, s * 0.3], 0.3)
  }
  if (acc('glasses') || acc('sunglasses')) {
    // Frames as blocks: the front with its two lenses cut out (or dark), the arms back to the ears.
    const fc = ac(acc('glasses') ? 'glasses' : 'sunglasses')
    const dark = shades
    box([0.3, 0.08, 0.012], [0, H - 8 * TX, H / 2 + 0.008], (f, x, y) => ((f === 'pz' || f === 'nz') && y >= 1 && y <= 2 && ((x >= 2 && x <= 6) || (x >= 8 && x <= 12)) ? (dark ? (y === 1 && (x === 3 || x === 9) ? '#5a6878' : '#14181e') : null) : fc), undefined, 0.2)
    for (const s of [-1, 1]) box([0.012, 0.015, 0.17], [s * (H / 2 + 0.008), H * 0.56, H / 2 - 0.08], fc, undefined, 0)
  }
  if (acc('earrings')) {
    // Big gold hoops: a stud, then a square ring of four small blocks.
    const g = ac('earrings')
    for (const s of [-1, 1]) {
      const x = s * (H / 2 + 0.03)
      const y = H * 0.33
      box([0.016, 0.016, 0.016], [x, y + 0.01, -0.01], tint(g, 0.2), undefined, 0)
      box([0.01, 0.01, 0.06], [x, y - 0.005, -0.01], g, undefined, 0)
      box([0.01, 0.01, 0.06], [x, y - 0.075, -0.01], tint(g, -0.15), undefined, 0)
      for (const zz of [-0.035, 0.015]) box([0.01, 0.08, 0.01], [x, y - 0.04, zz], g, undefined, 0)
    }
  }
  if (acc('ecouteurs')) {
    const c = ac('ecouteurs')
    for (const s of [-1, 1]) {
      box([0.024, 0.026, 0.026], [s * (H / 2 + 0.03), H * 0.42, 0.0], c, undefined, 0.2)
      box([0.01, 0.05, 0.01], [s * (H / 2 + 0.03), H * 0.42 - 0.034, 0.004], c, undefined, 0)
    }
  }
}

/* ---------- Paints from the outfit's layers ---------- */

function resolver(l: Required<Look>) {
  return (c: string, ax: number, ay: number) => (c === SKIN ? grain(l.skin, ax, ay, 0.025) : c === SHADE ? tint(l.skin, -0.14) : wearPx(c, l.wear, l.skin, ax, ay))
}

/* ---------- The whole look ---------- */

const keyOf = (l: Required<Look>, o: BuildOpts) => JSON.stringify([l.skin, l.hair, l.hairColor, l.outfit, l.outfitColor, l.eyes, l.beard, l.accessory, l.pattern, l.bottomColor, l.shoeColor, l.accessoryColor, l.marks, l.wear, l.body, o.femme, o.young, o.child, !!o.loo])
/** The look if it is built already. */
export const builtLook = (l: Required<Look>, o: BuildOpts) => cache.get(keyOf(l, o))

/*
 * A new look takes some milliseconds to paint (more on a phone): a street full
 * of new faces would stall a frame. So at most BUDGET ms of building in any
 * frame's time; the rest wait for the next frames (DetailHuman draws the far
 * figure meanwhile).
 */
const BUDGET = 6
let windowAt = 0
let windowSpent = 0
/** Whether there's time left to build a look in this frame. */
export function mayBuild() {
  const now = performance.now()
  if (now - windowAt > 16) {
    windowAt = now
    windowSpent = 0
  }
  return windowSpent < BUDGET
}

export function build(l: Required<Look>, o: BuildOpts): Built {
  const key = keyOf(l, o)
  const hit = cache.get(key)
  if (hit) return hit
  built++
  const t0 = performance.now()
  const { femme, young, child, loo } = o
  const k = new Kit()
  const { w, limb, depth } = BODY[l.body] ?? BODY.moyen
  const tw = 0.34 * w * (femme ? 0.92 : 1)
  const td = 0.18 * depth
  const aw = (femme ? 0.115 : 0.13) * limb
  const d: Dims = { tw, td, ww: tw * (femme ? 0.88 : 0.95), wd: td * 0.96, lw: (tw / 2) * 0.98, ld: 0.16 * limb, aw, hipX: tw / 4, shX: tw / 2 + aw / 2 + 0.006 }
  const skin = l.skin
  const sk = skinP(skin)
  const dress = dressFor(l, femme)
  const res = resolver(l)
  const acc = (id: string) => !young && hasAcc(l, id)
  const ac = (id: string) => accessoryColor(l, id)
  let loose = false

  addHead(k, l, { femme, young, child, loose: (v) => (loose = v) })

  /* The torso: the chest, the neck, the collar, the waist, and what's on them. */
  const torso = (from: number, len: number, layers: TL[]): Paint => (f, x, y, ww, h, ax, ay) => {
    const m = f === 'py' ? from : f === 'ny' ? from + len - 0.001 : from + ((y + 0.5) / h) * len
    const cx = x - (ww - 1) / 2
    const kk = ww > 1 ? cx / ((ww - 1) / 2) : 0
    for (const L of layers) {
      const c = L(f, cx, kk, m, ax, ay)
      if (c !== undefined) return res(c, ax, ay)
    }
    return grain(skin, ax, ay, 0.025)
  }
  const chestLen = TOP - WAIST_Y
  k.add('chest', { s: [tw, chestLen, td], p: [0, (TOP + WAIST_Y) / 2, 0], paint: torso(0, chestLen, dress.torso) })
  k.add('chest', { s: [0.13, 0.06, 0.12], p: [0, TOP + 0.02, -0.005], paint: (f, x, y, _ww, _hh, ax, ay) => (f === 'pz' && y === 0 ? tint(skin, -0.22) : f === 'pz' && x === 0 ? tint(skin, -0.1) : grain(tint(skin, -0.06), ax, ay, 0.02)), bevel: 0.4 })
  if (dress.collar) k.add('chest', { s: [0.17, 0.035, 0.15], p: [0, TOP + 0.012, -0.005], paint: dress.collar, bevel: 0.5 })
  const waistLen = WAIST_Y - TORSO_BOTTOM + 0.01
  k.add('chest', { s: [d.ww, waistLen, d.wd], p: [0, (WAIST_Y + TORSO_BOTTOM - 0.01) / 2, 0], paint: torso(chestLen, waistLen, dress.torso) })
  dress.extras?.(k, d)
  const z = td / 2 + 0.004
  if (acc('chain') || acc('beads') || acc('croix')) {
    // A gold chain, a string of beads, a cross on its thin chain: links as small blocks round the neck.
    const id = acc('chain') ? 'chain' : acc('beads') ? 'beads' : 'croix'
    const g = ac(id)
    const beads = [g, '#f2b705', '#00a862', '#f4f1ea']
    const n = id === 'beads' ? 9 : 7
    for (let i = 0; i < n; i++) {
      const t = (i / (n - 1) - 0.5) * 2
      const c = id === 'beads' ? beads[i % 4] : id === 'croix' ? tint(g, -0.2) : i % 2 ? tint(g, 0.2) : g
      const s: V3 = id === 'beads' ? [0.022, 0.022, 0.014] : id === 'croix' ? [0.016, 0.008, 0.006] : [0.022, 0.014, 0.008]
      k.add('chest', { s, p: [t * 0.08, TOP - 0.02 - (1 - t * t) * 0.07, z], r: [0, 0, t * 0.7], paint: c, bevel: id === 'beads' ? 0.4 : 0 })
    }
    if (id === 'chain') k.add('chest', { s: [0.03, 0.04, 0.01], p: [0, TOP - 0.115, z + 0.002], paint: (f, x, y) => (f === 'pz' && x === 0 && y === 0 ? '#fff4c2' : g), t: [2, 2, 1], bevel: 0 })
    if (id === 'croix') {
      k.add('chest', { s: [0.016, 0.07, 0.01], p: [0, TOP - 0.13, z + 0.003], paint: g, bevel: 0 })
      k.add('chest', { s: [0.05, 0.016, 0.01], p: [0, TOP - 0.115, z + 0.003], paint: g, bevel: 0 })
    }
  }
  if (acc('bag')) {
    // The strap across the chest and the back, from the right shoulder to the left hip; the bag at the hip.
    const c = ac('bag')
    const len = Math.hypot(tw, TOP - TORSO_BOTTOM - 0.08) + 0.04
    const ang = Math.atan2(TOP - TORSO_BOTTOM - 0.08, tw)
    for (const s of [1, -1]) k.add('chest', { s: [len, 0.028, 0.008], p: [0, (TOP + TORSO_BOTTOM + 0.08) / 2, s * (td / 2 + 0.006)], r: [0, 0, -ang], paint: (f, x) => (isSide(f) && x % 5 === 0 ? tint(c, -0.25) : tint(c, -0.1)), bevel: 0.3 })
    const bx = -tw / 2 - 0.02
    const by = TORSO_BOTTOM + 0.08
    const bz = td / 2 - 0.02
    k.add('chest', { s: [0.15, 0.13, 0.07], p: [bx, by, bz], paint: clothP(c), bevel: 0.6 })
    k.add('chest', { s: [0.155, 0.06, 0.075], p: [bx, by + 0.04, bz + 0.003], paint: (f, x, y, ww, hh) => (f === 'pz' && y === hh - 1 && x > 0 && x < ww - 1 ? tint(c, -0.32) : tint(c, -0.18)), bevel: 0.5 })
    k.add('chest', { s: [0.03, 0.025, 0.01], p: [bx, by + 0.012, bz + 0.042], paint: '#d8c27a', bevel: 0.2 })
  }
  if (acc('cartable') || acc('sac-a-dos')) {
    // The cartable or the sac à dos on the back: the flap and its buckles, or the front pocket and its zip; the straps.
    const school = acc('cartable')
    const c = ac(school ? 'cartable' : 'sac-a-dos')
    const y = TORSO_BOTTOM + 0.31
    const bz = -td / 2 - 0.055
    k.add('chest', { s: [tw * 0.82, school ? 0.3 : 0.34, 0.1], p: [0, y, bz], paint: clothP(c), bevel: 0.6 })
    if (school) {
      k.add('chest', { s: [tw * 0.84, 0.14, 0.104], p: [0, y + 0.09, bz - 0.002], paint: (f, _x, yy, _ww, hh) => (isSide(f) && yy === hh - 1 ? tint(c, -0.3) : tint(c, -0.18)), bevel: 0.5 })
      for (const s of [-1, 1]) k.add('chest', { s: [0.025, 0.035, 0.01], p: [s * tw * 0.2, y + 0.03, bz - 0.054], paint: '#d8c27a', bevel: 0.2 })
    } else {
      k.add('chest', { s: [tw * 0.6, 0.13, 0.03], p: [0, y - 0.07, bz - 0.06], paint: (f, _x, yy) => (f === 'nz' && yy === 1 ? tint(c, -0.35) : tint(c, 0.12)), bevel: 0.5 })
      k.add('chest', { s: [tw * 0.7, 0.008, 0.104], p: [0, y + 0.12, bz], paint: tint(c, -0.35), bevel: 0 })
    }
    for (const s of [-1, 1]) {
      k.add('chest', { s: [0.03, 0.012, td + 0.06], p: [s * tw * 0.27, TOP + 0.004, -0.02], paint: tint(c, -0.25), bevel: 0.2 })
      k.add('chest', { s: [0.03, 0.26, 0.012], p: [s * tw * 0.27, TOP - 0.13, td / 2 + 0.006], paint: tint(c, -0.25), bevel: 0.2 })
    }
  }

  /* The skirt (or the long boubou): the top round the hips, a half on each leg swinging with it. */
  const skirt = loo ? undefined : dress.skirt
  const skW = skirt ? tw * skirt.w : 0
  const skD = skirt ? td * skirt.d : 0
  const skirtP = skirt ? (f: F, x: number, y: number, ww: number, hh: number, ax: number, ay: number) => res(skirt.paint(f, x, y, ww, hh, ax, ay) ?? skin, ax, ay) : null
  if (skirt && skirtP) {
    k.add('chest', { s: [skW, 0.17, skD], p: [0, 0.885, 0], paint: (f, x, y, ww, hh, ax, ay) => (skirt.band && y < 2 && isSide(f) ? skirt.band : skirtP(f, x, y, ww, hh, ax, ay)) })
    if (skirt.wrap) {
      // The wrapped edge of the pagne: a fold of cloth down the front, from the knot.
      k.add('chest', { s: [0.035, 0.17, 0.012], p: [skW * 0.3, 0.885, skD / 2 + 0.004], paint: (f, x, y, ww, hh, ax, ay) => (x === 0 ? tint(skirt.band ?? '#000000', -0.2) : skirtP(f, x, y, ww, hh, ax, ay)) })
    }
  }

  /* Legs: thigh and shin, the shoe on the shin; the skirt's halves swing with them. */
  const kneeY = HIP_Y - THIGH
  const bareLegs = dress.legs < 0.4 && (!skirt || skirt.hem > kneeY + 0.04)
  const knee = !young && (l.marks === 'genou' || l.marks === 'bagarre') && bareLegs
  const limbPaint = (from: number, len: number, layers: LL[], side: number, extra?: LL): Paint => (f, x, y, ww, hh, ax, ay) => {
    const m = f === 'py' ? from : f === 'ny' ? from + len : from + ((y + 0.5) / hh) * len
    if (extra) {
      const c = extra(f, m, side, x, ww, ax, ay)
      if (c !== undefined) return res(c, ax, ay)
    }
    for (const L of layers) {
      const c = L(f, m, side, x, ww, ax, ay)
      if (c !== undefined) return res(c, ax, ay)
    }
    return grain(skin, ax, ay, 0.025)
  }
  const roll = tint(l.bottomColor || defaultColors(l, femme).bottom, -0.08)
  for (const i of [0, 1]) {
    const side = i === 0 ? -1 : 1
    const thigh = `thigh${i}`
    const shin = `shin${i}`
    const bandage: LL | undefined = knee && i === 0 ? (f, m) => (m > THIGH - 0.06 && m < THIGH + 0.04 && isSide(f) ? '#f4f1ea' : undefined) : undefined
    k.add(thigh, { s: [d.lw, THIGH + 0.04, d.ld], p: [0, (0.04 - THIGH) / 2, 0], paint: loo ? sk : limbPaint(-0.04, THIGH + 0.04, dress.leg, side, bandage), bevel: 0.6 })
    const ankle = SHIN - 0.075
    k.add(shin, { s: [d.lw * 0.96, ankle + 0.02, d.ld * 0.96], p: [0, (0.02 - ankle) / 2, 0], paint: limbPaint(THIGH - 0.02, ankle + 0.02, dress.leg, side, bandage), bevel: 0.6 })
    if (dress.hem && dress.legs > THIGH + 0.3) k.add(shin, { s: [d.lw * 1.04, 0.035, d.ld * 1.04], p: [0, -ankle + 0.012, 0], paint: (f, x) => (isSide(f) && x % 3 === 0 ? tint(dress.hem!, -0.1) : dress.hem!), bevel: 0.5 })
    // On the toilets: the trousers down, bunched round the shin; the shirt's tail over the lap.
    if (loo && !dress.skirt && dress.legs > 0.3) k.add(shin, { s: [d.lw * 1.22, 0.11, d.ld * 1.22], p: [0, -0.1, 0], paint: (f, x, y) => (isSide(f) && (x + y) % 3 === 0 ? tint(roll, -0.15) : roll), bevel: 0.6 })
    if (loo && i === 0) k.add(thigh, { s: [tw * 1.04, 0.17, 0.03], p: [d.hipX, -0.07, d.ld / 2 + 0.016], paint: clothP(dress.skirt ? (l.bottomColor || l.outfitColor) : l.outfitColor), bevel: 0.5 })
    addShoe(k, shin, dress.shoe, dress.shoeC, skin, d)
    if (skirt && skirtP) {
      const skX = side * (skW / 4 - d.hipX)
      const len1 = Math.min(THIGH, HIP_Y - skirt.hem) + 0.05
      const sp = (f: F, x: number, y: number, ww: number, hh: number, ax: number, ay: number) => (skirt.band && y === hh - 1 && isSide(f) && !skirt.frill ? skirt.band : skirtP(f, x, y, ww, hh, ax, ay))
      k.add(thigh, { s: [skW / 2, len1, skD * 0.98], p: [skX, 0.05 - len1 / 2, 0], paint: sp, bevel: 0.6 })
      if (skirt.hem < kneeY) {
        const len2 = kneeY - skirt.hem + 0.03
        k.add(shin, { s: [skW / 2, len2, skD * 0.98], p: [skX, 0.03 - len2 / 2, 0], paint: sp, bevel: 0.6 })
      }
      if (skirt.frill) {
        // A frill at the hem, wider.
        const seg = skirt.hem < kneeY ? shin : thigh
        const y = skirt.hem < kneeY ? -(kneeY - skirt.hem) : -(HIP_Y - skirt.hem)
        k.add(seg, { s: [skW / 2 + 0.02, 0.05, skD + 0.02], p: [skX + side * 0.01, y + 0.02, 0], paint: (f, x) => (isSide(f) && x % 2 ? tint(skirt.frill!, -0.1) : skirt.frill!), bevel: 0.5 })
      }
    }
  }

  /* Arms: the sleeve, the forearm, the hand with its thumb. */
  const wrist = FOREARM - 0.06
  const scratches = !young && (l.marks === 'griffures' || l.marks === 'bagarre') && dress.sleeve < 0.32
  const gloves = acc('gants')
  for (const i of [0, 1]) {
    const side = i === 0 ? -1 : 1
    const up = `upper${i}`
    const fo = `fore${i}`
    const mark: LL | undefined = scratches && i === 1 ? (f, m, s, x) => (outer(f, s) && m > 0.33 && m < 0.42 && (x + Math.round(m / TX)) % 3 === 0 ? '#a8322a' : undefined) : undefined
    const glove: LL | undefined = gloves ? (_f, m) => (m > UPPER_ARM + wrist - 0.05 ? '#f8f9fa' : undefined) : undefined
    k.add(up, { s: [aw, UPPER_ARM + 0.04, aw], p: [0, (0.04 - UPPER_ARM) / 2, 0], paint: limbPaint(0, UPPER_ARM + 0.04, dress.arm, side), bevel: 0.6 })
    k.add(fo, { s: [aw * 0.96, wrist + 0.02, aw * 0.96], p: [0, (0.02 - wrist) / 2, 0], paint: limbPaint(UPPER_ARM + 0.02, wrist + 0.02, dress.arm, side, mark ?? glove), bevel: 0.6 })
    // Where the sleeve ends, a cuff (on the upper arm or at the wrist).
    if (dress.cuff && dress.sleeve > 0) {
      const onFore = dress.sleeve > UPPER_ARM + 0.04
      const y = onFore ? -(dress.sleeve - UPPER_ARM - 0.02) : 0.04 - dress.sleeve
      k.add(onFore ? fo : up, { s: [aw * 1.1, 0.03, aw * 1.1], p: [0, Math.max(y, -wrist) + 0.012, 0], paint: (f, x) => (isSide(f) && x % 3 === 1 ? tint(dress.cuff!, -0.08) : dress.cuff!), bevel: 0.5 })
    }
    if (dress.puff) k.add(up, { s: [aw * 1.32, 0.13, aw * 1.32], p: [0, -0.02, 0], paint: (f, x, y, ww, hh, ax, ay) => res(dress.puff!(f, x, y, ww, hh, ax, ay) ?? skin, ax, ay), bevel: 0.7 })
    if (dress.bell) {
      const bell: Paint = (f, x, y, ww, hh, ax, ay) => res(dress.bell!(f, x, y, ww, hh, ax, ay) ?? skin, ax, ay)
      k.add(up, { s: [aw * 1.4, UPPER_ARM, aw * 1.4], p: [0, -UPPER_ARM / 2 + 0.03, 0], paint: bell, bevel: 0.6 })
      k.add(fo, { s: [aw * 1.9, 0.17, aw * 1.9], p: [0, -0.075, 0], paint: bell, bevel: 0.6 })
    }
    // The hand: flatter than the arm, the fingers' lines, a thumb forward and in (white gloves for the traffic cop).
    const hs = gloves ? '#f8f9fa' : skin
    const hand: Paint = (f, x, y, ww, hh, ax, ay) => {
      const outerF = (f === 'px' && side > 0) || (f === 'nx' && side < 0)
      const inner = (f === 'nx' && side > 0) || (f === 'px' && side < 0)
      if ((outerF || inner) && y >= hh - 3 && x % 2 === 1 && x < ww - 1) return tint(hs, -0.2)
      if (inner && y < 3) return tint(hs, 0.06) // the palm
      return grain(hs, ax, ay, 0.025)
    }
    k.add(fo, { s: [aw * 0.66, 0.1, aw * 0.92], p: [0, -wrist - 0.04, 0], t: [3, 5, 5], paint: hand, bevel: 0.6 })
    k.add(fo, { s: [0.028, 0.05, 0.03], p: [-side * aw * 0.12, -wrist - 0.02, aw * 0.46 + 0.012], r: [0.2, 0, 0], paint: gloves ? '#f8f9fa' : sk, bevel: 0.5 })
    if (i === 0 && acc('watch')) {
      // On the left wrist: the strap all round, the face and its glass on the outside.
      k.add(fo, { s: [aw * 1.08, 0.024, aw * 1.08], p: [0, -wrist + 0.03, 0], paint: (f, x) => (f === 'nx' && x > 0 && x < 5 ? ac('watch') : '#17171a'), bevel: 0.2 })
      k.add(fo, { s: [0.012, 0.03, 0.03], p: [-aw * 0.54 - 0.006, -wrist + 0.03, 0], paint: (f, x, y) => (f === 'nx' ? (x === 0 && y === 0 ? '#ffffff' : '#e7f5ff') : ac('watch')), t: [1, 2, 2], bevel: 0 })
    }
    if (i === 1 && acc('chapelet')) {
      // Prayer beads hanging from the right hand.
      const c = ac('chapelet')
      for (let n = 0; n < 6; n++) k.add(fo, { s: [0.016, 0.016, 0.016], p: [side * 0.004, -wrist - 0.1 - n * 0.018, aw * 0.3 - Math.abs(n - 2.5) * 0.008], paint: n % 2 ? c : tint(c, 0.3), bevel: 0.3 })
      k.add(fo, { s: [0.012, 0.03, 0.006], p: [side * 0.004, -wrist - 0.22, aw * 0.3], paint: tint(c, 0.4), bevel: 0 })
    }
  }

  const f = k.finish()
  const out: Built = { material: materialOf(f.texture), geos: f.geos, boxes: f.boxes, tris: f.tris, loose, d, atlas: f.height, face: f.face }
  cache.set(key, out)
  const took = performance.now() - t0
  spent += took
  windowSpent += took
  return out
}

/** A shoe on the shin: the upper reaching forward past the shin, a sole a little wider (or bare feet). */
function addShoe(k: Kit, shin: string, sh: string, sc: string, skin: string, d: Dims) {
  const fz = d.ld * 0.16
  const sk = skinP(skin)
  if (sh === 'sandal' || sh === 'slide' || sh === 'none') {
    // Bare feet: the toes; on a sole with a strap across (sandals), a wide band (claquettes).
    k.add(shin, { s: [d.lw * 0.92, 0.06, d.ld * 1.18], p: [0, -SHIN + 0.04, fz], paint: (f, x, y, ww, hh, ax, ay) => (f === 'pz' && y >= hh - 2 && x % 2 ? tint(skin, -0.18) : sk(f, x, y, ww, hh, ax, ay)), bevel: 0.5 })
    if (sh === 'none') return
    if (sh === 'sandal') k.add(shin, { s: [d.lw * 0.96, 0.022, 0.035], p: [0, -SHIN + 0.05, fz + d.ld * 0.25], paint: sc, bevel: 0.4 })
    else k.add(shin, { s: [d.lw * 0.98, 0.03, d.ld * 0.5], p: [0, -SHIN + 0.045, fz + d.ld * 0.12], paint: (f, x) => (f === 'py' && x % 3 === 1 ? tint(sc, 0.3) : sc), bevel: 0.4 })
    k.add(shin, { s: [d.lw * 1.04, 0.02, d.ld * 1.3], p: [0, -SHIN + 0.001, fz], paint: (f, x) => (isSide(f) && x % 2 ? tint(sc, -0.28) : tint(sc, -0.2)), bevel: 0.4 })
    return
  }
  if (sh === 'heel') {
    // A slim pump, its pointed toe, the heel under the back.
    k.add(shin, { s: [d.lw * 0.9, 0.06, d.ld * 1.2], p: [0, -SHIN + 0.05, fz + 0.01], paint: (f, x, y, ww, hh, ax, ay) => (f === 'py' && y < hh - 3 ? sk(f, x, y, ww, hh, ax, ay) : f === 'py' && x > 0 && x < ww - 1 && y === hh - 1 ? tint(sc, 0.3) : grain(sc, ax, ay, 0.03)), bevel: 0.6 })
    k.add(shin, { s: [0.03, 0.05, 0.03], p: [0, -SHIN + 0.02, fz - d.ld * 0.45], paint: tint(sc, -0.3), bevel: 0.3 })
    k.add(shin, { s: [d.lw * 0.8, 0.014, d.ld * 0.6], p: [0, -SHIN + 0.004, fz + d.ld * 0.3], paint: '#1e140d', bevel: 0.3 })
    return
  }
  const soleC = sh === 'sneaker' ? '#f4f4f4' : sh === 'boot' ? '#f4f4f4' : '#1e140d'
  k.add(shin, {
    s: [d.lw * 1.02, sh === 'boot' ? 0.12 : 0.075, d.ld * 1.26],
    p: [0, -SHIN + (sh === 'boot' ? 0.07 : 0.047), fz],
    paint: (f, x, y, ww, hh, ax, ay) => {
      if (sh === 'sneaker' || sh === 'boot') {
        if (f === 'py' && y >= hh - 4 && (x === 1 || x === ww - 2) && y % 2 === 0) return sh === 'boot' ? tint(sc, 0.35) : '#ffffff'
        if (f === 'py' && y >= hh - 4 && x > 0 && x < ww - 1) return tint(sc, -0.1)
        if (sh === 'boot' && f === 'pz' && x > 0 && x < ww - 1 && y < hh - 2 && y % 2 === 0) return tint(sc, 0.35) // the laces up the front
        if (sh === 'sneaker' && (f === 'px' || f === 'nx') && y === hh - 2 && x > 1 && x < ww - 2) return '#ff7a00' // the stripe
        return grain(sc, ax, ay, 0.04)
      }
      if (f === 'py' && x > 0 && x < ww - 1 && y >= hh - 3) return tint(sc, 0.28) // the shine on the toe
      return grain(sc, ax, ay, 0.03)
    },
    bevel: 0.7,
  })
  k.add(shin, { s: [d.lw * 1.08, 0.022, d.ld * 1.34], p: [0, -SHIN + 0.001, fz], paint: (f, x) => (isSide(f) && x % 2 ? tint(soleC, -0.08) : soleC), bevel: 0.4 })
}

/* ---------- A baby ---------- */

export const BABY_H = 0.22
export const BABY_OUTFIT_IDS = new Set(['grenouillere', 'body', 'robe-bebe', 'pagne-bebe', 'salopette-bebe'])
export type BabyBuilt = { material: THREE.Material; geos: Record<string, THREE.BufferGeometry>; boxes: number; tris: number; face?: Uint8ClampedArray }
const babyCache = new Map<string, BabyBuilt>()

/**
 * A baby in detailed blocks (BlockBaby's shape): a big head with the face of the Sim it will grow
 * into, a onesie and a nappy, short arms and legs; a player's baby wears what was picked for it.
 */
export function buildBaby(full: Required<Look>, femme: boolean, fresh: string, own: string | null, hairdo: string | null, accs: string[]): BabyBuilt {
  const key = JSON.stringify([full.skin, full.hair, full.hairColor, full.eyes, full.pattern, full.wear, full.accessoryColor, fresh, own, hairdo, accs, femme])
  const hit = babyCache.get(key)
  if (hit) return hit
  built++
  const k = new Kit()
  const skin = full.skin
  const sk = skinP(skin)
  const worn = (c: string) => (full.wear === 'dechire' ? '#a39478' : full.wear === 'use' ? tint(c, -0.18) : c)
  const cloth = worn(fresh)
  const onesie: Paint = own === 'pagne-bebe' ? (_f, _x, _y, _w, _h, ax, ay) => waxBig(cloth, full.pattern, ax, ay) : own === 'grenouillere' ? (_f, x, y, _w, _h, ax, ay) => ((x * 3 + y * 5) % 11 === 0 ? tint(cloth, 0.4) : grain(cloth, ax, ay, 0.05)) : clothP(cloth, 0.05)
  const nappy = full.wear === 'dechire' ? '#cfc4ad' : '#f8f9fa'
  const tee = clothP('#f8f9fa', 0.03)
  const top = own === 'salopette-bebe' ? tee : onesie
  const bare = own === 'body' || own === 'robe-bebe'
  const sleeve = bare ? sk : top
  const leg = bare ? sk : onesie
  const pants = own === 'body' ? onesie : clothP(nappy, 0.03)
  const has = (id: string) => accs.includes(id)
  const ac = (id: string) => accessoryColor(full, id)

  // The body in its onesie (the snaps down the front), the nappy.
  k.add('body', { s: [0.2, 0.2, 0.15], p: [0, 0.25, 0], paint: (f, x, y, w, h, ax, ay) => (f === 'pz' && x === Math.floor(w / 2) && y % 3 === 1 && own !== 'salopette-bebe' ? '#f4f1ea' : top(f, x, y, w, h, ax, ay)), bevel: 0.6 })
  k.add('body', { s: [0.21, 0.09, 0.16], p: [0, 0.12, 0], paint: (f, x, y, w, h, ax, ay) => (isSide(f) && y === 0 && !bare ? tint(nappy, -0.1) : pants(f, x, y, w, h, ax, ay)), bevel: 0.6 })
  k.add('body', { s: [0.09, 0.04, 0.09], p: [0, 0.36, 0], paint: (_f, _x, _y, _w, _h, ax, ay) => grain(tint(skin, -0.06), ax, ay, 0.02), bevel: 0.3 })
  if (own === 'salopette-bebe') {
    k.add('body', { s: [0.21, 0.1, 0.16], p: [0, 0.18, 0], paint: onesie, bevel: 0.5 })
    k.add('body', { s: [0.13, 0.08, 0.01], p: [0, 0.26, 0.078], paint: (f, x, y, w) => (f === 'pz' && y === 3 && x > 1 && x < w - 2 ? tint(cloth, -0.25) : onesie(f, x, y, w, 0, 0, 0)), bevel: 0.3 })
    for (const s of [-1, 1]) {
      k.add('body', { s: [0.025, 0.1, 0.01], p: [s * 0.055, 0.31, 0.078], paint: onesie, bevel: 0.2 })
      k.add('body', { s: [0.014, 0.014, 0.006], p: [s * 0.055, 0.27, 0.085], paint: '#c9b27a', bevel: 0 })
    }
  }
  if (own === 'robe-bebe') k.add('body', { s: [0.27, 0.09, 0.21], p: [0, 0.13, 0], paint: (f, x, y, w, h, ax, ay) => (isSide(f) && y === h - 1 ? '#f8f9fa' : isSide(f) && x % 3 === 0 ? tint(cloth, -0.12) : onesie(f, x, y, w, h, ax, ay)), bevel: 0.6 })
  if (has('bavoir')) k.add('body', { s: [0.15, 0.11, 0.012], p: [0, 0.29, 0.08], paint: (f, x, y, w, h) => (f === 'pz' && (x === 0 || x === w - 1 || y === h - 1) ? tint(ac('bavoir'), -0.15) : ac('bavoir')), bevel: 0.3 })
  // Legs: short, sticking out in front when sitting; the onesie's feet or bare toes.
  for (const i of [0, 1]) {
    k.add(`leg${i}`, { s: [0.08, 0.17, 0.08], p: [0, -0.085, 0], paint: leg, bevel: 0.6 })
    k.add(`leg${i}`, { s: [0.075, 0.05, 0.09], p: [0, -0.185, 0.01], paint: own === 'grenouillere' ? onesie : (f, x, y, w, h, ax, ay) => (f === 'pz' && y >= h - 2 && x % 2 ? tint(skin, -0.16) : sk(f, x, y, w, h, ax, ay)), bevel: 0.6 })
  }
  // Arms, the rattle in the right hand.
  for (const i of [0, 1]) {
    k.add(`arm${i}`, { s: [0.065, 0.15, 0.065], p: [0, -0.075, 0], paint: sleeve, bevel: 0.6 })
    if (bare) k.add(`arm${i}`, { s: [0.075, 0.05, 0.075], p: [0, -0.02, 0], paint: top, bevel: 0.5 })
    k.add(`arm${i}`, { s: [0.06, 0.05, 0.06], p: [0, -0.175, 0], paint: (f, x, y, w, h, ax, ay) => (f === 'pz' && y === h - 1 && x % 2 ? tint(skin, -0.2) : sk(f, x, y, w, h, ax, ay)), bevel: 0.5 })
    if (i === 1 && has('hochet')) {
      k.add('arm1', { s: [0.016, 0.08, 0.016], p: [0, -0.2, 0.03], paint: '#f8f9fa', bevel: 0.2 })
      k.add('arm1', { s: [0.06, 0.06, 0.06], p: [0, -0.26, 0.03], paint: (_f, x, y) => ((x + y) % 2 ? ac('hochet') : tint(ac('hochet'), 0.25)), bevel: 0.6 })
      k.add('arm1', { s: [0.03, 0.03, 0.065], p: [0, -0.26, 0.03], paint: '#ff6b6b', bevel: 0.3 })
    }
  }
  // The head: the grown-up's face at the baby's size, its hair; a tuft or two little puffs.
  const l: Required<Look> = { ...full, hair: full.hair === 'bald' ? 'bald' : hairdo === 'touffe' ? 'touffe' : 'short', beard: 'none', accessory: 'none', marks: 'none' }
  addHead(k, l, { femme, young: true, child: true }, BABY_H, 'head', 'head')
  const hc = tint(full.hairColor, 0.08)
  if (hairdo === 'puffs' && !has('bonnet-bebe'))
    for (const s of [-1, 1]) k.add('head', { s: [0.075, 0.07, 0.075], p: [s * 0.075, BABY_H + 0.03, -0.01], paint: (_f, _x, _y, _w, _h, ax, ay) => hairPx('puffs', hc, ax, ay), bevel: 0.6 })
  if (has('tetine')) {
    k.add('head', { s: [0.07, 0.045, 0.014], p: [0, BABY_H * 0.22, BABY_H / 2 + 0.008], paint: ac('tetine'), bevel: 0.5 })
    k.add('head', { s: [0.03, 0.03, 0.012], p: [0, BABY_H * 0.22, BABY_H / 2 + 0.02], paint: '#f8f9fa', bevel: 0.4 })
  }
  if (has('bonnet-bebe')) {
    const c = ac('bonnet-bebe')
    k.add('head', { s: [BABY_H * 1.16, BABY_H * 0.42, BABY_H * 1.16], p: [0, BABY_H * 0.86, -0.004], paint: knitP(c), bevel: 0.5 })
    k.add('head', { s: [BABY_H * 1.2, BABY_H * 0.1, BABY_H * 1.2], p: [0, BABY_H * 0.66, -0.004], paint: tint(c, -0.15), bevel: 0.4 })
    k.add('head', { s: [BABY_H * 0.26, BABY_H * 0.24, BABY_H * 0.26], p: [0, BABY_H * 1.16, 0], paint: (_f, _x, _y, _w, _h, ax, ay) => grain(tint(c, 0.3), ax, ay, 0.2), bevel: 0.5 })
  }
  const f = k.finish()
  const out: BabyBuilt = { material: materialOf(f.texture), geos: f.geos, boxes: f.boxes, tris: f.tris, face: f.face }
  babyCache.set(key, out)
  return out
}

/* ---------- Small things held, one mesh each ---------- */

const propCache = new Map<string, { geo: THREE.BufferGeometry; material: THREE.Material }>()
/** A lollipop: the stick, the sweet and its swirl. */
export function lollipop(c: string) {
  let p = propCache.get(`sucette|${c}`)
  if (!p) {
    const k = new Kit()
    k.add('p', { s: [0.012, 0.1, 0.012], p: [0, 0.03, 0.02], paint: '#f8f9fa', bevel: 0.2 })
    k.add('p', { s: [0.06, 0.06, 0.02], p: [0, 0.1, 0.02], paint: (f, x, y) => (f === 'pz' || f === 'nz' ? ((x + y) % 2 ? c : tint(c, 0.45)) : c), bevel: 0.4 })
    const f = k.finish()
    propCache.set(`sucette|${c}`, (p = { geo: f.geos.p, material: materialOf(f.texture) }))
  }
  return p
}
