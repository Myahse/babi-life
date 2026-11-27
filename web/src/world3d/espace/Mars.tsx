import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Look } from '../../lib/types'
import { B, Bondisseur, floater, Pirogue } from './blocs'
import { Combinaison, SiegePilote } from './Combinaison'
import { Serre } from './Lune'
import { Character } from '../Character'
import type { Pose } from '../../avatar/Human'

const DOME_POSE: Record<string, Pose> = { 'mars-message': 'call', 'mars-sachet': 'eat', 'mars-sac': 'sleep', 'mars-eponge': 'wash', 'mars-serre': 'pick', join: 'lookup' }
import { crater, noise, Sol } from './Sol'
import { StaticMerge } from '../staticMerge'

// Mars (the update « espace-mars »): the Colonie Harmattan inside the crater Jezero, in blocks: the red ground and
// its rocks, the crater's rim all round in the haze, the old river's delta in steps to the west, the colony's
// glass dome (its greenhouse of cassava and chilli inside), the laboratory, the pressurised rover that drives out
// to the delta, the Grande Pirogue landed on its shield. A dust storm (the happening « tempête de poussière »)
// turns the sky orange and sends the dust flying; the sunset there is blue. The Sim bounds at a third of a g.

type V3 = [number, number, number]
export const MARS_G = 3.71

/** The delta: the old river's fan, terraces of sediment stepping down to the crater's floor (to the west). */
function delta(x: number, z: number) {
  const dx = x + 55
  const d = Math.hypot(dx, z * 1.4)
  if (d > 30 || dx > 25) return 0
  return Math.max(0, Math.floor((30 - d) / 6)) * 0.9
}
// The crater's rim, far all round (Jezero is 45 km wide: here, a ring at the edge of what's drawn).
const marsHeight = (x: number, z: number) => {
  const r = Math.hypot(x, z)
  const rim = r > 58 ? (r - 58) * 0.55 : 0
  return delta(x, z) + rim + crater({ x: 26, z: 22, r: 5, depth: 1.2 }, x, z) + (noise(Math.floor(x / 3), Math.floor(z / 3)) - 0.5) * 0.7
}
const MARS_REDS = ['#b5532c', '#a8482a', '#c2623a', '#9c4226', '#b85d34']

/** The colony's dome: rings of glass blocks over a white floor, its ribs, the airlock. */
function Dome({ p, r = 9 }: { p: V3; r?: number }) {
  const rings = useMemo(() => {
    const out: { y: number; rr: number }[] = []
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * (Math.PI / 2)
      out.push({ y: Math.sin(a) * r, rr: Math.cos(a) * r })
    }
    return out
  }, [r])
  return (
    <group position={p}>
      <B p={[0, 0.15, 0]} s={[r * 2, 0.3, r * 2]} c="#dee2e6" />
      {rings.map(({ y, rr }, i) => (
        <group key={i}>
          {Array.from({ length: 12 }, (_, k) => {
            const a = (k / 12) * Math.PI * 2
            return <B key={k} p={[Math.cos(a) * rr, y + 0.6, Math.sin(a) * rr]} s={[rr * 0.55 + 0.4, (r / 7) * 1.15, 0.12]} c={i % 2 ? '#cfe8ff' : '#d8f0ff'} o={0.3} r={[0, -a + Math.PI / 2, 0]} />
          })}
        </group>
      ))}
      <B p={[0, r + 0.4, 0]} s={[1.6, 0.3, 1.6]} c="#ced4da" />
      {Array.from({ length: 6 }, (_, k) => {
        const a = (k / 6) * Math.PI * 2
        return <B key={k} p={[Math.cos(a) * r * 0.72, r * 0.62, Math.sin(a) * r * 0.72]} s={[0.15, r * 0.9, 0.15]} c="#adb5bd" r={[Math.sin(a) * 0.75, 0, -Math.cos(a) * 0.75]} />
      })}
      <B p={[r + 0.6, 1.3, 0]} s={[2, 2.6, 2]} c="#ced4da" />
      <B p={[r + 1.62, 1.2, 0]} s={[0.05, 1.8, 0.9]} c="#495057" />
    </group>
  )
}

