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

// Dropped off (the update « trajet-court »: the ride is a short loading screen,
// components/TripLoading.tsx): there, the taxi or the gbaka stands at the kerb by
// the Sim a moment, the Sim just got out, then it's off down the street at full
// speed, and gone.

export type Drop = { mode: string; class?: string; fromCity: string; fromCommune: string; /** performance.now() when it arrived. */ at: number }
let drop: Drop | null = null
const subs = new Set<() => void>()
/** The ride just over: its vehicle drops the Sim in the street (none: it's gone). */
export function setDrop(d: Drop | null) {
  drop = d
  subs.forEach((f) => f())
}
const useDrop = () =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => void subs.delete(f)),
    () => drop,
  )

const kindOf = (mode: string): VehicleKind => (mode === 'woro' ? 'woro' : mode === 'car' ? 'sotra' : mode === 'compteur' || mode === 'taxi' ? 'taxi' : mode === 'gbaka' ? 'gbaka' : mode === 'moto' ? 'moto' : 'car')
/** At the kerb (s), then off: its pick-up (m/s²) and top speed (m/s), and how long it's seen going. */
const STAND = 1.4
const PICKUP = 11
const TOP = 26
const GONE = 5

export function TripDrop({ nav, world }: { nav: Nav; world: World }) {
  const d = useDrop()
  const ref = useRef<THREE.Group>(null)
  const plan = useRef<{ at: number; way: XZ[]; len: number } | null>(null)
  const look = useMemo(() => {
    if (!d) return null
    const from = world.cities.find((c) => c.id === d.fromCity)?.communes.find((c) => c.id === d.fromCommune)
    return rideLook(world, d.mode, from, d.class)
  }, [d, world])
  useFrame(() => {
    const g = ref.current
    if (!g || !d) return
    // The kerb by where the Sim stands (once the Walker has put it there), and the street off from it.
    if (!plan.current || plan.current.at !== d.at) {
      if (performance.now() - d.at < 300) return
      const n = nav.nearest([whereabouts.sim[0], whereabouts.sim[1]], 200, DRIVABLE) ?? nav.nearest([whereabouts.sim[0], whereabouts.sim[1]], 200)
      if (!n) return
      const e = nav.edges[n.edge]
      const ahead = n.t < 0.5 ? e.b : e.a
      const on = nav.wander(ahead, 12, rng(`drop${d.at}`), DRIVABLE, n.t < 0.5 ? e.a : e.b)
      const way: XZ[] = [n.at, ...(on.length > 1 ? on : [nav.nodes[ahead] as XZ])]
      plan.current = { at: d.at, way, len: routeLength(way) }
    }
    const pl = plan.current
    const t = (performance.now() - d.at) / 1000 - 0.3
    // Standing, then away: faster and faster, up to its top speed.
    const go = Math.max(0, t - STAND)
    const ramp = TOP / PICKUP
    const dist = go < ramp ? 0.5 * PICKUP * go * go : 0.5 * PICKUP * ramp * ramp + (go - ramp) * TOP
    const p = along(pl.way, Math.min(pl.len, dist))
    const off = 2
    g.position.set(p.x - Math.cos(p.r) * off, nav.heightAt(p.x, p.z), p.z + Math.sin(p.r) * off)
    g.rotation.y = p.r - Math.PI / 2
    g.visible = true
    if (go > GONE || dist >= pl.len) {
      g.visible = false
      plan.current = null
      setDrop(null)
    }
  })
  if (!d) return null
  const kind = kindOf(d.mode)
  return (
    <group ref={ref} visible={false}>
      <Vehicle p={[0, 0, 0]} kind={kind} color={kind === 'sotra' ? undefined : look?.color} trim={look?.trim} seed={Math.round(d.at) % 97} crew />
    </group>
  )
}
