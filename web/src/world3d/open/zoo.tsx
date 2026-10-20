import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Human, NoShadows, type Pose } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import { rng } from '../themes'
import { BOX, Blocks, PLANE } from './ruePrincesse'

// The Zoo national d'Abidjan, between Cocody and Abobo: a park of big trees
// crossed by red laterite alleys, the green gate on the road with its ticket
// window, and along the alleys the enclosures people come for: the
// elephants behind their ditch and low wall, the hippos' pool, the
// crocodiles on their sand bank, the chimpanzees' cage, the lions on their
// rocks; and since, the leopard in its cage, the hyenas pacing their fence,
// the zebras brought from South Africa, the peacocks loose on the lawns.
// Reopened in December 2021 after its renovation. The layout is the
// game's: the real enclosures are not mapped. The animals are drawn at the
// game's scale (its people stand 2.5 m tall). Frame: +z toward the road.

type Block = { p: [number, number, number]; s: [number, number, number]; ry?: number; c?: string }

const mats = new Map<string, THREE.MeshLambertMaterial>()
/** One material per colour, shared by every animal. */
const mat = (c: string) => {
  let m = mats.get(c)
  if (!m) mats.set(c, (m = new THREE.MeshLambertMaterial({ color: c })))
  return m
}
const lawn = new THREE.MeshLambertMaterial({ color: '#4f8f3c', polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
const laterite = new THREE.MeshLambertMaterial({ color: '#b5653a', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
const dirt = new THREE.MeshLambertMaterial({ color: '#a8794e', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
const sand = new THREE.MeshLambertMaterial({ color: '#d9c08a', polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })
const water = new THREE.MeshLambertMaterial({ color: '#3c7c7a', transparent: true, opacity: 0.88 })
const concrete = new THREE.MeshLambertMaterial({ color: '#d8d0c0' })
const bars = new THREE.MeshLambertMaterial({ color: '#3d4a3f' })
const trunk = new THREE.MeshLambertMaterial({ color: '#7d6248' })
const leaves = new THREE.MeshLambertMaterial({ color: '#ffffff' })
const colored = new THREE.MeshLambertMaterial({ color: '#ffffff' })
const rock = new THREE.MeshLambertMaterial({ color: '#8f8a80', flatShading: true })

/** A painted board: the gate's name, an enclosure's plaque. */
function board(lines: string[], bg: string, fg: string, w = 256, h = 64) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  g.fillStyle = bg
  g.fillRect(0, 0, w, h)
  g.strokeStyle = fg
  g.lineWidth = 4
  g.strokeRect(4, 4, w - 8, h - 8)
  g.fillStyle = fg
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  lines.forEach((t, i) => {
    g.font = `bold ${i === 0 ? Math.round(h / (lines.length + 1.2)) : Math.round(h / (lines.length + 2.2))}px sans-serif`
    g.fillText(t, w / 2, (h * (i + 0.5)) / lines.length + (lines.length > 1 ? (i === 0 ? 3 : -3) : 0))
  })
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return new THREE.MeshLambertMaterial({ map: t })
}

/** One block of an animal. */
function B({ p, s, c, r }: { p: [number, number, number]; s: [number, number, number]; c: string; r?: [number, number, number] }) {
  return <mesh position={p} scale={s} rotation={r} geometry={BOX} material={mat(c)} castShadow />
}

const ELEPHANT = '#8b8682'
/** The elephant, facing +x: its trunk swings, its ears fan. */
function Elephant({ phase = 0 }: { phase?: number }) {
  const trunkRef = useRef<THREE.Group>(null)
  const ears = useRef<(THREE.Group | null)[]>([])
  const tail = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phase
    if (trunkRef.current) trunkRef.current.rotation.z = Math.sin(t * 0.9) * 0.35 + 0.1
    ears.current.forEach((e, i) => {
      if (e) e.rotation.y = (i ? -1 : 1) * (0.25 + Math.sin(t * 1.6) * 0.25)
    })
    if (tail.current) tail.current.rotation.x = Math.sin(t * 2.2) * 0.4
  })
  return (
    <group>
      <B p={[0, 3.0, 0]} s={[4.6, 2.8, 2.7]} c={ELEPHANT} />
      <B p={[0, 4.5, 0]} s={[3.6, 0.4, 2.2]} c={ELEPHANT} />
      {[-1.5, 1.5].flatMap((x) => [-0.85, 0.85].map((z) => <B key={`${x}${z}`} p={[x, 0.85, z]} s={[0.95, 1.7, 0.95]} c={ELEPHANT} />))}
      {[-1.5, 1.5].flatMap((x) => [-0.85, 0.85].map((z) => <B key={`n${x}${z}`} p={[x + 0.2, 0.08, z]} s={[0.4, 0.16, 0.7]} c="#d8d2c4" />))}
      <B p={[2.75, 3.55, 0]} s={[1.5, 1.8, 1.7]} c={ELEPHANT} />
      <B p={[3.52, 3.7, 0.5]} s={[0.05, 0.16, 0.16]} c="#1d1b1a" />
      <B p={[3.52, 3.7, -0.5]} s={[0.05, 0.16, 0.16]} c="#1d1b1a" />
      {[1, -1].map((s, i) => (
        <group key={s} position={[2.4, 3.7, s * 0.85]} ref={(g) => { ears.current[i] = g }}>
          <B p={[-0.3, 0, s * 0.75]} s={[0.22, 2.0, 1.5]} c="#857e7a" />
        </group>
      ))}
      <B p={[3.6, 2.75, 0.45]} s={[0.7, 0.16, 0.16]} c="#f2ead8" r={[0, 0, 0.3]} />
      <B p={[3.6, 2.75, -0.45]} s={[0.7, 0.16, 0.16]} c="#f2ead8" r={[0, 0, 0.3]} />
      <group position={[3.45, 3.1, 0]} ref={trunkRef}>
        <B p={[0.12, -0.5, 0]} s={[0.55, 1.1, 0.55]} c={ELEPHANT} />
        <B p={[0.22, -1.45, 0]} s={[0.45, 0.95, 0.45]} c={ELEPHANT} />
        <B p={[0.36, -2.15, 0]} s={[0.36, 0.6, 0.36]} c={ELEPHANT} />
      </group>
      <group position={[-2.3, 3.6, 0]} ref={tail}>
        <B p={[-0.05, -0.6, 0]} s={[0.12, 1.2, 0.12]} c={ELEPHANT} />
      </group>
    </group>
  )
}

const HIPPO = '#7c6870'
/** The hippo, facing +x, low in the water: now and then it yawns wide. */
function Hippo({ phase = 0 }: { phase?: number }) {
  const jaw = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const t = (clock.elapsedTime + phase) % 9
    const open = t > 6 ? Math.sin(((t - 6) / 3) * Math.PI) : 0
    if (jaw.current) jaw.current.rotation.z = -open * 0.9
    if (head.current) head.current.rotation.z = open * 0.35
  })
  return (
    <group>
      <B p={[0, 1.1, 0]} s={[3.4, 1.7, 2.1]} c={HIPPO} />
      {[-1.1, 1.1].flatMap((x) => [-0.65, 0.65].map((z) => <B key={`${x}${z}`} p={[x, 0.25, z]} s={[0.6, 0.6, 0.6]} c={HIPPO} />))}
      <group position={[1.6, 1.3, 0]} ref={head}>
        <B p={[0.5, 0.15, 0]} s={[1.1, 0.8, 1.5]} c={HIPPO} />
        <B p={[0.25, 0.65, 0.45]} s={[0.25, 0.25, 0.25]} c={HIPPO} />
        <B p={[0.25, 0.65, -0.45]} s={[0.25, 0.25, 0.25]} c={HIPPO} />
        <B p={[0.45, 0.62, 0.48]} s={[0.12, 0.12, 0.1]} c="#1d1b1a" />
        <B p={[0.45, 0.62, -0.48]} s={[0.12, 0.12, 0.1]} c="#1d1b1a" />
        <B p={[0.1, 0.65, 0.65]} s={[0.15, 0.2, 0.12]} c="#5d4c53" />
        <B p={[0.1, 0.65, -0.65]} s={[0.15, 0.2, 0.12]} c="#5d4c53" />
        <B p={[1.2, 0.2, 0]} s={[0.6, 0.6, 1.6]} c="#8c7880" />
        <B p={[1.25, -0.12, 0]} s={[0.55, 0.06, 1.4]} c="#d8828c" />
        <group position={[0.2, -0.25, 0]} ref={jaw}>
          <B p={[0.75, -0.08, 0]} s={[1.5, 0.3, 1.5]} c={HIPPO} />
          <B p={[0.75, 0.09, 0]} s={[1.4, 0.06, 1.3]} c="#d8828c" />
          <B p={[1.35, 0.25, 0.5]} s={[0.12, 0.35, 0.12]} c="#f2ead8" />
          <B p={[1.35, 0.25, -0.5]} s={[0.12, 0.35, 0.12]} c="#f2ead8" />
        </group>
      </group>
    </group>
  )
}

const CROC = '#4e5a35'
/** The crocodile, facing +x, flat on the sand; its tail sways slowly. */
function Croc({ phase = 0 }: { phase?: number }) {
  const tail = useRef<THREE.Group>(null)
  const jaw = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phase
    if (tail.current) tail.current.rotation.y = Math.sin(t * 0.5) * 0.25
    if (jaw.current) jaw.current.rotation.z = -(0.15 + Math.max(0, Math.sin(t * 0.3)) * 0.35)
  })
  return (
    <group>
      <B p={[0, 0.32, 0]} s={[2.6, 0.48, 0.95]} c={CROC} />
      {[-0.7, -0.2, 0.3, 0.8].map((x) => <B key={x} p={[x, 0.6, 0]} s={[0.3, 0.12, 0.5]} c="#3d4728" />)}
      {[-0.9, 0.9].flatMap((x) => [-1, 1].map((s) => <B key={`${x}${s}`} p={[x, 0.15, s * 0.65]} s={[0.35, 0.3, 0.5]} c={CROC} r={[0, s * 0.4, 0]} />))}
      <B p={[1.55, 0.36, 0]} s={[0.6, 0.42, 0.75]} c={CROC} />
      <B p={[1.6, 0.62, 0.25]} s={[0.18, 0.14, 0.16]} c="#c9b33a" />
      <B p={[1.6, 0.62, -0.25]} s={[0.18, 0.14, 0.16]} c="#c9b33a" />
      <B p={[2.3, 0.4, 0]} s={[1.0, 0.18, 0.5]} c={CROC} />
      <group position={[1.8, 0.28, 0]} ref={jaw}>
        <B p={[0.5, -0.04, 0]} s={[1.0, 0.14, 0.48]} c="#6b744a" />
        <B p={[0.5, 0.05, 0]} s={[0.9, 0.04, 0.4]} c="#d9a39a" />
      </group>
      <group position={[-1.3, 0.3, 0]} ref={tail}>
        <B p={[-0.6, 0, 0]} s={[1.2, 0.38, 0.7]} c={CROC} />
        <B p={[-1.6, -0.04, 0]} s={[1.0, 0.28, 0.45]} c={CROC} />
        <B p={[-2.4, -0.08, 0]} s={[0.8, 0.18, 0.25]} c={CROC} />
      </group>
    </group>
  )
}

