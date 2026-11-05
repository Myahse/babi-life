import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { haptic } from '../../lib/native'
import { Box } from '../../world3d/props'
import { CROCODILE, Herd, type Animal, type Brain } from '../../world3d/open/wildlife'
import { JeuShell, Stage } from './jeux/Shell'
import { MySim } from './jeux/me'
import { juice, snd } from './jeux/juice'
import type { Pose } from '../../avatar/Human'
import { t as tr } from '../../lib/i18n'

// « Nourrir les caïmans sacrés, de loin » (the update « yakro-vivant », backend game/villes.go): the
// late afternoon at the lake of the presidential palace, Yamoussoukro. Behind the green rail, a
// chicken in hand; down the red bank, the sacred crocodiles in the water. One comes up, its jaws
// open: put the finger down (the Sim winds up, the throw's strength swinging), slide to aim, let go:
// the chicken flies over the bank. In the open jaws, it's snapped up (from far, it counts more);
// short on the bank, a crocodile climbs out toward the rail and the keeper's whistle sends you back a
// step. The score: the chickens taken, the farther the better.

const CHICKENS = 6
const RAIL_Z = 2.3
const HAND: [number, number, number] = [0.3, 1.5, 3.1]
const OPEN_FOR = 3.6 // seconds a crocodile keeps its jaws open, waiting
const FLIGHT = 0.85

type Croc = { home: [number, number]; open: number; lunge: number; climb: number }
type Live = {
  t: number
  /** The aim (radians, + to the right) and the throw's strength swinging while held (0..1). */
  aim: number
  power: number
  holding: number | null
  /** The chicken in the air: from the hand to its landing, since when. */
  shot: { to: [number, number]; t: number } | null
  /** Which crocodile has its jaws open now, since when. */
  open: number
  since: number
  crocs: Croc[]
}

/** Where a throw lands: the aim's direction, the strength's distance out from the rail. */
const landing = (aim: number, power: number): [number, number] => {
  const d = 1.5 + power * 12.5
  return [HAND[0] + Math.sin(aim) * d, HAND[2] - Math.cos(aim) * d]
}

/** The crocodiles in the défi: each at home in the water, the open one up with its jaws wide, the fed one lunging, the one come for a short throw climbing the bank. */
function crocsBrain(live: { current: Live }): Brain {
  return (a, dt, time) => {
    const i = Math.round(a.ox)
    const c = live.current.crocs[i]
    if (!c) return
    const open = live.current.open === i
    let [tx, tz] = c.home
    let y = -0.42
    if (c.climb > 0) {
      // Out of the water and up the bank, toward the rail.
      tz = RAIL_Z - 1.4
      y = 0
      c.climb -= dt
    } else if (c.lunge > 0) {
      tz = c.home[1] + 1.4
      y = -0.15
      c.lunge -= dt
    } else if (open) y = -0.12
    const dx = tx - a.x
    const dz = tz - a.z
    const d = Math.hypot(dx, dz)
    // Facing the rail when still, its way when moving.
    const want = d > 0.3 ? Math.atan2(dz, dx) : Math.atan2(HAND[2] - a.z, HAND[0] - a.x)
    a.h += Math.atan2(Math.sin(want - a.h), Math.cos(want - a.h)) * Math.min(1, dt * (c.lunge > 0 ? 8 : 2.5))
    const v = c.lunge > 0 ? 6 : c.climb > 0 ? 1.6 : 1.2
    a.gait += ((d > 0.3 ? 1.2 : 0) - a.gait) * Math.min(1, dt * 3)
    if (d > 0.05) {
      const k = Math.min(1, (v * dt) / d)
      a.x += dx * k
      a.z += dz * k
    }
    a.y += (y - a.y) * Math.min(1, dt * 3)
    a.jaw = c.lunge > 0 ? (c.lunge > 0.35 ? 1 : 0) : open ? 0.75 + Math.sin(time * 4) * 0.25 : c.climb > 0 ? 0.6 : a.jaw * 0.9
  }
}

