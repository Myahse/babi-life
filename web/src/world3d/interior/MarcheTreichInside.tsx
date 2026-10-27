import { SpotActions } from '../SpotActions'
import { Suspense, useMemo, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Sim } from '../../lib/types'
import { worldTime } from '../../lib/worldClock'
import { Human, NoShadows, type Pose } from '../../avatar/Human'
import { LowHuman } from '../../avatar/LowHuman'
import { randomLook } from '../../avatar/options'
import { rng } from '../themes'
import { Snapper } from '../snapshot'
import { ChatFraming } from '../chatFraming'
import { TalkHuman } from '../Talkable'
import { BOX, Blocks } from '../open/ruePrincesse'
import { Porter } from '../open/grandMarche'
import { Gossip } from './doings'
import { Guest, mat, sign, useBigWalk, type Spot, type XZ, spotWhere, RichAO } from './bigPlace'

// Inside the Grand Marché de Treichville: its great hall of food on the
// ground floor, the tables two by two down its length with the tanties
// sitting between them (tomatoes, onions, peppers, aubergines, yams,
// plantains, fish), the porters going up and down the aisles with their
// basins on their heads, the alloco stand by the doors; up the stairs on the
// left, the floor of pagnes over the back of the hall, the wax piled high and
// hung up in every colour. Frame: +z the doors, y 0 the ground floor.

const HX = 24
const HZ = 18
/** The floor of pagnes: where it starts (its edge over the hall), how high. */
const MEZ_Z = -11
const MEZ = 4.5
/** The stairs up along the left wall: their foot, their width. */
const STAIR_FOOT = -5
const STAIR: [number, number] = [-HX + 0.6, -HX + 2.8]
/** The islands of tables: their middles; how long (z), where they start. */
const ISLANDS = [-17, -8, 8, 17]
const ISLE_Z: [number, number] = [-8, 12]
const ENTRANCE: XZ = [0, HZ - 1.5]
const ALLOCO: XZ = [19, 14.5]
const BENCH_X = 15.6

const inStairs = (x: number) => x > STAIR[0] && x < STAIR[1]

/** The floor's height: the hall, the stairs up, the floor of pagnes. */
function ground(x: number, z: number) {
  if (z < MEZ_Z) return MEZ
  if (inStairs(x) && z < STAIR_FOOT) return ((STAIR_FOOT - z) / (STAIR_FOOT - MEZ_Z)) * MEZ
  return 0
}

/** The stalls of pagnes up on the floor: along its back wall, and two islands. */
const PAGNE_STALLS: { at: XZ; w: number }[] = [
  ...[-18, -10, -2, 6, 14].map((x) => ({ at: [x, -HZ + 1.2] as XZ, w: 6 })),
  ...[-8, 8].map((x) => ({ at: [x, -13] as XZ, w: 5 })),
]

function free(x: number, z: number) {
  if (Math.abs(x) > HX - 0.6 || z > HZ - 0.6 || z < -HZ + 0.6) return false
  if (z < MEZ_Z) {
    // Up on the floor of pagnes: round its stalls.
    for (const s of PAGNE_STALLS) if (Math.abs(x - s.at[0]) < s.w / 2 + 0.3 && Math.abs(z - s.at[1]) < 1.2) return false
    return true
  }
  // The stairs: only up their band (the floor's edge has its railing).
  if (z < STAIR_FOOT && z > MEZ_Z - 0.01) return inStairs(x) || z > MEZ_Z + 0.6
  if (inStairs(x) && z < STAIR_FOOT + 0.4) return true
  if (z < MEZ_Z + 0.6) return false
  // The islands: their tables (one walks down the tanties' lane only from its ends).
  for (const c of ISLANDS)
    if (z > ISLE_Z[0] - 0.3 && z < ISLE_Z[1] + 0.3) {
      if (Math.abs(x - c) < 1.75 && Math.abs(x - c) > 0.55) return false
    }
  if (Math.abs(x - ALLOCO[0]) < 1.6 && Math.abs(z - ALLOCO[1]) < 1.2) return false
  if (Math.abs(x - BENCH_X) < 0.4 && Math.abs(z - ALLOCO[1]) < 1.6) return false
  return true
}

