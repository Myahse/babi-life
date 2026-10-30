import { useMemo } from 'react'
import * as THREE from 'three'
import { Vehicle } from '../vehicles'
import { BOX, Blocks } from './ruePrincesse'
import { People, Stroller, type Staff } from './hotelBits'
import { t as tr } from '../../lib/i18n'

// PlaYce Palmeraie (Cocody, Riviera Palmeraie), as the photos of the real one
// show it: a long low centre of light grey panelled boxes behind a big car
// park. On the left a small entrance under a dark angular porch, then a low
// wing with a row of brown square panels, a yellow stripe up it and the
// PLAYCE letters over its top; in the middle the main entrance, a black
// frame flaring out at the top round a glass front; on the right the tall box
// of the supermarket (the game's Babi Market) with its red name, three big
// brown squares, a blue stripe and a yellow one. In front the car park, wet
// and dark, its white lines, the row of white octagons leading the walkers in,
// the painted arrows, the tall lamp posts with two lamps each, a white tent
// for a car on show, cars parked, people at the doors. Sizes are the game's
// estimates. Frame: +z toward the street.

type Block = { p: [number, number, number]; s: [number, number, number]; ry?: number; c?: string }

/** The boxes, left to right: x from, x to, height, depth back from the front (z 0). */
const LEFT_PORCH = { x0: -48, x1: -38, h: 9, d: 20 }
const WING = { x0: -38, x1: -14, h: 8.5, d: 26 }
const HALL = { x0: -14, x1: -2, h: 12, d: 24 }
const MARKET = { x0: -2, x1: 40, h: 14, d: 32 }
const END = { x0: 40, x1: 48, h: 11, d: 26 }
const BOXES = [LEFT_PORCH, WING, HALL, MARKET, END]
/** How far the car park runs toward the street. */
const PARK = { x0: -50, x1: 50, z0: 1, z1: 36 }

