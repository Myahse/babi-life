import { useMemo } from 'react'
import { Box, Sign, TableSet } from '../../world3d/props'

// The prologues' sets (types.ts Shot.set), drawn at t seconds into their shot: the place, its light,
// what moves in it (a bulb flickering, dust on a roof); never the cast nor the camera (Shot3D). Each
// takes a mood (« nuit », « rouge »…). The cast stands around x -3…3, z -1…1.5, the walls behind at z -3…-4.

export function Bulbs({ from, to, n = 12, colors = ['#ffd43b'], sag = 0.35 }: { from: [number, number, number]; to: [number, number, number]; n?: number; colors?: string[]; sag?: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const k = i / (n - 1)
        const p: [number, number, number] = [from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k - Math.sin(k * Math.PI) * sag, from[2] + (to[2] - from[2]) * k]
        return (
          <mesh key={i} position={p}>
            <sphereGeometry args={[0.07, 8, 6]} />
            <meshBasicMaterial color={colors[i % colors.length]} toneMapped={false} />
          </mesh>
        )
      })}
    </>
  )
}

function Ground({ c, size = 40 }: { c: string; size?: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[size, size]} />
      <meshLambertMaterial color={c} />
    </mesh>
  )
}

/** A mango tree: its trunk and its round dark leaves. */
function Mango({ p, s = 1 }: { p: [number, number, number]; s?: number }) {
  const blobs: [number, number, number, number][] = [
    [0, 3.1, 0, 1.4],
    [1.0, 2.8, 0.3, 1.0],
    [-1.0, 2.9, -0.2, 1.1],
    [0.3, 3.7, -0.4, 1.0],
    [-0.4, 2.6, 0.8, 0.9],
  ]
  return (
    <group position={p} scale={s}>
      <Box p={[0, 1.2, 0]} s={[0.4, 2.4, 0.4]} c="#6b4423" />
      {blobs.map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} castShadow>
          <icosahedronGeometry args={[r, 0]} />
          <meshLambertMaterial color={i % 2 ? '#2b7a3a' : '#23662f'} flatShading />
        </mesh>
      ))}
    </group>
  )
}

/** The city far behind, its windows lit. */
function Skyline({ z = -16, lit = 1, c = ['#4b3463', '#3c2a55'] }: { z?: number; lit?: number; c?: [string, string] }) {
  const blocks = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        x: -18 + i * 2.4 + ((i * 7) % 3) * 0.3,
        h: 3 + ((i * 37) % 9),
        w: 1.6 + ((i * 13) % 4) * 0.3,
      })),
    [],
  )
  return (
    <group position={[0, 0, z]}>
      {blocks.map((b, i) => (
        <group key={i}>
          <Box p={[b.x, b.h / 2 - 2, 0]} s={[b.w, b.h, 1.5]} c={i % 3 ? c[0] : c[1]} />
          {lit > 0 &&
            Array.from({ length: Math.floor(b.h / 1.1) }, (_, j) =>
              (i * 3 + j * 5) % 4 !== 0 ? (
                <mesh key={j} position={[b.x + (j % 2 ? 0.35 : -0.35), j * 1.1 - 1.2, 0.76]}>
                  <planeGeometry args={[0.35, 0.4]} />
                  <meshBasicMaterial color="#ffd27a" transparent opacity={lit * (0.5 + ((i + j) % 3) * 0.25)} toneMapped={false} />
                </mesh>
              ) : null,
            )}
        </group>
      ))}
    </group>
  )
}

