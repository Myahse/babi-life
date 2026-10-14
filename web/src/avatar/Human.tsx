import { createContext, useContext, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Look, Sim } from '../lib/types'
import { defaultColors, fullLook } from './options'
import { tint, waxTexture } from './textures'
import { LowHuman } from './LowHuman'

// A stylised cartoon Sim with human proportions (about six heads tall): soft
// rounded shapes, toon shading and an expressive face. Built from generated
// geometry so every skin × body × hair × outfit × colour combination works
// without art assets. Units are metres: feet on y=0, facing +Z.
//
// The head is one smooth surface; hair and beards are shells laid over it that
// follow a hairline and fade into the skin, so there are no blobs or seams.
// The torso is one surface too, with the waist seam where clothes really have one.

export type Pose = 'idle' | 'walk' | 'run' | 'busy' | 'hero' | 'wave' | 'dance' | 'cheer' | 'hug' | 'beg' | 'rant' | 'sit' | 'eat' | 'drink' | 'write' | 'throw' | 'talk'

/** Poses done sitting on a chair (hips at seat height). */
export const SEATED: Pose[] = ['sit', 'eat', 'drink', 'write']
const SEAT_DROP = 0.41

/* ---------- Shared geometry and toon materials ---------- */

const geoCache = new Map<string, THREE.BufferGeometry>()
function geo(key: string, make: () => THREE.BufferGeometry) {
  let g = geoCache.get(key)
  if (!g) geoCache.set(key, (g = make()))
  return g
}
const SPHERE = () => geo('sphere', () => new THREE.SphereGeometry(1, 20, 14))
/** A capsule hanging down from its top end, length = distance between the two ball centres. */
const limb = (r0: number, r1: number, len: number) =>
  geo(`limb${r0}|${r1}|${len}`, () => {
    const pts: THREE.Vector2[] = []
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * (Math.PI / 2)
      pts.push(new THREE.Vector2(Math.sin(a) * r1, -len - Math.cos(a) * r1))
    }
    for (let i = 8; i >= 0; i--) {
      const a = (i / 8) * (Math.PI / 2)
      pts.push(new THREE.Vector2(Math.sin(a) * r0, Math.cos(a) * r0))
    }
    return new THREE.LatheGeometry(pts, 14)
  })
/** A thin arc centred on +Y (brows, lash lines, moustache). */
const arc = (r: number, tube: number, span: number) =>
  geo(`arc${r}|${tube}|${span}`, () => new THREE.TorusGeometry(r, tube, 8, 24, span).rotateZ(Math.PI / 2 - span / 2))

let gradient: THREE.DataTexture | null = null
function toonRamp() {
  if (!gradient) {
    // Five soft steps from shade to light: round, but still cartoon.
    const steps = [118, 150, 186, 222, 255]
    gradient = new THREE.DataTexture(new Uint8Array(steps.flatMap((v) => [v, v, v, 255])), steps.length, 1, THREE.RGBAFormat)
    gradient.minFilter = gradient.magFilter = THREE.LinearFilter
    gradient.needsUpdate = true
  }
  return gradient
}

const matCache = new Map<string, THREE.Material>()
function mat(color: string, o: { map?: THREE.Texture; double?: boolean; shine?: boolean } = {}) {
  const key = `${color}|${o.map?.uuid ?? ''}|${o.double ?? false}|${o.shine ?? false}`
  let m = matCache.get(key)
  if (!m) {
    m = new THREE.MeshToonMaterial({
      color: o.map ? '#ffffff' : color,
      map: o.map,
      gradientMap: toonRamp(),
      side: o.double ? THREE.DoubleSide : THREE.FrontSide,
      emissive: o.shine ? new THREE.Color(color).multiplyScalar(0.25) : undefined,
    })
    matCache.set(key, m)
  }
  return m
}
const flat = (color: string) => {
  const key = `basic|${color}`
  let m = matCache.get(key)
  if (!m) matCache.set(key, (m = new THREE.MeshBasicMaterial({ color })))
  return m
}
const wax = (color: string, pattern: string) => mat('#fff', { map: waxTexture(color, pattern) })

/** Fabric with three stripes down the outer side of a limb (u = ¼ is +X on a lathe, ¾ is -X). */
const stripeCache = new Map<string, THREE.CanvasTexture>()
function striped(base: string, stripe: string, side: number) {
  const key = `${base}|${stripe}|${side}`
  let t = stripeCache.get(key)
  if (!t) {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 4
    const g = c.getContext('2d')!
    g.fillStyle = base
    g.fillRect(0, 0, 256, 4)
    g.fillStyle = stripe
    const mid = side > 0 ? 64 : 192
    for (const k of [-1, 0, 1]) g.fillRect(mid + k * 7 - 2, 0, 4, 4)
    t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    stripeCache.set(key, t)
  }
  return mat('#fff', { map: t })
}

type V3 = [number, number, number]
type Mat = THREE.Material | THREE.Material[]
const Shadows = createContext(true)
/** Wrap crowds in this: background Sims don't need to cast shadows. */
export const NoShadows = ({ children }: { children: React.ReactNode }) => <Shadows.Provider value={false}>{children}</Shadows.Provider>

function Part({ g, m, p, s, r }: { g: THREE.BufferGeometry; m: Mat; p?: V3; s?: V3 | number; r?: V3 }) {
  return <mesh geometry={g} material={m} position={p} scale={s} rotation={r} castShadow={useContext(Shadows)} />
}
const Blob = ({ m, p, r, rot }: { m: THREE.Material; p: V3; r: V3; rot?: V3 }) => <Part g={SPHERE()} m={m} p={p} s={r} r={rot} />
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/* ---------- Proportions ---------- */

const BODY: Record<string, { w: number; limb: number; belly: number }> = {
  mince: { w: 0.9, limb: 0.86, belly: 0 },
  moyen: { w: 1, limb: 1, belly: 0 },
  fort: { w: 1.14, limb: 1.2, belly: 0.008 },
  rond: { w: 1.2, limb: 1.12, belly: 0.05 },
}

const HIP_Y = 0.86
const THIGH = 0.37
const SHIN = 0.37
const SHOULDER_Y = 1.265
const UPPER_ARM = 0.25
const FOREARM = 0.23
const HEAD_Y = 1.5
const HEAD: V3 = [0.122, 0.138, 0.124] // head radii
const WAIST_Y = 0.99 // where tops end and trousers begin

/* ---------- Head: one surface, with shells for hair and beards ---------- */

/** The head's shape for a unit direction: an egg that narrows to a soft jaw. */
const JAW = 0.14
const CHIN = 1.05 // the lower half is a little longer than the top
function headPoint(ux: number, uy: number, uz: number, out: THREE.Vector3) {
  const low = Math.max(0, -uy)
  return out.set(ux * HEAD[0] * (1 - JAW * low * low), uy * HEAD[1] * (uy < 0 ? CHIN : 1), uz * HEAD[2] * (1 - 0.06 * low * low))
}

/** Depth of the face's surface at (x, y), to sit features right on it. */
function faceZ(x: number, y: number) {
  const uy = y / (HEAD[1] * (y < 0 ? CHIN : 1))
  const low = Math.max(0, -uy)
  const ux = x / (HEAD[0] * (1 - JAW * low * low))
  return Math.sqrt(Math.max(0, 1 - ux * ux - uy * uy)) * HEAD[2] * (1 - 0.06 * low * low)
}

/**
 * A surface over the head, lifted by thickness(direction) metres. Where the
 * thickness is negative it sinks under the skin, so the edge of the hair or
 * beard fades in instead of ending on a hard rim.
 */
function headShell(key: string, thickness: (ux: number, uy: number, uz: number) => number) {
  return geo(`shell-${key}`, () => {
    let g: THREE.BufferGeometry = new THREE.SphereGeometry(1, 56, 40)
    g.deleteAttribute('uv')
    g.deleteAttribute('normal')
    g = mergeVertices(g)
    const pos = g.attributes.position
    const v = new THREE.Vector3()
    const shown: boolean[] = []
    for (let i = 0; i < pos.count; i++) {
      const [ux, uy, uz] = [pos.getX(i), pos.getY(i), pos.getZ(i)]
      const t = thickness(ux, uy, uz)
      headPoint(ux, uy, uz, v).add(new THREE.Vector3(ux, uy, uz).multiplyScalar(t))
      pos.setXYZ(i, v.x, v.y, v.z)
      shown[i] = t > -0.0025
    }
    const idx = g.index!
    const keep: number[] = []
    for (let i = 0; i < idx.count; i += 3) {
      const [a, b, c] = [idx.getX(i), idx.getX(i + 1), idx.getX(i + 2)]
      if (shown[a] || shown[b] || shown[c]) keep.push(a, b, c)
    }
    g.setIndex(keep)
    g.computeVertexNormals()
    return g
  })
}

/** Hairline height (unit-sphere y) at an azimuth: high on the forehead, low at the nape. */
function hairline(az: number, front: number, side: number, back: number) {
  const c = Math.cos(az)
  return c >= 0 ? side + (front - side) * c : side + (side - back) * c
}

