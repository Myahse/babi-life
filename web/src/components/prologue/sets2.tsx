import { Box, Sign } from '../../world3d/props'

// More of the prologues' sets (sets.tsx, the same rules): the market, the pitch, the lagoon, the gare,
// the caimans' lake, the gallery, the port, the zoo, the cacao plantation, the salon, the kitchen, the
// games room, the stadium, the airport, the commissariat, the classroom. Animals come with their set's
// mood (the cat, the chimpanzee, the caimans).

type P = { t: number; mood: string }

function Ground({ c, size = 60 }: { c: string; size?: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[size, size]} />
      <meshLambertMaterial color={c} />
    </mesh>
  )
}

/** Daylight or night outside: the sky's colour, the sun or the moon, the fog. */
function Outside({ night = false, bg, far = 34 }: { night?: boolean; bg?: string; far?: number }) {
  const sky = bg ?? (night ? '#070b24' : '#ffd59a')
  return (
    <>
      <color attach="background" args={[sky]} />
      <fog attach="fog" args={[sky, night ? 8 : 14, far]} />
      <hemisphereLight args={[night ? '#4a5a9a' : '#fff1d6', night ? '#1a1410' : '#a0703a', night ? 0.55 : 1.15]} />
      <directionalLight position={[5, 8, 4]} intensity={night ? 0.8 : 2.2} color={night ? '#9fb4ff' : '#ffe0b0'} castShadow shadow-mapSize={[1024, 1024]} />
      <ambientLight intensity={night ? 0.25 : 0.35} />
    </>
  )
}

/** A room: its floor, its back wall and side walls, its light. */
function Room({ wall, floor, light = '#fff4e6', dim = false }: { wall: string; floor: string; light?: string; dim?: boolean }) {
  return (
    <>
      <color attach="background" args={[dim ? '#0b0d1e' : '#f3e3c3']} />
      <hemisphereLight args={[light, '#2a1a10', dim ? 0.5 : 1.1]} />
      <ambientLight intensity={dim ? 0.2 : 0.4} />
      <directionalLight position={[3, 5, 5]} intensity={dim ? 0.4 : 1.4} castShadow />
      <Ground c={floor} size={16} />
      <Box p={[0, 1.6, -3.2]} s={[12, 3.2, 0.2]} c={wall} />
      <Box p={[-5.2, 1.6, 0]} s={[0.2, 3.2, 8]} c={wall} />
      <Box p={[5.2, 1.6, 0]} s={[0.2, 3.2, 8]} c={wall} />
    </>
  )
}

/** Grigri, Mamie Rose's big black cat: sitting, his tail curled; his yellow eyes. */
export function Cat({ p, r = 0, s = 1 }: { p: [number, number, number]; r?: number; s?: number }) {
  return (
    <group position={p} rotation={[0, r, 0]} scale={s}>
      <Box p={[0, 0.16, 0]} s={[0.28, 0.32, 0.4]} c="#1b1b20" />
      <Box p={[0, 0.38, 0.14]} s={[0.24, 0.22, 0.22]} c="#1b1b20" />
      <Box p={[-0.08, 0.53, 0.14]} s={[0.06, 0.08, 0.06]} c="#1b1b20" />
      <Box p={[0.08, 0.53, 0.14]} s={[0.06, 0.08, 0.06]} c="#1b1b20" />
      <Box p={[-0.05, 0.4, 0.26]} s={[0.05, 0.04, 0.01]} c="#ffd43b" glow={0.6} />
      <Box p={[0.05, 0.4, 0.26]} s={[0.05, 0.04, 0.01]} c="#ffd43b" glow={0.6} />
      <Box p={[0.16, 0.06, -0.1]} s={[0.06, 0.06, 0.36]} c="#1b1b20" />
    </group>
  )
}

/** A caiman, flat on the bank, its back ridged. */
function Caiman({ p, r = 0 }: { p: [number, number, number]; r?: number }) {
  return (
    <group position={p} rotation={[0, r, 0]}>
      <Box p={[0, 0.12, 0]} s={[0.5, 0.22, 1.6]} c="#3f5a2a" />
      <Box p={[0, 0.1, 1.1]} s={[0.34, 0.16, 0.7]} c="#4a6a30" />
      <Box p={[0, 0.06, -1.2]} s={[0.24, 0.12, 0.9]} c="#3f5a2a" />
      {[-0.5, -0.1, 0.3].map((z) => (
        <Box key={z} p={[0, 0.26, z]} s={[0.12, 0.06, 0.14]} c="#2f4520" />
      ))}
      {[-0.4, 0.4].map((z) =>
        [-0.3, 0.3].map((x) => <Box key={`${x}${z}`} p={[x, 0.05, z]} s={[0.12, 0.1, 0.16]} c="#3f5a2a" />),
      )}
    </group>
  )
}

