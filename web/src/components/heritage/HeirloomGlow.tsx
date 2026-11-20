import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// A family heirloom in the house (update « heritage », phase 3): a soft gold glow round its foot that breathes,
// and a little gold plaque at its front, so it reads as the family's own among the furniture. Two flat boxes,
// one shared material, nothing allocated per frame.

let glowMat: THREE.MeshBasicMaterial | null = null
let plaqueMat: THREE.MeshLambertMaterial | null = null
let edgeMat: THREE.MeshBasicMaterial | null = null
let last = -1

export function HeirloomGlow({ w, d, h, plaque: withPlaque = true, y = 0.03 }: { w: number; d: number; h: number; /** The little gold plaque at its front (furniture; not under a vehicle). */ plaque?: boolean; /** The glow's height (over a road's surface for a vehicle). */ y?: number }) {
  const mat = (glowMat ??= new THREE.MeshBasicMaterial({ color: '#ffc94a', transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }))
  const plaque = (plaqueMat ??= new THREE.MeshLambertMaterial({ color: '#d9a520', emissive: '#7a5200' }))
  const edge = (edgeMat ??= new THREE.MeshBasicMaterial({ color: '#ffd36e', transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }))
  const ring = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    // (Every glow shares the material: it breathes once per frame, whichever glow comes first.)
    if (clock.elapsedTime === last) return
    last = clock.elapsedTime
    mat.opacity = 0.28 + 0.16 * Math.sin(clock.elapsedTime * 2.2)
    edge.opacity = 0.65 + 0.3 * Math.sin(clock.elapsedTime * 2.2)
  })
  return (
    <group raycast={() => null}>
      <mesh ref={ring} position={[0, y, 0]} material={mat} raycast={() => null}>
        <boxGeometry args={[w + 0.32, 0.03, d + 0.32]} />
      </mesh>
      {/* Its bright gold edge, so it reads as a glow and not a mat */}
      {[
        [0, (d + 0.32) / 2, w + 0.42, 0.1],
        [0, -(d + 0.32) / 2, w + 0.42, 0.1],
        [(w + 0.32) / 2, 0, 0.1, d + 0.32],
        [-(w + 0.32) / 2, 0, 0.1, d + 0.32],
      ].map(([x, z, sx, sz], i) => (
        <mesh key={i} position={[x, y + 0.01, z]} material={edge} raycast={() => null}>
          <boxGeometry args={[sx, 0.04, sz]} />
        </mesh>
      ))}
      {withPlaque && (
        <mesh position={[0, Math.min(0.45, h * 0.5), d / 2 + 0.02]} material={plaque} raycast={() => null}>
          <boxGeometry args={[0.22, 0.12, 0.02]} />
        </mesh>
      )}
    </group>
  )
}
