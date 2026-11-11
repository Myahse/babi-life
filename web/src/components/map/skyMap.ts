import type { GeoJSONSource, LayerSpecification, Map as MapboxGl } from 'mapbox-gl'
import { aloftAt, makeAloft, type Leg } from '../../lib/airTraffic'
import { worldTime } from '../../lib/worldClock'

// The sky on the big map (the update « camera-vie »): Air Lagune's planes on their routes, where the shared
// timetable puts them (lib/airTraffic.ts: the same planes the street sees overhead), and flocks of birds
// drifting over the lagoons and the towns, all in the game's own 3D blocks (public/sky/*.glb, exported from
// the lab: city.html?view=glb&id=sky-plane | sky-birds-up | sky-birds-down). One GeoJSON source moved four
// times a second; drawn big enough to read from afar, their real size close in.

/** The models' turn to the map's: the glTF's nose (+z) to the north, then the plane's bearing (degrees). */
const TURN = 180
/** How long on screen (px) a plane and a flock stay at least, whatever the zoom. */
const PLANE_PX = 34
const FLOCK_PX = 30
/** Where flocks wheel about (lng, lat; radius km): the lagoon at Abidjan and Bassam, Yamoussoukro's lakes, Bouaké, San-Pédro. */
const FLOCKS: [number, number, number][] = [
  [-4.02, 5.31, 2.5],
  [-3.97, 5.33, 3.5],
  [-4.06, 5.35, 2],
  [-3.9, 5.27, 3],
  [-3.74, 5.21, 2.5],
  [-5.27, 6.82, 2.5],
  [-5.03, 7.69, 3],
  [-6.63, 4.75, 2.5],
]

type Feature = { type: 'Feature'; properties: { model: string; rot: number[]; tr: number[]; sc: number[] }; geometry: { type: 'Point'; coordinates: number[] } }

/** Adds the sky's layers to a loaded map; returns how to take them off again. */
export function addSky(m: MapboxGl, legs: Leg[]): () => void {
  const base = import.meta.env.BASE_URL
  try {
    m.addModel('sky-plane', `${base}sky/plane.glb`)
    m.addModel('sky-birds-up', `${base}sky/birds-up.glb`)
    m.addModel('sky-birds-down', `${base}sky/birds-down.glb`)
  } catch {
    return () => undefined
  }
  const pool = makeAloft(Math.max(8, legs.length))
  // The features, made once and moved in place.
  const planes: Feature[] = pool.map(() => ({ type: 'Feature', properties: { model: 'sky-plane', rot: [0, 0, 0], tr: [0, 0, 0], sc: [1, 1, 1] }, geometry: { type: 'Point', coordinates: [0, 0] } }))
  const birds: Feature[] = FLOCKS.map(() => ({ type: 'Feature', properties: { model: 'sky-birds-up', rot: [0, 0, 0], tr: [0, 0, 0], sc: [1, 1, 1] }, geometry: { type: 'Point', coordinates: [0, 0] } }))
  const data = { type: 'FeatureCollection' as const, features: [] as Feature[] }
  m.addSource('sky', { type: 'geojson', data: data as GeoJSON.FeatureCollection })
  const paint = { 'model-rotation': ['get', 'rot'], 'model-translation': ['get', 'tr'], 'model-scale': ['get', 'sc'], 'model-cast-shadows': false, 'model-emissive-strength': 0.2 }
  m.addLayer({ id: 'sky-planes', type: 'model', source: 'sky', filter: ['==', ['get', 'model'], 'sky-plane'], layout: { 'model-id': ['get', 'model'] }, paint } as unknown as LayerSpecification)
  // (The birds only once a town is in view: from the whole country, a flock would be kilometres wide.)
  m.addLayer({ id: 'sky-birds', type: 'model', source: 'sky', minzoom: 9.5, filter: ['!=', ['get', 'model'], 'sky-plane'], layout: { 'model-id': ['get', 'model'] }, paint } as unknown as LayerSpecification)
  let beat = 0
  const move = () => {
    const src = m.getSource('sky') as GeoJSONSource | undefined
    if (!src) return
    const zoom = m.getZoom()
    const now = worldTime()
    const mpp = (z: number, lat: number) => (40075016 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** z)
    data.features.length = 0
    const n = aloftAt(legs, now, pool)
    for (let i = 0; i < n; i++) {
      const a = pool[i]
      const f = planes[i]
      const s = Math.max(1, (PLANE_PX * mpp(zoom, a.lat)) / 40)
      f.geometry.coordinates[0] = a.lng
      f.geometry.coordinates[1] = a.lat
      f.properties.rot[2] = (a.bearing * 180) / Math.PI + TURN
      // Drawn bigger from afar, it flies higher too (not through the hills it now dwarfs).
      f.properties.tr[2] = a.alt + s * 6
      f.properties.sc[0] = f.properties.sc[1] = f.properties.sc[2] = s
      data.features.push(f)
    }
    if (zoom >= 9.5) {
      beat++
      FLOCKS.forEach(([lng, lat, km], i) => {
        // Round and round at about 12 m/s, each its own way and pace.
        const r = km * 1000
        const w = ((i % 2 ? 1 : -1) * 12) / r
        const ang = now * w + i * 1.7
        const f = birds[i]
        const k = 111320 * Math.cos((lat * Math.PI) / 180)
        f.geometry.coordinates[0] = lng + (Math.sin(ang) * r) / k
        f.geometry.coordinates[1] = lat + (Math.cos(ang) * r) / 110574
        const heading = ang + (w > 0 ? Math.PI / 2 : -Math.PI / 2)
        f.properties.rot[2] = (heading * 180) / Math.PI + TURN
        const s = Math.max(1, (FLOCK_PX * mpp(zoom, lat)) / 6)
        f.properties.tr[2] = 60 + s * 4
        f.properties.sc[0] = f.properties.sc[1] = f.properties.sc[2] = s
        // The wings: up, down, up… (two models, swapped).
        f.properties.model = (beat + i) % 2 ? 'sky-birds-up' : 'sky-birds-down'
        data.features.push(f)
      })
    }
    src.setData(data as GeoJSON.FeatureCollection)
  }
  move()
  const timer = setInterval(() => {
    // (Not while the page is hidden: nothing to see.)
    if (!document.hidden) move()
  }, 250)
  m.on('zoomend', move)
  return () => {
    clearInterval(timer)
    m.off('zoomend', move)
    try {
      for (const id of ['sky-birds', 'sky-planes']) if (m.getLayer(id)) m.removeLayer(id)
      if (m.getSource('sky')) m.removeSource('sky')
    } catch {
      // (The map is being removed.)
    }
  }
}
