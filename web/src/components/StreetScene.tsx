import { useMemo, useRef, useState, type MutableRefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Human, type Pose } from '../avatar/Human'
import { randomLook } from '../avatar/options'
import { rng } from '../world3d/themes'
import { whereabouts } from '../world3d/whereabouts'
import { moveObstacle } from '../world3d/obstacles'
import { Vehicle } from '../world3d/vehicles'
import { StreetStall, type StallKind } from '../world3d/open/stalls'
import { BusStop } from '../world3d/open/sotra'
import { StreetGame } from '../world3d/open/streetFoot'
import { StreetSpot } from '../world3d/open/streetPeople'
import { CHAPTERS, GUIDE } from './StreetStory'

// The street of « Une journée dans ta rue » (StreetStory): one straight street,
// a scene every GAP metres along it, the camera and the guide walking from one
// to the next as the page scrolls. Only the scenes next to the camera are
// drawn, so a phone keeps up.

const GAP = 30
/** The hour each scene is lived at: how busy the stalls and the stop are. */
const HOURS = [7, 7, 8, 10, 13, 16, 19, 21]
/** The sky through the day, one per scene. */
const SKY = ['#ffd2a1', '#bfe0f5', '#a9d3f0', '#9fd0f2', '#8ecaf0', '#f7c08a', '#e2794f', '#1d2350'].map((c) => new THREE.Color(c))
const WALLS = ['#e9d8b8', '#f2b880', '#c9e4d6', '#f0e3a2', '#d8c6e8', '#f5c9b9', '#b9d7ef', '#efe9df']

export default function StreetScene({ progress, running }: { progress: MutableRefObject<number>; running: boolean }) {
  return (
    <Canvas shadows={false} dpr={[1, 1.5]} frameloop={running ? 'always' : 'never'} camera={{ position: [6, 4.5, 12], fov: 50 }} className="!absolute inset-0">
      <Street progress={progress} />
    </Canvas>
  )
}

function Street({ progress }: { progress: MutableRefObject<number> }) {
  const { camera, size, scene } = useThree()
  const [at, setAt] = useState(0)
  const cam = useRef(0)
  const sky = useMemo(() => new THREE.Color(SKY[0]), [])
  const hemi = useRef<THREE.HemisphereLight>(null)
  const sun = useRef<THREE.DirectionalLight>(null)
  const look = useMemo(() => new THREE.Vector3(), [])
  scene.background = sky

  useFrame((_, dt) => {
    // Follow the scroll softly.
    const target = progress.current
    cam.current += (target - cam.current) * Math.min(1, dt * 4)
    if (Math.abs(target - cam.current) < 1e-4) cam.current = target
    const c = cam.current
    const i = Math.min(SKY.length - 2, Math.floor(c))
    const u = Math.min(1, Math.max(0, c - i))
    sky.copy(SKY[i]).lerp(SKY[i + 1], u)
    const night = Math.max(0, c - 6) // dusk after the 7th scene
    if (hemi.current) hemi.current.intensity = 1.25 - night * 0.45
    if (sun.current) sun.current.intensity = 1.5 - night * 0.9
    // A phone held upright sees less across: step back.
    const back = size.width < size.height ? 1.35 : 1
    const x = c * GAP
    camera.position.set(x + 4.2 * back, 3.3 * back, 8.5 * back)
    look.set(x - 0.3, 0.1, -2.6)
    camera.lookAt(look)
    // The game's people react to « the Sim » being near: here, the guide.
    whereabouts.sim = [x + 1.2, -1.5]
    const near = Math.round(c)
    if (near !== at) setAt(near)
  })

  const len = CHAPTERS.length * GAP + 60
  return (
    <>
      <hemisphereLight ref={hemi} args={['#ffffff', '#b8a27c', 1.25]} />
      <directionalLight ref={sun} position={[20, 30, 15]} intensity={1.5} />
      {/* The ground, the street, the pavements, the walls behind */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[len / 2 - 30, 0, 0]}>
        <planeGeometry args={[len, 80]} />
        <meshLambertMaterial color="#b98b5c" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[len / 2 - 30, 0.02, 0.5]}>
        <planeGeometry args={[len, 7]} />
        <meshLambertMaterial color="#4a4d55" />
      </mesh>
      {Array.from({ length: Math.ceil(len / 4) }, (_, k) => (
        <mesh key={k} rotation={[-Math.PI / 2, 0, 0]} position={[k * 4 - 30, 0.03, 0.5]}>
          <planeGeometry args={[1.6, 0.15]} />
          <meshBasicMaterial color="#e8e2cf" />
        </mesh>
      ))}
      <Facades len={len} />
      {CHAPTERS.map((ch, i) => (Math.abs(i - at) <= 1 ? <Scene key={ch.id} id={ch.id} x={i * GAP} hour={HOURS[i]} night={i >= 7} /> : null))}
      <Guide progress={cam} />
    </>
  )
}

