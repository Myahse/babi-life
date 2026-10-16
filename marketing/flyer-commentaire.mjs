// A flyer for the comments: « Tu es tombé·e dans quelle famille ? ». The
// six families of the game (game/life.go), each at the birth with its odds,
// and the call to create one's Sim on the wish list, then say in the
// comments which family the draw gave. In French like the game.
// As an A5 to print (PDF, PNG at 300 dpi), a post (1080 × 1350) and a
// WhatsApp status (1080 × 1920). The pictures are the game's own scenes
// (web/src/lab/poster.tsx, famille-<id>); the QR code leads to the wish list,
// marked ?src=flyer-commentaire.
//
// Needs the web app's dependencies (cd web && npm ci) and out/logos/ (npm run logos).

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import QRCode from 'qrcode'
import { BRAND, HERE, OUT, SHORT, URL, browser, fontFaces } from './shared.mjs'

const PORT = 5241
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

// Richest first, as in game/life.go (Weight: how often a Sim is born into it).
const FAMILIES = [
  { id: 'debout', label: 'Debout', odds: '4 %', text: 'Villa, chauffeur, papa DG', rich: true },
  { id: 'late', label: 'Laté', odds: '8 %', text: 'Bazin, or et piscine', rich: true },
  { id: 'lagnon', label: 'Lagnon', odds: '15 %', text: 'L’appart, Assinie le week-end' },
  { id: 'poignon', label: 'Poignon', odds: '33 %', text: 'Ça va, on gère' },
  { id: 'coule', label: 'Coulé', odds: '25 %', text: 'Entrer-coucher, on se débrouille' },
  { id: 'gnambro', label: 'Gnambro', odds: '15 %', text: 'Même les mouches sont là' },
]
for (const f of FAMILIES) f.img = await shot(`famille-${f.id}`, 2, 480, 520)

const logo = `data:image/svg+xml;base64,${fs.readFileSync(path.join(OUT, 'logos/babi-life-logo-on-dark.svg')).toString('base64')}`
const qr = await QRCode.toDataURL(`${URL}?src=flyer-commentaire`, { margin: 1, width: 600, errorCorrectionLevel: 'M', color: { dark: BRAND.ink, light: '#ffffff' } })

// What people might answer: the comments the flyer asks for.
const COMMENTS = [
  { who: 'aya.k', text: 'Laté ! Papa paie tout', fam: 'late' },
  { who: 'kouame_225', text: 'Gnambro… même les mouches me suivent', fam: 'gnambro' },
]

