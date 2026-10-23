import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Sim, World } from '../../lib/types'
import { EPOCH } from '../../game/rules'
import { rideLook } from '../../game/rides'
import { serverNow } from '../../lib/worldClock'
import { Bicycle, Vehicle, type CarModel, type VehicleKind } from '../vehicles'
import { Human, NoShadows } from '../../avatar/Human'
import { whereabouts } from '../whereabouts'
import { rng } from '../themes'
import type { Nav } from './nav'
import type { XZ } from './geo'
import { along, DRIVABLE, routeLength, turnTo } from './shared'
import { report } from './trafficFlow'
import { topSpeed } from '../drive'

// The ride in the street. Once a trip to another commune is booked (Play's travel), the driver
// comes to the Sim along the real streets, pulls up at the kerb, the Sim gets in, and off they go,
// the camera following the car through the streets until the trip ends (the commune changes then).
// The timing is the map's (screens/WorldMap.tsx useTrip): the first third of the trip, from 45 s
// to 3 min, is the driver coming. Before, the Sim stood still in the street while the map showed
// the driver on the way. In one's own vehicle (mode « perso »), nobody comes: it stands at the
// kerb, the Sim gets on (or in) and drives off at once, at the vehicle's pace.

/** Where the ride is, for the Walker: the Sim waits at `meet`; aboard, the camera follows the car. */
export const tripRide = { active: false, boarded: false, x: 0, z: 0, heading: 0, meet: [0, 0] as XZ }
// In development, for tests in the browser.
if (import.meta.env.DEV) Object.assign(globalThis, { __tripRide: tripRide })

/** Which vehicle comes: the woro-woro, the orange taxi, the gbaka, the moto-taxi, the car (the intercity coach), an app's car. */
const kindOf = (mode: string): VehicleKind => (mode === 'woro' ? 'woro' : mode === 'car' ? 'sotra' : mode === 'compteur' || mode === 'taxi' ? 'taxi' : mode === 'gbaka' ? 'gbaka' : mode === 'moto' ? 'moto' : 'car')

const SPEED = 9 // m/s in town

/** A drive of a few streets from a node: by the streets a car takes, else (none here) by any. */
const drive = (nav: Nav, node: number, steps: number, seed: string) => {
  const way = nav.wander(node, steps, rng(seed), DRIVABLE)
  return way.length > 2 ? way : nav.wander(node, steps, rng(seed), 0)
}
const BOARD = 3 / 60 // the stop at the kerb, getting in (game minutes)

