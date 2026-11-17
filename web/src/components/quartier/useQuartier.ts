import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { SIM_CHANGED } from '../../lib/live'
import type { Place, QuartierArea, Sim, World } from '../../lib/types'
import { weakDevice } from '../../lib/device'
import { useLightPhone } from '../../lib/lightPhone'
import { t as tr } from '../../lib/i18n'
import { DEV_LOT_R, LOT_RADIUS, LOT_RADIUS_LIGHT, QUARTIER_RADIUS, QUARTIER_RADIUS_LIGHT, useQuartierWorld, type QLot } from '../../world3d/quartier/store'
import { buildLots, homeGuess, MAX_PLACES, MAX_PLACES_LIGHT } from '../../world3d/quartier/lots'
import { toLocal } from '../../world3d/open/geo'
import type { QuartierBuilding, QuartierKind, QuartierView } from '../../world3d/quartier/types'
import { mockHint, quartierApi, quartierMockOn } from './mock'
import { api } from '../../lib/api'

// « Mon quartier » on the game's screen (update « mon-quartier »): which quartier is played (one's own, a
// friend's on a visit) or Babi en ligne (the whole city, as before), kept per Sim on the phone; the quartier
// and the neighbourhood round it read from the server; its lots (world3d/quartier/lots.ts) for the quartier's
// view, and the one lot played in the street; its buildings as the street's places; the 3D world told
// (world3d/quartier/store).

/** What is played: one's quartier, Babi en ligne, or a visit to someone's quartier (`visit:<owner>`). */
export type QuartierMode = 'quartier' | 'babi' | `visit:${string}`

const modeKey = (sim: string) => `babi.quartier.${sim}`
function readMode(sim: string): QuartierMode {
  try {
    const m = localStorage.getItem(modeKey(sim))
    if (m === 'babi' || m === 'quartier' || m?.startsWith('visit:')) return m as QuartierMode
  } catch {
    // (No storage: one's quartier, the start of every player.)
  }
  return 'quartier'
}

/** The street's place kind each building of the quartier is, where the game has one (its menu, its inside). */
const PLACE_KIND: Partial<Record<QuartierKind, string[]>> = {
  boutique: ['boutique'],
  maquis: ['maquis'],
  salon: ['salon'],
  cabine: ['mobile-money', 'boutique'],
  pharmacie: ['pharmacie'],
  marche: ['market'],
  ecole: ['school'],
  grin: ['grin'],
  terrain: ['field', 'pitch'],
  salle_fetes: ['salle-fetes', 'club'],
}

export const quartierKindName = (k: QuartierKind): string =>
  ({
    maison: tr('Maison'),
    boutique: tr('Boutique'),
    maquis: tr('Maquis'),
    grin: tr('Grin'),
    salon: tr('Salon de coiffure'),
    cabine: tr('Cabine Mobile Money'),
    terrain: tr('Terrain de foot'),
    arret_gbaka: tr('Arrêt de gbaka'),
    eclairage: tr('Éclairage public'),
    ecole: tr('École'),
    pharmacie: tr('Pharmacie'),
    marche: tr('Petit marché'),
    salle_fetes: tr('Salle des fêtes'),
    immeuble: tr('Immeuble'),
  })[k] ?? k

