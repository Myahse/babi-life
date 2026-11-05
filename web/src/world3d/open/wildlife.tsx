import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { rng } from '../themes'

// The wild animals of the game's savannas, lakes, forests and gardens (the N'Zi's reserve, Yamoussoukro's
// sacred crocodiles, the Bouaké hotel's garden, the Taï forest's chimpanzees and pygmy hippos, the sea
// turtles of Grand-Béréby): in the game's blocks, at the zoo's scale (zoo.tsx),
// and alive: a herd grazes, lifts its heads, walks on to another patch, the legs stepping in pairs;
// the crocodiles bask on the bank, slide into the water and drift with only their backs showing.
//
// A species is a few parts (the body, the head, each leg, the tail, the ears…), each one merged
// boxes coloured per vertex. A herd draws each part once for all its animals (an instanced mesh), so
// twelve elephants cost what one costs: a part's draw call. Every frame, each animal's brain moves it
// (no allocation: the matrices are reused) and its parts are posed from its gait and its grazing;
// far from the camera the herd is only moved now and then.

/** A block of a part: its middle, its size, its colour, a turn (radians, about x, y, z). */
type Blk = [number, number, number, number, number, number, string, number?, number?, number?]
/** What a part does when the animal moves. */
export type Role = 'body' | 'head' | 'legFL' | 'legFR' | 'legBL' | 'legBR' | 'tail' | 'tailYaw' | 'earL' | 'earR' | 'trunk' | 'jaw' | 'wingL' | 'wingR' | 'fan' | 'armR'
type PartDef = { role: Role; pivot: [number, number, number]; blocks: Blk[] }
export type Species = {
  id: string
  parts: PartDef[]
  /** Walking and running speeds (m/s), and the metres of one step cycle. */
  walk: number
  run: number
  stride: number
  /** How far a leg swings (radians) and how far the head goes down to graze. */
  swing: number
  dip: number
  /** How far it keeps from the next one of its herd (metres). */
  space: number
}

const geoCache = new Map<string, THREE.BufferGeometry>()
const COLOR = new THREE.Color()
const BOX1 = new THREE.BoxGeometry(1, 1, 1)
/** A part's boxes, merged, coloured per vertex (in the part's frame: the pivot at the origin). */
function partGeometry(key: string, blocks: Blk[]) {
  const had = geoCache.get(key)
  if (had) return had
  const m = new THREE.Matrix4()
  const e = new THREE.Euler()
  const q = new THREE.Quaternion()
  const list = blocks.map(([x, y, z, sx, sy, sz, c, rx = 0, ry = 0, rz = 0]) => {
    const g = BOX1.clone()
    g.applyMatrix4(m.compose(new THREE.Vector3(x, y, z), q.setFromEuler(e.set(rx, ry, rz)), new THREE.Vector3(sx, sy, sz)))
    COLOR.set(c)
    const n = g.attributes.position.count
    const col = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) col.set([COLOR.r, COLOR.g, COLOR.b], i * 3)
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    g.deleteAttribute('uv')
    return g
  })
  const merged = mergeGeometries(list, false)!
  geoCache.set(key, merged)
  return merged
}

/** One material for every animal: the colours are in the boxes. */
export const ANIMAL_MAT = new THREE.MeshLambertMaterial({ vertexColors: true })

/* ---------- The species (facing +x, the ground at y 0) ---------- */

const leg = (role: Role, x: number, z: number, top: number, w: number, c: string, hoof = '#2a2522'): PartDef => ({
  role,
  pivot: [x, top, z],
  blocks: [
    [0, -top / 2, 0, w, top, w, c],
    [0, -top + 0.06, 0, w * 1.08, 0.12, w * 1.08, hoof],
  ],
})
const legs4 = (fx: number, bx: number, z: number, top: number, w: number, c: string, hoof?: string): PartDef[] => [leg('legFL', fx, z, top, w, c, hoof), leg('legFR', fx, -z, top, w, c, hoof), leg('legBL', bx, z, top, w, c, hoof), leg('legBR', bx, -z, top, w, c, hoof)]

const GREY = '#8b8682'
export const ELEPHANT: Species = {
  id: 'elephant',
  walk: 1.1,
  run: 2.6,
  stride: 3.2,
  swing: 0.32,
  dip: 0.25,
  space: 6,
  parts: [
    { role: 'body', pivot: [0, 0, 0], blocks: [[0, 3.0, 0, 4.6, 2.8, 2.7, GREY], [0, 4.5, 0, 3.6, 0.4, 2.2, GREY], [-2.35, 3.2, 0, 0.3, 2.0, 2.2, '#837d79']] },
    ...legs4(1.5, -1.5, 0.85, 1.75, 0.95, GREY, '#d8d2c4'),
    {
      role: 'head',
      pivot: [2.3, 3.6, 0],
      blocks: [
        [0.45, -0.05, 0, 1.5, 1.8, 1.7, GREY],
        [1.22, 0.1, 0.5, 0.05, 0.16, 0.16, '#1d1b1a'],
        [1.22, 0.1, -0.5, 0.05, 0.16, 0.16, '#1d1b1a'],
        [1.3, -0.85, 0.45, 0.7, 0.16, 0.16, '#f2ead8', 0, 0, 0.3],
        [1.3, -0.85, -0.45, 0.7, 0.16, 0.16, '#f2ead8', 0, 0, 0.3],
      ],
    },
    { role: 'trunk', pivot: [3.45, 3.1, 0], blocks: [[0.12, -0.5, 0, 0.55, 1.1, 0.55, GREY], [0.22, -1.45, 0, 0.45, 0.95, 0.45, GREY], [0.36, -2.15, 0, 0.36, 0.6, 0.36, GREY]] },
    { role: 'earL', pivot: [2.4, 3.7, 0.85], blocks: [[-0.3, 0, 0.75, 0.22, 2.0, 1.5, '#857e7a']] },
    { role: 'earR', pivot: [2.4, 3.7, -0.85], blocks: [[-0.3, 0, -0.75, 0.22, 2.0, 1.5, '#857e7a']] },
    { role: 'tail', pivot: [-2.3, 3.6, 0], blocks: [[-0.05, -0.6, 0, 0.12, 1.2, 0.12, GREY], [-0.05, -1.25, 0, 0.2, 0.25, 0.2, '#3a3634']] },
  ],
}

