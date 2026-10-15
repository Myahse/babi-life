import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Box } from '../props'
import { worldTime } from '../../lib/worldClock'

// What shows what the Sim is doing, around it: the water of the shower, the
// plate of garba, the bottle, the blanket, the notebook, the prayer mat…
// In the Sim's own frame (it faces +z; lying, +z is up and +y runs from
// the feet to the head), so it goes wherever the Sim is put.

const BOX = new THREE.BoxGeometry(1, 1, 1)
const water = new THREE.MeshBasicMaterial({ color: '#9fd8ff', transparent: true, opacity: 0.7 })
const steam = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.25, depthWrite: false })

/** The table top, in front of a Sim sitting at it. */
const TABLE: [number, number, number] = [0, 0.77, 0.52]

export function ActionProps({ id, kind, lying }: { id?: string; kind: string; lying: boolean }) {
  if (!id) return null
  if (id === 'shower') return <Shower />
  if (id === 'bain-bebe') return <Tub />
  if (lying && /^(sleep|nap)$/.test(id)) return <Blanket />
  if (id === 'pray') return <PrayerMat />
  if (id === 'devoirs' || (/cours|biblio|write/.test(id) && kind !== 'office')) return <Notebook />
  const dish = dishFor(id)
  if (dish) return <Dish kind={dish} />
  if (/^(drink|milkshake|coffee|sucrerie)/.test(id) || id.includes('drink') || id === 'bar-hotel') return <Drinks milk={id === 'milkshake'} />
  return null
}

/* ---------- The shower ---------- */

/** Water falling from the shower head over the Sim, and the steam rising. */
function Shower() {
  const drops = useRef<THREE.InstancedMesh>(null)
  const puffs = useRef<THREE.InstancedMesh>(null)
  const N = 46
  const seeds = useMemo(() => [...Array(N)].map((_, i) => [Math.sin(i * 12.9898) * 0.5 + 0.5, Math.sin(i * 78.233) * 0.5 + 0.5, Math.sin(i * 37.719) * 0.5 + 0.5]), [])
  const o = useMemo(() => new THREE.Object3D(), [])
  useFrame(() => {
    const t = worldTime()
    if (drops.current) {
      seeds.forEach(([a, b, c], i) => {
        const k = (t * 1.6 + c) % 1
        const r = 0.08 + a * 0.32
        const ang = b * Math.PI * 2
        o.position.set(Math.cos(ang) * r * (0.6 + k * 0.6), 2.15 - k * 2.15, Math.sin(ang) * r * (0.6 + k * 0.6))
        o.scale.set(0.025, 0.16, 0.025)
        o.updateMatrix()
        drops.current!.setMatrixAt(i, o.matrix)
      })
      drops.current.instanceMatrix.needsUpdate = true
    }
    if (puffs.current) {
      for (let i = 0; i < 6; i++) {
        const k = (t * 0.25 + i / 6) % 1
        o.position.set(Math.sin(i * 2.1) * 0.35, 0.6 + k * 1.9, Math.cos(i * 2.1) * 0.35)
        o.scale.setScalar(0.25 + k * 0.4)
        o.updateMatrix()
        puffs.current.setMatrixAt(i, o.matrix)
      }
      puffs.current.instanceMatrix.needsUpdate = true
    }
  })
  return (
    <group>
      {/* The pipe up the wall, the shower head */}
      <Box p={[0, 2.25, -0.55]} s={[0.05, 0.05, 0.5]} c="#c3c7cf" />
      <Box p={[0, 1.2, -0.78]} s={[0.05, 2.1, 0.05]} c="#c3c7cf" />
      <Box p={[0, 2.2, -0.3]} s={[0.22, 0.06, 0.22]} c="#9aa0a8" />
      <instancedMesh ref={drops} args={[BOX, water, N]} frustumCulled={false} />
      <instancedMesh ref={puffs} args={[BOX, steam, 6]} frustumCulled={false} />
      {/* The bucket and the soap, Abidjan style */}
      <Box p={[0.55, 0.2, 0.3]} s={[0.32, 0.4, 0.32]} c="#2a6cf0" />
      <Box p={[0.55, 0.36, 0.3]} s={[0.26, 0.04, 0.26]} c="#9fd8ff" />
      <Box p={[-0.5, 0.05, 0.35]} s={[0.12, 0.05, 0.07]} c="#ffd43b" />
    </group>
  )
}