/** Zézé the chimpanzee: crouched, long arms, his pale face. */
function Chimp({ p, r = 0, t = 0 }: { p: [number, number, number]; r?: number; t?: number }) {
  const swing = Math.sin(t * 3) * 0.3
  return (
    <group position={p} rotation={[0, r, 0]}>
      <Box p={[0, 0.45, 0]} s={[0.42, 0.5, 0.34]} c="#2b2018" />
      <Box p={[0, 0.82, 0.04]} s={[0.32, 0.3, 0.3]} c="#2b2018" />
      <Box p={[0, 0.78, 0.2]} s={[0.22, 0.18, 0.04]} c="#c9a07a" />
      <Box p={[-0.06, 0.84, 0.23]} s={[0.04, 0.04, 0.01]} c="#111" />
      <Box p={[0.06, 0.84, 0.23]} s={[0.04, 0.04, 0.01]} c="#111" />
      <group position={[-0.28, 0.65, 0]} rotation={[swing, 0, 0.2]}>
        <Box p={[0, -0.3, 0]} s={[0.12, 0.6, 0.12]} c="#2b2018" />
      </group>
      <group position={[0.28, 0.65, 0]} rotation={[-swing, 0, -0.2]}>
        <Box p={[0, -0.3, 0]} s={[0.12, 0.6, 0.12]} c="#2b2018" />
      </group>
      <Box p={[-0.12, 0.12, 0.04]} s={[0.14, 0.24, 0.18]} c="#2b2018" />
      <Box p={[0.12, 0.12, 0.04]} s={[0.14, 0.24, 0.18]} c="#2b2018" />
    </group>
  )
}

function Tree({ p, s = 1, c = '#2b7a3a' }: { p: [number, number, number]; s?: number; c?: string }) {
  return (
    <group position={p} scale={s}>
      <Box p={[0, 1.1, 0]} s={[0.3, 2.2, 0.3]} c="#6b4423" />
      <mesh position={[0, 2.7, 0]} castShadow>
        <icosahedronGeometry args={[1.1, 0]} />
        <meshLambertMaterial color={c} flatShading />
      </mesh>
    </group>
  )
}

function Palm({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <Box p={[0, 1.8, 0]} s={[0.22, 3.6, 0.22]} c="#8a6a45" />
      {[0, 1.2, 2.4, 3.6, 4.8].map((a) => (
        <Box key={a} p={[Math.sin(a) * 0.7, 3.6, Math.cos(a) * 0.7]} s={[0.25, 0.06, 1.4]} r={a} c="#2f8a3e" />
      ))}
    </group>
  )
}

