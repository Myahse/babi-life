import { useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { sceneDpr } from '../../../lib/device'
import type { Pose } from '../../../avatar/Human'
import { MySim } from '../jeux/me'
import { FaceMood, setExpression, type Expression } from '../../../avatar/expressions'
import { onFx, type FxKind } from './kit'

// The player's own avatar in the épreuves (index.tsx): its real look (jeux/me.tsx, the Sim's), in a round
// window in a corner like a face on a call, living the game with you: its face set on the game, a grin and
// a fist when it goes right, a wince and a hand to the head when it goes wrong, the cheer and the dance at
// the win. Small enough to leave the game seen.

const GOOD: Pose[] = ['cheer', 'clap', 'thumbsup', 'flex']
const BAD: Pose[] = ['facepalm', 'despair', 'cry']
const GOOD_FACE: Expression[] = ['grin', 'laugh', 'proud']
const BAD_FACE: Expression[] = ['hurt', 'disappointed', 'annoyed']
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]

export type Corner = 'tl' | 'tr' | 'bl'

export default function Avatar({ corner }: { corner: Corner }) {
  const [pose, setPose] = useState<Pose>('idle')
  const [won, setWon] = useState(false)
  // A quick pop of the window on each moment, like a reaction.
  const win = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let back = 0
    const off = onFx((k: FxKind) => {
      win.current?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.14)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'ease-out' })
      if (k === 'win') {
        setExpression('me', 'cheer', 6000)
        return (setWon(true), setPose('dance'))
      }
      setExpression('me', pick(k === 'good' ? GOOD_FACE : BAD_FACE), 1400)
      setPose(pick(k === 'good' ? GOOD : BAD))
      clearTimeout(back)
      back = window.setTimeout(() => setPose('idle'), 1300)
    })
    return () => (off(), clearTimeout(back))
  }, [])
  const at = corner === 'tl' ? 'left-2 top-14' : corner === 'tr' ? 'right-2 top-14' : 'left-2 bottom-20'
  return (
    <div className={`pointer-events-none absolute z-20 ${at}`}>
      <div ref={win} className="h-[76px] w-[76px] overflow-hidden rounded-full bg-[radial-gradient(circle_at_50%_35%,#fff3d6,#e0a85a)] shadow-[0_6px_14px_-6px_rgba(0,0,0,0.6)] ring-[3px] ring-white/85">
        <Canvas dpr={sceneDpr} gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }} camera={{ position: [0, 1.38, 2.05], fov: 30 }} onCreated={({ camera }) => camera.lookAt(0, 1.3, 0)}>
          <hemisphereLight args={['#fff7e6', '#8a6a4a', 1.8]} />
          <directionalLight position={[0.5, 2.5, 4]} intensity={2.4} />
          {/* Between the moments, its face on the game (avatar/expressions.ts) */}
          <FaceMood rest="concentrate">
            <MySim pose={won ? 'dance' : pose} r={corner === 'tr' ? -0.25 : 0.25} />
          </FaceMood>
        </Canvas>
      </div>
    </div>
  )
}
