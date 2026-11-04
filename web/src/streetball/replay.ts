import type { Pose } from '../avatar/Human'
import type { Act, Game } from './game'

// The replay, as on TV: the last seconds of play are kept on a little tape
// (the players' places, poses and moves, the ball, the iron and the net),
// and after a goal (football) or a dunk (basketball) the screen plays them
// again in slow motion from a camera by the goal or the ring (scene.tsx
// Follow reads `replayView`), then the match picks up where it was. Only
// drawn, never played: the match itself stands still meanwhile, so the rules
// and the score never feel it. Not online (each phone would stop on its own).

type Frame = { t: number; ps: Float32Array; poses: Pose[]; acts: Act[]; ball: Float32Array; /** Basketball: the ring's shake and the net (their times, their strength). */ rim: [number, number, number] }
const PER = 8

/** What the camera needs while a replay plays: on, which goal (football) or ring (basketball, `ring`), the slow motion's rate now, how far through it is (0…1). */
export const replayView = { on: false, goalX: 0, side: 1, rate: 1, ring: null as [number, number] | null, k: 0 }

export class Tape {
  frames: Frame[] = []
  /** Keeps the last `keep` seconds of the match. */
  record(g: Game, keep = 5) {
    const ps = new Float32Array(g.ps.length * PER)
    g.ps.forEach((p, i) => ps.set([p.x, p.z, p.face, p.vx, p.vz, p.at, p.flip ? 1 : 0, p.take], i * PER))
    const b = g.ball
    this.frames.push({ t: g.time, ps, poses: g.ps.map((p) => p.pose), acts: g.ps.map((p) => p.act), ball: new Float32Array([b.x, b.y, b.z, b.vx, b.vy, b.vz]), rim: [g.rim.t, g.rim.amp, g.swish] })
    while (this.frames.length > 2 && this.frames[0].t < g.time - keep) this.frames.shift()
  }
  clip(from: number, to: number) {
    return this.frames.filter((f) => f.t >= from && f.t <= to)
  }
}

type Saved = { ps: Float32Array; poses: Pose[]; acts: Act[]; ball: Float32Array; time: number; rim: [number, number, number] }

/** A replay going on: its frames, where it's at (match seconds), the goal's moment, what to put back after. */
export type Replay = { frames: Frame[]; t: number; goal: number; saved: Saved }

/** The replay of the moment at `goalT`: football's goal at `goalX`; basketball's dunk at the ring `ring` (shorter after it: the net, the hang on the iron). */
export function startReplay(g: Game, tape: Tape, goalT: number, goalX: number, ring?: [number, number]): Replay | null {
  const frames = tape.clip(goalT - (ring ? 1.7 : 2.6), goalT + (ring ? 0.9 : 0.5))
  if (frames.length < 4) return null
  const t = new Tape()
  t.record(g)
  const now = t.frames[0]
  replayView.on = true
  replayView.goalX = goalX
  replayView.ring = ring ?? null
  replayView.k = 0
  replayView.side = (frames[Math.floor(frames.length * 0.7)].ball[2] ?? 0) >= 0 ? 1 : -1
  return { frames, t: frames[0].t, goal: goalT, saved: { ps: now.ps, poses: now.poses, acts: now.acts, ball: now.ball, time: g.time, rim: now.rim } }
}

function put(g: Game, ps: Float32Array, poses: Pose[], acts: Act[], ball: Float32Array, rate: number, rim?: [number, number, number], time?: number) {
  // (Basketball: the iron and the net as they were then, on the match's clock then, so they move as they did.)
  if (rim && time !== undefined) {
    g.rim = { t: rim[0], amp: rim[1] }
    g.swish = rim[2]
    g.time = time
  }
  g.ps.forEach((p, i) => {
    const o = i * PER
    ;[p.x, p.z, p.face] = [ps[o], ps[o + 1], ps[o + 2]]
    // The steps slowed with the picture (the legs follow the speed).
    p.vx = ps[o + 3] * rate
    p.vz = ps[o + 4] * rate
    p.at = ps[o + 5]
    p.flip = ps[o + 6] > 0
    p.take = ps[o + 7]
    p.pose = poses[i]
    p.act = acts[i]
  })
  const b = g.ball
  ;[b.x, b.y, b.z, b.vx, b.vy, b.vz] = [ball[0], ball[1], ball[2], ball[3] * rate, ball[4] * rate, ball[5] * rate]
}

/** Moves the replay on by dt (real seconds): slower as the ball goes in. False when it's over (the match is put back). */
export function playReplay(g: Game, r: Replay, dt: number, skip: boolean) {
  const rate = r.t > r.goal - 0.8 && r.t < r.goal + 0.2 ? 0.3 : 0.6
  replayView.rate = rate
  r.t += dt * rate
  const last = r.frames[r.frames.length - 1]
  replayView.k = (r.t - r.frames[0].t) / Math.max(0.01, last.t - r.frames[0].t)
  if (skip || r.t >= last.t) {
    put(g, r.saved.ps, r.saved.poses, r.saved.acts, r.saved.ball, 1, r.saved.rim, r.saved.time)
    replayView.on = false
    replayView.rate = 1
    replayView.ring = null
    return false
  }
  let i = 0
  while (i < r.frames.length - 2 && r.frames[i + 1].t < r.t) i++
  const [a, c] = [r.frames[i], r.frames[i + 1]]
  // Between two frames: the places blended, the poses of the nearer.
  const k = Math.max(0, Math.min(1, (r.t - a.t) / (c.t - a.t || 1)))
  const ps = a.ps.map((v, j) => (j % PER === 2 ? v + Math.atan2(Math.sin(c.ps[j] - v), Math.cos(c.ps[j] - v)) * k : j % PER < 5 ? v + (c.ps[j] - v) * k : k < 0.5 ? v : c.ps[j]))
  const ball = a.ball.map((v, j) => v + (c.ball[j] - v) * k)
  put(g, ps, k < 0.5 ? a.poses : c.poses, k < 0.5 ? a.acts : c.acts, ball, rate, replayView.ring ? a.rim : undefined, replayView.ring ? r.t : undefined)
  return true
}
