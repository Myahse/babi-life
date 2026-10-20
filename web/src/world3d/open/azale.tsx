import { useMemo } from 'react'
import * as THREE from 'three'
import { Vehicle } from '../vehicles'
import { BOX, Blocks } from './ruePrincesse'
import { Palm } from './noum'

// The Azalé Hôtel in Marcory, as the photos of the real one show it: a slim
// tower of sixteen floors in sand-coloured stone, a tall strip of blue glass
// up its middle and a column of framed square windows beside it; on its left a
// glass shaft ribbed floor by floor, on its right glass slices stepping down
// at the crown. In front a tall block clad in copper tiles carries the leaf
// and the name, a grey louvred panel under it; low wings on each side, the
// right one with the glass entrance; flags, a railing along the street, palms.
// Sizes are the game's estimates. Frame: +z toward the street.

type Block = { p: [number, number, number]; s: [number, number, number]; ry?: number; c?: string }

const STOREY = 3.5
const FLOORS = 16
const TOWER = { x0: -9, x1: 9, z0: -18, z1: -4 }
const TOP = 6 + FLOORS * STOREY
/** The copper block over the entrance, standing in front of the tower. */
const FRONT = { x0: -7, x1: 7, z0: -4, z1: 2, h: 22 }
const WINGS = [
  { x0: -30, x1: -13, z0: -14, z1: 0, h: 10, c: '#d8c6a2' },
  { x0: 7, x1: 30, z0: -16, z1: 2, h: 14, c: '#e8dcc4' },
] as const

