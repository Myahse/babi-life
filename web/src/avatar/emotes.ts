import type { Pose } from './Human'

// The emotes' moves (the poses the player plays from the « Émotes » wheel,
// backend/internal/game/emotes.go): arms, legs and body, in the rig's terms
// (Human.tsx usePoseRig). `out`: -1 the left side, 1 the right. Arms:
// [sx, sy, sz, ex, ez]: sx swings the arm forward and up (negative), sz
// raises it out to the side (out × positive), ex bends the elbow (negative).
// Legs: [hip forward/back, hip out, knee bend]. Body: height, sway, lean
// forward (rx), sideways (rz), turn (ry), the head's nod.

export const EMOTE_POSES = ['clap', 'thumbsup', 'shrug', 'laugh', 'dab', 'heart', 'salute', 'facepalm', 'cry', 'kiss', 'bow', 'flex', 'zouglou', 'gweta', 'robot', 'moonwalk', 'kneeslide', 'meditate', 'shout', 'sitground', 'lean', 'cache', 'coucou', 'shake', 'dap', 'bise', 'give', 'sitclap', 'sitlaugh'] as const
export type EmotePose = (typeof EMOTE_POSES)[number]
const IS = new Set<string>(EMOTE_POSES)
export const isEmote = (p: string): p is EmotePose => IS.has(p)
/** The fast ones: the joints follow closely. */
export const EMOTE_SNAPPY = new Set<Pose>(['clap', 'sitclap', 'zouglou', 'gweta', 'robot', 'moonwalk', 'shout'])

type Arm = [number, number, number, number, number]
type Leg = [number, number, number]
type Body = { y?: number; x?: number; z?: number; rx?: number; rz?: number; ry?: number; head?: number }

/** How far the hips drop onto a seat (Human.tsx SEAT_DROP). */
const SEAT_Y = 0.41
const up = (v: number) => Math.max(0, v)
const ease = (k: number) => k * k * (3 - 2 * k)
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
/** The body bent forward from the hips (0.84 m up), the hips staying where they are. */
/** Sobbing comes in waves: stronger, then catching the breath. */
const sobs = (t: number) => 0.55 + 0.45 * Math.sin(t * 0.9)
const lean = (rx: number): Body => ({ y: 0.84 - 0.84 * Math.cos(rx), z: -0.84 * Math.sin(rx), rx })

/** Brushing the teeth: 7 s brushing, then 3 s bent over the basin rinsing; again (from when it started). */
const rinsing = (since: number) => since % 10 > 7
/** On the toilets: scrolling the phone, now and then a look up from it. */
const lookingUp = (since: number) => since % 13 > 9.5

