import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Car, CarTaxiFront, Bus, Eye, EyeOff, Footprints, Globe2, Landmark, Layers, LocateFixed, MapPin, PartyPopper, TriangleAlert, X } from 'lucide-react'
import type { City, Commune, Place, Sim, World } from '../lib/types'
import { GameMap, type Camera } from '../components/map/GameMap'
import { inkOn, kerbWait, rideLook, waitsAtKerb } from '../game/rides'
import { routeIn, type LngLat } from '../game/roads'
import { useDrivingRoute, waypointsOf } from '../components/map/roadRoute'
import { CIV_BOUNDS, Z_PLACE, Z_TOWN, allPins, boundsFor, routeBounds, type Padding, type Route } from '../components/map/pins'
import { TravelCTA, type OnTravel } from '../components/TravelCTA'
import { iconFor, kindColors } from '../components/icons'
import { Chip, IconTile, needColor } from '../components/ui'
import { EPOCH, clock, duration, mood } from '../game/rules'
import { aCommune } from '../lib/french'
import { t as tr, tx, locale } from '../lib/i18n'

// The whole country on one map. Zoomed out, a badge per city; in a city, a
// badge per mairie (commune); closer still, the places. Tap one for a card
// with the way to get there. On a trip, the route and the taxi on it.

type Selection =
  | { kind: 'city'; city: City }
  | { kind: 'commune'; city: City; commune: Commune }
  | { kind: 'place'; city: City; commune: Commune; place: Place | 'home' }

type Props = { world: World; sim: Sim; night: boolean; desktop: boolean; onClose: () => void; onTravel: OnTravel; onWalk: (id: string) => void }