const BUFF = '#2f2a27'
/** The savanna buffalo: dark, heavy, the horns joined in a boss over the brow. */
export const BUFFALO: Species = {
  id: 'buffalo',
  walk: 1.2,
  run: 4,
  stride: 2.2,
  swing: 0.38,
  dip: 0.55,
  space: 3,
  parts: [
    { role: 'body', pivot: [0, 0, 0], blocks: [[0, 1.55, 0, 2.6, 1.15, 1.15, BUFF], [0.55, 1.95, 0, 1.2, 0.6, 1.1, '#2a2522'], [-1.0, 1.45, 0, 0.8, 0.95, 1.0, '#332d2a']] },
    ...legs4(0.85, -0.95, 0.38, 1.05, 0.26, BUFF, '#141210'),
    {
      role: 'head',
      pivot: [1.25, 1.8, 0],
      blocks: [
        [0.5, -0.25, 0, 0.75, 0.7, 0.62, BUFF],
        [0.92, -0.42, 0, 0.22, 0.4, 0.46, '#1a1716'],
        [0.38, 0.18, 0, 0.32, 0.18, 0.95, '#4b4540'],
        [0.38, 0.12, 0.62, 0.22, 0.14, 0.4, '#4b4540', 0, 0, 0.5],
        [0.38, 0.12, -0.62, 0.22, 0.14, 0.4, '#4b4540', 0, 0, 0.5],
        [0.5, 0.3, 0.78, 0.14, 0.32, 0.14, '#4b4540'],
        [0.5, 0.3, -0.78, 0.14, 0.32, 0.14, '#4b4540'],
        [0.7, -0.08, 0.32, 0.06, 0.08, 0.08, '#0c0b0a'],
        [0.7, -0.08, -0.32, 0.06, 0.08, 0.08, '#0c0b0a'],
        [0.25, 0.0, 0.42, 0.18, 0.2, 0.3, BUFF],
        [0.25, 0.0, -0.42, 0.18, 0.2, 0.3, BUFF],
      ],
    },
    { role: 'tail', pivot: [-1.32, 1.95, 0], blocks: [[-0.04, -0.5, 0, 0.08, 1.0, 0.08, BUFF], [-0.04, -1.05, 0, 0.14, 0.22, 0.14, '#141210']] },
  ],
}

const KOB = '#b8763c'
/** The kob, the savanna's antelope: russet, a white throat and belly, the buck's horns in a lyre. */
export const KOB_SPECIES: Species = {
  id: 'kob',
  walk: 1.3,
  run: 7,
  stride: 1.6,
  swing: 0.45,
  dip: 0.95,
  space: 2.2,
  parts: [
    { role: 'body', pivot: [0, 0, 0], blocks: [[0, 1.3, 0, 1.6, 0.62, 0.5, KOB], [0, 1.02, 0, 1.3, 0.1, 0.46, '#f1e6d2'], [-0.82, 1.42, 0, 0.12, 0.3, 0.3, '#f1e6d2']] },
    ...legs4(0.6, -0.6, 0.17, 1.0, 0.12, '#a4652f', '#1d1a18'),
    {
      role: 'head',
      pivot: [0.7, 1.5, 0],
      blocks: [
        [0.18, 0.32, 0, 0.24, 0.75, 0.24, KOB, 0, 0, -0.35],
        [0.5, 0.72, 0, 0.5, 0.28, 0.26, KOB],
        [0.72, 0.66, 0, 0.14, 0.18, 0.2, '#2a221c'],
        [0.12, 0.2, 0, 0.26, 0.3, 0.26, '#f1e6d2', 0, 0, -0.35],
        [0.38, 0.92, 0.1, 0.06, 0.4, 0.06, '#3a2f26', 0, 0, -0.25],
        [0.38, 0.92, -0.1, 0.06, 0.4, 0.06, '#3a2f26', 0, 0, -0.25],
        [0.32, 1.18, 0.14, 0.05, 0.22, 0.05, '#3a2f26', 0.3, 0, 0.2],
        [0.32, 1.18, -0.14, 0.05, 0.22, 0.05, '#3a2f26', -0.3, 0, 0.2],
        [0.3, 0.82, 0.18, 0.08, 0.16, 0.14, KOB],
        [0.3, 0.82, -0.18, 0.08, 0.16, 0.14, KOB],
      ],
    },
    { role: 'tail', pivot: [-0.8, 1.5, 0], blocks: [[-0.05, -0.18, 0, 0.08, 0.36, 0.1, '#2a221c']] },
  ],
}

const MONK = '#7a7351'
/** The green monkey (vervet), on all fours, the long tail up in a curve. */
export const MONKEY: Species = {
  id: 'monkey',
  walk: 1.1,
  run: 3.2,
  stride: 0.7,
  swing: 0.6,
  dip: 0.4,
  space: 1.2,
  parts: [
    { role: 'body', pivot: [0, 0, 0], blocks: [[0, 0.62, 0, 0.7, 0.36, 0.32, MONK], [0, 0.5, 0, 0.5, 0.06, 0.28, '#d9d2bf']] },
    ...legs4(0.28, -0.28, 0.12, 0.48, 0.1, MONK, '#2b2723'),
    { role: 'head', pivot: [0.35, 0.72, 0], blocks: [[0.14, 0.06, 0, 0.3, 0.28, 0.28, MONK], [0.29, 0.03, 0, 0.04, 0.18, 0.18, '#26211d'], [0.08, 0.04, 0.17, 0.08, 0.12, 0.06, '#e8e1cf'], [0.08, 0.04, -0.17, 0.08, 0.12, 0.06, '#e8e1cf']] },
    { role: 'tail', pivot: [-0.35, 0.68, 0], blocks: [[-0.25, 0.12, 0, 0.5, 0.06, 0.06, MONK, 0, 0, 0.5], [-0.55, 0.42, 0, 0.06, 0.45, 0.06, MONK]] },
  ],
}

