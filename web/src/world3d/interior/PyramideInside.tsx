import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Sim } from '../../lib/types'
import { worldTime } from '../../lib/worldClock'
import { NoShadows, type Pose } from '../../avatar/Human'
import { randomLook } from '../../avatar/options'
import { rng } from '../themes'
import { Snapper } from '../snapshot'
import { ChatFraming } from '../chatFraming'
import { Character } from '../Character'
import { TalkHuman } from '../Talkable'
import { BOX, Blocks } from '../open/ruePrincesse'
import { Pyramide } from '../open/landmarks'
import { Guest, mat, sign, useBigWalk, type Spot, type XZ } from './bigPlace'
import { Coffee } from './doings'

// Inside La Pyramide (Plateau): its ground floor, the gallery of shops all
// round under the stepped storeys, the open well in the middle going up to
// the sky (a fountain and palms at its foot), the lifts up to the offices on
// the far side, the café's tables out in the gallery, the job ads pinned up
// by the door. In the day the office people come and go; at night it's
// nearly empty. Up the lifts, its roof: the Plateau's towers all round and
// the lagoon. The frame: +z the doors, y 0 the floor; one square, 46 m a side,
// like the outside (landmarks.tsx).

/** Half the square; where the shops' fronts are; half the well. */
const H = 23
const F = 17
const WELL = 7
const WALL = 4.2
// Just in, past the hall: the gallery and the well in view.
const ENTRANCE: XZ = [0, F - 1.5]
/** Half the lifts' lobby, on the far side. */
const LOBBY = 7.6

type Shop = { name: string; c: XZ; n: XZ; w: number; color: string; bg: string; fg: string }

/** The shops round the gallery: each its front's middle, the way it faces (into the gallery), its width. */
const SHOPS: Shop[] = (() => {
  const out: Shop[] = []
  const row = (names: (string | null)[], edges: number[], at: (m: number) => XZ, n: XZ) =>
    names.forEach((name, i) => {
      if (!name) return
      const [a, b] = [edges[i], edges[i + 1]]
      out.push({ name, c: at((a + b) / 2), n, w: b - a, ...STYLE[out.length % STYLE.length] })
    })
  const STYLE = [
    { color: '#c9a227', bg: '#14213d', fg: '#ffd166' },
    { color: '#74c0fc', bg: '#ffffff', fg: '#1d4ed8' },
    { color: '#f783ac', bg: '#7a1f3d', fg: '#ffffff' },
    { color: '#00a862', bg: '#f4efe6', fg: '#0b6b3a' },
    { color: '#ff7a00', bg: '#17171a', fg: '#ff9f43' },
    { color: '#7b5cff', bg: '#ffffff', fg: '#4c2bd6' },
  ]
  // The far side: two shops each side of the lifts' lobby. (The corners are the back rooms.)
  row(['Librairie Les Gradins', 'Pressing du Plateau', null, 'Optique Lumière', 'Akwaba Voyages'], [-F, -12.3, -LOBBY, LOBBY, 12.3, F], (m) => [m, -F], [0, 1])
  // The door's side: two shops each side of the hall.
  row(['Change & Transferts', 'Photocopie · Saisie', null, 'Pharmacie de la Pyramide', 'Boutique Pagnes'], [-F, -11.5, -6, 6, 11.5, F], (m) => [m, F], [0, -1])
  row(['Cordonnerie', 'Téléphones & Accessoires', 'Assurances Sécurité', 'Parfumerie Anouk'], [-F, -8.5, 0, 8.5, F], (m) => [-F, m], [1, 0])
  // The café takes two widths, its tables out in the gallery.
  row(['Banque · Guichets', 'Café Pyramide', 'Salon Élégance'], [-F, -8.5, 8.5, F], (m) => [F, m], [-1, 0])
  return out
})()

