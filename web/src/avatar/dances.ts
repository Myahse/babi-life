import { createContext } from 'react'
import { music, type Track } from '../audio/music'
import { worldTime } from '../lib/worldClock'
import type { Pose } from './Human'

// The dances of Abidjan, move by move, on the beat (usePoseRig in Human.tsx
// plays them on BlockHuman and DetailHuman, both with elbows and knees).
//
// What they are, from the dances themselves:
// - Coupé-décalé (Douk Saga and the Jet Set, 2002, and everything since): the
//   knees bent and giving on every beat, a little step-touch side to side, the
//   shoulders and the chest doing the work (shimmies, the chest popped on 1 and
//   3), the forearms in front pumping down with the beat; its named dances:
//   the « grippe aviaire » (DJ Zidane, 2006: the elbows flapping like wings, a
//   knee up, the head pecking), the arms rolled over each other then flung out
//   wide (« décalé ! »), and the boucantier's « travailment » (throwing notes
//   over the dancers, chest out, chin up).
// - Zouglou (the students of Yopougon, 1990): bent forward from the shoulders,
//   knees deep and bouncing, both arms raised in front and swinging, one then
//   the other, as if calling on heaven; hands clapping on the off-beat; the
//   whole line swaying together, a step forward, a step back.
// - Gweta, the wedding's dance (what the aunties do in front of the bride):
//   the hips rolled round, the body waved from the chest down to the knees,
//   one hand up waving the handkerchief, the shoulders shaking.
// - The moonwalk: the heel up on one foot, the other sliding back flat, in
//   turn on every beat, the body gliding back.
//
// The beat: beat n falls at n × 60/bpm seconds of the shared clock (worldTime,
// no seed), a bar every four beats. The music (audio/music.ts) puts its beats
// on the same grid, so the dancers hit them with it, on every screen. The
// tempo is the music's when some plays here, else the dance's own (DANCE_BPM).
// Nobody is a robot all the same: each Sim (its seed) has its own order of
// moves (changing every two bars), which side it starts on, how big it dances
// and how low; but the beats are everyone's.
//
// No allocation per frame: the moves write into one shared object (D), read
// at once by the rig that asked.

export type DanceStyle = 'coupe' | 'zouglou' | 'gweta' | 'travail' | 'moonwalk'

/** Each dance's tempo when no music plays (beats a minute). */
export const DANCE_BPM: Record<DanceStyle, number> = { coupe: 120, zouglou: 100, gweta: 108, travail: 120, moonwalk: 112 }

/** What the floor dances (a soirée zouglou, the wedding…): the generic 'dance' pose dances this. Without it, the music's. */
export const DanceFloor = createContext<DanceStyle | null>(null)

/** What a soirée's theme (game/soirees.ts) is danced to: a soirée zouglou, zouglou; the others, the music's. */
export const floorOfTheme = (theme: string | undefined): DanceStyle | null => (theme === 'zouglou' ? 'zouglou' : theme === 'coupe-decale' ? 'coupe' : null)

/** What the music heard makes people dance. */
const TRACK_DANCE: Record<Track, DanceStyle> = { club: 'coupe', maquis: 'coupe', concert: 'coupe', expo: 'coupe', fanfare: 'gweta', spectacle: 'gweta', stade: 'zouglou' }

/** The poses danced here. */
export const isDance = (pose: Pose) => pose === 'dance' || pose === 'zouglou' || pose === 'gweta' || pose === 'throw' || pose === 'moonwalk'

/** The dance a pose dances (null: not a dance). */
export function danceOf(pose: Pose, floor: DanceStyle | null): DanceStyle | null {
  switch (pose) {
    case 'dance': {
      if (floor) return floor
      const tr = music.track
      return tr ? TRACK_DANCE[tr] : 'coupe'
    }
    case 'zouglou':
    case 'gweta':
    case 'moonwalk':
      return pose
    case 'throw':
      return 'travail'
    default:
      return null
  }
}

/** For the lab (?view=danses): one move held (its index in the dance's list), a tempo forced. */
export const danceLab = { move: -1, bpm: 0 }

/** The beats now, for a dance: counted on the shared clock at the music's tempo (or the dance's). */
export function beatsOf(style: DanceStyle) {
  const bpm = danceLab.bpm || music.bpm || DANCE_BPM[style]
  return (worldTime() * bpm) / 60
}

