import { Suspense, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Sim } from '../../lib/types'
import { NoShadows, type Pose } from '../../avatar/Human'
import { LowHuman } from '../../avatar/LowHuman'
import { randomLook } from '../../avatar/options'
import { rng } from '../themes'
import { Snapper } from '../snapshot'
import { ChatFraming } from '../chatFraming'
import { Character } from '../Character'
import { BOX, Blocks } from '../open/ruePrincesse'
import { t as tr } from '../../lib/i18n'

// Inside the Basilique Notre-Dame de la Paix, Yamoussoukro (the update « yakro-vivant »): the round nave
// under the dome, the seats in rings round the altar in the middle (7 000 seats), the altar under its
// canopy on four columns, and all round the drum the great stained-glass windows, each its own scene
// (the dove of peace, Notre-Dame in her blue mantle, St Peter's keys, the fishermen's boat… and the
// one where Félix Houphouët-Boigny kneels among the apostles). Light pours down from the dome's
// lantern. The guide's visit (components/defi/Basilique.tsx) is played in it; the mass, the prayer,
// the candle are done in it. The layout and the windows' pictures are the game's.

/** The nave's radius, the drum's wall, the windows' height. */
export const NAVE_R = 44
const WIN_Y = 6
const WIN_H = 13
const WIN_W = 6.4

/** The windows: their scene (a key for the guide), their direction from the middle. */
export const VITRAUX = ['colombe', 'vierge', 'cles', 'agneau', 'barque', 'houphouet', 'rameaux', 'etoile', 'calice', 'pentecote', 'croix', 'soleil'] as const
export type Vitrail = (typeof VITRAUX)[number]
export const vitrailAngle = (i: number) => (i / VITRAUX.length) * Math.PI * 2

/** What the guide says of each window, for the visit. */
export const VITRAIL_CLUES: Record<Vitrail, string> = {
  colombe: tr('La colombe de la paix, une branche d’olivier dans le bec'),
  vierge: tr('Notre-Dame, la Vierge dans son manteau bleu'),
  cles: tr('Les deux clés de saint Pierre, croisées'),
  agneau: tr('L’Agneau de Dieu, tout blanc sur fond rouge'),
  barque: tr('La barque des pêcheurs sur les vagues'),
  houphouet: tr('Le vitrail où Félix Houphouët-Boigny est à genoux parmi les apôtres'),
  rameaux: tr('Les palmes vertes de l’entrée à Jérusalem'),
  etoile: tr('L’étoile au-dessus de l’étable de Bethléem'),
  calice: tr('Le calice d’or de la Cène'),
  pentecote: tr('Les flammes de la Pentecôte sur les têtes'),
  croix: tr('La croix de lumière, ses rayons d’or'),
  soleil: tr('Le grand soleil de Pâques'),
}

