import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Human, NoShadows } from '../../avatar/Human'
import { OUTFIT_DEFAULT_COLOR, randomLook } from '../../avatar/options'
import { worldTime } from '../../lib/worldClock'
import { rng } from '../themes'
import { Blocks, PLANE } from './ruePrincesse'
import { People, type Staff } from './hotelBits'
import { along, routeLength } from './shared'
import type { XZ } from './geo'
import { t as tr } from '../../lib/i18n'

// The Musée des Civilisations de Côte d'Ivoire, avenue Nangui-Abrogoua on the
// Plateau: the colonial hall of the old craft centre (1942) with its tiled
// hipped roof and its arcaded veranda, the U of offices and stores behind it
// (1945), in a garden under a great kapok tree; a carved figure on its plinth
// before the doors, the name on the gate. A school class goes round in line
// behind its teacher. Sizes are the game's estimates. Frame: +z the street.

const W = 20 // half the hall's length
const D = 8 // half its depth
const H = 6.5
const GARDEN = 16 // from the veranda to the gate

const white = new THREE.MeshLambertMaterial({ color: '#ffffff' })
const tiles = new THREE.MeshLambertMaterial({ color: '#a0482c' })
const lawn = new THREE.MeshLambertMaterial({ color: '#58a046', polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
const path = new THREE.MeshLambertMaterial({ color: '#d9c7a3', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
const wood = new THREE.MeshLambertMaterial({ color: '#4a2e1c' })
const bark = new THREE.MeshLambertMaterial({ color: '#8d8174' })
const leaves = new THREE.MeshLambertMaterial({ color: '#3f7f34' })

type Block = { p: [number, number, number]; s: [number, number, number]; ry?: number; c?: string }

/** A hipped roof over a w × d rectangle (half sizes), its ridge along x, `h` high; its eaves at y 0. */
export function hipRoof(w: number, d: number, h: number) {
  const r = Math.max(0, w - d)
  const v = (x: number, y: number, z: number) => [x, y, z]
  const [a, b, c, e, f, g] = [v(-w, 0, d), v(w, 0, d), v(w, 0, -d), v(-w, 0, -d), v(-r, h, 0), v(r, h, 0)]
  // The two long slopes (two triangles each), the two hips at the ends.
  const tris = [a, b, g, a, g, f, c, e, f, c, f, g, b, c, g, e, a, f]
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3))
  geo.computeVertexNormals()
  return geo
}

/** The name on the gate: carved letters on a pale board. */
function board(text: string, sub: string) {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 160
  const g = c.getContext('2d')!
  g.fillStyle = '#f4ead2'
  g.fillRect(0, 0, 1024, 160)
  g.fillStyle = '#5a2e14'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = '900 58px serif'
  g.fillText(text, 512, 62)
  g.font = '700 34px serif'
  g.fillText(sub, 512, 122)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return new THREE.MeshLambertMaterial({ map: t })
}

export function Musee({ night }: { night: boolean }) {
  const roofs = useMemo(() => ({ hall: hipRoof(W + 1.6, D + 1.6, 4.2), wing: hipRoof(7, 4.5, 2.6), back: hipRoof(17, 4.5, 2.6) }), [])
  const sign = useMemo(() => board(tr('MUSÉE DES CIVILISATIONS'), tr("DE CÔTE D'IVOIRE")), [])
  const blocks = useMemo(() => {
    const b: Block[] = []
    // The hall: ochre walls on a low plinth, its tall shuttered windows; the veranda's arcade along its front.
    b.push({ p: [0, 0.3, 0], s: [2 * W + 1, 0.6, 2 * D + 1], c: '#cbbda0' })
    b.push({ p: [0, H / 2, 0], s: [2 * W, H, 2 * D], c: '#e9d3a8' })
    for (let x = -W + 3; x <= W - 3 + 0.01; x += 4)
      if (Math.abs(x) > 3) for (const z of [D + 0.06, -D - 0.06]) b.push({ p: [x, 3, z], s: [1.6, 3.2, 0.1], c: '#5b3a22' })
    for (let x = -W + 1.5; x <= W - 1.5 + 0.01; x += 3) b.push({ p: [x, 2.5, D + 3], s: [0.6, 5, 0.6], c: '#f8f4ea' })
    b.push({ p: [0, 5.2, D + 3], s: [2 * W, 0.8, 0.7], c: '#f8f4ea' })
    b.push({ p: [0, 5.75, D + 1.6], s: [2 * W + 0.6, 0.3, 3.6], c: '#a0482c' })
    b.push({ p: [0, 0.35, D + 1.6], s: [2 * W, 0.7, 3.4], c: '#cbbda0' })
    // The doors in the middle: carved wood, two leaves.
    b.push({ p: [-0.9, 2.2, D + 0.08], s: [1.7, 3.6, 0.12], c: '#6b3e22' }, { p: [0.9, 2.2, D + 0.08], s: [1.7, 3.6, 0.12], c: '#6b3e22' })
    // The U behind: two wings and the back, lower and white.
    for (const x of [-W + 7, W - 7]) b.push({ p: [x, 2.2, -D - 9], s: [14, 4.4, 9], c: '#f1ece2' })
    b.push({ p: [0, 2.2, -D - 18], s: [34, 4.4, 9], c: '#f1ece2' })
    for (const x of [-W + 7, W - 7]) for (let z = -D - 12; z <= -D - 6; z += 3) b.push({ p: [x + (x < 0 ? 7.06 : -7.06), 2.4, z], s: [0.1, 1.6, 1.2], c: '#4b5563' })
    // The gate on the street: its two pillars, the low wall either side.
    for (const x of [-4.5, 4.5]) b.push({ p: [x, 1.6, D + GARDEN], s: [1.2, 3.2, 1.2], c: '#e9d3a8' })
    for (const s of [-1, 1]) b.push({ p: [s * (W / 2 + 7), 0.7, D + GARDEN], s: [W + 4, 1.4, 0.5], c: '#e9d3a8' })
    // The figure's plinth by the path.
    b.push({ p: [-6, 0.6, D + 8], s: [2.2, 1.2, 2.2], c: '#cbbda0' })
    return b
  }, [])
  // The guard at the gate, a couple photographing the figure, a visitor on the veranda.
  const people = useMemo<Staff[]>(
    () => [
      { p: [5.8, 0, D + GARDEN + 0.8], r: 0, who: 'vigile' },
      { p: [-3.4, 0, D + 10.6], r: -2.3, pose: 'film' },
      { p: [-2.4, 0, D + 11.4], r: -2.6, pose: 'idle' },
      { p: [9, 0.7, D + 2], r: 0.4, pose: 'phone' },
    ],
    [],
  )
  return (
    <group>
      {/* The garden: lawns, the sandy path from the gate to the doors, round the hall */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, -4]} scale={[2 * W + 14, 2 * D + 2 * GARDEN + 14, 1]} geometry={PLANE} material={lawn} receiveShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, D + GARDEN / 2 + 2]} scale={[4, GARDEN, 1]} geometry={PLANE} material={path} receiveShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, D + 5]} scale={[2 * W + 6, 3, 1]} geometry={PLANE} material={path} receiveShadow />
      <Blocks at={blocks} material={white} color />
      <mesh geometry={roofs.hall} material={tiles} position={[0, H, 0]} castShadow receiveShadow />
      {[-W + 7, W - 7].map((x) => (
        <mesh key={x} geometry={roofs.wing} material={tiles} position={[x, 4.4, -D - 9]} rotation={[0, Math.PI / 2, 0]} castShadow />
      ))}
      <mesh geometry={roofs.back} material={tiles} position={[0, 4.4, -D - 18]} castShadow />
      <mesh position={[0, 3.6, D + GARDEN + 0.66]} scale={[7.8, 1.2, 1]} geometry={PLANE} material={sign} />
      <mesh position={[0, 3.6, D + GARDEN - 0.66]} rotation={[0, Math.PI, 0]} scale={[7.8, 1.2, 1]} geometry={PLANE} material={sign} />
      <mesh position={[0, 3.6, D + GARDEN]} scale={[8.2, 1.4, 0.2]} material={white}>
        <boxGeometry />
      </mesh>
      <Figure at={[-6, 1.2, D + 8]} />
      <Kapok at={[14, 0, D + 10]} />
      <Kapok at={[-W - 4, 0, -6]} small />
      {night && <pointLight position={[0, 5, D + 4]} intensity={30} distance={22} color="#ffe2b0" />}
      <NoShadows>
        <People at={people} seed="musee" />
        {!night && <ClassOuting />}
      </NoShadows>
    </group>
  )
}

