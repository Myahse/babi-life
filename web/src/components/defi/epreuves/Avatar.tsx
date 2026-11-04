import { useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { sceneDpr } from '../../../lib/device'
import type { Pose } from '../../../avatar/Human'
import { MySim } from '../jeux/me'
import { FaceMood } from '../../../avatar/expressions'
import { onFx, type FxKind } from './kit'

// The player's own avatar in the épreuves (index.tsx): its real look (jeux/me.tsx, the Sim's), in a corner,
// living the game with you: it waits, it cheers when it goes right, holds its head when it goes wrong,
// dances at the win.

const GOOD: Pose[] = ['cheer', 'clap', 'thumbsup', 'flex']
const BAD: Pose[] = ['facepalm', 'despair', 'cry']

export type Corner = 'tl' | 'tr' | 'bl'

export default function Avatar({ corner }: { corner: Corner }) {
  const [pose, setPose] = useState<Pose>('idle')
  const [won, setWon] = useState(false)
  useEffect(() => {
    let back = 0
    const off = onFx((k: FxKind) => {
      if (k === 'win') return (setWon(true), setPose('dance'))
      setPose((k === 'good' ? GOOD : BAD)[Math.floor(Math.random() * 3)])
      clearTimeout(back)
      back = window.setTimeout(() => setPose('idle'), 1300)
    })
    return () => (off(), clearTimeout(back))
  }, [])
  const at = corner === 'tl' ? 'left-1 top-12' : corner === 'tr' ? 'right-1 top-12' : 'left-1 bottom-2'
  return (
    <div className={`pointer-events-none absolute z-20 h-[118px] w-[86px] ${at}`}>
      <div className="absolute inset-x-2 bottom-1 h-3 rounded-full bg-black/25 blur-[2px]" />
      <Canvas dpr={sceneDpr} gl={{ alpha: true, antialias: true }} camera={{ position: [0, 0.95, 3.4], fov: 30 }} onCreated={({ camera }) => camera.lookAt(0, 0.72, 0)}>
        <hemisphereLight args={['#fff7e6', '#6b4a2a', 1.15]} />
        <directionalLight position={[2, 4, 4]} intensity={1.3} />
        {/* Between the moments, its face on the game (avatar/expressions.ts) */}
        <FaceMood rest="concentrate">
          <MySim pose={won ? 'dance' : pose} r={corner === 'tr' ? -0.35 : 0.35} />
        </FaceMood>
      </Canvas>
    </div>
  )
}
