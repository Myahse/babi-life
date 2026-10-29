import type { PropId } from '../types'
import * as THREE from 'three'
import { Box } from '../../../../world3d/props'

// The games' objects 68..127: clothes, beauty, the house and cleaning, health, work tools.
// In the game's blocks (Box), a few round meshes where the shape needs it; ~1 unit, on y = 0, front to +z.

type V = [number, number, number]
const PI = Math.PI

/** A flat-shaded mesh around the geometry given as its child. */
function M({ p, r, sc, c, glow, children }: { p: V; r?: V; sc?: V; c: string; glow?: number; children: React.ReactNode }) {
  return (
    <mesh position={p} rotation={r ?? [0, 0, 0]} scale={sc ?? [1, 1, 1]} castShadow receiveShadow>
      {children}
      <meshLambertMaterial color={c} flatShading emissive={glow ? c : '#000'} emissiveIntensity={glow ?? 0} />
    </mesh>
  )
}

/** A flat cut-out laid on the floor: the outline as (x, z) points, extruded up by t. */
function flat(pts: [number, number][], t: number) {
  const sh = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)))
  const g = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false })
  g.rotateX(-PI / 2)
  return g
}

/** A sleeveless dress laid flat: straps, bodice, the skirt flaring to the hem at +z. */
const DRESS = flat([[-0.2, -0.5], [-0.12, -0.5], [-0.06, -0.4], [0.06, -0.4], [0.12, -0.5], [0.2, -0.5], [0.3, -0.42], [0.24, -0.3], [0.17, -0.12], [0.48, 0.44], [-0.48, 0.44], [-0.17, -0.12], [-0.24, -0.3], [-0.3, -0.42]], 0.08)

/** One sneaker, toe to +z. */
function Shoe({ x, c }: { x: number; c: string }) {
  return (
    <group position={[x, 0, 0]}>
      <Box p={[0, 0.04, 0]} s={[0.28, 0.08, 0.78]} c="#f8f9fa" />
      <Box p={[0, 0.2, -0.14]} s={[0.26, 0.24, 0.46]} c={c} />
      <Box p={[0, 0.13, 0.22]} s={[0.26, 0.1, 0.32]} c={c} />
      <Box p={[0, 0.33, -0.33]} s={[0.24, 0.06, 0.1]} c="#212529" />
      {[0, 1, 2].map((i) => <Box key={i} p={[0, 0.33 - i * 0.05, -0.02 + i * 0.07]} s={[0.18, 0.03, 0.04]} c="#fff" />)}
      <Box p={[x > 0 ? 0.135 : -0.135, 0.18, -0.12]} s={[0.02, 0.06, 0.32]} c="#fff" />
    </group>
  )
}

