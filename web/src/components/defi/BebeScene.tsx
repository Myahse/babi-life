import { useMemo, useRef, type MutableRefObject, type ReactNode } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Look, Sim } from '../../lib/types'
import { sceneDpr } from '../../lib/device'
import { Box } from '../../world3d/props'
import { Baby, Human, type Pose } from '../../avatar/Human'
import { familyCast } from '../../avatar/Family'
import { lookAt, randomLook } from '../../avatar/options'

// The baby's little games (Bebe.tsx) in 3D: the baby Sim on its mat in the
// family's house, maman and papa as the family dresses them (avatar/Family),
// real blocks for the tower, a rattle. The games' rules stay in Bebe.tsx;
// these only show them, live.

/** The baby playing: the player's Sim (its look, its family). */
export type BabyMe = { look: Look; gender: Sim['gender']; family?: string }

/** The baby and its parents, the same look each time (a baby of the town in the lab). */
export function useBabyCast(me?: BabyMe) {
  return useMemo(() => {
    let s = 17
    const look = me?.look ?? randomLook('femme', () => ((s = (s * 9301 + 49297) % 233280) / 233280))
    const cast = familyCast(me?.family || 'poignon', look)
    return { baby: lookAt(look, 'bebe'), gender: me?.gender ?? 'femme', maman: cast.maman.look, papa: cast.papa.look }
  }, [me?.look, me?.gender, me?.family])
}

/** The camera, held by someone: it breathes a little, and goes where `aim` says (eye, looking at). */
function Camera({ aim }: { aim: MutableRefObject<{ eye: [number, number, number]; at: [number, number, number] }> }) {
  const at = useRef(new THREE.Vector3())
  const first = useRef(true)
  useFrame(({ camera, clock, size }, dt) => {
    const t = clock.elapsedTime
    const { at: look } = aim.current
    // A wide picture (the phone on its side) shows more of the room: come closer, to keep the baby as big.
    const aspect = size.width / Math.max(1, size.height)
    const f = aspect > 1 ? Math.max(0.75, 1.5 / aspect) : 1
    const eye = aim.current.eye.map((v, i) => look[i] + (v - look[i]) * f)
    const k = first.current ? 1 : Math.min(1, dt * 3)
    first.current = false
    camera.position.x += (eye[0] + Math.sin(t * 0.4) * 0.04 - camera.position.x) * k
    camera.position.y += (eye[1] + Math.sin(t * 0.55) * 0.02 - camera.position.y) * k
    camera.position.z += (eye[2] - camera.position.z) * k
    at.current.lerp(new THREE.Vector3(...look), k)
    camera.lookAt(at.current)
  })
  return null
}

/** The baby's room: the floor, the walls, the window, the mat it plays on, a shelf of toys. */
function Nursery({ aim, children }: { aim: MutableRefObject<{ eye: [number, number, number]; at: [number, number, number] }>; children: ReactNode }) {
  return (
    <Canvas dpr={sceneDpr} shadows resize={{ offsetSize: true }} camera={{ fov: 40, position: aim.current.eye }}>
      <color attach="background" args={['#ffe3c2']} />
      <hemisphereLight args={['#fff6ea', '#b08a64', 0.95]} />
      <directionalLight position={[2.5, 5, 4]} intensity={1.15} castShadow shadow-mapSize={[512, 512]} />
      <Camera aim={aim} />
      <Box p={[0, -0.05, 0]} s={[9, 0.1, 10]} c="#c9996b" />
      <Box p={[0, 1.6, -4.2]} s={[9, 3.3, 0.1]} c="#ffd8b0" />
      <Box p={[-4.4, 1.6, 0]} s={[0.1, 3.3, 10]} c="#ffcfa0" />
      <Box p={[4.4, 1.6, 0]} s={[0.1, 3.3, 10]} c="#ffcfa0" />
      {/* The window and its frame, the skirting board */}
      <Box p={[1.4, 1.75, -4.13]} s={[1.5, 1.1, 0.04]} c="#a9d3f0" />
      <Box p={[1.4, 1.75, -4.11]} s={[0.06, 1.1, 0.04]} c="#f8f9fa" />
      <Box p={[0, 0.06, -4.13]} s={[9, 0.12, 0.04]} c="#f8f9fa" />
      {/* The mat, its border */}
      <Box p={[0, 0.012, 0]} s={[1.9, 0.025, 1.9]} c="#74c0fc" />
      <Box p={[0, 0.014, 0]} s={[1.6, 0.026, 1.6]} c="#a5d8ff" />
      {/* A shelf with toys on it */}
      <Box p={[-2.2, 0.45, -3.95]} s={[1.4, 0.9, 0.4]} c="#f8f9fa" />
      <Box p={[-2.6, 1.0, -3.95]} s={[0.22, 0.22, 0.22]} c="#ff6b6b" />
      <Box p={[-2.25, 0.98, -3.95]} s={[0.18, 0.18, 0.18]} c="#ffd43b" />
      <Box p={[-1.85, 1.02, -3.95]} s={[0.26, 0.26, 0.26]} c="#69db7c" />
      {children}
    </Canvas>
  )
}

