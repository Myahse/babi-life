import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Human, NoShadows, type Pose } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import { worldTime } from '../../lib/worldClock'
import { inZone } from '../obstacles'
import { Solid } from '../Solid'
import { rng } from '../themes'
import { whereabouts } from '../whereabouts'
import { lettering, signMaterial } from './ruePrincesse'
import { hash, type XZ } from './geo'
import { TalkHuman } from '../Talkable'
import type { Nav } from './nav'

// The quarters after dark, away from the party: in front of the houses the
// family sits out on plastic chairs under a bare bulb, the radio on; at the
// coffee kiosk the regulars stand with their cups; two men play draughts
// under the lamp with their supporters round the board; a couple walks
// slowly down the street; and in front of a shop with its shutter down, the
// watchman sleeps on his mat, the radio by his head. A few, at the same
// corners every night, drawn only round the Sim.

export type NightKind = 'porch' | 'kiosque' | 'dames' | 'couple' | 'gardien'
type Spot = { id: string; kind: NightKind; at: XZ; rot: number; seed: number }

const NEAR = 200
const MAX = 5
/** When each scene is out (game hours, the clock shared by all). */
const HOURS: Record<NightKind, (h: number) => boolean> = {
  porch: (h) => h >= 19 || h < 1,
  kiosque: (h) => h >= 18 || h < 2,
  dames: (h) => h >= 19 && h < 24,
  couple: (h) => h >= 20 || h < 1,
  gardien: (h) => h >= 21 || h < 6,
}
const KINDS: NightKind[] = ['porch', 'porch', 'kiosque', 'dames', 'couple', 'gardien']

export function NightStreet({ nav, seed }: { nav: Nav; seed: string }) {
  // Spots along the quarters' streets (not the boulevards), off the roadway.
  const spots = useMemo(() => {
    const out: Spot[] = []
    for (const e of nav.edges) {
      if (e.width < 5 || e.width > 11 || e.len < 22 || nav.ys[e.a] || nav.ys[e.b]) continue
      const [a, b] = [nav.nodes[e.a], nav.nodes[e.b]]
      const h = hash(Math.round(a[0] + b[0]), Math.round(a[1] + b[1]), 433)
      if (h > 0.16) continue
      const [ux, uz] = [(b[0] - a[0]) / e.len, (b[1] - a[1]) / e.len]
      const side = hash(Math.round(a[1]), Math.round(b[0]), 9) < 0.5 ? 1 : -1
      const u = 0.3 + hash(e.a, e.b, 21) * 0.4
      const m: XZ = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]
      const kind = KINDS[Math.floor((h / 0.16) * KINDS.length) % KINDS.length]
      // The couple walks the roadside; the others are on the edge of the pavement, facing the street.
      const off = kind === 'couple' ? e.width / 2 + 1 : e.width / 2 + 2.6
      const at: XZ = [m[0] - uz * off * side, m[1] + ux * off * side]
      if (kind !== 'couple' && !nav.walkable(at[0], at[1])) continue
      // Nor in the next street (a cross street, a parallel one): a metre round them off every road.
      if (kind !== 'couple' && [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => nav.onRoad([at[0] + dx, at[1] + dz]))) continue
      // Facing the street: +z of the scene points back to the road.
      const rot = kind === 'couple' ? Math.atan2(ux, uz) : Math.atan2(uz * side, -ux * side)
      out.push({ id: `${seed}:night:${Math.round(at[0])}:${Math.round(at[1])}`, kind, at, rot, seed: h * 1000 })
    }
    return out
  }, [nav, seed])
  const [shown, setShown] = useState<Spot[]>([])
  const tick = useRef(10)
  useFrame((_, dt) => {
    tick.current += dt
    if (tick.current < 2) return
    tick.current = 0
    const [sx, sz] = whereabouts.sim
    const h = Math.floor((worldTime() / 3600) % 24)
    const next = spots
      .filter((s) => HOURS[s.kind](h))
      .map((s) => ({ s, d: Math.hypot(s.at[0] - sx, s.at[1] - sz) }))
      .filter((x) => x.d < NEAR && !inZone(x.s.at[0], x.s.at[1], 2))
      .sort((a, b) => a.d - b.d)
      .slice(0, MAX)
      .map((x) => x.s)
    if (next.map((s) => s.id).join() !== shown.map((s) => s.id).join()) setShown(next)
  })
  return (
    <NoShadows>
      {shown.map((s) => (
        <group key={s.id} position={[s.at[0], 0, s.at[1]]} rotation={[0, s.rot, 0]}>
          <Solid parts>
            <NightScene kind={s.kind} seed={s.id} />
          </Solid>
        </group>
      ))}
    </NoShadows>
  )
}

