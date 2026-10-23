import { SpotActions } from '../SpotActions'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Sim } from '../../lib/types'
import { worldTime } from '../../lib/worldClock'
import { NoShadows, type Pose } from '../../avatar/Human'
import { randomLook, workLook } from '../../avatar/options'
import { rng } from '../themes'
import { Snapper } from '../snapshot'
import { ChatFraming } from '../chatFraming'
import { TalkHuman } from '../Talkable'
import { BOX, Blocks } from '../open/ruePrincesse'
import { Airliner } from '../open/airport'
import { Dish } from './ActionProps'
import { Guest, mat, sign, useBigWalk, type Spot, type XZ, spotWhere } from './bigPlace'

// Inside an airport's terminal (the FHB at Port-Bouët, the other cities'
// own): the hall, the Air Lagune check-in desks and their queue, the
// departures board with the day's flights, the seats along the glass wall
// over the planes at their gates and one taking off down the runway; the
// security check and the gates behind it (only with a ticket); the arrivals'
// doors and the families waiting for theirs; the café, the restaurant, the
// shops. The flights are booked from the place's card (Play's Flights).
// The frame: +z the doors from the street, -z the glass wall and the apron.

/** Half the hall's width and depth. */
const W = 20
const D = 12
const ENTRANCE: XZ = [0, D - 1.5]
/** The check-in desks, along the back on the left. */
const DESKS = [-17, -14.6, -12.2, -9.8, -7.4]
const DESK_Z = -7
/** Where the security check's glass runs across, and from which x. */
const CHECK_Z = -6.5
const CHECK_X = 7
const PORTIQUE: XZ = [10.5, CHECK_Z]
/** The arrivals: their doors in the right wall, the barrier along them. */
const ARRIVALS_Z = -3
const BARRIER_X = W - 3
/** The seats along the glass, facing the planes: rows (z) and seats (x). */
const SEAT_ROWS = [-9.6, -8]
const SEATS = [-5.5, -4.95, -4.4, -3.85, -3.3, -2.75, 2.75, 3.3, 3.85, 4.4, 4.95, 5.5]
/** The café's tables (front right), the restaurant's (front left). */
const CAFE: XZ[] = [
  [10, 5.2],
  [12.6, 5.2],
  [15.2, 5.2],
  [11.3, 7.4],
  [13.9, 7.4],
]
const RESTO: XZ[] = [
  [-15.5, 7],
  [-12.5, 7],
  [-15.5, 9.6],
  [-12.5, 9.6],
]
const INFO: XZ = [0, 4.6]
const BOARD: XZ = [0, 0.6]
/** The pillars holding the roof. */
const PILLARS: XZ = [7, 2.5]
const PILLAR_AT: XZ[] = [-1, 1].flatMap((k) => [PILLARS[1], PILLARS[1] + 6].map((z): XZ => [k * PILLARS[0], z]))

function free(x: number, z: number) {
  if (Math.abs(x) > W - 0.6 || Math.abs(z) > D - 0.6) return false
  // The desks and the baggage belt behind them; past the security check; the arrivals' corridor.
  if (x > -18.4 && x < -6.2 && z < DESK_Z + 0.6 && z > -9.4) return false
  if (x > CHECK_X - 0.4 && z < CHECK_Z + 0.5) return false
  if (x > BARRIER_X - 0.35 && z > -6.4 && z < 1.4) return false
  // The rows of seats (the aisle between them free), the board's legs, the information desk.
  if (Math.abs(x) > 2.2 && Math.abs(x) < 6 && z > -10.1 && z < -7.4) return false
  if (Math.abs(z - BOARD[1]) < 0.5 && Math.abs(Math.abs(x) - 3) < 0.5) return false
  if (Math.hypot(x - INFO[0], z - INFO[1]) < 1.6) return false
  for (const [px, pz] of PILLAR_AT) if (Math.abs(x - px) < 0.7 && Math.abs(z - pz) < 0.7) return false
  // The café's counter and tables, the restaurant's buffet and tables, the shops' fronts.
  if (x > 8 && z > 9) return false
  for (const [tx, tz] of CAFE) if (Math.hypot(x - tx, z - tz) < 0.75) return false
  if (x < -18 && z > 5.5) return false
  for (const [tx, tz] of RESTO) if (Math.abs(x - tx) < 1.1 && Math.abs(z - tz) < 0.8) return false
  if (x < -17.4 && z > -1 && z < 5) return false
  return true
}

const SPOTS: Record<string, Spot> = {
  // At the glass, filming the planes going.
  'voir-avions': { at: [-0.9, -D + 0.9], rot: Math.PI, pose: 'film', from: [-0.9, -D + 1.8] },
  // A coffee at the café's table; the restaurant's table, a plate.
  'cafe-aeroport': { at: [CAFE[1][0], CAFE[1][1] + 0.55], rot: Math.PI, pose: 'drink', y: 0.05, from: [CAFE[1][0], CAFE[1][1] + 1.5] },
  'resto-aeroport': { at: [RESTO[1][0], RESTO[1][1] + 0.55], rot: Math.PI, pose: 'eat', y: 0.05, from: [RESTO[1][0], RESTO[1][1] + 1.6] },
  // Up and down in front of the shops' windows.
  'boutique-aeroport': { at: [-16.6, 2], rot: 0, pose: 'walk', loop: { c: [-16.4, 2], r: [0.7, 2.4], speed: 0.12 } },
  // At the barrier, waving to the ones coming out.
  'accueillir-arrivees': { at: [BARRIER_X - 0.7, ARRIVALS_Z + 0.6], rot: Math.PI / 2, pose: 'wave' },
  // At work: behind the last check-in desk (the others are the colleagues').
  work: { at: [DESKS[4], DESK_Z - 0.75], rot: 0, pose: 'busy', from: [-6.2, -8.2] },
  // In a seat by the glass, the planes in front.
  'salle-attente': { at: [SEATS[8], SEAT_ROWS[1]], rot: Math.PI, pose: 'sit', y: 0.05, from: [SEATS[8], SEAT_ROWS[1] + 0.95] },
}

