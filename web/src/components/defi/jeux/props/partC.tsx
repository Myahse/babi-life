import * as THREE from 'three'
import { Box } from '../../../../world3d/props'
import type { PropId } from '../types'

// The games' objects, part C: sport and games, music and worship, nature and animals, the sky,
// culture, and the little bits (stains, dust, foam...) and effects. Same voxel style as world3d.

type V = [number, number, number]
type Look = { c: string; g?: number; o?: number; ds?: boolean }

/** Flat-shaded Lambert, optionally glowing, see-through or two-sided. */
function M({ c, g, o, ds }: Look) {
  return (
    <meshLambertMaterial
      color={c}
      flatShading
      emissive={g ? c : '#000'}
      emissiveIntensity={g ?? 0}
      transparent={o !== undefined}
      opacity={o ?? 1}
      side={ds ? THREE.DoubleSide : THREE.FrontSide}
    />
  )
}

type At = { p: V; rot?: V; s?: V }

function Cyl({ p, rot, s, r, h, n = 10, ...l }: At & Look & { r: [number, number]; h: number; n?: number }) {
  return (
    <mesh position={p} rotation={rot} scale={s} castShadow receiveShadow>
      <cylinderGeometry args={[r[0], r[1], h, n]} />
      <M {...l} />
    </mesh>
  )
}

function Sph({ p, rot, s, r, n = 10, ...l }: At & Look & { r: number; n?: number }) {
  return (
    <mesh position={p} rotation={rot} scale={s} castShadow receiveShadow>
      <sphereGeometry args={[r, n, Math.max(4, Math.round(n * 0.7))]} />
      <M {...l} />
    </mesh>
  )
}

function Ico({ p, rot, s, r, d = 0, ...l }: At & Look & { r: number; d?: number }) {
  return (
    <mesh position={p} rotation={rot} scale={s} castShadow receiveShadow>
      <icosahedronGeometry args={[r, d]} />
      <M {...l} />
    </mesh>
  )
}

function Cone({ p, rot, s, r, h, n = 8, ...l }: At & Look & { r: number; h: number; n?: number }) {
  return (
    <mesh position={p} rotation={rot} scale={s} castShadow receiveShadow>
      <coneGeometry args={[r, h, n]} />
      <M {...l} />
    </mesh>
  )
}

function Tor({ p, rot, s, r, t, arc = Math.PI * 2, n = 16, ...l }: At & Look & { r: number; t: number; arc?: number; n?: number }) {
  return (
    <mesh position={p} rotation={rot} scale={s} castShadow receiveShadow>
      <torusGeometry args={[r, t, 6, n, arc]} />
      <M {...l} />
    </mesh>
  )
}

/** A thin bar from a to b in the x/y plane, at depth z. */
function Rod({ a, b, z = 0, t = 0.04, c }: { a: [number, number]; b: [number, number]; z?: number; t?: number; c: string }) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  return (
    <group position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z]} rotation={[0, 0, Math.atan2(dy, dx)]}>
      <Box p={[0, 0, 0]} s={[Math.hypot(dx, dy), t, t]} c={c} />
    </group>
  )
}

/** Pixel art made of cubes, standing in the x/y plane (rows top to bottom, '#' = a cube). */
function Px({ rows, u, c, d, g }: { rows: string[]; u: number; c: string; d: number; g?: number }) {
  const w = rows[0].length
  return (
    <>
      {rows.flatMap((row, j) =>
        [...row].map((ch, i) =>
          ch === '#' ? <Box key={`${i}-${j}`} p={[(i - (w - 1) / 2) * u, (rows.length - 1 - j + 0.5) * u, 0]} s={[u, u, d]} c={c} glow={g} /> : null,
        ),
      )}
    </>
  )
}

const RX: V = [Math.PI / 2, 0, 0]
const RZ: V = [0, 0, Math.PI / 2]
const GOLD = '#f2b705'
const WOOD = '#8a5a2b'

