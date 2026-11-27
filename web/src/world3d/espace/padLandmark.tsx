import { BlockRocket } from './placeholders'

// A spaceport's pad in the street (padLandmarks.ts): the concrete, the red tower, the Calao standing on it
// (about 46 m). Workstream A's placeholder; C's spatioport.tsx replaces it.
export function PadLandmark({ night }: { id: string; night: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.5, 0]} receiveShadow>
        <boxGeometry args={[34, 1, 34]} />
        <meshLambertMaterial color="#9aa0a6" />
      </mesh>
      {/* The flame trench */}
      <mesh position={[0, 1.02, 10]}>
        <boxGeometry args={[6, 0.05, 14]} />
        <meshLambertMaterial color="#3d3d3d" />
      </mesh>
      {/* The tower and its arm */}
      <mesh position={[-9, 26, 0]} castShadow>
        <boxGeometry args={[5, 52, 5]} />
        <meshLambertMaterial color="#c92a2a" />
      </mesh>
      <mesh position={[-5, 38, 0]}>
        <boxGeometry args={[6, 1.2, 1.6]} />
        <meshLambertMaterial color="#868e96" />
      </mesh>
      <mesh position={[-9, 53, 0]}>
        <boxGeometry args={[1.2, 2, 1.2]} />
        <meshBasicMaterial color={night ? '#ff6b6b' : '#c92a2a'} />
      </mesh>
      <group position={[0, 1, 0]}>
        <BlockRocket scale={4} />
      </group>
    </group>
  )
}
