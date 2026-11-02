import { useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Human, NoShadows, type Pose } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import { worldTime } from '../../lib/worldClock'
import type { Sim } from '../../lib/types'
import { rng } from '../themes'
import { Character } from '../Character'
import { TalkHuman } from '../Talkable'
import { BOX } from '../open/ruePrincesse'
import { mat, sign, type Spot, type XZ } from './bigPlace'
import { t as tr } from '../../lib/i18n'

// Grand-Bassam's beach, what's done there (backend game/bassam.go): the surf school's boards and the surfers
// riding the rollers in, the jet-skis and the ski boat out past the bar, the dive boat at anchor with its flag,
// the beach-volley court on the sand, the maître-nageur's lesson in the shallows, and at night the beach party
// round the fire. BeachScene's frame: the shore along x, the sea north (-z), the road south (+z); the rollers
// come in from z -30 to the water's edge (BeachScene's Sea, its breaker 0: p = t·0.11).

/** The volley court: its middle (the net across it, along z), its half-size. */
const VOLLEY: XZ = [40, 12]
const COURT: XZ = [8, 4]
/** The surf school's rack of boards, by the water. */
const RACK: XZ = [40, 3.4]
/** The beach party: the fire, the sound system each side. */
const FIRE: XZ = [40, 21.5]
/** The dive boat at anchor, the ski boat's round, the jet-skis' round. */
const DIVE_BOAT: XZ = [-8, -38]
const SKI_ROUND = { c: [-22, -62] as XZ, r: [36, 14] as XZ, w: 0.32 }
const JET_ROUND = { c: [24, -44] as XZ, r: [20, 9] as XZ, w: 0.55 }

/** The rides: done out on the water, the Sim drawn by them rather than standing on its spot. */
export const BASSAM_RIDES = new Set(['surf-cours', 'surf', 'jet-ski', 'ski-nautique', 'plongee'])
/** In the swimsuit for these (the water, the sand). */
export const BASSAM_SWIM = new Set([...BASSAM_RIDES, 'lecon-natation', 'beach-volley'])

export const BASSAM_SPOTS: Record<string, Spot> = {
  'surf-cours': { at: [RACK[0] - 1.2, RACK[1] - 1.4], rot: Math.PI, pose: 'idle' },
  surf: { at: [RACK[0] + 1.2, RACK[1] - 1.4], rot: Math.PI, pose: 'idle' },
  'jet-ski': { at: [30, 0.6], rot: Math.PI, pose: 'idle' },
  'ski-nautique': { at: [-24, 0.6], rot: Math.PI, pose: 'idle' },
  plongee: { at: [-8, 0.6], rot: Math.PI, pose: 'idle' },
  'beach-volley': { at: [VOLLEY[0] - 4, VOLLEY[1] + 2], rot: Math.PI / 2, pose: 'block' },
  // Lengths in the shallows by the lifeguard's chair, the maître-nageur beside, the buoy.
  'lecon-natation': { at: [24, -4.6], rot: Math.PI / 2, pose: 'swim', swim: 3, from: [24, -0.3] },
  'beach-party': { at: [FIRE[0], FIRE[1] - 3.6], rot: 0, pose: 'dance' },
}

/** Not walked through: the net's posts, the fire, the speakers, the rack. */
export function bassamBlocked(x: number, z: number) {
  if (Math.abs(x - VOLLEY[0]) < 0.3 && (Math.abs(z - (VOLLEY[1] - COURT[1] - 0.5)) < 0.3 || Math.abs(z - (VOLLEY[1] + COURT[1] + 0.5)) < 0.3)) return true
  if (Math.hypot(x - FIRE[0], z - FIRE[1]) < 1.3) return true
  for (const sx of [-6, 6]) if (Math.abs(x - (FIRE[0] + sx)) < 0.7 && Math.abs(z - (FIRE[1] + 2)) < 0.6) return true
  return Math.abs(x - RACK[0]) < 2 && Math.abs(z - RACK[1]) < 0.5
}

