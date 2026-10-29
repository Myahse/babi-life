// « Ta vie dans Babi Life, de bébé à adulte » (about 75 s, 1080 × 1920, 30 images a second): the real
// game filmed being played, on a machine too slow to play it (clock.mjs stops the page's clock: each
// frame is moved on by hand, then taken). A perso made for each take on a local API: the baptism, the
// baby at home, the biberon picked in « Que faire ? », coucou-caché played, the crèche; then grown (the
// testers' toolbox) to a child at school, a teen with its phone, the Boutique's « grandir tout de
// suite », and the adult in the street of Abidjan. Each take's caption is drawn in the page over the
// game; the end card after; the sound (beat.py, FILM=vie) and Awa's voice (out/voix-vie.mp3) under it.
// The script: marketing/scripts/vie.md; each take as long as Awa's sentences on it (out/voix-vie.mp3, 51 s).
//
//   API=http://localhost:8099/api/v1 GAME=http://localhost:5175 node vie.mjs
//   PROBE=1 node vie.mjs        # a few frames of each take only (out/video-frames/vie/probe-*.jpg)
//   ONLY=coucou,ecole node vie.mjs   # those takes again, the others kept, then put together
//
// API: a local API started with DEV_LOGIN=true, never production (its users are marked testers in
// its database). GAME: the game's dev server built against it (VITE_API_URL).

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import QRCode from 'qrcode'
import { BRAND, OUT, browser, fontFaces } from './shared.mjs'
import { STOPPED_CLOCK } from './clock.mjs'

const FPS = 30
const API = process.env.API ?? 'http://localhost:8099/api/v1'
const GAME = process.env.GAME ?? 'http://localhost:5175'
const DB = process.env.DATABASE_URL ?? 'postgres://postgres:pg@localhost:5432/babi'
const PROBE = !!process.env.PROBE
const ONLY = process.env.ONLY?.split(',')
const FRAMES = path.join(OUT, 'video-frames', 'vie')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* ---------- A perso on the local API ---------- */

async function call(token, p, method = 'GET', body) {
  const r = await fetch(API + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
  const text = await r.text()
  if (!r.ok) throw new Error(`${method} ${p} ${r.status}: ${text.slice(0, 200)}`)
  return text ? JSON.parse(text) : null
}
const psql = (q) => execFileSync('psql', [DB, '-tAc', q]).toString().trim()
const LOOK = { skin: '#6e4024', hair: 'short', hairColor: '#141010', outfit: 'casual', outfitColor: '#ff7a00', body: 'moyen', height: 1, eyes: '#2b1a10', beard: 'none', accessory: 'none', pattern: 'cercles', bottomColor: '', shoeColor: '', accessoryColor: '', marks: 'none', wear: 'neuf' }

/** Koffi, born in Cocody (a poignon family), at the stage asked; baptised unless it's the baptism's take. */
async function koffi({ stage = 'bebe', baptised = true } = {}) {
  const { token } = await call(null, '/auth/dev', 'POST', { name: `Koffi${Date.now().toString(36).slice(-4)}` })
  const me = await call(token, '/me')
  psql(`UPDATE users SET tester = true WHERE id = '${me.id}'`)
  const made = await call(token, '/sims', 'POST', { firstName: 'Koffi', lastName: 'Koné', gender: 'homme', look: LOOK, traits: ['ambianceur', 'sportif'], aspiration: 'ambiance', lat: 5.348, lng: -3.987 })
  const sim = made.sim ?? made
  psql(`UPDATE sims SET family = 'poignon', baptised = ${baptised} WHERE id = '${sim.id}'`)
  if (stage !== 'bebe') await call(token, `/sims/${sim.id}/tester`, 'POST', { action: 'age', stage })
  await call(token, `/sims/${sim.id}/tester`, 'POST', { action: 'needs' })
  const user = await call(token, '/me')
  return { token, user, sim }
}

/* ---------- Filming ---------- */

const seen = async () => ((await call(null, '/features')).new ?? []).map((n) => n.id)

/** The game on a phone's screen (1080 × 1920), the perso's session in it, its clock stopped. */
async function open(b, k, query = '') {
  const ctx = await b.newContext({ viewport: { width: 405, height: 720 }, deviceScaleFactor: PROBE ? 1 : 1080 / 405, isMobile: true, hasTouch: true, locale: 'fr-FR' })
  await ctx.addInitScript(
    ([token, user, seen]) => {
      localStorage.setItem('ivoire-life-session', JSON.stringify({ state: { token, user }, version: 0 }))
      localStorage.setItem('babi-testeur', '1')
      for (const key of ['babi.firstSteps', 'babi.tuto', 'babi.tuto.adulte', 'babi.arrivee']) localStorage.setItem(key, 'done')
      localStorage.setItem('babi.featuresSeen', JSON.stringify(seen))
      localStorage.setItem('babi.pushAsked', String(Date.now()))
    },
    [k.token, k.user, await seen()],
  )
  await ctx.addInitScript(STOPPED_CLOCK)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.error('page:', String(e).slice(0, 200)))
  await page.goto(`${GAME}/jeu?hour=10${query}`)
  return { ctx, page }
}
const tick = (page, n = 1) => page.evaluate((n) => {
  for (let i = 0; i < n; i++) window.__advance(1000 / 30)
}, n)
/** Frames on while the game loads (real time too, for what comes from the network). */
async function warm(page, frames) {
  await sleep(3000)
  for (let i = 0; i < frames; i++) {
    await tick(page)
    if (i % 20 === 0) await sleep(200)
  }
}

