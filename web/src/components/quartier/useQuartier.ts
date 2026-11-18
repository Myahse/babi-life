import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { SIM_CHANGED } from '../../lib/live'
import type { Commune, Place, QuartierArea, Sim, World } from '../../lib/types'
import { weakDevice } from '../../lib/device'
import { useLightPhone } from '../../lib/lightPhone'
import { t as tr } from '../../lib/i18n'
import { useQuartierWorld, type QLot } from '../../world3d/quartier/store'
import { buildLots } from '../../world3d/quartier/lots'
import type { QuartierBuilding, QuartierKind, QuartierView } from '../../world3d/quartier/types'
import { UNIV_ORIGIN, type Built, type UniversInfo, type UniversSpec } from '../../world3d/quartier/univers/gen'
import { terrainKey } from '../../world3d/quartier/univers/terrain'
import { universLatLng, universPlaces } from '../../world3d/quartier/univers/places'
import { presetForCommune } from '../../world3d/quartier/univers/presets'
import { universInfoOf } from '../../world3d/quartier/vueData'
import { mockHint, mockPick, quartierApi, quartierMockOn } from './mock'
import { api } from '../../lib/api'

// « Mon quartier » on the game's screen (update « mon-quartier »): which quartier is played (one's own, a
// friend's on a visit) or Babi en ligne (the whole city, as before), kept per Sim on the phone; the quartier
// and the neighbourhood round it read from the server; its own world (world3d/quartier/univers/: laid out from
// its seed and its commune's style, off the main thread) with its lots (world3d/quartier/lots.ts) for the
// quartier's view, and walked in the street; its places and buildings as the street's places; the 3D world
// told (world3d/quartier/store).

/** A world's seed from its owner when the server didn't send one (the development mock): FNV-1a, as the server's (game.UniversSeed). */
function seedOf(id: string) {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return (h >>> 0) & 0x7fffffff
}

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

