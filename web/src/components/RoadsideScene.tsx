import { useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Look, Sim } from '../lib/types'
import { sceneDpr } from '../lib/device'
import { Vehicle, type VehicleKind } from '../world3d/vehicles'
import { Box, Lamp, Palm } from '../world3d/props'
import { Character } from '../world3d/Character'
import { randomLook } from '../avatar/options'
import { NoShadows } from '../avatar/Human'

// The roadside in RideFlow (hailing a woro-woro, a taxi compteur, a gbaka):
// the game's street, the Sim at the kerb with its arm up, and the game's own
// vehicles going by from left to right. The one that stops pulls up at the kerb
// by the Sim. The flow (who passes, who stops) stays in RideFlow's Roadside.

/** Who stands at the kerb: the player's own Sim (else someone of the town, in the lab). */
export type Me = { look: Look; gender: Sim['gender']; stage?: string }
/** The vehicle going by, as RideFlow's Roadside sends it. */
export type PassingCar = { id: number; kind: 'woro' | 'compteur' | 'gbaka' | 'car' | 'moto'; color: string; trim?: string; born: number }

/** Where a vehicle is along the road (m) for its share of the crossing: STOP is beside the Sim. */
const SPAN = 30
const LANE = 1.3
const KERB = 3.9
const kindOf = (k: PassingCar['kind']): VehicleKind => (k === 'compteur' ? 'taxi' : k)

function Passing({ car, passMs, stopAt, stopped, waved }: { car: PassingCar; passMs: number; stopAt: number; stopped: boolean; waved: boolean }) {
  const g = useRef<THREE.Group>(null)
  const v = useRef(-1)
  const slowUntil = useRef(0)
  const wasWaved = useRef(false)
  useFrame((_, dt) => {
    if (!g.current) return
    dt = Math.min(dt, 0.1)
    const cruise = (SPAN * 1000) / passMs
    // Comes in where RideFlow's clock says, at cruising speed.
    if (v.current < 0) ((g.current.position.x = ((Date.now() - car.born) / passMs - stopAt) * SPAN), (v.current = cruise))
    // Waved at but not stopping (full, taken): it slows a bit, then drives on.
    if (waved && !wasWaved.current && !stopped) slowUntil.current = Date.now() + 1400
    wasWaved.current = waved
    const x = g.current.position.x
    // Stopping: it brakes to the kerb by the Sim (x 0); otherwise back up to speed, gently.
    const want = stopped ? Math.max(0, Math.min(cruise, -x * 1.5)) : Date.now() < slowUntil.current ? cruise * 0.45 : cruise
    v.current += (want - v.current) * Math.min(1, dt * (stopped ? 6 : 1.6))
    g.current.position.x = x + v.current * dt
    // The road's bumps while it moves, the nose dipping as it brakes.
    const moving = v.current > 0.2
    g.current.position.y = moving ? Math.abs(Math.sin(Date.now() / 90)) * 0.025 : 0
    g.current.rotation.z = stopped && moving ? -0.025 : 0
  })
  return (
    <group ref={g} position={[-SPAN, 0, LANE]}>
      <Vehicle p={[0, 0, 0]} kind={kindOf(car.kind)} color={car.color} trim={car.trim} seed={car.id} crew />
    </group>
  )
}

/** A palm in the sea breeze. */
function Swaying({ p, h, phase }: { p: [number, number, number]; h: number; phase: number }) {
  const g = useRef<THREE.Group>(null)
  useFrame(({ clock }) => g.current && (g.current.rotation.z = Math.sin(clock.elapsedTime * 0.9 + phase) * 0.035))
  return (
    <group ref={g} position={p}>
      <Palm p={[0, 0, 0]} h={h} />
    </group>
  )
}

/** Someone going about their day on the far pavement, again and again. */
function PasserBy() {
  const g = useRef<THREE.Group>(null)
  const look = useMemo(() => {
    let s = 41
    return randomLook('homme', () => ((s = (s * 9301 + 49297) % 233280) / 233280))
  }, [])
  useFrame(({ clock }) => g.current && (g.current.position.x = 12 - ((clock.elapsedTime * 1.3 + 6) % 26)))
  return (
    <group ref={g} position={[0, 0.12, -3.5]} rotation={[0, -Math.PI / 2, 0]}>
      <Character look={look} gender="homme" walking marker={false} seed={5} speed={1.3} />
    </group>
  )
}

/** The camera breathing a little, as if held. */
function Breathing() {
  useFrame(({ camera, clock }) => {
    const t = clock.elapsedTime
    camera.position.set(1.6 + Math.sin(t * 0.35) * 0.18, 2.7 + Math.sin(t * 0.5) * 0.06, 10)
    camera.lookAt(1.4, 1.0, 1)
  })
  return null
}

