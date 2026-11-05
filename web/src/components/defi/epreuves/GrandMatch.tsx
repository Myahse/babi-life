import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Flash, Hud, beep, clamp, fx, rnd } from './kit'
import { Stage3D, groundAt, type Finger } from './stage'
import { Box } from '../../../world3d/props'
import { Human, NoShadows } from '../../../avatar/Human'
import { lookAt, randomLook } from '../../../avatar/options'
import { setExpression } from '../../../avatar/expressions'
import { Prop } from '../jeux/props'
import { t } from '../../../lib/i18n'

// « La finale des moins de 13 ans », chapter 1 (game/epreuves.go): spying on the other team at their
// match. On their pitch in the game's 3D blocks, their six players in red pass the ball round fast (and
// their « petit » of two metres is in it): follow it with your eyes, from foot to foot. When it stops, the
// ball's hidden under the players' feet while they keep running about: tap the one who has it (the ring
// under him, his number over his head, says who it was). Five moves, each longer and quicker.

const ROUNDS = 5
const PLAYERS = 6
const NUMBERS = [7, 10, 9, 4, 11, 8]
/** The pitch's half sizes (the players stay inside). */
const HW = 2.5
const HD = 3.6

type P = { x: number; z: number; tx: number; tz: number; big: boolean; n: number; face: number }
type S = { ps: P[]; round: number; passes: number[]; k: number; at: number; holder: number; phase: 'wait' | 'pass' | 'guess' | 'show'; good: number; now: number; nextAt: number; pick: number; started: boolean }

export default function GrandMatch({ onEnd }: { onEnd: (score: number) => void }) {
  const s = useRef<S>({
    ps: Array.from({ length: PLAYERS }, (_, i) => {
      const x = rnd(-HW, HW) * 0.8
      const z = rnd(-HD, HD) * 0.8
      return { x, z, tx: x, tz: z, big: i === 2, n: NUMBERS[i], face: 0 }
    }),
    round: 0,
    passes: [],
    k: 0,
    at: 0,
    holder: 0,
    phase: 'wait',
    good: 0,
    now: 0,
    nextAt: 1,
    pick: -1,
    started: false,
  })
  const [hud, setHud] = useState({ round: 1, good: 0, phase: 'wait' as S['phase'] })
  const [flash, setFlash] = useState({ text: '', at: 0 })

  const newRound = (now: number) => {
    const st = s.current
    const n = 3 + st.round
    st.passes = []
    let from = st.holder
    for (let i = 0; i < n; i++) {
      let to = from
      while (to === from) to = Math.floor(Math.random() * PLAYERS)
      st.passes.push(to)
      from = to
    }
    st.k = 0
    st.at = now
    st.phase = 'pass'
    st.pick = -1
    setHud({ round: st.round + 1, good: st.good, phase: 'pass' })
  }

  const p = useMemo(() => new THREE.Vector3(), [])
  const touch = (e: Finger) => {
    const st = s.current
    if (e.kind !== 'down' || st.phase !== 'guess' || !groundAt(e.x, e.y, 0.8, p)) return
    let pick = -1
    let bd = Infinity
    st.ps.forEach((q, i) => {
      const d = Math.hypot(p.x - q.x, p.z - q.z)
      if (d < (q.big ? 1.0 : 0.8) && d < bd) ((bd = d), (pick = i))
    })
    if (pick < 0) return
    st.pick = pick
    st.phase = 'show'
    const ok = pick === st.holder
    if (ok) {
      fx.good(e.x, e.y, t('Bien vu !'))
      if (st.good + 1 >= ROUNDS) fx.win()
      st.good++
      beep(660, 0.12, 0.12)
      beep(990, 0.2, 0.12)
      setExpression(`match-${st.holder}`, 'surprised', 1400)
    } else {
      beep(170, 0.3, 0.12, { type: 'square' })
      fx.bad(e.x, e.y, '✗')
      // The one who had it grins: fooled you.
      setExpression(`match-${st.holder}`, 'proud', 1400)
    }
    setFlash({ text: ok ? t('Bien vu !') : t('Raté, c’est le numéro {n}', { n: st.ps[st.holder].n }), at: Date.now() })
    st.round++
    setHud({ round: Math.min(ROUNDS, st.round + 1), good: st.good, phase: 'show' })
    if (st.round >= ROUNDS) setTimeout(() => onEnd(Math.round((st.good / ROUNDS) * 100)), 1300)
    else {
      st.nextAt = st.now + 1.4
      setTimeout(() => (st.phase = 'wait'), 1300)
    }
  }

  return (
    <div className="absolute inset-0 select-none">
      <Stage3D cam={[0, 10, 4.2]} look={[0, 0, 0.2]} fov={40} fit={[HW * 2 + 1.6, HD * 2 + 1.2]} bg="#2b8a3e" touch={touch} onReady={() => (s.current.started = true)}>
        <Pitch />
        <Match s={s} newRound={newRound} onGuess={() => setHud((h) => ({ ...h, phase: 'guess' }))} phase={hud.phase} />
      </Stage3D>
      <Hud title={t('Espionner l’équipe')} done={`${hud.good}/${ROUNDS}`} />
      <div className="pointer-events-none absolute inset-x-0 top-14 z-10 text-center font-display text-lg font-extrabold text-white drop-shadow">{hud.phase === 'guess' ? t('Qui a le ballon ?') : hud.phase === 'pass' ? t('Suis le ballon… ({n}/{all})', { n: hud.round, all: ROUNDS }) : ''}</div>
      <Flash text={flash.text} at={flash.at} />
    </div>
  )
}

