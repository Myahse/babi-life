import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Box } from '../props'
import { worldTime } from '../../lib/worldClock'
import type { Pose } from '../../avatar/Human'

// The salle de jeux vidéo of the quarter (game kind 'gaming', the map's
// shop=video_games): along the back wall a long table with the TVs, a console
// under each and a match going on every screen; the benches in front where
// the boys sit, the controller in their hands, the others standing behind
// them to comment; two arcade cabinets on the side wall; the manager's counter
// and the fridge of sucreries by the door; neon along the walls, the paint
// dark so the screens stand out.

type V3 = [number, number, number]
type Spot = { p: V3; r?: number; pose: Pose }

/** Where the TVs are along the back wall (x), and what's on each. */
const TVS: { x: number; game: Game }[] = [
  { x: -3.3, game: 'foot' },
  { x: -1.1, game: 'combat' },
  { x: 1.1, game: 'foot' },
  { x: 3.3, game: 'course' },
]
type Game = 'foot' | 'course' | 'combat'
const SCREEN = { w: 1.36, h: 0.76, y: 1.3, z: -3.98 }
/** The players on the benches (x, z), the Sim's place (0.7) left free. */
const PLAYERS: [number, number][] = [
  [-3.7, -2.3],
  [-2.9, -2.3],
  [-1.1, -2.3],
  [1.5, -2.3],
  [2.9, -2.3],
  [3.7, -2.3],
]

/** A light that glows (the screens, the neon): not lit by the room. */
function Glow({ p, s, c, r }: { p: V3; s: V3; c: string; r?: V3 }) {
  return (
    <mesh position={p} rotation={r}>
      <boxGeometry args={s} />
      <meshBasicMaterial color={c} toneMapped={false} />
    </mesh>
  )
}

/**
 * What a TV shows, moving: a match of foot seen from above (the pitch, the
 * two teams running after the ball), a race (the road going by, two cars
 * side by side), or a fight (two fighters jumping at each other). In the
 * screen's own frame, facing +z, centred on it.
 */
function GameScreen({ game, seed }: { game: Game; seed: number }) {
  const moving = useRef<THREE.Group>(null)
  const [w, h] = [SCREEN.w, SCREEN.h]
  const dots = useMemo(() => [...Array(game === 'foot' ? 6 : 2)].map((_, i) => ({ k: i, ph: seed * 1.7 + i * 2.1 })), [game, seed])
  useFrame(() => {
    const g = moving.current
    if (!g) return
    const t = worldTime() + seed * 3.1
    g.children.forEach((o, i) => {
      if (game === 'foot') {
        // The players after the ball, the ball going from one side to the other.
        if (i === g.children.length - 1) o.position.set(Math.sin(t * 0.9) * w * 0.38, Math.sin(t * 1.7) * h * 0.3, 0.004)
        else {
          const d = dots[i]
          o.position.set(Math.sin(t * 0.9 + d.ph * 0.3) * w * 0.36 + Math.sin(t * 2.3 + d.ph) * 0.08, Math.cos(t * 1.3 + d.ph) * h * 0.32, 0.003)
        }
      } else if (game === 'course') {
        // The road's marks going down the screen, the two cars swerving a little.
        if (i < 4) o.position.y = (((-(t * 0.9) + i * 0.25) % 1) + 1) % 1 * h - h / 2
        else o.position.x = (i === 4 ? -0.18 : 0.18) + Math.sin(t * 1.4 + i) * 0.08
      } else {
        // The two fighters coming at each other and jumping back.
        const k = Math.sin(t * 2.2)
        o.position.set((i === 0 ? -1 : 1) * (0.22 - Math.max(0, k) * 0.14), -h * 0.12 + Math.max(0, Math.sin(t * 3.1 + i * 1.5)) * 0.1, 0.003)
      }
    })
  })
  if (game === 'foot')
    return (
      <group>
        <Glow p={[0, 0, 0]} s={[w, h, 0.002]} c="#2f9e44" />
        <Glow p={[0, 0, 0.002]} s={[0.012, h * 0.92, 0.001]} c="#e9fbe9" />
        <Glow p={[-w / 2 + 0.03, 0, 0.002]} s={[0.012, h * 0.4, 0.001]} c="#e9fbe9" />
        <Glow p={[w / 2 - 0.03, 0, 0.002]} s={[0.012, h * 0.4, 0.001]} c="#e9fbe9" />
        <group ref={moving}>
          {dots.map((d) => (
            <Glow key={d.k} p={[0, 0, 0.003]} s={[0.05, 0.05, 0.001]} c={d.k % 2 ? '#ff7a00' : '#1c7ed6'} />
          ))}
          <Glow p={[0, 0, 0.004]} s={[0.03, 0.03, 0.001]} c="#ffffff" />
        </group>
      </group>
    )
  if (game === 'course')
    return (
      <group>
        <Glow p={[0, 0, 0]} s={[w, h, 0.002]} c="#5c940d" />
        <Glow p={[0, 0, 0.001]} s={[w * 0.55, h, 0.001]} c="#495057" />
        <group ref={moving}>
          {[0, 1, 2, 3].map((i) => (
            <Glow key={i} p={[0, 0, 0.002]} s={[0.02, 0.08, 0.001]} c="#f8f9fa" />
          ))}
          <Glow p={[-0.18, -h * 0.25, 0.003]} s={[0.1, 0.16, 0.001]} c="#e03131" />
          <Glow p={[0.18, -h * 0.2, 0.003]} s={[0.1, 0.16, 0.001]} c="#fcc419" />
        </group>
      </group>
    )
  return (
    <group>
      <Glow p={[0, 0, 0]} s={[w, h, 0.002]} c="#5f3dc4" />
      <Glow p={[0, -h * 0.36, 0.001]} s={[w, h * 0.28, 0.001]} c="#2b1a57" />
      <Glow p={[0, h * 0.4, 0.002]} s={[w * 0.9, 0.04, 0.001]} c="#ffd43b" />
      <group ref={moving}>
        <Glow p={[-0.22, 0, 0.003]} s={[0.1, 0.24, 0.001]} c="#ff6b6b" />
        <Glow p={[0.22, 0, 0.003]} s={[0.1, 0.24, 0.001]} c="#74c0fc" />
      </group>
    </group>
  )
}

