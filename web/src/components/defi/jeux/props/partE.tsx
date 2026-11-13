import { Box } from '../../../../world3d/props'
import type { PropId } from '../types'

// The games' objects, part E: la cuisine ivoirienne (the update « cuisine-ivoire »): the mortar and its
// pestle, the canari of the kédjénou, the corn cob, the bread-omelette, the bissap bottle, the eggs, the
// palm nuts, the okra, the ginger, the yam, the beignets, the peanuts, the snail. Same voxel style.

type V = [number, number, number]

function Cyl({ p, r, h, c, top, seg = 10, rot }: { p: V; r: number; h: number; c: string; top?: number; seg?: number; rot?: V }) {
  return (
    <mesh position={p} rotation={rot} castShadow receiveShadow>
      <cylinderGeometry args={[top ?? r, r, h, seg]} />
      <meshLambertMaterial color={c} flatShading />
    </mesh>
  )
}

export const PROPS_E: Partial<Record<PropId, () => React.ReactElement>> = {
  /** The wooden mortar, wide at the top, on its foot; the foutou's dough inside. */
  mortier: () => (
    <>
      <Cyl p={[0, 0.08, 0]} r={0.26} top={0.2} h={0.16} c="#6b4426" />
      <Cyl p={[0, 0.27, 0]} r={0.18} top={0.24} h={0.22} c="#7a4e2c" />
      <Cyl p={[0, 0.5, 0]} r={0.26} top={0.36} h={0.24} c="#8a5a32" />
      <Cyl p={[0, 0.6, 0]} r={0.3} h={0.04} c="#f4e3a1" />
    </>
  ),
  /** The long pestle, standing. */
  pilon: () => (
    <>
      <Cyl p={[0, 0.12, 0]} r={0.09} h={0.24} c="#9a6a3c" />
      <Cyl p={[0, 0.6, 0]} r={0.05} h={0.8} c="#a97a48" />
      <Cyl p={[0, 1.08, 0]} r={0.09} h={0.18} c="#9a6a3c" />
    </>
  ),
  /** The clay canari, its belly, its lid of banana leaf. */
  canari: () => (
    <>
      <Cyl p={[0, 0.12, 0]} r={0.22} top={0.36} h={0.24} c="#8a4b2a" seg={12} />
      <Cyl p={[0, 0.34, 0]} r={0.36} top={0.24} h={0.2} c="#9c5a33" seg={12} />
      <Cyl p={[0, 0.48, 0]} r={0.2} top={0.22} h={0.08} c="#7a3f22" seg={12} />
      <Box p={[0, 0.54, 0]} s={[0.5, 0.03, 0.5]} c="#2f9e44" />
    </>
  ),
  /** A corn cob, lying along x, its kernels in rows, the husk at the end. */
  mais: () => (
    <>
      <Box p={[0, 0.12, 0]} s={[0.7, 0.22, 0.22]} c="#e8b32c" />
      {[-0.24, -0.08, 0.08, 0.24].map((x) => (
        <Box key={x} p={[x, 0.235, 0]} s={[0.06, 0.012, 0.2]} c="#c98a12" />
      ))}
      <Box p={[0.42, 0.12, 0]} s={[0.16, 0.16, 0.16]} c="#9bbf6a" />
    </>
  ),
  /** The half-baguette opened, its omelette, onion and chili. */
  omelette: () => (
    <>
      <Box p={[0, 0.1, 0]} s={[0.8, 0.2, 0.26]} c="#d9a35a" />
      <Box p={[0, 0.215, 0]} s={[0.74, 0.05, 0.22]} c="#ffd43b" />
      <Box p={[0.12, 0.25, 0.02]} s={[0.1, 0.03, 0.08]} c="#e9d8fd" />
      <Box p={[-0.18, 0.25, -0.02]} s={[0.05, 0.03, 0.05]} c="#e03131" />
    </>
  ),
  /** A bottle of bissap, deep red, its white cap. */
  bissap: () => (
    <>
      <Cyl p={[0, 0.28, 0]} r={0.14} h={0.56} c="#9c1c3a" />
      <Cyl p={[0, 0.62, 0]} r={0.06} top={0.08} h={0.12} c="#9c1c3a" />
      <Cyl p={[0, 0.71, 0]} r={0.07} h={0.05} c="#f1f3f5" />
    </>
  ),
  /** Three eggs. */
  oeuf: () => (
    <>
      {[-0.18, 0, 0.18].map((x, i) => (
        <Box key={x} p={[x, 0.12, i === 1 ? 0.06 : 0]} s={[0.16, 0.22, 0.16]} c="#f8f1e4" />
      ))}
    </>
  ),
  /** A pat of butter on its paper. */
  beurre: () => (
    <>
      <Box p={[0, 0.02, 0]} s={[0.5, 0.02, 0.4]} c="#f1f3f5" />
      <Box p={[0, 0.12, 0]} s={[0.36, 0.18, 0.26]} c="#ffe8a3" />
    </>
  ),
  /** A heap of palm nuts, red and black. */
  graine: () => (
    <>
      {[
        [-0.15, 0, 0],
        [0.12, 0, 0.05],
        [0, 0, -0.14],
        [-0.02, 0, 0.14],
        [0.02, 0.14, 0],
        [-0.1, 0.12, 0.06],
        [0.12, 0.12, -0.06],
      ].map(([x, y, z], i) => (
        <Box key={i} p={[x, 0.09 + y, z]} s={[0.15, 0.15, 0.15]} c={i % 3 === 0 ? '#3b1a0a' : i % 3 === 1 ? '#c2410c' : '#e8590c'} />
      ))}
    </>
  ),
  /** Okra pods, green and ridged. */
  gombo: () => (
    <>
      {[-0.16, 0, 0.16].map((z, i) => (
        <group key={z} position={[0, 0.07, z]} rotation={[0, (i - 1) * 0.3, 0]}>
          <Box p={[0, 0, 0]} s={[0.56, 0.12, 0.12]} c="#5c940d" />
          <Box p={[0.3, 0, 0]} s={[0.06, 0.06, 0.06]} c="#2b8a3e" />
        </group>
      ))}
    </>
  ),
  /** A knobbly ginger root. */
  gingembre: () => (
    <>
      <Box p={[0, 0.1, 0]} s={[0.46, 0.18, 0.2]} c="#d9b380" />
      <Box p={[0.18, 0.18, 0.08]} s={[0.16, 0.16, 0.14]} c="#c9a06a" />
      <Box p={[-0.16, 0.16, -0.06]} s={[0.14, 0.12, 0.14]} c="#c9a06a" />
    </>
  ),
  /** A yam, long and brown, cut open at one end. */
  igname: () => (
    <>
      <Box p={[0, 0.13, 0]} s={[0.8, 0.24, 0.26]} c="#7a5230" />
      <Box p={[0.41, 0.13, 0]} s={[0.02, 0.2, 0.22]} c="#f8f1e4" />
    </>
  ),
  /** Beignets in a heap. */
  beignet: () => (
    <>
      {[
        [-0.14, 0, 0],
        [0.12, 0, 0.06],
        [0, 0, -0.13],
        [0, 0.15, 0],
      ].map(([x, y, z], i) => (
        <Box key={i} p={[x, 0.1 + y, z]} s={[0.2, 0.18, 0.2]} c={i % 2 ? '#c8822d' : '#d9973a'} />
      ))}
    </>
  ),
  /** Roasted peanuts in a little paper cone. */
  arachide: () => (
    <>
      <Cyl p={[0, 0.2, 0]} r={0.06} top={0.22} h={0.4} c="#f1f3f5" />
      {[
        [-0.08, 0.02],
        [0.06, -0.04],
        [0.02, 0.07],
        [-0.03, -0.07],
      ].map(([x, z], i) => (
        <Box key={i} p={[x, 0.42, z]} s={[0.09, 0.06, 0.06]} c="#c49a6c" />
      ))}
    </>
  ),
  /** A big snail, its shell spiralling. */
  escargot: () => (
    <>
      <Box p={[0.05, 0.06, 0]} s={[0.7, 0.1, 0.2]} c="#a68a64" />
      <Box p={[-0.05, 0.27, 0]} s={[0.4, 0.34, 0.3]} c="#6b4a2b" />
      <Box p={[-0.05, 0.27, 0.16]} s={[0.22, 0.2, 0.02]} c="#3d2a17" />
      <Box p={[0.38, 0.17, 0]} s={[0.04, 0.16, 0.04]} c="#a68a64" />
    </>
  ),
}
