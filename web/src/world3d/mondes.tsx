import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { BevelBoxGeometry, bevels } from './bevel'
import { surfaceMaterial, type SurfaceKind } from './batiments'
import { useMiniTier, type MiniTier } from './minijeux'
import { rng } from './themes'

// « Mini-jeux réalistes », phase 2: the sets of the story and world scenes (the baby's games, the
// baptism, the family's moments, the dream, the junction, the safari, the forest, the pirogue, the
// lianas, the épreuves). Still blocks, but dressed like the concept (lab blocs/kit.ts): every block of a
// prop reads a small pixel texture (bark, leaves, straw, laterite, planks, thatch, banco, granite,
// cloth, net, tôle, breeze-block, ash, plastic, weave) at ~1 to 2 cm the texel, tinted by the block's
// colour, chamfered when « blocs arrondis » says so; a scene's props are merged into one mesh (one
// draw call, one material, one 512 px atlas shared by every scene). The trees have layered voxel
// foliage and lianas, the huts banco walls and thatch, the fires their flames and smoke, the animals
// a pixel skin (wrinkles, fur, scales) painted in their shader. Shown only while « minijeux-realistes »
// is open (useMondes() is 'off' otherwise and the scenes draw exactly what they drew before).

/** The tier the scenes' sets are drawn at: the mini-games' own (off while the update is shut). */
export const useMondes = useMiniTier
export type MondeTier = MiniTier

/* ---------- The atlas: 16 tiles of 128 px, grey patterns tinted by each block's colour ---------- */

/** The tiles, and how many metres one tile covers (its texel size: metres / 128). */
const TILES = {
  ecorce: 1.6,
  feuilles: 1.8,
  herbe: 1.0,
  terre: 2.4,
  bois: 1.4,
  paille: 1.4,
  banco: 2.4,
  ride: 1.4,
  pierre: 2.0,
  rayure: 2.4,
  filet: 0.7,
  tole: 1.2,
  parpaing: 1.6,
  cendre: 1.0,
  plastique: 1.2,
  tissage: 0.6,
} as const
export type Tile = keyof typeof TILES
const TILE_IDS = Object.keys(TILES) as Tile[]
const T = 128
const N = 4