/** The sky and its light, by the hour: day, evening, night. */
function Sky({ mood, far }: { mood: 'jour' | 'soir' | 'nuit' | 'aube'; far?: number }) {
  const s = {
    jour: {
      bg: '#ffcf8a',
      fog: '#ffd59a',
      hemi: ['#fff1d6', '#a0703a', 1.2],
      sun: ['#ffd8a0', 2.4],
    },
    aube: {
      bg: '#f7b38a',
      fog: '#f5bf9a',
      hemi: ['#ffe2c8', '#8a6a5a', 1.0],
      sun: ['#ffc59a', 1.8],
    },
    soir: {
      bg: '#f59a62',
      fog: '#f2a070',
      hemi: ['#ffd9b0', '#8a4b6b', 1.0],
      sun: ['#ffb070', 2.0],
    },
    nuit: {
      bg: '#070b24',
      fog: '#070b24',
      hemi: ['#4a5a9a', '#1a1410', 0.55],
      sun: ['#9fb4ff', 0.8],
    },
  }[mood]
  return (
    <>
      <color attach="background" args={[s.bg]} />
      <fog attach="fog" args={[s.fog, mood === 'nuit' ? 7 : 12, far ?? (mood === 'nuit' ? 22 : 32)]} />
      <hemisphereLight args={[s.hemi[0] as string, s.hemi[1] as string, s.hemi[2] as number]} />
      <directionalLight position={[5, 7, 4]} intensity={s.sun[1] as number} color={s.sun[0] as string} castShadow shadow-mapSize={[1024, 1024]} />
      <ambientLight intensity={mood === 'nuit' ? 0.25 : 0.35} />
      {mood === 'nuit' && (
        <mesh position={[-7, 9, -18]}>
          <circleGeometry args={[1.4, 32]} />
          <meshBasicMaterial color="#e7ecff" toneMapped={false} />
        </mesh>
      )}
    </>
  )
}

/** The grin under the mango tree: the bench, the brazier, the teapot, the little glasses. */
function Grin({ t, mood }: { t: number; mood: string }) {
  const glow = 0.7 + 0.3 * Math.sin(t * 9)
  const m = mood === 'nuit' ? 'nuit' : mood === 'soir' ? 'soir' : mood === 'aube' ? 'aube' : 'jour'
  return (
    <>
      <Sky mood={m} />
      <Ground c={m === 'nuit' ? '#3d3326' : '#d6ad74'} />
      <Box p={[0, 1.2, -4]} s={[16, 2.4, 0.3]} c="#e8c18a" />
      <Box p={[2.6, 1.0, -3.84]} s={[1.6, 2.0, 0.06]} c="#1971c2" />
      <Box p={[0, 2.45, -4]} s={[16, 0.12, 0.45]} c="#c99a5e" />
      <Mango p={[-2.2, 0, -1.6]} s={1.15} />
      <Box p={[0.2, 0.44, -0.9]} s={[2.4, 0.08, 0.45]} c="#8b5a2b" />
      {[-0.85, 1.25].map((x) => (
        <Box key={x} p={[x, 0.2, -0.9]} s={[0.08, 0.4, 0.4]} c="#6b4423" />
      ))}
      <Box p={[0.5, 0.14, 0.15]} s={[0.36, 0.28, 0.36]} c="#343a40" />
      <mesh position={[0.5, 0.3, 0.15]}>
        <boxGeometry args={[0.3, 0.04, 0.3]} />
        <meshBasicMaterial color="#ff6b1a" transparent opacity={glow} toneMapped={false} />
      </mesh>
      <mesh position={[0.5, 0.44, 0.15]} castShadow>
        <cylinderGeometry args={[0.1, 0.13, 0.22, 10]} />
        <meshLambertMaterial color="#1c7ed6" />
      </mesh>
      <Box p={[-0.35, 0.08, 0.25]} s={[0.5, 0.04, 0.3]} c="#adb5bd" />
      {[-0.5, -0.35, -0.2].map((x) => (
        <mesh key={x} position={[x, 0.15, 0.25]}>
          <cylinderGeometry args={[0.03, 0.025, 0.09, 8]} />
          <meshLambertMaterial color="#ffe8a3" transparent opacity={0.85} />
        </mesh>
      ))}
      {m === 'nuit' && <pointLight position={[0.5, 0.6, 0.3]} intensity={4 * glow} distance={4} color="#ff8a3d" />}
    </>
  )
}

/** The cour commune: three rooms in a row, their tin roof, the mango tree. Night: the bulb flickers, the
 * empty room glows pale, steps on the roof (mood « pas »: the dust jumping, one step after another). */
