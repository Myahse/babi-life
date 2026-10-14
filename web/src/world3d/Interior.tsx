import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { EffectComposer, N8AO } from '@react-three/postprocessing'
import { Shell } from './interior/Shell'
import { useRoomStyle } from './interior/Decor'
import * as THREE from 'three'
import type { Player, Sim } from '../lib/types'
import { Human, NoShadows, type Pose } from '../avatar/Human'
import { randomLook } from '../avatar/options'
import { Box } from './props'
import { Character } from './Character'
import { rng } from './themes'
import { worldTime } from '../lib/worldClock'

// Inside a place, like when a Sim goes through a door in the Sims: a cutaway
// room with its furniture, the people who are there, and the player's Sim
// acting out what it's doing (eating at a table, dancing, throwing notes on
// the dancers in the club, asleep in bed…).

type V3 = [number, number, number]
/** Where someone is and what they're doing. */
type Spot = { p: V3; r?: number; pose: Pose; lying?: boolean; g?: 'femme' | 'homme' }
type Person = Spot & { gender: 'femme' | 'homme'; look: ReturnType<typeof randomLook>; seed: number }

/** Kinds of places that have an inside (the beach or the football pitch don't). */
export const INDOOR = new Set(['police', 'home', 'maquis', 'club', 'restaurant', 'market', 'office', 'mairie', 'school', 'health', 'worship', 'mall', 'culture', 'barbier', 'salon', 'hotel', 'universite'])

/** Ambient occlusion where the device can afford it. */
const RICH = typeof navigator === 'undefined' || (navigator.hardwareConcurrency ?? 4) > 4


type Room = { floor: string; wall: string; dark?: boolean; furniture: React.ReactNode; spots: Record<string, Spot>; crowd: Spot[] }

/** What the Sim does there: where it goes and how it moves. */
function action(kind: string, id: string | undefined): { spot: string; pose: Pose } {
  if (!id) return { spot: 'entrance', pose: 'idle' }
  if (id === 'garde-a-vue') return { spot: 'seat', pose: 'sit' }
  if (/^(degrade|boule-a-zero|taille-barbe|tresses|tissage|chignon|manucure)$/.test(id)) return { spot: 'chair', pose: 'sit' }
  // Gbairai: telling the quarter's news, with the hands.
  if (id === 'gbairai') return { spot: kind === 'barbier' || kind === 'salon' ? 'bench' : 'table', pose: 'rant' }
  if (id === 'piscine-hotel') return { spot: 'pool', pose: 'idle' }
  if (id === 'nuit-hotel') return { spot: 'bed', pose: 'idle' }
  if (id === 'brunch-lagune' || id === 'resto-u') return { spot: 'table', pose: 'eat' }
  if (id === 'bar-hotel') return { spot: 'table', pose: 'drink' }
  if (/^(sleep|nap)$/.test(id)) return { spot: 'bed', pose: 'idle' }
  if (/^(biberon|bouillie|hochet|calin)$/.test(id)) return { spot: 'mat', pose: 'busy' }
  if (id === 'bain-bebe' || id === 'shower') return { spot: 'shower', pose: 'idle' }
  if (id === 'cook-attieke') return { spot: 'stove', pose: 'busy' }
  if (id === 'watch-tv' || id === 'call-family') return { spot: 'sofa', pose: 'sit' }
  if (id === 'devoirs' || id === 'jouer-cour') return { spot: 'table', pose: id === 'devoirs' ? 'write' : 'dance' }
  if (id === 'travaillement') return { spot: 'floor', pose: 'throw' }
  if (/dance|party|coupe/.test(id)) return { spot: 'floor', pose: 'dance' }
  if (/^(drink|milkshake|coffee)/.test(id) || id.includes('drink')) return { spot: 'table', pose: 'drink' }
  if (/^(eat|burger|glace|anniversaire)/.test(id) || id.startsWith('golvo-')) return { spot: 'table', pose: 'eat' }
  if (kind === 'school' || kind === 'universite' || kind === 'office' || /cours|biblio|conference|read-ads|work/.test(id)) return { spot: 'desk', pose: 'write' }
  if (kind === 'culture' || kind === 'worship' || id === 'visite-malade') return { spot: 'seat', pose: 'sit' }
  if (id === 'consultation') return { spot: 'bed', pose: 'idle' }
  if (kind === 'market' || kind === 'mall') return { spot: 'stall', pose: 'busy' }
  return { spot: 'counter', pose: 'idle' }
}

/* ---------- Furniture ---------- */