let atlas: THREE.CanvasTexture | null = null
function paintAtlas() {
  if (atlas) return atlas
  const cv = document.createElement('canvas')
  cv.width = cv.height = T * N
  const g = cv.getContext('2d')!
  const r = rng('mondes-atlas')
  const px = (x: number, y: number, v: number, a = 1) => {
    g.fillStyle = `rgba(${v | 0},${v | 0},${v | 0},${a})`
    g.fillRect(x, y, 1, 1)
  }
  const rect = (x: number, y: number, w: number, h: number, v: number, a = 1) => {
    g.fillStyle = `rgba(${v | 0},${v | 0},${v | 0},${a})`
    g.fillRect(x, y, w, h)
  }
  TILE_IDS.forEach((id, i) => {
    const ox = (i % N) * T
    const oy = Math.floor(i / N) * T
    g.save()
    g.beginPath()
    g.rect(ox, oy, T, T)
    g.clip()
    g.translate(ox, oy)
    const noise = (base: number, amp: number) => {
      for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) px(x, y, base + (r() - 0.5) * amp)
    }
    switch (id) {
      case 'ecorce':
        noise(212, 26)
        // Vertical fissures that wander, plates between them.
        for (let k = 0; k < 16; k++) {
          let x = r() * T
          const w = 1 + Math.floor(r() * 2)
          for (let y = 0; y < T; y++) {
            x += (r() - 0.5) * 1.2
            rect(((x % T) + T) % T, y, w, 1, 120 + r() * 30)
          }
        }
        for (let k = 0; k < 40; k++) rect(r() * T, r() * T, 3 + r() * 4, 1, 240, 0.6)
        break
      case 'feuilles':
        noise(170, 20)
        // Leaf clumps: light blobs, dark gaps between them, a few bright tips.
        for (let k = 0; k < 140; k++) {
          const x = r() * T
          const y = r() * T
          const s = 3 + r() * 7
          rect(x, y, s, s * 0.7, 190 + r() * 55)
          rect(x, y + s * 0.7, s, 1, 110)
        }
        for (let k = 0; k < 90; k++) rect(r() * T, r() * T, 2, 2, 90, 0.9)
        for (let k = 0; k < 60; k++) rect(r() * T, r() * T, 1, 1, 255)
        break
      case 'herbe':
        noise(150, 24)
        for (let k = 0; k < 520; k++) {
          const x = r() * T
          const y = r() * T
          rect(x, y, 1, 3 + r() * 8, 170 + r() * 85)
        }
        break
      case 'terre':
        noise(214, 22)
        for (let k = 0; k < 120; k++) rect(r() * T, r() * T, 1 + r() * 3, 1 + r() * 2, r() < 0.5 ? 170 : 245, 0.8)
        for (let k = 0; k < 14; k++) rect(r() * T, r() * T, 4 + r() * 4, 3 + r() * 2, 190)
        break
      case 'bois':
        noise(214, 12)
        // Planks 16 px wide (about 18 cm), grain along them, a dark joint, knots.
        for (let y = 0; y < T; y++) for (let x = 0; x < T; x += 1) if (r() < 0.22) rect(x, y, 4 + r() * 10, 1, 175 + r() * 30, 0.7)
        for (let y = 0; y < T; y += 16) rect(0, y, T, 1, 105)
        for (let k = 0; k < 6; k++) {
          const x = r() * T
          const y = Math.floor(r() * 8) * 16 + 6
          rect(x, y, 4, 3, 130)
          rect(x + 1, y + 1, 2, 1, 95)
        }
        break
      case 'paille':
        noise(200, 20)
        // Thatch: rows of straw hanging down, each row's edge in shadow.
        for (let row = 0; row < T; row += 12) {
          for (let x = 0; x < T; x++) if (r() < 0.6) rect(x, row + r() * 3, 1, 8 + r() * 5, 190 + r() * 65)
          rect(0, row + 11, T, 1, 120, 0.7)
        }
        break
      case 'banco':
        noise(206, 14)
        for (let k = 0; k < 30; k++) rect(r() * T, r() * T, 8 + r() * 18, 4 + r() * 10, 190 + r() * 40, 0.35)
        // Hairline cracks.
        for (let k = 0; k < 4; k++) {
          let x = r() * T
          let y = r() * T
          for (let s = 0; s < 14; s++) {
            px(x, y, 172)
            x += r() < 0.5 ? 1 : 0
            y += r() < 0.6 ? 1 : -1
          }
        }
        break
      case 'ride':
        noise(200, 18)
        for (let k = 0; k < 70; k++) {
          let x = r() * T
          const y = r() * T
          for (let s = 0; s < 12; s++) px((x += 1), y + Math.sin(s * 0.7) * 1.5, 140)
        }
        break
      case 'pierre':
        noise(196, 40)
        for (let k = 0; k < 300; k++) rect(r() * T, r() * T, 1, 1, r() < 0.5 ? 120 : 255)
        for (let k = 0; k < 5; k++) {
          let x = r() * T
          for (let y = 0; y < T; y += 1) rect((x += (r() - 0.5) * 2), y, 1, 1, 130, 0.6)
        }
        break
      case 'rayure':
        // A tarp's or a wax's wide bands, the weave's fine lines.
        for (let x = 0; x < T; x++) rect(x, 0, 1, T, Math.floor(x / 32) % 2 ? 255 : 165)
        for (let y = 0; y < T; y += 2) rect(0, y, T, 1, 0, 0.05)
        break
      case 'filet':
        rect(0, 0, T, T, 222)
        for (let k = 0; k < T; k += 8) {
          rect(k, 0, 1, T, 95)
          rect(0, k, T, 1, 95)
        }
        break
      case 'tole':
        for (let x = 0; x < T; x++) rect(x, 0, 1, T, 190 + Math.sin((x / 8) * Math.PI * 2) * 40)
        for (let k = 0; k < 40; k++) rect(r() * T, r() * T, 2 + r() * 6, 2 + r() * 6, 150, 0.5)
        break
      case 'parpaing':
        noise(208, 26)
        for (let y = 0; y < T; y += 32) {
          rect(0, y, T, 2, 140)
          for (let x = (y / 32) % 2 ? 32 : 0; x < T; x += 64) rect(x, y, 2, 32, 140)
        }
        break
      case 'cendre':
        noise(120, 70)
        for (let k = 0; k < 80; k++) rect(r() * T, r() * T, 1, 1, 255)
        break
      case 'plastique':
        noise(236, 6)
        for (let y = 0; y < T; y += 6) rect(0, y, T, 1, 248, 0.6)
        break
      case 'tissage':
        // A woven mat: over-under squares, each strand a shade.
        for (let y = 0; y < T; y += 8) for (let x = 0; x < T; x += 8) rect(x, y, 8, 8, (x / 8 + y / 8) % 2 ? 236 : 186)
        for (let y = 0; y < T; y += 8) rect(0, y, T, 1, 140, 0.5)
        break
    }
    g.restore()
  })
  atlas = new THREE.CanvasTexture(cv)
  atlas.colorSpace = THREE.SRGBColorSpace
  atlas.magFilter = THREE.NearestFilter
  atlas.minFilter = THREE.LinearMipmapLinearFilter
  atlas.anisotropy = 2
  return atlas
}

/* ---------- The material: the atlas tile per vertex, wrapped by the shader ---------- */

const mats = new Map<string, THREE.Material>()
/** The props' material for a tier (shared; Lambert on « simple », standard lit by the scene's sky above). */
export function mondeMaterial(tier: MondeTier, glow = false): THREE.Material {
  const key = `${tier}${glow ? 'g' : ''}`
  const had = mats.get(key)
  if (had) return had
  const map = paintAtlas()
  // `glow`: the lit things (windows at night, lamps' glass, the stars): unlit, their colour as it is (bloom picks them up).
  const m = glow ? new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }) : tier === 'simple' ? new THREE.MeshLambertMaterial({ vertexColors: true }) : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 })
  m.userData.noMini = true
  m.onBeforeCompile = (s) => {
    s.uniforms.mdMap = { value: map }
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 mdUvt;\nvarying vec3 mdV;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nmdV = mdUvt;')
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D mdMap;\nvarying vec3 mdV;').replace(
      '#include <color_fragment>',
      /* glsl */ `#include <color_fragment>
{
  // The tile's corner in the atlas (row 0 at the canvas' top), the face's metres wrapped inside it.
  float mdT = floor( mdV.z + 0.5 );
  vec2 mdO = vec2( mod( mdT, 4.0 ), 3.0 - floor( mdT / 4.0 ) );
  vec2 mdC = ( mdO + clamp( fract( mdV.xy ), 0.004, 0.996 ) ) * 0.25;
  vec4 mdX = textureGrad( mdMap, mdC, dFdx( mdV.xy ) * 0.25, dFdy( mdV.xy ) * 0.25 );
  diffuseColor.rgb *= mdX.rgb * 1.16;
}`,
    )
  }
  m.customProgramCacheKey = () => 'mondes1'
  mats.set(key, m)
  return m
}

