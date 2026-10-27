import { SpotActions } from '../SpotActions'
import { Suspense, useMemo, useRef, useState } from 'react'
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
import { Guest, mat, sign, useBigWalk, type Spot, type XZ, spotWhere, RichAO } from './bigPlace'

// Inside the Palais de la Culture (Treichville): its great hall, the salle
// Anoumabo. The stage at the far end behind its red curtains drawn aside, the
// band (the drums, the guitar, the keyboard), the singer and the dancers out
// front under the lights sweeping from the truss; the pit before the stage
// where people dance; the rows of seats rising to the doors, full on a show
// night; up the steps, the foyer and its paintings (the exhibitions). In the
// day the hall is nearly empty: a rehearsal. Frame: +z the doors, y 0 the pit.

/** Half the hall's width; the stage's front and back; its height. */
const HW = 26
const STAGE_FRONT = -16
const STAGE_BACK = -28
const STAGE_Y = 1.3
/** The first row, how deep and how high each one rises; how many. */
const ROW0 = -11
const ROW_D = 1.1
const RISE = 0.28
const ROWS = 28
const TOP = ROWS * RISE
const FOYER: [number, number] = [ROW0 + ROWS * ROW_D, ROW0 + ROWS * ROW_D + 9]
const ENTRANCE: XZ = [0, FOYER[0] + 6]

const rowZ = (i: number) => ROW0 + i * ROW_D + ROW_D / 2
/** The floor's height: the pit flat, the rows stepping up, the foyer at the top. */
function level(z: number) {
  if (z < ROW0) return 0
  return Math.min(TOP, (Math.floor((z - ROW0) / ROW_D) + 1) * RISE)
}
const ground = (_x: number, z: number) => level(z)

function free(x: number, z: number) {
  if (z > FOYER[0] - 0.1 && z < FOYER[1] - 0.6) return Math.abs(x) < HW - 0.6
  const aisle = Math.abs(x) < 1.3 || (Math.abs(x) > HW - 2.8 && Math.abs(x) < HW - 0.6)
  if (z > ROW0 - 0.1) return aisle && z < FOYER[0]
  return z > STAGE_FRONT + 0.4 && Math.abs(x) < HW - 0.6
}

const SEAT_ROW = 8
const SPOTS: Record<string, Spot> = {
  // A seat in the middle of the rows, by the aisle.
  spectacle: { at: [2.2, rowZ(SEAT_ROW)], rot: Math.PI, pose: 'sit', y: level(rowZ(SEAT_ROW)) + 0.05, from: [0.5, rowZ(SEAT_ROW)] },
  // In the pit before the stage, dancing with everyone.
  'concert-anoumabo': { at: [1.6, -13.2], rot: Math.PI, pose: 'zouglou' },
  // Before a painting in the foyer, a photo of it.
  exposition: { at: [-8.3, FOYER[0] + 4.5], rot: -Math.PI / 2, pose: 'film', y: TOP },
}

