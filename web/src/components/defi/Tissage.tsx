import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { haptic } from '../../lib/native'
import { Blocks } from '../../world3d/open/ruePrincesse'
import { JeuShell, Stage } from './jeux/Shell'
import { MySim } from './jeux/me'
import { juice, snd, tone, audio } from './jeux/juice'
import { t as tr } from '../../lib/i18n'

// « Tisser une bande de pagne » (the update « korhogo-vivant », backend game/villes2.go WeaveWaraniene): under
// a hangar of Waraniéné, at the narrow loom of the north. The warp runs far out in front along the ground to
// its drag-stone; the weaver sits behind the breast beam, the pedals under the toes. Each pick is three
// gestures, on the balafon's beat: the pedal (the heddles swap, the shed opens), the shuttle thrown
// through, the beater pulled to pack the thread. In order and on the beat, the strip grows, its indigo and
// white checks coming out; out of order, the thread snags. Twelve picks.

const PICKS = 12
const BEAT = 0.62
const STEPS = ['pedale', 'navette', 'tasser'] as const
type Step = (typeof STEPS)[number]
type Live = { t: number; shed: number; side: number; shuttle: number; beater: number; picks: number; next: number }

/** The loom, the warp out to its stone, the hangar's posts and its straw roof: in one draw. */
function Loom() {
  const at = useMemo(() => {
    type B = { p: [number, number, number]; s: [number, number, number]; ry?: number; c: string }
    const b: B[] = [
      { p: [0, -0.05, -3], s: [12, 0.1, 14], c: '#b9875a' },
      // The loom's four posts and its top beam, the pulley.
      { p: [-0.9, 1.3, 0.4], s: [0.12, 2.6, 0.12], c: '#6b4a2a' },
      { p: [0.9, 1.3, 0.4], s: [0.12, 2.6, 0.12], c: '#6b4a2a' },
      { p: [-0.9, 1.3, -1.2], s: [0.12, 2.6, 0.12], c: '#6b4a2a' },
      { p: [0.9, 1.3, -1.2], s: [0.12, 2.6, 0.12], c: '#6b4a2a' },
      { p: [0, 2.62, -0.4], s: [2, 0.12, 0.12], c: '#6b4a2a' },
      { p: [0, 2.45, -0.4], s: [0.16, 0.2, 0.16], c: '#3a2a1a' },
      // The breast beam in front of the weaver, the stool.
      { p: [0, 0.75, 0.9], s: [1.4, 0.1, 0.12], c: '#7a5230' },
      { p: [0, 0.25, 1.75], s: [0.6, 0.5, 0.5], c: '#5a3d22' },
      // The drag-stone far out, the warp's end tied to it; the hangar's posts and its straw roof.
      { p: [0, 0.2, -8.5], s: [0.8, 0.4, 0.6], c: '#7d7a72' },
      { p: [-3, 1.8, 2], s: [0.2, 3.6, 0.2], c: '#6b4a2a' },
      { p: [3, 1.8, 2], s: [0.2, 3.6, 0.2], c: '#6b4a2a' },
      { p: [-3, 1.8, -4], s: [0.2, 3.6, 0.2], c: '#6b4a2a' },
      { p: [3, 1.8, -4], s: [0.2, 3.6, 0.2], c: '#6b4a2a' },
      { p: [0, 3.7, -1], s: [7, 0.3, 7.5], c: '#c9a25a' },
      // The other looms of the hangar, their weavers' strips coiled on the ground.
      { p: [-2.4, 0.15, 0.8], s: [0.5, 0.3, 0.5], c: '#f1ece0' },
      { p: [2.4, 0.15, 0.6], s: [0.5, 0.3, 0.5], c: '#28407a' },
    ]
    // The warp: the threads running from the heddles out to the stone (white and indigo).
    for (let i = 0; i < 10; i++) b.push({ p: [-0.27 + i * 0.06, 0.78 - 0.29 * 0, -4.4], s: [0.015, 0.015, 8.4], c: i % 4 < 2 ? '#f4f1e6' : '#2a3f7a' })
    return b
  }, [])
  const mat = useMemo(() => new THREE.MeshLambertMaterial({ color: '#ffffff' }), [])
  return <Blocks at={at} material={mat} color />
}