/* ---------- The builder: boxes in, one merged geometry out ---------- */

export type V3 = [number, number, number]
const COL = new THREE.Color()
const M4 = new THREE.Matrix4()
const Q = new THREE.Quaternion()
const E = new THREE.Euler()
const P = new THREE.Vector3()
const S1 = new THREE.Vector3(1, 1, 1)

/** A set of props built box by box, merged into one geometry (one draw call). */
export class Monde {
  parts: THREE.BufferGeometry[] = []
  r: () => number
  /** No chamfers (the small phones' sets, the thin things). */
  plain: boolean
  constructor(seed: string, plain = false) {
    this.r = rng(seed)
    this.plain = plain
  }
  /** A box at p (its middle), sized s, coloured c, reading tile `t`, turned by `rot` (radians, x y z). `jit`: a random shade ± this much. */
  box(p: V3, s: V3, c: string, t: Tile, rot?: V3, jit = 0.06) {
    const [w, h, d] = s
    if (w <= 0 || h <= 0 || d <= 0) return this
    const g = !this.plain && bevels(w, h, d) ? new BevelBoxGeometry(w, h, d) : new THREE.BoxGeometry(w, h, d)
    const faces = g.userData.faces as Uint8Array | undefined
    const uv = g.attributes.uv as THREE.BufferAttribute
    const n = uv.count
    const tm = TILES[t]
    const ti = TILE_IDS.indexOf(t)
    const uvt = new Float32Array(n * 3)
    const du = this.r()
    const dv = this.r()
    for (let k = 0; k < n; k++) {
      const f = faces ? faces[k] : Math.floor(k / 4)
      const a = f >> 1
      // The face's two sides in metres (BoxGeometry's layout: ±x faces span z and y, ±y faces x and z, ±z faces x and y).
      const su = a === 0 ? d : w
      const sv = a === 1 ? d : h
      uvt[k * 3] = (uv.getX(k) * su) / tm + du
      uvt[k * 3 + 1] = (uv.getY(k) * sv) / tm + dv
      uvt[k * 3 + 2] = ti
    }
    g.setAttribute('mdUvt', new THREE.BufferAttribute(uvt, 3))
    g.deleteAttribute('uv')
    COL.set(c)
    if (jit) COL.multiplyScalar(1 + (this.r() - 0.5) * 2 * jit)
    const col = new Float32Array(n * 3)
    for (let k = 0; k < n; k++) col.set([COL.r, COL.g, COL.b], k * 3)
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    if (rot) Q.setFromEuler(E.set(rot[0], rot[1], rot[2]))
    else Q.identity()
    g.applyMatrix4(M4.compose(P.set(p[0], p[1], p[2]), Q, S1))
    g.clearGroups()
    this.parts.push(g.index ? g.toNonIndexed() : g)
    if (g.index) g.dispose()
    return this
  }
  /** A box along a segment from a to b (a branch, a liane, a pole), `w` thick. */
  beam(a: V3, b: V3, w: number, c: string, t: Tile, d = w) {
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const dz = b[2] - a[2]
    const len = Math.hypot(dx, dy, dz)
    if (len < 1e-4) return this
    // Turn the box's y axis onto the segment.
    Q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / len, dy / len, dz / len))
    E.setFromQuaternion(Q)
    return this.box([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], [w, len, d], c, t, [E.x, E.y, E.z])
  }
  build(): THREE.BufferGeometry | null {
    if (!this.parts.length) return null
    const g = mergeGeometries(this.parts, false)
    this.parts.forEach((p) => p.dispose())
    this.parts = []
    if (g) g.computeBoundingSphere()
    return g
  }
}

/** A scene's set: built once (for its seed and tier), one mesh, given back on unmount. */
export function MondeMesh({ tier, seed, make, shadows = false, glow = false }: { tier: MondeTier; seed: string; make: (m: Monde, tier: MondeTier) => void; shadows?: boolean; glow?: boolean }) {
  const geo = useMonde(tier, seed, make)
  if (!geo || tier === 'off') return null
  return <mesh geometry={geo} material={mondeMaterial(tier, glow)} castShadow={shadows} receiveShadow={shadows} />
}

/** The merged geometry of a set (for a scene that draws it more than once: <mesh geometry={…} material={mondeMaterial(tier)}>), given back on unmount. */
export function useMonde(tier: MondeTier, seed: string, make: (m: Monde, tier: MondeTier) => void) {
  const geo = useMemo(() => {
    if (tier === 'off') return null
    const m = new Monde(seed, tier === 'simple')
    make(m, tier)
    return m.build()
  }, [tier, seed]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => geo?.dispose(), [geo])
  return geo
}

/* ---------- The props ---------- */