export const PROPS_B: Partial<Record<PropId, () => React.ReactElement>> = {
  /** A folded wax-print pagne: bright blocks in a repeat, the folds on the front. */
  pagne: () => (
    <group>
      <Box p={[0, 0.13, 0]} s={[0.9, 0.26, 0.64]} c="#f08c00" />
      {[-1, 0, 1].flatMap((i) => [0, 1].map((j) => (
        <group key={`${i}${j}`}>
          <Box p={[i * 0.29, 0.265, -0.15 + j * 0.3]} s={[0.2, 0.02, 0.2]} c={(i + j) % 2 ? '#1971c2' : '#2f9e44'} />
          <Box p={[i * 0.29, 0.28, -0.15 + j * 0.3]} s={[0.08, 0.02, 0.08]} c="#ffd43b" />
        </group>
      )))}
      {[-1, 0, 1].map((i) => <Box key={i} p={[i * 0.29, 0.13, 0.322]} s={[0.2, 0.2, 0.01]} c={i % 2 ? '#1971c2' : '#c2255c'} />)}
      <Box p={[0, 0.09, 0.33]} s={[0.92, 0.02, 0.02]} c="#7c2d12" />
      <Box p={[0, 0.18, 0.33]} s={[0.92, 0.02, 0.02]} c="#7c2d12" />
    </group>
  ),
  /** A dress laid flat: the cut-out, a belt, flowers along the hem. */
  robe: () => (
    <group>
      <mesh geometry={DRESS} castShadow receiveShadow><meshLambertMaterial color="#e64980" flatShading /></mesh>
      <Box p={[0, 0.09, -0.13]} s={[0.36, 0.03, 0.07]} c="#ffd43b" />
      {[-0.28, -0.1, 0.1, 0.28].map((x) => <Box key={x} p={[x, 0.09, 0.3]} s={[0.09, 0.02, 0.09]} c="#fff" r={PI / 4} />)}
      {[-0.19, 0, 0.19].map((x) => <Box key={x} p={[x, 0.09, 0.12]} s={[0.07, 0.02, 0.07]} c="#ffd43b" r={PI / 4} />)}
    </group>
  ),
  /** A folded shirt as in a shop: collar, placket and buttons, pocket. */
  chemise: () => (
    <group>
      <Box p={[0, 0.06, 0.04]} s={[0.66, 0.12, 0.78]} c="#74c0fc" />
      <Box p={[0, 0.13, -0.3]} s={[0.36, 0.04, 0.1]} c="#e7f5ff" />
      <Box p={[-0.09, 0.14, -0.22]} s={[0.18, 0.04, 0.14]} c="#e7f5ff" r={0.6} />
      <Box p={[0.09, 0.14, -0.22]} s={[0.18, 0.04, 0.14]} c="#e7f5ff" r={-0.6} />
      <Box p={[0, 0.125, 0.1]} s={[0.06, 0.02, 0.6]} c="#4dabf7" />
      {[0, 1, 2, 3].map((i) => <Box key={i} p={[0, 0.14, -0.1 + i * 0.13]} s={[0.04, 0.02, 0.04]} c="#fff" />)}
      <Box p={[-0.18, 0.125, -0.02]} s={[0.16, 0.02, 0.16]} c="#4dabf7" />
    </group>
  ),
  /** A wide grand boubou laid flat, its gold embroidery round the neck and down the chest. */
  boubou: () => (
    <group>
      <Box p={[0, 0.03, -0.18]} s={[1.18, 0.06, 0.46]} c="#1864ab" />
      <Box p={[0, 0.03, 0.16]} s={[0.66, 0.06, 0.62]} c="#1864ab" />
      <Box p={[0, 0.07, -0.3]} s={[0.3, 0.02, 0.2]} c="#fcc419" />
      <Box p={[0, 0.08, -0.3]} s={[0.16, 0.02, 0.1]} c="#0b2e59" />
      <Box p={[0, 0.07, 0.02]} s={[0.12, 0.02, 0.44]} c="#fcc419" />
      {[-1, 1].map((k) => <Box key={k} p={[k * 0.12, 0.07, -0.08]} s={[0.06, 0.02, 0.06]} c="#fcc419" r={PI / 4} />)}
      {[-1, 1].map((k) => <Box key={k} p={[k * 0.55, 0.065, -0.18]} s={[0.04, 0.01, 0.46]} c="#fcc419" />)}
    </group>
  ),
  /** A pair of sneakers. */
  chaussure: () => (
    <group>
      <Shoe x={-0.17} c="#e03131" />
      <Shoe x={0.17} c="#e03131" />
    </group>
  ),
  /** A handbag: flap, gold clasp, round handle. */
  sac: () => (
    <group>
      <Box p={[0, 0.22, 0]} s={[0.72, 0.44, 0.3]} c="#a5432a" />
      <Box p={[0, 0.36, 0.11]} s={[0.74, 0.18, 0.1]} c="#7a2e1c" />
      <Box p={[0, 0.28, 0.165]} s={[0.1, 0.08, 0.02]} c="#fcc419" />
      <M p={[0, 0.44, 0]} c="#7a2e1c"><torusGeometry args={[0.22, 0.035, 6, 14, PI]} /></M>
    </group>
  ),
  /** A cap: the dome, the brim to the front, the button on top. */
  casquette: () => (
    <group>
      <M p={[0, 0, -0.05]} c="#e03131"><sphereGeometry args={[0.34, 10, 6, 0, PI * 2, 0, PI / 2]} /></M>
      <Box p={[0, 0.03, 0.36]} s={[0.5, 0.04, 0.32]} c="#c92a2a" />
      <Box p={[0, 0.34, -0.05]} s={[0.07, 0.04, 0.07]} c="#fff" />
      <Box p={[0, 0.18, 0.28]} s={[0.2, 0.1, 0.02]} c="#fff" />
    </group>
  ),
  /** Sunglasses standing on their arms. */
  lunettes: () => (
    <group>
      {[-0.22, 0.22].map((x) => (
        <group key={x}>
          <M p={[x, 0.19, 0.2]} r={[PI / 2, 0, 0]} c="#212529"><cylinderGeometry args={[0.17, 0.17, 0.04, 10]} /></M>
          <M p={[x, 0.19, 0.21]} c="#e03131"><torusGeometry args={[0.17, 0.03, 5, 12]} /></M>
          <M p={[x * 1.82, 0.16, -0.1]} r={[0.35, 0, 0]} c="#e03131"><boxGeometry args={[0.04, 0.04, 0.62]} /></M>
        </group>
      ))}
      <Box p={[0, 0.27, 0.21]} s={[0.12, 0.04, 0.04]} c="#e03131" />
      <Box p={[-0.26, 0.24, 0.235]} s={[0.06, 0.04, 0.01]} c="#868e96" />
    </group>
  ),
  /** A wristwatch laid flat: the strap, the gold case, the hands. */
  montre: () => (
    <group>
      <Box p={[0, 0.02, 0]} s={[0.2, 0.04, 0.92]} c="#5c3a21" />
      {[-0.3, -0.36].map((z) => <Box key={z} p={[0, 0.045, z]} s={[0.04, 0.01, 0.03]} c="#2b1a0e" />)}
      <M p={[0, 0.05, 0]} c="#fcc419"><cylinderGeometry args={[0.22, 0.22, 0.08, 12]} /></M>
      <M p={[0, 0.095, 0]} c="#f8f9fa"><cylinderGeometry args={[0.17, 0.17, 0.02, 12]} /></M>
      <Box p={[0, 0.11, -0.05]} s={[0.025, 0.01, 0.11]} c="#212529" />
      <Box p={[0.04, 0.11, 0]} s={[0.09, 0.01, 0.02]} c="#212529" />
      <Box p={[0.25, 0.05, 0]} s={[0.05, 0.04, 0.05]} c="#fcc419" />
    </group>
  ),
  /** A necklace of beads in a ring, a pendant at the front. */
  collier: () => (
    <group>
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * PI * 2
        return <M key={i} p={[Math.cos(a) * 0.36, 0.06, Math.sin(a) * 0.3 - 0.05]} c={['#e03131', '#fcc419', '#2f9e44', '#1c1c1c'][i % 4]}><sphereGeometry args={[0.065, 6, 4]} /></M>
      })}
      <M p={[0, 0.06, 0.37]} r={[0, PI / 4, 0]} c="#fcc419"><octahedronGeometry args={[0.11, 0]} /></M>
    </group>
  ),
  /** A big comb laid flat. */
  peigne: () => (
    <group>
      <Box p={[0, 0.035, -0.15]} s={[0.84, 0.07, 0.16]} c="#7048e8" />
      {Array.from({ length: 12 }, (_, i) => <Box key={i} p={[-0.38 + i * 0.069, 0.025, 0.06]} s={[0.035, 0.05, 0.3]} c="#7048e8" />)}
    </group>
  ),
  /** Open scissors laid flat: crossed blades, red rings. */
  ciseaux: () => (
    <group>
      {[-1, 1].map((k) => (
        <group key={k} rotation={[0, k * 0.28, 0]}>
          <Box p={[0, 0.04, 0.22]} s={[0.08, 0.04, 0.5]} c="#ced4da" />
          <Box p={[0, 0.04, -0.12]} s={[0.06, 0.05, 0.2]} c="#e03131" />
          <M p={[0, 0.04, -0.32]} r={[PI / 2, 0, 0]} c="#e03131"><torusGeometry args={[0.13, 0.04, 5, 10]} /></M>
        </group>
      ))}
      <M p={[0, 0.07, 0]} c="#fcc419"><cylinderGeometry args={[0.04, 0.04, 0.04, 8]} /></M>
    </group>
  ),
  /** A razor laid flat: the handle, the head with its blade. */
  rasoir: () => (
    <group rotation={[0, 0.5, 0]}>
      <Box p={[0, 0.04, 0.1]} s={[0.12, 0.08, 0.66]} c="#1c7ed6" />
      {[0, 1, 2].map((i) => <Box key={i} p={[0, 0.085, 0.1 + i * 0.12]} s={[0.13, 0.01, 0.04]} c="#a5d8ff" />)}
      <Box p={[0, 0.06, -0.3]} s={[0.46, 0.12, 0.16]} c="#1971c2" />
      <Box p={[0, 0.13, -0.3]} s={[0.42, 0.02, 0.1]} c="#e9ecef" />
      <Box p={[0, 0.07, -0.385]} s={[0.42, 0.02, 0.01]} c="#f8f9fa" />
    </group>
  ),
  /** A hair dryer standing on its handle, the nozzle to the front. */
  'seche-cheveux': () => (
    <group>
      <Box p={[0, 0.2, -0.1]} s={[0.14, 0.4, 0.16]} c="#e64980" />
      <Box p={[0, 0.25, -0.02]} s={[0.1, 0.06, 0.02]} c="#fff" />
      <M p={[0, 0.5, 0]} r={[PI / 2, 0, 0]} c="#f06595"><cylinderGeometry args={[0.18, 0.18, 0.5, 10]} /></M>
      <M p={[0, 0.5, 0.33]} r={[PI / 2, 0, 0]} c="#e64980"><cylinderGeometry args={[0.1, 0.14, 0.18, 10]} /></M>
      <M p={[0, 0.5, -0.255]} r={[PI / 2, 0, 0]} c="#343a40"><cylinderGeometry args={[0.15, 0.15, 0.02, 10]} /></M>
    </group>
  ),
  /** Nail polish: a red bottle, its tall black cap, and a smaller pink one. */
  vernis: () => (
    <group>
      <Box p={[-0.12, 0.17, 0]} s={[0.36, 0.34, 0.36]} c="#e03131" />
      <Box p={[-0.12, 0.17, 0.181]} s={[0.06, 0.24, 0.01]} c="#ff8787" />
      <M p={[-0.12, 0.36, 0]} c="#f1f3f5"><cylinderGeometry args={[0.07, 0.07, 0.05, 8]} /></M>
      <M p={[-0.12, 0.56, 0]} c="#212529"><cylinderGeometry args={[0.08, 0.09, 0.36, 8]} /></M>
      <Box p={[0.26, 0.1, 0.12]} s={[0.22, 0.2, 0.22]} c="#f783ac" />
      <M p={[0.26, 0.3, 0.12]} c="#212529"><cylinderGeometry args={[0.05, 0.06, 0.2, 8]} /></M>
    </group>
  ),
  /** A round table mirror on its foot. */
  miroir: () => (
    <group>
      <Box p={[0, 0.03, 0]} s={[0.5, 0.06, 0.3]} c="#c08a3e" />
      <Box p={[0, 0.12, 0]} s={[0.08, 0.14, 0.08]} c="#c08a3e" />
      <M p={[0, 0.55, 0]} r={[-0.25, 0, 0]} c="#c08a3e"><torusGeometry args={[0.34, 0.05, 6, 16]} /></M>
      <M p={[0, 0.55, 0]} r={[PI / 2 - 0.25, 0, 0]} c="#a5d8ff" glow={0.25}><cylinderGeometry args={[0.32, 0.32, 0.02, 16]} /></M>
      <Box p={[-0.1, 0.62, 0.03]} s={[0.05, 0.22, 0.02]} c="#fff" />
    </group>
  ),
  /** A perfume bottle: amber glass, gold neck, black cap. */
  parfum: () => (
    <group>
      <Box p={[0, 0.22, 0]} s={[0.46, 0.44, 0.26]} c="#fab005" />
      <Box p={[0, 0.22, 0.131]} s={[0.3, 0.3, 0.01]} c="#ffe066" />
      <Box p={[0, 0.22, 0.137]} s={[0.16, 0.1, 0.01]} c="#212529" />
      <M p={[0, 0.48, 0]} c="#e0a800"><cylinderGeometry args={[0.06, 0.06, 0.08, 8]} /></M>
      <Box p={[0, 0.6, 0]} s={[0.2, 0.18, 0.2]} c="#212529" />
    </group>
  ),
  /** A jar of cream, open on its white cream, and a tube beside it. */
  creme: () => (
    <group>
      <M p={[-0.12, 0.12, 0]} c="#f8f9fa"><cylinderGeometry args={[0.3, 0.3, 0.24, 14]} /></M>
      <M p={[-0.12, 0.24, 0]} sc={[1, 0.3, 1]} c="#fff9f0"><sphereGeometry args={[0.26, 10, 5, 0, PI * 2, 0, PI / 2]} /></M>
      <M p={[-0.12, 0.08, 0]} c="#f783ac"><cylinderGeometry args={[0.31, 0.31, 0.08, 14]} /></M>
      <Box p={[0.32, 0.06, 0.15]} s={[0.18, 0.12, 0.5]} c="#f783ac" r={-0.3} />
      <Box p={[0.4, 0.06, -0.12]} s={[0.1, 0.1, 0.08]} c="#fff" r={-0.3} />
    </group>
  ),
  /** Hair extensions: long wavy strands fanned out, sewn into a red-taped weft at the top. */
  meche: () => (
    <group position={[0, 0, -0.05]}>
      {[-3, -2, -1, 0, 1, 2, 3].map((i) => (
        <group key={i} position={[0, 0, -0.4]} rotation={[0, i * 0.11, 0]}>
          {[0, 1, 2, 3, 4, 5].map((j) => <Box key={j} p={[(j % 2 ? 0.035 : -0.035), 0.035, 0.1 + j * 0.15]} s={[0.1, 0.07, 0.17]} c={(i + j) % 3 ? '#2b1a12' : '#5a3a24'} />)}
        </group>
      ))}
      <Box p={[0, 0.06, -0.4]} s={[0.5, 0.12, 0.1]} c="#e03131" />
    </group>
  ),
  /** Three hair rollers, two lying, one on top. */
  bigoudi: () => (
    <group>
      {([[-0.14, 0.13, '#f783ac'], [0.14, 0.13, '#74c0fc'], [0, 0.36, '#ffd43b']] as const).map(([x, y, c]) => (
        <group key={c} position={[x, y, 0]}>
          <M p={[0, 0, 0]} r={[PI / 2, 0, 0]} c={c}><cylinderGeometry args={[0.13, 0.13, 0.6, 8]} /></M>
          <M p={[0, 0, 0.301]} r={[PI / 2, 0, 0]} c="#495057"><cylinderGeometry args={[0.07, 0.07, 0.01, 8]} /></M>
          {[-0.18, 0, 0.18].map((z) => <M key={z} p={[0, 0, z]} r={[PI / 2, 0, 0]} c="#fff"><cylinderGeometry args={[0.14, 0.14, 0.04, 8]} /></M>)}
        </group>
      ))}
    </group>
  ),
  /** A bar of pink soap on its blue dish, a few bubbles. */
  savon: () => (
    <group>
      <M p={[0, 0.04, 0]} sc={[1, 1, 0.7]} c="#4dabf7"><cylinderGeometry args={[0.48, 0.4, 0.08, 12]} /></M>
      <Box p={[0, 0.15, 0]} s={[0.5, 0.16, 0.3]} c="#f783ac" />
      <Box p={[0, 0.235, 0]} s={[0.4, 0.02, 0.22]} c="#faa2c1" />
      {([[0.15, 0.3, 0.05, 0.07], [-0.12, 0.29, -0.06, 0.05], [0.02, 0.36, -0.02, 0.06]] as const).map(([x, y, z, r]) => (
        <M key={x} p={[x, y, z]} c="#ffffff"><sphereGeometry args={[r, 6, 4]} /></M>
      ))}
    </group>
  ),
  /** A kitchen sponge: yellow, the green scrub on top, holes on the front. */
  eponge: () => (
    <group>
      <Box p={[0, 0.12, 0]} s={[0.66, 0.24, 0.42]} c="#ffd43b" />
      <Box p={[0, 0.28, 0]} s={[0.66, 0.08, 0.42]} c="#2f9e44" />
      {([[-0.2, 0.08], [0.05, 0.15], [0.22, 0.07], [-0.05, 0.06], [0.25, 0.17], [-0.24, 0.17]] as const).map(([x, y]) => (
        <Box key={x} p={[x, y, 0.211]} s={[0.05, 0.04, 0.01]} c="#e0a800" />
      ))}
    </group>
  ),
  /** A striped towel hung over its little stand. */
  serviette: () => (
    <group>
      {[-0.38, 0.38].map((x) => (
        <group key={x}>
          <Box p={[x, 0.42, 0]} s={[0.05, 0.84, 0.05]} c="#8a5a2b" />
          <Box p={[x, 0.02, 0]} s={[0.08, 0.04, 0.36]} c="#8a5a2b" />
        </group>
      ))}
      <M p={[0, 0.8, 0]} r={[0, 0, PI / 2]} c="#8a5a2b"><cylinderGeometry args={[0.03, 0.03, 0.8, 6]} /></M>
      <M p={[0, 0.8, 0]} r={[0, 0, PI / 2]} c="#f8f9fa"><cylinderGeometry args={[0.07, 0.07, 0.6, 8]} /></M>
      {[-0.06, 0.06].map((z) => (
        <group key={z}>
          <Box p={[0, 0.52, z]} s={[0.6, 0.56, 0.03]} c="#f8f9fa" />
          {[0.36, 0.42].map((y) => <Box key={y} p={[0, y, z * 1.15]} s={[0.61, 0.04, 0.03]} c={y > 0.4 ? '#1c7ed6' : '#e03131'} />)}
        </group>
      ))}
      {Array.from({ length: 8 }, (_, i) => <Box key={i} p={[-0.26 + i * 0.075, 0.22, 0.06]} s={[0.03, 0.05, 0.02]} c="#dee2e6" />)}
    </group>
  ),
  /** The broom of the house: a wide fan of straws tied at the top with coloured string. */
  balai: () => (
    <group position={[0.1, 0, 0]} rotation={[0, -1.25, 0]}>
      {Array.from({ length: 11 }, (_, i) => (
        <group key={i} position={[0, 0, -0.3]} rotation={[0, (i - 5) * 0.075, 0]}>
          <Box p={[0, 0.03, 0.42]} s={[0.04, 0.05, 0.84]} c={i % 2 ? '#e0b46a' : '#c8933f'} />
        </group>
      ))}
      <Box p={[0, 0.06, -0.38]} s={[0.14, 0.12, 0.34]} c="#c8933f" />
      {[-0.48, -0.38, -0.28].map((z, i) => <Box key={z} p={[0, 0.07, z]} s={[0.16, 0.13, 0.05]} c={['#e03131', '#2f9e44', '#fcc419'][i]} />)}
    </group>
  ),
  /** A plastic bucket of water with its handle. */
  seau: () => (
    <group>
      <M p={[0, 0.28, 0]} c="#1c7ed6"><cylinderGeometry args={[0.36, 0.27, 0.56, 12]} /></M>
      <M p={[0, 0.54, 0]} c="#74c0fc" glow={0.15}><cylinderGeometry args={[0.32, 0.32, 0.02, 12]} /></M>
      <M p={[0, 0.555, 0]} r={[PI / 2, 0, 0]} c="#1864ab"><torusGeometry args={[0.36, 0.025, 4, 14]} /></M>
      <M p={[0, 0.5, 0]} c="#868e96"><torusGeometry args={[0.36, 0.02, 4, 14, PI]} /></M>
    </group>
  ),
  /** An iron: the pointed steel sole, the blue body, the handle. */
  'fer-a-repasser': () => (
    <group>
      <Box p={[0, 0.04, -0.12]} s={[0.5, 0.08, 0.44]} c="#ced4da" />
      <Box p={[0, 0.04, 0.1]} s={[0.36, 0.08, 0.36]} c="#ced4da" r={PI / 4} />
      <Box p={[0, 0.15, -0.12]} s={[0.44, 0.14, 0.4]} c="#1c7ed6" />
      <Box p={[0, 0.14, 0.08]} s={[0.28, 0.12, 0.28]} c="#1c7ed6" r={PI / 4} />
      <Box p={[0, 0.36, -0.12]} s={[0.1, 0.06, 0.48]} c="#212529" />
      <Box p={[0, 0.28, -0.32]} s={[0.1, 0.14, 0.08]} c="#212529" />
      <Box p={[0, 0.26, 0.06]} s={[0.1, 0.12, 0.08]} c="#212529" />
      <Box p={[0, 0.235, -0.12]} s={[0.12, 0.03, 0.12]} c="#e03131" />
    </group>
  ),
  /** The laundry: a red basin heaped with clothes. */
  linge: () => (
    <group>
      <M p={[0, 0.16, 0]} c="#e03131"><cylinderGeometry args={[0.48, 0.38, 0.32, 14]} /></M>
      <M p={[0, 0.3, 0]} sc={[1, 0.5, 1]} c="#f8f9fa"><sphereGeometry args={[0.42, 10, 5, 0, PI * 2, 0, PI / 2]} /></M>
      <Box p={[-0.14, 0.4, 0.08]} s={[0.36, 0.12, 0.28]} c="#fcc419" r={0.4} />
      <Box p={[0.16, 0.38, -0.08]} s={[0.32, 0.12, 0.26]} c="#1c7ed6" r={-0.3} />
      <Box p={[0.05, 0.48, 0.03]} s={[0.26, 0.1, 0.22]} c="#2f9e44" r={1} />
      <Box p={[0.36, 0.24, 0.3]} s={[0.12, 0.3, 0.06]} c="#1c7ed6" r={-0.7} />
    </group>
  ),
  /** A rug: red field, a border, a diamond in the middle, white fringes. */
  tapis: () => (
    <group>
      <Box p={[0, 0.02, 0]} s={[1.0, 0.04, 0.7]} c="#1c1c3a" />
      <Box p={[0, 0.03, 0]} s={[0.86, 0.04, 0.56]} c="#c92a2a" />
      <Box p={[0, 0.04, 0]} s={[0.3, 0.04, 0.3]} c="#fcc419" r={PI / 4} />
      <Box p={[0, 0.05, 0]} s={[0.14, 0.04, 0.14]} c="#1c1c3a" r={PI / 4} />
      {[-0.3, 0.3].map((x) => <Box key={x} p={[x, 0.045, 0]} s={[0.1, 0.04, 0.1]} c="#fcc419" r={PI / 4} />)}
      {[-1, 1].map((k) => Array.from({ length: 7 }, (_, i) => <Box key={`${k}${i}`} p={[k * 0.54, 0.01, -0.3 + i * 0.1]} s={[0.08, 0.02, 0.03]} c="#f8f9fa" />))}
    </group>
  ),
  /** A puffy cushion, a button in the middle, tassels at the corners. */
  coussin: () => (
    <group>
      <Box p={[0, 0.08, 0]} s={[0.72, 0.16, 0.72]} c="#7048e8" />
      <M p={[0, 0.14, 0]} sc={[1, 0.3, 1]} c="#845ef7"><sphereGeometry args={[0.42, 10, 6, 0, PI * 2, 0, PI / 2]} /></M>
      <M p={[0, 0.27, 0]} c="#fcc419"><sphereGeometry args={[0.05, 6, 4]} /></M>
      {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([a, b]) => <Box key={`${a}${b}`} p={[a * 0.38, 0.06, b * 0.38]} s={[0.08, 0.08, 0.08]} c="#fcc419" r={PI / 4} />)}
    </group>
  ),
  /** A table lamp: wooden foot, cream shade, the bulb lit. */
  lampe: () => (
    <group>
      <M p={[0, 0.04, 0]} c="#8a5a2b"><cylinderGeometry args={[0.24, 0.28, 0.08, 10]} /></M>
      <M p={[0, 0.32, 0]} c="#8a5a2b"><cylinderGeometry args={[0.04, 0.05, 0.5, 6]} /></M>
      <M p={[0, 0.58, 0]} c="#ffe066" glow={1}><sphereGeometry args={[0.1, 6, 4]} /></M>
      <M p={[0, 0.72, 0]} c="#fff3bf" glow={0.25}><cylinderGeometry args={[0.2, 0.38, 0.36, 10]} /></M>
    </group>
  ),
  /** Two candles on a saucer, lit. */
  bougie: () => (
    <group>
      <M p={[0, 0.03, 0]} c="#fcc419"><cylinderGeometry args={[0.44, 0.38, 0.06, 12]} /></M>
      {([[-0.13, 0.55], [0.17, 0.36]] as const).map(([x, h]) => (
        <group key={x} position={[x, 0.06, 0]}>
          <M p={[0, h / 2, 0]} c="#fff9db"><cylinderGeometry args={[0.12, 0.12, h, 8]} /></M>
          <Box p={[0, h + 0.03, 0]} s={[0.02, 0.06, 0.02]} c="#212529" />
          <M p={[0, h + 0.13, 0]} c="#ff922b" glow={1.2}><coneGeometry args={[0.06, 0.18, 6]} /></M>
          <M p={[0, h + 0.1, 0]} c="#ffe066" glow={1.2}><sphereGeometry args={[0.04, 5, 4]} /></M>
        </group>
      ))}
    </group>
  ),
  /** A flower in a small vase, its head tipped up to be seen. */
  fleur: () => (
    <group>
      <M p={[0, 0.15, 0]} c="#4dabf7"><cylinderGeometry args={[0.12, 0.17, 0.3, 8]} /></M>
      <Box p={[0, 0.48, 0]} s={[0.04, 0.4, 0.04]} c="#2f9e44" />
      <Box p={[0.1, 0.45, 0]} s={[0.18, 0.04, 0.1]} c="#40c057" />
      <group position={[0, 0.72, 0.04]} rotation={[-0.9, 0, 0]}>
        {Array.from({ length: 6 }, (_, i) => {
          const a = (i / 6) * PI * 2
          return <M key={i} p={[Math.cos(a) * 0.17, Math.sin(a) * 0.17, 0]} sc={[1, 1, 0.4]} c="#e03131"><sphereGeometry args={[0.13, 6, 4]} /></M>
        })}
        <M p={[0, 0, 0.03]} sc={[1, 1, 0.6]} c="#fcc419"><sphereGeometry args={[0.11, 6, 4]} /></M>
      </group>
    </group>
  ),
  /** A potted plant: terracotta pot, long leaves. */
  plante: () => (
    <group>
      <M p={[0, 0.18, 0]} c="#c2593b"><cylinderGeometry args={[0.3, 0.22, 0.36, 10]} /></M>
      <M p={[0, 0.36, 0]} c="#a3462c"><cylinderGeometry args={[0.32, 0.32, 0.05, 10]} /></M>
      <M p={[0, 0.39, 0]} c="#5c3a21"><cylinderGeometry args={[0.28, 0.28, 0.02, 10]} /></M>
      {Array.from({ length: 7 }, (_, i) => (
        <group key={i} position={[0, 0.38, 0]} rotation={[0, (i / 7) * PI * 2, 0]}>
          <M p={[0, 0.25, 0.14]} r={[0.5 + (i % 2) * 0.25, 0, 0]} c={i % 2 ? '#2f9e44' : '#40c057'}><boxGeometry args={[0.12, 0.55, 0.04]} /></M>
        </group>
      ))}
    </group>
  ),
  /** A gift box: red, gold ribbons, a bow on top. */
  cadeau: () => (
    <group>
      <Box p={[0, 0.24, 0]} s={[0.62, 0.48, 0.62]} c="#e03131" />
      <Box p={[0, 0.24, 0]} s={[0.12, 0.49, 0.63]} c="#fcc419" />
      <Box p={[0, 0.24, 0]} s={[0.63, 0.49, 0.12]} c="#fcc419" />
      {[-1, 1].map((k) => <M key={k} p={[k * 0.1, 0.55, 0]} r={[0, 0, k * 0.5]} sc={[1, 1, 0.6]} c="#fcc419"><torusGeometry args={[0.1, 0.035, 5, 10]} /></M>)}
      <Box p={[0, 0.5, 0]} s={[0.08, 0.06, 0.08]} c="#e0a800" />
    </group>
  ),
  /** Three party balloons on their strings, tied to a weight. */
  'ballon-fete': () => (
    <group>
      <Box p={[0, 0.05, 0]} s={[0.14, 0.1, 0.14]} c="#7048e8" />
      {([[-0.22, 0.78, -0.04, '#e03131'], [0.22, 0.86, 0.02, '#fcc419'], [0, 1.02, -0.1, '#1c7ed6']] as const).map(([x, y, z, c]) => {
        const len = Math.hypot(x, y - 0.33, z)
        return (
          <group key={c}>
            <group position={[0, 0.1, 0]} rotation={[Math.atan2(z, y - 0.33), 0, -Math.atan2(x, y - 0.33)]}>
              <Box p={[0, len / 2, 0]} s={[0.012, len, 0.012]} c="#f8f9fa" />
            </group>
            <M p={[x, y, z]} sc={[1, 1.2, 1]} c={c}><sphereGeometry args={[0.2, 10, 8]} /></M>
            <M p={[x, y - 0.25, z]} r={[PI, 0, 0]} c={c}><coneGeometry args={[0.04, 0.06, 5]} /></M>
          </group>
        )
      })}
    </group>
  ),
  /** A baby's stacking-rings toy. */
  jouet: () => (
    <group>
      <M p={[0, 0.05, 0]} c="#fcc419"><cylinderGeometry args={[0.34, 0.36, 0.1, 12]} /></M>
      <M p={[0, 0.4, 0]} c="#fcc419"><cylinderGeometry args={[0.05, 0.05, 0.6, 6]} /></M>
      {(['#e03131', '#ff922b', '#2f9e44', '#1c7ed6'] as const).map((c, i) => (
        <M key={c} p={[0, 0.16 + i * 0.12, 0]} r={[PI / 2, 0, 0]} c={c}><torusGeometry args={[0.28 - i * 0.05, 0.06, 6, 12]} /></M>
      ))}
      <M p={[0, 0.74, 0]} c="#e03131"><sphereGeometry args={[0.09, 8, 6]} /></M>
    </group>
  ),
  /** A sitting teddy bear. */
  peluche: () => (
    <group>
      <M p={[0, 0.25, 0]} sc={[1, 1.1, 0.9]} c="#a9713a"><sphereGeometry args={[0.24, 8, 6]} /></M>
      <M p={[0, 0.27, 0.15]} sc={[1, 1, 0.5]} c="#e3b98a"><sphereGeometry args={[0.14, 8, 6]} /></M>
      <M p={[0, 0.6, 0]} c="#a9713a"><sphereGeometry args={[0.2, 8, 6]} /></M>
      {[-1, 1].map((k) => (
        <group key={k}>
          <M p={[k * 0.15, 0.76, -0.02]} c="#8a5a2b"><sphereGeometry args={[0.07, 6, 4]} /></M>
          <M p={[k * 0.15, 0.08, 0.16]} c="#a9713a"><sphereGeometry args={[0.09, 6, 4]} /></M>
          <M p={[k * 0.24, 0.32, 0.06]} c="#a9713a"><sphereGeometry args={[0.08, 6, 4]} /></M>
          <Box p={[k * 0.07, 0.64, 0.18]} s={[0.04, 0.04, 0.02]} c="#1a1a1a" />
        </group>
      ))}
      <M p={[0, 0.55, 0.17]} sc={[1, 0.8, 0.7]} c="#e3b98a"><sphereGeometry args={[0.08, 6, 4]} /></M>
      <Box p={[0, 0.57, 0.23]} s={[0.05, 0.035, 0.02]} c="#1a1a1a" />
      <Box p={[0, 0.43, 0.15]} s={[0.22, 0.05, 0.06]} c="#e03131" />
    </group>
  ),
  /** A baby bottle full of milk: the blue ring, the teat. */
  biberon: () => (
    <group>
      <M p={[0, 0.27, 0]} c="#f1f3f5"><cylinderGeometry args={[0.16, 0.16, 0.54, 10]} /></M>
      {[0, 1, 2, 3].map((i) => <Box key={i} p={[0, 0.12 + i * 0.1, 0.16]} s={[0.08, 0.015, 0.01]} c="#4dabf7" />)}
      <M p={[0, 0.58, 0]} c="#4dabf7"><cylinderGeometry args={[0.17, 0.17, 0.09, 10]} /></M>
      <M p={[0, 0.66, 0]} c="#ffc078"><cylinderGeometry args={[0.06, 0.12, 0.08, 8]} /></M>
      <M p={[0, 0.74, 0]} c="#ffc078"><sphereGeometry args={[0.065, 6, 5]} /></M>
    </group>
  ),
  /** A syringe lying on its side: barrel with the dose, plunger, needle. */
  seringue: () => (
    <group rotation={[0, 0.3, 0]}>
      <M p={[0, 0.1, 0]} r={[0, 0, PI / 2]} c="#e7f5ff"><cylinderGeometry args={[0.1, 0.1, 0.54, 10]} /></M>
      <M p={[0.08, 0.1, 0]} r={[0, 0, PI / 2]} c="#ff8787"><cylinderGeometry args={[0.085, 0.085, 0.36, 10]} /></M>
      {[0, 1, 2, 3].map((i) => <Box key={i} p={[-0.1 + i * 0.1, 0.18, 0.06]} s={[0.012, 0.04, 0.04]} c="#495057" />)}
      <Box p={[-0.28, 0.1, 0]} s={[0.03, 0.08, 0.36]} c="#dee2e6" />
      <Box p={[-0.4, 0.1, 0]} s={[0.22, 0.05, 0.05]} c="#dee2e6" />
      <M p={[-0.52, 0.1, 0]} r={[0, 0, PI / 2]} c="#dee2e6"><cylinderGeometry args={[0.1, 0.1, 0.03, 10]} /></M>
      <M p={[0.3, 0.1, 0]} r={[0, 0, PI / 2]} c="#adb5bd"><cylinderGeometry args={[0.03, 0.05, 0.06, 6]} /></M>
      <Box p={[0.45, 0.1, 0]} s={[0.26, 0.015, 0.015]} c="#ced4da" />
    </group>
  ),
  /** Medicines: a box with the green cross, a blister of pills, two capsules. */
  medicament: () => (
    <group>
      <Box p={[-0.15, 0.16, -0.1]} s={[0.5, 0.32, 0.3]} c="#f8f9fa" />
      <Box p={[-0.15, 0.16, 0.051]} s={[0.2, 0.06, 0.01]} c="#2f9e44" />
      <Box p={[-0.15, 0.16, 0.051]} s={[0.06, 0.2, 0.01]} c="#2f9e44" />
      <Box p={[-0.15, 0.321, -0.1]} s={[0.5, 0.01, 0.06]} c="#2f9e44" />
      <group position={[0.2, 0, 0.24]} rotation={[0, 0.2, 0]}>
        <Box p={[0, 0.015, 0]} s={[0.4, 0.03, 0.26]} c="#ced4da" />
        {[-1, 0, 1].flatMap((i) => [-1, 1].map((j) => <M key={`${i}${j}`} p={[i * 0.12, 0.03, j * 0.06]} c="#fff"><sphereGeometry args={[0.045, 6, 4, 0, PI * 2, 0, PI / 2]} /></M>))}
      </group>
      {([[0.3, -0.18, 0.4], [-0.3, 0.3, -0.6]] as const).map(([x, z, t]) => (
        <group key={x} position={[x, 0.05, z]} rotation={[0, t, 0]}>
          <M p={[-0.05, 0, 0]} r={[0, 0, PI / 2]} c="#e03131"><capsuleGeometry args={[0.05, 0.08, 3, 6]} /></M>
          <M p={[0.05, 0, 0]} r={[0, 0, PI / 2]} c="#fcc419"><capsuleGeometry args={[0.05, 0.08, 3, 6]} /></M>
        </group>
      ))}
    </group>
  ),
  /** A digital thermometer: white body, lit screen, steel tip. */
  thermometre: () => (
    <group rotation={[0, 0.6, 0]}>
      <Box p={[0, 0.05, -0.1]} s={[0.2, 0.1, 0.62]} c="#f8f9fa" />
      <Box p={[0, 0.04, 0.3]} s={[0.1, 0.08, 0.22]} c="#f8f9fa" />
      <M p={[0, 0.04, 0.44]} r={[PI / 2, 0, 0]} c="#adb5bd"><cylinderGeometry args={[0.03, 0.03, 0.12, 6]} /></M>
      <Box p={[0, 0.105, -0.12]} s={[0.14, 0.02, 0.2]} c="#69db7c" glow={0.6} />
      <Box p={[0, 0.118, -0.12]} s={[0.08, 0.01, 0.03]} c="#1a1a1a" />
      <Box p={[0, 0.105, -0.32]} s={[0.08, 0.03, 0.08]} c="#1c7ed6" />
    </group>
  ),
  /** A stethoscope laid flat: the silver earpieces, the black tube, the chest piece. */
  stethoscope: () => (
    <group position={[0.17, 0, 0]} scale={1.3}>
      <M p={[0, 0.035, -0.25]} r={[PI / 2, 0, 0]} c="#ced4da"><torusGeometry args={[0.22, 0.03, 5, 12, PI]} /></M>
      {[-0.22, 0.22].map((x) => (
        <group key={x}>
          <Box p={[x, 0.035, -0.33]} s={[0.05, 0.05, 0.16]} c="#ced4da" />
          <M p={[x, 0.04, -0.42]} c="#1a1a1a"><sphereGeometry args={[0.05, 6, 4]} /></M>
        </group>
      ))}
      <M p={[-0.3, 0.035, -0.03]} r={[PI / 2, 0, 0]} c="#212529"><torusGeometry args={[0.3, 0.035, 5, 10, PI / 2]} /></M>
      <Box p={[-0.35, 0.035, 0.27]} s={[0.12, 0.06, 0.06]} c="#212529" />
      <M p={[-0.46, 0.05, 0.27]} c="#adb5bd"><cylinderGeometry args={[0.13, 0.13, 0.1, 12]} /></M>
      <M p={[-0.46, 0.105, 0.27]} c="#e9ecef"><cylinderGeometry args={[0.1, 0.1, 0.02, 12]} /></M>
    </group>
  ),
  /** Two crossed sticking plasters. */
  pansement: () => (
    <group>
      {[-0.5, 0.5].map((t, n) => (
        <group key={t} position={[0, n * 0.04, 0]} rotation={[0, t, 0]}>
          <Box p={[0, 0.02, 0]} s={[0.66, 0.04, 0.28]} c="#e8b07a" />
          {[-1, 1].map((k) => <M key={k} p={[k * 0.33, 0.02, 0]} c="#e8b07a"><cylinderGeometry args={[0.14, 0.14, 0.04, 10]} /></M>)}
          <Box p={[0, 0.045, 0]} s={[0.26, 0.02, 0.22]} c="#fff4e6" />
          {[-1, 1].flatMap((k) => [-0.06, 0.06].map((z) => <Box key={`${k}${z}`} p={[k * 0.3, 0.045, z]} s={[0.03, 0.01, 0.03]} c="#c98a52" />))}
        </group>
      ))}
    </group>
  ),
  /** A blood-pressure monitor: the unit and its screen, the cuff, the tube. */
  tensiometre: () => (
    <group>
      <Box p={[-0.18, 0.1, 0]} s={[0.46, 0.2, 0.4]} c="#f8f9fa" />
      <M p={[-0.18, 0.205, 0]} r={[-0.2, 0, 0]} c="#212529"><boxGeometry args={[0.32, 0.02, 0.22]} /></M>
      {[0, 1].map((i) => <Box key={i} p={[-0.2, 0.225, -0.04 + i * 0.08]} s={[0.18 - i * 0.06, 0.01, 0.04]} c="#69db7c" glow={0.8} />)}
      <M p={[-0.04, 0.21, 0.14]} c="#1c7ed6"><cylinderGeometry args={[0.04, 0.04, 0.03, 8]} /></M>
      <Box p={[0.33, 0.05, 0.05]} s={[0.34, 0.1, 0.6]} c="#1b3a6b" r={-0.15} />
      <Box p={[0.33, 0.105, 0.05]} s={[0.12, 0.01, 0.5]} c="#adb5bd" r={-0.15} />
      <M p={[0.1, 0.03, -0.18]} r={[PI / 2, 0, 0]} c="#495057"><torusGeometry args={[0.12, 0.02, 4, 8, PI]} /></M>
    </group>
  ),
  /** A claw hammer lying on the ground. */
  marteau: () => (
    <group rotation={[0, 0.6, 0]}>
      <Box p={[0, 0.06, 0.1]} s={[0.1, 0.09, 0.72]} c="#b07a3e" />
      <Box p={[0, 0.06, 0.38]} s={[0.12, 0.1, 0.18]} c="#212529" />
      <Box p={[0, 0.075, -0.32]} s={[0.16, 0.15, 0.16]} c="#868e96" />
      <M p={[0.16, 0.075, -0.32]} r={[0, 0, PI / 2]} c="#868e96"><cylinderGeometry args={[0.08, 0.08, 0.18, 8]} /></M>
      <Box p={[-0.2, 0.065, -0.3]} s={[0.24, 0.1, 0.06]} c="#868e96" r={-0.3} />
      <Box p={[-0.2, 0.065, -0.36]} s={[0.24, 0.1, 0.05]} c="#868e96" r={0.3} />
    </group>
  ),
  /** Grey breeze blocks (parpaings) with their two holes, one set across the other. */
  brique: () => (
    <group>
      {([[0, 0, 0], [0.14, 0.36, -0.02]] as const).map(([x, y, z], n) => (
        <group key={n} position={[x, y, z]} rotation={[0, n * 0.1, 0]}>
          <Box p={[0, 0.18, 0]} s={[0.8, 0.36, 0.4]} c={n ? '#adb5bd' : '#9ca3af'} />
          {[-0.18, 0.18].map((hx) => <Box key={hx} p={[hx, 0.355, 0]} s={[0.26, 0.02, 0.22]} c="#495057" />)}
        </group>
      ))}
    </group>
  ),
  /** Two cement sacks, one across the other: bulging grey paper bags, the red and yellow print. */
  'sac-ciment': () => (
    <group>
      {[0, 1].map((n) => (
        <group key={n} position={[n * 0.05, n * 0.26, n * 0.02]} rotation={[0, n ? PI / 2 - 0.15 : 0.1, 0]}>
          <Box p={[0, 0.09, 0]} s={[0.6, 0.18, 0.84]} c="#c9c2b2" />
          <M p={[0, 0.17, 0]} sc={[0.58, 0.16, 0.82]} c="#d3cdbf"><sphereGeometry args={[0.5, 10, 6, 0, PI * 2, 0, PI / 2]} /></M>
          <Box p={[0, 0.24, 0.02]} s={[0.34, 0.04, 0.24]} c="#e03131" />
          <Box p={[0, 0.235, 0.2]} s={[0.36, 0.03, 0.06]} c="#fcc419" />
          {[-0.43, 0.43].map((z) => <Box key={z} p={[0, 0.09, z]} s={[0.56, 0.12, 0.03]} c="#9e9584" />)}
        </group>
      ))}
    </group>
  ),
  /** A wheelbarrow: the green tray, the wheel to the front, legs and handles behind. */
  brouette: () => (
    <group>
      <M p={[0, 0.16, 0.42]} r={[0, 0, PI / 2]} c="#212529"><cylinderGeometry args={[0.16, 0.16, 0.1, 10]} /></M>
      <M p={[0, 0.16, 0.42]} r={[0, 0, PI / 2]} c="#adb5bd"><cylinderGeometry args={[0.05, 0.05, 0.12, 6]} /></M>
      <M p={[0, 0.42, -0.02]} r={[0, PI / 4, 0]} c="#2f9e44"><cylinderGeometry args={[0.5, 0.32, 0.26, 4]} /></M>
      <M p={[0, 0.555, -0.02]} r={[0, PI / 4, 0]} c="#1b5e20"><cylinderGeometry args={[0.46, 0.46, 0.01, 4]} /></M>
      {[-0.2, 0.2].map((x) => (
        <group key={x}>
          <M p={[x, 0.27, -0.06]} r={[-0.2, 0, 0]} c="#495057"><boxGeometry args={[0.04, 0.04, 1.0]} /></M>
          <Box p={[x, 0.1, -0.3]} s={[0.04, 0.2, 0.04]} c="#495057" />
          <Box p={[x * 1.15, 0.36, -0.62]} s={[0.06, 0.06, 0.18]} c="#212529" />
        </group>
      ))}
    </group>
  ),
  /** A shovel lying: wooden handle with its grip, steel blade. */
  pelle: () => (
    <group rotation={[0, -0.6, 0]}>
      <Box p={[0, 0.04, -0.05]} s={[0.07, 0.07, 0.7]} c="#b07a3e" />
      <Box p={[0, 0.04, -0.46]} s={[0.22, 0.06, 0.05]} c="#212529" />
      {[-0.09, 0.09].map((x) => <Box key={x} p={[x, 0.04, -0.4]} s={[0.04, 0.06, 0.12]} c="#212529" />)}
      <Box p={[0, 0.04, 0.33]} s={[0.1, 0.07, 0.1]} c="#495057" />
      <Box p={[0, 0.03, 0.5]} s={[0.34, 0.05, 0.3]} c="#868e96" />
      <Box p={[0, 0.03, 0.66]} s={[0.22, 0.05, 0.22]} c="#868e96" r={PI / 4} />
    </group>
  ),
  /** A yellow hard hat: dome, brim, the ridge on top. */
  'casque-chantier': () => (
    <group>
      <M p={[0, 0.02, 0.04]} sc={[1, 1, 1.1]} c="#f59f00"><cylinderGeometry args={[0.46, 0.46, 0.04, 14]} /></M>
      <M p={[0, 0.04, 0]} c="#fcc419"><sphereGeometry args={[0.36, 12, 7, 0, PI * 2, 0, PI / 2]} /></M>
      <Box p={[0, 0.36, 0]} s={[0.1, 0.07, 0.56]} c="#fcc419" />
      <Box p={[0, 0.12, 0.4]} s={[0.36, 0.04, 0.12]} c="#f59f00" />
      <Box p={[0, 0.2, 0.33]} s={[0.14, 0.08, 0.04]} c="#fff" />
    </group>
  ),
  /** A black tailor's sewing machine with its gold lines, on a wooden board. */
  'machine-a-coudre': () => (
    <group>
      <Box p={[0, 0.04, 0]} s={[1.0, 0.08, 0.46]} c="#9c6b3a" />
      <Box p={[0, 0.12, 0]} s={[0.84, 0.08, 0.36]} c="#1a1a1a" />
      <Box p={[0.28, 0.36, 0]} s={[0.22, 0.42, 0.3]} c="#1a1a1a" />
      <Box p={[0, 0.6, 0]} s={[0.8, 0.18, 0.26]} c="#1a1a1a" />
      <Box p={[-0.32, 0.43, 0]} s={[0.16, 0.2, 0.2]} c="#1a1a1a" />
      <Box p={[0, 0.6, 0.132]} s={[0.6, 0.03, 0.01]} c="#fcc419" />
      <Box p={[0.28, 0.36, 0.152]} s={[0.12, 0.22, 0.01]} c="#fcc419" />
      <Box p={[-0.33, 0.25, 0.04]} s={[0.03, 0.16, 0.03]} c="#dee2e6" />
      <M p={[0.43, 0.56, 0]} r={[0, 0, PI / 2]} c="#495057"><cylinderGeometry args={[0.15, 0.15, 0.06, 12]} /></M>
      <M p={[0.1, 0.76, -0.04]} c="#e03131"><cylinderGeometry args={[0.05, 0.05, 0.12, 8]} /></M>
    </group>
  ),
  /** Two wooden spools of thread. */
  bobine: () => (
    <group>
      {([[-0.18, '#e03131', 0.5], [0.22, '#1c7ed6', 0.38]] as const).map(([x, c, h]) => (
        <group key={x} position={[x, 0, x > 0 ? 0.08 : -0.05]}>
          <M p={[0, 0.025, 0]} c="#d4a373"><cylinderGeometry args={[0.2, 0.2, 0.05, 10]} /></M>
          <M p={[0, h / 2, 0]} c={c}><cylinderGeometry args={[0.15, 0.15, h - 0.1, 10]} /></M>
          <M p={[0, h - 0.025, 0]} c="#d4a373"><cylinderGeometry args={[0.2, 0.2, 0.05, 10]} /></M>
          <M p={[0, h + 0.003, 0]} c="#7f5539"><cylinderGeometry args={[0.04, 0.04, 0.01, 6]} /></M>
        </group>
      ))}
      <Box p={[-0.1, 0.01, 0.3]} s={[0.4, 0.02, 0.02]} c="#e03131" r={0.3} />
    </group>
  ),
  /** A bolt of cloth: the roll, a length of it unrolled to the front. */
  tissu: () => (
    <group>
      <Box p={[0, 0.015, 0.22]} s={[0.84, 0.03, 0.5]} c="#12b886" />
      {[-0.28, 0, 0.28].map((x) => <Box key={x} p={[x, 0.035, 0.24]} s={[0.12, 0.01, 0.12]} c="#fcc419" r={PI / 4} />)}
      <M p={[0, 0.2, -0.18]} r={[0, 0, PI / 2]} c="#12b886"><cylinderGeometry args={[0.2, 0.2, 0.86, 12]} /></M>
      {[-0.28, 0, 0.28].map((x) => <M key={x} p={[x, 0.2, -0.18]} r={[0, 0, PI / 2]} c="#fcc419"><cylinderGeometry args={[0.205, 0.205, 0.08, 12]} /></M>)}
      {[-1, 1].map((k) => <M key={k} p={[k * 0.44, 0.2, -0.18]} r={[0, 0, PI / 2]} c="#7f5539"><cylinderGeometry args={[0.05, 0.05, 0.04, 6]} /></M>)}
    </group>
  ),
  /** A supermarket trolley: the wire basket, the chassis, four wheels, the handle behind. */
  chariot: () => (
    <group>
      {[[-0.2, -0.3], [0.2, -0.3], [-0.16, 0.3], [0.16, 0.3]].map(([x, z]) => <M key={`${x}${z}`} p={[x, 0.05, z]} r={[0, 0, PI / 2]} c="#212529"><cylinderGeometry args={[0.05, 0.05, 0.05, 8]} /></M>)}
      <Box p={[0, 0.12, 0]} s={[0.42, 0.04, 0.7]} c="#868e96" />
      {[-0.22, 0.22].map((x) => <Box key={x} p={[x, 0.32, -0.32]} s={[0.03, 0.4, 0.03]} c="#868e96" />)}
      <Box p={[0, 0.34, 0]} s={[0.46, 0.04, 0.66]} c="#adb5bd" />
      <Box p={[0, 0.54, -0.32]} s={[0.5, 0.36, 0.03]} c="#adb5bd" />
      <Box p={[0, 0.5, 0.32]} s={[0.4, 0.28, 0.03]} c="#adb5bd" />
      {[-1, 1].map((k) => <Box key={k} p={[k * 0.23, 0.52, 0]} s={[0.03, 0.34, 0.66]} c="#adb5bd" />)}
      {[0.45, 0.6].map((y) => <Box key={y} p={[0, y, 0.33]} s={[0.4, 0.015, 0.02]} c="#868e96" />)}
      {[-0.1, 0, 0.1].map((x) => <Box key={x} p={[x, 0.5, 0.335]} s={[0.015, 0.28, 0.02]} c="#868e96" />)}
      <Box p={[0, 0.74, -0.4]} s={[0.56, 0.06, 0.06]} c="#e03131" />
    </group>
  ),
  /** A car steering wheel on its column, tipped up to be seen. */
  'volant-auto': () => (
    <group>
      <Box p={[0, 0.03, -0.2]} s={[0.3, 0.06, 0.3]} c="#343a40" />
      <M p={[0, 0.22, -0.1]} r={[0.5, 0, 0]} c="#343a40"><boxGeometry args={[0.1, 0.42, 0.1]} /></M>
      <group position={[0, 0.48, 0]} rotation={[-0.75, 0, 0]}>
        <M p={[0, 0, 0]} c="#1a1a1a"><torusGeometry args={[0.4, 0.06, 6, 18]} /></M>
        <Box p={[0, 0, 0]} s={[0.8, 0.06, 0.04]} c="#495057" />
        <Box p={[0, -0.2, 0]} s={[0.07, 0.4, 0.04]} c="#495057" />
        <M p={[0, 0, 0.03]} r={[PI / 2, 0, 0]} c="#212529"><cylinderGeometry args={[0.14, 0.14, 0.08, 10]} /></M>
        <M p={[0, 0, 0.075]} r={[PI / 2, 0, 0]} c="#adb5bd"><cylinderGeometry args={[0.06, 0.06, 0.02, 8]} /></M>
      </group>
    </group>
  ),
  /** A red jerrycan of fuel: the X pressed in its side, the handle, the yellow cap. */
  essence: () => (
    <group>
      <Box p={[0, 0.34, 0]} s={[0.62, 0.68, 0.3]} c="#e03131" />
      {[-0.7, 0.7].map((t) => <M key={t} p={[0, 0.32, 0.155]} r={[0, 0, t]} c="#c92a2a"><boxGeometry args={[0.07, 0.62, 0.02]} /></M>)}
      <Box p={[-0.08, 0.76, 0]} s={[0.34, 0.06, 0.1]} c="#c92a2a" />
      {[-0.22, 0.06].map((x) => <Box key={x} p={[x, 0.71, 0]} s={[0.05, 0.08, 0.1]} c="#c92a2a" />)}
      <M p={[0.22, 0.74, 0]} r={[0, 0, -0.4]} c="#c92a2a"><cylinderGeometry args={[0.06, 0.07, 0.14, 8]} /></M>
      <M p={[0.26, 0.82, 0]} r={[0, 0, -0.4]} c="#fcc419"><cylinderGeometry args={[0.075, 0.075, 0.06, 8]} /></M>
    </group>
  ),
  /** A hi-vis vest laid flat: yellow panels, silver reflective bands. */
  gilet: () => (
    <group>
      {[-1, 1].map((k) => (
        <group key={k}>
          <Box p={[k * 0.2, 0.03, 0.08]} s={[0.36, 0.06, 0.68]} c="#d8f000" />
          <Box p={[k * 0.3, 0.03, -0.38]} s={[0.16, 0.06, 0.26]} c="#d8f000" />
          <Box p={[k * 0.13, 0.03, -0.27]} s={[0.1, 0.06, 0.12]} c="#d8f000" r={k * 0.5} />
          {[0.06, 0.28].map((z) => <Box key={z} p={[k * 0.2, 0.065, z]} s={[0.36, 0.02, 0.07]} c="#e9ecef" glow={0.3} />)}
          <Box p={[k * 0.3, 0.065, -0.3]} s={[0.07, 0.02, 0.36]} c="#e9ecef" glow={0.3} />
        </group>
      ))}
      <Box p={[0, 0.02, 0.1]} s={[0.04, 0.04, 0.64]} c="#495057" />
    </group>
  ),
  /** A referee's whistle on its red cord. */
  sifflet: () => (
    <group>
      <M p={[0.1, 0.2, 0]} r={[PI / 2, 0, 0]} c="#ced4da"><cylinderGeometry args={[0.2, 0.2, 0.26, 12]} /></M>
      <Box p={[-0.22, 0.3, 0]} s={[0.44, 0.16, 0.24]} c="#ced4da" />
      <Box p={[-0.04, 0.385, 0]} s={[0.1, 0.02, 0.14]} c="#212529" />
      <Box p={[-0.44, 0.3, 0]} s={[0.02, 0.06, 0.14]} c="#212529" />
      <M p={[0.1, 0.2, 0.135]} r={[PI / 2, 0, 0]} c="#adb5bd"><cylinderGeometry args={[0.12, 0.12, 0.01, 10]} /></M>
      <M p={[0.3, 0.32, 0]} r={[0, PI / 2, 0]} c="#868e96"><torusGeometry args={[0.06, 0.015, 4, 8]} /></M>
      <M p={[0.34, 0.02, 0.22]} r={[PI / 2, 0, 0]} sc={[1, 1.3, 1]} c="#e03131"><torusGeometry args={[0.2, 0.02, 4, 14]} /></M>
      <Box p={[0.32, 0.17, 0]} s={[0.03, 0.3, 0.03]} c="#e03131" />
    </group>
  ),
  /** Handcuffs laid flat: two steel rings and their chain. */
  menottes: () => (
    <group>
      {[-1, 1].map((k) => (
        <group key={k} position={[k * 0.3, 0, 0]}>
          <M p={[0, 0.04, 0]} r={[PI / 2, 0, 0]} c="#adb5bd"><torusGeometry args={[0.2, 0.045, 6, 14]} /></M>
          <Box p={[-k * 0.2, 0.05, 0]} s={[0.12, 0.1, 0.16]} c="#868e96" />
        </group>
      ))}
      {[-0.08, 0, 0.08].map((x, i) => (
        <M key={x} p={[x, 0.03, 0]} r={[i % 2 ? PI / 2 : 0, 0, 0]} c="#ced4da"><torusGeometry args={[0.035, 0.012, 4, 8]} /></M>
      ))}
    </group>
  ),
  /** An ID badge on its lanyard: the photo, the lines, the clip, the blue strap. */
  badge: () => (
    <group>
      <Box p={[-0.2, 0.01, -0.28]} s={[0.07, 0.02, 0.55]} c="#1c7ed6" r={0.7} />
      <Box p={[0.2, 0.01, -0.28]} s={[0.07, 0.02, 0.55]} c="#1c7ed6" r={-0.7} />
      <Box p={[0, 0.01, -0.49]} s={[0.8, 0.02, 0.07]} c="#1c7ed6" />
      <Box p={[0, 0.025, -0.08]} s={[0.1, 0.03, 0.12]} c="#adb5bd" />
      <Box p={[0, 0.02, 0.22]} s={[0.46, 0.04, 0.5]} c="#f8f9fa" />
      <Box p={[0, 0.045, 0.02]} s={[0.46, 0.01, 0.1]} c="#1c7ed6" />
      <Box p={[-0.11, 0.045, 0.2]} s={[0.16, 0.01, 0.2]} c="#8d5524" />
      <Box p={[-0.11, 0.05, 0.16]} s={[0.08, 0.01, 0.08]} c="#5a3418" />
      {[0, 1, 2].map((i) => <Box key={i} p={[0.11, 0.045, 0.13 + i * 0.07]} s={[0.16 - i * 0.04, 0.01, 0.03]} c="#868e96" />)}
      <Box p={[0, 0.045, 0.41]} s={[0.36, 0.01, 0.05]} c="#212529" />
    </group>
  ),
}
