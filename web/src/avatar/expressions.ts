import { createContext, createElement, useContext, type ReactNode } from 'react'
import * as THREE from 'three'
import type { Needs } from '../lib/types'
import type { Pose } from './Human'
import { isDance } from './dances'
import { isFight } from './fight'
import { isJob } from './jobs'

// The Sims' faces (painted by avatar/face.tsx on BlockHuman's and DetailHuman's heads): what each one
// shows, from moment to moment. A face is four parts that combine: the brows, the eyes (and where they
// look), the mouth, the cheeks (a blush, tears, a sick pallor). An expression names one of each.
//
// What drives them, strongest first: one set by the game for a while (setExpression: a défi won, a
// casino loss, robbed), what the Sim is doing (its pose: dancing, eating, crying, fighting…), its mood
// (the needs given by FaceMood round it), and on top of all that a life of their own: blinking, the
// mouth moving while it speaks (setSpeaking, a speech bubble), glances at what is near (gaze targets:
// the player, the ball) and little idle moves of the brows and eyes, so no face ever looks frozen.

/* ---------- The parts ---------- */

export const BROWS = ['neutral', 'up', 'high', 'sad', 'angry', 'flat', 'knit', 'one'] as const
export type Brow = (typeof BROWS)[number]
/** The eyes that can look about (each has five tiles: centre, left, right, up, down). */
export const GAZED = ['open', 'wide', 'half', 'angry', 'sad', 'focus'] as const
export const FIXED_EYES = ['closed', 'happy', 'squeeze', 'heart', 'cry', 'sob', 'sick'] as const
export type Eye = (typeof GAZED)[number] | (typeof FIXED_EYES)[number]
/** Where the eyes look, in the head's own frame: 'l' is its -x (the viewer's left when facing it). */
export const GAZES = ['c', 'l', 'r', 'u', 'd'] as const
export type Gaze = (typeof GAZES)[number]
export const MOUTHS = ['neutral', 'smile', 'grin', 'laugh', 'sad', 'frown', 'tight', 'grit', 'o', 'O', 'yawn', 'wavy', 'disgust', 'bite', 'smirk', 'chew1', 'chew2', 'pout', 'cry', 'a', 'e', 'm', 'f'] as const
export type Mouth = (typeof MOUTHS)[number]
export const CHEEKS = ['plain', 'blush', 'tears', 'green'] as const
export type Cheek = (typeof CHEEKS)[number]

/** The tiles' order in a look's face atlas (face.tsx paints them in this order). */
export const browIndex = (b: Brow) => BROWS.indexOf(b)
export function eyeIndex(e: Eye, g: Gaze) {
  const k = (GAZED as readonly string[]).indexOf(e)
  return k >= 0 ? k * GAZES.length + GAZES.indexOf(g) : GAZED.length * GAZES.length + (FIXED_EYES as readonly string[]).indexOf(e)
}
export const EYE_TILES = GAZED.length * GAZES.length + FIXED_EYES.length
export const mouthIndex = (m: Mouth, c: Cheek) => CHEEKS.indexOf(c) * MOUTHS.length + MOUTHS.indexOf(m)
export const MOUTH_TILES = MOUTHS.length * CHEEKS.length

/* ---------- The expressions ---------- */

