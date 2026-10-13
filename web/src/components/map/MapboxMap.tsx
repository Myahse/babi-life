import { useEffect, useRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import civ from '../../assets/civ.geo.json'
import type { Sim } from '../../lib/types'
import { CIV_BOUNDS, Pin, declutter, pxPerDegree, routeLine, routePoint, visibleAt, type Padding, type PinData, type Route } from './pins'
import type { Camera } from './GameMap'
import { TaxiMarker } from './OfflineMap'

type Props = { token: string; pins: PinData[]; camera: Camera; night: boolean; sim: Sim | null; padding: Padding; route?: Route | null; onZoom?: (pxPerDeg: number) => void }

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

export function MapboxMap({ token, pins, camera, night, sim, padding, route, onZoom }: Props) {
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
      m.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      m.addLayer({ id: 'route-casing', type: 'line', source: 'route', filter: ['==', ['get', 'part'], 'all'], layout: { 'line-cap': 'round' }, paint: { 'line-color': '#0f1230', 'line-opacity': 0.25, 'line-width': 9 } })
      m.addLayer({ id: 'route-ahead', type: 'line', source: 'route', filter: ['==', ['get', 'part'], 'all'], layout: { 'line-cap': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 5, 'line-dasharray': [0.2, 2] } })
      m.addLayer({ id: 'route-done', type: 'line', source: 'route', filter: ['==', ['get', 'part'], 'done'], layout: { 'line-cap': 'round' }, paint: { 'line-color': '#ff7a00', 'line-width': 6 } })
    })
    map.current = m
    return () => m.remove()
    // Created once; the effects below keep it in sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    // Tilt the camera once inside a city: 3D buildings make it feel like a game.
    const b = camera.bounds
    const city = b[2] - b[0] < 1
    map.current?.fitBounds(b, { padding, pitch: city ? 50 : 0, duration: 1600, essential: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera.key])

  // The trip: the whole route, the part already driven, and the taxi on it.
  const taxi = useRef<{ marker: mapboxgl.Marker; root: Root } | null>(null)
  useEffect(() => {
    const m = map.current
    if (!m) return
    const draw = () => {
      const src = m.getSource('route') as mapboxgl.GeoJSONSource | undefined
      if (!src) return
      if (!route) {
        src.setData({ type: 'FeatureCollection', features: [] })
        return
      }
      const done = [...Array(33)].map((_, i) => routePoint(route, (i / 32) * route.progress))
      src.setData({
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', properties: { part: 'all' }, geometry: { type: 'LineString', coordinates: routeLine(route) } },
          { type: 'Feature', properties: { part: 'done' }, geometry: { type: 'LineString', coordinates: done } },
        ],
      })
    }
    if (m.isStyleLoaded() && m.getSource('route')) draw()
    else m.once('load', draw)
    if (route) {
      if (!taxi.current) {
        const el = document.createElement('div')
        el.style.zIndex = '40'
        taxi.current = { marker: new mapboxgl.Marker({ element: el }).setLngLat(routePoint(route, route.progress)).addTo(m), root: createRoot(el) }
      }
      taxi.current.marker.setLngLat(routePoint(route, route.progress))
      taxi.current.root.render(<TaxiMarker sim={sim} mode={route.mode} color={route.color} />)
    } else if (taxi.current) {
      const t = taxi.current
      taxi.current = null
      queueMicrotask(() => (t.root.unmount(), t.marker.remove()))
    }
  }, [route, sim])

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
    // Pins show in their zoom band; labels are de-collided whenever the camera settles.
    const show = () => {
      const z = pxPerDegree(m.getZoom())
      onZoom?.(z)
      for (const { pin, marker } of created) marker.getElement().style.display = visibleAt(pin, z) ? '' : 'none'
    }
    const layout = () => {
      show()
      const z = pxPerDegree(m.getZoom())
      const layout = declutter(
        pins.filter((p) => visibleAt(p, z)),
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
    m.on('zoom', show)
    markers.current = created
    return () => {
      m.off('moveend', layout)
      m.off('zoom', show)
      markers.current = []
      queueMicrotask(() => created.forEach(({ marker, root }) => (root.unmount(), marker.remove())))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, sim, padding.top])

  return <div ref={container} className="isolate absolute inset-0" />
}
