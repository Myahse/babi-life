import { useEffect, useRef, useState } from 'react'
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
import { juice, snd } from '../juice'
import { useJeuMe } from '../me'
import type { Decor, EngineProps, Jeu, PropId } from '../types'
import { t } from '../../../../lib/i18n'

// Carry it steady (the bricks on the site, the basin on the head to the market, made for every action):
// the player's Sim walks on, seen from behind, the load on its head, Ivorian style, or in its hands
// (the tray, the flag), or pushed before it (the barrow); on the water it stands on its board, arms
// out; on the spot (the podium, the shoulders, the jab) it stands; at the hairdresser's it sits. It
// leans, more and more, to one side or the other: push it back. Too far, it tips: put it back, and on
// you go, a little lost. Done at the end of the way (or of the time, on the spot).

type Stance = NonNullable<Extract<Jeu, { engine: 'equilibre' }>['stance']>
/** Pushed before, on the ground (the others go on the head). */
const PUSHED = new Set<PropId>(['brouette', 'chariot', 'velo', 'kart', 'valise'])
/** Held before, in the hands (a tray, a flag, a bottle): leaning with them. */
const HELD = new Set<PropId>(['plateau-service', 'drapeau', 'seringue', 'appareil-photo', 'bouteille', 'telephone', 'verre', 'gateau', 'canari'])
const stanceOf = (j: Extract<Jeu, { engine: 'equilibre' }>): Stance => j.stance ?? (j.carry === 'planche-surf' || j.carry === 'corde' ? 'glisse' : PUSHED.has(j.carry) ? 'pousse' : 'tete')
/** Past this it tips. */
const MAX = 1
const WARN = 0.62
const PUSH = 0.85
/** Metres to the scene's units. */
const M = 1.4
/** The pace of a walk, m/s: the ground runs by at it, whatever the way's length. */
const WALK = 1.1

type St = { t: number; walked: number; lean: number; v: number; drift: number; nextDrift: number; fell: number; falls: number; steady: number; total: number; warned: number; done: boolean; /** Seconds held straight in a row (a word now and then). */ run: number; wasWarn: boolean }

/** The way under the feet: the decor laid on and on, coming at the camera; palms (or posts) along it. */
function Way({ decor, st, vis }: { decor: Decor; st: { current: St }; vis: number }) {
  const g = useRef<THREE.Group>(null)
  const side = useRef<THREE.Group>(null)
  useFrame(() => {
    const z = st.current.walked * vis * M
    if (g.current) g.current.position.z = z % 7
    if (side.current) side.current.position.z = z % 8
  })
  const indoors = decor === 'carrelage' || decor === 'parquet'
  const water = decor === 'eau'
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
            <group key={`${z}${sx}`} position={[sx * (water ? 4.6 : 3.4), 0, z + (sx > 0 ? 4 : 0)]} scale={indoors ? 1.2 : 2}>
              <Prop id={water ? (sx > 0 ? 'bouee' : 'vague') : indoors ? 'plante' : sx > 0 ? 'palmier' : 'cocotier'} />
            </group>
          )),
        )}
      </group>
    </>
  )
}

/** The end of the way: two posts and the banner across, coming nearer. */
function Finish({ st, distance, vis }: { st: { current: St }; distance: number; vis: number }) {
  const g = useRef<THREE.Group>(null)
  useFrame(() => {
    if (g.current) g.current.position.z = -(distance - st.current.walked) * vis * M
  })
  return (
    <group ref={g} position={[0, 0, -distance * vis * M]}>
      <Box p={[-2, 1.4, 0]} s={[0.25, 2.8, 0.25]} c="#f8f9fa" />
      <Box p={[2, 1.4, 0]} s={[0.25, 2.8, 0.25]} c="#f8f9fa" />
      <Box p={[0, 2.7, 0]} s={[4.3, 0.5, 0.1]} c="#ff7a00" glow={0.3} />
      {[-1.6, -0.8, 0, 0.8, 1.6].map((x) => (
        <Box key={x} p={[x, 2.7, 0.06]} s={[0.4, 0.5, 0.02]} c="#2f9e44" />
      ))}
    </group>
  )
}

