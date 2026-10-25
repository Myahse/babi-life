import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { Human, NoShadows, type Pose } from '../avatar/Human'
import { randomLook } from '../avatar/options'
import type { Look } from '../lib/types'
import { iconFor } from '../components/icons'
import { IconTile } from '../components/ui'
import { rng } from './themes'
import { SIDEWALK } from './layout'
import { Box, Mat, Sign } from './props'
import { Vehicle } from './vehicles'
import { Basket, Football } from './matches'
import { worldTime } from '../lib/worldClock'

// What is going on in the street right now (see backend/internal/game/happenings.go),
// staged on the boulevard around HAPPENING_X so the player can find it.

type XZ = [number, number]

export const HAPPENING_X = 18
/** Where the player's Sim stands to join in. */
export const HAPPENING_DOOR: [number, number] = [HAPPENING_X - 5, SIDEWALK]
/** Happenings that close the boulevard to the usual traffic (their tents, stage or procession are on it). */
export const STOPS_TRAFFIC = new Set(['mariage', 'match', 'concert', 'foot', 'controle', 'embouteillage', 'basket', 'bapteme', 'anniversaire', 'funerailles', 'association', 'tontine', 'ouverture-boutique', 'ligue1', 'inondation', 'femua', 'abissa', 'carnaval-bouake', 'fete-masques', 'fete-independance', 'fete-paix', 'fete-travail', 'noel', 'nouvel-an', 'korite', 'tabaski'])

/**
 * Where the player's Sim goes once it joins in, what it faces and how (in the scene's frame, x from
 * HAPPENING_X): a seat among the guests, a place in the crowd, its broom on the gutter. Without one,
 * the Sim stood at the door doing the generic busy arms, alone on the pavement.
 */
export type HappeningRole = { at: XZ; face: XZ; pose: Pose; /** A plastic chair under it (the scene puts it there). */ chair?: boolean; /** In hand: the scene puts it by the Sim. */ tool?: 'broom' | 'shovel'; /** On the move with the scene (the wedding cortège): where it is at a time, and which way it goes. */ moving?: (t: number) => { x: number; z: number; h: number } }
const role = (x: number, z: number, fx: number, fz: number, pose: Pose, more: Partial<HappeningRole> = {}): HappeningRole => ({ at: [HAPPENING_X + x, z], face: [HAPPENING_X + fx, fz], pose, ...more })
export const HAPPENING_ROLES: Record<string, HappeningRole> = {
  mariage: role(-4.2, 5, -4.2, 0, 'dance', { moving: (t) => inCortege(t, CORTEGE_SIM.gap, CORTEGE_SIM.lat) }),
  match: role(-4.6, 4.9, 0, -3.6, 'cheer'),
  concert: role(-4.4, 4.7, 0, -3.4, 'dance'),
  delestage: role(-4.2, 5.4, -3, 7.2, 'talk'),
  bapteme: role(-3.6, 4.1, -3.6, 0, 'sit', { chair: true }),
  anniversaire: role(-3.8, 4.5, 0, 2.2, 'clap'),
  funerailles: role(-3.6, 4.1, -3.6, 0, 'sit', { chair: true }),
  association: role(-3.6, 3.9, 0, -1.2, 'sit', { chair: true }),
  tontine: role(-2.9, 3.7, -2, 2.8, 'sit', { chair: true }),
  salubrite: role(-4, 5.3, -2, 5.3, 'busy', { tool: 'broom' }),
  'ouverture-boutique': role(-4.2, 5, 0, 2, 'clap'),
  ligue1: role(-4.3, 5.3, -4.3, 0, 'cheer'),
  inondation: role(-4, 5.1, -4, 3, 'busy', { tool: 'shovel' }),
  femua: role(-4.4, 4.7, 0, -3.4, 'dance'),
  abissa: role(-3.8, 4.5, 0, 1, 'dance'),
  'carnaval-bouake': role(-4.3, 5.3, -4.3, 0, 'cheer'),
  'fete-masques': role(-4, 4.9, 0, 1, 'clap'),
  'fete-independance': role(-4, 4.9, 0, 1.5, 'cheer'),
  'fete-paix': role(-4, 4.7, -2.9, 4.7, 'talk'),
  'fete-travail': role(-3.7, 3.2, -2.5, 3.2, 'drink', { chair: true }),
  noel: role(-4, 4.7, -2.7, 3.9, 'wave'),
  'nouvel-an': role(-4, 4.7, -3.1, 4.7, 'hug'),
  korite: role(-3, 3.2, -2, 3.2, 'eat', { chair: true }),
  tabaski: role(-3, 3.2, -2, 3.2, 'eat', { chair: true }),
}

type Person = { gender: 'femme' | 'homme'; look: Look; seed: number }

function useCrowd(n: number, seed: string, dress?: (r: () => number, gender: Person['gender']) => Partial<Look>) {
  return useMemo<Person[]>(() => {
    const r = rng(seed)
    return [...Array(n)].map(() => {
      const gender: Person['gender'] = r() < 0.5 ? 'femme' : 'homme'
      return { gender, look: { ...randomLook(gender, r), ...dress?.(r, gender) }, seed: r() * 100 }
    })
  }, [n, seed]) // eslint-disable-line react-hooks/exhaustive-deps
}

function Guest({ p, r = 0, person, pose, scale = 1 }: { p: [number, number, number]; r?: number; person: Person; pose: Pose; scale?: number }) {
  return (
    <group position={p} rotation={[0, r, 0]} scale={scale}>
      <Human look={person.look} gender={person.gender} pose={pose} seed={person.seed} />
    </group>
  )
}

/* ---------- Wedding procession ---------- */

/**
 * The cortège's round on the street (in the scene's frame, x from
 * HAPPENING_X): up one lane, round at the end, back down the other, round
 * again, at a walk; everyone in it a little way behind the one ahead, so it
 * goes round in one piece. (It went one way only and jumped back to the
 * start, passing and passing again in front of the Sim who danced with it.)
 */
const CORTEGE = { half: 30, lane: 2, speed: 1.4 }
const CORTEGE_ROUND = 4 * CORTEGE.half + 2 * Math.PI * CORTEGE.lane
/** The point of the round `s` metres along it, and the way it goes there (an angle, as rotation.y). */
function cortegeAt(s: number): { x: number; z: number; h: number } {
  const { half, lane: R } = CORTEGE
  const turn = Math.PI * R
  let k = ((s % CORTEGE_ROUND) + CORTEGE_ROUND) % CORTEGE_ROUND
  if (k < 2 * half) return { x: -half + k, z: R, h: Math.PI / 2 }
  k -= 2 * half
  if (k < turn) {
    const a = k / R
    return { x: half + Math.sin(a) * R, z: Math.cos(a) * R, h: Math.PI / 2 + a }
  }
  k -= turn
  if (k < 2 * half) return { x: half - k, z: -R, h: -Math.PI / 2 }
  const a = (k - 2 * half) / R
  return { x: -half - Math.sin(a) * R, z: -Math.cos(a) * R, h: -Math.PI / 2 + a }
}
/** Where one of the cortège is at time t: `gap` metres behind its head, `lat` to its side. */
export function inCortege(t: number, gap: number, lat: number): { x: number; z: number; h: number } {
  const p = cortegeAt(t * CORTEGE.speed - gap)
  // (Its left: the way it goes turned a quarter.)
  return { x: HAPPENING_X + p.x + Math.cos(p.h) * lat, z: p.z - Math.sin(p.h) * lat, h: p.h }
}
/** The Sim dancing with it: in the family's ranks, at their side. */
export const CORTEGE_SIM = { gap: 21.5, lat: -1.3 }

/** Who's in the cortège, from its head: the cars (pink ribbons), the bride and groom, the family. */
const CARS = [0, 6.5, 13]