type Flight = { toName: string }

export function AirportInside({ sim, name, flights, interactionId, roam, night, stage }: { sim: Sim; name: string; /** From this airport (world.flights): the board shows them. */ flights: Flight[]; interactionId?: string; /** Just come in: walk about (tap the floor, or the keys). */ roam?: boolean; night: boolean; stage: string }) {
  const spot = interactionId ? (SPOTS[interactionId] ?? null) : null
  const { way, tap, onMoved } = useBigWalk(spot, interactionId, roam, free, ENTRANCE)
  const worn = interactionId === 'cafe-aeroport' ? <Cup /> : interactionId === 'resto-aeroport' ? <Dish kind="poulet" /> : null
  return (
    <div className="absolute inset-0">
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [6, 24, D + 17], fov: 45, near: 0.3, far: 3000 }} style={{ background: night ? '#0b1026' : '#9ccbea' }}>
        <Snapper />
        <ChatFraming />
        <Suspense fallback={null}>
          <hemisphereLight args={[night ? '#7080c0' : '#ffffff', '#b9b2a4', night ? 0.75 : 1.15]} />
          <directionalLight position={[-30, 60, -40]} intensity={night ? 0.15 : 1.3} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-30} shadow-camera-right={30} shadow-camera-top={20} shadow-camera-bottom={-20} />
          {[-12, 0, 12].flatMap((x) => [-5, 5].map((z) => <pointLight key={`${x}${z}`} position={[x, 5.5, z]} intensity={night ? 45 : 12} distance={18} color="#fff1dc" />))}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
            onClick={(e) => {
              if (!roam || interactionId || e.delta > 6) return
              e.stopPropagation()
              tap([e.point.x, e.point.z])
            }}
          >
            <planeGeometry args={[2 * W, 2 * D]} />
            <meshLambertMaterial color="#d8dadc" />
          </mesh>
          <Hall name={name} night={night} />
          <Apron night={night} />
          <CheckIn />
          <Security />
          <Arrivals />
          <Seats />
          <Departures flights={flights} gameMinutes={sim.gameMinutes ?? 0} />
          <Cafe />
          <Restaurant />
          <Shops />
          <People night={night} />
          <Travellers />
          <Guest sim={sim} stage={stage} way={way} spot={spot} steer={!!roam && !interactionId} onMoved={onMoved} free={free} entrance={ENTRANCE} working={interactionId === 'work'} look={interactionId === 'work' ? workLook(sim.look, sim.career ?? '', sim.careerLevel) : undefined}>
            {worn}
          </Guest>
          {/* What's done here, over where it's done (SpotActions): tap one, the Sim goes */}
          <SpotActions shown={!!roam && !interactionId} where={spotWhere(SPOTS)} entrance={[ENTRANCE[0], 0, ENTRANCE[1]]} />
          <OrbitControls makeDefault target={[0, 0, 0]} enablePan={false} minDistance={6} maxDistance={80} minPolarAngle={0.25} maxPolarAngle={1.3} enableDamping />
        </Suspense>
      </Canvas>
    </div>
  )
}