/** Where the body goes this frame (filled by dance(), read by usePoseRig). Index 0: the left side (-x). */
export const D = {
  /** [shoulder x, shoulder y, shoulder z, elbow x, elbow z], in usePoseRig's terms. */
  arm: [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ],
  /** [hip x, hip z, knee], relative to the body (the lean taken out). */
  leg: [
    [0, 0, 0],
    [0, 0, 0],
  ],
  /** The root: height, sideways, forward; lean forward, sideways, turn; the head's nod. */
  body: { y: 0, x: 0, z: 0, rx: 0, rz: 0, ry: 0, head: 0 },
  /** The head turned, tilted, slid sideways and pushed forward (metres): the neck's isolations. */
  headTurn: 0,
  headRoll: 0,
  headX: 0,
  headZ: 0,
  /** The chest turned against the hips (the shimmy), and popped forward (0–1). */
  chestTurn: 0,
  pop: 0,
  /** Each shoulder lifted (metres). */
  lift: [0, 0],
}

/* ---------- The working ---------- */

// The feet are where the move puts them on the floor, and the legs reach for
// them: the hips may sway, roll or drop and the feet stay planted (a light
// leg, bent more, comes off the floor). Leg length 0.84 m (thigh and shin
// 0.42), the hips 0.84 m up.
const LEG = 0.84
/** How far out from the middle each hip is (the torso's quarter width): a foot there is straight under it. */
const HIPX = 0.085
const k = [0, 0]
const fx = [0, 0]
const fz = [0, 0]
let hx = 0
let hz = 0

const frac = (x: number) => x - Math.floor(x)
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
const ease = (u: number) => u * u * (3 - 2 * u)
/** A hit on the beat: 1 at it, gone by w of a beat. */
const hit = (p: number, w: number) => {
  const u = p < w ? 1 - p / w : 0
  return u * u
}
/** Down on the beat, up between: the knees' bounce. */
const dip = (p: number) => {
  const c = 0.5 + 0.5 * Math.cos(p * Math.PI * 2)
  return c * c
}
/** -1 or 1 in turn on each beat, quick in between: the weight from one foot to the other. */
const sideOf = (b: number) => clamp(Math.cos(b * Math.PI) * 1.8, -1, 1)
/** A number in [0, 1) from a seed and a salt. */
const draw = (seed: number, salt: number) => frac(Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453)

function arm(i: number, sx: number, sy: number, sz: number, ex: number, ez = 0) {
  const a = D.arm[i]
  a[0] = sx
  a[1] = sy
  a[2] = sz
  a[3] = ex
  a[4] = ez
}

function reset() {
  const b = D.body
  b.y = b.x = b.z = b.rx = b.rz = b.ry = b.head = 0
  D.headTurn = D.headRoll = D.headX = D.headZ = D.chestTurn = D.pop = 0
  D.lift[0] = D.lift[1] = 0
  hx = hz = 0
  for (let i = 0; i < 2; i++) {
    const out = i ? 1 : -1
    k[i] = 0.3
    fx[i] = out * HIPX
    fz[i] = 0
  }
}

/** The step-touch: the weight onto one foot then the other on each beat, the light one closing in, bent. */
function stepTouch(side: number, wide: number, bend: number, light: number) {
  for (let i = 0; i < 2; i++) {
    const out = i ? 1 : -1
    const w = 0.5 + 0.5 * side * out // 1: this foot takes the weight
    fx[i] = out * (0.025 + wide * w)
    k[i] = bend + light * (1 - w)
  }
}

/** The legs reaching for the feet, the root placed so the hips are where the move wants them. */
function solve() {
  const b = D.body
  let reach = 0
  for (let i = 0; i < 2; i++) {
    const kk = k[i]
    const l = LEG * Math.cos(kk / 2)
    // The foot's offset from under its hip: forward, sideways.
    const ax = -Math.asin(clamp((fz[i] - hz) / l, -0.9, 0.9))
    const az = Math.asin(clamp((fx[i] - (i ? 1 : -1) * HIPX - hx) / l, -0.9, 0.9))
    reach = Math.max(reach, l * Math.cos(ax) * Math.cos(az))
    const g = D.leg[i]
    g[0] = ax - kk / 2 - b.rx
    g[1] = az - b.rz
    g[2] = kk
  }
  // The hips as low as the planted leg lets them; the lean and the tilt turn about them, not the feet.
  b.y = reach - LEG + LEG * (1 - Math.cos(b.rx) * Math.cos(b.rz))
  b.x = hx + LEG * Math.sin(b.rz)
  b.z = hz - LEG * Math.sin(b.rx)
}

