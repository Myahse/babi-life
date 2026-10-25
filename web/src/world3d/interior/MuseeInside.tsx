import { SpotActions } from '../SpotActions'
import { Suspense, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Sim } from '../../lib/types'
import { worldTime } from '../../lib/worldClock'
import { Human, NoShadows, type Pose } from '../../avatar/Human'
import { OUTFIT_DEFAULT_COLOR, randomLook } from '../../avatar/options'
import { rng } from '../themes'
import { Snapper } from '../snapshot'
import { ChatFraming } from '../chatFraming'
import { TalkHuman } from '../Talkable'
import { BOX, Blocks } from '../open/ruePrincesse'
import { Guest, mat, sign, useBigWalk, type Spot, type XZ, spotWhere } from './bigPlace'

// Inside the Musée des Civilisations (Plateau): its one great hall, as in
// the real one, all on one floor. Masks along the back wall (the Dan's dark
// ovals, the Guro's long faces, the Baoulé's horned discs, the Sénoufo's), the
// carved figures on their plinths down the middle, the cases of Akan
// gold-weights between them, the kente and the Korhogo cloths on the left
// wall, a carved door and the drums on the right. A guide talks to a school
// class gathered before the masks; visitors go round slowly, filming. Frame:
// +z the doors, y 0 the floor.

const HX = 19
const HZ = 11
const WALL = 5.5
const ENTRANCE: XZ = [0, HZ - 1.5]
const PLINTHS: XZ[] = [-15, -9, -3, 3, 9, 15].flatMap((x): XZ[] => [[x, -3.4], [x, 3.4]])
const CASES: XZ[] = [-12, -6, 6, 12].map((x): XZ => [x, 0])
const DRUMS: XZ[] = [[HX - 1.6, -5], [HX - 1.6, -3.4], [HX - 2.4, -4.2]]
/** Where the guide stands, and where the class sits before her. */
const GUIDE: XZ = [-14, -HZ + 2]
const CLASS: XZ = [-14, -HZ + 4.6]

function free(x: number, z: number) {
  if (Math.abs(x) > HX - 0.6 || Math.abs(z) > HZ - 0.6) return false
  for (const [px, pz] of PLINTHS) if (Math.abs(x - px) < 1.1 && Math.abs(z - pz) < 1.1) return false
  for (const [cx, cz] of CASES) if (Math.abs(x - cx) < 1.3 && Math.abs(z - cz) < 0.9) return false
  for (const [dx, dz] of DRUMS) if (Math.hypot(x - dx, z - dz) < 0.8) return false
  if (Math.hypot(x - CLASS[0], z - CLASS[1]) < 2.2) return false
  return true
}

const SPOTS: Record<string, Spot> = {
  // Round the hall, slowly, from piece to piece.
  'visite-musee': { at: [12.5, 0], rot: 0, pose: 'walk', loop: { c: [0, 0], r: [12.5, 6.4], speed: 0.05 } },
  // Bent over a case of gold-weights.
  exposition: { at: [6, 1.25], rot: Math.PI, pose: 'idle' },
  // With the class, before the guide.
  'visite-guidee': { at: [CLASS[0] + 2.8, CLASS[1] + 0.6], rot: Math.atan2(GUIDE[0] - CLASS[0] - 2.8, GUIDE[1] - CLASS[1] - 0.6), pose: 'idle' },
}