/** The café's tables, out in front of it. */
const TABLES: XZ[] = [
  [13.6, -5.4],
  [13.6, -1.8],
  [13.6, 1.8],
  [13.6, 5.4],
]
/** The palms at the well's corners, the benches along its sides. */
const PALMS: XZ[] = [
  [-4.8, -4.8],
  [4.8, -4.8],
  [-4.8, 4.8],
  [4.8, 4.8],
]
const BENCHES: { at: XZ; rot: number }[] = [
  { at: [0, -5.9], rot: 0 },
  { at: [0, 5.9], rot: Math.PI },
  { at: [-5.9, 0], rot: Math.PI / 2 },
  { at: [5.9, 0], rot: -Math.PI / 2 },
]
/** The pillars round the well, holding the storeys over the gallery. */
const PILLARS: XZ[] = [-1, 0, 1].flatMap((i) => [-1, 1].flatMap((s): XZ[] => (i === 0 ? [[0, s * (WELL + 0.4)], [s * (WELL + 0.4), 0]] : [[i * (WELL + 0.4), s * (WELL + 0.4)]])))
const BOARD: XZ = [-5.85, 20]

function free(x: number, z: number) {
  if (Math.abs(x) > H - 0.6 || Math.abs(z) > H - 0.6) return false
  // The shops are behind glass: the gallery, the hall at the door, the lifts' lobby.
  const inGallery = Math.abs(x) < F - 0.4 && Math.abs(z) < F - 0.4
  const hall = Math.abs(x) < 5.6 && z > 0
  const lobby = Math.abs(x) < LOBBY - 0.4 && z < 0 && z > -H + 1.2
  if (!inGallery && !hall && !lobby) return false
  if (Math.hypot(x, z) < 2.9) return false
  for (const [px, pz] of PALMS) if (Math.abs(x - px) < 1.1 && Math.abs(z - pz) < 1.1) return false
  for (const [px, pz] of PILLARS) if (Math.abs(x - px) < 0.75 && Math.abs(z - pz) < 0.75) return false
  for (const [tx, tz] of TABLES) if (Math.hypot(x - tx, z - tz) < 1.3) return false
  for (const b of BENCHES) if (Math.abs(x - b.at[0]) < (b.rot % Math.PI ? 0.5 : 1.4) && Math.abs(z - b.at[1]) < (b.rot % Math.PI ? 1.4 : 0.5)) return false
  return true
}

const SPOTS: Record<string, Spot> = {
  // The ads by the door: a photo of the one that fits, on the phone.
  'read-ads': { at: [BOARD[0] + 0.9, BOARD[1]], rot: -Math.PI / 2, pose: 'phone' },
  // A coffee at the café's table, with the colleagues.
  'coffee-break': { at: [TABLES[2][0], TABLES[2][1] + 0.8], rot: Math.PI, pose: 'drink', y: 0.05, from: [TABLES[2][0] - 1.6, TABLES[2][1] + 0.8] },
  // Round the gallery, looking in the windows.
  'visiter-pyramide': { at: [11.6, 0], rot: 0, pose: 'walk', loop: { c: [0, 0], r: [11.6, 11.6], speed: 0.1 } },
}

export function PyramideInside({ sim, interactionId, roam, night, stage }: { sim: Sim; interactionId?: string; /** Just come in: walk about (tap the floor, or the keys). */ roam?: boolean; night: boolean; stage: string }) {
  if (interactionId === 'terrasse-pyramide') return <Roof sim={sim} night={night} stage={stage} />
  return <Gallery sim={sim} interactionId={interactionId} roam={roam} night={night} stage={stage} />
}

