// A scripted pair of hands playing the console's football (switching, sprint, charged shots, set
// pieces) against the AI, at the level FOE (1 = normal). Run from web/:
//   npx esbuild scripts/foot-human.ts --bundle --platform=node --format=esm --outfile=/tmp/foot-human.mjs && node /tmp/foot-human.mjs
// (FOE=1 for one level only, SIZE=5 or 11 for one size, N= seeds per size, V=1 for every match's line.)
import { attackOf, createGame, seeded, step, type Game, type Input } from '../src/streetball/game'
// A scripted pair of hands for team 0: chase the ball, sprint, charge and release a shot near goal, swap when far.
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}
function play(size: 5 | 11, seed: number, foe: number) {
  const g: Game = createGame('foot', 'Moi', seeded(seed), { size, switching: true, referee: true, length: size === 11 ? 360 : 240, foe })
  const dt = 1 / 60
  let charging = 0,
    swaps = 0,
    myShots = 0,
    sprintT = 0,
    setTaken = 0,
    controlled = new Set<number>()
  for (let i = 0; i < 60 * 60 * 10 && g.phase !== 'over'; i++) {
    const me = g.ps[g.me]
    controlled.add(g.me)
    const b = g.ball
    const has = b.owner === me.id
    const inp: Input = { mx: 0, mz: 0, pass: false, shoot: false, skill: false, defend: false, guard: false, sprint: false, charge: false }
    const goalX = attackOf(g, me.team) * g.field.x
    if (has) {
      const [dx, dz] = [goalX - me.x, -me.z]
      const l = Math.hypot(dx, dz) || 1
      inp.mx = dx / l
      inp.mz = dz / l
      inp.sprint = true
      if (l < (size === 11 ? 22 : 12) || (g.set && g.set.taker === me.id)) {
        charging += dt
        // (Aiming: the stick to the corner away from their keeper, as anyone who plays does.)
        const k = g.ps.find((q) => q.keeper && q.team !== me.team)
        if (k && !g.set) inp.mz = k.z > 0 ? -0.75 : 0.75
        inp.charge = charging < 0.55
        if (!inp.charge) {
          myShots++
          charging = 0
        }
      }
    } else {
      charging = 0
      const [dx, dz] = [b.x - me.x, b.z - me.z]
      const l = Math.hypot(dx, dz) || 1
      inp.mx = dx / l
      inp.mz = dz / l
      inp.sprint = l > 4
      if (l > 15 && i % 90 === 0) {
        inp.swap = true
        swaps++
      }
      if (l < 1.3 && i % 20 === 0) inp.defend = true
    }
    if (inp.sprint) sprintT += dt
    if (g.set && g.set.taker === me.id) setTaken++
    step(g, dt, inp)
    for (const p of g.ps) if (!isFinite(p.x)) throw new Error('NaN')
  }
  return { size, score: g.score.join('-'), stats: g.stats, swaps, myShots, controlled: controlled.size, stamina: +g.ps[g.me].stamina.toFixed(2), sprint: Math.round(sprintT), setFrames: setTaken, phase: g.phase }
}
// Each level of the console (foot/teams.ts LEVELS: Amateur 0,8, Semi-pro 1, Pro 1,15, Légende 1,3): the scores, the mean margin.
const levels = env.FOE ? [Number(env.FOE)] : [0.8, 1, 1.15, 1.3]
const N = Number(env.N ?? 6)
for (const size of (env.SIZE ? [Number(env.SIZE)] : [5, 11]) as (5 | 11)[])
  for (const foe of levels) {
    const rows = []
    for (let s = 0; s < N; s++) rows.push(play(size, 3 + s * 4, foe))
    if (env.V) for (const r of rows) console.log(JSON.stringify(r))
    const gd = rows.map((r) => r.score.split('-').map(Number))
    const margin = gd.reduce((a, [x, y]) => a + x - y, 0) / N
    console.log(`${size} a side, foe ${foe}: ${rows.map((r) => r.score + (r.phase !== 'over' ? '!' : '')).join(' ')}  margin ${margin.toFixed(1)}, won ${gd.filter(([x, y]) => x > y).length}/${N}`)
  }
