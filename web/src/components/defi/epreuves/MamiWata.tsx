import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Flash, Hud, beep, clamp, rnd, useHud, fx } from './kit'
import { Stage3D, groundAt, screenOf, type Finger } from './stage'
import { Box } from '../../../world3d/props'
import { Prop } from '../jeux/props'
import { t } from '../../../lib/i18n'

// « La lumière sur la lagune », chapter 3 (game/epreuves.go): the evening on the lagoon, Akpa's pirogue,
// the plastics floating and the fish coming up under them. Draw a loop round them with the finger, like a
// net, and close it: what's inside is fished out. Twenty plastics before nightfall; a fish caught, you let
// it go… and it costs. The lagoon in the game's 3D blocks seen from above the pirogue: the water, the reeds,
// the bottles, sachets and flip-flops drifting, the fish swimming by; the net drawn on the water as a line
// of floats under the finger, green when it closes on plastic, red on a fish; the light going down. The
// same rule and score (the sizes in the scene's units, the same proportions as before).

const TIME = 50
const GOAL = 20
const KINDS = ['bouteille', 'sachet', 'sachet', 'tapette', 'bouteille'] as const
/** The old screen's width in the scene, and px to the scene's units. */
const W = 5.2
const PX = W / 390
const Z0 = -2.4
const Z1 = 4.2
const FLOATS = 400
type Bit = { x: number; z: number; vx: number; vz: number; kind: (typeof KINDS)[number] | 'poisson'; a: number; gone: number; id: number }
type P = { x: number; z: number }

const inside = (x: number, z: number, poly: P[]) => {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) c = !c
  }
  return c
}

type S = { bits: Bit[]; loop: P[]; drawing: boolean; got: number; fish: number; over: boolean; next: number; now: number; started: boolean; net: { at: number; ok: boolean } | null; ids: number }

