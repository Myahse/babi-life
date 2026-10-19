// The gameplay video: the real game filmed frame by frame, 1080 × 1920.
//
// The page runs on a virtual clock (its animation frames, timers and dates
// only move when told), so even on a slow machine every frame is a steady
// 1/24 s of the game, and taps happen at the right instant. Some shots are the
// game's own screen (the HUD, the three views, the shower at home, the phone,
// building); others are the game's scenes from its lab (the families at
// birth, the maquis, the zoo, the loto kiosk). Captions go on top.
//
// Needs, running: the API (DEV_LOGIN=true, ADMIN_KEY), the web app's dev
// server with VITE_API_URL pointing at it, and a player for the game shots:
// TOKEN (its session) and SIM (an adult with a house, every app installed).
// The map comes from Mapbox (VITE_MAPBOX_TOKEN); without network, MAP_TILES=
// a module giving fake tiles (tile(z, x, y) → protobuf).
//
//   TOKEN=… SIM=… node gameplay.mjs   → out/babi-life-video-gameplay-1080x1920.mp4

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import QRCode from 'qrcode'
import { HERE, OUT, SHORT, URL, browser, fontFaces } from './shared.mjs'

const FPS = Number(process.env.FPS ?? 24)
const WEB = process.env.WEB ?? 'http://localhost:5173'
const API = process.env.API ?? 'http://localhost:8099/api/v1'
const TOKEN = process.env.TOKEN
if (!TOKEN) throw new Error('TOKEN: the session of the player filmed in the game')
const NAME = 'babi-life-video-gameplay'
const frames = path.join(OUT, 'video-frames', 'gameplay')
fs.rmSync(frames, { recursive: true, force: true })
fs.mkdirSync(frames, { recursive: true })

const qr = await QRCode.toDataURL(`${URL}?src=video-gameplay`, { margin: 1, width: 440, color: { dark: '#161a2b', light: '#ffffff' } })
const user = await (await fetch(`${API}/me`, { headers: { Authorization: `Bearer ${TOKEN}` } })).json()
const tiles = process.env.MAP_TILES ? createRequire(import.meta.url)(path.resolve(process.env.MAP_TILES)) : null

// The shots: where, how long, the caption, and what happens when (seconds into the shot).
const GAME = '/jeu'
const SHOTS = [
  { url: '/city.html?view=family&f=gnambro', s: 3.5, intro: true },
  { url: '/city.html?view=family&f=gnambro', s: 3.5, n: 1, title: 'Tu nais… gnambro', sub: 'La famille est tirée au sort' },
  { url: '/city.html?view=family&f=poignon', s: 3, n: 1, title: '… poignon', sub: 'Appartement, chemise et montre' },
  { url: '/city.html?view=family&f=debout', s: 3, n: 1, title: '… ou debout !', sub: 'Villa, bazin blanc, chaîne en or' },
  { url: GAME, s: 5, view: 'pres', n: 2, title: 'Ta vie à Babi', sub: 'Tes besoins, ton argent, l’heure d’Abidjan' },
  {
    url: GAME, s: 7.5, view: 'pres', n: 3, title: 'Trois vues', sub: 'De près, à l’épaule, de haut',
    at: [[1.6, (p) => p.locator('button[title="Changer de vue"]')], [4.2, (p) => p.locator('button[title="Changer de vue"]')]],
  },
  { url: GAME, s: 5.5, view: 'epaule', n: 4, title: 'Tu marches dans ton quartier', sub: 'Le rond pour marcher, « Courir » pour aller vite', walk: [0.6, 5.2] },
  {
    url: GAME, s: 10, view: 'pres', n: 5, title: 'Chez toi', sub: 'Prendre une douche, dormir, cuisiner…',
    at: [[1, (p) => p.locator('button', { hasText: 'Entrer' }).first()], [2.6, (p) => p.getByText('Prendre une douche').first()]],
    after: (sim) => api(`/sims/${sim}/stop`, {}),
  },
  { url: '/city.html?view=interior&kind=maquis&id=dance-coupe-decale&night', s: 5, n: 6, title: 'Danser avec tes amis', sub: 'Le coupé-décalé au maquis' },
  { url: '/city.html?view=landmark&id=cocody-zoo&cam=18,14,30&look=0,2,0', s: 5.5, n: 7, title: 'Le zoo d’Abidjan', sub: 'Lions, éléphant, hippos, zèbres…' },
  { url: '/city.html?view=stalls&only=loto&cam=0,3,6', s: 5, n: 8, title: 'Le loto du coin', sub: 'Loto Chance : joue tes numéros' },
  {
    url: GAME, s: 7, view: 'haut', top: true, n: 9, title: 'Parier sur le foot', sub: 'Bet225 : les matchs virtuels en direct',
    at: [[0.6, (p) => p.getByText('Phone', { exact: true })], [1.6, (p) => p.getByRole('button', { name: 'Bet225' })]],
  },
  {
    url: GAME, s: 6.5, view: 'haut', top: true, n: 10, title: 'Tikitoko', sub: 'Filme, poste, deviens influenceur',
    at: [[0.6, (p) => p.getByText('Phone', { exact: true })], [1.6, (p) => p.getByRole('button', { name: 'Tikitoko' })], [4.4, (p) => p.mouse.wheel(0, 700)]],
  },
  {
    url: GAME, s: 7.5, view: 'haut', top: true, n: 11, title: 'Construis ta maison', sub: 'Ton terrain en m², tes murs, tes meubles',
    at: [[0.5, (p) => p.getByText('Phone', { exact: true })], [1.3, (p) => p.getByRole('button', { name: 'Logement' })], [2.4, (p) => p.getByRole('button', { name: /Modifier ma maison|Construire et meubler/ })], [5, (p) => p.getByRole('button', { name: 'Meubles' })]],
  },
  { url: '/city.html?view=family&f=debout', s: 6, outro: true },
]

