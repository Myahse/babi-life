import { useLayoutEffect, useMemo, useRef } from 'react'
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

const belly = new THREE.MeshLambertMaterial({ color: '#e3e6ea' })
const window_ = new THREE.MeshLambertMaterial({ color: '#1d2a3a', emissive: '#0d1622', emissiveIntensity: 0.3 })
const metal = new THREE.MeshLambertMaterial({ color: '#9aa3ad' })
const tyre = new THREE.MeshLambertMaterial({ color: '#1a1d22' })
// The lights: steady red (left) and green (right) wingtips, white strobes and red beacons flashing (Airliner's useFrame).
const navRed = new THREE.MeshBasicMaterial({ color: '#ff2a2a' })
const navGreen = new THREE.MeshBasicMaterial({ color: '#2aff6a' })
const strobe = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true })
const beacon = new THREE.MeshBasicMaterial({ color: '#ff3030', transparent: true })
const lamp = new THREE.SphereGeometry(0.22, 8, 6)

/** The fuselage, round and tapered: the nose's curve, the long body, the tail rising to the fin (local +z the nose). */
function fuselageGeometry() {
  // The radius along the plane, tail (z = -22) to nose (z = 19), as a profile turned round the axis.
  const pts: THREE.Vector2[] = [new THREE.Vector2(0, -22.1)]
  const R = 2
  for (let i = 10; i >= 1; i--) {
    const k = i / 10
    // The tail: narrowing over 10 m to a small cone.
    pts.push(new THREE.Vector2(R * (1 - 0.82 * k ** 1.3), -12 - 10 * k))
  }
  pts.push(new THREE.Vector2(R, -12), new THREE.Vector2(R, 14))
  for (let i = 1; i <= 14; i++) {
    // The nose: a quarter ellipse over its last 5 m, to a point.
    const a = ((14 - i) / 14) * (Math.PI / 2)
    pts.push(new THREE.Vector2(i === 14 ? 0 : R * Math.sin(a) ** 0.85, 14 + 5 * Math.cos(a)))
  }
  // The lathe turns round y: points ordered from the tail up, then the axis laid along z.
  const g = new THREE.LatheGeometry(pts, 24)
  g.rotateX(Math.PI / 2)
  // The tail's underside sweeps up, as an airliner's does.
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i)
    if (z < -12) pos.setY(i, pos.getY(i) + ((-12 - z) / 10) ** 1.6 * 1.25)
  }
  g.computeVertexNormals()
  return g
}

/** A swept wing, its tip a bit higher (the dihedral), seen from above: the left one (x < 0); the right mirrored. */
function wingGeometry() {
  const s = new THREE.Shape()
  s.moveTo(0, 3.4)
  s.lineTo(-17, -4)
  s.lineTo(-17, -5.4)
  s.lineTo(-6, -2.6)
  s.lineTo(0, -3.6)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.45, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 1 })
  g.rotateX(Math.PI / 2)
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) + -pos.getX(i) * 0.07)
  g.computeVertexNormals()
  return g
}

/** The fin, swept back. */
function finGeometry() {
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  s.lineTo(-6.5, 0)
  s.lineTo(-9.3, 7.4)
  s.lineTo(-7, 7.4)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.36, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 1 })
  g.rotateY(-Math.PI / 2)
  g.translate(-0.18, 0, 0)
  return g
}

/** The fin's flag of Air Lagune (the game's airline): orange, white, green, then its two letters. */
function finTexture() {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = '#f08a24'
  g.fillRect(0, 0, 128, 128)
  g.fillStyle = '#ffffff'
  g.fillRect(0, 52, 128, 24)
  g.fillStyle = '#1f9a4a'
  g.fillRect(0, 76, 128, 52)
  g.fillStyle = '#ffffff'
  g.font = 'bold 34px sans-serif'
  g.textAlign = 'center'
  g.fillText('AL', 64, 40)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  // (The fin's faces have their shape's metres as UVs: x from -9.3 to 0, y from 0 to 7.4.)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(1 / 9.3, 1 / 7.4)
  return t
}

