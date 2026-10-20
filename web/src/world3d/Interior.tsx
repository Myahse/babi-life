import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Snapper } from './snapshot'
import { roomGrid } from './interior/roomGrid'
import { gridWay } from './gridPath'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { ROOM, Shell } from './interior/Shell'
import { NoteShower } from './money'
import { ClubCrowd } from './clubNight'
import { useRoomStyle } from './interior/Decor'
import * as THREE from 'three'
import type { Player, Sim } from '../lib/types'
import { Human, NoShadows, type Pose } from '../avatar/Human'
import { OUTFIT_DEFAULT_COLOR, randomLook, workLook } from '../avatar/options'
import { Box } from './props'
import { Character } from './Character'
import { ActionProps, Pot, SewingTable, TvScreen, Zzz } from './interior/ActionProps'
import { rng } from './themes'
import { worldTime } from '../lib/worldClock'
import { listenKeys, moveInput } from './input'

/** Soft shade in the corners, downloaded only on phones that show it. */
const AmbientOcclusion = lazy(() => import('./effects'))

// Inside a place, like when a Sim goes through a door in the Sims: a cutaway
// room with its furniture, the people who are there, and the player's Sim
// acting out what it's doing (eating at a table, dancing, throwing notes on
// the dancers in the club, asleep in bed…).

type V3 = [number, number, number]
/** Where someone is and what they're doing. */
type Spot = { p: V3; r?: number; pose: Pose; lying?: boolean; g?: 'femme' | 'homme'; /** What they wear there (the swimsuit in the pool). */ outfit?: string }
type Person = Spot & { gender: 'femme' | 'homme'; look: ReturnType<typeof randomLook>; seed: number }

/** Kinds of places that have an inside (the beach or the football pitch don't). */
export const INDOOR = new Set(['gym', 'boutique', 'couture', 'pharmacie', 'police', 'home', 'maquis', 'club', 'restaurant', 'market', 'office', 'mairie', 'school', 'health', 'worship', 'mall', 'culture', 'barbier', 'salon', 'hotel', 'universite'])

/** Ambient occlusion where the device can afford it. */
const RICH = typeof navigator === 'undefined' || (navigator.hardwareConcurrency ?? 4) > 4


type Room = { floor: string; wall: string; dark?: boolean; furniture: React.ReactNode; spots: Record<string, Spot>; crowd: Spot[] }