/* ---------- The moves ---------- */

// Each: b the beats (float), p where in the beat (0 on it), q the beat of the
// bar (0 is « 1 »), e how big this Sim dances, m its side (±1: which foot,
// which arm first). Arms: sx forward and up (negative), sz out to the side
// (out × positive), ex the elbow bent (negative).

type Move = (b: number, p: number, q: number, e: number, m: number) => void

/** Coupé-décalé, the base: the step-touch on every beat, knees giving, forearms pumping, the shoulder of the step popping, the chest on 1 and 3. */
const decale: Move = (b, p, q, e, m) => {
  const side = sideOf(b) * m
  const d = dip(p)
  stepTouch(side, 0.16 * e, 0.4 + 0.3 * d * e, 0.3)
  hx = side * 0.1 * e
  const body = D.body
  body.rx = 0.1
  body.rz = -side * 0.08
  body.ry = side * 0.28 * e
  for (let i = 0; i < 2; i++) {
    const out = i ? 1 : -1
    const w = 0.5 + 0.5 * side * out
    arm(i, -0.6 + 0.4 * (w - 0.5) - 0.35 * d * e, -out * 0.25, out * (0.45 + 0.12 * d), -1.55 + 0.55 * d * e)
    D.lift[i] = 0.035 * d * w * e
  }
  D.pop = hit(p, 0.4) * (q % 2 === 0 ? 1 : 0.3)
  body.head = 0.16 * d - 0.05
  D.headTurn = side * 0.18
  D.headX = side * 0.015
}

/** Coupé-décalé, the shoulders: a shimmy in sixteenths, the chest popped on 1 and 3, the head nodding on 2 and 4, the hips swaying over two beats. */
const shimmy: Move = (b, p, q, e, m) => {
  const sh = Math.sin(b * Math.PI * 4) * e
  const d = dip(p)
  for (let i = 0; i < 2; i++) {
    const out = i ? 1 : -1
    k[i] = 0.55 + 0.14 * d
    fx[i] = out * 0.11
  }
  const sway = Math.sin(b * Math.PI) * m
  hx = sway * 0.05
  const pop = q % 2 === 0 ? hit(p, 0.45) : 0
  const body = D.body
  body.rx = 0.05 - 0.1 * pop
  body.rz = sway * 0.03
  body.ry = sh * 0.05
  D.chestTurn = sh * 0.22
  for (let i = 0; i < 2; i++) {
    const out = i ? 1 : -1
    // The chest turning (+: the right shoulder back) takes the arm with it.
    arm(i, -0.65 + out * sh * 0.36, 0, out * (0.6 + 0.1 * pop), -1.75)
    D.lift[i] = 0.025 * Math.max(0, -out * sh)
  }
  D.pop = pop
  body.head = -0.05 + 0.18 * (q % 2 === 1 ? hit(p, 0.4) : 0) - 0.06 * pop
  D.headX = 0.02 * sway
}

/** « La grippe aviaire »: the elbows flapping like wings on every half beat, a knee up in turn, bent forward, the head pecking. */
const grippe: Move = (b, p, q, e, m) => {
  const flap = 0.5 + 0.5 * Math.cos(b * Math.PI * 4)
  const n = Math.floor(b)
  const up = n % 2 === 0 ? m : -m // the side whose knee comes up this beat
  const lp = Math.sin(Math.PI * Math.min(1, p / 0.6))
  for (let i = 0; i < 2; i++) {
    const out = i ? 1 : -1
    const lifting = out === up
    k[i] = 0.42 + (lifting ? 0.95 * lp * e : 0.1 * dip(p))
    fx[i] = out * 0.08
    fz[i] = lifting ? 0.1 * lp : 0
    arm(i, -0.3, out * 0.35, out * (0.2 + 1.15 * flap * e), -2.35)
    D.lift[i] = 0.02 * flap
  }
  hx = -up * 0.04
  const body = D.body
  body.rx = 0.28
  body.ry = up * 0.12
  const h = hit(p, 0.35)
  body.head = -0.18 + 0.2 * h
  D.headZ = 0.05 * h * e
  D.pop = 0.4 * h * (q % 2 === 0 ? 1 : 0.5)
}

