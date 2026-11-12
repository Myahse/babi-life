import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { haptic } from '../../lib/native'
import { Blocks } from '../../world3d/open/ruePrincesse'
import type { At } from '../../world3d/open/shoreline'
import { LowHuman } from '../../avatar/LowHuman'
import { NoShadows } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import { rng } from '../../world3d/themes'
import { JeuShell, Stage } from './jeux/Shell'
import { MySim } from './jeux/me'
import { juice, snd } from './jeux/juice'
import { t as tr } from '../../lib/i18n'

// « Une journée aux ponts de lianes de Lieupleu » (the update « man-vivant », backend game/villes3.go
// LianesTrip): near Danané, the bridges woven of lianas over the forest's river by the village's initiated,
// hung from two great trees, one bank to the other. The Sim crosses behind the guide: hold « Avancer » to
// walk; the bridge swings under the steps and the gusts (more in its middle), and the thumb leans the
// body the other way (drag left or right, or the arrows). Steady, the steps go on in rhythm; leaning the
// wrong way too long, the Sim slips and clings to the lianas. The score: across, few slips, not too slow.

const LEN = 34
const SAG = 2.2
const TIME = 75
const SPEED = 1.7
/** The deck's height along the bridge (z from 0 to −LEN), sagging in the middle. */
const deckY = (z: number) => -SAG * (1 - ((z + LEN / 2) / (LEN / 2)) ** 2)
/** The pivot the hanging deck swings about: the handrails' height at the anchors. */
const PIVOT = 1.2

type Live = { d: number; th: number; om: number; lean: number; walk: boolean; slip: number; danger: number; step: number; foot: number; gust: number; t: number }

/** The bridge itself, in its swinging frame (y from the pivot): the deck of lianas, the handrails, the netting. */
function bridgeParts(): At[] {
  const out: At[] = []
  const col = ['#6b5a2a', '#7a6a34', '#5e4e24']
  for (let i = 0; i < LEN / 0.5; i++) {
    const z = -0.25 - i * 0.5
    const y = deckY(z) - PIVOT
    // The deck: bundles of lianas across, a little uneven.
    out.push({ p: [0, y, z], s: [0.9 + (i % 3) * 0.05, 0.08, 0.42], ry: ((i % 5) - 2) * 0.03, c: col[i % 3] })
    // The handrails: thick twisted lianas either side.
    for (const x of [-0.75, 0.75]) out.push({ p: [x, y + 1.05, z], s: [0.08, 0.08, 0.52], c: '#4e4020' })
    // The netting: lianas from the handrail down to the deck's edge, every metre and a half.
    if (i % 3 === 0) for (const x of [-0.72, 0.72]) out.push({ p: [x, y + 0.52, z], s: [0.04, 1.05, 0.04], c: '#5e7a2a' })
    if (i % 3 === 1) for (const x of [-0.62, 0.62]) out.push({ p: [x, y + 0.5, z], s: [0.04, 1.1, 0.04], ry: 0, c: '#4c6a22' })
  }
  // Leaves still on the lianas here and there.
  for (let i = 0; i < 22; i++) out.push({ p: [i % 2 ? 0.8 : -0.8, deckY(-1 - i * 1.5) - PIVOT + 0.7 + (i % 3) * 0.2, -1 - i * 1.5], s: [0.2, 0.3, 0.3], c: i % 3 ? '#4f8a3a' : '#6aa84f' })
  return out
}

