import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Flash, Hud, beep, fx } from './kit'
import { Stage3D, ease, groundAt, screenOf, type Finger } from './stage'
import { Box, Sign } from '../../../world3d/props'
import { t } from '../../../lib/i18n'

// « Le chat de Mamie Rose », chapter 1 (game/epreuves.go): Grigri at the market, after the alloco's smell.
// The market's stall in the game's 3D blocks: nine woven baskets on the ground, and the stalls' cats and
// hens putting their heads up out of them and down again. Tap Grigri, the grey one with the red collar,
// each time he shows (he's caught: a jump, his miaow); not the others (the market cats, the hens): the
// sellers shoo you off and it costs time. Ten times Grigri before he's off with his fish.

const TIME = 40
const GOAL = 10
const HOLES = 9
type Who = 'grigri' | 'roux' | 'noir' | 'poule'
type Up = { who: Who; until: number; id: number }

/** The baskets' places on the ground: three rows of three. */
const SPOT = (i: number): [number, number] => [((i % 3) - 1) * 1.7, (Math.floor(i / 3) - 1) * 2.3]
const COLORS = ['#e03131', '#2f9e44', '#fab005']

export default function ChatGrigri({ onEnd }: { onEnd: (score: number) => void }) {
  const [ups, setUps] = useState<(Up | null)[]>(Array(HOLES).fill(null))
  const [got, setGot] = useState(0)
  const [lost, setLost] = useState(0)
  const [now, setNow] = useState(0)
  const [flash, setFlash] = useState({ text: '', at: 0 })
  // What happened at each basket last (caught, or the wrong one), for the animal's own reaction.
  const [hits, setHits] = useState<{ i: number; good: boolean; at: number } | null>(null)
  // The clock starts once the market is on the screen.
  const st = useRef({ t0: Infinity, next: 0.6, id: 0, over: false, wrong: 0 })

  useEffect(() => {
    const tick = setInterval(() => {
      const s = st.current
      if (s.t0 === Infinity) return
      const n = (performance.now() - s.t0) / 1000
      setNow(n)
      setUps((u) => {
        const v = u.map((x) => (x && x.until > n ? x : null))
        if (!s.over && n >= s.next) {
          const free = v.map((x, i) => (x ? -1 : i)).filter((i) => i >= 0)
          if (free.length) {
            const hole = free[Math.floor(Math.random() * free.length)]
            const r = Math.random()
            // Quicker as it goes on.
            const stay = Math.max(0.6, 1.3 - n * 0.017)
            v[hole] = { who: r < 0.4 ? 'grigri' : r < 0.6 ? 'roux' : r < 0.8 ? 'noir' : 'poule', until: n + stay, id: ++s.id }
          }
          s.next = n + Math.max(0.35, 0.8 - n * 0.01)
        }
        return v
      })
    }, 50)
    return () => clearInterval(tick)
  }, [])

  const left = TIME - now - lost
  useEffect(() => {
    const s = st.current
    if (s.over || (left > 0 && got < GOAL)) return
    s.over = true
    if (got >= GOAL) setFlash({ text: t('Grigri est repéré !'), at: Date.now() })
    setTimeout(() => onEnd(Math.round(Math.min(1, got / GOAL) * 80 + (got >= GOAL ? Math.max(0, left / TIME) * 20 : 0) - s.wrong * 3)), 1000)
  }, [left, got, onEnd])

  const tap = (i: number) => {
    const u = ups[i]
    if (!u || st.current.over) return
    const [x, z] = SPOT(i)
    const at = screenOf(x, 1.0, z)
    setUps((v) => v.map((x, k) => (k === i ? null : x)))
    setHits({ i, good: u.who === 'grigri', at: performance.now() })
    if (u.who === 'grigri') {
      setGot((g) => g + 1)
      fx.good(at.x, at.y, got + 1 >= GOAL ? t('Grigri !') : `${got + 1}/${GOAL}`)
      if (got + 1 >= GOAL) fx.win()
      beep(880, 0.15, 0.12, { type: 'triangle', to: 1200 })
    } else {
      st.current.wrong++
      setLost((l) => l + 2)
      fx.bad(at.x, at.y, '−2 s')
      beep(u.who === 'poule' ? 700 : 300, 0.2, 0.12, { type: 'square', to: u.who === 'poule' ? 1000 : 200 })
      setFlash({ text: u.who === 'poule' ? t('Cot cot ! Une poule…') : t('Pas Grigri !'), at: Date.now() })
    }
  }
  const p = useMemo(() => new THREE.Vector3(), [])
  const touch = (f: Finger) => {
    if (f.kind !== 'down' || !groundAt(f.x, f.y, 0.9, p)) return
    // The basket nearest the finger, read at the height of an animal's head (what one taps), the reach generous.
    let best = -1
    let d = 1.05
    for (let i = 0; i < HOLES; i++) {
      const [x, z] = SPOT(i)
      const k = Math.hypot(p.x - x, p.z - z)
      if (k < d) ((d = k), (best = i))
    }
    if (best >= 0) tap(best)
  }

  return (
    <div className="absolute inset-0 select-none">
      <Stage3D cam={[0, 6.2, 7.6]} look={[0, 0.2, 0.2]} fov={40} fit={[5.0, 7.2]} bg="#ffd8a8" touch={touch} onReady={() => (st.current.t0 = performance.now())}>
        <Box p={[0, -0.1, 0]} s={[12, 0.2, 12]} c="#c9a27a" />
        {/* The stall behind: its cloth roof and its sign */}
        <Box p={[0, 1.2, -4.1]} s={[6.4, 2.4, 0.2]} c="#8a5a32" />
        <Box p={[0, 2.5, -3.7]} s={[6.8, 0.15, 1.2]} c="#2f9e44" />
        <Sign p={[0, 1.6, -3.95]} w={3.4} text={t('MARCHÉ')} bg="#fab005" fg="#3d2b1f" />
        {Array.from({ length: HOLES }, (_, i) => (
          <Basket key={i} i={i} up={ups[i]} hit={hits?.i === i ? hits : null} />
        ))}
      </Stage3D>
      <Hud title={t('Trouver Grigri')} left={left} done={`${got}/${GOAL}`} />
      <div className="pointer-events-none absolute inset-x-0 top-16 flex justify-center">
        <div className="rounded-2xl bg-white/85 px-3 py-1.5 text-xs font-extrabold text-[#3d2b1f]">{t('Grigri : gris, collier rouge')}</div>
      </div>
      <Flash text={flash.text} at={flash.at} />
      <p className="pointer-events-none absolute inset-x-0 bottom-[max(12px,env(safe-area-inset-bottom))] text-center text-xs font-bold text-[#3d2b1f]">{t('Touche Grigri, seulement lui !')}</p>
    </div>
  )
}

