import { Box, Lamp, Mat, Palm, Sign, TableSet, Tree } from './props'
import { Vehicle } from './vehicles'

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

// The Ivorian flag: orange, white, green vertical bands.
function Flag({ p }: { p: [number, number, number] }) {
  const [x, y, z] = p
  return (
    <group>
      <Box p={[x, y + 3, z]} s={[0.12, 6, 0.12]} c="#dee2e6" />
      <Box p={[x + 0.45, y + 5.5, z]} s={[0.6, 0.9, 0.05]} c="#ff8200" />
      <Box p={[x + 1.05, y + 5.5, z]} s={[0.6, 0.9, 0.05]} c="#ffffff" />
      <Box p={[x + 1.65, y + 5.5, z]} s={[0.6, 0.9, 0.05]} c="#009a44" />
    </group>
  )
}

/** Hôtel de ville: white civic block, columned portico, steps and the flag. */
function Mairie({ night }: Props) {
  return (
    <group>
      <Box p={[0, 3, -2]} s={[11, 6, 6]} c="#f4f1ea" />
      <Box p={[0, 6.2, -2]} s={[11.6, 0.4, 6.6]} c="#d8cfc0" />
      <Windows w={11} h={2.2} y0={1.8} z={1.05} floors={2} cols={5} night={night} color="#9cc9e8" />
      {/* Portico */}
      <Box p={[0, 4.6, 2.2]} s={[5.4, 0.5, 2.4]} c="#e9e2d4" />
      {[-2.2, -0.75, 0.75, 2.2].map((x) => (
        <Box key={x} p={[x, 2.2, 3.1]} s={[0.4, 4.4, 0.4]} c="#ffffff" />
      ))}
      <Box p={[0, 0.15, 3.8]} s={[6, 0.3, 1.6]} c="#d8cfc0" />
      <Box p={[0, 1.3, 1.1]} s={[1.6, 2.6, 0.1]} c="#6b4423" />
      <Sign p={[0, 5.2, 3.45]} w={4.4} text="MAIRIE" bg="#00895a" />
      <Flag p={[5, 0, 4.2]} />
      <Tree p={[-5, 0, 4]} s={0.8} />
    </group>
  )
}

/** School or university: a long ochre block with a courtyard and the flag. */
function School({ name, night, label = /université|inp/i.test(name) ? 'UNIVERSITÉ' : 'ÉCOLE' }: Props & { label?: string }) {
  return (
    <group>
      <Box p={[0, 2.6, -3]} s={[12.5, 5.2, 4.5]} c="#f2c879" />
      <Box p={[0, 5.35, -3]} s={[13, 0.3, 5]} c="#b5651d" />
      <Windows w={12} h={2.2} y0={1.6} z={-0.7} floors={2} cols={6} night={night} color="#a5d8ff" />
      {/* Covered walkway along the front */}
      <Box p={[0, 2.6, 0.6]} s={[12.5, 0.15, 2]} c="#9aa5b1" />
      {[-5.8, -2, 2, 5.8].map((x) => (
        <Box key={x} p={[x, 1.3, 1.5]} s={[0.2, 2.6, 0.2]} c="#6c757d" />
      ))}
      <Box p={[0, 0.06, 3.6]} s={[9, 0.12, 3.4]} c="#d9c9a8" />
      <Sign p={[0, 4.6, -0.65]} w={6} text={label} bg="#1e88e5" />
      <Flag p={[-5.5, 0, 4.5]} />
      <Tree p={[5, 0, 4.3]} s={0.9} />
    </group>
  )
}

