import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Block } from '../../lib/types'

// What a house of Abidjan has on it, besides its walls, worked out from the blocks it's built of (the
// player's plan): the black water tank (« polytank ») up on the roof, a satellite dish at its edge, the
// air conditioner on an outside wall, iron bars over the windows, and at the door the doorstep, a little
// tin awning, the lamp, the number plate and two pots of plants. Coordinates are the plot's, as House's.

type V3 = [number, number, number]
const M = (color: string, emissive?: string) => new THREE.MeshLambertMaterial({ color, ...(emissive ? { emissive, emissiveIntensity: 0.8 } : {}) })
const black = M('#1c1d21')
const white = M('#ecebe6')
const grey = M('#9aa0a6')
const iron = M('#2b2d31')
const tin = M('#b9c2c9')
const concrete = M('#bdb7ab')
const terracotta = M('#b5532f')
const leaf = M('#3f8f3a')
const lamp = M('#fff2c4', '#ffd98a')
const plate = M('#1f4f8f')
// After dark: the rooms lit behind their windows (warm, not lit by the scene), the door's lamp on.
const roomLight = new THREE.MeshBasicMaterial({ color: '#ffc46b', toneMapped: false })
const lampOn = new THREE.MeshBasicMaterial({ color: '#fff4c8', toneMapped: false })
const BOX = new THREE.BoxGeometry(1, 1, 1)
const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 14)

function B({ p, s, m, r }: { p: V3; s: V3; m: THREE.Material; r?: V3 }) {
  return <mesh geometry={BOX} material={m} position={p} scale={s} rotation={r} />
}

const DIRS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

