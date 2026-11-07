// « Le tuto Babi Life » (scripts/tuto.md): a real tutorial from zero, the game filmed on a phone's
// screen (1080 × 1920, 30 images a second) while it's played, a finger showing each tap, each step
// numbered and titled, Awa's words under it and her voice (tuto-voix.mjs, Lea on ElevenLabs).
// As in vie.mjs, the page's clock is stopped (clock.mjs) and moved on one frame at a time, each
// frame taken; the overlay (step, words, finger, end card) is drawn in the page, from the frame's time.
//
//   node tuto-voix.mjs                       # Awa's lines first (out/voix-tuto/): the film is timed on them
//   EP=1 node tuto.mjs                       # episode 1 → out/babi-life-tuto-ep1-1080x1920.mp4
//   PROBE=1 EP=1 node tuto.mjs               # one small frame a second only (out/video-frames/tuto-ep1/)
//
// API: a local API started with DEV_LOGIN=true and GAME_OPEN=true, never production: the takes empty its
// users (DATABASE_URL). GAME: the game's dev server built against it (VITE_API_URL).

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import QRCode from 'qrcode'
import { chromium } from 'playwright-core'
import { OUT, fontFaces } from './shared.mjs'
import { STOPPED_CLOCK } from './clock.mjs'
import { DIR as VOICE, LINES } from './tuto-voix.mjs'

const FPS = 30
const EP = process.env.EP ?? '1'
const GAME = process.env.GAME ?? 'http://127.0.0.1:5294'
const DB = process.env.DATABASE_URL ?? 'postgres://postgres@127.0.0.1:55432/babi_admin?sslmode=disable'
const PROBE = !!process.env.PROBE
const FRAMES = path.join(OUT, 'video-frames', `tuto-ep${EP}`)
const SITE = 'lifeinbabi.com'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const psql = (q) => execFileSync('psql', [DB, '-tAc', q]).toString().trim()

/* ---------- Awa's lines and their times ---------- */

const said = JSON.parse(fs.readFileSync(path.join(VOICE, 'report.json'), 'utf8'))
const GAP = 0.35
/** The episode's lines in order, each with its start in the film (a beat of air after each). */
function timeline(ids) {
  let at = 0.3
  return ids.map((id) => {
    const l = { id, from: +at.toFixed(3), dur: said[id].dur, text: LINES[id].replace(/\[[^\]]+\]\s*/g, '').trim() }
    at += l.dur + GAP
    return l
  })
}
/** A line's words cut into short subtitles, each shown for its share of the line's time. */
function subtitles(l) {
  const parts = l.text.split(/(?<=[.!?:…])\s+|(?<=\.\.\.)\s*/).map((s) => s.trim()).filter(Boolean)
  const chunks = []
  for (const p of parts) {
    const last = chunks[chunks.length - 1]
    if (last && (last + ' ' + p).length < 46) chunks[chunks.length - 1] = last + ' ' + p
    else chunks.push(p)
  }
  const total = chunks.reduce((n, c) => n + c.length, 0)
  let t = l.from
  return chunks.map((c) => {
    const d = (c.length / total) * l.dur
    const s = { from: t, to: t + d, text: c }
    t += d
    return s
  })
}

/* ---------- The overlay, drawn in the page each frame ---------- */

const OVERLAY_CSS = `
#tuto{position:fixed;inset:0;z-index:2147483647;pointer-events:none;font-family:'Nunito',sans-serif}
#tuto .top{position:absolute;top:14px;left:12px;right:12px;display:flex;align-items:center;gap:8px;transition:none}
#tuto .num{flex:none;width:46px;height:46px;border-radius:14px;background:#ff7a00;color:#fff;font-family:'Baloo 2';font-weight:800;font-size:30px;line-height:46px;text-align:center;box-shadow:0 6px 16px -6px rgba(0,0,0,.6)}
#tuto .ttl{background:rgba(15,18,48,.92);color:#fff;border-radius:14px;padding:5px 12px 4px;box-shadow:0 6px 16px -6px rgba(0,0,0,.6)}
#tuto .ttl small{display:block;font-family:'Baloo 2';font-weight:700;font-size:11px;letter-spacing:.12em;color:#ffc233;line-height:1.1}
#tuto .ttl b{display:block;font-family:'Baloo 2';font-weight:800;font-size:22px;line-height:1.05}
#tuto .sub{position:absolute;left:14px;right:14px;bottom:30px;text-align:center}
#tuto .sub.stage{bottom:auto;top:205px}
#tuto .sub.low{bottom:74px}
#tuto .sub.mid{bottom:auto;top:318px}
#tuto .sub span{display:inline;background:#fff;color:#161a2b;font-weight:800;font-size:19px;line-height:1.55;padding:3px 8px;border-radius:8px;box-decoration-break:clone;-webkit-box-decoration-break:clone;box-shadow:0 4px 0 rgba(0,0,0,.18)}
#tuto .hook{position:absolute;inset:0;background:rgba(15,18,48,.78);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:#fff;text-align:center}
#tuto .hook .k{font-family:'Baloo 2';font-weight:800;font-size:22px;letter-spacing:.2em;color:#ffc233}
#tuto .hook .h{font-family:'Baloo 2';font-weight:800;font-size:64px;line-height:.92;text-shadow:0 6px 0 rgba(0,0,0,.35)}
#tuto .hook .h em{font-style:normal;color:#ff7a00}
#tuto .hook .e{background:#ff7a00;font-family:'Baloo 2';font-weight:800;font-size:22px;padding:4px 18px;border-radius:999px}
#tuto .end{position:absolute;inset:0;background:radial-gradient(120% 80% at 50% 20%,#2a2f6b,#0f1230);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:#fff;text-align:center;padding:0 22px}
#tuto .end .k{font-family:'Baloo 2';font-weight:800;font-size:18px;letter-spacing:.18em;color:#ffc233}
#tuto .end .h{font-family:'Baloo 2';font-weight:800;font-size:40px;line-height:.98}
#tuto .end .h em{font-style:normal;color:#ff7a00}
#tuto .end img{width:150px;height:150px;border-radius:16px;background:#fff;padding:8px;margin-top:10px}
#tuto .end .u{font-family:'Baloo 2';font-weight:800;font-size:28px}
#tuto .end .f{font-weight:800;font-size:16px;opacity:.85}
#tuto .finger{position:absolute;left:0;top:0;width:0;height:0}
#tuto .finger .ring{position:absolute;left:-26px;top:-26px;width:52px;height:52px;border-radius:50%;border:4px solid #fff;box-shadow:0 0 0 3px rgba(255,122,0,.9),0 0 18px rgba(0,0,0,.4)}
#tuto .finger .dot{position:absolute;left:-11px;top:-11px;width:22px;height:22px;border-radius:50%;background:rgba(255,255,255,.85);box-shadow:0 0 0 3px #ff7a00}
#tuto .finger svg{position:absolute;left:-14px;top:-4px;width:58px;height:70px;filter:drop-shadow(0 6px 6px rgba(0,0,0,.45))}
`
const HAND = `<svg viewBox="0 0 48 58"><path d="M15 4c2.6 0 4.5 2 4.5 4.6V22l1.4-.4c2.4-.6 4.4.4 5.2 2.4 2.2-.9 4.5 0 5.4 2 2.3-.8 4.6.3 5.3 2.5l3.2 10.7c1.5 5.1-.3 10.6-4.6 13.7L33 54.5c-1.2.9-2.7 1.4-4.2 1.4H20c-2.6 0-5-1.4-6.3-3.6L5 37.6c-1.2-2.1-.7-4.8 1.3-6.2 1.9-1.4 4.6-1.1 6.1.7l-2-.0V8.6C10.4 6 12.4 4 15 4Z" fill="#fff" stroke="#161a2b" stroke-width="2.6" stroke-linejoin="round"/><path d="M20.8 22.3v8M26.3 24.6v7M31.6 27v6" stroke="#161a2b" stroke-width="2.4" stroke-linecap="round"/></svg>`

