// A load test of the API with players as the game makes them: each one
// signs in, loads what the game loads on opening, keeps the live socket
// (its Sim walking, its position several times a second), asks « around »
// every 15 s and its lots every minute, and now and then does something (an
// activity at a place of its commune, stopping it). It measures each request's
// time by route (p50, p95, max), the errors, the live messages, and (with
// --pg) the database's connections while it runs.
//
// It signs players in with the dev login (/auth/dev): run it against a local
// or staging API started with DEV_LOGIN=true, never against production.
//
//   node tools/loadtest/run.mjs --players 20 --minutes 3 [--api http://localhost:8099/api/v1] [--pg postgres://…]

import { execFileSync } from 'node:child_process'

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? process.argv[i + 1] : def
}
const API = arg('api', 'http://localhost:8099/api/v1')
const PLAYERS = Number(arg('players', 10))
const MINUTES = Number(arg('minutes', 2))
const PG = arg('pg', '')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const LOOK = { skin: '#a46c42', hair: 'short', hairColor: '#141010', outfit: 'tshirt', outfitColor: '#ff7a00', body: 'moyen', height: 1, eyes: '#2b1a10', beard: 'none', accessory: 'none', pattern: 'none', bottomColor: '', shoeColor: '', accessoryColor: '', marks: 'none', wear: 'neuf' }
// Where they live: a few communes, several players in each (they see each other live).
const HOMES = [
  [5.345, -4.082],
  [5.36, -3.99],
  [5.298, -3.986],
  [5.32, -4.02],
]

/* ---------- Measures ---------- */

const times = new Map() // route → ms[]
const errors = new Map() // route status → count
const route = (method, path) =>
  `${method} ${path
    .replace(/\?.*/, '')
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ':id')
    .replace(/\/\d+(?=\/|$)/g, '/:n')}`

async function call(token, path, method = 'GET', body) {
  const t0 = performance.now()
  const key = route(method, path)
  let status = 0
  try {
    const r = await fetch(API + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
    status = r.status
    const text = await r.text()
    if (!r.ok) throw Object.assign(new Error(text.slice(0, 120)), { status })
    return text ? JSON.parse(text) : null
  } catch (e) {
    // A refusal of the game (422: closed now, no money…) is an answer, not a failure.
    const k = `${key} ${status || 'network'}`
    if (status !== 422) errors.set(k, (errors.get(k) ?? 0) + 1)
    throw e
  } finally {
    const list = times.get(key) ?? []
    list.push(performance.now() - t0)
    times.set(key, list)
  }
}

const live = { sent: 0, received: 0, bytes: 0, opened: 0, failed: 0, closed: 0 }
const db = [] // connections seen, every 2 s

/* ---------- One player ---------- */

async function play(i, world, until) {
  const [lat, lng] = HOMES[i % HOMES.length]
  const name = `Charge${i}${Date.now().toString(36).slice(-3)}`
  const { token } = await call(null, '/auth/dev', 'POST', { name })
  const made = await call(token, '/sims', 'POST', { firstName: name, lastName: 'Test', gender: i % 2 ? 'femme' : 'homme', look: LOOK, traits: ['ambianceur', 'sportif'], aspiration: 'ambiance', lat, lng })
  const sim = made.sim ?? made
  // Opening the game: the Sim, the commune's places on the map, who's around, the lots.
  const opened = await call(token, `/sims/${sim.id}`)
  const s = opened.sim ?? opened
  const commune = world.cities.flatMap((c) => c.communes).find((c) => c.id === s.commune)
  await Promise.allSettled([call(token, `/places?commune=${s.commune}&lat=${commune.lat.toFixed(5)}&lng=${commune.lng.toFixed(5)}&r=1.2`), call(token, `/sims/${sim.id}/around`), call(token, `/sims/${sim.id}/plots`)])

  // The live socket: its Sim walking round in a circle.
  const ws = new WebSocket(API.replace(/^http/, 'ws') + '/live')
  ws.onopen = () => {
    live.opened++
    ws.send(JSON.stringify({ t: 'hello', token, sim: sim.id, mode: 'open' }))
  }
  ws.onmessage = (e) => {
    live.received++
    live.bytes += typeof e.data === 'string' ? Buffer.byteLength(e.data) : e.data.byteLength
  }
  ws.onerror = () => live.failed++
  ws.onclose = () => live.closed++
  const walk = setInterval(() => {
    if (ws.readyState !== WebSocket.OPEN) return
    const a = performance.now() / 4000 + i
    ws.send(JSON.stringify({ t: 'state', x: Math.round(Math.cos(a) * 30 * 10) / 10, y: 0, z: Math.round(Math.sin(a) * 30 * 10) / 10, h: a, p: 'walk' }))
    live.sent++
  }, 150)
  const ping = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ t: 'ping', c: Date.now() })), 20000)

  // What the game asks on its own, and what the player does.
  const places = commune.places
  let next = { around: Date.now() + 15000 * Math.random(), plots: Date.now() + 60000, act: Date.now() + 5000 + Math.random() * 20000 }
  while (Date.now() < until) {
    const now = Date.now()
    const jobs = []
    if (now >= next.around) (jobs.push(call(token, `/sims/${sim.id}/around`)), (next.around = now + 15000))
    if (now >= next.plots) (jobs.push(call(token, `/sims/${sim.id}/plots`)), (next.plots = now + 60000))
    if (now >= next.act) {
      next.act = now + 20000 + Math.random() * 20000
      const place = places[Math.floor(Math.random() * places.length)]
      const kind = world.kinds[place.kind]
      const it = kind?.interactions[Math.floor(Math.random() * kind.interactions.length)]
      // Stop what it's doing first (busy: the game says so), then something new.
      jobs.push(call(token, `/sims/${sim.id}/stop`, 'POST', {}).catch(() => null).then(() => (it ? call(token, `/sims/${sim.id}/interact`, 'POST', { placeId: place.id, interactionId: it.id }) : null)))
    }
    await Promise.allSettled(jobs)
    await sleep(500)
  }
  clearInterval(walk)
  clearInterval(ping)
  ws.close()
}

