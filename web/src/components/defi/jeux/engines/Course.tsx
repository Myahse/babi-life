import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { haptic } from '../../../../lib/native'
import { gesture } from '../../../../world3d/gesture'
import { Box } from '../../../../world3d/props'
import { Character } from '../../../../world3d/Character'
import type { Pose } from '../../../../avatar/Human'
import { DEFAULT_LOOK } from '../../Scenes'
import { Prop } from '../props'
import { Ground, JeuShell, Stage } from '../Shell'
import type { Decor, EngineProps, PropId } from '../types'

// On the move (the beach's swim, the kart, the pirogue on the lagoon, made for every action): the perso
// goes along on its ground seen from the side, the decor running by; three lanes, up or down, to gather
// the good things coming and dodge the bad ones (a stumble, a few points). Done at the target gathered.
// Under the rain (the happening « Grosse pluie »): the drops falling, and now and then the gbaka coming
// fast down a lane through the puddles: met, the big splash.

type Mode = 'pied' | 'nage' | 'pirogue' | 'kart' | 'velo'
const LANES = [-1.5, 0, 1.5]
/** Where the perso is, across. */
const PX = -1.1
const POSE: Record<Mode, Pose> = { pied: 'run', nage: 'swim', pirogue: 'sit', kart: 'sit', velo: 'sit' }
const OUCH = ['Aïe !', 'Ouille !', 'Attention !', 'Doucement !']

type Thing = { key: number; lane: number; x: number; good: boolean; hit?: number; wob: number; /** The one coming fast (the gbaka). */ rush?: boolean }
type St = { lane: number; z: number; dist: number; speed: number; next: number; key: number; got: number; hits: number; passed: number; stumble: number; t: number; done: boolean; things: Thing[]; /** When the next fast one comes. */ rushAt: number; splashes: number }
/** How much faster the fast one comes. */
const RUSH = 2.6

/** The ground running by: the decor three times over, and what stands along the back (palms, waves). */
function Scroll({ decor, st, water, rain }: { decor: Decor; st: { current: St }; water: boolean; rain?: boolean }) {
  const g = useRef<THREE.Group>(null)
  const back = useRef<THREE.Group>(null)
  useFrame(() => {
    if (g.current) g.current.position.x = -(st.current.dist % 8)
    if (back.current) back.current.position.x = -(st.current.dist % 16)
  })
  return (
    <>
      {/* The sky far off */}
      <Box p={[0, 4, -10.6]} s={[40, 14, 0.1]} c={rain ? '#7b8794' : '#9fd3f5'} />
      <group ref={g}>
        {[-8, 0, 8].map((x) =>
          [0, -7].map((z) => (
            <group key={`${x}${z}`} position={[x, 0, z]}>
              <Ground decor={decor} />
            </group>
          )),
        )}
      </group>
      <group ref={back}>
        {[-12, -6, 0, 6, 12, 18].map((x, i) => (
          <group key={x} position={[x + (i % 2) * 1.3, 0, -3.1 + (i % 2) * 0.3]} scale={water ? 1.1 : 1.8}>
            <Prop id={water ? (i % 3 ? 'vague' : 'bouee') : i % 3 ? 'palmier' : 'cocotier'} />
          </group>
        ))}
      </group>
    </>
  )
}

/** The rain: drops falling all over the run, a splash ring where each lands. */
function Rain({ st }: { st: { current: St } }) {
  const drops = useRef<(THREE.Mesh | null)[]>([])
  const seeds = useMemo(() => Array.from({ length: 46 }, (_, i) => ({ x: ((i * 37) % 46) / 46 * 12 - 6, z: ((i * 17) % 23) / 23 * 6 - 3.6, v: 7 + (i % 5), off: (i * 0.137) % 1 })), [])
  useFrame(() => {
    const t = st.current.t
    seeds.forEach((d, i) => {
      const m = drops.current[i]
      if (!m) return
      const k = (t * d.v * 0.18 + d.off) % 1
      m.position.set(d.x - ((st.current.dist * 0.5) % 1), 5 - k * 5, d.z)
    })
  })
  return (
    <>
      {seeds.map((_, i) => (
        <mesh key={i} ref={(m) => void (drops.current[i] = m)}>
          <boxGeometry args={[0.025, 0.3, 0.025]} />
          <meshLambertMaterial color="#d0ebff" transparent opacity={0.75} />
        </mesh>
      ))}
    </>
  )
}