function Table({ p, c = '#f4f1ea', chairs = '#d62828' }: { p: V3; c?: string; chairs?: string }) {
  return (
    <group position={p}>
      <Box p={[0, 0.74, 0]} s={[1.3, 0.06, 0.9]} c={c} />
      {[-0.55, 0.55].flatMap((x) => [-0.35, 0.35].map((z) => <Box key={`${x}${z}`} p={[x, 0.37, z]} s={[0.06, 0.74, 0.06]} c={c} />))}
      {[-1, 1].map((s) => (
        <group key={s} position={[0, 0, s * 0.85]}>
          {/* The red plastic chairs of every maquis */}
          <Box p={[0, 0.44, 0]} s={[0.5, 0.05, 0.5]} c={chairs} />
          <Box p={[0, 0.75, s * 0.24]} s={[0.5, 0.6, 0.05]} c={chairs} />
          {[-0.2, 0.2].flatMap((x) => [-0.2, 0.2].map((z) => <Box key={`${x}${z}`} p={[x, 0.22, z]} s={[0.04, 0.44, 0.04]} c={chairs} />))}
        </group>
      ))}
    </group>
  )
}

function Plate({ p }: { p: V3 }) {
  return (
    <group position={p}>
      <mesh position={[0, 0.79, 0]}>
        <cylinderGeometry args={[0.16, 0.13, 0.03, 16]} />
        <meshLambertMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0, 0.82, 0]}>
        <sphereGeometry args={[0.1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshLambertMaterial color="#f2e6c9" />
      </mesh>
      <Box p={[0.32, 0.88, 0.1]} s={[0.07, 0.22, 0.07]} c="#2b7a3d" />
    </group>
  )
}

function Bed({ p, c }: { p: V3; c: string }) {
  return (
    <group position={p}>
      <Box p={[0, 0.25, 0]} s={[1.6, 0.5, 2.2]} c="#7a5230" />
      <Box p={[0, 0.55, 0.05]} s={[1.5, 0.15, 2.05]} c={c} />
      <Box p={[0, 0.68, -0.8]} s={[1.2, 0.14, 0.4]} c="#ffffff" />
      <Box p={[0, 0.9, -1.12]} s={[1.6, 1.3, 0.1]} c="#5c3d22" />
    </group>
  )
}

function Sofa({ p, c, r = 0 }: { p: V3; c: string; r?: number }) {
  return (
    <group position={p} rotation={[0, r, 0]}>
      <Box p={[0, 0.25, 0]} s={[2.2, 0.5, 0.9]} c={c} />
      <Box p={[0, 0.7, -0.38]} s={[2.2, 0.6, 0.18]} c={c} />
      {[-1, 1].map((s) => (
        <Box key={s} p={[s * 1.05, 0.5, 0]} s={[0.2, 0.5, 0.9]} c={c} />
      ))}
    </group>
  )
}

function Speaker({ p }: { p: V3 }) {
  return (
    <group position={p}>
      <Box p={[0, 0.8, 0]} s={[0.7, 1.6, 0.6]} c="#141416" />
      {[0.5, 1.15].map((y) => (
        <mesh key={y} position={[0, y, 0.31]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.22, 0.22, 0.02, 16]} />
          <meshLambertMaterial color="#3a3f4b" />
        </mesh>
      ))}
    </group>
  )
}

/** Disco lights turning over the dance floor. */
function DiscoLights() {
  const ref = useRef<THREE.Group>(null)
  useFrame(() => {
    if (ref.current) ref.current.rotation.y = worldTime() * 0.8
  })
  return (
    <group ref={ref} position={[1.5, 3, 0.5]}>
      {['#ff2d95', '#2ee6ff', '#ffe600', '#7a5cff'].map((c, i) => (
        <spotLight key={c} color={c} intensity={30} distance={8} angle={0.5} penumbra={0.6} position={[Math.cos((i * Math.PI) / 2) * 1.5, 0, Math.sin((i * Math.PI) / 2) * 1.5]} target-position={[0, -3, 0]} />
      ))}
      <mesh>
        <sphereGeometry args={[0.25, 12, 8]} />
        <meshStandardMaterial color="#ddd" metalness={1} roughness={0.15} />
      </mesh>
    </group>
  )
}

