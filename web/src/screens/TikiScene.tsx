import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Human, type Pose } from '../avatar/Human'
import { randomLook } from '../avatar/options'
import type { Look } from '../lib/types'
import { Box, Palm, Sign, TableSet } from '../world3d/props'
import { Elephant } from '../world3d/open/zoo'
import { StreetStall } from '../world3d/open/stalls'
import { t as tr } from '../lib/i18n'

// The game's creators' videos (backend sims/tikinpc.go) can't be files: each
// is a small 3D scene played live from its seeds, so it moves like a video
// and everyone sees the same one. The feed mounts it for the post on screen
// only (one WebGL canvas at a time); the others show a still card.

/** A small seeded random (mulberry32): the same seed, the same scene. */
export function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const looks = new Map<string, Look>()
/** A game creator's look, from its seed (the same in every video and on its page). */
export function npcLook(gender: string, seed: number): Look {
  const k = `${gender}${seed}`
  let l = looks.get(k)
  if (!l) looks.set(k, (l = randomLook(gender === 'homme' ? 'homme' : 'femme', seeded(seed))))
  return l
}

const MOVES: Record<string, Pose[]> = {
  danse: ['dance', 'zouglou', 'gweta', 'robot', 'moonwalk', 'dab'],
  garba: ['thumbsup', 'talk', 'laugh'],
  stade: ['cheer', 'shout', 'clap'],
  vlog: ['talk', 'wave', 'laugh'],
  zoo: ['wave', 'talk', 'clap'],
  humour: ['rant', 'laugh', 'facepalm', 'shrug'],
  mode: ['heart', 'idle', 'kiss', 'salute'],
  sport: ['flex', 'run', 'kick'],
}
const SKY: Record<string, string> = { danse: '#1a0f2e', garba: '#f2b36b', stade: '#7ec4f2', vlog: '#9fd3f5', zoo: '#a8d8a0', humour: '#f6d7a7', mode: '#f3c6d6', sport: '#8fd0f2' }
export const THEME_EMOJI: Record<string, string> = { danse: '💃', garba: '🍛', stade: '🏟️', vlog: '🎥', zoo: '🐘', humour: '😂', mode: '👗', sport: '💪' }

/** The still card of a game creator's video (off screen, in a profile's grid). */
export function SceneCard({ theme, className = '' }: { theme: string; className?: string }) {
  const sky = SKY[theme] ?? '#333'
  return (
    <div className={`grid place-items-center ${className}`} style={{ background: `linear-gradient(160deg, ${sky}, #000 120%)` }}>
      <span className="text-5xl opacity-80">{THEME_EMOJI[theme] ?? '🎬'}</span>
    </div>
  )
}

type Props = { theme: string; scene: number; look: Look; gender: string; playing: boolean }

export function TikiScene(props: Props) {
  return (
    // No pointer events: the taps (pause, like) are the feed's, and the swipe must scroll it.
    <Canvas frameloop={props.playing ? 'always' : 'never'} dpr={[1, 1.5]} camera={{ position: [0, 1.5, 4.8], fov: 46 }} gl={{ antialias: true }} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </Canvas>
  )
}

/** A friend or two in the scene, from the scene's seed. */
type Extra = { x: number; z: number; look: Look; gender: 'femme' | 'homme'; pose: Pose; seed: number; turn: number }

function Scene({ theme, scene, look, gender }: Props) {
  const plan = useMemo(() => {
    const r = seeded(scene)
    const moves = MOVES[theme] ?? ['idle']
    const pose = moves[Math.floor(r() * moves.length)]
    const n = theme === 'danse' || theme === 'stade' ? 2 : theme === 'humour' || theme === 'garba' ? 1 : r() < 0.4 ? 1 : 0
    const extras: Extra[] = Array.from({ length: n }, (_, i) => {
      const g = r() < 0.5 ? 'femme' : 'homme'
      return { x: (i % 2 ? 1 : -1) * (1.3 + r() * 0.5), z: -1.2 - r() * 1.2, look: randomLook(g, r), gender: g, pose: theme === 'humour' ? 'laugh' : theme === 'garba' ? 'talk' : moves[Math.floor(r() * moves.length)], seed: Math.floor(r() * 1000), turn: (i % 2 ? -1 : 1) * 0.3 }
    })
    return { pose, extras, hue: Math.floor(r() * 360), sway: 0.25 + r() * 0.35, dir: r() < 0.5 ? -1 : 1 }
  }, [theme, scene])
  const rig = useRef<THREE.Group>(null)
  const cam = useRef(new THREE.Vector3())
  // The phone moves a little, as in a hand: a slow sway and a push in.
  useFrame(({ camera, clock }) => {
    const t = clock.elapsedTime
    cam.current.set(Math.sin(t * 0.35) * plan.sway * plan.dir, 1.45 + Math.sin(t * 0.6) * 0.06, 4.8 - Math.sin(t * 0.25) * 0.5)
    camera.position.copy(cam.current)
    camera.lookAt(0, 1.05, 0)
    if (rig.current && theme === 'mode') rig.current.rotation.y = Math.sin(t * 0.8) * 0.9
  })
  const sky = SKY[theme] ?? '#333'
  return (
    <>
      <color attach="background" args={[sky]} />
      <hemisphereLight args={['#ffffff', '#806a50', theme === 'danse' ? 0.6 : 1.25]} />
      <directionalLight position={[3, 6, 5]} intensity={theme === 'danse' ? 0.5 : 1.1} />
      <Backdrop theme={theme} hue={plan.hue} scene={scene} />
      <group ref={rig}>
        <Human look={look} gender={gender === 'homme' ? 'homme' : 'femme'} pose={plan.pose} seed={scene % 997} full />
      </group>
      {plan.extras.map((e, i) => (
        <group key={i} position={[e.x, 0, e.z]} rotation={[0, e.turn, 0]}>
          <Human look={e.look} gender={e.gender} pose={e.pose} seed={e.seed} />
        </group>
      ))}
    </>
  )
}

