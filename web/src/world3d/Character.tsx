import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Look, Sim } from '../lib/types'
import { Baby, Human, type Pose } from '../avatar/Human'
import { worldTime } from '../lib/worldClock'
import { lookAt } from '../avatar/options'

// The player's Sim in the 3D neighbourhood: the same blocky Sim as in the
// creator, with a shadow and the mood losange floating above.

type Props = { look: Look; gender: Sim['gender']; walking?: boolean; /** Running rather than walking. */ running?: boolean; busy?: boolean; moodColor?: string; marker?: boolean; seed?: number; /** Stage of life: a baby crawls, children are small with big heads. */ stage?: string; /** A pose to act out (eating, dancing…); otherwise walking, busy or idle. */ pose?: Pose }

// Size and head for each stage of life (adults are 1).
const SIZE: Record<string, { scale: number; head: number; top: number }> = {
  bebe: { scale: 1, head: 1, top: 0.85 },
  enfant: { scale: 0.64, head: 1.3, top: 1.55 },
  ado: { scale: 0.9, head: 1.08, top: 2.05 },
}

/** How big the Sim is at its stage of life (adults are 1): what it carries is sized the same. */
export const sizeOf = (stage = 'adulte') => SIZE[stage] ?? { scale: 1, head: 1, top: 2.15 }

export function Character({ look, gender, walking, running, busy, moodColor = '#00b86b', marker = true, seed = 0, stage = 'adulte', pose, speed }: Props & { /** How fast it moves (m/s): the steps follow. */ speed?: number }) {
  const doing: Pose = pose ?? (busy ? 'busy' : walking ? (running ? 'run' : 'walk') : 'idle')
  const size = sizeOf(stage)
  // What it wears, kept to its age: a baby's things come off when it grows up.
  const worn = useMemo(() => lookAt(look, stage), [look, stage])
  const gem = useRef<THREE.Group>(null)
  useFrame(() => {
    if (!gem.current) return
    const t = worldTime()
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
        <Baby look={worn} fitted gender={gender} pose={doing === 'walk' || doing === 'run' ? 'walk' : doing === 'idle' || doing === 'sit' ? 'idle' : doing === 'sleep' ? 'sleep' : 'busy'} seed={seed} />
      ) : (
        <group scale={size.scale}>
          <Human look={worn} fitted gender={gender} pose={doing} seed={seed} headScale={size.head} speed={speed} />
        </group>
      )}
      {marker && (
        // The game's marker: a little map pin in the colour of the mood, bobbing over the head.
        <group ref={gem} position={[0, size.top, 0]}>
          <mesh position={[0, 0.06, 0]}>
            <sphereGeometry args={[0.11, 14, 10]} />
            <meshLambertMaterial color={moodColor} emissive={moodColor} emissiveIntensity={0.55} />
          </mesh>
          <mesh position={[0, -0.07, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.1, 0.2, 14]} />
            <meshLambertMaterial color={moodColor} emissive={moodColor} emissiveIntensity={0.55} />
          </mesh>
          <mesh position={[0, 0.06, 0.1]}>
            <sphereGeometry args={[0.04, 10, 8]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        </group>
      )}
    </group>
  )
}