const SPOTS: Record<string, Spot> = {
  // Up and down the middle aisle, from table to table.
  'buy-food': { at: [4, 2], rot: 0, pose: 'walk', loop: { c: [0, 2], r: [4, 8], speed: 0.07 } },
  // Before a tantie's tomatoes, arguing the price.
  bargain: { at: [-5.6, 4.2], rot: -Math.PI / 2, pose: 'talk' },
  // Sitting by the fryer, a plate of alloco.
  'eat-alloco': { at: [BENCH_X, ALLOCO[1]], rot: Math.PI / 2, pose: 'eat', y: 0.05, from: [BENCH_X - 1, ALLOCO[1]] },
  // Selling: a stool between two tables, like the tanties.
  'sell-goods': { at: [8, 5], rot: Math.PI / 2, pose: 'sit', y: 0.05, from: [8, ISLE_Z[1] + 0.8] },
  // Telling the news with two tanties by the doors.
  gbairai: { at: [-4, 13.5], rot: 0, pose: 'talk' },
  // Up on the floor of pagnes, unfolding one.
  'pagnes-treich': { at: [6, -14.9], rot: Math.PI, pose: 'busy', y: MEZ, from: [2.6, -14.9] },
}

export function MarcheTreichInside({ sim, interactionId, roam, night, stage }: { sim: Sim; interactionId?: string; /** Just come in: walk about (tap the floor, or the keys). */ roam?: boolean; night: boolean; stage: string }) {
  const spot = interactionId ? (SPOTS[interactionId] ?? null) : null
  const { way, tap, onMoved } = useBigWalk(spot, interactionId, roam, free, ENTRANCE)
  const hour = Math.floor((sim.gameMinutes ?? 0) / 60) % 24
  const open = (hour >= 6 && hour < 19) || !!interactionId
  return (
    <div className="absolute inset-0">
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [0, 15, 18], fov: 45, near: 0.3, far: 600 }} style={{ background: night ? '#0b1026' : '#d9cfbd' }}>
        <Snapper />
        <ChatFraming />
        <Suspense fallback={null}>
          <hemisphereLight args={['#fff7e8', '#8a7458', night ? 0.6 : 1]} />
          <directionalLight position={[12, 40, 20]} intensity={0.8} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-28} shadow-camera-right={28} shadow-camera-top={22} shadow-camera-bottom={-22} />
          {night && [-12, 0, 12].map((x) => <pointLight key={x} position={[x, 6, 2]} intensity={40} distance={20} color="#ffe2b0" />)}
          <Hall
            onFloor={(p) => {
              if (roam && !interactionId) tap(p)
            }}
          />
          <Islands open={open} />
          <Alloco open={open} />
          <Pagnes open={open} />
          {open && <Crowd />}
          <Guest sim={sim} stage={stage} way={way} spot={spot} steer={!!roam && !interactionId} onMoved={onMoved} free={free} entrance={ENTRANCE} ground={ground}>
            {interactionId === 'gbairai' && <Gossip />}
          </Guest>
          <SpotActions shown={!!roam && !interactionId} where={spotWhere(SPOTS)} entrance={[ENTRANCE[0], 0, ENTRANCE[1]]} />
          <OrbitControls makeDefault target={[0, 1, 0]} enablePan={false} minDistance={5} maxDistance={70} minPolarAngle={0.25} maxPolarAngle={1.35} enableDamping />
        </Suspense>
        <RichAO />
      </Canvas>
    </div>
  )
}

