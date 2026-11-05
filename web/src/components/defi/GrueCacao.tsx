import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { haptic } from '../../lib/native'
import { Blocks } from '../../world3d/open/ruePrincesse'
import { JeuShell, Stage } from './jeux/Shell'
import { MySim } from './jeux/me'
import { juice, snd } from './jeux/juice'
import { t as tr } from '../../lib/i18n'

// « Charger le cacao à la grue » (the update « sanpedro-vivant », backend game/villes2.go GrueCacao): at the
// Port autonome de San-Pédro, the first cocoa port in the world. From the crane's cab, the sling of jute bags
// hangs under the trolley over the quay; the cargo's open hold waits alongside. Drag to run the trolley
// along the boom: the load swings behind it like a pendulum, and a little move back the other way calms it.
// Hold « Descendre » to lower the cable: in the hold's mouth, the sling goes down to the floor and the
// dockers below unhook it; against the coaming, it knocks (a bag torn, the load bounced back up). Six
// slings; the score is how cleanly each went in (centred, not swinging, never knocked).

const SLINGS = 6
const TIME = 80
const TOP = 10.8
const L_MIN = 2.6
const L_MAX = 12.4
const PILE_X = -5.2
/** The hold's mouth (x middle, half-width), the deck's height, the hold's floor. */
const HOLD_X = 6
const HOLD_HALF = 2.4
const DECK_Y = 2
const FLOOR_Y = -0.6
const HULL: [number, number] = [0.8, 13]
const LOAD_HALF = 0.85
const LOAD_H = 0.9

type Phase = 'carry' | 'down' | 'up' | 'back'
type Live = { t: number; x: number; v: number; target: number; L: number; th: number; om: number; lower: boolean; phase: Phase; hits: number; stacked: number; bump: number }

/** Where the load hangs now (its middle). */
const loadAt = (l: Live): [number, number] => [l.x + l.L * Math.sin(l.th), TOP - l.L * Math.cos(l.th) - LOAD_H / 2]

