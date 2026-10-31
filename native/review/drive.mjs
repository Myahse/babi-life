// The app's walk-through in the emulator (.github/workflows/native-review.yml): the app is the website's
// game in a web view (Shell.tsx), so the game is driven from inside, as our browser checks do it
// (Playwright, through the web view's DevTools socket: the review build turns it on), and the phone
// from outside (adb: the back button, the screen turned). It plays against the review's own API and
// its own copy of the site (never production), and keeps the phone's screen at every step.
//
//   node drive.mjs OUT_DIR      (env: API, PKG, REVIEW_PARTS=login|full, PGURL)

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'

const OUT = process.argv[2] || '/tmp/review'
const API = process.env.API || 'http://localhost:8080/api/v1'
const PKG = process.env.PKG || 'com.lifeinbabi.babi_life'
const PARTS = process.env.REVIEW_PARTS || 'login'
const PGURL = process.env.PGURL || 'postgres://postgres:review@localhost:5432/babi?sslmode=disable'
fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true })

const started = Date.now()
const log = (...a) => console.log(`[${((Date.now() - started) / 1000).toFixed(1).padStart(6)}s]`, ...a)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const adb = (...args) => {
  try {
    return execFileSync('adb', args, { timeout: 60000 }).toString()
  } catch (e) {
    log('adb failed', args.join(' '), String(e).slice(0, 200))
    return ''
  }
}
const steps = []
let n = 0
/** The phone's screen as it is (what the player sees, the system bars too). */
async function shot(name, note = '') {
  n += 1
  const file = path.join(OUT, 'shots', `${String(n).padStart(2, '0')}-${name}.png`)
  fs.writeFileSync(file, execFileSync('adb', ['exec-out', 'screencap', '-p'], { maxBuffer: 64 << 20 }))
  steps.push({ step: name, note })
  log('shot', path.basename(file), note)
}
const call = async (p, body, token) => {
  const r = await fetch(API + p, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
  return r.json()
}
const sql = (q) => execFileSync('psql', [PGURL, '-tAqc', q]).toString().trim()

/** The app's web view through its DevTools socket (adb forwarded to 9222): its page. */
async function webview() {
  for (let i = 0; i < 60; i++) {
    const pid = adb('shell', 'pidof', PKG).trim()
    const socket = (adb('shell', 'cat', '/proc/net/unix').match(/@(webview_devtools_remote_\d+)/) || [])[1]
    if (pid && socket) {
      adb('forward', 'tcp:9222', `localabstract:${socket}`)
      try {
        const b = await chromium.connectOverCDP('http://localhost:9222')
        const page = b.contexts()[0]?.pages()[0]
        if (page) return { b, page }
      } catch {}
    }
    await sleep(2000)
  }
  throw new Error('no web view to drive')
}

const foreground = () => /mCurrentFocus=.*com\.lifeinbabi/.test(adb('shell', 'dumpsys', 'window', 'windows'))

async function main() {
  adb('shell', 'monkey', '-p', PKG, '-c', 'android.intent.category.LAUNCHER', '1')
  let { b, page } = await webview()
  page.on('console', (m) => m.type() === 'error' && log('page error:', m.text().slice(0, 200)))
  page.on('pageerror', (e) => log('page exception:', String(e).slice(0, 200)))
  await page.waitForLoadState('load').catch(() => {})
  await sleep(6000)
  log('page', page.url(), 'user agent in app:', await page.evaluate(() => navigator.userAgent.includes('BabiLifeApp')))
  await shot('titre', 'the sign-in, as the app opens')

  // A player, made through the API (its sign-in and birth are the site's, checked by the web's own tests),
  // then signed in on the app's page as the site keeps a session.
  const login = await call('/auth/dev', { name: `Revue${Date.now() % 100000}` })
  const sim = await call('/sims', { firstName: 'Awa', lastName: 'Revue', gender: 'femme', look: { skin: '#6e4024', hair: 'braids', outfit: 'robe', outfitColor: '#ff7a00', hairColor: '#141010' }, traits: ['gourmand'], aspiration: 'ambiance', lat: 5.355, lng: -3.985 }, login.token)
  try {
    sql(`UPDATE sims SET born_at = 0 WHERE id = '${sim.id}'`)
  } catch (e) {
    log('could not age the Sim:', String(e).slice(0, 200))
  }
  await page.evaluate(([token, user]) => localStorage.setItem('ivoire-life-session', JSON.stringify({ state: { token, user }, version: 0 })), [login.token, login.user])
  await page.goto(page.url().replace(/\/[^/]*$/, '/jeu'))
  await sleep(8000)
  await shot('arrivee', 'the first time in the game: the arrival')
  // The arrival skipped (it's seen once), Koffi's tuto and the news out of the way.
  for (const name of ['Passer', 'Passer', 'Plus tard', 'Fermer', 'Compris']) {
    const btn = page.getByRole('button', { name }).first()
    if (await btn.count()) await btn.click({ timeout: 2000 }).catch(() => {})
    await sleep(1500)
  }
  await sleep(15000)
  await shot('rue', 'the street, edge to edge, the mini-map below the top bar')
  const sat = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sat'))
  log('safe area given by the app: --sat =', sat || '(none)')
  if (PARTS !== 'full') return { b }

  // The phone, then the back button closes it (the game's own back, window.__babiBack).
  await page.getByText('Phone', { exact: true }).first().click({ timeout: 5000 }).catch((e) => log('no Phone button', String(e).slice(0, 120)))
  await sleep(3000)
  await shot('telephone', 'the in-game phone')
  adb('shell', 'input', 'keyevent', '4')
  await sleep(2500)
  await shot('retour-telephone', 'back: the phone closed, still in the game')
  // The map.
  await page.getByText('Carte', { exact: true }).first().click({ timeout: 5000 }).catch((e) => log('no Carte button', String(e).slice(0, 120)))
  await sleep(4000)
  await shot('carte', 'the map')
  adb('shell', 'input', 'keyevent', '4')
  await sleep(2500)
  // Sideways, as « Jouer en paysage » asks the app (the channel the site speaks).
  await page.evaluate(() => (window.BabiApp ? window.BabiApp.postMessage(JSON.stringify({ id: 9001, name: 'orientation', arg: 'landscape' })) : null))
  await sleep(5000)
  await shot('paysage', 'turned by the app, the mini-map below the Sim card')
  await page.evaluate(() => window.BabiApp?.postMessage(JSON.stringify({ id: 9002, name: 'orientation', arg: 'portrait' })))
  await sleep(4000)
  // Back with nothing open: out of the app (to the launcher).
  adb('shell', 'input', 'keyevent', '4')
  await sleep(3000)
  log('back in the bare street left the app:', !foreground())
  await shot('sortie', 'back with nothing open: the app left')
  return { b }
}

try {
  const { b } = await main()
  await b?.close().catch(() => {})
} catch (e) {
  log('review stopped:', String(e).slice(0, 400))
  await shot('arret', String(e).slice(0, 120)).catch(() => {})
} finally {
  fs.writeFileSync(path.join(OUT, 'steps.json'), JSON.stringify(steps, null, 2))
}
