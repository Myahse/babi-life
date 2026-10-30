import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { haptic } from '../../../../lib/native'
import { gesture } from '../../../../world3d/gesture'
import { Box } from '../../../../world3d/props'
import { Character } from '../../../../world3d/Character'
import { DEFAULT_LOOK } from '../../Scenes'
import { Prop } from '../props'
import { Ground, JeuShell, Stage } from '../Shell'
import type { Decor, EngineProps, PropId } from '../types'
import { t } from '../../../../lib/i18n'

// Carry it steady (the bricks on the site, the basin on the head to the market, made for every action):
// the perso walks on, seen from behind, the load on its head, Ivorian style (or pushed before it, the
// barrow); it leans, more and more, to one side or the other: push it back. Too far, it tips: put it
// back, and on you go, a little lost. Done at the end of the way.

/** Pushed before, on the ground (the others go on the head). */
const PUSHED = new Set<PropId>(['brouette', 'chariot', 'velo', 'kart'])
/** Past this it tips. */
const MAX = 1
const WARN = 0.62
const PUSH = 0.85
/** Metres to the scene's units. */
const M = 1.4

type St = { t: number; walked: number; lean: number; v: number; drift: number; nextDrift: number; fell: number; falls: number; steady: number; total: number; warned: number; done: boolean }

/** The way under the feet: the decor laid on and on, coming at the camera; palms (or posts) along it. */
function Way({ decor, st }: { decor: Decor; st: { current: St } }) {
  const g = useRef<THREE.Group>(null)
  const side = useRef<THREE.Group>(null)
  useFrame(() => {
    const z = st.current.walked * M
    if (g.current) g.current.position.z = z % 7
    if (side.current) side.current.position.z = z % 8
  })
  const indoors = decor === 'carrelage' || decor === 'parquet'
  return (
    <>
      <group ref={g}>
        {[-42, -35, -28, -21, -14, -7, 0, 7].map((z) =>
          [-8, 0, 8].map((x) => (
            <group key={`${z}${x}`} position={[x, 0, z]}>
              <Ground decor={decor} />
            </group>
          )),
        )}
      </group>
      <group ref={side}>
        {[-32, -24, -16, -8, 0, 8].map((z) =>
          [-1, 1].map((sx) => (
            <group key={`${z}${sx}`} position={[sx * 3.4, 0, z + (sx > 0 ? 4 : 0)]} scale={indoors ? 1.2 : 2}>
              <Prop id={indoors ? 'plante' : sx > 0 ? 'palmier' : 'cocotier'} />
            </group>
          )),
        )}
      </group>
    </>
  )
}

/** The end of the way: two posts and the banner across, coming nearer. */
function Finish({ st, distance }: { st: { current: St }; distance: number }) {
  const g = useRef<THREE.Group>(null)
  useFrame(() => {
    if (g.current) g.current.position.z = -(distance - st.current.walked) * M
  })
  return (
    <group ref={g} position={[0, 0, -distance * M]}>
      <Box p={[-2, 1.4, 0]} s={[0.25, 2.8, 0.25]} c="#f8f9fa" />
      <Box p={[2, 1.4, 0]} s={[0.25, 2.8, 0.25]} c="#f8f9fa" />
      <Box p={[0, 2.7, 0]} s={[4.3, 0.5, 0.1]} c="#ff7a00" glow={0.3} />
      {[-1.6, -0.8, 0, 0.8, 1.6].map((x) => (
        <Box key={x} p={[x, 2.7, 0.06]} s={[0.4, 0.5, 0.02]} c="#2f9e44" />
      ))}
    </group>
  )
}

