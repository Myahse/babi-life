import { useMemo } from 'react'
import { useSignTexture } from '../props'
import { ROOM, type FloorType, type Opening } from './Shell'

// What makes a room lived in: the rug, the plant, the clock, family photos,
// curtains, the flag at the mairie, the drinks fridge at the maquis… placed
// along the two back walls, away from the furniture and the windows.

type V3 = [number, number, number]
const BACK = -ROOM.D / 2 + ROOM.T / 2 + 0.02 // the back wall's inner face
const LEFT = -ROOM.W / 2 + ROOM.T / 2 + 0.02 // the left wall's

function B({ p, s, c, r = 0, glow }: { p: V3; s: V3; c: string; r?: number; glow?: number }) {
  return (
    <mesh position={p} rotation={[0, r, 0]} castShadow receiveShadow>
      <boxGeometry args={s} />
      <meshLambertMaterial color={c} emissive={glow ? c : '#000000'} emissiveIntensity={glow ?? 0} />
    </mesh>
  )
}

/** A framed picture on a wall: a few blocks of colour for the image. */
export function Frame({ p, wall, w = 0.7, h = 0.5, colors }: { p: V3; wall: 'back' | 'left'; w?: number; h?: number; colors: string[] }) {
  const r = wall === 'back' ? 0 : Math.PI / 2
  return (
    <group position={p} rotation={[0, r, 0]}>
      <B p={[0, 0, 0.02]} s={[w, h, 0.04]} c="#5a3d2a" />
      {colors.map((c, i) => (
        <B key={i} p={[-w / 2 + 0.08 + ((w - 0.16) / colors.length) * (i + 0.5), 0, 0.045]} s={[(w - 0.16) / colors.length, h - 0.14, 0.01]} c={c} />
      ))}
    </group>
  )
}

export function Clock({ p, wall }: { p: V3; wall: 'back' | 'left' }) {
  return (
    <group position={p} rotation={[wall === 'back' ? Math.PI / 2 : 0, 0, wall === 'back' ? 0 : Math.PI / 2]}>
      <mesh>
        <cylinderGeometry args={[0.2, 0.2, 0.05, 20]} />
        <meshLambertMaterial color="#fdfbf5" />
      </mesh>
      <mesh position={[0, 0.03, 0.06]}>
        <boxGeometry args={[0.02, 0.01, 0.13]} />
        <meshBasicMaterial color="#222" />
      </mesh>
      <mesh position={[0.05, 0.03, 0]} rotation={[0, 0.9, 0]}>
        <boxGeometry args={[0.02, 0.01, 0.1]} />
        <meshBasicMaterial color="#222" />
      </mesh>
    </group>
  )
}

/** A potted plant, leaves in blocks. */
export function Plant({ p, big }: { p: V3; big?: boolean }) {
  const s = big ? 1.4 : 1
  return (
    <group position={p} scale={s}>
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.15, 0.4, 10]} />
        <meshLambertMaterial color="#b5653a" />
      </mesh>
      {[[0, 0.75, 0, 0.5], [0.15, 0.6, 0.1, 0.35], [-0.15, 0.62, -0.08, 0.35], [0.05, 0.95, -0.05, 0.3]].map(([x, y, z, k], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[i * 0.4, i * 0.8, 0]} castShadow>
          <boxGeometry args={[k, k, k]} />
          <meshLambertMaterial color={['#2f7a3a', '#3b8f45', '#256b30', '#46a052'][i]} />
        </mesh>
      ))}
    </group>
  )
}

/** A woven rug, a band of colours. */
export function Rug({ p, w, d, colors }: { p: V3; w: number; d: number; colors: string[] }) {
  return (
    <group position={p}>
      {colors.map((c, i) => (
        <mesh key={i} position={[0, 0.012 + i * 0.002, 0]} receiveShadow>
          <boxGeometry args={[w - i * 0.3, 0.01, d - i * 0.3]} />
          <meshLambertMaterial color={c} />
        </mesh>
      ))}
    </group>
  )
}

