import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CAR_COLORS, Vehicle, type VehicleKind } from '../vehicles'
import { whereabouts } from '../whereabouts'
import { moveObstacle } from '../obstacles'
import { worldTime } from '../../lib/worldClock'
import { rng } from '../themes'
import type { Nav } from './nav'
import { turnTo } from './shared'
import { blockedAhead, giveWay, holdJunctions, queueOf, redAhead, report, stopForPapers, waiting, type Junction, type Light } from './trafficFlow'
import { howMany, Roamer } from './roam'

// The commune's taxis, woro-woros, private cars and motos, each one a car of its own, driving on through
// the streets (roam.ts): you see the same orange taxi go by again, it went round the block. The near ones
// are drawn and keep the code de la route (the lights, the car ahead, the crossroads, the checkpoints,
// the Sim crossing); the far ones drive on unseen. The buses and gbakas keep their lines (OpenWorld's Car).

const KINDS: VehicleKind[] = ['taxi', 'taxi', 'woro', 'woro', 'woro', 'car', 'car', 'car', 'moto']
const SPEED: Partial<Record<VehicleKind, number>> = { moto: 11 }
/** One car per so many metres of road it drives on, up to MAX; the nearest SHOWN within NEAR drawn. */
const PER_METRE = 1 / 110
const MAX = 240
const NEAR = 260
const SHOWN = 30
const SIZE: Partial<Record<VehicleKind, [number, number]>> = { taxi: [4.4, 1.7], woro: [4.4, 1.7], car: [4.5, 1.8], moto: [1.9, 0.6] }
const LANE = 2

type Driver = { r: Roamer; kind: VehicleKind; color?: string; trim?: string; seed: number; speed: number; v: number }

export function RoamTraffic({ nav, seed, lights, junctions, woro, share = 1 }: { nav: Nav; seed: string; lights: Light[]; junctions: Junction[]; woro?: { color?: string; trim?: string; none?: boolean }; /** how busy the roads are (density.ts), 1 as usual */ share?: number }) {
  // The commune's cars: made once, more added as its streets come in, never made again (each stays who it is).
  const cars = useRef<Driver[]>([])
  const want = Math.max(4, Math.round(howMany(nav, { minWidth: 7 }, PER_METRE * Math.min(2, share), MAX)))
  if (cars.current.length < want) {
    for (let i = cars.current.length; i < want; i++) {
      const r = rng(`roamcar|${seed}|${i}`)
      const drawn = KINDS[Math.floor(r() * KINDS.length)]
      const kind: VehicleKind = drawn === 'woro' && woro?.none ? 'taxi' : drawn
      cars.current.push({
        r: new Roamer(`car${i}`, { minWidth: 7 }, nav, seed),
        kind,
        color: kind === 'woro' ? woro?.color : kind === 'car' ? CAR_COLORS[Math.floor(r() * CAR_COLORS.length)] : undefined,
        trim: kind === 'woro' ? woro?.trim : undefined,
        seed: r() * 100,
        speed: SPEED[kind] ?? 9.5,
        v: 1,
      })
    }
  }
  const [shown, setShown] = useState<Driver[]>([])
  const navRef = useRef(nav)
  navRef.current = nav
  const pick = useRef(0)
  // The far ones drive on, at their pace (no lights for them: nobody sees).
  useFrame(({ clock }, dt) => {
    const step = Math.min(dt, 0.5)
    const on = new Set(shown)
    for (const c of cars.current) if (!on.has(c)) c.r.advance(navRef.current, c.speed * step * 0.85)
    if (clock.elapsedTime - pick.current < 0.5) return
    pick.current = clock.elapsedTime
    const [sx, sz] = whereabouts.sim
    const near = cars.current
      .map((c) => {
        const p = c.r.at
        return { c, d: Math.hypot(p.x - sx, p.z - sz) }
      })
      .filter((x) => x.d < NEAR)
      .sort((a, b) => a.d - b.d)
      .slice(0, SHOWN)
      .map((x) => x.c)
    if (near.length !== shown.length || near.some((c) => !on.has(c))) setShown(near)
    if (import.meta.env.DEV) Object.assign(globalThis, { __roamCars: cars.current })
  })
  return (
    <>
      {shown.map((c) => (
        <RoamCar key={c.r.id} car={c} nav={nav} lights={lights} junctions={junctions} />
      ))}
    </>
  )
}