const pick = <X,>(r: () => number, a: readonly X[]) => a[Math.floor(r() * a.length) % a.length]
const LEAVES = ['#2f5d23', '#3a6b28', '#4a7d2e', '#2a5020', '#56883a'] as const

/**
 * A rainforest tree: the grey-brown trunk on its buttress roots, a few boughs, the crown in three or
 * four layers of leaf blocks (darker inside and below, lighter on top), lianas hanging from the boughs.
 */
export function forestTree(m: Monde, x: number, z: number, h = 14, o: { lianas?: number; w?: number; crown?: number } = {}) {
  const r = m.r
  const w = o.w ?? 0.6 + h * 0.035
  const bark = pick(r, ['#7a6a58', '#6b5a48', '#8a7a66'] as const)
  // The trunk in three sections, a touch narrower each, slightly off-axis.
  let y = 0
  let cx = x
  let cz = z
  for (let k = 0; k < 3; k++) {
    const sh = h * (k === 0 ? 0.42 : 0.3)
    const sw = w * (1 - k * 0.14)
    m.box([cx, y + sh / 2, cz], [sw, sh, sw], bark, 'ecorce', [0, r() * 0.5, 0])
    y += sh
    cx += (r() - 0.5) * 0.25
    cz += (r() - 0.5) * 0.25
  }
  // Buttress roots: thin plates flaring from the foot.
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + r()
    const l = w * (1.4 + r())
    m.box([x + Math.cos(a) * (w / 2 + l / 3), l * 0.35, z + Math.sin(a) * (w / 2 + l / 3)], [l, l * 0.7, 0.12], bark, 'ecorce', [0, -a, 0])
  }
  // The boughs and the crown's layers.
  const crown = o.crown ?? h * 0.42
  const tips: V3[] = []
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + r() * 0.8
    const by = h * (0.62 + r() * 0.2)
    const l = crown * (0.45 + r() * 0.3)
    const tip: V3 = [x + Math.cos(a) * l, by + l * 0.35, z + Math.sin(a) * l]
    m.beam([x, by, z], tip, w * 0.32, bark, 'ecorce')
    tips.push(tip)
  }
  const layers = 3 + (h > 16 ? 1 : 0)
  for (let L = 0; L < layers; L++) {
    const ly = h * 0.72 + L * (crown * 0.24)
    const rad = crown * (1 - L * 0.2)
    const n = 6 - L
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + r() * 0.9 + L
      const d = rad * (0.25 + r() * 0.45)
      const s = rad * (0.5 + r() * 0.35)
      const c = LEAVES[Math.min(LEAVES.length - 1, L + Math.floor(r() * 2))]
      m.box([x + Math.cos(a) * d, ly + (r() - 0.5) * 0.6, z + Math.sin(a) * d], [s, s * 0.42, s * (0.7 + r() * 0.4)], c, 'feuilles', [0, r() * 3, 0], 0.08)
    }
    // The middle of the layer, a bigger, darker block (the crown's mass, the shade under it).
    m.box([x, ly - 0.2, z], [rad * 1.1, rad * 0.4, rad * 1.1], '#2a4a1e', 'feuilles', [0, r() * 3, 0])
  }
  // Lianas: from a bough's tip, down in a few kinks, leaves along some.
  const nl = o.lianas ?? 2
  for (let k = 0; k < nl && k < tips.length; k++) {
    const t = tips[k]
    let a: V3 = [t[0], t[1] - 0.3, t[2]]
    const bottom = r() < 0.5 ? 0.2 : t[1] * (0.3 + r() * 0.3)
    const segs = 4
    for (let s = 1; s <= segs; s++) {
      const b: V3 = [t[0] + (r() - 0.5) * 0.7, a[1] - (a[1] - bottom) / (segs - s + 1), t[2] + (r() - 0.5) * 0.7]
      m.beam(a, b, 0.07, '#4a5a2a', 'ecorce')
      if (r() < 0.6) m.box([b[0], b[1], b[2]], [0.28, 0.12, 0.2], '#3f7a2c', 'feuilles', [0, r() * 3, 0])
      a = b
    }
  }
}

/** A savanna tree (a karité, an acacia): a short forked trunk, a flat crown in two layers with gaps. */
export function savannaTree(m: Monde, x: number, z: number, h = 6) {
  const r = m.r
  const bark = '#6e5a44'
  m.box([x, h * 0.25, z], [0.45, h * 0.5, 0.45], bark, 'ecorce', [0, r(), 0])
  const crown = h * 0.75
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + r()
    m.beam([x, h * 0.48, z], [x + Math.cos(a) * crown * 0.4, h * 0.82, z + Math.sin(a) * crown * 0.4], 0.22, bark, 'ecorce')
  }
  for (let L = 0; L < 2; L++)
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + r() * 0.7
      const d = crown * (0.15 + r() * 0.4) * (1 - L * 0.3)
      const s = crown * (0.35 + r() * 0.2)
      m.box([x + Math.cos(a) * d, h * (0.85 + L * 0.1), z + Math.sin(a) * d], [s, 0.45, s * 0.8], pick(r, ['#6f8d3a', '#5d7f33', '#7c9a45'] as const), 'feuilles', [0, r() * 3, 0], 0.08)
    }
}

