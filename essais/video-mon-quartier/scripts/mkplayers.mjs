import { player, call } from './lib.mjs'
import { writeFileSync } from 'fs'
const D = '/tmp/claude-0/-home-user-babi-life/1e6aab45-c0cb-5310-a50c-6475bf9efcec/scratchpad/vmq/'
for (const c of ['cocody', 'yopougon', 'port-bouet']) {
  const p = await player(c, 'Awa')
  await call(p.token, `/sims/${p.sim.id}/quartier`)
  writeFileSync(`${D}pl-${c}.json`, JSON.stringify(p))
  console.log(c, p.sim.id)
}
