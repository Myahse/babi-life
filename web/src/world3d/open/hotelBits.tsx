import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Human, type Pose } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import type { Look } from '../../lib/types'
import { Lamp } from '../props'
import { rng } from '../themes'
import { BOX, Blocks } from './ruePrincesse'

// The small things around the big hotels' fronts, shared by the four of them
// (poulman, noum, azale, rabisson): the doorman and the guard, guests coming
// and going, luggage trolleys, lamps and bollards, the machines on the roofs,
// the loungers and parasols of the pools. Frame as the hotels': +z the street.

type V3 = [number, number, number]
type Block = { p: V3; s: V3; ry?: number; c?: string }

/** Who stands there: the doorman in his dark suit, the guard, or a guest dressed as they like. */
export type Staff = { p: V3; r?: number; who?: 'portier' | 'vigile' | 'client'; pose?: Pose }

const dress = (who: Staff['who'], r: () => number): Partial<Look> =>
  who === 'portier' ? { outfit: 'suit', outfitColor: '#1b1d22', accessory: 'none' } : who === 'vigile' ? { outfit: 'vigile', accessory: 'none', hair: 'short', beard: 'none' } : r() < 0.4 ? { outfit: 'suit', outfitColor: ['#14213d', '#495057', '#f1f3f5'][Math.floor(r() * 3)] } : {}

/** People standing about: the staff at their posts, guests chatting or on the phone. */
export function People({ at, seed }: { at: Staff[]; seed: string }) {
  const crowd = useMemo(() => {
    const r = rng(seed)
    return at.map((s) => {
      const gender = s.who === 'portier' || s.who === 'vigile' ? 'homme' : r() < 0.5 ? 'femme' : 'homme'
      return { ...s, gender, look: { ...randomLook(gender, r), ...dress(s.who, r) } as Look, seed: r() * 100 }
    })
  }, [at, seed])
  return (
    <>
      {crowd.map((c, i) => (
        <group key={i} position={c.p} rotation={[0, c.r ?? 0, 0]}>
          <Human look={c.look} gender={c.gender as 'homme' | 'femme'} pose={c.pose ?? 'idle'} seed={c.seed} />
        </group>
      ))}
    </>
  )
}

/** A guest walking to and fro between two points, turning at each end, a suitcase or not. */
export function Stroller({ from, to, seed, speed = 1.2, bag = false }: { from: [number, number]; to: [number, number]; seed: string; speed?: number; bag?: boolean }) {
  const g = useRef<THREE.Group>(null)
  const person = useMemo(() => {
    const r = rng(seed)
    const gender = r() < 0.5 ? 'femme' : 'homme'
    return { gender: gender as 'homme' | 'femme', look: { ...randomLook(gender, r), ...dress('client', r) } as Look, phase: r() }
  }, [seed])
  const len = Math.hypot(to[0] - from[0], to[1] - from[1])
  const angle = Math.atan2(to[0] - from[0], to[1] - from[1])
  useFrame(({ clock }) => {
    if (!g.current) return
    // A back-and-forth along the line: t runs 0→1→0, the heading flips at the turn.
    const u = ((clock.elapsedTime * speed) / len + person.phase) % 2
    const t = u < 1 ? u : 2 - u
    g.current.position.set(from[0] + (to[0] - from[0]) * t, 0, from[1] + (to[1] - from[1]) * t)
    g.current.rotation.y = u < 1 ? angle : angle + Math.PI
  })
  return (
    <group ref={g}>
      <Human look={person.look} gender={person.gender} pose="walk" seed={person.phase * 100} />
      {bag && <mesh geometry={BOX} position={[0.45, 0.35, -0.2]} scale={[0.3, 0.6, 0.45]} material={SUITCASE} />}
    </group>
  )
}

const SUITCASE = new THREE.MeshLambertMaterial({ color: '#3b3f46' })
const brass = new THREE.MeshLambertMaterial({ color: '#c9a227' })
const steel = new THREE.MeshLambertMaterial({ color: '#9aa0a6' })
const dark = new THREE.MeshLambertMaterial({ color: '#2b2e33' })
const canvasWhite = new THREE.MeshLambertMaterial({ color: '#f4f1ea' })
const COLORED = new THREE.MeshLambertMaterial({ color: '#ffffff' })

/** The bellboy's brass trolley under the awning, two or three cases on it. */
export function Trolley({ p, r = 0 }: { p: V3; r?: number }) {
  return (
    <group position={p} rotation={[0, r, 0]}>
      <Blocks
        at={[
          { p: [0, 0.25, 0], s: [0.9, 0.06, 1.5] },
          { p: [0, 1, -0.72], s: [0.06, 1.5, 0.06] },
          { p: [0, 1, 0.72], s: [0.06, 1.5, 0.06] },
          { p: [0, 1.75, 0], s: [0.06, 0.06, 1.5] },
        ]}
        material={brass}
      />
      <Blocks at={[{ p: [0, 0.6, -0.3], s: [0.5, 0.7, 0.7], c: '#7a1e1e' }, { p: [0, 0.55, 0.4], s: [0.45, 0.6, 0.55], c: '#343a40' }, { p: [0, 1.05, 0.4], s: [0.35, 0.3, 0.45], c: '#c08a4a' }]} material={COLORED} color />
    </group>
  )
}

/** Street lamps along a line, every `step` metres. */
export function Lamps({ from, to, step = 10, night }: { from: [number, number]; to: [number, number]; step?: number; night: boolean }) {
  const n = Math.max(1, Math.floor(Math.hypot(to[0] - from[0], to[1] - from[1]) / step))
  return (
    <>
      {[...Array(n + 1)].map((_, i) => (
        <Lamp key={i} p={[from[0] + ((to[0] - from[0]) * i) / n, 0, from[1] + ((to[1] - from[1]) * i) / n]} night={night} />
      ))}
    </>
  )
}

