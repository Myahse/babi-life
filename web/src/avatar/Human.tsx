import { createContext, useContext, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Look, Sim } from '../lib/types'
import { LowHuman } from './LowHuman'
import { BlockBaby, BlockHuman } from './BlockHuman'
import { worldTime } from '../lib/worldClock'

// The game's Sims: the blocky avatar (avatar/BlockHuman.tsx) up close, a
// simpler blocky figure (avatar/LowHuman.tsx) far away, and the poses that
// move them both (usePoseRig). Units are metres: feet on y=0, facing +Z.

export type Pose = 'idle' | 'walk' | 'run' | 'leap' | 'hang' | 'wash' | 'sleep' | 'pray' | 'cook' | 'phone' | 'busy' | 'hero' | 'wave' | 'dance' | 'cheer' | 'hug' | 'beg' | 'rant' | 'sit' | 'eat' | 'drink' | 'write' | 'throw' | 'talk' | 'dribble' | 'shoot' | 'kick' | 'keeper' | 'touch' | 'mark' | 'guard' | 'dive' | 'airplane' | 'pass' | 'salat'

/** Poses done sitting on a chair (hips at seat height). */
export const SEATED: Pose[] = ['sit', 'eat', 'drink', 'write']
const SEAT_DROP = 0.41

const Shadows = createContext(true)
/** Wrap crowds in this: background Sims don't need to cast shadows. */
export const NoShadows = ({ children }: { children: React.ReactNode }) => <Shadows.Provider value={false}>{children}</Shadows.Provider>
/** Whether the people here cast shadows (not in a NoShadows crowd). */
export const useCastShadows = () => useContext(Shadows)

/* ---------- The poses ---------- */

/** The joints the poses move: the groups of a Sim's head, chest, legs and arms. */
export type Rig = {
  root: React.RefObject<THREE.Object3D | null>
  head: React.RefObject<THREE.Object3D | null>
  chest: React.RefObject<THREE.Object3D | null>
  hip: React.RefObject<THREE.Object3D | null>[]
  knee: React.RefObject<THREE.Object3D | null>[]
  shoulder: React.RefObject<THREE.Object3D | null>[]
  elbow: React.RefObject<THREE.Object3D | null>[]
}

/** How a body moves on top of the poses (1 everywhere: the default motion). */
export type RigStyle = {
  /** How quickly joints reach their pose (higher: snappier). */
  snap?: number
  /** Leg and arm swing when walking or running. */
  swing?: number
  /** How much elbows bend when walking or running (blocky arms stay straighter). */
  elbow?: number
  /** How much knees lift when walking or running. */
  knee?: number
  /** The head nodding with the steps. */
  headBob?: number
}

/** What a Sim standing about does with itself now and then. */
export type Fidget = 'scratch' | 'watch' | 'cross' | 'hips' | 'wipe' | 'stretch' | 'phone'
const FIDGETS: { kind: Fidget; len: number }[] = [
  { kind: 'scratch', len: 2.4 },
  { kind: 'watch', len: 2.2 },
  { kind: 'cross', len: 5 },
  { kind: 'hips', len: 4.5 },
  { kind: 'wipe', len: 2 },
  { kind: 'stretch', len: 3 },
  { kind: 'phone', len: 4.5 },
]
/** In development, the lab can hold one gesture to look at it (globalThis.fidget.kind = 'hips'). */
const FORCED: { kind?: Fidget } = {}
if (import.meta.env.DEV) (globalThis as unknown as { fidget: typeof FORCED }).fidget = FORCED
const FIDGET_EVERY = 8 // seconds: one chance of a gesture in each
/**
 * The gesture a Sim standing about is making at time t (null most of the
 * time), and how far into it (e: 0 → 1 → 0, eased). Each Sim has its own
 * rhythm (seed); every screen sees the same, from the shared clock.
 */
export function fidgetAt(t: number, seed: number): { kind: Fidget; e: number } | null {
  if (import.meta.env.DEV && FORCED.kind) return { kind: FORCED.kind, e: 1 }
  const u = t + seed * 13.7
  const slot = Math.floor(u / FIDGET_EVERY)
  const n = Math.sin(slot * 91.17 + seed * 47.3) * 43758.5453
  const r = n - Math.floor(n)
  if (r < 0.45) return null
  const f = FIDGETS[Math.floor(((r - 0.45) / 0.55) * FIDGETS.length) % FIDGETS.length]
  const at = u - slot * FIDGET_EVERY - 0.8
  if (at < 0 || at > f.len) return null
  // In over 0.45 s, held, out over 0.5 s.
  const k = Math.min(1, at / 0.45, (f.len - at) / 0.5)
  return { kind: f.kind, e: k * k * (3 - 2 * k) }
}