export function WorldMap({ world, sim, night, desktop, onClose, onTravel, onWalk }: Props) {
  const [selected, setSelected] = useState<Selection | null>(null)
  // On a computer, Échap closes the card shown, then the map.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (selected) setSelected(null)
      else onClose()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [selected, onClose])
  const [zoom, setZoom] = useState(0)
  // The legend: which kinds of places show on the map (none at first: the communes alone).
  const [kinds, setKinds] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(LEGEND_KEY) ?? '[]') as string[])
    } catch {
      return new Set()
    }
  })
  const [legend, setLegend] = useState(false)
  const pickKinds = (next: Set<string>) => {
    setKinds(next)
    try {
      localStorage.setItem(LEGEND_KEY, JSON.stringify([...next]))
    } catch {
      // Private mode: the choice lasts until the map closes.
    }
  }
  const route = useTrip(world, sim)
  const [arrived, setArrived] = useState<string | null>(null)
  const wasTravelling = useRef(!!route)
  const key = useRef(0)
  const fly = useCallback((bounds: Camera['bounds']) => setCamera({ bounds, key: ++key.current }), [])
  const [camera, setCamera] = useState<Camera>(() => ({ bounds: route ? routeBounds(route) : boundsFor(world, { cityId: sim.city }), key: 0 }))

  // The trip just ended: say so, and show where the Sim now is.
  useEffect(() => {
    if (wasTravelling.current && !route) {
      const cm = world.cities.find((c) => c.id === sim.city)?.communes.find((c) => c.id === sim.commune)
      setArrived(cm?.name ?? null)
      fly(boundsFor(world, { cityId: sim.city, communeId: sim.commune }))
    }
    if (route && !wasTravelling.current) {
      setSelected(null)
      setArrived(null)
      fly(routeBounds(route))
    }
    wasTravelling.current = !!route
  }, [route, sim.city, sim.commune, world, fly])

  // The pins need only where the Sim is, its face and its mood. The game hands a new Sim every
  // second (its needs tick): without this every pin was rebuilt each second, and a tap on a pin
  // landing on a rebuild was lost.
  const pinKey = JSON.stringify([sim.city, sim.commune, sim.homeCity, sim.homeCommune, sim.firstName, sim.gender, sim.look, needColor(mood(sim.needs))])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pinSim = useMemo(() => sim, [pinKey])
  // Likewise the trip: its progress moves every second, the pins only need where it goes.
  const routeTo = route?.toId ?? null
  const travelling = !!route
  const pins = useMemo(() => {
    const find = (id: string) => {
      for (const city of world.cities)
        for (const commune of city.communes) {
          if (id === 'home' && city.id === pinSim.homeCity && commune.id === pinSim.homeCommune) return { city, commune, place: 'home' as const }
          const place = commune.places.find((p) => p.id === id)
          if (place) return { city, commune, place }
        }
    }
    return allPins(world, pinSim, selectedId(selected) ?? routeTo, {
      onCity: (id) => {
        const city = world.cities.find((c) => c.id === id)!
        setSelected({ kind: 'city', city })
        fly(boundsFor(world, { cityId: id }))
      },
      onCommune: (cityId, communeId) => {
        const city = world.cities.find((c) => c.id === cityId)!
        setSelected({ kind: 'commune', city, commune: city.communes.find((c) => c.id === communeId)! })
      },
      onPlace: (id) => {
        const hit = find(id)
        if (hit) setSelected({ kind: 'place', ...hit })
      },
    }, travelling, kinds)
  }, [world, pinSim, selected, routeTo, travelling, fly, kinds])

  const padding = useMemo<Padding>(() => (desktop ? { top: 90, bottom: 60, left: 440, right: 80 } : { top: 80, bottom: 270, left: 28, right: 28 }), [desktop])
  const level = zoom >= Z_PLACE ? 'places' : zoom >= Z_TOWN ? 'mairies' : 'pays'

  return (
    <div className="animate-up absolute inset-0 z-50 bg-[var(--color-night)]">
      <GameMap pins={pins} camera={camera} night={night} sim={pinSim} padding={padding} route={route} onZoom={setZoom} />

      {/* Top: what you're looking at, and the way out */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:p-5">
        <div className="hud pointer-events-auto flex items-center gap-2 rounded-2xl py-2 pr-3.5 pl-2.5">
          {route ? <CarTaxiFront size={18} className="text-[var(--color-orange)]" /> : level === 'pays' ? <Globe2 size={18} className="text-[var(--color-emerald)]" /> : level === 'mairies' ? <Landmark size={18} className="text-[var(--color-emerald)]" /> : <MapPin size={18} className="text-[var(--color-orange)]" />}
          <span className="text-sm font-extrabold">{route ? tr('En route') : level === 'pays' ? tr("Côte d'Ivoire") : level === 'mairies' ? tr('Les mairies') : tr('Les lieux du quartier')}</span>
        </div>
        <button className="hud pointer-events-auto grid h-12 w-12 place-items-center rounded-full" onClick={onClose} aria-label={tr('Fermer la carte')}>
          <X size={24} strokeWidth={2.6} />
        </button>
      </div>
      <div className="absolute right-3 z-20 flex flex-col gap-2 lg:right-5" style={{ top: 'max(4.75rem, calc(env(safe-area-inset-top) + 4rem))' }}>
        <button className="hud grid h-11 w-11 place-items-center rounded-xl" onClick={() => fly(route ? routeBounds(route) : boundsFor(world, { cityId: sim.city, communeId: sim.commune }))} aria-label={tr('Me retrouver')} title={tr('Me retrouver')}>
          <LocateFixed size={20} />
        </button>
        <button className="hud grid h-11 w-11 place-items-center rounded-xl" onClick={() => (setSelected(null), fly(CIV_BOUNDS))} aria-label={tr('Tout le pays')} title={tr('Tout le pays')}>
          <Globe2 size={20} />
        </button>
        <button className={`hud relative grid h-11 w-11 place-items-center rounded-xl ${legend ? '!bg-[var(--color-orange)] text-white' : ''}`} onClick={() => setLegend((l) => !l)} aria-label={tr('Légende : les lieux à afficher')} title={tr('Légende')}>
          <Layers size={20} />
          {kinds.size > 0 && <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--color-orange)] px-1 text-[10px] font-extrabold text-white ring-2 ring-white">{kinds.size}</span>}
        </button>
      </div>
      {legend && <Legend world={world} sim={sim} kinds={kinds} onChange={pickKinds} onClose={() => setLegend(false)} />}

      {/* Bottom: the card for what's selected, the trip, or a hint */}
      <div className="absolute inset-x-0 bottom-0 z-20 flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:inset-x-auto lg:top-24 lg:bottom-auto lg:left-5 lg:w-[400px] lg:p-0">
        {selected ? (
          <SelectionCard key={selectedId(selected)} world={world} sim={sim} s={selected} onClose={() => setSelected(null)} onTravel={onTravel} onWalk={onWalk} onZoom={(cityId, communeId) => fly(boundsFor(world, { cityId, communeId }))} />
        ) : route ? (
          <TripCard sim={sim} route={route} />
        ) : arrived ? (
          <Card>
            <div className="flex items-center gap-3">
              <IconTile icon={PartyPopper} colors={['#69e2a0', '#00a862']} size={46} />
              <div className="min-w-0 flex-1">
                <div className="label">{tr('Bien arrivé·e')}</div>
                <div className="font-display text-xl leading-tight font-extrabold">{arrived}</div>
              </div>
            </div>
            <button className="btn btn-emerald mt-3 w-full" onClick={onClose}>
              {tr('Entrer dans le quartier')}
            </button>
          </Card>
        ) : (
          <div className="hud rounded-full px-4 py-2 text-center text-xs font-extrabold text-[var(--color-ink-soft)]">{tr('Glisse pour déplacer · pince pour zoomer · l’orbite tourne et incline')}</div>
        )}
      </div>
    </div>
  )
}