/** The gorge, the river, the two banks, the great anchor trees and the forest round. */
function forestParts(): At[] {
  const out: At[] = []
  const r = rng('lianes-foret')
  // The river far down, its rocks, its foam.
  out.push({ p: [0, -10, -LEN / 2], s: [80, 0.2, LEN + 4], c: '#3b6e6a' })
  for (let i = 0; i < 16; i++) out.push({ p: [(r() - 0.5) * 30, -9.7, -4 - r() * (LEN - 8)], s: [1 + r() * 2.4, 0.8 + r(), 1 + r() * 2], ry: r() * 3, c: i % 2 ? '#6d6a60' : '#59564c' })
  for (let i = 0; i < 10; i++) out.push({ p: [(r() - 0.5) * 24, -9.86, -6 - r() * (LEN - 12)], s: [1.6, 0.06, 0.4], ry: r() * 3, c: '#e8f4f0' })
  // The banks: earth and rock falling to the water, the paths to the bridge.
  for (const [z0, dir] of [
    [0, 1],
    [-LEN, -1],
  ] as const) {
    out.push({ p: [0, -5.2, z0 + dir * 5], s: [40, 10.4, 10], c: '#6b4a2a' })
    out.push({ p: [0, 0.02, z0 + dir * 5], s: [40, 0.06, 10], c: '#4f7a33' })
    out.push({ p: [0, 0.06, z0 + dir * 3], s: [1.4, 0.04, 6], c: '#8a6a45' })
    for (let k = 0; k < 6; k++) out.push({ p: [(r() - 0.5) * 30, -3 - r() * 5, z0 + dir * 0.3], s: [2 + r() * 3, 2 + r() * 3, 1.6], ry: r(), c: k % 2 ? '#7a776c' : '#5d5a50' })
    // The two great trees the bridge hangs from, their buttress roots, their crowns.
    for (const x of [-1.5, 1.5]) {
      out.push({ p: [x, 6, z0 + dir * 0.9], s: [1.1, 12, 1.1], c: '#7d6a55' })
      out.push({ p: [x * 1.5, 0.7, z0 + dir * 0.9], s: [0.5, 1.4, 1.8], c: '#6e5c48' })
      out.push({ p: [x, PIVOT + 0.2, z0 + dir * 0.3], s: [0.5, 0.5, 0.9], c: '#4e4020' })
      out.push({ p: [x * 1.2, 12.5, z0 + dir * 1.4], s: [6, 3, 6], c: '#2f6a30' })
      out.push({ p: [x * 1.6, 14.4, z0 + dir * 1.6], s: [4, 2, 4], c: '#3c7a36' })
    }
  }
  // The forest round: trunks and crowns on both banks, and over the gorge's sides.
  for (let i = 0; i < 44; i++) {
    const side = i % 2 ? 1 : -1
    const z = i < 22 ? 2 + r() * 14 : -LEN - 2 - r() * 14
    const x = side * (3 + r() * 16)
    const h = 6 + r() * 9
    out.push({ p: [x, h / 2, z], s: [0.5, h, 0.5], c: '#6e5c48' })
    out.push({ p: [x, h + 1, z], s: [3 + r() * 3, 2 + r() * 2, 3 + r() * 3], ry: r(), c: ['#2f6a30', '#3c7a36', '#4c8a3a', '#28592a'][i % 4] })
  }
  // The gorge's walls of forest, beyond the river either side.
  for (let i = 0; i < 18; i++) {
    const side = i % 2 ? 1 : -1
    const z = -2 - (i / 18) * (LEN - 4)
    out.push({ p: [side * (18 + r() * 6), -2 + r() * 3, z], s: [6, 14 + r() * 4, 4], c: ['#2f6a30', '#28592a', '#3c7a36'][i % 3] })
  }
  return out
}

/** The bridge swinging, the Sim on it with its lean, the guide ahead, the camera following. */
function Scene({ live }: { live: { current: Live } }) {
  const bridge = useRef<THREE.Group>(null)
  const me = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const guide = useRef<THREE.Group>(null)
  const { camera } = useThree()
  const mat = useMemo(() => new THREE.MeshLambertMaterial({ color: '#ffffff' }), [])
  const deck = useMemo(bridgeParts, [])
  const forest = useMemo(forestParts, [])
  const people = useMemo(() => {
    const r = rng('lianes-gens')
    return [
      { look: randomLook('homme', r), gender: 'homme' as const },
      { look: { ...randomLook('femme', r), outfit: 'pagne', outfitColor: '#e8590c' }, gender: 'femme' as const },
      { look: randomLook('homme', r), gender: 'homme' as const },
      { look: randomLook('femme', r), gender: 'femme' as const },
    ]
  }, [])
  const [pose, setPose] = useState<'walk' | 'idle' | 'stumble'>('idle')
  const poseRef = useRef(pose)
  const look = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    const l = live.current
    const z = -l.d
    const mid = Math.sin(Math.PI * Math.min(1, l.d / LEN))
    const tilt = l.th * (0.35 + 0.65 * mid)
    if (bridge.current) bridge.current.rotation.z = tilt
    if (me.current) me.current.position.set(0, deckY(z) - PIVOT, z)
    if (body.current) body.current.rotation.z = -l.lean * 0.32 + (l.slip > 0 ? Math.sin(l.t * 18) * 0.12 : 0)
    // The guide keeps four metres ahead, waiting at the far end.
    const gz = -Math.min(LEN + 2.5, l.d + 4)
    if (guide.current) guide.current.position.set(0, gz < -LEN ? deckY(-LEN) - PIVOT : deckY(gz) - PIVOT, gz)
    // The camera behind and a little above, swinging a little with the bridge (the stomach feels it).
    const cy = deckY(z) + 2.2
    camera.position.set(Math.sin(tilt) * 1.2, cy, z + 4.2)
    look.set(-Math.sin(tilt) * 0.6, deckY(z - 6) + 0.2, z - 7)
    camera.lookAt(look)
    const want = l.slip > 0 ? 'stumble' : l.walk ? 'walk' : 'idle'
    if (want !== poseRef.current) ((poseRef.current = want), setPose(want))
  })
  return (
    <group>
      <Blocks at={forest} material={mat} color />
      <group position={[0, PIVOT, 0]}>
        <group ref={bridge}>
          <Blocks at={deck} material={mat} color />
          <group ref={me}>
            <group ref={body}>
              <MySim pose={pose} r={Math.PI} scale={1} />
            </group>
          </group>
          <group ref={guide} rotation={[0, Math.PI, 0]}>
            <NoShadows>
              <LowHuman look={people[0].look} gender="homme" pose="walk" seed={3} />
            </NoShadows>
          </group>
        </group>
      </group>
      {/* The village waiting on the far bank */}
      <NoShadows>
        {people.slice(1).map((p, i) => (
          <group key={i} position={[-2 + i * 2, 0, -LEN - 4 - (i % 2)]}>
            <LowHuman look={p.look} gender={p.gender} pose={i === 1 ? 'wave' : 'idle'} seed={i * 7} />
          </group>
        ))}
      </NoShadows>
    </group>
  )
}

