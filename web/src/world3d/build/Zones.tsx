import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Block, Piece, Zone } from '../../lib/types'
import { worldTime } from '../../lib/worldClock'

// The ground of a house built from a plan (game/plans.go), under its walls:
// each room's floor (tiles, or bare concrete in the poor houses), the yard of
// beaten earth, the lawn with its flower pots and a tree, the terrace, and the
// pool — a basin raised on the ground, tiled round, its water moving a little.
// In the plot's own metres, like the blocks (x, z from its corner).

const S = 16
const textures = new Map<string, THREE.CanvasTexture>()

/** A 16 × 16 pixel texture for a kind of ground, repeated once a metre. */
function groundTexture(kind: string) {
  let t = textures.get(kind)
  if (t) return t
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')!
  const hash = (x: number, y: number, k = 0) => {
    const n = Math.sin(x * 127.1 + y * 311.7 + k * 74.7) * 43758.5453
    return n - Math.floor(n)
  }
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const n = hash(x, y)
      let col: string
      switch (kind) {
        case 'sol': // white floor tiles, grey joints
          col = x % 8 === 7 || y % 8 === 7 ? '#c9c3b6' : n > 0.85 ? '#efebe2' : '#e6e1d6'
          break
        case 'terrasse': // terracotta tiles
          col = x % 8 === 7 || y % 8 === 7 ? '#a8603e' : n > 0.8 ? '#d0835b' : '#c67650'
          break
        case 'beton':
          col = n > 0.9 ? '#8f8d88' : n < 0.1 ? '#a9a7a1' : '#9d9b95'
          break
        case 'cour': // red laterite, a few stones
          col = n > 0.93 ? '#8d5636' : n < 0.12 ? '#b8774d' : '#a9693f'
          break
        default: // the lawn
          col = n > 0.8 ? '#7cc255' : n < 0.2 ? '#5d9f40' : '#6db04a'
      }
      g.fillStyle = col
      g.fillRect(x, y, 1, 1)
    }
  t = new THREE.CanvasTexture(c)
  t.magFilter = t.minFilter = THREE.NearestFilter
  t.generateMipmaps = false
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  textures.set(kind, t)
  return t
}

/** The order the kinds lie in, from the bottom: a room's floor on the yard or the lawn. A few
 * centimetres apart, or the far camera can't tell them apart and the lower one shows through. */
const LAYER: Record<string, number> = { jardin: 0, cour: 0, terrasse: 1, beton: 2, sol: 2, piscine: 3 }

