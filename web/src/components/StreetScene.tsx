import { startTransition, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { Human, type Pose } from '../avatar/Human'
import { randomLook } from '../avatar/options'
import { rng } from '../world3d/themes'
import { whereabouts } from '../world3d/whereabouts'
import { moveObstacle } from '../world3d/obstacles'
import { Vehicle, type VehicleKind } from '../world3d/vehicles'
import { StreetStall, type StallKind } from '../world3d/open/stalls'
import { BusStop } from '../world3d/open/sotra'
import { StreetGame } from '../world3d/open/streetFoot'
import { StreetSpot } from '../world3d/open/streetPeople'
import { NouchiCorner } from '../world3d/open/nouchis'
import { CHAPTERS, GUIDE } from './StreetStory'

// The street of « Une journée dans ta rue » (StreetStory): one straight street,
// a scene every GAP metres along it, the camera and the guide walking from one
// to the next as the page scrolls. Only the scenes next to the camera are
// drawn, so a phone keeps up.

const GAP = 30
/** The camera's spring (critically damped): higher follows the scroll closer. */
const SPRING = 2.6
/** The hour each scene is lived at: how busy the stalls and the stop are. */
const HOURS = [7, 7, 7, 8, 9, 10, 12, 13, 16, 18, 19, 21, 22]
/** Where things go across the street: the far lane, the near lane, the guide's pavement. */
const FAR_LANE = -1.2
const NEAR_LANE = 2.2
const PAVEMENT = 5.2
/** After the porc au four, the night. */
const DUSK = 10
/** The sky through the day, one per scene. */
const SKY = ['#ffd2a1', '#cfe3f2', '#bfe0f5', '#a9d3f0', '#9fd0f2', '#9fd0f2', '#94cdf1', '#8ecaf0', '#f7c08a', '#f0a070', '#e2794f', '#1d2350', '#121530'].map((c) => new THREE.Color(c))
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
  /** How fast the camera goes along the street (scenes a second). */
  const vel = useRef(0)
  const sky = useMemo(() => new THREE.Color(SKY[0]), [])
  const hemi = useRef<THREE.HemisphereLight>(null)
  const sun = useRef<THREE.DirectionalLight>(null)
  const look = useMemo(() => new THREE.Vector3(), [])
  scene.background = sky

  useFrame((_, dt) => {
    // Follow the scroll on a spring: it speeds up and slows down gently, so a
    // flick of the finger or a notch of the wheel never jerks the camera. In
    // small steps, so a slow frame (or coming back to the tab) doesn't overshoot.
    const target = progress.current
    for (let left = Math.min(dt, 0.25); left > 0; left -= 1 / 120) {
      const h = Math.min(left, 1 / 120)
      vel.current += (SPRING * SPRING * (target - cam.current) - 2 * SPRING * vel.current) * h
      cam.current += vel.current * h
    }
    if (Math.abs(target - cam.current) < 1e-4 && Math.abs(vel.current) < 1e-3) {
      cam.current = target
      vel.current = 0
    }
    const c = cam.current
    const i = Math.min(SKY.length - 2, Math.floor(c))
    const u = Math.min(1, Math.max(0, c - i))
    sky.copy(SKY[i]).lerp(SKY[i + 1], u)
    const night = Math.min(2, Math.max(0, c - DUSK))
    // Night, but the street lamps and the stalls' bulbs: still enough to see.
    if (hemi.current) hemi.current.intensity = 1.25 - night * 0.28
    if (sun.current) sun.current.intensity = 1.5 - night * 0.55
    // A phone held upright sees less across: step back.
    const back = size.width < size.height ? 1.35 : 1
    const x = c * GAP
    camera.position.set(x + 4.2 * back, 3.6 * back, 10.5 * back)
    look.set(x - 0.3, 0.3, -2.2)
    camera.lookAt(look)
    // The game's people react to « the Sim » being near: here, the guide.
    whereabouts.sim = [x + 1.2, PAVEMENT]
    whereabouts.simPose = 'walk'
    const near = Math.round(c)
    // Building the next scene is heavy: let React spread it over a few frames.
    if (near !== at) startTransition(() => setAt(near))
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
      {[PAVEMENT, -4.2].map((z) => (
        <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[len / 2 - 30, 0.025, z]}>
          <planeGeometry args={[len, 2.4]} />
          <meshLambertMaterial color="#c9bfae" />
        </mesh>
      ))}
      <Facades len={len} />
      {/* Built a little ahead (no hitch when the next one comes), shown only near */}
      {CHAPTERS.map((ch, i) =>
        Math.abs(i - at) <= 2 ? (
          <group key={ch.id} visible={Math.abs(i - at) <= 1}>
            <Scene id={ch.id} x={i * GAP} hour={HOURS[i]} night={i > DUSK} />
          </group>
        ) : null,
      )}
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
      // The couloir of the last scene: no house over it.
      const gap = (CHAPTERS.length - 1) * GAP - 1
      if (x < gap + 2 && x + w > gap - 2) {
        x = gap + 2
        continue
      }
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
    case 'garba':
      return stall('garba', 0, 9)
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
    case 'gbaka':
      return <Stopping x={x} kind="gbaka" lane={FAR_LANE} period={19} wait={10} calls={['Adjamé ! Adjamé !', 'Monte, y a place !', 'On y va, on y va !']} riders={2} />
    case 'woro':
      return <Stopping x={x} kind="woro" lane={FAR_LANE} period={16} wait={7} calls={['Tu vas où ?', 'Monte, on y va !']} riders={1} hail="Woro ! Adjamé ?" />
    case 'gnango':
      return <Stopping x={x + 3} kind="car" lane={NEAR_LANE} period={23} calls={['Bonsoir Awa, c’est Gnango !']} riders={0} wait={14} />
    case 'couloir':
      // A couloir between two houses, going back from the street.
      return <NouchiCorner spot={{ id: 'nouchi:liste:1', at: [x - 1, -8], rot: Math.PI / 2, w: 3, len: 10, seed: 0.3 }} close={16} />
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
      ref.current.position.set(x + 2 + k * 45, 0, FAR_LANE)
      ref.current.visible = k > -1.5
    }
  })
  return (
    <group ref={ref}>
      <Vehicle p={[0, 0, 0]} r={Math.PI} kind="sotra" seed={2} />
    </group>
  )
}