const page = ({ width, height, tall }) => {
  const short = height / width < 1.3
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${fontFaces()}
*{box-sizing:border-box;margin:0}
html,body{width:${width}px;height:${height}px}
body{--u:${width / 100}px;font-family:'Nunito',sans-serif;color:#fff;overflow:hidden;position:relative;
  background:linear-gradient(180deg,#1d1650 0%,#3a2378 30%,#5b2a86 52%,#d9466f 78%,#ff8a3d 94%,#ffc15e 100%)}
.stars i{position:absolute;width:calc(var(--u)*0.6);height:calc(var(--u)*0.6);background:#fff}
.page{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;padding:calc(var(--u)*${tall ? 6 : 4}) calc(var(--u)*5) calc(var(--u)*${tall ? 5 : 3.6})}
.logo{height:calc(var(--u)*${tall ? 8.5 : 6.5})}
h1{font-family:'Baloo 2';font-weight:800;text-align:center;line-height:.95;letter-spacing:-.02em;margin-top:calc(var(--u)*${tall ? 3 : 1.8});font-size:calc(var(--u)*${tall ? 10.4 : short ? 7.2 : 8.6})}
h1 em{font-style:normal;color:${BRAND.orange}}
.lead{margin-top:calc(var(--u)*1.4);text-align:center;font-weight:800;font-size:calc(var(--u)*${tall ? 3.5 : short ? 2.5 : 2.9});opacity:.92;line-height:1.3}
.grid{flex:1 1 0;min-height:0;width:100%;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(2,1fr);gap:calc(var(--u)*${tall ? 2.4 : 1.8});margin:calc(var(--u)*${tall ? 3.4 : 2.2}) 0 calc(var(--u)*${tall ? 2.6 : 1.8})}
.fam{position:relative;border-radius:calc(var(--u)*3);overflow:hidden;border:calc(var(--u)*.45) solid rgba(255,255,255,.8);background:#0f1230}
.fam.rich{border-color:${BRAND.gold}}
.fam img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.fam .odds{position:absolute;top:calc(var(--u)*1.1);right:calc(var(--u)*1.1);background:rgba(15,18,48,.85);font-weight:900;font-size:calc(var(--u)*${tall ? 2.5 : short ? 1.7 : 2.1});padding:calc(var(--u)*.4) calc(var(--u)*1.2);border-radius:999px}
.fam .cap{position:absolute;left:0;right:0;bottom:0;padding:calc(var(--u)*${tall ? 1.6 : 1}) calc(var(--u)*1.3) calc(var(--u)*${tall ? 1.4 : .9});background:linear-gradient(180deg,rgba(15,18,48,0),rgba(15,18,48,.92) 45%)}
.fam b{display:block;font-family:'Baloo 2';font-weight:800;font-size:calc(var(--u)*${tall ? 4 : short ? 2.7 : 3.2});line-height:1}
.fam.rich b{color:${BRAND.gold}}
.fam span{display:block;font-weight:800;font-size:calc(var(--u)*${tall ? 2.2 : short ? 1.55 : 1.85});opacity:.85;margin-top:calc(var(--u)*.3);line-height:1.15}
.talk{width:100%;display:flex;flex-direction:column;gap:calc(var(--u)*${tall ? 1.6 : 1.1})}
.ask{align-self:center;display:inline-flex;align-items:center;gap:calc(var(--u)*1.6);background:${BRAND.orange};border-radius:999px;padding:calc(var(--u)*${tall ? 1.5 : 1.1}) calc(var(--u)*3.4);font-family:'Baloo 2';font-weight:800;font-size:calc(var(--u)*${tall ? 4.6 : short ? 3.2 : 3.8});box-shadow:0 calc(var(--u)*1.2) calc(var(--u)*3) rgba(0,0,0,.3)}
.ask svg{width:1em;height:1em}
.c{display:flex;align-items:flex-start;gap:calc(var(--u)*1.6);background:rgba(255,255,255,.95);color:${BRAND.ink};border-radius:calc(var(--u)*3) calc(var(--u)*3) calc(var(--u)*3) calc(var(--u)*.8);padding:calc(var(--u)*${tall ? 1.6 : 1.1}) calc(var(--u)*2.2);font-weight:800;font-size:calc(var(--u)*${tall ? 2.9 : short ? 2 : 2.4});line-height:1.25;max-width:88%}
.c.r{align-self:flex-end;border-radius:calc(var(--u)*3) calc(var(--u)*3) calc(var(--u)*.8) calc(var(--u)*3)}
.c i{flex:none;width:calc(var(--u)*${tall ? 5.4 : 4});height:calc(var(--u)*${tall ? 5.4 : 4});border-radius:50%;background-size:cover;background-position:50% 30%;border:2px solid #fff;box-shadow:0 0 0 1px #ddd}
.c small{display:block;font-size:.78em;color:#7a7f93}
${short ? '.c.r{display:none}' : ''}
.cta{margin-top:calc(var(--u)*${tall ? 3 : 2});width:100%;display:flex;align-items:center;gap:calc(var(--u)*3.4);background:#fff;color:${BRAND.ink};border-radius:calc(var(--u)*4.5);padding:calc(var(--u)*${tall ? 3 : 2});box-shadow:0 calc(var(--u)*3) calc(var(--u)*6) rgba(0,0,0,.35)}
.cta img{flex:none;width:calc(var(--u)*${tall ? 24 : short ? 15 : 18});height:auto;image-rendering:pixelated}
.cta h2{font-family:'Baloo 2';font-weight:800;font-size:calc(var(--u)*${tall ? 5 : short ? 3.4 : 4});line-height:1}
.cta .url{margin-top:calc(var(--u)*1.2);font-family:'Baloo 2';font-weight:800;font-size:calc(var(--u)*${tall ? 4.2 : 3.4});color:${BRAND.orange}}
.cta p{margin-top:calc(var(--u)*.9);font-weight:800;font-size:calc(var(--u)*${tall ? 2.7 : 2.2});color:#5a5f73;line-height:1.3}
.stripe{position:absolute;left:0;right:0;bottom:0;display:flex;height:calc(var(--u)*1.6)}.stripe i{flex:1}
</style></head><body>
<div class="stars">${[...Array(40)].map((_, i) => `<i style="left:${(i * 37.3) % 100}%;top:${(i * 13.7) % 30}%;opacity:${0.15 + ((i * 7) % 5) / 12}"></i>`).join('')}</div>
<div class="page">
  <img class="logo" src="${logo}" alt="Babi Life">
  <h1>Tu es tombé·e dans<br>quelle <em>famille</em> ?</h1>
  <p class="lead">Crée ton perso : ta famille est tirée au sort.<br>Laté ou gnambro, dis-le-nous en commentaire !</p>
  <div class="grid">${FAMILIES.map((f) => `<div class="fam${f.rich ? ' rich' : ''}"><img src="${f.img}" alt=""><i class="odds">${f.odds}</i><div class="cap"><b>${f.label}</b><span>${f.text}</span></div></div>`).join('')}</div>
  <div class="talk">
    <div class="ask"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"/></svg>Écris ta famille en commentaire</div>
    ${COMMENTS.map((c, i) => `<div class="c${i % 2 ? ' r' : ''}"><i style="background-image:url(${FAMILIES.find((f) => f.id === c.fam).img})"></i><div><small>@${c.who}</small>${c.text}</div></div>`).join('')}
  </div>
  <div class="cta">
    <img src="${qr}" alt="QR code vers ${SHORT}">
    <div><h2>Crée ton perso et découvre ta famille</h2><div class="url">${SHORT}</div><p>Gratuit, sur la liste d'attente.<br>Puis reviens commenter !</p></div>
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
await a5.pdf({ path: path.join(OUT, 'babi-life-flyer-commentaire-A5.pdf'), width: '148mm', height: '210mm', printBackground: true, pageRanges: '1' })
await a5.screenshot({ path: path.join(OUT, 'babi-life-flyer-commentaire-A5-300dpi.png') })
await a5.close()
for (const [suffix, size] of [
  ['post-1080x1350', { width: 1080, height: 1350 }],
  ['status-1080x1920', { width: 1080, height: 1920, tall: true }],
]) {
  const s = await b.newPage({ viewport: size, deviceScaleFactor: 1 })
  await s.setContent(page(size), { waitUntil: 'load' })
  if (await s.evaluate(() => document.querySelector('.page').scrollHeight > innerHeight + 1)) console.warn(`⚠️ the ${suffix} overflows`)
  await s.screenshot({ path: path.join(OUT, `babi-life-flyer-commentaire-${suffix}.png`) })
  await s.close()
}
console.log('flyer commentaire: done')
await b.close()
process.exit(0) // the Vite server would keep it running