const texCache = new Map<string, THREE.CanvasTexture>()
/** A window's picture in big pixels: its scene over a field of blue glass, leaded. */
export function vitrailTexture(kind: Vitrail) {
  const had = texCache.get(kind)
  if (had) return had
  const W = 24
  const H = 48
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  let s = kind.length * 977 + kind.charCodeAt(0) * 31
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  const field = kind === 'agneau' || kind === 'croix' || kind === 'pentecote' ? ['#9c1d1d', '#c22d2d', '#7a1414'] : kind === 'rameaux' ? ['#1f6b45', '#2f8a55', '#174f33'] : ['#1f4fa8', '#2a6fd6', '#16357a']
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) ((g.fillStyle = field[Math.floor(r() * field.length)]), g.fillRect(x, y, 1, 1))
  const px = (x: number, y: number, w: number, h: number, col: string) => ((g.fillStyle = col), g.fillRect(x, y, w, h))
  const GOLD = '#f2c94c'
  const SKIN = '#8a5a3a'
  switch (kind) {
    case 'colombe':
      px(7, 18, 10, 5, '#ffffff'), px(4, 15, 6, 3, '#f1f1f1'), px(14, 15, 6, 3, '#f1f1f1'), px(16, 19, 3, 2, '#ffffff'), px(19, 20, 2, 1, GOLD), px(18, 22, 5, 1, '#3f9a4a'), px(21, 21, 2, 1, '#5fbf5a')
      break
    case 'vierge':
      px(8, 8, 8, 2, GOLD), px(9, 10, 6, 5, SKIN), px(6, 15, 12, 26, '#2a5bd6'), px(8, 15, 8, 4, '#f4f1ea'), px(5, 40, 14, 3, '#16357a')
      break
    case 'cles':
      for (let k = 0; k < 14; k++) (px(5 + k, 12 + k, 2, 2, GOLD), px(17 - k, 12 + k, 2, 2, '#d9d9d9'))
      px(3, 9, 5, 5, GOLD), px(16, 9, 5, 5, '#d9d9d9'), px(18, 27, 3, 2, GOLD), px(3, 27, 3, 2, '#d9d9d9')
      break
    case 'agneau':
      px(6, 20, 12, 7, '#ffffff'), px(16, 17, 5, 5, '#ffffff'), px(19, 18, 1, 1, '#1d1b1a'), px(7, 27, 2, 5, '#f1f1f1'), px(15, 27, 2, 5, '#f1f1f1'), px(10, 10, 1, 10, GOLD), px(8, 11, 5, 1, GOLD)
      break
    case 'barque':
      px(0, 32, 24, 16, '#16357a'), px(4, 28, 16, 4, '#7a4a24'), px(6, 26, 12, 2, '#9a6a3c'), px(11, 12, 1, 14, '#5a3a20'), px(12, 13, 7, 11, '#f4f1ea'), px(6, 22, 3, 4, SKIN), px(15, 23, 3, 3, SKIN)
      for (let x = 0; x < 24; x += 4) px(x, 31, 3, 1, '#9fd8ef')
      break
    case 'houphouet':
      // The apostles in their robes, haloed, and among them the kneeling man in a dark suit.
      for (let k = 0; k < 4; k++) (px(1 + k * 6, 8, 4, 1, GOLD), px(1 + k * 6, 9, 4, 4, SKIN), px(1 + k * 6, 13, 4, 12, ['#d62f2f', '#f07a1a', '#7a3fb0', '#2f9a4a'][k]))
      px(8, 32, 6, 4, SKIN), px(7, 36, 9, 7, '#1d1b1a'), px(15, 40, 3, 3, '#1d1b1a'), px(9, 33, 4, 1, '#cfd8e0'), px(12, 29, 8, 2, GOLD)
      break
    case 'rameaux':
      for (let k = 0; k < 5; k++) for (let j = 0; j < 9; j++) px(2 + k * 4 + (j % 2), 6 + j * 3, 2, 2, ['#7ccf6a', '#a6e07a'][j % 2])
      px(8, 34, 9, 5, '#9a8a7a'), px(16, 31, 3, 3, '#9a8a7a'), px(10, 39, 1, 4, '#6e5e50'), px(15, 39, 1, 4, '#6e5e50')
      break
    case 'etoile':
      px(11, 4, 2, 10, GOLD), px(7, 8, 10, 2, GOLD), px(9, 6, 6, 6, '#fff3b0'), px(4, 28, 16, 2, '#7a4a24'), px(6, 30, 12, 12, '#5a3a20'), px(9, 34, 6, 6, '#f2b51d')
      break
    case 'calice':
      px(7, 12, 10, 8, GOLD), px(8, 20, 8, 2, '#d9a93a'), px(11, 22, 2, 10, GOLD), px(7, 32, 10, 3, GOLD), px(9, 8, 6, 4, '#ffffff')
      break
    case 'pentecote':
      for (let k = 0; k < 4; k++) (px(2 + k * 6, 6, 3, 5, '#f2b51d'), px(3 + k * 6, 4, 1, 2, '#ffe680'), px(2 + k * 6, 13, 4, 4, SKIN), px(1 + k * 6, 17, 5, 16, ['#2a6fd6', '#f4f1ea', '#2f9a4a', '#7a3fb0'][k]))
      break
    case 'croix':
      px(10, 6, 4, 34, GOLD), px(4, 14, 16, 4, GOLD)
      for (let k = 0; k < 8; k++) px(12 + Math.round(Math.cos((k / 8) * 6.28) * 10), 16 + Math.round(Math.sin((k / 8) * 6.28) * 14), 2, 2, '#ffe680')
      break
    case 'soleil':
      px(6, 14, 12, 12, '#f2b51d'), px(8, 12, 8, 16, '#f2b51d'), px(9, 17, 6, 6, '#ffe680')
      for (let k = 0; k < 12; k++) px(12 + Math.round(Math.cos((k / 12) * 6.28) * 10), 20 + Math.round(Math.sin((k / 12) * 6.28) * 10), 2, 2, '#ffd23f')
      break
  }
  // The lead: a frame and a few bars.
  g.fillStyle = '#121218'
  g.fillRect(0, 0, W, 1), g.fillRect(0, H - 1, W, 1), g.fillRect(0, 0, 1, H), g.fillRect(W - 1, 0, 1, H)
  for (let y = 12; y < H; y += 12) g.fillRect(0, y, W, 1)
  const t = new THREE.CanvasTexture(c)
  t.magFilter = THREE.NearestFilter
  t.minFilter = THREE.NearestFilter
  t.generateMipmaps = false
  t.colorSpace = THREE.SRGBColorSpace
  texCache.set(kind, t)
  return t
}

