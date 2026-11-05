import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { Flash, Hud, beep, clamp, useHud, fx } from './kit'
import { Stage3D, type Finger } from './stage'
import { Box } from '../../../world3d/props'
import { Human, NoShadows } from '../../../avatar/Human'
import { lookAt, randomLook } from '../../../avatar/options'
import { MySim } from '../jeux/me'
import { t } from '../../../lib/i18n'

// « Le marathon de Pépé Yao », chapter 1 (game/epreuves.go): two laps of the track with Pépé Yao, 72,
// steady as a clock. The stadium in the game's 3D blocks: the red track and its white lanes, the grass in
// the middle, the stand; Pépé in white running his pace, and your own Sim (its real look) beside him. Left
// foot, right foot (the two halves of the screen, their pads lighting on the drum's beat): each stride on
// his beat. On the beat you keep up with him or pass him; off it you lose ground; the same foot twice, you
// stumble. And keep your breath. The same rule and score as before.

const TIME = 40
const LAPS = 2
const beatAt = (lap: number) => (lap < 1 ? 0.5 : 0.44)
const PEPE = 1 / TIME // laps a second… times LAPS below
const WINDOW = 0.13 // seconds either side of the beat that count
/** The track: its half lengths (an oval of two straights and two bends). */
const RX = 2.3
const RZ = 3.6

type S = { me: number; pepe: number; speed: number; last: '' | 'g' | 'd'; nextBeat: number; breath: number; over: boolean; now: number; hits: number; misses: number; glow: number; started: boolean }

/** A point on the track (lap 0..1 round, lane: out or in). */
function onTrack(lap: number, lane: number, out: THREE.Vector3) {
  const a = Math.PI / 2 + (lap % 1) * Math.PI * 2
  return out.set(Math.cos(a) * (RX + lane), 0, Math.sin(a) * (RZ + lane))
}

export default function MarathonYao({ onEnd }: { onEnd: (score: number) => void }) {
  const s = useRef<S>({ me: 0, pepe: 0, speed: 0.9, last: '', nextBeat: 0.8, breath: 100, over: false, now: 0, hits: 0, misses: 0, glow: 0, started: false })
  const [hud, setHud] = useHud({ left: TIME, gap: 0, breath: 100 })
  const [flash, setFlash] = useState({ text: '', at: 0 })
  const pads = useRef<HTMLDivElement>(null)
  const w = useRef(window.innerWidth)

  const tick = (dt: number) => {
    const st = s.current
    if (!st.started) return
    st.now += dt
    const now = st.now
    const left = TIME - now
    if (!st.over) {
      st.pepe = Math.min(LAPS, st.pepe + PEPE * LAPS * dt)
      st.me = Math.min(LAPS, st.me + PEPE * LAPS * st.speed * dt)
      st.speed = Math.max(0.55, st.speed - dt * 0.12)
      st.breath = Math.min(100, st.breath + dt * 6)
    }
    if (now >= st.nextBeat) {
      st.glow = 1
      if (!st.over) beep(140, 0.06, 0.08, { type: 'square' })
      st.nextBeat += beatAt(Math.floor(st.pepe))
    }
    st.glow = Math.max(0, st.glow - dt * 5)
    if (pads.current) pads.current.style.opacity = String(0.35 + st.glow * 0.65)
    if (!st.over && (left <= 0 || st.me >= LAPS || st.pepe >= LAPS)) {
      st.over = true
      const gap = st.me - st.pepe
      const won = gap >= -0.02
      setFlash({ text: won ? t('Coude à coude avec Pépé !') : t('Pépé t’a laissé sur place !'), at: Date.now() })
      if (won) fx.win()
      setTimeout(() => onEnd(Math.round(clamp(70 + gap * 300 + (st.hits / Math.max(1, st.hits + st.misses)) * 20, 5, 100))), 1100)
    }
    setHud({ left: Math.max(0, left), gap: st.me - st.pepe, breath: st.breath })
  }

  const touch = (e: Finger) => {
    const st = s.current
    if (e.kind !== 'down' || st.over || !st.started) return
    const c = st.now
    const foot = e.x < w.current / 2 ? 'g' : 'd'
    const beat = beatAt(Math.floor(st.pepe))
    const off = Math.min(Math.abs(c - (st.nextBeat - beat)), Math.abs(st.nextBeat - c))
    if (foot === st.last) {
      st.speed = Math.max(0.5, st.speed - 0.25)
      st.misses++
      beep(120, 0.2, 0.1, { type: 'sawtooth' })
      setFlash({ text: t('Même pied : tu trébuches !'), at: Date.now() })
      fx.bad(e.x, e.y)
    } else if (off <= WINDOW && st.breath > 8) {
      st.speed = Math.min(1.35, st.speed + 0.09)
      st.hits++
      st.breath -= 2
      beep(foot === 'g' ? 520 : 620, 0.05, 0.08)
      fx.burst(e.x, e.y, ['#ffd43b', '#ffffff'], 6, 110)
    } else {
      st.speed = Math.max(0.5, st.speed - 0.08)
      st.misses++
      st.breath -= 7
      fx.shake(3)
      if (st.breath < 20) setFlash({ text: t('Doucement, garde ton souffle'), at: Date.now() })
    }
    st.last = foot
  }

  return (
    <div className="absolute inset-0 select-none" ref={(el) => void (el && (w.current = el.clientWidth))}>
      <Stage3D cam={[0, 2.4, RZ + 2]} look={[0, 0.5, 0]} fov={55} bg="#74c0fc" touch={touch} onReady={() => (s.current.started = true)}>
        <Stadium />
        <Runners s={s} tick={tick} />
      </Stage3D>
      <Hud title={t('Pépé Yao')} left={hud.left} done={hud.gap >= 0 ? t('Devant !') : t('−{m} m', { m: Math.round(-hud.gap * 400) })}>
        <div className="h-3 w-14 overflow-hidden rounded-full bg-black/45">
          <div className={`h-full ${hud.breath < 30 ? 'bg-[#e03131]' : 'bg-[#69db7c]'}`} style={{ width: `${Math.round(hud.breath)}%` }} />
        </div>
      </Hud>
      {/* The two feet: left half, right half; they light on the drum's beat */}
      <div ref={pads} className="pointer-events-none absolute inset-x-3 bottom-[max(14px,env(safe-area-inset-bottom))] flex gap-3">
        {[t('Pied gauche'), t('Pied droit')].map((l) => (
          <div key={l} className="flex h-16 flex-1 items-center justify-center rounded-3xl border-4 border-white/80 bg-white/25 font-display text-sm font-extrabold text-white">
            {l}
          </div>
        ))}
      </div>
      <Flash text={flash.text} at={flash.at} />
    </div>
  )
}