/** The market: stalls in a row, their parasols, their goods (by mood: tomatoes, pagnes, the garba stand, the alloco and its cat). */
function Marche({ mood }: P) {
  const goods: Record<string, string[]> = { tissus: ['#ff7a00', '#1c7ed6', '#e64980', '#2f9e44', '#ffd43b'], tomates: ['#e03131', '#c92a2a', '#2b8a3e', '#f08c00'], korhogo: ['#7a5230', '#a07850', '#3d2b1f', '#c9a07a'] }
  const g = goods[mood] ?? ['#e03131', '#ffd43b', '#2b8a3e', '#f08c00', '#7a5230']
  return (
    <>
      <Outside />
      <Ground c="#b08a5a" />
      {[-4.2, -1.4, 1.4, 4.2].map((x, i) => (
        <group key={x} position={[x, 0, -2.6]}>
          <Box p={[0, 0.45, 0]} s={[2.2, 0.9, 1.0]} c="#7a5230" />
          {Array.from({ length: 5 }, (_, j) => (
            <Box key={j} p={[-0.8 + j * 0.4, 0.98, (j % 2) * 0.2 - 0.1]} s={[0.32, 0.16, 0.3]} c={g[(i + j) % g.length]} />
          ))}
          <Box p={[0, 1.3, -0.4]} s={[0.06, 1.6, 0.06]} c="#5c3a21" />
          <mesh position={[0, 2.15, 0]}>
            <coneGeometry args={[1.4, 0.5, 8]} />
            <meshLambertMaterial color={['#ff7a00', '#1c7ed6', '#e64980', '#2f9e44'][i]} flatShading />
          </mesh>
        </group>
      ))}
      {mood === 'garba' && (
        <group position={[0, 0, -0.9]}>
          <Box p={[0, 0.4, 0]} s={[1.4, 0.8, 0.7]} c="#5c3a21" />
          <mesh position={[-0.3, 0.92, 0]}>
            <cylinderGeometry args={[0.24, 0.22, 0.2, 12]} />
            <meshLambertMaterial color="#adb5bd" />
          </mesh>
          <mesh position={[0.3, 0.9, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.14, 12]} />
            <meshLambertMaterial color="#f1e3c3" />
          </mesh>
          <Box p={[0.9, 1.2, -0.2]} s={[0.05, 2.4, 0.05]} c="#5c3a21" />
          {/* The parasol, torn */}
          <mesh position={[0.9, 2.4, -0.2]}>
            <coneGeometry args={[1.3, 0.45, 6, 1, true]} />
            <meshLambertMaterial color="#e03131" side={2} />
          </mesh>
          <Box p={[1.3, 2.32, 0.2]} s={[0.4, 0.05, 0.3]} c="#ffd59a" />
        </group>
      )}
      {mood === 'alloco' && (
        <>
          <group position={[1.2, 0, -0.8]}>
            <Box p={[0, 0.4, 0]} s={[1.2, 0.8, 0.6]} c="#5c3a21" />
            <mesh position={[0, 0.9, 0]}>
              <cylinderGeometry args={[0.35, 0.3, 0.16, 14]} />
              <meshLambertMaterial color="#343a40" />
            </mesh>
            {[-0.15, 0, 0.15].map((x) => (
              <Box key={x} p={[x, 1.0, 0]} s={[0.1, 0.04, 0.2]} c="#f59f00" />
            ))}
          </group>
          <Cat p={[0.2, 0, -0.3]} r={0.6} />
        </>
      )}
    </>
  )
}

/** The quartier's pitch: red earth, stones, two goals of wood, the kids' bags as posts. */
function Terrain({ mood }: P) {
  return (
    <>
      <Outside bg={mood === 'soir' ? '#f59a62' : undefined} />
      <Ground c="#b5703c" />
      {Array.from({ length: 14 }, (_, i) => (
        <Box key={i} p={[((i * 37) % 13) - 6, 0.04, ((i * 23) % 7) - 4]} s={[0.12, 0.08, 0.1]} c="#8a8a8a" />
      ))}
      {[-6, 6].map((x) => (
        <group key={x} position={[x, 0, -1]} rotation={[0, x > 0 ? -Math.PI / 2 : Math.PI / 2, 0]}>
          <Box p={[-1.0, 0.6, 0]} s={[0.1, 1.2, 0.1]} c="#a07850" />
          <Box p={[1.0, 0.6, 0]} s={[0.1, 1.2, 0.1]} c="#a07850" />
          <Box p={[0, 1.2, 0]} s={[2.1, 0.1, 0.1]} c="#a07850" />
        </group>
      ))}
      <Box p={[0, 1.2, -6]} s={[20, 2.4, 0.3]} c="#e8c18a" />
      <mesh position={[0.6, 0.11, 0.6]}>
        <sphereGeometry args={[0.11, 10, 8]} />
        <meshLambertMaterial color="#f8f9fa" />
      </mesh>
    </>
  )
}

/** The Ébrié lagoon: the water, the pirogues on the bank, the far shore's lights. Night: a light dancing on the water. */
function Lagune({ t, mood }: P) {
  const night = mood !== 'jour'
  const lx = Math.sin(t * 0.7) * 2.5
  return (
    <>
      <Outside night={night} bg={night ? '#060a20' : '#9fd3ff'} far={40} />
      <Ground c={night ? '#2a2418' : '#c9a777'} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -14]}>
        <planeGeometry args={[80, 24]} />
        <meshLambertMaterial color={night ? '#0d1a3a' : '#2a7aa8'} />
      </mesh>
      {[-3.2, 2.6].map((x, i) => (
        <group key={x} position={[x, 0.15, -2.6]} rotation={[0, 0.3 * (i ? 1 : -1), 0]}>
          <Box p={[0, 0, 0]} s={[0.7, 0.3, 3.4]} c="#6b4423" />
          <Box p={[0, 0.1, 0]} s={[0.5, 0.2, 3.0]} c="#3d2b1f" />
        </group>
      ))}
      {Array.from({ length: 14 }, (_, i) => (
        <mesh key={i} position={[-18 + i * 2.8, 0.4 + (i % 3) * 0.2, -26]}>
          <boxGeometry args={[0.2, 0.2, 0.05]} />
          <meshBasicMaterial color="#ffd27a" toneMapped={false} />
        </mesh>
      ))}
      {night && mood !== 'calme' && (
        <>
          <mesh position={[lx, 0.6 + Math.sin(t * 2.3) * 0.25, -8]}>
            <sphereGeometry args={[0.25, 14, 10]} />
            <meshBasicMaterial color="#b6f0ff" toneMapped={false} />
          </mesh>
          <pointLight position={[lx, 0.8, -8]} intensity={10} distance={9} color="#7fd8ff" />
        </>
      )}
    </>
  )
}

