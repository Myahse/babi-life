import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Sim, World } from '../lib/types'
import { parkedNow, topSpeed, type Driven, type Parked } from '../world3d/drive'
import { whereabouts } from '../world3d/whereabouts'
import { t as tr } from '../lib/i18n'

// One's own vehicle for a trip (the update « ma-voiture »): which one to take (the one left at the kerb
// here first, else one from the garage), how far it is to walk to, whether it's out of reach (left in
// another commune), and whether the Sim may drive at all (it drank at the maquis: no wheel).

/** The Sim's vehicles (the Bolide app's garage), as driven (drive.ts). Empty without the app. */
export function useMyVehicles(world: World, sim: Sim, on: boolean, /** Asked again when this changes (an offer of a ride). */ again?: unknown): Driven[] {
  const [list, setList] = useState<Driven[]>([])
  const has = on && !!sim.apps?.includes('bolide')
  useEffect(() => {
    if (!has) return setList([])
    let live = true
    api.garage(sim.id).then(
      (g) =>
        live &&
        setList(
          g.vehicles.flatMap((v) => {
            const m = world.vehicles?.find((x) => x.id === v.model)
            return m ? [{ id: v.id, kind: m.kind, body: m.body, color: v.color, name: m.name, top: topSpeed(m.topSpeed) }] : []
          }),
        ),
      () => undefined,
    )
    return () => void (live = false)
  }, [has, sim.id, world, again])
  return list
}

/** The vehicle to take: `parked` where it was left in this commune (walked to first when `metres` is more than a few
 * steps), or from the garage (it comes along); `elsewhere`: the commune where the only one was left. */
export type CarHere = { v: Driven; parked: Parked | null; metres: number }
export type CarPick = CarHere | { v: Driven; elsewhere: string }

export function pickCar(list: Driven[], simId: string, commune: string): CarPick | null {
  if (!list.length) return null
  const p = parkedNow()
  const mine = p && p.sim === simId && list.some((v) => v.id === p.v.id) ? p : null
  if (mine && mine.commune === commune) return { v: mine.v, parked: mine, metres: Math.hypot(mine.x - whereabouts.sim[0], mine.z - whereabouts.sim[1]) }
  // (The one left in another commune stays there: another one from the garage, or none.)
  const other = list.find((v) => v.id !== mine?.v.id)
  if (other) return { v: other, parked: null, metres: 0 }
  return { v: mine!.v, elsewhere: mine!.commune }
}

/** Walking to one's own vehicle to set off in it: the long walk's ride offer (moto.ts) isn't asked meanwhile. */
export const toCar = { active: false }

/** What one's own vehicle is called on a button: « Ma voiture », « Ma moto », « Mon vélo ». */
export const myKindLabel = (kind: Driven['kind']) => (kind === 'voiture' ? tr('Ma voiture') : kind === 'moto' ? tr('Ma moto') : tr('Mon vélo'))

// Drinking (the beer at the maquis, the cocktail at the bar, the bottle at a soirée): no wheel for a while after.
const DRANK = 'babi.drank'
/** How long after a drink the Sim doesn't drive (ms of real time; game time is Abidjan's). */
const SOBER_AFTER = 90 * 60_000
/** The activities that are drinking alcohol: by their icon (backend game/catalog.go). */
const DRINK_ICONS = new Set(['beer', 'martini', 'wine'])
export function noteDrink(icon: string | undefined) {
  if (!icon || !DRINK_ICONS.has(icon)) return
  try {
    localStorage.setItem(DRANK, String(Date.now()))
  } catch {
    // Private mode: forgotten, it drives.
  }
}
export function drankLately() {
  try {
    return Date.now() - Number(localStorage.getItem(DRANK) ?? 0) < SOBER_AFTER
  } catch {
    return false
  }
}