/** The moving parts: the two heddles swapping, the shuttle across, the beater, the strip woven so far. */
function Moving({ live }: { live: { current: Live } }) {
  const h1 = useRef<THREE.Group>(null)
  const h2 = useRef<THREE.Group>(null)
  const shuttle = useRef<THREE.Mesh>(null)
  const beater = useRef<THREE.Mesh>(null)
  const strip = useRef<THREE.InstancedMesh>(null)
  const mats = useMemo(() => ({ wood: new THREE.MeshLambertMaterial({ color: '#8a5a32' }), thread: new THREE.MeshLambertMaterial({ color: '#e9e2cf' }), cloth: new THREE.MeshLambertMaterial({ color: '#ffffff' }) }), [])
  const box = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  useEffect(() => {
    const m = strip.current
    if (!m) return
    const o = new THREE.Object3D()
    const c = new THREE.Color()
    for (let i = 0; i < PICKS; i++) {
      for (let k = 0; k < 4; k++) {
        o.position.set(-0.225 + k * 0.15, 0.79, 0.82 - i * 0.07)
        o.scale.set(0.15, 0.02, 0.07)
        o.updateMatrix()
        m.setMatrixAt(i * 4 + k, o.matrix)
        // The checks: indigo and white swapping every three picks and every column.
        m.setColorAt(i * 4 + k, c.set((Math.floor(i / 3) + k) % 2 ? '#24386e' : '#f4f1e6'))
      }
    }
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.count = 0
  }, [])
  useFrame((_, dt0) => {
    const dt = Math.min(0.05, dt0)
    const l = live.current
    // The heddles: the open shed lifts one and drops the other.
    const s = l.shed * (l.side ? 1 : -1) * 0.14
    h1.current?.position.set(0, 1.55 + s, -0.4)
    h2.current?.position.set(0, 1.55 - s, -0.15)
    l.shed = Math.max(0, l.shed - dt * 0.6)
    if (shuttle.current) {
      shuttle.current.position.set((l.side ? 1 : -1) * (0.75 - l.shuttle * 1.5), 0.86, 0.15)
      shuttle.current.visible = true
    }
    if (beater.current) beater.current.position.set(0, 1.0, 0.25 + l.beater * 0.4)
    l.beater = Math.max(0, l.beater - dt * 4)
    if (strip.current) strip.current.count = l.picks * 4
  })
  return (
    <group>
      {[h1, h2].map((h, i) => (
        <group key={i} ref={h}>
          <mesh geometry={box} material={mats.wood} position={[0, 0.4, 0]} scale={[0.9, 0.05, 0.05]} />
          <mesh geometry={box} material={mats.wood} position={[0, -0.4, 0]} scale={[0.9, 0.05, 0.05]} />
          {[...Array(6)].map((_, k) => (
            <mesh key={k} geometry={box} material={mats.thread} position={[-0.3 + k * 0.12, 0, 0]} scale={[0.01, 0.8, 0.01]} />
          ))}
        </group>
      ))}
      <mesh ref={beater} geometry={box} material={mats.wood} scale={[0.9, 0.5, 0.06]} />
      <mesh ref={shuttle} geometry={box} material={mats.wood} scale={[0.36, 0.07, 0.1]} />
      <instancedMesh ref={strip} args={[box, mats.cloth, PICKS * 4]} />
    </group>
  )
}

function Clock({ live, onBeat }: { live: { current: Live }; onBeat: (k: number) => void }) {
  const last = useRef(-1)
  useFrame((_, dt0) => {
    const l = live.current
    l.t += Math.min(0.05, juice.dt(dt0))
    const k = Math.floor(l.t / BEAT)
    if (k !== last.current) {
      last.current = k
      onBeat(k)
    }
  })
  return null
}

/** The balafon's beat: a wooden knock, the first of each three higher. */
function knock(high: boolean) {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  tone(t, high ? 784 : 523, 0.12, 0.07, 'triangle')
  tone(t, high ? 1568 : 1046, 0.05, 0.025, 'sine')
}