export function MuseeInside({ sim, interactionId, roam, night, stage }: { sim: Sim; interactionId?: string; /** Just come in: walk about (tap the floor, or the keys). */ roam?: boolean; night: boolean; stage: string }) {
  const spot = interactionId ? (SPOTS[interactionId] ?? null) : null
  const { way, tap, onMoved } = useBigWalk(spot, interactionId, roam, free, ENTRANCE)
  const hour = Math.floor((sim.gameMinutes ?? 0) / 60) % 24
  const open = hour >= 9 && hour < 17
  return (
    <div className="absolute inset-0">
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [0, 15, 22], fov: 45, near: 0.3, far: 600 }} style={{ background: night ? '#0b1026' : '#e9dcc4' }}>
        <Snapper />
        <ChatFraming />
        <Suspense fallback={null}>
          <hemisphereLight args={['#fff4e0', '#8a6a44', 0.9]} />
          <directionalLight position={[10, 30, 18]} intensity={0.8} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-24} shadow-camera-right={24} shadow-camera-top={16} shadow-camera-bottom={-16} />
          {[-12, 0, 12].map((x) => (
            <pointLight key={x} position={[x, 4.6, -HZ + 2.5]} intensity={22} distance={10} color="#ffd9a0" />
          ))}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
            onClick={(e) => {
              if (!roam || interactionId || e.delta > 6) return
              e.stopPropagation()
              tap([e.point.x, e.point.z])
            }}
          >
            <planeGeometry args={[2 * HX, 2 * HZ]} />
            <meshLambertMaterial color="#b98a5e" />
          </mesh>
          <Walls />
          <Masks />
          {PLINTHS.map((p, i) => (
            <Plinth key={i} at={p} kind={i % 3} seed={i} />
          ))}
          {CASES.map((c, i) => (
            <Case key={i} at={c} seed={i} />
          ))}
          <Cloths />
          <DoorAndDrums />
          <People open={open} />
          <Guest sim={sim} stage={stage} way={way} spot={spot} steer={!!roam && !interactionId} onMoved={onMoved} free={free} entrance={ENTRANCE} />
          <SpotActions shown={!!roam && !interactionId} where={spotWhere(SPOTS)} entrance={[ENTRANCE[0], 0, ENTRANCE[1]]} />
          <OrbitControls makeDefault target={[0, 1, 2]} enablePan={false} minDistance={5} maxDistance={60} minPolarAngle={0.25} maxPolarAngle={1.3} enableDamping />
        </Suspense>
      </Canvas>
    </div>
  )
}

/** The walls (low on the doors' side, for the eye), the labels over each part of the hall. */
function Walls() {
  const walls = useMemo(
    () => [
      { p: [0, WALL / 2, -HZ - 0.25] as [number, number, number], s: [2 * HX + 1, WALL, 0.5] as [number, number, number] },
      { p: [-HX - 0.25, WALL / 2, 0] as [number, number, number], s: [0.5, WALL, 2 * HZ] as [number, number, number] },
      { p: [HX + 0.25, WALL / 2, 0] as [number, number, number], s: [0.5, WALL, 2 * HZ] as [number, number, number] },
      { p: [-(HX + 2.5) / 2, 0.6, HZ + 0.25] as [number, number, number], s: [HX - 2.5, 1.2, 0.5] as [number, number, number] },
      { p: [(HX + 2.5) / 2, 0.6, HZ + 0.25] as [number, number, number], s: [HX - 2.5, 1.2, 0.5] as [number, number, number] },
    ],
    [],
  )
  const labels = useMemo(() => ['MASQUES', 'TEXTILES', 'PORTES ET TAMBOURS'].map((t) => sign(t, '#5a2e14', '#f4ead2', 512, 96)), [])
  return (
    <group>
      <Blocks at={walls} material={mat('#efe2c8')} />
      <mesh position={[0, 4.7, -HZ + 0.02]} scale={[5, 0.9, 1]} material={labels[0]}>
        <planeGeometry />
      </mesh>
      <mesh position={[-HX + 0.02, 4.7, 0]} rotation={[0, Math.PI / 2, 0]} scale={[5, 0.9, 1]} material={labels[1]}>
        <planeGeometry />
      </mesh>
      <mesh position={[HX - 0.02, 4.7, 0]} rotation={[0, -Math.PI / 2, 0]} scale={[6, 0.9, 1]} material={labels[2]}>
        <planeGeometry />
      </mesh>
    </group>
  )
}