/** A rônier or coconut palm: the ringed trunk (bulging two-thirds up for the rônier), the fronds radiating, drooping. */
export function palmTree(m: Monde, x: number, z: number, h = 10, ronier = false) {
  const r = m.r
  const segs = 6
  const lean = (r() - 0.5) * 0.08
  for (let k = 0; k < segs; k++) {
    const y = (k + 0.5) * (h / segs)
    const bulge = ronier ? 1 + Math.max(0, 1 - Math.abs(k / segs - 0.66) * 4) * 0.45 : 1
    const sw = (0.42 - k * 0.02) * bulge
    m.box([x + lean * y, y, z], [sw, h / segs - 0.04, sw], k % 2 ? '#8a7a64' : '#7c6c58', 'ecorce', [0, k * 0.4, 0])
  }
  const top: V3 = [x + lean * h, h, z]
  m.box([top[0], h + 0.15, top[2]], [0.7, 0.5, 0.7], '#6b5a3a', 'ecorce')
  const n = 9
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + r() * 0.3
    const len = 3 + r() * 1.2
    const mid: V3 = [top[0] + Math.cos(a) * len * 0.5, h + 0.5, top[2] + Math.sin(a) * len * 0.5]
    const tip: V3 = [top[0] + Math.cos(a) * len, h - 0.6 - r() * 0.6, top[2] + Math.sin(a) * len]
    m.beam([top[0], h + 0.2, top[2]], mid, 0.08, '#4f7a2a', 'feuilles', 0.6)
    m.beam(mid, tip, 0.06, '#5d8a3a', 'feuilles', 0.5)
  }
}

/** A banana plant: the green pseudo-stem, broad leaves arching out and down. */
export function banana(m: Monde, x: number, z: number, h = 3) {
  const r = m.r
  m.box([x, h * 0.4, z], [0.26, h * 0.8, 0.26], '#6f8a3a', 'ecorce')
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + r()
    const l = 1.4 + r() * 0.5
    m.box([x + Math.cos(a) * l * 0.45, h * 0.85 - 0.1 * k, z + Math.sin(a) * l * 0.45], [l, 0.03, 0.45], k % 2 ? '#4f9a3a' : '#5fa844', 'feuilles', [0, -a, -0.35 - r() * 0.3], 0.05)
  }
}

/** A grass tuft: a few blades leaning out. `tall`: the savanna's (to the waist). */
export function grassTuft(m: Monde, x: number, z: number, h = 0.7, c = '#c9b26a') {
  const r = m.r
  const n = 4
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + r()
    const bh = h * (0.7 + r() * 0.5)
    const tilt = 0.18 + r() * 0.25
    m.box([x + Math.cos(a) * 0.08, bh / 2, z + Math.sin(a) * 0.08], [0.05, bh, 0.012], c, 'herbe', [Math.sin(a) * tilt, -a, -Math.cos(a) * tilt], 0.1)
  }
}

/** A fern or a low bush of the undergrowth. */
export function fern(m: Monde, x: number, z: number, s = 1) {
  const r = m.r
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + r()
    m.box([x + Math.cos(a) * 0.35 * s, 0.25 * s, z + Math.sin(a) * 0.35 * s], [0.75 * s, 0.03, 0.2 * s], pick(r, LEAVES), 'feuilles', [0, -a, 0.5], 0.08)
  }
}

/** A termite mound: red earth, stacked and narrowing, a spire. */
export function termites(m: Monde, x: number, z: number, h = 2.5) {
  const r = m.r
  const k0 = 5
  for (let k = 0; k < k0; k++) {
    const s = 1.8 * (1 - k / (k0 + 1))
    m.box([x + (r() - 0.5) * 0.15, (k + 0.5) * (h / k0), z + (r() - 0.5) * 0.15], [s, h / k0 + 0.05, s * 0.9], '#b5653a', 'terre', [0, r() * 3, 0])
  }
  m.box([x + 0.4, h + 0.4, z - 0.3], [0.4, 1.2, 0.4], '#a95b33', 'terre')
}

/** A granite boulder (a heap of a few). */
export function rock(m: Monde, x: number, z: number, s = 1.5) {
  const r = m.r
  for (let k = 0; k < 3; k++) m.box([x + (r() - 0.5) * s * 0.6, s * (0.3 + k * 0.12), z + (r() - 0.5) * s * 0.6], [s * (1 - k * 0.2), s * 0.6, s * (0.8 - k * 0.15)], pick(r, ['#9a948c', '#8a847c', '#a8a198'] as const), 'pierre', [r() * 0.2, r() * 3, r() * 0.2])
}

/** A village hut (a case): round banco walls, the door, the thatch roof in narrowing rings and its top. */
export function hut(m: Monde, x: number, z: number, rad = 1.7, face = 0, wall = '#a86a3c') {
  const r = m.r
  const h = 1.9
  for (const a of [0, Math.PI / 4]) m.box([x, h / 2, z], [rad * 2, h, rad * 2], wall, 'banco', [0, a + face, 0], 0.03)
  // The foot's darker band (splashes of the rains) and the door.
  for (const a of [0, Math.PI / 4]) m.box([x, 0.15, z], [rad * 2 + 0.04, 0.3, rad * 2 + 0.04], '#7a4a2a', 'banco', [0, a + face, 0], 0.02)
  m.box([x + Math.sin(face) * (rad * 1.02), 0.8, z + Math.cos(face) * (rad * 1.02)], [0.75, 1.6, 0.08], '#3a2616', 'bois', [0, face, 0])
  for (let k = 0; k < 5; k++) {
    const s = rad * 2.6 * (1 - k / 5.6)
    for (const a of [0, Math.PI / 4]) m.box([x, h + 0.15 + k * 0.36, z], [s, 0.42, s], k % 2 ? '#c9a45a' : '#b8924c', 'paille', [0, a + face + k * 0.2, 0], 0.04)
  }
  m.box([x, h + 2.0, z], [0.3, 0.5, 0.3], '#9a7a3c', 'paille')
  m.box([x, h + 2.4, z], [0.06, 0.5, 0.06], '#5a4632', 'bois')
  void r
}

