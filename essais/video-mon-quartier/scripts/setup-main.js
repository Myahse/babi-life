const p = S.p
const id = p.sim.id
const out = []
for (const [kind, slot] of [['boutique', 4], ['maison', 5], ['grin', 3]]) {
  try {
    const r = await L.call(p.token, `/sims/${id}/quartier/build`, 'POST', { kind, slot })
    out.push([kind, slot, 'ok'])
  } catch (e) {
    out.push([kind, slot, String(e).slice(0, 150)])
  }
}
L.psql(`UPDATE quartiers SET reputation = 280, level = 2, name = 'Quartier Awa' WHERE sim_id = '${id}'`)
L.psql(`UPDATE quartier_buildings SET earnings_pending = 4200 + 900 * slot, staff = LEAST(2, staff + 1) WHERE sim_id = '${id}'`)
out.push(L.psql(`select kind, slot, level, staff, earnings_pending from quartier_buildings where sim_id='${id}'`))
return out
