import { memo, Suspense, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Bug, Star } from 'lucide-react'
import { haptic } from '../../lib/native'
import type { Look } from '../../lib/types'
import { sceneDpr } from '../../lib/device'
import { Character, sizeOf } from '../../world3d/Character'
import { Box, Palm, Sign } from '../../world3d/props'
import { Zzz } from '../../world3d/interior/ActionProps'
import { randomLook } from '../../avatar/options'
import { DEFAULT_LOOK } from './Scenes'
import { GestesDefi } from './Gestes'
import { t as tr, tx } from '../../lib/i18n'

// Le rêve (the update « gestes-maison »): once in bed, the night is a dream.
// The perso sleeps on a flying mattress over Abidjan by night (the Plateau's
// towers, the cathedral, the Pyramide, the lagoon and its bridge going by). A
// tap and it rises, let go and it sinks: gather the stars (a sheep jumping its
// fence is worth two) up to the dream's target, and keep clear of the
// nightmares, the giant mosquito, the CIE bill, the maître and his chicotte:
// each costs stars, and three wake you up. A good dream, a good night (the
// score is the night's: backend sims/defi.go, the « dodo »).

/** The nightmares that wake you up. */
const WAKE = 3
const GRAVITY = 1.1
const FLAP = -0.55
type Thing = { key: number; kind: 'etoile' | 'mouton' | 'moustique' | 'facture' | 'maitre'; x: number; y: number; v: number; hit?: boolean; wob: number }
const GOOD = new Set(['etoile', 'mouton'])
type State = { y: number; vy: number; key: number; good: number; bad: number; next: number; t: number; done: boolean; shift: number; started: boolean; things: Thing[] }
const NAME: Record<string, string> = { moustique: tr('Le moustique géant !'), facture: tr('La facture de la CIE !'), maitre: tr('Le maître et sa chicotte !') }

/** Where a thing of the dream stands (0..1 across the screen, 0 at the top) in the scene, at z = 0. */
function useField() {
  const { viewport, camera } = useThree()
  const v = viewport.getCurrentViewport(camera, [0, 0, 0])
  // The size of the dreamer and of the things: the mattress a quarter of the screen, never too big in landscape.
  const k = Math.min(v.width * 0.4, v.height * 0.3) / 2.4
  return { w: v.width, h: v.height, k, X: (x: number) => (x - 0.5) * v.width, Y: (y: number) => (0.5 - y) * v.height }
}

const yOf = (th: Thing, now: number) => (th.kind === 'moustique' ? th.y + Math.sin(now / 250 + th.wob) * 0.04 : th.y)

/** A star of the dream: five gold blocks round a heart, turning. */
function StarBlock() {
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <group key={i} rotation={[0, 0, (i * Math.PI * 2) / 5]}>
          <Box p={[0, 0.32, 0]} s={[0.22, 0.5, 0.18]} c="#ffd43b" glow={0.8} />
        </group>
      ))}
      <Box p={[0, 0, 0]} s={[0.36, 0.36, 0.24]} c="#ffe066" glow={0.9} />
    </>
  )
}

/** A sheep jumping its fence, to count: the wool in blocks, the black head and legs. */
function SheepBlock() {
  return (
    <>
      <Box p={[-0.5, -0.5, 0]} s={[0.08, 0.5, 0.08]} c="#a07a4a" />
      <Box p={[0.5, -0.5, 0]} s={[0.08, 0.5, 0.08]} c="#a07a4a" />
      <Box p={[0, -0.4, 0]} s={[1.1, 0.07, 0.06]} c="#a07a4a" />
      <group position={[0, 0.15, 0]} rotation={[0, 0, 0.25]}>
        <Box p={[0, 0, 0]} s={[0.7, 0.42, 0.42]} c="#f8f9fa" />
        <Box p={[-0.12, 0.2, 0]} s={[0.36, 0.14, 0.36]} c="#ffffff" />
        <Box p={[0.15, 0.18, 0.05]} s={[0.26, 0.12, 0.3]} c="#f1f3f5" />
        <Box p={[-0.45, 0.12, 0]} s={[0.24, 0.26, 0.24]} c="#2b2b2b" />
        <Box p={[-0.5, 0.2, 0.13]} s={[0.12, 0.05, 0.04]} c="#2b2b2b" />
        {[[-0.22, -0.12], [-0.22, 0.12], [0.22, -0.12], [0.22, 0.12]].map(([x, z], i) => (
          <Box key={i} p={[x, -0.32, z]} s={[0.08, 0.26, 0.08]} c="#2b2b2b" />
        ))}
      </group>
    </>
  )
}