function Gallery({ sim, interactionId, roam, night, stage }: { sim: Sim; interactionId?: string; roam?: boolean; night: boolean; stage: string }) {
  const spot = interactionId ? (SPOTS[interactionId] ?? null) : null
  const { way, tap, onMoved } = useBigWalk(spot, interactionId, roam, free, ENTRANCE)
  // The open hours of the gallery: its shops lit and full, or shut.
  const hour = Math.floor((sim.gameMinutes ?? 0) / 60) % 24
  const open = hour >= 8 && hour < 19
  return (
    <div className="absolute inset-0">
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [0, 27, 18], fov: 45, near: 0.3, far: 900 }} style={{ background: night ? '#0b1026' : '#9ccbea' }}>
        <Snapper />
        <ChatFraming />
        <Suspense fallback={null}>
          <hemisphereLight args={[night ? '#7080c0' : '#ffffff', '#c9b48c', night ? 0.6 : 1.1]} />
          <directionalLight position={[20, 60, 25]} intensity={night ? 0.15 : 1.2} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-30} shadow-camera-right={30} shadow-camera-top={30} shadow-camera-bottom={-30} />
          {night && [-12, 12].flatMap((x) => [-12, 12].map((z) => <pointLight key={`${x}${z}`} position={[x, 3.6, z]} intensity={40} distance={20} color="#ffe6b8" />))}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
            onClick={(e) => {
              if (!roam || interactionId || e.delta > 6) return
              e.stopPropagation()
              tap([e.point.x, e.point.z])
            }}
          >
            <planeGeometry args={[2 * H, 2 * H]} />
            <meshLambertMaterial color="#ddd5c6" />
          </mesh>
          {/* Outside the doors: the pavement */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, H + 20]} receiveShadow>
            <planeGeometry args={[160, 40]} />
            <meshLambertMaterial color="#cfc6b5" />
          </mesh>
          <Shell />
          <Well night={night} />
          {SHOPS.map((s) => (
            <ShopFront key={s.name} s={s} night={night} open={open} />
          ))}
          <Lifts night={night} />
          <Cafe />
          <Board />
          <People night={night} open={open} />
          {/* The coffee break: the colleagues at the table, a coffee each */}
          {interactionId === 'coffee-break' && <Colleagues />}
          <Guest sim={sim} stage={stage} way={way} spot={spot} steer={!!roam && !interactionId} onMoved={onMoved} free={free} entrance={ENTRANCE}>
            {interactionId === 'coffee-break' && <Coffee />}
          </Guest>
          <OrbitControls makeDefault target={[0, 0, 4]} enablePan={false} minDistance={6} maxDistance={80} minPolarAngle={0.25} maxPolarAngle={1.3} enableDamping />
        </Suspense>
      </Canvas>
    </div>
  )
}

/** The outer walls (cut low on the door's side, for the eye), the shops' partitions and backs, the beam round the well. */
function Shell() {
  const walls = useMemo(() => {
    const b: { p: [number, number, number]; s: [number, number, number] }[] = [
      { p: [0, WALL / 2, -H], s: [2 * H, WALL, 0.5] },
      { p: [-H, WALL / 2, 0], s: [0.5, WALL, 2 * H] },
      { p: [H, WALL / 2, 0], s: [0.5, WALL, 2 * H] },
      // The door's side: low, the doors open in the middle.
      { p: [-(H + 4) / 2, 0.6, H], s: [H - 4, 1.2, 0.5] },
      { p: [(H + 4) / 2, 0.6, H], s: [H - 4, 1.2, 0.5] },
      // The hall's sides, the lobby's sides.
      { p: [-6, WALL / 2, (F + H) / 2], s: [0.25, WALL, H - F] },
      { p: [6, WALL / 2, (F + H) / 2], s: [0.25, WALL, H - F] },
      { p: [-LOBBY, WALL / 2, -(F + H) / 2], s: [0.25, WALL, H - F] },
      { p: [LOBBY, WALL / 2, -(F + H) / 2], s: [0.25, WALL, H - F] },
      // The corners: the back rooms, shut.
      ...[-1, 1].flatMap((i) => [-1, 1].map((k) => ({ p: [i * (F + H) / 2, WALL / 2, k * (F + H) / 2] as [number, number, number], s: [H - F, WALL, H - F] as [number, number, number] }))),
    ]
    // Between the shops, the walls across.
    for (const s of SHOPS) {
      const t: XZ = [-s.n[1], s.n[0]]
      for (const k of [-1, 1]) {
        const [x, z] = [s.c[0] + t[0] * k * (s.w / 2) - s.n[0] * 3, s.c[1] + t[1] * k * (s.w / 2) - s.n[1] * 3]
        b.push({ p: [x, WALL / 2, z], s: s.n[0] ? [6, WALL, 0.25] : [0.25, WALL, 6] })
      }
    }
    return b
  }, [])
  // The edge of the storey over the gallery, round the well, on its pillars.
  const ring = useMemo(() => {
    const e = WELL + 0.4
    return [
      { p: [0, WALL + 0.3, -e] as [number, number, number], s: [2 * e + 0.8, 0.6, 0.8] as [number, number, number] },
      { p: [0, WALL + 0.3, e] as [number, number, number], s: [2 * e + 0.8, 0.6, 0.8] as [number, number, number] },
      { p: [-e, WALL + 0.3, 0] as [number, number, number], s: [0.8, 0.6, 2 * e] as [number, number, number] },
      { p: [e, WALL + 0.3, 0] as [number, number, number], s: [0.8, 0.6, 2 * e] as [number, number, number] },
      ...PILLARS.map(([x, z]) => ({ p: [x, WALL / 2, z] as [number, number, number], s: [0.8, WALL, 0.8] as [number, number, number] })),
    ]
  }, [])
  return (
    <>
      <Blocks at={walls} material={mat('#efe8db')} />
      <Blocks at={ring} material={mat('#cfc6b5')} />
    </>
  )
}

