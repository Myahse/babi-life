// « Samedi, c'est paiya ! » (33 s, 1080 × 1920, 30 images a second): Awa and Keke's Saturday night in
// Babi Life, filmed in the game's labs with the stopped clock (clock.mjs), cut on the voice's lines,
// the clock, the labels, the app cards, the captions and the end card drawn over (paiya-overlay.html),
// the voice over the beat. The script: marketing/scripts/samedi-paiya.md; the voice: out/voix-paiya.mp3.
//
//   node paiya.mjs                  # films everything, puts it together
//   ONLY=vip,billets node paiya.mjs # films just those again, the others kept, then puts it together
//
// The takes (web/src/lab): the villa's salon, the dressing (?view=dressingroom), the limousine through
// the night city and the pick-up (?view=nightcity&ride=limo|pickup), the club (the atalaku, the VIP
// bottle, the billets, the podium; &icam holds the camera), the ride home with Gnango (&ride=gnango).

import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import QRCode from 'qrcode'
import { chromium } from 'playwright-core'
import { HERE, OUT } from './shared.mjs'
import { STOPPED_CLOCK } from './clock.mjs'

const FPS = 30
const ONLY = process.env.ONLY?.split(',')
const PORT = 5247
const LAB = `http://127.0.0.1:${PORT}`
const FRAMES = path.join(OUT, 'video-frames', 'paiya')
const VOICE = path.join(OUT, 'voix-paiya.mp3')
const SITE = 'https://lifeinbabi.com'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* ---------- The times, on the voice (line starts from the pauses in out/voix-paiya.mp3) ---------- */

