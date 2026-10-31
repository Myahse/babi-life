import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Human, type Pose } from '../avatar/Human'
import { randomLook } from '../avatar/options'
import { rng } from './themes'
import type { Look, Sim } from '../lib/types'

// Inside an Air Lagune airliner, in flight (FlightView's « Cabine »): the aisle between the rows of three
// seats, the covers in the airline's orange and green, the bins overhead, the lit ceiling, the windows with
// the sky and the clouds going by. The passengers sit, on their phones, eating, asleep against the window;
// the hostess pushes her trolley down the aisle and back; the player's Sim has the window seat up front.
// The cabin sways a little, as a plane does. Units are metres: the floor at y = 0, the nose toward +z.

const ROWS = 18
const PITCH = 0.84
const FRONT = 6.4 // the first row's z
const SEAT_X = [-1.45, -0.95, -0.45, 0.45, 0.95, 1.45]
const SEAT_Y = 0.46
/** The player's seat: the left window, third row. */
const MINE = { row: 2, col: 0 }

const carpet = new THREE.MeshLambertMaterial({ color: '#1f3a6b' })
const wall = new THREE.MeshLambertMaterial({ color: '#eceae4', emissive: '#3a3934', side: THREE.BackSide })
const bin = new THREE.MeshLambertMaterial({ color: '#f4f2ec', emissive: '#5a5850' })
const binEdge = new THREE.MeshLambertMaterial({ color: '#c9c6bd' })
const seatMat = new THREE.MeshLambertMaterial({ color: '#41618c' })
const ceilingLight = new THREE.MeshBasicMaterial({ color: '#fff4dc' })
const screen = new THREE.MeshBasicMaterial({ color: '#0e1a2a' })
const trolleyMat = new THREE.MeshLambertMaterial({ color: '#c8ccd2' })

/** The sky out of the windows: blue, a band of cloud tops below, streaming back (its offset moves). */
function skyTexture(night: boolean) {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 128
  const g = c.getContext('2d')!
  const sky = g.createLinearGradient(0, 0, 0, 128)
  sky.addColorStop(0, night ? '#0a1430' : '#4f93db')
  sky.addColorStop(0.6, night ? '#1b2850' : '#a9d0f2')
  sky.addColorStop(1, night ? '#2a3456' : '#e8f2fb')
  g.fillStyle = sky
  g.fillRect(0, 0, 256, 128)
  const r = rng('hublot')
  g.fillStyle = night ? '#5b6385' : '#ffffff'
  for (let i = 0; i < 40; i++) {
    const x = r() * 256
    const y = 78 + r() * 50
    g.beginPath()
    g.ellipse(x, y, 14 + r() * 30, 6 + r() * 10, 0, 0, Math.PI * 2)
    g.fill()
  }
  if (night)
    for (let i = 0; i < 30; i++) {
      g.fillStyle = '#ffffff'
      g.fillRect(r() * 256, r() * 60, 1, 1)
    }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = THREE.RepeatWrapping
  return t
}

/** Many of the same small thing, placed once (the seats' parts, the windows). */
function Many({ at, geometry, material }: { at: THREE.Matrix4[]; geometry: THREE.BufferGeometry; material: THREE.Material }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    at.forEach((x, i) => m.setMatrixAt(i, x))
    m.instanceMatrix.needsUpdate = true
  }, [at])
  return <instancedMesh ref={ref} args={[geometry, material, at.length]} frustumCulled={false} />
}

const box = new THREE.BoxGeometry(1, 1, 1)
const place = (x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0, ry = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0)), new THREE.Vector3(sx, sy, sz))
const rowZ = (row: number) => FRONT - row * PITCH

/** The rows of seats: frame, cushion, back, the headrest covers in orange and green, the screens on the backs. */
function Seats() {
  const { frames, backs, covers, orangeCovers, screens } = useMemo(() => {
    const frames: THREE.Matrix4[] = []
    const backs: THREE.Matrix4[] = []
    const covers: THREE.Matrix4[] = []
    const orangeCovers: THREE.Matrix4[] = []
    const screens: THREE.Matrix4[] = []
    for (let row = 0; row < ROWS; row++)
      SEAT_X.forEach((x, col) => {
        const z = rowZ(row)
        frames.push(place(x, SEAT_Y - 0.06, z, 0.46, 0.14, 0.48))
        backs.push(place(x, SEAT_Y + 0.38, z - 0.25, 0.46, 0.72, 0.1, -0.12))
        ;((row + col) % 2 ? covers : orangeCovers).push(place(x, SEAT_Y + 0.66, z - 0.205, 0.4, 0.16, 0.02, -0.12))
        screens.push(place(x, SEAT_Y + 0.42, z - 0.31, 0.24, 0.16, 0.01, -0.12))
      })
    return { frames, backs, covers, orangeCovers, screens }
  }, [])
  const green = useMemo(() => new THREE.MeshLambertMaterial({ color: '#1f9a4a' }), [])
  const orange = useMemo(() => new THREE.MeshLambertMaterial({ color: '#f08a24' }), [])
  return (
    <>
      <Many at={frames} geometry={box} material={seatMat} />
      <Many at={backs} geometry={box} material={seatMat} />
      <Many at={covers} geometry={box} material={green} />
      <Many at={orangeCovers} geometry={box} material={orange} />
      <Many at={screens} geometry={box} material={screen} />
    </>
  )
}

