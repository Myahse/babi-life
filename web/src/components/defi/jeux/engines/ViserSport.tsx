import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Pose } from '../../../../avatar/Human'
import { MySim, SIM_SCALE } from '../me'
import { Who } from '../Shell'
import type { Host, PropId } from '../types'
import { P0, TZ, arc, dirOf, type Live } from './viserArc'

// The penalty and the free throws played by the player's own Sim (the update « avatar-jeux »): at the
// ball, a few steps of run-up and the kick, the ball off the foot; at the line, the ball bounced, the
// knees bent, the shot from over the head. The keeper guesses a side; the goal, the miss, the Sim
// lives it (the knee slide, the hands on the head), the ones watching too. Only what's seen: the aim,
// the gauge, the arc and the score stay Viser's.

export type Sport = 'foot' | 'basket'
/** A ball at a goal or at a hoop: played by the Sim. */
export const sportOf = (projectile: PropId, target: PropId): Sport | undefined => (projectile === 'ballon-foot' && target === 'but' ? 'foot' : projectile === 'ballon-basket' && target === 'panier-basket' ? 'basket' : undefined)

/** The ball's radius beside the Sim (bigger than life, to be seen). */
export const BALL_R = 0.12
/** Seconds from the tap to the ball leaving: the run-up and the swing of the leg; the gather and the arms going up. */
export const WIND: Record<Sport, number> = { foot: 0.62, basket: 0.42 }
const RUN = 0.38
/** Over the Sim's shoulder, the goal or the hoop beyond. */
export const SPORT_CAM: Record<Sport, { cam: [number, number, number]; look: [number, number, number]; fov: number }> = {
  foot: { cam: [0.9, 2.05, 6.6], look: [-0.15, 0.6, -0.8], fov: 46 },
  basket: { cam: [0.9, 2.2, 6.5], look: [-0.1, 0.85, -1.0], fov: 48 },
}
/** The shooter's seed: its bounce and the ball's keep time (Human 'bounce'). */
export const SHOOTER_SEED = 7

const ease = (k: number) => k * k * (3 - 2 * k)
const v = new THREE.Vector3()
const side = new THREE.Vector3()

/** The pose, set only when it changes (a new pose starts its move over: the kick, the shot, the dive). */
function usePose(first: Pose) {
  const [pose, setPose] = useState<Pose>(first)
  const now = useRef(first)
  const set = (p: Pose) => void (now.current !== p && setPose((now.current = p)))
  return { pose, set }
}

/** The player's Sim at the ball: the kicker, the shooter. */
export function Shooter({ sport, live }: { sport: Sport; live: { current: Live } }) {
  const g = useRef<THREE.Group>(null)
  const hand = useRef<THREE.Group>(null)
  const { pose, set } = usePose(sport === 'foot' ? 'idle' : 'bounce')
  useEffect(() => {
    const l = live.current
    l.hand = hand.current
    return () => void (l.hand = null)
  }, [live])
  useFrame((_, dt0) => {
    const dt = Math.min(0.05, dt0)
    const l = live.current
    if (!g.current) return
    // Waiting, straight at the goal; the aim taken, turned to it (not swinging with the arrow).
    const a = l.phase === 'aim' ? 0 : l.a
    const ry = Math.PI - a
    const dir = dirOf(a)
    let exact = false
    if (sport === 'foot') {
      // The kicking leg's side (the rig's right, +x in its own frame), the foot behind the ball.
      side.set(Math.cos(ry), 0, -Math.sin(ry))
      const spot = new THREE.Vector3(P0.x, 0, P0.z).addScaledVector(dir, -0.3).addScaledVector(side, -0.07)
      const back = spot.clone().addScaledVector(dir, -0.95).addScaledVector(side, -0.35)
      if (l.phase === 'aim' || l.phase === 'power') {
        v.copy(back)
        set(g.current.position.distanceTo(back) > 0.12 ? 'walk' : 'idle')
      } else if (l.phase === 'fly' && l.wind < RUN) {
        // The run-up: a few quick steps to the ball.
        v.lerpVectors(back, spot, ease(l.wind / RUN))
        exact = true
        set('run')
      } else if (l.phase === 'fly' || l.flyT < 0.25) {
        // The leg swung through as the ball goes, the body carried on a little after it.
        v.copy(spot).addScaledVector(dir, Math.min(0.18, Math.max(0, l.wind - RUN) * 0.7))
        exact = true
        set('kick')
      } else if (l.hit) {
        // Goal: off on the knees, sliding, arms up.
        v.copy(spot).addScaledVector(dir, 0.18 + Math.min(0.75, (l.flyT - 0.25) * 1.6))
        exact = true
        set('kneeslide')
      } else {
        v.copy(g.current.position)
        set('despair')
      }
    } else {
      // At the line, a step behind the ball's spot.
      v.set(P0.x, 0, P0.z + 0.32)
      exact = true
      if (l.phase === 'aim' || l.phase === 'power') set('bounce')
      else if (l.phase === 'fly' || l.flyT < 0.3) set('shoot')
      else set(l.hit ? 'cheer' : 'despair')
    }
    if (exact) g.current.position.copy(v)
    else g.current.position.lerp(v, 1 - Math.exp(-6 * dt))
    g.current.rotation.y += (ry - g.current.rotation.y) * (1 - Math.exp(-10 * dt))
  })
  return (
    <group ref={g} position={[P0.x, 0, P0.z + 1]} rotation={[0, Math.PI, 0]}>
      <MySim pose={pose} scale={SIM_SCALE} seed={SHOOTER_SEED} hold={<group ref={hand} />} />
    </group>
  )
}