/** The coffee on the table in front of the Sim (in its frame, as ActionProps' dishes). */
function Cup() {
  return (
    <group position={[0.05, 0.77, 0.5]}>
      <mesh position={[0, 0.05, 0]} material={mat('#f8f9fa')}>
        <cylinderGeometry args={[0.04, 0.035, 0.09, 12]} />
      </mesh>
      <mesh position={[0, 0.095, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mat('#5a3a22')}>
        <circleGeometry args={[0.036, 12]} />
      </mesh>
      <mesh position={[0, 0.005, 0]} material={mat('#e9ecef')}>
        <cylinderGeometry args={[0.07, 0.07, 0.01, 16]} />
      </mesh>
    </group>
  )
}

/* ---------- The hall: walls, the glass wall, the airport's name ---------- */

const glass = new THREE.MeshLambertMaterial({ color: '#bfe3f5', transparent: true, opacity: 0.22, depthWrite: false })

function Hall({ name, night }: { name: string; night: boolean }) {
  const label = useMemo(() => sign(name.toUpperCase(), '#14213d', '#ffd166', 1024, 96), [name])
  const signs = useMemo(
    () => ({
      checkin: sign('ENREGISTREMENT · AIR LAGUNE', '#f08a24', '#ffffff', 768, 96),
      arrivals: sign('ARRIVÉES', '#1f9a4a', '#ffffff', 512, 128),
      security: sign('CONTRÔLE DE SÛRETÉ · PORTES 1 – 6', '#1d4ed8', '#ffffff', 768, 96),
      exit: sign('SORTIE · TAXIS', '#2e3540', '#ffd166', 512, 128),
    }),
    [],
  )
  // The glass wall's frames, every 2.5 m, and its beam on top.
  const mullions = useMemo(() => Array.from({ length: 17 }, (_, i) => ({ p: [-W + i * 2.5, 3.5, -D] as [number, number, number], s: [0.16, 7, 0.2] as [number, number, number] })), [])
  return (
    <group>
      <Blocks
        at={[
          // The side walls; the front, low (for the eye), open at the doors.
          { p: [-W, 3.5, 0], s: [0.4, 7, 2 * D] },
          { p: [W, 3.5, 0], s: [0.4, 7, 2 * D] },
          { p: [-(W + 3) / 2, 0.5, D], s: [W - 3, 1, 0.4] },
          { p: [(W + 3) / 2, 0.5, D], s: [W - 3, 1, 0.4] },
          { p: [0, 7.1, -D], s: [2 * W, 0.4, 0.5] },
        ]}
        material={mat(night ? '#9aa3ad' : '#eef0f2')}
      />
      <Blocks at={mullions} material={mat('#5c6773')} />
      <mesh position={[0, 3.5, -D]} material={glass}>
        <planeGeometry args={[2 * W, 7]} />
      </mesh>
      {/* The doors' frame at the front, the airport's name over the glass */}
      {[-3, 3].map((x) => (
        <mesh key={x} geometry={BOX} position={[x, 1.4, D]} scale={[0.25, 2.8, 0.4]} material={mat('#5c6773')} />
      ))}
      <mesh position={[0, 6.2, -D + 0.3]} material={label}>
        <planeGeometry args={[22, 2.06]} />
      </mesh>
      {/* Over each part of the hall, its sign */}
      <mesh position={[-12.2, 3.6, -5.4]} material={signs.checkin}>
        <planeGeometry args={[9, 1.12]} />
      </mesh>
      <mesh position={[13.5, 3.4, CHECK_Z + 0.25]} material={signs.security}>
        <planeGeometry args={[11, 1.43]} />
      </mesh>
      <mesh position={[W - 0.25, 3.3, ARRIVALS_Z]} rotation={[0, -Math.PI / 2, 0]} material={signs.arrivals}>
        <planeGeometry args={[3.6, 0.9]} />
      </mesh>
      <mesh position={[0, 3.1, D - 0.25]} rotation={[0, Math.PI, 0]} material={signs.exit}>
        <planeGeometry args={[3.6, 0.9]} />
      </mesh>
      {/* The pillars holding the roof */}
      <Blocks at={PILLAR_AT.map(([x, z]) => ({ p: [x, 3.5, z] as [number, number, number], s: [0.6, 7, 0.6] as [number, number, number] }))} material={mat('#c3c8cf')} />
      <Kerb night={night} />
    </group>
  )
}

/** Outside the doors: the pavement, the drop-off lane, the orange taxis waiting in line. */
function Kerb({ night }: { night: boolean }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, D + 4]} receiveShadow>
        <planeGeometry args={[120, 8]} />
        <meshLambertMaterial color={night ? '#6e6a62' : '#cfc6b5'} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, D + 30]} receiveShadow>
        <planeGeometry args={[400, 44]} />
        <meshLambertMaterial color={night ? '#26282c' : '#55585e'} />
      </mesh>
      {[-14, -8, -2, 4, 10].map((x, i) => (
        <group key={x} position={[x, 0, D + 10.5]}>
          <mesh geometry={BOX} position={[0, 0.6, 0]} scale={[4.2, 0.8, 1.8]} material={mat(i === 2 ? '#f4f5f7' : '#ff7a00')} castShadow />
          <mesh geometry={BOX} position={[-0.2, 1.25, 0]} scale={[2.2, 0.55, 1.6]} material={mat('#2a3446')} />
        </group>
      ))}
    </group>
  )
}

/* ---------- Outside the glass: the planes at their gates, one taking off ---------- */