/* ---------- The salat: everyone at the mosque moves together ---------- */

/**
 * Where the prayer is (from the shared clock, not the Sim's: the rows move
 * as one): 0 standing, arms folded; 1 bowing; 2 standing again; 3
 * prostrated; 4 sitting back on the heels. A rak'a every 30 s.
 */
export function salatStep(): { step: 0 | 1 | 2 | 3 | 4; k: number } {
  const u = (worldTime() % 30) / 30
  const bounds = [0.36, 0.5, 0.6, 0.8, 1]
  const i = bounds.findIndex((b) => u < b)
  const start = i ? bounds[i - 1] : 0
  return { step: i as 0 | 1 | 2 | 3 | 4, k: (u - start) / (bounds[i] - start) }
}

/* ---------- Sport: the moves of a match (open/match.ts picks them) ---------- */

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const ease = (x: number) => x * x * (3 - 2 * x)
/** Legs for the match's moves: hip x, hip z, knee x; `since`: seconds into the move. */
function sportLegs(pose: Pose, out: number, t: number, since: number): [number, number, number] | null {
  switch (pose) {
    case 'kick': {
      // The right leg: drawn back, swung through the ball, followed through; the left one planted.
      if (out < 0) return [-0.1, 0, 0.32]
      const p = clamp01(since / 0.45)
      if (p < 0.35) return [0.6 * ease(p / 0.35), 0, 1.35 * ease(p / 0.35)]
      if (p < 0.6) {
        const q = ease((p - 0.35) / 0.25)
        return [0.6 - 1.95 * q, 0, 1.35 * (1 - q) + 0.1 * q]
      }
      return [-1.35 + 0.45 * ease((p - 0.6) / 0.4), 0, 0.12]
    }
    case 'shoot': {
      // A jump shot: knees bend, then the jump.
      const p = clamp01(since / 0.7)
      return p < 0.3 ? [-0.45 * ease(p / 0.3), 0, 0.8 * ease(p / 0.3)] : [-0.1, 0, p < 0.85 ? 0.12 : 0.3]
    }
    case 'pass':
      return out > 0 ? [-0.38 * ease(clamp01(since / 0.3)), 0, 0.2] : [0.12, 0, 0.25]
    case 'mark':
    case 'guard':
      // Low, knees bent, feet apart, ready to go either way.
      return [-0.42, out * 0.16 + Math.sin(t * 6) * 0.05, 0.7]
    case 'dive':
      return [-0.18, out * 0.08, 0.25]
    case 'salat': {
      const { step } = salatStep()
      // Bowing: the body leans, the legs stay upright. Prostrated: kneeling, the thighs forward a little, the shins flat behind. Sitting: on the heels.
      return step === 1 ? [-1.35, 0, 0.05] : step === 3 ? [-2.1, out * 0.05, 2.17] : step === 4 ? [0.05, out * 0.05, 1.55] : [0, out * 0.04, 0.02]
    }
    default:
      return null
  }
}
/** Arms for the match's moves: shoulder x, y, z, elbow x, z. */
function sportArms(pose: Pose, out: number, t: number, since: number, armSwing: number): [number, number, number, number, number] | null {
  switch (pose) {
    case 'kick':
      // Arms out for balance, the left one forward as the right leg strikes.
      return [out < 0 ? -0.8 : 0.45, 0, out * 0.75, -0.35, 0]
    case 'shoot': {
      // The ball from the chest to over the head, released at the top of the jump; the wrist follows through.
      const p = clamp01(since / 0.7)
      const k = ease(clamp01((p - 0.25) / 0.35))
      return [-1.05 - 1.85 * k, 0, out * (0.28 - 0.16 * k), -1.75 + 1.45 * k, 0]
    }
    case 'pass': {
      // A chest pass: both hands push the ball away, thumbs down.
      const k = ease(clamp01(since / 0.3))
      return [-0.9 - 0.55 * k, 0, out * (0.28 - 0.18 * k), -1.85 + 1.7 * k, 0]
    }
    case 'touch':
      // Dribbling: arms out a little for balance, swinging with the stride.
      return [armSwing * 0.55, 0, out * 0.38, -0.85, 0]
    case 'mark':
      return [-0.35 + Math.sin(t * 6 + out) * 0.08, 0, out * 0.55, -0.55, 0]
    case 'guard':
      // Arms up and wide, hands reaching for the ball.
      return [-0.95 + Math.sin(t * 4 + out * 1.3) * 0.25, 0, out * 1.2, -0.3, 0]
    case 'dive':
      // Stretched out over the head, for the ball.
      return [-0.25, 0, out * (2.7 - 0.4 * (1 - clamp01(since / 0.3))), -0.12, 0]
    case 'airplane':
      // The scorer's run: arms out like wings.
      return [0.05, 0, out * 1.45, -0.05, 0]
    case 'salat': {
      const { step } = salatStep()
      // Standing: the right hand over the left on the chest; bowing: hands on the knees; prostrated: palms on the ground ahead; sitting: hands on the thighs.
      return step === 0 ? [-0.5, 0, -out * 0.42, -1.75, 0] : step === 1 ? [-1.1, 0, out * 0.1, -0.1, 0] : step === 3 ? [-2.2, 0, out * 0.3, -0.3, 0] : step === 4 ? [-0.45, 0, out * 0.08, -0.9, 0] : [0, 0, out * 0.06, -0.05, 0]
    }
    default:
      return null
  }
}
/** The body as a whole: height, lean forward (rx) and sideways (rz), the head's nod; null where the pose doesn't change it. */
function sportBody(pose: Pose, t: number, since: number): { y?: number; x?: number; z?: number; rx?: number; rz?: number; head?: number } | null {
  switch (pose) {
    case 'kick':
      return { rx: since < 0.3 ? 0.08 : -0.12, head: 0.3 }
    case 'shoot': {
      const p = clamp01(since / 0.7)
      return { y: p < 0.3 ? -0.11 * ease(p / 0.3) : p < 0.85 ? Math.sin(((p - 0.3) / 0.55) * Math.PI) * 0.32 : 0, head: -0.25 }
    }
    case 'pass':
      return { rx: 0.12, head: 0 }
    case 'touch':
      // Eyes on the ball.
      return { rx: 0.18, head: 0.3 }
    case 'mark':
    case 'guard':
      return { y: -0.1, x: Math.sin(t * 3) * 0.12, rx: 0.15, head: 0.05 }
    case 'dive': {
      // Off the feet and sideways, down onto the grass.
      const k = ease(clamp01(since / 0.35))
      return { y: -0.42 * k + Math.sin(k * Math.PI) * 0.25, rz: -1.35 * k, head: 0 }
    }
    case 'airplane':
      return { rz: Math.sin(t * 2.6) * 0.3, rx: 0.05, head: -0.15 }
    case 'salat': {
      const { step } = salatStep()
      // The body turns about the feet: moved so the hips stay where they should be (the hip is 0.84 m up the body).
      const lean = (rx: number, hip: number) => ({ y: hip - 0.84 * Math.cos(rx), z: -0.84 * Math.sin(rx), rx })
      return step === 1 ? { ...lean(1.35, 0.84), head: -0.2, x: 0 } : step === 3 ? { ...lean(1.5, 0.4), head: -0.3, x: 0 } : step === 4 ? { y: -0.4, z: 0, rx: 0, head: 0.25, x: 0 } : { y: 0, z: 0, rx: 0, head: 0.2, x: 0 }
    }
    default:
      return null
  }
}

