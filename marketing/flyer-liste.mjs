// A flyer for the wish list's players who weren't born into their family:
// on the wish list, their perso had a family drawn for it; at the opening some
// found themselves in another. The game now offers them, once, to get the
// list's family back (update « famille-liste », web components/ListedFamily.tsx):
// the flyer says how. As an A5 to print (PDF, PNG at 300 dpi), a post (1080 ×
// 1350) and a WhatsApp status (1080 × 1920); the families are the game's own
// scenes (web/src/lab/poster.tsx); the QR code leads to the game, marked
// ?src=flyer-liste. The text: marketing/scripts/flyer-famille-liste.md.
//
// Needs the web app's dependencies (cd web && npm ci) and out/logos/ (npm run logos).

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import QRCode from 'qrcode'
import { BRAND, HERE, OUT, SHORT, URL, browser, fontFaces } from './shared.mjs'

const PORT = 5248
const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: path.join(HERE, '../web'), stdio: 'ignore' })
process.on('exit', () => vite.kill())
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(`http://127.0.0.1:${PORT}/poster.html`)).ok) break
  } catch {}
  await new Promise((r) => setTimeout(r, 500))
}

const b = await browser()
const art = path.join(OUT, 'art')
fs.mkdirSync(art, { recursive: true })

/** A picture of a scene of the game, as a data URL. */
async function shot(scene, t, width, height) {
  const file = path.join(art, `${scene}.png`)
  const p = await b.newPage({ viewport: { width, height }, deviceScaleFactor: 2 })
  await p.goto(`http://127.0.0.1:${PORT}/poster.html?scene=${scene}&t=${t}`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(3000)
  await p.screenshot({ path: file })
  await p.close()
  return `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`
}

const wrong = await shot('famille-coule', 2, 480, 520)
const right = await shot('famille-late', 2, 480, 520)
const logo = `data:image/svg+xml;base64,${fs.readFileSync(path.join(OUT, 'logos/babi-life-logo-on-dark.svg')).toString('base64')}`
// To the game itself (not the wish list): the players open it with their account.
const GAME = 'https://lifeinbabi.com'
const qr = await QRCode.toDataURL(`${GAME}/?src=flyer-liste`, { margin: 1, width: 600, errorCorrectionLevel: 'M', color: { dark: BRAND.ink, light: '#ffffff' } })

const page = ({ width, height, tall }) => {
  const short = height / width < 1.3
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${fontFaces()}
*{box-sizing:border-box;margin:0}
html,body{width:${width}px;height:${height}px}
body{--u:${width / 100}px;font-family:'Nunito',sans-serif;color:#fff;overflow:hidden;position:relative;
  background:linear-gradient(180deg,#1d1650 0%,#3a2378 34%,#5b2a86 58%,#d9466f 84%,#ff8a3d 100%)}
.page{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;padding:calc(var(--u)*${tall ? 6 : 4}) calc(var(--u)*5) calc(var(--u)*${tall ? 5 : 3.6})}
.logo{height:calc(var(--u)*${tall ? 8 : 6})}
.tag{margin-top:calc(var(--u)*${tall ? 3 : 1.8});background:#ffd43b;color:${BRAND.ink};font-weight:900;border-radius:calc(var(--u)*1.4);padding:calc(var(--u)*.6) calc(var(--u)*2);transform:rotate(-2deg);font-size:calc(var(--u)*${tall ? 3.2 : short ? 2.2 : 2.6})}
h1{font-family:'Baloo 2';font-weight:800;text-align:center;line-height:.95;letter-spacing:-.02em;margin-top:calc(var(--u)*${tall ? 2.4 : 1.4});font-size:calc(var(--u)*${tall ? 10.4 : short ? 7 : 8.6})}
h1 em{font-style:normal;color:${BRAND.orange}}
.lead{margin-top:calc(var(--u)*1.4);text-align:center;font-weight:800;font-size:calc(var(--u)*${tall ? 3.3 : short ? 2.3 : 2.8});opacity:.92;line-height:1.3}
.duo{width:100%;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:calc(var(--u)*1.6);margin-top:calc(var(--u)*${tall ? 4 : 2.4});flex:1 1 0;min-height:0}
.fam{position:relative;height:100%;border-radius:calc(var(--u)*3);overflow:hidden;border:calc(var(--u)*.45) solid rgba(255,255,255,.7);background:#0f1230}
.fam.ok{border-color:${BRAND.gold};box-shadow:0 0 0 calc(var(--u)*.6) rgba(255,194,51,.35)}
.fam img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.fam.no img{filter:grayscale(.8) brightness(.7)}
.fam .cap{position:absolute;left:0;right:0;bottom:0;padding:calc(var(--u)*1.4);background:linear-gradient(180deg,rgba(15,18,48,0),rgba(15,18,48,.92) 45%);font-family:'Baloo 2';font-weight:800;line-height:1.05;font-size:calc(var(--u)*${tall ? 3.4 : short ? 2.3 : 2.8})}
.fam.ok .cap{color:${BRAND.gold}}
.fam .x{position:absolute;top:calc(var(--u)*1.2);left:calc(var(--u)*1.2);background:#e03131;border-radius:999px;font-weight:900;padding:calc(var(--u)*.3) calc(var(--u)*1.2);font-size:calc(var(--u)*${tall ? 2.4 : 1.8})}
.fam.ok .x{background:${BRAND.emerald}}
.arrow{font-family:'Baloo 2';font-weight:800;font-size:calc(var(--u)*${tall ? 9 : 6});color:${BRAND.gold}}
.steps{width:100%;margin-top:calc(var(--u)*${tall ? 3.4 : 2});background:rgba(255,255,255,.96);color:${BRAND.ink};border-radius:calc(var(--u)*3.6);padding:calc(var(--u)*${tall ? 2.6 : 1.8}) calc(var(--u)*3)}
.steps h2{font-family:'Baloo 2';font-weight:800;font-size:calc(var(--u)*${tall ? 4.2 : short ? 2.9 : 3.4})}
.steps ol{margin-top:calc(var(--u)*.8);padding-left:calc(var(--u)*4.4);font-weight:800;line-height:1.35;font-size:calc(var(--u)*${tall ? 2.9 : short ? 2 : 2.4})}
.steps b{color:${BRAND.orange}}
.steps p{margin-top:calc(var(--u)*.8);color:#5a5f73;font-weight:800;font-size:calc(var(--u)*${tall ? 2.4 : short ? 1.7 : 2})}
.cta{margin-top:calc(var(--u)*${tall ? 2.6 : 1.6});width:100%;display:flex;align-items:center;gap:calc(var(--u)*3);background:#fff;color:${BRAND.ink};border-radius:calc(var(--u)*4);padding:calc(var(--u)*${tall ? 2.4 : 1.6});box-shadow:0 calc(var(--u)*3) calc(var(--u)*6) rgba(0,0,0,.35)}
.cta img{flex:none;width:calc(var(--u)*${tall ? 20 : short ? 12 : 15});height:auto;image-rendering:pixelated}
.cta h3{font-family:'Baloo 2';font-weight:800;font-size:calc(var(--u)*${tall ? 4.6 : short ? 3 : 3.6});line-height:1}
.cta .url{margin-top:calc(var(--u)*1);font-family:'Baloo 2';font-weight:800;font-size:calc(var(--u)*${tall ? 4 : 3.2});color:${BRAND.orange}}
.cta p{margin-top:calc(var(--u)*.6);font-weight:800;font-size:calc(var(--u)*${tall ? 2.5 : 2});color:#5a5f73}
.stripe{position:absolute;left:0;right:0;bottom:0;display:flex;height:calc(var(--u)*1.6)}.stripe i{flex:1}
</style></head><body>
<div class="page">
  <img class="logo" src="${logo}" alt="Babi Life">
  <div class="tag">Tu étais sur la liste d'attente ?</div>
  <h1>Ta <em>famille</em><br>t'attend toujours</h1>
  <p class="lead">À l'ouverture, tu t'es retrouvé·e dans une autre famille ?<br>Ce n'était pas prévu. Pardon !</p>
  <div class="duo">
    <div class="fam no"><img src="${wrong}" alt=""><i class="x">Pas la tienne</i><div class="cap">La famille où tu es tombé·e</div></div>
    <div class="arrow">→</div>
    <div class="fam ok"><img src="${right}" alt=""><i class="x">Ta famille</i><div class="cap">Celle de la liste, tirée au sort pour toi</div></div>
  </div>
  <div class="steps">
    <h2>Pour la retrouver</h2>
    <ol>
      <li>Ouvre Babi Life avec <b>le même compte</b>.</li>
      <li>La carte « <b>Ta famille de la liste t'attend</b> » s'affiche.</li>
      <li>Touche « <b>Oui, je retrouve ma famille</b> ».</li>
    </ol>
    <p>Tu préfères ta nouvelle famille ? Garde-la. Tu ne choisis qu'une fois.</p>
  </div>
  <div class="cta">
    <img src="${qr}" alt="QR code vers lifeinbabi.com">
    <div><h3>Ouvre le jeu</h3><div class="url">lifeinbabi.com</div><p>Gratuit · 100 % ivoirien</p></div>
  </div>
</div>
<div class="stripe"><i style="background:#ff8200"></i><i style="background:#fff"></i><i style="background:#009a44"></i></div>
</body></html>`
}

// A5 (148 × 210 mm) at 96 px an inch, for the PDF and the 300 dpi PNG; then the phone sizes.
const A5 = { width: 559, height: 794 }
const a5 = await b.newPage({ viewport: A5, deviceScaleFactor: 300 / 96 })
await a5.setContent(page(A5), { waitUntil: 'load' })
if (await a5.evaluate(() => document.querySelector('.page').scrollHeight > innerHeight + 1)) console.warn('⚠️ the A5 overflows its page')
await a5.pdf({ path: path.join(OUT, 'babi-life-flyer-liste-A5.pdf'), width: '148mm', height: '210mm', printBackground: true, pageRanges: '1' })
await a5.screenshot({ path: path.join(OUT, 'babi-life-flyer-liste-A5-300dpi.png') })
await a5.close()
for (const [suffix, size] of [
  ['post-1080x1350', { width: 1080, height: 1350 }],
  ['status-1080x1920', { width: 1080, height: 1920, tall: true }],
]) {
  const s = await b.newPage({ viewport: size, deviceScaleFactor: 1 })
  await s.setContent(page(size), { waitUntil: 'load' })
  if (await s.evaluate(() => document.querySelector('.page').scrollHeight > innerHeight + 1)) console.warn(`⚠️ the ${suffix} overflows`)
  await s.screenshot({ path: path.join(OUT, `babi-life-flyer-liste-${suffix}.png`) })
  await s.close()
}
console.log('flyer liste: done')
await b.close()
process.exit(0) // the Vite server would keep it running