const stone = new THREE.MeshLambertMaterial({ color: '#d8c29a' })
const brown = new THREE.MeshLambertMaterial({ color: '#7a3a26' })
const rail = new THREE.MeshLambertMaterial({ color: '#2b2e33' })
const paving = new THREE.MeshLambertMaterial({ color: '#c4bdb2', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
const lawn = new THREE.MeshLambertMaterial({ color: '#4e9a3f', polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
const COLORED = new THREE.MeshLambertMaterial({ color: '#ffffff' })
const PLANE_GEO = new THREE.PlaneGeometry(1, 1)

const rnd = (i: number) => Math.abs((Math.sin(i * 12.9898) * 43758.5453) % 1)
const tex = (c: HTMLCanvasElement, nearest = true) => {
  const t = new THREE.CanvasTexture(c)
  if (nearest) t.magFilter = THREE.NearestFilter
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
const canvas = (w: number, h: number) => {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!] as const
}

/** The tower's front: stone, the glass strip in the middle, the framed windows to its right; at night rooms lit. */
function towerFront(night: boolean) {
  const [c, g] = canvas(36, FLOORS * 8)
  g.fillStyle = night ? '#6e6250' : '#d8c29a'
  g.fillRect(0, 0, 36, c.height)
  for (let f = 0; f < FLOORS; f++) {
    // The glass strip: blue, a floor line every storey, a few lit rooms behind.
    g.fillStyle = night ? (rnd(f) > 0.5 ? '#ffe2a0' : '#1d2a44') : f % 2 ? '#6f9fd0' : '#5a8cc2'
    g.fillRect(11, f * 8, 10, 8)
    g.fillStyle = night ? '#3a3f4a' : '#c9d9ea'
    g.fillRect(11, f * 8 + 7, 10, 1)
    // The column of square windows in their brown frames.
    g.fillStyle = '#7a3a26'
    g.fillRect(24, f * 8 + 1, 7, 6)
    g.fillStyle = night && rnd(f * 7 + 3) > 0.45 ? '#ffd890' : '#3c5876'
    g.fillRect(25, f * 8 + 2, 5, 4)
  }
  return tex(c)
}

/** Blue glass ribbed by a ledge every floor: the left shaft and the stepped slices on the right. */
function ribbed(night: boolean, gold = false) {
  const [c, g] = canvas(16, FLOORS * 4)
  for (let f = 0; f < FLOORS; f++) {
    g.fillStyle = night ? (rnd(f * 3 + (gold ? 9 : 1)) > 0.6 ? '#ffd890' : '#18243a') : gold ? '#9ab3c4' : '#3f74b8'
    g.fillRect(0, f * 4, 16, 3)
    g.fillStyle = night ? '#55606e' : '#d6dde4'
    g.fillRect(0, f * 4 + 3, 16, 1)
  }
  return tex(c)
}

/** Copper tiles, a fine grid of joints. */
function copper() {
  const [c, g] = canvas(64, 96)
  g.fillStyle = '#a8623f'
  g.fillRect(0, 0, 64, 96)
  g.fillStyle = '#8f4f32'
  for (let x = 0; x < 64; x += 8) g.fillRect(x, 0, 1, 96)
  for (let y = 0; y < 96; y += 8) g.fillRect(0, y, 64, 1)
  return tex(c)
}

/** The grey louvres under the name: thin horizontal slats. */
function louvres() {
  const [c, g] = canvas(8, 64)
  g.fillStyle = '#4a4d52'
  g.fillRect(0, 0, 8, 64)
  g.fillStyle = '#8a8e94'
  for (let y = 0; y < 64; y += 2) g.fillRect(0, y, 8, 1)
  return tex(c)
}

/** The leaf in its circle and the name, in white on nothing: the copper shows behind. */
function emblem() {
  const [c, g] = canvas(256, 256)
  g.fillStyle = '#ffffff'
  g.beginPath()
  g.arc(128, 64, 46, 0, Math.PI * 2)
  g.fill()
  // The leaf, cut out of the circle by its outline and its midrib.
  g.strokeStyle = '#a8623f'
  g.lineWidth = 5
  g.beginPath()
  g.moveTo(128, 24)
  g.quadraticCurveTo(170, 64, 128, 104)
  g.quadraticCurveTo(86, 64, 128, 24)
  g.moveTo(128, 30)
  g.lineTo(128, 104)
  g.stroke()
  g.fillStyle = '#ffffff'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = '800 40px serif'
  g.fillText('AZALÉ', 128, 142)
  g.fillText('HOTEL', 128, 184)
  g.font = '700 18px serif'
  g.fillText('ABIDJAN', 128, 216)
  const t = tex(c, false)
  return new THREE.MeshLambertMaterial({ map: t, transparent: true, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.5 })
}

/** A flag of three bands, along x. */
const flag = (x: number, z: number, top: number, colors: string[]): Block[] => colors.map((c, i) => ({ p: [x + 0.35 + i * 0.4, top - 0.6, z], s: [0.4, 1, 0.04], c }))
const FLAGS = [
  ['#ff8200', '#ffffff', '#009e60'],
  ['#ce1126', '#fcd116', '#14b53a'],
  ['#14b53a', '#fcd116', '#ce1126'],
  ['#0072c6', '#ffffff', '#ce1126'],
]

export function HotelAzale({ night }: { night: boolean }) {
  const mats = useMemo(() => {
    const lit = (map: THREE.Texture, k: number) => new THREE.MeshLambertMaterial({ map, emissive: night ? '#ffffff' : '#000000', emissiveMap: night ? map : null, emissiveIntensity: night ? k : 0 })
    const cu = copper()
    cu.wrapS = cu.wrapT = THREE.RepeatWrapping
    cu.repeat.set(2, 3)
    const wing = (c: string) => new THREE.MeshLambertMaterial({ color: c })
    return {
      front: lit(towerFront(night), 0.5),
      shaft: lit(ribbed(night), 0.5),
      slices: lit(ribbed(night, true), 0.5),
      copper: new THREE.MeshLambertMaterial({ map: cu }),
      louvres: new THREE.MeshLambertMaterial({ map: louvres() }),
      emblem: emblem(),
      wings: WINGS.map((w) => wing(w.c)),
      glass: new THREE.MeshLambertMaterial({ color: night ? '#ffd9a0' : '#4f7d9c', emissive: '#ffb45a', emissiveIntensity: night ? 0.8 : 0 }),
    }
  }, [night])
  const tw = TOWER.x1 - TOWER.x0
  const td = TOWER.z1 - TOWER.z0
  const tcz = (TOWER.z0 + TOWER.z1) / 2
  const fence = useMemo(() => {
    const out: Block[] = [{ p: [-12, 2, 12], s: [36, 0.1, 0.1] }, { p: [24, 2, 12], s: [20, 0.1, 0.1] }]
    // Bars every half metre, the gate left open for the drive.
    for (let x = -30; x <= 34; x += 0.5) if (x < 6 || x > 14) out.push({ p: [x, 1, 12], s: [0.06, 2, 0.06] })
    return out
  }, [])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[2, 0.02, 7]} geometry={PLANE_GEO} scale={[64, 12, 1]} material={paving} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-22, 0.03, 9]} geometry={PLANE_GEO} scale={[14, 4, 1]} material={lawn} />
      {/* The tower: its stone box, the glass strip and windows on the front, the brown frame of its crown */}
      <mesh geometry={BOX} position={[0, TOP / 2, tcz]} scale={[tw, TOP, td]} material={stone} castShadow receiveShadow />
      <mesh position={[0, TOP / 2 + 3, TOWER.z1 + 0.02]} material={mats.front}>
        <planeGeometry args={[tw, TOP - 6]} />
      </mesh>
      <Blocks at={[{ p: [0, TOP + 0.6, TOWER.z1 - 0.3], s: [tw + 0.6, 1.2, 1] }, { p: [-tw / 2, TOP / 2, TOWER.z1 - 0.3], s: [0.6, TOP, 1] }]} material={brown} />
      {/* The ribbed glass shaft on the left, a little taller than the tower */}
      <mesh geometry={BOX} position={[TOWER.x0 - 2, (TOP + 3) / 2, tcz]} scale={[4, TOP + 3, td - 2]} material={mats.shaft} castShadow />
      {/* The glass slices on the right, stepping down at the crown */}
      {[0, 1, 2, 3].map((i) => {
        const h = TOP - 2 - i * 4
        return <mesh key={i} geometry={BOX} position={[TOWER.x1 + 0.75 + i * 1.5, h / 2, tcz - 1]} scale={[1.5, h, td - 4]} material={mats.slices} castShadow />
      })}
      {/* The copper block over the entrance, the emblem high on it, the louvres below */}
      <mesh geometry={BOX} position={[(FRONT.x0 + FRONT.x1) / 2, FRONT.h / 2, (FRONT.z0 + FRONT.z1) / 2]} scale={[FRONT.x1 - FRONT.x0, FRONT.h, FRONT.z1 - FRONT.z0]} material={mats.copper} castShadow />
      <mesh position={[0, FRONT.h - 4.5, FRONT.z1 + 0.03]} material={mats.emblem}>
        <planeGeometry args={[7, 7]} />
      </mesh>
      <mesh position={[0, 8, FRONT.z1 + 0.03]} material={mats.louvres}>
        <planeGeometry args={[11, 11]} />
      </mesh>
      {/* The low wings, the right one with its glass bands and the glass entrance */}
      {WINGS.map((w, i) => (
        <mesh key={i} geometry={BOX} position={[(w.x0 + w.x1) / 2, w.h / 2, (w.z0 + w.z1) / 2]} scale={[w.x1 - w.x0, w.h, w.z1 - w.z0]} material={mats.wings[i]} castShadow receiveShadow />
      ))}
      <Blocks at={[{ p: [18.5, 10.5, 2.05], s: [21, 2.4, 0.1] }, { p: [-21.5, 6, 0.05], s: [15, 3, 0.1] }]} material={mats.glass} />
      <mesh position={[10.5, 3, 2.05]} material={mats.glass}>
        <planeGeometry args={[6, 5.5]} />
      </mesh>
      <mesh geometry={BOX} position={[10.5, 6, 4]} scale={[8, 0.4, 4]} material={stone} />
      {night && <pointLight position={[10.5, 4, 6]} intensity={25} distance={14} color="#ffd9a0" />}
      {/* The flags of the sub-region along the right wing */}
      {FLAGS.map((cols, i) => {
        const x = 18 + i * 3
        return (
          <group key={i}>
            <mesh geometry={BOX} position={[x, 4.5, 8]} scale={[0.1, 9, 0.1]} material={rail} />
            <Blocks at={flag(x, 8, 9, cols)} material={COLORED} color />
          </group>
        )
      })}
      <Blocks at={fence} material={rail} />
      {[-26, -18, -10, 4, 32].map((x) => (
        <Palm key={x} x={x} z={9.5} h={6} />
      ))}
      <Vehicle p={[-6, 0, 7]} r={Math.PI / 2} kind="car" seed={5} color="#8d8f91" />
      <Vehicle p={[10, 0, 8]} r={0} kind="car" seed={12} color="#212529" />
    </group>
  )
}

/** What one can't walk through: the tower and its shafts, the copper block, the wings, the railing. */
export const AZALE_SOLID: ({ x: number; z: number; r: number } | { x: number; z: number; hw: number; hd: number; rot: number; top?: number })[] = [
  { x: 1, z: (TOWER.z0 + TOWER.z1) / 2, hw: 15, hd: (TOWER.z1 - TOWER.z0) / 2 + 0.5, rot: 0, top: TOP + 3 },
  { x: 0, z: (FRONT.z0 + FRONT.z1) / 2, hw: (FRONT.x1 - FRONT.x0) / 2 + 0.4, hd: (FRONT.z1 - FRONT.z0) / 2 + 0.4, rot: 0, top: FRONT.h },
  ...WINGS.map((w) => ({ x: (w.x0 + w.x1) / 2, z: (w.z0 + w.z1) / 2, hw: (w.x1 - w.x0) / 2 + 0.4, hd: (w.z1 - w.z0) / 2 + 0.4, rot: 0, top: w.h })),
  { x: -12, z: 12, hw: 18, hd: 0.3, rot: 0, top: 2 },
  { x: 24, z: 12, hw: 10, hd: 0.3, rot: 0, top: 2 },
]
