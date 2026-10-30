import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { Look } from '../../lib/types'
import { haptic } from '../../lib/native'
import { gesture } from '../../world3d/gesture'
import { Character } from '../../world3d/Character'
import { Box } from '../../world3d/props'
import { DEFAULT_LOOK } from './Scenes'
import { JeuShell, Stage } from './jeux/Shell'
import { t as tr } from '../../lib/i18n'

// Going to the toilet, played (the update « gestes-maison »): the perso itself in the little room. Sit
// and push (hold, let go in the green: too hard isn't good either), then the flush, then the hands
// washed at the basin, every bit of foam rinsed off. Nothing forgotten: a clean visit.

const PUSHES = 2
type Phase = 'pousse' | 'chasse' | 'mains'

/** The WC: the bowl, the seat, the tank and its flush button (glowing when it's its turn). */
function Wc({ ready, flushing, onFlush }: { ready: boolean; flushing: boolean; onFlush: () => void }) {
  const swirl = useRef<THREE.Mesh>(null)
  useFrame((_, dt) => {
    if (swirl.current) swirl.current.rotation.y += dt * (flushing ? 12 : 0)
  })
  return (
    <group position={[0, 0, -0.35]}>
      <Box p={[0, 0.2, 0.15]} s={[0.46, 0.4, 0.55]} c="#f8f9fa" />
      <Box p={[0, 0.42, 0.17]} s={[0.5, 0.05, 0.6]} c="#e9ecef" />
      <Box p={[0, 0.7, -0.15]} s={[0.5, 0.55, 0.2]} c="#f8f9fa" />
      <mesh ref={swirl} position={[0, 0.41, 0.2]} visible={flushing}>
        <torusGeometry args={[0.13, 0.04, 6, 14]} />
        <meshBasicMaterial color="#74c0fc" />
      </mesh>
      <mesh position={[0, 1.0, -0.15]} onPointerDown={(e: ThreeEvent<PointerEvent>) => (e.stopPropagation(), onFlush())}>
        <cylinderGeometry args={[0.09, 0.09, 0.05, 12]} />
        <meshLambertMaterial color={ready ? '#ffd43b' : '#ced4da'} emissive={ready ? '#ffd43b' : '#000000'} emissiveIntensity={ready ? 0.8 : 0} />
      </mesh>
      {/* A wide hold round the button */}
      <mesh position={[0, 1.0, -0.15]} visible={false} onPointerDown={(e: ThreeEvent<PointerEvent>) => (e.stopPropagation(), onFlush())}>
        <boxGeometry args={[0.5, 0.35, 0.5]} />
      </mesh>
    </group>
  )
}

/** The gauge of the push, in blocks: the green band, the level rising while it's held. */
function Gauge({ level, band }: { level: number; band: [number, number] }) {
  return (
    <group position={[1.15, 0.2, 0]}>
      <Box p={[0, 0.8, 0]} s={[0.22, 1.6, 0.12]} c="#343a40" />
      <Box p={[0, 0.2 + ((band[0] + band[1]) / 2) * 1.2, 0.04]} s={[0.24, (band[1] - band[0]) * 1.2, 0.1]} c="#2f9e44" />
      <Box p={[0, 0.2 + Math.min(1.1, level) * 0.6, 0.08]} s={[0.16, Math.max(0.02, Math.min(1.1, level) * 1.2), 0.06]} c={level > band[1] ? '#e03131' : '#ffd43b'} />
    </group>
  )
}

/** The foam on the hands at the basin: a tap rinses a bit. */
function Bubble({ p, onRinse }: { p: [number, number, number]; onRinse: () => void }) {
  return (
    <group position={p} onPointerDown={(e: ThreeEvent<PointerEvent>) => (e.stopPropagation(), onRinse())}>
      <mesh>
        <sphereGeometry args={[0.07, 8, 6]} />
        <meshLambertMaterial color="#ffffff" />
      </mesh>
      <mesh visible={false}>
        <boxGeometry args={[0.24, 0.24, 0.24]} />
      </mesh>
    </group>
  )
}