export default function MamiWata({ onEnd }: { onEnd: (score: number) => void }) {
  const s = useRef<S>({ bits: [], loop: [], drawing: false, got: 0, fish: 0, over: false, next: 0, now: 0, started: false, net: null, ids: 0 })
  const [hud, setHud] = useHud({ left: TIME, got: 0 })
  const [flash, setFlash] = useState({ text: '', at: 0 })
  const [bits, setBits] = useState<Bit[]>([])
  const v = useMemo(() => new THREE.Vector3(), [])

  const spawn = (fish = false): Bit => {
    const fromLeft = Math.random() < 0.5
    const st = s.current
    return { x: (fromLeft ? -1 : 1) * (W / 2 + 0.3), z: rnd(Z0 + 0.4, Z1 - 0.3), vx: (fromLeft ? 1 : -1) * rnd(fish ? 30 : 12, fish ? 55 : 28) * PX, vz: rnd(-4, 4) * PX, kind: fish ? 'poisson' : KINDS[Math.floor(Math.random() * KINDS.length)], a: rnd(0, 6), gone: 0, id: ++st.ids }
  }

  const tick = (dt: number) => {
    const st = s.current
    if (!st.started) return
    st.now += dt
    const now = st.now
    let changed = false
    if (!st.bits.length) ((st.bits = Array.from({ length: 12 }, (_, i) => ({ ...spawn(i % 4 === 0), x: rnd(-0.4, 0.4) * W }))), (changed = true))
    const left = TIME - now
    if (!st.over && (left <= 0 || st.got >= GOAL)) {
      st.over = true
      setTimeout(() => onEnd(Math.round(clamp(clamp(st.got / GOAL, 0, 1) * 85 - st.fish * 5 + (st.got >= GOAL ? (left / TIME) * 15 : 0), 0, 100))), 900)
    }
    if (!st.over && now > st.next && st.bits.filter((b) => !b.gone).length < 16) {
      st.bits.push(spawn(Math.random() < 0.3))
      st.next = now + rnd(0.5, 1.1)
      changed = true
    }
    for (const b of st.bits) {
      if (b.gone) continue
      b.x += b.vx * dt
      b.z = clamp(b.z + (b.vz + Math.sin(now * 2 + b.a) * 6 * PX) * dt, Z0 + 0.2, Z1 - 0.1)
      if (b.x < -W / 2 - 0.6 || b.x > W / 2 + 0.6) b.gone = now - 1
    }
    const kept = st.bits.filter((b) => !b.gone || now - b.gone < 0.5)
    if (kept.length !== st.bits.length) ((st.bits = kept), (changed = true))
    if (changed) setBits(st.bits.slice())
    setHud({ left: Math.max(0, left), got: st.got })
  }

  const pull = () => {
    const st = s.current
    const p = st.loop
    st.drawing = false
    if (p.length < 8) return void (st.loop = [])
    const a = p[0]
    const b = p[p.length - 1]
    const closed = Math.hypot(a.x - b.x, a.z - b.z) < 50 * PX
    if (!closed) {
      st.loop = []
      setFlash({ text: t('Ferme la boucle !'), at: Date.now() })
      return
    }
    let got = 0
    let fish = 0
    for (const bit of st.bits) {
      if (bit.gone || !inside(bit.x, bit.z, p)) continue
      bit.gone = st.now
      if (bit.kind === 'poisson') fish++
      else got++
    }
    st.got += got
    st.fish += fish
    // The net stays a moment on the water, green or red.
    st.net = { at: st.now, ok: fish === 0 && got > 0 }
    const cx = p.reduce((a, q) => a + q.x, 0) / p.length
    const cz = p.reduce((a, q) => a + q.z, 0) / p.length
    const c = screenOf(cx, 0, cz)
    if (got) (beep(520 + got * 60, 0.15, 0.12), fx.good(c.x, c.y, `+${got}`))
    if (fish) fx.bad(c.x, c.y, t('Un poisson !'))
    if (st.got >= GOAL) fx.win()
    if (fish) {
      beep(200, 0.25, 0.12, { type: 'square' })
      setFlash({ text: t('Un poisson ! On le relâche…'), at: Date.now() })
    } else if (got >= 3) setFlash({ text: t('Beau coup de filet !'), at: Date.now() })
  }

  const touch = (e: Finger) => {
    const st = s.current
    if (st.over || !st.started) return
    const on = groundAt(e.x, e.y, 0, v)
    if (e.kind === 'down' && on) {
      st.drawing = true
      st.net = null
      st.loop = [{ x: v.x, z: v.z }]
    } else if (e.kind === 'move' && st.drawing && on) {
      const l = st.loop[st.loop.length - 1]
      if (Math.hypot(v.x - l.x, v.z - l.z) > 6 * PX && st.loop.length < FLOATS) st.loop.push({ x: v.x, z: v.z })
    } else if (e.kind === 'up' && st.drawing) pull()
  }

  return (
    <div className="absolute inset-0 select-none">
      <Stage3D cam={[0, 8, 3.2]} look={[0, 0, 0.9]} fov={40} fit={[W + 0.4, Z1 - Z0 + 0.4]} bg="#ff922b" touch={touch} onReady={() => (s.current.started = true)}>
        <Lagoon s={s} />
        <Floating s={s} bits={bits} tick={tick} />
        <Net s={s} />
      </Stage3D>
      <Hud title={t('Le filet')} left={hud.left} done={`${hud.got}/${GOAL}`} />
      <Flash text={flash.text} at={flash.at} />
      <p className="pointer-events-none absolute inset-x-0 bottom-4 px-4 text-center text-xs font-bold text-white/80">{t('Entoure les plastiques d’un trait et ferme la boucle. Laisse les poissons !')}</p>
    </div>
  )
}

/** The lagoon: the water (darkening as the evening falls), the reeds along the far bank, the pirogue's bow. */
function Lagoon({ s }: { s: React.RefObject<S> }) {
  const water = useRef<THREE.MeshLambertMaterial>(null)
  const day = useMemo(() => new THREE.Color('#3c6e82'), [])
  const night = useMemo(() => new THREE.Color('#1e3846'), [])
  const waves = useRef<THREE.Group>(null)
  useFrame(() => {
    const st = s.current
    const k = clamp(st.now / TIME, 0, 1)
    water.current?.color.copy(day).lerp(night, k)
    const now = performance.now() / 1000
    waves.current?.children.forEach((m, i) => (m.position.x = (((now * 0.25 + i * 1.3) % (W + 2)) - W / 2 - 1)))
  })
  return (
    <group>
      <mesh position={[0, -0.05, 1]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[16, 16]} />
        <meshLambertMaterial ref={water} color="#3c6e82" />
      </mesh>
      <group ref={waves}>
        {Array.from({ length: 12 }, (_, i) => (
          <Box key={i} p={[0, -0.03, Z0 + (i / 12) * (Z1 - Z0)]} s={[0.6, 0.01, 0.04]} c="#7fb3c4" />
        ))}
      </group>
      {Array.from({ length: 14 }, (_, i) => (
        <Box key={i} p={[-W / 2 - 0.2 + (i / 13) * (W + 0.4), 0.3 + (i % 3) * 0.1, Z0 - 0.5]} s={[0.08, 0.6 + (i % 3) * 0.2, 0.08]} c="#2f6b2f" />
      ))}
      <Box p={[0, 0, Z0 - 1.2]} s={[16, 0.2, 1.2]} c="#3d5a2a" />
      {/* The pirogue's bow, near you */}
      <Box p={[0, 0.05, Z1 + 0.4]} s={[1.2, 0.3, 0.6]} c="#6b4423" />
      <Box p={[0, 0.05, Z1 + 0.05]} s={[0.6, 0.28, 0.3]} c="#7a4f2a" />
    </group>
  )
}

