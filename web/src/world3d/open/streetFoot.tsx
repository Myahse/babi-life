import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Human, NoShadows, type Pose } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import { worldTime } from '../../lib/worldClock'
import { vehicleNear } from '../obstacles'
import { rng } from '../themes'
import { whereabouts } from '../whereabouts'
import { hash, type XZ } from './geo'
import type { Nav } from './nav'
import { Volleyball } from 'lucide-react'
import { JoinBubble } from './joinIn'

// The little maracana in the street: young people playing on the street
// itself, a goal at each end (two stones, or two sandals), a plastic ball.
// They pass, dribble, shoot; when a car comes they stop, the one with the
// ball picks it up, everyone steps to the side and watches it go by, and
// they're back on the street playing straight after. In the daytime, on the
// streets wide enough for the cars (so cars do come), always the same ones.
// From the shared clock: the same passes on every screen; the pauses follow
// the traffic each screen draws.

type Game = { id: string; at: XZ; rot: number; w: number; seed: number }

const NEAR = 220 // metres: games drawn around the Sim
const MAX = 3
const HALF = 11 // metres from the middle to each goal
const PASS = 1.4 // seconds a pass takes
const CLEAR = 32 // a car this close: off the street
const BACK = 26 // no car this close for a moment: back on

export function StreetFootball({ nav, seed, hour }: { nav: Nav; seed: string; hour: number }) {
  const all = useMemo(() => {
    const out: Game[] = []
    for (const e of nav.edges) {
      if (e.width < 6.5 || e.width > 9.5 || e.len < 40 || nav.ys[e.a] || nav.ys[e.b]) continue
      const [a, b] = [nav.nodes[e.a], nav.nodes[e.b]]
      const m: XZ = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
      if (hash(Math.round(m[0]), Math.round(m[1]), 131) > 0.05) continue
      const [ux, uz] = [(b[0] - a[0]) / e.len, (b[1] - a[1]) / e.len]
      // The group's x runs along the street: a turn about y taking (1, 0, 0) to (ux, uz).
      out.push({ id: `foot:${seed}:${Math.round(m[0])}:${Math.round(m[1])}`, at: m, rot: Math.atan2(-uz, ux), w: e.width, seed: hash(m[0], m[1], 7) })
    }
    return out
  }, [nav, seed])
  const [shown, setShown] = useState<Game[]>([])
  const tick = useRef(10)
  useFrame((_, dt) => {
    tick.current += dt
    if (tick.current < 1.5) return
    tick.current = 0
    const [sx, sz] = whereabouts.sim
    const near = all
      .map((g) => ({ g, d: Math.hypot(g.at[0] - sx, g.at[1] - sz) }))
      .filter((x) => x.d < NEAR)
      .sort((a, b) => a.d - b.d)
      .slice(0, MAX)
      .map((x) => x.g)
    if (near.map((g) => g.id).join() !== shown.map((g) => g.id).join()) setShown(near)
  })
  // Out to play in the daytime, after school and on into the evening.
  if (hour < 8 || hour >= 19) return null
  return (
    <>
      {shown.map((g) => (
        <group key={g.id}>
          <StreetGame game={g} />
          {/* A tap, and the children make room in their game: up and down the street with them */}
          <JoinBubble j={{ vendor: `foot:${g.id}`, activity: 'street-foot', at: g.at, y: 2.4, reach: 18, ask: 'Jouer avec les enfants', icon: Volleyball, far: 'Approche, on te passe la balle !', pitch: { dir: [Math.cos(g.rot), -Math.sin(g.rot)], half: HALF - 3 } }} />
        </group>
      ))}
    </>
  )
}

const stone = new THREE.MeshLambertMaterial({ color: '#8d8a84' })
const sandal = new THREE.MeshLambertMaterial({ color: '#1f6fd0' })
const BALL_COLORS = ['#f2c94c', '#ffffff', '#e8432f', '#2f9e44']

