import { useEffect, useMemo, useRef, useState } from 'react'
import type * as MapboxGL from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { Check, LandPlot, LocateFixed, MapPin, X } from 'lucide-react'
import { api } from '../lib/api'
import type { LotSpot, Sim } from '../lib/types'
import { useWorld } from '../store/world'
import { amount } from '../game/rules'
import { aCommune } from '../lib/french'
import { lotAt } from '../world3d/open/lotSpot'
import { toLatLng, toLocal } from '../world3d/open/geo'
import { Helper } from './Helper'
import { nearOf } from './LotPlaceHud'

// Where one's land goes, picked on the map of the commune, as one picks a pick-up
// spot in a ride app: the pin stays in the middle and the map moves under it; the
// lot's own size is drawn round the pin, the neighbours' lots are marked, and the
// nearest place the game knows says where it is (« près du marché »). The house
// is built there (world3d/open/lotSpot.ts). Too close to a neighbour, in the
// lagoon or out of the commune: the button says so.

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined
/** As the server checks (sims/plot.go spotReach, spotGap): in the commune, not on a neighbour. */
const REACH = 6000
const GAP = 30

export const lotMapReady = () => !!TOKEN

type Props = {
  sim: Sim
  city: string
  commune: string
  /** The lot's size (metres), and what the button does: buy it there (its price), or move one's own empty lot (its id). */
  w: number
  d: number
  price?: number
  moving?: number
  /** null: no map here, the game draws the spot. */
  onPick: (spot: { lat: number; lng: number } | null) => Promise<boolean>
  onClose: () => void
}