export function useQuartier({ open, sim, world, places: streetPlaces }: { open: boolean; sim: Sim | undefined; world: World | undefined; /** The street's other places (the map's), for the view's lots. */ places?: Place[] }) {
  const simId = sim?.id
  const [mode, setModeState] = useState<QuartierMode>(() => (simId ? readMode(simId) : 'quartier'))
  useEffect(() => {
    if (simId) setModeState(readMode(simId))
  }, [simId])
  // The view of the neighbourhood, or one lot played (back to the view at each change of quartier).
  const [scene, setScene] = useState<'vue' | 'lot'>('vue')
  const [lot, setLot] = useState<QLot | null>(null)
  const setMode = useCallback(
    (m: QuartierMode) => {
      setModeState(m)
      setScene('vue')
      setLot(null)
      try {
        if (simId) localStorage.setItem(modeKey(simId), m)
      } catch {
        // (Kept for this time only.)
      }
    },
    [simId],
  )
  // The mock's quartiers stand round the commune the Sim is in.
  if (open && quartierMockOn() && sim && world) {
    const c = world.cities.find((x) => x.id === sim.city)?.communes.find((x) => x.id === sim.commune)
    if (c && (mockHint.commune !== c.id || mockHint.lat !== c.lat)) Object.assign(mockHint, { commune: c.id, lat: c.lat, lng: c.lng })
  }

  // One's own quartier, read when the update is open (and again after building, collecting…).
  const [own, setOwn] = useState<QuartierView | null>(null)
  const [failed, setFailed] = useState(false)
  const [version, setVersion] = useState(0)
  const refresh = useCallback(() => setVersion((v) => v + 1), [])
  // (The management sheets tell every change: read again.)
  useEffect(() => {
    if (!open) return
    window.addEventListener(SIM_CHANGED, refresh)
    return () => window.removeEventListener(SIM_CHANGED, refresh)
  }, [open, refresh])
  useEffect(() => {
    if (!open || !simId) return
    let gone = false
    quartierApi
      .quartier(simId)
      .then((v) => !gone && setOwn({ ...v, owner: v.owner ?? simId }))
      .catch(() => !gone && setFailed(true))
    return () => {
      gone = true
    }
  }, [open, simId, version])

  // A friend's, while visiting.
  const visitOwner = mode.startsWith('visit:') ? mode.slice(6) : null
  const [visit, setVisit] = useState<QuartierView | null>(null)
  useEffect(() => {
    if (!open || !simId || !visitOwner) return setVisit(null)
    let gone = false
    quartierApi
      .quartierVisit(simId, visitOwner)
      .then((v) => !gone && setVisit({ ...v, owner: v.owner ?? visitOwner }))
      .catch(() => !gone && setMode('babi'))
    return () => {
      gone = true
    }
  }, [open, simId, visitOwner, setMode])

  const shown = visitOwner ? visit : mode === 'quartier' ? own : null
  const active = open && !!sim && !!shown && sim.commune === shown.commune

  // The neighbourhood round it: the other players' quartiers and homes (read with the quartier).
  const [area, setArea] = useState<QuartierArea | null>(null)
  const areaOwner = active ? shown?.owner : undefined
  useEffect(() => {
    if (!areaOwner) return setArea(null)
    let gone = false
    quartierApi
      .quartierArea(areaOwner)
      .then((a) => !gone && setArea(a))
      .catch(() => !gone && setArea(null))
    return () => {
      gone = true
    }
  }, [areaOwner, version])

  // The map's places round it (maquis, boutiques, churches and mosques, schools… thousands in a commune): the view marks a few.
  const [mapNear, setMapNear] = useState<Place[]>([])
  const nearKey = active && shown && !quartierMockOn() ? `${shown.commune}|${shown.center.lat.toFixed(4)},${shown.center.lng.toFixed(4)}` : ''
  useEffect(() => {
    if (!nearKey || !shown) return setMapNear([])
    let gone = false
    api
      .mapPlaces(shown.commune, shown.center.lat, shown.center.lng, QUARTIER_RADIUS / 1000)
      .then((r) => !gone && setMapNear(r.places))
      .catch(() => !gone && setMapNear([]))
    return () => {
      gone = true
    }
  }, [nearKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Coming into a commune: back home (« Rentrer au quartier »), at a friend's (a visit by taxi), or elsewhere
  // (Babi en ligne, whatever the way there).
  const pending = useRef<{ mode: QuartierMode; commune: string } | null>(null)
  const was = useRef(sim?.commune)
  useEffect(() => {
    if (!sim || was.current === sim.commune) return
    was.current = sim.commune
    const p = pending.current
    if (p && p.commune === sim.commune) {
      pending.current = null
      return setMode(p.mode)
    }
    if (mode !== 'babi' && shown && shown.commune !== sim.commune) setMode('babi')
  }, [sim?.commune]) // eslint-disable-line react-hooks/exhaustive-deps
  /** On the way somewhere: what is played once there. */
  const expect = useCallback((m: QuartierMode, commune: string) => {
    pending.current = { mode: m, commune }
  }, [])

  // Sizes: the view's radius and a lot's, smaller on a weak phone.
  const light = useLightPhone() || weakDevice
  const radius = Math.min(shown?.radius ?? QUARTIER_RADIUS, light ? QUARTIER_RADIUS_LIGHT : QUARTIER_RADIUS)
  const lotR = DEV_LOT_R || (light ? LOT_RADIUS_LIGHT : LOT_RADIUS)

  // The home in the street: one's own as the street drew it (else its guess, the same draw as the server's); a
  // friend's, the quartier's centre (the server centres it on the home, backend game.StreetHome).
  const homeLL = useQuartierWorld((q) => q.homeLL)
  const home = useMemo(() => {
    if (!shown || !world || !sim) return null
    if (visitOwner) return shown.center
    return homeLL ?? homeGuess(world, sim, shown.center)
  }, [shown, world, sim?.id, sim?.housing, visitOwner, homeLL]) // eslint-disable-line react-hooks/exhaustive-deps

  // Every lot of the view.
  const commune = world?.cities.find((x) => x.id === sim?.city)?.communes.find((x) => x.id === sim?.commune)
  const minuteBucket = Math.floor((sim?.gameMinutes ?? 0) / 30)
  const lots = useMemo<QLot[]>(() => {
    if (!active || !shown || !world || !commune || !home) return []
    const extra = streetPlaces?.length ? [...mapNear, ...streetPlaces] : mapNear
    return buildLots({ world, commune, view: shown, visiting: !!visitOwner, home, area, extra, todoLot: shown.todo?.lot, gameMinutes: minuteBucket * 30, radius, maxPlaces: light ? MAX_PLACES_LIGHT : MAX_PLACES })
  }, [active, shown, world, commune, home, area, streetPlaces, mapNear, minuteBucket, radius, light, visitOwner])

  // The street told before it loads anything (a layout effect: before the street's own effects).
  // (The lot's middle in the street's metres at once, from the commune's centre the street is laid round: the Sim
  // starts there and only its chunks are asked; one's home is set right by the street once drawn.)
  const cLat = commune?.lat
  const cLng = commune?.lng
  useLayoutEffect(() => {
    const local = active && scene === 'lot' && lot && cLat != null && cLng != null ? toLocal({ lat: cLat, lng: cLng }, lot.lat, lot.lng) : null
    useQuartierWorld.setState({ active, owner: shown?.owner ?? null, visiting: !!visitOwner, radius, center: shown?.center ?? null, view: shown, scene, lot: scene === 'lot' ? lot : null, lotR, local })
  }, [active, shown, visitOwner, radius, scene, lot, lotR, cLat, cLng])
  useEffect(() => () => useQuartierWorld.setState({ active: false, view: null, scene: 'vue', lot: null }), [])

  /** Play one lot (from the view's card, or to go to a place). */
  const enterLot = useCallback((l: QLot) => {
    setLot(l)
    setScene('lot')
    useQuartierWorld.setState({ outside: false })
  }, [])
  /** Back to the view, a lot shown in it (its card open), or none. */
  const showVue = useCallback((focus: string | null = null) => {
    setScene('vue')
    useQuartierWorld.setState({ focus })
  }, [])
  /** The lot a place of the street stands on: its own in the view, else one made round it (anywhere in the commune). */
  const lotOfPlace = useCallback(
    (p: Place): QLot => lots.find((l) => l.placeId === p.id) ?? { id: `place:${p.id}`, kind: 'place', lat: p.lat, lng: p.lng, heading: 0, name: p.name, what: world?.kinds[p.kind]?.label ?? p.kind, icon: world?.kinds[p.kind]?.icon ?? 'map-pin', placeId: p.id },
    [lots, world],
  )

  // Its buildings in the street: the places of their kind (their sign, their menu, their inside), where they were built.
  const places = useMemo<Place[]>(() => {
    if (!active || !shown || !world) return []
    const whose = visitOwner ? shown.ownerName : undefined
    return shown.buildings
      .filter((b) => b.opened && b.kind !== 'maison')
      .flatMap((b: QuartierBuilding) => {
        const kind = PLACE_KIND[b.kind as QuartierKind]?.find((k) => world.kinds[k])
        if (!kind) return []
        const label = b.label || quartierKindName(b.kind as QuartierKind)
        const name = whose ? tr('{0} de {1}', { 0: label, 1: whose }) : tr('{0} · à toi', { 0: label })
        return [{ id: `quartier:${b.id}`, name, kind, lat: b.lat, lng: b.lng, real: false } as Place]
      })
      // (The map's place of the lot played: a place of the street at once, before the street asks the map round the Sim.)
      .concat(scene === 'lot' && lot?.placeId ? mapNear.filter((p) => p.id === lot.placeId) : [])
  }, [active, shown, world, visitOwner, scene, lot, mapNear])
  // The street waits (a few seconds at most) for the quartier before it loads: else it would load the whole
  // city, then the quartier again.
  const [late, setLate] = useState(false)
  useEffect(() => {
    const k = setTimeout(() => setLate(true), 5000)
    return () => clearTimeout(k)
  }, [])
  const waiting = open && !!simId && mode !== 'babi' && !shown && !failed && !late
  return { open, mode, setMode, own, shown, active, pending: waiting, visiting: !!visitOwner, visitOwner, places, refresh, expect, radius, lotR, light, scene, lot, lots, home, center: shown?.center ?? null, area, enterLot, showVue, lotOfPlace }
}

export type QuartierState = ReturnType<typeof useQuartier>