/** A carved figure before the doors, as the Baoulé and Sénoufo ones inside: a tall standing body, arms down, a crest. */
function Figure({ at }: { at: [number, number, number] }) {
  return (
    <group position={at}>
      <mesh position={[0, 0.5, 0]} material={wood} castShadow>
        <cylinderGeometry args={[0.35, 0.45, 1, 8]} />
      </mesh>
      <mesh position={[0, 1.6, 0]} material={wood} castShadow>
        <cylinderGeometry args={[0.32, 0.36, 1.3, 8]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.42, 1.55, 0]} material={wood} castShadow>
          <cylinderGeometry args={[0.08, 0.1, 1.2, 6]} />
        </mesh>
      ))}
      <mesh position={[0, 2.6, 0]} scale={[0.75, 1.25, 0.8]} material={wood} castShadow>
        <sphereGeometry args={[0.36, 10, 8]} />
      </mesh>
      <mesh position={[0, 3.25, 0]} material={wood} castShadow>
        <coneGeometry args={[0.18, 0.7, 6]} />
      </mesh>
    </group>
  )
}

/** A kapok tree (fromager): a pale trunk on its buttresses, a wide flat crown high up. */
function Kapok({ at, small }: { at: [number, number, number]; small?: boolean }) {
  const k = small ? 0.7 : 1
  return (
    <group position={at} scale={[k, k, k]}>
      <mesh position={[0, 6, 0]} material={bark} castShadow>
        <cylinderGeometry args={[0.7, 1.1, 12, 8]} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} position={[Math.sin(i * 1.26) * 1, 1.1, Math.cos(i * 1.26) * 1]} rotation={[0, i * 1.26, 0]} scale={[0.25, 2.2, 1.6]} material={bark}>
          <boxGeometry />
        </mesh>
      ))}
      {[
        [0, 13, 0, 6],
        [3.5, 12, 1.5, 4],
        [-3.2, 12.4, -1.8, 4.4],
        [1, 14.2, -3, 3.6],
      ].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} scale={[1, 0.42, 1]} material={leaves} castShadow>
          <sphereGeometry args={[r, 10, 8]} />
        </mesh>
      ))}
    </group>
  )
}