/** The giant mosquito: the body, the sting, the red eyes, the wings beating. */
function MosquitoBlock() {
  const w = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (w.current) w.current.rotation.x = Math.sin(clock.elapsedTime * 40) * 0.6
  })
  return (
    <>
      <Box p={[0.1, 0, 0]} s={[0.6, 0.22, 0.22]} c="#343a40" />
      <Box p={[0.5, -0.04, 0]} s={[0.36, 0.14, 0.16]} c="#495057" />
      <Box p={[-0.28, 0.04, 0]} s={[0.26, 0.24, 0.24]} c="#212529" />
      <Box p={[-0.38, 0.08, 0.12]} s={[0.08, 0.08, 0.04]} c="#ff3d57" glow={1} />
      <Box p={[-0.38, 0.08, -0.12]} s={[0.08, 0.08, 0.04]} c="#ff3d57" glow={1} />
      <Box p={[-0.62, -0.06, 0]} s={[0.42, 0.03, 0.03]} c="#212529" />
      {[-0.1, 0.1, 0.3].map((x) => (
        <Box key={x} p={[x, -0.28, 0]} s={[0.03, 0.36, 0.03]} c="#212529" />
      ))}
      <group ref={w} position={[0.05, 0.12, 0]}>
        <mesh position={[0, 0.02, 0.3]}>
          <boxGeometry args={[0.36, 0.02, 0.5]} />
          <meshLambertMaterial color="#d0ebff" transparent opacity={0.65} />
        </mesh>
        <mesh position={[0, 0.02, -0.3]}>
          <boxGeometry args={[0.36, 0.02, 0.5]} />
          <meshLambertMaterial color="#d0ebff" transparent opacity={0.65} />
        </mesh>
      </group>
    </>
  )
}

/** The electricity bill: the sheet, its header, its lines, the sum in red. */
function BillBlock() {
  return (
    <group rotation={[0, 0, 0.15]}>
      <Box p={[0, 0, 0]} s={[0.8, 1.05, 0.04]} c="#fdfdfd" />
      <Sign p={[0, 0.38, 0.03]} w={0.7} text={tr('CIE')} bg="#ff922b" />
      {[0.12, -0.02, -0.16].map((y) => (
        <Box key={y} p={[-0.05, y, 0.03]} s={[0.55, 0.05, 0.01]} c="#adb5bd" />
      ))}
      <Box p={[0.15, -0.36, 0.03]} s={[0.36, 0.12, 0.01]} c="#e03131" />
    </group>
  )
}

/** The maître of the school days, the game's own perso, the chicotte up. */
function MaitreBlock() {
  const look = useMemo(() => ({ ...randomLook('homme', () => 0.37), outfit: 'chemise', outfitColor: '#c9b28f', accessory: 'glasses' }) as Look, [])
  const arm = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (arm.current) arm.current.rotation.z = -0.4 + Math.sin(clock.elapsedTime * 9) * 0.5
  })
  return (
    <group position={[0, -0.95, 0]} scale={0.85}>
      <group rotation={[0, -Math.PI / 2.6, 0]}>
        <Character look={look} gender="homme" pose="rant" marker={false} />
      </group>
      <group ref={arm} position={[-0.3, 1.45, 0.3]}>
        <Box p={[0, 0.45, 0]} s={[0.05, 0.9, 0.05]} c="#8a5a32" />
      </group>
    </group>
  )
}

