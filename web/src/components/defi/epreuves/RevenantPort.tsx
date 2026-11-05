import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Hud, beep, fx, rnd, useHud } from './kit'
import { Stage3D, planeAt, screenOf, type Finger } from './stage'
import { Box } from '../../../world3d/props'
import { t } from '../../../lib/i18n'

// « Le bateau fantôme de San-Pédro », chapter 1 (game/epreuves.go): at the place of worship, the candles
// lit for Daniel, and the sea wind coming in through the doors. In the room in the game's 3D blocks: the
// altar, the five candles and their flames of light blocks, the doors open on the night. A candle shivers
// (its flame shaking, the little swirl of the wind round it), then the gust: keep the finger on it (your
// cupped hands come over the flame) to shield it. Blown out, tap it: a match is struck and it's lit again.
// Keep them lit as long as you can (the score: the share of the time they were lit, as before).

const TIME = 45
const N = 5
type Candle = { lit: boolean; warn: number; relight: number; h: number }
/** The candles along the altar, the altar's top. */
const X = (i: number) => (i - (N - 1) / 2) * 0.62
const TOP = 0.9
/** The candles drawn this much bigger than life, to be seen and touched. */
const K = 1.6

export default function RevenantPort({ onEnd }: { onEnd: (score: number) => void }) {
  const s = useRef({ c: Array.from({ length: N }, () => ({ lit: true, warn: 0, relight: 0, h: rnd(0.7, 1) }) as Candle), hand: { x: -999, y: -999, on: false }, at: new THREE.Vector3(0, -5, 0), next: 2, litTime: 0, total: 0, over: false, now: 0, started: false })
  const [hud, setHud] = useHud({ left: TIME, lit: N })
  const flameOf = (i: number) => screenOf(X(i), TOP + (0.38 * s.current.c[i].h + 0.12) * K, 0)

  const tick = (dt: number) => {
    const st = s.current
    if (!st.started) return
    st.now += dt
    const now = st.now
    const left = TIME - now
    if (!st.over) {
      st.total += dt * N
      st.litTime += dt * st.c.filter((c) => c.lit).length
    }
    if (!st.over && left <= 0) {
      st.over = true
      const score = Math.round((st.litTime / Math.max(1, st.total)) * 100)
      if (score >= 80) fx.win()
      setTimeout(() => onEnd(score), 900)
    }
    if (!st.over && now >= st.next) {
      const lit = st.c.map((c, i) => (c.lit && !c.warn ? i : -1)).filter((i) => i >= 0)
      const n = now > TIME * 0.5 && Math.random() < 0.4 ? 2 : 1
      for (let k = 0; k < n && lit.length; k++) st.c[lit.splice(Math.floor(Math.random() * lit.length), 1)[0]].warn = now + Math.max(0.75, 1.2 - now * 0.01)
      st.next = now + Math.max(1.1, 2.6 - now * 0.035)
    }
    for (const [i, c] of st.c.entries()) {
      if (c.warn && now >= c.warn) {
        c.warn = 0
        const p = flameOf(i)
        // Shielded: the hand over the flame (within about its width on the screen).
        const q = screenOf(X(i) + 0.3, TOP, 0)
        const covered = st.hand.on && Math.hypot(st.hand.x - p.x, st.hand.y - p.y) < Math.max(40, Math.abs(q.x - p.x) * 1.2)
        beep(220, 0.5, 0.05, { type: 'sawtooth', to: 120 })
        if (covered) fx.good(p.x, p.y - 40, t('Tenu !'))
        else {
          c.lit = false
          fx.bad(p.x, p.y - 40)
        }
      }
      if (!c.lit && c.relight && now >= c.relight) {
        c.lit = true
        c.relight = 0
        beep(660, 0.12, 0.08, { type: 'triangle' })
        const p = flameOf(i)
        fx.burst(p.x, p.y, ['#ffd43b', '#ff922b'], 8, 90)
      }
    }
    setHud({ left: Math.max(0, left), lit: st.c.filter((c) => c.lit).length })
  }

  const front = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.25), [])
  const v = useMemo(() => new THREE.Vector3(), [])
  const touch = (e: Finger) => {
    const st = s.current
    st.hand = { x: e.x, y: e.y, on: e.kind !== 'up' }
    if (planeAt(e.x, e.y, front, v)) st.at.copy(v)
    if (e.kind !== 'down' || st.over) return
    st.c.forEach((c, i) => {
      const p = flameOf(i)
      const q = screenOf(X(i), TOP, 0)
      const half = Math.abs(screenOf(X(i) + 0.31, TOP, 0).x - q.x)
      if (!c.lit && !c.relight && Math.abs(e.x - p.x) < half && e.y > p.y - half * 1.5 && e.y < q.y + half) {
        c.relight = st.now + 0.7
        beep(1200, 0.06, 0.06, { type: 'square' })
      }
    })
  }

  return (
    <div className="absolute inset-0 select-none">
      <Stage3D cam={[0, 2.0, 3.6]} look={[0, 1.15, 0]} fov={40} fit={[3.4, 1.4]} bg="#15131f" light={0.45} touch={touch} onReady={() => (s.current.started = true)}>
        <Room />
        <Candles s={s} tick={tick} />
      </Stage3D>
      <Hud title={t('Les bougies pour Daniel')} left={hud.left} done={`${hud.lit}/${N}`} />
      <p className="pointer-events-none absolute inset-x-0 bottom-4 px-4 text-center text-xs font-bold text-white/80">{t('Garde le doigt sur la bougie que le vent vise. Éteinte : touche-la pour la rallumer.')}</p>
    </div>
  )
}