function Apron({ night }: { night: boolean }) {
  const takeoff = useRef<THREE.Group>(null)
  const taxi = useRef<THREE.Group>(null)
  useFrame(() => {
    const t = worldTime()
    // Down the runway, faster and faster, and up (every 50 s).
    const p = (t % 50) / 50
    const g = takeoff.current
    if (g) {
      const x = -520 + 1150 * p * p
      const y = Math.max(0, x - 120) * 0.14
      g.position.set(x, y, -175)
      g.rotation.set(0, Math.PI / 2, 0)
      g.rotation.x = 0
      g.rotation.z = 0
      // Nose up once off the ground.
      g.rotateX(-Math.min(0.2, y * 0.01))
    }
    // Another taxiing slowly towards the runway, back and forth.
    const h = taxi.current
    if (h) {
      const k = (t % 70) / 70
      const x = -180 + 360 * (k < 0.5 ? k * 2 : 2 - k * 2)
      h.position.set(x, 0, -88)
      h.rotation.set(0, k < 0.5 ? Math.PI / 2 : -Math.PI / 2, 0)
    }
  })
  const lines = useMemo(() => [-60, -20, 20, 60].map((x) => ({ p: [x, 0.03, -45] as [number, number, number], s: [0.3, 0.02, 60] as [number, number, number] })), [])
  const dashes = useMemo(() => Array.from({ length: 30 }, (_, i) => ({ p: [-700 + i * 50, 0.04, -175] as [number, number, number], s: [22, 0.02, 0.8] as [number, number, number] })), [])
  return (
    <group>
      {/* The ground all round the terminal; the apron, the grass, the runway and its dashes */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]} receiveShadow>
        <planeGeometry args={[600, 300]} />
        <meshLambertMaterial color={night ? '#4a4740' : '#bdb8ad'} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, -60]} receiveShadow>
        <planeGeometry args={[400, 96]} />
        <meshLambertMaterial color={night ? '#3a3e44' : '#8d9196'} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, -400]}>
        <planeGeometry args={[3000, 700]} />
        <meshLambertMaterial color={night ? '#1d2a1a' : '#8aa35a'} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -175]}>
        <planeGeometry args={[1600, 45]} />
        <meshLambertMaterial color={night ? '#26282c' : '#4a4d52'} />
      </mesh>
      <Blocks at={lines} material={mat('#f2c230')} />
      <Blocks at={dashes} material={mat('#f4f5f7', night ? '#666666' : undefined)} />
      {/* At the gate: the plane, its nose to the glass, the jet bridge to its door */}
      <group position={[-6, 0, -44]}>
        <Airliner />
      </group>
      <mesh geometry={BOX} position={[-8, 4.3, -19.8]} scale={[2.6, 2.8, 15.6]} material={mat('#d5d9de')} castShadow />
      <mesh geometry={BOX} position={[-8, 1.5, -24]} scale={[0.5, 3, 0.5]} material={mat('#5c6773')} />
      <group position={[34, 0, -52]} rotation={[0, -0.25, 0]}>
        <Airliner />
      </group>
      {/* The baggage carts and the fuel truck by the plane */}
      <Blocks
        at={[
          { p: [3, 0.6, -36], s: [2, 1.2, 1.4] },
          { p: [5.4, 0.6, -36], s: [2, 1.2, 1.4] },
          { p: [7.8, 0.6, -36], s: [2, 1.2, 1.4] },
        ]}
        material={mat('#3d64a8')}
      />
      <mesh geometry={BOX} position={[-19, 1.4, -38]} scale={[2.6, 2.8, 8]} material={mat('#f4f5f7')} castShadow />
      <group ref={taxi}>
        <Airliner />
      </group>
      <group ref={takeoff}>
        <Airliner />
      </group>
      {/* The control tower, far off on the right */}
      <mesh position={[160, 18, -140]} material={mat('#e9ecef')}>
        <cylinderGeometry args={[2.5, 3.5, 36, 12]} />
      </mesh>
      <mesh position={[160, 38, -140]} material={mat('#2e3540', night ? '#16324d' : undefined)}>
        <cylinderGeometry args={[6, 5, 5, 12]} />
      </mesh>
      {night && [-30, 0, 30].map((x) => <pointLight key={x} position={[x, 14, -40]} intensity={120} distance={60} color="#ffd9a0" />)}
    </group>
  )
}

/* ---------- The check-in, its queue ---------- */

function CheckIn() {
  const screen = useMemo(() => sign('AIR LAGUNE', '#f08a24', '#ffffff', 256, 96), [])
  return (
    <group>
      {DESKS.map((x) => (
        <group key={x} position={[x, 0, DESK_Z]}>
          <mesh geometry={BOX} position={[0, 0.55, 0]} scale={[1.7, 1.1, 0.7]} material={mat('#e9ecef')} castShadow />
          <mesh geometry={BOX} position={[0, 1.12, 0]} scale={[1.75, 0.06, 0.75]} material={mat('#f08a24')} />
          <mesh position={[0, 1.75, -0.2]} material={screen}>
            <planeGeometry args={[0.9, 0.34]} />
          </mesh>
          {/* The scale for the bags, beside the desk */}
          <mesh geometry={BOX} position={[0.95, 0.15, 0.1]} scale={[0.5, 0.3, 0.7]} material={mat('#5c6773')} />
        </group>
      ))}
      {/* The belt taking the bags away behind */}
      <mesh geometry={BOX} position={[-12.2, 0.35, DESK_Z - 1.6]} scale={[12, 0.7, 0.9]} material={mat('#2e3540')} />
      {[-16, -13, -10.4].map((x, i) => (
        <mesh key={x} geometry={BOX} position={[x, 0.95, DESK_Z - 1.6]} scale={[0.7, 0.5, 0.45]} material={mat(['#1d4ed8', '#c92a2a', '#2b2f45'][i])} />
      ))}
      {/* The queue's posts and belts */}
      {[-18, -15.5, -13, -10.5, -8].map((x) => (
        <mesh key={x} geometry={BOX} position={[x, 0.5, -2.6]} scale={[0.08, 1, 0.08]} material={mat('#adb5bd')} />
      ))}
      <mesh geometry={BOX} position={[-13, 0.92, -2.6]} scale={[10, 0.06, 0.02]} material={mat('#1d4ed8')} />
    </group>
  )
}

/* ---------- The security check, the gates behind it ---------- */