/** One floating thing in blocks: a bottle lying, a white sachet, a flip-flop, or a fish (the game's). */
function Thing({ kind }: { kind: Bit['kind'] }) {
  switch (kind) {
    case 'bouteille':
      return (
        <group rotation={[0, 0, Math.PI / 2]} scale={0.35}>
          <Prop id="bouteille" />
        </group>
      )
    case 'sachet':
      return (
        <group>
          <Box p={[0, 0.02, 0]} s={[0.26, 0.04, 0.2]} c="#f8f9fa" />
          <Box p={[0.1, 0.05, 0]} s={[0.06, 0.04, 0.12]} c="#dee2e6" />
        </group>
      )
    case 'tapette':
      return (
        <group>
          <Box p={[0, 0.02, 0]} s={[0.3, 0.04, 0.13]} c="#f783ac" />
          <Box p={[0.04, 0.05, 0]} s={[0.12, 0.02, 0.02]} c="#212529" />
        </group>
      )
    default:
      return (
        <group scale={0.4} position={[0, -0.04, 0]}>
          <Prop id="poisson-vivant" />
        </group>
      )
  }
}

/** The plastics drifting and the fish swimming by; netted, lifted out of the water. */
function Floating({ s, bits, tick }: { s: React.RefObject<S>; bits: Bit[]; tick: (dt: number) => void }) {
  const refs = useRef(new Map<number, THREE.Group>())
  useFrame((_, raw) => {
    tick(Math.min(raw, 0.05))
    const st = s.current
    const now = performance.now() / 1000
    for (const b of st.bits) {
      const g = refs.current.get(b.id)
      if (!g) continue
      const up = b.gone ? (st.now - b.gone) * 3 : 0
      g.position.set(b.x, Math.sin(now * 2 + b.a) * 0.02 + up, b.z)
      g.rotation.y = b.kind === 'poisson' ? (b.vx > 0 ? 0 : Math.PI) : b.a + now * 0.2
    }
  })
  return (
    <group>
      {bits.map((b) => (
        <group key={b.id} ref={(el) => void (el ? refs.current.set(b.id, el) : refs.current.delete(b.id))} position={[b.x, 0, b.z]} scale={1.7}>
          <Thing kind={b.kind} />
        </group>
      ))}
    </group>
  )
}

/** The net being drawn: a line of floats on the water under the finger; closed, green (plastic) or red (a fish). */
function Net({ s }: { s: React.RefObject<S> }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const o = useMemo(() => new THREE.Object3D(), [])
  const cols = useMemo(() => ({ draw: new THREE.Color('#fff4d6'), ok: new THREE.Color('#69db7c'), bad: new THREE.Color('#ff8787') }), [])
  useFrame(() => {
    const m = mesh.current
    const st = s.current
    if (!m) return
    if (st.net && st.now - st.net.at > 0.6) ((st.net = null), (st.loop = []))
    const c = st.net ? (st.net.ok ? cols.ok : cols.bad) : cols.draw
    // (The material learns of the floats' colours once there are some.)
    if (!m.instanceColor && st.loop.length) (m.setColorAt(0, c), ((m.material as THREE.Material).needsUpdate = true))
    st.loop.forEach((p, i) => {
      o.position.set(p.x, 0.02, p.z)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      m.setColorAt(i, c)
    })
    m.count = st.loop.length
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  })
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, FLOATS]} count={0} frustumCulled={false}>
      <boxGeometry args={[0.07, 0.05, 0.07]} />
      <meshBasicMaterial />
    </instancedMesh>
  )
}
