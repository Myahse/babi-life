import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { Human } from '../avatar/Human'
import { randomLook } from '../avatar/options'
import type { Pose } from '../avatar/Human'

// The loading screen's perso in 3D, as in the game (components/Splash.tsx
// loads it once three.js is there; the flat dancer stands in till then): a
// perso of a new look each time, dancing (or, on the error screen
// components/ErrorScreen.tsx, a hand on its face).

export default function SplashAvatar({ size = 150, pose = 'dance' }: { size?: number; /** Dancing while it loads; the error screen's, a facepalm. */ pose?: Pose }) {
  const [gender, look] = useMemo(() => {
    const g: 'femme' | 'homme' = Math.random() < 0.5 ? 'femme' : 'homme'
    return [g, randomLook(g)] as const
  }, [])
  return (
    <div style={{ width: size, height: size * 1.4 }}>
      <Canvas dpr={[1, 2]} camera={{ position: [0, 1.1, 3.4], fov: 32 }} gl={{ alpha: true, antialias: true }} onCreated={({ camera }) => camera.lookAt(0, 0.95, 0)}>
        <hemisphereLight args={['#fff4e6', '#c0704f', 1.3]} />
        <directionalLight position={[2, 4, 3]} intensity={1.6} />
        <group rotation={[0, -0.25, 0]}>
          <Human look={look} gender={gender} pose={pose} seed={3} full />
        </group>
      </Canvas>
    </div>
  )
}
