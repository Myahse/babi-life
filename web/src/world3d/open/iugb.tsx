import { useMemo } from 'react'
import * as THREE from 'three'
import { rng } from '../themes'
import { Vehicle } from '../vehicles'
import { BOX } from './ruePrincesse'

// The International University of Grand-Bassam (IUGB), on the route de Bonoua, as the photos show it from
// its car park: three white blocks side by side, the windows framed in maroon. On the left, four floors,
// each with its band of maroon panels and its air conditioners; in the middle, five floors, its maroon
// pillars between the bays, the university's long sign on the roof (its name, « Excellence ·
// Accountability · Opportunity »); on the right, five floors, set a little forward, its bays in maroon
// columns. Before it the black railing, the hedge, three flags (Côte d'Ivoire, the university's, the
// United States: an American foundation helped found it), palm trees, the car park and its cars.
// Frame: +z the street (the car park), x along it.

const FLOOR = 3.3
const PX = 16 // canvas pixels a floor
const WHITE = '#efeee9'
const MAROON = '#8a2230'

type Paint = (g: CanvasRenderingContext2D, night: boolean, lit: () => boolean) => void
function painted(w: number, h: number, seed: string, paint: Paint) {
  const make = (night: boolean) => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const g = c.getContext('2d')!
    const r = rng(seed)
    paint(g, night, () => r() < 0.3)
    const t = new THREE.CanvasTexture(c)
    t.magFilter = THREE.NearestFilter
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }
  return new THREE.MeshLambertMaterial({ map: make(false), emissiveMap: make(true), emissive: '#ffe2a8', emissiveIntensity: 0 })
}

/** The left block's face: at each floor a band of maroon panels under the windows, an air conditioner here and there. */
const bands = (bays: number, floors: number, seed: string) =>
  painted(bays * PX, floors * PX, seed, (g, night, lit) => {
    g.fillStyle = night ? '#000' : WHITE
    g.fillRect(0, 0, bays * PX, floors * PX)
    for (let f = 0; f < floors; f++) {
      const y = f * PX
      if (!night) {
        g.fillStyle = MAROON
        g.fillRect(0, y + 11, bays * PX, 4)
      }
      for (let b = 0; b < bays; b++) {
        g.fillStyle = night ? (lit() ? '#fff1cc' : '#000') : '#2d3440'
        g.fillRect(b * PX + 3, y + 3, PX - 6, 7)
        if (!night && (b * 7 + f * 3) % 5 === 0) {
          g.fillStyle = '#c9ccd0'
          g.fillRect(b * PX + 10, y + 7, 4, 3)
        }
      }
    }
  })

/** The middle and right blocks' faces: maroon pillars between the bays, the windows white-framed between them. */
const pillars = (bays: number, floors: number, seed: string) =>
  painted(bays * PX, floors * PX, seed, (g, night, lit) => {
    g.fillStyle = night ? '#000' : WHITE
    g.fillRect(0, 0, bays * PX, floors * PX)
    for (let b = 0; b < bays; b++) {
      if (!night && b % 2 === 0) {
        g.fillStyle = MAROON
        g.fillRect(b * PX + 2, 2, PX - 4, floors * PX - 2)
      }
      for (let f = 0; f < floors; f++) {
        g.fillStyle = night ? (lit() ? '#fff1cc' : '#000') : '#2d3440'
        g.fillRect(b * PX + 4, f * PX + 4, PX - 8, 8)
      }
    }
  })