const CHIMP = '#2b2422'
/** A chimpanzee sitting, facing +z: it rocks, and scratches its head. */
function Chimp({ phase = 0 }: { phase?: number }) {
  const body = useRef<THREE.Group>(null)
  const arm = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phase
    if (body.current) body.current.rotation.x = Math.sin(t * 1.4) * 0.08
    // Half the time the arm is up, scratching; the rest it hangs and sways.
    const up = Math.sin(t * 0.7) > 0
    if (arm.current) arm.current.rotation.x = up ? -2.6 + Math.sin(t * 9) * 0.15 : Math.sin(t * 1.4) * 0.1
  })
  return (
    <group ref={body}>
      <B p={[0, 0.85, 0]} s={[0.85, 1.05, 0.65]} c={CHIMP} />
      <B p={[0, 1.62, 0.05]} s={[0.66, 0.6, 0.6]} c={CHIMP} />
      <B p={[0, 1.56, 0.36]} s={[0.44, 0.4, 0.06]} c="#c49a7a" />
      <B p={[0, 1.44, 0.42]} s={[0.26, 0.14, 0.1]} c="#b0866a" />
      <B p={[0.12, 1.64, 0.4]} s={[0.07, 0.07, 0.04]} c="#1d1b1a" />
      <B p={[-0.12, 1.64, 0.4]} s={[0.07, 0.07, 0.04]} c="#1d1b1a" />
      <B p={[0.38, 1.66, 0.05]} s={[0.1, 0.2, 0.16]} c="#c49a7a" />
      <B p={[-0.38, 1.66, 0.05]} s={[0.1, 0.2, 0.16]} c="#c49a7a" />
      <B p={[0.25, 0.25, 0.35]} s={[0.28, 0.4, 0.75]} c={CHIMP} />
      <B p={[-0.25, 0.25, 0.35]} s={[0.28, 0.4, 0.75]} c={CHIMP} />
      <B p={[-0.55, 0.7, 0.15]} s={[0.24, 1.15, 0.24]} c={CHIMP} />
      <group position={[0.55, 1.25, 0]} ref={arm}>
        <B p={[0, -0.55, 0]} s={[0.24, 1.15, 0.24]} c={CHIMP} />
      </group>
    </group>
  )
}