/** An arcade cabinet against the side wall (its back to it, x = -6), its screen and its controls facing the room. */
function Arcade({ z, c, seed }: { z: number; c: string; seed: number }) {
  return (
    <group position={[-5.55, 0, z]}>
      <Box p={[0, 0.85, 0]} s={[0.8, 1.7, 0.78]} c={c} />
      <Glow p={[0.05, 1.84, 0]} s={[0.72, 0.22, 0.7]} c={seed % 2 ? '#ffd43b' : '#ff6bd6'} />
      {/* The screen, tilted back, with its game */}
      <group position={[0.41, 1.36, 0]} rotation={[0, Math.PI / 2, 0]}>
        <group rotation={[-0.25, 0, 0]} scale={[0.42, 0.55, 1]}>
          <GameScreen game={seed % 2 ? 'combat' : 'course'} seed={seed} />
        </group>
      </group>
      {/* The control panel: the stick and the buttons */}
      <Box p={[0.52, 0.98, 0]} s={[0.3, 0.07, 0.7]} c="#1a1a1a" />
      <mesh position={[0.56, 1.06, -0.15]}>
        <cylinderGeometry args={[0.018, 0.018, 0.12, 6]} />
        <meshLambertMaterial color="#212529" />
      </mesh>
      <mesh position={[0.56, 1.13, -0.15]}>
        <sphereGeometry args={[0.035, 8, 6]} />
        <meshLambertMaterial color="#e03131" />
      </mesh>
      {[0.02, 0.12, 0.22].map((dz, i) => (
        <Glow key={dz} p={[0.56, 1.025, dz]} s={[0.05, 0.02, 0.05]} c={['#ffd43b', '#4dabf7', '#69db7c'][i]} />
      ))}
    </group>
  )
}

/** A controller in the hands of someone sitting before a TV (in their frame: they face +z). */
export function Controller({ p = [0, 0.66, 0.3] }: { p?: V3 }) {
  return (
    <group position={p}>
      <Box p={[0, 0, 0]} s={[0.16, 0.035, 0.08]} c="#1b1b1f" />
      <Box p={[-0.07, -0.005, -0.03]} s={[0.05, 0.035, 0.07]} c="#1b1b1f" />
      <Box p={[0.07, -0.005, -0.03]} s={[0.05, 0.035, 0.07]} c="#1b1b1f" />
      <Glow p={[0.035, 0.02, 0.01]} s={[0.02, 0.006, 0.02]} c="#4dabf7" />
    </group>
  )
}

