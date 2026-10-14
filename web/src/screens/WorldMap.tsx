import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Car, CarTaxiFront, Bus, Footprints, Globe2, Landmark, LocateFixed, MapPin, PartyPopper, TriangleAlert, X } from 'lucide-react'
import type { City, Commune, Place, Sim, World } from '../lib/types'
import { GameMap, type Camera } from '../components/map/GameMap'
import { inkOn, rideLook } from '../game/rides'
import { routeIn, type LngLat } from '../game/roads'
import { useDrivingRoute, waypointsOf } from '../components/map/roadRoute'
import { CIV_BOUNDS, Z_PLACE, Z_TOWN, allPins, boundsFor, routeBounds, type Padding, type Route } from '../components/map/pins'
import { TravelCTA, type OnTravel } from '../components/TravelCTA'
import { iconFor, kindColors } from '../components/icons'
import { Chip, IconTile } from '../components/ui'
import { EPOCH, clock, duration } from '../game/rules'

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
  const [zoom, setZoom] = useState(0)
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

  const pins = useMemo(() => {
    const find = (id: string) => {
      for (const city of world.cities)
        for (const commune of city.communes) {
          if (id === 'home' && city.id === sim.homeCity && commune.id === sim.homeCommune) return { city, commune, place: 'home' as const }
          const place = commune.places.find((p) => p.id === id)
          if (place) return { city, commune, place }
        }
    }
    return allPins(world, sim, selectedId(selected) ?? route?.toId ?? null, {
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
    }, !!route)
  }, [world, sim, selected, route, fly])

  const padding = useMemo<Padding>(() => (desktop ? { top: 90, bottom: 60, left: 440, right: 80 } : { top: 80, bottom: 270, left: 28, right: 28 }), [desktop])
  const level = zoom >= Z_PLACE ? 'places' : zoom >= Z_TOWN ? 'mairies' : 'pays'

  return (
    <div className="animate-up absolute inset-0 z-50 bg-[var(--color-night)]">
      <GameMap pins={pins} camera={camera} night={night} sim={sim} padding={padding} route={route} onZoom={setZoom} />

      {/* Top: what you're looking at, and the way out */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:p-5">
        <div className="hud pointer-events-auto flex items-center gap-2 rounded-2xl py-2 pr-3.5 pl-2.5">
          {route ? <CarTaxiFront size={18} className="text-[var(--color-orange)]" /> : level === 'pays' ? <Globe2 size={18} className="text-[var(--color-emerald)]" /> : level === 'mairies' ? <Landmark size={18} className="text-[var(--color-emerald)]" /> : <MapPin size={18} className="text-[var(--color-orange)]" />}
          <span className="text-sm font-extrabold">{route ? 'En route' : level === 'pays' ? "Côte d'Ivoire" : level === 'mairies' ? 'Les mairies' : 'Les lieux du quartier'}</span>
        </div>
        <button className="hud pointer-events-auto grid h-12 w-12 place-items-center rounded-full" onClick={onClose} aria-label="Fermer la carte">
          <X size={24} strokeWidth={2.6} />
        </button>
      </div>
      <div className="absolute right-3 z-20 flex flex-col gap-2 lg:right-5" style={{ top: 'max(4.75rem, calc(env(safe-area-inset-top) + 4rem))' }}>
        <button className="hud grid h-11 w-11 place-items-center rounded-xl" onClick={() => fly(route ? routeBounds(route) : boundsFor(world, { cityId: sim.city, communeId: sim.commune }))} aria-label="Me retrouver" title="Me retrouver">
          <LocateFixed size={20} />
        </button>
        <button className="hud grid h-11 w-11 place-items-center rounded-xl" onClick={() => (setSelected(null), fly(CIV_BOUNDS))} aria-label="Tout le pays" title="Tout le pays">
          <Globe2 size={20} />
        </button>
      </div>

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
                <div className="label">Bien arrivé·e</div>
                <div className="font-display text-xl leading-tight font-extrabold">{arrived}</div>
              </div>
            </div>
            <button className="btn btn-emerald mt-3 w-full" onClick={onClose}>
              Entrer dans le quartier
            </button>
          </Card>
        ) : (
          <div className="hud rounded-full px-4 py-2 text-center text-xs font-extrabold text-[var(--color-ink-soft)]">Pince ou fais défiler pour zoomer · touche une mairie</div>
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
    <button className="icon-btn shrink-0 bg-[var(--color-canvas)]" onClick={onClose} aria-label="Fermer">
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
            <div className="label">Ville · {city.communes.length} {city.communes.length > 1 ? 'communes' : 'commune'}</div>
            <div className="font-display text-xl leading-tight font-extrabold">{city.name}</div>
            <p className="mt-0.5 text-sm leading-snug font-semibold text-[var(--color-ink-soft)]">{city.blurb}</p>
          </div>
          {close}
        </div>
        <div className="mt-3">
          {here(city.id) ? (
            <button className="btn btn-soft w-full" onClick={() => onZoom(city.id)}>
              <Landmark size={18} /> Voir les mairies
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
              Mairie · {city.name}
              {home ? ' · chez toi' : ''}
            </div>
            <div className="font-display text-xl leading-tight font-extrabold">{commune.name}</div>
            <p className="mt-0.5 text-sm leading-snug font-semibold text-[var(--color-ink-soft)]">{commune.blurb}</p>
          </div>
          {close}
        </div>
        {commune.admin && <p className="mt-1.5 text-xs font-bold text-[var(--color-ink-soft)]">Commune · {commune.admin.parent}</p>}
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Chip>{commune.places.length} lieux</Chip>
          {here(city.id, commune.id) && <Chip tone="good">Tu es ici</Chip>}
        </div>
        <div className="mt-3 grid gap-2">
          {!here(city.id, commune.id) && <TravelCTA world={world} sim={sim} cityId={city.id} communeId={commune.id} onTravel={onTravel} />}
          <button className="btn btn-soft w-full" onClick={() => onZoom(city.id, commune.id)}>
            <MapPin size={18} /> Voir les lieux
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
            {home ? 'Ton logement' : kind!.label} · {commune.name}
          </div>
          <div className="font-display text-xl leading-tight font-extrabold">{home ? 'Chez toi' : place.name}</div>
          <p className="mt-0.5 text-sm leading-snug font-semibold text-[var(--color-ink-soft)]">{home ? 'Dormir, se doucher, cuisiner' : `${kind!.interactions.length} activités sur place`}</p>
          {!home && <PlaceFacts place={place} />}
        </div>
        {close}
      </div>
      <div className="mt-3">
        {here(city.id, commune.id) ? (
          <button className="btn w-full" onClick={() => onWalk(id)}>
            <Footprints size={18} /> Y aller à pied
          </button>
        ) : (
          <>
            <TravelCTA world={world} sim={sim} cityId={city.id} communeId={commune.id} onTravel={onTravel} />
            <p className="mt-2 text-center text-xs font-bold text-[var(--color-ink-soft)]">Le taxi te dépose à {commune.name} ; ensuite, c'est à pied.</p>
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
          <div className="label">{how} · arrivée à {clock(a.end).time}</div>
          <div className="truncate font-display text-xl leading-tight font-extrabold">Vers {route.label}</div>
        </div>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[var(--color-canvas)]">
        <div className="h-full rounded-full bg-[var(--color-orange)] transition-[width] duration-1000 ease-linear" style={{ width: `${route.progress * 100}%` }} />
      </div>
      <div className="mt-1.5 text-xs font-extrabold text-[var(--color-ink-soft)]">{left > 0 ? `Encore ${duration(left)} de route` : 'On arrive…'}</div>
      {a.trip?.incident && (
        <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-[#fff4e5] px-3 py-2 text-xs font-bold text-[#a35200]">
          <TriangleAlert size={14} className="mt-px shrink-0" /> {a.trip.incident}
        </p>
      )}
    </Card>
  )
}

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
  const streets = useDrivingRoute(base?.waypoints ?? null)
  return useMemo(() => {
    if (!a || !base) return null
    const { t, from, to, toCity, path, ends } = base
    const progress = Math.min(1, Math.max(0, ((now - EPOCH) / 60000 - a.start) / Math.max(1, a.end - a.start)))
    const look = rideLook(world, t.mode, from)
    return { from: ends[0], to: ends[1], path: streets ?? path, progress, mode: t.mode, color: look.color, how: look.how, toId: `${t.city}/${t.commune}`, label: t.city === t.fromCity ? to.name : `${to.name}, ${toCity.name}` }
  }, [a, base, streets, now, world])
}

/** Real or invented, who runs it, and whether it still exists: from the world data's provenance. */
function PlaceFacts({ place }: { place: Place }) {
  const verified = place.source?.status === 'verified' || place.source?.status === 'partial'
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {place.real ? <Chip tone={verified ? 'good' : 'neutral'}>{verified ? 'Lieu réel' : 'Lieu réel, à vérifier'}</Chip> : <Chip>Lieu du jeu</Chip>}
      {place.quarter && <Chip>{place.quarter}</Chip>}
      {place.operator && <Chip>{place.operator}</Chip>}
      {place.closed && <Chip tone="bad">Fermé en vrai depuis {place.closed.slice(0, 4)}</Chip>}
    </div>
  )
}