/**
 * The boucantier's travailment: one hand thrown up and out over the dancers
 * on 1 and 3 (the notes let go on the beat), back to the chest in between;
 * the last bar of four, the notes flicked off one by one on every half beat.
 * Chest out, chin up, the eyes after the notes; the swagger of a slow
 * step-touch. `wad`: the other hand holds the wad at the chest.
 */
function travail(b: number, p: number, _q: number, e: number, m: number) {
  const c = frac(b / 2) * 2 // 0–2: where in the throw's two beats
  // The wind-up from 1.6, the snap through the beat, held, then back.
  const raise = c < 0.14 ? 0.35 + 0.65 * ease(c / 0.14) : c < 0.7 ? 1 : c < 1.6 ? 1 - ease((c - 0.7) / 0.9) : 0.35 * ease((c - 1.6) / 0.4)
  const rain = Math.floor(b / 4) % 4 === 3
  const fl = hit(frac(b * 2), 0.5)
  const r = rain ? 0.6 + 0.2 * fl : raise
  const side = clamp(Math.cos((b * Math.PI) / 2) * 1.8, -1, 1)
  const d = dip(p)
  stepTouch(side, 0.08, 0.3 + 0.16 * d, 0.22)
  hx = side * 0.045
  for (let i = 0; i < 2; i++) {
    const out = i ? 1 : -1
    if (out === m) {
      // From the wad (in, at the chest) to up and out, the hand open; or the quick flicks.
      const ex = rain ? -1.0 + 0.85 * fl : -1.7 + 1.45 * r
      arm(i, -1.0 - 1.3 * r * e, 0, out * (-0.3 + 1.2 * r), ex)
      D.lift[i] = 0.03 * r
    } else {
      // The wad held at the chest, giving with the knees.
      arm(i, -0.95 - 0.06 * d, 0, out * -0.32, -1.6)
    }
  }
  const body = D.body
  body.rx = -0.05 - 0.06 * r
  body.ry = m * 0.25 * r + side * 0.08
  body.rz = -side * 0.03
  body.head = -0.12 - 0.12 * r + 0.06 * d
  D.headTurn = m * 0.2 * r
  D.pop = rain ? 0.3 * fl : 0.8 * hit(c, 0.3)
}

/** The arms rolled over each other in front for three beats, then flung out wide on the fourth, chest out: « décalé ! ». */
const roule: Move = (b, p, q, e, m) => {
  const side = sideOf(b) * m
  const d = dip(p)
  stepTouch(side, 0.07, 0.4 + 0.2 * d, 0.2)
  hx = side * 0.04
  const body = D.body
  body.rx = 0.12
  if (q < 3) {
    const a = b * Math.PI * 2
    for (let i = 0; i < 2; i++) {
      const out = i ? 1 : -1
      const ph = a + (out > 0 ? 0 : Math.PI)
      arm(i, -1.1 + 0.3 * Math.sin(ph) * e, -out * 0.35, out * 0.1, -1.55 + 0.45 * Math.cos(ph))
    }
    body.head = 0.1 * d
  } else {
    const h = hit(p, 0.6)
    for (let i = 0; i < 2; i++) {
      const out = i ? 1 : -1
      arm(i, -1.25, 0, out * (0.9 + 0.45 * h * e), -0.3 - 0.4 * (1 - h))
      D.lift[i] = 0.03 * h
    }
    body.rx = 0.12 - 0.22 * h
    D.pop = h
    body.head = -0.15 * h
  }
  body.ry = side * 0.12
}

/** Zouglou's sway: the whole line from one foot to the other on each beat, together (no seed: everyone the same way), bent forward, knees deep. */
function zouglouBase(b: number, p: number, e: number) {
  const sw = sideOf(b)
  const d = dip(p)
  stepTouch(sw, 0.09, 0.58 + 0.32 * d * e, 0.2)
  hx = sw * 0.06
  const body = D.body
  body.rx = 0.3
  body.rz = -sw * 0.06
  body.ry = sw * 0.12
  body.head = 0.15 * d - 0.12
  D.headTurn = sw * 0.08
}

