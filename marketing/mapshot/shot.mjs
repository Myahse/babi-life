// The Carte as players see it (components/map/MapboxMap.tsx: terrain relief, tilted camera), shot in CI
// where Mapbox can be reached. The token is read from the live site's own scripts (it ships in them),
// and the page is served at the site's address so the token's allowed origins accept it.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const SITE = 'https://www.lifeinbabi.com'
const get = async (u) => (await fetch(u)).text()
const html = await get(SITE + '/')
const seen = new Set()
let token = null
const queue = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1])
while (queue.length && !token && seen.size < 400) {
  const p = queue.shift()
  if (seen.has(p)) continue
  seen.add(p)
  const js = await get(SITE + p)
  token = js.match(/pk\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/)?.[0] ?? null
  for (const m of js.matchAll(/assets\/[A-Za-z0-9_.-]+\.js/g)) queue.push('/' + m[0])
}
if (!token) throw new Error(`no token in ${seen.size} scripts`)
console.log('token found in', seen.size, 'scripts')

const page = (view) => `<!doctype html><html><head><meta charset="utf-8">
<link href="https://unpkg.com/mapbox-gl@3.32.0/dist/mapbox-gl.css" rel="stylesheet">
<script src="https://unpkg.com/mapbox-gl@3.32.0/dist/mapbox-gl.js"></script>
<style>html,body,#m{margin:0;width:100%;height:100%}</style></head><body><div id="m"></div><script>
mapboxgl.accessToken = ${JSON.stringify(token)}
const v = ${JSON.stringify(view)}
const m = new mapboxgl.Map({ container: 'm', style: 'mapbox://styles/mapbox/standard', config: { basemap: { lightPreset: 'day', showPointOfInterestLabels: false } }, bounds: v.bounds, pitch: v.pitch, bearing: v.bearing ?? 0, maxPitch: 75, attributionControl: false })
m.on('load', () => {
  m.addSource('relief', { type: 'raster-dem', url: 'mapbox://mapbox.mapbox-terrain-dem-v1', tileSize: 512, maxzoom: 14 })
  m.setTerrain({ source: 'relief', exaggeration: ['interpolate', ['linear'], ['zoom'], 5, 3, 9, 2, 13, 1.4] })
  m.once('idle', () => setTimeout(() => (window.done = true), 1500))
})
m.on('error', (e) => console.log('map error', e.error && e.error.message))
</script></body></html>`

const views = {
  pays: { bounds: [-8.7, 4.3, -2.4, 10.8], pitch: 40 },
  man: { bounds: [-7.8, 7.25, -7.4, 7.55], pitch: 62, bearing: -20 },
  abidjan: { bounds: [-4.06, 5.28, -3.94, 5.38], pitch: 58, bearing: 20 },
  plateau: { bounds: [-4.03, 5.31, -4.01, 5.33], pitch: 60, bearing: -30 },
}
mkdirSync('out', { recursive: true })
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
for (const [name, view] of Object.entries(views)) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2 })
  const p = await ctx.newPage()
  p.on('console', (m) => console.log(name, m.text().slice(0, 200)))
  await p.route(SITE + '/carte-test', (r) => r.fulfill({ contentType: 'text/html', body: page(view) }))
  await p.goto(SITE + '/carte-test')
  await p.waitForFunction(() => window.done, null, { timeout: 120000 }).catch(() => console.log(name, 'not idle in 120 s'))
  await p.screenshot({ path: `out/${name}.png` })
  await ctx.close()
}
await browser.close()
