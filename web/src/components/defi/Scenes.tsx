import { Suspense, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Look } from '../../lib/types'
import type { Pose } from '../../avatar/Human'
import { Character } from '../../world3d/Character'
import { sceneDpr } from '../../lib/device'
import { t as tr } from '../../lib/i18n'

// What the perso is doing at each step of a played action (components/defi/Gestes.tsx), seen: the
// perso itself, the game's own 3D model in its clothes, making the gesture by the bed, at the
// mirror, under the shower. The scene moves on with the combination, `k` from 0 (the first arrow)
// to 1 (done): the blanket pulled up the bed, the foam growing, the light going out, the perso
// lying down.

export type SceneId = 'lit' | 'dents' | 'lumiere' | 'coucher' | 'eau' | 'savon' | 'dos' | 'shampooing' | 'rincer' | 'secher'

type Props = { id: SceneId; k: number; look?: Look; gender?: 'femme' | 'homme'; stage?: string }

export const DEFAULT_LOOK = { skin: '#6e4024', hair: 'short', hairColor: '#141010', outfit: 'casual', outfitColor: '#ff7a00', body: tr('moyen'), height: 1, eyes: '#2b1a10', beard: 'none', accessory: 'none', pattern: 'cercles', marks: 'none', wear: 'neuf' } as unknown as Look

/** The pose the perso holds at each step. */
const POSE: Record<SceneId, Pose> = { lit: 'busy', dents: 'brush', lumiere: 'busy', coucher: 'sleep', eau: 'wash', savon: 'wash', dos: 'wash', shampooing: 'wash', rincer: 'wash', secher: 'busy' }
const BED: SceneId[] = ['lit', 'coucher']
const SHOWER: SceneId[] = ['eau', 'savon', 'dos', 'shampooing', 'rincer', 'secher']

export function StepScene({ id, k, look, gender = 'homme', stage = 'adulte' }: Props) {
  const kk = Math.max(0, Math.min(1, k))
  const dark = id === 'lumiere' && kk >= 1
  return (
    <Canvas dpr={sceneDpr} camera={{ position: [2.2, 1.55, 2.7], fov: 34 }} onCreated={({ camera }) => camera.lookAt(0.2, 0.85, 0)} style={{ background: dark ? '#1d2147' : SHOWER.includes(id) ? '#dff1f8' : '#f6ead6' }}>
      <ambientLight intensity={dark ? 0.35 : 0.9} />
      <directionalLight position={[3, 5, 4]} intensity={dark ? 0.15 : 1.1} />
      <Suspense fallback={null}>
        <Room id={id} k={kk} />
        <Perso id={id} k={kk} look={look ?? DEFAULT_LOOK} gender={gender} stage={stage} />
      </Suspense>
    </Canvas>
  )
}

/** The perso, its pose, and for lying down, laid on the bed little by little. */
function Perso({ id, k, look, gender, stage }: { id: SceneId; k: number; look: Look; gender: 'femme' | 'homme'; stage: string }) {
  const g = useRef<THREE.Group>(null)
  useFrame((st) => {
    const o = g.current
    if (!o) return
    if (id === 'coucher') {
      // From standing by the bed to lying on it.
      o.position.set(-0.2 + 0.75 * k, 0.55 * k, 0)
      o.rotation.set(0, Math.PI / 2, 0)
      o.rotation.z = 0
      o.rotation.x = 0
      o.children[0]?.rotation.set(-Math.PI / 2 * k, 0, 0)
    } else if (id === 'lit') {
      // Bent over the bed, pulling the blanket up, a little to and fro.
      o.position.set(-0.35, 0, 0.55 + Math.sin(st.clock.elapsedTime * 3) * 0.04)
      o.rotation.set(0, Math.PI * 0.75, 0)
    } else if (id === 'dents') o.position.set(-0.1, 0, 0.3), o.rotation.set(0, Math.PI * 0.62, 0)
    else if (id === 'lumiere') o.position.set(-0.05, 0, 0.35), o.rotation.set(0, Math.PI * 0.62, 0)
    else o.position.set(0, 0, 0), o.rotation.set(0, Math.PI / 6, 0)
  })
  const pose: Pose = id === 'coucher' ? (k > 0.5 ? 'sleep' : 'idle') : POSE[id]
  const worn = SHOWER.includes(id) && id !== 'secher' ? ({ ...look, outfit: 'serviette', accessory: 'none' } as Look) : look
  return (
    <group ref={g}>
      <group>
        <Character look={worn} gender={gender} stage={stage} pose={pose} marker={false} />
      </group>
    </group>
  )
}

