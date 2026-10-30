// « Ta vie dans Babi Life, de bébé à adulte » (51.5 s, 1080 × 1920, 30 images a second): the real
// game filmed being played, on a machine too slow to play it (clock.mjs stops the page's clock: each
// frame is moved on by hand, then taken). A perso made for each take on a local API, its day put at ten
// in the morning: the baptism, the baby walking into the house, out in its pram, the biberon played (its
// arrows, then its game), coucou-caché, the crèche; two hours gone by and it's 3; then grown (the testers'
// toolbox) to a child answering the maître, a teen texting maman on Gbairai, the Boutique's « grandir tout
// de suite », the foot de rue (the lab), and the adult: a taxi to the Plateau, the garba at the maquis, the
// lot to build on. Each take's caption is drawn in the page over the game, clear of its own buttons; the end
// card after; the sound (beat.py, FILM=vie) and Awa's voice (out/voix-vie.mp3) under it.
// The script: marketing/scripts/vie.md; each take as long as Awa's sentences on it (out/voix-vie.mp3, 51 s).
//
// FILM=sortie: « Babi Life est sorti ! » (57 s, marketing/scripts/c-est-sorti.md, voice out/voix-sortie-officielle.mp3),
// other scenes of the real game: the city from above, the perso made, its family drawn, the baby out in its
// pram, school, the played actions (the garba, the alloco, the shower: update « gestes-maison », open on the
// API), the foot de rue (the lab, city.html?view=footrue), Yopougon, Waye, the other players there at the same
// time (connected on the live hub here), the first day's numbers, the « Inviter » app and the gift drawer.
//
//   API=http://localhost:8099/api/v1 GAME=http://localhost:5175 node vie.mjs
//   FILM=sortie node vie.mjs
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
// (PROBE=10: a frame in ten, rather than one a second.)
const PROBE_EVERY = Number(process.env.PROBE) > 1 ? Number(process.env.PROBE) : 30
const ONLY = process.env.ONLY?.split(',')
const FILM = process.env.FILM ?? 'vie'
const FRAMES = path.join(OUT, 'video-frames', FILM)
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
async function koffi({ stage = 'bebe', baptised = true, at = [5.348, -3.987], noSim = false, apps = false, name = 'Koffi' } = {}) {
  const { token } = await call(null, '/auth/dev', 'POST', { name: `${name}${Date.now().toString(36).slice(-4)}` })
  const me = await call(token, '/me')
  psql(`UPDATE users SET tester = true WHERE id = '${me.id}'`)
  if (noSim) return { token, user: await call(token, '/me'), sim: null }
  const made = await call(token, '/sims', 'POST', { firstName: name, lastName: 'Koné', gender: 'homme', look: LOOK, traits: ['ambianceur', 'sportif'], aspiration: 'ambiance', lat: at[0], lng: at[1] })
  const sim = made.sim ?? made
  psql(`UPDATE sims SET family = 'poignon', baptised = ${baptised} WHERE id = '${sim.id}'`)
  // Its day at ten in the morning (the light, the school, what's open), its age kept.
  psql(`UPDATE sims SET born_at = born_at + ((600 - game_minutes % 1440) + 1440) % 1440, game_minutes = game_minutes + ((600 - game_minutes % 1440) + 1440) % 1440 WHERE id = '${sim.id}'`)
  if (stage !== 'bebe') await call(token, `/sims/${sim.id}/tester`, 'POST', { action: 'age', stage })
  await call(token, `/sims/${sim.id}/tester`, 'POST', { action: 'needs' })
  if (apps) await call(token, `/sims/${sim.id}/tester`, 'POST', { action: 'apps' }).catch(() => undefined)
  const user = await call(token, '/me')
  return { token, user, sim }
}

/* ---------- Filming ---------- */

/** Planted in the page: a component's hooks (its state and refs, in order) found up from one of its elements, one of its states set; where a point of a little 3D table (Table3d: its camera) is on the screen. */
const PAGE_HELPERS = `(() => {
  // (Found down from the page's root as it now stands: an element's own fiber can be the old copy React keeps.)
  window.__fiber = (name) => {
    const root = document.getElementById('root')
    const key = root && Object.keys(root).find((k) => k.startsWith('__reactContainer$'))
    const stack = key ? [root[key].stateNode.current] : []
    while (stack.length) {
      const f = stack.pop()
      if (f.type?.name === name) return f
      if (f.sibling) stack.push(f.sibling)
      if (f.child) stack.push(f.child)
    }
    return null
  }
  window.__hooks = (el, name) => {
    const f = el ? window.__fiber(name) : null
    const out = []
    for (let h = f?.memoizedState; h; h = h.next) out.push(h.memoizedState)
    return out
  }
  window.__setState = (el, name, i, v) => {
    const f = el ? window.__fiber(name) : null
    let h = f?.memoizedState
    for (let k = 0; k < i && h; k++) h = h.next
    h?.queue?.dispatch(v)
  }
  window.__onScreen = (canvas, cam, look, fov, p) => {
    const r = canvas.getBoundingClientRect()
    const sub = (a, b) => a.map((v, i) => v - b[i])
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
    const unit = (a) => a.map((v) => v / Math.hypot(...a))
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
    const f = unit(sub(look, cam)), s = unit(cross(f, [0, 1, 0])), u = cross(s, f)
    const d = sub(p, cam), t = Math.tan((fov * Math.PI) / 360), z = dot(d, f)
    return [r.left + ((1 + dot(d, s) / (z * t * (r.width / r.height))) * r.width) / 2, r.top + ((1 - dot(d, u) / (z * t)) * r.height) / 2]
  }
  window.__text = (sel, text) => [...document.querySelectorAll(sel)].find((e) => e.textContent?.trim() === text)
})()`

const seen = async () => ((await call(null, '/features')).new ?? []).map((n) => n.id)

