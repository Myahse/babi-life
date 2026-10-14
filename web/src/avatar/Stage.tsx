import { useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { Look, Sim } from '../lib/types'
import { Baby, Human, type Pose } from './Human'

// The creator's turntable: the Sim on a round podium, drag to spin it.
// `focus` glides the camera between the whole body and a close-up of the face.

export type Focus = 'body' | 'face' | 'outfit'

const SHOTS: Record<Focus, { y: number; dist: number }> = {
  body: { y: 0.92, dist: 4.4 },
  outfit: { y: 1.0, dist: 3.6 },
  face: { y: 1.5, dist: 1.25 },
}

function Rig({ focus, height }: { focus: Focus; height: number }) {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const camera = useThree((s) => s.camera)
  const want = useRef(new THREE.Vector3())
  useFrame((_, dt) => {
    if (!controls) return
    const shot = SHOTS[focus]
    const k = 1 - Math.exp(-dt * 5)
    controls.target.lerp(want.current.set(0, shot.y * height, 0), k)
    const dir = camera.position.clone().sub(controls.target).normalize()
    const dist = camera.position.distanceTo(controls.target)
    camera.position.copy(controls.target).add(dir.multiplyScalar(THREE.MathUtils.lerp(dist, shot.dist * height, k)))
    controls.update()
  })
  return null
}

export function Stage({ look, gender, focus = 'body', pose = 'idle', className = '', baby = false }: { look: Look; gender: Sim['gender']; focus?: Focus; pose?: Pose; className?: string; /** Show the Sim as the baby it will be born. */ baby?: boolean }) {
  const h = look.height ?? 1
  return (
    <Canvas className={className} shadows dpr={[1, 2]} camera={{ position: [0.9, 1.1, 4.3], fov: 28 }} gl={{ antialias: true, alpha: true }}>
      <hemisphereLight args={['#fff4e6', '#c0704f', 1.2]} />
      <directionalLight position={[2.5, 4, 3]} intensity={2.3} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-3, 2, -2]} intensity={0.9} color="#ffd1a6" />
      <ambientLight intensity={0.45} />
      <mesh position={[0, -0.04, 0]} receiveShadow>
        <cylinderGeometry args={[0.75, 0.82, 0.08, 64]} />
        <meshToonMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0, -0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.66, 0.74, 64]} />
        <meshBasicMaterial color="#ff9a2e" />
      </mesh>
      <ContactShadows position={[0, 0.001, 0]} opacity={0.35} scale={2.4} blur={2.5} far={1.5} />
      {baby ? (
        <group scale={2.6}>
          <Baby look={look} gender={gender} pose="busy" />
        </group>
      ) : (
        <Human look={look} gender={gender} pose={pose} />
      )}
      <OrbitControls makeDefault enablePan={false} enableZoom={false} minPolarAngle={1.05} maxPolarAngle={1.75} rotateSpeed={0.7} />
      <Rig focus={focus} height={h} />
    </Canvas>
  )
}