const CROC = '#4e5a35'
/** The crocodile: long and flat, the jaw that opens, the tail that sweeps side to side. */
export const CROCODILE: Species = {
  id: 'croc',
  walk: 0.7,
  run: 2.4,
  stride: 0.9,
  swing: 0.5,
  dip: 0,
  space: 3,
  parts: [
    {
      role: 'body',
      pivot: [0, 0, 0],
      blocks: [
        [0, 0.32, 0, 2.6, 0.48, 0.95, CROC],
        [-0.7, 0.6, 0, 0.3, 0.12, 0.5, '#3d4728'],
        [-0.2, 0.6, 0, 0.3, 0.12, 0.5, '#3d4728'],
        [0.3, 0.6, 0, 0.3, 0.12, 0.5, '#3d4728'],
        [0.8, 0.6, 0, 0.3, 0.12, 0.5, '#3d4728'],
        [0, 0.1, 0, 2.3, 0.06, 0.85, '#b9b48a'],
      ],
    },
    { role: 'legFL', pivot: [0.9, 0.3, 0.45], blocks: [[0, -0.12, 0.2, 0.3, 0.28, 0.45, CROC]] },
    { role: 'legFR', pivot: [0.9, 0.3, -0.45], blocks: [[0, -0.12, -0.2, 0.3, 0.28, 0.45, CROC]] },
    { role: 'legBL', pivot: [-0.9, 0.3, 0.45], blocks: [[0, -0.12, 0.22, 0.36, 0.3, 0.5, CROC]] },
    { role: 'legBR', pivot: [-0.9, 0.3, -0.45], blocks: [[0, -0.12, -0.22, 0.36, 0.3, 0.5, CROC]] },
    { role: 'head', pivot: [1.3, 0.36, 0], blocks: [[0.25, 0, 0, 0.6, 0.42, 0.75, CROC], [0.3, 0.26, 0.25, 0.18, 0.14, 0.16, '#c9b33a'], [0.3, 0.26, -0.25, 0.18, 0.14, 0.16, '#c9b33a'], [1.0, 0.04, 0, 1.0, 0.18, 0.5, CROC], [1.0, -0.06, 0.22, 0.9, 0.06, 0.04, '#f2ead8'], [1.0, -0.06, -0.22, 0.9, 0.06, 0.04, '#f2ead8']] },
    { role: 'jaw', pivot: [1.5, 0.26, 0], blocks: [[0.5, -0.04, 0, 1.0, 0.14, 0.48, '#6b744a'], [0.5, 0.05, 0, 0.9, 0.04, 0.4, '#d9a39a']] },
    { role: 'tailYaw', pivot: [-1.3, 0.3, 0], blocks: [[-0.6, 0, 0, 1.2, 0.38, 0.7, CROC], [-1.6, -0.04, 0, 1.0, 0.28, 0.45, CROC], [-2.4, -0.08, 0, 0.8, 0.18, 0.25, CROC], [-1.0, 0.24, 0, 1.6, 0.1, 0.2, '#3d4728']] },
  ],
}

const HIPPO_C = '#7c6870'
/** The hippo: low in the river, now and then the big yawn. */
export const HIPPO: Species = {
  id: 'hippo',
  walk: 0.6,
  run: 2,
  stride: 1.4,
  swing: 0.3,
  dip: 0.1,
  space: 3.5,
  parts: [
    { role: 'body', pivot: [0, 0, 0], blocks: [[0, 1.1, 0, 3.4, 1.7, 2.1, HIPPO_C], [0, 0.35, 0, 3.0, 0.2, 1.8, '#9a858c']] },
    ...legs4(1.1, -1.1, 0.65, 0.55, 0.6, HIPPO_C),
    { role: 'head', pivot: [1.6, 1.3, 0], blocks: [[0.5, 0.15, 0, 1.1, 0.8, 1.5, HIPPO_C], [0.25, 0.65, 0.45, 0.25, 0.25, 0.25, HIPPO_C], [0.25, 0.65, -0.45, 0.25, 0.25, 0.25, HIPPO_C], [0.45, 0.62, 0.48, 0.12, 0.12, 0.1, '#1d1b1a'], [0.45, 0.62, -0.48, 0.12, 0.12, 0.1, '#1d1b1a'], [1.2, 0.2, 0, 0.6, 0.6, 1.6, '#8c7880']] },
    { role: 'jaw', pivot: [1.8, 1.05, 0], blocks: [[0.75, -0.08, 0, 1.5, 0.3, 1.5, HIPPO_C], [0.75, 0.09, 0, 1.4, 0.06, 1.3, '#d8828c'], [1.35, 0.25, 0.5, 0.12, 0.35, 0.12, '#f2ead8'], [1.35, 0.25, -0.5, 0.12, 0.35, 0.12, '#f2ead8']] },
    { role: 'tail', pivot: [-1.7, 1.4, 0], blocks: [[-0.05, -0.25, 0, 0.1, 0.5, 0.1, HIPPO_C]] },
  ],
}

/** The ostrich of the hotel's garden: the black plumage, the long pink neck and legs. */
export const OSTRICH: Species = {
  id: 'ostrich',
  walk: 1.2,
  run: 6,
  stride: 1.8,
  swing: 0.55,
  dip: 1.1,
  space: 1.8,
  parts: [
    { role: 'body', pivot: [0, 0, 0], blocks: [[0, 1.55, 0, 1.1, 0.7, 0.8, '#1d1b1a'], [-0.6, 1.65, 0, 0.35, 0.45, 0.6, '#f3efe6'], [0, 1.2, 0, 0.6, 0.2, 0.5, '#e7c9b6']] },
    leg('legFL', 0.1, 0.2, 1.25, 0.12, '#e5b9a4', '#e5b9a4'),
    leg('legFR', 0.1, -0.2, 1.25, 0.12, '#e5b9a4', '#e5b9a4'),
    { role: 'head', pivot: [0.5, 1.75, 0], blocks: [[0.12, 0.6, 0, 0.12, 1.25, 0.12, '#e7c9b6'], [0.25, 1.25, 0, 0.32, 0.2, 0.2, '#e7c9b6'], [0.44, 1.22, 0, 0.18, 0.06, 0.1, '#d6a58e'], [0.28, 1.3, 0.1, 0.05, 0.06, 0.03, '#1d1b1a'], [0.28, 1.3, -0.1, 0.05, 0.06, 0.03, '#1d1b1a']] },
  ],
}