/** The things in play: re-listed only when one comes or goes. */
function Things({ st, good, bad, rush }: { st: { current: St }; good: PropId; bad: PropId; rush?: PropId }) {
  const [list, setList] = useState<Thing[]>([])
  const sig = useRef('')
  useFrame(() => {
    const k = st.current.things.map((t) => t.key).join(',')
    if (k !== sig.current) {
      sig.current = k
      setList([...st.current.things])
    }
  })
  return (
    <>
      {list.map((th) => (
        <ThingMesh key={th.key} th={th} st={st} id={th.rush && rush ? rush : th.good ? good : bad} />
      ))}
    </>
  )
}

/** A thing coming: the good ones float and turn over a gold patch, the bad ones sit on a red one. */
function ThingMesh({ th, st, id }: { th: Thing; st: { current: St }; id: PropId }) {
  const g = useRef<THREE.Group>(null)
  const o = useRef<THREE.Group>(null)
  useFrame(() => {
    if (!g.current || !o.current) return
    const t = st.current.t
    g.current.position.set(th.x, 0, LANES[th.lane])
    // The fast one: it rolls on, bouncing a little, through what it meets.
    if (th.rush) {
      o.current.position.y = Math.abs(Math.sin(t * 14)) * 0.04
      return
    }
    if (th.hit !== undefined && th.hit >= 0) {
      // Gathered, it flies up and shrinks; knocked, it tumbles away.
      const k = Math.min(1, (t - th.hit) / 0.4)
      o.current.position.y = th.good ? 0.3 + k * 1.6 : 0.2 + Math.sin(k * Math.PI) * 0.6
      o.current.rotation.z = th.good ? 0 : -k * 2
      o.current.scale.setScalar(th.good ? Math.max(0.01, 1 - k) : 1)
      return
    }
    o.current.position.y = th.good ? 0.3 + Math.sin(t * 4 + th.wob) * 0.12 : 0
    o.current.rotation.y = th.good ? t * 2.5 + th.wob : 0
  })
  if (th.rush)
    return (
      <group ref={g} position={[th.x, 0, LANES[th.lane]]}>
        {/* Facing the way it comes (towards -x), the spray thrown up behind its wheels */}
        <group ref={o} rotation={[0, Math.PI, 0]} scale={1.25}>
          <Prop id={id} />
        </group>
        <Spray />
      </group>
    )
  return (
    <group ref={g} position={[th.x, 0, LANES[th.lane]]}>
      <Box p={[0, 0.02, 0]} s={[0.8, 0.03, 0.8]} c={th.good ? '#ffd43b' : '#e03131'} glow={0.25} />
      <group ref={o}>
        <Prop id={id} />
      </group>
    </group>
  )
}
/** The water thrown up on both sides of the fast one: drops arcing out, again and again. */
function Spray() {
  const g = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    g.current?.children.forEach((c, i) => {
      const k = (clock.elapsedTime * 2.2 + i * 0.23) % 1
      const side = i % 2 ? 1 : -1
      c.position.set(-0.4 + k * 0.9, 0.15 + Math.sin(k * Math.PI) * 0.7, side * (0.5 + k * 0.6))
      c.scale.setScalar(1.4 - k)
    })
  })
  return (
    <group ref={g}>
      {Array.from({ length: 8 }, (_, i) => (
        <group key={i}>
          <Prop id="goutte" />
        </group>
      ))}
    </group>
  )
}