/** The room: the floor, the wall with its two doors open on the night sea, the altar and its cloth. */
function Room() {
  return (
    <group>
      <Box p={[0, -0.1, 0]} s={[8, 0.2, 6]} c="#3a2f2a" />
      <Box p={[0, 1.6, -1.2]} s={[8, 3.4, 0.2]} c="#4a3f52" />
      {[-2.4, 2.4].map((x) => (
        <group key={x}>
          <Box p={[x, 1.2, -1.08]} s={[0.9, 2.2, 0.05]} c="#0b0d1c" />
          <Box p={[x, 0.6, -1.06]} s={[0.9, 0.3, 0.04]} c="#1c3b5a" />
        </group>
      ))}
      <Box p={[0, 2.4, -1.08]} s={[0.12, 0.7, 0.04]} c="#c9b48a" />
      <Box p={[0, 2.5, -1.07]} s={[0.4, 0.12, 0.04]} c="#c9b48a" />
      <Box p={[0, TOP / 2, 0]} s={[3.6, TOP, 0.8]} c="#6b4423" />
      <Box p={[0, TOP - 0.15, 0.41]} s={[3.62, 0.3, 0.02]} c="#f8f9fa" />
      <Box p={[0, TOP + 0.01, 0]} s={[3.62, 0.02, 0.82]} c="#f8f9fa" />
    </group>
  )
}

/** The candles: wax, wick, the flame (light blocks flickering, shaking in the wind), the swirl of the gust,
 *  smoke when it's out, the match lighting it again; the cupped hands over the finger. */
function Candles({ s, tick }: { s: React.RefObject<{ c: Candle[]; hand: { on: boolean }; at: THREE.Vector3; now: number }>; tick: (dt: number) => void }) {
  const flames = useRef<(THREE.Group | null)[]>([])
  const swirls = useRef<(THREE.Group | null)[]>([])
  const matches = useRef<(THREE.Group | null)[]>([])
  const hand = useRef<THREE.Group>(null)
  const st = s.current
  useFrame((_, raw) => {
    tick(Math.min(raw, 0.05))
    const now = performance.now() / 1000
    st.c.forEach((c, i) => {
      const f = flames.current[i]
      const w = swirls.current[i]
      const m = matches.current[i]
      if (f) {
        f.visible = c.lit
        const shake = c.warn ? Math.sin(now * 40) * 0.25 : Math.sin(now * 6 + i) * 0.05
        f.rotation.z = shake
        f.scale.set(1, 0.85 + Math.abs(Math.sin(now * 9 + i * 2)) * 0.3, 1)
      }
      if (w) {
        w.visible = !!c.warn
        w.rotation.y = now * 9
      }
      if (m) {
        m.visible = !!c.relight
        m.rotation.z = 0.6 + Math.sin(now * 20) * 0.05
      }
    })
    const h = hand.current
    if (h) {
      h.visible = st.hand.on
      h.position.copy(st.at)
    }
  })
  return (
    <group>
      {st.c.map((c, i) => {
        const hh = 0.38 * c.h
        return (
          <group key={i} position={[X(i), TOP, 0]} scale={K}>
            <Box p={[0, hh / 2, 0]} s={[0.14, hh, 0.14]} c="#f1ead8" />
            <Box p={[0, hh + 0.03, 0]} s={[0.015, 0.05, 0.015]} c="#212529" />
            <group ref={(el) => void (flames.current[i] = el)} position={[0, hh + 0.05, 0]}>
              <mesh position={[0, 0.07, 0]}>
                <boxGeometry args={[0.07, 0.14, 0.07]} />
                <meshBasicMaterial color="#ffd43b" />
              </mesh>
              <mesh position={[0, 0.05, 0]}>
                <boxGeometry args={[0.1, 0.08, 0.1]} />
                <meshBasicMaterial color="#ff922b" transparent opacity={0.7} />
              </mesh>
            </group>
            <group ref={(el) => void (swirls.current[i] = el)} position={[0, hh + 0.1, 0]} visible={false}>
              {[0, 1, 2, 3].map((k) => (
                <mesh key={k} position={[Math.cos((k * Math.PI) / 2) * 0.16, k * 0.03, Math.sin((k * Math.PI) / 2) * 0.16]}>
                  <boxGeometry args={[0.05, 0.02, 0.02]} />
                  <meshBasicMaterial color="#dee2e6" transparent opacity={0.7} />
                </mesh>
              ))}
            </group>
            <group ref={(el) => void (matches.current[i] = el)} position={[0.12, hh + 0.12, 0.05]} visible={false}>
              <Box p={[0, -0.06, 0]} s={[0.015, 0.12, 0.015]} c="#e9c46a" />
              <mesh position={[0, 0.01, 0]}>
                <boxGeometry args={[0.03, 0.03, 0.03]} />
                <meshBasicMaterial color="#ff6b1a" />
              </mesh>
            </group>
          </group>
        )
      })}
      {/* The cupped hands, under the finger, over the flame */}
      <group ref={hand} visible={false}>
        <Box p={[-0.09, 0, 0]} s={[0.06, 0.2, 0.14]} c="#8d5a3b" r={0.3} />
        <Box p={[0.09, 0, 0]} s={[0.06, 0.2, 0.14]} c="#8d5a3b" r={-0.3} />
        <Box p={[0, -0.08, -0.05]} s={[0.2, 0.05, 0.1]} c="#7a4a2f" />
      </group>
    </group>
  )
}