/** Taps a button once it shows (the clock runs meanwhile: the page may be loading it), or just does the action. */
async function tap(p, what) {
  if (!what || typeof what.isVisible !== 'function') return what
  for (let i = 0; i < 150; i++) {
    if (await what.isVisible().catch(() => false)) return what.click({ timeout: 3000 })
    await p.evaluate(() => window.__advance(16))
    await p.waitForTimeout(60)
  }
  throw new Error('not found: ' + what)
}

async function api(route, body) {
  await fetch(`${API}${route}`, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

/** The captions, the intro and the outro: drawn over the page, in the game's fonts. */
function overlayHTML() {
  return `<style>${fontFaces()}
  #gp{position:fixed;inset:0;z-index:2147483647;pointer-events:none;font-family:'Baloo 2',sans-serif;color:#fff}
  #gp .cap{position:absolute;left:0;right:0;top:15%;display:flex;flex-direction:column;align-items:center;gap:10px;padding:0 22px;text-align:center}
  #gp .chip{display:flex;align-items:center;gap:10px;background:#ff7a00;border-radius:999px;padding:4px 20px 4px 6px;font-size:28px;font-weight:800;line-height:1.1;box-shadow:0 10px 30px -10px rgba(0,0,0,.6)}
  #gp .num{display:grid;place-items:center;width:38px;height:38px;border-radius:999px;background:#fff;color:#ff7a00;font-size:21px}
  #gp .sub{background:rgba(15,18,48,.78);border-radius:16px;padding:4px 14px;font:800 17px Nunito,sans-serif}
  #gp .full{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:rgba(15,18,48,.72);text-align:center;padding:0 26px}
  #gp .big{font-size:50px;font-weight:800;line-height:.95}
  #gp .or{color:#ff7a00}
  #gp .card{background:#fff;color:#161a2b;border-radius:26px;padding:16px;display:flex;flex-direction:column;align-items:center;gap:8px}
  #gp .black{position:absolute;inset:0;background:#000}
  #gp .flag{position:absolute;left:0;right:0;bottom:0;height:6px;display:flex}
  #gp .flag i{flex:1}
  </style><div id="gp"><div class="body"></div><div class="black" style="opacity:0"></div><div class="flag"><i style="background:#ff8200"></i><i style="background:#fff"></i><i style="background:#009a44"></i></div></div>`
}
const pin = `<svg width="40" height="54" viewBox="0 0 40 56"><path d="M20 54C14 45 4 36 4 20a16 16 0 0 1 32 0c0 16-10 25-16 34Z" fill="#ff7a00"/><circle cx="20" cy="20" r="7" fill="#fff"/></svg>`
function captionHTML(shot) {
  if (shot.intro) return `<div class="full">${pin}<div class="big">Babi Life</div><div class="big or">Le gameplay</div><div class="sub">Ce qui se passe dans le jeu</div></div>`
  if (shot.outro)
    return `<div class="full">${pin}<div class="big">Bientôt sur<br>ton téléphone</div><div class="card"><div style="font-size:22px;font-weight:800">Inscris-toi sur la liste</div><img src="${qr}" style="width:170px;height:170px;image-rendering:pixelated"><div style="font:800 18px Nunito,sans-serif;color:#ff7a00">${SHORT}</div></div><div class="sub">Gratuit · 100 % ivoirien</div></div>`
  return `<div class="cap" style="${shot.top ? 'top:1.2%' : ''}"><div class="chip"><span class="num">${shot.n}</span>${shot.title}</div><div class="sub">${shot.sub}</div></div>`
}

const b = await browser()
const ctx = await b.newContext({ viewport: { width: 432, height: 768 }, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true })
if (tiles)
  await ctx.route('**/api.mapbox.com/v4/**', (route) => {
    const m = route.request().url().match(/\/(\d+)\/(\d+)\/(\d+)\.vector\.pbf/)
    return route.fulfill({ status: 200, contentType: 'application/x-protobuf', body: tiles(+m[1], +m[2], +m[3]) })
  })
await ctx.addInitScript({ path: path.join(HERE, 'vclock.js') })
await ctx.addInitScript(
  ([token, u]) => {
    localStorage.setItem('ivoire-life-session', JSON.stringify({ state: { token, user: u }, version: 0 }))
    localStorage.setItem('babi-testeur', '1')
    localStorage.setItem('babi.firstSteps', 'done')
  },
  [TOKEN, user],
)

let frame = 0
const started = Date.now()
// ONLY=8,14: just those shots (to check them quickly).
const ONLY = process.env.ONLY?.split(',').map(Number)
for (const [k, shot] of SHOTS.entries()) {
  if (ONLY && !ONLY.includes(k + 1)) continue
  const p = await ctx.newPage()
  p.on('pageerror', (e) => console.error('page:', String(e)))
  if (shot.view) await p.addInitScript((v) => localStorage.setItem('babi.view', v), shot.view)
  await p.goto(WEB + shot.url)
  // Let it load: virtual time goes on while the real network answers.
  for (let i = 0; i < (shot.url === GAME ? 90 : 30); i++) {
    await p.evaluate(() => window.__advance(100))
    await p.waitForTimeout(shot.url === GAME ? 110 : 60)
  }
  await p.evaluate((html) => document.body.insertAdjacentHTML('beforeend', html), overlayHTML())
  await p.evaluate((html) => (document.querySelector('#gp .body').innerHTML = html), captionHTML(shot))
  const total = Math.round(shot.s * FPS)
  const todo = [...(shot.at ?? [])]
  let walking = false
  for (let i = 0; i < total; i++) {
    const t = i / FPS
    while (todo.length && todo[0][0] <= t) {
      const [, act] = todo.shift()
      await tap(p, act(p)).catch((e) => console.error(`shot ${k}:`, e.message))
    }
    // Walking: the finger on the pad, pushed up.
    if (shot.walk) {
      const pad = await p.locator('[aria-label="Déplacer le perso"]').boundingBox()
      if (pad && !walking && t >= shot.walk[0]) {
        walking = true
        await p.mouse.move(pad.x + pad.width / 2, pad.y + pad.height / 2)
        await p.mouse.down()
        await p.mouse.move(pad.x + pad.width / 2 + 10, pad.y + 4, { steps: 4 })
      } else if (walking && t >= shot.walk[1]) {
        walking = false
        await p.mouse.up()
      }
    }
    // Cuts: a few frames from black at the start of each shot.
    await p.evaluate((o) => (document.querySelector('#gp .black').style.opacity = String(o)), k === 0 ? Math.max(0, 1 - i / 8) : Math.max(0, 1 - i / 4))
    // In the game the caption leaves after 3 s, for the play to show.
    if (shot.url === GAME && !shot.top) await p.evaluate((o) => (document.querySelector('#gp .body').style.opacity = String(o)), Math.max(0, Math.min(1, (3.6 - t) / 0.5)))
    await p.evaluate(() => window.__advance(1000 / 24))
    await p.waitForTimeout(shot.url === GAME ? 25 : 8)
    await p.screenshot({ path: path.join(frames, `${String(frame++).padStart(5, '0')}.png`) })
  }
  if (walking) await p.mouse.up()
  await p.close()
  if (shot.after) await shot.after(process.env.SIM)
  console.log(`shot ${k + 1}/${SHOTS.length} · ${frame} frames (${Math.round((Date.now() - started) / 1000)} s)`)
}
await b.close()

const mp4 = path.join(OUT, `${NAME}-1080x1920.mp4`)
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(frames, '%05d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'slow', '-movflags', '+faststart', mp4])
fs.copyFileSync(path.join(frames, `${String(frame - 12).padStart(5, '0')}.png`), path.join(OUT, `${NAME}-cover.png`))
fs.rmSync(frames, { recursive: true, force: true })
console.log('video →', mp4)