/** The hall: its floor, the pillars, the walls (low by the doors), the floor of pagnes over the back with its railing and the stairs up. */
function Hall({ onFloor }: { onFloor: (p: XZ) => void }) {
  const blocks = useMemo(() => {
    const b: { p: [number, number, number]; s: [number, number, number]; c?: string }[] = []
    b.push({ p: [-HX - 0.25, 3.5, 0], s: [0.5, 7, 2 * HZ], c: '#e9e2d4' }, { p: [HX + 0.25, 3.5, 0], s: [0.5, 7, 2 * HZ], c: '#e9e2d4' }, { p: [0, 4.5, -HZ - 0.25], s: [2 * HX + 1, 9, 0.5], c: '#e9e2d4' })
    for (const s of [-1, 1]) b.push({ p: [s * (HX + 3) / 2, 0.6, HZ + 0.25], s: [HX - 3, 1.2, 0.5], c: '#e9e2d4' })
    // The floor of pagnes: its slab, the shops shut under it facing the hall, its railing (open over the stairs).
    b.push({ p: [0, MEZ - 0.2, (MEZ_Z - HZ) / 2], s: [2 * HX, 0.4, MEZ_Z + HZ], c: '#cfc6b5' })
    for (let x = -HX + 5; x < HX - 2; x += 4) b.push({ p: [x, 1.6, MEZ_Z - 0.1], s: [3.6, 3.2, 0.15], c: ['#d9480f', '#1c7ed6', '#2b8a3e', '#f59f00', '#c2255c'][Math.abs(Math.round(x)) % 5] })
    b.push({ p: [0, 2.15, MEZ_Z - 0.4], s: [2 * HX, 4.3, 0.5], c: '#d8cfbf' })
    b.push({ p: [(STAIR[1] + HX) / 2, MEZ + 0.5, MEZ_Z + 0.05], s: [HX - STAIR[1], 1, 0.12], c: '#3a3d44' })
    // The stairs: a step every 30 cm up to the floor.
    const n = Math.round(MEZ / 0.3)
    for (let i = 0; i < n; i++) {
      const z = STAIR_FOOT - ((i + 0.5) / n) * (STAIR_FOOT - MEZ_Z)
      b.push({ p: [(STAIR[0] + STAIR[1]) / 2, ((i + 1) * MEZ) / n / 2, z], s: [STAIR[1] - STAIR[0], ((i + 1) * MEZ) / n, (STAIR_FOOT - MEZ_Z) / n], c: '#bfb4a2' })
    }
    // The pillars down the hall.
    for (let x = -12; x <= 12; x += 24) for (let z = -4; z <= 12; z += 8) b.push({ p: [x, 3.5, z], s: [0.7, 7, 0.7], c: '#b5543a' })
    return b
  }, [])
  const name = useMemo(() => sign('PAGNES · WAX · BAZIN — 1ER ÉTAGE', '#14532d', '#ffd43b', 1024, 112), [])
  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onClick={(e) => {
          if (e.delta > 6) return
          e.stopPropagation()
          onFloor([e.point.x, e.point.z])
        }}
      >
        <planeGeometry args={[2 * HX, 2 * HZ]} />
        <meshLambertMaterial color="#9c9182" />
      </mesh>
      <group
        onClick={(e) => {
          if (e.delta > 6) return
          e.stopPropagation()
          onFloor([e.point.x, e.point.z])
        }}
      >
        <Blocks at={blocks} material={mat('#ffffff')} color />
      </group>
      <mesh position={[4, MEZ + 1.6, MEZ_Z + 0.12]} scale={[14, 1.5, 1]} material={name}>
        <planeGeometry />
      </mesh>
    </group>
  )
}

/** What each island sells: the colours of its heaps, how they're shaped. */
const GOODS: { colors: string[]; shape: 'heap' | 'long' | 'bunch' }[] = [
  { colors: ['#e03131', '#c92a2a', '#f03e3e'], shape: 'heap' },
  { colors: ['#9c36b5', '#7c3a14', '#e8590c'], shape: 'heap' },
  { colors: ['#8a6a44', '#6b4a2e', '#b08850'], shape: 'long' },
  { colors: ['#f5d742', '#82c91e', '#c8d6a0'], shape: 'bunch' },
]