/** The perso on its way (the game's own Character): running, swimming, paddling its pirogue, in its kart, on its bike. */
function Rider({ mode, st }: { mode: Mode; st: { current: St } }) {
  const g = useRef<THREE.Group>(null)
  const paddle = useRef<THREE.Group>(null)
  const [stumbling, setStumbling] = useState(false)
  useFrame((_, dt) => {
    const s = st.current
    const o = g.current
    if (!o) return
    s.z += (LANES[s.lane] - s.z) * Math.min(1, dt * 10)
    const hurt = s.t < s.stumble
    if (hurt !== stumbling) setStumbling(hurt)
    const bob = mode === 'pied' ? Math.abs(Math.sin(s.t * 9)) * 0.08 : mode === 'nage' || mode === 'pirogue' ? Math.sin(s.t * 3) * 0.05 : mode === 'kart' ? Math.sin(s.t * 30) * 0.015 : 0
    o.position.set(PX, bob, s.z)
    // Leaning into the lane change; knocked, a shake.
    o.rotation.x = (LANES[s.lane] - s.z) * 0.25 + (hurt && mode !== 'pied' ? Math.sin(s.t * 40) * 0.12 : 0)
    if (paddle.current) paddle.current.rotation.x = Math.sin(s.t * 5) * 0.8
  })
  const pose: Pose = stumbling && mode === 'pied' ? 'stumble' : POSE[mode]
  const who = <Character look={DEFAULT_LOOK} gender="homme" pose={mode === 'pied' && !stumbling ? undefined : pose} walking running speed={6} marker={false} />
  return (
    <group ref={g} position={[PX, 0, 0]}>
      {/* Facing the way it goes */}
      <group rotation={[0, Math.PI / 2, 0]}>
        {mode === 'pied' && who}
        {mode === 'nage' && (
          <group position={[0, 0.1, -0.95]} rotation={[Math.PI / 2, 0, 0]}>
            {who}
          </group>
        )}
        {mode === 'pirogue' && (
          <>
            <group position={[0, -0.05, 0]}>{who}</group>
            {/* The paddle, dipping on the near side */}
            <group ref={paddle} position={[-0.55, 0.95, 0.15]} rotation={[0, 0, -0.5]}>
              <Box p={[0, -0.35, 0]} s={[0.05, 1.3, 0.05]} c="#8a5a32" />
              <Box p={[0, -1.0, 0]} s={[0.06, 0.4, 0.2]} c="#a0703f" />
            </group>
          </>
        )}
        {mode === 'kart' && (
          <>
            <group scale={1.9}>
              <Prop id="kart" />
            </group>
            <group position={[0, -0.12, -0.2]}>{who}</group>
          </>
        )}
        {mode === 'velo' && <group position={[0, 0.4, -0.05]}>{who}</group>}
      </group>
      {/* The pirogue and the bike are made lying along x */}
      {mode === 'pirogue' && (
        <group scale={1.9}>
          <Prop id="pirogue" />
        </group>
      )}
      {mode === 'velo' && (
        <group scale={1.6}>
          <Prop id="velo" />
        </group>
      )}
    </group>
  )
}

/** The way going on: the things come, and are met. */
function Loop({ step }: { step: { current: (dt: number) => void } }) {
  useFrame((_, dt) => step.current(Math.min(0.06, dt)))
  return null
}

