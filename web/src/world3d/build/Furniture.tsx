import { useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { Furniture, Piece } from '../../lib/types'

// The furniture in a house one built (game/house.go), in the blocks' style:
// a few boxes each, flat colours. A piece stands on its corner cell, W × D
// cells wide (swapped when turned), in metres like the blocks.

const mats = new Map<string, THREE.MeshLambertMaterial>()
const mat = (c: string) => {
  let m = mats.get(c)
  if (!m) mats.set(c, (m = new THREE.MeshLambertMaterial({ color: c })))
  return m
}
const box = new THREE.BoxGeometry(1, 1, 1)
const cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 12)

/** Glass (a little blue, seen through) and what glows (a screen, a bulb): not lit by the room. */
const glassMat = new THREE.MeshLambertMaterial({ color: '#cfe8f2', transparent: true, opacity: 0.28, depthWrite: false })
const glows = new Map<string, THREE.MeshBasicMaterial>()
const glow = (c: string) => {
  let m = glows.get(c)
  if (!m) glows.set(c, (m = new THREE.MeshBasicMaterial({ color: c, toneMapped: false })))
  return m
}

/** A box: [x, y, z] of its centre and [w, h, d], in the piece's own metres. */
function B({ at, size, c, round, glass, lit, turn }: { at: [number, number, number]; size: [number, number, number]; c: string; round?: boolean; glass?: boolean; lit?: boolean; turn?: [number, number, number] }) {
  return <mesh geometry={round ? cyl : box} material={glass ? glassMat : lit ? glow(c) : mat(c)} position={at} scale={size} rotation={turn} castShadow={!glass && !lit} receiveShadow={!glass && !lit} />
}

const GOLD = '#d4a73a'
const CHROME = '#c9d1d8'
const VEIN = '#b9b2a8'

/** The aquarium's fish, swimming to and fro in the tank. */
function Fish({ w }: { w: number }) {
  const g = useRef<THREE.Group>(null)
  const fish = useMemo(() => ['#ff8c1a', '#ffd43b', '#4dabf7', '#ff6b9a', '#ffffff', '#ff8c1a'].map((c, i) => ({ c, y: 0.95 + (i % 3) * 0.17, z: 0.18 + ((i * 7) % 4) * 0.05, speed: 0.25 + (i % 4) * 0.08, ph: i * 1.7 })), [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    g.current?.children.forEach((m, i) => {
      const f = fish[i]
      const k = Math.sin(t * f.speed + f.ph)
      m.position.set(w / 2 + k * (w / 2 - 0.25), f.y + Math.sin(t * 1.3 + f.ph) * 0.03, f.z)
      m.rotation.y = Math.cos(t * f.speed + f.ph) > 0 ? 0 : Math.PI
    })
  })
  return (
    <group ref={g}>
      {fish.map((f, i) => (
        <group key={i}>
          <mesh geometry={box} material={mat(f.c)} scale={[0.09, 0.05, 0.025]} />
          <mesh geometry={box} material={mat(f.c)} position={[-0.06, 0, 0]} scale={[0.03, 0.05, 0.01]} />
        </group>
      ))}
    </group>
  )
}

