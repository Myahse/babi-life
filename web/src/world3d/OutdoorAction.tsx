import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Human, NoShadows, type Pose } from '../avatar/Human'
import { randomLook } from '../avatar/options'
import { worldTime } from '../lib/worldClock'
import { Box } from './props'

// What the Sim is doing outside, at a place with no inside (the pitch, the
// beach, the gare, the lagoon, a nature site), set around it in the street
// view: the ball, the towel and the parasol, the bus stop, the railing…
// In the Sim's own frame: it faces +z, towards the place.

/** How the Sim stands (or sits) for an outdoor activity; undefined if there's no scene for it. */
export function outdoorPose(id?: string): Pose | undefined {
  switch (id) {
    case 'play-football':
      return 'kick'
    case 'play-basket':
      return 'dribble'
    case 'watch-match':
      return 'cheer'
    case 'swim':
      return 'wave'
    case 'chill-sand':
    case 'coucher-soleil':
      return 'sit'
    case 'eat-fish':
    case 'eat-brochette':
      return 'eat'
    case 'wait-gbaka':
    case 'photo-plateau':
    case 'photos':
      return 'phone'
    case 'balade-lagune':
    case 'hike':
      return 'idle'
    default:
      return undefined
  }
}

const seeded = (n: number) => () => ((n = (n * 16807) % 2147483647) / 2147483647)
function useLooks(n: number, seed: number) {
  return useMemo(() => {
    const r = seeded(seed)
    return [...Array(n)].map(() => {
      const gender: 'femme' | 'homme' = r() < 0.5 ? 'femme' : 'homme'
      return { gender, look: randomLook(gender, r), seed: r() * 100 }
    })
  }, [n, seed])
}

export function OutdoorAction({ id }: { id?: string }) {
  switch (id) {
    case 'play-football':
      return <Football />
    case 'play-basket':
      return <Basket />
    case 'watch-match':
      return <Match />
    case 'swim':
      return <Wade />
    case 'chill-sand':
      return <Lounge />
    case 'eat-fish':
      return <FishTable />
    case 'eat-brochette':
      return <Grill />
    case 'wait-gbaka':
      return <BusStop />
    case 'balade-lagune':
    case 'coucher-soleil':
    case 'photo-plateau':
      return <Railing seated={id === 'coucher-soleil'} />
    case 'hike':
      return <Hiker />
    default:
      return null
  }
}

/* ---------- Sport ---------- */

const ballMat = new THREE.MeshLambertMaterial({ color: '#f4f4f4' })
const orange = new THREE.MeshLambertMaterial({ color: '#e8590c' })

/** Keepy-uppy: the ball off the raised foot, again and again; friends watch and wait for it. */
function Football() {
  const ball = useRef<THREE.Mesh>(null)
  const friends = useLooks(3, 11)
  useFrame(() => {
    const k = (worldTime() * 1.6) % 1
    ball.current?.position.set(0.08, 0.45 + Math.sin(k * Math.PI) * 0.55, 0.35)
  })
  return (
    <group>
      <mesh ref={ball} material={ballMat}>
        <sphereGeometry args={[0.11, 10, 8]} />
      </mesh>
      <NoShadows>
        {friends.map((p, i) => {
          const a = (i - 1) * 0.9
          return (
            <group key={i} position={[Math.sin(a) * 3, 0, 2.6 + Math.cos(a) * 1.2]} rotation={[0, Math.PI + a, 0]}>
              <Human look={{ ...p.look, outfit: 'jersey' }} gender={p.gender} pose={i === 1 ? 'cheer' : 'idle'} seed={p.seed} />
            </group>
          )
        })}
      </NoShadows>
      {/* Two small goals made of whatever's there */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 4, 0, 1.5]}>
          {[-0.6, 0.6].map((z) => (
            <Box key={z} p={[0, 0.45, z]} s={[0.1, 0.9, 0.1]} c="#f8f9fa" />
          ))}
          <Box p={[0, 0.9, 0]} s={[0.1, 0.08, 1.3]} c="#f8f9fa" />
        </group>
      ))}
    </group>
  )
}

