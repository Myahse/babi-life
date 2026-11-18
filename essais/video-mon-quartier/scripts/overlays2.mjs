// v2 (« what's new » + testers): the captions, the chips and the testers' end card, as transparent 1080x1920 PNGs in
// the game's style (white HUD cards, Baloo 2 extra-bold, the game's orange and green, the logo).
// The WhatsApp line of the end card is one constant (CONTACT below): change it, run `node overlays2.mjs`, re-compose.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, mkdirSync } from 'fs'

// The contact shown on the end card (the community of the game, web/src/components/WaitlistShare.tsx).
const CONTACT = { cta: 'Rejoins la communauté WhatsApp', link: 'chat.whatsapp.com/Lg3fgekmf6z6fS3J5jPZPi' }

const D = '/tmp/claude-0/-home-user-babi-life/1e6aab45-c0cb-5310-a50c-6475bf9efcec/scratchpad/vmq/ov/'
mkdirSync(D, { recursive: true })
const F = '/home/user/babi-life/web/node_modules/@fontsource/'
const font = (p) => readFileSync(F + p).toString('base64')
const logo = readFileSync('/home/user/babi-life/web/public/pin-512.png').toString('base64')
// A plain chat bubble (not a brand logo).
const bubble = '<svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>'
const css = `
@font-face { font-family: B; font-weight: 800; src: url(data:font/woff2;base64,${font('baloo-2/files/baloo-2-latin-800-normal.woff2')}) format('woff2'); }
@font-face { font-family: N; font-weight: 800; src: url(data:font/woff2;base64,${font('nunito/files/nunito-latin-800-normal.woff2')}) format('woff2'); }
html, body { margin: 0; width: 1080px; height: 1920px; background: transparent; }
.card { position: absolute; left: 50%; transform: translateX(-50%); background: #fffaf3; color: #1f1a17; border-radius: 44px; padding: 26px 46px 22px; font: 800 66px/1.08 B, sans-serif; text-align: center; box-shadow: 0 14px 0 rgba(0,0,0,.18), 0 26px 60px rgba(0,0,0,.35); max-width: 920px; width: max-content; letter-spacing: -0.5px; }
.card.hook { font-size: 80px; padding: 32px 50px 26px; border-radius: 52px; }
.o { color: #e8731f; }
.g { color: #1c7a4a; }
.chip { position: absolute; left: 50%; transform: translateX(-50%); background: #1c7a4a; color: #fff; border-radius: 999px; padding: 14px 40px 10px; font: 800 52px/1 B, sans-serif; box-shadow: 0 10px 0 rgba(0,0,0,.18), 0 18px 40px rgba(0,0,0,.3); width: max-content; }
.chip.o2 { background: #e8731f; }
.chip small { font: 800 30px/1 N, sans-serif; opacity: .85; margin-right: 14px; letter-spacing: 2px; text-transform: uppercase; }
.new { position: absolute; top: 120px; left: 50%; transform: translateX(-50%) rotate(-3deg); background: #e8731f; color: #fff; border-radius: 22px; padding: 16px 34px 10px; font: 800 50px/1 B, sans-serif; letter-spacing: 3px; box-shadow: 0 10px 0 rgba(0,0,0,.2), 0 18px 40px rgba(0,0,0,.3); width: max-content; }
.end { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(20,12,40,.35), rgba(20,12,40,.72) 30%, rgba(20,12,40,.82)); }
.brand { position: absolute; top: 150px; left: 0; right: 0; display: flex; align-items: center; justify-content: center; gap: 22px; font: 800 78px/1 B, sans-serif; color: #fff; }
.brand img { width: 118px; height: 118px; border-radius: 28px; }
.brand span { color: #ff8a1f; }
.big { position: absolute; top: 300px; left: 0; right: 0; text-align: center; font: 800 104px/1.02 B, sans-serif; color: #fff; text-shadow: 0 8px 0 rgba(0,0,0,.25); }
.sub { position: absolute; top: 530px; left: 0; right: 0; text-align: center; font: 800 50px/1.1 B, sans-serif; color: #ffd8a8; }
.step { position: absolute; left: 70px; right: 70px; height: 140px; background: #fffaf3; border-radius: 40px; display: flex; align-items: center; gap: 30px; padding: 0 34px; box-sizing: border-box; box-shadow: 0 12px 0 rgba(0,0,0,.2), 0 24px 50px rgba(0,0,0,.35); font: 800 52px/1.05 B, sans-serif; color: #1f1a17; }
.step b { flex: none; width: 92px; height: 92px; border-radius: 50%; background: #e8731f; color: #fff; display: flex; align-items: center; justify-content: center; font: 800 58px/1 B, sans-serif; padding-top: 6px; box-sizing: border-box; }
.step.w b { background: #1c7a4a; }
.cta { position: absolute; top: 1360px; left: 50%; transform: translateX(-50%); background: #1c9a55; color: #fff; border-radius: 46px; padding: 26px 46px 22px; display: flex; align-items: center; gap: 22px; font: 800 50px/1 B, sans-serif; box-shadow: 0 12px 0 #0f5e33, 0 26px 60px rgba(0,0,0,.45); width: max-content; }
.link { position: absolute; top: 1520px; left: 0; right: 0; text-align: center; font: 800 42px/1 N, sans-serif; color: #fff; }
.free { position: absolute; top: 1590px; left: 0; right: 0; text-align: center; font: 800 36px/1 N, sans-serif; color: rgba(255,255,255,.75); }
.flag { position: absolute; left: 0; right: 0; bottom: 0; height: 22px; display: flex; }
.flag i { flex: 1; } .flag i:nth-child(1) { background: #f77f00; } .flag i:nth-child(2) { background: #fff; } .flag i:nth-child(3) { background: #009e60; }
`
const LOW = 1270
const TOP = 150
const STEP0 = 650
const STEPS = ['Rejoins la communauté WhatsApp', 'Donne ton adresse Gmail', 'Reçois le lien Play Store<br>et installe', 'Joue et donne ton avis']
const step = (i) => `<div class="step${i === 0 ? ' w' : ''}" style="top:${STEP0 + i * 170}px"><b>${i + 1}</b><span>${STEPS[i]}</span></div>`
const caps = [
  ['n-new', '<div class="new">NOUVEAU</div>'],
  ['n1a', '<div class="card hook" style="top:1130px">Y a du nouveau<br>dans <span class="o">Babi Life</span> !</div>'],
  ['n1b', '<div class="card hook" style="top:1130px">T’as <span class="o">ton propre<br>quartier</span></div>'],
  ['n2', `<div class="card" style="top:${TOP}px">Tu choisis <span class="o">ton plan</span>,<br>dans le style de <span class="o">ta commune</span></div>`],
  ['n3a', `<div class="card" style="top:${TOP}px">Tu construis <span class="o">ton maquis</span>…</div>`],
  ['n3b', `<div class="card" style="top:${LOW}px">…et il <span class="o">sort de terre</span>,<br>là, dans ta rue</div>`],
  ['n4', `<div class="card" style="top:${TOP}px">Tu rentres, tu gères,<br>tu <span class="o">ramasses l’argent</span></div>`],
  ['n5a', `<div class="card" style="top:${LOW}px">Le quartier <span class="o">vit</span> :<br>le marché, les vendeuses…</div>`],
  ['n5b', `<div class="card" style="top:${LOW}px">…le maquis <span class="o">plein le soir</span></div>`],
  ['n6a', `<div class="card" style="top:${TOP}px">Tu traces <span class="o">tes routes</span>,<br>l’eau, les ponts…</div>`],
  ['n6b', `<div class="card" style="top:${TOP}px">…tu plantes <span class="o">tes arbres</span></div>`],
  ['k-amenager', '<div class="chip o2" style="top:1640px"><small>Nouveau</small>Aménager</div>'],
  ['n7a', `<div class="card" style="top:${TOP}px">Tu passes <span class="o">chez tes gars</span>…</div>`],
  ['k-koffi', '<div class="chip" style="top:1640px"><small>Niv. 5</small>Chez Koffi</div>'],
  ['k-gbaka', '<div class="chip o2" style="top:1640px"><small>Ton quartier</small>L’arrêt de gbaka</div>'],
  ['k-real', '<div class="chip o2" style="top:1640px"><small>Nouveau</small>Lumière, eau, voitures, persos</div>'],
  ['n-real', `<div class="card" style="top:${TOP}px">Et Babi est <span class="o">plus beau</span><br>que jamais</div>`],
  ['k-babi', '<div class="chip" style="top:1640px"><small>Babi en ligne</small>Toute la ville</div>'],
  ['n7b', `<div class="card" style="top:${TOP}px">…tu vas <span class="o">à Babi</span></div>`],
  ['n7c', `<div class="card" style="top:${TOP}px">…et tu <span class="o">rentres chez toi</span></div>`],
  ['n8a', `<div class="card" style="top:${LOW}px">Bientôt sur<br>le <span class="g">Play Store</span></div>`],
  ['n8b', `<div class="card" style="top:${LOW}px">On cherche<br><span class="o">des testeurs</span> !</div>`],
  ['end-bg', `<div class="end"></div><div class="brand"><img src="data:image/png;base64,${logo}">Babi <span>Life</span></div><div class="big">On cherche<br>des testeurs !</div><div class="sub">Pour le lancement sur le Play Store</div><div class="flag"><i></i><i></i><i></i></div>`],
  ['end-s1', step(0)],
  ['end-s2', step(1)],
  ['end-s3', step(2)],
  ['end-s4', step(3)],
  ['end-cta', `<div class="cta">${bubble}${CONTACT.cta}</div>`],
  ['end-link', `<div class="link">${CONTACT.link}</div><div class="free">Gratuit · 100 % ivoirien</div>`],
]
const b = await chromium.launch()
const page = await b.newPage({ viewport: { width: 1080, height: 1920 } })
for (const [name, html] of caps) {
  await page.setContent(`<html><head><style>${css}</style></head><body>${html}</body></html>`)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: `${D}${name}.png`, omitBackground: true })
}
await b.close()
console.log('ok', caps.length)