function Security() {
  const gate = useMemo(() => sign('PORTE 2', '#14213d', '#ffd166', 256, 96), [])
  return (
    <group>
      {/* The glass across, the arch to walk through, the X-ray's belt */}
      <mesh position={[(CHECK_X + W) / 2, 1.3, CHECK_Z]} material={glass}>
        <planeGeometry args={[W - CHECK_X, 2.6]} />
      </mesh>
      <Blocks
        at={[
          { p: [PORTIQUE[0] - 0.55, 1.1, PORTIQUE[1]], s: [0.15, 2.2, 0.5] },
          { p: [PORTIQUE[0] + 0.55, 1.1, PORTIQUE[1]], s: [0.15, 2.2, 0.5] },
          { p: [PORTIQUE[0], 2.25, PORTIQUE[1]], s: [1.25, 0.15, 0.5] },
        ]}
        material={mat('#9aa3ad')}
      />
      <mesh geometry={BOX} position={[13.2, 0.5, CHECK_Z]} scale={[2.6, 1, 0.9]} material={mat('#5c6773')} />
      <mesh geometry={BOX} position={[13.2, 1.3, CHECK_Z]} scale={[1.1, 0.8, 1]} material={mat('#c3c8cf')} />
      {/* Past it, the gate's seats */}
      {[-9.2, -10.6].map((z) => (
        <mesh key={z} geometry={BOX} position={[13.5, 0.23, z]} scale={[9, 0.46, 0.5]} material={mat('#3d64a8')} />
      ))}
      <mesh position={[18.5, 2.4, -11.6]} material={gate}>
        <planeGeometry args={[1.6, 0.6]} />
      </mesh>
    </group>
  )
}

/* ---------- The arrivals: their doors, the barrier ---------- */

function Arrivals() {
  return (
    <group>
      {/* The two frosted doors in the wall */}
      {[-0.75, 0.75].map((dz) => (
        <mesh key={dz} geometry={BOX} position={[W - 0.25, 1.3, ARRIVALS_Z + dz]} scale={[0.1, 2.6, 1.4]} material={mat('#dfe9ef')} />
      ))}
      {/* The barrier along the corridor the passengers come out by */}
      <mesh geometry={BOX} position={[BARRIER_X, 1, -2.5]} scale={[0.06, 0.06, 7.6]} material={mat('#adb5bd')} />
      {[-6.2, -4, -1.8, 0.4, 1.2].map((z) => (
        <mesh key={z} geometry={BOX} position={[BARRIER_X, 0.5, z]} scale={[0.08, 1, 0.08]} material={mat('#adb5bd')} />
      ))}
    </group>
  )
}

/* ---------- The seats along the glass ---------- */

function Seats() {
  const at = useMemo(
    () =>
      SEAT_ROWS.flatMap((z) =>
        SEATS.flatMap((x) => [
          { p: [x, 0.42, z] as [number, number, number], s: [0.5, 0.08, 0.5] as [number, number, number] },
          // The back (they face the glass, -z).
          { p: [x, 0.72, z + 0.25] as [number, number, number], s: [0.5, 0.55, 0.06] as [number, number, number] },
        ]),
      ),
    [],
  )
  const legs = useMemo(() => SEAT_ROWS.flatMap((z) => [-1, 1].map((k) => ({ p: [k * 4.125, 0.2, z] as [number, number, number], s: [3.4, 0.06, 0.06] as [number, number, number] }))), [])
  return (
    <group>
      <Blocks at={at} material={mat('#1d4ed8')} />
      <Blocks at={legs} material={mat('#5c6773')} />
    </group>
  )
}

/* ---------- The departures board ---------- */

const BOARD_W = 1024
const BOARD_H = 512

/**
 * The flights from here (world.flights), each at its time: the next
 * departures from the game's hour on, one every 35 minutes or so; boarding
 * when it's close (blinking), now and then one delayed.
 */
function Departures({ flights, gameMinutes }: { flights: Flight[]; gameMinutes: number }) {
  const board = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = BOARD_W
    canvas.height = BOARD_H
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return { g: canvas.getContext('2d')!, texture, material: new THREE.MeshBasicMaterial({ map: texture }), last: -1 }
  }, [])
  useEffect(() => () => (board.texture.dispose(), board.material.dispose()), [board])
  const minutes = useRef(gameMinutes)
  minutes.current = gameMinutes
  useFrame(() => {
    const t = worldTime()
    if (t - board.last < 0.5 && t >= board.last) return
    board.last = t
    drawBoard(board.g, flights, minutes.current, Math.floor(t * 2) % 2 === 0)
    board.texture.needsUpdate = true
  })
  return (
    <group position={[BOARD[0], 0, BOARD[1]]}>
      {[-3, 3].map((x) => (
        <mesh key={x} geometry={BOX} position={[x, 1.6, 0]} scale={[0.14, 3.2, 0.14]} material={mat('#2e3540')} />
      ))}
      <mesh geometry={BOX} position={[0, 4.1, -0.05]} scale={[6.6, 3.4, 0.12]} material={mat('#2e3540')} />
      <mesh position={[0, 4.1, 0.02]} material={board.material}>
        <planeGeometry args={[6.4, 3.2]} />
      </mesh>
    </group>
  )
}

const pad = (n: number) => String(n).padStart(2, '0')

