// « Babi Foot » (about 38 s, 1080 × 1920, 30 images a second, no voices): the maracana and the grand
// stade, filmed in the game's labs played by its AI on both sides (clock.mjs stops the page's clock: each
// frame moved on by hand, then taken), cut on the moments a first run found (scan: the game's own words,
// « PETIT PONT ! », « BUUUT », « Carton jaune »… with their match time), the menus (Babi Foot, the Cup,
// the career, the transfers) shown as stills, the stickers and the end card drawn over (foot-overlay.html),
// the gameplay beat under it all.
//
//   node foot.mjs            # films everything, puts it together
//   ONLY=rue,stade node foot.mjs

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
const PORT = 5248
const LAB = `http://127.0.0.1:${PORT}`
const FRAMES = path.join(OUT, 'video-frames', 'foot')
const SITE = 'https://lifeinbabi.com'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* ---------- The cut ---------- */

const LENGTH = 38
// Windows of match time to film (seconds of the AI's match, found by the scan), and where they go in the film.
const RUE = 'view=footrue&seed=7'
const STADE = 'view=fifa11&seed=9'
const SHOTS = JSON.parse(fs.readFileSync(path.join(HERE, 'foot-shots.json'), 'utf8'))
// The menus, as stills (taken in the game while it was made: its own screens), each slowly zoomed.
const STILLS = SHOTS.stills
const OUTRO = SHOTS.outro
const PLAN = { outro: OUTRO, titles: SHOTS.titles, chips: SHOTS.chips, stickers: SHOTS.stickers, shouts: SHOTS.shouts, captions: SHOTS.captions, site: SITE.replace(/^https?:\/\//, '') }

/* ---------- Filming ---------- */

async function phone(b) {
  // (A phone's screen without its touch pad: no stick and buttons over the match in the film.)
  const ctx = await b.newContext({ viewport: { width: 405, height: 720 }, deviceScaleFactor: 1080 / 405, locale: 'fr-FR' })
  await ctx.addInitScript(STOPPED_CLOCK)
  // The match's pad and its keys' help hidden: the film shows the game, the score and its words.
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

/** One AI match, taken in its windows of match time (each into its own folder), in one run. */
async function film(b, lab, windows) {
  const { ctx, page } = await phone(b)
  await page.goto(`${LAB}/city.html?${lab}`)
  await sleep(4000)
  const end = Math.max(...windows.map((w) => w.to))
  const count = Object.fromEntries(windows.map((w) => [w.clip, 0]))
  for (const w of windows) {
    fs.rmSync(path.join(FRAMES, w.clip), { recursive: true, force: true })
    fs.mkdirSync(path.join(FRAMES, w.clip), { recursive: true })
  }
  for (let f = 0; ; f++) {
    const s = await page.evaluate(() => {
      window.__advance(1000 / 30)
      const g = globalThis.streetMatch
      if (!g) return null
      g.switching = false
      for (const p of g.ps) p.human = false
      return { t: g.time, phase: g.phase }
    })
    if (f % 90 === 0) await sleep(20)
    if (!s) continue
    if (s.t > end || s.phase === 'over') break
    for (const w of windows)
      if (s.t >= w.from && s.t < w.to) {
        const i = count[w.clip]++
        await page.screenshot({ path: path.join(FRAMES, w.clip, `${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 90 })
      }
  }
  await ctx.close()
  console.log(lab, Object.entries(count).map(([k, n]) => `${k}:${n}`).join(' '))
}

/**
 * The maracana, staged: the AI plays, and each time Awa's side has the ball with a man in front, the next
 * move of the list is done (the game's own geste(): its words come up, « La roulette ! », « PETIT PONT ! »…),
 * then the Gbê (the gauge full, a shot); each taken for its seconds into its own folder.
 */
async function stage(b, lab, moves) {
  const { ctx, page } = await phone(b)
  await page.goto(`${LAB}/city.html?${lab}`)
  await sleep(4000)
  // (A move already taken in full by an earlier run is kept; the others start empty.)
  const have = (m) => fs.existsSync(path.join(FRAMES, m.clip)) && fs.readdirSync(path.join(FRAMES, m.clip)).length >= Math.round(m.secs * FPS)
  moves = moves.filter((m) => !have(m))
  for (const m of moves) {
    fs.rmSync(path.join(FRAMES, m.clip), { recursive: true, force: true })
    fs.mkdirSync(path.join(FRAMES, m.clip), { recursive: true })
  }
  let i = 0
  let taking = -1
  let since = 0
  for (let f = 0; f < 400 * FPS && i < moves.length; f++) {
    const m = moves[i]
    // A move the AI never gives the chance of in 40 s of play: left out.
    if (taking < 0 && f - since > 40 * FPS) {
      console.log(m.clip, 'never came, skipped')
      i++
      since = f
      continue
    }
    const fired = await page.evaluate(async ([kind, after, busy]) => {
      window.__advance(1000 / 30)
      const g = globalThis.streetMatch
      if (!g) return false
      g.switching = false
      for (const p of g.ps) p.human = false
      if (busy || g.time < after || g.set) return false
      const owner = g.ps.find((p) => p.id === g.ball.owner)
      if (!owner || owner.team !== 0 || owner.keeper || owner.act !== 'none') return false
      if (kind === 'wait') return true
      const G = await import('/src/streetball/game.ts')
      if (kind === 'gbe') {
        owner.style = 1
        G.shoot(g, owner, null)
        return true
      }
      const near = g.ps.some((q) => q.team === 1 && !q.keeper && Math.hypot(q.x - owner.x, q.z - owner.z) < 3.2)
      if (!near && kind !== 'jongle') return false
      G.geste(g, owner, kind, null)
      return owner.act !== 'none'
    }, [m.kind, m.after ?? 3, taking >= 0])
    if (f % 90 === 0) await sleep(20)
    if (!fired && taking < 0) continue
    if (taking < 0) taking = 0
    await page.screenshot({ path: path.join(FRAMES, m.clip, `${String(taking).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 90 })
    if (++taking >= Math.round(m.secs * FPS)) {
      taking = -1
      // Someone passing right before the camera (a shirt filling the screen): the move done again later.
      if (blocked(path.join(FRAMES, m.clip))) {
        console.log(m.clip, 'blocked, again')
        fs.rmSync(path.join(FRAMES, m.clip), { recursive: true, force: true })
        fs.mkdirSync(path.join(FRAMES, m.clip), { recursive: true })
        continue
      }
      console.log(m.clip, 'taken')
      i++
      since = f
    }
  }
  await ctx.close()
}

/** A take where more than a fifth of the frames are mostly one flat colour (a shirt against the lens). */
function blocked(dir) {
  const out = execFileSync('python3', ['-c', `
import os, sys
from PIL import Image
d = sys.argv[1]
fs = sorted(f for f in os.listdir(d) if f.endswith('.jpg'))
bad = 0
for f in fs[::3]:
    im = Image.open(os.path.join(d, f)).convert('RGB').resize((54, 96)).crop((0, 30, 54, 90))
    cols = im.getcolors(54 * 60) or []
    top = max(c for c, _ in cols) if cols else 0
    near = sum(c for c, (r, g, b) in cols if abs(r - 0) < 40 and g > 90 and b < 70)
    if near > 0.35 * 54 * 60:
        bad += 1
print(1 if bad > len(fs[::3]) / 5 else 0)
`, dir]).toString().trim()
  return out === '1'
}

/** The tirs au but: a three-second match, level, to its shoot-out; taken from the first kick's run-up. */
async function shootout(b, lab, secs) {
  const { ctx, page } = await phone(b)
  await page.goto(`${LAB}/city.html?${lab}`)
  await sleep(4000)
  const dir = path.join(FRAMES, 'pens')
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  let n = -1
  for (let f = 0; f < 120 * FPS && n < secs * FPS; f++) {
    const on = await page.evaluate(() => {
      window.__advance(1000 / 30)
      const g = globalThis.streetMatch
      if (!g) return false
      g.switching = false
      for (const p of g.ps) p.human = false
      return !!g.shootout
    })
    if (f % 90 === 0) await sleep(20)
    if (on && n < 0) n = 0
    if (n >= 0) await page.screenshot({ path: path.join(dir, `${String(n++).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 90 })
  }
  await ctx.close()
  console.log('pens', n)
}

/** A menu's still, as frames: fitted to the width, a slow zoom in. */
function still(name, src, secs) {
  const dir = path.join(FRAMES, name)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  execFileSync('python3', ['-c', `
import sys
from PIL import Image
src, out, n = sys.argv[1], sys.argv[2], int(sys.argv[3])
im = Image.open(src).convert('RGB')
W, H = 1080, 1920
s = W / im.width
base = im.resize((W, int(im.height * s)), Image.LANCZOS)
for i in range(n):
    z = 1 + 0.06 * i / max(1, n - 1)
    w, h = int(W * z), int(base.height * z)
    f = base.resize((w, h), Image.BILINEAR)
    x = (w - W) // 2
    f = f.crop((x, 0, x + W, H)) if h >= H else f
    canvas = Image.new('RGB', (W, H), (15, 18, 48))
    canvas.paste(f, (0, 0))
    canvas.save(f'{out}/{i:05d}.jpg', quality=90)
`, src, dir, String(Math.round(secs * FPS) + 10)])
}

async function overlay(b, dir) {
  const qr = await QRCode.toDataURL(`${SITE}/?src=video-foot`, { margin: 1, width: 440, color: { dark: '#111111', light: '#ffffff' } })
  const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(OUT, 'logos', 'babi-life-logo-on-dark.png')).toString('base64')
  const page = await b.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 })
  await page.goto(pathToFileURL(path.join(HERE, 'foot-overlay.html')).href)
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
const want = (id) => !ONLY || ONLY.includes(id)
if (want('rue')) await stage(b, RUE, SHOTS.moves)
if (want('stade')) await film(b, STADE, SHOTS.windows.filter((w) => w.match === 'stade'))
if (want('pens')) await shootout(b, SHOTS.pensLab, SHOTS.pensSecs)
if (want('stills')) for (const s of STILLS) still(s.clip, s.src, s.to - s.from)
if (want('overlay')) {
  const dir = path.join(FRAMES, 'overlay')
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  await overlay(b, dir)
}
await b.close()
vite.kill()
console.log(`filmed (${Math.round((Date.now() - started) / 1000)} s)`)

// Put together: each slot from its clip's first frame (jeux_compose.py: the slide at each cut, the overlay over).
const slots = SHOTS.slots.map((s) => ({ ...s, start: s.start ?? 0 }))
const plan = { fps: FPS, length: LENGTH, frames: FRAMES, slots, out: path.join(FRAMES, 'final') }
fs.writeFileSync(path.join(FRAMES, 'plan.json'), JSON.stringify(plan, null, 2))
fs.rmSync(plan.out, { recursive: true, force: true })
execFileSync('python3', [path.join(HERE, 'jeux_compose.py'), path.join(FRAMES, 'plan.json')], { stdio: 'inherit' })

// The sound: the gameplay beat, faded in and out, cut to the film.
const mp4 = path.join(OUT, 'babi-life-video-foot-1080x1920.mp4')
const beat = path.join(OUT, 'son-gameplay.mp3')
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(plan.out, '%05d.jpg'), '-stream_loop', '-1', '-i', beat, '-filter_complex', `[1:a]volume=0.9,atrim=0:${LENGTH},afade=t=in:d=0.4,afade=t=out:st=${LENGTH - 1.8}:d=1.8[a]`, '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '19', '-preset', 'medium', '-c:a', 'aac', '-b:a', '192k', '-t', String(LENGTH), '-movflags', '+faststart', mp4])
fs.copyFileSync(path.join(plan.out, `${String(Math.round(SHOTS.cover * FPS)).padStart(5, '0')}.jpg`), path.join(OUT, 'babi-life-video-foot-cover.jpg'))
console.log('video →', mp4)
