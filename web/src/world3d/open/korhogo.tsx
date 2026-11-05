import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Blocks, lettering, signMaterial } from './ruePrincesse'
import type { At } from './shoreline'
import { put, blocksMat, seeded, strawRoof, roundHut, type Part } from './kit3d'
import { Flock } from './wildlife'
import { LowHuman } from '../../avatar/LowHuman'
import { NoShadows, type Pose } from '../../avatar/Human'
import { TalkHuman } from '../Talkable'
import { randomLook } from '../../avatar/options'
import { rng } from '../themes'
import { t as tr } from '../../lib/i18n'
import { Club, Maquis, Market, People as KitPeople, usePeople as usePeopleKit, type ClubSpec, type MaquisSpec, type MarketSpec } from './villeKit'

// Korhogo's landmarks (the update « korhogo-vivant », backend game/villes2.go), the Senufo country, in the
// game's blocks, each drawn mostly at once (kit3d.ts):
// - Waraniéné, the weavers' village: the hangars of narrow looms, the long warps stretched out on the
//   ground to their stones, the weavers at work, the strips and the pagnes hung to sell;
// - Fakaha, the painters' village: the toiles of woven cotton laid out and hung, their figures (the fish,
//   the calao, the turtle, the mask) in black and brown, the painters bent over them;
// - Koni, the smiths' village: the forge under its straw shelter, the clay furnace, the bellows, the anvil
//   and the hammers, the red iron and its sparks;
// - the sacred wood of Koko: the tall trees seen from the outside only, the edge, the path that stops,
//   the sign asking to keep out; nothing of what's inside;
// - Mont Korhogo: the granite rock over the town, its boulders, the mango trees at its foot.
// - the Grande mosquée, the Grand marché, the Maquis Le Tô de Mama Sita and Le Balafon Club (below; the
//   market, the maquis and the club from villeKit.tsx).
// The round huts of the north, the shea and mango trees. All layouts are the game's own, not surveyed.

