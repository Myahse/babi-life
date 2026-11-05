import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { haptic } from '../../lib/native'
import { Blocks } from '../../world3d/open/ruePrincesse'
import { Flock } from '../../world3d/open/wildlife'
import { LowHuman } from '../../avatar/LowHuman'
import { NoShadows, type Pose } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import { rng } from '../../world3d/themes'
import { JeuShell, Stage } from './jeux/Shell'
import { MySim } from './jeux/me'
import { juice, snd } from './jeux/juice'
import { t as tr } from '../../lib/i18n'

// « Partir pêcher en pirogue » (the update « sanpedro-vivant », backend game/villes2.go PirogueFish): out
// from the fishing port of San-Pédro at dawn in the big painted pirogue, the outboard cut, the crew waiting.
// The sardinella shoals ripple the sea, the gulls dive over them. Put the finger on the sea (the throw's
// strength swinging), slide to aim, let go: the casting net opens in the air and falls; what's under it
// is hauled in. The shoals swim: aim where they'll be. Six casts; the score is the fish brought aboard.

const CASTS = 6
const FULL = 30
const HAND: [number, number, number] = [0, 1.7, 2.2]
const FLIGHT = 0.9
const NET_R = 1.7

type Shoal = { x: number; z: number; vx: number; vz: number; n: number; flee: number }
type Live = { t: number; aim: number; power: number; holding: number | null; shot: { to: [number, number]; t: number } | null; haul: number; shoals: Shoal[] }

const landing = (aim: number, power: number): [number, number] => {
  const d = 2.5 + power * 11
  return [HAND[0] + Math.sin(aim) * d, HAND[2] - Math.cos(aim) * d]
}

