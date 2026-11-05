// AI against AI volleyball matches through the volley engine (src/sports/volley.ts), indoors (six a
// side) and on the beach (two a side), the player's side played by the AI too: points, sets, aces,
// kills, blocks, digs, errors, how the rallies go (pass-set-spike chains), touches never over three,
// nothing stuck, no NaN. Run from web/:
//   npx esbuild scripts/volley-sim.ts --bundle --platform=node --format=esm --outfile=/tmp/volley-sim.mjs && node /tmp/volley-sim.mjs
import { createVolley, seeded, stepVolley, NO_VINPUT, type Volley } from '../src/sports/volley'

function run(seed: number, beach: boolean, level: number, points = 15, sets = 1, women = false) {
  const g: Volley = createVolley('Moi', ['Awa', 'Koffi', 'Yao', 'Ali', 'Fanta', 'Bamba'], seeded(seed), { beach, level, points, sets, women })
  g.ps[0].human = false
  let nan = 0
  let seen = 0
  const kinds: Record<string, number> = {}
  let psk = 0
  const dt = 1 / 60
  let i = 0
  let maxTouches = 0
  for (; i < 60 * 60 * 60 && g.phase !== 'over'; i++) {
    stepVolley(g, dt, NO_VINPUT)
    maxTouches = Math.max(maxTouches, g.ball.touches)
    if (!Number.isFinite(g.ball.x + g.ball.y + g.ball.z) || g.ps.some((p) => !Number.isFinite(p.x + p.z + p.y))) nan++
    for (; seen < g.moments.length; seen++) {
      const m = g.moments[seen]
      kinds[m.kind] = (kinds[m.kind] ?? 0) + 1
      if (m.kind === 'spike') {
        const c = g.chain
        const k = c.lastIndexOf('spike')
        if (k >= 2 && c[k - 1] === 'set' && (c[k - 2] === 'bump' || c[k - 2] === 'dig')) psk++
      }
    }
  }
  return { g, nan, kinds, psk, maxTouches, minutes: i / 3600 }
}

let stuck = 0
let bad = 0
for (const beach of [false, true])
  for (const level of [0, 1, 2, 3])
    for (let s = 0; s < 3; s++) {
      const r = run(500 + s * 31 + level * 7 + (beach ? 3 : 0), beach, level, 15, 1, s === 2)
      const g = r.g
      const st = g.stats
      if (g.phase !== 'over') stuck++
      if (r.nan) bad++
      const k = r.kinds
      console.log(
        `${beach ? 'beach ' : 'indoor'} lv${level}${s === 2 ? ' F' : '  '} ${g.score.done
          .map((d) => d.join('-'))
          .join(' ')
          .padEnd(
            6,
          )} win ${g.winner} rallies ${st.rallies} aces ${st.aces.join('/')} kills ${st.kills.join('/')} blocks ${st.blocks.join('/')} err ${st.errors.join('/')} digs ${st.digs.join('/')} serves ${k.serve ?? 0} bumps ${k.bump ?? 0} digs ${k.dig ?? 0} sets ${k.set ?? 0} spikes ${k.spike ?? 0} p-s-s ${r.psk} tips ${k.tip ?? 0} free ${k.free ?? 0} stuff ${k.stuff ?? 0} touch ${k.touch ?? 0} out ${k.out ?? 0} net ${k.net ?? 0} faults ${k.fault ?? 0} long ${st.longest} rot ${k.rotate ?? 0} sw ${k.switch ?? 0} max ${r.maxTouches} kill% ${Math.round((100 * (st.kills[0] + st.kills[1])) / Math.max(1, (k.spike ?? 0) + (k.tip ?? 0)))} att/rally ${(((k.spike ?? 0) + (k.tip ?? 0)) / Math.max(1, st.rallies)).toFixed(1)} ${r.minutes.toFixed(1)}min${r.nan ? ' NAN' : ''}`,
      )
    }
console.log(`stuck ${stuck} nan ${bad}`)
const l = run(77, false, 2, 25, 3)
console.log('indoor best of 3 (25, 25, 15):', l.g.score.done.map((d) => d.join('-')).join(' '), 'winner', l.g.winner, l.minutes.toFixed(1), 'min')
const b = run(78, true, 2, 21, 3)
console.log('beach best of 3 (21, 21, 15):', b.g.score.done.map((d) => d.join('-')).join(' '), 'winner', b.g.winner, b.minutes.toFixed(1), 'min')
