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
      for (const b of document.querySelectorAll('button')) if (b.textContent?.trim() === 'Pas maintenant' && !b.dataset.tutoGone) (b.dataset.tutoGone = '1'), b.click()
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

/** The sign-in screen, no one signed in (episode 1). */
async function signIn(b) {
  psql(`TRUNCATE users CASCADE`)
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
async function awa(b, { at = [5.3364, -4.0757], place, needs = {}, hour = 11, warm = 90 } = {}) {
  const { token } = await call(null, '/auth/dev', 'POST', { name: `awa${Date.now().toString(36).slice(-5)}` })
  const me = await call(token, '/me')
  psql(`UPDATE users SET tester = true WHERE id = '${me.id}'`)
  const made = await call(token, '/sims', 'POST', { firstName: 'Awa', lastName: 'Koné', gender: 'femme', look: LOOK, traits: ['ambianceur', 'sportif'], aspiration: 'ambiance', lat: at[0], lng: at[1] })
  const sim = made.sim ?? made
  psql(`UPDATE sims SET family = 'poignon', baptised = true WHERE id = '${sim.id}'`)
  await call(token, `/sims/${sim.id}/tester`, 'POST', { action: 'age', stage: 'adulte' })
  await call(token, `/sims/${sim.id}/tester`, 'POST', { action: 'needs' })
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
  })
  page.awa = { token, sim: sim.id }
  await page.goto(`${GAME}/jeu?hour=${hour}${place ? `&place=${place}` : ''}`)
  await sleep(3000)
  for (let i = 0; i < 500; i++) {
    await tick(page)
    if (i % 10 === 0) await sleep(250)
    if (i > 60 && i % 10 === 0 && (await page.evaluate(() => !!window.__where?.streetReady || !!document.querySelector('[data-tour="que-faire"]')))) break
  }
  for (let i = 0; i < warm; i++) (await tick(page), i % 20 === 0 && (await sleep(200)))
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
 * wait: a function waited for in real time (the film doesn't move meanwhile), `mark` named once done.
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
    end: [fin.from + 3.0, await endCard(1, 'Épisode 2 :<br><em>ta vie de tous<br>les jours</em>')],
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

async function episode2() {
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
    hook: [0, besoins.from - 0.25, hookCard(2, 'ta vie de tous les jours')],
    end: [fin.from + 2.6, await endCard(2, 'Épisode 3 :<br><em>ton boulot<br>et ton argent</em>')],
    layout: () => ({ subPos: 'stage' }),
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
        // In a maquis of Yopougon: « Que faire ? », a garba.
        from: maquis.from - 0.2,
        to: dormir.from - 0.2,
        open: (b) => awa(b, { at: [5.332, -4.069], place: 'yop-maquis', needs: { hunger: 18 }, hour: 13 }),
        actions: (page) => [
          [maquis.from + 1.7, { tap: () => button(page, 'Que faire ?') }],
          [maquis.from + 3.0, { tap: () => button(page, 'Manger un garba') }],
          [maquis.from + 5.6, { point: () => ring(page, 0), hold: 1.0 }],
        ],
      },
      {
        // At home in the evening: the « + », « Dormir ».
        from: dormir.from - 0.2,
        to: length,
        open: (b) => awa(b, { place: 'home', needs: { energy: 12 }, hour: 21 }),
        actions: (page) => [
          [dormir.from + 1.6, { tap: () => button(page, 'Ajouter un ordre') }],
          [dormir.from + 2.7, { tap: () => button(page, /^Dormir/) }],
          [dormir.from + 4.2, { point: () => ring(page, 1), hold: 0.8 }],
        ],
      },
    ],
  }
}
const EPISODES = { 1: episode1, 2: episode2 }

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
    const inHook = t >= ep.hook[0] && t < ep.hook[1]
    const inEnd = t >= ep.end[0]
    await draw(page, {
      ep: EP,
      ...(ep.layout?.(t, marks) ?? {}),
      step: step?.[1],
      title: step?.[2],
      sub: inEnd ? null : sub?.text,
      hook: inHook ? ep.hook[2] : null,
      hookFade: inHook ? Math.min(1, (ep.hook[1] - t) / 0.3) : 0,
      end: inEnd ? ep.end[1] : null,
      endFade: inEnd ? Math.min(1, (t - ep.end[0]) / 0.3) : 0,
      finger: { ...finger, show: finger.show && !inHook && !inEnd, press, ring },
    })
    await tick(page)
    if (!PROBE || i % FPS === 0 || i === first) await page.screenshot({ path: path.join(FRAMES, `${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92, timeout: 90000 })
    if (i % 60 === 0) console.log(`${t.toFixed(1)} s / ${ep.length.toFixed(1)}`)
  }
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