type Look = Sim['look']
type Who = { look: Look; gender: 'femme' | 'homme'; stage: string; /** The player's Sim (its marker), or someone of the beach. */ me?: boolean; seed?: number }

/** Someone of the beach (or the Sim) in a pose that changes as the ride goes. */
function Rider({ who, pose }: { who: Who; pose: Pose }) {
  return who.me ? <Character look={who.look} gender={who.gender} pose={pose} stage={who.stage} /> : <Human look={who.look} gender={who.gender} pose={pose} seed={who.seed ?? 0} />
}

/** Where the Sim is while out on the water (its ride says, each frame): the camera goes out with it. */
const rideAt = { p: new THREE.Vector3(), on: 0 }
const track = (who: Who, o: THREE.Object3D | null) => {
  if (!who.me || !o) return
  o.getWorldPosition(rideAt.p)
  rideAt.on = performance.now()
}

/**
 * Out on the water, the camera follows the Sim's ride (the jet-ski round the bay, the surfer on the roller),
 * keeping the angle the player gave it; back on the sand, Guest's camera takes over again.
 */
function RideCamera() {
  const camera = useThree((st) => st.camera)
  const controls = useThree((st) => st.controls) as unknown as { target: THREE.Vector3; update: () => void } | null
  useFrame((_, dt) => {
    if (!controls || performance.now() - rideAt.on > 300) return
    const k = 1 - Math.exp(-3 * Math.min(dt, 0.1))
    const d = rideAt.p.clone().setY(0).sub(controls.target).multiplyScalar(k)
    controls.target.add(d)
    camera.position.add(d)
    controls.update()
  })
  return null
}

/** A pose kept by what the frame loop says (set only when it changes). */
function usePose(first: Pose) {
  const [pose, setPose] = useState<Pose>(first)
  const now = useRef(first)
  return [pose, (p: Pose) => p !== now.current && ((now.current = p), setPose(p))] as const
}

function Board({ color }: { color: string }) {
  return (
    <group>
      <mesh geometry={BOX} scale={[0.55, 0.07, 2.1]} material={mat(color)} castShadow />
      <mesh geometry={BOX} position={[0, 0.04, 0]} scale={[0.08, 0.02, 1.9]} material={mat('#f8f9fa')} />
      <mesh geometry={BOX} position={[0, -0.03, 0.85]} scale={[0.4, 0.06, 0.35]} material={mat(color)} />
    </group>
  )
}

/**
 * A surfer: out through the white water lying on the board and paddling, a roller caught out past the bar,
 * up on the board riding it in to the shallows, then off and back out. In step with BeachScene's breakers.
 */
export function SurfRide({ x0, who, color = '#ffd43b', offset = 0 }: { x0: number; who: Who; color?: string; offset?: number }) {
  const g = useRef<THREE.Group>(null)
  const board = useRef<THREE.Group>(null)
  const [pose, setPose] = usePose('swim')
  const [up, setUp] = useState(false)
  useFrame(() => {
    const o = g.current
    if (!o) return
    // Two breaker periods a go: the first out, the second in on breaker 0 (its p = u - 1).
    const u = (worldTime() * 0.11 + offset * 2) % 2
    let z: number
    let ry = Math.PI
    let standing = false
    if (u < 1.3) {
      // Paddling out over the swell.
      z = -3.5 - 17.8 * Math.min(1, u / 1.3)
      setPose('swim')
    } else if (u < 1.92) {
      // On the roller, riding it in.
      z = -30 + 29 * (u - 1) + 0.6
      ry = 0
      standing = true
      setPose('airplane')
    } else {
      z = -3.3
      ry = 0
      setPose('sit')
    }
    const t = worldTime()
    o.position.set(x0 + Math.sin(u * 2.4) * 2.5, 0.06 + Math.sin(t * 1.7 + x0) * 0.05 + (standing ? 0.08 : 0), z)
    o.rotation.set(0, ry + (standing ? Math.sin(t * 0.9) * 0.35 : 0), standing ? Math.sin(t * 1.3) * 0.12 : 0)
    if (board.current) board.current.rotation.x = standing ? -0.12 : 0.05
    if (standing !== up) setUp(standing)
    track(who, o)
  })
  return (
    <group ref={g}>
      <group ref={board}>
        <Board color={color} />
      </group>
      {/* Lying on it paddling, sitting astride waiting, up on it riding */}
      <group position={[0, pose === 'swim' ? 0.14 : pose === 'sit' ? -0.28 : 0.05, pose === 'swim' ? 0.2 : 0]} rotation={pose === 'swim' ? [-Math.PI / 2, 0, 0] : [0, up ? Math.PI / 2 : 0, 0]}>
        <Rider who={who} pose={pose} />
      </group>
    </group>
  )
}

