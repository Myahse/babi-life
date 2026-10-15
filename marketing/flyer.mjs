// The flyer: A5 to print (PDF, and PNG at 300 dpi), and the same for phones —
// a post (1080 × 1350) and a WhatsApp status (1080 × 1920). The Sims and the
// house are the game's own (web/src/lab/poster.tsx); the QR code leads to the
// wish list, marked ?src=flyer so the sign-ups it brings can be counted.
//
// Needs the web app's dependencies (cd web && npm ci).

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import QRCode from 'qrcode'
import { BRAND, HERE, OUT, SHORT, URL, browser, fontFaces } from './shared.mjs'

const PORT = 5234
const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: path.join(HERE, '../web'), stdio: 'ignore' })
process.on('exit', () => vite.kill())
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(`http://127.0.0.1:${PORT}/poster.html`)).ok) break
  } catch {}
  await new Promise((r) => setTimeout(r, 500))
}

const b = await browser()
const dataUrl = (file) => `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`

// The art: the crew (transparent) and the house, rendered by the game.
async function still(query, width, height, file) {
  const p = await b.newPage({ viewport: { width, height }, deviceScaleFactor: 2 })
  await p.goto(`http://127.0.0.1:${PORT}/poster.html?${query}`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(2500)
  await p.screenshot({ path: file, omitBackground: true })
  // Trim the empty (transparent) margins, so the art fills its place.
  const trimmed = await p.evaluate(async (url) => {
    const img = new Image()
    img.src = url
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    const g = c.getContext('2d')
    g.drawImage(img, 0, 0)
    const d = g.getImageData(0, 0, c.width, c.height).data
    let [x0, y0, x1, y1] = [c.width, c.height, 0, 0]
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++)
        if (d[(y * c.width + x) * 4 + 3] > 24) [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)]
    const pad = 12
    ;[x0, y0, x1, y1] = [Math.max(0, x0 - pad), Math.max(0, y0 - pad), Math.min(c.width - 1, x1 + pad), Math.min(c.height - 1, y1 + pad)]
    const o = document.createElement('canvas')
    o.width = x1 - x0 + 1
    o.height = y1 - y0 + 1
    o.getContext('2d').drawImage(c, -x0, -y0)
    return o.toDataURL('image/png')
  }, dataUrl(file))
  fs.writeFileSync(file, Buffer.from(trimmed.split(',')[1], 'base64'))
  await p.close()
  return trimmed
}
const art = path.join(OUT, 'art')
fs.mkdirSync(art, { recursive: true })
const crew = await still('scene=crew&t=2.2&alpha', 900, 560, path.join(art, 'crew.png'))
const house = await still('scene=house&t=2&alpha', 700, 520, path.join(art, 'house.png'))
const logo = `data:image/svg+xml;base64,${Buffer.from(fs.readFileSync(path.join(OUT, 'logos/babi-life-logo-on-dark.svg'))).toString('base64')}`
const qr = await QRCode.toDataURL(`${URL}?src=flyer`, { margin: 1, width: 600, errorCorrectionLevel: 'M', color: { dark: BRAND.ink, light: '#ffffff' } })

