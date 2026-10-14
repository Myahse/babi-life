import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { pointInRing, type XZ } from './geo'
import { along, round, turnTo, useCellsAround } from './shared'
import { rng } from '../themes'
import { worldTime } from '../../lib/worldClock'

// Life on the water: the lagoon's bateaux-bus crossing between the banks,
// and pirogues, a boatman standing at the back, poling or with an outboard.
// They cross in a straight line that stays on the water and come back, on a
// schedule every player shares; the loaded chunks are their world.

type Boat = { id: string; kind: 'bus' | 'pirogue'; anchor: XZ; speed: number; cycle: number; offset: number; seed: number }

const CELL = 400 // metres: each square of water may have one boat
const AROUND = 1 // cells around the Sim's

/**
 * The boats near the Sim, the same on every screen (see shared.ts): each
 * square of water has at most one, anchored at a spot of open water; each
 * round it crosses to a point drawn for that round, waits, and comes back.
 */
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
  const clear = useMemo(
    () => (a: XZ, b: XZ) => {
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 8))
      for (let i = 0; i <= n; i++) {
        const [x, z] = [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n]
        if (!wet([x, z]) || !wet([x + 12, z]) || !wet([x - 12, z]) || !wet([x, z + 12]) || !wet([x, z - 12])) return false
      }
      return true
    },
    [wet],
  )
  const cells = useCellsAround(focus, CELL, AROUND)
  const boats = useMemo(() => {
    if (!water.length) return []
    const out: Boat[] = []
    for (const cell of cells) {
      const r = rng(`boat|${cell.key}`)
      const bus = r() < 0.3
      for (let k = 0; k < 6; k++) {
        const p: XZ = [cell.x0 + r() * CELL, cell.z0 + r() * CELL]
        if (!clear(p, p)) continue
        out.push({ id: cell.key, kind: bus ? 'bus' : 'pirogue', anchor: p, speed: bus ? 6 : 1.6 + r() * 1.2, cycle: bus ? 240 : 360, offset: r() * 360, seed: r() * 100 })
        break
      }
    }
    return out
  }, [cells, clear, water.length])
  return (
    <>
      {boats.map((b) => (
        <BoatOnWater key={b.id} boat={b} clear={clear} />
      ))}
    </>
  )
}

function BoatOnWater({ boat, clear }: { boat: Boat; clear: (a: XZ, b: XZ) => boolean }) {
  const g = useRef<THREE.Group>(null)
  // Where it crosses to, round after round (the same on every phone).
  const targets = useMemo(() => new Map<number, XZ | null>(), [clear]) // eslint-disable-line react-hooks/exhaustive-deps
  const target = (n: number) => {
    if (!targets.has(n)) {
      const r = rng(`boat|${boat.id}|${n}`)
      let to: XZ | null = null
      for (let k = 0; k < 6 && !to; k++) {
        const a = r() * Math.PI * 2
        const d = (boat.kind === 'bus' ? 250 : 80) + r() * 300
        const t: XZ = [boat.anchor[0] + Math.cos(a) * d, boat.anchor[1] + Math.sin(a) * d]
        if (clear(boat.anchor, t)) to = t
      }
      if (targets.size > 50) targets.clear()
      targets.set(n, to)
    }
    return targets.get(n) ?? null
  }
  const heading = useRef<number | null>(null)
  useFrame((_, dt) => {
    const grp = g.current
    if (!grp) return
    const t = worldTime()
    const len = (n: number) => {
      const to = target(n)
      return to ? Math.hypot(to[0] - boat.anchor[0], to[1] - boat.anchor[1]) : 0
    }
    const at = round(t, boat.cycle, boat.offset, len, boat.speed)
    const to = target(at.n) ?? boat.anchor
    const p = along([boat.anchor, to], at.d)
    const want = at.forward ? p.r : p.r + Math.PI
    // Turning about at each end takes a moment.
    heading.current = heading.current === null ? want : turnTo(heading.current, want, 1 - Math.exp(-(boat.kind === 'bus' ? 0.8 : 1.6) * Math.min(dt, 0.1)))
    grp.position.set(p.x, 0.05 + Math.sin(t * 1.3 + boat.seed) * 0.08, p.z)
    grp.rotation.set(Math.sin(t * 0.9 + boat.seed) * 0.02, heading.current, Math.sin(t * 1.1 + boat.seed) * 0.035)
  })
  return <group ref={g}>{boat.kind === 'bus' ? <BateauBus /> : <Pirogue motor={boat.seed > 50} />}</group>
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