export function PalaisCultureInside({ sim, interactionId, roam, night, stage }: { sim: Sim; interactionId?: string; /** Just come in: walk about (tap the floor, or the keys). */ roam?: boolean; night: boolean; stage: string }) {
  const spot = interactionId ? (SPOTS[interactionId] ?? null) : null
  const { way, tap, onMoved } = useBigWalk(spot, interactionId, roam, free, ENTRANCE)
  // A show night: from 19 h, or whenever one came for a show.
  const hour = Math.floor((sim.gameMinutes ?? 0) / 60) % 24
  const show = hour >= 19 || hour < 1 || interactionId === 'spectacle' || interactionId === 'concert-anoumabo'
  return (
    <div className="absolute inset-0">
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [0, 12, 7], fov: 45, near: 0.3, far: 900 }} style={{ background: '#0b0d18' }}>
        <Snapper />
        <ChatFraming />
        <Suspense fallback={null}>
          <hemisphereLight args={['#c8cfff', '#3a2a20', show ? 0.35 : night ? 0.6 : 0.85]} />
          <directionalLight position={[10, 40, 30]} intensity={show ? 0.25 : 0.7} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-32} shadow-camera-right={32} shadow-camera-top={40} shadow-camera-bottom={-40} />
          <pointLight position={[0, 9, STAGE_FRONT - 4]} intensity={show ? 140 : 60} distance={30} color={show ? '#ffd8a8' : '#ffffff'} />
          <Hall
            onFloor={(p) => {
              if (roam && !interactionId) tap(p)
            }}
          />
          <Stage show={show} />
          {show && <Lights />}
          <Audience show={show} />
          <Foyer />
          <Guest sim={sim} stage={stage} way={way} spot={spot} steer={!!roam && !interactionId} onMoved={onMoved} free={free} entrance={ENTRANCE} ground={ground} />
          <SpotActions shown={!!roam && !interactionId} where={spotWhere(SPOTS)} entrance={[ENTRANCE[0], TOP, ENTRANCE[1]]} />
          <OrbitControls makeDefault target={[0, 3, -6]} enablePan={false} minDistance={6} maxDistance={90} minPolarAngle={0.25} maxPolarAngle={1.35} enableDamping />
        </Suspense>
        <RichAO />
      </Canvas>
    </div>
  )
}

/** The hall: the pit, the rows stepping up with their seats, the side walls, the foyer's floor; a tap walks there. */
function Hall({ onFloor }: { onFloor: (p: XZ) => void }) {
  const { steps, seats } = useMemo(() => {
    const steps: { p: [number, number, number]; s: [number, number, number] }[] = []
    const seats: { p: [number, number, number]; s: [number, number, number] }[] = []
    for (let i = 0; i < ROWS; i++) {
      const y = (i + 1) * RISE
      steps.push({ p: [0, y / 2, rowZ(i)], s: [2 * HW, y, ROW_D] })
      // Two blocks of seats each side of the middle aisle, short of the side aisles: the seat and its back.
      for (const s of [-1, 1]) {
        const [a, b] = [1.6, HW - 3.1]
        seats.push({ p: [(s * (a + b)) / 2, y + 0.24, rowZ(i) + 0.05], s: [b - a, 0.12, 0.5] }, { p: [(s * (a + b)) / 2, y + 0.55, rowZ(i) + 0.38], s: [b - a, 0.6, 0.1] })
      }
    }
    // The foyer's floor at the top.
    steps.push({ p: [0, TOP / 2, (FOYER[0] + FOYER[1]) / 2], s: [2 * HW, TOP, FOYER[1] - FOYER[0]] })
    return { steps, seats }
  }, [])
  const walls = useMemo(
    () => [
      { p: [-HW - 0.3, 6, (STAGE_BACK + FOYER[1]) / 2] as [number, number, number], s: [0.6, 12, FOYER[1] - STAGE_BACK] as [number, number, number] },
      { p: [HW + 0.3, 6, (STAGE_BACK + FOYER[1]) / 2] as [number, number, number], s: [0.6, 12, FOYER[1] - STAGE_BACK] as [number, number, number] },
      { p: [0, 7, STAGE_BACK - 0.3] as [number, number, number], s: [2 * HW + 1.2, 14, 0.6] as [number, number, number] },
      // Between the hall and the foyer, a low wall with its doors' gap in the middle.
      { p: [-(HW + 1.6) / 2, TOP + 0.5, FOYER[0]] as [number, number, number], s: [HW - 1.6, 1, 0.3] as [number, number, number] },
      { p: [(HW + 1.6) / 2, TOP + 0.5, FOYER[0]] as [number, number, number], s: [HW - 1.6, 1, 0.3] as [number, number, number] },
    ],
    [],
  )
  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, (STAGE_FRONT + ROW0) / 2]}
        receiveShadow
        onClick={(e) => {
          if (e.delta > 6) return
          e.stopPropagation()
          onFloor([e.point.x, e.point.z])
        }}
      >
        <planeGeometry args={[2 * HW, ROW0 - STAGE_FRONT]} />
        <meshLambertMaterial color="#3a2b24" />
      </mesh>
      {/* The steps and the foyer take taps too: on the aisle where tapped */}
      <group
        onClick={(e) => {
          if (e.delta > 6) return
          e.stopPropagation()
          onFloor([e.point.x, e.point.z])
        }}
      >
        <Blocks at={steps} material={mat('#5a3a2e')} />
      </group>
      <Blocks at={seats} material={mat('#a61e2b')} />
      <Blocks at={walls} material={mat('#e8dccb')} />
    </group>
  )
}