/** The chicken in flight: a white bird in blocks, its red comb, turning over. */
function Chicken({ live }: { live: { current: Live } }) {
  const g = useRef<THREE.Group>(null)
  useFrame(() => {
    const s = live.current.shot
    if (!g.current) return
    g.current.visible = !!s
    if (!s) return
    const k = Math.min(1, s.t / FLIGHT)
    g.current.position.set(HAND[0] + (s.to[0] - HAND[0]) * k, HAND[1] + (0.1 - HAND[1]) * k + Math.sin(Math.PI * k) * 3.2, HAND[2] + (s.to[1] - HAND[2]) * k)
    g.current.rotation.set(k * 9, k * 3, 0)
  })
  return (
    <group ref={g} visible={false}>
      <Box p={[0, 0, 0]} s={[0.36, 0.26, 0.24]} c="#f6f1e6" />
      <Box p={[0.2, 0.12, 0]} s={[0.14, 0.14, 0.14]} c="#f6f1e6" />
      <Box p={[0.22, 0.22, 0]} s={[0.1, 0.07, 0.04]} c="#d62f2f" />
      <Box p={[0.3, 0.1, 0]} s={[0.07, 0.04, 0.05]} c="#f0b429" />
    </group>
  )
}

/** The aim on the water: dots along the throw's arc, the ring where it lands (green over open jaws). */
function AimArc({ live }: { live: { current: Live } }) {
  const dots = useRef<(THREE.Mesh | null)[]>([])
  const ring = useRef<THREE.Mesh>(null)
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 }), [])
  useFrame(() => {
    const l = live.current
    const [x, z] = landing(l.aim, l.holding !== null ? l.power : 0.55)
    dots.current.forEach((d, i) => {
      if (!d) return
      const k = (i + 1) / 9
      d.position.set(HAND[0] + (x - HAND[0]) * k, HAND[1] + (0.1 - HAND[1]) * k + Math.sin(Math.PI * k) * 3.2, HAND[2] + (z - HAND[2]) * k)
      d.visible = !l.shot
    })
    if (ring.current) {
      ring.current.position.set(x, 0.08, z)
      ring.current.visible = !l.shot
      const c = l.crocs[l.open]
      const near = c && Math.hypot(x - c.home[0], z - (c.home[1] + 1.6)) < 1.6
      mat.color.set(near ? '#69db7c' : l.holding !== null ? '#ffd43b' : '#ffffff')
    }
  })
  return (
    <group>
      {[...Array(8)].map((_, i) => (
        <mesh key={i} ref={(m) => void (dots.current[i] = m)} material={mat}>
          <boxGeometry args={[0.1, 0.1, 0.1]} />
        </mesh>
      ))}
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} material={mat}>
        <ringGeometry args={[0.55, 0.75, 20]} />
      </mesh>
    </group>
  )
}

/** The open crocodile's ripple: a ring spreading round it on the water. */
function Ripple({ live }: { live: { current: Live } }) {
  const m = useRef<THREE.Mesh>(null)
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#d0f4ff', transparent: true, opacity: 0.6 }), [])
  useFrame(() => {
    const l = live.current
    const c = l.crocs[l.open]
    if (!m.current || !c) return
    const k = (l.t * 0.8) % 1
    m.current.position.set(c.home[0], 0.06, c.home[1] + 0.8)
    m.current.scale.setScalar(1 + k * 2.5)
    mat.opacity = 0.6 * (1 - k)
  })
  return (
    <mesh ref={m} rotation={[-Math.PI / 2, 0, 0]} material={mat}>
      <ringGeometry args={[1.0, 1.15, 24]} />
    </mesh>
  )
}

function Clock({ live, onTick }: { live: { current: Live }; onTick: (dt: number) => void }) {
  useFrame((_, dt0) => {
    const dt = Math.min(0.05, juice.dt(dt0))
    const l = live.current
    l.t += dt
    if (l.holding !== null) l.power = 0.5 - Math.cos((l.t - l.holding) * 3.2) * 0.5
    if (l.shot) l.shot.t += dt
    onTick(dt)
  })
  return null
}