/**
 * Hair laid over the scalp. The mesh starts exactly on the hairline, so its
 * edge is a clean curve; it thickens as it goes up.
 */
const hairShell = (key: string, depth: number, front = 0.52, side = 0.16, back = -0.55) =>
  geo(`hair-${key}`, () => {
    const N = 96
    const M = 28
    const pos: number[] = []
    const index: number[] = []
    const v = new THREE.Vector3()
    for (let i = 0; i <= M; i++) {
      const f = i / M
      for (let j = 0; j <= N; j++) {
        const az = (j / N) * Math.PI * 2
        const h = hairline(az, front, side, back)
        const uy = h + (1 - h) * f
        const hr = Math.sqrt(Math.max(0, 1 - uy * uy))
        const [ux, uz] = [Math.sin(az) * hr, Math.cos(az) * hr]
        const t = 0.0012 + depth * smooth(0, 0.16, uy - h)
        headPoint(ux, uy, uz, v).add(new THREE.Vector3(ux, uy, uz).multiplyScalar(t))
        pos.push(v.x, v.y, v.z)
      }
    }
    for (let i = 0; i < M; i++)
      for (let j = 0; j < N; j++) {
        const a = i * (N + 1) + j
        const c = a + N + 1
        index.push(a, a + 1, c, a + 1, c + 1, c)
      }
    let g: THREE.BufferGeometry = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setIndex(index)
    g = mergeVertices(g)
    g.computeVertexNormals()
    return g
  })

/* ---------- Torso: one lathe-like surface with an elliptic section ---------- */

// [height, half-width, half-depth, extra forward (chest, bust, belly)]
type Row = [number, number, number, number]
const TORSO: Record<'homme' | 'femme', Row[]> = {
  homme: [
    [0.79, 0.001, 0.001, 0], [0.8, 0.12, 0.088, 0], [0.86, 0.155, 0.105, 0], [0.93, 0.16, 0.106, 0], [1.0, 0.15, 0.104, 0], [1.08, 0.152, 0.108, 0.004],
    [1.16, 0.165, 0.112, 0.01], [1.23, 0.178, 0.11, 0.006], [1.27, 0.19, 0.098, 0], [1.305, 0.165, 0.082, 0], [1.34, 0.09, 0.06, 0], [1.362, 0.001, 0.001, 0],
  ],
  femme: [
    [0.79, 0.001, 0.001, 0], [0.8, 0.13, 0.092, 0], [0.86, 0.172, 0.112, 0], [0.93, 0.166, 0.106, 0], [1.02, 0.128, 0.09, 0], [1.08, 0.132, 0.096, 0.004],
    [1.15, 0.15, 0.104, 0.03], [1.2, 0.162, 0.104, 0.018], [1.245, 0.17, 0.092, 0], [1.285, 0.15, 0.076, 0], [1.325, 0.085, 0.056, 0], [1.352, 0.001, 0.001, 0],
  ],
}

type Ring = { y: number; rx: number; rz: number; fz: number }
const ringCache = new Map<string, Ring[]>()
function torsoRings(femme: boolean, w: number, belly: number): Ring[] {
  const key = `${femme}|${w}|${belly}`
  let rings = ringCache.get(key)
  if (!rings) ringCache.set(key, (rings = makeRings(femme, w, belly)))
  return rings
}
function makeRings(femme: boolean, w: number, belly: number): Ring[] {
  const rows = TORSO[femme ? 'femme' : 'homme'].map(([y, rx, rz, fz]) => {
    const b = y >= 0.98 && y <= 1.09 ? belly : 0
    return { y, rx: (rx + b * 0.6) * w, rz: (rz + b * 0.4) * w, fz: (fz + b) * w }
  })
  // A smooth curve through the rows, so toon shading doesn't band.
  const curve = new THREE.CatmullRomCurve3(rows.map((r) => new THREE.Vector3(r.rx, r.y, r.rz)))
  const fz = new THREE.CatmullRomCurve3(rows.map((r) => new THREE.Vector3(r.fz, r.y, 0)))
  const a = curve.getPoints(72)
  const b = fz.getPoints(72)
  return a.map((p, i) => ({ y: p.y, rx: Math.max(0.001, p.x), rz: Math.max(0.001, p.z), fz: Math.max(0, b[i].x) }))
}

/** The torso's half-width and half-depth at height y. */
function torsoAt(femme: boolean, w: number, belly: number, y: number) {
  const rings = torsoRings(femme, w, belly)
  const i = Math.max(1, rings.findIndex((r) => r.y >= y))
  const [a, b] = [rings[i - 1], rings[i]]
  const t = (y - a.y) / (b.y - a.y || 1)
  const [rz, fz] = [a.rz + (b.rz - a.rz) * t, a.fz + (b.fz - a.fz) * t]
  return { rx: a.rx + (b.rx - a.rx) * t, rz: rz + fz * 0.5, front: rz + fz }
}

/** Material 0 below the waist, material 1 above it. */
function torsoGeometry(femme: boolean, w: number, belly: number, waist: number) {
  return geo(`torso${femme}|${w}|${belly}|${waist}`, () => {
    const rings = torsoRings(femme, w, belly)
    const N = 40
    const pos: number[] = []
    const uv: number[] = []
    const index: number[] = []
    rings.forEach((r, i) => {
      for (let j = 0; j <= N; j++) {
        const a = (j / N) * Math.PI * 2
        const c = Math.cos(a)
        pos.push(r.rx * Math.sin(a), r.y, r.rz * c + r.fz * Math.max(0, c) ** 2)
        uv.push(j / N, i / (rings.length - 1))
      }
    })
    const groups: { start: number; m: number }[] = []
    for (let i = 0; i < rings.length - 1; i++) {
      const m = rings[i].y < waist ? 0 : 1
      if (groups.at(-1)?.m !== m) groups.push({ start: index.length, m })
      for (let j = 0; j < N; j++) {
        const a = i * (N + 1) + j
        const c = a + N + 1
        index.push(a, a + 1, c, a + 1, c + 1, c)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    g.setIndex(index)
    groups.forEach((gr, k) => g.addGroup(gr.start, (groups[k + 1]?.start ?? index.length) - gr.start, gr.m))
    g.computeVertexNormals()
    // The first and last column are the same points: give them one normal.
    const n = g.attributes.normal
    for (let i = 0; i < rings.length; i++) {
      const [a, b] = [i * (N + 1), i * (N + 1) + N]
      const v = new THREE.Vector3(n.getX(a) + n.getX(b), n.getY(a) + n.getY(b), n.getZ(a) + n.getZ(b)).normalize()
      n.setXYZ(a, v.x, v.y, v.z)
      n.setXYZ(b, v.x, v.y, v.z)
    }
    return g
  })
}

/**
 * A vest painted on the torso: scoop neck, straps over the shoulders and low
 * armholes, with skin everywhere else. u goes round the body (0 = front), v up it.
 */
const vestCache = new Map<string, THREE.CanvasTexture>()
type VestStyle = { strap: number; armhole: number; neck: number; trim?: string; number?: string; ribs?: boolean }
const VEST: VestStyle = { strap: 0.085, armhole: 1.17, neck: 1.225, ribs: true }
function vestTexture(femme: boolean, w: number, belly: number, vest: string, skin: string, st: VestStyle = VEST) {
  const key = `${femme}|${w}|${belly}|${vest}|${skin}|${JSON.stringify(st)}`
  let t = vestCache.get(key)
  if (t) return t
  const rings = torsoRings(femme, w, belly)
  const [W, H] = [512, 256]
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  g.fillStyle = skin
  g.fillRect(0, 0, W, H)
  g.fillStyle = vest
  // The vest's top edge as one smooth path, so the neckline is clean.
  const vOf = (y: number) => {
    const k = rings.findIndex((r) => r.y >= y)
    if (k < 0) return 1
    if (k === 0) return 0
    return (k - 1 + (y - rings[k - 1].y) / (rings[k].y - rings[k - 1].y)) / (rings.length - 1)
  }
  const edge: [number, number][] = []
  for (let px = 0; px <= W; px++) {
    const a = (px / W) * Math.PI * 2
    const [side, front] = [Math.abs(Math.sin(a)), Math.cos(a)]
    // Straps: a soft-edged band at the shoulders, front and back.
    const strap = 1 - smooth(st.strap - 0.015, st.strap + 0.015, Math.abs(side - 0.5))
    const neck = st.armhole + ((front >= 0 ? st.neck : st.neck + 0.025) - st.armhole) * Math.abs(front) ** 1.6
    edge.push([px, H - vOf(neck + (1.4 - neck) * strap) * H])
  }
  const outline = () => {
    g.beginPath()
    g.moveTo(0, H)
    edge.forEach(([x, y]) => g.lineTo(x, y))
    g.lineTo(W, H)
    g.closePath()
  }
  outline()
  g.fill()
  g.save()
  outline()
  g.clip()
  if (st.ribs) {
    // Ribbed cotton: fine vertical lines.
    g.fillStyle = 'rgba(0,0,0,0.05)'
    for (let x = 0; x < W; x += 6) g.fillRect(x, 0, 2, H)
  }
  if (st.number) {
    // Numbers front (u = 0, so drawn on both edges) and back (u = ½).
    g.fillStyle = st.trim ?? '#ffffff'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    const y = H - vOf(1.1) * H
    for (const [x, size] of [[0, 54], [W, 54], [W / 2, 64]] as const) {
      g.save()
      g.translate(x, y)
      g.scale(0.85, 1)
      g.font = `900 ${size}px system-ui, sans-serif`
      g.fillText(st.number, 0, 0)
      g.restore()
    }
  }
  g.restore()
  if (st.trim) {
    // A contrasting trim round the neck and armholes.
    g.strokeStyle = st.trim
    g.lineWidth = 7
    g.beginPath()
    edge.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
    g.stroke()
  }
  t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  vestCache.set(key, t)
  return t
}

/** A band hugging the torso at height y (belts, waistbands). */
function bandGeometry(femme: boolean, w: number, belly: number, y: number, tube: number, out = 1.02) {
  return geo(`band${femme}|${w}|${belly}|${y}|${tube}|${out}`, () => {
    const rings = torsoRings(femme, w, belly)
    const i = Math.max(1, rings.findIndex((r) => r.y >= y))
    const [a, b] = [rings[i - 1], rings[i]]
    const t = (y - a.y) / (b.y - a.y || 1)
    const [rx, rz, fz] = [a.rx + (b.rx - a.rx) * t, a.rz + (b.rz - a.rz) * t, a.fz + (b.fz - a.fz) * t]
    const pts = [...Array(48)].map((_, j) => {
      const an = (j / 48) * Math.PI * 2
      const c = Math.cos(an)
      return new THREE.Vector3(rx * out * Math.sin(an), y, (rz * c + fz * Math.max(0, c) ** 2) * out)
    })
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 96, tube, 8, true)
    g.scale(1, 0.6, 1).translate(0, y * 0.4, 0)
    return g
  })
}

/** A skirt from the waist, over the hips, down to the hem; even rows keep the print even. */
function skirtGeometry(femme: boolean, w: number, belly: number, hem: number, flareR: number) {
  return geo(`skirt${femme}|${w}|${belly}|${hem}|${flareR}`, () => {
    const waist = torsoAt(femme, w, belly, 1.0)
    const hip = torsoAt(femme, w, belly, 0.87)
    const hipR = Math.max(hip.rx, hip.rz / 0.75) * 1.06
    const bottom = Math.max(flareR, hipR * 1.04)
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(bottom, hem, 0), new THREE.Vector3((bottom + hipR) / 2, (hem + 0.87) / 2, 0), new THREE.Vector3(hipR, 0.87, 0), new THREE.Vector3(waist.rx * 1.03, 1.0, 0)])
    const pts = [new THREE.Vector2(bottom * 0.94, hem + 0.012), ...curve.getPoints(24).map((p) => new THREE.Vector2(p.x, p.y))]
    const g = new THREE.LatheGeometry(pts, 40)
    g.scale(1, 1, 0.75)
    return g
  })
}