/** What the Sim does there: where it goes and how it moves. */
export function action(kind: string, id: string | undefined): { spot: string; pose: Pose } {
  if (!id) return { spot: 'entrance', pose: 'idle' }
  // At work: where the job is done there, and how.
  if (id === 'work') {
    if (kind === 'maquis' || kind === 'restaurant') return { spot: 'counter', pose: 'cook' }
    if (kind === 'office' || kind === 'mairie') return { spot: 'desk', pose: 'write' }
    if (kind === 'school' || kind === 'universite') return { spot: 'counter', pose: 'talk' }
    if (kind === 'club') return { spot: 'floor', pose: 'dance' }
    if (kind === 'market' || kind === 'mall' || kind === 'boutique') return { spot: 'stall', pose: 'busy' }
    return { spot: 'counter', pose: 'busy' }
  }
  if (id === 'garde-a-vue') return { spot: 'seat', pose: 'sit' }
  // The gym: the bench, the treadmill, the class on the floor, the showers.
  if (id === 'musculation') return { spot: 'bench', pose: 'busy' }
  if (id === 'cardio') return { spot: 'treadmill', pose: 'run' }
  if (id === 'cours-collectif') return { spot: 'floor', pose: 'dance' }
  if (id === 'tractions') return { spot: 'pullup', pose: 'hang' }
  if (id === 'boxe-sac') return { spot: 'punch', pose: 'kick' }
  if (id === 'corde-a-sauter') return { spot: 'rope', pose: 'leap' }
  if (id === 'douche-vestiaire') return { spot: 'shower', pose: 'wash' }
  if (/^(degrade|boule-a-zero|taille-barbe|tresses|tissage|chignon|manucure|coupe-courte|iroquoise|nattes|vanilles|macarons|carre|coudre-pagne|retouche)$/.test(id)) return { spot: 'chair', pose: 'sit' }
  // Gbairai: telling the quarter's news, with the hands.
  if (id === 'gbairai') return kind === 'couture' ? { spot: 'chair', pose: 'sit' } : { spot: kind === 'barbier' || kind === 'salon' ? 'bench' : 'table', pose: 'rant' }
  // The coffee break at the office: a cup at one's desk.
  if (id === 'coffee-break') return { spot: 'desk', pose: 'drink' }
  if (id === 'piscine-hotel') return { spot: 'pool', pose: 'idle' }
  if (id === 'nuit-hotel') return { spot: 'bed', pose: 'sleep' }
  if (id === 'brunch-lagune' || id === 'resto-u') return { spot: 'table', pose: 'eat' }
  if (id === 'bar-hotel') return { spot: 'table', pose: 'drink' }
  if (/^(sleep|nap)$/.test(id)) return { spot: 'bed', pose: 'sleep' }
  if (/^(biberon|bouillie|hochet|calin)$/.test(id)) return { spot: 'mat', pose: 'busy' }
  if (id === 'shower') return { spot: 'shower', pose: 'wash' }
  if (id === 'bain-bebe') return { spot: 'shower', pose: 'busy' }
  if (id === 'pray') return { spot: 'seat', pose: 'pray' }
  // At a counter: asking, explaining, filling in the papers; the shopping picked off the shelves.
  if (id === 'courses') return { spot: 'stall', pose: 'busy' }
  if (id === 'credit') return { spot: kind === 'boutique' ? 'stall' : 'counter', pose: 'phone' }
  if (id === 'conseil' && kind === 'mairie') return { spot: 'desk', pose: 'write' }
  if (id === 'porter-plainte') return { spot: 'counter', pose: 'rant' }
  if (/^(medicaments|conseil|etat-civil|legalisation|renseignement|declaration-perte|abonnement-salle)$/.test(id)) return { spot: 'counter', pose: 'talk' }
  if (id === 'mariage-civil') return { spot: 'counter', pose: 'cheer' }
  if (id === 'aller-ecole') return { spot: 'entrance', pose: 'wave' }
  // The cold drink bought at the boutique, drunk sitting at its little table.
  if (id === 'sucrerie') return { spot: 'table', pose: 'drink' }
  if (/^(medicaments|conseil|credit|courses)$/.test(id)) return { spot: kind === 'boutique' ? 'stall' : 'counter', pose: 'idle' }
  if (id === 'cook-attieke') return { spot: 'stove', pose: 'cook' }
  if (id === 'watch-tv' || id === 'call-family') return { spot: 'sofa', pose: 'sit' }
  if (id === 'devoirs' || id === 'jouer-cour') return { spot: 'table', pose: id === 'devoirs' ? 'write' : 'dance' }
  if (id.endsWith('travaillement')) return { spot: 'floor', pose: 'throw' }
  // The bottles, at the VIP table; the Friday round, standing at it, glass up.
  if (id === 'bouteille-whisky' || id === 'champagne-vip') return { spot: 'table', pose: 'drink' }
  if (id === 'tournee-vendredi') return { spot: 'floor', pose: 'cheer' }
  if (/dance|party|coupe/.test(id)) return { spot: 'floor', pose: 'dance' }
  if (/^(drink|milkshake|coffee)/.test(id) || id.includes('drink')) return { spot: 'table', pose: 'drink' }
  if (/^(eat|burger|glace|anniversaire)/.test(id) || id.startsWith('golvo-')) return { spot: 'table', pose: 'eat' }
  if (kind === 'school' || kind === 'universite' || kind === 'office' || /cours|biblio|conference|read-ads|work/.test(id)) return { spot: 'desk', pose: 'write' }
  if (kind === 'culture' || kind === 'worship' || id === 'visite-malade') return { spot: 'seat', pose: 'sit' }
  if (id === 'consultation') return { spot: 'bed', pose: 'idle' }
  if (kind === 'market' || kind === 'mall') return { spot: 'stall', pose: 'busy' }
  return { spot: 'counter', pose: 'idle' }
}

/** How fast the Sim crosses a room (m/s): an unhurried walk. */
const WALK_IN = 1.5

/**
 * The Sim going to where something is done in the room: it walks there from
 * where it stood (the door when it has just picked something), turns to face
 * the right way, and only then sits, lies down or starts; when it's over, it
 * walks back to the door. On the floor while walking; up onto the sofa or
 * the bed, and over onto its back, eased at the end.
 */
