import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { XZ } from './geo'
import { worldTime } from '../../lib/worldClock'

// The airport (Port-Bouët): the terminal, its control tower and planes at the
// gates, drawn by the game at the place; the runway and the taxiways come from
// the map. A plane takes off down the real runway now and then. The terminal's
// shape is an estimate: what the sources agree on is one runway, 03/21, about
// 3 000 m by 45 m, and a tower open day and night.

const white = new THREE.MeshLambertMaterial({ color: '#f4f5f7' })
const grey = new THREE.MeshLambertMaterial({ color: '#c3c8cf' })
const dark = new THREE.MeshLambertMaterial({ color: '#2e3540' })
const glass = new THREE.MeshLambertMaterial({ color: '#4d7da8', emissive: '#16324d', emissiveIntensity: 0.4 })
const orange = new THREE.MeshLambertMaterial({ color: '#f08a24' })
const green = new THREE.MeshLambertMaterial({ color: '#1f9a4a' })
const concrete = new THREE.MeshLambertMaterial({ color: '#bdb8ad' })

/** An airliner, in the game's own colours. Local +z is the nose; it stands on its wheels at y = 0. */
export function Airliner({ gear = true }: { gear?: boolean }) {
  const wing = useMemo(() => {
    // A swept wing, both sides: a flat shape seen from above.
    const s = new THREE.Shape()
    s.moveTo(0, 3)
    s.lineTo(17, -3.5)
    s.lineTo(17, -5.2)
    s.lineTo(0, -3.5)
    s.lineTo(-17, -5.2)
    s.lineTo(-17, -3.5)
    s.closePath()
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.5, bevelEnabled: false })
    g.rotateX(Math.PI / 2)
    return g
  }, [])
  const tail = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(0, 0)
    s.lineTo(-5.5, 0)
    s.lineTo(-8.5, 7)
    s.lineTo(-6.5, 7)
    s.closePath()
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.4, bevelEnabled: false })
    g.rotateY(-Math.PI / 2)
    g.translate(-0.2, 0, 0)
    return g
  }, [])
  const y = 3.2 // the fuselage's axis above the ground
  return (
    <group>
      {/* Fuselage, nose and tail cone */}
      <mesh position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} material={white} castShadow>
        <cylinderGeometry args={[2, 2, 32, 16]} />
      </mesh>
      <mesh position={[0, y, 17.6]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.7]} material={white} castShadow>
        <sphereGeometry args={[2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh position={[0, y + 0.5, -19.5]} rotation={[-Math.PI / 2, 0, 0]} material={white} castShadow>
        <coneGeometry args={[2, 7, 16]} />
      </mesh>
      {/* The livery: a band along the windows, the cockpit */}
      <mesh position={[0, y + 0.55, 0]} rotation={[Math.PI / 2, 0, 0]} material={orange}>
        <cylinderGeometry args={[2.02, 2.02, 30, 16, 1, true, -Math.PI / 2 - 0.25, 0.5]} />
      </mesh>
      <mesh position={[0, y + 0.55, 0]} rotation={[Math.PI / 2, 0, 0]} material={orange}>
        <cylinderGeometry args={[2.02, 2.02, 30, 16, 1, true, Math.PI / 2 - 0.25, 0.5]} />
      </mesh>
      <mesh position={[0, y + 1.1, 17.4]} rotation={[0.5, 0, 0]} material={dark}>
        <boxGeometry args={[2.4, 0.6, 1]} />
      </mesh>
      {/* Wings and engines */}
      <mesh geometry={wing} position={[0, y - 1, 0]} material={grey} castShadow />
      {[-6.5, 6.5].map((x) => (
        <group key={x} position={[x, y - 2.1, 1.2]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={grey} castShadow>
            <cylinderGeometry args={[1.1, 1, 4.5, 12]} />
          </mesh>
          <mesh position={[0, 0, 2.26]} rotation={[Math.PI / 2, 0, 0]} material={dark}>
            <circleGeometry args={[0.95, 12]} />
          </mesh>
        </group>
      ))}
      {/* The tail: fin in the game's green, small wings */}
      <mesh geometry={tail} position={[0, y + 1.2, -14]} material={green} castShadow />
      <mesh position={[0, y + 1, -19.5]} material={grey} castShadow>
        <boxGeometry args={[12, 0.35, 2.6]} />
      </mesh>
      {/* Wheels */}
      {gear &&
        [
          [0, 13],
          [-2.6, -1],
          [2.6, -1],
        ].map(([x, z]) => (
          <mesh key={`${x}${z}`} position={[x, 0.55, z]} rotation={[0, 0, Math.PI / 2]} material={dark}>
            <cylinderGeometry args={[0.55, 0.55, 0.8, 10]} />
          </mesh>
        ))}
      {gear &&
        [
          [0, 13],
          [-2.6, -1],
          [2.6, -1],
        ].map(([x, z]) => (
          <mesh key={`l${x}${z}`} position={[x, 1.6, z]} material={grey}>
            <boxGeometry args={[0.25, 2, 0.25]} />
          </mesh>
        ))}
    </group>
  )
}

/** The terminal and its tower, planes at the gates behind. Local +z is the street (the departures kerb). */
export function Airport({ night }: { night: boolean }) {
  glass.emissiveIntensity = night ? 0.9 : 0.4
  const roof = useMemo(() => {
    // A long, gently curved roof.
    const g = new THREE.CylinderGeometry(60, 60, 220, 32, 1, true, -0.35, 0.7)
    g.rotateZ(Math.PI / 2)
    g.rotateX(-Math.PI / 2)
    return g
  }, [])
  return (
    <group>
      {/* The kerb and the forecourt */}
      <mesh position={[0, 0.05, 22]} rotation={[-Math.PI / 2, 0, 0]} material={concrete} receiveShadow>
        <planeGeometry args={[230, 16]} />
      </mesh>
      {/* The hall: glass between white pillars, under a curved roof */}
      <mesh position={[0, 7, 0]} material={glass} castShadow receiveShadow>
        <boxGeometry args={[210, 14, 34]} />
      </mesh>
      {[...Array(15)].map((_, i) => (
        <mesh key={i} position={[-105 + i * 15, 7, 17.2]} material={white}>
          <boxGeometry args={[1.4, 14, 0.8]} />
        </mesh>
      ))}
      <mesh geometry={roof} position={[0, 14 - 60 * Math.cos(0.35) + 0.5, 0]} material={white} castShadow />
      {/* The canopy over the kerb */}
      <mesh position={[0, 6, 22]} material={white} castShadow>
        <boxGeometry args={[200, 0.6, 10]} />
      </mesh>
      {/* The pier with its jet bridges, toward the apron */}
      <mesh position={[0, 5, -35]} material={grey} castShadow>
        <boxGeometry args={[160, 9, 16]} />
      </mesh>
      {[-50, 0, 50].map((x) => (
        <group key={x}>
          <mesh position={[x, 5, -50]} material={grey} castShadow>
            <boxGeometry args={[3.2, 3, 14]} />
          </mesh>
          <group position={[x - 6, 0, -77]}>
            <Airliner />
          </group>
        </group>
      ))}
      {/* The control tower */}
      <group position={[125, 0, -20]}>
        <mesh position={[0, 20, 0]} material={white} castShadow>
          <cylinderGeometry args={[3.2, 4, 40, 16]} />
        </mesh>
        <mesh position={[0, 41, 0]} material={white} castShadow>
          <cylinderGeometry args={[7, 5, 3, 8]} />
        </mesh>
        <mesh position={[0, 44.5, 0]} material={glass}>
          <cylinderGeometry args={[7.2, 6.8, 4, 8]} />
        </mesh>
        <mesh position={[0, 47, 0]} material={dark} castShadow>
          <cylinderGeometry args={[7.8, 7.8, 1, 8]} />
        </mesh>
        <mesh position={[0, 50, 0]} material={grey}>
          <cylinderGeometry args={[0.2, 0.2, 5, 6]} />
        </mesh>
      </group>
    </group>
  )
}

/**
 * A plane taking off down the longest runway loaded: it rolls, lifts off,
 * climbs out and is gone; then another, a minute later.
 */
export function TakeOff({ runways }: { runways: XZ[][] }) {
  const g = useRef<THREE.Group>(null)
  // The longest straight stretch of runway.
  const line = useMemo(() => {
    let best: [XZ, XZ] | null = null
    let bl = 0
    for (const pts of runways) {
      const [a, b] = [pts[0], pts[pts.length - 1]]
      const l = Math.hypot(b[0] - a[0], b[1] - a[1])
      if (l > bl) [best, bl] = [[a, b], l]
    }
    return bl > 600 ? best : null
  }, [runways])
  const t0 = useRef(0)
  useFrame(() => {
    const p = g.current
    if (!p) return
    if (!line) return void (p.visible = false)
    const [a, b] = line
    const L = Math.hypot(b[0] - a[0], b[1] - a[1])
    const [ux, uz] = [(b[0] - a[0]) / L, (b[1] - a[1]) / L]
    const CYCLE = 75
    const t = (worldTime() - t0.current) % CYCLE
    // Roll for 30 s speeding up to ~80 m/s, then climb.
    const ROLL = 30
    const acc = 2.6
    const d = t < ROLL ? 0.5 * acc * t * t : 0.5 * acc * ROLL * ROLL + acc * ROLL * (t - ROLL)
    const lift = Math.max(0, d - L * 0.7)
    const climb = Math.min(0.2, lift / 600)
    p.visible = d < L * 0.7 + 4000
    p.position.set(a[0] + ux * d, lift * 0.18, a[1] + uz * d)
    p.rotation.set(-climb, Math.atan2(ux, uz), 0, 'YXZ')
  })
  if (!line) return null
  return (
    <group ref={g}>
      <Airliner />
    </group>
  )
}

/**
 * A plane coming in: down the glide path to the far end of the runway,
 * touching down and rolling out, between the take-offs (TakeOff).
 */
export function Landing({ runways }: { runways: XZ[][] }) {
  const g = useRef<THREE.Group>(null)
  const line = useMemo(() => {
    let best: [XZ, XZ] | null = null
    let bl = 0
    for (const pts of runways) {
      const [a, b] = [pts[0], pts[pts.length - 1]]
      const l = Math.hypot(b[0] - a[0], b[1] - a[1])
      if (l > bl) [best, bl] = [[b, a], l] // the other way from the take-offs
    }
    return bl > 600 ? best : null
  }, [runways])
  useFrame(() => {
    const p = g.current
    if (!p || !line) return
    const [a, b] = line
    const L = Math.hypot(b[0] - a[0], b[1] - a[1])
    const [ux, uz] = [(b[0] - a[0]) / L, (b[1] - a[1]) / L]
    // Half a cycle after the take-off: 50 s of approach from 6 km out, 3° down, then the roll-out.
    const CYCLE = 75
    const t = (worldTime() + CYCLE / 2) % CYCLE
    const APPROACH = 50
    const d = t < APPROACH ? -6000 * (1 - t / APPROACH) : Math.min(L * 0.6, 70 * (t - APPROACH) - 0.9 * (t - APPROACH) ** 2)
    const y = d < 0 ? -d * Math.tan((3 * Math.PI) / 180) : 0
    p.visible = t < APPROACH + 30
    p.position.set(a[0] + ux * d, y, a[1] + uz * d)
    p.rotation.set(d < 0 ? 0.04 : 0, Math.atan2(ux, uz), 0, 'YXZ')
  })
  if (!line) return null
  return (
    <group ref={g}>
      <Airliner />
    </group>
  )
}

const trail = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false })
const trailGeo = new THREE.BoxGeometry(1.2, 1.2, 1)