function JetSki({ color }: { color: string }) {
  return (
    <group>
      <mesh geometry={BOX} position={[0, 0.15, 0]} scale={[0.85, 0.35, 2.6]} material={mat('#f8f9fa')} castShadow />
      <mesh geometry={BOX} position={[0, 0.38, 0.35]} scale={[0.75, 0.16, 1.5]} material={mat(color)} />
      <mesh geometry={BOX} position={[0, 0.5, -0.1]} scale={[0.45, 0.14, 0.9]} material={mat('#212529')} />
      <mesh geometry={BOX} position={[0, 0.7, 0.75]} scale={[0.75, 0.06, 0.08]} material={mat('#343a40')} />
      <mesh geometry={BOX} position={[0, 0.18, 1.35]} scale={[0.5, 0.25, 0.3]} material={mat(color)} />
    </group>
  )
}

/** The white wake and spray behind something going fast on the water (in its frame, behind it: -z). */
function Wake({ len = 6 }: { len?: number }) {
  const parts = useRef<(THREE.Mesh | null)[]>([])
  useFrame(() => {
    const t = worldTime()
    parts.current.forEach((m, i) => {
      if (!m) return
      const k = ((t * 2 + i / 6) % 1) * len
      m.position.set(Math.sin(i * 2.1) * 0.25 * (1 + k / 2), 0.04, -1.2 - k)
      const s = 0.35 + k * 0.35
      m.scale.set(s, 0.05, s * 0.6)
    })
  })
  return (
    <group>
      {[...Array(6)].map((_, i) => (
        <mesh key={i} ref={(m) => void (parts.current[i] = m)} geometry={BOX}>
          <meshLambertMaterial color="#ffffff" transparent opacity={0.7} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

/** A jet-ski going round out past the bar, leaning into its turn, jumping the swell, its wake behind. */
export function JetRide({ who, color = '#e03131', phase = 0 }: { who: Who; color?: string; phase?: number }) {
  const g = useRef<THREE.Group>(null)
  useFrame(() => {
    const o = g.current
    if (!o) return
    const a = worldTime() * JET_ROUND.w + phase
    const [cx, cz] = JET_ROUND.c
    const [rx, rz] = JET_ROUND.r
    o.position.set(cx + Math.cos(a) * rx, 0.05 + Math.abs(Math.sin(a * 5)) * 0.18, cz + Math.sin(a) * rz)
    // Facing along the round (its derivative), leaning in.
    o.rotation.set(Math.sin(a * 5) * 0.08, Math.atan2(-Math.sin(a) * rx, Math.cos(a) * rz), -0.28)
    track(who, o)
  })
  return (
    <group ref={g}>
      <JetSki color={color} />
      <Wake />
      <group position={[0, 0.12, 0.05]}>
        <Rider who={who} pose="sit" />
      </group>
    </group>
  )
}

function SpeedBoat({ color, flag }: { color: string; flag?: boolean }) {
  return (
    <group>
      <mesh geometry={BOX} position={[0, 0.3, 0]} scale={[2, 0.7, 5.2]} material={mat('#f8f9fa')} castShadow />
      <mesh geometry={BOX} position={[0, 0.3, 2.9]} rotation={[0, Math.PI / 4, 0]} scale={[1.4, 0.68, 1.4]} material={mat('#f8f9fa')} />
      <mesh geometry={BOX} position={[0, 0.5, 0]} scale={[2.05, 0.14, 5.25]} material={mat(color)} />
      <mesh geometry={BOX} position={[0, 0.95, 0.9]} rotation={[-0.4, 0, 0]} scale={[1.6, 0.5, 0.06]} material={mat('#9ad1e6')} />
      <mesh geometry={BOX} position={[0, 0.5, -2.75]} scale={[0.5, 0.8, 0.4]} material={mat('#343a40')} />
      {flag && (
        <group position={[0.7, 0, -1.8]}>
          <mesh geometry={BOX} position={[0, 1.5, 0]} scale={[0.05, 2, 0.05]} material={mat('#adb5bd')} />
          {/* The diver-down flag: red, the white stripe across */}
          <mesh geometry={BOX} position={[0, 2.25, 0.35]} scale={[0.02, 0.5, 0.7]} material={mat('#e03131')} />
          <mesh geometry={BOX} position={[0.012, 2.25, 0.35]} rotation={[0.6, 0, 0]} scale={[0.02, 0.1, 0.82]} material={mat('#f8f9fa')} />
        </group>
      )}
    </group>
  )
}

/** The ski boat round its course, the skier on the rope behind it up on two skis, cutting across the wake. */
export function SkiRide({ who }: { who: Who }) {
  const boat = useRef<THREE.Group>(null)
  const skier = useRef<THREE.Group>(null)
  const rope = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const t = worldTime()
    const at = (a: number, wide = 0): [number, number] => [SKI_ROUND.c[0] + Math.cos(a) * (SKI_ROUND.r[0] + wide), SKI_ROUND.c[1] + Math.sin(a) * (SKI_ROUND.r[1] + wide)]
    const head = (a: number) => Math.atan2(-Math.sin(a) * SKI_ROUND.r[0], Math.cos(a) * SKI_ROUND.r[1])
    const a = t * SKI_ROUND.w
    const b = boat.current
    const [bx, bz] = at(a)
    if (b) {
      b.position.set(bx, 0.05 + Math.sin(t * 3) * 0.04, bz)
      b.rotation.set(-0.06, head(a), -0.08)
    }
    // The skier a rope's length behind, swinging out from side to side across the wake.
    const back = a - 0.42
    const [sx, sz] = at(back, Math.sin(t * 0.8) * 3)
    const s = skier.current
    if (s) {
      s.position.set(sx, 0.08, sz)
      s.rotation.set(0, head(back), Math.sin(t * 0.8) * 0.3)
    }
    track(who, s)
    const r = rope.current
    if (r) {
      const [ex, ez] = [bx - Math.sin(head(a)) * 2.8, bz - Math.cos(head(a)) * 2.8]
      const [hx, hz] = [sx + Math.sin(head(back)) * 0.5, sz + Math.cos(head(back)) * 0.5]
      r.position.set((ex + hx) / 2, 0.9, (ez + hz) / 2)
      r.rotation.set(0, Math.atan2(hx - ex, hz - ez), 0)
      r.scale.set(0.03, 0.03, Math.hypot(hx - ex, hz - ez))
    }
  })
  return (
    <group>
      <group ref={boat}>
        <SpeedBoat color="#1d4ed8" />
        <Wake len={9} />
        <group position={[0, 0.55, 0.6]}>
          <Human look={useMemo(() => randomLook('homme', rng('ski-pilote')), [])} gender="homme" pose="sit" seed={3} />
        </group>
      </group>
      <group ref={skier}>
        {[-0.18, 0.18].map((x) => (
          <mesh key={x} geometry={BOX} position={[x, 0, 0.2]} scale={[0.14, 0.05, 1.7]} material={mat('#ffd43b')} />
        ))}
        <Wake len={4} />
        <group rotation={[0.25, 0, 0]}>
          <Rider who={who} pose="push" />
        </group>
      </group>
      <mesh ref={rope} geometry={BOX} material={mat('#f8f9fa')} />
    </group>
  )
}

/** The dive boat at anchor; the diver sitting on its side, rolling back into the water, under (the bubbles), up again. */
export function DiveRide({ who }: { who: Who }) {
  const diver = useRef<THREE.Group>(null)
  const bubbles = useRef<(THREE.Mesh | null)[]>([])
  const [pose, setPose] = usePose('sit')
  const [under, setUnder] = useState(false)
  const boat = useRef<THREE.Group>(null)
  useFrame(() => {
    const t = worldTime()
    const u = (t / 18) % 1
    if (boat.current) boat.current.rotation.set(Math.sin(t * 1.1) * 0.03, 0.4, Math.sin(t * 0.8) * 0.04)
    const d = diver.current
    let down = false
    if (d) {
      if (u < 0.2) {
        setPose('sit')
        d.position.set(1.1, 0.75, 0)
        d.rotation.set(0, -Math.PI / 2, 0)
      } else if (u < 0.28) {
        // Back first over the side, the hand on the mask.
        const k = (u - 0.2) / 0.08
        setPose('dive')
        d.position.set(1.1 + k * 1.2, 0.75 - k * 1.4, 0)
        d.rotation.set(0, -Math.PI / 2, k * 1.6)
      } else if (u < 0.86) {
        down = true
      } else {
        setPose('swim')
        d.position.set(2.6, -0.1, Math.sin(t) * 0.3)
        d.rotation.set(-Math.PI / 2, -Math.PI / 2, 0)
      }
    }
    if (down !== under) setUnder(down)
    track(who, d)
    // While under, the bubbles come up where the diver is.
    bubbles.current.forEach((m, i) => {
      if (!m) return
      m.visible = down
      const k = (t * 0.9 + i / 7) % 1
      m.position.set(3 + Math.sin(t * 0.3) * 1.5 + Math.sin(i * 3) * 0.3, 0.05 + k * 0.08, Math.cos(t * 0.25) * 1.5 + Math.cos(i * 2) * 0.3)
      m.scale.setScalar(0.08 + k * 0.12)
    })
  })
  return (
    <group position={[DIVE_BOAT[0], 0.05, DIVE_BOAT[1]]}>
      <group ref={boat}>
        <SpeedBoat color="#e8590c" flag />
      </group>
      <group ref={diver} visible={!under}>
        <Rider who={who} pose={pose} />
        {/* The tank on the back */}
        <mesh position={[0, 1.15, -0.22]}>
          <cylinderGeometry args={[0.1, 0.1, 0.55, 10]} />
          <meshLambertMaterial color="#ffd43b" />
        </mesh>
      </group>
      {[...Array(7)].map((_, i) => (
        <mesh key={i} ref={(m) => void (bubbles.current[i] = m)} visible={false}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshLambertMaterial color="#ffffff" transparent opacity={0.8} />
        </mesh>
      ))}
    </group>
  )
}

/** The volley court on the sand: its rope lines, the net, the other three players, the ball going over. */
function Volley({ night, playing }: { night: boolean; playing: boolean }) {
  const players = useMemo(() => {
    const r = rng('bassam-volley')
    return ([
      [VOLLEY[0] + 4, VOLLEY[1] - 2, -Math.PI / 2],
      [VOLLEY[0] + 4, VOLLEY[1] + 2, -Math.PI / 2],
      [VOLLEY[0] - 4, VOLLEY[1] - 2, Math.PI / 2],
      // (The fourth, the Sim's place when it plays.)
      [VOLLEY[0] - 4, VOLLEY[1] + 2, Math.PI / 2],
    ] as [number, number, number][]).map(([x, z, ry], i) => {
      const gender: 'femme' | 'homme' = r() < 0.5 ? 'femme' : 'homme'
      return { x, z, ry, gender, look: { ...randomLook(gender, r), outfit: 'maillot', outfitColor: i < 2 ? '#e03131' : '#1d4ed8', accessory: 'none' }, seed: r() * 100 }
    })
  }, [])
  const ball = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const m = ball.current
    if (!m) return
    // From one player to the one across the net, and back, a high arc each time.
    const t = worldTime() / 1.3
    const i = Math.floor(t) % 4
    const k = t % 1
    const order = [3, 0, 2, 1]
    const a = players[order[i]]
    const b = players[order[(i + 1) % 4]]
    m.position.set(a.x + (b.x - a.x) * k, 2.2 + Math.sin(k * Math.PI) * 3.2, a.z + (b.z - a.z) * k)
  })
  if (night) return null
  const [cx, cz] = VOLLEY
  const [hx, hz] = COURT
  const line = mat('#1d4ed8')
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh geometry={BOX} position={[cx, 0.03, cz + s * hz]} scale={[hx * 2, 0.02, 0.06]} material={line} />
          <mesh geometry={BOX} position={[cx + s * hx, 0.03, cz]} scale={[0.06, 0.02, hz * 2]} material={line} />
          <mesh geometry={BOX} position={[cx, 1.25, cz + s * (hz + 0.5)]} scale={[0.08, 2.5, 0.08]} material={mat('#f8f9fa')} />
        </group>
      ))}
      <mesh geometry={BOX} position={[cx, 2.15, cz]} scale={[0.03, 0.85, hz * 2 + 1]}>
        <meshLambertMaterial color="#212529" transparent opacity={0.55} />
      </mesh>
      <mesh geometry={BOX} position={[cx, 2.58, cz]} scale={[0.05, 0.07, hz * 2 + 1]} material={mat('#f8f9fa')} />
      <mesh ref={ball} castShadow>
        <sphereGeometry args={[0.11, 12, 10]} />
        <meshLambertMaterial color="#ffe066" />
      </mesh>
      <NoShadows>
        {players.slice(0, playing ? 3 : 4).map((p, i) => (
          <group key={i} position={[p.x, 0, p.z]} rotation={[0, p.ry, 0]}>
            <TalkHuman id={`bassam-volley-${i}`} look={p.look} gender={p.gender} pose={i % 2 ? 'block' : 'cheer'} seed={p.seed} />
          </group>
        ))}
      </NoShadows>
    </group>
  )
}

