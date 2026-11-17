// The captions, the commune chips and the end card, drawn as transparent 1080x1920 PNGs in the game's style
// (white HUD cards, Baloo 2 extra-bold, the game's orange and green, the logo).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, mkdirSync } from 'fs'
const D = '/tmp/claude-0/-home-user-babi-life/1e6aab45-c0cb-5310-a50c-6475bf9efcec/scratchpad/vmq/ov/'
mkdirSync(D, { recursive: true })
const F = '/home/user/babi-life/web/node_modules/@fontsource/'
const font = (p) => readFileSync(F + p).toString('base64')
const logo = readFileSync('/home/user/babi-life/web/public/pin-512.png').toString('base64')
const css = `
@font-face { font-family: B; font-weight: 800; src: url(data:font/woff2;base64,${font('baloo-2/files/baloo-2-latin-800-normal.woff2')}) format('woff2'); }
@font-face { font-family: N; font-weight: 800; src: url(data:font/woff2;base64,${font('nunito/files/nunito-latin-800-normal.woff2')}) format('woff2'); }
html, body { margin: 0; width: 1080px; height: 1920px; background: transparent; }
.card { position: absolute; left: 50%; transform: translateX(-50%); background: #fffaf3; color: #1f1a17; border-radius: 44px; padding: 26px 46px 22px; font: 800 66px/1.08 B, sans-serif; text-align: center; box-shadow: 0 14px 0 rgba(0,0,0,.18), 0 26px 60px rgba(0,0,0,.35); max-width: 900px; width: max-content; letter-spacing: -0.5px; }
.card.hook { font-size: 84px; padding: 34px 50px 28px; border-radius: 52px; }
.o { color: #e8731f; }
.g { color: #1c7a4a; }
.chip { position: absolute; left: 50%; transform: translateX(-50%); background: #1c7a4a; color: #fff; border-radius: 999px; padding: 14px 40px 10px; font: 800 52px/1 B, sans-serif; box-shadow: 0 10px 0 rgba(0,0,0,.18), 0 18px 40px rgba(0,0,0,.3); }
.chip small { font: 800 30px/1 N, sans-serif; opacity: .85; margin-right: 14px; letter-spacing: 2px; text-transform: uppercase; }
.end { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(20,12,40,.15), rgba(20,12,40,.55) 40%, rgba(20,12,40,.75)); }
.brand { position: absolute; top: 470px; left: 0; right: 0; display: flex; align-items: center; justify-content: center; gap: 26px; font: 800 96px/1 B, sans-serif; color: #fff; }
.brand img { width: 150px; height: 150px; border-radius: 34px; }
.brand span { color: #ff8a1f; }
.big { position: absolute; top: 700px; left: 0; right: 0; text-align: center; font: 800 124px/1 B, sans-serif; color: #fff; text-shadow: 0 8px 0 rgba(0,0,0,.25); }
.sub { position: absolute; top: 850px; left: 0; right: 0; text-align: center; font: 800 64px/1.1 B, sans-serif; color: #ffd8a8; }
.url { position: absolute; top: 1030px; left: 50%; transform: translateX(-50%); background: #fffaf3; color: #e8731f; border-radius: 40px; padding: 24px 54px 18px; font: 800 76px/1 B, sans-serif; box-shadow: 0 12px 0 rgba(0,0,0,.2), 0 24px 60px rgba(0,0,0,.4); }
.free { position: absolute; top: 1190px; left: 0; right: 0; text-align: center; font: 800 44px/1 N, sans-serif; color: rgba(255,255,255,.9); }
.flag { position: absolute; left: 0; right: 0; bottom: 0; height: 22px; display: flex; }
.flag i { flex: 1; } .flag i:nth-child(1) { background: #f77f00; } .flag i:nth-child(2) { background: #fff; } .flag i:nth-child(3) { background: #009e60; }
`
// name, html, top (px)
const LOW = 1250
const TOP = 150
const caps = [
  ['c1', '<div class="card hook" style="top:1130px">Et si tu avais<br><span class="o">ton propre quartier</span><br>à Abidjan ?</div>'],
  ['c2', `<div class="card" style="top:${TOP}px">Choisis <span class="o">ton plan</span></div>`],
  ['c3', `<div class="card" style="top:${LOW}px">3 quartiers, dans le style<br>de <span class="o">ta commune</span></div>`],
  ['c3t', `<div class="card" style="top:${TOP}px">3 quartiers, dans le style<br>de <span class="o">ta commune</span></div>`],
  ['k1', '<div class="chip" style="top:1080px"><small>Plan</small>Cocody</div>'],
  ['k2', '<div class="chip" style="top:1080px"><small>Plan</small>Yopougon</div>'],
  ['k3', '<div class="chip" style="top:1080px"><small>Plan</small>Port-Bouët</div>'],
  ['c4', `<div class="card" style="top:${LOW}px">Ton Sim <span class="o">vit dedans</span></div>`],
  ['c5', `<div class="card" style="top:${LOW}px">Tu zoomes, <span class="o">tu tournes</span></div>`],
  ['c6', `<div class="card" style="top:${LOW}px"><span class="g">La forêt</span>, la lagune…<br>et <span class="o">le Plateau</span> au loin</div>`],
  ['c7', `<div class="card" style="top:${TOP}px">Construis <span class="o">ton maquis</span></div>`],
  ['c7l', `<div class="card" style="top:${LOW}px">Construis <span class="o">ton maquis</span></div>`],
  ['c8', `<div class="card" style="top:${TOP}px">Tes <span class="g">gains du jour</span>,<br>ton quartier <span class="o">monte</span></div>`],
  ['c9', `<div class="card" style="top:${LOW}px">Les voisins passent,<br>les <span class="o">gbakas</span> klaxonnent…</div>`],
  ['c10', `<div class="card" style="top:${LOW}px">…et tes <span class="o">amis</span> viennent te voir</div>`],
  ['c11', `<div class="card" style="top:${TOP}px">Tu veux bouger ?<br><span class="o">Aller à Babi</span></div>`],
  ['c12', `<div class="card" style="top:${LOW}px">Toute la ville,<br><span class="o">avec tout le monde</span></div>`],
  ['c13', `<div class="card" style="top:${TOP}px"><span class="o">Rentrer</span> au quartier</div>`],
  ['end', `<div class="end"></div><div class="brand"><img src="data:image/png;base64,${logo}">Babi <span>Life</span></div><div class="big">Mon quartier</div><div class="sub">bientôt dans Babi Life</div><div class="url">lifeinbabi.com</div><div class="free">Gratuit · 100 % ivoirien</div><div class="flag"><i></i><i></i><i></i></div>`],
]
const b = await chromium.launch()
const page = await b.newPage({ viewport: { width: 1080, height: 1920 } })
for (const [name, html] of caps) {
  await page.setContent(`<html><head><style>${css}</style></head><body>${html}</body></html>`)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: `${D}${name}.png`, omitBackground: true })
}
// The rounded mask for the inset screen.
await page.setContent(`<html><head><style>html,body{margin:0;background:transparent}div{width:692px;height:1230px;border-radius:44px;background:#fff}</style></head><body><div></div></body></html>`)
await page.setViewportSize({ width: 692, height: 1230 })
await page.screenshot({ path: `${D}mask.png`, omitBackground: true })
await b.close()
console.log('ok', caps.length)
