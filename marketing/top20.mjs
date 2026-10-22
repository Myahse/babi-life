// « 20 trucs à faire dans Babi Life » (about a minute, 1080 × 1920, 30 images a second): the game
// filmed being played, on a machine too slow to play it (clock.mjs stops the page's clock: each frame
// is moved on by hand, then taken), one activity swiping up after the other, each for as long as Awa's
// line on it, the countdown drawn over it (web/src/lab/poster.tsx, ?video=top20&overlay), put together
// by compose.py, Awa's voice (voice.py) over its beat (beat.py).
//
// The activities: four of the game's scenes drawn by the poster lab (the grin, the mass, the zouglou,
// the Tour F); the game's places as a player sees them, zoomed in with the wheel and the camera turned
// (the ski off Île Boulay, the Hôtel Ivoire's rink and its brunch, the Friday prayer, the mall, the
// Kinéo, the market, the club); the talk with someone in the street and the phone's camera; the flight;
// the kart, basketball and football, the player's own driven by the game's AI; and two tables of the
// real game (dames, 8 américain) against a local API, the board and the cards dealt by hand.
//
//   python3 voice.py   # Awa's lines first (out/voix-top20/): the film is timed on them
//   API=http://localhost:8099/api/v1 GAME=http://192.0.2.2:5175 DATABASE_URL=postgres://… TESTER_CODE=… node top20.mjs
//
// API: a local or staging API started with DEV_LOGIN=true, never production. GAME: the game's dev
// server built against it (VITE_API_URL), at an address in the API's ALLOWED_ORIGINS. DATABASE_URL:
// that API's database (the board and the cards are dealt there). TESTER_CODE: the testers' code or that
// API's admin key (Awa grown up, with money). ONLY=foot,huit films just those again, the others kept.

import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import QRCode from 'qrcode'
import { chromium } from 'playwright-core'
import { HERE, OUT, SHORT, URL } from './shared.mjs'
import { STOPPED_CLOCK } from './clock.mjs'

const FPS = 30
const SWIPE = 0.3
// Each take is filmed long enough for any of Awa's lines on it; its slot is cut from it.
const TAKE = Math.round(4.5 * FPS)
// A basket or a goal lands this long before its slot's end.
const PAYOFF = 1.0

const API = process.env.API ?? 'http://localhost:8099/api/v1'
const GAME = process.env.GAME ?? 'http://localhost:5174'
const DB = process.env.DATABASE_URL ?? 'postgres://postgres:pg@localhost:5432/babi'
const ONLY = process.env.ONLY?.split(',')
const PORT = 5245
const LAB = `http://127.0.0.1:${PORT}`
const FRAMES = path.join(OUT, 'video-frames', 'top20')
const VOICE = path.join(OUT, 'voix-top20')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* ---------- The activities, N°20 to N°1 ---------- */

// zoom: [frames before (the walk to the spot), wheel steps in, how far the camera is lowered];
// start: the take's frame the slot starts on; speed: how fast a poster scene is played (the drone, quicker).
const CLIPS = [
  { id: 'ski', lab: 'view=boulay&act=ski-boulay', zoom: [200, 5, 120] },
  { id: 'nouchi', lab: 'view=talk', talk: true },
  { id: 'patinoire', lab: 'view=ivoire&act=patinoire', zoom: [400, 8, 200] },
  { id: 'grin', scene: 'grin' },
  { id: 'marche', lab: 'view=stalls', zoom: [200, 3, 30] },
  { id: 'photo', lab: 'view=phonecam', shutter: true },
  { id: 'messe', scene: 'messe' },
  { id: 'priere', lab: 'view=mosquee&act=priere-vendredi&m=780', zoom: [400, 4, 40] },
  { id: 'mall', lab: 'view=mall&act=leche-vitrine', zoom: [500, 8, 150] },
  { id: 'cine', lab: 'view=kineo&seance=demo:3:E6', zoom: [300, 0, 0] },
  { id: 'brunch', lab: 'view=ivoire&act=brunch-lagune', zoom: [500, 8, 150] },
  { id: 'boite', lab: 'view=party', zoom: [200, 0, 0] },
  { id: 'zouglou', scene: 'zouglou' },
  { id: 'avion', lab: 'view=flight' },
  { id: 'plateau', voice: 'tourf', scene: 'tourf', speed: 1.5 },
  { id: 'dames', game: dames, start: 8 },
  { id: 'huit', game: huit, start: 40 },
  { id: 'kart', lab: 'view=kart', auto: true, from: 9 },
  { id: 'basket', lab: 'view=hoops&seed=7', match: true },
  { id: 'foot', lab: 'view=foot5&seed=7', match: true, more: 7 },
]

