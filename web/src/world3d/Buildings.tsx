import { Box, Lamp, Mat, Palm, Sign, TableSet, Tree, Vehicle } from './props'

// One low-poly building per kind of place. Local space: the lot is 14×14
// centred on the origin and the front (door) faces +Z, towards the street.

type Props = { name: string; night: boolean }

const PASTELS = ['#f6d7a7', '#f4b6a6', '#b8e0d2', '#d6c2f0', '#fbe39b', '#a9d6f5']
const pick = (s: string, list: string[]) => list[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % list.length]

function Windows({ w, h, y0, z, floors, cols, night, color = '#7fc8f8' }: { w: number; h: number; y0: number; z: number; floors: number; cols: number; night: boolean; color?: string }) {
  return (
    <>
      {[...Array(floors)].flatMap((_, f) =>
        [...Array(cols)].map((_, c) => {
          const lit = night && (f * 3 + c * 7) % 5 < 3
          return <Box key={`${f}-${c}`} p={[-w / 2 + (c + 0.5) * (w / cols), y0 + f * h, z]} s={[(w / cols) * 0.55, h * 0.5, 0.08]} c={lit ? '#ffd166' : color} glow={lit ? 1.2 : 0} />
        }),
      )}
    </>
  )
}

function House({ name, night }: Props) {
  const wall = pick(name + 'w', PASTELS)
  return (
    <group>
      {/* Compound wall with a gate, typical of Abidjan courtyards */}
      <Box p={[-4.5, 0.6, 5.5]} s={[4, 1.2, 0.3]} c="#e9ddc7" />
      <Box p={[4.5, 0.6, 5.5]} s={[4, 1.2, 0.3]} c="#e9ddc7" />
      <Box p={[0, 0.9, 5.5]} s={[4.6, 1.8, 0.15]} c="#2b8a3e" />
      <Box p={[0, 2, -1]} s={[8, 4, 6.5]} c={wall} />
      <mesh position={[0, 5.2, -1]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[6.4, 2.6, 4]} />
        <Mat color="#c2502c" />
      </mesh>
      <Box p={[0, 1.2, 2.3]} s={[1.4, 2.4, 0.1]} c="#7a4b2a" />
      <Windows w={8} h={1} y0={2.4} z={2.3} floors={1} cols={3} night={night} />
      <Tree p={[4.8, 0, 2.5]} s={0.9} />
      <Box p={[-4.4, 0.08, 2.6]} s={[2.5, 0.16, 2.5]} c="#c9b28a" />
    </group>
  )
}

function Maquis({ name, night }: Props) {
  return (
    <group>
      <Box p={[0, 1.75, -3.5]} s={[11, 3.5, 4]} c="#f08c5a" />
      <Windows w={11} h={1} y0={2.2} z={-1.45} floors={1} cols={4} night={night} color="#ffe0b2" />
      <Sign p={[0, 4, -1.4]} w={7} text={name.length > 18 ? 'MAQUIS' : name.toUpperCase()} bg="#d9480f" />
      {/* Corrugated roof over the terrace */}
      <Box p={[0, 3.3, 0.8]} s={[12, 0.15, 5]} c="#9aa5b1" />
      {[-5.6, 5.6].map((x) => (
        <Box key={x} p={[x, 1.65, 3.1]} s={[0.2, 3.3, 0.2]} c="#5c3d2e" />
      ))}
      <TableSet p={[-3.5, 0, 1.2]} />
      <TableSet p={[0, 0, 2.2]} c="#f8f9fa" />
      <TableSet p={[3.5, 0, 1.2]} />
      {/* Braise grill with smoke */}
      <Box p={[5, 0.6, 4.6]} s={[1.6, 1.2, 0.8]} c="#343a40" />
      <Box p={[5, 1.25, 4.6]} s={[1.5, 0.1, 0.7]} c={night ? '#ff6b2c' : '#e8590c'} glow={night ? 2 : 0.6} />
      {/* String lights */}
      {[...Array(9)].map((_, i) => (
        <mesh key={i} position={[-5.5 + i * 1.37, 3.05, 3.2]}>
          <sphereGeometry args={[0.12, 6, 6]} />
          <meshBasicMaterial color={['#ffd43b', '#ff6b6b', '#69db7c'][i % 3]} />
        </mesh>
      ))}
    </group>
  )
}

