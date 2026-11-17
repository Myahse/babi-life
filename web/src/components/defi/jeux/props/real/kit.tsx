import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { BevelBoxGeometry, chamferOf } from '../../../../../world3d/bevel'
import type { MiniTier } from '../../../../../world3d/minijeux'
import { propAtlas, tileRect, TILE } from './atlas'

// « Mini-jeux réalistes », phase 2: how a realistic prop is made. A recipe calls the builder (boxes
// chamfered like the concept's blocks, a few faceted round things), each part with its colour and the
// atlas tile that paints it; the builder merges it all into one geometry (vertex colours × the atlas),
// so a whole prop, a whole plate of garba, is one draw call, glass and glowing screens a second and a
// third. Built once per prop and per tier, shared by every copy, freed when the last one goes.

export type V = [number, number, number]
/** What the tier lets a recipe draw: `lo` the small phones (the fine bits left out), `hi` the strong ones (more of them). */
export type Q = { lo: boolean; hi: boolean }

/** Texels of the atlas per scene unit on the props' detail tiles (a prop is about a unit: ~40 texels across). */
const TPU = 40

type Part = { g: THREE.BufferGeometry; c: string; tile: string; fit: boolean }
type Opt = { r?: V; tile?: string; /** The tile stretched over each face whole (a label, a screen) instead of at the texel density. */ fit?: boolean; s?: V }

const tmpM = new THREE.Matrix4()
const tmpQ = new THREE.Quaternion()
const tmpE = new THREE.Euler()
const tmpS = new THREE.Vector3()
const tmpP = new THREE.Vector3()

export class Builder {
  solid: Part[] = []
  glass: Part[] = []
  glow: Part[] = []
  private layer: Part[] = this.solid
  /** Draws what follows on see-through glass, on glowing screens, or back on the solid. */
  on(layer: 'solid' | 'glass' | 'glow') {
    this.layer = this[layer]
    return this
  }
  private add(g: THREE.BufferGeometry, p: V, c: string, o: Opt, spans: (g: THREE.BufferGeometry) => void) {
    if (!o.fit) spans(g)
    tmpM.compose(tmpP.set(...p), tmpQ.setFromEuler(tmpE.set(...(o.r ?? [0, 0, 0]))), tmpS.set(...(o.s ?? [1, 1, 1])))
    g.applyMatrix4(tmpM)
    this.layer.push({ g, c, tile: o.tile ?? 'plain', fit: !!o.fit })
    return this
  }
  /** A chamfered block w × h × d centred on p. */
  box(p: V, s: V, c: string, o: Opt & { bevel?: number } = {}) {
    const [w, h, d] = s
    const g = Math.min(w, h, d) < 0.012 ? new THREE.BoxGeometry(w, h, d) : new BevelBoxGeometry(w, h, d, o.bevel ?? chamferOf(w, h, d) * 1.6)
    return this.add(g, p, c, o, (g) => {
      // Each face at the texel density: its own width and height in units.
      const uv = g.attributes.uv as THREE.BufferAttribute
      const faces = g.userData.faces as Uint8Array | undefined
      const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]
      for (let k = 0; k < uv.count; k++) {
        const f = faces ? faces[k] : Math.floor(k / 4)
        const [fu, fv] = dims[f]
        uv.setXY(k, uv.getX(k) * fu, uv.getY(k) * fv)
      }
    })
  }
  /** A faceted cylinder (or a frustum with `top`), on its axis y. `open`: no caps. */
  cyl(p: V, r: number, h: number, c: string, o: Opt & { top?: number; seg?: number; open?: boolean; arc?: number } = {}) {
    const top = o.top ?? r
    const g = new THREE.CylinderGeometry(top, r, h, o.seg ?? 12, 1, !!o.open, 0, o.arc ?? Math.PI * 2)
    return this.add(g, p, c, o, (g) => scaleUV(g, Math.PI * 2 * Math.max(r, top), h, Math.max(r, top) * 2))
  }
  /** A faceted ball (`s` squashes it into an egg, a mango, a fish's body). `half`: the top half only. */
  ball(p: V, r: number, c: string, o: Opt & { seg?: number; half?: boolean } = {}) {
    const seg = o.seg ?? 10
    const g = o.half ? new THREE.SphereGeometry(r, seg, Math.max(3, seg >> 1), 0, Math.PI * 2, 0, Math.PI / 2) : new THREE.SphereGeometry(r, seg, Math.max(4, seg - 2))
    return this.add(g, p, c, o, (g) => scaleUV(g, Math.PI * 2 * r, Math.PI * r))
  }
  cone(p: V, r: number, h: number, c: string, o: Opt & { seg?: number } = {}) {
    const g = new THREE.ConeGeometry(r, h, o.seg ?? 8)
    return this.add(g, p, c, o, (g) => scaleUV(g, Math.PI * 2 * r, h, r * 2))
  }
  /** A ring lying flat (its hole up), radius R, thickness t. */
  ring(p: V, R: number, t: number, c: string, o: Opt & { arc?: number; seg?: number } = {}) {
    const g = new THREE.TorusGeometry(R, t, 5, o.seg ?? 14, o.arc ?? Math.PI * 2)
    g.rotateX(-Math.PI / 2)
    return this.add(g, p, c, o, (g) => scaleUV(g, Math.PI * 2 * R, Math.PI * 2 * t))
  }
  /** A turned shape (a bowl, a pot, a bottle): its profile [radius, height] from the bottom up. */
  lathe(p: V, profile: [number, number][], c: string, o: Opt & { seg?: number } = {}) {
    const g = new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), o.seg ?? 14)
    let len = 0
    for (let i = 1; i < profile.length; i++) len += Math.hypot(profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1])
    const R = Math.max(...profile.map(([x]) => x))
    return this.add(g, p, c, o, (g) => scaleUV(g, Math.PI * 2 * R, len))
  }
  /** A flat disc lying face up (a plate's well, a sauce, a liquid's top). */
  disc(p: V, r: number, c: string, o: Opt & { seg?: number } = {}) {
    const g = new THREE.CircleGeometry(r, o.seg ?? 14)
    g.rotateX(-Math.PI / 2)
    return this.add(g, p, c, o, (g) => scaleUV(g, r * 2, r * 2))
  }
}

