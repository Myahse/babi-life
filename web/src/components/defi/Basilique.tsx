import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { haptic } from '../../lib/native'
import { sceneDpr } from '../../lib/device'
import { NaveBasilique, VITRAIL_CLUES, VITRAUX, vitrailAngle, type Vitrail } from '../../world3d/interior/BasiliqueInside'
import { Character } from '../../world3d/Character'
import { randomLook } from '../../avatar/options'
import { rng } from '../../world3d/themes'
import { JuiceHud, juice, shakeRef, snd } from './jeux/juice'
import { MySim } from './jeux/me'
import type { Pose } from '../../avatar/Human'
import { t as tr } from '../../lib/i18n'

// « Visiter la basilique avec le guide » (the update « yakro-vivant », backend game/villes.go): the round
// nave of Notre-Dame de la Paix, Yamoussoukro, its benches in rings, the altar under its canopy, and all
// round under the dome the great stained-glass windows. The guide tells of one (« Cherchez la colombe de
// la paix… »): turn round the nave (drag, or the arrows) and tap that window before he moves on. Found at
// once, a point and the window lights up gold; a wrong one flashes red, and he gives another clue. The
// score: the windows found, how fast.

const ROUNDS = 6
const ROUND_TIME = 14

type Live = { yaw: number; want: number; t: number }

/** The camera in the nave, by the sanctuary, turning where the player looks. */
function Look({ live }: { live: { current: Live } }) {
  const { camera } = useThree()
  useFrame((_, dt0) => {
    const dt = Math.min(0.05, dt0)
    const l = live.current
    l.t += dt
    l.yaw += Math.atan2(Math.sin(l.want - l.yaw), Math.cos(l.want - l.yaw)) * Math.min(1, dt * 6)
    // Standing in the aisle, between the benches and the windows, facing out: turning sweeps them by.
    camera.position.set(Math.sin(l.yaw) * 13, 3.6, Math.cos(l.yaw) * 13)
    camera.lookAt(Math.sin(l.yaw) * 44, 8, Math.cos(l.yaw) * 44)
  })
  return null
}