/** The street, built once: road, white line, kerb and pavement, the buildings and their windows, palms and a lamp. */
function Street({ night }: { night: boolean }) {
  const houses: [number, number, string][] = [[-16, 7, '#e9c46a'], [-9.5, 9, '#f4a261'], [-3, 6, '#9fd3c7'], [3.5, 11, '#e76f51'], [10, 8, '#d9c8a9'], [16.5, 7, '#a8dadc']]
  return (
    <>
      <Box p={[0, -0.05, 0]} s={[80, 0.1, 6]} c="#55595f" />
      {[...Array(10)].map((_, i) => (
        <Box key={i} p={[-24 + i * 5.25, 0.01, 0]} s={[2.2, 0.02, 0.15]} c="#f4f1ea" />
      ))}
      {/* The kerb and the pavement the Sim stands on, the far one and the ground beyond */}
      <Box p={[0, 0.08, 3.05]} s={[80, 0.16, 0.12]} c="#e8e2d4" />
      <Box p={[0, 0.06, 3.8]} s={[80, 0.12, 1.5]} c="#c9c2b3" />
      <Box p={[0, -0.02, 9]} s={[80, 0.04, 9]} c="#c9a97a" />
      <Box p={[0, 0.06, -3.6]} s={[80, 0.12, 1.4]} c="#c9c2b3" />
      <Box p={[0, -0.02, -14]} s={[80, 0.04, 20]} c="#c9a97a" />
      {houses.map(([bx, h, c], i) => (
        <group key={i}>
          <Box p={[bx, h / 2, -6.5]} s={[6, h, 4]} c={c} />
          {[...Array(Math.floor(h / 2.5))].map((_, r) => (
            <Box key={r} p={[bx, 1.6 + r * 2.5, -4.48]} s={[4, 1.1, 0.05]} c={night ? '#ffd27a' : '#2b3a55'} glow={night ? 0.6 : undefined} />
          ))}
        </group>
      ))}
      <Swaying p={[-9, 0, -4]} h={5.5} phase={0} />
      <Swaying p={[8, 0, -4]} h={6} phase={2} />
      <Swaying p={[-6.5, 0, 4.2]} h={5} phase={4} />
      <Lamp p={[6.5, 0, 4.2]} night={night} />
    </>
  )
}

/** The Sim and whoever goes with it, at the kerb: the arm up while there is something to hail. */
function AtTheKerb({ me, party, hailing, board }: { me: Me; party: number; hailing: boolean; /** The driver said yes: the Sim walks to the door. */ board: boolean }) {
  // The others of the group: people of the town, the same ones each time.
  const others = useMemo(() => [...Array(Math.max(0, Math.min(3, party - 1)))].map((_, i) => {
    let s = 7 + i * 13
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
    const g = i % 2 ? 'homme' : 'femme'
    return { look: randomLook(g, rnd), gender: g as Sim['gender'] }
  }), [party])
  return (
    <>
      <Waiting me={me} hailing={hailing} board={board} />
      <NoShadows>
        {others.map((o, i) => (
          <group key={i} position={[3.9 + i * 0.85, 0.12, KERB + 0.15 + (i % 2) * 0.3]} rotation={[0, -0.6, 0]}>
            <Character look={o.look} gender={o.gender} pose="idle" marker={false} seed={i + 2} />
          </group>
        ))}
      </NoShadows>
    </>
  )
}

/** Where the Sim waits, and the stopped vehicle's door it walks to. */
const WAIT: [number, number] = [2.9, KERB - 0.2]
const DOOR: [number, number] = [0.9, LANE + 1.05]

/** The Sim at the kerb, facing the traffic coming from the left (turned a little to us), the arm up waving; then off to the door. */
function Waiting({ me, hailing, board }: { me: Me; hailing: boolean; board: boolean }) {
  const g = useRef<THREE.Group>(null)
  const [walking, setWalking] = useState(false)
  useFrame((_, dt) => {
    if (!g.current) return
    const [tx, tz] = board ? DOOR : WAIT
    const p = g.current.position
    const dx = tx - p.x
    const dz = tz - p.z
    const d = Math.hypot(dx, dz)
    const going = d > 0.05
    if (going !== walking) setWalking(going)
    if (going) {
      const k = Math.min(1, (1.5 * Math.min(dt, 0.1)) / d)
      p.x += dx * k
      p.z += dz * k
      g.current.rotation.y = Math.atan2(dx, dz)
    } else g.current.rotation.y = board ? Math.PI : -0.55
    // Off the pavement onto the road, a step down.
    p.y = p.z > 3.05 ? 0.12 : 0
  })
  return (
    <group ref={g} position={[WAIT[0], 0.12, WAIT[1]]} rotation={[0, -0.55, 0]}>
      <Character look={me.look} gender={me.gender} stage={me.stage} walking={walking} pose={walking ? undefined : hailing ? 'wave' : 'idle'} marker={false} seed={1} />
    </group>
  )
}

export function RoadsideScene({ me, party, car, passMs, stopAt, stopped, waved, board, hailing, night }: { me: Me; party: number; car: PassingCar | null; passMs: number; stopAt: number; stopped: boolean; /** Waved at (it may not stop). */ waved: boolean; /** The driver said yes. */ board: boolean; hailing: boolean; night: boolean }) {
  return (
    // offsetSize: the sheet pops in scaled, and the canvas must take its real size, not the scaled one.
    <Canvas dpr={sceneDpr} shadows resize={{ offsetSize: true }} camera={{ position: [1.6, 2.7, 10], fov: 30 }} onCreated={({ camera }) => camera.lookAt(1.4, 1.0, 1)}>
      <color attach="background" args={[night ? '#1b2340' : '#a9d3f0']} />
      <hemisphereLight args={[night ? '#8a9cff' : '#ffffff', '#c9b28f', night ? 0.55 : 0.9]} />
      <directionalLight position={[6, 12, 8]} intensity={night ? 0.5 : 1.3} castShadow />
      <Street night={night} />
      <Breathing />
      <PasserBy />
      <AtTheKerb me={me} party={party} hailing={hailing} board={board} />
      {car && <Passing key={car.id} car={car} passMs={passMs} stopAt={stopAt} stopped={stopped} waved={waved} />}
    </Canvas>
  )
}