/** The gare routière: the coaches lined up, their company's colours, the sign, the vendors' boxes. */
function Gare({ mood }: P) {
  return (
    <>
      <Outside />
      <Ground c="#8a8070" />
      {[-4.5, 0, 4.5].map((x, i) => (
        <group key={x} position={[x, 0, -3.6]}>
          <Box p={[0, 1.2, 0]} s={[3.6, 2.2, 1.6]} c={['#f8f9fa', '#ffd43b', '#e7f5ff'][i]} />
          <Box p={[0, 1.55, 0.81]} s={[3.2, 0.6, 0.04]} c="#1c3a5e" />
          <Box p={[0, 0.7, 0.82]} s={[3.6, 0.2, 0.04]} c={['#e03131', '#2f9e44', '#ff7a00'][i]} />
          {[-1.2, 1.2].map((w) => (
            <mesh key={w} position={[w, 0.25, 0.82]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.3, 0.3, 0.2, 12]} />
              <meshLambertMaterial color="#212529" />
            </mesh>
          ))}
        </group>
      ))}
      <Sign p={[0, 3.3, -3.0]} w={5} text={mood === 'accra' ? 'ARRIVÉES · ACCRA' : 'GARE ROUTIÈRE · YAMOUSSOUKRO'} bg="#1f8f88" fg="#fbf5e6" />
      <Box p={[3.6, 0.4, -0.6]} s={[0.8, 0.8, 0.6]} c="#7a5230" />
      <Box p={[3.6, 0.85, -0.6]} s={[0.6, 0.1, 0.4]} c="#ffd43b" />
    </>
  )
}

/** The caimans' lake at Yamoussoukro: the water, its stone rim, the caimans on the bank, the palm trees. */
function Lac({ t, mood }: P) {
  const night = mood === 'nuit'
  return (
    <>
      <Outside night={night} bg={night ? '#0b1030' : '#bfe3ff'} far={40} />
      <Ground c={night ? '#2d3a24' : '#5f9a45'} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, -8]}>
        <planeGeometry args={[40, 10]} />
        <meshLambertMaterial color={night ? '#0f2030' : '#3f7a6a'} />
      </mesh>
      <Box p={[0, 0.15, -2.9]} s={[24, 0.3, 0.4]} c="#a8a29a" />
      <Caiman p={[-2.4, 0, -2.0]} r={0.9} />
      <Caiman p={[1.8, 0, -1.6]} r={-1.2} />
      <Caiman p={[0.2, -0.05, -5.0 + Math.sin(t * 0.4) * 0.2]} r={1.8} />
      {[-6, 6.5].map((x) => (
        <Palm key={x} p={[x, 0, -1.6]} />
      ))}
      {night && <pointLight position={[0, 4, -2]} intensity={5} distance={12} color="#9fb4ff" />}
    </>
  )
}

/** Madame Diomandé's gallery at Cocody: white walls, the toiles of Korhogo hung under their spotlights. */
function Galerie(_: P) {
  return (
    <>
      <Room wall="#f8f6f0" floor="#c8b8a0" />
      {[-3.6, -1.2, 1.2, 3.6].map((x, i) => (
        <group key={x} position={[x, 1.7, -3.08]}>
          <Box p={[0, 0, 0]} s={[1.6, 1.3, 0.04]} c="#e9dcc0" />
          {Array.from({ length: 4 }, (_, j) => (
            <Box key={j} p={[-0.5 + j * 0.33, ((i + j) % 2) * 0.2 - 0.1, 0.03]} s={[0.22, 0.6, 0.01]} c={['#3d2b1f', '#7a5230', '#1a1410'][(i + j) % 3]} />
          ))}
          <pointLight position={[0, 1.1, 0.8]} intensity={2.5} distance={2.6} color="#fff4d6" />
        </group>
      ))}
      <Box p={[0, 0.45, 0.4]} s={[1.8, 0.9, 0.7]} c="#e9ecef" />
    </>
  )
}