/** Shelves against a wall, with boxes and bottles on them. */
export function Shelf({ p, wall, w = 1.6, items = ['#c0392b', '#2980b9', '#f1c40f', '#27ae60', '#8e44ad'] }: { p: V3; wall: 'back' | 'left'; w?: number; items?: string[] }) {
  const r = wall === 'back' ? 0 : Math.PI / 2
  return (
    <group position={p} rotation={[0, r, 0]}>
      {[0, 0.55, 1.1, 1.65].map((y) => (
        <B key={y} p={[0, y, 0.18]} s={[w, 0.05, 0.36]} c="#7a5230" />
      ))}
      {[-1, 1].map((s) => (
        <B key={s} p={[(s * w) / 2, 0.85, 0.18]} s={[0.05, 1.75, 0.36]} c="#6b4a32" />
      ))}
      {[0, 0.55, 1.1].flatMap((y, row) =>
        [...Array(5)].map((_, k) => <B key={`${y}${k}`} p={[-w / 2 + 0.2 + k * ((w - 0.3) / 5), y + 0.17, 0.18]} s={[0.18, 0.28 - ((k + row) % 3) * 0.05, 0.2]} c={items[(k + row * 2) % items.length]} />),
      )}
    </group>
  )
}

/** The Ivorian flag on its pole: orange, white, green. */
export function Flag({ p }: { p: V3 }) {
  return (
    <group position={p}>
      <B p={[0, 1.1, 0]} s={[0.05, 2.2, 0.05]} c="#c9a227" />
      {['#f77f00', '#ffffff', '#009e60'].map((c, i) => (
        <B key={c} p={[0.12 + i * 0.22, 1.85, 0]} s={[0.22, 0.5, 0.02]} c={c} />
      ))}
    </group>
  )
}

/** A painted board with writing, on a wall. */
export function Board({ p, wall, text, bg, w = 1.8 }: { p: V3; wall: 'back' | 'left'; text: string; bg: string; w?: number }) {
  const tex = useSignTexture(text, bg)
  return (
    <mesh position={p} rotation={[0, wall === 'back' ? 0 : Math.PI / 2, 0]}>
      <boxGeometry args={[w, w / 4, 0.04]} />
      <meshLambertMaterial map={tex} />
    </mesh>
  )
}

/** Curtains each side of a window. */
export function Curtains({ o, color }: { o: Opening; color: string }) {
  const side = o.wall
  return (
    <group>
      {[-1, 1].map((s) => {
        const u = o.at + s * (o.width / 2 + 0.15)
        const p: V3 = side === 'back' ? [u, 1.75, BACK + 0.08] : [LEFT + 0.08, 1.75, u]
        return <B key={s} p={p} s={side === 'back' ? [0.4, 1.7, 0.06] : [0.06, 1.7, 0.4]} c={color} />
      })}
    </group>
  )
}

/** A drinks fridge, its glass door lit. */
export function Fridge({ p, r = 0, night }: { p: V3; r?: number; night: boolean }) {
  return (
    <group position={p} rotation={[0, r, 0]}>
      <B p={[0, 0.95, 0]} s={[0.8, 1.9, 0.7]} c="#d62828" />
      <B p={[0, 1.0, 0.36]} s={[0.66, 1.5, 0.02]} c="#bfe6ff" glow={night ? 0.6 : 0.2} />
      {[0.55, 0.95, 1.35].flatMap((y) => [-0.2, 0, 0.2].map((x) => <B key={`${x}${y}`} p={[x, y, 0.25]} s={[0.08, 0.26, 0.08]} c={['#2b9348', '#f4a261', '#e9c46a'][Math.round((x + 0.2) * 5) % 3]} />))}
    </group>
  )
}

/** A wardrobe, two doors. */
export function Wardrobe({ p, r = 0, c = '#7a5230' }: { p: V3; r?: number; c?: string }) {
  return (
    <group position={p} rotation={[0, r, 0]}>
      <B p={[0, 1.0, 0]} s={[1.4, 2.0, 0.6]} c={c} />
      <B p={[0, 1.0, 0.31]} s={[0.02, 1.9, 0.01]} c="#3a2a1a" />
      {[-0.08, 0.08].map((x) => (
        <B key={x} p={[x, 1.0, 0.32]} s={[0.03, 0.2, 0.03]} c="#d4af37" />
      ))}
    </group>
  )
}

