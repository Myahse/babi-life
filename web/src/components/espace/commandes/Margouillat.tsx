import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ArrowLeft, ArrowRight, Car } from 'lucide-react'
import { t as tr } from '../../../lib/i18n'
import { haptic } from '../../../lib/native'
import { snd } from '../../defi/jeux/juice'
import { B } from '../../../world3d/espace/blocs'
import { crater, noise, Sol, type Crater } from '../../../world3d/espace/Sol'
import { Terre } from '../../../world3d/espace/Terre'
import { Stars } from '../../../world3d/espace/placeholders'
import { Margouillat as Rover } from '../../../world3d/espace/Lune'
import { clamp, Frame, Hold, useTicker, type Ended } from './Frame'
import { Fused } from './Fused'
import type { GameProps } from './types'

// Le Margouillat (backend game.MargouillatJeuID, « lune-margouillat-balise »): the base's rover driven out to a
// beacon left by the last outing, between the craters (their floor holds it back, their rims throw it up: at a
// sixth of a g it flies a long way before it comes down) and the boulders (a knock, the rover bounces back, the
// time runs). The battery runs down with the throttle. Not there in time: the rover comes back to the base.

const G = 1.62
const TIME = 90
const BEACON = new THREE.Vector2(14, 104)
const CRATERS: Crater[] = [
  { x: -6, z: 26, r: 7, depth: 1.8 },
  { x: 16, z: 44, r: 9, depth: 2.2 },
  { x: -10, z: 62, r: 6, depth: 1.5 },
  { x: 22, z: 74, r: 5, depth: 1.2 },
  { x: 2, z: 86, r: 7, depth: 1.8 },
  { x: -22, z: 40, r: 10, depth: 2.4 },
  { x: 36, z: 20, r: 8, depth: 2 },
]
const ROCKS: [number, number, number][] = [
  [6, 16, 1.2], [-2, 36, 1], [8, 32, 1.4], [26, 58, 1.3], [4, 54, 1.1], [-4, 74, 1.5], [12, 66, 1], [18, 90, 1.2], [8, 96, 0.9], [-12, 50, 1.2], [28, 36, 1.4], [0, 46, 0.8],
]
const heightAt = (x: number, z: number) => CRATERS.reduce((h, c) => h + crater(c, x, z), 0) + (noise(Math.floor(x / 4), Math.floor(z / 4)) - 0.5) * 0.4

type Live = { x: number; z: number; y: number; vy: number; air: boolean; head: number; v: number; batt: number; t: number; hits: number; gas: boolean; brake: boolean; l: boolean; r: boolean; over: boolean; bumped: number }

const fresh = (): Live => ({ x: 0, z: 0, y: heightAt(0, 0), vy: 0, air: false, head: 0, v: 0, batt: 100, t: 0, hits: 0, gas: false, brake: false, l: false, r: false, over: false, bumped: 0 })
const START = BEACON.length()

