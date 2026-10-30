import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ambience } from '../../audio/ambience'
import { Box } from '../props'
import { Vehicle, type VehicleKind } from '../vehicles'
import { moveObstacle } from '../obstacles'
import { whereabouts } from '../whereabouts'
import { along, routeLength } from './shared'
import type { XZ } from './geo'

// The street's « Embouteillage » (Happenings.tsx, laid along the real street by jam.ts): not frozen, a
// real jam. Bumper to bumper on both sides, each queue crawls a few metres and stops, the wave going
// back down the line from the front car; horns now and then (more of them close by), the headlights
// flashed, an arm out of a window. Regulated at the junction (the update « circulation »,
// components/defi/Circulation.tsx), it clears: front first, each car pulls away and drives off the
// stretch, and the street's traffic comes back.

/** The jam's mix: gbakas, taxis, woro-woros, a few cars, a moto. */
export const JAM_KINDS: VehicleKind[] = ['gbaka', 'taxi', 'woro', 'car', 'gbaka', 'taxi', 'car', 'woro', 'moto', 'taxi']
export const jamColor = (kind: VehicleKind, i: number) => (kind === 'woro' ? '#2a6cf0' : kind === 'car' ? ['#f8f9fa', '#c92a2a', '#212529'][i % 3] : undefined)
const HALF: Record<VehicleKind, [number, number]> = { taxi: [2.2, 0.85], woro: [2.2, 0.85], car: [2.25, 0.9], gbaka: [2.65, 0.95], moto: [0.95, 0.3], sotra: [5.5, 1.25] }

/** A queue's spacing (bumper to bumper), how far it creeps each time, how often, how long it moves. */
const GAP = 7.2
const STEP = 3.1
const CYCLE = 5.5
const MOVE = 2.4
/** How long the next car behind waits before it creeps too (the wave down the line). */
const LAG = 0.45
const smooth = (k: number) => k * k * (3 - 2 * k)

/** How far a car has crept at t seconds: a step, a stop, a step… */
function crept(t: number) {
  const n = Math.floor(t / CYCLE)
  return STEP * (n + smooth(Math.min(1, (t - n * CYCLE) / MOVE)))
}
/** How far it has driven off, t seconds after it pulled away: speeding up, then at town speed. */
const drivenOff = (t: number) => (t <= 0 ? 0 : t < 3.75 ? 1.2 * t * t : 16.9 + 9 * (t - 3.75))

/** A driver's arm out of the window, waving (shown while `out` is 1). In the car's own frame (it faces +x; the driver on the left, -z). */
export function DriverArm({ out, at }: { out: { current: number }; at: [number, number, number] }) {
  const g = useRef<THREE.Group>(null)
  const seed = useMemo(() => Math.random() * 10, [])
  useFrame(({ clock }) => {
    if (!g.current) return
    g.current.visible = out.current > 0
    if (g.current.visible) g.current.rotation.x = -0.25 - Math.max(0, Math.sin(clock.elapsedTime * 3 + seed)) * 0.9
  })
  return (
    <group ref={g} position={at}>
      <Box p={[0, 0, -0.32]} s={[0.14, 0.14, 0.62]} c="#7a4a2a" />
      <Box p={[0, 0.03, -0.68]} s={[0.16, 0.16, 0.14]} c="#6b3f22" />
    </group>
  )
}

type Slot = { lane: 1 | -1; i: number; kind: VehicleKind; color?: string; seed: number; arm: boolean; key: string }

