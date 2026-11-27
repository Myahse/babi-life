import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Look } from '../../lib/types'
import { B, Bondisseur, floater } from './blocs'
import { Combinaison, SiegePilote } from './Combinaison'
import { crater, noise, Sol, type Crater } from './Sol'
import { Terre, type LightCity } from './Terre'
import { StaticMerge } from '../staticMerge'

// The Moon (the update « espace-lune »): the Base Clair-de-Terre at the rim of the Shackleton crater, at the south
// pole, in blocks: the grey ground and its craters, the base's white inflatable modules and their airlock, the
// greenhouse under its pink lamps, the Margouillat rover (an orange-headed lizard of a rover), the regolith mine
// and its conveyor, the agency's pennant (the only flag here: no country's), and the Earth low on the horizon,
// rising and setting a little (Earthrise). The Sim in the suit bounds at a sixth of the Earth's pull.

type V3 = [number, number, number]
export const MOON_G = 1.62

const SHACKLETON: Crater = { x: 0, z: -62, r: 30, depth: 9 }
const CRATERS: Crater[] = [SHACKLETON, { x: 28, z: 18, r: 6, depth: 1.6 }, { x: -30, z: 22, r: 8, depth: 2 }, { x: 40, z: -18, r: 5, depth: 1.2 }, { x: -20, z: -10, r: 3, depth: 0.8 }, { x: 18, z: 40, r: 4, depth: 1 }]
const moonHeight = (x: number, z: number) => CRATERS.reduce((h, c) => h + crater(c, x, z), 0) + (noise(Math.floor(x / 4), Math.floor(z / 4)) - 0.5) * 0.6
const MOON_GREYS = ['#9a9a9a', '#8c8c8c', '#a6a6a6', '#7f7f7f']

/** The Margouillat, the base's rover: six wheels, a blue body, its orange head (the cab) and its tail (the antenna). */
export function Margouillat({ driver, look }: { driver?: boolean; look?: Look }) {
  return (
    <group>
      {[-1.4, 0, 1.4].flatMap((z) =>
        [-1, 1].map((s) => (
          <group key={`${z}${s}`}>
            <B p={[s * 1.15, 0.45, z]} s={[0.4, 0.9, 0.9]} c="#343a40" />
            <B p={[s * 1.37, 0.45, z]} s={[0.06, 0.5, 0.5]} c="#adb5bd" />
          </group>
        )),
      )}
      <B p={[0, 1.05, 0]} s={[1.9, 0.5, 4]} c="#1c7ed6" />
      <B p={[0, 1.35, -0.4]} s={[1.6, 0.12, 2.6]} c="#f4f4f1" />
      {/* Its head: the cab, orange, with two round eyes for lamps */}
      <B p={[0, 1.65, 1.75]} s={[1.5, 0.9, 1]} c="#ff7a00" />
      {[-0.45, 0.45].map((x) => (
        <B key={x} p={[x, 1.85, 2.27]} s={[0.25, 0.25, 0.05]} c="#fff3bf" glow />
      ))}
      <B p={[0, 1.25, 2.3]} s={[1.2, 0.12, 0.1]} c="#d9480f" />
      {/* Its crest along the back, like the agama's, and its side panels */}
      {[-1.5, -1, -0.5].map((z, i) => (
        <B key={z} p={[0, 1.55 + (i % 2) * 0.06, z]} s={[0.18, 0.3 - i * 0.03, 0.3]} c="#ff922b" />
      ))}
      {[-1, 1].map((x) => (
        <B key={x} p={[x * 0.97, 1.05, -0.2]} s={[0.04, 0.3, 2.6]} c="#ffd43b" />
      ))}
      <B p={[0, 0.95, -2.3]} s={[0.5, 0.3, 0.6]} c="#1864ab" />
      <B p={[0, 0.85, -2.75]} s={[0.3, 0.2, 0.5]} c="#1864ab" />
      {/* Its tail: the antenna, its dish */}
      <B p={[0, 1.9, -2.1]} s={[0.12, 1.6, 0.12]} c="#ced4da" r={[-0.5, 0, 0]} />
      <B p={[0, 2.6, -2.55]} s={[0.7, 0.08, 0.7]} c="#f4f4f1" r={[-0.5, 0, 0]} />
      {/* The driver's seat and the controls behind the head; the driver sits there, hands on the yoke */}
      <group position={[0, 1.41, 0.2]} scale={0.75}>
        <SiegePilote />
        {driver && <Combinaison look={look} sit />}
      </group>
    </group>
  )
}