function armsOf(pose: Pose, out: number, t: number, since: number): Arm | null {
  const right = out > 0
  switch (pose) {
    case 'brush':
      // The brush in the right hand at the mouth, going side to side; the glass in the left at the chest.
      // Rinsing: the glass to the mouth, the brush hand down.
      if (rinsing(since)) return right ? [-0.35, 0, 0.12, -0.6, 0] : [-1.15, 0, -0.32, -2.05, 0]
      return right ? [-1.3, Math.sin(t * 13) * 0.16, 0.3, -2.1, 0] : [-0.7, 0, -0.18, -1.5, 0]
    case 'toilet':
      // Sitting, the phone in the right hand in front of the face, the thumb going; the left forearm on the thigh.
      if (right) return [-0.5 + Math.sin(t * 2.1) * 0.03, 0, -0.08, -1.2 - (lookingUp(since) ? 0 : Math.sin(t * 5) * 0.03), 0]
      return [-0.6, 0, -0.06, -0.85, 0]
    case 'clap':
    case 'sitclap': {
      // Hands meeting in front of the chest, and apart, quick.
      // Not a metronome: the tempo drifts, and the hands come up a little on the louder claps.
      const k = 0.5 + 0.5 * Math.sin(t * 11 + Math.sin(t * 1.3) * 0.8)
      return [-1.25 - k * 0.08 * (0.5 + 0.5 * Math.sin(t * 0.7)), 0, out * (0.18 - 0.42 * k), -1.15, 0]
    }
    case 'thumbsup':
      return right ? [-1.0, 0, 0.25, -1.6, 0] : [0, 0, out * 0.1, -0.1, 0]
    case 'shrug':
      return [-0.35, 0, out * (0.7 + up(Math.sin(t * 3)) * 0.12), -1.7, 0]
    case 'laugh':
    case 'sitlaugh':
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
      return [-1.45, 0, out * -0.2, -2.45 + Math.sin(t * 14 + out) * 0.08 * sobs(t), 0]
    case 'kiss': {
      // The hand to the mouth, then thrown out: a kiss blown.
      if (!right) return [0, 0, out * 0.1, -0.2, 0]
      // Kissed at the mouth, thrown out fast, then the hand comes back slowly (no snap back).
      const k = (since * 0.8) % 1
      const e = k < 0.4 ? 0 : k < 0.6 ? ease((k - 0.4) / 0.2) : 1 - ease(clamp01((k - 0.7) / 0.3))
      return [-1.4 - e * 0.5, 0, 0.2 + e * 0.3, -2.4 + e * 2.0, 0]
    }
    case 'bow':
      // A hand on the heart, the other behind the back.
      return right ? [-0.9, 0, -0.35, -1.6, 0] : [0.4, 0, out * 0.1, -0.6, 0]
    case 'flex':
      // Both biceps: arms out in front, forearms up, squeezing.
      return [-1.5, 0, out * 0.95, -1.9 - Math.abs(Math.sin(t * 4)) * 0.25, 0]
    case 'robot': {
      // From one position to the next, stiff, on the beat.
      const q = (Math.floor(t * 2) + (right ? 0 : 2)) % 4
      return [[-1.57, 0, -1.57, -0.8][q], 0, out * 0.15, [-1.57, -0.2, 0, -1.57][q], 0]
    }
    case 'kneeslide':
      // On the knees, arms wide up: the goal of the season.
      return [-0.4, 0, out * 2.3, -0.1, 0]
    case 'meditate':
      // Hands on the knees.
      return [-0.6, 0, out * 0.35, -0.5, 0]
    case 'sitground':
      // Sitting on the ground, leaning back on its hands flat behind it.
      return [0.6, 0, out * 0.32, -0.05, 0]
    case 'lean':
      // Its back to the tree, arms crossed on the chest.
      return [-0.35, 0, out * -0.18, -1.75, 0]
    case 'cache':
      // Coucou-caché with the baby: kneeling, both hands flat over the face.
      return [-1.55, 0, out * -0.55, -2.25, 0]
    case 'coucou':
      // … and the hands open out either side of the face: « Coucou ! »
      return [-1.25, 0, out * 0.95, -1.7, 0]
    case 'shake': {
      // A handshake (strangers, elders): the right hand out at the waist, three pumps once it meets the
      // other's, then let go. The left hand comes to the right forearm, a mark of respect here.
      const pump = since > 0.45 && since < 1.5 ? Math.sin((since - 0.45) * 18) * 0.09 : 0
      return right ? [-1.22 + pump, 0, -0.18, -0.32, 0] : [-0.75, 0, out * -0.32, -1.25, 0]
    }
    case 'dap': {
      // The friends' « check »: hands clasped high, pulled in shoulder to shoulder, then the snap of the
      // fingers as they slide apart, the fist back to the chest.
      if (!right) return since > 0.55 && since < 1.2 ? [-1.0, 0, out * -0.35, -1.2, 0] : [0, 0, out * 0.1, -0.15, 0]
      if (since < 0.55) return [-1.75, 0, -0.12, -1.15, 0]
      if (since < 1.2) return [-1.25, 0, -0.32, -1.6, 0]
      const k = clamp01((since - 1.2) / 0.25)
      return [-1.25 + k * 0.1, 0, -0.32 + k * 0.4, -1.6 - k * 0.5, 0]
    }
    case 'bise':
      // Hands on the other's shoulders, a kiss on each cheek.
      return [-1.3, 0, out * -0.12, -0.75, 0]
    case 'give':
      // Handing something over (the notes, the plate, a gift): the hand goes out to the other and stays there.
      return right ? [-1.3, 0, -0.08, -0.35, 0] : [-0.2, 0, out * 0.1, -0.3, 0]
    case 'shout':
      // The atalaku: the mic at the mouth, the other arm pumping up.
      return right ? [-1.45, 0, 0.15, -2.35, 0] : [-0.3, 0, out * (2.2 + up(Math.sin(t * 6)) * 0.4), -0.3, 0]
    default:
      return null
  }
}