function Cour({ t, mood }: { t: number; mood: string }) {
  const night = mood !== 'jour'
  const flicker = !night ? 1 : Math.sin(t * 23) > 0.3 || Math.sin(t * 7.3) > 0.85 ? 0.25 : 1
  const ghost = 0.35 + 0.35 * Math.sin(t * 2.3)
  const step = Math.floor((t - 0.8) / 0.32)
  return (
    <>
      <Sky mood={night ? 'nuit' : 'jour'} />
      <Ground c={night ? '#3d3326' : '#c9a777'} />
      {[-2.8, 0, 2.8].map((x, i) => (
        <group key={x} position={[x, 0, -3]}>
          <Box p={[0, 1.2, 0]} s={[2.7, 2.4, 1.6]} c={i === 2 ? (night ? '#8a7a66' : '#d8c3a0') : night ? '#9c8b74' : '#e6d2ae'} />
          <Box p={[-0.4, 0.95, 0.81]} s={[0.8, 1.9, 0.04]} c={i === 2 && night ? '#0a0a12' : i === 1 ? '#1c7ed6' : '#4a3426'} />
          <Box p={[0.75, 1.4, 0.81]} s={[0.55, 0.5, 0.04]} c={i === 2 && night ? '#0a0a12' : '#2b2f3a'} />
          <Box p={[0, 2.5, 0.15]} s={[2.9, 0.08, 2.1]} r={0.12} c="#7d8592" />
        </group>
      ))}
      {/* A wash line, a bucket, the shared tap (by day: life) */}
      {!night && (
        <>
          <Box p={[-1.4, 1.75, -1.6]} s={[3.2, 0.02, 0.02]} c="#495057" />
          {[-2.6, -2.0, -1.2, -0.5].map((x, i) => (
            <Box key={x} p={[x, 1.5, -1.6]} s={[0.45, 0.5, 0.02]} c={['#ff7a00', '#1c7ed6', '#ffd43b', '#e64980'][i]} />
          ))}
          <Box p={[3.6, 0.2, -1.2]} s={[0.4, 0.4, 0.4]} c="#1971c2" />
        </>
      )}
      {night && (
        <>
          <mesh position={[2.4, 0.95, -2.17]}>
            <planeGeometry args={[0.7, 1.8]} />
            <meshBasicMaterial color="#bcd0ff" transparent opacity={0.25 + ghost * 0.6} toneMapped={false} />
          </mesh>
          <mesh position={[0.6, 2.25, -2.1]}>
            <sphereGeometry args={[0.1, 10, 8]} />
            <meshBasicMaterial color={flicker > 0.5 ? '#fff3bf' : '#5c5a40'} toneMapped={false} />
          </mesh>
          <pointLight position={[0.6, 2.1, -1.9]} intensity={6 * flicker} distance={7} color="#ffe8a3" />
          <directionalLight position={[1, 3, 8]} intensity={1.0} color="#a9b8ff" />
        </>
      )}
      {mood === 'pas' &&
        t > 0.8 &&
        Array.from({ length: Math.min(8, step + 1) }, (_, k) => {
          const age = t - 0.8 - k * 0.32
          return (
            <mesh key={k} position={[-3.8 + k * 1.0, 2.62 + age * 0.4, -2.9]}>
              <boxGeometry args={[0.18, 0.06, 0.18]} />
              <meshBasicMaterial color="#cfd4dc" transparent opacity={Math.max(0, 0.9 - age * 1.2)} />
            </mesh>
          )
        })}
      <Mango p={[-4.6, 0, -0.6]} s={1.1} />
    </>
  )
}

