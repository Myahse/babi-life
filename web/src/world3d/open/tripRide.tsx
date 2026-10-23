import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Sim, World } from '../../lib/types'
import { EPOCH } from '../../game/rules'
import { kerbWait, rideLook, waitsAtKerb } from '../../game/rides'
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
// the driver on the way. Hailed at the roadside (the woro-woro, the taxi, the gbaka: game/rides.ts
// waitsAtKerb), it has stopped already: it stands at the kerb, facing on along the street, and waits
// while the Sim walks up to its door (the Walker sets `reached`), then it's off. In one's own vehicle
// (mode « perso »), the same: it stands at the kerb, the Sim gets on (or in) and drives off, at the
// vehicle's pace. Before, every one drove up to the Sim, then turned round where it had stopped.

/** Where the ride is, for the Walker: the Sim waits at `meet`; aboard, the camera follows the car. */
export const tripRide = { active: false, boarded: false, x: 0, z: 0, heading: 0, meet: [0, 0] as XZ, /** It's standing at the kerb for the Sim (no driver to wave down). */ parked: false, /** The Sim is at its door (the Walker). */ reached: false }
// In development, for tests in the browser.
if (import.meta.env.DEV) Object.assign(globalThis, { __tripRide: tripRide })

/** Which vehicle comes: the woro-woro, the orange taxi, the gbaka, the moto-taxi, the car (the intercity coach), an app's car. */
const kindOf = (mode: string): VehicleKind => (mode === 'woro' ? 'woro' : mode === 'car' ? 'sotra' : mode === 'compteur' || mode === 'taxi' ? 'taxi' : mode === 'gbaka' ? 'gbaka' : mode === 'moto' ? 'moto' : 'car')

const SPEED = 9 // m/s in town

/** A drive of a few streets from a node (not back to `came`): by the streets a car takes, else (none here) by any. */
const drive = (nav: Nav, node: number, steps: number, seed: string, came = -1) => {
  const way = nav.wander(node, steps, rng(seed), DRIVABLE, came)
  return way.length > 2 ? way : nav.wander(node, steps, rng(seed), 0, came)
}
const BOARD = 3 / 60 // the stop at the kerb, getting in (game minutes)

/** The streets' node at a point (the graph is made anew as the map loads: found again by where it is), or -1. */
function nodeAt(nav: Nav, p: XZ | undefined) {
  const n = p && nav.nearest(p, 1)
  if (!n) return -1
  const e = nav.edges[n.edge]
  const node = n.t < 0.5 ? e.a : e.b
  return Math.hypot(nav.nodes[node][0] - p[0], nav.nodes[node][1] - p[1]) < 1 ? node : -1
}

export function TripRide({ sim, nav, world }: { sim: Sim; nav: Nav; world: World }) {
  const a = sim.activity?.kind === 'travel' && sim.activity.trip && sim.activity.trip.mode !== 'avion' ? sim.activity : null
  const trip = a?.trip
  // The ways, worked out once for the trip (the streets' graph is made anew as the map loads round
  // the car: the plan stays), from where the Sim stood: the kerb by it, the streets the driver comes
  // by (a walk of the streets from there, turned round), the streets they drive off by, longer as
  // they go (the map loads ahead of the car).
  // Standing at the kerb: when it was first seen there, when the Sim got to it and in (game minutes).
  const plan = useRef<{ start: number; meet: XZ; approach: XZ[]; away: XZ[]; lenIn: number; lenOut: number; seen: number; go?: number } | null>(null)
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
      tripRide.parked = false
      tripRide.reached = false
      report('trip', null)
    }
  }, [])
  const own = trip?.mode === 'perso'
  const parked = own || waitsAtKerb(trip?.mode ?? '')
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
        // Standing at the kerb: facing the street's far end, to drive straight on from there (the
        // approach only gives it its heading); else it comes in from the near end, and goes back that way.
        const ahead = n.t < 0.5 ? e.b : e.a
        const [ax, az] = nav.nodes[ahead]
        const k = 6 / (Math.hypot(ax - n.at[0], az - n.at[1]) || 1)
        const approach: XZ[] = parked ? [[n.at[0] - (ax - n.at[0]) * k, n.at[1] - (az - n.at[1]) * k], n.at] : [...drive(nav, node, 8, `ride-in${a.start}`)].reverse().concat([n.at])
        const away = [n.at, ...(parked ? drive(nav, ahead, 60, `ride-out${a.start}`, node) : drive(nav, node, 60, `ride-out${a.start}`))]
        const lenIn = routeLength(approach)
        // Where the Sim gets in: on the kerb, by the back door once it's pulled up.
        const r = along(approach, lenIn).r
        const meet: XZ = [n.at[0] - Math.cos(r) * 3.6 - Math.sin(r) * 0.6, n.at[1] + Math.sin(r) * 3.6 - Math.cos(r) * 0.6]
        plan.current = { start: a.start, meet, approach, away, lenIn, lenOut: routeLength(away), seen: (serverNow() - EPOCH) / 60000 }
        tripRide.reached = false
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
    // Coming, it's there at `pick`. Standing at the kerb, it waits for the Sim a while at most, from
    // when it's seen there (a trip starts on the server's whole minute: a town's is over in one).
    const pick = parked ? 0 : Math.min(3, Math.max(0.75, (a.end - a.start) * 0.33))
    if (parked && pl.go === undefined) {
      const until = pl.seen + (own ? 0.2 : kerbWait(a.end - pl.seen))
      if (tripRide.reached || now >= until) pl.go = Math.min(now, until)
    }
    const leave = parked ? (pl.go ?? Infinity) - a.start : pick
    const board = parked ? 4 / 60 : BOARD
    const speed = own && trip.vehicle ? Math.min(SPEED, topSpeed(trip.vehicle.top)) : SPEED
    // Coming: it waits out of sight, then drives the last of the way in, so it arrives at `pick`.
    const coming = parked ? 0 : pl.lenIn / SPEED / 60
    let p: { x: number; z: number; r: number }
    let moving = true
    if (at < pick && !parked) {
      const d = Math.max(0, pl.lenIn - Math.max(0, pick - at) * 60 * SPEED)
      p = along(pl.approach, d)
      moving = at > pick - coming
    } else if (at < leave + board) {
      p = along(pl.approach, pl.lenIn)
      moving = false
    } else {
      // Off: on and on through the streets until the trip ends (the commune changes then). Near the
      // end of the streets planned, a few more from there, by the graph as now loaded.
      const d = (at - leave - board) * 60 * speed
      if (d > pl.lenOut - 300) {
        const last = pl.away[pl.away.length - 1]
        const n = nav.nearest(last, 30, DRIVABLE) ?? nav.nearest(last, 30)
        if (n) {
          const e = nav.edges[n.edge]
          // On from there, not back the way it came (a dead end aside).
          const more = drive(nav, n.t < 0.5 ? e.a : e.b, 30, `ride-on${a.start}${pl.away.length}`, nodeAt(nav, pl.away[pl.away.length - 2]))
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
    else if (parked && at < leave) g.rotation.y = p.r - Math.PI / 2
    g.visible = parked || at > pick - coming - 0.05
    tripRide.active = true
    tripRide.parked = parked
    tripRide.boarded = at >= leave + board / 2
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
