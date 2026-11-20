import type { Pose } from './Human'

// Adult intimacy poses (18+, gate adult_at). Two roles per act. Naked blocky
// bodies (outfit « nu »): layout + rhythmic thrust — nothing faded to black.

export const INTIMACY_POSES = [
  'bjGive', 'bjRecv',
  'hjGive', 'hjRecv',
  'cowgirlTop', 'cowgirlBottom',
  'revCowgirlTop', 'revCowgirlBottom',
  'doggyRear', 'doggyFront',
  'missionaryTop', 'missionaryBottom',
  'spoonBig', 'spoonLittle',
  'standGive', 'standRecv',
  'lotusA', 'lotusB',
  'sixtyA', 'sixtyB',
  // Club pole (barre de fer): hang / spin / invert — used by the dancers on the iron bar.
  'poleHang', 'poleSpin', 'poleInvert',
] as const
export type IntimacyPose = (typeof INTIMACY_POSES)[number]
const IS = new Set<string>(INTIMACY_POSES)
export const isIntimacy = (p: string): p is IntimacyPose => IS.has(p)

export type IntimacyAct = 'bj' | 'hj' | 'cowgirl' | 'rev-cowgirl' | 'doggy' | 'missionary' | 'spoon' | 'stand' | 'lotus' | 'sixty'

/** Interaction IDs shared with the server (game/gonow.go). */
export const INTIMACY_IDS: Record<IntimacyAct, string> = {
  bj: 'intimite-bj',
  hj: 'intimite-hj',
  cowgirl: 'intimite-cowgirl',
  'rev-cowgirl': 'intimite-rev-cowgirl',
  doggy: 'intimite-doggy',
  missionary: 'intimite-missionary',
  spoon: 'intimite-spoon',
  stand: 'intimite-stand',
  lotus: 'intimite-lotus',
  sixty: 'intimite-sixty',
}

/** Club: private dance with a pole girl (catalog + GoNow). */
export const POLE_PRIVATE_ID = 'barre-privee'

export const intimacyActOf = (id: string): IntimacyAct | null => {
  for (const [act, iid] of Object.entries(INTIMACY_IDS) as [IntimacyAct, string][]) {
    if (iid === id) return act
  }
  return null
}

type Arm = [number, number, number, number, number]
type Leg = [number, number, number]
type Body = { y?: number; x?: number; z?: number; rx?: number; rz?: number; ry?: number; head?: number }

/** Soft sine. */
const s = (t: number, hz: number, amp = 1) => Math.sin(t * hz) * amp
/** Thrust curve: sharper push, softer return. */
const thrust = (t: number, hz = 3.2) => {
  const u = (Math.sin(t * hz) + 1) / 2
  return Math.pow(u, 1.35) * 2 - 1
}