/** Draws the frame's overlay: o = { step, title, sub, hook, end, finger: {x, y, press, show} }. */
function draw(page, o) {
  return page.evaluate(
    ([o, css, hand]) => {
      let el = document.getElementById('tuto')
      if (!el) {
        const st = document.createElement('style')
        st.textContent = css
        document.head.appendChild(st)
        el = document.createElement('div')
        el.id = 'tuto'
        el.innerHTML = `<div class="top"></div><div class="sub"></div><div class="finger"><div class="ring"></div><div class="dot"></div>${hand}</div><div class="hook"></div><div class="end"></div>`
        document.body.appendChild(el)
      }
      const q = (s) => el.querySelector(s)
      // The neighbours' requests and the PNJ's invitations, not in the tutorial's way.
      for (const b of document.querySelectorAll('button[aria-label*="te demande"]')) b.style.visibility = 'hidden'
      for (const b of document.querySelectorAll('button')) if (b.textContent?.trim() === 'Pas maintenant') b.parentElement.parentElement.style.visibility = 'hidden'
      const key = JSON.stringify([o.step, o.title, o.ep])
      if (q('.top').dataset.k !== key) {
        q('.top').dataset.k = key
        q('.top').innerHTML = o.step ? `<div class="num">${o.step}</div><div class="ttl"><small>TUTO · ÉPISODE ${o.ep}</small><b>${o.title}</b></div>` : ''
      }
      q('.sub').className = `sub ${o.subPos ?? ''}`
      q('.top').style.display = o.bar === false ? 'none' : 'flex'
      if (q('.sub').dataset.k !== (o.sub ?? '')) (q('.sub').dataset.k = o.sub ?? ''), (q('.sub').innerHTML = o.sub ? `<span>${o.sub}</span>` : '')
      q('.hook').style.display = o.hook ? 'flex' : 'none'
      if (o.hook && q('.hook').dataset.k !== o.hook) (q('.hook').dataset.k = o.hook), (q('.hook').innerHTML = o.hook)
      q('.hook').style.opacity = o.hookFade ?? 1
      q('.end').style.display = o.end ? 'flex' : 'none'
      if (o.end && q('.end').dataset.k !== o.end) (q('.end').dataset.k = o.end), (q('.end').innerHTML = o.end)
      q('.end').style.opacity = o.endFade ?? 1
      const f = q('.finger')
      f.style.display = o.finger?.show ? 'block' : 'none'
      if (o.finger?.show) {
        const p = o.finger.press ?? 0
        f.style.transform = `translate(${o.finger.x}px,${o.finger.y}px)`
        q('.finger svg').style.transform = `scale(${1 - 0.12 * p}) translateY(${-6 * p}px)`
        q('.finger .ring').style.opacity = String(o.finger.ring ?? 0)
        q('.finger .ring').style.transform = `scale(${0.5 + 1.1 * (1 - (o.finger.ring ?? 0))})`
        q('.finger .dot').style.opacity = String(p)
      }
    },
    [o, OVERLAY_CSS, HAND],
  )
}

/* ---------- Doing things in the page, as a finger does ---------- */

/** The middle of what's to be tapped, in the page's pixels. */
async function centre(loc) {
  const box = await loc.first().boundingBox({ timeout: 4000 })
  if (!box) throw new Error('nothing to tap')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}
/** A tap (pointer down, up, click) sent in the page: Playwright's own click waits for animation frames the stopped clock doesn't give. */
const tapIn = (loc) =>
  loc.first().evaluate((el) => {
    const o = { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, pointerType: 'touch' }
    el.dispatchEvent(new PointerEvent('pointerdown', o))
    el.dispatchEvent(new PointerEvent('pointerup', o))
    if (el.tagName === 'INPUT') el.focus()
    el.click()
  }, null, { timeout: 4000 })

/* ---------- The takes: the game opened on a phone, its clock stopped ---------- */

const API = process.env.API ?? 'http://127.0.0.1:8099/api/v1'
async function call(token, p, method = 'GET', body) {
  const r = await fetch(API + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
  const text = await r.text()
  if (!r.ok) throw new Error(`${method} ${p} ${r.status}: ${text.slice(0, 200)}`)
  return text ? JSON.parse(text) : null
}
const LOOK = { skin: '#6e4024', hair: 'tresses', hairColor: '#141010', outfit: 'casual', outfitColor: '#ff7a00', body: 'moyen', height: 1, eyes: '#2b1a10', beard: 'none', accessory: 'none', pattern: 'cercles', bottomColor: '', shoeColor: '', accessoryColor: '', marks: 'none', wear: 'neuf' }

/** A phone's screen (1080 × 1920), its clock stopped; `store`: what's in its localStorage. */
async function phone(b, store = {}) {
  const ctx = await b.newContext({
    viewport: { width: 405, height: 720 },
    deviceScaleFactor: PROBE ? 1 : 1080 / 405,
    isMobile: true,
    hasTouch: true,
    locale: 'fr-FR',
    geolocation: { latitude: 5.3364, longitude: -4.0757 }, // Yopougon
    permissions: ['geolocation'],
  })
  await ctx.addInitScript((store) => {
    localStorage.setItem('babi.pushAsked', String(Date.now()))
    for (const [k, v] of Object.entries(store)) localStorage.setItem(k, v)
    // The same « random » at each take.
    let s = 20251107
    Math.random = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296
  }, store)
  await ctx.addInitScript(STOPPED_CLOCK)
  // The fonts of the overlay, and no « Mode test (local) » on the sign-in screen (it isn't there online).
  await ctx.addInitScript((css) => {
    const put = () => {
      const st = document.createElement('style')
      st.textContent = css
      document.head.appendChild(st)
    }
    document.head ? put() : document.addEventListener('DOMContentLoaded', put)
  }, `${fontFaces()}\ndetails:has(> summary){display:none!important}`)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.error('page:', String(e).slice(0, 200)))
  await page.route('**/news*', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ items: [] }) }))
  return page
}
const tick = (page, n = 1) => page.evaluate((n) => {
  for (let i = 0; i < n; i++) window.__advance(1000 / 30)
}, n)

/** The page's clock moved on, nothing filmed, until `ok()` (a panel that comes after a while in game time). */
async function until(page, ok, frames = 900) {
  for (let i = 0; i < frames; i++) {
    if (await ok().catch(() => false)) return
    await tick(page, 3)
    if (i % 10 === 0) await sleep(100)
  }
  throw new Error('not there')
}

