// Two more flyers, in French like the game:
// - « famille » goes with the trailer: « Tu nais gnambro ou laté ? », the two
//   families at the birth, side by side;
// - « découverte » goes with the tour video: everything there is to do, nine
//   pictures from the game.
// Each as an A5 to print (PDF, PNG at 300 dpi), a post (1080 × 1350) and a
// WhatsApp status (1080 × 1920). The pictures are the game's own scenes
// (web/src/lab/poster.tsx); the QR codes lead to the wish list, marked
// ?src=flyer-famille and ?src=flyer-decouverte.
//
// Needs the web app's dependencies (cd web && npm ci) and out/logos/ (npm run logos).

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import QRCode from 'qrcode'
import { BRAND, HERE, OUT, SHORT, URL, browser, fontFaces } from './shared.mjs'

const PORT = 5239
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

const logo = `data:image/svg+xml;base64,${fs.readFileSync(path.join(OUT, 'logos/babi-life-logo-on-dark.svg')).toString('base64')}`
const qrFor = (src) => QRCode.toDataURL(`${URL}?src=${src}`, { margin: 1, width: 600, errorCorrectionLevel: 'M', color: { dark: BRAND.ink, light: '#ffffff' } })

const gnambro = await shot('famille-gnambro', 2, 480, 600)
const debout = await shot('famille-debout', 2, 480, 600)
const TILES = [
  { scene: 'crew', t: 2.2, title: 'Crée ton Sim', text: 'Teint, coiffure, pagne, boubou' },
  { scene: 'look', t: 2, title: 'Change de look', text: "L'armoire, le coiffeur" },
  { scene: 'famille-gnambro', t: 2, title: 'Nais dans une famille', text: 'De gnambro à laté' },
  { scene: 'house', t: 2, title: 'Construis ta maison', text: 'Banco, parpaing, tôle' },
  { scene: 'gbaka', t: 3.2, title: 'Gbaka et Gnango', text: '« Adjamé ! Yop ! »' },
  { scene: 'cause', t: 3, title: 'Cause avec les gens', text: '« C’est comment ? »', bubble: 'Y a fohi !' },
  { scene: 'fete', t: 2, title: 'Fais la fête', text: 'Maquis, travaillement' },
  { scene: 'basket', t: 1.5, title: 'Fais du sport', text: 'Au Palais des Sports' },
  { scene: 'siporex', t: 2, title: 'Les vrais lieux', text: 'Siporex, Rue Princesse…' },
]
for (const tile of TILES) tile.img = await shot(tile.scene, tile.t, 520, 400)
const qrFamille = await qrFor('flyer-famille')
const qrDecouverte = await qrFor('flyer-decouverte')

