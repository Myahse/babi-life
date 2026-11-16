import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { SIM_CHANGED } from '../../lib/live'
import type { Place, Sim, World } from '../../lib/types'
import { weakDevice } from '../../lib/device'
import { useLightPhone } from '../../lib/lightPhone'
import { t as tr } from '../../lib/i18n'
import { QUARTIER_RADIUS, QUARTIER_RADIUS_LIGHT, useQuartierWorld } from '../../world3d/quartier/store'
import type { QuartierBuilding, QuartierKind, QuartierView } from '../../world3d/quartier/types'
import { mockHint, quartierApi, quartierMockOn } from './mock'

// « Mon quartier » on the game's screen (update « mon-quartier »): which quartier is played (one's own, a
// friend's on a visit) or Babi en ligne (the whole city, as before), kept per Sim on the phone; the
// quartier read from the server; its buildings as the street's places; the 3D world told (world3d/quartier/store).

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


export function useQuartier({ open, sim, world }: { open: boolean; sim: Sim | undefined; world: World | undefined }) {
  const simId = sim?.id
  const [mode, setModeState] = useState<QuartierMode>(() => (simId ? readMode(simId) : 'quartier'))
  useEffect(() => {
    if (simId) setModeState(readMode(simId))
  }, [simId])
  const setMode = useCallback(
    (m: QuartierMode) => {
      setModeState(m)
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

  // The street told before it loads anything (a layout effect: before the street's own effects).
  const light = useLightPhone() || weakDevice
  const radius = Math.min(shown?.radius ?? QUARTIER_RADIUS, light ? QUARTIER_RADIUS_LIGHT : QUARTIER_RADIUS)
  useLayoutEffect(() => {
    useQuartierWorld.setState({ active, owner: shown?.owner ?? null, visiting: !!visitOwner, radius, center: shown?.center ?? null, view: shown })
  }, [active, shown, visitOwner, radius])
  useEffect(() => () => useQuartierWorld.setState({ active: false, view: null }), [])

  // Its buildings in the street: the places of their kind (their sign, their menu, their inside), set round the
  // quartier's centre where the street has it (one's own: round the home).
  const localLL = useQuartierWorld((q) => q.localLL)
  const places = useMemo<Place[]>(() => {
    if (!active || !shown || !localLL || !world) return []
    const dLat = localLL.lat - shown.center.lat
    const dLng = localLL.lng - shown.center.lng
    const whose = visitOwner ? shown.ownerName : undefined
    return shown.buildings
      .filter((b) => b.opened && b.kind !== 'maison')
      .flatMap((b: QuartierBuilding) => {
        const kind = PLACE_KIND[b.kind as QuartierKind]?.find((k) => world.kinds[k])
        if (!kind) return []
        const label = b.label || quartierKindName(b.kind as QuartierKind)
        const name = whose ? tr('{0} de {1}', { 0: label, 1: whose }) : tr('{0} · à toi', { 0: label })
        return [{ id: `quartier:${b.id}`, name, kind, lat: b.lat + dLat, lng: b.lng + dLng, real: false }]
      })
  }, [active, shown, localLL, world, visitOwner])
  // The street waits (a few seconds at most) for the quartier before it loads: else it would load the whole
  // city, then the quartier again.
  const [late, setLate] = useState(false)
  useEffect(() => {
    const k = setTimeout(() => setLate(true), 5000)
    return () => clearTimeout(k)
  }, [])
  const waiting = open && !!simId && mode !== 'babi' && !shown && !failed && !late
  return { open, mode, setMode, own, shown, active, pending: waiting, visiting: !!visitOwner, visitOwner, places, refresh, expect, radius }
}

export type QuartierState = ReturnType<typeof useQuartier>
