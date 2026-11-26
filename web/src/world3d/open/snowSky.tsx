import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { rng } from '../themes'
import type { XZ } from './geo'

// The snow falling on Montréal in winter (snow.ts): little white blocks drifting down round the Sim,
// swaying as they go, wherever it walks; thicker when the weather turns (the « pluie » happening falls as snow there).

const FLAKES = 2400
const BOX = 60 // metres each way round the Sim
const TOP = 32

const flakeGeo = new THREE.BoxGeometry(0.07, 0.07, 0.07)

export function SnowSky({ focus, storm }: { focus: React.RefObject<XZ>; storm: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const flakes = useMemo(() => {
    const r = rng('neige')
    return [...Array(FLAKES)].map(() => ({ x: r() * 2 - 1, y: r() * TOP, z: r() * 2 - 1, v: 0.9 + r() * 0.9, ph: r() * 6.28 }))
  }, [])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 }), [])
  const m = useMemo(() => new THREE.Matrix4(), [])
  const t0 = useRef(0)
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    t0.current += dt
    const t = t0.current
    const [fx, fz] = focus.current ?? [0, 0]
    if (!mesh.current) return
    const wind = storm ? 2.4 : 0.6
    // A gentle fall shows half the flakes; a storm, all of them.
    const n = storm ? FLAKES : FLAKES >> 1
    mesh.current.count = n
    for (let i = 0; i < n; i++) {
      const f = flakes[i]
      f.y -= f.v * (storm ? 1.6 : 1) * dt
      if (f.y < 0) f.y += TOP
      const sway = Math.sin(t * 0.9 + f.ph) * 0.6
      // (Wrapped round the Sim, so they never run out as it walks or the wind blows.)
      const x = ((((f.x * BOX + sway + wind * t - fx) % (2 * BOX)) + 3 * BOX) % (2 * BOX)) - BOX + fx
      const z = ((((f.z * BOX + Math.cos(t * 0.7 + f.ph) * 0.4 + wind * 0.4 * t - fz) % (2 * BOX)) + 3 * BOX) % (2 * BOX)) - BOX + fz
      m.makeTranslation(x, f.y, z)
      mesh.current.setMatrixAt(i, m)
    }
    mesh.current.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={mesh} args={[flakeGeo, mat, FLAKES]} frustumCulled={false} />
}