/** The take's caption, drawn over the game: the stage of life at the top, what Awa says at the bottom. */
function caption(page, stage, text) {
  return page.evaluate(
    ([stage, text, fonts]) => {
      let el = document.getElementById('vie-cap')
      if (!el) {
        const st = document.createElement('style')
        st.textContent = `${fonts}
#vie-cap{position:fixed;inset:0;z-index:2147483647;pointer-events:none;font-family:'Nunito',sans-serif}
#vie-cap .st{position:absolute;top:96px;left:50%;transform:translateX(-50%);background:#ff7a00;color:#fff;font-family:'Baloo 2';font-weight:800;font-size:22px;padding:4px 18px;border-radius:999px;box-shadow:0 6px 18px -6px rgba(0,0,0,.5);white-space:nowrap}
#vie-cap .tx{position:absolute;left:16px;right:16px;top:142px;background:rgba(15,18,48,.86);color:#fff;font-weight:800;font-size:19px;line-height:1.25;text-align:center;padding:10px 14px;border-radius:18px}`
        document.head.appendChild(st)
        el = document.createElement('div')
        el.id = 'vie-cap'
        document.body.appendChild(el)
      }
      el.innerHTML = `${stage ? `<div class="st">${stage}</div>` : ''}${text ? `<div class="tx">${text}</div>` : ''}`
    },
    [stage, text, fontFaces()],
  )
}

