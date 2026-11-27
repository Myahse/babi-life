import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ArrowLeft, ArrowRight, Moon } from 'lucide-react'
import { t as tr } from '../../../lib/i18n'
import { haptic } from '../../../lib/native'
import { B } from '../../../world3d/espace/blocs'
import { buildPirogue, setFlame } from '../../../world3d/espace/calao'
import { Terre } from '../../../world3d/espace/Terre'
import { noise } from '../../../world3d/espace/Sol'
import { Stars } from '../../../world3d/espace/placeholders'
import { clamp, Frame, Hold, useTicker, type Ended } from './Frame'
import { Fused } from './Fused'
import type { GameProps } from './types'

// L'alunissage (backend game.AlunissageID in the capsule on the way to the Moon, AlunissageSimuID on the training
// centre's simulator): the Pirogue's descent onto the Base Clair-de-Terre's pad, seen from the side. Hold
// « Poussée » to brake the fall (a sixth of the Earth's pull), the side thrusters to kill the drift over the pad;
// the propellant runs down. Touch down slower than SOFT_V, straight, on the pad: posé. Too fast near the ground,
// the computer takes over and lands for you (« remise des gaz »): nobody hurt, on recommence.

const G = 1.62
const THRUST = 3.6
const SIDE = 1
const SOFT_V = 2.2
const SOFT_H = 1.2
const PAD_HALF = 7
const TIME = 110
const PAD_X = 0

/** The ground's height along the descent (the pad flat, the rest bumpy grey). */
const groundAt = (x: number) => {
  if (Math.abs(x - PAD_X) < PAD_HALF + 1) return 0
  const i = Math.floor(x / 3)
  return (noise(i, 7) - 0.3) * 2.4 + Math.max(0, Math.sin(x * 0.03) * 3) + (Math.abs(x) > 60 ? (Math.abs(x) - 60) * 0.08 : 0)
}

type Live = { x: number; y: number; vx: number; vy: number; fuel: number; t: number; up: boolean; l: boolean; r: boolean; over: boolean; auto: boolean }

const fresh = (): Live => ({ x: PAD_X - 55 - Math.random() * 25, y: 95 + Math.random() * 15, vx: 4 + Math.random() * 2.5, vy: -2, fuel: 100, t: 0, up: false, l: false, r: false, over: false, auto: false })

/** The ground in columns, the pad with its lights, the base's modules beside it, the pennant. */
function Ground() {
  const cols = useMemo(() => {
    const out: { x: number; h: number; c: string }[] = []
    for (let x = -150; x <= 150; x += 3) {
      const h = groundAt(x + 1.5)
      out.push({ x: x + 1.5, h, c: ['#9a9a9a', '#8c8c8c', '#a6a6a6', '#7f7f7f'][Math.floor(noise(x, 3) * 4)] })
    }
    return out
  }, [])
  return (
    <group>
      {cols.map((k) => (
        <B key={k.x} p={[k.x, (k.h - 20) / 2, 0]} s={[3, k.h + 20, 24]} c={k.c} />
      ))}
      {/* The pad: its slab, its painted ring and cross, its lights */}
      <B p={[PAD_X, 0.08, 0]} s={[PAD_HALF * 2, 0.2, 10]} c="#5c636e" />
      <B p={[PAD_X, 0.2, 0]} s={[PAD_HALF * 1.4, 0.04, 0.4]} c="#ff7a00" />
      <B p={[PAD_X, 0.2, 0]} s={[0.4, 0.04, 6]} c="#ff7a00" />
      {[-1, 1].map((s) => (
        <B key={s} p={[PAD_X + s * PAD_HALF, 0.5, 4.6]} s={[0.4, 0.6, 0.4]} c="#40c057" glow />
      ))}
      {/* The base's modules, white and round-shouldered, the airlock, the greenhouse's pink glow */}
      <group position={[PAD_X + 24, 0, -4]}>
        <B p={[0, 2, 0]} s={[8, 4, 6]} c="#f1f3f5" />
        <B p={[0, 4.3, 0]} s={[6.6, 0.8, 5]} c="#e9ecef" />
        <B p={[-4.4, 1.3, 0]} s={[1.2, 2.2, 2]} c="#ced4da" />
        <B p={[0, 2.2, 3.02]} s={[3, 0.5, 0.05]} c="#ff7a00" />
        <B p={[9, 1.5, 0]} s={[6, 3, 5]} c="#dee2e6" />
        <B p={[9, 3.1, 0]} s={[5.6, 0.2, 4.6]} c="#f783ac" glow />
      </group>
      <group position={[PAD_X - 14, 0, -2]}>
        <B p={[0, 2.2, 0]} s={[0.12, 4.4, 0.12]} c="#ced4da" />
        <B p={[0.7, 3.9, 0]} s={[1.3, 0.8, 0.05]} c="#ff7a00" />
        <B p={[0.55, 3.9, 0.03]} s={[0.4, 0.3, 0.02]} c="#ffffff" />
      </group>
    </group>
  )
}

