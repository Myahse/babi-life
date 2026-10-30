import { useEffect, useMemo, useRef, useState } from 'react'
import { Bus, Car, CarTaxiFront } from 'lucide-react'
import { inkOn } from '../../game/rides'
import civ from '../../assets/civ.geo.json'
import features from '../../assets/civ-features.json'
import { ABIDJAN_COAST, LAGOON } from '../../assets/abidjan'
import type { Sim } from '../../lib/types'
import { Portrait } from '../../avatar/portrait'
import { CIV_BOUNDS, Pin, declutter, routeDone, routeLine, vehiclePoint, visibleAt, type Bounds, type Padding, type PinData, type Route } from './pins'
import type { Camera } from './GameMap'
import { t as tr } from '../../lib/i18n'

// A stylised, game-board version of the country used when no Mapbox token is
// set: real borders, rivers, lakes and main roads from Natural Earth, painted
// from northern savanna to southern forest. Same pins and camera as Mapbox.

const K = 1000 // world units per degree
const W = (lng: number) => (lng - CIV_BOUNDS[0]) * K
const H = (lat: number) => (CIV_BOUNDS[3] - lat) * K
const path = (ring: number[][], close = true) => ring.map(([lng, lat], i) => `${i ? 'L' : 'M'}${W(lng).toFixed(1)} ${H(lat).toFixed(1)}`).join('') + (close ? 'Z' : '')

const COUNTRY = (civ.features[0].geometry.coordinates as number[][][][]).map((p) => path(p[0])).join('')
const NEIGHBOURS = features.neighbours.map((n) => ({ name: n.name, d: n.polys.map((r) => path(r)).join(''), x: W(n.lng ?? 0), y: H(n.lat ?? 0) }))
const LAKES = features.lakes.map((r) => path(r)).join('')
const RIVERS = features.rivers.map((r) => path(r.line, false)).join('')
const ROADS = features.roads.map((r) => path(r.line, false)).join('')
// The lagoon's outline already goes round Petit-Bassam (its north shore is the lagoon's south
// edge): the island is the land between it and the coast, not a hole to cut in the water. Cut as
// one (even-odd), it lies outside the lagoon and came out blue, Treichville, Marcory and Koumassi
// on the water.
const WATER = path(LAGOON)
// Natural Earth's coastline is too coarse around Abidjan: patch it with a
// hand-drawn shore so the lagoon, Port-Bouët and Grand-Bassam read right.
const COAST = path(ABIDJAN_COAST, false)
const PATCH = path([...ABIDJAN_COAST, [-3.55, 5.45], [-4.45, 5.45]])

type View = { s: number; tx: number; ty: number }
type Props = { pins: PinData[]; camera: Camera; night: boolean; sim: Sim | null; padding: Padding; route?: Route | null; onZoom?: (pxPerDeg: number) => void }