export function intimacyArms(pose: Pose, out: number, t: number): Arm | null {
  const right = out > 0
  const bob = s(t, 3.2, 0.08)
  const pump = s(t, 5.5, 0.14)
  switch (pose) {
    case 'bjGive':
      // Both hands on the hips / shaft; head bob driven by body.rx / head.
      return right
        ? [-0.95 + bob, 0.05, 0.45 + s(t, 3.2, 0.06), -1.55 + pump * 0.2, 0]
        : [-0.95 - bob, -0.05, -0.45 - s(t, 3.2, 0.06), -1.55 + pump * 0.2, 0]
    case 'bjRecv':
      // One hand in her hair / on her head, the other open.
      return right
        ? [-1.35 + bob * 0.5, 0.15, 0.55, -1.85 + s(t, 3.2, 0.1), 0.15]
        : [0.25, 0, out * 0.2, -0.35, 0]
    case 'hjGive':
      // Working hand in front, fast; other on a thigh.
      return right
        ? [-0.75 + s(t, 7.2, 0.18), 0.1, 0.2, -1.65 + s(t, 7.2, 0.22), 0]
        : [-0.65, 0, -0.35, -1.15, 0]
    case 'hjRecv':
      return right ? [0.15, 0, out * 0.15, -0.35, 0] : [-0.55 + bob, 0, out * -0.12, -0.95, 0]
    case 'cowgirlTop':
      // Hands on his chest / shoulders, riding.
      return [-0.85 + bob * (right ? 1 : -1), 0.1, out * 0.4, -1.7 + s(t, 3.6, 0.12), 0]
    case 'revCowgirlTop':
      // Hands on his thighs, leaning a little.
      return [-0.55 + bob * (right ? 1 : -1), 0, out * 0.55, -1.35 + s(t, 3.6, 0.1), 0]
    case 'cowgirlBottom':
    case 'revCowgirlBottom':
      // Hands on her hips / waist.
      return [-1.25 + bob * 0.4, 0, out * 0.55, -1.75 + s(t, 3.6, 0.08), 0]
    case 'doggyRear':
      // Grip her waist / hips, thrusting.
      return [-1.05 + bob, 0.05, out * 0.35, -1.45 + s(t, 4.0, 0.1), 0]
    case 'doggyFront':
      // On all fours: arms planted on the bed.
      return [-1.7 + s(t, 4.0, 0.05), 0, out * 0.2, -0.25, 0]
    case 'missionaryTop':
      // Weight on elbows / hands beside her head.
      return [-1.45 + bob, 0.1, out * 0.55, -1.65 + s(t, 3.4, 0.1), 0]
    case 'missionaryBottom':
      // Legs up — arms around his back / on the sheets.
      return [-1.05 + bob * 0.5, 0, out * 0.65, -1.75, 0]
    case 'spoonBig':
      return right
        ? [-0.95 + bob, 0.1, 0.55, -1.45 + s(t, 2.8, 0.08), 0]
        : [-0.7, 0, -0.25, -1.2, 0]
    case 'spoonLittle':
      return [-0.55 + bob * 0.4, 0, out * 0.2, -1.1, 0]
    case 'standGive':
      // Hold her thigh / waist against the wall.
      return [-1.0 + bob, 0.1, out * 0.4, -1.5 + s(t, 3.8, 0.12), 0]
    case 'standRecv':
      // Hands braced on the wall.
      return [-1.75 + s(t, 3.8, 0.04), 0.05, out * 0.25, -0.35, 0]
    case 'lotusA':
    case 'lotusB':
      // Arms around each other's back / neck.
      return [-1.0 + bob * (right ? 1 : -1), 0.15, out * 0.45, -1.85 + s(t, 2.6, 0.08), 0]
    case 'sixtyA':
    case 'sixtyB':
      return [-1.15 + bob, 0, out * 0.3, -1.35 + s(t, 3.0, 0.1), 0]
    case 'poleHang':
      return [-2.45, 0, out * 0.12, -0.45 + s(t, 2.2, 0.06), 0]
    case 'poleSpin':
      return right ? [-2.55, 0.05, 0.25, -0.35, 0] : [-0.45 + s(t, 2.8, 0.1), 0, out * 0.45, -1.25, 0]
    case 'poleInvert':
      return [-2.65, 0, out * 0.08, -0.25, 0]
    default:
      return null
  }
}