/** The surf school by the water: its sign, the boards up on their rack. */
function SurfSchool() {
  const label = useMemo(() => sign(tr('ÉCOLE DE SURF · BASSAM'), '#1d4ed8', '#ffd43b', 512, 96), [])
  const colors = ['#ffd43b', '#e03131', '#2f9e44', '#f8f9fa', '#e8590c', '#7048e8']
  return (
    <group position={[RACK[0], 0, RACK[1]]}>
      {[-1.8, 1.8].map((x) => (
        <mesh key={x} geometry={BOX} position={[x, 0.9, 0]} scale={[0.1, 1.8, 0.1]} material={mat('#8a5a2b')} />
      ))}
      <mesh geometry={BOX} position={[0, 1.7, 0]} scale={[3.8, 0.08, 0.12]} material={mat('#8a5a2b')} />
      {colors.map((c, i) => (
        <group key={i} position={[-1.5 + i * 0.6, 1.05, 0.12]} rotation={[0.18, 0, 0]}>
          <group rotation={[Math.PI / 2, 0, 0]}>
            <Board color={c} />
          </group>
        </group>
      ))}
      <mesh position={[0, 2.3, 0]} material={label}>
        <planeGeometry args={[3.6, 0.68]} />
      </mesh>
      {/* The orange buoys marking the bathing zone, out in the water */}
      {[-14, -6, 2].map((dx) => (
        <mesh key={dx} position={[dx * 1.5, 0.1, -9 - RACK[1]]}>
          <sphereGeometry args={[0.25, 10, 8]} />
          <meshLambertMaterial color="#ff8c00" />
        </mesh>
      ))}
    </group>
  )
}