/** The room: its colours, its furniture, where things are done, and who's there. */
export function gamingRoom(): { floor: string; wall: string; dark: boolean; furniture: React.ReactNode; spots: Record<string, Spot>; crowd: Spot[] } {
  return {
    floor: '#2b2540',
    wall: '#3a2d5c',
    dark: false,
    furniture: (
      <>
        {/* The neon along the walls */}
        <Glow p={[0, 2.85, -4.4]} s={[11.4, 0.05, 0.03]} c="#c77dff" />
        <Glow p={[-5.9, 2.85, 0]} s={[0.03, 0.05, 8.6]} c="#22d3ee" />
        {/* The long table of the TVs, against the back wall */}
        <Box p={[0, 0.4, -3.95]} s={[9.2, 0.8, 0.8]} c="#3b2a1e" />
        {TVS.map(({ x, game }, i) => (
          <group key={x}>
            <Box p={[x, SCREEN.y, SCREEN.z - 0.06]} s={[SCREEN.w + 0.12, SCREEN.h + 0.1, 0.08]} c="#0b0b0f" />
            <group position={[x, SCREEN.y, SCREEN.z]}>
              <GameScreen game={game} seed={i + 1} />
            </group>
            {/* The console under it, its light on, and the wire of the controllers */}
            <Box p={[x - 0.35, 0.84, -3.8]} s={[0.42, 0.08, 0.32]} c="#16161a" />
            <Glow p={[x - 0.2, 0.86, -3.639]} s={[0.04, 0.012, 0.004]} c="#4dabf7" />
            {/* The bench in front of it */}
            <Box p={[x, 0.22, -2.3]} s={[1.8, 0.44, 0.42]} c="#6b4a2b" />
          </group>
        ))}
        <Arcade z={0.2} c="#3b1f78" seed={1} />
        <Arcade z={1.5} c="#7a1f4a" seed={2} />
        {/* The manager's counter by the door, the fridge of sucreries behind him */}
        <Box p={[4.4, 0.55, 2.4]} s={[2.2, 1.1, 0.7]} c="#3b2f5c" />
        <Box p={[5.45, 1, 1.2]} s={[0.8, 2, 0.75]} c="#e9ecef" />
        <Glow p={[5.04, 1.05, 1.2]} s={[0.01, 1.6, 0.6]} c="#a5d8ff" />
        {[0, 1, 2].map((k) => (
          <Box key={k} p={[5.0, 0.55 + k * 0.5, 1.2]} s={[0.04, 0.16, 0.5]} c={['#e03131', '#f08c00', '#2f9e44'][k]} />
        ))}
        {/* The controllers in the hands of the players on the benches (they face the TVs: -z) */}
        {PLAYERS.map(([x, z]) => (
          <group key={x} position={[x, 0.05, z]} rotation={[0, Math.PI, 0]}>
            <Controller />
          </group>
        ))}
        {/* A little table and its stools, for the sucrerie */}
        <Box p={[1.6, 0.38, 2.6]} s={[0.9, 0.06, 0.9]} c="#e9ecef" />
        <Box p={[1.6, 0.18, 2.6]} s={[0.08, 0.36, 0.08]} c="#868e96" />
      </>
    ),
    spots: {
      // On the bench before the third TV, the controller in the hands; its opponent beside.
      tv: { p: [0.7, 0.05, -2.3], r: Math.PI, pose: 'write' },
      arcade: { p: [-4.55, 0, 0.2], r: -Math.PI / 2, pose: 'busy' },
      // Standing behind the players, cheering the goal.
      watch: { p: [-3.3, 0, -1.25], r: Math.PI, pose: 'cheer' },
      table: { p: [1.6, 0, 3.25], r: Math.PI, pose: 'drink' },
      counter: { p: [4.4, 0, 3.1], r: Math.PI, pose: 'idle' },
      entrance: { p: [0, 0, 3.6], r: Math.PI, pose: 'idle' },
    },
    crowd: [
      // The players on the benches, controller in hand
      ...PLAYERS.map(([x, z]): Spot => ({ p: [x, 0.05, z], r: Math.PI, pose: 'write' })),
      // Those who watch and comment behind them
      { p: [-2.6, 0, -1.3], r: Math.PI, pose: 'talk' },
      { p: [3.3, 0, -1.2], r: Math.PI, pose: 'cheer' },
      // At the arcade cabinet, and the manager behind his counter
      { p: [-4.55, 0, 1.5], r: -Math.PI / 2, pose: 'busy' },
      { p: [4.4, 0, 1.75], pose: 'idle' },
    ],
  }
}
