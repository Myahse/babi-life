import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// A family heirloom in the house (update « heritage », phase 3): a soft gold glow round its foot that breathes,
// and a little gold plaque at its front, so it reads as the family's own among the furniture. Two flat boxes,
// one shared material, nothing allocated per frame.

let glowMat: THREE.MeshBasicMaterial | null = null
let plaqueMat: THREE.MeshLambertMaterial | null = null
let last = -1

export function HeirloomGlow({ w, d, h }: { w: number; d: number; h: number }) {
  const mat = (glowMat ??= new THREE.MeshBasicMaterial({ color: '#ffc94a', transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }))
  const plaque = (plaqueMat ??= new THREE.MeshLambertMaterial({ color: '#d9a520', emissive: '#7a5200' }))
  const ring = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    // (Every glow shares the material: it breathes once per frame, whichever glow comes first.)
    if (clock.elapsedTime === last) return
    last = clock.elapsedTime
    mat.opacity = 0.28 + 0.16 * Math.sin(clock.elapsedTime * 2.2)
  })
  return (
    <group raycast={() => null}>
      <mesh ref={ring} position={[0, 0.03, 0]} material={mat} raycast={() => null}>
        <boxGeometry args={[w + 0.32, 0.03, d + 0.32]} />
      </mesh>
      <mesh position={[0, Math.min(0.45, h * 0.5), d / 2 + 0.02]} material={plaque} raycast={() => null}>
        <boxGeometry args={[0.22, 0.12, 0.02]} />
      </mesh>
    </group>
  )
}