const selectedId = (s: Selection | null) => (!s ? null : s.kind === 'city' ? s.city.id : s.kind === 'commune' ? `${s.city.id}/${s.commune.id}` : s.place === 'home' ? 'home' : s.place.id)

function Card({ children }: { children: React.ReactNode }) {
  return <div className="card motion-pop w-full max-w-md p-4">{children}</div>
}

function SelectionCard({ world, sim, s, onClose, onTravel, onWalk, onZoom }: { world: World; sim: Sim; s: Selection; onClose: () => void; onTravel: OnTravel; onWalk: (id: string) => void; onZoom: (cityId: string, communeId?: string) => void }) {
  const here = (cityId: string, communeId?: string) => cityId === sim.city && (!communeId || communeId === sim.commune) && !sim.activity
  const close = (
    <button className="icon-btn shrink-0 bg-[var(--color-canvas)]" onClick={onClose} aria-label={tr('Fermer')}>
      <X size={18} strokeWidth={2.6} />
    </button>
  )

  if (s.kind === 'city') {
    const { city } = s
    return (
      <Card>
        <div className="flex items-start gap-3">
          <IconTile icon={Landmark} colors={['#3a3f6b', '#161a2b']} size={46} />
          <div className="min-w-0 flex-1">
            <div className="label">{tx('Ville · {length}', { length: city.communes.length })} {city.communes.length > 1 ? 'communes' : 'commune'}</div>
            <div className="font-display text-xl leading-tight font-extrabold">{city.name}</div>
            <p className="mt-0.5 text-sm leading-snug font-semibold text-[var(--color-ink-soft)]">{city.blurb}</p>
          </div>
          {close}
        </div>
        <div className="mt-3">
          {here(city.id) ? (
            <button className="btn btn-soft w-full" onClick={() => onZoom(city.id)}>
              <Landmark size={18} /> {tr('Voir les mairies')}
            </button>
          ) : (
            <TravelCTA world={world} sim={sim} cityId={city.id} communeId={city.communes[0].id} onTravel={onTravel} />
          )}
        </div>
      </Card>
    )
  }

  if (s.kind === 'commune') {
    const { city, commune } = s
    const home = city.id === sim.homeCity && commune.id === sim.homeCommune
    return (
      <Card>
        <div className="flex items-start gap-3">
          <IconTile icon={Landmark} colors={['#69e2a0', '#00a862']} size={46} />
          <div className="min-w-0 flex-1">
            <div className="label">
              {tx('Mairie · {name} {0}', { name: city.name, 0: home ? tr(' · chez toi') : '' })}
            </div>
            <div className="font-display text-xl leading-tight font-extrabold">{commune.name}</div>
            <p className="mt-0.5 text-sm leading-snug font-semibold text-[var(--color-ink-soft)]">{commune.blurb}</p>
          </div>
          {close}
        </div>
        {commune.admin && <p className="mt-1.5 text-xs font-bold text-[var(--color-ink-soft)]">{tr('Commune ·')} {commune.admin.parent}</p>}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {/* Its own places and the map's (the churches, the shops, the maquis): all there are, as « Où aller » counts them. */}
          <Chip>{(commune.places.length + (commune.mapCount ?? 0)).toLocaleString(locale())} {tr('lieux')}</Chip>
          {here(city.id, commune.id) && <Chip tone="good">{tr('Tu es ici')}</Chip>}
        </div>
        <div className="mt-3 grid gap-2">
          {!here(city.id, commune.id) && <TravelCTA world={world} sim={sim} cityId={city.id} communeId={commune.id} onTravel={onTravel} />}
          <button className="btn btn-soft w-full" onClick={() => onZoom(city.id, commune.id)}>
            <MapPin size={18} /> {tr('Voir les lieux')}
          </button>
        </div>
      </Card>
    )
  }

  const { city, commune, place } = s
  const home = place === 'home'
  const kind = home ? null : world.kinds[place.kind]
  const id = home ? 'home' : place.id
  return (
    <Card>
      <div className="flex items-start gap-3">
        <IconTile icon={iconFor(home ? 'house' : kind!.icon)} colors={kindColors(home ? 'home' : place.kind)} size={46} />
        <div className="min-w-0 flex-1">
          <div className="label">
            {home ? tr('Ton logement') : kind!.label} · {commune.name}
          </div>
          <div className="font-display text-xl leading-tight font-extrabold">{home ? tr('Chez toi') : place.name}</div>
          <p className="mt-0.5 text-sm leading-snug font-semibold text-[var(--color-ink-soft)]">{home ? tr('Dormir, se doucher, cuisiner') : tr('{length} activités sur place', { length: kind!.interactions.length })}</p>
          {!home && <PlaceFacts place={place} />}
        </div>
        {close}
      </div>
      <div className="mt-3">
        {here(city.id, commune.id) ? (
          <button className="btn w-full" onClick={() => onWalk(id)}>
            <Footprints size={18} /> {tr('Y aller à pied')}
          </button>
        ) : (
          <>
            <TravelCTA world={world} sim={sim} cityId={city.id} communeId={commune.id} onTravel={onTravel} />
            <p className="mt-2 text-center text-xs font-bold text-[var(--color-ink-soft)]">{tx("Le taxi te dépose {0} ; ensuite, c'est à pied.", { 0: aCommune(commune.name) })}</p>
          </>
        )}
      </div>
    </Card>
  )
}