/** « Les bras au ciel »: both arms up in front, swinging one then the other over two beats, the face up, imploring. */
const ciel: Move = (b, p, _q, e) => {
  zouglouBase(b, p, e)
  for (let i = 0; i < 2; i++) {
    const out = i ? 1 : -1
    const sa = Math.sin(b * Math.PI + (out > 0 ? 0 : Math.PI))
    arm(i, -1.95 - 0.45 * sa * e, -out * 0.15, out * 0.18, -0.85 + 0.3 * sa)
    D.lift[i] = 0.03 * Math.max(0, sa)
  }
  D.body.head -= 0.12
}

/** The hands clapping on the off-beat, in front of the face, with the sway. */
const clapZ: Move = (b, p, _q, e) => {
  zouglouBase(b, p, e)
  const c = 0.5 + 0.5 * Math.cos((p - 0.5) * Math.PI * 2)
  const cl = c * c * c
  for (let i = 0; i < 2; i++) {
    const out = i ? 1 : -1
    arm(i, -1.35 - 0.15 * cl, 0, out * (0.36 - 0.5 * cl), -1.05)
  }
}

/** A step forward over beats 1–2, back over 3–4, the arms pumping forward on the beat, palms up, the back bowing as it comes. */
const avance: Move = (b, p, _q, e, m) => {
  zouglouBase(b, p, e)
  const fwd = clamp(Math.cos((b * Math.PI) / 2) * 1.6, -1, 1)
  hz = 0.08 * fwd
  for (let i = 0; i < 2; i++) {
    const out = i ? 1 : -1
    fz[i] = hz + (out === m ? 0.06 : -0.04) * fwd
  }
  const d = dip(p)
  for (let i = 0; i < 2; i++) {
    const out = i ? 1 : -1
    arm(i, -1.3 - 0.4 * d * e, -out * 0.1, out * 0.25, -1.1 + 0.3 * d)
  }
  D.body.rx = 0.3 + 0.12 * fwd
}

/** Gweta: the hips rolled round, once every two beats, the feet planted wide, the arms open, the head going against them. */
const hanches: Move = (b, p, _q, e, m) => {
  const a = b * Math.PI * m
  const cx = Math.cos(a)
  const sz = Math.sin(a)
  const d = dip(p)
  for (let i = 0; i < 2; i++) {
    const out = i ? 1 : -1
    k[i] = 0.55 + 0.1 * d
    fx[i] = out * 0.13
    arm(i, -0.4 + 0.1 * Math.sin(b * Math.PI * 4 + out), 0, out * 1.05, -1.35)
  }
  hx = 0.13 * cx * e
  hz = 0.08 * sz * e
  const body = D.body
  body.rz = 0.16 * cx * e
  body.rx = 0.06 - 0.12 * sz
  D.headX = -0.05 * cx
  D.headRoll = -0.14 * cx
  body.head = 0.06 * d
}

/** The body wave over two beats: the chest pops, then the hips push, then the knees give; the head ahead of it all; the arms rolling with it. */
const vague: Move = (b, _p, _q, e) => {
  const a = b * Math.PI
  const chest = Math.cos(a)
  for (let i = 0; i < 2; i++) {
    const out = i ? 1 : -1
    k[i] = 0.42 + 0.42 * e * (0.5 + 0.5 * Math.cos(a - 2.4))
    fx[i] = out * 0.1
    arm(i, -0.9 - 0.3 * Math.cos(a - 0.8), -out * 0.1, out * 0.35, -1.4 + 0.3 * Math.cos(a - 1.6))
  }
  hz = 0.09 * e * Math.cos(a - 1.6)
  const body = D.body
  body.rx = 0.08 - 0.24 * chest * e
  D.pop = 0.5 + 0.5 * chest
  D.headZ = 0.05 * Math.cos(a + 0.9)
  body.head = -0.1 * Math.cos(a + 0.9)
}

