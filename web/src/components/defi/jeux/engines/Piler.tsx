import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { haptic } from '../../../../lib/native'
import { gesture } from '../../../../world3d/gesture'
import { Box } from '../../../../world3d/props'
import { Prop } from '../props'
import { JeuShell, Stage } from '../Shell'
import { audio, juice, noise, tone } from '../juice'
import type { EngineProps, Jeu } from '../types'
import { t as tr } from '../../../../lib/i18n'

// Pound in rhythm (the foutou at the mortar, the update « cuisine-ivoire »): the pestle comes down on the
// beat, and between the strikes the helper's hand dips into the mortar to turn the dough. A ring of
// blocks closes on the mortar for each beat: white, strike as it shuts; red, the hand is coming: don't.
// Every good strike smooths the dough (its lumps melt into the ball); striking the hand is the worst
// thing one can do at a mortar. Tap anywhere (or Space).

const PERFECT = 0.075
const GOOD = 0.15
const WINDOW = 0.26
const RING = 14
/** The mortar's mouth (the dough's top), where the pestle lands. */
const MOUTH = 1.86
const UP = 2.75

type Beat = { t: number; hand: boolean; done?: 'perfect' | 'good' | 'late' | 'miss' | 'hit' }
type St = { t: number; beats: Beat[]; heard: number; smooth: number; strikes: number; sum: number; hits: number; slam: number; hand: number; over: boolean }

/** The beats: two strikes then the hand (now and then three strikes), quicker as it goes. */
function score(n: number, tempo: number): Beat[] {
  const out: Beat[] = []
  let t = 2.2
  let strikes = 0
  let run = 0
  while (strikes < n) {
    const k = strikes / n
    const beat = 60 / (tempo + k * 40)
    const hand = run >= 2 && (run >= 3 || Math.random() < 0.75)
    out.push({ t, hand })
    if (hand) run = 0
    else (strikes++, run++)
    t += beat
  }
  return out
}

/** The hand is near the mortar (from a little before its beat to a little after). No closure: read every frame. */
function handNear(s: St) {
  for (const b of s.beats) if (b.hand && s.t > b.t - 0.32 && s.t < b.t + 0.22) return true
  return false
}
/** The next beat still to play. */
function nextBeat(s: St) {
  for (const b of s.beats) if (!b.done && b.t > s.t - WINDOW) return b
  return undefined
}

const DOUGH: Record<Extract<Jeu, { engine: 'piler' }>['dough'], [string, string]> = { banane: ['#e9d9a6', '#f4e7bd'], igname: ['#efe7d6', '#fbf7ee'], graine: ['#a8360e', '#c2410c'] }

/** The dough in the mortar: a ball with lumps that melt as it's pounded; squashed by each strike. */
function Dough({ st, color }: { st: { current: St }; color: [string, string] }) {
  const ball = useRef<THREE.Group>(null)
  const lumps = useRef<(THREE.Mesh | null)[]>([])
  const mat = useMemo(() => new THREE.MeshLambertMaterial({ color: color[0], flatShading: true }), [color])
  const from = useMemo(() => new THREE.Color(color[0]), [color])
  const to = useMemo(() => new THREE.Color(color[1]), [color])
  useFrame(() => {
    const s = st.current
    const k = Math.min(1, s.smooth)
    mat.color.copy(from).lerp(to, k)
    const squash = Math.max(0, s.slam) * 0.35
    ball.current?.scale.set(1 + squash, 1 - squash, 1 + squash)
    lumps.current.forEach((m, i) => m?.scale.setScalar(Math.max(0.01, (1 - k) * (0.8 + (i % 2) * 0.3))))
  })
  return (
    <group ref={ball} position={[0, MOUTH - 0.1, 0]}>
      <mesh material={mat}>
        <boxGeometry args={[0.95, 0.42, 0.95]} />
      </mesh>
      <mesh material={mat} position={[0, 0.2, 0]}>
        <boxGeometry args={[0.7, 0.2, 0.7]} />
      </mesh>
      {[
        [0.42, 0.18, 0.2],
        [-0.38, 0.16, -0.22],
        [0.1, 0.3, -0.4],
        [-0.2, 0.22, 0.38],
      ].map((p, i) => (
        <mesh key={i} ref={(m) => void (lumps.current[i] = m)} material={mat} position={p as [number, number, number]}>
          <boxGeometry args={[0.24, 0.2, 0.24]} />
        </mesh>
      ))}
    </group>
  )
}

