import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { pointInRing, type XZ } from './geo'

// Life on the water: the lagoon's bateaux-bus crossing between the banks,
// and pirogues, a boatman standing at the back, poling or with an outboard.
// They go from one point of the water to another in a straight line that
// stays on the water, around the Sim; the loaded chunks are their world.

type Boat = { kind: 'bus' | 'pirogue'; x: number; z: number; heading: number; to: XZ | null; speed: number; seed: number }

const MAX = { bus: 2, pirogue: 6 }
const AROUND = 650 // metres from the Sim where boats live

export function Boats({ water, focus }: { water: XZ[][][]; focus: React.RefObject<XZ> }) {
  // Is a point on the water: inside an area's outer ring, not in its holes.
  const wet = useMemo(() => {
    const boxes = water.map((rings) => {
      let [x0, z0, x1, z1] = [Infinity, Infinity, -Infinity, -Infinity]
      for (const [x, z] of rings[0]) [x0, z0, x1, z1] = [Math.min(x0, x), Math.min(z0, z), Math.max(x1, x), Math.max(z1, z)]
      return { rings, x0, z0, x1, z1 }
    })
    return ([x, z]: XZ) => boxes.some((b) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && pointInRing([x, z], b.rings[0]) && !b.rings.slice(1).some((h) => pointInRing([x, z], h)))
  }, [water])
  // A boat keeps 12 m from the bank: the whole way, sampled.
  const clear = (a: XZ, b: XZ) => {
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 8))
    for (let i = 0; i <= n; i++) {
      const [x, z] = [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n]
      if (!wet([x, z]) || !wet([x + 12, z]) || !wet([x - 12, z]) || !wet([x, z + 12]) || !wet([x, z - 12])) return false
    }
    return true
  }

  const boats = useRef<Boat[]>([])
  const groups = useRef<(THREE.Group | null)[]>([])
  const pool = useMemo(() => [...Array(MAX.bus + MAX.pirogue)].map((_, i) => (i < MAX.bus ? 'bus' : 'pirogue') as Boat['kind']), [])
  const seed = useRef(1)
  const rand = () => ((seed.current = (seed.current * 16807) % 2147483647) / 2147483647)

  // The water changed (chunks came and went): boats no longer on it go.
  useEffect(() => {
    boats.current = boats.current.filter((b) => wet([b.x, b.z]))
  }, [wet])

  const spawnTick = useRef(0)
  useFrame(({ clock }, dt) => {
    const [fx, fz] = focus.current ?? [0, 0]
    dt = Math.min(dt, 0.1)
    // A new boat now and then, on the water near the Sim.
    spawnTick.current += dt
    if (spawnTick.current > 0.5 && water.length) {
      spawnTick.current = 0
      for (const kind of ['bus', 'pirogue'] as const) {
        if (boats.current.filter((b) => b.kind === kind).length >= MAX[kind]) continue
        const p: XZ = [fx + (rand() - 0.5) * AROUND * 2, fz + (rand() - 0.5) * AROUND * 2]
        if (clear(p, p)) boats.current.push({ kind, x: p[0], z: p[1], heading: rand() * Math.PI * 2, to: null, speed: kind === 'bus' ? 6 : 1.6 + rand() * 1.2, seed: rand() * 100 })
      }
    }
    boats.current = boats.current.filter((b) => Math.hypot(b.x - fx, b.z - fz) < AROUND * 1.6)
    for (const b of boats.current) {
      if (!b.to) {
        // Somewhere else on the water, reachable in a straight line.
        for (let k = 0; k < 6 && !b.to; k++) {
          const a = rand() * Math.PI * 2
          const d = (b.kind === 'bus' ? 250 : 80) + rand() * 300
          const t: XZ = [b.x + Math.cos(a) * d, b.z + Math.sin(a) * d]
          if (clear([b.x, b.z], t)) b.to = t
        }
        if (!b.to) continue
      }
      const [dx, dz] = [b.to[0] - b.x, b.to[1] - b.z]
      const d = Math.hypot(dx, dz)
      if (d < 4) {
        b.to = null
        continue
      }
      // Turn gently toward the target, then go.
      const want = Math.atan2(dx, dz)
      let turn = want - b.heading
      turn = Math.atan2(Math.sin(turn), Math.cos(turn))
      b.heading += Math.sign(turn) * Math.min(Math.abs(turn), dt * (b.kind === 'bus' ? 0.35 : 0.8))
      const go = b.speed * dt * Math.max(0, Math.cos(turn))
      b.x += Math.sin(b.heading) * go
      b.z += Math.cos(b.heading) * go
    }
    // Draw: each boat in its slot of the pool, bobbing on the water.
    const t = clock.elapsedTime
    pool.forEach((kind, i) => {
      const g = groups.current[i]
      if (!g) return
      const b = boats.current.filter((x) => x.kind === kind)[kind === 'bus' ? i : i - MAX.bus]
      g.visible = !!b
      if (!b) return
      g.position.set(b.x, 0.05 + Math.sin(t * 1.3 + b.seed) * 0.08, b.z)
      g.rotation.set(Math.sin(t * 0.9 + b.seed) * 0.02, b.heading, Math.sin(t * 1.1 + b.seed) * 0.035)
    })
  })

  return (
    <>
      {pool.map((kind, i) => (
        <group key={i} ref={(g) => void (groups.current[i] = g)} visible={false}>
          {kind === 'bus' ? <BateauBus /> : <Pirogue motor={i % 2 === 0} />}
        </group>
      ))}
    </>
  )
}