const COLORED = new THREE.MeshLambertMaterial({ color: '#ffffff' })
const white = new THREE.MeshLambertMaterial({ color: '#f4f4f1' })
const black = new THREE.MeshLambertMaterial({ color: '#26282c' })
const steel = new THREE.MeshLambertMaterial({ color: '#9aa0a6' })
const asphalt = new THREE.MeshLambertMaterial({ color: '#4d5156', polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
// The rain's puddles: the sky's grey on the black, round-edged.
const puddle = new THREE.MeshLambertMaterial({ color: '#9aa3ad', transparent: true, opacity: 0.35, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
const CIRCLE = new THREE.CircleGeometry(0.5, 20)
const paint = new THREE.MeshLambertMaterial({ color: '#f4f4f4', polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })
const kerb = new THREE.MeshLambertMaterial({ color: '#c9c7c0' })
const PLANE_GEO = new THREE.PlaneGeometry(1, 1)
const OCTAGON = new THREE.CylinderGeometry(0.85, 0.85, 0.02, 8)

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

/** The cladding: big panels, their joints, one a shade lighter now and then; light grey (Palmeraie) or cream (Marcory). */
export function cladding(w: number, h: number, tone: 'grey' | 'cream' = 'grey') {
  const [c, g] = canvas(64, 64)
  const [base, light, joint] = tone === 'cream' ? ['#ddd0b6', '#e7dcc6', '#bfb095'] : ['#dcdcd8', '#e6e6e2', '#b9bab6']
  g.fillStyle = base
  g.fillRect(0, 0, 64, 64)
  g.fillStyle = light
  g.fillRect(0, 0, 32, 16)
  g.fillRect(32, 32, 32, 16)
  g.fillStyle = joint
  for (let y = 0; y < 64; y += 16) g.fillRect(0, y, 64, 1)
  for (let x = 0; x < 64; x += 32) g.fillRect(x, 0, 1, 64)
  const t = tex(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  // A panel is 3 m wide and 1.5 m high.
  t.repeat.set(w / 6, h / 6)
  return new THREE.MeshLambertMaterial({ map: t })
}

/** The supermarket's name in red on the wall, and its mark: the game's Babi Market. */
export function marketSign(night: boolean) {
  const [c, g] = canvas(512, 128)
  g.fillStyle = '#d6202a'
  g.textBaseline = 'middle'
  g.font = 'italic 800 64px sans-serif'
  g.fillText(tr('Babi'), 8, 48)
  g.font = 'italic 700 42px sans-serif'
  g.fillText('market', 150, 98)
  // Its mark: a red square, a white B, a blue corner.
  g.fillStyle = '#d6202a'
  g.fillRect(392, 14, 100, 100)
  g.fillStyle = '#1d4fa0'
  g.beginPath()
  g.moveTo(492, 64)
  g.lineTo(492, 114)
  g.lineTo(442, 114)
  g.fill()
  g.fillStyle = '#ffffff'
  g.font = '900 78px sans-serif'
  g.textAlign = 'center'
  g.fillText('B', 438, 66)
  const t = tex(c, false)
  return new THREE.MeshLambertMaterial({ map: t, transparent: true, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: night ? 0.9 : 0.15 })
}

/** The centre's letters, each its colour, on their white box, the name of the quarter under them. */
function playceSign(night: boolean) {
  const [c, g] = canvas(512, 192)
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, 512, 192)
  g.textBaseline = 'middle'
  g.textAlign = 'center'
  g.font = '900 104px sans-serif'
  const letters: [string, string][] = [['P', '#3a3a3c'], ['L', '#3a3a3c'], ['A', '#8cc63f'], ['Y', '#e6007e'], ['C', '#3a3a3c'], ['E', '#3a3a3c']]
  letters.forEach(([l, col], i) => {
    g.fillStyle = col
    g.fillText(l, 66 + i * 76, 80)
  })
  // The little strokes of colour over the Y, as on the real letters.
  for (const [x, col] of [[300, '#00a0e3'], [320, '#f39200'], [340, '#8cc63f']] as [number, string][]) {
    g.fillStyle = col
    g.fillRect(x, 14, 14, 10)
  }
  g.fillStyle = '#6b6b6b'
  g.font = '700 30px sans-serif'
  g.fillText('PALMERAIE', 256, 160)
  const t = tex(c, false)
  return new THREE.MeshLambertMaterial({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: night ? 0.7 : 0 })
}

/** A painted arrow on the ground, pointing along +x. */
const ARROW = (() => {
  const s = new THREE.Shape()
  s.moveTo(-1.6, -0.25)
  s.lineTo(0.4, -0.25)
  s.lineTo(0.4, -0.7)
  s.lineTo(1.6, 0)
  s.lineTo(0.4, 0.7)
  s.lineTo(0.4, 0.25)
  s.lineTo(-1.6, 0.25)
  s.closePath()
  return new THREE.ShapeGeometry(s)
})()

type Park = { x0: number; x1: number; z0: number; z1: number }

/**
 * A centre's car park: its asphalt (wet, a few puddles shining), the kerb on
 * the street, the bays in rows nose to nose with lanes between, the long lines
 * of the lanes, the octagons leading the walkers from the street to the door
 * (and along the front), the painted arrows.
 */
export function CarPark({ park, walkX, front, arrows, wet = false }: { park: Park; /** The walkway's x, street to door. */ walkX: number; /** The octagons along the front: from x, to x. */ front: [number, number]; arrows: { p: [number, number]; r: number }[]; wet?: boolean }) {
  const marks = useMemo(() => {
    const lines: Block[] = []
    const w = park.x1 - park.x0
    const cx = (park.x0 + park.x1) / 2
    const rows = [park.z0 + 5.5, park.z0 + 17.5, park.z0 + 29].filter((z) => z < park.z1 - 2)
    for (const z of rows) {
      for (let x = park.x0 + 2; x <= park.x1 - 2; x += 2.6) if (Math.abs(x - walkX) > 2.4) lines.push({ p: [x, 0.03, z], s: [0.12, 0.02, 5] })
      lines.push({ p: [cx, 0.03, z - 2.5], s: [w - 4, 0.02, 0.12] })
    }
    for (const z of [park.z0 + 11.5, park.z0 + 23.5].filter((z) => z < park.z1 - 2)) lines.push({ p: [cx, 0.03, z], s: [w - 6, 0.02, 0.15] })
    const octagons: [number, number][] = []
    for (let z = park.z1 - 2; z > park.z0 + 1; z -= 2.6) octagons.push([walkX, z])
    for (let x = front[0]; x < front[1]; x += 2.6) octagons.push([x, park.z0 + 2.2])
    return { lines, octagons }
  }, [park, walkX, front])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(park.x0 + park.x1) / 2, 0.02, (park.z0 + park.z1) / 2 - 0.5]} geometry={PLANE_GEO} scale={[park.x1 - park.x0, park.z1 - park.z0 + 1, 1]} material={asphalt} />
      {wet &&
        [[-20, 20, 9, 3], [6, 15, 6, 2.2], [26, 28, 10, 3.5], [-38, 26, 7, 2.5]].map(([x, z, w, d], i) => (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.025, z]} geometry={CIRCLE} scale={[w, d, 1]} material={puddle} />
        ))}
      <mesh geometry={BOX} position={[(park.x0 + park.x1) / 2, 0.1, park.z1 + 0.2]} scale={[park.x1 - park.x0, 0.2, 0.4]} material={kerb} />
      <Blocks at={marks.lines} material={paint} />
      {marks.octagons.map(([x, z], i) => (
        <mesh key={i} geometry={OCTAGON} position={[x, 0.035, z]} material={paint} />
      ))}
      {arrows.map((a, i) => (
        <mesh key={i} geometry={ARROW} rotation={[-Math.PI / 2, 0, a.r]} position={[a.p[0], 0.035, a.p[1]]} material={paint} />
      ))}
    </group>
  )
}