/** Hospital: white block with a red cross, an entrance canopy and an ambulance bay. */
function Health({ night }: Props) {
  return (
    <group>
      <Box p={[0, 3.5, -2.5]} s={[11, 7, 5.5]} c="#ffffff" />
      <Box p={[0, 0.5, -2.5]} s={[11.05, 1, 5.55]} c="#74c0fc" />
      <Windows w={11} h={2} y0={2.2} z={0.3} floors={3} cols={5} night={night} color="#d0ebff" />
      {/* Red cross */}
      <Box p={[0, 6.2, 0.35]} s={[0.5, 1.5, 0.1]} c="#e03131" glow={night ? 0.8 : 0} />
      <Box p={[0, 6.2, 0.36]} s={[1.5, 0.5, 0.1]} c="#e03131" glow={night ? 0.8 : 0} />
      <Box p={[0, 2.4, 1.8]} s={[4.5, 0.2, 2.6]} c="#adb5bd" />
      {[-2, 2].map((x) => (
        <Box key={x} p={[x, 1.2, 2.9]} s={[0.2, 2.4, 0.2]} c="#868e96" />
      ))}
      <Box p={[0, 1.1, 0.3]} s={[2, 2.2, 0.1]} c="#a5d8ff" />
      <Sign p={[0, 3, 3.05]} w={4} text="URGENCES" bg="#e03131" />
      <Box p={[-4.5, 0.06, 3.4]} s={[3.5, 0.12, 3]} c="#ced4da" />
    </group>
  )
}

/** Cultural venue: a big hall with a sweeping roof and a banner. */
function Culture({ name, night }: Props) {
  const text = name.length > 16 ? 'CULTURE' : name.toUpperCase()
  return (
    <group>
      <Box p={[0, 3, -2.5]} s={[11.5, 6, 6]} c="#ffd8a8" />
      <mesh position={[0, 6.4, -2.5]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[1.4, 1.4, 12.5, 16, 1, false, 0, Math.PI]} />
        <Mat color="#d9480f" />
      </mesh>
      <Windows w={11} h={2} y0={2.2} z={0.55} floors={2} cols={3} night={night} color="#ffe8cc" />
      <Box p={[0, 1.4, 0.6]} s={[3.6, 2.8, 0.1]} c="#5c3d2e" />
      <Sign p={[0, 5.2, 0.6]} w={7} text={text} bg="#7b2cbf" />
      {[-4.5, 4.5].map((x) => (
        <Box key={x} p={[x, 2.5, 2.4]} s={[0.15, 5, 0.15]} c="#495057" />
      ))}
      <Box p={[0, 0.06, 3.5]} s={[10, 0.12, 3]} c="#e9d8c4" />
      <Lamp p={[-5, 0, 4.5]} night={night} />
      <Lamp p={[5, 0, 4.5]} night={night} />
    </group>
  )
}

/** Shopping centre: a wide glass front under a long canopy, the name on top, a car park. */
function Mall({ name, night }: Props) {
  return (
    <group>
      <Box p={[0, 3, -3]} s={[13, 6, 5]} c="#e9ecef" />
      <Box p={[0, 1.8, -0.45]} s={[11, 3.2, 0.12]} c={night ? '#ffe8a3' : '#a5d8ff'} glow={night ? 0.8 : 0} />
      <Box p={[0, 3.7, 0.3]} s={[12.5, 0.25, 1.8]} c="#495057" />
      <Sign p={[0, 5, -0.4]} w={8} text={name.toUpperCase()} bg="#c2255c" />
      {/* Car park */}
      <Box p={[0, 0.04, 3.6]} s={[12, 0.08, 3.6]} c="#868e96" />
      {[-4.5, -1.5, 1.5, 4.5].map((x) => (
        <Box key={x} p={[x, 0.09, 3.6]} s={[0.12, 0.02, 3]} c="#f8f9fa" />
      ))}
      <Box p={[-3, 0.5, 3.6]} s={[1.6, 0.9, 2.8]} c="#2a6cf0" />
      <Box p={[3, 0.5, 3.6]} s={[1.6, 0.9, 2.8]} c="#f8f9fa" />
      <Palm p={[-6, 0, 5.5]} />
      <Palm p={[6, 0, 5.5]} />
    </group>
  )
}