const M = {
  earth: new THREE.MeshLambertMaterial({ color: '#c08a5a', polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
  ember: new THREE.MeshLambertMaterial({ color: '#ff6a1a', emissive: '#ff4a00', emissiveIntensity: 0.9 }),
  lamp: new THREE.MeshLambertMaterial({ color: '#fff4d0', emissive: '#ffb84a', emissiveIntensity: 0 }),
}

/** A big tree of the savanna (mango, shea, kapok): its trunk, its round crown. */
const tree = (h: number, r: number, crown = '#3f7a35'): Part[] => [[0, h / 2, 0, 0.6, h, 0.6, '#6e5640'], [0, h + 0.8, 0, r * 2, 2.2, r * 2, crown], [0.6, h + 1.8, 0.4, r * 1.3, 1.4, r * 1.3, crown]]
/** A narrow loom of the north: its four posts, the beam, the heddles, the breast beam, the stool. Facing +z (the weaver). */
const LOOM: Part[] = [
  [-0.5, 1.2, 0, 0.1, 2.4, 0.1, '#6b4a2a'], [0.5, 1.2, 0, 0.1, 2.4, 0.1, '#6b4a2a'], [-0.5, 1.2, -1.2, 0.1, 2.4, 0.1, '#6b4a2a'], [0.5, 1.2, -1.2, 0.1, 2.4, 0.1, '#6b4a2a'],
  [0, 2.4, -0.6, 1.2, 0.1, 0.1, '#6b4a2a'], [0, 1.4, -0.5, 0.6, 0.8, 0.04, '#e9e2cf'], [0, 0.72, 0.4, 0.9, 0.08, 0.1, '#7a5230'], [0, 0.22, 1.2, 0.5, 0.44, 0.4, '#5a3d22'],
]
/** The warp: the threads from the loom out to the drag-stone, `len` metres along −z. */
const warp = (len: number, c: string): Part[] => [[0, 0.74, -len / 2 - 1, 0.24, 0.02, len, c], [0, 0.2, -len - 1.2, 0.6, 0.4, 0.5, '#7d7a72']]
/** A painted toile, upright on its frame or hung: cream cotton, its figures in black and brown. */
function toile(w: number, h: number, seed: number): Part[] {
  const r = seeded(seed)
  const out: Part[] = [[0, h / 2 + 0.3, 0, w, h, 0.03, '#e9dcc0']]
  for (let i = 0; i < 6; i++) {
    const fx = (r() - 0.5) * (w - 0.4)
    const fy = 0.5 + r() * (h - 0.4)
    const big = r() < 0.4
    out.push([fx, fy, 0.03, big ? 0.32 : 0.2, big ? 0.16 : 0.24, 0.02, r() < 0.7 ? '#2a1a10' : '#7a3a12'], [fx + 0.14, fy + 0.06, 0.03, 0.08, 0.08, 0.02, '#2a1a10'])
  }
  out.push([0, 0.32, 0.03, w, 0.04, 0.02, '#2a1a10'], [0, h + 0.28, 0.03, w, 0.04, 0.02, '#2a1a10'])
  return out
}

function usePeople(seed: string, spots: { p: [number, number, number]; ry: number; pose: Pose; dress?: { outfit: string; outfitColor: string }; gender?: 'femme' | 'homme' }[]) {
  return useMemo(() => {
    const r = rng(seed)
    return spots.map((s) => {
      const gender = s.gender ?? (r() < 0.4 ? 'femme' : 'homme')
      const look = randomLook(gender, r)
      return { ...s, gender, look: s.dress ? { ...look, ...s.dress } : look, seed: r() * 100 }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
function People({ list }: { list: ReturnType<typeof usePeople> }) {
  return (
    <NoShadows>
      {list.map((p, i) => (
        <group key={i} position={p.p} rotation={[0, p.ry, 0]}>
          <LowHuman look={p.look} gender={p.gender} pose={p.pose} seed={p.seed} />
        </group>
      ))}
    </NoShadows>
  )
}
function useSign(text: string, bg: string, ink: string, night: boolean) {
  const s = useMemo(() => {
    const l = lettering(text, bg, ink, ink)
    return { m: signMaterial(l.t), aspect: l.aspect }
  }, [text, bg, ink])
  s.m.emissiveIntensity = night ? 0.6 : 0
  return s
}
/** The village's ground of red earth, its round huts and its trees round the edge (as `at`). */
function village(out: At[], seed: number, r0: number, n: number) {
  const r = seeded(seed)
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.3
    const d = r0 + r() * 8
    put(out, [Math.cos(a) * d, Math.sin(a) * d - 6, -a + Math.PI / 2], roundHut(2 + r() * 0.6, 2.1, r() < 0.5 ? '#b87a4b' : '#c48a58'))
  }
  for (let i = 0; i < 10; i++) {
    const a = r() * Math.PI * 2
    const d = r0 + 12 + r() * 12
    put(out, [Math.cos(a) * d, Math.sin(a) * d - 6, 0], tree(4 + r() * 3, 3 + r() * 2, r() < 0.5 ? '#3f7a35' : '#4c8a3a'))
  }
}

/* ---------- Waraniéné ---------- */

export function Waraniene({ night }: { night: boolean }) {
  const mat = useMemo(blocksMat, [])
  const sign = useSign(tr('WARANIÉNÉ · VILLAGE DES TISSERANDS'), '#24386e', '#f4f1e6', night)
  const at = useMemo(() => {
    const out: At[] = []
    // Two hangars of looms, side by side, their straw roofs on posts.
    for (const hx of [-9, 9]) {
      put(out, [hx, -4, 0], [[-6, 1.6, -3, 0.2, 3.2, 0.2, '#6b4a2a'], [6, 1.6, -3, 0.2, 3.2, 0.2, '#6b4a2a'], [-6, 1.6, 3, 0.2, 3.2, 0.2, '#6b4a2a'], [6, 1.6, 3, 0.2, 3.2, 0.2, '#6b4a2a'], [0, 3.3, 0, 13.5, 0.4, 7.5, '#c9a25a'], [0, 3.6, 0, 11, 0.3, 5.5, '#b88f48']])
      for (let k = 0; k < 4; k++) {
        const x = hx - 4.5 + k * 3
        put(out, [x, -1.5, 0], LOOM)
        // The warps run out in front of the hangar, each to its stone, white and indigo.
        put(out, [x, -2.6, 0], warp(9 + (k % 2) * 2, k % 2 ? '#2a3f7a' : '#f4f1e6'))
      }
    }
    // The strips and pagnes hung to sell, on a line by the path; the coils of woven strip on the ground.
    put(out, [0, 9, 0], [[-7, 1.2, 0, 0.12, 2.4, 0.12, '#6b4a2a'], [7, 1.2, 0, 0.12, 2.4, 0.12, '#6b4a2a'], [0, 2.35, 0, 14, 0.04, 0.04, '#3a2a1a']])
    for (let i = 0; i < 7; i++) put(out, [-6 + i * 2, 9, 0], [[0, 1.55, 0, 1.6, 1.6, 0.04, i % 2 ? '#24386e' : '#f1ece0'], [0, 1.55, 0.03, 1.6, 0.2, 0.02, i % 2 ? '#f1ece0' : '#24386e'], [-0.4, 1.3, 0.03, 0.2, 0.9, 0.02, i % 3 ? '#e8590c' : '#24386e']])
    for (let i = 0; i < 5; i++) out.push({ p: [-4 + i * 2, 0.18, 6], s: [0.5, 0.36, 0.5], c: i % 2 ? '#24386e' : '#f1ece0' })
    village(out, 31, 22, 10)
    return out
  }, [])
  // The weavers, one at each loom; women spinning cotton by the hangar; a buyer at the pagnes.
  const people = usePeople('waraniene-gens', [
    ...[-13.5, -10.5, -7.5, -4.5, 4.5, 7.5, 10.5, 13.5].filter((_, i) => i % 2 === 0 || i > 3).map((x) => ({ p: [x, 0, -0.3] as [number, number, number], ry: Math.PI, pose: 'type' as Pose, gender: 'homme' as const, dress: { outfit: 'boubou', outfitColor: ['#f4f1e6', '#24386e', '#8a6a3c'][Math.abs(Math.round(x)) % 3] } })),
    { p: [-2, 0, -6], ry: 0.4, pose: 'sit', gender: 'femme', dress: { outfit: 'pagne', outfitColor: '#e8590c' } },
    { p: [2, 0, -6.5], ry: -0.4, pose: 'sit', gender: 'femme', dress: { outfit: 'pagne', outfitColor: '#2f9e44' } },
    { p: [3, 0, 10.5], ry: Math.PI, pose: 'talk' },
  ])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, -4]} material={M.earth} receiveShadow>
        <circleGeometry args={[36, 24]} />
      </mesh>
      <Blocks at={at} material={mat} color />
      <Shuttles xs={[-13.5, -7.5, 4.5, 10.5]} z={-5.5} />
      <mesh position={[-16, 3.3, 12.6]} material={sign.m}>
        <planeGeometry args={[11, 11 / sign.aspect]} />
      </mesh>
      <mesh position={[-16, 1.6, 12.5]} scale={[0.2, 3.2, 0.2]}>
        <boxGeometry />
        <meshLambertMaterial color="#6b4a2a" />
      </mesh>
      <People list={people} />
    </group>
  )
}

/** The shuttles flying across the looms, the heddles nodding: the hangar at work. */
function Shuttles({ xs, z }: { xs: number[]; z: number }) {
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.06, 0.08), new THREE.MeshLambertMaterial({ color: '#8a5a32' }), xs.length)
    m.frustumCulled = false
    return m
  }, [xs.length])
  const o = useMemo(() => new THREE.Object3D(), [])
  useFrame(({ clock }) => {
    xs.forEach((x, i) => {
      const t = clock.elapsedTime * 1.6 + i * 0.7
      o.position.set(x + Math.sin(t * Math.PI) * 0.35, 0.82, z)
      o.updateMatrix()
      mesh.setMatrixAt(i, o.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  })
  return <primitive object={mesh} />
}

/* ---------- Fakaha ---------- */

export function Fakaha({ night }: { night: boolean }) {
  const mat = useMemo(blocksMat, [])
  const sign = useSign(tr('FAKAHA · LES PEINTRES DES TOILES DE KORHOGO'), '#6b4423', '#f4ead2', night)
  const at = useMemo(() => {
    const out: At[] = []
    // The painters' shelter: a straw roof on posts, the toiles laid flat on the mats under it.
    put(out, [0, -4, 0], [[-6, 1.4, -3, 0.2, 2.8, 0.2, '#6b4a2a'], [6, 1.4, -3, 0.2, 2.8, 0.2, '#6b4a2a'], [-6, 1.4, 3, 0.2, 2.8, 0.2, '#6b4a2a'], [6, 1.4, 3, 0.2, 2.8, 0.2, '#6b4a2a'], [0, 2.9, 0, 13.5, 0.4, 7.5, '#c9a25a']])
    for (let i = 0; i < 4; i++) put(out, [-4.5 + i * 3, -4, Math.PI / 2], [[0, 0.04, 0, 2.2, 0.04, 1.6, '#b8935a'], ...toile(1.8, 1.2, 50 + i).map((p): Part => [p[0], 0.08, p[1] - 0.95, p[3], 0.02, p[4], p[6]])])
    // The toiles hung to sell on lines, and propped up on frames along the path.
    for (let i = 0; i < 6; i++) put(out, [-7.5 + i * 3, 6, 0], [[0, 1.2, -0.1, 0.08, 2.4, 0.08, '#6b4a2a'], ...toile(2.4, 1.7, 70 + i)])
    // The dye pots: the mud, the bark's brew.
    for (let i = 0; i < 3; i++) out.push({ p: [8 + i * 1.2, 0.3, -1], s: [0.8, 0.6, 0.8], c: '#3a2a1a' }, { p: [8 + i * 1.2, 0.62, -1], s: [0.6, 0.04, 0.6], c: i ? '#2a1a10' : '#7a3a12' })
    village(out, 47, 20, 9)
    return out
  }, [])
  const people = usePeople('fakaha-gens', [
    { p: [-4.5, 0, -2.6], ry: Math.PI, pose: 'write', gender: 'homme', dress: { outfit: 'boubou', outfitColor: '#e9e2cf' } },
    { p: [1.5, 0, -2.6], ry: Math.PI, pose: 'write', gender: 'homme', dress: { outfit: 'casual', outfitColor: '#8a6a3c' } },
    { p: [7.5, 0, -6.2], ry: 0, pose: 'idle', gender: 'homme', dress: { outfit: 'boubou', outfitColor: '#24386e' } },
    { p: [0, 0, 8.2], ry: Math.PI, pose: 'film' },
  ])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, -4]} material={M.earth} receiveShadow>
        <circleGeometry args={[34, 24]} />
      </mesh>
      <Blocks at={at} material={mat} color />
      <mesh position={[0, 3.4, 10.4]} material={sign.m}>
        <planeGeometry args={[12, 12 / sign.aspect]} />
      </mesh>
      <People list={people} />
    </group>
  )
}