/** A lion, facing +x: lying, or sitting up with its mane; its head turns, its tail flicks. */
function Lion({ male, lying, phase = 0 }: { male?: boolean; lying?: boolean; phase?: number }) {
  const head = useRef<THREE.Group>(null)
  const tail = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phase
    if (head.current) head.current.rotation.y = Math.sin(t * 0.35) * 0.6
    if (tail.current) tail.current.rotation.y = Math.sin(t * 1.8) * 0.5
  })
  const fur = male ? '#c4903e' : '#cf9f55'
  const y = lying ? 0.5 : 1.15
  return (
    <group>
      <B p={[0, y, 0]} s={[2.3, 0.85, 0.95]} c={fur} />
      {lying
        ? [-1, 1].map((s) => <B key={s} p={[1.25, 0.18, s * 0.3]} s={[1.0, 0.3, 0.3]} c={fur} />)
        : [-0.85, 0.85].flatMap((x) => [-0.32, 0.32].map((z) => <B key={`${x}${z}`} p={[x, 0.4, z]} s={[0.3, 0.8, 0.3]} c={fur} />))}
      {lying && <B p={[-0.8, 0.18, 0.4]} s={[0.9, 0.3, 0.35]} c={fur} />}
      <group position={[1.25, y + 0.4, 0]} ref={head}>
        {male && <B p={[-0.1, 0, 0]} s={[0.6, 1.25, 1.25]} c="#6e4219" />}
        <B p={[0.25, 0, 0]} s={[0.7, 0.68, 0.68]} c={fur} />
        <B p={[0.68, -0.12, 0]} s={[0.3, 0.32, 0.4]} c="#e2c08a" />
        <B p={[0.84, -0.02, 0]} s={[0.06, 0.12, 0.16]} c="#3a2620" />
        <B p={[0.61, 0.15, 0.2]} s={[0.06, 0.1, 0.1]} c="#1d1b1a" />
        <B p={[0.61, 0.15, -0.2]} s={[0.06, 0.1, 0.1]} c="#1d1b1a" />
        {!male && <B p={[0.05, 0.4, 0.25]} s={[0.15, 0.18, 0.15]} c={fur} />}
        {!male && <B p={[0.05, 0.4, -0.25]} s={[0.15, 0.18, 0.15]} c={fur} />}
      </group>
      <group position={[-1.15, y + 0.2, 0]} ref={tail}>
        <B p={[-0.55, -0.2, 0]} s={[1.1, 0.1, 0.1]} c={fur} r={[0, 0, 0.35]} />
        <B p={[-1.1, -0.4, 0]} s={[0.22, 0.22, 0.22]} c="#6e4219" />
      </group>
    </group>
  )
}

/** A zebra, facing +x: the white body ringed with black stripes; it grazes, lifts its head, flicks its tail. */
function Zebra({ phase = 0 }: { phase?: number }) {
  const neck = useRef<THREE.Group>(null)
  const tail = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phase
    // Head down to graze most of the time, up now and then to look round.
    const up = Math.sin(t * 0.25) > 0.4
    if (neck.current) neck.current.rotation.z = THREE.MathUtils.lerp(neck.current.rotation.z, up ? 0.15 : -1.0, 0.04)
    if (tail.current) tail.current.rotation.x = Math.sin(t * 2.5) * 0.35
  })
  const W = '#f4f1ea'
  const K = '#1c1b1a'
  return (
    <group>
      <B p={[0, 1.55, 0]} s={[2.0, 0.85, 0.75]} c={W} />
      {[-0.75, -0.4, -0.05, 0.3, 0.65].map((x) => <B key={x} p={[x, 1.55, 0]} s={[0.12, 0.87, 0.77]} c={K} />)}
      {[-0.75, 0.75].flatMap((x) => [-0.25, 0.25].map((z) => (
        <group key={`${x}${z}`}>
          <B p={[x, 0.6, z]} s={[0.2, 1.2, 0.2]} c={W} />
          <B p={[x, 0.75, z]} s={[0.22, 0.1, 0.22]} c={K} />
          <B p={[x, 0.45, z]} s={[0.22, 0.1, 0.22]} c={K} />
          <B p={[x, 0.05, z]} s={[0.24, 0.1, 0.24]} c={K} />
        </group>
      )))}
      <group position={[0.85, 1.75, 0]} ref={neck}>
        <B p={[0.35, 0.4, 0]} s={[0.4, 1.0, 0.36]} c={W} r={[0, 0, -0.5]} />
        <B p={[0.3, 0.45, 0]} s={[0.42, 0.1, 0.38]} c={K} r={[0, 0, -0.5]} />
        <B p={[0.5, 0.2, 0]} s={[0.42, 0.1, 0.38]} c={K} r={[0, 0, -0.5]} />
        <B p={[0.2, 0.62, 0]} s={[0.5, 0.95, 0.1]} c={K} r={[0, 0, -0.5]} />
        <B p={[0.85, 0.8, 0]} s={[0.75, 0.36, 0.34]} c={W} />
        <B p={[1.2, 0.76, 0]} s={[0.2, 0.3, 0.3]} c={K} />
        <B p={[0.65, 1.05, 0.1]} s={[0.1, 0.25, 0.1]} c={W} />
        <B p={[0.65, 1.05, -0.1]} s={[0.1, 0.25, 0.1]} c={W} />
      </group>
      <group position={[-1.0, 1.85, 0]} ref={tail}>
        <B p={[-0.05, -0.4, 0]} s={[0.08, 0.8, 0.08]} c={W} />
        <B p={[-0.05, -0.85, 0]} s={[0.14, 0.2, 0.14]} c={K} />
      </group>
    </group>
  )
}

/** The leopard, facing +x, stretched along its branch: the tail hangs and swings, the head turns. */
function Leopard({ phase = 0 }: { phase?: number }) {
  const head = useRef<THREE.Group>(null)
  const tail = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phase
    if (head.current) head.current.rotation.y = Math.sin(t * 0.4) * 0.5
    if (tail.current) tail.current.rotation.x = Math.sin(t * 1.1) * 0.3
  })
  const F = '#d9a640'
  const spots = useMemo(() => {
    const r = rng('leopard-taches')
    return [...Array(22)].map(() => [(r() - 0.5) * 1.8, 0.2 + r() * 0.12, (r() < 0.5 ? -1 : 1) * (0.2 + r() * 0.15)] as [number, number, number])
  }, [])
  return (
    <group>
      <B p={[0, 0, 0]} s={[2.0, 0.55, 0.65]} c={F} />
      {spots.map((p, i) => <B key={i} p={[p[0], p[1], p[2] > 0 ? 0.33 : -0.33]} s={[0.12, 0.12, 0.02]} c="#3a2a18" />)}
      {spots.slice(0, 10).map((p, i) => <B key={`t${i}`} p={[p[0], 0.28, p[2] * 0.6]} s={[0.12, 0.02, 0.12]} c="#3a2a18" />)}
      {/* The legs hang either side of the branch */}
      {[-0.7, 0.7].flatMap((x) => [-1, 1].map((z) => <B key={`${x}${z}`} p={[x, -0.45, z * 0.3]} s={[0.18, 0.55, 0.18]} c={F} />))}
      <group position={[1.15, 0.15, 0]} ref={head}>
        <B p={[0.15, 0, 0]} s={[0.5, 0.45, 0.48]} c={F} />
        <B p={[0.45, -0.07, 0]} s={[0.18, 0.22, 0.28]} c="#ead2a0" />
        <B p={[0.41, 0.08, 0.13]} s={[0.04, 0.07, 0.07]} c="#1d1b1a" />
        <B p={[0.41, 0.08, -0.13]} s={[0.04, 0.07, 0.07]} c="#1d1b1a" />
        <B p={[0.0, 0.28, 0.18]} s={[0.1, 0.12, 0.1]} c={F} />
        <B p={[0.0, 0.28, -0.18]} s={[0.1, 0.12, 0.1]} c={F} />
      </group>
      <group position={[-1.0, 0, 0]} ref={tail}>
        <B p={[-0.15, -0.6, 0]} s={[0.1, 1.2, 0.1]} c={F} />
        <B p={[-0.15, -1.25, 0]} s={[0.12, 0.2, 0.12]} c="#3a2a18" />
      </group>
    </group>
  )
}