/** A taxi down the street every 18 s: the boys stop playing and let it by. */
function PassingCar({ x }: { x: number }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const t = (clock.elapsedTime + 6) % 18
    const cx = x - 60 + t * 9
    if (ref.current) ref.current.position.set(cx, 0, NEAR_LANE - 0.6)
    moveObstacle('liste:car', { x: cx, z: NEAR_LANE - 0.6, hw: 2.2, hd: 0.9, rot: 0 })
  })
  return (
    <group ref={ref}>
      <Vehicle p={[0, 0, 0]} kind="taxi" seed={3} />
    </group>
  )
}

/** The guide: walks down the near pavement with the camera, stops at each scene and talks to you (or shows her phone). */
function Guide({ progress }: { progress: MutableRefObject<number> }) {
  // Awa in an orange wax kaba and a headwrap, easy to pick out in the crowd.
  const look = useMemo(() => ({ ...randomLook(GUIDE.gender, rng(GUIDE.seed)), outfit: 'kaba', outfitColor: '#ff7a00', pattern: 'cercles', hair: 'headwrap', accessory: 'earrings', accessoryColor: '', marks: 'none', wear: 'neuf' }), [])
  const ref = useRef<THREE.Group>(null)
  const st = useRef({ last: 0, speed: 0, walking: false })
  const [pose, setPose] = useState<Pose>('wave')
  useFrame((_, dt) => {
    const c = progress.current
    const s = st.current
    // How fast she goes (scenes a second), smoothed; she starts walking and stops with some margin, so the steps don't flicker.
    const v = dt > 0 ? Math.abs(c - s.last) / dt : 0
    s.last = c
    s.speed += (v - s.speed) * (1 - Math.exp(-dt * 6))
    if (!s.walking && s.speed > 0.06) s.walking = true
    else if (s.walking && s.speed < 0.02) s.walking = false
    const g = ref.current
    if (g) {
      g.position.set(c * GAP + 1.2, 0, PAVEMENT)
      // Walking: down the street. Standing: half turned to you. She turns, she doesn't snap round.
      const to = s.walking ? Math.PI / 2 : 0.35
      g.rotation.y += (to - g.rotation.y) * (1 - Math.exp(-dt * 7))
    }
    const p: Pose = s.walking ? 'walk' : CHAPTERS[Math.round(c)]?.phone ? 'phone' : 'talk'
    if (p !== pose) setPose(p)
  })
  return (
    <group ref={ref}>
      <Human look={look} gender={GUIDE.gender} pose={pose} seed={11} full />
    </group>
  )
}