/** The perso walking away, the load on its head (or the barrow before it) leaning as it leans; tipped, it slides off and is put back. */
function Carrier({ carry, st }: { carry: PropId; st: { current: St } }) {
  const body = useRef<THREE.Group>(null)
  const load = useRef<THREE.Group>(null)
  const pushed = PUSHED.has(carry)
  const [state, setState] = useState<'walk' | 'fall'>('walk')
  useFrame(() => {
    const s = st.current
    const fall = s.t - s.fell < 1.1
    if ((fall ? 'fall' : 'walk') !== state) setState(fall ? 'fall' : 'walk')
    const shake = Math.abs(s.lean) > WARN ? Math.sin(s.t * 38) * 0.05 * Math.abs(s.lean) : 0
    let a = -s.lean * (pushed ? 0.5 : 0.85) + shake
    let drop = 0
    if (fall) {
      // Tipped: it goes right over, slides down, then it's back up.
      const k = (s.t - s.fell) / 1.1
      const side = Math.sign(s.lean) || 1
      a = -side * (pushed ? 1.1 : 1.5) * Math.min(1, k * 4) * (k > 0.75 ? (1 - k) * 4 : 1)
      drop = pushed ? 0 : Math.min(1, k * 3) * 0.6 * (k > 0.75 ? (1 - k) * 4 : 1)
    }
    if (load.current) {
      load.current.rotation.z = a
      load.current.position.y = (pushed ? 0 : 1.86) - drop
    }
    if (body.current) body.current.rotation.z = -s.lean * 0.12
  })
  return (
    <group>
      <group ref={body}>
        <group rotation={[0, Math.PI, 0]}>
          <Character look={DEFAULT_LOOK} gender="homme" pose={state === 'fall' ? 'stumble' : pushed ? 'push' : 'walk'} walking speed={1.3} marker={false} />
        </group>
        {/* On the head: the pad (the « kata ») and the load over it */}
        {!pushed && (
          <group ref={load} position={[0, 1.86, 0]}>
            <Box p={[0, 0.03, 0]} s={[0.3, 0.06, 0.3]} c="#f08c00" />
            <group position={[0, 0.06, 0]} scale={0.85}>
              <Prop id={carry} />
            </group>
          </group>
        )}
      </group>
      {pushed && (
        <group ref={load} position={[0, 0, -0.95]}>
          <group rotation={[0, Math.PI, 0]} scale={1.3}>
            <Prop id={carry} />
          </group>
        </group>
      )}
    </group>
  )
}

/** The walk going on, the load drifting. */
function Loop({ step }: { step: { current: (dt: number) => void } }) {
  useFrame((_, dt) => step.current(Math.min(0.06, dt)))
  return null
}

