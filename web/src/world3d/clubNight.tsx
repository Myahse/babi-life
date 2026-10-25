import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Human, NoShadows, type Pose } from '../avatar/Human'
import { randomLook } from '../avatar/options'
import { worldTime } from '../lib/worldClock'
import { NoteShower } from './money'
import { rng } from './themes'
import { TalkHuman } from './Talkable'
import { Vehicle } from './vehicles'

// Friday night at the club: every club in town is full. Outside, the queue
// past the rope, the vigiles, the big cars parked in front; inside, the
// floor packed, the VIP corners with their bottles of champagne coming
// with the sparklers, and the grands-frères doing the travaillement on the
// dancers. Saturday night is nearly as full; the other nights a few people.
// From the shared clock, so every player sees the same Friday.

/** How full the clubs are now (0..1): Friday night (into Saturday morning) packed. */
export function clubFill(t = worldTime()) {
  const day = Math.floor(t / 86400) % 7
  const h = (t / 3600) % 24
  // The night belongs to the day it started on.
  const night = h < 5 ? (day + 6) % 7 : day
  const late = h >= 22 || h < 5
  const open = h >= 21 || h < 5
  if (!open) return 0
  if (night === 4) return late ? 1 : 0.6 // vendredi
  if (night === 5) return late ? 0.85 : 0.5 // samedi
  return late ? 0.3 : 0.15
}

/** clubFill, checked every few seconds. */
export function useClubFill() {
  const [fill, setFill] = useState(() => clubFill())
  const tick = useRef(0)
  useFrame((_, dt) => {
    tick.current += dt
    if (tick.current < 5) return
    tick.current = 0
    const f = clubFill()
    if (f !== fill) setFill(f)
  })
  return fill
}

const lambert = (color: string) => new THREE.MeshLambertMaterial({ color })
const M = {
  glass: new THREE.MeshLambertMaterial({ color: '#1f4d2b', emissive: '#0c2a14', emissiveIntensity: 0.4 }),
  gold: new THREE.MeshLambertMaterial({ color: '#e0b84a', emissive: '#7a5a10', emissiveIntensity: 0.6 }),
  whisky: new THREE.MeshLambertMaterial({ color: '#8a4b14', emissive: '#3a1a04', emissiveIntensity: 0.5 }),
  label: lambert('#f4efe6'),
  bucket: new THREE.MeshStandardMaterial({ color: '#d8d8de', metalness: 0.9, roughness: 0.2 }),
  ice: new THREE.MeshLambertMaterial({ color: '#e7f5ff', emissive: '#9fd8ff', emissiveIntensity: 0.3 }),
  stick: lambert('#c9ced4'),
  spark: new THREE.MeshBasicMaterial({ color: '#fff3c4' }),
  tray: lambert('#c0c7cf'),
  table: lambert('#141416'),
  rope: lambert('#b42318'),
  post: new THREE.MeshStandardMaterial({ color: '#e0b84a', metalness: 0.9, roughness: 0.3 }),
}
const BOX = new THREE.BoxGeometry(1, 1, 1)
const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 10)

/** A bottle of champagne (gold neck) or whisky, standing. */
export function Bottle({ p, whisky = false }: { p: [number, number, number]; whisky?: boolean }) {
  return (
    <group position={p}>
      <mesh geometry={CYL} material={whisky ? M.whisky : M.glass} position={[0, 0.13, 0]} scale={[0.09, 0.26, 0.09]} />
      <mesh geometry={CYL} material={whisky ? M.whisky : M.glass} position={[0, 0.3, 0]} scale={[0.035, 0.1, 0.035]} />
      {!whisky && <mesh geometry={CYL} material={M.gold} position={[0, 0.33, 0]} scale={[0.04, 0.06, 0.04]} />}
      <mesh geometry={CYL} material={M.label} position={[0, 0.12, 0]} scale={[0.092, 0.08, 0.092]} />
    </group>
  )
}