/** The well: open to the sky, its fountain, the four palms in their planters, the benches. */
function Well({ night }: { night: boolean }) {
  const water = useRef<THREE.Mesh>(null)
  useFrame(() => {
    if (water.current) water.current.scale.y = 1 + Math.sin(worldTime() * 3) * 0.08
  })
  const benches = useMemo(() => BENCHES.flatMap((b) => {
    const along = b.rot % Math.PI ? [0.5, 0.45, 2.6] : [2.6, 0.45, 0.5]
    return [{ p: [b.at[0], 0.23, b.at[1]] as [number, number, number], s: along as [number, number, number] }]
  }), [])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[2 * WELL, 2 * WELL]} />
        <meshLambertMaterial color="#b9ad98" />
      </mesh>
      {/* The fountain */}
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[2.5, 2.6, 0.6, 24]} />
        <meshLambertMaterial color="#d8d0c0" />
      </mesh>
      <mesh position={[0, 0.58, 0]}>
        <cylinderGeometry args={[2.25, 2.25, 0.05, 24]} />
        <meshLambertMaterial color="#5fb3d6" emissive="#1d5f80" emissiveIntensity={night ? 0.6 : 0.15} />
      </mesh>
      <mesh ref={water} position={[0, 1.4, 0]}>
        <cylinderGeometry args={[0.08, 0.25, 1.6, 8]} />
        <meshLambertMaterial color="#bfe6f5" transparent opacity={0.7} />
      </mesh>
      {PALMS.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh geometry={BOX} position={[0, 0.4, 0]} scale={[1.6, 0.8, 1.6]} material={mat('#a68a64')} castShadow />
          <mesh position={[0, 3, 0]} castShadow>
            <cylinderGeometry args={[0.16, 0.24, 4.6, 6]} />
            <meshLambertMaterial color="#8a6a44" />
          </mesh>
          {[0, 1, 2, 3, 4, 5].map((k) => (
            <mesh key={k} geometry={BOX} position={[Math.sin(k * 1.05 + i) * 1, 5.1, Math.cos(k * 1.05 + i) * 1]} rotation={[Math.cos(k * 1.05 + i) * 0.5, k * 1.05 + i, -Math.sin(k * 1.05 + i) * 0.5]} scale={[0.5, 0.08, 2.2]} material={mat('#3f8a3a')} castShadow />
          ))}
        </group>
      ))}
      <Blocks at={benches} material={mat('#8a5a34')} />
    </group>
  )
}

