import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Player, Sim } from '../../lib/types'
import { Human, NoShadows, type Pose } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import { worldTime } from '../../lib/worldClock'
import { Character } from '../Character'
import { rng } from '../themes'

// Inside the Palais des Sports de Treichville, as it looks since its
// renovation: the light wooden court with its blue paint and blue apron, the
// bowl of seats in every colour with the green sections on the sides and the
// red railings, the ring of offices above, and the dome of wooden ribs with
// its three crowns of lamps. Playing basketball, the Sim is on that court;
// watching a match, in the stands. Sizes: a FIBA court (28 × 15 m) in the
// 66 m rotunda; the rest is the game's estimate from photos.

/** The places drawn with this inside instead of a room. */
export const ARENAS = new Set(['treich-palais'])

type V3 = [number, number, number]
const COURT: [number, number] = [28, 15]
const RING_X = COURT[0] / 2 - 1.575 // the hoop, from the middle
const ROWS = 13
const SEGS = 112
const BOWL_IN = 19.5 // the front row's radius
const ROW_D = 0.82
const ROW_H = 0.46
const WALL = BOWL_IN + ROWS * ROW_D + 0.6 // the ring of offices above the bowl
const SPRING = 12.5 // where the dome starts

const MOSAIC = ['#f2c12e', '#e23d32', '#2f9e44', '#2563c9', '#f08c1a', '#f2c12e', '#2f9e44']
const box = new THREE.BoxGeometry(1, 1, 1)