/** The game on a phone's screen (1080 × 1920), the perso's session in it, its clock stopped. */
async function open(b, k, query = '', route = '/jeu', mouse = false, geo = false, view = '') {
  // (A mouse rather than a touch screen when the take turns or pulls back the camera: the wheel and the drag are the mouse's.)
  const ctx = await b.newContext({ viewport: { width: 405, height: 720 }, deviceScaleFactor: PROBE ? 1 : 1080 / 405, ...(mouse ? {} : { isMobile: true, hasTouch: true }), ...(geo ? { geolocation: { latitude: 5.348, longitude: -3.987 }, permissions: ['geolocation'] } : {}), locale: 'fr-FR' })
  await ctx.addInitScript(
    ([token, user, seen, view]) => {
      localStorage.setItem('ivoire-life-session', JSON.stringify({ state: { token, user }, version: 0 }))
      localStorage.setItem('babi-testeur', '1')
      for (const key of ['babi.firstSteps', 'babi.tuto', 'babi.tuto.adulte', 'babi.arrivee']) localStorage.setItem(key, 'done')
      localStorage.setItem('babi.featuresSeen', JSON.stringify(seen))
      localStorage.setItem('babi.pushAsked', String(Date.now()))
      // The street's camera: close behind (« pres »), at the shoulder, or from above (« haut »).
      if (view) localStorage.setItem('babi.view', view)
    },
    [k.token, k.user, await seen(), view],
  )
  await ctx.addInitScript(STOPPED_CLOCK)
  await ctx.addInitScript(PAGE_HELPERS)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.error('page:', String(e).slice(0, 200)))
  // No « Flash info » over the takes (the country's news).
  await page.route('**/news*', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ items: [] }) }))
  await page.goto(`${GAME}${route}?hour=10${query}`)
  return { ctx, page }
}
const tick = (page, n = 1) =>
  page
    .evaluate((n) => {
      for (let i = 0; i < n; i++) window.__advance(1000 / 30)
    }, n)
    // (The dev server reloading the page under it: a moment for it to come back.)
    .catch(async (e) => {
      if (!/context was destroyed|__advance/.test(String(e))) throw e
      console.error('page reloaded')
      await sleep(3000)
    })
/** Frames on while the game loads: until the street has come (its tiles come in real time), then `frames` more. */
async function warm(page, frames) {
  await sleep(3000)
  for (let i = 0; i < 400; i++) {
    await tick(page)
    if (i % 10 === 0) await sleep(250)
    if (i > 60 && i % 10 === 0 && (await page.evaluate(() => !!window.__where?.streetReady || !!document.querySelector('.sheet')))) break
  }
  for (let i = 0; i < frames; i++) {
    await tick(page)
    if (i % 20 === 0) await sleep(200)
  }
}

/** The take's caption, drawn over the game: the stage of life and what Awa says, at the top (or at `y`: a top in px, 'bottom' or 'bottom:<px>'); a big title in the middle. */
function caption(page, stage, text, big = '', y = stage ? 96 : 142) {
  return page.evaluate(
    ([stage, text, fonts, big, y]) => {
      let el = document.getElementById('vie-cap')
      if (!el) {
        const st = document.createElement('style')
        st.textContent = `${fonts}
#vie-cap{position:fixed;inset:0;z-index:2147483647;pointer-events:none;font-family:'Nunito',sans-serif}
#vie-cap .box{position:absolute;left:16px;right:16px;display:flex;flex-direction:column;align-items:center;gap:8px}
#vie-cap .st{background:#ff7a00;color:#fff;font-family:'Baloo 2';font-weight:800;font-size:22px;padding:4px 18px;border-radius:999px;box-shadow:0 6px 18px -6px rgba(0,0,0,.5);white-space:nowrap}
#vie-cap .big{position:absolute;left:0;right:0;top:36%;text-align:center;color:#fff;font-family:'Baloo 2';font-weight:800;font-size:62px;line-height:.95;text-shadow:0 6px 0 rgba(0,0,0,.35),0 0 30px rgba(0,0,0,.4)}
#vie-cap .big em{font-style:normal;color:#ff7a00}
#vie-cap .tx{align-self:stretch;background:rgba(15,18,48,.86);color:#fff;font-weight:800;font-size:19px;line-height:1.25;text-align:center;padding:10px 14px;border-radius:18px}`
        document.head.appendChild(st)
        el = document.createElement('div')
        el.id = 'vie-cap'
        document.body.appendChild(el)
      }
      const at = String(y).startsWith('bottom') ? `bottom:${String(y).split(':')[1] ?? 22}px` : `top:${y}px`
      el.innerHTML = `${stage || text ? `<div class="box" style="${at}">${stage ? `<div class="st">${stage}</div>` : ''}${text ? `<div class="tx">${text}</div>` : ''}</div>` : ''}${big ? `<div class="big">${big}</div>` : ''}`
    },
    [stage, text, fontFaces(), big, y],
  )
}