function Physics({ live, onTick }: { live: { current: Live }; onTick: (dt: number) => void }) {
  useFrame((_, dt0) => {
    const dt = Math.min(0.04, juice.dt(dt0))
    if (dt <= 0.0001) return
    const l = live.current
    l.t += dt
    // The deck swings like a pendulum under its handrails: its spring, its damping, the gusts, the steps.
    l.gust -= dt
    let push = 0
    if (l.gust <= 0) {
      l.gust = 2.2 + Math.random() * 2.4
      push = (Math.random() < 0.5 ? -1 : 1) * (0.9 + Math.random() * 0.9)
      snd.whoosh(0.25)
    }
    const speed = l.slip > 0 ? 0 : l.walk ? SPEED * (Math.abs(l.lean + l.th / 0.3) > 0.6 ? 0.55 : 1) : 0
    if (speed > 0) {
      l.step -= dt
      if (l.step <= 0) {
        l.step = 0.42
        l.foot = -l.foot
        push += l.foot * 0.55
      }
    }
    l.om += (-14 * l.th - 0.55 * l.om) * dt + push * 0.35
    l.th = Math.max(-0.5, Math.min(0.5, l.th + l.om * dt))
    // Clinging after a slip: the bridge calms a little, the Sim gets back up.
    if (l.slip > 0) {
      l.slip -= dt
      l.om *= 1 - dt * 2.5
    }
    l.d = Math.min(LEN + 0.5, l.d + speed * dt)
    onTick(dt)
  })
  return null
}