/** The sign-in screen, no one signed in (episode 1). */
async function signIn(b) {
  // A fresh start for the account made on camera (the other takes' players are left alone).
  psql(`DELETE FROM users WHERE email = 'awa.kone@gmail.com' OR username = 'awa.kone'`)
  const page = await phone(b)
  await page.goto(`${GAME}/`)
  await sleep(3000)
  for (let i = 0; i < 60; i++) (await tick(page), i % 10 === 0 && (await sleep(200)))
  await page.getByRole('tab', { name: 'Créer un compte' }).waitFor({ timeout: 60000 })
  return page
}

/**
 * Awa grown up (a poignon family, Yopougon), in the game: at `at` [lat, lng], in `place` if given (as if
 * walked in), her needs as asked (0–100), the game's hour; « libre » off, so only the finger picks what she does.
 */
async function awa(b, { at = [5.3364, -4.0757], place, needs = {}, hour = 11, warm = 90, career, shift, working, apps = [], doing, crowd = [], stage = 'adulte', query = '', before, store = {}, shopOpen } = {}) {
  const { token } = await call(null, '/auth/dev', 'POST', { name: `awa${Date.now().toString(36).slice(-5)}` })
  const me = await call(token, '/me')
  psql(`UPDATE users SET tester = true WHERE id = '${me.id}'`)
  const made = await call(token, '/sims', 'POST', { firstName: 'Awa', lastName: 'Koné', gender: 'femme', look: LOOK, traits: ['ambianceur', 'sportif'], aspiration: 'ambiance', lat: at[0], lng: at[1] })
  const sim = made.sim ?? made
  psql(`UPDATE sims SET family = 'poignon', baptised = true WHERE id = '${sim.id}'`)
  if (stage !== 'bebe') await call(token, `/sims/${sim.id}/tester`, 'POST', { action: 'age', stage })
  await call(token, `/sims/${sim.id}/tester`, 'POST', { action: 'needs' })
  if (before) await before({ token, sim })
  for (const app of apps) await call(token, `/sims/${sim.id}/apps`, 'POST', { app, install: true })
  // A job (career), and a shift done at `shift` (a place), paid into Waye.
  if (career) await call(token, `/sims/${sim.id}/career`, 'POST', { career })
  if (doing) await call(token, `/sims/${sim.id}/interact`, 'POST', { placeId: doing[0], interactionId: doing[1] })
  if (working) await call(token, `/sims/${sim.id}/interact`, 'POST', { placeId: working, interactionId: 'work' })
  if (shift) {
    await call(token, `/sims/${sim.id}/interact`, 'POST', { placeId: shift, interactionId: 'work' })
    await call(token, `/sims/${sim.id}/tester`, 'POST', { action: 'finish' })
  }
  if (Object.keys(needs).length) psql(`UPDATE sims SET needs = needs || '${JSON.stringify(needs)}'::jsonb WHERE id = '${sim.id}'`)
  const user = await call(token, '/me')
  const seen = ((await call(null, '/features')).new ?? []).map((n) => n.id)
  const page = await phone(b, {
    'ivoire-life-session': JSON.stringify({ state: { token, user }, version: 0 }),
    'babi-testeur': '1',
    'babi.firstSteps': 'done',
    'babi.tuto': 'done',
    'babi.tuto.adulte': 'done',
    'babi.arrivee': 'done',
    'babi.featuresSeen': JSON.stringify(seen),
    'babi.vie.libre': '0',
    ...store,
  })
  // The shop as it is online (here it has no payment keys, so it says « ouvre bientôt »).
  if (shopOpen)
    await page.route('**/sims/*/shop', async (r) => {
      const res = await r.fetch()
      const v = await res.json()
      await r.fulfill({ response: res, json: { ...v, open: true } })
    })
  page.awa = { token, sim: sim.id }
  // Other players connected at the same time, walking round Awa (their states, as a phone sends them).
  if (crowd.length) page.cleanup = await others(crowd, at)
  await page.goto(`${GAME}/jeu?hour=${hour}${place ? `&place=${place}` : ''}${query}`)
  await sleep(3000)
  for (let i = 0; i < 500; i++) {
    await tick(page)
    if (i % 10 === 0) await sleep(250)
    if (i > 60 && i % 10 === 0 && (await page.evaluate(() => !!window.__where?.streetReady || !!document.querySelector('[data-tour="que-faire"]')))) break
  }
  if (page.cleanup) Object.assign(page.cleanup.where, await page.evaluate(() => ({ x: window.__where?.sim?.[0] ?? 0, z: window.__where?.sim?.[1] ?? 0 })))
  for (let i = 0; i < warm; i++) (await tick(page), i % 20 === 0 && (await sleep(200)))
  return page
}

/** Players of the commune connected to the live hub from here, walking in circles round `at` [lat, lng]. */
async function others(names, at) {
  const socks = []
  const where = { x: 0, z: 0 }
  for (const [i, name] of names.entries()) {
    const { token } = await call(null, '/auth/dev', 'POST', { name: `${name.toLowerCase()}${Date.now().toString(36).slice(-4)}` })
    const me = await call(token, '/me')
    psql(`UPDATE users SET tester = true, username = '${name.toLowerCase()}_${i + 1}' WHERE id = '${me.id}'`)
    const look = { ...LOOK, hair: i % 2 ? 'short' : 'afro', outfitColor: ['#2a6cf0', '#00b86b', '#ff3d57', '#7b5cff'][i % 4] }
    const made = await call(token, '/sims', 'POST', { firstName: name, lastName: 'Bamba', gender: i % 2 ? 'homme' : 'femme', look, traits: ['ambianceur'], aspiration: 'ambiance', lat: at[0], lng: at[1] })
    const sim = made.sim ?? made
    await call(token, `/sims/${sim.id}/tester`, 'POST', { action: 'age', stage: 'adulte' })
    psql(`UPDATE sims SET last_tick = now() WHERE id = '${sim.id}'`)
    const ws = new WebSocket(API.replace(/^http/, 'ws') + '/live')
    await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)))
    ws.send(JSON.stringify({ t: 'hello', token, sim: sim.id, mode: 'open' }))
    const a0 = (i / names.length) * Math.PI * 2
    let t = 0
    const step = setInterval(() => {
      t += 0.2
      const a = a0 + t * 0.12
      const r = 4 + i * 1.5
      ws.readyState === 1 && ws.send(JSON.stringify({ t: 'state', x: where.x + Math.cos(a) * r, y: 0, z: where.z + Math.sin(a) * r, h: a + Math.PI / 2, p: 'walk' }))
    }, 200)
    socks.push(() => (clearInterval(step), ws.close()))
  }
  const stop = () => socks.forEach((f) => f())
  stop.where = where
  return stop
}

/** A game of the lab (city.html?…: the real game's matches and défis, on their own), `init` run in the page first. */
async function lab(b, query, { init, warm = 60 } = {}) {
  const page = await phone(b)
  if (init) await page.addInitScript(init)
  await page.goto(`${GAME}/city.html?${query}`)
  await sleep(4000)
  for (let i = 0; i < warm; i++) (await tick(page), i % 10 === 0 && (await sleep(200)))
  return page
}

/* ---------- The episodes ---------- */

