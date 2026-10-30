import { SpotActions } from '../SpotActions'
import { Suspense, useMemo, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Sim } from '../../lib/types'
import { worldTime } from '../../lib/worldClock'
import { NoShadows, type Pose } from '../../avatar/Human'
import { LowHuman } from '../../avatar/LowHuman'
import { randomLook } from '../../avatar/options'
import { rng } from '../themes'
import { Snapper } from '../snapshot'
import { ChatFraming } from '../chatFraming'
import { TalkHuman } from '../Talkable'
import { BOX, Blocks } from '../open/ruePrincesse'
import { WavingFlag } from '../open/flag'
import { Guest, mat, sign, useBigWalk, type Spot, type XZ, spotWhere, RichAO } from './bigPlace'
import { t } from '../../lib/i18n'

// Inside the Assemblée nationale: the hemicycle. The deputies' rows in arcs
// rising round the floor, a desk before each seat; the perch at the far end
// where the President of the Assembly sits over the secretaries, the
// speakers' rostrum below it, the flags and the arms behind; the ushers in
// black; the public gallery up at the back, where anyone may follow a
// sitting. In a sitting, someone speaks at the rostrum; now and then the house
// votes by a show of hands, then applauds. Frame: +z the gallery and the
// doors, y 0 the floor.

/** The hemicycle's middle; its first and last rows' radii, the step between rows and how much each rises. */
const CZ = -10
const R0 = 7
const ROW_R = 1.7
const ROWS = 9
const RISE = 0.45
const RMAX = R0 + ROWS * ROW_R
const TOPR = ROWS * RISE
/** The arc the rows go round (from the middle line, each side), the aisles' angles. */
const ARC = (80 * Math.PI) / 180
const AISLES = [-Math.PI / 4, 0, Math.PI / 4]
/** The public gallery: where it starts, how high, how far back; the hall's half width. */
const GZ = CZ + RMAX + 2
const GAL = TOPR + 1.2
const BACK = GZ + 6
const HW = 25
const ENTRANCE: XZ = [0, BACK - 1]
const BENCHES = [GZ + 1, GZ + 2.3, GZ + 3.6]
/** The wall behind the perch; the ushers' desk up on the gallery. */
const WALLZ = CZ - 10
const DESK: XZ = [12.8, BACK - 1.6]

const polar = (x: number, z: number) => ({ r: Math.hypot(x, z - CZ), a: Math.atan2(x, z - CZ) })
const rowOf = (r: number) => Math.min(ROWS - 1, Math.max(0, Math.floor((r - R0) / ROW_R)))

/** The floor's height: the floor, the rows' steps, the corridor behind them, the ramp up the middle to the gallery. */
function ground(x: number, z: number) {
  if (z >= GZ) return GAL
  const { r } = polar(x, z)
  if (z < CZ || r < R0) return 0
  if (r <= RMAX) return (rowOf(r) + 1) * RISE
  if (Math.abs(x) < 1.6) return TOPR + Math.min(1, Math.max(0, (z - (CZ + RMAX)) / 2)) * (GAL - TOPR)
  return TOPR
}

function free(x: number, z: number) {
  if (Math.abs(x) > HW - 0.6 || z > BACK - 0.5) return false
  if (z >= GZ) {
    // The gallery: round its benches, by the middle aisle or along the front and back.
    if (Math.abs(x) > 14) return false
    for (const b of BENCHES) if (Math.abs(z - b) < 0.45 && Math.abs(x) > 1.2) return false
    return !(Math.abs(x - DESK[0]) < 0.9 && Math.abs(z - DESK[1]) < 1.4)
  }
  if (z < CZ - 0.5) return false
  const { r, a } = polar(x, z)
  // The floor before the rostrum; the corridor behind the last row (to the ramp up).
  if (r < R0 - 0.7) return true
  if (r > RMAX + 0.3) return Math.abs(x) < 1.5 || z < GZ - 0.6
  // On the rows: only down the aisles.
  return AISLES.some((al) => Math.abs(a - al) * r < 0.75)
}