function Wedding({ seed }: { seed: string }) {
  // The family all wear the same pagne, chosen for the wedding.
  const crowd = useCrowd(9, `wed${seed}`, (_, g) => ({ outfit: g === 'femme' ? 'pagne' : 'boubou', outfitColor: '#7b5cff', pattern: 'feuilles', hair: g === 'femme' ? 'headwrap' : 'short' }))
  const couple = useMemo<Person[]>(
    () => [
      { gender: 'femme', look: { ...randomLook('femme', rng(`bride${seed}`)), outfit: 'robe', outfitColor: '#f4efe6', pattern: 'cercles', hair: 'bun', accessory: 'earrings' }, seed: 1 },
      { gender: 'homme', look: { ...randomLook('homme', rng(`groom${seed}`)), outfit: 'suit', outfitColor: '#14213d', accessoryColor: '#f2b705', accessory: 'none' }, seed: 2 },
    ],
    [seed],
  )
  // Each one's place in it: behind the head, and to the side (the family three abreast).
  const ranks = useMemo(() => [...CARS.map((gap) => ({ gap, lat: 0 })), { gap: 17, lat: 0.6 }, { gap: 17, lat: -0.6 }, ...crowd.map((_, i) => ({ gap: 19.5 + Math.floor(i / 3) * 1.4 + (i % 2) * 0.3, lat: ((i % 3) - 1) * 0.9 }))], [crowd])
  const refs = useRef<(THREE.Group | null)[]>([])
  useFrame(() => {
    const t = worldTime()
    ranks.forEach((r, i) => {
      const g = refs.current[i]
      if (!g) return
      const p = inCortege(t, r.gap, r.lat)
      g.position.set(p.x - HAPPENING_X, 0, p.z)
      // The cars' models lie along x; the people face their way.
      g.rotation.y = i < CARS.length ? p.h - Math.PI / 2 : p.h
    })
  })
  const at = (i: number) => (g: THREE.Group | null) => void (refs.current[i] = g)
  return (
    <group position={[HAPPENING_X, 0, 0]}>
      {CARS.map((_, i) => (
        <group key={i} ref={at(i)}>
          <Vehicle p={[0, 0, 0]} kind="car" color="#f8f9fa" />
          <Box p={[1.4, 1.25, 0]} s={[0.9, 0.08, 1.2]} c="#ff8fab" />
          <Box p={[1.4, 1.3, 0]} s={[0.3, 0.3, 0.3]} c="#ffffff" />
        </group>
      ))}
      <NoShadows>
        <group ref={at(CARS.length)}>
          <Human look={couple[0].look} gender={couple[0].gender} pose="wave" seed={couple[0].seed} />
        </group>
        <group ref={at(CARS.length + 1)}>
          <Human look={couple[1].look} gender={couple[1].gender} pose="walk" seed={couple[1].seed} />
        </group>
        {crowd.map((p, i) => (
          <group key={i} ref={at(CARS.length + 2 + i)}>
            <Human look={p.look} gender={p.gender} pose={i % 3 ? 'walk' : 'dance'} seed={p.seed} />
          </group>
        ))}
      </NoShadows>
    </group>
  )
}

/* ---------- Éléphants match on a big screen ---------- */

function useScreenTexture() {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 144
    const g = c.getContext('2d')!
    g.fillStyle = '#2f9e44'
    g.fillRect(0, 0, 256, 144)
    g.strokeStyle = '#ffffff'
    g.lineWidth = 3
    g.strokeRect(10, 10, 236, 124)
    g.beginPath()
    g.moveTo(128, 10)
    g.lineTo(128, 134)
    g.stroke()
    g.beginPath()
    g.arc(128, 72, 22, 0, Math.PI * 2)
    g.stroke()
    g.fillStyle = 'rgba(0,0,0,0.55)'
    g.fillRect(8, 112, 120, 24)
    g.fillStyle = '#ffffff'
    g.font = 'bold 15px sans-serif'
    g.fillText('CIV  2 - 1  ', 16, 129)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
}

function Flag({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <Box p={[0, 2, 0]} s={[0.08, 4, 0.08]} c="#868e96" />
      {['#ff8200', '#ffffff', '#009a44'].map((c, i) => (
        <Box key={c} p={[0.35 + i * 0.5, 3.5, 0]} s={[0.5, 1, 0.04]} c={c} />
      ))}
    </group>
  )
}

function Match({ seed }: { seed: string }) {
  const screen = useScreenTexture()
  const crowd = useCrowd(14, `match${seed}`, (r) => (r() < 0.7 ? { outfit: 'jersey', outfitColor: '#ff8200' } : {}))
  const [goal, setGoal] = useState(false)
  useFrame(() => {
    const g = worldTime() % 12 < 2.5
    if (g !== goal) setGoal(g)
  })
  return (
    <group position={[HAPPENING_X, 0, 0]}>
      <Box p={[0, 1.6, -3.6]} s={[0.25, 3.2, 0.25]} c="#343a40" />
      <mesh position={[0, 3.8, -3.6]}>
        <boxGeometry args={[7, 4, 0.3]} />
        <meshBasicMaterial attach="material-4" map={screen} />
        <meshLambertMaterial attach="material-0" color="#212529" />
        <meshLambertMaterial attach="material-1" color="#212529" />
        <meshLambertMaterial attach="material-2" color="#212529" />
        <meshLambertMaterial attach="material-3" color="#212529" />
        <meshLambertMaterial attach="material-5" color="#212529" />
      </mesh>
      <Flag p={[-5, 0, -3]} />
      <Flag p={[4.5, 0, -3]} />
      <NoShadows>
        {crowd.map((p, i) => (
          <Guest key={i} p={[-4.5 + (i % 5) * 2.2 + (Math.floor(i / 5) % 2) * 1, 0, 0.2 + Math.floor(i / 5) * 1.6]} r={Math.PI} person={p} pose={goal || i % 4 === 0 ? 'cheer' : 'idle'} />
        ))}
      </NoShadows>
    </group>
  )
}

/* ---------- Coupé-décalé concert ---------- */

function Concert({ seed, night, title = 'COUPÉ-DÉCALÉ', color = '#b02bd6' }: { seed: string; night: boolean; title?: string; color?: string }) {
  const crowd = useCrowd(16, `concert${seed}`)
  const dj = useMemo<Person>(() => ({ gender: 'homme', look: { ...randomLook('homme', rng(`dj${seed}`)), outfit: 'casual', outfitColor: '#ffffff', accessory: 'glasses', hair: 'locks' }, seed: 3 }), [seed])
  const lights = useRef<(THREE.Mesh | null)[]>([])
  useFrame(() => {
    lights.current.forEach((m, i) => {
      if (m) m.rotation.z = Math.sin(worldTime() * 1.8 + i * 2) * 0.5
    })
  })
  return (
    <group position={[HAPPENING_X, 0, 0]}>
      <Box p={[0, 0.5, -3.4]} s={[9, 1, 4]} c="#2b2140" />
      <Box p={[0, 1.45, -2.4]} s={[2.4, 0.9, 0.9]} c="#141416" />
      <Sign p={[0, 5.2, -5.2]} w={7} text={title} bg={color} />
      {[-4, 4].map((x) => (
        <group key={x}>
          <Box p={[x, 2.2, -3.6]} s={[1.3, 2.4, 1]} c="#141416" />
          {[1.6, 2.6].map((y) => (
            <mesh key={y} position={[x, y, -3.08]}>
              <circleGeometry args={[0.38, 16]} />
              <meshBasicMaterial color="#495057" />
            </mesh>
          ))}
          <Box p={[x, 2.6, -5.2]} s={[0.15, 5.2, 0.15]} c="#495057" />
        </group>
      ))}
      {['#ff3ec8', '#3bc9db', '#ffd43b'].map((c, i) => (
        <mesh key={c} ref={(m) => void (lights.current[i] = m)} position={[-3 + i * 3, 5, -4]} rotation={[0.5, 0, 0]}>
          <coneGeometry args={[1.6, 5, 16, 1, true]} />
          <meshBasicMaterial color={c} transparent opacity={night ? 0.32 : 0.14} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ))}
      <NoShadows>
        <Guest p={[0, 1, -3.2]} person={dj} pose="dj" />
        {crowd.map((p, i) => (
          <Guest key={i} p={[-4 + (i % 6) * 1.6 + (Math.floor(i / 6) % 2) * 0.7, 0, 0.4 + Math.floor(i / 6) * 1.5]} r={Math.PI + (i % 3) * 0.3 - 0.3} person={p} pose={i % 5 === 0 ? 'cheer' : 'dance'} />
        ))}
      </NoShadows>
    </group>
  )
}