function fit(b: Bounds, size: { w: number; h: number }, pad: Padding): View {
  const w = Math.max(size.w - pad.left - pad.right, 80)
  const h = Math.max(size.h - pad.top - pad.bottom, 80)
  const [x0, y0, x1, y1] = [W(b[0]), H(b[3]), W(b[2]), H(b[1])]
  const s = Math.min(w / (x1 - x0), h / (y1 - y0))
  return { s, tx: pad.left + (w - (x1 - x0) * s) / 2 - x0 * s, ty: pad.top + (h - (y1 - y0) * s) / 2 - y0 * s }
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

const MAX_S = 60 // 60 000 px per degree: street level is the 3D quartier's job

export function OfflineMap({ pins, camera, night, sim, padding, route, onZoom }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const [view, setView] = useState<View | null>(null)
  const viewRef = useRef<View | null>(null)

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(ref.current!)
    return () => ro.disconnect()
  }, [])

  const minS = size ? fit(CIV_BOUNDS, size, { top: 0, bottom: 0, left: 0, right: 0 }).s * 0.8 : 0.01
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const target = useMemo(() => (size ? fit(camera.bounds, size, padding) : null), [camera.key, size])

  // Camera flight: zoom in/out in log space so it feels like a real map.
  useEffect(() => {
    if (!target) return
    const from = viewRef.current
    if (!from) {
      viewRef.current = target
      setView(target)
      return
    }
    // Interpolate the world point at the centre of the screen, not tx/ty, so
    // the camera travels in a straight line.
    const cx = size!.w / 2
    const cy = size!.h / 2
    const c0 = { x: (cx - from.tx) / from.s, y: (cy - from.ty) / from.s }
    const c1 = { x: (cx - target.tx) / target.s, y: (cy - target.ty) / target.s }
    const start = performance.now()
    const duration = 1100
    let raf = 0
    const step = (now: number) => {
      const t = ease(Math.min((now - start) / duration, 1))
      const s = Math.exp(Math.log(from.s) + (Math.log(target.s) - Math.log(from.s)) * t)
      const x = c0.x + (c1.x - c0.x) * t
      const y = c0.y + (c1.y - c0.y) * t
      const v = { s, tx: cx - x * s, ty: cy - y * s }
      viewRef.current = v
      setView(v)
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])

  // Free pan and zoom: drag, pinch, wheel, double-tap. A drag never counts as a tap on a pin.
  const gesture = useRef<{ pts: Map<number, { x: number; y: number }>; moved: boolean; last?: { x: number; y: number; d: number } }>({ pts: new Map(), moved: false })
  const apply = (v: View) => {
    viewRef.current = v
    setView(v)
  }
  const zoomAt = (x: number, y: number, factor: number) => {
    const v = viewRef.current
    if (!v) return
    const s2 = Math.min(MAX_S, Math.max(minS, v.s * factor))
    const k = s2 / v.s
    apply({ s: s2, tx: x - (x - v.tx) * k, ty: y - (y - v.ty) * k })
  }
  const local = (e: { clientX: number; clientY: number }) => {
    const r = ref.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const midpoint = () => {
    const [a, b] = [...gesture.current.pts.values()]
    return b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) } : { ...a, d: 0 }
  }
  useEffect(() => {
    const el = ref.current!
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      const p = local(e)
      zoomAt(p.x, p.y, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)))
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minS])
  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      const g = gesture.current
      if (g.pts.size === 0) g.moved = false
      g.pts.set(e.pointerId, local(e))
      g.last = midpoint()
    },
    onPointerMove: (e: React.PointerEvent) => {
      const g = gesture.current
      if (!g.pts.has(e.pointerId)) return
      g.pts.set(e.pointerId, local(e))
      const m = midpoint()
      const last = g.last!
      const v = viewRef.current
      if (!v) return
      if (!g.moved && Math.hypot(m.x - last.x, m.y - last.y) < 6 && Math.abs(m.d - last.d) < 6) return
      if (!g.moved) {
        g.moved = true
        ref.current!.setPointerCapture(e.pointerId)
      }
      let next = { ...v, tx: v.tx + m.x - last.x, ty: v.ty + m.y - last.y }
      if (m.d && last.d) {
        const s2 = Math.min(MAX_S, Math.max(minS, next.s * (m.d / last.d)))
        const k = s2 / next.s
        next = { s: s2, tx: m.x - (m.x - next.tx) * k, ty: m.y - (m.y - next.ty) * k }
      }
      apply(next)
      g.last = m
    },
    onPointerUp: (e: React.PointerEvent) => {
      const g = gesture.current
      g.pts.delete(e.pointerId)
      g.last = g.pts.size ? midpoint() : undefined
    },
    onDoubleClick: (e: React.MouseEvent) => {
      const p = local(e)
      zoomAt(p.x, p.y, 2.2)
    },
    // A drag that ends over a pin must not open it.
    onClickCapture: (e: React.MouseEvent) => {
      if (gesture.current.moved) {
        e.stopPropagation()
        gesture.current.moved = false
      }
    },
  }
  const zoomNow = view ? view.s * K : 0
  useEffect(() => {
    if (zoomNow) onZoom?.(zoomNow)
  }, [zoomNow, onZoom])
  const shown = useMemo(() => pins.filter((p) => visibleAt(p, zoomNow)), [pins, zoomNow])
  const taxi = route ? vehiclePoint(route) : null

  const layout = useMemo(() => (view && size ? declutter(shown, (lng, lat) => [W(lng) * view.s + view.tx, H(lat) * view.s + view.ty], size.w, padding.top - 10) : {}), [shown, view, size, padding.top])
  const zoom = view ? view.s * K : 0 // screen px per degree
  const urban = Math.min(Math.max((zoom - 2500) / 6000, 0), 1)
  const countryScale = Math.min(Math.max((600 - zoom) / 400, 0), 1)

  return (
    <div ref={ref} className="isolate absolute inset-0 touch-none overflow-hidden bg-[#3aa6d8] select-none" {...handlers} onPointerCancel={handlers.onPointerUp} onPointerLeave={(e) => e.pointerType === 'mouse' && handlers.onPointerUp(e)}>
      {view && (
        <svg className="absolute inset-0 h-full w-full">
          <defs>
            <linearGradient id="ocean" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#5cc3ec" />
              <stop offset="1" stopColor="#1f7fc0" />
            </linearGradient>
            <linearGradient id="land" gradientUnits="userSpaceOnUse" x1="0" y1={H(10.8)} x2="0" y2={H(4.3)}>
              <stop offset="0" stopColor="#f2d58c" />
              <stop offset="0.35" stopColor="#c9d77a" />
              <stop offset="0.65" stopColor="#7cc566" />
              <stop offset="1" stopColor="#4fae57" />
            </linearGradient>
            <pattern id="waves" width="46" height="24" patternUnits="userSpaceOnUse">
              <path d="M2 14 q6 -6 12 0 t12 0" stroke="#fff" strokeOpacity="0.18" strokeWidth="2" fill="none" strokeLinecap="round" />
            </pattern>
            <pattern id="blocks" width="34" height="34" patternUnits="userSpaceOnUse" patternTransform={`scale(${1 / view.s})`}>
              <rect width="34" height="34" fill="#f6efe0" />
              <rect x="3" y="3" width="13" height="12" rx="2.5" fill="#e3d6bd" />
              <rect x="19" y="3" width="12" height="17" rx="2.5" fill="#e8dcc5" />
              <rect x="3" y="18" width="13" height="13" rx="2.5" fill="#e8dcc5" />
              <rect x="19" y="23" width="12" height="8" rx="2.5" fill="#d9e7c4" />
            </pattern>
          </defs>

          <rect width="100%" height="100%" fill="url(#ocean)" />
          <rect width="100%" height="100%" fill="url(#waves)" />

          <g transform={`translate(${view.tx} ${view.ty}) scale(${view.s})`}>
            {NEIGHBOURS.map((n) => (
              <path key={n.name} d={n.d} fill="#e6dcc6" stroke="#fff" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            ))}
            <path d={COUNTRY} fill="#fff" opacity="0.6" stroke="#fff" strokeWidth="10" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            <path d={COAST} fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth="10" vectorEffect="non-scaling-stroke" />
            <path d={COUNTRY} fill="url(#land)" />
            <path d={PATCH} fill="url(#land)" />
            {urban > 0 && (
              <g opacity={urban}>
                <path d={COUNTRY} fill="url(#blocks)" />
                <path d={PATCH} fill="url(#blocks)" />
              </g>
            )}
            <path d={COAST} fill="none" stroke="#f2dca6" strokeWidth={urban ? 10 : 3} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
            <path d={ROADS} fill="none" stroke="#d8b26e" strokeWidth={urban ? 9 : 4} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
            <path d={ROADS} fill="none" stroke="#fff7e2" strokeWidth={urban ? 6 : 2} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
            <path d={RIVERS} fill="none" stroke="#49b4e6" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
            <path d={LAKES} fill="#49b4e6" />
            <path d={WATER} fill="#49b4e6" stroke="#fff" strokeOpacity="0.7" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            <path d={COUNTRY} fill="none" stroke="#ff7a00" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" opacity={Math.min(Math.max((1800 - zoom) / 1200, 0), 1)} />
            {route && (
              <g>
                <path d={path(routeLine(route), false)} fill="none" stroke="#0f1230" strokeOpacity="0.25" strokeWidth="9" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
                <path d={path(routeLine(route), false)} fill="none" stroke="#fff" strokeWidth="6" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeDasharray="2 10" />
                <path d={path(routeDone(route, route.progress), false)} fill="none" stroke="#ff7a00" strokeWidth="6" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
              </g>
            )}
          </g>

          {countryScale > 0 && (
            <g opacity={countryScale} className="font-display" fontWeight={800} letterSpacing="0.25em" fill="#8a7a5a" fontSize="13" textAnchor="middle">
              {NEIGHBOURS.map((n) => (
                <text key={n.name} x={n.x * view.s + view.tx} y={n.y * view.s + view.ty}>
                  {n.name.toUpperCase()}
                </text>
              ))}
              <text x={W(-5.2) * view.s + view.tx} y={H(3.9) * view.s + view.ty} fill="#fff" opacity="0.75" fontStyle="italic" letterSpacing="0.3em">
                GOLFE DE GUINÉE
              </text>
            </g>
          )}
        </svg>
      )}

      {/* Golden-hour / night grading over the whole board */}
      <div className="pointer-events-none absolute inset-0 transition-opacity duration-1000" style={{ background: 'linear-gradient(180deg, #1b1f6b 0%, #0f1230 100%)', mixBlendMode: 'multiply', opacity: night ? 0.55 : 0 }} />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(15,18,48,0.35))]" />

      {view && route && taxi && (
        <>
          <div className="pointer-events-none absolute z-[35] transition-[left,top] duration-1000 ease-linear" style={{ left: W(taxi[0]) * view.s + view.tx, top: H(taxi[1]) * view.s + view.ty, transform: 'translate(-50%, -50%)' }}>
            <TaxiMarker sim={route.pickup ? null : sim} mode={route.mode} color={route.color} />
          </div>
          {/* The Sim waiting by the road for the driver */}
          {route.pickup && (
            <div className="pointer-events-none absolute z-[34]" style={{ left: W(route.from[0]) * view.s + view.tx, top: H(route.from[1]) * view.s + view.ty, transform: 'translate(-50%, -50%)' }}>
              <WaitingMarker sim={sim} text={route.pickup.waits ? tr('J’arrive !') : undefined} />
            </div>
          )}
        </>
      )}

      {view &&
        shown.map((p) => (
          <div
            key={p.id}
            className="pointer-events-none absolute [&>*]:pointer-events-auto"
            style={{ left: W(p.lng) * view.s + view.tx, top: H(p.lat) * view.s + view.ty, transform: 'translate(-50%, -100%)', zIndex: p.variant === 'sim' ? 30 : p.active ? 20 : 10 + Math.round((H(p.lat) * view.s + view.ty) / 20) }}
          >
            <Pin pin={layout[p.id] ? { ...p, ...layout[p.id] } : p} sim={sim} />
          </div>
        ))}
    </div>
  )
}

