// One AI against AI basketball match, its referee's and commentator's calls in order (debugging the
// engine's flow). Run from web/:
//   npx esbuild scripts/hoop-log.ts --bundle --platform=node --format=esm --outfile=/tmp/hoop-log.mjs && node /tmp/hoop-log.mjs full 7
import { createGame, seeded, step, NO_INPUT, holder } from '../src/streetball/game'

const [mode = 'full', seed = '7'] = process.argv.slice(2)
const g = createGame('basket', 'Moi', seeded(Number(seed)), mode === 'full' ? { full: true } : mode === 'rue' ? { street: true } : {})
for (const p of g.ps) p.human = false
let last = ''
let owner = -9
for (let i = 0; i < 60 * 200 && g.phase !== 'over'; i++) {
  step(g, 1 / 60, NO_INPUT)
  const f = g.flash?.text ?? ''
  if (f !== last && f) console.log(g.time.toFixed(1), `[${g.score}]`, f)
  last = f
  const h = holder(g)
  if (h && h.id !== owner && process.env.OWN) console.log(g.time.toFixed(1), '  ball:', h.name, h.team, h.x.toFixed(1), h.z.toFixed(1), 'clock', g.clock.toFixed(1))
  owner = h?.id ?? -1
}
console.log('end', g.score, g.time.toFixed(0))