/** One night scene, in its own frame (+z toward the street): for the open world and the lab. */
export function NightScene({ kind, seed }: { kind: NightKind; seed: string }) {
  switch (kind) {
    case 'porch':
      return <Porch seed={seed} />
    case 'kiosque':
      return <Kiosque seed={seed} />
    case 'dames':
      return <Dames seed={seed} />
    case 'couple':
      return <Couple seed={seed} />
    case 'gardien':
      return <Gardien seed={seed} />
  }
}

/* ---------- Pieces ---------- */

const BOX = new THREE.BoxGeometry(1, 1, 1)
const lambert = new Map<string, THREE.MeshLambertMaterial>()
const mat = (c: string) => {
  let m = lambert.get(c)
  if (!m) lambert.set(c, (m = new THREE.MeshLambertMaterial({ color: c })))
  return m
}
const bulb = new THREE.MeshBasicMaterial({ color: '#fff0c0' })
const B = ({ p, s, c, m, r = 0 }: { p: [number, number, number]; s: [number, number, number]; c?: string; m?: THREE.Material; r?: number }) => <mesh geometry={BOX} material={m ?? mat(c ?? '#ffffff')} position={p} scale={s} rotation={[0, r, 0]} />
const soft = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,0.9)')
  grad.addColorStop(0.5, 'rgba(255,255,255,0.3)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
})()
const pools = new Map<string, THREE.MeshBasicMaterial>()
const poolMat = (c: string) => {
  let m = pools.get(c)
  if (!m) pools.set(c, (m = new THREE.MeshBasicMaterial({ map: soft, color: c, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 })))
  return m
}
const PLANE = new THREE.PlaneGeometry(1, 1)

/** A bare bulb hanging from a wire on its pole, and the pool of light it throws. */
function Bulb({ p, pool = 7, c = '#ffd08a' }: { p: [number, number, number]; pool?: number; c?: string }) {
  return (
    <>
      <B p={[p[0], p[1] / 2, p[2] - 0.5]} s={[0.07, p[1], 0.07]} c="#5c4630" />
      <B p={[p[0], p[1], p[2] - 0.25]} s={[0.04, 0.04, 0.5]} c="#222" />
      <B p={[p[0], p[1] - 0.12, p[2]]} s={[0.13, 0.17, 0.13]} m={bulb} />
      <mesh geometry={PLANE} material={poolMat(c)} position={[p[0], 0.06, p[2]]} rotation={[-Math.PI / 2, 0, 0]} scale={[pool, pool, 1]} />
    </>
  )
}

