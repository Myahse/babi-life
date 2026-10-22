import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { Sim } from '../../lib/types'
import { worldTime } from '../../lib/worldClock'
import type { Pose } from '../../avatar/Human'
import { Character } from '../Character'
import { Swimmer } from '../Swimmer'
import { gridWay } from '../gridPath'
import { listenKeys, moveInput } from '../input'

// What the big places walked through share (the Hôtel Ivoire, the malls):
// the Sim walking round what's in the way to where something is done, or
// where it's tapped or steered, the camera coming along; the signs; the
// materials by colour.

export type XZ = [number, number]

/**
 * Where an action is done: the spot, the way the Sim faces there, its pose
 * (and its height: a seat, a bed). `from`: where it walks to first (else a
 * step in front). Or swimming lengths (`swim`: half the length), or going
 * round and round an ellipse (`loop`: window-shopping, pushing a
 * trolley along the aisles), at `speed`.
 */
export type Spot = { at: XZ; rot: number; pose: Pose; y?: number; lying?: boolean; swim?: number; from?: XZ; loop?: { c: XZ; r: XZ; speed: number; pose?: Pose; lean?: number } }

const SPEED = 1.9

const mats = new Map<string, THREE.MeshLambertMaterial>()
/** A plain material by colour (and glow), shared. */
export const mat = (c: string, emissive?: string) => {
  const k = c + (emissive ?? '')
  let m = mats.get(k)
  if (!m) mats.set(k, (m = new THREE.MeshLambertMaterial({ color: c, emissive: emissive ?? '#000000', emissiveIntensity: emissive ? 1 : 0 })))
  return m
}

/** A sign on a canvas: a name over a background. */
export function sign(text: string, bg: string, fg: string, w = 512, h = 128) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  g.fillStyle = bg
  g.fillRect(0, 0, w, h)
  g.fillStyle = fg
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = `800 ${h * 0.5}px sans-serif`
  const k = Math.min(1, (w * 0.9) / g.measureText(text).width)
  g.font = `800 ${h * 0.5 * k}px sans-serif`
  g.fillText(text, w / 2, h / 2)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return new THREE.MeshBasicMaterial({ map: t })
}

/** Where the Sim walks to before settling on a spot. */
function approach(s: Spot): XZ {
  if (s.from) return s.from
  if (s.loop) return [s.loop.c[0] + s.loop.r[0], s.loop.c[1]]
  return [s.at[0] + Math.sin(s.rot) * 0.9, s.at[1] + Math.cos(s.rot) * 0.9]
}

/**
 * The way the Sim goes: to the spot of what it's doing, or where it's
 * tapped; the keys and the pad while just walking about (on from the door).
 */
export function useBigWalk(spot: Spot | null, interactionId: string | undefined, roam: boolean | undefined, free: (x: number, z: number) => boolean, entrance: XZ) {
  const [tapped, setTapped] = useState<XZ | null>(null)
  useEffect(() => {
    setTapped(null)
  }, [interactionId])
  useEffect(() => (roam && !interactionId ? listenKeys() : undefined), [roam, interactionId])
  const where = useRef<XZ>(entrance)
  const way = useMemo<XZ[]>(() => {
    const to: XZ | null = spot ? approach(spot) : tapped
    const from = where.current
    if (!to) return [from]
    return gridWay(from, to, free, 0.5, 12, 300 * 300) ?? [from, to]
  }, [spot, tapped]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    where.current = way[way.length - 1]
  }, [way])
  const tap = (p: XZ) => {
    if (free(p[0], p[1])) setTapped(p)
  }
  const onMoved = (p: XZ) => {
    where.current = p
    setTapped(null)
  }
  return { way, tap, onMoved }
}