/** The agency's pennant: an orange and white triangle on its pole (stiffened: no wind to fly it). */
export function Fanion({ p }: { p: V3 }) {
  return (
    <group position={p}>
      <B p={[0, 1.6, 0]} s={[0.08, 3.2, 0.08]} c="#dee2e6" />
      <B p={[0.45, 2.95, 0]} s={[0.9, 0.06, 0.04]} c="#dee2e6" />
      {[0, 1, 2, 3].map((i) => (
        <B key={i} p={[0.12 + i * 0.22, 2.7, 0]} s={[0.22, 0.48 - i * 0.11, 0.03]} c={i % 2 ? '#ffffff' : '#ff7a00'} />
      ))}
    </group>
  )
}

/** An inflatable module of the base: a white drum of blocks, its orange band, its porthole. */
function Gonflable({ p, r = 2.6, h = 3.2, rot = 0 }: { p: V3; r?: number; h?: number; rot?: number }) {
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <B p={[0, h / 2, 0]} s={[r * 2, h, r * 1.4]} c="#f8f9fa" />
      <B p={[0, h / 2, 0]} s={[r * 1.4, h, r * 2]} c="#f1f3f5" />
      <B p={[0, h + 0.3, 0]} s={[r * 1.4, 0.6, r * 1.4]} c="#e9ecef" />
      <B p={[0, h * 0.62, 0]} s={[r * 2.02, 0.3, r * 1.42]} c="#ff7a00" />
      <B p={[0, h * 0.5, r * 0.7 + 0.01]} s={[0.9, 0.9, 0.05]} c="#ffe8a3" glow />
      <B p={[0, h * 0.5, r * 0.7 + 0.02]} s={[0.06, 0.9, 0.03]} c="#868e96" />
      {[-1, 1].map((x) => (
        <B key={x} p={[x * r * 0.7, h / 2, x * 0.0]} s={[0.12, h * 1.02, r * 1.42]} c="#dee2e6" />
      ))}
      <B p={[0, h + 0.7, 0]} s={[0.25, 0.25, 0.25]} c="#ff6b6b" glow />
    </group>
  )
}

/** The greenhouse: glass over rows of lettuce and okra, the pink lamps above. */
export function Serre({ p, crop = '#40c057', crop2 = '#2f9e44' }: { p: V3; crop?: string; crop2?: string }) {
  return (
    <group position={p}>
      <B p={[0, 1.6, 0]} s={[5, 3.2, 7]} c="#d0ebff" o={0.28} />
      <B p={[0, 3.25, 0]} s={[5.1, 0.1, 7.1]} c="#adb5bd" />
      {[-1.4, 0, 1.4].map((x) => (
        <group key={x}>
          <B p={[x, 0.35, 0]} s={[0.9, 0.7, 6]} c="#5c3d2e" />
          {Array.from({ length: 6 }, (_, k) => (
            <B key={k} p={[x, 0.85, -2.5 + k]} s={[0.5, 0.35 + (k % 2) * 0.2, 0.5]} c={k % 2 ? crop : crop2} />
          ))}
          <B p={[x, 2.9, 0]} s={[0.3, 0.08, 6]} c="#f783ac" glow />
        </group>
      ))}
    </group>
  )
}