/** A tall lamp post with its two lamps on a cross arm. */
export function LampPost({ x, z, night }: { x: number; z: number; night: boolean }) {
  const lamp = useMemo(() => new THREE.MeshLambertMaterial({ color: '#f1f3f5', emissive: '#ffe9b0', emissiveIntensity: night ? 1.2 : 0 }), [night])
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={BOX} position={[0, 5, 0]} scale={[0.22, 10, 0.22]} material={steel} castShadow />
      <mesh geometry={BOX} position={[0, 10, 0]} scale={[2.2, 0.12, 0.12]} material={steel} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={BOX} position={[s * 1.1, 9.9, 0]} scale={[0.6, 0.18, 0.35]} material={lamp} />
      ))}
      {/* Its foot: a little white block, as the real ones stand on */}
      <mesh geometry={BOX} position={[0, 0.35, 0]} scale={[0.7, 0.7, 0.7]} material={white} />
    </group>
  )
}

/** The white tent on the car park, a car on show under it, red panels round its foot. */
function ShowTent() {
  return (
    <group position={[-34, 0, 11]}>
      <Blocks
        at={[
          ...[-3, 3].flatMap((x) => [-2, 2].map((z): Block => ({ p: [x, 1.4, z], s: [0.12, 2.8, 0.12], c: '#f8f9fa' }))),
          { p: [0, 2.85, 0], s: [6.4, 0.12, 4.4], c: '#f8f9fa' },
          { p: [0, 3.2, 0], s: [6.4, 0.5, 0.1], c: '#f8f9fa' },
          { p: [0, 0.35, 2.05], s: [6, 0.7, 0.08], c: '#c92a2a' },
          { p: [0, 0.35, -2.05], s: [6, 0.7, 0.08], c: '#c92a2a' },
          { p: [-3.05, 0.35, 0], s: [0.08, 0.7, 4], c: '#c92a2a' },
        ]}
        material={COLORED}
        color
      />
      <Vehicle p={[0, 0, 0]} r={Math.PI / 2} kind="car" seed={21} color="#c92a2a" />
    </group>
  )
}

/** Shopping trolleys in their shelter by the door. */
export function Trolleys({ x, z }: { x: number; z: number }) {
  const at = useMemo(() => {
    const out: Block[] = [{ p: [x, 2.3, z], s: [4.4, 0.1, 1.6], c: '#c9ccd1' }]
    for (const dx of [-2, 2]) out.push({ p: [x + dx, 1.15, z - 0.7], s: [0.08, 2.3, 0.08], c: '#c9ccd1' })
    for (let i = 0; i < 6; i++) out.push({ p: [x - 1.6 + i * 0.32, 0.55, z], s: [0.55, 0.5, 0.9], c: '#a9b1ba' }, { p: [x - 1.6 + i * 0.32, 0.95, z + 0.3], s: [0.55, 0.06, 0.06], c: '#d6202a' })
    return out
  }, [x, z])
  return <Blocks at={at} material={COLORED} color />
}