function useCast(seed: string, n: number) {
  return useMemo(() => {
    const r = rng(seed)
    return [...Array(n)].map(() => {
      const gender: 'femme' | 'homme' = r() < 0.5 ? 'femme' : 'homme'
      return { gender, look: randomLook(gender, r), seed: r() * 100 }
    })
  }, [seed, n])
}
type Cast = ReturnType<typeof useCast>[number]
/** One of them, who can be talked to (a child can't: world3d/talk.ts). */
const P = ({ c, p, r = 0, pose, lie = false, kid = false, tag = 'night' }: { c: Cast; p: [number, number, number]; r?: number; pose: Pose; lie?: boolean; kid?: boolean; /** What they're at (the dames: they'll play a game, ChatSheet) */ tag?: string }) => (
  <group position={p} rotation={lie ? [-Math.PI / 2, 0, r] : [0, r, 0]}>
    {kid ? <Human look={c.look} gender={c.gender} pose={pose} seed={c.seed} /> : <TalkHuman id={`${tag}-${Math.round(c.seed * 1e6)}`} look={c.look} gender={c.gender} pose={pose} seed={c.seed} />}
  </group>
)
const Chair = ({ p, r = 0, c = '#f4f4f4' }: { p: [number, number, number]; r?: number; c?: string }) => (
  <group position={p} rotation={[0, r, 0]}>
    <B p={[0, 0.23, 0]} s={[0.45, 0.46, 0.45]} c={c} />
    <B p={[0, 0.6, -0.2]} s={[0.45, 0.55, 0.06]} c={c} />
  </group>
)

/** In front of the house: the old man in his chair, the women talking, the radio on the stool, a young one on his phone. */
function Porch({ seed }: { seed: string }) {
  const cast = useCast(`${seed}porch`, 5)
  return (
    <group>
      {/* The courtyard wall and its gate behind them */}
      <B p={[-2.6, 1, -1.6]} s={[3.2, 2, 0.25]} c="#d9c7a7" />
      <B p={[2.6, 1, -1.6]} s={[3.2, 2, 0.25]} c="#d9c7a7" />
      <B p={[0, 1, -1.65]} s={[2, 2, 0.08]} c="#2f6fb0" />
      <Bulb p={[1.6, 2.6, -1.1]} pool={8} />
      {/* The chairs out, a little stool with the radio and the teapot */}
      <Chair p={[-1.6, 0, 0]} r={0.4} c="#e8432f" />
      <Chair p={[-0.4, 0, 0.4]} r={0} />
      <Chair p={[0.9, 0, 0.1]} r={-0.5} c="#e8432f" />
      <B p={[0.25, 0.22, 1.2]} s={[0.4, 0.44, 0.4]} c="#7a5233" />
      <B p={[0.15, 0.53, 1.2]} s={[0.3, 0.18, 0.12]} c="#2a2a2a" />
      <B p={[0.35, 0.52, 1.25]} s={[0.12, 0.16, 0.12]} c="#3f8fd6" />
      <P c={{ ...cast[0], gender: 'homme', look: { ...cast[0].look, outfit: 'boubou' } }} p={[-1.6, 0, 0]} r={0.4} pose="sit" />
      <P c={cast[1]} p={[-0.4, 0, 0.4]} r={0} pose="sit" />
      <P c={cast[2]} p={[0.9, 0, 0.1]} r={-0.5} pose="drink" />
      <P c={cast[3]} p={[2.2, 0, 0.9]} r={-1.2} pose="phone" />
      <group scale={0.62}>
        <P c={cast[4]} p={[-0.6, 0, 3.1]} r={Math.PI + 0.4} pose="talk" kid />
      </group>
    </group>
  )
}