const SPOTS: Record<string, Spot> = {
  // On the gallery's front bench, by the aisle: the sitting below.
  'seance-publique': { at: [2.2, BENCHES[0]], rot: Math.PI, pose: 'sit', y: GAL + 0.05, from: [0.5, BENCHES[0]] },
  // Round the floor, before the rostrum.
  'visite-hemicycle': { at: [4, CZ + 4], rot: 0, pose: 'walk', loop: { c: [0, CZ + 3.6], r: [4, 1.8], speed: 0.12 } },
  // At the ushers' desk, up on the gallery.
  petition: { at: [DESK[0] - 1, DESK[1]], rot: Math.PI / 2, pose: 'busy', y: GAL },
  // On the floor, the perch behind for the photo.
  'selfie-assemblee': { at: [3.5, CZ + 4.2], rot: 0, pose: 'film' },
}

export function AssembleeInside({ sim, interactionId, roam, night, stage }: { sim: Sim; interactionId?: string; /** Just come in: walk about (tap the floor, or the keys). */ roam?: boolean; night: boolean; stage: string }) {
  const spot = interactionId ? (SPOTS[interactionId] ?? null) : null
  const { way, tap, onMoved } = useBigWalk(spot, interactionId, roam, free, ENTRANCE)
  // A sitting: weekday mornings, or when one came to follow it.
  const minutes = sim.gameMinutes ?? 0
  const hour = Math.floor(minutes / 60) % 24
  const day = Math.floor(minutes / 1440) % 7
  const sitting = interactionId === 'seance-publique' || (day < 5 && hour >= 9 && hour < 13)
  return (
    <div className="absolute inset-0">
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [0, 13, 12], fov: 45, near: 0.3, far: 600 }} style={{ background: night ? '#0b1026' : '#e9e4d8' }}>
        <Snapper />
        <ChatFraming />
        <Suspense fallback={null}>
          <hemisphereLight args={['#fffaf0', '#7a6a50', 1]} />
          <directionalLight position={[8, 40, 20]} intensity={0.8} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-28} shadow-camera-right={28} shadow-camera-top={30} shadow-camera-bottom={-30} />
          <Hemicycle
            onFloor={(p) => {
              if (roam && !interactionId) tap(p)
            }}
          />
          <Perch />
          <House sitting={sitting} />
          <Gallery sitting={sitting} />
          <Guest sim={sim} stage={stage} way={way} spot={spot} steer={!!roam && !interactionId} onMoved={onMoved} free={free} entrance={ENTRANCE} ground={ground} />
          <SpotActions shown={!!roam && !interactionId} where={spotWhere(SPOTS)} entrance={[ENTRANCE[0], GAL, ENTRANCE[1]]} />
          <OrbitControls makeDefault target={[0, 2, -2]} enablePan={false} minDistance={5} maxDistance={70} minPolarAngle={0.25} maxPolarAngle={1.35} enableDamping />
        </Suspense>
        <RichAO />
      </Canvas>
    </div>
  )
}

/** Every seat round the rows: where, which row, which way it faces (to the middle). */
const SEATS = (() => {
  const out: { at: XZ; row: number; ry: number }[] = []
  for (let i = 0; i < ROWS; i++) {
    const r = R0 + i * ROW_R + ROW_R * 0.62
    const n = Math.floor((2 * ARC * r) / 1.05)
    for (let k = 0; k <= n; k++) {
      const a = -ARC + (2 * ARC * k) / n
      if (AISLES.some((al) => Math.abs(a - al) * r < 0.9)) continue
      out.push({ at: [Math.sin(a) * r, CZ + Math.cos(a) * r], row: i, ry: a + Math.PI })
    }
  }
  return out
})()

