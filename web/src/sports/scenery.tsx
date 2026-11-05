import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { rng } from '../world3d/themes'
import { paint } from '../streetball/looks'

// The courts' surroundings for tennis and volleyball (tennisScene.tsx, volleyScene.tsx), in the game's
// blocks: palms, a stepped stand and the crowd on it (one instanced mesh for the bodies, one for the
// heads, so a full stand is two draws), a painted banner, a floodlight, a straw paillote, the sea.

export const BOX = new THREE.BoxGeometry(1, 1, 1)
const mats = new Map<string, THREE.MeshLambertMaterial>()
/** One material per colour, shared. */
export const flat = (color: string) => {
  let m = mats.get(color)
  if (!m) mats.set(color, (m = new THREE.MeshLambertMaterial({ color })))
  return m
}

/** A coconut palm: the leaning trunk in rings, the fronds drooping round the top. */
export function Palm({ at, h = 7, seed = 0 }: { at: [number, number]; h?: number; seed?: number }) {
  const r = rng(`palm-${seed}`)
  const lean = (r() - 0.5) * 0.3
  const turn = r() * Math.PI * 2
  return (
    <group position={[at[0], 0, at[1]]} rotation={[0, turn, lean]}>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} geometry={BOX} material={flat(i % 2 ? '#7a5a3a' : '#8b6a45')} position={[0, (h / 6) * (i + 0.5), 0]} scale={[0.32 - i * 0.02, h / 6 + 0.02, 0.32 - i * 0.02]} castShadow />
      ))}
      {Array.from({ length: 7 }, (_, i) => {
        const a = (i / 7) * Math.PI * 2
        return (
          <group key={i} position={[0, h, 0]} rotation={[0, a, 0]}>
            <mesh geometry={BOX} material={flat(i % 2 ? '#2f7d32' : '#3a8f3c')} position={[1.25, -0.35, 0]} rotation={[0, 0, -0.45]} scale={[2.6, 0.06, 0.55]} castShadow />
          </group>
        )
      })}
      <mesh geometry={BOX} material={flat('#6b4a2e')} position={[0, h - 0.2, 0]} scale={[0.5, 0.4, 0.5]} />
    </group>
  )
}

/** A stand along x (its length), stepping up away from the court (+z of its own frame), with people on it. */
export function Stand({ at, len, rows = 5, rot = 0, fill = 0.75, seed = 's', color = '#9aa3ad' }: { at: [number, number]; len: number; rows?: number; rot?: number; fill?: number; seed?: string; color?: string }) {
  const people = useMemo(() => {
    const r = rng(seed)
    const out: [number, number, number][] = []
    for (let row = 0; row < rows; row++) for (let x = -len / 2 + 0.4; x < len / 2 - 0.3; x += 0.62) if (r() < fill) out.push([x + (r() - 0.5) * 0.15, 0.45 + row * 0.45, 0.35 + row * 0.8])
    return out
  }, [len, rows, fill, seed])
  return (
    <group position={[at[0], 0, at[1]]} rotation={[0, rot, 0]}>
      {Array.from({ length: rows }, (_, row) => (
        <mesh key={row} geometry={BOX} material={flat(row % 2 ? color : '#b8c0c8')} position={[0, (row + 1) * 0.225, 0.4 + row * 0.8]} scale={[len, (row + 1) * 0.45, 0.8]} receiveShadow />
      ))}
      <Crowd seats={people} seed={seed} />
    </group>
  )
}

/** The stands jumping up at a big point: the matches set when (performance.now() seconds) and how much (0…1). */
export const crowdJump = { at: -99, power: 1 }
export const cheerCrowd = (power = 1) => void Object.assign(crowdJump, { at: performance.now() / 1000, power })

type Flying = { x: number; y: number; z: number; vx: number; vy: number; vz: number }
const UP = new THREE.Vector3(0, 1, 0)
/** A cone with its wide end at the origin and its tip one unit up: the streak's shape. */
const STREAK = (() => {
  // (Three's cone has its tip up at +½, its base at -½.)
  const g = new THREE.ConeGeometry(1, 1, 8, 1, true)
  g.translate(0, 0.5, 0)
  return g
})()

/**
 * The streak a fast ball leaves (as TV games draw it): a fading cone behind it along its flight, longer and
 * stronger the faster it goes. `size` the ball's drawn radius now (the scenes draw it bigger far off).
 */