/** One frame taken (again, if the machine was too busy to give it in time). */
async function shoot(page, dir, i) {
  for (let k = 0; ; k++) {
    try {
      return await page.screenshot({ path: path.join(dir, `${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92, timeout: 90000 })
    } catch (e) {
      if (k >= 2) throw e
    }
  }
}

/** The activity bar's clock (« Encore 5 min · fin à 10:05 » and its bar), hidden: what's waited for, not played (the crèche, the school day's start, a ride). */
const hideTimer = (page) =>
  page.evaluate(() => {
    for (const el of document.querySelectorAll('.card div')) {
      if (!/^(Encore .*fin à|Le chauffeur arrive|Il t’attend|Tu montes)/.test(el.textContent ?? '') || el.children.length) continue
      el.style.visibility = 'hidden'
      if (el.previousElementSibling?.classList.contains('overflow-hidden')) el.previousElementSibling.style.visibility = 'hidden'
    }
  })

/** In the house: the camera kept over the perso as it walks about (above and behind, the walls cut as the game cuts them). */
const homeFollow = (page) =>
  page.evaluate(() => {
    const hm = globalThis.__home
    let me
    hm?.scene.traverse((o) => o.name === 'me' && (me = o))
    if (!me) return
    const v = me.getWorldPosition(me.position.clone())
    hm.controls.target.set(v.x, 0.6, v.z)
    hm.camera.position.set(v.x + 1.4, 4.6, v.z + 2.6)
    hm.controls.update()
  })

/** Come into the house: the perso walked in from the gate (past the fence), the camera with it. */
async function walkIn(page, frames = 90) {
  await page.keyboard.down('ArrowUp')
  for (let i = 0; i < frames; i++) (await homeFollow(page), await tick(page), i % 20 === 0 && (await sleep(100)))
}

/** Inside the home: the camera pulled back (the wheel), so the room, the baby and maman are seen whole, from above as the game shows it. */
async function frameInside(page) {
  await page.mouse.move(202, 400)
  for (let i = 0; i < 4; i++) (await page.mouse.wheel(0, 240), await tick(page, 3))
  await tick(page, 20)
}

/** Takes `frames` frames, doing each thing at its frame (and `each` before every frame, for what reacts to the game). */
async function film(page, dir, frames, at = {}, each) {
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  for (let i = 0; i < frames; i++) {
    if (at[i]) await at[i]().catch((e) => console.error(path.basename(dir), i, String(e).slice(0, 160)))
    if (each) await each(i).catch(() => undefined)
    await tick(page)
    if (!PROBE || i % PROBE_EVERY === 0 || i === frames - 1) await shoot(page, dir, i)
  }
}

/**
 * A tap on a button, as a finger does it (pointer down, up, click), sent in the page: Playwright's own
 * click waits for the button to hold still over animation frames, and the stopped clock gives none.
 */
const tap = (loc) =>
  loc.first().evaluate((el) => {
    const o = { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, pointerType: 'touch' }
    el.dispatchEvent(new PointerEvent('pointerdown', o))
    el.dispatchEvent(new PointerEvent('pointerup', o))
    el.click()
  }, null, { timeout: 4000 })
const click = (page, name) => () => tap(page.getByRole('button', { name }))

/* ---------- The takes ---------- */

/** A home gesture's arrows (GestesDefi: each step's combination, pressed one a few frames apart), then its own game held and let go in the green (the « tenir » engine). */
function homeGeste(p) {
  let last = -99
  let held = false
  return async (i) => {
    const dir = await p.evaluate(() => {
      const [steps, k, got] = window.__hooks(document.body, 'GestesDefi')
      return steps?.[k]?.combo[got] ?? null
    })
    if (dir) {
      if (i - last >= 4) (last = i), await press(p, `Arrow${dir[0].toUpperCase()}${dir.slice(1)}`)
      return
    }
    // The game: held, let go when it says so.
    const label = await p.evaluate(() => [...document.querySelectorAll('.z-50 button')].map((b) => b.textContent?.trim() ?? '').find((t) => /\(tiens\)|^Lâche|^Trop|…$/.test(t)) ?? null)
    if (!label) return
    const ev = (type) =>
      p.evaluate((type) => {
        const b = [...document.querySelectorAll('.z-50 button')].find((b) => /\(tiens\)|^Lâche|^Trop|…$/.test(b.textContent?.trim() ?? ''))
        b?.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, pointerType: 'touch' }))
      }, type)
    if (!held && /\(tiens\)/.test(label) && i - last >= 8) (held = true), await ev('pointerdown')
    else if (held && /^Lâche/.test(label)) (held = false), (last = i), await ev('pointerup')
  }
}

/** The maître's question: the right answer touched (the game's own, read from the lesson), a moment after it's asked. */
function rightAnswer(p) {
  let asked = -1
  let seen = -1
  return async (i) => {
    const s = await p.evaluate(() => {
      const el = [...document.querySelectorAll('.z-50 button.tile')][0]
      if (!el) return null
      const h = window.__hooks(el, 'EcoleDefi')
      const qs = h[0]?.[0]
      return qs ? { k: h[1], ok: qs[h[1]].ok, chose: h[3] } : null
    })
    if (!s || s.chose !== null) return
    if (s.k !== seen) (seen = s.k), (asked = i)
    if (i - asked === 14) await p.evaluate((ok) => document.querySelectorAll('.z-50 button.tile')[ok]?.click(), s.ok)
  }
}

/** Typed into the chat a few letters a frame, then sent. */
function typeAndSend(p, text, from) {
  return async (i) => {
    const n = Math.min(text.length, (i - from) * 3)
    if (i < from || n <= 0) return
    const box = p.getByPlaceholder('Message')
    if (n < text.length || i === from + Math.ceil(text.length / 3)) await box.fill(text.slice(0, n)).catch(() => undefined)
    if (i === from + Math.ceil(text.length / 3) + 4) await tap(p.getByRole('button', { name: 'Envoyer' }))
  }
}

const BEBE = 'BÉBÉ'
// « De bébé à adulte », on Awa's voice (out/voix-vie.mp3, 51 s): each take as long as its sentence (measured
// with Whisper); the end card over the last line.
const VIE = [
  {
    id: 'bapteme',
    seconds: 3.2,
    make: () => koffi({ baptised: false }),
    warm: 160,
    stage: BEBE,
    text: 'Tu viens d’arriver dans Babi Life… et tu es un bébé.',
  },
  {
    id: 'maison',
    seconds: 4.4,
    // Come into the house (nothing being done): the baby toddles in, the camera over it.
    make: () => koffi(),
    query: '&place=home',
    warm: 200,
    before: walkIn,
    settle: 0,
    stage: BEBE,
    text: 'Pourquoi tu commences bébé ? Ce n’est pas un bug : c’est voulu.',
    at: (p) => ({ 40: () => p.keyboard.up('ArrowUp') }),
    each: (p) => () => homeFollow(p),
  },
  {
    id: 'poussette',
    seconds: 4.2,
    make: () => koffi(),
    warm: 220,
    stage: BEBE,
    text: 'Comme dans la vraie vie, tout commence là, et ce que tu vis bébé compte pour la suite.',
    // Out in the pram with maman, along the street (stopped before the wall ahead), the camera turned round them.
    turn: 0.5,
    at: (p) => ({ 2: () => p.keyboard.down('ArrowUp'), 50: () => p.keyboard.up('ArrowUp') }),
  },
  {
    id: 'biberon',
    seconds: 4.4,
    // The biberon played: its arrows (the baby takes it, drinks, the burp), then its game (hold to drink, let go in the green).
    make: async () => {
      const k = await koffi()
      await call(k.token, `/sims/${k.sim.id}/interact`, 'POST', { placeId: 'home', interactionId: 'biberon' })
      return k
    },
    warm: 200,
    text: 'Il a faim ? Biberon ! Sommeil ? Au berceau. Il pleure ? Un câlin.',
    // (Over the game's own card.)
    capY: 40,
    at: (p) => ({ 4: click(p, /C.est parti/) }),
    // The house seen from a little above the baby and maman (not straight down from the ceiling).
    each: (p) => {
      const play = homeGeste(p)
      return async (i) => (await homeFollow(p), await play(i))
    },
  },
  {
    id: 'coucou',
    seconds: 3.6,
    make: async () => {
      const k = await koffi()
      await call(k.token, `/sims/${k.sim.id}/interact`, 'POST', { placeId: 'home', interactionId: 'coucou' })
      return k
    },
    warm: 200,
    stage: BEBE,
    text: 'Des petits jeux : coucou-caché, les cubes, les premiers pas…',
    // (The baby's games wait for their button: no clock on them.)
    at: (p) => ({ 2: click(p, /coucou-caché/i), 16: click(p, /C.est parti/) }),
    // Laughing a moment after maman's hands open (« Coucou ! » on the screen).
    each: (p) => {
      let seenAt = -1
      return async (i) => {
        const open = await p.getByText('Coucou !', { exact: true }).count()
        if (!open) return void (seenAt = -1)
        if (seenAt < 0) seenAt = i
        if (i - seenAt === 7) await tap(p.getByRole('button', { name: 'Rire !' }))
      }
    },
  },
  {
    id: 'creche',
    seconds: 2.4,
    make: async () => {
      const k = await koffi()
      await call(k.token, `/sims/${k.sim.id}/interact`, 'POST', { placeId: 'home', interactionId: 'creche' })
      return k
    },
    warm: 200,
    stage: BEBE,
    text: 'Et la crèche, avec les bébés des autres joueurs.',
    each: (p) => () => hideTimer(p),
  },
  {
    id: 'grandir',
    seconds: 2.4,
    // Two hours of play gone by (its birth put back two hours): the game sees it as soon as it asks again, and the baby is a child.
    make: () => koffi(),
    query: '&place=home',
    warm: 200,
    before: async (p) => (await walkIn(p, 110), await p.keyboard.up('ArrowUp')),
    settle: 0,
    stage: BEBE,
    text: 'Deux heures de jeu, et hop…',
    each: (p) => () => homeFollow(p),
    at: (p, k) => ({
      10: async () => {
        psql(`UPDATE sims SET born_at = game_minutes - 121 WHERE id = '${k.sim.id}'`)
        await p.evaluate((sim) => window.dispatchEvent(new CustomEvent('babi:sim-changed', { detail: sim })), k.sim.id)
      },
      30: () => caption(p, 'ENFANT · 3 ANS', 'Deux heures de jeu, et hop…', 'tu as<br><em>3 ans !</em>', 96),
    }),
  },
  {
    id: 'ecole',
    seconds: 4.2,
    // School is in the morning: the day's activity started as « Jouer dans la cour », then made the school day.
    make: async () => {
      const k = await koffi({ stage: 'enfant' })
      await call(k.token, `/sims/${k.sim.id}/interact`, 'POST', { placeId: 'home', interactionId: 'jouer-cour' })
      psql(`UPDATE sims SET activity = jsonb_set(jsonb_set(jsonb_set(activity, '{interaction,id}', '"aller-ecole"'), '{interaction,label}', '"Aller à l''école"'), '{interaction,icon}', '"school"') WHERE id = '${k.sim.id}'`)
      return k
    },
    warm: 200,
    stage: 'ENFANT',
    text: 'Enfant, c’est l’école : la classe, la récré, le maître qui te pose des questions.',
    // (Over the classroom, then under the blackboard and its answers.)
    at: (p) => ({
      30: click(p, /Lever la main/),
      46: async () => (await click(p, /C.est parti/)(), await caption(p, 'ENFANT', 'Enfant, c’est l’école : la classe, la récré, le maître qui te pose des questions.', '', 'bottom')),
    }),
    each: (p) => {
      const answer = rightAnswer(p)
      return async (i) => (await hideTimer(p), await answer(i))
    },
  },
  {
    id: 'ado',
    seconds: 4,
    // The phone on Gbairai: maman's chat, a message written to her, her answer coming.
    make: () => koffi({ stage: 'ado' }),
    query: '&app=gbairai',
    warm: 200,
    stage: 'ADO · 12 ANS',
    text: 'Ado, ton premier téléphone : Gbairai pour causer.',
    // (Low, over the empty end of the chat: clear of its messages and of the box where it's typed.)
    capY: 'bottom:70',
    // Maman's chat opened before the take, so the game asks for her answer again (every 4 s) just after it's sent.
    before: (p) => tap(p.getByRole('button', { name: /maman/i })),
    settle: 88,
    each: (p) => typeAndSend(p, 'Maman, je rentre après le foot !', 2),
  },
  {
    id: 'boutique',
    seconds: 6,
    make: () => koffi(),
    query: '&app=boutique',
    warm: 200,
    stage: 'PRESSÉ·E ?',
    text: 'Va dans la Boutique : enfant, ado ou adulte tout de suite. Tu paies une fois.',
    capY: 'bottom',
    at: (p) => ({
      6: click(p, /18 ans ou plus/),
      // Down the shop, slowly: growing up at once, then the Djai.
      ...Object.fromEntries([...Array(60)].map((_, k) => [70 + k, () => p.evaluate(() => [...document.querySelectorAll('.overflow-y-auto')].find((e) => e.textContent?.includes('Boutique'))?.scrollBy(0, 3))])),
    }),
  },
  {
    id: 'foot',
    seconds: 1.6,
    // « … accès à tout le jeu » : the foot de rue (the lab), the Gbê and the goal (the end of the moves' take).
    filmed: 4.8,
    keep: [[86, 134]],
    make: () => koffi({ noSim: true }),
    route: '/city.html',
    query: '&view=footrue',
    warm: 120,
    text: '… et tu as accès à tout le jeu.',
    before: footStart,
    settle: 0,
    at: (p) => ({ 0: () => p.keyboard.down('ArrowUp'), 140: () => p.keyboard.up('ArrowUp') }),
    each: footMoves,
  },
  {
    id: 'taxi',
    seconds: 3.2,
    // A taxi to the Plateau: it pulls up at the kerb, the perso gets in, the loading screen, then set down there.
    filmed: 16,
    // (Its frames as they fell on the last run: pulled up by the perso, the loading screen, out at the Plateau's kerb.)
    keep: [[84, 124], [190, 206], [324, 364]],
    make: async () => {
      const k = await koffi({ stage: 'adulte' })
      await call(k.token, `/sims/${k.sim.id}/travel`, 'POST', { city: 'abidjan', commune: 'plateau', app: 'compteur' })
      return k
    },
    // (Filmed as soon as the street is there: the taxi pulling up comes at once.)
    warm: 0,
    stage: 'ADULTE · 18 ANS',
    text: 'Adulte, c’est la vraie vie d’Abidjan : ton boulot, ton argent…',
    each: (p) => () => hideTimer(p),
  },
  {
    id: 'sortie',
    seconds: 0.8,
    // At the maquis, the garba: the hand fishes out the called piece.
    make: async () => {
      const k = await koffi({ stage: 'adulte' })
      await call(k.token, `/sims/${k.sim.id}/interact`, 'POST', { placeId: 'cocody-danga', interactionId: 'eat-garba' })
      return k
    },
    warm: 200,
    before: async (p) => {
      await click(p, /C.est parti/)()
      await tick(p, 20)
    },
    settle: 0,
    text: '… tes sorties…',
    each: garba,
  },
  {
    id: 'construire',
    seconds: 1.2,
    // At home: « Modifier la maison », the house to build.
    make: () => koffi({ stage: 'adulte' }),
    query: '&place=home',
    warm: 200,
    text: '… ta maison à construire.',
    at: (p) => ({ 3: click(p, /Modifier la maison/) }),
  },
]

/**
 * The other players there at the same time: a few persos of the commune connected to the live hub
 * from here, walking round the filmed one in the street (their states, as a phone sends them).
 */
async function crowd(page, n = 4) {
  const at = await page.evaluate(() => window.__where?.sim ?? [0, 0])
  const names = ['Aya', 'Bema', 'Fanta', 'Yao', 'Mariam']
  const socks = []
  for (let i = 0; i < n; i++) {
    const k = await koffi({ stage: 'adulte', name: names[i % names.length] })
    psql(`UPDATE sims SET last_tick = now() WHERE id = '${k.sim.id}'`)
    const ws = new WebSocket(API.replace(/^http/, 'ws') + '/live')
    await new Promise((r) => (ws.onopen = r))
    ws.send(JSON.stringify({ t: 'hello', token: k.token, sim: k.sim.id, mode: 'open' }))
    const a0 = (i / n) * Math.PI * 2
    let t = 0
    const step = setInterval(() => {
      t += 0.2
      const a = a0 + t * 0.15
      const r = 4 + i
      ws.readyState === 1 && ws.send(JSON.stringify({ t: 'state', x: at[0] + Math.cos(a) * r, y: 0, z: at[1] + Math.sin(a) * r, h: a + Math.PI / 2, p: 'walk' }))
    }, 200)
    socks.push(() => (clearInterval(step), ws.close()))
  }
  return () => socks.forEach((f) => f())
}

/* ---------- The played actions (update « gestes-maison »), played here as a finger would ---------- */

/** A tap where the finger goes on the screen (sent in the page: quick taps on one spot aren't taken for a double tap). */
const touch = (page, at) =>
  at &&
  page.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x, y)
    const o = { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, isPrimary: true, pointerType: 'touch' }
    el?.dispatchEvent(new PointerEvent('pointerdown', o))
    el?.dispatchEvent(new PointerEvent('pointerup', o))
  }, at)
/** A key pressed and let go over one frame. */
async function press(page, key) {
  await page.keyboard.down(key)
  await tick(page)
  await page.keyboard.up(key)
}

/**
 * Le garba: at the bassine, the piece the tantie calls fished out of the oil (a tap on it, before the
 * other customers' hands), three times; then the plate, the attiéké « pommé » in the hand (held, let go in the green).
 */
function garba(p) {
  let picked = -99
  let held = -1
  return async (i) => {
    const at = await p.evaluate(() => {
      const el = window.__text('.label', 'La tantie')
      if (!el) return null
      const h = window.__hooks(el, 'Pan')
      const pieces = h.find((v) => Array.isArray(v) && v[0]?.kind)
      const want = h.find((v) => ['thon', 'chinchard', 'carpe', 'tete'].includes(v))
      const busy = h.find((v) => typeof v?.current === 'object' && v.current && 'busy' in v.current)?.current.busy
      const q = pieces?.find((x) => x.kind === want)
      return q && !busy ? window.__onScreen(el.closest('.absolute').querySelector('canvas'), [0, 7, 3.4], [0, 0, 0.2], 40, [(q.x - 0.5) * 6, 0.35, (q.y - 0.5) * 6]) : null
    })
    if (at && i - picked >= 12) return void ((picked = i), await touch(p, at))
    // The plate: Pommer held about 0.6 s (in the green), let go, again.
    const pommer = p.getByRole('button', { name: /^Pomm|Lâche|Trop serré/ })
    if (!at && (await pommer.count())) {
      const ev = (type) => pommer.first().evaluate((el, type) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, pointerType: 'touch' })), type)
      if (held < 0 && i - picked > 20) (held = i), await ev('pointerdown')
      else if (held >= 0 && i - held >= 19) (held = -1), (picked = i - 14), await ev('pointerup')
    }
  }
}

/** L'alloco: the paper slid under the slice that lands first (a finger on it, a little at a time). */
const underAlloco = (p) =>
  p.evaluate(() => {
    const el = window.__text('div', 'Attrape ton alloco !')
    if (!el) return
    const h = window.__hooks(el, 'Catch')
    const st = h.find((v) => typeof v?.current === 'object' && v.current && 'paper' in v.current)?.current
    const live = h.find((v) => Array.isArray(v?.current))?.current
    const next = live?.filter((d) => d.y < 0.82).sort((a, b) => b.y - a.y)[0]
    if (!st || !next) return
    const to = st.paper + Math.max(-0.07, Math.min(0.07, next.x - st.paper))
    const box = el.closest('.absolute').querySelector('.touch-none')
    const r = box.getBoundingClientRect()
    box.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: r.left + to * r.width, clientY: r.top + r.height * 0.8, pointerId: 1, pointerType: 'touch', isPrimary: true }))
  })

/** Under the shower: the next part of the body rubbed with the soap (three times each), then each bit of foam rinsed. */
function shower(p) {
  const done = new Set()
  return async () => {
    const at = await p.evaluate((done) => {
      const el = window.__text('.font-display', 'Sous la douche')
      if (!el) return null
      const h = window.__hooks(el, 'DoucheJeu')
      const rubs = h[0] ?? {}
      const foam = h[1] ?? []
      const zones = [['tete', [0, 1.95, 0.35]], ['bras-g', [-0.42, 1.3, 0.2]], ['bras-d', [0.42, 1.3, 0.2]], ['ventre', [0, 1.25, 0.3]], ['jambes', [0, 0.55, 0.27]]]
      const next = zones.find(([id]) => (rubs[id] ?? 0) < 3)
      const blob = next ? null : foam.find((f) => !done.includes(f.key))
      const where = next ? next[1] : blob?.p
      if (!where) return null
      return { key: blob?.key, at: window.__onScreen(el.closest('.absolute').querySelector('canvas'), [0, 1.6, 4.2], [0, 1.15, 0], 38, where) }
    }, [...done])
    if (!at) return
    if (at.key !== undefined) done.add(at.key)
    await touch(p, at.at)
  }
}

/* ---------- Le foot de rue (update « foot-de-rue »), in the lab: the perso's moves at its keys ---------- */

/** The ball at the perso's feet, the other side's men in front, coming. */
function footStart(p) {
  return p.evaluate(() => {
    const g = globalThis.streetMatch
    const me = g.ps[g.me]
    me.face = Math.PI / 2
    g.ball.owner = me.id
    g.ball.x = me.x + 0.4
    g.ball.z = me.z
    g.ps.filter((q) => q.team !== me.team && !q.keeper && !q.out).forEach((q, k) => Object.assign(q, { x: me.x + 5 + k * 4.5, z: me.z + (k % 2 ? 1.5 : -0.3), vx: 0, vz: 0, act: 'none' }))
  })
}

/**
 * The ball given to the perso, a man coming at it: a petit pont (I), then a sombrero (O) on the next
 * one, each when he's at the right distance; the ball got back after each, and the gauge full, the Gbê (Space) at goal.
 */
function footMoves(p) {
  const moves = ['KeyI', 'KeyO']
  let gbe = false
  return async (i) => {
    const s = await p.evaluate((gbe) => {
      const g = globalThis.streetMatch
      if (!g) return null
      const me = g.ps[g.me]
      const b = g.ball
      let d = 9
      for (const q of g.ps) {
        if (q.team === me.team || q.keeper || q.out) continue
        const e = Math.hypot(q.x - me.x, q.z - me.z)
        if ((q.x - me.x) / e > 0.35 && e < d) d = e
      }
      // (The ball loose or taken after a move: back at its feet, the take is the moves.)
      if (!gbe && b.owner !== me.id && me.act === 'none' && (b.owner < 0 || g.ps[b.owner].team !== me.team) && Math.hypot(b.x - me.x, b.z - me.z) < 3) b.owner = me.id
      return { d, has: b.owner === me.id, free: me.act === 'none', x: me.x, end: g.field.x }
    }, gbe)
    if (!s?.has || !s.free) return
    // The move beats its man (the game's dice, for that one move).
    const lucky = (r) => p.evaluate((r) => {
      const g = globalThis.streetMatch
      const rnd = g.rnd
      g.rnd = () => r
      setTimeout(() => (g.rnd = rnd), 100)
    }, r)
    if (moves.length && s.d > 1.1 && s.d < 2) return void (await lucky(0.05), await press(p, moves.shift()))
    if (!moves.length && !gbe && (s.x > s.end - 7 || i > 100)) {
      gbe = true
      await p.evaluate(() => (globalThis.streetMatch.ps[globalThis.streetMatch.me].style = 1))
      await lucky(0.3)
      await press(p, 'Space')
    }
  }
}

/** A friend come by the perso's link, its gift wrapped in the drawer (backend sims/parrainage.go: here written in, no 30 minutes of play waited). */
async function friends(k, names) {
  const { code } = await call(k.token, `/sims/${k.sim.id}/parrainage`)
  for (const name of names) {
    const f = await call(null, `/auth/dev?p=${code}`, 'POST', { name: `${name}${Date.now().toString(36).slice(-4)}` })
    const me = await call(f.token, '/me')
    psql(`UPDATE users SET tester = true WHERE id = '${me.id}'`)
    await call(f.token, '/sims', 'POST', { firstName: name, lastName: 'Kouassi', gender: 'femme', look: LOOK, traits: ['ambianceur'], aspiration: 'ambiance', lat: 5.348, lng: -3.987 })
    psql(`INSERT INTO referral_gifts (user_id, friend_id, friend_name) VALUES ('${k.user.id}', '${me.id}', '${name}')`)
  }
  return k
}

// « Babi Life est sorti ! », on Awa's voice (out/voix-sortie-officielle.mp3, 55.95 s): each take as long as its
// sentence (where it starts and ends in the take, measured with Whisper), the end card over the last one.
const SORTIE = [
  {
    id: 'ville',
    seconds: 3.4,
    make: () => koffi({ stage: 'adulte', at: [5.3237, -4.0197] }),
    warm: 200,
    big: 'C’EST<br><em>SORTI !</em>',
    // High over the Plateau: the wheel out, the camera turned slowly.
    zoom: 9,
    turn: 0.5,
  },
  {
    id: 'rue',
    seconds: 2.5,
    make: () => koffi({ stage: 'adulte', at: [5.3237, -4.0197] }),
    warm: 200,
    text: 'Le jeu de la vie à Abidjan, dans ton téléphone.',
    at: (p) => ({ 2: () => p.keyboard.down('ArrowUp'), 74: () => p.keyboard.up('ArrowUp') }),
    turn: 0.3,
  },
  {
    id: 'creation',
    seconds: 1.1,
    make: () => koffi({ noSim: true }),
    route: '/creer',
    warm: 60,
    text: 'Tu crées ton perso…',
    at: (p) => ({ 2: click(p, /Perso au hasard/), 18: click(p, /Perso au hasard/) }),
  },
  {
    id: 'naissance',
    seconds: 3.5,
    make: () => koffi({ noSim: true }),
    route: '/creer',
    warm: 60,
    // (Its position shared: born at once, in Cocody.)
    geo: true,
    // The families and their chances first, then « Naître »: the family drawn, its home, as the game shows it.
    before: async (p) => {
      await click(p, /Naissance/)()
      await tick(p, 5)
      await p.getByText(/des naissances/).first().evaluate((el) => el.scrollIntoView({ block: 'center' }))
    },
    text: '… et le sort choisit ta famille : gnambro, poignon ou laté !',
    at: (p) => ({ 40: click(p, /^Naître/) }),
  },
  {
    id: 'poussette',
    seconds: 1.9,
    make: () => koffi(),
    warm: 200,
    stage: 'BÉBÉ',
    text: 'Tu commences bébé, tu grandis…',
    at: (p) => ({ 2: () => p.keyboard.down('ArrowUp'), 45: () => p.keyboard.up('ArrowUp') }),
  },
  {
    id: 'ecole',
    seconds: 3.1,
    // School is in the morning: the day's activity started as « Jouer dans la cour », then made the school day.
    make: async () => {
      const k = await koffi({ stage: 'enfant' })
      await call(k.token, `/sims/${k.sim.id}/interact`, 'POST', { placeId: 'home', interactionId: 'jouer-cour' })
      psql(`UPDATE sims SET activity = jsonb_set(jsonb_set(jsonb_set(activity, '{interaction,id}', '"aller-ecole"'), '{interaction,label}', '"Aller à l''école"'), '{interaction,icon}', '"school"') WHERE id = '${k.sim.id}'`)
      return k
    },
    warm: 200,
    stage: 'ENFANT',
    text: 'L’école, les amis, puis la vraie vie à 18 ans.',
    at: (p) => ({
      40: click(p, /Lever la main/),
      58: click(p, /C.est parti/),
      // An answer touched, the maître's question on the board (whichever it is).
      80: () =>
        p.evaluate(() => {
          const answers = [...document.querySelectorAll('button')].filter((b) => {
            const r = b.getBoundingClientRect()
            return r.height > 0 && r.top > 250 && r.top < 620 && b.innerText.trim().length > 2 && !/Lever|Phone|Carte|Voir|Rire|parti/.test(b.innerText)
          })
          ;(answers[1] ?? answers[0])?.click()
        }),
    }),
  },
  {
    id: 'garba',
    seconds: 5,
    // At the maquis of Danga: the garba ordered, its game opens over the room.
    make: async () => {
      const k = await koffi({ stage: 'adulte' })
      await call(k.token, `/sims/${k.sim.id}/interact`, 'POST', { placeId: 'cocody-danga', interactionId: 'eat-garba' })
      return k
    },
    warm: 200,
    text: 'Chaque action est un jeu : tu pioches ton poisson dans l’huile du garba…',
    at: (p) => ({ 12: click(p, /C.est parti/) }),
    each: garba,
  },
  {
    id: 'alloco',
    seconds: 1.8,
    // At the market of Cocody: the tantie's alloco, already being caught when the take starts.
    make: async () => {
      const k = await koffi({ stage: 'adulte' })
      await call(k.token, `/sims/${k.sim.id}/interact`, 'POST', { placeId: 'cocody-marche', interactionId: 'eat-alloco' })
      return k
    },
    warm: 200,
    before: async (p) => {
      await click(p, /C.est parti/)()
      await tick(p, 10)
      await click(p, /Non merci/)()
      for (let i = 0; i < 120; i++) (await underAlloco(p), await tick(p), i % 20 === 0 && (await sleep(100)))
    },
    settle: 0,
    text: '… tu attrapes ton alloco dans le papier…',
    each: (p) => () => underAlloco(p),
  },
  {
    id: 'douche',
    seconds: 1.4,
    // The shower's own game, in the lab (gestes.html: the same component over a plain wall; in the house, its
    // getting ready walks the perso from step to step for minutes at this film's pace): most of the soap on
    // before the take, then the rinse.
    make: () => koffi({ noSim: true }),
    route: '/gestes.html',
    query: '&g=laver',
    warm: 60,
    // The soap on, every part foaming (its state set: quick rubs here would each count once), then the rinse played.
    before: (p) =>
      p.evaluate(() => {
        const el = window.__text('.font-display', 'Sous la douche')
        const zones = [['tete', [0, 1.95, 0.1], [0.55, 0.45, 0.55]], ['bras-g', [-0.42, 1.3, 0.05], [0.3, 0.6, 0.35]], ['bras-d', [0.42, 1.3, 0.05], [0.3, 0.6, 0.35]], ['ventre', [0, 1.25, 0.15], [0.5, 0.5, 0.3]], ['jambes', [0, 0.55, 0.12], [0.5, 0.7, 0.3]]]
        const foam = zones.flatMap(([zone, at, size], z) => [0, 1, 2].map((r) => {
          const k = z * 3 + r
          return { key: k, zone, p: [at[0] + Math.sin(k * 2.1) * size[0] * 0.35, at[1] + Math.cos(k * 1.7) * size[1] * 0.3, at[2] + size[2] * 0.5], s: 0.8 + (k % 3) * 0.2 }
        }))
        window.__setState(el, 'DoucheJeu', 1, foam)
        window.__setState(el, 'DoucheJeu', 0, Object.fromEntries(zones.map(([id]) => [id, 3])))
        window.__hooks(el, 'DoucheJeu')[3].current.key = foam.length
      }),
    settle: 0,
    text: '… tu te savonnes sous la douche !',
    each: (p) => {
      const rub = shower(p)
      return async (i) => i % 2 === 0 && (await rub())
    },
  },
  {
    id: 'foot',
    seconds: 4.8,
    make: () => koffi({ noSim: true }),
    route: '/city.html',
    query: '&view=footrue',
    warm: 120,
    text: 'Au quartier, le foot de rue : petit pont, sombrero… et la frappe Gbê !',
    before: footStart,
    settle: 0,
    at: (p) => ({ 0: () => p.keyboard.down('ArrowUp'), 140: () => p.keyboard.up('ArrowUp') }),
    each: footMoves,
  },
  {
    id: 'yop',
    seconds: 5.7,
    make: () => koffi({ stage: 'adulte', at: [5.3364, -4.0866] }),
    warm: 220,
    text: 'Les vrais quartiers d’Abidjan : Yop, Cocody, le Plateau… le gbaka, le maquis, le boulot.',
    zoom: 3,
    turn: 0.6,
    at: (p) => ({ 2: () => p.keyboard.down('ArrowUp'), 160: () => p.keyboard.up('ArrowUp') }),
  },
  {
    id: 'waye',
    seconds: 3.7,
    make: () => koffi({ stage: 'adulte', apps: true }),
    warm: 200,
    text: 'Ton téléphone dans le jeu : Gbairai pour causer, Waye pour l’argent.',
    at: (p) => ({
      4: () => tap(p.locator('[data-tour="phone"]')),
      // Waye's tile, wherever it is on the phone's pages.
      40: () =>
        p.evaluate(() => {
          const el = [...document.querySelectorAll('button, a, [role="button"]')].find((b) => b.textContent?.trim() === 'Waye')
          el?.scrollIntoView({ inline: 'center', block: 'center' })
          ;(el)?.click()
        }),
    }),
  },
  {
    id: 'joueurs',
    seconds: 3.1,
    make: () => koffi({ stage: 'adulte' }),
    warm: 200,
    live: (p) => crowd(p),
    text: 'Et surtout : tous les joueurs sont là, en vrai, au même moment.',
    at: (p) => ({ 40: () => tap(p.locator('button.hud:has(svg.lucide-users)')), 70: click(p, /Tout Babi/) }),
  },
  // The first day's numbers, big over the city (« en moins de vingt-quatre heures… »).
  {
    id: 'comptes',
    seconds: 2.9,
    make: () => koffi({ stage: 'adulte', at: [5.3237, -4.0197] }),
    warm: 200,
    big: '345 comptes<br><em>en moins de 24 h</em>',
    zoom: 8,
    turn: 0.4,
  },
  {
    id: 'connectes',
    seconds: 2.2,
    make: () => koffi({ stage: 'adulte' }),
    warm: 200,
    live: (p) => crowd(p),
    big: '129 déjà<br><em>dans la ville</em>',
    zoom: 4,
    turn: 0.3,
  },
  // Inviting one's friends (update « parrainage »): the phone's « Inviter », then the drawer at home.
  {
    id: 'invite',
    seconds: 2.3,
    make: async () => friends(await koffi({ stage: 'adulte', apps: true }), ['Aya', 'Fanta', 'Yao']),
    query: '&app=inviter',
    warm: 200,
    text: 'Invite tes amis avec ton lien : chaque ami qui s’inscrit…',
    at: (p) => ({ 40: () => p.evaluate(() => document.querySelector('.overflow-y-auto:has(.space-y-4)')?.scrollBy({ top: 220, behavior: 'instant' })) }),
    // The link as the players see it (the game's own address, not this dev server's).
    each: (p) => () =>
      p.evaluate((game) => {
        const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
        for (let n = w.nextNode(); n; n = w.nextNode()) if (n.nodeValue.includes(game)) n.nodeValue = n.nodeValue.replace(game, 'lifeinbabi.com')
      }, new URL(GAME).host),
  },
  {
    id: 'tiroir',
    seconds: 2.7,
    make: async () => friends(await koffi({ stage: 'adulte' }), ['Mariam', 'Bema']),
    query: '&place=home',
    warm: 200,
    text: '… c’est un cadeau pour toi, qui t’attend dans ton tiroir !',
    at: (p) => ({ 6: () => tap(p.getByRole('button', { name: /Tiroir à cadeaux/ })), 30: click(p, /Ouvrir/) }),
  },
]
const TAKES = FILM === 'sortie' ? SORTIE : VIE
const END = FILM === 'sortie' ? { seconds: 6, title: 'C’est sorti !<br><em>Joue maintenant</em>' } : { seconds: 5.9, title: 'Ta vie, c’est toi<br>qui l’<em>écris</em>' }

/* ---------- The end card ---------- */

async function endCard(b, dir, frames, title) {
  const qr = await QRCode.toDataURL(`https://lifeinbabi.com/?src=video-${FILM}`, { margin: 1, width: 440, color: { dark: BRAND.ink, light: '#ffffff' } })
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
<h1>${title}</h1>
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
  const { ctx, page } = await open(b, k, t.query ?? '', t.route, !!(t.zoom || t.turn), t.geo, t.view)
  await warm(page, t.warm)
  if (t.before) {
    await t.before(page).catch((e) => console.error(t.id, 'before', String(e).slice(0, 160)))
    for (let i = 0; i < (t.settle ?? 60); i++) (await tick(page), i % 20 === 0 && (await sleep(200)))
  }
  if (t.inside) await frameInside(page).catch((e) => console.error(t.id, 'inside', String(e).slice(0, 160)))
  if (t.zoom) {
    await page.mouse.move(202, 360)
    for (let i = 0; i < t.zoom; i++) (await page.mouse.wheel(0, 260), await tick(page, 3))
    await tick(page, 15)
  }
  const stopLive = t.live ? await t.live(page).catch((e) => (console.error(t.id, 'live', String(e).slice(0, 160)), null)) : null
  if (stopLive) for (let i = 0; i < 40; i++) (await tick(page), await sleep(100))
  await caption(page, t.stage, t.text, t.big, t.capY ?? (t.stage ? 96 : 142))
  // The camera turned slowly while it's taken (a drag across), when the take asks for it.
  if (t.turn) (await page.mouse.move(150, 300), await page.mouse.down())
  const turn = t.turn ? async (i) => page.mouse.move(150 + i * t.turn, 300) : undefined
  const each = t.each?.(page, k)
  const dir = path.join(FRAMES, t.id)
  await film(page, dir, Math.round((t.filmed ?? t.seconds) * FPS), t.at?.(page, k) ?? {}, each || turn ? async (i) => (await each?.(i), await turn?.(i)) : undefined)
  // A take filmed longer than it's shown: only its kept stretches, one after the other.
  if (t.keep && !PROBE) {
    const kept = t.keep.flatMap(([a, b]) => [...Array(b - a)].map((_, j) => a + j))
    kept.forEach((f, j) => fs.renameSync(path.join(dir, `${String(f).padStart(5, '0')}.jpg`), path.join(dir, `k${String(j).padStart(5, '0')}.jpg`)))
    for (const f of fs.readdirSync(dir)) if (!f.startsWith('k')) fs.rmSync(path.join(dir, f))
    for (const f of fs.readdirSync(dir)) fs.renameSync(path.join(dir, f), path.join(dir, f.slice(1)))
  }
  if (t.turn) await page.mouse.up()
  stopLive?.()
  await ctx.close()
  console.log(`${t.id}: ${Math.round((Date.now() - started) / 1000)} s`)
}
if (!ONLY || ONLY.includes('fin')) await endCard(b, path.join(FRAMES, 'fin'), Math.round(END.seconds * FPS), END.title)
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
const [voice, beat] = (FILM === 'sortie' ? ['voix-sortie-officielle.mp3', 'son-sortie-officielle.mp3'] : ['voix-vie.mp3', 'son-vie.mp3']).map((f) => path.join(OUT, f)).map((f) => (fs.existsSync(f) ? f : ''))
const mp4 = path.join(OUT, `babi-life-video-${FILM === 'sortie' ? 'sortie-officielle' : 'vie'}-1080x1920.mp4`)
const sound =
  voice && beat
    ? ['-i', voice, '-i', beat, '-filter_complex', '[1:a]apad[v];[2:a]volume=0.32[b];[v][b]amix=inputs=2:duration=first:normalize=0[a]', '-map', '0:v', '-map', '[a]', '-c:a', 'aac', '-b:a', '192k', '-shortest']
    : voice || beat
      ? ['-i', voice || beat, '-af', 'apad', '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '160k', '-shortest']
      : []
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, ...sound, '-c:v', 'copy', '-movflags', '+faststart', mp4])
// Its cover: the title over the city.
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '1.6', '-i', mp4, '-frames:v', '1', mp4.replace('-1080x1920.mp4', '-cover.png')])
console.log('video →', mp4)
