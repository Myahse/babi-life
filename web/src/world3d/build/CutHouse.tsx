import { useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { Block, Material } from '../../lib/types'
import { House } from './House'

/**
 * A house seen from inside, as in the Sims: its walls stand full height
 * (up to `top`, the floors above are off), except the ones between the
 * camera and what it looks at, which come down to one block so the Sim is
 * seen. It follows the camera as it turns (the house drawn again only when
 * the view has turned or moved enough). `look`: the point looked at, in the
 * world (default: the orbit controls' target). `base`: the floor's height.
 */
export function CutHouse({ blocks, materials, top, base = 0, look }: { blocks: Block[]; materials: Material[]; top: number; base?: number; look?: () => THREE.Vector3 | null }) {
  const g = useRef<THREE.Group>(null)
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3 } | null
  const [view, setView] = useState<{ t: [number, number]; d: [number, number] } | null>(null)
  const last = useRef('')
  const tick = useRef(0)
  useFrame((_, dt) => {
    tick.current += dt
    if (tick.current < 0.15 || !g.current) return
    tick.current = 0
    const at = look?.() ?? controls?.target
    if (!at) return
    const t = g.current.worldToLocal(at.clone())
    const c = g.current.worldToLocal(camera.position.clone())
    const [dx, dz] = [c.x - t.x, c.z - t.z]
    const l = Math.hypot(dx, dz) || 1
    const key = `${Math.round(Math.atan2(dz, dx) / (Math.PI / 12))}:${Math.round(t.x / 1.5)}:${Math.round(t.z / 1.5)}`
    if (key === last.current) return
    last.current = key
    setView({ t: [t.x, t.z], d: [dx / l, dz / l] })
  })
  const shown = useMemo(
    () =>
      blocks.filter((b) => {
        if (b[1] >= top) return false
        if (!view || b[1] < base + 1) return true
        // On the camera's side of the point looked at: down to one block.
        return (b[0] + 0.5 - view.t[0]) * view.d[0] + (b[2] + 0.5 - view.t[1]) * view.d[1] <= 0.8
      }),
    [blocks, top, base, view],
  )
  return (
    <group ref={g}>
      <House blocks={shown} materials={materials} />
    </group>
  )
}