/* ---------- Koni ---------- */

export function Koni({ night }: { night: boolean }) {
  const mat = useMemo(blocksMat, [])
  const sign = useSign(tr('KONI · LES FORGERONS'), '#3a2a1a', '#ffb84a', night)
  M.lamp.emissiveIntensity = night ? 1 : 0
  const at = useMemo(() => {
    const out: At[] = []
    // The forge under its straw shelter: the clay furnace, the bellows of hide, the anvil stones, the tools.
    put(out, [0, -3, 0], [[-4, 1.7, -3.4, 0.25, 3.4, 0.25, '#6b4a2a'], [4, 1.7, -3.4, 0.25, 3.4, 0.25, '#6b4a2a'], [-4, 1.7, 3.4, 0.25, 3.4, 0.25, '#6b4a2a'], [4, 1.7, 3.4, 0.25, 3.4, 0.25, '#6b4a2a'], ...strawRoof(4.6, 1.2, 3.4, '#c9a25a', 3)])
    put(out, [-2, -3, 0], [[0, 0.7, 0, 1.6, 1.4, 1.6, '#9a5a32'], [0, 1.6, 0, 1.1, 0.6, 1.1, '#8a4a28'], [1.3, 0.35, 0, 1, 0.5, 0.8, '#5a3d22'], [1.9, 0.3, 0.3, 0.7, 0.3, 0.5, '#7a5230'], [1.9, 0.3, -0.3, 0.7, 0.3, 0.5, '#7a5230']])
    put(out, [1.6, -3, 0], [[0, 0.35, 0, 0.9, 0.7, 0.7, '#6d6a62'], [0, 0.72, 0, 0.5, 0.06, 0.3, '#3a3a3a']])
    // The finished tools laid out to sell: the dabas, the hoes, the knives, the pots.
    for (let i = 0; i < 8; i++) out.push({ p: [-4 + i, 0.06, 4], s: [0.5, 0.06, 0.3], c: i % 3 ? '#5a5a5a' : '#7a5230', ry: i * 0.3 })
    // The old furnaces of the village, tall clay cones by the path.
    for (const x of [-12, 12]) put(out, [x, 2, 0], [[0, 1.2, 0, 2.2, 2.4, 2.2, '#9a5a32'], [0, 2.8, 0, 1.4, 1, 1.4, '#8a4a28'], [0, 0.4, 1.1, 0.5, 0.6, 0.05, '#2a1a10']])
    village(out, 59, 20, 9)
    return out
  }, [])
  const people = usePeople('koni-gens', [
    { p: [1.6, 0, -1.8], ry: Math.PI, pose: 'stamp', gender: 'homme', dress: { outfit: 'casual', outfitColor: '#5a3d22' } },
    { p: [2.6, 0, -3], ry: -Math.PI / 2, pose: 'stamp', gender: 'homme', dress: { outfit: 'casual', outfitColor: '#2a2a2a' } },
    { p: [-0.4, 0, -3], ry: -Math.PI / 2, pose: 'push', gender: 'homme', dress: { outfit: 'casual', outfitColor: '#8a6a3c' } },
    { p: [-2, 0, 5.4], ry: Math.PI, pose: 'idle', gender: 'homme', dress: { outfit: 'boubou', outfitColor: '#e9e2cf' } },
  ])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, -4]} material={M.earth} receiveShadow>
        <circleGeometry args={[34, 24]} />
      </mesh>
      <Blocks at={at} material={mat} color />
      <Embers />
      <mesh position={[0, 3.6, 8]} material={sign.m}>
        <planeGeometry args={[7, 7 / sign.aspect]} />
      </mesh>
      <People list={people} />
    </group>
  )
}

