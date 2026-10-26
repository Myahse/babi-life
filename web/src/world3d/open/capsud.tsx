import { useMemo } from 'react'
import * as THREE from 'three'
import { Vehicle } from '../vehicles'
import { BOX, Blocks } from './ruePrincesse'
import { People, Stroller, type Staff } from './hotelBits'
import { CarPark, LampPost } from './playce'
import { Palm } from './noum'

// Cap Sud (Zone 4, Marcory), as the user's photos show it: a long low box in
// royal-blue ribbed cladding on a white base band; on the left the entrance,
// a curved glass front under a big orange roof shaped like a wave with a
// pointed crest, and the sign, CAP in red on white over SUD in white on dark
// blue; a smaller orange swoosh over the door at the right end. The flat
// white roof full of air-conditioning units, a lattice mast behind. In front
// the car park, a red and white zebra crossing, the twin lamps, motorbikes,
// and a billboard (the game's own brands). Sizes are the game's estimates.
// Frame: +z toward the street.

type Block = { p: [number, number, number]; s: [number, number, number]; ry?: number; c?: string }

/** The box: x from, x to, height, depth back from the front (z 0). */
const MALL = { x0: -42, x1: 42, h: 9, d: 32 }
/** The left entrance: the glass rotunda's middle and radius, the wave over it. */
const ENTRY = { x: -29, r: 6.5, h: 6.5 }
/** The right-end door. */
const DOOR = { x: 34 }
/** The car park, past the paved forecourt in front of the doors. */
const PARK = { x0: -44, x1: 44, z0: 9, z1: 35 }

const COLORED = new THREE.MeshLambertMaterial({ color: '#ffffff' })
/** The zebra's paint: drawn over the car park's asphalt and markings (they're pulled forward too, playce.tsx). */
const ZEBRA_PAINT = new THREE.MeshLambertMaterial({ color: '#ffffff', polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })
/** The zebra crossing from the forecourt over the car park's drive: bars along the drive, red and white in turn. */
const ZEBRA: Block[] = Array.from({ length: 5 }, (_, k) => ({ p: [ENTRY.x + 1, 0.03, PARK.z0 + 0.3 + k * 0.5], s: [3.2, 0.01, 0.46], c: k % 2 ? '#f8f9fa' : '#e03131' }))

const canvas = (w: number, h: number) => {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!] as const
}
const tex = (c: HTMLCanvasElement, nearest = true) => {
  const t = new THREE.CanvasTexture(c)
  if (nearest) t.magFilter = THREE.NearestFilter
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** The royal-blue cladding: upright ribs, light on one edge, shadow on the other. */
function blueRibs(w: number, h: number) {
  const [c, g] = canvas(16, 16)
  g.fillStyle = '#1c4fb8'
  g.fillRect(0, 0, 16, 16)
  for (let x = 0; x < 16; x += 4) {
    g.fillStyle = '#2a63d6'
    g.fillRect(x, 0, 1, 16)
    g.fillStyle = '#163f94'
    g.fillRect(x + 2, 0, 1, 16)
  }
  const t = tex(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(w / 1.2, h / 4)
  return new THREE.MeshLambertMaterial({ map: t })
}

/** The sign: CAP in red on white over SUD in white on dark blue. */
function capSudSign(night: boolean) {
  const [c, g] = canvas(256, 256)
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, 256, 128)
  g.fillStyle = '#14286b'
  g.fillRect(0, 128, 256, 128)
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = '900 104px sans-serif'
  g.fillStyle = '#e1251b'
  g.fillText('CAP', 128, 70)
  g.fillStyle = '#ffffff'
  g.fillText('SUD', 128, 196)
  const t = tex(c, false)
  return new THREE.MeshLambertMaterial({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: night ? 0.8 : 0.05 })
}

/** The billboard by the car park, the game's own brands. */
function billboardFace() {
  const [c, g] = canvas(512, 256)
  const grad = g.createLinearGradient(0, 0, 512, 256)
  grad.addColorStop(0, '#1b8f5a')
  grad.addColorStop(1, '#0b5d3b')
  g.fillStyle = grad
  g.fillRect(0, 0, 512, 256)
  g.fillStyle = '#ffd43b'
  g.font = '900 86px sans-serif'
  g.textBaseline = 'middle'
  g.fillText('Pingus', 32, 92)
  g.fillStyle = '#ffffff'
  g.font = '700 34px sans-serif'
  g.fillText("Envoie l'argent en un geste", 34, 170)
  g.font = '600 26px sans-serif'
  g.fillText('0 frais entre amis', 34, 216)
  return new THREE.MeshLambertMaterial({ map: tex(c, false) })
}

/**
 * The orange roof over the entrance, seen from the front: a wave rising from
 * the box's top to a pointed crest, then falling away; a band 0.7 m thick,
 * pushed out over the glass. `k` its size (1 the big one, the right door's smaller).
 */
function waveRoof(k: number, depth: number) {
  const s = new THREE.Shape()
  s.moveTo(-13 * k, 0)
  s.quadraticCurveTo(-5 * k, 0.6 * k, -1 * k, 8.5 * k)
  s.quadraticCurveTo(2 * k, 3.4 * k, 12 * k, 1.6 * k)
  s.lineTo(12 * k, 0.9 * k)
  s.quadraticCurveTo(1.6 * k, 2.6 * k, -1.2 * k, 7.1 * k)
  s.quadraticCurveTo(-5.4 * k, -0.2 * k, -13 * k, -0.7 * k)
  s.closePath()
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 18 })
  geo.translate(0, 0, -depth / 2)
  return geo
}