/** The keeper: crouched on the line, swaying; at the kick, a guess, a dive (or it stays). */
export function Keeper({ live }: { live: { current: Live } }) {
  const g = useRef<THREE.Group>(null)
  const { pose, set } = usePose('keeper')
  const d = useRef({ side: 0, done: false, t: 0 })
  useFrame(({ clock }, dt0) => {
    const dt = Math.min(0.05, dt0)
    const l = live.current
    if (!g.current) return
    const k = d.current
    if (l.phase === 'aim' || l.phase === 'power') {
      k.done = false
      k.side = 0
      set('keeper')
      g.current.position.set(l.tx + Math.sin(clock.elapsedTime * 2.2) * 0.18, 0, TZ + 0.5)
      g.current.scale.x = 1
      return
    }
    if (!k.done && (l.phase === 'after' || l.wind >= WIND.foot)) {
      // Where the ball goes, beside the keeper: in, he went the wrong way; wide, he went for it; short or over, he stays.
      k.done = true
      k.t = 0
      const rel = arc(l.a, l.d, l.end, v).x - l.tx
      k.side = l.hit ? (rel > 0.15 ? -1 : rel < -0.15 ? 1 : Math.random() < 0.5 ? -1 : 1) : Math.abs(rel) > 0.8 ? Math.sign(rel) : 0
      if (k.side) set('dive')
    }
    if (k.side) {
      // The dive goes to its own +x: turned over for the other side.
      k.t += dt
      g.current.scale.x = k.side
      g.current.position.x = l.tx + k.side * 0.65 * ease(Math.min(1, k.t / 0.35))
    }
  })
  return (
    <group ref={g} position={[0, 0, TZ + 0.5]}>
      <group scale={SIM_SCALE}>
        <Who host="guide" seed={23} pose={pose} />
      </group>
    </group>
  )
}

/** Two of the quartier watching from the side: on their toes, then up for the goal, or a hand to the face. */
export function Watchers({ sport, live }: { sport: Sport; live: { current: Live } }) {
  const [react, setReact] = useState<0 | 1 | -1>(0)
  const now = useRef(react)
  useFrame(() => {
    const l = live.current
    const r = l.phase === 'after' && l.flyT > 0.15 ? (l.hit ? 1 : -1) : 0
    if (r !== now.current) setReact((now.current = r))
  })
  const host: Host = sport === 'foot' ? 'enfant' : 'ami'
  const s = SIM_SCALE * (host === 'enfant' ? 1.25 : 1)
  const at: [number, number, number][] = sport === 'foot' ? [[-2.0, 0, -1.5], [-2.1, 0, -0.35]] : [[-2.0, 0, -1.4], [-2.15, 0, -0.2]]
  return (
    <>
      {at.map((p, i) => (
        <group key={i} position={p} rotation={[0, 0.9 + i * 0.35, 0]} scale={s}>
          <Who host={host} seed={31 + i * 7} pose={react > 0 ? 'cheer' : react < 0 ? (i ? 'facepalm' : 'shrug') : i ? 'clap' : 'idle'} />
        </group>
      ))}
    </>
  )
}
