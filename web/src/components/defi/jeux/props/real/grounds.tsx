import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { surfaceMaterial, type SurfaceKind } from '../../../../../world3d/batiments'
import type { MiniTier } from '../../../../../world3d/minijeux'
import type { Decor } from '../../types'
import { RealMesh, type Builder, type Q, type Recipe, type V } from './kit'

// « Mini-jeux réalistes »: the grounds and tables the actions' games are played on (Shell.tsx Ground),
// 8 × 7, top at y = 0, the play area kept clear: the big surface takes the buildings' textures
// (batiments.ts: tiles, terrazzo, parquet, wood, concrete, earth), the details round the edges (a
// table's planks and edge, the counter's front, the market cloth and basins, kerb and drain, the
// stage's boards and footlights) are one merged block from the props' atlas.

const W = 8
const D = 7

/** The big top: [surface, colour] from the buildings' kit, or an atlas tile for what it has no texture of (grass, sand, water, the track's rubber). */
const TOP: Record<Exclude<Decor, 'ciel'>, [SurfaceKind, string] | [null, string, string]> = {
  table: [null, '#c48a52', 'planks'],
  comptoir: ['terrazzo', '#e9e4da'],
  etal: [null, '#9a6a3c', 'planks'],
  etagere: ['enduit', '#e6e8ea'],
  sable: [null, '#e6cf9c', 'sand'],
  herbe: [null, '#6aa84f', 'grass'],
  carrelage: ['carrelage', '#eef0f2'],
  bitume: ['beton', '#5a5e64'],
  eau: [null, '#2b86d6', 'water'],
  scene: ['parquet', '#5a3e2c'],
  bureau: [null, '#8a5a34', 'planks'],
  parquet: ['parquet', '#c08a52'],
  terre: ['terre', '#b5703c'],
  piste: [null, '#c2410c', 'cement'],
  coffre: ['beton', '#8e949a'],
}

