import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { Human, NoShadows, type Pose } from '../avatar/Human'
import { randomLook } from '../avatar/options'
import type { Look } from '../lib/types'
import { rng } from './themes'
import { Box } from './props'
import { worldTime } from '../lib/worldClock'
import { PostedBubble, likesFor } from './fans'
import { t as tr } from '../lib/i18n'

// The two street matches, played for real: the ball goes from foot to foot
// (or hand to hand), each player has a part (keeper, defender, the one who
// runs at the ball, the one who calls for it), and the score goes on the
// board. Local frame: x along the street, z across it (the road within ±2.6).

type Person = { gender: 'femme' | 'homme'; look: Look; seed: number }
type Player = {
  x: number
  z: number
  vx: number
  vz: number
  face: number
  team: 0 | 1
  keeper: boolean
  /** Can't touch the ball again before this runs out (s). */
  cool: number
  /** A move being made (kick, shot…) and how long it lasts. */
  act: number
  actPose: Pose
  jump: number
  /** Where they stand when nothing happens. */
  hx: number
  hz: number
  spot: number
  drive: boolean
}
type Ball = {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  owner: number
  last: number
}
type View = { pose: Pose; speed: number }[]

function player(team: 0 | 1, hx: number, hz: number, keeper = false): Player {
  return {
    x: hx,
    z: hz,
    vx: 0,
    vz: 0,
    face: team ? -Math.PI / 2 : Math.PI / 2,
    team,
    keeper,
    cool: 0,
    act: 0,
    actPose: 'idle',
    jump: 0,
    hx,
    hz,
    spot: 0,
    drive: false,
  }
}

/** Runs towards a point: eases to the speed it needs, no faster than `top`. */
function steer(p: Player, tx: number, tz: number, top: number, dt: number) {
  const [dx, dz] = [tx - p.x, tz - p.z]
  const d = Math.hypot(dx, dz)
  const want = d < 0.12 ? 0 : Math.min(top, d * 2.4)
  const k = 1 - Math.exp(-7 * dt)
  p.vx += ((d ? dx / d : 0) * want - p.vx) * k
  p.vz += ((d ? dz / d : 0) * want - p.vz) * k
  p.x += p.vx * dt
  p.z += p.vz * dt
}

/** Turns to face where they run, or the ball when standing. */
function turn(p: Player, bx: number, bz: number, dt: number) {
  const sp = Math.hypot(p.vx, p.vz)
  const want = sp > 0.5 ? Math.atan2(p.vx, p.vz) : Math.atan2(bx - p.x, bz - p.z)
  let d = want - p.face
  d = Math.atan2(Math.sin(d), Math.cos(d))
  p.face += d * (1 - Math.exp(-10 * dt))
}

/** Players don't walk through each other. */
function separate(ps: Player[], gap: number) {
  for (let i = 0; i < ps.length; i++)
    for (let j = i + 1; j < ps.length; j++) {
      const [dx, dz] = [ps[j].x - ps[i].x, ps[j].z - ps[i].z]
      const d = Math.hypot(dx, dz)
      if (d > 0 && d < gap) {
        const k = (gap - d) / d / 2
        ps[i].x -= dx * k
        ps[i].z -= dz * k
        ps[j].x += dx * k
        ps[j].z += dz * k
      }
    }
}

function poseOf(p: Player, extra: Pose | null): Pose {
  const sp = Math.hypot(p.vx, p.vz)
  if (extra) return extra
  if (p.act > 0) return p.actPose
  return sp > 2.6 ? 'run' : sp > 0.35 ? 'walk' : 'idle'
}

/** The players' looks: two teams in their colours. */
function useTeams(seed: string, n: number, dress: (team: 0 | 1, gender: Person['gender'], r: () => number) => Partial<Look>) {
  return useMemo<Person[]>(() => {
    const r = rng(seed)
    return [...Array(n)].map((_, i) => {
      const gender: Person['gender'] = r() < 0.7 ? 'homme' : 'femme'
      const team = (i < n / 2 ? 0 : 1) as 0 | 1
      return {
        gender,
        look: { ...randomLook(gender, r), ...dress(team, gender, r) },
        seed: r() * 100,
      }
    })
  }, [seed, n]) // eslint-disable-line react-hooks/exhaustive-deps
}

function useCrowd(n: number, seed: string) {
  return useMemo<Person[]>(() => {
    const r = rng(seed)
    return [...Array(n)].map(() => {
      const gender: Person['gender'] = r() < 0.5 ? 'femme' : 'homme'
      return { gender, look: randomLook(gender, r), seed: r() * 100 }
    })
  }, [n, seed])
}

/** The poses and step speeds, handed to React a few times a second only. */
function useView(n: number) {
  const [view, setView] = useState<View>(() => [...Array(n)].map(() => ({ pose: 'idle' as Pose, speed: 0 })))
  const last = useRef('')
  const tick = useRef(0)
  return {
    view,
    push(dt: number, next: () => View) {
      tick.current += dt
      if (tick.current < 0.2) return
      tick.current = 0
      const v = next()
      const key = v.map((x) => `${x.pose}${x.speed}`).join()
      if (key !== last.current) {
        last.current = key
        setView(v)
      }
    },
  }
}