/** The shoals: fish just under the surface, a few jumping; each shoal swims and turns back inside the bay. */
function Shoals({ live }: { live: { current: Live } }) {
  const n = 40
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.08, 0.12), new THREE.MeshLambertMaterial({ color: '#c9d6e0' }), n)
    m.frustumCulled = false
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    return m
  }, [])
  const ripple = useMemo(() => {
    const m = new THREE.InstancedMesh(new THREE.RingGeometry(0.9, 1.05, 18), new THREE.MeshBasicMaterial({ color: '#d8f0ff', transparent: true, opacity: 0.55, depthWrite: false }), 4)
    m.frustumCulled = false
    return m
  }, [])
  useEffect(() => () => (mesh.dispose(), ripple.dispose()), [mesh, ripple])
  const o = useMemo(() => new THREE.Object3D(), [])
  useFrame((_, dt0) => {
    const dt = Math.min(0.05, juice.dt(dt0))
    const l = live.current
    let k = 0
    l.shoals.forEach((s, si) => {
      const speed = s.flee > 0 ? 3 : 1
      s.x += s.vx * speed * dt
      s.z += s.vz * speed * dt
      s.flee = Math.max(0, s.flee - dt)
      // Inside the bay in front of the pirogue, turning back at its edges.
      if (s.x < -7 || s.x > 7) s.vx = -s.vx
      if (s.z < -10 || s.z > -1.5) s.vz = -s.vz
      for (let i = 0; i < 10; i++) {
        if (k >= n) break
        const a = i * 2.4 + l.t * 0.8
        const r = (i % 4) * 0.35 + 0.2
        const jump = i < s.n && (Math.floor(l.t * 1.3 + i * 0.7 + si) % 7 === 0) ? Math.sin(((l.t * 1.3 + i * 0.7) % 1) * Math.PI) * 0.7 : 0
        o.position.set(s.x + Math.cos(a) * r, i < s.n ? -0.12 + jump : -5, s.z + Math.sin(a) * r)
        o.rotation.set(0, -Math.atan2(s.vz, s.vx), jump * 1.5)
        o.updateMatrix()
        mesh.setMatrixAt(k++, o.matrix)
      }
      const kk = (l.t * 0.7 + si * 0.3) % 1
      o.position.set(s.x, 0.04, s.z)
      o.rotation.set(-Math.PI / 2, 0, 0)
      o.scale.setScalar(s.n ? 0.8 + kk * 1.4 : 0.001)
      o.updateMatrix()
      ripple.setMatrixAt(si, o.matrix)
      o.scale.setScalar(1)
    })
    for (; k < n; k++) {
      o.position.set(0, -10, 0)
      o.updateMatrix()
      mesh.setMatrixAt(k, o.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
    ripple.instanceMatrix.needsUpdate = true
  })
  return (
    <group>
      <primitive object={mesh} />
      <primitive object={ripple} />
    </group>
  )
}

/** The casting net: in the air a disc opening out, on the water the ring, then drawn back to the pirogue. */
function Net({ live }: { live: { current: Live } }) {
  const g = useRef<THREE.Mesh>(null)
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#f1efe6', transparent: true, opacity: 0.75, side: THREE.DoubleSide, wireframe: true }), [])
  useFrame(() => {
    const l = live.current
    const m = g.current
    if (!m) return
    const s = l.shot
    m.visible = !!s || l.haul > 0
    if (s) {
      const k = Math.min(1, s.t / FLIGHT)
      m.position.set(HAND[0] + (s.to[0] - HAND[0]) * k, HAND[1] + (0.05 - HAND[1]) * k + Math.sin(Math.PI * k) * 2.4, HAND[2] + (s.to[1] - HAND[2]) * k)
      m.scale.setScalar(0.2 + k * NET_R)
    } else if (l.haul > 0) {
      m.scale.setScalar(0.2 + l.haul * NET_R * 0.6)
    }
  })
  return (
    <mesh ref={g} rotation={[-Math.PI / 2, 0, 0]} material={mat} visible={false}>
      <circleGeometry args={[1, 14]} />
    </mesh>
  )
}

/** The aim on the sea: dots along the throw, the ring where the net falls. */
function Aim({ live }: { live: { current: Live } }) {
  const ring = useRef<THREE.Mesh>(null)
  const dots = useRef<(THREE.Mesh | null)[]>([])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8 }), [])
  useFrame(() => {
    const l = live.current
    const [x, z] = landing(l.aim, l.holding !== null ? l.power : 0.5)
    dots.current.forEach((d, i) => {
      if (!d) return
      const k = (i + 1) / 8
      d.position.set(HAND[0] + (x - HAND[0]) * k, HAND[1] + (0.05 - HAND[1]) * k + Math.sin(Math.PI * k) * 2.4, HAND[2] + (z - HAND[2]) * k)
      d.visible = !l.shot && l.haul <= 0
    })
    if (ring.current) {
      ring.current.position.set(x, 0.06, z)
      ring.current.visible = !l.shot && l.haul <= 0
      const near = l.shoals.some((s) => s.n && Math.hypot(s.x - x, s.z - z) < NET_R)
      mat.color.set(near ? '#69db7c' : l.holding !== null ? '#ffd43b' : '#ffffff')
    }
  })
  return (
    <group>
      {[...Array(7)].map((_, i) => (
        <mesh key={i} ref={(m) => void (dots.current[i] = m)} material={mat}>
          <boxGeometry args={[0.09, 0.09, 0.09]} />
        </mesh>
      ))}
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} material={mat}>
        <ringGeometry args={[NET_R - 0.15, NET_R, 24]} />
      </mesh>
    </group>
  )
}