/** A flared tube (skirt, robe), drawn bottom → top so it faces outwards. */
function flare(top: number, bottom: number, yTop: number, yBottom: number, depth = 0.8) {
  return geo(`flare${top}|${bottom}|${yTop}|${yBottom}|${depth}`, () => {
    const pts = [new THREE.Vector2(bottom * 0.94, yBottom + 0.012), new THREE.Vector2(bottom, yBottom), new THREE.Vector2(bottom * 0.97, yBottom + 0.04), new THREE.Vector2((top + bottom) / 2 + 0.012, (yTop + yBottom) / 2), new THREE.Vector2(top, yTop)]
    const g = new THREE.LatheGeometry(pts, 40)
    g.scale(1, 1, depth)
    return g
  })
}

/** A short sleeve: a dome over the shoulder, a fitted tube and a turned hem. */
const shortSleeve = (r: number, len: number) =>
  geo(`sleeve${r}|${len}`, () => {
    const pts = [
      [r * 0.8, -len + 0.008], [r * 0.98, -len], [r, -len * 0.55], [r * 1.02, -len * 0.15], [r * 1.0, 0.012], [r * 0.75, r * 0.66], [0.001, r * 0.92],
    ].map(([x, y]) => new THREE.Vector2(x, y))
    return new THREE.LatheGeometry(pts, 24)
  })

/* ---------- Outfits ---------- */

type Shoe = { color: string; kind: 'sneaker' | 'dress' | 'sandal' | 'boot' | 'heel' | 'slide' }
type Body = { femme: boolean; w: number; belly: number }
type Dress = {
  top: THREE.Material
  bottom: THREE.Material // trousers, or the skirt's fabric
  sleeve: 'none' | 'short' | 'long' | 'bell'
  thigh: THREE.Material | null // null = bare
  shin: THREE.Material | null
  shoe: Shoe
  skirt?: { m: THREE.Material; hem: number; r: number; band?: THREE.Material }
  robe?: THREE.Material
  belt?: THREE.Material
  tank?: boolean // a vest: bare shoulders and straps
  shorts?: { m: THREE.Material; stripe: THREE.Material; long?: boolean } // sport shorts over bare thighs
  vest?: VestStyle // how the tank top is cut
  waistband?: { m: THREE.Material; cords: THREE.Material } // elastic waist with a drawstring
  stripes?: { color: string; top: string; bottom: string } // three stripes down the outside of sleeves and legs
  cuffs?: THREE.Material // joggers gathered at the ankle
  extra?: (b: Body) => React.ReactNode
}