/** The hand-painted board with the score: each team's colour and its points. */
function ScoreBoard({ p, r = 0, colors, score }: { p: [number, number, number]; r?: number; colors: [string, string]; score: [number, number] }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 96
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  useEffect(() => {
    const g = (tex.image as HTMLCanvasElement).getContext('2d')
    if (!g) return
    g.fillStyle = '#20332a'
    g.fillRect(0, 0, 256, 96)
    g.fillStyle = colors[0]
    g.fillRect(14, 22, 36, 52)
    g.fillStyle = colors[1]
    g.fillRect(206, 22, 36, 52)
    g.fillStyle = '#f4f1e8'
    g.font = 'bold 50px sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(`${score[0]} - ${score[1]}`, 128, 52)
    tex.needsUpdate = true
  }, [tex, colors, score])
  return (
    <group position={p} rotation={[0, r, 0]}>
      <Box p={[-0.55, 0.6, -0.03]} s={[0.06, 1.2, 0.06]} c="#5c3b1f" />
      <Box p={[0.55, 0.6, -0.03]} s={[0.06, 1.2, 0.06]} c="#5c3b1f" />
      <Box p={[0, 1.35, 0]} s={[1.36, 0.54, 0.04]} c="#5c3b1f" />
      <mesh position={[0, 1.35, 0.022]}>
        <planeGeometry args={[1.26, 0.46]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** A word shouted over the scene, for a moment ("BUT !", "Paniiier !"). It stays mounted: see HappeningMarker. */
function Shout({ p, text }: { p: [number, number, number]; text: string }) {
  return (
    <Html position={p} center zIndexRange={[20, 0]}>
      {text ? <div className="motion-pop rounded-xl bg-white px-2.5 py-1 text-[13px] font-extrabold whitespace-nowrap text-[#1a1a1a] shadow-[0_4px_12px_-6px_rgba(0,0,0,0.5)]">{text}</div> : <span />}
    </Html>
  )
}

/** A leather ball's look: white with dark patches, so it's seen to roll. */
function useBallTexture(base: string, patch: string, lines: boolean) {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 128
    c.height = 64
    const g = c.getContext('2d')
    if (g) {
      g.fillStyle = base
      g.fillRect(0, 0, 128, 64)
      g.fillStyle = patch
      g.strokeStyle = patch
      if (lines) {
        // A basketball's seams.
        g.lineWidth = 3
        for (const x of [32, 96]) g.fillRect(x - 1.5, 0, 3, 64)
        g.fillRect(0, 30.5, 128, 3)
        g.beginPath()
        g.ellipse(64, 32, 22, 40, 0, 0, Math.PI * 2)
        g.stroke()
      } else
        for (const [x, y] of [
          [16, 32],
          [48, 14],
          [48, 50],
          [80, 32],
          [112, 14],
          [112, 50],
          [64, 2],
          [64, 62],
        ]) {
          g.beginPath()
          g.arc(x, y, 8, 0, Math.PI * 2)
          g.fill()
        }
    }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [base, patch, lines])
}

/** Rolls the ball's mesh along with how it moves. */
function roll(m: THREE.Object3D, vx: number, vz: number, r: number, dt: number) {
  m.rotation.x += (vz / r) * dt
  m.rotation.z -= (vx / r) * dt
}

/* ===================== Street football ===================== */

const FW = 10 // the goal lines
const FZ = 2.6 // the kerbs on each side
const MOUTH = 1.05 // half the goal's width
const BAR = 1.15 // the crossbar
const FOOT_R = 0.11
const KIDS = 0.72
const ORANGE = '#f77f00'
const GREEN = '#009e60'
/** Each team: the keeper, two at the back, two up front. Team 0 plays towards +x. */
const LINEUP: [number, number][] = [
  [-9.4, 0],
  [-6.2, -1.3],
  [-6.2, 1.3],
  [-2.6, -1.1],
  [-2.6, 1.1],
]
const dirOf = (t: 0 | 1) => (t === 0 ? 1 : -1)

type FootSim = {
  ps: Player[]
  b: Ball
  phase: 'play' | 'goal'
  timer: number
  scorer: 0 | 1
  hero: number
  clock: number
}

export function footStart(): FootSim {
  const ps = ([0, 1] as const).flatMap((team) => LINEUP.map(([x, z], i) => player(team, x * dirOf(team), z, i === 0)))
  const sim: FootSim = {
    ps,
    b: { x: 0, y: FOOT_R, z: 0, vx: 0, vy: 0, vz: 0, owner: -1, last: -1 },
    phase: 'play',
    timer: 0,
    scorer: 0,
    hero: -1,
    clock: 0,
  }
  kickOff(sim, 0)
  return sim
}

/** Everyone back in place; the team that conceded (or the first) takes the kick-off. */
function kickOff(s: FootSim, team: 0 | 1) {
  for (const p of s.ps) {
    ;[p.x, p.z, p.vx, p.vz, p.act, p.cool] = [p.hx, p.hz, 0, 0, 0, 0]
  }
  const taker = team * 5 + 3
  const t = s.ps[taker]
  ;[t.x, t.z] = [-dirOf(team) * 0.35, 0]
  t.cool = 0.9
  Object.assign(s.b, {
    x: 0,
    y: FOOT_R,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    owner: taker,
    last: taker,
  })
  s.phase = 'play'
  s.hero = -1
}

function footKick(s: FootSim, i: number, tx: number, tz: number, speed: number, vy: number) {
  const p = s.ps[i]
  const [dx, dz] = [tx - s.b.x, tz - s.b.z]
  const d = Math.hypot(dx, dz) || 1
  Object.assign(s.b, {
    vx: (dx / d) * speed,
    vz: (dz / d) * speed,
    vy,
    owner: -1,
    last: i,
  })
  p.cool = 0.45
  p.act = 0.35
  p.actPose = p.keeper ? 'throw' : 'kick'
}

/** The best teammate to pass to: further forward, free of opponents. */
function passTarget(s: FootSim, i: number) {
  const o = s.ps[i]
  const d = dirOf(o.team)
  let best = -1
  let bs = -1e9
  s.ps.forEach((q, j) => {
    if (j === i || q.team !== o.team || q.keeper) return
    let free = 9
    for (const e of s.ps) if (e.team !== o.team) free = Math.min(free, Math.hypot(e.x - q.x, e.z - q.z))
    const score = (q.x - o.x) * d * 0.6 + Math.min(free, 3) * 1.2 - Math.hypot(q.x - o.x, q.z - o.z) * 0.15 + Math.random() * 1.5
    if (score > bs) [best, bs] = [j, score]
  })
  return best
}

export function footStep(s: FootSim, dt: number, onGoal: (team: 0 | 1, by: number) => void) {
  const { ps, b } = s
  s.clock += dt
  for (const p of ps) {
    p.cool -= dt
    p.act -= dt
  }
  if (s.phase === 'goal') {
    // The scorers run off to celebrate, the others walk back to their places;
    // the ball rolls to a stop in the net.
    s.timer -= dt
    const hero = ps[s.hero >= 0 ? s.hero : s.scorer * 5 + 3]
    for (const p of ps) {
      if (p === hero) steer(p, dirOf(s.scorer) * 6.5, 2.1, 4.5, dt)
      else if (p.team === s.scorer && !p.keeper) steer(p, hero.x - dirOf(s.scorer) * 1.1, hero.z - 0.7 + (ps.indexOf(p) % 3) * 0.6, 4.2, dt)
      else steer(p, p.hx, p.hz, 1.3, dt)
      turn(p, hero.x, hero.z, dt)
    }
    const f = Math.exp(-3 * dt)
    ;[b.vx, b.vz] = [b.vx * f, b.vz * f]
    b.vy -= 9.8 * dt
    b.x = THREE.MathUtils.clamp(b.x + b.vx * dt, -FW - 0.6, FW + 0.6)
    b.z = THREE.MathUtils.clamp(b.z + b.vz * dt, -MOUTH + 0.1, MOUTH - 0.1)
    b.y = Math.max(FOOT_R, b.y + b.vy * dt)
    separate(ps, 0.5)
    if (s.timer <= 0) kickOff(s, s.scorer === 0 ? 1 : 0)
    return
  }

  if (b.owner >= 0) {
    // The one with the ball: dribbles towards the goal, around whoever comes at him.
    const o = ps[b.owner]
    const d = dirOf(o.team)
    let near: Player | null = null
    let nd = 9
    for (const q of ps)
      if (q.team !== o.team && !q.keeper) {
        const k = Math.hypot(q.x - o.x, q.z - o.z)
        if (k < nd) [near, nd] = [q, k]
      }
    if (o.keeper) steer(o, o.hx, THREE.MathUtils.clamp(o.z, -0.8, 0.8), 1, dt)
    else {
      let tz = o.z * 0.7
      if (near && nd < 2.4) tz = o.z + (o.z > near.z ? 1.4 : -1.4)
      steer(o, o.x + d * 2.2, THREE.MathUtils.clamp(tz, -FZ + 0.4, FZ - 0.4), o.act > 0 ? 1 : 3.6, dt)
    }
    // The ball just in front, pushed on with little touches.
    const reach = o.keeper ? 0.3 : 0.32 + Math.abs(Math.sin(s.clock * 5.5)) * 0.16
    b.x = o.x + Math.sin(o.face) * reach
    b.z = o.z + Math.cos(o.face) * reach
    b.y = o.keeper ? 0.75 : FOOT_R
    ;[b.vx, b.vz, b.vy] = [o.vx, o.vz, 0]
    // A tackle from the closest opponent.
    if (near && nd < 0.6 && near.cool <= 0 && !o.keeper && Math.random() < 0.8 * dt) {
      b.owner = ps.indexOf(near)
      near.cool = 0.4
      o.cool = 0.9
    } else if (o.cool <= 0) {
      const goal = d * FW
      const range = Math.abs(goal - o.x)
      if (!o.keeper && Math.abs(o.z) < 2.3 && (range < 7 || (range < 11 && Math.random() < 0.06))) {
        // A shot: low or lifted, at a corner.
        footKick(s, b.owner, goal, (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * (MOUTH - 0.5)), 9 + Math.random() * 3, 0.5 + Math.random() * 2.2)
      } else if (o.keeper || (near && nd < 1.4) || Math.random() < 0.3) {
        const j = passTarget(s, b.owner)
        if (j >= 0) {
          const q = ps[j]
          const [tx, tz] = [q.x + q.vx * 0.45, q.z + q.vz * 0.45]
          const dist = Math.hypot(tx - b.x, tz - b.z)
          footKick(s, b.owner, tx, tz, 2.4 + dist * 1.35, o.keeper ? 2.5 : dist > 5 ? 1.6 : 0)
        }
      }
      o.cool = Math.max(o.cool, 0.45 + Math.random() * 0.7)
    }
  } else {
    // The ball loose: it flies, bounces, rolls and slows down; the kerbs send it back.
    b.vy -= 9.8 * dt
    b.x += b.vx * dt
    b.y += b.vy * dt
    b.z += b.vz * dt
    if (b.y < FOOT_R) {
      b.y = FOOT_R
      b.vy = b.vy < -1.2 ? -b.vy * 0.45 : 0
    }
    if (b.y < FOOT_R + 0.02) {
      const f = Math.exp(-1.1 * dt)
      ;[b.vx, b.vz] = [b.vx * f, b.vz * f]
    }
    if (Math.abs(b.z) > FZ) {
      b.z = Math.sign(b.z) * FZ
      b.vz = -b.vz * 0.5
    }
    if (Math.abs(b.x) > FW) {
      const side = Math.sign(b.x)
      const team: 0 | 1 = side > 0 ? 0 : 1
      if (Math.abs(b.z) < MOUTH && b.y < BAR) {
        s.phase = 'goal'
        s.timer = 4.5
        s.scorer = team
        s.hero = ps[b.last]?.team === team ? b.last : -1
        onGoal(team, s.hero)
        return
      }
      // Wide or over: the keeper of that goal takes it.
      const k = side > 0 ? 5 : 0
      const kp = ps[k]
      ;[kp.x, kp.z] = [kp.hx, THREE.MathUtils.clamp(b.z, -0.8, 0.8)]
      b.owner = k
      kp.cool = 1.2
    }
    // Picked up: by a keeper's hands (a save), or at someone's feet.
    if (b.owner < 0)
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i]
        if (p.cool > 0) continue
        const reach = Math.hypot(p.x - b.x, p.z - b.z)
        if (p.keeper && reach < 0.8 && b.y < 1.3) {
          // A hard shot, well placed, beats him: he dives and misses. Another
          // is only pushed away. A slow ball, he keeps.
          const sp = Math.hypot(b.vx, b.vz)
          if (sp > 7 && Math.random() < 0.1 + (sp - 7) * 0.05 + Math.abs(b.z - p.z) * 0.3) {
            p.cool = 0.8
            p.act = 0.5
            p.actPose = 'keeper'
            continue
          }
          if (sp > 7 && Math.random() < 0.4) {
            b.vx *= -0.35
            b.vz = (Math.random() - 0.5) * 6
            b.vy = 2
            p.cool = 0.6
            p.act = 0.4
            p.actPose = 'cheer'
          } else {
            b.owner = i
            p.cool = 1 + Math.random() * 0.6
          }
          break
        }
        // A fast ball mostly gets past the legs; a slow one is controlled.
        const fast = Math.hypot(b.vx, b.vz) > 5
        if (!p.keeper && reach < 0.45 && b.y < 0.5 && (!fast || Math.random() < 0.035)) {
          b.owner = i
          p.cool = 0.3 + Math.random() * 0.4
          break
        }
      }
  }

  // Everyone else: the closest one of each team goes for the ball, the
  // keepers follow it along their line, the rest keep their shape.
  const owner = b.owner >= 0 ? ps[b.owner] : null
  const chaser: [number, number] = [-1, -1]
  for (const team of [0, 1] as const) {
    let best = 1e9
    ps.forEach((p, i) => {
      if (p.team !== team || p.keeper || i === b.owner) return
      const d = Math.hypot(p.x - b.x, p.z - b.z)
      if (d < best && !(owner && owner.team === team)) [chaser[team], best] = [i, d]
    })
  }
  ps.forEach((p, i) => {
    if (i === b.owner) return
    if (p.keeper) {
      let tz = THREE.MathUtils.clamp(b.z * 0.5, -0.8, 0.8)
      // A shot coming: to where it will cross the line.
      const side = -dirOf(p.team)
      if (!owner && b.vx * side > 3) tz = THREE.MathUtils.clamp(b.z + (b.vz * (side * FW - b.x)) / b.vx, -MOUTH + 0.2, MOUTH - 0.2)
      steer(p, p.hx, tz, 3.4, dt)
    } else if (chaser[p.team] === i) {
      const lead = owner ? 0 : 0.3
      steer(p, b.x + b.vx * lead, b.z + b.vz * lead, owner ? 3.1 : 4.4, dt)
    } else {
      const d = dirOf(p.team)
      const attacking = owner?.team === p.team
      const tx = p.hx + b.x * 0.65 + (attacking ? d * 2.5 : -d * 0.5)
      const tz = p.hz * (attacking ? 1.3 : 0.9) + b.z * 0.3
      steer(p, THREE.MathUtils.clamp(tx, -FW + 1.5, FW - 1.5), THREE.MathUtils.clamp(tz, -FZ + 0.3, FZ - 0.3), attacking ? 3.2 : 2.6, dt)
    }
  })
  for (const p of ps) {
    turn(p, b.x, b.z, dt)
    p.z = THREE.MathUtils.clamp(p.z, -FZ - 0.2, FZ + 0.2)
    p.x = THREE.MathUtils.clamp(p.x, -FW - 0.2, FW + 0.2)
  }
  separate(ps, 0.5)
}