/**
 * A gbaka, a woro-woro or a Gnango car: drives in, stops at the scene for a
 * while, drives off; then again. On the far lane it comes from the right (we
 * drive on the right), on the near lane from the left. Those waiting wave it
 * down and climb in; the apprenti (or the driver) says something.
 */
function Stopping({ x, kind, lane, period, calls, riders, hail, wait = 8 }: { x: number; kind: VehicleKind; lane: number; period: number; calls: string[]; riders: number; hail?: string; wait?: number }) {
  const dir = lane < 0 ? -1 : 1
  const car = useRef<THREE.Group>(null)
  const people = useRef<(THREE.Group | null)[]>([])
  const looks = useMemo(() => Array.from({ length: riders }, (_, i) => randomLook(i % 2 ? 'homme' : 'femme', rng(`rider${kind}${i}`))), [riders, kind])
  const [state, setState] = useState({ call: -1, hailing: false, boarding: false })
  useFrame(({ clock }) => {
    const t = clock.elapsedTime % period
    const stop = 4 + wait
    // In over 4 s, stopped, out over 4 s, then away until the next round.
    const off = t < 4 ? -(1 - ease(t / 4)) : t < stop ? 0 : t < stop + 4 ? ease((t - stop) / 4) : 2
    if (car.current) {
      car.current.position.set(x + dir * off * 40, 0, lane)
      car.current.visible = off < 1.5
    }
    // Those waiting: wave, then walk to the door and get in.
    const boarding = t > 5 && t < stop + 4
    const gone = t > 6.5 && t < stop + 4
    people.current.forEach((g, i) => {
      if (!g) return
      const k = boarding ? Math.min(1, (t - 5) / 1.5) : 0
      g.position.set(x - 1.2 + i * 0.9, 0, -4.2 + k * (lane + 4.2 - 1))
      g.visible = !gone
    })
    const call = t >= 3 && t < stop ? Math.floor((t - 3) / 2.6) % calls.length : -1
    const hailing = !!hail && t < 4.5
    if (call !== state.call || hailing !== state.hailing || boarding !== state.boarding) setState({ call, hailing, boarding })
  })
  return (
    <>
      <group ref={car}>
        <Vehicle p={[0, 0, 0]} r={dir < 0 ? Math.PI : 0} kind={kind} seed={kind === 'woro' ? 4 : 1} color={kind === 'car' ? '#212529' : undefined} />
        {state.call >= 0 && <Bubble y={kind === 'gbaka' ? 3.4 : 2.6} text={calls[state.call]} />}
      </group>
      {looks.map((l, i) => (
        <group key={i} ref={(g) => void (people.current[i] = g)} rotation={[0, state.boarding ? 0 : Math.PI, 0]}>
          <Human look={l} gender={i % 2 ? 'homme' : 'femme'} pose={state.boarding ? 'walk' : i === 0 ? 'wave' : 'idle'} seed={i * 5 + 2} />
          {i === 0 && state.hailing && hail && <Bubble y={2.3} text={hail} />}
        </group>
      ))}
    </>
  )
}

function Bubble({ y, text }: { y: number; text: string }) {
  return (
    <Html position={[0, y, 0]} center zIndexRange={[20, 0]}>
      <div className="rounded-2xl rounded-bl-sm bg-white px-3 py-1.5 text-[13px] font-extrabold whitespace-nowrap text-[var(--color-ink)] shadow-[0_6px_14px_-8px_rgba(0,0,0,0.5)]">{text}</div>
    </Html>
  )
}

const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t))
