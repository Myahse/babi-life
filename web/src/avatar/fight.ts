// The moves of the street fight (components/defi/combat): the guard, the
// jab, the cross, the uppercut, the kicks, the sweep, the throw, being hit,
// knocked down, getting up. Like the match's moves (Human.tsx sportLegs…),
// each is a function of `since`, the seconds into the move; usePoseRig eases
// the joints to them, quickly. `out`: -1 the lead side (the jab's arm, the
// front foot), 1 the rear side (the cross, the high kick).

export const FIGHT_POSES = [
  'fstance',
  'fwalk',
  'fback',
  'fcrouch',
  'fjump',
  'jab',
  'cross',
  'uppercut',
  'highkick',
  'lowpunch',
  'sweep',
  'airpunch',
  'airkick',
  'fblock',
  'flowblock',
  'fhit',
  'fhitlow',
  'fair',
  'fdown',
  'fgetup',
  'fko',
  'fgrab',
  'fthrown',
  'fsuper',
  'fdash',
] as const
export type FightPose = (typeof FIGHT_POSES)[number]
const IS = new Set<string>(FIGHT_POSES)
export const isFight = (p: string): p is FightPose => IS.has(p)

type Leg = [number, number, number]
type Arm = [number, number, number, number, number]
type Body = { y?: number; x?: number; z?: number; rx?: number; rz?: number; ry?: number; head?: number }

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const ease = (x: number) => x * x * (3 - 2 * x)
/** Out to a move's full reach and back: up over `a` s, held till `b`, back by `c`. */
const reach = (since: number, a: number, b: number, c: number) => (since < a ? ease(since / a) : since < b ? 1 : 1 - ease(clamp01((since - b) / (c - b))))
const mix = (p: number[], q: number[], k: number) => p.map((v, i) => v + (q[i] - v) * k)

// The fighter's guard: fists up by the chin, elbows in; the lead fist a little further out.
const GUARD_LEAD: Arm = [-1.05, 0, -0.32, -1.85, 0]
const GUARD_REAR: Arm = [-0.8, 0, -0.38, -2.2, 0]
const guard = (out: number): Arm => (out < 0 ? GUARD_LEAD : GUARD_REAR).map((v, i) => (i === 2 ? v * out : v)) as Arm
// On the balls of the feet, the lead foot forward, knees soft.
const stanceLeg = (out: number, t: number): Leg => {
  const b = Math.sin(t * 7) * 0.05
  return out < 0 ? [-0.38, out * 0.06, 0.42 + b] : [0.3, out * 0.1, 0.34 + b]
}
// Down low: a deep squat.
const crouchLeg = (out: number): Leg => (out < 0 ? [-1.35, out * 0.12, 2.0] : [-0.9, out * 0.18, 2.2])

export function fightLegs(pose: string, out: number, t: number, since: number): Leg | null {
  switch (pose) {
    case 'fstance':
    case 'fblock':
    case 'jab':
    case 'cross':
    case 'fgrab':
      return stanceLeg(out, t)
    case 'fwalk':
    case 'fback':
    case 'fdash': {
      // Shuffling, the feet never crossing: the lead foot reaches, the rear one follows.
      const k = Math.sin(t * (pose === 'fdash' ? 18 : 10) + (out < 0 ? 0 : 1.6))
      const [h, z, kn] = stanceLeg(out, t)
      return [h + k * 0.16 * (pose === 'fback' ? -1 : 1), z, kn + Math.max(0, k) * 0.25]
    }
    case 'fcrouch':
    case 'flowblock':
    case 'lowpunch':
      return crouchLeg(out)
    case 'fjump':
    case 'airpunch':
      // Knees tucked up.
      return [-1.1, out * 0.1, 1.7]
    case 'airkick':
      // The flying kick: the lead leg out straight, the other tucked.
      return out < 0 ? [-1.25 * reach(since, 0.08, 0.5, 0.7), out * 0.1, 0.1 + 1.4 * (1 - reach(since, 0.08, 0.5, 0.7))] : [-0.6, out * 0.1, 1.8]
    case 'uppercut': {
      // Down, then driving up off the legs.
      const k = clamp01(since / 0.11)
      const [h, z, kn] = stanceLeg(out, t)
      return [h - (1 - k) * 0.35, z, kn + (1 - k) * 0.55]
    }
    case 'highkick': {
      // The roundhouse: the rear knee chambered, the leg whipped out at head height, back down.
      if (out < 0) return [-0.2, -0.05, 0.25]
      const e = reach(since, 0.15, 0.24, 0.5)
      const chamber = since < 0.15 ? ease(since / 0.15) : 1 - e
      return [0.3 - 1.95 * Math.max(e, chamber * 0.7), out * (0.15 + 0.55 * e), 0.35 + 1.5 * chamber * (1 - e) + 0.05]
    }
    case 'sweep': {
      // Down on the lead leg, the rear one swept out along the ground.
      if (out < 0) return [-1.4, -0.1, 2.1]
      const e = reach(since, 0.13, 0.23, 0.5)
      return [-0.2 - 1.15 * e, out * (0.3 + 0.7 * e), 0.6 * (1 - e) + 0.05]
    }
    case 'fhit':
      // Thrown back a step.
      return out < 0 ? [-0.15, out * 0.08, 0.3] : [0.35, out * 0.1, 0.45]
    case 'fhitlow':
      return [-0.4, out * 0.08, 0.7]
    case 'fair':
    case 'fthrown':
      // Legs flung up, apart.
      return [-0.8 + Math.sin(since * 14 + out) * 0.25, out * 0.25, 0.6]
    case 'fdown':
    case 'fko':
      // On the back, the legs out, one knee a little up.
      return out < 0 ? [-0.05, out * 0.18, 0.1] : [-0.45, out * 0.14, 0.8]
    case 'fgetup': {
      const k = ease(clamp01(since / 0.4))
      return mix([-1.4, out * 0.15, 2.0], stanceLeg(out, t), k) as Leg
    }
    case 'fsuper': {
      // Running in, the feet going fast.
      const k = Math.sin(since * 22 + (out < 0 ? 0 : Math.PI))
      return [-0.35 + k * 0.45, out * 0.08, 0.5 + Math.max(0, -k) * 0.8]
    }
    default:
      return null
  }
}