/** The Sim: walks its way (or where the keys take it), then settles, swims or goes round its loop; the camera follows. */
export function Guest({ sim, stage, way, spot, steer, onMoved, free, entrance, ground }: { sim: Sim; stage: string; way: XZ[]; spot: Spot | null; steer: boolean; onMoved: (at: XZ) => void; free: (x: number, z: number) => boolean; entrance: XZ; /** The floor's height where it walks (tiers, steps); flat at 0 without it. A spot's y is then its own height, not over the floor. */ ground?: (x: number, z: number) => number }) {
  const g = useRef<THREE.Group>(null)
  const camera = useThree((st) => st.camera)
  const controls = useThree((st) => st.controls) as unknown as { target: THREE.Vector3; update: () => void } | null
  const at = useRef({ x: entrance[0], z: entrance[1], rot: Math.PI })
  const step = useRef(1)
  const settle = useRef(0)
  const manual = useRef(false)
  const [walking, setWalking] = useState(false)
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    step.current = 1
    settle.current = 0
    setWalking(way.length > 1)
    setSettled(false)
  }, [way])
  useFrame((_, dtIn) => {
    const o = g.current
    if (!o) return
    const dt = Math.min(dtIn, 0.05)
    const a = at.current
    const m = steer ? moveInput() : null
    if (m && Math.hypot(m.x, m.y) > 0.15) {
      // The keys or the pad, as seen from the camera; along each axis on its own, to slide along what's in the way.
      const f = new THREE.Vector3()
      camera.getWorldDirection(f)
      const fl = Math.hypot(f.x, f.z) || 1
      const [fx, fz] = [f.x / fl, f.z / fl]
      const [mx, mz] = [fx * m.y - fz * m.x, fz * m.y + fx * m.x]
      if (free(a.x + mx * SPEED * dt, a.z)) a.x += mx * SPEED * dt
      if (free(a.x, a.z + mz * SPEED * dt)) a.z += mz * SPEED * dt
      const want = Math.atan2(mx, mz)
      a.rot += Math.atan2(Math.sin(want - a.rot), Math.cos(want - a.rot)) * Math.min(1, dt * 10)
      step.current = way.length
      if (!manual.current) {
        manual.current = true
        setWalking(true)
      }
    } else if (manual.current) {
      manual.current = false
      setWalking(false)
      onMoved([a.x, a.z])
    } else if (step.current < way.length) {
      const [tx, tz] = way[step.current]
      const [dx, dz] = [tx - a.x, tz - a.z]
      const len = Math.hypot(dx, dz)
      if (len < 0.05) {
        step.current++
        if (step.current >= way.length) setWalking(false)
      } else {
        const k = Math.min(len, SPEED * dt)
        a.x += (dx / len) * k
        a.z += (dz / len) * k
        const want = Math.atan2(dx, dz)
        a.rot += Math.atan2(Math.sin(want - a.rot), Math.cos(want - a.rot)) * Math.min(1, dt * 10)
      }
    } else if (spot && !spot.loop && settle.current < 1) {
      // From in front of the spot onto it: the seat, the bed, into the pool.
      settle.current = Math.min(1, settle.current + dt * 1.6)
      if (settle.current >= 1 && !settled) setSettled(true)
    }
    const e = spot && !spot.loop ? settle.current : 0
    const loop = spot?.loop
    if (loop && step.current >= way.length) {
      // Round and round (the aisles, the shop windows), facing the way it goes.
      const t = worldTime() * loop.speed
      o.position.set(loop.c[0] + Math.cos(t) * loop.r[0], loop.lean ? 0.12 : 0, loop.c[1] + Math.sin(t) * loop.r[1])
      o.rotation.set(0, Math.atan2(-Math.sin(t) * loop.r[0], Math.cos(t) * loop.r[1]), 0)
      ;[a.x, a.z] = [o.position.x, o.position.z]
    } else if (spot && e > 0) {
      const g0 = ground ? ground(a.x, a.z) : 0
      o.position.set(a.x + (spot.at[0] - a.x) * e, g0 + ((spot.y ?? (ground ? g0 : 0)) - g0) * e, a.z + (spot.at[1] - a.z) * e)
      o.rotation.set(0, a.rot + Math.atan2(Math.sin(spot.rot - a.rot), Math.cos(spot.rot - a.rot)) * e, 0)
    } else {
      // Up and down the steps, eased so a tier isn't a jump.
      const y = ground ? o.position.y + (ground(a.x, a.z) - o.position.y) * Math.min(1, dt * 12) : 0
      o.position.set(a.x, y, a.z)
      o.rotation.set(0, a.rot, 0)
    }
    // The camera comes along (up and down too, on tiers).
    if (controls) {
      const k = Math.min(1, dt * 3)
      const [ox, oz] = [(o.position.x - controls.target.x) * k, (o.position.z - controls.target.z) * k]
      const oy = ground ? (o.position.y + 1 - controls.target.y) * k : 0
      controls.target.x += ox
      controls.target.y += oy
      controls.target.z += oz
      camera.position.x += ox
      camera.position.y += oy
      camera.position.z += oz
      controls.update()
    }
  })
  const looping = !!spot?.loop && !walking
  const lean = looping ? (spot!.loop!.lean ?? 0) : 0
  return (
    <group ref={g}>
      {settled && spot?.swim ? (
        <Swimmer len={spot.swim} look={{ ...sim.look, outfit: 'maillot', accessory: 'none' }} gender={sim.gender} stage={stage} />
      ) : settled && spot ? (
        <group rotation={spot.lying ? [-Math.PI / 2, 0, 0] : [0, 0, 0]}>
          <Character look={sim.look} gender={sim.gender} pose={spot.pose} stage={stage} marker={!spot.lying} />
        </group>
      ) : (
        <group rotation={[0, 0, -lean]}>
          <Character look={sim.look} gender={sim.gender} walking={walking || looping} stage={stage} speed={looping ? 1.1 : SPEED} pose={looping ? spot!.loop!.pose : undefined} />
        </group>
      )}
    </group>
  )
}