function Scene({ live, onEnd }: { live: Live; onEnd: (e: Ended) => void }) {
  const ship = useRef<THREE.Group>(null)
  const pirogue = useMemo(() => buildPirogue(), [])
  const side = useRef<(THREE.Mesh | null)[]>([])
  const plumb = useRef<THREE.Mesh>(null)
  // Stepped in small slices, whatever the phone's frame rate (the same game at 20 or 120 images a second).
  useFrame((st, dt) => {
    for (let rest = Math.min(0.5, dt); rest > 1e-4; rest -= 0.05) tick(st.camera, st.clock, Math.min(0.05, rest))
  })
  const tick = (camera: THREE.Camera, clock: THREE.Clock, d: number) => {
    const l = live
    const t = clock.elapsedTime
    let main = 0
    if (!l.over) {
      l.t += d
      const fire = l.fuel > 0
      main = l.up && fire ? 1 : 0
      const ax = fire ? (l.r ? SIDE : 0) - (l.l ? SIDE : 0) : 0
      l.fuel = Math.max(0, l.fuel - (main * 6 + (ax ? 2 : 0)) * d)
      l.vy += (main * THRUST - G) * d
      l.vx += ax * d
      l.x += l.vx * d
      l.y += l.vy * d
      const alt = l.y - groundAt(l.x)
      side.current.forEach((m, i) => m && (m.visible = (i === 0 ? l.r : l.l) && fire))
      // Far too fast near the ground: the computer takes over (« remise des gaz »).
      if (alt < 14 && l.vy < -7.5) {
        l.over = l.auto = true
        haptic('heavy')
        onEnd({ score: Math.round(clamp(12 + l.fuel * 0.15, 8, 28)), line: tr('Trop vite près du sol : l’ordinateur reprend la main, remet les gaz et se pose à ta place. On recommence ?') })
      } else if (alt <= 0) {
        l.over = true
        const vy = Math.abs(l.vy)
        const vx = Math.abs(l.vx)
        const off = Math.abs(l.x - PAD_X)
        l.y = groundAt(l.x)
        haptic('medium')
        if (vy <= SOFT_V && vx <= SOFT_H && off <= PAD_HALF) {
          onEnd({ score: Math.round(clamp(55 + 20 * (1 - vy / SOFT_V) + 10 * (1 - vx / SOFT_H) + 10 * (l.fuel / 100) + 5 * (1 - off / PAD_HALF), 50, 100)), line: tr('Contact lunaire ! Posé en douceur sur le pad de la Base Clair-de-Terre.') })
        } else if (vy <= SOFT_V * 1.6 && vx <= SOFT_H * 2) {
          onEnd({ score: off <= PAD_HALF ? 45 : 35, line: off <= PAD_HALF ? tr('Posé un peu fort : les amortisseurs encaissent, tout va bien. Plus doux la prochaine fois !') : tr('Posé à côté du pad : le Margouillat vient te chercher. Vise le pad la prochaine fois !') })
        } else {
          onEnd({ score: 20, line: tr('Trop vite : les amortisseurs et l’ordinateur rattrapent tout, personne n’a rien. On recommence ?') })
        }
        l.vx = l.vy = 0
      } else if (l.t > TIME || l.fuel <= 0) {
        l.over = l.auto = true
        onEnd({ score: 22, line: l.fuel <= 0 ? tr('Plus d’ergols : la réserve de l’ordinateur pose la Pirogue à ta place.') : tr('Le temps est passé : l’ordinateur pose la Pirogue à ta place.') })
      }
    } else if (l.auto) {
      // The computer's landing: down softly onto the pad.
      main = 0.7
      l.x += (PAD_X - l.x) * d * 0.5
      l.y = Math.max(groundAt(l.x), l.y - d * 3)
      if (l.y <= groundAt(l.x) + 0.01) main = 0
    }
    setFlame(pirogue.retro, main, t, 2.2)
    const g = ship.current
    if (g) {
      g.position.set(l.x, l.y, 0)
      g.rotation.z = clamp(-l.vx * 0.03, -0.25, 0.25)
    }
    const alt = l.y - groundAt(l.x)
    // The radar's line down to the ground under it (orange over the pad).
    if (plumb.current) {
      plumb.current.visible = alt > 1.5 && !l.over
      plumb.current.position.set(l.x, l.y - alt / 2, 0.5)
      plumb.current.scale.y = Math.max(0.01, alt)
      ;(plumb.current.material as THREE.MeshBasicMaterial).color.set(Math.abs(l.x - PAD_X) <= PAD_HALF ? '#ff922b' : '#74c0fc')
    }
    // Framed so the ground shows under it as it comes near (the lander a little above the middle).
    const below = Math.min(alt * 0.42, 22)
    const want = new THREE.Vector3(l.x + 3, l.y - below + 4, 28 + Math.min(alt, 75) * 1.05)
    camera.position.lerp(want, 1 - Math.exp(-d * 3))
    camera.lookAt(l.x + 3, l.y - below - 2, 0)
  }
  return (
    <>
      <color attach="background" args={['#000000']} />
      <Stars />
      <ambientLight intensity={0.5} />
      <directionalLight position={[-30, 40, 40]} intensity={1.8} />
      <Fused>
        <Ground />
      </Fused>
      <mesh ref={plumb}>
        <boxGeometry args={[0.15, 1, 0.15]} />
        <meshBasicMaterial color="#74c0fc" transparent opacity={0.6} depthWrite={false} />
      </mesh>
      <group ref={ship}>
        <group scale={1.1}>
          <primitive object={pirogue.root} />
          {/* The descent's legs, their pads */}
          {[-1, 1].map((s) => (
            <group key={s}>
              <B p={[s * 2.4, 0.5, 0]} s={[0.2, 1.8, 0.2]} c="#adb5bd" r={[0, 0, s * 0.35]} />
              <B p={[s * 2.8, -0.4, 0]} s={[0.9, 0.12, 0.9]} c="#868e96" />
            </group>
          ))}
          {[0, 1].map((i) => (
            <mesh key={i} ref={(m) => void (side.current[i] = m)} visible={false} position={[(i ? 1 : -1) * 2.6, 2.2, 0]}>
              <boxGeometry args={[0.7, 0.4, 0.4]} />
              <meshBasicMaterial color="#e7f5ff" transparent opacity={0.75} depthWrite={false} />
            </mesh>
          ))}
        </group>
      </group>
      <group position={[-160, 200, -700]}>
        <Terre radius={40} view="lune" />
      </group>
    </>
  )
}