/** The pestle, held high, slammed down on a strike. */
function Pestle({ st }: { st: { current: St } }) {
  const g = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    const s = st.current
    s.slam = Math.max(0, s.slam - dt * 4.5)
    // Down fast on a strike (slam 1 → 0.75), then lifted back up, a sway while it waits.
    const down = s.slam > 0.75 ? 1 : s.slam / 0.75
    const y = MOUTH + 0.05 + (UP - MOUTH) * (1 - down * down)
    if (g.current) {
      g.current.position.set(-0.05 + Math.sin(s.t * 3) * 0.04 * (1 - down), y, 0)
      g.current.rotation.z = 0.06 * (1 - down)
    }
  })
  return (
    <group ref={g}>
      <group scale={1.7}>
        <Prop id="pilon" />
      </group>
    </group>
  )
}

/** The helper's arm: in from the side to turn the dough on the hand's beats, out again. */
function Hand({ st }: { st: { current: St } }) {
  const g = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    const s = st.current
    // In while a hand beat is near (from a little before to a little after it).
    const near = handNear(s)
    s.hand += ((near ? 1 : 0) - s.hand) * Math.min(1, dt * 16)
    if (g.current) g.current.position.set(2.7 - s.hand * 2.2, MOUTH + 0.25 - s.hand * 0.12, 0.1)
  })
  return (
    <group ref={g}>
      <Box p={[0.9, 0, 0]} s={[1.8, 0.24, 0.26]} c="#7a4a2a" />
      <Box p={[1.3, 0, 0]} s={[0.9, 0.3, 0.32]} c="#e64980" />
      <Box p={[-0.08, -0.06, 0]} s={[0.28, 0.2, 0.3]} c="#6b3f24" />
    </group>
  )
}

/** The ring closing on the mortar for the next beat: white to strike, red for the hand. */
function Ring({ st }: { st: { current: St } }) {
  const blocks = useRef<(THREE.Mesh | null)[]>([])
  const white = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true }), [])
  const red = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ff3d57', transparent: true }), [])
  useFrame(() => {
    const s = st.current
    const next = nextBeat(s)
    const left = next ? next.t - s.t : 9
    const show = !!next && left < 1.1 && !s.over
    const r = 0.75 + Math.max(0, left) * 1.5
    white.opacity = red.opacity = show ? Math.min(1, (1.1 - left) * 2) : 0
    blocks.current.forEach((m, i) => {
      if (!m) return
      m.visible = show
      m.material = next?.hand ? red : white
      const a = (i / RING) * Math.PI * 2 + s.t * 0.4
      m.position.set(Math.cos(a) * r, MOUTH + 0.18, Math.sin(a) * r)
      m.rotation.y = -a
    })
  })
  return (
    <>
      {[...Array(RING)].map((_, i) => (
        <mesh key={i} ref={(m) => void (blocks.current[i] = m)} material={white}>
          <boxGeometry args={[0.2, 0.06, 0.08]} />
        </mesh>
      ))}
    </>
  )
}

/** The clock: the beats heard (a soft knock to keep time; the helper's « han ! » on hers), the misses. */
function Clock({ st, onMiss, onDone }: { st: { current: St }; onMiss: (b: Beat) => void; onDone: () => void }) {
  useFrame((_, dt0) => {
    const s = st.current
    if (s.over) return
    s.t += juice.dt(Math.min(0.05, dt0))
    const c = audio()
    while (s.heard < s.beats.length && s.beats[s.heard].t <= s.t + 0.02) {
      const b = s.beats[s.heard++]
      if (c) {
        if (b.hand) noise(c.currentTime, 0.06, 700, 2, 0.08)
        else tone(c.currentTime, 220, 0.05, 0.035, 'triangle')
      }
    }
    for (const b of s.beats) {
      if (!b.done && s.t > b.t + WINDOW) {
        b.done = b.hand ? 'perfect' : 'miss'
        if (!b.hand) onMiss(b)
      }
    }
    if (s.heard >= s.beats.length && !nextBeat(s) && s.t > s.beats[s.beats.length - 1].t + WINDOW) {
      s.over = true
      onDone()
    }
  })
  return null
}