/** The Sim by the road, waiting for the driver to come (or on its way to the one waiting at the kerb). */
export function WaitingMarker({ sim, text = tr('Le chauffeur arrive…') }: { sim: Sim | null; text?: string }) {
  return (
    <span className="flex flex-col items-center">
      <span className="mb-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-extrabold whitespace-nowrap shadow">{text}</span>
      <span className="block h-9 w-9 overflow-hidden rounded-full border-[3px] border-white bg-[#ffd8a8] shadow-[0_6px_14px_-6px_rgba(0,0,0,0.6)]">{sim && <Portrait look={sim.look} gender={sim.gender} framing="head" />}</span>
    </span>
  )
}

/** The taxi (or the car) carrying the Sim, with their face riding along. */
export function TaxiMarker({ sim, mode, color }: { sim: Sim | null; mode: string; color: string }) {
  return (
    <span className="relative flex items-center">
      <span className="absolute top-0 left-0 h-11 w-11 animate-ping rounded-full bg-[var(--color-orange)]/40" />
      <span className="relative grid h-11 w-11 place-items-center rounded-full border-[3px] border-white shadow-[0_8px_18px_-6px_rgba(0,0,0,0.6)]" style={{ background: color }}>
        {mode === 'car' ? <Bus size={22} color="#fff" strokeWidth={2.4} /> : mode === 'perso' ? <Car size={22} color={inkOn(color)} strokeWidth={2.4} /> : <CarTaxiFront size={22} color={inkOn(color)} strokeWidth={2.4} />}
      </span>
      {sim && (
        <span className="relative -ml-2 block h-8 w-8 overflow-hidden rounded-full border-2 border-white bg-[#ffd8a8] shadow">
          <Portrait look={sim.look} gender={sim.gender} framing="head" />
        </span>
      )}
    </span>
  )
}