/** A mortar and its pestle (a mortier, a pilon), the pestle leaning in it or against it. */
export function mortar(m: Monde, x: number, z: number, lean = 0.25) {
  const wood = '#7a5232'
  m.box([x, 0.12, z], [0.42, 0.24, 0.42], wood, 'bois')
  m.box([x, 0.34, z], [0.3, 0.2, 0.3], wood, 'bois')
  m.box([x, 0.56, z], [0.46, 0.26, 0.46], wood, 'bois')
  m.box([x, 0.695, z], [0.34, 0.01, 0.34], '#2a1a10', 'bois')
  m.beam([x, 0.6, z], [x + Math.sin(lean) * 1.5, 0.6 + Math.cos(lean) * 1.5, z], 0.08, '#a07a52', 'bois')
}

/** The cooking fire's place: three stones, the logs, a black pot on them (the flames: <Feu>). */
export function hearth(m: Monde, x: number, z: number, pot = true) {
  const r = m.r
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2
    m.box([x + Math.cos(a) * 0.32, 0.13, z + Math.sin(a) * 0.32], [0.26, 0.26, 0.22], '#6a625a', 'pierre', [0, a, 0])
  }
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + r()
    m.beam([x + Math.cos(a) * 0.7, 0.05, z + Math.sin(a) * 0.7], [x, 0.14, z], 0.09, k % 2 ? '#4a3220' : '#5a3a24', 'ecorce')
  }
  m.box([x, 0.02, z], [0.9, 0.04, 0.9], '#3a3430', 'cendre')
  if (pot) {
    m.box([x, 0.45, z], [0.5, 0.34, 0.5], '#2a2624', 'cendre', undefined, 0)
    m.box([x, 0.64, z], [0.42, 0.06, 0.42], '#1e1a18', 'cendre', undefined, 0)
  }
}

/** A plastic garden chair (white, red, blue, green), facing +z. */
export function plasticChair(m: Monde, x: number, z: number, ry: number, c: string) {
  const s = Math.sin(ry)
  const k = Math.cos(ry)
  const at = (dx: number, y: number, dz: number): V3 => [x + dx * k + dz * s, y, z - dx * s + dz * k]
  m.box(at(0, 0.42, 0), [0.44, 0.05, 0.42], c, 'plastique', [0, ry, 0], 0.02)
  m.box(at(0, 0.7, -0.2), [0.44, 0.48, 0.04], c, 'plastique', [-0.12, ry, 0], 0.02)
  for (const dx of [-0.19, 0.19]) for (const dz of [-0.18, 0.18]) m.box(at(dx, 0.2, dz), [0.045, 0.42, 0.045], c, 'plastique', [0, ry, 0], 0.02)
  for (const dx of [-0.21, 0.21]) m.box(at(dx, 0.55, 0), [0.04, 0.04, 0.38], c, 'plastique', [0, ry, 0], 0.02)
}

/** A tarp (a bâche) on its poles, striped (two shades of `c`), `w` × `d`, `h` high. */
export function tarp(m: Monde, x: number, z: number, w: number, d: number, h: number, c = '#e8e8e8') {
  m.box([x, h, z], [w, 0.05, d], c, 'rayure', undefined, 0.02)
  for (const sx of [-1, 1]) {
    m.box([x + (sx * w) / 2, h - 0.15, z], [0.03, 0.3, d], c, 'rayure', undefined, 0.02)
    for (const sz of [-1, 1]) m.box([x + sx * (w / 2 - 0.1), h / 2, z + sz * (d / 2 - 0.1)], [0.07, h, 0.07], '#9aa1a8', 'tole')
  }
}

