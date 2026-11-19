// Video bench: Awa (adult, Cocody) with Yao, met in the game, living with her (love language « les mots doux »,
// seed chosen so today's « Bonjour mon cœur » is « Bonjour mon cœur ☀️ … »); Koffi and Mariam, two players in a
// couple (Mariam's mot doux lands as a pink card in Koffi's Gbairai). Writes players.json.
import { call, psql } from './lib.mjs'
import { writeFileSync } from 'fs'
const LOOK = (g, c) => ({ skin: g === 'femme' ? '#7a4a2a' : '#5a3520', hair: g === 'femme' ? 'tresses' : 'short', hairColor: '#141010', outfit: g === 'femme' ? 'pagne' : 'casual', outfitColor: c, body: 'moyen', height: 1, eyes: '#2b1a10', beard: 'none', accessory: 'none', pattern: 'cercles', marks: 'none', wear: 'neuf' })
const tag = Date.now().toString(36).slice(-4)
const out = {}
for (const [name, g, c] of [['Awa', 'femme', '#d6336c'], ['Koffi', 'homme', '#1c7ed6'], ['Mariam', 'femme', '#f59f00']]) {
  const { token } = await call(null, '/auth/dev', 'POST', { name: `${name}${tag}` })
  const me = await call(token, '/me')
  const sim = await call(token, '/sims', 'POST', { firstName: name, lastName: 'Koné', gender: g, look: LOOK(g, c), traits: ['ambianceur'], aspiration: 'ambiance', lat: 5.33, lng: -4.0 })
  psql(`UPDATE users SET adult_at = now(), tester = true WHERE id = '${me.id}'`)
  const user = await call(token, '/me')
  out[name] = { token, user, sim: { id: sim.id ?? sim.sim?.id } }
}
const ids = Object.values(out).map((p) => `'${p.sim.id}'`).join(',')
psql(`UPDATE sims SET born_at = born_at - 25*525600, money = 300000, apps = '{gbairai}' WHERE id IN (${ids})`)
const now = Math.floor(Date.now() / 1000)
const yao = [{ id: 'p-yao5', name: 'Yao', gender: 'homme', seed: 14, commune: 'cocody', friendship: 72, adult: true, partner: true, home: true, met: 0, seen: 0, romance: 68, stage: 'ensemble', loveSince: now - 12 * 86400 - 3600, loveTended: now - 3600, annivSeen: 1, look: { skin: '#4a2a18', hair: 'short', hairColor: '#0d0b0a', outfit: 'chemise', outfitColor: '#2b8a3e', body: 'moyen', height: 1.04, eyes: '#2b1a10', beard: 'bouc', accessory: 'none', pattern: 'cercles', marks: 'none', wear: 'neuf' } }]
psql(`UPDATE sims SET friends = '${JSON.stringify(yao)}' WHERE id = '${out.Awa.sim.id}'`)
const [x, y] = [out.Koffi.sim.id, out.Mariam.sim.id].sort()
psql(`INSERT INTO bonds (sim_a, sim_b, friendship, friends) VALUES ('${x}', '${y}', 70, true) ON CONFLICT DO NOTHING`)
psql(`UPDATE bonds SET couple = true, romance = 72, love_stage = 'ensemble', love_since = now() - interval '20 days', love_tended = now() WHERE sim_a = '${x}' AND sim_b = '${y}'`)
writeFileSync(new URL('./players.json', import.meta.url), JSON.stringify(out, null, 1))
console.log(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.sim.id])))