/** The room round the step: the bed and its blanket, the mirror and the basin, the switch, the shower. */
function Room({ id, k }: { id: SceneId; k: number }) {
  const t = useRef(0)
  useFrame((_, dt) => void (t.current += dt))
  if (BED.includes(id)) {
    const cover = id === 'lit' ? 0.15 + 0.85 * k : k >= 1 ? 0.7 : 0
    return (
      <group position={[0.75, 0, -0.1]}>
        <mesh position={[0, 0.22, 0]}>
          <boxGeometry args={[1.0, 0.3, 2.0]} />
          <meshLambertMaterial color="#8a5a32" />
        </mesh>
        <mesh position={[0, 0.42, 0]}>
          <boxGeometry args={[0.95, 0.12, 1.95]} />
          <meshLambertMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0, 0.55, -0.98]}>
          <boxGeometry args={[1.04, 0.6, 0.08]} />
          <meshLambertMaterial color="#6b4426" />
        </mesh>
        <mesh position={[0, 0.52, -0.75]} scale={[1, id === 'lit' && k > 0.8 ? 1.3 : 1, 1]}>
          <boxGeometry args={[0.6, 0.1, 0.3]} />
          <meshLambertMaterial color="#f4f1ea" />
        </mesh>
        {cover > 0 && (
          <mesh position={[0, 0.5, 0.95 - (1.6 * cover) / 2]}>
            <boxGeometry args={[0.98, 0.06, 1.6 * cover]} />
            <meshLambertMaterial color="#4dabf7" />
          </mesh>
        )}
      </group>
    )
  }
  if (id === 'dents')
    return (
      <group position={[0.5, 0, 0.12]} rotation={[0, Math.PI, 0]}>
        <mesh position={[0, 0.8, 0]}>
          <boxGeometry args={[0.1, 0.12, 0.6]} />
          <meshLambertMaterial color="#ffffff" />
        </mesh>
        <mesh position={[-0.05, 1.45, 0]}>
          <boxGeometry args={[0.04, 0.7, 0.55]} />
          <meshLambertMaterial color="#cfe8f2" />
        </mesh>
        {/* The foam growing round the mouth */}
        {[...Array(Math.round(k * 7))].map((_, i) => (
          <mesh key={i} position={[0.42, 1.38 + (i % 2) * 0.03, -0.06 + i * 0.02]}>
            <sphereGeometry args={[0.03, 8, 8]} />
            <meshLambertMaterial color="#ffffff" />
          </mesh>
        ))}
      </group>
    )
  if (id === 'lumiere') {
    const off = k >= 1
    return (
      <group>
        <mesh position={[0.5, 1.2, -0.6]}>
          <boxGeometry args={[0.04, 2.4, 1.2]} />
          <meshLambertMaterial color="#efe3cf" />
        </mesh>
        <mesh position={[0.47, 1.25, 0.12]}>
          <boxGeometry args={[0.03, 0.16, 0.1]} />
          <meshLambertMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0.45, off ? 1.21 : 1.29, 0.12]}>
          <boxGeometry args={[0.03, 0.05, 0.05]} />
          <meshLambertMaterial color="#2b2b2b" />
        </mesh>
        <mesh position={[0.3, 2.2, 0]}>
          <sphereGeometry args={[0.1, 12, 12]} />
          <meshBasicMaterial color={off ? '#3a3f6a' : '#ffe066'} />
        </mesh>
        {!off && <pointLight position={[0.3, 2.0, 0]} intensity={1.2} distance={4} color="#fff3bf" />}
      </group>
    )
  }
  // The shower: its head, the water falling, the bubbles (soap, shampoo) as far as they've got.
  const water = id === 'eau' ? k : id === 'secher' ? 0 : 1
  const foam = id === 'savon' ? k : id === 'dos' ? 0.6 : id === 'shampooing' ? 0.4 : id === 'rincer' ? 1 - k : 0
  return (
    <group>
      <mesh position={[0, 2.25, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.04, 16]} />
        <meshLambertMaterial color="#9aa1a8" />
      </mesh>
      {[...Array(Math.round(water * 14))].map((_, i) => (
        <mesh key={i} position={[Math.cos(i * 2.4) * 0.12, 1.45, Math.sin(i * 2.4) * 0.12]}>
          <cylinderGeometry args={[0.006, 0.006, 1.6, 4]} />
          <meshBasicMaterial color="#74c0fc" transparent opacity={0.7} />
        </mesh>
      ))}
      {[...Array(Math.round(foam * 12))].map((_, i) => (
        <mesh key={`f${i}`} position={[Math.cos(i * 1.7) * 0.2, 0.9 + (i % 4) * 0.15, Math.sin(i * 1.7) * 0.2]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshLambertMaterial color="#ffffff" />
        </mesh>
      ))}
      {id === 'shampooing' &&
        [...Array(Math.round(k * 9))].map((_, i) => (
          <mesh key={`h${i}`} position={[Math.cos(i * 0.7) * 0.11, 1.78 + (i % 3) * 0.04, Math.sin(i * 0.7) * 0.11]}>
            <sphereGeometry args={[0.055, 8, 8]} />
            <meshLambertMaterial color="#ffffff" />
          </mesh>
        ))}
      {id === 'secher' && (
        <mesh position={[0.05 + Math.sin(t.current * 6) * 0.1, 1.55, 0.18]} rotation={[0, 0, Math.sin(t.current * 6) * 0.3]}>
          <boxGeometry args={[0.5, 0.12, 0.04]} />
          <meshLambertMaterial color="#ff8fb1" />
        </mesh>
      )}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.6, 24]} />
        <meshLambertMaterial color="#c5dfe9" />
      </mesh>
    </group>
  )
}