/** One hand up waving the handkerchief, the other on the hip; the hips snapped side to side on each beat, the shoulders shaking. */
const mouchoir: Move = (b, p, _q, e, m) => {
  const sh = Math.sin(b * Math.PI * 4)
  const side = sideOf(b)
  const d = dip(p)
  for (let i = 0; i < 2; i++) {
    const out = i ? 1 : -1
    k[i] = 0.45 + 0.16 * d
    fx[i] = out * 0.1
    if (out === m) arm(i, -2.75 + 0.12 * Math.sin(b * Math.PI * 2), 0, out * (0.4 + 0.15 * Math.sin(b * Math.PI * 2)), -0.35 + 0.25 * sh, 0)
    else arm(i, 0.15, 0, out * 0.75, -1.6, -out * 1.2)
    D.lift[i] = 0.02 * Math.max(0, out * sh)
  }
  hx = 0.1 * side * e
  const body = D.body
  body.rz = 0.09 * side
  body.ry = 0.1 * side
  D.chestTurn = sh * 0.1 * e
  body.head = -0.08 + 0.1 * d
  D.headRoll = -0.05 * side
}

/**
 * The moonwalk: on each beat one foot is up on its toes (knee bent) and stays
 * where it is on the floor while the other, flat, slides back past it; then
 * they change. The body glides back six beats, then walks forward two to
 * where it started, a loop of two bars.
 */
const moon: Move = (b, p, _q, e, m) => {
  const n = Math.floor(b)
  const loop = frac(b / 8) * 8
  const v = 0.16 // metres a beat
  const toes = n % 2 === 0 ? m : -m
  if (loop < 6) {
    hz = 0.48 - v * loop
    for (let i = 0; i < 2; i++) {
      const out = i ? 1 : -1
      const up = out === toes
      // In the body's frame: the planted toes come forward, the sliding foot goes back.
      fz[i] = hz + (up ? -v / 2 + v * p : v / 2 - v * p)
      k[i] = up ? 0.62 : 0.04
      fx[i] = out * HIPX
    }
  } else {
    const u = (loop - 6) / 2
    hz = 0.48 - v * 6 * (1 - ease(u))
    for (let i = 0; i < 2; i++) {
      const out = i ? 1 : -1
      const up = out === toes
      fz[i] = hz + (up ? 0.1 * Math.sin(Math.PI * p) : 0)
      k[i] = up ? 0.5 * Math.sin(Math.PI * p) + 0.05 : 0.08
      fx[i] = out * HIPX
    }
  }
  for (let i = 0; i < 2; i++) {
    const out = i ? 1 : -1
    arm(i, 0.12 * Math.sin(b * Math.PI) * out, 0, out * 0.14, -0.55)
  }
  const body = D.body
  body.rx = -0.04
  body.head = -0.05 + 0.1 * hit(p, 0.3) * e
}

const MOVES: Record<DanceStyle, Move[]> = {
  coupe: [decale, shimmy, grippe, travail, roule],
  zouglou: [ciel, clapZ, avance],
  gweta: [hanches, vague, mouchoir],
  travail: [travail],
  moonwalk: [moon],
}
export const MOVE_NAMES: Record<DanceStyle, string[]> = {
  coupe: ['décalé', 'épaules', 'grippe aviaire', 'travailment', 'roulé'],
  zouglou: ['bras au ciel', 'claps', 'avance-recule'],
  gweta: ['hanches', 'vague', 'mouchoir'],
  travail: ['travailment'],
  moonwalk: ['moonwalk'],
}

/** Fills D for this dance, now, for this Sim: the move changes every two bars, each Sim its own order. */
export function dance(style: DanceStyle, seed: number) {
  const b = beatsOf(style)
  const p = frac(b)
  const q = Math.floor(b) % 4
  const list = MOVES[style]
  const e = 0.85 + 0.3 * draw(seed, 1)
  const m = draw(seed, 2) < 0.5 ? 1 : -1
  const block = Math.floor(b / 8)
  const i = danceLab.move >= 0 ? danceLab.move % list.length : list.length === 1 ? 0 : Math.floor(draw(seed + block * 0.137, 3) * list.length)
  reset()
  list[i](b, p, q, e, m)
  // Some dance lower than others.
  const low = (draw(seed, 4) - 0.5) * 0.12
  k[0] += low
  k[1] += low
  solve()
}