export function Football({ seed }: { seed: string }) {
  const kids = useTeams(`foot${seed}`, 10, (team, g) => ({
    outfit: 'jersey',
    outfitColor: team ? GREEN : ORANGE,
    hair: g === 'femme' ? 'braids' : 'short',
    accessory: 'none',
    beard: 'none',
  }))
  const fans = useCrowd(7, `footfans${seed}`)
  const sim = useRef<FootSim>(null as unknown as FootSim)
  if (!sim.current) sim.current = footStart()
  const refs = useRef<(THREE.Group | null)[]>([])
  const ball = useRef<THREE.Mesh>(null)
  const ballTex = useBallTexture('#f6f6f6', '#222222', false)
  const [score, setScore] = useState<[number, number]>([0, 0])
  const [shout, setShout] = useState({ text: '', side: 1 })
  // When the last goal went in: the fans filming it post the clip.
  const goalAt = useRef(-1e9)
  const { view, push } = useView(10)
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const s = sim.current
    footStep(s, dt, (team) => {
      setScore((x) => (team ? [x[0], x[1] + 1] : [x[0] + 1, x[1]]))
      setShout({ text: tr('BUUUT !'), side: dirOf(team) })
      goalAt.current = worldTime()
    })
    if (s.phase === 'play' && shout.text) setShout({ text: '', side: 1 })
    s.ps.forEach((p, i) => {
      const g = refs.current[i]
      if (!g) return
      g.position.set(p.x, 0, p.z)
      g.rotation.y = p.face
    })
    if (ball.current) {
      ball.current.position.set(s.b.x, s.b.y, s.b.z)
      roll(ball.current, s.b.vx, s.b.vz, FOOT_R, dt)
    }
    push(dt, () =>
      s.ps.map((p, i) => {
        const celebrate = s.phase === 'goal' && p.team === s.scorer && !p.keeper && Math.hypot(p.vx, p.vz) < 1.2
        const keeper = p.keeper && p.act <= 0 && Math.hypot(p.vx, p.vz) < 1.5 && s.b.owner !== i
        return {
          pose: poseOf(p, celebrate ? 'cheer' : keeper ? 'keeper' : null),
          speed: Math.round((Math.hypot(p.vx, p.vz) / KIDS) * 2) / 2,
        }
      }),
    )
  })
  return (
    <group>
      {/* The goals: two small cages, their nets at the back */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * FW, 0, 0]}>
          {[-MOUTH, MOUTH].map((z) => (
            <Box key={z} p={[side * 0.05, BAR / 2, z]} s={[0.08, BAR, 0.08]} c="#f8f9fa" />
          ))}
          <Box p={[side * 0.05, BAR, 0]} s={[0.08, 0.08, MOUTH * 2 + 0.08]} c="#f8f9fa" />
          <mesh position={[side * 0.65, BAR / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[MOUTH * 2, BAR, 8, 4]} />
            <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.6} />
          </mesh>
          {[-MOUTH, MOUTH].map((z) => (
            <mesh key={z} position={[side * 0.35, BAR / 2, z]}>
              <planeGeometry args={[0.6, BAR, 3, 4]} />
              <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.6} side={THREE.DoubleSide} />
            </mesh>
          ))}
        </group>
      ))}
      {/* The halfway line and centre, in chalk */}
      <Box p={[0, 0.02, 0]} s={[0.08, 0.01, FZ * 2]} c="#f1efe6" />
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.1, 1.18, 32]} />
        <meshBasicMaterial color="#f1efe6" />
      </mesh>
      <mesh ref={ball} castShadow>
        <sphereGeometry args={[FOOT_R, 14, 10]} />
        <meshLambertMaterial map={ballTex} />
      </mesh>
      <ScoreBoard p={[0, 0, -FZ - 1.2]} colors={[ORANGE, GREEN]} score={score} />
      <Shout p={[shout.side * FW * 0.6, 3.2, 0]} text={shout.text} />
      <NoShadows>
        {kids.map((p, i) => (
          <group key={i} ref={(g) => void (refs.current[i] = g)}>
            <group scale={KIDS}>
              <Human look={p.look} gender={p.gender} pose={view[i].pose} speed={view[i].speed} seed={p.seed} headScale={1.2} />
            </group>
          </group>
        ))}
        {/* The people watching from the side, up on their feet at a goal */}
        {fans.map((p, i) => {
          const x = -7 + i * 2.3
          const z = (i % 2 ? 1 : -1) * (FZ + 1.1)
          return (
            <group key={i} position={[x, 0, z]} rotation={[0, z > 0 ? Math.PI : 0, 0]} scale={i % 3 ? 1 : KIDS}>
              {/* Every third one films the match on the phone, and posts the goals */}
              <Human look={p.look} gender={p.gender} pose={i % 3 === 2 ? 'film' : shout.text ? 'cheer' : i % 4 === 1 ? 'talk' : 'idle'} seed={p.seed} headScale={i % 3 ? 1 : 1.2} />
              {i % 3 === 2 && <PostedBubble likes={likesFor(p.seed)} since={() => worldTime() - goalAt.current - 1 - i * 0.2} />}
            </group>
          )
        })}
      </NoShadows>
    </group>
  )
}