/** The baby sitting (laughing, bouncing), crawling or toddling. */
function TheBaby({ look, gender, pose }: { look: Look; gender: Sim['gender']; pose: Pose }) {
  return <Baby look={look} gender={gender} fitted pose={pose} seed={3} />
}

/* ——— Coucou-caché ——— */

/** Maman kneeling on the mat, hands over her face, then open: « Coucou ! ». The baby laughs when the player does. */
export function CoucouScene({ me, open, laughing }: { me?: BabyMe; open: boolean; laughing: boolean }) {
  const cast = useBabyCast(me)
  const aim = useRef({ eye: [0.9, 1.3, 3.4] as [number, number, number], at: [0.05, 0.75, 0] as [number, number, number] })
  return (
    <Nursery aim={aim}>
      <group position={[-0.25, 0, -0.4]} rotation={[0, 0.75, 0]}>
        <Human look={cast.maman} gender="femme" pose={open ? 'coucou' : 'cache'} seed={11} full />
      </group>
      <group position={[0.5, 0.03, 0.4]} rotation={[0, -2.1, 0]}>
        <TheBaby look={cast.baby} gender={cast.gender} pose={laughing ? 'cheer' : 'idle'} />
      </group>
    </Nursery>
  )
}

/* ——— Les cubes ——— */

/** One % across the game's tower (Bebe.tsx CubesDefi) in metres; a block's height and depth. */
const U = 0.011
const CUBE_H = 0.13
const CUBE_D = 0.32
const FLOOR = 0.03
export type Fall = { x: number; w: number; i: number; at: number }

/** A block placed: dropped from where it slid, landing with a little bounce. */
function Placed({ x, w, i, color }: { x: number; w: number; i: number; color: string }) {
  const g = useRef<THREE.Group>(null)
  const born = useRef(performance.now())
  const y = FLOOR + i * CUBE_H + CUBE_H / 2
  useFrame(() => {
    if (!g.current) return
    const s = (performance.now() - born.current) / 1000
    // Falls the gap (0.1 s), then a small bounce, settling.
    const k = i === 0 ? 1 : Math.min(1, s / 0.1)
    const bounce = i === 0 || s < 0.1 ? 0 : Math.abs(Math.sin((s - 0.1) * 18)) * Math.exp(-(s - 0.1) * 9) * 0.04
    g.current.position.y = y + (1 - k * k) * 0.18 + bounce
    g.current.scale.y = s > 0.1 && s < 0.16 ? 0.9 : 1
  })
  return (
    <group ref={g} position={[(x + w / 2 - 50) * U, y, 0]}>
      <Box p={[0, 0, 0]} s={[w * U, CUBE_H, CUBE_D]} c={color} />
    </group>
  )
}