/** Short steel posts keeping the cars off the walk. */
export function Bollards({ from, to, step = 1.6 }: { from: [number, number]; to: [number, number]; step?: number }) {
  const at = useMemo(() => {
    const n = Math.max(1, Math.floor(Math.hypot(to[0] - from[0], to[1] - from[1]) / step))
    return [...Array(n + 1)].map((_, i): Block => ({ p: [from[0] + ((to[0] - from[0]) * i) / n, 0.45, from[1] + ((to[1] - from[1]) * i) / n], s: [0.22, 0.9, 0.22] }))
  }, [from, to, step])
  return <Blocks at={at} material={steel} />
}

/** The machines on a flat roof: rows of air-conditioning units, a water tank, the lift's housing, an aerial. */
export function RoofKit({ x0, x1, z0, z1, y, seed = 1 }: { x0: number; x1: number; z0: number; z1: number; y: number; seed?: number }) {
  const at = useMemo(() => {
    const out: Block[] = []
    const [w, d] = [x1 - x0, z1 - z0]
    // The units in a row along the back, a fan's grey top on each.
    for (let x = x0 + 1.5; x < x1 - 1.5; x += 2.4) out.push({ p: [x, y + 0.6, z0 + 1.5], s: [1.6, 1.2, 1.2], c: '#d9dcdf' })
    out.push({ p: [x0 + w * 0.3, y + 1.6, z0 + d * 0.55], s: [4, 3.2, 3.5], c: '#b9bdc2' })
    out.push({ p: [x0 + w * (0.65 + (seed % 3) * 0.08), y + 1.2, z0 + d * 0.6], s: [2.4, 2.4, 2.4], c: '#e9ecef' })
    out.push({ p: [x1 - 2, y + 3, z1 - 2], s: [0.12, 6, 0.12], c: '#6c757d' })
    return out
  }, [x0, x1, z0, z1, y, seed])
  return <Blocks at={at} material={COLORED} color />
}

/** A sun lounger, its back raised. */
const lounger = (x: number, z: number, ry: number): Block[] => {
  const [c, s] = [Math.cos(ry), Math.sin(ry)]
  const at = (dx: number, dz: number): [number, number] => [x + dx * c + dz * s, z - dx * s + dz * c]
  const [a, b] = [at(0, 0.2), at(0, -0.75)]
  return [
    { p: [a[0], 0.35, a[1]], s: [0.7, 0.12, 1.5], ry },
    { p: [b[0], 0.6, b[1]], s: [0.7, 0.5, 0.12], ry },
  ]
}

/** Loungers in a row with a parasol between each pair: a pool's deck. */
export function Loungers({ from, to, y = 0, ry = 0, n = 6 }: { from: [number, number]; to: [number, number]; y?: number; ry?: number; n?: number }) {
  const { beds, poles, tops } = useMemo(() => {
    const beds: Block[] = []
    const poles: Block[] = []
    const tops: { p: V3 }[] = []
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1)
      const [x, z] = [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]
      beds.push(...lounger(x, z, ry))
      if (i % 2 === 1) {
        const [px, pz] = [x - (to[0] - from[0]) / (2 * Math.max(1, n - 1)), z - (to[1] - from[1]) / (2 * Math.max(1, n - 1))]
        poles.push({ p: [px, 1.2, pz], s: [0.08, 2.4, 0.08] })
        tops.push({ p: [px, 2.4, pz] })
      }
    }
    return { beds, poles, tops }
  }, [from, to, ry, n])
  return (
    <group position={[0, y, 0]}>
      <Blocks at={beds} material={canvasWhite} />
      <Blocks at={poles} material={dark} />
      {tops.map((t, i) => (
        <mesh key={i} position={t.p} material={canvasWhite}>
          <coneGeometry args={[1.5, 0.6, 8]} />
        </mesh>
      ))}
    </group>
  )
}

/** The guard's booth at the gate: a small white cabin with a window, lit inside at night. */
export function Booth({ p, r = 0, night }: { p: V3; r?: number; night: boolean }) {
  const glass = useMemo(() => new THREE.MeshLambertMaterial({ color: night ? '#ffe2a0' : '#7fa6c2', emissive: '#ffcf8a', emissiveIntensity: night ? 0.9 : 0 }), [night])
  return (
    <group position={p} rotation={[0, r, 0]}>
      <mesh geometry={BOX} position={[0, 1.3, 0]} scale={[2, 2.6, 2]} material={canvasWhite} castShadow />
      <mesh geometry={BOX} position={[0, 2.75, 0]} scale={[2.5, 0.3, 2.5]} material={dark} />
      <mesh position={[0, 1.6, 1.01]} material={glass}>
        <planeGeometry args={[1.5, 1]} />
      </mesh>
      {/* The barrier arm, red and white, across the drive */}
      <Blocks at={[{ p: [2.6, 1, 1.2], s: [4, 0.12, 0.12], c: '#e03131' }, { p: [0.9, 0.5, 1.2], s: [0.3, 1, 0.3], c: '#495057' }]} material={COLORED} color />
    </group>
  )
}

/** White stripes of parking bays along x, from x0, `n` of them, `w` wide, `d` deep. */
export function Bays({ x0, z, n, w = 2.6, d = 5 }: { x0: number; z: number; n: number; w?: number; d?: number }) {
  const at = useMemo(() => [...Array(n + 1)].map((_, i): Block => ({ p: [x0 + i * w, 0.04, z], s: [0.12, 0.02, d] })), [x0, z, n, w, d])
  return <Blocks at={at} material={canvasWhite} />
}
