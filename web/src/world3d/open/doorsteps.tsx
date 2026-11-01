import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { NoShadows, type Pose } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import type { Look } from '../../lib/types'
import { rng } from '../themes'
import { whereabouts } from '../whereabouts'
import { TalkHuman } from '../Talkable'
import { inZone } from '../obstacles'
import { Solid } from '../Solid'
import { Vehicle } from '../vehicles'
import { hash, type XZ } from './geo'
import type { Nav } from './nav'
import { useRain } from './rainRun'
import type { Taken } from './streetlife'

// Life on the doorsteps: in front of the houses and the shops along the small streets, people at their
// own business, always the same ones at the same door. A maman at her charcoal stove, another braiding a
// girl's hair, two old men over a game of dames, someone on the phone on a plastic chair, a woman
// sweeping her bit of pavement, a boy washing a moto, children chasing each other, a seller behind her
// basin, a papa resting with his radio. Only those near the Sim are drawn (they're people: costly), and
// they look up and wave as the Sim walks by. In the rain, they're all inside.

type Kind = 'cuisine' | 'tresses' | 'dames' | 'telephone' | 'balai' | 'lavage' | 'enfants' | 'vente' | 'repos'
type Spot = { id: string; kind: Kind; at: XZ; rot: number; seed: number }

/** Drawn this close to the Sim (m), this many at most. */
const NEAR = 75
const MAX = 9
/** One spot every this many metres along a street side, kept by chance. */
const EVERY = 16
const KEEP = 0.42

const DAY: Kind[] = ['cuisine', 'tresses', 'dames', 'telephone', 'balai', 'lavage', 'enfants', 'vente', 'repos']
// After dark: the stoves (the garba, the alloco), the dames under the bulb, the phone, the old ones out in the cool.
const NIGHT: Kind[] = ['cuisine', 'dames', 'telephone', 'repos', 'vente']

export function Doorsteps({ nav, seed, night, taken }: { nav: Nav; seed: string; night: boolean; taken: Taken[] }) {
  // Every doorstep of the streets loaded: along each small street, both sides, set back to the pavement.
  const spots = useMemo(() => {
    const out: { id: string; at: XZ; rot: number; seed: number }[] = []
    for (const e of nav.edges) {
      if (e.width > 12 || e.len < 14 || nav.ys[e.a] || nav.ys[e.b]) continue
      const [a, b] = [nav.nodes[e.a], nav.nodes[e.b]]
      const [ux, uz] = [(b[0] - a[0]) / e.len, (b[1] - a[1]) / e.len]
      for (let d = EVERY / 2; d < e.len - 4; d += EVERY) {
        for (const side of [-1, 1]) {
          const m: XZ = [a[0] + ux * d, a[1] + uz * d]
          const h = hash(Math.round(m[0]), Math.round(m[1]), side > 0 ? 733 : 739)
          if (h > KEEP) continue
          const off = e.width / 2 + 2.2
          const at: XZ = [m[0] - uz * off * side, m[1] + ux * off * side]
          if (!nav.walkable(at[0], at[1]) || taken.some((t) => Math.hypot(t.at[0] - at[0], t.at[1] - at[1]) < t.r + 3)) continue
          // Facing the street.
          out.push({ id: `door:${seed}:${Math.round(at[0])}:${Math.round(at[1])}`, at, rot: Math.atan2(uz * side, -ux * side), seed: h / KEEP })
        }
      }
    }
    return out
  }, [nav, seed, taken])
  const [shown, setShown] = useState<Spot[]>([])
  const tick = useRef(10)
  const rain = useRain((r) => r.on)
  useFrame((_, dt) => {
    tick.current += dt
    if (tick.current < 1.2) return
    tick.current = 0
    const [sx, sz] = whereabouts.sim
    const kinds = night ? NIGHT : DAY
    const near = spots
      .map((s) => ({ s, d: Math.hypot(s.at[0] - sx, s.at[1] - sz) }))
      .filter((x) => x.d < NEAR && !inZone(x.s.at[0], x.s.at[1], 1.5))
      .sort((a, b) => a.d - b.d)
      .slice(0, MAX)
      .map(({ s }) => ({ ...s, kind: kinds[Math.floor(s.seed * kinds.length) % kinds.length] }))
    if (near.map((s) => s.id + s.kind).join() !== shown.map((s) => s.id + s.kind).join()) setShown(near)
    if (import.meta.env.DEV) Object.assign(globalThis, { __doorsteps: near, __doorstepsAll: spots.length })
  })
  if (rain) return null
  return (
    <NoShadows>
      {shown.map((s) => (
        <group key={s.id} position={[s.at[0], 0, s.at[1]]} rotation={[0, s.rot, 0]}>
          <Doorstep spot={s} />
        </group>
      ))}
    </NoShadows>
  )
}