/** The furnace's mouth glowing, the red iron on the anvil, the sparks at each blow. */
function Embers() {
  const sparks = useRef<THREE.InstancedMesh>(null)
  const o = useMemo(() => new THREE.Object3D(), [])
  useFrame(({ clock }) => {
    const m = sparks.current
    if (!m) return
    const t = clock.elapsedTime
    for (let i = 0; i < 10; i++) {
      const k = (t * 1.6 + i * 0.1) % 1
      o.position.set(1.6 + Math.cos(i * 2.4) * k * 0.8, 0.8 + Math.sin(k * Math.PI) * 0.6, -3 + Math.sin(i * 2.4) * k * 0.8)
      o.scale.setScalar(k < 0.6 ? 1 : 0.001)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    }
    m.instanceMatrix.needsUpdate = true
    M.ember.emissiveIntensity = 0.7 + Math.sin(t * 7) * 0.25
  })
  return (
    <group>
      <instancedMesh ref={sparks} args={[undefined, undefined, 10]} material={M.ember} frustumCulled={false}>
        <boxGeometry args={[0.05, 0.05, 0.05]} />
      </instancedMesh>
      <mesh position={[-2, 1.95, -3]} material={M.ember} scale={[0.6, 0.12, 0.6]}>
        <boxGeometry />
      </mesh>
      <mesh position={[1.6, 0.78, -3]} material={M.ember} scale={[0.4, 0.05, 0.12]}>
        <boxGeometry />
      </mesh>
    </group>
  )
}

/* ---------- The sacred wood of Koko ---------- */

