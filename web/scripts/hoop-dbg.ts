// Basketball, AI against AI: each side's numbers apart (shots, makes, possessions, steals, fouls, blocks), to find what favours one side.
// Run from web/: npx esbuild scripts/hoop-dbg.ts --bundle --platform=node --format=esm --outfile=/tmp/hoop-dbg.mjs && node /tmp/hoop-dbg.mjs [rue|ancien|full]
import { createGame, seeded, step, NO_INPUT } from '../src/streetball/game'

const mode = process.argv[2] ?? 'ancien'
const tally = { wins: [0, 0], shots: [0, 0], made: [0, 0], poss: [0, 0], steals: [0, 0], fouls: [0, 0], blocks: [0, 0], points: [0, 0] }
for (let s = 1; s <= 30; s++) {
  const g = createGame('basket', 'Moi', seeded(s * 77), mode === 'rue' ? { street: true } : mode === 'full' ? { full: true } : {})
  for (const p of g.ps) p.human = false
  let lp = -1
  let seen = 0
  for (let i = 0; i < 60 * 300 && g.phase !== 'over'; i++) {
    step(g, 1 / 60, NO_INPUT)
    const f = g.ball.flight
    if (f && f.kind === 'shot' && !f.leg && f.t <= 1 / 60 + 1e-6) {
      tally.shots[f.team]++
      if (f.make) tally.made[f.team]++
    }
    if (g.poss !== lp) {
      tally.poss[g.poss]++
      lp = g.poss
    }
    while (seen < g.moments.length) {
      const m = g.moments[seen++]
      if (m.kind === 'steal') tally.steals[m.team]++
      if (m.kind === 'foul') tally.fouls[m.team]++
      if (m.kind === 'block') tally.blocks[m.team]++
    }
  }
  tally.points[0] += g.score[0]
  tally.points[1] += g.score[1]
  if (g.score[0] !== g.score[1]) tally.wins[g.score[0] > g.score[1] ? 0 : 1]++
}
console.log(mode, JSON.stringify(tally))