/** The port of San-Pédro: the dock's planks, the crates, a fishing boat on the dark water. Night: its lantern, no one aboard. */
function Port({ t, mood }: P) {
  const night = mood !== 'jour'
  return (
    <>
      <Outside night={night} bg={night ? '#071022' : '#a8d8f0'} far={night ? 26 : 40} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.3, -10]}>
        <planeGeometry args={[60, 30]} />
        <meshLambertMaterial color={night ? '#0a1a2a' : '#2a6a8a'} />
      </mesh>
      {Array.from({ length: 9 }, (_, i) => (
        <Box key={i} p={[-4 + i, -0.05, 0]} s={[0.95, 0.1, 6]} c={i % 2 ? '#7a5a3a' : '#6b4f33'} />
      ))}
      {[
        [-3.4, -1],
        [-2.6, -1.6],
        [3.4, 0.6],
      ].map(([x, z], i) => (
        <Box key={i} p={[x, 0.35, z]} s={[0.7, 0.7, 0.7]} c="#8a6a45" />
      ))}
      <group position={[1.6, -0.2 + Math.sin(t * 1.2) * 0.06, -5.5]} rotation={[0, 0.4, Math.sin(t) * 0.03]}>
        <Box p={[0, 0.3, 0]} s={[1.8, 0.7, 5]} c={night ? '#3a4a5a' : '#e9ecef'} />
        <Box p={[0, 1.0, -0.6]} s={[1.2, 0.8, 1.4]} c={night ? '#2a3440' : '#1c7ed6'} />
        <Box p={[0, 2.0, 0.6]} s={[0.08, 2.4, 0.08]} c="#495057" />
        {night && (
          <>
            <mesh position={[0, 1.6, 0.9]}>
              <sphereGeometry args={[0.1, 10, 8]} />
              <meshBasicMaterial color="#ffe8a3" toneMapped={false} />
            </mesh>
            <pointLight position={[0, 1.6, 1.0]} intensity={4 * (0.7 + 0.3 * Math.sin(t * 5))} distance={6} color="#ffe0a0" />
          </>
        )}
      </group>
    </>
  )
}

/** The zoo of Abidjan: Zézé's cage, its bars, the big trees. Mood « vide »: the cage empty, its door shut. */
function Zoo({ t, mood }: P) {
  return (
    <>
      <Outside />
      <Ground c="#6a9a4a" />
      <group position={[0, 0, -2.8]}>
        <Box p={[0, 0.05, 0]} s={[4.4, 0.1, 2.2]} c="#9a8a70" />
        {Array.from({ length: 12 }, (_, i) => (
          <Box key={i} p={[-2.1 + i * 0.38, 1.4, 1.08]} s={[0.05, 2.8, 0.05]} c="#495057" />
        ))}
        <Box p={[0, 2.82, 0]} s={[4.4, 0.08, 2.2]} c="#495057" />
        <Box p={[-2.2, 1.4, 0]} s={[0.05, 2.8, 2.2]} c="#495057" />
        <Box p={[2.2, 1.4, 0]} s={[0.05, 2.8, 2.2]} c="#495057" />
        <Box p={[0.6, 1.0, 1.1]} s={[0.9, 2.0, 0.04]} c="#5c636a" />
        <Box p={[0.95, 1.0, 1.14]} s={[0.12, 0.2, 0.06]} c="#c92a2a" />
        <Box p={[-1.2, 0.9, -0.6]} s={[0.2, 1.8, 0.2]} c="#6b4423" />
        <Box p={[-1.2, 1.6, -0.2]} s={[1.6, 0.08, 0.08]} c="#6b4423" />
        {mood !== 'vide' && <Chimp p={[-1.0, 0.1, 0.2]} t={t} />}
      </group>
      <Sign p={[-3.6, 2.4, -1.5]} w={2.4} text="ZOO D'ABIDJAN" bg="#2f9e44" fg="#fbf5e6" r={0.5} />
      <Tree p={[-5.2, 0, -3.6]} s={1.6} />
      <Tree p={[5.0, 0, -3.8]} s={1.8} c="#23662f" />
      {mood === 'zeze' && <Chimp p={[4.4, 3.0, -3.4]} r={-0.6} t={t} />}
    </>
  )
}