export function BoisSacre({ night }: { night: boolean }) {
  const mat = useMemo(blocksMat, [])
  const sign = useSign(tr('BOIS SACRÉ · RESPECTEZ LES LIEUX, N’ENTREZ PAS'), '#2b4a22', '#f4ead2', night)
  const at = useMemo(() => {
    const out: At[] = []
    const r = seeded(83)
    // The wood itself, behind (−z): tall kapok trees and dense crowns, a wall of green one doesn't see into.
    for (let i = 0; i < 26; i++) {
      const x = (r() - 0.5) * 60
      const z = -8 - r() * 34
      put(out, [x, z, r() * 3], [[0, 7, 0, 1.2, 14, 1.2, '#7d6e5a'], [0, 14.5, 0, 9 + r() * 5, 4, 9 + r() * 5, ['#2f5d2a', '#3a6b2e', '#27502a'][i % 3]], [0, 10, 0, 6, 3, 6, '#2c5627']])
    }
    for (let i = 0; i < 60; i++) out.push({ p: [(r() - 0.5) * 60, 1.4, -6 - r() * 6], s: [2 + r() * 2, 2.8, 1.5 + r()], ry: r() * 3, c: ['#3f7a35', '#2f6a30', '#33602d'][i % 3] })
    // The edge: a low fence of branches, the path that stops at it, the stone where one waits for the guide.
    for (let x = -28; x <= 28; x += 2) if (Math.abs(x) > 1) out.push({ p: [x, 0.5, -4], s: [1.9, 0.12, 0.12], ry: 0.05, c: '#6b4a2a' }, { p: [x, 0.5, -4], s: [0.1, 1, 0.1], c: '#5a3d22' })
    out.push({ p: [0, 0.03, 4], s: [2, 0.04, 16], c: '#b57a4a' }, { p: [3, 0.3, -1], s: [1.4, 0.6, 0.8], c: '#7d7a72' })
    return out
  }, [])
  const guide = useMemo(() => randomLook('homme', rng('poro-guide')), [])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <group position={[-3.5, 0, -2.6]}>
        <mesh position={[0, 1, 0]} scale={[0.12, 2, 0.12]}>
          <boxGeometry />
          <meshLambertMaterial color="#6b4a2a" />
        </mesh>
        <mesh position={[0, 2.2, 0.08]} material={sign.m}>
          <planeGeometry args={[5, 5 / sign.aspect]} />
        </mesh>
      </group>
      <group position={[2, 0, 0.5]} rotation={[0, Math.PI, 0]}>
        <TalkHuman id="poro-guide" look={{ ...guide, outfit: 'boubou', outfitColor: '#e9e2cf' }} gender="homme" pose="talk" seed={5} />
      </group>
      <Flock centre={[0, -20]} radius={16} height={20} n={6} color="#2a2624" seed="poro-calaos" />
    </group>
  )
}

/* ---------- Mont Korhogo ---------- */

export function MontKorhogo({ night }: { night: boolean }) {
  M.lamp.emissiveIntensity = night ? 1 : 0
  const mat = useMemo(blocksMat, [])
  const at = useMemo(() => {
    const out: At[] = []
    const r = seeded(97)
    // The granite: a dome of grey boulders stepping up, worn smooth, behind (−z).
    for (let i = 0; i < 7; i++) {
      const w = 40 - i * 5
      out.push({ p: [r() * 3 - 1.5, 1.5 + i * 3, -22 - i * 1.5], s: [w, 3.2, w * 0.7], ry: r() * 0.5, c: i % 2 ? '#8d8a82' : '#7d7a72' })
    }
    for (let i = 0; i < 18; i++) {
      const a = r() * Math.PI * 2
      const d = 14 + r() * 8
      const s = 2 + r() * 4
      out.push({ p: [Math.cos(a) * d, s * 0.35, -22 + Math.sin(a) * d * 0.7], s: [s, s * 0.7, s * 0.8], ry: r() * 3, c: ['#8d8a82', '#7d7a72', '#9c988f'][i % 3] })
    }
    // The path up with its steps cut in the rock, the lookout on top.
    for (let i = 0; i < 12; i++) out.push({ p: [-6 + i * 0.6, 0.3 + i * 1.6, -6 - i * 1.4], s: [2, 0.3, 1.4], c: '#a9a59a' })
    out.push({ p: [0, 22.4, -32], s: [6, 0.4, 4], c: '#a9a59a' })
    // The mango trees and the cashew trees at its foot, in rows.
    for (let i = 0; i < 12; i++) put(out, [-26 + (i % 6) * 10 + r() * 2, 6 + Math.floor(i / 6) * 9, r() * 3], [...tree(3 + r(), 3.4, i % 3 ? '#2f6a30' : '#4c8a3a'), [1.2, 3.6, 2, 0.3, 0.4, 0.3, '#f0b429'], [-1, 3.3, -1.6, 0.3, 0.4, 0.3, '#e8590c']])
    return out
  }, [])
  const people = usePeople('mont-gens', [
    { p: [-4, 0, -4], ry: Math.PI, pose: 'walk' },
    { p: [0, 22.6, -31], ry: 0, pose: 'film' },
    { p: [-16, 0, 8], ry: 0.6, pose: 'pick', gender: 'femme', dress: { outfit: 'pagne', outfitColor: '#e8590c' } },
  ])
  return (
    <group>
      <Blocks at={at} material={mat} color />
      <People list={people} />
      <Flock centre={[0, -26]} radius={20} height={30} n={5} color="#3a3a3a" seed="mont-milans" />
    </group>
  )
}