function dressFor(l: Required<Look>, femme: boolean): Dress {
  const top = l.outfitColor
  const dc = defaultColors(l, femme)
  const shoe = (kind: Shoe['kind']): Shoe => ({ color: l.shoeColor || dc.shoe, kind })
  switch (l.outfit) {
    case 'pagne': {
      const print = wax(top, l.pattern)
      if (!femme) {
        const trousers = mat(l.bottomColor || dc.bottom)
        return { top: print, bottom: trousers, sleeve: 'short', thigh: trousers, shin: trousers, shoe: shoe('dress') }
      }
      const skirt = l.bottomColor ? wax(l.bottomColor, l.pattern) : print
      return {
        top: print,
        bottom: skirt,
        sleeve: 'short',
        thigh: null,
        shin: null,
        shoe: shoe('sandal'),
        skirt: { m: skirt, hem: 0.07, r: 0.2, band: mat(tint(l.bottomColor || top, -0.3)) },
        // The knot of the pagne at the hip.
        extra: (b) => {
          const { rx, rz } = torsoAt(b.femme, b.w, b.belly, 1.0)
          return (
            <group position={[rx * 0.55, 0.99, rz * 0.9]}>
              <Blob m={skirt} p={[0, 0, 0]} r={[0.026, 0.022, 0.018]} />
              <Blob m={skirt} p={[0.008, -0.04, 0.004]} r={[0.016, 0.04, 0.01]} rot={[0, 0, 0.25]} />
            </group>
          )
        },
      }
    }
    case 'boubou': {
      const fabric = mat(top, { double: true })
      const gold = mat('#e8b93c', { shine: true })
      const trousers = mat(l.bottomColor || dc.bottom)
      return {
        top: fabric,
        bottom: trousers,
        sleeve: 'bell',
        thigh: trousers,
        shin: trousers,
        shoe: shoe('sandal'),
        robe: fabric,
        // Embroidery round the neck and down the chest.
        extra: (b) => (
          <group>
            <mesh geometry={geo('collar', () => new THREE.TorusGeometry(0.06, 0.008, 8, 28))} material={gold} position={[0, 1.33, 0.025]} rotation={[1.2, 0, 0]} scale={[b.w, 1, 1]} />
            <Blob m={gold} p={[0, 1.18, torsoAt(b.femme, b.w, b.belly, 1.18).rz + 0.018]} r={[0.022, 0.08, 0.008]} />
            <Blob m={gold} p={[0, 1.08, torsoAt(b.femme, b.w, b.belly, 1.08).rz + 0.026]} r={[0.05, 0.012, 0.008]} />
          </group>
        ),
      }
    }
    case 'robe': {
      if (!femme) return dressFor({ ...l, outfit: 'casual' }, femme)
      const print = wax(top, l.pattern)
      const skirt = l.bottomColor ? wax(l.bottomColor, l.pattern) : print
      return { top: print, bottom: skirt, sleeve: 'none', thigh: null, shin: null, shoe: shoe('heel'), skirt: { m: skirt, hem: 0.45, r: 0.25 } }
    }
    case 'suit': {
      const jacket = mat(top)
      const trousers = mat(l.bottomColor || dc.bottom)
      const tie = mat((top === '#b02e0c' || top === '#d6336c' ? '#14213d' : '#d6336c'))
      return {
        top: jacket,
        bottom: trousers,
        sleeve: 'long',
        thigh: trousers,
        shin: trousers,
        shoe: shoe('dress'),
        extra: (b) => {
          const z = torsoAt(b.femme, b.w, b.belly, 1.22).rz
          return (
            <group>
              <Blob m={mat('#f8f9fa')} p={[0, 1.255, z - 0.012]} r={[0.045, 0.07, 0.03]} />
              <Blob m={tie} p={[0, 1.2, z + 0.004]} r={[0.016, 0.08, 0.01]} />
              {[-1, 1].map((s) => (
                <Blob key={s} m={jacket} p={[s * 0.052 * b.w, 1.235, z - 0.002]} r={[0.022, 0.085, 0.016]} rot={[0, 0, s * 0.35]} />
              ))}
            </group>
          )
        },
      }
    }
    case 'jersey': {
      const shirt = mat(top)
      const green = mat('#009a44')
      const shorts = mat(l.bottomColor || dc.bottom)
      return {
        top: shirt,
        bottom: shorts,
        sleeve: 'short',
        thigh: shorts,
        shin: null,
        shoe: shoe('boot'),
        extra: (b) => (
          <group>
            <mesh geometry={geo('collar', () => new THREE.TorusGeometry(0.06, 0.008, 8, 28))} material={green} position={[0, 1.33, 0.025]} rotation={[1.2, 0, 0]} scale={[b.w, 1, 1]} />
            <Blob m={green} p={[0.065 * b.w, 1.2, torsoAt(b.femme, b.w, b.belly, 1.2).rz - 0.004]} r={[0.022, 0.026, 0.008]} />
          </group>
        ),
      }
    }
    case 'debardeur': {
      // The white vest and sport shorts of the quartier, with claquettes.
      const vest = mat(top)
      const shorts = mat(l.bottomColor || dc.bottom)
      const stripe = mat(tint(l.bottomColor || dc.bottom, 0.85))
      return {
        top: vest,
        bottom: shorts,
        sleeve: 'none',
        thigh: null,
        shin: null,
        shoe: shoe('slide'),
        tank: true,
        shorts: { m: shorts, stripe },
        waistband: { m: mat(tint(l.bottomColor || dc.bottom, -0.25)), cords: mat('#f4f1ea') },
      }
    }
    case 'survet': {
      // Tracksuit: zip jacket and joggers with three stripes.
      const jacket = mat(top)
      const joggers = mat(l.bottomColor || dc.bottom)
      const light = parseInt(top.slice(1), 16) > 0xb0b0b0
      const stripes = { color: light ? '#14213d' : '#f8f9fa', top, bottom: l.bottomColor || dc.bottom }
      return {
        top: jacket,
        bottom: joggers,
        sleeve: 'long',
        thigh: joggers,
        shin: joggers,
        shoe: shoe('sneaker'),
        stripes,
        cuffs: mat(tint(l.bottomColor || dc.bottom, -0.2)),
        extra: (b) => (
          <group>
            <Part g={bandGeometry(b.femme, b.w, b.belly, 1.335, 0.016, 1.0)} m={jacket} />
            <Blob m={mat('#c9ccd4', { shine: true })} p={[0, 1.16, torsoAt(b.femme, b.w, b.belly, 1.16).front + 0.001]} r={[0.0035, 0.16, 0.003]} />
            <Blob m={mat('#c9ccd4', { shine: true })} p={[0.01, 1.3, torsoAt(b.femme, b.w, b.belly, 1.3).front + 0.004]} r={[0.006, 0.012, 0.004]} />
          </group>
        ),
      }
    }
    case 'basket': {
      // Basketball: a numbered jersey with trim and long baggy shorts.
      const shorts = mat(l.bottomColor || dc.bottom)
      const light = parseInt(top.slice(1), 16) > 0xb0b0b0
      const trim = light ? '#14213d' : '#f8f9fa'
      return {
        top: mat(top),
        bottom: shorts,
        sleeve: 'none',
        thigh: null,
        shin: null,
        shoe: shoe('boot'),
        tank: true,
        vest: { strap: 0.13, armhole: 1.12, neck: 1.25, trim, number: '23' },
        shorts: { m: shorts, stripe: mat(trim), long: true },
        waistband: { m: mat(trim), cords: mat(trim) },
      }
    }
    default: {
      const jeans = mat(l.bottomColor || dc.bottom)
      return { top: mat(top), bottom: jeans, sleeve: 'short', thigh: jeans, shin: jeans, shoe: shoe('sneaker'), belt: mat('#4a2f1d') }
    }
  }
}

/* ---------- Face ---------- */

function Face({ l, femme, skin, seed = 0 }: { l: Required<Look>; femme: boolean; skin: THREE.Material; seed?: number }) {
  const [rx] = HEAD
  // Alive: the eyes blink every few seconds and glance about.
  const eyes = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)]
  const gaze = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)]
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed * 7.3
    const period = 3.2 + (seed % 3)
    const k = (t % period) / period
    const lid = k > 0.965 ? Math.max(0.08, Math.abs(Math.cos(((k - 0.965) / 0.035) * Math.PI))) : 1
    const look = Math.floor(t / 2.4)
    const gx = Math.sin(look * 12.9898 + seed) * 0.0045
    const gy = Math.cos(look * 78.233 + seed) * 0.002
    for (const i of [0, 1]) {
      if (eyes[i].current) eyes[i].current.scale.y = lid
      if (gaze[i].current) gaze[i].current.position.set(gx, gy, 0)
    }
  })
  const shade = mat(tint(l.skin, -0.14))
  const lash = flat('#1a0f0a')
  const lip = mat(tint(l.skin, femme ? -0.35 : -0.28).replace(/^#(..)/, (_, r) => `#${Math.min(255, parseInt(r, 16) + 30).toString(16).padStart(2, '0')}`))
  const blush = mat(tint(l.skin, 0.08).replace(/^#(..)/, (_, r) => `#${Math.min(255, parseInt(r, 16) + 25).toString(16).padStart(2, '0')}`))
  const brow = mat(tint(l.hairColor, -0.25))
  const lipLine = mat(tint(l.skin, -0.5))
  const eyeZ = faceZ(0.047, 0) - 0.008
  return (
    <group>
      {/* Head and ears */}
      <Part g={headShell('head', () => 0)} m={skin} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <Blob m={shade} p={[s * rx * 0.96, -0.012, -0.008]} r={[0.017, 0.03, 0.022]} />
          <Blob m={mat(tint(l.skin, -0.3))} p={[s * rx * 1.02, -0.012, -0.004]} r={[0.006, 0.016, 0.01]} />
        </group>
      ))}
      {/* Eyes: white, iris, pupil, a catch-light, a lash line hugging the lid, a brow */}
      {[-1, 1].map((s, i) => (
        <group key={s} position={[s * 0.047, 0.0, eyeZ]} rotation={[0, s * 0.3, 0]}>
          <group ref={eyes[i]}>
            <Blob m={flat('#fbfaf7')} p={[0, 0, 0]} r={[0.027, 0.031, 0.014]} />
            <group ref={gaze[i]}>
              <Blob m={flat(l.eyes)} p={[0, -0.002, 0.008]} r={[0.0185, 0.021, 0.008]} />
              <Blob m={flat('#080605')} p={[0, -0.002, 0.012]} r={[0.0095, 0.011, 0.005]} />
              <Blob m={flat('#ffffff')} p={[0.006 * s, 0.008, 0.016]} r={[0.0055, 0.0055, 0.003]} />
            </group>
            <Part g={arc(0.028, 0.0036, 2.3)} m={lash} p={[0, 0.001, 0.006]} s={[1, 1.1, 0.8]} />
          </group>
          {femme && [0, 1, 2].map((k) => <Blob key={k} m={lash} p={[s * (0.02 + k * 0.006), 0.026 - k * 0.003, 0.004]} r={[0.0075, 0.0028, 0.004]} rot={[0, 0, s * (0.35 + k * 0.25)]} />)}
          <Part g={arc(0.034, 0.0052, 1.4)} m={brow} p={[s * 0.003, 0.018, 0.007]} s={[1, 1, 0.6]} r={[0, 0, s * -0.12]} />
        </group>
      ))}
      {/* Nose, smile, lips, cheeks */}
      <Blob m={shade} p={[0, -0.04, faceZ(0, -0.04) - 0.001]} r={[0.022, 0.017, 0.016]} />
      {/* the nostrils */}
      {[-1, 1].map((s) => (
        <Blob key={s} m={mat(tint(l.skin, -0.42))} p={[s * 0.009, -0.048, faceZ(0, -0.048) + 0.011]} r={[0.0045, 0.003, 0.003]} />
      ))}
      <Part g={arc(0.024, 0.0042, 2.2)} m={lipLine} p={[0, -0.064, faceZ(0, -0.064) + 0.001]} s={[1, 0.9, 0.5]} r={[0, 0, Math.PI]} />
      {/* the upper lip a shade darker, the lower one fuller */}
      <Blob m={mat(tint(l.skin, -0.32))} p={[0, -0.068, faceZ(0, -0.068) - 0.003]} r={[femme ? 0.02 : 0.017, 0.0045, 0.006]} />
      <Blob m={lip} p={[0, -0.08, faceZ(0, -0.08) - 0.002]} r={[femme ? 0.019 : 0.016, femme ? 0.0085 : 0.0065, 0.008]} />
      {femme && [-1, 1].map((s) => <Blob key={s} m={blush} p={[s * 0.07, -0.04, faceZ(0.07, -0.04) - 0.006]} r={[0.022, 0.014, 0.01]} />)}
      <Marks marks={l.marks} />
      <Hair l={l} />
      <Beard l={l} />
      <HeadAccessory l={l} />
    </group>
  )
}

