// « Les histoires du quartier » (the update « histoires »): a flyer for the stories, in French like the
// game. The pictures are the scenes of the stories' video (web/src/lab/histoiresWorld.tsx, poster.html
// ?scene=hist:…); the QR code leads to the game itself (no more wish list), marked ?src=flyer-histoires.
// An A5 to print (PDF, PNG at 300 dpi), a post (1080 × 1350) and a WhatsApp status (1080 × 1920).
//
// Needs the web app's dependencies (cd web && npm ci) and out/logos/ (npm run logos).

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import QRCode from 'qrcode'
import { BRAND, HERE, OUT, browser, fontFaces } from './shared.mjs'

const GAME = 'https://lifeinbabi.com/jeu'
const GAME_SHORT = 'lifeinbabi.com'
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
const art = path.join(OUT, 'art', 'histoires')
fs.mkdirSync(art, { recursive: true })

/** A picture of a scene of the stories, as a data URL. */
async function shot(scene, t, width, height) {
  const file = path.join(art, `${scene}.png`)
  const p = await b.newPage({ viewport: { width, height }, deviceScaleFactor: 2 })
  await p.goto(`http://127.0.0.1:${PORT}/poster.html?scene=hist:${scene}&t=${t}`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(3500)
  await p.screenshot({ path: file, timeout: 90000 })
  await p.close()
  return `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`
}

const logo = `data:image/svg+xml;base64,${fs.readFileSync(path.join(OUT, 'logos/babi-life-logo-on-light.svg')).toString('base64')}`
/** The street signs' fonts (web/src/index.css, .street): Anton, Alfa Slab One, Caveat. */
const signFonts = () => {
  const face = (family, file, weight) => `@font-face{font-family:'${family}';font-weight:${weight};src:url(data:font/woff2;base64,${fs.readFileSync(path.join(HERE, '../web/node_modules/@fontsource', file)).toString('base64')}) format('woff2')}`
  return [face('Anton', 'anton/files/anton-latin-400-normal.woff2', 400), face('Alfa Slab One', 'alfa-slab-one/files/alfa-slab-one-latin-400-normal.woff2', 400), face('Caveat', 'caveat/files/caveat-latin-700-normal.woff2', 700)].join('\n')
}
const qr = await QRCode.toDataURL(`${GAME}?src=flyer-histoires`, { margin: 1, width: 600, errorCorrectionLevel: 'M', color: { dark: BRAND.ink, light: '#ffffff' } })

const TILES = [
  { scene: 'grin', t: 2, title: 'Le petit-fils du vieux Koné', text: 'La famille' },
  { scene: 'cour', t: 2, title: 'La cour hantée', text: 'Le mystère' },
  { scene: 'maudit', t: 2, title: 'Le maquis maudit', text: 'La sorcellerie' },
  { scene: 'pari', t: 2, title: 'Le défi de la Dent de Man', text: 'Le pari' },
]
for (const tile of TILES) tile.img = await shot(tile.scene, tile.t, 520, 400)

// Painted like the signs of Abidjan's streets (the site's and the e-mails' style, web/src/index.css .street):
// a lime-washed wall, tall shop lettering, slab letters on the signs, the stories pinned like photos, the
// maquis' slate in chalk. Faded paint, flat colours.
const page = ({ width, height, tall }) => {
  const short = height / width < 1.3
  const U = (n) => `calc(var(--u)*${n})`
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${fontFaces()}
${signFonts()}
*{box-sizing:border-box;margin:0}
html,body{width:${width}px;height:${height}px}
body{--u:${width / 100}px;--wall:#efe4cc;--turq:#1f8f88;--rust:#b5432c;--ochre:#dda233;--brown:#2b1d14;--cream:#fbf5e6;
  font-family:'Nunito',sans-serif;color:var(--brown);overflow:hidden;position:relative;background-color:var(--wall);
  background-image:radial-gradient(rgba(90,60,30,.07) 1px,transparent 1.5px),radial-gradient(rgba(255,255,255,.22) 1px,transparent 1.6px);background-size:6px 6px,9px 9px;background-position:0 0,3px 4px}
.band{position:absolute;left:0;right:0;top:0;height:${U(tall ? 15 : 12)};background:var(--turq)}
.page{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;padding:${U(tall ? 3.6 : 2.6)} ${U(5)} ${U(tall ? 5 : 4)}}
.top{width:100%;display:flex;align-items:center;justify-content:space-between;height:${U(tall ? 8 : 6.6)}}
.top .logo{height:100%;background:var(--cream);border-radius:3px;padding:${U(1)} ${U(1.8)}}
.top .new{font-family:'Alfa Slab One';font-size:${U(tall ? 3.4 : 2.8)};color:var(--cream)}
.stripe{width:100%;height:${U(1.1)};display:flex;margin-top:${U(tall ? 3.2 : 2.4)}}.stripe i{flex:1}
h1{font-family:'Anton';text-transform:uppercase;line-height:.9;text-align:center;margin-top:${U(tall ? 4 : 2.8)};font-size:${U(tall ? 15 : short ? 10.5 : 12.5)};color:var(--rust);letter-spacing:.01em}
h1 span{display:block;color:var(--brown);font-size:.62em}
.lead{margin-top:${U(1.6)};font-family:'Alfa Slab One';text-align:center;font-size:${U(tall ? 3.6 : short ? 2.7 : 3.1)};line-height:1.25}
.lead em{font-style:normal;background:var(--ochre);padding:0 ${U(1)}}
.photos{flex:1 1 0;min-height:0;width:100%;display:grid;grid-template-columns:repeat(2,1fr);grid-template-rows:repeat(2,1fr);gap:${U(tall ? 4 : 3)} ${U(4)};margin:${U(tall ? 4.4 : 3)} 0 ${U(tall ? 4 : 2.6)};padding:0 ${U(1)}}
.taped{position:relative;background:#fff;padding:${U(1.2)} ${U(1.2)} ${U(tall ? 6.6 : 5.2)};box-shadow:0 1px 3px rgba(43,29,20,.3)}
.taped:nth-child(1){transform:rotate(-2.2deg)}.taped:nth-child(2){transform:rotate(1.8deg)}.taped:nth-child(3){transform:rotate(1.4deg)}.taped:nth-child(4){transform:rotate(-1.6deg)}
.taped::before{content:'';position:absolute;top:${U(-1.4)};left:50%;width:${U(11)};height:${U(3)};margin-left:${U(-5.5)};background:rgba(221,162,51,.72);transform:rotate(-3deg)}
.taped .pic{position:relative;width:100%;height:100%;overflow:hidden}
.taped img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.taped .kind{position:absolute;top:${U(1)};left:${U(1)};font-family:'Alfa Slab One';font-size:${U(tall ? 2.3 : 1.9)};color:var(--cream);background:var(--rust);padding:${U(.2)} ${U(1.2)};border-radius:2px}
.taped .cap{position:absolute;left:0;right:0;bottom:${U(.6)};text-align:center;font-family:'Caveat';font-weight:700;font-size:${U(tall ? 3.9 : short ? 3.4 : 3.9)};line-height:1;padding:0 ${U(1)};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ardoise{width:100%;display:flex;align-items:center;gap:${U(3.6)};background:#26332c;color:#f1eee4;border:${U(1.4)} solid #7a5534;border-radius:4px;padding:${U(tall ? 3 : 2.2)} ${U(3)}}
.ardoise img{flex:none;width:${U(tall ? 24 : short ? 15 : 18)};height:auto;background:#fff;padding:${U(1)};image-rendering:pixelated}
.ardoise .chalk{font-family:'Caveat';font-weight:700;font-size:${U(tall ? 4.2 : short ? 3.2 : 3.6)};line-height:1.1}
.ardoise .chalk b{color:var(--ochre)}
.ardoise .go{display:inline-block;margin-top:${U(1.4)};font-family:'Alfa Slab One';font-size:${U(tall ? 4.4 : short ? 3.4 : 3.8)};background:var(--rust);color:var(--cream);padding:${U(.8)} ${U(2.4)};border-radius:3px}
.ardoise .url{margin-top:${U(1)};font-family:'Alfa Slab One';font-size:${U(tall ? 3.4 : 2.7)};color:#f1eee4}
.foot{position:absolute;left:0;right:0;bottom:0;display:flex;height:${U(1.6)}}.foot i{flex:1}
</style></head><body>
<div class="band"></div>
<div class="page">
  <div class="top"><img class="logo" src="${logo}" alt="Babi Life"><span class="new">Nouveau · Gratuit</span></div>
  <div class="stripe"><i style="background:#f07a12"></i><i style="background:#fbf5e6"></i><i style="background:#0b6b3d"></i></div>
  <h1><span>Les histoires</span>du quartier</h1>
  <p class="lead">Chaque jour, <em>un nouveau chapitre.</em><br>Comme une série, mais c'est toi qui la vis.</p>
  <div class="photos">${TILES.map((t) => `<div class="taped"><div class="pic"><img src="${t.img}" alt=""><span class="kind">${t.text}</span></div><div class="cap">${t.title}</div></div>`).join('')}</div>
  <div class="ardoise">
    <img src="${qr}" alt="QR code vers ${GAME_SHORT}">
    <div><div class="chalk"><b>25</b> histoires · <b>1</b> chapitre par jour<br>Le début de chacune, lu par une voix</div><div class="go">Joue maintenant</div><div class="url">${GAME_SHORT}</div></div>
  </div>
</div>
<div class="foot"><i style="background:#f07a12"></i><i style="background:#fbf5e6"></i><i style="background:#0b6b3d"></i></div>
</body></html>`
}

// A5 (148 × 210 mm) at 96 px an inch, for the PDF and the 300 dpi PNG; then the phone sizes.
const A5 = { width: 559, height: 794 }
const p = await b.newPage({ viewport: A5, deviceScaleFactor: 300 / 96 })
await p.setContent(page(A5), { waitUntil: 'load' })
if (await p.evaluate(() => document.querySelector('.page').scrollHeight > innerHeight + 1)) console.warn('⚠️ the A5 overflows its page')
await p.pdf({ path: path.join(OUT, 'babi-life-flyer-histoires-A5.pdf'), width: '148mm', height: '210mm', printBackground: true, pageRanges: '1' })
await p.screenshot({ path: path.join(OUT, 'babi-life-flyer-histoires-A5-300dpi.png') })
await p.close()
for (const [suffix, size] of [
  ['post-1080x1350', { width: 1080, height: 1350 }],
  ['status-1080x1920', { width: 1080, height: 1920, tall: true }],
]) {
  const s = await b.newPage({ viewport: size, deviceScaleFactor: 1 })
  await s.setContent(page(size), { waitUntil: 'load' })
  if (await s.evaluate(() => document.querySelector('.page').scrollHeight > innerHeight + 1)) console.warn(`⚠️ the ${suffix} overflows its page`)
  await s.screenshot({ path: path.join(OUT, `babi-life-flyer-histoires-${suffix}.png`) })
  await s.close()
}
console.log('flyer histoires: done')
await b.close()
process.exit(0) // the Vite server would keep it running