/** The crowned crane (the grey crowned crane of the garden): grey, the white cheek, the golden crown. */
export const CRANE: Species = {
  id: 'crane',
  walk: 0.7,
  run: 2,
  stride: 0.9,
  swing: 0.5,
  dip: 0.8,
  space: 1.2,
  parts: [
    { role: 'body', pivot: [0, 0, 0], blocks: [[0, 1.05, 0, 0.75, 0.42, 0.42, '#7d8288'], [-0.35, 1.05, 0, 0.4, 0.3, 0.44, '#efefe9'], [-0.5, 0.95, 0, 0.3, 0.2, 0.3, '#4b2b18']] },
    leg('legFL', 0.05, 0.1, 0.85, 0.06, '#2a2a2a', '#2a2a2a'),
    leg('legFR', 0.05, -0.1, 0.85, 0.06, '#2a2a2a', '#2a2a2a'),
    { role: 'head', pivot: [0.35, 1.2, 0], blocks: [[0.06, 0.3, 0, 0.08, 0.6, 0.08, '#7d8288'], [0.12, 0.65, 0, 0.2, 0.16, 0.14, '#1d1b1a'], [0.08, 0.64, 0.08, 0.1, 0.1, 0.02, '#f6f3ea'], [0.08, 0.64, -0.08, 0.1, 0.1, 0.02, '#f6f3ea'], [0.08, 0.64, 0, 0.06, 0.06, 0.18, '#c8332e'], [0.26, 0.6, 0, 0.14, 0.04, 0.05, '#2a2a2a'], [0.04, 0.84, 0, 0.22, 0.2, 0.22, '#e3b84a']] },
  ],
}

/** The peacock walking the lawn, its train shut. */
export const PEACOCK: Species = {
  id: 'peacock',
  walk: 0.6,
  run: 2,
  stride: 0.6,
  swing: 0.6,
  dip: 0.4,
  space: 1,
  parts: [
    { role: 'body', pivot: [0, 0, 0], blocks: [[0, 0.85, 0, 0.6, 0.45, 0.4, '#1f4fa8'], [-0.85, 0.72, 0, 1.3, 0.12, 0.35, '#2e8b57', 0, 0, 0.12], [-1.2, 0.66, 0, 0.6, 0.04, 0.38, '#1b2f7a', 0, 0, 0.12]] },
    leg('legFL', -0.1, 0.1, 0.62, 0.06, '#8a7a6a', '#8a7a6a'),
    leg('legFR', -0.1, -0.1, 0.62, 0.06, '#8a7a6a', '#8a7a6a'),
    { role: 'head', pivot: [0.28, 0.95, 0], blocks: [[0, 0.25, 0, 0.14, 0.6, 0.14, '#1f5fc8'], [0.04, 0.58, 0, 0.2, 0.16, 0.14, '#1f5fc8'], [0.18, 0.56, 0, 0.1, 0.05, 0.05, '#cbb79a'], [0.04, 0.74, 0, 0.03, 0.16, 0.03, '#1f5fc8'], [0.04, 0.83, 0, 0.08, 0.05, 0.08, '#2a7fd8']] },
  ],
}

/** The tortoise of the garden: its shell, the head out and in. */
export const TORTOISE: Species = {
  id: 'tortoise',
  walk: 0.12,
  run: 0.2,
  stride: 0.35,
  swing: 0.4,
  dip: 0.2,
  space: 1,
  parts: [
    { role: 'body', pivot: [0, 0, 0], blocks: [[0, 0.32, 0, 0.9, 0.38, 0.7, '#6d5a32'], [0, 0.52, 0, 0.6, 0.12, 0.5, '#7f6a3c'], [0, 0.14, 0, 0.92, 0.08, 0.72, '#4b3f25']] },
    ...legs4(0.32, -0.32, 0.3, 0.2, 0.16, '#8b8467', '#8b8467'),
    { role: 'head', pivot: [0.45, 0.25, 0], blocks: [[0.12, 0.02, 0, 0.26, 0.18, 0.18, '#8b8467'], [0.22, 0.06, 0.08, 0.03, 0.04, 0.03, '#1d1b1a'], [0.22, 0.06, -0.08, 0.03, 0.04, 0.03, '#1d1b1a']] },
  ],
}

const CHIMP_C = '#2b2420'
/**
 * The chimpanzee of the Taï forest: on its knuckles, the long arms in front, the pale face. Those of Taï
 * crack the panda and coula nuts with stones on a root (the anvil): sat at it, the right arm raised with the
 * stone and brought down, the head bent over.
 */
export const CHIMP: Species = {
  id: 'chimp',
  walk: 0.9,
  run: 3.4,
  stride: 1.1,
  swing: 0.55,
  dip: 0.5,
  space: 1.4,
  parts: [
    { role: 'body', pivot: [0, 0, 0], blocks: [[0, 0.82, 0, 0.72, 0.62, 0.55, CHIMP_C, 0, 0, 0.45], [0.05, 0.62, 0, 0.42, 0.18, 0.5, CHIMP_C]] },
    leg('legFL', 0.32, 0.26, 0.95, 0.15, CHIMP_C, '#3a2e27'),
    { role: 'armR', pivot: [0.32, 0.95, -0.26], blocks: [[0, -0.47, 0, 0.15, 0.95, 0.15, CHIMP_C], [0, -0.92, 0, 0.18, 0.1, 0.18, '#3a2e27'], [0.02, -1.0, 0, 0.16, 0.12, 0.16, '#8c8478']] },
    leg('legBL', -0.28, 0.17, 0.55, 0.16, CHIMP_C, '#3a2e27'),
    leg('legBR', -0.28, -0.17, 0.55, 0.16, CHIMP_C, '#3a2e27'),
    {
      role: 'head',
      pivot: [0.38, 1.2, 0],
      blocks: [
        [0.12, 0.06, 0, 0.34, 0.34, 0.34, CHIMP_C],
        [0.28, 0.0, 0, 0.08, 0.22, 0.24, '#c9a88a'],
        [0.33, -0.08, 0, 0.08, 0.1, 0.2, '#b8957a'],
        [0.31, 0.06, 0.07, 0.03, 0.04, 0.04, '#140f0c'],
        [0.31, 0.06, -0.07, 0.03, 0.04, 0.04, '#140f0c'],
        [0.1, 0.06, 0.19, 0.06, 0.12, 0.06, '#c9a88a'],
        [0.1, 0.06, -0.19, 0.06, 0.12, 0.06, '#c9a88a'],
      ],
    },
  ],
}

