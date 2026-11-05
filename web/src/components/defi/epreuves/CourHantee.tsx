import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Flash, Hud, beep, clamp, knock, rnd, useHud, fx } from './kit'
import { Stage3D, planeAt, screenOf, type Finger } from './stage'
import { Box } from '../../../world3d/props'
import { BlockPerson } from './people'
import { t } from '../../../lib/i18n'

// « La cour hantée », chapter 3 (game/epreuves.go): the night, the common courtyard, and something walking on
// the tin roof. Listen which side the steps are, watch where the dust falls; move the finger to light the
// roof with the torch, keep the light on it a moment: seen! Six before the battery goes. But… what is the
// ghost? (A cat, a kid.) The courtyard at night in the game's 3D blocks: the house and its corrugated tin
// roof, the doorway's lamp, the stars; the torch's round of light on the roof under the finger, what walks
// there seen only in it; the dust falling from the edge in little grey cubes. The same rule and score
// (the sizes in the scene's units, the same proportions as before).

const TIME = 45
const GOAL = 6
const HOLD = 0.55 // seconds in the beam to be seen
/** The old screen's width across the roof, and px to the scene's units; the beam's radius. */
const W = 6
const PX = W / 390
const BEAM = 62 * PX
type Who = 'chat' | 'enfant'
type Thing = { who: Who; x: number; to: number; wait: number; step: number; held: number; seen: number }
/** The roof: a slope facing you, its middle line where things walk. */
const ROOF_Y = 2.3
const ROOF_TILT = 0.5
const DUST = 14

type S = { beam: THREE.Vector3; on: boolean; thing: Thing; found: number; over: boolean; now: number; started: boolean; dust: { x: number; y: number; v: number; a: number }[] }

export default function CourHantee({ onEnd }: { onEnd: (score: number) => void }) {
  const fresh = (who: Who): Thing => ({ who, x: rnd(-0.35, 0.35) * W, to: rnd(-0.4, 0.4) * W, wait: rnd(0.3, 1), step: 0, held: 0, seen: 0 })
  const s = useRef<S>({ beam: new THREE.Vector3(), on: false, thing: fresh('chat'), found: 0, over: false, now: 0, started: false, dust: [] })
  const [hud, setHud] = useHud({ left: TIME, found: 0 })
  const [flash, setFlash] = useState({ text: '', at: 0 })
  const [who, setWho] = useState<Who>('chat')

  const tick = (dt: number) => {
    const st = s.current
    if (!st.started) return
    st.now += dt
    const now = st.now
    const th = st.thing
    const left = TIME - now
    if (!st.over && (left <= 0 || st.found >= GOAL)) {
      st.over = true
      const score = Math.round(clamp(st.found / GOAL, 0, 1) * 80 + (st.found >= GOAL ? clamp(left / TIME, 0, 1) * 20 : 0))
      setTimeout(() => onEnd(score), 900)
    }
    if (!st.over && th.seen === 0) {
      const speed = (th.who === 'chat' ? 150 : 80) * PX
      if (th.wait > 0) th.wait -= dt
      else {
        const d = th.to - th.x
        th.x += Math.sign(d) * Math.min(Math.abs(d), speed * dt)
        th.step -= dt
        if (th.step <= 0) {
          th.step = th.who === 'chat' ? 0.16 : 0.34
          knock(th.who === 'chat' ? 0.18 : 0.4, (th.x / W) * 2, th.who === 'chat' ? 1600 : 700)
          if (Math.random() < 0.6 && st.dust.length < DUST) st.dust.push({ x: th.x + rnd(-0.1, 0.1), y: ROOF_Y - 0.55, v: rnd(0.3, 0.8), a: 1 })
        }
        if (Math.abs(d) < 0.03) {
          th.to = rnd(-0.42, 0.42) * W
          th.wait = rnd(0.2, th.who === 'chat' ? 0.9 : 1.6)
        }
      }
      const inBeam = st.on && Math.hypot(st.beam.x - th.x, st.beam.y - ROOF_Y) < BEAM
      th.held = inBeam ? th.held + dt : Math.max(0, th.held - dt * 2)
      if (th.held >= HOLD) {
        th.seen = now
        st.found++
        if (th.who === 'chat') {
          beep(900, 0.25, 0.12, { type: 'triangle', to: 600 })
          beep(1100, 0.35, 0.08, { type: 'triangle', to: 700 })
        } else beep(330, 0.2, 0.12, { type: 'square', to: 220 })
        setFlash({ text: th.who === 'chat' ? t('Un chat !') : t('Un enfant !'), at: Date.now() })
        const p = screenOf(th.x, ROOF_Y, 0)
        fx.good(p.x, p.y, th.who === 'chat' ? t('Miaou !') : t('Vu !'))
        if (st.found >= GOAL) fx.win()
      }
    }
    if (th.seen && now - th.seen > 0.9 && !st.over) {
      const next = th.who === 'chat' ? 'enfant' : 'chat'
      st.thing = fresh(next)
      setWho(next)
    }
    for (const d of st.dust) ((d.y -= d.v * dt), (d.a -= dt * 0.8))
    st.dust = st.dust.filter((d) => d.a > 0)
    setHud({ left: Math.max(0, left), found: st.found })
  }

  // The finger on the roof's slope: where the torch lights.
  const roof = useMemo(() => new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0, Math.cos(ROOF_TILT), Math.sin(ROOF_TILT)), new THREE.Vector3(0, ROOF_Y, 0)), [])
  const v = useMemo(() => new THREE.Vector3(), [])
  const touch = (e: Finger) => {
    const st = s.current
    st.on = e.kind !== 'up'
    if (planeAt(e.x, e.y, roof, v)) st.beam.copy(v)
  }

  return (
    <div className="absolute inset-0 select-none">
      <Stage3D cam={[0, 1.6, 7.4]} look={[0, 1.9, 0]} fov={45} fit={[W + 0.4, 3]} bg="#0b0d1c" light={0.25} touch={touch} onReady={() => (s.current.started = true)}>
        <Courtyard />
        <Roof s={s} who={who} tick={tick} />
      </Stage3D>
      <Hud title={t('La lampe torche')} left={hud.left} done={`${hud.found}/${GOAL}`} />
      <Flash text={flash.text} at={flash.at} />
      <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-xs font-bold text-white/70">{t('Écoute les pas, suis la poussière, garde la lumière dessus')}</p>
    </div>
  )
}

