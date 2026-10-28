import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Human, NoShadows } from '../../avatar/Human'
import { useRain } from './rainRun'
import { randomLook } from '../../avatar/options'
import { serverNow, worldTime } from '../../lib/worldClock'
import { Vehicle, type VehicleKind } from '../vehicles'
import { BRIDGE_BUILD, type BridgeKind } from './bridgeNames'
import { bridgeWay as wayOf, wayAt as at, type Way } from './bridgeLine'
import { whereabouts } from '../whereabouts'
import type { ChunkData } from './tiles'

// Life on Abidjan's big bridges, from the shared clock (every player sees
// the same cars at the same place): the traffic both ways on the real lanes
// (gbakas, woro-woro, taxis, cars, motos), free-flowing most of the day,
// bumper to bumper at the morning and evening rush; people walking on the
// pavements; on the 1er pont, the train crossing on the lower level.

/** Abidjan's hour (UTC+0, no daylight saving), on the shared clock. */
const HOUR = import.meta.env.DEV && typeof location !== 'undefined' ? new URLSearchParams(location.search).get('hour') : null
const TRAIN = import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('train')
const hourNow = () => (HOUR ? Number(HOUR) : (serverNow() / 3.6e6) % 24)

/** How jammed the bridges are, 0 (free) to 1 (bumper to bumper): the 6:30–9 and 17–20 rushes. */
export function rush(h: number) {
  const bump = (from: number, peak: number, to: number) => (h <= from || h >= to ? 0 : h < peak ? (h - from) / (peak - from) : (to - h) / (to - peak))
  return Math.min(1, bump(6.3, 7.6, 9.3) + bump(16.8, 18.3, 20.3))
}

const KINDS: VehicleKind[] = ['gbaka', 'woro', 'woro', 'taxi', 'taxi', 'car', 'car', 'car', 'moto']
const COLORS = ['#f8f9fa', '#212529', '#adb5bd', '#c92a2a', '#1c7ed6', '#2b8a3e']

export function BridgeLife({ chunks, night }: { chunks: ChunkData[]; night: boolean }) {
  const key = chunks.map((c) => c.key).join()
  const ways = useMemo(
    () =>
      (['fhb', 'cdg', 'hkb', 'yop', 'ado'] as BridgeKind[]).flatMap((k) => {
        const w = wayOf(chunks, k)
        return w ? [{ kind: k, way: w }] : []
      }),
    [key], // eslint-disable-line react-hooks/exhaustive-deps
  )
  return (
    <>
      {ways.map(({ kind, way }) => (
        <group key={kind}>
          <Traffic kind={kind} way={way} />
          <Walkers kind={kind} way={way} night={night} />
          {kind === 'fhb' && <Train way={way} />}
        </group>
      ))}
    </>
  )
}

/** Speed (m/s) and gap between cars (m) for a jam level. */
const flowOf = (jam: number) => ({ v: 14 * (1 - 0.88 * jam), gap: 30 - 22 * jam })

/**
 * How many cars have gone past since midnight, minute by minute: the integral
 * of speed / gap over the day, so the cars never jump when the jam builds up.
 */
const PASSED = (() => {
  const out = [0]
  for (let m = 0; m < 1440; m++) {
    const f = flowOf(rush((m + 0.5) / 60))
    out.push(out[m] + (f.v / f.gap) * 60)
  }
  return out
})()
function passed(ms: number) {
  const day = Math.floor(ms / 8.64e7)
  const min = (ms - day * 8.64e7) / 6e4
  const m = Math.floor(min)
  return day * PASSED[1440] + PASSED[m] + (PASSED[m + 1] - PASSED[m]) * (min - m)
}

/** Only the stretch of bridge near the Sim gets cars (a long bridge would be hundreds). */
const WINDOW = 120
const POOL = Math.ceil((2 * WINDOW) / 8) + 2