/** A shop's front on the gallery: its glass, its door, its name over it; inside, its counter and shelves. */
function ShopFront({ s, night, open }: { s: Shop; night: boolean; open: boolean }) {
  const name = useMemo(() => sign(s.name.toUpperCase(), s.bg, s.fg, 768, 128), [s])
  const rot = Math.atan2(s.n[0], s.n[1])
  const lit = open || night
  return (
    <group position={[s.c[0], 0, s.c[1]]} rotation={[0, rot, 0]}>
      {/* The shop's floor and its back: its colours */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -3]}>
        <planeGeometry args={[s.w - 0.3, 6]} />
        <meshLambertMaterial color={open ? '#f2ede4' : '#b8b2a6'} />
      </mesh>
      <mesh geometry={BOX} position={[0, 1.2, -5.6]} scale={[s.w - 1.2, 2.4, 0.5]} material={mat(s.color)} castShadow />
      <mesh geometry={BOX} position={[0, 0.5, -2.4]} scale={[Math.min(3, s.w * 0.4), 1, 0.7]} material={mat('#5a4636')} castShadow />
      {/* The kick plate, the glass each side of the door, the band with the name */}
      {[-1, 1].map((k) => (
        <group key={k}>
          <mesh geometry={BOX} position={[k * (s.w / 4 + 0.45), 0.25, 0]} scale={[s.w / 2 - 1.2, 0.5, 0.2]} material={mat('#3a3d44')} />
          <mesh position={[k * (s.w / 4 + 0.45), 1.85, 0]}>
            <boxGeometry args={[s.w / 2 - 1.2, 2.7, 0.06]} />
            <meshLambertMaterial color="#bcd9e8" transparent opacity={0.3} />
          </mesh>
        </group>
      ))}
      {/* The shutter halfway down when it's shut */}
      {!open && <mesh geometry={BOX} position={[0, 2.4, 0.1]} scale={[s.w - 0.4, 1.6, 0.08]} material={mat('#8e9399')} />}
      <mesh position={[0, 3.7, 0.12]}>
        <planeGeometry args={[s.w - 0.4, 0.95]} />
        <primitive object={name} attach="material" />
      </mesh>
      {lit && <mesh geometry={BOX} position={[0, 3.15, -1]} scale={[s.w - 1, 0.06, 0.3]} material={mat('#ffffff', '#fff2cf')} />}
    </group>
  )
}

/** The lifts up to the offices, on the far side: three doors, their floor numbers lit, the sign. */
function Lifts({ night }: { night: boolean }) {
  const s = useMemo(() => sign('BUREAUX · ÉTAGES 1 À 15', '#2b3a55', '#ffffff', 768, 112), [])
  const floors = useRef<THREE.Mesh[]>([])
  useFrame(() => {
    // Each lift's light moves on as it goes up and down.
    floors.current.forEach((m, i) => m && (m.position.x = -0.5 + (Math.sin(worldTime() * 0.4 + i * 2) * 0.5 + 0.5)))
  })
  return (
    <group position={[0, 0, -H + 0.3]}>
      {[-3.2, 0, 3.2].map((x, i) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh geometry={BOX} position={[0, 1.25, 0.05]} scale={[1.6, 2.5, 0.1]} material={mat('#aab2bb')} />
          <mesh geometry={BOX} position={[0, 1.25, 0.11]} scale={[0.03, 2.5, 0.02]} material={mat('#6e757d')} />
          <mesh geometry={BOX} position={[0, 2.85, 0.08]} scale={[1.2, 0.22, 0.04]} material={mat('#17171a')} />
          <mesh ref={(m) => void (m && (floors.current[i] = m))} geometry={BOX} position={[0, 2.85, 0.11]} scale={[0.18, 0.12, 0.02]} material={mat('#ff7a00', night ? '#ff7a00' : '#7a3a00')} />
        </group>
      ))}
      <mesh position={[0, 3.7, 0.12]}>
        <planeGeometry args={[11, 0.9]} />
        <primitive object={s} attach="material" />
      </mesh>
    </group>
  )
}

/** The café's tables and chairs out in the gallery. */
function Cafe() {
  const chairs = useMemo(() => TABLES.flatMap(([x, z]) => [-1, 1].map((k) => ({ p: [x, 0.25, z + k * 0.8] as [number, number, number], s: [0.45, 0.5, 0.45] as [number, number, number] }))), [])
  return (
    <group>
      {TABLES.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.74, 0]} castShadow>
            <cylinderGeometry args={[0.55, 0.55, 0.05, 16]} />
            <meshLambertMaterial color="#f4efe6" />
          </mesh>
          <mesh position={[0, 0.37, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 0.74, 6]} />
            <meshLambertMaterial color="#3a3d44" />
          </mesh>
        </group>
      ))}
      <Blocks at={chairs} material={mat('#c9a227')} />
    </group>
  )
}