/** The gas bottle by the cooker, blue like the ones sold in every quarter. */
export function GasBottle({ p }: { p: V3 }) {
  return (
    <group position={p}>
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.16, 0.55, 12]} />
        <meshLambertMaterial color="#1f5fbf" />
      </mesh>
      <mesh position={[0, 0.62, 0]}>
        <cylinderGeometry args={[0.05, 0.08, 0.1, 8]} />
        <meshLambertMaterial color="#9aa0a8" />
      </mesh>
    </group>
  )
}

/** Lengths of pagne hanging on a rail. */
export function Pagnes({ p, wall }: { p: V3; wall: 'back' | 'left' }) {
  const r = wall === 'back' ? 0 : Math.PI / 2
  const colors = ['#e76f51', '#2a9d8f', '#e9c46a', '#264653', '#f4a261', '#7b5cff']
  return (
    <group position={p} rotation={[0, r, 0]}>
      <B p={[0, 2.2, 0.1]} s={[3, 0.04, 0.04]} c="#555" />
      {colors.map((c, i) => (
        <B key={c} p={[-1.25 + i * 0.5, 1.6, 0.12]} s={[0.42, 1.2, 0.02]} c={c} />
      ))}
    </group>
  )
}

/** Per place kind: the floor, the paint, the windows, and the decoration. */
export type RoomStyle = { floorType: FloorType; lower: string; openings: Opening[]; fan?: boolean; lamps?: [number, number][]; decor: (night: boolean) => React.ReactNode }

const W1: Opening = { wall: 'left', at: -0.2, width: 1.6 }
const B1: Opening = { wall: 'back', at: 4, width: 1.6 }