/* ---------- Tropical downpour ---------- */

const DROPS = 1400
function Rain() {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const drops = useMemo(() => {
    const r = rng('rain')
    return [...Array(DROPS)].map(() => [r() * 120 - 60, r() * 30, r() * 80 - 40, 14 + r() * 8])
  }, [])
  const m = useMemo(() => new THREE.Matrix4(), [])
  useFrame((_, dt) => {
    if (!mesh.current) return
    drops.forEach((d, i) => {
      d[1] -= d[3] * Math.min(dt, 0.05)
      if (d[1] < 0) d[1] += 30
      m.makeTranslation(d[0], d[1], d[2])
      mesh.current!.setMatrixAt(i, m)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  })
  return (
    <group>
      <instancedMesh ref={mesh} args={[undefined, undefined, DROPS]} frustumCulled={false}>
        <boxGeometry args={[0.03, 0.9, 0.03]} />
        <meshBasicMaterial color="#cfe8ff" transparent opacity={0.55} />
      </instancedMesh>
      {[[-12, 3], [6, -2.5], [22, 1.5], [35, -3], [-30, -1]].map(([x, z], i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.06, z]}>
          <circleGeometry args={[1.5 + (i % 2), 20]} />
          <meshBasicMaterial color="#8fb3cf" transparent opacity={0.5} />
        </mesh>
      ))}
    </group>
  )
}

/* ---------- Power cut: neighbours around lanterns ---------- */

function Blackout({ seed }: { seed: string }) {
  const crowd = useCrowd(7, `cut${seed}`)
  return (
    <group position={[HAPPENING_X, 0, SIDEWALK + 1]}>
      {[0, 6].map((x) => (
        <group key={x} position={[x - 3, 0, 0]}>
          <mesh position={[0, 0.5, 0]}>
            <sphereGeometry args={[0.18, 12, 12]} />
            <meshBasicMaterial color="#ffb547" />
          </mesh>
          <pointLight position={[0, 0.8, 0]} intensity={6} distance={9} color="#ffb547" />
          <Box p={[0, 0.2, 0]} s={[1.6, 0.4, 1.6]} c="#5b3a22" />
        </group>
      ))}
      <NoShadows>
        {crowd.map((p, i) => {
          const a = (i / crowd.length) * Math.PI * 2
          return <Guest key={i} p={[Math.cos(a) * 2.8 + (i % 2 ? 3 : -3), 0, Math.sin(a) * 1.6]} r={-a - Math.PI / 2} person={p} pose="idle" />
        })}
      </NoShadows>
    </group>
  )
}

/* ---------- Traffic jam ---------- */

function Jam() {
  const kinds = ['gbaka', 'taxi', 'woro', 'car', 'gbaka', 'taxi', 'car', 'woro', 'moto', 'taxi'] as const
  return (
    <group>
      {[2.2, -2.2].flatMap((z, lane) =>
        kinds.map((k, i) => (
          <Vehicle key={`${lane}${i}`} p={[-40 + i * 7.5 + lane * 3, 0, z]} r={z > 0 ? 0 : Math.PI} kind={k} color={k === 'woro' ? '#2a6cf0' : k === 'car' ? ['#f8f9fa', '#c92a2a', '#212529'][i % 3] : undefined} />
        )),
      )}
    </group>
  )
}

/** The jam laid along the real street (open/jam.ts), in the world's own frame: each side of the street heads its own way. */
export function JamOnRoad({ cars }: { cars: { p: [number, number]; angle: number; lane: 1 | -1; width: number }[] }) {
  const kinds = ['gbaka', 'taxi', 'woro', 'car', 'gbaka', 'taxi', 'car', 'woro', 'moto', 'taxi'] as const
  return (
    <group>
      {cars.map((c, i) => {
        const k = kinds[i % kinds.length]
        const off = c.lane * Math.max(1.6, Math.min(2.4, c.width / 4))
        const [nx, nz] = [-Math.sin(c.angle), Math.cos(c.angle)]
        return <Vehicle key={i} p={[c.p[0] + nx * off, 0, c.p[1] + nz * off]} r={-c.angle + (c.lane === 1 ? 0 : Math.PI)} kind={k} color={k === 'woro' ? '#2a6cf0' : k === 'car' ? ['#f8f9fa', '#c92a2a', '#212529'][i % 3] : undefined} />
      })}
    </group>
  )
}

/* ---------- Police checkpoint ---------- */

function Checkpoint({ seed }: { seed: string }) {
  const officers = useMemo<Person[]>(
    () =>
      [0, 1].map((i) => {
        const gender = i ? 'femme' : 'homme'
        return { gender, look: { ...randomLook(gender, rng(`cop${seed}${i}`)), outfit: 'policier', accessory: 'none', hair: 'short', beard: 'none' }, seed: i * 7 } as Person
      }),
    [seed],
  )
  const bar = useRef<THREE.Mesh>(null)
  useFrame(() => {
    if (bar.current) (bar.current.material as THREE.MeshBasicMaterial).color.set(Math.floor(worldTime() * 3) % 2 ? '#e03131' : '#1c7ed6')
  })
  return (
    <group position={[HAPPENING_X, 0, 0]}>
      <Vehicle p={[3, 0, 2.2]} kind="car" color="#1f2a44" />
      <Box p={[3, 0.95, 2.2]} s={[4.32, 0.18, 1.82]} c="#f8f9fa" />
      <mesh ref={bar} position={[2.7, 2.1, 2.2]}>
        <boxGeometry args={[0.4, 0.2, 1.2]} />
        <meshBasicMaterial color="#e03131" />
      </mesh>
      <Vehicle p={[-6, 0, 2.2]} kind="gbaka" />
      {/* Spike strip and cones */}
      {[-1.6, -0.4, 0.8, 2].map((z) => (
        <mesh key={z} position={[-1.5, 0.35, z]}>
          <coneGeometry args={[0.22, 0.7, 10]} />
          <Mat color="#ff7a00" />
        </mesh>
      ))}
      <NoShadows>
        <Guest p={[-2.6, 0, 3.6]} r={-Math.PI / 2} person={officers[0]} pose="wave" />
        <Guest p={[0, 0, 4]} r={-Math.PI / 2} person={officers[1]} pose="idle" />
      </NoShadows>
    </group>
  )
}


/* ---------- The furniture of the street's gatherings ---------- */

/** A rented plastic chair, the sitter facing `r` (0: +z). */
function Chair({ p, r = 0, c = '#f1f3f5' }: { p: [number, number, number]; r?: number; c?: string }) {
  return (
    <group position={p} rotation={[0, r, 0]}>
      <Box p={[0, 0.43, 0]} s={[0.5, 0.06, 0.5]} c={c} />
      <Box p={[0, 0.76, -0.23]} s={[0.5, 0.6, 0.05]} c={c} />
      {[-0.21, 0.21].flatMap((x) => [-0.21, 0.21].map((z) => <Box key={`${x}${z}`} p={[x, 0.2, z]} s={[0.05, 0.4, 0.05]} c={c} />))}
    </group>
  )
}

/** A bâche: four poles, the canvas, its striped valance all round. */
function Tent({ p, w, d, h = 2.7, c = '#ffffff', stripe = '#1c7ed6' }: { p: [number, number, number]; w: number; d: number; h?: number; c?: string; stripe?: string }) {
  return (
    <group position={p}>
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Box key={`${sx}${sz}`} p={[(sx * w) / 2, h / 2, (sz * d) / 2]} s={[0.08, h, 0.08]} c="#adb5bd" />))}
      <Box p={[0, h + 0.05, 0]} s={[w + 0.3, 0.1, d + 0.3]} c={c} />
      {[-1, 1].map((sz) => (
        <Box key={`z${sz}`} p={[0, h - 0.12, (sz * (d + 0.3)) / 2]} s={[w + 0.3, 0.3, 0.04]} c={stripe} />
      ))}
      {[-1, 1].map((sx) => (
        <Box key={`x${sx}`} p={[(sx * (w + 0.3)) / 2, h - 0.12, 0]} s={[0.04, 0.3, d + 0.3]} c={stripe} />
      ))}
    </group>
  )
}