/* ===================== Street basketball ===================== */

const RX = 5.6 // the ring's centre, over the street
const RY = 3.05 // regulation height
const BOARD_X = 6.0
const ARC = 4.9 // inside it a basket counts 1, outside 2 (street rules)
const BZ = 3 // the court's sides
const BB_R = 0.12
const TALL = 0.95
const BLUE = '#1d428a'
const RED = '#d62828'
/** Where the attackers stand waiting for the ball, around the arc. */
const SPOTS: [number, number][] = [
  [0.6, 0],
  [1.4, 2.1],
  [1.4, -2.1],
  [3.6, 2.4],
  [3.6, -2.4],
  [2.6, 0.9],
  [2.6, -0.9],
]

type Flight = {
  fx: number
  fy: number
  fz: number
  tx: number
  ty: number
  tz: number
  t: number
  T: number
  h: number
  kind: 'pass' | 'shot'
  to: number
  make: boolean
  pts: number
}
type BasketSim = {
  ps: Player[]
  b: Ball
  fl: Flight | null
  phase: 'clear' | 'play' | 'loose' | 'score'
  poss: 0 | 1
  timer: number
  shooter: number
  clock: number
  net: number
}

export function basketStart(): BasketSim {
  const ps = ([0, 1] as const).flatMap((team) => [0, 1, 2].map((k) => player(team, 1 + k, (k - 1) * 1.8)))
  ps.forEach((p, i) => (p.spot = (i % 3) + 1))
  const s: BasketSim = {
    ps,
    b: { x: 0, y: 1, z: 0, vx: 0, vy: 0, vz: 0, owner: 0, last: 0 },
    fl: null,
    phase: 'clear',
    poss: 0,
    timer: 0,
    shooter: -1,
    clock: 0,
    net: 0,
  }
  ps[0].x = 0
  return s
}