function drawBoard(g: CanvasRenderingContext2D, flights: Flight[], gameMinutes: number, blink: boolean) {
  g.fillStyle = '#0b1530'
  g.fillRect(0, 0, BOARD_W, BOARD_H)
  g.fillStyle = '#f08a24'
  g.fillRect(0, 0, BOARD_W, 70)
  g.fillStyle = '#ffffff'
  g.font = '800 40px sans-serif'
  g.textBaseline = 'middle'
  g.textAlign = 'left'
  g.fillText('DÉPARTS', 28, 36)
  g.textAlign = 'right'
  const now = Math.floor(gameMinutes) % (24 * 60)
  g.fillText(`${pad(Math.floor(now / 60))}:${pad(now % 60)}`, BOARD_W - 28, 36)
  g.textAlign = 'left'
  g.font = '700 22px sans-serif'
  g.fillStyle = '#9fb3d1'
  ;['HEURE', 'DESTINATION', 'VOL', 'PORTE', 'STATUT'].forEach((h, i) => g.fillText(h, [28, 160, 560, 700, 810][i], 96))
  if (!flights.length) {
    g.fillStyle = '#ffd166'
    g.font = '800 36px sans-serif'
    g.fillText('AUCUN VOL AUJOURD’HUI', 160, 200)
    return
  }
  // One leaves every 35 minutes, in turn through the destinations.
  const slot = Math.floor(gameMinutes / 35)
  for (let i = 0; i < 6; i++) {
    const n = slot + 1 + i
    const f = flights[n % flights.length]
    const at = n * 35
    const left = at - gameMinutes
    const y = 145 + i * 60
    const delayed = !((n * 7919) % 9)
    const status = left < 30 ? 'EMBARQUEMENT' : delayed ? 'RETARDÉ' : 'À L’HEURE'
    g.fillStyle = i % 2 ? '#0e1a3a' : '#0b1530'
    g.fillRect(0, y - 28, BOARD_W, 56)
    g.font = '800 30px sans-serif'
    g.fillStyle = '#ffd166'
    const m = at % (24 * 60)
    g.fillText(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`, 28, y)
    g.fillText(f.toName.toUpperCase(), 160, y, 380)
    g.fillText(`AL ${300 + ((n * 37) % 600)}`, 560, y)
    g.fillText(String(1 + (n % 6)), 720, y)
    if (status !== 'EMBARQUEMENT' || blink) {
      g.fillStyle = status === 'EMBARQUEMENT' ? '#51cf66' : status === 'RETARDÉ' ? '#ff6b6b' : '#ffffff'
      g.fillText(status, 810, y, 200)
    }
  }
}

/* ---------- The café, the restaurant, the shops ---------- */

function Tables({ at, chairs, color }: { at: XZ[]; chairs: XZ[]; color: string }) {
  const tops = useMemo(() => at.map(([x, z]) => ({ p: [x, 0.74, z] as [number, number, number], s: [1, 0.05, 0.75] as [number, number, number] })), [at])
  const feet = useMemo(() => at.map(([x, z]) => ({ p: [x, 0.37, z] as [number, number, number], s: [0.08, 0.74, 0.08] as [number, number, number] })), [at])
  const seats = useMemo(() => at.flatMap(([x, z]) => chairs.map(([dx, dz]) => ({ p: [x + dx, 0.22, z + dz] as [number, number, number], s: [0.45, 0.44, 0.45] as [number, number, number] }))), [at, chairs])
  return (
    <group>
      <Blocks at={tops} material={mat('#f8f9fa')} />
      <Blocks at={feet} material={mat('#5c6773')} />
      <Blocks at={seats} material={mat(color)} />
    </group>
  )
}

function Cafe() {
  const label = useMemo(() => sign('CAFÉ DU TARMAC', '#3a2416', '#ffd9a0', 512, 112), [])
  return (
    <group>
      <mesh geometry={BOX} position={[14, 0.55, 9.8]} scale={[11, 1.1, 0.9]} material={mat('#3a2416')} castShadow />
      <mesh geometry={BOX} position={[14, 1.12, 9.8]} scale={[11.1, 0.06, 1]} material={mat('#d9c7a8')} />
      <mesh geometry={BOX} position={[11.5, 1.45, 10.4]} scale={[0.8, 0.6, 0.5]} material={mat('#adb5bd')} />
      <mesh geometry={BOX} position={[16, 1.4, 10.3]} scale={[1.6, 0.5, 0.5]} material={mat('#f8f0dc', '#6b5a3a')} />
      <mesh position={[14, 3, 11.2]} rotation={[0, Math.PI, 0]} material={label}>
        <planeGeometry args={[5, 1.1]} />
      </mesh>
      <Tables
        at={CAFE}
        chairs={[
          [0, 0.55],
          [0, -0.55],
        ]}
        color="#f08a24"
      />
    </group>
  )
}

function Restaurant() {
  const label = useMemo(() => sign('LE BAOBAB · RESTAURANT', '#1f5a3a', '#ffffff', 768, 112), [])
  return (
    <group>
      {/* The buffet along the wall, its dishes under the lamps */}
      <mesh geometry={BOX} position={[-19, 0.5, 8.4]} scale={[1, 1, 5.6]} material={mat('#6b4f34')} castShadow />
      {[6.4, 7.7, 9, 10.3].map((z, i) => (
        <mesh key={z} geometry={BOX} position={[-19, 1.05, z]} scale={[0.6, 0.1, 0.9]} material={mat(['#e8590c', '#f2e6c9', '#2f9e44', '#b5532a'][i])} />
      ))}
      <mesh position={[-W + 0.25, 3, 8.4]} rotation={[0, Math.PI / 2, 0]} material={label}>
        <planeGeometry args={[6, 0.88]} />
      </mesh>
      <Tables
        at={RESTO}
        chairs={[
          [-0.3, 0.55],
          [0.3, 0.55],
          [-0.3, -0.55],
          [0.3, -0.55],
        ]}
        color="#1f5a3a"
      />
    </group>
  )
}

function Shops() {
  const signs = useMemo(() => [sign('PRESSE · SOUVENIRS', '#14213d', '#ffffff', 512, 112), sign('PAGNES & ARTISANAT', '#b5532a', '#ffffff', 512, 112)], [])
  return (
    <group>
      {[0.8, 3.4].map((z, i) => (
        <group key={z} position={[-W + 1.3, 0, z]}>
          {/* The shelves, the goods on them in their colours */}
          <mesh geometry={BOX} position={[-0.6, 1, 0]} scale={[0.5, 2, 2.2]} material={mat('#e9ecef')} />
          {[0.5, 1, 1.5].map((y) => (
            <mesh key={y} geometry={BOX} position={[-0.3, y, 0]} scale={[0.2, 0.2, 2]} material={mat(i ? ['#e8590c', '#2f9e44', '#f2c230'][Math.round(y * 2) % 3] : ['#1d4ed8', '#c92a2a', '#f8f9fa'][Math.round(y * 2) % 3])} />
          ))}
          <mesh position={[-1.05, 2.6, 0]} rotation={[0, Math.PI / 2, 0]} material={signs[i]}>
            <planeGeometry args={[2.3, 0.5]} />
          </mesh>
        </group>
      ))}
      {/* The partition between the two */}
      <mesh geometry={BOX} position={[-W + 1.1, 1.3, 2.1]} scale={[1.8, 2.6, 0.12]} material={mat('#c3c8cf')} />
    </group>
  )
}

/* ---------- The people ---------- */

type Still = { p: [number, number, number]; ry: number; pose: Pose; gender: 'femme' | 'homme'; look: ReturnType<typeof randomLook>; seed: number; bag?: string; placard?: boolean }

function People({ night }: { night: boolean }) {
  const still = useMemo<Still[]>(() => {
    const r = rng('aeroport-hall')
    const one = (p: [number, number, number], ry: number, pose: Pose, dress?: [string, string], extra?: Partial<Still>): Still => {
      const gender: 'femme' | 'homme' = r() < 0.5 ? 'femme' : 'homme'
      const look = randomLook(gender, r)
      return { p, ry, pose, gender, look: dress ? { ...look, outfit: dress[0], outfitColor: dress[1] } : look, seed: r() * 100, ...extra }
    }
    const crew: [string, string] = ['suit', '#14213d']
    const bags = ['#1d4ed8', '#c92a2a', '#2b2f45', '#f08a24', '#5c6773']
    const out: Still[] = [
      // Behind the desks, in the airline's navy; the queue in front, each with a bag.
      ...DESKS.slice(0, night ? 2 : 4).map((x) => one([x, 0, DESK_Z - 0.75], 0, 'busy', crew)),
      ...(night ? [] : [-16.6, -15.2, -13.8, -12.3, -10.9, -9.4]).map((x, i) => one([x, 0, -1.8 + (i % 2) * 0.3], Math.PI, i % 3 ? 'idle' : 'phone', undefined, { bag: bags[i % bags.length] })),
      one([DESKS[1] + 0.2, 0, DESK_Z + 0.85], Math.PI, 'talk', undefined, { bag: '#2b2f45' }),
      // In the seats by the glass, looking at the planes or at their phone.
      ...[0, 3, 5, 9, 11].map((i, k) => one([SEATS[i], 0.05, SEAT_ROWS[0]], Math.PI, k % 2 ? 'call' : 'sit')),
      ...[1, 6, 10].map((i, k) => one([SEATS[i], 0.05, SEAT_ROWS[1]], Math.PI, k % 2 ? 'sit' : 'call')),
      // A child at the glass, filming the planes with the father's phone.
      one([1.6, 0, -D + 0.9], Math.PI, 'film'),
      one([2.6, 0, -D + 1.2], Math.PI, 'cheer'),
      // The police at the arch; the ones waiting to go through.
      one([PORTIQUE[0] + 1.1, 0, CHECK_Z + 0.7], -Math.PI / 2, 'idle', ['policier', '#8ec5ee']),
      one([PORTIQUE[0], 0, CHECK_Z + 1.3], Math.PI, 'idle', undefined, { bag: '#5c6773' }),
      one([PORTIQUE[0], 0, CHECK_Z + 2.4], Math.PI, 'phone'),
      // Past the check, at the gate.
      ...[9.5, 11.5, 14, 16.5].map((x, i) => one([x, 0.05, -9.2 + 0.3], Math.PI, i % 2 ? 'call' : 'sit')),
      // The families at the barrier, waiting for theirs; one holding up a name.
      one([BARRIER_X - 0.7, 0, -5.2], Math.PI / 2, 'idle'),
      one([BARRIER_X - 0.7, 0, -4.2], Math.PI / 2, 'cheer', undefined, { placard: true }),
      one([BARRIER_X - 1.4, 0, -3.6], Math.PI / 2, 'phone'),
      one([BARRIER_X - 0.7, 0, -1.4], Math.PI / 2, 'wave'),
      one([BARRIER_X - 1.3, 0, -0.6], Math.PI / 2, 'idle'),
      // The information desk; the café's and the restaurant's.
      one([INFO[0], 0, INFO[1] - 0.6], 0, 'idle', crew),
      one([14, 0, 10.6], Math.PI, 'busy', ['chemise', '#f8f9fa']),
      one([CAFE[3][0], 0.05, CAFE[3][1] - 0.55], 0, 'drink'),
      one([CAFE[4][0], 0.05, CAFE[4][1] + 0.55], Math.PI, 'drink'),
      one([RESTO[0][0] - 0.3, 0.05, RESTO[0][1] + 0.55], Math.PI, 'eat'),
      one([RESTO[0][0] + 0.3, 0.05, RESTO[0][1] - 0.55], 0, 'eat'),
      one([RESTO[3][0] - 0.3, 0.05, RESTO[3][1] - 0.55], 0, 'eat'),
      one([-18.1, 0, 7.6], Math.PI / 2, 'busy', ['cuisinier', '#f8f9fa']),
      // A porter by the doors, waiting for someone with bags.
      one([4.4, 0, D - 1.6], -0.6, 'idle', ['bleu', '#1d4ed8']),
    ]
    return out
  }, [night])
  return (
    <NoShadows>
      {still.map((g, i) => (
        <group key={i} position={g.p} rotation={[0, g.ry, 0]}>
          <TalkHuman id={`aeroport-${i}`} look={g.look} gender={g.gender} pose={g.pose} seed={g.seed} />
          {g.bag && <Suitcase color={g.bag} />}
          {g.placard && <mesh position={[0, 1.95, 0.35]} geometry={BOX} scale={[0.7, 0.4, 0.02]} material={mat('#ffffff')} />}
        </group>
      ))}
    </NoShadows>
  )
}

/** A wheeled suitcase at someone's side, its handle up. */
function Suitcase({ color }: { color: string }) {
  return (
    <group position={[0.42, 0, 0.05]}>
      <mesh geometry={BOX} position={[0, 0.36, 0]} scale={[0.4, 0.62, 0.24]} material={mat(color)} />
      <mesh geometry={BOX} position={[0, 0.85, 0]} scale={[0.04, 0.4, 0.04]} material={mat('#2e3540')} />
    </group>
  )
}

/** A point along a way of points, at a distance along it, and the way it goes there. */
function along(way: XZ[], d: number): { x: number; z: number; ry: number } {
  for (let i = 1; i < way.length; i++) {
    const [ax, az] = way[i - 1]
    const [bx, bz] = way[i]
    const len = Math.hypot(bx - ax, bz - az)
    if (d <= len || i === way.length - 1) {
      const k = Math.min(1, d / len)
      return { x: ax + (bx - ax) * k, z: az + (bz - az) * k, ry: Math.atan2(bx - ax, bz - az) }
    }
    d -= len
  }
  return { x: way[0][0], z: way[0][1], ry: 0 }
}
const lengthOf = (way: XZ[]) => way.slice(1).reduce((t, [x, z], i) => t + Math.hypot(x - way[i][0], z - way[i][1]), 0)

/** The ones arriving out of the doors with their trolleys; the ones coming in from the street to the desks or the check. */
const WAYS: { way: XZ[]; n: number; speed: number; trolley?: boolean }[] = [
  {
    way: [
      [W - 0.6, ARRIVALS_Z],
      [W - 1.6, ARRIVALS_Z],
      [W - 1.6, 2],
      [8, 7.8],
      [2.2, D - 0.5],
    ],
    n: 3,
    speed: 1,
    trolley: true,
  },
  {
    way: [
      [-1.6, D - 0.5],
      [-4, 3],
      [-8.2, -0.8],
      [-10.4, -0.8],
    ],
    n: 2,
    speed: 1.1,
    trolley: true,
  },
  {
    way: [
      [1.2, D - 0.5],
      [6.5, 1.5],
      [PORTIQUE[0], CHECK_Z + 3.4],
    ],
    n: 2,
    speed: 1.2,
  },
]

function Travellers() {
  const people = useMemo(() => {
    const r = rng('aeroport-passants')
    return WAYS.flatMap((w, wi) =>
      [...Array(w.n)].map((_, i) => {
        const gender: 'femme' | 'homme' = r() < 0.5 ? 'femme' : 'homme'
        return { wi, i, gender, look: randomLook(gender, r), seed: r() * 100 }
      }),
    )
  }, [])
  const refs = useRef<(THREE.Group | null)[]>([])
  useFrame(() => {
    const t = worldTime()
    people.forEach((p, k) => {
      const g = refs.current[k]
      if (!g) return
      const w = WAYS[p.wi]
      const len = lengthOf(w.way)
      // Along the way and gone at its end; the next one comes behind, spaced out.
      const d = (t * w.speed + (p.i * (len + 6)) / w.n) % (len + 6)
      const shown = d <= len
      g.visible = shown
      if (!shown) return
      const at = along(w.way, d)
      g.position.set(at.x, 0, at.z)
      g.rotation.y = at.ry
    })
  })
  return (
    <NoShadows>
      {people.map((p, k) => (
        <group key={k} ref={(g) => void (refs.current[k] = g)}>
          <TalkHuman id={`aeroport-w${k}`} look={p.look} gender={p.gender} pose="walk" speed={WAYS[p.wi].speed} seed={p.seed} />
          {WAYS[p.wi].trolley && (
            // The trolley pushed in front, the bags piled on it.
            <group position={[0, 0, 0.75]}>
              <mesh geometry={BOX} position={[0, 0.35, 0]} scale={[0.55, 0.05, 0.9]} material={mat('#9aa3ad')} />
              <mesh geometry={BOX} position={[0, 0.62, 0.05]} scale={[0.45, 0.5, 0.7]} material={mat(['#1d4ed8', '#c92a2a', '#2b2f45'][k % 3])} />
              <mesh geometry={BOX} position={[0, 0.85, -0.45]} scale={[0.5, 0.05, 0.05]} material={mat('#5c6773')} />
            </group>
          )}
        </group>
      ))}
    </NoShadows>
  )
}