/** The regolith mine: a digger's arm, its conveyor, the grey heaps, the tanks of water and oxygen it makes. */
function Mine({ p, working }: { p: V3; working?: boolean }) {
  const belt = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (!belt.current) return
    belt.current.children.forEach((c, i) => (c.position.z = ((clock.elapsedTime * (working ? 1.2 : 0.3) + i * 0.8) % 6) - 3))
  })
  return (
    <group position={p}>
      <B p={[0, 1, 0]} s={[3, 2, 3]} c="#e9ecef" />
      <B p={[0, 2.4, 1.6]} s={[0.4, 0.4, 3.6]} c="#ffd43b" r={[0.5, 0, 0]} />
      <B p={[0, 1.3, 3.4]} s={[1, 0.8, 1]} c="#ffd43b" />
      <group position={[3, 1.2, 0]}>
        <B p={[0, 0, 0]} s={[0.8, 0.2, 6]} c="#495057" />
        <group ref={belt} userData={{ live: true }}>
          {Array.from({ length: 7 }, (_, i) => (
            <B key={i} p={[0, 0.2, 0]} s={[0.4, 0.2, 0.4]} c="#868e96" />
          ))}
        </group>
      </group>
      {[
        [-3, 0.6, 2, 1.8],
        [-4, 0.4, -1, 1.2],
      ].map(([x, y, z, s], i) => (
        <B key={i} p={[x, y, z]} s={[s * 1.6, s, s * 1.6]} c="#7a7a7a" />
      ))}
      {[-1.2, 0, 1.2].map((x, i) => (
        <B key={x} p={[x + 6, 0.9, 0]} s={[0.9, 1.8, 0.9]} c={i === 1 ? '#74c0fc' : '#ced4da'} />
      ))}
    </group>
  )
}

/** Where the camera sits for what's done, or null (it follows the Sim bounding about). */
function moonShot(kind?: string, doing?: string): { eye: V3; at: V3 } | null {
  if (doing === 'lune-lever-terre' || doing === 'lune-photo') return { eye: [2, 2.6, 10], at: [-60, 22, -150] }
  if (kind === 'espace-serre') return { eye: [9, 3.5, -1], at: [12, 1, -6] }
  if (kind === 'espace-mine') return { eye: [-6, 6, 18], at: [-14, 1, 8] }
  if (kind === 'espace-rover') return null
  if (kind === 'espace-sas') return { eye: [-3, 3, 4], at: [-6, 1.5, -6] }
  if (kind === 'espace-lune') return doing === 'lune-marcher' ? null : { eye: [2, 3, 6], at: [-6, 2, -8] }
  return null
}