/**
 * The cars, both ways, on each lane, as a steady flow: car j is at
 * (j + passed) × gap metres. Free, 30 m apart at 14 m/s; in the rush,
 * bumper to bumper, crawling.
 */
function Traffic({ kind, way }: { kind: BridgeKind; way: Way }) {
  const how = BRIDGE_BUILD[kind]
  const lanes = how.lanes
  const cars = useMemo(() => {
    const out: { lane: number; dir: 1 | -1; m: number; kind: VehicleKind; color?: string; seed: number }[] = []
    let n = 7
    const r = () => ((n = (n * 16807) % 2147483647) / 2147483647)
    for (const dir of [1, -1] as const)
      for (let lane = 0; lane < lanes; lane++)
        for (let m = 0; m < POOL; m++) {
          // Motos and gbakas keep to the outside lane, the fast cars inside.
          const pick = KINDS[Math.floor(r() * KINDS.length)]
          const kind: VehicleKind = lane === lanes - 1 || pick === 'car' || pick === 'taxi' ? pick : 'car'
          out.push({ lane, dir, m, kind, color: kind === 'car' ? COLORS[Math.floor(r() * COLORS.length)] : undefined, seed: r() * 100 })
        }
    return out
  }, [lanes])
  const refs = useRef<(THREE.Group | null)[]>([])
  useFrame(() => {
    const now = serverNow()
    const { gap } = flowOf(rush(hourNow()))
    // (In development, ?hour= freezes the hour: the flow then runs at that hour's pace.)
    const phi = HOUR ? (now / 1000) * (flowOf(rush(Number(HOUR))).v / gap) : passed(now)
    // Where the Sim is along the bridge (its nearest point).
    const [sx, sz] = whereabouts.sim
    let best = Infinity
    let centre = way.len / 2
    for (let i = 0; i < way.pts.length; i++) {
      const d = Math.hypot(way.pts[i].x - sx, way.pts[i].z - sz)
      if (d < best) [best, centre] = [d, way.cum[i]]
    }
    const far = best > 600
    cars.forEach((c, i) => {
      const g = refs.current[i]
      if (!g) return
      // Each lane runs at its own phase, so lanes don't line up.
      const lanePhi = phi + c.lane * 0.37 + (c.dir > 0 ? 0 : 0.61)
      // The car of the pool that's in the window: j ≡ m (mod POOL).
      const lo = Math.ceil((c.dir > 0 ? centre - WINDOW : way.len - centre - WINDOW) / gap - lanePhi)
      const j = lo + ((((c.m - lo) % POOL) + POOL) % POOL)
      const s0 = (j + lanePhi) * gap
      const s = c.dir > 0 ? s0 : way.len - s0
      g.visible = !far && s0 >= 0 && s0 <= way.len && Math.abs(s - centre) <= WINDOW
      if (!g.visible) return
      const p = at(way, s)
      // Drive on the right: lanes to the right of the line, one way each side.
      const off = (how.median ? 1.4 : 0.6) + c.lane * 3.4 + 1.7
      const [rx, rz] = [-p.dz * c.dir, p.dx * c.dir]
      g.position.set(p.x - rx * off, p.y + 0.05, p.z - rz * off)
      g.rotation.y = Math.atan2(p.dx * c.dir, p.dz * c.dir) - Math.PI / 2
    })
  })
  return (
    <>
      {cars.map((c, i) => (
        <group key={i} ref={(g) => void (refs.current[i] = g)}>
          <Vehicle p={[0, 0, 0]} kind={c.kind} color={c.color} seed={c.seed} crew={c.kind !== 'gbaka'} />
        </group>
      ))}
    </>
  )
}