/** The Sim's colleagues on the coffee break: one across the table, a cup in front of him; one standing by it, talking. */
function Colleagues() {
  const two = useMemo(() => {
    const r = rng('pyramide-collegues')
    return (['homme', 'femme'] as const).map((gender) => ({ gender, look: { ...randomLook(gender, r), outfit: gender === 'homme' ? 'suit' : 'chemise' }, seed: r() * 100 }))
  }, [])
  const [x, z] = TABLES[2]
  return (
    <NoShadows>
      <group position={[x, 0.05, z - 0.8]}>
        <TalkHuman id="pyramide-collegue-0" look={two[0].look} gender={two[0].gender} pose="drink" seed={two[0].seed} />
        <Coffee />
      </group>
      <group position={[x + 0.95, 0, z]} rotation={[0, -Math.PI / 2, 0]}>
        <TalkHuman id="pyramide-collegue-1" look={two[1].look} gender={two[1].gender} pose="talk" seed={two[1].seed} />
      </group>
    </NoShadows>
  )
}

/** The board of job ads by the door: sheets pinned up under its title. */
function Board() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 150
    const g = c.getContext('2d')!
    g.fillStyle = '#7a5a3a'
    g.fillRect(0, 0, 256, 150)
    g.fillStyle = '#ffffff'
    g.font = '800 20px sans-serif'
    g.textAlign = 'center'
    g.fillText("OFFRES D'EMPLOI", 128, 24)
    const r = rng('pyramide-annonces')
    for (let i = 0; i < 11; i++) {
      const [x, y] = [10 + (i % 6) * 40 + r() * 6, 36 + Math.floor(i / 6) * 54 + r() * 6]
      g.fillStyle = ['#ffffff', '#fff3bf', '#e7f5ff'][i % 3]
      g.fillRect(x, y, 32, 46)
      g.fillStyle = '#9aa0a8'
      for (let l = 0; l < 5; l++) g.fillRect(x + 4, y + 6 + l * 7, 24 - (l % 2) * 8, 2)
    }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  return (
    <mesh position={[BOARD[0] + 0.15, 1.7, BOARD[1]]} rotation={[0, Math.PI / 2, 0]}>
      <planeGeometry args={[2.6, 1.5]} />
      <meshLambertMaterial map={tex} />
    </mesh>
  )
}