/** The details of each ground, round its edges (nothing in the middle where the game's things lie). */
const DETAIL: Record<Exclude<Decor, 'ciel'>, (b: Builder, q: Q) => void> = {
  table: (b, q) => {
    // The planks' joints, the table's thick edge and its apron to the front.
    b.box([0, -0.2, D / 2 + 0.05], [W, 0.36, 0.12], '#8a5a30', { tile: 'wood' })
    if (!q.lo) b.box([2.9, 0.003, -2.9], [0.9, 0.006, 0.7], '#d9c8a8', { tile: 'news', fit: true, r: [0, 0.3, 0] })
  },
  comptoir: (b, q) => {
    // The counter's red front with its steel nosing, a till receipt, a little sauce stain.
    b.box([0, -0.6, D / 2 + 0.1], [W, 0.9, 0.3], '#c92a2a', { tile: 'plastic' })
    b.box([0, -0.02, D / 2 + 0.02], [W, 0.06, 0.12], '#b8bec6', { tile: 'alu' })
    if (!q.lo) b.box([-3.2, 0.003, -3.0], [0.4, 0.006, 0.8], '#f8f9fa', { tile: 'page', fit: true, r: [0, 0.2, 0] })
  },
  etal: (b, q) => {
    // The wax cloth over the stall's boards, the plastic basins at the back corners.
    b.box([0, 0.006, 0], [7.4, 0.012, 6.4], '#ffffff', { tile: 'wax' })
    if (!q.lo)
      for (const x of [-3.4, 3.4]) {
        b.lathe([x, 0, -3.1], [[0.001, 0], [0.42, 0], [0.55, 0.24], [0.58, 0.26]], x < 0 ? '#1c7ed6' : '#e8590c', { tile: 'plastic', seg: 14 })
      }
  },
  etagere: (b) => {
    // The shelves' steel edges, their price strips.
    for (const z of [-2.2, 0, 2.2]) {
      b.box([0, 0.02, z], [W, 0.04, 0.08], '#868e96', { tile: 'metal' })
      b.box([0, 0.02, z + 0.06], [W, 0.05, 0.02], '#ffd43b', { tile: 'plastic' })
    }
  },
  sable: (b, q) => {
    const n = q.lo ? 10 : 22
    for (let i = 0; i < n; i++) b.box([-3.8 + ((i * 37) % 76) / 10, 0.01, -3.2 + ((i * 53) % 64) / 10], [0.1, 0.03, 0.08], i % 4 ? '#c9ad73' : '#f2e6d0', { tile: 'cement', r: [0, i, 0] })
  },
  herbe: (b, q) => {
    const n = q.lo ? 14 : 34
    for (let i = 0; i < n; i++) b.box([-3.8 + ((i * 37) % 76) / 10, 0.05, -3.2 + ((i * 53) % 64) / 10], [0.04, 0.1 + (i % 3) * 0.03, 0.04], i % 2 ? '#4f8a37' : '#5f9e41', { r: [0, i, 0.2] })
    if (!q.lo) for (let i = 0; i < 5; i++) b.ball([-3.6 + i * 1.8, 0.03, 3.2 - (i % 2) * 6.3], 0.05, i % 2 ? '#ffd43b' : '#ffffff', { seg: 5 })
  },
  carrelage: () => undefined,
  bitume: (b, q) => {
    // The lane's dashes, the kerb and the open drain along the back.
    for (const x of [-3, -1, 1, 3]) b.box([x, 0.003, 0], [1.2, 0.006, 0.12], '#f4f1ea', { tile: 'cement' })
    b.box([0, 0.08, -3.3], [W, 0.16, 0.4], '#c9c4ba', { tile: 'cement' })
    if (!q.lo) for (let i = 0; i < 8; i++) b.box([-3.5 + i, 0.082, -3.3], [0.5, 0.162, 0.41], i % 2 ? '#2b2b2b' : '#f2d22e', { tile: 'cement' })
  },
  eau: (b, q) => {
    const n = q.lo ? 8 : 16
    for (let i = 0; i < n; i++) b.box([-3.4 + ((i * 29) % 68) / 10, 0.01, -3 + ((i * 41) % 60) / 10], [0.7, 0.02, 0.06], '#9fd3fb', { tile: 'water' })
  },
  scene: (b, q) => {
    // The stage's edge: footlights along the front, the gold strip at the back.
    b.box([0, 0.02, -3.2], [W, 0.04, 0.4], '#ffd43b', { tile: 'metal' })
    if (!q.lo) for (let i = 0; i < 7; i++) b.on('glow').box([-3 + i, 0.05, 3.35], [0.3, 0.08, 0.12], '#fff2c4').on('solid')
  },
  bureau: (b, q) => {
    // The green leather blotter, its edging; a pen and a sheet at the corners.
    b.box([0, 0.006, 0.3], [5, 0.012, 3.4], '#2f6b4a', { tile: 'fabric' })
    b.box([0, 0.008, 0.3], [5.05, 0.008, 3.45], '#1f4a33')
    if (!q.lo) {
      b.box([3.2, 0.004, -2.7], [0.9, 0.008, 1.2], '#f8f9fa', { tile: 'page', fit: true, r: [0, -0.15, 0] })
      b.cyl([-3.3, 0.02, -2.8], 0.025, 0.7, '#1c5fb0', { seg: 6, r: [0, 0.5, Math.PI / 2] })
    }
  },
  parquet: (b) => {
    for (let i = 0; i < 8; i++) b.box([-3.5 + i + 0.49, 0.002, 0], [0.02, 0.004, D], '#7a5230')
  },
  terre: (b, q) => {
    const n = q.lo ? 8 : 18
    for (let i = 0; i < n; i++) b.box([-3.8 + ((i * 37) % 76) / 10, 0.02, -3.2 + ((i * 53) % 64) / 10], [0.14, 0.05, 0.1], i % 3 ? '#8a5a30' : '#9a8a70', { tile: 'earth', r: [0, i, 0] })
  },
  piste: (b) => {
    for (const z of [-2, 0, 2]) b.box([0, 0.004, z], [W, 0.008, 0.06], '#ffffff')
  },
  coffre: (b, q) => vault(b, q),
}

/**
 * The braquage's vault at « Banque Lagune » (an invented bank): the steel back wall, the round vault
 * door in its square frame (the bolts round its rim, the locking wheel with its spokes and grips, the
 * dial, the hinges), the safe deposit boxes floor to ceiling either side (their brass doors, keyholes
 * and numbers), the canvas money bags with the bank's print and the bundles of notes in the back
 * corners, gold bars, the alarm's beacons over the door. The middle of the floor (the notes' lanes) is kept clear.
 */