export function TissageDefi({ onEnd }: { onEnd: (score: number) => void }) {
  const live = useRef<Live>({ t: 0, shed: 0, side: 0, shuttle: 0, beater: 0, picks: 0, next: 0 })
  const st = useRef({ points: 0, done: false, streak: 0, snags: 0, started: false })
  const [next, setNext] = useState<Step>('pedale')
  const [picks, setPicks] = useState(0)
  const [said, setSaid] = useState<string | null>(null)
  const [beat, setBeat] = useState(0)
  const say = (s: string) => {
    setSaid(s)
    setTimeout(() => setSaid((v) => (v === s ? null : v)), 1300)
  }
  const finish = () => {
    if (st.current.done) return
    st.current.done = true
    const score = Math.round(Math.max(0, Math.min(100, (st.current.points / (PICKS * 3)) * 100)))
    juice.finish(score, st.current.snags ? tr('{0} duites, {1} fils accrochés', { 0: live.current.picks, 1: st.current.snags }) : tr('{0} duites, pas un fil accroché !', { 0: live.current.picks }), onEnd)
  }
  // The weaving goes on for a while: once the time's out, it ends with what's woven.
  const onBeat = (k: number) => {
    setBeat(k)
    knock(k % 3 === 0)
    if (k > PICKS * 3 + 14) finish()
  }
  const act = (step: Step) => {
    const l = live.current
    const s = st.current
    if (s.done) return
    snd.tap()
    const want = STEPS[l.next]
    if (step !== want) {
      // Out of order: the thread snags.
      s.snags++
      s.streak = 0
      s.points -= 0.5
      juice.bad({ at: [0, 1, 0.3], text: step === 'navette' ? tr('Le fil accroche : la foule est fermée !') : step === 'tasser' ? tr('Rien à tasser !') : tr('Lance d’abord la navette !') })
      haptic('error')
      return
    }
    // On the beat: the nearer, the better.
    const off = Math.abs(l.t / BEAT - Math.round(l.t / BEAT)) * BEAT
    const q = off < 0.09 ? 1 : off < 0.19 ? 0.75 : 0.45
    s.points += q
    if (q === 1) s.streak++
    else s.streak = 0
    if (step === 'pedale') {
      l.side = 1 - l.side
      l.shed = 1
      snd.thud(0.7)
    } else if (step === 'navette') {
      l.shuttle = 0
      const t0 = performance.now()
      const run = () => {
        l.shuttle = Math.min(1, (performance.now() - t0) / 260)
        if (l.shuttle < 1) requestAnimationFrame(run)
      }
      requestAnimationFrame(run)
      snd.whoosh(0.3)
    } else {
      l.beater = 1
      l.picks++
      setPicks(l.picks)
      snd.thud(0.4)
    }
    if (q === 1) juice.good({ at: [0, 1.1, 0.4], text: s.streak > 4 ? tr('En rythme ! ×{0}', { 0: s.streak }) : tr('Parfait'), perfect: s.streak > 4, colors: ['#24386e', '#f4f1e6'], n: 6 })
    else juice.good({ at: [0, 1.1, 0.4], text: q > 0.6 ? tr('Bien') : tr('Hors du temps') })
    haptic(q === 1 ? 'medium' : 'light')
    l.next = (l.next + 1) % 3
    setNext(STEPS[l.next])
    if (l.picks >= PICKS) {
      say(tr('Le tisserand : « Ça, c’est une bande ! »'))
      setTimeout(finish, 800)
    } else if (l.picks === 6 && step === 'tasser') say(tr('La moitié de la bande !'))
  }
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.key === 'ArrowLeft' || e.key === '1') (e.preventDefault(), act('pedale'))
      if (e.key === 'ArrowUp' || e.key === '2' || e.code === 'Space') (e.preventDefault(), act('navette'))
      if (e.key === 'ArrowRight' || e.key === '3') (e.preventDefault(), act('tasser'))
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  })
  if (import.meta.env.DEV) Object.assign(globalThis, { __tissage: { live: live.current, act } })
  const label: Record<Step, string> = { pedale: tr('Pédale'), navette: tr('Navette'), tasser: tr('Tasser') }
  return (
    <JeuShell
      title={tr('Le métier de Waraniéné')}
      how={tr('Sur le temps du balafon : la pédale ouvre les fils, la navette passe, on tasse. Dans l’ordre et en rythme, la bande grandit.')}
      goal={tr('Tisse douze duites !')}
      status={tr('{0}/{1} duites', { 0: picks, 1: PICKS })}
      said={said}
      controls={
        <>
          {STEPS.map((s, i) => (
            <button
              key={s}
              className={`btn flex-1 touch-none !px-1 !py-4 text-[15px] select-none transition ${next === s ? 'ring-4 ring-[#ffd43b]' : 'opacity-75'} ${beat % 3 === i && next === s ? 'scale-[1.04]' : ''}`}
              onPointerDown={(e) => (e.preventDefault(), act(s))}
            >
              {label[s]}
            </button>
          ))}
        </>
      }
    >
      <div className="absolute inset-0 touch-none overflow-hidden rounded-3xl bg-[linear-gradient(#f6d9a8,#c98f5a)]">
        <Stage decor="ciel" cam={[2.2, 2.9, 3.6]} look={[0, 0.8, -0.6]} fov={46}>
          <Loom />
          <Moving live={live} />
          <MySim pose="type" p={[0, 0.1, 1.55]} r={Math.PI} scale={0.85} />
          <Clock live={live} onBeat={onBeat} />
        </Stage>
      </div>
    </JeuShell>
  )
}
