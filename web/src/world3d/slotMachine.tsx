import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { worldTime } from '../lib/worldClock'
import { lettering } from './open/ruePrincesse'
import { Box } from './props'

// The slot machine in the corner of a maquis (backend game/slots.go): a red
// cabinet with gold trim, its lit sign on top, three reels behind the glass
// changing their colours, the lever on its side, the coin tray. Its front is
// +z, as the room turns it.

const REEL_COLOURS = ['#ffd23f', '#ff8a1f', '#2e9e44', '#e3132c', '#8a93a2', '#c8651d']

export function SlotMachine({ p, r = 0 }: { p: [number, number, number]; r?: number }) {
  const reels = useRef<(THREE.MeshBasicMaterial | null)[]>([])
  const sign = useRef<THREE.MeshBasicMaterial>(null)
  const word = useMemo(() => lettering('JACKPOT', '#2a030a', '#ffd23f', '#ffd23f'), [])
  useFrame(() => {
    const t = worldTime()
    // The reels turn over now and then, as in its attract mode; the sign blinks.
    reels.current.forEach((m, i) => m?.color.set(REEL_COLOURS[Math.floor(t * 1.3 + i * 2.7) % REEL_COLOURS.length]))
    sign.current?.color.setHSL(0.12, 1, Math.floor(t * 2) % 2 ? 0.62 : 0.45)
  })
  return (
    <group position={p} rotation={[0, r, 0]}>
      {/* The cabinet, its trim, the sloped panel with the buttons */}
      <Box p={[0, 0.8, 0]} s={[0.72, 1.6, 0.6]} c="#b3001a" />
      <Box p={[0, 0.06, 0.02]} s={[0.78, 0.12, 0.66]} c="#2a030a" />
      <Box p={[0, 1.62, 0]} s={[0.78, 0.06, 0.66]} c="#d9a520" />
      <Box p={[0, 0.98, 0.33]} s={[0.66, 0.08, 0.14]} c="#d9a520" />
      {[-0.18, 0, 0.18].map((x, i) => (
        <Box key={x} p={[x, 1.03, 0.36]} s={[0.1, 0.03, 0.06]} c={['#ff3d57', '#ffd23f', '#2bd46a'][i]} glow={0.6} />
      ))}
      {/* The glass with the three reels */}
      <Box p={[0, 1.3, 0.301]} s={[0.6, 0.36, 0.01]} c="#2a030a" />
      {[-0.19, 0, 0.19].map((x, i) => (
        <mesh key={x} position={[x, 1.3, 0.31]}>
          <planeGeometry args={[0.16, 0.28]} />
          <meshBasicMaterial
            ref={(m) => {
              reels.current[i] = m
            }}
            color="#ffd23f"
            toneMapped={false}
          />
        </mesh>
      ))}
      {/* The lit sign on top, JACKPOT on its front */}
      <mesh position={[0, 1.84, 0.05]}>
        <boxGeometry args={[0.72, 0.36, 0.42]} />
        <meshBasicMaterial ref={sign} color="#ffb020" toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.84, 0.262]}>
        <planeGeometry args={[0.62, 0.62 / word.aspect]} />
        <meshBasicMaterial map={word.t} toneMapped={false} />
      </mesh>
      {/* The coin tray, the lever on the right side */}
      <Box p={[0, 0.42, 0.31]} s={[0.4, 0.12, 0.08]} c="#c9ccd6" />
      <Box p={[0.4, 1.1, 0]} s={[0.05, 0.5, 0.05]} c="#c9ccd6" />
      <mesh position={[0.4, 1.38, 0]}>
        <sphereGeometry args={[0.07, 12, 8]} />
        <meshLambertMaterial color="#e3132c" />
      </mesh>
    </group>
  )
}
