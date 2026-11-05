import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Flash, Hud, beep, fx, rnd, useHud } from './kit'
import { Stage3D, screenOf, type Finger } from './stage'
import { Box } from '../../../world3d/props'
import { t } from '../../../lib/i18n'

// « Le maquis maudit », chapter 4 (game/epreuves.go): Tantie Bintou's fresh fish, « garanti sans sort »,
// on the grill. The braise in the game's 3D blocks: the half-drum, its coals glowing, the grill's bars, the
// fish in blocks going from raw grey to gold to burnt black, the smoke rising in little grey cubes. When a
// side is golden (the yellow frame round it), tap to turn it (it hops and flips over); when the other side
// is, tap to serve (it flies off to the plate). Burnt, it's thrown away… and the rumour of the curse comes
// back. The same rule and score as before.

const TIME = 50
const SLOTS = 4
type Fish = { side: 0 | 1; cook: number; speed: number; burnt: boolean; served: number; flip: number } | null

const GOLD = [0.62, 0.86] // the golden window of a side
/** The fish's places on the grill. */
/** A phone held upright: the grill drawn deeper, the rows further apart, so it fills the screen. */
const TALL = typeof window !== 'undefined' && window.innerHeight > window.innerWidth * 1.2
const D = TALL ? 1.9 : 1
const SPOT = (i: number): [number, number] => [(i % 2 ? 1 : -1) * 0.8, (Math.floor(i / 2) - 0.5) * 1.5 * D]
const GRILL_Y = 0.9

const RAW = new THREE.Color('#b8c4cc')
const BROWNING = new THREE.Color('#d9a35c')
const GOLDEN = new THREE.Color('#d9902f')
const DONE = new THREE.Color('#3b2416')
const BURNT = new THREE.Color('#1a1a1a')

export default function MaquisMaudit({ onEnd }: { onEnd: (score: number) => void }) {
  const s = useRef({ fish: Array<Fish>(SLOTS).fill(null), next: 0.3, served: 0, burnt: 0, over: false, now: 0, started: false })
  const [hud, setHud] = useHud({ left: TIME, served: 0 })
  const [flash, setFlash] = useState({ text: '', at: 0 })

  const tick = (dt: number) => {
    const st = s.current
    if (!st.started) return
    st.now += dt
    const now = st.now
    const left = TIME - now
    if (!st.over && left <= 0) {
      st.over = true
      const score = Math.round(Math.max(0, Math.min(100, st.served * 9 - st.burnt * 6)))
      if (score >= 80) fx.win()
      setFlash({ text: score >= 80 ? t('Le maquis est plein !') : t('Les clients attendent encore…'), at: Date.now() })
      setTimeout(() => onEnd(score), 900)
    }
    if (!st.over && now >= st.next) {
      const free = st.fish.map((f, i) => (f ? -1 : i)).filter((i) => i >= 0)
      if (free.length) st.fish[free[Math.floor(Math.random() * free.length)]] = { side: 0, cook: 0, speed: rnd(0.11, 0.16) + now * 0.0015, burnt: false, served: 0, flip: 0 }
      st.next = now + rnd(1.5, 2.6)
    }
    for (const [i, f] of st.fish.entries()) {
      if (!f || f.served) continue
      f.cook += f.speed * dt
      if (f.cook > 1.1 && !f.burnt) {
        f.burnt = true
        st.burnt++
        const [x, z] = SPOT(i)
        const p = screenOf(x, GRILL_Y, z)
        fx.bad(p.x, p.y, t('Brûlé !'))
        beep(150, 0.35, 0.1, { type: 'sawtooth' })
      }
      if (f.burnt && f.cook > 1.5) st.fish[i] = null
    }
    setHud({ left: Math.max(0, left), served: st.served })
  }

  const touch = (e: Finger) => {
    const st = s.current
    if (e.kind !== 'down' || st.over) return
    for (const [i, f] of st.fish.entries()) {
      if (!f || f.burnt || f.served) continue
      const [x, z] = SPOT(i)
      const p = screenOf(x, GRILL_Y, z)
      const q = screenOf(x + 0.75, GRILL_Y, z)
      const reach = Math.abs(q.x - p.x)
      if (Math.abs(e.x - p.x) > reach || Math.abs(e.y - p.y) > reach * 0.6) continue
      const golden = f.cook >= GOLD[0] && f.cook < GOLD[1]
      if (!golden) {
        fx.float(f.cook < GOLD[0] ? t('Pas encore…') : t('Trop tard !'), p.x, p.y - 30, '#ffa8a8')
        beep(220, 0.08, 0.06, { type: 'square' })
        return
      }
      if (f.side === 0) {
        f.side = 1
        f.cook = 0.15
        f.flip = st.now
        beep(400, 0.1, 0.1, { type: 'triangle' })
        fx.burst(p.x, p.y, ['#ffa94d', '#ffd43b'], 8, 120)
      } else {
        f.served = st.now
        st.served++
        beep(700, 0.1, 0.12)
        beep(940, 0.15, 0.12)
        fx.good(p.x, p.y, t('Servi !'))
        setTimeout(() => {
          if (st.fish[i] === f) st.fish[i] = null
        }, 400)
      }
      return
    }
  }

  return (
    <div className="absolute inset-0 select-none">
      <Stage3D cam={TALL ? [0, 7, 2.6] : [0, 6, 4.2]} look={[0, 0.8, 0.1]} fov={40} fit={[3.8, 3.6 * D]} bg="#2b1a12" touch={touch} onReady={() => (s.current.started = true)}>
        <Grill />
        <Fishes s={s} tick={tick} />
      </Stage3D>
      <Hud title={t('Le braisé de Tantie')} left={hud.left} done={t('{n} servis', { n: hud.served })} />
      <Flash text={flash.text} at={flash.at} />
      <p className="pointer-events-none absolute inset-x-0 bottom-4 px-4 text-center text-xs font-bold text-white/80">{t('Quand le poisson est doré (cercle jaune) : touche pour retourner, puis pour servir.')}</p>
    </div>
  )
}