const BLOCK: Record<Thing['kind'], () => ReactElement> = { etoile: StarBlock, mouton: SheepBlock, moustique: MosquitoBlock, facture: BillBlock, maitre: MaitreBlock }

/** One thing of the dream, flying across from the right. */
function ThingMesh({ th }: { th: Thing }) {
  const g = useRef<THREE.Group>(null)
  const f = useField()
  useFrame(({ clock }) => {
    const o = g.current
    if (!o) return
    o.position.set(f.X(th.x), f.Y(yOf(th, performance.now())), 0)
    o.scale.setScalar(f.k * (th.kind === 'etoile' ? 0.7 : 0.85) * (th.hit ? 0.6 : 1))
    if (th.kind === 'etoile') o.rotation.y = clock.elapsedTime * 2.5 + th.wob
    if (th.kind === 'mouton') o.position.y += Math.abs(Math.sin(clock.elapsedTime * 4 + th.wob)) * f.k * 0.25
  })
  const B = BLOCK[th.kind]
  return (
    <group ref={g}>
      <B />
    </group>
  )
}

/** The things on screen: re-listed only when one comes or goes (each moves on its own). */
function Things({ st }: { st: { current: { things: Thing[] } } }) {
  const [list, setList] = useState<Thing[]>([])
  const sig = useRef('')
  useFrame(() => {
    const now = st.current.things.map((t) => t.key).join(',')
    if (now !== sig.current) {
      sig.current = now
      setList([...st.current.things])
    }
  })
  return (
    <>
      {list.map((th) => (
        <ThingMesh key={th.key} th={th} />
      ))}
    </>
  )
}

/** The dreamer: the perso itself asleep on its flying mattress, under its blanket, the tassels flapping. */
function Dreamer({ st, look, gender, stage }: { st: { current: { y: number; vy: number } }; look: Look; gender: 'femme' | 'homme'; stage: string }) {
  const g = useRef<THREE.Group>(null)
  const f = useField()
  useFrame(() => {
    const o = g.current
    if (!o) return
    const s = st.current
    o.position.set(f.X(0.24), f.Y(s.y), 0)
    o.scale.setScalar(f.k)
    o.rotation.z += (-Math.max(-0.25, Math.min(0.25, s.vy * 0.4)) - o.rotation.z) * 0.2
    // Leant a little to the camera: the mattress's top, the perso lying on it.
    o.rotation.x = 0.75
  })
  const size = sizeOf(stage)
  return (
    <group ref={g}>
      {/* The mattress, its stripes, the gold tassels */}
      <Box p={[0, -0.18, 0]} s={[2.4, 0.3, 1.1]} c="#e9e4ff" />
      {[-0.8, -0.4, 0, 0.4, 0.8].map((x) => (
        <Box key={x} p={[x, -0.18, 0.56]} s={[0.12, 0.26, 0.01]} c="#c4bcf5" />
      ))}
      <Box p={[-1.25, -0.25, 0.5]} s={[0.12, 0.12, 0.12]} c="#ffd43b" glow={0.5} />
      <Box p={[1.25, -0.25, 0.5]} s={[0.12, 0.12, 0.12]} c="#ffd43b" glow={0.5} />
      <Box p={[-0.92, 0.04, 0]} s={[0.5, 0.16, 0.7]} c="#ffffff" />
      {/* The perso lying, head on the pillow (the game's model, its clothes) */}
      <group position={[-1.05 + 0.95 * size.top, 0.06, 0]} rotation={[0, Math.PI / 2, 0]}>
        <group rotation={[-Math.PI / 2, 0, 0]}>
          <Character look={look} gender={gender} pose="sleep" stage={stage} marker={false} />
        </group>
      </group>
      {/* The blanket over the legs */}
      <Box p={[0.62, 0.3, 0]} s={[1.1, 0.08, 0.85]} c="#4dabf7" />
      <Box p={[0.62, 0.345, 0]} s={[1.1, 0.01, 0.2]} c="#ffd43b" />
      <Zzz at={[-0.9, 0.9, 0]} />
    </group>
  )
}