/**
 * Moves a rig for a pose, every frame: index 0 of each pair is the side at -x.
 * Rotations are about the rest pose's axes (the person faces +z): x swings a
 * limb forward (negative) or back, z raises it sideways.
 */
export function usePoseRig({ root, head, chest, hip, knee, shoulder, elbow }: Rig, pose: Pose, seed: number, speed?: number, style: RigStyle = {}) {
  const { snap = 1, swing: swingK = 1, elbow: elbowK = 1, knee: kneeK = 1, headBob = 0 } = style
  // The walk's phase, carried on frame to frame so the stride can change
  // pace without a jump; where the eyes look, changing now and then.
  const phase = useRef<number | null>(null)
  const glance = useRef({ y: 0, x: 0, next: 0 })
  // When this pose began: a kick, a shot, a dive move on through their phases.
  const began = useRef({ pose, t: 0 })
  useFrame((_, dtRaw) => {
    // Never backwards (a video rendered frame by frame can step back), at most 0.1 s.
    const dt = Math.min(Math.max(dtRaw, 0), 0.1)
    const t = worldTime() + seed
    if (began.current.pose !== pose) began.current = { pose, t: worldTime() + seed }
    const since = worldTime() + seed - began.current.t
    const run = pose === 'run' || pose === 'touch' || pose === 'airplane'
    const walk = pose === 'walk' || run || pose === 'dribble'
    const seated = SEATED.includes(pose)
    // Steps follow the speed: cadence and stride grow with it, so feet don't slide.
    const v = speed ?? (run ? 8 : 1.4)
    const cadence = run ? 1.5 + v * 0.07 : Math.min(2.1, 0.85 + v * 0.3)
    // It starts from the shared clock, so a walker's steps are in time on every screen.
    phase.current = (phase.current ?? t * Math.PI * 2 * cadence) + dt * Math.PI * 2 * cadence
    const ph = phase.current
    const s = Math.sin(ph)
    const stride = (run ? (pose === 'touch' ? 0.7 : 0.95) : Math.min(0.62, 0.3 + v * 0.09)) * swingK
    // Every joint eases to where it should be: no jump from one pose to the
    // next. Moving in rhythm (walking, dancing) the joints follow closely, so
    // the swing keeps its shape; changing pose they glide.
    const rhythmic = walk || pose === 'dance' || pose === 'throw' || pose === 'cheer' || pose === 'leap' || pose === 'hang' || pose === 'wash' || pose === 'cook'
    const a = 1 - Math.exp(-(rhythmic ? 30 : 13) * snap * dt)
    const to = (o: THREE.Euler | THREE.Vector3, k: 'x' | 'y' | 'z', target: number) => void (o[k] += (target - o[k]) * a)
    // Standing: the weight goes from one leg to the other, slowly.
    const shift = Math.sin(t * 0.35 + seed)
    // Standing about: now and then a gesture (scratching the head, the watch…).
    const fid = pose === 'idle' ? fidgetAt(t, seed) : null
    // Dancing: the beat of coupé-décalé, about 126 a minute.
    const beat = t * 2.1 * Math.PI * 2
    const bounce = Math.max(0, Math.sin(beat)) // knees give on each beat
    // Cheering: a jump, knees bending before it and after the landing.
    const jump = Math.sin(t * 5)
    for (const i of [0, 1]) {
      const out = i === 0 ? -1 : 1 // -1 = left side (-X)
      const h = hip[i].current!
      const kn = knee[i].current!
      // Where this leg is in its stride: 0 the heel comes down in front, ½ it's behind, about to leave.
      const u = (((ph / (Math.PI * 2) + (out > 0 ? 0 : 0.5)) % 1) + 1) % 1
      const near = (c: number, w: number) => {
        const d = Math.min(Math.abs(u - c), 1 - Math.abs(u - c))
        return Math.exp(-((d / w) ** 2))
      }
      // A kick: the right leg swung through; the keeper, knees bent, ready.
      const kick = pose === 'kick' && out > 0
      // The gait: the hip swings the leg forward and back (a little more forward than back)…
      const gaitHip = -stride * Math.cos(u * Math.PI * 2) - stride * 0.15
      // …the knee gives a little as the foot lands, then folds as the leg swings through
      // (much more running: the heel comes up behind).
      const gaitKnee = (run ? 0.45 * near(0.15, 0.1) + 1.9 * near(0.72, 0.17) : 0.22 * near(0.12, 0.09) + 1.0 * near(0.72, 0.14)) * kneeK + 0.04
      const danceStep = pose === 'dance' ? out * Math.max(0, out * Math.sin(beat / 2)) * 0.14 : 0
      // Hanging off the gbaka: the inner foot on the step, the outer leg dangling, swinging with the road.
      const dangle = Math.sin(t * 3.1 + seed) * 0.12
      const sl = sportLegs(pose, out, t, since)
      to(h.rotation, 'x', sl ? sl[0] : pose === 'pray' ? 0.05 : pose === 'sleep' ? 0 : pose === 'leap' ? -0.95 : pose === 'hang' ? (out > 0 ? -0.35 : 0.3 + dangle) : seated ? -1.5 : kick ? -1.15 : pose === 'keeper' ? -0.45 : walk ? gaitHip : pose === 'dance' || pose === 'throw' ? -0.18 - bounce * 0.16 : pose === 'cheer' ? -Math.max(0, -jump) * 0.4 : 0)
      to(h.rotation, 'z', sl ? sl[1] : pose === 'hang' ? (out < 0 ? -0.35 : 0.05) : pose === 'leap' ? out * 0.08 : walk || seated ? 0 : pose === 'dance' ? danceStep : out * shift * 0.03)
      to(kn.rotation, 'x', sl ? sl[2] : pose === 'pray' ? 1.55 : pose === 'sleep' ? 0.05 : pose === 'leap' ? 1.35 : pose === 'hang' ? (out > 0 ? 0.55 : 0.35 - dangle) : seated ? 1.5 : kick ? 0.15 : pose === 'keeper' ? 0.8 : walk ? gaitKnee : pose === 'dance' || pose === 'throw' ? 0.32 + bounce * 0.32 : pose === 'cheer' ? Math.max(0, -jump) * 0.8 : Math.max(0, -out * shift) * 0.12)
      // The arm on this side swings against this leg.
      const armSwing = stride * Math.cos(u * Math.PI * 2)
      const sh = shoulder[i].current!
      const el = elbow[i].current!
      let [sx, sy, sz, ex, ez] = [0, 0, out * 0.1, -0.12, 0]
      const sa = sportArms(pose, out, t, since, armSwing)
      if (sa) {
        ;[sx, sy, sz, ex, ez] = sa
      } else if (pose === 'wash') {
        // Under the water: one hand scrubbing the head, the other the arms and the chest.
        const k = Math.sin(t * 6 + i * 1.3)
        ;[sx, sz, ex] = out > 0 ? [-2.3 + k * 0.15, 0.5, -1.9 + k * 0.35] : [-0.9 + k * 0.35, -0.25, -1.4 + k * 0.25]
      } else if (pose === 'sleep') {
        ;[sx, sz, ex] = [0, out * 0.06, -0.08]
      } else if (pose === 'pray') {
        // Kneeling, hands joined in front.
        ;[sx, sz, ex] = [-1.05, out * -0.32, -0.95]
      } else if (pose === 'cook') {
        // Stirring the pot with the right hand, holding it with the left.
        ;[sx, sz, ex] = out > 0 ? [-0.95 + Math.cos(t * 4) * 0.15, 0.15 + Math.sin(t * 4) * 0.15, -1.05] : [-0.75, -0.15, -0.9]
      } else if (pose === 'phone' && out > 0) {
        // The phone at the ear.
        ;[sx, sz, ex] = [-1.35, 0.35, -2.35]
      } else if (pose === 'phone') {
        const g = Math.max(0, Math.sin(t * 2.6))
        ;[sx, sz, ex] = [-0.3 - g * 0.5, -0.14, -0.5 - g * 0.6]
      } else if (pose === 'leap') {
        // Both arms reaching forward and up, for the door frame.
        ;[sx, sz, ex] = [-2.1 + (out > 0 ? -0.2 : 0), out * 0.25, -0.35]
      } else if (pose === 'hang' && out > 0) {
        // The inner hand up on the door frame, holding on.
        ;[sx, sz, ex] = [-0.35, 2.45, -0.25]
      } else if (pose === 'hang') {
        // The outer arm out, waving at the people on the sidewalk, calling the stops.
        ;[sx, sz, ex, ez] = [-0.3 + Math.sin(t * 2.2) * 0.15, -1.55 - Math.max(0, Math.sin(t * 2.2)) * 0.5, -0.4, Math.sin(t * 8) * 0.3]
      } else if (pose === 'dance') {
        // Coupé-décalé: elbows bent, forearms in front swinging across, the
        // shoulders shrugging on the beat, the arms changing every two beats.
        const sway = Math.sin(beat / 2 + i * Math.PI)
        ;[sx, sz, ex] = [-0.55 - bounce * 0.2 - sway * 0.25, out * (0.3 + bounce * 0.12), -1.35 - Math.sin(beat + i) * 0.2]
        sy = sway * 0.35
      } else if (pose === 'cheer') {
        // Arms up, hands shaking, a little further up at the top of the jump.
        ;[sx, sz, ex] = [-0.25, out * (2.55 + Math.max(0, jump) * 0.25 + Math.sin(t * 13 + i) * 0.08), -0.25]
      } else if (pose === 'busy') {
        ;[sx, sz, ex] = [-1.1 + Math.sin(t * 6 + i) * 0.25, out * 0.15, -0.9 + Math.sin(t * 6 + i) * 0.2]
      } else if (pose === 'wave' && out > 0) {
        ;[sx, sz, ex, ez] = [0, 2.6, 0, 0.35 + Math.sin(t * 9) * 0.35]
      } else if ((pose === 'eat' || pose === 'drink') && out > 0) {
        // Fork (or bottle) to the mouth, and back to the plate.
        const k = Math.max(0, Math.sin(t * (pose === 'eat' ? 2.4 : 1.2)))
        ;[sx, sz, ex] = [-0.6 - k * 0.75, 0.12, -0.9 - k * 1.1]
      } else if (pose === 'write' || ((pose === 'eat' || pose === 'drink') && out < 0)) {
        // Forearms on the table.
        ;[sx, sz, ex] = [-0.55, out * 0.1, -1.0 + (pose === 'write' && out > 0 ? Math.sin(t * 7) * 0.08 : 0)]
      } else if (pose === 'throw' && out > 0) {
        // The travaillement: the hand goes back to the wad, takes a few notes,
        // and flicks them out and up over the dancers; again, and again.
        const k = (t * 2.4) % 1
        const flick = k < 0.6 ? 0 : k < 0.75 ? (k - 0.6) / 0.15 : 1 - (k - 0.75) / 0.25
        const f = flick * flick * (3 - 2 * flick)
        ;[sx, sz, ex] = [-1.05 - f * 0.95, -0.3 + f * 0.8, -1.55 + f * 1.15]
      } else if (pose === 'throw') {
        // The wad held at the chest in the other hand.
        ;[sx, sz, ex] = [-0.95, 0.32, -1.55]
      } else if (pose === 'hug') {
        // Arms around the other one, swaying a little.
        ;[sx, sz, ex] = [-1.25, out * -0.35, -0.9 + Math.sin(t * 1.3 + i) * 0.05]
      } else if (pose === 'beg' && out > 0) {
        // A hand held out at the car window.
        ;[sx, sz, ex] = [-1.05 + Math.sin(t * 2) * 0.05, 0.1, -0.35]
      } else if (pose === 'rant') {
        // Talking to nobody, arms going.
        const g = Math.sin(t * 4.5 + i * 2.1)
        ;[sx, sz, ex] = [-0.7 - g * 0.6, out * (0.3 + Math.max(0, g) * 0.6), -0.8 + g * 0.3]
      } else if (pose === 'talk') {
        // Talking with someone: one hand making the point, now and then.
        const g = Math.max(0, Math.sin(t * 2.6 + i * 1.7))
        ;[sx, sz, ex] = [-0.25 - g * 0.55 * (out > 0 ? 1 : 0.4), out * 0.14, -0.5 - g * 0.6]
      } else if (pose === 'dribble' && out > 0) {
        // The hand pushing the ball down, bounce after bounce.
        ;[sx, sz, ex] = [-0.55 + Math.sin(t * 14) * 0.3, 0.32, -0.5 + Math.sin(t * 14) * 0.25]
      } else if (pose === 'shoot') {
        // Both arms up, the ball released over the head.
        ;[sx, sz, ex] = [-2.85, out * 0.12, -0.35]
      } else if (pose === 'keeper') {
        // Arms out, ready to dive.
        ;[sx, sz, ex] = [-0.5, out * 0.75, -0.4]
      } else if (pose === 'kick') {
        // Arms out for balance.
        ;[sx, sz, ex] = [out * 0.35, out * 0.7, -0.3]
      } else if (pose === 'hero' && out > 0) {
        ;[sx, sz, ex, ez] = [0.15, 0.6, -0.35, -1.75]
      } else if (run) {
        // Arms bent near a right angle, pumping hard against the legs.
        ;[sx, sz, ex] = [armSwing * 1.1, out * 0.1, (-1.5 + Math.cos(armSwing) * 0.15 - Math.max(0, -armSwing) * 0.3) * elbowK]
      } else if (walk) {
        // Arms swing against the legs, loosely: the elbow bends more as the arm comes forward.
        ;[sx, sz, ex] = [armSwing * 0.8, out * 0.07, (-0.22 - Math.max(0, -armSwing) * 0.55) * elbowK]
      } else {
        // Standing: arms hanging loose, breathing.
        ;[sx, sz, ex] = [Math.sin(t * 1.2 + i) * 0.03, out * (0.1 + Math.max(0, out * shift) * 0.03), -0.14]
        if (fid) {
          const right = out > 0
          // [shoulder x, shoulder z, elbow x, elbow z]
          const gest: [number, number, number, number] | null =
            fid.kind === 'scratch' && right ? [-2.5, 0.75, -1.75 + Math.sin(t * 15) * 0.18, 0]
            : fid.kind === 'watch' && !right ? [-1.05, -0.3, -1.55, 0]
            : fid.kind === 'watch' ? [-0.45, -0.12, -0.85, 0] // the other hand comes up a little
            : fid.kind === 'cross' ? [-0.75, out * -0.42, -1.95, 0]
            : fid.kind === 'hips' ? [0.12, out * 0.75, -0.2, -out * 1.55] // elbows out, hands back on the hips
            : fid.kind === 'wipe' && right ? [-2.35, 0.35 + Math.sin(t * 5) * 0.25, -2.05, 0]
            : fid.kind === 'stretch' ? [-0.15, out * (2.75 + Math.sin(t * 2) * 0.05), -0.25, 0]
            : fid.kind === 'phone' && right ? [-0.95, 0.12, -1.45, 0]
            : fid.kind === 'phone' ? [-0.75, -0.1, -1.3, 0]
            : null
          if (gest) {
            ;[sx, sz, ex] = [sx + (gest[0] - sx) * fid.e, sz + (gest[1] - sz) * fid.e, ex + (gest[2] - ex) * fid.e]
            ez += (gest[3] - ez) * fid.e
          }
        }
      }
      to(sh.rotation, 'x', sx)
      to(sh.rotation, 'y', sy)
      to(sh.rotation, 'z', sz)
      to(el.rotation, 'x', ex)
      to(el.rotation, 'z', ez)
    }
    const body = sportBody(pose, t, since)
    const r = root.current!
    to(
      r.position,
      'y',
      body?.y !== undefined
        ? body.y
        : pose === 'pray'
        ? -0.4
        : seated
        ? -SEAT_DROP
        : pose === 'keeper'
          ? -0.1
          : run
          ? // Up off each push, down as the foot takes the weight.
            0.02 + Math.max(0, Math.sin(ph * 2 - 0.9)) * 0.08
          : walk
            ? // Lowest as each heel comes down, highest over the standing leg.
              -Math.cos(ph * 2) * (0.012 + stride * 0.03) - 0.01
            : pose === 'busy'
              ? Math.abs(Math.sin(t * 6)) * 0.02
              : pose === 'dance' || pose === 'throw'
                ? -0.05 - bounce * 0.05
                : pose === 'cheer'
                  ? Math.max(0, jump) * 0.22 - Math.max(0, -jump) * 0.07
                  : Math.sin(t * 1.6) * 0.003 - Math.abs(shift) * 0.006,
    )
    // Standing, the hips sit over one leg then the other.
    // The hips over the standing leg: walking, from side to side with each step; dancing, the décalé; standing, slowly.
    // Forward or back (only the prayer's bow and prostration move it).
    to(r.position, 'z', body?.z ?? 0)
    to(r.position, 'x', body?.x !== undefined ? body.x : walk ? Math.sin(ph) * (run ? 0.012 : 0.025) : seated ? 0 : pose === 'dance' ? Math.sin(beat / 2) * 0.09 : shift * 0.018)
    // Breathing: the chest rises a little (faster after running).
    if (chest.current) {
      const b = Math.sin(t * (pose === 'run' ? 4.5 : 1.7))
      chest.current.scale.set(1 + b * 0.006, 1, 1 + b * (pose === 'run' ? 0.025 : 0.014))
      // Walking, the shoulders turn against the hips.
      to(chest.current.rotation, 'y', walk ? -s * stride * 0.22 : 0)
    }
    // Leaning into the run; the hips sway with the steps, or with the weight.
    to(r.rotation, 'x', body?.rx !== undefined ? body.rx : pose === 'leap' ? 0.3 : pose === 'hang' ? 0.05 : run ? 0.2 : walk ? 0.04 : pose === 'dance' ? 0.06 + bounce * 0.04 : pose === 'throw' ? 0.05 : 0)
    to(r.rotation, 'z', body?.rz !== undefined ? body.rz : pose === 'hang' ? 0.28 + Math.sin(t * 3.1 + seed) * 0.03 : walk ? -Math.sin(ph) * 0.03 * stride : seated ? 0 : pose === 'dance' ? -Math.sin(beat / 2) * 0.05 : -shift * 0.02)
    to(r.rotation, 'y', pose === 'wash' ? Math.sin(t * 0.7) * 0.5 : pose === 'dance' ? Math.sin(beat / 2) * 0.28 + Math.sin(t * 0.4 + seed) * 0.4 : pose === 'throw' ? Math.sin(beat / 4) * 0.1 : pose === 'rant' ? Math.sin(t * 0.9) * 0.5 : pose === 'hug' ? Math.sin(t * 0.8) * 0.06 : walk ? s * stride * 0.12 : 0)
    // The eyes: looking ahead when walking; otherwise a glance here, then there.
    const g = glance.current
    if (t > g.next) {
      const n = Math.sin(t * 12.9898 + seed * 78.233) * 43758.5453
      const rnd = n - Math.floor(n)
      g.y = rnd < 0.5 ? 0 : (rnd - 0.75) * 1.1
      g.x = (rnd * 7) % 1 < 0.3 ? 0.08 : 0
      g.next = t + 1.5 + rnd * 3.5
    }
    const hd = head.current!
    const look = fid && (fid.kind === 'watch' || fid.kind === 'phone') ? fid.e : 0
    to(hd.rotation, 'y', fid?.kind === 'watch' ? -0.35 * fid.e : pose === 'sleep' || pose === 'pray' ? 0 : walk ? -s * stride * 0.1 : pose === 'rant' ? Math.sin(t * 2.3) * 0.45 : pose === 'talk' ? Math.sin(t * 0.9) * 0.12 : g.y)
    to(hd.rotation, 'z', fid?.kind === 'scratch' ? -0.14 * fid.e : pose === 'phone' ? 0.12 : pose === 'sleep' ? 0.25 : pose === 'wave' ? 0.08 : pose === 'talk' ? Math.sin(t * 1.3) * 0.05 : 0)
    to(hd.rotation, 'x', body?.head !== undefined ? body.head : pose === 'sleep' ? 0.35 : pose === 'pray' || pose === 'cook' ? 0.3 : pose === 'wash' ? -0.25 : pose === 'busy' || pose === 'write' ? 0.25 : pose === 'eat' ? 0.1 : pose === 'drink' ? -0.15 : pose === 'hug' ? 0.15 : pose === 'beg' ? 0.12 : pose === 'dance' ? bounce * 0.12 - 0.05 : pose === 'cheer' ? -0.2 : walk ? (run ? -0.12 : -0.02) + Math.sin(ph * 2) * 0.03 * headBob : g.x + Math.sin(t * 0.7) * 0.02 + look * 0.42 - (fid?.kind === 'stretch' ? fid.e * 0.3 : 0))
  })
}