/** The pygmy hippo of the forest streams: small, dark, shiny, the round back; it wades and browses on the bank. */
export const PYGMY_HIPPO: Species = {
  id: 'pygmy-hippo',
  walk: 0.6,
  run: 2.2,
  stride: 0.9,
  swing: 0.35,
  dip: 0.35,
  space: 2,
  parts: [
    { role: 'body', pivot: [0, 0, 0], blocks: [[0, 0.55, 0, 1.4, 0.62, 0.7, '#3c3437'], [0, 0.88, 0, 1.1, 0.12, 0.55, '#463d41'], [0, 0.26, 0, 1.2, 0.08, 0.6, '#6b5d62']] },
    ...legs4(0.45, -0.45, 0.24, 0.32, 0.2, '#3c3437', '#2a2426'),
    { role: 'head', pivot: [0.68, 0.66, 0], blocks: [[0.2, 0, 0, 0.42, 0.38, 0.5, '#3c3437'], [0.44, -0.06, 0, 0.16, 0.26, 0.48, '#57494e'], [0.14, 0.22, 0.17, 0.08, 0.08, 0.06, '#3c3437'], [0.14, 0.22, -0.17, 0.08, 0.08, 0.06, '#3c3437'], [0.32, 0.12, 0.2, 0.04, 0.05, 0.04, '#140f0c'], [0.32, 0.12, -0.2, 0.04, 0.05, 0.04, '#140f0c']] },
    { role: 'tail', pivot: [-0.7, 0.66, 0], blocks: [[-0.03, -0.12, 0, 0.05, 0.24, 0.05, '#3c3437']] },
  ],
}

/** The forest duiker (Ogilby's, of Taï): small, red-brown, the dark stripe down the back, the short horns. */
export const DUIKER: Species = {
  id: 'duiker',
  walk: 0.9,
  run: 6,
  stride: 1,
  swing: 0.5,
  dip: 0.7,
  space: 1.5,
  parts: [
    { role: 'body', pivot: [0, 0, 0], blocks: [[0, 0.62, 0, 0.85, 0.34, 0.3, '#9a4a28'], [0, 0.8, 0, 0.8, 0.04, 0.08, '#3a2016']] },
    ...legs4(0.3, -0.3, 0.1, 0.48, 0.07, '#7a3a20', '#1d1210'),
    { role: 'head', pivot: [0.42, 0.72, 0], blocks: [[0.12, 0.1, 0, 0.12, 0.3, 0.12, '#9a4a28', 0, 0, -0.4], [0.26, 0.28, 0, 0.26, 0.14, 0.14, '#9a4a28'], [0.4, 0.26, 0, 0.06, 0.08, 0.1, '#1d1210'], [0.18, 0.4, 0.05, 0.03, 0.12, 0.03, '#2a1a12'], [0.18, 0.4, -0.05, 0.03, 0.12, 0.03, '#2a1a12']] },
    { role: 'tail', pivot: [-0.43, 0.7, 0], blocks: [[-0.03, -0.08, 0, 0.05, 0.16, 0.06, '#3a2016']] },
  ],
}

/** The sea turtle (the green and the leatherback come up the beaches of Grand-Béréby): the shell, the flippers. */
export const SEA_TURTLE: Species = {
  id: 'sea-turtle',
  walk: 0.15,
  run: 0.3,
  stride: 0.5,
  swing: 0.6,
  dip: 0.15,
  space: 2,
  parts: [
    { role: 'body', pivot: [0, 0, 0], blocks: [[0, 0.28, 0, 1.3, 0.34, 1.0, '#4a5236'], [0, 0.46, 0, 0.9, 0.1, 0.7, '#5c6540'], [0, 0.1, 0, 1.2, 0.06, 0.9, '#c9c09a']] },
    { role: 'legFL', pivot: [0.4, 0.2, 0.45], blocks: [[0, 0, 0.35, 0.3, 0.06, 0.7, '#5e6a4c', 0, -0.3, 0]] },
    { role: 'legFR', pivot: [0.4, 0.2, -0.45], blocks: [[0, 0, -0.35, 0.3, 0.06, 0.7, '#5e6a4c', 0, 0.3, 0]] },
    { role: 'legBL', pivot: [-0.5, 0.18, 0.35], blocks: [[-0.1, 0, 0.15, 0.3, 0.05, 0.3, '#5e6a4c']] },
    { role: 'legBR', pivot: [-0.5, 0.18, -0.35], blocks: [[-0.1, 0, -0.15, 0.3, 0.05, 0.3, '#5e6a4c']] },
    { role: 'head', pivot: [0.7, 0.26, 0], blocks: [[0.14, 0, 0, 0.3, 0.2, 0.24, '#6b7656'], [0.22, 0.05, 0.1, 0.04, 0.04, 0.03, '#140f0c'], [0.22, 0.05, -0.1, 0.04, 0.04, 0.03, '#140f0c']] },
  ],
}

/* ---------- The herd ---------- */

/** One animal: where it is, which way it heads (radians from +x toward +z), how it moves. */
export type Animal = {
  x: number
  z: number
  y: number
  h: number
  /** 0 standing, 1 walking, 2 running (eased). */
  gait: number
  /** 0 head up, 1 grazing (eased). */
  graze: number
  /** The step cycle (radians). */
  phase: number
  /** The jaw open (0..1): the crocodile's, the hippo's yawn. */
  jaw: number
  /** What it's doing, how long more (s), where it's going. */
  mode: string
  t: number
  tx: number
  tz: number
  scale: number
  seed: number
  /** Its spot round the herd's middle. */
  ox: number
  oz: number
}

/** A brain: moves one animal for a frame (its mode, where it heads, its gait and grazing). */
export type Brain = (a: Animal, dt: number, time: number, sp: Species) => void

const turnToward = (from: number, to: number, k: number) => {
  const d = Math.atan2(Math.sin(to - from), Math.cos(to - from))
  return from + d * Math.min(1, k)
}
const ease = (v: number, to: number, k: number) => v + (to - v) * Math.min(1, k)

/**
 * The herd's way of life: grazing a while, head down, a step now and then; looking up; walking on
 * to a new patch near the herd's middle (`centre`, which may move: the herd drifting across the
 * savanna). `inside` keeps the patches where they can go.
 */