/** One mask: its face, its eyes and mouth, what crowns it, after the four styles (0 Dan, 1 Guro, 2 Baoulé goli, 3 Sénoufo). */
function Mask({ style, color }: { style: number; color: string }) {
  const face = mat(color)
  const dark = mat('#17120e')
  return (
    <group>
      {style === 2 ? (
        // The goli: a flat disc, two horns over it.
        <>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={face}>
            <cylinderGeometry args={[0.42, 0.42, 0.08, 18]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.24, 0.6, 0]} rotation={[0, 0, s * 0.25]} material={face}>
              <coneGeometry args={[0.07, 0.6, 6]} />
            </mesh>
          ))}
        </>
      ) : (
        <mesh scale={style === 1 ? [0.28, 0.62, 0.16] : [0.34, 0.5, 0.18]} material={face}>
          <sphereGeometry args={[1, 12, 10]} />
        </mesh>
      )}
      {/* The eyes, the mouth */}
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={BOX} position={[s * 0.12, 0.08, 0.17]} scale={[0.12, style === 0 ? 0.08 : 0.03, 0.03]} material={dark} />
      ))}
      <mesh geometry={BOX} position={[0, -0.24, 0.16]} scale={[0.12, 0.05, 0.03]} material={dark} />
      {style === 1 && (
        // The Guro's horns curving up and back.
        <>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.12, 0.78, -0.04]} rotation={[-0.3, 0, s * 0.15]} material={face}>
              <coneGeometry args={[0.05, 0.55, 6]} />
            </mesh>
          ))}
        </>
      )}
      {style === 3 && (
        // The Sénoufo kpelié: the side wings and the crest.
        <>
          {[-1, 1].map((s) => (
            <mesh key={s} geometry={BOX} position={[s * 0.4, -0.1, 0]} rotation={[0, 0, s * 0.4]} scale={[0.22, 0.06, 0.06]} material={face} />
          ))}
          <mesh geometry={BOX} position={[0, 0.62, 0]} scale={[0.5, 0.12, 0.06]} material={face} />
        </>
      )}
    </group>
  )
}

/** The masks along the back wall, each on its plaque, lit from above. */
function Masks() {
  const list = useMemo(() => {
    const r = rng('musee-masques')
    return [...Array(12)].map((_, i) => ({ x: -16.5 + i * 3, style: i % 4, color: ['#3b2416', '#5a3a22', '#e8e0d0', '#2a1a10', '#7a3a1c'][Math.floor(r() * 5)] }))
  }, [])
  return (
    <group position={[0, 0, -HZ + 0.05]}>
      {list.map((m) => (
        <group key={m.x} position={[m.x, 2.6, 0]}>
          <mesh geometry={BOX} position={[0, 0.1, 0]} scale={[1.3, 1.9, 0.08]} material={mat('#e3d5b8')} />
          <group position={[0, 0.05, 0.25]}>
            <Mask style={m.style} color={m.color} />
          </group>
        </group>
      ))}
    </group>
  )
}