let shared: { body: THREE.BufferGeometry; wing: THREE.BufferGeometry; fin: THREE.BufferGeometry; finMat: THREE.Material } | null = null
const parts = () =>
  (shared ??= {
    body: fuselageGeometry(),
    wing: wingGeometry(),
    fin: finGeometry(),
    finMat: typeof document === 'undefined' ? green : new THREE.MeshLambertMaterial({ map: finTexture() }),
  })

/** The airliner's shapes (the fuselage, a wing, the fin and its painted material), for the planes drawn many at once (skyLife.tsx). */
export const airlinerParts = parts

/** The windows along both sides, and the doors (one draw for them all). */
function Windows({ y }: { y: number }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const spots = useMemo(() => {
    const out: [number, number, number, number, number][] = []
    for (const side of [-1, 1]) {
      for (let z = -11; z <= 13; z += 0.95) if (Math.abs(z - 1) > 0.6) out.push([side * 1.97, y + 0.55, z, 0.42, 0.28])
      // The doors: front and back
      for (const z of [15.2, -10.4]) out.push([side * 1.96, y - 0.1, z, 1.7, 0.9])
    }
    return out
  }, [y])
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new THREE.Object3D()
    spots.forEach(([x, yy, z, h, w], i) => {
      o.position.set(x, yy, z)
      o.rotation.set(0, Math.sign(x) * (Math.PI / 2), 0)
      o.scale.set(w, h, 0.06)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  }, [spots])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, spots.length]} material={window_} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
    </instancedMesh>
  )
}

/** An engine under the wing: its nacelle, the pylon, the fan turning behind its spinner. */
function Engine({ spin }: { spin: boolean }) {
  const fan = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (spin && fan.current) fan.current.rotation.z += Math.min(dt, 0.05) * 30
  })
  return (
    <group>
      <mesh position={[0, 1.15, -0.3]} material={grey}>
        <boxGeometry args={[0.35, 1.2, 3.2]} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} material={white} castShadow>
        <cylinderGeometry args={[1.15, 0.9, 4.6, 16, 1, true]} />
      </mesh>
      <mesh position={[0, 0, -2.5]} rotation={[-Math.PI / 2, 0, 0]} material={metal}>
        <coneGeometry args={[0.55, 1.1, 12]} />
      </mesh>
      <mesh position={[0, 0, 2.2]} rotation={[Math.PI / 2, 0, 0]} material={orange}>
        <torusGeometry args={[1.12, 0.1, 6, 16]} />
      </mesh>
      <group ref={fan} position={[0, 0, 1.95]}>
        <mesh material={dark}>
          <circleGeometry args={[1.05, 16]} />
        </mesh>
        {[...Array(10)].map((_, i) => (
          <mesh key={i} rotation={[0, 0, (i / 10) * Math.PI * 2]} position={[0, 0, 0.04]} material={metal}>
            <boxGeometry args={[0.16, 1.9, 0.04]} />
          </mesh>
        ))}
        <mesh position={[0, 0, 0.25]} rotation={[Math.PI / 2, 0, 0]} material={white}>
          <coneGeometry args={[0.3, 0.6, 12]} />
        </mesh>
      </group>
    </group>
  )
}

/** The airliner from far off: the fuselage, the wings, the fin, the tailplane, two plain engines. */
function FarAirliner({ body, wing, fin, finMat }: { body: THREE.BufferGeometry; wing: THREE.BufferGeometry; fin: THREE.BufferGeometry; finMat: THREE.Material }) {
  const y = 3.2
  return (
    <group>
      <mesh geometry={body} position={[0, y, 0]} material={white} />
      <mesh geometry={wing} position={[0, y - 1.05, 0]} material={grey} />
      <mesh geometry={wing} position={[0, y - 1.05, 0]} scale={[-1, 1, 1]} material={grey} />
      <mesh geometry={fin} position={[0, y + 1.2, -13.6]} material={finMat} />
      <mesh position={[0, y + 1.1, -19.6]} material={grey}>
        <boxGeometry args={[12.5, 0.32, 2.6]} />
      </mesh>
      {[-6.5, 6.5].map((x) => (
        <mesh key={x} position={[x, y - 1.95, 1.6]} rotation={[Math.PI / 2, 0, 0]} material={white}>
          <cylinderGeometry args={[1.15, 0.9, 4.6, 8]} />
        </mesh>
      ))}
    </group>
  )
}