export function Equilibre({ jeu, onEnd }: EngineProps<'equilibre'>) {
  const distance = jeu.distance ?? 20
  const pushed = PUSHED.has(jeu.carry)
  const st = useRef<St>({ t: 0, walked: 0, lean: 0, v: 0, drift: 0.15, nextDrift: 1.5, fell: -9, falls: 0, steady: 0, total: 0, warned: -9, done: false })
  const [said, setSaid] = useState<string | null>(null)
  const [, redraw] = useState(0)
  const shown = useRef(-1)
  const sayT = useRef<ReturnType<typeof setTimeout>>(undefined)
  const say = (w: string, ms = 1000) => {
    setSaid(w)
    clearTimeout(sayT.current)
    sayT.current = setTimeout(() => setSaid(null), ms)
  }
  const finish = useRef(onEnd)
  finish.current = onEnd
  useEffect(() => gesture(pushed ? 'push' : 'walk', 5000), [pushed])
  const step = useRef((dt: number) => void dt)
  step.current = (dt: number) => {
    const s = st.current
    s.t += dt
    if (s.done) return
    const falling = s.t - s.fell < 1.1
    const progress = s.walked / distance
    if (!falling) {
      // The drift: a push one way, then the other, harder as the way goes on; and the further it leans, the faster it goes.
      s.nextDrift -= dt
      if (s.nextDrift <= 0) {
        s.nextDrift = 1 + Math.random() * 1.6
        s.drift = (Math.random() < 0.5 ? -1 : 1) * (0.18 + progress * 0.75 + Math.random() * 0.12)
      }
      s.v += (s.drift + s.lean * 1.15) * dt
      s.v *= 1 - 0.7 * dt
      s.lean += s.v * dt
      s.total += dt
      if (Math.abs(s.lean) < 0.4) s.steady += dt
      if (Math.abs(s.lean) > WARN && s.t - s.warned > 2.2) {
        s.warned = s.t
        haptic('light')
        say(t('Ça penche !'), 800)
      }
      if (Math.abs(s.lean) >= MAX) {
        s.fell = s.t
        s.falls++
        haptic('error')
        gesture('stumble', 1000)
        say(pushed ? t('Ça bascule ! Remets-la droite…') : t('Ça tombe ! Remets-le sur la tête…'), 1300)
        redraw((k) => k + 1)
      }
      // Walking on (slower when it's leaning hard).
      s.walked += dt * (Math.abs(s.lean) > WARN ? 0.6 : 1.1)
    } else if (s.t - s.fell > 1.0) {
      s.lean = 0
      s.v = 0
    }
    if (Math.floor(s.walked) !== shown.current) {
      shown.current = Math.floor(s.walked)
      redraw((k) => k + 1)
    }
    if (s.walked >= distance) {
      s.done = true
      s.walked = distance
      haptic('success')
      gesture('cheer', 2000)
      say(s.falls === 0 ? t('Arrivé·e, rien n’est tombé !') : t('Arrivé·e !'), 2000)
      const score = Math.round(55 + 45 * (s.steady / Math.max(1, s.total)) - s.falls * 12)
      setTimeout(() => finish.current(Math.max(10, Math.min(100, score))), 1300)
    }
  }
  const push = (d: number) => {
    const s = st.current
    if (s.done || s.t - s.fell < 1.1) return
    s.v += d * PUSH
    haptic('light')
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        push(e.key === 'ArrowLeft' ? -1 : 1)
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const s = st.current
  const btn = 'h-16 flex-1 touch-none rounded-2xl border-b-4 border-black/30 bg-[var(--color-orange)] text-[28px] font-extrabold text-white select-none active:translate-y-0.5 active:border-b-0'
  return (
    <JeuShell
      title={jeu.title}
      how={jeu.how}
      status={`${jeu.verb} · ${Math.floor(s.walked)}/${distance} m${s.falls ? ` · ${s.falls} chute${s.falls > 1 ? 's' : ''}` : ''}`}
      said={said}
      controls={
        <>
          <button aria-label={t('Vers la gauche')} className={btn} onPointerDown={(e) => (e.preventDefault(), push(-1))}>
            ◀
          </button>
          <button aria-label={t('Vers la droite')} className={btn} onPointerDown={(e) => (e.preventDefault(), push(1))}>
            ▶
          </button>
        </>
      }
    >
      {/* A tap on the left half pushes it left, on the right half right */}
      <div
        className="absolute inset-0 touch-none"
        onPointerDown={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          push(e.clientX - r.left < r.width / 2 ? -1 : 1)
        }}
      >
        <Stage decor="ciel" cam={pushed ? [2.6, 3.2, 3.4] : [1.3, 3.3, 4.4]} look={pushed ? [-0.2, 0.7, -1.6] : [0, 1.4, -2.2]} fov={48}>
          <Loop step={step} />
          {/* The sky far ahead */}
          <Box p={[0, 6, -46]} s={[90, 30, 0.1]} c="#9fd3f5" />
          <Way decor={jeu.decor} st={st} />
          <Finish st={st} distance={distance} />
          <Carrier carry={jeu.carry} st={st} />
        </Stage>
      </div>
    </JeuShell>
  )
}

/** A game to try it on the lab page (?g=demo:equilibre). */
export const demo: Extract<import('../types').Jeu, { engine: 'equilibre' }> = {
  engine: 'equilibre', title: t('L’eau sur la tête'), how: t('Le seau penche : touche ◀ ou ▶ pour le redresser, jusqu’à la maison.'), decor: 'terre', carry: 'seau', verb: t('Porte le seau'), distance: 20,
}