/** The lot played in the street, for this page's session (sessionStorage: a new visit to the game starts at the view). */
const lotKey = (sim: string) => `babi.quartier.lot.${sim}`
function readLot(sim: string, mode: QuartierMode): QLot | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(lotKey(sim)) ?? 'null') as { mode: QuartierMode; lot: QLot } | null
    return s && s.mode === mode && s.lot?.id ? s.lot : null
  } catch {
    return null
  }
}
function keepLot(sim: string, mode: QuartierMode, lot: QLot | null) {
  try {
    if (lot) sessionStorage.setItem(lotKey(sim), JSON.stringify({ mode, lot }))
    else sessionStorage.removeItem(lotKey(sim))
  } catch {
    // (Not kept: a new screen starts at the view.)
  }
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

export function useQuartier({ open, sim, world }: { open: boolean; sim: Sim | undefined; world: World | undefined }) {
  const simId = sim?.id
  const [mode, setModeState] = useState<QuartierMode>(() => (simId ? readMode(simId) : 'quartier'))
  // The view of the neighbourhood, or one lot played (back to the view at each change of quartier). The lot played is
  // kept for the page's session: the game's screen made anew (the app brought back, a reload of its code) goes on in
  // the street, not back to the view.
  const [lot, setLot] = useState<QLot | null>(() => (simId ? readLot(simId, readMode(simId)) : null))
  const [scene, setScene] = useState<'vue' | 'lot'>(() => (lot ? 'lot' : 'vue'))
  useEffect(() => {
    if (!simId) return
    const m = readMode(simId)
    setModeState(m)
    const l = readLot(simId, m)
    setLot(l)
    setScene(l ? 'lot' : 'vue')
  }, [simId])
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
      if (simId) keepLot(simId, m, null)
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

  // The map's places round the quartier's anchor in its commune (maquis, boutiques, churches and mosques, schools…): the
  // world takes the ones it has room for (univers/places.ts), once they're here (the street waits for them a moment).
  const [mapNear, setMapNear] = useState<Place[]>([])
  const [nearFor, setNearFor] = useState('')
  const nearKey = active && shown && !quartierMockOn() ? `${shown.commune}|${shown.center.lat.toFixed(4)},${shown.center.lng.toFixed(4)}` : ''
  useEffect(() => {
    if (!nearKey || !shown) return setMapNear([])
    let gone = false
    api
      .mapPlaces(shown.commune, shown.center.lat, shown.center.lng, 1.2)
      .then((r) => !gone && (setMapNear(r.places), setNearFor(nearKey)))
      .catch(() => !gone && (setMapNear([]), setNearFor(nearKey)))
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

  const light = useLightPhone() || weakDevice

  // Its own world: from the server's seed and style (one's own: the layout picked; a visit: the owner's).
  const spec = useMemo<UniversSpec | null>(() => {
    if (!shown) return null
    const u = shown.univers
    return u ? { seed: u.seed, preset: u.preset, variant: u.variant, terrain: u.terrain || undefined } : { seed: seedOf(shown.owner), preset: presetForCommune(shown.commune), variant: 0 }
  }, [shown?.owner, shown?.univers?.seed, shown?.univers?.preset, shown?.univers?.variant, shown?.univers?.terrain, shown?.commune]) // eslint-disable-line react-hooks/exhaustive-deps
  /** The layout tried in the view before it's picked (one's own, the first visit). */
  const [trying, setTrying] = useState<number | null>(null)
  const shownSpec = useMemo(() => (spec && trying !== null && !visitOwner ? { ...spec, variant: trying } : spec), [spec, trying, visitOwner])
  const specKey = shownSpec ? `${shownSpec.preset}:${shownSpec.seed}:${shownSpec.variant}${shownSpec.terrain ? `:t${terrainKey(shownSpec.terrain)}` : ''}` : ''
  const [univ, setUniv] = useState<UniversInfo | null>(null)
  useEffect(() => {
    if (!shownSpec) return setUniv(null)
    let gone = false
    universInfoOf(shownSpec).then(
      (u) => !gone && setUniv(u),
      () => !gone && setUniv(null),
    )
    return () => {
      gone = true
    }
  }, [specKey]) // eslint-disable-line react-hooks/exhaustive-deps
  // What the world itself draws on the lots (the houses to rent, the flats; a friend's home, visited).
  const built = useMemo<Built[]>(() => {
    if (!shown) return []
    const out: Built[] = shown.buildings.filter((b) => b.kind === 'maison' || b.kind === 'immeuble').map((b) => ({ lot: b.lot ?? b.slot, kind: b.kind }))
    if (visitOwner) out.push({ lot: -1, kind: 'maison' })
    return out.sort((a, b) => a.lot - b.lot)
  }, [shown, visitOwner])
  const builtKey = built.map((b) => `${b.lot}${b.kind}`).join('.')
  const builtStable = useMemo(() => built, [builtKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // The world's places: the commune's own, then the map's round the quartier, each at the world's spot for its kind.
  const commune = world?.cities.find((x) => x.id === sim?.city)?.communes.find((x) => x.id === sim?.commune)
  const uPlaces = useMemo(() => (univ && world && commune ? universPlaces(univ, world, commune.places, mapNear) : []), [univ, world, commune, mapNear])
  // Every lot of the view.
  const minuteBucket = Math.floor((sim?.gameMinutes ?? 0) / 30)
  const lots = useMemo<QLot[]>(() => {
    if (!active || !shown || !world || !univ) return []
    return buildLots({ world, view: shown, visiting: !!visitOwner, univ, places: uPlaces, area, gameMinutes: minuteBucket * 30 })
  }, [active, shown, world, univ, uPlaces, area, minuteBucket, visitOwner])

  // « À faire maintenant »'s lot in the world (one's own).
  const todoLot = shown?.todo?.lot
  const target = useMemo(() => {
    if (visitOwner || todoLot === undefined || !univ) return null
    return todoLot < 0 ? univ.home.at : (univ.lots[todoLot]?.at ?? null)
  }, [visitOwner, todoLot, univ])

  // The street told before it loads anything (a layout effect: before the street's own effects).
  const playable = active && !!univ
  useLayoutEffect(() => {
    useQuartierWorld.setState({ active: playable, owner: shown?.owner ?? null, visiting: !!visitOwner, view: shown, spec: shownSpec, univ, built: builtStable, scene, lot: scene === 'lot' ? lot : null, target })
  }, [playable, shown, visitOwner, shownSpec, univ, builtStable, scene, lot, target])
  useEffect(() => () => useQuartierWorld.setState({ active: false, view: null, scene: 'vue', lot: null, univ: null, spec: null }), [])

  /** Go into the world at a lot (from the view's card, or to go to a place). */
  const enterLot = useCallback(
    (l: QLot) => {
      setLot(l)
      setScene('lot')
      useQuartierWorld.setState({ outside: false })
      if (simId) keepLot(simId, mode, l)
    },
    [simId, mode],
  )
  /** Back to the view, a lot shown in it (its card open), or none. */
  const showVue = useCallback(
    (focus: string | null = null) => {
      setScene('vue')
      useQuartierWorld.setState({ focus })
      if (simId) keepLot(simId, mode, null)
    },
    [simId, mode],
  )

  // The street's places in the world: its own (the commune's, at the world's spots) and the quartier's buildings
  // on their lots (their sign, their menu, their inside).
  const places = useMemo<Place[]>(() => {
    if (!playable || !shown || !world || !univ) return []
    const whose = visitOwner ? shown.ownerName : undefined
    const mine = shown.buildings
      .filter((b) => b.opened && b.kind !== 'maison' && b.kind !== 'immeuble')
      .flatMap((b: QuartierBuilding) => {
        const kind = PLACE_KIND[b.kind as QuartierKind]?.find((k) => world.kinds[k])
        const f = univ.lots[b.lot ?? b.slot]
        if (!kind || !f) return []
        const label = b.label || quartierKindName(b.kind as QuartierKind)
        const name = whose ? tr('{0} de {1}', { 0: label, 1: whose }) : tr('{0} · à toi', { 0: label })
        return [{ id: `quartier:${b.id}`, name, kind, ...universLatLng(f.at), real: false } as Place]
      })
    return [...uPlaces.map(({ at: _at, tag: _tag, ...p }) => p as Place), ...mine]
  }, [playable, shown, world, univ, uPlaces, visitOwner])
  /** The commune as the street draws it in the world: its places there, round the world's origin. */
  const uc = useRef<{ c: Commune; places: Place[]; out: Commune } | null>(null)
  const universCommune = useCallback(
    (c: Commune): Commune => {
      if (uc.current?.c === c && uc.current.places === places) return uc.current.out
      const out = { ...c, lat: UNIV_ORIGIN.lat, lng: UNIV_ORIGIN.lng, places, mapCount: 0 }
      uc.current = { c, places, out }
      return out
    },
    [places],
  )
  /** The layout picked (one's own, at the first visit): the server keeps it, the world stays as tried. */
  const pickLayout = useCallback(
    async (variant: number) => {
      if (!simId) return
      if (quartierMockOn()) mockPick(simId, variant)
      else await api.quartierUnivers(simId, variant)
      // (The layout tried stays shown until the quartier read again says it's the one chosen: never the old one in
      // between, which would make the world, and the street if one went into it meanwhile, be built twice.)
      setTrying(variant)
      refresh()
    },
    [simId, refresh],
  )
  const chosen = own?.univers?.chosen ? own.univers.variant : null
  useEffect(() => {
    if (chosen !== null) setTrying(null)
  }, [chosen])
  // The street waits (a few seconds at most) for the quartier before it loads: else it would load the whole
  // city, then the quartier again.
  const [late, setLate] = useState(false)
  useEffect(() => {
    const k = setTimeout(() => setLate(true), 5000)
    return () => clearTimeout(k)
  }, [])
  const waiting = open && !!simId && mode !== 'babi' && !shown && !failed && !late
  return { open, mode, setMode, own, shown, active: playable, pending: waiting || (active && (!univ || (!!nearKey && nearFor !== nearKey && !late))), visiting: !!visitOwner, visitOwner, places, refresh, expect, light, scene, lot, lots, area, enterLot, showVue, univ, spec: shownSpec, built: builtStable, trying, setTrying, pickLayout, universCommune }
}

export type QuartierState = ReturnType<typeof useQuartier>
