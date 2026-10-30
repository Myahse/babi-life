import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { Sim, World } from '../lib/types'
import { sceneDpr } from '../lib/device'
import { lifeOf } from '../game/rules'
import { Character } from '../world3d/Character'
import { Human } from '../avatar/Human'
import { randomLook } from '../avatar/options'
import { Airliner } from '../world3d/open/airport'
import { FlightSky } from '../world3d/FlightView'
import { Vehicle } from '../world3d/vehicles'
import { Box, Palm, Sign, Tree } from '../world3d/props'
import { rng } from '../world3d/themes'
import { coachCompany, placeName } from '../game/voyages'
import { t as tr, tx } from '../lib/i18n'

// From one city to another (the update « voyages-villes »): the trip seen in
// 3D, the game's own pieces only. Boarding: the Sim crosses the apron to the
// Air Lagune plane and climbs its stairs, or walks across the gare routière to
// its company's coach and gets in. On the way, a short loading screen like a
// ride in town (TripLoading): the plane over the clouds, or the coach on the
// road through the bush. There: down the stairs to the other city's terminal,
// or off the coach at its gare. Then the server ends the trip (sims.go
// arriveNow) and the Sim stands at the airport or the gare it landed at.

const BOARD_MS = 5000
const WAY_MS = 4200
const ARRIVE_MS = 4400
export const CITY_TRIP_MS = BOARD_MS + WAY_MS + ARRIVE_MS

type Phase = 'board' | 'way' | 'arrive'
type Who = { look: Sim['look']; gender: Sim['gender']; stage: string }

/** Seconds since the phase began, read in the frame loop. */
function usePhaseClock(phase: Phase) {
  const t0 = useRef<number | null>(null)
  const seen = useRef(phase)
  return (clock: THREE.Clock) => {
    if (t0.current === null || seen.current !== phase) {
      t0.current = clock.elapsedTime
      seen.current = phase
    }
    return clock.elapsedTime - t0.current
  }
}

/** Along a way of points at a speed (m/s): where, which way it faces, and whether it's arrived. */
function along(way: [number, number, number][], d: number) {
  let left = d
  for (let i = 1; i < way.length; i++) {
    const [a, b] = [way[i - 1], way[i]]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
    if (left <= len) {
      const u = len ? left / len : 1
      return { p: [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u] as [number, number, number], r: Math.atan2(b[0] - a[0], b[2] - a[2]), done: false }
    }
    left -= len
  }
  const [a, b] = [way[way.length - 2], way[way.length - 1]]
  return { p: b, r: Math.atan2(b[0] - a[0], b[2] - a[2]), done: true }
}

/** The camera where each scene wants it. */
function Cam({ at, look }: { at: [number, number, number]; look: [number, number, number] }) {
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    camera.position.set(...at)
    camera.lookAt(...look)
  }, [camera, at, look])
  return null
}

/** The Sim walking a way, gone (inside) once there when `vanish`. */
function Walking({ who, way, speed, phase, vanish, delay = 0 }: { who: Who; way: [number, number, number][]; speed: number; phase: Phase; vanish?: boolean; delay?: number }) {
  const g = useRef<THREE.Group>(null)
  const time = usePhaseClock(phase)
  const [walking, setWalking] = useState(true)
  useFrame(({ clock }) => {
    if (!g.current) return
    const t = Math.max(0, time(clock) - delay)
    const w = along(way, t * speed)
    g.current.position.set(...w.p)
    g.current.rotation.y = w.r
    g.current.visible = !(vanish && w.done)
    if (w.done === walking) setWalking(!w.done)
  })
  return (
    <group ref={g}>
      <Character look={who.look} gender={who.gender} stage={who.stage} walking={walking} marker={false} seed={7} />
    </group>
  )
}

/** Other travellers, walking the same way a little behind or ahead. */
function Others({ way, phase, seed, n = 3 }: { way: [number, number, number][]; phase: Phase; seed: string; n?: number }) {
  const people = useMemo(() => {
    const r = rng(seed)
    return [...Array(n)].map((_, i) => {
      const gender: Sim['gender'] = r() < 0.5 ? 'femme' : 'homme'
      return { look: randomLook(gender, r), gender, side: (r() - 0.5) * 2.4, delay: 0.5 + i * 0.7 }
    })
  }, [seed, n])
  return (
    <>
      {people.map((p, i) => (
        <group key={i} position={[p.side, 0, 0]}>
          <Walking who={{ look: p.look, gender: p.gender, stage: 'adulte' }} way={way} speed={1.5} phase={phase} vanish delay={p.delay} />
        </group>
      ))}
    </>
  )
}