/** The quay, the water, the cargo ship and its hold, the crane's tower and boom, the bag stacks: in one draw. */
function Port() {
  const at = useMemo(() => {
    type B = { p: [number, number, number]; s: [number, number, number]; ry?: number; c: string }
    const b: B[] = [
      // The water, the quay's edge and top.
      { p: [6, -1.6, -2], s: [40, 0.2, 20], c: '#2d6f8f' },
      { p: [-6, -0.8, 0], s: [12, 1.6, 8], c: '#9a9a92' },
      { p: [-6, 0.02, 0], s: [12, 0.04, 8], c: '#b8b6aa' },
      { p: [-0.1, 0.1, 2], s: [0.3, 0.2, 0.3], c: '#2a2a2a' },
      { p: [-0.1, 0.1, -2], s: [0.3, 0.2, 0.3], c: '#2a2a2a' },
      // The hull: black over red, the deck, the hold's walls round its mouth (the mouth left open).
      { p: [(HULL[0] + HULL[1]) / 2, -1.2, 0], s: [HULL[1] - HULL[0], 1.4, 5.6], c: '#a23a2a' },
      { p: [(HULL[0] + HULL[1]) / 2, 0.6, 0], s: [HULL[1] - HULL[0], 2.2, 5.6], c: '#1d2733' },
      { p: [(HULL[0] + HOLD_X - HOLD_HALF) / 2, DECK_Y - 0.1, 0], s: [HOLD_X - HOLD_HALF - HULL[0], 0.2, 5.6], c: '#7a7f86' },
      { p: [(HOLD_X + HOLD_HALF + HULL[1]) / 2, DECK_Y - 0.1, 0], s: [HULL[1] - HOLD_X - HOLD_HALF, 0.2, 5.6], c: '#7a7f86' },
      { p: [HOLD_X - HOLD_HALF - 0.1, DECK_Y + 0.3, 0], s: [0.2, 0.6, 4], c: '#c9a227' },
      { p: [HOLD_X + HOLD_HALF + 0.1, DECK_Y + 0.3, 0], s: [0.2, 0.6, 4], c: '#c9a227' },
      { p: [HOLD_X, DECK_Y + 0.3, -2.1], s: [HOLD_HALF * 2 + 0.4, 0.6, 0.2], c: '#c9a227' },
      // The hold's dark inside and its floor.
      { p: [HOLD_X, (FLOOR_Y + DECK_Y) / 2, -1.9], s: [HOLD_HALF * 2, DECK_Y - FLOOR_Y, 0.1], c: '#14181e' },
      { p: [HOLD_X, FLOOR_Y - 0.05, 0], s: [HOLD_HALF * 2, 0.1, 3.8], c: '#2a2f36' },
      // The bridge at the stern, its windows, the funnel; containers forward.
      { p: [11.6, 4.2, 0], s: [2.4, 4.4, 4.6], c: '#f1f0ea' },
      { p: [11.6, 5.4, 2.32], s: [2.2, 0.5, 0.05], c: '#2b4a66' },
      { p: [11.8, 7.2, 0], s: [1, 1.8, 1.2], c: '#d9480f' },
      { p: [1.8, 2.6, 0], s: [1.6, 1.2, 2.6], c: '#1971c2' },
      { p: [1.8, 3.8, 0], s: [1.6, 1.2, 2.6], c: '#e8590c' },
      { p: [3.0, 2.6, 0], s: [0.8, 1.2, 2.6], c: '#2f9e44' },
      // The crane: its legs on the quay, the tower, the cab, the boom out over the ship, the counter-jib.
      { p: [-7.6, 2.6, 1.2], s: [0.4, 5.2, 0.4], c: '#f0b429' },
      { p: [-7.6, 2.6, -1.2], s: [0.4, 5.2, 0.4], c: '#f0b429' },
      { p: [-4.4, 2.6, 1.2], s: [0.4, 5.2, 0.4], c: '#f0b429' },
      { p: [-4.4, 2.6, -1.2], s: [0.4, 5.2, 0.4], c: '#f0b429' },
      { p: [-6, 5.4, 0], s: [3.8, 0.5, 3], c: '#e0a21a' },
      { p: [-6, 8.4, 0], s: [1.2, 5.6, 1.2], c: '#f0b429' },
      { p: [-4.9, 10.0, 0.9], s: [1.4, 1.2, 1.1], c: '#f4f1e6' },
      { p: [-4.2, 10.1, 0.9], s: [0.05, 0.7, 0.9], c: '#5c8fb3' },
      { p: [1.5, TOP + 0.5, 0], s: [20, 0.5, 0.6], c: '#f0b429' },
      { p: [-10, TOP + 0.5, 0], s: [3, 0.6, 0.8], c: '#f0b429' },
      { p: [-10.6, TOP - 0.2, 0], s: [1.4, 1, 1], c: '#6c6c6c' },
      { p: [-3, TOP + 2.4, 0], s: [0.2, 4.2, 0.2], c: '#f0b429', ry: 0 },
    ]
    // The cocoa on the quay: the jute bags stacked on their pallets, the next slings ready.
    for (let i = 0; i < 3; i++)
      for (let k = 0; k < 5; k++) for (let j = 0; j < 2; j++) b.push({ p: [-9.6 + k * 0.62 + (i % 2) * 0.2, 0.25 + i * 0.46, -2.6 + j * 0.8], s: [0.56, 0.42, 0.72], ry: (k % 2) * 0.1, c: ['#b08a56', '#a47f4c', '#bc9662'][(i + k + j) % 3] })
    return b
  }, [])
  const mat = useMemo(() => new THREE.MeshLambertMaterial({ color: '#ffffff' }), [])
  return <Blocks at={at} material={mat} color />
}