/* ---------- The run ---------- */

const pct = (list, p) => {
  const s = [...list].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] ?? 0
}

const world = await call(null, '/world')
const until = Date.now() + MINUTES * 60000
const sampler = PG
  ? setInterval(() => {
      try {
        const out = execFileSync('psql', [PG, '-Atc', "SELECT count(*), count(*) FILTER (WHERE state = 'active') FROM pg_stat_activity WHERE backend_type = 'client backend'"], { encoding: 'utf8' })
        const [all, active] = out.trim().split('|').map(Number)
        db.push({ all, active })
      } catch {
        // No psql here: no connection counts.
      }
    }, 2000)
  : null
console.log(`${PLAYERS} joueurs, ${MINUTES} min, ${API}`)
const started = performance.now()
// Coming in over the first 20 seconds, as players do (not all in the same second).
const runs = Array.from({ length: PLAYERS }, (_, i) => sleep((i * 20000) / PLAYERS).then(() => play(i, world, until).catch((e) => console.log(`joueur ${i}: ${e.message}`))))
await Promise.all(runs)
if (sampler) clearInterval(sampler)
const secs = (performance.now() - started) / 1000

console.log('\nRoute                                     n     p50    p95    max  (ms)')
for (const [k, list] of [...times].sort((a, b) => b[1].length - a[1].length))
  console.log(`${k.padEnd(40)} ${String(list.length).padStart(4)} ${pct(list, 50).toFixed(0).padStart(6)} ${pct(list, 95).toFixed(0).padStart(6)} ${Math.max(...list).toFixed(0).padStart(6)}`)
const total = [...times.values()].reduce((n, l) => n + l.length, 0)
console.log(`\n${total} requêtes en ${secs.toFixed(0)} s (${(total / secs).toFixed(1)}/s)`)
console.log(errors.size ? `Erreurs : ${[...errors].map(([k, n]) => `${k} ×${n}`).join(', ')}` : 'Aucune erreur (hors refus du jeu, 422).')
console.log(`Live : ${live.opened} connexions, ${live.failed} échecs, ${live.sent} positions envoyées (${(live.sent / secs).toFixed(0)}/s), ${live.received} messages reçus (${(live.received / secs).toFixed(0)}/s, ${(live.bytes / secs / 1e6).toFixed(2)} Mo/s)`)
if (db.length) console.log(`Base : jusqu'à ${Math.max(...db.map((d) => d.all))} connexions ouvertes, ${Math.max(...db.map((d) => d.active))} actives en même temps`)