/** A maquis at night: its wall, its sign, its bulbs, its tables. Mood « rouge »: the cursed one. */
function Maquis({ t, mood }: { t: number; mood: string }) {
  const red = mood === 'rouge'
  const pulse = 0.75 + 0.25 * Math.sin(t * 3)
  return (
    <>
      <color attach="background" args={[red ? '#240606' : '#160f33']} />
      <fog attach="fog" args={[red ? '#2e0909' : '#160f33', 7, 24]} />
      <hemisphereLight args={[red ? '#ff8a7a' : '#7a6ad8', '#2a1a10', red ? 0.6 : 0.7]} />
      <pointLight position={[0, 3, 1.5]} intensity={red ? 16 * pulse : 18} distance={12} color={red ? '#ff4d3d' : '#ffcf87'} castShadow />
      <ambientLight intensity={0.3} />
      <Ground c={red ? '#4a2a22' : '#5d5249'} />
      <Box p={[0, 1.6, -3.5]} s={[12, 3.2, 0.3]} c={red ? '#7a2e1d' : '#e8590c'} />
      <Box p={[0, 0.5, -3.33]} s={[12, 1, 0.04]} c={red ? '#3a1610' : '#1c7ed6'} />
      <Sign p={[0, 2.5, -3.3]} w={4.2} text={red || mood === 'bintou' ? 'CHEZ TANTIE BINTOU' : 'MAQUIS LE BON COIN'} bg={red ? '#c92a2a' : '#ffd43b'} fg={red ? '#fff3bf' : '#161a2b'} />
      {!red && <Bulbs from={[-5, 3.1, -3.2]} to={[5, 3.1, -3.2]} n={18} colors={['#ff6b6b', '#ffd43b', '#69db7c', '#74c0fc']} />}
      <TableSet p={[-3.2, 0, -1.6]} c={red ? '#e8590c' : '#e03131'} />
      <TableSet p={[3.4, 0, -1.4]} c={red ? '#e8590c' : '#1c7ed6'} />
      {[
        [-3.3, -1.6],
        [-3.0, -1.5],
        [3.3, -1.3],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.92, z]}>
          <cylinderGeometry args={[0.05, 0.05, 0.28, 8]} />
          <meshLambertMaterial color="#2b8a3e" />
        </mesh>
      ))}
    </>
  )
}

/** The rooftop over the city, at sunset or at night. */
function Terrasse({ mood }: { mood: string }) {
  const night = mood === 'nuit'
  return (
    <>
      <color attach="background" args={[night ? '#3b2a6b' : '#f59a62']} />
      <fog attach="fog" args={[night ? '#3b2a6b' : '#f2a070', 14, 34]} />
      <hemisphereLight args={[night ? '#b9a6ff' : '#ffd9b0', '#8a4b6b', 1.0]} />
      <directionalLight position={[-6, 4, 3]} intensity={night ? 1.4 : 2.2} color={night ? '#ffd8a8' : '#ffb070'} castShadow />
      <ambientLight intensity={0.35} />
      {!night && (
        <mesh position={[-9, 2.2, -24]}>
          <circleGeometry args={[2.6, 32]} />
          <meshBasicMaterial color="#fff1b8" toneMapped={false} />
        </mesh>
      )}
      <Skyline lit={night ? 1 : 0.7} />
      {Array.from({ length: 10 }, (_, i) => Array.from({ length: 6 }, (_, j) => <Box key={`${i}-${j}`} p={[-4.5 + i, -0.05, -2 + j]} s={[0.98, 0.1, 0.98]} c={(i + j) % 2 ? '#e6cfae' : '#d8bb94'} />))}
      <Box p={[0, 0.5, -2.6]} s={[10, 1, 0.25]} c="#f3e3c3" />
      <Bulbs from={[-4.5, 2.6, -2.4]} to={[4.5, 2.6, -2.4]} n={16} colors={['#ffd43b', '#ff922b', '#ffe066']} />
    </>
  )
}

