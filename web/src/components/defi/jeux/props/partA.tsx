import { Box, Mat } from '../../../../world3d/props'
import type { PropId } from '../types'

// The games' objects, part A: food, drink, the kitchen; money, papers, the office. Built like
// world3d/props: blocks, a few low-poly round bits, flat-shaded Lambert; ~1 unit, on y = 0, front +z.

type V = [number, number, number]

function Cyl({ p, r, h, c, top, seg = 10, rot, glow }: { p: V; r: number; h: number; c: string; top?: number; seg?: number; rot?: V; glow?: number }) {
  return (
    <mesh position={p} rotation={rot} castShadow receiveShadow>
      <cylinderGeometry args={[top ?? r, r, h, seg]} />
      <Mat color={c} emissive={glow ? c : undefined} intensity={glow} />
    </mesh>
  )
}

function Ball({ p, r, c, s, seg = 8, half }: { p: V; r: number; c: string; s?: V; seg?: number; half?: 'up' | 'down' }) {
  return (
    <mesh position={p} scale={s} rotation={half === 'down' ? [Math.PI, 0, 0] : undefined} castShadow receiveShadow>
      <sphereGeometry args={half ? [r, seg, seg / 2, 0, Math.PI * 2, 0, Math.PI / 2] : [r, seg, seg - 2]} />
      <Mat color={c} />
    </mesh>
  )
}

function Cone({ p, r, h, c, seg = 8, rot }: { p: V; r: number; h: number; c: string; seg?: number; rot?: V }) {
  return (
    <mesh position={p} rotation={rot} castShadow>
      <coneGeometry args={[r, h, seg]} />
      <Mat color={c} />
    </mesh>
  )
}

function Ring({ p, r, t, c, rot, arc = Math.PI * 2 }: { p: V; r: number; t: number; c: string; rot?: V; arc?: number }) {
  return (
    <mesh position={p} rotation={rot} castShadow>
      <torusGeometry args={[r, t, 6, 12, arc]} />
      <Mat color={c} />
    </mesh>
  )
}

/** See-through glass or plastic: a cylinder, or a block when `box` is given. */
function Glass({ p, r = 0, h = 0, top, c = '#d0ebff', o = 0.35, box }: { p: V; r?: number; h?: number; top?: number; c?: string; o?: number; box?: V }) {
  return (
    <mesh position={p}>
      {box ? <boxGeometry args={box} /> : <cylinderGeometry args={[top ?? r, r, h, 10]} />}
      <meshLambertMaterial color={c} transparent opacity={o} depthWrite={false} flatShading />
    </mesh>
  )
}

/** A white plate; the food on it sits from y = 0.07. */
function Plate({ children }: { children?: React.ReactNode }) {
  return (
    <>
      <Cyl p={[0, 0.03, 0]} r={0.4} top={0.5} h={0.06} c="#f8f9fa" seg={12} />
      <Cyl p={[0, 0.062, 0]} r={0.33} h={0.01} c="#e9ecef" seg={12} />
      {children}
    </>
  )
}

/** A bottle: body, label band, shoulder, neck, cap. */
function Bottle({ glass, label, cap, h = 0.5, r = 0.14 }: { glass: string; label: string; cap: string; h?: number; r?: number }) {
  return (
    <>
      <Cyl p={[0, h / 2, 0]} r={r} h={h} c={glass} />
      <Cyl p={[0, h * 0.45, 0]} r={r + 0.008} h={h * 0.38} c={label} />
      <Cyl p={[0, h + 0.07, 0]} r={r} top={0.055} h={0.14} c={glass} />
      <Cyl p={[0, h + 0.23, 0]} r={0.055} h={0.18} c={glass} />
      <Cyl p={[0, h + 0.34, 0]} r={0.065} h={0.05} c={cap} />
    </>
  )
}