/* ---------- The whole Sim ---------- */

type Props = { look: Look; gender: Sim['gender']; pose?: Pose; seed?: number; /** Children have bigger heads for their size (1 = adult). */ headScale?: number; /** Walking speed (m/s): the steps follow it. */ speed?: number }

/**
 * A person: the blocky Sim up close, and a simpler blocky figure (LowHuman)
 * past FAR metres from the camera, where the detail can't be seen anyway. The
 * switch has some slack so nobody flickers between the two at the border.
 */
const FAR = 24
export function Human(props: Props & { /** Always in full detail (the creator, close-ups). */ full?: boolean }) {
  const anchor = useRef<THREE.Group>(null)
  const [far, setFar] = useState(false)
  const at = useRef(new THREE.Vector3())
  useFrame(({ camera }) => {
    if (props.full || !anchor.current) return
    const d = anchor.current.getWorldPosition(at.current).distanceTo(camera.position)
    if (!far && d > FAR + 3) setFar(true)
    else if (far && d < FAR - 3) setFar(false)
  })
  return (
    <group ref={anchor}>
      {far && !props.full ? <LowHuman look={props.look} gender={props.gender} pose={props.pose} seed={props.seed} speed={props.speed} /> : <BlockHuman {...props} />}
    </group>
  )
}

/** A baby, in blocks too (see BlockBaby). */
export const Baby = BlockBaby