/** A sparkler on a bottle: a bright head that flickers, and sparks around it. */
export function Sparkler({ p }: { p: [number, number, number] }) {
  const head = useRef<THREE.Mesh>(null)
  const sparks = useRef<THREE.Group>(null)
  const light = useRef<THREE.PointLight>(null)
  useFrame(() => {
    const t = worldTime() * 1000
    const f = 0.8 + 0.4 * Math.abs(Math.sin(t * 0.031) * Math.sin(t * 0.017))
    if (head.current) head.current.scale.setScalar(0.05 * f)
    if (light.current) light.current.intensity = 2.2 * f
    sparks.current?.children.forEach((c, i) => {
      const k = ((t / 400 + i * 0.37) % 1 + 1) % 1
      const a = i * 2.4
      c.position.set(Math.cos(a) * k * 0.18, k * 0.12 - k * k * 0.2, Math.sin(a) * k * 0.18)
      c.scale.setScalar(0.018 * (1 - k))
    })
  })
  return (
    <group position={p}>
      <mesh geometry={CYL} material={M.stick} position={[0, 0.1, 0]} scale={[0.01, 0.2, 0.01]} />
      <group position={[0, 0.22, 0]}>
        <mesh ref={head} geometry={BOX} material={M.spark} />
        <group ref={sparks}>
          {[...Array(8)].map((_, i) => (
            <mesh key={i} geometry={BOX} material={M.spark} />
          ))}
        </group>
        <pointLight ref={light} color="#ffd36b" distance={3} intensity={2} />
      </group>
    </group>
  )
}

/** The VIP table: an ice bucket, champagne, a whisky, glasses; the sparklers when the bottles come. */
export function VipTable({ p, r = 0, sparklers = true }: { p: [number, number, number]; r?: number; sparklers?: boolean }) {
  return (
    <group position={p} rotation={[0, r, 0]}>
      <mesh geometry={BOX} material={M.table} position={[0, 0.22, 0]} scale={[1.1, 0.44, 0.6]} />
      <mesh geometry={CYL} material={M.bucket} position={[-0.25, 0.56, 0]} scale={[0.3, 0.24, 0.3]} />
      <mesh geometry={CYL} material={M.ice} position={[-0.25, 0.67, 0]} scale={[0.26, 0.03, 0.26]} />
      <group position={[-0.25, 0.5, 0]} rotation={[0, 0, 0.35]}>
        <Bottle p={[0.03, 0, 0]} />
      </group>
      <Bottle p={[0.12, 0.44, 0.08]} />
      <Bottle p={[0.36, 0.44, -0.1]} whisky />
      {[[0.3, 0.15], [0.45, 0.15], [0.05, -0.18]].map(([x, z], i) => (
        <mesh key={i} geometry={CYL} material={M.ice} position={[x, 0.5, z]} scale={[0.05, 0.12, 0.05]} />
      ))}
      {sparklers && <Sparkler p={[0.12, 0.8, 0.08]} />}
    </group>
  )
}

/** The waitress bringing the bottles: the tray over her head, a bottle on it, its sparkler lit. */
export function BottleGirl({ p, r = 0, seed }: { p: [number, number, number]; r?: number; seed: number }) {
  const look = useMemo(() => ({ ...randomLook('femme', rng(`bottle${seed}`)), outfit: 'robe', outfitColor: '#17171a' }), [seed])
  return (
    <group position={p} rotation={[0, r, 0]}>
      <Human look={look} gender="femme" pose="cheer" seed={seed} />
      <mesh geometry={BOX} material={M.tray} position={[0, 2.12, 0.05]} scale={[0.45, 0.03, 0.45]} />
      <Bottle p={[0, 2.14, 0.05]} />
      <Sparkler p={[0, 2.45, 0.05]} />
    </group>
  )
}

type Guest = { p: [number, number, number]; r: number; pose: Pose; gender: 'femme' | 'homme'; look: ReturnType<typeof randomLook>; seed: number; at: number }

/**
 * The club inside, filled for the night: more dancers on the floor, the VIP
 * sofas taken, the bottles with their sparklers, men at the bar, and (on
 * the big nights) grands-frères throwing notes on the dancers. In the club
 * room's frame (Interior's): the floor around (1.5, 0.5), the DJ at the back
 * (z -3.7), the sofas along x -4.4, the bar along the back wall at x -3.4 (clubDecor.tsx).
 */