/** A basket, the animal in it popping up while it's `up`, ducking back down; caught, it jumps. */
function Basket({ i, up, hit }: { i: number; up: Up | null; hit: { good: boolean; at: number } | null }) {
  const [x, z] = SPOT(i)
  const body = useRef<THREE.Group>(null)
  // The animal last up here (it stays drawn while it ducks back down).
  const [who, setWho] = useState<Who>('grigri')
  useEffect(() => {
    if (up) setWho(up.who)
  }, [up?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((_, dt) => {
    const g = body.current
    if (!g) return
    const since = hit ? (performance.now() - hit.at) / 1000 : 9
    // Up with a little overshoot, down quick; caught: a hop up and away; the wrong one hisses back down.
    const target = up ? 0.5 : -0.75
    g.position.y = ease(g.position.y, target, up ? 16 : 11, dt)
    if (since < 0.45 && hit?.good) g.position.y = 0.55 + Math.sin((since / 0.45) * Math.PI) * 0.8
    g.rotation.z = since < 0.4 && !hit?.good ? Math.sin(since * 50) * 0.25 : ease(g.rotation.z, 0, 10, dt)
    g.visible = g.position.y > -0.6
  })
  return (
    <group position={[x, 0, z]}>
      <group ref={body} position={[0, -0.7, 0]}>
        {who === 'poule' ? <Hen /> : <Cat who={who} />}
      </group>
      {/* The basket: woven strips round, its coloured band; in front of the animal */}
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.62, 0.5, 0.6, 8, 1, true]} />
        <meshLambertMaterial color="#b07a3c" flatShading side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.58, 0]}>
        <cylinderGeometry args={[0.64, 0.64, 0.08, 8, 1, true]} />
        <meshLambertMaterial color={COLORS[i % 3]} flatShading side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.57, 0.57, 0.06, 8, 1, true]} />
        <meshLambertMaterial color="#8a5a2b" flatShading side={THREE.DoubleSide} />
      </mesh>
      {/* Inside, dark: the animal hides down there */}
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 0.04, 8]} />
        <meshLambertMaterial color="#3d2412" flatShading />
      </mesh>
    </group>
  )
}