function vault(b: Builder, q: Q) {
  const zw = -3.62
  // The wall, its steel skirting.
  b.box([0, 1.7, zw - 0.15], [W + 1, 3.6, 0.3], '#6e757d', { tile: 'cement', big: true })
  b.box([0, 0.08, zw + 0.02], [W + 1, 0.16, 0.06], '#4a5057', { tile: 'metal' })
  // The door's frame, the door, its rims.
  const y = 1.45
  const fz = zw + 0.1
  b.box([0, y, fz], [3.0, 2.9, 0.16], '#59606a', { tile: 'metal' })
  b.cyl([0, y, fz + 0.04], 1.34, 0.12, '#2b3036', { tile: 'soot', seg: q.lo ? 20 : 28, r: [Math.PI / 2, 0, 0] })
  b.cyl([0, y, fz + 0.2], 1.24, 0.28, '#b4bcc4', { tile: 'alu', seg: q.lo ? 20 : 28, r: [Math.PI / 2, 0, 0] })
  b.ring([0, y, fz + 0.34], 1.2, 0.05, '#cfd5db', { tile: 'alu', seg: q.lo ? 20 : 28, r: [Math.PI / 2, 0, 0] })
  if (!q.lo) {
    b.ring([0, y, fz + 0.34], 0.86, 0.025, '#8f979f', { tile: 'alu', seg: 24, r: [Math.PI / 2, 0, 0] })
    // The bolts round the rim, the hinges on the right.
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2
      b.cyl([Math.cos(a) * 1.04, y + Math.sin(a) * 1.04, fz + 0.36], 0.045, 0.05, '#e3e7eb', { tile: 'metal', seg: 6, r: [Math.PI / 2, 0, 0] })
    }
    for (const dy of [-0.7, 0.7]) b.cyl([1.36, y + dy, fz + 0.2], 0.09, 0.42, '#7d858d', { tile: 'metal', seg: 8 })
  }
  // The wheel: its hub, six spokes, the rim and a grip at each spoke's end.
  const wz = fz + 0.48
  b.cyl([0, y, wz - 0.06], 0.17, 0.2, '#d6dbe0', { tile: 'alu', seg: 12, r: [Math.PI / 2, 0, 0] })
  for (let i = 0; i < 3; i++) b.box([0, y, wz], [1.24, 0.07, 0.07], '#c3c9cf', { tile: 'alu', r: [0, 0, (i * Math.PI) / 3 + 0.2] })
  b.ring([0, y, wz], 0.6, 0.035, '#c3c9cf', { tile: 'alu', seg: q.lo ? 14 : 20, r: [Math.PI / 2, 0, 0] })
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 + 0.2
    b.cyl([Math.cos(a) * 0.64, y + Math.sin(a) * 0.64, wz + 0.06], 0.04, 0.16, '#212529', { tile: 'plastic', seg: 6, r: [Math.PI / 2, 0, 0] })
  }
  // The combination dial, up and right of the wheel, its notches; the bank's brass plate under it.
  b.cyl([0.78, y + 0.62, fz + 0.38], 0.15, 0.08, '#2b3036', { tile: 'metal', seg: 14, r: [Math.PI / 2, 0, 0] })
  if (!q.lo) for (let i = 0; i < 12; i++) b.box([0.78 + Math.cos(i * 0.52) * 0.12, y + 0.62 + Math.sin(i * 0.52) * 0.12, fz + 0.425], [0.012, 0.012, 0.01], '#e9ecef')
  b.box([0, y - 0.95, fz + 0.345], [0.7, 0.2, 0.012], '#e0b84a', { tile: 'banque', fit: true })
  // The safe deposit boxes, both sides: rows of little doors (brass and steel), their keyholes and numbers.
  for (const sd of [-1, 1]) {
    const x0 = sd * 1.62
    const cols = 5
    const rows = 9
    const cw = 0.46
    const rh = 0.33
    const cx = x0 + (sd * cols * cw) / 2
    b.box([cx, 0.2 + (rows * rh) / 2, zw + 0.03], [cols * cw + 0.06, rows * rh + 0.06, 0.06], '#4a5057', { tile: 'metal' })
    if (q.lo) {
      // One face, its grooves.
      b.box([cx, 0.2 + (rows * rh) / 2, zw + 0.07], [cols * cw, rows * rh, 0.02], '#a7aeb6', { tile: 'alu' })
      for (let r = 1; r < rows; r++) b.box([cx, 0.2 + r * rh, zw + 0.085], [cols * cw, 0.012, 0.01], '#4a5057')
      for (let c = 1; c < cols; c++) b.box([x0 + sd * c * cw, 0.2 + (rows * rh) / 2, zw + 0.085], [0.012, rows * rh, 0.01], '#4a5057')
      continue
    }
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const x = x0 + sd * (c + 0.5) * cw
        const yy = 0.2 + (r + 0.5) * rh
        const big = r < 2
        const col = big ? '#8f969e' : (r + c) % 3 === 0 ? '#c9a24a' : '#b4bbc2'
        b.box([x, yy, zw + 0.08], [cw - 0.035, rh - 0.035, 0.04], col, { tile: 'metal' })
        b.cyl([x + sd * 0.12, yy, zw + 0.105], 0.022, 0.012, '#2b2b2b', { seg: 6, r: [Math.PI / 2, 0, 0] })
        b.box([x - sd * 0.06, yy + 0.06, zw + 0.102], [0.12, 0.04, 0.006], '#f1f3f5')
      }
  }
  // The alarm's beacons on the frame's top corners (their glass lit by AlarmLights), their bases.
  for (const sd of [-1, 1]) b.box([sd * 1.28, 2.5, fz + 0.14], [0.28, 0.08, 0.14], '#2b2b2b', { tile: 'plastic' })
  // The money bags in the back corners: canvas sacks, their tied necks, the bank's print; bundles of notes; gold bars.
  const bags: [number, number, number][] = q.lo ? [[-3.3, -2.95, 1], [3.35, -2.9, 0.9]] : [[-3.3, -2.95, 1], [-2.75, -3.05, 0.85], [-3.45, -2.4, 0.8], [3.35, -2.9, 0.9], [2.85, -3.1, 0.75]]
  for (const [x, z, k] of bags) {
    const r = 0.34 * k
    b.ball([x, r * 1.05, z], r, '#cdb88f', { tile: 'fabric', seg: q.lo ? 8 : 11, s: [1, 1.1, 0.95] })
    b.cyl([x, r * 2.2, z], r * 0.2, r * 0.4, '#bba57a', { tile: 'fabric', seg: 6, top: r * 0.12 })
    b.ring([x, r * 2.05, z], r * 0.2, r * 0.05, '#7a5a30', { seg: 8 })
    b.cone([x, r * 2.5, z], r * 0.3, r * 0.3, '#cdb88f', { tile: 'fabric', seg: 6, r: [Math.PI, 0, 0] })
    b.box([x, r * 1.1, z + r * 0.93], [r * 1.0, r * 0.62, 0.012], '#ffffff', { tile: 'banque', fit: true, r: [-0.12, 0, 0] })
  }
  if (!q.lo) {
    // Bundles of notes, banded, stacked on a steel trolley by the left boxes.
    b.box([-2.3, 0.32, -3.0], [0.9, 0.04, 0.5], '#868e96', { tile: 'metal' })
    for (const [x, z] of [[-2.65, -3.2], [-1.95, -3.2], [-2.65, -2.8], [-1.95, -2.8]]) b.box([x, 0.16, z], [0.04, 0.32, 0.04], '#495057', { tile: 'metal' })
    for (let i = 0; i < 9; i++) {
      const x = -2.55 + (i % 3) * 0.25
      const yy = 0.38 + Math.floor(i / 3) * 0.085
      b.box([x, yy, -3.0 + ((i * 7) % 3) * 0.04 - 0.04], [0.22, 0.08, 0.12], '#9cc39a', { tile: 'paper' })
      b.box([x, yy, -3.0 + ((i * 7) % 3) * 0.04 - 0.04], [0.04, 0.085, 0.125], '#f8f0e0')
    }
    // Gold bars, a little pyramid by the right bags.
    for (let i = 0; i < 6; i++) {
      const row = i < 3 ? 0 : i < 5 ? 1 : 2
      const k = row === 0 ? i : row === 1 ? i - 3 : 0
      b.box([2.55 + k * 0.2 + row * 0.1, 0.05 + row * 0.09, -2.55], [0.18, 0.09, 0.34], '#e3b23c', { tile: 'metal', bevel: 0.02 })
    }
  }
}

