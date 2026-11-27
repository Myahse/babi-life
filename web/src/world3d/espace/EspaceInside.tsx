import { Canvas } from '@react-three/fiber'
import type { City, Commune, Sim } from '../../lib/types'
import { SpaceScene } from './SpaceWorld'

// A place's inside up there (a kind starting with 'espace-', lib/espace.ts): workstream A's placeholder, the
// module (or the base) where it is, the Sim in it. D's own (the cupola, the lab, the sleeping bags) replaces it.
export function EspaceInside({ city, commune, sim }: { city: City; commune: Commune; sim: Sim; kind: string; placeId: string; interactionId?: string }) {
  return (
    <div className="absolute inset-0">
      <Canvas dpr={[1, 1.5]} camera={{ fov: 55, near: 0.1, far: 1000, position: [2.5, 2, 6] }}>
        <SpaceScene city={city} commune={commune} sim={sim} />
      </Canvas>
    </div>
  )
}
