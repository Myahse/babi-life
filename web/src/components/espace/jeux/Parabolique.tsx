import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Box } from '../../../world3d/props'
import { JeuShell, Stage, scoreOf } from '../../defi/jeux/Shell'
import { juice, snd } from '../../defi/jeux/juice'
import { t as tr } from '../../../lib/i18n'
import { HoldButton, Suited } from './common'

// Le vol parabolique de la formation (backend game/espaceCarriere.go: module-parabolique): the training's drill,
// inside the padded cabin of the agency's training plane. Three parabolas: the pull-up (pinned to the floor),
// then twenty seconds or so of weightlessness: float to the drops of water let loose and catch them, without
// bumping the walls (padded: a bump costs points, never a bruise). (The tourists' Albatros 0G flight is the
// spaceports' own, elsewhere.)

const PARABOLAS = 3
const PULL = 3 // seconds pinned at 1.8 G
const FLOAT = 9 // seconds weightless
const DROPS = 5 // per parabola
const W = 3.1 // the cabin's half-width
const H = 3.2 // its height

type Drop = { x: number; y: number; vx: number; vy: number; got: boolean }
type Live = { x: number; y: number; vx: number; vy: number; left: boolean; right: boolean; up: boolean; phase: 'pull' | 'float'; drops: Drop[]; t: number; over: boolean; bumped: number }

function Cabin({ live }: { live: { current: Live } }) {
  const me = useRef<THREE.Group>(null)
  const drops = useRef<(THREE.Group | null)[]>([])
  useFrame(({ clock }) => {
    const l = live.current
    if (me.current) {
      me.current.position.set(l.x, l.y, 0)
      me.current.rotation.z = l.phase === 'float' ? Math.sin(clock.elapsedTime * 0.9) * 0.4 - l.vx * 0.1 : 0
    }
    drops.current.forEach((g, i) => {
      const d = l.drops[i]
      if (!g) return
      g.visible = !!d && !d.got && l.phase === 'float'
      if (d) g.position.set(d.x, d.y, 0)
    })
  })
  return (
    <group>
      {/* The padded cabin seen down its length: the floor, the walls, the ceiling, their cushions */}
      <Box p={[0, H + 0.1, -0.5]} s={[W * 2 + 0.4, 0.2, 3]} c="#dee2e6" />
      {[-1, 1].map((sx) => (
        <group key={sx}>
          <Box p={[sx * (W + 0.15), H / 2, -0.5]} s={[0.3, H, 3]} c="#e9ecef" />
          {[0.6, 1.6, 2.6].map((y) => (
            <Box key={y} p={[sx * (W - 0.02), y, -0.5]} s={[0.05, 0.8, 2.8]} c="#4dabf7" />
          ))}
        </group>
      ))}
      <Box p={[0, H / 2, -2]} s={[W * 2, H, 0.1]} c="#f8f9fa" />
      <Box p={[0, H - 0.4, -1.94]} s={[1.6, 0.4, 0.02]} c="#ff7a00" />
      <group ref={me} scale={0.7}>
        <group position={[0, -0.9, 0]}>
          <Suited pose="float" />
        </group>
      </group>
      {[...Array(DROPS)].map((_, i) => (
        <group key={i} ref={(g) => void (drops.current[i] = g)}>
          <Box p={[0, 0, 0]} s={[0.22, 0.22, 0.22]} c="#4dabf7" glow={0.35} />
          <Box p={[0.05, 0.06, 0.1]} s={[0.07, 0.07, 0.03]} c="#ffffff" />
        </group>
      ))}
    </group>
  )
}

const newDrops = (): Drop[] => [...Array(DROPS)].map(() => ({ x: (Math.random() * 2 - 1) * (W - 0.6), y: 0.8 + Math.random() * (H - 1.4), vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.3, got: false }))

