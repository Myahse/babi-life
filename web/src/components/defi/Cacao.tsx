import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { haptic } from '../../lib/native'
import { Blocks } from '../../world3d/open/ruePrincesse'
import type { At } from '../../world3d/open/shoreline'
import { LowHuman } from '../../avatar/LowHuman'
import { NoShadows, type Pose } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import { rng } from '../../world3d/themes'
import { JeuShell, Stage } from './jeux/Shell'
import { MySim } from './jeux/me'
import { juice, snd } from './jeux/juice'
import { t as tr } from '../../lib/i18n'

// « Une journée de récolte avec les planteurs » (the update « daloa-vivant », backend game/villes3.go CocoaDay):
// in the cocoa belt round Daloa, under the shade of the banana trees and the big forest trees left standing.
// Two times of the day, as the planters do them:
// - the harvest: the pods grow straight out of the trunk and the big branches; green they're not ready, yellow
//   or orange they are, left too long they blacken. Tap the ripe ones (the hook cuts them, they drop in the
//   basket), never the green, and don't let them rot;
// - the écabossage: on the log, each pod split with the machete where its ridge is. The blade's mark runs
//   along the pod: strike when it's in the middle, the pod opens clean, the beans in their white pulp
//   untouched; off the middle, the blade cuts beans.
// The score: half the harvest (ripe ones cut, minus the green cut and the rotten), half the écabossage.

const HARVEST_TIME = 32
const PODS_GOAL = 12
const SPLITS = 8
/** The pods' places on the tree (trunk and branches), the tree at x −1.2. */
const SLOTS: [number, number, number][] = [
  [-1.0, 0.9, 0.3],
  [-1.45, 1.25, 0.25],
  [-0.95, 1.7, 0.3],
  [-1.5, 2.0, 0.2],
  [-1.05, 2.45, 0.28],
  [-0.4, 2.55, 0.25],
  [0.05, 2.9, 0.2],
  [-1.9, 2.7, 0.2],
  [-2.35, 3.0, 0.15],
  [-1.25, 3.2, 0.25],
]
const GREEN = new THREE.Color('#5c9e31')
const YELLOW = new THREE.Color('#e8b81a')
const ORANGE = new THREE.Color('#e0701a')
const BLACK = new THREE.Color('#2b2118')
/** A pod's life: empty, then growing green, then ripe (yellow, then orange), then rotting black. */
type Pod = { at: number; green: number; ripe: number; rot: number; state: 'empty' | 'green' | 'ripe' | 'rot' | 'cut'; t: number }

const newPod = (r: () => number, wait: number): Pod => ({ at: wait, green: 1.4 + r() * 1.8, ripe: 3.4 + r() * 1.2, rot: 1.2, state: 'empty', t: 0 })