export function TripRide({ sim, nav, world }: { sim: Sim; nav: Nav; world: World }) {
  const a = sim.activity?.kind === 'travel' && sim.activity.trip && sim.activity.trip.mode !== 'avion' ? sim.activity : null
  const trip = a?.trip
  // The ways, worked out once for the trip (the streets' graph is made anew as the map loads round
  // the car: the plan stays), from where the Sim stood: the kerb by it, the streets the driver comes
  // by (a walk of the streets from there, turned round), the streets they drive off by, longer as
  // they go (the map loads ahead of the car).
  const plan = useRef<{ start: number; meet: XZ; approach: XZ[]; away: XZ[]; lenIn: number; lenOut: number } | null>(null)
  const born = useRef(performance.now())
  const look = useMemo(() => {
    if (!trip) return null
    const from = world.cities.find((c) => c.id === trip.fromCity)?.communes.find((c) => c.id === trip.fromCommune)
    return rideLook(world, trip.mode, from, trip.class)
  }, [trip, world])
  const ref = useRef<THREE.Group>(null)
  useEffect(() => {
    return () => {
      tripRide.active = false
      tripRide.boarded = false
      report('trip', null)
    }
  }, [])
  useFrame((_, dt) => {
    const g = ref.current
    if (plan.current && plan.current.start !== a?.start) plan.current = null
    // The Walker places the Sim in its first moments: the kerb is the one by where it ends up.
    if (a && !plan.current && performance.now() - born.current > 500) {
      // The kerb of a street a car takes (not the footpath the Sim may be standing on).
      const n = nav.nearest([whereabouts.sim[0], whereabouts.sim[1]], 200, DRIVABLE) ?? nav.nearest([whereabouts.sim[0], whereabouts.sim[1]], 200)
      if (n) {
        const e = nav.edges[n.edge]
        const node = n.t < 0.5 ? e.a : e.b
        const approach = [...drive(nav, node, 8, `ride-in${a.start}`)].reverse().concat([n.at])
        const away = [n.at, ...drive(nav, node, 60, `ride-out${a.start}`)]
        const lenIn = routeLength(approach)
        // Where the Sim waits: on the kerb, by the car's back door once it's pulled up.
        const r = along(approach, lenIn).r
        const meet: XZ = [n.at[0] - Math.cos(r) * 3.6, n.at[1] + Math.sin(r) * 3.6]
        plan.current = { start: a.start, meet, approach, away, lenIn, lenOut: routeLength(away) }
      }
    }
    const pl = plan.current
    if (!g || !a || !pl) {
      tripRide.active = false
      tripRide.boarded = false
      return
    }
    const now = (serverNow() - EPOCH) / 60000
    const at = now - a.start
    const own = trip?.mode === 'perso'
    const pick = own ? 0 : Math.min(3, Math.max(0.75, (a.end - a.start) * 0.33))
    // Its own: a few more seconds to walk round to it and get on.
    const board = own ? 6 / 60 : BOARD
    const speed = own && trip.vehicle ? Math.min(SPEED, topSpeed(trip.vehicle.top)) : SPEED
    // Coming: it waits out of sight, then drives the last of the way in, so it arrives at `pick`.
    const coming = own ? 0 : pl.lenIn / SPEED / 60
    let p: { x: number; z: number; r: number }
    let moving = true
    if (at < pick) {
      const d = Math.max(0, pl.lenIn - Math.max(0, pick - at) * 60 * SPEED)
      p = along(pl.approach, d)
      moving = at > pick - coming
    } else if (at < pick + board) {
      p = along(pl.approach, pl.lenIn)
      moving = false
    } else {
      // Off: on and on through the streets until the trip ends (the commune changes then). Near the
      // end of the streets planned, a few more from there, by the graph as now loaded.
      const d = (at - pick - board) * 60 * speed
      if (d > pl.lenOut - 300) {
        const last = pl.away[pl.away.length - 1]
        const n = nav.nearest(last, 30, DRIVABLE) ?? nav.nearest(last, 30)
        if (n) {
          const e = nav.edges[n.edge]
          const more = drive(nav, n.t < 0.5 ? e.a : e.b, 30, `ride-on${a.start}${pl.away.length}`)
          if (more.length > 1) {
            pl.away.push(...more)
            pl.lenOut = routeLength(pl.away)
          }
        }
      }
      p = along(pl.away, Math.min(pl.lenOut, d))
      moving = d < pl.lenOut
    }
    // On the right of the way it goes; the nose (+x) along it.
    const off = 2
    g.position.set(p.x - Math.cos(p.r) * off, nav.heightAt(p.x, p.z), p.z + Math.sin(p.r) * off)
    if (moving) g.rotation.y = turnTo(g.rotation.y, p.r - Math.PI / 2, 1 - Math.exp(-6 * Math.min(dt, 0.1)))
    g.visible = own || at > pick - coming - 0.05
    tripRide.active = true
    tripRide.boarded = at >= pick + board / 2
    tripRide.x = g.position.x
    tripRide.z = g.position.z
    tripRide.heading = g.rotation.y + Math.PI / 2
    tripRide.meet = pl.meet
    // The street's traffic waits behind it, as behind any car (trafficFlow.tsx).
    report('trip', g.visible ? { x: g.position.x, z: g.position.z, h: tripRide.heading, half: own ? (trip.vehicle?.kind === 'voiture' ? 2.3 : 1) : kindOf(trip?.mode ?? '') === 'moto' ? 1 : 2.3 } : null)
  })
  if (!a || !trip) return null
  const kind = kindOf(trip.mode)
  const v = trip.mode === 'perso' ? trip.vehicle : undefined
  if (v)
    return (
      <group ref={ref} visible={false}>
        {v.kind === 'voiture' ? (
          <Vehicle p={[0, 0, 0]} kind="car" model={v.body as CarModel} color={v.color} seed={v.body === 'limo' ? (v.color === '#f4f4f2' ? 0 : 1) : v.id} />
        ) : (
          <>
            {v.kind === 'moto' ? <Vehicle p={[0, 0, 0]} kind="moto" color={v.color} crew={false} /> : <Bicycle color={v.color} />}
            {/* On its own moto or bike, the Sim rides it, seen */}
            <Pillion sim={sim} at={v.kind === 'moto' ? [-0.25, 0.42, 0] : [-0.22, 0.5, 0]} />
          </>
        )}
      </group>
    )
  return (
    <group ref={ref} visible={false}>
      <Vehicle p={[0, 0, 0]} kind={kind} color={kind === 'sotra' ? undefined : look?.color} trim={look?.trim} seed={a.start % 97} crew />
      {/* On a moto-taxi the Sim is seen, behind the driver (in a car, it's inside) */}
      {kind === 'moto' && <Pillion sim={sim} />}
    </group>
  )
}

/** The Sim on the back of the moto-taxi (or riding its own), once it has got on (the moto's front is its +x). */
function Pillion({ sim, at = [-0.62, 0.42, 0] }: { sim: Sim; at?: [number, number, number] }) {
  const g = useRef<THREE.Group>(null)
  useFrame(() => {
    if (g.current) g.current.visible = tripRide.boarded
  })
  return (
    <group ref={g} position={at} rotation={[0, Math.PI / 2, 0]} visible={false}>
      <NoShadows>
        <Human look={sim.look} gender={sim.gender} pose="sit" seed={7} />
      </NoShadows>
    </group>
  )
}
