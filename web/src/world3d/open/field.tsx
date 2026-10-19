import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Human, NoShadows, type Pose } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import { worldTime } from '../../lib/worldClock'
import { rng } from '../themes'
import type { Field } from './places'
import { PER_TEAM, SIM_SLOT, matchFor } from './match'
import { FieldFence } from './fieldFence'
import { StaticMerge } from '../staticMerge'

// A maracana or a basketball court on the map, and the match always being
// played on it (open/match.ts): the surface and its lines, the goals or the
// baskets, floodlights that come on at night, a few people watching, and
// ten players. When the Sim plays here, it takes one of their places.
// Drawn in the field's frame: x along its length, z across.

const BOX = new THREE.BoxGeometry(1, 1, 1)
const white = new THREE.MeshLambertMaterial({ color: '#f4f4f0' })
const post = new THREE.MeshLambertMaterial({ color: '#e9ecef' })
const steel = new THREE.MeshLambertMaterial({ color: '#59606a' })
const net = new THREE.MeshBasicMaterial({ color: '#ffffff', wireframe: true, transparent: true, opacity: 0.55 })
const rim = new THREE.MeshLambertMaterial({ color: '#e85d04' })
const board = new THREE.MeshLambertMaterial({ color: '#f8f9fa' })
const lampOff = new THREE.MeshLambertMaterial({ color: '#d9dde2' })
const lampOn = new THREE.MeshBasicMaterial({ color: '#fff6dc' })
const flat = (color: string) => new THREE.MeshLambertMaterial({ color })

/** A painted line on the ground, from a to b (field frame). */
function Line({ a, b, w = 0.12 }: { a: [number, number]; b: [number, number]; w?: number }) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  return <mesh geometry={BOX} material={white} position={[(a[0] + b[0]) / 2, 0.045, (a[1] + b[1]) / 2]} rotation={[0, -Math.atan2(b[1] - a[1], b[0] - a[0]), 0]} scale={[len, 0.01, w]} />
}
function Arc({ at, r, from, to }: { at: [number, number]; r: number; from: number; to: number }) {
  return (
    <mesh position={[at[0], 0.046, at[1]]} rotation={[-Math.PI / 2, 0, 0]} material={white}>
      <ringGeometry args={[r - 0.05, r + 0.05, 40, 1, from, to - from]} />
    </mesh>
  )
}

/** A maracana goal: two posts, the bar, the net behind. 3 × 2 m. */
function Goal({ x, side }: { x: number; side: 1 | -1 }) {
  return (
    <group position={[x, 0, 0]}>
      {[-1.5, 1.5].map((z) => (
        <mesh key={z} geometry={BOX} material={post} position={[0, 1, z]} scale={[0.12, 2, 0.12]} castShadow />
      ))}
      <mesh geometry={BOX} material={post} position={[0, 2, 0]} scale={[0.12, 0.12, 3.12]} castShadow />
      <mesh geometry={BOX} material={net} position={[side * 0.6, 1, 0]} scale={[1.2, 2, 3]} />
    </group>
  )
}

/** A basket on its stand behind the baseline, facing the court. */
function Hoop({ x, side }: { x: number; side: 1 | -1 }) {
  return (
    <group position={[x, 0, 0]}>
      <mesh geometry={BOX} material={steel} position={[side * 1.2, 1.6, 0]} scale={[0.16, 3.2, 0.16]} castShadow />
      <mesh geometry={BOX} material={steel} position={[side * 0.75, 3.2, 0]} scale={[0.9, 0.1, 0.1]} />
      <mesh geometry={BOX} material={board} position={[side * 0.3, 3.4, 0]} scale={[0.05, 1.05, 1.8]} castShadow />
      <mesh position={[0, 3.05, 0]} rotation={[Math.PI / 2, 0, 0]} material={rim}>
        <torusGeometry args={[0.23, 0.02, 6, 16]} />
      </mesh>
      <mesh position={[0, 2.85, 0]} material={net}>
        <cylinderGeometry args={[0.22, 0.14, 0.38, 10, 2, true]} />
      </mesh>
    </group>
  )
}