/** A long table with its cloth. */
function Table({ p, w, d = 0.9, cloth = '#ffffff' }: { p: [number, number, number]; w: number; d?: number; cloth?: string }) {
  return (
    <group position={p}>
      <Box p={[0, 0.74, 0]} s={[w, 0.06, d]} c={cloth} />
      <Box p={[0, 0.45, d / 2 - 0.02]} s={[w, 0.55, 0.02]} c={cloth} />
      {[-1, 1].map((sx) => (
        <Box key={sx} p={[(sx * (w - 0.2)) / 2, 0.37, 0]} s={[0.06, 0.74, d - 0.2]} c="#868e96" />
      ))}
    </group>
  )
}

function Speaker({ p, r = 0 }: { p: [number, number, number]; r?: number }) {
  return (
    <group position={p} rotation={[0, r, 0]}>
      <Box p={[0, 0.8, 0]} s={[0.8, 1.6, 0.6]} c="#141416" />
      {[0.5, 1.15].map((y) => (
        <mesh key={y} position={[0, y, 0.31]}>
          <circleGeometry args={[0.25, 14]} />
          <meshBasicMaterial color="#495057" />
        </mesh>
      ))}
    </group>
  )
}

/** A column of balloons, the shop's colours. */
function Balloons({ p, colors }: { p: [number, number, number]; colors: string[] }) {
  return (
    <group position={p}>
      <Box p={[0, 1.2, 0]} s={[0.04, 2.4, 0.04]} c="#dee2e6" />
      {[...Array(9)].map((_, i) => (
        <mesh key={i} position={[(i % 3) * 0.28 - 0.28, 1 + Math.floor(i / 3) * 0.55, (i % 2) * 0.12]}>
          <sphereGeometry args={[0.24, 10, 8]} />
          <Mat color={colors[i % colors.length]} />
        </mesh>
      ))}
    </group>
  )
}

/** The big pot of a ceremony's meal, on its fire. */
function Marmite({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.55, 0.45, 0.7, 14]} />
        <Mat color="#495057" />
      </mesh>
      {[0, 2.1, 4.2].map((a) => (
        <Box key={a} p={[Math.cos(a) * 0.45, 0.06, Math.sin(a) * 0.45]} s={[0.3, 0.12, 0.3]} c="#5c3d24" />
      ))}
    </group>
  )
}

function Drum({ p, h = 0.8 }: { p: [number, number, number]; h?: number }) {
  return (
    <group position={p}>
      <mesh position={[0, h / 2, 0]}>
        <cylinderGeometry args={[0.24, 0.16, h, 12]} />
        <Mat color="#7a4a24" />
      </mesh>
      <mesh position={[0, h + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.24, 12]} />
        <meshLambertMaterial color="#e9d8b4" />
      </mesh>
    </group>
  )
}