type Person = { look: Required<Look>; gender: 'femme' | 'homme'; seed: number }
function cast(id: string, n: number, gender?: 'femme' | 'homme'): Person[] {
  const r = rng(`doorstep|${id}`)
  return [...Array(n)].map(() => {
    const g = gender ?? (r() < 0.5 ? 'femme' : 'homme')
    return { gender: g, look: randomLook(g, r), seed: r() * 100 }
  })
}

/** Whoever looks up as the Sim comes by: a wave for a moment, then back to it. */
function useGreet(ref: React.RefObject<THREE.Group | null>, pose: Pose, at = 4.5): Pose {
  const [waving, setWaving] = useState(false)
  const g = useRef({ done: false, until: 0 })
  const where = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ clock }) => {
    if (!ref.current) return
    ref.current.getWorldPosition(where)
    const d = Math.hypot(where.x - whereabouts.sim[0], where.z - whereabouts.sim[1])
    if (!g.current.done && d < at) {
      g.current = { done: true, until: clock.elapsedTime + 2.2 }
      setWaving(true)
    } else if (waving && clock.elapsedTime > g.current.until) setWaving(false)
    // Gone far again: the next time by, another wave.
    if (g.current.done && d > at * 3) g.current.done = false
  })
  return waving ? 'wave' : pose
}

function Doorstep({ spot }: { spot: Spot }) {
  switch (spot.kind) {
    case 'cuisine':
      return <Cuisine id={spot.id} />
    case 'tresses':
      return <Tresses id={spot.id} />
    case 'dames':
      return <Dames id={spot.id} />
    case 'telephone':
      return <Telephone id={spot.id} />
    case 'balai':
      return <Balai id={spot.id} />
    case 'lavage':
      return <Lavage id={spot.id} />
    case 'enfants':
      return <Enfants id={spot.id} />
    case 'vente':
      return <Vente id={spot.id} />
    case 'repos':
      return <Repos id={spot.id} />
  }
}

const M = (color: string, emissive?: string) => new THREE.MeshLambertMaterial({ color, ...(emissive ? { emissive, emissiveIntensity: 1.2 } : {}) })
const PLASTIC_RED = M('#d63a2f')
const PLASTIC_WHITE = M('#eeeeea')
const PLASTIC_BLUE = M('#2f6fd6')
const WOOD = M('#7a5233')
const IRON = M('#2a2a2a')
const POT = M('#5c5f66')
const EMBER = M('#ff6a1a', '#ff4a00')
const BOARD = M('#e8d9b0')
const DARK = M('#3a2a1e')
const STRAW = M('#c9a35b')
const WATER = new THREE.MeshLambertMaterial({ color: '#7fc4ea', transparent: true, opacity: 0.8 })
const GOODS = [M('#f08c00'), M('#e8c547'), M('#5aa832'), M('#d64545')]
const BOX = new THREE.BoxGeometry(1, 1, 1)
const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 12)
const BALL = new THREE.SphereGeometry(0.5, 10, 8)

function B({ p, s, m, r = 0 }: { p: [number, number, number]; s: [number, number, number]; m: THREE.Material; r?: number }) {
  return <mesh geometry={BOX} material={m} position={p} scale={s} rotation={[0, r, 0]} />
}
function C({ p, s, m }: { p: [number, number, number]; s: [number, number, number]; m: THREE.Material }) {
  return <mesh geometry={CYL} material={m} position={p} scale={s} />
}

/** A plastic chair (the white or red of every maquis), its seat at 0.42 m. */
function Chair({ p, r = 0, m = PLASTIC_WHITE }: { p: [number, number, number]; r?: number; m?: THREE.Material }) {
  return (
    <group position={p} rotation={[0, r, 0]}>
      <B p={[0, 0.4, 0]} s={[0.46, 0.05, 0.44]} m={m} />
      <B p={[0, 0.7, -0.2]} s={[0.46, 0.55, 0.05]} m={m} />
      {[-0.19, 0.19].flatMap((x) => [-0.18, 0.18].map((z) => <B key={`${x}${z}`} p={[x, 0.2, z]} s={[0.04, 0.4, 0.04]} m={m} />))}
    </group>
  )
}
/** A low wooden stool. */
function Stool({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <B p={[0, 0.25, 0]} s={[0.34, 0.05, 0.3]} m={WOOD} />
      <B p={[0, 0.12, 0]} s={[0.26, 0.24, 0.22]} m={WOOD} />
    </group>
  )
}

