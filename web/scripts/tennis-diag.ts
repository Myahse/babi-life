// How tennis points end, AI against AI (src/sports/tennis.ts): per level, the share of points ended by an ace, a
// double fault, a winner, an error into the net or out (and how many of those came off a stretched stroke: forced),
// the strokes per rally, the balls that landed in out of all struck. Run from web/:
//   npx esbuild scripts/tennis-diag.ts --bundle --platform=node --format=esm --outfile=/tmp/tennis-diag.mjs && node /tmp/tennis-diag.mjs
import { createTennis, seeded, stepTennis, NO_TINPUT, LEVELS, HW, HL, type Tennis } from '../src/sports/tennis'

for (const lv of [0, 1, 2, 3]) {
  const end: Record<string, number> = {}
  let points = 0
  let strokes = 0
  let struck = 0
  let landedIn = 0
  let stretched = 0
  const hist = [0, 0, 0, 0, 0, 0, 0, 0]
  for (let s = 0; s < 6; s++) {
    const g: Tennis = createTennis('A', 'B', seeded(300 + s * 13 + lv), { level: lv, surface: s % 2 ? 'clay' : 'hard' })
    g.ps[0].human = false
    g.ps[0].lvl = LEVELS[lv]
    let seen = 0
    let lastStretch = 0
    for (let i = 0; i < 60 * 60 * 30 && g.phase !== 'over'; i++) {
      const plans = g.ps.map((p) => p.plan?.stretch ?? 0)
      stepTennis(g, 1 / 60, NO_TINPUT)
      for (; seen < g.moments.length; seen++) {
        const m = g.moments[seen]
        if (m.kind === 'hit' && m.text === 'serve') continue
        if (['hit', 'volley', 'smash', 'lob', 'drop'].includes(m.kind)) {
          struck++
          lastStretch = plans[m.by]
          if (lastStretch > 0.9) stretched++
          const to = g.ps[m.by === 0 ? 1 : 0]
          hist[to.plan ? Math.min(6, Math.floor(to.plan.stretch * 5)) : 7]++
        }
        if (m.kind === 'bounce' && g.ball.bounces === 1 && !g.ball.serve && !g.ball.out) landedIn++
        if (['ace', 'df', 'winner'].includes(m.kind)) end[m.kind] = (end[m.kind] ?? 0) + 1
        if (m.kind === 'out' && !g.ball.serve && g.mark) end[Math.abs(g.mark.x) > HW ? (Math.abs(g.mark.z) > HL ? '·both' : '·wide') : '·long'] = (end[Math.abs(g.mark.x) > HW ? (Math.abs(g.mark.z) > HL ? '·both' : '·wide') : '·long'] ?? 0) + 1
        if (m.kind === 'ace') end.ace = (end.ace ?? 0) + 0
        if (m.kind === 'out' && !g.ball.serve) end[lastStretch > 0.9 ? 'out (forced)' : 'out'] = (end[lastStretch > 0.9 ? 'out (forced)' : 'out'] ?? 0) + 1
        if (m.kind === 'net' && !g.ball.serve) end[lastStretch > 0.9 ? 'net (forced)' : 'net'] = (end[lastStretch > 0.9 ? 'net (forced)' : 'net'] ?? 0) + 1
      }
    }
    points += g.stats.points[0] + g.stats.points[1]
    strokes += 0
  }
  void strokes
  const pct = (n: number) => `${Math.round((100 * n) / points)}%`
  console.log(`lv${lv} points ${points} ` + Object.entries(end).map(([k, v]) => `${k} ${pct(v)}`).join(', ') + ` | strokes/pt ${(struck / points).toFixed(1)} in ${Math.round((100 * landedIn) / struck)}% stretched ${Math.round((100 * stretched) / struck)}% next-plan stretch (0.2 bins, last: none) ${hist.join(' ')}`)
}