/** The braise: the half-drum on its legs, the coals glowing in it, the grill's bars over them. */
function Grill() {
  const coals = useRef<THREE.Group>(null)
  useFrame(() => {
    const g = coals.current
    if (!g) return
    const now = performance.now() / 1000
    g.children.forEach((m, i) => (((m as THREE.Mesh).material as THREE.MeshLambertMaterial).emissiveIntensity = 0.5 + 0.5 * Math.sin(now * 3 + i)))
  })
  const spots = useMemo(() => Array.from({ length: 26 }, (_, i) => [((i * 53) % 29) / 29 - 0.5, ((i * 97) % 31) / 31 - 0.5] as const), [])
  return (
    <group>
      <Box p={[0, -0.1, 0]} s={[10, 0.2, 10]} c="#4a2e20" />
      {/* The drum: its sides, its bottom, its legs */}
      <Box p={[0, 0.55, 0]} s={[3.4, 0.6, 3.6 * D]} c="#3a3a3a" />
      <Box p={[0, 0.86, 0]} s={[3.2, 0.04, 3.4 * D]} c="#1a1a1a" />
      {[-1.5, 1.5].map((x) => [-1.6 * D, 1.6 * D].map((z) => <Box key={`${x}${z}`} p={[x, 0.12, z]} s={[0.12, 0.25, 0.12]} c="#2b2b2b" />))}
      <group ref={coals}>
        {spots.map(([a, b], i) => (
          <mesh key={i} position={[a * 3, 0.9, b * 3.2 * D]}>
            <boxGeometry args={[0.18, 0.06, 0.18]} />
            <meshLambertMaterial color="#ff6b1a" emissive="#ff8c42" emissiveIntensity={0.8} />
          </mesh>
        ))}
      </group>
      {/* The grill's bars */}
      {Array.from({ length: 14 }, (_, i) => (
        <Box key={i} p={[-1.55 + i * 0.24, GRILL_Y + 0.02, 0]} s={[0.03, 0.03, 3.4 * D]} c="#adb5bd" />
      ))}
    </group>
  )
}

