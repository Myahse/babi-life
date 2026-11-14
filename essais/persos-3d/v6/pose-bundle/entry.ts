// The game's own pose code (web/src/avatar/Human.tsx usePoseRig and its pose tables), runnable outside React.
import { usePoseRig, SEATED } from '/home/user/babi-life/web/src/avatar/Human'
import { freezeWorldTime } from '/home/user/babi-life/web/src/lib/worldClock'
import { JOB_POSES } from '/home/user/babi-life/web/src/avatar/jobs'
import { EMOTE_POSES } from '/home/user/babi-life/web/src/avatar/emotes'
import { FIGHT_POSES } from '/home/user/babi-life/web/src/avatar/fight'
import { withInstance } from 'react'
import { takeFrames } from '@react-three/fiber'
export { SEATED, JOB_POSES, EMOTE_POSES, FIGHT_POSES, freezeWorldTime }
/** One "component instance": call step each frame with the pose; it re-runs the hook and then its useFrame callback. */
export function makePoser (rig: any, seed = 0) {
  const inst = { refs: [] as any[], i: 0 }
  return (pose: string, dt: number, opts: { speed?: number; take?: number; clock?: () => number; style?: any } = {}) => {
    withInstance(inst, () => usePoseRig(rig, pose as any, seed, opts.speed, opts.style, opts.take ?? 0, opts.clock))
    for (const cb of takeFrames()) (cb as any)(null, dt)
  }
}