/** Abidjan by night far below, going by: towers with their windows lit, the Pyramide, the cathedral's tower, palms, the lagoon and its bridge. */
function City({ st }: { st: { current: { shift: number } } }) {
  const { viewport, camera } = useThree()
  const Z = -8
  const v = viewport.getCurrentViewport(camera, [0, 0, Z])
  const H = v.height
  const u = H / 20
  const base = -H / 2 + 1.4 * u
  // One stretch of the city (in u), repeated.
  const L = 60
  const towers = useMemo(() => {
    let r = 7
    const rnd = () => ((r = (r * 9301 + 49297) % 233280), r / 233280)
    const out: { x: number; w: number; h: number; c: string }[] = []
    for (let x = 0; x < L - 4; ) {
      const w = 1.6 + rnd() * 1.6
      if (x > 20 && x < 26) {
        x = 26
        continue
      }
      out.push({ x: x + w / 2, w, h: 2 + rnd() * 4.5, c: ['#262b63', '#2d3270', '#222759'][Math.floor(rnd() * 3)] })
      x += w + 0.3 + rnd() * 0.8
    }
    return out
  }, [])
  const copies = Math.ceil(v.width / (L * u)) + 1
  const g = useRef<THREE.Group>(null)
  useFrame(() => {
    if (g.current) g.current.position.x = -v.width / 2 - ((st.current.shift * u * 0.02) % (L * u))
  })
  return (
    <group position={[0, 0, Z]}>
      {/* The lagoon */}
      <Box p={[0, base - 0.75 * u, 0]} s={[v.width * 1.2, 1.5 * u, 2 * u]} c="#1b1f4b" />
      <group ref={g}>
        {[...Array(copies)].map((_, c) => (
          <group key={c} position={[c * L * u, base, 0]} scale={u}>
            {towers.map((t, i) => (
              <group key={i}>
                <Box p={[t.x, t.h / 2, 0]} s={[t.w, t.h, 1]} c={t.c} />
                {[...Array(Math.floor(t.h / 0.9))].map((_, rr) =>
                  [...Array(Math.max(1, Math.floor(t.w / 0.7)))].map((_, cc) =>
                    (rr * 7 + cc * 3 + i) % 4 ? <Box key={`${rr}-${cc}`} p={[t.x - t.w / 2 + 0.4 + cc * 0.7, 0.5 + rr * 0.9, 0.51]} s={[0.3, 0.35, 0.02]} c="#ffd76a" glow={0.9} /> : null,
                  ),
                )}
              </group>
            ))}
            {/* The Pyramide, the cathedral's leaning tower */}
            <mesh position={[22, 1.8, 0]} rotation={[0, Math.PI / 4, 0]}>
              <coneGeometry args={[2.2, 3.6, 4]} />
              <meshLambertMaterial color="#20245a" flatShading />
            </mesh>
            <group position={[24.6, 0, 0]} rotation={[0, 0, -0.35]}>
              <Box p={[0, 3, 0]} s={[0.35, 6, 0.35]} c="#20245a" />
            </group>
            <Box p={[25.2, 0.6, 0]} s={[2.4, 1.2, 1]} c="#1d2150" />
            <Palm p={[57, 0, 0.6]} h={3.2} />
            {/* The bridge on its piers */}
            <Box p={[L / 2, -0.4, 1]} s={[L, 0.18, 0.5]} c="#3a3f7a" />
            {[...Array(10)].map((_, i) => (
              <Box key={i} p={[i * 6 + 3, -0.8, 1]} s={[0.25, 0.8, 0.25]} c="#3a3f7a" />
            ))}
          </group>
        ))}
      </group>
    </group>
  )
}

