import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { haptic } from '../../lib/native'
import { ambience } from '../../audio/ambience'
import { Box } from '../../world3d/props'
import { Bat } from '../../world3d/bats'
import { JeuShell, Stage } from './jeux/Shell'
import { MySim } from './jeux/me'
import type { Pose } from '../../avatar/Human'
import { t as tr, tx } from '../../lib/i18n'

// « Faire fuir les chauves-souris » (the update « plateau-vivant », backend game.Bats): a weekend's
// daytime under the Plateau's big trees, the colony of fruit bats hanging in the branches. The Sim has
// a lance-pierre and a bag of clay pellets: the aim drifts over the trees (or follows the finger),
// « Tirer ! » lets go; a pellet in the branches of a tree makes its bats scatter, screeching, and fly
// off over the towers: the tree is clear. Nobody's hurt, they go elsewhere. The score: the trees
// cleared before the time is up (or the bag empty).

const TREES = 5
const PELLETS = 9
const TIME = 35 // seconds
const XS = [-3.2, -1.6, 0, 1.6, 3.2]
const TZ = -3.4 // the trees' line
const CANOPY = 2.95 // the canopy's middle
const AIM_Z = TZ + 0.6 // the aim's plane, just in front of the branches
const HAND: [number, number, number] = [0.25, 1.35, 1.75]

type Live = {
  aim: THREE.Vector2
  /** When the finger last moved it (s): after a while, it drifts again. */
  touched: number
  t: number
  /** The pellet in the air: from the hand to where it was aimed, and whether it hits (the tree), or null. */
  shot: { to: THREE.Vector3; t: number; tree: number | null } | null
  /** Each tree: its bats there, or flying off since. */
  fled: (number | null)[]
}

/** The tree the aim is on, if any (its canopy, and the bats hanging under it). */
const treeAt = (x: number, y: number) => {
  const i = XS.findIndex((tx0) => Math.abs(x - tx0) < 0.62)
  return i >= 0 && y > CANOPY - 0.95 && y < CANOPY + 0.7 ? i : null
}

/** One tree of the Plateau: the trunk, its big canopy in two blocks, its bats (hanging, or scattering). */
function Tree({ i, live }: { i: number; live: { current: Live } }) {
  const x = XS[i]
  const bats = useMemo(() => [...Array(3 + (i % 2))].map((_, k) => ({ x: -0.45 + k * (0.9 / (2 + (i % 2))), y: CANOPY - 0.62 - (k % 2) * 0.1, beat: k * 1.3 + i })), [i])
  const groups = useRef<(THREE.Group | null)[]>([])
  const [state, setState] = useState<'hang' | 'alarm' | 'fly'>('hang')
  const shake = useRef<THREE.Group>(null)
  useFrame(() => {
    const l = live.current
    const since = l.fled[i]
    if (since === null) return
    const k = l.t - since
    if (k < 0.25 && state !== 'alarm') setState('alarm')
    if (k >= 0.25 && state !== 'fly') setState('fly')
    // The branches shaken by the pellet; the bats off up and away, each its own way, beating.
    if (shake.current) shake.current.rotation.z = Math.sin(k * 30) * 0.06 * Math.max(0, 1 - k * 2)
    groups.current.forEach((g, j) => {
      if (!g) return
      const f = Math.max(0, k - 0.25)
      const side = (j % 2 ? 1 : -1) * (0.6 + j * 0.3)
      // (Up over the canopy against the towers, a little towards the camera: seen going.)
      g.position.set(x + bats[j].x + side * f * 1.5 + Math.sin(f * 6 + j) * 0.15, bats[j].y - 0.2 * Math.min(1, f * 4) + f * 1.7 + f * f * 0.6, TZ + 0.1 + f * 0.6)
      g.rotation.set(0, side > 0 ? Math.PI * 0.5 : -Math.PI * 0.5, 0)
      g.visible = f < 3.5
    })
  })
  return (
    <group>
      <Box p={[x, 1.1, TZ]} s={[0.26, 2.2, 0.26]} c="#6b4a2a" />
      <Box p={[x - 0.14, 1.9, TZ]} s={[0.5, 0.1, 0.1]} c="#6b4a2a" />
      <group ref={shake} position={[x, CANOPY, TZ]}>
        <Box p={[0, 0, 0]} s={[1.3, 0.8, 1.2]} c={i % 2 ? '#2f7a34' : '#357f3a'} />
        <Box p={[0.08, 0.5, -0.05]} s={[0.95, 0.5, 0.9]} c="#3f8f43" />
      </group>
      {bats.map((b, j) => (
        <group key={j} ref={(g) => void (groups.current[j] = g)} position={[x + b.x, b.y, TZ + 0.1]}>
          <Bat state={state} beat={b.beat} scale={1.05} />
        </group>
      ))}
    </group>
  )
}