/** Who's about: a group at the supermarket's door, the guard, people on the walkway. */
const PLAYCE_PEOPLE: Staff[] = [
  { p: [30, 0, 3.6], r: 0.2, pose: 'talk' },
  { p: [31, 0, 4.4], r: -2.6, pose: 'talk' },
  { p: [32.2, 0, 3.8], r: -1.4, pose: 'phone' },
  { p: [33, 0, 4.8], r: 3, pose: 'idle' },
  { p: [-8.8, 0, 2.4], who: 'vigile' },
  { p: [-44, 0, 3.5], r: 0.4, pose: 'idle' },
]

export function Playce({ night }: { night: boolean }) {
  const mats = useMemo(
    () => ({
      boxes: BOXES.map((b) => cladding(b.x1 - b.x0, b.h)),
      market: marketSign(night),
      playce: playceSign(night),
      glass: new THREE.MeshLambertMaterial({ color: night ? '#ffe2a8' : '#7e9fb4', emissive: '#ffd590', emissiveIntensity: night ? 0.85 : 0 }),
    }),
    [night],
  )
  // The brown squares: a row on the wing, three big ones on the supermarket; the coloured stripes up the walls.
  const trims = useMemo<Block[]>(
    () => [
      ...[-33, -29.5, -26, -22.5, -19].map((x): Block => ({ p: [x, 6.4, 0.06], s: [2.6, 2.4, 0.1], c: '#7a4a2e' })),
      ...[24, 30, 36].map((x): Block => ({ p: [x, 9.4, 0.06], s: [4.6, 3.4, 0.1], c: '#7a4a2e' })),
      { p: [-27.8, WING.h / 2 + 1, 0.08], s: [0.9, WING.h + 2, 0.1], c: '#f2c230' },
      { p: [-12.4, 1.2, 1.2], s: [0.25, 2.4, 0.25], c: '#c92a2a' },
      { p: [20.8, MARKET.h / 2, 0.08], s: [0.8, MARKET.h - 0.4, 0.1], c: '#1f5fbf' },
      { p: [38.6, MARKET.h / 2 - 1, 0.08], s: [0.8, MARKET.h - 2.4, 0.1], c: '#f2c230' },
      // The parapets' darker caps.
      ...BOXES.map((b): Block => ({ p: [(b.x0 + b.x1) / 2, b.h + 0.15, -b.d / 2], s: [b.x1 - b.x0 + 0.1, 0.3, b.d + 0.1], c: '#c4c5c1' })),
    ],
    [],
  )
  return (
    <group>
      <CarPark park={PARK} walkX={-8} front={[-4, 34]} wet arrows={[{ p: [20, 14.3], r: 0 }, { p: [36, 26.3], r: 0 }, { p: [-24, 10.7], r: Math.PI }, { p: [12, 22.7], r: Math.PI }, { p: [44, 18.5], r: -Math.PI / 2 }]} />
      {/* The boxes of the centre, in their grey panels */}
      {BOXES.map((b, i) => (
        <mesh key={i} geometry={BOX} position={[(b.x0 + b.x1) / 2, b.h / 2, -b.d / 2]} scale={[b.x1 - b.x0, b.h, b.d]} material={mats.boxes[i]} castShadow receiveShadow />
      ))}
      <Blocks at={trims} material={COLORED} color />
      {/* The left entrance under its dark angular porch */}
      <group position={[(LEFT_PORCH.x0 + LEFT_PORCH.x1) / 2, 0, 0]}>
        <mesh geometry={BOX} position={[0, 6.6, 2.2]} scale={[8, 0.5, 4.6]} rotation={[0.12, 0, 0]} material={black} castShadow />
        {[-3.8, 3.8].map((x) => (
          <mesh key={x} geometry={BOX} position={[x, 3.3, 2.4]} scale={[0.5, 6.6, 0.6]} rotation={[0, 0, x > 0 ? -0.1 : 0.1]} material={black} />
        ))}
        <mesh position={[0, 3, 0.07]} material={mats.glass}>
          <planeGeometry args={[6.6, 5.6]} />
        </mesh>
      </group>
      {/* The main entrance: the black frame flaring out at the top, the glass front inside it */}
      <group position={[(HALL.x0 + HALL.x1) / 2, 0, 0]}>
        <mesh geometry={BOX} position={[0, HALL.h + 0.6, 2.6]} scale={[13.5, 1.2, 6]} material={black} castShadow />
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={BOX} position={[s * 5.9, HALL.h / 2 + 0.2, 2.6]} scale={[0.9, HALL.h + 1.2, 5.6]} rotation={[0, 0, -s * 0.12]} material={black} castShadow />
        ))}
        <mesh position={[0, HALL.h / 2, 0.08]} material={mats.glass}>
          <planeGeometry args={[10, HALL.h - 0.6]} />
        </mesh>
        {/* The glass' mullions, and the doors at its foot */}
        <Blocks at={[...[-3, 0, 3].map((x): Block => ({ p: [x, HALL.h / 2, 0.14], s: [0.12, HALL.h - 0.6, 0.06] })), { p: [0, 3, 0.14], s: [10, 0.15, 0.06] }, { p: [0, 7, 0.14], s: [10, 0.15, 0.06] }]} material={black} />
      </group>
      {/* The PLAYCE letters on their box over the wing, and the supermarket's name on its wall */}
      <mesh geometry={BOX} position={[-21, WING.h + 1.6, -0.6]} scale={[7.6, 3, 0.5]} material={white} castShadow />
      <mesh position={[-21, WING.h + 1.6, -0.34]} material={mats.playce}>
        <planeGeometry args={[7.4, 2.8]} />
      </mesh>
      <mesh position={[9.5, MARKET.h - 2.6, 0.12]} material={mats.market}>
        <planeGeometry args={[14, 3.5]} />
      </mesh>
      {/* The supermarket's door, glass under a canopy, on the right */}
      <mesh position={[30, 2.4, 0.08]} material={mats.glass}>
        <planeGeometry args={[8, 4.4]} />
      </mesh>
      <mesh geometry={BOX} position={[30, 4.9, 1.6]} scale={[10, 0.35, 3.2]} material={black} />
      {night && <pointLight position={[-8, 5, 6]} intensity={30} distance={22} color="#ffe2b0" />}
      {night && <pointLight position={[30, 4, 5]} intensity={20} distance={16} color="#ffe2b0" />}
      {/* The lamp posts across the car park */}
      {[[-30, 12.5], [-6, 12.5], [18, 12.5], [40, 12.5], [-30, 24.5], [-6, 24.5], [18, 24.5], [40, 24.5]].map(([x, z]) => (
        <LampPost key={`${x},${z}`} x={x} z={z} night={night} />
      ))}
      <ShowTent />
      <Trolleys x={22} z={2.6} />
      {/* The cars parked: a white pick-up and a jeep by the doors, others along the rows */}
      <Vehicle p={[-14, 0, 8.6]} r={0} kind="car" seed={3} color="#f1f3f5" />
      <Vehicle p={[-2.6, 0, 8.6]} r={0} kind="car" seed={8} color="#f8f9fa" />
      <Vehicle p={[5.2, 0, 16.4]} r={Math.PI} kind="car" seed={14} color="#343a40" />
      <Vehicle p={[28, 0, 20.6]} r={0} kind="car" seed={17} color="#adb5bd" />
      <Vehicle p={[-41, 0, 28]} r={Math.PI} kind="car" seed={19} color="#f8f9fa" />
      <Vehicle p={[-44.2, 0, 28]} r={Math.PI} kind="car" seed={23} color="#1c3a6b" />
      <People at={PLAYCE_PEOPLE} seed="playce" />
      <Stroller from={[-8, 34]} to={[-8, 4]} seed="playce-a" />
      <Stroller from={[-4, 4.4]} to={[30, 4.4]} seed="playce-b" speed={1} />
      <Stroller from={[16, 30]} to={[28, 5]} seed="playce-c" speed={1.1} />
    </group>
  )
}

/** What one can't walk through: the boxes, the porches' posts, the tent. */
export const PLAYCE_SOLID: ({ x: number; z: number; r: number } | { x: number; z: number; hw: number; hd: number; rot: number; top?: number })[] = [
  ...BOXES.map((b) => ({ x: (b.x0 + b.x1) / 2, z: -b.d / 2, hw: (b.x1 - b.x0) / 2 + 0.3, hd: b.d / 2 + 0.3, rot: 0, top: b.h })),
  { x: -34, z: 11, hw: 3.2, hd: 2.2, rot: 0, top: 3 },
  { x: 22, z: 2.6, hw: 2.3, hd: 0.9, rot: 0, top: 2.4 },
]