const white = new THREE.MeshLambertMaterial({ color: '#f4f4f0' })
const band = new THREE.MeshLambertMaterial({ color: '#1f6fb5' })
const glass = new THREE.MeshLambertMaterial({ color: '#27384a' })
const wood = new THREE.MeshLambertMaterial({ color: '#7a4a26' })
const paint = new THREE.MeshLambertMaterial({ color: '#e0b532' })
const inside = new THREE.MeshLambertMaterial({ color: '#4a2c14' })
const dark = new THREE.MeshLambertMaterial({ color: '#2b2b2b' })
const skin = new THREE.MeshLambertMaterial({ color: '#5a3622' })
const shirt = new THREE.MeshLambertMaterial({ color: '#c8452f' })
const wake = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide })

/** A wake: a white V behind the boat. */
function Wake({ length, width }: { length: number; width: number }) {
  const g = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(-width / 2, 0)
    s.lineTo(width / 2, 0)
    s.lineTo(width * 1.6, -length)
    s.lineTo(-width * 1.6, -length)
    s.closePath()
    const geo = new THREE.ShapeGeometry(s)
    geo.rotateX(Math.PI / 2)
    return geo
  }, [length, width])
  return <mesh geometry={g} material={wake} position={[0, 0.02, 0]} />
}

/** The lagoon's bateau-bus: a white hull with a blue band, a cabin of windows. Local +z is forward. */
export function BateauBus() {
  return (
    <group>
      <mesh position={[0, 0.6, 0]} material={white} castShadow>
        <boxGeometry args={[5, 1.6, 18]} />
      </mesh>
      <mesh position={[0, 0.9, 9.6]} rotation={[0, Math.PI / 4, 0]} material={white} castShadow>
        <boxGeometry args={[3.2, 1.6, 3.2]} />
      </mesh>
      <mesh position={[0, 0.5, 0]} material={band}>
        <boxGeometry args={[5.05, 0.35, 18.05]} />
      </mesh>
      <mesh position={[0, 2.5, -0.5]} material={glass} castShadow>
        <boxGeometry args={[4.4, 2.2, 13]} />
      </mesh>
      {[-6, -3, 0, 3, 6].map((z) => (
        <mesh key={z} position={[0, 2.5, z - 0.5]} material={white}>
          <boxGeometry args={[4.5, 2.2, 0.35]} />
        </mesh>
      ))}
      <mesh position={[0, 3.75, -0.5]} material={white} castShadow>
        <boxGeometry args={[4.8, 0.3, 14]} />
      </mesh>
      <mesh position={[0, 4.3, 4.5]} material={band}>
        <boxGeometry args={[2.2, 0.9, 2]} />
      </mesh>
      <Wake length={16} width={4.6} />
    </group>
  )
}

/** A pirogue: a long wooden canoe, a painted rim, a boatman at the back. */
export function Pirogue({ motor }: { motor: boolean }) {
  const hull = useMemo(() => {
    // A canoe: pointed at both ends.
    const s = new THREE.Shape()
    s.moveTo(0, 4.5)
    s.quadraticCurveTo(0.75, 2, 0.7, 0)
    s.quadraticCurveTo(0.75, -2, 0, -4.5)
    s.quadraticCurveTo(-0.75, -2, -0.7, 0)
    s.quadraticCurveTo(-0.75, 2, 0, 4.5)
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.6, bevelEnabled: false })
    g.rotateX(-Math.PI / 2)
    g.translate(0, -0.15, 0)
    g.scale(1, 1, -1)
    return g
  }, [])
  return (
    <group>
      <mesh geometry={hull} material={wood} castShadow />
      {/* The painted rim along both sides, and the benches across */}
      {[-1, 1].map((x) => (
        <mesh key={x} position={[x * 0.62, 0.47, 0]} rotation={[0, x * 0.02, 0]} material={paint}>
          <boxGeometry args={[0.1, 0.08, 6.4]} />
        </mesh>
      ))}
      {[-1.5, 0.5, 2.2].map((z) => (
        <mesh key={z} position={[0, 0.4, z]} material={wood}>
          <boxGeometry args={[1.25, 0.06, 0.3]} />
        </mesh>
      ))}
      <mesh position={[0, 0.3, 0]} material={inside}>
        <boxGeometry args={[1.05, 0.02, 7]} />
      </mesh>
      {/* The boatman */}
      <group position={[0, 0.45, -3]}>
        <mesh position={[0, 0.45, 0]} material={dark}>
          <boxGeometry args={[0.32, 0.9, 0.25]} />
        </mesh>
        <mesh position={[0, 1.2, 0]} material={shirt}>
          <boxGeometry args={[0.45, 0.65, 0.28]} />
        </mesh>
        <mesh position={[0, 1.72, 0]} material={skin}>
          <boxGeometry args={[0.28, 0.32, 0.28]} />
        </mesh>
        {!motor && (
          <mesh position={[0.4, 1, 0.3]} rotation={[0.5, 0, -0.15]} material={wood}>
            <cylinderGeometry args={[0.04, 0.04, 4, 5]} />
          </mesh>
        )}
      </group>
      {motor && (
        <mesh position={[0, 0.5, -4.4]} material={dark}>
          <boxGeometry args={[0.35, 0.8, 0.45]} />
        </mesh>
      )}
      <Wake length={motor ? 9 : 3} width={0.7} />
    </group>
  )
}