/** Dribbling at the hoop: the ball bounces from the hand. */
function Basket() {
  const ball = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const k = Math.abs(Math.sin(worldTime() * 7))
    ball.current?.position.set(0.32, 0.13 + k * 0.7, 0.28)
  })
  return (
    <group>
      <mesh ref={ball} material={orange}>
        <sphereGeometry args={[0.12, 10, 8]} />
      </mesh>
      <group position={[0, 0, 4.2]}>
        <Box p={[0, 1.6, 0.4]} s={[0.12, 3.2, 0.12]} c="#2b2b2b" />
        <Box p={[0, 3.25, 0.2]} s={[0.1, 0.1, 0.5]} c="#2b2b2b" />
        <Box p={[0, 3.3, 0]} s={[1.8, 1.05, 0.05]} c="#f8f9fa" />
        <Box p={[0, 3.05, -0.25]} s={[0.46, 0.03, 0.46]} c="#e85d04" />
      </group>
    </group>
  )
}

/** On the touchline, cheering: the players run up and down the pitch, the ball between them. */
function Match() {
  const players = useLooks(6, 23)
  const refs = useRef<(THREE.Group | null)[]>([])
  const ball = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const t = worldTime()
    const bx = Math.sin(t * 0.5) * 8
    refs.current.forEach((g, i) => {
      if (!g) return
      const x = bx + Math.sin(t * 0.9 + i * 1.7) * 3 + (i % 2 ? 2 : -2)
      g.position.set(x, 0, 5 + (i % 3) * 2.2)
      g.rotation.y = Math.cos(t * 0.5) > 0 ? Math.PI / 2 : -Math.PI / 2
    })
    ball.current?.position.set(bx, 0.11 + Math.abs(Math.sin(t * 3)) * 0.3, 6.5)
  })
  return (
    <NoShadows>
      <mesh ref={ball} material={ballMat}>
        <sphereGeometry args={[0.11, 10, 8]} />
      </mesh>
      {players.map((p, i) => (
        <group key={i} ref={(g) => void (refs.current[i] = g)}>
          <Human look={{ ...p.look, outfit: 'jersey', outfitColor: i % 2 ? '#f77f00' : '#009e60' }} gender={p.gender} pose="run" seed={p.seed} />
        </group>
      ))}
    </NoShadows>
  )
}

/* ---------- The beach, the lagoon ---------- */

const sea = new THREE.MeshLambertMaterial({ color: '#2f9fd8', transparent: true, opacity: 0.75 })
const foam = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6 })

/** In the sea up to the waist, waving at the beach; the waves go round. */
function Wade() {
  const ring = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const k = (worldTime() * 0.6) % 1
    if (ring.current) {
      ring.current.scale.setScalar(0.6 + k * 1.8)
      ;(ring.current.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - k)
    }
  })
  return (
    <group>
      <mesh material={sea} position={[0, 0.45, 0]}>
        <boxGeometry args={[3.2, 0.9, 3.2]} />
      </mesh>
      <mesh ref={ring} material={foam.clone()} position={[0, 0.91, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.45, 0.55, 24]} />
      </mesh>
    </group>
  )
}

/** On a pagne in the sand, under a parasol, a coconut to drink. */
function Lounge() {
  return (
    <group>
      <Box p={[0, 0.01, 0.2]} s={[0.9, 0.02, 1.7]} c="#f08c00" />
      <Box p={[0, 0.015, 0.2]} s={[0.7, 0.02, 1.5]} c="#7b2d26" />
      <Box p={[-0.8, 1.2, -0.3]} s={[0.05, 2.4, 0.05]} c="#f8f9fa" />
      <mesh position={[-0.8, 2.35, -0.3]}>
        <coneGeometry args={[1.3, 0.45, 8, 1, true]} />
        <meshLambertMaterial color="#e8432f" side={THREE.DoubleSide} />
      </mesh>
      <Box p={[0.55, 0.1, 0.6]} s={[0.2, 0.2, 0.2]} c="#6b8e23" />
      <Box p={[0.6, 0.24, 0.6]} s={[0.02, 0.1, 0.02]} c="#f8f9fa" />
    </group>
  )
}

