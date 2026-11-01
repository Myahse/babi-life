// « Babi Sport » (about 45 s, 1080 × 1920, 30 images a second, no voices): the foot and the basket in
// every version the game has, filmed in its labs played by its AI on both sides (clock.mjs stops the
// page's clock: each frame moved on by hand, then taken). A first pass plays each match fast and notes
// its moments (the game's own: dunks, three-pointers, goals, saves, gestes, with their match time); the
// second plays the same match again (same seed: the same match) and films a few seconds round the best
// ones. The titles, the stickers and the end card drawn over (foot-overlay.html), the gameplay beat under.
//
//   node sports.mjs              # scans, films, puts it together
//   ONLY=basketrue,fifa11 node sports.mjs   # films those again (the others' takes kept)

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
const PORT = 5249
const LAB = `http://127.0.0.1:${PORT}`
const FRAMES = path.join(OUT, 'video-frames', 'sports')
const SITE = 'https://lifeinbabi.com'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* ---------- The versions, in the film's order ---------- */

// Each: its lab, the moments it's shown with (the kinds wanted, best first), how many, how long each take
// is (seconds before the moment, after), its chip and its colour.
const VERSIONS = [
  { id: 'basketrue', lab: 'view=basketrue&seed=4&length=240', sport: 'basket', want: ['dunk', 'three', 'block', 'ankle'], takes: 2, pre: 1.8, post: 1.2, chip: 'BASKET DE RUE · 3 contre 3', color: '#ff7a00' },
  { id: 'hoops', lab: 'view=hoops&seed=5', sport: 'basket', want: ['dunk', 'three', 'block', 'steal'], takes: 2, pre: 1.8, post: 1.2, chip: 'BASKET · le grand terrain', color: '#ff7a00' },
  { id: 'footrue', lab: 'view=footrue&seed=7&length=240', sport: 'foot', want: ['gbe', 'ankle', 'goal', 'geste'], takes: 2, pre: 1.6, post: 1.4, chip: 'FOOT DE RUE · le maracana', color: '#00b86b' },
  { id: 'foot5', lab: 'view=foot5&seed=6', sport: 'foot', want: ['goal', 'save', 'post', 'ankle'], takes: 1, pre: 2.2, post: 1.4, chip: 'FOOT À 5', color: '#00b86b' },
  { id: 'fifa5', lab: 'view=fifa5&seed=8&length=240', sport: 'foot', want: ['goal', 'save', 'card', 'post'], takes: 1, pre: 2.2, post: 1.4, chip: 'FOOT À 5 · au stade, avec l’arbitre', color: '#00b86b' },
  { id: 'fifa11', lab: 'view=fifa11&seed=9&length=300', sport: 'foot', want: ['goal', 'save', 'card', 'post'], takes: 2, pre: 2.4, post: 1.4, chip: 'LE GRAND STADE · 11 contre 11', color: '#00b86b' },
]
const LABEL = { dunk: 'DUNK !', three: 'À TROIS POINTS !', block: 'CONTRE !', ankle: 'CHEVILLES CASSÉES', steal: 'INTERCEPTION', goal: 'BUUUT !', gbe: 'GBÊÊÊ !!!', save: 'QUEL ARRÊT !', card: 'CARTON !', post: 'LE POTEAU !', geste: 'LE GESTE !', tackle: 'TACLE !' }
const SCAN_SECS = 150
const INTRO = 2.2
const OUTRO_SECS = 4.2

/* ---------- Filming ---------- */

async function phone(b) {
  const ctx = await b.newContext({ viewport: { width: 405, height: 720 }, deviceScaleFactor: 1080 / 405, locale: 'fr-FR' })
  await ctx.addInitScript(STOPPED_CLOCK)
  // (The match's pad and its keys' help hidden: the film shows the game, the score and its words.)
  await ctx.addInitScript(() =>
    document.addEventListener('DOMContentLoaded', () => {
      const st = document.createElement('style')
      st.textContent = 'div.pointer-events-none.absolute.inset-x-0.bottom-0.flex.items-end.justify-between{display:none!important}'
      document.head.appendChild(st)
    }),
  )
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.error('page:', String(e).slice(0, 200)))
  return { ctx, page }
}

