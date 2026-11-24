import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// The Sims' animals (the update « animaux », components/AnimauxApp.tsx), in the game's blocks: the dog, the
// cat, the hens and their rooster, the Tabaski sheep. Each is alive: the dog wags its tail and pants (runs
// beside the Sim when it walks), the cat flicks its tail and blinks, the hens peck, the sheep chews. Sad
// (hungry, bored) they hang their heads. Sizes in metres, the front to +z, standing on y = 0.

export type PetMood = 'parti' | 'affame' | 'triste' | 'heureux' | 'ok'
type P = { p?: [number, number, number]; r?: number; mood?: PetMood; walking?: boolean; seed?: number; color?: string }

function B({ p, s, c }: { p: [number, number, number]; s: [number, number, number]; c: string }) {
  return (
    <mesh position={p} castShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} roughness={0.85} />
    </mesh>
  )
}

/** Four legs that trot when walking (front-left with back-right). */
function Legs({ legs, walking, h, c, speed = 9 }: { legs: [number, number][]; walking?: boolean; h: number; c: string; speed?: number }) {
  const refs = useRef<(THREE.Group | null)[]>([])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * speed
    refs.current.forEach((g, i) => {
      if (g) g.rotation.x = walking ? Math.sin(t + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.6 : 0
    })
  })
  return (
    <>
      {legs.map(([x, z], i) => (
        <group key={i} ref={(r) => void (refs.current[i] = r)} position={[x, h, z]}>
          <B p={[0, -h / 2, 0]} s={[0.09, h, 0.09]} c={c} />
        </group>
      ))}
    </>
  )
}

const sad = (m?: PetMood) => m === 'affame' || m === 'triste'

/** The dog: a short-haired village dog, the ears up, the tail wagging (faster happy), panting. */
export function Dog({ p = [0, 0, 0], r = 0, mood, walking, color = '#c08a4a' }: P) {
  const tail = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (tail.current) tail.current.rotation.y = Math.sin(t * (mood === 'heureux' ? 18 : sad(mood) ? 2 : 9)) * (sad(mood) ? 0.15 : 0.6)
    if (head.current) head.current.rotation.x = sad(mood) ? 0.45 : Math.sin(t * 1.3) * 0.08
    if (body.current) body.current.position.y = walking ? Math.abs(Math.sin(t * 9)) * 0.03 : Math.sin(t * 6) * 0.006
  })
  return (
    <group position={p} rotation={[0, r, 0]}>
      <group ref={body}>
        <Legs
          legs={[
            [-0.1, 0.2],
            [0.1, 0.2],
            [-0.1, -0.2],
            [0.1, -0.2],
          ]}
          walking={walking}
          h={0.28}
          c={color}
          speed={11}
        />
        <B p={[0, 0.36, 0]} s={[0.26, 0.2, 0.56]} c={color} />
        <group ref={head} position={[0, 0.48, 0.3]}>
          <B p={[0, 0.02, 0.04]} s={[0.22, 0.2, 0.2]} c={color} />
          <B p={[0, -0.03, 0.17]} s={[0.12, 0.1, 0.12]} c="#e8c79a" />
          <B p={[0, 0, 0.235]} s={[0.05, 0.04, 0.02]} c="#111" />
          <B p={[-0.07, 0.15, -0.01]} s={[0.05, 0.1, 0.04]} c={color} />
          <B p={[0.07, 0.15, -0.01]} s={[0.05, 0.1, 0.04]} c={color} />
          <B p={[-0.055, 0.06, 0.141]} s={[0.035, 0.035, 0.01]} c="#111" />
          <B p={[0.055, 0.06, 0.141]} s={[0.035, 0.035, 0.01]} c="#111" />
          {/* The tongue, panting when happy */}
          {mood === 'heureux' && <B p={[0, -0.08, 0.2]} s={[0.05, 0.02, 0.05]} c="#ff8fab" />}
        </group>
        <group ref={tail} position={[0, 0.42, -0.28]} rotation={[0.7, 0, 0]}>
          <B p={[0, 0.08, 0]} s={[0.05, 0.18, 0.05]} c={color} />
        </group>
      </group>
    </group>
  )
}

/** The cat: lean, the tail up and curling, the eyes that blink. */
export function CatPet({ p = [0, 0, 0], r = 0, mood, walking, color = '#868e96' }: P) {
  const tail = useRef<THREE.Group>(null)
  const eyes = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (tail.current) tail.current.rotation.z = Math.sin(t * 1.6) * 0.4
    if (eyes.current) eyes.current.scale.y = Math.sin(t * 0.9) > 0.97 ? 0.1 : 1
    if (head.current) head.current.rotation.x = sad(mood) ? 0.4 : 0
  })
  return (
    <group position={p} rotation={[0, r, 0]}>
      <Legs
        legs={[
          [-0.06, 0.12],
          [0.06, 0.12],
          [-0.06, -0.12],
          [0.06, -0.12],
        ]}
        walking={walking}
        h={0.16}
        c={color}
        speed={12}
      />
      <B p={[0, 0.22, 0]} s={[0.16, 0.13, 0.36]} c={color} />
      <group ref={head} position={[0, 0.31, 0.2]}>
        <B p={[0, 0, 0]} s={[0.16, 0.14, 0.13]} c={color} />
        <B p={[-0.05, 0.1, 0]} s={[0.04, 0.06, 0.03]} c={color} />
        <B p={[0.05, 0.1, 0]} s={[0.04, 0.06, 0.03]} c={color} />
        <group ref={eyes}>
          <B p={[-0.035, 0.02, 0.066]} s={[0.03, 0.03, 0.01]} c="#c0eb75" />
          <B p={[0.035, 0.02, 0.066]} s={[0.03, 0.03, 0.01]} c="#c0eb75" />
        </group>
        <B p={[0, -0.025, 0.067]} s={[0.025, 0.02, 0.01]} c="#ff8fab" />
      </group>
      <group ref={tail} position={[0, 0.26, -0.18]}>
        <B p={[0, 0.12, -0.02]} s={[0.035, 0.26, 0.035]} c={color} />
      </group>
    </group>
  )
}

