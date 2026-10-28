import type { Pose } from './Human'

// The gestures of the trades (a task done at work, backend game/jobs.go, the
// Sim's « Pose »): each job its own. The cashier sweeps the articles past the
// scanner, the coiffeur snips, the teacher writes on the board, the gendarme
// waves the cars on… In the rig's terms (Human.tsx usePoseRig, as emotes.ts):
// arms [sx, sy, sz, ex, ez], `out` -1 the left side, 1 the right; and the
// head's nod (positive: looking down).

export const JOB_POSES = ['scan', 'cash', 'serve', 'cut', 'braid', 'inject', 'stetho', 'board', 'stamp', 'shelve', 'pump', 'direct', 'carry', 'hand', 'mic', 'whistle', 'point', 'present', 'display'] as const
export type JobPose = (typeof JOB_POSES)[number]
const IS = new Set<string>(JOB_POSES)
export const isJob = (p: string): p is JobPose => IS.has(p)

type Arm = [number, number, number, number, number]
const up = (v: number) => Math.max(0, v)
const ease = (k: number) => k * k * (3 - 2 * k)
/** A hand on the hip. */
const hip = (out: number): Arm => [0.25, 0, out * 0.6, -1.6, 0]

export function jobArms(pose: Pose, out: number, t: number): Arm | null {
  if (!isJob(pose)) return null
  const right = out > 0
  switch (pose) {
    case 'scan': {
      // The article swept past the scanner, left to right, a beep, the next.
      const k = (t * 1.3) % 1
      const sweep = ease(Math.min(1, k / 0.55))
      return right ? [-1.05, 0, -0.35 + sweep * 0.75, -1.0 + sweep * 0.25, 0] : [-0.85, 0, out * 0.05, -1.25, 0]
    }
    case 'cash': {
      // The notes held in one hand, counted off with the thumb of the other.
      return right ? [-0.95, 0, 0.02, -1.4 + up(Math.sin(t * 9)) * 0.16, Math.sin(t * 9) * 0.15] : [-1.0, 0, out * -0.2, -1.5, 0]
    }
    case 'serve': {
      // The tray up on one hand, the other setting the plates down on the table.
      const k = up(Math.sin(t * 1.4))
      return right ? [-0.55 - k * 0.6, 0, 0.12, -0.6 - k * 0.35, 0] : [-1.15, 0, out * 0.35, -1.65, 0]
    }
    case 'cut': {
      // At head height: the comb in one hand, the scissors (or the clippers) snipping in the other.
      return right ? [-2.0 + Math.sin(t * 2) * 0.12, 0, 0.25, -1.25 + Math.sin(t * 12) * 0.14, Math.sin(t * 12) * 0.2] : [-1.85, 0, out * 0.3, -1.55, 0]
    }
    case 'braid': {
      // Both hands up at the client's head, twisting the strands over each other.
      const s = Math.sin(t * 5 + (right ? 0 : Math.PI))
      return [-1.75 + s * 0.18, 0, out * 0.18, -1.45 - s * 0.12, s * 0.4]
    }
    case 'inject': {
      // The syringe forward, the thumb pressing slowly; the other hand holding the arm.
      const k = (t * 0.6) % 1
      return right ? [-1.2, 0, 0.08, -0.75 - ease(k) * 0.3, 0] : [-1.05, 0, out * -0.15, -0.85, 0]
    }
    case 'stetho': {
      // The stethoscope: one hand on the patient's chest, moving it about; the other at the ear.
      return right ? [-1.3 + Math.sin(t * 0.9) * 0.08, 0, 0.05 + Math.sin(t * 0.7) * 0.1, -0.7, 0] : [-1.25, 0, out * 0.4, -2.3, 0]
    }
    case 'board': {
      // Writing up on the board, the chalk going; the book in the other hand.
      return right ? [-2.45 + Math.sin(t * 2.5) * 0.1, 0, 0.3 + Math.sin(t * 7) * 0.12, -0.35 + Math.sin(t * 9) * 0.06, 0] : [-0.7, 0, out * 0.12, -1.45, 0]
    }
    case 'stamp': {
      // The stamp lifted… and down on the paper, the other hand holding it flat.
      const k = (t * 1.5) % 1
      const lift = k < 0.65 ? ease(k / 0.65) : 1 - ease(Math.min(1, (k - 0.65) / 0.12))
      return right ? [-0.95 - lift * 0.85, 0, 0.15, -1.2 + lift * 0.45, 0] : [-0.75, 0, out * 0.08, -0.95, 0]
    }
    case 'shelve': {
      // Up to the shelf in turns: one hand puts an article up there, then the other.
      const reach = up(Math.sin(t * 2.2 + (right ? 0 : Math.PI)))
      return [-0.85 - reach * 1.35, 0, out * 0.15, -1.15 + reach * 0.85, 0]
    }
    case 'pump': {
      // The nozzle in the tank, the hand squeezing; the other on the hip.
      return right ? [-0.8, 0, 0.22, -0.55 - up(Math.sin(t * 4)) * 0.08, 0] : hip(out)
    }
    case 'direct': {
      // The traffic: one arm out flat, stopping the cars; the other waving the others on.
      return right ? [-0.15, 0, 1.5, -0.05, 0] : [-1.35 + Math.sin(t * 3.2) * 0.55, 0, out * 0.2, -0.5 + Math.sin(t * 3.2) * 0.35, 0]
    }
    case 'carry': {
      // The suitcase held up against the chest, both arms round it.
      return [-0.85 + Math.sin(t * 2.4) * 0.03, 0, out * -0.08, -1.15, 0]
    }
    case 'hand': {
      // Handing over (the keys, the medicine): the hand goes out, opens, comes back.
      const k = up(Math.sin(t * 1.3))
      return right ? [-0.45 - k * 0.85, 0, 0.1, -1.15 + k * 0.85, 0] : [-0.25, 0, out * 0.1, -0.45, 0]
    }
    case 'mic': {
      // The mic at the mouth, the other arm going out to the people.
      return right ? [-1.3, 0, 0.32, -2.2, 0] : [-1.0 - up(Math.sin(t * 2.6)) * 0.4, 0, out * (0.55 + up(Math.sin(t * 2.6)) * 0.3), -0.4, 0]
    }
    case 'whistle': {
      // The whistle at the lips, now and then a blow; the other hand on the hip.
      return right ? [-1.3, 0, 0.3, -2.3 + up(Math.sin(t * 3)) * 0.06, 0] : hip(out)
    }
    case 'point': {
      // Showing the way: the arm out, pointing, the other at rest.
      return right ? [-1.4 + Math.sin(t * 1.1) * 0.06, 0, 0.55 + Math.sin(t * 0.6) * 0.15, -0.12, 0] : [0.02, 0, out * 0.12, -0.25, 0]
    }
    case 'present': {
      // Arms open, palms up: « Mesdames et messieurs… ».
      const k = up(Math.sin(t * 1.6))
      return [-0.55 - k * 0.2, 0, out * (0.75 + k * 0.2), -0.55, out * 0.3]
    }
    case 'display': {
      // An outfit held up at the shoulders, shown to the client, turned a little.
      return [-1.55 + Math.sin(t * 1.2) * 0.08, 0, out * 0.28, -0.65, 0]
    }
  }
  return null
}

/** The head: looking at what the hands do (positive, down), or up at the board, the shelf, the client's hair. */
export function jobHead(pose: Pose, t: number): number | undefined {
  if (!isJob(pose)) return undefined
  switch (pose) {
    case 'board':
    case 'shelve':
      return -0.2
    case 'cut':
    case 'braid':
      return 0.05 + Math.sin(t * 0.8) * 0.05
    case 'mic':
    case 'whistle':
    case 'direct':
    case 'present':
    case 'point':
      return -0.05
    default:
      return 0.28
  }
}