function Floor({ c }: { c: string }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -4]}>
      <planeGeometry args={[40, 30]} />
      <meshLambertMaterial color={c} />
    </mesh>
  )
}

/** Club lights going round. */
function Lights({ hue }: { hue: number }) {
  const g = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    g.current?.children.forEach((m, i) => {
      const mat = (m as THREE.Mesh).material as THREE.MeshBasicMaterial
      mat.color.setHSL(((hue + i * 70 + t * 60) % 360) / 360, 0.9, 0.55 + Math.sin(t * 4 + i) * 0.15)
    })
  })
  return (
    <group ref={g}>
      {[-3, -1, 1, 3].map((x) => (
        <mesh key={x} position={[x, 3.2, -4]}>
          <sphereGeometry args={[0.35, 10, 8]} />
          <meshBasicMaterial color="#fff" />
        </mesh>
      ))}
    </group>
  )
}

function Backdrop({ theme, hue, scene }: { theme: string; hue: number; scene: number }) {
  switch (theme) {
    case 'danse':
      return (
        <>
          <Floor c="#2b1d3d" />
          <Box p={[0, 2, -5]} s={[12, 4, 0.3]} c="#20142e" />
          <Lights hue={hue} />
          <Sign p={[0, 3.4, -4.8]} w={3.2} text={tr('AMBIANCE')} bg="#ff2d95" />
        </>
      )
    case 'garba':
      return (
        <>
          <Floor c="#b98b5c" />
          <Box p={[0, 1.8, -6]} s={[14, 3.6, 0.3]} c="#e9c46a" />
          <StreetStall stall={{ id: `garba:tiki:${scene}`, kind: 'garba', at: [2.2, -2.2], rot: 0, seed: (scene % 100) / 100 }} hour={13} crowd={false} />
          <TableSet p={[-1.6, 0, -1.4]} c="#2a9d8f" />
        </>
      )
    case 'stade':
      return (
        <>
          <Floor c="#3f9b4a" />
          {[0, 1, 2].map((i) => (
            <Box key={i} p={[0, 0.6 + i * 0.9, -5 - i * 1.1]} s={[16, 0.9, 1.1]} c={['#ff7a00', '#f8f9fa', '#12a150'][i]} />
          ))}
          <Sign p={[0, 3.8, -8.5]} w={4} text={tr('ALLEZ LES ÉLÉPHANTS')} bg="#ff7a00" />
        </>
      )
    case 'zoo':
      return (
        <>
          <Floor c="#9c8a5a" />
          <group position={[2.5, 0, -6]} rotation={[0, -2.4, 0]} scale={0.8}>
            <Elephant />
          </group>
          {[-4, -2, 0, 2, 4].map((x) => (
            <Box key={x} p={[x, 0.5, -3]} s={[0.12, 1, 0.12]} c="#6b4f2a" />
          ))}
          <Box p={[0, 0.9, -3]} s={[10, 0.1, 0.1]} c="#6b4f2a" />
          <Palm p={[-3.5, 0, -6]} h={5} />
        </>
      )
    case 'mode':
      return (
        <>
          <Floor c="#f7e1ea" />
          <Box p={[0, 2, -3.5]} s={[12, 4, 0.2]} c={`hsl(${hue} 60% 82%)`} />
          <Box p={[-2.4, 1.1, -3]} s={[0.1, 2.2, 0.1]} c="#555" />
          <Box p={[-2.4, 2.2, -3]} s={[1.6, 0.06, 0.06]} c="#555" />
        </>
      )
    case 'sport':
      return (
        <>
          <Floor c="#e6cf9a" />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -12]}>
            <planeGeometry args={[60, 12]} />
            <meshLambertMaterial color="#2f8fc9" />
          </mesh>
          <Palm p={[-3, 0, -4]} h={6} />
          <Palm p={[3.4, 0, -5]} h={5} lean={-0.2} />
        </>
      )
    case 'humour':
      return (
        <>
          <Floor c="#c9a77a" />
          <Box p={[0, 1.6, -4]} s={[12, 3.2, 0.3]} c="#f1e3c8" />
          <Box p={[-1.6, 1.1, -3.8]} s={[1, 2.2, 0.1]} c="#7a4f2a" />
          <Box p={[2.2, 2, -3.8]} s={[1.2, 0.9, 0.1]} c="#5aa9e6" />
        </>
      )
    default:
      // vlog: a street of the quarter, painted houses and palms
      return (
        <>
          <Floor c="#8d8d8d" />
          {[-5, -2.5, 0, 2.5, 5].map((x, i) => (
            <Box key={x} p={[x, 1.6, -6]} s={[2.4, 3.2 + (i % 2) * 0.8, 2]} c={`hsl(${(hue + i * 47) % 360} 55% 70%)`} />
          ))}
          <Palm p={[-3.4, 0, -3.5]} h={5} />
          <Palm p={[3.6, 0, -4]} h={6} />
        </>
      )
  }
}