/** UVs (0..1 over the shape) scaled to the shape's size in units; a cylinder's caps (groups 1, 2) by `cap`. */
function scaleUV(g: THREE.BufferGeometry, su: number, sv: number, cap?: number) {
  const uv = g.attributes.uv as THREE.BufferAttribute
  const capStart = cap !== undefined && g.groups.length > 1 ? g.groups[1].start : Infinity
  const idx = g.index
  if (idx && capStart !== Infinity) {
    // Indexed: the caps' vertices are those the cap groups' indices name.
    const isCap = new Uint8Array(uv.count)
    for (let k = capStart; k < idx.count; k++) isCap[idx.getX(k)] = 1
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * (isCap[k] ? cap! : su), uv.getY(k) * (isCap[k] ? cap! : sv))
  } else for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * su, uv.getY(k) * sv)
}

/** A hash of a string, for each part's place in its tile (so two plates don't show the same grains). */
const seedOf = (k: number) => {
  const s = Math.sin(k * 91.7) * 4375.85
  return s - Math.floor(s)
}

const tmpC = new THREE.Color()
/** The parts of one layer merged: every vertex its colour, its uv inside its tile. */
function merge(parts: Part[]): THREE.BufferGeometry | null {
  if (!parts.length) return null
  const geos = parts.map((pt, i) => {
    const g = pt.g.index ? pt.g.toNonIndexed() : pt.g
    if (g !== pt.g) pt.g.dispose()
    g.clearGroups()
    delete g.userData.faces
    const n = g.attributes.position.count
    const uv = g.attributes.uv as THREE.BufferAttribute
    const [u0, v0, size] = tileRect(pt.tile)
    // Detail tiles: the uv in tiles (units × TPU texels), wrapped in the shader (mirrored, no seam); pictures: the face whole.
    const span = TILE / TPU
    const ou = seedOf(i + 1)
    const ov = seedOf(i + 7)
    for (let k = 0; k < n; k++) {
      if (pt.fit) uv.setXY(k, Math.min(1, Math.max(0, uv.getX(k))), Math.min(1, Math.max(0, uv.getY(k))))
      else uv.setXY(k, uv.getX(k) / span + ou, uv.getY(k) / span + ov)
    }
    const tr = new Float32Array(n * 3)
    for (let k = 0; k < n; k++) tr.set([u0, v0, size], k * 3)
    g.setAttribute('tileR', new THREE.BufferAttribute(tr, 3))
    tmpC.set(pt.c)
    const col = new Float32Array(n * 3)
    for (let k = 0; k < n; k++) col.set([tmpC.r, tmpC.g, tmpC.b], k * 3)
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color', 'tileR'].includes(name)) g.deleteAttribute(name)
    return g
  })
  const out = mergeGeometries(geos, false)
  geos.forEach((g) => g.dispose())
  out?.computeBoundingSphere()
  return out
}
/* ---------- The shared materials ---------- */