/** The fish on the grill (block fish, their colour as cooked), the golden frame, the flip, the smoke. */
function Fishes({ s, tick }: { s: React.RefObject<{ fish: Fish[]; now: number }>; tick: (dt: number) => void }) {
  const fish = useRef<(THREE.Group | null)[]>([])
  const mats = useRef<(THREE.MeshLambertMaterial | null)[]>([])
  const frames = useRef<(THREE.Mesh | null)[]>([])
  const smoke = useRef<THREE.Group>(null)
  const puffs = useRef(Array.from({ length: 16 }, () => ({ x: 0, y: -5, z: 0, a: 0 })))
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05)
    tick(dt)
    const st = s.current
    st.fish.forEach((f, i) => {
      const g = fish.current[i]
      const m = mats.current[i]
      const fr = frames.current[i]
      if (!g || !m || !fr) return
      g.visible = !!f
      fr.visible = !!f && !f.burnt && !f.served && f.cook >= GOLD[0] && f.cook < GOLD[1]
      if (!f) return
      const [x, z] = SPOT(i)
      const c = Math.min(1.2, f.cook)
      // Raw grey, browning, golden, then too dark; black when burnt.
      if (f.burnt) m.color.copy(BURNT)
      else if (c < GOLD[0]) m.color.copy(RAW).lerp(BROWNING, c / GOLD[0])
      else if (c < GOLD[1]) m.color.copy(GOLDEN)
      else m.color.copy(GOLDEN).lerp(DONE, Math.min(1, (c - GOLD[1]) / 0.3))
      // Turned: a hop and a half-turn; served: off up to the plate.
      const ft = st.now - f.flip
      const flipping = f.flip > 0 && ft < 0.35
      const up = f.served ? (st.now - f.served) * 6 : flipping ? Math.sin((ft / 0.35) * Math.PI) * 0.6 : 0
      g.position.set(x, GRILL_Y + 0.08 + up, z - (f.served ? (st.now - f.served) * 3 : 0))
      g.rotation.x = flipping ? (ft / 0.35) * Math.PI : 0
      fr.position.set(x, GRILL_Y + 0.04, z)
      ;(fr.material as THREE.MeshBasicMaterial).opacity = 0.55 + 0.35 * Math.sin(performance.now() / 120)
      // Smoke now and then, thicker when burnt.
      if (Math.random() < (f.burnt ? 0.3 : 0.08)) {
        const p = puffs.current.find((q) => q.a <= 0)
        if (p) Object.assign(p, { x: x + rnd(-0.3, 0.3), y: GRILL_Y + 0.1, z: z + rnd(-0.2, 0.2), a: f.burnt ? 1 : 0.6 })
      }
    })
    const g = smoke.current
    if (g)
      puffs.current.forEach((p, i) => {
        const m = g.children[i]
        if (p.a > 0) ((p.a -= dt * 0.5), (p.y += dt * 0.8))
        m.visible = p.a > 0
        m.position.set(p.x, p.y, p.z)
        m.scale.setScalar(0.5 + (1 - p.a) * 0.8)
      })
  })
  return (
    <group>
      {Array.from({ length: SLOTS }, (_, i) => (
        <group key={i}>
          <group ref={(el) => void (fish.current[i] = el)} visible={false}>
            {/* The body, the tail, the stripes of the grill, the eye */}
            <mesh>
              <boxGeometry args={[1.0, 0.14, 0.42]} />
              <meshLambertMaterial ref={(el) => void (mats.current[i] = el)} color="#b8c4cc" flatShading />
            </mesh>
            <Box p={[0.6, 0, 0]} s={[0.24, 0.1, 0.4]} c="#7a6a5a" />
            {[-0.2, 0, 0.2].map((x) => (
              <Box key={x} p={[x, 0.072, 0]} s={[0.05, 0.01, 0.4]} c="#2b1a12" />
            ))}
            <Box p={[-0.36, 0.075, 0.1]} s={[0.07, 0.01, 0.07]} c="#ffffff" />
          </group>
          <mesh ref={(el) => void (frames.current[i] = el)} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 0.55, 1]} visible={false}>
            <ringGeometry args={[0.6, 0.72, 4, 1, Math.PI / 4]} />
            <meshBasicMaterial color="#ffd43b" transparent opacity={0.8} />
          </mesh>
        </group>
      ))}
      <group ref={smoke}>
        {puffs.current.map((_, i) => (
          <mesh key={i} visible={false}>
            <boxGeometry args={[0.16, 0.16, 0.16]} />
            <meshLambertMaterial color="#cfcfcf" transparent opacity={0.6} />
          </mesh>
        ))}
      </group>
    </group>
  )
}