export const PROPS_C: Partial<Record<PropId, () => React.ReactElement>> = {
  // ---------- Sport, games ----------

  /** A white football with black patches. */
  'ballon-foot': () => (
    <group>
      <Ico p={[0, 0.32, 0]} r={0.32} d={1} c="#f8f9fa" />
      {([[0, 0.62, 0.08], [0.24, 0.42, 0.18], [-0.24, 0.42, 0.18], [0.14, 0.2, 0.26], [-0.14, 0.2, 0.26], [0, 0.4, -0.29], [0.28, 0.3, -0.12], [-0.28, 0.3, -0.12]] as V[]).map((q, i) => (
        <Ico key={i} p={q} r={0.085} c="#212529" />
      ))}
    </group>
  ),

  /** An orange basketball with its dark seams. */
  'ballon-basket': () => (
    <group>
      <Sph p={[0, 0.32, 0]} r={0.32} n={14} c="#f76707" />
      <Tor p={[0, 0.32, 0]} rot={RX} r={0.322} t={0.014} n={24} c="#2b1a0e" />
      <Tor p={[0, 0.32, 0]} r={0.322} t={0.014} n={24} c="#2b1a0e" />
      <Tor p={[0, 0.32, 0]} rot={[0, Math.PI / 2, 0]} r={0.322} t={0.014} n={24} c="#2b1a0e" />
    </group>
  ),

  /** A football goal: white posts and a net slanting to the back. */
  but: () => (
    <group>
      <Box p={[-0.55, 0.36, 0.2]} s={[0.07, 0.72, 0.07]} c="#ffffff" />
      <Box p={[0.55, 0.36, 0.2]} s={[0.07, 0.72, 0.07]} c="#ffffff" />
      <Box p={[0, 0.72, 0.2]} s={[1.17, 0.07, 0.07]} c="#ffffff" />
      <Box p={[-0.55, 0.02, -0.05]} s={[0.05, 0.04, 0.5]} c="#dee2e6" />
      <Box p={[0.55, 0.02, -0.05]} s={[0.05, 0.04, 0.5]} c="#dee2e6" />
      {[-0.55, -0.37, -0.18, 0, 0.18, 0.37, 0.55].map((x) => (
        <group key={x} position={[x, 0.36, -0.05]} rotation={[0.607, 0, 0]}>
          <Box p={[0, 0, 0]} s={[0.015, 0.88, 0.015]} c="#ced4da" />
        </group>
      ))}
      {[0.12, 0.3, 0.48].map((y) => (
        <Box key={y} p={[0, y, 0.2 - (0.72 - y) * 0.694]} s={[1.1, 0.015, 0.015]} c="#ced4da" />
      ))}
    </group>
  ),

  /** A basketball hoop: pole, white backboard, orange ring and net. */
  'panier-basket': () => (
    <group>
      <Box p={[0, 0.03, -0.25]} s={[0.4, 0.06, 0.3]} c="#495057" />
      <Box p={[0, 0.55, -0.25]} s={[0.08, 1.0, 0.08]} c="#868e96" />
      <Box p={[0, 0.95, -0.12]} s={[0.7, 0.45, 0.05]} c="#f8f9fa" />
      <Box p={[0, 0.88, -0.09]} s={[0.24, 0.03, 0.02]} c="#e03131" />
      <Box p={[-0.11, 0.95, -0.09]} s={[0.03, 0.16, 0.02]} c="#e03131" />
      <Box p={[0.11, 0.95, -0.09]} s={[0.03, 0.16, 0.02]} c="#e03131" />
      <Box p={[0, 1.02, -0.09]} s={[0.24, 0.03, 0.02]} c="#e03131" />
      <Tor p={[0, 0.8, 0.07]} rot={RX} r={0.16} t={0.02} c="#f76707" />
      <Cyl p={[0, 0.7, 0.07]} r={[0.15, 0.1]} h={0.2} n={8} c="#f1f3f5" o={0.75} ds />
    </group>
  ),

  /** A dumbbell: a bar with heavy plates at both ends. */
  haltere: () => (
    <group>
      <Cyl p={[0, 0.2, 0]} rot={RZ} r={[0.04, 0.04]} h={0.8} c="#adb5bd" />
      {[-0.3, 0.3].map((x) => (
        <group key={x}>
          <Cyl p={[x, 0.2, 0]} rot={RZ} r={[0.2, 0.2]} h={0.1} n={8} c="#343a40" />
          <Cyl p={[x * 1.3, 0.2, 0]} rot={RZ} r={[0.15, 0.15]} h={0.07} n={8} c="#495057" />
        </group>
      ))}
    </group>
  ),

  /** A tennis racket lying down, strings and grip. */
  raquette: () => (
    <group rotation={[0, 0.5, 0]}>
      <Tor p={[0, 0.04, -0.15]} rot={[-Math.PI / 2, 0, 0]} s={[0.78, 1, 1]} r={0.3} t={0.035} c="#e03131" />
      {[-0.15, -0.075, 0, 0.075, 0.15].map((x) => (
        <Box key={x} p={[x, 0.04, -0.15]} s={[0.012, 0.012, 0.56 - Math.abs(x) * 1.2]} c="#f1f3f5" />
      ))}
      {[-0.36, -0.24, -0.12, 0, 0.12].map((z) => (
        <Box key={z} p={[0, 0.04, z]} s={[0.4 - Math.abs(z + 0.15) * 0.6, 0.012, 0.012]} c="#f1f3f5" />
      ))}
      <Box p={[0, 0.04, 0.24]} s={[0.06, 0.06, 0.2]} c="#e03131" />
      <Box p={[0, 0.045, 0.45]} s={[0.08, 0.08, 0.26]} c="#212529" />
    </group>
  ),

  /** A volleyball net between two posts. */
  filet: () => (
    <group>
      {[-0.55, 0.55].map((x) => (
        <group key={x}>
          <Box p={[x, 0.42, 0]} s={[0.07, 0.84, 0.07]} c="#495057" />
          <Box p={[x, 0.03, 0]} s={[0.18, 0.06, 0.18]} c="#343a40" />
        </group>
      ))}
      <Box p={[0, 0.78, 0]} s={[1.06, 0.06, 0.02]} c="#ffffff" />
      {[0.42, 0.52, 0.62, 0.72].map((y) => (
        <Box key={y} p={[0, y, 0]} s={[1.06, 0.012, 0.012]} c="#212529" />
      ))}
      {Array.from({ length: 11 }, (_, i) => (
        <Box key={i} p={[-0.45 + i * 0.09, 0.58, 0]} s={[0.012, 0.36, 0.012]} c="#212529" />
      ))}
      <Box p={[0, 0.39, 0]} s={[1.06, 0.03, 0.02]} c="#ffffff" />
    </group>
  ),

  /** A white bowling pin with red stripes. */
  quille: () => (
    <group>
      <Cyl p={[0, 0.06, 0]} r={[0.13, 0.1]} h={0.12} c="#f8f9fa" />
      <Sph p={[0, 0.25, 0]} s={[1, 1.4, 1]} r={0.16} c="#f8f9fa" />
      <Cyl p={[0, 0.5, 0]} r={[0.065, 0.1]} h={0.2} c="#f8f9fa" />
      <Cyl p={[0, 0.53, 0]} r={[0.072, 0.08]} h={0.04} c="#e03131" />
      <Cyl p={[0, 0.47, 0]} r={[0.085, 0.092]} h={0.04} c="#e03131" />
      <Sph p={[0, 0.66, 0]} r={0.1} c="#f8f9fa" />
    </group>
  ),

  /** A steel pétanque boule and the little wooden jack. */
  'boule-petanque': () => (
    <group>
      <Sph p={[0, 0.26, 0]} r={0.26} n={14} c="#ced4da" />
      <Tor p={[0, 0.26, 0]} rot={[0.4, 0, 0]} r={0.26} t={0.012} n={24} c="#495057" />
      <Tor p={[0, 0.26, 0]} rot={[-0.4, 0, 0]} r={0.26} t={0.012} n={24} c="#495057" />
      <Sph p={[0.38, 0.07, 0.22]} r={0.07} c="#f08c00" />
    </group>
  ),

  /** A game controller: grips, cross pad and coloured buttons. */
  manette: () => (
    <group>
      <Box p={[0, 0.08, 0]} s={[0.66, 0.14, 0.3]} c="#343a40" />
      <Box p={[-0.26, 0.08, 0.14]} s={[0.2, 0.13, 0.3]} c="#343a40" r={0.35} />
      <Box p={[0.26, 0.08, 0.14]} s={[0.2, 0.13, 0.3]} c="#343a40" r={-0.35} />
      <Box p={[-0.2, 0.16, -0.01]} s={[0.16, 0.03, 0.05]} c="#111" />
      <Box p={[-0.2, 0.16, -0.01]} s={[0.05, 0.03, 0.16]} c="#111" />
      <Box p={[0.24, 0.16, -0.07]} s={[0.05, 0.03, 0.05]} c="#2f9e44" />
      <Box p={[0.3, 0.16, -0.01]} s={[0.05, 0.03, 0.05]} c="#e03131" />
      <Box p={[0.18, 0.16, -0.01]} s={[0.05, 0.03, 0.05]} c="#1c7ed6" />
      <Box p={[0.24, 0.16, 0.05]} s={[0.05, 0.03, 0.05]} c="#fab005" />
      <Cyl p={[-0.07, 0.17, 0.08]} r={[0.04, 0.04]} h={0.05} c="#111" />
      <Cyl p={[0.07, 0.17, 0.08]} r={[0.04, 0.04]} h={0.05} c="#111" />
    </group>
  ),

  /** Two playing cards, the ace of hearts on top. */
  'carte-jeu': () => (
    <group>
      <Box p={[-0.1, 0.01, -0.04]} s={[0.46, 0.02, 0.66]} c="#1c3f95" r={0.35} />
      <Box p={[0.08, 0.03, 0.02]} s={[0.46, 0.02, 0.66]} c="#ffffff" r={-0.12} />
      <group position={[0.08, 0.05, 0.02]} rotation={[-Math.PI / 2, 0, 0.12]}>
        <Px rows={['##.##', '#####', '.###.', '..#..']} u={0.075} d={0.02} c="#e03131" />
      </group>
      <group position={[-0.06, 0.05, -0.24]} rotation={[-Math.PI / 2, 0, 0.12]}>
        <Px rows={['#.#', '###', '.#.']} u={0.03} d={0.02} c="#e03131" />
      </group>
    </group>
  ),

  /** A white die with black pips. */
  de: () => (
    <group rotation={[0, 0.5, 0]}>
      <Box p={[0, 0.25, 0]} s={[0.5, 0.5, 0.5]} c="#f8f9fa" />
      {([[0, 0], [-0.14, -0.14], [0.14, 0.14], [-0.14, 0.14], [0.14, -0.14]] as [number, number][]).map(([x, z], i) => (
        <Box key={`t${i}`} p={[x, 0.505, z]} s={[0.08, 0.02, 0.08]} c="#212529" />
      ))}
      {([[-0.13, 0.38], [0.13, 0.12]] as [number, number][]).map(([x, y], i) => (
        <Box key={`f${i}`} p={[x, y, 0.255]} s={[0.08, 0.08, 0.02]} c="#212529" />
      ))}
      {([[-0.14, 0.39], [0, 0.25], [0.14, 0.11]] as [number, number][]).map(([z, y], i) => (
        <Box key={`s${i}`} p={[0.255, y, z]} s={[0.02, 0.08, 0.08]} c="#212529" />
      ))}
    </group>
  ),

  /** A draughts board with some pieces on it. */
  damier: () => (
    <group>
      <Box p={[0, 0.04, 0]} s={[1, 0.08, 1]} c="#6b3e1d" />
      {Array.from({ length: 64 }, (_, k) => {
        const i = k % 8
        const j = Math.floor(k / 8)
        return <Box key={k} p={[(i - 3.5) * 0.11, 0.085, (j - 3.5) * 0.11]} s={[0.11, 0.01, 0.11]} c={(i + j) % 2 ? '#3d2412' : '#f3d9a4'} />
      })}
      {([[1, 0, 'b'], [3, 0, 'b'], [5, 0, 'b'], [0, 1, 'b'], [4, 1, 'b'], [2, 6, 'w'], [6, 6, 'w'], [1, 7, 'w'], [5, 7, 'w'], [3, 4, 'w']] as [number, number, string][]).map(([i, j, t]) => (
        <Cyl key={`${i}${j}`} p={[(i - 3.5) * 0.11, 0.11, (j - 3.5) * 0.11]} r={[0.045, 0.045]} h={0.04} c={t === 'b' ? '#212529' : '#f8f9fa'} />
      ))}
    </group>
  ),

  /** A stack of casino chips and one lying beside. */
  jeton: () => (
    <group>
      {['#e03131', '#1c7ed6', '#2f9e44', '#e03131'].map((c, i) => (
        <group key={i} position={[-0.08 + (i % 2) * 0.02, 0.035 + i * 0.07, 0]}>
          <Cyl p={[0, 0, 0]} r={[0.2, 0.2]} h={0.065} n={16} c={c} />
          {[0, 1, 2, 3, 4, 5].map((k) => (
            <Box key={k} p={[Math.cos(k * 1.047) * 0.19, 0, Math.sin(k * 1.047) * 0.19]} s={[0.05, 0.068, 0.05]} c="#ffffff" r={-k * 1.047} />
          ))}
        </group>
      ))}
      <Cyl p={[0.26, 0.035, 0.22]} r={[0.2, 0.2]} h={0.065} n={16} c="#212529" />
      <Cyl p={[0.26, 0.07, 0.22]} r={[0.11, 0.11]} h={0.01} n={16} c="#fab005" />
    </group>
  ),

  /** A little racing kart: fat wheels, seat, steering wheel. */
  kart: () => (
    <group>
      <Box p={[0, 0.12, 0]} s={[0.5, 0.08, 0.9]} c="#e03131" />
      <Box p={[0, 0.16, 0.44]} s={[0.62, 0.1, 0.08]} c="#fab005" />
      <Box p={[0, 0.16, -0.44]} s={[0.62, 0.1, 0.08]} c="#fab005" />
      <Box p={[0, 0.22, -0.12]} s={[0.3, 0.12, 0.26]} c="#212529" />
      <Box p={[0, 0.36, -0.24]} s={[0.3, 0.26, 0.06]} c="#212529" />
      <Box p={[0, 0.24, -0.38]} s={[0.22, 0.16, 0.12]} c="#868e96" />
      <group position={[0, 0.22, 0.2]} rotation={[0.7, 0, 0]}>
        <Box p={[0, 0.08, 0]} s={[0.04, 0.18, 0.04]} c="#495057" />
        <Tor p={[0, 0.17, 0]} rot={RX} r={0.09} t={0.02} c="#212529" />
      </group>
      {([[0.34, 0.3], [-0.34, 0.3], [0.36, -0.3], [-0.36, -0.3]] as [number, number][]).map(([x, z]) => (
        <group key={`${x}${z}`}>
          <Cyl p={[x, 0.13, z]} rot={RZ} r={[0.13, 0.13]} h={z < 0 ? 0.16 : 0.12} n={12} c="#212529" />
          <Cyl p={[x * 1.02, 0.13, z]} rot={RZ} r={[0.06, 0.06]} h={0.13} c="#ced4da" />
        </group>
      ))}
    </group>
  ),

  /** A bicycle seen from the side. */
  velo: () => (
    <group>
      {[-0.36, 0.36].map((x) => (
        <group key={x}>
          <Tor p={[x, 0.27, 0]} r={0.24} t={0.035} n={18} c="#212529" />
          <Cyl p={[x, 0.27, 0]} rot={RX} r={[0.04, 0.04]} h={0.08} c="#adb5bd" />
          <Rod a={[x - 0.22, 0.27]} b={[x + 0.22, 0.27]} t={0.01} c="#adb5bd" />
          <Rod a={[x, 0.05]} b={[x, 0.49]} t={0.01} c="#adb5bd" />
        </group>
      ))}
      <Rod a={[-0.36, 0.27]} b={[-0.03, 0.27]} c="#1c7ed6" />
      <Rod a={[-0.36, 0.27]} b={[-0.12, 0.58]} c="#1c7ed6" />
      <Rod a={[-0.03, 0.27]} b={[-0.12, 0.6]} c="#1c7ed6" />
      <Rod a={[-0.12, 0.56]} b={[0.24, 0.56]} c="#1c7ed6" />
      <Rod a={[-0.03, 0.27]} b={[0.24, 0.56]} c="#1c7ed6" />
      <Rod a={[0.24, 0.62]} b={[0.36, 0.27]} c="#1c7ed6" />
      <Box p={[-0.14, 0.64, 0]} s={[0.16, 0.04, 0.08]} c="#212529" />
      <Box p={[0.23, 0.66, 0]} s={[0.04, 0.04, 0.3]} c="#495057" />
      <Cyl p={[-0.03, 0.27, 0]} rot={RX} r={[0.06, 0.06]} h={0.06} c="#868e96" />
      <Box p={[-0.03, 0.2, 0.06]} s={[0.1, 0.03, 0.04]} c="#212529" />
    </group>
  ),

  /** A long dugout canoe (pirogue) with a painted band and its paddle. */
  pirogue: () => (
    <group scale={0.88}>
      <Box p={[0, 0.12, 0]} s={[1.0, 0.2, 0.34]} c="#7f4f24" />
      <Box p={[0.56, 0.15, 0]} s={[0.14, 0.18, 0.26]} c="#7f4f24" />
      <Box p={[-0.56, 0.15, 0]} s={[0.14, 0.18, 0.26]} c="#7f4f24" />
      <Box p={[0.68, 0.2, 0]} s={[0.12, 0.12, 0.14]} c="#7f4f24" />
      <Box p={[-0.68, 0.2, 0]} s={[0.12, 0.12, 0.14]} c="#7f4f24" />
      <Box p={[0, 0.215, 0]} s={[1.08, 0.02, 0.24]} c="#4a2c12" />
      <Box p={[-0.2, 0.15, 0.172]} s={[0.4, 0.05, 0.01]} c="#f08c00" />
      <Box p={[0.2, 0.15, 0.172]} s={[0.4, 0.05, 0.01]} c="#2f9e44" />
      <Box p={[0, 0.15, 0.172]} s={[0.1, 0.05, 0.012]} c="#ffffff" />
      <group position={[0.1, 0.24, 0]} rotation={[0, 0.5, 0]}>
        <Box p={[0, 0, 0]} s={[0.04, 0.04, 0.6]} c="#c08a50" />
        <Box p={[0, 0, 0.36]} s={[0.12, 0.02, 0.18]} c="#c08a50" />
      </group>
    </group>
  ),

  /** A red and white lifebuoy, standing up. */
  bouee: () => (
    <group>
      <Tor p={[0, 0.36, 0]} r={0.26} t={0.1} n={20} c="#f8f9fa" />
      {[0, 1, 2, 3].map((k) => (
        <Tor key={k} p={[0, 0.36, 0.001]} rot={[0, 0, k * (Math.PI / 2) + Math.PI / 8]} r={0.26} t={0.102} n={5} arc={Math.PI / 4} c="#e03131" />
      ))}
      <Box p={[0, 0.03, -0.05]} s={[0.3, 0.06, 0.12]} c="#495057" />
    </group>
  ),

  /** A surfboard lying down, with stripes and a fin. */
  'planche-surf': () => (
    <group rotation={[0, 0.3, 0]}>
      <Sph p={[0, 0.05, 0]} s={[0.6, 0.05, 0.2]} r={1} n={14} c="#22b8cf" />
      <Box p={[0, 0.1, 0]} s={[1.0, 0.005, 0.05]} c="#ffffff" />
      <Box p={[0.15, 0.1, 0]} s={[0.05, 0.006, 0.3]} c="#f76707" />
      <Box p={[0.25, 0.1, 0]} s={[0.05, 0.006, 0.28]} c="#f76707" />
      <Box p={[-0.5, 0.11, 0]} s={[0.1, 0.06, 0.02]} c="#1864ab" />
    </group>
  ),

  /** A dart: steel tip, barrel and coloured flights. */
  flechette: () => (
    <group rotation={[0, 0.4, 0]}>
      <Cone p={[0.42, 0.08, 0]} rot={[0, 0, -Math.PI / 2]} r={0.025} h={0.2} c="#adb5bd" />
      <Cyl p={[0.2, 0.08, 0]} rot={RZ} r={[0.045, 0.045]} h={0.25} c="#495057" />
      <Cyl p={[-0.05, 0.08, 0]} rot={RZ} r={[0.02, 0.02]} h={0.3} c="#212529" />
      <Box p={[-0.26, 0.08, 0]} s={[0.2, 0.16, 0.012]} c="#e03131" />
      <Box p={[-0.26, 0.08, 0]} s={[0.2, 0.012, 0.16]} c="#fab005" />
    </group>
  ),

  /** A dartboard target on a stand, rings red and white. */
  cible: () => (
    <group>
      <Box p={[0, 0.25, -0.12]} s={[0.08, 0.5, 0.06]} c={WOOD} />
      <Box p={[0, 0.03, -0.12]} s={[0.4, 0.06, 0.3]} c={WOOD} />
      {(['#212529', '#f8f9fa', '#e03131', '#f8f9fa', '#e03131', '#fab005'] as string[]).map((c, i) => (
        <Cyl key={i} p={[0, 0.52, -0.06 + i * 0.012]} rot={RX} r={[0.42 - i * 0.075, 0.42 - i * 0.075]} h={0.05} n={18} c={c} />
      ))}
      <group position={[0.06, 0.58, 0.04]} rotation={[0, -0.4, 0.2]}>
        <Cyl p={[0, 0, 0.1]} rot={RX} r={[0.02, 0.02]} h={0.2} c="#495057" />
        <Box p={[0, 0, 0.22]} s={[0.012, 0.1, 0.08]} c="#1c7ed6" />
      </group>
    </group>
  ),

  /** A skipping rope on the ground, red handles. */
  corde: () => (
    <group>
      <Tor p={[0, 0.03, 0.05]} rot={[-Math.PI / 2, 0, Math.PI]} r={0.36} t={0.025} n={20} arc={Math.PI} c="#fab005" />
      <Tor p={[0, 0.03, 0.05]} rot={[-Math.PI / 2, 0, 0]} s={[1, 0.5, 1]} r={0.36} t={0.025} n={20} arc={Math.PI} c="#fab005" />
      {[-0.4, 0.4].map((x) => (
        <Cyl key={x} p={[x, 0.05, 0.16]} rot={RX} r={[0.045, 0.045]} h={0.24} c="#e03131" />
      ))}
    </group>
  ),

  /** A yoga mat, half rolled up. */
  'tapis-yoga': () => (
    <group>
      <Box p={[0.1, 0.012, 0]} s={[0.8, 0.025, 0.45]} c="#9c36b5" />
      <Cyl p={[-0.38, 0.11, 0]} rot={RX} r={[0.11, 0.11]} h={0.45} n={12} c="#862e9c" />
      <Cyl p={[-0.38, 0.11, 0]} rot={RX} r={[0.05, 0.05]} h={0.452} n={10} c="#5f1f6e" />
      <Box p={[0.1, 0.026, 0]} s={[0.8, 0.005, 0.03]} c="#e599f7" />
    </group>
  ),

  /** A stopwatch: round silver case, white dial, button on top. */
  chrono: () => (
    <group>
      <Box p={[0, 0.03, -0.02]} s={[0.24, 0.06, 0.14]} c="#495057" />
      <Cyl p={[0, 0.33, 0]} rot={RX} r={[0.3, 0.3]} h={0.12} n={18} c="#ced4da" />
      <Cyl p={[0, 0.33, 0.05]} rot={RX} r={[0.25, 0.25]} h={0.04} n={18} c="#ffffff" />
      {[0, 1, 2, 3].map((k) => (
        <Box key={k} p={[Math.sin(k * 1.571) * 0.2, 0.33 + Math.cos(k * 1.571) * 0.2, 0.075]} s={[0.03, 0.03, 0.01]} c="#212529" />
      ))}
      <group position={[0, 0.33, 0.08]} rotation={[0, 0, -0.7]}>
        <Box p={[0, 0.08, 0]} s={[0.025, 0.17, 0.01]} c="#e03131" />
      </group>
      <Box p={[0, 0.68, 0]} s={[0.08, 0.08, 0.08]} c="#868e96" />
      <Box p={[0, 0.74, 0]} s={[0.14, 0.04, 0.08]} c="#e03131" />
    </group>
  ),

  /** A golden cup on a dark plinth. */
  trophee: () => (
    <group>
      <Box p={[0, 0.07, 0]} s={[0.34, 0.14, 0.34]} c="#343a40" />
      <Box p={[0, 0.07, 0.172]} s={[0.18, 0.05, 0.01]} c={GOLD} />
      <Cyl p={[0, 0.17, 0]} r={[0.07, 0.12]} h={0.06} c={GOLD} g={0.2} />
      <Cyl p={[0, 0.27, 0]} r={[0.035, 0.035]} h={0.16} c={GOLD} g={0.2} />
      <Cyl p={[0, 0.48, 0]} r={[0.25, 0.08]} h={0.3} n={12} c={GOLD} g={0.25} />
      <Cyl p={[0, 0.63, 0]} r={[0.2, 0.2]} h={0.01} n={12} c="#a57b00" />
      <Tor p={[-0.24, 0.5, 0]} r={0.08} t={0.025} c={GOLD} g={0.2} />
      <Tor p={[0.24, 0.5, 0]} r={0.08} t={0.025} c={GOLD} g={0.2} />
    </group>
  ),

  /** A gold medal on its ribbon, lying down. */
  medaille: () => (
    <group>
      <group position={[-0.08, 0.01, -0.2]} rotation={[0, -0.35, 0]}>
        <Box p={[0, 0, 0]} s={[0.12, 0.02, 0.5]} c="#1c7ed6" />
      </group>
      <group position={[0.08, 0.012, -0.2]} rotation={[0, 0.35, 0]}>
        <Box p={[0, 0, 0]} s={[0.12, 0.02, 0.5]} c="#e03131" />
      </group>
      <Cyl p={[0, 0.03, 0.15]} r={[0.2, 0.2]} h={0.06} n={16} c={GOLD} g={0.25} />
      <Cyl p={[0, 0.062, 0.15]} r={[0.13, 0.13]} h={0.01} n={16} c="#d99a00" />
      <group position={[0, 0.07, 0.15]} rotation={[-Math.PI / 2, 0, 0]}>
        <Box p={[0, 0, 0]} s={[0.1, 0.1, 0.01]} c={GOLD} r={0.785} />
      </group>
    </group>
  ),

  // ---------- Music, worship ----------

  /** A djembe: goblet-shaped wooden drum, skin on top, ropes. */
  djembe: () => (
    <group>
      <Cyl p={[0, 0.14, 0]} r={[0.13, 0.2]} h={0.28} n={12} c="#7f4f24" />
      <Cyl p={[0, 0.48, 0]} r={[0.28, 0.14]} h={0.4} n={12} c="#9c6230" />
      <Cyl p={[0, 0.69, 0]} r={[0.29, 0.29]} h={0.03} n={12} c="#f1dcb0" />
      <Tor p={[0, 0.66, 0]} rot={RX} r={0.285} t={0.02} n={12} c="#e03131" />
      <Tor p={[0, 0.3, 0]} rot={RX} r={0.14} t={0.02} n={12} c="#e03131" />
      {Array.from({ length: 10 }, (_, k) => {
        const a = (k / 10) * Math.PI * 2
        return (
          <group key={k} position={[Math.cos(a) * 0.215, 0.48, Math.sin(a) * 0.215]} rotation={[0, -a, 0]}>
            <group rotation={[0, 0, -0.33]}>
              <Box p={[0, 0, 0]} s={[0.015, 0.4, 0.015]} c="#f8f9fa" />
            </group>
          </group>
        )
      })}
      <Cyl p={[0, 0.1, 0]} r={[0.205, 0.205]} h={0.04} n={12} c="#fab005" />
    </group>
  ),

  /** A talking drum: hourglass body laced with cords, and its curved stick. */
  'tam-tam': () => (
    <group>
      <Cyl p={[-0.2, 0.24, 0]} rot={[0, 0, Math.PI / 2]} r={[0.22, 0.11]} h={0.4} n={12} c="#9c6230" />
      <Cyl p={[0.2, 0.24, 0]} rot={[0, 0, -Math.PI / 2]} r={[0.22, 0.11]} h={0.4} n={12} c="#9c6230" />
      <Cyl p={[-0.41, 0.24, 0]} rot={RZ} r={[0.23, 0.23]} h={0.03} n={12} c="#f1dcb0" />
      <Cyl p={[0.41, 0.24, 0]} rot={RZ} r={[0.23, 0.23]} h={0.03} n={12} c="#f1dcb0" />
      {Array.from({ length: 12 }, (_, k) => {
        const a = (k / 12) * Math.PI * 2
        return <Cyl key={k} p={[0, 0.24 + Math.sin(a) * 0.2, Math.cos(a) * 0.2]} rot={RZ} r={[0.008, 0.008]} h={0.82} n={4} c="#f8f9fa" />
      })}
      <Box p={[0, 0.24, 0.205]} s={[0.12, 0.42, 0.02]} c="#e03131" />
      <group position={[0.15, 0.03, 0.38]} rotation={[0, 0.3, 0]}>
        <Tor p={[0, 0, 0]} rot={[-Math.PI / 2, 0, 0]} r={0.18} t={0.02} arc={Math.PI * 0.7} c="#5c3a1c" />
      </group>
    </group>
  ),

  /** An acoustic guitar lying down. */
  guitare: () => (
    <group rotation={[0, 0.25, 0]} position={[0.1, 0, 0]}>
      <Cyl p={[-0.28, 0.05, 0]} r={[0.25, 0.25]} h={0.1} n={14} c="#d9822b" />
      <Cyl p={[-0.02, 0.05, 0]} r={[0.19, 0.19]} h={0.1} n={14} c="#d9822b" />
      <Cyl p={[-0.13, 0.101, 0]} r={[0.08, 0.08]} h={0.01} n={12} c="#2b1a0e" />
      <Box p={[-0.36, 0.105, 0]} s={[0.04, 0.02, 0.18]} c="#2b1a0e" />
      <Box p={[0.32, 0.08, 0]} s={[0.52, 0.04, 0.08]} c="#5c3a1c" />
      <Box p={[0.62, 0.08, 0]} s={[0.12, 0.04, 0.12]} c="#2b1a0e" />
      {[-0.025, 0, 0.025].map((z) => (
        <Box key={z} p={[0.1, 0.106, z]} s={[0.92, 0.006, 0.006]} c="#e9ecef" />
      ))}
    </group>
  ),

  /** A balafon: wooden keys on a frame, gourds hanging underneath. */
  balafon: () => (
    <group>
      {[-0.5, 0.5].map((x) => (
        <group key={x}>
          <Box p={[x, 0.22, 0.17]} s={[0.05, 0.44, 0.05]} c="#5c3a1c" />
          <Box p={[x, 0.22, -0.17]} s={[0.05, 0.44, 0.05]} c="#5c3a1c" />
        </group>
      ))}
      <Box p={[0, 0.42, 0.17]} s={[1.1, 0.05, 0.05]} c="#5c3a1c" />
      <Box p={[0, 0.42, -0.17]} s={[1.1, 0.05, 0.05]} c="#5c3a1c" />
      {Array.from({ length: 8 }, (_, i) => (
        <group key={i} position={[-0.42 + i * 0.12, 0, 0]}>
          <Box p={[0, 0.47, 0]} s={[0.1, 0.05, 0.5 - i * 0.025]} c={i % 2 ? '#d4a15a' : '#c58b4a'} />
          <Sph p={[0, 0.3 + i * 0.006, 0]} r={0.1 - i * 0.006} n={8} c="#b5651d" />
        </group>
      ))}
      <group position={[0.1, 0.52, 0.12]} rotation={[0, 0.6, 0]}>
        <Box p={[0, 0, 0]} s={[0.02, 0.02, 0.36]} c="#3d2412" />
        <Sph p={[0, 0, 0.19]} r={0.04} c="#212529" />
      </group>
    </group>
  ),

  /** A black sound speaker with two woofers. */
  enceinte: () => (
    <group>
      <Box p={[0, 0.4, 0]} s={[0.5, 0.8, 0.4]} c="#212529" />
      {[[0.24, 0.13], [0.56, 0.08]].map(([y, r]) => (
        <group key={y}>
          <Cyl p={[0, y, 0.2]} rot={RX} r={[r + 0.03, r + 0.03]} h={0.02} n={14} c="#868e96" />
          <Cyl p={[0, y, 0.21]} rot={RX} r={[r, r]} h={0.02} n={14} c="#343a40" />
          <Cyl p={[0, y, 0.22]} rot={RX} r={[r * 0.35, r * 0.35]} h={0.02} n={10} c="#111" />
        </group>
      ))}
      <Cyl p={[0, 0.72, 0.205]} rot={RX} r={[0.03, 0.03]} h={0.02} c="#1c7ed6" g={0.8} />
    </group>
  ),

  /** A DJ turntable: a black record on its deck, tonearm, knobs. */
  platine: () => (
    <group>
      <Box p={[0, 0.06, 0]} s={[0.9, 0.12, 0.66]} c="#495057" />
      <Cyl p={[-0.1, 0.13, 0]} r={[0.28, 0.28]} h={0.02} n={20} c="#111" />
      <Tor p={[-0.1, 0.141, 0]} rot={RX} r={0.2} t={0.005} n={20} c="#343a40" />
      <Cyl p={[-0.1, 0.145, 0]} r={[0.09, 0.09]} h={0.01} n={14} c="#e03131" />
      <Cyl p={[0.32, 0.16, -0.22]} r={[0.04, 0.04]} h={0.08} c="#ced4da" />
      <group position={[0.32, 0.18, -0.22]} rotation={[0, -0.75, 0]}>
        <Box p={[0, 0, 0.18]} s={[0.025, 0.025, 0.36]} c="#ced4da" />
        <Box p={[0, -0.02, 0.37]} s={[0.05, 0.03, 0.06]} c="#212529" />
      </group>
      {[-0.05, 0.08, 0.21].map((z) => (
        <Cyl key={z} p={[0.36, 0.14, z]} r={[0.03, 0.03]} h={0.04} c="#f8f9fa" />
      ))}
      <Box p={[-0.36, 0.125, 0.28]} s={[0.08, 0.01, 0.04]} c="#40c057" glow={0.6} />
    </group>
  ),

  /** A rosary: a loop of wooden beads ending in a small cross. */
  chapelet: () => (
    <group>
      {Array.from({ length: 18 }, (_, k) => {
        const a = (k / 18) * Math.PI * 2
        return <Sph key={k} p={[Math.sin(a) * 0.26, 0.04, -0.08 - Math.cos(a) * 0.24]} r={k % 6 === 0 ? 0.05 : 0.035} n={6} c="#7f4f24" />
      })}
      {[0, 1, 2].map((k) => (
        <Sph key={k} p={[0, 0.035, 0.2 + k * 0.07]} r={0.035} n={6} c="#7f4f24" />
      ))}
      <Box p={[0, 0.03, 0.5]} s={[0.05, 0.04, 0.22]} c={GOLD} />
      <Box p={[0, 0.03, 0.46]} s={[0.15, 0.04, 0.05]} c={GOLD} />
    </group>
  ),

  /** The Bible: black book with a gold cross. */
  bible: () => (
    <group rotation={[0, 0.2, 0]}>
      <Box p={[0, 0.09, 0]} s={[0.52, 0.18, 0.7]} c="#212529" />
      <Box p={[0.012, 0.09, 0.005]} s={[0.5, 0.14, 0.7]} c="#f1ead2" />
      <Box p={[0, 0.183, -0.02]} s={[0.06, 0.01, 0.36]} c={GOLD} />
      <Box p={[0, 0.183, -0.08]} s={[0.24, 0.01, 0.06]} c={GOLD} />
      <Box p={[-0.1, 0.12, 0.351]} s={[0.04, 0.12, 0.01]} c="#c92a2a" />
    </group>
  ),

  /** The Quran: green book with a gold frame and star, on a wooden stand. */
  coran: () => (
    <group>
      {[-0.55, 0.55].map((a) => (
        <group key={a} rotation={[a, 0, 0]}>
          <Box p={[0, 0.17, 0]} s={[0.5, 0.36, 0.03]} c="#9c6230" />
        </group>
      ))}
      <group position={[0, 0.3, 0]} rotation={[0.35, 0, 0]}>
        <Box p={[0, 0, 0]} s={[0.5, 0.12, 0.6]} c="#1f6e43" />
        <Box p={[0.01, 0, 0.002]} s={[0.48, 0.08, 0.6]} c="#f1ead2" />
        <Box p={[0, 0.061, 0.27]} s={[0.44, 0.005, 0.03]} c={GOLD} />
        <Box p={[0, 0.061, -0.27]} s={[0.44, 0.005, 0.03]} c={GOLD} />
        <Box p={[0.21, 0.061, 0]} s={[0.03, 0.005, 0.54]} c={GOLD} />
        <Box p={[-0.21, 0.061, 0]} s={[0.03, 0.005, 0.54]} c={GOLD} />
        <Box p={[0, 0.062, 0]} s={[0.16, 0.006, 0.16]} c={GOLD} />
        <Box p={[0, 0.062, 0]} s={[0.16, 0.006, 0.16]} c={GOLD} r={0.785} />
        <Box p={[0, 0.066, 0]} s={[0.07, 0.006, 0.07]} c="#1f6e43" r={0.785} />
      </group>
    </group>
  ),

  /** A prayer rug: border, arch of the mihrab, tassels. */
  'tapis-priere': () => (
    <group>
      <Box p={[0, 0.012, 0]} s={[0.6, 0.025, 1.0]} c="#a61e4d" />
      <Box p={[0, 0.02, 0.02]} s={[0.48, 0.025, 0.84]} c="#1f6e43" />
      <Box p={[0, 0.026, 0.12]} s={[0.36, 0.025, 0.56]} c="#c2255c" />
      <Box p={[0, 0.026, -0.22]} s={[0.24, 0.025, 0.12]} c="#c2255c" />
      <Box p={[0, 0.026, -0.3]} s={[0.12, 0.025, 0.08]} c="#c2255c" />
      <Box p={[0, 0.034, 0.18]} s={[0.1, 0.01, 0.1]} c={GOLD} r={0.785} />
      {Array.from({ length: 7 }, (_, i) => (
        <group key={i}>
          <Box p={[-0.27 + i * 0.09, 0.01, 0.53]} s={[0.025, 0.02, 0.07]} c={GOLD} />
          <Box p={[-0.27 + i * 0.09, 0.01, -0.53]} s={[0.025, 0.02, 0.07]} c={GOLD} />
        </group>
      ))}
    </group>
  ),

  /** A wooden cross on a stepped base. */
  croix: () => (
    <group>
      <Box p={[0, 0.05, 0]} s={[0.4, 0.1, 0.3]} c="#868e96" />
      <Box p={[0, 0.13, 0]} s={[0.28, 0.06, 0.2]} c="#adb5bd" />
      <Box p={[0, 0.58, 0]} s={[0.12, 0.86, 0.1]} c="#8a5a2b" />
      <Box p={[0, 0.76, 0]} s={[0.56, 0.12, 0.1]} c="#8a5a2b" />
    </group>
  ),

  /** A tall church candle, lit, in a gold holder. */
  cierge: () => (
    <group>
      <Cyl p={[0, 0.03, 0]} r={[0.2, 0.24]} h={0.06} n={12} c={GOLD} />
      <Cyl p={[0, 0.1, 0]} r={[0.06, 0.08]} h={0.08} n={10} c={GOLD} />
      <Cyl p={[0, 0.16, 0]} r={[0.15, 0.1]} h={0.04} n={12} c={GOLD} />
      <Cyl p={[0, 0.48, 0]} r={[0.09, 0.09]} h={0.6} n={12} c="#fff9db" />
      <Box p={[0, 0.81, 0]} s={[0.015, 0.05, 0.015]} c="#212529" />
      <Cone p={[0, 0.88, 0]} r={0.05} h={0.14} n={6} c="#ff922b" g={1} />
      <Cone p={[0, 0.86, 0.01]} r={0.025} h={0.07} n={6} c="#ffe066" g={1} />
    </group>
  ),

  /** A calabash bowl with a carved band. */
  calebasse: () => (
    <group>
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.36, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <M c="#c98b3a" ds />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <sphereGeometry args={[0.34, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <M c="#f1d9a4" ds />
      </mesh>
      <Tor p={[0, 0.3, 0]} rot={RX} r={0.35} t={0.02} n={14} c="#7f4f24" />
      <Tor p={[0, 0.18, 0]} rot={RX} r={0.335} t={0.012} n={14} c="#5c3a1c" />
      {Array.from({ length: 10 }, (_, k) => {
        const a = (k / 10) * Math.PI * 2
        return <Box key={k} p={[Math.cos(a) * 0.33, 0.24, Math.sin(a) * 0.33]} s={[0.04, 0.04, 0.04]} c="#5c3a1c" r={-a + 0.785} />
      })}
    </group>
  ),

  // ---------- Nature, animals, the sky ----------

  /** A pink scallop shell, fanned ribs. */
  coquillage: () => (
    <group rotation={[0, 0.3, 0]}>
      {Array.from({ length: 7 }, (_, k) => {
        const a = -0.9 + k * 0.3
        return (
          <group key={k} position={[0, 0.02, -0.18]} rotation={[0, a, 0]}>
            <Box p={[0, 0.04 + (3 - Math.abs(k - 3)) * 0.015, 0.22]} s={[0.1, 0.1, 0.44 - Math.abs(k - 3) * 0.03]} c={k % 2 ? '#ffc9c9' : '#ffa8a8'} />
          </group>
        )
      })}
      <Box p={[0, 0.05, -0.2]} s={[0.22, 0.08, 0.08]} c="#f08c8c" />
    </group>
  ),

  /** A red crab with claws up and eyes on stalks. */
  crabe: () => (
    <group>
      <Box p={[0, 0.18, 0]} s={[0.5, 0.16, 0.36]} c="#e8590c" />
      <Box p={[0, 0.27, -0.02]} s={[0.4, 0.04, 0.28]} c="#f76707" />
      {[-0.08, 0.08].map((x) => (
        <group key={x}>
          <Box p={[x, 0.32, 0.14]} s={[0.03, 0.12, 0.03]} c="#e8590c" />
          <Box p={[x, 0.39, 0.14]} s={[0.07, 0.07, 0.07]} c="#ffffff" />
          <Box p={[x, 0.39, 0.175]} s={[0.04, 0.04, 0.01]} c="#111" />
        </group>
      ))}
      {[-1, 1].map((sd) => (
        <group key={sd}>
          <Box p={[sd * 0.3, 0.24, 0.18]} s={[0.08, 0.08, 0.16]} c="#e8590c" r={sd * -0.4} />
          <Box p={[sd * 0.36, 0.32, 0.28]} s={[0.14, 0.12, 0.1]} c="#d9480f" />
          <Box p={[sd * 0.33, 0.42, 0.29]} s={[0.06, 0.1, 0.06]} c="#d9480f" />
          <Box p={[sd * 0.4, 0.4, 0.29]} s={[0.05, 0.06, 0.06]} c="#d9480f" />
          {[-0.12, 0, 0.12].map((z) => (
            <group key={z} position={[sd * 0.3, 0.12, z - 0.02]} rotation={[0, 0, sd * -0.7]}>
              <Box p={[sd * 0.06, 0, 0]} s={[0.16, 0.04, 0.04]} c="#d9480f" />
            </group>
          ))}
        </group>
      ))}
    </group>
  ),

  /** A live tropical fish, blue with yellow fins, nose to the right. */
  'poisson-vivant': () => (
    <group rotation={[0, 0.25, 0]}>
      <Sph p={[0, 0.27, 0]} s={[1.5, 1, 0.55]} r={0.22} n={10} c="#1c7ed6" />
      <Cone p={[-0.43, 0.27, 0]} rot={[0, 0, Math.PI / 2]} s={[1, 1, 0.3]} r={0.2} h={0.24} n={4} c="#fcc419" />
      <Cone p={[0, 0.5, 0]} rot={[0, 0, -0.3]} s={[1.6, 1, 0.25]} r={0.08} h={0.16} n={4} c="#fcc419" />
      <Box p={[0.05, 0.27, 0]} s={[0.05, 0.36, 0.25]} c="#ffffff" />
      <Box p={[-0.15, 0.27, 0]} s={[0.04, 0.3, 0.2]} c="#ffffff" />
      <Box p={[0.2, 0.31, 0.1]} s={[0.07, 0.07, 0.04]} c="#ffffff" />
      <Box p={[0.215, 0.31, 0.12]} s={[0.04, 0.04, 0.01]} c="#111" />
      <Box p={[0, 0.03, 0]} s={[0.2, 0.06, 0.12]} c="#1864ab" />
      <Box p={[0, 0.09, 0]} s={[0.03, 0.1, 0.03]} c="#1864ab" />
    </group>
  ),

  /** A curling blue wave with white foam on its crest. */
  vague: () => (
    <group rotation={[0, -0.8, 0]} scale={[0.8, 1, 1]}>
      <Box p={[0, 0.06, 0]} s={[1.1, 0.12, 0.8]} c="#1c7ed6" />
      <Box p={[0, 0.24, -0.18]} s={[1.1, 0.26, 0.4]} c="#228be6" />
      <Box p={[0, 0.44, -0.12]} s={[1.1, 0.16, 0.36]} c="#339af0" />
      <Box p={[0, 0.57, 0.0]} s={[1.1, 0.12, 0.34]} c="#4dabf7" />
      <Box p={[0, 0.5, 0.21]} s={[1.1, 0.12, 0.12]} c="#4dabf7" />
      <Box p={[0, 0.4, 0.27]} s={[1.1, 0.1, 0.08]} c="#74c0fc" />
      <Box p={[0, 0.65, -0.02]} s={[1.12, 0.06, 0.3]} c="#ffffff" />
      <Box p={[0, 0.58, 0.2]} s={[1.12, 0.06, 0.14]} c="#e7f5ff" />
      <Box p={[0, 0.13, 0.3]} s={[1.12, 0.04, 0.12]} c="#e7f5ff" />
    </group>
  ),

  /** A palm tree: straight ringed trunk, a crown of long arching fronds, red palm nuts. */
  palmier: () => (
    <group>
      {Array.from({ length: 6 }, (_, i) => (
        <Box key={i} p={[0, 0.09 + i * 0.17, 0]} s={[0.16, 0.16, 0.16]} c={i % 2 ? '#7a5230' : '#94683c'} r={i * 0.4} />
      ))}
      <group position={[0, 1.04, 0]}>
        {Array.from({ length: 8 }, (_, k) => (
          <group key={k} rotation={[0, (k / 8) * Math.PI * 2 + 0.2, 0]}>
            <group rotation={[0, 0, k % 2 ? 0.35 : 0.1]}>
              <Box p={[0.18, 0, 0]} s={[0.36, 0.03, 0.14]} c={k % 2 ? '#2b8a3e' : '#37b24d'} />
            </group>
            <group position={[0.33, k % 2 ? 0.1 : 0.02, 0]} rotation={[0, 0, -0.6]}>
              <Box p={[0.12, 0, 0]} s={[0.26, 0.03, 0.11]} c={k % 2 ? '#2b8a3e' : '#37b24d'} />
            </group>
          </group>
        ))}
        <Box p={[0, 0.06, 0]} s={[0.14, 0.16, 0.14]} c="#2b8a3e" />
        {([[0.08, -0.06, 0.06], [-0.08, -0.05, 0.05], [0.02, -0.07, -0.08]] as V[]).map((q, i) => (
          <Sph key={i} p={q} r={0.055} n={6} c="#e8590c" />
        ))}
      </group>
    </group>
  ),

  /** A coconut palm: curved ringed trunk, drooping fronds, coconuts. */
  cocotier: () => (
    <group position={[-0.15, 0, 0]}>
      {Array.from({ length: 7 }, (_, i) => (
        <Box key={i} p={[i * i * 0.006, 0.08 + i * 0.16, 0]} s={[0.13 - i * 0.006, 0.15, 0.13 - i * 0.006]} c={i % 2 ? '#8a6440' : '#a07850'} />
      ))}
      <group position={[0.22, 1.12, 0]}>
        {Array.from({ length: 7 }, (_, k) => (
          <group key={k} rotation={[0, (k / 7) * Math.PI * 2, 0]}>
            <group rotation={[0, 0, -0.35]}>
              <Box p={[0.22, 0, 0]} s={[0.44, 0.03, 0.12]} c={k % 2 ? '#2f9e44' : '#40c057'} />
            </group>
            <group position={[0.42, -0.14, 0]} rotation={[0, 0, -0.9]}>
              <Box p={[0.08, 0, 0]} s={[0.18, 0.03, 0.09]} c={k % 2 ? '#2f9e44' : '#40c057'} />
            </group>
          </group>
        ))}
        {([[0.08, -0.1, 0.08], [-0.08, -0.1, 0.07], [0.02, -0.12, -0.09], [0.1, -0.16, -0.02]] as V[]).map((q, i) => (
          <Sph key={i} p={q} r={0.085} n={7} c="#5c3d1e" />
        ))}
      </group>
    </group>
  ),

  /** A lion: tawny body, big brown mane, tufted tail. */
  lion: () => (
    <group rotation={[0, 0.55, 0]} scale={0.9}>
      {([[0.13, 0.22], [-0.13, 0.22], [0.13, -0.24], [-0.13, -0.24]] as [number, number][]).map(([x, z]) => (
        <Box key={`${x}${z}`} p={[x, 0.14, z]} s={[0.12, 0.28, 0.12]} c="#d4a03a" />
      ))}
      <Box p={[0, 0.42, -0.02]} s={[0.4, 0.3, 0.7]} c="#e0a548" />
      <Box p={[0, 0.58, 0.3]} s={[0.6, 0.56, 0.24]} c="#8a4b14" />
      <Box p={[0, 0.82, 0.3]} s={[0.4, 0.1, 0.2]} c="#8a4b14" />
      <Box p={[0, 0.57, 0.42]} s={[0.36, 0.34, 0.2]} c="#e8b04f" />
      <Box p={[0, 0.5, 0.54]} s={[0.18, 0.12, 0.08]} c="#f3d08c" />
      <Box p={[0, 0.55, 0.585]} s={[0.08, 0.05, 0.02]} c="#3d2412" />
      {[-0.09, 0.09].map((x) => (
        <Box key={x} p={[x, 0.64, 0.525]} s={[0.05, 0.05, 0.02]} c="#111" />
      ))}
      <group position={[0, 0.48, -0.36]} rotation={[0.6, 0, 0]}>
        <Box p={[0, 0, -0.15]} s={[0.04, 0.04, 0.3]} c="#d4a03a" />
        <Box p={[0, 0, -0.32]} s={[0.09, 0.09, 0.09]} c="#8a4b14" />
      </group>
    </group>
  ),

  /** A giraffe: long legs, long neck, brown patches, little horns. */
  girafe: () => (
    <group rotation={[0, 0.55, 0]} scale={0.85}>
      {([[0.11, 0.18], [-0.11, 0.18], [0.11, -0.18], [-0.11, -0.18]] as [number, number][]).map(([x, z]) => (
        <Box key={`${x}${z}`} p={[x, 0.27, z]} s={[0.08, 0.54, 0.08]} c="#f2c14e" />
      ))}
      <Box p={[0, 0.66, 0]} s={[0.32, 0.26, 0.56]} c="#f2c14e" />
      <group position={[0, 0.72, 0.2]} rotation={[0.25, 0, 0]}>
        <Box p={[0, 0.34, 0]} s={[0.14, 0.68, 0.14]} c="#f2c14e" />
        <Box p={[0, 0.34, 0.071]} s={[0.06, 0.08, 0.01]} c="#9c5a1a" />
        <Box p={[0.071, 0.5, 0]} s={[0.01, 0.08, 0.06]} c="#9c5a1a" />
        <Box p={[-0.071, 0.2, 0]} s={[0.01, 0.08, 0.06]} c="#9c5a1a" />
        <Box p={[0, 0.34, -0.08]} s={[0.04, 0.6, 0.04]} c="#9c5a1a" />
        <Box p={[0, 0.72, 0.06]} s={[0.16, 0.14, 0.26]} c="#f2c14e" />
        <Box p={[0, 0.69, 0.2]} s={[0.12, 0.08, 0.06]} c="#e0a548" />
        {[-0.05, 0.05].map((x) => (
          <group key={x}>
            <Box p={[x, 0.83, 0.02]} s={[0.03, 0.08, 0.03]} c="#9c5a1a" />
            <Box p={[x * 1.7, 0.76, 0.1]} s={[0.03, 0.03, 0.03]} c="#111" />
          </group>
        ))}
      </group>
      {([[0.161, 0.7, 0.1], [0.161, 0.62, -0.12], [-0.161, 0.68, -0.02], [-0.161, 0.6, 0.16], [0.05, 0.791, -0.15], [-0.07, 0.791, 0.05]] as V[]).map((q, i) => (
        <Box key={i} p={q} s={[Math.abs(q[0]) > 0.1 ? 0.01 : 0.1, Math.abs(q[0]) > 0.1 ? 0.09 : 0.01, 0.1]} c="#9c5a1a" />
      ))}
      <Box p={[0, 0.6, -0.31]} s={[0.03, 0.2, 0.03]} c="#9c5a1a" />
    </group>
  ),

  /** An elephant: grey, big ears, trunk and tusks. */
  elephant: () => (
    <group rotation={[0, 0.5, 0]} scale={0.85}>
      {([[0.17, 0.22], [-0.17, 0.22], [0.17, -0.22], [-0.17, -0.22]] as [number, number][]).map(([x, z]) => (
        <Box key={`${x}${z}`} p={[x, 0.15, z]} s={[0.18, 0.3, 0.18]} c="#868e96" />
      ))}
      <Box p={[0, 0.52, -0.02]} s={[0.58, 0.48, 0.74]} c="#949ca6" />
      <Box p={[0, 0.62, 0.42]} s={[0.42, 0.4, 0.28]} c="#949ca6" />
      {[-1, 1].map((sd) => (
        <group key={sd} position={[sd * 0.3, 0.64, 0.38]} rotation={[0, sd * 0.35, 0]}>
          <Box p={[0, 0, 0]} s={[0.24, 0.42, 0.05]} c="#adb5bd" />
          <Box p={[0, 0, 0.01]} s={[0.16, 0.3, 0.05]} c="#e5b8b8" />
        </group>
      ))}
      <Box p={[0, 0.42, 0.6]} s={[0.14, 0.2, 0.14]} c="#868e96" />
      <Box p={[0, 0.25, 0.64]} s={[0.12, 0.18, 0.12]} c="#868e96" />
      <Box p={[0, 0.12, 0.7]} s={[0.1, 0.1, 0.14]} c="#868e96" />
      {[-0.11, 0.11].map((x) => (
        <group key={x}>
          <Box p={[x, 0.42, 0.6]} s={[0.05, 0.05, 0.14]} c="#fff9db" />
          <Box p={[x * 1.3, 0.7, 0.565]} s={[0.05, 0.05, 0.02]} c="#111" />
        </group>
      ))}
      <Box p={[0, 0.5, -0.42]} s={[0.04, 0.24, 0.04]} c="#868e96" />
    </group>
  ),

  /** A sitting monkey with a pale face, holding a banana. */
  singe: () => (
    <group>
      <Box p={[0, 0.27, -0.02]} s={[0.34, 0.38, 0.28]} c="#7a4a24" />
      <Box p={[0, 0.27, 0.11]} s={[0.22, 0.26, 0.04]} c="#d2a679" />
      {[-0.11, 0.11].map((x) => (
        <group key={x}>
          <Box p={[x, 0.06, 0.16]} s={[0.12, 0.12, 0.24]} c="#7a4a24" />
          <Box p={[x * 1.9, 0.3, 0.08]} s={[0.08, 0.08, 0.24]} c="#7a4a24" />
        </group>
      ))}
      <Box p={[0, 0.3, 0.24]} s={[0.24, 0.05, 0.05]} c="#fcc419" r={0.3} />
      <Box p={[0, 0.62, 0]} s={[0.32, 0.3, 0.28]} c="#7a4a24" />
      <Box p={[0, 0.6, 0.13]} s={[0.24, 0.22, 0.06]} c="#e8c39e" />
      <Box p={[0, 0.54, 0.17]} s={[0.14, 0.08, 0.04]} c="#d2a679" />
      {[-0.06, 0.06].map((x) => (
        <Box key={x} p={[x, 0.65, 0.165]} s={[0.04, 0.05, 0.02]} c="#111" />
      ))}
      {[-0.2, 0.2].map((x) => (
        <Box key={x} p={[x, 0.63, 0]} s={[0.07, 0.12, 0.1]} c="#e8c39e" />
      ))}
      <Box p={[0.12, 0.06, -0.24]} s={[0.24, 0.05, 0.05]} c="#7a4a24" />
      <Box p={[0.24, 0.16, -0.24]} s={[0.05, 0.2, 0.05]} c="#7a4a24" />
      <Box p={[0.18, 0.27, -0.24]} s={[0.12, 0.05, 0.05]} c="#7a4a24" />
    </group>
  ),

  /** A parrot: green body, red head and tail, hooked beak, on its perch. */
  perroquet: () => (
    <group>
      <Box p={[0, 0.05, 0]} s={[0.5, 0.06, 0.06]} c={WOOD} />
      <Box p={[-0.2, 0.02, 0]} s={[0.06, 0.04, 0.2]} c={WOOD} />
      <Box p={[0.2, 0.02, 0]} s={[0.06, 0.04, 0.2]} c={WOOD} />
      {[-0.05, 0.05].map((x) => (
        <Box key={x} p={[x, 0.1, 0.02]} s={[0.04, 0.06, 0.06]} c="#495057" />
      ))}
      <Box p={[0, 0.3, 0]} s={[0.24, 0.34, 0.22]} c="#2f9e44" />
      <Box p={[0, 0.28, 0.1]} s={[0.16, 0.24, 0.04]} c="#fab005" />
      {[-0.13, 0.13].map((x) => (
        <group key={x}>
          <Box p={[x, 0.3, -0.02]} s={[0.04, 0.3, 0.18]} c="#1c7ed6" />
          <Box p={[x, 0.38, 0]} s={[0.045, 0.14, 0.16]} c="#2f9e44" />
        </group>
      ))}
      <Box p={[0, 0.58, 0.02]} s={[0.22, 0.22, 0.22]} c="#e03131" />
      <Box p={[0, 0.56, 0.16]} s={[0.08, 0.1, 0.08]} c="#f1f3f5" />
      <Box p={[0, 0.5, 0.18]} s={[0.05, 0.06, 0.05]} c="#343a40" />
      {[-0.111, 0.111].map((x) => (
        <Box key={x} p={[x, 0.61, 0.06]} s={[0.01, 0.05, 0.05]} c="#111" />
      ))}
      <group position={[0, 0.16, -0.12]} rotation={[0.5, 0, 0]}>
        <Box p={[0, -0.12, 0]} s={[0.12, 0.3, 0.04]} c="#e03131" />
        <Box p={[0, -0.27, 0]} s={[0.08, 0.06, 0.04]} c="#1c7ed6" />
      </group>
    </group>
  ),

  /** A crocodile: long, flat, green, toothy snout, ridged back. */
  crocodile: () => (
    <group rotation={[0, 1.0, 0]} scale={0.78}>
      <Box p={[0, 0.12, 0]} s={[0.36, 0.18, 0.62]} c="#4f772d" />
      <Box p={[0, 0.12, 0.45]} s={[0.28, 0.14, 0.3]} c="#4f772d" />
      <Box p={[0, 0.1, 0.7]} s={[0.2, 0.1, 0.32]} c="#5c8a35" />
      <Box p={[0, 0.06, 0.66]} s={[0.21, 0.02, 0.36]} c="#e9ecef" />
      {[-0.07, 0.07].map((x) => (
        <group key={x}>
          <Box p={[x, 0.22, 0.48]} s={[0.07, 0.07, 0.07]} c="#5c8a35" />
          <Box p={[x, 0.23, 0.52]} s={[0.04, 0.04, 0.01]} c="#fcc419" />
        </group>
      ))}
      <Box p={[0, 0.1, -0.44]} s={[0.24, 0.13, 0.28]} c="#4f772d" />
      <Box p={[0, 0.08, -0.7]} s={[0.15, 0.1, 0.26]} c="#4f772d" />
      <Box p={[0, 0.06, -0.92]} s={[0.08, 0.07, 0.2]} c="#4f772d" />
      {[-0.24, -0.08, 0.08, 0.24, -0.44].map((z) => (
        <Box key={z} p={[0, 0.23, z]} s={[0.06, 0.05, 0.08]} c="#3a5a20" />
      ))}
      {([[0.22, 0.2], [-0.22, 0.2], [0.22, -0.2], [-0.22, -0.2]] as [number, number][]).map(([x, z]) => (
        <Box key={`${x}${z}`} p={[x, 0.04, z]} s={[0.14, 0.08, 0.1]} c="#3a5a20" />
      ))}
    </group>
  ),

  /** A turtle: domed shell with plates, head and feet out. */
  tortue: () => (
    <group rotation={[0, 0.5, 0]}>
      {([[0.2, 0.18], [-0.2, 0.18], [0.2, -0.18], [-0.2, -0.18]] as [number, number][]).map(([x, z]) => (
        <Box key={`${x}${z}`} p={[x, 0.04, z]} s={[0.12, 0.08, 0.12]} c="#82c91e" />
      ))}
      <Box p={[0, 0.1, 0.36]} s={[0.15, 0.13, 0.18]} c="#82c91e" />
      {[-0.04, 0.04].map((x) => (
        <Box key={x} p={[x, 0.14, 0.45]} s={[0.03, 0.03, 0.01]} c="#111" />
      ))}
      <Box p={[0, 0.05, -0.34]} s={[0.05, 0.04, 0.1]} c="#82c91e" />
      <Cyl p={[0, 0.12, 0]} r={[0.3, 0.36]} h={0.1} n={8} c="#5c940d" />
      <Cyl p={[0, 0.22, 0]} r={[0.2, 0.3]} h={0.1} n={8} c="#2b8a3e" />
      <Cyl p={[0, 0.28, 0]} r={[0.1, 0.2]} h={0.04} n={6} c="#2b8a3e" />
      <Cyl p={[0, 0.301, 0]} r={[0.09, 0.09]} h={0.01} n={6} c="#5c940d" />
      {Array.from({ length: 6 }, (_, k) => {
        const a = (k / 6) * Math.PI * 2
        return <Box key={k} p={[Math.cos(a) * 0.22, 0.24, Math.sin(a) * 0.22]} s={[0.08, 0.08, 0.08]} c="#5c940d" r={-a} />
      })}
    </group>
  ),

  /** A little blue bird with an orange beak. */
  oiseau: () => (
    <group rotation={[0, 0.4, 0]}>
      {[-0.05, 0.05].map((x) => (
        <Box key={x} p={[x, 0.06, 0]} s={[0.025, 0.12, 0.025]} c="#f08c00" />
      ))}
      <Sph p={[0, 0.24, 0]} s={[1, 0.85, 1.2]} r={0.16} n={8} c="#339af0" />
      <Sph p={[0, 0.24, 0.06]} s={[0.8, 0.7, 1]} r={0.14} n={8} c="#e7f5ff" />
      <Sph p={[0, 0.4, 0.1]} r={0.11} n={8} c="#339af0" />
      <Cone p={[0, 0.39, 0.23]} rot={RX} r={0.035} h={0.09} n={4} c="#f08c00" />
      {[-0.06, 0.06].map((x) => (
        <Box key={x} p={[x, 0.43, 0.18]} s={[0.03, 0.03, 0.02]} c="#111" />
      ))}
      {[-1, 1].map((sd) => (
        <Box key={sd} p={[sd * 0.14, 0.26, -0.03]} s={[0.04, 0.12, 0.22]} c="#1864ab" />
      ))}
      <group position={[0, 0.26, -0.18]} rotation={[-0.5, 0, 0]}>
        <Box p={[0, 0, -0.08]} s={[0.12, 0.03, 0.18]} c="#1864ab" />
      </group>
    </group>
  ),

  /** A butterfly with orange wings open in a V. */
  papillon: () => (
    <group>
      <Box p={[0, 0.06, 0]} s={[0.06, 0.06, 0.4]} c="#212529" />
      <Box p={[0, 0.07, 0.23]} s={[0.07, 0.07, 0.07]} c="#212529" />
      {[-1, 1].map((sd) => (
        <group key={sd} position={[0, 0.06, 0]} rotation={[0, 0, sd * 0.22]}>
          <Box p={[sd * 0.22, 0, 0.1]} s={[0.4, 0.02, 0.3]} c="#f76707" />
          <Box p={[sd * 0.38, 0.012, 0.18]} s={[0.1, 0.01, 0.1]} c="#212529" />
          <Box p={[sd * 0.32, 0.014, 0.18]} s={[0.04, 0.01, 0.04]} c="#ffffff" />
          <Box p={[sd * 0.17, 0, -0.12]} s={[0.3, 0.02, 0.2]} c="#fd7e14" />
          <Box p={[sd * 0.27, 0.012, -0.16]} s={[0.08, 0.01, 0.08]} c="#212529" />
          <Box p={[sd * 0.4, 0.011, 0.1]} s={[0.03, 0.01, 0.3]} c="#212529" />
        </group>
      ))}
      {[-1, 1].map((sd) => (
        <group key={`a${sd}`} position={[sd * 0.02, 0.1, 0.26]} rotation={[0.9, sd * -0.4, 0]}>
          <Box p={[0, 0.08, 0]} s={[0.012, 0.16, 0.012]} c="#212529" />
        </group>
      ))}
    </group>
  ),

  /** An airliner, nose toward us, orange and green. */
  avion: () => (
    <group>
      <Cyl p={[0, 0.25, 0]} rot={RX} r={[0.11, 0.11]} h={0.8} n={10} c="#f8f9fa" />
      <Sph p={[0, 0.25, 0.4]} s={[1, 1, 1.5]} r={0.11} n={10} c="#f8f9fa" />
      <Cone p={[0, 0.27, -0.5]} rot={[-Math.PI / 2, 0, 0]} s={[1, 1, 0.7]} r={0.11} h={0.24} n={10} c="#f8f9fa" />
      <Box p={[0, 0.27, 0.5]} s={[0.16, 0.05, 0.06]} c="#212529" />
      <Box p={[0, 0.23, 0.02]} s={[1.2, 0.04, 0.24]} c="#dee2e6" />
      <Box p={[0.6, 0.23, -0.06]} s={[0.06, 0.04, 0.1]} c="#f08c00" />
      <Box p={[-0.6, 0.23, -0.06]} s={[0.06, 0.04, 0.1]} c="#f08c00" />
      {[-0.3, 0.3].map((x) => (
        <Cyl key={x} p={[x, 0.17, 0.08]} rot={RX} r={[0.05, 0.05]} h={0.18} n={8} c="#adb5bd" />
      ))}
      <Box p={[0, 0.45, -0.52]} s={[0.04, 0.3, 0.18]} c="#2f9e44" />
      <Box p={[0, 0.3, -0.54]} s={[0.4, 0.03, 0.12]} c="#dee2e6" />
      <Box p={[0.111, 0.27, 0.05]} s={[0.01, 0.04, 0.6]} c="#f08c00" />
      <Box p={[-0.111, 0.27, 0.05]} s={[0.01, 0.04, 0.6]} c="#f08c00" />
      {[0.3, -0.12].map((z) => (
        <Box key={z} p={[0, 0.065, z]} s={[0.03, 0.13, 0.03]} c="#495057" />
      ))}
      <Box p={[0, 0.03, 0.3]} s={[0.06, 0.06, 0.06]} c="#212529" />
      <Box p={[0, 0.03, -0.12]} s={[0.16, 0.06, 0.06]} c="#212529" />
    </group>
  ),

  /** A fluffy white cloud. */
  nuage: () => (
    <group>
      <Ico p={[0, 0.3, 0]} r={0.28} d={1} c="#ffffff" />
      <Ico p={[-0.3, 0.2, 0.02]} r={0.2} d={1} c="#f8f9fa" />
      <Ico p={[0.3, 0.22, 0]} r={0.22} d={1} c="#f8f9fa" />
      <Ico p={[0.12, 0.42, -0.05]} r={0.2} d={1} c="#ffffff" />
      <Box p={[0, 0.1, 0]} s={[0.8, 0.2, 0.36]} c="#e9ecef" />
    </group>
  ),

  /** A shining sun with rays. */
  soleil: () => (
    <group position={[0, 0.5, 0]}>
      <Cyl p={[0, 0, 0]} rot={RX} r={[0.27, 0.27]} h={0.16} n={14} c="#fcc419" g={0.5} />
      <Cyl p={[0, 0, 0.06]} rot={RX} r={[0.2, 0.2]} h={0.06} n={14} c="#ffe066" g={0.6} />
      {Array.from({ length: 8 }, (_, k) => (
        <group key={k} rotation={[0, 0, (k / 8) * Math.PI * 2]}>
          <Cone p={[0, 0.39, 0]} r={0.08} h={0.2} n={4} c="#ff922b" g={0.5} />
        </group>
      ))}
    </group>
  ),

  /** A crescent moon, pale yellow. */
  lune: () => (
    <group>
      <Px rows={['..####.', '.###...', '###....', '###....', '###....', '.###...', '..####.']} u={0.11} d={0.16} c="#ffd43b" g={0.35} />
    </group>
  ),

  /** A five-pointed golden star. */
  etoile: () => (
    <group position={[0, 0.37, 0]}>
      <Cyl p={[0, 0, 0]} rot={RX} r={[0.17, 0.17]} h={0.14} n={5} c="#fcc419" g={0.5} />
      {Array.from({ length: 5 }, (_, k) => (
        <group key={k} rotation={[0, 0, (k / 5) * Math.PI * 2]}>
          <Cone p={[0, 0.28, 0]} s={[1, 1, 0.5]} r={0.13} h={0.3} n={4} c="#fcc419" g={0.5} />
        </group>
      ))}
    </group>
  ),

  /** A grey stone and a pebble. */
  caillou: () => (
    <group>
      <mesh position={[0, 0.14, 0]} scale={[1.2, 0.7, 1]} rotation={[0.3, 0.5, 0.2]} castShadow receiveShadow>
        <dodecahedronGeometry args={[0.24, 0]} />
        <M c="#868e96" />
      </mesh>
      <mesh position={[0.3, 0.06, 0.18]} scale={[1.2, 0.7, 1]} castShadow receiveShadow>
        <dodecahedronGeometry args={[0.1, 0]} />
        <M c="#adb5bd" />
      </mesh>
    </group>
  ),

  /** A green leaf with its midrib and stem. */
  feuille: () => (
    <group rotation={[0, 0.6, 0]}>
      <Sph p={[0, 0.03, 0]} s={[0.24, 0.03, 0.45]} r={1} n={10} c="#40c057" />
      <Box p={[0, 0.06, 0]} s={[0.025, 0.01, 0.8]} c="#2b8a3e" />
      {[-0.2, 0, 0.2].map((z) => (
        <group key={z}>
          <Box p={[0.07, 0.058, z + 0.05]} s={[0.14, 0.008, 0.015]} c="#2b8a3e" r={-0.6} />
          <Box p={[-0.07, 0.058, z + 0.05]} s={[0.14, 0.008, 0.015]} c="#2b8a3e" r={0.6} />
        </group>
      ))}
      <Box p={[0, 0.02, -0.52]} s={[0.03, 0.03, 0.16]} c="#7f4f24" />
    </group>
  ),

  // ---------- Culture ----------

  /** A painting on its easel: a sunny landscape in a gold frame. */
  tableau: () => (
    <group>
      <Rod a={[-0.3, 0]} b={[-0.18, 1.0]} c={WOOD} t={0.05} z={0.05} />
      <Rod a={[0.3, 0]} b={[0.18, 1.0]} c={WOOD} t={0.05} z={0.05} />
      <group position={[0, 0, -0.18]} rotation={[0.25, 0, 0]}>
        <Box p={[0, 0.48, 0]} s={[0.05, 0.96, 0.05]} c={WOOD} />
      </group>
      <Box p={[0, 0.3, 0.1]} s={[0.66, 0.05, 0.08]} c={WOOD} />
      <group position={[0, 0.6, 0.06]} rotation={[-0.12, 0, 0]}>
        <Box p={[0, 0, 0]} s={[0.72, 0.56, 0.04]} c={GOLD} />
        <Box p={[0, 0.06, 0.02]} s={[0.62, 0.36, 0.02]} c="#74c0fc" />
        <Box p={[0, -0.18, 0.02]} s={[0.62, 0.12, 0.02]} c="#40c057" />
        <Box p={[-0.15, -0.08, 0.025]} s={[0.24, 0.12, 0.02]} c="#2f9e44" />
        <Box p={[0.18, 0.15, 0.03]} s={[0.1, 0.1, 0.02]} c="#fcc419" />
      </group>
    </group>
  ),

  /** An ebony statue on a stone plinth. */
  statue: () => (
    <group>
      <Box p={[0, 0.12, 0]} s={[0.42, 0.24, 0.42]} c="#adb5bd" />
      <Box p={[0, 0.26, 0]} s={[0.34, 0.04, 0.34]} c="#ced4da" />
      <Box p={[0, 0.3, 0]} s={[0.24, 0.04, 0.2]} c="#3b2414" />
      {[-0.06, 0.06].map((x) => (
        <Box key={x} p={[x, 0.44, 0]} s={[0.08, 0.24, 0.09]} c="#3b2414" />
      ))}
      <Box p={[0, 0.7, 0]} s={[0.22, 0.3, 0.14]} c="#4a2e1a" />
      <Box p={[0, 0.66, 0.08]} s={[0.12, 0.08, 0.04]} c="#4a2e1a" />
      {[-0.14, 0.14].map((x) => (
        <Box key={x} p={[x, 0.66, 0]} s={[0.06, 0.32, 0.07]} c="#3b2414" />
      ))}
      <Box p={[0, 0.88, 0]} s={[0.07, 0.06, 0.07]} c="#3b2414" />
      <Box p={[0, 1.0, 0.01]} s={[0.16, 0.2, 0.16]} c="#4a2e1a" />
      <Box p={[0, 1.12, -0.02]} s={[0.12, 0.06, 0.12]} c="#3b2414" />
      {[-0.04, 0.04].map((x) => (
        <Box key={x} p={[x, 1.02, 0.095]} s={[0.04, 0.015, 0.01]} c="#f1dcb0" />
      ))}
      <Box p={[0, 0.98, 0.1]} s={[0.03, 0.06, 0.02]} c="#3b2414" />
    </group>
  ),

  /** An Ivorian wooden mask on a stand: long face, slit eyes, white markings. */
  masque: () => (
    <group>
      <Box p={[0, 0.03, 0]} s={[0.32, 0.06, 0.22]} c="#3d2412" />
      <Box p={[0, 0.2, -0.06]} s={[0.05, 0.3, 0.05]} c="#3d2412" />
      <group position={[0, 0.6, 0]} rotation={[-0.15, 0, 0]}>
        <Box p={[0, 0, 0]} s={[0.36, 0.5, 0.1]} c="#9c5a1a" />
        <Box p={[0, 0.3, 0]} s={[0.26, 0.1, 0.09]} c="#9c5a1a" />
        <Box p={[0, -0.3, 0]} s={[0.22, 0.12, 0.09]} c="#9c5a1a" />
        <Box p={[0, -0.39, 0]} s={[0.12, 0.06, 0.08]} c="#9c5a1a" />
        {[-1, 1].map((sd) => (
          <group key={sd}>
            <Box p={[sd * 0.08, 0.08, 0.055]} s={[0.1, 0.035, 0.02]} c="#111" />
            <Box p={[sd * 0.12, -0.05, 0.055]} s={[0.03, 0.12, 0.01]} c="#f8f9fa" />
            <Box p={[sd * 0.08, 0.4, 0]} s={[0.05, 0.14, 0.05]} c="#6b3e1d" />
          </group>
        ))}
        <Box p={[0, 0.0, 0.08]} s={[0.07, 0.2, 0.06]} c="#7f4f24" />
        <Box p={[0, -0.2, 0.06]} s={[0.12, 0.05, 0.03]} c="#c92a2a" />
        <Box p={[0, 0.22, 0.055]} s={[0.04, 0.12, 0.01]} c="#f8f9fa" />
      </group>
    </group>
  ),

  /** A black photo camera with a big lens and flash. */
  'appareil-photo': () => (
    <group>
      <Box p={[0, 0.2, 0]} s={[0.66, 0.4, 0.28]} c="#212529" />
      <Box p={[0, 0.2, 0.001]} s={[0.67, 0.12, 0.282]} c="#495057" />
      <Box p={[-0.05, 0.44, 0]} s={[0.22, 0.1, 0.2]} c="#212529" />
      <Box p={[0.22, 0.43, 0]} s={[0.1, 0.05, 0.1]} c="#e03131" />
      <Box p={[-0.22, 0.42, 0.06]} s={[0.12, 0.05, 0.08]} c="#f8f9fa" glow={0.3} />
      <Cyl p={[0, 0.2, 0.2]} rot={RX} r={[0.15, 0.15]} h={0.14} n={14} c="#343a40" />
      <Cyl p={[0, 0.2, 0.26]} rot={RX} r={[0.12, 0.12]} h={0.04} n={14} c="#111" />
      <Cyl p={[0, 0.2, 0.28]} rot={RX} r={[0.08, 0.08]} h={0.01} n={14} c="#4dabf7" g={0.3} />
    </group>
  ),

  /** A colourful poster pinned on a board on two posts. */
  affiche: () => (
    <group>
      {[-0.32, 0.32].map((x) => (
        <Box key={x} p={[x, 0.45, -0.03]} s={[0.05, 0.9, 0.05]} c="#495057" />
      ))}
      <Box p={[0, 0.58, 0]} s={[0.72, 0.62, 0.03]} c="#f8f9fa" />
      <Box p={[0, 0.58, 0.02]} s={[0.6, 0.52, 0.01]} c="#7048e8" />
      <Box p={[0, 0.77, 0.03]} s={[0.5, 0.08, 0.01]} c="#fcc419" />
      <Box p={[0, 0.58, 0.03]} s={[0.14, 0.14, 0.01]} c="#ffa94d" />
      <Box p={[0, 0.44, 0.03]} s={[0.22, 0.14, 0.01]} c="#f76707" />
      <Box p={[0, 0.36, 0.03]} s={[0.4, 0.03, 0.01]} c="#ffffff" />
      {[-0.27, 0.27].map((x) => (
        <Box key={x} p={[x, 0.86, 0.03]} s={[0.04, 0.04, 0.02]} c="#e03131" />
      ))}
    </group>
  ),

  /** An old movie camera: two film reels on top, lens, tripod. */
  camera: () => (
    <group>
      {[-0.4, 0.4].map((a) => (
        <group key={a} position={[0, 0.42, 0]} rotation={[0, 0, a]}>
          <Box p={[0, -0.21, 0]} s={[0.04, 0.42, 0.04]} c="#495057" />
        </group>
      ))}
      <group position={[0, 0.42, 0]} rotation={[-0.4, 0, 0]}>
        <Box p={[0, -0.21, 0]} s={[0.04, 0.42, 0.04]} c="#495057" />
      </group>
      <Box p={[0, 0.56, 0]} s={[0.26, 0.26, 0.5]} c="#343a40" />
      <Cyl p={[0, 0.56, 0.32]} rot={RX} r={[0.08, 0.1]} h={0.16} n={10} c="#212529" />
      <Cyl p={[0, 0.56, 0.4]} rot={RX} r={[0.07, 0.07]} h={0.01} n={10} c="#4dabf7" g={0.3} />
      {[0.12, -0.17].map((z) => (
        <group key={z}>
          <Cyl p={[0, 0.86, z]} rot={RZ} r={[0.15, 0.15]} h={0.06} n={14} c="#212529" />
          <Cyl p={[0, 0.86, z]} rot={RZ} r={[0.05, 0.05]} h={0.08} n={10} c="#adb5bd" />
        </group>
      ))}
      <Box p={[0.14, 0.52, -0.1]} s={[0.03, 0.08, 0.08]} c="#e03131" />
    </group>
  ),

  /** A flat screen on its foot, lit blue. */
  ecran: () => (
    <group>
      <Box p={[0, 0.02, 0]} s={[0.36, 0.04, 0.22]} c="#343a40" />
      <Box p={[0, 0.14, -0.02]} s={[0.06, 0.22, 0.04]} c="#343a40" />
      <Box p={[0, 0.5, 0]} s={[1.0, 0.6, 0.05]} c="#212529" />
      <Box p={[0, 0.5, 0.026]} s={[0.92, 0.52, 0.01]} c="#228be6" glow={0.5} />
      <Box p={[-0.2, 0.42, 0.033]} s={[0.3, 0.2, 0.01]} c="#74c0fc" glow={0.5} />
      <Box p={[0.22, 0.6, 0.033]} s={[0.16, 0.16, 0.01]} c="#fcc419" glow={0.5} />
    </group>
  ),

  /** A TV remote with a red power button. */
  telecommande: () => (
    <group rotation={[0, 0.35, 0]}>
      <Box p={[0, 0.04, 0]} s={[0.2, 0.08, 0.7]} c="#212529" />
      <Box p={[0.05, 0.085, -0.28]} s={[0.05, 0.02, 0.05]} c="#e03131" />
      {Array.from({ length: 9 }, (_, k) => (
        <Box key={k} p={[((k % 3) - 1) * 0.05, 0.085, 0.06 + Math.floor(k / 3) * 0.06]} s={[0.035, 0.015, 0.035]} c="#adb5bd" />
      ))}
      <Box p={[0, 0.085, -0.12]} s={[0.1, 0.02, 0.1]} c="#495057" />
      <Box p={[0, 0.09, -0.12]} s={[0.04, 0.02, 0.04]} c="#1c7ed6" />
    </group>
  ),

  /** A film clapperboard, the striped clapper raised. */
  clap: () => (
    <group rotation={[-0.25, 0, 0]}>
      <Box p={[0, 0.25, 0]} s={[0.7, 0.5, 0.05]} c="#212529" />
      {[0.12, 0.24, 0.36].map((y) => (
        <Box key={y} p={[0, y, 0.026]} s={[0.6, 0.012, 0.005]} c="#ced4da" />
      ))}
      <Box p={[0, 0.53, 0]} s={[0.7, 0.07, 0.05]} c="#212529" />
      {[0, 1, 2, 3].map((k) => (
        <group key={k} position={[-0.26 + k * 0.17, 0.53, 0.026]} rotation={[0, 0, -0.6]}>
          <Box p={[0, 0, 0]} s={[0.05, 0.1, 0.005]} c="#ffffff" />
        </group>
      ))}
      <group position={[-0.35, 0.58, 0]} rotation={[0, 0, 0.35]}>
        <Box p={[0.35, 0.035, 0]} s={[0.7, 0.07, 0.05]} c="#212529" />
        {[0, 1, 2, 3].map((k) => (
          <group key={k} position={[0.09 + k * 0.17, 0.035, 0.026]} rotation={[0, 0, 0.6]}>
            <Box p={[0, 0, 0]} s={[0.05, 0.1, 0.005]} c="#ffffff" />
          </group>
        ))}
      </group>
    </group>
  ),

  /** Two cinema tickets with their tear-off stubs. */
  'billet-cinema': () => (
    <group>
      {[0, 1].map((k) => (
        <group key={k} position={[k * 0.08 - 0.04, 0.01 + k * 0.022, k * 0.12 - 0.06]} rotation={[0, k ? -0.15 : 0.25, 0]}>
          <Box p={[0, 0, 0]} s={[0.72, 0.02, 0.32]} c={k ? '#e03131' : '#f08c00'} />
          {[-0.12, -0.06, 0, 0.06, 0.12].map((z) => (
            <Box key={z} p={[0.2, 0.011, z]} s={[0.02, 0.005, 0.03]} c="#fff3bf" />
          ))}
          <Box p={[-0.1, 0.012, 0]} s={[0.24, 0.005, 0.16]} c="#fff3bf" />
          <Box p={[-0.1, 0.014, 0]} s={[0.08, 0.005, 0.08]} c="#212529" r={0.785} />
          <Box p={[0.28, 0.012, 0]} s={[0.08, 0.005, 0.08]} c={GOLD} />
        </group>
      ))}
    </group>
  ),

  // ---------- Bits to clean off, little effects ----------

  /** A flat brown stain. */
  tache: () => (
    <group>
      <Cyl p={[0, 0.01, 0]} r={[0.14, 0.14]} h={0.02} n={9} c="#6b4423" />
      <Cyl p={[0.1, 0.012, 0.06]} r={[0.08, 0.08]} h={0.02} n={7} c="#6b4423" />
      <Cyl p={[-0.09, 0.011, -0.07]} r={[0.07, 0.07]} h={0.02} n={7} c="#5c3a1c" />
      <Cyl p={[0.18, 0.008, -0.1]} r={[0.03, 0.03]} h={0.015} n={6} c="#6b4423" />
    </group>
  ),

  /** A little heap of grey dust. */
  poussiere: () => (
    <group>
      <Cone p={[0, 0.06, 0]} r={0.16} h={0.12} n={7} c="#adb5bd" />
      <Ico p={[0.12, 0.03, 0.06]} r={0.05} c="#ced4da" />
      <Ico p={[-0.12, 0.025, 0.04]} r={0.04} c="#868e96" />
      <Ico p={[0.03, 0.02, -0.13]} r={0.035} c="#ced4da" />
    </group>
  ),

  /** A blob of white foam. */
  mousse: () => (
    <group>
      <Ico p={[0, 0.1, 0]} r={0.11} d={1} c="#ffffff" />
      <Ico p={[0.1, 0.07, 0.04]} r={0.08} d={1} c="#f1f3f5" />
      <Ico p={[-0.1, 0.07, 0.03]} r={0.08} d={1} c="#ffffff" />
      <Ico p={[0.02, 0.07, -0.09]} r={0.08} d={1} c="#e7f5ff" />
      <Ico p={[0.03, 0.19, 0.02]} r={0.06} d={1} c="#ffffff" />
    </group>
  ),

  /** A short dark tuft of hair. */
  cheveu: () => (
    <group>
      {[-0.5, -0.25, 0, 0.25, 0.5].map((a, i) => (
        <group key={i} position={[0, 0.02, 0]} rotation={[0, a + 0.3, 0]}>
          <group rotation={[0, 0, 0.25 + (i % 2) * 0.15]}>
            <Box p={[0.12, 0, 0]} s={[0.26, 0.025, 0.025]} c="#1a1110" />
          </group>
          <group rotation={[0, 0, -0.2]}>
            <Box p={[-0.1, 0, 0]} s={[0.2, 0.025, 0.025]} c="#2b1d18" />
          </group>
        </group>
      ))}
    </group>
  ),

  /** A broken bit of egg shell. */
  coquille: () => (
    <group>
      <mesh position={[0, 0.13, 0]} rotation={[0.3, 0.4, 0.2]} castShadow>
        <sphereGeometry args={[0.15, 8, 6, 0, Math.PI * 1.1, Math.PI / 2, Math.PI / 2]} />
        <M c="#efd9b4" ds />
      </mesh>
      <Box p={[0.15, 0.01, 0.1]} s={[0.06, 0.02, 0.05]} c="#efd9b4" r={0.5} />
    </group>
  ),

  /** A blue water drop. */
  goutte: () => (
    <group>
      <Sph p={[0, 0.11, 0]} r={0.11} n={10} c="#339af0" g={0.15} />
      <Cone p={[0, 0.26, 0]} r={0.095} h={0.17} n={10} c="#339af0" g={0.15} />
      <Sph p={[-0.04, 0.15, 0.08]} r={0.025} n={6} c="#ffffff" g={0.4} />
    </group>
  ),

  /** A flickering orange and yellow flame. */
  flamme: () => (
    <group>
      <Cone p={[0, 0.16, 0]} r={0.14} h={0.32} n={7} c="#f76707" g={0.9} />
      <Cone p={[0.08, 0.1, 0.03]} r={0.07} h={0.2} n={6} c="#fa5252" g={0.8} />
      <Cone p={[-0.08, 0.09, 0.03]} r={0.07} h={0.18} n={6} c="#fa5252" g={0.8} />
      <Cone p={[0, 0.12, 0.06]} r={0.08} h={0.2} n={6} c="#ffd43b" g={1} />
    </group>
  ),

  /** A see-through soap bubble with its shine. */
  bulle: () => (
    <group>
      <Sph p={[0, 0.18, 0]} r={0.18} n={14} c="#a5d8ff" o={0.5} />
      <Sph p={[-0.07, 0.25, 0.12]} r={0.035} n={6} c="#ffffff" g={0.6} />
    </group>
  ),

  /** A red voxel heart. */
  coeur: () => (
    <group scale={0.9}>
      <Px rows={['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...']} u={0.055} d={0.1} c="#e03131" g={0.35} />
    </group>
  ),

  /** A black eighth note. */
  'note-musique': () => (
    <group>
      <Sph p={[-0.06, 0.07, 0]} rot={[0, 0, 0.4]} s={[1.3, 0.9, 0.7]} r={0.075} n={8} c="#111" />
      <Box p={[0.025, 0.24, 0]} s={[0.03, 0.34, 0.04]} c="#111" />
      <group position={[0.025, 0.4, 0]} rotation={[0, 0, -0.7]}>
        <Box p={[0.06, -0.02, 0]} s={[0.14, 0.04, 0.04]} c="#111" />
      </group>
      <group position={[0.11, 0.3, 0]} rotation={[0, 0, 0.5]}>
        <Box p={[0, 0, 0]} s={[0.03, 0.1, 0.04]} c="#111" />
      </group>
    </group>
  ),
}