/** The shell: the carpet, the curved walls, the bins, the lit ceiling, the windows (one per row each side). */
function Shell({ night }: { night: boolean }) {
  const length = ROWS * PITCH + 4
  const mid = FRONT - (ROWS * PITCH) / 2 + 1
  const sky = useMemo(() => skyTexture(night), [night])
  const glass = useMemo(() => new THREE.MeshBasicMaterial({ map: sky }), [sky])
  useFrame((_, dt) => void (sky.offset.x += Math.min(dt, 0.05) * 0.04))
  const windows = useMemo(() => {
    const out: THREE.Matrix4[] = []
    for (let row = 0; row < ROWS; row++)
      for (const side of [-1, 1]) out.push(place(side * 1.86, 1.12, rowZ(row) - 0.1, 0.28, 0.36, 0.02, 0, (side * Math.PI) / 2))
    return out
  }, [])
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, mid]} material={carpet} receiveShadow>
        <planeGeometry args={[3.9, length]} />
      </mesh>
      {/* The walls and the ceiling: half a tube round the cabin */}
      <mesh position={[0, 0.85, mid]} rotation={[Math.PI / 2, 0, 0]} material={wall}>
        <cylinderGeometry args={[2.05, 2.05, length, 28, 1, true]} />
      </mesh>
      <Many at={windows} geometry={box} material={glass} />
      {/* The bins over the seats, their edge, the strip of light down the middle */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * 1.32, 2.0, mid]} rotation={[0, 0, side * 0.35]} material={bin}>
            <boxGeometry args={[0.95, 0.42, length - 1]} />
          </mesh>
          <mesh position={[side * 0.92, 1.82, mid]} material={binEdge}>
            <boxGeometry args={[0.06, 0.06, length - 1]} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 2.5, mid]} material={ceilingLight}>
        <boxGeometry args={[0.5, 0.02, length - 1]} />
      </mesh>
      {/* The bulkhead in front, Air Lagune's welcome on its screen */}
      <mesh position={[0, 1.2, FRONT + 1.3]} material={bin}>
        <boxGeometry args={[3.9, 2.6, 0.1]} />
      </mesh>
      <Welcome z={FRONT + 1.24} />
    </>
  )
}

function Welcome({ z }: { z: number }) {
  const mat = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 128
    const g = c.getContext('2d')!
    g.fillStyle = '#0f1a2a'
    g.fillRect(0, 0, 256, 128)
    g.fillStyle = '#f08a24'
    g.fillRect(0, 0, 256, 10)
    g.fillStyle = '#1f9a4a'
    g.fillRect(0, 118, 256, 10)
    g.fillStyle = '#ffffff'
    g.textAlign = 'center'
    g.font = 'bold 26px sans-serif'
    g.fillText('Air Lagune', 128, 56)
    g.font = '18px sans-serif'
    g.fillText('Akwaba à bord !', 128, 88)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return new THREE.MeshBasicMaterial({ map: t })
  }, [])
  return (
    <mesh position={[0, 1.55, z]} rotation={[0, Math.PI, 0]} material={mat}>
      <planeGeometry args={[1.2, 0.6]} />
    </mesh>
  )
}

type Passenger = { row: number; col: number; look: Look; gender: 'femme' | 'homme'; pose: Pose; seed: number }

/** Who's on board: about one seat in three taken, each doing something of their own. */
function usePassengers() {
  return useMemo(() => {
    const r = rng('vol-passagers')
    const out: Passenger[] = []
    const POSES: Pose[] = ['sit', 'sit', 'phone', 'call', 'drink', 'eat', 'write']
    for (let row = 0; row < 11; row++)
      SEAT_X.forEach((_, col) => {
        if (row === MINE.row && col === MINE.col) return
        if (r() > 0.36) return
        const gender = r() < 0.5 ? 'femme' : 'homme'
        out.push({ row, col, gender, look: randomLook(gender, r), pose: POSES[Math.floor(r() * POSES.length)], seed: Math.floor(r() * 1e6) })
      })
    return out
  }, [])
}