/* ---------- The Grande mosquée ---------- */

// The town's great mosque (where the map has it, its building some 75 by 48 m), in the Sudano-Sahelian
// way of the north as the guides tell it: earth-coloured walls ribbed with buttresses, each ending in its
// cone over the parapet, the torons (the beams left sticking out of the walls), high arches, the tall
// tapering minaret over the courtyard and two slender ones at the corners, the ostrich egg at the tops.
// The courtyard in front, its neem tree and its mats, the taps for the ablutions. Proportions estimated.

const EARTH = '#d6b384'
const RIB = '#c9a273'
const TORON = '#6b4a2a'

/** A tapering tower of earth: tiers narrowing from `w0` to `w1` up to `h`, torons on each face, the cone and the egg on top. */
function earthTower(h: number, w0: number, w1: number, tiers: number): Part[] {
  const out: Part[] = []
  for (let i = 0; i < tiers; i++) {
    const w = w0 + ((w1 - w0) * i) / (tiers - 1)
    const y = (h / tiers) * (i + 0.5)
    out.push([0, y, 0, w, h / tiers + 0.02, w, i % 2 ? EARTH : RIB])
    for (const [fx, fz] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const)
      for (const k of [-1, 1]) out.push([fx * (w / 2 + 0.3) + (fx ? 0 : k * w * 0.25), y, fz * (w / 2 + 0.3) + (fz ? 0 : k * w * 0.25), fx ? 0.6 : 0.12, 0.12, fz ? 0.6 : 0.12, TORON])
  }
  out.push([0, h + 0.5, 0, w1 * 0.6, 1, w1 * 0.6, EARTH], [0, h + 1.3, 0, w1 * 0.3, 0.8, w1 * 0.3, EARTH], [0, h + 1.9, 0, 0.36, 0.42, 0.36, '#f8f4ea'], [0, h + 2.4, 0, 0.08, 0.6, 0.08, '#d9b34a'])
  return out
}