/** The rows: their steps in arcs, the desks and the green seats; the floor; the walls. A tap walks there. */
function Hemicycle({ onFloor }: { onFloor: (p: XZ) => void }) {
  const steps = useMemo(() => {
    // Each row a ring of short blocks round the arc, its height its step's.
    const b: { p: [number, number, number]; s: [number, number, number]; ry: number }[] = []
    for (let i = 0; i < ROWS; i++) {
      const r = R0 + i * ROW_R + ROW_R / 2
      const n = Math.ceil((2 * ARC * r) / 1)
      for (let k = 0; k < n; k++) {
        const a = -ARC + (2 * ARC * (k + 0.5)) / n
        const y = (i + 1) * RISE
        b.push({ p: [Math.sin(a) * r, y / 2, CZ + Math.cos(a) * r], s: [(2 * ARC * r) / n + 0.05, y, ROW_R], ry: a })
      }
    }
    return b
  }, [])
  const desks = useMemo(
    () =>
      SEATS.flatMap((s) => {
        const y = (s.row + 1) * RISE
        const [dx, dz] = [-Math.sin(s.ry - Math.PI) * 0.62, -Math.cos(s.ry - Math.PI) * 0.62]
        return [
          { p: [s.at[0] + dx, y + 0.42, s.at[1] + dz] as [number, number, number], s: [0.95, 0.84, 0.18] as [number, number, number], ry: s.ry },
          { p: [s.at[0], y + 0.24, s.at[1]] as [number, number, number], s: [0.6, 0.12, 0.55] as [number, number, number], ry: s.ry, c: '#2b8a3e' },
        ]
      }),
    [],
  )
  const walls = useMemo(
    () => [
      { p: [-HW - 0.3, 5, (WALLZ + BACK) / 2] as [number, number, number], s: [0.6, 10, BACK - WALLZ] as [number, number, number] },
      { p: [HW + 0.3, 5, (WALLZ + BACK) / 2] as [number, number, number], s: [0.6, 10, BACK - WALLZ] as [number, number, number] },
      { p: [0, 6, WALLZ - 0.3] as [number, number, number], s: [2 * HW + 1.2, 12, 0.6] as [number, number, number] },
      // The gallery's floor and its balustrade over the corridor; the low wall behind.
      { p: [0, GAL / 2, (GZ + BACK) / 2] as [number, number, number], s: [2 * HW, GAL, BACK - GZ] as [number, number, number] },
      { p: [-8.4, GAL + 0.5, GZ + 0.1] as [number, number, number], s: [11.2, 1, 0.2] as [number, number, number] },
      { p: [8.4, GAL + 0.5, GZ + 0.1] as [number, number, number], s: [11.2, 1, 0.2] as [number, number, number] },
      { p: [0, GAL + 0.6, BACK + 0.2] as [number, number, number], s: [2 * HW, 1.2, 0.4] as [number, number, number] },
    ],
    [],
  )
  const tap = (e: { delta: number; stopPropagation: () => void; point: THREE.Vector3 }) => {
    if (e.delta > 6) return
    e.stopPropagation()
    onFloor([e.point.x, e.point.z])
  }
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, (WALLZ + BACK) / 2]} receiveShadow onClick={tap}>
        <planeGeometry args={[2 * HW, BACK - WALLZ]} />
        <meshLambertMaterial color="#8a2b2b" />
      </mesh>
      <group onClick={tap}>
        <Blocks at={steps} material={mat('#6b4a32')} />
        <Blocks at={walls} material={mat('#efe9dd')} />
      </group>
      <Blocks at={desks} material={mat('#ffffff')} color />
      {/* The floor's half-circle of carpet before the rostrum */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, CZ]}>
        <circleGeometry args={[R0 - 0.3, 32, -Math.PI / 2, Math.PI]} />
        <meshLambertMaterial color="#b02a2a" />
      </mesh>
    </group>
  )
}