/* ---------- The times, on Awa's voice ---------- */

// Each line (voice.py: out/voix-top20/<id>.wav, their lengths in report.json) gets its slot: the hook,
// each activity, the end card, a beat of air after each line.
// Until every line is there, only the takes that don't depend on the times can be filmed (not the
// zouglou, on the beat, nor the overlay), and nothing is put together.
const said = fs.existsSync(path.join(VOICE, 'report.json')) ? JSON.parse(fs.readFileSync(path.join(VOICE, 'report.json'), 'utf8')) : {}
const voiced = ['hook', ...CLIPS.map((c) => c.voice ?? c.id), 'outro'].every((id) => said[id])
if (!voiced && (!ONLY || ONLY.some((id) => id === 'zouglou' || id === 'overlay'))) {
  console.error('Not all of the voice yet: python3 voice.py first (out/voix-top20/).')
  process.exit(1)
}
const len = (id) => said[id]?.dur ?? 2.4
const HOOK = Math.max(2.8, len('hook') + 0.35)
const SLOTS = []
let at = HOOK
for (const c of CLIPS) {
  const d = Math.max(2.3, len(c.voice ?? c.id) + 0.3)
  SLOTS.push({ clip: c.id, from: +at.toFixed(3), to: +(at + d).toFixed(3), start: c.start ?? 0 })
  at += d
}
const OUTRO = +at.toFixed(3)
const LENGTH = +(OUTRO + Math.max(5.5, len('outro') + 2.2)).toFixed(3)
const frames = (s) => Math.round((s.to - s.from + SWIPE) * FPS)

/* ---------- Filming ---------- */