/** The baby's bath: the basin of water, the bubbles. */
function Tub() {
  return (
    <group position={[0, 0, 0.55]}>
      <Box p={[0, 0.18, 0]} s={[0.7, 0.36, 0.5]} c="#f08c00" />
      <Box p={[0, 0.34, 0]} s={[0.62, 0.04, 0.42]} c="#9fd8ff" />
      {[[-0.15, 0.08], [0.1, -0.1], [0.2, 0.12]].map(([x, z], i) => (
        <Box key={i} p={[x, 0.39, z]} s={[0.07, 0.06, 0.07]} c="#ffffff" />
      ))}
    </group>
  )
}

/* ---------- Bed, prayer, homework ---------- */

/** The pagne over the sleeper, from the feet to the chest. */
function Blanket() {
  return <Box p={[0, 0.6, 0.15]} s={[0.66, 1.15, 0.14]} c="#e8590c" />
}

/** The prayer mat under the one praying. */
function PrayerMat() {
  return (
    <group position={[0, 0.012, 0.15]}>
      <Box p={[0, 0, 0]} s={[0.75, 0.02, 1.25]} c="#2b8a3e" />
      <Box p={[0, 0.005, 0.52]} s={[0.55, 0.02, 0.12]} c="#f2b705" />
      <Box p={[0, 0.005, 0]} s={[0.55, 0.021, 0.5]} c="#7a1f3d" />
    </group>
  )
}

/** The notebook open on the table, and the pen. */
function Notebook() {
  return (
    <group position={TABLE}>
      <Box p={[0, 0.01, 0]} s={[0.42, 0.02, 0.3]} c="#f8f9fa" />
      <Box p={[0, 0.021, 0]} s={[0.02, 0.005, 0.3]} c="#adb5bd" />
      <Box p={[0.12, 0.03, 0.02]} s={[0.14, 0.015, 0.015]} c="#1d4ed8" />
    </group>
  )
}

/* ---------- At table ---------- */

type DishKind = 'garba' | 'poulet' | 'alloco' | 'poisson' | 'attieke' | 'burger' | 'glace' | 'bouillie' | 'gateau' | 'plat'

function dishFor(id: string): DishKind | null {
  if (id.includes('garba')) return 'garba'
  if (id.includes('poulet') || id.includes('brochette')) return 'poulet'
  if (id.includes('alloco')) return 'alloco'
  if (id.includes('fish') || id.includes('poisson')) return 'poisson'
  if (id.includes('attieke')) return 'attieke'
  if (id.includes('burger')) return 'burger'
  if (id.includes('glace')) return 'glace'
  if (id === 'bouillie' || id === 'biberon') return 'bouillie'
  if (id === 'anniversaire') return 'gateau'
  if (/^(eat|brunch|resto|golvo-)/.test(id)) return 'plat'
  return null
}