type Parts = { brow: Brow; eye: Eye; mouth: Mouth; cheek?: Cheek; gaze?: Gaze }
export const EXPRESSIONS = {
  neutral: { brow: 'neutral', eye: 'open', mouth: 'neutral' },
  smile: { brow: 'neutral', eye: 'open', mouth: 'smile' },
  grin: { brow: 'up', eye: 'happy', mouth: 'grin' },
  laugh: { brow: 'up', eye: 'happy', mouth: 'laugh' },
  cheer: { brow: 'high', eye: 'happy', mouth: 'laugh' },
  sad: { brow: 'sad', eye: 'sad', mouth: 'sad' },
  disappointed: { brow: 'sad', eye: 'open', mouth: 'frown', gaze: 'd' },
  cry: { brow: 'sad', eye: 'cry', mouth: 'cry', cheek: 'tears' },
  sob: { brow: 'sad', eye: 'sob', mouth: 'cry', cheek: 'tears' },
  angry: { brow: 'angry', eye: 'angry', mouth: 'grit' },
  annoyed: { brow: 'knit', eye: 'open', mouth: 'tight' },
  shout: { brow: 'angry', eye: 'angry', mouth: 'O' },
  surprised: { brow: 'high', eye: 'wide', mouth: 'O' },
  wow: { brow: 'high', eye: 'wide', mouth: 'o' },
  tired: { brow: 'flat', eye: 'half', mouth: 'neutral' },
  asleep: { brow: 'flat', eye: 'closed', mouth: 'neutral' },
  calm: { brow: 'neutral', eye: 'closed', mouth: 'smile' },
  yawn: { brow: 'high', eye: 'squeeze', mouth: 'yawn' },
  disgusted: { brow: 'knit', eye: 'focus', mouth: 'disgust' },
  love: { brow: 'up', eye: 'heart', mouth: 'smile', cheek: 'blush' },
  shy: { brow: 'neutral', eye: 'open', mouth: 'smile', cheek: 'blush', gaze: 'd' },
  kiss: { brow: 'up', eye: 'closed', mouth: 'pout', cheek: 'blush' },
  focused: { brow: 'one', eye: 'focus', mouth: 'bite' },
  thinking: { brow: 'one', eye: 'open', mouth: 'tight', gaze: 'u' },
  proud: { brow: 'up', eye: 'half', mouth: 'smirk' },
  scared: { brow: 'sad', eye: 'wide', mouth: 'grit' },
  hurt: { brow: 'angry', eye: 'squeeze', mouth: 'grit' },
  sick: { brow: 'sad', eye: 'sick', mouth: 'wavy', cheek: 'green' },
  hungry: { brow: 'knit', eye: 'open', mouth: 'frown' },
  meh: { brow: 'up', eye: 'open', mouth: 'tight' },
  chew: { brow: 'neutral', eye: 'happy', mouth: 'chew1' },
  effort: { brow: 'knit', eye: 'focus', mouth: 'grit' },
  concentrate: { brow: 'knit', eye: 'focus', mouth: 'neutral' },
} satisfies Record<string, Parts>
export type Expression = keyof typeof EXPRESSIONS
export const EXPRESSION_NAMES = Object.keys(EXPRESSIONS) as Expression[]

/* ---------- What the game sets ---------- */

const set = new Map<string, { name: Expression; until: number }>()
const speaking = new Map<string, number>()

/**
 * Shows an expression on a Sim's face for a while (`id` as given to the avatar's `faceId`: 'me' is
 * the player's own Sim, in the street and in the games). It goes back to what the Sim does after.
 */
export function setExpression(id: string, name: Expression, ms = 3000) {
  set.set(id, { name, until: performance.now() + ms })
}
/** Back to its own face now. */
export const clearExpression = (id: string) => void set.delete(id)
/** The Sim speaks for ms (its mouth moves, whatever the pose): the speech bubble, a line said. */
export function setSpeaking(id: string, ms: number) {
  speaking.set(id, performance.now() + ms)
}
function setNow(id: string | undefined, now: number) {
  if (!id) return null
  const s = set.get(id)
  if (!s) return null
  if (s.until < now) return set.delete(id), null
  return s.name
}

/** What a result means for the face: a win, a loss, a big one. */
export function reactToResult(id: string, how: 'won' | 'lost' | 'bigwin' | 'biglost' | 'ok', ms = 4500) {
  setExpression(id, how === 'bigwin' ? 'cheer' : how === 'won' ? 'proud' : how === 'ok' ? 'smile' : how === 'biglost' ? 'cry' : 'disappointed', ms)
}

/* ---------- Glances: what is near to look at ---------- */

type Target = { at: THREE.Vector3; reach: number; rank: number; on: boolean }
const targets = new Map<string, Target>()
/**
 * Something faces look at when it's within `reach` metres and in front of them: the player
 * ('player', 7 m), the ball in a match. The position is read every time (kept up to date by its owner).
 * A higher rank wins when two are near.
 */
export function gazeTarget(key: string, reach: number, rank = 0) {
  let t = targets.get(key)
  if (!t) targets.set(key, (t = { at: new THREE.Vector3(), reach, rank, on: true }))
  t.reach = reach
  t.rank = rank
  t.on = true
  return t.at
}
export const dropGazeTarget = (key: string) => void targets.delete(key)
const local = new THREE.Vector3()
const inv = new THREE.Matrix4()
/** Where a head (its world matrix) should look: at the nearest target in front, or null. */
export function gazeFor(head: THREE.Object3D, self: string | undefined, eyeY: number): Gaze | null {
  let best: Target | null = null
  let bestD = Infinity
  const e = head.matrixWorld.elements
  for (const [key, t] of targets) {
    if (!t.on || key === self) continue
    const d = Math.hypot(t.at.x - e[12], t.at.y - e[13], t.at.z - e[14])
    if (d > t.reach || d < 0.35) continue
    if (best && (t.rank < best.rank || (t.rank === best.rank && d > bestD))) continue
    best = t
    bestD = d
  }
  if (!best) return null
  local.copy(best.at).applyMatrix4(inv.copy(head.matrixWorld).invert())
  local.y -= eyeY
  if (local.z < 0.05) return null // behind: no turning round with the eyes alone
  const side = Math.atan2(local.x, local.z)
  const up = Math.atan2(local.y, Math.hypot(local.x, local.z))
  if (side > 1.3 || side < -1.3) return null
  if (up > 0.38) return 'u'
  if (up < -0.42) return 'd'
  return side > 0.28 ? 'r' : side < -0.28 ? 'l' : 'c'
}