/** The pitch: its grass in stripes, its white lines, the goals at both ends. */
function Pitch() {
  return (
    <group>
      <Box p={[0, -0.1, 0]} s={[12, 0.2, 14]} c="#2b8a3e" />
      {Array.from({ length: 8 }, (_, i) => (
        <Box key={i} p={[0, 0.002, -HD - 0.4 + (i + 0.5) * ((HD * 2 + 0.8) / 8)]} s={[HW * 2 + 0.8, 0.004, (HD * 2 + 0.8) / 16]} c="#2f9e44" />
      ))}
      {/* The lines */}
      <Box p={[0, 0.006, -HD - 0.4]} s={[HW * 2 + 0.8, 0.01, 0.06]} c="#ffffff" />
      <Box p={[0, 0.006, HD + 0.4]} s={[HW * 2 + 0.8, 0.01, 0.06]} c="#ffffff" />
      <Box p={[-HW - 0.4, 0.006, 0]} s={[0.06, 0.01, HD * 2 + 0.8]} c="#ffffff" />
      <Box p={[HW + 0.4, 0.006, 0]} s={[0.06, 0.01, HD * 2 + 0.8]} c="#ffffff" />
      <Box p={[0, 0.006, 0]} s={[HW * 2 + 0.8, 0.01, 0.06]} c="#ffffff" />
      {/* The goals, white posts and bar */}
      {[-1, 1].map((side) => (
        <group key={side} position={[0, 0, side * (HD + 0.4)]}>
          <Box p={[-0.9, 0.4, 0]} s={[0.08, 0.8, 0.08]} c="#f8f9fa" />
          <Box p={[0.9, 0.4, 0]} s={[0.08, 0.8, 0.08]} c="#f8f9fa" />
          <Box p={[0, 0.8, 0]} s={[1.88, 0.08, 0.08]} c="#f8f9fa" />
        </group>
      ))}
    </group>
  )
}