export function Parabolique({ onEnd }: { id: string; onEnd: (score: number) => void }) {
  const live = useRef<Live>({ x: 0, y: 0.9, vx: 0, vy: 0, left: false, right: false, up: false, phase: 'pull', drops: newDrops(), t: 0, over: false, bumped: 0 })
  const [view, setView] = useState({ k: 0, phase: 'pull' as 'pull' | 'float', caught: 0 })
  const caught = useRef(0)
  const end = useRef(onEnd)
  end.current = onEnd
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let lastBump = 0
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const l = live.current
      if (l.over) return
      l.t += dt
      const per = PULL + FLOAT
      const k = Math.floor(l.t / per)
      if (k >= PARABOLAS) {
        l.over = true
        juice.finish(scoreOf(caught.current, PARABOLAS * DROPS, l.bumped), tr('{0} gouttes attrapées en apesanteur.', { 0: caught.current }), (x) => end.current(x))
        return
      }
      const phase = l.t - k * per < PULL ? 'pull' : 'float'
      if (phase !== l.phase) {
        l.phase = phase
        if (phase === 'float') {
          l.drops = newDrops()
          snd.whoosh(0.5)
          juice.say(tr('Apesanteur !'), [0, 2.6, 0], '#ffe066', true)
        } else juice.say(tr('Ressource : 1,8 G'), [0, 2.6, 0], '#c3fae8')
      }
      if (l.phase === 'pull') {
        // Pinned to the floor: the trainee comes back down, slowly to the middle.
        l.vx = 0
        l.vy = 0
        l.y += (0.9 - l.y) * Math.min(1, dt * 4)
        l.x += (0 - l.x) * Math.min(1, dt * 2)
      } else {
        l.vx += ((l.right ? 1 : 0) - (l.left ? 1 : 0)) * 2.4 * dt
        l.vy += (l.up ? 2.2 : -0.35) * dt
        l.vx *= Math.pow(0.6, dt)
        l.vy *= Math.pow(0.6, dt)
        l.x += l.vx * dt
        l.y += l.vy * dt
        // The padded walls: a bounce, a point lost (once in a while).
        if (Math.abs(l.x) > W - 0.45 || l.y < 0.55 || l.y > H - 0.4) {
          if (Math.abs(l.x) > W - 0.45) l.vx = -l.vx * 0.5
          if (l.y < 0.55 || l.y > H - 0.4) l.vy = -l.vy * 0.5
          l.x = Math.max(-(W - 0.45), Math.min(W - 0.45, l.x))
          l.y = Math.max(0.55, Math.min(H - 0.4, l.y))
          if (now - lastBump > 900) {
            lastBump = now
            l.bumped++
            juice.bad({ at: [l.x, l.y + 0.5, 0.5], text: tr('Boum, le coussin !'), soft: true })
          }
        }
        for (const d of l.drops) {
          if (d.got) continue
          d.x = Math.max(-(W - 0.3), Math.min(W - 0.3, d.x + d.vx * dt))
          d.y = Math.max(0.5, Math.min(H - 0.3, d.y + d.vy * dt))
          if (Math.hypot(d.x - l.x, d.y - (l.y + 0.2)) < 0.6) {
            d.got = true
            caught.current++
            juice.good({ at: [d.x, d.y + 0.3, 0.4], text: tr('Gobée !') })
          }
        }
      }
      setView({ k, phase: l.phase, caught: caught.current })
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [])
  const set = (key: 'left' | 'right' | 'up') => (on: boolean) => void (live.current[key] = on)
  return (
    <JeuShell
      title={tr('Le vol parabolique')}
      how={tr('À chaque parabole, quelques secondes d’apesanteur : pousse-toi vers les gouttes d’eau qui flottent et gobe-les, sans taper les coussins.')}
      goal={tr('3 paraboles !')}
      status={tr('Parabole {0}/{1} · {2} · {3} gouttes', { 0: view.k + 1, 1: PARABOLAS, 2: view.phase === 'float' ? tr('apesanteur') : tr('ressource'), 3: view.caught })}
      controls={
        <>
          <HoldButton onHold={set('left')}>←</HoldButton>
          <HoldButton onHold={set('up')}>↑</HoldButton>
          <HoldButton onHold={set('right')}>→</HoldButton>
        </>
      }
    >
      <Stage decor="carrelage" cam={[0, 1.9, 8.2]} look={[0, 1.6, 0]} fov={46}>
        <Cabin live={live} />
      </Stage>
    </JeuShell>
  )
}
