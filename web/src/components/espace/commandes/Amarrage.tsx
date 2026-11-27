import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Rocket, RotateCcw, RotateCw } from 'lucide-react'
import { t as tr } from '../../../lib/i18n'
import { haptic } from '../../../lib/native'
import { B } from '../../../world3d/espace/blocs'
import { buildPirogue } from '../../../world3d/espace/calao'
import { Terre } from '../../../world3d/espace/Terre'
import { Stars } from '../../../world3d/espace/placeholders'
import { clamp, Frame, Hold, useTicker, type Ended } from './Frame'
import { Fused } from './Fused'
import type { GameProps } from './types'

// L'amarrage (backend game.AmarrageID, « station-amarrage »): the Pirogue flown by hand to the Station Akwaba's
// docking port. The little thrusters slide it up, down, left, right; the roll lines its hatch up with the port's
// cross; « Avancer » and « Freiner » set the closing speed, which must be under the limit at the contact. A
// contact too fast or off-centre: the Pirogue touches the ring and backs away gently (on recommence). The
// thrusters' propellant runs down as they fire.

const START_Z = 40
/** The closing speed allowed at the contact (m/s), the centring (m), the roll (degrees). */
const MAX_V = 0.4
const MAX_OFF = 0.6
const MAX_ROLL = 8
const TIME = 120

type Live = {
  p: THREE.Vector3
  v: THREE.Vector3
  roll: number
  rollV: number
  fuel: number
  t: number
  keys: { l: boolean; r: boolean; u: boolean; d: boolean; f: boolean; b: boolean; ccw: boolean; cw: boolean }
  over: boolean
}

const fresh = (): Live => ({
  p: new THREE.Vector3((Math.random() < 0.5 ? -1 : 1) * (1.5 + Math.random() * 1.5), (Math.random() - 0.5) * 3, START_Z),
  v: new THREE.Vector3((Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.15, -0.5),
  roll: ((Math.random() < 0.5 ? -1 : 1) * (12 + Math.random() * 16) * Math.PI) / 180,
  rollV: (Math.random() - 0.5) * 0.02,
  fuel: 100,
  t: 0,
  keys: { l: false, r: false, u: false, d: false, f: false, b: false, ccw: false, cw: false },
  over: false,
})

/** The station's end: its module, the docking port and its cross, the solar wings, the Earth below. */
function Port() {
  return (
    <group>
      <B p={[0, 0, -9]} s={[5.4, 5.4, 16]} c="#e9ecef" />
      <B p={[0, 0, -9]} s={[5.6, 0.3, 16.2]} c="#ced4da" />
      <B p={[0, 2.8, -6]} s={[1.2, 0.2, 3]} c="#adb5bd" />
      {/* The port's ring: orange, its eight latches, the dark hatch, the white cross to line up */}
      <B p={[0, 0, -0.6]} s={[2.6, 2.6, 1.2]} c="#adb5bd" />
      {[...Array(8)].map((_, i) => {
        const a = (i / 8) * Math.PI * 2
        return <B key={i} p={[Math.cos(a) * 1.25, Math.sin(a) * 1.25, 0.05]} s={[0.5, 0.5, 0.3]} c="#ff7a00" />
      })}
      <B p={[0, 0, 0.02]} s={[1.6, 1.6, 0.1]} c="#1b1e24" />
      <B p={[0, 0, 0.1]} s={[1.2, 0.08, 0.04]} c="#ffffff" glow />
      <B p={[0, 0, 0.1]} s={[0.08, 1.2, 0.04]} c="#ffffff" glow />
      <B p={[0, 0.85, 0.1]} s={[0.16, 0.3, 0.04]} c="#40c057" glow />
      {/* The approach lights (green at the top, red at the bottom) */}
      {[-1, 1].map((s) => (
        <B key={s} p={[s * 1.9, 0, 0.1]} s={[0.2, 0.2, 0.1]} c={s < 0 ? '#ff6b6b' : '#40c057'} glow />
      ))}
      {/* The wings, gold-ribbed */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 10, 0, -11]}>
          <B p={[-s * 3.5, 0, 0]} s={[4, 0.3, 0.3]} c="#adb5bd" />
          <B p={[0, 0, 0]} s={[7, 0.1, 4]} c="#1e3a8a" />
          {[-1.5, -0.5, 0.5, 1.5].map((z) => (
            <B key={z} p={[0, 0.06, z]} s={[7, 0.02, 0.06]} c="#c9a227" />
          ))}
        </group>
      ))}
      <B p={[0, -4.5, -12]} s={[6, 0.08, 3]} c="#f1f3f5" />
    </group>
  )
}