/** A plane over the clouds. */
function Ciel({ t }: { t: number }) {
  const x = -6 + t * 2.2
  return (
    <>
      <color attach="background" args={['#6cc0ff']} />
      <hemisphereLight args={['#ffffff', '#6aa0d8', 1.3]} />
      <directionalLight position={[3, 6, 5]} intensity={1.4} />
      {Array.from({ length: 9 }, (_, i) => (
        <group key={i} position={[((i * 5.3 - t * 0.8) % 30) - 12, -3 + (i % 3) * 0.6, -4 - (i % 4) * 2]}>
          {[0, 0.9, -0.8, 0.3].map((dx, j) => (
            <mesh key={j} position={[dx, (j % 2) * 0.4, 0]}>
              <icosahedronGeometry args={[0.9 - j * 0.12, 0]} />
              <meshLambertMaterial color="#ffffff" flatShading />
            </mesh>
          ))}
        </group>
      ))}
      <group position={[x, -2.2 + Math.sin(t) * 0.15, 0]} rotation={[0, Math.PI / 2, 0.05]} scale={0.8}>
        <Box p={[0, 0, 0]} s={[0.7, 0.7, 3.4]} c="#f8f9fa" />
        <Box p={[0, 0, 1.85]} s={[0.5, 0.5, 0.4]} c="#f8f9fa" />
        <Box p={[0, 0.05, 0.1]} s={[4.2, 0.1, 0.8]} c="#ff7a00" />
        <Box p={[0, 0.6, -1.5]} s={[0.1, 0.9, 0.6]} c="#00b86b" />
        <Box p={[0, 0.1, -1.5]} s={[1.6, 0.08, 0.5]} c="#ff7a00" />
      </group>
    </>
  )
}

/** A bedroom at night: the bed, the lamp, a photo on the wall, the window on the dark. */
function Chambre({ mood }: { mood: string }) {
  const night = mood !== 'jour'
  return (
    <>
      <color attach="background" args={[night ? '#0b0d1e' : '#f3e3c3']} />
      <hemisphereLight args={[night ? '#5a5a8a' : '#fff4e6', '#2a1a10', night ? 0.45 : 1.1]} />
      <ambientLight intensity={night ? 0.2 : 0.4} />
      {night ? <pointLight position={[1.6, 1.4, -1.6]} intensity={9} distance={6} color="#ffc078" castShadow /> : <directionalLight position={[3, 5, 4]} intensity={1.6} />}
      <Ground c="#8a6a4a" size={12} />
      <Box p={[0, 1.5, -3]} s={[9, 3, 0.2]} c={night ? '#5a4d6a' : '#e9d8b4'} />
      <Box p={[-4.5, 1.5, 0]} s={[0.2, 3, 6]} c={night ? '#4d4260' : '#dcc9a3'} />
      {/* The window, its night */}
      <Box p={[-1.8, 1.8, -2.88]} s={[1.2, 1.0, 0.04]} c={night ? '#0d1640' : '#9fd3ff'} />
      <Box p={[-1.8, 1.8, -2.86]} s={[0.05, 1.0, 0.04]} c="#6b4423" />
      {/* The bed */}
      <Box p={[-2.6, 0.3, -1.6]} s={[1.6, 0.4, 2.2]} c="#6b4423" />
      <Box p={[-2.6, 0.56, -1.6]} s={[1.5, 0.14, 2.1]} c="#e8eef7" />
      <Box p={[-2.6, 0.7, -2.45]} s={[1.2, 0.18, 0.4]} c="#ffffff" />
      {/* The little table, the lamp */}
      <Box p={[1.6, 0.35, -2.4]} s={[0.6, 0.7, 0.5]} c="#7a5230" />
      <mesh position={[1.6, 0.95, -2.4]}>
        <coneGeometry args={[0.22, 0.3, 12, 1, true]} />
        <meshBasicMaterial color="#ffd8a0" toneMapped={false} side={2} />
      </mesh>
      {/* A framed photo, an old radio */}
      <Box p={[0.4, 1.9, -2.88]} s={[0.6, 0.45, 0.04]} c="#c9a55a" />
      <Box p={[0.4, 1.9, -2.86]} s={[0.5, 0.35, 0.02]} c="#e9e2d0" />
      <Box p={[1.45, 0.82, -2.35]} s={[0.3, 0.18, 0.12]} c="#343a40" />
    </>
  )
}

