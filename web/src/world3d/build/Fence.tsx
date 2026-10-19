import { useMemo } from 'react'
import * as THREE from 'three'
import { Sign } from '../props'

// The clôture round a lot a player owns: a low wall of its owner's colour
// with pillars, a gate at the street side and the owner's name on it, so a
// player's house is known from the street. In the lot's own metres (x, z from
// its corner, the street at +z), just outside the lot.

/** The gate's width, in the middle of the street side. */
export const GATE = 3
const H = 1.3
const T = 0.25

const COLORS = ['#e8590c', '#2f9e44', '#1c7ed6', '#c2255c', '#f08c00', '#7048e8', '#0c8599', '#d6336c']

/** A colour for an owner, the same on every screen. */
export function ownerColor(id: string) {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return COLORS[h % COLORS.length]
}

/** The fence's straight runs (centre x, z; length along x or z), the gate left open. */
export function fenceRuns(w: number, d: number) {
  const g0 = (w - GATE) / 2
  return [
    { x: w / 2, z: -T / 2, len: w + 2 * T, along: 'x' as const },
    { x: -T / 2, z: d / 2, len: d, along: 'z' as const },
    { x: w + T / 2, z: d / 2, len: d, along: 'z' as const },
    { x: (g0 - T) / 2, z: d + T / 2, len: g0 + T, along: 'x' as const },
    { x: (w + g0 + GATE + T) / 2, z: d + T / 2, len: w - g0 - GATE + T, along: 'x' as const },
  ]
}

export function LotFence({ w, d, color, name }: { w: number; d: number; color: string; name?: string }) {
  const wall = useMemo(() => new THREE.MeshLambertMaterial({ color }), [color])
  const cap = useMemo(() => new THREE.MeshLambertMaterial({ color: '#f1efe9' }), [])
  const runs = fenceRuns(w, d)
  const g0 = (w - GATE) / 2
  // Pillars at the corners and either side of the gate.
  const pillars: [number, number][] = [
    [-T / 2, -T / 2],
    [w + T / 2, -T / 2],
    [-T / 2, d + T / 2],
    [w + T / 2, d + T / 2],
    [g0, d + T / 2],
    [g0 + GATE, d + T / 2],
  ]
  return (
    <group>
      {runs.map((r, i) => (
        <group key={i} position={[r.x, 0, r.z]}>
          <mesh position={[0, H / 2, 0]} material={wall} castShadow receiveShadow>
            <boxGeometry args={r.along === 'x' ? [r.len, H, T] : [T, H, r.len]} />
          </mesh>
          <mesh position={[0, H + 0.06, 0]} material={cap}>
            <boxGeometry args={r.along === 'x' ? [r.len, 0.12, T + 0.08] : [T + 0.08, 0.12, r.len]} />
          </mesh>
        </group>
      ))}
      {pillars.map(([x, z], i) => (
        <mesh key={i} position={[x, (H + 0.4) / 2, z]} material={cap} castShadow>
          <boxGeometry args={[0.45, H + 0.4, 0.45]} />
        </mesh>
      ))}
      {/* The owner's name over the gate, facing the street */}
      {name && <Sign p={[w / 2, H + 1.3, d + T / 2]} w={Math.max(GATE + 0.6, name.length * 0.32 + 1)} text={name} bg={color} fg="#ffffff" />}
      {name && (
        <>
          <mesh position={[g0, H + 0.9, d + T / 2]} material={cap}>
            <boxGeometry args={[0.18, 1.6, 0.18]} />
          </mesh>
          <mesh position={[g0 + GATE, H + 0.9, d + T / 2]} material={cap}>
            <boxGeometry args={[0.18, 1.6, 0.18]} />
          </mesh>
        </>
      )}
    </group>
  )
}