function Market({ night }: Props) {
  const umbrellas = ['#ff7a00', '#00b86b', '#2a6cf0', '#e0306a', '#ffc233', '#7b5cff']
  return (
    <group>
      <Box p={[0, 0.05, 0]} s={[13, 0.1, 12]} c="#d8c3a0" />
      {umbrellas.map((u, i) => {
        const x = -4.2 + (i % 3) * 4.2
        const z = -3 + Math.floor(i / 3) * 5
        return (
          <group key={i} position={[x, 0, z]}>
            <Box p={[0, 0.5, 0]} s={[2.4, 1, 1.4]} c="#a0794f" />
            {[-0.7, 0, 0.7].map((dx, j) => (
              <mesh key={j} position={[dx, 1.15, 0]}>
                <icosahedronGeometry args={[0.28, 0]} />
                <Mat color={['#e03131', '#f59f00', '#2f9e44'][(i + j) % 3]} />
              </mesh>
            ))}
            <Box p={[0, 1.8, 0]} s={[0.08, 3.6, 0.08]} c="#555" />
            <mesh position={[0, 3.6, 0]} castShadow>
              <coneGeometry args={[2, 0.9, 8]} />
              <Mat color={u} />
            </mesh>
          </group>
        )
      })}
      <Lamp p={[6, 0, 5]} night={night} />
    </group>
  )
}

function Office({ night }: Props) {
  return (
    <group>
      <Box p={[0, 6, -1]} s={[8, 12, 7]} c="#d0dbe8" />
      <Box p={[0, 13.5, -1]} s={[6, 3, 5]} c="#b8c7d9" />
      <Windows w={8} h={1.6} y0={1.5} z={2.55} floors={7} cols={4} night={night} color="#5aa9e6" />
      <Box p={[0, 1.2, 2.6]} s={[3, 2.4, 0.15]} c="#1c3d5a" />
      <Box p={[0, 15.4, -1]} s={[0.2, 1.6, 0.2]} c="#868e96" />
      <Palm p={[-5, 0, 4]} h={5} />
      <Palm p={[5, 0, 4]} h={5} />
    </group>
  )
}

function Beach({ night }: Props) {
  return (
    <group>
      {/* Sand down to the sea, which the district draws right behind this lot */}
      <Box p={[0, 0.06, -2]} s={[14, 0.12, 18]} c="#f2dca6" />
      <Box p={[-4.5, 1.3, -4]} s={[3, 2.6, 2.4]} c="#c98a4a" />
      <mesh position={[-4.5, 2.9, -4]} castShadow>
        <coneGeometry args={[2.6, 1.4, 4]} />
        <Mat color="#d9b26a" />
      </mesh>
      <Sign p={[-4.5, 1.9, -2.75]} w={2.6} text="BAR" bg={night ? '#e8590c' : '#ff7a00'} />
      <Palm p={[-5, 0, 2]} h={6.5} lean={-0.25} />
      <Palm p={[4.5, 0, 4]} h={5.5} lean={0.2} />
      {[-2, 2].map((x, i) => (
        <group key={x} position={[x, 0, 1.5]}>
          <Box p={[0, 1.4, 0]} s={[0.08, 2.8, 0.08]} c="#666" />
          <mesh position={[0, 2.8, 0]}>
            <coneGeometry args={[1.5, 0.6, 8]} />
            <Mat color={i ? '#ff7a00' : '#00b86b'} />
          </mesh>
          <Box p={[0, 0.25, 1.4]} s={[0.9, 0.12, 2]} c="#ffffff" />
        </group>
      ))}
    </group>
  )
}