export function intimacyLegs(pose: Pose, out: number, t: number): Leg | null {
  const th = thrust(t)
  const bob = s(t, 3.6, 0.1)
  switch (pose) {
    case 'bjGive':
      // Kneeling, knees apart a little.
      return [0.2 + s(t, 3.2, 0.04), out * 0.22, 1.6]
    case 'bjRecv':
    case 'hjRecv':
      // Seated, thighs open.
      return [-1.4, out * 0.48, 1.5]
    case 'hjGive':
      // Kneeling / crouched beside.
      return [-0.2 + bob * 0.3, out * 0.28, 0.55]
    case 'cowgirlTop':
      // Knees wide, sitting on him.
      return [-0.3 + th * 0.1, out * 0.6, 1.45 - th * 0.06]
    case 'revCowgirlTop':
      return [-0.3 + th * 0.1, out * 0.62, 1.4 - th * 0.06]
    case 'cowgirlBottom':
    case 'revCowgirlBottom':
      // Flat on his back (group already -π/2): nearly straight along the sheet.
      return [0.05, out * 0.32, 0.12]
    case 'doggyRear':
      // Kneeling close behind.
      return [out > 0 ? -0.4 + th * 0.1 : -0.2 + th * 0.04, out * 0.18, 1.5]
    case 'doggyFront':
      // All fours.
      return [-0.5 + s(t, 4.0, 0.03), out * 0.22, 1.45]
    case 'missionaryTop':
      return [-0.5 + th * 0.08, out * 0.3, 1.1]
    case 'missionaryBottom':
      // Legs up around him (group on back).
      return [-0.85 + s(t, 3.4, 0.04), out * 0.8, 1.35]
    case 'spoonBig':
    case 'spoonLittle':
      // Soft bent, on the side / back.
      return [-0.25 + th * 0.05, out * 0.2, 0.7]
    case 'standGive':
      // One leg planted, the other driving under her.
      return [out > 0 ? -0.25 + th * 0.16 : 0.08, out * 0.1, out > 0 ? 0.95 : 0.2]
    case 'standRecv':
      // One leg lifted / hooked.
      return [out > 0 ? -0.15 : 0.35 + th * 0.08, out * 0.18, out > 0 ? 0.25 : 1.05]
    case 'lotusA':
    case 'lotusB':
      // Cross-legged / wrapped around.
      return [-1.25 + s(t, 2.6, 0.04), out * 0.62, 1.55]
    case 'sixtyA':
    case 'sixtyB':
      return [-0.35 + bob * 0.5, out * 0.48, 1.3]
    case 'poleHang':
      return [0.25 + bob * 0.4, out * 0.3, 0.45]
    case 'poleSpin':
      return [out > 0 ? -0.45 + bob : 0.55, out * 0.4, out > 0 ? 1.25 : 0.35]
    case 'poleInvert':
      return [-0.35, out * 0.25, 0.55]
    default:
      return null
  }
}