/** Restaurant: a bright box with a terrace and its name over the door. */
function Restaurant({ name, night }: Props) {
  return (
    <group>
      <Box p={[0, 2, -2.5]} s={[9, 4, 6]} c="#fff3e0" />
      <Box p={[0, 4.1, -2.5]} s={[9.4, 0.3, 6.4]} c="#e8590c" />
      <Windows w={9} h={1.6} y0={1.8} z={0.55} floors={1} cols={3} night={night} color="#ffe8cc" />
      <Box p={[0, 1.2, 0.56]} s={[1.6, 2.4, 0.1]} c="#5c3d2e" />
      <Sign p={[0, 3.3, 0.6]} w={6} text={name.toUpperCase()} bg="#e8590c" />
      <Box p={[0, 2.6, 2]} s={[9, 0.12, 2.6]} c="#ffa94d" />
      <TableSet p={[-2.5, 0, 2.4]} />
      <TableSet p={[2.5, 0, 2.4]} c="#f8f9fa" />
      <Lamp p={[4.8, 0, 4.5]} night={night} />
    </group>
  )
}

/** The barber's shop: a small shop front, its striped pole and the bench outside. */
function Barbier({ night }: Props) {
  return (
    <group>
      <Box p={[0, 1.7, -1]} s={[7, 3.4, 4.5]} c="#e9ecef" />
      <Box p={[0, 3.5, -1]} s={[7.4, 0.2, 4.9]} c="#1d3557" />
      <Box p={[0, 1.5, 1.26]} s={[4.4, 1.8, 0.08]} c={night ? '#ffe8a3' : '#a5d8ff'} glow={night ? 0.7 : 0} />
      <Box p={[2.8, 1.1, 1.26]} s={[0.9, 2.2, 0.08]} c="#5c3d2e" />
      <Sign p={[0, 2.9, 1.3]} w={5} text="BARBIER" bg="#1d3557" />
      {/* The striped pole by the door */}
      {[...Array(6)].map((_, i) => (
        <mesh key={i} position={[-3.1, 0.6 + i * 0.3, 1.5]}>
          <cylinderGeometry args={[0.16, 0.16, 0.3, 12]} />
          <Mat color={['#e63946', '#ffffff', '#1d3557'][i % 3]} />
        </mesh>
      ))}
      <Box p={[0, 0.45, 2.6]} s={[3.5, 0.1, 0.6]} c="#8a6a3d" />
      <Box p={[0, 0.22, 2.6]} s={[3.2, 0.44, 0.1]} c="#6b5030" />
      <Lamp p={[4.5, 0, 3.5]} night={night} />
    </group>
  )
}

/** The hair salon: a pink shop with a painted sign of braids. */
function Salon({ night }: Props) {
  return (
    <group>
      <Box p={[0, 1.7, -1]} s={[7.5, 3.4, 4.5]} c="#ffd6e7" />
      <Box p={[0, 3.5, -1]} s={[7.9, 0.2, 4.9]} c="#c2255c" />
      <Box p={[0, 2.5, 1.6]} s={[7.5, 0.12, 1.2]} c="#f783ac" />
      <Box p={[-0.8, 1.4, 1.26]} s={[4.4, 1.7, 0.08]} c={night ? '#ffe8a3' : '#fcc2d7'} glow={night ? 0.7 : 0} />
      <Box p={[2.6, 1.1, 1.26]} s={[0.9, 2.2, 0.08]} c="#5c3d2e" />
      <Sign p={[0, 3.05, 1.3]} w={6} text="COIFFURE" bg="#c2255c" />
      {/* A painted face with braids, as on the salons' walls */}
      <mesh position={[3.3, 2.2, -0.9]} rotation={[0, Math.PI / 2, 0]}>
        <circleGeometry args={[0.7, 20]} />
        <Mat color="#7a4a2a" />
      </mesh>
      {[-0.4, -0.2, 0, 0.2, 0.4].map((z) => (
        <Box key={z} p={[3.78, 1.4, -0.9 + z]} s={[0.04, 1.2, 0.08]} c="#141010" />
      ))}
      <TableSet p={[-4.5, 0, 3]} c="#f783ac" />
    </group>
  )
}

