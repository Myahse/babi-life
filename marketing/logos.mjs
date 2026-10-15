// The logos: the app's mark (a green plumbob over the Abidjan sun), the app
// icon, the wordmark « Babi Life » beside or under it, single-colour
// versions, and a pixel mark in the blocky style of the Sims. Every file is
// an SVG with the text in outlines, plus PNGs with a transparent background.

import fs from 'node:fs'
import path from 'node:path'
import { BRAND, OUT, browser, textPath } from './shared.mjs'

const dir = path.join(OUT, 'logos')
fs.mkdirSync(dir, { recursive: true })

/** The mark, 64 units square (as web/src/components/ui.tsx draws it). */
const mark = (id, mono) =>
  mono
    ? `<rect width="64" height="64" rx="16" fill="${mono}"/>
<path d="M32 9 43 26 32 43 21 26Z" fill="${mono === '#ffffff' ? BRAND.night : '#ffffff'}"/>`
    : `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b1f4b"/><stop offset="1" stop-color="#7a2f6e"/></linearGradient></defs>
<rect width="64" height="64" rx="16" fill="url(#${id})"/>
<circle cx="32" cy="42" r="18" fill="#ff8a1a"/>
<path d="M8 64V46h7v-6h6v24M43 64V40h7v6h6v18" fill="#0f1230" opacity="0.9"/>
<path d="M32 9 43 26 32 43 21 26Z" fill="#00b86b"/>
<path d="M32 9 43 26H32Z" fill="#fff" opacity="0.38"/>
<path d="M21 26h11v17Z" fill="#000" opacity="0.18"/>`

/** The same mark in pixels, 16 × 16: the blocky Sims' world. */
function pixelMark() {
  const px = []
  const put = (x, y, c) => px.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${c}"/>`)
  const sky = ['#1b1f4b', '#1b1f4b', '#25265a', '#2f2b62', '#3a2f68', '#46316c', '#53336e', '#5f356f', '#6a3670', '#743870', '#7a3a6f', '#80406e', '#86466c', '#8c4c6a', '#924f69', '#985268']
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(x, y, sky[y])
  // The sun, low over the lagoon
  for (let y = 9; y < 16; y++) for (let x = 0; x < 16; x++) if ((x - 7.5) ** 2 + (y - 13.5) ** 2 < 20) put(x, y, y < 11 ? '#ffc233' : y < 13 ? '#ffa020' : '#ff8a1a')
  // The skyline of the Plateau, across the bottom, the sun behind it
  for (const [x, top] of [[0, 13], [1, 11], [2, 11], [3, 14], [4, 15], [5, 15], [6, 14], [7, 15], [8, 15], [9, 14], [10, 15], [11, 10], [12, 10], [13, 12], [14, 12], [15, 14]]) for (let y = top; y < 16; y++) put(x, y, '#0f1230')
  // Lit windows
  for (const [x, y] of [[1, 12], [2, 14], [11, 11], [12, 13], [14, 13]]) put(x, y, '#ffc233')
  // The plumbob: a diamond, light on the top right, shade below left
  const rows = [[7, 8], [6, 9], [5, 10], [4, 11], [5, 10], [6, 9], [7, 8]]
  rows.forEach(([a, b], i) => {
    for (let x = a; x <= b; x++) put(x, i + 1, i < 4 ? (x >= 8 ? '#6ff0b0' : '#00b86b') : x < 8 ? '#00894f' : '#00a862')
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges"><clipPath id="r"><rect width="16" height="16" rx="3"/></clipPath><g clip-path="url(#r)">${px.join('')}</g></svg>`
}

/** Mark and wordmark side by side, or stacked. */
function lockup({ babi, life, stacked, mono, id }) {
  const size = 46
  const b = textPath('Babi ', size)
  const l = textPath('Life', size)
  if (!stacked) {
    const x = 64 + 18
    const w = Math.ceil(x + b.width + l.width + 2)
    const B = textPath('Babi ', size, x, 47)
    const L = textPath('Life', size, x + b.width, 47)
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} 64">${mark(id, mono)}<path d="${B.d}" fill="${babi}"/><path d="${L.d}" fill="${life}"/></svg>`
  }
  const w = Math.ceil(b.width + l.width)
  const x = 0
  const B = textPath('Babi ', size, x, 64 + 52)
  const L = textPath('Life', size, x + b.width, 64 + 52)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} 126"><g transform="translate(${(w - 64) / 2} 0)">${mark(id, mono)}</g><path d="${B.d}" fill="${babi}"/><path d="${L.d}" fill="${life}"/></svg>`
}

const files = {
  'babi-life-mark.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${mark('sky')}</svg>`,
  'babi-life-app-icon.svg': fs.readFileSync(path.join(import.meta.dirname, '../web/public/icon.svg'), 'utf8'),
  'babi-life-mark-pixel.svg': pixelMark(),
  'babi-life-logo-on-dark.svg': lockup({ babi: BRAND.white, life: BRAND.orange, id: 'a' }),
  'babi-life-logo-on-light.svg': lockup({ babi: BRAND.ink, life: BRAND.orange, id: 'b' }),
  'babi-life-logo-stacked-on-dark.svg': lockup({ babi: BRAND.white, life: BRAND.orange, stacked: true, id: 'c' }),
  'babi-life-logo-stacked-on-light.svg': lockup({ babi: BRAND.ink, life: BRAND.orange, stacked: true, id: 'd' }),
  'babi-life-logo-white.svg': lockup({ babi: BRAND.white, life: BRAND.white, mono: BRAND.white, id: 'e' }),
  'babi-life-logo-black.svg': lockup({ babi: BRAND.ink, life: BRAND.ink, mono: BRAND.ink, id: 'f' }),
}
for (const [name, svg] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), svg)