/** The coffee kiosk: the little wooden booth, its name, the seller pouring, the regulars with their cups. */
function Kiosque({ seed }: { seed: string }) {
  const cast = useCast(`${seed}kiosque`, 5)
  const sign = useMemo(() => {
    const l = lettering('CAFÉ · THÉ', '#7a2e12', '#ffe066', '#ffe066')
    const m = signMaterial(l.t)
    m.emissiveIntensity = 0.9
    return { m, aspect: l.aspect }
  }, [])
  return (
    <group>
      <B p={[0, 1.1, -0.6]} s={[2.2, 2.2, 1.4]} c="#8a5a32" />
      <B p={[0, 0.55, 0.25]} s={[2.2, 1.1, 0.35]} c="#a06a3a" />
      <B p={[0, 1.12, 0.3]} s={[2.3, 0.05, 0.5]} c="#c9b28a" />
      <B p={[0, 2.3, -0.4]} s={[2.6, 0.1, 2]} c="#a9b0b6" />
      <mesh geometry={PLANE} material={sign.m} position={[0, 2.0, 0.11]} scale={[Math.min(2.1, 0.45 * sign.aspect), 0.45, 1]} />
      {/* The kettles and the thermos, the cups */}
      <B p={[-0.6, 1.25, 0.3]} s={[0.22, 0.25, 0.22]} c="#d0d4da" />
      <B p={[-0.25, 1.28, 0.3]} s={[0.16, 0.32, 0.16]} c="#e8432f" />
      {[0.2, 0.4, 0.6].map((x) => (
        <B key={x} p={[x, 1.19, 0.35]} s={[0.07, 0.09, 0.07]} c="#f4f4f4" />
      ))}
      <Bulb p={[1.4, 2.5, 0.6]} pool={7} />
      <P c={cast[0]} p={[0, 0, -0.35]} pose="busy" />
      <P c={cast[1]} p={[-0.7, 0, 1.2]} r={Math.PI + 0.3} pose="talk" />
      <P c={cast[2]} p={[0.6, 0, 1.3]} r={Math.PI - 0.3} pose="idle" />
      <P c={cast[3]} p={[1.6, 0, 1.6]} r={-2.2} pose="talk" />
      {/* One sitting on the bench with his cup */}
      <B p={[-2.1, 0.22, 1.1]} s={[1.2, 0.06, 0.35]} c="#7a5233" />
      <P c={cast[4]} p={[-2.1, -0.2, 1.1]} r={Math.PI / 2} pose="drink" />
    </group>
  )
}

/** Draughts under the lamp: the board on a crate, the two players, the ones watching and the one who shouts the move. */
function Dames({ seed }: { seed: string }) {
  const cast = useCast(`${seed}dames`, 6)
  const board = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 10
    const g = c.getContext('2d')!
    for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) ((g.fillStyle = (x + y) % 2 ? '#3b2412' : '#e8d3a8'), g.fillRect(x, y, 1, 1))
    for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) if ((x + y) % 2 && (y < 3 || y > 6) && (x * 7 + y * 3) % 5) ((g.fillStyle = y < 3 ? '#111' : '#f4f4f4'), g.fillRect(x + 0.2, y + 0.2, 0.6, 0.6))
    const t = new THREE.CanvasTexture(c)
    t.magFilter = THREE.NearestFilter
    t.colorSpace = THREE.SRGBColorSpace
    return new THREE.MeshLambertMaterial({ map: t })
  }, [])
  // Now and then a move makes the watchers jump.
  const [hot, setHot] = useState(false)
  const offset = useMemo(() => rng(`${seed}dm`)() * 40, [seed])
  useFrame(() => {
    const h = (worldTime() + offset) % 14 < 2.5
    if (h !== hot) setHot(h)
  })
  return (
    <group>
      <Bulb p={[0, 3, -0.6]} pool={8} c="#fff2cc" />
      <B p={[0, 0.3, 0]} s={[0.7, 0.6, 0.7]} c="#7a5233" />
      <mesh geometry={PLANE} material={board} position={[0, 0.61, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[0.62, 0.62, 1]} />
      <B p={[-0.75, 0.2, 0]} s={[0.4, 0.4, 0.4]} c="#3f8fd6" />
      <B p={[0.75, 0.2, 0]} s={[0.4, 0.4, 0.4]} c="#3f8fd6" />
      <P c={{ ...cast[0], gender: 'homme', look: randomLook('homme', rng(`${seed}p1`)) }} p={[-0.75, -0.02, 0]} r={Math.PI / 2} pose="sit" tag="dames" />
      <P c={{ ...cast[1], gender: 'homme', look: randomLook('homme', rng(`${seed}p2`)) }} p={[0.75, -0.02, 0]} r={-Math.PI / 2} pose="sit" tag="dames" />
      <P c={cast[2]} p={[-0.5, 0, 1.1]} r={Math.PI} pose={hot ? 'cheer' : 'idle'} tag="dames" />
      <P c={cast[3]} p={[0.4, 0, 1.2]} r={Math.PI + 0.3} pose={hot ? 'rant' : 'talk'} tag="dames" />
      <P c={cast[4]} p={[0.2, 0, -1.1]} r={0} pose="idle" />
      <P c={cast[5]} p={[1.4, 0, 0.9]} r={-2.4} pose={hot ? 'cheer' : 'idle'} />
    </group>
  )
}

