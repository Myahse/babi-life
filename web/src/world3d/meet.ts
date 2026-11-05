import type { Pose } from '../avatar/Human'
import { dropGazeTarget, gazeTarget, setExpression } from '../avatar/expressions'
import type { Friend } from '../lib/types'
import { approach, playEmote, stopEmote } from './emoteNow'
import { npcReact } from './open/npcReact'
import { whereabouts } from './whereabouts'

// Meeting someone to talk (a tap on them, world3d/talk.ts): the Sim walks up to them and stops a step
// away, turned to them, its eyes on theirs (and theirs on its own); there they greet each other the way
// people do here, by how well they know each other (a handshake for someone new, the friends' « check »
// with the snap of the fingers, la bise, a hug for the one you're with), then talk, each in turn. At the
// end a wave, and they go on their way. The chat sheet is open from the tap: nothing waits for the walk.

export type Greeting = 'shake' | 'dap' | 'bise' | 'hug' | 'wave'
/** How far apart two people stand to talk (m). */
export const TALK_GAP = 1.1
/** … and to greet each other (a hug is close; a child waves from where it is). */
export const GREET_GAP: Record<Greeting, number> = { shake: 0.95, dap: 0.9, bise: 0.62, hug: 0.55, wave: 1.5 }
const GREET_SECS: Record<Greeting, number> = { shake: 1.9, dap: 1.7, bise: 1.9, hug: 2.4, wave: 1.8 }
const GREET_POSE: Record<Greeting, Pose> = { shake: 'shake', dap: 'dap', bise: 'bise', hug: 'hug', wave: 'wave' }

/** The street's Sim is there to walk (Walker.tsx, out in the street). */
export const streetWalker = { on: false }
/**
 * Inside a place, the Sim free to walk about the room (Interior.tsx WalkTo, HomeInside.tsx Walking): it walks
 * up to the one tapped too, round the furniture (meetIndoors.ts). Busy at something there (seated at its plate,
 * in the barber's chair), the one tapped answers from where they are and the Sim looks at them.
 */
export const indoorWalker = { on: false }
/** Indoors: the walk up asked of the room's walker (who, how close to stop, and what to do once there). */
export const indoorMeet = { to: null as { id: string; gap: number; arrive: () => void } | null }

/** The meeting now: with whom, where they stand (read live: a passer-by moves), how they'll greet, and once greeted, until when (ms). */
export const meeting = { id: null as string | null, where: null as (() => [number, number]) | null, greet: 'shake' as Greeting, greeted: 0, until: 0 }

/** What the chat sheet remembers of them (components/ChatSheet.tsx: met how often, how well you get on). */
function memory(id: string): { met: number; rapport: number } {
  try {
    const m = JSON.parse(localStorage.getItem(`babi.npc.${id}`) ?? '') as { met?: number; rapport?: number }
    return { met: m.met || 0, rapport: m.rapport || 0 }
  } catch {
    return { met: 0, rapport: 0 }
  }
}

/**
 * How the Sim greets them: the one it's with, a hug; a friend (their number taken) or someone it gets on
 * well with, the « check » between two men, la bise otherwise; someone new, a handshake. A child waves.
 */
export function greetingFor(id: string, gender: 'femme' | 'homme', simGender: 'femme' | 'homme', stage: string, friend?: Friend): Greeting {
  if (stage === 'enfant' || stage === 'bebe') return 'wave'
  if (friend?.partner) return 'hug'
  const m = memory(id)
  const close = !!friend || (m.met >= 3 && m.rapport >= 4)
  if (!close) return 'shake'
  return gender === 'homme' && simGender === 'homme' ? 'dap' : 'bise'
}

/** The eyes' target: their face, for the Sim's eyes (avatar/expressions.ts gazeFor). */
let eyes: ReturnType<typeof gazeTarget> | null = null

/**
 * Walks the Sim up to them, to the greeting's distance, the short way round what's in between; there,
 * they greet each other. `where`: where they stand now. Already close: greeted where it is.
 */
export function walkUpTo(id: string, where: () => [number, number], greet: Greeting) {
  meeting.id = id
  meeting.where = where
  meeting.greet = greet
  meeting.greeted = 0
  meeting.until = 0
  eyes = gazeTarget('talk', 8, 3)
  const arrive = () => {
    if (meeting.id === id) greetNow()
  }
  // Indoors: the room's walker finds the spot to stop at, round the tables and the counters.
  if (indoorWalker.on) return void (indoorMeet.to = { id, gap: Math.min(TALK_GAP, GREET_GAP[greet]), arrive })
  if (!streetWalker.on) return
  const [x, z] = where()
  const [sx, sz] = whereabouts.sim
  const d = Math.hypot(x - sx, z - sz)
  const gap = Math.min(TALK_GAP, GREET_GAP[greet])
  if (d < gap + 0.45 || d < 0.01) return void setTimeout(arrive, 0)
  // Stopped on the near side of them, the gap away (where they are by now, if they moved on a step).
  const k = (d - gap) / d
  approach.to = { x: sx + (x - sx) * k, z: sz + (z - sz) * k, sent: false, arrive, cancel: () => undefined }
}

/** There: the greeting, both of them, their faces lit up. */
function greetNow() {
  const id = meeting.id
  if (!id) return
  const g = meeting.greet
  const secs = GREET_SECS[g]
  meeting.greeted = performance.now()
  meeting.until = meeting.greeted + secs * 1000
  playEmote(GREET_POSE[g], secs)
  npcReact(id, GREET_POSE[g], secs)
  setExpression('me', g === 'hug' ? 'love' : 'smile', secs * 1000 + 600)
  setExpression(id, g === 'hug' ? 'love' : 'smile', secs * 1000 + 600)
}

/** The chat over: a wave to them (the game screen has them wave back), the eyes free again. */
export function endMeeting() {
  if (!meeting.id) return
  const greeted = meeting.greeted > 0
  if (approach.to) {
    approach.to.cancel()
    approach.to = null
  }
  indoorMeet.to = null
  meeting.id = null
  meeting.where = null
  eyes = null
  dropGazeTarget('talk')
  whereabouts.faceTo = null
  // (Not yet there: no wave from afar.)
  if (greeted) playEmote('wave', 1.6)
  else stopEmote()
}

/** Each frame (Walker.tsx): the Sim keeps turned to them and its eyes on theirs. `floor`: the ground's height there (indoors: the room's, not the street's). */
const facing: [number, number] = [0, 0]
export function followMeeting(eyeY: number, floor = whereabouts.simY) {
  if (!meeting.id || !meeting.where) return
  const [x, z] = meeting.where()
  facing[0] = x
  facing[1] = z
  if (!indoorWalker.on) whereabouts.faceTo = facing
  eyes?.set(x, floor + eyeY, z)
}

/** Where the Sim stands indoors (the room's walker sets it each frame): the one it talks to turns to it (Talkable). */
export const indoorSim: [number, number] = [0, 0]