const FUR: Record<Exclude<Who, 'poule'>, string> = { grigri: '#868e96', roux: '#f08c00', noir: '#2b2f33' }
/** A market cat in blocks: its head and ears, its eyes (yellow for the black one), Grigri's red collar and bell. */
function Cat({ who }: { who: Exclude<Who, 'poule'> }) {
  const fur = FUR[who]
  const eye = who === 'noir' ? '#ffd43b' : '#c0eb75'
  return (
    <group>
      <Box p={[0, 0.05, 0]} s={[0.5, 0.5, 0.42]} c={fur} />
      <Box p={[0, 0.48, 0.05]} s={[0.52, 0.42, 0.42]} c={fur} />
      <Box p={[-0.17, 0.75, 0.05]} s={[0.13, 0.16, 0.1]} c={fur} />
      <Box p={[0.17, 0.75, 0.05]} s={[0.13, 0.16, 0.1]} c={fur} />
      <Box p={[-0.12, 0.52, 0.265]} s={[0.1, 0.1, 0.02]} c={eye} />
      <Box p={[0.12, 0.52, 0.265]} s={[0.1, 0.1, 0.02]} c={eye} />
      <Box p={[-0.12, 0.52, 0.275]} s={[0.035, 0.08, 0.01]} c="#111" />
      <Box p={[0.12, 0.52, 0.275]} s={[0.035, 0.08, 0.01]} c="#111" />
      <Box p={[0, 0.42, 0.27]} s={[0.08, 0.05, 0.02]} c="#ff8fab" />
      {who === 'grigri' && (
        <>
          <Box p={[0, 0.27, 0.06]} s={[0.54, 0.07, 0.46]} c="#e03131" />
          <Box p={[0, 0.2, 0.3]} s={[0.08, 0.08, 0.06]} c="#fab005" />
        </>
      )}
    </group>
  )
}

/** A hen in blocks: white, its red comb, its yellow beak. */
function Hen() {
  return (
    <group>
      <Box p={[0, 0.1, 0]} s={[0.5, 0.42, 0.55]} c="#f8f9fa" />
      <Box p={[0, 0.5, 0.12]} s={[0.3, 0.34, 0.3]} c="#f8f9fa" />
      <Box p={[0, 0.72, 0.12]} s={[0.08, 0.12, 0.24]} c="#e03131" />
      <Box p={[0, 0.48, 0.32]} s={[0.1, 0.07, 0.12]} c="#fab005" />
      <Box p={[0, 0.38, 0.29]} s={[0.06, 0.1, 0.04]} c="#e03131" />
      <Box p={[-0.1, 0.56, 0.275]} s={[0.05, 0.05, 0.02]} c="#111" />
      <Box p={[0.1, 0.56, 0.275]} s={[0.05, 0.05, 0.02]} c="#111" />
    </group>
  )
}