/** What hung over the edge: it tumbles off to the floor. */
function Falling({ f, color }: { f: Fall; color: string }) {
  const g = useRef<THREE.Group>(null)
  const side = f.x + f.w / 2 > 50 ? 1 : -1
  useFrame(() => {
    if (!g.current) return
    const s = Math.min(1.2, (performance.now() - f.at) / 1000)
    const y0 = FLOOR + f.i * CUBE_H + CUBE_H / 2
    g.current.position.set((f.x + f.w / 2 - 50) * U + side * s * 0.35, Math.max(FLOOR + CUBE_H / 2, y0 + 0.1 - 4.9 * s * s), s * 0.2)
    g.current.rotation.z = -side * Math.min(1.5, s * 4)
  })
  return (
    <group ref={g}>
      <Box p={[0, 0, 0]} s={[f.w * U, CUBE_H, CUBE_D]} c={color} />
    </group>
  )
}

export function CubesScene({ me, stack, x, w, over, falls, colors, cheer }: { me?: BabyMe; stack: { x: number; w: number }[]; x: number; w: number; over: boolean; falls: Fall[]; colors: string[]; cheer: boolean }) {
  const cast = useBabyCast(me)
  // The camera goes up with the tower.
  const top = FLOOR + stack.length * CUBE_H
  const aim = useRef({ eye: [0.1, 1.0, 3.2] as [number, number, number], at: [-0.1, 0.4, 0] as [number, number, number] })
  aim.current = { eye: [0.1, Math.max(1.0, top + 0.5), 3.2], at: [-0.1, Math.max(0.4, top - 0.15), 0] }
  return (
    <Nursery aim={aim}>
      {stack.map((c, i) => (
        <Placed key={i} x={c.x} w={c.w} i={i} color={colors[i % colors.length]} />
      ))}
      {falls.map((f) => (
        <Falling key={f.at} f={f} color={colors[f.i % colors.length]} />
      ))}
      {!over && (
        // The one in the hand, sliding above the tower.
        <group position={[(x + w / 2 - 50) * U, top + CUBE_H / 2 + 0.16, 0]}>
          <Box p={[0, 0, 0]} s={[w * U, CUBE_H, CUBE_D]} c={colors[stack.length % colors.length]} />
        </group>
      )}
      <group position={[-0.5, 0.03, 0.55]} rotation={[0, 0.6, 0]}>
        <TheBaby look={cast.baby} gender={cast.gender} pose={cheer ? 'cheer' : 'busy'} />
      </group>
    </Nursery>
  )
}

/* ——— Les premiers pas ——— */

/** The walk's state, from PasDefi: how far (0–100), the lean (-1 … 1), sat down (s), done. */
export type Steps = { d: number; lean: number; down: number; over: boolean }

/** From the mat to papa, kneeling at the far end with his arms open. Seen from behind the baby: it leans left and right. */
export function PasScene({ me, st }: { me?: BabyMe; st: MutableRefObject<Steps> }) {
  const cast = useBabyCast(me)
  const aim = useRef({ eye: [0.3, 1.1, START + 2.4] as [number, number, number], at: [0, 0.4, START - 1.4] as [number, number, number] })
  const s = st.current
  return (
    <Nursery aim={aim}>
      <group position={[0, 0, PAPA]} rotation={[0, 0.9, 0]}>
        <Human look={cast.papa} gender="homme" pose={s.over ? 'cheer' : 'coucou'} seed={21} full />
      </group>
      <Toddling st={st} aim={aim}>
        <TheBaby look={cast.baby} gender={cast.gender} pose={s.over ? 'cheer' : s.down > 0 ? 'idle' : 'stumble'} />
      </Toddling>
    </Nursery>
  )
}

const START = 1.1
const PAPA = -2.6