const hand = (p: Player) => [p.x + Math.sin(p.face) * 0.3 + Math.cos(p.face) * 0.26, p.z + Math.cos(p.face) * 0.3 - Math.sin(p.face) * 0.26] as const

function throwBall(s: BasketSim, from: number, kind: Flight['kind'], to: number) {
  const o = s.ps[from]
  const b = s.b
  const fl: Flight = {
    fx: b.x,
    fy: b.y,
    fz: b.z,
    tx: 0,
    ty: 0,
    tz: 0,
    t: 0,
    T: 0,
    h: 0,
    kind,
    to,
    make: false,
    pts: 0,
  }
  if (kind === 'pass') {
    const q = s.ps[to]
    ;[fl.tx, fl.ty, fl.tz] = [q.x + q.vx * 0.3, 1.1, q.z + q.vz * 0.3]
    const d = Math.hypot(fl.tx - fl.fx, fl.tz - fl.fz)
    ;[fl.T, fl.h] = [0.15 + d / 8.5, 0.15 + d * 0.04]
    o.act = 0.3
    o.actPose = 'throw'
  } else {
    const d = Math.hypot(RX - o.x, o.z)
    const layup = d < 1.7
    const p = layup ? 0.6 : Math.max(0.22, 0.55 - d * 0.055)
    fl.make = Math.random() < p
    fl.pts = d > ARC ? 2 : 1
    const a = Math.random() * Math.PI * 2
    ;[fl.tx, fl.ty, fl.tz] = fl.make ? [RX, RY + 0.05, 0] : [RX + Math.cos(a) * 0.26, RY + 0.05, Math.sin(a) * 0.26]
    fl.fy = 2.2 * TALL + 0.3
    ;[fl.T, fl.h] = [0.7 + d * 0.07, layup ? 0.45 : 1.1 + d * 0.1]
    o.act = 0.55
    o.actPose = 'shoot'
    o.jump = 0.5
    s.shooter = from
    // The man marking him goes up too.
    const def = s.ps[(from + 3) % 6]
    if (Math.hypot(def.x - o.x, def.z - o.z) < 1.5) def.jump = 0.45
  }
  b.owner = -1
  b.last = from
  o.cool = 0.5
  s.fl = fl
}