export function ClubCrowd({ placeId, fill: fixed }: { placeId: string; /** How full, whatever the hour (a player's soirée). */ fill?: number }) {
  const clubFill = useClubFill()
  const fill = fixed ?? clubFill
  const guests = useMemo<Guest[]>(() => {
    const r = rng(`club${placeId}`)
    const out: Guest[] = []
    const add = (p: [number, number, number], rot: number, pose: Pose, at: number, gender?: 'femme' | 'homme') => {
      const g = gender ?? (r() < 0.55 ? 'femme' : 'homme')
      // Dressed for the night: the shirt, the dress, the bazin, the blouson.
      const look = randomLook(g, r)
      const outfit = g === 'femme' ? ['robe', 'jupe', 'casual', 'kaba'][Math.floor(r() * 4)] : ['chemise', 'suit', 'bazin', 'blouson', 'chemise-pagne'][Math.floor(r() * 5)]
      out.push({ p, r: rot, pose, gender: g, look: { ...look, outfit }, seed: r() * 100, at })
    }
    // The floor: dancers in a loose ring around the middle, more the fuller.
    for (let i = 0; i < 14; i++) {
      const a = i * 2.39996
      const d = 0.9 + Math.sqrt(i) * 0.55
      add([1.5 + Math.cos(a) * d * 1.2, 0, 0.5 + Math.sin(a) * d * 0.85], a + Math.PI, i % 5 === 4 ? 'cheer' : 'dance', 0.15 + (i / 14) * 0.85)
    }
    // The VIP sofas: men with their bottles, the girls with them.
    // (The middle seats are the Sim's and the room's own regular.)
    for (const z of [-2, 2]) for (const k of [-1, 1]) add([-4.2, 0.05, z + k * 0.65], Math.PI / 2, k < 0 ? 'drink' : 'sit', z < 0 ? 0.3 : 0.55, k < 0 ? 'homme' : 'femme')
    // At the bar, standing with a glass.
    for (let k = 0; k < 3; k++) add([-1.3 - k * 0.7, 0, -2.85], Math.PI + (r() - 0.5) * 0.6, k === 2 ? 'talk' : 'drink', 0.4 + k * 0.2)
    return out
  }, [placeId])
  // The grands-frères of the night, throwing notes on the floor from its edge.
  const throwers = useMemo(() => {
    const r = rng(`clubtrav${placeId}`)
    return [
      { p: [-1.3, 0, 2.2] as [number, number, number], r: 1.9, look: { ...randomLook('homme', r), outfit: 'bazin', outfitColor: '#f8f9fa', accessory: 'sunglasses' }, seed: r() * 100 },
      { p: [3.8, 0, -1.6] as [number, number, number], r: -1.1, look: { ...randomLook('homme', r), outfit: 'suit', accessory: 'watch' }, seed: r() * 100 },
    ]
  }, [placeId])
  if (fill <= 0) return null
  const big = fill >= 0.85
  return (
    <group>
      <NoShadows>
        {guests
          .filter((g) => g.at <= fill)
          .map((g, i) => (
            <group key={i} position={g.p} rotation={[0, g.r, 0]}>
              <TalkHuman id={`club-${placeId}-${i}`} look={g.look} gender={g.gender} pose={big && g.pose === 'dance' && i % 3 === 0 ? 'cheer' : g.pose} seed={g.seed} />
            </group>
          ))}
        {big &&
          throwers.map((t, i) => (
            <group key={`t${i}`} position={t.p} rotation={[0, t.r, 0]}>
              <TalkHuman id={`club-${placeId}-t${i}`} look={t.look} gender="homme" pose="throw" seed={t.seed} />
              <NoteShower from={[0.3, 1.72, 0.3]} toward={[0, 0.35, 1]} rate={i ? 2.6 : 3.6} fan={4} seed={i + 21} />
            </group>
          ))}
        {fill >= 0.5 && <BottleGirl p={[-2.6, 0, 0.2]} r={-Math.PI / 2} seed={placeId.length + 3} />}
      </NoShadows>
      {/* The VIP tables in front of the sofas: the bottles out from the evening, the sparklers on the big nights */}
      {fill >= 0.3 && <VipTable p={[-3.3, 0, -2]} r={Math.PI / 2} sparklers={big} />}
      {fill >= 0.55 && <VipTable p={[-3.3, 0, 2]} r={Math.PI / 2} sparklers={big} />}
    </group>
  )
}