export function fightArms(pose: string, out: number, _t: number, since: number): Arm | null {
  const lead = out < 0
  switch (pose) {
    case 'fstance':
    case 'fwalk':
    case 'fback':
    case 'fcrouch':
    case 'fdash':
    case 'fjump':
      return guard(out)
    case 'jab': {
      // The lead fist straight out at the face, and back to the guard.
      if (!lead) return guard(out)
      const e = reach(since, 0.06, 0.12, 0.25)
      return mix(guard(out), [-1.6, 0, -0.12 * out, -0.05, 0], e) as Arm
    }
    case 'cross': {
      if (lead) return mix(guard(out), [-0.7, 0, -0.35 * out, -2.3, 0], reach(since, 0.08, 0.15, 0.33)) as Arm
      const e = reach(since, 0.08, 0.15, 0.33)
      return mix(guard(out), [-1.6, 0, -0.32 * out, -0.05, 0], e) as Arm
    }
    case 'uppercut': {
      // The rear fist dropped low, then driven up past the chin, the elbow bent.
      if (lead) return guard(out)
      if (since < 0.11) return mix(guard(out), [-0.35, 0, -0.2 * out, -1.95, 0], ease(since / 0.11)) as Arm
      const e = reach(since - 0.11, 0.07, 0.15, 0.4)
      return mix([-0.35, 0, -0.2 * out, -1.95, 0], [-2.55, 0, -0.25 * out, -1.2, 0], e) as Arm
    }
    case 'highkick':
    case 'airkick':
      // The arms out for balance, the lead one kept up.
      return lead ? [-1.2, 0, -0.2 * out, -1.7, 0] : [0.35, 0, 0.6 * out, -0.6, 0]
    case 'lowpunch': {
      if (!lead) return guard(out)
      const e = reach(since, 0.06, 0.12, 0.26)
      return mix(guard(out), [-1.25, 0, -0.1 * out, -0.05, 0], e) as Arm
    }
    case 'sweep':
      // A hand down on the ground, the other up.
      return lead ? [-0.55, 0, 0.35 * out, -0.15, 0] : guard(out)
    case 'airpunch': {
      if (!lead) return guard(out)
      return mix(guard(out), [-1.2, 0, -0.12 * out, -0.05, 0], reach(since, 0.05, 0.3, 0.45)) as Arm
    }
    case 'fblock':
      // The forearms up across the face.
      return [-1.65, 0, -0.5 * out, -1.75, 0]
    case 'flowblock':
      return [-1.0, 0, -0.42 * out, -1.5, 0]
    case 'fhit':
      // The arms flung out.
      return [0.25, 0, 0.75 * out, -0.55, 0]
    case 'fhitlow':
      // Hands to the belly.
      return [-0.75, 0, -0.45 * out, -1.5, 0]
    case 'fair':
    case 'fthrown':
      return [-2.4 + Math.sin(since * 12 + out) * 0.4, 0, 0.9 * out, -0.4, 0]
    case 'fdown':
    case 'fko':
      // On the back, the arms out wide.
      return [-0.2, 0, 1.25 * out, -0.25, 0]
    case 'fgetup':
      return mix([-0.4, 0, 0.6 * out, -0.4, 0], guard(out), ease(clamp01(since / 0.4))) as Arm
    case 'fgrab': {
      // Both hands out for the collar, then the throw across.
      const e = ease(clamp01(since / 0.08))
      const swing = clamp01((since - 0.12) / 0.25)
      return mix(mix(guard(out), [-1.45, 0, -0.3 * out, -0.45, 0], e), [-2.3, 0, (lead ? 0.6 : -0.6) * out, -0.6, 0], swing) as Arm
    }
    case 'fsuper': {
      // The coupé-décalé flurry: fist after fist, left, right, left…
      const n = Math.floor(since / 0.09)
      const k = (since % 0.09) / 0.09
      const mine = (n % 2 === 0) === lead
      return mine ? (mix(guard(out), [-1.6, 0, -0.15 * out, -0.05, 0], Math.sin(k * Math.PI)) as Arm) : guard(out)
    }
    default:
      return null
  }
}