/** The plate in front of the Sim, with what it ordered on it. */
function Dish({ kind }: { kind: DishKind }) {
  const food = (() => {
    switch (kind) {
      case 'garba':
        // Attiéké heaped up, the fried tuna, a bit of chili and onion.
        return (
          <>
            <Box p={[-0.04, 0.05, 0]} s={[0.17, 0.07, 0.15]} c="#f2e6c9" />
            <Box p={[0.08, 0.05, 0.02]} s={[0.12, 0.05, 0.08]} c="#9a5a22" />
            <Box p={[0.02, 0.09, -0.05]} s={[0.03, 0.02, 0.03]} c="#e03131" />
            <Box p={[-0.08, 0.09, 0.04]} s={[0.03, 0.02, 0.03]} c="#d0bfff" />
          </>
        )
      case 'poulet':
        return (
          <>
            <Box p={[0, 0.06, 0]} s={[0.16, 0.08, 0.12]} c="#8a4a1f" />
            <Box p={[0.1, 0.05, 0.05]} s={[0.05, 0.05, 0.05]} c="#e8a33c" />
            <Box p={[-0.1, 0.05, -0.04]} s={[0.05, 0.05, 0.05]} c="#e8a33c" />
            <Box p={[0.05, 0.11, -0.04]} s={[0.03, 0.02, 0.03]} c="#2b8a3e" />
          </>
        )
      case 'alloco':
        return (
          <>
            {[[-0.06, 0.03], [0.04, -0.04], [0.07, 0.05], [-0.02, -0.07], [0, 0.03]].map(([x, z], i) => (
              <Box key={i} p={[x, 0.05 + (i % 2) * 0.02, z]} s={[0.06, 0.04, 0.05]} c={i % 2 ? '#f08c00' : '#e8a33c'} />
            ))}
          </>
        )
      case 'poisson':
        return (
          <>
            <Box p={[0, 0.05, 0]} s={[0.24, 0.05, 0.09]} c="#7a5230" />
            <Box p={[0.14, 0.05, 0]} s={[0.05, 0.07, 0.03]} c="#5c3d22" />
            <Box p={[-0.04, 0.05, 0.08]} s={[0.1, 0.04, 0.05]} c="#f2e6c9" />
          </>
        )
      case 'attieke':
        return <Box p={[0, 0.05, 0]} s={[0.2, 0.08, 0.18]} c="#f2e6c9" />
      case 'burger':
        return (
          <>
            <Box p={[0, 0.04, 0]} s={[0.13, 0.03, 0.13]} c="#d9a35a" />
            <Box p={[0, 0.065, 0]} s={[0.14, 0.025, 0.14]} c="#5c3317" />
            <Box p={[0, 0.09, 0]} s={[0.13, 0.04, 0.13]} c="#d9a35a" />
            <Box p={[0.13, 0.05, 0.04]} s={[0.04, 0.06, 0.04]} c="#ffd43b" />
          </>
        )
      case 'glace':
        return (
          <>
            <Box p={[0, 0.06, 0]} s={[0.07, 0.1, 0.07]} c="#d9a35a" />
            <Box p={[0, 0.14, 0]} s={[0.09, 0.07, 0.09]} c="#f783ac" />
          </>
        )
      case 'bouillie':
        return <Box p={[0, 0.05, 0]} s={[0.14, 0.07, 0.14]} c="#e9d8a6" />
      case 'gateau':
        return (
          <>
            <Box p={[0, 0.07, 0]} s={[0.26, 0.12, 0.26]} c="#f8f9fa" />
            <Box p={[0, 0.13, 0]} s={[0.27, 0.02, 0.27]} c="#f783ac" />
            {[-0.07, 0, 0.07].map((x) => (
              <group key={x}>
                <Box p={[x, 0.18, 0]} s={[0.015, 0.07, 0.015]} c="#74c0fc" />
                <Box p={[x, 0.225, 0]} s={[0.02, 0.025, 0.02]} c="#ffd43b" glow={1} />
              </group>
            ))}
          </>
        )
      default:
        return (
          <>
            <Box p={[-0.04, 0.05, 0]} s={[0.14, 0.06, 0.14]} c="#f2e6c9" />
            <Box p={[0.07, 0.05, 0.02]} s={[0.1, 0.05, 0.08]} c="#b8562a" />
          </>
        )
    }
  })()
  return (
    <group position={TABLE}>
      {/* The plate, the fork beside it, a sachet of water */}
      <Box p={[0, 0.01, 0]} s={[0.34, 0.02, 0.3]} c="#ffffff" />
      {food}
      <Box p={[0.24, 0.015, 0]} s={[0.02, 0.01, 0.2]} c="#c3c7cf" />
      <Box p={[-0.28, 0.04, -0.06]} s={[0.09, 0.07, 0.04]} c="#d0ebff" />
    </group>
  )
}

