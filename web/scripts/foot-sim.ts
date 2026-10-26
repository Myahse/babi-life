// AI against AI football matches through the street engine (src/streetball/game.ts), to check the
// street rules didn't move (street 5) and the console's (referee, switching, eleven) stay sane: goals,
// fouls, cards, set pieces, nothing stuck, no NaN. Run from web/:
//   npx esbuild scripts/foot-sim.ts --bundle --platform=node --format=esm --outfile=/tmp/foot-sim.mjs && node /tmp/foot-sim.mjs
import { createGame, seeded, step, NO_INPUT, type Game, type Rules } from '../src/streetball/game'

type Tally = { goals: number; fouls: number; cards: number; pens: number; free: number; corners: number; throws: number; goalkicks: number; headers: number; nan: number; stuck: number; saves: number; shotsOver: number }
function run(rules: Rules, seed: number, human = false) {
  const g: Game = createGame('foot', 'Moi', seeded(seed), rules)
  if (!human) {
    for (const p of g.ps) p.human = false
    g.switching = false
  }
  const t: Tally = { goals: 0, fouls: 0, cards: 0, pens: 0, free: 0, corners: 0, throws: 0, goalkicks: 0, headers: 0, nan: 0, stuck: 0, saves: 0, shotsOver: 0 }
  let lastSet: unknown = null
  let lastFlash = ''
  let sameOwner = 0,
    lastOwner = -2
  let deadFor = 0
  const dt = 1 / 60
  for (let i = 0; i < 60 * 60 * 12 && g.phase !== 'over'; i++) {
    step(g, dt, NO_INPUT)
    if (g.set && g.set !== lastSet) {
      const k = g.set.kind
      if (k === 'pen') t.pens++
      else if (k === 'free') t.free++
      else if (k === 'corner') t.corners++
      else if (k === 'throw') t.throws++
      else if (k === 'goal') t.goalkicks++
    }
    lastSet = g.set
    const f = g.flash?.text ?? ''
    if (f !== lastFlash) {
      if (/Faute/.test(f)) t.fouls++
      if (/Carton|expulsé/.test(f)) {
        t.fouls++
        t.cards++
      }
      if (/Tête/.test(f)) t.headers++
      if (/Arrêt/.test(f)) t.saves++
      lastFlash = f
    }
    for (const p of g.ps) if (!isFinite(p.x) || !isFinite(p.z)) t.nan++
    if (!isFinite(g.ball.x)) t.nan++
    if (g.ball.owner === lastOwner && g.ball.owner >= 0) sameOwner++
    else {
      sameOwner = 0
      lastOwner = g.ball.owner
    }
    // Stuck: one player on the ball for 25 s, or the play stopped for 10 s.
    if (sameOwner > 60 * 25) {
      t.stuck++
      sameOwner = 0
    }
    if (g.phase === 'dead') deadFor++
    else deadFor = 0
    if (deadFor > 60 * 10) {
      t.stuck++
      deadFor = 0
    }
  }
  t.goals = g.score[0] + g.score[1]
  return { t, score: g.score, time: Math.round(g.time), phase: g.phase }
}
const modes: [string, Rules][] = [
  ['street 5', {}],
  ['console 5', { referee: true, switching: true, length: 240 }],
  ['stade 11', { size: 11, referee: true, switching: true, length: 360 }],
]
for (const [name, rules] of modes) {
  const sum: Record<string, number> = {}
  const scores: string[] = []
  const N = 12
  for (let s = 1; s <= N; s++) {
    const r = run(rules, s * 101)
    for (const [k, v] of Object.entries(r.t)) sum[k] = (sum[k] ?? 0) + v
    scores.push(`${r.score[0]}-${r.score[1]}${r.phase !== 'over' ? '!' + r.phase : ''}`)
  }
  console.log(name, JSON.stringify(Object.fromEntries(Object.entries(sum).map(([k, v]) => [k, +(v / N).toFixed(2)]))), scores.join(' '))
}