/** The surface and the markings. */
function Ground({ field, seed }: { field: Field; seed: string }) {
  const { len: L, wid: W, sport } = field
  const [hl, hw] = [L / 2, W / 2]
  const looks = useMemo(() => {
    const r = rng(`ground${seed}`)
    // A maracana is laterite or a green synthetic pitch; a court, concrete with its keys painted.
    return sport === 'foot' ? (r() < 0.55 ? { ground: '#b98552', paint: '#b98552' } : { ground: '#3f9e4d', paint: '#3f9e4d' }) : { ground: '#b9b2a6', paint: ['#2f6fd6', '#c2410c', '#2b8a3e'][Math.floor(r() * 3)] }
  }, [seed, sport])
  const mats = useMemo(() => ({ ground: flat(looks.ground), paint: flat(looks.paint) }), [looks])
  return (
    <group>
      <mesh geometry={BOX} material={mats.ground} position={[0, 0.02, 0]} scale={[L + 2, 0.02, W + 2]} receiveShadow />
      <Line a={[-hl, -hw]} b={[hl, -hw]} />
      <Line a={[-hl, hw]} b={[hl, hw]} />
      <Line a={[-hl, -hw]} b={[-hl, hw]} />
      <Line a={[hl, -hw]} b={[hl, hw]} />
      {(sport === 'foot' || L >= 20) && <Line a={[0, -hw]} b={[0, hw]} />}
      {(sport === 'foot' || L >= 20) && <Arc at={[0, 0]} r={Math.min(3, W * 0.15)} from={0} to={Math.PI * 2} />}
      {sport === 'foot' ? (
        <>
          {/* The goal areas: half-circles in front of each goal */}
          <Arc at={[-hl, 0]} r={Math.min(6, W * 0.3)} from={-Math.PI / 2} to={Math.PI / 2} />
          <Arc at={[hl, 0]} r={Math.min(6, W * 0.3)} from={Math.PI / 2} to={(Math.PI * 3) / 2} />
          <Goal x={-hl} side={-1} />
          <Goal x={hl} side={1} />
        </>
      ) : (
        <>
          {/* The keys, painted, and the three-point lines */}
          {(L >= 20 ? [-1, 1] : [1]).map((s) => (
            <group key={s}>
              <mesh geometry={BOX} material={mats.paint} position={[s * (hl - 2.9), 0.03, 0]} scale={[5.8, 0.02, 4.9]} />
              <Line a={[s * (hl - 5.8), -2.45]} b={[s * (hl - 5.8), 2.45]} />
              <Arc at={[s * (hl - 5.8), 0]} r={1.8} from={s > 0 ? Math.PI / 2 : -Math.PI / 2} to={s > 0 ? (Math.PI * 3) / 2 : Math.PI / 2} />
              <Arc at={[s * (hl - 1.575), 0]} r={Math.min(6.75, hw - 0.5)} from={s > 0 ? Math.PI / 2 + 0.25 : -Math.PI / 2 + 0.25} to={s > 0 ? (Math.PI * 3) / 2 - 0.25 : Math.PI / 2 - 0.25} />
              <Hoop x={s * (hl - 1.575)} side={s as 1 | -1} />
            </group>
          ))}
        </>
      )}
    </group>
  )
}

/** Floodlights at two corners, lit at night. */
function Lights({ field, night }: { field: Field; night: boolean }) {
  const [hl, hw] = [field.len / 2, field.wid / 2]
  return (
    <>
      {[
        [-hl - 1.5, -hw - 1.5],
        [hl + 1.5, hw + 1.5],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh geometry={BOX} material={steel} position={[0, 4.5, 0]} scale={[0.22, 9, 0.22]} castShadow />
          <mesh geometry={BOX} material={night ? lampOn : lampOff} position={[0, 9.1, 0]} scale={[1.6, 0.6, 0.3]} rotation={[0, i ? Math.PI / 4 : (-3 * Math.PI) / 4, 0]} />
        </group>
      ))}
      {night && <pointLight position={[0, 9, 0]} intensity={60} distance={Math.max(field.len, 26)} color="#fff3d6" />}
    </>
  )
}

type Player = { team: 0 | 1; i: number; look: ReturnType<typeof randomLook>; gender: 'femme' | 'homme'; seed: number }

/**
 * The match: ten players moved every frame from the match's script, and the
 * ball. A pose changes only now and then, so React redraws them rarely.
 */