const shoot = (page, dir, i) => page.screenshot({ path: path.join(dir, `${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 })

/** Takes `frames` frames, doing each thing at its frame (and `each` before every frame, for what reacts to the game). */
async function film(page, dir, frames, at = {}, each) {
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  for (let i = 0; i < frames; i++) {
    if (at[i]) await at[i]().catch((e) => console.error(path.basename(dir), i, String(e).slice(0, 160)))
    if (each) await each(i).catch(() => undefined)
    await tick(page)
    if (!PROBE || i % 30 === 0 || i === frames - 1) await shoot(page, dir, i)
  }
}

const click = (page, name) => () => page.getByRole('button', { name }).first().click({ timeout: 4000 })

/* ---------- The takes ---------- */

const BEBE = 'BÉBÉ'
const TAKES = [
  {
    id: 'bapteme',
    seconds: 5.8,
    make: () => koffi({ baptised: false }),
    warm: 160,
    stage: BEBE,
    text: 'Tu viens d’arriver dans Babi Life… et tu es un bébé. Tu te demandes sûrement pourquoi ?',
    at: (p) => ({ 60: click(p, 'Suite'), 125: click(p, 'Suite') }),
  },
  {
    id: 'maison',
    seconds: 6,
    make: () => koffi(),
    warm: 160,
    before: (p) => click(p, /ENTRER/)(),
    stage: BEBE,
    text: 'Ce n’est pas un bug : c’est voulu. Comme dans la vraie vie, tout commence là, et ce que tu vis bébé compte pour la suite.',
  },
  {
    id: 'biberon',
    seconds: 4.44,
    make: () => koffi(),
    warm: 160,
    before: (p) => click(p, /ENTRER/)(),
    stage: BEBE,
    text: 'Il a faim ? Biberon ! Sommeil ? Au berceau. Il pleure ? Un câlin.',
    at: (p) => ({ 6: click(p, /Que faire/), 30: click(p, /Boire le biberon/) }),
  },
  {
    id: 'coucou',
    seconds: 3.6,
    make: async () => {
      const k = await koffi()
      await call(k.token, `/sims/${k.sim.id}/interact`, 'POST', { placeId: 'home', interactionId: 'coucou' })
      return k
    },
    warm: 160,
    stage: BEBE,
    text: 'Il y a des petits jeux : coucou-caché, les cubes, les premiers pas…',
    at: (p) => ({ 5: click(p, /coucou-caché/i), 30: click(p, /C.est parti/) }),
    // Laughing a moment after maman's hands open (« Coucou ! » on the screen).
    each: (p) => {
      let seenAt = -1
      return async (i) => {
        const open = await p.getByText('Coucou !', { exact: true }).count()
        if (!open) return void (seenAt = -1)
        if (seenAt < 0) seenAt = i
        if (i - seenAt === 7) await p.getByRole('button', { name: 'Rire !' }).click({ timeout: 1000 })
      }
    },
  },
  {
    id: 'creche',
    seconds: 2.32,
    make: async () => {
      const k = await koffi()
      await call(k.token, `/sims/${k.sim.id}/interact`, 'POST', { placeId: 'home', interactionId: 'creche' })
      return k
    },
    warm: 200,
    stage: BEBE,
    text: 'La crèche, avec les bébés des autres joueurs.',
  },
  {
    id: 'ecole',
    seconds: 6.84,
    // School is in the morning: the day's activity started as « Jouer dans la cour », then made the school day.
    make: async () => {
      const k = await koffi({ stage: 'enfant' })
      await call(k.token, `/sims/${k.sim.id}/interact`, 'POST', { placeId: 'home', interactionId: 'jouer-cour' })
      psql(`UPDATE sims SET activity = jsonb_set(jsonb_set(jsonb_set(activity, '{interaction,id}', '"aller-ecole"'), '{interaction,label}', '"Aller à l''école"'), '{interaction,icon}', '"school"') WHERE id = '${k.sim.id}'`)
      return k
    },
    warm: 200,
    stage: 'ENFANT · 3 ANS',
    text: 'Deux heures de jeu, et hop : tu as 3 ans ! Enfant, c’est l’école : la classe, la récré, le maître qui pose des questions.',
    at: (p) => ({ 60: click(p, /Lever la main/), 95: click(p, /C.est parti/) }),
  },
  {
    id: 'ado',
    seconds: 3.8,
    make: () => koffi({ stage: 'ado' }),
    warm: 200,
    stage: 'ADO · 12 ANS',
    text: 'Ado, tu as ton premier téléphone : Gbairai pour causer avec tes amis.',
    at: (p) => ({ 8: () => p.locator('[data-tour="phone"]').click({ timeout: 4000 }), 50: click(p, /^Gbairai/) }),
  },
  {
    id: 'boutique',
    seconds: 7.56,
    make: () => koffi(),
    query: '&app=boutique',
    warm: 200,
    stage: 'PRESSÉ·E ?',
    text: 'Tu ne veux pas attendre ? Va dans la Boutique : enfant, ado ou adulte tout de suite. Tu paies une fois, et tu as accès à tout le jeu.',
    at: (p) => ({ 40: () => p.getByText(/tout de suite/).first().scrollIntoViewIfNeeded({ timeout: 4000 }) }),
  },
  {
    id: 'adulte',
    seconds: 5.24,
    make: () => koffi({ stage: 'adulte' }),
    warm: 260,
    stage: 'ADULTE · 18 ANS',
    text: 'Adulte, c’est la vraie vie d’Abidjan : ton boulot, ton argent, tes sorties, ta maison à construire.',
    // Walking up the street, the stick held forward.
    at: (p) => ({ 5: () => p.keyboard.down('ArrowUp'), 150: () => p.keyboard.up('ArrowUp') }),
  },
]

/* ---------- The end card ---------- */

async function endCard(b, dir, frames) {
  const qr = await QRCode.toDataURL('https://lifeinbabi.com/?src=video-vie', { margin: 1, width: 440, color: { dark: BRAND.ink, light: '#ffffff' } })
  const logo = `data:image/svg+xml;base64,${fs.readFileSync(path.join(OUT, 'logos/babi-life-logo-on-dark.svg')).toString('base64')}`
  const page = await b.newPage({ viewport: { width: 405, height: 720 }, deviceScaleFactor: PROBE ? 1 : 1080 / 405 })
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${fontFaces()}
*{margin:0;box-sizing:border-box}body{width:405px;height:720px;overflow:hidden;font-family:'Nunito';color:#fff;background:linear-gradient(180deg,#1d1650,#5b2a86 55%,#ff8a3d);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;text-align:center}
img.l{height:46px}h1{font-family:'Baloo 2';font-weight:800;font-size:40px;line-height:1}h1 em{font-style:normal;color:#ff7a00}
.s{display:flex;gap:6px}.s b{background:rgba(255,255,255,.18);border-radius:999px;padding:4px 10px;font-size:13px}
.c{background:#fff;color:${BRAND.ink};border-radius:24px;padding:16px;display:flex;flex-direction:column;align-items:center;gap:8px}
.c img{width:160px;image-rendering:pixelated}.c div{font-family:'Baloo 2';font-weight:800;font-size:20px;color:#ff7a00}
.f{position:absolute;bottom:0;left:0;right:0;height:8px;display:flex}.f i{flex:1}</style></head><body>
<img class="l" src="${logo}"><div class="s"><b>Bébé</b><b>Enfant</b><b>Ado</b><b>Adulte</b></div>
<h1>Ta vie, c’est toi<br>qui l’<em>écris</em></h1>
<div class="c"><img src="${qr}"><div>lifeinbabi.com</div><span style="font-weight:800;font-size:13px;color:#5a5f73">Gratuit · 100 % ivoirien</span></div>
<div class="f"><i style="background:#ff8200"></i><i style="background:#fff"></i><i style="background:#009a44"></i></div></body></html>`)
  await sleep(500)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  await page.screenshot({ path: path.join(dir, '00000.jpg'), type: 'jpeg', quality: 92 })
  for (let i = 1; i < frames; i++) fs.copyFileSync(path.join(dir, '00000.jpg'), path.join(dir, `${String(i).padStart(5, '0')}.jpg`))
  await page.close()
}

/* ---------- Run ---------- */

const b = await browser()
fs.mkdirSync(FRAMES, { recursive: true })
for (const t of TAKES) {
  if (ONLY && !ONLY.includes(t.id)) continue
  const started = Date.now()
  const k = await t.make()
  const { ctx, page } = await open(b, k, t.query ?? '')
  await warm(page, t.warm)
  if (t.before) {
    await t.before(page).catch((e) => console.error(t.id, 'before', String(e).slice(0, 160)))
    for (let i = 0; i < 60; i++) (await tick(page), i % 20 === 0 && (await sleep(200)))
  }
  await caption(page, t.stage, t.text)
  await film(page, path.join(FRAMES, t.id), Math.round(t.seconds * FPS), t.at?.(page) ?? {}, t.each?.(page))
  await ctx.close()
  console.log(`${t.id}: ${Math.round((Date.now() - started) / 1000)} s`)
}
if (!ONLY || ONLY.includes('fin')) await endCard(b, path.join(FRAMES, 'fin'), Math.round(5.9 * FPS))
await b.close()
if (PROBE) process.exit(0)

// Put together: the takes one after the other, the end card, the sound under it.
const order = [...TAKES.map((t) => t.id), 'fin']
const list = path.join(FRAMES, 'list.txt')
const clips = []
for (const id of order) {
  const mp4 = path.join(FRAMES, `${id}.mp4`)
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(FRAMES, id, '%05d.jpg'), '-vf', 'scale=1080:1920,format=yuv420p', '-c:v', 'libx264', '-crf', '20', '-preset', 'medium', mp4])
  clips.push(`file '${mp4}'`)
}
fs.writeFileSync(list, clips.join('\n'))
const silent = path.join(FRAMES, 'silent.mp4')
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', silent])
const [voice, beat] = ['voix-vie.mp3', 'son-vie.mp3'].map((f) => path.join(OUT, f)).map((f) => (fs.existsSync(f) ? f : ''))
const mp4 = path.join(OUT, 'babi-life-video-vie-1080x1920.mp4')
const sound =
  voice && beat
    ? ['-i', voice, '-i', beat, '-filter_complex', '[1:a]apad[v];[2:a]volume=0.32[b];[v][b]amix=inputs=2:duration=first:normalize=0[a]', '-map', '0:v', '-map', '[a]', '-c:a', 'aac', '-b:a', '192k', '-shortest']
    : voice || beat
      ? ['-i', voice || beat, '-af', 'apad', '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '160k', '-shortest']
      : []
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, ...sound, '-c:v', 'copy', '-movflags', '+faststart', mp4])
console.log('video →', mp4)