/** A painted backdrop: the show's name, a sun of rays behind it. */
function backdrop(title: string) {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 384
  const g = c.getContext('2d')!
  const grd = g.createLinearGradient(0, 0, 0, 384)
  grd.addColorStop(0, '#2b0f3a')
  grd.addColorStop(1, '#7a1f3d')
  g.fillStyle = grd
  g.fillRect(0, 0, 1024, 384)
  g.strokeStyle = 'rgba(255,209,102,0.35)'
  g.lineWidth = 14
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI
    g.beginPath()
    g.moveTo(512, 400)
    g.lineTo(512 + Math.cos(a) * 700, 400 - Math.sin(a) * 700)
    g.stroke()
  }
  g.fillStyle = '#ffd166'
  g.font = '900 92px sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(title, 512, 190)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return new THREE.MeshBasicMaterial({ map: t })
}

/** The stage: its floor, the proscenium and the curtains drawn aside, the backdrop; the band and the dancers on a show night, a rehearsal in the day. */
function Stage({ show }: { show: boolean }) {
  const back = useMemo(() => backdrop(show ? 'NUIT DU ZOUGLOU' : 'RÉPÉTITION'), [show])
  const frame = useMemo(
    () => [
      { p: [0, STAGE_Y / 2, (STAGE_FRONT + STAGE_BACK) / 2] as [number, number, number], s: [34, STAGE_Y, STAGE_FRONT - STAGE_BACK] as [number, number, number], c: '#6b4a32' },
      { p: [-18.5, 6.5, STAGE_FRONT - 0.4] as [number, number, number], s: [3, 13, 0.8] as [number, number, number], c: '#2b1a12' },
      { p: [18.5, 6.5, STAGE_FRONT - 0.4] as [number, number, number], s: [3, 13, 0.8] as [number, number, number], c: '#2b1a12' },
      { p: [0, 12.2, STAGE_FRONT - 0.4] as [number, number, number], s: [40, 2.4, 0.8] as [number, number, number], c: '#2b1a12' },
      // The curtains drawn aside, in folds.
      ...[-1, 1].flatMap((s) => [0, 1, 2].map((k) => ({ p: [s * (15.2 + k * 0.8), 6.4, STAGE_FRONT - 1.1 - k * 0.15] as [number, number, number], s: [0.9, 11, 0.35] as [number, number, number], c: k % 2 ? '#9b1b26' : '#b5232f' }))),
      // The drum riser, the amps, the keyboard's stand.
      { p: [10, STAGE_Y + 0.25, -24] as [number, number, number], s: [7, 0.5, 4] as [number, number, number], c: '#3a3d44' },
      { p: [-13, STAGE_Y + 0.7, -26.5] as [number, number, number], s: [1.6, 1.4, 1] as [number, number, number], c: '#17171a' },
      { p: [13, STAGE_Y + 0.7, -26.5] as [number, number, number], s: [1.6, 1.4, 1] as [number, number, number], c: '#17171a' },
      { p: [-5, STAGE_Y + 0.85, -23.6] as [number, number, number], s: [1.8, 0.12, 0.6] as [number, number, number], c: '#17171a' },
      { p: [-5, STAGE_Y + 0.4, -23.6] as [number, number, number], s: [0.12, 0.8, 0.12] as [number, number, number], c: '#5c636a' },
    ],
    [],
  )
  return (
    <group>
      <Blocks at={frame} material={mat('#ffffff')} color />
      <mesh position={[0, 7.4, STAGE_BACK + 0.05]} scale={[32, 12, 1]}>
        <planeGeometry />
        <primitive object={back} attach="material" />
      </mesh>
      {/* The djembés on the riser */}
      {[8.4, 10, 11.6].map((x) => (
        <mesh key={x} position={[x, STAGE_Y + 0.5 + 0.45, -23.2]} castShadow>
          <cylinderGeometry args={[0.32, 0.2, 0.9, 12]} />
          <meshLambertMaterial color="#7a4a24" />
        </mesh>
      ))}
      <Band show={show} />
    </group>
  )
}