// PNGs: marks at 1024 px, logos 2400 px wide, on transparent backgrounds;
// plus a contact sheet of everything, on dark and light.
const b = await browser()
const page = await b.newPage({ deviceScaleFactor: 1 })
for (const [name, svg] of Object.entries(files)) {
  const vb = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)
  const [w, h] = [Number(vb[1]), Number(vb[2])]
  const W = w === h ? 1024 : 2400
  const H = Math.round((W * h) / w)
  await page.setViewportSize({ width: W, height: H })
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${W}" height="${H}" `)}</body></html>`)
  await page.screenshot({ path: path.join(dir, name.replace('.svg', '.png')), omitBackground: true })
}
const tile = (name, bg) => `<div style="background:${bg};border-radius:18px;display:grid;place-items:center;padding:28px;min-height:150px"><img src="data:image/svg+xml;base64,${Buffer.from(files[name]).toString('base64')}" style="max-width:100%;max-height:120px"><div style="margin-top:10px;font:600 13px system-ui;color:${bg === '#ffffff' ? '#5a5f73' : '#c9cbe0'}">${name}</div></div>`
await page.setViewportSize({ width: 1200, height: 900 })
await page.setContent(`<html><body style="margin:0;padding:28px;background:#e9e6f2;font-family:system-ui"><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
${tile('babi-life-mark.svg', BRAND.night)}${tile('babi-life-app-icon.svg', '#ffffff')}${tile('babi-life-mark-pixel.svg', BRAND.night)}
${tile('babi-life-logo-on-dark.svg', BRAND.night)}${tile('babi-life-logo-on-light.svg', '#ffffff')}${tile('babi-life-logo-white.svg', BRAND.orange)}
${tile('babi-life-logo-stacked-on-dark.svg', BRAND.night)}${tile('babi-life-logo-stacked-on-light.svg', '#ffffff')}${tile('babi-life-logo-black.svg', BRAND.gold)}
</div></body></html>`)
await page.screenshot({ path: path.join(dir, 'babi-life-logos-sheet.png'), fullPage: true })
await b.close()
console.log('logos →', dir)
