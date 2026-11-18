// The bench's quartiers: Awa's (Cocody) with a few buildings and the gbaka stop, Koffi's (Yopougon) full.
import { call, psql } from './lib.mjs'
import { readFileSync } from 'fs'
const D = '/tmp/claude-0/-home-user-babi-life/1e6aab45-c0cb-5310-a50c-6475bf9efcec/scratchpad/vmq/'
const build = async (p, kinds) => {
  const out = []
  for (const kind of kinds) {
    try {
      await call(p.token, `/sims/${p.sim.id}/quartier/build`, 'POST', { kind })
      out.push(kind + ' ok')
    } catch (e) {
      out.push(kind + ' ' + String(e).slice(0, 120))
    }
  }
  return out
}
const main = JSON.parse(readFileSync(D + 'ex-cocody-player.json', 'utf8'))
const koffi = JSON.parse(readFileSync(D + 'pl-koffi.json', 'utf8'))
psql(`UPDATE quartiers SET level = 3, reputation = 260, name = 'Quartier Awa' WHERE sim_id = '${main.sim.id}'`)
psql(`UPDATE sims SET money = 9000000 WHERE id = '${main.sim.id}'`)
console.log(await build(main, ['boutique', 'maison', 'grin', 'arret_gbaka', 'eclairage', 'maison']))
psql(`UPDATE quartiers SET level = 3, reputation = 280 WHERE sim_id = '${main.sim.id}'`)
psql(`UPDATE quartier_buildings SET earnings_pending = 4200 + 900 * slot, staff = LEAST(2, staff + 1) WHERE sim_id = '${main.sim.id}'`)
psql(`UPDATE quartiers SET level = 5, reputation = 900, name = 'Quartier Koffi' WHERE sim_id = '${koffi.sim.id}'`)
psql(`UPDATE sims SET money = 20000000 WHERE id = '${koffi.sim.id}'`)
console.log(await build(koffi, ['maquis', 'marche', 'salon', 'boutique', 'pharmacie', 'grin', 'terrain', 'arret_gbaka', 'eclairage', 'maison', 'maison', 'ecole']))
console.log(psql(`select sim_id, kind, slot from quartier_buildings order by sim_id, slot`))