/** A hen (or the rooster, its red comb and tail), pecking at the ground now and then. */
function Hen({ p, r = 0, rooster, seed = 0 }: { p: [number, number, number]; r?: number; rooster?: boolean; seed?: number }) {
  const neck = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed * 1.7
    // A peck every couple of seconds: the head down and up quick.
    const k = t % 2.4
    if (neck.current) neck.current.rotation.x = k < 0.3 ? Math.sin((k / 0.3) * Math.PI) * 1.1 : 0
  })
  const c = rooster ? '#a8501e' : '#f1e3c6'
  return (
    <group position={p} rotation={[0, r, 0]}>
      <B p={[-0.03, 0.06, 0]} s={[0.02, 0.12, 0.02]} c="#f08c00" />
      <B p={[0.03, 0.06, 0]} s={[0.02, 0.12, 0.02]} c="#f08c00" />
      <B p={[0, 0.17, 0]} s={[0.14, 0.12, 0.2]} c={c} />
      <B p={[0, 0.22, -0.11]} s={[0.1, rooster ? 0.16 : 0.08, 0.06]} c={rooster ? '#2b8a3e' : c} />
      <group ref={neck} position={[0, 0.22, 0.09]}>
        <B p={[0, 0.05, 0.02]} s={[0.08, 0.09, 0.08]} c={c} />
        <B p={[0, 0.04, 0.075]} s={[0.03, 0.02, 0.04]} c="#fab005" />
        <B p={[0, 0.11, 0.02]} s={[0.02, rooster ? 0.06 : 0.03, 0.05]} c="#e03131" />
      </group>
    </group>
  )
}

/** The hens of the yard: three hens and their rooster, scattered. */
export function Hens({ p = [0, 0, 0], r = 0 }: P) {
  return (
    <group position={p} rotation={[0, r, 0]}>
      <Hen p={[0, 0, 0]} rooster seed={0} />
      <Hen p={[0.35, 0, 0.2]} r={0.8} seed={1} />
      <Hen p={[-0.3, 0, 0.25]} r={-0.6} seed={2} />
      <Hen p={[0.15, 0, -0.35]} r={2.4} seed={3} />
    </group>
  )
}

/** The Tabaski sheep: the thick wool, the dark face and the curled horns of the ram, chewing. Fatter fed. */
export function Sheep({ p = [0, 0, 0], r = 0, mood, walking, seed = 0 }: P & { seed?: number }) {
  const jaw = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (jaw.current) jaw.current.position.x = Math.sin(t * 5) * 0.008
    if (head.current) head.current.rotation.x = sad(mood) ? 0.35 : 0.1
  })
  const fat = 1 + Math.min(0.35, seed * 0.03)
  return (
    <group position={p} rotation={[0, r, 0]}>
      <Legs
        legs={[
          [-0.12, 0.22],
          [0.12, 0.22],
          [-0.12, -0.22],
          [0.12, -0.22],
        ]}
        walking={walking}
        h={0.3}
        c="#3d2b1f"
        speed={7}
      />
      <group scale={[fat, 1, 1]}>
        <B p={[0, 0.48, 0]} s={[0.38, 0.32, 0.64]} c="#f1ede4" />
        <B p={[0, 0.62, 0]} s={[0.3, 0.06, 0.5]} c="#e9e2d0" />
      </group>
      <group ref={head} position={[0, 0.58, 0.36]}>
        <group ref={jaw}>
          <B p={[0, 0, 0.06]} s={[0.17, 0.18, 0.22]} c="#3d2b1f" />
        </group>
        <B p={[-0.045, 0.04, 0.17]} s={[0.03, 0.03, 0.01]} c="#fab005" />
        <B p={[0.045, 0.04, 0.17]} s={[0.03, 0.03, 0.01]} c="#fab005" />
        {/* The ram's horns, curled back */}
        {[-1, 1].map((sx) => (
          <group key={sx} position={[sx * 0.1, 0.07, 0]}>
            <B p={[sx * 0.04, 0.02, -0.02]} s={[0.07, 0.07, 0.12]} c="#a5876a" />
            <B p={[sx * 0.07, -0.05, 0.02]} s={[0.06, 0.08, 0.06]} c="#a5876a" />
          </group>
        ))}
      </group>
    </group>
  )
}

/** Any of them by its kind (the phone's yard, the house). */
export function PetModel({ kind, ...rest }: P & { kind: string }) {
  switch (kind) {
    case 'chien':
      return <Dog {...rest} />
    case 'chat':
      return <CatPet {...rest} />
    case 'poules':
      return <Hens {...rest} />
    case 'mouton':
      return <Sheep {...rest} />
  }
  return null
}