/** A pirogue: the dugout's hull in planks, the painted band, the thwarts, a heap of net, the paddle. Along x, middle at (x, y, z). */
export function pirogue(m: Monde, x: number, y: number, z: number, len = 7, band = '#d9480f', o: { ry?: number; net?: boolean } = {}) {
  const ry = o.ry ?? 0
  const s = Math.sin(ry)
  const k = Math.cos(ry)
  const at = (dx: number, dy: number, dz: number): V3 => [x + dx * k + dz * s, y + dy, z - dx * s + dz * k]
  const wood = '#6b4a2e'
  const half = len / 2
  // The bottom, then the sides in sections narrowing toward the bow and the stern.
  const segs = 7
  for (let i = 0; i < segs; i++) {
    const u = (i + 0.5) / segs - 0.5
    const wid = 0.95 * (1 - Math.pow(Math.abs(u) * 2, 2.2) * 0.8)
    const sl = len / segs + 0.02
    const rise = Math.pow(Math.abs(u) * 2, 3) * 0.25
    m.box(at(u * len, 0.06 + rise, 0), [sl, 0.12, wid], wood, 'bois', [0, ry, 0], 0.04)
    for (const sd of [-1, 1]) {
      m.box(at(u * len, 0.3 + rise, (sd * wid) / 2), [sl, 0.42, 0.08], wood, 'bois', [sd * 0.18, ry, 0], 0.04)
      m.box(at(u * len, 0.44 + rise, (sd * (wid + 0.06)) / 2), [sl, 0.1, 0.09], band, 'bois', [sd * 0.18, ry, 0], 0.03)
    }
  }
  // Bow and stern posts.
  for (const sd of [-1, 1]) m.box(at(sd * (half - 0.05), 0.5, 0), [0.4, 0.3, 0.16], wood, 'bois', [0, ry, sd * 0.4], 0.03)
  for (const u of [-0.25, 0.05, 0.3]) m.box(at(u * len, 0.36, 0), [0.22, 0.05, 0.8], '#8a6440', 'bois', [0, ry, 0], 0.04)
  if (o.net !== false) {
    m.box(at(-0.12 * len, 0.26, 0), [0.9, 0.22, 0.55], '#d8d0b8', 'filet', [0, ry + 0.3, 0])
    m.box(at(-0.12 * len, 0.38, 0.05), [0.6, 0.12, 0.4], '#c8bea4', 'filet', [0, ry + 0.8, 0])
  }
  m.beam(at(0.15 * len, 0.35, 0.2), at(0.3 * len, 0.5, -0.3), 0.06, '#a07a52', 'bois')
}

/** A low wooden table (or a vendor's), with a cloth of `cloth` if given. */
export function table(m: Monde, x: number, z: number, w = 1.2, d = 0.7, h = 0.75, cloth?: string) {
  m.box([x, h, z], [w, 0.05, d], '#8a6440', 'bois')
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.box([x + sx * (w / 2 - 0.05), h / 2, z + sz * (d / 2 - 0.05)], [0.05, h, 0.05], '#6b4a2e', 'bois')
  if (cloth) m.box([x, h + 0.03, z], [w + 0.02, 0.02, d + 0.02], cloth, 'rayure', undefined, 0.02)
}

/** A compound's wall: breeze-blocks, the plaster, a cap; from (x0, z0) to (x1, z1). */
export function wall(m: Monde, x0: number, z0: number, x1: number, z1: number, h = 1.8, c = '#d9c8a8') {
  const len = Math.hypot(x1 - x0, z1 - z0)
  const ry = -Math.atan2(z1 - z0, x1 - x0)
  m.box([(x0 + x1) / 2, h / 2, (z0 + z1) / 2], [len, h, 0.2], c, 'parpaing', [0, ry, 0], 0.03)
  m.box([(x0 + x1) / 2, h + 0.04, (z0 + z1) / 2], [len + 0.06, 0.08, 0.26], '#bfae90', 'banco', [0, ry, 0], 0.02)
  m.box([(x0 + x1) / 2, 0.12, (z0 + z1) / 2], [len + 0.02, 0.24, 0.22], '#8a7660', 'banco', [0, ry, 0], 0.02)
}

/** A ground slab of tile `t` (laterite, grass, planks), its top at y. */
export function ground(m: Monde, x: number, z: number, w: number, d: number, c: string, t: Tile = 'terre', y = 0) {
  m.box([x, y - 0.05, z], [w, 0.1, d], c, t, undefined, 0)
}

/* ---------- The living things: fire and smoke, mist, lamps ---------- */

const DUMMY = new THREE.Object3D()
const FLAME_GEO = new THREE.BoxGeometry(1, 1, 1)