/** The beach party at night: the fire, its light flickering, the speakers, the lights strung on poles, the dancers round. */
function Party({ dancing }: { dancing: boolean }) {
  const flame = useRef<THREE.Group>(null)
  const light = useRef<THREE.PointLight>(null)
  useFrame(() => {
    const t = worldTime()
    if (flame.current) flame.current.scale.set(1, 0.85 + Math.sin(t * 13) * 0.1 + Math.sin(t * 7) * 0.08, 1)
    if (light.current) light.current.intensity = 55 + Math.sin(t * 11) * 10 + Math.sin(t * 5.3) * 8
  })
  const dancers = useMemo(() => {
    const r = rng('bassam-party')
    return [...Array(10)].map((_, i) => {
      const a = (i / 10) * Math.PI * 2 + 0.3
      const gender: 'femme' | 'homme' = r() < 0.5 ? 'femme' : 'homme'
      return { x: FIRE[0] + Math.cos(a) * 3.6, z: FIRE[1] + Math.sin(a) * 3.1, ry: Math.atan2(FIRE[0] - (FIRE[0] + Math.cos(a)), FIRE[1] - (FIRE[1] + Math.sin(a))), gender, look: randomLook(gender, r), seed: r() * 100 }
    })
  }, [])
  const bulbs = ['#ffd43b', '#e03131', '#2f9e44', '#4dabf7', '#f783ac']
  return (
    <group>
      <group position={[FIRE[0], 0, FIRE[1]]}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} geometry={BOX} position={[0, 0.12, 0]} rotation={[0, (i * Math.PI) / 4, 0.15]} scale={[1.4, 0.14, 0.14]} material={mat('#5c3d1e')} />
        ))}
        <group ref={flame}>
          <mesh position={[0, 0.6, 0]}>
            <coneGeometry args={[0.45, 1.2, 7]} />
            <meshBasicMaterial color="#ff8c00" />
          </mesh>
          <mesh position={[0, 0.5, 0]}>
            <coneGeometry args={[0.28, 0.8, 7]} />
            <meshBasicMaterial color="#ffe066" />
          </mesh>
        </group>
        <pointLight ref={light} position={[0, 1.4, 0]} distance={18} color="#ffb05c" intensity={55} />
      </group>
      {/* The sound system, each side */}
      {[-6, 6].map((dx) => (
        <group key={dx} position={[FIRE[0] + dx, 0, FIRE[1] + 2]}>
          <mesh geometry={BOX} position={[0, 0.8, 0]} scale={[0.9, 1.6, 0.8]} material={mat('#212529')} />
          {[0.45, 1.15].map((y) => (
            <mesh key={y} position={[0, y, -0.41]}>
              <circleGeometry args={[0.28, 16]} />
              <meshBasicMaterial color="#495057" />
            </mesh>
          ))}
        </group>
      ))}
      {/* The lights strung from pole to pole round the dancing */}
      {[-7, 7].map((dx) => (
        <mesh key={dx} geometry={BOX} position={[FIRE[0] + dx, 1.6, FIRE[1] - 3]} scale={[0.08, 3.2, 0.08]} material={mat('#8a5a2b')} />
      ))}
      {[...Array(15)].map((_, i) => {
        const k = i / 14
        return (
          <mesh key={i} position={[FIRE[0] - 7 + k * 14, 3.1 - Math.sin(k * Math.PI) * 0.6, FIRE[1] - 3]}>
            <sphereGeometry args={[0.09, 8, 6]} />
            <meshBasicMaterial color={bulbs[i % bulbs.length]} />
          </mesh>
        )
      })}
      <NoShadows>
        {dancers.slice(0, dancing ? 9 : 10).map((d, i) => (
          <group key={i} position={[d.x, 0, d.z]} rotation={[0, d.ry, 0]}>
            <TalkHuman id={`bassam-fete-${i}`} look={d.look} gender={d.gender} pose={i % 3 === 2 ? 'cheer' : 'dance'} seed={d.seed} />
          </group>
        ))}
      </NoShadows>
    </group>
  )
}