function Ground({ zone }: { zone: Zone }) {
  const [x, z, w, d, kind] = zone
  const tex = useMemo(() => {
    const t = groundTexture(kind).clone()
    t.repeat.set(w, d)
    t.needsUpdate = true
    return t
  }, [kind, w, d])
  return (
    <mesh position={[x + w / 2, 0.02 + (LAYER[kind] ?? 0) * 0.025, z + d / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[w, d]} />
      <meshLambertMaterial map={tex} />
    </mesh>
  )
}

const rim = new THREE.MeshLambertMaterial({ color: '#f1f3f4' })
const inner = new THREE.MeshLambertMaterial({ color: '#3b9fd8' })
const ladder = new THREE.MeshLambertMaterial({ color: '#c3c7cf' })

/**
 * A pool of w × d metres with its corner at (x, z): a tiled rim 0.7 m high
 * round the basin, the water just under it, blue and moving.
 */
export function Pool({ x, z, w, d }: { x: number; z: number; w: number; d: number }) {
  const water = useRef<THREE.MeshLambertMaterial>(null)
  useFrame(() => {
    if (!water.current) return
    const t = worldTime()
    water.current.color.setHSL(0.55, 0.75, 0.52 + Math.sin(t * 1.3) * 0.03)
  })
  const H = 0.7
  const T = 0.3
  const [cx, cz] = [x + w / 2, z + d / 2]
  return (
    <group>
      {/* The rim, four tiled sides */}
      <mesh position={[cx, H / 2, z + T / 2]} material={rim} castShadow receiveShadow>
        <boxGeometry args={[w, H, T]} />
      </mesh>
      <mesh position={[cx, H / 2, z + d - T / 2]} material={rim} castShadow receiveShadow>
        <boxGeometry args={[w, H, T]} />
      </mesh>
      <mesh position={[x + T / 2, H / 2, cz]} material={rim} castShadow receiveShadow>
        <boxGeometry args={[T, H, d - 2 * T]} />
      </mesh>
      <mesh position={[x + w - T / 2, H / 2, cz]} material={rim} castShadow receiveShadow>
        <boxGeometry args={[T, H, d - 2 * T]} />
      </mesh>
      {/* The basin's blue floor and the water */}
      <mesh position={[cx, 0.1, cz]} rotation={[-Math.PI / 2, 0, 0]} material={inner}>
        <planeGeometry args={[w - 2 * T, d - 2 * T]} />
      </mesh>
      <mesh position={[cx, H - 0.12, cz]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w - 2 * T, d - 2 * T]} />
        <meshLambertMaterial ref={water} color="#4cb6ea" transparent opacity={0.82} />
      </mesh>
      {/* The ladder at one end */}
      {[-0.25, 0.25].map((o) => (
        <mesh key={o} position={[x + w - T - 0.15, H + 0.25, cz + o]} material={ladder}>
          <boxGeometry args={[0.06, 0.9, 0.06]} />
        </mesh>
      ))}
    </group>
  )
}

const pot = new THREE.MeshLambertMaterial({ color: '#b5603a' })
const leaf = new THREE.MeshLambertMaterial({ color: '#3f8f3a' })
const leafDark = new THREE.MeshLambertMaterial({ color: '#2f7a35' })
const trunk = new THREE.MeshLambertMaterial({ color: '#6b4a2e' })
const FLOWERS = ['#e8432f', '#f2c94c', '#d6336c', '#ffffff'].map((c) => new THREE.MeshLambertMaterial({ color: c }))