/** Strings of little orange-white-green flags across the street. */
function Bunting({ x0, x1, h = 4.2 }: { x0: number; x1: number; h?: number }) {
  const n = Math.round((x1 - x0) / 0.7)
  return (
    <group>
      {[-4.5, 0.5, 5].map((z) => (
        <group key={z}>
          {[...Array(n)].map((_, i) => (
            <mesh key={i} position={[x0 + i * 0.7, h - Math.sin((i / n) * Math.PI) * 0.6, z]} rotation={[0, 0, Math.PI]}>
              <coneGeometry args={[0.18, 0.4, 3]} />
              <Mat color={['#ff8200', '#ffffff', '#009a44'][i % 3]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

/** Rows of chairs facing -z, people on them but for the Sim's (the role's) seat. */
function Rows({ seed, x0, z0, cols, rows, keep, dress, c }: { seed: string; x0: number; z0: number; cols: number; rows: number; keep?: XZ; dress?: (r: () => number, g: Person['gender']) => Partial<Look>; c?: string }) {
  const crowd = useCrowd(cols * rows, seed, dress)
  return (
    <>
      {crowd.map((person, i) => {
        const [x, z] = [x0 + (i % cols) * 1.05, z0 + Math.floor(i / cols) * 1.4]
        if (keep && Math.hypot(x - keep[0], z - keep[1]) < 0.6) return null
        return (
          <group key={i}>
            <Chair p={[x, 0, z]} r={Math.PI} c={c} />
            {(i * 7) % 10 < 7 && <Guest p={[x, 0, z]} r={Math.PI} person={person} pose={(i * 3) % 7 === 0 ? 'clap' : 'sit'} />}
          </group>
        )
      })}
    </>
  )
}

/** The Sim's seat or tool, where its role puts it (HAPPENING_ROLES). */
function RoleProps({ id }: { id: string }) {
  const r = HAPPENING_ROLES[id]
  if (!r) return null
  const [x, z] = [r.at[0] - HAPPENING_X, r.at[1]]
  const rot = Math.atan2(r.face[0] - r.at[0], r.face[1] - r.at[1])
  if (r.chair) return <Chair p={[x, 0, z]} r={rot} />
  if (r.tool === 'broom')
    return (
      <group position={[x + Math.sin(rot) * 0.45, 0, z + Math.cos(rot) * 0.45]} rotation={[0, rot, 0.5]}>
        <Box p={[0, 0.6, 0]} s={[0.04, 1.3, 0.04]} c="#a47148" />
        <Box p={[0, 0.02, 0]} s={[0.35, 0.18, 0.08]} c="#e0b45a" />
      </group>
    )
  return (
    <group position={[x + Math.sin(rot) * 0.45, 0, z + Math.cos(rot) * 0.45]} rotation={[0, rot, 0.45]}>
      <Box p={[0, 0.6, 0]} s={[0.04, 1.2, 0.04]} c="#a47148" />
      <Box p={[0, 0.04, 0]} s={[0.26, 0.04, 0.3]} c="#868e96" />
    </group>
  )
}

/* ---------- Shop opening: the stand, the balloons, the sono, the promos ---------- */

function ShopOpening({ seed }: { seed: string }) {
  const crowd = useCrowd(8, `shop${seed}`)
  const staff = useCrowd(3, `staff${seed}`, (_, g) => ({ outfit: 'casual', outfitColor: '#ff7a00', accessory: g === 'homme' ? 'cap' : 'earrings', accessoryColor: '#ff7a00' }))
  const at = HAPPENING_ROLES['ouverture-boutique'].at
  return (
    <group position={[HAPPENING_X, 0, 0]}>
      <Tent p={[0, 0, 2.2]} w={5.5} d={2.6} c="#ffffff" stripe="#ff7a00" />
      <Sign p={[0, 3.25, 3.6]} w={5} text="GRANDE OUVERTURE" bg="#ff7a00" />
      <Sign p={[0, 2.35, 3.62]} w={2.6} text="PROMOS -30 %" bg="#ffd400" fg="#111111" />
      <Table p={[0, 0, 2.6]} w={3.6} cloth="#f8f9fa" />
      {/* What's on promotion: wax, phones, boxes */}
      {['#e8590c', '#1971c2', '#2f9e44', '#f08c00', '#c2255c', '#5f3dc4'].map((c, i) => (
        <Box key={c} p={[-1.5 + i * 0.6, 0.86, 2.55]} s={[0.45, 0.18 + (i % 3) * 0.08, 0.5]} c={c} />
      ))}
      <Balloons p={[-3.1, 0, 3.7]} colors={['#ff7a00', '#ffffff', '#00b86b']} />
      <Balloons p={[3.1, 0, 3.7]} colors={['#ff7a00', '#ffffff', '#00b86b']} />
      <Speaker p={[-3.6, 0, 1.6]} r={0.3} />
      <Speaker p={[3.6, 0, 1.6]} r={-0.3} />
      <NoShadows>
        {/* The hostesses behind the table, the atalaku hyping the crowd */}
        <Guest p={[-0.9, 0, 1.6]} person={staff[0]} pose="wave" />
        <Guest p={[0.9, 0, 1.6]} person={staff[1]} pose="clap" />
        <Guest p={[-2.2, 0, 4]} r={0.3} person={staff[2]} pose="shout" />
        {crowd.map((p, i) => {
          const [x, z] = [-3 + (i % 4) * 1.9 + (Math.floor(i / 4) % 2) * 0.8, 4.5 + Math.floor(i / 4) * 1.1]
          if (Math.hypot(HAPPENING_X + x - at[0], z - at[1]) < 0.9) return null
          return <Guest key={i} p={[x, 0, z]} r={Math.PI + (i % 3) * 0.25 - 0.25} person={p} pose={(['clap', 'dance', 'phone', 'idle'] as Pose[])[i % 4]} />
        })}
      </NoShadows>
    </group>
  )
}

/* ---------- Baptism in the courtyard: the bâche on the street, the chairs, the pots ---------- */

function Baptism({ seed }: { seed: string }) {
  const parents = useCrowd(2, `parents${seed}`, (_, g) => ({ outfit: g === 'femme' ? 'pagne' : 'bazin', outfitColor: '#ffffff', pattern: 'feuilles', hair: g === 'femme' ? 'headwrap' : 'short' }))
  const cooks = useCrowd(2, `cooks${seed}`, () => ({ outfit: 'pagne', hair: 'headwrap' }))
  return (
    <group position={[HAPPENING_X, 0, 0]}>
      <Tent p={[0, 0, 1.6]} w={9} d={6.4} c="#f8f9fa" stripe="#1c7ed6" />
      <Table p={[0, 0, -1]} w={3.2} cloth="#d0ebff" />
      <Chair p={[-0.7, 0, -1.8]} />
      <Chair p={[0.7, 0, -1.8]} />
      {/* The baby, in its white blanket, in the mother's arms */}
      <Box p={[-0.55, 1.05, -1.45]} s={[0.4, 0.22, 0.22]} c="#ffffff" />
      <Rows seed={`bapt${seed}`} x0={-3.6} z0={1.3} cols={7} rows={3} keep={[HAPPENING_ROLES.bapteme.at[0] - HAPPENING_X, HAPPENING_ROLES.bapteme.at[1]]} />
      <Marmite p={[5.6, 0, 2.6]} />
      <Marmite p={[5.6, 0, 4]} />
      <NoShadows>
        <Guest p={[-0.7, 0, -1.8]} person={parents[0]} pose="hug" />
        <Guest p={[0.7, 0, -1.8]} person={parents[1]} pose="sit" />
        <Guest p={[6.4, 0, 2.6]} r={-Math.PI / 2} person={cooks[0]} pose="cook" />
        <Guest p={[6.4, 0, 4]} r={-Math.PI / 2} person={cooks[1]} pose="cook" />
      </NoShadows>
    </group>
  )
}

/* ---------- Birthday at the neighbours': the cake, the balloons, the music ---------- */

function Birthday({ seed }: { seed: string }) {
  const crowd = useCrowd(9, `bday${seed}`)
  const kid = useCrowd(3, `bdaykid${seed}`)
  return (
    <group position={[HAPPENING_X, 0, 0]}>
      <Table p={[0, 0, 2.2]} w={2.4} cloth="#fff0f6" />
      {/* The cake, its candles */}
      <mesh position={[0, 0.92, 2.2]}>
        <cylinderGeometry args={[0.32, 0.32, 0.26, 16]} />
        <Mat color="#ffffff" />
      </mesh>
      <mesh position={[0, 1.1, 2.2]}>
        <cylinderGeometry args={[0.22, 0.22, 0.14, 16]} />
        <Mat color="#f783ac" />
      </mesh>
      {[-0.08, 0, 0.08].map((x) => (
        <Box key={x} p={[x, 1.24, 2.2]} s={[0.02, 0.12, 0.02]} c="#ffd43b" glow={1.5} />
      ))}
      <Balloons p={[-1.8, 0, 2.4]} colors={['#f783ac', '#74c0fc', '#ffd43b']} />
      <Balloons p={[1.8, 0, 2.4]} colors={['#f783ac', '#74c0fc', '#ffd43b']} />
      <Speaker p={[3, 0, 1.4]} r={-0.4} />
      <NoShadows>
        {kid.map((p, i) => (
          <Guest key={`k${i}`} p={[-0.6 + i * 0.6, 0, 1.4]} person={p} pose={i === 1 ? 'cheer' : 'clap'} scale={0.62} />
        ))}
        {crowd.map((p, i) => {
          const a = -0.3 + (i / crowd.length) * (Math.PI + 0.6)
          const [x, z] = [Math.cos(a) * 2.6, 2.2 + Math.sin(a) * 2.3]
          return <Guest key={i} p={[x, 0, z]} r={Math.atan2(-x, 2.2 - z)} person={p} pose={i % 3 === 0 ? 'dance' : 'clap'} />
        })}
      </NoShadows>
    </group>
  )
}

/* ---------- Wake: the bâche, the choir, the portrait, the lights ---------- */

function Wake({ seed }: { seed: string }) {
  const choir = useCrowd(5, `choir${seed}`, (_, g) => ({ outfit: g === 'femme' ? 'robe' : 'chemise', outfitColor: '#ffffff', pattern: 'cercles' }))
  return (
    <group position={[HAPPENING_X, 0, 0]}>
      <Tent p={[0, 0, 1.6]} w={9} d={6.4} c="#f1f3f5" stripe="#495057" />
      <Table p={[0, 0, -1]} w={2.2} cloth="#ffffff" />
      {/* The portrait in its frame, the flowers, the candles */}
      <Box p={[0, 1.25, -1.2]} s={[0.6, 0.75, 0.05]} c="#212529" />
      <Box p={[0, 1.25, -1.17]} s={[0.46, 0.6, 0.02]} c="#ced4da" />
      {[-0.7, 0.7].map((x) => (
        <mesh key={x} position={[x, 0.95, -1]}>
          <icosahedronGeometry args={[0.2, 0]} />
          <Mat color="#ffffff" />
        </mesh>
      ))}
      {[-0.35, 0.35].map((x) => (
        <Box key={x} p={[x, 0.86, -0.8]} s={[0.06, 0.18, 0.06]} c="#fff3bf" glow={2} />
      ))}
      {[-3, 0, 3].map((x) => (
        <mesh key={x} position={[x, 2.45, 1.6]}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshBasicMaterial color="#fff3bf" />
        </mesh>
      ))}
      <pointLight position={[0, 2.3, 1.6]} intensity={5} distance={10} color="#fff3bf" />
      <Rows seed={`wake${seed}`} x0={-3.6} z0={1.3} cols={7} rows={3} keep={[HAPPENING_ROLES.funerailles.at[0] - HAPPENING_X, HAPPENING_ROLES.funerailles.at[1]]} dress={(r, g) => ({ outfit: g === 'femme' ? 'pagne' : 'chemise', outfitColor: r() < 0.5 ? '#212529' : '#ffffff', pattern: 'none' })} />
      <NoShadows>
        {choir.map((p, i) => (
          <Guest key={i} p={[-3.2 + i * 0.75, 0, -1.6]} person={p} pose={i % 2 ? 'pray' : 'idle'} />
        ))}
      </NoShadows>
    </group>
  )
}

/* ---------- The village's association meets under the apatam ---------- */

function Association({ seed }: { seed: string }) {
  const bureau = useCrowd(3, `bureau${seed}`, (_, g) => ({ outfit: g === 'femme' ? 'pagne' : 'boubou', pattern: 'kente', hair: g === 'femme' ? 'headwrap' : 'short' }))
  return (
    <group position={[HAPPENING_X, 0, 0]}>
      {/* The apatam: poles and a thatched roof */}
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Box key={`${sx}${sz}`} p={[sx * 4, 1.4, 1.4 + sz * 3]} s={[0.18, 2.8, 0.18]} c="#8a6440" />))}
      <mesh position={[0, 3.3, 1.4]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[6.4, 1.6, 4]} />
        <Mat color="#c9a35a" />
      </mesh>
      <Table p={[0, 0, -1.2]} w={3} cloth="#2b8a3e" />
      {/* The register and the cash box */}
      <Box p={[-0.6, 0.8, -1.2]} s={[0.4, 0.04, 0.3]} c="#f8f9fa" />
      <Box p={[0.7, 0.85, -1.2]} s={[0.35, 0.18, 0.25]} c="#5c3d24" />
      <Rows seed={`asso${seed}`} x0={-3.6} z0={1.1} cols={7} rows={3} keep={[HAPPENING_ROLES.association.at[0] - HAPPENING_X, HAPPENING_ROLES.association.at[1]]} />
      <NoShadows>
        {bureau.map((p, i) => (
          <group key={i}>
            <Chair p={[-1 + i, 0, -2]} />
            <Guest p={[-1 + i, 0, -2]} person={p} pose={i === 1 ? 'write' : i === 0 ? 'talk' : 'sit'} />
          </group>
        ))}
      </NoShadows>
    </group>
  )
}

/* ---------- Tontine: round the table, each one's part, the one who collects ---------- */

function Tontine({ seed }: { seed: string }) {
  const women = useCrowd(5, `tontine${seed}`, () => ({ outfit: 'pagne', hair: 'headwrap' }))
  const [cx, cz] = [-2, 2.8]
  return (
    <group position={[HAPPENING_X, 0, 0]}>
      <mesh position={[cx, 0.74, cz]}>
        <cylinderGeometry args={[0.85, 0.85, 0.06, 14]} />
        <Mat color="#f8f9fa" />
      </mesh>
      <Box p={[cx, 0.37, cz]} s={[0.1, 0.74, 0.1]} c="#adb5bd" />
      {/* The notebook and the bundles of notes */}
      <Box p={[cx - 0.2, 0.79, cz]} s={[0.36, 0.03, 0.26]} c="#4dabf7" />
      {[0, 1, 2].map((i) => (
        <Box key={i} p={[cx + 0.3, 0.8 + i * 0.03, cz + 0.1]} s={[0.3, 0.03, 0.14]} c="#8ce99a" />
      ))}
      <NoShadows>
        {women.map((p, i) => {
          const a = (135 + 60 * (i + 1)) * (Math.PI / 180)
          const [x, z] = [cx + Math.cos(a) * 1.25, cz + Math.sin(a) * 1.25]
          const r = Math.atan2(cx - x, cz - z)
          return (
            <group key={i}>
              <Chair p={[x, 0, z]} r={r} c="#e03131" />
              <Guest p={[x, 0, z]} r={r} person={p} pose={i === 2 ? 'write' : i === 0 ? 'talk' : 'sit'} />
            </group>
          )
        })}
      </NoShadows>
    </group>
  )
}

/* ---------- Clean-up day: brooms on the gutters, the wheelbarrow, the bags ---------- */

function CleanUp({ seed }: { seed: string }) {
  const crowd = useCrowd(6, `clean${seed}`, () => ({ outfit: 'casual', outfitColor: '#2f9e44' }))
  return (
    <group position={[HAPPENING_X, 0, 0]}>
      {/* The wheelbarrow, full */}
      <group position={[1.5, 0, 4.4]} rotation={[0, 0.4, 0]}>
        <Box p={[0, 0.55, 0]} s={[0.8, 0.35, 1.1]} c="#adb5bd" />
        <Box p={[0, 0.78, 0]} s={[0.7, 0.12, 0.9]} c="#6b4f2a" />
        <mesh position={[0, 0.25, 0.6]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.22, 0.22, 0.1, 10]} />
          <Mat color="#212529" />
        </mesh>
      </group>
      {[[3.4, 5.6], [3.9, 5.3], [-0.6, -5.4], [4.6, -5.6]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.3, z]}>
          <icosahedronGeometry args={[0.36, 0]} />
          <Mat color="#212529" />
        </mesh>
      ))}
      <NoShadows>
        {crowd.map((p, i) => {
          const [x, z] = [-1 + (i % 3) * 2.4, i < 3 ? 5.4 : -5.4]
          return (
            <group key={i}>
              <Guest p={[x, 0, z]} r={Math.PI / 2} person={p} pose="busy" />
              <group position={[x + 0.45, 0, z]} rotation={[0, Math.PI / 2, 0.5]}>
                <Box p={[0, 0.6, 0]} s={[0.04, 1.3, 0.04]} c="#a47148" />
                <Box p={[0, 0.02, 0]} s={[0.35, 0.18, 0.08]} c="#e0b45a" />
              </group>
            </group>
          )
        })}
      </NoShadows>
    </group>
  )
}

/* ---------- Match day: the supporters gather in the street, jerseys, drums, flags, before the stadium ---------- */

function Supporters({ seed }: { seed: string }) {
  const crowd = useCrowd(12, `supp${seed}`, (r) => (r() < 0.5 ? { outfit: 'jersey', outfitColor: '#ffd43b' } : { outfit: 'jersey', outfitColor: '#212529' }))
  // Jumping on the beat of the drums, all together.
  const group = useRef<THREE.Group>(null)
  useFrame(() => {
    if (group.current) group.current.position.y = Math.abs(Math.sin(worldTime() * 4)) * 0.12
  })
  return (
    <group position={[HAPPENING_X, 0, 0]}>
      <group ref={group}>
        <NoShadows>
          {crowd.map((p, i) => {
            const [x, z] = [-3.4 + (i % 4) * 1.5, 0.6 + Math.floor(i / 4) * 1.3]
            return (
              <group key={i}>
                <Guest p={[x, 0, z]} r={Math.PI + (i % 3) * 0.3 - 0.3} person={p} pose={i % 4 === 1 ? 'busy' : i % 2 ? 'cheer' : 'dance'} />
                {i % 4 === 2 && (
                  <group position={[x + 0.25, 1.4, z]}>
                    <Box p={[0, 0.6, 0]} s={[0.04, 1.6, 0.04]} c="#868e96" />
                    <Box p={[0.35, 1.2, 0]} s={[0.7, 0.45, 0.03]} c={i % 8 < 4 ? '#ffd43b' : '#212529'} />
                  </group>
                )}
              </group>
            )
          })}
        </NoShadows>
      </group>
      {[-1.9, 1.1].map((x) => (
        <Drum key={x} p={[x, 0, 0.1]} h={0.9} />
      ))}
    </group>
  )
}

/* ---------- Flooded street: the water, the stuck taxi, those who wade ---------- */

function Flood({ seed }: { seed: string }) {
  const crowd = useCrowd(4, `flood${seed}`, () => ({ outfit: 'debardeur' }))
  return (
    <group position={[HAPPENING_X, 0, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.14, 0]}>
        <planeGeometry args={[40, 11.4]} />
        <meshLambertMaterial color="#8d7b5a" transparent opacity={0.82} />
      </mesh>
      <Vehicle p={[1.5, -0.12, -2.2]} r={Math.PI} kind="taxi" />
      <NoShadows>
        {crowd.map((p, i) => (
          <Guest key={i} p={[-1 + i * 2.2, -0.12, i % 2 ? 1.4 : -0.6]} r={(i % 2 ? 0.4 : -2.6) + i} person={p} pose={i === 1 ? 'busy' : 'walk'} />
        ))}
      </NoShadows>
    </group>
  )
}

/* ---------- Festivals: the drums and white of the Abissa, the carnival floats, the masks of Man ---------- */

function Abissa({ seed }: { seed: string }) {
  const dancers = useCrowd(10, `abissa${seed}`, (_, g) => ({ outfit: g === 'femme' ? 'pagne' : 'boubou', outfitColor: '#f8f9fa', pattern: 'none' }))
  const drummers = useCrowd(3, `abdrum${seed}`, () => ({ outfit: 'debardeur', outfitColor: '#ffffff' }))
  const ring = useRef<THREE.Group>(null)
  useFrame(() => {
    if (ring.current) ring.current.rotation.y = worldTime() * 0.25
  })
  return (
    <group position={[HAPPENING_X, 0, 1]}>
      {drummers.map((p, i) => (
        <group key={i}>
          <Drum p={[-0.8 + i * 0.8, 0, 0.3]} h={1} />
          <NoShadows>
            <Guest p={[-0.8 + i * 0.8, 0, -0.2]} person={p} pose="busy" />
          </NoShadows>
        </group>
      ))}
      <group ref={ring}>
        <NoShadows>
          {dancers.map((p, i) => {
            const a = (i / dancers.length) * Math.PI * 2
            return <Guest key={i} p={[Math.cos(a) * 3, 0, Math.sin(a) * 3]} r={-a} person={p} pose={i % 2 ? 'dance' : 'zouglou'} />
          })}
        </NoShadows>
      </group>
    </group>
  )
}

function Carnival({ seed }: { seed: string }) {
  const crowd = useCrowd(10, `carn${seed}`, (r) => ({ outfit: 'casual', outfitColor: ['#ff6b6b', '#ffd43b', '#4dabf7', '#69db7c'][Math.floor(r() * 4)] }))
  const watchers = useCrowd(6, `carnw${seed}`)
  // The parade goes by, round and round the block: back in front of the Sim every 20 s or so.
  const parade = useRef<THREE.Group>(null)
  useFrame(() => {
    if (parade.current) parade.current.position.x = -14 + ((worldTime() * 1.4) % 28)
  })
  return (
    <group position={[HAPPENING_X, 0, 0]}>
      <NoShadows>
        {watchers.map((p, i) => (
          <Guest key={`w${i}`} p={[-2.6 + i * 1.3, 0, 4.9 + (i % 2) * 0.5]} r={Math.PI} person={p} pose={i % 2 ? 'cheer' : 'clap'} />
        ))}
      </NoShadows>
      <group ref={parade}>
        {/* The float: a pick-up under flowers and a giant mask */}
        <Vehicle p={[0, 0, -1.2]} kind="car" color="#f8f9fa" />
        {['#ff6b6b', '#ffd43b', '#4dabf7', '#69db7c'].map((c, i) => (
          <mesh key={c} position={[-1.2 + i * 0.8, 1.6, -1.2]}>
            <icosahedronGeometry args={[0.45, 0]} />
            <Mat color={c} />
          </mesh>
        ))}
        <Box p={[0.2, 2.6, -1.2]} s={[1.2, 1.4, 0.3]} c="#f08c00" />
        <Box p={[0.2, 2.8, -1.04]} s={[0.8, 0.2, 0.05]} c="#212529" />
        <NoShadows>
          {crowd.map((p, i) => (
            <Guest key={i} p={[-3 - (i % 5) * 1.3, 0, -2.4 + Math.floor(i / 5) * 1.6]} r={Math.PI / 2} person={p} pose={i % 3 === 0 ? 'cheer' : 'dance'} />
          ))}
        </NoShadows>
      </group>
    </group>
  )
}

function Masks({ seed }: { seed: string }) {
  const crowd = useCrowd(8, `masks${seed}`)
  const dancers = useCrowd(3, `maskd${seed}`, () => ({ outfit: 'boubou', outfitColor: '#c9a35a', pattern: 'rayures' }))
  return (
    <group position={[HAPPENING_X, 0, 1]}>
      {/* The stilt dancers, up on their poles, and the masks, raffia skirts */}
      {dancers.map((p, i) => (
        <group key={i} position={[-2 + i * 2, 0, -0.5]}>
          {i !== 1 && [-0.12, 0.12].map((x) => <Box key={x} p={[x, 0.9, 0]} s={[0.07, 1.8, 0.07]} c="#8a6440" />)}
          <group position={[0, i === 1 ? 0 : 1.8, 0]}>
            <NoShadows>
              <Guest p={[0, 0, 0]} person={p} pose={i === 1 ? 'gweta' : 'dance'} />
            </NoShadows>
            <Box p={[0, 1.62, 0.12]} s={[0.4, 0.5, 0.12]} c="#212529" />
            <mesh position={[0, 0.5, 0]}>
              <cylinderGeometry args={[0.3, 0.5, 0.8, 10]} />
              <Mat color="#d9a441" />
            </mesh>
          </group>
        </group>
      ))}
      <Drum p={[3.6, 0, -0.8]} h={1.1} />
      <NoShadows>
        {crowd.map((p, i) => {
          const a = Math.PI * 0.15 + (i / crowd.length) * Math.PI * 0.7
          return <Guest key={i} p={[Math.cos(a) * 4.6, 0, -0.5 + Math.sin(a) * 3.4]} r={Math.atan2(-Math.cos(a), -Math.sin(a))} person={p} pose={i % 3 === 0 ? 'clap' : 'idle'} />
        })}
      </NoShadows>
    </group>
  )
}

/* ---------- Big stage: the FEMUA (the concert's, bigger, its name) ---------- */

function Femua({ seed, night }: { seed: string; night: boolean }) {
  return (
    <group>
      <Concert seed={seed} night={night} title="FEMUA" color="#e8590c" />
      <group position={[HAPPENING_X, 0, 0]}>
        <Box p={[-5.2, 3, -4.2]} s={[0.3, 6, 0.3]} c="#343a40" />
        <Box p={[5.2, 3, -4.2]} s={[0.3, 6, 0.3]} c="#343a40" />
        <Box p={[0, 6.1, -4.2]} s={[10.7, 0.4, 0.4]} c="#343a40" />
      </group>
    </group>
  )
}

/* ---------- Holidays: the flags, the neighbours, the tree, the shared meal ---------- */

function NationalDay({ seed, id }: { seed: string; id: string }) {
  const independence = id === 'fete-independance'
  const work = id === 'fete-travail'
  const crowd = useCrowd(10, `${id}${seed}`, (r) => (independence ? { outfit: 'casual', outfitColor: ['#ff8200', '#ffffff', '#009a44'][Math.floor(r() * 3)] } : work ? { outfit: r() < 0.5 ? 'bleu' : 'chemise' } : {}))
  return (
    <group position={[HAPPENING_X, 0, 0]}>
      <Bunting x0={-7} x1={7} />
      <Flag p={[-6, 0, -4.6]} />
      <Flag p={[5, 0, -4.6]} />
      <Sign p={[0, 3, -4.4]} w={5} text={independence ? '7 AOÛT · VIVE LA CÔTE D’IVOIRE' : work ? '1er MAI · FÊTE DU TRAVAIL' : 'JOURNÉE DE LA PAIX'} bg={independence ? '#ff8200' : work ? '#1c7ed6' : '#ffffff'} fg={id === 'fete-paix' ? '#2b8a3e' : '#ffffff'} />
      {work && (
        <>
          <Table p={[-2.2, 0, 3.2]} w={1.6} cloth="#f8f9fa" />
          {[-2.8, -2.2, -1.6].map((x) => (
            <Box key={x} p={[x, 0.9, 3.2]} s={[0.08, 0.26, 0.08]} c="#2b8a3e" />
          ))}
        </>
      )}
      {id === 'fete-paix' && (
        <>
          <Table p={[1.5, 0, 3]} w={2.4} cloth="#ffffff" />
          {[0.8, 1.5, 2.2].map((x) => (
            <mesh key={x} position={[x, 0.85, 3]}>
              <cylinderGeometry args={[0.22, 0.18, 0.14, 12]} />
              <Mat color="#e9c46a" />
            </mesh>
          ))}
        </>
      )}
      <NoShadows>
        {crowd.map((p, i) => {
          const [x, z] = id === 'fete-paix' && i === 0 ? [-2.9, 4.7] : [-3.2 + (i % 5) * 1.6, 0.8 + Math.floor(i / 5) * 1.5]
          return <Guest key={i} p={[x, 0, z]} r={id === 'fete-paix' && i === 0 ? -Math.PI / 2 : (i % 2) * 0.6 - 0.3} person={p} pose={id === 'fete-paix' ? (i === 0 ? 'talk' : i % 2 ? 'hug' : 'talk') : work ? (i % 2 ? 'talk' : 'drink') : i % 3 === 0 ? 'wave' : 'dance'} />
        })}
      </NoShadows>
    </group>
  )
}

function Christmas({ seed }: { seed: string }) {
  const kids = useCrowd(5, `noel${seed}`, (r) => ({ outfit: r() < 0.5 ? 'robe' : 'chemise', outfitColor: ['#e03131', '#ffffff', '#ffd43b'][Math.floor(r() * 3)] }))
  return (
    <group position={[HAPPENING_X, 0, 0]}>
      {/* The tree: three cones, the balls, the star */}
      <Box p={[0, 0.3, 1.5]} s={[0.3, 0.6, 0.3]} c="#7a5230" />
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, 1.1 + i * 0.75, 1.5]}>
          <coneGeometry args={[1.3 - i * 0.35, 1.3, 8]} />
          <Mat color="#2b8a3e" />
        </mesh>
      ))}
      {[...Array(10)].map((_, i) => (
        <mesh key={i} position={[Math.cos(i * 2.4) * (1 - (i % 3) * 0.28), 1 + (i % 3) * 0.75, 1.5 + Math.sin(i * 2.4) * (1 - (i % 3) * 0.28)]}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshBasicMaterial color={['#e03131', '#ffd43b', '#4dabf7'][i % 3]} />
        </mesh>
      ))}
      <mesh position={[0, 3.45, 1.5]}>
        <octahedronGeometry args={[0.22, 0]} />
        <meshBasicMaterial color="#ffd43b" />
      </mesh>
      <NoShadows>
        {kids.map((p, i) => (
          <Guest key={i} p={[-2.7 + (i % 3) * 0.8, 0, 3.9 - Math.floor(i / 3) * 0.9 + (i % 2) * 0.2]} r={-Math.PI / 2 + 0.6} person={p} pose={i % 2 ? 'cheer' : 'wave'} scale={0.62} />
        ))}
      </NoShadows>
    </group>
  )
}