/** A couple walking slowly down the street and back, side by side, close. */
function Couple({ seed }: { seed: string }) {
  const r = useMemo(() => rng(`${seed}couple`), [seed])
  const pair = useMemo(() => [{ gender: 'femme' as const, look: randomLook('femme', r), seed: r() * 100 }, { gender: 'homme' as const, look: randomLook('homme', r), seed: r() * 100 }], [r])
  const ref = useRef<THREE.Group>(null)
  const offset = useMemo(() => rng(`${seed}walk`)() * 100, [seed])
  const SPAN = 36
  const SPEED = 0.85
  useFrame(() => {
    const g = ref.current
    if (!g) return
    // Down the street and back: a there-and-back on the shared clock.
    const u = ((worldTime() + offset) * SPEED) % (SPAN * 2)
    const back = u > SPAN
    const d = back ? SPAN * 2 - u : u
    g.position.set(0, 0, d - SPAN / 2)
    g.rotation.y = back ? Math.PI : 0
  })
  return (
    <group ref={ref}>
      <P c={pair[0]} p={[-0.3, 0, 0]} pose="walk" />
      <P c={pair[1]} p={[0.3, 0, 0]} pose="walk" />
    </group>
  )
}

/** A shop shut for the night, its shutter down, and the watchman asleep on his mat in front, the radio by his head. */
function Gardien({ seed }: { seed: string }) {
  const cast = useCast(`${seed}gardien`, 1)
  const man = { ...cast[0], gender: 'homme' as const, look: { ...randomLook('homme', rng(`${seed}g`)), outfit: 'boubou' } }
  return (
    <group>
      <B p={[0, 1.6, -1.2]} s={[5, 3.2, 0.3]} c="#e3c9a3" />
      {[...Array(10)].map((_, i) => (
        <B key={i} p={[0, 0.15 + i * 0.25, -1.02]} s={[3.2, 0.21, 0.05]} c={i % 2 ? '#d5d8de' : '#aeb4be'} />
      ))}
      <B p={[0, 2.9, -0.95]} s={[0.35, 0.12, 0.25]} m={bulb} />
      <mesh geometry={PLANE} material={poolMat('#ffe0a0')} position={[0, 0.06, -0.2]} rotation={[-Math.PI / 2, 0, 0]} scale={[5, 4, 1]} />
      {/* The mat, the man asleep on it, his radio, his torch and his stick */}
      <B p={[0, 0.02, 0.1]} s={[2, 0.04, 0.9]} c="#c9a24a" />
      <P c={man} p={[-0.85, 0.16, 0.1]} r={-Math.PI / 2} pose="sleep" lie />
      <B p={[1.25, 0.1, -0.3]} s={[0.3, 0.18, 0.12]} c="#2a2a2a" />
      <B p={[1.2, 0.05, 0.5]} s={[0.25, 0.08, 0.08]} c="#c92a2a" />
      <B p={[0, 0.04, 0.75]} s={[1.6, 0.05, 0.05]} c="#5c4630" />
    </group>
  )
}