export function HouseDressing({ blocks, night }: { blocks: Block[]; /** After dark: most windows lit from inside, the door's lamp on. */ night?: boolean }) {
  const d = useMemo(() => {
    if (!blocks.length) return null
    const at = new Set(blocks.map(([x, y, z]) => `${x},${y},${z}`))
    const has = (x: number, y: number, z: number) => at.has(`${x},${y},${z}`)
    let [x0, x1, z0, z1, top] = [Infinity, -Infinity, Infinity, -Infinity, 0]
    for (const [x, y, z] of blocks) [x0, x1, z0, z1, top] = [Math.min(x0, x), Math.max(x1, x), Math.min(z0, z), Math.max(z1, z), Math.max(top, y)]
    // Looking out from a cell along a way: the next cell is open sky (nothing in it, nothing over it: a
    // room has its roof over it, the yard or the street has none; the fence doesn't count).
    const outward = (x: number, y: number, z: number, [dx, dz]: [number, number]) => {
      const [cx, cz] = [x + dx, z + dz]
      for (let yy = y; yy <= top; yy++) if (has(cx, yy, cz)) return false
      return true
    }
    // The windows' outer faces.
    const bars: { p: V3; along: 'x' | 'z'; lit: boolean; out: [number, number] }[] = []
    for (const [x, y, z, m] of blocks) {
      if (m !== 'verre') continue
      for (const dir of DIRS) {
        if (!outward(x, y, z, dir)) continue
        // (Lit at night: most rooms, not all, the same ones every night.)
        const lit = Math.abs(Math.sin(x * 12.9898 + y * 4.1 + z * 78.233) * 43758.5453) % 1 < 0.72
        bars.push({ p: [x + 0.5 + dir[0] * 0.56, y + 0.5, z + 0.5 + dir[1] * 0.56], along: dir[0] ? 'z' : 'x', lit, out: dir })
      }
    }
    // The door: a gap two blocks high at the ground in an outer wall, a block over it.
    let door: { p: V3; dir: [number, number] } | null = null
    for (let x = x0; x <= x1 && !door; x++)
      for (let z = z0; z <= z1 && !door; z++) {
        if (has(x, 0, z) || has(x, 1, z) || !has(x, 2, z)) continue
        const wallX = has(x - 1, 0, z) && has(x + 1, 0, z)
        const wallZ = has(x, 0, z - 1) && has(x, 0, z + 1)
        if (!wallX && !wallZ) continue
        for (const dir of (wallX ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0]]) as [number, number][])
          if (outward(x, 0, z, dir)) {
            door = { p: [x + 0.5 + dir[0] * 0.5, 0, z + 0.5 + dir[1] * 0.5], dir }
            break
          }
      }
    // A bit of flat roof at the top for the tank and the dish (the highest blocks with nothing over them).
    const roof = blocks.filter(([x, y, z]) => y === top && !has(x, y + 1, z))
    const corner = roof.reduce<Block | null>((a, b) => (!a || b[0] + b[2] < a[0] + a[2] ? b : a), null)
    const far = roof.reduce<Block | null>((a, b) => (!a || b[0] + b[2] > a[0] + a[2] ? b : a), null)
    // The air conditioner: on the outer wall at the back, a block up.
    let ac: { p: V3; r: number } | null = null
    for (const [x, y, z] of blocks) {
      // (A wall of the house, the roof over it: not the fence.)
      if (y !== 1 || ac || !blocks.some(([bx, by, bz]) => bx === x && bz === z && by > 1)) continue
      for (const dir of DIRS)
        if (outward(x, y, z, dir) && (!door || Math.hypot(x - door.p[0], z - door.p[2]) > 3)) {
          ac = { p: [x + 0.5 + dir[0] * 0.75, y + 0.6, z + 0.5 + dir[1] * 0.75], r: Math.atan2(dir[0], dir[1]) }
          break
        }
    }
    // The slabs' edges: a white band standing out a little all round the house at each floor and at
    // the roof, as the concrete edge of an Abidjan house's slab is (one merged mesh, one draw).
    const bands: THREE.BufferGeometry[] = []
    for (const [x, y, z] of blocks) {
      if (y % 4 !== 3) continue
      for (const dir of DIRS) {
        if (has(x + dir[0], y, z + dir[1]) || !outward(x, y, z, dir)) continue
        const g = new THREE.BoxGeometry(dir[0] ? 0.14 : 1.001, 0.3, dir[0] ? 1.001 : 0.14)
        g.translate(x + 0.5 + dir[0] * 0.56, y + 0.86, z + 0.5 + dir[1] * 0.56)
        bands.push(g)
      }
    }
    const ledge = bands.length ? mergeGeometries(bands) : null
    bands.forEach((g) => g.dispose())
    return { bars, door, corner, far, ac, top, ledge }
  }, [blocks])
  useEffect(() => () => d?.ledge?.dispose(), [d])
  if (!d) return null
  return (
    <group>
      {d.ledge && <mesh geometry={d.ledge} material={white} castShadow receiveShadow />}
      {/* The bars over each window: four uprights and a rail */}
      {d.bars.map((b, i) => (
        <group key={i} position={b.p}>
          {[-0.36, -0.12, 0.12, 0.36].map((o) => (
            <B key={o} p={b.along === 'z' ? [0, 0, o] : [o, 0, 0]} s={[0.04, 0.9, 0.04]} m={iron} />
          ))}
          <B p={[0, 0, 0]} s={b.along === 'z' ? [0.04, 0.04, 0.92] : [0.92, 0.04, 0.04]} m={iron} />
          {/* At night, the room lit behind the glass */}
          {night && b.lit && <B p={[-b.out[0] * 0.035, 0, -b.out[1] * 0.035]} s={b.along === 'z' ? [0.01, 0.94, 0.94] : [0.94, 0.94, 0.01]} m={roomLight} />}
          {/* The sill under it */}
          <B p={[0, -0.5, 0]} s={b.along === 'z' ? [0.16, 0.06, 1.02] : [1.02, 0.06, 0.16]} m={white} />
        </group>
      ))}
      {/* The door: its step, the awning, the lamp, the number, two pots */}
      {d.door && (
        <group position={d.door.p} rotation={[0, Math.atan2(d.door.dir[0], d.door.dir[1]), 0]}>
          <B p={[0, 0.07, 0.35]} s={[1.6, 0.14, 0.7]} m={concrete} />
          <B p={[0, 2.25, 0.45]} s={[1.6, 0.06, 0.9]} m={tin} r={[0.18, 0, 0]} />
          <B p={[0.75, 1.9, 0.06]} s={[0.14, 0.2, 0.12]} m={night ? lampOn : lamp} />
          <B p={[-0.75, 1.7, 0.03]} s={[0.26, 0.18, 0.02]} m={plate} />
          <B p={[-0.75, 1.7, 0.045]} s={[0.12, 0.08, 0.01]} m={white} />
          {[-0.95, 0.95].map((x) => (
            <group key={x} position={[x, 0, 0.4]}>
              <mesh geometry={CYL} material={terracotta} position={[0, 0.2, 0]} scale={[0.34, 0.4, 0.34]} />
              <mesh geometry={CYL} material={leaf} position={[0, 0.55, 0]} scale={[0.42, 0.4, 0.42]} />
            </group>
          ))}
        </group>
      )}
      {/* The black polytank on the roof, on its stand */}
      {d.corner && (
        <group position={[d.corner[0] + 0.8, d.top + 1, d.corner[2] + 0.8]}>
          <B p={[0, 0.2, 0]} s={[1.2, 0.4, 1.2]} m={grey} />
          <mesh geometry={CYL} material={black} position={[0, 1.05, 0]} scale={[1.1, 1.3, 1.1]} />
          <mesh geometry={CYL} material={black} position={[0, 1.76, 0]} scale={[0.4, 0.12, 0.4]} />
        </group>
      )}
      {/* A satellite dish at the other end */}
      {d.far && d.far !== d.corner && (
        <group position={[d.far[0] + 0.5, d.top + 1, d.far[2] + 0.5]}>
          <B p={[0, 0.5, 0]} s={[0.08, 1, 0.08]} m={grey} />
          <mesh geometry={CYL} material={white} position={[0.15, 1.1, 0]} rotation={[0, 0, 1.1]} scale={[1.1, 0.08, 1.1]} />
          <B p={[0.55, 1.3, 0]} s={[0.5, 0.04, 0.04]} m={grey} r={[0, 0, -0.45]} />
        </group>
      )}
      {/* The air conditioner's box on the wall */}
      {d.ac && (
        <group position={d.ac.p} rotation={[0, d.ac.r, 0]}>
          <B p={[0, 0, 0]} s={[0.9, 0.6, 0.35]} m={white} />
          <mesh geometry={CYL} material={grey} position={[0.15, 0, 0.18]} rotation={[Math.PI / 2, 0, 0]} scale={[0.42, 0.02, 0.42]} />
        </group>
      )}
    </group>
  )
}
