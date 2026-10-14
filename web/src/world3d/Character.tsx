import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Look, Sim } from '../lib/types'
import { Baby, Human, type Pose } from '../avatar/Human'

// The player's Sim in the 3D neighbourhood: the same cartoon Sim as in the
// creator, with a shadow and the mood losange floating above.

type Props = { look: Look; gender: Sim['gender']; walking?: boolean; busy?: boolean; moodColor?: string; plumbob?: boolean; seed?: number; /** Stage of life: a baby crawls, children are small with big heads. */ stage?: string; /** A pose to act out (eating, dancing…); otherwise walking, busy or idle. */ pose?: Pose }

// Size and head for each stage of life (adults are 1).
const SIZE: Record<string, { scale: number; head: number; top: number }> = {
  bebe: { scale: 1, head: 1, top: 0.85 },
  enfant: { scale: 0.64, head: 1.3, top: 1.55 },
  ado: { scale: 0.9, head: 1.08, top: 2.05 },
}

export function Character({ look, gender, walking, busy, moodColor = '#00b86b', plumbob = true, seed = 0, stage = 'adulte', pose }: Props) {
  const doing: Pose = pose ?? (busy ? 'busy' : walking ? 'walk' : 'idle')
  const size = SIZE[stage] ?? { scale: 1, head: 1, top: 2.15 }
  const gem = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (!gem.current) return
    const t = clock.elapsedTime
    gem.current.rotation.y = t * 1.5
    gem.current.position.y = size.top + Math.sin(t * 2) * 0.05
  })
  return (
    <group>
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.32, 20]} />
        <meshBasicMaterial color="#000" transparent opacity={0.2} />
      </mesh>
      {stage === 'bebe' ? (
        <Baby look={look} gender={gender} pose={doing === 'walk' ? 'walk' : doing === 'idle' || doing === 'sit' ? 'idle' : 'busy'} seed={seed} />
      ) : (
        <group scale={size.scale}>
          <Human look={look} gender={gender} pose={doing} seed={seed} headScale={size.head} />
        </group>
      )}
      {plumbob && (
        <mesh ref={gem} position={[0, size.top, 0]}>
          <octahedronGeometry args={[0.14, 0]} />
          <meshLambertMaterial color={moodColor} emissive={moodColor} emissiveIntensity={0.55} flatShading />
        </mesh>
      )}
    </group>
  )
}