export function Streak({ ball, size, color = '#ffffff', from = 12, hide }: { ball: Flying; size: () => number; color?: string; from?: number; hide?: () => boolean }) {
  const mesh = useRef<THREE.Mesh>(null)
  const tmp = useMemo(() => new THREE.Vector3(), [])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }), [color])
  useFrame(() => {
    const m = mesh.current
    if (!m) return
    const v = Math.hypot(ball.vx, ball.vy, ball.vz)
    const k = Math.min(1, (v - from) / 18)
    m.visible = k > 0 && !hide?.()
    if (!m.visible) return
    m.quaternion.setFromUnitVectors(UP, tmp.set(-ball.vx / v, -ball.vy / v, -ball.vz / v))
    const r = size()
    m.position.set(ball.x, ball.y, ball.z)
    m.scale.set(r * 0.85, Math.min(2.4, v * 0.045), r * 0.85)
    mat.opacity = 0.42 * k
  })
  return <mesh ref={mesh} geometry={STREAK} material={mat} frustumCulled={false} visible={false} />
}

/** A flat ring on the ground (a landing spot, a timing target): one mesh, placed and scaled by its owner every frame. */
export const RING = new THREE.RingGeometry(0.8, 1, 32)
/** The aids' colours (tennisScene, volleyScene): the perfect moment, a button held, waiting, a spike's (made once: nothing new per frame). */
export const AID = { perfect: new THREE.Color('#40c057'), held: new THREE.Color('#ff8200'), plain: new THREE.Color('#ffffff'), spike: new THREE.Color('#e03131') }

const SHIRTS = ['#ff8200', '#009e60', '#ffffff', '#1d4ed8', '#e03131', '#fcc419', '#7950f2', '#212529', '#e64980', '#20c997']
const SKINS = ['#5a3a24', '#6b4329', '#7d4f30', '#4a2f1d', '#8a5a36']
/** Seated people as blocks (a body and a head each), bobbing now and then; two draws for all of them. */
export function Crowd({ seats, seed = 'c' }: { seats: [number, number, number][]; seed?: string }) {
  const bodies = useRef<THREE.InstancedMesh>(null)
  const heads = useRef<THREE.InstancedMesh>(null)
  const phase = useMemo(() => {
    const r = rng(`${seed}-p`)
    return seats.map(() => r() * 10)
  }, [seats, seed])
  useLayoutEffect(() => {
    const r = rng(seed)
    const m = new THREE.Matrix4()
    const c = new THREE.Color()
    seats.forEach(([x, y, z], i) => {
      m.compose(new THREE.Vector3(x, y + 0.32, z), new THREE.Quaternion(), new THREE.Vector3(0.42, 0.62, 0.28))
      bodies.current!.setMatrixAt(i, m)
      bodies.current!.setColorAt(i, c.set(SHIRTS[Math.floor(r() * SHIRTS.length)]))
      m.compose(new THREE.Vector3(x, y + 0.78, z), new THREE.Quaternion(), new THREE.Vector3(0.24, 0.26, 0.24))
      heads.current!.setMatrixAt(i, m)
      heads.current!.setColorAt(i, c.set(SKINS[Math.floor(r() * SKINS.length)]))
    })
    for (const im of [bodies.current!, heads.current!]) {
      im.instanceMatrix.needsUpdate = true
      if (im.instanceColor) im.instanceColor.needsUpdate = true
    }
  }, [seats, seed])
  // A few heads bob (they follow the ball, they talk); at a big point the whole stand jumps up (crowdJump).
  const t0 = useRef(0)
  const jumping = useRef(false)
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), p: new THREE.Vector3(), q: new THREE.Quaternion(), body: new THREE.Vector3(0.42, 0.62, 0.28), head: new THREE.Vector3(0.24, 0.26, 0.24) }), [])
  useFrame((_, dt) => {
    t0.current += dt
    if (!heads.current || !bodies.current || seats.length === 0) return
    const { m, p, q, body, head } = tmp
    const since = performance.now() / 1000 - crowdJump.at
    if (since < 2 || jumping.current) {
      // All of them: up off the seats, arms or not, out of time with each other, settling down.
      jumping.current = since < 2
      const k = jumping.current ? crowdJump.power * (1 - since / 2) : 0
      for (let i = 0; i < seats.length; i++) {
        const [x, y, z] = seats[i]
        const up = k * (0.12 + Math.max(0, Math.sin(since * 9 + phase[i] * 3)) * 0.22)
        bodies.current.setMatrixAt(i, m.compose(p.set(x, y + 0.32 + up, z), q, body))
        heads.current.setMatrixAt(i, m.compose(p.set(x, y + 0.78 + up, z), q, head))
      }
      bodies.current.instanceMatrix.needsUpdate = true
      heads.current.instanceMatrix.needsUpdate = true
      return
    }
    const n = Math.min(24, seats.length)
    for (let k = 0; k < n; k++) {
      const i = (k * 7 + Math.floor(t0.current)) % seats.length
      const [x, y, z] = seats[i]
      heads.current.setMatrixAt(i, m.compose(p.set(x + Math.sin(t0.current * 2 + phase[i]) * 0.04, y + 0.78 + Math.max(0, Math.sin(t0.current * 3 + phase[i])) * 0.03, z), q, head))
    }
    heads.current.instanceMatrix.needsUpdate = true
  })
  const mat = useMemo(() => new THREE.MeshLambertMaterial({ color: '#ffffff' }), [])
  return (
    <group>
      <instancedMesh ref={bodies} args={[BOX, mat, Math.max(1, seats.length)]} castShadow />
      <instancedMesh ref={heads} args={[BOX, mat, Math.max(1, seats.length)]} />
    </group>
  )
}