/** Someone going from one move to the next in turn: the singer, the dancers. */
function Performer({ p, rot = 0, poses, period, offset = 0, dress, gender, seed }: { p: [number, number, number]; rot?: number; poses: Pose[]; period: number; offset?: number; dress: string; gender: 'femme' | 'homme'; seed: string }) {
  const [i, setI] = useState(0)
  const look = useMemo(() => ({ ...randomLook(gender, rng(seed)), outfit: dress }), [gender, seed, dress])
  useFrame(() => {
    const k = Math.floor((worldTime() + offset) / period) % poses.length
    if (k !== i) setI(k)
  })
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <TalkHuman id={`palais-culture:${seed}`} look={look} gender={gender} pose={poses[i]} seed={seed.length} />
    </group>
  )
}

/** On a show night: the singer at the front, four dancers, the drummer, the guitarist and the keyboard. In the day: two dancers working a step, the technicians. */
function Band({ show }: { show: boolean }) {
  const y = STAGE_Y
  if (!show)
    return (
      <>
        <Performer p={[-3, y, -19.5]} poses={['zouglou', 'idle', 'gweta']} period={3.2} dress="survet" gender="femme" seed="repet-a" />
        <Performer p={[3, y, -19.5]} poses={['zouglou', 'idle', 'gweta']} period={3.2} dress="debardeur" gender="homme" seed="repet-b" />
        <Performer p={[9, y, -22]} rot={-0.6} poses={['busy']} period={10} dress="blouson" gender="homme" seed="technicien" />
        <Performer p={[-10, 0, -14.2]} rot={Math.PI} poses={['clap', 'idle', 'talk']} period={4} dress="chemise" gender="femme" seed="choregraphe" />
      </>
    )
  return (
    <>
      <Performer p={[0, y, -18]} poses={['zouglou', 'shout', 'wave', 'dance']} period={2.6} dress="bazin" gender="homme" seed="chanteur" />
      {[-8, -4, 4, 8].map((x, k) => (
        <Performer key={x} p={[x, y, -19.6]} poses={k % 2 ? ['gweta', 'zouglou', 'dance'] : ['zouglou', 'dance', 'gweta']} period={2.2} offset={k * 0.3} dress={k % 2 ? 'pagne' : 'kaba'} gender="femme" seed={`danseuse-${k}`} />
      ))}
      <Performer p={[10, y + 0.5, -24.4]} poses={['busy']} period={10} dress="debardeur" gender="homme" seed="batteur" />
      <Performer p={[-11, y, -22.6]} rot={0.3} poses={['busy', 'dance']} period={3} dress="chemise-pagne" gender="homme" seed="guitariste" />
      <Performer p={[-5, y, -24.4]} poses={['busy']} period={10} dress="chemise" gender="femme" seed="clavier" />
    </>
  )
}