/** Three red scratch marks. */
function Scratches({ p, rot = 0.5 }: { p: V3; rot?: number }) {
  const red = mat('#a8322a')
  return (
    <group position={p} rotation={[0, 0, rot]}>
      {[-1, 0, 1].map((k) => (
        <Blob key={k} m={red} p={[k * 0.008, k * 0.002, 0]} r={[0.0022, 0.016 - Math.abs(k) * 0.003, 0.0022]} />
      ))}
    </group>
  )
}

/** Bumps and bruises: a crossed plaster on the cheek, scratches on the other. */
function Marks({ marks }: { marks: string }) {
  const plaster = marks === 'pansement' || marks === 'bagarre'
  const scratches = marks === 'griffures' || marks === 'bagarre'
  const tape = mat('#ecc996')
  return (
    <group>
      {plaster && (
        <group position={[0.072, -0.052, faceZ(0.072, -0.052) - 0.002]} rotation={[0, 0.55, 0]}>
          <Blob m={tape} p={[0, 0, 0]} r={[0.03, 0.0085, 0.004]} rot={[0, 0, 0.6]} />
          <Blob m={tape} p={[0, 0, 0.001]} r={[0.03, 0.0085, 0.004]} rot={[0, 0, -0.6]} />
          <Blob m={mat('#d9a96e')} p={[0, 0, 0.003]} r={[0.008, 0.008, 0.003]} />
        </group>
      )}
      {scratches && <Scratches p={[-0.07, -0.05, faceZ(0.07, -0.05) - 0.001]} rot={-0.5} />}
    </group>
  )
}

// Points on the afro's upper surface (unit ellipsoid), and each curl's size.
const AFRO_CURLS: [number, number, number, number][] = (() => {
  const out: [number, number, number, number][] = []
  const n = 120
  for (let i = 0; i < n; i++) {
    // A golden-angle spiral over the dome, not too low at the front.
    const y = 1 - (i / (n - 1)) * 1.25
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    const a = i * 2.39996
    const [x, z] = [Math.cos(a) * r, Math.sin(a) * r]
    if (z > 0.25 && y < 0.38) continue // keep the face clear
    out.push([x * 0.98, y * 0.98, z * 0.98, 0.014 + ((i * 37) % 10) * 0.0011])
  }
  return out
})()

function Hair({ l }: { l: Required<Look> }) {
  const [rx, ry, rz] = HEAD
  // Very dark hair reads as a flat hole under toon light; lift it a touch.
  const hair = mat(tint(l.hairColor, 0.07))
  const short = <Part g={hairShell('short', 0.011, 0.5, 0.2)} m={hair} />
  const strands = (n: number, r: number, len: number) =>
    [...Array(n)].map((_, i) => {
      const a = Math.PI + (i / (n - 1) - 0.5) * Math.PI * 1.15
      return <Part key={i} g={limb(r, r * 0.8, len)} m={hair} p={[Math.sin(a) * rx * 0.97, 0.0, Math.cos(a) * rz * 0.97 - 0.01]} r={[Math.cos(a) * -0.16, 0, Math.sin(a) * 0.16]} />
    })
  if ((l.accessory === 'cap' || l.accessory === 'capback') && ['afro', 'bun', 'headwrap'].includes(l.hair)) return short
  switch (l.hair) {
    case 'bald':
      return <Part g={hairShell('stubble', 0.0015)} m={mat(tint(l.skin, -0.22))} />
    case 'afro':
      return (
        <group>
          <Part g={hairShell('afro', 0.02, 0.5, 0.1, -0.6)} m={hair} />
          <mesh geometry={geo('afro', () => new THREE.IcosahedronGeometry(1, 4))} material={hair} position={[0, 0.095, -0.06]} scale={[rx * 1.55, ry * 1.25, rz * 1.32]} castShadow />
          {/* Curls all over it, so it isn't a smooth ball */}
          {AFRO_CURLS.map(([x, y, z, r], k) => (
            <Blob key={k} m={k % 3 ? hair : mat(tint(l.hairColor, 0.14))} p={[x * rx * 1.55, 0.095 + y * ry * 1.25, -0.06 + z * rz * 1.32]} r={[r, r, r]} />
          ))}
        </group>
      )
    case 'braids':
      return (
        <group>
          <Part g={hairShell('rows', 0.01, 0.56)} m={hair} />
          {strands(15, 0.011, 0.33)}
        </group>
      )
    case 'locks':
      return (
        <group>
          <Part g={hairShell('locks', 0.016, 0.5)} m={hair} />
          {strands(11, 0.018, 0.2)}
        </group>
      )
    case 'bun':
      return (
        <group>
          <Part g={hairShell('sleek', 0.01, 0.58)} m={hair} />
          <Blob m={hair} p={[0, ry * 1.0, -rz * 0.4]} r={[0.06, 0.054, 0.06]} />
        </group>
      )
    case 'weave':
      return (
        <group>
          <Part g={hairShell('weave', 0.016, 0.42, 0.0, -0.75)} m={hair} />
          <mesh geometry={geo('weave', () => new THREE.CylinderGeometry(1.08, 1.25, 1, 32, 1, true, Math.PI * 0.4, Math.PI * 1.2))} material={mat(tint(l.hairColor, 0.1), { double: true })} position={[0, -0.12, -0.012]} scale={[rx, 0.3, rz]} castShadow />
          <Blob m={hair} p={[rx * 0.3, ry * 0.68, rz * 0.42]} r={[rx * 0.72, ry * 0.3, rz * 0.5]} rot={[0.25, 0, -0.35]} />
        </group>
      )
    case 'headwrap': {
      const fabric = wax(l.outfitColor, l.pattern)
      return (
        <group position={[0, 0.03, -0.015]} rotation={[-0.3, 0, 0]}>
          <Part g={geo('wrap', () => new THREE.CylinderGeometry(1.25, 1.02, 1, 32))} m={fabric} p={[0, ry * 0.55, 0]} s={[rx, ry * 0.95, rz]} />
          <Blob m={fabric} p={[0, ry * 1.05, 0]} r={[rx * 1.25, ry * 0.4, rz * 1.25]} />
          <Blob m={fabric} p={[rx * 0.3, ry * 1.28, rz * 0.6]} r={[rx * 0.55, ry * 0.36, rz * 0.3]} rot={[0, 0, 0.55]} />
          <Blob m={fabric} p={[-rx * 0.38, ry * 1.22, rz * 0.66]} r={[rx * 0.46, ry * 0.32, rz * 0.26]} rot={[0, 0, -0.65]} />
        </group>
      )
    }
    default:
      return short
  }
}

// Beards are shells over the jaw: they follow the face and fade at their edge.
const goatee = (ux: number, uy: number, uz: number) => 0.012 * smooth(0.3, 0.2, Math.abs(ux)) * smooth(-0.7, -0.8, uy) * smooth(-0.1, 0.2, uz) - 0.003
const fullBeard = (ux: number, uy: number, uz: number) => {
  const az = Math.abs(Math.atan2(ux, uz)) // 0 = chin front, π/2 = ear
  const top = -0.36 + 0.36 * smooth(0.6, 1.4, az) // up the cheeks to the sideburns
  const mouth = smooth(-0.74, -0.64, uy) * smooth(0.36, 0.26, Math.abs(ux)) * smooth(0.3, 0.5, uz)
  return 0.012 * smooth(top + 0.04, top - 0.12, uy) * smooth(-0.35, -0.1, uz) * (1 - mouth) - 0.003
}

function Beard({ l }: { l: Required<Look> }) {
  const hair = mat(tint(l.hairColor, 0.07))
  const moustache = <Part g={arc(0.03, 0.0075, 2.6)} m={hair} p={[0, -0.063, faceZ(0, -0.06) + 0.004]} s={[1, 0.5, 0.6]} />
  switch (l.beard) {
    case 'moustache':
      return moustache
    case 'bouc':
      return (
        <group>
          {moustache}
          <Part g={headShell('goatee', goatee)} m={hair} />
        </group>
      )
    case 'full':
      return (
        <group>
          {moustache}
          <Part g={headShell('beard', fullBeard)} m={hair} />
        </group>
      )
    default:
      return null
  }
}