export function BasiliqueDefi({ onEnd }: { onEnd: (score: number) => void }) {
  const order = useMemo(() => {
    const r = rng(`basilique-${Math.floor(Date.now() / 3.6e6)}`)
    const all = [...VITRAUX].sort(() => r() - 0.5)
    // The famous one always among them.
    if (!all.slice(0, ROUNDS).includes('houphouet')) all[Math.floor(r() * ROUNDS)] = 'houphouet'
    return all.slice(0, ROUNDS) as Vitrail[]
  }, [])
  const live = useRef<Live>({ yaw: 0, want: 0, t: 0 })
  const [round, setRound] = useState(0)
  const [left, setLeft] = useState(ROUND_TIME)
  const [lit, setLit] = useState<{ i: number; c: string } | null>(null)
  const [pose, setPose] = useState<Pose>('film')
  const [guidePose, setGuidePose] = useState<Pose>('talk')
  const st = useRef({ round: 0, points: 0, tries: 0, clock: ROUND_TIME, done: false, found: 0, wait: false })
  const guide = useMemo(() => ({ ...randomLook('homme', rng('guide-basilique')), outfit: 'suit', outfitColor: '#2b3a55' }), [])
  const finish = () => {
    if (st.current.done) return
    st.current.done = true
    const score = Math.round(Math.min(100, (st.current.points / ROUNDS) * 100))
    juice.finish(score, tr('{0} vitraux trouvés sur {1}', { 0: st.current.found, 1: ROUNDS }), onEnd)
  }
  const next = () => {
    st.current.wait = false
    st.current.round++
    st.current.tries = 0
    st.current.clock = ROUND_TIME
    setLit(null)
    setGuidePose('talk')
    setPose('film')
    if (st.current.round >= ROUNDS) return finish()
    setRound(st.current.round)
    snd.tick(0.6)
  }
  useEffect(() => {
    const k = setInterval(() => {
      const s = st.current
      if (s.done || s.wait) return
      s.clock -= 0.25
      setLeft(Math.max(0, Math.ceil(s.clock)))
      if (s.clock <= 0) {
        // Not found in time: the guide shows it, and moves on.
        const i = VITRAUX.indexOf(order[s.round])
        live.current.want = vitrailAngle(i)
        setLit({ i, c: '#9fd8ff' })
        s.wait = true
        juice.bad({ text: tr('Le guide vous le montre…'), soft: true })
        setTimeout(next, 1800)
      }
    }, 250)
    return () => clearInterval(k)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const tap = (i: number) => {
    const s = st.current
    if (s.done || s.wait) return
    live.current.want = vitrailAngle(i)
    if (VITRAUX[i] === order[s.round]) {
      const quick = s.clock > ROUND_TIME * 0.55
      s.points += s.tries ? 0.5 : quick ? 1 : 0.8
      s.found++
      s.wait = true
      setLit({ i, c: '#ffd36b' })
      juice.good({ text: quick && !s.tries ? tr('Bravo, du premier coup !') : tr('C’est celui-là !'), perfect: quick && !s.tries, colors: ['#ffd36b', '#2a6fd6', '#ffffff'] })
      haptic('success')
      setPose('cheer')
      setGuidePose('wave')
      setTimeout(next, 1500)
    } else {
      s.tries++
      setLit({ i, c: '#ff6b6b' })
      juice.bad({ text: tr('Non, pas celui-là…') })
      haptic('error')
      setPose('flinch')
      setTimeout(() => (setLit(null), setPose('film')), 600)
    }
  }
  // Turning: drag across, or the arrows; Enter taps the window in front.
  const drag = useRef<number | null>(null)
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const l = live.current
      const step = (Math.PI * 2) / VITRAUX.length
      if (e.key === 'ArrowLeft') (e.preventDefault(), (l.want -= step))
      if (e.key === 'ArrowRight') (e.preventDefault(), (l.want += step))
      if (e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault()
        const i = (((Math.round(l.want / step) % VITRAUX.length) + VITRAUX.length) % VITRAUX.length)
        tap(i)
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })
  if (import.meta.env.DEV) Object.assign(globalThis, { __basilique: { tap, order, st: st.current } })
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-end gap-2 p-3 pb-[max(0.75rem,var(--sab,env(safe-area-inset-bottom)))]">
      <div
        ref={shakeRef}
        className="absolute inset-0 touch-none"
        onPointerDown={(e) => (drag.current = e.clientX)}
        onPointerMove={(e) => {
          if (drag.current === null) return
          live.current.want -= (e.clientX - drag.current) * 0.007
          drag.current = e.clientX
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerLeave={() => (drag.current = null)}
      >
        <Canvas dpr={sceneDpr} camera={{ position: [0, 3.6, 13], fov: 70, near: 0.3, far: 300 }} style={{ background: '#1b1b22' }}>
          <Look live={live} />
          <NaveBasilique night={false} crowd={false} light={false} onWindow={tap} lit={lit} />
          <Guide live={live} look={guide} pose={guidePose} />
          <Me live={live} pose={pose} />
        </Canvas>
        <JuiceHud goal={tr('Trouve le vitrail que le guide décrit !')} />
      </div>
      <div className="card relative w-full max-w-[440px] px-4 py-2 text-center">
        <div className="text-[12px] font-bold text-[var(--color-ink-soft)]">{tr('Le guide · vitrail {0}/{1}', { 0: round + 1, 1: ROUNDS })}</div>
        <div className="font-display text-[16px] leading-tight font-extrabold">« {VITRAIL_CLUES[order[round]]} »</div>
        <div className="text-[12.5px] font-extrabold text-[var(--color-orange)]">{tr('{0} s · glisse pour tourner, touche le vitrail', { 0: left })}</div>
      </div>
    </div>
  )
}

/** The guide, a step ahead of the camera, turned to the windows with it. */
function Guide({ live, look, pose }: { live: { current: Live }; look: ReturnType<typeof randomLook>; pose: Pose }) {
  const g = useRef<import('three').Group>(null)
  useFrame(() => {
    const y = live.current.yaw
    if (!g.current) return
    g.current.position.set(Math.sin(y) * 19 - Math.cos(y) * 1.5, 0, Math.cos(y) * 19 + Math.sin(y) * 1.5)
    g.current.rotation.y = y + Math.PI * 0.75
  })
  return (
    <group ref={g}>
      <Character look={look} gender="homme" pose={pose} stage="adulte" />
    </group>
  )
}

/** The player's Sim, beside the camera, filming the windows. */
function Me({ live, pose }: { live: { current: Live }; pose: Pose }) {
  const g = useRef<import('three').Group>(null)
  useFrame(() => {
    const y = live.current.yaw
    if (!g.current) return
    g.current.position.set(Math.sin(y) * 16.6 + Math.cos(y) * 0.9, 0, Math.cos(y) * 16.6 - Math.sin(y) * 0.9)
    g.current.rotation.y = y
  })
  return (
    <group ref={g}>
      <MySim pose={pose} />
    </group>
  )
}