/** One piece, drawn in a w × d footprint (before turning). */
function Model({ id, color, w, d }: { id: string; color: string; w: number; d: number }) {
  const cx = w / 2
  const cz = d / 2
  switch (id) {
    case 'escalier': // four steps up to the floor above, from the front (the foot, +z) to the back, a rail on one side
      return (
        <>
          {[0, 1, 2, 3].map((k) => (
            <group key={k}>
              <B at={[cx, (k + 1) / 2, d - 0.5 - k]} size={[0.96, k + 1, 0.98]} c={color} />
              <B at={[cx, k + 1 + 0.02, d - 0.5 - k]} size={[0.98, 0.05, 1]} c="#8a5a32" />
            </group>
          ))}
          {[0, 1, 2, 3, 4].map((k) => (
            <B key={`p${k}`} at={[0.06, Math.min(k, 3.5) + 0.55 + 0.45, d - k]} size={[0.06, 1, 0.06]} c="#3d4350" />
          ))}
          <mesh position={[0.06, 2.95, d / 2]} rotation={[Math.atan2(4, d), 0, 0]} material={mat('#3d4350')} scale={[0.07, 0.07, Math.hypot(4, d)]} geometry={box} />
        </>
      )
    case 'natte': // a woven mat on the floor
      return (
        <>
          <B at={[cx, 0.02, cz]} size={[0.9, 0.04, 1.9]} c={color} />
          {[0.3, 0.7, 1.1, 1.5].map((z) => (
            <B key={z} at={[cx, 0.045, z + 0.05]} size={[0.9, 0.01, 0.06]} c="#b38a45" />
          ))}
        </>
      )
    case 'lit': // a double bed: frame, mattress, sheet, two pillows
      return (
        <>
          <B at={[cx, 0.2, cz]} size={[1.9, 0.3, 1.9]} c="#6b4426" />
          <B at={[cx, 0.42, cz + 0.05]} size={[1.8, 0.16, 1.75]} c="#f2efe8" />
          <B at={[cx, 0.52, cz + 0.3]} size={[1.82, 0.06, 1.2]} c={color} />
          <B at={[cx - 0.45, 0.56, 0.3]} size={[0.7, 0.12, 0.35]} c="#ffffff" />
          <B at={[cx + 0.45, 0.56, 0.3]} size={[0.7, 0.12, 0.35]} c="#ffffff" />
          <B at={[cx, 0.6, 0.06]} size={[1.9, 0.9, 0.1]} c="#5a3820" />
        </>
      )
    case 'chaises': // two white plastic chairs, stacked as they are in every cour
      return (
        <>
          {[0, 0.12].map((y) => (
            <group key={y} position={[0, y, 0]}>
              <B at={[cx, 0.42, cz]} size={[0.5, 0.05, 0.5]} c={color} />
              <B at={[cx, 0.72, cz - 0.23]} size={[0.5, 0.55, 0.05]} c={color} />
              {[
                [-0.21, -0.21],
                [0.21, -0.21],
                [-0.21, 0.21],
                [0.21, 0.21],
              ].map(([x, z]) => (
                <B key={`${x}${z}`} at={[cx + x, 0.2, cz + z]} size={[0.05, 0.42, 0.05]} c={color} />
              ))}
            </group>
          ))}
        </>
      )
    case 'table': // a dining table with its wax tablecloth
      return (
        <>
          <B at={[cx, 0.76, cz]} size={[0.85, 0.06, 1.7]} c={color} />
          <B at={[cx, 0.795, cz]} size={[0.9, 0.01, 1.4]} c="#e0702a" />
          {[
            [-0.36, -0.75],
            [0.36, -0.75],
            [-0.36, 0.75],
            [0.36, 0.75],
          ].map(([x, z]) => (
            <B key={`${x}${z}`} at={[cx + x, 0.37, cz + z]} size={[0.07, 0.74, 0.07]} c="#5a3820" />
          ))}
        </>
      )
    case 'canape': // a sofa
      return (
        <>
          <B at={[cx, 0.25, cz]} size={[1.9, 0.4, 0.85]} c={color} />
          <B at={[cx, 0.6, 0.12]} size={[1.9, 0.6, 0.22]} c={color} />
          <B at={[0.1, 0.5, cz]} size={[0.2, 0.4, 0.85]} c={color} />
          <B at={[w - 0.1, 0.5, cz]} size={[0.2, 0.4, 0.85]} c={color} />
          <B at={[cx - 0.45, 0.5, cz + 0.05]} size={[0.8, 0.12, 0.6]} c="#9a6aa8" />
          <B at={[cx + 0.45, 0.5, cz + 0.05]} size={[0.8, 0.12, 0.6]} c="#9a6aa8" />
        </>
      )
    case 'gaziniere': // a table-top cooker, the gas bottle beside it
      return (
        <>
          <B at={[cx, 0.4, cz]} size={[0.8, 0.8, 0.6]} c="#8a6a4a" />
          <B at={[cx - 0.1, 0.86, cz]} size={[0.55, 0.12, 0.45]} c={color} />
          <B at={[cx - 0.22, 0.93, cz]} size={[0.14, 0.02, 0.14]} c="#222222" round />
          <B at={[cx + 0.02, 0.93, cz]} size={[0.14, 0.02, 0.14]} c="#222222" round />
          <B at={[cx + 0.3, 0.98, cz - 0.05]} size={[0.24, 0.18, 0.24]} c="#4a4a4a" round />
          <B at={[cx + 0.3, 0.2, cz + 0.1]} size={[0.28, 0.4, 0.28]} c="#2f7fd0" round />
        </>
      )
    case 'frigo':
      return (
        <>
          <B at={[cx, 0.85, cz]} size={[0.7, 1.7, 0.7]} c={color} />
          <B at={[cx, 1.2, cz + 0.36]} size={[0.68, 0.02, 0.02]} c="#c7ccd1" />
          <B at={[cx + 0.25, 1.45, cz + 0.37]} size={[0.04, 0.3, 0.04]} c="#9aa1a8" />
          <B at={[cx + 0.25, 0.75, cz + 0.37]} size={[0.04, 0.4, 0.04]} c="#9aa1a8" />
        </>
      )
    case 'tele': // the TV on its little cabinet
      return (
        <>
          <B at={[cx, 0.25, cz]} size={[0.9, 0.5, 0.45]} c="#6b4426" />
          <B at={[cx, 0.53, cz]} size={[0.2, 0.06, 0.15]} c="#111111" />
          <B at={[cx, 0.85, cz]} size={[0.95, 0.56, 0.06]} c={color} />
          <B at={[cx, 0.85, cz + 0.035]} size={[0.86, 0.48, 0.01]} c="#2a5a8a" />
        </>
      )
    case 'ventilo': // a standing fan
      return (
        <>
          <B at={[cx, 0.03, cz]} size={[0.45, 0.06, 0.45]} c="#e9ecef" round />
          <B at={[cx, 0.65, cz]} size={[0.06, 1.2, 0.06]} c="#e9ecef" />
          <B at={[cx, 1.35, cz + 0.05]} size={[0.62, 0.62, 0.12]} c={color} round />
          <B at={[cx, 1.35, cz + 0.12]} size={[0.12, 0.12, 0.04]} c="#e9ecef" round />
        </>
      )
    case 'armoire':
      return (
        <>
          <B at={[cx, 0.95, cz]} size={[0.9, 1.9, 0.6]} c={color} />
          <B at={[cx, 0.95, cz + 0.305]} size={[0.02, 1.8, 0.01]} c="#3a2412" />
          <B at={[cx - 0.08, 1.0, cz + 0.32]} size={[0.04, 0.15, 0.03]} c="#d9b26b" />
          <B at={[cx + 0.08, 1.0, cz + 0.32]} size={[0.04, 0.15, 0.03]} c="#d9b26b" />
        </>
      )
    case 'douche': // tiled tray, the pipe and the head, the blue bucket
      return (
        <>
          <B at={[cx, 0.04, cz]} size={[0.95, 0.08, 0.95]} c="#e9e4d8" />
          <B at={[cx, 1.0, 0.06]} size={[0.06, 1.9, 0.06]} c="#b8c0c6" />
          <B at={[cx, 1.95, 0.2]} size={[0.25, 0.05, 0.25]} c="#b8c0c6" round />
          <B at={[cx + 0.28, 0.22, cz + 0.2]} size={[0.32, 0.36, 0.32]} c={color} round />
        </>
      )
    case 'wc': // the bowl and its tank
      return (
        <>
          <B at={[cx, 0.2, cz + 0.08]} size={[0.4, 0.4, 0.5]} c={color} round />
          <B at={[cx, 0.42, cz + 0.08]} size={[0.44, 0.04, 0.54]} c="#f4f4f4" round />
          <B at={[cx, 0.6, 0.15]} size={[0.45, 0.4, 0.2]} c={color} />
        </>
      )
    case 'lavabo': // a washbasin on its cabinet, the tap, the mirror above, a glass with the toothbrushes
      return (
        <>
          <B at={[cx, 0.4, 0.27]} size={[0.62, 0.8, 0.46]} c="#e9e4dc" />
          <B at={[cx, 0.83, 0.27]} size={[0.66, 0.06, 0.5]} c={color} />
          <B at={[cx, 0.85, 0.3]} size={[0.42, 0.03, 0.3]} c="#d7dde2" />
          <B at={[cx, 0.95, 0.08]} size={[0.04, 0.18, 0.04]} c={CHROME} />
          <B at={[cx, 1.03, 0.14]} size={[0.04, 0.03, 0.14]} c={CHROME} />
          <B at={[cx - 0.24, 0.92, 0.12]} size={[0.07, 0.12, 0.07]} c="#9fd3e8" round />
          <B at={[cx - 0.25, 1.0, 0.12]} size={[0.012, 0.12, 0.012]} c="#ff6b6b" />
          <B at={[cx - 0.23, 1.0, 0.11]} size={[0.012, 0.12, 0.012]} c="#4dabf7" />
          <B at={[cx, 1.5, 0.04]} size={[0.62, 0.78, 0.04]} c="#8a5a32" />
          <B at={[cx, 1.5, 0.065]} size={[0.54, 0.7, 0.01]} c="#bfe3f2" />
        </>
      )
    case 'console': // the screen on its low cabinet, the console and its two controllers, a blue light
      return (
        <>
          <B at={[cx, 0.22, 0.3]} size={[0.92, 0.44, 0.44]} c="#2b2d3a" />
          <B at={[cx, 0.12, 0.525]} size={[0.86, 0.02, 0.01]} c="#3ba7ff" lit />
          <B at={[cx, 0.47, 0.25]} size={[0.16, 0.05, 0.12]} c="#111111" />
          <B at={[cx, 0.82, 0.22]} size={[0.92, 0.54, 0.05]} c={color} />
          <B at={[cx, 0.82, 0.248]} size={[0.84, 0.47, 0.01]} c="#2a5a8a" />
          <B at={[cx - 0.3, 0.5, 0.36]} size={[0.24, 0.07, 0.2]} c="#f1f3f5" />
          <B at={[cx - 0.3, 0.54, 0.36]} size={[0.2, 0.01, 0.16]} c="#3ba7ff" lit />
          {[0.16, 0.34].map((x) => (
            <group key={x} position={[cx + x, 0.47, 0.42]}>
              <B at={[0, 0, 0]} size={[0.13, 0.03, 0.07]} c="#1b1b1f" />
              <B at={[-0.05, 0, 0.03]} size={[0.04, 0.03, 0.05]} c="#1b1b1f" />
              <B at={[0.05, 0, 0.03]} size={[0.04, 0.03, 0.05]} c="#1b1b1f" />
            </group>
          ))}
        </>
      )
    case 'lit-coffre': // an upholstered storage bed: the tall buttoned headboard, the duvet, the cushions
      return (
        <>
          <B at={[cx, 0.2, cz + 0.02]} size={[1.94, 0.36, 1.86]} c={color} />
          <B at={[cx, 0.44, cz + 0.06]} size={[1.84, 0.16, 1.74]} c="#f8f6f1" />
          <B at={[cx, 0.53, cz + 0.32]} size={[1.88, 0.06, 1.24]} c="#f2e9da" />
          <B at={[cx, 0.535, cz + 0.85]} size={[1.9, 0.07, 0.25]} c="#a88b63" />
          <B at={[cx, 0.75, 0.08]} size={[2, 1.2, 0.14]} c={color} />
          {[-0.6, -0.2, 0.2, 0.6].flatMap((x) => [0.55, 0.85, 1.15].map((y) => <B key={`${x}${y}`} at={[cx + x, y, 0.16]} size={[0.04, 0.04, 0.02]} c="#a88b63" round turn={[Math.PI / 2, 0, 0]} />))}
          <B at={[cx - 0.45, 0.62, 0.32]} size={[0.72, 0.16, 0.3]} c="#ffffff" />
          <B at={[cx + 0.45, 0.62, 0.32]} size={[0.72, 0.16, 0.3]} c="#ffffff" />
          <B at={[cx, 0.64, 0.48]} size={[0.5, 0.18, 0.14]} c="#c9a227" />
        </>
      )
    case 'canape-velours': // a three-seater in velvet on gold legs, its cushions and two in mustard
      return (
        <>
          <B at={[cx, 0.32, cz + 0.02]} size={[2.85, 0.28, 0.82]} c={color} />
          <B at={[cx, 0.68, 0.14]} size={[2.85, 0.5, 0.24]} c={color} />
          <B at={[0.12, 0.55, cz]} size={[0.24, 0.3, 0.84]} c={color} />
          <B at={[w - 0.12, 0.55, cz]} size={[0.24, 0.3, 0.84]} c={color} />
          {[-0.82, 0, 0.82].map((x) => (
            <B key={x} at={[cx + x, 0.5, cz + 0.08]} size={[0.8, 0.1, 0.62]} c="#25827c" />
          ))}
          <B at={[0.5, 0.66, 0.34]} size={[0.36, 0.34, 0.12]} c="#e0a100" turn={[-0.2, 0.2, 0]} />
          <B at={[w - 0.5, 0.66, 0.34]} size={[0.36, 0.34, 0.12]} c="#e0a100" turn={[-0.2, -0.2, 0]} />
          {[0.18, w - 0.18].flatMap((x) => [0.12, d - 0.12].map((z) => <B key={`${x}${z}`} at={[x, 0.09, z]} size={[0.05, 0.18, 0.05]} c={GOLD} />))}
        </>
      )
    case 'tele-led': // a long walnut cabinet, the slim 55-inch on its feet, a soundbar
      return (
        <>
          <B at={[cx, 0.22, 0.28]} size={[1.9, 0.44, 0.44]} c="#5c3a1e" />
          <B at={[cx - 0.48, 0.22, 0.505]} size={[0.9, 0.36, 0.01]} c="#6e4626" />
          <B at={[cx + 0.48, 0.22, 0.505]} size={[0.9, 0.36, 0.01]} c="#6e4626" />
          <B at={[cx, 0.48, 0.34]} size={[0.8, 0.06, 0.08]} c="#1b1b1f" />
          <B at={[cx, 0.95, 0.22]} size={[1.34, 0.78, 0.04]} c={color} />
          <B at={[cx, 0.95, 0.243]} size={[1.28, 0.72, 0.01]} c="#244a76" />
          <B at={[cx - 0.5, 0.5, 0.22]} size={[0.04, 0.08, 0.16]} c={color} />
          <B at={[cx + 0.5, 0.5, 0.22]} size={[0.04, 0.08, 0.16]} c={color} />
        </>
      )
    case 'bibliotheque': // a wooden bookcase, its shelves full of books and a few things
      return (
        <>
          <B at={[cx, 0.95, 0.2]} size={[1.9, 1.9, 0.04]} c={color} />
          <B at={[0.06, 0.95, 0.22]} size={[0.06, 1.9, 0.4]} c={color} />
          <B at={[w - 0.06, 0.95, 0.22]} size={[0.06, 1.9, 0.4]} c={color} />
          {[0.05, 0.5, 0.95, 1.4, 1.87].map((y) => (
            <B key={y} at={[cx, y, 0.22]} size={[1.84, 0.04, 0.4]} c={color} />
          ))}
          {[0.07, 0.52, 0.97, 1.42].flatMap((y, row) =>
            [...Array(9)].map((_, k) => {
              const h = 0.26 + ((k * 5 + row * 3) % 4) * 0.035
              const books = ['#8a1c1c', '#1c4f8a', '#e0a100', '#2f6b3a', '#f1f3f5', '#5a2a6b']
              return k === 6 + (row % 2) ? null : <B key={`${y}${k}`} at={[0.2 + k * 0.19, y + h / 2, 0.24]} size={[0.15, h, 0.3]} c={books[(k + row) % books.length]} />
            }),
          )}
          <B at={[1.4, 1.5, 0.25]} size={[0.14, 0.14, 0.14]} c={GOLD} round />
        </>
      )
    case 'tapis': // a hand-woven rug: the red ground, the border, the motifs
      return (
        <>
          <B at={[cx, 0.01, cz]} size={[1.9, 0.02, 1.9]} c={color} />
          <B at={[cx, 0.015, cz]} size={[1.7, 0.02, 1.7]} c="#e8d5a8" />
          <B at={[cx, 0.02, cz]} size={[1.5, 0.02, 1.5]} c={color} />
          {[-0.45, 0, 0.45].flatMap((x) => [-0.45, 0, 0.45].map((z) => <B key={`${x}${z}`} at={[cx + x, 0.025, cz + z]} size={[0.22, 0.02, 0.22]} c={(x + z) % 0.9 === 0 ? '#1f1a17' : '#e0a100'} turn={[0, Math.PI / 4, 0]} />))}
        </>
      )
    case 'plante': // a big plant in its terracotta pot
      return (
        <>
          <B at={[cx, 0.22, cz]} size={[0.46, 0.44, 0.46]} c="#b8562f" round />
          <B at={[cx, 0.45, cz]} size={[0.42, 0.03, 0.42]} c="#4a3420" round />
          <B at={[cx, 0.85, cz]} size={[0.05, 0.8, 0.05]} c="#5c3a1e" />
          {[0, 1, 2, 3, 4, 5, 6].map((k) => {
            const a = k * 0.9
            const y = 0.95 + (k % 3) * 0.28
            return <B key={k} at={[cx + Math.cos(a) * 0.22, y, cz + Math.sin(a) * 0.22]} size={[0.5, 0.03, 0.2]} c={k % 2 ? color : '#56a84a'} turn={[0, -a, 0.5]} />
          })}
        </>
      )
    case 'lampadaire': // a gold floor lamp, its shade, lit
      return (
        <>
          <B at={[cx, 0.02, cz]} size={[0.36, 0.04, 0.36]} c={color} round />
          <B at={[cx, 0.85, cz]} size={[0.035, 1.66, 0.035]} c={color} />
          <B at={[cx, 1.62, cz]} size={[0.42, 0.34, 0.42]} c="#f6ecd2" round />
          <B at={[cx, 1.52, cz]} size={[0.12, 0.1, 0.12]} c="#fff1c1" lit round />
        </>
      )
    case 'lit-baldaquin': // a king-size canopy bed: four turned posts, the frame on top, the veils, a deep red duvet with gold
      return (
        <>
          <B at={[cx, 0.22, cz]} size={[1.9, 0.34, 1.9]} c="#3a2214" />
          <B at={[cx, 0.46, cz + 0.04]} size={[1.82, 0.18, 1.78]} c="#fbf8f2" />
          <B at={[cx, 0.57, cz + 0.32]} size={[1.86, 0.07, 1.24]} c={color} />
          <B at={[cx, 0.575, cz + 0.92]} size={[1.88, 0.075, 0.06]} c={GOLD} />
          <B at={[cx, 0.9, 0.07]} size={[1.92, 1.0, 0.12]} c="#3a2214" />
          <B at={[cx, 1.0, 0.135]} size={[1.5, 0.6, 0.02]} c={color} />
          {[-0.62, -0.2, 0.2, 0.62].map((x) => (
            <B key={x} at={[cx + x, 0.66, 0.32]} size={[0.38, 0.2, 0.22]} c={x % 0.4 ? '#ffffff' : GOLD} />
          ))}
          {[0.07, w - 0.07].flatMap((x) => [0.07, d - 0.07].map((z) => <B key={`${x}${z}`} at={[x, 1.0, z]} size={[0.09, 2.0, 0.09]} c="#3a2214" round />))}
          <B at={[cx, 1.98, 0.07]} size={[1.96, 0.08, 0.08]} c="#3a2214" />
          <B at={[cx, 1.98, d - 0.07]} size={[1.96, 0.08, 0.08]} c="#3a2214" />
          <B at={[0.07, 1.98, cz]} size={[0.08, 0.08, 1.96]} c="#3a2214" />
          <B at={[w - 0.07, 1.98, cz]} size={[0.08, 0.08, 1.96]} c="#3a2214" />
          <B at={[0.07, 1.3, cz]} size={[0.02, 1.3, 1.8]} c="#ffffff" glass />
          <B at={[w - 0.07, 1.3, cz]} size={[0.02, 1.3, 1.8]} c="#ffffff" glass />
        </>
      )
    case 'dressing': // a glass-fronted dressing, lit inside: the clothes hanging, the shoes, the drawers
      return (
        <>
          <B at={[cx, 0.97, 0.06]} size={[1.94, 1.94, 0.04]} c={color} />
          <B at={[0.04, 0.97, 0.3]} size={[0.06, 1.94, 0.56]} c={color} />
          <B at={[w - 0.04, 0.97, 0.3]} size={[0.06, 1.94, 0.56]} c={color} />
          <B at={[cx, 1.92, 0.3]} size={[1.94, 0.06, 0.56]} c={color} />
          <B at={[cx, 0.2, 0.3]} size={[1.9, 0.4, 0.54]} c="#3a3a42" />
          {[0.5, 1.5].map((x) => (
            <B key={x} at={[x, 0.2, 0.575]} size={[0.3, 0.03, 0.02]} c={GOLD} />
          ))}
          <B at={[cx, 1.86, 0.3]} size={[1.84, 0.02, 0.02]} c="#fff1c1" lit />
          <B at={[cx, 1.75, 0.3]} size={[1.8, 0.02, 0.02]} c={CHROME} />
          {[...Array(10)].map((_, k) => (
            <B key={k} at={[0.2 + k * 0.17, 1.28, 0.3]} size={[0.12, 0.85 - (k % 3) * 0.15, 0.36]} c={['#f1f3f5', '#1c4f8a', '#b0412e', '#e0a100', '#2b2b30', '#e8c3d0'][k % 6]} />
          ))}
          {[0.3, 0.7, 1.1, 1.5].map((x) => (
            <B key={x} at={[x, 0.45, 0.32]} size={[0.24, 0.08, 0.3]} c={x > 1 ? '#8a1c1c' : '#f1f3f5'} />
          ))}
          <B at={[cx, 1.08, 0.585]} size={[1.92, 1.66, 0.02]} c="#ffffff" glass />
        </>
      )
    case 'clim': // a column air-conditioner: the grilles, the little blue display
      return (
        <>
          <B at={[cx, 0.9, cz]} size={[0.46, 1.8, 0.34]} c={color} />
          {[1.2, 1.3, 1.4, 1.5, 1.6].map((y) => (
            <B key={y} at={[cx, y, cz + 0.172]} size={[0.38, 0.03, 0.01]} c="#9aa1a8" />
          ))}
          <B at={[cx, 0.5, cz + 0.172]} size={[0.36, 0.5, 0.01]} c="#dde3e8" />
          <B at={[cx, 1.0, cz + 0.175]} size={[0.12, 0.05, 0.01]} c="#3ba7ff" lit />
        </>
      )
    case 'canape-cuir': // a leather corner sofa: along the back, and the chaise longue coming forward on the right
      return (
        <>
          <B at={[cx, 0.24, 0.5]} size={[2.9, 0.32, 0.86]} c={color} />
          <B at={[cx, 0.62, 0.14]} size={[2.9, 0.48, 0.24]} c={color} />
          <B at={[w - 0.47, 0.24, 1.3]} size={[0.86, 0.32, 1.36]} c={color} />
          <B at={[w - 0.08, 0.55, 1.3]} size={[0.16, 0.3, 1.36]} c={color} />
          <B at={[0.1, 0.5, 0.5]} size={[0.2, 0.3, 0.86]} c={color} />
          {[-1.0, -0.33, 0.33].map((x) => (
            <B key={x} at={[cx + x, 0.45, 0.55]} size={[0.64, 0.1, 0.66]} c="#f4efe6" />
          ))}
          <B at={[w - 0.5, 0.45, 1.25]} size={[0.66, 0.1, 1.2]} c="#f4efe6" />
          <B at={[0.55, 0.62, 0.33]} size={[0.38, 0.36, 0.12]} c="#1f1a17" turn={[-0.2, 0.2, 0]} />
          <B at={[w - 0.5, 0.62, 0.33]} size={[0.38, 0.36, 0.12]} c="#c9a227" turn={[-0.2, -0.2, 0]} />
          {[0.15, w - 0.15].map((x) => (
            <B key={x} at={[x, 0.04, 0.12]} size={[0.06, 0.08, 0.06]} c="#2b2b30" />
          ))}
        </>
      )
    case 'tele-geante': // an 85-inch screen on the wall over a floating cabinet, the soundbar
      return (
        <>
          <B at={[cx, 0.42, 0.22]} size={[1.94, 0.3, 0.38]} c="#1f1f24" />
          <B at={[cx, 0.29, 0.415]} size={[1.9, 0.02, 0.01]} c="#fff1c1" lit />
          <B at={[cx, 0.62, 0.3]} size={[1.1, 0.08, 0.1]} c="#2b2b30" />
          <B at={[cx, 1.35, 0.06]} size={[1.92, 1.1, 0.05]} c={color} />
          <B at={[cx, 1.35, 0.088]} size={[1.86, 1.04, 0.01]} c="#1d3f66" />
        </>
      )
    case 'table-marbre': // a marble table on two gold feet, three chairs each side
      return (
        <>
          <B at={[cx, 0.76, cz]} size={[1.0, 0.06, 2.6]} c={color} />
          {[-0.8, -0.2, 0.5, 1.0].map((z, k) => (
            <B key={z} at={[cx + (k % 2 ? 0.2 : -0.15), 0.792, cz + z]} size={[0.5, 0.005, 0.02]} c={VEIN} turn={[0, 0.5 - k * 0.3, 0]} />
          ))}
          {[cz - 0.75, cz + 0.75].map((z) => (
            <group key={z}>
              <B at={[cx, 0.38, z]} size={[0.16, 0.7, 0.16]} c={GOLD} />
              <B at={[cx, 0.03, z]} size={[0.6, 0.06, 0.3]} c={GOLD} />
            </group>
          ))}
          {[-0.85, 0, 0.85].flatMap((z) =>
            [-1, 1].map((sd) => (
              <group key={`${z}${sd}`} position={[cx + sd * 0.75, 0, cz + z]} rotation={[0, (-sd * Math.PI) / 2, 0]}>
                <B at={[0, 0.46, 0]} size={[0.44, 0.08, 0.44]} c="#f4efe6" />
                <B at={[0, 0.78, -0.2]} size={[0.44, 0.6, 0.06]} c="#f4efe6" />
                <B at={[0, 0.21, 0]} size={[0.05, 0.42, 0.05]} c={GOLD} />
              </group>
            )),
          )}
        </>
      )
    case 'cuisine-ilot': // a fitted kitchen: the cabinets, the granite top, the hob, the sink, the oven
      return (
        <>
          <B at={[cx, 0.43, 0.3]} size={[2.94, 0.86, 0.58]} c={color} />
          <B at={[cx, 0.89, 0.3]} size={[2.98, 0.05, 0.62]} c="#1f1f24" />
          {[0.5, 1.5, 2.5].map((x) => (
            <B key={x} at={[x, 0.6, 0.6]} size={[0.3, 0.02, 0.02]} c={CHROME} />
          ))}
          <B at={[cx, 0.92, 0.32]} size={[0.6, 0.01, 0.46]} c="#0b0b0e" />
          {[-0.15, 0.15].flatMap((x) => [-0.1, 0.12].map((z) => <B key={`${x}${z}`} at={[cx + x, 0.926, 0.32 + z]} size={[0.16, 0.005, 0.16]} c="#ff6b4a" round lit />))}
          <B at={[cx, 0.42, 0.595]} size={[0.6, 0.5, 0.01]} c="#2b2b30" />
          <B at={[cx, 0.42, 0.6]} size={[0.5, 0.32, 0.01]} c="#ff9a3c" lit />
          <B at={[0.55, 0.92, 0.32]} size={[0.56, 0.02, 0.4]} c="#9aa1a8" />
          <B at={[0.55, 1.02, 0.1]} size={[0.04, 0.2, 0.04]} c={CHROME} />
          <B at={[2.4, 1.0, 0.3]} size={[0.24, 0.16, 0.24]} c="#d8dee4" round />
        </>
      )
    case 'frigo-americain': // a two-door stainless American fridge, the ice and water dispenser
      return (
        <>
          <B at={[cx, 0.92, cz]} size={[0.92, 1.84, 0.74]} c={color} />
          <B at={[cx, 0.92, cz + 0.372]} size={[0.01, 1.82, 0.01]} c="#7b838b" />
          <B at={[cx - 0.05, 1.05, cz + 0.39]} size={[0.03, 0.6, 0.03]} c="#e9ecef" />
          <B at={[cx + 0.05, 1.05, cz + 0.39]} size={[0.03, 0.6, 0.03]} c="#e9ecef" />
          <B at={[cx - 0.24, 1.15, cz + 0.375]} size={[0.24, 0.32, 0.01]} c="#3a3f45" />
          <B at={[cx - 0.24, 1.25, cz + 0.381]} size={[0.12, 0.05, 0.005]} c="#3ba7ff" lit />
        </>
      )
    case 'douche-italienne': // a walk-in shower: the stone floor, a glass panel, the rain head, a niche with bottles
      return (
        <>
          <B at={[cx, 0.015, cz]} size={[0.98, 0.03, 0.98]} c="#9aa1a8" />
          <B at={[cx, 0.032, cz]} size={[0.3, 0.005, 0.04]} c="#4a4f55" />
          <B at={[0.97, 1.0, cz]} size={[0.02, 1.96, 0.96]} c="#ffffff" glass />
          <B at={[0.97, 1.0, 0.02]} size={[0.04, 1.96, 0.04]} c={CHROME} />
          <B at={[cx, 1.6, 0.04]} size={[0.04, 0.8, 0.04]} c={CHROME} />
          <B at={[cx, 2.0, 0.22]} size={[0.04, 0.04, 0.4]} c={CHROME} />
          <B at={[cx, 1.97, 0.4]} size={[0.32, 0.03, 0.32]} c={CHROME} />
          <B at={[cx + 0.25, 1.1, 0.05]} size={[0.32, 0.36, 0.06]} c="#6b7178" />
          {[-0.08, 0.02, 0.1].map((x, k) => (
            <B key={x} at={[cx + 0.25 + x, 1.02, 0.08]} size={[0.06, 0.16 - k * 0.02, 0.05]} c={['#e0a100', '#f1f3f5', '#2f9e44'][k]} round />
          ))}
        </>
      )
    case 'baignoire': // a whirlpool bath set in its tiled surround, gold taps, the shower on the wall
      return (
        <>
          <B at={[cx, 0.27, cz]} size={[1.96, 0.54, 0.96]} c="#e9e4dc" />
          <B at={[cx, 0.5, cz]} size={[1.7, 0.1, 0.72]} c={color} />
          <B at={[cx, 0.47, cz]} size={[1.6, 0.04, 0.62]} c="#a5d8ff" glass />
          {[-0.5, 0, 0.5].map((x) => (
            <B key={x} at={[cx + x, 0.38, cz + 0.33]} size={[0.06, 0.06, 0.01]} c={CHROME} round turn={[Math.PI / 2, 0, 0]} />
          ))}
          <B at={[0.2, 0.62, cz]} size={[0.04, 0.12, 0.04]} c={GOLD} />
          <B at={[0.27, 0.68, cz]} size={[0.14, 0.03, 0.03]} c={GOLD} />
          <B at={[cx, 1.6, 0.04]} size={[0.04, 1.0, 0.04]} c={GOLD} />
          <B at={[cx, 2.0, 0.2]} size={[0.04, 0.04, 0.36]} c={GOLD} />
          <B at={[cx, 1.97, 0.36]} size={[0.28, 0.03, 0.28]} c={GOLD} round />
          <B at={[w - 0.2, 0.58, cz - 0.28]} size={[0.14, 0.08, 0.1]} c="#ffffff" />
        </>
      )
    case 'wc-design': // a wall-hung bowl and its chrome flush plate, the paper on its holder
      return (
        <>
          <B at={[cx, 0.55, 0.08]} size={[0.5, 1.1, 0.16]} c="#e9e4dc" />
          <B at={[cx, 0.95, 0.165]} size={[0.2, 0.13, 0.01]} c={CHROME} />
          <B at={[cx, 0.32, 0.4]} size={[0.38, 0.3, 0.52]} c={color} round />
          <B at={[cx, 0.48, 0.4]} size={[0.4, 0.03, 0.54]} c="#f1f3f5" round />
          <B at={[cx + 0.38, 0.65, 0.12]} size={[0.12, 0.12, 0.1]} c="#ffffff" round turn={[0, 0, Math.PI / 2]} />
          <B at={[cx + 0.38, 0.72, 0.1]} size={[0.16, 0.02, 0.02]} c={CHROME} />
        </>
      )
    case 'vasque-double': // a marble counter with two basins and gold taps, the lit mirror over it
      return (
        <>
          <B at={[cx, 0.42, 0.27]} size={[1.9, 0.62, 0.48]} c="#3a2a1e" />
          <B at={[cx, 0.79, 0.27]} size={[1.96, 0.08, 0.52]} c={color} />
          {[-0.45, 0.45].map((x) => (
            <group key={x}>
              <B at={[cx + x, 0.86, 0.3]} size={[0.42, 0.1, 0.32]} c="#ffffff" round />
              <B at={[cx + x, 0.98, 0.1]} size={[0.04, 0.2, 0.04]} c={GOLD} />
              <B at={[cx + x, 1.07, 0.16]} size={[0.04, 0.03, 0.14]} c={GOLD} />
            </group>
          ))}
          <B at={[cx - 0.3, 0.84, 0.35]} size={[0.5, 0.005, 0.02]} c={VEIN} turn={[0, 0.4, 0]} />
          <B at={[cx, 1.5, 0.04]} size={[1.8, 0.82, 0.04]} c="#1f1f24" />
          <B at={[cx, 1.5, 0.065]} size={[1.72, 0.74, 0.01]} c="#cdeaf5" />
          <B at={[cx, 1.93, 0.07]} size={[1.8, 0.03, 0.03]} c="#fff1c1" lit />
        </>
      )
    case 'aquarium': // a tropical tank on its cabinet: sand, plants, the fish swimming, the light on top
      return (
        <>
          <B at={[cx, 0.35, cz]} size={[1.9, 0.7, 0.5]} c="#1f1f24" />
          <B at={[cx, 0.74, cz]} size={[1.9, 0.08, 0.5]} c="#efe0b9" />
          <B at={[cx, 1.08, cz]} size={[1.86, 0.62, 0.46]} c="#3ba7ff" glass />
          <B at={[cx, 1.08, cz]} size={[1.8, 0.56, 0.4]} c="#74c0fc" glass />
          {[0.3, 0.55, 1.3, 1.6].map((x, k) => (
            <B key={x} at={[x, 0.95 + k * 0.03, cz - 0.08]} size={[0.06, 0.3 + (k % 2) * 0.15, 0.06]} c="#2f9e44" />
          ))}
          <B at={[1.0, 0.82, cz]} size={[0.24, 0.1, 0.16]} c="#868e96" />
          <B at={[cx, 1.42, cz]} size={[1.92, 0.06, 0.5]} c="#1f1f24" />
          <B at={[cx, 1.385, cz]} size={[1.8, 0.01, 0.1]} c="#e7f5ff" lit />
          <Fish w={w} />
        </>
      )
    case 'piano': // a grand piano, its lid propped open, the keys, the bench
      return (
        <>
          <B at={[cx, 0.8, 0.72]} size={[1.5, 0.3, 1.3]} c={color} />
          <B at={[cx + 0.25, 0.8, 1.5]} size={[1.0, 0.3, 0.5]} c={color} />
          <B at={[cx + 0.4, 0.8, 1.82]} size={[0.6, 0.3, 0.3]} c={color} round />
          <B at={[cx + 0.05, 1.25, 1.0]} size={[1.4, 0.03, 1.5]} c={color} turn={[0, 0, 0.55]} />
          <B at={[cx - 0.7, 1.1, 1.0]} size={[0.02, 0.6, 0.02]} c="#2b2b30" turn={[0, 0, -0.3]} />
          <B at={[cx, 0.7, 0.05]} size={[1.4, 0.06, 0.16]} c="#ffffff" />
          {[...Array(16)].map((_, k) => (k % 7 === 2 || k % 7 === 6 ? null : <B key={k} at={[cx - 0.62 + k * 0.083, 0.75, 0.02]} size={[0.035, 0.04, 0.1]} c="#111114" />))}
          {[
            [0.4, 0.3],
            [w - 0.4, 0.3],
            [cx + 0.4, 1.8],
          ].map(([x, z]) => (
            <B key={`${x}${z}`} at={[x, 0.33, z]} size={[0.09, 0.66, 0.09]} c={color} />
          ))}
          <B at={[cx, 0.48, -0.35 + 0.5]} size={[0.8, 0.07, 0.32]} c={color} />
        </>
      )
    case 'sculpture': // a bronze mask on a white plinth
      return (
        <>
          <B at={[cx, 0.5, cz]} size={[0.5, 1.0, 0.5]} c="#f4f1ea" />
          <B at={[cx, 1.02, cz]} size={[0.54, 0.04, 0.54]} c="#d8d2c6" />
          <B at={[cx, 1.38, cz]} size={[0.26, 0.6, 0.16]} c={color} />
          <B at={[cx, 1.72, cz]} size={[0.32, 0.12, 0.18]} c={color} />
          <B at={[cx, 1.4, cz + 0.09]} size={[0.06, 0.2, 0.04]} c="#7a5223" />
          <B at={[cx - 0.06, 1.55, cz + 0.085]} size={[0.07, 0.015, 0.01]} c="#3a2412" />
          <B at={[cx + 0.06, 1.55, cz + 0.085]} size={[0.07, 0.015, 0.01]} c="#3a2412" />
          <B at={[cx, 1.24, cz + 0.085]} size={[0.06, 0.02, 0.01]} c="#3a2412" />
          <B at={[cx, 1.08, cz]} size={[0.08, 0.1, 0.08]} c={GOLD} />
        </>
      )
    case 'toile': // a painter's canvas from Abidjan on its easel: bright blocks of colour, figures
      return (
        <>
          <B at={[cx - 0.22, 0.85, cz + 0.12]} size={[0.04, 1.7, 0.04]} c="#8a5a32" turn={[-0.12, 0, 0.1]} />
          <B at={[cx + 0.22, 0.85, cz + 0.12]} size={[0.04, 1.7, 0.04]} c="#8a5a32" turn={[-0.12, 0, -0.1]} />
          <B at={[cx, 0.85, cz - 0.15]} size={[0.04, 1.7, 0.04]} c="#8a5a32" turn={[0.2, 0, 0]} />
          <B at={[cx, 0.72, cz + 0.06]} size={[0.6, 0.04, 0.08]} c="#8a5a32" />
          <group position={[cx, 1.15, cz + 0.08]} rotation={[-0.12, 0, 0]}>
            <B at={[0, 0, 0]} size={[0.62, 0.78, 0.03]} c="#f8f1e3" />
            <B at={[0, 0.22, 0.018]} size={[0.58, 0.3, 0.005]} c={color} />
            <B at={[0, -0.16, 0.018]} size={[0.58, 0.38, 0.005]} c="#1c4f8a" />
            <B at={[-0.12, -0.05, 0.022]} size={[0.08, 0.36, 0.005]} c="#1f1a17" />
            <B at={[0.1, -0.08, 0.022]} size={[0.08, 0.3, 0.005]} c="#8a1c1c" />
            <B at={[0.18, 0.24, 0.022]} size={[0.1, 0.1, 0.005]} c="#ffd43b" round turn={[Math.PI / 2, 0, 0]} />
          </group>
        </>
      )
    // A soirée's own pieces (backend game/soiree.go PartyFurnitures), the club's in small.
    case 'comptoir': // the bar counter: its dark front, the lit edge, the top, bottles and glasses on it, two stools before it
      return (
        <>
          <B at={[cx, 0.55, 0.3]} size={[w - 0.1, 1.1, 0.5]} c={color} />
          <B at={[cx, 1.12, 0.3]} size={[w, 0.05, 0.6]} c="#2ee6ff" />
          <B at={[cx, 0.08, 0.56]} size={[w - 0.1, 0.04, 0.02]} c="#2ee6ff" lit />
          {[0.35, 0.6, 0.85, 2.2, 2.5].map((x, i) => (
            <B key={x} at={[x, 1.29, 0.2]} size={[0.09, 0.3, 0.09]} c={['#2f6b3a', '#7a1f2b', '#c9a227', '#3a5a8a', '#e8e3d6'][i]} round />
          ))}
          {[1.3, 1.55].map((x) => (
            <B key={x} at={[x, 1.2, 0.35]} size={[0.07, 0.12, 0.07]} c="#cfe8f2" glass round />
          ))}
          {[0.7, 2.3].map((x) => (
            <group key={x}>
              <B at={[x, 0.35, 0.8]} size={[0.06, 0.7, 0.06]} c="#3a3f4b" round />
              <B at={[x, 0.71, 0.8]} size={[0.32, 0.06, 0.32]} c="#2ee6ff" round />
            </group>
          ))}
        </>
      )
    case 'sono': // two speakers one on the other, their cones toward the floor
      return (
        <>
          {[0.55, 1.55].map((y, i) => (
            <group key={y}>
              <B at={[cx, y, cz]} size={[0.85, i ? 0.85 : 1.05, 0.7]} c={color} />
              <B at={[cx, y - (i ? 0 : 0.15), cz + 0.36]} size={[i ? 0.32 : 0.5, 0.02, i ? 0.32 : 0.5]} c="#3a3f4b" round turn={[Math.PI / 2, 0, 0]} />
              {!i && <B at={[cx, y + 0.32, cz + 0.36]} size={[0.18, 0.02, 0.18]} c="#3a3f4b" round turn={[Math.PI / 2, 0, 0]} />}
            </group>
          ))}
          <B at={[cx, 0.06, cz + 0.36]} size={[0.6, 0.03, 0.02]} c="#ff2d95" lit />
        </>
      )
    case 'platines': // the DJ's table: two decks and the mixer, the laptop, its lit front
      return (
        <>
          {[0.15, w - 0.15].map((x) => (
            <B key={x} at={[x, 0.45, cz]} size={[0.08, 0.9, d * 0.7]} c="#2a2a30" />
          ))}
          <B at={[cx, 0.93, cz]} size={[w - 0.1, 0.06, d * 0.75]} c={color} />
          <B at={[cx, 0.75, cz + d * 0.36]} size={[w - 0.2, 0.3, 0.02]} c="#7a5cff" lit />
          {[0.5, w - 0.5].map((x) => (
            <group key={x}>
              <B at={[x, 0.98, cz]} size={[0.5, 0.05, 0.5]} c="#0d0d10" />
              <B at={[x, 1.02, cz]} size={[0.36, 0.02, 0.36]} c="#222226" round />
            </group>
          ))}
          <B at={[cx, 0.99, cz]} size={[0.3, 0.06, 0.4]} c="#2a2a30" />
          <B at={[cx, 1.12, cz - 0.25]} size={[0.38, 0.24, 0.02]} c="#cfe8ff" lit turn={[-0.35, 0, 0]} />
        </>
      )
    case 'spots': // a lighting stand: the tripod, the bar on top, four coloured heads lit
      return (
        <>
          <B at={[cx, 0.95, cz]} size={[0.05, 1.9, 0.05]} c="#3a3f4b" round />
          {[-0.5, 0.5].map((a) => (
            <B key={a} at={[cx + a * 0.3, 0.2, cz]} size={[0.04, 0.45, 0.04]} c="#3a3f4b" turn={[0, 0, a]} />
          ))}
          <B at={[cx, 0.2, cz + 0.15]} size={[0.04, 0.45, 0.04]} c="#3a3f4b" turn={[-0.5, 0, 0]} />
          <B at={[cx, 1.9, cz]} size={[0.9, 0.05, 0.06]} c="#2a2a30" />
          {['#ff2d95', '#2ee6ff', '#ffe600', '#7a5cff'].map((c, i) => (
            <group key={c}>
              <B at={[cx - 0.36 + i * 0.24, 1.8, cz + 0.02]} size={[0.16, 0.16, 0.16]} c="#141416" round />
              <B at={[cx - 0.36 + i * 0.24, 1.8, cz + 0.1]} size={[0.12, 0.02, 0.12]} c={c} lit round turn={[Math.PI / 2, 0, 0]} />
            </group>
          ))}
        </>
      )
  }
  return <B at={[cx, 0.4, cz]} size={[w * 0.9, 0.8, d * 0.9]} c={color} />
}