function legsOf(pose: Pose, out: number, t: number): Leg | null {
  switch (pose) {
    case 'kneeslide':
    case 'cache':
    case 'coucou':
      return [0.05, out * 0.08, 1.55]
    case 'meditate':
      // Cross-legged.
      return [-1.45, out * 0.9, 2.3]
    case 'sitclap':
    case 'sitlaugh':
      // On a chair or a school bench: thighs level, shins down.
      return [-1.5, out * 0.04, 1.5]
    case 'sitground':
      // The knees up in front, the feet flat on the ground.
      return [-1.95, out * 0.14, 1.95]
    case 'lean':
      // One foot against the trunk behind (the right), the other leg straight.
      return out > 0 ? [0.45, out * 0.05, 1.25] : [0.05, out * 0.04, 0.05]
    case 'bow':
      return [0, 0, 0.05]
    case 'shout':
      return [-0.1, 0, 0.15 + up(-Math.sin(t * 6)) * 0.4]
    default:
      return null
  }
}

function bodyOf(pose: Pose, t: number, since: number): Body | null {
  switch (pose) {
    case 'brush':
      // Upright at the mirror, the head moving a little with the brush; then bent over the basin to rinse and spit.
      if (rinsing(since)) {
        const k = Math.min(1, (since % 10) - 7) * Math.min(1, (10 - (since % 10)) * 2)
        return { ...lean(0.55 * k), head: -0.1 * k }
      }
      return { head: -0.08 + Math.sin(t * 13) * 0.02, ry: Math.sin(t * 0.7) * 0.06 }
    case 'toilet':
      // Sitting (hips at the seat), bent a little forward over the phone, head down to it; looking up now and then.
      return { y: -0.41, rx: 0.22, head: lookingUp(since) ? -0.05 : 0.42, ry: lookingUp(since) ? Math.sin(t * 0.9) * 0.3 : 0 }
    case 'clap':
      return { head: -0.05 }
    // The same, staying in the seat (a class clapping, laughing at a wrong answer).
    case 'sitclap':
      return { y: -SEAT_Y, head: -0.05 }
    case 'sitlaugh':
      return { y: -SEAT_Y, rx: 0.1 + Math.abs(Math.sin(t * 9)) * 0.08, head: -0.2 + Math.sin(t * 9) * 0.08 }
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
      return { y: -0.02 - sobs(t) * 0.015 * Math.abs(Math.sin(t * 7)), rx: 0.12 + sobs(t) * 0.04, head: 0.4 + Math.sin(t * 5) * 0.05 * sobs(t) }
    case 'kiss':
      return { head: -0.1 }
    case 'bow': {
      // Down, held, back up; again.
      const k = (since * 0.45) % 1
      return { ...lean(0.85 * Math.sin(k * Math.PI)), head: 0.3 }
    }
    case 'flex':
      return { y: -0.04, head: -0.1 }
    case 'robot':
      return { ry: [0, 0.5, 0, -0.5][Math.floor(t * 2) % 4], head: 0 }
    case 'robot':
      return { ry: [0, 0.5, 0, -0.5][Math.floor(t * 2) % 4], head: 0 }
    case 'moonwalk':
      // Gliding back, a step at a time, then again from where it started.
    case 'cache':
      return { y: -0.4, rx: 0.12, head: 0.12 }
    case 'coucou':
      return { y: -0.4, rx: -0.08, head: -0.12 }
    case 'meditate':
      return { y: -0.62 + Math.sin(t * 1.5) * 0.03, head: 0.15 }
    case 'sitground':
      // On the ground, the back a little rounded, looking about now and then.
      return { y: -0.62, rx: -0.2, ry: Math.sin(t * 0.25) * 0.15, head: 0.1 + Math.sin(t * 0.4) * 0.06 }
    case 'lean':
      // Leaning back on the trunk, easy.
      return { y: -0.03, z: -0.05, rx: -0.1, head: -0.04 + Math.sin(t * 0.3) * 0.05 }
    case 'shake':
      // A small nod over the hands.
      return { rx: 0.06, head: 0.12 }
    case 'dap':
      // Pulled in, shoulder to shoulder, and back.
      return { rx: since > 0.55 && since < 1.2 ? 0.12 : 0.02, ry: since > 0.55 && since < 1.2 ? 0.25 : 0, head: -0.05 }
    case 'bise': {
      // Leaning in, the head to one cheek, then the other.
      const side = since < 0.35 ? 0 : since < 0.95 ? 1 : since < 1.55 ? -1 : 0
      return { rx: side ? 0.14 : 0.05, ry: side * 0.32, head: 0.05 }
    }
    case 'give':
      return { rx: 0.08, head: 0.18 }
    case 'shout':
      return { y: up(Math.sin(t * 6)) * 0.1, rx: 0.15, head: -0.1 }
    default:
      return null
  }
}

