import type { ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { sceneDpr } from '../../lib/device'

// The little 3D tables of the played actions (the garba's bassine and plate, the alloco's
// paper): the game's own blocks and materials (world3d/props), seen from above and a little
// in front, lit like the street by day.

export function Table3d({ children, cam = [0, 7, 3.4], look = [0, 0, 0.2], fov = 40, className = '' }: { children: ReactNode; cam?: [number, number, number]; look?: [number, number, number]; fov?: number; className?: string }) {
  return (
    <Canvas dpr={sceneDpr} gl={{ alpha: true }} camera={{ position: cam, fov }} onCreated={({ camera }) => camera.lookAt(...look)} className={className} style={{ touchAction: 'none' }}>
      <hemisphereLight args={['#fff7e6', '#6b4a2a', 1.0]} />
      <directionalLight position={[3, 8, 5]} intensity={1.2} />
      {children}
    </Canvas>
  )
}