/** The court, painted on a canvas: planks, the blue keys and apron, the white lines. */
function courtTexture() {
  const s = 10 // pixels per metre
  const [w, h] = [(COURT[0] + 4) * s, (COURT[1] + 4) * s]
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  g.fillStyle = '#2b62c4'
  g.fillRect(0, 0, w, h)
  const [x0, y0] = [2 * s, 2 * s]
  for (let y = 0; y < COURT[1] * s; y += 4) {
    g.fillStyle = (y / 4) % 2 ? '#f1bd73' : '#eeb569'
    g.fillRect(x0, y0 + y, COURT[0] * s, 4)
  }
  // The keys and the zones under the baskets, in blue.
  g.fillStyle = '#2f6fd6'
  for (const side of [0, 1]) {
    const bx = side ? x0 + COURT[0] * s - 5.8 * s : x0
    g.fillRect(bx, y0 + (COURT[1] / 2 - 2.45) * s, 5.8 * s, 4.9 * s)
  }
  g.strokeStyle = '#ffffff'
  g.lineWidth = 1.5
  g.strokeRect(x0, y0, COURT[0] * s, COURT[1] * s)
  g.beginPath()
  g.moveTo(w / 2, y0)
  g.lineTo(w / 2, y0 + COURT[1] * s)
  g.stroke()
  g.beginPath()
  g.arc(w / 2, h / 2, 1.8 * s, 0, Math.PI * 2)
  g.stroke()
  for (const side of [-1, 1]) {
    const rx = w / 2 + side * RING_X * s
    g.beginPath()
    g.arc(rx, h / 2, 6.75 * s, side > 0 ? Math.PI / 2 + 0.22 : -Math.PI / 2 + 0.22, side > 0 ? (3 * Math.PI) / 2 - 0.22 : Math.PI / 2 - 0.22)
    g.stroke()
    const fx = w / 2 + side * (COURT[0] / 2 - 5.8) * s
    g.beginPath()
    g.arc(fx, h / 2, 1.8 * s, 0, Math.PI * 2)
    g.stroke()
    g.strokeRect(side > 0 ? fx : x0, y0 + (COURT[1] / 2 - 2.45) * s, 5.8 * s, 4.9 * s)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return new THREE.MeshLambertMaterial({ map: t })
}

/** Instanced boxes: position, size, turn about y, colour. */
function useInstances(list: { p: V3; s: V3; ry: number; c: string }[], material: THREE.Material) {
  return useMemo(() => {
    const m = new THREE.InstancedMesh(box, material, list.length)
    const o = new THREE.Object3D()
    const col = new THREE.Color()
    list.forEach((b, i) => {
      o.position.set(...b.p)
      o.scale.set(...b.s)
      o.rotation.set(0, b.ry, 0)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      m.setColorAt(i, col.set(b.c))
    })
    m.receiveShadow = true
    return m
  }, [list, material])
}

/** The bowl: a concrete step and a seat per segment and row; aisles every 8 segments, green sections on the long sides. */
function bowl() {
  const steps: { p: V3; s: V3; ry: number; c: string }[] = []
  const seats: typeof steps = []
  const rails: typeof steps = []
  const r = rng('palais-seats')
  const da = (Math.PI * 2) / SEGS
  for (let k = 0; k < SEGS; k++) {
    const a = (k + 0.5) * da
    const aisle = k % 8 === 0
    // The sides facing the long edges of the court are green, the ends in mosaic.
    const green = Math.abs(Math.cos(a)) < 0.42
    for (let row = 0; row < ROWS; row++) {
      const rad = BOWL_IN + row * ROW_D
      const w = 2 * rad * Math.sin(da / 2) + 0.04
      const y = 0.6 + row * ROW_H
      const at = (d: number, h: number): V3 => [Math.sin(a) * (rad + d), h, Math.cos(a) * (rad + d)]
      steps.push({
        p: at(ROW_D / 2, y / 2),
        s: [w, y, ROW_D],
        ry: a,
        c: aisle ? '#c9ccd1' : '#b7bcc3',
      })
      if (!aisle)
        seats.push({
          p: at(0.45, y + 0.22),
          s: [w * 0.86, 0.44, 0.42],
          ry: a,
          c: green ? (row % 2 ? '#27935a' : '#2f9e64') : MOSAIC[Math.floor(r() * MOSAIC.length)],
        })
    }
    // The red railing along the front, and by the aisles.
    rails.push({
      p: [Math.sin(a) * (BOWL_IN - 0.15), 0.55, Math.cos(a) * (BOWL_IN - 0.15)],
      s: [2 * BOWL_IN * Math.sin(da / 2) + 0.05, 1.1, 0.12],
      ry: a,
      c: '#d1352b',
    })
    if (aisle) {
      const rad = BOWL_IN + ROWS * ROW_D
      rails.push({
        p: [Math.sin(a) * (rad + 0.2), 0.6 + ROWS * ROW_H + 0.5, Math.cos(a) * (rad + 0.2)],
        s: [2 * rad * Math.sin(da / 2) * 8, 1, 0.12],
        ry: a + da * 3.5,
        c: '#d1352b',
      })
    }
  }
  return { steps, seats, rails }
}

/** The dome inside: the wooden shell, its ribs, and the rings that tie them. */
function useDome() {
  return useMemo(() => {
    const prof = (t: number) => new THREE.Vector2(WALL - t * (WALL - 5), SPRING + Math.sin((t * Math.PI) / 2) * 9.5)
    const shell = new THREE.LatheGeometry(
      [...Array(13)].map((_, i) => prof(i / 12)),
      64,
    )
    const ribs: { p: V3; s: V3; rx: number; ry: number }[] = []
    const N = 36
    for (let k = 0; k < N; k++) {
      const a = (k / N) * Math.PI * 2
      for (let i = 0; i < 10; i++) {
        const [p0, p1] = [prof(i / 10), prof((i + 1) / 10)]
        const mid = p0.clone().add(p1).multiplyScalar(0.5)
        const len = p0.distanceTo(p1)
        const tilt = Math.atan2(p1.y - p0.y, p0.x - p1.x)
        ribs.push({
          p: [Math.sin(a) * (mid.x - 0.25), mid.y - 0.25, Math.cos(a) * (mid.x - 0.25)],
          s: [0.35, 0.55, len + 0.05],
          rx: tilt,
          ry: a,
        })
      }
    }
    return { shell, ribs }
  }, [])
}

function Ribs({ ribs }: { ribs: { p: V3; s: V3; rx: number; ry: number }[] }) {
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(box, new THREE.MeshLambertMaterial({ color: '#5e3b22' }), ribs.length)
    const o = new THREE.Object3D()
    ribs.forEach((b, i) => {
      o.position.set(...b.p)
      o.scale.set(...b.s)
      // Turned to its meridian, then tilted along the dome's slope (pointing inward).
      o.rotation.set(0, 0, 0)
      o.quaternion.setFromEuler(new THREE.Euler(b.rx, b.ry, 0, 'YXZ'))
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    })
    return m
  }, [ribs])
  return <primitive object={mesh} />
}