export function fightBody(pose: string, t: number, since: number): Body | null {
  const bob = Math.sin(t * 7) * 0.012
  switch (pose) {
    case 'fstance':
    case 'fwalk':
    case 'fback':
    case 'fdash':
      return { y: -0.06 + bob, rx: pose === 'fdash' ? 0.25 : 0.1, ry: -0.3, head: 0.12 }
    case 'fblock':
      return { y: -0.09, rx: 0.12, ry: -0.2, head: 0.3 }
    case 'jab':
      return { y: -0.06, z: 0.06 * reach(since, 0.06, 0.12, 0.25), rx: 0.14, ry: -0.42, head: 0.1 }
    case 'cross': {
      const e = reach(since, 0.08, 0.15, 0.33)
      return { y: -0.07, z: 0.14 * e, rx: 0.16, ry: -0.3 + 0.75 * e, head: 0.1 }
    }
    case 'uppercut': {
      const k = clamp01(since / 0.11)
      return since < 0.11 ? { y: -0.16 * k, rx: 0.3 * k, ry: -0.1 + 0.3 * k, head: 0.15 } : { y: -0.16 + 0.22 * reach(since - 0.11, 0.07, 0.15, 0.4), rx: 0.3 - 0.4 * reach(since - 0.11, 0.07, 0.15, 0.4), ry: 0.4, head: -0.15 }
    }
    case 'highkick': {
      const e = reach(since, 0.15, 0.24, 0.5)
      return { y: -0.02, rx: -0.2 * e, rz: 0.4 * e, ry: 0.5 * e, head: -0.1 }
    }
    case 'fcrouch':
    case 'flowblock':
      return { y: -0.48, rx: 0.3, ry: -0.25, head: 0 }
    case 'lowpunch':
      return { y: -0.48, z: 0.05 * reach(since, 0.06, 0.12, 0.26), rx: 0.35, ry: -0.35, head: 0 }
    case 'sweep': {
      // Down low, turning with the sweep.
      const e = reach(since, 0.13, 0.23, 0.5)
      return { y: -0.62, rx: 0.2, ry: -0.3 + 0.9 * e, head: 0 }
    }
    case 'fjump':
    case 'airpunch':
    case 'airkick':
      return { y: 0.1, rx: pose === 'airkick' ? -0.35 : 0.15, ry: -0.2, head: 0.1 }
    case 'fhit':
      return { y: -0.04, z: -0.05, rx: -0.38, ry: 0, head: -0.45 }
    case 'fhitlow':
      return { y: -0.1, rx: 0.55, ry: 0, head: 0.45 }
    case 'fair':
    case 'fthrown': {
      // Up and over backwards (thrown: right round).
      const spin = pose === 'fthrown' ? -Math.min(Math.PI * 1.6, since * 9) : -Math.min(1.45, 0.4 + since * 3)
      return { y: 0.25, rx: spin, ry: 0, head: -0.3 }
    }
    case 'fdown':
    case 'fko':
      // Flat on the back, the feet towards the other.
      return { y: 0.13, rx: -1.52, ry: 0, head: pose === 'fko' ? 0.15 : -0.1 }
    case 'fgetup': {
      const k = ease(clamp01(since / 0.4))
      return { y: 0.13 * (1 - k) - 0.06 * k - Math.sin(k * Math.PI) * 0.25, rx: -1.52 * (1 - k) + 0.1 * k, ry: -0.3 * k, head: 0.1 }
    }
    case 'fgrab':
      return { y: -0.06, z: 0.12, rx: 0.15, ry: since > 0.12 ? -1.2 * ease(clamp01((since - 0.12) / 0.25)) : 0, head: 0.05 }
    case 'fsuper':
      return { y: -0.1, z: 0.1, rx: 0.32, ry: Math.sin(since * 35) * 0.35, head: 0.05 }
    default:
      return null
  }
}