const tmp = new THREE.Color()
/** A colour a touch lighter or darker by plank. */
const shade = (c: string, i: number) => '#' + tmp.set(c).multiplyScalar(0.9 + ((i * 37) % 10) / 45).getHexString()

const recipes = new Map<string, Recipe>()
const recipeOf = (decor: Exclude<Decor, 'ciel'>, base: V | null, tile: string, color: string): Recipe => {
  let r = recipes.get(decor)
  if (!r) {
    r = (b, q) => {
      // Grounds the buildings' kit has no texture for: the slab itself from the atlas.
      if (base && tile === 'planks') {
        // Planks along z (their grain with them), each its own shade, thin dark gaps between.
        for (let i = 0; i < 8; i++) b.box([-3.5 + i, -0.15, 0], [D, 0.3, 0.97], shade(color, i), { tile: 'wood', r: [0, Math.PI / 2, 0], big: true })
      } else if (base) b.box(base, [W, 0.3, D], color, { tile, big: true })
      DETAIL[decor](b, q)
    }
    recipes.set(decor, r)
  }
  return r
}

/** A game's ground, realistic: the textured slab and its details. */
export function RealGround({ decor, tier }: { decor: Decor; tier: MiniTier }) {
  const top = decor === 'ciel' ? null : TOP[decor]
  const kind = top && top[0]
  // On the small phones the slab is plain colour (it fills most of the screen: no texture read there); the details round it keep theirs.
  const mat = useMemo(() => (kind ? (tier === 'simple' || tier === 'off' ? plainMat(top![1]) : surfaceMaterial(kind, top![1], tier, W, D)) : null), [kind, top, tier])
  if (decor === 'ciel' || !top) return null
  const recipe = recipeOf(decor, kind ? null : [0, -0.15, 0], top[2] ?? 'plain', top[1])
  return (
    <group>
      {mat && <mesh position={[0, -0.15, 0]} geometry={SLAB} material={mat} receiveShadow />}
      <RealMesh id={`ground-${decor}`} recipe={recipe} tier={tier} />
      {decor === 'coffre' && <AlarmLights beams={tier !== 'simple'} />}
    </group>
  )
}