/** The maître-nageur in the shallows by the Sim's lengths, the float in hand. */
function SwimTeacher() {
  const look = useMemo(() => ({ ...randomLook('homme', rng('bassam-mn')), outfit: 'debardeur', outfitColor: '#e03131', accessory: 'none' }), [])
  return (
    <group position={[24, -0.75, -2.7]} rotation={[0, Math.PI, 0]}>
      <TalkHuman id="bassam-maitre-nageur" look={look} gender="homme" pose="talk" seed={7} />
      <mesh position={[0.45, 1.6, 0.2]}>
        <torusGeometry args={[0.3, 0.09, 8, 16]} />
        <meshLambertMaterial color="#ff6b00" />
      </mesh>
    </group>
  )
}

/**
 * All of Bassam's beach that isn't every beach's: the surf school, the court, the boats and skis out there with
 * the people of the beach on them (by day), the party (at night); and the Sim's own ride when it's doing one.
 */
export function BassamBeach({ night, interactionId, sim, stage, settled }: { night: boolean; interactionId?: string; sim: Sim; stage: string; /** The Sim come to its spot (its ride starts then). */ settled: boolean }) {
  const crowd = useMemo(() => {
    const r = rng('bassam-eau')
    return [...Array(4)].map(() => {
      const gender: 'femme' | 'homme' = r() < 0.5 ? 'femme' : 'homme'
      return { look: { ...randomLook(gender, r), outfit: 'maillot', accessory: 'none' }, gender, stage: 'adulte', seed: r() * 100 } as Who
    })
  }, [])
  const me: Who = { look: { ...sim.look, outfit: 'maillot', accessory: 'none' }, gender: sim.gender, stage, me: true }
  const id = interactionId ?? ''
  const riding = settled && BASSAM_RIDES.has(id)
  return (
    <group>
      <SurfSchool />
      <Volley night={night} playing={id === 'beach-volley'} />
      {!night && (
        <>
          {/* The others out on the water: two surfers, a jet-ski, the ski boat (unless the Sim's on them) */}
          <SurfRide x0={-34} who={crowd[0]} color="#e03131" offset={0.3} />
          <SurfRide x0={10} who={crowd[1]} color="#2f9e44" offset={0.65} />
          {!(riding && id === 'jet-ski') && <JetRide who={crowd[2]} color="#ffd43b" phase={2} />}
          {!(riding && id === 'ski-nautique') && <SkiRide who={crowd[3]} />}
          {!(riding && id === 'plongee') && (
            <group position={[DIVE_BOAT[0], 0.05, DIVE_BOAT[1]]} rotation={[0, 0.4, 0]}>
              <SpeedBoat color="#e8590c" flag />
            </group>
          )}
        </>
      )}
      {(night || id === 'beach-party') && <Party dancing={id === 'beach-party'} />}
      {id === 'lecon-natation' && <SwimTeacher />}
      {riding && (id === 'surf' || id === 'surf-cours') && <SurfRide x0={RACK[0] - 2} who={me} color="#7048e8" />}
      {riding && id === 'surf-cours' && <SurfRide x0={RACK[0] + 2} who={crowd[1]} color="#f8f9fa" offset={0.04} />}
      {riding && id === 'jet-ski' && <JetRide who={me} />}
      {riding && id === 'ski-nautique' && <SkiRide who={me} />}
      {riding && id === 'plongee' && <DiveRide who={me} />}
      {riding && <RideCamera />}
    </group>
  )
}
