// Every place of a commune, from OpenStreetMap: the named points of interest
// inside the commune's official boundary (Nominatim), read from OpenFreeMap's
// tiles (the same data the 3D world shows), given a game kind, each with the
// quarter it stands in. Written for the API to embed:
//
//   node tools/places/build.mjs yopougon "Yopougon, Abidjan"
//   → backend/internal/world/osm/yopougon.json
//
// A third argument keeps only some kinds (the churches and mosques of every
// commune before the rest of their places): worship,school
//
// Bus stops, ATMs, toilets, car parks and car garages are left out:
// nobody goes there to do something. Data © OpenStreetMap contributors (ODbL).

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { VectorTile } from '../../web/node_modules/@mapbox/vector-tile/index.js'
import Pbf from '../../web/node_modules/pbf/index.js'

const [id, query, only] = process.argv.slice(2)
if (!id || !query) throw new Error('usage: node build.mjs <commune-id> "<Nominatim query>" [kind,kind…]')
const keep = only ? new Set(only.split(',')) : null
const here = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(here, '../../backend/internal/world/osm', `${id}.json`)

// The game kind of a map point, from its OpenMapTiles class and subclass (and name).
function kindOf(cls, sub, name) {
  const n = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  switch (cls) {
    case 'beer':
    case 'bar':
      return sub === 'nightclub' || /\b(night|club|boite|vip)\b/.test(n) ? 'club' : 'maquis'
    case 'restaurant':
      return /pizza|burger|shawarma|chawarma|fast|snack|chicken|glacier/.test(n) ? 'restaurant' : 'maquis'
    case 'fast_food':
    case 'cafe':
    case 'ice_cream':
      return /maquis|garba|alloco|poisson|braise/.test(n) ? 'maquis' : 'restaurant'
    case 'school':
      return 'school'
    case 'college':
      return sub === 'university' || /universit|institut sup|ecole sup|grande ecole/.test(n) ? 'universite' : 'school'
    case 'place_of_worship':
      return 'worship'
    case 'hairdresser':
      return /barb|coupe|cut|degrad|homme|men\b/.test(n) && !/dame|femme|lady|beaute|tress|onglerie/.test(n) ? 'barbier' : 'salon'
    case 'pharmacy':
      return 'pharmacie'
    case 'doctors':
    case 'dentist':
    case 'hospital':
      return 'health'
    case 'lodging':
      return 'hotel'
    case 'grocery':
      return sub === 'marketplace' ? 'market' : sub === 'supermarket' || sub === 'department_store' ? 'mall' : 'boutique'
    case 'butcher':
    case 'bakery':
    case 'alcohol_shop':
    case 'clothing_store':
      return 'boutique'
    case 'shop':
      if (sub === 'beauty') return 'salon'
      if (sub === 'tailor' || sub === 'fabric') return 'couture'
      if (sub === 'mall') return 'mall'
      return 'boutique'
    case 'library':
      return sub === 'library' ? 'culture' : 'boutique'
    case 'cinema':
    case 'art_gallery':
    case 'theme_park':
    case 'music':
    case 'theatre':
    case 'museum':
      return 'culture'
    case 'fitness_centre':
    case 'fitness':
    case 'gymnastics':
      return 'gym' // the salles de sport
    case 'sports_centre':
      return /\b(gym|fitness|musculation|salle de sport|body ?building)\b/.test(n) ? 'gym' : 'sport'
    case 'pitch':
    case 'stadium':
    case 'swimming_pool':
      return 'sport'
    case 'garden':
    case 'park':
      return 'nature'
    case 'fuel':
      return 'station'
    case 'bus':
      return sub === 'bus_station' ? 'transport' : null
    case 'ferry_terminal':
      return 'transport'
    case 'bank':
    case 'police':
      return 'police' // the commissariats (and the gendarmeries) by their own name
    case 'office':
    case 'post':
    case 'town_hall':
    case 'fire_station':
    case 'hackerspace':
      return sub === 'post_box' ? null : 'office'
    default:
      return null // bus stops, ATMs, toilets, parking, garages, laundries, vets…
  }
}