/** One step of the match: the clock moved on n frames, both sides played by the AI; its time, phase and moments. */
const STEP = `async (n) => {
  for (let k = 0; k < n; k++) {
    window.__advance(1000 / 30)
    const g = globalThis.streetMatch
    if (g) { g.switching = false; for (const p of g.ps) p.human = false }
  }
  const g = globalThis.streetMatch
  return g ? { t: g.time, phase: g.phase, moments: g.moments.map((m) => ({ kind: m.kind, t: m.t, team: m.team })) } : null
}`

/** The match played fast: every moment it has, with its match time. */
async function scan(b, v) {
  const { ctx, page } = await phone(b)
  await page.goto(`${LAB}/city.html?${v.lab}`)
  await sleep(4000)
  const seen = new Map()
  const step = await page.evaluateHandle(`(${STEP})`)
  for (let f = 0; f < SCAN_SECS * FPS * 3; f += 15) {
    const s = await step.evaluate((fn, n) => fn(n), 15)
    if (!s) continue
    for (const m of s.moments) seen.set(`${m.kind}@${m.t.toFixed(2)}`, m)
    if (s.t > SCAN_SECS || s.phase === 'over') break
  }
  await ctx.close()
  const all = [...seen.values()].sort((a, b) => a.t - b.t)
  console.log(v.id, all.map((m) => `${m.kind}:${m.t.toFixed(1)}`).join(' '))
  return all
}

/** The moments shown: the kinds wanted, best first, apart from each other, not in the first seconds. */
function pick(v, all) {
  const out = []
  for (const kind of v.want)
    for (const m of all)
      if (m.kind === kind && m.t > v.pre + 1 && out.every((o) => Math.abs(o.t - m.t) > 6) && out.length < v.takes) out.push(m)
  // Nothing of what was wanted: any moment at all.
  for (const m of all) if (out.length < v.takes && m.t > v.pre + 1 && out.every((o) => Math.abs(o.t - m.t) > 6)) out.push(m)
  return out.sort((a, b) => a.t - b.t)
}