/** The team that has the ball changes: it goes back out past the arc first. */
function turnover(s: BasketSim, to: number) {
  s.b.owner = to
  s.poss = s.ps[to].team
  s.phase = 'clear'
  s.ps[to].cool = 0.4
  s.ps[to].drive = false
}

export function basketStep(s: BasketSim, dt: number, say: (text: string) => void, onScore: (team: 0 | 1, pts: number) => void) {
  const { ps, b } = s
  s.clock += dt
  s.net = Math.max(0, s.net - dt)
  for (const p of ps) {
    p.cool -= dt
    p.act -= dt
    p.jump = Math.max(0, p.jump - dt)
  }
  const atk = (p: Player) => p.team === s.poss

  if (s.fl) {
    // The ball in the air: a pass, or a shot arcing to the ring.
    const f = s.fl
    f.t += dt
    const u = Math.min(1, f.t / f.T)
    b.x = f.fx + (f.tx - f.fx) * u
    b.z = f.fz + (f.tz - f.fz) * u
    b.y = f.fy + (f.ty - f.fy) * u + 4 * f.h * u * (1 - u)
    if (u >= 1) {
      s.fl = null
      if (f.kind === 'pass') {
        const q = ps[f.to]
        if (q.team !== s.poss) {
          turnover(s, f.to)
          say(tr('Interception !'))
        } else {
          b.owner = f.to
          q.cool = 0.35 + Math.random() * 0.5
        }
      } else if (f.make) {
        Object.assign(b, { x: RX, y: RY - 0.1, z: 0, vx: 0, vy: -1.5, vz: 0 })
        s.net = 0.5
        s.phase = 'score'
        s.timer = 1.8
        onScore(s.poss, f.pts)
        say(f.pts === 2 ? tr('Deux points de loin !') : [tr('Paniiier !'), tr('Dedans !'), tr('Ça rentre !')][Math.floor(Math.random() * 3)])
      } else {
        // Off the rim: the ball goes back out, high, somewhere.
        Object.assign(b, {
          vx: -(0.8 + Math.random() * 2.2),
          vy: 1.6 + Math.random() * 2,
          vz: (Math.random() - 0.5) * 4,
        })
        s.phase = 'loose'
        say([tr('Sur le cercle !'), tr('Raté !'), tr('Rebond !')][Math.floor(Math.random() * 3)])
      }
    }
  } else if (b.owner < 0) {
    // Loose: it bounces (a basketball bounces high), off the board, off the kerbs.
    b.vy -= 9.8 * dt
    b.x += b.vx * dt
    b.y += b.vy * dt
    b.z += b.vz * dt
    if (b.y < BB_R) {
      b.y = BB_R
      b.vy = b.vy < -1 ? -b.vy * 0.72 : 0
      const f = Math.exp(-6 * dt)
      ;[b.vx, b.vz] = [b.vx * f, b.vz * f]
    }
    if (b.x > BOARD_X - BB_R && b.y > 2.85 && b.y < 3.95) {
      b.x = BOARD_X - BB_R
      b.vx = -Math.abs(b.vx) * 0.6
    }
    if (b.x > 7.6 || b.x < -3) b.vx = -b.vx * 0.5
    if (Math.abs(b.z) > BZ + 0.4) {
      b.z = Math.sign(b.z) * (BZ + 0.4)
      b.vz = -b.vz * 0.5
    }
    if (s.phase === 'loose')
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i]
        if (p.cool > 0 || Math.hypot(p.x - b.x, p.z - b.z) > 0.6 || b.y > 2.4) continue
        if (b.y > 1.3) p.jump = 0.45
        if (p.team === s.poss) {
          b.owner = i
          s.phase = 'play'
          p.cool = 0.3
          p.drive = Math.hypot(RX - p.x, p.z) < 2.5
          say(tr('Rebond offensif !'))
        } else {
          turnover(s, i)
          say(tr('Rebond !'))
        }
        break
      }
    if (s.phase === 'score') {
      s.timer -= dt
      if (s.timer <= 0) {
        // The other team takes it out from under the basket.
        let k = -1
        let best = 1e9
        ps.forEach((p, i) => {
          const d = Math.hypot(p.x - b.x, p.z - b.z)
          if (!atk(p) && d < best) [k, best] = [i, d]
        })
        turnover(s, k)
      }
    }
  } else {
    // The one with the ball: dribbles; clears it out past the arc after a
    // change of hands, then drives, passes or shoots.
    const o = ps[b.owner]
    const target: [number, number] = s.phase === 'clear' ? [0.2, o.z * 0.5] : o.drive ? [RX - 0.9, THREE.MathUtils.clamp(o.z, -0.5, 0.5)] : SPOTS[o.spot]
    steer(o, target[0], target[1], o.act > 0 ? 0.3 : o.drive ? 3.6 : 2.4, dt)
    if (s.phase === 'clear' && o.x < 0.7) {
      s.phase = 'play'
      o.cool = Math.min(o.cool, 0.6)
    }
    if (o.act > 0 && o.actPose === 'shoot') return
    const [hx, hz] = hand(o)
    b.x = hx
    b.z = hz
    b.y = 0.13 + Math.abs(Math.sin(s.clock * 7)) * 0.72 * TALL
    if (s.phase === 'play' && o.cool <= 0) {
      const d = Math.hypot(RX - o.x, o.z)
      const r = Math.random()
      const mates = ps.map((_, i) => i).filter((i) => i !== b.owner && atk(ps[i]))
      if (o.drive && d < 1.6) throwBall(s, b.owner, 'shot', -1)
      else if (r < 0.4) {
        let to = mates[Math.floor(Math.random() * mates.length)]
        // A lazy pass is cut out by the man marking.
        const def = (to + 3) % 6
        if (Math.random() < 0.1) to = def
        throwBall(s, b.owner, 'pass', to)
      } else if (r < 0.68 && d < 6.2 && d > 2) throwBall(s, b.owner, 'shot', -1)
      else if (r < 0.85) o.drive = true
      else o.spot = Math.floor(Math.random() * SPOTS.length)
      o.cool = 0.7 + Math.random() * 0.9
    }
  }

  // Off the ball: the attackers move between spots; each defender sticks to
  // his man, between him and the basket; on a rebound, the closest go for it.
  ps.forEach((p, i) => {
    if (i === b.owner) return
    if (p.jump > 0 && p.act > 0) return
    if (s.phase === 'loose' && !s.fl) {
      const d = Math.hypot(p.x - b.x, p.z - b.z)
      if (d < 3.5) return steer(p, b.x + b.vx * 0.25, b.z + b.vz * 0.25, 4, dt)
    }
    if (s.phase === 'score') return steer(p, atk(p) ? 1.5 + (i % 3) : 3 + (i % 3), ((i % 3) - 1) * 1.6, 1.4, dt)
    if (atk(p)) {
      if (Math.random() < 0.25 * dt) p.spot = Math.floor(Math.random() * SPOTS.length)
      const [sx, sz] = SPOTS[p.spot]
      steer(p, sx, sz, 2.8, dt)
    } else {
      const man = ps[(i + 3) % 6]
      const [dx, dz] = [RX - man.x, -man.z]
      const d = Math.hypot(dx, dz) || 1
      const gap = s.phase === 'clear' ? 1.8 : man === ps[b.owner] ? 0.75 : 1.1
      steer(p, man.x + (dx / d) * gap, man.z + (dz / d) * gap, 3.6, dt)
    }
  })
  for (const p of ps) {
    turn(p, b.x, b.z, dt)
    p.z = THREE.MathUtils.clamp(p.z, -BZ, BZ)
    p.x = THREE.MathUtils.clamp(p.x, -2.5, RX + 0.6)
  }
  separate(ps, 0.55)
}