/** The Dent de Man: the green hills of the west, the tooth of rock standing over them, the path up. */
function Montagne({ mood }: { mood: string }) {
  const dawn = mood === 'aube'
  return (
    <>
      <Sky mood={dawn ? 'aube' : 'jour'} far={75} />
      <Ground c="#4f8a3a" size={120} />
      {/* The hills, layered, bluer as they go */}
      {[
        [-14, -26, 9, '#3f7a3a'],
        [6, -30, 11, '#4a8a52'],
        [20, -24, 8, '#3a6e42'],
        [-4, -18, 6, '#2f6b33'],
      ].map(([x, z, r, c], i) => (
        <mesh key={i} position={[x as number, -(r as number) * 0.35, z as number]}>
          <sphereGeometry args={[r as number, 12, 8]} />
          <meshLambertMaterial color={c as string} flatShading />
        </mesh>
      ))}
      {/* The tooth */}
      <group position={[2, 0, -22]}>
        <mesh position={[0, 6, 0]} castShadow>
          <cylinderGeometry args={[1.6, 4.2, 12, 7]} />
          <meshLambertMaterial color="#6b6f76" flatShading />
        </mesh>
        <mesh position={[0.4, 12.8, 0]}>
          <coneGeometry args={[1.7, 2.2, 7]} />
          <meshLambertMaterial color="#5c6066" flatShading />
        </mesh>
        <mesh position={[0, 3, 0]}>
          <cylinderGeometry args={[4.4, 6, 6, 8]} />
          <meshLambertMaterial color="#2f6b33" flatShading />
        </mesh>
      </group>
      {/* The path, the rocks, a sign */}
      {Array.from({ length: 9 }, (_, i) => (
        <Box key={i} p={[Math.sin(i * 0.7) * 1.2, 0.02, 1 - i * 1.6]} s={[1.1, 0.04, 1.4]} c="#b08a5a" />
      ))}
      {[
        [-2.6, -1, 0.6],
        [2.8, -2.4, 0.8],
        [-3.6, -5, 1],
      ].map(([x, z, s], i) => (
        <mesh key={i} position={[x, (s as number) * 0.4, z]}>
          <dodecahedronGeometry args={[s as number, 0]} />
          <meshLambertMaterial color="#7d8288" flatShading />
        </mesh>
      ))}
      <group position={[2.2, 0, 0.2]}>
        <Box p={[0, 0.7, 0]} s={[0.08, 1.4, 0.08]} c="#6b4423" />
        <Box p={[0, 1.35, 0]} s={[0.9, 0.35, 0.04]} c="#f1e3c3" />
      </group>
    </>
  )
}

/** A street of the quartier: low houses, a kiosk, the gutter. */
function Rue({ mood }: { mood: string }) {
  const m = mood === 'nuit' ? 'nuit' : mood === 'soir' ? 'soir' : 'jour'
  return (
    <>
      <Sky mood={m} />
      <Ground c={m === 'nuit' ? '#2b2a2e' : '#a89a86'} />
      {[-6, -3, 0, 3, 6].map((x, i) => (
        <group key={x} position={[x, 0, -3.6]}>
          <Box p={[0, 1.3, 0]} s={[2.9, 2.6, 1.6]} c={['#e9c46a', '#f4a261', '#90be6d', '#e76f51', '#a8dadc'][i]} />
          <Box p={[0, 0.9, 0.81]} s={[0.8, 1.8, 0.04]} c="#3d2b1f" />
          <Box p={[0, 2.68, 0.1]} s={[3.0, 0.1, 1.9]} c="#7d8592" />
        </group>
      ))}
      <group position={[3.4, 0, -1.4]}>
        <Box p={[0, 0.9, 0]} s={[1.4, 1.8, 1.0]} c="#ff7a00" />
        <Box p={[0, 1.95, 0.1]} s={[1.6, 0.12, 1.3]} c="#c92a2a" />
      </group>
      <Box p={[0, 0.02, -2.5]} s={[16, 0.04, 0.35]} c="#4a4a4a" />
      {m === 'nuit' && <pointLight position={[0, 3, 0]} intensity={8} distance={10} color="#ffd8a0" />}
    </>
  )
}

export const SETS: Record<string, (p: { t: number; mood: string }) => React.ReactElement> = {
  grin: Grin,
  cour: Cour,
  maquis: Maquis,
  terrasse: Terrasse,
  ciel: Ciel,
  chambre: Chambre,
  montagne: Montagne,
  rue: Rue,
}
