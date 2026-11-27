import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Sim } from '../../lib/types'
import { Character } from '../Character'
import { Box } from '../props'
import { Suited } from '../../components/espace/jeux/common'
import { buildCalao } from './calao'

// Le Centre d'entraînement Astrélia (Sassandra; backend game/espaceCarriere.go, kind « astrelia-entrainement »):
// its great hall cut away in blocks: the centrifuge's long arm turning, the pool with the station's mock-up under
// water, the Pirogue simulator, the classroom of the concours, the canteen; through the bay window, the Calao on
// its pad at the end of the beach. The agency's pennant on the wall (no national flag). Trainees in the
// Astrélia suit go about; the Sim stands where what it does is done.

/** Where each part of the hall is (x, z), and what's done there. */
const SPOTS: Record<string, { p: [number, number, number]; r: number }> = {
  centri: { p: [-4.2, 0, 1.6], r: 0.6 },
  piscine: { p: [3.6, 0, 2.6], r: -0.4 },
  simu: { p: [0.2, 0, -1.6], r: 0 },
  classe: { p: [-3.6, 0, -2.6], r: 0.3 },
  cantine: { p: [4.6, 0, -2.4], r: -0.6 },
  entree: { p: [0, 0, 4.2], r: Math.PI },
}
const spotOf = (id?: string) =>
  !id ? 'entree' : /centrifugeuse/.test(id) ? 'centri' : /piscine|survie/.test(id) ? 'piscine' : /parabolique|physique|work/.test(id) ? 'simu' : /concours|systemes|medicale/.test(id) ? 'classe' : /cantine|douche|chambre/.test(id) ? 'cantine' : 'entree'

function Centrifuge({ fast }: { fast: boolean }) {
  const arm = useRef<THREE.Group>(null)
  useFrame((_, dt) => void (arm.current && (arm.current.rotation.y += dt * (fast ? 3.2 : 0.5))))
  return (
    <group position={[-5.6, 0, 0.6]}>
      <Box p={[0, 0.03, 0]} s={[5.6, 0.06, 5.6]} c="#adb5bd" />
      <Box p={[0, 0.5, 0]} s={[0.8, 1, 0.8]} c="#495057" />
      <group ref={arm} position={[0, 1.05, 0]}>
        <Box p={[1.2, 0, 0]} s={[2.4, 0.2, 0.26]} c="#868e96" />
        <Box p={[-0.6, 0, 0]} s={[1.2, 0.2, 0.26]} c="#868e96" />
        <Box p={[-1.2, 0, 0]} s={[0.5, 0.5, 0.5]} c="#343a40" />
        <Box p={[2.5, 0, 0]} s={[0.8, 0.8, 0.7]} c="#ffffff" />
        <Box p={[2.5, 0, 0.36]} s={[0.4, 0.34, 0.02]} c="#74c0fc" />
        <Box p={[2.5, -0.42, 0]} s={[0.86, 0.08, 0.76]} c="#ff7a00" />
      </group>
    </group>
  )
}

function Pool() {
  const diver = useRef<THREE.Group>(null)
  useFrame(({ clock }) => void (diver.current && (diver.current.position.y = -0.7 + Math.sin(clock.elapsedTime * 0.7) * 0.12)))
  return (
    <group position={[4.4, 0, 1]}>
      {/* The rim, the water, the station's mock-up down in it */}
      <Box p={[0, 0.15, 0]} s={[4.6, 0.3, 4.2]} c="#e9ecef" />
      <mesh position={[0, 0.16, 0]}>
        <boxGeometry args={[4, 0.3, 3.6]} />
        <meshLambertMaterial color="#339af0" transparent opacity={0.75} />
      </mesh>
      <Box p={[0, -0.5, -0.4]} s={[3, 0.9, 1]} c="#f1f3f5" />
      <Box p={[0, -0.04, -0.4]} s={[3, 0.06, 1.02]} c="#ff7a00" />
      <group ref={diver} position={[0.6, -0.7, 0.6]} rotation={[0, 0, Math.PI / 2]} scale={0.5}>
        <Suited pose="float" />
      </group>
      {[...Array(5)].map((_, i) => (
        <Box key={i} p={[-1.5 + i * 0.75, 0.33, 1.2 - (i % 2) * 0.8]} s={[0.4, 0.02, 0.08]} c="#a5d8ff" />
      ))}
    </group>
  )
}

