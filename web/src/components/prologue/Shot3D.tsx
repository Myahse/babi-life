import { useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import type { PerspectiveCamera } from 'three'
import { DEFAULT_LOOK } from '../../avatar/options'
import { DetailHuman } from '../../avatar/DetailHuman'
import type { Pose } from '../../avatar/Human'
import type { Look } from '../../lib/types'
import { SETS } from './sets'
import type { Actor, Scenario, Shot, Vec } from './types'

// One shot of a prologue at t seconds into it (types.ts): its set, its cast where they are and doing what
// at that moment, the camera on its way. Inside a Canvas (PrologueFilm plays it; the lab draws its panels).

const ease = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k))
const mix = (a: Vec, b: Vec | undefined, k: number): Vec => (b ? [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k] : a)

/** Where an actor is and what it does at t: walking there, or standing in its pose of the moment. */
export function actorAt(a: Actor, t: number): { x: number; z: number; turn: number; pose: Pose } {
  let pose = a.pose
  for (const c of a.then ?? []) if (t >= c.t) pose = c.pose
  if (a.walk) {
    const [x0, z0] = a.at
    const [x1, z1] = a.walk.to
    const d = Math.hypot(x1 - x0, z1 - z0)
    const go = d / (a.walk.speed ?? 1.2)
    const k = Math.max(0, Math.min(1, (t - (a.walk.from ?? 0)) / Math.max(0.01, go)))
    const moving = k > 0 && k < 1
    return {
      x: x0 + (x1 - x0) * k,
      z: z0 + (z1 - z0) * k,
      turn: moving ? Math.atan2(x1 - x0, z1 - z0) : (a.turn ?? 0),
      pose: moving ? 'walk' : pose,
    }
  }
  return { x: a.at[0], z: a.at[1], turn: a.turn ?? 0, pose }
}

function Camera({ shot, t }: { shot: Shot; t: number }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height))
  const k = ease(t / Math.max(0.01, shot.dur))
  const at = mix(shot.cam.from, shot.cam.to, k)
  const look = mix(shot.cam.look, shot.cam.lookTo, k)
  camera.position.set(...at)
  // Written for a wide screen (4:3 and wider): narrower (a phone held upright), the same width is kept in view.
  const base = shot.cam.fov ?? 40
  const fov = aspect >= 4 / 3 ? base : (2 * Math.atan(Math.tan((base * Math.PI) / 360) * (4 / 3 / aspect)) * 180) / Math.PI
  if (camera.fov !== fov) {
    camera.fov = fov
    camera.updateProjectionMatrix()
  }
  camera.lookAt(...look)
  return null
}

export function Shot3D({ scenario, shot, t }: { scenario: Scenario; shot: Shot; t: number }) {
  const Set = SETS[shot.set]
  const looks = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(scenario.cast).map(([id, c]) => [
          id,
          {
            ...DEFAULT_LOOK,
            ...c.look,
            ...(c.body ? { body: c.body } : {}),
          } as Look,
        ]),
      ),
    [scenario],
  )
  return (
    <>
      {Set && <Set t={t} mood={shot.mood ?? ''} />}
      {shot.actors.map((a, i) => {
        const c = scenario.cast[a.who]
        if (!c) return null
        const s = actorAt(a, t)
        return (
          <group key={`${a.who}${i}`} position={[s.x, a.y ?? 0, s.z]} rotation={[0, s.turn, 0]}>
            <DetailHuman look={looks[a.who]} gender={c.gender} pose={s.pose} seed={i * 7 + 3} take={Math.floor(t / 1.4)} />
          </group>
        )
      })}
      <Camera shot={shot} t={t} />
    </>
  )
}
