// « Keke contre Awa » (about 40 s, 1080 × 1920, 30 images a second): the new games of Babi Life,
// filmed being played in the game's labs on a machine too slow to play them (clock.mjs stops the
// page's clock: each frame is moved on by hand, then taken), cut on the voice's sentences, the
// captions, the duel's score and the end card drawn over them (jeux-overlay.html), the voice under it.
// The script: marketing/scripts/nouveaux-jeux.md; the voice: out/voix-jeux.mp3.
//
//   node jeux.mjs            # films everything, puts it together
//   ONLY=combat,course node jeux.mjs   # films just those again, the others kept, then puts it together
//
// The takes:
// - the stadium's eleven (city.html?view=fifa11): its players all played by the game's AI, a first run
//   (nothing taken) finding when a goal goes in, the same match again taken round it;
// - the street fight (?view=defi&kind=combat&dummy=1): the player's combos thrown by the keys;
// - the street race (&auto=1, the car driving itself), the kart (globalThis.kartAuto);
// - the basketball and the football of the courts (?view=hoops, ?view=foot5), as the eleven.

import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import QRCode from 'qrcode'
import { chromium } from 'playwright-core'
import { HERE, OUT, SHORT, URL } from './shared.mjs'
import { STOPPED_CLOCK } from './clock.mjs'

const FPS = 30
const ONLY = process.env.ONLY?.split(',')
const PORT = 5246
const LAB = `http://127.0.0.1:${PORT}`
const FRAMES = path.join(OUT, 'video-frames', 'jeux')
const VOICE = path.join(OUT, 'voix-jeux.mp3')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* ---------- The times, on the voice (sentence starts measured on out/voix-jeux.mp3) ---------- */

const LENGTH = 40.4
const LINES = [
  { who: 'keke', from: 0.0, to: 4.0, text: 'Awa ! Toi et moi, à la salle de jeux. Maintenant !' },
  { who: 'awa', from: 4.1, to: 7.0, text: 'Keke… tu vas pleurer, hein.' },
  { who: 'keke', from: 7.1, to: 12.9, text: 'Le foot comme sur les grands jeux : le stade, l’arbitre, les penalties, les cartons…' },
  { who: 'awa', from: 13.05, to: 15.0, text: 'Penalty… Et c’est but !' },
  { who: 'keke', from: 15.1, to: 19.7, text: 'Le combat de rue, en 3D ! Attends, attends… Eh ! Elle m’a mis KO !' },
  { who: 'awa', from: 19.8, to: 24.1, text: 'La course : dérapage, nitro… et je te double sur la ligne !' },
  { who: 'keke', from: 24.2, to: 26.4, text: 'Le kart ! Qui a mis la banane là ?!' },
  { who: 'awa', from: 26.5, to: 30.1, text: 'Et tu peux jouer à la manette… ou avec tes amis, sur les terrains du quartier.' },
  { who: 'keke', from: 30.2, to: 34.3, text: 'Quatre à zéro… Mais mercredi, je prends ma revanche !' },
  { who: 'awa', from: 34.4, to: 37.3, text: 'Babi Life sort mercredi 28 octobre !' },
  { who: 'keke', from: 37.4, to: 40.4, text: 'Inscris-toi sur la liste, et viens nous défier !' },
]
// Each take's slot in the film; `at`: for a match, the film time its goal (or basket) lands on.
const SLOTS = [
  { clip: 'intro', from: 0, to: 7.1 },
  { clip: 'stade', from: 7.1, to: 15.1, at: 14.3 },
  { clip: 'combat', from: 15.1, to: 19.8 },
  { clip: 'course', from: 19.8, to: 24.2 },
  { clip: 'kart', from: 24.2, to: 26.5 },
  { clip: 'basket', from: 26.5, to: 30.2, at: 29.2 },
  { clip: 'foot', from: 30.2, to: 34.4, at: 31.2 },
  { clip: 'foot', from: 34.4, to: LENGTH, tail: true },
]
const OUTRO = 34.4
const PLAN = {
  outro: OUTRO,
  titleUntil: 4.0,
  scoreFrom: 7.1,
  // The duel's points: the goal, the KO, the finish line, the banana.
  points: [14.4, 19.0, 23.6, 25.8],
  stickers: [
    { from: 7.2, to: 12.6, nouveau: true, text: 'Le foot au stade, 11 contre 11' },
    { from: 15.2, to: 18.6, nouveau: true, text: 'Le combat de rue en 3D' },
    { from: 19.9, to: 23.2, nouveau: true, text: 'La course à deux' },
    { from: 24.3, to: 26.4, nouveau: false, text: 'Le kart' },
    { from: 26.6, to: 30.1, nouveau: true, text: '🎮 Manette et matchs entre amis' },
  ],
  lines: LINES,
  short: SHORT,
}
const need = (clip) => {
  const s = SLOTS.filter((x) => x.clip === clip)
  return Math.round((Math.max(...s.map((x) => x.to)) - Math.min(...s.map((x) => x.from))) * FPS) + 20
}