export function Piler({ jeu, onEnd }: EngineProps<'piler'>) {
  const n = jeu.strikes ?? 16
  const st = useRef<St>({ t: 0, beats: score(n, jeu.tempo ?? 84), heard: 0, smooth: 0, strikes: 0, sum: 0, hits: 0, slam: 0, hand: 0, over: false })
  const [said, setSaid] = useState<string | null>(null)
  const [done, setDone] = useState(0)
  const say = (s: string) => {
    setSaid(s)
    setTimeout(() => setSaid((v) => (v === s ? null : v)), 900)
  }
  const at: [number, number, number] = [0, MOUTH + 0.4, 0.4]
  const strike = () => {
    const s = st.current
    if (s.over || s.t < 1) return
    s.slam = 1
    const c = audio()
    if (c) {
      tone(c.currentTime, 95, 0.16, 0.24, 'sine', 48)
      noise(c.currentTime, 0.05, 420, 1, 0.16)
    }
    gesture('cook', 600)
    const b = s.beats.filter((x) => !x.done && Math.abs(x.t - s.t) < WINDOW).sort((x, y) => Math.abs(x.t - s.t) - Math.abs(y.t - s.t))[0]
    if (!b) {
      haptic('light')
      juice.bad({ at, text: tr('Pas en rythme'), soft: true })
      s.sum -= 0.15
      return
    }
    if (b.hand) {
      b.done = 'hit'
      s.hits++
      juice.bad({ at: [0.6, MOUTH + 0.3, 0.3], text: tr('Aïe ! La main de {helper} !', { helper: jeu.helper }) })
      say(tr('On ne pile pas sur la main !'))
      return
    }
    const off = Math.abs(b.t - s.t)
    const q = off < PERFECT ? 1 : off < GOOD ? 0.7 : 0.35
    b.done = q === 1 ? 'perfect' : q > 0.5 ? 'good' : 'late'
    s.sum += q
    s.strikes++
    s.smooth = s.strikes / n
    setDone(s.strikes)
    juice.stop(q === 1 ? 50 : 25)
    const dough = DOUGH[jeu.dough]
    if (q > 0.5) juice.good({ at, perfect: q === 1, text: q === 1 ? tr('Pam !') : tr('Bien !'), colors: [dough[0], dough[1], '#ffffff'], n: q === 1 ? 12 : 7 })
    else juice.bad({ at, text: b.t > s.t ? tr('Un peu tôt') : tr('Un peu tard'), soft: true })
  }
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return
      e.preventDefault()
      strike()
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  })
  const finish = () => {
    const s = st.current
    const sc = Math.max(5, Math.min(100, Math.round((s.sum / n) * 100 - s.hits * 12)))
    gesture('cheer', 1500)
    juice.finish(sc, s.hits ? tr('Le foutou est pilé… la tantie souffle sur sa main.') : sc >= 85 ? tr('Un foutou lisse comme un œuf !') : tr('Le foutou est pilé.'), onEnd)
  }
  return (
    <JeuShell
      title={jeu.title}
      how={jeu.how}
      goal={tr('Pile au blanc, attends au rouge !')}
      status={tr('{done}/{n} coups de pilon', { done, n })}
      said={said}
      controls={
        <button className="btn flex-1 touch-none !py-4 text-[17px] select-none" onPointerDown={(e) => (e.preventDefault(), strike())} onContextMenu={(e) => e.preventDefault()}>
          {tr('Piler !')}
        </button>
      }
    >
      <div className="absolute inset-0 touch-none" onPointerDown={(e) => (e.preventDefault(), strike())} onContextMenu={(e) => e.preventDefault()}>
        <Stage decor={jeu.decor} cam={[0, 5.4, 6.4]} look={[0, 2.25, 0]} fov={46}>
          <group scale={3}>
            <Prop id="mortier" />
          </group>
          <Dough st={st} color={DOUGH[jeu.dough]} />
          <Ring st={st} />
          <Pestle st={st} />
          <Hand st={st} />
          <Clock st={st} onMiss={() => (juice.bad({ at, text: tr('Raté !'), soft: true }), haptic('light'))} onDone={finish} />
        </Stage>
      </div>
    </JeuShell>
  )
}

/** A game to try it on the lab page (?g=demo:piler). */
export const demo: Extract<Jeu, { engine: 'piler' }> = { engine: 'piler', title: tr('Le foutou au mortier'), how: tr('Pile quand le cercle blanc se ferme, retiens-toi quand il est rouge : la main de la tantie tourne la pâte.'), decor: 'terre', dough: 'banane', helper: tr('la tantie') }