/** A grand hotel: a tall white tower over the lagoon, a low wing and the pool. */
function Hotel({ name, night }: Props) {
  return (
    <group>
      <Box p={[0, 11, -3]} s={[9, 22, 4.5]} c="#f1f3f5" />
      <Windows w={9} h={1.4} y0={2} z={-0.7} floors={14} cols={6} night={night} color="#4dabf7" />
      <Box p={[0, 22.3, -3]} s={[9.4, 0.6, 4.9]} c="#adb5bd" />
      <Box p={[-1, 1.5, 0.5]} s={[12, 3, 3]} c="#e9ecef" />
      <Box p={[-1, 3.1, 1.2]} s={[12.4, 0.2, 4.4]} c="#c9a227" />
      <Sign p={[-1, 2.4, 2.05]} w={7} text={name.toUpperCase()} bg="#c9a227" />
      <Box p={[3, 0.05, 4.6]} s={[6, 0.1, 3]} c="#e9ecef" />
      <Box p={[3, 0.11, 4.6]} s={[5.2, 0.04, 2.3]} c="#3fb6e0" glow={0.15} />
      <Palm p={[-5.5, 0, 4.5]} h={6.5} />
      <Palm p={[6.3, 0, 3]} h={5.5} lean={-0.2} />
      <Flag p={[-3, 0, 5.5]} />
    </group>
  )
}

/** An Ébrié village: low houses with tin roofs, attiéké drying on mats. */
function Village({ night }: Props) {
  return (
    <group>
      {[[-4, -3.5, '#e3c9a0'], [0.5, -4, '#f2dca6'], [4.5, -2.5, '#d9b88a']].map(([x, z, c]) => (
        <group key={String(x)} position={[x as number, 0, z as number]}>
          <Box p={[0, 1.2, 0]} s={[3.6, 2.4, 2.8]} c={c as string} />
          <Box p={[0, 2.5, 0]} s={[4, 0.15, 3.2]} c="#9aa5b1" />
          <Box p={[0, 0.9, 1.42]} s={[0.8, 1.8, 0.06]} c="#5c3d2e" />
        </group>
      ))}
      {/* The attiéké: cassava semolina steaming, then drying in the sun */}
      {[-3, -1, 1].map((x) => (
        <Box key={x} p={[x, 0.08, 2]} s={[1.6, 0.06, 1.2]} c="#f8f9fa" />
      ))}
      <mesh position={[3.5, 0.45, 1.8]}>
        <cylinderGeometry args={[0.55, 0.45, 0.9, 14]} />
        <Mat color="#495057" />
      </mesh>
      <Tree p={[-5.5, 0, 3.5]} s={1.4} />
      <Palm p={[6, 0, 4]} />
      <Lamp p={[1, 0, 4.5]} night={night} />
    </group>
  )
}

/** The lagoon side: a paved walk, a railing, benches and the water beyond. */
function Lagune({ night }: Props) {
  return (
    <group>
      <Box p={[0, 0.02, -4]} s={[14, 0.04, 6]} c="#2f7fa8" glow={0.1} />
      <Box p={[0, 0.06, 1.5]} s={[14, 0.12, 5]} c="#d9c9a8" />
      <Box p={[0, 0.9, -0.95]} s={[14, 0.08, 0.08]} c="#dee2e6" />
      {[...Array(8)].map((_, i) => (
        <Box key={i} p={[-6.5 + i * 1.85, 0.5, -0.95]} s={[0.08, 0.9, 0.08]} c="#dee2e6" />
      ))}
      {[-4, 0, 4].map((x) => (
        <group key={x}>
          <Box p={[x, 0.45, 0.3]} s={[1.8, 0.1, 0.5]} c="#8a6a3d" />
          <Box p={[x, 0.22, 0.3]} s={[1.6, 0.44, 0.1]} c="#6b5030" />
        </group>
      ))}
      <Palm p={[-6, 0, 3.5]} />
      <Palm p={[6, 0, 3.5]} lean={-0.2} />
      <Lamp p={[-2, 0, 2.5]} night={night} />
      <Lamp p={[2, 0, 2.5]} night={night} />
    </group>
  )
}

function University(props: Props) {
  return <School {...props} label="UNIVERSITÉ" />
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
  mairie: Mairie,
  school: School,
  health: Health,
  culture: Culture,
  mall: Mall,
  restaurant: Restaurant,
  barbier: Barbier,
  salon: Salon,
  hotel: Hotel,
  universite: University,
  village: Village,
  lagune: Lagune,
}

export function Building({ kind, ...props }: Props & { kind: string }) {
  const C = BY_KIND[kind] ?? House
  return <C {...props} />
}