/** The night's sky: the moon, the far stars. */
function Sky() {
  const { viewport, camera } = useThree()
  const v = viewport.getCurrentViewport(camera, [0, 0, -12])
  const stars = useMemo(() => [...Array(40)].map((_, i) => [((i * 41) % 100) / 100, ((i * 67) % 70) / 100, 0.6 + (i % 3) * 0.3] as const), [])
  return (
    <group position={[0, 0, -12]}>
      <mesh position={[v.width * 0.36, v.height * 0.36, 0]}>
        <sphereGeometry args={[v.height * 0.06, 20, 20]} />
        <meshBasicMaterial color="#fff6d0" />
      </mesh>
      {stars.map(([x, y, s], i) => (
        <mesh key={i} position={[(x - 0.5) * v.width, (0.5 - y) * v.height, 0]}>
          <boxGeometry args={[0.06 * s, 0.06 * s, 0.06 * s]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}
    </group>
  )
}

/** The dream in 3D (only its props: stable, so the HUD redrawing each frame doesn't touch it). */
const Night = memo(function Night({ st, look, gender, stage }: { st: { current: State }; look: Look; gender: 'femme' | 'homme'; stage: string }) {
  return (
    <Canvas dpr={sceneDpr} camera={{ position: [0, 0, 10], fov: 50 }} gl={{ alpha: true }} style={{ position: 'absolute', inset: 0 }}>
      <hemisphereLight args={['#b9b4ff', '#2a1d5a', 1.1]} />
      <directionalLight position={[-4, 6, 8]} intensity={0.9} color="#fff3d6" />
      <Sky />
      <City st={st} />
      <Suspense fallback={null}>
        <Things st={st} />
        <Dreamer st={st} look={look} gender={gender} stage={stage} />
      </Suspense>
    </Canvas>
  )
})

export function ReveDefi({ onEnd, target = 25, look = DEFAULT_LOOK, gender = 'homme', stage = 'adulte' }: { onEnd: (score: number) => void; /** The stars to gather (a nap: fewer). */ target?: number; look?: Look; gender?: 'femme' | 'homme'; stage?: string }) {
  const st = useRef<State>({ y: 0.45, vy: 0, key: 0, good: 0, bad: 0, next: 0.6, t: 0, done: false, shift: 0, started: false, things: [] as Thing[] })
  const [, redraw] = useState(0)
  const [said, setSaid] = useState<string | null>(null)
  const finish = useRef(onEnd)
  finish.current = onEnd
  // A tap (or the space bar, the up arrow): the mattress rises.
  const flap = () => {
    const s = st.current
    s.started = true
    s.vy = FLAP
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowUp') {
        e.preventDefault()
        flap()
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const s = st.current
      if (!s.done) {
        s.shift += dt * 60
        // Floating gently until the first tap; then it sinks unless tapped.
        if (s.started) {
          s.vy = Math.min(0.9, s.vy + GRAVITY * dt)
          s.y += s.vy * dt
          if (s.y > 0.7) {
            s.y = 0.7
            s.vy = -0.2
          }
          if (s.y < 0.08) {
            s.y = 0.08
            s.vy = 0
          }
        } else s.y = 0.45 + Math.sin(now / 500) * 0.03
        s.t += dt
        s.next -= dt
        if (s.started && s.next <= 0) {
          s.next = 0.5 + Math.random() * 0.4
          const bad = Math.random() < 0.28 + s.t / 150
          const kind: Thing['kind'] = bad ? (['moustique', 'facture', 'maitre'] as const)[Math.floor(Math.random() * 3)] : Math.random() < 0.75 ? 'etoile' : 'mouton'
          s.things.push({ key: s.key++, kind, x: 1.08, y: 0.1 + Math.random() * 0.58, v: 0.26 + Math.random() * 0.1 + s.t / 260, wob: Math.random() * 6 })
        }
        for (const th of s.things) {
          th.x -= th.v * dt
          // The mosquito zigzags.
          const y = th.kind === 'moustique' ? th.y + Math.sin(now / 250 + th.wob) * 0.04 : th.y
          if (!th.hit && Math.abs(th.x - 0.24) < 0.08 && Math.abs(y - s.y) < 0.08) {
            th.hit = true
            if (GOOD.has(th.kind)) {
              s.good += th.kind === 'mouton' ? 2 : 1
              haptic('light')
            } else {
              s.bad++
              s.good = Math.max(0, s.good - 3)
              haptic('error')
              setSaid(NAME[th.kind])
              setTimeout(() => setSaid(null), 1100)
            }
          }
        }
        s.things = s.things.filter((th) => th.x > -0.1 && !(th.hit && GOOD.has(th.kind)))
        // The target reached: a good dream (quicker and calmer, better); woken up by the nightmares: a bad night.
        if (s.good >= target || s.bad >= WAKE) {
          s.done = true
          const score = s.good >= target ? 100 - s.bad * 15 - Math.max(0, s.t - target) * 1.5 : (s.good / target) * 50
          setSaid(s.bad >= WAKE ? tr('Réveillé·e en sursaut !') : tr('Quel beau rêve…'))
          setTimeout(() => finish.current(Math.max(0, Math.min(100, Math.round(score)))), 900)
        }
        redraw((n) => n + 1)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])
  const s = st.current
  return (
    <div className="absolute inset-0 touch-none overflow-hidden select-none" style={{ background: 'linear-gradient(#1a0f4a 0%, #4b2a8a 55%, #8a4fa8 80%, #2a1d5a 100%)' }} onPointerDown={(e) => (e.preventDefault(), flap())}>
      <Night st={st} look={look} gender={gender} stage={stage} />
      <div className="absolute top-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/35 px-4 py-1.5 text-[13px] font-extrabold text-white">
        <span className="flex items-center gap-1">
          <Star size={14} fill="#ffd43b" color="#ffd43b" /> {Math.min(s.good, target)}/{target}
        </span>
        <span className="flex items-center gap-1">
          <Bug size={14} color="#ff6b6b" /> {s.bad}/{WAKE}
        </span>
      </div>
      {said && <div className="absolute top-16 left-1/2 -translate-x-1/2 animate-pop rounded-2xl bg-[#ff3d57] px-4 py-2 font-display text-[16px] font-extrabold whitespace-nowrap text-white">{said}</div>}
      {/* Before the first tap: how it's played (then the sky is all the dream's) */}
      {!s.started && (
        <div className="absolute inset-x-6 top-[58%] text-center">
          <div className="font-display text-[22px] font-extrabold text-white [text-shadow:0_2px_0_rgba(0,0,0,0.4)]">{tr('Touche l’écran pour t’envoler !')}</div>
          <div className="mt-1 text-[13px] font-extrabold text-white/85">{tx('Touche pour monter, lâche pour descendre : {target} étoiles (un mouton en vaut deux). Trois cauchemars, et tu te réveilles.', { target })}</div>
        </div>
      )}
    </div>
  )
}

/** Going to bed (the gestures, each one seen), then the night dreamt: the dream counts most. A nap: a shorter dream. */
export function DodoDefi({ onEnd, nap, look, gender, scenes }: { onEnd: (score: number) => void; nap?: boolean; look?: Look; gender?: 'femme' | 'homme'; /** The lab page: the steps in little scenes of their own. */ scenes?: boolean }) {
  const [bed, setBed] = useState<number | null>(null)
  return bed === null ? <GestesDefi kind="dodo" look={look} gender={gender} scenes={scenes} onEnd={setBed} /> : <ReveDefi target={nap ? 15 : 25} look={look} gender={gender} onEnd={(dream) => onEnd(Math.round(bed * 0.25 + dream * 0.75))} />
}