/** The lawn's flower pots along the walls of the lot, and a tree in a free corner. */
function GardenLife({ zones, blocks, furniture, w, d, cut }: { zones: Zone[]; blocks: Block[]; furniture: Piece[]; w: number; d: number; cut?: boolean }) {
  const { pots, trees } = useMemo(() => {
    const busy = new Set<string>()
    for (const [x, y, z] of blocks) if (y <= 1) busy.add(`${x},${z}`)
    for (const [x, , z] of furniture) for (let dx = -1; dx <= 2; dx++) for (let dz = -1; dz <= 2; dz++) busy.add(`${x + dx},${z + dz}`)
    for (const [x, z, zw, zd, k] of zones) if (k !== 'jardin') for (let i = x - 1; i <= x + zw; i++) for (let j = z - 1; j <= z + zd; j++) busy.add(`${i},${j}`)
    const lawn = (x: number, z: number) => !busy.has(`${x},${z}`) && zones.some(([zx, zz, zw, zd, k]) => k === 'jardin' && x >= zx && x < zx + zw && z >= zz && z < zz + zd)
    const pots: [number, number, number][] = []
    // Along the lot's edge, inside the wall, every few metres.
    for (let x = 1; x < w - 1; x += 3) for (const z of [1, d - 2]) if (lawn(x, z)) pots.push([x + 0.5, z + 0.5, (x * 7 + z) % FLOWERS.length])
    for (let z = 4; z < d - 2; z += 3) for (const x of [1, w - 2]) if (lawn(x, z)) pots.push([x + 0.5, z + 0.5, (x + z * 3) % FLOWERS.length])
    // A tree (a mango tree) in each free corner big enough.
    const trees: [number, number][] = []
    for (const [x, z] of [
      [2, d - 3],
      [w - 3, d - 3],
      [2, 2],
      [w - 3, 2],
    ] as [number, number][]) {
      let free = true
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) free &&= lawn(x + i, z + j)
      if (free) trees.push([x + 0.5, z + 0.5])
    }
    return { pots, trees: trees.slice(0, 2) }
  }, [zones, blocks, furniture, w, d])
  return (
    <group>
      {pots.map(([x, z, c], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.2, 0]} material={pot} castShadow>
            <boxGeometry args={[0.45, 0.4, 0.45]} />
          </mesh>
          <mesh position={[0, 0.55, 0]} material={leaf}>
            <boxGeometry args={[0.5, 0.35, 0.5]} />
          </mesh>
          <mesh position={[0.1, 0.78, 0.05]} material={FLOWERS[c]}>
            <boxGeometry args={[0.16, 0.12, 0.16]} />
          </mesh>
          <mesh position={[-0.12, 0.74, -0.1]} material={FLOWERS[(c + 1) % FLOWERS.length]}>
            <boxGeometry args={[0.14, 0.1, 0.14]} />
          </mesh>
        </group>
      ))}
      {trees.map(([x, z], i) => (
        <group key={`t${i}`} position={[x, 0, z]}>
          {/* Looking into the house (its walls cut), the tree would hide it: cut down to the trunk's foot, like the walls. */}
          <mesh position={[0, cut ? 0.45 : 1.4, 0]} material={trunk} castShadow>
            <boxGeometry args={[0.45, cut ? 0.9 : 2.8, 0.45]} />
          </mesh>
          {!cut && (
            <>
              <mesh position={[0, 3.3, 0]} material={leaf} castShadow>
                <boxGeometry args={[2.8, 1.4, 2.8]} />
              </mesh>
              <mesh position={[0.2, 4.2, -0.1]} material={leafDark} castShadow>
                <boxGeometry args={[1.8, 0.9, 1.8]} />
              </mesh>
            </>
          )}
        </group>
      ))}
    </group>
  )
}

/** All the ground of a house: floors, yard, lawn (with its pots and trees), terrace, pool. cut: the house is seen inside. */
export function Zones({ zones, blocks, furniture, w, d, cut }: { zones: Zone[]; blocks: Block[]; furniture: Piece[]; w: number; d: number; cut?: boolean }) {
  return (
    <group>
      {zones.map((z, i) => (z[4] === 'piscine' ? <Pool key={i} x={z[0]} z={z[1]} w={z[2]} d={z[3]} /> : <Ground key={i} zone={z} />))}
      <GardenLife zones={zones} blocks={blocks} furniture={furniture} w={w} d={d} cut={cut} />
    </group>
  )
}

/** A bought lot with nothing drawn on its ground yet: its lawn and a post at each corner, so one sees its size. */
export function LotGround({ w, d }: { w: number; d: number }) {
  const tex = useMemo(() => {
    const t = groundTexture('jardin').clone()
    t.repeat.set(w, d)
    t.needsUpdate = true
    return t
  }, [w, d])
  return (
    <group>
      <mesh position={[w / 2, 0.02, d / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshLambertMaterial map={tex} />
      </mesh>
      {/* The surveyor's corner posts, painted red and white */}
      {(
        [
          [0, 0],
          [w, 0],
          [0, d],
          [w, d],
        ] as [number, number][]
      ).map(([x, z]) => (
        <group key={`${x},${z}`} position={[x, 0, z]}>
          <mesh position={[0, 0.3, 0]}>
            <boxGeometry args={[0.25, 0.6, 0.25]} />
            <meshLambertMaterial color="#e8432f" />
          </mesh>
          <mesh position={[0, 0.75, 0]}>
            <boxGeometry args={[0.25, 0.3, 0.25]} />
            <meshLambertMaterial color="#ffffff" />
          </mesh>
        </group>
      ))}
    </group>
  )
}