function Scene({ live, onEnd }: { live: Live; onEnd: (e: Ended) => void }) {
  const rover = useRef<THREE.Group>(null)
  const arrow = useRef<THREE.Group>(null)
  const lamp = useRef<THREE.Mesh>(null)
  const dust = useRef<(THREE.Mesh | null)[]>([])
  const rockMeshes = useMemo(() => ROCKS.map(([x, z, r]) => ({ x, z, r, y: heightAt(x, z) })), [])
  // Stepped in small slices, whatever the phone's frame rate (the same game at 20 or 120 images a second).
  useFrame((st, dt) => {
    for (let rest = Math.min(0.5, dt); rest > 1e-4; rest -= 0.05) tick(st.camera, st.clock, Math.min(0.05, rest))
  })
  const tick = (camera: THREE.Camera, clock: THREE.Clock, d: number) => {
    const l = live
    const t = clock.elapsedTime
    if (!l.over) {
      l.t += d
      const power = l.batt > 0
      if (!l.air) {
        if (l.gas && power) l.v += 4.2 * d
        if (l.brake) l.v -= (l.v > 0 ? 7 : 2.5) * d
        l.v -= l.v * 0.25 * d
        l.v = clamp(l.v, -3, 11)
        const steer = (l.l ? 1 : 0) - (l.r ? 1 : 0)
        l.head += steer * d * (0.5 + Math.min(1, Math.abs(l.v) / 6)) * Math.sign(l.v || 1)
      }
      l.batt = Math.max(0, l.batt - (l.gas ? 0.9 : 0.12) * d)
      const nx = l.x + Math.sin(l.head) * l.v * d
      const nz = l.z + Math.cos(l.head) * l.v * d
      // A boulder: a knock, back off.
      const rock = rockMeshes.find((k) => Math.hypot(k.x - nx, k.z - nz) < k.r + 1.4)
      if (rock && !l.air) {
        l.v = -l.v * 0.35
        if (t - l.bumped > 0.6) {
          l.hits++
          l.bumped = t
          haptic('medium')
          snd.thud(0.6)
        }
      } else {
        l.x = clamp(nx, -60, 60)
        l.z = clamp(nz, -20, 130)
      }
      const ground = heightAt(l.x, l.z)
      // The craters' floors hold it back (the dust), their rims throw it up at speed (a sixth of a g: a long hop).
      const inside = CRATERS.some((c) => Math.hypot(l.x - c.x, l.z - c.z) < c.r * 0.8)
      if (inside && !l.air) l.v -= l.v * 1.1 * d
      if (l.air) {
        l.vy -= G * d
        l.y += l.vy * d
        if (l.y <= ground) {
          l.air = false
          l.y = ground
          haptic('light')
        }
      } else {
        const rise = (ground - l.y) / Math.max(d, 1e-3)
        if (rise < -1.2 && Math.abs(l.v) > 3.5) {
          // Over a rim: off it goes.
          l.air = true
          l.vy = Math.min(4, Math.abs(l.v) * 0.3)
        } else l.y = ground
      }
      const dist = Math.hypot(BEACON.x - l.x, BEACON.y - l.z)
      if (dist < 4.5) {
        l.over = true
        l.v = 0
        onEnd({ score: Math.round(clamp(55 + 30 * (1 - l.t / TIME) + 15 * (1 - l.hits / 5), 50, 100)), line: tr('Balise atteinte ! Le Margouillat photographie le site et rentre à la base.') })
      } else if (l.t > TIME || l.batt <= 0) {
        l.over = true
        l.v = 0
        onEnd({ score: Math.round(clamp(45 * (1 - dist / START) - l.hits * 2, 5, 45)), line: l.batt <= 0 ? tr('Batterie à plat : le Margouillat rentre tout doucement à la base. On recommence ?') : tr('Le temps est passé : le Margouillat rentre à la base, la balise attendra. On recommence ?') })
      }
    }
    const g = rover.current
    if (g) {
      g.position.set(l.x, l.y, l.z)
      g.rotation.set(l.air ? -0.12 : 0, l.head, Math.sin(t * 9) * 0.01 * Math.min(1, Math.abs(l.v)))
    }
    const a = arrow.current
    if (a) {
      a.position.set(l.x, l.y + 4.2 + Math.sin(t * 3) * 0.15, l.z)
      a.rotation.y = Math.atan2(BEACON.x - l.x, BEACON.y - l.z)
    }
    if (lamp.current) lamp.current.visible = Math.sin(t * 6) > -0.2
    dust.current.forEach((m, i) => {
      if (!m) return
      m.visible = Math.abs(l.v) > 2 && !l.air
      const k = ((t * 2 + i / 4) % 1) * 1.6
      m.position.set(l.x - Math.sin(l.head) * (2.6 + k * 2) + (i - 1.5) * 0.5, l.y + 0.3 + k * 0.5, l.z - Math.cos(l.head) * (2.6 + k * 2))
    })
    const fx = Math.sin(l.head)
    const fz = Math.cos(l.head)
    camera.position.lerp(new THREE.Vector3(l.x - fx * 13, l.y + 7.5, l.z - fz * 13), 1 - Math.exp(-d * 2.5))
    camera.lookAt(l.x + fx * 6, l.y + 0.5, l.z + fz * 6)
  }
  return (
    <>
      <color attach="background" args={['#000000']} />
      <fog attach="fog" args={['#000000', 70, 160]} />
      <Stars />
      <ambientLight intensity={0.5} />
      <directionalLight position={[-40, 30, -20]} intensity={1.9} />
      <group position={[0, 0, 55]}>
        <Sol size={150} cell={2} height={(x, z) => heightAt(x, z + 55)} colors={['#9a9a9a', '#8c8c8c', '#a6a6a6', '#7f7f7f']} />
      </group>
      <Fused>
      {rockMeshes.map((k, i) => (
        <group key={i} position={[k.x, k.y, k.z]}>
          <B p={[0, k.r * 0.55, 0]} s={[k.r * 2, k.r * 1.2, k.r * 1.8]} c="#6c6c6c" r={[0, i, 0]} />
          <B p={[0.2, k.r * 1.1, 0.1]} s={[k.r * 1.2, k.r * 0.6, k.r]} c="#7d7d7d" r={[0, i * 2, 0]} />
        </group>
      ))}
      {/* The base behind, where it started */}
      <group position={[-8, heightAt(-8, -12), -12]}>
        <B p={[0, 2, 0]} s={[8, 4, 6]} c="#f1f3f5" />
        <B p={[0, 4.3, 0]} s={[6.6, 0.8, 5]} c="#e9ecef" />
        <B p={[0, 2.2, 3.02]} s={[3, 0.5, 0.05]} c="#ff7a00" />
      </group>
      </Fused>
      {/* The beacon: its pole, its orange light blinking, a ring painted on the ground */}
      <group position={[BEACON.x, heightAt(BEACON.x, BEACON.y), BEACON.y]}>
        <B p={[0, 2.5, 0]} s={[0.2, 5, 0.2]} c="#ced4da" />
        <mesh ref={lamp} position={[0, 5.2, 0]}>
          <boxGeometry args={[0.7, 0.7, 0.7]} />
          <meshBasicMaterial color="#ff922b" toneMapped={false} />
        </mesh>
        {[...Array(10)].map((_, i) => {
          const an = (i / 10) * Math.PI * 2
          return <B key={i} p={[Math.cos(an) * 4.5, 0.2, Math.sin(an) * 4.5]} s={[1, 0.1, 0.4]} r={[0, -an, 0]} c="#ff7a00" glow />
        })}
      </group>
      <group ref={rover}>
        <Rover driver />
      </group>
      <group ref={arrow}>
        <B p={[0, 0, 0.4]} s={[0.35, 0.15, 1.2]} c="#ff7a00" glow />
        <B p={[0, 0, 1.15]} s={[0.9, 0.15, 0.35]} c="#ff7a00" glow />
      </group>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} ref={(m) => void (dust.current[i] = m)}>
          <boxGeometry args={[0.6, 0.4, 0.6]} />
          <meshBasicMaterial color="#b0b0b0" transparent opacity={0.45} depthWrite={false} />
        </mesh>
      ))}
      <group position={[60, 18, 220]}>
        <Terre radius={14} view="lune" />
      </group>
    </>
  )
}