/** The university's sign on the roof: its name, its motto. */
function signMaterial() {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 64
  const g = c.getContext('2d')!
  g.fillStyle = '#f7f7f4'
  g.fillRect(0, 0, 512, 64)
  g.fillStyle = '#1c3f8a'
  g.beginPath()
  g.arc(36, 32, 22, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#f7f7f4'
  g.font = 'bold 18px sans-serif'
  g.fillText('IU', 24, 39)
  g.fillStyle = '#1c3f8a'
  g.font = 'bold 26px sans-serif'
  g.fillText('INTERNATIONAL UNIVERSITY OF GRAND-BASSAM', 68, 34, 436)
  g.font = 'italic 15px sans-serif'
  g.fillStyle = '#4a5568'
  g.fillText('Excellence · Accountability · Opportunity', 150, 56)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return new THREE.MeshLambertMaterial({ map: t })
}

/** A flag on its pole: Côte d'Ivoire's three bands, the university's, the United States'. */
function flagMaterial(kind: 'ci' | 'iugb' | 'us') {
  const c = document.createElement('canvas')
  c.width = 60
  c.height = 40
  const g = c.getContext('2d')!
  if (kind === 'ci') {
    ;['#f77f00', '#ffffff', '#009e60'].forEach((col, i) => ((g.fillStyle = col), g.fillRect(i * 20, 0, 20, 40)))
  } else if (kind === 'iugb') {
    g.fillStyle = '#1c3f8a'
    g.fillRect(0, 0, 60, 40)
    g.fillStyle = '#ffd43b'
    g.fillRect(24, 10, 12, 20)
  } else {
    for (let i = 0; i < 13; i++) ((g.fillStyle = i % 2 ? '#ffffff' : '#b22234'), g.fillRect(0, (i * 40) / 13, 60, 40 / 13 + 0.5))
    g.fillStyle = '#3c3b6e'
    g.fillRect(0, 0, 26, 22)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return new THREE.MeshLambertMaterial({ map: t, side: THREE.DoubleSide })
}

const plain = (color: string) => new THREE.MeshLambertMaterial({ color })

/** One block: its painted front, white sides and back, a flat roof with its low parapet. */
function Block({ x, z, w, d, floors, front, night }: { x: number; z: number; w: number; d: number; floors: number; front: THREE.MeshLambertMaterial; night: boolean }) {
  const h = floors * FLOOR
  const mats = useMemo(() => {
    const side = plain(WHITE)
    const top = plain('#b8b6ae')
    return [side, side, top, side, front, side]
  }, [front])
  front.emissiveIntensity = night ? 1 : 0
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={BOX} material={mats} position={[0, h / 2, 0]} scale={[w, h, d]} castShadow receiveShadow />
      <mesh geometry={BOX} material={mats[2]} position={[0, h + 0.4, d / 2 - 0.15]} scale={[w, 0.8, 0.3]} />
    </group>
  )
}

export function Iugb({ night }: { night: boolean }) {
  const m = useMemo(
    () => ({
      left: bands(12, 4, 'iugb-left'),
      mid: pillars(11, 5, 'iugb-mid'),
      right: pillars(8, 5, 'iugb-right'),
      sign: signMaterial(),
      ci: flagMaterial('ci'),
      iugb: flagMaterial('iugb'),
      us: flagMaterial('us'),
      rail: plain('#1c1c1f'),
      hedge: plain('#2f6b2f'),
      asphalt: new THREE.MeshLambertMaterial({ color: '#8d8a84', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      steel: plain('#c9ccd0'),
      trunk: plain('#8a6a45'),
      palm: plain('#2f8a3e'),
    }),
    [],
  )
  return (
    <group>
      {/* The three blocks */}
      <Block x={-22} z={-6} w={26} d={14} floors={4} front={m.left} night={night} />
      <Block x={2} z={-7} w={24} d={16} floors={5} front={m.mid} night={night} />
      <Block x={21} z={-4} w={16} d={14} floors={5} front={m.right} night={night} />
      {/* The sign on its frame over the middle block */}
      <group position={[2, 5 * FLOOR + 0.8, 0.4]}>
        {[-8, -3, 3, 8].map((x) => (
          <mesh key={x} geometry={BOX} material={m.steel} position={[x, 0.8, -0.3]} scale={[0.15, 1.6, 0.15]} />
        ))}
        <mesh geometry={BOX} material={m.sign} position={[0, 2.4, 0]} scale={[19, 2.4, 0.2]} />
      </group>
      {/* The car park, the railing, the hedge */}
      <mesh geometry={BOX} material={m.asphalt} position={[0, 0.01, 12]} scale={[64, 0.02, 16]} receiveShadow />
      <mesh geometry={BOX} material={m.rail} position={[-6, 1.0, 3.6]} scale={[40, 0.08, 0.08]} />
      <mesh geometry={BOX} material={m.rail} position={[-6, 0.2, 3.6]} scale={[40, 0.08, 0.08]} />
      {Array.from({ length: 41 }, (_, i) => (
        <mesh key={i} geometry={BOX} material={m.rail} position={[-26 + i, 0.75, 3.6]} scale={[0.05, 1.5, 0.05]} />
      ))}
      <mesh geometry={BOX} material={m.hedge} position={[-6, 0.45, 4.6]} scale={[40, 0.9, 1.0]} />
      <mesh geometry={BOX} material={m.hedge} position={[10, 0.45, 18]} scale={[14, 0.9, 1.2]} />
      {/* The three flags */}
      {(['ci', 'iugb', 'us'] as const).map((k, i) => (
        <group key={k} position={[14 + i * 2.2, 0, 3.2]}>
          <mesh geometry={BOX} material={m.steel} position={[0, 4, 0]} scale={[0.1, 8, 0.1]} />
          <mesh geometry={BOX} material={m[k]} position={[0.75, 7.2, 0]} scale={[1.5, 1.0, 0.02]} />
        </group>
      ))}
      {/* Palm trees */}
      {[
        [-30, 6],
        [24, 6],
        [30, 14],
      ].map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0, z]}>
          <mesh geometry={BOX} material={m.trunk} position={[0, 2.5, 0]} scale={[0.35, 5, 0.35]} />
          {[0, 1.25, 2.5, 3.75, 5].map((a) => (
            <mesh key={a} geometry={BOX} material={m.palm} position={[Math.sin(a) * 1.1, 5, Math.cos(a) * 1.1]} rotation={[0.35, a, 0]} scale={[0.4, 0.08, 2.2]} />
          ))}
        </group>
      ))}
      {/* The cars in the car park */}
      <Vehicle p={[-8, 0, 11]} r={Math.PI / 2} kind="car" color="#f1f3f5" seed={3} />
      <Vehicle p={[-3, 0, 11.5]} r={Math.PI / 2} kind="car" color="#212529" seed={5} />
      <Vehicle p={[-13, 0, 10.6]} r={Math.PI / 2} kind="car" color="#343a40" seed={8} />
    </group>
  )
}
