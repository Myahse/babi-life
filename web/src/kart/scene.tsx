import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Human, NoShadows } from '../avatar/Human'
import type { Look } from '../lib/types'
import { worldTime } from '../lib/worldClock'
import { lettering, signMaterial } from '../world3d/open/ruePrincesse'
import type { Hazard, Kart, Race } from './physics'
import { pointAt, type Track } from './track'

// What the race looks like: the circuit of Babi Karting (the asphalt, the red
// and white kerbs, the tyre walls, the grass, the stands full of people, the
// start arch with its lights, the item boxes and the boost pads, the towers
// of the Plateau far off), and the karts with their drivers.

const lambert = (color: string) => new THREE.MeshLambertMaterial({ color })
const BOX = new THREE.BoxGeometry(1, 1, 1)

/** A grainy texture for the asphalt and the grass (a few pixels of noise, repeated). */
function noiseTexture(base: string, spread: number, repeat: number) {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const col = new THREE.Color(base)
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const k = 1 + (Math.random() - 0.5) * spread
      g.fillStyle = `rgb(${Math.round(col.r * 255 * k)},${Math.round(col.g * 255 * k)},${Math.round(col.b * 255 * k)})`
      g.fillRect(x, y, 1, 1)
    }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeat, repeat)
  t.magFilter = THREE.NearestFilter
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** The road: a ribbon along the middle line, with its texture running along it. */
function roadGeometry(tr: Track, from: number, to: number, y: number) {
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= tr.n; i++) {
    const [lx, lz] = pointAt(tr, i, from)
    const [rx, rz] = pointAt(tr, i, to)
    pos.push(lx, y, lz, rx, y, rz)
    uv.push(0, i / 8, (to - from) / 8, i / 8)
    if (i < tr.n) {
      const a = i * 2
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** Instanced boxes, one per [x, y, z, rotY, sx, sy, sz, colour index]. */
function Boxes({ items, colors, cast = false }: { items: number[][]; colors: string[]; cast?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const mat = useMemo(() => new THREE.MeshLambertMaterial({ vertexColors: false }), [])
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new THREE.Object3D()
    const c = colors.map((x) => new THREE.Color(x))
    items.forEach(([x, y, z, r, sx, sy, sz, ci], i) => {
      o.position.set(x, y, z)
      o.rotation.set(0, r, 0)
      o.scale.set(sx, sy, sz)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      m.setColorAt(i, c[ci % c.length])
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [items, colors])
  return <instancedMesh ref={ref} args={[BOX, mat, items.length]} castShadow={cast} receiveShadow />
}

export function Circuit({ track, race }: { track: Track; race: Race }) {
  const tex = useMemo(() => ({ road: noiseTexture('#7a7d84', 0.16, 1), grass: noiseTexture('#4f9a3a', 0.25, 160), run: noiseTexture('#c9a46b', 0.2, 1) }), [])
  const road = useMemo(() => roadGeometry(track, -track.half, track.half, 0.02), [track])
  const runoff = useMemo(() => roadGeometry(track, -track.half - 2.6, track.half + 2.6, 0.01), [track])
  // The kerbs (red and white blocks every metre and a half), the tyre walls behind them.
  const kerbs = useMemo(() => {
    const out: number[][] = []
    for (let i = 0; i < track.n; i += 1.5) {
      const k = Math.floor(i / 1.5)
      const h = Math.atan2(track.tx[Math.floor(i)], track.tz[Math.floor(i)])
      for (const side of [-1, 1]) {
        const [x, z] = pointAt(track, i, side * (track.half + 0.45))
        out.push([x, 0.05, z, h, 0.9, 0.1, 1.5, k % 2])
      }
    }
    return out
  }, [track])
  const tyres = useMemo(() => {
    const out: number[][] = []
    for (let i = 0; i < track.n; i += 1.1) {
      const h = Math.atan2(track.tx[Math.floor(i)], track.tz[Math.floor(i)])
      const k = Math.floor(i / 1.1)
      for (const side of [-1, 1]) {
        const [x, z] = pointAt(track, i, side * (track.half + 2.9))
        // Stacks of three; a coloured one now and then.
        out.push([x, 0.3, z, h, 0.95, 0.6, 0.95, k % 9 === 0 ? 1 : k % 9 === 4 ? 2 : 0])
      }
    }
    return out
  }, [track])
  // The stands along the start straight, full of people in colour.
  const stands = useMemo(() => {
    const steps: number[][] = []
    const crowd: number[][] = []
    // Along the start straight, on the outside: five rows going up and back.
    for (let p = -24; p < 24; p += 0.9) {
      const at = track.n - 22 + p
      const i = ((Math.floor(at) % track.n) + track.n) % track.n
      const h = Math.atan2(track.tx[i], track.tz[i])
      for (let row = 0; row < 5; row++) {
        const d = -(track.half + 6.5 + row * 1.1)
        const [x, z] = pointAt(track, at, d)
        if (Math.round(p / 0.9) % 2 === 0) steps.push([x, 0.3 + row * 0.55, z, h, 1.2, 0.6 + row * 1.1, 1.0, 0])
        if (Math.random() < 0.8) crowd.push([x, 1.05 + row * 1.1, z, h, 0.45, 0.85, 0.35, Math.floor(Math.random() * 8)])
      }
    }
    return { steps, crowd }
  }, [track])
  // The towers of the Plateau, far off across the lagoon; palms round the circuit.
  const skyline = useMemo(() => [...Array(14)].map((_, i) => [-260 + i * 34 + Math.random() * 10, 0, -330 - Math.random() * 40, 0, 16 + Math.random() * 12, 40 + Math.random() * 90, 16, i % 4]), [])
  const palms = useMemo(() => {
    const out: [number, number][] = []
    for (let i = 0; i < track.n; i += 23) {
      const side = (Math.floor(i / 23) % 2) * 2 - 1
      out.push(pointAt(track, i, side * (track.half + 11 + Math.random() * 10)))
    }
    return out
  }, [track])
  const banner = useMemo(() => lettering('BABI KARTING', '#141416', '#ffd43b', '#e8432f'), [])
  const bannerMat = useMemo(() => signMaterial(banner.t), [banner])
  const [ax, az] = pointAt(track, 0, 0)
  const ah = Math.atan2(track.tx[0], track.tz[0])
  const checker = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 16
    c.height = 4
    const g = c.getContext('2d')!
    for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) {
      g.fillStyle = (x + y) % 2 ? '#ffffff' : '#111111'
      g.fillRect(x, y, 1, 1)
    }
    const t = new THREE.CanvasTexture(c)
    t.magFilter = THREE.NearestFilter
    return t
  }, [])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[1400, 1400]} />
        <meshLambertMaterial map={tex.grass} />
      </mesh>
      <mesh geometry={runoff} receiveShadow>
        <meshLambertMaterial map={tex.run} />
      </mesh>
      <mesh geometry={road} receiveShadow>
        <meshLambertMaterial map={tex.road} />
      </mesh>
      {/* The start line, chequered */}
      <mesh position={[ax, 0.03, az]} rotation={[-Math.PI / 2, 0, ah]}>
        <planeGeometry args={[track.half * 2, 1.6]} />
        <meshLambertMaterial map={checker} />
      </mesh>
      <Boxes items={kerbs} colors={['#e8432f', '#f8f9fa']} />
      <Boxes items={tyres} colors={['#1b1b20', '#e8432f', '#f2c94c']} cast />
      <Boxes items={stands.steps} colors={['#9aa3ad']} cast />
      <Boxes items={stands.crowd} colors={['#ff8200', '#1f6fd0', '#2f9e44', '#e8432f', '#f2c94c', '#ffffff', '#6d28d9', '#00a3e0']} />
      <Boxes items={skyline} colors={['#c9d6e3', '#a9bccf', '#dfe7ef', '#8fa5ba']} />
      {palms.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 3, 0]} geometry={BOX} scale={[0.5, 6, 0.5]} material={palmMat.trunk} />
          {[0, 1, 2, 3, 4].map((k) => (
            <mesh key={k} position={[Math.sin((k * Math.PI * 2) / 5) * 1.4, 6, Math.cos((k * Math.PI * 2) / 5) * 1.4]} rotation={[0, (k * Math.PI * 2) / 5, 0.5]} geometry={BOX} scale={[0.5, 0.2, 3]} material={palmMat.leaf} />
          ))}
        </group>
      ))}
      {/* The start arch: its posts, the banner, the lights */}
      <group position={[ax, 0, az]} rotation={[0, ah, 0]}>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * (track.half + 1.2), 3, 0]} geometry={BOX} scale={[0.8, 6, 0.8]} material={archMat} castShadow />
        ))}
        <mesh position={[0, 6.3, 0]} geometry={BOX} scale={[track.half * 2 + 3.2, 1.6, 0.6]} material={archMat} />
        <mesh position={[0, 6.3, -0.31]} geometry={BOX} scale={[1.3 * banner.aspect, 1.3, 0.02]} material={bannerMat} rotation={[0, Math.PI, 0]} />
        <mesh position={[0, 6.3, 0.31]} geometry={BOX} scale={[1.3 * banner.aspect, 1.3, 0.02]} material={bannerMat} />
        <StartLights race={race} />
      </group>
      <ItemBoxes race={race} />
      {race.pads.map((p, i) => (
        <group key={i} position={[p.x, 0.04, p.z]} rotation={[0, p.heading, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[3.2, 4]} />
            <meshBasicMaterial color="#ff9f1a" />
          </mesh>
          {[-1, 0, 1].map((k) => (
            <mesh key={k} position={[0, 0.01, k * 1.2]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
              <planeGeometry args={[1.1, 1.1]} />
              <meshBasicMaterial color="#fff3c4" />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

const palmMat = { trunk: lambert('#8a6a3d'), leaf: lambert('#2f9e44') }
const archMat = lambert('#e8432f')

/** The three lights over the line: red, red, red… green. */
function StartLights({ race }: { race: Race }) {
  const mats = useMemo(() => [0, 1, 2].map(() => new THREE.MeshBasicMaterial({ color: '#331111' })), [])
  useFrame(() => {
    const t = race.time
    mats.forEach((m, i) => {
      if (t >= 0) m.color.set(t < 2 ? '#2fe36b' : '#113311')
      else m.color.set(t > -3 + i ? '#ff3b30' : '#331111')
    })
  })
  return (
    <group position={[0, 5.1, 0.35]}>
      <mesh geometry={BOX} scale={[2.4, 0.8, 0.2]} material={archMat} />
      {mats.map((m, i) => (
        <mesh key={i} position={[(i - 1) * 0.7, 0, 0.12]} material={m}>
          <circleGeometry args={[0.26, 16]} />
        </mesh>
      ))}
    </group>
  )
}

/** The item boxes: turning, see-through, a "?" on each face; gone for a moment once taken. */
function ItemBoxes({ race }: { race: Race }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 32
    const g = c.getContext('2d')!
    const grad = g.createLinearGradient(0, 0, 32, 32)
    grad.addColorStop(0, '#ff6b6b')
    grad.addColorStop(0.5, '#ffd43b')
    grad.addColorStop(1, '#4dabf7')
    g.fillStyle = grad
    g.fillRect(0, 0, 32, 32)
    g.fillStyle = '#ffffff'
    g.font = 'bold 24px sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('?', 16, 17)
    const t = new THREE.CanvasTexture(c)
    t.magFilter = THREE.NearestFilter
    return t
  }, [])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.85 }), [tex])
  const refs = useRef<(THREE.Mesh | null)[]>([])
  useFrame(() => {
    const t = worldTime()
    race.boxes.forEach((b, i) => {
      const m = refs.current[i]
      if (!m) return
      m.visible = b.off <= 0
      m.rotation.set(t * 1.3, t * 1.7, 0)
      m.position.y = 1 + Math.sin(t * 2 + i) * 0.15
    })
  })
  return (
    <>
      {race.boxes.map((b, i) => (
        <mesh key={i} ref={(m) => void (refs.current[i] = m)} position={[b.x, 1, b.z]} geometry={BOX} material={mat} scale={1.1} />
      ))}
    </>
  )
}

/* ---------- The karts ---------- */

const wheelGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.26, 12)
wheelGeo.rotateZ(Math.PI / 2)
const tyreMat = lambert('#17171a')
const hubMat = lambert('#c9ced4')
const seatMat = lambert('#222428')
const sparkMats = [new THREE.MeshBasicMaterial({ color: '#ffffff' }), new THREE.MeshBasicMaterial({ color: '#4dabf7' }), new THREE.MeshBasicMaterial({ color: '#ff9f1a' })]
const flameMat = new THREE.MeshBasicMaterial({ color: '#ff7a00', transparent: true, opacity: 0.85 })

/** One kart and its driver: the body in its colour, the wheels turning and steering, the sparks of a drift, the flame of a boost. */
export function KartView({ kart, look, gender }: { kart: Kart; look: Look; gender: 'femme' | 'homme' }) {
  const root = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const wheels = useRef<(THREE.Group | null)[]>([])
  const fronts = useRef<(THREE.Group | null)[]>([])
  const sparks = useRef<THREE.Group>(null)
  const flame = useRef<THREE.Mesh>(null)
  const spin = useRef(0)
  const paint = useMemo(() => lambert(kart.color), [kart.color])
  const dark = useMemo(() => lambert(new THREE.Color(kart.color).multiplyScalar(0.6).getStyle()), [kart.color])
  useFrame((_, dt) => {
    const g = root.current
    if (!g) return
    g.position.set(kart.x, 0, kart.z)
    g.rotation.y = kart.heading + kart.spinAngle + (kart.drift ? kart.drift * -0.35 : 0)
    if (body.current) {
      body.current.position.y = (kart.hop > 0 ? Math.sin((kart.hop / 0.22) * Math.PI) * 0.35 : 0) + (kart.bump > 0 ? Math.sin(kart.bump * 60) * 0.04 : 0) + (kart.offroad ? Math.sin(worldTime() * 40) * 0.025 : 0)
      body.current.rotation.z = -kart.steer * Math.min(1, Math.abs(kart.speed) / 15) * 0.06
    }
    spin.current += (kart.speed / 0.28) * dt
    wheels.current.forEach((w) => w && (w.rotation.x = spin.current))
    fronts.current.forEach((f) => f && (f.rotation.y = -kart.steer * 0.45))
    if (sparks.current) {
      sparks.current.visible = kart.drift !== 0
      sparks.current.children.forEach((c, i) => {
        const m = c as THREE.Mesh
        m.material = sparkMats[kart.sparks]
        const k = (worldTime() * 9 + i * 0.37) % 1
        m.position.set((i % 2 ? 1 : -1) * 0.55 + (Math.random() - 0.5) * 0.2, 0.1 + k * 0.3, -1 - k * 0.6)
        m.scale.setScalar(0.12 * (1 - k))
      })
    }
    if (flame.current) {
      flame.current.visible = kart.boost > 0
      flame.current.scale.set(1, 0.8 + Math.random() * 0.5, 1)
    }
  })
  return (
    <group ref={root}>
      <group ref={body}>
        {/* The chassis: the floor, the bodywork, the bumpers, the number board */}
        <mesh position={[0, 0.22, 0]} geometry={BOX} scale={[1.1, 0.12, 1.9]} material={dark} castShadow />
        <mesh position={[0, 0.42, 0.62]} geometry={BOX} scale={[0.9, 0.3, 0.7]} material={paint} castShadow />
        <mesh position={[0, 0.36, -0.8]} geometry={BOX} scale={[1.2, 0.3, 0.35]} material={paint} castShadow />
        <mesh position={[0, 0.26, 1.08]} geometry={BOX} scale={[1.25, 0.14, 0.18]} material={dark} />
        <mesh position={[0, 0.5, -0.45]} geometry={BOX} scale={[0.55, 0.45, 0.12]} material={seatMat} />
        {/* The steering wheel */}
        <mesh position={[0, 0.72, 0.38]} rotation={[0.9, 0, 0]} geometry={BOX} scale={[0.34, 0.05, 0.05]} material={seatMat} />
        {[
          [-0.62, 0.62],
          [0.62, 0.62],
          [-0.65, -0.62],
          [0.65, -0.62],
        ].map(([x, z], i) => (
          <group key={i} position={[x, 0.28, z]} ref={(g) => void (i < 2 ? (fronts.current[i] = g) : null)}>
            <group ref={(g) => void (wheels.current[i] = g)}>
              <mesh geometry={wheelGeo} material={tyreMat} scale={i < 2 ? 0.9 : 1.05} castShadow />
              <mesh geometry={BOX} scale={[0.28, 0.16, 0.16]} material={hubMat} />
            </group>
          </group>
        ))}
        {/* The driver, sitting low, hands on the wheel */}
        <NoShadows>
          <group position={[0, 0.0, -0.32]} scale={0.92}>
            <Human look={look} gender={gender} pose="sit" seed={kart.id * 7} />
          </group>
        </NoShadows>
        <group ref={sparks}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <mesh key={i} geometry={BOX} material={sparkMats[1]} />
          ))}
        </group>
        <mesh ref={flame} position={[0, 0.35, -1.25]} rotation={[-Math.PI / 2, 0, 0]} material={flameMat}>
          <coneGeometry args={[0.22, 0.9, 8]} />
        </mesh>
      </group>
    </group>
  )
}