function HeadAccessory({ l }: { l: Required<Look> }) {
  const [rx, ry, rz] = HEAD
  const color = l.accessoryColor || defaultColors(l, false).accessory
  const gold = mat(color, { shine: true })
  switch (l.accessory) {
    case 'glasses': {
      const frame = flat(color)
      return (
        <group position={[0, 0.0, faceZ(0.047, 0) + 0.012]}>
          {[-1, 1].map((s) => (
            <mesh key={s} geometry={geo('lens', () => new THREE.TorusGeometry(0.03, 0.004, 8, 24))} material={frame} position={[s * 0.047, 0, 0]} />
          ))}
          <Part g={geo('bridge', () => new THREE.CylinderGeometry(0.003, 0.003, 0.03, 6))} m={frame} p={[0, 0.006, 0.004]} r={[0, 0, Math.PI / 2]} />
          {/* Arms from the outer rims back over the ears */}
          {[-1, 1].map((s) => (
            <group key={s} position={[s * (rx * 0.84), 0.005, -0.06]} rotation={[0, -s * 0.36, 0]}>
              <Part g={geo('temple', () => new THREE.CylinderGeometry(0.003, 0.003, 0.128, 6))} m={frame} r={[Math.PI / 2, 0, 0]} />
            </group>
          ))}
        </group>
      )
    }
    case 'earrings':
      return (
        <>
          {[-1, 1].map((s) => (
            <mesh key={s} geometry={geo('hoop', () => new THREE.TorusGeometry(0.019, 0.003, 8, 24))} material={gold} position={[s * rx * 1.0, -0.058, -0.004]} rotation={[0, Math.PI / 2, 0]} />
          ))}
        </>
      )
    case 'cap':
    case 'capback': {
      const c = color
      const back = l.accessory === 'capback'
      return (
        <group position={[0, 0.03, -0.004]} rotation={back ? [0.1, Math.PI, 0] : [-0.14, 0, 0]}>
          <mesh geometry={geo('capdome', () => new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5))} material={mat(c)} scale={[rx * 1.1, ry * 1.04, rz * 1.1]} castShadow />
          <Blob m={mat(tint(c, -0.25))} p={[0, 0.002, rz * 1.12]} r={[rx * 0.82, 0.008, rz * 0.62]} />
          <Blob m={mat(tint(c, -0.25))} p={[0, ry * 1.04, 0]} r={[0.012, 0.008, 0.012]} />
        </group>
      )
    }
    default:
      return null
  }
}

/* ---------- Feet ---------- */

function ShoeMesh({ shoe, skin }: { shoe: Shoe; skin: THREE.Material }) {
  const upper = mat(shoe.color)
  const sole = mat(shoe.kind === 'sneaker' ? '#ffffff' : '#2a1c12')
  if (shoe.kind === 'slide')
    // Claquettes: a thick sole and one wide strap over bare toes.
    return (
      <group>
        <Blob m={skin} p={[0, 0.034, 0.035]} r={[0.042, 0.026, 0.088]} />
        <Blob m={mat(tint(shoe.color, -0.15))} p={[0, 0.012, 0.035]} r={[0.052, 0.014, 0.104]} />
        <Blob m={upper} p={[0, 0.042, 0.04]} r={[0.05, 0.022, 0.042]} />
        <Blob m={mat('#f8f9fa')} p={[0, 0.058, 0.046]} r={[0.018, 0.006, 0.02]} />
      </group>
    )
  if (shoe.kind === 'sandal')
    return (
      <group>
        <Blob m={skin} p={[0, 0.03, 0.035]} r={[0.042, 0.028, 0.085]} />
        <Blob m={sole} p={[0, 0.008, 0.035]} r={[0.05, 0.008, 0.1]} />
        <Blob m={upper} p={[0, 0.04, 0.06]} r={[0.046, 0.012, 0.022]} />
      </group>
    )
  return (
    <group>
      <Blob m={sole} p={[0, 0.012, 0.035]} r={[0.05, 0.012, 0.105]} />
      <Blob m={upper} p={[0, shoe.kind === 'heel' ? 0.05 : 0.038, 0.035]} r={[0.047, shoe.kind === 'boot' ? 0.05 : 0.036, 0.1]} />
      {shoe.kind === 'heel' && <Part g={limb(0.008, 0.006, 0.05)} m={sole} p={[0, 0.055, -0.045]} />}
      {shoe.kind === 'sneaker' && <Blob m={mat('#ff7a00')} p={[0.047, 0.04, 0.03]} r={[0.004, 0.015, 0.055]} />}
    </group>
  )
}

/* ---------- The whole Sim ---------- */

type Props = { look: Look; gender: Sim['gender']; pose?: Pose; seed?: number; /** Children have bigger heads for their size (1 = adult). */ headScale?: number; /** Walking speed (m/s): the steps follow it. */ speed?: number }

/**
 * A person, in full detail up close, and as a simple figure (LowHuman) past
 * FAR metres from the camera, where the detail can't be seen anyway. The
 * switch has some slack so nobody flickers between the two at the border.
 */
const FAR = 24
export function Human(props: Props & { /** Always in full detail (the creator, close-ups). */ full?: boolean }) {
  const anchor = useRef<THREE.Group>(null)
  const [far, setFar] = useState(false)
  const at = useRef(new THREE.Vector3())
  useFrame(({ camera }) => {
    if (props.full || !anchor.current) return
    const d = anchor.current.getWorldPosition(at.current).distanceTo(camera.position)
    if (!far && d > FAR + 3) setFar(true)
    else if (far && d < FAR - 3) setFar(false)
  })
  return <group ref={anchor}>{far && !props.full ? <LowHuman look={props.look} gender={props.gender} pose={props.pose} seed={props.seed} speed={props.speed} /> : <FullHuman {...props} />}</group>
}