export const PROPS_A: Partial<Record<PropId, () => React.ReactElement>> = {
  /** A plain white plate. */
  assiette: () => <Plate />,

  /** Garba: the attiéké heaped up, the fried tuna piece, chili and onion. */
  garba: () => (
    <Plate>
      <Cyl p={[-0.1, 0.15, -0.02]} r={0.27} top={0.12} h={0.17} c="#f2e6c9" seg={9} />
      <Ball p={[-0.1, 0.23, -0.02]} r={0.13} c="#f5ecd6" half="up" s={[1, 0.6, 1]} />
      <Box p={[0.2, 0.12, 0.08]} s={[0.26, 0.1, 0.18]} c="#9a5a22" r={0.4} />
      <Box p={[0.2, 0.18, 0.08]} s={[0.2, 0.03, 0.13]} c="#7a4318" r={0.4} />
      <Box p={[0.05, 0.1, 0.27]} s={[0.07, 0.05, 0.05]} c="#e03131" />
      <Box p={[-0.25, 0.09, 0.22]} s={[0.1, 0.03, 0.06]} c="#c8a2c8" r={0.5} />
    </Plate>
  ),

  /** Alloco: the fried plantain pieces, golden and orange. */
  alloco: () => (
    <Plate>
      {([[-0.18, 0.1, 0.3], [0.02, -0.16, -0.4], [0.18, 0.08, 1], [-0.05, 0.18, 1.6], [0.12, -0.05, 2.3], [-0.16, -0.12, 0.8], [0.0, 0.02, 2.0]] as const).map(([x, z, r], i) => (
        <Box key={i} p={[x, 0.11 + (i === 6 ? 0.07 : 0), z]} s={[0.17, 0.08, 0.11]} c={i % 2 ? '#f08c00' : '#e8a33c'} r={r} />
      ))}
      <Box p={[0.26, 0.1, -0.2]} s={[0.06, 0.05, 0.05]} c="#e03131" />
    </Plate>
  ),

  /** Attiéké: a heap of it in a wooden bowl. */
  attieke: () => (
    <>
      <Cyl p={[0, 0.13, 0]} r={0.26} top={0.42} h={0.26} c="#8a5a2b" seg={12} />
      <Cyl p={[0, 0.265, 0]} r={0.4} h={0.01} c="#6b4423" seg={12} />
      <Ball p={[0, 0.26, 0]} r={0.34} c="#f2e6c9" half="up" s={[1, 0.65, 1]} seg={10} />
      {([[-0.1, 0.12], [0.12, -0.05], [0.02, 0.2], [-0.15, -0.12]] as const).map(([x, z], i) => (
        <Box key={i} p={[x, 0.44 - Math.abs(x) * 0.3, z]} s={[0.04, 0.03, 0.04]} c="#e6d5ad" />
      ))}
    </>
  ),

  /** A whole braised fish lying on its side: the round body, head and eye, the forked tail. */
  poisson: () => (
    <>
      <Ball p={[0, 0.16, 0]} r={1} c="#b5651d" s={[0.4, 0.16, 0.11]} seg={10} />
      <Box p={[0, 0.31, 0]} s={[0.36, 0.06, 0.04]} c="#8a4a18" />
      <Box p={[0.3, 0.15, 0]} s={[0.04, 0.03, 0.16]} c="#6b3a12" />
      <Ball p={[0.26, 0.19, 0.075]} r={0.04} c="#f8f9fa" />
      <Box p={[0.27, 0.19, 0.11]} s={[0.025, 0.025, 0.01]} c="#212529" />
      <group position={[-0.42, 0.16, 0]}>
        <Box p={[-0.06, 0.08, 0]} s={[0.16, 0.08, 0.05]} c="#8a4a18" r={0} />
        <Box p={[-0.06, -0.08, 0]} s={[0.16, 0.08, 0.05]} c="#8a4a18" />
        <Box p={[0.02, 0, 0]} s={[0.1, 0.12, 0.06]} c="#9a5a22" />
      </group>
      {[-0.15, 0.0, 0.15].map((x) => (
        <Box key={x} p={[x, 0.17, 0.1 - Math.abs(x) * 0.15]} s={[0.03, 0.14, 0.02]} c="#6b3a12" />
      ))}
    </>
  ),

  /** A roast chicken with its two legs. */
  poulet: () => (
    <Plate>
      <Ball p={[0, 0.24, -0.04]} r={0.27} c="#c8742c" s={[1.1, 0.75, 1]} seg={10} />
      <Ball p={[0, 0.34, -0.06]} r={0.16} c="#d9893a" s={[1.2, 0.5, 1]} />
      {[-0.17, 0.17].map((x) => (
        <group key={x}>
          <Ball p={[x, 0.18, 0.17]} r={0.11} c="#b8642a" s={[1, 0.9, 1.3]} />
          <Cyl p={[x * 1.1, 0.2, 0.32]} r={0.03} h={0.12} c="#f1e3c8" rot={[Math.PI / 2, 0, 0]} seg={6} />
          <Ball p={[x * 1.1, 0.2, 0.39]} r={0.045} c="#f8f0e0" />
        </group>
      ))}
    </Plate>
  ),

  /** Two brochettes: meat and onion on the stick. */
  brochette: () => (
    <>
      {[-0.15, 0.15].map((z) => (
        <group key={z} position={[0, 0, z]} rotation={[0, z * 0.6, 0]}>
          <Box p={[0, 0.08, 0]} s={[1.0, 0.03, 0.03]} c="#d4b483" />
          {[-0.32, -0.16, 0, 0.16, 0.32].map((x, i) => (
            <Box key={x} p={[x, 0.09, 0]} s={[0.14, 0.15, 0.15]} c={i % 2 ? '#e8d2a8' : '#7a3a17'} r={i * 0.3} />
          ))}
        </group>
      ))}
    </>
  ),

  /** Foutou: the round yellowish-white ball in its red-orange sauce, in a clay bowl. */
  foutou: () => (
    <>
      <Cyl p={[0, 0.12, 0]} r={0.3} top={0.45} h={0.24} c="#6b3e26" seg={12} />
      <Cyl p={[0, 0.235, 0]} r={0.43} h={0.02} c="#d9480f" seg={12} />
      <Ball p={[0, 0.34, 0]} r={0.22} c="#f3ead2" seg={10} />
      <Box p={[0.25, 0.25, 0.12]} s={[0.1, 0.06, 0.08]} c="#5c2a12" />
      <Box p={[-0.22, 0.25, 0.18]} s={[0.07, 0.04, 0.07]} c="#2b8a3e" />
    </>
  ),

  /** A plate of white rice with a brown sauce beside. */
  riz: () => (
    <Plate>
      <Cyl p={[-0.06, 0.13, 0]} r={0.29} top={0.18} h={0.13} c="#ffffff" seg={10} />
      <Ball p={[-0.06, 0.19, 0]} r={0.18} c="#f8f9fa" half="up" s={[1, 0.7, 1]} />
      <Cyl p={[0.24, 0.085, 0.12]} r={0.14} h={0.03} c="#8b4513" seg={8} />
      <Box p={[0.24, 0.11, 0.12]} s={[0.08, 0.05, 0.07]} c="#6b3a12" />
    </Plate>
  ),

  /** A baguette, scored across. */
  pain: () => (
    <group rotation={[0, 0.3, 0]}>
      <Cyl p={[0, 0.11, 0]} r={0.11} h={0.86} c="#d9a35b" rot={[0, 0, Math.PI / 2]} seg={8} />
      <Ball p={[0.43, 0.11, 0]} r={0.11} c="#c98f45" />
      <Ball p={[-0.43, 0.11, 0]} r={0.11} c="#c98f45" />
      {[-0.27, -0.09, 0.09, 0.27].map((x) => (
        <Box key={x} p={[x, 0.21, 0]} s={[0.12, 0.02, 0.05]} c="#f2d49b" r={0.6} />
      ))}
    </group>
  ),

  /** A croissant: its puffed segments on an arc. */
  croissant: () => (
    <>
      {[-2, -1, 0, 1, 2].map((i) => {
        const a = (i * Math.PI) / 5.5
        const r = [0.09, 0.13, 0.17, 0.13, 0.09][i + 2]
        return <Ball key={i} p={[Math.sin(a) * 0.32, r * 0.8, -Math.cos(a) * 0.32 + 0.2]} r={r} c={i % 2 ? '#c87a2a' : '#dd9a45'} s={[1, 0.8, 1.15]} />
      })}
    </>
  ),

  /** A burger: bun, patty, cheese, lettuce, tomato, the seeded top. */
  burger: () => (
    <>
      <Cyl p={[0, 0.06, 0]} r={0.38} h={0.12} c="#d9963f" seg={12} />
      <Cyl p={[0, 0.17, 0]} r={0.4} h={0.1} c="#5c3317" seg={12} />
      <Box p={[0, 0.235, 0]} s={[0.62, 0.03, 0.62]} c="#fcc419" r={Math.PI / 4} />
      <Cyl p={[0, 0.27, 0]} r={0.42} h={0.04} c="#40c057" seg={9} />
      <Cyl p={[0, 0.31, 0]} r={0.36} h={0.04} c="#e03131" seg={12} />
      <Ball p={[0, 0.33, 0]} r={0.39} c="#e0a04d" half="up" s={[1, 0.6, 1]} seg={12} />
      {([[-0.12, 0.1], [0.1, 0.15], [0.05, -0.12], [-0.15, -0.08], [0.18, -0.02]] as const).map(([x, z], i) => (
        <Box key={i} p={[x, 0.55 - (x * x + z * z) * 1.2, z]} s={[0.04, 0.02, 0.025]} c="#fff4d6" r={i} />
      ))}
    </>
  ),

  /** A pizza: crust, cheese, pepperoni, olives, green pepper. */
  pizza: () => (
    <>
      <Cyl p={[0, 0.035, 0]} r={0.5} h={0.07} c="#d9964a" seg={12} />
      <Cyl p={[0, 0.075, 0]} r={0.43} h={0.02} c="#f6c453" seg={12} />
      {([[0, 0], [0.22, 0.12], [-0.2, 0.15], [0.05, -0.25], [-0.18, -0.15], [0.25, -0.12], [0.02, 0.28]] as const).map(([x, z], i) => (
        <Cyl key={i} p={[x, 0.09, z]} r={0.07} h={0.02} c="#c92a2a" seg={8} />
      ))}
      {([[0.12, 0.02], [-0.08, 0.12], [-0.05, -0.12], [0.3, 0.05]] as const).map(([x, z], i) => (
        <Box key={i} p={[x, 0.095, z]} s={[0.04, 0.03, 0.04]} c="#212529" />
      ))}
      {([[0.14, 0.24], [-0.3, 0.0], [0.14, -0.2]] as const).map(([x, z], i) => (
        <Box key={i} p={[x, 0.095, z]} s={[0.1, 0.02, 0.03]} c="#2f9e44" r={i} />
      ))}
    </>
  ),

  /** An ice cream cone, two scoops. */
  glace: () => (
    <>
      <Cone p={[0, 0.26, 0]} r={0.17} h={0.52} c="#d9a35b" rot={[Math.PI, 0, 0]} seg={8} />
      <Cyl p={[0, 0.5, 0]} r={0.18} h={0.04} c="#c98f45" seg={8} />
      <Ball p={[0, 0.62, 0]} r={0.2} c="#f783ac" seg={10} />
      <Ball p={[0, 0.84, 0]} r={0.17} c="#7a4a24" seg={10} />
      <Ball p={[0, 1.02, 0]} r={0.05} c="#e03131" />
    </>
  ),

  /** A birthday cake: two layers, cream, candles, strawberries. */
  gateau: () => (
    <>
      <Cyl p={[0, 0.02, 0]} r={0.5} h={0.04} c="#e9ecef" seg={12} />
      <Cyl p={[0, 0.14, 0]} r={0.42} h={0.2} c="#8b5a2b" seg={12} />
      <Cyl p={[0, 0.26, 0]} r={0.43} h={0.04} c="#fff4e6" seg={12} />
      <Cyl p={[0, 0.37, 0]} r={0.42} h={0.18} c="#f8a5c2" seg={12} />
      <Cyl p={[0, 0.47, 0]} r={0.44} h={0.03} c="#ffffff" seg={12} />
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2
        return <Ball key={i} p={[Math.sin(a) * 0.32, 0.53, Math.cos(a) * 0.32]} r={0.05} c="#e03131" />
      })}
      {[-0.12, 0, 0.12].map((x) => (
        <group key={x}>
          <Cyl p={[x, 0.6, 0]} r={0.02} h={0.22} c="#74c0fc" seg={6} />
          <Cone p={[x, 0.75, 0]} r={0.03} h={0.07} c="#ffd43b" seg={6} />
        </group>
      ))}
    </>
  ),

  /** A mango: yellow-orange, blushing red, its stem and leaf. */
  mangue: () => (
    <>
      <Ball p={[0, 0.25, 0]} r={0.3} c="#f59f00" s={[1.2, 0.85, 0.85]} seg={10} />
      <Ball p={[0.06, 0.28, 0.01]} r={0.3} c="#e8590c" s={[1.05, 0.78, 0.8]} seg={10} />
      <Cyl p={[-0.3, 0.42, 0]} r={0.02} h={0.08} c="#5c3d1e" seg={6} />
      <Box p={[-0.2, 0.46, 0.02]} s={[0.2, 0.02, 0.08]} c="#2b8a3e" r={0.4} />
    </>
  ),

  /** A pineapple: the scaly yellow-brown body and its green crown. */
  ananas: () => (
    <>
      <Ball p={[0, 0.33, 0]} r={0.27} c="#d9a321" s={[1, 1.25, 1]} seg={10} />
      {[0.2, 0.36, 0.52].flatMap((y, j) =>
        [0, 1, 2, 3, 4].map((i) => {
          const a = (i / 5) * Math.PI * 2 + j * 0.6
          const r = 0.27 * Math.sqrt(1 - ((y - 0.33) / 0.34) ** 2) + 0.005
          return <Box key={`${j}-${i}`} p={[Math.sin(a) * r, y, Math.cos(a) * r]} s={[0.06, 0.06, 0.06]} c="#9c6b12" r={a} />
        }),
      )}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <group key={i} position={[0, 0.66, 0]} rotation={[0, (i / 6) * Math.PI * 2, 0]}>
          <Cone p={[0, 0.16, 0.08]} r={0.08} h={0.36} c={i % 2 ? '#2f9e44' : '#37b24d'} seg={4} rot={[0.6, 0, 0]} />
        </group>
      ))}
      <Cone p={[0, 0.88, 0]} r={0.08} h={0.4} c="#2b8a3e" seg={4} />
    </>
  ),

  /** A hand of three bananas. */
  banane: () => (
    <>
      {[-1, 0, 1].map((i) => (
        <group key={i} position={[-0.36, 0, 0]} rotation={[0, i * 0.45, 0]}>
          <group position={[0.36, 0.47, 0]}>
            <Ring p={[0, 0, 0]} r={0.4} t={0.085} c={i ? '#fcc419' : '#ffd43b'} rot={[0, 0, -Math.PI / 2 - 1]} arc={2} />
            <Box p={[0.34, -0.22, 0]} s={[0.05, 0.05, 0.05]} c="#343a40" />
          </group>
        </group>
      ))}
      <Box p={[-0.38, 0.26, 0]} s={[0.12, 0.1, 0.12]} c="#6b8e23" />
    </>
  ),

  /** A brown coconut and an open half showing the white flesh. */
  'noix-coco': () => (
    <>
      <Ball p={[-0.18, 0.28, -0.05]} r={0.28} c="#7a4a24" seg={10} />
      {[0, 1, 2].map((i) => (
        <Box key={i} p={[-0.18 + (i - 1) * 0.08, 0.52, 0.02]} s={[0.04, 0.03, 0.04]} c="#3b2412" />
      ))}
      <Ball p={[0.25, 0.22, 0.12]} r={0.22} c="#6b3e1c" half="down" seg={10} />
      <Cyl p={[0.25, 0.215, 0.12]} r={0.2} h={0.02} c="#fbf7ef" seg={10} />
      <Cyl p={[0.25, 0.225, 0.12]} r={0.11} h={0.01} c="#e7f5ff" seg={10} />
    </>
  ),

  /** A green glass bottle with its label band and cap. */
  bouteille: () => <Bottle glass="#2b8a3e" label="#f1f3f5" cap="#fab005" />,

  /** Beer: the big brown bottle and a glass with its foam. */
  biere: () => (
    <>
      <group position={[-0.15, 0, -0.05]}>
        <Bottle glass="#6b3a12" label="#e03131" cap="#ffd43b" h={0.55} r={0.15} />
      </group>
      <Glass p={[0.24, 0.2, 0.12]} r={0.12} top={0.15} h={0.4} />
      <Cyl p={[0.24, 0.16, 0.12]} r={0.11} top={0.135} h={0.3} c="#f59f00" />
      <Cyl p={[0.24, 0.36, 0.12]} r={0.14} top={0.155} h={0.1} c="#fffaf0" />
    </>
  ),

  /** A soda can: red with a white band, the silver top and tab. */
  soda: () => (
    <>
      <Cyl p={[0, 0.27, 0]} r={0.2} h={0.5} c="#e03131" seg={12} />
      <Cyl p={[0, 0.27, 0]} r={0.205} h={0.12} c="#f8f9fa" seg={12} />
      <Cyl p={[0, 0.015, 0]} r={0.17} top={0.2} h={0.03} c="#ced4da" seg={12} />
      <Cyl p={[0, 0.535, 0]} r={0.2} top={0.17} h={0.03} c="#ced4da" seg={12} />
      <Box p={[0.04, 0.555, 0.02]} s={[0.1, 0.015, 0.06]} c="#adb5bd" />
    </>
  ),

  /** A glass of orange juice, a straw, a slice on the rim. */
  jus: () => (
    <>
      <Cyl p={[0, 0.25, 0]} r={0.19} top={0.225} h={0.5} c="#ff922b" />
      <Glass p={[0, 0.3, 0]} r={0.2} top={0.24} h={0.6} o={0.2} />
      <group position={[0.06, 0.55, -0.04]} rotation={[0, 0, -0.3]}>
        <Cyl p={[0, 0, 0]} r={0.025} h={0.55} c="#f06595" seg={6} />
      </group>
      <Cyl p={[-0.2, 0.58, 0.1]} r={0.12} h={0.04} c="#ffa94d" rot={[Math.PI / 2, 0, 0.5]} seg={10} />
      <Cyl p={[-0.2, 0.58, 0.122]} r={0.09} h={0.01} c="#ffd8a8" rot={[Math.PI / 2, 0, 0.5]} seg={10} />
    </>
  ),

  /** The sachet d'eau: the small sealed plastic bag of water, crimped at both ends. */
  'sachet-eau': () => (
    <group rotation={[0, 0.3, 0]}>
      <Ball p={[0, 0.12, 0]} r={0.3} c="#a5d8ff" s={[1.25, 0.42, 0.85]} seg={10} />
      {[-0.4, 0.4].map((x) => (
        <Box key={x} p={[x, 0.1, 0]} s={[0.1, 0.03, 0.44]} c="#e7f5ff" />
      ))}
      <Box p={[0, 0.235, 0]} s={[0.3, 0.03, 0.24]} c="#1c7ed6" />
      <Box p={[0, 0.252, 0]} s={[0.18, 0.01, 0.06]} c="#ffffff" />
    </group>
  ),

  /** A cup of black coffee on its saucer. */
  cafe: () => (
    <>
      <Cyl p={[0, 0.02, 0]} r={0.32} top={0.36} h={0.04} c="#f8f9fa" seg={12} />
      <Cyl p={[0, 0.18, 0]} r={0.16} top={0.22} h={0.28} c="#ffffff" seg={12} />
      <Cyl p={[0, 0.322, 0]} r={0.19} h={0.01} c="#3b2412" seg={12} />
      <Ring p={[0.24, 0.2, 0]} r={0.07} t={0.025} c="#ffffff" />
    </>
  ),

  /** Grin tea: the small glass of amber tea with its foam, the blue enamel teapot. */
  the: () => (
    <>
      <Glass p={[0.24, 0.17, 0.12]} r={0.11} top={0.13} h={0.34} />
      <Cyl p={[0.24, 0.12, 0.12]} r={0.1} top={0.115} h={0.22} c="#c2410c" />
      <Cyl p={[0.24, 0.29, 0.12]} r={0.115} top={0.13} h={0.12} c="#fff4e0" />
      <Cyl p={[-0.18, 0.2, -0.08]} r={0.2} top={0.13} h={0.4} c="#1c7ed6" seg={10} />
      <Cyl p={[-0.18, 0.43, -0.08]} r={0.13} top={0.08} h={0.06} c="#1864ab" seg={10} />
      <Ball p={[-0.18, 0.48, -0.08]} r={0.04} c="#1864ab" />
      <group position={[0.03, 0.22, -0.08]} rotation={[0, 0, -0.9]}>
        <Cyl p={[0, 0.12, 0]} r={0.04} top={0.022} h={0.26} c="#1c7ed6" seg={6} />
      </group>
      <Ring p={[-0.39, 0.25, -0.08]} r={0.09} t={0.025} c="#1864ab" />
    </>
  ),

  /** A glass of water. */
  verre: () => (
    <>
      <Glass p={[0, 0.3, 0]} r={0.18} top={0.23} h={0.6} />
      <Cyl p={[0, 0.02, 0]} r={0.18} h={0.04} c="#dbe4ff" />
      <Glass p={[0, 0.21, 0]} r={0.17} top={0.2} h={0.38} c="#74c0fc" o={0.55} />
    </>
  ),

  /** A cocktail: the stemmed glass, pink drink, a cherry, a paper umbrella. */
  cocktail: () => (
    <>
      <Cyl p={[0, 0.015, 0]} r={0.2} h={0.03} c="#dee2e6" seg={10} />
      <Cyl p={[0, 0.22, 0]} r={0.025} h={0.4} c="#dee2e6" seg={6} />
      <mesh position={[0, 0.58, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.34, 0.36, 10]} />
        <meshLambertMaterial color="#d0ebff" transparent opacity={0.35} depthWrite={false} flatShading />
      </mesh>
      <Cone p={[0, 0.6, 0]} r={0.29} h={0.3} c="#f06595" rot={[Math.PI, 0, 0]} seg={10} />
      <Cyl p={[0, 0.75, 0]} r={0.3} h={0.01} c="#f783ac" seg={10} />
      <Ball p={[0.12, 0.8, 0.08]} r={0.06} c="#c92a2a" />
      <Cyl p={[-0.1, 0.85, 0]} r={0.012} h={0.3} c="#f8f9fa" rot={[0, 0, 0.3]} seg={4} />
      <Cone p={[-0.15, 1.0, 0]} r={0.18} h={0.1} c="#ffd43b" seg={8} rot={[0, 0, 0.3]} />
    </>
  ),

  /** Popcorn in its red and white striped box. */
  popcorn: () => (
    <>
      <Box p={[0, 0.27, 0]} s={[0.44, 0.54, 0.44]} c="#ffffff" />
      {[-0.13, 0.13].map((x) => (
        <group key={x}>
          <Box p={[x, 0.27, 0]} s={[0.1, 0.54, 0.45]} c="#e03131" />
          <Box p={[0, 0.27, x]} s={[0.45, 0.54, 0.1]} c="#e03131" />
        </group>
      ))}
      {Array.from({ length: 14 }, (_, i) => {
        const a = i * 2.4
        const d = (i % 4) * 0.06
        return <Ball key={i} p={[Math.sin(a) * d, 0.58 + (3 - (i % 4)) * 0.04, Math.cos(a) * d]} r={0.08} c={i % 3 ? '#fff9db' : '#ffe066'} seg={6} />
      })}
    </>
  ),

  /** Three wrapped sweets with their twisted ends. */
  bonbon: () => (
    <>
      {([[-0.1, -0.18, '#f06595', 0.2], [0.18, 0.06, '#ffd43b', -0.4], [-0.15, 0.24, '#4dabf7', 0.6]] as const).map(([x, z, c, r], i) => (
        <group key={i} position={[x, 0.11, z]} rotation={[0, r, 0]}>
          <Ball p={[0, 0, 0]} r={0.13} c={c} s={[1.3, 0.85, 0.85]} />
          <Cone p={[0.22, 0, 0]} r={0.09} h={0.14} c={c} rot={[0, 0, Math.PI / 2]} seg={6} />
          <Cone p={[-0.22, 0, 0]} r={0.09} h={0.14} c={c} rot={[0, 0, -Math.PI / 2]} seg={6} />
        </group>
      ))}
    </>
  ),

  /** Two chili peppers, red and green, their stems. */
  piment: () => (
    <>
      {([[-0.08, '#e03131', 0.3], [0.12, '#2f9e44', -0.3]] as const).map(([z, c, r], i) => (
        <group key={i} position={[0, 0.1, z * 1.5]} rotation={[0, r, 0]}>
          <Cyl p={[-0.08, 0, 0]} r={0.1} top={0.09} h={0.3} c={c} rot={[0, 0, Math.PI / 2]} seg={8} />
          <group position={[0.07, 0, 0]} rotation={[0, 0.5, 0]}>
            <Cone p={[0.14, 0, 0]} r={0.09} h={0.28} c={c} rot={[0, 0, -Math.PI / 2]} seg={8} />
          </group>
          <Cyl p={[-0.25, 0.0, 0]} r={0.08} h={0.05} c="#2b8a3e" rot={[0, 0, Math.PI / 2]} seg={6} />
          <Box p={[-0.31, 0.03, 0]} s={[0.09, 0.03, 0.03]} c="#5c940d" />
        </group>
      ))}
    </>
  ),

  /** A ripe tomato with its green star on top. */
  tomate: () => (
    <>
      <Ball p={[0, 0.27, 0]} r={0.33} c="#e03131" s={[1, 0.82, 1]} seg={10} />
      {[0, 1, 2, 3, 4].map((i) => (
        <Box key={i} p={[Math.sin((i / 5) * Math.PI * 2) * 0.07, 0.535, Math.cos((i / 5) * Math.PI * 2) * 0.07]} s={[0.04, 0.02, 0.16]} c="#2b8a3e" r={(i / 5) * Math.PI * 2} />
      ))}
      <Cyl p={[0, 0.58, 0]} r={0.025} h={0.08} c="#2b8a3e" seg={6} />
    </>
  ),

  /** A purple onion, its tip and dry roots. */
  oignon: () => (
    <>
      <Ball p={[0, 0.28, 0]} r={0.3} c="#9c4f8f" s={[1, 0.9, 1]} seg={10} />
      <Cone p={[0, 0.6, 0]} r={0.1} h={0.18} c="#b565a7" seg={8} />
      <Cyl p={[0, 0.72, 0]} r={0.02} h={0.08} c="#d9c8a0" seg={5} />
      {[-0.05, 0, 0.05].map((x) => (
        <Box key={x} p={[x, 0.02, 0]} s={[0.02, 0.04, 0.02]} c="#d9c8a0" />
      ))}
    </>
  ),

  /** The aluminium cooking pot: rim, lid and knob, side handles. */
  marmite: () => (
    <>
      <Cyl p={[0, 0.23, 0]} r={0.38} top={0.42} h={0.46} c="#adb5bd" seg={12} />
      <Ring p={[0, 0.46, 0]} r={0.42} t={0.03} c="#ced4da" rot={[Math.PI / 2, 0, 0]} />
      <Cyl p={[0, 0.5, 0]} r={0.42} top={0.3} h={0.07} c="#ced4da" seg={12} />
      <Cyl p={[0, 0.57, 0]} r={0.06} top={0.08} h={0.07} c="#343a40" seg={8} />
      {[-0.47, 0.47].map((x) => (
        <Box key={x} p={[x, 0.38, 0]} s={[0.1, 0.05, 0.22]} c="#495057" />
      ))}
      <Cyl p={[0, 0.06, 0]} r={0.385} h={0.12} c="#343a40" seg={12} />
    </>
  ),

  /** A frying pan with a fried egg in it, the long handle. */
  poele: () => (
    <group position={[-0.18, 0, 0.08]} rotation={[0, 0.4, 0]}>
      <Cyl p={[0, 0.05, 0]} r={0.33} top={0.38} h={0.1} c="#343a40" seg={12} />
      <Cyl p={[0, 0.101, 0]} r={0.33} h={0.005} c="#495057" seg={12} />
      <Box p={[0.6, 0.1, 0]} s={[0.46, 0.06, 0.1]} c="#212529" />
      <Box p={[0.4, 0.09, 0]} s={[0.1, 0.05, 0.06]} c="#868e96" />
      <Cyl p={[0, 0.11, 0]} r={0.18} h={0.02} c="#ffffff" seg={9} />
      <Ball p={[0.03, 0.12, 0.02]} r={0.08} c="#fab005" half="up" />
    </group>
  ),

  /** A ladle: the round bowl and its long handle hooked at the end. */
  louche: () => (
    <>
      <Ball p={[-0.25, 0.18, 0.05]} r={0.18} c="#adb5bd" half="down" seg={10} />
      <Cyl p={[-0.25, 0.175, 0.05]} r={0.16} h={0.01} c="#868e96" seg={10} />
      <group position={[-0.08, 0.18, 0.05]} rotation={[0, 0, 0.4]}>
        <Box p={[0.28, 0, 0]} s={[0.56, 0.04, 0.07]} c="#ced4da" />
        <Box p={[0.57, -0.05, 0]} s={[0.05, 0.14, 0.07]} c="#ced4da" />
      </group>
    </>
  ),

  /** A kitchen knife: steel blade, wooden handle with rivets. */
  couteau: () => (
    <group rotation={[0, 0.25, 0]}>
      <Box p={[0.12, 0.03, 0]} s={[0.56, 0.04, 0.2]} c="#ced4da" />
      <Box p={[0.12, 0.051, -0.08]} s={[0.56, 0.004, 0.03]} c="#f1f3f5" />
      <mesh position={[0.43, 0.03, -0.035]} rotation={[0, 0, 0]} scale={[1.4, 1, 0.75]}>
        <cylinderGeometry args={[0.11, 0.11, 0.04, 3]} />
        <Mat color="#ced4da" />
      </mesh>
      <Box p={[-0.33, 0.045, -0.01]} s={[0.36, 0.09, 0.15]} c="#6b3e26" />
      {[-0.42, -0.24].map((x) => (
        <Box key={x} p={[x, 0.092, -0.01]} s={[0.03, 0.01, 0.03]} c="#dee2e6" />
      ))}
    </group>
  ),

  /** A fork, four tines. */
  fourchette: () => (
    <group rotation={[0, 0.25, 0]}>
      <Box p={[-0.2, 0.03, 0]} s={[0.5, 0.05, 0.12]} c="#ced4da" />
      <Box p={[0.08, 0.03, 0]} s={[0.1, 0.04, 0.05]} c="#ced4da" />
      <Box p={[0.17, 0.03, 0]} s={[0.1, 0.04, 0.28]} c="#ced4da" />
      {[-0.11, -0.037, 0.037, 0.11].map((z) => (
        <Box key={z} p={[0.33, 0.03, z]} s={[0.24, 0.04, 0.04]} c="#dee2e6" />
      ))}
    </group>
  ),

  /** A wooden serving tray, raised edges and handles. */
  'plateau-service': () => (
    <>
      <Box p={[0, 0.03, 0]} s={[1.0, 0.04, 0.66]} c="#b07a45" />
      <Box p={[0, 0.08, 0.32]} s={[1.0, 0.1, 0.03]} c="#8a5a2b" />
      <Box p={[0, 0.08, -0.32]} s={[1.0, 0.1, 0.03]} c="#8a5a2b" />
      {[-0.49, 0.49].map((x) => (
        <group key={x}>
          <Box p={[x, 0.1, 0]} s={[0.03, 0.14, 0.66]} c="#8a5a2b" />
          <Box p={[x, 0.15, 0]} s={[0.035, 0.04, 0.22]} c="#4a2f16" />
        </group>
      ))}
    </>
  ),

  /** A restaurant menu standing up: red cover with a gold frame, the cream page with its list of dishes. */
  menu: () => (
    <>
      <group position={[0, 0.02, 0]} rotation={[-0.2, 0, 0]}>
        <Box p={[0, 0.37, 0]} s={[0.56, 0.74, 0.05]} c="#a61e4d" />
        <Box p={[0, 0.37, 0.026]} s={[0.48, 0.66, 0.005]} c="#ffd43b" />
        <Box p={[0, 0.37, 0.03]} s={[0.44, 0.62, 0.005]} c="#fff4e6" />
        <Cyl p={[0, 0.6, 0.035]} r={0.06} h={0.01} c="#a61e4d" rot={[Math.PI / 2, 0, 0]} seg={10} />
        {[0.47, 0.39, 0.31, 0.23, 0.15].map((y) => (
          <group key={y}>
            <Box p={[-0.05, y, 0.036]} s={[0.24, 0.025, 0.01]} c="#495057" />
            <Box p={[0.15, y, 0.036]} s={[0.06, 0.025, 0.01]} c="#c92a2a" />
          </group>
        ))}
      </group>
      <group position={[0, 0.02, -0.06]} rotation={[-0.5, 0, 0]}>
        <Box p={[0, 0.28, -0.02]} s={[0.1, 0.56, 0.03]} c="#7a1538" />
      </group>
      <Box p={[0, 0.02, 0.02]} s={[0.6, 0.04, 0.12]} c="#495057" />
    </>
  ),

  /** A little stack of F CFA notes: green, the frame, the watermark, the motif. */
  billet: () => (
    <>
      <Box p={[0, 0.01, 0]} s={[0.9, 0.02, 0.46]} c="#5c940d" r={0.15} />
      <Box p={[0, 0.03, 0]} s={[0.9, 0.02, 0.46]} c="#b5651d" r={-0.1} />
      <group position={[0, 0.05, 0]}>
        <Box p={[0, 0, 0]} s={[0.9, 0.02, 0.46]} c="#2f9e44" />
        <Box p={[0, 0.011, 0]} s={[0.82, 0.005, 0.38]} c="#8ce99a" />
        <Box p={[0, 0.013, 0]} s={[0.76, 0.005, 0.32]} c="#40c057" />
        <Cyl p={[-0.24, 0.016, 0]} r={0.1} h={0.01} c="#ebfbee" seg={10} />
        <Box p={[0.12, 0.017, 0]} s={[0.26, 0.01, 0.2]} c="#2b8a3e" />
        <Box p={[0.32, 0.017, 0.11]} s={[0.12, 0.01, 0.05]} c="#f08c00" />
        <Box p={[0.32, 0.017, -0.11]} s={[0.12, 0.01, 0.05]} c="#f08c00" />
      </group>
    </>
  ),

  /** Coins: a two-metal one lying, a little stack beside. */
  piece: () => (
    <>
      <Cyl p={[-0.12, 0.04, 0.08]} r={0.3} h={0.08} c="#ced4da" seg={12} />
      <Cyl p={[-0.12, 0.085, 0.08]} r={0.18} h={0.02} c="#e8a33c" seg={12} />
      <Cyl p={[-0.12, 0.1, 0.08]} r={0.08} h={0.01} c="#c98f20" seg={8} />
      {[0, 1, 2, 3].map((i) => (
        <Cyl key={i} p={[0.3, 0.04 + i * 0.08, -0.12]} r={0.2} h={0.075} c={i % 2 ? '#e8a33c' : '#d9962a'} seg={12} />
      ))}
    </>
  ),

  /** A bank card: blue, the gold chip, a band, an invented round mark. */
  'carte-bancaire': () => (
    <group rotation={[0, 0.15, 0]}>
      <Box p={[0, 0.02, 0]} s={[0.86, 0.04, 0.54]} c="#1864ab" />
      <Box p={[0, 0.041, -0.12]} s={[0.86, 0.004, 0.1]} c="#4dabf7" />
      <Box p={[-0.24, 0.045, 0.02]} s={[0.16, 0.012, 0.12]} c="#fcc419" />
      <Box p={[-0.24, 0.052, 0.02]} s={[0.1, 0.004, 0.02]} c="#e8a33c" />
      {[-0.08, 0.02, 0.12, 0.22].map((x) => (
        <Box key={x} p={[x, 0.044, 0.15]} s={[0.07, 0.004, 0.03]} c="#d0ebff" />
      ))}
      <Cyl p={[0.3, 0.045, 0.16]} r={0.07} h={0.01} c="#ff922b" seg={10} />
    </group>
  ),

  /** A manila folder, papers sticking out, its label. */
  dossier: () => (
    <group rotation={[0, -0.1, 0]}>
      <Box p={[0, 0.02, 0]} s={[0.8, 0.04, 0.6]} c="#d9a03c" />
      <Box p={[0.04, 0.06, -0.03]} s={[0.76, 0.04, 0.58]} c="#ffffff" />
      <Box p={[0, 0.1, 0.01]} s={[0.8, 0.04, 0.6]} c="#e8b04b" />
      <Box p={[-0.22, 0.1, -0.32]} s={[0.26, 0.04, 0.06]} c="#e8b04b" />
      <Box p={[0, 0.122, 0.1]} s={[0.36, 0.01, 0.16]} c="#fff9db" />
      <Box p={[0, 0.126, 0.1]} s={[0.26, 0.01, 0.03]} c="#868e96" />
    </group>
  ),

  /** A ballpoint pen: blue body, cap with its clip, the tip. */
  stylo: () => (
    <group rotation={[0, 0.35, 0]}>
      <Cyl p={[0, 0.06, 0]} r={0.055} h={0.66} c="#1c7ed6" rot={[0, 0, Math.PI / 2]} seg={8} />
      <Cyl p={[-0.38, 0.06, 0]} r={0.062} h={0.18} c="#1864ab" rot={[0, 0, Math.PI / 2]} seg={8} />
      <Box p={[-0.33, 0.13, 0]} s={[0.2, 0.025, 0.03]} c="#ced4da" />
      <Cone p={[0.39, 0.06, 0]} r={0.055} h={0.12} c="#f1f3f5" rot={[0, 0, -Math.PI / 2]} seg={8} />
    </group>
  ),

  /** A rubber stamp with its wooden handle, on its ink pad. */
  tampon: () => (
    <>
      <Box p={[0, 0.03, 0.05]} s={[0.6, 0.06, 0.42]} c="#343a40" />
      <Box p={[0, 0.062, 0.05]} s={[0.5, 0.01, 0.32]} c="#1c3d8a" />
      <Box p={[0, 0.1, 0]} s={[0.36, 0.06, 0.24]} c="#c92a2a" />
      <Box p={[0, 0.17, 0]} s={[0.4, 0.08, 0.28]} c="#a0703c" />
      <Cyl p={[0, 0.3, 0]} r={0.06} top={0.05} h={0.18} c="#8a5a2b" seg={8} />
      <Ball p={[0, 0.44, 0]} r={0.12} c="#a0703c" seg={8} />
    </>
  ),

  /** A spiral notebook: blue cover, label, white pages, the rings. */
  cahier: () => (
    <group rotation={[0, -0.15, 0]}>
      <Box p={[0.02, 0.03, 0]} s={[0.62, 0.06, 0.82]} c="#f8f9fa" />
      <Box p={[0.02, 0.07, 0]} s={[0.62, 0.02, 0.82]} c="#1c7ed6" />
      <Box p={[0.05, 0.085, -0.15]} s={[0.36, 0.01, 0.2]} c="#ffffff" />
      <Box p={[0.05, 0.091, -0.15]} s={[0.26, 0.004, 0.03]} c="#adb5bd" />
      {[-0.32, -0.21, -0.1, 0.01, 0.12, 0.23, 0.34].map((z) => (
        <Ring key={z} p={[-0.29, 0.05, z]} r={0.045} t={0.012} c="#495057" />
      ))}
    </group>
  ),

  /** A closed hardback book: red boards, cream pages, the gold-banded spine. */
  livre: () => (
    <group rotation={[0, 0.2, 0]}>
      <Box p={[0, 0.015, 0]} s={[0.66, 0.03, 0.86]} c="#c92a2a" />
      <Box p={[0.02, 0.11, 0]} s={[0.62, 0.16, 0.82]} c="#fff4e6" />
      <Box p={[0, 0.205, 0]} s={[0.66, 0.03, 0.86]} c="#c92a2a" />
      <Box p={[-0.33, 0.11, 0]} s={[0.04, 0.22, 0.86]} c="#a61e1e" />
      <Box p={[-0.33, 0.11, 0.3]} s={[0.05, 0.22, 0.04]} c="#fcc419" />
      <Box p={[-0.33, 0.11, -0.3]} s={[0.05, 0.22, 0.04]} c="#fcc419" />
      <Box p={[0.05, 0.222, -0.1]} s={[0.36, 0.005, 0.24]} c="#fcc419" />
    </group>
  ),

  /** A folded newspaper: headline, photo, columns. */
  journal: () => (
    <group rotation={[0, 0.2, 0]}>
      <Box p={[0, 0.03, 0]} s={[0.74, 0.06, 0.92]} c="#e9ecef" />
      <Box p={[0, 0.061, -0.34]} s={[0.62, 0.01, 0.12]} c="#212529" />
      <Box p={[-0.15, 0.061, -0.08]} s={[0.3, 0.01, 0.26]} c="#4dabf7" />
      {[-0.17, -0.07, 0.03, 0.13, 0.23, 0.33].map((z) => (
        <Box key={z} p={[0.2, 0.061, z]} s={[0.26, 0.01, 0.03]} c="#868e96" />
      ))}
      {[0.13, 0.23, 0.33].map((z) => (
        <Box key={z} p={[-0.15, 0.061, z]} s={[0.3, 0.01, 0.03]} c="#868e96" />
      ))}
    </group>
  ),

  /** A smartphone, its lit screen with app tiles and the camera. */
  telephone: () => (
    <group rotation={[0, -0.15, 0]}>
      <Box p={[0, 0.03, 0]} s={[0.44, 0.06, 0.84]} c="#212529" />
      <Box p={[0, 0.062, 0.02]} s={[0.38, 0.01, 0.72]} c="#4dabf7" glow={0.5} />
      {[-0.1, 0.0, 0.1].flatMap((x, i) =>
        [-0.24, -0.12, 0].map((z, j) => <Box key={`${i}${j}`} p={[x, 0.07, z]} s={[0.07, 0.01, 0.07]} c={['#fcc419', '#ff6b6b', '#51cf66', '#ffffff'][(i + j) % 4]} glow={0.3} />),
      )}
      <Box p={[0, 0.065, -0.37]} s={[0.04, 0.01, 0.02]} c="#495057" />
    </group>
  ),

  /** An open laptop: keyboard, trackpad, the lit screen. */
  ordinateur: () => (
    <>
      <Box p={[0, 0.025, 0.05]} s={[0.92, 0.05, 0.6]} c="#adb5bd" />
      <Box p={[0, 0.052, 0]} s={[0.8, 0.01, 0.3]} c="#343a40" />
      <Box p={[0, 0.052, 0.25]} s={[0.26, 0.01, 0.14]} c="#868e96" />
      <group position={[0, 0.05, -0.24]} rotation={[-0.25, 0, 0]}>
        <Box p={[0, 0.31, 0]} s={[0.92, 0.62, 0.04]} c="#adb5bd" />
        <Box p={[0, 0.31, 0.022]} s={[0.84, 0.54, 0.01]} c="#228be6" glow={0.5} />
        <Box p={[-0.2, 0.42, 0.03]} s={[0.3, 0.2, 0.01]} c="#ffffff" glow={0.3} />
        <Box p={[0.18, 0.22, 0.03]} s={[0.3, 0.06, 0.01]} c="#fcc419" glow={0.3} />
      </group>
    </>
  ),

  /** A brass key on its ring, a little tag. */
  cle: () => (
    <group rotation={[0, 0.3, 0]}>
      <Ring p={[-0.28, 0.05, 0]} r={0.15} t={0.05} c="#e8a33c" rot={[Math.PI / 2, 0, 0]} />
      <Box p={[0.08, 0.05, 0]} s={[0.5, 0.06, 0.08]} c="#e8a33c" />
      <Box p={[0.24, 0.05, 0.08]} s={[0.05, 0.06, 0.1]} c="#e8a33c" />
      <Box p={[0.3, 0.05, 0.06]} s={[0.04, 0.06, 0.07]} c="#e8a33c" />
      <Box p={[0.36, 0.05, 0.08]} s={[0.06, 0.06, 0.1]} c="#e8a33c" />
      <Box p={[-0.36, 0.03, 0.26]} s={[0.18, 0.05, 0.12]} c="#e03131" r={0.5} />
    </group>
  ),

  /** A suitcase standing: corners, straps, top handle. */
  valise: () => (
    <>
      <Box p={[0, 0.36, 0]} s={[0.8, 0.62, 0.3]} c="#1971c2" />
      {[-0.22, 0.22].map((x) => (
        <Box key={x} p={[x, 0.36, 0]} s={[0.06, 0.63, 0.31]} c="#7a4a24" />
      ))}
      <Box p={[0, 0.36, 0]} s={[0.81, 0.04, 0.31]} c="#1864ab" />
      {[-0.4, 0.4].map((x) => (
        <group key={x}>
          <Box p={[x, 0.65, 0]} s={[0.06, 0.06, 0.32]} c="#343a40" />
          <Box p={[x, 0.07, 0]} s={[0.06, 0.06, 0.32]} c="#343a40" />
          <Box p={[x * 0.85, 0.025, 0]} s={[0.06, 0.05, 0.12]} c="#212529" />
        </group>
      ))}
      <Box p={[0, 0.72, 0]} s={[0.24, 0.04, 0.07]} c="#343a40" />
      {[-0.11, 0.11].map((x) => (
        <Box key={x} p={[x, 0.69, 0]} s={[0.04, 0.06, 0.06]} c="#343a40" />
      ))}
    </>
  ),

  /** A ticket: pale orange, the red band, the stub across the perforation. */
  ticket: () => (
    <group rotation={[0, 0.2, 0]}>
      <Box p={[-0.08, 0.025, 0]} s={[0.62, 0.05, 0.38]} c="#ffd8a8" />
      <Box p={[0.34, 0.025, 0]} s={[0.2, 0.05, 0.38]} c="#ffa94d" />
      {[-0.15, -0.075, 0, 0.075, 0.15].map((z) => (
        <Box key={z} p={[0.23, 0.052, z]} s={[0.02, 0.01, 0.04]} c="#e8590c" />
      ))}
      <Box p={[-0.08, 0.052, -0.11]} s={[0.56, 0.01, 0.07]} c="#e03131" />
      <Box p={[-0.14, 0.052, 0.05]} s={[0.38, 0.01, 0.04]} c="#868e96" />
      <Box p={[-0.2, 0.052, 0.12]} s={[0.26, 0.01, 0.03]} c="#868e96" />
      <Cyl p={[0.34, 0.055, 0]} r={0.05} h={0.01} c="#e03131" seg={8} />
    </group>
  ),

  /** A passport: dark green booklet, the gold emblem, pages at the edge. */
  passeport: () => (
    <group rotation={[0, -0.2, 0]}>
      <Box p={[0.01, 0.04, 0]} s={[0.5, 0.06, 0.7]} c="#fff9db" />
      <Box p={[0, 0.015, 0]} s={[0.52, 0.03, 0.72]} c="#0b5345" />
      <Box p={[0, 0.075, 0]} s={[0.52, 0.02, 0.72]} c="#0b5345" />
      <Cyl p={[0, 0.09, -0.04]} r={0.11} h={0.01} c="#fcc419" seg={10} />
      <Cyl p={[0, 0.093, -0.04]} r={0.07} h={0.01} c="#0b5345" seg={10} />
      <Box p={[0, 0.09, 0.2]} s={[0.3, 0.01, 0.04]} c="#fcc419" />
      <Box p={[0, 0.09, -0.27]} s={[0.22, 0.01, 0.03]} c="#fcc419" />
    </group>
  ),

  /** The ballot box: see-through, blue frame, the slot, ballots inside. */
  urne: () => (
    <>
      <Box p={[0, 0.03, 0]} s={[0.66, 0.06, 0.66]} c="#1864ab" />
      <Box p={[0.05, 0.1, 0.05]} s={[0.3, 0.06, 0.2]} c="#f8f9fa" r={0.4} />
      <Box p={[-0.12, 0.14, -0.08]} s={[0.25, 0.04, 0.18]} c="#f1f3f5" r={-0.3} />
      <Box p={[0.1, 0.18, -0.1]} s={[0.22, 0.04, 0.16]} c="#ffffff" r={1.1} />
      <Glass p={[0, 0.36, 0]} box={[0.62, 0.6, 0.62]} c="#e7f5ff" o={0.3} />
      {[[-0.31, -0.31], [0.31, -0.31], [-0.31, 0.31], [0.31, 0.31]].map(([x, z]) => (
        <Box key={`${x}${z}`} p={[x, 0.36, z]} s={[0.04, 0.6, 0.04]} c="#1864ab" />
      ))}
      <Box p={[0, 0.68, 0]} s={[0.66, 0.05, 0.66]} c="#1864ab" />
      <Box p={[0, 0.71, 0]} s={[0.36, 0.02, 0.06]} c="#212529" />
      <Box p={[0, 0.36, 0.315]} s={[0.24, 0.12, 0.01]} c="#ffffff" />
    </>
  ),

  /** A ballot paper: the candidates' coloured boxes, one ticked. */
  bulletin: () => (
    <group rotation={[0, 0.15, 0]}>
      <Box p={[0, 0.015, 0]} s={[0.56, 0.03, 0.76]} c="#ffffff" />
      {['#f08c00', '#2f9e44', '#1c7ed6', '#e03131'].map((c, i) => (
        <group key={c}>
          <Box p={[-0.17, 0.035, -0.26 + i * 0.17]} s={[0.12, 0.01, 0.12]} c={c} />
          <Box p={[0.06, 0.035, -0.26 + i * 0.17]} s={[0.24, 0.01, 0.03]} c="#868e96" />
          <Box p={[0.22, 0.035, -0.26 + i * 0.17]} s={[0.07, 0.01, 0.07]} c="#495057" />
        </group>
      ))}
      <Box p={[0.215, 0.043, -0.085]} s={[0.09, 0.01, 0.025]} c="#e03131" r={0.8} />
      <Box p={[0.235, 0.043, -0.09]} s={[0.05, 0.01, 0.025]} c="#e03131" r={-0.8} />
    </group>
  ),

  /** The Ivorian flag (orange, white, green) on its pole. */
  drapeau: () => (
    <>
      <Cyl p={[-0.3, 0.03, 0]} r={0.12} h={0.06} c="#495057" seg={8} />
      <Cyl p={[-0.3, 0.52, 0]} r={0.025} h={1.0} c="#ced4da" seg={6} />
      <Ball p={[-0.3, 1.04, 0]} r={0.04} c="#fcc419" />
      <Box p={[-0.18, 0.8, 0]} s={[0.2, 0.38, 0.02]} c="#f77f00" />
      <Box p={[0.02, 0.8, 0]} s={[0.2, 0.38, 0.02]} c="#ffffff" />
      <Box p={[0.22, 0.8, 0]} s={[0.2, 0.38, 0.02]} c="#009e60" />
    </>
  ),

  /** A megaphone: the white horn, red rim, the handle. */
  megaphone: () => (
    <group rotation={[0, -0.5, 0]}>
      <mesh position={[0, 0.4, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.08, 0.3, 0.7, 10, 1, true]} />
        <meshLambertMaterial color="#f8f9fa" flatShading side={2} />
      </mesh>
      <Ring p={[0.35, 0.4, 0]} r={0.3} t={0.03} c="#e03131" rot={[0, Math.PI / 2, 0]} />
      <Cyl p={[0.32, 0.4, 0]} r={0.27} h={0.01} c="#495057" rot={[0, 0, Math.PI / 2]} />
      <Cyl p={[-0.4, 0.4, 0]} r={0.1} h={0.12} c="#e03131" rot={[0, 0, Math.PI / 2]} />
      <Box p={[-0.2, 0.17, 0]} s={[0.1, 0.34, 0.1]} c="#343a40" />
      <Box p={[-0.14, 0.24, 0]} s={[0.04, 0.08, 0.05]} c="#e03131" />
    </group>
  ),

  /** A microphone on its desk stand. */
  micro: () => (
    <>
      <Cyl p={[0, 0.025, 0]} r={0.26} top={0.22} h={0.05} c="#343a40" seg={10} />
      <Cyl p={[0, 0.28, 0]} r={0.025} h={0.5} c="#868e96" seg={6} />
      <group position={[0, 0.53, 0]} rotation={[0.35, 0, 0]}>
        <Cyl p={[0, 0.12, 0]} r={0.055} top={0.08} h={0.26} c="#212529" seg={8} />
        <Ball p={[0, 0.32, 0]} r={0.13} c="#adb5bd" seg={8} />
        <Cyl p={[0, 0.25, 0]} r={0.09} h={0.03} c="#495057" seg={8} />
      </group>
    </>
  ),

  /** The cash register: the drawer, the sloped keypad, the green screen on its post. */
  'caisse-enregistreuse': () => (
    <>
      <Box p={[0, 0.1, 0]} s={[0.84, 0.2, 0.66]} c="#495057" />
      <Box p={[0, 0.09, 0.33]} s={[0.7, 0.12, 0.04]} c="#adb5bd" />
      <Box p={[0, 0.09, 0.36]} s={[0.2, 0.03, 0.03]} c="#212529" />
      <Box p={[0, 0.27, -0.12]} s={[0.84, 0.14, 0.42]} c="#868e96" />
      <group position={[0, 0.3, 0.14]} rotation={[0.45, 0, 0]}>
        <Box p={[0, 0, 0]} s={[0.84, 0.06, 0.26]} c="#868e96" />
        {[-0.24, -0.12, 0, 0.12].flatMap((x, i) =>
          [-0.07, 0.0, 0.07].map((z, j) => <Box key={`${i}${j}`} p={[x, 0.04, z]} s={[0.08, 0.03, 0.05]} c={i === 3 && j === 2 ? '#40c057' : '#f1f3f5'} />),
        )}
        <Box p={[0.28, 0.04, 0]} s={[0.12, 0.03, 0.19]} c="#e03131" />
      </group>
      <Box p={[0.15, 0.42, -0.2]} s={[0.06, 0.16, 0.06]} c="#343a40" />
      <Box p={[0.15, 0.55, -0.2]} s={[0.4, 0.16, 0.06]} c="#343a40" />
      <Box p={[0.15, 0.55, -0.168]} s={[0.34, 0.1, 0.01]} c="#69db7c" glow={0.6} />
    </>
  ),

  /** A barcode scanner gun standing in its cradle, the red window lit. */
  scanner: () => (
    <>
      <Box p={[0, 0.04, 0]} s={[0.4, 0.08, 0.4]} c="#343a40" />
      <group position={[0, 0.06, -0.04]} rotation={[-0.2, 0, 0]}>
        <Box p={[0, 0.25, 0]} s={[0.14, 0.46, 0.16]} c="#212529" />
        <Box p={[0, 0.34, 0.09]} s={[0.06, 0.1, 0.04]} c="#fcc419" />
        <Box p={[0, 0.54, 0.12]} s={[0.26, 0.2, 0.42]} c="#343a40" />
        <Box p={[0, 0.54, 0.335]} s={[0.22, 0.14, 0.01]} c="#ff2d2d" glow={0.9} />
        <Box p={[0, 0.645, 0.08]} s={[0.12, 0.01, 0.1]} c="#40c057" glow={0.5} />
      </group>
    </>
  ),

  /** An open cardboard box, its flaps up. */
  carton: () => (
    <>
      <Box p={[0, 0.27, 0]} s={[0.8, 0.54, 0.6]} c="#c8955a" />
      <Box p={[0, 0.541, 0]} s={[0.74, 0.01, 0.54]} c="#5c3d1e" />
      <group position={[0, 0.54, 0.3]} rotation={[-0.5, 0, 0]}>
        <Box p={[0, 0, 0.14]} s={[0.8, 0.02, 0.28]} c="#d9a66b" />
      </group>
      <group position={[0, 0.54, -0.3]} rotation={[0.9, 0, 0]}>
        <Box p={[0, 0, -0.14]} s={[0.8, 0.02, 0.28]} c="#b8854a" />
      </group>
      {[-1, 1].map((k) => (
        <group key={k} position={[0.4 * k, 0.54, 0]} rotation={[0, 0, 0.9 * k]}>
          <Box p={[0.1 * k, 0, 0]} s={[0.2, 0.02, 0.58]} c="#c8955a" />
        </group>
      ))}
      <Box p={[0.2, 0.3, 0.301]} s={[0.16, 0.12, 0.01]} c="#8a5a2b" />
    </>
  ),

  /** A parcel: closed kraft box, the tape cross, its address label. */
  colis: () => (
    <>
      <Box p={[0, 0.25, 0]} s={[0.76, 0.5, 0.6]} c="#c8955a" />
      <Box p={[0, 0.25, 0]} s={[0.12, 0.505, 0.605]} c="#e8c48a" />
      <Box p={[0, 0.501, 0]} s={[0.765, 0.01, 0.12]} c="#e8c48a" />
      <Box p={[0.22, 0.28, 0.302]} s={[0.24, 0.16, 0.01]} c="#ffffff" />
      <Box p={[0.22, 0.3, 0.308]} s={[0.18, 0.02, 0.01]} c="#868e96" />
      <Box p={[0.22, 0.25, 0.308]} s={[0.14, 0.02, 0.01]} c="#868e96" />
      <Box p={[-0.24, 0.32, 0.302]} s={[0.06, 0.14, 0.01]} c="#e03131" />
    </>
  ),

  /** The market scale: red body, white dial with its needle, the steel pan. */
  balance: () => (
    <>
      <Box p={[0, 0.2, 0]} s={[0.56, 0.4, 0.44]} c="#e03131" />
      <Cyl p={[0, 0.22, 0.225]} r={0.17} h={0.02} c="#ffffff" rot={[Math.PI / 2, 0, 0]} seg={12} />
      <Box p={[0.03, 0.27, 0.24]} s={[0.02, 0.12, 0.01]} c="#212529" />
      <Ring p={[0, 0.22, 0.226]} r={0.17} t={0.015} c="#343a40" />
      <Box p={[0, 0.44, 0]} s={[0.08, 0.08, 0.08]} c="#868e96" />
      <Cyl p={[0, 0.5, 0]} r={0.36} top={0.42} h={0.05} c="#ced4da" seg={12} />
      <Box p={[0, 0.03, 0]} s={[0.62, 0.06, 0.5]} c="#c92a2a" />
    </>
  ),

  /** A calculator: dark body, the grey-green screen, the keys, an orange equals. */
  calculatrice: () => (
    <group rotation={[0, -0.15, 0]}>
      <Box p={[0, 0.04, 0]} s={[0.52, 0.08, 0.76]} c="#343a40" />
      <Box p={[0, 0.085, -0.24]} s={[0.42, 0.01, 0.16]} c="#a9c5a0" />
      {[-0.15, -0.05, 0.05, 0.15].flatMap((x, i) =>
        [-0.07, 0.04, 0.15, 0.26].map((z, j) => <Box key={`${i}${j}`} p={[x, 0.09, z]} s={[0.08, 0.02, 0.08]} c={i === 3 && j === 3 ? '#fd7e14' : i === 3 ? '#868e96' : '#dee2e6'} />),
      )}
    </group>
  ),

  /** A chalkboard on its feet: wooden frame, chalk sums on the green, the tray. */
  'tableau-noir': () => (
    <>
      {[-0.4, 0.4].map((x) => (
        <Box key={x} p={[x, 0.03, 0]} s={[0.08, 0.06, 0.36]} c="#6b4423" />
      ))}
      <group position={[0, 0.06, 0]} rotation={[-0.1, 0, 0]}>
        <Box p={[0, 0.4, 0]} s={[1.0, 0.72, 0.06]} c="#8a5a2b" />
        <Box p={[0, 0.41, 0.032]} s={[0.88, 0.6, 0.01]} c="#2b4a3a" />
        <Box p={[-0.2, 0.58, 0.04]} s={[0.3, 0.025, 0.01]} c="#f1f3f5" />
        <Box p={[-0.24, 0.48, 0.04]} s={[0.22, 0.025, 0.01]} c="#f1f3f5" />
        <Box p={[-0.24, 0.48, 0.04]} s={[0.025, 0.12, 0.01]} c="#f1f3f5" />
        <Box p={[0.2, 0.36, 0.04]} s={[0.36, 0.025, 0.01]} c="#f1f3f5" />
        <Box p={[0.12, 0.25, 0.04]} s={[0.2, 0.025, 0.01]} c="#ffe066" />
        <Box p={[0, 0.06, 0.07]} s={[0.9, 0.04, 0.1]} c="#6b4423" />
        <Box p={[0.25, 0.09, 0.07]} s={[0.12, 0.03, 0.03]} c="#ffffff" />
      </group>
    </>
  ),

  /** Chalk: the blue box with sticks poking out, two lying in front. */
  craie: () => (
    <>
      <Box p={[0, 0.14, -0.1]} s={[0.5, 0.28, 0.3]} c="#1c7ed6" />
      <Box p={[0, 0.2, 0.051]} s={[0.3, 0.08, 0.01]} c="#ffffff" />
      {[-0.15, -0.05, 0.05, 0.15].map((x, i) => (
        <Cyl key={x} p={[x, 0.32 + (i % 2) * 0.04, -0.1]} r={0.04} h={0.2} c={i === 2 ? '#ffe066' : '#f8f9fa'} seg={8} />
      ))}
      <Cyl p={[-0.08, 0.04, 0.24]} r={0.04} h={0.4} c="#f8f9fa" rot={[0, 0.3, Math.PI / 2]} seg={8} />
      <Cyl p={[0.12, 0.04, 0.3]} r={0.04} h={0.3} c="#f783ac" rot={[0, -0.4, Math.PI / 2]} seg={8} />
    </>
  ),
}