const mats = new Map<string, THREE.MeshLambertMaterial>()
const mat = (c: string, e?: string) => {
  const k = `${c}|${e}`
  let m = mats.get(k)
  if (!m) mats.set(k, (m = new THREE.MeshLambertMaterial({ color: c, emissive: e ?? '#000000' })))
  return m
}

/** The benches in rings round the altar (cut by the four aisles), and the seats along them. */
function benches() {
  const out: { p: [number, number, number]; s: [number, number, number]; ry: number }[] = []
  const seats: [number, number, number][] = []
  for (let ring = 0; ring < 16; ring++) {
    const R = 12 + ring * 1.7
    const n = Math.floor((2 * Math.PI * R) / 3.2)
    for (let k = 0; k < n; k++) {
      const a = ((k + 0.5) / n) * Math.PI * 2
      // The aisles: toward the doors, and across.
      if ([0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].some((x) => Math.abs(Math.atan2(Math.sin(a - x), Math.cos(a - x))) * R < 2)) continue
      out.push({ p: [Math.sin(a) * R, 0.25, Math.cos(a) * R], s: [2.8, 0.5, 0.5], ry: a })
      out.push({ p: [Math.sin(a) * (R + 0.3), 0.75, Math.cos(a) * (R + 0.3)], s: [2.8, 0.6, 0.08], ry: a })
      seats.push([Math.sin(a) * R, Math.cos(a) * R, a])
    }
  }
  return { out, seats }
}

/**
 * The nave and all that's in it: the floor, the rings of benches, the altar under its canopy, the windows
 * round the drum, the columns between them, the dome seen from inside, the light from the lantern;
 * the faithful (at mass, the rings full). `onWindow`: a window tapped (the guide's visit).
 */