/** Houses and shops along the back of the street: blocks of colour, a door, a window. */
function Facades({ len }: { len: number }) {
  const blocks = useMemo(() => {
    const r = rng('facades')
    const out: { x: number; w: number; h: number; c: string }[] = []
    for (let x = -30; x < len - 30; ) {
      const w = 6 + r() * 6
      out.push({ x: x + w / 2, w: w - 0.4, h: 3.5 + r() * 4, c: WALLS[Math.floor(r() * WALLS.length)] })
      x += w
    }
    return out
  }, [len])
  return (
    <>
      {blocks.map((b, k) => (
        <group key={k} position={[b.x, 0, -11]}>
          <mesh position={[0, b.h / 2, 0]}>
            <boxGeometry args={[b.w, b.h, 3]} />
            <meshLambertMaterial color={b.c} />
          </mesh>
          <mesh position={[-b.w / 4, 1.05, 1.51]}>
            <planeGeometry args={[1.1, 2.1]} />
            <meshLambertMaterial color="#6b4a2f" />
          </mesh>
          <mesh position={[b.w / 4, 1.8, 1.51]}>
            <planeGeometry args={[1.4, 1]} />
            <meshLambertMaterial color="#3d5a73" />
          </mesh>
        </group>
      ))}
    </>
  )
}

/** One scene of the day, at x along the street. Stalls stand on the far pavement facing the street. */
function Scene({ id, x, hour, night }: { id: (typeof CHAPTERS)[number]['id']; x: number; hour: number; night: boolean }) {
  const stall = (kind: StallKind, dx = 0, n = 0) => <StreetStall key={`${kind}${n}`} stall={{ id: `${kind}:liste:${n}`, kind, at: [x + dx, -5.5], rot: 0, seed: 0.35 + n * 0.21 }} hour={hour} crowd />
  switch (id) {
    case 'cafe':
      return stall('cafe')
    case 'the':
      return stall('the', 0, 7)
    case 'alloco':
      return stall('alloco', 0, 4)
    case 'porc':
      // Three side by side, as in Yopougon.
      return <>{[-6.5, 0, 6.5].map((dx, n) => stall('porc', dx, n + 1))}</>
    case 'sotra':
      return (
        <>
          <BusStop stop={{ id: 'sotra:liste', at: [x, -5], rot: 0, seed: 0.5, lines: ['11', '19', '44'] }} hour={hour} night={night} />
          <Bus x={x} />
        </>
      )
    case 'ecole':
      return <StreetSpot spot={{ id: 'ecole:liste:2', kind: 'ecole', at: [x, 0], rot: 0, w: 8, len: 34, seed: 0.62 }} />
    case 'pasteur':
      return <StreetSpot spot={{ id: 'pasteur:liste:1', kind: 'pasteur', at: [x, 0], rot: 0, w: 8, len: 34, seed: 0.7 }} />
    case 'foot':
      return (
        <>
          <StreetGame game={{ id: 'foot:liste:1', at: [x, 0.5], rot: 0, w: 7, seed: 0.37 }} />
          <PassingCar x={x} />
        </>
      )
  }
}

/** The bus pulls in, waits at the stop, pulls out: every 24 s. */
function Bus({ x }: { x: number }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime % 24
    // In over 5 s, 9 s at the stop, out over 5 s, then gone.
    const k = t < 5 ? 1 - ease(t / 5) : t < 14 ? 0 : t < 19 ? -ease((t - 14) / 5) : -2
    if (ref.current) {
      ref.current.position.set(x + 2 + k * 45, 0, -1.4)
      ref.current.visible = k > -1.5
    }
  })
  return (
    <group ref={ref}>
      <Vehicle p={[0, 0, 0]} kind="sotra" seed={2} />
    </group>
  )
}

/** A taxi down the street every 18 s: the boys stop playing and let it by. */
function PassingCar({ x }: { x: number }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const t = (clock.elapsedTime + 6) % 18
    const cx = x - 60 + t * 9
    if (ref.current) ref.current.position.set(cx, 0, 2)
    moveObstacle('liste:car', { x: cx, z: 2, hw: 2.2, hd: 0.9, rot: 0 })
  })
  return (
    <group ref={ref}>
      <Vehicle p={[0, 0, 0]} kind="taxi" seed={3} />
    </group>
  )
}

/** The guide: walks down the near pavement with the camera, stops at each scene and talks to you. */
function Guide({ progress }: { progress: MutableRefObject<number> }) {
  // Awa in an orange wax kaba and a headwrap, easy to pick out in the crowd.
  const look = useMemo(() => ({ ...randomLook(GUIDE.gender, rng(GUIDE.seed)), outfit: 'kaba', outfitColor: '#ff7a00', pattern: 'cercles', hair: 'headwrap', accessory: 'earrings', accessoryColor: '', marks: 'none', wear: 'neuf' }), [])
  const ref = useRef<THREE.Group>(null)
  const last = useRef(0)
  const [pose, setPose] = useState<Pose>('wave')
  useFrame(() => {
    const c = progress.current
    const moving = Math.abs(c - last.current) > 0.0015
    last.current = c
    const g = ref.current
    if (g) {
      g.position.set(c * GAP + 1.2, 0, 2.6)
      // Walking: down the street. Standing: half turned to you, an arm to the scene.
      g.rotation.y = moving ? Math.PI / 2 : 0.35
    }
    const p: Pose = moving ? 'walk' : 'talk'
    if (p !== pose) setPose(p)
  })
  return (
    <group ref={ref}>
      <Human look={look} gender={GUIDE.gender} pose={pose} seed={11} full />
    </group>
  )
}

const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t))