/** The reticle: four little bars round a point, glowing; red over a tree with bats, white elsewhere. */
function Aim({ live }: { live: { current: Live } }) {
  const g = useRef<THREE.Group>(null)
  const [on, setOn] = useState(false)
  useFrame(() => {
    const l = live.current
    if (!g.current) return
    g.current.position.set(l.aim.x, l.aim.y, AIM_Z)
    const i = treeAt(l.aim.x, l.aim.y)
    const over = i !== null && l.fled[i] === null
    if (over !== on) setOn(over)
  })
  const c = on ? '#ff3d57' : '#ffffff'
  return (
    <group ref={g}>
      <Box p={[-0.2, 0, 0]} s={[0.16, 0.035, 0.02]} c={c} glow={0.8} />
      <Box p={[0.2, 0, 0]} s={[0.16, 0.035, 0.02]} c={c} glow={0.8} />
      <Box p={[0, 0.2, 0]} s={[0.035, 0.16, 0.02]} c={c} glow={0.8} />
      <Box p={[0, -0.2, 0]} s={[0.035, 0.16, 0.02]} c={c} glow={0.8} />
      <Box p={[0, 0, 0]} s={[0.04, 0.04, 0.02]} c={c} glow={0.8} />
    </group>
  )
}

/** The clay pellet in the air, from the lance-pierre to where it was aimed. */
function Pellet({ live }: { live: { current: Live } }) {
  const g = useRef<THREE.Group>(null)
  const from = useMemo(() => new THREE.Vector3(...HAND), [])
  useFrame(() => {
    const s = live.current.shot
    if (!g.current) return
    g.current.visible = !!s
    if (!s) return
    const k = Math.min(1, s.t / 0.38)
    g.current.position.lerpVectors(from, s.to, k)
    g.current.position.y += Math.sin(Math.PI * k) * 0.35
  })
  return (
    <group ref={g} visible={false}>
      <Box p={[0, 0, 0]} s={[0.09, 0.09, 0.09]} c="#a0522d" />
    </group>
  )
}

/** The lance-pierre in the Sim's hand: the fork, its two prongs, the rubber band. */
function LancePierre() {
  return (
    <group rotation={[0, 0, 0]} scale={1.4}>
      <Box p={[0, -0.06, 0]} s={[0.03, 0.12, 0.03]} c="#7a5230" />
      <Box p={[-0.035, 0.03, 0]} s={[0.025, 0.08, 0.025]} c="#7a5230" />
      <Box p={[0.035, 0.03, 0]} s={[0.025, 0.08, 0.025]} c="#7a5230" />
      <Box p={[0, 0.06, 0.03]} s={[0.08, 0.012, 0.012]} c="#c92a2a" />
    </group>
  )
}

/** The game's clock and the aim's drift, inside the canvas. */
function Clock({ live, onTick }: { live: { current: Live }; onTick: (dt: number) => void }) {
  useFrame((_, dt0) => {
    const dt = Math.min(0.05, dt0)
    const l = live.current
    l.t += dt
    // Untouched for a moment, the aim drifts over the trees, like a hand not quite steady.
    if (l.t - l.touched > 1.2) {
      const t = l.t
      l.aim.x += (Math.sin(t * 0.9) * 3.3 + Math.sin(t * 2.3) * 0.4 - l.aim.x) * Math.min(1, dt * 2.5)
      l.aim.y += (CANOPY - 0.25 + Math.sin(t * 1.7) * 0.55 - l.aim.y) * Math.min(1, dt * 2.5)
    }
    if (l.shot) l.shot.t += dt
    onTick(dt)
  })
  return null
}

/** The towers of the Plateau behind the trees, and the sky. */
function Backdrop() {
  return (
    <group>
      <Box p={[0, 3.5, -9]} s={[30, 12, 0.2]} c="#9fd0f0" />
      {[
        [-5.2, 3.2, '#b9c7d6'],
        [-3.4, 5.2, '#8fa3b8'],
        [-1.2, 4.1, '#c7d3df'],
        [1.1, 6.4, '#7f95ab'],
        [3.2, 4.6, '#aebdcc'],
        [5.3, 3.6, '#9aaec2'],
      ].map(([x, h, c]) => (
        <group key={x as number}>
          <Box p={[x as number, (h as number) / 2, -8]} s={[1.6, h as number, 1]} c={c as string} />
          {[...Array(Math.floor((h as number) / 0.6))].map((_, k) => (
            <Box key={k} p={[x as number, 0.4 + k * 0.6, -7.48]} s={[1.3, 0.12, 0.02]} c="#dbe8f4" />
          ))}
        </group>
      ))}
    </group>
  )
}