/** A spotted hyena, facing +x, the back sloping down to the rear; it paces up and down its fence. */
function Hyena({ phase = 0, pace = 0 }: { phase?: number; pace?: number }) {
  const root = useRef<THREE.Group>(null)
  const legs = useRef<(THREE.Group | null)[]>([])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phase
    if (root.current && pace) {
      // Back and forth along the fence, turning at each end.
      const u = (t * 0.12) % 2
      const x = u < 1 ? -pace + u * 2 * pace : pace - (u - 1) * 2 * pace
      root.current.position.x = x
      root.current.rotation.y = u < 1 ? 0 : Math.PI
    }
    legs.current.forEach((l, i) => {
      if (l) l.rotation.z = pace ? Math.sin(t * 7 + (i % 2) * Math.PI) * 0.4 : 0
    })
  })
  const F = '#a8916a'
  return (
    <group ref={root}>
      <B p={[0, 1.15, 0]} s={[1.8, 0.75, 0.7]} c={F} r={[0, 0, 0.15]} />
      {[[-0.4, 1.1, 0.36], [0.1, 1.25, -0.36], [0.4, 1.0, 0.36], [-0.6, 0.95, -0.36], [0.5, 1.35, 0.36]].map((p, i) => <B key={i} p={p as [number, number, number]} s={[0.15, 0.15, 0.02]} c="#4a3a28" />)}
      <B p={[0.3, 1.6, 0]} s={[1.0, 0.18, 0.12]} c="#4a3a28" r={[0, 0, 0.15]} />
      {[[0.65, 0.4], [0.65, -0.4], [-0.65, 0.4], [-0.65, -0.4]].map(([x, z], i) => (
        <group key={i} position={[x, x > 0 ? 1.0 : 0.8, z * 0.6]} ref={(g) => { legs.current[i] = g }}>
          <B p={[0, x > 0 ? -0.5 : -0.4, 0]} s={[0.2, x > 0 ? 1.0 : 0.8, 0.2]} c={F} />
        </group>
      ))}
      <B p={[1.15, 1.45, 0]} s={[0.55, 0.5, 0.5]} c={F} />
      <B p={[1.5, 1.35, 0]} s={[0.3, 0.26, 0.32]} c="#3a2e22" />
      <B p={[1.0, 1.78, 0.18]} s={[0.12, 0.2, 0.16]} c="#4a3a28" />
      <B p={[1.0, 1.78, -0.18]} s={[0.12, 0.2, 0.16]} c="#4a3a28" />
      <B p={[1.4, 1.52, 0.18]} s={[0.04, 0.07, 0.07]} c="#1d1b1a" />
      <B p={[1.4, 1.52, -0.18]} s={[0.04, 0.07, 0.07]} c="#1d1b1a" />
      <B p={[-1.0, 0.85, 0]} s={[0.1, 0.5, 0.1]} c="#4a3a28" r={[0, 0, -0.3]} />
    </group>
  )
}

/** A peacock, facing +x, loose on the lawn: it walks a slow circle; one of them fans its tail now and then. */
function Peacock({ phase = 0, radius = 0, fan = false }: { phase?: number; radius?: number; fan?: boolean }) {
  const root = useRef<THREE.Group>(null)
  const tailOpen = useRef<THREE.Group>(null)
  const tailShut = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phase
    if (root.current && radius) {
      const a = t * 0.12
      root.current.position.set(Math.cos(a) * radius, 0, Math.sin(a) * radius)
      root.current.rotation.y = -a - Math.PI
    }
    if (head.current) head.current.position.y = 1.5 + Math.max(0, Math.sin(t * 3)) * -0.25
    // The fan opens for a while, then folds back.
    const open = fan ? THREE.MathUtils.clamp(Math.sin(t * 0.3) * 3, 0, 1) : 0
    if (tailOpen.current) tailOpen.current.scale.setScalar(Math.max(0.001, open))
    if (tailShut.current) tailShut.current.visible = open < 0.3
  })
  const fanBlocks = useMemo(() => {
    const out: { p: [number, number, number]; r: number; c: string }[] = []
    for (let ring = 0; ring < 3; ring++)
      for (let i = 0; i <= 8; i++) {
        const a = -Math.PI / 2 + (i / 8) * Math.PI
        const R = 0.6 + ring * 0.55
        out.push({ p: [0, Math.cos(a) * R, Math.sin(a) * R], r: a, c: ring === 2 ? '#2e8b57' : ring === 1 ? '#3fa66a' : '#1f6b45' })
      }
    return out
  }, [])
  return (
    <group ref={root}>
      <B p={[0, 0.85, 0]} s={[0.6, 0.45, 0.4]} c="#1f4fa8" />
      <B p={[-0.1, 0.4, 0.1]} s={[0.06, 0.6, 0.06]} c="#8a7a6a" />
      <B p={[-0.1, 0.4, -0.1]} s={[0.06, 0.6, 0.06]} c="#8a7a6a" />
      <B p={[0.28, 1.2, 0]} s={[0.14, 0.6, 0.14]} c="#1f5fc8" />
      <group ref={head} position={[0.32, 1.5, 0]}>
        <B p={[0, 0, 0]} s={[0.2, 0.16, 0.14]} c="#1f5fc8" />
        <B p={[0.14, -0.02, 0]} s={[0.1, 0.05, 0.05]} c="#cbb79a" />
        <B p={[0, 0.16, 0]} s={[0.03, 0.16, 0.03]} c="#1f5fc8" />
        <B p={[0, 0.25, 0]} s={[0.08, 0.05, 0.08]} c="#2a7fd8" />
      </group>
      <group ref={tailShut}>
        <B p={[-0.85, 0.72, 0]} s={[1.3, 0.12, 0.35]} c="#2e8b57" r={[0, 0, 0.12]} />
      </group>
      <group ref={tailOpen} position={[-0.3, 0.9, 0]}>
        {fanBlocks.map((b, i) => (
          <group key={i} position={b.p} rotation={[b.r, 0, 0]}>
            <B p={[0, 0, 0]} s={[0.04, 0.5, 0.32]} c={b.c} />
            {i % 2 === 0 && <B p={[0.03, 0.08, 0]} s={[0.02, 0.14, 0.14]} c="#1b2f7a" />}
            {i % 2 === 0 && <B p={[0.04, 0.08, 0]} s={[0.02, 0.07, 0.07]} c="#d4b052" />}
          </group>
        ))}
      </group>
    </group>
  )
}

/** A low wall round an enclosure, with the railing people lean on. */
function rail(cx: number, cz: number, w: number, d: number, h = 1.1, gap?: 'n' | 's' | 'e' | 'w'): { walls: Block[]; rails: Block[] } {
  const walls: Block[] = []
  const rails: Block[] = []
  const sides: [string, [number, number, number], [number, number, number]][] = [
    ['s', [cx, h / 2, cz + d / 2], [w, h, 0.4]],
    ['n', [cx, h / 2, cz - d / 2], [w, h, 0.4]],
    ['e', [cx + w / 2, h / 2, cz], [0.4, h, d]],
    ['w', [cx - w / 2, h / 2, cz], [0.4, h, d]],
  ]
  for (const [side, p, s] of sides) {
    if (side === gap) continue
    walls.push({ p, s })
    rails.push({ p: [p[0], h + 0.55, p[2]], s: [s[0] === 0.4 ? 0.1 : s[0], 0.08, s[2] === 0.4 ? 0.1 : s[2]] })
    // The rail's posts, every 2 m.
    const long = Math.max(s[0], s[2])
    for (let u = -long / 2; u <= long / 2 + 0.01; u += 2) rails.push({ p: s[0] > s[2] ? [p[0] + u, h + 0.28, p[2]] : [p[0], h + 0.28, p[2] + u], s: [0.08, 0.55, 0.08] })
  }
  return { walls, rails }
}