/**
 * The club's front on its big nights: the queue along the wall behind the
 * red rope, the vigiles at the door, the big cars parked in front, and a
 * grand-frère already throwing notes at the door. In Dressing's frame: the
 * door at x 0, the street towards +z.
 */
export function ClubFront({ seed, fill, near }: { seed: number; fill: number; near: boolean }) {
  const people = useMemo(() => {
    const r = rng(`clubfront${seed}`)
    return [...Array(14)].map((_, i) => {
      const gender: 'femme' | 'homme' = r() < 0.5 ? 'femme' : 'homme'
      const look = randomLook(gender, r)
      const outfit = gender === 'femme' ? ['robe', 'jupe', 'casual'][Math.floor(r() * 3)] : ['chemise', 'bazin', 'blouson', 'suit'][Math.floor(r() * 4)]
      return { gender, look: { ...look, outfit }, seed: r() * 100, pose: (['idle', 'phone', 'talk', 'idle', 'dance'] as Pose[])[Math.floor(r() * 5)], at: (i + 1) / 14, jitter: (r() - 0.5) * 0.3 }
    })
  }, [seed])
  const vigile = useMemo(() => ({ ...randomLook('homme', rng(`vigile${seed}`)), outfit: 'vigile' }), [seed])
  const boss = useMemo(() => ({ ...randomLook('homme', rng(`boss${seed}`)), outfit: 'bazin', outfitColor: '#f8f9fa', accessory: 'sunglasses' }), [seed])
  if (fill <= 0) return null
  const big = fill >= 0.85
  const CARS = ['#17171a', '#f8f9fa', '#9aa3ad']
  return (
    <group>
      {/* The rope and its golden posts, along the wall */}
      {[...Array(6)].map((_, i) => (
        <mesh key={i} geometry={CYL} material={M.post} position={[3 + i * 1.6, 0.45, 0.9]} scale={[0.08, 0.9, 0.08]} />
      ))}
      <mesh geometry={BOX} material={M.rope} position={[3 + 2.5 * 1.6, 0.82, 0.9]} scale={[8, 0.05, 0.05]} />
      {near && (
        <NoShadows>
          {/* The vigiles at the door */}
          {[-1.2, 1.2].map((x) => (
            <group key={x} position={[x, 0, 0.8]}>
              <TalkHuman id={`clubdoor-${seed}-${x}`} look={vigile} gender="homme" pose="idle" seed={seed * 10 + x} />
            </group>
          ))}
          {/* The queue: longer the fuller */}
          {people
            .filter((p) => p.at <= fill)
            .map((p, i) => (
              <group key={i} position={[2.4 + i * 0.75, 0, 0.35 + p.jitter]} rotation={[0, -Math.PI / 2 + p.jitter, 0]}>
                <TalkHuman id={`clubqueue-${seed}-${i}`} look={p.look} gender={p.gender} pose={p.pose} seed={p.seed} />
              </group>
            ))}
          {/* A grand-frère at the door, the notes already flying */}
          {big && (
            <group position={[-0.4, 0, 2.6]} rotation={[0, Math.PI * 0.8, 0]}>
              <TalkHuman id={`clubboss-${seed}`} look={boss} gender="homme" pose="throw" seed={seed} />
              <NoteShower from={[0.3, 1.72, 0.3]} toward={[0, 0.35, 1]} rate={2} fan={3} keep={6} seed={Math.floor(seed * 100)} />
            </group>
          )}
        </NoShadows>
      )}
      {/* The big cars parked in front */}
      {fill >= 0.5 &&
        CARS.slice(0, big ? 3 : 1).map((c, i) => (
          <group key={i} position={[-6 + i * 5.2, 0, 5.2]}>
            <Vehicle p={[0, 0, 0]} kind="car" color={c} seed={i} />
          </group>
        ))}
    </group>
  )
}
