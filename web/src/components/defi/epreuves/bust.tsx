import { useMemo, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import type { Look } from '../../../lib/types'
import { Human, NoShadows, type Pose } from '../../../avatar/Human'
import { lookAt, randomLook } from '../../../avatar/options'
import { sceneDpr, weakDevice } from '../../../lib/device'

// Someone of the story face to face in an épreuve (the uncle who keeps the ring, the tantie of the pagnes):
// their bust in the game's own 3D blocks, the same each time (`seed`), their face set by the game through
// avatar/expressions.ts (setExpression(faceId, …)), in place of the emoji faces of before. `children`: what
// stands in front of them (the stall, the table), in the same small canvas.

export function Bust3D({ seed, gender, faceId, pose = 'idle', over, children, className = '', cam = [0, 1.45, 1.9], look = [0, 1.3, 0], fov = 30 }: { seed: number; gender: 'femme' | 'homme'; faceId: string; pose?: Pose; /** Their look over the drawn one (a headwrap, a boubou…). */ over?: Partial<Look>; children?: ReactNode; className?: string; cam?: [number, number, number]; look?: [number, number, number]; fov?: number }) {
  const l = useMemo(() => {
    let s = seed
    const rnd = () => ((s = (s * 9301 + 49297) % 233280), s / 233280)
    return lookAt({ ...randomLook(gender, rnd), ...over } as Look)
  }, [seed, gender]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`pointer-events-none ${className}`}>
      <Canvas dpr={weakDevice ? 1 : sceneDpr} gl={{ alpha: true, antialias: !weakDevice, powerPreference: 'low-power' }} camera={{ position: cam, fov }} onCreated={({ camera }) => camera.lookAt(...look)}>
        <hemisphereLight args={['#fff7e6', '#8a6a4a', 1.8]} />
        <directionalLight position={[0.5, 2.5, 4]} intensity={2.4} />
        <NoShadows>
          <Human look={l} gender={gender} pose={pose} seed={seed % 97} fitted full faceId={faceId} />
        </NoShadows>
        {children}
      </Canvas>
    </div>
  )
}