/** The hostess and her trolley: down the aisle, a stop at a row, on, then back up. */
function Hostess() {
  const g = useRef<THREE.Group>(null)
  const [pose, setPose] = useState<Pose>('push')
  const look = useMemo<Look>(() => ({ ...randomLook('femme', rng('hotesse')), outfit: 'robe', outfitColor: '#f08a24', accessory: 'headwrap', accessoryColor: '#1f9a4a' }) as Look, [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime % 60
    // 0-25 s down the aisle (stopping at three rows), 25-30 s turned, 30-55 s back up, then a pause at the front.
    const down = Math.min(1, t / 25)
    const back = Math.min(1, Math.max(0, (t - 30) / 25))
    const k = t < 30 ? down : 1 - back
    // (Stops: the curve holds still at three rows.)
    const hold = (x: number) => x + Math.sin(x * Math.PI * 6) * 0.03
    // (Down to two rows behind the Sim's: the camera stands further back.)
    const z = FRONT + 0.2 - hold(k) * (FRONT + 0.2 - (rowZ(MINE.row) - 2.4))
    const moving = (t < 25 && Math.abs(Math.sin(down * Math.PI * 6)) > 0.25) || (t > 30 && t < 55)
    if (g.current) {
      g.current.position.z = z
      g.current.rotation.y = t < 27.5 || t > 57.5 ? Math.PI : 0
    }
    const want: Pose = moving ? 'push' : 'idle'
    if (want !== pose) setPose(want)
  })
  return (
    <group ref={g} position={[0, 0, FRONT]}>
      <Human look={look} gender="femme" pose={pose} seed={4242} />
      {/* The trolley before her */}
      <group position={[0, 0, 0.75]}>
        <mesh position={[0, 0.52, 0]} material={trolleyMat} castShadow>
          <boxGeometry args={[0.36, 0.95, 0.75]} />
        </mesh>
        <mesh position={[0, 1.02, 0]} material={bin}>
          <boxGeometry args={[0.38, 0.04, 0.77]} />
        </mesh>
        {[-0.08, 0.04, 0.16].map((x) => (
          <mesh key={x} position={[x * 1.2, 1.12, 0.2]} material={x > 0 ? new THREE.MeshLambertMaterial({ color: '#e84a2a' }) : screen}>
            <cylinderGeometry args={[0.04, 0.04, 0.18, 8]} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/** The camera: standing in the aisle a few rows back, looking forward down the cabin to the Sim at its window, swaying with the plane. */
function Camera() {
  const camera = useThree((s) => s.camera)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const z = rowZ(MINE.row) - 4.3 - Math.sin(t * 0.05) * 0.3
    camera.position.set(0.15 + Math.sin(t * 0.13) * 0.05, 1.9 + Math.sin(t * 0.7) * 0.012, z)
    camera.lookAt(-0.55, 1.05, rowZ(MINE.row) + 1.2)
    camera.rotation.z += Math.sin(t * 0.31) * 0.008
  })
  return null
}

/** The whole cabin, for a Canvas: its light, its people, the camera. */
export function PlaneCabin({ sim, night }: { sim: Pick<Sim, 'look' | 'gender'>; night: boolean }) {
  const passengers = usePassengers()
  const cabin = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    // A plane's slow roll and a little turbulence now and then.
    const t = clock.elapsedTime
    if (cabin.current) cabin.current.rotation.z = Math.sin(t * 0.25) * 0.012 + (Math.sin(t * 2.3) * Math.max(0, Math.sin(t * 0.17)) ** 8) * 0.01
  })
  return (
    <>
      <color attach="background" args={['#1b2233']} />
      <hemisphereLight args={['#fff6e6', '#6a6458', night ? 0.8 : 1.15]} />
      <pointLight position={[0, 2.3, rowZ(MINE.row)]} intensity={night ? 6 : 4} distance={9} color="#ffe9c4" />
      <directionalLight position={[-3, 2, 2]} intensity={night ? 0.15 : 0.7} color="#dbeaff" />
      <group ref={cabin}>
        <Shell night={night} />
        <Seats />
        {passengers.map((p) => (
          <group key={`${p.row}-${p.col}`} position={[SEAT_X[p.col], 0, rowZ(p.row) - 0.05]}>
            <Human look={p.look} gender={p.gender} pose={p.pose} seed={p.seed} />
          </group>
        ))}
        {/* The player's Sim, at the window, looking out now and then */}
        <group position={[SEAT_X[MINE.col], 0, rowZ(MINE.row) - 0.05]}>
          <Human look={sim.look} gender={sim.gender} pose="phone" seed={7} />
        </group>
        <Hostess />
      </group>
      <Camera />
    </>
  )
}