function Scene({ live, onEnd }: { live: Live; onEnd: (e: Ended) => void }) {
  const ship = useRef<THREE.Group>(null)
  const pirogue = useMemo(() => buildPirogue(), [])
  const puffs = useRef<(THREE.Mesh | null)[]>([])
  const laser = useRef<THREE.Mesh>(null)
  // Stepped in small slices, whatever the phone's frame rate (the same game at 20 or 120 images a second).
  useFrame((st, dt) => {
    for (let rest = Math.min(0.5, dt); rest > 1e-4; rest -= 0.05) tick(st.camera, st.clock, Math.min(0.05, rest))
  })
  const tick = (camera: THREE.Camera, clock: THREE.Clock, d: number) => {
    const l = live
    if (!l.over) {
      l.t += d
      const k = l.keys
      const fire = l.fuel > 0
      const ax = fire ? (k.r ? 0.45 : 0) - (k.l ? 0.45 : 0) : 0
      const ay = fire ? (k.u ? 0.45 : 0) - (k.d ? 0.45 : 0) : 0
      const az = fire ? (k.b ? 0.35 : 0) - (k.f ? 0.35 : 0) : 0
      const ar = fire ? (k.ccw ? 0.5 : 0) - (k.cw ? 0.5 : 0) : 0
      const using = [ax, ay, az, ar].filter((x) => x !== 0).length
      l.fuel = Math.max(0, l.fuel - using * 2.2 * d)
      l.v.x += ax * d
      l.v.y += ay * d
      l.v.z += az * d
      l.rollV += ar * d
      l.p.addScaledVector(l.v, d)
      l.roll += l.rollV * d
      const off = Math.hypot(l.p.x, l.p.y)
      const rollDeg = Math.abs((l.roll * 180) / Math.PI)
      // The contact: inside the limits, docked; else the ring pushes it back, gently.
      if (l.p.z <= 0.3) {
        l.over = true
        const vz = Math.abs(l.v.z)
        if (off <= MAX_OFF && vz <= MAX_V && rollDeg <= MAX_ROLL) {
          const s = Math.round(clamp(55 + 15 * (1 - off / MAX_OFF) + 15 * (1 - vz / MAX_V) + 10 * (l.fuel / 100) + 5 * (1 - rollDeg / MAX_ROLL), 50, 100))
          haptic('medium')
          onEnd({ score: s, line: tr('Contact ! Les crochets se ferment : la Pirogue est amarrée.') })
        } else {
          l.v.set(0, 0, 0.3)
          const why = vz > MAX_V ? tr('trop vite ({v} m/s)', { v: vz.toFixed(2) }) : off > MAX_OFF ? tr('décalée de {m} m', { m: off.toFixed(1) }) : tr('mal tournée ({d}°)', { d: Math.round(rollDeg) })
          haptic('heavy')
          onEnd({ score: Math.round(clamp(25 + 20 * (1 - Math.min(1, off / 3)) - (vz > MAX_V ? 10 : 0), 10, 45)), line: tr('La Pirogue touche l’anneau {why} et recule tout doucement. Personne n’a rien : on recommence ?', { why }) })
        }
      } else if (l.t > TIME || l.p.z > START_Z + 25) {
        l.over = true
        onEnd({ score: Math.round(clamp(10 + 30 * (1 - l.p.z / START_Z), 5, 40)), line: tr('Le temps est passé : l’ordinateur de bord finit l’amarrage tout seul.') })
      }
      // The cold-gas puffs (white) of the thrusters firing.
      const on = [ax < 0 || ay !== 0, az !== 0, ar !== 0, ax > 0 || ay !== 0]
      puffs.current.forEach((m, i) => {
        if (!m) return
        m.visible = on[i] && fire
        m.scale.setScalar(0.7 + 0.3 * Math.sin(clock.elapsedTime * 40 + i))
      })
    } else {
      // After: docked, held; or drifting back slowly.
      l.p.addScaledVector(l.v, d)
      l.v.multiplyScalar(1 - d * 0.8)
    }
    const z = Math.max(0.05, l.p.z - 1)
    if (laser.current) {
      laser.current.visible = !l.over
      laser.current.scale.z = z
      laser.current.position.z = -1 - z / 2
      ;(laser.current.material as THREE.MeshBasicMaterial).color.set(Math.hypot(l.p.x, l.p.y) <= MAX_OFF ? '#ff922b' : '#74c0fc')
    }
    const g = ship.current
    if (g) {
      g.position.copy(l.p)
      g.rotation.set(0, 0, l.roll)
    }
    // Behind and above the Pirogue: its back and the port ahead both in view.
    const want = new THREE.Vector3(l.p.x, l.p.y + 5.2, l.p.z + 17)
    camera.position.lerp(want, 1 - Math.exp(-d * 3))
    camera.lookAt(l.p.x * 0.6, l.p.y * 0.6 + 0.6, l.p.z - 16)
  }
  return (
    <>
      <color attach="background" args={['#02030a']} />
      <Stars />
      <ambientLight intensity={0.55} />
      <directionalLight position={[14, 20, 18]} intensity={1.7} />
      <Fused>
        <Port />
      </Fused>
      <group ref={ship}>
        {/* The Pirogue lying on its side, its hatch forward (to -z) */}
        <group rotation={[-Math.PI / 2, 0, 0]}>
          <group position={[0, -3.4, 0]}>
            <primitive object={pirogue.root} />
          </group>
        </group>
        {/* The docking probe on its nose, and its laser line to the port (orange: lined up) */}
        <B p={[0, 0, -0.5]} s={[0.25, 0.25, 1]} c="#ced4da" />
        <mesh ref={laser} position={[0, 0, -1]}>
          <boxGeometry args={[0.06, 0.06, 1]} />
          <meshBasicMaterial color="#74c0fc" transparent opacity={0.7} depthWrite={false} />
        </mesh>
        {/* The thrusters' puffs, round its rim */}
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} ref={(m) => void (puffs.current[i] = m)} visible={false} position={[Math.cos((i / 4) * Math.PI * 2 + Math.PI) * 2.3, Math.sin((i / 4) * Math.PI * 2 + Math.PI) * 2.3, -1.2]}>
            <boxGeometry args={[0.5, 0.5, 0.5]} />
            <meshBasicMaterial color="#e7f5ff" transparent opacity={0.7} depthWrite={false} />
          </mesh>
        ))}
      </group>
      <group position={[0, -130, -60]} rotation={[-0.4, 0, 0]}>
        <Terre radius={90} view="orbite" />
      </group>
    </>
  )
}