/** The trip in progress, ticking in real time. */
function TripCard({ sim, route }: { sim: Sim; route: Route }) {
  const a = sim.activity!
  const left = Math.max(0, Math.ceil(a.end - (Date.now() - EPOCH) / 60000))
  const car = route.mode === 'car'
  const how = route.how
  const app = !car && route.color === '#161a2b'
  return (
    <Card>
      <div className="flex items-center gap-3">
        <IconTile icon={car ? Bus : app ? Car : CarTaxiFront} colors={car ? ['#ffa040', '#ff6a00'] : [route.color, route.color]} style={car ? undefined : { color: inkOn(route.color) }} size={46} />
        <div className="min-w-0 flex-1">
          <div className="label">{how} {tr('· arrivée à')} {clock(a.end).time}</div>
          <div className="truncate font-display text-xl leading-tight font-extrabold">{tr('Vers')} {route.label}</div>
        </div>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[var(--color-canvas)]">
        <div className="h-full rounded-full bg-[var(--color-orange)] transition-[width] duration-1000 ease-linear" style={{ width: `${route.progress * 100}%` }} />
      </div>
      <div className="mt-1.5 text-xs font-extrabold text-[var(--color-ink-soft)]">{route.pickup?.waits ? tr('Le {0} t’attend au bord de la route…', { 0: (route.name ?? 'taxi').toLowerCase() }) : route.pickup ? (car ? tr('Le car arrive à l’arrêt…') : tr('Le chauffeur arrive te chercher…')) : left > 0 ? tr('Encore {0} de route', { 0: duration(left) }) : tr('On arrive…')}</div>
      {a.trip?.incident && (
        <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-[#fff4e5] px-3 py-2 text-xs font-bold text-[#a35200]">
          <TriangleAlert size={14} className="mt-px shrink-0" /> {a.trip.incident}
        </p>
      )}
    </Card>
  )
}

/**
 * When this phone first saw each trip (its start is a whole game minute, up to
 * one before the tap): the driver's coming is counted from then, so it's seen.
 */
const tripSeen = new Map<string, number>()

/** The current trip as a route, its progress updated every second. */
function useTrip(world: World, sim: Sim): Route | null {
  const a = sim.activity?.kind === 'travel' ? sim.activity : null
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!a) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [a])
  // The trip's ends and the road network's path between them…
  const base = useMemo(() => {
    if (!a?.trip) return null
    const t = a.trip
    const fromCity = world.cities.find((c) => c.id === t.fromCity)
    const toCity = world.cities.find((c) => c.id === t.city)
    const from = fromCity?.communes.find((c) => c.id === t.fromCommune)
    const to = toCity?.communes.find((c) => c.id === t.commune)
    if (!from || !to) return null
    // The road it takes: saved with the trip, or worked out again for older trips.
    const path = t.path ?? (t.city === t.fromCity ? routeIn(world, t.city, t.fromCommune, t.commune)?.points : undefined)
    const ends: [LngLat, LngLat] = [[from.lng, from.lat], [to.lng, to.lat]]
    return { t, from, to, toCity: toCity!, path, ends, waypoints: waypointsOf(world, t.city, path, ...ends) }
  }, [a, world])
  // …then the same way on the real streets, once Mapbox has drawn it.
  // (The métro keeps to its line, by the stations.)
  const streets = useDrivingRoute(base?.t.mode === 'metro' ? null : (base?.waypoints ?? null))
  // In town the driver comes to the Sim first, from a few streets away (on the side away from where it's going);
  // in one's own vehicle, nobody comes.
  const pickFrom = useMemo<LngLat | null>(() => {
    if (!base || base.t.city !== base.t.fromCity || base.t.mode === 'avion' || base.t.mode === 'perso' || base.t.mode === 'metro') return null
    const [[x0, y0], [x1, y1]] = base.ends
    const d = Math.hypot(x1 - x0, y1 - y0) || 1
    return [x0 - ((x1 - x0) / d) * 0.006 + ((y1 - y0) / d) * 0.004, y0 - ((y1 - y0) / d) * 0.006 - ((x1 - x0) / d) * 0.004]
  }, [base])
  const approach = useDrivingRoute(pickFrom && base ? [pickFrom, base.ends[0]] : null)
  return useMemo(() => {
    if (!a || !base) return null
    const { t, from, to, toCity, path, ends } = base
    // The first part of the trip (a third, between 45 seconds and three minutes) is the driver coming; then they go together.
    const key = `${a.start}/${a.end}`
    const nowMin = (now - EPOCH) / 60000
    if (!tripSeen.has(key)) tripSeen.set(key, nowMin)
    // Seen within its first minute: the trip began then; opened later on, from its start.
    const seen = tripSeen.get(key)!
    const begin = seen < a.start + 1 ? Math.min(a.end - 1, Math.max(a.start, seen)) : a.start
    // Hailed at the roadside, it has stopped there: it waits (game/rides.ts kerbWait) while the Sim walks up.
    const waits = waitsAtKerb(t.mode)
    const pick = pickFrom ? (waits ? kerbWait(a.end - begin) : Math.min(3, Math.max(0.75, (a.end - begin) * 0.33))) : 0
    const at = nowMin - begin
    const progress = Math.min(1, Math.max(0, (at - pick) / Math.max(0.5, a.end - begin - pick)))
    const pickup = pickFrom && at < pick ? (waits ? { from: ends[0], k: 1, waits: true } : { from: pickFrom, path: approach, k: Math.max(0, at / pick) }) : undefined
    const look = rideLook(world, t.mode, from, t.class)
    return { from: ends[0], to: ends[1], path: streets ?? path, progress, mode: t.mode, color: look.color, how: look.how, name: look.name, toId: `${t.city}/${t.commune}`, label: t.city === t.fromCity ? to.name : `${to.name}, ${toCity.name}`, pickup }
  }, [a, base, streets, approach, pickFrom, now, world])
}