/** A fire: flame blocks flickering up, ember sparks, smoke blocks rising and spreading, its warm light. */
export function Feu({ p, s = 1, light = true, smoke = true }: { p: V3; s?: number; light?: boolean; smoke?: boolean }) {
  const flames = useRef<THREE.InstancedMesh>(null)
  const smk = useRef<THREE.InstancedMesh>(null)
  const lamp = useRef<THREE.PointLight>(null)
  const NF = 10
  const NS = smoke ? 12 : 0
  const seeds = useMemo(() => [...Array(NF + NS)].map((_, i) => (Math.sin(i * 91.7) * 0.5 + 0.5) * 7), [NS])
  const flameMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', vertexColors: false, toneMapped: false }), [])
  const smokeMat = useMemo(() => new THREE.MeshLambertMaterial({ color: '#8a8580', transparent: true, opacity: 0.35, depthWrite: false }), [])
  useEffect(() => {
    const f = flames.current
    if (!f) return
    const c = new THREE.Color()
    for (let i = 0; i < NF; i++) f.setColorAt(i, c.set(i % 3 === 0 ? '#ffe28a' : i % 3 === 1 ? '#ff9a2e' : '#ff5a1a').multiplyScalar(1.4))
    if (f.instanceColor) f.instanceColor.needsUpdate = true
    return () => {
      flameMat.dispose()
      smokeMat.dispose()
    }
  }, [flameMat, smokeMat])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const f = flames.current
    if (f) {
      for (let i = 0; i < NF; i++) {
        // Each flame block rises and shrinks over its own short life, then starts again at the logs.
        const life = (t * 1.6 + seeds[i]) % 1
        const a = seeds[i] * 2
        const rr = 0.18 * (1 - life)
        const sz = (0.22 - life * 0.16) * (i % 3 === 0 ? 0.7 : 1)
        DUMMY.position.set(Math.cos(a) * rr, 0.12 + life * 0.55, Math.sin(a) * rr)
        DUMMY.rotation.set(0, a + t, 0)
        DUMMY.scale.setScalar(Math.max(0.01, sz))
        DUMMY.updateMatrix()
        f.setMatrixAt(i, DUMMY.matrix)
      }
      f.instanceMatrix.needsUpdate = true
    }
    const sm = smk.current
    if (sm) {
      for (let i = 0; i < NS; i++) {
        const life = (t * 0.22 + seeds[NF + i]) % 1
        const a = seeds[NF + i] * 3
        DUMMY.position.set(Math.cos(a) * life * 0.5 + life * life * 0.8, 0.6 + life * 3.2, Math.sin(a) * life * 0.5)
        DUMMY.rotation.set(life, a, 0)
        DUMMY.scale.setScalar(0.15 + life * 0.6)
        DUMMY.updateMatrix()
        sm.setMatrixAt(i, DUMMY.matrix)
      }
      sm.instanceMatrix.needsUpdate = true
    }
    if (lamp.current) lamp.current.intensity = (2.2 + Math.sin(t * 13) * 0.3 + Math.sin(t * 7.3) * 0.25) * s
  })
  return (
    <group position={p} scale={s}>
      <instancedMesh ref={flames} args={[FLAME_GEO, flameMat, NF]} frustumCulled={false} />
      {NS > 0 && <instancedMesh ref={smk} args={[FLAME_GEO, smokeMat, NS]} frustumCulled={false} />}
      {light && <pointLight ref={lamp} position={[0, 0.6, 0]} color="#ff9a4a" distance={7} decay={1.6} />}
    </group>
  )
}

let mistTex: THREE.CanvasTexture | null = null
function mistTexture() {
  if (mistTex) return mistTex
  const cv = document.createElement('canvas')
  cv.width = cv.height = 64
  const g = cv.getContext('2d')!
  // A soft round puff, in coarse 4 px steps (the blocks' grain even in the mist).
  for (let y = 0; y < 64; y += 4)
    for (let x = 0; x < 64; x += 4) {
      const d = Math.hypot(x + 2 - 32, (y + 2 - 32) * 1.6) / 32
      g.fillStyle = `rgba(255,255,255,${Math.max(0, 1 - d) ** 1.6})`
      g.fillRect(x, y, 4, 4)
    }
  mistTex = new THREE.CanvasTexture(cv)
  mistTex.magFilter = THREE.NearestFilter
  return mistTex
}

/** Mist lying low between the trees (or over the water): soft sheets drifting slowly. */
export function Brume({ spots, color = '#e6efe8', opacity = 0.35 }: { spots: [number, number, number, number][]; color?: string; opacity?: number }) {
  const g = useRef<THREE.Group>(null)
  const mat = useMemo(() => new THREE.SpriteMaterial({ map: mistTexture(), color, transparent: true, opacity, depthWrite: false, fog: true }), [color, opacity])
  useEffect(() => () => mat.dispose(), [mat])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    g.current?.children.forEach((c, i) => {
      c.position.x = spots[i][0] + Math.sin(t * 0.05 + i) * 2.5
    })
  })
  return (
    <group ref={g}>
      {spots.map(([x, y, z, s], i) => (
        <sprite key={i} position={[x, y, z]} scale={[s, s * 0.35, 1]} material={mat} />
      ))}
    </group>
  )
}

/** A lamp (a hurricane lamp on a table, a bulb under a tarp): its glowing glass and its warm light. */
export function Lampe({ p, color = '#ffcf7a', i = 1.6, d = 6, tempete = false }: { p: V3; color?: string; i?: number; d?: number; tempete?: boolean }) {
  return (
    <group position={p}>
      {tempete && (
        <>
          <mesh position={[0, -0.12, 0]}>
            <boxGeometry args={[0.16, 0.06, 0.16]} />
            <meshLambertMaterial color="#8a2a1a" />
          </mesh>
          <mesh position={[0, 0.13, 0]}>
            <boxGeometry args={[0.12, 0.04, 0.12]} />
            <meshLambertMaterial color="#8a2a1a" />
          </mesh>
        </>
      )}
      <mesh>
        <boxGeometry args={tempete ? [0.11, 0.18, 0.11] : [0.1, 0.13, 0.1]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <pointLight color={color} intensity={i} distance={d} decay={1.6} />
    </group>
  )
}

/* ---------- Floors and walls: the « bâtiments réalistes » surfaces ---------- */

/** A box faced with one of batiments.ts' surfaces (tiles, plaster, terrazzo, wood…), its texture repeated for the face that matters. */
export function Surface({ kind, color, tier, p, s, face = 'top' }: { kind: SurfaceKind; color: string; tier: MondeTier; p: V3; s: V3; /** Which face sets the repeat: a floor's top, a wall's front (z), its side (x). */ face?: 'top' | 'front' | 'side' }) {
  const [w, h, d] = s
  const mat = surfaceMaterial(kind, color, tier === 'off' ? 'simple' : tier, face === 'side' ? d : w, face === 'top' ? d : h)
  return (
    <mesh position={p} material={mat}>
      <boxGeometry args={s} />
    </mesh>
  )
}