/** The sea at dawn, the long painted pirogue rocking under the Sim, the crew, the coast and the port far off. */
function Sea({ live }: { live: { current: Live } }) {
  const boat = useRef<THREE.Group>(null)
  const at = useMemo(() => {
    type B = { p: [number, number, number]; s: [number, number, number]; ry?: number; c: string }
    const b: B[] = [
      { p: [0, -0.06, -14], s: [60, 0.1, 40], c: '#2f6f93' },
      // The coast far off: the sand, the palms, the port's cranes.
      { p: [0, 0.2, -33], s: [70, 0.5, 2], c: '#e3c98f' },
      { p: [0, 1.4, -34.5], s: [70, 2.4, 1.5], c: '#3f6e3a' },
      { p: [14, 3.2, -34], s: [0.5, 6, 0.5], c: '#f0b429' },
      { p: [12.5, 6, -34], s: [5, 0.4, 0.4], c: '#f0b429' },
      { p: [18, 2.6, -34], s: [5, 2.4, 1], c: '#a23a2a' },
    ]
    const r = rng('pirogue-vagues')
    for (let i = 0; i < 40; i++) b.push({ p: [(r() - 0.5) * 40, 0.0, -2 - r() * 28], s: [1.2 + r() * 1.5, 0.03, 0.12], c: '#6fa8c8' })
    return b
  }, [])
  // The pirogue: long and narrow, its high painted bow, the bands of colour, the flags, the outboard.
  const hull = useMemo(() => {
    type B = { p: [number, number, number]; s: [number, number, number]; ry?: number; c: string }
    const b: B[] = [
      { p: [0, 0.25, 0], s: [1.6, 0.5, 9], c: '#3b2a1e' },
      { p: [0.82, 0.55, 0], s: [0.1, 0.4, 9], c: '#f0b429' },
      { p: [-0.82, 0.55, 0], s: [0.1, 0.4, 9], c: '#f0b429' },
      { p: [0.84, 0.42, 0], s: [0.06, 0.12, 9], c: '#c92a2a' },
      { p: [-0.84, 0.42, 0], s: [0.06, 0.12, 9], c: '#c92a2a' },
      { p: [0.84, 0.3, 0], s: [0.06, 0.1, 9], c: '#2f9e44' },
      { p: [-0.84, 0.3, 0], s: [0.06, 0.1, 9], c: '#2f9e44' },
      { p: [0, 0.8, -4.7], s: [0.8, 0.9, 0.6], c: '#1971c2' },
      { p: [0, 1.6, -4.8], s: [0.04, 1.6, 0.04], c: '#5a4630' },
      { p: [0.25, 2.2, -4.8], s: [0.5, 0.3, 0.02], c: '#ff7a00' },
      { p: [0, 0.75, 4.6], s: [0.7, 0.6, 0.5], c: '#1971c2' },
      { p: [0, 1.0, 5.0], s: [0.4, 0.7, 0.4], c: '#2a2a2a' },
      { p: [0, 0.52, -1.5], s: [1.5, 0.08, 0.3], c: '#7a5230' },
      { p: [0, 0.52, 1.5], s: [1.5, 0.08, 0.3], c: '#7a5230' },
      // The net's heap and the fish basket.
      { p: [0.3, 0.6, 0.6], s: [0.8, 0.25, 0.8], c: '#e9e4d2' },
      { p: [-0.4, 0.62, -0.6], s: [0.6, 0.35, 0.6], c: '#8a6a3c' },
    ]
    return b
  }, [])
  const crew = useMemo(() => {
    const r = rng('pirogue-equipage')
    return [[0.3, 0.5, -3], [-0.3, 0.5, -1.4], [0.2, 0.5, 4]].map((p, i) => ({ p: p as [number, number, number], look: { ...randomLook('homme', r), outfitColor: ['#1c7ed6', '#e8590c', '#f4f1e6'][i] }, pose: (['sit', 'idle', 'sit'] as Pose[])[i] }))
  }, [])
  const mat = useMemo(() => new THREE.MeshLambertMaterial({ color: '#ffffff' }), [])
  useFrame(() => {
    const t = live.current.t
    if (boat.current) {
      boat.current.rotation.z = Math.sin(t * 1.1) * 0.04
      boat.current.rotation.x = Math.sin(t * 0.8 + 1) * 0.02
      boat.current.position.y = Math.sin(t * 1.3) * 0.06
    }
  })
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <group ref={boat} position={[0, 0, 3]} rotation={[0, Math.PI / 2, 0]}>
        <Blocks at={hull} material={mat} color />
        <NoShadows>
          {crew.map((c, i) => (
            <group key={i} position={c.p} rotation={[0, i === 1 ? -Math.PI / 2 : Math.PI, 0]}>
              <LowHuman look={c.look} gender="homme" pose={c.pose} seed={i} />
            </group>
          ))}
        </NoShadows>
      </group>
    </group>
  )
}