/** The islands: two tables each, heaped with their goods, the tanties on their stools between, fanning the flies, calling. */
function Islands({ open }: { open: boolean }) {
  const { tables, heaps } = useMemo(() => {
    const tables: { p: [number, number, number]; s: [number, number, number] }[] = []
    const heaps: { p: [number, number, number]; s: [number, number, number]; c: string }[] = []
    const r = rng('marche-tables')
    ISLANDS.forEach((c, i) => {
      const goods = GOODS[i % GOODS.length]
      for (const side of [-1, 1]) {
        const x = c + side * 1.2
        tables.push({ p: [x, 0.42, (ISLE_Z[0] + ISLE_Z[1]) / 2], s: [1, 0.84, ISLE_Z[1] - ISLE_Z[0]] })
        if (!open) continue
        for (let z = ISLE_Z[0] + 0.6; z < ISLE_Z[1] - 0.4; z += 0.85) {
          const col = goods.colors[Math.floor(r() * goods.colors.length)]
          if (goods.shape === 'heap') heaps.push({ p: [x, 0.98, z], s: [0.34, 0.24, 0.34], c: col })
          else if (goods.shape === 'long') heaps.push({ p: [x, 0.98, z], s: [0.18, 0.16, 0.38], c: col })
          else heaps.push({ p: [x, 1.0, z], s: [0.3, 0.2, 0.36], c: col })
        }
      }
    })
    return { tables, heaps }
  }, [open])
  const ball = useMemo(() => new THREE.SphereGeometry(1, 8, 6), [])
  const heapMesh = useMemo(() => {
    const m = new THREE.InstancedMesh(ball, mat('#ffffff'), Math.max(1, heaps.length))
    const o = new THREE.Object3D()
    const col = new THREE.Color()
    heaps.forEach((h, i) => {
      o.position.set(...h.p)
      o.scale.set(...h.s)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      m.setColorAt(i, col.set(h.c))
    })
    m.count = heaps.length
    return m
  }, [heaps, ball])
  const tanties = useMemo(() => {
    if (!open) return []
    const r = rng('marche-tanties')
    return ISLANDS.flatMap((c, i) =>
      [0, 1, 2, 3, 4].map((k) => {
        const z = ISLE_Z[0] + 2 + k * 4
        const toward = k % 2 ? 1 : -1
        const look = { ...randomLook('femme', r), outfit: r() < 0.6 ? 'pagne' : 'kaba' }
        // The Sim's own stool, when it sells, stays free.
        return { p: [c, 0.05, z] as [number, number, number], ry: (toward * Math.PI) / 2, look, seed: r() * 100, near: Math.abs(c) < 10, pose: (['sit', 'busy', 'shout', 'sit', 'eat'] as Pose[])[(i + k) % 5], skip: c === 8 && Math.abs(z - 5) < 1.2 }
      }),
    ).filter((t) => !t.skip)
  }, [open])
  // The tanties call out to the passers-by in turn.
  const [beat, setBeat] = useState(0)
  useFrame(() => {
    const k = Math.floor(worldTime() / 3) % 5
    if (k !== beat) setBeat(k)
  })
  return (
    <group>
      <Blocks at={tables} material={mat('#8a5a34')} />
      <primitive object={heapMesh} />
      <NoShadows>
        {tanties.map((t, i) => (
          <group key={i} position={t.p} rotation={[0, t.ry, 0]}>
            {t.near ? (
              <TalkHuman id={`marche-tantie-${i}`} look={t.look} gender="femme" pose={t.pose === 'shout' && beat !== i % 5 ? 'sit' : t.pose === 'shout' ? 'shout' : t.pose} seed={t.seed} />
            ) : (
              <LowHuman look={t.look} gender="femme" pose={t.pose === 'busy' || t.pose === 'shout' ? 'idle' : t.pose} seed={t.seed} />
            )}
          </group>
        ))}
      </NoShadows>
    </group>
  )
}

