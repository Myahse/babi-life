import { useRef, useSyncExternalStore } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useTalking } from './talk'

// While a chat is open, its sheet covers the bottom of the screen, where the
// camera would have the Sim and who it talks to: the picture slides up (a
// view offset, whatever moves the camera) so the two stay in sight above it,
// and slides back when the chat is over.

/** How far up the picture goes, as a share of the screen's height. */
const LIFT = 0.3

// The same while an action is played (components/defi: the garba, the shower…): its game takes the bottom
// of the screen, the Sim seen making its gestures above it.
let lifted = false
const subs = new Set<() => void>()
export function setLifted(on: boolean) {
  if (lifted === on) return
  lifted = on
  subs.forEach((f) => f())
}
const useLifted = () =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => void subs.delete(f)),
    () => lifted,
  )

export function ChatFraming() {
  const talk = useTalking()
  const lift = useLifted()
  const talking = talk || lift
  // (A played action's game takes less of the screen than a chat sheet: lifted less.)
  const by = talk ? LIFT : LIFT * 0.55
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const k = useRef(0)
  useFrame((_, dt) => {
    const want = talking ? 1 : 0
    if (k.current === want && !talking) return
    k.current += (want - k.current) * Math.min(1, dt * 5)
    if (Math.abs(k.current - want) < 0.003) k.current = want
    if (k.current === 0) camera.clearViewOffset()
    else camera.setViewOffset(size.width, size.height, 0, size.height * by * k.current, size.width, size.height)
  })
  return null
}
