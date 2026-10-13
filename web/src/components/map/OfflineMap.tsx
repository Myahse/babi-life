import { useEffect, useMemo, useRef, useState } from 'react'
import civ from '../../assets/civ.geo.json'
import features from '../../assets/civ-features.json'
import { ABIDJAN_COAST, LAGOON, PETIT_BASSAM } from '../../assets/abidjan'
import type { Sim } from '../../lib/types'
import { CIV_BOUNDS, Pin, declutter, type Bounds, type Padding, type PinData } from './pins'

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
const WATER = path(LAGOON)
const ISLAND = path(PETIT_BASSAM)
// Natural Earth's coastline is too coarse around Abidjan: patch it with a
// hand-drawn shore so the lagoon, Port-Bouët and Grand-Bassam read right.
const COAST = path(ABIDJAN_COAST, false)
const PATCH = path([...ABIDJAN_COAST, [-3.55, 5.45], [-4.45, 5.45]])

type View = { s: number; tx: number; ty: number }
type Props = { pins: PinData[]; bounds: Bounds; night: boolean; sim: Sim | null; padding: Padding }

function fit(b: Bounds, size: { w: number; h: number }, pad: Padding): View {
  const w = Math.max(size.w - pad.left - pad.right, 80)
  const h = Math.max(size.h - pad.top - pad.bottom, 80)
  const [x0, y0, x1, y1] = [W(b[0]), H(b[3]), W(b[2]), H(b[1])]
  const s = Math.min(w / (x1 - x0), h / (y1 - y0))
  return { s, tx: pad.left + (w - (x1 - x0) * s) / 2 - x0 * s, ty: pad.top + (h - (y1 - y0) * s) / 2 - y0 * s }
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

export function OfflineMap({ pins, bounds, night, sim, padding }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const [view, setView] = useState<View | null>(null)
  const viewRef = useRef<View | null>(null)

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(ref.current!)
    return () => ro.disconnect()
  }, [])

  const target = useMemo(() => (size ? fit(bounds, size, padding) : null), [bounds, size, padding])

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

  const layout = useMemo(() => (view && size ? declutter(pins, (lng, lat) => [W(lng) * view.s + view.tx, H(lat) * view.s + view.ty], size.w, padding.top - 10) : {}), [pins, view, size, padding.top])
  const zoom = view ? view.s * K : 0 // screen px per degree
  const urban = Math.min(Math.max((zoom - 2500) / 6000, 0), 1)
  const countryScale = Math.min(Math.max((600 - zoom) / 400, 0), 1)

  return (
    <div ref={ref} className="isolate absolute inset-0 overflow-hidden bg-[#3aa6d8]">
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
            <path d={`${WATER}${ISLAND}`} fill="#49b4e6" fillRule="evenodd" stroke="#fff" strokeOpacity="0.7" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            <path d={COUNTRY} fill="none" stroke="#ff7a00" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" opacity={Math.min(Math.max((1800 - zoom) / 1200, 0), 1)} />
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

      {view &&
        pins.map((p) => (
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