function WalkTo({ to, facing, lying, free, room, onThere, children }: { to: V3; facing: number; lying: boolean; /** Walking about the room: the keys (or the pad) move the Sim too. */ free?: boolean; /** Where one can walk (roomGrid): round the furniture and the people, not through them. */ room?: ((x: number, z: number) => boolean) | null; onThere?: (there: boolean) => void; children: (there: boolean) => React.ReactNode }) {
  const camera = useThree((st) => st.camera)
  const outer = useRef<THREE.Group>(null)
  const inner = useRef<THREE.Group>(null)
  // Where the Sim is now; it starts where it should be (a place opened mid-action).
  const at = useRef({ x: to[0], z: to[2], rot: lying ? 0 : facing, settle: 1, manual: false })
  const [there, setThere] = useState(true)
  const key = `${to.join()},${facing.toFixed(2)},${lying}`
  const was = useRef(key)
  // The way there, round what's in the room (the last point is where it's going).
  const path = useRef<[number, number][]>([])
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1)
    const a = at.current
    if (was.current !== key) {
      was.current = key
      a.settle = 0
      const [sx, sz] = [a.x, a.z]
      const ok = room ? (x: number, z: number) => room(x, z) || Math.hypot(x - to[0], z - to[2]) < 0.75 || Math.hypot(x - sx, z - sz) < 0.5 : null
      path.current = ok ? (gridWay([sx, sz], [to[0], to[2]], ok, 0.25, 4, 140 * 140) ?? [[to[0], to[2]]]).slice(1) : []
      if (there) setThere(false)
      onThere?.(false)
    }
    // The keys or the pad, as seen from the camera: forward is away from it.
    const m = free ? moveInput() : null
    if (m && Math.hypot(m.x, m.y) > 0.15) {
      const f = new THREE.Vector3()
      camera.getWorldDirection(f)
      const fl = Math.hypot(f.x, f.z) || 1
      const [fx, fz] = [f.x / fl, f.z / fl]
      const [mx, mz] = [fx * m.y - fz * m.x, fz * m.y + fx * m.x]
      // Along each axis on its own, so the Sim slides along a counter instead of sticking to it.
      const nx = Math.max(-ROOM.W / 2 + 0.6, Math.min(ROOM.W / 2 - 0.6, a.x + mx * WALK_IN * dt))
      if (!room || room(nx, a.z)) a.x = nx
      const nz = Math.max(-ROOM.D / 2 + 0.6, Math.min(ROOM.D / 2 - 0.6, a.z + mz * WALK_IN * dt))
      if (!room || room(a.x, nz)) a.z = nz
      const want = Math.atan2(mx, mz)
      a.rot += Math.atan2(Math.sin(want - a.rot), Math.cos(want - a.rot)) * Math.min(1, dt * 10)
      // Walking under one's own steam: the last tapped spot is forgotten.
      a.settle = 1
      a.manual = true
      if (there) setThere(false)
    } else if (a.manual) {
      a.manual = false
      if (!there) setThere(true)
    }
    // The next point of the way round (the last one: where it's going).
    while (path.current.length > 1 && Math.hypot(path.current[0][0] - a.x, path.current[0][1] - a.z) < 0.08) path.current.shift()
    const next = path.current.length > 1 ? path.current[0] : [to[0], to[2]]
    const [dx, dz] = [next[0] - a.x, next[1] - a.z]
    const d = path.current.length > 1 ? Math.hypot(dx, dz) + 1 : Math.hypot(dx, dz)
    if (a.manual) {
      // Moved by the keys this frame (above).
    } else if (a.settle === 0 && d > 0.04) {
      // Walking over, facing the way it goes.
      const len = Math.hypot(dx, dz) || 1
      const step = Math.min(len, WALK_IN * dt)
      a.x += (dx / len) * step
      a.z += (dz / len) * step
      const want = Math.atan2(dx, dz)
      a.rot += Math.atan2(Math.sin(want - a.rot), Math.cos(want - a.rot)) * Math.min(1, dt * 10)
    } else if (a.settle < 1) {
      // There: turn to face the right way, then up onto the seat or down onto the bed.
      if (!there) {
        setThere(true)
        onThere?.(true)
      }
      a.settle = Math.min(1, a.settle + dt / 0.5)
      const want = lying ? 0 : facing
      a.rot += Math.atan2(Math.sin(want - a.rot), Math.cos(want - a.rot)) * Math.min(1, dt * 8)
      if (a.settle >= 1) a.rot = want
    }
    const e = a.settle * a.settle * (3 - 2 * a.settle)
    outer.current?.position.set(a.x, to[1] * e, a.z)
    if (outer.current) outer.current.rotation.y = a.rot
    if (inner.current) inner.current.rotation.x = lying ? (-Math.PI / 2) * e : 0
  })
  return (
    <group ref={outer}>
      <group ref={inner}>{children(there)}</group>
    </group>
  )
}

/** Lays the room's furniture on the walking grid, once it's drawn (a few frames in). */
function SolidRoom({ root, people, onReady }: { root: React.RefObject<THREE.Group | null>; people: [number, number][]; onReady: (free: (x: number, z: number) => boolean) => void }) {
  const frames = useRef(0)
  useFrame(() => {
    if (frames.current > 3) return
    frames.current++
    if (frames.current === 3 && root.current) onReady(roomGrid(root.current, people, ROOM.W, ROOM.D))
  })
  return null
}

