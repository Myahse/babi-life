import type { Pose } from './Human'

// The emotes' moves (the poses the player plays from the « Émotes » wheel,
// backend/internal/game/emotes.go): arms, legs and body, in the rig's terms
// (Human.tsx usePoseRig). `out`: -1 the left side, 1 the right. Arms:
// [sx, sy, sz, ex, ez]: sx swings the arm forward and up (negative), sz
// raises it out to the side (out × positive), ex bends the elbow (negative).
// Legs: [hip forward/back, hip out, knee bend]. Body: height, sway, lean
// forward (rx), sideways (rz), turn (ry), the head's nod.

export const EMOTE_POSES = ['clap', 'thumbsup', 'shrug', 'laugh', 'dab', 'heart', 'salute', 'facepalm', 'cry', 'kiss', 'bow', 'flex', 'zouglou', 'gweta', 'robot', 'moonwalk', 'kneeslide', 'meditate', 'shout'] as const
export type EmotePose = (typeof EMOTE_POSES)[number]
const IS = new Set<string>(EMOTE_POSES)
export const isEmote = (p: string): p is EmotePose => IS.has(p)
/** The fast ones: the joints follow closely. */
export const EMOTE_SNAPPY = new Set<Pose>(['clap', 'zouglou', 'gweta', 'robot', 'moonwalk', 'shout'])

type Arm = [number, number, number, number, number]
type Leg = [number, number, number]
type Body = { y?: number; x?: number; z?: number; rx?: number; rz?: number; ry?: number; head?: number }

const up = (v: number) => Math.max(0, v)
const ease = (k: number) => k * k * (3 - 2 * k)
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
/** The body bent forward from the hips (0.84 m up), the hips staying where they are. */
const lean = (rx: number): Body => ({ y: 0.84 - 0.84 * Math.cos(rx), z: -0.84 * Math.sin(rx), rx })

export function emoteArms(pose: Pose, out: number, t: number, since: number): Arm | null {
  const right = out > 0
  switch (pose) {
    case 'clap': {
      // Hands meeting in front of the chest, and apart, quick.
      const k = 0.5 + 0.5 * Math.sin(t * 11)
      return [-1.25, 0, out * (0.18 - 0.42 * k), -1.15, 0]
    }
    case 'thumbsup':
      return right ? [-1.0, 0, 0.25, -1.6, 0] : [0, 0, out * 0.1, -0.1, 0]
    case 'shrug':
      return [-0.35, 0, out * (0.7 + up(Math.sin(t * 3)) * 0.12), -1.7, 0]
    case 'laugh':
      // Hands on the belly.
      return [-0.35, 0, out * -0.15, -1.9, 0]
    case 'dab':
      // One arm up and out, the face in the crook of the other.
      return right ? [-2.5, 0, 0.9, 0, 0] : [-1.55, 0, -0.75, -2.0, 0]
    case 'heart':
      // Hands over the head, joined in a heart.
      return [-2.8, 0, out * 0.35, -1.5, 0]
    case 'salute':
      return right ? [-1.2, 0, 1.0, -2.3, 0] : [0, 0, out * 0.08, -0.1, 0]
    case 'facepalm':
      return right ? [-1.5, 0, -0.25, -2.4, 0] : [-0.3, 0, out * 0.1, -1.2, 0]
    case 'cry':
      // Both hands at the eyes, shaking with the sobs.
      return [-1.45, 0, out * -0.2, -2.45 + Math.sin(t * 14 + out) * 0.08, 0]
    case 'kiss': {
      // The hand to the mouth, then thrown out: a kiss blown.
      if (!right) return [0, 0, out * 0.1, -0.2, 0]
      const k = (since * 0.8) % 1
      const e = ease(clamp01((k - 0.4) / 0.3))
      return [-1.4 - e * 0.5, 0, 0.2 + e * 0.3, -2.4 + e * 2.0, 0]
    }
    case 'bow':
      // A hand on the heart, the other behind the back.
      return right ? [-0.9, 0, -0.35, -1.6, 0] : [0.4, 0, out * 0.1, -0.6, 0]
    case 'flex':
      // Both biceps: arms out in front, forearms up, squeezing.
      return [-1.5, 0, out * 0.95, -1.9 - Math.abs(Math.sin(t * 4)) * 0.25, 0]
    case 'zouglou': {
      // The arms swinging forward and back, one then the other, with the knees.
      const k = Math.sin(t * 6 + (right ? 0 : Math.PI))
      return [-0.6 - 0.5 * k, 0, out * 0.25, -1.2, 0]
    }
    case 'gweta':
      // Elbows bent at the chest, the shoulders shaking fast.
      return [-0.7 + Math.sin(t * 18 + out) * 0.18, 0, out * 0.45, -1.5, 0]
    case 'robot': {
      // From one position to the next, stiff, on the beat.
      const q = (Math.floor(t * 2) + (right ? 0 : 2)) % 4
      return [[-1.57, 0, -1.57, -0.8][q], 0, out * 0.15, [-1.57, -0.2, 0, -1.57][q], 0]
    }
    case 'moonwalk':
      return [Math.sin(t * Math.PI * 2) * 0.2 * out, 0, out * 0.15, -0.3, 0]
    case 'kneeslide':
      // On the knees, arms wide up: the goal of the season.
      return [-0.4, 0, out * 2.3, -0.1, 0]
    case 'meditate':
      // Hands on the knees.
      return [-0.6, 0, out * 0.35, -0.5, 0]
    case 'shout':
      // The atalaku: the mic at the mouth, the other arm pumping up.
      return right ? [-1.45, 0, 0.15, -2.35, 0] : [-0.3, 0, out * (2.2 + up(Math.sin(t * 6)) * 0.4), -0.3, 0]
    default:
      return null
  }
}