/** Upright bars round a cage, a ceiling grid on top when roofed. */
function cage(cx: number, cz: number, w: number, d: number, h: number, roofed: boolean): Block[] {
  const out: Block[] = []
  const step = 0.55
  for (let x = -w / 2; x <= w / 2 + 0.01; x += step) {
    out.push({ p: [cx + x, h / 2, cz + d / 2], s: [0.07, h, 0.07] }, { p: [cx + x, h / 2, cz - d / 2], s: [0.07, h, 0.07] })
    if (roofed) out.push({ p: [cx + x, h, cz], s: [0.07, 0.07, d] })
  }
  for (let z = -d / 2 + step; z < d / 2; z += step) {
    out.push({ p: [cx + w / 2, h / 2, cz + z], s: [0.07, h, 0.07] }, { p: [cx - w / 2, h / 2, cz + z], s: [0.07, h, 0.07] })
    if (roofed) out.push({ p: [cx, h, cz + z], s: [w, 0.07, 0.07] })
  }
  for (const y of [0.15, h * 0.5, h - 0.05]) {
    out.push({ p: [cx, y, cz + d / 2], s: [w, 0.12, 0.12] }, { p: [cx, y, cz - d / 2], s: [w, 0.12, 0.12] })
    out.push({ p: [cx + w / 2, y, cz], s: [0.12, 0.12, d] }, { p: [cx - w / 2, y, cz], s: [0.12, 0.12, d] })
  }
  return out
}

/** What a visitor walking the park can't go through (the park's own frame):
 * the enclosure walls, the cages, the gate's pillars, the ticket window, the
 * vendor's cart, the wall all round the park. The 12 m gate stays open. */
export const ZOO_SOLID: { x: number; z: number; hw: number; hd: number; rot: number; top?: number }[] = (() => {
  const out: { x: number; z: number; hw: number; hd: number; rot: number; top?: number }[] = []
  const ring = (cx: number, cz: number, w: number, d: number, top: number) => {
    out.push({ x: cx, z: cz + d / 2, hw: w / 2, hd: 0.25, rot: 0, top }, { x: cx, z: cz - d / 2, hw: w / 2, hd: 0.25, rot: 0, top })
    out.push({ x: cx + w / 2, z: cz, hw: 0.25, hd: d / 2, rot: 0, top }, { x: cx - w / 2, z: cz, hw: 0.25, hd: d / 2, rot: 0, top })
  }
  for (const [cx, cz, w, d] of [[-26, -14, 30, 26], [26, -16, 26, 20], [26, 14, 20, 14], [30, -42, 18, 12], [37, 31, 24, 12]]) ring(cx, cz, w, d, 1.8)
  for (const [cx, cz, w, d, h] of [[-24, 17, 16, 12, 8], [0, -42, 32, 16, 4.2], [-30, -42, 14, 10, 6]]) ring(cx, cz, w, d, h)
  out.push({ x: -6, z: 42, hw: 0.8, hd: 0.8, rot: 0, top: 7 }, { x: 6, z: 42, hw: 0.8, hd: 0.8, rot: 0, top: 7 })
  out.push({ x: -10, z: 44, hw: 2, hd: 1.5, rot: 0, top: 3.4 }, { x: 10, z: 46, hw: 1.1, hd: 0.6, rot: 0, top: 1.2 })
  out.push({ x: -36, z: 42, hw: 29, hd: 0.35, rot: 0, top: 2.4 }, { x: 36, z: 42, hw: 29, hd: 0.35, rot: 0, top: 2.4 })
  // The sides and the back, closing the park.
  out.push({ x: -65, z: -7, hw: 0.35, hd: 49, rot: 0, top: 2.4 }, { x: 65, z: -7, hw: 0.35, hd: 49, rot: 0, top: 2.4 })
  out.push({ x: 0, z: -56, hw: 65, hd: 0.35, rot: 0, top: 2.4 })
  return out
})()

/** People walking the central alley, up and down, in a loop. */
function Strollers({ walkers }: { walkers: { x: number; z0: number; speed: number; look: ReturnType<typeof randomLook>; gender: 'femme' | 'homme'; seed: number; kid: boolean }[] }) {
  const refs = useRef<(THREE.Group | null)[]>([])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    walkers.forEach((w, i) => {
      const g = refs.current[i]
      if (!g) return
      // Along the alley from the gate (z 40) toward the lions (z -30), then from the gate again.
      const span = 70
      const u = (w.z0 + t * w.speed) % span
      g.position.set(w.x, 0, 40 - u)
      g.rotation.y = Math.PI
    })
  })
  return (
    <>
      {walkers.map((w, i) => (
        <group key={i} ref={(g) => { refs.current[i] = g }} scale={w.kid ? 0.62 : 1}>
          <Human look={w.look} gender={w.gender} pose="walk" seed={w.seed} />
        </group>
      ))}
    </>
  )
}