/** The perch: the President's high desk, the secretaries' below, the rostrum before; behind, the wall with the arms, the name and the flags. */
function Perch() {
  const name = useMemo(() => sign(t('ASSEMBLÉE NATIONALE'), '#f4f1ea', '#5a4a24', 1024, 112), [])
  const motto = useMemo(() => sign(t('UNION · DISCIPLINE · TRAVAIL'), '#f4f1ea', '#5a4a24', 1024, 96), [])
  const blocks = useMemo(
    () => [
      // The secretaries' platform and its desk's front; the President's dais over it and his desk's front, in wood.
      { p: [0, 0.5, CZ - 5.8] as [number, number, number], s: [10, 1, 2] as [number, number, number] },
      { p: [0, 1.45, CZ - 4.95] as [number, number, number], s: [9, 0.9, 0.3] as [number, number, number] },
      { p: [0, 1.2, CZ - 8.3] as [number, number, number], s: [6, 2.4, 3] as [number, number, number] },
      { p: [0, 2.95, CZ - 6.95] as [number, number, number], s: [5, 1.1, 0.3] as [number, number, number] },
      // The rostrum before them, facing the rows.
      { p: [0, 0.6, CZ - 2.2] as [number, number, number], s: [1.6, 1.2, 0.9] as [number, number, number] },
    ],
    [],
  )
  return (
    <group>
      <Blocks at={blocks} material={mat('#7a5232')} />
      <mesh position={[0, 1.24, CZ - 2]} rotation={[-0.4, 0, 0]} geometry={BOX} scale={[1.4, 0.06, 0.6]} material={mat('#5a3a22')} />
      {/* The arms of the Republic: the gold disc and its elephant's head, over the name and the motto */}
      <mesh position={[0, 8.4, WALLZ + 0.1]} rotation={[Math.PI / 2, 0, 0]} material={mat('#d4a62a', '#5a4206')}>
        <cylinderGeometry args={[1.6, 1.6, 0.15, 28]} />
      </mesh>
      <mesh position={[0, 8.4, WALLZ + 0.22]} scale={[0.9, 0.8, 0.12]} material={mat('#8a6a1a')}>
        <sphereGeometry args={[1, 12, 10]} />
      </mesh>
      <mesh position={[0, 6, WALLZ + 0.05]} scale={[14, 1.5, 1]} material={name}>
        <planeGeometry />
      </mesh>
      <mesh position={[0, 4.9, WALLZ + 0.05]} scale={[11, 1, 1]} material={motto}>
        <planeGeometry />
      </mesh>
      {[-9, 9].map((x, i) => (
        <group key={x} position={[x, 0, WALLZ + 1.2]}>
          <WavingFlag height={7.5} w={2.2} seed={i * 4} />
        </group>
      ))}
    </group>
  )
}

/** The house in a sitting: the deputies on their seats, the speaker at the rostrum, the President and the secretaries, the ushers; the votes by a show of hands, the applause. Out of a sitting, a few in their seats. */
function House({ sitting }: { sitting: boolean }) {
  const deputies = useMemo(() => {
    const r = rng(sitting ? 'assemblee-seance' : 'assemblee-calme')
    const want = sitting ? 170 : 14
    const picked = new Set<number>()
    while (picked.size < Math.min(want, SEATS.length)) picked.add(Math.floor(r() * SEATS.length))
    return [...picked].map((i) => {
      const s = SEATS[i]
      const gender: 'femme' | 'homme' = r() < 0.3 ? 'femme' : 'homme'
      const look = randomLook(gender, r)
      const dress = gender === 'homme' ? (r() < 0.65 ? 'suit' : r() < 0.5 ? 'bazin' : 'boubou') : r() < 0.5 ? 'kaba' : 'bazin'
      return { ...s, y: (s.row + 1) * RISE + 0.05, gender, look: { ...look, outfit: dress }, seed: r() * 100, ayes: r() < 0.72 }
    })
  }, [sitting])
  // The sitting's round: the debate, then a vote by show of hands, then the applause.
  const [phase, setPhase] = useState<'debat' | 'vote' | 'bravo'>('debat')
  useFrame(() => {
    if (!sitting) return
    const k = worldTime() % 26
    const p = k < 17 ? 'debat' : k < 22 ? 'vote' : 'bravo'
    if (p !== phase) setPhase(p)
  })
  const pose = (ayes: boolean): Pose => (phase === 'vote' ? (ayes ? 'wave' : 'sit') : phase === 'bravo' ? (ayes ? 'cheer' : 'sit') : 'sit')
  const officers = useMemo(() => {
    const r = rng('assemblee-bureau')
    const one = (p: [number, number, number], ry: number, pose: Pose, dress: string, g?: 'femme' | 'homme') => {
      const gender: 'femme' | 'homme' = g ?? (r() < 0.4 ? 'femme' : 'homme')
      return { p, ry, pose, gender, look: { ...randomLook(gender, r), outfit: dress }, seed: r() * 100 }
    }
    return [
      // The President of the Assembly at the top desk; two secretaries below; the ushers in black at the floor's edges.
      one([0, 2.45, CZ - 7.7], 0, 'sit', 'suit', 'homme'),
      one([-2.4, 1.05, CZ - 5.7], 0, 'write', 'suit'),
      one([2.4, 1.05, CZ - 5.7], 0, 'write', 'kaba', 'femme'),
      one([-6.5, 0, CZ + 1], Math.PI / 2, 'idle', 'suit', 'homme'),
      one([6.5, 0, CZ + 1], -Math.PI / 2, 'idle', 'suit', 'homme'),
    ]
  }, [])
  const speaker = useMemo(() => ({ ...randomLook('femme', rng('assemblee-orateur')), outfit: 'kaba' }), [])
  return (
    <NoShadows>
      {deputies.map((d, i) => (
        <group key={i} position={[d.at[0], d.y, d.at[1]]} rotation={[0, d.ry, 0]}>
          <LowHuman look={d.look} gender={d.gender} pose={sitting ? pose(d.ayes) : 'sit'} seed={d.seed} />
        </group>
      ))}
      {sitting && (
        <>
          {officers.map((o, i) => (
            <group key={i} position={o.p} rotation={[0, o.ry, 0]}>
              <TalkHuman id={`assemblee-bureau-${i}`} look={o.look} gender={o.gender} pose={i === 0 && phase === 'bravo' ? 'clap' : o.pose} seed={o.seed} />
            </group>
          ))}
          <group position={[0, 0, CZ - 2.9]}>
            <TalkHuman id="assemblee-orateur" look={speaker} gender="femme" pose={phase === 'debat' ? 'rant' : phase === 'bravo' ? 'bow' : 'idle'} seed={21} />
          </group>
        </>
      )}
    </NoShadows>
  )
}

