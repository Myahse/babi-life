import { useCallback, useEffect, useRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import civ from '../../assets/civ.geo.json'
import type { Sim } from '../../lib/types'
import { CIV_BOUNDS, Pin, declutter, pxPerDegree, routeDone, routeLine, vehiclePoint, visibleAt, type Padding, type PinData, type Route } from './pins'
import type { Camera } from './GameMap'
import { TaxiMarker, WaitingMarker } from './OfflineMap'
import { OrbitGizmo } from '../OrbitGizmo'

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
  const pose = useRef({ heading: 0, polar: 0 })
  const readPose = useCallback(() => pose.current, [])

  useEffect(() => {
    mapboxgl.accessToken = token
    const m = new mapboxgl.Map({
      container: container.current!,
      style: 'mapbox://styles/mapbox/standard',
      config: { basemap: { lightPreset: night ? 'night' : 'day', showPointOfInterestLabels: false } },
      bounds: CIV_BOUNDS,
      maxBounds: [CIV_BOUNDS[0] - 4, CIV_BOUNDS[1] - 3, CIV_BOUNDS[2] + 4, CIV_BOUNDS[3] + 3],
      pitch: 0,
      maxPitch: 70,
      dragRotate: true,
      touchZoomRotate: true,
      touchPitch: true,
      pitchWithRotate: true,
      attributionControl: false,
    })
    m.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right')
    m.addControl(new mapboxgl.NavigationControl({ showCompass: false, showZoom: true }), 'bottom-right')
    const syncPose = () => {
      pose.current.heading = (m.getBearing() * Math.PI) / 180
      pose.current.polar = (m.getPitch() * Math.PI) / 180
    }
    m.on('move', syncPose)
    m.on('load', () => {
      // Mapbox's own CSS sets position:relative on the container, which drops
      // the height to 0 until we measure again.
      m.resize()
      syncPose()
      const corner = m.getContainer().querySelector('.mapboxgl-ctrl-bottom-right') as HTMLElement | null
      if (corner) corner.style.bottom = '4.5rem'
      m.addSource('civ', { type: 'geojson', data: civ as GeoJSON.FeatureCollection })
      m.addSource('mask', { type: 'geojson', data: worldMask() })
      m.addLayer({ id: 'mask', type: 'fill', source: 'mask', paint: { 'fill-color': '#0f1230', 'fill-opacity': 0.45 } })
      m.addLayer({ id: 'civ-glow', type: 'line', source: 'civ', paint: { 'line-color': '#f77f00', 'line-width': 10, 'line-opacity': 0.25, 'line-blur': 6 } })
      m.addLayer({ id: 'civ-line', type: 'line', source: 'civ', paint: { 'line-color': '#f77f00', 'line-width': 2.5 } })
      m.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      m.addLayer({ id: 'route-casing', type: 'line', source: 'route', filter: ['==', ['get', 'part'], 'all'], layout: { 'line-cap': 'round' }, paint: { 'line-color': '#0f1230', 'line-opacity': 0.25, 'line-width': 9 } })
      m.addLayer({ id: 'route-ahead', type: 'line', source: 'route', filter: ['==', ['get', 'part'], 'all'], layout: { 'line-cap': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 5, 'line-dasharray': [0.2, 2] } })
      m.addLayer({ id: 'route-done', type: 'line', source: 'route', filter: ['==', ['get', 'part'], 'done'], layout: { 'line-cap': 'round' }, paint: { 'line-color': '#ff7a00', 'line-width': 6 } })
      // The country veil uses a coarse border. It only helps when the whole
      // country is on screen; closer in it slices through the lagoon.
      const board = () => {
        const country = m.getZoom() < 8
        m.setPaintProperty('mask', 'fill-opacity', country ? 0.45 : 0)
        m.setPaintProperty('civ-glow', 'line-opacity', country ? 0.25 : 0)
        m.setPaintProperty('civ-line', 'line-opacity', country ? 1 : 0)
      }
      board()
      m.on('zoom', board)
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
  // The Sim waiting by the road while the driver comes.
  const waiting = useRef<{ marker: mapboxgl.Marker; root: Root } | null>(null)
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
      const done = routeDone(route, route.progress)
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
        taxi.current = { marker: new mapboxgl.Marker({ element: el }).setLngLat(vehiclePoint(route)).addTo(m), root: createRoot(el) }
      }
      taxi.current.marker.setLngLat(vehiclePoint(route))
      // On its way to pick the Sim up, the car is empty; the Sim waits at the start.
      taxi.current.root.render(<TaxiMarker sim={route.pickup ? null : sim} mode={route.mode} color={route.color} />)
    } else if (taxi.current) {
      const t = taxi.current
      taxi.current = null
      // After React's render, not in it (a microtask can run mid-render: « unmount a root while React was already rendering »).
      setTimeout(() => (t.root.unmount(), t.marker.remove()), 0)
    }
    if (route?.pickup) {
      if (!waiting.current) {
        const el = document.createElement('div')
        el.style.zIndex = '39'
        waiting.current = { marker: new mapboxgl.Marker({ element: el }).setLngLat(route.from).addTo(m), root: createRoot(el) }
      }
      waiting.current.marker.setLngLat(route.from)
      waiting.current.root.render(<WaitingMarker sim={sim} text={route.pickup.waits ? 'J’arrive !' : undefined} />)
    } else if (waiting.current) {
      const w = waiting.current
      waiting.current = null
      setTimeout(() => (w.root.unmount(), w.marker.remove()), 0)
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
      // The marker's box is as big as its pin (label and stem): only the pin's label takes taps (Pin).
      el.style.pointerEvents = 'none'
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
      setTimeout(() => created.forEach(({ marker, root }) => (root.unmount(), marker.remove())), 0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, sim, padding.top])

  return (
    <div className="absolute inset-0">
      <div ref={container} className="isolate" style={{ position: 'absolute', inset: 0 }} />
      <OrbitGizmo
        className="absolute right-3 bottom-[13rem] z-10 lg:right-5"
        read={readPose}
        onYaw={(d) => {
          const m = map.current
          if (m) m.setBearing(m.getBearing() + (d * 180) / Math.PI)
        }}
        onPitch={(d) => {
          const m = map.current
          if (m) m.setPitch(Math.min(70, Math.max(0, m.getPitch() + (d * 180) / Math.PI)))
        }}
        onNorth={() => map.current?.easeTo({ bearing: 0, duration: 450 })}
      />
    </div>
  )
}
