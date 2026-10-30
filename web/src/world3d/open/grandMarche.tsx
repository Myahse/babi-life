import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Human, NoShadows } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import { worldTime } from '../../lib/worldClock'
import { rng } from '../themes'
import { Blocks, PLANE } from './ruePrincesse'
import { People, type Staff } from './hotelBits'
import { t as tr } from '../../lib/i18n'

// The Grand Marché de Treichville (rebuilt after the fire, opened in 2003):
// a great block of two levels, the shops all round its ground floor behind
// their coloured shutters (open in the day, the goods out front), the long
// gallery of the floor above behind its railing, a row of pitched metal roofs
// over the halls, its name across the front over the wide way in. Out front,
// the pavement's own market: tables of tomatoes and onions under parasols,
// the porters with their basins on their heads, a pousse-pousse pushed to and
// fro. Its plan is the game's (two levels on about 18 500 m²). Frame: +z the street.

const W = 52 // half its length
const D = 40 // half its depth
const G = 5 // the ground floor's height
const U = 5 // the upper floor's
const WAY = 12 // the way in's width
const PAVE = 14 // the pavement's market, from the front to the street

const white = new THREE.MeshLambertMaterial({ color: '#ffffff' })
const metal = new THREE.MeshLambertMaterial({ color: '#7f97a8' })
const paving = new THREE.MeshLambertMaterial({ color: '#c9bfae', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
const SHUTTERS = ['#d9480f', '#1c7ed6', '#2b8a3e', '#f59f00', '#c2255c', '#7048e8', '#0c8599']
const GOODS = ['#e03131', '#f08c00', '#fab005', '#2f9e44', '#1971c2', '#ae3ec9', '#f06595', '#ffffff']

type Block = { p: [number, number, number]; s: [number, number, number]; ry?: number; c?: string }

function nameBand() {
  const c = document.createElement('canvas')
  c.width = 1600
  c.height = 150
  const g = c.getContext('2d')!
  g.fillStyle = '#14532d'
  g.fillRect(0, 0, 1600, 150)
  g.fillStyle = '#ffd43b'
  g.font = '900 86px sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(tr('GRAND MARCHÉ DE TREICHVILLE'), 800, 80)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return new THREE.MeshLambertMaterial({ map: t })
}

export function GrandMarche({ night }: { night: boolean }) {
  const name = useMemo(nameBand, [])
  const roof = useMemo(() => {
    // One pitched roof: a prism along z, its ridge 3 m over its eaves.
    const s = new THREE.Shape()
    s.moveTo(-8, 0)
    s.lineTo(0, 3)
    s.lineTo(8, 0)
    s.lineTo(-8, 0)
    const g = new THREE.ExtrudeGeometry(s, { depth: 2 * D - 6, bevelEnabled: false })
    g.translate(0, 0, -(D - 3))
    return g
  }, [])
  const blocks = useMemo(() => {
    const b: Block[] = []
    const r = rng('grand-marche')
    // The ground floor: the slab, the pillars all round, a shop between each two, its shutter (or its goods).
    b.push({ p: [0, 0.15, 0], s: [2 * W + 1, 0.3, 2 * D + 1], c: '#bfb4a2' })
    b.push({ p: [0, G / 2, 0], s: [2 * W - 3, G, 2 * D - 3], c: '#e9e2d4' })
    const shops = (n: number, at: (i: number) => [number, number], ry: number, skip: (i: number) => boolean) => {
      for (let i = 0; i < n; i++) {
        if (skip(i)) continue
        const [x, z] = at(i)
        const open = !night && r() < 0.75
        const col = SHUTTERS[Math.floor(r() * SHUTTERS.length)]
        // The shutter rolled down, or up under its box with the goods stacked out front.
        b.push({ p: [x, open ? G - 0.7 : 1.6, z], s: [3.6, open ? 0.6 : 3, 0.2], ry, c: open ? '#6c757d' : col })
        if (open) {
          const out = 0.7
          const [ox, oz] = [Math.sin(ry) * out, Math.cos(ry) * out]
          // Along the front of the shop: x on the long sides, z on the ends.
          const ends = Math.abs(Math.sin(ry)) > 0.5
          for (let k = 0; k < 3; k++) b.push({ p: [x + ox + (ends ? 0 : (k - 1) * 1.1), 0.3 + r() * 0.3, z + oz + (ends ? (k - 1) * 1.1 : 0)], s: [ends ? 0.8 : 1, 0.6 + r() * 0.6, ends ? 1 : 0.8], c: GOODS[Math.floor(r() * GOODS.length)] })
        }
      }
    }
    const front = Math.floor((2 * W - 4) / 4)
    shops(front, (i) => [-W + 4 + i * 4, D - 1.4], 0, (i) => Math.abs(-W + 4 + i * 4) < WAY / 2 + 1)
    shops(front, (i) => [-W + 4 + i * 4, -D + 1.4], Math.PI, () => false)
    const side = Math.floor((2 * D - 4) / 4)
    for (const s of [-1, 1]) shops(side, (i) => [s * (W - 1.4), -D + 4 + i * 4], (s * Math.PI) / 2, () => false)
    for (let x = -W + 2; x <= W - 2 + 0.01; x += 4) for (const z of [D - 0.6, -D + 0.6]) b.push({ p: [x, G / 2 + 0.3, z], s: [0.8, G, 0.8], c: '#b5543a' })
    for (let z = -D + 2; z <= D - 2 + 0.01; z += 4) for (const x of [W - 0.6, -W + 0.6]) b.push({ p: [x, G / 2 + 0.3, z], s: [0.8, G, 0.8], c: '#b5543a' })
    // The floor above, set back behind its gallery: the slab, the railing, the long wall of its stalls.
    b.push({ p: [0, G + 0.45, 0], s: [2 * W + 1, 0.6, 2 * D + 1], c: '#d8cfbf' })
    b.push({ p: [0, G + 0.6 + U / 2, 0], s: [2 * W - 7, U, 2 * D - 7], c: '#efe8db' })
    for (const z of [D - 0.3, -D + 0.3]) b.push({ p: [0, G + 1.3, z], s: [2 * W, 0.12, 0.12], c: '#3a3d44' }, { p: [0, G + 0.95, z], s: [2 * W, 0.7, 0.05], c: '#5c636a' })
    for (const x of [W - 0.3, -W + 0.3]) b.push({ p: [x, G + 1.3, 0], s: [0.12, 0.12, 2 * D], c: '#3a3d44' }, { p: [x, G + 0.95, 0], s: [0.05, 0.7, 2 * D], c: '#5c636a' })
    for (let x = -W + 6; x <= W - 6 + 0.01; x += 6) b.push({ p: [x, G + 2.6, D - 3.55], s: [3.6, 2.6, 0.1], c: SHUTTERS[Math.floor(r() * SHUTTERS.length)] })
    // The pillars holding the roofs, the band with the name over the way in.
    for (let x = -W + 1; x <= W - 1 + 0.01; x += 8) for (const z of [D - 0.6, -D + 0.6]) b.push({ p: [x, G + U / 2 + 0.6, z], s: [0.6, U + 0.4, 0.6], c: '#b5543a' })
    b.push({ p: [0, G + U + 0.9, D - 0.4], s: [2 * W, 0.6, 0.8], c: '#e9e2d4' })
    // The way in: no shops there, the stairs up to the floor along its left.
    for (let i = 0; i < 10; i++) b.push({ p: [-WAY / 2 + 1.4, 0.25 + i * 0.5, D - 2 - i * 0.6], s: [2.4, 0.5, 0.6], c: '#cfc6b5' })
    // The pavement's tables, under their parasols' poles.
    for (const x of [-38, -30, -22, 22, 30, 38]) b.push({ p: [x, 0.45, D + 5], s: [3, 0.9, 1.6], c: '#8a5a34' })
    return b
  }, [night])
  // The pavement's piles of tomatoes, onions and peppers on the tables, the parasols over them.
  const piles = useMemo(() => {
    const r = rng('grand-marche-etals')
    return [-38, -30, -22, 22, 30, 38].flatMap((x) => [-1, 0, 1].map((k) => ({ p: [x + k * 0.95, 1.05, D + 5 + (r() - 0.5) * 0.4] as [number, number, number], c: ['#e03131', '#d9480f', '#f59f00', '#c92a2a', '#7c3a14'][Math.floor(r() * 5)] })))
  }, [])
  const people = useMemo<Staff[]>(() => {
    if (night) return [{ p: [WAY / 2 + 0.8, 0, D + 0.6], r: 0, who: 'vigile' }]
    const sellers: Staff[] = [-38, -30, -22, 22, 30, 38].map((x, i) => ({ p: [x, 0, D + 3.6], r: 0, pose: i % 2 ? 'sit' : 'busy' }))
    const buyers: Staff[] = [-30, 22, 38].map((x, i) => ({ p: [x + 0.5, 0, D + 6.6], r: Math.PI, pose: i === 1 ? 'talk' : 'idle' }))
    return [...sellers, ...buyers, { p: [WAY / 2 + 0.8, 0, D + 0.6], r: 0, who: 'vigile' }, { p: [-8, G + 0.75, D - 1.6], r: 0, pose: 'phone' }, { p: [10, G + 0.75, D - 1.4], r: 0.3, pose: 'idle' }]
  }, [night])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, D + PAVE / 2]} scale={[2 * W + 8, PAVE, 1]} geometry={PLANE} material={paving} receiveShadow />
      <Blocks at={blocks} material={white} color />
      {/* The row of pitched metal roofs over the halls, ridges front to back */}
      {[-3, -2, -1, 0, 1, 2, 3].map((i) => (
        <mesh key={i} geometry={roof} material={metal} position={[i * 14.6, G + U + 0.6, 0]} scale={[0.92, 1, 1]} castShadow receiveShadow />
      ))}
      <mesh position={[0, G + U + 0.9, D + 0.01]} scale={[56, 2.6, 1]} geometry={PLANE} material={name} />
      {piles.map((p, i) => (
        <mesh key={i} position={p.p} scale={[0.45, 0.3, 0.45]}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshLambertMaterial color={p.c} />
        </mesh>
      ))}
      {[-38, -30, -22, 22, 30, 38].map((x, i) => (
        <group key={x} position={[x, 0, D + 5]}>
          <mesh position={[0, 1.6, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 3.2, 5]} />
            <meshLambertMaterial color="#5c636a" />
          </mesh>
          <mesh position={[0, 3.1, 0]} castShadow>
            <coneGeometry args={[2.2, 0.8, 8, 1, true]} />
            <meshLambertMaterial color={['#e03131', '#1c7ed6', '#f59f00', '#2b8a3e'][i % 4]} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      {night && <pointLight position={[0, G + 2, D + 4]} intensity={40} distance={26} color="#ffe2b0" />}
      <NoShadows>
        <People at={people} seed={night ? 'grand-marche-nuit' : 'grand-marche'} />
        {!night && (
          <>
            <Porter from={[-WAY / 2 + 3, D - 4]} to={[-44, D + 10]} seed="porteuse-a" />
            <Porter from={[WAY / 2 - 2, D - 6]} to={[46, D + 9]} seed="porteuse-b" speed={0.9} />
            <Porter from={[-2, D + PAVE - 1]} to={[1, D - 8]} seed="porteuse-c" speed={1.1} />
            <PoussePousse from={[-46, D + 11.5]} to={[44, D + 11.5]} />
          </>
        )}
      </NoShadows>
    </group>
  )
}

/** A porter going to and fro, her basin of goods balanced on her head. */
export function Porter({ from, to, seed, speed = 1 }: { from: [number, number]; to: [number, number]; seed: string; speed?: number }) {
  const g = useRef<THREE.Group>(null)
  const who = useMemo(() => {
    const r = rng(seed)
    return { look: { ...randomLook('femme', r), outfit: 'pagne' }, load: GOODS[Math.floor(r() * GOODS.length)], phase: r() }
  }, [seed])
  const len = Math.hypot(to[0] - from[0], to[1] - from[1])
  const heading = Math.atan2(to[0] - from[0], to[1] - from[1])
  useFrame(() => {
    if (!g.current) return
    const u = ((worldTime() * speed) / len + who.phase) % 2
    const t = u < 1 ? u : 2 - u
    g.current.position.set(from[0] + (to[0] - from[0]) * t, 0, from[1] + (to[1] - from[1]) * t)
    g.current.rotation.y = u < 1 ? heading : heading + Math.PI
  })
  return (
    <group ref={g}>
      <Human look={who.look} gender="femme" pose="walk" speed={speed} seed={7} />
      {/* The basin on its head-cloth, heaped */}
      <mesh position={[0, 1.86, 0]}>
        <cylinderGeometry args={[0.42, 0.3, 0.2, 14]} />
        <meshLambertMaterial color="#c9ced3" />
      </mesh>
      <mesh position={[0, 1.98, 0]} scale={[0.38, 0.16, 0.38]}>
        <sphereGeometry args={[1, 10, 6]} />
        <meshLambertMaterial color={who.load} />
      </mesh>
    </group>
  )
}

/** A pousse-pousse (the market's handcart) pushed along the pavement, loaded with sacks. */
function PoussePousse({ from, to }: { from: [number, number]; to: [number, number] }) {
  const g = useRef<THREE.Group>(null)
  const wheels = useRef<THREE.Group>(null)
  const look = useMemo(() => ({ ...randomLook('homme', rng('pousse-pousse')), outfit: 'debardeur' }), [])
  const len = Math.hypot(to[0] - from[0], to[1] - from[1])
  const heading = Math.atan2(to[0] - from[0], to[1] - from[1])
  useFrame(() => {
    if (!g.current) return
    const d = worldTime() * 1.1
    const u = (d / len) % 2
    const t = u < 1 ? u : 2 - u
    g.current.position.set(from[0] + (to[0] - from[0]) * t, 0, from[1] + (to[1] - from[1]) * t)
    g.current.rotation.y = u < 1 ? heading : heading + Math.PI
    if (wheels.current) wheels.current.rotation.x = d / 0.4
  })
  return (
    <group ref={g}>
      <group position={[0, 0, -1.1]}>
        <Human look={look} gender="homme" pose="walk" speed={1.1} seed={3} />
      </group>
      {/* The cart: its bed, the sacks on it, the shafts to the pusher's hands, the two wheels */}
      <mesh position={[0, 0.75, 0.6]}>
        <boxGeometry args={[1.2, 0.12, 2]} />
        <meshLambertMaterial color="#8a5a34" />
      </mesh>
      {[-0.3, 0.3].map((x) => (
        <mesh key={x} position={[x, 1.05, 0.6 + x]} scale={[0.5, 0.45, 0.7]}>
          <sphereGeometry args={[0.6, 8, 6]} />
          <meshLambertMaterial color="#d9c7a3" />
        </mesh>
      ))}
      {[-0.45, 0.45].map((x) => (
        <mesh key={x} position={[x, 0.85, -0.45]} rotation={[0.35, 0, 0]}>
          <boxGeometry args={[0.06, 0.06, 1.4]} />
          <meshLambertMaterial color="#5c3b20" />
        </mesh>
      ))}
      <group ref={wheels} position={[0, 0.4, 0.6]}>
        {[-0.7, 0.7].map((x) => (
          <mesh key={x} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.4, 0.4, 0.1, 12]} />
            <meshLambertMaterial color="#2b2f36" />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/** What a walker can't go through: the market's block (in by the way in), the pavement's tables (its frame). */
export const GRAND_MARCHE_SOLID: ({ x: number; z: number; r: number } | { x: number; z: number; hw: number; hd: number; rot: number; top?: number })[] = [
  { x: -(W + WAY / 2) / 2, z: 0, hw: (W - WAY / 2) / 2, hd: D, rot: 0, top: G },
  { x: (W + WAY / 2) / 2, z: 0, hw: (W - WAY / 2) / 2, hd: D, rot: 0, top: G },
  { x: 0, z: -D / 2 - 1, hw: WAY / 2, hd: D / 2 + 1, rot: 0, top: G },
  ...[-38, -30, -22, 22, 30, 38].map((x) => ({ x, z: D + 5, hw: 1.6, hd: 0.9, rot: 0, top: 1 })),
]