/** The cacao plantation near Daloa: the cacao trees and their pods, the sacks, the pisteur's scale. */
function Plantation({ mood }: P) {
  return (
    <>
      <Outside bg="#e8f0c8" />
      <Ground c="#6b5232" />
      {Array.from({ length: 10 }, (_, i) => {
        const x = -6 + (i % 5) * 3
        const z = -2.5 - Math.floor(i / 5) * 3
        return (
          <group key={i} position={[x, 0, z]}>
            <Box p={[0, 0.9, 0]} s={[0.22, 1.8, 0.22]} c="#5c3a21" />
            <mesh position={[0, 2.2, 0]} castShadow>
              <icosahedronGeometry args={[1.0, 0]} />
              <meshLambertMaterial color={i % 2 ? '#2f7a33' : '#3a8a3e'} flatShading />
            </mesh>
            {[0.6, 1.0, 1.3].map((y, j) => (
              <Box key={j} p={[0.13 * (j % 2 ? 1 : -1), y, 0.12]} s={[0.12, 0.2, 0.12]} c={j % 2 ? '#e8a020' : '#c2410c'} />
            ))}
          </group>
        )
      })}
      {mood === 'balance' && (
        <group position={[1.6, 0, -0.6]}>
          <Box p={[0, 0.4, 0]} s={[1.2, 0.8, 0.8]} c="#7a5230" />
          <Box p={[0, 0.85, 0]} s={[0.6, 0.06, 0.5]} c="#adb5bd" />
          <Box p={[0, 1.1, -0.3]} s={[0.4, 0.4, 0.08]} c="#f1f3f5" />
          <Box p={[0, 1.1, -0.25]} s={[0.04, 0.3, 0.02]} c="#c92a2a" r={0.5} />
        </group>
      )}
      {[
        [-1.8, -0.6],
        [-1.2, -0.9],
        [-1.5, -1.4],
      ].map(([x, z], i) => (
        <Box key={i} p={[x, 0.35, z]} s={[0.55, 0.7, 0.45]} c="#c9a777" />
      ))}
    </>
  )
}

/** A salon: the sofa, the TV on its cabinet, a photo on the wall (mood « chat »: Grigri asleep on the TV; « 1978 »: the old race photo). */
function Salon({ mood }: P) {
  const night = mood === 'nuit'
  return (
    <>
      <Room wall={night ? '#4d4260' : '#e9d8b4'} floor="#9a7a5a" dim={night} />
      <Box p={[-2.2, 0.35, -2.4]} s={[2.4, 0.7, 0.9]} c="#7a2e1d" />
      <Box p={[-2.2, 0.85, -2.8]} s={[2.4, 0.6, 0.2]} c="#7a2e1d" />
      <Box p={[2.0, 0.35, -2.7]} s={[1.6, 0.7, 0.5]} c="#5c3a21" />
      <Box p={[2.0, 1.1, -2.75]} s={[1.3, 0.8, 0.1]} c="#212529" />
      <Box p={[2.0, 1.1, -2.69]} s={[1.2, 0.7, 0.02]} c={night ? '#4dabf7' : '#343a40'} glow={night ? 0.4 : 0} />
      {mood === 'chat' && <Cat p={[2.0, 1.5, -2.75]} r={0.3} s={0.9} />}
      <Box p={[0, 2.1, -3.08]} s={[0.9, 0.65, 0.04]} c="#c9a55a" />
      <Box p={[0, 2.1, -3.05]} s={[0.78, 0.53, 0.02]} c={mood === '1978' ? '#d8c8a0' : '#e9e2d0'} />
      {mood === '1978' && <Box p={[0, 2.05, -3.03]} s={[0.12, 0.3, 0.01]} c="#3d2b1f" />}
      {night && <pointLight position={[2.0, 1.2, -1.8]} intensity={4} distance={5} color="#74c0fc" />}
    </>
  )
}