export function Alunissage({ id, send, onClose }: GameProps) {
  const [run, setRun] = useState(0)
  const live = useMemo(() => fresh(), [run]) // eslint-disable-line react-hooks/exhaustive-deps
  const [ended, setEnded] = useState<Ended | null>(null)
  const hud = useTicker(() => ({ alt: live.y - groundAt(live.x), vy: live.vy, vx: live.vx, fuel: live.fuel, dx: PAD_X - live.x }))
  const simu = id === 'entrainement-alunissage'
  const fast = hud.vy < -SOFT_V
  return (
    <Frame
      title={simu ? tr('Simulateur d’alunissage') : tr('Alunissage à Clair-de-Terre')}
      icon={Moon}
      hint={
        Math.abs(hud.dx) > PAD_HALF
          ? tr('Le pad est à {m} m {dir} : glisse au-dessus avec les propulseurs latéraux.', { m: Math.round(Math.abs(hud.dx)), dir: hud.dx > 0 ? '→' : '←' })
          : hud.alt > 25
            ? tr('Au-dessus du pad ! Dose la poussée pour descendre doucement.')
            : fast
              ? tr('Trop vite ! Pousse : moins de {v} m/s au contact.', { v: SOFT_V })
              : tr('Tout doux… moins de {v} m/s, bien droit.', { v: SOFT_V })
      }
      gauges={[
        { label: tr('Altitude'), value: (hud.alt / 110) * 100, text: `${Math.max(0, hud.alt).toFixed(0)} m`, tone: 'info' },
        { label: tr('Descente'), value: (Math.abs(hud.vy) / 8) * 100, text: `${(-hud.vy).toFixed(1)} m/s`, tone: fast ? (hud.alt < 30 ? 'bad' : 'warn') : 'ok' },
        { label: tr('Dérive'), value: (Math.abs(hud.vx) / 6) * 100, text: `${hud.vx.toFixed(1)} m/s`, tone: Math.abs(hud.vx) <= SOFT_H ? 'ok' : 'warn' },
        { label: tr('Ergols'), value: hud.fuel, text: `${Math.round(hud.fuel)} %`, tone: hud.fuel < 20 ? 'bad' : 'info' },
      ]}
      controls={
        <div className="flex gap-2">
          <Hold on={(d) => void (live.l = d)} label={tr('Gauche')}><ArrowLeft size={22} /></Hold>
          <Hold wide tone="#e8590c" on={(d) => void (live.up = d)}>{tr('Poussée (maintenir)')}</Hold>
          <Hold on={(d) => void (live.r = d)} label={tr('Droite')}><ArrowRight size={22} /></Hold>
        </div>
      }
      ended={ended}
      onRetry={() => (setEnded(null), setRun((n) => n + 1))}
      send={send}
      onClose={onClose}
      bg="#000"
      cam={{ position: [live.x, live.y + 10, 70], fov: 50 }}
    >
      <Scene key={run} live={live} onEnd={setEnded} />
    </Frame>
  )
}