/** A plinth and the carved figure on it: standing, a mother and child sitting, or an antelope (the Bambara's chi wara). */
function Plinth({ at, kind, seed }: { at: XZ; kind: number; seed: number }) {
  const wood = mat(['#4a2e1c', '#3b2416', '#5a3a22'][seed % 3])
  return (
    <group position={[at[0], 0, at[1]]}>
      <mesh geometry={BOX} position={[0, 0.55, 0]} scale={[1.2, 1.1, 1.2]} material={mat('#f1e9d8')} castShadow />
      <group position={[0, 1.1, 0]}>
        {kind === 0 && (
          <>
            <mesh position={[0, 0.35, 0]} material={wood} castShadow>
              <cylinderGeometry args={[0.16, 0.2, 0.7, 8]} />
            </mesh>
            <mesh position={[0, 0.95, 0]} material={wood} castShadow>
              <cylinderGeometry args={[0.15, 0.17, 0.6, 8]} />
            </mesh>
            <mesh position={[0, 1.45, 0]} scale={[0.7, 1.2, 0.75]} material={wood} castShadow>
              <sphereGeometry args={[0.2, 10, 8]} />
            </mesh>
          </>
        )}
        {kind === 1 && (
          <>
            <mesh geometry={BOX} position={[0, 0.2, 0]} scale={[0.5, 0.4, 0.45]} material={wood} castShadow />
            <mesh position={[0, 0.65, -0.05]} material={wood} castShadow>
              <cylinderGeometry args={[0.15, 0.19, 0.6, 8]} />
            </mesh>
            <mesh position={[0, 1.08, -0.05]} scale={[0.7, 1.15, 0.75]} material={wood} castShadow>
              <sphereGeometry args={[0.18, 10, 8]} />
            </mesh>
            <mesh position={[0, 0.6, 0.18]} scale={[0.6, 0.8, 0.6]} material={wood}>
              <sphereGeometry args={[0.14, 8, 6]} />
            </mesh>
          </>
        )}
        {kind === 2 && (
          <>
            <mesh geometry={BOX} position={[0, 0.35, 0]} scale={[0.18, 0.3, 0.7]} material={wood} castShadow />
            <mesh geometry={BOX} position={[0, 0.15, 0]} scale={[0.1, 0.3, 0.5]} material={wood} />
            <mesh position={[0, 0.65, 0.36]} rotation={[0.5, 0, 0]} material={wood}>
              <cylinderGeometry args={[0.05, 0.07, 0.4, 6]} />
            </mesh>
            {[-1, 1].map((s) => (
              <mesh key={s} position={[s * 0.05, 1.15, 0.4]} rotation={[-0.25, 0, 0]} material={wood}>
                <coneGeometry args={[0.035, 0.75, 6]} />
              </mesh>
            ))}
          </>
        )}
      </group>
    </group>
  )
}

/** A case of Akan gold-weights: its stand, the glass, the little brass figures inside. */
function Case({ at, seed }: { at: XZ; seed: number }) {
  const pieces = useMemo(() => {
    const r = rng(`poids-${seed}`)
    return [...Array(9)].map(() => ({ p: [(r() - 0.5) * 1.6, 1.02 + r() * 0.04, (r() - 0.5) * 0.7] as [number, number, number], s: [0.06 + r() * 0.08, 0.05 + r() * 0.1, 0.06 + r() * 0.06] as [number, number, number], ry: r() * 3 }))
  }, [seed])
  return (
    <group position={[at[0], 0, at[1]]}>
      <mesh geometry={BOX} position={[0, 0.48, 0]} scale={[2.2, 0.96, 1.2]} material={mat('#5a3a22')} castShadow />
      <mesh geometry={BOX} position={[0, 0.98, 0]} scale={[2, 0.04, 1]} material={mat('#2b1a10')} />
      <Blocks at={pieces} material={mat('#c99a2e', '#3a2a05')} />
      <mesh position={[0, 1.3, 0]}>
        <boxGeometry args={[2.1, 0.62, 1.1]} />
        <meshLambertMaterial color="#d8eef5" transparent opacity={0.22} depthWrite={false} />
      </mesh>
    </group>
  )
}

