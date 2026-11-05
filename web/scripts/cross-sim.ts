// The stadium's crosses, AI against AI (src/streetball/game.ts, eleven a side): how many, from where
// (the byline, early from deeper), and how each ends: headed at goal, headed on, cleared, the keeper's,
// taken down, blocked near the crosser, out; and the offsides. Run from web/:
//   npx esbuild scripts/cross-sim.ts --bundle --platform=node --format=esm --outfile=/tmp/cross-sim.mjs && node /tmp/cross-sim.mjs
// (N= matches.)
import { createGame, seeded, step, NO_INPUT, type Game } from '../src/streetball/game'
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}
type End = 'atGoal' | 'goal' | 'flick' | 'cleared' | 'keeper' | 'attTook' | 'defTook' | 'blocked' | 'out' | 'other'
function run(seed: number) {
  const g: Game = createGame('foot', 'Moi', seeded(seed), { size: 11, referee: true, switching: true, length: 360 })
  for (const p of g.ps) p.human = false
  g.switching = false
  const F = g.field
  const T: Record<string, number> = { crosses: 0, byline: 0, early: 0, atGoal: 0, goal: 0, flick: 0, cleared: 0, keeper: 0, attTook: 0, defTook: 0, blocked: 0, out: 0, other: 0, offside: 0, goals: 0, wideS: 0, lastS: 0, shots: 0 }
  let cross: { team: 0 | 1; by: number; x: number; z: number; t: number } | null = null
  let wasLofted = false
  let lastShot: unknown = null
  let lastFlash = ''
  const dt = 1 / 60
  const end = (k: End) => {
    T[k]++
    if (env.V && cross) {
      const b = g.ball
      const att = g.ps.filter((q) => q.team === cross!.team && !q.keeper).map((q) => Math.hypot(q.x - b.x, q.z - b.z)).sort((a, c) => a - c)
      const def = g.ps.filter((q) => q.team !== cross!.team && !q.keeper).map((q) => Math.hypot(q.x - b.x, q.z - b.z)).sort((a, c) => a - c)
      const inBoxA = g.ps.filter((q) => q.team === cross!.team && !q.keeper && Math.abs(q.x - (cross!.team === 0 ? F.x : -F.x)) < 16.5 && Math.abs(q.z) < 20).length
      const inBoxD = g.ps.filter((q) => q.team !== cross!.team && !q.keeper && Math.abs(q.x - (cross!.team === 0 ? F.x : -F.x)) < 16.5 && Math.abs(q.z) < 20).length
      console.log(k, 'from', cross.x.toFixed(0), cross.z.toFixed(0), 'ball', b.x.toFixed(0), b.z.toFixed(0), b.y.toFixed(1), 'att', att.slice(0, 2).map((x) => x.toFixed(1)).join(','), 'def', def.slice(0, 2).map((x) => x.toFixed(1)).join(','), 'box A/D', inBoxA, inBoxD)
    }
    cross = null
  }
  for (let i = 0; i < 60 * 60 * 12 && g.phase !== 'over'; i++) {
    const sc = g.score[0] + g.score[1]
    step(g, dt, NO_INPUT)
    const b = g.ball
    const f = g.flash?.text ?? ''
    if (f !== lastFlash && /Hors-jeu/i.test(f)) T.offside++
    // A cross: a lofted ball struck from out wide in the last third.
    if (b.lofted && !wasLofted && b.owner < 0) {
      const p = g.ps[b.lastBy]
      const dir = p.team === 0 ? 1 : -1
      if (p && !p.keeper && Math.abs(p.z) > F.z * 0.3 && p.x * dir > F.x * 0.35) {
        cross = { team: p.team, by: p.id, x: p.x, z: p.z, t: g.time }
        T.crosses++
        if (p.x * dir > F.x - 16) T.byline++
        else T.early++
      }
    }
    wasLofted = b.lofted
    // (Seconds with the ball out wide in the last third, and in the last third at all.)
    if (b.owner >= 0) {
      const o = g.ps[b.owner]
      const dir = o.team === 0 ? 1 : -1
      if (o.x * dir > F.x * 0.35) T.lastS += dt
      if (o.x * dir > F.x * 0.35 && Math.abs(o.z) > F.z * 0.33) T.wideS += dt
    }
    if (g.shot && g.shot !== lastShot) T.shots++
    lastShot = g.shot
    if (cross) {
      if (g.score[0] + g.score[1] > sc) end('goal')
      else if (f !== lastFlash && /^Tête/.test(f)) end('atGoal')
      else if (f !== lastFlash && /Déviation de la tête/.test(f)) end(g.ps[b.lastBy].team === cross.team ? 'flick' : 'cleared')
      else if (f !== lastFlash && /Dégagé de la tête/.test(f)) end('cleared')
      else if (g.set) end('out')
      else if (b.owner >= 0) {
        const o = g.ps[b.owner]
        const near = Math.hypot(o.x - cross.x, o.z - cross.z) < 6 && g.time - cross.t < 0.8
        end(o.keeper ? 'keeper' : near && o.team !== cross.team ? 'blocked' : o.team === cross.team ? 'attTook' : 'defTook')
      } else if (g.time - cross.t > 4) end('other')
    }
    lastFlash = f
  }
  T.goals = g.score[0] + g.score[1]
  return T
}
const N = Number(env.N ?? 10)
const sum: Record<string, number> = {}
for (let s = 1; s <= N; s++) for (const [k, v] of Object.entries(run(s * 101))) sum[k] = (sum[k] ?? 0) + v / N
console.log('stade 11, per match:', JSON.stringify(Object.fromEntries(Object.entries(sum).map(([k, v]) => [k, +v.toFixed(2)]))))