/**
 * Airliners crossing the sky over the town, high up, with their white
 * trails: the same on every screen (the shared clock). Each on its own line
 * and at its own pace, a few minutes apart.
 */
export function SkyPlanes({ focus }: { focus: React.RefObject<XZ> }) {
  const planes = useMemo(
    () =>
      [0, 1, 2].map((i) => ({
        heading: 0.7 + i * 2.1,
        y: 650 + i * 180,
        speed: 160 + i * 30, // m/s
        offset: i * 47,
        cycle: 110 + i * 25,
        side: (i - 1) * 900,
      })),
    [],
  )
  const refs = useRef<(THREE.Group | null)[]>([])
  useFrame(() => {
    const [fx, fz] = focus.current ?? [0, 0]
    // Their lines pass over the town round the Sim, a few kilometres either way (the fog hides the ends).
    const cx = Math.round(fx / 4000) * 4000
    const cz = Math.round(fz / 4000) * 4000
    planes.forEach((pl, i) => {
      const g = refs.current[i]
      if (!g) return
      const t = (worldTime() + pl.offset) % pl.cycle
      const half = (pl.speed * pl.cycle) / 2
      const d = pl.speed * t - half
      const [ux, uz] = [Math.sin(pl.heading), Math.cos(pl.heading)]
      g.position.set(cx + ux * d - uz * pl.side, pl.y, cz + uz * d + ux * pl.side)
      g.rotation.set(0, pl.heading, 0)
    })
  })
  return (
    <>
      {planes.map((_, i) => (
        <group key={i} ref={(g) => void (refs.current[i] = g)}>
          <Airliner gear={false} />
          {/* The trail: a long thin white streak behind each engine */}
          {[-6, 6].map((x) => (
            <mesh key={x} geometry={trailGeo} material={trail} position={[x, 1, -260]} scale={[1, 1, 500]} />
          ))}
        </group>
      ))}
    </>
  )
}