/** The plantation: the ground of dead leaves, the cocoa trees behind, the banana trees for shade, the log, the claie. */
function Plantation() {
  const at = useMemo(() => {
    const out: At[] = []
    const r = rng('cacao-plantation')
    out.push({ p: [0, -0.05, 0], s: [30, 0.1, 30], c: '#6b4a2a' })
    for (let i = 0; i < 40; i++) out.push({ p: [(r() - 0.5) * 12, 0.02, (r() - 0.5) * 8], s: [0.4, 0.03, 0.25], ry: r() * 3, c: ['#8a5a2a', '#a0703a', '#5e3e1e'][i % 3] })
    // The near tree: its trunk forking low, its branches, its big leaves.
    out.push({ p: [-1.2, 1.4, 0], s: [0.32, 2.8, 0.32], c: '#6e5640' }, { p: [-0.55, 2.6, 0], s: [0.2, 1.5, 0.2], ry: 0, c: '#6e5640' }, { p: [-2.0, 2.6, 0], s: [0.2, 1.4, 0.2], c: '#6e5640' })
    for (let i = 0; i < 14; i++) out.push({ p: [-1.2 + (r() - 0.5) * 3.2, 3.4 + r() * 1.2, (r() - 0.5) * 1.6], s: [0.9, 0.08, 0.4], ry: r() * 3, c: i % 2 ? '#2f6a30' : '#3c7a36' })
    // The trees behind in rows, and the banana trees over them.
    for (let i = 0; i < 9; i++) {
      const x = -6 + i * 1.6 + r() * 0.4
      const z = -3 - (i % 3) * 1.6
      out.push({ p: [x, 1.2, z], s: [0.24, 2.4, 0.24], c: '#6e5640' }, { p: [x, 2.8, z], s: [1.8, 1.2, 1.4], ry: r(), c: ['#2f6a30', '#3c7a36', '#28592a'][i % 3] })
      if (i % 2) out.push({ p: [x + 0.15, 1.3, z + 0.2], s: [0.16, 0.34, 0.16], c: '#e8b81a' })
    }
    for (const [x, z] of [
      [-4.5, -1.2],
      [3.6, -2.4],
      [5.6, -0.6],
    ]) {
      out.push({ p: [x, 1.8, z], s: [0.3, 3.6, 0.3], c: '#7d8f4a' })
      for (let k = 0; k < 5; k++) out.push({ p: [x + Math.cos(k * 1.25) * 0.9, 3.8, z + Math.sin(k * 1.25) * 0.9], s: [2, 0.06, 0.5], ry: -k * 1.25, c: '#5c9e31' })
    }
    // The basket by the tree, the log for the écabossage, the pile of empty husks, the beans on the banana leaves.
    out.push({ p: [-0.1, 0.25, 1.1], s: [0.8, 0.5, 0.8], c: '#a0703a' }, { p: [-0.1, 0.52, 1.1], s: [0.86, 0.06, 0.86], c: '#7a5228' })
    out.push({ p: [2.2, 0.3, 1.4], s: [1.8, 0.6, 0.6], c: '#7d6a55' }, { p: [2.2, 0.62, 1.4], s: [1.7, 0.04, 0.5], c: '#a08a70' })
    for (let i = 0; i < 9; i++) out.push({ p: [3.4 + (r() - 0.5) * 0.8, 0.12 + (i % 3) * 0.1, 0.4 + (r() - 0.5) * 0.8], s: [0.24, 0.12, 0.4], ry: r() * 3, c: i % 2 ? '#d07a1a' : '#a8601a' })
    out.push({ p: [1.2, 0.04, 2.8], s: [1.6, 0.04, 1], c: '#4f8a3a' })
    for (let i = 0; i < 12; i++) out.push({ p: [0.7 + (i % 4) * 0.3, 0.1, 2.5 + Math.floor(i / 4) * 0.25], s: [0.18, 0.1, 0.18], c: '#f2ead6' })
    return out
  }, [])
  const mat = useMemo(() => new THREE.MeshLambertMaterial({ color: '#ffffff' }), [])
  return <Blocks at={at} material={mat} color />
}