export function Course({ jeu, onEnd }: EngineProps<'course'>) {
  const target = jeu.target ?? 15
  const mode = jeu.mode
  const st = useRef<St>({ lane: 1, z: 0, dist: 0, speed: 3.2, next: 3, key: 0, got: 0, hits: 0, passed: 0, stumble: 0, t: 0, done: false, things: [], rushAt: 4, splashes: 0 })
  const [said, setSaid] = useState<string | null>(null)
  const [, redraw] = useState(0)
  const sayT = useRef<ReturnType<typeof setTimeout>>(undefined)
  const say = (w: string, ms = 900) => {
    setSaid(w)
    clearTimeout(sayT.current)
    sayT.current = setTimeout(() => setSaid(null), ms)
  }
  const finish = useRef(onEnd)
  finish.current = onEnd
  useEffect(() => gesture(POSE[mode], 4000), [mode])
  const step = useRef((dt: number) => {
    void dt
  })
  step.current = (dt: number) => {
    const s = st.current
    s.t += dt
    if (s.done) {
      s.dist += dt * s.speed * 0.5
      return
    }
    // Slowed down a moment after a knock.
    const v = s.t < s.stumble ? s.speed * 0.4 : s.speed
    s.dist += v * dt
    // A row now and then: one or two things, never the three lanes blocked.
    if (s.dist >= s.next) {
      s.next = s.dist + 2 + Math.random() * 1.2
      const lanes = [0, 1, 2].sort(() => Math.random() - 0.5)
      const n = Math.random() < 0.35 ? 2 : 1
      const bads = Math.min(1 + Math.floor(s.got / 6), 2)
      for (let i = 0; i < n; i++) {
        // An easy start: the first ones all good.
        const good = s.key < 4 || (i === 0 ? Math.random() < 0.62 : Math.random() < 0.5)
        if (!good && s.things.filter((t) => !t.good && t.x > 4).length >= bads) continue
        s.things.push({ key: s.key++, lane: lanes[i], x: 5 + i * 0.4, good, wob: Math.random() * 6 })
      }
    }
    // The fast one (the gbaka): now and then, down a lane, said before it comes.
    if (jeu.rush && s.t >= s.rushAt) {
      s.rushAt = s.t + 5 + Math.random() * 2.5
      s.things.push({ key: s.key++, lane: Math.floor(Math.random() * 3), x: 9, good: false, wob: 0, rush: true })
      haptic('light')
      say('Attention, un gbaka arrive !', 1400)
      redraw((k) => k + 1)
    }
    for (const th of s.things) {
      th.x -= (th.rush ? v * RUSH : v) * dt
      if (th.rush) {
        if (th.hit === undefined && Math.abs(th.x - PX) < 0.9 && Math.abs(LANES[th.lane] - s.z) < 0.7) {
          th.hit = s.t
          s.hits += 2
          s.splashes++
          s.stumble = s.t + 1.1
          haptic('error')
          gesture('stumble', 1000)
          say('Splash ! Trempé·e de la tête aux pieds…', 1400)
          redraw((k) => k + 1)
        }
        continue
      }
      if (th.hit === undefined && Math.abs(th.x - PX) < 0.55 && Math.abs(LANES[th.lane] - s.z) < 0.7) {
        th.hit = s.t
        if (th.good) {
          s.got++
          s.speed = Math.min(5.2, s.speed + 0.1)
          haptic('light')
          gesture(POSE[mode], 2500)
          const left = target - s.got
          if (left > 0 && (left <= 3 || s.got % 5 === 0)) say(left <= 3 ? `Encore ${left} !` : `${s.got}, ça avance !`)
        } else {
          s.hits++
          s.stumble = s.t + 0.8
          haptic('error')
          gesture('stumble', 800)
          say(OUCH[s.hits % OUCH.length])
        }
        redraw((k) => k + 1)
      }
      if (th.hit === undefined && th.good && th.x < PX - 0.6) {
        th.hit = -99
        s.passed++
      }
    }
    s.things = s.things.filter((th) => th.x > -6 && (th.rush || !(th.hit !== undefined && s.t - th.hit > 0.5 && th.hit !== -99)))
    if (s.got >= target) {
      s.done = true
      haptic('success')
      gesture('cheer', 2000)
      say(s.hits === 0 ? (jeu.rain ? 'À l’abri, sec comme un biscuit !' : 'Sans une égratignure !') : 'Arrivé·e !', 2000)
      const score = Math.round(100 - s.hits * 10 - Math.min(30, s.passed * 2))
      setTimeout(() => finish.current(Math.max(10, Math.min(100, score))), 1300)
    }
  }
  const move = (d: number) => {
    const s = st.current
    if (s.done) return
    const lane = Math.max(0, Math.min(2, s.lane + d))
    if (lane !== s.lane) haptic('light')
    s.lane = lane
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        move(e.key === 'ArrowUp' ? -1 : 1)
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const s = st.current
  const water = mode === 'nage' || mode === 'pirogue'
  const btn = 'h-14 flex-1 touch-none rounded-2xl border-b-4 border-black/30 bg-[var(--color-orange)] text-[17px] font-extrabold text-white select-none active:translate-y-0.5 active:border-b-0'
  return (
    <JeuShell
      title={jeu.title}
      how={jeu.how}
      status={`${Math.min(s.got, target)}/${target} ramassés${s.hits ? ` · ${s.hits} choc${s.hits > 1 ? 's' : ''}` : ''}`}
      said={said}
      controls={
        <>
          <button className={btn} onPointerDown={(e) => (e.preventDefault(), move(-1))}>
            ▲ Haut
          </button>
          <button className={btn} onPointerDown={(e) => (e.preventDefault(), move(1))}>
            ▼ Bas
          </button>
        </>
      }
    >
      {/* A tap on the upper half: up a lane; on the lower half: down */}
      <div
        className="absolute inset-0 touch-none"
        onPointerDown={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          move(e.clientY - r.top < r.height / 2 ? -1 : 1)
        }}
      >
        <Stage decor="ciel" cam={[0.3, 3.6, 6.9]} look={[0.3, 0.3, -0.4]} fov={46}>
          <Loop step={step} />
          <Scroll decor={jeu.decor} st={st} water={water} rain={jeu.rain} />
          {jeu.rain && <Rain st={st} />}
          {/* The three lanes, marked on the ground */}
          {jeu.decor !== 'piste' &&
            [-0.75, 0.75].map((z) => (
              <Box key={z} p={[0, 0.012, z]} s={[16, 0.01, 0.05]} c="#ffffff" />
            ))}
          <Things st={st} good={jeu.good} bad={jeu.bad} rush={jeu.rush} />
          <Rider mode={mode} st={st} />
        </Stage>
      </div>
    </JeuShell>
  )
}

/** A game to try it on the lab page (?g=demo:course). */
export const demo: Extract<import('../types').Jeu, { engine: 'course' }> = {
  engine: 'course', title: 'La pirogue sur la lagune', how: 'Monte ou descends : ramasse les poissons, évite les cailloux.', decor: 'eau', mode: 'pirogue', good: 'poisson-vivant', bad: 'caillou', target: 15,
}