/** What both flyers share: the page, the logo, the badge, the call to sign up. */
const frame = ({ width, height, tall }, body, qr) => `<!doctype html><html><head><meta charset="utf-8"><style>
${fontFaces()}
*{box-sizing:border-box;margin:0}
html,body{width:${width}px;height:${height}px}
body{--u:${width / 100}px;font-family:'Nunito',sans-serif;color:#fff;overflow:hidden;position:relative;
  background:linear-gradient(180deg,#1d1650 0%,#3a2378 30%,#5b2a86 52%,#d9466f 78%,#ff8a3d 94%,#ffc15e 100%)}
.stars i{position:absolute;width:calc(var(--u)*0.6);height:calc(var(--u)*0.6);background:#fff}
.page{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;padding:calc(var(--u)*${tall ? 6 : 4.5}) calc(var(--u)*5.5) calc(var(--u)*${tall ? 5 : 4})}
.logo{height:calc(var(--u)*${tall ? 9 : 7.5})}
.badge{margin-top:calc(var(--u)*2.6);display:inline-flex;align-items:center;gap:calc(var(--u)*1.6);border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.12);border-radius:999px;padding:calc(var(--u)*1.1) calc(var(--u)*3);font-weight:800;font-size:calc(var(--u)*2.7)}
.flag{display:flex;border-radius:2px;overflow:hidden}.flag i{display:block;width:calc(var(--u)*1.2);height:calc(var(--u)*2.6)}
h1{font-family:'Baloo 2';font-weight:800;text-align:center;line-height:.92;letter-spacing:-.02em;margin-top:calc(var(--u)*2.4)}
h1 em{font-style:normal;color:${BRAND.orange}}
.lead{margin-top:calc(var(--u)*1.6);text-align:center;font-weight:800;font-size:calc(var(--u)*${tall ? 3.6 : 3});opacity:.92;line-height:1.3}
.cta{margin-top:auto;width:100%;display:flex;align-items:center;gap:calc(var(--u)*4);background:#fff;color:${BRAND.ink};border-radius:calc(var(--u)*5);padding:calc(var(--u)*${tall ? 3.4 : 2.4});box-shadow:0 calc(var(--u)*3) calc(var(--u)*6) rgba(0,0,0,.35)}
.cta img{flex:none;width:calc(var(--u)*${tall ? 28 : 20});height:auto;image-rendering:pixelated}
.cta h2{font-family:'Baloo 2';font-weight:800;font-size:calc(var(--u)*${tall ? 5.6 : 4.4});line-height:1}
.cta .url{margin-top:calc(var(--u)*1.6);font-family:'Baloo 2';font-weight:800;font-size:calc(var(--u)*4.4);color:${BRAND.orange}}
.cta p{margin-top:calc(var(--u)*1.2);font-weight:800;font-size:calc(var(--u)*2.8);color:#5a5f73;line-height:1.3}
.stripe{position:absolute;left:0;right:0;bottom:0;display:flex;height:calc(var(--u)*1.6)}.stripe i{flex:1}
${body.css}
</style></head><body>
<div class="stars">${[...Array(40)].map((_, i) => `<i style="left:${(i * 37.3) % 100}%;top:${(i * 13.7) % 30}%;opacity:${0.15 + ((i * 7) % 5) / 12}"></i>`).join('')}</div>
<div class="page">
  <img class="logo" src="${logo}" alt="Babi Life">
  <div class="badge"><span class="flag"><i style="background:#ff8200"></i><i style="background:#fff"></i><i style="background:#009a44"></i></span>Bientôt · Gratuit · 100 % ivoirien</div>
  ${body.html}
  <div class="cta">
    <img src="${qr}" alt="QR code vers ${SHORT}">
    <div><h2>${body.cta}</h2><div class="url">${SHORT}</div><p>Sois prévenu·e en premier<br>et teste avant tout le monde.</p></div>
  </div>
</div>
<div class="stripe"><i style="background:#ff8200"></i><i style="background:#fff"></i><i style="background:#009a44"></i></div>
</body></html>`

/** « Tu nais gnambro ou laté ? »: the two families at the birth. */
const famille = (size) => {
  const { width, height, tall } = size
  const short = height / width < 1.3
  return frame(
    size,
    {
      css: `h1{font-size:calc(var(--u)*${tall ? 11.5 : short ? 8.4 : 10})}
.duo{flex:1 1 0;min-height:0;width:100%;display:grid;grid-template-columns:1fr 1fr;gap:calc(var(--u)*3);margin:calc(var(--u)*${tall ? 4 : 2.6}) 0}
.fam{position:relative;border-radius:calc(var(--u)*4);overflow:hidden;border:calc(var(--u)*.6) solid rgba(255,255,255,.85);box-shadow:0 calc(var(--u)*2) calc(var(--u)*4) rgba(0,0,0,.35)}
.fam img{width:100%;height:100%;object-fit:cover;display:block}
.fam b{position:absolute;left:50%;bottom:calc(var(--u)*2);transform:translateX(-50%);white-space:nowrap;font-family:'Baloo 2';font-weight:800;font-size:calc(var(--u)*${tall ? 4.6 : 3.8});padding:calc(var(--u)*.6) calc(var(--u)*2.6);border-radius:999px;background:${BRAND.ink}}
.fam.rich b{background:${BRAND.gold};color:${BRAND.ink}}
.vs{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:calc(var(--u)*10);height:calc(var(--u)*10);border-radius:50%;display:grid;place-items:center;background:${BRAND.orange};font-family:'Baloo 2';font-weight:800;font-size:calc(var(--u)*4);box-shadow:0 0 0 calc(var(--u)*.8) #fff}
.duo{position:relative}`,
      html: `<h1>Tu nais <em>gnambro</em><br>ou laté ?</h1>
  <p class="lead">Crée ton Sim : ta famille est tirée au sort.<br>Ta vie à Abidjan, c'est toi qui la fais.</p>
  <div class="duo">
    <div class="fam"><img src="${gnambro}" alt=""><b>Famille gnambro</b></div>
    <div class="fam rich"><img src="${debout}" alt=""><b>Famille laté</b></div>
    <div class="vs">ou</div>
  </div>`,
      cta: 'Crée ton Sim sur la liste d’attente',
    },
    qrFamille,
  )
}

