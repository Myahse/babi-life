import { useMemo } from 'react'
import * as THREE from 'three'

// L'espace's first blocks (workstream A's placeholders): a simple Calao rocket, a capsule, a voxel Earth and the
// stars. C's world3d/espace/calao.ts replaces the rocket (its kit, the one shared asset), D's Terre.tsx the Earth.

/** The Calao rocket in blocks: three white stages, the agency's orange band, the capsule on top (height ~ 14 units at scale 1). */
export function BlockRocket({ flame = 0, scale = 1 }: { flame?: number; scale?: number }) {
  return (
    <group scale={scale}>
      {/* First stage, boosters */}
      <mesh position={[0, 3, 0]} castShadow>
        <boxGeometry args={[1.6, 6, 1.6]} />
        <meshLambertMaterial color="#f4f4f1" />
      </mesh>
      {[-1, 1].map((x) => (
        <mesh key={x} position={[x * 1.15, 2, 0]} castShadow>
          <boxGeometry args={[0.7, 4, 0.7]} />
          <meshLambertMaterial color="#e9e9e4" />
        </mesh>
      ))}
      <mesh position={[0, 5.4, 0]}>
        <boxGeometry args={[1.66, 0.5, 1.66]} />
        <meshLambertMaterial color="#ff7a00" />
      </mesh>
      {/* Second stage */}
      <mesh position={[0, 7.6, 0]} castShadow>
        <boxGeometry args={[1.3, 3.2, 1.3]} />
        <meshLambertMaterial color="#f4f4f1" />
      </mesh>
      {/* The Pirogue capsule, its nose */}
      <mesh position={[0, 9.9, 0]} castShadow>
        <boxGeometry args={[1.1, 1.4, 1.1]} />
        <meshLambertMaterial color="#1c3d6e" />
      </mesh>
      <mesh position={[0, 11, 0]}>
        <boxGeometry args={[0.6, 0.8, 0.6]} />
        <meshLambertMaterial color="#e03131" />
      </mesh>
      {/* Fins */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[Math.sin((i * Math.PI) / 2) * 1.05, 0.5, Math.cos((i * Math.PI) / 2) * 1.05]} rotation={[0, (i * Math.PI) / 2, 0]}>
          <boxGeometry args={[0.15, 1, 0.8]} />
          <meshLambertMaterial color="#1c3d6e" />
        </mesh>
      ))}
      {flame > 0 && (
        <group position={[0, -0.6 - flame, 0]}>
          <mesh>
            <boxGeometry args={[1.2, flame * 2, 1.2]} />
            <meshBasicMaterial color="#ffb703" transparent opacity={0.9} />
          </mesh>
          <mesh position={[0, -flame * 0.6, 0]}>
            <boxGeometry args={[0.7, flame * 1.6, 0.7]} />
            <meshBasicMaterial color="#fff3bf" />
          </mesh>
        </group>
      )}
    </group>
  )
}

/** The Pirogue capsule alone (the way back), with its parachutes when open. */
export function BlockCapsule({ chutes = false }: { chutes?: boolean }) {
  return (
    <group>
      <mesh>
        <boxGeometry args={[1.6, 1.4, 1.6]} />
        <meshLambertMaterial color="#1c3d6e" />
      </mesh>
      <mesh position={[0, -0.8, 0]}>
        <boxGeometry args={[1.9, 0.25, 1.9]} />
        <meshLambertMaterial color="#5b3a1e" />
      </mesh>
      {chutes &&
        [-1.6, 0, 1.6].map((x, i) => (
          <group key={i}>
            <mesh position={[x, 5, 0]}>
              <boxGeometry args={[2.2, 0.4, 2.2]} />
              <meshLambertMaterial color={i === 1 ? '#ffffff' : '#ff7a00'} />
            </mesh>
            <mesh position={[x / 2, 2.6, 0]}>
              <boxGeometry args={[0.04, 4.5, 0.04]} />
              <meshBasicMaterial color="#dddddd" />
            </mesh>
          </group>
        ))}
    </group>
  )
}

/** The stars all round (a few hundred points). */
export function Stars({ count = 600, radius = 300 }: { count?: number; radius?: number }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const p = new Float32Array(count * 3)
    let seed = 7
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < count; i++) {
      const u = r() * 2 - 1
      const a = r() * Math.PI * 2
      const s = Math.sqrt(1 - u * u)
      p.set([Math.cos(a) * s * radius, u * radius, Math.sin(a) * s * radius], i * 3)
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3))
    return g
  }, [count, radius])
  return (
    <points geometry={geo}>
      <pointsMaterial color="#ffffff" size={1.4} sizeAttenuation={false} />
    </points>
  )
}

/** The Earth in voxels: a blue ball, its lands in blocks of green and sand, a cap of ice. */
export function BlockEarth({ radius = 10 }: { radius?: number }) {
  const blocks = useMemo(() => {
    const out: { p: [number, number, number]; c: string }[] = []
    const step = radius / 5
    for (let x = -radius; x <= radius; x += step)
      for (let y = -radius; y <= radius; y += step)
        for (let z = -radius; z <= radius; z += step) {
          const d = Math.hypot(x, y, z)
          if (d > radius || d < radius - step * 1.2) continue
          const land = Math.sin(x * 0.7) + Math.cos(z * 0.5) + Math.sin(y * 0.9) > 0.9
          out.push({ p: [x, y, z], c: Math.abs(y) > radius * 0.85 ? '#f1f5f9' : land ? (y < 0 ? '#c9a66b' : '#3c8d3a') : '#1d5fb8' })
        }
    return out
  }, [radius])
  const size = radius / 5
  return (
    <group>
      {blocks.map((b, i) => (
        <mesh key={i} position={b.p}>
          <boxGeometry args={[size, size, size]} />
          <meshLambertMaterial color={b.c} />
        </mesh>
      ))}
    </group>
  )
}