/** The Pirogue simulator: the capsule's cabin on its jacks, a console beside it. */
function Simulator() {
  return (
    <group position={[0.2, 0, -3.2]}>
      {[-0.7, 0.7].map((x) => (
        <Box key={x} p={[x, 0.35, 0]} s={[0.2, 0.7, 0.2]} c="#868e96" />
      ))}
      <Box p={[0, 1.4, 0]} s={[1.9, 1.5, 1.9]} c="#1c3d6e" />
      <Box p={[0, 2.3, 0]} s={[1.2, 0.35, 1.2]} c="#274b80" />
      <Box p={[0, 1.45, 0.96]} s={[0.7, 0.6, 0.03]} c="#0b1a30" />
      <Box p={[0, 1.95, 0.96]} s={[0.9, 0.1, 0.03]} c="#ff7a00" />
      <Box p={[1.8, 0.5, 0.6]} s={[1, 1, 0.6]} c="#343a40" />
      <Box p={[1.8, 1.05, 0.62]} s={[0.8, 0.4, 0.05]} c="#69db7c" glow={0.6} />
    </group>
  )
}

/** The classroom: the desks of the concours, the board. */
function Classroom() {
  return (
    <group position={[-4.4, 0, -3.8]}>
      <Box p={[0, 1.6, -0.9]} s={[3.2, 1.4, 0.1]} c="#2b3a2e" />
      {[-1, 0, 1].map((x) =>
        [0, 1].map((z) => (
          <group key={`${x}${z}`} position={[x * 1.1, 0, z * 1.1]}>
            <Box p={[0, 0.7, 0]} s={[0.8, 0.06, 0.5]} c="#c08a52" />
            <Box p={[0, 0.35, 0]} s={[0.08, 0.7, 0.08]} c="#868e96" />
            <Box p={[0.05, 0.74, 0.02]} s={[0.3, 0.01, 0.22]} c="#f8f9fa" />
          </group>
        )),
      )}
    </group>
  )
}

function Hall() {
  return (
    <group>
      {/* The floor (light lino, a stripe of the agency's orange to the doors) */}
      <Box p={[0, -0.1, 0]} s={[16, 0.2, 12]} c="#dee2e6" />
      <Box p={[0, 0.005, 3.5]} s={[1.2, 0.01, 5]} c="#ff922b" />
      {/* The back wall: the bay window on the sea and the pad */}
      <Box p={[-5.6, 2.5, -6]} s={[4.8, 5, 0.3]} c="#f1f3f5" />
      <Box p={[5.6, 2.5, -6]} s={[4.8, 5, 0.3]} c="#f1f3f5" />
      <Box p={[0, 4.6, -6]} s={[6.4, 0.8, 0.3]} c="#f1f3f5" />
      <Box p={[0, 0.3, -6]} s={[6.4, 0.6, 0.3]} c="#f1f3f5" />
      <mesh position={[0, 2.4, -6]}>
        <boxGeometry args={[6.4, 3.6, 0.05]} />
        <meshLambertMaterial color="#a5d8ff" transparent opacity={0.25} />
      </mesh>
      {/* The left wall, its pennant: the agency's own, the Calao's silhouette on orange */}
      <Box p={[-8, 2.5, 0]} s={[0.3, 5, 12]} c="#e9ecef" />
      <group position={[-7.8, 3.2, -1]}>
        <Box p={[0, 0, 0]} s={[0.05, 1.4, 2.2]} c="#1c3d6e" />
        <Box p={[0.03, 0, 0]} s={[0.04, 1.1, 0.5]} c="#ff7a00" />
        <Box p={[0.03, 0.62, 0]} s={[0.04, 0.12, 0.2]} c="#ffffff" />
      </group>
      {/* The canteen's counter, right */}
      <group position={[5.6, 0, -3.6]}>
        <Box p={[0, 0.5, 0]} s={[3, 1, 0.8]} c="#ced4da" />
        <Box p={[0, 1.02, 0]} s={[3, 0.06, 0.9]} c="#ff7a00" />
        {[-1, 0, 1].map((x) => (
          <Box key={x} p={[x, 1.12, 0]} s={[0.5, 0.12, 0.4]} c="#f8f9fa" />
        ))}
      </group>
    </group>
  )
}