/** Someone of the doorstep, seated or standing, who can be talked to and waves at the Sim. */
function One({ id, person, pose, p, r = 0, kid = false }: { id: string; person: Person; pose: Pose; p: [number, number, number]; r?: number; kid?: boolean }) {
  const ref = useRef<THREE.Group>(null)
  const shown = useGreet(ref, pose)
  return (
    <group ref={ref} position={p} rotation={[0, r, 0]} scale={kid ? 0.62 : 1}>
      <TalkHuman id={id} look={person.look} gender={person.gender} pose={shown} seed={person.seed} />
    </group>
  )
}

/** The maman at her charcoal stove, the pot on it, the embers glowing under. */
function Cuisine({ id }: { id: string }) {
  const [m] = useMemo(() => cast(id, 1, 'femme'), [id])
  const steam = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (!steam.current) return
    const k = (clock.elapsedTime * 0.6) % 1
    steam.current.position.y = 0.75 + k * 0.7
    steam.current.scale.setScalar(0.12 + k * 0.25)
    ;(steam.current.material as THREE.MeshBasicMaterial).opacity = 0.45 * (1 - k)
  })
  return (
    <group>
      <Solid parts>
        <group position={[0.1, 0, 0.75]}>
          <C p={[0, 0.16, 0]} s={[0.36, 0.32, 0.36]} m={IRON} />
          <C p={[0, 0.3, 0]} s={[0.26, 0.04, 0.26]} m={EMBER} />
          <C p={[0, 0.45, 0]} s={[0.4, 0.26, 0.4]} m={POT} />
          <mesh ref={steam} geometry={BALL}>
            <meshBasicMaterial color="#ffffff" transparent opacity={0.4} depthWrite={false} />
          </mesh>
        </group>
        <Stool p={[0.1, 0, 0]} />
      </Solid>
      <One id={`${id}:m`} person={m} pose="cook" p={[0.1, 0, 0]} />
    </group>
  )
}

/** Hair being braided: the coiffeuse on a chair, the girl on a stool in front, a mat of combs and mèches. */
function Tresses({ id }: { id: string }) {
  const [c, g] = useMemo(() => [...cast(id, 1, 'femme'), ...cast(`${id}g`, 1, 'femme')], [id])
  return (
    <group>
      <Solid parts>
        <Chair p={[0, 0, -0.3]} m={PLASTIC_BLUE} />
        <Stool p={[0, 0, 0.35]} />
        <B p={[0.75, 0.01, 0.1]} s={[0.6, 0.02, 0.5]} m={STRAW} />
      </Solid>
      <One id={`${id}:c`} person={c} pose="busy" p={[0, 0, -0.3]} />
      <One id={`${id}:g`} person={g} pose="sit" p={[0, -0.12, 0.35]} kid />
    </group>
  )
}

/** Two old men over a game of dames on a crate, a third watching. */
function Dames({ id }: { id: string }) {
  const [a, b, w] = useMemo(() => cast(id, 3, 'homme'), [id])
  return (
    <group>
      <Solid parts>
        <B p={[0, 0.3, 0]} s={[0.55, 0.6, 0.55]} m={WOOD} />
        <B p={[0, 0.61, 0]} s={[0.5, 0.02, 0.5]} m={BOARD} />
        {[...Array(8)].map((_, i) => (
          <C key={i} p={[((i % 4) - 1.5) * 0.11, 0.635, (i < 4 ? -1 : 1) * 0.17]} s={[0.07, 0.025, 0.07]} m={i < 4 ? DARK : PLASTIC_WHITE} />
        ))}
        <Chair p={[-0.75, 0, 0]} r={Math.PI / 2} m={PLASTIC_RED} />
        <Chair p={[0.75, 0, 0]} r={-Math.PI / 2} m={PLASTIC_RED} />
      </Solid>
      <One id={`${id}:a`} person={a} pose="sit" p={[-0.75, 0, 0]} r={Math.PI / 2} />
      <One id={`${id}:b`} person={b} pose="sit" p={[0.75, 0, 0]} r={-Math.PI / 2} />
      <One id={`${id}:w`} person={w} pose="idle" p={[0.2, 0, -0.95]} r={0.3} />
    </group>
  )
}

/** On the phone on a plastic chair, at the door. */
function Telephone({ id }: { id: string }) {
  const [p] = useMemo(() => cast(id, 1), [id])
  return (
    <group>
      <Solid parts>
        <Chair p={[0, 0, 0]} />
      </Solid>
      <One id={`${id}:p`} person={p} pose="call" p={[0, 0, 0]} />
    </group>
  )
}