/** The alloco stand by the doors: the fryer with its pan, the tantie frying, the bench. */
function Alloco({ open }: { open: boolean }) {
  const look = useMemo(() => ({ ...randomLook('femme', rng('marche-alloco')), outfit: 'pagne' }), [])
  const oil = useMemo(() => new THREE.MeshLambertMaterial({ color: '#d9a441', emissive: '#7a4a10', emissiveIntensity: 0.4 }), [])
  useFrame(() => {
    oil.emissiveIntensity = 0.3 + Math.abs(Math.sin(worldTime() * 7)) * 0.3
  })
  return (
    <group>
      <mesh geometry={BOX} position={[ALLOCO[0], 0.45, ALLOCO[1]]} scale={[1.2, 0.9, 1.2]} material={mat('#3a3d44')} />
      <mesh position={[ALLOCO[0], 0.95, ALLOCO[1]]}>
        <cylinderGeometry args={[0.55, 0.4, 0.14, 16]} />
        <meshLambertMaterial color="#2b2f36" />
      </mesh>
      <mesh position={[ALLOCO[0], 1.0, ALLOCO[1]]} material={oil}>
        <cylinderGeometry args={[0.5, 0.5, 0.04, 16]} />
      </mesh>
      <mesh geometry={BOX} position={[BENCH_X, 0.22, ALLOCO[1]]} scale={[0.5, 0.44, 2.8]} material={mat('#8a5a34')} />
      {open && (
        <NoShadows>
          <group position={[ALLOCO[0] + 1.1, 0, ALLOCO[1]]} rotation={[0, -Math.PI / 2, 0]}>
            <TalkHuman id="marche-alloco" look={look} gender="femme" pose="cook" seed={9} />
          </group>
        </NoShadows>
      )}
    </group>
  )
}

/** A wax print: a ground colour and its motif repeated (rings, leaves, stripes, dots). */
function wax(seed: number) {
  const r = rng(`wax-${seed}`)
  const pal = ['#e03131', '#f08c00', '#ffd43b', '#2b8a3e', '#1c7ed6', '#7048e8', '#c2255c', '#17171a', '#f8f9fa']
  const [bg, a, b] = [pal[Math.floor(r() * pal.length)], pal[Math.floor(r() * pal.length)], pal[Math.floor(r() * pal.length)]]
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = bg
  g.fillRect(0, 0, 128, 128)
  const kind = seed % 4
  for (let y = 0; y < 128; y += 32)
    for (let x = 0; x < 128; x += 32) {
      const [cx, cy] = [x + 16 + ((y / 32) % 2) * 8, y + 16]
      g.fillStyle = a
      g.strokeStyle = b
      g.lineWidth = 4
      if (kind === 0) {
        g.beginPath()
        g.arc(cx, cy, 11, 0, Math.PI * 2)
        g.stroke()
        g.beginPath()
        g.arc(cx, cy, 5, 0, Math.PI * 2)
        g.fill()
      } else if (kind === 1) {
        g.beginPath()
        g.ellipse(cx, cy, 13, 6, 0.7, 0, Math.PI * 2)
        g.fill()
        g.beginPath()
        g.moveTo(cx - 10, cy + 8)
        g.lineTo(cx + 10, cy - 8)
        g.stroke()
      } else if (kind === 2) {
        g.fillRect(x, y + 4, 32, 8)
        g.fillStyle = b
        g.fillRect(x + 8, y + 18, 16, 8)
      } else {
        for (let k = 0; k < 4; k++) {
          g.beginPath()
          g.arc(x + 6 + k * 7, y + 6 + ((k * 13) % 20), 3, 0, Math.PI * 2)
          g.fill()
        }
      }
    }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return new THREE.MeshLambertMaterial({ map: t, side: THREE.DoubleSide })
}