/** Where the baby has got to, how it leans (from the feet), the bump when it sits down hard; the camera following. */
function Toddling({ st, aim, children }: { st: MutableRefObject<Steps>; aim: MutableRefObject<{ eye: [number, number, number]; at: [number, number, number] }>; children: ReactNode }) {
  const g = useRef<THREE.Group>(null)
  useFrame(() => {
    const s = st.current
    const z = START + (PAPA + 0.45 - START) * (s.d / 100)
    if (g.current) {
      g.current.position.z = z
      g.current.rotation.z = s.down > 0 ? 0 : s.lean * 0.55
      g.current.position.y = s.down > 0.9 ? (s.down - 0.9) * 0.4 : 0
    }
    aim.current = { eye: [0.3, 1.1, z + 2.4], at: [0, 0.4, z - 1.4] }
  })
  return (
    <group ref={g} position={[0, 0, START]} rotation={[0, Math.PI, 0]}>
      {children}
    </group>
  )
}

/* ——— Le hochet ——— */

/** The rattle: its handle, the ball with the beads inside, the rings. It shakes when shaken. */
function Rattle({ shook }: { shook: MutableRefObject<number> }) {
  const g = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (!g.current) return
    const s = (performance.now() - shook.current) / 1000
    // A shake: a quick swing back and forth, dying out; otherwise just held, swaying a little.
    const shake = s < 0.6 ? Math.sin(s * 40) * 0.6 * Math.exp(-s * 6) : 0
    g.current.rotation.z = shake + Math.sin(clock.elapsedTime * 1.4) * 0.05
  })
  return (
    <group ref={g}>
      <mesh position={[0, -0.18, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.04, 0.36, 10]} />
        <meshLambertMaterial color="#ffd43b" />
      </mesh>
      <mesh position={[0, -0.37, 0]}>
        <sphereGeometry args={[0.055, 12, 10]} />
        <meshLambertMaterial color="#ff922b" />
      </mesh>
      <mesh position={[0, 0.09, 0]} castShadow>
        <sphereGeometry args={[0.15, 18, 14]} />
        <meshLambertMaterial color="#ff6b9a" />
      </mesh>
      <mesh position={[0, 0.09, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.155, 0.02, 8, 24]} />
        <meshLambertMaterial color="#4dabf7" />
      </mesh>
      <mesh position={[0, 0.09, 0]}>
        <torusGeometry args={[0.155, 0.02, 8, 24]} />
        <meshLambertMaterial color="#69db7c" />
      </mesh>
    </group>
  )
}

/** The beat: the ring around the rattle, the circle closing in on it. */
function Beat({ start, beat }: { start: MutableRefObject<number>; beat: number }) {
  const ring = useRef<THREE.Mesh>(null)
  useFrame(() => {
    if (!ring.current) return
    const t = (performance.now() - start.current) / 1000
    const k = Math.max(0, Math.min(1, 1 - (((t % beat) + beat) % beat) / beat))
    ring.current.visible = t > -0.8
    ring.current.scale.setScalar(1 + k * 1.5)
  })
  return (
    <group position={[0, 0.09, 0]}>
      <mesh>
        <torusGeometry args={[0.3, 0.022, 8, 40]} />
        <meshBasicMaterial color="#ffd43b" />
      </mesh>
      <mesh ref={ring}>
        <torusGeometry args={[0.3, 0.012, 8, 40]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.85} />
      </mesh>
    </group>
  )
}

/** The baby on its mat, the rattle up in front of it in the player's hand, the beat around it. */
export function HochetScene({ me, start, beat, shook, good }: { me?: BabyMe; start: MutableRefObject<number>; beat: number; shook: MutableRefObject<number>; good: boolean }) {
  const cast = useBabyCast(me)
  const aim = useRef({ eye: [0.1, 0.85, 2.3] as [number, number, number], at: [0.05, 0.4, 0] as [number, number, number] })
  return (
    <Nursery aim={aim}>
      <group position={[-0.22, 0.03, -0.1]} rotation={[0, 0.35, 0]}>
        <TheBaby look={cast.baby} gender={cast.gender} pose={good ? 'cheer' : 'busy'} />
      </group>
      <group position={[0.3, 0.55, 0.3]} scale={0.7}>
        <Rattle shook={shook} />
        <Beat start={start} beat={beat} />
      </group>
    </Nursery>
  )
}