/* ---------- Filming ---------- */

async function phone(b, init = []) {
  const ctx = await b.newContext({ viewport: { width: 405, height: 720 }, deviceScaleFactor: 1080 / 405, isMobile: true, hasTouch: true, locale: 'fr-FR' })
  await ctx.addInitScript(() => localStorage.setItem('babi.pushAsked', String(Date.now())))
  for (const [fn, arg] of init) await ctx.addInitScript(fn, arg)
  await ctx.addInitScript(STOPPED_CLOCK)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.error('page:', String(e).slice(0, 200)))
  return { ctx, page }
}
const tick = (page, n = 1) => page.evaluate((n) => {
  for (let i = 0; i < n; i++) window.__advance(1000 / 30)
}, n)
const shoot = (page, dir, i) => page.screenshot({ path: path.join(dir, `${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 90 })
async function warm(page, frames) {
  await sleep(3000)
  for (let i = 0; i < frames; i++) {
    await tick(page)
    if (i % 20 === 0) await sleep(150)
  }
}
/** Tap a button by its text if it's there (the défi's menus), the clock moved on a little after. */
async function tap(page, name) {
  const b = page.getByRole('button', { name }).first()
  if (await b.count()) await b.click({ timeout: 3000, force: true }).catch(() => undefined)
  await tick(page, 8)
}

/**
 * A match played by the game's AI (both sides): a first run finds when the player's side scores, the
 * same match again (the lab's seed, the stopped clock) is taken from `lead` seconds before it.
 */
async function match(b, lab, dir, lead, total) {
  const ai = (page) =>
    page.evaluate(() => {
      const g = globalThis.streetMatch
      if (!g) return null
      g.switching = false
      for (const p of g.ps) p.human = false
      return { time: g.time, score: g.score[0] }
    })
  let { ctx, page } = await phone(b)
  await page.goto(`${LAB}/city.html?${lab}`)
  await sleep(3000)
  let goal = null
  for (let i = 0; i < 240 * FPS && goal === null; i++) {
    await tick(page)
    if (i % 60 === 0) await sleep(20)
    const s = await ai(page)
    if (s && s.time > 6 && s.score > 0) goal = s.time
  }
  await ctx.close()
  if (goal === null) throw new Error(`${lab}: no goal in four minutes`)
  ;({ ctx, page } = await phone(b))
  await page.goto(`${LAB}/city.html?${lab}`)
  await sleep(3000)
  for (let i = 0; ; i++) {
    await tick(page)
    if (i % 60 === 0) await sleep(20)
    const s = await ai(page)
    if (s && s.time >= goal - lead) break
  }
  let scored = null
  for (let i = 0; i < total; i++) {
    await tick(page)
    const s = await ai(page)
    if (scored === null && s?.score > 0) scored = i
    await shoot(page, dir, i)
  }
  await ctx.close()
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ payoff: scored ?? Math.round(lead * FPS) }))
  console.log(`${lab}: goal at ${goal.toFixed(1)} s, frame ${scored}`)
}

const TAKES = {
  // The stadium at the kick-off and just after: the camera on the pitch, the stands full.
  async intro(b, dir) {
    const { ctx, page } = await phone(b)
    await page.goto(`${LAB}/city.html?view=fifa11&seed=3`)
    await warm(page, 4 * FPS)
    for (let i = 0; i < need('intro'); i++) {
      await page.evaluate(() => {
        const g = globalThis.streetMatch
        if (g) for (const p of g.ps) p.human = false
      })
      await tick(page)
      await shoot(page, dir, i)
    }
    await ctx.close()
  },
  stade: (b, dir) => match(b, 'view=fifa11&seed=9', dir, 14.3 - 7.1, need('stade') + 30),
  basket: (b, dir) => match(b, 'view=hoops&seed=7', dir, 29.2 - 26.5, need('basket') + 20),
  foot: (b, dir) => match(b, 'view=foot5&seed=7', dir, 1.0, need('foot') + 20),
  // The fight: in, a three-hit series, again, a sweep, the kick; the other one standing still.
  async combat(b, dir) {
    const { ctx, page } = await phone(b)
    await page.goto(`${LAB}/city.html?view=defi&kind=combat&dummy=1`)
    await warm(page, 60)
    await tap(page, /C'est parti/)
    await tap(page, /Petit Yao/)
    await warm(page, 2.6 * FPS)
    const plan = { 0: ['down', 'ArrowRight'], 14: ['up', 'ArrowRight'] }
    for (let k = 0; k < 9; k++) {
      const at = 20 + k * 13
      plan[at] = ['press', k % 4 === 3 ? 'KeyK' : 'KeyJ']
    }
    for (let i = 0; i < need('combat'); i++) {
      const a = plan[i]
      if (a?.[0] === 'down') await page.keyboard.down(a[1])
      else if (a?.[0] === 'up') await page.keyboard.up(a[1])
      else if (a?.[0] === 'press') await page.keyboard.press(a[1])
      await tick(page)
      await shoot(page, dir, i)
    }
    await ctx.close()
  },
  async course(b, dir) {
    const { ctx, page } = await phone(b)
    await page.goto(`${LAB}/city.html?view=defi&kind=course&auto=1`)
    await warm(page, 60)
    await tap(page, /C'est parti/)
    await tap(page, /Le Taximan/)
    await warm(page, 9 * FPS)
    for (let i = 0; i < need('course'); i++) {
      await tick(page)
      await shoot(page, dir, i)
    }
    await ctx.close()
  },
  async kart(b, dir) {
    const { ctx, page } = await phone(b, [[() => (globalThis.kartAuto = true)]])
    await page.goto(`${LAB}/city.html?view=kart`)
    await warm(page, 11 * FPS)
    for (let i = 0; i < need('kart'); i++) {
      await tick(page)
      await shoot(page, dir, i)
    }
    await ctx.close()
  },
}

async function overlay(b, dir) {
  const qr = await QRCode.toDataURL(`${URL}?src=video-jeux`, { margin: 1, width: 440, color: { dark: '#111111', light: '#ffffff' } })
  const page = await b.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 })
  await page.goto(pathToFileURL(path.join(HERE, 'jeux-overlay.html')).href)
  await page.evaluate(() => window.__ready)
  await page.evaluate(([plan, qr]) => window.__setPlan(plan, qr), [PLAN, qr])
  await sleep(300)
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

// Put together: each slot from its take (a match's from where its goal lands at `at`), the overlay over it.
const slots = SLOTS.map((s) => {
  let start = 0
  const meta = path.join(FRAMES, s.clip, 'meta.json')
  if (s.at !== undefined && fs.existsSync(meta)) start = Math.max(0, JSON.parse(fs.readFileSync(meta, 'utf8')).payoff - Math.round((s.at - s.from) * FPS))
  // The end card's slot goes on from the slot before on the same take.
  if (s.tail) {
    const prev = SLOTS.find((x) => x.clip === s.clip && !x.tail)
    const pm = path.join(FRAMES, s.clip, 'meta.json')
    const p0 = fs.existsSync(pm) ? Math.max(0, JSON.parse(fs.readFileSync(pm, 'utf8')).payoff - Math.round((prev.at - prev.from) * FPS)) : 0
    start = p0 + Math.round((s.from - prev.from) * FPS)
  }
  return { ...s, start }
})
const plan = { fps: FPS, length: LENGTH, frames: FRAMES, slots, out: path.join(FRAMES, 'final') }
fs.writeFileSync(path.join(FRAMES, 'plan.json'), JSON.stringify(plan, null, 2))
fs.rmSync(plan.out, { recursive: true, force: true })
execFileSync('python3', [path.join(HERE, 'jeux_compose.py'), path.join(FRAMES, 'plan.json')], { stdio: 'inherit' })

// The sound: the voice, a beat under it ducked while she speaks (the gameplay film's), cut to the film.
const mp4 = path.join(OUT, 'babi-life-video-jeux-1080x1920.mp4')
const beat = path.join(OUT, 'son-gameplay.mp3')
const audio = fs.existsSync(beat)
  ? ['-i', VOICE, '-i', beat, '-filter_complex', `[1:a]asplit[v][k];[2:a]volume=0.35,atrim=0:${LENGTH},afade=t=out:st=${LENGTH - 1.5}:d=1.5[b];[b][k]sidechaincompress=threshold=0.03:ratio=8:attack=15:release=350[d];[v][d]amix=inputs=2:duration=longest:normalize=0,apad=whole_dur=${LENGTH},alimiter=limit=0.95[a]`, '-map', '0:v', '-map', '[a]']
  : ['-i', VOICE, '-map', '0:v', '-map', '1:a']
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(plan.out, '%05d.jpg'), ...audio, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '19', '-preset', 'medium', '-c:a', 'aac', '-b:a', '192k', '-t', String(LENGTH), '-movflags', '+faststart', mp4])
fs.copyFileSync(path.join(plan.out, `${String(Math.round(10.5 * FPS)).padStart(5, '0')}.jpg`), path.join(OUT, 'babi-life-video-jeux-cover.jpg'))
console.log('video →', mp4, `(${Math.round((Date.now() - started) / 1000)} s)`)