/** The public gallery: its benches, the people following the sitting (a few filming); the ushers' desk. */
function Gallery({ sitting }: { sitting: boolean }) {
  const benches = useMemo(() => BENCHES.flatMap((z) => [-1, 1].map((s) => ({ p: [s * 7.1, GAL + 0.22, z] as [number, number, number], s: [11.8, 0.44, 0.5] as [number, number, number] }))), [])
  const people = useMemo(() => {
    const r = rng('assemblee-public')
    if (!sitting) return []
    return [...Array(22)].map(() => {
      const gender: 'femme' | 'homme' = r() < 0.5 ? 'femme' : 'homme'
      let x = (r() < 0.5 ? -1 : 1) * (1.6 + Math.floor(r() * 18) * 0.65)
      const z = BENCHES[Math.floor(r() * 3)]
      // The Sim's place on the front bench stays free.
      if (z === BENCHES[0] && Math.abs(x - 2.2) < 0.6) x += 1.3
      return { p: [x, GAL + 0.05, z] as [number, number, number], gender, look: randomLook(gender, r), seed: r() * 100, pose: (r() < 0.15 ? 'film' : 'sit') as Pose }
    })
  }, [sitting])
  return (
    <group>
      <Blocks at={benches} material={mat('#5a3a22')} />
      <mesh geometry={BOX} position={[DESK[0], GAL + 0.55, DESK[1]]} scale={[0.8, 1.1, 2.2]} material={mat('#7a5232')} />
      <NoShadows>
        <group position={[DESK[0] + 0.9, GAL, DESK[1]]} rotation={[0, -Math.PI / 2, 0]}>
          <TalkHuman id="assemblee-huissier" look={{ ...randomLook('homme', rng('assemblee-huissier')), outfit: 'suit' }} gender="homme" pose="busy" seed={3} />
        </group>
        {people.map((p, i) => (
          <group key={i} position={p.p} rotation={[0, Math.PI, 0]}>
            <LowHuman look={p.look} gender={p.gender} pose={p.pose} seed={p.seed} />
          </group>
        ))}
      </NoShadows>
    </group>
  )
}