/** A crown of LED lamps hanging under the dome. */
function Crown({ at }: { at: V3 }) {
  const lamps = useMemo(() => {
    const out: V3[] = []
    for (let ring = 0; ring < 3; ring++) {
      const n = 10 + ring * 6
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2
        out.push([Math.sin(a) * (1.2 + ring * 1.1), -ring * 0.15, Math.cos(a) * (0.7 + ring * 0.6)])
      }
    }
    return out
  }, [])
  return (
    <group position={at}>
      <mesh position={[0, 3, 0]} scale={[0.05, 6, 0.05]} geometry={box}>
        <meshBasicMaterial color="#444" />
      </mesh>
      {lamps.map((p, i) => (
        <mesh key={i} position={p} scale={[0.32, 0.12, 0.32]} geometry={box}>
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}
    </group>
  )
}

/** The hoop on its padded stand, behind the baseline. */
function Hoop({ side }: { side: 1 | -1 }) {
  const x = (COURT[0] / 2) * side
  return (
    <group>
      <mesh position={[x + side * 1.6, 0.6, 0]} scale={[1.8, 1.2, 1.4]} geometry={box} castShadow>
        <meshLambertMaterial color="#1f3f8a" />
      </mesh>
      <mesh position={[x + side * 1.2, 2.3, 0]} scale={[0.25, 2.4, 0.25]} geometry={box}>
        <meshLambertMaterial color="#1f3f8a" />
      </mesh>
      <mesh position={[x + side * 0.35, 3.2, 0]} scale={[1.9, 0.2, 0.2]} geometry={box}>
        <meshLambertMaterial color="#1f3f8a" />
      </mesh>
      <mesh position={[side * (RING_X + 0.4), 3.4, 0]} scale={[0.05, 1.05, 1.8]} geometry={box}>
        <meshLambertMaterial color="#e9f2ff" transparent opacity={0.75} />
      </mesh>
      <mesh position={[side * RING_X, 3.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.23, 0.02, 6, 16]} />
        <meshLambertMaterial color="#e85d04" />
      </mesh>
      <mesh position={[side * RING_X, 2.85, 0]}>
        <cylinderGeometry args={[0.22, 0.14, 0.38, 10, 2, true]} />
        <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.7} />
      </mesh>
    </group>
  )
}

/** A match on the court: ten players running end to end with the ball. */
function Match({ seed }: { seed: string }) {
  const team = useMemo(() => {
    const r = rng(seed)
    return [...Array(10)].map((_, i) => {
      const gender: 'femme' | 'homme' = 'homme'
      return {
        gender,
        look: {
          ...randomLook(gender, r),
          outfit: 'basket',
          outfitColor: i < 5 ? '#f08c1a' : '#ffffff',
        },
        seed: r() * 100,
        z: ((i % 5) - 2) * 2.6,
        off: (i % 5) * 0.9 - 1.5 + (i < 5 ? 0 : 0.8),
      }
    })
  }, [seed])
  const refs = useRef<(THREE.Group | null)[]>([])
  const ball = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const t = worldTime()
    // The play swings from one end to the other every 9 seconds.
    const phase = Math.sin((t / 9) * Math.PI * 2)
    const dir = Math.cos((t / 9) * Math.PI * 2) > 0 ? 1 : -1
    team.forEach((p, i) => {
      const g = refs.current[i]
      if (!g) return
      g.position.set(phase * 8 + p.off, 0, p.z + Math.sin(t * 1.3 + i) * 0.8)
      g.rotation.y = (dir * Math.PI) / 2
    })
    ball.current?.position.set(phase * 8 + 0.4, 0.15 + Math.abs(Math.sin(t * 7)) * 0.75, 0.4)
  })
  return (
    <NoShadows>
      {team.map((p, i) => (
        <group key={i} ref={(g) => void (refs.current[i] = g)}>
          <Human look={p.look} gender={p.gender} pose={i === 2 ? 'dribble' : 'run'} seed={p.seed} />
        </group>
      ))}
      <mesh ref={ball}>
        <sphereGeometry args={[0.12, 10, 8]} />
        <meshLambertMaterial color="#e8590c" />
      </mesh>
    </NoShadows>
  )
}