export function NaveBasilique({ night, mass = false, crowd = true, light = true, onWindow, lit }: { night: boolean; mass?: boolean; crowd?: boolean; /** The lantern's point light (off in the guide's game: lighter). */ light?: boolean; onWindow?: (i: number) => void; /** A window glowing (the one found, the one wrong): its index and its colour. */ lit?: { i: number; c: string } | null }) {
  const bench = useMemo(benches, [])
  const glass = useMemo(() => VITRAUX.map((k) => new THREE.MeshLambertMaterial({ map: vitrailTexture(k), emissive: '#ffffff', emissiveMap: vitrailTexture(k), emissiveIntensity: 0.7 })), [])
  for (const [i, m] of glass.entries()) m.emissive.set(lit?.i === i ? lit.c : '#ffffff')
  const dome = useMemo(() => {
    const g = new THREE.SphereGeometry(NAVE_R + 2, 40, 14, 0, Math.PI * 2, 0, Math.PI / 2)
    g.scale(1, 1.4, 1)
    return g
  }, [])
  const people = useMemo(() => {
    if (!crowd) return []
    const r = rng(mass ? 'basilique-messe' : 'basilique-visite')
    const want = mass ? 140 : 18
    const out: { at: [number, number, number]; look: ReturnType<typeof randomLook>; gender: 'femme' | 'homme'; pose: Pose; seed: number }[] = []
    for (let k = 0; k < want; k++) {
      const s = bench.seats[Math.floor(r() * bench.seats.length)]
      const gender: 'femme' | 'homme' = r() < 0.58 ? 'femme' : 'homme'
      out.push({ at: s, look: randomLook(gender, r), gender, pose: mass ? (r() < 0.2 ? 'pray' : 'sit') : r() < 0.5 ? 'pray' : 'sit', seed: r() * 100 })
    }
    return out
  }, [mass, crowd, bench])
  const columns = useMemo(() => VITRAUX.map((_, i) => {
    const a = vitrailAngle(i) + Math.PI / VITRAUX.length
    return { p: [Math.sin(a) * (NAVE_R - 1.5), 12, Math.cos(a) * (NAVE_R - 1.5)] as [number, number, number], s: [2, 24, 2] as [number, number, number], ry: a }
  }), [])
  return (
    <group>
      <hemisphereLight args={[night ? '#8090d0' : '#ffffff', '#c9b48c', night ? 0.8 : 1.15]} />
      <directionalLight position={[10, 60, 10]} intensity={night ? 0.25 : 0.9} />
      {light && <pointLight position={[0, 12, 0]} intensity={night ? 120 : 40} distance={60} color="#ffe2a8" />}
      {/* The floor: pale marble, the dark ring round the sanctuary */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={mat('#efe8da')} receiveShadow>
        <circleGeometry args={[NAVE_R + 1, 48]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} material={mat('#8a7a64')}>
        <ringGeometry args={[9.6, 10.4, 48]} />
      </mesh>
      {/* The drum's wall, the windows in it, the columns between */}
      <mesh position={[0, 12, 0]}>
        <cylinderGeometry args={[NAVE_R + 1, NAVE_R + 1, 24, 48, 1, true]} />
        <meshLambertMaterial color="#f1ece2" side={THREE.BackSide} />
      </mesh>
      {VITRAUX.map((_, i) => {
        const a = vitrailAngle(i)
        return (
          <mesh
            key={i}
            position={[Math.sin(a) * (NAVE_R + 0.4), WIN_Y + WIN_H / 2, Math.cos(a) * (NAVE_R + 0.4)]}
            rotation={[0, a + Math.PI, 0]}
            material={glass[i]}
            onClick={
              onWindow
                ? (e) => {
                    if (e.delta > 8) return
                    e.stopPropagation()
                    onWindow(i)
                  }
                : undefined
            }
          >
            <planeGeometry args={[WIN_W, WIN_H]} />
          </mesh>
        )
      })}
      <Blocks at={columns} material={mat('#e6dfd0')} />
      {/* The dome from inside, its ribs, the light of its lantern */}
      <mesh geometry={dome} position={[0, 24, 0]}>
        <meshLambertMaterial color={night ? '#4a5a7a' : '#c9d6e2'} side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 24 + (NAVE_R + 2) * 1.4 - 0.5, 0]} rotation={[Math.PI / 2, 0, 0]} material={mat('#fff6d6', '#fff0b0')}>
        <circleGeometry args={[4, 16]} />
      </mesh>
      {/* The sanctuary: the round podium, the altar, the canopy on its four columns */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, 0.15 + i * 0.3, 0]} material={mat(i === 2 ? '#f7f4ee' : '#e6dfd0')} receiveShadow>
          <cylinderGeometry args={[9 - i * 1.2, 9 - i * 1.2, 0.3, 40]} />
        </mesh>
      ))}
      <mesh geometry={BOX} position={[0, 1.4, 0]} scale={[3.6, 1, 1.6]} material={mat('#fbfaf6')} />
      <mesh geometry={BOX} position={[0, 1.92, 0]} scale={[3.8, 0.05, 1.7]} material={mat('#f2e6b8')} />
      {[-4.5, 4.5].flatMap((x) => [-4.5, 4.5].map((z) => (
        <mesh key={`${x}${z}`} position={[x, 7, z]} material={mat('#c9a14a')}>
          <cylinderGeometry args={[0.45, 0.55, 12, 10]} />
        </mesh>
      )))}
      <mesh geometry={BOX} position={[0, 13.2, 0]} scale={[10.4, 0.8, 10.4]} material={mat('#c9a14a')} />
      <mesh position={[0, 14.4, 0]} material={mat('#d9b34a')}>
        <sphereGeometry args={[4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh geometry={BOX} position={[0, 19.6, 0]} scale={[0.3, 2, 0.3]} material={mat('#d9b34a')} />
      <mesh geometry={BOX} position={[0, 20, 0]} scale={[1.2, 0.3, 0.3]} material={mat('#d9b34a')} />
      {/* The candle stand by the sanctuary, where one lights a candle */}
      <mesh geometry={BOX} position={[-11.5, 0.6, -4]} scale={[3, 1.2, 0.9]} material={mat('#3a3a40')} />
      {[...Array(12)].map((_, i) => (
        <mesh key={i} geometry={BOX} position={[-12.7 + (i % 6) * 0.48, 1.32, -4.2 + Math.floor(i / 6) * 0.4]} scale={[0.06, 0.18, 0.06]} material={mat('#ffd36b', '#ffb020')} />
      ))}
      <Blocks at={bench.out} material={mat('#8a5a34')} />
      <NoShadows>
        {people.map((p, i) => (
          <group key={i} position={[p.at[0], 0.05, p.at[1]]} rotation={[0, p.at[2] + Math.PI, 0]}>
            <LowHuman look={p.look} gender={p.gender} pose={p.pose} seed={p.seed} />
          </group>
        ))}
      </NoShadows>
    </group>
  )
}