/** A stable 0..1 per pass. */
const h1 = (n: number, s: number) => {
  const x = Math.sin(n * 12.9898 + s * 78.233) * 43758.5453
  return x - Math.floor(x)
}

type Kid = { look: ReturnType<typeof randomLook>; gender: 'femme' | 'homme'; seed: number; scale: number; head: number; home: [number, number] }

function StreetGame({ game }: { game: Game }) {
  const kids = useMemo<Kid[]>(() => {
    const r = rng(game.id)
    const n = 6 + Math.floor(r() * 2)
    const edge = game.w / 2 - 1.1
    return [...Array(n)].map((_, i) => {
      const gender: 'femme' | 'homme' = r() < 0.2 ? 'femme' : 'homme'
      const small = r() < 0.4
      // Two teams, each kid with a place along the street; across, on one side or the other.
      const along = -HALF + 2 + (i / (n - 1)) * (2 * HALF - 4) + (r() - 0.5) * 2
      return { look: { ...randomLook(gender, r), outfit: r() < 0.5 ? 'jersey' : 'debardeur' }, gender, seed: r() * 100, scale: small ? 0.68 : 0.88, head: small ? 1.25 : 1.1, home: [along, (i % 2 ? 1 : -1) * edge * (0.3 + r() * 0.7)] }
    })
  }, [game.id, game.w])
  const N = kids.length
  const ball = useRef<THREE.Mesh>(null)
  const refs = useRef<(THREE.Group | null)[]>([])
  const pos = useRef(kids.map((k) => [...k.home] as [number, number]))
  const poses = useRef<Pose[]>(kids.map(() => 'idle'))
  const [, redraw] = useState(0)
  const pause = useRef({ on: false, clearSince: 0 })
  const goalFlat = game.seed < 0.5 // stones, or sandals
  const ballColor = BALL_COLORS[Math.floor(game.seed * BALL_COLORS.length)]

  // Who passes to whom, pass after pass: never to oneself.
  const receiver = (n: number) => Math.floor(h1(n, game.seed) * N)
  const meet = (n: number): [number, number] => {
    const r = receiver(n)
    const [hx, hz] = kids[r].home
    return [hx + (h1(n, game.seed + 3) - 0.5) * 3, Math.max(-game.w / 2 + 0.8, Math.min(game.w / 2 - 0.8, hz + (h1(n, game.seed + 5) - 0.5) * 2))]
  }
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1)
    const t = worldTime()
    // A car near: off the street; gone a moment: back on.
    const [cx, cz] = game.at
    const p = pause.current
    if (vehicleNear(cx, cz, CLEAR)) {
      p.on = true
      p.clearSince = t
    } else if (p.on && !vehicleNear(cx, cz, BACK) && t - p.clearSince > 1.2) p.on = false

    const n = Math.floor(t / PASS)
    const k = t / PASS - n
    // Every ninth pass is a shot, at the goal of the other team (even kids attack +x, odd ones -x).
    const isShot = (m: number) => m % 9 === 0
    const goalOf = (m: number): [number, number] => [(receiver(m - 1) % 2 ? -1 : 1) * HALF, (h1(m, game.seed + 9) - 0.5) * 1.6]
    const shot = isShot(n)
    const from = receiver(n - 1)
    let to = receiver(n)
    if (to === from) to = (to + 1) % N
    // Where the ball starts: where the last pass ended (after a shot, at the goal: someone fetches it).
    const a = isShot(n - 1) ? goalOf(n - 1) : meet(n - 1)
    const b = shot ? goalOf(n) : meet(n)
    // The pass after a shot: the shooter's team celebrates.
    const cheering = isShot(n - 1)
    const scorers = receiver(n - 2) % 2
    let changed = false
    kids.forEach((kid, i) => {
      let target: [number, number]
      let pose: Pose
      if (p.on) {
        // To the side, facing the road; the one who had the ball holds it.
        target = [kid.home[0], (kid.home[1] >= 0 ? 1 : -1) * (game.w / 2 + 1.2)]
        pose = i === from ? 'idle' : (i + n) % 3 === 0 ? 'talk' : 'idle'
      } else if (i === from) {
        target = a
        pose = k < 0.35 ? 'kick' : 'idle'
      } else if (i === to && !shot) {
        target = b
        pose = 'run'
      } else {
        target = [kid.home[0] + Math.sin(t * 0.7 + i) * 1.2, kid.home[1] + Math.cos(t * 0.5 + i * 2) * 0.6]
        const dBall = Math.hypot(pos.current[i][0] - a[0], pos.current[i][1] - a[1])
        pose = cheering && i % 2 === scorers ? 'cheer' : dBall < 3 ? 'mark' : 'idle'
      }
      const cur = pos.current[i]
      const was: [number, number] = [cur[0], cur[1]]
      const rate = 1 - Math.exp(-(p.on ? 3 : 4.5) * dt)
      cur[0] += (target[0] - cur[0]) * rate
      cur[1] += (target[1] - cur[1]) * rate
      const speed = Math.hypot(cur[0] - was[0], cur[1] - was[1]) / Math.max(dt, 0.001)
      if (pose === 'idle' && speed > 1.2) pose = speed > 3 ? 'run' : 'walk'
      const g = refs.current[i]
      if (g) {
        g.position.set(cur[0], 0, cur[1])
        // Face the ball while playing; the road while waiting at the side.
        const [lx, lz] = p.on ? [cur[0], 0] : speed > 1.2 ? [cur[0] + (cur[0] - was[0]) * 10, cur[1] + (cur[1] - was[1]) * 10] : i === from ? b : a
        g.rotation.y = Math.atan2(lx - cur[0], lz - cur[1])
      }
      if (pose !== poses.current[i]) {
        poses.current[i] = pose
        changed = true
      }
    })
    // The ball: in the hands of the one who had it while the car goes by; else from foot to foot.
    const bl = ball.current
    if (bl) {
      if (p.on) {
        const [fx, fz] = pos.current[from]
        bl.position.set(fx, 0.75 * kids[from].scale, fz + 0.25)
      } else {
        const e = k * k * (3 - 2 * k)
        bl.position.set(a[0] + (b[0] - a[0]) * e, 0.12 + Math.sin(k * Math.PI) * (shot ? 0.6 : 0.25), a[1] + (b[1] - a[1]) * e)
      }
    }
    if (changed) redraw((x) => x + 1)
  })
  return (
    <group position={[game.at[0], 0, game.at[1]]} rotation={[0, game.rot, 0]}>
      {/* The goals: two stones, or two sandals, at each end */}
      {[-1, 1].map((s) =>
        [-1, 1].map((side) =>
          goalFlat ? (
            <mesh key={`${s}${side}`} position={[s * HALF, 0.15, side * 1.1]} material={stone} castShadow>
              <boxGeometry args={[0.35, 0.3, 0.3]} />
            </mesh>
          ) : (
            <mesh key={`${s}${side}`} position={[s * HALF, 0.03, side * 1.1]} rotation={[0, side * 0.3, 0]} material={sandal}>
              <boxGeometry args={[0.28, 0.05, 0.12]} />
            </mesh>
          ),
        ),
      )}
      <mesh ref={ball} castShadow>
        <sphereGeometry args={[0.11, 10, 8]} />
        <meshLambertMaterial color={ballColor} />
      </mesh>
      <NoShadows>
        {kids.map((kid, i) => (
          <group key={i} ref={(g) => void (refs.current[i] = g)}>
            <group scale={kid.scale}>
              <Human look={kid.look} gender={kid.gender} pose={poses.current[i]} seed={kid.seed} headScale={kid.head} />
            </group>
          </group>
        ))}
      </NoShadows>
    </group>
  )
}

export { StreetGame }
export type { Game as StreetGameSpot }
