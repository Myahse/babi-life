import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { rng } from '../themes'
import { worldTime } from '../../lib/worldClock'
import type { XZ } from './geo'

// The downpour over the commune (the « pluie » happening): the rain where the
// Sim is, wherever it walks, and the clouds it falls from, a low ceiling of
// dark blocks drifting with the wind over the whole quarter, seen from
// afar. Now and then, lightning.

const DROPS = 1600
const DROP_BOX = 70 // metres each way round the Sim
const DROP_TOP = 40
const CLOUDS = 70
const CLOUD_SPREAD = 900 // metres each way: the commune
const WIND: XZ = [3.2, 1.4] // m/s

const dropGeo = new THREE.BoxGeometry(0.035, 1.1, 0.035)
const cloudGeo = new THREE.BoxGeometry(1, 1, 1)

export function RainSky({ focus, night }: { focus: React.RefObject<XZ>; night: boolean }) {
  const drops = useRef<THREE.InstancedMesh>(null)
  const clouds = useRef<THREE.InstancedMesh>(null)
  const flash = useRef<THREE.AmbientLight>(null)
  const rain = useMemo(() => {
    const r = rng('pluie')
    return [...Array(DROPS)].map(() => [r() * 2 - 1, r() * DROP_TOP, r() * 2 - 1, 16 + r() * 8])
  }, [])
  // A cloud: a few blocks heaped, Minecraft-style, at its own height.
  const puffs = useMemo(() => {
    const r = rng('nuages')
    const out: { x: number; z: number; y: number; w: number; h: number; d: number }[] = []
    for (let c = 0; c < CLOUDS; c++) {
      const cx = (r() * 2 - 1) * CLOUD_SPREAD
      const cz = (r() * 2 - 1) * CLOUD_SPREAD
      const cy = 55 + r() * 25
      const n = 3 + Math.floor(r() * 4)
      for (let k = 0; k < n; k++) out.push({ x: cx + (r() - 0.5) * 70, z: cz + (r() - 0.5) * 50, y: cy + (r() - 0.3) * 8, w: 40 + r() * 70, h: 8 + r() * 10, d: 30 + r() * 50 })
    }
    return out
  }, [])
  const cloudMat = useMemo(() => new THREE.MeshLambertMaterial({ color: night ? '#3a3f4f' : '#7d8794', transparent: true, opacity: 0.94 }), [night])
  const dropMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#cfe8ff', transparent: true, opacity: 0.5 }), [])
  const m = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const s = useMemo(() => new THREE.Vector3(), [])
  const p = useMemo(() => new THREE.Vector3(), [])
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const [fx, fz] = focus.current ?? [0, 0]
    // The rain falls round wherever the Sim is now.
    if (drops.current) {
      rain.forEach((d, i) => {
        d[1] -= d[3] * dt
        if (d[1] < 0) d[1] += DROP_TOP
        m.makeTranslation(fx + d[0] * DROP_BOX, d[1], fz + d[2] * DROP_BOX)
        drops.current!.setMatrixAt(i, m)
      })
      drops.current.instanceMatrix.needsUpdate = true
    }
    // The clouds drift with the wind, the same on every screen (the shared clock), wrapping round the commune.
    if (clouds.current) {
      const t = worldTime()
      const wrap = (v: number) => ((((v + CLOUD_SPREAD) % (2 * CLOUD_SPREAD)) + 2 * CLOUD_SPREAD) % (2 * CLOUD_SPREAD)) - CLOUD_SPREAD
      puffs.forEach((c, i) => {
        p.set(wrap(c.x + WIND[0] * t), c.y, wrap(c.z + WIND[1] * t))
        s.set(c.w, c.h, c.d)
        m.compose(p, q, s)
        clouds.current!.setMatrixAt(i, m)
      })
      clouds.current.instanceMatrix.needsUpdate = true
    }
    // Lightning: a flash for a fraction of a second, every twenty seconds or so.
    if (flash.current) {
      const t = worldTime()
      const k = t % 19
      flash.current.intensity = k < 0.12 || (k > 0.25 && k < 0.33) ? 2.2 : 0
    }
  })
  return (
    <group>
      <instancedMesh ref={drops} args={[dropGeo, dropMat, DROPS]} frustumCulled={false} />
      <instancedMesh ref={clouds} args={[cloudGeo, cloudMat, puffs.length]} frustumCulled={false} />
      <ambientLight ref={flash} color="#dfe8ff" intensity={0} />
    </group>
  )
}
