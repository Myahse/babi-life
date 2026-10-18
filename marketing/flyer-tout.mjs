// The « tout ce que tu peux faire » flyer: twelve pictures from the game,
// the rest as labels, the launch date and the QR code to lifeinbabi.com.
// A WhatsApp status (1080 × 1920) and a post (1080 × 1350). The pictures are
// in out/art/tout/ (screenshots of the game and its labs); the QR is marked
// ?src=flyer-tout.

import fs from 'node:fs'
import path from 'node:path'
import QRCode from 'qrcode'
import { BRAND, OUT, SHORT, URL, browser, fontFaces } from './shared.mjs'

const ART = path.join(OUT, 'art/tout')
const img = (f) => `data:image/png;base64,${fs.readFileSync(path.join(ART, f)).toString('base64')}`
const size = (f) => {
  const b = fs.readFileSync(path.join(ART, f))
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }
}

// crop: the part of the picture to show, in its pixels (none: the middle).
const TILES = [
  { f: 'famille-gnambro.png', t: 'Nais à Babi', s: 'Ta famille ? Tirée au sort' },
  { f: 'fete.png', t: 'Le maquis', s: 'Braisé, pot, travaillement' },
  { f: 'grin.png', t: 'Le garba', s: 'Brochettes, alloco…', crop: [0, 60, 448, 420] },
  { f: 'stade-match.png', t: 'Le stade', s: 'Matchs et concerts', crop: [0, 60, 900, 380] },
  { f: 'zoo-entree.png', t: "Le zoo d'Abidjan", s: 'Lions, éléphant, zèbres…', crop: [160, 120, 960, 560] },
  { f: 'bet2.png', t: 'Paris foot', s: 'Un match toutes les 15 min', crop: [476, 112, 360, 300] },
  { f: 'loto1.png', t: 'Loto Chance', s: '7 tirages par jour', crop: [180, 20, 680, 500] },
  { f: 'grin.png', t: 'Le grin', s: 'Cause avec tout Babi', crop: [470, 70, 370, 330] },
  { f: 'gbaka.png', t: 'Le gbaka', s: 'Woro-woro, taxi' },
  { f: 'look.png', t: 'Ton look', s: 'Barbier, salon, pagne' },
  { f: 'basket.png', t: 'Le sport', s: 'Foot, basket, salle' },
  { f: 'siporex.png', t: 'Les vrais lieux', s: 'Siporex, Rue Princesse…' },
]
const MORE = ['🏖️ La plage', '🌅 La lagune', '🏨 Hôtel Ivoire', '🛖 Village ébrié', '💃 La boîte', '🛵 Livraison Golvo', '💸 Waye', '📹 Tikitoko', '🏠 Ta maison', '💼 Ton travail', '🎓 Université', '🏛️ Mairie']

/** A picture cut to a tile of w × h: the crop scaled to cover it. */
function picture(tile, w, h) {
  const { w: iw, h: ih } = size(tile.f)
  const [cx, cy, cw, ch] = tile.crop ?? [0, 0, iw, ih]
  const k = Math.max(w / cw, h / ch)
  const x = -(cx * k) - (cw * k - w) / 2
  const y = -(cy * k) - (ch * k - h) / 2
  return `<div class="pic" style="width:${w}px;height:${h}px;background-image:url(${img(tile.f)});background-size:${iw * k}px ${ih * k}px;background-position:${x}px ${y}px"></div>`
}

const logo = `data:image/svg+xml;base64,${fs.readFileSync(path.join(OUT, 'logos/babi-life-logo-on-dark.svg')).toString('base64')}`
const qr = await QRCode.toDataURL(`${URL}?src=flyer-tout`, { margin: 1, width: 600, errorCorrectionLevel: 'M', color: { dark: BRAND.ink, light: '#ffffff' } })

function page({ width, height, cols, picH, title, pad, chip }) {
  const gap = 18
  const tileW = Math.floor((width - pad * 2 - gap * (cols - 1)) / cols)
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${fontFaces()}
*{box-sizing:border-box;margin:0}
html,body{width:${width}px;height:${height}px}
body{font-family:'Nunito','Noto Color Emoji',sans-serif;color:#fff;overflow:hidden;
  background:linear-gradient(180deg,#1d1650 0%,#3a2378 30%,#5b2a86 55%,#d9466f 82%,#ff8a3d 96%,#ffc15e 100%)}
.page{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;padding:${pad}px}
.logo{height:${title}px}
h1{font-family:'Baloo 2';font-weight:800;font-size:${title * 0.9}px;line-height:.95;text-align:center;margin-top:14px;letter-spacing:-.01em}
h1 em{font-style:normal;color:${BRAND.orange}}
.grid{display:grid;grid-template-columns:repeat(${cols},${tileW}px);gap:${gap}px;margin-top:${pad * 0.55}px}
.tile{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);border-radius:22px;overflow:hidden}
.pic{background-repeat:no-repeat}
.cap{padding:8px 14px 10px}
.cap b{display:block;font-family:'Baloo 2';font-weight:800;font-size:${tileW * 0.105}px;line-height:1.05}
.cap span{display:block;font-weight:700;font-size:${tileW * 0.068}px;opacity:.85;margin-top:2px}
.more{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;margin-top:${pad * 0.5}px}
.more span{background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.22);border-radius:999px;padding:6px 14px;font-weight:800;font-size:${chip}px}
.cta{margin-top:auto;margin-bottom:0;width:100%;display:flex;align-items:center;gap:30px;background:#fff;color:${BRAND.ink};border-radius:34px;padding:22px 30px;box-shadow:0 20px 50px rgba(0,0,0,.35)}
.cta img{width:${height > 1500 ? 190 : 150}px;image-rendering:pixelated}
.cta .when{font-family:'Baloo 2';font-weight:800;font-size:${width * 0.062}px;line-height:1;color:${BRAND.orange}}
.cta .what{font-weight:800;font-size:${width * 0.033}px;margin-top:8px}
.cta .url{font-family:'Baloo 2';font-weight:800;font-size:${width * 0.045}px;margin-top:6px}
</style></head><body><div class="page">
<img class="logo" src="${logo}">
<h1>Tout ce que tu peux <em>faire à Babi</em></h1>
<div class="grid">${TILES.map((t) => `<div class="tile">${picture(t, tileW, picH)}<div class="cap"><b>${t.t}</b><span>${t.s}</span></div></div>`).join('')}</div>
<div class="more">${MORE.map((m) => `<span>${m}</span>`).join('')}<span>…et encore plus</span></div>
<div class="cta"><img src="${qr}"><div><div class="when">Lundi 19 octobre</div><div class="what">Gratuit · 100 % ivoirien</div><div class="url">${SHORT.replace(/\/liste$/, '')}</div></div></div>
</div></body></html>`
}

const b = await browser()
for (const v of [
  { name: 'status-1080x1920', width: 1080, height: 1920, cols: 3, picH: 190, title: 70, pad: 48, chip: 24 },
  { name: 'post-1080x1350', width: 1080, height: 1350, cols: 4, picH: 150, title: 50, pad: 34, chip: 20 },
]) {
  const p = await b.newPage({ viewport: { width: v.width, height: v.height } })
  await p.setContent(page(v), { waitUntil: 'load' })
  await p.waitForTimeout(500)
  await p.screenshot({ path: path.join(OUT, `babi-life-flyer-tout-${v.name}.png`) })
  await p.close()
  console.log(v.name)
}
await b.close()