export function ChauvesSourisDefi({ onEnd }: { onEnd: (score: number) => void }) {
  const live = useRef<Live>({ aim: new THREE.Vector2(0, CANOPY), touched: -9, t: 0, shot: null, fled: Array(TREES).fill(null) })
  const [left, setLeft] = useState(TIME)
  const [pellets, setPellets] = useState(PELLETS)
  const [cleared, setCleared] = useState(0)
  const [said, setSaid] = useState<string | null>(null)
  const [pose, setPose] = useState<Pose>('lookup')
  const done = useRef(false)
  const st = useRef({ pellets: PELLETS, cleared: 0, clock: TIME })
  const say = (s: string) => {
    setSaid(s)
    setTimeout(() => setSaid((v) => (v === s ? null : v)), 1300)
  }
  const finish = (why: string) => {
    if (done.current) return
    done.current = true
    say(why)
    const n = st.current.cleared
    setTimeout(() => onEnd(Math.max(10, Math.round((n / TREES) * 100))), 1300)
  }
  const tick = (dt: number) => {
    if (done.current) return
    const l = live.current
    st.current.clock -= dt
    const sec = Math.max(0, Math.ceil(st.current.clock))
    if (sec !== left) setLeft(sec)
    // The pellet gets there: in the branches of a tree with bats, they scatter.
    if (l.shot && l.shot.t >= 0.38) {
      const i = l.shot.tree
      l.shot = null
      if (i !== null && l.fled[i] === null) {
        l.fled[i] = l.t
        st.current.cleared++
        setCleared(st.current.cleared)
        haptic('success')
        ambience.bats(1)
        say(st.current.cleared === TREES ? tr('Plus une seule ! Tous les arbres sont dégagés !') : tr('Kiii ! Elles s’envolent !'))
        if (st.current.cleared === TREES) return finish(tr('Bravo !'))
      } else {
        haptic('error')
        say(i === null ? tr('Raté !') : tr('Celui-là est déjà dégagé !'))
      }
      if (st.current.pellets <= 0) return finish(tr('Le sac de boulettes est vide !'))
    }
    if (st.current.clock <= 0) finish(tr('Le temps est écoulé !'))
  }
  const shoot = () => {
    const l = live.current
    if (done.current || l.shot || st.current.pellets <= 0) return
    st.current.pellets--
    setPellets(st.current.pellets)
    haptic('medium')
    ambience.snap(1)
    setPose('throw')
    setTimeout(() => setPose('lookup'), 500)
    l.shot = { to: new THREE.Vector3(l.aim.x, l.aim.y, AIM_Z), t: 0, tree: treeAt(l.aim.x, l.aim.y) }
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const l = live.current
      if (e.code === 'Space' || e.key === 'Enter') return e.preventDefault(), shoot()
      const step = { ArrowLeft: [-0.25, 0], ArrowRight: [0.25, 0], ArrowUp: [0, 0.2], ArrowDown: [0, -0.2] }[e.key]
      if (step) {
        e.preventDefault()
        l.aim.x = Math.max(-3.8, Math.min(3.8, l.aim.x + step[0]))
        l.aim.y = Math.max(1.6, Math.min(4, l.aim.y + step[1]))
        l.touched = l.t
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })
  // (For tests in the browser: the aim put on a tree.)
  if (import.meta.env.DEV) Object.assign(globalThis, { __bats: { aimAt: (i: number) => ((live.current.aim.set(XS[i], CANOPY - 0.3), (live.current.touched = live.current.t + 99))), shoot } })
  return (
    <JeuShell
      title={tr('Faire fuir les chauves-souris')}
      how={tr('Glisse le doigt pour viser les branches (ou laisse la visée flotter), « Tirer ! » lâche la boulette : les chauves-souris s’envolent en criant.')}
      status={tx('{0}/{1} arbres dégagés · {2} boulettes · {3} s', { 0: cleared, 1: TREES, 2: pellets, 3: left })}
      said={said}
      controls={
        <button className="btn flex-1 touch-none !py-4 text-[17px] select-none" disabled={pellets <= 0} onPointerDown={(e) => (e.preventDefault(), shoot())}>
          {tr('Tirer !')}
        </button>
      }
    >
      <div className="absolute inset-0 touch-none overflow-hidden rounded-3xl">
        <Stage decor="herbe" cam={[0, 1.7, 5.6]} look={[0, 2.6, -3]} fov={52}>
          <Backdrop />
          {XS.map((_, i) => (
            <Tree key={i} i={i} live={live} />
          ))}
          {/* The plane the finger aims on, unseen */}
          <mesh
            position={[0, 2.8, AIM_Z]}
            onPointerMove={(e) => {
              const l = live.current
              l.aim.set(Math.max(-3.8, Math.min(3.8, e.point.x)), Math.max(1.6, Math.min(4, e.point.y)))
              l.touched = l.t
            }}
            onPointerDown={(e) => {
              const l = live.current
              l.aim.set(Math.max(-3.8, Math.min(3.8, e.point.x)), Math.max(1.6, Math.min(4, e.point.y)))
              l.touched = l.t
            }}
          >
            <planeGeometry args={[9, 4]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
          <Aim live={live} />
          <Pellet live={live} />
          <MySim pose={pose} p={[0, 0, 2]} r={Math.PI} scale={0.9} hold={<LancePierre />} />
          <Clock live={live} onTick={tick} />
        </Stage>
      </div>
    </JeuShell>
  )
}