const UA = { 'User-Agent': 'babi-life-places/1.0 (game map data)' }
const nom = await (await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&polygon_geojson=1&limit=1`, { headers: UA })).json()
if (!nom[0]?.geojson) throw new Error(`no boundary for ${query}`)
const geo = nom[0].geojson
const polys = geo.type === 'Polygon' ? [geo.coordinates] : geo.coordinates
const inRing = (x, y, r) => {
  let c = false
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i]
    const [xj, yj] = r[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}
const inside = (lng, lat) => polys.some((p) => inRing(lng, lat, p[0]) && !p.slice(1).some((h) => inRing(lng, lat, h)))
const [s, n, w, e] = nom[0].boundingbox.map(Number)

const tj = await (await fetch('https://tiles.openfreemap.org/planet')).json()
const Z = 14
const N = 2 ** Z
const tx = (lng) => Math.floor(((lng + 180) / 360) * N)
const ty = (lat) => Math.floor(((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * N)

const points = new Map()
const quarters = []
for (let x = tx(w); x <= tx(e); x++)
  for (let y = ty(n); y <= ty(s); y++) {
    const res = await fetch(tj.tiles[0].replace('{z}', Z).replace('{x}', x).replace('{y}', y))
    if (!res.ok) continue
    const t = new VectorTile(new Pbf(new Uint8Array(await res.arrayBuffer())))
    const pl = t.layers.place
    for (let i = 0; i < (pl?.length ?? 0); i++) {
      const f = pl.feature(i)
      if (!['neighbourhood', 'quarter', 'suburb'].includes(f.properties.class) || !f.properties.name) continue
      const [lng, lat] = f.toGeoJSON(x, y, Z).geometry.coordinates
      if (inside(lng, lat)) quarters.push({ name: f.properties['name:fr'] ?? f.properties.name, lat, lng, rank: f.properties.class })
    }
    const l = t.layers.poi
    for (let i = 0; i < (l?.length ?? 0); i++) {
      const f = l.feature(i)
      const name = String(f.properties['name:fr'] ?? f.properties.name ?? '').trim()
      if (!name || name.length < 2) continue
      const kind = kindOf(f.properties.class, f.properties.subclass, name)
      if (!kind || (keep && !keep.has(kind))) continue
      const [lng, lat] = f.toGeoJSON(x, y, Z).geometry.coordinates
      if (!inside(lng, lat)) continue
      // The same point comes in every tile whose margin it falls in: once only.
      const key = `${name}|${lat.toFixed(5)}|${lng.toFixed(5)}`
      if (!points.has(key)) points.set(key, { name, kind, type: f.properties.subclass ?? f.properties.class, lat, lng })
    }
  }

/** A short stable id from the name and the position. */
function idOf(p) {
  let h = 2166136261
  for (const ch of `${p.name}|${p.lat.toFixed(5)}|${p.lng.toFixed(5)}`) h = Math.imul(h ^ ch.codePointAt(0), 16777619) >>> 0
  return `${id.slice(0, 3)}-osm-${h.toString(36)}`
}
const quarterOf = (p) => {
  let best = null
  for (const q of quarters) {
    const d = Math.hypot((q.lat - p.lat) * 111, (q.lng - p.lng) * 111 * Math.cos((p.lat * Math.PI) / 180))
    // A named quarter wins over a smaller neighbourhood only when it's clearly nearer.
    if (d < 1.5 && (!best || d < best.d)) best = { name: q.name, d }
  }
  return best?.name ?? ''
}

const places = [...points.values()]
  .map((p) => [idOf(p), p.name, p.kind, Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6)), quarterOf(p), p.type])
  .sort((a, b) => a[0].localeCompare(b[0]))
const ids = new Set(places.map((p) => p[0]))
if (ids.size !== places.length) throw new Error('id collision')
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(
  out,
  JSON.stringify({
    commune: id,
    source: 'OpenStreetMap (ODbL), via OpenFreeMap; limite communale : Nominatim',
    fetched: new Date().toISOString().slice(0, 10),
    ...(keep ? { only: [...keep] } : {}),
    fields: ['id', 'name', 'kind', 'lat', 'lng', 'quarter', 'type'],
    places,
  }),
)
const by = {}
for (const p of places) by[p[2]] = (by[p[2]] ?? 0) + 1
console.log(`${places.length} places → ${path.relative(process.cwd(), out)} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`)
console.log(Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · '))
console.log(`${quarters.length} quarters named; ${places.filter((p) => !p[5]).length} places without one`)