function NewYear({ seed }: { seed: string }) {
  const crowd = useCrowd(9, `ny${seed}`, (r) => ({ outfit: r() < 0.5 ? 'bazin' : 'pagne', pattern: 'kente' }))
  return (
    <group position={[HAPPENING_X, 0, 0]}>
      <Sign p={[0, 3.2, -4.4]} w={4.4} text="BONNE ANNÉE !" bg="#5f3dc4" />
      {[-2.3, 2.3].map((x) => (
        <Box key={x} p={[x, 1.75, -4.4]} s={[0.08, 3.5, 0.08]} c="#868e96" />
      ))}
      <Speaker p={[3.2, 0, 1.6]} r={-0.4} />
      <NoShadows>
        {crowd.map((p, i) => {
          const [x, z] = i === 0 ? [-3.1, 4.7] : [-2.6 + (i % 4) * 1.5, 1 + Math.floor(i / 4) * 1.6]
          return <Guest key={i} p={[x, 0, z]} r={i === 0 ? -Math.PI / 2 : (i % 2 ? 0.8 : -0.8)} person={p} pose={i === 0 ? 'hug' : i % 3 === 0 ? 'dance' : 'hug'} />
        })}
      </NoShadows>
    </group>
  )
}

/** Korité and Tabaski: boubous, the table of the shared meal, the big dishes (Tabaski: the sheep). */
function Feast({ seed, sheep }: { seed: string; sheep: boolean }) {
  const crowd = useCrowd(7, `feast${seed}`, (_, g) => ({ outfit: g === 'femme' ? 'abaya' : 'boubou', pattern: 'none', hair: g === 'femme' ? 'headwrap' : 'short' }))
  return (
    <group position={[HAPPENING_X, 0, 0]}>
      <Tent p={[-0.6, 0, 3]} w={6} d={3.6} c="#ffffff" stripe="#2b8a3e" />
      <Table p={[-0.6, 0, 3.2]} w={3.6} cloth="#e6fcf5" />
      {[-1.9, -0.6, 0.7].map((x) => (
        <mesh key={x} position={[x, 0.84, 3.2]}>
          <cylinderGeometry args={[0.32, 0.26, 0.14, 14]} />
          <Mat color={sheep ? '#a0522d' : '#e9c46a'} />
        </mesh>
      ))}
      {sheep && (
        <group position={[3.6, 0, 4.4]} rotation={[0, -0.6, 0]}>
          <Box p={[0, 0.55, 0]} s={[0.9, 0.5, 0.45]} c="#f1f3f5" />
          <Box p={[0.55, 0.75, 0]} s={[0.3, 0.28, 0.26]} c="#343a40" />
          {[-0.3, 0.3].flatMap((x) => [-0.15, 0.15].map((z) => <Box key={`${x}${z}`} p={[x, 0.15, z]} s={[0.08, 0.3, 0.08]} c="#343a40" />))}
        </group>
      )}
      <NoShadows>
        {crowd.map((p, i) => {
          const side = i < 4 ? 2.3 : 4.1
          const x = -2.5 + (i % 4) * 1.25 + (i < 4 ? 0 : 0.6)
          if (Math.hypot(HAPPENING_X + x - HAPPENING_ROLES.korite.at[0], side - HAPPENING_ROLES.korite.at[1]) < 0.8) return null
          const r = i < 4 ? 0 : Math.PI
          return (
            <group key={i}>
              <Chair p={[x, 0, side]} r={r} c="#2b8a3e" />
              <Guest p={[x, 0, side]} r={r} person={p} pose={i % 2 ? 'eat' : 'sit'} />
            </group>
          )
        })}
      </NoShadows>
    </group>
  )
}