export function roomStyle(kind: string, housing: string): RoomStyle {
  const rich = housing === 'villa' || housing === 'appart'
  switch (kind) {
    case 'home':
      return {
        floorType: rich ? 'tiles' : 'concrete',
        lower: rich ? '#d9cbb3' : '#c9a37a',
        openings: [W1, B1],
        fan: true,
        lamps: [[-2.5, -1], [3, 1]],
        decor: () => (
          <>
            <Rug p={[-1.2, 0, 0.6]} w={3.2} d={2.2} colors={['#9c2f2f', '#e9c46a', '#264653']} />
            <Wardrobe p={[-2.1, 0, -4.05]} />
            <Curtains o={W1} color={rich ? '#2a6f97' : '#e76f51'} />
            <Curtains o={B1} color={rich ? '#2a6f97' : '#e76f51'} />
            <Clock p={[-0.6, 2.5, BACK]} wall="back" />
            <Frame p={[LEFT, 1.85, 2.2]} wall="left" colors={['#8d6e63', '#ffcc80', '#5d4037']} />
            <Frame p={[0.8, 1.9, BACK]} wall="back" w={0.5} h={0.6} colors={['#90caf9', '#a5d6a7']} />
            <Plant p={[5.4, 0, 3.6]} />
            <GasBottle p={[4.2, 0, -3.9]} />
          </>
        ),
      }
    case 'maquis':
      return {
        floorType: 'concrete',
        lower: '#b5651d',
        openings: [W1],
        fan: true,
        lamps: [[-2, -1], [2, 1]],
        decor: (night) => (
          <>
            <Fridge p={[2.4, 0, -4.0]} night={night} />
            <Board p={[-1.5, 2.3, BACK]} wall="back" text="POULET BRAISÉ · GARBA · ALLOCO" bg="#2b2d42" w={3} />
            <Frame p={[LEFT, 2.0, 2.2]} wall="left" w={0.9} h={0.6} colors={['#f77f00', '#ffffff', '#009e60']} />
            <Plant p={[5.4, 0, 3.6]} big />
          </>
        ),
      }
    case 'club':
      return {
        floorType: 'dark',
        lower: '#1a1430',
        openings: [],
        lamps: [],
        decor: () => (
          <>
            {/* Neon strips along the walls */}
            <B p={[0, 2.6, BACK]} s={[11, 0.06, 0.04]} c="#ff2d95" glow={1.2} />
            <B p={[LEFT, 2.6, 0]} s={[0.04, 0.06, 8]} c="#2ee6ff" glow={1.2} />
            <Shelf p={[5.1, 0.9, BACK]} wall="back" w={1.4} items={['#f4a261', '#2ee6ff', '#ff2d95', '#e9c46a']} />
          </>
        ),
      }
    case 'restaurant':
      return {
        floorType: 'tiles',
        lower: '#c8102e',
        openings: [W1, B1],
        lamps: [[-3, 0], [0.5, 0], [4, 0]],
        decor: () => (
          <>
            <Plant p={[5.4, 0, 3.6]} big />
            <Plant p={[-5.4, 0, -3.8]} />
            <Clock p={[2.5, 2.5, BACK]} wall="back" />
          </>
        ),
      }
    case 'school':
    case 'office':
    case 'mairie':
      return {
        floorType: kind === 'office' ? 'wood' : 'tiles',
        lower: kind === 'mairie' ? '#2f6b4f' : kind === 'school' ? '#3a6ea5' : '#7a8099',
        openings: [W1, B1],
        lamps: [[-3, -1], [0, -1], [3, -1], [0, 2]],
        decor: () => (
          <>
            {kind !== 'office' && <Flag p={[-5.2, 0, -3.8]} />}
            {kind === 'mairie' && <Board p={[-3, 2.6, BACK]} wall="back" text="ÉTAT CIVIL" bg="#2f6b4f" />}
            {kind === 'school' && <Frame p={[LEFT, 1.9, 2.4]} wall="left" w={1.2} h={0.8} colors={['#a5d6a7', '#ffe082', '#90caf9', '#ef9a9a']} />}
            <Shelf p={[LEFT + 0.2, 0, 2.6]} wall="left" w={1.4} items={['#5d4037', '#1565c0', '#2e7d32', '#c62828']} />
            <Clock p={[2.2, 2.6, BACK]} wall="back" />
            <Plant p={[5.4, 0, 3.6]} />
          </>
        ),
      }
    case 'health':
      return {
        floorType: 'tiles',
        lower: '#74c0fc',
        openings: [W1, { wall: 'back', at: -1.75, width: 1.2 }],
        lamps: [[-3, -1], [0, -1], [3, -1]],
        decor: () => (
          <>
            {/* Curtains between the beds, the drip stands */}
            {[-1.75, 1.75].map((x) => (
              <B key={x} p={[x, 1.1, -2.6]} s={[0.04, 1.9, 2.2]} c="#a5d8ff" />
            ))}
            {[-2.6, 0.9, 4.4].map((x) => (
              <group key={x} position={[x, 0, -3.4]}>
                <B p={[0, 0.9, 0]} s={[0.04, 1.8, 0.04]} c="#adb5bd" />
                <B p={[0, 1.7, 0.08]} s={[0.12, 0.2, 0.06]} c="#e3f2fd" />
              </group>
            ))}
            <Board p={[LEFT, 2.5, 1]} wall="left" text="+ SOINS" bg="#e03131" w={1.4} />
          </>
        ),
      }
    case 'market':
    case 'mall':
      return {
        floorType: kind === 'mall' ? 'tiles' : 'earth',
        lower: kind === 'mall' ? '#cfd4dc' : '#a67c52',
        openings: kind === 'mall' ? [B1] : [W1],
        lamps: [[-3.5, 0], [0, 0], [3.5, 0]],
        decor: () => (kind === 'market' ? <Pagnes p={[1.5, 0, BACK]} wall="back" /> : <Plant p={[5.4, 0, 3.6]} big />),
      }
    case 'police':
      return {
        floorType: 'concrete',
        lower: '#5b6472',
        openings: [B1],
        lamps: [[-3.5, -2.5], [2.5, 1]],
        decor: () => (
          <>
            <Flag p={[5.2, 0, -3.8]} />
            <Board p={[1.5, 2.5, BACK]} wall="back" text="POLICE NATIONALE" bg="#1d3557" w={2.4} />
          </>
        ),
      }
    case 'barbier':
    case 'salon':
      return {
        floorType: 'tiles',
        lower: kind === 'salon' ? '#f783ac' : '#1d3557',
        openings: [],
        lamps: [[-3.5, -2], [0, -2], [3.5, -2]],
        decor: () => (
          <>
            <Frame p={[LEFT, 2.0, 2.6]} wall="left" w={0.6} h={0.8} colors={kind === 'salon' ? ['#5d4037', '#3e2723'] : ['#212121', '#424242']} />
            <Frame p={[LEFT, 2.0, -2.4]} wall="left" w={0.6} h={0.8} colors={['#3e2723', '#6d4c41']} />
            <Plant p={[5.4, 0, 3.6]} />
          </>
        ),
      }
    case 'couture':
      return {
        floorType: 'tiles',
        lower: '#8d5a2b',
        openings: [W1],
        lamps: [[-3, -2.5], [0.5, -2.5], [3, 1]],
        decor: () => (
          <>
            <Board p={[1.5, 2.55, BACK]} wall="back" text="COUTURE" bg="#7b2d26" w={2} />
            <Plant p={[5.4, 0, 3.6]} />
          </>
        ),
      }
    case 'hotel':
      return {
        floorType: 'marble',
        lower: '#b08d57',
        openings: [W1],
        lamps: [[-1, 1], [3, -2]],
        decor: () => (
          <>
            {/* The lobby chandelier */}
            <group position={[-1, 2.6, 1]}>
              {[...Array(8)].map((_, k) => (
                <mesh key={k} position={[Math.cos((k / 8) * Math.PI * 2) * 0.45, 0, Math.sin((k / 8) * Math.PI * 2) * 0.45]}>
                  <sphereGeometry args={[0.07, 8, 6]} />
                  <meshBasicMaterial color="#fff3c4" />
                </mesh>
              ))}
            </group>
            <Plant p={[-5.3, 0, -3.8]} big />
            <Plant p={[5.4, 0, 3.6]} big />
            <Rug p={[-3.8, 0, 1.6]} w={2.4} d={3} colors={['#7b2d26', '#c9a227']} />
          </>
        ),
      }
    case 'universite':
      return {
        floorType: 'tiles',
        lower: '#8d6e4a',
        openings: [W1],
        lamps: [[-2, -2], [1, -2], [4, -2], [-2, 1.5], [1, 1.5], [4, 1.5]],
        decor: () => (
          <>
            <Flag p={[-4.6, 0, -3.9]} />
            <Clock p={[4.6, 2.6, BACK]} wall="back" />
          </>
        ),
      }
    case 'orphelinat':
      // The orphanage: its floor of wood, the light of its windows, the children's drawings pinned up, its name over the shelf.
      return {
        floorType: 'wood',
        lower: '#ffd8a8',
        openings: [],
        lamps: [[-2.5, -1], [2.5, -1], [0, 2]],
        decor: () => (
          <>
            <Board p={[-0.6, 2.4, BACK]} wall="back" text="NOS ENFANTS, NOTRE AVENIR" bg="#e64980" w={3.2} />
            <Board p={[LEFT, 2.2, 1.6]} wall="left" text="BIENVENUE" bg="#1c7ed6" w={1.8} />
          </>
        ),
      }
    case 'gaming':
      // The salle de jeux: dark paint, its screens and its neon standing out (GamingRoom.tsx); its name over the TVs, the prices by the arcade.
      return {
        floorType: 'dark',
        lower: '#2a2142',
        openings: [],
        lamps: [[-2.5, -1], [2.5, -1], [0, 2]],
        decor: () => (
          <>
            <Board p={[0, 2.35, BACK]} wall="back" text="SALLE DE JEUX" bg="#5f3dc4" w={2.8} />
            <Board p={[LEFT, 2.1, -2.4]} wall="left" text="MATCH : 200 F" bg="#111014" w={1.8} />
          </>
        ),
      }
    default:
      return {
        floorType: 'tiles',
        lower: kind === 'worship' ? '#d9c7a3' : '#2a223a',
        openings: kind === 'worship' ? [W1, B1, { wall: 'back', at: -4, width: 1.6 }] : [],
        lamps: [[-2, 0], [2, 0]],
        decor: () => (kind === 'worship' ? <Plant p={[3.2, 0.6, -3.6]} /> : null),
      }
  }
}

/** Keep the hooks rule happy where a decor needs memoised data. */
export function useRoomStyle(kind: string, housing: string) {
  return useMemo(() => roomStyle(kind, housing), [kind, housing])
}