/** A landing gear leg: the strut and its pair of wheels; `down` 1 out, 0 folded up into the belly. */
function Gear({ x, z, down, nose, live }: { x: number; z: number; down: number; nose?: boolean; live?: { current: number } }) {
  const len = nose ? 2.2 : 2.05
  const g = useRef<THREE.Group>(null)
  const fold = (d: number) => (1 - d) * (nose ? -1.5 : 1.5)
  // (Folding as a take-off or a landing goes: read each frame, no new render.)
  useFrame(() => {
    if (!live || !g.current) return
    g.current.rotation.x = fold(live.current)
    g.current.visible = live.current > 0.02
  })
  return (
    <group ref={g} position={[x, 2.6, z]} rotation={[fold(down), 0, 0]} visible={down > 0.02}>
      <mesh position={[0, -len / 2, 0]} material={grey}>
        <cylinderGeometry args={[0.13, 0.13, len, 6]} />
      </mesh>
      {[-0.32, 0.32].map((dx) => (
        <mesh key={dx} position={[dx, -len, 0]} rotation={[0, 0, Math.PI / 2]} material={tyre}>
          <cylinderGeometry args={[nose ? 0.4 : 0.55, nose ? 0.4 : 0.55, 0.36, 12]} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * An airliner of Air Lagune, the game's airline: a round, tapered fuselage with its windows and doors, the
 * orange and green cheatlines, swept wings with winglets and two turning engines, the fin in the Ivorian
 * colours, the lights (steady wingtips, flashing strobes and beacons). Local +z is the nose; on its wheels
 * at y = 0. gear: true / 1 out, false / 0 up (a number in between: folding, for a take-off or a landing).
 */
export function Airliner({ gear = true, spin = true, lights = true, gearRef, far }: { gear?: boolean | number; spin?: boolean; lights?: boolean; /** The gear as a take-off or a landing moves it, read each frame (0 up, 1 down). */ gearRef?: { current: number }; /** Seen from kilometres away (the planes over the town): its shape only, a few draws. */ far?: boolean }) {
  const { body, wing, fin, finMat } = parts()
  const down = typeof gear === 'number' ? gear : gear ? 1 : 0
  const y = 3.2 // the fuselage's axis above the ground
  useFrame(() => {
    if (!lights) return
    const t = worldTime()
    strobe.opacity = t % 1.2 < 0.06 || (t % 1.2 > 0.16 && t % 1.2 < 0.22) ? 1 : 0
    beacon.opacity = t % 1.0 < 0.12 ? 1 : 0.08
  })
  if (far) return <FarAirliner body={body} wing={wing} fin={fin} finMat={finMat} />
  return (
    <group>
      <mesh geometry={body} position={[0, y, 0]} material={white} castShadow />
      {/* The belly, a shade darker, and the cheatlines: orange over green, under the windows */}
      <mesh position={[0, y, 1]} rotation={[Math.PI / 2, 0, 0]} material={belly}>
        <cylinderGeometry args={[2.015, 2.015, 26, 24, 1, true, Math.PI - 0.75, 1.5]} />
      </mesh>
      {[1, -1].map((side) => (
        <group key={side}>
          <mesh position={[0, y, 0.5]} rotation={[Math.PI / 2, 0, 0]} material={orange}>
            <cylinderGeometry args={[2.025, 2.025, 29, 24, 1, true, side > 0 ? Math.PI / 2 - 0.02 : -Math.PI / 2 - 0.16, 0.18]} />
          </mesh>
          <mesh position={[0, y, 0.5]} rotation={[Math.PI / 2, 0, 0]} material={green}>
            <cylinderGeometry args={[2.025, 2.025, 29, 24, 1, true, side > 0 ? Math.PI / 2 + 0.18 : -Math.PI / 2 - 0.34, 0.14]} />
          </mesh>
        </group>
      ))}
      <Windows y={y} />
      {/* The cockpit's windows */}
      {[-0.95, -0.32, 0.32, 0.95].map((a) => (
        <mesh key={a} position={[Math.sin(a) * 1.58, y + Math.cos(a) * 1.58, 17.3]} rotation={[-0.8, 0, -a]} material={window_}>
          <boxGeometry args={[0.5, 0.34, 0.1]} />
        </mesh>
      ))}
      {/* Wings, winglets and engines */}
      <mesh geometry={wing} position={[0, y - 1.05, 0]} material={grey} castShadow />
      <mesh geometry={wing} position={[0, y - 1.05, 0]} scale={[-1, 1, 1]} material={grey} castShadow />
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * 17.05, y - 1.05 + 17 * 0.07 + 1, -4.6]} rotation={[0, 0, side * 0.12]} material={orange} castShadow>
            <boxGeometry args={[0.2, 2, 1.2]} />
          </mesh>
          <mesh position={[side * 17.1, y - 0.75 + 17 * 0.07, -4]} geometry={lamp} material={side < 0 ? navRed : navGreen} />
          <mesh position={[side * 17.1, y - 0.75 + 17 * 0.07, -5]} geometry={lamp} material={strobe} />
          <group position={[side * 6.5, y - 1.95, 1.6]}>
            <Engine spin={spin} />
          </group>
        </group>
      ))}
      {/* The tail: the fin with Air Lagune's flag, the tailplane, the beacons and the tail strobe */}
      <mesh geometry={fin} position={[0, y + 1.2, -13.6]} material={finMat} castShadow />
      <mesh position={[0, y + 1.1, -19.6]} material={grey} castShadow>
        <boxGeometry args={[12.5, 0.32, 2.6]} />
      </mesh>
      <mesh position={[0, y + 2.05, 2]} geometry={lamp} material={beacon} />
      <mesh position={[0, y - 2.05, 2]} geometry={lamp} material={beacon} />
      <mesh position={[0, y + 1.25, -22.1]} geometry={lamp} material={strobe} />
      {/* The gear */}
      {(down > 0 || gearRef) && (
        <>
          <Gear x={0} z={13} down={down} nose live={gearRef} />
          <Gear x={-2.6} z={-1} down={down} live={gearRef} />
          <Gear x={2.6} z={-1} down={down} live={gearRef} />
        </>
      )}
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
  const gear = useRef(1)
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
    // The rotation: the nose comes up over the last 250 m of the roll, to about 10°, then eases to the climb's 8°.
    const rotate = Math.min(1, Math.max(0, (d - (L * 0.7 - 250)) / 250))
    const pitch = rotate * 0.17 - Math.min(0.03, lift / 4000)
    // Wheels up a few seconds after leaving the ground.
    const airborne = lift / (acc * ROLL)
    gear.current = 1 - Math.min(1, Math.max(0, (airborne - 3) / 4))
    p.visible = d < L * 0.7 + 4000
    p.position.set(a[0] + ux * d, lift * 0.18, a[1] + uz * d)
    p.rotation.set(-pitch, Math.atan2(ux, uz), 0, 'YXZ')
  })
  if (!line) return null
  return (
    <group ref={g}>
      <Airliner gearRef={gear} />
    </group>
  )
}

