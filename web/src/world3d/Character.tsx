import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Look, Sim } from '../lib/types'
import { Human } from '../avatar/Human'

// The player's Sim in the 3D neighbourhood: the same cartoon Sim as in the
// creator, with a shadow and the mood losange floating above.

type Props = { look: Look; gender: Sim['gender']; walking?: boolean; busy?: boolean; moodColor?: string; plumbob?: boolean; seed?: number }

export function Character({ look, gender, walking, busy, moodColor = '#00b86b', plumbob = true, seed = 0 }: Props) {
  const gem = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (!gem.current) return
    const t = clock.elapsedTime
    gem.current.rotation.y = t * 1.5
    gem.current.position.y = 2.15 + Math.sin(t * 2) * 0.05
  })
  return (
    <group>
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.32, 20]} />
        <meshBasicMaterial color="#000" transparent opacity={0.2} />
      </mesh>
      <Human look={look} gender={gender} pose={busy ? 'busy' : walking ? 'walk' : 'idle'} seed={seed} />
      {plumbob && (
        <mesh ref={gem} position={[0, 2.15, 0]}>
          <octahedronGeometry args={[0.14, 0]} />
          <meshLambertMaterial color={moodColor} emissive={moodColor} emissiveIntensity={0.55} flatShading />
        </mesh>
      )}
    </group>
  )
}