/** The floor of pagnes: each stall's piles of folded wax, the lengths hung up behind, the sellers; women choosing. */
function Pagnes({ open }: { open: boolean }) {
  const prints = useMemo(() => [...Array(12)].map((_, i) => wax(i)), [])
  const piles = useMemo(() => {
    const r = rng('pagnes-piles')
    return PAGNE_STALLS.flatMap((s, si) =>
      [...Array(Math.round(s.w / 0.9))].map((_, k) => ({ x: s.at[0] - s.w / 2 + 0.5 + k * 0.9, z: s.at[1], h: 0.4 + r() * 0.8, m: (si * 5 + k) % prints.length })),
    )
  }, [prints.length])
  const people = useMemo(() => {
    if (!open) return []
    const r = rng('pagnes-gens')
    return PAGNE_STALLS.flatMap((s, i) => {
      const seller = { p: [s.at[0] + 1.2, MEZ, s.at[1] + (i < 5 ? -0.9 : 0.9)] as [number, number, number], ry: i < 5 ? 0 : Math.PI, look: { ...randomLook('femme', r), outfit: 'kaba' }, pose: 'idle' as Pose, seed: r() * 100 }
      const buyer = { p: [s.at[0] - 1.4, MEZ, s.at[1] + (i < 5 ? 1.7 : -1.7)] as [number, number, number], ry: i < 5 ? Math.PI : 0, look: randomLook('femme', r), pose: (r() < 0.5 ? 'talk' : 'busy') as Pose, seed: r() * 100 }
      return [seller, buyer]
    })
  }, [open])
  return (
    <group>
      {piles.map((p, i) => (
        <group key={i} position={[p.x, MEZ, p.z]}>
          <mesh position={[0, p.h / 2 + 0.6, 0]} scale={[0.8, p.h, 0.6]} material={prints[p.m]}>
            <boxGeometry />
          </mesh>
          <mesh geometry={BOX} position={[0, 0.3, 0]} scale={[0.86, 0.6, 0.7]} material={mat('#8a5a34')} />
        </group>
      ))}
      {/* The lengths hung up along the back wall, over the piles */}
      {[...Array(16)].map((_, i) => (
        <mesh key={i} position={[-HX + 2 + i * 2.9, MEZ + 2.4, -HZ + 0.12]} scale={[2.2, 2.6, 1]} material={prints[(i * 7) % prints.length]}>
          <planeGeometry />
        </mesh>
      ))}
      <NoShadows>
        {people.map((g, i) => (
          <group key={i} position={g.p} rotation={[0, g.ry, 0]}>
            <TalkHuman id={`pagnes-${i}`} look={g.look} gender="femme" pose={g.pose} seed={g.seed} />
          </group>
        ))}
      </NoShadows>
    </group>
  )
}

/** Who goes up and down: the porters with their basins down the aisles, shoppers with their bags. */
function Crowd() {
  const shoppers = useMemo(() => {
    const r = rng('marche-clients')
    return [-11.5, -2.5, 2.5, 13.4, 21].map((x) => {
      const gender: 'femme' | 'homme' = r() < 0.65 ? 'femme' : 'homme'
      return { x, gender, look: randomLook(gender, r), seed: r() * 100, phase: r() * 30, speed: 0.9 + r() * 0.3 }
    })
  }, [])
  return (
    <NoShadows>
      <Porter from={[-4.5, 15]} to={[-4.5, -9]} seed="marche-porteuse-a" speed={0.9} />
      <Porter from={[12.5, -9]} to={[12.5, 15]} seed="marche-porteuse-b" />
      <Porter from={[-12.5, 14]} to={[-12.5, -8]} seed="marche-porteuse-c" speed={1.1} />
      {shoppers.map((s, i) => (
        <Shopper key={i} {...s} />
      ))}
    </NoShadows>
  )
}

/** A shopper walking an aisle to the back and down again. */
function Shopper({ x, gender, look, seed, phase, speed }: { x: number; gender: 'femme' | 'homme'; look: ReturnType<typeof randomLook>; seed: number; phase: number; speed: number }) {
  const [state] = useState(() => ({ g: null as THREE.Group | null }))
  useFrame(() => {
    const g = state.g
    if (!g) return
    const len = 22
    const u = ((worldTime() * speed + phase) / len) % 2
    const t = u < 1 ? u : 2 - u
    g.position.set(x, 0, 15 - t * len)
    g.rotation.y = u < 1 ? Math.PI : 0
  })
  return (
    <group ref={(g) => void (state.g = g)}>
      <Human look={look} gender={gender} pose="walk" speed={speed} seed={seed} />
    </group>
  )
}