/**
 * A plane coming in: down the glide path to the far end of the runway,
 * touching down and rolling out, between the take-offs (TakeOff).
 */
export function Landing({ runways }: { runways: XZ[][] }) {
  const g = useRef<THREE.Group>(null)
  const gear = useRef(1)
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
    // The gear comes down 4 km out; the flare: the nose up over the last 15 m of height, down again once rolling.
    gear.current = Math.min(1, Math.max(0, (4000 + d) / 600))
    const flare = d < 0 ? Math.min(1, Math.max(0, 1 - y / 15)) : Math.max(0, 1 - (t - APPROACH) / 4)
    const pitch = d < 0 ? 0.035 + flare * 0.07 : flare * 0.1
    p.visible = t < APPROACH + 30
    p.position.set(a[0] + ux * d, y, a[1] + uz * d)
    p.rotation.set(-pitch, Math.atan2(ux, uz), 0, 'YXZ')
  })
  if (!line) return null
  return (
    <group ref={g}>
      <Airliner gearRef={gear} />
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
          <Airliner gear={false} far />
          {/* The trail: a long thin white streak behind each engine */}
          {[-6, 6].map((x) => (
            <mesh key={x} geometry={trailGeo} material={trail} position={[x, 1, -260]} scale={[1, 1, 500]} />
          ))}
        </group>
      ))}
    </>
  )
}