export function grazer(centre: { x: number; z: number }, roam: number, inside: (x: number, z: number) => boolean = () => true): Brain {
  return (a, dt, _time, sp) => {
    a.t -= dt
    const r = (a.seed = (a.seed * 16807) % 2147483647) / 2147483647
    if (a.mode === 'walk' || a.mode === 'run') {
      const dx = a.tx - a.x
      const dz = a.tz - a.z
      const d = Math.hypot(dx, dz)
      a.h = turnToward(a.h, Math.atan2(dz, dx), dt * 1.6)
      const want = a.mode === 'run' ? 2 : 1
      a.gait = ease(a.gait, d < 1.2 ? 0 : want, dt * 1.5)
      a.graze = ease(a.graze, 0, dt * 2)
      const v = (a.gait > 1 ? sp.walk + (sp.run - sp.walk) * (a.gait - 1) : sp.walk * a.gait) * dt
      // Only straight on once it faces its way (no walking sideways).
      const facing = Math.cos(Math.atan2(dz, dx) - a.h)
      if (facing > 0.3) {
        a.x += Math.cos(a.h) * v
        a.z += Math.sin(a.h) * v
      }
      if (d < 1.2 || a.t < 0) {
        a.mode = 'graze'
        a.t = 4 + r * 10
      }
      return
    }
    a.gait = ease(a.gait, 0, dt * 2)
    a.graze = ease(a.graze, a.mode === 'graze' ? 1 : 0, dt * 1.2)
    if (a.t > 0) return
    if (r < 0.55) {
      // On to a new patch, by its spot round the herd's middle (which may have moved).
      for (let k = 0; k < 6; k++) {
        const ang = ((a.seed % 1000) / 1000) * Math.PI * 2 + k
        const rr = roam * (0.2 + ((a.seed >> 4) % 100) / 125)
        const tx = centre.x + a.ox + Math.cos(ang) * rr
        const tz = centre.z + a.oz + Math.sin(ang) * rr
        if (inside(tx, tz)) {
          a.tx = tx
          a.tz = tz
          break
        }
      }
      a.mode = 'walk'
      a.t = 30
    } else if (r < 0.8) {
      a.mode = 'look'
      a.t = 2 + r * 4
    } else {
      a.mode = 'graze'
      a.t = 5 + r * 8
    }
  }
}

/** Starts a herd: n animals round a middle, each its spot, turned every which way. */
export function makeHerd(seedName: string, n: number, at: [number, number], spread: number, size: [number, number] = [0.85, 1.1], y = 0): Animal[] {
  const r = rng(seedName)
  return [...Array(n)].map(() => {
    const ox = (r() - 0.5) * spread * 2
    const oz = (r() - 0.5) * spread * 2
    return { x: at[0] + ox, z: at[1] + oz, y, h: r() * Math.PI * 2, gait: 0, graze: r(), phase: r() * 6, jaw: 0, mode: 'graze', t: r() * 6, tx: at[0], tz: at[1], scale: size[0] + r() * (size[1] - size[0]), seed: Math.floor(r() * 2e9) + 1, ox, oz }
  })
}

const M = new THREE.Matrix4()
const P = new THREE.Matrix4()
const V = new THREE.Vector3()
const S = new THREE.Vector3()
const Q = new THREE.Quaternion()
const E = new THREE.Euler()
const UP = new THREE.Vector3(0, 1, 0)
const CAM = new THREE.Vector3()

/** How a part turns for an animal now (radians about x, y, z) and how far its body bobs. */
function pose(role: Role, a: Animal, sp: Species, time: number, out: THREE.Euler) {
  const step = Math.sin(a.phase)
  const walk = Math.min(1.6, a.gait)
  out.set(0, 0, 0)
  switch (role) {
    case 'legFL':
    case 'legBR':
      out.z = step * sp.swing * walk
      break
    case 'legFR':
    case 'legBL':
      out.z = -step * sp.swing * walk
      break
    case 'head':
      out.z = -a.graze * sp.dip + Math.sin(time * 0.9 + a.seed) * 0.05 + (a.mode === 'look' ? 0.12 : 0)
      out.y = a.mode === 'look' ? Math.sin(time * 0.7 + a.seed) * 0.5 : 0
      break
    case 'tail':
      out.x = Math.sin(time * 2.4 + a.seed) * 0.4
      break
    case 'tailYaw':
      out.y = Math.sin(time * (0.5 + walk * 2.5) + a.seed) * (0.18 + walk * 0.2)
      break
    case 'earL':
      out.y = 0.25 + Math.sin(time * 1.6 + a.seed) * 0.25
      break
    case 'earR':
      out.y = -0.25 - Math.sin(time * 1.6 + a.seed) * 0.25
      break
    case 'trunk':
      out.z = Math.sin(time * 0.9 + a.seed) * 0.3 + 0.1 - a.graze * 0.35
      break
    case 'jaw':
      out.z = -a.jaw * 0.85
      break
    case 'armR':
      // The chimpanzee's right arm: a front leg when it walks; cracking a nut, the stone raised and brought down.
      out.z = a.mode === 'crack' ? -1.5 + Math.abs(Math.sin(time * 3.2 + a.seed)) * 1.25 : -step * sp.swing * walk
      break
  }
}

/**
 * A herd of one species: its parts drawn once each for all of them (instanced), every animal moved by
 * the brain and posed every frame near the camera, less often far away (and not at all past `far`).
 */
export function Herd({ species, animals, brain, far = 260, shadows = false }: { species: Species; animals: Animal[]; brain: Brain; far?: number; shadows?: boolean }) {
  const meshes = useMemo(
    () =>
      species.parts.map((p, i) => {
        const m = new THREE.InstancedMesh(partGeometry(`${species.id}:${i}`, p.blocks), ANIMAL_MAT, animals.length)
        m.frustumCulled = false
        m.castShadow = shadows
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
        return m
      }),
    [species, animals.length, shadows],
  )
  useEffect(() => () => meshes.forEach((m) => m.dispose()), [meshes])
  const group = useRef<THREE.Group>(null)
  const skip = useRef(0)
  useFrame(({ camera, clock }, dt0) => {
    const dt = Math.min(0.1, dt0)
    const time = clock.elapsedTime
    // How far the herd is: far, it's posed every few frames (it hardly shows); past `far`, left as it is.
    const g = group.current
    let d = 0
    if (g && animals.length) {
      g.updateWorldMatrix(true, false)
      V.set(animals[0].x, 0, animals[0].z).applyMatrix4(g.matrixWorld)
      d = camera.getWorldPosition(CAM).distanceTo(V)
    }
    if (d > far) return
    const every = d > far * 0.5 ? 4 : d > far * 0.25 ? 2 : 1
    skip.current = (skip.current + 1) % every
    if (skip.current) return
    const step = dt * every
    animals.forEach((a, i) => {
      brain(a, step, time, species)
      const speed = a.gait > 1 ? species.walk + (species.run - species.walk) * (a.gait - 1) : species.walk * a.gait
      a.phase += ((speed * step) / species.stride) * Math.PI * 2
      const bob = Math.abs(Math.sin(a.phase)) * 0.06 * Math.min(1, a.gait) * a.scale
      M.compose(V.set(a.x, a.y + bob, a.z), Q.setFromAxisAngle(UP, -a.h), S.setScalar(a.scale))
      species.parts.forEach((p, k) => {
        pose(p.role, a, species, time, E)
        P.compose(V.set(p.pivot[0], p.pivot[1], p.pivot[2]), Q.setFromEuler(E), S.set(1, 1, 1))
        meshes[k].setMatrixAt(i, P.premultiply(M))
      })
    })
    meshes.forEach((m) => (m.instanceMatrix.needsUpdate = true))
  })
  return (
    <group ref={group}>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </group>
  )
}