/* ---------- Marker and dispatcher ---------- */

export function HappeningScene({ id, seed, night, jam = true }: { id: string; seed: string; night: boolean; /** The jam's cars here (false: they're laid along the real street instead). */ jam?: boolean }) {
  return (
    <group>
      {id === 'mariage' && <Wedding seed={seed} />}
      {id === 'match' && <Match seed={seed} />}
      {id === 'concert' && <Concert seed={seed} night={night} />}
      {id === 'pluie' && <Rain />}
      {id === 'delestage' && <Blackout seed={seed} />}
      {id === 'embouteillage' && jam && <Jam />}
      {id === 'controle' && <Checkpoint seed={seed} />}
      {id === 'foot' && (
        <group position={[HAPPENING_X, 0, 0]}>
          <Football seed={seed} />
        </group>
      )}
      {id === 'basket' && (
        <group position={[HAPPENING_X - 3, 0, 0]}>
          <Basket seed={seed} />
        </group>
      )}
      {id === 'ouverture-boutique' && <ShopOpening seed={seed} />}
      {id === 'bapteme' && <Baptism seed={seed} />}
      {id === 'anniversaire' && <Birthday seed={seed} />}
      {id === 'funerailles' && <Wake seed={seed} />}
      {id === 'association' && <Association seed={seed} />}
      {id === 'tontine' && <Tontine seed={seed} />}
      {id === 'salubrite' && <CleanUp seed={seed} />}
      {id === 'ligue1' && <Supporters seed={seed} />}
      {id === 'inondation' && <Flood seed={seed} />}
      {id === 'femua' && <Femua seed={seed} night={night} />}
      {id === 'abissa' && <Abissa seed={seed} />}
      {id === 'carnaval-bouake' && <Carnival seed={seed} />}
      {id === 'fete-masques' && <Masks seed={seed} />}
      {(id === 'fete-independance' || id === 'fete-paix' || id === 'fete-travail') && <NationalDay seed={seed} id={id} />}
      {id === 'noel' && <Christmas seed={seed} />}
      {id === 'nouvel-an' && <NewYear seed={seed} />}
      {id === 'korite' && <Feast seed={seed} sheep={false} />}
      {id === 'tabaski' && <Feast seed={seed} sheep />}
      <group position={[HAPPENING_X, 0, 0]}>
        <RoleProps id={id} />
      </group>
    </group>
  )
}

/**
 * The floating label over the happening. It stays mounted for the life of the
 * scene and only its content changes: drei's <Html> crashes ("removeChild")
 * when one is unmounted while the canvas keeps running.
 */
export function HappeningMarker({ happening, onPick }: { happening: { id: string; icon: string; label: string } | null; onPick: () => void }) {
  const show = happening && happening.id !== 'pluie'
  return (
    <Html position={[HAPPENING_X, 7.5, 0]} center zIndexRange={[25, 0]}>
      {show ? (
        <button onClick={onPick} className="motion-pop flex items-center gap-1.5 rounded-xl bg-[var(--color-gold)] py-1 pr-2.5 pl-1 text-[12.5px] font-extrabold whitespace-nowrap text-[#5a3a00] shadow-[0_4px_12px_-6px_rgba(0,0,0,0.5)] transition duration-200 hover:scale-110 active:scale-95">
          <IconTile icon={iconFor(happening.icon)} colors={['#ffd54f', '#ffa000']} size={24} radius={8} />
          {happening.label}
        </button>
      ) : (
        <span />
      )}
    </Html>
  )
}