const qr = (src) => QRCode.toDataURL(`https://${SITE}/?src=${src}`, { margin: 0, width: 300, color: { dark: '#0f1230', light: '#ffffff' } })
const endCard = async (ep, next) => `<div class="k">LE TUTO BABI LIFE</div><div class="h">${next}</div><img src="${await qr(`tuto-ep${ep}`)}"><div class="u">${SITE}</div><div class="f">Abonne-toi pour la suite !</div>`
const hookCard = (ep, title) => `<div class="k">LE TUTO</div><div class="h">Babi Life<br><em>depuis zéro</em></div><div class="e">Épisode ${ep} : ${title}</div>`
const button = (page, name) => page.getByRole('button', { name })

/**
 * An episode: its lines (timed on Awa's voice), its steps [from, number, title], the hook and the end card,
 * and its takes: { from, to (film time), open(b) → the page, actions(page) → [[time, what]] } where what is
 * tap: a locator tapped (the finger comes to it before) · type: text typed a letter a frame · point: a locator
 * the finger presses and holds `hold` s (the joystick, a gauge) · down / up: a key held (walking) ·
 * see: a locator scrolled into view · wait: a function waited for in real time (the film doesn't move meanwhile), `mark` named once done.
 * layout(t, marks): where the words go ({ subPos: 'stage' | 'low', bar: false }).
 */
async function episode1() {
  const L = timeline(['e1-hook', 'e1-compte', 'e1-perso', 'e1-naissance', 'e1-fin'])
  const [, compte, perso, naissance, fin] = L
  const s1 = compte.from
  const s2 = perso.from
  const s3 = naissance.from
  const length = fin.from + fin.dur + 1.2
  return {
    lines: L,
    length,
    steps: [
      [compte.from - 0.2, 1, 'Crée ton compte'],
      [perso.from - 0.2, 2, 'Crée ton perso'],
      [naissance.from - 0.2, 3, 'Ta naissance'],
    ],
    hook: [0, compte.from - 0.25, hookCard(1, 'commencer')],
    end: [fin.from + 3.0, await endCard(1, 'Épisode 2 :<br><em>tu grandis</em>')],
    // Where the words go: under the sign-in form, then over the stage (the perso), and low once the family is
    // drawn (the step's title gone, so « Famille … » is seen).
    layout: (t, marks) => (marks.reveal != null ? { subPos: 'low', bar: false } : t >= perso.from - 0.2 ? { subPos: 'stage' } : {}),
    takes: [
      {
        from: 0,
        to: length,
        open: signIn,
        actions: (page) => {
          const by = (name) => page.getByRole('button', { name, exact: true })
          const field = (name) => page.getByRole('textbox', { name, exact: true })
          return [
            [s1 + 0.9, { tap: () => page.getByRole('tab', { name: 'Créer un compte' }) }],
            [s1 + 1.7, { tap: () => field('Prénom') }],
            [s1 + 1.75, { type: 'Awa' }],
            [s1 + 2.4, { tap: () => field('Nom') }],
            [s1 + 2.45, { type: 'Koné' }],
            [s1 + 3.4, { tap: () => field('E-mail') }],
            [s1 + 3.45, { type: 'awa.kone@gmail.com' }],
            [s1 + 5.0, { tap: () => page.getByLabel('Mot de passe', { exact: true }) }],
            [s1 + 5.05, { type: 'babilife225' }],
            [s1 + 6.6, { tap: () => by('Créer mon compte') }],
            [s1 + 6.65, { wait: () => page.waitForURL('**/creer', { timeout: 60000 }).then(() => page.getByRole('button', { name: 'Femme' }).waitFor({ timeout: 60000 })), settle: 1500 }],
            [s2 + 0.9, { tap: () => page.getByRole('button', { name: 'Femme' }) }],
            [s2 + 1.6, { tap: () => page.getByRole('button', { name: /^Suivant · Corps/ }) }],
            [s2 + 2.5, { tap: () => page.locator('.sheet .tile').nth(3) }],
            [s2 + 3.3, { tap: () => page.getByRole('button', { name: /^Suivant · Visage/ }) }],
            [s2 + 3.9, { tap: () => page.getByRole('button', { name: /^Suivant · Coiffure/ }) }],
            [s2 + 4.5, { tap: () => page.locator('.sheet .tile').nth(4) }],
            [s2 + 5.2, { tap: () => page.getByRole('button', { name: /^Suivant · Tenue/ }) }],
            [s2 + 5.9, { tap: () => page.locator('.sheet .tile').nth(2) }],
            [s2 + 6.9, { tap: () => page.getByRole('button', { name: 'Perso au hasard' }) }],
            [s3 + 0.3, { tap: () => page.getByRole('button', { name: /^Suivant · Caractère/ }) }],
            [s3 + 0.9, { tap: () => page.getByRole('button', { name: /^Suivant · Naissance/ }) }],
            [s3 + 1.9, { tap: () => by('Naître') }],
            [s3 + 1.95, { wait: () => page.getByText("C'est un bébé !").waitFor({ timeout: 60000 }), settle: 2500, mark: 'reveal' }],
          ]
        },
      },
    ],
  }
}

