import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { NoShadows, type Pose } from '../../avatar/Human'
import { TalkHuman } from '../Talkable'
import { randomLook } from '../../avatar/options'
import { clearObstacles, setObstacles } from '../obstacles'
import { rng } from '../themes'
import { whereabouts } from '../whereabouts'
import { hash, type XZ } from './geo'
import type { Nav } from './nav'
import { lettering, signMaterial } from './ruePrincesse'

// The SITRA's bus stops along the big roads (the buses themselves drive in
// the traffic, OpenWorld's RoadTraffic): a shelter with its green roof and an
// ad panel at the back, a bench, the green sign with « SITRA » and the lines
// that stop there. People wait: a crowd at the rush hours (early morning and
// evening), a few the rest of the day, nobody late at night. Always at the
// same places along the same roads.

export type Stop = { id: string; at: XZ; rot: number; seed: number; lines: string[] }

const NEAR = 280 // metres: stops drawn around the Sim
const MAX = 6
const WIDE = 8 // only on roads at least this wide (most quarters have no 11 m road: no stop at all)

/** How many wait at the stop at an hour (0..1). */
const rush = (h: number) => (h < 5 || h >= 23 ? 0 : (h >= 6 && h < 9) || (h >= 17 && h < 20) ? 1 : 0.35)

/** Every stop along the loaded streets, always at the same places (the parked cars keep off them too: plateauLife.tsx). */
export function sotraStops(nav: Nav, seed: string): Stop[] {
  const out: Stop[] = []
  for (const e of nav.edges) {
    if (e.width < WIDE || e.walled || e.len < 60 || nav.ys[e.a] || nav.ys[e.b]) continue
    const [a, b] = [nav.nodes[e.a], nav.nodes[e.b]]
    const m: XZ = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    if (hash(Math.round(m[0]), Math.round(m[1]), 211) > 0.45) continue
    // On the right-hand side going from a to b, alternately (both directions get stops).
    const side = hash(Math.round(m[1]), Math.round(m[0]), 9) < 0.5 ? 1 : -1
    const [ux, uz] = [(b[0] - a[0]) / e.len, (b[1] - a[1]) / e.len]
    const off = e.width / 2 + 1.9
    const at: XZ = [m[0] - uz * off * side, m[1] + ux * off * side]
    if (!nav.walkable(at[0], at[1])) continue
    const r = rng(`sotra${Math.round(at[0])}:${Math.round(at[1])}`)
    const lines = [...new Set([...Array(2 + Math.floor(r() * 3))].map(() => String([2, 5, 8, 11, 12, 13, 18, 19, 23, 26, 27, 30, 34, 36, 40, 44, 49, 81, 82, 84][Math.floor(r() * 20)])))]
    out.push({ id: `sotra:${seed}:${Math.round(at[0])}:${Math.round(at[1])}`, at, rot: Math.atan2(uz * side, -ux * side), seed: hash(at[0], at[1]), lines })
  }
  return out
}

export function SotraStops({ nav, seed, hour, night }: { nav: Nav; seed: string; hour: number; night: boolean }) {
  const all = useMemo(() => sotraStops(nav, seed), [nav, seed])
  // The shelter is in the way (the bench, the posts, the back panel).
  useEffect(() => {
    setObstacles('sotra', all.map((s) => ({ x: s.at[0], z: s.at[1], hw: 1.8, hd: 0.5, rot: s.rot })))
    return () => clearObstacles('sotra')
  }, [all])

  const [shown, setShown] = useState<Stop[]>([])
  const tick = useRef(10)
  useFrame((_, dt) => {
    tick.current += dt
    if (tick.current < 1.5) return
    tick.current = 0
    const [sx, sz] = whereabouts.sim
    const near = all
      .map((s) => ({ s, d: Math.hypot(s.at[0] - sx, s.at[1] - sz) }))
      .filter((x) => x.d < NEAR)
      .sort((a, b) => a.d - b.d)
      .slice(0, MAX)
      .map((x) => x.s)
    if (near.map((s) => s.id).join() !== shown.map((s) => s.id).join()) setShown(near)
  })
  return (
    <>
      {shown.map((s) => (
        <BusStop key={s.id} stop={s} hour={hour} night={night} />
      ))}
    </>
  )
}

const lambert = (color: string) => new THREE.MeshLambertMaterial({ color })
const M = {
  green: lambert('#008f4c'),
  darkGreen: lambert('#0b5f36'),
  steel: lambert('#9aa3ad'),
  bench: lambert('#c9ced4'),
  ad: new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#fff4d6', emissiveIntensity: 0 }),
  curb: lambert('#bdb7aa'),
}
const BOX = new THREE.BoxGeometry(1, 1, 1)
const Box = ({ s, p, m, cast = true }: { s: [number, number, number]; p: [number, number, number]; m: THREE.Material; cast?: boolean }) => <mesh geometry={BOX} material={m} scale={s} position={p} castShadow={cast} receiveShadow />