/** Each vertex knows its tile (tileR: corner u, v and size); its uv, in tiles, is wrapped there per pixel, mirrored so it has no seam. */
function tiled<M extends THREE.Material>(m: M): M {
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 tileR;\nvarying vec3 rpTile;').replace('#include <begin_vertex>', '#include <begin_vertex>\nrpTile = tileR;')
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 rpTile;').replace('#include <map_fragment>', '#ifdef USE_MAP\n  diffuseColor *= texture2D( map, rpTile.xy + ( 1.0 - abs( mod( vMapUv, 2.0 ) - 1.0 ) ) * rpTile.z );\n#endif')
  }
  m.customProgramCacheKey = () => 'realprop1'
  // A copy (an engine heating its object's own material) keeps the wrapping.
  const clone = m.clone.bind(m)
  m.clone = () => tiled(clone() as M)
  return m
}

type Mats = { solid: THREE.Material; glass: THREE.Material; glow: THREE.Material }
const mats = new Map<string, Mats>()
/** The three materials every realistic prop shares (two-sided: a bowl, a bucket, a pan are turned shells seen from inside), per tier (made once, kept: one atlas). « simple »: Lambert; above, standard ones the scene's sky lights (MiniLook's environment). */
export function propMats(tier: MiniTier): Mats {
  const std = tier === 'normal' || tier === 'haute'
  const key = std ? 'std' : 'lam'
  let m = mats.get(key)
  if (m) return m
  const map = propAtlas()
  m = {
    solid: tiled(std ? new THREE.MeshStandardMaterial({ map, vertexColors: true, flatShading: true, roughness: 0.72, metalness: 0, side: THREE.DoubleSide }) : new THREE.MeshLambertMaterial({ map, vertexColors: true, flatShading: true, side: THREE.DoubleSide })),
    glass: tiled(std ? new THREE.MeshStandardMaterial({ map, vertexColors: true, transparent: true, opacity: 0.42, depthWrite: false, roughness: 0.08, metalness: 0 }) : new THREE.MeshLambertMaterial({ map, vertexColors: true, transparent: true, opacity: 0.42, depthWrite: false })),
    glow: tiled(new THREE.MeshBasicMaterial({ map, vertexColors: true, toneMapped: false })),
  }
  for (const x of Object.values(m)) x.userData.noMini = true
  mats.set(key, m)
  return m
}

/* ---------- Built props, shared and counted ---------- */

export type Recipe = (b: Builder, q: Q) => void
type Made = { solid: THREE.BufferGeometry | null; glass: THREE.BufferGeometry | null; glow: THREE.BufferGeometry | null; users: number }
const built = new Map<string, Made>()

export const qOf = (tier: MiniTier): Q => ({ lo: tier === 'simple', hi: tier === 'haute' })

function take(key: string, recipe: Recipe, q: Q): Made {
  let b = built.get(key)
  if (!b) {
    const k = new Builder()
    recipe(k, q)
    b = { solid: merge(k.solid), glass: merge(k.glass), glow: merge(k.glow), users: 0 }
    built.set(key, b)
  }
  return b
}

/** A recipe drawn: its merged layers, built on first use for this tier, freed when no copy is left. */
export function RealMesh({ id, recipe, tier }: { id: string; recipe: Recipe; tier: MiniTier }) {
  const q = qOf(tier)
  const key = `${id}|${q.lo ? 'l' : q.hi ? 'h' : 'n'}`
  const b = useMemo(() => take(key, recipe, q), [key]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    b.users++
    return () => {
      b.users--
      // Freed a moment later: the next game often shows the same prop again.
      setTimeout(() => {
        if (b.users > 0 || built.get(key) !== b) return
        built.delete(key)
        b.solid?.dispose()
        b.glass?.dispose()
        b.glow?.dispose()
      }, 4000)
    }
  }, [b, key])
  const m = propMats(tier)
  return (
    <>
      {b.solid && <mesh geometry={b.solid} material={m.solid} castShadow receiveShadow />}
      {b.glow && <mesh geometry={b.glow} material={m.glow} />}
      {b.glass && <mesh geometry={b.glass} material={m.glass} renderOrder={1} />}
    </>
  )
}