/** The stadium: the grass, the red oval of the track and its lanes, the stand along one side. */
function Stadium() {
  const lanes = useMemo(() => {
    const out: { p: [number, number, number]; r: number; c: string }[] = []
    const v = new THREE.Vector3()
    for (let k = 0; k < 64; k++) {
      const lap = k / 64
      const a = Math.PI / 2 + lap * Math.PI * 2
      // The track's facing at that point (its tangent), for the blocks to follow the bend.
      const r = Math.atan2(-Math.sin(a) * RX, Math.cos(a) * RZ)
      for (const [lane, c] of [
        [0.75, '#c2410c'],
        [0, '#d9480f'],
        [-0.75, '#c2410c'],
      ] as const) {
        onTrack(lap, lane, v)
        out.push({ p: [v.x, 0.01, v.z], r, c })
      }
    }
    return out
  }, [])
  return (
    <group>
      <Box p={[0, -0.1, 0]} s={[14, 0.2, 16]} c="#2f9e44" />
      {lanes.map((l, i) => (
        <Box key={i} p={l.p} s={[0.78, 0.02, 0.45]} c={l.c} r={l.r} />
      ))}
      {/* The stand on the side */}
      {[0, 1, 2].map((k) => (
        <Box key={k} p={[RX + 2.2 + k * 0.5, 0.25 + k * 0.3, 0]} s={[0.5, 0.5 + k * 0.6, RZ * 1.6]} c={['#adb5bd', '#ced4da', '#e9ecef'][k]} />
      ))}
    </group>
  )
}

/** Pépé in white and your own Sim, running round, each on its lane, facing the way they go; the camera
 *  running just behind and above the two of them. */
function Runners({ s, tick }: { s: React.RefObject<S>; tick: (dt: number) => void }) {
  const camera = useThree((x) => x.camera)
  const mid = useMemo(() => new THREE.Vector3(), [])
  const ahead = useMemo(() => new THREE.Vector3(), [])
  const pepe = useRef<THREE.Group>(null)
  const me = useRef<THREE.Group>(null)
  const v = useMemo(() => new THREE.Vector3(), [])
  const w = useMemo(() => new THREE.Vector3(), [])
  const look = useMemo(() => {
    let k = 72
    const rnd = () => ((k = (k * 9301 + 49297) % 233280), k / 233280)
    return lookAt({ ...randomLook('homme', rnd), hair: 'short', hairColor: '#d9d9d9', outfit: 'debardeur', outfitColor: '#f8f9fa', beard: 'collier', accessory: 'none' })
  }, [])
  useFrame((_, raw) => {
    tick(Math.min(raw, 0.05))
    const st = s.current
    for (const [g, lap, lane] of [
      [pepe.current, st.pepe, 0.38],
      [me.current, st.me, -0.38],
    ] as const) {
      if (!g) continue
      onTrack(lap, lane, v)
      onTrack(lap + 0.01, lane, w)
      g.position.copy(v)
      g.rotation.y = Math.atan2(w.x - v.x, w.z - v.z)
    }
    // Behind the pair (between them, a little back along the track), looking ahead down the lane.
    const lap = (st.me + st.pepe) / 2
    onTrack(lap - 0.11, 0, mid)
    onTrack(lap + 0.06, 0, ahead)
    camera.position.lerp(mid.setY(3.4), 0.15)
    camera.lookAt(ahead.x, 0.2, ahead.z)
  })
  return (
    <group>
      <group ref={pepe} scale={0.6}>
        <NoShadows>
          <Human look={look} gender="homme" pose="run" seed={72} fitted faceId="pepe" />
        </NoShadows>
      </group>
      <group ref={me}>
        <MySim pose="run" scale={0.6} />
      </group>
    </group>
  )
}