/** The bottles on the table (or the milkshake). */
function Drinks({ milk }: { milk: boolean }) {
  if (milk)
    return (
      <group position={TABLE}>
        <Box p={[0, 0.09, 0]} s={[0.08, 0.18, 0.08]} c="#f783ac" />
        <Box p={[0.02, 0.22, 0]} s={[0.012, 0.12, 0.012]} c="#ffffff" />
      </group>
    )
  return (
    <group position={TABLE}>
      <Box p={[-0.08, 0.13, 0]} s={[0.07, 0.26, 0.07]} c="#2b7a3d" />
      <Box p={[-0.08, 0.29, 0]} s={[0.03, 0.06, 0.03]} c="#2b7a3d" />
      <Box p={[0.1, 0.06, 0.04]} s={[0.07, 0.12, 0.07]} c="#f4f1ea" />
      <Box p={[0.1, 0.1, 0.04]} s={[0.06, 0.04, 0.06]} c="#e8a33c" />
    </group>
  )
}

/* ---------- In the room (home) ---------- */

/** The TV on, its picture changing. */
export function TvScreen() {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#4dabf7' }), [])
  useFrame(() => {
    const t = worldTime()
    const k = Math.floor(t * 1.3)
    mat.color.setHSL(((k * 0.37) % 1 + 1) % 1, 0.55, 0.45 + Math.sin(t * 9) * 0.04)
  })
  return (
    <mesh position={[1.5, 0.9, 3.84]} rotation={[0, Math.PI, 0]} material={mat}>
      <planeGeometry args={[1.45, 0.78]} />
    </mesh>
  )
}

/** The pot on the stove, the steam. */
export function Pot() {
  const puffs = useRef<THREE.InstancedMesh>(null)
  const o = useMemo(() => new THREE.Object3D(), [])
  useFrame(() => {
    const t = worldTime()
    if (!puffs.current) return
    for (let i = 0; i < 5; i++) {
      const k = (t * 0.4 + i / 5) % 1
      o.position.set(Math.sin(i * 2.4) * 0.1, 1.15 + k * 1.1, Math.cos(i * 2.4) * 0.1)
      o.scale.setScalar(0.12 + k * 0.25)
      o.updateMatrix()
      puffs.current.setMatrixAt(i, o.matrix)
    }
    puffs.current.instanceMatrix.needsUpdate = true
  })
  return (
    <group position={[5.2, 0, -3.6]}>
      <Box p={[0, 1.04, 0]} s={[0.42, 0.24, 0.42]} c="#3a3d42" />
      <Box p={[0, 1.17, 0]} s={[0.36, 0.02, 0.36]} c="#f2e6c9" />
      <Box p={[0.12, 1.3, 0]} s={[0.03, 0.35, 0.03]} c="#7a5233" />
      <instancedMesh ref={puffs} args={[BOX, steam, 5]} frustumCulled={false} />
    </group>
  )
}

/** Z… z… z… rising from the sleeper. */
export function Zzz({ at }: { at: [number, number, number] }) {
  const g = useRef<THREE.Group>(null)
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 16
    const x = c.getContext('2d')!
    x.fillStyle = '#ffffff'
    for (const [px, py] of [[3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [8, 3], [9, 3], [10, 3], [11, 3], [12, 3], [11, 4], [10, 5], [9, 6], [8, 7], [7, 8], [6, 9], [5, 10], [4, 11], [3, 12], [4, 12], [5, 12], [6, 12], [7, 12], [8, 12], [9, 12], [10, 12], [11, 12], [12, 12]]) x.fillRect(px, py, 1, 1)
    const t = new THREE.CanvasTexture(c)
    t.magFilter = THREE.NearestFilter
    return t
  }, [])
  useFrame(() => {
    const t = worldTime()
    g.current?.children.forEach((z, i) => {
      const k = (t * 0.35 + i / 3) % 1
      z.position.set(Math.sin(k * 6 + i) * 0.15, k * 1.2, 0)
      z.scale.setScalar(0.18 + k * 0.25)
      ;((z as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 1 - k
    })
  })
  return (
    <group ref={g} position={at}>
      {[0, 1, 2].map((i) => (
        <mesh key={i}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={tex} transparent depthWrite={false} color="#c5d4ff" />
        </mesh>
      ))}
    </group>
  )
}
