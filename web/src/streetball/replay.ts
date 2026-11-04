import type { Pose } from '../avatar/Human'
import type { Act, Game } from './game'

// The goal's replay, as on TV: the last seconds of play are kept on a little
// tape (the players' places, poses and moves, the ball), and after a goal the
// screen plays them again in slow motion from a camera by the goal
// (scene.tsx Follow reads `replayView`), then the match picks up where it
// was. Only drawn, never played: the match itself stands still meanwhile, so
// the rules and the score never feel it. Not online (each phone would stop on
// its own); the console and the street have it.

type Frame = { t: number; ps: Float32Array; poses: Pose[]; acts: Act[]; ball: Float32Array }
const PER = 8

/** What the camera needs while a replay plays: on, which goal, the slow motion's rate now. */
export const replayView = { on: false, goalX: 0, side: 1, rate: 1 }

export class Tape {
  frames: Frame[] = []
  /** Keeps the last `keep` seconds of the match. */
  record(g: Game, keep = 5) {
    const ps = new Float32Array(g.ps.length * PER)
    g.ps.forEach((p, i) => ps.set([p.x, p.z, p.face, p.vx, p.vz, p.at, p.flip ? 1 : 0, p.take], i * PER))
    const b = g.ball
    this.frames.push({ t: g.time, ps, poses: g.ps.map((p) => p.pose), acts: g.ps.map((p) => p.act), ball: new Float32Array([b.x, b.y, b.z, b.vx, b.vy, b.vz]) })
    while (this.frames.length > 2 && this.frames[0].t < g.time - keep) this.frames.shift()
  }
  clip(from: number, to: number) {
    return this.frames.filter((f) => f.t >= from && f.t <= to)
  }
}

type Saved = { ps: Float32Array; poses: Pose[]; acts: Act[]; ball: Float32Array }

/** A replay going on: its frames, where it's at (match seconds), the goal's moment, what to put back after. */
export type Replay = { frames: Frame[]; t: number; goal: number; saved: Saved }

export function startReplay(g: Game, tape: Tape, goalT: number, goalX: number): Replay | null {
  const frames = tape.clip(goalT - 2.6, goalT + 0.5)
  if (frames.length < 4) return null
  const t = new Tape()
  t.record(g)
  const now = t.frames[0]
  replayView.on = true
  replayView.goalX = goalX
  replayView.side = (frames[Math.floor(frames.length * 0.7)].ball[2] ?? 0) >= 0 ? 1 : -1
  return { frames, t: frames[0].t, goal: goalT, saved: { ps: now.ps, poses: now.poses, acts: now.acts, ball: now.ball } }
}

function put(g: Game, ps: Float32Array, poses: Pose[], acts: Act[], ball: Float32Array, rate: number) {
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
  if (skip || r.t >= last.t) {
    put(g, r.saved.ps, r.saved.poses, r.saved.acts, r.saved.ball, 1)
    replayView.on = false
    replayView.rate = 1
    return false
  }
  let i = 0
  while (i < r.frames.length - 2 && r.frames[i + 1].t < r.t) i++
  const [a, c] = [r.frames[i], r.frames[i + 1]]
  // Between two frames: the places blended, the poses of the nearer.
  const k = Math.max(0, Math.min(1, (r.t - a.t) / (c.t - a.t || 1)))
  const ps = a.ps.map((v, j) => (j % PER === 2 ? v + Math.atan2(Math.sin(c.ps[j] - v), Math.cos(c.ps[j] - v)) * k : j % PER < 5 ? v + (c.ps[j] - v) * k : k < 0.5 ? v : c.ps[j]))
  const ball = a.ball.map((v, j) => v + (c.ball[j] - v) * k)
  put(g, ps, k < 0.5 ? a.poses : c.poses, k < 0.5 ? a.acts : c.acts, ball, rate)
  return true
}