/* ---------- Mood, round a Sim ---------- */

/** What the faces inside know: whose they are, the needs (the player's Sim), an expression held (a portrait: `still`). */
export type FaceMoodValue = { id?: string; needs?: Needs; baby?: boolean; expression?: Expression; still?: boolean; /** Its face at rest, over the needs' (in prison: sad). */ rest?: Expression }
const Mood = createContext<FaceMoodValue | null>(null)
/** The face's own context: its id, needs, a fixed expression (the portraits: a smile, no blinking). */
export const FaceMood = ({ children, ...value }: FaceMoodValue & { children: ReactNode }) => createElement(Mood.Provider, { value }, children)
export const useFaceMood = () => useContext(Mood)

function moodOf(n: Needs | undefined, baby: boolean): Expression | null {
  if (!n) return null
  const low = Math.min(n.hunger, n.energy, n.hygiene, n.social, n.fun)
  if (baby && low < 25) return 'sob'
  if (n.energy < 25) return 'tired'
  if (n.hunger < 25) return 'hungry'
  if (low < 20) return 'disappointed'
  const avg = (n.hunger + n.energy + n.hygiene + n.social + n.fun) / 5
  return avg > 68 ? 'smile' : null
}

/* ---------- What the pose shows ---------- */

const hash = (a: number, b: number) => {
  const n = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453
  return n - Math.floor(n)
}
const POSE: Partial<Record<Pose, Expression>> = {
  cheer: 'cheer',
  clap: 'grin',
  thumbsup: 'proud',
  shrug: 'meh',
  laugh: 'laugh',
  dab: 'proud',
  heart: 'love',
  salute: 'proud',
  facepalm: 'disappointed',
  cry: 'sob',
  kiss: 'kiss',
  bow: 'calm',
  flex: 'proud',
  kneeslide: 'cheer',
  meditate: 'calm',
  shout: 'shout',
  sitground: 'tired',
  lean: 'smile',
  cache: 'grin',
  coucou: 'grin',
  sleep: 'asleep',
  pray: 'calm',
  salat: 'calm',
  drink: 'calm',
  wave: 'smile',
  hug: 'calm',
  beg: 'sad',
  rant: 'shout',
  despair: 'cry',
  hero: 'proud',
  lookup: 'wow',
  flinch: 'scared',
  stumble: 'scared',
  nutmegged: 'surprised',
  ankles: 'surprised',
  turned: 'surprised',
  frozen: 'surprised',
  film: 'grin',
  dj: 'grin',
  brush: 'grin',
  push: 'effort',
  toilet: 'thinking',
  wash: 'calm',
  shoot: 'effort',
  kick: 'effort',
  dunk: 'effort',
  keeper: 'focused',
  dive: 'effort',
  guard: 'focused',
  mark: 'focused',
  airplane: 'cheer',
  phone: 'smile',
  bounce: 'grin',
}
const HURT = new Set<string>(['fhit', 'fhitlow', 'fdown', 'fko', 'fthrown', 'fgetup'])

/** The expression a pose shows at time t (dancing changes with the beat), or null: none of its own. */
export function poseExpression(pose: Pose, t: number, seed: number): Expression | null {
  if (isDance(pose) || pose === 'robot') {
    // Dancing: the face lights up, a laugh now and then, the eyes closed in it.
    const r = hash(Math.floor(t / 2.2 + seed), seed)
    return r < 0.4 ? 'grin' : r < 0.62 ? 'laugh' : r < 0.82 ? 'smile' : r < 0.92 ? 'calm' : 'cheer'
  }
  if (pose === 'eat' || pose === 'snack') return 'chew'
  if (isFight(pose)) return HURT.has(pose) ? 'hurt' : pose === 'fsuper' ? 'shout' : 'angry'
  if (isJob(pose) || pose === 'busy' || pose === 'cook' || pose === 'write') {
    // At work: focused, then a breath with a softer face.
    return hash(Math.floor(t / 4 + seed), seed + 3) < 0.55 ? 'focused' : 'neutral'
  }
  return POSE[pose] ?? null
}

/* ---------- The face at a moment ---------- */

export type FaceOut = { brow: number; eye: number; mouth: number }
/** What a face has seen so far (one per avatar): kept between frames, so nothing is allocated. */
export type FaceState = { gaze: Gaze | null; gazeAt: number; glance: Gaze; glanceUntil: number }
export const newFaceState = (): FaceState => ({ gaze: null, gazeAt: -1, glance: 'c', glanceUntil: 0 })