/** Who's there: the guard at the door, the café, the shopkeepers, people waiting for the lifts or on the benches; walking round the gallery. */
function People({ night, open }: { night: boolean; open: boolean }) {
  const still = useMemo(() => {
    const r = rng(open ? 'pyramide-jour' : 'pyramide-soir')
    const one = (p: [number, number, number], ry: number, pose: Pose, dress?: string, g?: 'femme' | 'homme') => {
      const gender: 'femme' | 'homme' = g ?? (r() < 0.5 ? 'femme' : 'homme')
      const look = randomLook(gender, r)
      return { p, ry, pose, gender, look: dress ? { ...look, outfit: dress } : look, seed: r() * 100 }
    }
    const guard = one([3.4, 0, H - 2.2], Math.PI, 'idle', 'vigile', 'homme')
    if (!open) return [guard, one([-3.4, 0, -H + 2.6], Math.PI, 'phone', 'suit')]
    return [
      guard,
      // At the café: colleagues at the tables, the waiter.
      one([TABLES[0][0], 0.05, TABLES[0][1] - 0.8], 0, 'drink', 'chemise'),
      one([TABLES[0][0], 0.05, TABLES[0][1] + 0.8], Math.PI, 'talk', 'suit'),
      one([TABLES[1][0], 0.05, TABLES[1][1] + 0.8], Math.PI, 'eat'),
      one([TABLES[3][0], 0.05, TABLES[3][1] - 0.8], 0, 'write', 'suit'),
      one([15.8, 0, 3.6], -Math.PI / 2, 'busy', 'chemise'),
      // Waiting for the lifts, on the phone.
      one([-1.6, 0, -H + 2.4], Math.PI, 'phone', 'suit'),
      one([1.2, 0, -H + 2.8], Math.PI, 'idle', 'chemise'),
      one([2.6, 0, -H + 2.2], -2.6, 'talk', 'suit'),
      // On the benches by the fountain.
      one([BENCHES[1].at[0] - 0.7, 0.05, BENCHES[1].at[1]], Math.PI, 'phone'),
      one([BENCHES[2].at[0], 0.05, BENCHES[2].at[1] + 0.6], Math.PI / 2, 'sit'),
      // The pharmacist behind the counter, a customer; two at the bank's door; one reading the ads.
      one([8.75, 0, F + 2.4], Math.PI, 'busy', 'infirmier'),
      one([8.75, 0, F - 1.2], 0, 'idle'),
      one([F - 1.4, 0, -12.6], Math.PI / 2, 'phone'),
      one([F - 1.4, 0, -11.2], Math.PI / 2, 'idle'),
      one([BOARD[0] + 1, 0, BOARD[1] + 1.2], -Math.PI / 2, 'idle'),
    ]
  }, [open])
  // Walking round the gallery between the well and the shops, both ways.
  const walkers = useMemo(() => {
    if (!open && night) return []
    const r = rng('pyramide-passants')
    return [...Array(open ? 9 : 3)].map((_, i) => {
      const gender: 'femme' | 'homme' = r() < 0.5 ? 'femme' : 'homme'
      const look = randomLook(gender, r)
      return { gender, look: r() < 0.5 ? { ...look, outfit: r() < 0.5 ? 'suit' : 'chemise' } : look, half: 9.4 + (i % 4) * 1.4, speed: (0.9 + r() * 0.4) * (i % 2 ? 1 : -1), phase: r() * 200 }
    })
  }, [open, night])
  const wr = useRef<(THREE.Group | null)[]>([])
  useFrame(() => {
    const t = worldTime()
    walkers.forEach((w, i) => {
      const g = wr.current[i]
      if (!g) return
      // Along the square's sides: a point on its perimeter, and which way it goes.
      const side = 8 * w.half
      const d = (((t * w.speed + w.phase) % side) + side) % side
      const k = Math.floor(d / (2 * w.half))
      const u = (d % (2 * w.half)) - w.half
      const [x, z] = [[u, -w.half], [w.half, u], [-u, w.half], [-w.half, -u]][k]
      const dir = [[1, 0], [0, 1], [-1, 0], [0, -1]][k].map((v) => v * Math.sign(w.speed))
      // The café's tables: walk round outside them.
      g.position.set(k === 1 && w.half > 12 ? Math.min(x, 11.6) : x, 0, z)
      g.rotation.y = Math.atan2(dir[0], dir[1])
    })
  })
  return (
    <NoShadows>
      {still.map((g, i) => (
        <group key={i} position={g.p} rotation={[0, g.ry, 0]}>
          <TalkHuman id={`pyramide-${open ? 'j' : 's'}${i}`} look={g.look} gender={g.gender} pose={g.pose} seed={g.seed} />
          {/* At the café's tables, the coffee in front */}
          {g.pose === 'drink' && <Coffee />}
        </group>
      ))}
      {walkers.map((w, i) => (
        <group key={`w${i}`} ref={(g) => void (wr.current[i] = g)}>
          <TalkHuman id={`pyramide-w${i}`} look={w.look} gender={w.gender} pose="walk" speed={Math.abs(w.speed)} seed={i * 7 + 0.5} />
        </group>
      ))}
    </NoShadows>
  )
}

/* ---------- The roof ---------- */

/** The roof's height (the crown on top of the fifteenth storey: landmarks.tsx). */
const TOP = 15 * 3.9 + 1