export function Zoo({ night, open = true }: { night: boolean; /** Within its hours (8 h–17 h): closed, the gate is shut and nobody visits, only the watchman. */ open?: boolean }) {
  const signs = useMemo(
    () => ({
      gate: board(["ZOO NATIONAL", "D'ABIDJAN"], '#1f7a3a', '#fff6d6', 512, 128),
      ticket: board(['GUICHET', 'Entrée 1 000 Djai'], '#ff8200', '#ffffff', 256, 96),
      elephant: board(['ÉLÉPHANTS', "Loxodonta · forêt d'Afrique"], '#f3ead0', '#2c3a22', 256, 96),
      hippo: board(['HIPPOPOTAMES', 'Ne pas jeter de nourriture'], '#f3ead0', '#2c3a22', 256, 96),
      croc: board(['CROCODILES', 'Défense de grimper'], '#f3ead0', '#2c3a22', 256, 96),
      chimp: board(['CHIMPANZÉS', 'Ne pas donner à manger'], '#f3ead0', '#2c3a22', 256, 96),
      lion: board(['LIONS', 'Danger · reculez'], '#f3ead0', '#8a1c1c', 256, 96),
      leopard: board(['LÉOPARD', 'Ne pas approcher'], '#f3ead0', '#8a1c1c', 256, 96),
      hyena: board(['HYÈNES', 'Ne pas passer la main'], '#f3ead0', '#8a1c1c', 256, 96),
      zebra: board(['ZÈBRES', "Venus d'Afrique du Sud"], '#f3ead0', '#2c3a22', 256, 96),
      closed: board(['FERMÉ', 'Ouvert de 8 h à 17 h'], '#8a1c1c', '#ffffff', 256, 96),
    }),
    [],
  )

  const enclosures = useMemo(() => {
    const e = rail(-26, -14, 30, 26, 1.2, undefined)
    const h = rail(26, -16, 26, 20, 1.0)
    const c = rail(26, 14, 20, 14, 1.0)
    const hy = rail(30, -42, 18, 12, 1.0)
    const zb = rail(37, 31, 24, 12, 1.0)
    return {
      walls: [...e.walls, ...h.walls, ...c.walls, ...hy.walls, ...zb.walls],
      rails: [...e.rails, ...h.rails, ...c.rails, ...hy.rails, ...zb.rails],
      cages: [...cage(-24, 17, 16, 12, 8, true), ...cage(0, -42, 32, 16, 4.2, false), ...cage(26, 14, 20, 14, 3.0, false), ...cage(-30, -42, 14, 10, 6, true), ...cage(30, -42, 18, 12, 3.2, false)],
    }
  }, [])

  const greenery = useMemo(() => {
    const r = rng('zoo-arbres')
    const trunks: Block[] = []
    const crowns: Block[] = []
    // Big forest trees (fromagers, irokos) over the alleys and the lawns, keeping off the enclosures and the alley.
    const clear = (x: number, z: number) =>
      Math.abs(x) < 5 ||
      (x > -42 && x < -10 && z > -28 && z < 1) ||
      (x > 12 && x < 40 && z > -27 && z < 22) ||
      (x > -33 && x < -15 && z > 10 && z < 24) ||
      (x > -17 && x < 17 && z < -33) ||
      (x > -39 && x < -21 && z > -50 && z < -34) ||
      (x > 19 && x < 41 && z > -50 && z < -33) ||
      (x > 23 && x < 51 && z > 21 && z < 39) ||
      (z > 20 && z < 25 && x > 0 && x < 50) ||
      (z > 36 && Math.abs(x) < 14)
    let n = 0
    while (n < 46) {
      const x = (r() - 0.5) * 112
      const z = (r() - 0.5) * 104
      if (clear(x, z)) continue
      n++
      const h = 7 + r() * 9
      const w = 0.6 + r() * 0.6
      trunks.push({ p: [x, h / 2, z], s: [w, h, w] })
      trunks.push({ p: [x, 0.5, z], s: [w * 2.4, 1, w * 0.5], ry: r() * 3 }) // the buttress roots
      const green = ['#2f7a35', '#3b8a3e', '#276b2e', '#4a9640'][Math.floor(r() * 4)]
      const R = 4 + r() * 4
      crowns.push({ p: [x, h + 0.8, z], s: [R * 1.6, 2.4, R * 1.6], ry: r() * 3, c: green })
      crowns.push({ p: [x + (r() - 0.5) * 2, h + 2.6, z + (r() - 0.5) * 2], s: [R, 2, R], ry: r() * 3, c: green })
    }
    // In the enclosures: the elephants' shade tree, the lions' tree.
    for (const [x, z, h] of [[-34, -22, 10], [12, -46, 7]] as const) {
      trunks.push({ p: [x, h / 2, z], s: [0.9, h, 0.9] })
      crowns.push({ p: [x, h + 0.8, z], s: [9, 2.2, 9], c: '#3b8a3e' })
    }
    return { trunks, crowns }
  }, [])

  const rocks = useMemo<Block[]>(() => {
    const r = rng('zoo-rochers')
    const out: Block[] = [
      { p: [-4, 1.2, -44], s: [8, 2.4, 6], ry: 0.3 },
      { p: [-7, 2.6, -46], s: [5, 1.8, 4], ry: -0.2 },
      { p: [8, 0.7, -46], s: [5, 1.4, 4], ry: 0.6 },
    ]
    for (let i = 0; i < 10; i++) out.push({ p: [(r() - 0.5) * 28, 0.3, -42 + (r() - 0.5) * 12], s: [1 + r() * 1.5, 0.6 + r() * 0.6, 1 + r() * 1.2], ry: r() * 3 })
    return out
  }, [])

  const climbing = useMemo<Block[]>(() => [
    // The chimps' climbing frame: logs, a platform, ropes.
    { p: [-28, 3, 15], s: [0.4, 6, 0.4] }, { p: [-20, 3, 15], s: [0.4, 6, 0.4] }, { p: [-28, 3, 20], s: [0.4, 6, 0.4] },
    { p: [-24, 5.8, 15], s: [8.4, 0.35, 0.35] }, { p: [-28, 4.2, 17.5], s: [0.35, 0.35, 5.4] },
    { p: [-26.5, 4.2, 17.5], s: [3, 0.25, 3], c: '#9a7a52' },
    { p: [-22, 3.2, 15], s: [0.06, 5.2, 0.06], c: '#c9b08a' }, { p: [-25, 3.4, 15], s: [0.06, 4.8, 0.06], c: '#c9b08a' },
    // The leopard's dead tree: a trunk, the long branch it lies on, a sleeping shelf.
    { p: [-34, 2.2, -43], s: [0.6, 4.4, 0.6] }, { p: [-30.5, 3.3, -43], s: [7, 0.45, 0.5], c: '#6e5640' },
    { p: [-25, 1.2, -45.5], s: [3, 0.3, 2], c: '#9a7a52' }, { p: [-25, 0.6, -45.5], s: [0.3, 1.2, 0.3] },
  ], [])

  const people = useMemo(() => {
    const r = rng('zoo-gens')
    const one = (p: [number, number, number], ry: number, pose: Pose, kid = false) => {
      const gender: 'femme' | 'homme' = r() < 0.5 ? 'femme' : 'homme'
      return { p, ry, pose, kid, gender, look: randomLook(gender, r), seed: r() * 100 }
    }
    return [
      // At the elephants' wall, leaning on the rail.
      one([-12.6, 0, -8], -Math.PI / 2, 'touch'), one([-12.6, 0, -12], -Math.PI / 2, 'phone'), one([-12.8, 0, -10], -Math.PI / 2, 'wave', true), one([-12.8, 0, -14.5], -Math.PI / 2, 'cheer', true),
      // The school trip at the hippos: the kids, the mistress.
      one([12.8, 0, -12], Math.PI / 2, 'cheer', true), one([12.8, 0, -14], Math.PI / 2, 'wave', true), one([12.8, 0, -16], Math.PI / 2, 'touch', true), one([12.6, 0, -18], Math.PI / 2, 'cheer', true), one([11, 0, -15], Math.PI / 2, 'talk'),
      // At the crocodiles.
      one([15.4, 0, 12], Math.PI / 2, 'phone'), one([15.4, 0, 14.5], Math.PI / 2, 'idle'),
      // At the chimps' cage.
      one([-24, 0, 24.6], Math.PI, 'wave', true), one([-21, 0, 24.6], Math.PI, 'phone'), one([-26.5, 0, 24.6], Math.PI, 'talk'),
      // The lions: everyone keeps a step back.
      one([-6, 0, -32.4], Math.PI, 'phone'), one([-3, 0, -32.6], Math.PI, 'touch', true), one([4, 0, -32.4], Math.PI, 'idle'), one([7, 0, -32.6], Math.PI, 'talk'),
      // The leopard, the hyenas, the zebras.
      one([-28, 0, -35.4], Math.PI, 'phone'), one([-31, 0, -35.6], Math.PI, 'touch', true),
      one([28, 0, -34.6], Math.PI, 'idle'), one([31, 0, -34.6], Math.PI, 'wave', true), one([33, 0, -34.4], Math.PI, 'talk'),
      one([34, 0, 23.8], 0, 'cheer', true), one([36.5, 0, 23.6], 0, 'phone'), one([40, 0, 23.8], 0, 'touch', true),
      // At the gate: the ticket window, the vendor, the couple taking a selfie.
      one([-8, 0, 44.5], -Math.PI / 2, 'talk'), one([-6.4, 0, 45.5], -Math.PI / 2, 'idle', true), one([10, 0, 46], 0.2, 'busy'), one([3, 0, 48], 0.3, 'phone'), one([4.2, 0, 48.3], -0.3, 'hug'),
      // A family picnicking on the lawn.
      one([-40, 0, 32], 0.6, 'eat'), one([-38, 0, 33.5], -2.2, 'eat', true), one([-41.5, 0, 34], 2.4, 'talk'),
    ]
  }, [])

  const walkers = useMemo(() => {
    const r = rng('zoo-promeneurs')
    return [...Array(8)].map((_, i) => {
      const gender: 'femme' | 'homme' = r() < 0.5 ? 'femme' : 'homme'
      return { x: (i % 2 ? 1.3 : -1.3) + (r() - 0.5) * 0.6, z0: i * 9 + r() * 4, speed: 1.2 + r() * 0.4, look: randomLook(gender, r), gender, seed: r() * 100, kid: r() < 0.3 }
    })
  }, [])

  const water1 = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (water1.current) water1.current.position.y = 0.55 + Math.sin(clock.elapsedTime * 0.8) * 0.03
  })

  const lamp = useMemo(() => new THREE.MeshLambertMaterial({ color: '#fff4d0', emissive: '#ffd27a', emissiveIntensity: 0 }), [])
  lamp.emissiveIntensity = night ? 1.2 : 0
  return (
    <group>
      {/* The park's ground: lawn, the red laterite alleys, the dirt of the enclosures */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} scale={[120, 112, 1]} geometry={PLANE} material={lawn} receiveShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 4]} scale={[7, 80, 1]} geometry={PLANE} material={laterite} receiveShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 3]} scale={[60, 5, 1]} geometry={PLANE} material={laterite} receiveShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, -31]} scale={[80, 4, 1]} geometry={PLANE} material={laterite} receiveShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[24, 0.04, 22.5]} scale={[50, 3.5, 1]} geometry={PLANE} material={laterite} receiveShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-30, 0.05, -42]} scale={[13.5, 9.5, 1]} geometry={PLANE} material={dirt} receiveShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[30, 0.05, -42]} scale={[17.5, 11.5, 1]} geometry={PLANE} material={dirt} receiveShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[37, 0.05, 31]} scale={[23.5, 11.5, 1]} geometry={PLANE} material={sand} receiveShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-24, 0.04, 26]} scale={[40, 4, 1]} geometry={PLANE} material={laterite} receiveShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 46]} scale={[30, 8, 1]} geometry={PLANE} material={laterite} receiveShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-26, 0.05, -14]} scale={[29, 25, 1]} geometry={PLANE} material={dirt} receiveShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, -42]} scale={[31, 15, 1]} geometry={PLANE} material={dirt} receiveShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-24, 0.05, 17]} scale={[15.5, 11.5, 1]} geometry={PLANE} material={dirt} receiveShadow />

      {/* The hippos' pool, rimmed in concrete, its muddy bank */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[26, 0.05, -16]} scale={[25, 19, 1]} geometry={PLANE} material={dirt} receiveShadow />
      <mesh position={[28, 0.3, -17]} scale={[19, 0.5, 15]} geometry={BOX} material={concrete} receiveShadow />
      <mesh ref={water1} position={[28, 0.55, -17]} rotation={[-Math.PI / 2, 0, 0]} scale={[18, 14, 1]} geometry={PLANE} material={water} />
      {/* The crocodiles' pond and sand bank */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[26, 0.06, 14]} scale={[19.5, 13.5, 1]} geometry={PLANE} material={sand} receiveShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[30, 0.2, 10]} scale={[10, 6, 1]} geometry={PLANE} material={water} />
      {/* The elephants' water trough and log */}
      <mesh position={[-18, 0.5, -22]} scale={[5, 1, 2]} geometry={BOX} material={concrete} castShadow />
      <mesh position={[-18, 1.01, -22]} rotation={[-Math.PI / 2, 0, 0]} scale={[4.4, 1.5, 1]} geometry={PLANE} material={water} />
      <mesh position={[-32, 0.5, -6]} rotation={[0, 0.5, Math.PI / 2]} scale={[1, 7, 1]} geometry={BOX} material={trunk} castShadow />

      <Blocks at={enclosures.walls} material={concrete} />
      <Blocks at={enclosures.rails} material={bars} />
      <Blocks at={enclosures.cages} material={bars} />
      <Blocks at={climbing.map((b) => ({ ...b, c: b.c ?? '#7d6248' }))} material={colored} color />
      <Blocks at={rocks} material={rock} />

      {/* The animals */}
      <group position={[-28, 0, -12]} rotation={[0, 0.4, 0]}><Elephant /></group>
      <group position={[24, -0.15, -14]} rotation={[0, Math.PI, 0]}><Hippo /></group>
      <group position={[31, -0.3, -20]} rotation={[0, 2.2, 0]} scale={0.9}><Hippo phase={4} /></group>
      <group position={[20, 0.1, 12.5]} rotation={[0, 0.5, 0]}><Croc /></group>
      <group position={[24, 0.1, 18.5]} rotation={[0, -0.4, 0]} scale={0.85}><Croc phase={3} /></group>
      <group position={[31, -0.05, 10]} rotation={[0, 2.8, 0]}><Croc phase={6} /></group>
      <group position={[-26.5, 4.35, 17.5]}><Chimp /></group>
      <group position={[-21, 0, 19]} rotation={[0, 0.4, 0]}><Chimp phase={1.5} /></group>
      <group position={[-25, 0, 21]} rotation={[0, -0.3, 0]} scale={0.7}><Chimp phase={3} /></group>
      <group position={[-4, 2.4, -44]} rotation={[0, Math.PI / 2, 0]} scale={1.3}><Lion male /></group>
      <group position={[6, 0, -40]} rotation={[0, 2.4, 0]} scale={1.3}><Lion lying phase={2} /></group>
      <group position={[-11, 0, -39]} rotation={[0, 1.2, 0]} scale={1.3}><Lion lying phase={5} /></group>
      <group position={[-30.5, 3.85, -43]} rotation={[0, Math.PI, 0]}><Leopard /></group>
      <group position={[30, 0, -38.5]}><Hyena pace={6} /></group>
      <group position={[33, 0, -45]} rotation={[0, 2.6, 0]}><Hyena phase={3} /></group>
      <group position={[26, 0, -44]} rotation={[0, -0.5, 0]} scale={0.8}><Hyena phase={5} /></group>
      <group position={[31, 0, 29]} rotation={[0, 0.3, 0]}><Zebra /></group>
      <group position={[36, 0, 33]} rotation={[0, 2.8, 0]}><Zebra phase={4} /></group>
      <group position={[42, 0, 29]} rotation={[0, -2.0, 0]}><Zebra phase={8} /></group>
      <group position={[45, 0, 33.5]} rotation={[0, 0.9, 0]} scale={0.85}><Zebra phase={11} /></group>
      {/* The peacocks go where they like */}
      <group position={[-40, 0, 6]}><Peacock radius={4} /></group>
      <group position={[8, 0, 32]} rotation={[0, -1.2, 0]}><Peacock fan /></group>
      <group position={[-10, 0, -26]}><Peacock radius={3} phase={20} /></group>
      <group position={[46, 0, -2]}><Peacock radius={5} phase={40} /></group>
      <group position={[-8, 0, 8]} rotation={[0, 2.2, 0]}><Peacock fan phase={6} /></group>

      {/* The plaques on each enclosure */}
      {([
        [signs.elephant, [-11.2, 1.8, -6], -Math.PI / 2],
        [signs.hippo, [12.8, 1.6, -8], Math.PI / 2],
        [signs.croc, [16, 1.6, 8], Math.PI / 2],
        [signs.chimp, [-18, 1.8, 24], 0],
        [signs.lion, [10, 1.8, -33.6], 0],
        [signs.leopard, [-24, 1.8, -36.4], 0],
        [signs.hyena, [36, 1.8, -35.4], 0],
        [signs.zebra, [28, 1.8, 24.6], 0],
      ] as const).map(([m, p, ry], i) => (
        <group key={i} position={p} rotation={[0, ry, 0]}>
          <mesh position={[0, 0, 0.06]} scale={[2.6, 1.0, 1]} geometry={PLANE} material={m} />
          <mesh position={[0, -0.9, -0.1]} scale={[0.12, 1.8, 0.12]} geometry={BOX} material={bars} />
        </group>
      ))}

      {/* The gate on the road: two green pillars, the arch with the name, the ticket window */}
      <group position={[0, 0, 42]}>
        {[-6, 6].map((x) => (
          <group key={x}>
            <mesh position={[x, 3.5, 0]} scale={[1.6, 7, 1.6]} geometry={BOX} material={mat('#2e8b45')} castShadow />
            <mesh position={[x, 7.2, 0]} scale={[2, 0.4, 2]} geometry={BOX} material={mat('#f3c63f')} castShadow />
            <mesh position={[x, 7.8, 0]} scale={[0.7, 0.8, 0.7]} geometry={BOX} material={lamp} />
          </group>
        ))}
        <mesh position={[0, 6.2, 0]} scale={[13.6, 2.2, 0.7]} geometry={BOX} material={mat('#1f7a3a')} castShadow />
        <mesh position={[0, 6.2, 0.37]} scale={[12, 2, 1]} geometry={PLANE} material={signs.gate} />
        {/* An elephant's head and a lion's on the arch, as painted cut-outs */}
        <group position={[-5.9, 8.6, 0]} rotation={[0, -Math.PI / 2, 0]} scale={0.45}><Elephant /></group>
        <group position={[5.9, 7.4, 0]} rotation={[0, -Math.PI / 2, 0]} scale={0.6}><Lion male /></group>
        {/* The ticket window */}
        <mesh position={[-10, 1.6, 2]} scale={[4, 3.2, 3]} geometry={BOX} material={mat('#f2ead8')} castShadow />
        <mesh position={[-10, 3.4, 2]} scale={[4.8, 0.3, 3.8]} geometry={BOX} material={mat('#c0392b')} castShadow />
        <mesh position={[-8, 1.6, 2]} rotation={[0, Math.PI / 2, 0]} scale={[1.6, 1, 1]} geometry={PLANE} material={mat('#2a2a2a')} />
        <mesh position={[-10, 2.9, 3.52]} scale={[3.4, 1.0, 1]} geometry={PLANE} material={signs.ticket} />
        {/* The vendor's cart: ice creams, sachets of water, peanuts */}
        <mesh position={[10, 0.6, 4]} scale={[2.2, 1.2, 1.2]} geometry={BOX} material={mat('#f8f9fa')} castShadow />
        <mesh position={[10, 2.6, 4]} scale={[0.08, 2.8, 0.08]} geometry={BOX} material={bars} />
        <mesh position={[10, 4.0, 4]} scale={[3.4, 0.2, 3.4]} geometry={BOX} material={mat('#ff8200')} castShadow />
        {[-1, 1].map((x) => <mesh key={x} position={[10 + x * 1.3, 0.3, 4.9]} scale={[0.6, 0.6, 0.6]} geometry={BOX} material={mat('#222')} />)}
        {/* Fence along the road on either side of the gate */}
        <Blocks at={[-1, 1].map((s) => ({ p: [s * 36, 1.2, 0] as [number, number, number], s: [58, 2.4, 0.5] as [number, number, number] }))} material={mat('#e7dfcf')} />
        <Blocks at={[-1, 1].flatMap((s) => [...Array(12)].map((_, i) => ({ p: [s * (8.5 + i * 4.8), 1.4, 0] as [number, number, number], s: [0.6, 2.8, 0.7] as [number, number, number] })))} material={mat('#2e8b45')} />
      </group>

      {/* The same wall down both sides and across the back: the park is closed all round, the gate the only way in */}
      <Blocks
        at={[
          ...[-1, 1].map((s) => ({ p: [s * 65, 1.2, -7] as [number, number, number], s: [0.5, 2.4, 98] as [number, number, number] })),
          { p: [0, 1.2, -56] as [number, number, number], s: [130.5, 2.4, 0.5] as [number, number, number] },
        ]}
        material={mat('#e7dfcf')}
      />
      <Blocks
        at={[
          ...[-1, 1].flatMap((s) => [...Array(21)].map((_, i) => ({ p: [s * 65, 1.4, 42 - i * 4.9] as [number, number, number], s: [0.7, 2.8, 0.6] as [number, number, number] }))),
          ...[...Array(27)].map((_, i) => ({ p: [-65 + i * 5, 1.4, -56] as [number, number, number], s: [0.6, 2.8, 0.7] as [number, number, number] })),
        ]}
        material={mat('#2e8b45')}
      />

      <Blocks at={greenery.trunks} material={trunk} />
      <Blocks at={greenery.crowns} material={leaves} color />

      <NoShadows>
        {open ? (
          <>
            {people.map((g, i) => (
              <group key={i} position={g.p} rotation={[0, g.ry, 0]} scale={g.kid ? 0.62 : 1}>
                <Human look={g.look} gender={g.gender} pose={g.pose} seed={g.seed} />
              </group>
            ))}
            <Strollers walkers={walkers} />
          </>
        ) : (
          // Closed: the watchman on his chair by the shut gate.
          <group position={[-4.5, 0.05, 44]} rotation={[0, 0.3, 0]}>
            <Human look={{ ...people[0].look, outfit: 'vigile' }} gender="homme" pose="sit" seed={3} />
          </group>
        )}
      </NoShadows>
      {!open && (
        // The gate shut: two leaves of green bars between the pillars, the sign.
        <group position={[0, 0, 42]}>
          <Blocks at={[...Array(23)].map((_, i) => ({ p: [-5.5 + i * 0.5, 1.3, 0] as [number, number, number], s: [0.08, 2.6, 0.08] as [number, number, number] }))} material={bars} />
          <Blocks at={[0.2, 1.3, 2.5].map((y) => ({ p: [0, y, 0] as [number, number, number], s: [11.2, 0.1, 0.1] as [number, number, number] }))} material={bars} />
          <mesh position={[0, 1.6, 0.12]} scale={[2.4, 0.9, 1]} geometry={PLANE} material={signs.closed} />
        </group>
      )}
    </group>
  )
}