export function Amarrage({ send, onClose }: GameProps) {
  const [run, setRun] = useState(0)
  const live = useMemo(() => fresh(), [run]) // eslint-disable-line react-hooks/exhaustive-deps
  const [ended, setEnded] = useState<Ended | null>(null)
  const hud = useTicker(() => ({ z: live.p.z, vz: -live.v.z, off: Math.hypot(live.p.x, live.p.y), roll: (live.roll * 180) / Math.PI, fuel: live.fuel, t: live.t }))
  const key = (k: keyof Live['keys']) => (down: boolean) => void (live.keys[k] = down)
  const fast = hud.vz > MAX_V
  return (
    <Frame
      title={tr('Amarrage à la Station Akwaba')}
      icon={Rocket}
      hint={hud.z > 12 ? tr('Centre la Pirogue sur la croix blanche, redresse le roulis, approche doucement.') : fast ? tr('Trop vite ! Freine avant le contact (moins de {v} m/s).', { v: MAX_V }) : tr('Tout doux : moins de {v} m/s au contact, la croix bien au centre.', { v: MAX_V })}
      gauges={[
        { label: tr('Distance'), value: (hud.z / START_Z) * 100, text: `${Math.max(0, hud.z).toFixed(1)} m`, tone: 'info' },
        { label: tr('Vitesse'), value: (Math.abs(hud.vz) / 1.2) * 100, text: `${(Math.round(hud.vz * 100) / 100 || 0).toFixed(2)} m/s`, tone: fast ? (hud.z < 12 ? 'bad' : 'warn') : 'ok' },
        { label: tr('Décalage'), value: (hud.off / 4) * 100, text: `${hud.off.toFixed(1)} m`, tone: hud.off <= MAX_OFF ? 'ok' : 'warn' },
        { label: tr('Roulis'), value: (Math.abs(hud.roll) / 40) * 100, text: `${Math.round(hud.roll)}°`, tone: Math.abs(hud.roll) <= MAX_ROLL ? 'ok' : 'warn' },
        { label: tr('Ergols'), value: hud.fuel, text: `${Math.round(hud.fuel)} %`, tone: hud.fuel < 20 ? 'bad' : 'info' },
      ]}
      controls={
        <>
          <div className="flex gap-2">
            <Hold on={key('l')} label={tr('Gauche')}><ArrowLeft size={20} /></Hold>
            <Hold on={key('u')} label={tr('Haut')}><ArrowUp size={20} /></Hold>
            <Hold on={key('d')} label={tr('Bas')}><ArrowDown size={20} /></Hold>
            <Hold on={key('r')} label={tr('Droite')}><ArrowRight size={20} /></Hold>
          </div>
          <div className="flex gap-2">
            <Hold on={key('ccw')} label={tr('Tourner à gauche')}><RotateCcw size={20} /></Hold>
            <Hold on={key('b')} tone="#c92a2a">{tr('Freiner')}</Hold>
            <Hold on={key('f')} tone="#2b8a3e">{tr('Avancer')}</Hold>
            <Hold on={key('cw')} label={tr('Tourner à droite')}><RotateCw size={20} /></Hold>
          </div>
        </>
      }
      ended={ended}
      onRetry={() => (setEnded(null), setRun((n) => n + 1))}
      send={send}
      onClose={onClose}
      cam={{ position: [0, 4, START_Z + 10], fov: 55 }}
    >
      <Scene key={run} live={live} onEnd={setEnded} />
    </Frame>
  )
}
