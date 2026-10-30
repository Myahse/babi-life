import * as THREE from 'three'
import { Box } from '../../../../world3d/props'
import type { PropId } from '../types'

// The games' objects, part D: the street's happenings (the update « evenements-joues »): the rain's
// puddle and its gbaka, the umbrella, the kids' plastic-bag rain hat, the generator of the power cut,
// the car stuck in the mud, the shop's ribbon, the gutter. Same voxel style as world3d.

type V = [number, number, number]

function Cyl({ p, rot, r, h, c, n = 10, o }: { p: V; rot?: V; r: [number, number]; h: number; c: string; n?: number; o?: number }) {
  return (
    <mesh position={p} rotation={rot} castShadow receiveShadow>
      <cylinderGeometry args={[r[0], r[1], h, n]} />
      <meshLambertMaterial color={c} flatShading transparent={o !== undefined} opacity={o ?? 1} />
    </mesh>
  )
}

/** A wheel, lying along x (the axle across z). */
function Wheel({ p, r = 0.16 }: { p: V; r?: number }) {
  return (
    <group position={p}>
      <Cyl p={[0, 0, 0]} rot={[Math.PI / 2, 0, 0]} r={[r, r]} h={0.12} c="#212529" n={12} />
      <Cyl p={[0, 0, 0]} rot={[Math.PI / 2, 0, 0]} r={[r * 0.5, r * 0.5]} h={0.13} c="#adb5bd" n={8} />
    </group>
  )
}