/** The light truss over the stage's front: its spots sweeping the stage in colours. */
function Lights() {
  const beams = useRef<(THREE.Group | null)[]>([])
  const cols = ['#ff4d6d', '#ffd166', '#4dabf7', '#b197fc', '#69db7c', '#ff922b']
  useFrame(() => {
    const t = worldTime()
    beams.current.forEach((g, i) => {
      if (!g) return
      g.rotation.x = -0.5 + Math.sin(t * 0.9 + i) * 0.25
      g.rotation.z = Math.sin(t * 0.7 + i * 1.7) * 0.45
    })
  })
  return (
    <group position={[0, 13, STAGE_FRONT - 2]}>
      <mesh geometry={BOX} scale={[30, 0.3, 0.3]} material={mat('#3a3d44')} />
      {cols.map((c, i) => (
        <group key={c} position={[-12.5 + i * 5, -0.3, 0]} ref={(g) => void (beams.current[i] = g)}>
          <mesh position={[0, -0.3, 0]} geometry={BOX} scale={[0.5, 0.6, 0.5]} material={mat('#17171a')} />
          <mesh position={[0, -6.3, 0]}>
            <coneGeometry args={[2.2, 12, 16, 1, true]} />
            <meshBasicMaterial color={c} transparent opacity={0.16} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** The audience: on a show night, the rows nearly full (on their feet with arms up when the song peaks) and the pit dancing; in the day, a few watching the rehearsal. */
function Audience({ show }: { show: boolean }) {
  const crowd = useMemo(() => {
    const r = rng(show ? 'anoumabo-soir' : 'anoumabo-jour')
    const out: { p: [number, number, number]; gender: 'femme' | 'homme'; look: ReturnType<typeof randomLook>; seed: number; row: number }[] = []
    const want = show ? 150 : 8
    const taken = new Set<string>()
    let tries = 0
    while (out.length < want && tries++ < 4000) {
      const row = Math.floor(r() * (show ? 22 : 10))
      const side = r() < 0.5 ? -1 : 1
      const x = side * (1.9 + Math.floor(r() * 36) * 0.6)
      if (Math.abs(x) > HW - 3.4) continue
      // The Sim's own seat stays free.
      if (row === SEAT_ROW && Math.abs(x - 2.2) < 0.5) continue
      const key = `${row}:${x.toFixed(1)}`
      if (taken.has(key)) continue
      taken.add(key)
      const gender: 'femme' | 'homme' = r() < 0.55 ? 'femme' : 'homme'
      out.push({ p: [x, (row + 1) * RISE + 0.05, rowZ(row)], gender, look: randomLook(gender, r), seed: r() * 100, row })
    }
    return out
  }, [show])
  // The song's peaks: every so often the front rows are on their feet, arms up.
  const [up, setUp] = useState(false)
  useFrame(() => {
    if (!show) return
    const u = worldTime() % 16 < 5
    if (u !== up) setUp(u)
  })
  const pit = useMemo(() => {
    if (!show) return []
    const r = rng('anoumabo-fosse')
    return [...Array(16)].map((_, i) => {
      const gender: 'femme' | 'homme' = r() < 0.5 ? 'femme' : 'homme'
      return { p: [-12 + (i % 8) * 3.3 + r() * 0.8, 0, -14.6 + Math.floor(i / 8) * 2 + r() * 0.5] as [number, number, number], gender, look: randomLook(gender, r), seed: r() * 100, pose: (['dance', 'cheer', 'zouglou', 'gweta'] as Pose[])[i % 4] }
    })
  }, [show])
  // The pit moves on the beat.
  const bounce = useRef<THREE.Group>(null)
  useFrame(() => {
    if (bounce.current) bounce.current.position.y = Math.abs(Math.sin(worldTime() * 4)) * 0.12
  })
  return (
    <NoShadows>
      {crowd.map((c, i) => (
        <group key={i} position={c.p} rotation={[0, Math.PI, 0]}>
          <LowHuman look={c.look} gender={c.gender} pose={up && c.row < 9 ? 'cheer' : 'sit'} seed={c.seed} />
        </group>
      ))}
      <group ref={bounce}>
        {pit.map((c, i) => (
          <group key={i} position={c.p} rotation={[0, Math.PI, 0]}>
            <Human look={c.look} gender={c.gender} pose={c.pose} seed={c.seed} />
          </group>
        ))}
      </group>
    </NoShadows>
  )
}

/** A painting: shapes and colours, a different one each. */
function painting(seed: string) {
  const r = rng(seed)
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 192
  const g = c.getContext('2d')!
  const pal = ['#f77f00', '#009e60', '#ffd166', '#7a1f3d', '#1d3557', '#e63946', '#2a9d8f', '#f4efe6']
  g.fillStyle = pal[Math.floor(r() * pal.length)]
  g.fillRect(0, 0, 256, 192)
  for (let i = 0; i < 9; i++) {
    g.fillStyle = pal[Math.floor(r() * pal.length)]
    g.beginPath()
    if (r() < 0.5) g.arc(r() * 256, r() * 192, 12 + r() * 50, 0, Math.PI * 2)
    else g.rect(r() * 256, r() * 192, 20 + r() * 90, 10 + r() * 60)
    g.fill()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return new THREE.MeshLambertMaterial({ map: t })
}

/** The panels the paintings hang on, across the foyer: x, both faces hung. */
const PANELS = [-18, -10, 10, 18]

/** The foyer up the steps: its parapet over the street side, the panels of paintings, its name hung over; visitors before them. */
function Foyer() {
  const works = useMemo(() => PANELS.flatMap((_, i) => [painting(`foyer-${i}-a`), painting(`foyer-${i}-b`)]), [])
  const name = useMemo(() => sign('ESPACE EXPOSITIONS', '#14213d', '#ffd166', 768, 112), [])
  const z = FOYER[0] + 4.5
  const people = useMemo(() => {
    const r = rng('foyer-visiteurs')
    return PANELS.map((x, i) => {
      const gender: 'femme' | 'homme' = r() < 0.5 ? 'femme' : 'homme'
      const side = i % 2 ? 1 : -1
      return { p: [x + side * 1.8, TOP, z + (r() - 0.5)] as [number, number, number], ry: side > 0 ? -Math.PI / 2 : Math.PI / 2, gender, look: randomLook(gender, r), seed: r() * 100, pose: (r() < 0.4 ? 'film' : 'idle') as Pose }
    })
  }, [z])
  return (
    <group>
      <mesh geometry={BOX} position={[0, TOP + 0.6, FOYER[1] - 0.3]} scale={[2 * HW, 1.2, 0.3]} material={mat('#efe6d6')} />
      {PANELS.map((x, i) => (
        <group key={x} position={[x, TOP, z]}>
          <mesh geometry={BOX} position={[0, 1.7, 0]} scale={[0.25, 3.2, 3.6]} material={mat('#f4efe6')} castShadow />
          {[-1, 1].map((s, k) => (
            <mesh key={s} position={[s * 0.14, 1.9, 0]} rotation={[0, (s * Math.PI) / 2, 0]} scale={[2.8, 2.1, 1]} material={works[i * 2 + k]}>
              <planeGeometry />
            </mesh>
          ))}
        </group>
      ))}
      {[0, Math.PI].map((ry) => (
        <mesh key={ry} position={[-14, TOP + 4, z]} rotation={[0, ry, 0]} scale={[7, 1, 1]}>
          <planeGeometry />
          <primitive object={name} attach="material" />
        </mesh>
      ))}
      <NoShadows>
        {people.map((g, i) => (
          <group key={i} position={g.p} rotation={[0, g.ry, 0]}>
            <TalkHuman id={`palais-culture-foyer-${i}`} look={g.look} gender={g.gender} pose={g.pose} seed={g.seed} />
          </group>
        ))}
      </NoShadows>
    </group>
  )
}