export function MovingJam({ path, centre, width, clearing, onCleared, seed }: { path: XZ[]; /** How far along the path the jam's middle is. */ centre: number; width: number; /** Regulated: since when (performance.now() ms); null: still jammed. */ clearing: number | null; onCleared: () => void; seed: string }) {
  const L = useMemo(() => routeLength(path), [path])
  const n = Math.max(2, Math.min(12, Math.floor((L - 6) / GAP)))
  // The stretch the queues stand on: round the middle, kept on the path.
  const from = Math.max(0, Math.min(L - n * GAP - 6, centre - (n * GAP) / 2))
  const slots = useMemo<Slot[]>(() => {
    const h = [...seed].reduce((a, c) => a + c.charCodeAt(0), 0)
    return ([1, -1] as const).flatMap((lane) =>
      [...Array(n)].map((_, i) => {
        const kind = JAM_KINDS[(i * 3 + (lane > 0 ? 0 : 5) + h) % JAM_KINDS.length]
        return { lane, i, kind, color: jamColor(kind, i), seed: (i * 7 + h) % 100, arm: kind !== 'moto' && kind !== 'gbaka' && (i + h) % 3 === 0, key: `jam${lane}${i}` }
      }),
    )
  }, [n, seed])
  const refs = useRef<(THREE.Group | null)[]>([])
  const lights = useRef<(THREE.Group | null)[]>([])
  const arms = useMemo(() => slots.map(() => ({ current: 0 })), [slots])
  const honk = useRef<number[]>([])
  const nextHorn = useRef(0)
  // Where each queue had got to when it was regulated (it drives off from there).
  const frozen = useRef<number[] | null>(null)
  const told = useRef(false)
  const off = Math.max(1.6, Math.min(2.4, width / 4))
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    const since = clearing === null ? null : (performance.now() - clearing) / 1000
    if (since !== null && !frozen.current) frozen.current = slots.map((s) => crept(t - (n - 1 - s.i) * LAG))
    if (since === null) frozen.current = null
    let shown = 0
    slots.forEach((s, k) => {
      const g = refs.current[k]
      if (!g) return
      const lag = (n - 1 - s.i) * LAG
      const moved = frozen.current ? frozen.current[k] : crept(t - lag)
      let q = 3 + ((s.i * GAP + moved) % (n * GAP))
      if (since !== null) q += drivenOff(since - lag * 0.8)
      // Off the stretch (or about to wrap round to its back): not there.
      // (Driven off: gone past the stretch's end, out of sight round the next streets.)
      const visible = since !== null ? q < n * GAP + 70 && (s.lane > 0 ? from + q < L : from + n * GAP + 6 - q > 0) : q > 4.5 && q < 3 + n * GAP - 1.5
      g.visible = visible
      if (!visible) return moveObstacle(s.key, null)
      shown++
      const u = s.lane > 0 ? Math.min(L, from + q) : Math.max(0, from + n * GAP + 6 - q)
      const [pa, pb] = [along(path, Math.max(0, u - 3)), along(path, Math.min(L, u + 3))]
      const p = along(path, u)
      const r = Math.hypot(pb.x - pa.x, pb.z - pa.z) > 0.5 ? Math.atan2(pb.x - pa.x, pb.z - pa.z) : p.r
      const heading = s.lane > 0 ? r : r + Math.PI
      const [x, z] = [p.x - Math.cos(r) * s.lane * off, p.z + Math.sin(r) * s.lane * off]
      g.position.set(x, 0, z)
      g.rotation.y = heading - Math.PI / 2
      // Stopped between two creeps: the arm out (a third of the drivers), the horn now and then.
      const still = since === null && (t - lag) % CYCLE > MOVE + 0.3
      arms[k].current = s.arm && still ? 1 : 0
      const hk = (honk.current[k] = Math.max(0, (honk.current[k] ?? 0) - dt))
      const l = lights.current[k]
      if (l) l.visible = hk > 0 && Math.floor(hk * 8) % 2 === 0
      const [hw, hd] = HALF[s.kind]
      moveObstacle(s.key, { x, z, hw, hd, rot: g.rotation.y })
    })
    // The horns: someone in the jam every second or two, louder the nearer the Sim; a few happy ones as it clears.
    if (t > nextHorn.current && (since === null || since < 6)) {
      const k = Math.floor(Math.random() * slots.length)
      const g = refs.current[k]
      if (g?.visible) {
        honk.current[k] = 0.6
        const d = Math.hypot(g.position.x - whereabouts.sim[0], g.position.z - whereabouts.sim[1])
        ambience.horn(Math.max(0, 1 - d / 90), Math.random() < 0.12)
      }
      nextHorn.current = t + (since === null ? 0.9 + Math.random() * 1.8 : 0.5 + Math.random())
    }
    if (since !== null && (shown === 0 || since > 25) && !told.current) {
      told.current = true
      onCleared()
    }
  })
  useEffect(() => () => slots.forEach((s) => moveObstacle(s.key, null)), [slots])
  return (
    <group>
      {slots.map((s, k) => {
        const len = HALF[s.kind][0] * 2
        return (
          <group key={s.key} ref={(g) => void (refs.current[k] = g)}>
            <Vehicle p={[0, 0, 0]} kind={s.kind} color={s.color} seed={s.seed} />
            <group ref={(g) => void (lights.current[k] = g)} visible={false}>
              <Box p={[len / 2 + 0.02, 0.62, 0.55]} s={[0.06, 0.18, 0.3]} c="#fff3b0" glow={2} />
              <Box p={[len / 2 + 0.02, 0.62, -0.55]} s={[0.06, 0.18, 0.3]} c="#fff3b0" glow={2} />
            </group>
            {s.arm && <DriverArm out={arms[k]} at={[0.15, 0.95, -0.92]} />}
          </group>
        )
      })}
    </group>
  )
}