/** A phone's screen (shots of 1080 × 1920), its clock stopped. */
async function phone(b, init = []) {
  const ctx = await b.newContext({ viewport: { width: 405, height: 720 }, deviceScaleFactor: 1080 / 405, isMobile: true, hasTouch: true, locale: 'fr-FR', ignoreHTTPSErrors: true })
  for (const [fn, arg] of init) await ctx.addInitScript(fn, arg)
  await ctx.addInitScript(STOPPED_CLOCK)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.error('page:', String(e).slice(0, 200)))
  return { ctx, page }
}
/** One frame on (or n). */
const tick = (page, n = 1) => page.evaluate((n) => {
  for (let i = 0; i < n; i++) window.__advance(1000 / 30)
}, n)
const shoot = (page, dir, i) => page.screenshot({ path: path.join(dir, `${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 })
/** Frames on while the page loads (and real time for what comes from the network). */
async function warm(page, frames) {
  await sleep(3000)
  for (let i = 0; i < frames; i++) {
    await tick(page)
    if (i % 20 === 0) await sleep(200)
  }
}

/** A scene of the poster lab, on its own clock. */
async function scene(b, clip, dir) {
  const page = await b.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 })
  page.on('pageerror', (e) => console.error('page:', String(e).slice(0, 200)))
  const slot = SLOTS.find((x) => x.clip === clip.id)
  await page.goto(`${LAB}/poster.html?video=top20&only=${clip.scene}&from=${slot.from - SWIPE}`, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => !!window.__frame)
  for (const s of [0, 0.03, 0.06]) (await page.evaluate((s) => window.__frame(s), s), await sleep(300))
  for (let i = 0; i < TAKE; i++) {
    await page.evaluate((s) => window.__frame(s), (i * (clip.speed ?? 1)) / FPS)
    await shoot(page, dir, i)
  }
  await page.close()
}

/** A lab playing by itself (the kart driven by the game's own AI: kart/physics.ts autoInput). */
async function lab(b, clip, dir) {
  const { ctx, page } = await phone(b, clip.auto ? [[() => (globalThis.kartAuto = true)]] : [])
  // The lab has no API: the photo is sent, the game is told it went (else « Failed to fetch »).
  if (clip.shutter) await page.route('**/sims/*/photos', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }, body: JSON.stringify({ photo: { id: 1 } }) }))
  await page.goto(`${LAB}/city.html?${clip.lab}`)
  await warm(page, Math.round((clip.from ?? 3) * FPS))
  // The talk: a greeting, then a tease (Koffi laughing, then answering back); the camera: one photo.
  const at = clip.talk
    ? { 12: () => page.getByRole('button', { name: /On dit quoi/ }).first().click(), 70: () => page.getByRole('tab', { name: /Taquiner/ }).first().click() }
    : clip.shutter
      ? { 60: () => page.getByRole('button', { name: 'Prendre la photo' }).click() }
      : {}
  for (let i = 0; i < TAKE; i++) {
    if (at[i]) await at[i]().catch((e) => console.error(clip.id, String(e).slice(0, 120)))
    await tick(page)
    await shoot(page, dir, i)
  }
  await ctx.close()
}

/**
 * A place of the game as a player sees it: once there, zoomed in with the wheel and the camera lowered
 * (a drag up), then turned slowly while it's taken (a drag across). A mouse, not a touch screen: the
 * wheel and the drag are the mouse's.
 */
async function place(b, clip, dir) {
  const ctx = await b.newContext({ viewport: { width: 405, height: 720 }, deviceScaleFactor: 1080 / 405, locale: 'fr-FR' })
  await ctx.addInitScript(STOPPED_CLOCK)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.error('page:', String(e).slice(0, 200)))
  const [before, wheel, lower] = clip.zoom
  await page.goto(`${LAB}/city.html?${clip.lab}`)
  await warm(page, before)
  await page.mouse.move(202, 360)
  for (let i = 0; i < wheel; i++) (await page.mouse.wheel(0, -200), await tick(page, 3))
  await page.mouse.down()
  for (let i = 0; i < 12; i++) (await page.mouse.move(202, 360 - (lower * (i + 1)) / 12), await tick(page))
  await page.mouse.up()
  await tick(page, 30)
  await page.mouse.move(120, 300)
  await page.mouse.down()
  // About 20° over the take: enough to feel the camera in hand, not so much it swings into a wall.
  for (let i = 0; i < TAKE; i++) {
    await page.mouse.move(120 + i * 0.3, 300)
    await tick(page)
    await shoot(page, dir, i)
  }
  await page.mouse.up()
  await ctx.close()
}

/**
 * A street match (streetball/), the player's own played by the AI: a first run, nothing taken, finds
 * when its team scores (the match time); the same match again (the lab's seed) is taken round it.
 */
async function match(b, clip, dir) {
  const play = () =>
    page.evaluate(() => {
      const g = globalThis.streetMatch
      if (!g) return null
      g.ps[g.me].human = false
      return { time: g.time, score: g.score[g.ps[g.me].team] }
    })
  let { ctx, page } = await phone(b)
  await page.goto(`${LAB}/city.html?${clip.lab}`)
  await sleep(3000)
  let goal = null
  for (let i = 0; i < 120 * FPS && goal === null; i++) {
    await tick(page)
    if (i % 60 === 0) await sleep(30)
    const s = await play()
    if (s && s.time > 2 && s.score > 0) goal = s.time
  }
  await ctx.close()
  if (goal === null) throw new Error(`${clip.id}: no score in two minutes`)
  ;({ ctx, page } = await phone(b))
  await page.goto(`${LAB}/city.html?${clip.lab}`)
  await sleep(3000)
  // Taken from a little earlier than its slot needs, to land the score at PAYOFF before the slot's end.
  const from = goal - (TAKE / FPS - PAYOFF)
  for (let i = 0; ; i++) {
    await tick(page)
    if (i % 60 === 0) await sleep(30)
    const s = await play()
    if (s && s.time >= from) break
  }
  const total = TAKE + Math.round((clip.more ?? 0) * FPS)
  let scored = null
  for (let i = 0; i < total; i++) {
    await tick(page)
    const s = await play()
    if (scored === null && s?.score > 0) scored = i
    await shoot(page, dir, i)
  }
  await ctx.close()
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ payoff: scored }))
  console.log(`${clip.id}: scored at ${goal.toFixed(2)} s of the match, frame ${scored} of the take`)
}

/* ---------- The real game: Awa at a table, against a local API ---------- */

async function call(token, p, method = 'GET', body) {
  const r = await fetch(API + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
  const text = await r.text()
  if (!r.ok) throw new Error(`${method} ${p} ${r.status}: ${text.slice(0, 200)}`)
  return text ? JSON.parse(text) : null
}
const psql = (q) => execFileSync('psql', [DB, '-tAc', q]).toString().trim()
const LOOK = { skin: '#6e4024', hair: 'braids', hairColor: '#141010', outfit: 'pagne', outfitColor: '#ff7a00', body: 'moyen', height: 1, eyes: '#2b1a10', beard: 'none', accessory: 'none', pattern: 'none', bottomColor: '', shoeColor: '', accessoryColor: '', marks: 'none', wear: 'neuf' }

/** Awa, grown up, in the Plateau, with money and the app installed. */
async function awa(app) {
  const { token } = await call(null, '/auth/dev', 'POST', { name: `Awa${Date.now().toString(36).slice(-4)}` })
  const user = await call(token, '/me/tester', 'POST', { code: process.env.TESTER_CODE ?? '', typed: true })
  const made = await call(token, '/sims', 'POST', { firstName: 'Awa', lastName: 'Koné', gender: 'femme', look: LOOK, traits: ['ambianceur', 'sportif'], aspiration: 'ambiance', lat: 5.3237, lng: -4.0197 })
  const sim = made.sim ?? made
  await call(token, `/sims/${sim.id}/tester`, 'POST', { pass: process.env.TESTER_CODE, action: 'age', stage: 'adulte' })
  await call(token, `/sims/${sim.id}/tester`, 'POST', { pass: process.env.TESTER_CODE, action: 'money', amount: 100000 })
  await call(token, `/sims/${sim.id}/apps`, 'POST', { app, install: true })
  return { token, user, sim }
}

/** The game opened on Awa's phone, her table's banner tapped (« Reprendre »). */
async function sitDown(b, a) {
  const { ctx, page } = await phone(b, [
    [
      ([token, user]) => {
        localStorage.setItem('ivoire-life-session', JSON.stringify({ state: { token, user }, version: 0 }))
        localStorage.setItem('babi-testeur', '1')
        localStorage.setItem('babi.firstSteps', 'done')
        localStorage.setItem('babi.view', 'haut')
        localStorage.setItem('babi.pushAsked', String(Date.now()))
      },
      [a.token, a.user],
    ],
  ])
  await page.goto(`${GAME}/jeu?hour=10`)
  await warm(page, 400)
  await page.getByRole('button', { name: 'Reprendre' }).first().click()
  for (let i = 0; i < 20; i++) (await tick(page), await sleep(60))
  return { ctx, page }
}

/** Takes the table, doing each thing at its frame. */
async function take(page, dir, at) {
  for (let i = 0; i < TAKE; i++) {
    if (at[i]) await at[i]()
    await tick(page)
    await shoot(page, dir, i)
  }
}

/** Les dames: Awa's pawn takes three in one go (backward too, as the rules allow), Tonton Brou answers. */
async function dames(b, dir) {
  const a = await awa('dames')
  await call(a.token, `/sims/${a.sim.id}/dames`, 'POST', { with: 'npc', npc: 'Tonton Brou', stake: 2000 })
  const g = (await call(a.token, `/sims/${a.sim.id}/dames`)).game
  // The squares (0–49, as game/dames.go numbers them): the white pawn on 36 takes 31, 22 and 23 to land on 29.
  const board = Array(50).fill('.')
  for (const i of [36, 34, 38, 40, 42, 47, 49]) board[i] = 'w'
  for (const i of [31, 22, 23, 2, 4, 5, 6, 7, 9, 10, 13, 16]) board[i] = 'b'
  psql(`UPDATE dames SET board = '${board.join('')}', turn = 1, last = '' WHERE id = ${g.id}`)
  const legal = (await call(a.token, `/sims/${a.sim.id}/dames`)).game.legal
  console.log('dames: legal', JSON.stringify(legal))
  const { ctx, page } = await sitDown(b, a)
  await take(page, dir, {
    15: () => page.getByRole('button', { name: 'case 37', exact: true }).click(),
    33: () => page.getByRole('button', { name: 'case 30', exact: true }).click(),
  })
  await ctx.close()
}

/** 8 américain: Awa's 9 of hearts, Tantie Bintou's joker (+6), Awa draws her six. */
async function huit(b, dir) {
  const a = await awa('huit')
  await call(a.token, `/sims/${a.sim.id}/huit`, 'POST', { with: 'npc', npcs: ['Tantie Bintou'], stake: 1000 })
  const g = (await call(a.token, `/sims/${a.sim.id}/huit`)).game
  // The cards (0–51 suit × 13 + value − 1, 52–53 the jokers): 5♥ down; Awa's 9♥ goes; Tantie Bintou's joker is all she can play.
  const mine = [34, 41, 5, 25, 42, 11, 19]
  const hers = [52, 1, 3, 44, 12]
  const pile = [30]
  const used = new Set([...mine, ...hers, ...pile])
  const deck = [...Array(54).keys()].filter((c) => !used.has(c))
  for (let i = deck.length - 1; i > 0; i--) {
    const j = (i * 7919 + 13) % (i + 1)
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  const state = { deck, pile, hands: [mine, hers], turn: 0, dir: 1, suit: -1, owed: 0, by: 0, ace: false, drawn: -1, winner: -1, steps: [] }
  psql(`UPDATE huit SET state = '${JSON.stringify(state)}' WHERE id = ${g.id}`)
  const { ctx, page } = await sitDown(b, a)
  await take(page, dir, {
    15: () => page.getByRole('button', { name: 'le 9 de cœur' }).click(),
    88: () => page.getByRole('button', { name: /^Piocher 6/ }).last().click(),
  })
  await ctx.close()
}

/* ---------- The overlay, the hook, putting it together ---------- */

async function overlay(b, dir) {
  const qr = await QRCode.toDataURL(`${URL}?src=video-top20`, { margin: 1, width: 440, color: { dark: '#111111', light: '#ffffff' } })
  const page = await b.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 })
  // The times measured on the voice: when the hook, each activity and the end card start, then the end.
  const times = [0, ...SLOTS.map((x) => x.from), OUTRO, LENGTH].join(',')
  await page.goto(`${LAB}/poster.html?video=top20&overlay&times=${times}`, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => !!window.__frame)
  await page.evaluate(([qr, url]) => window.__setOutro(qr, url, false), [qr, SHORT])
  const total = Math.round(LENGTH * FPS)
  for (let i = 0; i < total; i++) {
    await page.evaluate((s) => window.__frame(s), i / FPS)
    await page.screenshot({ path: path.join(dir, `${String(i).padStart(5, '0')}.png`), omitBackground: true })
  }
  await page.close()
}

// The lab's dev server (the poster and the city labs).
const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: path.join(HERE, '../web'), stdio: 'ignore' })
process.on('exit', () => vite.kill())
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(`${LAB}/poster.html`)).ok) break
  } catch {}
  await sleep(500)
}

const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost,192.0.2.2' } : undefined
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || ['/opt/pw-browsers/chromium', '/usr/bin/chromium', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p)), proxy, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const started = Date.now()
for (const clip of CLIPS) {
  if (ONLY && !ONLY.includes(clip.id)) continue
  const dir = path.join(FRAMES, clip.id)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  if (clip.scene) await scene(b, clip, dir)
  else if (clip.match) await match(b, clip, dir)
  else if (clip.zoom) await place(b, clip, dir)
  else if (clip.lab) await lab(b, clip, dir)
  else await clip.game(b, dir)
  console.log(`${clip.id}: ${fs.readdirSync(dir).length} frames (${Math.round((Date.now() - started) / 1000)} s)`)
}
if (!ONLY || ONLY.includes('overlay')) {
  const dir = path.join(FRAMES, 'overlay')
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  await overlay(b, dir)
  console.log(`overlay: ${fs.readdirSync(dir).length} frames`)
}
await b.close()
vite.kill()
const missing = [...CLIPS.map((c) => c.id), 'overlay'].filter((id) => !fs.existsSync(path.join(FRAMES, id)) || !fs.readdirSync(path.join(FRAMES, id)).length)
if (missing.length || !voiced) {
  console.log('not put together yet, still to film:', missing.join(', '))
  process.exit(0)
}

// Put together (compose.py: the hook, the swipes, the overlay), then the sound.
// The matches: their slot starts so the basket or the goal lands PAYOFF before its end.
const payoff = (id) => JSON.parse(fs.readFileSync(path.join(FRAMES, id, 'meta.json'), 'utf8')).payoff
for (const x of SLOTS) if (CLIPS.find((c) => c.id === x.clip).match) x.start = Math.max(0, payoff(x.clip) - Math.round((x.to - x.from + SWIPE - PAYOFF) * FPS))
const plan = {
  fps: FPS,
  length: LENGTH,
  outro: OUTRO,
  swipe: SWIPE,
  frames: FRAMES,
  slots: SLOTS,
  // The hook: four flashes of what's coming (the ski, the joker, the basket, the goal).
  teaser: [
    ['ski', 60],
    ['huit', 46],
    ['basket', payoff('basket') - 12],
    ['foot', payoff('foot') - 10],
  ],
  // When the basket and the goal land, for the beat's hits and the crowd.
  payoffs: ['basket', 'foot'].map((id) => +(SLOTS.find((x) => x.clip === id).to - PAYOFF).toFixed(3)),
  out: path.join(FRAMES, 'final'),
}
fs.writeFileSync(path.join(FRAMES, 'plan.json'), JSON.stringify(plan, null, 2))
for (const x of SLOTS) if (x.start + frames(x) > fs.readdirSync(path.join(FRAMES, x.clip)).filter((f) => f.endsWith('.jpg')).length) console.log(`${x.clip}: its take is short of its slot, its last frame held`)
fs.rmSync(plan.out, { recursive: true, force: true })
execFileSync('python3', [path.join(HERE, 'compose.py'), path.join(FRAMES, 'plan.json')], { stdio: 'inherit' })
execFileSync('python3', [path.join(HERE, 'beat.py')], { stdio: 'inherit', env: { ...process.env, FILM: 'top20', TIMES: path.join(FRAMES, 'plan.json') } })

// Awa's voice: each line at its slot (the hook's at once, the end card's just after it comes up).
const lines = [['hook', 0.15], ...SLOTS.map((x) => [CLIPS.find((c) => c.id === x.clip).voice ?? x.clip, x.from + 0.08]), ['outro', OUTRO + 0.3]]
const voice = path.join(OUT, 'voix-top20.mp3')
execFileSync('ffmpeg', [
  '-y', '-loglevel', 'error',
  ...lines.flatMap(([id]) => ['-i', path.join(VOICE, `${id}.wav`)]),
  '-filter_complex',
  lines.map(([, t], i) => `[${i}:a]aresample=44100,adelay=${Math.round(t * 1000)}:all=1[l${i}]`).join(';') + ';' + lines.map((_, i) => `[l${i}]`).join('') + `amix=inputs=${lines.length}:normalize=0,apad=whole_dur=${LENGTH}[a]`,
  '-map', '[a]', '-t', String(LENGTH), '-b:a', '160k', voice,
])
// The beat under it, ducked while she speaks.
const beat = path.join(OUT, 'son-top20.mp3')
const mp4 = path.join(OUT, 'babi-life-video-top20-1080x1920.mp4')
const sound = ['-i', voice, '-i', beat, '-filter_complex', '[1:a]asplit[v][k];[2:a]volume=0.55[b];[b][k]sidechaincompress=threshold=0.03:ratio=8:attack=15:release=350[d];[v][d]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95[a]', '-map', '0:v', '-map', '[a]']
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(plan.out, '%05d.jpg'), ...sound, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'slow', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', mp4])
fs.copyFileSync(path.join(plan.out, `${String(Math.round((LENGTH - 1.2) * FPS)).padStart(5, '0')}.jpg`), path.join(OUT, 'babi-life-video-top20-cover.jpg'))
console.log('video →', mp4, `(${Math.round((Date.now() - started) / 1000)} s)`)