/** Sweeping her bit of pavement, to and fro, with a broom of straw. */
function Balai({ id }: { id: string }) {
  const [p] = useMemo(() => cast(id, 1, 'femme'), [id])
  const g = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (!g.current) return
    const t = clock.elapsedTime * 0.35 + p.seed
    g.current.position.x = Math.sin(t) * 1.6
    g.current.rotation.y = Math.cos(t) > 0 ? Math.PI / 2 : -Math.PI / 2
  })
  return (
    <group ref={g}>
      <One id={`${id}:p`} person={p} pose="busy" p={[0, 0, 0]} />
      <group position={[0.15, 0, 0.45]} rotation={[0.5, 0, 0]}>
        <C p={[0, 0.45, 0]} s={[0.03, 0.9, 0.03]} m={WOOD} />
        <C p={[0, 0.02, 0]} s={[0.22, 0.12, 0.22]} m={STRAW} />
      </group>
    </group>
  )
}

/** A boy washing a moto, his bucket by it. */
function Lavage({ id }: { id: string }) {
  const [p] = useMemo(() => cast(id, 1, 'homme'), [id])
  return (
    <group>
      <Solid parts>
        <group position={[0, 0, 0.9]} rotation={[0, Math.PI / 2, 0]}>
          <Vehicle p={[0, 0, 0]} kind="moto" color="#c0392b" seed={hash(p.seed, 3) * 100} crew={false} />
        </group>
        <C p={[0.9, 0.16, 0.2]} s={[0.32, 0.32, 0.32]} m={PLASTIC_BLUE} />
        <C p={[0.9, 0.3, 0.2]} s={[0.28, 0.02, 0.28]} m={WATER} />
      </Solid>
      <One id={`${id}:p`} person={p} pose="wash" p={[0.2, 0, 0.1]} r={0.2} />
    </group>
  )
}

/** Children chasing each other round and round, a ball between them. */
function Enfants({ id }: { id: string }) {
  const kids = useMemo(() => cast(id, 3), [id])
  const refs = useRef<(THREE.Group | null)[]>([])
  useFrame(({ clock }) => {
    kids.forEach((k, i) => {
      const g = refs.current[i]
      if (!g) return
      const a = clock.elapsedTime * 1.1 + (i * Math.PI * 2) / kids.length + k.seed * 0.01
      g.position.set(Math.cos(a) * 1.7, 0, Math.sin(a) * 1.1)
      g.rotation.y = -a
    })
  })
  return (
    <group>
      {kids.map((k, i) => (
        <group key={i} ref={(g) => void (refs.current[i] = g)}>
          <One id={`${id}:k${i}`} person={k} pose="run" p={[0, 0, 0]} kid />
        </group>
      ))}
    </group>
  )
}

/** A seller behind her basin of fruit, under a parasol. */
function Vente({ id }: { id: string }) {
  const [p] = useMemo(() => cast(id, 1, 'femme'), [id])
  const goods = GOODS[Math.floor(p.seed) % GOODS.length]
  return (
    <group>
      <Solid parts>
        <Stool p={[0, 0, -0.2]} />
        <B p={[0, 0.3, 0.45]} s={[0.9, 0.6, 0.5]} m={WOOD} />
        <C p={[0, 0.66, 0.45]} s={[0.6, 0.12, 0.6]} m={POT} />
        {[...Array(5)].map((_, i) => (
          <mesh key={i} geometry={BALL} material={goods} position={[(i - 2) * 0.1, 0.76, 0.45 + ((i % 2) - 0.5) * 0.12]} scale={0.11} />
        ))}
        <C p={[0.55, 1.1, 0.2]} s={[0.04, 2.2, 0.04]} m={IRON} />
      </Solid>
      <mesh position={[0.55, 2.2, 0.2]} material={GOODS[(Math.floor(p.seed) + 1) % GOODS.length]}>
        <coneGeometry args={[1.1, 0.4, 8, 1, true]} />
      </mesh>
      <One id={`${id}:p`} person={p} pose="sit" p={[0, 0, -0.2]} />
    </group>
  )
}

/** A papa resting on a chair in the cool, his little radio on a stool beside him. */
function Repos({ id }: { id: string }) {
  const [p] = useMemo(() => cast(id, 1, 'homme'), [id])
  return (
    <group>
      <Solid parts>
        <Chair p={[0, 0, 0]} m={PLASTIC_RED} />
        <Stool p={[0.6, 0, 0.1]} />
        <B p={[0.6, 0.36, 0.1]} s={[0.26, 0.14, 0.1]} m={IRON} />
      </Solid>
      <One id={`${id}:p`} person={p} pose="sit" p={[0, 0, 0]} />
    </group>
  )
}
