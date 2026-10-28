import { useMemo, useState } from 'react'
import type { Sim } from '../lib/types'
import { Character } from './Character'
import { babyCare } from './HomeInside'
import { familyCast } from '../avatar/Family'
import { pusher } from './carer'

// Out of the house, a baby goes in its pram, and never on its own: maman
// pushes it (the nounou at the laté's, the gouvernante at the debout's,
// HomeInside babyCare); papa when she's cleaning up after the baby. The player steers as with any Sim; she walks behind,
// both hands on the handle. Facing +z like a Sim: the pram ahead, her behind.

function Box({ p, s, c }: { p: [number, number, number]; s: [number, number, number]; c: string }) {
  return (
    <mesh position={p} castShadow>
      <boxGeometry args={s} />
      <meshLambertMaterial color={c} />
    </mesh>
  )
}

/** The pram: four wheels, the frame, the seat, its hood at the back, the handle toward whoever pushes. */
function PramBody({ color }: { color: string }) {
  return (
    <group>
      {[-0.22, 0.22].map((x) =>
        [-0.24, 0.26].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.1, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.1, 0.1, 0.05, 14]} />
            <meshLambertMaterial color="#1b1b20" />
          </mesh>
        )),
      )}
      <Box p={[0, 0.22, 0]} s={[0.46, 0.04, 0.6]} c="#c3c7cf" />
      {/* The seat, deep, its cushion */}
      <Box p={[0, 0.42, 0]} s={[0.44, 0.3, 0.5]} c={color} />
      <Box p={[0, 0.58, 0.02]} s={[0.36, 0.03, 0.42]} c="#f8f9fa" />
      {/* The hood over the back, against the sun */}
      <Box p={[0, 0.78, -0.17]} s={[0.46, 0.34, 0.18]} c={color} />
      <Box p={[0, 0.94, -0.05]} s={[0.46, 0.04, 0.26]} c={color} />
      {/* The handle: two bars back and up, the grip across */}
      {[-0.2, 0.2].map((x) => (
        <Box key={x} p={[x, 0.75, -0.36]} s={[0.03, 0.55, 0.03]} c="#c3c7cf" />
      ))}
      <Box p={[0, 1.02, -0.42]} s={[0.46, 0.045, 0.045]} c="#1b1b20" />
    </group>
  )
}

/** sim: the player's own baby, or another player's (world3d/Players.tsx: other, its marker in their blue). */
export function Pram({ sim, walking, speed, other, moodColor }: { sim: Pick<Sim, 'look' | 'gender'> & { family?: string }; walking: boolean; speed?: number; other?: boolean; moodColor?: string }) {
  const care = useMemo(() => babyCare(sim.family || 'poignon', sim.look), [sim.family, sim.look])
  // Maman (or the nounou) busy cleaning up after the player's own baby: papa pushes (world3d/carer.ts).
  const [papa] = useState(() => !other && pusher() === 'papa')
  const dad = useMemo(() => familyCast(sim.family || 'poignon', sim.look).papa.look, [sim.family, sim.look])
  const color = care.carer === 'gouvernante' ? '#1f2a44' : care.carer === 'nounou' ? '#f783ac' : '#74c0fc'
  return (
    <group>
      <group position={[0, 0, 0.35]}>
        <PramBody color={color} />
        {/* The baby, sitting up in it */}
        <group position={[0, 0.5, 0.04]}>
          <Character look={sim.look} gender={sim.gender} stage="bebe" pose="idle" marker moodColor={moodColor} />
        </group>
      </group>
      {/* Behind it, pushing */}
      <group position={[0, 0, -0.42]}>
        <Character look={papa ? dad : care.mum} gender={papa ? 'homme' : 'femme'} stage="adulte" pose={walking ? 'push' : 'idle'} marker={false} seed={113} speed={speed} />
      </group>
    </group>
  )
}