/** The colony's rover: white, pressurised, six big wheels, its red stripe. */
function RoverMars({ driver, look }: { driver?: boolean; look?: Look }) {
  return (
    <group>
      {[-1.6, 0, 1.6].flatMap((z) => [-1, 1].map((s) => <B key={`${z}${s}`} p={[s * 1.4, 0.6, z]} s={[0.5, 1.2, 1.1]} c="#343a40" />))}
      <B p={[0, 1.6, 0]} s={[2.4, 1.4, 4.6]} c="#f8f9fa" />
      <B p={[0, 1.7, 2.32]} s={[2, 0.7, 0.05]} c="#4dabf7" o={driver ? 0.4 : 0.8} />
      <B p={[0, 1.15, 0]} s={[2.42, 0.2, 4.62]} c="#c92a2a" />
      <B p={[0.6, 2.7, -1.5]} s={[0.1, 0.8, 0.1]} c="#adb5bd" />
      {driver && (
        <group position={[0, 0.9, 1.4]} scale={0.6}>
          <SiegePilote />
          <Combinaison look={look} sit />
        </group>
      )}
    </group>
  )
}

/** The dust of the storm: blocks blown across, round the camera's side of the colony. */
function Tempete() {
  const dust = useRef<THREE.InstancedMesh>(null)
  const seeds = useMemo(() => Array.from({ length: 420 }, (_, i) => [noise(i, 1) * 70 - 35, noise(i, 2) * 10, noise(i, 3) * 60 - 25, 0.4 + noise(i, 4)]), [])
  const o = useMemo(() => new THREE.Object3D(), [])
  useFrame(({ clock }) => {
    const m = dust.current
    if (!m) return
    const t = clock.elapsedTime
    seeds.forEach(([x, y, z, s], i) => {
      o.position.set((((x + t * 12 * s + 35) % 70) + 70) % 70 - 35, y + Math.sin(t + i) * 0.5, z)
      o.scale.set(s * 0.9, s * 0.35, s * 0.5)
      o.rotation.set(t * s, t, 0)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={dust} args={[undefined, undefined, seeds.length]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshLambertMaterial color="#d9822b" transparent opacity={0.7} />
    </instancedMesh>
  )
}

/** Where the camera sits for what's done, or null (it follows the Sim). */
function marsShot(kind?: string, doing?: string, storm?: boolean): { eye: V3; at: V3 } | null {
  if (doing === 'mars-photo') return { eye: [-8, 3, 18], at: [-30, 9, -70] }
  if (kind === 'espace-serre') return { eye: [-2, 4, 6], at: [-4, 1, -2] }
  if (kind === 'espace-labo') return { eye: [12, 3.5, 8], at: [14, 1.5, 2] }
  if (kind === 'espace-sas') return { eye: [13, 3, 6], at: [9, 1.5, 0] }
  if (kind === 'espace-mars' || (storm && doing === 'join')) return doing === 'mars-marcher' ? null : { eye: [5.5, 3.2, 9.5], at: [0.5, 1.4, 1.5] }
  return null
}

export function Mars({ look, gender, kind, doing, storm }: { look: Look; gender: 'femme' | 'homme'; kind?: string; doing?: string; storm?: boolean }) {
  const shot = marsShot(kind, doing, storm)
  const rover = useRef<THREE.Group>(null)
  const eye = useRef(new THREE.Vector3(14, 7, 20))
  const at = useRef(new THREE.Vector3())
  const driving = kind === 'espace-rover' || doing === 'mars-rover'
  const indoors = (kind === 'espace-mars' || kind === 'espace-serre' || (storm && doing === 'join')) && doing !== 'mars-marcher' && doing !== 'mars-photo'
  const sunset = doing === 'mars-photo'
  const sky = storm ? '#c26a2e' : sunset ? '#6f8fc0' : '#d9a07a'
  useFrame(({ camera, clock }, dt) => {
    const t = clock.elapsedTime
    if (rover.current) {
      if (driving) {
        // Out to the delta and back, along the crater's floor.
        const u = (Math.sin(t * 0.06) + 1) / 2
        const x = 10 - u * 50
        const z = 14 - u * 4
        rover.current.position.set(x, Math.max(0, marsHeight(x, z)), z)
        rover.current.rotation.y = Math.cos(t * 0.06) > 0 ? -Math.PI / 2 : Math.PI / 2
        floater.pos.copy(rover.current.position).y += 2
        rover.current.updateMatrixWorld()
      } else {
        rover.current.position.set(-12, 0, 13)
        rover.current.rotation.y = 0.9
      }
    }
    // Out walking: from behind and above the Sim, the colony in the frame past it.
    // Driving: alongside the rover, a little ahead, on the driver behind the windscreen.
    const want = shot ? new THREE.Vector3(...shot.eye) : driving && rover.current ? rover.current.localToWorld(new THREE.Vector3(4.5, 3.2, 9)) : new THREE.Vector3(floater.pos.x + 9, floater.pos.y + 8, floater.pos.z + 17)
    const look_ = shot ? new THREE.Vector3(...shot.at) : driving && rover.current ? rover.current.localToWorld(new THREE.Vector3(0, 1.6, 1.4)) : floater.pos.clone().lerp(new THREE.Vector3(-2, 3, -2), 0.45)
    const k = 1 - Math.exp(-dt * 2.5)
    eye.current.lerp(want, k)
    at.current.lerp(look_, k)
    camera.position.copy(eye.current)
    camera.lookAt(at.current)
  })
  return (
    <StaticMerge version={`${kind ?? ''}|${doing ?? ''}|${storm ? 1 : 0}`}>
      <group>
        <color attach="background" args={[sky]} />
        {/* The sky itself, a dome of its colour (whatever the scene's background) */}
        <mesh>
          <sphereGeometry args={[420, 16, 10]} />
          <meshBasicMaterial color={sky} side={THREE.BackSide} fog={false} depthWrite={false} />
        </mesh>
        <fog attach="fog" args={[sky, storm ? 8 : 40, storm ? 60 : 170]} />
        <hemisphereLight args={[sunset ? '#9ab8e6' : '#ffe0c2', '#7a3418', 1.1]} />
        {sunset && <ambientLight intensity={0.6} color="#c5d6f2" />}
        <directionalLight position={sunset ? [-34, 10, -95] : [30, 40, 20]} intensity={storm ? 0.6 : 1.5} color={sunset ? '#a5c8ff' : '#fff1e0'} />
        <Sol height={marsHeight} colors={MARS_REDS} size={150} />
        {/* Rocks */}
        {Array.from({ length: 24 }, (_, i) => {
          const x = noise(i, 7) * 90 - 45
          const z = noise(i, 8) * 90 - 45
          if (Math.hypot(x, z) < 14) return null
          const s = 0.4 + noise(i, 9) * 1.2
          return <B key={i} p={[x, s / 2, z]} s={[s * 1.3, s, s]} c="#7d3a22" r={[0, noise(i, 10) * 3, 0]} />
        })}
        <Dome p={[0, 0, 0]} />
        {/* A habitat beside the dome, the tubes between them, their warm windows */}
        <group position={[-15, 0, 4]}>
          <B p={[0, 1.6, 0]} s={[6, 3.2, 4]} c="#f1f3f5" />
          <B p={[0, 3.3, 0]} s={[6.1, 0.3, 4.1]} c="#c92a2a" />
          {[-2, 0, 2].map((x) => (
            <B key={x} p={[x, 2, 2.02]} s={[0.9, 0.7, 0.05]} c="#ffe8a3" glow />
          ))}
          <B p={[4.6, 1.1, 0]} s={[3.2, 1.2, 1.2]} c="#dee2e6" />
        </group>
        <B p={[11.5, 1, 1]} s={[3.6, 1.1, 1.1]} c="#dee2e6" />
        {/* The landing pad of the Grande Pirogue, its lights */}
        <group position={[-22, 0.25, -18]}>
          <B p={[0, 0, 0]} s={[11, 0.2, 11]} c="#6b3b28" />
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2
            return <B key={i} p={[Math.cos(a) * 5, 0.2, Math.sin(a) * 5]} s={[0.3, 0.3, 0.3]} c="#ffd43b" glow />
          })}
        </group>
        {/* The agency's pennant (no country's flag) */}
        <group position={[6, 0, 9]}>
          <B p={[0, 1.6, 0]} s={[0.08, 3.2, 0.08]} c="#dee2e6" />
          {[0, 1, 2, 3].map((i) => (
            <B key={i} p={[0.12 + i * 0.22, 2.7, 0]} s={[0.22, 0.48 - i * 0.11, 0.03]} c={i % 2 ? '#ffffff' : '#ff7a00'} />
          ))}
        </group>
        {/* The rim of Jezero far off: mesas in the haze */}
        {Array.from({ length: 14 }, (_, i) => {
          const a = (i / 14) * Math.PI * 2 + 0.2
          const h = 8 + noise(i, 21) * 10
          return <B key={i} p={[Math.cos(a) * 95, h / 2 - 1, Math.sin(a) * 95]} s={[22 + noise(i, 22) * 14, h, 14]} c={i % 2 ? '#9c4a2c' : '#a65532'} r={[0, -a, 0]} />
        })}
        <pointLight position={[0, 4, 0]} intensity={16} distance={14} color="#ffe3b3" />
        <Serre p={[-4, 0.3, -2]} crop="#37b24d" crop2="#e8590c" />
        {/* The laboratory, beside the dome */}
        <group position={[14, 0, 2]}>
          <B p={[0, 1.4, 0]} s={[5, 2.8, 3.4]} c="#f1f3f5" />
          <B p={[0, 2.1, 1.72]} s={[3.6, 0.6, 0.05]} c="#4dabf7" glow />
          <B p={[0, 2.9, 0]} s={[5.1, 0.2, 3.5]} c="#c92a2a" />
          <B p={[-3.2, 1.2, 0]} s={[1.4, 0.4, 0.8]} c="#adb5bd" />
        </group>
        {/* Solar panels */}
        {[-16, -20, -24].map((x) => (
          <group key={x} position={[x, 0, 10]}>
            <B p={[0, 1.2, 0]} s={[0.15, 2.4, 0.15]} c="#adb5bd" />
            <B p={[0, 2.6, 0]} s={[3.2, 0.08, 2]} c="#1e3a8a" r={[0.4, 0, 0]} />
          </group>
        ))}
        {/* The Grande Pirogue, landed */}
        <group position={[-22, 0.4, -18]}>
          <Pirogue scale={1.6} />
        </group>
        <group ref={rover} userData={{ live: true }}>
          <RoverMars driver={driving} look={look} />
        </group>
        {!driving && !indoors && <Bondisseur look={look} gravity={MARS_G} at={[8, 0.3, 16]} radius={doing === 'mars-marcher' ? 7 : 2.5} />}
        {/* Inside the dome, out of the suit */}
        {indoors && (
          <group position={[1, 0.3, 3]} rotation={[0, 0.5, 0]}>
            <Character look={look} gender={gender} marker={false} pose={DOME_POSE[doing ?? ''] ?? 'idle'} />
          </group>
        )}
        {/* The small sun (or the blue sunset's glow) */}
        <B p={sunset ? [-34, 10, -95] : [80, 90, 30]} s={[3, 3, 3]} c={sunset ? '#d0ebff' : '#fff4e0'} glow />
        {storm && <Tempete />}
      </group>
    </StaticMerge>
  )
}