/** Where the Sim does each thing in the nave. */
const SPOTS: Record<string, { at: [number, number]; rot: number; pose: Pose }> = {
  pray: { at: [2, 14], rot: Math.PI, pose: 'pray' },
  messe: { at: [1.7, 16.1], rot: Math.PI, pose: 'sit' },
  'messe-matin': { at: [1.7, 16.1], rot: Math.PI, pose: 'sit' },
  'basilique-cierge': { at: [-11.5, -2.8], rot: Math.PI, pose: 'pray' },
  visit: { at: [0, 30], rot: 0, pose: 'film' },
  'basilique-visite': { at: [0, 30], rot: 0, pose: 'film' },
}

/** The basilica's inside, as the place's room: the Sim doing what it came for; the nave full on Sunday morning. */
export function BasiliqueInside({ sim, interactionId, night, stage }: { sim: Sim; interactionId?: string; night: boolean; stage: string }) {
  const minute = sim.gameMinutes ?? 0
  const mass = interactionId === 'messe' || (Math.floor(minute / 1440) % 7 === 6 && Math.floor(minute / 60) % 24 >= 7 && Math.floor(minute / 60) % 24 < 12)
  const spot = SPOTS[interactionId ?? ''] ?? { at: [0, 30] as [number, number], rot: Math.PI, pose: 'idle' as Pose }
  return (
    <div className="absolute inset-0">
      <Canvas shadows={false} dpr={[1, 1.75]} camera={{ position: [spot.at[0] + 8, 7, spot.at[1] + 14], fov: 50, near: 0.3, far: 400 }} style={{ background: night ? '#0b1026' : '#9ccbea' }}>
        <Snapper />
        <ChatFraming />
        <Suspense fallback={null}>
          <NaveBasilique night={night} mass={mass} />
          <group position={[spot.at[0], 0, spot.at[1]]} rotation={[0, spot.rot, 0]}>
            <Character look={sim.look} gender={sim.gender} pose={spot.pose} stage={stage} />
          </group>
          <OrbitControls makeDefault target={[spot.at[0], 4, spot.at[1] - 6]} enablePan={false} minDistance={4} maxDistance={60} minPolarAngle={0.3} maxPolarAngle={1.45} enableDamping />
        </Suspense>
      </Canvas>
    </div>
  )
}