async function quotidien() {
  const L = timeline(['e2-hook', 'e2-besoins', 'e2-marcher', 'e2-maquis', 'e2-dormir', 'e2-fin'])
  const [, besoins, marcher, maquis, dormir, fin] = L
  const length = fin.from + fin.dur + 1.2
  const ring = (page, n) => page.locator('[data-tour="besoins"] > *').nth(n)
  return {
    lines: L,
    length,
    steps: [
      [besoins.from - 0.2, 4, 'Tes besoins'],
      [marcher.from - 0.2, 4, 'Bouge dans ta commune'],
      [maquis.from - 0.2, 4, 'Mange au maquis'],
      [dormir.from - 0.2, 4, 'Dors chez toi'],
    ],
    hook: [0, besoins.from - 0.25, hookCard(3, 'ta vie de tous les jours')],
    end: [fin.from + 2.6, await endCard(3, 'Épisode 4 :<br><em>ton boulot<br>et ton argent</em>')],
    layout: () => ({ subPos: 'mid' }),
    takes: [
      {
        // The street in Yopougon: the gauges, then walking up the street and running.
        from: 0,
        to: maquis.from - 0.2,
        open: (b) => awa(b, { needs: { hunger: 22, energy: 35, hygiene: 60 } }),
        actions: (page) => [
          [besoins.from + 0.9, { point: () => ring(page, 0), hold: 0.5 }],
          [besoins.from + 1.6, { point: () => ring(page, 1), hold: 0.4 }],
          [besoins.from + 2.2, { point: () => ring(page, 2), hold: 0.4 }],
          [besoins.from + 2.8, { point: () => ring(page, 3), hold: 0.4 }],
          [besoins.from + 3.4, { point: () => ring(page, 4), hold: 0.4 }],
          [besoins.from + 5.0, { point: () => ring(page, 0), hold: 1.2 }],
          [marcher.from + 0.4, { point: () => page.getByRole('button', { name: 'Courir' }).locator('xpath=following-sibling::*[1]'), hold: 1.8, offset: [0, -28] }],
          [marcher.from + 0.45, { down: 'ArrowUp' }],
          [marcher.from + 2.6, { tap: () => button(page, 'Courir') }],
          [marcher.from + 3.3, { point: () => page.getByRole('button', { name: 'Courir' }).locator('xpath=following-sibling::*[1]'), hold: 3, offset: [0, -28] }],
          [maquis.from - 0.25, { up: 'ArrowUp' }],
        ],
      },
      {
        // In a maquis of Yopougon: the « + », a garba.
        from: maquis.from - 0.2,
        to: dormir.from - 0.2,
        open: (b) => awa(b, { at: [5.332, -4.069], place: 'yop-maquis', needs: { hunger: 18 }, hour: 13 }),
        actions: (page) => [
          [maquis.from + 1.9, { tap: () => button(page, 'Ajouter un ordre') }],
          [maquis.from + 3.2, { tap: () => page.getByRole('button', { name: 'Manger un garba', exact: true }) }],
          [maquis.from + 5.6, { point: () => ring(page, 0), hold: 1.0 }],
        ],
      },
      {
        // At home in the evening: the « + », « Dormir ».
        from: dormir.from - 0.2,
        to: length,
        open: (b) => awa(b, { place: 'home', needs: { energy: 12 }, hour: 21 }),
        actions: (page) => [
          [dormir.from + 1.9, { tap: () => button(page, 'Ajouter un ordre') }],
          [dormir.from + 3.0, { tap: () => page.getByRole('button', { name: 'Dormir', exact: true }) }],
          [dormir.from + 4.2, { point: () => ring(page, 1), hold: 0.8 }],
        ],
      },
    ],
  }
}
async function boulot() {
  const L = timeline(['e3-hook', 'e3-boulot', 'e3-travail', 'e3-paie', 'e3-fin'])
  const [, boulot, travail, paie, fin] = L
  const length = fin.from + fin.dur + 1.2
  const phoneBtn = (page) => page.locator('[data-tour="phone"]')
  const app = (page, name) => page.getByRole('button', { name, exact: true })
  // The clubs of the rue Princesse (Yopougon), where the DJ de quartier works from 21 h.
  const CLUB = [5.34787, -4.07777]
  return {
    lines: L,
    length,
    steps: [
      [boulot.from - 0.2, 5, 'Trouve un boulot'],
      [travail.from - 0.2, 5, 'Va au travail'],
      [paie.from - 0.2, 5, 'Ta paie dans Waye'],
    ],
    hook: [0, boulot.from - 0.25, hookCard(4, 'le boulot et l’argent')],
    end: [fin.from + 1.6, await endCard(4, 'Épisode 5 :<br><em>tous les jeux</em>')],
    layout: (t) => (t >= travail.from - 0.2 && t < paie.from - 0.2 ? { subPos: 'mid' } : { subPos: 'low' }),
    takes: [
      {
        // The phone, the Boulot app, a job with no diploma: DJ de quartier.
        from: 0,
        to: travail.from - 0.2,
        open: (b) => awa(b, { hour: 21 }),
        actions: (page) => [
          [boulot.from + 1.2, { tap: () => phoneBtn(page) }],
          [boulot.from + 2.4, { tap: () => app(page, 'Boulot') }],
          [boulot.from + 4.0, { see: () => page.getByRole('button', { name: /^Ambiance/ }) }],
          [boulot.from + 5.0, { tap: () => page.getByRole('button', { name: /^Ambiance/ }) }],
        ],
      },
      {
        // At the club in the evening: the « + », « Aller au travail »…
        from: travail.from - 0.2,
        to: travail.from + 2.9,
        open: (b) => awa(b, { at: CLUB, place: 'yop-rp-saphir', career: 'ambiance', hour: 21 }),
        actions: (page) => [
          [travail.from + 1.0, { tap: () => page.getByRole('button', { name: 'Ajouter un ordre' }) }],
          [travail.from + 2.0, { tap: () => page.getByRole('button', { name: 'Aller au travail (DJ de quartier)', exact: true }).last() }],
        ],
      },
      {
        // … and the shift going on there: its panel, « Travailler dur ».
        from: travail.from + 2.9,
        to: paie.from - 0.2,
        open: (b) => awa(b, { at: CLUB, place: 'yop-rp-saphir', career: 'ambiance', working: 'yop-rp-saphir', hour: 21 }),
        actions: (page) => [
          [travail.from + 2.9, { wait: () => until(page, () => page.getByRole('button', { name: /Travailler dur/ }).isVisible()), settle: 300 }],
          [travail.from + 4.1, { tap: () => page.getByRole('button', { name: /Travailler dur/ }) }],
        ],
      },
      {
        // The shift paid: Waye, its balance and its history.
        from: paie.from - 0.2,
        to: length,
        open: (b) => awa(b, { at: CLUB, career: 'ambiance', shift: 'yop-rp-saphir', hour: 21 }),
        actions: (page) => [
          [paie.from + 0.5, { tap: () => phoneBtn(page) }],
          [paie.from + 1.5, { tap: () => app(page, 'Waye') }],
          [paie.from + 3.0, { point: () => page.getByText(/Aller au travail \(DJ/).first(), hold: 1.6 }],
        ],
      },
    ],
  }
}
async function jeux() {
  const L = timeline(['e4-hook', 'e4-foot', 'e4-billard', 'e4-kart', 'e4-combat', 'e4-cartes', 'e4-fin'])
  const [, foot, billard, kart, combat, cartes, fin] = L
  const length = fin.from + fin.dur + 1.2
  const by = (page, name) => page.getByRole('button', { name })
  return {
    lines: L,
    length,
    steps: [
      [foot.from - 0.2, 6, 'Le foot'],
      [billard.from - 0.2, 6, 'Le billard'],
      [kart.from - 0.2, 6, 'Le kart'],
      [combat.from - 0.2, 6, 'Le combat de rue'],
      [cartes.from - 0.2, 6, 'Les cartes, les dames'],
    ],
    hook: [0, foot.from - 0.25, hookCard(5, 'les jeux')],
    end: [fin.from + 1.4, await endCard(5, 'Épisode 6 :<br><em>joue avec<br>tes amis</em>')],
    layout: () => ({ subPos: 'mid' }),
    takes: [
      {
        // Five-a-side in the street, Awa's player played by the game's AI.
        from: 0,
        to: billard.from - 0.2,
        open: (b) => lab(b, 'view=foot5&seed=7', { warm: 30 }),
        each: (page) => page.evaluate(() => {
          const g = globalThis.streetMatch
          if (g) g.ps[g.me].human = false
        }),
        actions: (page) => [
          [foot.from + 1.2, { point: () => by(page, 'Appelle'), hold: 0.4 }],
          [foot.from + 2.4, { point: () => by(page, 'Tir'), hold: 0.4 }],
          [foot.from + 3.6, { point: () => by(page, 'Tir'), hold: 0.6 }],
        ],
      },
      {
        // The maquis' billard: an opponent, the shot.
        from: billard.from - 0.2,
        to: kart.from - 0.2,
        open: (b) => lab(b, 'view=billard'),
        actions: (page) => [
          [billard.from + 0.4, { tap: () => by(page, /^Konan/) }],
          [billard.from + 0.45, { wait: () => by(page, 'Tirer').waitFor({ timeout: 60000 }), settle: 1500 }],
          [billard.from + 3.0, { tap: () => by(page, 'Tirer') }],
        ],
      },
      {
        // The kart, driven by the game's own AI.
        from: kart.from - 0.2,
        to: combat.from - 0.2,
        open: (b) => lab(b, 'view=kart', { init: () => (globalThis.kartAuto = true), warm: 200 }),
        actions: (page) => [[kart.from + 0.6, { point: () => by(page, 'Déraper'), hold: 1.4 }]],
      },
      {
        // The street fight: « C'est parti ! », then the punches.
        from: combat.from - 0.2,
        to: cartes.from - 0.2,
        open: (b) => lab(b, 'view=defi&kind=combat'),
        actions: (page) => [
          [combat.from + 0.2, { tap: () => by(page, /C.est parti/) }],
          [combat.from + 0.7, { tap: () => by(page, /Petit Yao/) }],
          [combat.from + 0.75, { wait: () => until(page, () => by(page, /^Poing/).first().isVisible()), settle: 300 }],
          [combat.from + 1.4, { tap: () => by(page, /^Poing/) }],
          [combat.from + 1.8, { tap: () => by(page, /^Poing/) }],
          [combat.from + 2.2, { tap: () => by(page, /^Poing/) }],
          [combat.from + 3.0, { tap: () => by(page, /^Pied/) }],
          [combat.from + 3.6, { point: () => by(page, /^Garde/), hold: 0.6 }],
        ],
      },
      {
        // The phone: the 8 américain, a table with the quarter's players.
        from: cartes.from - 0.2,
        to: length,
        open: (b) => awa(b, { apps: ['huit', 'dames', 'awale', 'ludo'] }),
        actions: (page) => [
          [cartes.from + 0.6, { tap: () => page.locator('[data-tour="phone"]') }],
          [cartes.from + 2.0, { tap: () => by(page, /8 américain/) }],
          [cartes.from + 3.4, { tap: () => by(page, "S'asseoir") }],
          [cartes.from + 5.0, { tap: () => by(page, 'Pour le plaisir') }],
        ],
      },
    ],
  }
}
async function amis() {
  const L = timeline(['e5-hook', 'e5-enligne', 'e5-saluer', 'e5-inviter', 'e5-live', 'e5-fin'])
  const [, enligne, saluer, inviter, live, fin] = L
  const length = fin.from + fin.dur + 1.2
  const by = (page, name) => page.getByRole('button', { name })
  const MAQUIS = [5.332, -4.069]
  return {
    lines: L,
    length,
    steps: [
      [enligne.from - 0.2, 7, 'Qui est en ligne ?'],
      [saluer.from - 0.2, 7, 'Salue, ajoute en ami'],
      [inviter.from - 0.2, 7, 'Invite tes amis'],
      [live.from - 0.2, 7, 'Ton live Tikitoko'],
    ],
    hook: [0, enligne.from - 0.25, hookCard(6, 'les amis')],
    end: [fin.from + 1.6, await endCard(6, 'Dernier épisode :<br><em>voyage et<br>deviens debout</em>')],
    layout: (t) => (t >= enligne.from + 1.2 && t < live.from - 0.2 ? { subPos: 'stage' } : { subPos: 'mid' }),
    takes: [
      {
        // At the maquis with a drink, other players there: the players' list, greet, add, invite.
        from: 0,
        to: live.from - 0.2,
        open: (b) => awa(b, { at: MAQUIS, place: 'yop-maquis', doing: ['yop-maquis', 'drink-with-friends'], hour: 19, crowd: ['Keke', 'Fanta', 'Yao', 'Mariam'] }),
        actions: (page) => [
          [enligne.from + 0.9, { tap: () => page.locator('button.hud:has(svg.lucide-users)') }],
          [enligne.from + 3.6, { tap: () => by(page, /Tout Babi/) }],
          [saluer.from - 0.6, { tap: () => by(page, new RegExp(`^${'Yopougon'}`)) }],
          [saluer.from + 0.6, { tap: () => by(page, 'Saluer') }],
          [saluer.from + 2.4, { tap: () => by(page, /Ajouter en ami/) }],
          [inviter.from + 0.9, { tap: () => by(page, 'Inviter') }],
        ],
      },
      {
        // Tikitoko Live.
        from: live.from - 0.2,
        to: length,
        open: (b) => lab(b, 'view=tikilive&host', { warm: 60 }),
        actions: () => [],
      },
    ],
  }
}
async function grandir() {
  const L = timeline(['g-hook', 'g-bebe', 'g-coucou', 'g-enfant', 'g-ado', 'g-adulte', 'g-fin'])
  const [, bebe, coucou, enfant, ado, adulte, fin] = L
  const length = fin.from + fin.dur + 1.2
  const by = (page, name) => page.getByRole('button', { name })
  return {
    lines: L,
    length,
    steps: [
      [bebe.from - 0.2, 3, 'Bébé'],
      [enfant.from - 0.2, 3, 'Enfant'],
      [ado.from - 0.2, 3, 'Ado'],
      [adulte.from - 0.2, 3, 'Adulte à 18 ans'],
    ],
    hook: [0, bebe.from - 0.25, hookCard(2, 'tu grandis')],
    end: [fin.from + 0.6, await endCard(2, 'Épisode 3 :<br><em>ta vie de tous<br>les jours</em>')],
    layout: () => ({ subPos: 'mid' }),
    takes: [
      {
        // The baby at home, hungry: the « + », « Boire le biberon ».
        from: 0,
        to: coucou.from - 0.2,
        open: (b) => awa(b, { stage: 'bebe', place: 'home', needs: { hunger: 20 }, hour: 10 }),
        actions: (page) => [
          [bebe.from + 1.6, { tap: () => by(page, 'Ajouter un ordre') }],
          [bebe.from + 2.7, { tap: () => page.getByRole('button', { name: 'Boire le biberon', exact: true }) }],
        ],
      },
      {
        // Coucou-caché with maman: « Rire ! » when her hands open.
        from: coucou.from - 0.2,
        to: enfant.from - 0.2,
        open: (b) => awa(b, { stage: 'bebe', place: 'home', hour: 10, store: { 'babi.vie.jeux': '1' } }),
        each: (() => {
          let seen = -1
          let n = 0
          return async (page) => {
            n++
            const open = await page.getByText('Coucou !', { exact: true }).count()
            if (!open) return void (seen = -1)
            if (seen < 0) seen = n
            if (n - seen === 7) await tapIn(by(page, 'Rire !'))
          }
        })(),
        actions: (page) => [
          [coucou.from - 0.1, { tap: () => by(page, 'Ajouter un ordre') }],
          [coucou.from + 0.7, { tap: () => page.getByRole('button', { name: 'Jouer à coucou-caché avec maman', exact: true }) }],
          [coucou.from + 0.75, { wait: () => by(page, /C.est parti/).waitFor({ timeout: 30000 }), settle: 500 }],
          [coucou.from + 1.5, { tap: () => by(page, /C.est parti/) }],
        ],
      },
      {
        // The child at school: « Lever la main », then an answer to the maître's question.
        from: enfant.from - 0.2,
        to: ado.from - 0.2,
        open: (b) =>
          awa(b, {
            stage: 'enfant',
            hour: 9,
            before: async ({ token, sim }) => {
              await call(token, `/sims/${sim.id}/interact`, 'POST', { placeId: 'home', interactionId: 'jouer-cour' })
              psql(`UPDATE sims SET activity = jsonb_set(jsonb_set(jsonb_set(activity, '{interaction,id}', '"aller-ecole"'), '{interaction,label}', '"Aller à l''école"'), '{interaction,icon}', '"school"') WHERE id = '${sim.id}'`)
            },
          }),
        actions: (page) => [
          [enfant.from + 1.6, { tap: () => by(page, /Lever la main/) }],
          [enfant.from + 2.6, { tap: () => by(page, /C.est parti/) }],
          [
            enfant.from + 3.8,
            {
              run: (page) =>
                page.evaluate(() => {
                  const answers = [...document.querySelectorAll('button')].filter((b) => {
                    const r = b.getBoundingClientRect()
                    return r.height > 0 && r.top > 250 && r.top < 620 && b.innerText.trim().length > 2 && !/Lever|Phone|Carte|Voir|Rire|parti/.test(b.innerText)
                  })
                  ;(answers[1] ?? answers[0])?.click()
                }),
            },
          ],
        ],
      },
      {
        // The teen's first phone: Gbairai.
        from: ado.from - 0.2,
        to: adulte.from - 0.2,
        open: (b) => awa(b, { stage: 'ado', hour: 16 }),
        actions: (page) => [
          [ado.from + 0.8, { tap: () => page.locator('[data-tour="phone"]') }],
          [ado.from + 2.2, { tap: () => page.getByRole('button', { name: 'Gbairai', exact: true }).last() }],
        ],
      },
      {
        // The Boutique: growing up at once.
        from: adulte.from - 0.2,
        to: length,
        open: (b) => awa(b, { stage: 'bebe', hour: 10, query: '&app=boutique', shopOpen: true }),
        actions: (page) => [
          [adulte.from + 2.4, { tap: () => by(page, /18 ans ou plus/) }],
          [adulte.from + 3.4, { see: () => page.getByText(/tout de suite/) }],
        ],
      },
    ],
  }
}
/** The six families, the poorest at the bottom, Awa's place on the ladder lit (her goal at the top: debout). */
function ladder(at) {
  const fams = [['debout', 'Debout', '4 %'], ['late', 'Laté', '8 %'], ['lagnon', 'Lagnon', '15 %'], ['poignon', 'Poignon', '33 %'], ['coule', 'Coulé', '25 %'], ['gnambro', 'Gnambro', '15 %']]
  const rows = fams
    .map(([id, label, odds]) => `<div style="display:flex;align-items:center;gap:10px;width:270px;padding:7px 14px;border-radius:14px;font-family:'Baloo 2';font-weight:800;font-size:22px;${id === at ? 'background:#ff7a00;color:#fff;transform:scale(1.08);box-shadow:0 8px 20px -8px rgba(0,0,0,.6)' : 'background:rgba(255,255,255,.12);color:#fff'}">${id === 'debout' ? '★' : '·'} ${label}<span style="margin-left:auto;font-size:14px;opacity:.75">${odds}</span>${id === at ? '<span style="font-size:15px">← Awa</span>' : ''}</div>`)
    .join('')
  return `<div class="k">TON BUT</div><div class="h" style="font-size:44px">Devenir <em>debout</em></div><div style="display:flex;flex-direction:column;gap:6px;margin-top:6px">${rows}</div>`
}

async function voyage() {
  const L = timeline(['e6-hook', 'e6-avion', 'e6-plage', 'e6-safari', 'e6-debout', 'e6-fin'])
  const [, avion, plage, safari, debout, fin] = L
  const length = fin.from + fin.dur + 2.2
  const d = debout.from
  return {
    lines: L,
    length,
    steps: [
      [avion.from - 0.2, 8, 'Voyage'],
      [plage.from - 0.2, 8, 'La plage de Bassam'],
      [safari.from - 0.2, 8, 'Le safari de la N’Zi'],
      [debout.from - 0.2, 9, 'Ton but : debout'],
    ],
    hook: [0, avion.from - 0.25, hookCard(7, 'voyage et deviens debout')],
    // The ladder climbed, rung by rung, while Awa says it.
    cards: [
      [d + 0.6, d + 2.6, ladder('gnambro')],
      [d + 2.6, d + 3.6, ladder('poignon')],
      [d + 3.6, d + 4.6, ladder('lagnon')],
      [d + 4.6, d + 5.4, ladder('late')],
      [d + 5.4, fin.from - 0.1, ladder('debout')],
    ],
    end: [fin.from, (await endCard(7, 'À toi de jouer :<br><em>crée ton perso !</em>')).replace('Abonne-toi pour la suite !', 'Partage le tuto à tes amis !')],
    layout: () => ({ subPos: 'mid' }),
    takes: [
      { from: 0, to: plage.from - 0.2, open: (b) => lab(b, 'view=flight', { warm: 90 }), actions: () => [] },
      { from: plage.from - 0.2, to: safari.from - 0.2, open: (b) => lab(b, 'view=plage&id=bassam-plage', { warm: 120 }), actions: () => [] },
      {
        from: safari.from - 0.2,
        to: debout.from - 0.2,
        open: (b) => lab(b, 'view=defi&kind=safari'),
        actions: (page) => [[safari.from + 0.3, { tap: () => page.getByRole('button', { name: /C.est parti/ }) }]],
      },
      { from: debout.from - 0.2, to: length, open: (b) => awa(b, { at: [5.3237, -4.0197], hour: 17 }), actions: () => [] },
    ],
  }
}
const EPISODES = { 1: episode1, 2: grandir, 3: quotidien, 4: boulot, 5: jeux, 6: amis, 7: voyage }

/* ---------- Filming ---------- */

const ease = (k) => k * k * (3 - 2 * k)
const MOVE = 12 // frames the finger takes to come to what it touches

/** One take filmed into the episode's frames (its own numbers in the film), the overlay drawn over it. */
async function film(b, ep, take, subs, taps) {
  const page = await take.open(b)
  const acts = take.actions(page).map(([t, x]) => ({ f: Math.round(t * FPS), ...x }))
  const first = Math.round(take.from * FPS)
  const last = Math.min(Math.round(take.to * FPS), Math.round(ep.length * FPS))
  const finger = { x: 300, y: 640, show: false, from: null, to: null, f0: 0, tapAt: -99, holdTo: -1 }
  const marks = {}
  let typing = null
  const touches = (x) => x.tap || x.point
  const where = async (x) => {
    const c = await centre(touches(x)())
    return x.offset ? { x: c.x + x.offset[0], y: c.y + x.offset[1] } : c
  }
  for (let i = first; i < last; i++) {
    const t = i / FPS
    // The finger sets off MOVE frames before what it touches.
    const next = acts.find((x) => touches(x) && x.f - MOVE === i)
    if (next) {
      try {
        finger.to = await where(next)
        finger.from = finger.show ? { x: finger.x, y: finger.y } : { x: finger.to.x + 70, y: finger.to.y + 160 }
        finger.f0 = i
        finger.show = true
      } catch (e) {
        console.error('finger', i, String(e).slice(0, 120))
      }
    }
    if (finger.to && i >= finger.f0 && i <= finger.f0 + MOVE) {
      const k = ease((i - finger.f0) / MOVE)
      finger.x = finger.from.x + (finger.to.x - finger.from.x) * k
      finger.y = finger.from.y + (finger.to.y - finger.from.y) * k
    }
    for (const x of acts.filter((x) => x.f === i)) {
      try {
        if (touches(x)) {
          const c = await where(x).catch(() => null)
          if (c) Object.assign(finger, { x: c.x, y: c.y, show: true })
          if (x.tap) await tapIn(x.tap())
          finger.tapAt = i
          finger.holdTo = x.point ? i + Math.round((x.hold ?? 0.4) * FPS) : -1
          taps.push(+t.toFixed(3))
        }
        if (x.type) typing = { text: x.type, n: 0 }
        if (x.run) await x.run(page)
        if (x.see) await x.see().first().evaluate((el) => el.scrollIntoView({ block: 'center' }), null, { timeout: 4000 })
        if (x.down) await page.keyboard.down(x.down)
        if (x.up) await page.keyboard.up(x.up)
        if (x.wait) {
          await x.wait(page)
          await sleep(x.settle ?? 0)
          await tick(page, 2)
          if (x.mark) marks[x.mark] = i
        }
      } catch (e) {
        console.error('action', i, Object.keys(x), String(e).slice(0, 200))
      }
    }
    if (take.each) await take.each(page).catch(() => undefined)
    if (typing) {
      await page.keyboard.insertText(typing.text[typing.n++])
      if (typing.n >= typing.text.length) typing = null
    }
    // The finger leaves when nothing's to be touched soon.
    const soon = acts.some((x) => touches(x) && x.f >= i && x.f - i < 45)
    if (finger.show && !soon && i - finger.tapAt > 20 && i > finger.holdTo && !(finger.to && i <= finger.f0 + MOVE)) finger.show = false
    const since = i - finger.tapAt
    const held = i <= finger.holdTo
    const press = held ? Math.min(1, since / 4) : since >= 0 && since < 8 ? Math.sin((since / 8) * Math.PI) : 0
    const ring = since >= 0 && since < 14 ? 1 - since / 14 : 0
    const step = [...ep.steps].reverse().find(([from]) => t >= from)
    const sub = subs.find((s) => t >= s.from && t < s.to + 0.25)
    const card = ep.cards?.find(([a, z]) => t >= a && t < z)
    const inHook = (t >= ep.hook[0] && t < ep.hook[1]) || !!card
    const inEnd = t >= ep.end[0]
    await draw(page, {
      ep: EP,
      ...(ep.layout?.(t, marks) ?? {}),
      step: step?.[1],
      title: step?.[2],
      sub: inEnd ? null : sub?.text,
      hook: card ? card[2] : inHook ? ep.hook[2] : null,
      hookFade: card ? 1 : inHook ? Math.min(1, (ep.hook[1] - t) / 0.3) : 0,
      end: inEnd ? ep.end[1] : null,
      endFade: inEnd ? Math.min(1, (t - ep.end[0]) / 0.3) : 0,
      finger: { ...finger, show: finger.show && !inHook && !inEnd, press, ring },
    })
    await tick(page)
    if (!PROBE || i % FPS === 0 || i === first) await page.screenshot({ path: path.join(FRAMES, `${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92, timeout: 90000 })
    if (i % 60 === 0) console.log(`${t.toFixed(1)} s / ${ep.length.toFixed(1)}`)
  }
  page.cleanup?.()
  await page.context().close()
}

async function main() {
  const ep = await EPISODES[EP]()
  const subs = ep.lines.flatMap(subtitles)
  const b = await chromium.launch({
    executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars'],
    proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } : undefined,
  })
  // TAKES=1,2: those takes again, the others' frames kept.
  const only = process.env.TAKES?.split(',').map(Number)
  if (!only) fs.rmSync(FRAMES, { recursive: true, force: true })
  fs.mkdirSync(FRAMES, { recursive: true })
  const plan = path.join(FRAMES, 'plan.json')
  const before = fs.existsSync(plan) ? JSON.parse(fs.readFileSync(plan, 'utf8')) : { taps: {} }
  const taps = {}
  for (const [k, take] of ep.takes.entries()) {
    if (only && !only.includes(k)) {
      taps[k] = before.taps?.[k] ?? []
      continue
    }
    taps[k] = []
    await film(b, ep, take, subs, taps[k])
  }
  await b.close()
  fs.writeFileSync(plan, JSON.stringify({ length: ep.length, lines: ep.lines.map(({ id, from }) => ({ id, from })), taps }, null, 2))
  if (!PROBE) sound(ep, Object.values(taps).flat())
}

/* ---------- The sound and the film ---------- */

/** Awa's lines at their times, a soft tick on each tap, a light beat under her (ducked), then the frames into the film. */
function sound(ep, taps) {
  const out = path.join(OUT, `babi-life-tuto-ep${EP}-1080x1920.mp4`)
  const wav = path.join(FRAMES, 'son.wav')
  const inputs = []
  const parts = []
  ep.lines.forEach((l, k) => {
    inputs.push('-i', path.join(VOICE, `${l.id}.mp3`))
    const ms = Math.round(l.from * 1000)
    parts.push(`[${k}:a]aresample=44100,adelay=${ms}|${ms},volume=1.0[v${k}]`)
  })
  // The tap's tick: a short, bright click.
  const tickWav = path.join(FRAMES, 'tick.wav')
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=2200:duration=0.04', '-af', 'afade=t=out:st=0:d=0.04,volume=0.35', '-ar', '44100', tickWav])
  const n = ep.lines.length
  taps.forEach((t, k) => {
    inputs.push('-i', tickWav)
    const ms = Math.round(t * 1000)
    parts.push(`[${n + k}:a]adelay=${ms}|${ms}[t${k}]`)
  })
  const mix = [...ep.lines.map((_, k) => `[v${k}]`), ...taps.map((_, k) => `[t${k}]`)].join('')
  parts.push(`${mix}amix=inputs=${n + taps.length}:normalize=0,atrim=0:${ep.length.toFixed(3)},apad=whole_dur=${ep.length.toFixed(3)}[a]`)
  execFileSync('ffmpeg', ['-y', '-v', 'error', ...inputs, '-filter_complex', parts.join(';'), '-map', '[a]', '-ac', '2', wav])
  const music = path.join(OUT, 'son-tuto.mp3')
  const withMusic = fs.existsSync(music)
  execFileSync('ffmpeg', [
    '-y', '-v', 'error', '-framerate', String(FPS), '-i', path.join(FRAMES, '%05d.jpg'), '-i', wav,
    ...(withMusic ? ['-stream_loop', '-1', '-i', music] : []),
    ...(withMusic
      ? ['-filter_complex', `[2:a]volume=0.16,atrim=0:${ep.length.toFixed(3)},afade=t=out:st=${(ep.length - 1.2).toFixed(2)}:d=1.2[m];[m][1:a]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=300[d];[d][1:a]amix=inputs=2:normalize=0[a]`, '-map', '0:v', '-map', '[a]']
      : ['-map', '0:v', '-map', '1:a']),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '19', '-preset', 'medium', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', out,
  ])
  console.log('→', out)
}

await main()