/** An ad on the back panel: a phone network, a bank, a drink, painted in a few blocks. */
const ADS = ['#ff7a00', '#ffcc00', '#e4002b', '#00a3e0', '#6d28d9']

/** One stop. Local +z faces the road. */
export function BusStop({ stop, hour, night }: { stop: Stop; hour: number; night: boolean }) {
  const name = useMemo(() => lettering('SITRA', '#008f4c', '#ffffff', '#ffd43b'), [])
  const sign = useMemo(() => signMaterial(name.t), [name])
  const lines = useMemo(() => lettering(stop.lines.join(' '), '#ffffff', '#0b5f36', '#0b5f36'), [stop.lines])
  const linesMat = useMemo(() => new THREE.MeshLambertMaterial({ map: lines.t }), [lines])
  useEffect(() => {
    sign.emissiveIntensity = night ? 0.9 : 0
  }, [night, sign])
  const ad = ADS[Math.floor(stop.seed * ADS.length)]
  // Who waits: seeded, so the same people at the same stop.
  const people = useMemo(() => {
    const r = rng(stop.id)
    return [...Array(7)].map((_, i) => {
      const gender: 'femme' | 'homme' = r() < 0.5 ? 'femme' : 'homme'
      const pose: Pose = i === 1 ? 'sit' : (['idle', 'phone', 'talk', 'idle', 'phone'] as Pose[])[Math.floor(r() * 5)]
      // Seated on the bench, or standing about, turned towards where the bus comes from.
      const at: [number, number, number] = i === 1 ? [0.5, 0, -0.08] : [(r() - 0.5) * 5, 0, 0.6 + r() * 1.1]
      return { gender, look: randomLook(gender, r), pose, at, rot: i === 1 ? 0 : -Math.PI / 2 + (r() - 0.5) * 1.6, seed: r() * 100 }
    })
  }, [stop.id])
  const n = rush(hour) <= 0 ? 0 : Math.max(1, Math.round(people.length * rush(hour) * (0.6 + stop.seed * 0.4)))
  return (
    <group position={[stop.at[0], 0, stop.at[1]]} rotation={[0, stop.rot, 0]}>
      {/* The kerb of the stop's pad */}
      <Box s={[4.6, 0.12, 2.2]} p={[0, 0.06, 0.3]} m={M.curb} cast={false} />
      {/* Posts, the green roof, the back panel with its ad */}
      {[-1.6, 1.6].map((x) => (
        <Box key={x} s={[0.08, 2.5, 0.08]} p={[x, 1.25, -0.45]} m={M.steel} />
      ))}
      <Box s={[3.8, 0.1, 1.5]} p={[0, 2.55, 0.05]} m={M.green} />
      <Box s={[3.8, 0.18, 0.06]} p={[0, 2.46, 0.8]} m={M.darkGreen} />
      <Box s={[3.2, 1.6, 0.05]} p={[0, 1.3, -0.48]} m={M.steel} />
      <Box s={[1.3, 1.3, 0.02]} p={[-0.8, 1.35, -0.45]} m={M.ad} cast={false} />
      <Box s={[1.1, 0.35, 0.025]} p={[-0.8, 1.6, -0.44]} m={lambert(ad)} cast={false} />
      <Box s={[0.6, 0.5, 0.025]} p={[-0.8, 1.1, -0.44]} m={lambert(ADS[(Math.floor(stop.seed * ADS.length) + 2) % ADS.length])} cast={false} />
      {/* The bench along the back */}
      <Box s={[2.2, 0.06, 0.4]} p={[0.5, 0.45, -0.2]} m={M.bench} />
      {[-0.4, 1.4].map((x) => (
        <Box key={x} s={[0.06, 0.42, 0.06]} p={[x, 0.21, -0.2]} m={M.steel} />
      ))}
      {/* The sign on its pole: SITRA, and the lines */}
      <group position={[2.3, 0, 0.9]}>
        <Box s={[0.08, 2.8, 0.08]} p={[0, 1.4, 0]} m={M.steel} />
        <mesh geometry={BOX} material={sign} position={[0, 2.85, 0]} scale={[0.38 * name.aspect, 0.38, 0.06]} />
        <mesh geometry={BOX} material={linesMat} position={[0, 2.47, 0]} scale={[0.24 * lines.aspect, 0.24, 0.04]} />
      </group>
      <NoShadows>
        {people.slice(0, n).map((p, i) => (
          <group key={i} position={p.at} rotation={[0, p.rot, 0]}>
            <TalkHuman id={`sotra:144:${Math.round((p.seed) * 1000)}`} look={p.look} gender={p.gender} pose={p.pose} seed={p.seed} />
          </group>
        ))}
      </NoShadows>
    </group>
  )
}