function FullHuman({ look, gender, pose = 'idle', seed = 0, headScale = 1, speed }: Props) {
  const young = headScale > 1
  const l = young ? { ...fullLook(look), beard: 'none', accessory: 'none' } : fullLook(look)
  const femme = gender === 'femme'
  const { w, limb: lw, belly } = BODY[l.body] ?? BODY.moyen
  const skin = mat(l.skin)
  const d = useMemo(() => dressFor(l, femme), [l.outfit, l.outfitColor, l.bottomColor, l.shoeColor, l.accessoryColor, l.pattern, femme]) // eslint-disable-line react-hooks/exhaustive-deps

  const root = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const hip = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)]
  const knee = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)]
  const shoulder = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)]
  const elbow = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)]
  const chest = useRef<THREE.Group>(null)

  // The walk's phase, carried on frame to frame so the stride can change
  // pace without a jump; where the eyes look, changing now and then.
  const phase = useRef(seed * 3)
  const glance = useRef({ y: 0, x: 0, next: 0 })
  useFrame(({ clock }, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1)
    const t = clock.elapsedTime + seed
    const run = pose === 'run'
    const walk = pose === 'walk' || run
    const seated = SEATED.includes(pose)
    // Steps follow the speed: cadence and stride grow with it, so feet don't slide.
    const v = speed ?? (run ? 8 : 1.4)
    const cadence = run ? 1.5 + v * 0.07 : Math.min(2.1, 0.85 + v * 0.3)
    phase.current += dt * Math.PI * 2 * cadence
    const ph = phase.current
    const s = Math.sin(ph)
    const stride = run ? 0.95 : Math.min(0.62, 0.3 + v * 0.09)
    // Every joint eases to where it should be: no jump from one pose to the next.
    const a = 1 - Math.exp(-14 * dt)
    const to = (o: THREE.Euler | THREE.Vector3, k: 'x' | 'y' | 'z', target: number) => void (o[k] += (target - o[k]) * a)
    // Standing: the weight goes from one leg to the other, slowly.
    const shift = Math.sin(t * 0.35 + seed)
    for (const i of [0, 1]) {
      const out = i === 0 ? -1 : 1 // -1 = left side (-X)
      const swing = walk ? s * stride * out : 0
      const h = hip[i].current!
      const kn = knee[i].current!
      to(h.rotation, 'x', seated ? -1.5 : walk ? swing : 0)
      to(h.rotation, 'z', walk || seated ? 0 : out * shift * 0.03)
      // The knee bends as the leg swings through, and a little on the standing leg.
      const lift = Math.max(0, Math.sin(ph + (out > 0 ? Math.PI : 0) + 0.6))
      to(kn.rotation, 'x', seated ? 1.5 : walk ? 0.08 + lift * (run ? 1.55 : 0.75) : Math.max(0, -out * shift) * 0.12)
      const sh = shoulder[i].current!
      const el = elbow[i].current!
      let [sx, sy, sz, ex, ez] = [0, 0, out * 0.1, -0.12, 0]
      if (pose === 'dance') {
        // Coupé-décalé: arms pumping in turn, one up, one down.
        const beat = Math.sin(t * 7 + i * Math.PI)
        ;[sx, sz, ex] = [-0.6 - beat * 0.5, out * (0.5 + beat * 0.3), -1.2 + beat * 0.4]
      } else if (pose === 'cheer') {
        ;[sx, sz, ex] = [0, out * (2.7 + Math.sin(t * 10 + i) * 0.15), 0]
      } else if (pose === 'busy') {
        ;[sx, sz, ex] = [-1.1 + Math.sin(t * 6 + i) * 0.25, out * 0.15, -0.9 + Math.sin(t * 6 + i) * 0.2]
      } else if (pose === 'wave' && out > 0) {
        ;[sx, sz, ex, ez] = [0, 2.6, 0, 0.35 + Math.sin(t * 9) * 0.35]
      } else if ((pose === 'eat' || pose === 'drink') && out > 0) {
        // Fork (or bottle) to the mouth, and back to the plate.
        const k = Math.max(0, Math.sin(t * (pose === 'eat' ? 2.4 : 1.2)))
        ;[sx, sz, ex] = [-0.6 - k * 0.75, 0.12, -0.9 - k * 1.1]
      } else if (pose === 'write' || ((pose === 'eat' || pose === 'drink') && out < 0)) {
        // Forearms on the table.
        ;[sx, sz, ex] = [-0.55, out * 0.1, -1.0 + (pose === 'write' && out > 0 ? Math.sin(t * 7) * 0.08 : 0)]
      } else if (pose === 'throw' && out > 0) {
        // Flicking banknotes, one after the other.
        const k = (t * 2.2) % 1
        ;[sx, sz, ex] = [-1.6 - Math.sin(k * Math.PI) * 0.9, 0.35, -0.6 + Math.sin(k * Math.PI) * 0.5]
      } else if (pose === 'throw') {
        // The wad of notes held up in the other hand.
        ;[sx, sz, ex] = [-0.9, -0.25, -1.3]
      } else if (pose === 'hug') {
        // Arms around the other one, swaying a little.
        ;[sx, sz, ex] = [-1.25, out * -0.35, -0.9 + Math.sin(t * 1.3 + i) * 0.05]
      } else if (pose === 'beg' && out > 0) {
        // A hand held out at the car window.
        ;[sx, sz, ex] = [-1.05 + Math.sin(t * 2) * 0.05, 0.1, -0.35]
      } else if (pose === 'rant') {
        // Talking to nobody, arms going.
        const g = Math.sin(t * 4.5 + i * 2.1)
        ;[sx, sz, ex] = [-0.7 - g * 0.6, out * (0.3 + Math.max(0, g) * 0.6), -0.8 + g * 0.3]
      } else if (pose === 'talk') {
        // Talking with someone: one hand making the point, now and then.
        const g = Math.max(0, Math.sin(t * 2.6 + i * 1.7))
        ;[sx, sz, ex] = [-0.25 - g * 0.55 * (out > 0 ? 1 : 0.4), out * 0.14, -0.5 - g * 0.6]
      } else if (pose === 'hero' && out > 0) {
        ;[sx, sz, ex, ez] = [0.15, 0.6, -0.35, -1.75]
      } else if (run) {
        // Arms bent, pumping against the legs.
        ;[sx, sz, ex] = [-swing * 0.9, out * 0.12, -1.45]
      } else if (walk) {
        // Arms swing against the legs, elbows bending more on the way forward.
        ;[sx, sz, ex] = [-swing * 0.75, out * 0.09, -0.25 - Math.max(0, -swing * out) * 0.5]
      } else {
        // Standing: arms hanging loose, breathing.
        ;[sx, sz, ex] = [Math.sin(t * 1.2 + i) * 0.03, out * (0.1 + Math.max(0, out * shift) * 0.03), -0.14]
      }
      to(sh.rotation, 'x', sx)
      to(sh.rotation, 'y', sy)
      to(sh.rotation, 'z', sz)
      to(el.rotation, 'x', ex)
      to(el.rotation, 'z', ez)
    }
    const r = root.current!
    to(
      r.position,
      'y',
      seated
        ? -SEAT_DROP
        : run
          ? Math.abs(Math.cos(ph)) * 0.09
          : walk
            ? Math.abs(Math.cos(ph)) * (0.015 + stride * 0.035)
            : pose === 'busy'
              ? Math.abs(Math.sin(t * 6)) * 0.02
              : pose === 'dance'
                ? Math.abs(Math.sin(t * 7)) * 0.06
                : pose === 'cheer'
                  ? Math.max(0, Math.sin(t * 5)) * 0.18
                  : Math.sin(t * 1.6) * 0.003 - Math.abs(shift) * 0.006,
    )
    // Standing, the hips sit over one leg then the other.
    to(r.position, 'x', walk || seated ? 0 : shift * 0.018)
    // Breathing: the chest rises a little (faster after running).
    if (chest.current) {
      const b = Math.sin(t * (pose === 'run' ? 4.5 : 1.7))
      chest.current.scale.set(1 + b * 0.006, 1, 1 + b * (pose === 'run' ? 0.025 : 0.014))
      // Walking, the shoulders turn against the hips.
      to(chest.current.rotation, 'y', walk ? -s * stride * 0.22 : 0)
    }
    // Leaning into the run; the hips sway with the steps, or with the weight.
    to(r.rotation, 'x', run ? 0.16 : walk ? 0.03 : 0)
    to(r.rotation, 'z', walk ? Math.cos(ph) * 0.035 * stride : seated ? 0 : -shift * 0.02)
    to(r.rotation, 'y', pose === 'dance' ? Math.sin(t * 3.5) * 0.35 : pose === 'rant' ? Math.sin(t * 0.9) * 0.5 : pose === 'hug' ? Math.sin(t * 0.8) * 0.06 : walk ? s * stride * 0.12 : 0)
    // The eyes: looking ahead when walking; otherwise a glance here, then there.
    const g = glance.current
    if (t > g.next) {
      const n = Math.sin(t * 12.9898 + seed * 78.233) * 43758.5453
      const rnd = n - Math.floor(n)
      g.y = rnd < 0.5 ? 0 : (rnd - 0.75) * 1.1
      g.x = (rnd * 7) % 1 < 0.3 ? 0.08 : 0
      g.next = t + 1.5 + rnd * 3.5
    }
    const hd = head.current!
    to(hd.rotation, 'y', walk ? -s * stride * 0.1 : pose === 'rant' ? Math.sin(t * 2.3) * 0.45 : pose === 'talk' ? Math.sin(t * 0.9) * 0.12 : g.y)
    to(hd.rotation, 'z', pose === 'wave' ? 0.08 : pose === 'talk' ? Math.sin(t * 1.3) * 0.05 : 0)
    to(hd.rotation, 'x', pose === 'busy' || pose === 'write' ? 0.25 : pose === 'eat' ? 0.1 : pose === 'drink' ? -0.15 : pose === 'hug' ? 0.15 : pose === 'beg' ? 0.12 : walk ? 0.02 : g.x + Math.sin(t * 0.7) * 0.02)
  })

  const body: Body = { femme, w, belly }
  const hipX = 0.082 * w
  const shX = (femme ? 0.158 : 0.176) * w
  const thighR = 0.072 * lw * (femme ? 1.06 : 1)
  const skinOr = (m: THREE.Material | null) => m ?? skin
  const fabric = d.robe ?? d.top
  const longSleeve = d.sleeve === 'long'
  const waist = torsoAt(femme, w, belly, d.skirt ? 1.0 : WAIST_Y)

  return (
    <group scale={l.height}>
      <group ref={root}>
        {/* Torso, waistband, skirt or robe */}
        <group ref={chest}>
          <Part g={torsoGeometry(femme, w, belly, d.skirt ? 1.0 : WAIST_Y)} m={[d.robe ?? d.bottom, d.tank ? mat('#fff', { map: vestTexture(femme, w, belly, l.outfitColor, l.skin, d.vest) }) : fabric]} />
        </group>
        {d.belt && (
          <group>
            <Part g={bandGeometry(femme, w, belly, WAIST_Y + 0.004, 0.012)} m={d.belt} />
            <Blob m={mat('#c9b27a', { shine: true })} p={[0, WAIST_Y + 0.004, waist.front * 1.02 + 0.008]} r={[0.018, 0.012, 0.006]} />
          </group>
        )}
        {d.waistband && (
          <group>
            <Part g={bandGeometry(femme, w, belly, WAIST_Y + 0.006, 0.016)} m={d.waistband.m} />
            {[-1, 1].map((s) => (
              <Blob key={s} m={d.waistband!.cords} p={[s * 0.012, WAIST_Y - 0.03, waist.front * 1.02 + 0.012]} r={[0.0032, 0.03, 0.0032]} rot={[0, 0, s * 0.12]} />
            ))}
          </group>
        )}
        {d.robe && <Part g={flare(0.17 * w, 0.31 * w, 1.33, 0.06, 0.72)} m={d.robe} />}
        {d.skirt && <Part g={skirtGeometry(femme, w, belly, d.skirt.hem, d.skirt.r * w)} m={d.skirt.m} />}
        {d.skirt?.band && <Part g={bandGeometry(femme, w, belly, 1.0, 0.012, 1.03)} m={d.skirt.band} />}
        {d.extra?.(body)}

        {/* Neck and head */}
        <Part g={limb(0.045, 0.05, 0.08)} m={skin} p={[0, 1.42, 0]} />
        {l.accessory === 'chain' && <mesh geometry={geo('chain', () => new THREE.TorusGeometry(0.068, 0.005, 6, 28))} material={mat(l.accessoryColor || '#e8b93c', { shine: true })} position={[0, 1.335, 0.035]} rotation={[1.15, 0, 0]} scale={[w, 1.1, 1]} />}
        <group ref={head} position={[0, HEAD_Y + (headScale - 1) * 0.1, 0.008]} scale={headScale}>
          <Face l={l} femme={femme} skin={skin} seed={seed} />
        </group>

        {/* Legs: hip → knee → foot */}
        {[0, 1].map((i) => {
          const side = i === 0 ? -1 : 1
          return (
            <group key={i} ref={hip[i]} position={[side * hipX, HIP_Y, 0]}>
              <Part g={limb(thighR, 0.054 * lw, THIGH)} m={d.stripes ? striped(d.stripes.bottom, d.stripes.color, side) : skinOr(d.thigh)} />
              {d.shorts && (
                <group>
                  <Part g={shortSleeve(thighR * (d.shorts.long ? 1.15 : 1.1), d.shorts.long ? 0.31 : 0.17)} m={d.shorts.m} />
                  <Blob m={d.shorts.stripe} p={[side * thighR * (d.shorts.long ? 1.15 : 1.1), d.shorts.long ? -0.15 : -0.08, 0]} r={[0.005, d.shorts.long ? 0.15 : 0.085, 0.012]} rot={[0, 0, -side * 0.08]} />
                </group>
              )}
              <group ref={knee[i]} position={[0, -THIGH, 0]}>
                {d.cuffs && <Part g={limb(0.045 * lw, 0.045 * lw, 0.03)} m={d.cuffs} p={[0, -SHIN + 0.075, 0]} />}
                <Part g={limb(0.054 * lw, 0.04 * lw, SHIN - 0.04)} m={d.stripes ? striped(d.stripes.bottom, d.stripes.color, side) : skinOr(d.shin)} />
                {!d.shin && !d.skirt && side < 0 && (l.marks === 'genou' || l.marks === 'bagarre') && <Part g={limb(0.059 * lw, 0.057 * lw, 0.05)} m={mat('#f4f1ea')} p={[0, 0.02, 0]} />}
                {l.outfit === 'jersey' && <Part g={limb(0.05 * lw, 0.045 * lw, 0.14)} m={mat('#009a44')} p={[0, -0.17, 0]} />}
                <group position={[0, -SHIN - 0.01, 0]}>
                  <ShoeMesh shoe={d.shoe} skin={skin} />
                </group>
              </group>
            </group>
          )
        })}

        {/* Arms: shoulder → elbow → hand */}
        {[0, 1].map((i) => {
          const side = i === 0 ? -1 : 1
          return (
            <group key={i} ref={shoulder[i]} position={[side * shX, SHOULDER_Y, 0]} rotation={[0, 0, side * 0.1]}>
              <Part g={limb((d.sleeve === 'short' ? 0.044 : 0.05) * lw, 0.04 * lw, UPPER_ARM)} m={d.stripes ? striped(d.stripes.top, d.stripes.color, side) : longSleeve ? fabric : skin} />
              {d.sleeve === 'short' && <Part g={shortSleeve(0.056 * lw, 0.13)} m={fabric} />}
              {d.sleeve === 'none' && !d.tank && <Blob m={fabric} p={[0, 0.012, 0]} r={[0.05 * lw, 0.034, 0.05 * lw]} />}
              {d.sleeve === 'bell' && <Part g={geo('bell1', () => new THREE.CylinderGeometry(0.06, 0.11, 1, 20, 1, true).translate(0, -0.5, 0))} m={fabric} s={[lw, UPPER_ARM + 0.02, lw]} />}
              {d.sleeve === 'bell' && <Blob m={fabric} p={[0, 0, 0]} r={[0.062 * lw, 0.05, 0.062 * lw]} />}
              <group ref={elbow[i]} position={[0, -UPPER_ARM, 0]}>
                <Part g={limb(0.04 * lw, 0.033 * lw, FOREARM)} m={d.stripes ? striped(d.stripes.top, d.stripes.color, side) : longSleeve ? fabric : skin} />
                {longSleeve && <Part g={limb(0.036 * lw, 0.036 * lw, 0.012)} m={d.cuffs ?? mat('#f8f9fa')} p={[0, -FOREARM + 0.012, 0]} />}
                {d.sleeve === 'bell' && <Part g={geo('bell2', () => new THREE.CylinderGeometry(0.11, 0.17, 1, 20, 1, true).translate(0, -0.5, 0))} m={fabric} p={[0, 0.01, 0]} s={[lw, 0.16, lw]} />}
                {!longSleeve && d.sleeve !== 'bell' && side > 0 && (l.marks === 'griffures' || l.marks === 'bagarre') && <Scratches p={[0, -0.1, 0.036 * lw]} />}
                {/* The hand: a palm, four fingers a little curled, the thumb */}
                <Blob m={skin} p={[0, -FOREARM - 0.035, 0.004]} r={[0.028, 0.034, 0.018]} />
                {[-1.5, -0.5, 0.5, 1.5].map((f) => (
                  <Part key={f} g={limb(0.0072, 0.0062, 0.042 - Math.abs(f) * 0.005)} m={skin} p={[f * 0.0118, -FOREARM - 0.062, 0.006]} r={[0.22, 0, f * 0.05]} />
                ))}
                <Part g={limb(0.0085, 0.007, 0.03)} m={skin} p={[side * -0.024, -FOREARM - 0.03, 0.012]} r={[0.3, 0, side * 0.55]} />
              </group>
            </group>
          )
        })}
      </group>
    </group>
  )
}