const alarmGlass = new THREE.MeshBasicMaterial({ color: '#ff2a2a', toneMapped: false })
const alarmBeam = new THREE.MeshBasicMaterial({ color: '#ff3030', transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
const BEACON = new THREE.CylinderGeometry(0.11, 0.13, 0.2, 10)
// A beam: a long flat cone lying along +x from the beacon, turning.
const BEAM = new THREE.ConeGeometry(0.55, 3.2, 10, 1, true).rotateZ(Math.PI / 2).translate(1.6, 0, 0)
/** The vault's alarm: two red beacons on the door's frame, pulsing; above the small phones their beams turning across the wall (additive, no light). */
function AlarmLights({ beams }: { beams: boolean }) {
  const spin = useRef<(THREE.Object3D | null)[]>([])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    alarmGlass.color.setRGB(0.55 + 0.45 * Math.max(0, Math.sin(t * 7)), 0.08, 0.08)
    spin.current.forEach((o, i) => o && (o.rotation.y = t * 3.2 * (i ? -1 : 1) + i * 1.5))
  })
  return (
    <>
      {[-1, 1].map((sd, i) => (
        <group key={sd} position={[sd * 1.28, 2.64, -3.38]}>
          <mesh geometry={BEACON} material={alarmGlass} />
          {beams && (
            <group ref={(o) => void (spin.current[i] = o)}>
              <mesh geometry={BEAM} material={alarmBeam} renderOrder={2} />
            </group>
          )}
        </group>
      ))}
    </>
  )
}
const SLAB = new THREE.BoxGeometry(W, 0.3, D)
const plains = new Map<string, THREE.Material>()
/** A plain matte material of a colour, the textured one's mean shade (kept: a handful of grounds). */
function plainMat(color: string) {
  let m = plains.get(color)
  if (!m) plains.set(color, (m = new THREE.MeshLambertMaterial({ color: new THREE.Color(color).multiplyScalar(0.92) })))
  return m
}