/* ---------- The airport: the apron, the terminal, the plane and its stairs ---------- */

/** Local: the terminal along z = -18 (its doors at x = 0), the plane with its nose to +z, its front door on the left (x = PLANE_X - 2). */
const PLANE_X = 9
const DOOR: [number, number, number] = [PLANE_X - 2.2, 4.1, 10]
const STAIRS_FOOT: [number, number, number] = [PLANE_X - 7.6, 0, 10]

function Apron({ name, night }: { name: string; night: boolean }) {
  return (
    <group>
      <Box p={[0, -0.05, 0]} s={[260, 0.1, 200]} c={night ? '#55595f' : '#6b6f76'} />
      {/* The taxiway's yellow line and the parking box */}
      <Box p={[PLANE_X, 0.01, 0]} s={[0.25, 0.02, 120]} c="#f4c430" />
      <Box p={[-4, 0.01, 4]} s={[0.2, 0.02, 30]} c="#f4f1ea" />
      {/* The terminal: its glass front, the white frame, the airport's name */}
      <Box p={[0, 4, -21]} s={[70, 8, 6]} c={night ? '#b7bec7' : '#eef0f2'} />
      <Box p={[0, 3.2, -17.95]} s={[64, 4.6, 0.1]} c="#4d7da8" glow={night ? 0.5 : 0.15} />
      {[-30, -20, -10, 0, 10, 20, 30].map((x) => (
        <Box key={x} p={[x, 3.2, -17.9]} s={[0.4, 4.8, 0.2]} c="#f4f5f7" />
      ))}
      <Box p={[0, 1.3, -17.85]} s={[3.2, 2.6, 0.12]} c="#26303d" />
      <Sign p={[0, 7.1, -17.8]} w={16} text={name} bg="#14213d" fg="#ffd166" />
      {/* The control tower, behind */}
      <Box p={[34, 10, -28]} s={[3, 20, 3]} c="#f4f5f7" />
      <Box p={[34, 21, -28]} s={[6, 2.6, 6]} c="#4d7da8" glow={0.3} />
      {/* The baggage carts, a fuel truck */}
      <Box p={[-14, 0.6, 2]} s={[3, 1, 1.6]} c="#2e3540" />
      <Box p={[-18, 0.6, 2]} s={[3, 1, 1.6]} c="#2e3540" />
      <Box p={[24, 1.3, 14]} s={[6, 2.4, 2.4]} c="#f08a24" />
      <Palm p={[-36, 0, -14]} h={7} />
      <Palm p={[38, 0, -12]} h={6} />
    </group>
  )
}

/** The plane at its stand and the stairs up to its front door. */
function PlaneAtStand() {
  const steps = 10
  return (
    <group>
      <group position={[PLANE_X, 0, 0]}>
        <Airliner />
      </group>
      {/* The boarding stairs: a white truck, its steps up to the door */}
      {[...Array(steps)].map((_, i) => (
        <Box key={i} p={[STAIRS_FOOT[0] + ((DOOR[0] - 0.4 - STAIRS_FOOT[0]) * (i + 0.5)) / steps, ((i + 0.5) * DOOR[1]) / steps - 0.1, DOOR[2]]} s={[0.6, 0.2, 1.4]} c="#d7dbe0" />
      ))}
      <Box p={[(STAIRS_FOOT[0] + DOOR[0]) / 2 - 0.2, DOOR[1] / 2 + 0.5, DOOR[2] + 0.8]} s={[DOOR[0] - STAIRS_FOOT[0], 0.1, 0.1]} c="#f4f5f7" />
      <Box p={[(STAIRS_FOOT[0] + DOOR[0]) / 2 - 0.2, DOOR[1] / 2 + 0.5, DOOR[2] - 0.8]} s={[DOOR[0] - STAIRS_FOOT[0], 0.1, 0.1]} c="#f4f5f7" />
      <Box p={[DOOR[0] - 0.2, DOOR[1] - 0.15, DOOR[2]]} s={[0.8, 0.12, 1.4]} c="#c3c8cf" />
    </group>
  )
}