/** The scene: the grass at the Sim's feet, the rail, the red bank, the lake, the palace's wall across. */
function Lakeside() {
  return (
    <group>
      <Box p={[0, -0.05, 5]} s={[16, 0.1, 5]} c="#5f9e48" />
      <Box p={[0, -0.05, 0.4]} s={[16, 0.1, 4.2]} c="#b5653a" />
      <Box p={[0, -0.08, -2.2]} s={[16, 0.1, 1.2]} c="#8a6a45" />
      <Box p={[0, -0.1, -12]} s={[40, 0.1, 18.5]} c="#3f7a72" />
      {[...Array(14)].map((_, i) => (
        <Box key={i} p={[-6.5 + i, 0.55, RAIL_Z]} s={[0.1, 1.1, 0.1]} c="#2f7a3a" />
      ))}
      <Box p={[0, 1.05, RAIL_Z]} s={[14, 0.08, 0.08]} c="#2f7a3a" />
      <Box p={[0, 0.55, RAIL_Z]} s={[14, 0.06, 0.06]} c="#2f7a3a" />
      {/* Across the lake: the palace's wall, its green cap, the trees over it */}
      <Box p={[0, 1.6, -21]} s={[40, 3.2, 0.6]} c="#efe3c8" />
      <Box p={[0, 3.3, -21]} s={[40.4, 0.3, 1]} c="#2f6b4a" />
      {[-14, -6, 3, 11, 17].map((x) => (
        <group key={x}>
          <Box p={[x, 3, -23]} s={[0.5, 6, 0.5]} c="#7d6248" />
          <Box p={[x, 6.4, -23]} s={[5, 2, 5]} c="#2f7a35" />
        </group>
      ))}
      {/* Sky */}
      <Box p={[0, 6, -30]} s={[60, 20, 0.2]} c="#f6c58a" />
    </group>
  )
}