/** Banknotes flying from the Sim's hand onto the dancers in front: the travaillement. */
function NoteRain({ from }: { from: V3 }) {
  const COUNT = 60
  const ref = useRef<THREE.InstancedMesh>(null)
  const notes = useMemo(() => [...Array(COUNT)].map((_, i) => ({ x: 0, y: -1, z: 0, vx: 0, vy: 0, vz: 0, rot: 0, delay: i * 0.12 })), [])
  const m = useMemo(() => new THREE.Object3D(), [])
  useFrame((_, dt) => {
    const mesh = ref.current
    if (!mesh) return
    const t = worldTime()
    notes.forEach((n, i) => {
      if (n.y <= 0.02) {
        if (t < n.delay) return
        // Thrown again from the hand, up and out over the dancers.
        Object.assign(n, { x: from[0] + 0.1, y: from[1] + 1.9, z: from[2] - 0.3, vx: (Math.random() - 0.4) * 1.6, vy: 1.5 + Math.random(), vz: -(0.8 + Math.random() * 1.6), delay: t + 4 + Math.random() * 3 })
      }
      n.vy -= 3 * dt
      n.vx *= 0.98
      n.vz *= 0.98
      n.x += n.vx * dt
      n.y = Math.max(0.01, n.y + n.vy * dt * 0.6)
      n.z += n.vz * dt
      n.rot += dt * 6
      m.position.set(n.x, n.y, n.z)
      m.rotation.set(n.rot, n.rot * 0.7, 0)
      m.updateMatrix()
      mesh.setMatrixAt(i, m.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, COUNT]}>
      <planeGeometry args={[0.16, 0.08]} />
      <meshBasicMaterial color="#4caf50" side={THREE.DoubleSide} />
    </instancedMesh>
  )
}

/* ---------- Rooms ---------- */

function room(kind: string, housing: string): Room {
  switch (kind) {
    case 'home': {
      const rich = housing === 'villa' || housing === 'appart'
      return {
        floor: rich ? '#d9c7a8' : '#b7a58a',
        wall: rich ? '#f4ead8' : '#e3c9a3',
        furniture: (
          <>
            <Bed p={[-4, 0, -2.6]} c={rich ? '#3d5a80' : '#c95b4a'} />
            <Sofa p={[1.5, 0, -3.4]} c={rich ? '#2a6f97' : '#8a5a2b'} />
            <Box p={[1.5, 0.9, 3.9]} s={[1.6, 0.9, 0.1]} c="#141416" />
            <Box p={[1.5, 0.3, 3.9]} s={[1.8, 0.6, 0.5]} c="#5c3d22" />
            <Table p={[4.3, 0, 0.6]} c="#a0763c" chairs="#5c3d22" />
            {/* Kitchen corner and the shower */}
            <Box p={[5.2, 0.45, -3.6]} s={[1.4, 0.9, 1.4]} c="#cfd4dc" />
            <mesh position={[5.2, 0.95, -3.6]}>
              <cylinderGeometry args={[0.18, 0.18, 0.1, 12]} />
              <meshLambertMaterial color="#222" />
            </mesh>
            <Box p={[-5.2, 0.03, 2.8]} s={[1.4, 0.06, 1.4]} c="#9ecbe0" />
            <Box p={[-5.8, 1.2, 2.8]} s={[0.08, 2.4, 1.4]} c="#cfe4ee" />
            {/* A playmat for the little ones */}
            <Box p={[-1.6, 0.02, 1.2]} s={[1.8, 0.03, 1.4]} c="#ffc8dd" />
          </>
        ),
        spots: {
          bed: { p: [-4, 0.62, -2.4], pose: 'idle', lying: true },
          sofa: { p: [1.5, 0.05, -3.2], pose: 'sit' },
          stove: { p: [5.2, 0, -2.6], r: Math.PI, pose: 'busy' },
          shower: { p: [-5.2, 0.06, 2.8], r: Math.PI / 2, pose: 'idle' },
          table: { p: [4.3, 0, 1.45], r: Math.PI, pose: 'eat' },
          mat: { p: [-1.6, 0.04, 1.2], pose: 'busy' },
          entrance: { p: [0, 0, 3], r: Math.PI, pose: 'idle' },
          counter: { p: [0, 0, 1], pose: 'idle' },
        },
        crowd: [{ p: [1.0, 0.05, -3.2], pose: 'sit' }],
      }
    }
    case 'maquis':
      return {
        floor: '#a8714a',
        wall: '#e8b04b',
        furniture: (
          <>
            {[[-3.5, -2.5], [0.5, -2.5], [-3.5, 1.5], [4, 2.2]].map(([x, z]) => (
              <group key={`${x}${z}`}>
                <Table p={[x, 0, z]} />
                <Plate p={[x - 0.3, 0, z - 0.1]} />
              </group>
            ))}
            {/* The grill with the braise, and the bar with its crates */}
            <Box p={[4.6, 0.5, -3.4]} s={[2, 1, 0.8]} c="#3a3f4b" />
            <Box p={[4.6, 1.02, -3.4]} s={[1.8, 0.04, 0.6]} c="#ff6a00" glow={0.8} />
            <Box p={[-5.2, 0.55, 3.2]} s={[1.2, 1.1, 2.4]} c="#7a5230" />
            {[0, 1, 2].map((k) => (
              <Box key={k} p={[-5.7, 0.2 + k * 0.32, 1.5]} s={[0.5, 0.3, 0.4]} c="#d62828" />
            ))}
            <Speaker p={[-5.3, 0, -3.8]} />
            {/* String lights */}
            {[...Array(9)].map((_, i) => (
              <mesh key={i} position={[-5 + i * 1.25, 2.9 - Math.sin((i / 8) * Math.PI) * 0.3, 0]}>
                <sphereGeometry args={[0.07, 8, 6]} />
                <meshBasicMaterial color={['#ffd166', '#ef476f', '#06d6a0'][i % 3]} />
              </mesh>
            ))}
          </>
        ),
        spots: {
          table: { p: [0.5, 0, -1.65], r: Math.PI, pose: 'eat' },
          floor: { p: [1.5, 0, 1.2], pose: 'dance' },
          entrance: { p: [0, 0, 3.4], r: Math.PI, pose: 'idle' },
          counter: { p: [-4.3, 0, 3.2], r: -Math.PI / 2, pose: 'idle' },
        },
        crowd: [
          { p: [0.5, 0, -3.35], pose: 'eat' },
          { p: [-3.5, 0, -1.65], r: Math.PI, pose: 'drink' },
          { p: [-3.5, 0, -3.35], pose: 'eat' },
          { p: [4, 0, 3.05], r: Math.PI, pose: 'drink' },
          { p: [4.6, 0, -2.5], r: Math.PI, pose: 'busy' },
          { p: [2.6, 0, 1.0], r: -0.6, pose: 'dance' },
          { p: [0.2, 0, 0.6], r: 0.8, pose: 'dance' },
        ],
      }
    case 'club':
      return {
        floor: '#1b1530',
        wall: '#2a1f4a',
        dark: true,
        furniture: (
          <>
            {/* The dance floor, the DJ, the sofas of the big spenders */}
            <Box p={[1.5, 0.02, 0.5]} s={[5, 0.04, 4]} c="#3d2b6b" />
            <Box p={[1.5, 0.6, -3.6]} s={[2.4, 1.2, 0.9]} c="#141416" />
            <Box p={[1.5, 1.25, -3.6]} s={[1.2, 0.1, 0.6]} c="#2ee6ff" glow={1} />
            <Speaker p={[-1.2, 0, -3.8]} />
            <Speaker p={[4.2, 0, -3.8]} />
            <Sofa p={[-4.4, 0, -2]} c="#8a1c4a" r={Math.PI / 2} />
            <Sofa p={[-4.4, 0, 2]} c="#8a1c4a" r={Math.PI / 2} />
            <Box p={[5.2, 0.55, 2.5]} s={[1.2, 1.1, 3]} c="#3a3f4b" />
            <DiscoLights />
          </>
        ),
        spots: {
          floor: { p: [0.3, 0, 1.6], r: Math.PI * 0.85, pose: 'dance' },
          table: { p: [-4.2, 0.05, -2], r: Math.PI / 2, pose: 'drink' },
          entrance: { p: [0, 0, 3.6], r: Math.PI, pose: 'idle' },
          counter: { p: [4.4, 0, 2.5], r: Math.PI / 2, pose: 'idle' },
        },
        crowd: [
          { p: [1.4, 0, 0.2], r: 0.4, pose: 'dance' },
          { p: [2.6, 0, 0.9], r: -0.5, pose: 'dance' },
          { p: [1.9, 0, -0.9], r: 0.2, pose: 'dance' },
          { p: [3.4, 0, -0.2], r: -0.9, pose: 'cheer' },
          { p: [0.6, 0, -0.4], r: 0.9, pose: 'dance' },
          { p: [1.5, 0, -2.9], pose: 'busy' },
          { p: [-4.2, 0.05, 2], r: Math.PI / 2, pose: 'drink' },
        ],
      }
    case 'restaurant':
      return {
        floor: '#e9e2d5',
        wall: '#f6c453',
        furniture: (
          <>
            <Box p={[-1, 0.55, -3.6]} s={[6, 1.1, 0.9]} c="#c8102e" />
            <Box p={[-1, 2.2, -4.3]} s={[5, 0.8, 0.1]} c="#141416" />
            {[[-3.5, 0.5], [0.5, 0.5], [4, -1.5], [4, 2]].map(([x, z]) => (
              <group key={`${x}${z}`}>
                <Table p={[x, 0, z]} c="#ffffff" chairs="#6c4a2b" />
                <Plate p={[x - 0.3, 0, z - 0.1]} />
              </group>
            ))}
          </>
        ),
        spots: {
          table: { p: [0.5, 0, 1.35], r: Math.PI, pose: 'eat' },
          entrance: { p: [0, 0, 3.6], r: Math.PI, pose: 'idle' },
          counter: { p: [-1, 0, -2.8], r: Math.PI, pose: 'idle' },
        },
        crowd: [
          { p: [-1, 0, -4.2], pose: 'busy' },
          { p: [-3.5, 0, -0.35], pose: 'eat' },
          { p: [4, 0, -0.65], r: Math.PI, pose: 'drink' },
        ],
      }
    case 'school':
    case 'office':
    case 'mairie': {
      const school = kind === 'school'
      return {
        floor: school ? '#c9b38f' : '#d5d9e0',
        wall: school ? '#f2e3c6' : '#eef1f6',
        furniture: (
          <>
            {school && <Box p={[0, 1.6, -4.4]} s={[5, 1.4, 0.06]} c="#264d3b" />}
            {!school && <Box p={[0, 0.55, -3.4]} s={[7, 1.1, 0.8]} c="#7a8099" />}
            {[...Array(school ? 6 : 4)].map((_, i) => {
              const x = -3.6 + (i % 3) * 3.6
              const z = school ? -1.2 + Math.floor(i / 3) * 2.4 : 0.2 + Math.floor(i / 2) * 2.2
              return (
                <group key={i} position={[school ? x : -2.5 + (i % 2) * 5, 0, z]}>
                  <Box p={[0, 0.72, 0]} s={[1.4, 0.06, 0.7]} c="#b08d57" />
                  <Box p={[0, 0.36, 0]} s={[1.3, 0.72, 0.06]} c="#8a6a3d" />
                  <Box p={[0, 0.44, 0.7]} s={[0.5, 0.05, 0.5]} c="#3a3f4b" />
                </group>
              )
            })}
          </>
        ),
        spots: {
          desk: school ? { p: [0, 0, -0.5], r: Math.PI, pose: 'write' } : { p: [2.5, 0, 0.9], r: Math.PI, pose: 'write' },
          entrance: { p: [0, 0, 3.6], r: Math.PI, pose: 'idle' },
          counter: { p: [0, 0, -2.6], r: Math.PI, pose: 'idle' },
        },
        crowd: school
          ? [{ p: [0, 0, -3.6], pose: 'wave' }, { p: [-3.6, 0, -0.5], r: Math.PI, pose: 'write' }, { p: [3.6, 0, -0.5], r: Math.PI, pose: 'write' }, { p: [-3.6, 0, 1.9], r: Math.PI, pose: 'write' }, { p: [3.6, 0, 1.9], r: Math.PI, pose: 'write' }]
          : [{ p: [0, 0, -4.1], pose: 'busy' }, { p: [-2.5, 0, 0.9], r: Math.PI, pose: 'write' }, { p: [-2.5, 0, 3.1], r: Math.PI, pose: 'write' }],
      }
    }
    case 'health':
      return {
        floor: '#e2ecef',
        wall: '#f7fbfc',
        furniture: (
          <>
            {[-3.5, 0, 3.5].map((x) => (
              <Bed key={x} p={[x, 0, -2.6]} c="#d7eef5" />
            ))}
            {[...Array(5)].map((_, i) => (
              <Box key={i} p={[-4 + i * 1.2, 0.45, 2.8]} s={[0.9, 0.08, 0.9]} c="#4a90a4" />
            ))}
          </>
        ),
        spots: {
          bed: { p: [0, 0.62, -2.4], pose: 'idle', lying: true },
          seat: { p: [-1.6, 0.05, 2.8], r: Math.PI, pose: 'sit' },
          entrance: { p: [0, 0, 3.8], r: Math.PI, pose: 'idle' },
          counter: { p: [1, 0, 0], pose: 'idle' },
        },
        crowd: [{ p: [1.2, 0, -1.4], r: Math.PI, pose: 'busy' }, { p: [-3.5, 0.62, -2.4], pose: 'idle', lying: true }, { p: [-4, 0.05, 2.8], r: Math.PI, pose: 'sit' }],
      }
    case 'market':
    case 'mall':
      return {
        floor: kind === 'mall' ? '#e6e6e6' : '#b39a78',
        wall: kind === 'mall' ? '#ffffff' : '#c9a46b',
        furniture: (
          <>
            {[-3.5, 0, 3.5].flatMap((x) =>
              [-2, 1.5].map((z) => (
                <group key={`${x}${z}`} position={[x, 0, z]}>
                  <Box p={[0, 0.5, 0]} s={[2.2, 1, 1]} c={kind === 'mall' ? '#cfd4dc' : '#7a5230'} />
                  {[...Array(5)].map((_, i) => (
                    <mesh key={i} position={[-0.8 + i * 0.4, 1.12, 0]}>
                      <sphereGeometry args={[0.15, 8, 6]} />
                      <meshLambertMaterial color={['#e63946', '#f4a261', '#2a9d8f', '#e9c46a', '#8ac926'][i]} />
                    </mesh>
                  ))}
                </group>
              )),
            )}
          </>
        ),
        spots: {
          stall: { p: [0, 0, 0.6], r: Math.PI, pose: 'busy' },
          table: { p: [0, 0, 3], pose: 'eat' },
          entrance: { p: [0, 0, 3.6], r: Math.PI, pose: 'idle' },
          counter: { p: [0, 0, 0.6], r: Math.PI, pose: 'idle' },
        },
        crowd: [{ p: [-3.5, 0, -2.9], pose: 'busy' }, { p: [3.5, 0, 0.6], pose: 'busy' }, { p: [-3.5, 0, 2.4], r: Math.PI, pose: 'wave' }],
      }
    case 'police':
      // The commissariat: a counter, and the cell behind its bars.
      return {
        floor: '#8d8f93',
        wall: '#c9cbbf',
        furniture: (
          <>
            <Box p={[3, 0.55, 1]} s={[3, 1.1, 0.8]} c="#5b6472" />
            <Box p={[-3.5, 0.45, -3.9]} s={[4, 0.12, 0.8]} c="#6b5a45" />
            {[...Array(11)].map((_, i) => (
              <mesh key={i} position={[-5.8 + i * 0.45, 1.5, -1.6]}>
                <cylinderGeometry args={[0.04, 0.04, 3, 8]} />
                <meshLambertMaterial color="#2b2f3a" />
              </mesh>
            ))}
            <Box p={[-3.5, 2.95, -1.6]} s={[4.8, 0.1, 0.1]} c="#2b2f3a" />
          </>
        ),
        spots: {
          seat: { p: [-3.3, 0.06, -3.6], pose: 'sit' },
          entrance: { p: [0, 0, 3.6], r: Math.PI, pose: 'idle' },
          counter: { p: [3, 0, 2], r: Math.PI, pose: 'idle' },
        },
        crowd: [
          { p: [3, 0, 0.2], pose: 'write' },
          { p: [1.2, 0, -0.8], r: -2.4, pose: 'idle' },
          { p: [-4.6, 0.06, -3.6], pose: 'sit' },
        ],
      }
    case 'barbier':
    case 'salon': {
      // Chairs facing the mirrors, the bench where people wait and talk.
      const salon = kind === 'salon'
      const seat = salon ? '#c2255c' : '#141416'
      return {
        floor: salon ? '#f3d9e3' : '#d8dde3',
        wall: salon ? '#ffe3ee' : '#e7f0f7',
        furniture: (
          <>
            <Box p={[0, 0.9, -4.15]} s={[10.5, 0.08, 0.5]} c="#f8f9fa" />
            {[-3.5, 0, 3.5].map((x) => (
              <group key={x} position={[x, 0, 0]}>
                <Box p={[0, 1.75, -4.4]} s={[1.5, 1.3, 0.05]} c="#cfe8ff" />
                <Box p={[0, 0.2, -3.2]} s={[0.3, 0.4, 0.3]} c="#868e96" />
                <Box p={[0, 0.46, -3.2]} s={[0.65, 0.12, 0.6]} c={seat} />
                <Box p={[0, 0.85, -2.88]} s={[0.65, 0.75, 0.1]} c={seat} />
                {salon && x < 0 && (
                  <mesh position={[0, 1.55, -3.2]}>
                    <sphereGeometry args={[0.38, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
                    <meshLambertMaterial color="#e9ecef" />
                  </mesh>
                )}
              </group>
            ))}
            <Box p={[4.8, 0.45, 1.3]} s={[0.6, 0.1, 3.4]} c="#8a6a3d" />
            {/* The TV in the corner: football at the barbier's, a série at the salon's */}
            <Box p={[-5.9, 2.2, 0]} s={[0.06, 0.9, 1.5]} c="#141416" />
            <Box p={[-5.85, 2.2, 0]} s={[0.04, 0.75, 1.35]} c={salon ? '#f783ac' : '#2b8a3e'} glow={0.4} />
          </>
        ),
        spots: {
          chair: { p: [0, 0.06, -3.15], r: Math.PI, pose: 'sit' },
          bench: { p: [3.7, 0, 1.3], r: Math.PI / 2, pose: 'rant' },
          entrance: { p: [0, 0, 3.6], r: Math.PI, pose: 'idle' },
          counter: { p: [1.2, 0, -1.8], r: Math.PI, pose: 'idle' },
        },
        crowd: [
          { p: [-3.5, 0.06, -3.15], r: Math.PI, pose: 'sit', g: salon ? 'femme' : 'homme' },
          { p: [-2.8, 0, -2.4], r: Math.PI * 0.85, pose: 'busy', g: salon ? 'femme' : 'homme' },
          { p: [0.8, 0, -2.5], r: Math.PI * 0.8, pose: 'busy', g: salon ? 'femme' : 'homme' },
          { p: [4.55, 0.05, 0.3], r: -Math.PI / 2, pose: 'sit' },
          { p: [4.55, 0.05, 2.3], r: -Math.PI / 2, pose: 'cheer' },
        ],
      }
    }
    case 'hotel':
      // The lobby of a grand hotel, opening onto the pool; a suite at the back.
      return {
        floor: '#efe9df',
        wall: '#d9c7a3',
        furniture: (
          <>
            <Box p={[-3, 0.55, -3.6]} s={[4, 1.1, 0.8]} c="#6b4a32" />
            <Box p={[-3, 1.12, -3.6]} s={[4.1, 0.06, 0.9]} c="#c9a227" />
            <Box p={[1.5, 0.02, 0.6]} s={[5.4, 0.06, 4.6]} c="#f8f9fa" />
            <Box p={[1.5, 0.05, 0.6]} s={[4.6, 0.06, 3.8]} c="#3fb6e0" glow={0.2} />
            <Bed p={[4.4, 0, -3.3]} c="#f1e3c8" />
            <Sofa p={[-4.6, 0, 1.6]} c="#2c4a6b" r={Math.PI / 2} />
            <Table p={[-2.2, 0, 2.6]} c="#ffffff" chairs="#c9a227" />
            <Plate p={[-2.5, 0, 2.5]} />
          </>
        ),
        spots: {
          pool: { p: [1.6, 0.05, 0.9], r: 0.4, pose: 'idle' },
          bed: { p: [4.4, 0.62, -3.1], pose: 'idle', lying: true },
          table: { p: [-2.2, 0, 3.45], r: Math.PI, pose: 'eat' },
          entrance: { p: [0, 0, 3.8], r: Math.PI, pose: 'idle' },
          counter: { p: [-3, 0, -2.8], r: Math.PI, pose: 'idle' },
        },
        crowd: [
          { p: [-3, 0, -4.2], pose: 'busy' },
          { p: [2.6, 0.05, 0], r: -0.6, pose: 'wave' },
          { p: [-4.6, 0.05, 1.2], r: Math.PI / 2, pose: 'sit' },
          { p: [-2.2, 0, 1.75], pose: 'drink' },
        ],
      }
    case 'universite':
      // The amphi: rows rising to the back, the professor at the board.
      return {
        floor: '#b9a27e',
        wall: '#e8dcc4',
        furniture: (
          <>
            <Box p={[1, 1.7, -4.4]} s={[6, 1.5, 0.06]} c="#264d3b" />
            <Box p={[1, 0.5, -3.3]} s={[1.4, 1, 0.6]} c="#7a5230" />
            {[0, 1, 2].map((row) => (
              <group key={row} position={[1, row * 0.3, -1.4 + row * 1.6]}>
                {row > 0 && <Box p={[0, -0.15, 0.3]} s={[8, 0.3, 1.6]} c="#a68d68" />}
                <Box p={[0, 0.74, 0]} s={[8, 0.06, 0.5]} c="#8a6a3d" />
                <Box p={[0, 0.37, -0.22]} s={[8, 0.74, 0.06]} c="#6b5030" />
                <Box p={[0, 0.44, 0.55]} s={[8, 0.06, 0.4]} c="#6b5030" />
              </group>
            ))}
            <Table p={[-4.4, 0, 1.6]} c="#ffffff" chairs="#1e88e5" />
            <Plate p={[-4.6, 0, 1.5]} />
          </>
        ),
        spots: {
          desk: { p: [1.4, 0.3, 0.75], r: Math.PI, pose: 'write' },
          table: { p: [-4.4, 0, 2.45], r: Math.PI, pose: 'eat' },
          entrance: { p: [0, 0, 3.8], r: Math.PI, pose: 'idle' },
          counter: { p: [1, 0, -2.4], r: Math.PI, pose: 'idle' },
        },
        crowd: [
          { p: [1, 0, -3.8], pose: 'wave' },
          { p: [-1.5, 0, -0.85], r: Math.PI, pose: 'write' },
          { p: [3.2, 0, -0.85], r: Math.PI, pose: 'write' },
          { p: [-0.8, 0.3, 0.75], r: Math.PI, pose: 'write' },
          { p: [3.8, 0.6, 2.35], r: Math.PI, pose: 'write' },
          { p: [-1.6, 0.6, 2.35], r: Math.PI, pose: 'idle' },
        ],
      }
    default: // worship, culture: rows of seats facing the front
      return {
        floor: '#c9b08a',
        wall: kind === 'worship' ? '#f6f1e7' : '#3a2f4a',
        furniture: (
          <>
            <Box p={[0, 0.3, -3.6]} s={[6, 0.6, 1.6]} c={kind === 'worship' ? '#e9dcc0' : '#141416'} />
            {[...Array(3)].map((_, row) => (
              <Box key={row} p={[0, 0.45, -0.5 + row * 1.5]} s={[8, 0.1, 0.5]} c="#7a5230" />
            ))}
          </>
        ),
        spots: {
          seat: { p: [0.6, 0.05, -0.4], r: Math.PI, pose: 'sit' },
          entrance: { p: [0, 0, 3.6], r: Math.PI, pose: 'idle' },
          counter: { p: [0, 0, 0], pose: 'idle' },
        },
        crowd: [{ p: [0, 0.6, -3.6], pose: kind === 'worship' ? 'wave' : 'dance' }, { p: [-2.4, 0.05, -0.4], r: Math.PI, pose: 'sit' }, { p: [2.8, 0.05, 1.1], r: Math.PI, pose: 'sit' }],
      }
  }
}

/* ---------- The scene ---------- */

export function Interior({ sim, kind, placeId, interactionId, housing, night, stage, others = [] }: { sim: Sim; kind: string; placeId: string; interactionId?: string; housing: string; night: boolean; stage: string; others?: Player[] }) {
  const r = room(kind, housing)
  const style = useRoomStyle(kind, housing)
  const act = action(kind, interactionId)
  const me = r.spots[act.spot] ?? r.spots.entrance
  const people = useMemo<Person[]>(() => {
    const rand = rng(`inside${placeId}`)
    return r.crowd.map((s) => {
      // The club's dance floor is the women's; elsewhere anyone.
      const gender: Person['gender'] = s.g ?? (kind === 'club' && s.pose === 'dance' ? 'femme' : kind === 'salon' && rand() < 0.8 ? 'femme' : rand() < 0.5 ? 'femme' : 'homme')
      return { ...s, gender, look: randomLook(gender, rand), seed: rand() * 100 }
    })
  }, [placeId, kind]) // eslint-disable-line react-hooks/exhaustive-deps
  const dark = r.dark || night
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [8.4, 8.6, 10.8], fov: 42 }} style={{ background: dark ? '#0b0d1f' : '#2a2340' }}>
      <Suspense fallback={null}>
        <hemisphereLight args={[dark ? '#7a6ab0' : '#fff6e8', '#3a2a1a', dark ? 0.55 : 0.75]} />
        <ambientLight intensity={dark ? 0.15 : 0.25} />
        {kind === 'club' && <pointLight position={[0, 2.9, 0]} intensity={14} distance={14} color="#b18cff" />}
        <Shell floor={r.floor} floorType={style.floorType} wall={r.wall} lower={style.lower} openings={style.openings} night={night} dark={r.dark} lamps={style.lamps} fan={style.fan} />
        {style.decor(dark)}
        {r.furniture}
        <NoShadows>
          {people.map((p, i) => (
            <group key={i} position={p.p} rotation={p.lying ? [-Math.PI / 2, 0, 0] : [0, p.r ?? 0, 0]}>
              <Human look={p.look} gender={p.gender} pose={p.pose} seed={p.seed} />
            </group>
          ))}
        </NoShadows>
        <group position={me.p} rotation={me.lying ? [-Math.PI / 2, 0, 0] : [0, me.r ?? 0, 0]}>
          <Character look={sim.look} gender={sim.gender} stage={stage} plumbob={!me.lying} busy={act.pose === 'busy'} pose={act.pose} />
        </group>
        {act.pose === 'throw' && <NoteRain from={me.p} />}
        {/* Turn around the room and zoom, within the cut-away side */}
        <OrbitControls target={[0, 0.8, 0]} enablePan={false} minDistance={7} maxDistance={24} minPolarAngle={0.35} maxPolarAngle={1.25} minAzimuthAngle={0.15} maxAzimuthAngle={1.4} enableDamping />
        {RICH && (
          <EffectComposer enableNormalPass={false} multisampling={0}>
            <N8AO halfRes aoRadius={1.2} distanceFalloff={0.6} intensity={2.2} quality="performance" color="#1a1410" />
          </EffectComposer>
        )}
        {/* Other players here, side by side with the Sim (blue plumbob) */}
        {others.slice(0, 3).map((o, i) => {
          const a = action(kind, o.activity?.interactionId)
          const at = r.spots[a.spot] ?? r.spots.entrance
          const dx = [-0.95, 0.95, 1.9][i]
          return (
            <group key={o.id} position={[at.p[0] + dx, at.p[1], at.p[2]]} rotation={[0, at.r ?? 0, 0]}>
              <Character look={o.look} gender={o.gender} stage={o.stage} pose={a.pose} moodColor="#3b82f6" />
            </group>
          )
        })}
      </Suspense>
    </Canvas>
  )
}