/* ---------- The crocodiles: on the bank, into the water, drifting ---------- */

/**
 * The crocodiles' way: basking on the bank (`bank`, the points they lie at), mouth open to cool;
 * now and then one gets up, walks to the water's edge and slides in, sinking till only its back and
 * eyes show (`water`: the level under the bank's), drifts a while, then comes back up its bank.
 * `toWater(x, z)`: the nearest point of the water from there.
 */
export function crocBrain(bank: [number, number][], toWater: (x: number, z: number) => [number, number], level = -0.42): Brain {
  return (a, dt, time) => {
    a.t -= dt
    const r = (a.seed = (a.seed * 16807) % 2147483647) / 2147483647
    const home = bank[Math.abs(a.seed >> 8) % bank.length]
    const go = (tx: number, tz: number, speed: number) => {
      const dx = tx - a.x
      const dz = tz - a.z
      const d = Math.hypot(dx, dz)
      a.h = turnToward(a.h, Math.atan2(dz, dx), dt * 1.2)
      a.gait = ease(a.gait, d < 0.4 ? 0 : speed, dt * 2)
      const v = 0.7 * a.gait * dt
      if (Math.cos(Math.atan2(dz, dx) - a.h) > 0.4) {
        a.x += Math.cos(a.h) * v
        a.z += Math.sin(a.h) * v
      }
      return d
    }
    switch (a.mode) {
      case 'graze':
      case 'bask':
        a.gait = ease(a.gait, 0, dt * 3)
        // Mouth open in the sun, now and then.
        a.jaw = ease(a.jaw, Math.sin(time * 0.25 + a.ox) > 0.3 ? 1 : 0.1, dt)
        a.y = ease(a.y, 0, dt * 2)
        if (a.t < 0) {
          if (r < 0.5) {
            const [wx, wz] = toWater(a.x, a.z)
            a.tx = wx
            a.tz = wz
            a.mode = 'toWater'
            a.t = 25
          } else a.t = 6 + r * 12
        }
        break
      case 'toWater': {
        a.jaw = ease(a.jaw, 0, dt * 3)
        const d = go(a.tx, a.tz, 1)
        if (d < 0.6 || a.t < 0) {
          a.mode = 'slide'
          a.t = 2.2
        }
        break
      }
      case 'slide':
        // Down into the water, on, sinking.
        a.gait = ease(a.gait, 1.4, dt * 2)
        a.x += Math.cos(a.h) * 1.1 * dt
        a.z += Math.sin(a.h) * 1.1 * dt
        a.y = ease(a.y, level, dt * 1.4)
        if (a.t < 0) {
          a.mode = 'swim'
          a.t = 12 + r * 20
          a.tx = a.x + Math.cos(a.h) * 6
          a.tz = a.z + Math.sin(a.h) * 6
        }
        break
      case 'swim': {
        // Drifting, the tail sweeping slowly; then back toward its bank.
        a.y = ease(a.y, level + Math.sin(time * 0.8 + a.ox) * 0.03, dt)
        const d = go(a.tx, a.tz, 0.5)
        if (d < 1) {
          a.tx = a.x + Math.cos(a.h + (r - 0.5) * 2) * 5
          a.tz = a.z + Math.sin(a.h + (r - 0.5) * 2) * 5
          const [wx, wz] = toWater(a.tx, a.tz)
          a.tx = wx
          a.tz = wz
        }
        if (a.t < 0) {
          a.mode = 'climb'
          a.t = 40
        }
        break
      }
      case 'climb': {
        const d = go(home[0], home[1], 1)
        a.y = ease(a.y, 0, dt * 0.8)
        if (d < 0.5 || a.t < 0) {
          a.mode = 'bask'
          a.t = 10 + r * 20
          a.h += Math.PI * (0.6 + r * 0.8)
        }
        break
      }
    }
  }
}

/**
 * The chimpanzees' way: half of them (by their seed) at a nut-cracking root, sat, the stone going up and
 * down (« crack »), now and then a look round; the others wander round the group's middle like a herd.
 * `scare` (optional): when it's true they all stop and look (a twig snapped, a voice too loud).
 */
export function chimpBrain(anvils: [number, number][], wander: Brain, scare?: () => boolean): Brain {
  return (a, dt, time, sp) => {
    if (scare?.() && a.mode !== 'look') {
      a.mode = 'look'
      a.t = 2.5
    }
    const k = Math.abs(a.seed >> 3) % (anvils.length * 2)
    if (k >= anvils.length || a.mode === 'look') {
      if (a.mode === 'look') {
        a.t -= dt
        a.gait = ease(a.gait, 0, dt * 3)
        a.graze = ease(a.graze, 0, dt * 3)
        if (a.t < 0) a.mode = k < anvils.length ? 'crack' : 'graze'
        return
      }
      return wander(a, dt, time, sp)
    }
    const [ax, az] = anvils[k]
    const dx = ax - a.x
    const dz = az - a.z
    const d = Math.hypot(dx, dz)
    if (d > 0.9) {
      a.mode = 'walk'
      a.h = turnToward(a.h, Math.atan2(dz, dx), dt * 2)
      a.gait = ease(a.gait, 1, dt * 2)
      a.x += Math.cos(a.h) * sp.walk * a.gait * dt
      a.z += Math.sin(a.h) * sp.walk * a.gait * dt
      return
    }
    a.mode = 'crack'
    a.gait = ease(a.gait, 0, dt * 3)
    a.graze = ease(a.graze, 0.6, dt * 2)
  }
}