/** The courtyard at night: the stars, the house's wall and door, the lamp over it, the ground. */
function Courtyard() {
  return (
    <group>
      {Array.from({ length: 30 }, (_, i) => (
        <mesh key={i} position={[((i * 97) % 100) / 100 * 10 - 5, 3.4 + ((i * 53) % 100) / 100 * 2.2, -3]}>
          <boxGeometry args={[0.04, 0.04, 0.04]} />
          <meshBasicMaterial color="#e9ecef" />
        </mesh>
      ))}
      <Box p={[0, -0.1, 1]} s={[12, 0.2, 6]} c="#2b2b33" />
      <Box p={[0, 0.9, -0.5]} s={[W + 0.6, 1.8, 0.3]} c="#4a4458" />
      <Box p={[-1.2, 0.6, -0.33]} s={[0.7, 1.2, 0.05]} c="#2b2433" />
      <Box p={[1.4, 0.95, -0.33]} s={[0.6, 0.5, 0.05]} c="#3b5a7a" />
      <mesh position={[-1.2, 1.4, -0.3]}>
        <boxGeometry args={[0.16, 0.1, 0.1]} />
        <meshLambertMaterial color="#ffd43b" emissive="#ffd43b" emissiveIntensity={0.9} />
      </mesh>
    </group>
  )
}

/** The tin roof (its ribs), the torch's round of light, what walks there (seen only in the light, or once
 *  caught), the dust falling from the edge. */
function Roof({ s, who, tick }: { s: React.RefObject<S>; who: Who; tick: (dt: number) => void }) {
  const light = useRef<THREE.Group>(null)
  const thing = useRef<THREE.Group>(null)
  const dust = useRef<THREE.Group>(null)
  useFrame((_, raw) => {
    tick(Math.min(raw, 0.05))
    const st = s.current
    const l = light.current
    if (l) {
      l.visible = st.on
      l.position.copy(st.beam)
    }
    const th = st.thing
    const g = thing.current
    if (g) {
      const lit = st.on && Math.hypot(st.beam.x - th.x, st.beam.y - ROOF_Y) < BEAM * 1.2
      g.visible = lit || th.seen > 0
      g.position.set(th.x, ROOF_Y, 0.02)
      g.rotation.y = th.to > th.x ? Math.PI / 2 : -Math.PI / 2
    }
    const d = dust.current
    if (d)
      d.children.forEach((m, i) => {
        const p = st.dust[i]
        m.visible = !!p
        if (p) m.position.set(p.x, p.y, 0.55)
      })
  })
  return (
    <group>
      {/* The slope of tin, its ribs, its edge */}
      <group position={[0, ROOF_Y, 0]} rotation={[ROOF_TILT, 0, 0]}>
        <Box p={[0, -0.02, 0]} s={[W + 0.8, 0.04, 1.4]} c="#5c6670" />
        {Array.from({ length: 22 }, (_, i) => (
          <Box key={i} p={[-W / 2 - 0.3 + i * ((W + 0.6) / 21), 0.01, 0]} s={[0.05, 0.03, 1.4]} c="#6f7a85" />
        ))}
      </group>
      <group ref={light} visible={false}>
        <mesh rotation={[ROOF_TILT - Math.PI / 2, 0, 0]} position={[0, 0.03, 0.02]}>
          <circleGeometry args={[BEAM, 20]} />
          <meshBasicMaterial color="#fff0be" transparent opacity={0.45} />
        </mesh>
      </group>
      <group ref={thing} visible={false}>
        {who === 'chat' ? (
          <group scale={0.8}>
            <Box p={[0, 0.2, 0]} s={[0.3, 0.3, 0.6]} c="#868e96" />
            <Box p={[0, 0.42, 0.3]} s={[0.3, 0.28, 0.26]} c="#868e96" />
            <Box p={[-0.09, 0.6, 0.3]} s={[0.08, 0.1, 0.06]} c="#868e96" />
            <Box p={[0.09, 0.6, 0.3]} s={[0.08, 0.1, 0.06]} c="#868e96" />
            <Box p={[-0.07, 0.45, 0.44]} s={[0.06, 0.06, 0.02]} c="#c0eb75" />
            <Box p={[0.07, 0.45, 0.44]} s={[0.06, 0.06, 0.02]} c="#c0eb75" />
            <Box p={[0, 0.4, -0.38]} s={[0.06, 0.06, 0.3]} c="#868e96" />
          </group>
        ) : (
          <group rotation={[0, Math.PI / 2, 0]}>
            <BlockPerson shirt="#f8f9fa" pants="#1864ab" skin="#6b4430" h={0.75} w={0.85} />
          </group>
        )}
      </group>
      <group ref={dust}>
        {Array.from({ length: DUST }, (_, i) => (
          <mesh key={i} visible={false}>
            <boxGeometry args={[0.04, 0.04, 0.04]} />
            <meshBasicMaterial color="#adb5bd" />
          </mesh>
        ))}
      </group>
    </group>
  )
}