/** The ball bouncing from the Sim's hand. */
function Dribble({ at, ry }: { at: V3; ry: number }) {
  const ball = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const k = Math.abs(Math.sin(worldTime() * 7))
    ball.current?.position.set(0.32, 0.13 + k * 0.7, 0.28)
  })
  return (
    <group position={at} rotation={[0, ry, 0]}>
      <mesh ref={ball}>
        <sphereGeometry args={[0.12, 10, 8]} />
        <meshLambertMaterial color="#e8590c" />
      </mesh>
    </group>
  )
}

/** A seat in the stands: row and angle (0 = the +z side). */
function seat(row: number, a: number): V3 {
  const rad = BOWL_IN + row * ROW_D + 0.45
  return [Math.sin(a) * rad, 0.6 + row * ROW_H, Math.cos(a) * rad]
}

/** Where the Sim is: on the free-throw line facing the hoop, in the stands for a match, or by the court. */
function mePlace(interactionId?: string): { p: V3; ry: number; pose: Pose } {
  const playing = interactionId === 'play-basket' || interactionId === 'play-football'
  const watching = interactionId === 'watch-match'
  return playing
    ? {
        p: [RING_X - 5.2, 0, 0.4],
        ry: Math.PI / 2,
        pose: interactionId === 'play-football' ? 'kick' : 'dribble',
      }
    : watching
      ? { p: seat(2, 0.25), ry: Math.PI + 0.25, pose: 'cheer' }
      : { p: [2, 0, COURT[1] / 2 + 1.4], ry: Math.PI, pose: 'idle' }
}