/** The same match again, filmed round its moments (each into its own folder). */
async function film(b, v, moments) {
  const windows = moments.map((m, i) => ({ clip: `${v.id}-${i}`, from: m.t - v.pre, to: m.t + v.post, kind: m.kind }))
  const { ctx, page } = await phone(b)
  await page.goto(`${LAB}/city.html?${v.lab}`)
  await sleep(4000)
  const step = await page.evaluateHandle(`(${STEP})`)
  const count = Object.fromEntries(windows.map((w) => [w.clip, 0]))
  for (const w of windows) {
    fs.rmSync(path.join(FRAMES, w.clip), { recursive: true, force: true })
    fs.mkdirSync(path.join(FRAMES, w.clip), { recursive: true })
  }
  const end = Math.max(...windows.map((w) => w.to))
  for (let f = 0; f < (end + 20) * FPS * 3; f++) {
    // Far from a window: faster, a few frames a step.
    const near = (t) => windows.some((w) => t >= w.from - 0.6 && t < w.to)
    const s = await step.evaluate((fn, n) => fn(n), 1)
    if (!s) continue
    if (s.t > end || s.phase === 'over') break
    if (!near(s.t)) {
      await step.evaluate((fn, n) => fn(n), 8)
      continue
    }
    for (const w of windows)
      if (s.t >= w.from && s.t < w.to) {
        const i = count[w.clip]++
        await page.screenshot({ path: path.join(FRAMES, w.clip, `${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 90 })
      }
  }
  await ctx.close()
  console.log(v.id, Object.entries(count).map(([k, n]) => `${k}:${n}`).join(' '))
  return windows.map((w) => ({ ...w, frames: count[w.clip] }))
}

async function overlay(b, dir, plan, length) {
  const qr = await QRCode.toDataURL(`${SITE}/?src=video-sport`, { margin: 1, width: 440, color: { dark: '#111111', light: '#ffffff' } })
  const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(OUT, 'logos', 'babi-life-logo-on-dark.png')).toString('base64')
  const page = await b.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 })
  await page.goto(pathToFileURL(path.join(HERE, 'foot-overlay.html')).href)
  await page.evaluate(() => window.__ready)
  await page.evaluate(([plan, qr, logo]) => window.__setPlan(plan, qr, logo), [plan, qr, logo])
  await sleep(400)
  for (let i = 0; i < Math.round(length * FPS); i++) {
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
fs.mkdirSync(FRAMES, { recursive: true })
const TAKES = path.join(FRAMES, 'takes.json')
const takes = fs.existsSync(TAKES) ? JSON.parse(fs.readFileSync(TAKES, 'utf8')) : {}
for (const v of VERSIONS) {
  if (ONLY && !ONLY.includes(v.id) && takes[v.id]) continue
  const all = await scan(b, v)
  const moments = pick(v, all)
  if (!moments.length) {
    console.log(v.id, 'no moment found, left out')
    continue
  }
  takes[v.id] = await film(b, v, moments)
  fs.writeFileSync(TAKES, JSON.stringify(takes, null, 2))
}

// The cut: the title over the first take, each version's takes one after the other under its chip, the end card.
const slots = []
const chips = []
const shouts = []
const stickers = []
let t = 0
for (const v of VERSIONS) {
  const ws = takes[v.id]
  if (!ws?.length) continue
  const t0 = t
  for (const w of ws) {
    const secs = Math.min(w.frames / FPS, v.pre + v.post)
    if (secs < 0.8) continue
    slots.push({ clip: w.clip, from: t, to: t + secs, start: 0 })
    shouts.push({ from: t + v.pre - 0.1, to: Math.min(t + secs, t + v.pre + 1.2), text: LABEL[w.kind] ?? '' })
    t += secs
  }
  chips.push({ from: t0, to: t, text: v.chip, color: v.color })
}
const outro = t
const length = t + OUTRO_SECS
// The end card over the last frame of the last take.
slots.push({ clip: slots[slots.length - 1].clip, from: t, to: length, start: 10_000 })
const plan = {
  outro,
  titles: [{ from: 0.05, to: INTRO, text: 'le foot et le basket, toutes les versions' }],
  chips,
  stickers,
  shouts,
  captions: [],
  site: SITE.replace(/^https?:\/\//, ''),
}
fs.writeFileSync(path.join(FRAMES, 'overlay-plan.json'), JSON.stringify(plan, null, 2))
const odir = path.join(FRAMES, 'overlay')
fs.rmSync(odir, { recursive: true, force: true })
fs.mkdirSync(odir, { recursive: true })
await overlay(b, odir, plan, length)
await b.close()
vite.kill()
console.log(`filmed (${Math.round((Date.now() - started) / 1000)} s), ${length.toFixed(1)} s of film`)

const cut = { fps: FPS, length, frames: FRAMES, slots, out: path.join(FRAMES, 'final') }
fs.writeFileSync(path.join(FRAMES, 'plan.json'), JSON.stringify(cut, null, 2))
fs.rmSync(cut.out, { recursive: true, force: true })
execFileSync('python3', [path.join(HERE, 'jeux_compose.py'), path.join(FRAMES, 'plan.json')], { stdio: 'inherit' })

const mp4 = path.join(OUT, 'babi-life-video-sport-1080x1920.mp4')
const beat = path.join(OUT, 'son-gameplay.mp3')
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(cut.out, '%05d.jpg'), '-stream_loop', '-1', '-i', beat, '-filter_complex', `[1:a]volume=0.9,atrim=0:${length},afade=t=in:d=0.4,afade=t=out:st=${length - 1.8}:d=1.8[a]`, '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '19', '-preset', 'medium', '-c:a', 'aac', '-b:a', '192k', '-t', String(length), '-movflags', '+faststart', mp4])
fs.copyFileSync(path.join(cut.out, `${String(Math.round(Math.min(slots[1]?.from ?? 1, length - 1) * FPS) + 20).padStart(5, '0')}.jpg`), path.join(OUT, 'babi-life-video-sport-cover.jpg'))
console.log('video →', mp4)