export function MosqueeKorhogo({ night }: { night: boolean }) {
  const mat = useMemo(() => {
    const m = blocksMat()
    m.emissive = new THREE.Color('#ffd9a0')
    return m
  }, [])
  mat.emissiveIntensity = night ? 0.1 : 0
  const lamp = useMemo(() => new THREE.MeshLambertMaterial({ color: RIB, emissive: '#e8ffd8', emissiveIntensity: 0 }), [])
  lamp.emissiveIntensity = night ? 1 : 0
  const ground = useMemo(() => new THREE.MeshLambertMaterial({ color: '#d8c49a', polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), [])
  const b = useMemo(() => {
    const out: At[] = []
    const lit: At[] = []
    // The prayer hall at the back, its parapet; ribs with their cones all round; the arches onto the courtyard.
    out.push({ p: [0, 4.5, -11], s: [72, 9, 26], c: EARTH }, { p: [0, 9.2, -11], s: [72.4, 0.4, 26.4], c: RIB })
    for (let x = -34; x <= 34; x += 4)
      for (const z of [2.2, -24.2]) {
        out.push({ p: [x, 5.3, z], s: [1, 10.6, 0.6], c: RIB }, { p: [x, 11, z], s: [0.7, 0.9, 0.5], c: RIB }, { p: [x, 11.7, z], s: [0.36, 0.6, 0.3], c: EARTH })
        if (z > 0) for (const y of [3, 6.2, 8.4]) out.push({ p: [x + 2, y, z + 0.1], s: [0.12, 0.12, 0.9], c: TORON })
      }
    for (let z = -20; z <= -2; z += 4) for (const x of [-36.2, 36.2]) out.push({ p: [x, 5.3, z], s: [0.6, 10.6, 1], c: RIB }, { p: [x, 11, z], s: [0.5, 0.9, 0.7], c: RIB })
    for (let x = -30; x <= 30; x += 4) {
      if (Math.abs(x) < 4) continue
      out.push({ p: [x + 2, 3, 2.03], s: [2, 5, 0.06], c: '#3a2a1a' }, { p: [x + 2, 5.8, 2.03], s: [1.2, 0.6, 0.06], c: '#3a2a1a' }, { p: [x + 2, 6.3, 2.03], s: [0.5, 0.4, 0.06], c: '#3a2a1a' })
    }
    // The great minaret in the middle of the hall's front, the two slender ones at its corners.
    put(out, [0, 2.2, 0], earthTower(24, 7, 2.6, 8))
    out.push({ p: [0, 2.2, 5.62], s: [2.2, 3.6, 0.06], c: '#3a2a1a' })
    for (const x of [-35, 35]) put(out, [x, 1.2, 0], earthTower(15, 2.8, 1.6, 5))
    // The courtyard's wall, its gate under two little towers, the taps of the ablutions along it, the neem and its mats.
    for (const s of [-1, 1]) out.push({ p: [s * 36.8, 1.7, 13], s: [0.8, 3.4, 22], c: EARTH }, { p: [s * 20.5, 1.7, 23.6], s: [31, 3.4, 0.8], c: EARTH })
    for (let x = -34; x <= 34; x += 3) if (Math.abs(x) > 6) out.push({ p: [x, 3.8, 23.6], s: [0.5, 0.8, 0.5], c: RIB })
    put(out, [0, 23.6, 0], [[-4.6, 3, 0, 1.8, 6, 1.8, RIB], [4.6, 3, 0, 1.8, 6, 1.8, RIB], [-4.6, 6.6, 0, 1.2, 1.2, 1.2, EARTH], [4.6, 6.6, 0, 1.2, 1.2, 1.2, EARTH], [0, 4.9, 0, 7.6, 1.4, 1.2, EARTH], [-4.6, 7.5, 0, 0.36, 0.42, 0.36, '#f8f4ea'], [4.6, 7.5, 0, 0.36, 0.42, 0.36, '#f8f4ea']])
    for (let i = 0; i < 8; i++) out.push({ p: [-36, 0.5, 6 + i * 2], s: [0.6, 1, 0.3], c: '#7b8794' }, { p: [-35.3, 0.9, 6 + i * 2], s: [0.4, 0.06, 0.06], c: '#c0c6cc' }, { p: [-34.6, 0.22, 6 + i * 2], s: [0.4, 0.44, 0.4], c: '#3b5bdb' })
    put(out, [20, 13, 0], [[0, 2.5, 0, 1, 5, 1, '#6e5640'], [0, 6, 0, 9, 3, 9, '#3f7a35'], [1, 7.6, 0.6, 6, 1.8, 6, '#4c8a3a'], [0, 0.04, 0, 6, 0.06, 4, '#c9a14a'], [-1.4, 0.06, 1.6, 2, 0.06, 1.2, '#2f9e44']])
    for (let i = 0; i < 12; i++) out.push({ p: [-4 + (i % 6) * 0.6 + (i > 5 ? 6.4 : 0), 0.1, 4.6], s: [0.24, 0.1, 0.34], c: ['#1b1b1f', '#8a5a32', '#e8e4dc', '#2f6db3'][i % 4] })
    // Its lamps at night: over the arches, at the gate, round the minaret's top.
    for (let x = -28; x <= 28; x += 8) lit.push({ p: [x, 7.4, 2.4], s: [0.4, 0.3, 0.3] })
    lit.push({ p: [0, 22.4, 2.2], s: [3.4, 0.3, 3.4] }, { p: [0, 6.1, 24.3], s: [5, 0.3, 0.2] })
    return { out, lit }
  }, [])
  const people = usePeopleKit('korhogo-mosquee', [
    { p: [1.5, 0, 7], ry: 0.4, pose: 'talk', gender: 'homme', dress: { outfit: 'imam', outfitColor: '#f8f9fa' } },
    { p: [-34.3, 0, 9], ry: Math.PI / 2, pose: 'wash', gender: 'homme', dress: { outfit: 'boubou', outfitColor: '#e9dcc0' } },
    { p: [-34.3, 0, 13], ry: Math.PI / 2, pose: 'wash', gender: 'homme' },
    { p: [19, 0, 14.5], ry: Math.PI, pose: 'sit', gender: 'homme', dress: { outfit: 'boubou', outfitColor: '#24386e' } },
    { p: [21.5, 0, 13.4], ry: -Math.PI / 2, pose: 'sitground', gender: 'homme', dress: { outfit: 'boubou', outfitColor: '#f4f1e6' } },
    { p: [-2, 0, 19], ry: Math.PI, pose: 'walk', gender: 'homme' },
  ])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} material={ground} receiveShadow>
        <planeGeometry args={[78, 52]} />
      </mesh>
      <Blocks at={b.out} material={mat} color />
      <Blocks at={b.lit} material={lamp} />
      <KitPeople list={people} />
    </group>
  )
}

/* ---------- The Grand marché ---------- */

