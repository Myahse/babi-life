import { useMemo } from 'react'
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
        for (let i = 0; i < 8; i++) b.box([-3.5 + i, -0.15, 0], [D, 0.3, 0.97], shade(color, i), { tile: 'wood', r: [0, Math.PI / 2, 0] })
      } else if (base) b.box(base, [W, 0.3, D], color, { tile })
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
  const mat = useMemo(() => (kind ? surfaceMaterial(kind, top![1], tier === 'off' ? 'simple' : tier, W, D) : null), [kind, top, tier])
  if (decor === 'ciel' || !top) return null
  const recipe = recipeOf(decor, kind ? null : [0, -0.15, 0], top[2] ?? 'plain', top[1])
  return (
    <group>
      {mat && <mesh position={[0, -0.15, 0]} geometry={SLAB} material={mat} receiveShadow />}
      <RealMesh id={`ground-${decor}`} recipe={recipe} tier={tier} />
    </group>
  )
}
const SLAB = new THREE.BoxGeometry(W, 0.3, D)