export function CaimansDefi({ onEnd }: { onEnd: (score: number) => void }) {
  const homes = useMemo<[number, number][]>(() => [[-4.2, -5.5], [-1.6, -9], [1.2, -6.5], [3.8, -10.5], [0, -12.5]], [])
  const live = useRef<Live>({ t: 0, aim: 0, power: 0.5, holding: null, shot: null, open: 2, since: 0, crocs: homes.map((h) => ({ home: h, open: 0, lunge: 0, climb: 0 })) })
  const animals = useMemo<Animal[]>(
    () => homes.map(([x, z], i) => ({ x, z: z - 1, y: -0.42, h: Math.PI / 2, gait: 0, graze: 0, phase: i, jaw: 0, mode: 'swim', t: 0, tx: x, tz: z, scale: 0.75 + (i % 3) * 0.12, seed: 7 + i * 13, ox: i, oz: 0 })),
    [homes],
  )
  const brain = useMemo(() => crocsBrain(live), [])
  const [left, setLeft] = useState(CHICKENS)
  const [fed, setFed] = useState(0)
  const [said, setSaid] = useState<string | null>(null)
  const [pose, setPose] = useState<Pose>('idle')
  const st = useRef({ left: CHICKENS, points: 0, fed: 0, done: false, streak: 0 })
  const say = (s: string) => {
    setSaid(s)
    setTimeout(() => setSaid((v) => (v === s ? null : v)), 1400)
  }
  const nextOpen = () => {
    const l = live.current
    let n = l.open
    while (n === l.open) n = Math.floor(Math.random() * l.crocs.length)
    l.open = n
    l.since = l.t
  }
  const finish = () => {
    if (st.current.done) return
    st.current.done = true
    const score = Math.round(Math.min(100, (st.current.points / (CHICKENS * 1.5)) * 100))
    juice.finish(score, st.current.fed ? tr('{0} poulets happés sur {1}', { 0: st.current.fed, 1: CHICKENS }) : tr('Pas un seul poulet happé…'), onEnd)
  }
  const tick = () => {
    const l = live.current
    if (st.current.done) return
    // The jaws close if nobody throws; another one comes up.
    if (!l.shot && l.t - l.since > OPEN_FOR) nextOpen()
    if (l.shot && l.shot.t >= FLIGHT) {
      const [x, z] = l.shot.to
      l.shot = null
      const c = l.crocs[l.open]
      const head: [number, number] = [c.home[0], c.home[1] + 1.6]
      const far = HAND[2] - z
      if (Math.hypot(x - head[0], z - head[1]) < 1.6) {
        // Snapped up: the crocodile lunges, the water bursts; from far, more.
        c.lunge = 0.6
        const pts = far > 11 ? 2 : far > 8 ? 1.5 : 1
        st.current.points += pts
        st.current.fed++
        st.current.streak++
        setFed(st.current.fed)
        juice.good({ at: [x, 0.6, z], text: far > 11 ? tr('De très loin !') : far > 8 ? tr('De loin !') : tr('Happé !'), perfect: far > 11, colors: ['#ffffff', '#9fd8ef', '#d62f2f'], n: 16 })
        snd.splash()
        haptic('success')
        setPose('cheer')
        nextOpen()
      } else if (z > -2) {
        // Short, on the bank: one climbs out toward the rail; the keeper whistles, a step back.
        const near = l.crocs.reduce((b, cc, i) => (Math.hypot(cc.home[0] - x, cc.home[1] - z) < Math.hypot(l.crocs[b].home[0] - x, l.crocs[b].home[1] - z) ? i : b), 0)
        l.crocs[near].climb = 2.2
        st.current.points = Math.max(0, st.current.points - 0.5)
        st.current.streak = 0
        juice.bad({ at: [x, 0.5, z], text: tr('Trop court ! Recule !') })
        haptic('error')
        setPose('flinch')
        say(tr('Le gardien siffle : « Derrière la barrière ! »'))
      } else {
        st.current.streak = 0
        juice.bad({ at: [x, 0.4, z], text: tr('Plouf ! À côté'), soft: true })
        snd.splash()
        setPose('despair')
      }
      setTimeout(() => setPose('idle'), 900)
      if (st.current.left <= 0) setTimeout(finish, 900)
    }
  }
  const press = () => {
    const l = live.current
    if (st.current.done || l.shot || st.current.left <= 0 || l.holding !== null) return
    l.holding = l.t
    setPose('raise')
    haptic('light')
  }
  const release = (force?: number) => {
    const l = live.current
    if (l.holding === null) return
    l.holding = null
    if (typeof force === 'number') l.power = force
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
      if (e.key === 'ArrowLeft') (e.preventDefault(), (l.aim = Math.max(-0.7, l.aim - 0.06)))
      if (e.key === 'ArrowRight') (e.preventDefault(), (l.aim = Math.min(0.7, l.aim + 0.06)))
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === 'Enter') (e.preventDefault(), release())
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => (window.removeEventListener('keydown', down), window.removeEventListener('keyup', up))
  })
  const aimAt = (x: number, z: number) => {
    live.current.aim = Math.max(-0.7, Math.min(0.7, Math.atan2(x - HAND[0], HAND[2] - z)))
  }
  if (import.meta.env.DEV) Object.assign(globalThis, { __caimans: { live: live.current, press, release } })
  return (
    <JeuShell
      title={tr('Nourrir les caïmans sacrés')}
      how={tr('Pose le doigt sur le lac : la force monte et descend ; glisse pour viser le caïman qui ouvre la gueule, lâche au bon moment. Trop court, il sort vers toi !')}
      goal={tr('Dans la gueule, de loin !')}
      status={tr('{0} poulets · {1} happés', { 0: left, 1: fed })}
      said={said}
      tall
      controls={
        <button className="btn flex-1 touch-none !py-4 text-[17px] select-none" disabled={left <= 0} onPointerDown={(e) => (e.preventDefault(), press())} onPointerUp={() => release()} onPointerLeave={() => release()}>
          {tr('Tenir et lâcher')}
        </button>
      }
    >
      <div className="absolute inset-0 touch-none overflow-hidden rounded-3xl bg-[#f6c58a]">
        <Stage decor="ciel" cam={[0, 4.4, 8.6]} look={[0, 0, -5]} fov={50}>
          <Lakeside />
          <Herd species={CROCODILE} animals={animals} brain={brain} far={80} />
          <Ripple live={live} />
          {/* The surface the finger aims on, unseen */}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.02, -6]}
            onPointerDown={(e) => (aimAt(e.point.x, e.point.z), press())}
            onPointerMove={(e) => aimAt(e.point.x, e.point.z)}
            onPointerUp={() => release()}
            onPointerLeave={() => release()}
          >
            <planeGeometry args={[30, 24]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
          <AimArc live={live} />
          <Chicken live={live} />
          <MySim pose={pose} p={[0, 0, 3.4]} r={Math.PI} scale={0.9} hold={pose === 'raise' ? <Box p={[0, 0, 0]} s={[0.3, 0.22, 0.2]} c="#f6f1e6" /> : undefined} />
          <Clock live={live} onTick={tick} />
        </Stage>
      </div>
    </JeuShell>
  )
}