/** The way a class goes round: in at the gate, along the veranda, round the figure, out again. */
const ROUTE: XZ[] = [
  [0, D + GARDEN - 1],
  [0, D + 6],
  [-12, D + 5],
  [-16, D + 7],
  [-8, D + 10],
  [-2, D + 13],
  [0, D + GARDEN - 1],
]

/** A school class on its outing: the teacher ahead, the pupils in uniform in line behind, all walking the route in a loop. */
function ClassOuting() {
  const len = useMemo(() => routeLength(ROUTE), [])
  const group = useMemo(() => {
    const r = rng('musee-classe')
    const teacher = { gender: 'femme' as const, look: { ...randomLook('femme', r), outfit: 'robe' }, kid: false, seed: r() * 100 }
    const pupils = [...Array(9)].map(() => {
      const gender: 'femme' | 'homme' = r() < 0.5 ? 'femme' : 'homme'
      return { gender, look: { ...randomLook(gender, r), outfit: 'uniforme', outfitColor: OUTFIT_DEFAULT_COLOR.uniforme, accessory: 'none' }, kid: true, seed: r() * 100 }
    })
    return [teacher, ...pupils]
  }, [])
  const refs = useRef<(THREE.Group | null)[]>([])
  useFrame(() => {
    const t = worldTime()
    group.forEach((_, i) => {
      const g = refs.current[i]
      if (!g) return
      // One behind the other, a metre and a bit apart, round and round.
      const d = (((t * 0.9 - i * 1.3) % len) + len) % len
      const at = along(ROUTE, d)
      g.position.set(at.x, 0, at.z)
      g.rotation.y = at.r
    })
  })
  return (
    <>
      {group.map((p, i) => (
        <group key={i} ref={(g) => void (refs.current[i] = g)} scale={p.kid ? 0.72 : 1}>
          <Human look={p.look} gender={p.gender} pose="walk" speed={0.9} seed={p.seed} />
        </group>
      ))}
    </>
  )
}

/** What a walker can't go through: the hall and its veranda, the U behind, the gate's pillars, the figure, the kapok (its frame). */
export const MUSEE_SOLID: ({ x: number; z: number; r: number } | { x: number; z: number; hw: number; hd: number; rot: number; top?: number })[] = [
  { x: 0, z: 0, hw: W + 0.5, hd: D + 0.5, rot: 0, top: H },
  { x: -W + 7, z: -D - 9, hw: 7, hd: 4.5, rot: 0, top: 4.4 },
  { x: W - 7, z: -D - 9, hw: 7, hd: 4.5, rot: 0, top: 4.4 },
  { x: 0, z: -D - 18, hw: 17, hd: 4.5, rot: 0, top: 4.4 },
  { x: -4.5, z: D + GARDEN, r: 0.8 },
  { x: 4.5, z: D + GARDEN, r: 0.8 },
  { x: -6, z: D + 8, r: 1.3 },
  { x: 14, z: D + 10, r: 1.4 },
]