/** The Calao far off on its pad: the agency's kit (calao.ts), a quarter of its size. */
function FarCalao() {
  const calao = useMemo(() => buildCalao('calao-1'), [])
  return <primitive object={calao.root} scale={0.25} />
}

/** Outside the bay window: the beach, the sea, the Calao on its pad with its tower. */
function Outside() {
  return (
    <group position={[0, 0, -16]}>
      <Box p={[0, -0.2, 0]} s={[60, 0.2, 16]} c="#e6cf9c" />
      <Box p={[0, -0.25, -14]} s={[80, 0.1, 14]} c="#1c7ed6" />
      <group position={[3, 0, -4]}>
        <FarCalao />
        <Box p={[2.4, 6, 0]} s={[0.8, 12, 0.8]} c="#c92a2a" />
      </group>
      <mesh position={[0, 20, -30]}>
        <planeGeometry args={[120, 60]} />
        <meshBasicMaterial color="#9fd3ff" />
      </mesh>
    </group>
  )
}

function Trainees() {
  const a = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (a.current) {
      a.current.position.x = -1.5 + Math.sin(t * 0.25) * 2.2
      a.current.rotation.y = Math.cos(t * 0.25) > 0 ? Math.PI / 2 : -Math.PI / 2
    }
  })
  return (
    <>
      <group ref={a} position={[-1.5, 0, 1.6]}>
        <Suited />
      </group>
      <group position={[1.6, 0, -1.4]} rotation={[0, -0.6, 0]}>
        <Suited />
      </group>
    </>
  )
}

export function CentreEntrainement({ sim, interactionId, night }: { sim: Sim; interactionId?: string; night?: boolean }) {
  const s = SPOTS[spotOf(interactionId)]
  return (
    <div className="absolute inset-0" data-centre-entrainement>
      <Canvas dpr={[1, 1.75]} shadows camera={{ fov: 50, near: 0.1, far: 400, position: [s.p[0] + 4, 7.5, s.p[2] + 11] }}>
        <color attach="background" args={[night ? '#0d1b2a' : '#cfe8ff']} />
        <hemisphereLight args={['#ffffff', '#8c9aa8', night ? 0.6 : 1.1]} />
        <directionalLight position={[6, 12, 8]} intensity={night ? 0.5 : 1.3} castShadow />
        <Hall />
        <Outside />
        <Centrifuge fast={/centrifugeuse/.test(interactionId ?? '')} />
        <Pool />
        <Simulator />
        <Classroom />
        <Trainees />
        <group position={s.p} rotation={[0, s.r, 0]}>
          <Character look={sim.look} gender={sim.gender} marker={false} pose={interactionId ? 'busy' : 'idle'} />
        </group>
        <OrbitControls makeDefault target={[s.p[0] * 0.5, 1, s.p[2] * 0.5]} enablePan={false} minDistance={5} maxDistance={22} minPolarAngle={0.35} maxPolarAngle={1.3} enableDamping />
      </Canvas>
    </div>
  )
}