/** Everything there is to do, nine pictures. */
const decouverte = (size) => {
  const { width, height, tall } = size
  const short = height / width < 1.3
  return frame(
    size,
    {
      css: `h1{font-size:calc(var(--u)*${tall ? 9.6 : short ? 6.6 : 8})}
.grid{flex:1 1 0;min-height:0;width:100%;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);gap:calc(var(--u)*${tall ? 2.4 : 1.8});margin:calc(var(--u)*${tall ? 4 : 2.4}) 0}
.tile{position:relative;border-radius:calc(var(--u)*3);overflow:hidden;background:#0f1230;border:1px solid rgba(255,255,255,.25)}
.tile img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.tile .cap{position:absolute;left:0;right:0;bottom:0;padding:calc(var(--u)*${tall ? 1.6 : 1.1}) calc(var(--u)*1.4) calc(var(--u)*${tall ? 1.4 : 1});background:linear-gradient(180deg,rgba(15,18,48,0),rgba(15,18,48,.92) 45%)}
.tile b{display:block;font-family:'Baloo 2';font-weight:800;font-size:calc(var(--u)*${tall ? 3.3 : short ? 2.3 : 2.7});line-height:1.05}
.tile span{display:block;font-weight:800;font-size:calc(var(--u)*${tall ? 2.3 : short ? 1.7 : 2});opacity:.85;margin-top:calc(var(--u)*.3)}
.tile .n{position:absolute;top:calc(var(--u)*1.2);left:calc(var(--u)*1.2);width:calc(var(--u)*${tall ? 5.4 : 4.2});height:calc(var(--u)*${tall ? 5.4 : 4.2});border-radius:50%;display:grid;place-items:center;background:${BRAND.orange};font-family:'Baloo 2';font-weight:800;font-size:calc(var(--u)*${tall ? 3 : 2.4})}
.tile .bubble{position:absolute;top:calc(var(--u)*2);right:calc(var(--u)*1.4);background:#fff;color:${BRAND.ink};font-weight:800;font-size:calc(var(--u)*${tall ? 2.2 : 1.8});padding:calc(var(--u)*.6) calc(var(--u)*1.4);border-radius:calc(var(--u)*2) calc(var(--u)*2) calc(var(--u)*2) calc(var(--u)*.4)}`,
      html: `<h1>Tout ce que tu peux<br>faire à <em>Babi</em></h1>
  <div class="grid">${TILES.map((t, i) => `<div class="tile"><img src="${t.img}" alt=""><i class="n">${i + 1}</i>${t.bubble ? `<span class="bubble">${t.bubble}</span>` : ''}<div class="cap"><b>${t.title}</b><span>${t.text}</span></div></div>`).join('')}</div>`,
      cta: 'Inscris-toi sur la liste d’attente',
    },
    qrDecouverte,
  )
}

// A5 (148 × 210 mm) at 96 px an inch, for the PDF and the 300 dpi PNG; then the phone sizes.
const A5 = { width: 559, height: 794 }
for (const [name, make] of [
  ['famille', famille],
  ['decouverte', decouverte],
]) {
  const page = await b.newPage({ viewport: A5, deviceScaleFactor: 300 / 96 })
  await page.setContent(make(A5), { waitUntil: 'load' })
  const over = await page.evaluate(() => document.querySelector('.page').scrollHeight > innerHeight + 1)
  if (over) console.warn(`⚠️ the ${name} A5 overflows its page`)
  await page.pdf({ path: path.join(OUT, `babi-life-flyer-${name}-A5.pdf`), width: '148mm', height: '210mm', printBackground: true, pageRanges: '1' })
  await page.screenshot({ path: path.join(OUT, `babi-life-flyer-${name}-A5-300dpi.png`) })
  await page.close()
  for (const [suffix, size] of [
    ['post-1080x1350', { width: 1080, height: 1350 }],
    ['status-1080x1920', { width: 1080, height: 1920, tall: true }],
  ]) {
    const s = await b.newPage({ viewport: size, deviceScaleFactor: 1 })
    await s.setContent(make(size), { waitUntil: 'load' })
    await s.screenshot({ path: path.join(OUT, `babi-life-flyer-${name}-${suffix}.png`) })
    await s.close()
  }
  console.log(`flyer ${name}: done`)
}
await b.close()
