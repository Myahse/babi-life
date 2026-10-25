import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { worldTime } from '../../lib/worldClock'

// The Ivorian flag (orange at the pole, white, green) rippling in the wind off
// the lagoon: waves run along its cloth away from the pole, bigger toward the
// free end, which droops a little. Flown by the official buildings (the
// Palais de justice, the Présidence, the Assemblée nationale) and along the
// forecourts (the Palais de la Culture).

let cloth: THREE.MeshLambertMaterial | null = null
function ivorian() {
  if (cloth) return cloth
  const c = document.createElement('canvas')
  c.width = 96
  c.height = 64
  const g = c.getContext('2d')!
  ;['#f77f00', '#ffffff', '#009e60'].forEach((col, i) => ((g.fillStyle = col), g.fillRect(i * 32, 0, 32, 64)))
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return (cloth = new THREE.MeshLambertMaterial({ map: t, side: THREE.DoubleSide }))
}
const steel = new THREE.MeshLambertMaterial({ color: '#9aa0a8' })

/** A flag on its pole, the pole's foot at the origin; the cloth `w` wide at the top, flying toward +x. */
export function WavingFlag({ height = 9, w = 3, seed = 0, pole = true }: { height?: number; w?: number; seed?: number; /** Without its pole (one stands there already). */ pole?: boolean }) {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(w, (w * 2) / 3, 12, 4)
    g.translate(w / 2, 0, 0)
    return g
  }, [w])
  const base = useMemo(() => Float32Array.from(geo.attributes.position.array), [geo])
  useFrame(() => {
    const t = worldTime() + seed * 1.7
    const pos = geo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      const [x, y] = [base[i * 3], base[i * 3 + 1]]
      const k = x / w
      pos.setZ(i, Math.sin(x * 1.7 - t * 5.5 + y * 0.5) * 0.32 * k + Math.sin(t * 1.3 + x) * 0.06 * k)
      pos.setY(i, y - k * k * 0.12 * w)
    }
    pos.needsUpdate = true
    geo.computeVertexNormals()
  })
  return (
    <group>
      {pole && (
        <mesh position={[0, height / 2, 0]} material={steel} castShadow>
          <cylinderGeometry args={[0.06, 0.09, height, 6]} />
        </mesh>
      )}
      <mesh geometry={geo} material={ivorian()} position={[0.08, height - w / 3 - 0.15, 0]} castShadow />
    </group>
  )
}