/** With the roof off (the cutaway), the ground floor's pieces only: the floors above are hidden. */
export const downstairs = (pieces: Piece[], cut = 2) => pieces.filter((p) => p[1] < cut)

/** Every piece of a house, on the plot's grid (x, z from its corner, y up). */
export function FurnitureSet({ pieces, catalog, onPiece, ghost }: { pieces: Piece[]; catalog: Furniture[]; onPiece?: (p: Piece, e: ThreeEvent<MouseEvent>) => void; ghost?: boolean }) {
  const byId = useMemo(() => new Map(catalog.map((f) => [f.id, f])), [catalog])
  return (
    <>
      {pieces.map((p) => {
        const f = byId.get(p[4])
        if (!f) return null
        const [w, d] = p[3] % 2 ? [f.d, f.w] : [f.w, f.d]
        return (
          <group key={`${p[0]},${p[1]},${p[2]},${p[4]}`} position={[p[0] + w / 2, p[1], p[2] + d / 2]} rotation={[0, (-p[3] * Math.PI) / 2, 0]} onClick={onPiece ? (e) => onPiece(p, e) : undefined}>
            <group position={[-f.w / 2, 0, -f.d / 2]}>
              <Model id={f.id} color={f.color} w={f.w} d={f.d} />
            </group>
            {ghost && (
              <mesh position={[0, f.h / 2, 0]} raycast={() => null}>
                <boxGeometry args={[f.w + 0.04, f.h + 0.04, f.d + 0.04]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.25} depthWrite={false} />
              </mesh>
            )}
          </group>
        )
      })}
    </>
  )
}
