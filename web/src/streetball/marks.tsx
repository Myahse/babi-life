import * as THREE from 'three'

// The chalk on the ground, shared by the street's grounds (scene.tsx) and the stadium (stadium.tsx).

const BOX = new THREE.BoxGeometry(1, 1, 1)
const chalk = new THREE.MeshLambertMaterial({ color: '#f4f4f0' })

/** A painted line on the ground, from a to b. */
export function Line({ a, b, w = 0.1 }: { a: [number, number]; b: [number, number]; w?: number }) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  return <mesh geometry={BOX} material={chalk} position={[(a[0] + b[0]) / 2, 0.035, (a[1] + b[1]) / 2]} rotation={[0, -Math.atan2(b[1] - a[1], b[0] - a[0]), 0]} scale={[len, 0.01, w]} />
}

/** A painted arc round (x, z), the angles as the ring's (θ in the plane, the world's z = -sin θ). */
export function Arc({ at, r, from, to }: { at: [number, number]; r: number; from: number; to: number }) {
  return (
    <mesh position={[at[0], 0.036, at[1]]} rotation={[-Math.PI / 2, 0, 0]} material={chalk}>
      <ringGeometry args={[r - 0.05, r + 0.05, 48, 1, from, to - from]} />
    </mesh>
  )
}