/** The plastic table on the sand: braised fish, attiéké, a drink. */
function FishTable() {
  return (
    <group>
      <Box p={[0, 0.22, -0.05]} s={[0.45, 0.04, 0.45]} c="#f4f4f4" />
      <Box p={[0, 0.45, -0.05]} s={[0.42, 0.04, 0.05]} c="#f4f4f4" />
      <Box p={[0, 0.72, 0.5]} s={[0.9, 0.04, 0.7]} c="#f4f4f4" />
      <Box p={[0, 0.36, 0.5]} s={[0.06, 0.72, 0.06]} c="#dcdcdc" />
      <Box p={[0, 0.75, 0.42]} s={[0.36, 0.02, 0.26]} c="#ffffff" />
      <Box p={[-0.05, 0.79, 0.42]} s={[0.24, 0.05, 0.09]} c="#8a5a2b" />
      <Box p={[0.1, 0.77, 0.36]} s={[0.1, 0.03, 0.1]} c="#f3ecd2" />
      <Box p={[0.32, 0.86, 0.55]} s={[0.07, 0.24, 0.07]} c="#2e8b57" />
    </group>
  )
}

/** The brochette grill and its seller, the stool to eat on. */
function Grill() {
  const vendor = useLooks(1, 37)[0]
  return (
    <group>
      <Box p={[0, 0.22, -0.05]} s={[0.35, 0.44, 0.35]} c="#3b2a1a" />
      <group position={[0, 0, 1.1]}>
        <Box p={[0, 0.45, 0]} s={[0.9, 0.9, 0.35]} c="#2a2a2a" />
        <Box p={[0, 0.92, 0]} s={[0.85, 0.04, 0.3]} c="#ff5a1a" glow={0.8} />
        {[-0.3, -0.1, 0.1, 0.3].map((x) => (
          <Box key={x} p={[x, 0.96, 0]} s={[0.04, 0.04, 0.34]} c="#8a4b2a" />
        ))}
        <NoShadows>
          <group position={[0, 0, 0.55]} rotation={[0, Math.PI, 0]}>
            <Human look={vendor.look} gender={vendor.gender} pose="cook" seed={vendor.seed} />
          </group>
        </NoShadows>
      </group>
    </group>
  )
}

/** The gbaka stop: its sign, a bench, people waiting, phone in hand. */
function BusStop() {
  const waiting = useLooks(2, 51)
  return (
    <group>
      <Box p={[-1, 1.1, 0.4]} s={[0.06, 2.2, 0.06]} c="#adb5bd" />
      <Box p={[-1, 2.15, 0.4]} s={[0.5, 0.35, 0.04]} c="#00a862" />
      <Box p={[1.2, 0.42, -0.4]} s={[1.6, 0.08, 0.45]} c="#8a6a3d" />
      <NoShadows>
        <group position={[1.6, 0.04, -0.4]} rotation={[0, 0.2, 0]}>
          <Human look={waiting[0].look} gender={waiting[0].gender} pose="sit" seed={waiting[0].seed} />
        </group>
        <group position={[-1.8, 0, -0.2]} rotation={[0, 0.5, 0]}>
          <Human look={waiting[1].look} gender={waiting[1].gender} pose="phone" seed={waiting[1].seed} />
        </group>
      </NoShadows>
    </group>
  )
}

/** The railing over the water, to lean on or sit by. */
function Railing({ seated }: { seated: boolean }) {
  return (
    <group>
      {seated && <Box p={[0, 0.22, -0.05]} s={[1.6, 0.08, 0.45]} c="#8a6a3d" />}
      <group position={[0, 0, 0.8]}>
        <Box p={[0, 1.0, 0]} s={[4, 0.06, 0.06]} c="#dfe3e8" />
        <Box p={[0, 0.55, 0]} s={[4, 0.04, 0.04]} c="#dfe3e8" />
        {[-2, -1, 0, 1, 2].map((x) => (
          <Box key={x} p={[x, 0.5, 0]} s={[0.06, 1, 0.06]} c="#dfe3e8" />
        ))}
      </group>
    </group>
  )
}

/** Out walking: a backpack, a stick. */
function Hiker() {
  return (
    <group>
      <Box p={[0, 1.15, -0.2]} s={[0.36, 0.45, 0.2]} c="#2e8b57" />
      <Box p={[0, 1.4, -0.21]} s={[0.3, 0.06, 0.2]} c="#1e5f3a" />
      <Box p={[0.38, 0.65, 0.18]} s={[0.04, 1.3, 0.04]} c="#7a5233" />
    </group>
  )
}