export function PontLianesDefi({ onEnd }: { onEnd: (score: number) => void }) {
  const live = useRef<Live>({ d: 0, th: 0, om: 0, lean: 0, walk: false, slip: 0, danger: 0, step: 0, foot: 1, gust: 2.5, t: 0 })
  const st = useRef({ over: false, left: TIME, slips: 0, steady: 0, lastStep: 1 })
  const [status, setStatus] = useState({ m: 0, left: TIME })
  const [said, setSaid] = useState<string | null>(null)
  const bar = useRef<HTMLDivElement>(null)
  const say = (s: string) => {
    setSaid(s)
    setTimeout(() => setSaid((v) => (v === s ? null : v)), 1600)
  }
  const finish = (across: boolean) => {
    const s = st.current
    if (s.over) return
    s.over = true
    live.current.walk = false
    const used = TIME - s.left
    const score = across ? 100 - s.slips * 15 - Math.max(0, used - 38) * 0.8 : (live.current.d / LEN) * 60 - s.slips * 8
    juice.finish(score, across ? (s.slips ? tr('De l’autre côté, {0} glissade(s)', { 0: s.slips }) : tr('Traversé sans une glissade !')) : tr('Le guide te ramène, doucement…'), onEnd)
  }
  const tick = (dt: number) => {
    const s = st.current
    const l = live.current
    if (s.over) return
    s.left -= dt
    if (Math.floor(s.left) !== Math.floor(s.left + dt)) setStatus({ m: Math.floor(l.d), left: Math.max(0, Math.ceil(s.left)) })
    if (s.left <= 0) return finish(false)
    if (l.d >= LEN) {
      juice.good({ at: [0, deckY(-LEN) + 1.5, -LEN], text: tr('De l’autre côté !'), perfect: s.slips === 0, colors: ['#4f8a3a', '#ffd43b', '#ffffff'], n: 16 })
      return finish(true)
    }
    // How far from balanced: the deck's tilt felt where the Sim is, against its lean.
    const mid = Math.sin(Math.PI * Math.min(1, l.d / LEN))
    const tilt = l.th * (0.35 + 0.65 * mid)
    const e = tilt / 0.3 + l.lean
    if (bar.current) {
      bar.current.style.left = `calc(${50 + Math.max(-1, Math.min(1, e)) * 46}% - 8px)`
      bar.current.style.background = Math.abs(e) < 0.35 ? '#40c057' : Math.abs(e) < 0.8 ? '#fab005' : '#fa5252'
    }
    if (l.slip > 0) return
    l.danger = Math.abs(e) > 0.9 ? l.danger + dt : Math.max(0, l.danger - dt * 2)
    if (l.danger > 0.55) {
      // Off balance too long: a slip, the hands on the lianas.
      l.danger = 0
      l.slip = 1.4
      s.slips++
      s.steady = 0
      juice.bad({ at: [0, deckY(-l.d) + 1.2, -l.d], text: tr('Accroche-toi aux lianes !') })
      haptic('error')
      say(tr('Le guide : « Doucement… penche-toi contre le pont. »'))
      return
    }
    // The steps taken steady, in rhythm with the bridge: a word now and then.
    if (l.walk && l.step > st.current.lastStep) {
      if (Math.abs(e) < 0.35) {
        s.steady++
        snd.thud(0.12)
        if (s.steady % 6 === 0) juice.good({ at: [0, deckY(-l.d) + 1.6, -l.d], text: tr('En rythme avec le pont') })
      } else s.steady = 0
    }
    st.current.lastStep = l.step
  }
  // The thumb: dragging leans (from where it touched), the button walks.
  const drag = useRef<number | null>(null)
  const onDown = (e: React.PointerEvent) => ((drag.current = e.clientX), (e.target as HTMLElement).setPointerCapture?.(e.pointerId))
  const onMove = (e: React.PointerEvent) => {
    if (drag.current == null) return
    live.current.lean = Math.max(-1, Math.min(1, (e.clientX - drag.current) / 90))
  }
  const onUp = () => {
    drag.current = null
  }
  useEffect(() => {
    const keys = new Set<string>()
    const apply = () => {
      const l = live.current
      l.walk = keys.has('ArrowUp') || keys.has('KeyW') || keys.has('Space') || walkHeld.current
      const dir = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0)
      if (drag.current == null) l.lean = dir * 0.8
    }
    const down = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyD', 'Space'].includes(e.code)) (e.preventDefault(), keys.add(e.code), apply())
    }
    const up = (e: KeyboardEvent) => (keys.delete(e.code), apply())
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => (window.removeEventListener('keydown', down), window.removeEventListener('keyup', up))
  }, [])
  const walkHeld = useRef(false)
  const hold = (on: boolean) => {
    walkHeld.current = on
    live.current.walk = on
    if (on) haptic('light')
  }
  if (import.meta.env.DEV) Object.assign(globalThis, { __lianes: { live: live.current, st: st.current } })
  return (
    <JeuShell
      title={tr('Le pont de lianes')}
      how={tr('Tiens « Avancer » pour marcher derrière le guide. Le pont se balance : glisse le doigt de l’autre côté pour te pencher contre lui, et garde la barre au vert.')}
      goal={tr('Traverse le pont de lianes !')}
      status={tr('{0} m sur {1} · {2} s', { 0: status.m, 1: LEN, 2: status.left })}
      said={said}
      tall
      controls={
        <button className="btn flex-1 touch-none !py-4 text-[17px] select-none" onPointerDown={(e) => (e.preventDefault(), hold(true))} onPointerUp={() => hold(false)} onPointerLeave={() => hold(false)} onPointerCancel={() => hold(false)}>
          {tr('Avancer')}
        </button>
      }
    >
      <div className="absolute inset-0 touch-none overflow-hidden rounded-3xl bg-[linear-gradient(#b9d7c9,#5f8f6a)]" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <Stage decor="ciel" cam={[0, 2.2, 4.2]} look={[0, 0, -7]} fov={62}>
          <fog attach="fog" args={['#b9d7c9', 18, 70]} />
          <Scene live={live} />
          <Physics live={live} onTick={tick} />
        </Stage>
        {/* The balance: the marker must stay in the green */}
        <div className="pointer-events-none absolute top-3 left-1/2 h-4 w-[70%] -translate-x-1/2 overflow-hidden rounded-full bg-black/35">
          <div className="absolute inset-y-0 left-1/2 w-[30%] -translate-x-1/2 bg-[#40c057]/35" />
          <div ref={bar} className="absolute top-0 h-4 w-4 rounded-full bg-[#40c057] shadow" style={{ left: 'calc(50% - 8px)' }} />
        </div>
      </div>
    </JeuShell>
  )
}