/** Across the apron from the terminal's doors to the stairs, up them, in. */
const ON_BOARD: [number, number, number][] = [[-6, 0, 16], [STAIRS_FOOT[0] - 0.6, 0, DOOR[2]], [DOOR[0] - 0.6, DOOR[1] - 0.1, DOOR[2]], [DOOR[0] + 0.3, DOOR[1] - 0.1, DOOR[2]]]
const OFF_BOARD: [number, number, number][] = [...ON_BOARD].reverse()

function AirportScene({ who, name, phase, night, out }: { who: Who; name: string; phase: Phase; night: boolean; out: boolean }) {
  const way = out ? OFF_BOARD : ON_BOARD
  return (
    <>
      <Cam at={[-15, 7.5, 26]} look={[1.5, 2.6, 9]} />
      <Apron name={name} night={night} />
      <PlaneAtStand />
      <Walking who={who} way={way} speed={3.4} phase={phase} vanish={!out} />
      <Others way={way} phase={phase} seed={`${name}${out}`} />
    </>
  )
}

/* ---------- The gare routière: the yard, the shelter, the vendors, the coach ---------- */

const COACH_DOOR: [number, number, number] = [4.2, 0, 1.4]

function Yard({ name, company, night }: { name: string; company: { name: string; body: string; stripe: string }; night: boolean }) {
  const vendors = useMemo(() => {
    const r = rng(name)
    return [...Array(5)].map((_, i) => ({ look: randomLook('femme', r), at: [-12 + i * 5.5, 0, -7.5 + r() * 1.2] as [number, number, number] }))
  }, [name])
  return (
    <group>
      {/* The yard's beaten earth, the concrete of the bays */}
      <Box p={[0, -0.05, 0]} s={[220, 0.1, 160]} c={night ? '#5a4030' : '#b5703f'} />
      <Box p={[0, 0.01, 0]} s={[44, 0.04, 9]} c={night ? '#6e6a62' : '#bdb8ad'} />
      {/* The shelter: a long roof on posts, its benches, the company's sign */}
      <Box p={[0, 4, -9]} s={[40, 0.3, 6]} c={company.stripe} />
      {[-19, -9.5, 0, 9.5, 19].map((x) => (
        <Box key={x} p={[x, 2, -11.5]} s={[0.3, 4, 0.3]} c="#5c6773" />
      ))}
      {[-14, -6, 2, 10].map((x) => (
        <Box key={x} p={[x, 0.45, -11]} s={[5, 0.12, 0.6]} c="#8a5a3c" />
      ))}
      <Sign p={[0, 5.4, -9]} w={14} text={company.name} bg={company.stripe} fg="#ffffff" />
      <Sign p={[-22, 3.2, -4]} w={9} text={name} bg="#14213d" fg="#ffd166" r={Math.PI / 6} />
      {/* The ticket office */}
      <Box p={[24, 1.6, -9]} s={[6, 3.2, 4]} c={company.body} />
      <Box p={[24, 1.7, -6.95]} s={[3.4, 1.2, 0.1]} c="#26303d" />
      {/* The vendors under their parasols, their basins */}
      {vendors.map((v, i) => (
        <group key={i} position={v.at}>
          <Human look={v.look} gender="femme" pose="idle" seed={i} />
          <Box p={[0.6, 0.35, 0.3]} s={[0.7, 0.3, 0.7]} c={['#2a6cf0', '#e03131', '#f4c430'][i % 3]} />
        </group>
      ))}
      <Tree p={[-30, 0, -16]} s={1.4} />
      <Palm p={[30, 0, -16]} h={7} />
      <Tree p={[40, 0, 8]} s={1.2} />
      {/* Another coach waiting in the next bay */}
      <Vehicle p={[-16, 0, 6]} kind="sotra" color={company.body} skirt={company.stripe} seed={2} />
    </group>
  )
}

/** The coach: standing at its bay (boarding), or pulling in (arriving). */
function Coach({ company, phase, arriving }: { company: { body: string; stripe: string }; phase: Phase; arriving: boolean }) {
  const g = useRef<THREE.Group>(null)
  const time = usePhaseClock(phase)
  useFrame(({ clock }) => {
    if (!g.current) return
    const t = time(clock)
    // Arriving: in from the road, slowing to its bay over 1.6 s.
    const u = arriving ? Math.min(1, t / 1.6) : 1
    g.current.position.x = -(1 - u) * (1 - u) * 40
    g.current.position.y = Math.abs(Math.sin(t * 8)) * 0.02 * (1 - u)
  })
  return (
    <group ref={g}>
      <Vehicle p={[0, 0, 0]} kind="sotra" color={company.body} skirt={company.stripe} seed={1} />
    </group>
  )
}