export function ToilettesJeu({ look = DEFAULT_LOOK, gender = 'homme', onEnd }: { look?: Look; gender?: 'femme' | 'homme'; onEnd: (score: number) => void }) {
  const [phase, setPhase] = useState<Phase>('pousse')
  const [press, setPress] = useState<number | null>(null)
  const [pushes, setPushes] = useState(0)
  const [flushing, setFlushing] = useState(false)
  const [said, setSaid] = useState<string | null>(null)
  const st = useRef({ good: 0, misses: 0, done: false })
  const band: [number, number] = pushes === 0 ? [0.5, 0.82] : [0.58, 0.8]
  const bubbles = useMemo(() => [...Array(7)].map((_, i) => [-1.0 + Math.cos(i * 2.1) * 0.2, 0.98 + (i % 3) * 0.07, -0.3 + Math.sin(i * 2.1) * 0.12] as [number, number, number]), [])
  const [left, setLeft] = useState(bubbles.map((_, i) => i))
  const say = (t: string) => (setSaid(t), setTimeout(() => setSaid(null), 1200))
  // Held: the push rises.
  useEffect(() => {
    if (press === null) return
    const t = setInterval(() => setPress((p) => (p === null ? null : Math.min(1.15, p + 0.03))), 30)
    return () => clearInterval(t)
  }, [press !== null]) // eslint-disable-line react-hooks/exhaustive-deps
  const letGo = () => {
    if (press === null || phase !== 'pousse') return
    const good = press >= band[0] && press <= band[1]
    setPress(null)
    if (good) {
      st.current.good++
      haptic('success')
      say(pushes + 1 >= PUSHES ? tr('Ouf… ça va mieux !') : tr('Encore un petit effort…'))
    } else {
      st.current.misses++
      haptic('error')
      say(press > band[1] ? tr('Doucement, doucement !') : tr('Pas encore…'))
    }
    if (pushes + 1 >= PUSHES) setTimeout(() => setPhase('chasse'), 700)
    setPushes(pushes + 1)
  }
  const flush = () => {
    if (phase !== 'chasse' || flushing) return
    haptic('light')
    gesture('busy', 900)
    setFlushing(true)
    say(tr('Chasse tirée !'))
    setTimeout(() => (setFlushing(false), setPhase('mains')), 1300)
  }
  const rinse = (i: number) => {
    haptic('light')
    gesture('wash', 600)
    const rest = left.filter((x) => x !== i)
    setLeft(rest)
    if (!rest.length && !st.current.done) {
      st.current.done = true
      say(tr('Les mains propres, au top !'))
      setTimeout(() => onEnd(Math.max(30, Math.round((st.current.good / PUSHES) * 70 + 30 - st.current.misses * 5))), 900)
    }
  }
  const status = phase === 'pousse' ? tr('Pousse {0}/{PUSHES}', { 0: Math.min(pushes + 1, PUSHES), PUSHES }) : phase === 'chasse' ? tr('Tire la chasse !') : tr('Lave tes mains · encore {length}', { length: left.length })
  const how = phase === 'pousse' ? tr('Tiens « Pousser » et lâche dans le vert : ni trop fort, ni trop peu.') : phase === 'chasse' ? tr('N’oublie pas : touche le bouton de la chasse d’eau.') : tr('Au lavabo : rince chaque bout de mousse sur tes mains.')
  return (
    <JeuShell
      title={tr('Aux toilettes')}
      how={how}
      status={status}
      said={said}
      controls={
        phase === 'pousse' ? (
          <button className="btn flex-1 !py-3" onPointerDown={(e) => (e.preventDefault(), setPress(0))} onPointerUp={letGo} onPointerLeave={letGo} style={press !== null ? { background: press >= band[0] && press <= band[1] ? '#00a862' : press > band[1] ? '#ff3d57' : undefined } : undefined}>
            {press === null ? tr('Pousser (tiens)') : press > band[1] ? tr('Trop fort !') : press >= band[0] ? tr('Lâche !') : tr('Pousse…')}
          </button>
        ) : undefined
      }
    >
      <Stage decor="carrelage" cam={[0, 1.8, 3.9]} look={[0, 0.8, 0]} fov={42}>
        {/* The little room: the tiled wall, the basin with its tap */}
        <Box p={[0, 1.3, -0.75]} s={[3.6, 2.6, 0.1]} c="#d0ebff" />
        <Wc ready={phase === 'chasse'} flushing={flushing} onFlush={flush} />
        <Box p={[-1.0, 0.85, -0.45]} s={[0.55, 0.12, 0.4]} c="#f8f9fa" />
        <Box p={[-1.0, 0.45, -0.55]} s={[0.12, 0.8, 0.12]} c="#e9ecef" />
        <Box p={[-1.0, 1.05, -0.65]} s={[0.05, 0.25, 0.05]} c="#adb5bd" />
        {phase === 'pousse' && <Gauge level={press ?? 0} band={band} />}
        {/* The perso: seated on the WC, then up at the basin */}
        {phase === 'mains' ? (
          // At the basin's side, turned to it: the hands and their foam seen.
          <group position={[-1.45, 0, -0.05]} rotation={[0, Math.PI / 2, 0]}>
            <Character look={look} gender={gender} pose="wash" marker={false} />
          </group>
        ) : phase === 'chasse' ? (
          // Up, beside the WC, the button free to be seen and touched.
          <group position={[0.75, 0, 0.1]} rotation={[0, -0.7, 0]}>
            <Character look={look} gender={gender} pose="busy" marker={false} />
          </group>
        ) : (
          <group position={[0, 0, 0.05]}>
            <Character look={look} gender={gender} pose="toilet" marker={false} />
          </group>
        )}
        {phase === 'mains' && bubbles.map((p, i) => (left.includes(i) ? <Bubble key={i} p={p} onRinse={() => rinse(i)} /> : null))}
      </Stage>
    </JeuShell>
  )
}
