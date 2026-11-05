import type { Pose } from '../avatar/Human'

// The replay of tennis and volleyball, as streetball/replay.ts does football's and basketball's: the last
// seconds kept on a little tape (the players' places, heights, poses and their clocks, the ball), and after a
// big point the scene plays them again slowed down from a camera low by the court (the scenes read
// `replayCam`), then puts the match back as it was. Only drawn: the match stands still meanwhile. Not online.

type Who = { x: number; z: number; face: number; pose: Pose; at: number; vx: number; vz: number; y?: number }
type Ball = { x: number; y: number; z: number }
type Frame = { t: number; ps: Float32Array; poses: Pose[]; ball: [number, number, number] }
const PER = 7

/** What the scene's camera needs while a replay plays: on, where the moment happened (the ball then), how slow. */
export const replayCam = { on: false, x: 0, z: 0, rate: 1, k: 0 }

export class SportTape {
  frames: Frame[] = []
  /** The frames gone past the keep, used again (a match records every frame: nothing new made per frame). */
  private spare: Frame[] = []
  record(time: number, ps: Who[], b: Ball, keep = 7) {
    while (this.frames.length > 2 && this.frames[0].t < time - keep) this.spare.push(this.frames.shift()!)
    let f = this.spare.pop()
    if (!f || f.ps.length !== ps.length * PER) f = { t: 0, ps: new Float32Array(ps.length * PER), poses: new Array<Pose>(ps.length), ball: [0, 0, 0] }
    f.t = time
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i]
      const o = i * PER
      f.ps[o] = p.x
      f.ps[o + 1] = p.z
      f.ps[o + 2] = p.face
      f.ps[o + 3] = p.at
      f.ps[o + 4] = p.vx
      f.ps[o + 5] = p.vz
      f.ps[o + 6] = p.y ?? 0
      f.poses[i] = p.pose
    }
    f.ball[0] = b.x
    f.ball[1] = b.y
    f.ball[2] = b.z
    this.frames.push(f)
  }
}

export type SportReplay = { frames: Frame[]; t: number; at: number; saved: Frame }

/** The replay of the moment at `at` (match seconds): from `before` seconds before it to a little after. */
export function startTape(tape: SportTape, time: number, ps: Who[], b: Ball, at: number, before = 3.2): SportReplay | null {
  const frames = tape.frames.filter((f) => f.t >= at - before && f.t <= at + 0.8)
  if (frames.length < 6) return null
  const now = new SportTape()
  now.record(time, ps, b)
  replayCam.on = true
  const mid = frames[frames.length - 1]
  replayCam.x = mid.ball[0]
  replayCam.z = mid.ball[2]
  replayCam.k = 0
  return { frames, t: frames[0].t, at, saved: now.frames[0] }
}

function put(ps: Who[], b: Ball, f: { ps: Float32Array; poses: Pose[]; ball: [number, number, number] }, rate: number) {
  ps.forEach((p, i) => {
    const o = i * PER
    ;[p.x, p.z, p.face, p.at] = [f.ps[o], f.ps[o + 1], f.ps[o + 2], f.ps[o + 3]]
    p.vx = f.ps[o + 4] * rate
    p.vz = f.ps[o + 5] * rate
    if (p.y !== undefined) p.y = f.ps[o + 6]
    p.pose = f.poses[i]
  })
  ;[b.x, b.y, b.z] = f.ball
}

/** On by dt real seconds (slower around the moment itself); false once over, the match put back. */
export function playTape(r: SportReplay, ps: Who[], b: Ball, dt: number, skip: boolean) {
  const rate = Math.abs(r.t - r.at) < 0.6 ? 0.3 : 0.55
  replayCam.rate = rate
  r.t += dt * rate
  const last = r.frames[r.frames.length - 1]
  replayCam.k = (r.t - r.frames[0].t) / Math.max(0.01, last.t - r.frames[0].t)
  if (skip || r.t >= last.t) {
    put(ps, b, r.saved, 1)
    replayCam.on = false
    replayCam.rate = 1
    return false
  }
  let i = 0
  while (i < r.frames.length - 2 && r.frames[i + 1].t < r.t) i++
  const [a, c] = [r.frames[i], r.frames[i + 1]]
  const k = Math.max(0, Math.min(1, (r.t - a.t) / (c.t - a.t || 1)))
  const mix = a.ps.map((v, j) => (j % PER === 2 ? v + Math.atan2(Math.sin(c.ps[j] - v), Math.cos(c.ps[j] - v)) * k : v + (c.ps[j] - v) * k))
  put(ps, b, { ps: mix, poses: k < 0.5 ? a.poses : c.poses, ball: [a.ball[0] + (c.ball[0] - a.ball[0]) * k, a.ball[1] + (c.ball[1] - a.ball[1]) * k, a.ball[2] + (c.ball[2] - a.ball[2]) * k] }, rate)
  return true
}
