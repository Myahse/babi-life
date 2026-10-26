// A scripted pair of hands playing the console's football (switching, sprint, charged shots, set
// pieces) against the AI, at the level FOE (1 = normal). Run from web/:
//   npx esbuild scripts/foot-human.ts --bundle --platform=node --format=esm --outfile=/tmp/foot-human.mjs && FOE=1 node /tmp/foot-human.mjs
import { createGame, seeded, step, type Game, type Input } from '../src/streetball/game'
// A scripted pair of hands for team 0: chase the ball, sprint, charge and release a shot near goal, swap when far.
function play(size: 5 | 11, seed: number) {
  const g: Game = createGame('foot', 'Moi', seeded(seed), { size, switching: true, referee: true, length: size === 11 ? 360 : 240, foe: Number((globalThis as { process?: { env: Record<string, string> } }).process?.env.FOE ?? 1) })
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
    const goalX = g.field.x
    if (has) {
      const [dx, dz] = [goalX - me.x, -me.z]
      const l = Math.hypot(dx, dz) || 1
      inp.mx = dx / l
      inp.mz = dz / l
      inp.sprint = true
      if (l < (size === 11 ? 22 : 12) || (g.set && g.set.taker === me.id)) {
        charging += dt
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
for (const size of [5, 11] as const) for (const seed of [3, 7, 11]) console.log(JSON.stringify(play(size, seed)))