/** The trolley on the boom, the cable, the sling of bags under it (its bags), the ones already down in the hold. */
function Rigging({ live }: { live: { current: Live } }) {
  const trolley = useRef<THREE.Mesh>(null)
  const cable = useRef<THREE.Mesh>(null)
  const load = useRef<THREE.Group>(null)
  const stack = useRef<THREE.Group>(null)
  const mats = useMemo(() => ({ steel: new THREE.MeshLambertMaterial({ color: '#3a3a3a' }), jute: new THREE.MeshLambertMaterial({ color: '#b08a56' }), jute2: new THREE.MeshLambertMaterial({ color: '#9c7646' }), sling: new THREE.MeshLambertMaterial({ color: '#d9480f' }) }), [])
  const box = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  useFrame(() => {
    const l = live.current
    const [lx, ly] = loadAt(l)
    trolley.current?.position.set(l.x, TOP + 0.05, 0)
    if (cable.current) {
      const hx = lx
      const hy = ly + LOAD_H / 2
      cable.current.position.set((l.x + hx) / 2, (TOP + hy) / 2, 0)
      cable.current.scale.set(0.05, Math.hypot(hx - l.x, TOP - hy), 0.05)
      cable.current.rotation.z = l.th
    }
    if (load.current) {
      load.current.position.set(lx, ly, 0)
      load.current.rotation.z = l.th
      load.current.visible = l.phase === 'carry' || l.phase === 'down'
    }
    if (stack.current) stack.current.children.forEach((c, i) => (c.visible = i < l.stacked))
  })
  const bags = [...Array(6)].map((_, i) => [((i % 3) - 1) * 0.55, Math.floor(i / 3) * 0.42 - 0.2, 0] as const)
  return (
    <group>
      <mesh ref={trolley} geometry={box} material={mats.steel} scale={[0.9, 0.35, 0.8]} />
      <mesh ref={cable} geometry={box} material={mats.steel} />
      <group ref={load}>
        {bags.map(([x, y], i) => (
          <mesh key={i} geometry={box} material={i % 2 ? mats.jute2 : mats.jute} position={[x, y, 0]} scale={[0.52, 0.4, 0.7]} />
        ))}
        <mesh geometry={box} material={mats.sling} position={[0, 0.42, 0]} scale={[0.06, 0.12, 0.72]} />
        <mesh geometry={box} material={mats.sling} position={[-0.6, 0.05, 0]} scale={[0.05, 0.8, 0.05]} rotation={[0, 0, -0.3]} />
        <mesh geometry={box} material={mats.sling} position={[0.6, 0.05, 0]} scale={[0.05, 0.8, 0.05]} rotation={[0, 0, 0.3]} />
      </group>
      <group ref={stack}>
        {[...Array(SLINGS)].map((_, i) => (
          <mesh key={i} geometry={box} material={i % 2 ? mats.jute2 : mats.jute} position={[HOLD_X - 1.2 + (i % 3) * 1.2, FLOOR_Y + 0.42 + Math.floor(i / 3) * 0.84, -0.4 + (i % 2) * 0.5]} scale={[1.1, 0.82, 1.4]} visible={false} />
        ))}
      </group>
    </group>
  )
}

function Physics({ live, onTick }: { live: { current: Live }; onTick: (dt: number) => void }) {
  useFrame((_, dt0) => {
    const dt = Math.min(0.04, juice.dt(dt0))
    // (Held still on a hit: nothing moves, and nothing is divided by it.)
    if (dt <= 0.0001) return
    const l = live.current
    l.t += dt
    // The trolley runs to where it's asked (its motor: a top speed, a quick ramp).
    const want = Math.max(-7.5, Math.min(11.5, l.phase === 'back' ? PILE_X : l.target))
    const v0 = l.v
    l.v += (Math.max(-3.6, Math.min(3.6, (want - l.x) * 2.2)) - l.v) * Math.min(1, dt * 3)
    l.x += l.v * dt
    const acc = (l.v - v0) / dt
    // The load swings like a pendulum under it, pushed by the trolley's starts and stops.
    // (The trolley's pull softened a little: a real sling's weight and its ropes' stretch.)
    const al = -(9.8 / l.L) * Math.sin(l.th) - ((acc * 0.6) / l.L) * Math.cos(l.th) - 0.42 * l.om
    l.om += al * dt
    l.th = Math.max(-0.9, Math.min(0.9, l.th + l.om * dt))
    l.bump = Math.max(0, l.bump - dt)
    if (l.phase === 'up' || l.phase === 'back') l.L = Math.max(L_MIN, l.L - 4 * dt)
    else if (l.lower) l.L = Math.min(L_MAX, l.L + 2.6 * dt)
    else if (l.phase === 'carry') l.L = Math.max(L_MIN, l.L - 1.2 * dt)
    // Over the quay, it rests on the ground (never through it).
    const [lx, ly] = loadAt(l)
    if (lx < HULL[0] - 0.4 && ly - LOAD_H / 2 < 0.05) l.L -= 0.05 - (ly - LOAD_H / 2)
    onTick(dt)
  })
  return null
}

