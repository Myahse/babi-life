// AI against AI tennis matches through the tennis engine (src/sports/tennis.ts), both players the
// AI at a level each: points, games, sets, aces, double faults, first serves in, winners, errors,
// rally lengths, the fastest serve; nothing stuck, no NaN, the score sane (a set ends 4-x by two or
// on the tie-break). Run from web/:
//   npx esbuild scripts/tennis-sim.ts --bundle --platform=node --format=esm --outfile=/tmp/tennis-sim.mjs && node /tmp/tennis-sim.mjs
import { createTennis, seeded, stepTennis, NO_TINPUT, LEVELS, type Tennis } from '../src/sports/tennis'

function run(seed: number, a: number, b: number, surface: 'clay' | 'hard', games = 4, sets = 1, minutes = 40) {
  const g: Tennis = createTennis('A', 'B', seeded(seed), { level: b, surface, games, sets })
  g.ps[0].human = false
  g.ps[0].lvl = LEVELS[a]
  let nan = 0
  let shots = 0
  const kinds: Record<string, number> = {}
  let seen = 0
  const dt = 1 / 60
  let i = 0
  for (; i < 60 * 60 * minutes && g.phase !== 'over'; i++) {
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
// (A real one lasts one and a half to two hours.)
const l = run(4242, 2, 2, 'clay', 6, 3, 180)
console.log('best of 3 to 6:', l.g.score.done.map((d) => d.join('-')).join(' '), 'winner', l.g.winner, l.minutes.toFixed(1), 'min', l.g.phase)

// The player's serve (the phone's human: its timing and the zone it picks): the first ball and the second,
// struck with the timing off by a spread (s), aimed at the T, the body or wide at random. How many go in,
// the aces, the speed. The first ball must be faster and fault more than the second.
function gaussOf(r: () => number) {
  return Math.sqrt(-2 * Math.log(Math.max(1e-9, r()))) * Math.cos(2 * Math.PI * r())
}
function serves(spread: number, shot: 'flat' | 'top', n: number) {
  const tally = () => ({ n: 0, in: 0, ace: 0, kmh: 0 })
  const out = { first: tally(), second: tally() }
  const r = seeded(77 + Math.round(spread * 1000))
  let seed = 9000
  for (let k = 0; k < n; k++) {
    for (const second of [false, true]) {
      // A match where the player serves first (the coin), up to its first serve.
      let g = createTennis('A', 'B', seeded(seed++), { level: 1 })
      while (g.server !== 0) g = createTennis('A', 'B', seeded(seed++), { level: 1 })
      while (g.phase !== 'serve') stepTennis(g, 1 / 60, NO_TINPUT)
      g.fault = second ? 1 : 0
      const when = 0.6 + gaussOf(r) * spread
      const mx = [-1, 0, 1][Math.floor(r() * 3)]
      const hold = second ? 'top' : shot
      let tossAt = -1
      for (let i = 0; i < 2000 && g.phase !== 'rally'; i++) {
        if (g.phase === 'toss' && tossAt < 0) tossAt = g.time
        const up = tossAt < 0 ? -1 : g.time - tossAt
        stepTennis(g, 1 / 120, { mx, mz: 0, hold: tossAt < 0 || up < when ? hold : null })
      }
      if (g.phase !== 'rally') continue
      const s = second ? out.second : out.first
      s.n++
      s.kmh += g.ball.speed * 3.6
      const from = g.moments.length
      for (let i = 0; i < 120 * 4 && g.phase === 'rally'; i++) stepTennis(g, 1 / 120, NO_TINPUT)
      const said = g.moments.slice(from).map((m) => m.kind)
      if (!said.some((m) => m === 'fault' || m === 'df')) s.in++
      if (said.includes('ace')) s.ace++
    }
  }
  const f = (s: ReturnType<typeof tally>) => `${Math.round((100 * s.in) / Math.max(1, s.n))}% in, ${Math.round((100 * s.ace) / Math.max(1, s.n))}% aces, ${Math.round(s.kmh / Math.max(1, s.n))} km/h`
  return `serve timing ±${spread.toFixed(2)} s ${shot.padEnd(4)}: 1st ${f(out.first)} | 2nd ${f(out.second)}`
}
for (const spread of [0, 0.04, 0.08, 0.15]) for (const shot of ['flat', 'top'] as const) console.log(serves(spread, shot, 200))
