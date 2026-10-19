import { useMemo } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
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

/** A box: [x, y, z] of its centre and [w, h, d], in the piece's own metres. */
function B({ at, size, c, round }: { at: [number, number, number]; size: [number, number, number]; c: string; round?: boolean }) {
  return <mesh geometry={round ? cyl : box} material={mat(c)} position={at} scale={size} castShadow receiveShadow />
}

/** One piece, drawn in a w × d footprint (before turning). */
function Model({ id, color, w, d }: { id: string; color: string; w: number; d: number }) {
  const cx = w / 2
  const cz = d / 2
  switch (id) {
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
  }
  return <B at={[cx, 0.4, cz]} size={[w * 0.9, 0.8, d * 0.9]} c={color} />
}

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
          <group key={`${p[0]},${p[1]},${p[2]},${p[4]}`} position={[p[0] + w / 2, p[1], p[2] + d / 2]} rotation={[0, p[3] % 2 ? -Math.PI / 2 : 0, 0]} onClick={onPiece ? (e) => onPiece(p, e) : undefined}>
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