/** The kitchen of the cour: the fire of three stones, the pots, the mortar and its pestle, the smoke. */
function Cuisine({ t }: P) {
  return (
    <>
      <Outside bg="#ffe0b0" />
      <Ground c="#a8845a" />
      <Box p={[0, 1.3, -3.4]} s={[10, 2.6, 0.3]} c="#d8b080" />
      <Box p={[0, 2.7, -2.6]} s={[10, 0.08, 2.2]} r={0.1} c="#7d8592" />
      <group position={[-0.6, 0, -1.6]}>
        {[0, 2.1, 4.2].map((a) => (
          <Box key={a} p={[Math.sin(a) * 0.3, 0.12, Math.cos(a) * 0.3]} s={[0.22, 0.24, 0.22]} c="#5a5a5a" />
        ))}
        <mesh position={[0, 0.12, 0]}>
          <boxGeometry args={[0.3, 0.06, 0.3]} />
          <meshBasicMaterial color="#ff6b1a" toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.48, 0]} castShadow>
          <cylinderGeometry args={[0.42, 0.34, 0.5, 14]} />
          <meshLambertMaterial color="#343a40" />
        </mesh>
        <mesh position={[0, 0.74, 0]}>
          <cylinderGeometry args={[0.38, 0.38, 0.03, 14]} />
          <meshLambertMaterial color="#c2410c" />
        </mesh>
        {[0, 1, 2].map((k) => {
          const a = (t * 0.6 + k / 3) % 1
          return (
            <mesh key={k} position={[Math.sin(k + t) * 0.1, 0.9 + a * 1.6, 0]}>
              <sphereGeometry args={[0.12 + a * 0.18, 8, 6]} />
              <meshBasicMaterial color="#e9ecef" transparent opacity={0.5 * (1 - a)} />
            </mesh>
          )
        })}
        <pointLight position={[0, 0.3, 0.3]} intensity={3} distance={3} color="#ff8a3d" />
      </group>
      <group position={[1.8, 0, -1.8]}>
        <mesh position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.26, 0.2, 0.6, 12]} />
          <meshLambertMaterial color="#7a5230" />
        </mesh>
        <Box p={[0, 0.9, 0]} s={[0.07, 1.2, 0.07]} c="#a07850" r={0.2} />
      </group>
    </>
  )
}

/** The games room: dark, the consoles' screens glowing, the benches, the sign. */
function SalleJeux({ t }: P) {
  return (
    <>
      <color attach="background" args={['#0a0820']} />
      <hemisphereLight args={['#5a4ad8', '#100a20', 0.5]} />
      <ambientLight intensity={0.25} />
      <Ground c="#2a2440" size={16} />
      <Box p={[0, 1.6, -3.2]} s={[12, 3.2, 0.2]} c="#1e1a3a" />
      {[-3, 0, 3].map((x, i) => (
        <group key={x} position={[x, 0, -2.9]}>
          <Box p={[0, 1.3, 0]} s={[2.0, 1.2, 0.1]} c="#111" />
          <Box p={[0, 1.3, 0.06]} s={[1.85, 1.05, 0.02]} c={['#2f9e44', '#1c7ed6', '#2f9e44'][i]} glow={0.5 + 0.2 * Math.sin(t * 6 + i)} />
          <pointLight position={[0, 1.3, 1]} intensity={3} distance={4} color={i === 1 ? '#4dabf7' : '#51cf66'} />
          <Box p={[0, 0.25, 1.6]} s={[1.8, 0.5, 0.5]} c="#3a2a6a" />
        </group>
      ))}
      <Sign p={[0, 2.75, -3.05]} w={3.2} text="SALLE DE JEUX" bg="#7048e8" fg="#fbf5e6" />
    </>
  )
}

/** The stadium of Bouaké: the red track and its lanes, the stand behind, the finishing line. */
function Stade({ mood }: P) {
  return (
    <>
      <Outside bg={mood === 'soir' ? '#f59a62' : '#bfe3ff'} />
      <Ground c="#3f8a3a" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -0.2]}>
        <planeGeometry args={[30, 3.6]} />
        <meshLambertMaterial color="#c2410c" />
      </mesh>
      {[-1.6, -0.8, 0, 0.8, 1.6].map((z) => (
        <Box key={z} p={[0, 0.02, z - 0.2]} s={[30, 0.01, 0.04]} c="#f8f9fa" />
      ))}
      <Box p={[2.5, 0.025, -0.2]} s={[0.2, 0.01, 3.6]} c="#f8f9fa" />
      {[0, 1, 2, 3].map((k) => (
        <Box key={k} p={[0, 0.4 + k * 0.5, -4 - k * 0.7]} s={[30, 0.5, 0.7]} c={k % 2 ? '#ff7a00' : '#f8f9fa'} />
      ))}
    </>
  )
}