/** A painted banner (text on a colour), as the arenas hang. */
export function Banner({ at, w, h = 0.9, text, bg, fg = '#ffffff', rot = 0, y = 0.5 }: { at: [number, number]; w: number; h?: number; text: string; bg: string; fg?: string; rot?: number; y?: number }) {
  const tex = useMemo(
    () =>
      paint(`banner-${text}-${bg}-${w}`, 512, Math.round((512 * h) / w), (g) => {
        g.fillStyle = bg
        g.fillRect(0, 0, 512, 512)
        g.fillStyle = fg
        g.font = `900 ${Math.round(((512 * h) / w) * 0.62)}px sans-serif`
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.fillText(text, 256, ((512 * h) / w) * 0.54, 496)
      }),
    [text, bg, fg, w, h],
  )
  return (
    <mesh position={[at[0], y, at[1]]} rotation={[0, rot, 0]}>
      <planeGeometry args={[w, h]} />
      <meshLambertMaterial map={tex} side={THREE.DoubleSide} />
    </mesh>
  )
}

/** A floodlight: the grey mast, the head of lamps turned to the court. */
export function Floodlight({ at, h = 14, face = 0 }: { at: [number, number]; h?: number; face?: number }) {
  return (
    <group position={[at[0], 0, at[1]]} rotation={[0, face, 0]}>
      <mesh geometry={BOX} material={flat('#8a9099')} position={[0, h / 2, 0]} scale={[0.25, h, 0.25]} castShadow />
      <mesh geometry={BOX} material={flat('#5b616a')} position={[0, h, 0.2]} scale={[1.6, 0.9, 0.25]} />
      <mesh geometry={BOX} material={flat('#fff8dc')} position={[0, h, 0.34]} scale={[1.4, 0.7, 0.04]} />
    </group>
  )
}

/** A paillote: the beach's straw hut on its posts (a bar, shade). */
export function Paillote({ at, s = 1, rot = 0 }: { at: [number, number]; s?: number; rot?: number }) {
  return (
    <group position={[at[0], 0, at[1]]} rotation={[0, rot, 0]} scale={[s, s, s]}>
      {[-1.3, 1.3].map((x) => [-1.3, 1.3].map((z) => <mesh key={`${x}${z}`} geometry={BOX} material={flat('#8b6a45')} position={[x, 1.3, z]} scale={[0.16, 2.6, 0.16]} castShadow />))}
      <mesh position={[0, 3.2, 0]} castShadow material={flat('#c9a25a')}>
        <coneGeometry args={[2.6, 1.6, 4]} />
      </mesh>
      <mesh geometry={BOX} material={flat('#a0784a')} position={[0, 0.55, 1.2]} scale={[2.4, 1.1, 0.4]} />
    </group>
  )
}

/** The sea off a beach: the water to the horizon, its swell, the foam line moving on the sand. */
export function Sea({ z, w = 400 }: { z: number; w?: number }) {
  const foam = useRef<THREE.Mesh>(null)
  const water = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (foam.current) foam.current.position.z = z - 1 + Math.sin(t * 0.6) * 1.4
    if (water.current) water.current.position.y = 0.02 + Math.sin(t * 0.8) * 0.03
  })
  return (
    <group>
      <mesh ref={water} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, z - 150]}>
        <planeGeometry args={[w, 300]} />
        <meshLambertMaterial color="#2a7fb8" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, z - 4]}>
        <planeGeometry args={[w, 8]} />
        <meshLambertMaterial color="#5fb3d6" />
      </mesh>
      <mesh ref={foam} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, z - 1]}>
        <planeGeometry args={[w, 1.2]} />
        <meshBasicMaterial color="#f4fbff" transparent opacity={0.85} />
      </mesh>
    </group>
  )
}

/** Speckled ground: a colour with grains lighter and darker (the clay, the sand, the hard court's paint). */
export function grain(key: string, base: string, spots: string[], n = 2600, size = 256, repeat: [number, number] = [8, 8]) {
  return paint(
    `grain-${key}`,
    size,
    size,
    (g) => {
      const r = rng(key)
      g.fillStyle = base
      g.fillRect(0, 0, size, size)
      for (let i = 0; i < n; i++) {
        g.fillStyle = spots[Math.floor(r() * spots.length)]
        const s = 1 + r() * 2
        g.fillRect(r() * size, r() * size, s, s)
      }
    },
    repeat,
  )
}