const TO_COACH: [number, number, number][] = [[-3, 0, 7], [COACH_DOOR[0], 0, COACH_DOOR[2] + 1.6], [COACH_DOOR[0], 0, COACH_DOOR[2]]]
const OFF_COACH: [number, number, number][] = [[COACH_DOOR[0], 0, COACH_DOOR[2]], [COACH_DOOR[0], 0, COACH_DOOR[2] + 1.6], [9, 0, 6], [12, 0, 9]]

function GareScene({ who, name, company, phase, night, out }: { who: Who; name: string; company: { name: string; body: string; stripe: string }; phase: Phase; night: boolean; out: boolean }) {
  return (
    <>
      <Cam at={[-4, 6, 21]} look={[2.5, 1.6, 0]} />
      <Yard name={name} company={company} night={night} />
      <Coach company={company} phase={phase} arriving={out} />
      {/* Off once it has stopped */}
      <Walking who={who} way={out ? OFF_COACH : TO_COACH} speed={2.4} phase={phase} vanish={!out} delay={out ? 1.8 : 0} />
      {!out && <Others way={TO_COACH} phase={phase} seed={name} n={2} />}
    </>
  )
}

/* ---------- On the way: the coach on the road through the bush ---------- */

const SPEED = 18
const LOOP = 60

function Road({ company, night }: { company: { body: string; stripe: string }; night: boolean }) {
  const near = useRef<THREE.Group>(null)
  const far = useRef<THREE.Group>(null)
  const bus = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (near.current) near.current.position.x = (t * SPEED) % LOOP
    if (far.current) far.current.position.x = (t * SPEED * 0.35) % LOOP
    if (bus.current) bus.current.position.y = Math.abs(Math.sin(t * 7)) * 0.05
  })
  const bush = useMemo(() => {
    const r = rng('brousse')
    return [...Array(14)].map(() => ({ x: r() * LOOP - LOOP / 2, z: 5 + r() * 9, palm: r() < 0.35, s: 0.8 + r() * 0.8 }))
  }, [])
  const villages = useMemo(() => {
    const r = rng('villages')
    return [...Array(6)].map(() => ({ x: r() * LOOP - LOOP / 2, z: -10 - r() * 8, c: ['#c9a97a', '#e9c46a', '#d9c8a9'][Math.floor(r() * 3)] }))
  }, [])
  const thrice = (f: (dx: number) => React.ReactNode) => [-LOOP, 0, LOOP].map((dx) => <group key={dx}>{f(dx)}</group>)
  return (
    <>
      <color attach="background" args={[night ? '#1a2240' : '#a9d3f0']} />
      <hemisphereLight args={[night ? '#9aa8e0' : '#ffffff', '#8a6a40', night ? 0.8 : 0.95]} />
      <directionalLight position={[8, 14, 10]} intensity={night ? 0.7 : 1.3} castShadow />
      {/* The tarred road, its red-earth shoulders, the green bush either side */}
      <Box p={[0, -0.05, 0]} s={[400, 0.1, 6]} c="#4a4d52" />
      <Box p={[0, -0.04, 4]} s={[400, 0.1, 2]} c="#b5703f" />
      <Box p={[0, -0.04, -4]} s={[400, 0.1, 2]} c="#b5703f" />
      <Box p={[0, -0.06, 20]} s={[400, 0.1, 30]} c={night ? '#24361f' : '#5f8f3e'} />
      <Box p={[0, -0.06, -24]} s={[400, 0.1, 40]} c={night ? '#24361f' : '#6f9a46'} />
      <group ref={near}>
        {thrice((dx) => (
          <>
            {[...Array(10)].map((_, i) => (
              <Box key={i} p={[dx - LOOP / 2 + i * 6, 0.01, 0]} s={[2.4, 0.02, 0.15]} c="#f4f1ea" />
            ))}
            {bush.map((b, i) => (b.palm ? <Palm key={i} p={[dx + b.x, 0, b.z]} h={5 + b.s * 2} /> : <Tree key={i} p={[dx + b.x, 0, b.z]} s={b.s} />))}
          </>
        ))}
      </group>
      <group ref={far}>
        {thrice((dx) =>
          villages.map((v, i) => (
            <group key={i}>
              <Box p={[dx + v.x, 1.4, v.z]} s={[4, 2.8, 3.4]} c={v.c} />
              <Box p={[dx + v.x, 3.05, v.z]} s={[4.6, 0.5, 4]} c="#8a5a3c" />
            </group>
          )),
        )}
      </group>
      <group ref={bus} position={[0, 0, 1.4]}>
        <Vehicle p={[0, 0, 0]} r={Math.PI} kind="sotra" color={company.body} skirt={company.stripe} seed={1} />
      </group>
    </>
  )
}