const SPEAKS = new Set(['explain', 'point', 'count', 'shrug', 'chop'])
const VISEMES: Mouth[] = ['a', 'e', 'o', 'm', 'a', 'f', 'e', 'neutral', 'o', 'a']

/**
 * The face's tiles now. t: the shared clock (seconds); `talk` the conversation's turn when the pose is
 * 'talk' (Human.tsx talkAt); `gaze` a glance at a target, if any. Writes into out.
 */
export function faceAt(out: FaceOut, st: FaceState, t: number, now: number, pose: Pose, seed: number, mood: FaceMoodValue | null, faceId: string | undefined, talk: { move: string } | null, gaze: Gaze | null, stretch = false) {
  const still = mood?.still
  const id = faceId ?? mood?.id
  let name: Expression | null = mood?.expression ?? null
  let talking = false
  let listening = false
  if (!name) name = setNow(id, now)
  if (!name) {
    if (pose === 'talk' && talk) {
      if (talk.move === 'laugh') name = 'laugh'
      else if (SPEAKS.has(talk.move)) talking = true
      else (listening = true), (name = hash(Math.floor(t / 3 + seed), seed + 9) < 0.18 ? 'wow' : 'smile')
    } else if (pose === 'call' || pose === 'rant') talking = true
    name = name ?? poseExpression(pose, t, seed)
  }
  const fromPose = !!name
  if (!name) name = mood?.rest ?? moodOf(mood?.needs, !!mood?.baby)
  if (!name) name = 'neutral'
  const sp = id ? speaking.get(id) : undefined
  if (sp !== undefined && sp > now) talking = true
  if (pose === 'talk' && !talk) talking = true
  const x: Parts = EXPRESSIONS[name]
  let brow: Brow = x.brow
  let eye: Eye = x.eye
  let mouth: Mouth = x.mouth
  const cheek: Cheek = x.cheek ?? 'plain'
  let look: Gaze = x.gaze ?? 'c'

  if (!still) {
    const u = t + seed * 7.3
    // Chewing: the jaw going round.
    if (mouth === 'chew1' && Math.floor(u * 3.2) % 2) mouth = 'chew2'
    // Speaking: the mouth through its shapes, a brow raised on a word now and then.
    if (talking) {
      const k = Math.floor(u * 8.5)
      mouth = VISEMES[Math.floor(hash(k, seed) * VISEMES.length)]
      if (name === 'neutral' || name === 'smile') brow = hash(Math.floor(u / 1.4), seed + 2) < 0.3 ? 'up' : 'neutral'
    }
    if (listening && hash(Math.floor(u / 2.5), seed + 4) < 0.3) brow = 'up'
    // Tired: a yawn every so often; and with a stretch (the arms' fidget, Human.tsx fidgetAt).
    if ((name === 'tired' && !talking && (u % 13) / 13 > 0.82) || stretch) (brow = 'high'), (eye = 'squeeze'), (mouth = 'yawn')
    // Little moves of its own when nothing strong shows: a brow up, a glance aside, a half smile.
    const calmFace = !fromPose && (name === 'neutral' || name === 'smile' || name === 'hungry' || name === 'tired')
    if (calmFace) {
      const slot = Math.floor(u / 6.5)
      const r = hash(slot, seed + 11)
      const at = u - slot * 6.5
      if (r < 0.5 && at > 2 && at < 3.1) {
        const kind = Math.floor(hash(slot, seed + 13) * 5)
        if (kind === 0) brow = 'up'
        else if (kind === 1 && name === 'neutral') mouth = 'smile'
        else if (kind === 2) brow = 'one'
        else if (kind === 3) look = 'u'
        else look = hash(slot, seed + 17) < 0.5 ? 'l' : 'r'
      }
    }
    // Eyes that rove a little, then the glance at what's near (the player, the ball).
    if (now > st.glanceUntil) {
      const r = hash(Math.floor(now / 1700), seed + 23)
      st.glance = r < 0.62 ? 'c' : r < 0.74 ? 'l' : r < 0.86 ? 'r' : r < 0.93 ? 'd' : 'u'
      st.glanceUntil = now + 900 + hash(now, seed) * 1800
    }
    if (look === 'c') look = gaze ?? st.glance
  }

  // Blinking (eyes that are open): every few seconds, now and then twice.
  const open = (GAZED as readonly string[]).includes(eye)
  if (open && !still) {
    const period = 3.2 + (Math.abs(seed) % 3)
    const k = ((t + seed * 7.3) % period) / period
    if (k > 0.962 || (Math.abs(seed * 10) % 4 < 1 && k > 0.9 && k < 0.925)) eye = 'closed'
  }
  out.brow = browIndex(brow)
  out.eye = eyeIndex(eye, (GAZED as readonly string[]).includes(eye) ? look : 'c')
  out.mouth = mouthIndex(mouth, cheek)
}