function Players({ field, seed, without }: { field: Field; seed: string; without: number | null }) {
  const match = matchFor(seed, field)
  const foot = field.sport === 'foot'
  const players = useMemo<Player[]>(() => {
    const r = rng(`players${seed}`)
    const kits = foot
      ? [
          ['#ff7a00', '#ffffff'],
          ['#1d4ed8', '#00a862'],
          ['#d62828', '#f2c94c'],
        ][Math.floor(r() * 3)]
      : [
          ['#7b5cff', '#f8f9fa'],
          ['#141416', '#ff7a00'],
        ][Math.floor(r() * 2)]
    const out: Player[] = []
    for (const team of [0, 1] as const)
      for (let i = 0; i < PER_TEAM; i++) {
        const gender: 'femme' | 'homme' = foot || r() < 0.8 ? 'homme' : 'femme'
        const base = randomLook(gender, r)
        // The keeper in another colour; everyone in the team's.
        const keeper = foot && i === 0
        out.push({
          team,
          i,
          gender,
          seed: r() * 100,
          look: { ...base, outfit: foot ? 'jersey' : 'basket', outfitColor: keeper ? '#141416' : kits[team], accessory: 'none', hair: base.hair === 'headwrap' ? 'short' : base.hair },
        })
      }
    return out
  }, [seed, foot])
  const refs = useRef<(THREE.Group | null)[]>([])
  const ball = useRef<THREE.Mesh>(null)
  const poses = useRef<Pose[]>(players.map(() => 'idle'))
  // How fast each one runs (to the next m/s), so the steps match the ground covered.
  const speeds = useRef<number[]>(players.map(() => 0))
  const [, redraw] = useState(0)
  useFrame(() => {
    const t = worldTime()
    let changed = false
    players.forEach((p, k) => {
      const g = refs.current[k]
      if (!g) return
      const s = match.player(p.team, p.i, t)
      g.position.set(s.u, 0, s.v)
      // The Sim faces +z at 0: in the field's frame, `face` is from +x towards +z.
      g.rotation.y = Math.atan2(Math.cos(s.face), Math.sin(s.face))
      const v = Math.round(s.speed)
      if (s.pose !== poses.current[k] || v !== speeds.current[k]) {
        poses.current[k] = s.pose
        speeds.current[k] = v
        changed = true
      }
    })
    const b = match.ball(t)
    ball.current?.position.set(b.u, b.y, b.v)
    if (changed) redraw((n) => n + 1)
  })
  return (
    <NoShadows>
      {players.map((p, k) =>
        p.team === 0 && p.i === without ? null : (
          <group key={k} ref={(g) => void (refs.current[k] = g)}>
            <Human look={p.look} gender={p.gender} pose={poses.current[k]} seed={p.seed} speed={speeds.current[k] || undefined} />
          </group>
        ),
      )}
      <mesh ref={ball} castShadow>
        <sphereGeometry args={[foot ? 0.11 : 0.12, 10, 8]} />
        <meshLambertMaterial color={foot ? '#f4f4f4' : '#e8590c'} />
      </mesh>
    </NoShadows>
  )
}

/**
 * The people watching from both touchlines, each for one team: chatting,
 * calling out, waving the players on; on their side's goal they jump up,
 * on the other side's they grumble.
 */
function Watchers({ field, seed }: { field: Field; seed: string }) {
  const match = matchFor(seed, field)
  const people = useMemo(() => {
    const r = rng(`watch${seed}`)
    const n = field.sport === 'foot' ? 14 : 10
    return [...Array(n)].map((_, i) => {
      const gender: 'femme' | 'homme' = r() < 0.4 ? 'femme' : 'homme'
      const side = i % 2 ? 1 : -1
      const along = (Math.floor(i / 2) / Math.max(1, Math.floor(n / 2) - 1) - 0.5) * field.len * 0.85 + (r() - 0.5) * 1.6
      return { gender, look: randomLook(gender, r), seed: r() * 100, x: along, z: side * (field.wid / 2 + 1.5 + r() * 0.9), team: (r() < 0.5 ? 0 : 1) as 0 | 1, side }
    })
  }, [seed, field.len, field.wid, field.sport])
  const poses = useRef<Pose[]>(people.map(() => 'idle'))
  const [, redraw] = useState(0)
  const last = useRef(0)
  useFrame(() => {
    const t = worldTime()
    if (t - last.current < 0.3) return
    last.current = t
    const m = match.moment(t)
    let changed = false
    people.forEach((p, k) => {
      // Between moments, each one's own mood, changing every few seconds.
      const n = Math.sin(Math.floor((t + p.seed * 3) / 5) * 12.9898 + p.seed * 78.233) * 43758.5453
      const mood = n - Math.floor(n)
      const pose: Pose =
        m.kind === 'goal' ? (m.team === p.team ? 'cheer' : mood < 0.4 ? 'rant' : 'idle')
        : m.kind === 'shot' ? (m.team === p.team ? 'wave' : 'idle')
        : mood < 0.45 ? 'idle' : mood < 0.72 ? 'talk' : mood < 0.88 ? 'wave' : 'rant'
      if (pose !== poses.current[k]) {
        poses.current[k] = pose
        changed = true
      }
    })
    if (changed) redraw((x) => x + 1)
  })
  return (
    <NoShadows>
      {people.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]} rotation={[0, p.side > 0 ? Math.PI : 0, 0]}>
          <Human look={p.look} gender={p.gender} pose={poses.current[i]} seed={p.seed} />
        </group>
      ))}
    </NoShadows>
  )
}

/**
 * The whole field at its place on the map. `withSim`: the Sim is playing
 * here, in the place of one of the players (the Walker moves it).
 */
export function SportField({ field, seed, night, withSim, onPick }: { field: Field; seed: string; night: boolean; withSim: boolean; onPick?: () => void }) {
  return (
    <group
      position={[field.at[0], 0, field.at[1]]}
      rotation={[0, -field.angle, 0]}
      onClick={
        onPick &&
        ((e) => {
          e.stopPropagation()
          onPick()
        })
      }
    >
      <StaticMerge version={night ? 1 : 0}>
        <Ground field={field} seed={seed} />
        <Lights field={field} night={night} />
      </StaticMerge>
      <FieldFence hl={field.len / 2 + 1.05} hw={field.wid / 2 + 1.05} id={seed} />
      <Players field={field} seed={seed} without={withSim ? SIM_SLOT[field.sport] : null} />
      <Watchers field={field} seed={seed} />
    </group>
  )
}