export function Basket({ seed }: { seed: string }) {
  const players = useTeams(`basket${seed}`, 6, (team) => ({
    outfit: 'basket',
    outfitColor: team ? RED : BLUE,
    bottomColor: team ? RED : BLUE,
    accessory: 'none',
  }))
  const fans = useCrowd(8, `basketfans${seed}`)
  const voice = useCrowd(1, `speaker${seed}`)[0]
  const sim = useRef<BasketSim>(null as unknown as BasketSim)
  if (!sim.current) sim.current = basketStart()
  const refs = useRef<(THREE.Group | null)[]>([])
  const ball = useRef<THREE.Mesh>(null)
  const net = useRef<THREE.Mesh>(null)
  const ballTex = useBallTexture('#d8641f', '#2a1a10', true)
  const [score, setScore] = useState<[number, number]>([0, 0])
  const [line, setLine] = useState({ text: tr('Le tournoi commence !'), at: 0 })
  // When the last basket went in: the fans filming it post the clip.
  const scoredAt = useRef(-1e9)
  const { view, push } = useView(6)
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const s = sim.current
    basketStep(
      s,
      dt,
      (text) => setLine({ text, at: worldTime() }),
      (team, pts) => {
        setScore((x) => (team ? [x[0], x[1] + pts] : [x[0] + pts, x[1]]))
        scoredAt.current = worldTime()
      },
    )
    if (line.text && worldTime() - line.at > 2.2 && line.at >= 0) setLine({ text: '', at: -1 })
    s.ps.forEach((p, i) => {
      const g = refs.current[i]
      if (!g) return
      g.position.set(p.x, Math.sin((p.jump / 0.5) * Math.PI) * 0.45, p.z)
      g.rotation.y = p.face
    })
    if (ball.current) {
      ball.current.position.set(s.b.x, s.b.y, s.b.z)
      roll(ball.current, s.b.owner >= 0 ? 0 : s.b.vx, s.b.owner >= 0 ? 0 : s.b.vz, BB_R, dt)
    }
    // The net jumps when the ball goes through.
    if (net.current) net.current.scale.y = 1 + Math.sin(s.net * 20) * s.net * 0.6
    push(dt, () =>
      s.ps.map((p, i) => {
        const sp = Math.hypot(p.vx, p.vz)
        const cheer = s.phase === 'score' && p.team === s.poss && sp < 1.2
        const dribble = s.b.owner === i && p.act <= 0
        return {
          pose: dribble ? 'dribble' : poseOf(p, cheer ? 'cheer' : null),
          speed: Math.round((sp / TALL) * 2) / 2,
        }
      }),
    )
  })
  const arc = Math.asin(BZ / ARC)
  return (
    <group>
      {/* The court chalked on the asphalt: the arc, the key, the free-throw line */}
      <mesh position={[RX, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[ARC - 0.05, ARC + 0.05, 40, 1, Math.PI - arc, arc * 2]} />
        <meshBasicMaterial color="#f1efe6" />
      </mesh>
      {[-1, 1].map((k) => (
        <Box key={k} p={[(RX + 0.5 + 2.2) / 2, 0.02, k * 1.5]} s={[RX + 0.5 - 2.2, 0.01, 0.08]} c="#f1efe6" />
      ))}
      <Box p={[2.2, 0.02, 0]} s={[0.08, 0.01, 3]} c="#f1efe6" />
      <Box p={[RX + 0.5, 0.02, 0]} s={[0.08, 0.01, BZ * 2]} c="#f1efe6" />
      {/* The hoop on its wheeled stand, the board facing the court */}
      <group>
        <Box p={[7.4, 0.25, 0]} s={[1.3, 0.5, 1.4]} c="#1b2a4a" />
        <mesh position={[7.4, 1.85, 0]}>
          <cylinderGeometry args={[0.07, 0.09, 3.2, 8]} />
          <meshLambertMaterial color="#2b2b2b" />
        </mesh>
        <Box p={[6.75, 3.35, 0]} s={[1.3, 0.1, 0.1]} c="#2b2b2b" />
        <Box p={[BOARD_X + 0.04, 3.4, 0]} s={[0.05, 1.05, 1.8]} c="#f8f9fa" />
        <Box p={[BOARD_X, 3.3, 0]} s={[0.02, 0.45, 0.6]} c="#d62828" />
        <Box p={[BOARD_X, 3.3, 0]} s={[0.025, 0.37, 0.52]} c="#f8f9fa" />
        <Box p={[(RX + BOARD_X) / 2 + 0.1, RY - 0.03, 0]} s={[0.25, 0.04, 0.12]} c="#e85d04" />
        <mesh position={[RX, RY, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.23, 0.018, 6, 20]} />
          <meshLambertMaterial color="#e85d04" />
        </mesh>
        <group position={[RX, RY, 0]}>
          <mesh ref={net} position={[0, -0.2, 0]}>
            <cylinderGeometry args={[0.22, 0.14, 0.4, 10, 3, true]} />
            <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.75} />
          </mesh>
        </group>
      </group>
      <mesh ref={ball} castShadow>
        <sphereGeometry args={[BB_R, 14, 10]} />
        <meshLambertMaterial map={ballTex} />
      </mesh>
      <ScoreBoard p={[1.2, 0, -BZ - 1.2]} colors={[BLUE, RED]} score={score} />
      {/* The one with the mic, on his stand, and the sound system */}
      <group position={[-1.6, 0, -BZ - 1.3]}>
        <mesh position={[0.45, 0.75, 0.35]}>
          <cylinderGeometry args={[0.015, 0.015, 1.5, 6]} />
          <meshLambertMaterial color="#222" />
        </mesh>
        <mesh position={[0.45, 1.52, 0.35]}>
          <sphereGeometry args={[0.045, 8, 6]} />
          <meshLambertMaterial color="#111" />
        </mesh>
        <Box p={[-0.7, 0.6, 0]} s={[0.6, 1.2, 0.5]} c="#151515" />
        <mesh position={[-0.7, 0.8, 0.26]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.02, 16]} />
          <meshLambertMaterial color="#3a3a3a" />
        </mesh>
        <Shout p={[0.3, 2.4, 0]} text={line.text} />
      </group>
      <NoShadows>
        <group position={[-1.6, 0, -BZ - 1.3]} rotation={[0, 0.6, 0]}>
          <Human look={voice.look} gender={voice.gender} pose={line.text ? 'rant' : 'talk'} seed={voice.seed} />
        </group>
        {players.map((p, i) => (
          <group key={i} ref={(g) => void (refs.current[i] = g)}>
            <group scale={TALL}>
              <Human look={p.look} gender={p.gender} pose={view[i].pose} speed={view[i].speed} seed={p.seed} />
            </group>
          </group>
        ))}
        {fans.map((p, i) => {
          const z = BZ + 1.2 + (i % 2) * 0.7
          return (
            <group key={i} position={[-1 + i * 1.1, 0, z]} rotation={[0, Math.PI, 0]}>
              <Human look={p.look} gender={p.gender} pose={i % 3 === 2 ? 'film' : line.text ? 'cheer' : i % 3 === 1 ? 'talk' : 'idle'} seed={p.seed} />
              {i % 3 === 2 && <PostedBubble likes={likesFor(p.seed)} since={() => worldTime() - scoredAt.current - 0.8 - i * 0.15} />}
            </group>
          )
        })}
      </NoShadows>
    </group>
  )
}