/** The player's Sim (its look, its face), the load where it goes, all leaning as it leans; tipped, it goes over and is put back. */
function Carrier({ carry, stance, st }: { carry: PropId; stance: Stance; st: { current: St } }) {
  const me = useJeuMe()
  const body = useRef<THREE.Group>(null)
  const load = useRef<THREE.Group>(null)
  const pushed = stance === 'pousse'
  const held = HELD.has(carry) && (stance === 'tete' || stance === 'debout')
  const still = stance === 'debout' || stance === 'assis'
  const [state, setState] = useState<'walk' | 'fall'>('walk')
  useFrame(() => {
    const s = st.current
    const fall = s.t - s.fell < 1.1
    if ((fall ? 'fall' : 'walk') !== state) setState(fall ? 'fall' : 'walk')
    const shake = Math.abs(s.lean) > WARN ? Math.sin(s.t * 38) * 0.05 * Math.abs(s.lean) : 0
    let a = -s.lean * (pushed ? 0.5 : 0.85) + shake
    let drop = 0
    // The body: on the board or on the spot, it's the body itself that leans (from the feet, the seat).
    let b = -s.lean * (stance === 'glisse' || still ? 0.42 : 0.12)
    if (fall) {
      // Tipped: it goes right over, slides down, then it's back up.
      const k = (s.t - s.fell) / 1.1
      const side = Math.sign(s.lean) || 1
      const back = k > 0.75 ? (1 - k) * 4 : 1
      a = -side * (pushed ? 1.1 : 1.5) * Math.min(1, k * 4) * back
      drop = pushed ? 0 : Math.min(1, k * 3) * 0.6 * back
      if (stance === 'glisse' || still) b = -side * (stance === 'assis' ? 0.7 : 1.3) * Math.min(1, k * 3) * back
    }
    if (load.current) {
      load.current.rotation.z = a
      load.current.position.y = (pushed ? 0 : held ? 1.15 : 1.86) - drop
    }
    if (body.current) body.current.rotation.z = b
  })
  const pose: Pose = state === 'fall' ? 'stumble' : pushed ? 'push' : stance === 'glisse' ? 'airplane' : stance === 'assis' ? 'sit' : stance === 'debout' ? (carry === 'chaussure' ? 'dance' : 'idle') : 'walk'
  const who = <Character look={me?.look ?? DEFAULT_LOOK} gender={me?.gender ?? 'homme'} pose={pose} walking={!still && stance !== 'glisse'} speed={1.3} marker={false} face={{ id: 'me' }} />
  return (
    <group>
      {/* What it stands or sits on */}
      {stance === 'glisse' && (
        <group position={[0, 0.02, 0]} scale={2.2} rotation={[0, Math.PI / 2, 0]}>
          <Prop id="planche-surf" />
        </group>
      )}
      {stance === 'debout' && <Box p={[0, 0.1, 0]} s={[1.3, 0.2, 1.3]} c={carry === 'chaussure' ? '#ffd43b' : '#868e96'} />}
      {stance === 'assis' && <Box p={[0, 0.22, 0.05]} s={[0.6, 0.44, 0.6]} c="#8a5a32" />}
      <group ref={body} position={[0, stance === 'debout' ? 0.2 : stance === 'glisse' ? 0.1 : 0, 0]}>
        {/* Walking away from the camera; on the spot, facing it */}
        <group rotation={[0, still ? 0 : Math.PI, 0]}>{who}</group>
        {/* On the head: the pad (the « kata ») and the load over it; in the hands, before the chest */}
        {!pushed && stance !== 'glisse' && stance !== 'assis' && (stance !== 'debout' || held) && (
          <group ref={load} position={[0, held ? 1.15 : 1.86, held ? (still ? 0.38 : -0.38) : 0]}>
            {!held && <Box p={[0, 0.03, 0]} s={[0.3, 0.06, 0.3]} c="#f08c00" />}
            <group position={[0, 0.06, 0]} scale={held ? 0.7 : 0.85}>
              <Prop id={carry} />
            </group>
          </group>
        )}
        {/* The ski rope, from the hands to the boat out ahead */}
        {stance === 'glisse' && carry === 'corde' && <Box p={[0, 1.1, -3]} s={[0.04, 0.04, 6]} c="#fab005" />}
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
  useFrame((_, dt) => step.current(juice.dt(Math.min(0.06, dt))))
  return null
}

export function Equilibre({ jeu, onEnd }: EngineProps<'equilibre'>) {
  const distance = jeu.distance ?? 20
  const stance = stanceOf(jeu)
  const pushed = stance === 'pousse'
  const still = stance === 'debout' || stance === 'assis'
  // A game lasts 12 to 24 seconds, whatever the way's length: the long ways walked quicker.
  const secs = Math.max(12, Math.min(still ? 20 : 24, distance / WALK))
  const pace = distance / secs
  const vis = WALK / pace
  const st = useRef<St>({ t: 0, walked: 0, lean: 0, v: 0, drift: 0.15, nextDrift: 1.5, fell: -9, falls: 0, steady: 0, total: 0, warned: -9, done: false, run: 0, wasWarn: false })
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
  useEffect(() => gesture(pushed ? 'push' : still ? 'idle' : 'walk', 5000), [pushed, still])
  const loadAt: [number, number, number] = [0, still ? 1.6 : 2.2, still ? 0.3 : 0]
  const step = useRef((dt: number) => void dt)
  step.current = (dt: number) => {
    const s = st.current
    s.t += dt
    if (s.done || !dt) return
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
      if (Math.abs(s.lean) < 0.4) {
        s.steady += dt
        s.run += dt
        // Held straight a good while: said, and it counts in the streak.
        if (s.run >= 3) {
          s.run = 0
          juice.good({ at: loadAt, text: t('Bien droit !') })
        }
      } else s.run = 0
      const warn = Math.abs(s.lean) > WARN
      if (warn && s.t - s.warned > 2.2) {
        s.warned = s.t
        haptic('light')
        juice.say(t('Ça penche !'), loadAt, '#ffa94d')
      }
      // Brought back from the edge: well caught.
      if (s.wasWarn && Math.abs(s.lean) < 0.3) juice.good({ at: loadAt, text: t('Rattrapé !'), n: 6 })
      s.wasWarn = warn ? true : Math.abs(s.lean) < 0.3 ? false : s.wasWarn
      if (Math.abs(s.lean) >= MAX) {
        s.fell = s.t
        s.falls++
        s.wasWarn = false
        if (stance === 'glisse') snd.splash()
        else snd.thud(0.3)
        juice.bad({ at: loadAt, text: stance === 'glisse' ? t('Plouf !') : t('Ça tombe !') })
        gesture('stumble', 1000)
        say(pushed ? t('Ça bascule ! Remets-la droite…') : stance === 'glisse' ? t('À l’eau ! Remonte sur la planche…') : still ? t('Tu as perdu l’équilibre…') : t('Ça tombe ! Remets-le sur la tête…'), 1300)
        redraw((k) => k + 1)
      }
      // Walking on (slower when it's leaning hard).
      s.walked += dt * pace * (Math.abs(s.lean) > WARN ? 0.6 : 1)
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
      gesture('cheer', 2000)
      const score = Math.round(55 + 45 * (s.steady / Math.max(1, s.total)) - s.falls * 12)
      juice.finish(Math.max(10, Math.min(100, score)), s.falls === 0 ? (still ? t('Pas bougé d’un poil !') : t('Arrivé·e, rien n’est tombé !')) : still ? t('C’est tenu !') : t('Arrivé·e !'), finish.current)
    }
  }
  const push = (d: number) => {
    const s = st.current
    if (s.done || s.t - s.fell < 1.1) return
    s.v += d * PUSH
    haptic('light')
    snd.tap()
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
  const where = still ? `${Math.max(0, Math.ceil((distance - s.walked) / pace))} s` : `${Math.floor(s.walked)}/${distance} m`
  const cam: [number, number, number] = still ? [1.5, 2.1, 3.6] : stance === 'glisse' ? [1.6, 2.6, 4.2] : pushed ? [2.6, 3.2, 3.4] : [1.3, 3.3, 4.4]
  const look: [number, number, number] = still ? [0, 1.05, 0] : stance === 'glisse' ? [0, 1.2, -2] : pushed ? [-0.2, 0.7, -1.6] : [0, 1.4, -2.2]
  return (
    <JeuShell
      title={jeu.title}
      how={jeu.how}
      goal={t('Ça penche : touche de l’autre côté !')}
      status={`${jeu.verb} · ${where}${s.falls ? ` · ${s.falls} chute${s.falls > 1 ? 's' : ''}` : ''}`}
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
        <Stage decor="ciel" cam={cam} look={look} fov={48}>
          <Loop step={step} />
          {still ? (
            <>
              {/* On the spot: its floor, a wall behind */}
              <Ground decor={jeu.decor} />
              <Box p={[0, 3, -3.6]} s={[10, 6, 0.2]} c={jeu.decor === 'scene' ? '#2b2140' : '#e9dcc4'} />
            </>
          ) : (
            <>
              {/* The sky far ahead */}
              <Box p={[0, 6, -46]} s={[90, 30, 0.1]} c="#9fd3f5" />
              <Way decor={jeu.decor} st={st} vis={vis} />
              {stance !== 'glisse' && <Finish st={st} distance={distance} vis={vis} />}
            </>
          )}
          <Carrier carry={jeu.carry} stance={stance} st={st} />
        </Stage>
      </div>
    </JeuShell>
  )
}

/** A game to try it on the lab page (?g=demo:equilibre). */
export const demo: Extract<import('../types').Jeu, { engine: 'equilibre' }> = {
  engine: 'equilibre', title: t('L’eau sur la tête'), how: t('Le seau penche : touche ◀ ou ▶ pour le redresser, jusqu’à la maison.'), decor: 'terre', carry: 'seau', verb: t('Porte le seau'), distance: 20,
}