export function MargouillatJeu({ send, onClose }: GameProps) {
  const [run, setRun] = useState(0)
  const live = useMemo(() => fresh(), [run]) // eslint-disable-line react-hooks/exhaustive-deps
  const [ended, setEnded] = useState<Ended | null>(null)
  const hud = useTicker(() => ({ dist: Math.hypot(BEACON.x - live.x, BEACON.y - live.z), v: live.v, batt: live.batt, t: live.t, hits: live.hits, air: live.air }))
  return (
    <Frame
      title={tr('Le Margouillat jusqu’à la balise')}
      icon={Car}
      hint={hud.air ? tr('Il vole ! À un sixième de g, on retombe tout doucement…') : tr('Suis la flèche orange. Évite les rochers ; le fond des cratères freine, leurs bords font sauter.')}
      gauges={[
        { label: tr('Balise'), value: (1 - hud.dist / START) * 100, text: `${Math.round(hud.dist)} m`, tone: 'info' },
        { label: tr('Temps'), value: (1 - hud.t / TIME) * 100, text: `${Math.max(0, Math.ceil(TIME - hud.t))} s`, tone: TIME - hud.t < 15 ? 'bad' : 'ok' },
        { label: tr('Batterie'), value: hud.batt, text: `${Math.round(hud.batt)} %`, tone: hud.batt < 20 ? 'bad' : 'info' },
        { label: tr('Vitesse'), value: (Math.abs(hud.v) / 11) * 100, text: tr('{n} km/h', { n: Math.round(Math.abs(hud.v) * 3.6) }), tone: hud.hits > 2 ? 'warn' : 'ok' },
      ]}
      controls={
        <div className="flex gap-2">
          <Hold on={(d) => void (live.l = d)} label={tr('Gauche')}><ArrowLeft size={22} /></Hold>
          <Hold tone="#c92a2a" on={(d) => void (live.brake = d)}>{tr('Frein')}</Hold>
          <Hold wide tone="#2b8a3e" on={(d) => void (live.gas = d)}>{tr('Accélérer')}</Hold>
          <Hold on={(d) => void (live.r = d)} label={tr('Droite')}><ArrowRight size={22} /></Hold>
        </div>
      }
      ended={ended}
      onRetry={() => (setEnded(null), setRun((n) => n + 1))}
      send={send}
      onClose={onClose}
      bg="#000"
      cam={{ position: [0, 8, -13], fov: 60 }}
    >
      <Scene key={run} live={live} onEnd={setEnded} />
    </Frame>
  )
}