function Worship({ name, night }: Props) {
  const mosque = /mosqu/i.test(name)
  if (mosque) {
    return (
      <group>
        <Box p={[0, 2.5, -1]} s={[9, 5, 7]} c="#f1e3c8" />
        <mesh position={[0, 5.4, -1]}>
          <sphereGeometry args={[2.6, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <Mat color="#00a862" />
        </mesh>
        <Box p={[4.5, 5, 2]} s={[1.4, 10, 1.4]} c="#f1e3c8" />
        <mesh position={[4.5, 10.6, 2]}>
          <coneGeometry args={[0.9, 1.6, 8]} />
          <Mat color="#00a862" />
        </mesh>
        <Box p={[0, 1.6, 2.55]} s={[2, 3.2, 0.1]} c="#7a4b2a" />
        <Windows w={9} h={1} y0={2.8} z={2.55} floors={1} cols={4} night={night} color="#a5d8ff" />
      </group>
    )
  }
  return (
    <group>
      <Box p={[0, 3, -1.5]} s={[7, 6, 9]} c="#f8f9fa" />
      <mesh position={[0, 7.2, -1.5]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.01, 5, 2.4, 4, 1]} />
        <Mat color="#adb5bd" />
      </mesh>
      {/* Leaning spire, a nod to Saint-Paul */}
      <group position={[3.5, 0, 2.5]} rotation={[0, 0, -0.25]}>
        <Box p={[0, 6, 0]} s={[1, 12, 1]} c="#e9ecef" />
        <Box p={[0, 12.5, 0]} s={[0.25, 1.6, 0.25]} c="#495057" />
        <Box p={[0, 12.8, 0]} s={[1, 0.25, 0.25]} c="#495057" />
      </group>
      <Box p={[0, 1.8, 3.05]} s={[2, 3.6, 0.1]} c="#7a4b2a" />
      <Windows w={7} h={1} y0={3.2} z={3.05} floors={1} cols={3} night={night} color="#ffd8a8" />
    </group>
  )
}

function Station({ night }: Props) {
  return (
    <group>
      <Box p={[0, 0.05, 0]} s={[14, 0.1, 12]} c="#868e96" />
      {[-5, 0, 5].map((x) => (
        <Box key={x} p={[x, 1.8, -2]} s={[0.3, 3.6, 0.3]} c="#495057" />
      ))}
      <Box p={[0, 3.7, -2]} s={[13, 0.25, 4]} c="#2a6cf0" />
      <Sign p={[0, 4.6, -0.2]} w={6} text="GARE" bg="#2a6cf0" />
      <Vehicle p={[-3.5, 0, 2.5]} kind="gbaka" />
      <Vehicle p={[3, 0, 2.8]} r={0.2} kind="gbaka" />
      <Lamp p={[6.3, 0, 5]} night={night} />
    </group>
  )
}

function Club({ night }: Props) {
  const neon = night ? 2.4 : 0.8
  return (
    <group>
      <Box p={[0, 2.5, -1.5]} s={[10, 5, 7]} c="#2b2140" />
      <Box p={[0, 5.05, -1.5]} s={[10.2, 0.15, 7.2]} c="#ff3ec8" glow={neon} />
      <Box p={[0, 0.1, 2.05]} s={[10.2, 0.15, 0.2]} c="#7b5cff" glow={neon} />
      <Sign p={[0, 3.8, 2.1]} w={6.5} text="CLUB" bg="#b02bd6" />
      <Box p={[0, 1.2, 2.05]} s={[2, 2.4, 0.1]} c="#0d0a14" />
      <mesh position={[0, 6.3, -1.5]}>
        <icosahedronGeometry args={[0.9, 1]} />
        <meshStandardMaterial color="#e9ecef" metalness={0.9} roughness={0.1} flatShading emissive="#ff3ec8" emissiveIntensity={night ? 0.5 : 0} />
      </mesh>
      {/* Red carpet + rope */}
      <Box p={[0, 0.06, 4]} s={[1.6, 0.06, 3.5]} c="#c92a2a" />
      {[-1.3, 1.3].map((x) => (
        <Box key={x} p={[x, 0.5, 4]} s={[0.12, 1, 0.12]} c="#ffd43b" />
      ))}
    </group>
  )
}

function Pitch({ night }: Props) {
  return (
    <group>
      <Box p={[0, 0.06, 0]} s={[13, 0.12, 11]} c="#40c057" />
      {[...Array(6)].map((_, i) => (
        <Box key={i} p={[-5.4 + i * 2.17, 0.07, 0]} s={[1.08, 0.13, 10.9]} c="#37b24d" />
      ))}
      <Box p={[0, 0.14, 0]} s={[0.15, 0.02, 10.6]} c="#ffffff" />
      <mesh position={[0, 0.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.5, 1.7, 24]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      {[-6, 6].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <Box p={[0, 1, -1.5]} s={[0.12, 2, 0.12]} c="#ffffff" />
          <Box p={[0, 1, 1.5]} s={[0.12, 2, 0.12]} c="#ffffff" />
          <Box p={[0, 2, 0]} s={[0.12, 0.12, 3.1]} c="#ffffff" />
        </group>
      ))}
      <mesh position={[1.2, 0.45, 0.8]}>
        <icosahedronGeometry args={[0.3, 1]} />
        <Mat color="#ffffff" />
      </mesh>
      <Lamp p={[-6.6, 0, -5.4]} night={night} />
      <Lamp p={[6.6, 0, -5.4]} night={night} />
    </group>
  )
}

function Nature({ name }: Props) {
  const tooth = /dent/i.test(name)
  return (
    <group>
      <mesh position={[0, tooth ? 5 : 3, -2]} castShadow>
        <coneGeometry args={[tooth ? 3 : 6, tooth ? 10 : 6, 6]} />
        <Mat color={tooth ? '#868e96' : '#5c940d'} />
      </mesh>
      <mesh position={[-4, 2, -3]} castShadow>
        <coneGeometry args={[3.5, 4, 6]} />
        <Mat color="#66a80f" />
      </mesh>
      <Tree p={[4, 0, 2]} />
      <Tree p={[-4.5, 0, 3]} s={1.2} />
      <Tree p={[1, 0, 4]} s={0.8} />
      {/name|cascade/i.test(name) && <Box p={[3, 2.5, -1]} s={[1.2, 5, 0.3]} c="#74c0fc" glow={0.3} />}
    </group>
  )
}

const BY_KIND: Record<string, (p: Props) => React.ReactElement> = {
  home: House,
  maquis: Maquis,
  market: Market,
  office: Office,
  beach: Beach,
  worship: Worship,
  transport: Station,
  club: Club,
  sport: Pitch,
  nature: Nature,
}

export function Building({ kind, ...props }: Props & { kind: string }) {
  const C = BY_KIND[kind] ?? House
  return <C {...props} />
}