/** Brings the camera close to the Sim doing something (once: then it's the player's). */
function FocusOn({ at, lying, facing }: { at: V3; lying: boolean; facing: number }) {
  const controls = useThree((st) => st.controls) as unknown as { target: THREE.Vector3; update: () => void } | null
  const camera = useThree((st) => st.camera)
  const done = useRef(false)
  useFrame((_, dt) => {
    if (done.current || !controls) return
    const target = new THREE.Vector3(at[0], at[1] + (lying ? 0.4 : 0.85), at[2])
    // From the side the Sim faces (its face, its plate), as far round as the
    // open side of the room lets the camera go.
    const az = Math.min(1.3, Math.max(0.25, ((facing % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) > Math.PI ? 0.25 : facing))
    const [dist, pol] = [lying ? 4.2 : 3.6, 1.0]
    const want = target.clone().add(new THREE.Vector3(Math.sin(az) * Math.sin(pol) * dist, Math.cos(pol) * dist, Math.cos(az) * Math.sin(pol) * dist))
    const k = 1 - Math.exp(-3 * Math.min(dt, 0.1))
    controls.target.lerp(target, k)
    camera.position.lerp(want, k)
    controls.update()
    if (camera.position.distanceTo(want) < 0.05) done.current = true
  })
  return null
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

/** How many notes fly: a petit travaillement drizzles, the grand one pours. */
function shower(id?: string) {
  return id === 'grand-travaillement' ? { rate: 4.5, fan: 5 } : id === 'petit-travaillement' ? { rate: 1.4, fan: 3 } : { rate: 2.6, fan: 4 }
}

/* ---------- Rooms ---------- */

/** The new kinds of places furnished like their nearest one. */
const ROOM_LIKE: Record<string, string> = { boutique: 'market' }

export function room(kindIn: string, housing: string): Room {
  const kind = ROOM_LIKE[kindIn] ?? kindIn
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
          bed: { p: [-4, 0.74, -1.75], pose: 'idle', lying: true },
          sofa: { p: [1.5, 0.05, -3.2], pose: 'sit' },
          stove: { p: [5.2, 0, -2.6], r: Math.PI, pose: 'busy' },
          shower: { p: [-5.2, 0.06, 2.8], r: Math.PI / 2, pose: 'idle' },
          table: { p: [4.3, 0, 1.45], r: Math.PI, pose: 'eat' },
          mat: { p: [-1.6, 0.04, 1.2], pose: 'busy' },
          entrance: { p: [0, 0, 3], r: Math.PI, pose: 'idle' },
          counter: { p: [0, 0, 1], pose: 'idle' },
        },
        crowd: [],
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
            {/* A little table by the wall, to eat or drink what was bought */}
            <Table p={[4, 0, 3.3]} c={kind === 'mall' ? '#f4f4f4' : '#f4f1ea'} chairs={kind === 'mall' ? '#2a6f97' : '#d62828'} />
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
          // On the chair at the little table, facing it.
          table: { p: [4, 0, 4.15], r: Math.PI, pose: 'eat' },
          entrance: { p: [0, 0, 3.6], r: Math.PI, pose: 'idle' },
          counter: { p: [0, 0, 0.6], r: Math.PI, pose: 'idle' },
        },
        crowd: [{ p: [-3.5, 0, -2.9], pose: 'busy' }, { p: [3.5, 0, 0.6], pose: 'busy' }, { p: [-3.5, 0, 2.4], r: Math.PI, pose: 'wave' }],
      }
    case 'pharmacie':
      // The pharmacy: white and clean, the green cross on the back wall, the
      // shelves of boxes behind the long counter, the pharmacist in her blouse.
      return {
        floor: '#eef1f3',
        wall: '#ffffff',
        furniture: (
          <>
            {[-3, 0, 3].map((x) => (
              <group key={x} position={[x, 0, -4.2]}>
                <Box p={[0, 1.2, 0]} s={[2.6, 2.4, 0.5]} c="#dfe6ea" />
                {[0.5, 1.1, 1.7].flatMap((y, row) =>
                  [...Array(6)].map((_, i) => <Box key={`${row}${i}`} p={[-1.05 + i * 0.42, y, 0.28]} s={[0.3, 0.32, 0.06]} c={['#ffffff', '#4dabf7', '#ff8787', '#69db7c', '#ffd43b', '#e599f7'][(i + row * 2 + x + 6) % 6]} />),
                )}
              </group>
            ))}
            {/* The green cross, lit */}
            <group position={[0, 3.05, -3.9]}>
              <Box p={[0, 0, 0]} s={[0.9, 0.3, 0.06]} c="#2f9e44" glow={0.8} />
              <Box p={[0, 0, 0]} s={[0.3, 0.9, 0.06]} c="#2f9e44" glow={0.8} />
            </group>
            {/* The counter, its till, a few boxes on it */}
            <Box p={[0, 0.55, -1.6]} s={[6.5, 1.1, 0.7]} c="#f8f9fa" />
            <Box p={[0, 1.1, -1.6]} s={[6.6, 0.05, 0.8]} c="#2f9e44" />
            <Box p={[1.8, 1.25, -1.7]} s={[0.4, 0.25, 0.3]} c="#343a40" />
            <Box p={[-0.6, 1.18, -1.5]} s={[0.25, 0.12, 0.18]} c="#4dabf7" />
            {/* The chairs for those who wait */}
            {[-4, -3.2].map((x) => (
              <Box key={x} p={[x, 0.42, 2.6]} s={[0.55, 0.06, 0.55]} c="#adb5bd" />
            ))}
          </>
        ),
        spots: {
          counter: { p: [-0.6, 0, -0.85], r: Math.PI, pose: 'talk' },
          stall: { p: [-0.6, 0, -0.85], r: Math.PI, pose: 'talk' },
          entrance: { p: [0, 0, 3.6], r: Math.PI, pose: 'idle' },
          seat: { p: [-3.2, 0.05, 2.6], pose: 'sit' },
        },
        crowd: [
          { p: [-0.6, 0, -2.4], pose: 'busy', outfit: 'blouse', g: 'femme' },
          { p: [2.2, 0, -2.4], r: 0.3, pose: 'talk', outfit: 'blouse' },
          { p: [-4, 0.05, 2.6], pose: 'sit' },
        ],
      }
    case 'gym':
      // The salle de sport: the rubber floor, the mirrors along the back
      // wall, the treadmills, the bench and its bar, the rack of dumbbells,
      // the punching bag, the shower in the corner, the reception desk.
      return {
        floor: '#8a929c',
        wall: '#f1f3f5',
        furniture: (
          <>
            {[-3, 0, 3].map((x) => (
              <Box key={x} p={[x, 1.5, -4.45]} s={[2.6, 2, 0.05]} c="#cfe3ef" />
            ))}
            {[-4.6, -3].map((x) => (
              <group key={x} position={[x, 0, -2.6]}>
                <Box p={[0, 0.12, 0]} s={[0.8, 0.2, 1.8]} c="#1c1c1e" />
                <Box p={[0, 0.7, -0.85]} s={[0.8, 1.2, 0.08]} c="#2b2f3a" />
                <Box p={[0, 1.25, -0.8]} s={[0.6, 0.25, 0.2]} c="#495057" />
              </group>
            ))}
            <group position={[1, 0, -1.5]}>
              <Box p={[0, 0.42, 0]} s={[0.4, 0.08, 1.3]} c="#c92a2a" />
              <Box p={[0, 1.15, -0.5]} s={[1.6, 0.05, 0.05]} c="#9aa3ad" />
              {[-0.72, 0.72].map((x) => (
                <Box key={x} p={[x, 1.15, -0.5]} s={[0.07, 0.36, 0.36]} c="#1c1c1e" />
              ))}
            </group>
            <Box p={[4.2, 0.5, -3.6]} s={[1.6, 0.06, 0.5]} c="#3d4350" />
            {[...Array(6)].map((_, i) => (
              <Box key={i} p={[3.6 + i * 0.24, 0.6, -3.6]} s={[0.1, 0.12, 0.3]} c="#1c1c1e" />
            ))}
            <mesh position={[4.6, 1.6, -0.6]}>
              <cylinderGeometry args={[0.25, 0.25, 1.1, 10]} />
              <meshLambertMaterial color="#c92a2a" />
            </mesh>
            <Box p={[4.6, 2.5, -0.6]} s={[0.04, 0.7, 0.04]} c="#9aa3ad" />
            {/* The pull-up bar: two posts and the bar */}
            {[-2.1, -0.3].map((x) => (
              <Box key={x} p={[x, 1.25, -3.9]} s={[0.12, 2.5, 0.12]} c="#2b2f3a" />
            ))}
            <Box p={[-1.2, 2.45, -3.9]} s={[1.9, 0.07, 0.07]} c="#9aa3ad" />
            {/* The mat for the rope and the floor work */}
            <Box p={[-1.2, 0.02, 1.4]} s={[2.4, 0.04, 1.6]} c="#2f6fbf" />
            <Box p={[-5, 1.3, 2.4]} s={[1.2, 2.6, 1.2]} c="#d0ebff" />
            <Box p={[3, 0.55, 2.6]} s={[2.2, 1.1, 0.7]} c="#e03131" />
          </>
        ),
        spots: {
          // Weights: standing at the rack, the dumbbells in hand.
          bench: { p: [4.2, 0, -2.8], r: Math.PI, pose: 'busy' },
          treadmill: { p: [-3, 0.22, -2.4], r: Math.PI, pose: 'run' },
          floor: { p: [-1, 0, 1], r: Math.PI, pose: 'dance' },
          pullup: { p: [-1.2, 0, -3.65], r: Math.PI, pose: 'hang' },
          punch: { p: [3.45, 0, -0.6], r: Math.PI / 2, pose: 'kick' },
          rope: { p: [-1.2, 0.04, 1.4], r: Math.PI, pose: 'leap' },
          shower: { p: [-5, 0, 2.4], pose: 'wash' },
          entrance: { p: [0, 0, 3.6], r: Math.PI, pose: 'idle' },
          counter: { p: [3, 0, 2], r: Math.PI, pose: 'idle' },
        },
        crowd: [
          { p: [-4.6, 0.22, -2.4], r: Math.PI, pose: 'run' },
          { p: [1.6, 0, -1.1], r: -Math.PI / 2, pose: 'talk' },
          { p: [3, 0, 3.2], r: Math.PI, pose: 'talk' },
        ],
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
    case 'couture': {
      // The tailor's workshop: the machines on their tables, the fabric on
      // the shelves, a wax dress on the mannequin, finished clothes on the rail.
      return {
        floor: '#c9b08a',
        wall: '#f1e2c6',
        furniture: (
          <>
            {[-3, 0.5].map((x, i) => (
              <group key={x} position={[x, 0, -3.05]}>
                <SewingTable seed={i} />
                <Box p={[0, 0.23, 0.75]} s={[0.4, 0.46, 0.4]} c="#6b4423" />
              </group>
            ))}
            {/* The shelves of fabric along the back wall */}
            <Box p={[-4.9, 1.2, -4.2]} s={[1.4, 2.4, 0.45]} c="#7a5230" />
            {[0.35, 0.95, 1.55, 2.15].map((y, row) =>
              [-5.35, -5.05, -4.75, -4.45].map((x, k) => <Box key={`${row}${k}`} p={[x, y, -4.0]} s={[0.24, 0.32, 0.38]} c={['#e8432f', '#f2a81d', '#1f6fb5', '#2e8b57', '#8e44ad', '#ffffff', '#d6336c', '#14213d'][(row * 3 + k) % 8]} />),
            )}
            {/* The mannequin in a wax dress */}
            <group position={[4.3, 0, -3.3]}>
              <Box p={[0, 0.5, 0]} s={[0.06, 1, 0.06]} c="#2b2b2b" />
              <Box p={[0, 1.25, 0]} s={[0.44, 0.6, 0.26]} c="#f08c00" />
              <Box p={[0, 1.25, 0.135]} s={[0.3, 0.45, 0.01]} c="#7b2d26" />
              <Box p={[0, 0.85, 0]} s={[0.56, 0.3, 0.34]} c="#f08c00" />
              <Box p={[0, 1.62, 0]} s={[0.12, 0.14, 0.12]} c="#c9b27a" />
            </group>
            {/* The rail of finished clothes, waiting for their owners */}
            <Box p={[5.5, 1.85, 0.3]} s={[0.05, 0.05, 2.8]} c="#adb5bd" />
            {['#2a6cf0', '#f4efe6', '#7b5cff', '#e8432f', '#2e8b57', '#f2b705'].map((c, k) => (
              <Box key={c} p={[5.5, 1.35, -0.9 + k * 0.45]} s={[0.08, 0.9, 0.4]} c={c} />
            ))}
            {/* The ironing board and the coal iron */}
            <Box p={[-4.4, 0.85, 1.8]} s={[0.4, 0.05, 1.3]} c="#e9ecef" />
            <Box p={[-4.4, 0.42, 1.8]} s={[0.05, 0.84, 0.05]} c="#495057" />
            <Box p={[-4.4, 0.95, 1.5]} s={[0.16, 0.14, 0.26]} c="#343a40" />
            {/* The bench for those who wait */}
            <Box p={[4.8, 0.45, 2.1]} s={[0.6, 0.1, 2.2]} c="#8a6a3d" />
          </>
        ),
        spots: {
          // Next to the master tailor, watching the pagne being sewn.
          chair: { p: [1.75, 0.06, -2.85], r: -Math.PI / 2, pose: 'sit' },
          entrance: { p: [0, 0, 3.6], r: Math.PI, pose: 'idle' },
          counter: { p: [2.2, 0, 0.4], r: Math.PI, pose: 'idle' },
          bench: { p: [4.55, 0.05, 2.1], r: -Math.PI / 2, pose: 'rant' },
        },
        crowd: [
          { p: [0.5, 0.06, -2.3], r: Math.PI, pose: 'write', g: 'homme' },
          { p: [-3, 0.06, -2.3], r: Math.PI, pose: 'write' },
          { p: [-4.4, 0, 2.35], r: Math.PI, pose: 'busy' },
          { p: [4.55, 0.05, 1.4], r: -Math.PI / 2, pose: 'sit', g: 'femme' },
        ],
      }
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
          // Each client has someone working behind the chair (the Sim's, the middle one, too: see ActionProps).
          { p: [-3.35, 0, -2.45], r: Math.PI, pose: 'busy', g: salon ? 'femme' : 'homme' },
          { p: [3.5, 0.06, -3.15], r: Math.PI, pose: 'sit', g: salon ? 'femme' : 'homme' },
          { p: [3.65, 0, -2.45], r: Math.PI, pose: 'busy', g: salon ? 'femme' : 'homme' },
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
          // In the water up to the waist (the floor hides the legs).
          pool: { p: [1.6, -0.8, 0.9], r: 0.4, pose: 'wave' },
          bed: { p: [4.4, 0.62, -3.1], pose: 'idle', lying: true },
          table: { p: [-2.2, 0, 3.45], r: Math.PI, pose: 'eat' },
          entrance: { p: [0, 0, 3.8], r: Math.PI, pose: 'idle' },
          counter: { p: [-3, 0, -2.8], r: Math.PI, pose: 'idle' },
        },
        crowd: [
          { p: [-3, 0, -4.2], pose: 'busy' },
          { p: [2.9, -0.8, -0.2], r: -0.6, pose: 'wave', outfit: 'maillot' },
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

export function Interior({ sim, kind, placeId, interactionId, roam, housing, night, stage, others = [], open = true }: { sim: Sim; kind: string; placeId: string; interactionId?: string; /** Just come in: the Sim walks about the room (tap the floor, or the keys). */ roam?: boolean; housing: string; night: boolean; stage: string; others?: Player[]; /** Within its hours: closed, nobody's in (no customers, no staff). */ open?: boolean }) {
  const [roamTo, setRoamTo] = useState<{ p: V3; facing: number } | null>(null)
  // The arrow keys and WASD walk the Sim about the room.
  useEffect(() => (roam ? listenKeys() : undefined), [roam])
  const r = room(kind, housing)
  const style = useRoomStyle(kind, housing)
  const act = action(kind, interactionId)
  const me = r.spots[act.spot] ?? r.spots.counter ?? r.spots.entrance
  const people = useMemo<Person[]>(() => {
    const rand = rng(`inside${placeId}`)
    return r.crowd.map((s) => {
      // The club's dance floor is the women's; elsewhere anyone.
      const gender: Person['gender'] = s.g ?? (kind === 'club' && s.pose === 'dance' ? 'femme' : kind === 'salon' && rand() < 0.8 ? 'femme' : rand() < 0.5 ? 'femme' : 'homme')
      const look = randomLook(gender, rand)
      return { ...s, gender, look: s.outfit ? { ...look, outfit: s.outfit, outfitColor: OUTFIT_DEFAULT_COLOR[s.outfit] ?? look.outfitColor, accessory: 'none' } : look, seed: rand() * 100 }
    })
  }, [placeId, kind]) // eslint-disable-line react-hooks/exhaustive-deps
  // Doing the travaillement: face the dancers; they cheer as the notes fall.
  const throwing = act.pose === 'throw'
  const faceDancers = useMemo(() => {
    const d = r.crowd.filter((c) => c.pose === 'dance' || c.pose === 'cheer')
    if (!d.length) return me.r ?? 0
    const [cx, cz] = [d.reduce((t, c) => t + c.p[0], 0) / d.length, d.reduce((t, c) => t + c.p[2], 0) / d.length]
    return Math.atan2(cx - me.p[0], cz - me.p[2])
  }, [r, me])
  const dark = r.dark || night
  // What's in the room, solid: made from the furniture once it's drawn (interior/roomGrid).
  const furniture = useRef<THREE.Group>(null)
  const [solid, setSolid] = useState<((x: number, z: number) => boolean) | null>(null)
  // The camera comes close once the Sim has got there (it watches it cross the room first).
  const [arrived, setArrived] = useState(true)
  // In the shower: in a towel.
  // At the hairdresser's: the cap comes off.
  // At work: in the job's uniform.
  const look =
    act.spot === 'shower' && interactionId === 'shower'
      ? { ...sim.look, outfit: 'serviette', accessory: 'none' }
      : act.spot === 'chair' && (kind === 'barbier' || kind === 'salon')
        ? { ...sim.look, accessory: 'none' }
        : interactionId === 'piscine-hotel'
          ? { ...sim.look, outfit: 'maillot', accessory: 'none' }
          : interactionId === 'work'
            ? workLook(sim.look, sim.career, sim.careerLevel)
            : sim.look
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [8.4, 8.6, 10.8], fov: 42 }} style={{ background: dark ? '#0b0d1f' : '#2a2340' }}>
      <Snapper />
      <Suspense fallback={null}>
        <hemisphereLight args={[dark ? '#7a6ab0' : '#fff6e8', '#3a2a1a', dark ? 0.55 : 0.75]} />
        <ambientLight intensity={dark ? 0.15 : 0.25} />
        {kind === 'club' && <pointLight position={[0, 2.9, 0]} intensity={14} distance={14} color="#b18cff" />}
        <Shell floor={r.floor} floorType={style.floorType} wall={r.wall} lower={style.lower} openings={style.openings} night={night} dark={r.dark} lamps={style.lamps} fan={style.fan} />
        <group ref={furniture}>
          {style.decor(dark)}
          {r.furniture}
        </group>
        <SolidRoom key={`${kind}:${placeId}:${housing}:${open}`} root={furniture} people={open ? people.map((p) => [p.p[0], p.p[2]] as [number, number]) : []} onReady={(f) => setSolid(() => f)} />
        {kind === 'club' && open && <ClubCrowd placeId={placeId} />}
        <NoShadows>
          {(open ? people : []).map((p, i) => (
            <group key={i} position={p.p} rotation={p.lying ? [-Math.PI / 2, 0, 0] : [0, p.r ?? 0, 0]}>
              <Human look={p.look} gender={p.gender} pose={throwing && p.pose === 'dance' && i % 2 ? 'cheer' : p.pose} seed={p.seed} />
            </group>
          ))}
        </NoShadows>
        {roam && (
          // The floor, to tap where to walk (a drag turns the camera instead).
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.02, 0]}
            onClick={(e) => {
              if (e.delta > 6) return
              e.stopPropagation()
              const x = Math.max(-ROOM.W / 2 + 0.6, Math.min(ROOM.W / 2 - 0.6, e.point.x))
              const z = Math.max(-ROOM.D / 2 + 0.6, Math.min(ROOM.D / 2 - 0.6, e.point.z))
              // Not into a table or a counter.
              if (solid && !solid(x, z)) return
              setRoamTo((r) => {
                const from = r?.p ?? me.p
                return { p: [x, 0, z], facing: Math.atan2(x - from[0], z - from[2]) }
              })
            }}
          >
            <planeGeometry args={[ROOM.W, ROOM.D]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        )}
        <WalkTo to={!interactionId && roamTo ? roamTo.p : me.p} facing={!interactionId && roamTo ? roamTo.facing : throwing ? faceDancers : (me.r ?? 0)} lying={!interactionId && roamTo ? false : !!me.lying} free={roam} room={solid} onThere={setArrived}>
          {(there) =>
            there ? (
              <>
                <Character look={look} gender={sim.gender} stage={stage} marker={!me.lying} busy={act.pose === 'busy'} pose={act.pose} />
                <ActionProps id={interactionId} kind={kind} lying={!!me.lying} />
                {/* The travaillement: notes off the wad, over the dancers in front */}
                {throwing && <NoteShower from={[0.3, 1.72, 0.3]} toward={[0, 0.35, 1]} {...shower(interactionId)} seed={placeId.length} />}
              </>
            ) : (
              <Character look={look} gender={sim.gender} stage={stage} walking speed={WALK_IN} />
            )
          }
        </WalkTo>
        {arrived && interactionId === 'watch-tv' && kind === 'home' && <TvScreen />}
        {arrived && interactionId === 'cook-attieke' && kind === 'home' && <Pot />}
        {arrived && me.lying && /^(sleep|nap|nuit-hotel)$/.test(interactionId ?? '') && <Zzz at={[me.p[0], me.p[1] + 0.6, me.p[2] - 0.6]} />}
        {/* Turn around the room and zoom, within the cut-away side */}
        <OrbitControls makeDefault target={[0, 0.8, 0]} enablePan={false} minDistance={interactionId ? 2.6 : 7} maxDistance={24} minPolarAngle={0.35} maxPolarAngle={1.25} minAzimuthAngle={0.15} maxAzimuthAngle={1.4} enableDamping />
        {/* Doing something: the camera comes close to see it */}
        {interactionId && arrived && <FocusOn at={me.p} lying={!!me.lying} facing={throwing ? faceDancers : (me.r ?? 0)} key={`${interactionId}${act.spot}`} />}
        {RICH && (
          <Suspense fallback={null}>
            <AmbientOcclusion radius={1.2} falloff={0.6} intensity={2.2} />
          </Suspense>
        )}
        {/* Other players here, side by side with the Sim (blue pin) */}
        {others.slice(0, 3).map((o, i) => {
          const a = action(kind, o.activity?.interactionId)
          const at = r.spots[a.spot] ?? r.spots.entrance
          const dx = [-0.95, 0.95, 1.9][i]
          return (
            <group key={o.id} position={[at.p[0] + dx, at.p[1], at.p[2]]} rotation={[0, at.r ?? 0, 0]}>
              <Character look={o.look} gender={o.gender} stage={o.stage} pose={a.pose} moodColor="#3b82f6" />
              {a.pose === 'throw' && <NoteShower from={[0.3, 1.72, 0.3]} toward={[0, 0.35, 1]} {...shower(o.activity?.interactionId)} seed={i + 7} />}
            </group>
          )
        })}
      </Suspense>
    </Canvas>
  )
}
