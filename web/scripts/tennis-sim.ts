// AI against AI tennis matches through the tennis engine (src/sports/tennis.ts), both players the
// AI at a level each: points, games, sets, aces, double faults, first serves in, winners, errors,
// rally lengths, the fastest serve; nothing stuck, no NaN, the score sane (a set ends 4-x by two or
// on the tie-break). Run from web/:
//   npx esbuild scripts/tennis-sim.ts --bundle --platform=node --format=esm --outfile=/tmp/tennis-sim.mjs && node /tmp/tennis-sim.mjs
import { createTennis, seeded, stepTennis, NO_TINPUT, LEVELS, type Tennis } from '../src/sports/tennis'

function run(seed: number, a: number, b: number, surface: 'clay' | 'hard', games = 4, sets = 1) {
  const g: Tennis = createTennis('A', 'B', seeded(seed), { level: b, surface, games, sets })
  g.ps[0].human = false
  g.ps[0].lvl = LEVELS[a]
  let nan = 0
  let shots = 0
  const kinds: Record<string, number> = {}
  let seen = 0
  const dt = 1 / 60
  let i = 0
  for (; i < 60 * 60 * 40 && g.phase !== 'over'; i++) {
    stepTennis(g, dt, NO_TINPUT)
    if (!Number.isFinite(g.ball.x + g.ball.y + g.ball.z) || g.ps.some((p) => !Number.isFinite(p.x + p.z))) nan++
    for (; seen < g.moments.length; seen++) {
      const m = g.moments[seen]
      kinds[m.kind] = (kinds[m.kind] ?? 0) + 1
      if (m.kind === 'hit' || m.kind === 'volley' || m.kind === 'smash' || m.kind === 'lob' || m.kind === 'drop') shots++
    }
  }
  const rallies = g.stats.points[0] + g.stats.points[1]
  return { g, nan, shots, rallies, kinds, minutes: i / 60 / 60 }
}

const out: string[] = []
let stuck = 0
let bad = 0
const wins = [0, 0]
for (const [a, b] of [
  [1, 1],
  [2, 2],
  [3, 1],
  [0, 3],
  [3, 3],
]) {
  for (const surface of ['hard', 'clay'] as const) {
    for (let s = 0; s < 4; s++) {
      const r = run(1000 + s * 17 + a * 3 + b, a, b, surface)
      const g = r.g
      if (g.phase !== 'over') stuck++
      if (r.nan) bad++
      if (g.winner !== null) wins[g.winner]++
      const st = g.stats
      const sets = g.score.done.map((d) => d.join('-')).join(' ')
      const fs = (k: 0 | 1) => (st.firstAll[k] ? Math.round((100 * st.firstIn[k]) / st.firstAll[k]) : 0)
      out.push(
        `lv ${a}v${b} ${surface.padEnd(4)} ${sets.padEnd(6)} win ${g.winner} pts ${st.points.join('-')} aces ${st.aces.join('/')} df ${st.df.join('/')} 1st% ${fs(0)}/${fs(1)} win ${st.winners.join('/')} err ${st.errors.join('/')} shots/pt ${(r.shots / Math.max(1, r.rallies)).toFixed(1)} long ${st.longest} fast ${st.fastest.join('/')}kmh net ${r.kinds.net ?? 0} out ${r.kinds.out ?? 0} let ${r.kinds.let ?? 0} vol ${r.kinds.volley ?? 0} sm ${r.kinds.smash ?? 0} drop ${r.kinds.drop ?? 0} lob ${r.kinds.lob ?? 0} tb ${r.kinds.tiebreak ?? 0} ${r.minutes.toFixed(1)}min${r.nan ? ' NAN' : ''}`,
      )
    }
  }
}
console.log(out.join('\n'))
console.log(`stuck ${stuck} nan ${bad} wins ${wins.join('-')}`)
// A long match: best of three sets to 6.
const l = run(4242, 2, 2, 'clay', 6, 3)
console.log('best of 3 to 6:', l.g.score.done.map((d) => d.join('-')).join(' '), 'winner', l.g.winner, l.minutes.toFixed(1), 'min', l.g.phase)