export function emoteLegs(pose: Pose, out: number, t: number): Leg | null {
  const side = out > 0 ? 0 : Math.PI
  switch (pose) {
    case 'zouglou': {
      const k = up(Math.sin(t * 6 + side))
      return [-0.25 - 0.15 * k, 0, 0.5 + 0.35 * k]
    }
    case 'gweta':
      return [-0.2 + Math.sin(t * 9 + side) * 0.08, out * 0.06, 0.45]
    case 'moonwalk': {
      // One heel up while the other foot slides back flat, in turn.
      const k = up(Math.sin(t * Math.PI * 2 + side))
      return [0.05 + 0.1 * Math.sin(t * Math.PI * 2 + side), 0, 0.6 * k]
    }
    case 'kneeslide':
      return [0.05, out * 0.08, 1.55]
    case 'meditate':
      // Cross-legged.
      return [-1.45, out * 0.9, 2.3]
    case 'bow':
      return [0, 0, 0.05]
    case 'shout':
      return [-0.1, 0, 0.15 + up(-Math.sin(t * 6)) * 0.4]
    default:
      return null
  }
}

export function emoteBody(pose: Pose, t: number, since: number): Body | null {
  switch (pose) {
    case 'clap':
      return { head: -0.05 }
    case 'thumbsup':
      return { head: -0.1 }
    case 'shrug':
      return { y: up(Math.sin(t * 3)) * 0.03, head: 0.05, rz: Math.sin(t * 1.5) * 0.04 }
    case 'laugh':
      return { y: -0.03, rx: 0.15 + Math.abs(Math.sin(t * 9)) * 0.1, head: -0.25 + Math.sin(t * 9) * 0.1 }
    case 'dab':
      return { rz: -0.15, ry: 0.3, head: 0.45 }
    case 'heart':
      return { head: -0.2 }
    case 'salute':
      return { head: -0.05 }
    case 'facepalm':
      return { rx: 0.1, head: 0.35 }
    case 'cry':
      return { y: -0.02, rx: 0.12, head: 0.4 + Math.sin(t * 5) * 0.05 }
    case 'kiss':
      return { head: -0.1 }
    case 'bow': {
      // Down, held, back up; again.
      const k = (since * 0.45) % 1
      return { ...lean(0.85 * Math.sin(k * Math.PI)), head: 0.3 }
    }
    case 'flex':
      return { y: -0.04, head: -0.1 }
    case 'zouglou':
      return { y: -0.08 - Math.abs(Math.sin(t * 6)) * 0.05, rx: 0.18, ry: Math.sin(t * 3) * 0.25 }
    case 'gweta':
      return { y: -0.12, rx: 0.1, rz: Math.sin(t * 9) * 0.12, ry: Math.sin(t * 4.5) * 0.2 }
    case 'robot':
      return { ry: [0, 0.5, 0, -0.5][Math.floor(t * 2) % 4], head: 0 }
    case 'moonwalk':
      // Gliding back, a step at a time, then again from where it started.
      return { z: 0.6 - ((since * 0.5) % 1) * 1.2, rx: -0.05, head: -0.05 }
    case 'kneeslide':
      return { y: -0.4, rx: -0.3, head: -0.4 }
    case 'meditate':
      return { y: -0.62 + Math.sin(t * 1.5) * 0.03, head: 0.15 }
    case 'shout':
      return { y: up(Math.sin(t * 6)) * 0.1, rx: 0.15, head: -0.1 }
    default:
      return null
  }
}