export function intimacyBody(pose: Pose, t: number): Body | null {
  const th = thrust(t)
  const soft = s(t, 2.8, 1)
  switch (pose) {
    case 'bjGive':
      // Kneeling into his lap: lean hard forward (local +Z toward him when facing him).
      return { y: -0.38 + th * 0.01, z: 0.06 + th * 0.03, rx: 0.55 + th * 0.1, head: 0.85 + th * 0.12 }
    case 'bjRecv':
      return { y: -0.38, rx: 0.1 + soft * 0.02, head: -0.3 + soft * 0.04, z: 0.02 }
    case 'hjGive':
      return { y: -0.08, rx: 0.35 + s(t, 7.2, 0.04), head: 0.5, z: 0.04 + s(t, 7.2, 0.015) }
    case 'hjRecv':
      return { y: -0.38, rx: 0.08, head: -0.12 + s(t, 7.2, 0.05) }
    case 'cowgirlTop':
      // Sit on his hips (group is on-back above the sheet).
      return { y: -0.42 + th * 0.03, rx: 0.05 + soft * 0.02, head: -0.02 + soft * 0.03 }
    case 'revCowgirlTop':
      return { y: -0.42 + th * 0.03, rx: 0.1 + soft * 0.02, ry: Math.PI, head: 0.06 }
    case 'cowgirlBottom':
      // Flat: the IntimateScene group already tilts −π/2; keep a small sheet clearance on local +Z (→ world +Y).
      return { y: 0, z: 0.14, rx: 0.02, head: 0.1 + soft * 0.02 }
    case 'revCowgirlBottom':
      return { y: 0, z: 0.14, rx: 0.02, head: 0.08 }
    case 'doggyRear':
      return { y: -0.35, rx: 0.5 + th * 0.04, head: 0.12, z: th * 0.015 }
    case 'doggyFront':
      return { y: -0.3, rx: 0.7 + th * 0.025, head: 0.32 + soft * 0.025 }
    case 'missionaryTop':
      return { y: -0.22 + th * 0.01, rx: 0.28 + th * 0.03, head: 0.12, z: th * 0.015 }
    case 'missionaryBottom':
      return { y: 0, z: 0.14, rx: 0.02, head: 0.1 + soft * 0.02 }
    case 'spoonBig':
      return { y: 0, z: 0.14 + th * 0.015, rx: 0.02, rz: 0.12 }
    case 'spoonLittle':
      return { y: 0, z: 0.14 + th * 0.01, rx: 0.02, rz: 0.12 }
    case 'standGive':
      return { y: 0.01 + th * 0.01, rx: 0.22 + th * 0.06, head: 0.08, z: 0.02 + th * 0.02 }
    case 'standRecv':
      return { y: 0.03 + th * 0.012, rx: -0.02 + th * 0.02, head: -0.12, z: 0.03 }
    case 'lotusA':
      return { y: -0.42 + soft * 0.012, rx: 0.08, head: -0.03, z: 0.02 + th * 0.012 }
    case 'lotusB':
      return { y: -0.42 + soft * 0.012, rx: 0.08, head: -0.03, z: -0.02 - th * 0.012 }
    case 'sixtyA':
      return { y: 0, z: 0.14, rx: 0.15, head: 0.35 + s(t, 3.0, 0.025) }
    case 'sixtyB':
      return { y: 0, z: 0.14, rx: 0.15, ry: Math.PI, head: 0.35 + s(t, 3.0, 0.025) }
    case 'poleHang':
      return { y: 0.38 + soft * 0.05, rx: -0.18, head: -0.22 }
    case 'poleSpin':
      return { y: 0.18 + soft * 0.07, rx: 0.28, rz: soft * 0.1, head: 0.12 }
    case 'poleInvert':
      return { y: 0.9, rx: Math.PI, head: 0.2 }
    default:
      return null
  }
}

/** Shared pulse for the couple's layout (IntimateScene rocks the groups). */
export function intimacyPulse(act: IntimacyAct, t: number): number {
  const hz = act === 'hj' ? 7.0 : act === 'bj' ? 3.4 : act === 'doggy' || act === 'stand' ? 4.0 : act === 'lotus' || act === 'spoon' ? 2.6 : 3.5
  return thrust(t, hz)
}

/** Sim vs partner roles for an act. */
export function intimacyRoles(act: IntimacyAct, simFemme: boolean): { sim: IntimacyPose; other: IntimacyPose } {
  switch (act) {
    case 'bj':
      return { sim: 'bjRecv', other: 'bjGive' }
    case 'hj':
      return { sim: 'hjRecv', other: 'hjGive' }
    case 'cowgirl':
      return simFemme ? { sim: 'cowgirlTop', other: 'cowgirlBottom' } : { sim: 'cowgirlBottom', other: 'cowgirlTop' }
    case 'rev-cowgirl':
      return simFemme ? { sim: 'revCowgirlTop', other: 'revCowgirlBottom' } : { sim: 'revCowgirlBottom', other: 'revCowgirlTop' }
    case 'doggy':
      return { sim: 'doggyRear', other: 'doggyFront' }
    case 'missionary':
      return { sim: 'missionaryTop', other: 'missionaryBottom' }
    case 'spoon':
      return { sim: 'spoonBig', other: 'spoonLittle' }
    case 'stand':
      return { sim: 'standGive', other: 'standRecv' }
    case 'lotus':
      return { sim: 'lotusA', other: 'lotusB' }
    case 'sixty':
      return { sim: 'sixtyA', other: 'sixtyB' }
  }
}