/** The flyer at a size: everything scales with --u (one unit = 1 % of the width). */
const html = ({ width, height, tall }) => {
  // Shorter pages (A5, the post) get a smaller picture and tighter cards.
  const k = tall ? 1 : Math.max(0.55, Math.min(1, (height / width - 1.1) / 0.45))
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${fontFaces()}
*{box-sizing:border-box;margin:0}
html,body{width:${width}px;height:${height}px}
body{--u:${width / 100}px;font-family:'Nunito',sans-serif;color:#fff;overflow:hidden;position:relative;
  background:linear-gradient(180deg,#1d1650 0%,#3a2378 30%,#5b2a86 48%,#d9466f 72%,#ff8a3d 92%,#ffc15e 100%)}
.stars i{position:absolute;width:calc(var(--u)*0.6);height:calc(var(--u)*0.6);background:#fff}
.page{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;padding:calc(var(--u)*${tall ? 6 : 4.5}) calc(var(--u)*6) calc(var(--u)*${tall ? 5 : 4})}
.logo{height:calc(var(--u)*9)}
.badge{margin-top:calc(var(--u)*3.5);display:inline-flex;align-items:center;gap:calc(var(--u)*1.6);border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.12);border-radius:999px;padding:calc(var(--u)*1.2) calc(var(--u)*3);font-weight:800;font-size:calc(var(--u)*2.9)}
.flag{display:flex;border-radius:2px;overflow:hidden}.flag i{display:block;width:calc(var(--u)*1.2);height:calc(var(--u)*2.6)}
h1{font-family:'Baloo 2';font-weight:800;text-align:center;line-height:.92;letter-spacing:-.02em;font-size:calc(var(--u)*${tall ? 10 : height / width > 1.35 ? 9.5 : 8.4});margin-top:calc(var(--u)*${tall ? 3 : 2.5})}
h1 em{font-style:normal;color:${BRAND.orange}}
.crew{flex:1 1 0;min-height:0;width:100%;object-fit:contain;margin:calc(var(--u)*${tall ? 4 : 2}) 0 calc(var(--u)*1);filter:drop-shadow(0 calc(var(--u)*2) calc(var(--u)*2) rgba(0,0,0,.35))}
.cards{width:100%;display:grid;gap:calc(var(--u)*${0.8 + 1.2 * k});margin-top:calc(var(--u)*${tall ? 4 : 1})}
.cards{font-size:calc(var(--u)*${k})}
.card{display:flex;align-items:center;gap:calc(var(--u)*3);background:rgba(15,18,48,.62);border:1px solid rgba(255,255,255,.18);border-radius:calc(var(--u)*4);padding:calc(var(--u)*${1.2 + k}) calc(var(--u)*3)}
.n{flex:none;display:grid;place-items:center;width:calc(var(--u)*${6 + 3 * k});height:calc(var(--u)*${6 + 3 * k});border-radius:calc(var(--u)*2.2);background:${BRAND.orange};font-family:'Baloo 2';font-weight:800;font-size:calc(var(--u)*${3.8 + 1.7 * k})}
.card b{display:block;font-family:'Baloo 2';font-weight:800;font-size:calc(var(--u)*${3.5 + 0.9 * k});line-height:1.05}
.card span{display:block;font-weight:700;font-size:calc(var(--u)*${2.6 + 0.5 * k});opacity:.85;margin-top:calc(var(--u)*.4)}
.card img{flex:none;width:calc(var(--u)*${10 + 6 * k});margin:calc(var(--u)*-2) 0 calc(var(--u)*-2) auto}
.cta{margin-top:calc(var(--u)*${tall ? 4 : 2.5});width:100%;display:flex;align-items:center;gap:calc(var(--u)*4);background:#fff;color:${BRAND.ink};border-radius:calc(var(--u)*5);padding:calc(var(--u)*${tall ? 3.5 : 2.6});box-shadow:0 calc(var(--u)*3) calc(var(--u)*6) rgba(0,0,0,.35)}
.cta img{flex:none;width:calc(var(--u)*${tall ? 30 : 18 + 6 * k});height:auto;image-rendering:pixelated}
.cta h2{font-family:'Baloo 2';font-weight:800;font-size:calc(var(--u)*${tall ? 6 : 4.2 + 1.4 * k});line-height:1}
.cta .url{margin-top:calc(var(--u)*1.8);font-family:'Baloo 2';font-weight:800;font-size:calc(var(--u)*4.6);color:${BRAND.orange}}
.cta p{margin-top:calc(var(--u)*1.4);font-weight:800;font-size:calc(var(--u)*3);color:#5a5f73;line-height:1.3}
${tall ? '' : `.cards{grid-template-columns:repeat(3,1fr)}
.card{flex-direction:column;justify-content:flex-start;text-align:center;gap:calc(var(--u)*1.4);padding:calc(var(--u)*2.2) calc(var(--u)*1.6)}
.card b{font-size:calc(var(--u)*3.4)}
.card span{font-size:calc(var(--u)*2.3)}
.card img{display:none}
.n{width:calc(var(--u)*7);height:calc(var(--u)*7);font-size:calc(var(--u)*4.4)}`}
.crew{min-height:calc(var(--u)*${tall ? 34 : height / width > 1.35 ? 30 : 15.5})}
.stripe{position:absolute;left:0;right:0;bottom:0;display:flex;height:calc(var(--u)*1.6)}.stripe i{flex:1}
</style></head><body>
<div class="stars">${[...Array(40)].map((_, i) => `<i style="left:${(i * 37.3) % 100}%;top:${(i * 13.7) % 34}%;opacity:${0.15 + ((i * 7) % 5) / 12}"></i>`).join('')}</div>
<div class="page">
  <img class="logo" src="${logo}" alt="Babi Life">
  <div class="badge"><span class="flag"><i style="background:#ff8200"></i><i style="background:#fff"></i><i style="background:#009a44"></i></span>Bientôt · Gratuit · 100 % ivoirien</div>
  <h1>Ta vie. Ton quartier.<br><em>Ton Babi.</em></h1>
  <img class="crew" src="${crew}" alt="">
  <div class="cards">
    <div class="card"><div class="n">1</div><div><b>Crée ton Sim en blocs</b><span>Pagne wax, boubou, survêt, coiffures</span></div></div>
    <div class="card"><div class="n">2</div><div><b>Construis ta maison</b><span>Banco, parpaing, tôle…</span></div><img src="${house}" alt=""></div>
    <div class="card"><div class="n">3</div><div><b>Vis Abidjan avec tes amis</b><span>Les vrais quartiers, au même moment</span></div></div>
  </div>
  <div class="cta">
    <img src="${qr}" alt="QR code vers ${SHORT}">
    <div><h2>Inscris-toi sur la liste d'attente</h2><div class="url">${SHORT}</div><p>Sois prévenu·e en premier<br>et teste avant tout le monde.</p></div>
  </div>
</div>
<div class="stripe"><i style="background:#ff8200"></i><i style="background:#fff"></i><i style="background:#009a44"></i></div>
</body></html>`
}

// A5 (148 × 210 mm) at 96 px an inch, for the PDF and the 300 dpi PNG.
const A5 = { width: 559, height: 794 }
const page = await b.newPage({ viewport: A5, deviceScaleFactor: 300 / 96 })
// Everything must fit on the page: say so if it doesn't.
const fits = async (p, h) => {
  const used = await p.evaluate(() => document.querySelector('.page').scrollHeight)
  if (used > h + 1) console.warn(`  needs ${used}px, has ${h}px`)
  return used <= h + 1
}
await page.setContent(html(A5), { waitUntil: 'load' })
if (!(await fits(page, A5.height))) console.warn('⚠️ the A5 flyer overflows its page')
else console.log('A5: fits')
await page.pdf({ path: path.join(OUT, 'babi-life-flyer-A5.pdf'), width: '148mm', height: '210mm', printBackground: true, pageRanges: '1' })
await page.screenshot({ path: path.join(OUT, 'babi-life-flyer-A5-300dpi.png') })
for (const [name, size] of [
  ['babi-life-flyer-post-1080x1350.png', { width: 1080, height: 1350 }],
  ['babi-life-flyer-status-1080x1920.png', { width: 1080, height: 1920, tall: true }],
]) {
  const s = await b.newPage({ viewport: size, deviceScaleFactor: 1 })
  await s.setContent(html(size), { waitUntil: 'load' })
  if (!(await fits(s, size.height))) console.warn(`⚠️ ${name} overflows`)
  await s.screenshot({ path: path.join(OUT, name) })
  await s.close()
}
await b.close()
console.log('flyer →', OUT)
process.exit(0)