/** Who's about: the guard at the glass doors, people waiting under the wave, one on the phone by the sign. */
const CAPSUD_PEOPLE: Staff[] = [
  { p: [ENTRY.x + 2, 0, ENTRY.r + 1.2], who: 'vigile' },
  { p: [ENTRY.x - 4, 0, ENTRY.r + 2], r: 0.5, pose: 'talk' },
  { p: [ENTRY.x - 3, 0, ENTRY.r + 2.8], r: -2.6, pose: 'talk' },
  { p: [-13, 0, 3], r: 0.2, pose: 'phone' },
  { p: [DOOR.x + 2, 0, 3], r: -0.4, pose: 'idle' },
]

export function CapSud({ night }: { night: boolean }) {
  const mats = useMemo(
    () => ({
      blue: blueRibs(MALL.x1 - MALL.x0, MALL.h),
      orange: new THREE.MeshLambertMaterial({ color: '#f47b20', side: THREE.DoubleSide }),
      sign: capSudSign(night),
      board: billboardFace(),
      glass: new THREE.MeshLambertMaterial({ color: night ? '#ffe2a8' : '#8fb4cc', emissive: '#ffd590', emissiveIntensity: night ? 0.8 : 0, transparent: true, opacity: 0.88, side: THREE.DoubleSide }),
      white: new THREE.MeshLambertMaterial({ color: '#f1f3f5' }),
    }),
    [night],
  )
  const wave = useMemo(() => waveRoof(1, 14), [])
  const swoosh = useMemo(() => waveRoof(0.42, 6), [])
  // The white base band, the roof's parapet, the air-conditioning units and their fans, the lattice mast, the zebra crossing.
  const bits = useMemo<Block[]>(() => {
    const out: Block[] = []
    const w = MALL.x1 - MALL.x0
    out.push({ p: [0, 0.75, 0.06], s: [w + 0.1, 1.5, 0.14], c: '#f1f3f5' })
    out.push({ p: [0, MALL.h + 0.35, -MALL.d / 2], s: [w + 0.2, 0.7, MALL.d + 0.2], c: '#eceef0' })
    for (let i = 0; i < 18; i++) {
      const x = MALL.x0 + 6 + (i % 9) * 8.6
      const z = -7 - Math.floor(i / 9) * 13
      out.push({ p: [x, MALL.h + 1.4, z], s: [3.2, 1.4, 2.2], c: '#c5cad0' })
      out.push({ p: [x - 0.7, MALL.h + 2.12, z], s: [1.3, 0.05, 1.3], c: '#495057' }, { p: [x + 0.8, MALL.h + 2.12, z], s: [1.3, 0.05, 1.3], c: '#495057' })
    }
    // The mast: four legs drawing in, crossbars every 3 m.
    const [mx, mz, H] = [26, -MALL.d - 4, 34]
    for (const [dx, dz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ])
      out.push({ p: [mx + dx * 0.9, H / 2, mz + dz * 0.9], s: [0.18, H, 0.18], c: '#9aa3ab' })
    for (let y = 3; y < H; y += 3) {
      out.push({ p: [mx, y, mz - 0.9], s: [1.9, 0.1, 0.1], c: '#9aa3ab' }, { p: [mx, y, mz + 0.9], s: [1.9, 0.1, 0.1], c: '#9aa3ab' })
      out.push({ p: [mx - 0.9, y, mz], s: [0.1, 0.1, 1.9], c: '#9aa3ab' }, { p: [mx + 0.9, y, mz], s: [0.1, 0.1, 1.9], c: '#9aa3ab' })
    }
    out.push({ p: [mx, H + 1, mz], s: [0.12, 2, 0.12], c: '#e03131' })
    // The paved forecourt along the front.
    out.push({ p: [0, 0.02, PARK.z0 / 2], s: [MALL.x1 - MALL.x0 + 4, 0.02, PARK.z0], c: '#cfc9bc' })
    return out
  }, [])
  return (
    <group>
      <CarPark
        park={PARK}
        walkX={ENTRY.x + 1}
        front={[-14, 40]}
        arrows={[
          { p: [10, 20.5], r: 0 },
          { p: [-14, 20.5], r: Math.PI },
          { p: [24, 32.5], r: 0 },
        ]}
      />
      {/* The long blue box */}
      <mesh geometry={BOX} position={[0, MALL.h / 2, -MALL.d / 2]} scale={[MALL.x1 - MALL.x0, MALL.h, MALL.d]} material={mats.blue} castShadow receiveShadow />
      <Blocks at={bits} material={COLORED} color />
      <Blocks at={ZEBRA} material={ZEBRA_PAINT} color />
      {/* The entrance: the glass rotunda, its doors, the orange wave over it */}
      <mesh position={[ENTRY.x, ENTRY.h / 2, 0]} material={mats.glass}>
        <cylinderGeometry args={[ENTRY.r, ENTRY.r, ENTRY.h, 28, 1, true, -Math.PI / 2, Math.PI]} />
      </mesh>
      <mesh position={[ENTRY.x, ENTRY.h + 0.15, 0]} material={mats.white}>
        <cylinderGeometry args={[ENTRY.r + 0.3, ENTRY.r + 0.3, 0.3, 28, 1, false, -Math.PI / 2, Math.PI]} />
      </mesh>
      {[-1.4, 1.4].map((x) => (
        <mesh key={x} geometry={BOX} position={[ENTRY.x + x, 1.3, ENTRY.r + 0.05]} scale={[0.08, 2.6, 0.08]} material={mats.white} />
      ))}
      <mesh geometry={wave} material={mats.orange} position={[ENTRY.x, MALL.h - 0.4, 1]} castShadow />
      {/* The sign by the entrance, high on its white post */}
      <mesh geometry={BOX} position={[-11, 4, 2.4]} scale={[0.5, 8, 0.5]} material={mats.white} castShadow />
      <mesh geometry={BOX} position={[-11, 8.6, 2.4]} scale={[4.6, 4.6, 0.4]} material={mats.white} castShadow />
      <mesh position={[-11, 8.6, 2.62]} material={mats.sign}>
        <planeGeometry args={[4.2, 4.2]} />
      </mesh>
      {/* The right-end door under its smaller orange swoosh */}
      <mesh position={[DOOR.x, 2.2, 0.09]} material={mats.glass}>
        <planeGeometry args={[6, 4.4]} />
      </mesh>
      <mesh geometry={swoosh} material={mats.orange} position={[DOOR.x, 4.6, 1.2]} castShadow />
      {night && <pointLight position={[ENTRY.x, 5, ENTRY.r + 4]} intensity={35} distance={26} color="#ffe2b0" />}
      {/* The twin lamps, the palms, the billboard on its legs */}
      {[
        [-36, 20.5],
        [-8, 20.5],
        [20, 20.5],
        [-36, 32.5],
        [-8, 32.5],
        [20, 32.5],
      ].map(([x, z]) => (
        <LampPost key={`${x},${z}`} x={x} z={z} night={night} />
      ))}
      {[-40, -20, 4, 30].map((x) => (
        <Palm key={x} x={x} z={PARK.z1 - 1} h={7} />
      ))}
      <group position={[38, 0, 30]} rotation={[0, -0.35, 0]}>
        {[-2.6, 2.6].map((x) => (
          <mesh key={x} geometry={BOX} position={[x, 2.4, -0.2]} scale={[0.3, 4.8, 0.3]} material={mats.white} castShadow />
        ))}
        <mesh geometry={BOX} position={[0, 5.9, -0.25]} scale={[7.4, 3.8, 0.3]} material={mats.white} castShadow />
        <mesh position={[0, 5.9, -0.08]} material={mats.board}>
          <planeGeometry args={[7, 3.4]} />
        </mesh>
      </group>
      <Vehicle p={[-6, 0, 14.5]} r={0} kind="car" seed={5} color="#f1f3f5" />
      <Vehicle p={[12, 0, 14.5]} r={0} kind="car" seed={11} color="#212529" />
      <Vehicle p={[28, 0, 26.5]} r={Math.PI} kind="car" seed={17} color="#c92a2a" />
      {/* The motorbikes along the front */}
      {[-6, -4.8, -3.6].map((x, i) => (
        <Vehicle key={x} p={[x - 2, 0, 3.6]} r={Math.PI / 2} kind="moto" seed={30 + i} color={['#212529', '#c92a2a', '#1c4fb8'][i]} />
      ))}
      <People at={CAPSUD_PEOPLE} seed="capsud" />
      <Stroller from={[ENTRY.x + 1, 33]} to={[ENTRY.x + 1, ENTRY.r + 1]} seed="cs-a" />
      <Stroller from={[-40, 2.6]} to={[40, 2.6]} seed="cs-b" speed={1} />
      <Stroller from={[20, 30]} to={[ENTRY.x + 4, ENTRY.r + 2]} seed="cs-c" speed={1.1} bag />
    </group>
  )
}

/** What one can't walk through: the box, the glass rotunda, the sign's post, the billboard's legs. */
export const CAPSUD_SOLID: ({ x: number; z: number; r: number } | { x: number; z: number; hw: number; hd: number; rot: number; top?: number })[] = [
  { x: 0, z: -MALL.d / 2, hw: (MALL.x1 - MALL.x0) / 2 + 0.3, hd: MALL.d / 2 + 0.3, rot: 0, top: MALL.h },
  { x: ENTRY.x, z: 0, r: ENTRY.r + 0.3 },
  { x: -11, z: 2.4, r: 0.5 },
  { x: 38, z: 30, hw: 3, hd: 0.5, rot: -0.35, top: 7.8 },
]