/** The hall and everyone in it (no camera): for the inside view and the videos. */
export function ArenaWorld({ sim, placeId, interactionId, stage, others = [] }: { sim: Sim; placeId: string; interactionId?: string; stage: string; others?: Player[] }) {
  const court = useMemo(courtTexture, [])
  const parts = useMemo(bowl, [])
  const stepMat = useMemo(() => new THREE.MeshLambertMaterial({ color: '#ffffff' }), [])
  const steps = useInstances(parts.steps, stepMat)
  const seats = useInstances(parts.seats, stepMat)
  const rails = useInstances(parts.rails, stepMat)
  const { shell, ribs } = useDome()
  const wall = useMemo(() => {
    // The ring of offices and boxes: white with a band of dark windows.
    const c = document.createElement('canvas')
    c.width = 16
    c.height = 16
    const g = c.getContext('2d')!
    g.fillStyle = '#e9e7e2'
    g.fillRect(0, 0, 16, 16)
    g.fillStyle = '#4a5560'
    g.fillRect(2, 4, 12, 6)
    g.fillStyle = '#d1352b'
    g.fillRect(0, 14, 16, 2)
    const t = new THREE.CanvasTexture(c)
    t.magFilter = THREE.NearestFilter
    t.wrapS = THREE.RepeatWrapping
    t.repeat.set(48, 1)
    t.colorSpace = THREE.SRGBColorSpace
    return new THREE.MeshLambertMaterial({ map: t, side: THREE.BackSide })
  }, [])
  const crowd = useMemo(() => {
    const r = rng(`arena${placeId}`)
    return [...Array(26)].map(() => {
      const gender: 'femme' | 'homme' = r() < 0.5 ? 'femme' : 'homme'
      const row = Math.floor(r() * 8)
      const a = (Math.floor(r() * SEGS) + 0.5) * ((Math.PI * 2) / SEGS)
      return {
        gender,
        look: randomLook(gender, r),
        seed: r() * 100,
        p: seat(row, a),
        ry: a + Math.PI,
        pose: (r() < 0.4 ? 'cheer' : 'sit') as Pose,
      }
    })
  }, [placeId])

  const playing = interactionId === 'play-basket' || interactionId === 'play-football'
  const watching = interactionId === 'watch-match'
  const me = mePlace(interactionId)
  return (
    <>
      <hemisphereLight args={['#fff6e8', '#7a6a55', 1.1]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[0, 20, 0]} intensity={0.9} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-20} shadow-camera-right={20} shadow-camera-top={20} shadow-camera-bottom={-20} />

      {/* The floor: the blue apron round the court, then the court */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[BOWL_IN, 48]} />
        <meshLambertMaterial color="#2b62c4" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} material={court} receiveShadow>
        <planeGeometry args={[COURT[0] + 4, COURT[1] + 4]} />
      </mesh>
      <Hoop side={1} />
      <Hoop side={-1} />
      {/* The scorers' table on the side */}
      <mesh position={[0, 0.5, -(COURT[1] / 2 + 2.2)]} scale={[7, 1, 0.9]} geometry={box}>
        <meshLambertMaterial color="#1f3f8a" />
      </mesh>

      <primitive object={steps} />
      <primitive object={seats} />
      <primitive object={rails} />
      {/* The ring of offices, the big screen over the far stand */}
      <mesh position={[0, (0.6 + ROWS * ROW_H + SPRING) / 2, 0]} material={wall}>
        <cylinderGeometry args={[WALL, WALL, SPRING - 0.6 - ROWS * ROW_H, 64, 1, true]} />
      </mesh>
      <mesh position={[0, 8.8, -(WALL - 0.6)]} scale={[6.5, 3, 0.6]} geometry={box}>
        <meshLambertMaterial color="#15171a" />
      </mesh>
      <mesh position={[0, 8.8, -(WALL - 0.95)]} rotation={[0, 0, 0]}>
        <planeGeometry args={[5.8, 2.4]} />
        <meshBasicMaterial color="#3c79d8" />
      </mesh>

      {/* The dome of wooden ribs, the lamps */}
      <mesh geometry={shell}>
        <meshLambertMaterial color="#b98552" side={THREE.BackSide} />
      </mesh>
      <Ribs ribs={ribs} />
      <Crown at={[-10, 14.5, -3]} />
      <Crown at={[0, 15.5, -3]} />
      <Crown at={[10, 14.5, -3]} />

      <NoShadows>
        {crowd.map((c, i) => (
          <group key={i} position={c.p} rotation={[0, c.ry, 0]}>
            <Human look={c.look} gender={c.gender} pose={c.pose} seed={c.seed} />
          </group>
        ))}
      </NoShadows>
      {watching && <Match seed={placeId} />}

      <group position={me.p} rotation={[0, me.ry, 0]}>
        <Character look={playing ? { ...sim.look, outfit: 'basket' } : sim.look} gender={sim.gender} stage={stage} pose={me.pose} />
      </group>
      {playing && interactionId === 'play-basket' && <Dribble at={me.p} ry={me.ry} />}
      {/* Other players here: on the court beside the Sim */}
      {others.slice(0, 3).map((o, i) => (
        <group key={o.id} position={[me.p[0] + [-1.5, 1.2, -0.8][i], me.p[1], me.p[2] + [2.2, -2.4, -4][i]]} rotation={[0, me.ry, 0]}>
          <Character look={o.look} gender={o.gender} stage={o.stage} pose={playing ? 'run' : me.pose} moodColor="#3b82f6" />
        </group>
      ))}
    </>
  )
}

export function Arena(props: { sim: Sim; placeId: string; interactionId?: string; stage: string; others?: Player[] }) {
  const { interactionId } = props
  const playing = interactionId === 'play-basket' || interactionId === 'play-football'
  const watching = interactionId === 'watch-match'
  const me = mePlace(interactionId)
  // The camera: behind the Sim toward the hoop on court; in the stands, over its shoulder from higher up the bowl.
  const back = Math.hypot(me.p[0], me.p[2]) + 5
  const target: V3 = playing ? [me.p[0] + 2.5, 2, me.p[2]] : watching ? [me.p[0] * 0.6, 1.5, me.p[2] * 0.6] : [me.p[0], me.p[1] + 1, me.p[2]]
  const camAt: V3 = playing ? [me.p[0] - 6.5, 2.6, me.p[2] + 4] : watching ? [Math.sin(0.25) * back + 1.5, me.p[1] + 6, Math.cos(0.25) * back] : [me.p[0] + 4, 3.5, me.p[2] + 7]

  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: camAt, fov: 60 }} style={{ background: '#2a2d33' }}>
      <Suspense fallback={null}>
        <ArenaWorld {...props} />
        <OrbitControls makeDefault target={target} enablePan={false} minDistance={3} maxDistance={30} minPolarAngle={0.3} maxPolarAngle={1.55} enableDamping />
      </Suspense>
    </Canvas>
  )
}
