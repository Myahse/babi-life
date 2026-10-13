import { useEffect, useRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import civ from '../../assets/civ.geo.json'
import type { Sim } from '../../lib/types'
import { CIV_BOUNDS, Pin, declutter, type Bounds, type Padding, type PinData } from './pins'

type Props = { token: string; pins: PinData[]; bounds: Bounds; night: boolean; sim: Sim | null; padding: Padding }

// Everything outside Côte d'Ivoire is dimmed so the country reads like a
// game board.
function worldMask(): GeoJSON.Feature<GeoJSON.Polygon> {
  const holes = (civ.features[0].geometry.coordinates as number[][][][]).map((poly) => poly[0])
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]], ...holes] },
  }
}

export function MapboxMap({ token, pins, bounds, night, sim, padding }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const markers = useRef<{ pin: PinData; marker: mapboxgl.Marker; root: Root }[]>([])

  useEffect(() => {
    mapboxgl.accessToken = token
    const m = new mapboxgl.Map({
      container: container.current!,
      style: 'mapbox://styles/mapbox/standard',
      config: { basemap: { lightPreset: night ? 'night' : 'day', showPointOfInterestLabels: false } },
      bounds: CIV_BOUNDS,
      maxBounds: [CIV_BOUNDS[0] - 4, CIV_BOUNDS[1] - 3, CIV_BOUNDS[2] + 4, CIV_BOUNDS[3] + 3],
      pitch: 0,
      attributionControl: false,
    })
    m.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right')
    m.on('load', () => {
      m.addSource('civ', { type: 'geojson', data: civ as GeoJSON.FeatureCollection })
      m.addSource('mask', { type: 'geojson', data: worldMask() })
      m.addLayer({ id: 'mask', type: 'fill', source: 'mask', paint: { 'fill-color': '#0f1230', 'fill-opacity': 0.45 } })
      m.addLayer({ id: 'civ-glow', type: 'line', source: 'civ', paint: { 'line-color': '#f77f00', 'line-width': 10, 'line-opacity': 0.25, 'line-blur': 6 } })
      m.addLayer({ id: 'civ-line', type: 'line', source: 'civ', paint: { 'line-color': '#f77f00', 'line-width': 2.5 } })
    })
    map.current = m
    return () => m.remove()
    // Created once; the effects below keep it in sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    // Tilt the camera once inside a city: 3D buildings make it feel like a game.
    const city = bounds[2] - bounds[0] < 1
    map.current?.fitBounds(bounds, { padding, pitch: city ? 50 : 0, duration: 1600, essential: true })
  }, [bounds, padding])

  useEffect(() => {
    const m = map.current
    if (!m) return
    const apply = () => m.setConfigProperty('basemap', 'lightPreset', night ? 'night' : 'day')
    if (m.isStyleLoaded()) apply()
    else m.once('style.load', apply)
  }, [night])

  useEffect(() => {
    const m = map.current
    if (!m) return
    const created = pins.map((p) => {
      const el = document.createElement('div')
      el.style.zIndex = p.variant === 'sim' ? '30' : p.active ? '20' : '10'
      const root = createRoot(el)
      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat([p.lng, p.lat]).addTo(m)
      return { pin: p, marker, root }
    })
    // Re-run label de-collision whenever the camera settles.
    const layout = () => {
      const layout = declutter(
        pins,
        (lng, lat) => {
          const pt = m.project([lng, lat])
          return [pt.x, pt.y]
        },
        m.getContainer().clientWidth,
        padding.top - 10,
      )
      for (const { pin, root } of created) root.render(<Pin pin={layout[pin.id] ? { ...pin, ...layout[pin.id] } : pin} sim={sim} />)
    }
    layout()
    m.on('moveend', layout)
    markers.current = created
    return () => {
      m.off('moveend', layout)
      markers.current = []
      queueMicrotask(() => created.forEach(({ marker, root }) => (root.unmount(), marker.remove())))
    }
  }, [pins, sim, padding.top])

  return <div ref={container} className="isolate absolute inset-0" />
}