/** The players running about and the ball passed among them (the game's clock and its moves, every frame). */
function Match({ s, newRound, onGuess, phase }: { s: React.RefObject<S>; newRound: (now: number) => void; onGuess: () => void; phase: S['phase'] }) {
  const bodies = useRef<(THREE.Group | null)[]>([])
  const ball = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)
  const looks = useMemo(
    () =>
      NUMBERS.map((_, i) => {
        let seed = 77 + i * 131
        const rng = () => ((seed = (seed * 9301 + 49297) % 233280), seed / 233280)
        return lookAt({ ...randomLook('homme', rng), outfit: 'jersey', outfitColor: '#e03131' }, i === 2 ? 'adulte' : 'ado')
      }),
    [],
  )
  useFrame((_, raw) => {
    const st = s.current
    if (!st.started) return
    const dt = Math.min(raw, 0.05)
    st.now += dt
    const now = st.now
    const passTime = Math.max(0.32, 0.75 - st.round * 0.1)
    if (st.phase === 'wait' && now >= st.nextAt) newRound(now)
    // The players run about (more each round), towards a spot then another; they face where they go.
    st.ps.forEach((q, i) => {
      const sp = 0.45 + st.round * 0.33
      const d = Math.hypot(q.tx - q.x, q.tz - q.z)
      if (d < 0.06) {
        q.tx = clamp(q.x + rnd(-1.2, 1.2), -HW, HW)
        q.tz = clamp(q.z + rnd(-1.2, 1.2), -HD, HD)
      } else if (st.phase !== 'show') {
        q.x += ((q.tx - q.x) / d) * sp * dt
        q.z += ((q.tz - q.z) / d) * sp * dt
        q.face = Math.atan2(q.tx - q.x, q.tz - q.z)
      }
      const b = bodies.current[i]
      if (b) {
        b.position.set(q.x, 0, q.z)
        let dr = q.face - b.rotation.y
        dr = Math.atan2(Math.sin(dr), Math.cos(dr))
        b.rotation.y += dr * Math.min(1, dt * 8)
      }
    })
    // The ball: from one's feet to the next along its pass; done, it's hidden at the last one's feet.
    const holder = st.ps[st.holder]
    let bx = holder.x
    let bz = holder.z
    let by = 0.12
    if (st.phase === 'pass') {
      const k = Math.floor((now - st.at) / passTime)
      if (k >= st.passes.length) {
        st.holder = st.passes[st.passes.length - 1]
        st.phase = 'guess'
        onGuess()
      } else {
        if (k !== st.k) {
          st.k = k
          beep(500 + Math.random() * 200, 0.04, 0.06, { type: 'square' })
        }
        const a = st.ps[k === 0 ? st.holder : st.passes[k - 1]]
        const b = st.ps[st.passes[k]]
        const f = (now - st.at - k * passTime) / passTime
        bx = a.x + (b.x - a.x) * f
        bz = a.z + (b.z - a.z) * f
        by = 0.12 + Math.sin(f * Math.PI) * 0.5
      }
    }
    const g = ball.current
    if (g) {
      g.visible = st.phase === 'pass' || st.phase === 'show'
      if (st.phase === 'show') ((bx = st.ps[st.holder].x), (bz = st.ps[st.holder].z + 0.3))
      g.position.set(bx, by, bz)
      g.rotation.x += dt * 9
    }
    // Shown: a ring under the one who had it.
    const r = ring.current
    if (r) {
      r.visible = st.phase === 'show'
      r.position.set(st.ps[st.holder].x, 0.02, st.ps[st.holder].z)
    }
  })
  const st = s.current
  return (
    <group>
      {st.ps.map((q, i) => (
        <group key={i} ref={(el) => void (bodies.current[i] = el)} position={[q.x, 0, q.z]}>
          <group scale={q.big ? 1.0 : 0.74}>
            <NoShadows>
              <Human look={looks[i]} gender="homme" pose={phase === 'show' ? 'idle' : 'run'} seed={i * 5} fitted faceId={`match-${i}`} />
            </NoShadows>
          </group>
          {/* The number over the head, once shown: the one who had it gold, the one picked grey */}
          {phase === 'show' && (i === st.holder || i === st.pick) && <Shirt n={q.n} y={q.big ? 2.4 : 1.8} gold={i === st.holder} />}
        </group>
      ))}
      <group ref={ball} scale={0.24}>
        <Prop id="ballon-foot" />
      </group>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.45, 0.62, 12]} />
        <meshBasicMaterial color="#ffd43b" />
      </mesh>
    </group>
  )
}

/** A number in blocks on a plate (3 × 5 pixels a digit), over a player's head. */
const DIGITS: Record<string, string> = { '0': '111101101101111', '1': '010110010010111', '4': '101101111001001', '7': '111001010010010', '8': '111101111101111', '9': '111101111001111' }
function Shirt({ n, y, gold }: { n: number; y: number; gold: boolean }) {
  const cells = useMemo(() => {
    const out: [number, number][] = []
    const s = String(n)
    for (let d = 0; d < s.length; d++)
      for (let k = 0; k < 15; k++) if (DIGITS[s[d]]?.[k] === '1') out.push([(d - (s.length - 1) / 2) * 0.36 + ((k % 3) - 1) * 0.09, (2 - Math.floor(k / 3)) * 0.09])
    return out
  }, [n])
  return (
    <group position={[0, y, 0]} rotation={[-0.6, 0, 0]}>
      <Box p={[0, 0, 0]} s={[0.36 * String(n).length + 0.16, 0.6, 0.06]} c={gold ? '#ffd43b' : '#adb5bd'} />
      {cells.map(([x, yy], i) => (
        <Box key={i} p={[x, yy, 0.04]} s={[0.085, 0.085, 0.03]} c="#16161c" />
      ))}
    </group>
  )
}