export function GrueCacaoDefi({ onEnd }: { onEnd: (score: number) => void }) {
  const live = useRef<Live>({ t: 0, x: PILE_X, v: 0, target: PILE_X, L: L_MIN, th: 0, om: 0, lower: false, phase: 'carry', hits: 0, stacked: 0, bump: 0 })
  const st = useRef({ points: 0, done: 0, over: false, left: TIME, streak: 0 })
  const [status, setStatus] = useState({ done: 0, left: TIME })
  const [said, setSaid] = useState<string | null>(null)
  const say = (s: string) => {
    setSaid(s)
    setTimeout(() => setSaid((v) => (v === s ? null : v)), 1500)
  }
  const finish = () => {
    if (st.current.over) return
    st.current.over = true
    const score = Math.round(Math.min(100, (st.current.points / SLINGS) * 100))
    juice.finish(score, st.current.done ? tr('{0} élingues dans la cale sur {1}', { 0: st.current.done, 1: SLINGS }) : tr('Pas une élingue dans la cale…'), onEnd)
  }
  const tick = (dt: number) => {
    const s = st.current
    const l = live.current
    if (s.over) return
    s.left -= dt
    if (Math.floor(s.left) !== Math.floor(s.left + dt)) setStatus({ done: s.done, left: Math.max(0, Math.ceil(s.left)) })
    if (s.left <= 0) return finish()
    if (l.phase === 'up' && l.L <= L_MIN + 0.05) l.phase = 'back'
    if (l.phase === 'back' && Math.abs(l.x - PILE_X) < 0.15 && Math.abs(l.v) < 0.3) {
      // A new sling hooked from the pile.
      l.phase = 'carry'
      l.hits = 0
      snd.thud(0.3)
      say(tr('Élingue accrochée : en route pour la cale !'))
    }
    if (l.phase !== 'carry' && l.phase !== 'down') return
    const [lx, ly] = loadAt(l)
    const bottom = ly - LOAD_H / 2
    const overHull = lx + LOAD_HALF > HULL[0] && lx - LOAD_HALF < HULL[1]
    const inMouth = Math.abs(lx - HOLD_X) + LOAD_HALF < HOLD_HALF
    if (overHull && bottom < DECK_Y + 0.6 && bottom > DECK_Y - 0.6 && !inMouth && l.bump <= 0) {
      // Against the coaming or the deck: it knocks, bounces up, swings.
      l.hits++
      l.bump = 0.8
      l.L = Math.max(L_MIN, l.L - 1.2)
      l.om += (lx < HOLD_X ? -1 : 1) * 0.9
      s.streak = 0
      juice.bad({ at: [lx, DECK_Y + 0.6, 0], text: tr('Le bord ! Un sac déchiré') })
      haptic('error')
      snd.thud(0.1)
      say(tr('Le chef de quai : « Doucement, doucement ! »'))
      return
    }
    if (!overHull && bottom < -1.4) {
      // Between the quay and the hull, into the water: the sling is lost.
      s.done++
      s.streak = 0
      l.phase = 'up'
      l.lower = false
      juice.bad({ at: [lx, -1.2, 0], text: tr('Plouf ! Le cacao à l’eau') })
      snd.splash()
      haptic('error')
      setStatus({ done: s.done, left: Math.max(0, Math.ceil(s.left)) })
      if (s.done >= SLINGS) setTimeout(finish, 900)
      return
    }
    if (inMouth && bottom < DECK_Y) l.phase = 'down'
    if (l.phase === 'down' && !inMouth && bottom < DECK_Y - 0.1) {
      // Swung into the hold's wall, down inside: back up a little.
      l.L -= 0.4
      l.om *= -0.5
    }
    if (l.phase === 'down' && bottom <= FLOOR_Y + 0.05 + Math.floor(l.stacked / 3) * 0.84) {
      // Down on the floor: unhooked. Centred and still, it's clean.
      const sway = Math.abs(l.th) + Math.abs(l.om) * 0.35
      const centre = Math.abs(lx - HOLD_X) / HOLD_HALF
      const q = Math.max(0.2, Math.min(1, 1.15 - sway * 1.6 - centre * 0.4) - l.hits * 0.25)
      s.points += q
      s.done++
      l.stacked++
      l.phase = 'up'
      l.lower = false
      if (q > 0.85) {
        s.streak++
        juice.good({ at: [lx, FLOOR_Y + 1, 0], text: tr('Pile dedans !'), perfect: true, colors: ['#b08a56', '#d9480f', '#f0b429'], n: 14 })
        haptic('success')
      } else {
        juice.good({ at: [lx, FLOOR_Y + 1, 0], text: q > 0.55 ? tr('Dans la cale') : tr('Ça passe, de justesse') })
        haptic('light')
      }
      snd.thud(0.5)
      setStatus({ done: s.done, left: Math.max(0, Math.ceil(s.left)) })
      if (s.done >= SLINGS) setTimeout(finish, 900)
      else say(tr('Les dockers décrochent : retour au quai.'))
    }
  }
  const setTarget = (x: number) => (live.current.target = x)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const l = live.current
      if (e.code === 'Space' || e.key === 'Enter' || e.key === 'ArrowDown') return e.preventDefault(), (l.lower = true)
      if (e.key === 'ArrowLeft') (e.preventDefault(), (l.target = Math.max(-7.5, l.x - 1.2)))
      if (e.key === 'ArrowRight') (e.preventDefault(), (l.target = Math.min(11.5, l.x + 1.2)))
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === 'Enter' || e.key === 'ArrowDown') (e.preventDefault(), (live.current.lower = false))
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => (window.removeEventListener('keydown', down), window.removeEventListener('keyup', up))
  })
  if (import.meta.env.DEV) Object.assign(globalThis, { __grue: { live: live.current, st: st.current } })
  return (
    <JeuShell
      title={tr('La grue du port')}
      how={tr('Glisse pour faire rouler le chariot : la charge se balance, un petit geste dans l’autre sens la calme. Tiens « Descendre » quand elle est au-dessus de la cale.')}
      goal={tr('Six élingues de cacao dans la cale !')}
      status={tr('{0}/{1} élingues · {2} s', { 0: status.done, 1: SLINGS, 2: status.left })}
      said={said}
      tall
      controls={
        <button
          className="btn flex-1 touch-none !py-4 text-[17px] select-none"
          onPointerDown={(e) => (e.preventDefault(), (live.current.lower = true), haptic('light'))}
          onPointerUp={() => (live.current.lower = false)}
          onPointerLeave={() => (live.current.lower = false)}
          onPointerCancel={() => (live.current.lower = false)}
        >
          {tr('Descendre')}
        </button>
      }
    >
      <div className="absolute inset-0 touch-none overflow-hidden rounded-3xl bg-[linear-gradient(#9fd0f0,#e9d6a8)]">
        <Stage decor="ciel" cam={[2.5, 6.2, 26]} look={[2.5, 4.6, 0]} fov={50}>
          <Port />
          <Rigging live={live} />
          <MySim pose="sit" p={[-4.9, 9.45, 0.9]} r={Math.PI / 2} scale={0.6} />
          {/* The surface the finger drives the trolley on, unseen (a wall across the scene) */}
          <mesh position={[2, 5, 0.5]} onPointerDown={(e) => setTarget(e.point.x)} onPointerMove={(e) => e.buttons && setTarget(e.point.x)}>
            <planeGeometry args={[40, 20]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
          <Physics live={live} onTick={tick} />
        </Stage>
      </div>
    </JeuShell>
  )
}