export function LotMap({ sim, city, commune, w, d, price, moving, onPick, onClose }: Props) {
  const world = useWorld((s) => s.world)
  const cm = world?.cities.find((c) => c.id === city)?.communes.find((c) => c.id === commune)
  const origin = useMemo(() => ({ lat: cm?.lat ?? 5.33, lng: cm?.lng ?? -4.03 }), [cm?.lat, cm?.lng])
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<MapboxGL.Map | null>(null)
  const [spots, setSpots] = useState<LotSpot[]>([])
  const [at, setAt] = useState(origin)
  const [moved, setMoved] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [px, setPx] = useState(1)
  const [water, setWater] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    api.lotSpots(sim.id, city, commune).then(setSpots, () => setSpots([]))
  }, [sim.id, city, commune])
  // Every lot of the commune, where it stands (set on the map, or the spot the game drew).
  const placed = useMemo(() => spots.map((s) => ({ ...s, pos: s.lat != null && s.lng != null ? { lat: s.lat, lng: s.lng } : toLatLng(origin, lotAt(origin, s.key, null)) })), [spots, origin])
  const own = moving ? placed.find((s) => s.lot === moving) : undefined

  useEffect(() => {
    if (!TOKEN || !box.current) return
    let gone = false
    const markers: MapboxGL.Marker[] = []
    void import('mapbox-gl').then(({ default: mapboxgl }) => {
      if (gone || !box.current) return
      mapboxgl.accessToken = TOKEN
      const start = own?.pos ?? origin
      const m = new mapboxgl.Map({
        container: box.current,
        style: 'mapbox://styles/mapbox/standard',
        config: { basemap: { lightPreset: 'day', showPointOfInterestLabels: true } },
        center: [start.lng, start.lat],
        zoom: 17.6,
        minZoom: 13,
        maxZoom: 19,
        pitch: 0,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        attributionControl: false,
      })
      m.touchZoomRotate.disableRotation()
      map.current = m
      const sync = () => {
        const c = m.getCenter()
        setAt({ lat: c.lat, lng: c.lng })
        // Metres to pixels at this zoom (Mapbox's 512 px tiles).
        setPx((512 * 2 ** m.getZoom()) / (40075016.686 * Math.cos((c.lat * Math.PI) / 180)))
      }
      m.on('move', sync)
      m.on('movestart', () => setDragging(true))
      m.on('moveend', () => {
        setDragging(false)
        setMoved(true)
        // In the lagoon? (The basemap's water, where the map tells.)
        try {
          const p = m.project(m.getCenter())
          setWater(m.queryRenderedFeatures(p).some((f) => /water/i.test(`${f.layer?.id ?? ''} ${f.sourceLayer ?? ''}`)))
        } catch {
          setWater(false)
        }
      })
      m.on('error', () => setFailed(true))
      m.on('load', () => (m.resize(), sync()))
      // The lot's size at this zoom from the start, not only once every tile is in.
      sync()
      // The neighbours' lots (and one's own), a little marker each.
      for (const s of placed) {
        if (s.lot && s.lot === moving) continue
        const el = document.createElement('div')
        el.textContent = s.mine ? 'À toi' : ''
        Object.assign(el.style, s.mine ? MINE : NEIGHBOUR)
        markers.push(new mapboxgl.Marker({ element: el }).setLngLat([s.pos.lng, s.pos.lat]).addTo(m))
      }
    }, () => setFailed(true))
    return () => {
      gone = true
      markers.forEach((k) => k.remove())
      map.current?.remove()
      map.current = null
    }
  }, [origin, placed.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // What's wrong with this spot, if anything; and where it is, said in the game's words.
  const metres = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => Math.hypot(...toLocal(a, b.lat, b.lng))
  const neighbour = placed.find((s) => s.lot !== moving && metres(s.pos, at) < GAP + Math.max(w, d) / 2)
  const far = metres(origin, at) > REACH
  const why = far ? `C'est trop loin : reste ${aCommune(cm?.name ?? '')}.` : water ? "C'est dans l'eau ! Choisis la terre ferme." : neighbour ? (neighbour.mine ? 'Tu as déjà un terrain juste là.' : 'Ce coin est pris par un voisin : déplace-toi un peu.') : null
  const near = useMemo(() => {
    let best: { name: string; m: number } | null = null
    for (const p of cm?.places ?? []) {
      const m = metres(at, { lat: p.lat, lng: p.lng })
      if (!best || m < best.m) best = { name: p.name, m }
    }
    return best
  }, [at, cm?.places])

  const pick = async () => {
    setBusy(true)
    const ok = await onPick(at)
    setBusy(false)
    if (ok) onClose()
  }
  const recentre = () => map.current?.flyTo({ center: [(own?.pos ?? origin).lng, (own?.pos ?? origin).lat], zoom: 17.6 })

  return (
    <div className="animate-up fixed inset-0 z-[60] flex flex-col bg-[var(--color-night)]">
      <div className="relative min-h-0 flex-1">
        {/* Mapbox's own CSS makes its container position: relative: the map in a box of its own */}
        <div className="absolute inset-0">
          <div ref={box} className="h-full w-full" />
        </div>
        {(!TOKEN || failed) && (
          <div className="absolute inset-0 grid place-items-center bg-[#e9e1cf] p-6 text-center">
            <div className="flex max-w-xs flex-col items-center gap-3">
              <Helper size={56} />
              <p className="text-sm font-bold text-[var(--color-ink)]">La carte ne s'affiche pas sur ce téléphone pour l'instant. Tu peux acheter quand même : on te trouve un bon coin {aCommune(cm?.name ?? '')}.</p>
            </div>
          </div>
        )}
        {/* The lot's own size round the pin, and the pin, lifted while the map moves */}
        {TOKEN && !failed && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className={`rounded-[6px] border-2 transition-colors ${why ? 'border-[#ff3d57] bg-[#ff3d57]/20' : 'border-[#00b86b] bg-[#00b86b]/20'}`} style={{ width: Math.max(18, w * px), height: Math.max(18, d * px) }} />
            <div className="absolute" style={{ transform: `translateY(${dragging ? -34 : -22}px)`, transition: 'transform 0.25s var(--ease-spring)' }}>
              <MapPin size={44} strokeWidth={2.2} className={`drop-shadow-[0_6px_6px_rgba(0,0,0,0.35)] ${why ? 'text-[#ff3d57]' : 'text-[var(--color-orange)]'}`} fill="#fff" />
            </div>
            <div className="absolute h-2 w-5 rounded-[50%] bg-black/30 blur-[1px]" style={{ transform: `scale(${dragging ? 0.6 : 1})`, transition: 'transform 0.25s' }} />
          </div>
        )}
        <header className="absolute inset-x-0 top-0 flex items-start gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="hud min-w-0 flex-1 rounded-2xl px-3 py-2">
            <div className="label">{moving ? 'Déplacer ton terrain' : 'Où mettre ton terrain ?'}</div>
            <div className="truncate font-display text-[16px] leading-tight font-extrabold">{moved || own ? (near && near.m < 900 ? nearOf(near.name) : capitalFirst(aCommune(cm?.name ?? ''))) : 'Déplace la carte sous l’épingle'}</div>
          </div>
          <button className="icon-btn hud shrink-0" onClick={onClose} aria-label="Fermer">
            <X size={22} strokeWidth={2.6} />
          </button>
        </header>
        {TOKEN && !failed && (
          <button className="icon-btn hud absolute right-3 bottom-3" onClick={recentre} aria-label="Revenir au centre">
            <LocateFixed size={20} />
          </button>
        )}
      </div>
      <footer className="sheet rounded-t-[24px] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mb-2 flex items-center gap-2 text-sm font-bold text-[var(--color-ink-soft)]">
          <LandPlot size={16} className="shrink-0 text-[#1a8a4a]" />
          <span className="min-w-0 flex-1">
            {w} × {d} m{price ? ` · ${amount(price)} Djai` : ''} · ta maison sera construite ici
          </span>
        </div>
        {why && TOKEN && !failed && <p className="motion-shake mb-2 rounded-xl bg-[#ffeef1] px-3 py-2 text-sm font-bold text-[#d81b3f]">{why}</p>}
        <button className="btn w-full" disabled={busy || (!!TOKEN && !failed ? !!why : !!moving)} onClick={() => void (TOKEN && !failed ? pick() : onPick(null).then((ok) => ok && onClose()))}>
          <Check size={18} /> {busy ? '…' : moving ? 'Mettre mon terrain ici' : TOKEN && !failed ? `Acheter ici${price ? ` · ${amount(price)} Djai` : ''}` : 'Acheter quand même'}
        </button>
      </footer>
    </div>
  )
}

/** The neighbours' lots on the map, and one's own. */
const NEIGHBOUR = { width: '16px', height: '16px', borderRadius: '5px', background: '#8a8f99', border: '2px solid #fff', boxShadow: '0 2px 6px rgb(0 0 0 / 0.35)' }
const MINE = { ...NEIGHBOUR, width: 'auto', height: 'auto', padding: '2px 7px', background: '#00a862', color: '#fff', font: '800 11px var(--font-sans, sans-serif)' }

const capitalFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