export const PROPS_D: Partial<Record<PropId, () => React.ReactElement>> = {
  /** A muddy puddle on the road, its little ripples. */
  flaque: () => (
    <group>
      <Cyl p={[0, 0.015, 0]} r={[0.46, 0.5]} h={0.03} c="#6b5a45" n={14} />
      <Cyl p={[0.03, 0.035, 0]} r={[0.38, 0.4]} h={0.02} c="#4dabf7" n={14} o={0.85} />
      <Cyl p={[-0.12, 0.05, 0.08]} r={[0.09, 0.09]} h={0.005} c="#d0ebff" n={12} />
      <Cyl p={[0.15, 0.05, -0.1]} r={[0.06, 0.06]} h={0.005} c="#d0ebff" n={12} />
    </group>
  ),

  /** The gbaka, the green and yellow minibus, its luggage on the roof. Lying along x, the front to +x. */
  gbaka: () => (
    <group>
      <Box p={[0, 0.42, 0]} s={[1.7, 0.56, 0.74]} c="#2f9e44" />
      <Box p={[0, 0.25, 0]} s={[1.72, 0.12, 0.76]} c="#fcc419" />
      <Box p={[0.05, 0.62, 0]} s={[1.3, 0.18, 0.76]} c="#a5d8ff" />
      {[-0.45, -0.1, 0.25].map((x) => (
        <Box key={x} p={[x, 0.62, 0]} s={[0.05, 0.19, 0.78]} c="#2f9e44" />
      ))}
      <Box p={[0.83, 0.55, 0]} s={[0.06, 0.26, 0.64]} c="#a5d8ff" />
      <Box p={[0.87, 0.32, 0.25]} s={[0.03, 0.07, 0.12]} c="#fff3bf" glow={0.6} />
      <Box p={[0.87, 0.32, -0.25]} s={[0.03, 0.07, 0.12]} c="#fff3bf" glow={0.6} />
      {/* The luggage on the roof */}
      <Box p={[-0.2, 0.8, 0]} s={[0.6, 0.14, 0.5]} c="#e8590c" />
      <Box p={[0.2, 0.78, 0.05]} s={[0.3, 0.1, 0.36]} c="#5f3dc4" />
      <Wheel p={[0.55, 0.16, 0.36]} />
      <Wheel p={[0.55, 0.16, -0.36]} />
      <Wheel p={[-0.55, 0.16, 0.36]} />
      <Wheel p={[-0.55, 0.16, -0.36]} />
    </group>
  ),

  /** A big open umbrella, in stripes. */
  parapluie: () => (
    <group>
      <Box p={[0, 0.4, 0]} s={[0.04, 0.8, 0.04]} c="#495057" />
      <Box p={[0.04, 0.03, 0]} s={[0.1, 0.04, 0.04]} c="#495057" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <mesh key={i} position={[0, 0.82, 0]} rotation={[0, (i * Math.PI) / 4, 0]} castShadow>
          <coneGeometry args={[0.5, 0.22, 2, 1, true, 0, Math.PI / 4]} />
          <meshLambertMaterial color={i % 2 ? '#e03131' : '#ffffff'} flatShading side={THREE.DoubleSide} />
        </mesh>
      ))}
      <Box p={[0, 0.95, 0]} s={[0.05, 0.08, 0.05]} c="#495057" />
    </group>
  ),

  /** The kids' rain hat: a black plastic bag, knotted on the head. */
  'sachet-pluie': () => (
    <group>
      <Box p={[0, 0.16, 0]} s={[0.5, 0.3, 0.4]} c="#212529" />
      <Box p={[0, 0.34, 0]} s={[0.38, 0.08, 0.3]} c="#343a40" />
      {/* The two handles, knotted */}
      <Box p={[-0.1, 0.42, 0]} s={[0.06, 0.12, 0.05]} c="#212529" />
      <Box p={[0.1, 0.42, 0]} s={[0.06, 0.12, 0.05]} c="#212529" />
      <Box p={[0, 0.47, 0]} s={[0.12, 0.06, 0.07]} c="#343a40" />
      <Box p={[0.16, 0.12, 0.21]} s={[0.08, 0.1, 0.01]} c="#868e96" />
    </group>
  ),

  /** The generator, red frame and tank, its pull cord. */
  'groupe-electrogene': () => (
    <group>
      <Box p={[0, 0.25, 0]} s={[0.8, 0.4, 0.5]} c="#c92a2a" />
      <Box p={[0, 0.5, 0]} s={[0.5, 0.12, 0.36]} c="#f03e3e" />
      <Box p={[-0.2, 0.25, 0.26]} s={[0.24, 0.2, 0.02]} c="#343a40" />
      <Box p={[0.2, 0.25, 0.26]} s={[0.18, 0.12, 0.02]} c="#ffd43b" />
      <Box p={[0.3, 0.6, 0]} s={[0.08, 0.08, 0.08]} c="#212529" />
      {[-0.38, 0.38].map((x) => (
        <Box key={x} p={[x, 0.3, 0]} s={[0.04, 0.6, 0.54]} c="#343a40" />
      ))}
      <Box p={[0, 0.03, 0]} s={[0.84, 0.06, 0.54]} c="#343a40" />
    </group>
  ),

  /** A little car, stuck: lying along x, the front to +x, mud up to its wheels. */
  voiture: () => (
    <group>
      <Box p={[0, 0.3, 0]} s={[1.3, 0.3, 0.64]} c="#f08c00" />
      <Box p={[-0.08, 0.53, 0]} s={[0.72, 0.2, 0.6]} c="#ffd8a8" />
      <Box p={[-0.08, 0.53, 0]} s={[0.6, 0.18, 0.62]} c="#a5d8ff" />
      <Box p={[0.66, 0.32, 0.2]} s={[0.02, 0.06, 0.1]} c="#fff3bf" glow={0.5} />
      <Box p={[0.66, 0.32, -0.2]} s={[0.02, 0.06, 0.1]} c="#fff3bf" glow={0.5} />
      <Wheel p={[0.4, 0.14, 0.33]} r={0.14} />
      <Wheel p={[0.4, 0.14, -0.33]} r={0.14} />
      <Wheel p={[-0.4, 0.14, 0.33]} r={0.14} />
      <Wheel p={[-0.4, 0.14, -0.33]} r={0.14} />
      <Box p={[0, 0.04, 0]} s={[1.5, 0.08, 0.9]} c="#6b5a45" />
    </group>
  ),

  /** The red ribbon of an opening, between two posts, its bow in the middle. */
  ruban: () => (
    <group>
      {[-0.42, 0.42].map((x) => (
        <Box key={x} p={[x, 0.35, 0]} s={[0.06, 0.7, 0.06]} c="#ced4da" />
      ))}
      <Box p={[0, 0.55, 0]} s={[0.84, 0.06, 0.02]} c="#e03131" />
      <Box p={[-0.07, 0.55, 0.01]} s={[0.12, 0.12, 0.03]} c="#c92a2a" r={0.5} />
      <Box p={[0.07, 0.55, 0.01]} s={[0.12, 0.12, 0.03]} c="#c92a2a" r={-0.5} />
      <Box p={[0, 0.55, 0.02]} s={[0.05, 0.06, 0.04]} c="#fa5252" />
    </group>
  ),

  /** A length of open gutter: its concrete sides, the dirty water in it. */
  caniveau: () => (
    <group>
      <Box p={[0, 0.06, -0.3]} s={[1.1, 0.12, 0.16]} c="#adb5bd" />
      <Box p={[0, 0.06, 0.3]} s={[1.1, 0.12, 0.16]} c="#adb5bd" />
      <Box p={[0, 0.01, 0]} s={[1.1, 0.02, 0.46]} c="#5c940d" />
      <Box p={[0, 0.03, 0]} s={[1.08, 0.02, 0.44]} c="#748c7a" />
    </group>
  ),
}
