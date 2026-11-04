// AI against AI basketball matches through the street engine (src/streetball/game.ts): the street's
// (Rules.street) and the Palais des Sports' (no rules): points, shots by kind and how many go in,
// blocks, steals, rebounds (offensive / defensive), fouls, nothing stuck, no NaN. Run from web/:
//   npx esbuild scripts/hoop-sim.ts --bundle --platform=node --format=esm --outfile=/tmp/hoop-sim.mjs && node /tmp/hoop-sim.mjs
import { createGame, seeded, step, NO_INPUT, type Game, type Rules } from '../src/streetball/game'

type Tally = { score: [number, number]; dunks: number; layups: number; jumpers: number; made: number; shots: number; blocks: number; steals: number; oreb: number; dreb: number; poss: number; fouls: number; nan: number; stuck: number; len: number }
function run(rules: Rules, seed: number) {
  const g: Game = createGame('basket', 'Moi', seeded(seed), rules)
  for (const p of g.ps) p.human = false
  const t: Tally = { score: [0, 0], dunks: 0, layups: 0, jumpers: 0, made: 0, shots: 0, blocks: 0, steals: 0, oreb: 0, dreb: 0, poss: 0, fouls: 0, nan: 0, stuck: 0, len: 0 }
  const dt = 1 / 60
  const acts = new Map<number, string>()
  let seen = 0
  let shotTeam = -1
  let lastOwner = -2
  let still = 0
  let lastPoss = -1
  for (let i = 0; i < 60 * 60 * 10 && g.phase !== 'over'; i++) {
    step(g, dt, NO_INPUT)
    for (const p of g.ps) {
      const was = acts.get(p.id)
      if (p.act !== was) {
        if (p.act === 'dunk') t.dunks++
        if (p.act === 'layup') t.layups++
        if (p.act === 'shoot') t.jumpers++
        acts.set(p.id, p.act)
      }
      if (!Number.isFinite(p.x) || !Number.isFinite(p.z)) t.nan++
    }
    const f = g.ball.flight
    if (f && f.kind === 'shot' && !f.leg && !f.ft && f.t <= dt * 1.01) {
      t.shots++
      if (f.make) t.made++
      shotTeam = f.team
    }
    // A rebound: after a missed shot, the first to have it.
    if (shotTeam >= 0 && g.ball.owner >= 0 && !g.ball.flight) {
      const o = g.ps[g.ball.owner]
      if (o.team === shotTeam) t.oreb++
      else t.dreb++
      shotTeam = -1
    }
    if (g.phase === 'dead') shotTeam = -1
    while (seen < g.moments.length) {
      const m = g.moments[seen++]
      if (m.kind === 'block') t.blocks++
      if (m.kind === 'steal') t.steals++
      if (m.kind === 'foul') t.fouls++
    }
    if (g.poss !== lastPoss) {
      t.poss++
      lastPoss = g.poss
    }
    if (!Number.isFinite(g.ball.x) || !Number.isFinite(g.ball.y)) t.nan++
    // The same one holding it for 20 s: stuck.
    if (g.ball.owner === lastOwner && g.ball.owner >= 0) still += dt
    else still = 0
    lastOwner = g.ball.owner
    if (still > 20) {
      t.stuck++
      still = 0
    }
  }
  t.score = [g.score[0], g.score[1]]
  t.len = g.time
  return t
}

for (const [name, rules] of [
  ['rue', { street: true }],
  ['ancien', {}],
  ['palais', { full: true }],
] as [string, Rules][]) {
  const all: Tally[] = []
  for (let s = 1; s <= Number(process.env.N ?? 12); s++) all.push(run(rules, s * 101))
  const sum = (k: keyof Tally) => all.reduce((a, x) => a + (x[k] as number), 0)
  const n = all.length
  const w = all.filter((x) => x.score[0] > x.score[1]).length
  console.log(`${name}: ${all.map((x) => x.score.join('-')).join(' ')}`)
  console.log(`  team0 wins ${w}/${n}, avg len ${(sum('len') / n).toFixed(0)} s`)
  console.log(`  per match: shots ${(sum('shots') / n).toFixed(1)} (in ${((100 * sum('made')) / Math.max(1, sum('shots'))).toFixed(0)} %), dunks ${(sum('dunks') / n).toFixed(1)}, layups ${(sum('layups') / n).toFixed(1)}, jumpers ${(sum('jumpers') / n).toFixed(1)}`)
  console.log(`  blocks ${(sum('blocks') / n).toFixed(1)}, steals ${(sum('steals') / n).toFixed(1)}, oreb ${(sum('oreb') / n).toFixed(1)}, dreb ${(sum('dreb') / n).toFixed(1)}, poss ${(sum('poss') / n).toFixed(1)}, fouls ${(sum('fouls') / n).toFixed(1)}`)
  console.log(`  nan ${sum('nan')}, stuck ${sum('stuck')}`)
}