export function Lune({ look, kind, doing, cities, cruise }: { look: Look; kind?: string; doing?: string; cities: LightCity[]; cruise?: boolean }) {
  const shot = moonShot(kind, doing)
  const rover = useRef<THREE.Group>(null)
  const earth = useRef<THREE.Group>(null)
  const eye = useRef(new THREE.Vector3(10, 6, 16))
  const at = useRef(new THREE.Vector3())
  const driving = kind === 'espace-rover' || doing === 'lune-margouillat'
  useFrame(({ camera, clock }, dt) => {
    const t = clock.elapsedTime
    // The rover goes round the rim when driven, else waits by its garage.
    if (rover.current) {
      if (driving) {
        const a = t * 0.12
        rover.current.position.set(SHACKLETON.x + Math.cos(a) * 36, Math.max(0, moonHeight(SHACKLETON.x + Math.cos(a) * 36, SHACKLETON.z + Math.sin(a) * 36)), SHACKLETON.z + Math.sin(a) * 36)
        rover.current.rotation.y = -a
        floater.pos.copy(rover.current.position).y += 2
      } else {
        rover.current.position.set(14, 0, 6)
        rover.current.rotation.y = -0.6
      }
    }
    // Earthrise: the Earth bobs on the horizon (the libration), slowly.
    if (earth.current) earth.current.position.y = 14 + Math.sin(t * 0.02) * 8
    // Out walking: from behind and above the Sim, the base and the Earth low beyond it.
    const want = shot ? new THREE.Vector3(...shot.eye) : new THREE.Vector3(floater.pos.x + 7, floater.pos.y + 5, floater.pos.z + 13)
    const look_ = shot ? new THREE.Vector3(...shot.at) : driving ? floater.pos : floater.pos.clone().lerp(new THREE.Vector3(-6, 3, -8), 0.4)
    const k = 1 - Math.exp(-dt * 2.5)
    eye.current.lerp(want, k)
    at.current.lerp(look_, k)
    camera.position.copy(eye.current)
    camera.lookAt(at.current)
  })
  return (
    <StaticMerge version={`${kind ?? ''}|${doing ?? ''}`}>
      <group>
        <ambientLight intensity={0.35} />
        {/* The south pole's sun, low on the horizon: long light */}
        <directionalLight position={[80, 14, 30]} intensity={2.2} />
        <hemisphereLight args={['#c8d0ff', '#3a3a3a', 0.4]} />
        <Sol height={moonHeight} colors={MOON_GREYS} size={150} />
        {/* The Base Clair-de-Terre */}
        <Gonflable p={[-6, 0, -8]} />
        <Gonflable p={[-12, 0, -4]} r={2.2} h={2.8} rot={0.5} />
        <B p={[-9, 1.2, -6]} s={[4, 1.4, 1.4]} c="#dee2e6" r={[0, 0.4, 0]} />
        {/* The airlock, its door */}
        <B p={[-3, 1.2, -6]} s={[1.6, 2.4, 1.6]} c="#ced4da" />
        <B p={[-2.18, 1.1, -6]} s={[0.05, 1.8, 0.9]} c="#495057" />
        {/* Solar panels, the antenna */}
        {[-20, -24].map((x) => (
          <group key={x} position={[x, 0, -12]}>
            <B p={[0, 1.4, 0]} s={[0.15, 2.8, 0.15]} c="#adb5bd" />
            <B p={[0, 3, 0]} s={[3.4, 0.08, 2]} c="#1e3a8a" r={[0.5, 0, 0]} />
          </group>
        ))}
        <Serre p={[12, 0, -6]} />
        {/* The landing pad: its ring of lights, the Pirogue's mark */}
        <group position={[18, 0.3, 18]}>
          <B p={[0, 0, 0]} s={[10, 0.2, 10]} c="#6c6c6c" />
          <B p={[0, 0.12, 0]} s={[6, 0.02, 0.5]} c="#ff7a00" />
          <B p={[0, 0.12, 0]} s={[0.5, 0.02, 6]} c="#ff7a00" />
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2
            return <B key={i} p={[Math.cos(a) * 4.6, 0.2, Math.sin(a) * 4.6]} s={[0.25, 0.25, 0.25]} c="#ffd43b" glow />
          })}
        </group>
        {/* The dish that talks to the Earth, pointed at it */}
        <group position={[-17, 0, 2]}>
          <B p={[0, 1.5, 0]} s={[0.3, 3, 0.3]} c="#adb5bd" />
          <group position={[0, 3.3, 0]} rotation={[0.5, -0.4, 0]}>
            <B p={[0, 0, 0]} s={[2.6, 2.6, 0.2]} c="#f1f3f5" />
            <B p={[0, 0, 0.6]} s={[0.15, 0.15, 1.2]} c="#868e96" />
          </group>
        </group>
        {/* Boulders */}
        {[[8, 0, 9, 1.2], [-8, 0, 12, 0.8], [24, 0, -4, 1.6], [-26, 0, -8, 1.1], [5, 0, -20, 0.9]].map(([x, y, z, k], i) => (
          <group key={i} position={[x, y + k * 0.35, z]} rotation={[0, i, 0]}>
            <B p={[0, 0, 0]} s={[k * 1.4, k * 0.9, k]} c="#8a8a8a" />
            <B p={[k * 0.3, k * 0.4, 0]} s={[k * 0.7, k * 0.5, k * 0.7]} c="#9c9c9c" />
          </group>
        ))}
        {/* The base's warm lights on the grey */}
        <pointLight position={[-6, 3, -3]} intensity={18} distance={12} color="#ffd8a8" />
        <Mine p={[-14, 0, 8]} working={doing === 'lune-regolithe'} />
        <Fanion p={[3, 0, 1]} />
        <group ref={rover} userData={{ live: true }}>
          <Margouillat driver={driving} look={look} />
        </group>
        {/* Footprints */}
        {Array.from({ length: 10 }, (_, i) => (
          <B key={i} p={[1 + i * 0.8, 0.27, 3 + (i % 2) * 0.5]} s={[0.25, 0.05, 0.4]} c="#6b6b6b" />
        ))}
        {!driving && !cruise && <Bondisseur look={look} gravity={MOON_G} at={[2, 0.25, 4]} radius={doing === 'lune-marcher' ? 6 : 2.5} />}
        {/* The Earth, low over the horizon */}
        <group ref={earth} position={[-60, 14, -150]} userData={{ live: true }}>
          <Terre radius={12} cities={cities} view="lune" />
        </group>
      </group>
    </StaticMerge>
  )
}