/** The pods on the tree, each its own colour as it ripens; a tap cuts it. */
function Pods({ pods, onTap }: { pods: { current: Pod[] }; onTap: (i: number) => void }) {
  const refs = useRef<(THREE.Group | null)[]>([])
  const mats = useMemo(() => SLOTS.map(() => new THREE.MeshLambertMaterial({ color: GREEN })), [])
  const box = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  const c = useMemo(() => new THREE.Color(), [])
  useFrame(() => {
    pods.current.forEach((p, i) => {
      const g = refs.current[i]
      if (!g) return
      g.visible = p.state !== 'empty' && p.state !== 'cut'
      if (!g.visible) return
      if (p.state === 'green') {
        const k = Math.min(1, p.t / 0.5)
        g.scale.setScalar(0.4 + 0.6 * k)
        mats[i].color.copy(GREEN)
      } else if (p.state === 'ripe') {
        g.scale.setScalar(1)
        mats[i].color.copy(c.copy(YELLOW).lerp(ORANGE, Math.min(1, p.t / p.ripe)))
      } else {
        mats[i].color.copy(c.copy(ORANGE).lerp(BLACK, Math.min(1, p.t / p.rot)))
        g.position.y = SLOTS[i][1] - Math.max(0, p.t - p.rot * 0.7) * 2
      }
      if (p.state !== 'rot') g.position.y = SLOTS[i][1]
    })
  })
  return (
    <group>
      {SLOTS.map((s, i) => (
        <group key={i} ref={(g) => void (refs.current[i] = g)} position={s} onPointerDown={(e) => (e.stopPropagation(), onTap(i))}>
          <mesh geometry={box} material={mats[i]} scale={[0.26, 0.46, 0.26]} />
          <mesh geometry={box} material={mats[i]} scale={[0.16, 0.14, 0.16]} position={[0, -0.28, 0]} />
          {/* A bigger target than the pod, unseen: a thumb is wide */}
          <mesh scale={[0.6, 0.8, 0.5]}>
            <boxGeometry />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** The pod on the log, the blade's mark running along it, the two halves opening. */
function Split({ live }: { live: { current: { mark: number; open: number; on: boolean } } }) {
  const pod = useRef<THREE.Group>(null)
  const a = useRef<THREE.Mesh>(null)
  const b = useRef<THREE.Mesh>(null)
  const mark = useRef<THREE.Mesh>(null)
  const beans = useRef<THREE.Mesh>(null)
  const mats = useMemo(
    () => ({ pod: new THREE.MeshLambertMaterial({ color: '#e0901a' }), mark: new THREE.MeshBasicMaterial({ color: '#ffffff' }), zone: new THREE.MeshBasicMaterial({ color: '#69db7c', transparent: true, opacity: 0.55 }), beans: new THREE.MeshLambertMaterial({ color: '#f2ead6' }) }),
    [],
  )
  useFrame(() => {
    const l = live.current
    if (pod.current) pod.current.visible = l.on
    if (a.current && b.current) {
      a.current.position.z = -0.14 * l.open
      a.current.rotation.x = -0.9 * l.open
      b.current.position.z = 0.14 * l.open
      b.current.rotation.x = 0.9 * l.open
    }
    if (mark.current) ((mark.current.position.x = l.mark * 0.5), (mark.current.visible = l.open === 0))
    if (beans.current) beans.current.visible = l.open > 0.2
  })
  return (
    <group ref={pod} position={[2.2, 0.82, 1.4]}>
      <mesh ref={a} material={mats.pod} scale={[1, 0.3, 0.16]} position={[0, 0, -0.08]}>
        <boxGeometry />
      </mesh>
      <mesh ref={b} material={mats.pod} scale={[1, 0.3, 0.16]} position={[0, 0, 0.08]}>
        <boxGeometry />
      </mesh>
      <mesh ref={beans} material={mats.beans} scale={[0.8, 0.2, 0.2]} position={[0, 0.02, 0]} visible={false}>
        <boxGeometry />
      </mesh>
      {/* The ridge to strike: the middle, in green; the blade's mark sliding along */}
      <mesh material={mats.zone} scale={[0.16, 0.02, 0.34]} position={[0, 0.17, 0]}>
        <boxGeometry />
      </mesh>
      <mesh ref={mark} material={mats.mark} scale={[0.04, 0.5, 0.4]} position={[0, 0.3, 0]}>
        <boxGeometry />
      </mesh>
    </group>
  )
}

/** The camera glides from the tree to the log for the écabossage (eased, never cut). */
function CamTo({ split }: { split: boolean }) {
  const { camera } = useThree()
  const look = useRef(new THREE.Vector3(0.3, 1.8, 0))
  const pos = useMemo(() => new THREE.Vector3(), [])
  const aim = useMemo(() => new THREE.Vector3(), [])
  useFrame((_, dt) => {
    const k = Math.min(1, dt * 2.5)
    pos.set(...((split ? [2.3, 2.3, 4.4] : [0.2, 2.4, 8.4]) as [number, number, number]))
    aim.set(...((split ? [2.2, 0.8, 1.2] : [0.3, 1.8, 0]) as [number, number, number]))
    camera.position.lerp(pos, k)
    look.current.lerp(aim, k)
    camera.lookAt(look.current)
  })
  return null
}

function Loop({ onTick }: { onTick: (dt: number) => void }) {
  useFrame((_, dt0) => {
    const dt = Math.min(0.05, juice.dt(dt0))
    if (dt > 0) onTick(dt)
  })
  return null
}

export function CacaoDefi({ onEnd }: { onEnd: (score: number) => void }) {
  const r = useMemo(() => rng(`cacao-${Date.now() % 997}`), [])
  const pods = useRef<Pod[]>(SLOTS.map((_, i) => newPod(r, 1.5 + i * 0.4)))
  const split = useRef({ mark: -1, dir: 1, open: 0, on: false, speed: 1.4 })
  const st = useRef({ phase: 'harvest' as 'harvest' | 'split' | 'over', left: HARVEST_TIME, cut: 0, green: 0, rotten: 0, splits: 0, quality: 0, wait: 0 })
  const [hud, setHud] = useState({ phase: 'harvest', n: 0, left: HARVEST_TIME })
  const [said, setSaid] = useState<string | null>(null)
  const [pose, setPose] = useState<Pose>('pick')
  const say = (s: string) => {
    setSaid(s)
    setTimeout(() => setSaid((v) => (v === s ? null : v)), 1600)
  }
  const planters = useMemo(() => {
    const q = rng('cacao-planteurs')
    return [
      { look: randomLook('homme', q), gender: 'homme' as const, p: [3.4, 0, -0.6] as [number, number, number], ry: -0.6, pose: 'pick' as Pose },
      { look: { ...randomLook('femme', q), outfit: 'pagne', outfitColor: '#2f9e44' }, gender: 'femme' as const, p: [4.2, 0, -1.2] as [number, number, number], ry: -0.8, pose: 'busy' as Pose },
    ]
  }, [])
  const finish = () => {
    const s = st.current
    if (s.phase === 'over') return
    s.phase = 'over'
    const harvest = Math.max(0, Math.min(1, s.cut / PODS_GOAL) - s.green * 0.06 - s.rotten * 0.03)
    const score = 50 * harvest + 50 * (s.quality / SPLITS)
    juice.finish(score, tr('{0} cabosses cueillies, {1} écabossées', { 0: s.cut, 1: s.splits }), onEnd)
  }
  const toSplit = () => {
    const s = st.current
    s.phase = 'split'
    split.current.on = true
    split.current.open = 0
    split.current.mark = -1
    setPose('busy')
    setHud({ phase: 'split', n: 0, left: 0 })
    juice.say(tr('L’écabossage !'), [0.5, 0.35], '#ffd43b', true)
    say(tr('Le planteur : « Frappe sur le milieu, pas sur les fèves ! »'))
  }
  const tick = (dt: number) => {
    const s = st.current
    if (s.phase === 'harvest') {
      s.left -= dt
      if (Math.floor(s.left) !== Math.floor(s.left + dt)) setHud({ phase: 'harvest', n: s.cut, left: Math.max(0, Math.ceil(s.left)) })
      for (const p of pods.current) {
        p.t += dt
        if (p.state === 'empty' && p.t >= p.at) ((p.state = 'green'), (p.t = 0))
        else if (p.state === 'green' && p.t >= p.green) ((p.state = 'ripe'), (p.t = 0))
        else if (p.state === 'ripe' && p.t >= p.ripe) ((p.state = 'rot'), (p.t = 0))
        else if (p.state === 'rot' && p.t >= p.rot) {
          s.rotten++
          juice.bad({ text: tr('Pourrie… trop tard'), soft: true })
          Object.assign(p, newPod(r, 0.8 + r() * 1.6))
        } else if (p.state === 'cut' && p.t >= 0) Object.assign(p, newPod(r, 0.6 + r() * 1.8))
      }
      if (s.left <= 0 || s.cut >= PODS_GOAL) toSplit()
      return
    }
    if (s.phase !== 'split') return
    const l = split.current
    if (l.open > 0) {
      l.open = Math.min(1, l.open + dt * 4)
      s.wait -= dt
      if (s.wait <= 0) {
        if (s.splits >= SPLITS) return finish()
        l.open = 0
        l.mark = -1
        l.dir = 1
        l.speed = 1.4 + s.splits * 0.22
        setPose('busy')
      }
      return
    }
    l.mark += l.dir * l.speed * dt
    if (l.mark > 1) ((l.mark = 1), (l.dir = -1))
    if (l.mark < -1) ((l.mark = -1), (l.dir = 1))
  }
  const tapPod = (i: number) => {
    const s = st.current
    const p = pods.current[i]
    if (s.phase !== 'harvest') return
    const at: [number, number, number] = SLOTS[i]
    if (p.state === 'green') {
      s.green++
      juice.bad({ at, text: tr('Pas mûre !') })
      p.state = 'cut'
      p.t = -0.4
      return
    }
    if (p.state === 'ripe' || p.state === 'rot') {
      const perfect = p.state === 'ripe' && p.t > p.ripe * 0.35
      if (p.state === 'rot') s.rotten++
      else s.cut++
      if (p.state === 'ripe') juice.good({ at, text: perfect ? tr('Bien mûre !') : tr('Mûre'), perfect, colors: ['#e8b81a', '#e0701a', '#4f8a3a'] })
      else juice.bad({ at, text: tr('Noircie'), soft: true })
      snd.thud(0.4)
      setPose('throw')
      setTimeout(() => setPose('pick'), 260)
      p.state = 'cut'
      p.t = -0.2
      setHud({ phase: 'harvest', n: s.cut, left: Math.max(0, Math.ceil(s.left)) })
    }
  }
  const strike = () => {
    const s = st.current
    const l = split.current
    if (s.phase !== 'split' || l.open > 0) return
    const off = Math.abs(l.mark)
    const q = off < 0.16 ? 1 : off < 0.36 ? 0.65 : 0.25
    s.quality += q
    s.splits++
    l.open = 0.01
    s.wait = 0.75
    setPose('throw')
    const at: [number, number, number] = [2.2 + l.mark * 0.5, 1.0, 1.4]
    if (q === 1) juice.good({ at, text: tr('Ouverte net !'), perfect: true, colors: ['#f2ead6', '#e0901a', '#7a3b1a'], n: 14 })
    else if (q > 0.5) juice.good({ at, text: tr('Ouverte'), colors: ['#f2ead6', '#e0901a'] })
    else juice.bad({ at, text: tr('Des fèves coupées') })
    snd.thud(0.6)
    haptic(q === 1 ? 'success' : 'light')
    setHud({ phase: 'split', n: s.splits, left: 0 })
  }
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === 'Enter') (e.preventDefault(), strike())
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  })
  if (import.meta.env.DEV) Object.assign(globalThis, { __cacao: { pods: pods.current, st: st.current, split: split.current } })
  const harvest = hud.phase === 'harvest'
  return (
    <JeuShell
      title={tr('La récolte du cacao')}
      how={tr('Touche les cabosses jaunes ou orange : elles sont mûres. Jamais les vertes, et ne les laisse pas noircir. Puis, sur le bois, frappe quand la lame est au milieu de la cabosse.')}
      goal={tr('Cueille douze cabosses mûres !')}
      status={harvest ? tr('{0}/{1} cabosses · {2} s', { 0: hud.n, 1: PODS_GOAL, 2: hud.left }) : tr('{0}/{1} écabossées', { 0: hud.n, 1: SPLITS })}
      said={said}
      tall
      controls={
        harvest ? undefined : (
          <button className="btn flex-1 touch-none !py-4 text-[17px] select-none" onPointerDown={(e) => (e.preventDefault(), strike())}>
            {tr('Frapper')}
          </button>
        )
      }
    >
      <div className="absolute inset-0 touch-none overflow-hidden rounded-3xl bg-[linear-gradient(#a8c79a,#4f6f3a)]" onPointerDown={() => !harvest && strike()}>
        <Stage decor="ciel" cam={[0.2, 2.4, 8.4]} look={[0.3, 1.8, 0]} fov={46}>
          <Plantation />
          <Pods pods={pods} onTap={tapPod} />
          <Split live={split} />
          <MySim pose={pose} p={harvest ? [0.6, 0, 0.7] : [2.2, 0, 0.6]} r={harvest ? -Math.PI * 0.62 : 0} />
          <NoShadows>
            {planters.map((q, i) => (
              <group key={i} position={q.p} rotation={[0, q.ry, 0]}>
                <LowHuman look={q.look} gender={q.gender} pose={q.pose} seed={i * 5} />
              </group>
            ))}
          </NoShadows>
          <Loop onTick={tick} />
          <CamTo split={!harvest} />
        </Stage>
      </div>
    </JeuShell>
  )
}