const KO_MARCHE: MarketSpec = {
  gate: 'GRAND MARCHÉ DE KORHOGO',
  sign: ['#7a3a12', '#f4e7c0'],
  seed: 37,
  w: 34,
  d: 32,
  // Cashews, mangoes, shea butter, millet, peppers, calabashes, the indigo of the cloth.
  goods: ['#c9a46a', '#f08c00', '#f4e7c0', '#d9b36a', '#c92a2a', '#c8a050', '#24386e', '#5c940d'],
  hangings: [toile(1.4, 1.8, 3), toile(1.4, 1.8, 5), toile(1.4, 1.8, 8), toile(1.4, 1.8, 11), toile(1.4, 1.8, 14)],
  hall: { w: 24, d: 16, h: 5, roof: '#a0522d' },
  gateColour: EARTH,
  cones: true,
  // The sacks of cashews piled by the gate, a stack of calabashes, a pushcart of mangoes.
  extra: [[-5, 0.35, 12, 0.7, 0.7, 0.9, '#e9dcc0'], [-4.2, 0.35, 12.2, 0.7, 0.7, 0.9, '#e9dcc0'], [-4.6, 1, 12.1, 0.7, 0.7, 0.9, '#e9dcc0'], [5, 0.3, 12, 1.4, 0.6, 1.4, '#c8a050'], [5, 0.75, 12, 1, 0.3, 1, '#d8b060'], [2, 0.5, 9, 1, 0.5, 1.6, '#2f6db3'], [2, 0.85, 9, 0.8, 0.2, 1.3, '#f08c00'],
    // The toiles of Korhogo hung on a line across the way in, for whoever comes through the gate.
    [-9, 1.4, 22, 0.1, 2.8, 0.1, TORON], [9, 1.4, 22, 0.1, 2.8, 0.1, TORON], [0, 2.75, 22, 18, 0.04, 0.04, '#3a2a1a'],
    ...[-7.5, -5.5, -3.5, 3.5, 5.5, 7.5].flatMap((x, i) => toile(1.6, 2, 20 + i).map((q): Part => [q[0] + x, q[1] + 0.3, q[2] + 22, q[3], q[4], q[5], q[6]]))],
}
export const MarcheKorhogo = ({ night }: { night: boolean }) => <Market spec={KO_MARCHE} night={night} />

/* ---------- The Maquis Le Tô de Mama Sita, Le Balafon Club ---------- */

/** A balafon on its frame: the wooden keys long to short, a gourd under each. Facing +z (the player behind it, at −z). */
const BALAFON: Part[] = [
  [-0.95, 0.35, 0, 0.08, 0.7, 0.6, '#6b4a2a'], [0.95, 0.35, 0, 0.08, 0.7, 0.6, '#6b4a2a'],
  ...[...Array(10)].flatMap((_, i): Part[] => [[-0.85 + i * 0.19, 0.74, 0, 0.15, 0.06, 0.55 - i * 0.025, '#a0522d'], [-0.85 + i * 0.19, 0.5, 0, 0.14, 0.2 - i * 0.008, 0.14, '#e0a040']]),
]
const MAMA_SITA: MaquisSpec = {
  name: 'LE TÔ DE MAMA SITA',
  sign: ['#2b8a3e', '#fff3bf'],
  wall: '#c08a5a',
  roof: 'straw',
  food: 'meat',
  plastic: ['#2f9e44', '#ffffff', '#f08c00'],
  seed: 31,
  // The tô's pot on its three stones, the big jars of tchapalo and their calabashes, the balafon.
  extra: [
    [-3.4, 0.12, 4.9, 0.28, 0.24, 0.28, '#6d6a62'], [-2.8, 0.12, 4.9, 0.28, 0.24, 0.28, '#6d6a62'], [-3.1, 0.12, 4.4, 0.28, 0.24, 0.28, '#6d6a62'], [-3.1, 0.5, 4.7, 0.9, 0.6, 0.9, '#2a2a2a'], [-3.1, 0.82, 4.7, 0.7, 0.04, 0.7, '#f1ece0'], [-2.9, 1.1, 4.6, 0.08, 0.8, 0.08, '#8a6a3c'],
    [-6.2, 0.45, -3.3, 0.9, 0.9, 0.9, '#8a4a2a'], [-6.2, 0.95, -3.3, 0.6, 0.1, 0.6, '#7a3a1e'], [-5.2, 0.4, -3.3, 0.8, 0.8, 0.8, '#8a4a2a'], [-5.7, 0.08, -2.6, 0.5, 0.16, 0.5, '#c8a050'],
    ...BALAFON.map((p): Part => [p[0] + 1.6, p[1], p[2] + 5.8, p[3], p[4], p[5], p[6]]),
  ],
  more: [
    { p: [1.6, 0, 6.5], ry: Math.PI, pose: 'busy', gender: 'homme', dress: { outfit: 'boubou', outfitColor: '#24386e' } },
    { p: [-3.1, 0, 5.4], ry: Math.PI, pose: 'cook', gender: 'femme', dress: { outfit: 'pagne', outfitColor: '#2f9e44' } },
  ],
}
const BALAFON_CLUB: ClubSpec = {
  name: 'LE BALAFON CLUB',
  neon: '#ffa94d',
  neon2: '#63e6be',
  wall: '#20142a',
  seed: 17,
  bpm: 116,
  // A great balafon along the roof's edge over the door, its keys and its gourds.
  motif: [[-5, 7.9, 4.6, 0.3, 1.2, 1.4, '#6b4a2a'], [5, 7.9, 4.6, 0.3, 1.2, 1.4, '#6b4a2a'], ...[...Array(12)].flatMap((_, i): Part[] => [[-4.4 + i * 0.8, 8.5, 4.6, 0.62, 0.22, 1.4 - i * 0.05, '#c26a2a'], [-4.4 + i * 0.8, 7.8, 4.6, 0.5, 0.6 - i * 0.02, 0.5, '#f0b44a']])],
}
export const MaquisMamaSita = ({ night }: { night: boolean }) => <Maquis spec={MAMA_SITA} night={night} />
export const BalafonClub = ({ night }: { night: boolean }) => <Club spec={BALAFON_CLUB} night={night} />
