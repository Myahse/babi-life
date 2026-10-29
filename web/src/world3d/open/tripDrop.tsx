import { useMemo, useRef, useSyncExternalStore } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { World } from '../../lib/types'
import { rideLook } from '../../game/rides'
import { Vehicle, type VehicleKind } from '../vehicles'
import { whereabouts } from '../whereabouts'
import { rng } from '../themes'
import type { Nav } from './nav'
import type { XZ } from './geo'
import { along, DRIVABLE, routeLength } from './shared'

// A short ride (the update « trajet-court »: the ride itself is a short loading screen,
// components/TripLoading.tsx), its two ends seen in the street. Taken in the commune
// (`pickup`): the taxi or the gbaka pulls up at the kerb by the Sim, the Sim gets in,
// then the loading screen. There (`drop`): it pulls up at the kerb, the Sim gets out,
// and it's off down the street at full speed, and gone.

export type Drop = { mode: string; class?: string; fromCity: string; fromCommune: string; /** performance.now() when it began. */ at: number; /** Pulling up for the Sim to get in (else: dropping it). */ pickup?: boolean; /** Picked up: the Sim is in. */ onIn?: () => void }
let drop: Drop | null = null
/** The Sim is in the vehicle: not seen (the Walker reads it). */
let inside = false
const subs = new Set<() => void>()
/** The ride's vehicle at one end of it (none: it's gone). */
export function setDrop(d: Drop | null) {
  drop = d
  inside = !!d && !d.pickup
  subs.forEach((f) => f())
}
/** Read in the frame loop: the Sim is in the vehicle pulling up or about to get out. */
export const inDrop = () => inside
const useDrop = () =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => void subs.delete(f)),
    () => drop,
  )

const kindOf = (mode: string): VehicleKind => (mode === 'woro' ? 'woro' : mode === 'car' ? 'sotra' : mode === 'compteur' || mode === 'taxi' ? 'taxi' : mode === 'gbaka' ? 'gbaka' : mode === 'moto' ? 'moto' : 'car')
/** Pulling up (s, over its last metres, slowing), at the kerb (s), then off: its pick-up (m/s²) and top speed (m/s), and how long it's seen going. */
const IN = 1.8
const LAST = 28
const STAND = 1.4
const PICKUP = 11
const TOP = 26
const GONE = 5
/** In the pickup, the Sim gets in this long after it stopped; the loading screen a moment after. */
const GET_IN = 0.5
const LOADING = 0.9

export function TripDrop({ nav, world }: { nav: Nav; world: World }) {
  const d = useDrop()
  const ref = useRef<THREE.Group>(null)
  const plan = useRef<{ at: number; t0: number; coming: XZ[]; lenIn: number; way: XZ[]; len: number; told: boolean } | null>(null)
  const look = useMemo(() => {
    if (!d) return null
    const from = world.cities.find((c) => c.id === d.fromCity)?.communes.find((c) => c.id === d.fromCommune)
    return rideLook(world, d.mode, from, d.class)
  }, [d, world])
  useFrame(() => {
    const g = ref.current
    if (!g || !d) return
    // The kerb by where the Sim stands (once the Walker has put it there): the street it comes in by, and the one off from it.
    if (!plan.current || plan.current.at !== d.at) {
      plan.current = null
      if (performance.now() - d.at < 300) return
      const n = nav.nearest([whereabouts.sim[0], whereabouts.sim[1]], 200, DRIVABLE) ?? nav.nearest([whereabouts.sim[0], whereabouts.sim[1]], 200)
      if (!n) {
        // No street here (the map not loading): no vehicle, the Sim simply there.
        if (performance.now() - d.at > 6000) {
          d.onIn?.()
          setDrop(null)
        }
        return
      }
      const e = nav.edges[n.edge]
      const [ahead, behind] = n.t < 0.5 ? [e.b, e.a] : [e.a, e.b]
      const on = nav.wander(ahead, 12, rng(`drop${d.at}`), DRIVABLE, behind)
      const way: XZ[] = [n.at, ...(on.length > 1 ? on : [nav.nodes[ahead] as XZ])]
      const back = nav.wander(behind, 6, rng(`in${d.at}`), DRIVABLE, ahead)
      const coming: XZ[] = [...(back.length > 1 ? back : [nav.nodes[behind] as XZ])].reverse().concat([n.at])
      plan.current = { at: d.at, t0: performance.now(), coming, lenIn: routeLength(coming), way, len: routeLength(way), told: false }
    }
    const pl = plan.current
    const t = (performance.now() - pl.t0) / 1000
    let p: { x: number; z: number; r: number }
    if (t < IN) {
      // Pulling up: the last metres of the street, slowing to the kerb.
      const u = t / IN
      p = along(pl.coming, Math.max(0, pl.lenIn - Math.min(LAST, pl.lenIn) * (1 - u) * (1 - u)))
    } else {
      // At the kerb, then (dropping the Sim) away: faster and faster, up to its top speed.
      const go = d.pickup ? 0 : Math.max(0, t - IN - STAND)
      const ramp = TOP / PICKUP
      const dist = go < ramp ? 0.5 * PICKUP * go * go : 0.5 * PICKUP * ramp * ramp + (go - ramp) * TOP
      p = along(pl.way, Math.min(pl.len, dist))
      if (!d.pickup && (go > GONE || dist >= pl.len)) {
        g.visible = false
        plan.current = null
        setDrop(null)
        return
      }
    }
    // Picked up: in, then the loading screen. Dropped: out once it has stopped.
    inside = d.pickup ? t > IN + GET_IN : t < IN + 0.3
    if (d.pickup && !pl.told && t > IN + LOADING) {
      pl.told = true
      d.onIn?.()
    }
    const off = 2
    g.position.set(p.x - Math.cos(p.r) * off, nav.heightAt(p.x, p.z), p.z + Math.sin(p.r) * off)
    g.rotation.y = p.r - Math.PI / 2
    g.visible = true
  })
  if (!d) return null
  const kind = kindOf(d.mode)
  return (
    <group ref={ref} visible={false}>
      <Vehicle p={[0, 0, 0]} kind={kind} color={kind === 'sotra' ? undefined : look?.color} trim={look?.trim} seed={Math.round(d.at) % 97} crew />
    </group>
  )
}