/* ---------- What makes them look alive ---------- */

// The moves above are where the body goes. Played as they are, an emote
// pops in (a quick one's joints follow in a frame or two) and a held one is
// a statue. Around each: a little dip of the knees before it starts, the arms
// going a bit past the pose and settling back, then breathing and a slow sway
// while it's held. Each person a little differently (the seed is in t).

/** The emotes that loop a move; the others strike a pose and hold it. */
const LOOPED = new Set<Pose>(['clap', 'sitclap', 'sitlaugh', 'shrug', 'laugh', 'cry', 'kiss', 'bow', 'flex', 'zouglou', 'gweta', 'robot', 'moonwalk', 'shout', 'brush', 'toilet'])
const REST: Arm = [0, 0, 0.1, -0.12, 0]
/** 0 → 1 over `d` seconds, going about 8 % past the end and back. */
const overshoot = (since: number, d: number) => {
  const k = clamp01(since / d) - 1
  return 1 + 2.2 * k * k * k + 1.2 * k * k
}
/** A bump: 0, up to 1 around `at`, 0 again. */
const bump = (since: number, at: number, w: number) => Math.exp(-(((since - at) / w) ** 2))

export function emoteArms(pose: Pose, out: number, t: number, since: number): Arm | null {
  const a = armsOf(pose, out, t, since)
  if (!a || LOOPED.has(pose)) return a
  // Struck and held: there in about half a second, a touch past, then alive.
  const e = overshoot(since, 0.45)
  const rest: Arm = [REST[0], REST[1], out * REST[2], REST[3], REST[4]]
  const breathe = Math.sin(t * 1.7) * 0.035
  // The arm out to the side first, then up: a big raise doesn't swing through the body.
  const lift = clamp01(since / 0.2)
  return [rest[0] + (a[0] - rest[0]) * e * (0.6 + 0.4 * lift) + breathe, a[1], rest[2] + (a[2] - rest[2]) * Math.min(1.05, e * 1.25), rest[3] + (a[3] - rest[3]) * e - breathe * 0.6, a[4]]
}

export function emoteLegs(pose: Pose, out: number, t: number, since = 1): Leg | null {
  const l = legsOf(pose, out, t)
  // The dip before: knees give a little, then the move.
  const dip = bump(since, 0.1, 0.1) * 0.22
  if (l) return [l[0] - dip * 0.5, l[1], l[2] + dip]
  if (!isEmote(pose)) return null
  // Standing: the weight from one leg to the other while the pose is held.
  const shift = Math.sin(t * 0.8) * out
  return [-dip * 0.5, out * 0.02, dip + Math.max(0, -shift) * 0.1]
}

export function emoteBody(pose: Pose, t: number, since: number): Body | null {
  const b = bodyOf(pose, t, since)
  if (!b && !isEmote(pose)) return null
  const body: Body = { ...b }
  // Down into the dip, then up into the move; breathing while it lasts.
  body.y = (body.y ?? 0) - bump(since, 0.1, 0.1) * 0.05 + Math.sin(t * 1.7) * 0.006
  if (!LOOPED.has(pose)) {
    // A held pose sways a little, and the head settles with a small nod after the hit.
    body.rz = (body.rz ?? 0) + Math.sin(t * 0.8) * 0.025
    body.head = (body.head ?? 0) + bump(since, 0.5, 0.15) * 0.08 + Math.sin(t * 1.1) * 0.02
  }
  return body
}