/** People walking across on the pavements, each their own pace; fewer at night. */
function Walkers({ kind, way, night }: { kind: BridgeKind; way: Way; night: boolean }) {
  const how = BRIDGE_BUILD[kind]
  const n = Math.min(14, Math.ceil(way.len / 90)) * (night ? 1 : 2)
  const people = useMemo(() => {
    let k = kind.length * 31 + 5
    const r = () => ((k = (k * 16807) % 2147483647) / 2147483647)
    return [...Array(n)].map((_, i) => {
      const gender: 'femme' | 'homme' = r() < 0.5 ? 'femme' : 'homme'
      return { gender, look: randomLook(gender, r), seed: r() * 100, side: i % 2 ? 1 : -1, pace: 1.1 + r() * 0.5, start: r() * way.len }
    })
  }, [n, kind, way.len])
  const refs = useRef<(THREE.Group | null)[]>([])
  const half = (how.width ?? 18) / 2 - 1.8
  // The rain: on a bridge there's no cover, they run across (rainRun.tsx).
  const rain = useRain((r) => r.on)
  const ahead = useRef(0)
  useFrame((_, dt) => {
    const t = worldTime()
    if (rain) ahead.current += Math.min(dt, 0.1) * 2
    people.forEach((q, i) => {
      const g = refs.current[i]
      if (!g) return
      const d = (((q.start + (t + ahead.current) * q.pace) % way.len) + way.len) % way.len
      const s = q.side > 0 ? d : way.len - d
      const p = at(way, s)
      const dir = q.side
      g.position.set(p.x + p.dz * half * q.side, p.y + 0.15, p.z - p.dx * half * q.side)
      g.rotation.y = Math.atan2(p.dx * dir, p.dz * dir)
    })
  })
  return (
    <NoShadows>
      {people.map((q, i) => (
        <group key={i} ref={(g) => void (refs.current[i] = g)}>
          <Human look={q.look} gender={q.gender} pose={rain ? 'run' : 'walk'} seed={q.seed} speed={rain ? q.pace * 1.6 : q.pace} />
        </group>
      ))}
    </NoShadows>
  )
}

const LOCO = new THREE.MeshLambertMaterial({ color: '#c92a2a' })
const WAGON = new THREE.MeshLambertMaterial({ color: '#2b5f8a' })
const ROOF = new THREE.MeshLambertMaterial({ color: '#868e96' })
const BOX = new THREE.BoxGeometry(1, 1, 1)

/**
 * The Abidjan–Ouagadougou train on the 1er pont's lower level: a locomotive
 * and its wagons, crossing at walking-train speed every 20 minutes (the
 * timetable isn't the real one).
 */
function Train({ way }: { way: Way }) {
  const ref = useRef<THREE.Group>(null)
  const cars = useRef<(THREE.Group | null)[]>([])
  const how = BRIDGE_BUILD.fhb
  const WAGONS = 6
  useFrame(() => {
    const t = worldTime()
    const cycle = 1200
    // (In development, ?train makes it cross now, over and over.)
    const k = TRAIN ? (t % 160) / cycle : (t % cycle) / cycle
    // Across in the first 90 s of each cycle, at about 6 m/s.
    const s0 = (k * cycle) * 6 - 80
    const on = s0 < way.len + 140
    if (ref.current) ref.current.visible = on
    if (!on) return
    for (let i = 0; i <= WAGONS; i++) {
      const g = cars.current[i]
      if (!g) continue
      const s = s0 - i * 19
      g.visible = s > 0 && s < way.len
      if (!g.visible) continue
      const p = at(way, s)
      // On the bottom slab of the girder, under the road.
      g.position.set(p.x, p.y - 0.9 - how.girder + 0.6, p.z)
      g.rotation.y = Math.atan2(p.dx, p.dz)
    }
  })
  return (
    <group ref={ref}>
      {[...Array(WAGONS + 1)].map((_, i) => (
        <group key={i} ref={(g) => void (cars.current[i] = g)}>
          <mesh geometry={BOX} material={i ? WAGON : LOCO} scale={[2.8, 3.2, 17.5]} position={[0, 1.7, 0]} />
          <mesh geometry={BOX} material={ROOF} scale={[2.6, 0.2, 17]} position={[0, 3.4, 0]} />
        </group>
      ))}
    </group>
  )
}