/* ---------- The whole of it ---------- */

export function CityTrip({ world, sim, night, onDone }: { world: World; sim: Sim; night: boolean; onDone: () => void }) {
  const a = sim.activity!
  const trip = a.trip!
  const plane = trip.mode === 'avion'
  const [phase, setPhase] = useState<Phase>('board')
  const done = useRef(onDone)
  done.current = onDone
  useEffect(() => {
    const k1 = setTimeout(() => setPhase('way'), BOARD_MS)
    const k2 = setTimeout(() => setPhase('arrive'), BOARD_MS + WAY_MS)
    const k3 = setTimeout(() => done.current(), CITY_TRIP_MS)
    return () => [k1, k2, k3].forEach(clearTimeout)
  }, [])
  const who: Who = { look: sim.look, gender: sim.gender, stage: lifeOf(world, sim).stage?.id ?? 'adulte' }
  const company = coachCompany(world, trip.company)
  const toCity = world.cities.find((c) => c.id === trip.city)?.name ?? trip.city
  const fromName = placeName(world, trip.fromPlace) ?? ''
  const toName = placeName(world, trip.place) ?? toCity
  const at = phase === 'arrive' ? toName : fromName
  const title = phase === 'board' ? (plane ? tr('Embarquement') : tr('On monte dans le car')) : phase === 'way' ? tx('En route pour {0}', { 0: toCity }) : tx('Bienvenue à {0}', { 0: toCity })
  const sub = plane ? tx('Vol {0} · {1}', { 0: trip.company ?? 'Air Lagune', 1: phase === 'way' ? tr('au-dessus des nuages') : at }) : tx('{0} · {1}', { 0: company.name, 1: phase === 'way' ? tr('sur la route') : at })
  return (
    <div className="absolute inset-0 z-[60] flex flex-col overflow-hidden bg-[#a9d3f0]">
      <style>{'@keyframes trip-bar { from { width: 0 } to { width: 100% } }'}</style>
      <div className="relative flex-1">
        <Canvas key={phase} dpr={sceneDpr} shadows camera={{ fov: 42, near: 0.5, far: 1500, position: [40, 14, -60] }}>
          {phase === 'way' ? (
            plane ? (
              <FlightSky night={night} />
            ) : (
              <>
                <Cam at={[-1, 5, 20]} look={[-1, 1.4, 0]} />
                <Road company={company} night={night} />
              </>
            )
          ) : (
            <>
              <color attach="background" args={[night ? '#1a2240' : '#a9d3f0']} />
              {/* At night, the floodlights over the apron and the gare: everything still seen */}
              <hemisphereLight args={[night ? '#c9d4ff' : '#ffffff', '#c9b28f', night ? 0.9 : 0.95]} />
              <directionalLight position={[10, 18, 12]} intensity={night ? 0.9 : 1.3} color={night ? '#ffe2b0' : '#ffffff'} castShadow />
              {plane ? <AirportScene who={who} name={at} phase={phase} night={night} out={phase === 'arrive'} /> : <GareScene who={who} name={at} company={company} phase={phase} night={night} out={phase === 'arrive'} />}
            </>
          )}
        </Canvas>
      </div>
      <div className="relative z-10 bg-[#0f1230]/85 px-6 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center">
        <div className="font-display text-[20px] font-extrabold text-white">{title}</div>
        <div className="text-[13px] font-extrabold text-white/80">{sub}</div>
        <div className="mx-auto mt-3 h-2.5 max-w-[340px] overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-[#ffc233]" style={{ animation: `trip-bar ${CITY_TRIP_MS}ms linear forwards` }} />
        </div>
      </div>
    </div>
  )
}