/** The hippos in the river: drifting, sinking to the eyes, yawning wide now and then. */
export function hippoBrain(stay: (x: number, z: number) => [number, number], level = -1.15): Brain {
  return (a, dt, time) => {
    a.t -= dt
    a.y = ease(a.y, level + Math.sin(time * 0.4 + a.ox) * 0.2, dt)
    const yawn = ((time + a.ox * 7) % 14) / 14
    a.jaw = yawn > 0.8 ? Math.sin(((yawn - 0.8) / 0.2) * Math.PI) : 0
    a.gait = ease(a.gait, 0.3, dt)
    a.h += Math.sin(time * 0.1 + a.ox) * dt * 0.1
    a.x += Math.cos(a.h) * 0.12 * dt
    a.z += Math.sin(a.h) * 0.12 * dt
    const [sx, sz] = stay(a.x, a.z)
    if (sx !== a.x || sz !== a.z) {
      a.x = sx
      a.z = sz
      a.h += Math.PI * 0.8
    }
  }
}

/* ---------- Birds: a flock wheeling, waders at the water ---------- */

const BIRD_BODY: Blk[] = [
  [0, 0, 0, 0.5, 0.16, 0.16, '#f4f2ec'],
  [0.3, 0.06, 0, 0.16, 0.12, 0.12, '#f4f2ec'],
  [0.43, 0.05, 0, 0.12, 0.03, 0.03, '#e3b23c'],
]
const BIRD_WING: Blk[] = [[0, 0, 0.35, 0.3, 0.03, 0.7, '#ecebe4']]

/** A flock of egrets wheeling over the water and the grass, in a loose ring that drifts; wings beating. */
export function Flock({ n = 14, centre, radius = 30, height = 14, color, seed = 'oiseaux' }: { n?: number; centre: [number, number]; radius?: number; height?: number; color?: string; seed?: string }) {
  const parts = useMemo(() => {
    const tint = (b: Blk[]): Blk[] => (color ? b.map((x) => [...x.slice(0, 6), x === b[2] ? x[6] : color, ...x.slice(7)] as Blk) : b)
    return [partGeometry(`bird:${color}`, tint(BIRD_BODY)), partGeometry(`wingL:${color}`, tint(BIRD_WING)), partGeometry(`wingR:${color}`, tint(BIRD_WING.map((b) => [b[0], b[1], -b[2], b[3], b[4], b[5], b[6]] as Blk)))]
  }, [color])
  const meshes = useMemo(
    () =>
      parts.map((g) => {
        const m = new THREE.InstancedMesh(g, ANIMAL_MAT, n)
        m.frustumCulled = false
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
        return m
      }),
    [parts, n],
  )
  useEffect(() => () => meshes.forEach((m) => m.dispose()), [meshes])
  const birds = useMemo(() => {
    const r = rng(seed)
    return [...Array(n)].map(() => ({ a: r() * Math.PI * 2, rr: radius * (0.7 + r() * 0.5), y: height + (r() - 0.5) * 4, f: 0.12 + r() * 0.05, beat: r() * 6 }))
  }, [n, radius, height, seed])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    // The ring itself wanders a little over the water.
    const cx = centre[0] + Math.sin(t * 0.05) * radius * 0.4
    const cz = centre[1] + Math.cos(t * 0.04) * radius * 0.3
    birds.forEach((b, i) => {
      const a = b.a + t * b.f
      const x = cx + Math.cos(a) * b.rr
      const z = cz + Math.sin(a) * b.rr
      const y = b.y + Math.sin(t * 0.6 + b.beat) * 1.2
      const h = a + Math.PI / 2
      M.compose(V.set(x, y, z), Q.setFromAxisAngle(UP, -h), S.setScalar(1.4))
      meshes[0].setMatrixAt(i, M)
      const flap = Math.sin(t * 9 + b.beat) * 0.7
      for (const [k, s] of [[1, 1], [2, -1]] as const) {
        P.compose(V.set(0, 0.04, 0), Q.setFromEuler(E.set(-flap * s, 0, 0)), S.set(1, 1, 1))
        meshes[k].setMatrixAt(i, P.premultiply(M))
      }
    })
    meshes.forEach((m) => (m.instanceMatrix.needsUpdate = true))
  })
  return (
    <group>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </group>
  )
}

const HERON: Blk[] = [
  [0, 1.0, 0, 0.55, 0.3, 0.28, '#9aa3ab'],
  [0.3, 1.35, 0, 0.1, 0.6, 0.1, '#c5ccd2', 0, 0, -0.3],
  [0.42, 1.68, 0, 0.22, 0.12, 0.12, '#e8ebee'],
  [0.62, 1.66, 0, 0.32, 0.04, 0.05, '#d8b04a'],
  [-0.02, 0.45, 0.06, 0.04, 0.9, 0.04, '#5a5048'],
  [-0.02, 0.45, -0.06, 0.04, 0.9, 0.04, '#5a5048'],
  [-0.3, 0.95, 0, 0.3, 0.12, 0.24, '#7e868e'],
]
/** Herons standing in the shallows, a stab of the beak now and then. */
export function Waders({ spots }: { spots: [number, number, number][] }) {
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(partGeometry('heron', HERON), ANIMAL_MAT, spots.length)
    m.frustumCulled = false
    return m
  }, [spots.length])
  useEffect(() => () => mesh.dispose(), [mesh])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    spots.forEach(([x, z, h], i) => {
      // A stab: the bird dips forward for a moment.
      const k = (t * 0.3 + i * 0.37) % 1
      const dip = k > 0.9 ? Math.sin(((k - 0.9) / 0.1) * Math.PI) * 0.5 : 0
      P.compose(V.set(0, 0, 0), Q.setFromEuler(E.set(0, 0, -dip)), S.set(1, 1, 1))
      M.compose(V.set(x, 0, z), Q.setFromAxisAngle(UP, -h), S.setScalar(1.3))
      mesh.setMatrixAt(i, P.premultiply(M))
    })
    mesh.instanceMatrix.needsUpdate = true
  })
  return <primitive object={mesh} />
}