function Clock({ live, onTick }: { live: { current: Live }; onTick: (dt: number) => void }) {
  useFrame((_, dt0) => {
    const dt = Math.min(0.05, juice.dt(dt0))
    const l = live.current
    l.t += dt
    if (l.holding !== null) l.power = 0.5 - Math.cos((l.t - l.holding) * 3) * 0.5
    if (l.shot) l.shot.t += dt
    if (l.haul > 0) l.haul = Math.max(0, l.haul - dt * 1.1)
    onTick(dt)
  })
  return null
}

export function PechePirogueDefi({ onEnd }: { onEnd: (score: number) => void }) {
  const live = useRef<Live>({
    t: 0,
    aim: 0,
    power: 0.5,
    holding: null,
    shot: null,
    haul: 0,
    shoals: [
      { x: -4, z: -5, vx: 0.9, vz: 0.3, n: 9, flee: 0 },
      { x: 3, z: -8, vx: -0.7, vz: 0.5, n: 10, flee: 0 },
      { x: 5, z: -3.5, vx: -0.5, vz: -0.6, n: 8, flee: 0 },
      { x: -2, z: -9, vx: 0.6, vz: -0.4, n: 10, flee: 0 },
    ],
  })
  const st = useRef({ left: CASTS, fish: 0, done: false })
  const [left, setLeft] = useState(CASTS)
  const [fish, setFish] = useState(0)
  const [said, setSaid] = useState<string | null>(null)
  const [pose, setPose] = useState<Pose>('idle')
  const [gull, setGull] = useState<[number, number]>([-4, -5])
  const say = (s: string) => {
    setSaid(s)
    setTimeout(() => setSaid((v) => (v === s ? null : v)), 1500)
  }
  const finish = () => {
    if (st.current.done) return
    st.current.done = true
    const score = Math.round(Math.min(100, (st.current.fish / FULL) * 100))
    juice.finish(score, st.current.fish ? tr('{0} poissons à bord', { 0: st.current.fish }) : tr('Le filet est revenu vide…'), onEnd)
  }
  const tick = () => {
    const l = live.current
    if (st.current.done) return
    if (l.shot && l.shot.t >= FLIGHT) {
      const [x, z] = l.shot.to
      l.shot = null
      l.haul = 1
      let caught = 0
      for (const s of l.shoals) {
        const d = Math.hypot(s.x - x, s.z - z)
        if (d < NET_R + 0.6 && s.n) {
          // Under the net: the nearer its middle, the more of the shoal.
          const k = Math.max(0.25, 1 - d / (NET_R + 0.6))
          const got = Math.min(s.n, Math.max(1, Math.round(s.n * k)))
          s.n -= got
          caught += got
        }
        // The splash scares the shoals near it away.
        if (d < 5) {
          s.flee = 2
          const a = Math.atan2(s.z - z, s.x - x)
          s.vx = Math.cos(a) * 0.9
          s.vz = Math.sin(a) * 0.9
        }
      }
      // A shoal emptied: another comes up, further out.
      l.shoals.forEach((s) => {
        if (s.n === 0 && Math.random() < 0.7) {
          s.n = 7 + Math.floor(Math.random() * 4)
          s.x = (Math.random() - 0.5) * 12
          s.z = -6 - Math.random() * 4
        }
      })
      snd.splash()
      if (caught) {
        st.current.fish += caught
        setFish(st.current.fish)
        juice.good({ at: [x, 0.5, z], text: caught >= 7 ? tr('Plein filet ! +{0}', { 0: caught }) : tr('+{0} poissons', { 0: caught }), perfect: caught >= 7, colors: ['#c9d6e0', '#ffffff', '#74c0fc'], n: 10 + caught })
        haptic(caught >= 7 ? 'success' : 'light')
        setPose('cheer')
        say(caught >= 7 ? tr('L’équipage crie : « Woyo ! »') : tr('On tire le filet…'))
      } else {
        juice.bad({ at: [x, 0.3, z], text: tr('Rien sous le filet'), soft: true })
        setPose('despair')
      }
      setTimeout(() => setPose('idle'), 900)
      const best = l.shoals.reduce((b, s) => (s.n > b.n ? s : b), l.shoals[0])
      setGull([best.x, best.z])
      if (st.current.left <= 0) setTimeout(finish, 1100)
    }
  }
  const press = () => {
    const l = live.current
    if (st.current.done || l.shot || l.haul > 0 || st.current.left <= 0 || l.holding !== null) return
    l.holding = l.t
    setPose('raise')
    haptic('light')
  }
  const release = () => {
    const l = live.current
    if (l.holding === null) return
    l.holding = null
    if (st.current.done || l.shot || st.current.left <= 0) return setPose('idle')
    st.current.left--
    setLeft(st.current.left)
    l.shot = { to: landing(l.aim, l.power), t: 0 }
    snd.whoosh(0.4 + l.power * 0.5)
    haptic('medium')
    setPose('throw')
  }
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const l = live.current
      if (e.code === 'Space' || e.key === 'Enter') return e.preventDefault(), e.repeat || press()
      if (e.key === 'ArrowLeft') (e.preventDefault(), (l.aim = Math.max(-0.8, l.aim - 0.06)))
      if (e.key === 'ArrowRight') (e.preventDefault(), (l.aim = Math.min(0.8, l.aim + 0.06)))
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === 'Enter') (e.preventDefault(), release())
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => (window.removeEventListener('keydown', down), window.removeEventListener('keyup', up))
  })
  const aimAt = (x: number, z: number) => {
    live.current.aim = Math.max(-0.8, Math.min(0.8, Math.atan2(x - HAND[0], HAND[2] - z)))
  }
  if (import.meta.env.DEV) Object.assign(globalThis, { __pirogue: { live: live.current, press, release } })
  return (
    <JeuShell
      title={tr('La pêche en pirogue')}
      how={tr('Pose le doigt sur la mer : la force monte et descend ; glisse pour viser le banc de poissons, lâche : l’épervier s’ouvre et tombe. Les bancs nagent, vise devant eux !')}
      goal={tr('Remplis la pirogue !')}
      status={tr('{0} lancers · {1} poissons', { 0: left, 1: fish })}
      said={said}
      tall
      controls={
        <button className="btn flex-1 touch-none !py-4 text-[17px] select-none" disabled={left <= 0} onPointerDown={(e) => (e.preventDefault(), press())} onPointerUp={() => release()} onPointerLeave={() => release()}>
          {tr('Tenir et lancer')}
        </button>
      }
    >
      <div className="absolute inset-0 touch-none overflow-hidden rounded-3xl bg-[linear-gradient(#f7b27a,#f6d9a8_45%,#9fc8e0)]">
        <Stage decor="ciel" cam={[0, 4.6, 8.4]} look={[0, 0, -4.5]} fov={52}>
          <Sea live={live} />
          <Shoals live={live} />
          <Flock centre={gull} radius={3} height={9} n={5} seed="pirogue-mouettes" />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, -6]} onPointerDown={(e) => (aimAt(e.point.x, e.point.z), press())} onPointerMove={(e) => aimAt(e.point.x, e.point.z)} onPointerUp={() => release()} onPointerLeave={() => release()}>
            <planeGeometry args={[30, 24]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
          <Aim live={live} />
          <Net live={live} />
          <MySim pose={pose} p={[0, 0.5, 2.4]} r={Math.PI} scale={0.9} />
          <Clock live={live} onTick={tick} />
        </Stage>
      </div>
    </JeuShell>
  )
}