const LENGTH = 33.0
const LINES = [
  { who: 'keke', from: 0.0, to: 3.0, text: 'Awa ! On est samedi, hein ! C’est paiya ce soir !' },
  { who: 'awa', from: 3.06, to: 4.5, text: 'Paiya ! Je vais me préparer.' },
  { who: 'keke', from: 4.68, to: 7.1, text: 'Bazin blanc, la chaîne, les lunettes… Le boss est prêt !' },
  { who: 'keke', from: 7.34, to: 10.85, text: 'Ce soir on sort la limousine. Awa, je passe te chercher !' },
  { who: 'awa', from: 11.03, to: 12.9, text: 'Hum… Monsieur est en limousine ce soir ?' },
  { who: 'atalaku', from: 13.06, to: 15.9, text: 'Awa ! Keke ! Les boss de la nuit sont arrivés !' },
  { who: 'awa', from: 16.16, to: 17.6, text: 'Champagne pour toute la table !' },
  { who: 'keke', from: 17.72, to: 19.7, text: 'Libérez les billets !' },
  { who: 'awa', from: 19.77, to: 20.75, text: 'On dit quoi, Babi ?!' },
  { who: 'awa', from: 20.8, to: 24.75, text: 'On a bu : ce soir, c’est Gnango qui conduit !' },
  { who: 'keke', from: 24.91, to: 28.5, text: 'Ton samedi soir, tu le passes où ?' },
  { who: 'awa', from: 28.67, to: 33.0, text: 'Sur Babi Life ! Viens faire la fête avec nous !' },
]
// Each take's slot in the film; `lead`: seconds of the take let run before its slot starts.
const SLOTS = [
  { clip: 'salon', from: 0, to: 3.06 },
  { clip: 'dressing', from: 3.06, to: 7.2 },
  { clip: 'limo', from: 7.2, to: 10.9 },
  { clip: 'pickup', from: 10.9, to: 13.0 },
  { clip: 'club', from: 13.0, to: 14.6 },
  { clip: 'club2', from: 14.6, to: 16.0 },
  { clip: 'vip', from: 16.0, to: 17.6 },
  { clip: 'billets', from: 17.6, to: 19.7 },
  { clip: 'podium', from: 19.7, to: 20.8 },
  { clip: 'gnango', from: 20.8, to: 24.8 },
  { clip: 'podium', from: 24.8, to: LENGTH, tail: true },
]
const OUTRO = 24.8
const PLAN = {
  outro: OUTRO,
  clock: [
    { from: 0, text: 'SAM 18:00' },
    { from: 7.2, text: 'SAM 21:00' },
    { from: 13.0, text: 'SAM 23:30' },
    { from: 16.0, text: 'DIM 01:00' },
    { from: 20.8, text: 'DIM 04:00' },
  ],
  labels: [
    { from: 3.2, to: 7.1, text: 'Le dressing' },
    { from: 7.4, to: 10.8, text: 'Bolide : ta voiture' },
    { from: 13.1, to: 15.9, text: 'L’atalaku' },
    { from: 16.1, to: 17.6, text: 'Le carré VIP' },
    { from: 17.7, to: 19.7, text: 'Lancer des billets' },
    { from: 20.9, to: 24.7, text: 'Gnango : rentrer en VTC' },
  ],
  // The phone's cards: the Gbairai voice note, the Bolide garage, the Gnango ride on its way.
  cards: [
    { from: 0.15, to: 2.9, app: 'gbairai' },
    { from: 7.5, to: 9.6, app: 'bolide' },
    { from: 21.3, to: 23.0, app: 'gnango' },
  ],
  lines: LINES,
  site: SITE.replace(/^https?:\/\//, ''),
}

/** The frames a take needs: its slots (the tail goes on after the slot before on the same take) and a margin. */
const need = (clip) => {
  const s = SLOTS.filter((x) => x.clip === clip)
  return Math.round(s.reduce((n, x) => n + (x.to - x.from), 0) * FPS) + 20
}

/* ---------- Filming ---------- */

async function phone(b) {
  const ctx = await b.newContext({ viewport: { width: 405, height: 720 }, deviceScaleFactor: 1080 / 405, isMobile: true, hasTouch: true, locale: 'fr-FR' })
  await ctx.addInitScript(() => localStorage.setItem('babi.pushAsked', String(Date.now())))
  await ctx.addInitScript(STOPPED_CLOCK)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.error('page:', String(e).slice(0, 200)))
  return { ctx, page }
}
const tick = (page, n = 1) => page.evaluate((n) => {
  for (let i = 0; i < n; i++) window.__advance(1000 / 30)
}, n)
const shoot = (page, dir, i) => page.screenshot({ path: path.join(dir, `${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 90 })

/** A take: the lab page loaded, `lead` seconds let run (the Sim walks to the action, the car gets going), then filmed. */
async function take(b, dir, clip, query, lead) {
  const { ctx, page } = await phone(b)
  await page.goto(`${LAB}/city.html?${query}`)
  await sleep(5000)
  // The first frame, then a pause for the models and textures to arrive (they load in real time).
  await tick(page)
  await sleep(2500)
  for (let i = 0; i < Math.round(lead * FPS); i++) {
    await tick(page)
    if (i % 20 === 0) await sleep(120)
  }
  for (let i = 0; i < need(clip); i++) {
    await tick(page)
    await shoot(page, dir, i)
  }
  await ctx.close()
}

const CLUB = 'view=interior&kind=club&look=awa-night&with=keke-night&name=Awa&night'
const TAKES = {
  salon: (b, d) => take(b, d, 'salon', 'view=interior&kind=home&housing=villa&look=awa-home&id=watch-tv', 5),
  dressing: (b, d) => take(b, d, 'dressing', 'view=dressingroom&t0=4', 4),
  limo: (b, d) => take(b, d, 'limo', 'view=nightcity&ride=limo&t0=4', 4.4),
  pickup: (b, d) => take(b, d, 'pickup', 'view=nightcity&ride=pickup&t0=4', 5.0),
  club: (b, d) => take(b, d, 'club', `${CLUB}&id=atalaku&icam=3.5,3.4,7&ilook=0.5,1.6,-2.5&idrift=-0.25,0,-0.2`, 6),
  club2: (b, d) => take(b, d, 'club2', `${CLUB}&id=atalaku&icam=-1,2.4,5&ilook=1,1.8,-3&idrift=0.15,0,-0.15`, 7.6),
  vip: (b, d) => take(b, d, 'vip', `${CLUB}&id=champagne-vip`, 6),
  billets: (b, d) => take(b, d, 'billets', `${CLUB}&id=podium&billets&icam=3,2.8,4.6&ilook=-0.6,1.7,-2.1&idrift=-0.1,0,-0.1`, 4.6),
  podium: (b, d) => take(b, d, 'podium', `${CLUB}&id=podium&icam=2.2,2.2,3.6&ilook=-0.6,1.4,-2.1&idrift=0,0,0.06`, 6),
  gnango: (b, d) => take(b, d, 'gnango', 'view=nightcity&ride=gnango&t0=4', 4),
}

async function overlay(b, dir) {
  const qr = await QRCode.toDataURL(`${SITE}/?src=video-paiya`, { margin: 1, width: 440, color: { dark: '#111111', light: '#ffffff' } })
  const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(OUT, 'logos', 'babi-life-logo-on-dark.png')).toString('base64')
  const page = await b.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 })
  await page.goto(pathToFileURL(path.join(HERE, 'paiya-overlay.html')).href)
  await page.evaluate(() => window.__ready)
  await page.evaluate(([plan, qr, logo]) => window.__setPlan(plan, qr, logo), [PLAN, qr, logo])
  await sleep(400)
  for (let i = 0; i < Math.round(LENGTH * FPS); i++) {
    await page.evaluate((s) => window.__frame(s), i / FPS)
    await page.screenshot({ path: path.join(dir, `${String(i).padStart(5, '0')}.png`), omitBackground: true })
  }
  await page.close()
}

const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: path.join(HERE, '../web'), stdio: 'ignore', env: { ...process.env, VITE_MAPBOX_TOKEN: 'pk.fake' } })
process.on('exit', () => vite.kill())
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(`${LAB}/city.html`)).ok) break
  } catch {}
  await sleep(500)
}
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || ['/opt/pw-browsers/chromium', '/usr/bin/chromium'].find((p) => fs.existsSync(p)), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files'] })
const started = Date.now()
for (const id of [...Object.keys(TAKES), 'overlay']) {
  if (ONLY && !ONLY.includes(id)) continue
  const dir = path.join(FRAMES, id)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  try {
    if (id === 'overlay') await overlay(b, dir)
    else await TAKES[id](b, dir)
  } catch (e) {
    console.error(id, 'failed:', String(e).slice(0, 300))
  }
  console.log(`${id}: ${fs.readdirSync(dir).length} frames (${Math.round((Date.now() - started) / 1000)} s)`)
}
await b.close()
vite.kill()

// Put together: each slot from its take's first frame (a tail from where the slot before on that take ended).
const slots = SLOTS.map((s) => {
  if (!s.tail) return { ...s, start: 0 }
  const prev = SLOTS.find((x) => x.clip === s.clip && !x.tail)
  return { ...s, start: Math.round((prev.to - prev.from) * FPS) }
})
const plan = { fps: FPS, length: LENGTH, frames: FRAMES, slots, out: path.join(FRAMES, 'final') }
fs.writeFileSync(path.join(FRAMES, 'plan.json'), JSON.stringify(plan, null, 2))
fs.rmSync(plan.out, { recursive: true, force: true })
execFileSync('python3', [path.join(HERE, 'jeux_compose.py'), path.join(FRAMES, 'plan.json')], { stdio: 'inherit' })

// The sound: the voice, the beat under it ducked while they speak, cut to the film.
const mp4 = path.join(OUT, 'babi-life-video-paiya-1080x1920.mp4')
const beat = path.join(OUT, 'son-gameplay.mp3')
const audio = fs.existsSync(beat)
  ? ['-i', VOICE, '-i', beat, '-filter_complex', `[1:a]asplit[v][k];[2:a]volume=0.4,atrim=0:${LENGTH},afade=t=out:st=${LENGTH - 1.5}:d=1.5[b];[b][k]sidechaincompress=threshold=0.03:ratio=8:attack=15:release=350[d];[v][d]amix=inputs=2:duration=longest:normalize=0,apad=whole_dur=${LENGTH},alimiter=limit=0.95[a]`, '-map', '0:v', '-map', '[a]']
  : ['-i', VOICE, '-map', '0:v', '-map', '1:a']
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(plan.out, '%05d.jpg'), ...audio, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '19', '-preset', 'medium', '-c:a', 'aac', '-b:a', '192k', '-t', String(LENGTH), '-movflags', '+faststart', mp4])
fs.copyFileSync(path.join(plan.out, `${String(Math.round(16.9 * FPS)).padStart(5, '0')}.jpg`), path.join(OUT, 'babi-life-video-paiya-cover.jpg'))
console.log('video →', mp4, `(${Math.round((Date.now() - started) / 1000)} s)`)