/** Up on the roof: the steps of the storeys going down all round, the Plateau's towers, the lagoon past them, the bridges to Treichville. */
function Roof({ sim, night, stage }: { sim: Sim; night: boolean; stage: string }) {
  const city = useMemo(() => {
    const r = rng('pyramide-vue')
    const out: { x: number; z: number; h: number; w: number; d: number; c: string }[] = []
    // The Plateau's blocks round it, lower than its roof; a tower now and then further off; one far over the rest.
    while (out.length < 110) {
      const [x, z] = [-520 + r() * 1040, -520 + r() * 1040]
      const d = Math.hypot(x, z)
      if (d < 90 || d > 540) continue
      const far = Math.min(1, (d - 90) / 250)
      out.push({ x, z, h: 10 + r() * 25 + (r() < 0.3 ? far * (30 + r() * 70) : 0), w: 12 + r() * 18, d: 12 + r() * 18, c: ['#d9d6cf', '#c4cbd3', '#e6dfd2', '#9fb0c2', '#d2c3a8', '#8aa0b6'][Math.floor(r() * 6)] })
    }
    out.push({ x: -170, z: -230, h: 150, w: 26, d: 26, c: '#8aa0b6' })
    return out
  }, [])
  const streets = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')!
    g.fillStyle = '#cbb38c'
    g.fillRect(0, 0, 128, 128)
    g.fillStyle = '#55585e'
    g.fillRect(0, 58, 128, 10)
    g.fillRect(58, 0, 10, 128)
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(12, 12)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  const rail = useMemo(() => [-1, 1].flatMap((s) => [{ p: [0, TOP + 1, s * 4.9] as [number, number, number], s: [9.8, 0.08, 0.08] as [number, number, number] }, { p: [s * 4.9, TOP + 1, 0] as [number, number, number], s: [0.08, 0.08, 9.8] as [number, number, number] }]), [])
  return (
    <div className="absolute inset-0">
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [-4.5, TOP + 4.5, -5], fov: 50, near: 0.3, far: 4000 }} style={{ background: night ? '#0b1026' : '#9ccbea' }}>
        <Snapper />
        <ChatFraming />
        <Suspense fallback={null}>
          <hemisphereLight args={[night ? '#5060a0' : '#ffffff', '#b8a27c', night ? 0.5 : 1.2]} />
          <directionalLight position={[60, 160, 80]} intensity={night ? 0.15 : 1.5} />
          <Pyramide night={night} />
          {/* The Plateau, the lagoon all round its point but the north */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, -60]}>
            <circleGeometry args={[600, 48]} />
            <meshLambertMaterial map={streets} color={night ? '#4a4a58' : '#ffffff'} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 0]}>
            <planeGeometry args={[5000, 5000]} />
            <meshLambertMaterial color={night ? '#0e2a3a' : '#3c7c8a'} />
          </mesh>
          {/* North, the town going on (Adjamé); across the water, the other shores */}
          <mesh geometry={BOX} position={[0, 4, -1100]} scale={[1400, 8, 900]} material={mat(night ? '#2a2a34' : '#c9b48c')} />
          <mesh geometry={BOX} position={[0, 5, 1700]} scale={[4000, 10, 600]} material={mat(night ? '#10241a' : '#6f8f58')} />
          <mesh geometry={BOX} position={[1700, 5, 0]} scale={[600, 10, 4000]} material={mat(night ? '#10241a' : '#5f8a52')} />
          <mesh geometry={BOX} position={[-1700, 5, 0]} scale={[600, 10, 4000]} material={mat(night ? '#10241a' : '#4f7f4a')} />
          {/* The two bridges south, over to Treichville */}
          {[-260, 120].map((x) => (
            <mesh key={x} geometry={BOX} position={[x, 8, 1000]} scale={[24, 1.4, 820]} material={mat('#c7ccd2')} />
          ))}
          {city.map((b, i) => (
            <mesh key={i} geometry={BOX} position={[b.x, b.h / 2, b.z]} scale={[b.w, b.h, b.d]} material={mat(night ? '#1b2238' : b.c, night && i % 3 === 0 ? '#3a3010' : undefined)} />
          ))}
          <Blocks at={rail} material={mat('#9aa0a8')} />
          <group position={[0, TOP, 3.6]}>
            <Character look={sim.look} gender={sim.gender} pose="film" stage={stage} />
          </group>
          <OrbitControls makeDefault target={[0, TOP - 3, 16]} enablePan={false} minDistance={4} maxDistance={60} enableDamping />
        </Suspense>
      </Canvas>
    </div>
  )
}