/** A kente (bands and checks in orange, gold, green and black), or a Korhogo cloth (black figures painted on raw cotton). */
function cloth(kind: 'kente' | 'korhogo', seed: string) {
  const r = rng(seed)
  const c = document.createElement('canvas')
  c.width = 192
  c.height = 256
  const g = c.getContext('2d')!
  if (kind === 'kente') {
    const cols = ['#f08c00', '#ffd43b', '#2b8a3e', '#17171a', '#c92a2a']
    for (let y = 0; y < 256; y += 32)
      for (let x = 0; x < 192; x += 32) {
        g.fillStyle = cols[Math.floor(r() * cols.length)]
        g.fillRect(x, y, 32, 32)
        g.fillStyle = cols[Math.floor(r() * cols.length)]
        for (let k = 4; k < 32; k += 8) g.fillRect(x + ((y / 32) % 2 ? k : 0), y + ((y / 32) % 2 ? 0 : k), (y / 32) % 2 ? 3 : 32, (y / 32) % 2 ? 32 : 3)
      }
  } else {
    g.fillStyle = '#e8dcc0'
    g.fillRect(0, 0, 192, 256)
    g.fillStyle = '#1b1610'
    for (let i = 0; i < 7; i++) {
      // A figure: a body, legs, a head (a bird, a fish, a man), in the cloth's flat black.
      const [x, y] = [24 + r() * 140, 24 + r() * 200]
      g.beginPath()
      g.ellipse(x, y, 10 + r() * 10, 5 + r() * 6, r() * 3, 0, Math.PI * 2)
      g.fill()
      g.fillRect(x - 8, y + 4, 2, 12)
      g.fillRect(x + 6, y + 4, 2, 12)
      g.beginPath()
      g.arc(x + 14, y - 6, 4, 0, Math.PI * 2)
      g.fill()
    }
    g.strokeStyle = '#1b1610'
    g.lineWidth = 4
    g.strokeRect(6, 6, 180, 244)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return new THREE.MeshLambertMaterial({ map: t, side: THREE.DoubleSide })
}

/** The cloths hung on the left wall: two kente, two Korhogo. */
function Cloths() {
  const list = useMemo(() => [cloth('kente', 'kente-a'), cloth('korhogo', 'korhogo-a'), cloth('kente', 'kente-b'), cloth('korhogo', 'korhogo-b')], [])
  return (
    <group position={[-HX + 0.1, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
      {list.map((m, i) => (
        <group key={i} position={[-7.5 + i * 5, 0, 0]}>
          <mesh geometry={BOX} position={[0, 4.3, 0.05]} scale={[3.4, 0.08, 0.08]} material={mat('#5a3a22')} />
          <mesh position={[0, 2.6, 0.06]} scale={[3, 3.4, 1]} material={m}>
            <planeGeometry />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** On the right wall: a Sénoufo granary door carved in relief; before it, the talking drums. */
function DoorAndDrums() {
  const relief = useMemo(() => {
    const r = rng('porte-sculptee')
    return [...Array(14)].map(() => ({ p: [0.06, 0.6 + r() * 3, -1.1 + r() * 2.2] as [number, number, number], s: [0.08, 0.15 + r() * 0.25, 0.15 + r() * 0.3] as [number, number, number] }))
  }, [])
  return (
    <group>
      <group position={[HX - 0.05, 0, 3]} rotation={[0, Math.PI, 0]}>
        <mesh geometry={BOX} position={[0, 2.2, 0]} scale={[0.1, 3.8, 2.6]} material={mat('#3b2416')} />
        <Blocks at={relief} material={mat('#5a3a22')} />
      </group>
      {DRUMS.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.7 + i * 0.1, 0]} castShadow>
            <cylinderGeometry args={[0.32, 0.22, 1.4 + i * 0.2, 12]} />
            <meshLambertMaterial color="#6b3e22" />
          </mesh>
          <mesh position={[0, 1.42 + i * 0.2, 0]}>
            <cylinderGeometry args={[0.33, 0.33, 0.04, 12]} />
            <meshLambertMaterial color="#e8d8b0" />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** Someone walking slowly round the hall, stopping to look now and then. */
function Wanderer({ seed, r: radius, speed, phase }: { seed: string; r: XZ; speed: number; phase: number }) {
  const g = useRef<THREE.Group>(null)
  const who = useMemo(() => {
    const r = rng(seed)
    const gender: 'femme' | 'homme' = r() < 0.5 ? 'femme' : 'homme'
    return { gender, look: randomLook(gender, r) }
  }, [seed])
  const [still, setStill] = useState(false)
  useFrame(() => {
    if (!g.current) return
    // Walk 8 s, stop 4 s to look at what's there (turned to the wall), on round the hall.
    const t = worldTime() + phase
    const k = t % 12
    const moving = k < 8
    const a = (Math.floor(t / 12) * 8 + Math.min(k, 8)) * speed
    g.current.position.set(Math.cos(a) * radius[0], 0, Math.sin(a) * radius[1])
    const s = Math.sign(speed)
    g.current.rotation.y = moving ? Math.atan2(-Math.sin(a) * radius[0] * s, Math.cos(a) * radius[1] * s) : Math.atan2(Math.cos(a) * radius[0], Math.sin(a) * radius[1])
    if (!moving !== still) setStill(!moving)
  })
  return (
    <group ref={g}>
      <TalkHuman id={`musee:${seed}`} look={who.look} gender={who.gender} pose={still ? 'film' : 'walk'} speed={0.7} seed={seed.length} />
    </group>
  )
}

/** The guide talking, a hand out to the masks; the class round her in its uniforms, the teacher at the back; visitors about; the guard. */
function People({ open }: { open: boolean }) {
  const [move, setMove] = useState(0)
  useFrame(() => {
    const k = Math.floor(worldTime() / 3.5) % 3
    if (k !== move) setMove(k)
  })
  const cls = useMemo(() => {
    const r = rng('musee-eleves')
    return [...Array(9)].map((_, i) => {
      const gender: 'femme' | 'homme' = r() < 0.5 ? 'femme' : 'homme'
      const a = -0.9 + (i % 5) * 0.45
      const d = i < 5 ? 1.2 : 2.1
      const p: [number, number, number] = [CLASS[0] + Math.sin(a) * d, 0, CLASS[1] - 1.4 + Math.cos(a) * d]
      return { p, ry: Math.atan2(GUIDE[0] - p[0], GUIDE[1] - p[2]), gender, look: { ...randomLook(gender, r), outfit: 'uniforme', outfitColor: OUTFIT_DEFAULT_COLOR.uniforme, accessory: 'none' }, seed: r() * 100, pose: (r() < 0.3 ? 'wave' : 'idle') as Pose }
    })
  }, [])
  const adults = useMemo(() => {
    const r = rng('musee-adultes')
    const one = (p: [number, number, number], ry: number, pose: Pose, dress?: string, g?: 'femme' | 'homme') => {
      const gender: 'femme' | 'homme' = g ?? (r() < 0.5 ? 'femme' : 'homme')
      const look = randomLook(gender, r)
      return { p, ry, pose, gender, look: dress ? { ...look, outfit: dress } : look, seed: r() * 100 }
    }
    return [
      one([3.2, 0, HZ - 1.4], 0, 'idle', 'vigile', 'homme'),
      one([CLASS[0] - 3, 0, CLASS[1] + 1.8], Math.PI - 0.5, 'idle', 'robe', 'femme'),
      one([10.5, 0, -HZ + 1.8], Math.PI, 'film'),
      one([11.6, 0, -HZ + 2.1], Math.PI, 'idle'),
      one([-12, 0, 1.25], Math.PI, 'idle'),
    ]
  }, [])
  const guide = useMemo(() => ({ ...randomLook('femme', rng('musee-guide')), outfit: 'chemise-pagne' }), [])
  if (!open)
    return (
      <NoShadows>
        <TalkHuman id="musee-gardien" look={adults[0].look} gender="homme" pose="idle" seed={adults[0].seed} />
      </NoShadows>
    )
  return (
    <NoShadows>
      <group position={[GUIDE[0], 0, GUIDE[1]]} rotation={[0, 0.15, 0]}>
        <TalkHuman id="musee-guide" look={guide} gender="femme" pose={(['talk', 'rant', 'wave'] as Pose[])[move]} seed={11} />
      </group>
      {/* The pupils: children, never talked to; round the guide, a hand up now and then */}
      {cls.map((c, i) => (
        <group key={i} position={c.p} rotation={[0, c.ry, 0]} scale={0.72}>
          <Human look={c.look} gender={c.gender} pose={c.pose === 'wave' && move !== i % 3 ? 'idle' : c.pose} seed={c.seed} />
        </group>
      ))}
      {adults.map((g, i) => (
        <group key={i} position={g.p} rotation={[0, g.ry, 0]}>
          <TalkHuman id={`musee-${i}`} look={g.look} gender={g.gender} pose={g.pose} seed={g.seed} />
        </group>
      ))}
      <Wanderer seed="musee-a" r={[13, 6.6]} speed={0.06} phase={0} />
      <Wanderer seed="musee-b" r={[13, 6.6]} speed={-0.05} phase={40} />
      <Wanderer seed="musee-c" r={[13.5, 7.6]} speed={0.055} phase={90} />
    </NoShadows>
  )
}