/** Real or invented, who runs it, and whether it still exists: from the world data's provenance. */
function PlaceFacts({ place }: { place: Place }) {
  const verified = place.source?.status === 'verified' || place.source?.status === 'partial'
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {place.real ? <Chip tone={verified ? 'good' : 'neutral'}>{verified ? tr('Lieu réel') : tr('Lieu réel, à vérifier')}</Chip> : <Chip>{tr('Lieu du jeu')}</Chip>}
      {place.quarter && <Chip>{place.quarter}</Chip>}
      {place.operator && <Chip>{place.operator}</Chip>}
      {place.closed && <Chip tone="bad">{tr('Fermé en vrai depuis')} {place.closed.slice(0, 4)}</Chip>}
    </div>
  )
}

const LEGEND_KEY = 'babi.map.lieux'

/**
 * The legend: every kind of place there is, with its colour and its icon as
 * on the map, and how many there are in the Sim's city; each one shown or
 * hidden with a tap. Nothing at first: the map shows the communes alone.
 */
function Legend({ world, sim, kinds, onChange, onClose }: { world: World; sim: Sim; kinds: Set<string>; onChange: (k: Set<string>) => void; onClose: () => void }) {
  const city = world.cities.find((c) => c.id === sim.city)
  const count = new Map<string, number>()
  for (const cm of city?.communes ?? []) for (const p of cm.places) count.set(p.kind, (count.get(p.kind) ?? 0) + 1)
  const all = Object.keys(world.kinds)
    .filter((k) => k !== 'home' && world.cities.some((c) => c.communes.some((cm) => cm.places.some((p) => p.kind === k))))
    .sort((a, b) => (count.get(b) ?? 0) - (count.get(a) ?? 0) || world.kinds[a].label.localeCompare(world.kinds[b].label))
  const toggle = (k: string) => {
    const next = new Set(kinds)
    if (next.has(k)) next.delete(k)
    else next.add(k)
    onChange(next)
  }
  return (
    <div className="sheet animate-up absolute right-3 z-30 flex max-h-[60vh] w-[min(300px,calc(100vw-24px))] flex-col overflow-hidden rounded-[22px] lg:right-5" style={{ top: 'max(12.5rem, calc(env(safe-area-inset-top) + 11.75rem))' }}>
      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
        <div>
          <div className="font-display text-[17px] leading-tight font-extrabold">{tr('Légende')}</div>
          <div className="text-[11px] font-bold text-[var(--color-ink-soft)]">{tr('Les lieux à afficher sur la carte')}</div>
        </div>
        <button className="icon-btn bg-[var(--color-canvas)]" onClick={onClose} aria-label={tr('Fermer la légende')}>
          <X size={18} />
        </button>
      </div>
      <div className="flex gap-2 px-4 pb-2">
        <button className="btn btn-soft flex-1 !py-1.5 !text-xs" onClick={() => onChange(new Set(all))}>
          <Eye size={14} /> {tr('Tout afficher')}
        </button>
        <button className="btn btn-soft flex-1 !py-1.5 !text-xs" onClick={() => onChange(new Set())}>
          <EyeOff size={14} /> {tr('Tout masquer')}
        </button>
      </div>
      <ul className="overflow-y-auto px-2 pb-2">
        {all.map((k) => {
          const on = kinds.has(k)
          return (
            <li key={k}>
              <button className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition ${on ? '' : 'opacity-55'}`} onClick={() => toggle(k)} aria-pressed={on}>
                <IconTile icon={iconFor(world.kinds[k].icon)} colors={kindColors(k)} size={30} radius={10} />
                <span className="min-w-0 flex-1 truncate text-sm font-extrabold">{world.kinds[k].label}</span>
                {count.get(k) ? <span className="text-[11px] font-bold text-[var(--color-ink-soft)] tabular-nums">{count.get(k)}</span> : null}
                {on ? <Eye size={16} className="text-[var(--color-emerald)]" /> : <EyeOff size={16} className="text-[var(--color-ink-soft)]" />}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
