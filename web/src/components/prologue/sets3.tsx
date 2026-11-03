import { Box, Sign } from '../../world3d/props'

// The chapters' sets (the stories' places their chapters send the Sim to, sets.tsx's rules): a place of
// worship, the pharmacy, a boutique, an office.

type P = { t: number; mood: string }

function Ground({ c, size = 16 }: { c: string; size?: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[size, size]} />
      <meshLambertMaterial color={c} />
    </mesh>
  )
}

function Room({ wall, floor, dim = false }: { wall: string; floor: string; dim?: boolean }) {
  return (
    <>
      <color attach="background" args={[dim ? '#1a1426' : '#f3e3c3']} />
      <hemisphereLight args={['#fff4e6', '#2a1a10', dim ? 0.6 : 1.1]} />
      <ambientLight intensity={dim ? 0.25 : 0.4} />
      <directionalLight position={[3, 5, 5]} intensity={dim ? 0.6 : 1.4} castShadow />
      <Ground c={floor} />
      <Box p={[0, 1.8, -3.2]} s={[12, 3.6, 0.2]} c={wall} />
      <Box p={[-5.2, 1.8, 0]} s={[0.2, 3.6, 8]} c={wall} />
      <Box p={[5.2, 1.8, 0]} s={[0.2, 3.6, 8]} c={wall} />
    </>
  )
}

/** A place of worship: the benches in rows, the high window and its light, the candles. */
function Culte({ t }: P) {
  const flame = 0.8 + 0.2 * Math.sin(t * 11)
  return (
    <>
      <Room wall="#e9dfc9" floor="#9a8366" dim />
      <Box p={[0, 2.3, -3.08]} s={[1.4, 2.2, 0.04]} c="#7fb4e6" glow={0.5} />
      <Box p={[0, 2.3, -3.06]} s={[0.06, 2.2, 0.02]} c="#3d2b1f" />
      <Box p={[0, 2.6, -3.06]} s={[1.4, 0.06, 0.02]} c="#3d2b1f" />
      <directionalLight position={[0, 4, -2]} intensity={1.0} color="#cfe4ff" />
      {[-1.6, -0.2, 1.2].map((z) =>
        [-2.2, 2.2].map((x) => (
          <group key={`${x}${z}`} position={[x, 0, z]}>
            <Box p={[0, 0.45, 0]} s={[2.6, 0.08, 0.45]} c="#6b4423" />
            <Box p={[0, 0.8, -0.22]} s={[2.6, 0.6, 0.06]} c="#5c3a21" />
          </group>
        )),
      )}
      <Box p={[0, 0.5, -2.6]} s={[2.0, 1.0, 0.6]} c="#f1e9d2" />
      {[-0.6, 0.6].map((x) => (
        <group key={x}>
          <Box p={[x, 1.15, -2.6]} s={[0.07, 0.3, 0.07]} c="#fbf5e6" />
          <mesh position={[x, 1.35, -2.6]}>
            <sphereGeometry args={[0.05, 8, 6]} />
            <meshBasicMaterial color="#ffd43b" toneMapped={false} />
          </mesh>
          <pointLight position={[x, 1.4, -2.4]} intensity={2.5 * flame} distance={3} color="#ffc078" />
        </group>
      ))}
    </>
  )
}

/** The pharmacy: the green cross, the counter, the shelves of boxes. */
function Pharmacie(_: P) {
  return (
    <>
      <Room wall="#f1f5f2" floor="#c8ccd2" />
      <Sign p={[0, 3.0, -3.05]} w={3.2} text="PHARMACIE" bg="#2b8a3e" fg="#fbf5e6" />
      <group position={[3.2, 2.9, -3.05]}>
        <Box p={[0, 0, 0]} s={[0.6, 0.18, 0.04]} c="#2f9e44" glow={0.6} />
        <Box p={[0, 0, 0]} s={[0.18, 0.6, 0.04]} c="#2f9e44" glow={0.6} />
      </group>
      {[-3.4, -1.2, 1.2, 3.4].map((x) =>
        [0.6, 1.2, 1.8].map((y) => (
          <group key={`${x}${y}`}>
            <Box p={[x, y, -2.95]} s={[2.0, 0.05, 0.4]} c="#dee2e6" />
            {[-0.6, -0.2, 0.2, 0.6].map((dx, i) => (
              <Box key={dx} p={[x + dx, y + 0.16, -2.95]} s={[0.28, 0.26, 0.24]} c={['#ffffff', '#74c0fc', '#ff8787', '#ffd43b'][(i + Math.round(x)) & 3]} />
            ))}
          </group>
        )),
      )}
      <Box p={[0, 0.55, -1.6]} s={[4.4, 1.1, 0.7]} c="#f8f9fa" />
      <Box p={[0, 1.12, -1.6]} s={[4.5, 0.06, 0.8]} c="#2b8a3e" />
    </>
  )
}

/** A boutique of the quartier: the shelves of tins, bottles and packets, the counter, the sign. */
function Boutique(_: P) {
  return (
    <>
      <Room wall="#f4e2b8" floor="#a8845a" />
      <Sign p={[0, 3.0, -3.05]} w={3.4} text="BOUTIQUE DU QUARTIER" bg="#e8590c" fg="#fbf5e6" />
      {[-3.4, -1.2, 1.2, 3.4].map((x) =>
        [0.5, 1.1, 1.7, 2.3].map((y) => (
          <group key={`${x}${y}`}>
            <Box p={[x, y, -2.95]} s={[2.0, 0.05, 0.4]} c="#7a5230" />
            {[-0.7, -0.35, 0, 0.35, 0.7].map((dx, i) => (
              <Box key={dx} p={[x + dx, y + 0.17, -2.95]} s={[0.22, 0.3, 0.2]} c={['#e03131', '#ffd43b', '#1c7ed6', '#2f9e44', '#f08c00'][(i + Math.round(y * 3)) % 5]} />
            ))}
          </group>
        )),
      )}
      <Box p={[0, 0.5, -1.4]} s={[3.6, 1.0, 0.7]} c="#5c3a21" />
      <Box p={[1.2, 1.15, -1.4]} s={[0.5, 0.3, 0.4]} c="#343a40" />
    </>
  )
}

/** An office: the desk and its computer, the filing cabinets, the window on the city. */
function Bureau(_: P) {
  return (
    <>
      <Room wall="#e4e8ee" floor="#9aa0a8" />
      <Box p={[-2.4, 1.9, -3.08]} s={[2.4, 1.4, 0.04]} c="#9fd3ff" />
      <Box p={[0.6, 0.38, -1.8]} s={[2.4, 0.06, 1.0]} c="#7a5230" />
      {[-0.5, 1.7].map((x) => (
        <Box key={x} p={[x, 0.18, -1.8]} s={[0.08, 0.36, 0.9]} c="#5c3a21" />
      ))}
      <Box p={[0.9, 0.72, -2.1]} s={[0.7, 0.45, 0.05]} c="#212529" />
      <Box p={[0.9, 0.72, -2.07]} s={[0.62, 0.38, 0.01]} c="#4dabf7" glow={0.4} />
      {[3.2, 3.9].map((x) => (
        <Box key={x} p={[x, 0.7, -2.8]} s={[0.6, 1.4, 0.6]} c="#adb5bd" />
      ))}
    </>
  )
}

export const SETS3: Record<string, (p: P) => React.ReactElement> = {
  culte: Culte,
  pharmacie: Pharmacie,
  boutique: Boutique,
  bureau: Bureau,
}