/* ---------- A baby ---------- */

/**
 * A baby: a big head with a tuft of hair, a onesie and a nappy, short arms and
 * legs. Sits and babbles when still, crawls when it moves, claps when busy.
 */
export function Baby({ look, gender, pose = 'idle', seed = 0 }: Props) {
  const full = fullLook(look)
  const l: Required<Look> = { ...full, hair: full.hair === 'bald' ? 'bald' : 'short', beard: 'none', accessory: 'none', marks: 'none' }
  const skin = mat(l.skin)
  const onesie = mat(BABY_COLORS[Math.abs(Math.round(seed * 7)) % BABY_COLORS.length] ?? '#bde0fe')
  const nappy = mat('#f8f9fa')
  const root = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const arms = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)]
  const legs = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)]
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed
    const crawl = pose === 'walk'
    // On all fours to crawl; sitting up otherwise.
    root.current!.rotation.x = crawl ? 1.05 : 0
    root.current!.position.y = crawl ? 0.17 + Math.abs(Math.sin(t * 6)) * 0.01 : 0
    root.current!.position.z = crawl ? -0.12 : 0
    head.current!.rotation.x = crawl ? -0.9 : Math.sin(t * 1.3) * 0.08
    head.current!.rotation.z = crawl ? 0 : Math.sin(t * 0.9) * 0.1
    for (const i of [0, 1]) {
      const out = i === 0 ? -1 : 1
      const a = arms[i].current!
      const g = legs[i].current!
      if (crawl) {
        const step = Math.sin(t * 6 + i * Math.PI)
        a.rotation.set(-1.25 + step * 0.35, 0, 0)
        g.rotation.set(-0.25 - step * 0.3, 0, 0)
      } else if (pose === 'busy') {
        a.rotation.set(-1.2, 0, -out * (0.45 + Math.max(0, Math.sin(t * 9)) * 0.35))
        g.rotation.set(-1.45, 0, out * 0.25)
      } else {
        a.rotation.set(-0.5 + Math.sin(t * 2 + i * 2) * 0.35, 0, out * 0.25)
        g.rotation.set(-1.45, 0, out * 0.3)
      }
    }
  })
  return (
    <group ref={root}>
      {/* Body in a onesie, and the nappy */}
      <Blob m={onesie} p={[0, 0.24, 0]} r={[0.12, 0.14, 0.105]} />
      <Blob m={nappy} p={[0, 0.12, -0.005]} r={[0.115, 0.075, 0.1]} />
      {/* Legs: chubby, sticking out in front when sitting */}
      {[0, 1].map((i) => (
        <group key={i} ref={legs[i]} position={[(i ? 1 : -1) * 0.06, 0.1, 0]}>
          <Part g={limb(0.045, 0.038, 0.17)} m={onesie} />
          <Blob m={skin} p={[0, -0.18, 0.02]} r={[0.032, 0.026, 0.045]} />
        </group>
      ))}
      {/* Arms */}
      {[0, 1].map((i) => (
        <group key={i} ref={arms[i]} position={[(i ? 1 : -1) * 0.115, 0.31, 0]}>
          <Part g={limb(0.035, 0.03, 0.15)} m={onesie} />
          <Blob m={skin} p={[0, -0.165, 0]} r={[0.03, 0.03, 0.03]} />
        </group>
      ))}
      {/* A big head, the same face as the grown-up Sim will have */}
      <group ref={head} position={[0, 0.5, 0.01]} scale={1.05}>
        <Face l={l} femme={gender === 'femme'} skin={skin} />
      </group>
    </group>
  )
}
const BABY_COLORS = ['#bde0fe', '#ffc8dd', '#cdeac0', '#fff1a8', '#e2cfea']