/** The airport's arrivals: big windows on the runway, the sign, the luggage belt, the waiting crowd's barrier. */
function Aeroport({ t }: P) {
  return (
    <>
      <Room wall="#dfe6ee" floor="#c8ccd2" />
      {[-3.6, -1.2, 1.2, 3.6].map((x) => (
        <Box key={x} p={[x, 1.7, -3.08]} s={[2.2, 2.2, 0.04]} c="#9fd3ff" />
      ))}
      <Sign p={[0, 2.95, -3.0]} w={3.4} text="ARRIVÉES · ARRIVALS" bg="#ff7a00" fg="#fbf5e6" />
      <Box p={[-3.2, 0.35, -1.8]} s={[2.6, 0.7, 0.8]} c="#495057" />
      {[0, 1, 2].map((k) => (
        <Box key={k} p={[-4.2 + ((t * 0.5 + k * 0.8) % 2.4), 0.85, -1.8]} s={[0.5, 0.35, 0.3]} c={['#c92a2a', '#1c7ed6', '#2f9e44'][k]} />
      ))}
      <Box p={[1.5, 0.5, -0.3]} s={[5, 0.06, 0.06]} c="#adb5bd" />
      {[-1, 1.5, 4].map((x) => (
        <Box key={x} p={[x, 0.25, -0.3]} s={[0.06, 0.5, 0.06]} c="#adb5bd" />
      ))}
      {/* A plane passing behind the windows */}
      <group position={[-8 + ((t * 2) % 16), 1.9, -5]}>
        <Box p={[0, 0, 0]} s={[2.4, 0.4, 0.4]} c="#f8f9fa" />
        <Box p={[0, 0, 0]} s={[0.5, 0.06, 1.8]} c="#ff7a00" />
      </group>
    </>
  )
}

/** The commissariat: the counter, the flag's colours, the bench, the sign, the fan. */
function Commissariat({ t }: P) {
  return (
    <>
      <Room wall="#cfe0d0" floor="#9a9a8a" />
      <Box p={[0, 0.55, -2.2]} s={[4, 1.1, 0.7]} c="#6b4423" />
      <Box p={[0, 1.13, -2.2]} s={[4.1, 0.06, 0.8]} c="#5c3a21" />
      <group position={[-3.4, 1.9, -3.08]}>
        <Box p={[-0.33, 0, 0]} s={[0.33, 0.66, 0.02]} c="#f07a12" />
        <Box p={[0, 0, 0]} s={[0.33, 0.66, 0.02]} c="#fbf5e6" />
        <Box p={[0.33, 0, 0]} s={[0.33, 0.66, 0.02]} c="#0b6b3d" />
      </group>
      <Sign p={[1.2, 2.5, -3.05]} w={3} text="COMMISSARIAT" bg="#1c3a5e" fg="#fbf5e6" />
      <Box p={[3.8, 0.25, -0.4]} s={[0.5, 0.5, 2.2]} c="#7a5230" />
      <group position={[0, 3.0, -1]} rotation={[0, t * 4, 0]}>
        <Box p={[0, 0, 0]} s={[1.4, 0.03, 0.18]} c="#495057" />
        <Box p={[0, 0, 0]} s={[0.18, 0.03, 1.4]} c="#495057" />
      </group>
    </>
  )
}

/** A classroom: the blackboard (the bac's countdown on it), the desks in rows. */
function Ecole(_: P) {
  return (
    <>
      <Room wall="#f1e3c3" floor="#a8845a" />
      <Box p={[0, 1.7, -3.08]} s={[4.4, 1.6, 0.04]} c="#26332c" />
      <Sign p={[0, 1.75, -3.04]} w={3.4} text="BAC : J-7" bg="#26332c" fg="#f1eee4" />
      {[-2.4, 0, 2.4].map((x) =>
        [-1.2, 0.4].map((z) => (
          <group key={`${x}${z}`} position={[x, 0, z]}>
            <Box p={[0, 0.72, 0]} s={[1.2, 0.06, 0.6]} c="#7a5230" />
            <Box p={[0, 0.36, 0]} s={[1.1, 0.72, 0.06]} c="#5c3a21" />
          </group>
        )),
      )}
    </>
  )
}

export const SETS2: Record<string, (p: P) => React.ReactElement> = {
  marche: Marche,
  terrain: Terrain,
  lagune: Lagune,
  gare: Gare,
  lac: Lac,
  galerie: Galerie,
  port: Port,
  zoo: Zoo,
  plantation: Plantation,
  salon: Salon,
  cuisine: Cuisine,
  sallejeux: SalleJeux,
  stade: Stade,
  aeroport: Aeroport,
  commissariat: Commissariat,
  ecole: Ecole,
}