function RoamCar({ car, nav, lights, junctions }: { car: Driver; nav: Nav; lights: Light[]; junctions: Junction[] }) {
  const ref = useRef<THREE.Group>(null)
  const id = `roam:${car.r.id}`
  const held = useRef(0)
  const first = useRef(true)
  const [l, w] = SIZE[car.kind] ?? [4.4, 1.7]
  const look = useMemo(() => ({ t: -1 }), [])
  useFrame((_, dtRaw) => {
    const g = ref.current
    if (!g) return
    const dt = Math.min(dtRaw, 0.1)
    const dtv = Math.min(dtRaw, 0.5)
    const p = car.r.at
    const heading = p.r
    // On the right of the street, in its lane.
    const [x, z] = [p.x - Math.cos(heading) * LANE, p.z + Math.sin(heading) * LANE]
    const t = worldTime()
    // The code de la route, as the other cars keep it (OpenWorld's Car).
    const papers = stopForPapers(id, x, z, heading, l / 2, t)
    const red = !papers && redAhead(lights, x, z, heading, l / 2, t)
    const ahead = !papers && !red ? blockedAhead(id, x, z, heading, l / 2, 3 + car.speed * car.v * dtv) : null
    holdJunctions(id, junctions, x, z, heading, l / 2, t)
    const [fx, fz] = [Math.sin(heading), Math.cos(heading)]
    const [sx, sz] = [whereabouts.sim[0] - x, whereabouts.sim[1] - z]
    const walker = sx * fx + sz * fz > 0 && sx * fx + sz * fz < l / 2 + 7 && Math.abs(sx * fz - sz * fx) < w / 2 + 1
    const yieldTo = !papers && !red && !ahead && !walker ? giveWay(id, junctions, x, z, heading, l / 2, car.r.width, car.v, t, held.current) : null
    const queue = ahead && queueOf(id, ahead)
    const waitFor = papers ? 'papers' : red ? 'red' : walker ? 'pieton' : (ahead ?? yieldTo)
    const stuck = (ahead && queue !== 'light') || yieldTo === 'prio'
    const blocked = papers || red || walker || (ahead && (queue === 'light' || held.current < (queue === 'jam' ? 3 : 8))) || !!yieldTo
    if (blocked) {
      if (stuck) held.current += dt
      waiting(id, waitFor ?? '')
    } else held.current = Math.max(0, held.current - dt * 4)
    // Slower in the small streets and round the corners; braking quicker than speeding up.
    const bend = Math.abs(Math.atan2(Math.sin(heading - Math.atan2(car.r.b[0] - car.r.a[0], car.r.b[1] - car.r.a[1])), Math.cos(heading - Math.atan2(car.r.b[0] - car.r.a[0], car.r.b[1] - car.r.a[1]))))
    const want = blocked ? 0 : Math.min(car.r.width < 6.5 ? 0.6 : car.r.width < 8.5 ? 0.8 : 1, bend > 0.3 ? 0.55 : 1)
    car.v += Math.max(-2.2 * dtv, Math.min(0.55 * dt, want - car.v))
    if (car.v < 0.02 && want === 0) car.v = 0
    car.r.advance(nav, car.speed * car.v * dtv)
    g.position.set(x, nav.heightAt(x, z), z)
    g.rotation.y = first.current ? heading - Math.PI / 2 : turnTo(g.rotation.y, heading - Math.PI / 2, 1 - Math.exp(-8 * dt))
    first.current = false
    report(id, { x, z, h: heading, half: l / 2, wait: blocked ? (waitFor ?? undefined) : undefined })
    moveObstacle(id, { x, z, hw: l / 2, hd: w / 2, rot: g.rotation.y })
    void look
  })
  useEffect(
    () => () => {
      moveObstacle(id, null)
      report(id, null)
    },
    [id],
  )
  return (
    <group ref={ref}>
      <Vehicle p={[0, 0, 0]} kind={car.kind} color={car.color} trim={car.trim} seed={car.seed} />
    </group>
  )
}