const bananaMat = lambert('#f2c94c')
const cocoMat = lambert('#6b4423')
/** The bananas lying on the track and the coconuts rolling along it. */
export function Hazards({ race }: { race: Race }) {
  const pool = useRef<(THREE.Group | null)[]>([])
  useFrame(() => {
    const list: Hazard[] = race.hazards
    pool.current.forEach((g, i) => {
      if (!g) return
      const h = list[i]
      g.visible = !!h
      if (!h) return
      g.position.set(h.x, h.kind === 'coco' ? 0.35 : 0.12, h.z)
      g.rotation.y = h.kind === 'coco' ? worldTime() * 8 : h.seed
      ;(g.children[0] as THREE.Mesh).visible = h.kind === 'banane'
      ;(g.children[1] as THREE.Mesh).visible = h.kind === 'coco'
    })
  })
  return (
    <>
      {[...Array(16)].map((_, i) => (
        <group key={i} ref={(g) => void (pool.current[i] = g)} visible={false}>
          <mesh geometry={BOX} scale={[0.7, 0.2, 0.25]} material={bananaMat} rotation={[0, 0, 0.3]} castShadow />
          <mesh castShadow material={cocoMat}>
            <sphereGeometry args={[0.35, 10, 8]} />
          </mesh>
        </group>
      ))}
    </>
  )
}
