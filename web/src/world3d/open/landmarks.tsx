import { useMemo } from 'react'
import * as THREE from 'three'

// Landmarks the map alone can't draw: their shape is what people know them
// by. Built from published descriptions; sizes are estimates for the game.

/** The game places drawn as landmarks, and the ground they need cleared (metres). */
export const LANDMARKS: Record<string, number> = { 'plateau-cathedrale': 34 }

/**
 * Cathédrale Saint-Paul (Plateau, Aldo Spirito, 1985): its cross-shaped tower
 * leans out over the lagoon, held to the church by seven cables. The tower's
 * height (~70 m) comes from a single source; the nave's shape here is a
 * simplification. Local +z is the street side.
 */
export function Cathedral() {
  const white = useMemo(() => new THREE.MeshLambertMaterial({ color: '#f4f1ea' }), [])
  const panel = useMemo(() => new THREE.MeshLambertMaterial({ color: '#2f6fb0' }), [])
  const glass = useMemo(() => new THREE.MeshLambertMaterial({ color: '#f2c14e', emissive: '#7a4f00', emissiveIntensity: 0.25 }), [])
  const cable = useMemo(() => new THREE.MeshBasicMaterial({ color: '#4a4f57' }), [])

  // The nave: a wedge rising toward the tower at the back.
  const nave = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(-22, 0)
    shape.lineTo(22, 0)
    shape.lineTo(14, 38)
    shape.lineTo(-14, 38)
    shape.closePath()
    const g = new THREE.ExtrudeGeometry(shape, { depth: 9, bevelEnabled: false })
    g.rotateX(-Math.PI / 2)
    // Slope the roof: higher toward the back (the tower).
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i)
      if (y > 0.5) p.setY(i, 9 + (-p.getZ(i) / 38) * 14)
    }
    g.computeVertexNormals()
    return g
  }, [])

  // The tower leans forward, toward the lagoon, its top ~70 m up.
  const lean = 0.2
  const H = 68
  const top = new THREE.Vector3(0, H * Math.cos(lean), -38 + Math.sin(lean) * H)
  const anchors = [-12, -8, -4, 0, 4, 8, 12].map((x) => new THREE.Vector3(x, 9 + ((-(-38 + 6)) / 38) * 14, -32 + Math.abs(x) * 0.2))
  return (
    // Centred on its plot: the forecourt at the front, the tower at the back.
    <group position={[0, 0, 15]}>
      <mesh geometry={nave} material={white} castShadow receiveShadow />
      {/* Ceramic panels along the walls, and the stained glass */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 18.2, 4.5, -19]} rotation={[0, s * 0.205, 0]} material={panel}>
          <boxGeometry args={[0.2, 3, 34]} />
        </mesh>
      ))}
      <mesh position={[0, 5, 0.05]} material={glass}>
        <boxGeometry args={[30, 6, 0.1]} />
      </mesh>
      {/* The steps and the forecourt */}
      <mesh position={[0, 0.25, 4]} material={white} receiveShadow>
        <boxGeometry args={[34, 0.5, 8]} />
      </mesh>
      {/* The tower: a tall shaft leaning out, and the cross at its top */}
      <group position={[0, 0, -38]} rotation={[lean, 0, 0]}>
        <mesh position={[0, H / 2, 0]} material={white} castShadow>
          <boxGeometry args={[4, H, 4]} />
        </mesh>
        <mesh position={[0, H - 12, 0]} material={white} castShadow>
          <boxGeometry args={[22, 3.5, 3.5]} />
        </mesh>
      </group>
      {/* Seven cables from the tower down to the church */}
      {anchors.map((a, i) => {
        const mid = a.clone().add(top).multiplyScalar(0.5)
        const len = a.distanceTo(top)
        const dir = top.clone().sub(a).normalize()
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
        return (
          <mesh key={i} position={mid} quaternion={q} material={cable}>
            <cylinderGeometry args={[0.12, 0.12, len, 5]} />
          </mesh>
        )
      })}
    </group>
  )
}
