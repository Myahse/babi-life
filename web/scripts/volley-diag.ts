// What becomes of an attack, AI against AI (src/sports/volley.ts): per level, indoors and on the beach, the share of
// spikes that kill, are stuffed, touched by the block, dug (cleanly or shanked), go out or into the net; the
// attacks per rally. Run from web/:
//   npx esbuild scripts/volley-diag.ts --bundle --platform=node --format=esm --outfile=/tmp/volley-diag.mjs && node /tmp/volley-diag.mjs
import { createVolley, seeded, stepVolley, NO_VINPUT, type Volley } from '../src/sports/volley'

for (const beach of [false, true])
  for (const lv of [0, 1, 2, 3]) {
    const out: Record<string, number> = {}
    let spikes = 0
    let rallies = 0
    const gap = [0, 0, 0, 0, 0]
    for (let s = 0; s < 4; s++) {
      const g: Volley = createVolley('Moi', ['Awa', 'Koffi', 'Yao', 'Ali', 'Fanta', 'Bamba'], seeded(900 + s * 7 + lv), { beach, level: lv, points: 15 })
      g.ps[0].human = false
      let seen = 0
      let open = false
      for (let i = 0; i < 60 * 60 * 30 && g.phase !== 'over'; i++) {
        stepVolley(g, 1 / 60, NO_VINPUT)
        for (; seen < g.moments.length; seen++) {
          const m = g.moments[seen]
          if (m.kind === 'spike') {
            spikes++
            open = true
            // How far the nearest defender stands from where the attack comes down, at the hit.
            const i = g.pathN - 1
            const [lx, lz] = [g.path[i * 4], g.path[i * 4 + 2]]
            const near = Math.min(...g.ps.filter((p) => p.team !== m.team && Math.abs(p.z) > 1.2).map((p) => Math.hypot(p.x - lx, p.z - lz)))
            gap[Math.min(4, Math.floor(near))]++
            continue
          }
          if (!open) continue
          const k = m.kind === 'dig' ? (m.text === 'shank' ? 'shank' : 'dug') : m.kind === 'block' ? 'tool' : m.kind === 'bump' || m.kind === 'free' ? 'bumped' : m.kind
          if (['kill', 'stuff', 'touch', 'tool', 'shank', 'dug', 'bumped', 'out', 'net', 'floor'].includes(k)) {
            out[k] = (out[k] ?? 0) + 1
            open = false
          }
        }
      }
      rallies += g.stats.rallies
    }
    const pct = (n: number) => `${Math.round((100 * n) / spikes)}%`
    console.log(`${beach ? 'beach ' : 'indoor'} lv${lv} spikes ${spikes} att/rally ${(spikes / rallies).toFixed(1)} ` + Object.entries(out).map(([k, v]) => `${k} ${pct(v)}`).join(', ') + ` | nearest defender to the landing, m (0-1 1-2 2-3 3-4 4+): ${gap.join(' ')}`)
  }
