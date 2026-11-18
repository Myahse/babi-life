// Video « Mon quartier »: the bench player, the page, and a virtual clock stepped frame by frame.
import { chromium } from '/home/user/babi-life/marketing/node_modules/playwright-core/index.mjs'
import { execSync } from 'child_process'
export const API = 'http://127.0.0.1:8981/api/v1'
export const GAME = 'http://127.0.0.1:5981'
export const AT = { cocody: [5.36, -3.99], yopougon: [5.3364, -4.0757], 'port-bouet': [5.256, -3.93] }
const LOOK = { skin: '#6e4024', hair: 'tresses', hairColor: '#141010', outfit: 'casual', outfitColor: '#ff7a00', body: 'moyen', height: 1, eyes: '#2b1a10', beard: 'none', accessory: 'none', pattern: 'cercles', bottomColor: '', shoeColor: '', accessoryColor: '', marks: 'none', wear: 'neuf' }
export const psql = (q) => execSync(`psql "postgres://postgres@127.0.0.1:55432/babi_video?sslmode=disable" -Atc "${q.replace(/"/g, '\\"')}"`).toString().trim()
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
export async function call(token, path, method = 'GET', body) {
  const r = await fetch(API + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
  const t = await r.text()
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${t.slice(0, 200)}`)
  return t ? JSON.parse(t) : null
}
export async function player(commune, name, gender = 'femme', look = {}) {
  const { token, user } = await call(null, '/auth/dev', 'POST', { name: `${name}${Date.now().toString(36).slice(-5)}` })
  const me = user ?? (await call(token, '/me'))
  psql(`UPDATE users SET tester = true WHERE id = '${me.id}'`)
  const at = AT[commune]
  const made = await call(token, '/sims', 'POST', { firstName: name, lastName: 'Koné', gender, look: { ...LOOK, ...look }, traits: ['ambianceur', 'sportif'], aspiration: 'ambiance', lat: at[0], lng: at[1] })
  const sim = made.sim ?? made
  await call(token, `/sims/${sim.id}/tester`, 'POST', { action: 'age', stage: 'adulte' })
  await call(token, `/sims/${sim.id}/tester`, 'POST', { action: 'needs' })
  psql(`UPDATE sims SET money = 3000000 WHERE id = '${sim.id}'`)
  return { token, user: me, sim }
}
export const browserOf = () => chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } : undefined })

// The virtual clock: real until vclock.on(), then performance.now / Date.now / rAF / timers only move with vclock.step().
const SHIM = () => {
  const rNow = performance.now.bind(performance)
  const rDate = Date.now
  const rRAF = window.requestAnimationFrame.bind(window)
  const rCAF = window.cancelAnimationFrame.bind(window)
  const rST = window.setTimeout.bind(window)
  const rCT = window.clearTimeout.bind(window)
  const rSI = window.setInterval.bind(window)
  const rCI = window.clearInterval.bind(window)
  let virt = false
  let vt = 0
  let rOff = 0
  let dOff = 0
  const raf = new Map()
  const timers = new Map()
  let nid = 1e7
  performance.now = () => (virt ? vt : rNow() - rOff)
  // (The world's clock reads performance.timeOrigin + performance.now(): no other shift needed.)
  Date.now = () => (virt ? vt + dOff : rDate())
  window.requestAnimationFrame = (cb) => {
    if (!virt) return rRAF(cb)
    const i = nid++
    raf.set(i, cb)
    return i
  }
  window.cancelAnimationFrame = (i) => (raf.has(i) ? raf.delete(i) : rCAF(i))
  window.setTimeout = (cb, ms = 0, ...a) => {
    if (!virt || typeof cb !== 'function') return rST(cb, ms, ...a)
    const i = nid++
    timers.set(i, { cb, at: vt + Math.max(0, +ms || 0), a })
    return i
  }
  window.clearTimeout = (i) => (timers.has(i) ? timers.delete(i) : rCT(i))
  window.setInterval = (cb, ms = 0, ...a) => {
    if (!virt || typeof cb !== 'function') return rSI(cb, ms, ...a)
    const i = nid++
    timers.set(i, { cb, at: vt + Math.max(1, +ms || 0), a, every: Math.max(1, +ms || 0) })
    return i
  }
  window.clearInterval = (i) => (timers.has(i) ? timers.delete(i) : rCI(i))
  const anims = () => {
    try {
      return document.getAnimations()
    } catch {
      return []
    }
  }
  window.vclock = {
    // shift (ms): moves performance.now (the world's shared clock reads it) on, Date.now stays real.
    on(shift = 0) {
      if (virt) return
      vt = rNow() - rOff
      dOff = rDate() - vt
      vt += shift
      dOff -= shift
      virt = true
      for (const a of anims()) a.pause()
    },
    off() {
      if (!virt) return
      virt = false
      rOff = rNow() - vt
      for (const [i, t] of timers) {
        timers.delete(i)
        if (t.every) rSI(t.cb, t.every, ...t.a)
        else rST(t.cb, Math.max(0, t.at - vt), ...t.a)
      }
      for (const [i, cb] of raf) (raf.delete(i), rRAF(cb))
      for (const a of anims()) if (a.playState === 'paused') a.play()
    },
    step(ms = 1000 / 30) {
      const end = vt + ms
      // Timers due in this frame, in order.
      for (let guard = 0; guard < 500; guard++) {
        let best = null
        for (const [i, t] of timers) if (t.at <= end && (!best || t.at < best[1].at)) best = [i, t]
        if (!best) break
        const [i, t] = best
        vt = Math.max(vt, t.at)
        if (t.every) t.at += t.every
        else timers.delete(i)
        try {
          t.cb(...t.a)
        } catch (e) {
          console.error('timer', e)
        }
      }
      vt = end
      // CSS animations and transitions: paused, moved on by the frame.
      for (const a of anims()) {
        if (a.playState !== 'paused') a.pause()
        a.currentTime = (a.currentTime ?? 0) + ms
      }
      const cbs = [...raf.values()]
      raf.clear()
      for (const cb of cbs) {
        try {
          cb(vt)
        } catch (e) {
          console.error('raf', e)
        }
      }
    },
    get virt() {
      return virt
    },
    get t() {
      return vt
    },
  }
}

export async function open(browser, p, { query = '', video = { dpr: 2, noArrow: true }, view = 'sims', w = 360, h = 640, dsf = 3, extra } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf, isMobile: true, hasTouch: true, locale: 'fr-FR' })
  await ctx.addInitScript(SHIM)
  await ctx.addInitScript(({ token, user, video, view, extra }) => {
    globalThis.__video = video
    globalThis.__forceTraffic = true
    localStorage.setItem('ivoire-life-session', JSON.stringify({ state: { token, user }, version: 0 }))
    for (const k of ['babi.tuto', 'babi.firstSteps', 'babi.tuto.adulte']) localStorage.setItem(k, 'done')
    localStorage.setItem('babi.pushAsked', String(Date.now()))
    localStorage.setItem('babi.featuresSeen', JSON.stringify(['mon-quartier', 'lumiere-realiste', 'eau-realiste', 'blocs-arrondis', 'persos-realistes', 'voitures-realistes', 'facades-realistes', 'ponts-realistes', 'batiments-realistes', 'minijeux-realistes']))
    sessionStorage.setItem('babi.monde.choisi', '1')
    localStorage.setItem('babi.quality', 'beau')
    localStorage.setItem('babi.telLeger', 'normal')
    localStorage.setItem('babi.view.quartier', view)
    if (extra) for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, v)
    // Clean frames: only the street's canvas (the biggest), nothing over it.
    window.__clean = (on) => {
      let big = null
      for (const c of document.querySelectorAll('canvas')) if (!big || c.width * c.height > big.width * big.height) big = c
      document.querySelectorAll('canvas.vid-main').forEach((c) => c.classList.remove('vid-main'))
      big?.classList.add('vid-main')
      document.body.classList.toggle('clean', !!on)
    }
    addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style')
      s.textContent = 'body.clean *{visibility:hidden!important} body.clean canvas.vid-main{visibility:visible!important}'
      document.head.appendChild(s)
    })
  }, { token: p.token, user: p.user, video, view, extra })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.error('page:', String(e).slice(0, 300)))
  page.on('console', (m) => {
    const t = m.text()
    if (t.startsWith('[quartier]') || m.type() === 'error') console.log('  ', m.type(), t.slice(0, 300))
  })
  await page.route('**/news*', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ items: [] }) }))
  await page.goto(`${GAME}/jeu${query}`)
  return { ctx, page }
}
export async function waitFor(page, fn, ms = 400000, arg) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    if (await page.evaluate(fn, arg).catch(() => false)) return Date.now() - t0
    await sleep(1000)
  }
  throw new Error('timeout ' + fn)
}
