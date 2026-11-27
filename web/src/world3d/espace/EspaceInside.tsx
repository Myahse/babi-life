import { Canvas } from '@react-three/fiber'
import type { City, Commune, Sim, World } from '../../lib/types'
import { Snapper } from '../snapshot'
import { OverEarth, SpaceActions, SpaceScene, useLights, useStorm } from './SpaceWorld'

// A place's inside up there (a kind starting with 'espace-', lib/espace.ts; workstream D): the same scene as the
// module or the base (SpaceWorld.tsx), framed on what's being done there: the cupola over the Earth, the lab's
// racks, the sleeping bag, the treadmill, the airlock and its suits, the greenhouse, the rover out driving, the
// mine; with what has more to it (the Babigram photo, the spacewalk SortieEVA, the lab's experiment).
export function EspaceInside({ city, commune, sim, world, kind, interactionId }: { city: City; commune: Commune; sim: Sim; world?: Pick<World, 'cities'>; kind: string; placeId: string; interactionId?: string }) {
  const lights = useLights(world)
  const storm = useStorm(sim)
  return (
    <div className="absolute inset-0">
      <Canvas dpr={[1, 1.5]} camera={{ fov: 55, near: 0.1, far: 1000, position: [2.5, 2, 6] }}>
        <SpaceScene city={city} commune={commune} sim={sim} kind={kind} doing={interactionId} lights={lights} storm={storm} />
        <Snapper />
      </Canvas>
      <div className="pointer-events-none absolute right-3 bottom-[calc(var(--sab,env(safe-area-inset-bottom))+9rem)] left-3 flex flex-wrap justify-center gap-2">
        {kind === 'espace-coupole' && <OverEarth lights={lights} />}
        <SpaceActions sim={sim} />
      </div>
    </div>
  )
}
