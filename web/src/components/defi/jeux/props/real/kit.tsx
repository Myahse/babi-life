import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { BevelBoxGeometry, chamferOf } from '../../../../../world3d/bevel'
import { useMiniTier, type MiniTier } from '../../../../../world3d/minijeux'
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
type Opt = {
  r?: V
  tile?: string
  /** The tile stretched over each face whole (a label, a screen) instead of at the texel density. */ fit?: boolean
  s?: V
  /** A big surface filling much of the screen (a table top, the oil, a floor): plain colour, no texture, on the small phones. */ big?: boolean
}

/** The detail tiles big surfaces are made of: each repeat mirrored its own way and a touch lighter or darker, so a long plank or a wide floor doesn't show the same knot again and again. */
const VARY = new Set(['wood', 'earth', 'sand', 'grass', 'cement', 'straw', 'soot', 'water', 'fabric', 'hide'])

const tmpM = new THREE.Matrix4()
const tmpQ = new THREE.Quaternion()
const tmpE = new THREE.Euler()
const tmpS = new THREE.Vector3()
const tmpP = new THREE.Vector3()
const flatC = new THREE.Color()

export class Builder {
  solid: Part[] = []
  glass: Part[] = []
  glow: Part[] = []
  /** Big surfaces drawn plain on the small phones (no texture read over most of the screen). */
  flat: Part[] = []
  private layer: Part[] = this.solid
  constructor(private lo = false) {}
  /** Draws what follows on see-through glass, on glowing screens, or back on the solid. */
  on(layer: 'solid' | 'glass' | 'glow') {
    this.layer = this[layer]
    return this
  }
  private add(g: THREE.BufferGeometry, p: V, c: string, o: Opt, spans: (g: THREE.BufferGeometry) => void) {
    if (!o.fit) spans(g)
    tmpM.compose(tmpP.set(...p), tmpQ.setFromEuler(tmpE.set(...(o.r ?? [0, 0, 0]))), tmpS.set(...(o.s ?? [1, 1, 1])))
    g.applyMatrix4(tmpM)
    // Plain, it takes the tiles' mean shade (they're light detail around 0.9), so it matches the textured tiers.
    if (o.big && this.lo && this.layer === this.solid) this.flat.push({ g, c: '#' + flatC.set(c).multiplyScalar(0.9).getHexString(), tile: 'plain', fit: true })
    else this.layer.push({ g, c, tile: o.tile ?? 'plain', fit: !!o.fit })
    return this
  }
  /** A chamfered block w × h × d centred on p. */
  box(p: V, s: V, c: string, o: Opt & { bevel?: number; /** No chamfer (a block drawn hundreds of times over: the pews, the dome's coffers). */ sharp?: boolean } = {}) {
    const [w, h, d] = s
    const g = o.sharp || Math.min(w, h, d) < 0.012 ? new THREE.BoxGeometry(w, h, d) : new BevelBoxGeometry(w, h, d, o.bevel ?? chamferOf(w, h, d) * 1.6)
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
  lathe(p: V, profile: [number, number][], c: string, o: Opt & { seg?: number; /** The inside's colour (by default the outside's). */ inside?: string } = {}) {
    const g = new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), o.seg ?? 14)
    let len = 0
    for (let i = 1; i < profile.length; i++) len += Math.hypot(profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1])
    const R = Math.max(...profile.map(([x]) => x))
    this.add(g, p, c, o, (g) => scaleUV(g, Math.PI * 2 * R, len))
    // Its inside: the same surface wound the other way (a bowl, a bucket, a pan are seen from inside; cheaper than two-sided materials on the small phones).
    const inner = new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)).reverse(), o.seg ?? 14)
    return this.add(inner, p, o.inside ?? c, o, (g) => scaleUV(g, Math.PI * 2 * R, len))
  }
  /**
   * A tube swept along a path (a plantain's curved finger, a crab's jointed leg, a croissant's crescent):
   * its points and the radius at each, `seg` sides round (5 gives a plantain its ridges), `sq` squashing
   * the section (its width and height, as a flattened croissant). The ends taper shut when their radius is ~0.
   */
  sweep(p: V, path: V[], radii: number[], c: string, o: Opt & { seg?: number; sq?: [number, number] } = {}) {
    const g = sweepGeometry(path, radii, o.seg ?? 6, o.sq ?? [1, 1])
    const R = Math.max(...radii)
    return this.add(g, p, c, o, (g) => scaleUV(g, Math.PI * 2 * R, g.userData.len as number))
  }
  /** A flat disc lying face up (a plate's well, a sauce, a liquid's top). */
  disc(p: V, r: number, c: string, o: Opt & { seg?: number } = {}) {
    const g = new THREE.CircleGeometry(r, o.seg ?? 14)
    g.rotateX(-Math.PI / 2)
    return this.add(g, p, c, o, (g) => scaleUV(g, r * 2, r * 2))
  }
}

const swT = new THREE.Vector3()
const swPrev = new THREE.Vector3()
const swN = new THREE.Vector3()
const swB = new THREE.Vector3()
const swQ = new THREE.Quaternion()
/** The tube of `sweep`: rings round the path, each turned with the path (parallel transport, so it doesn't twist), uv 0..1 (round, along). */
function sweepGeometry(path: V[], radii: number[], seg: number, sq: [number, number]) {
  const n = path.length
  const pts = path.map((q) => new THREE.Vector3(...q))
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  const along = [0]
  for (let i = 1; i < n; i++) along.push(along[i - 1] + pts[i].distanceTo(pts[i - 1]))
  const len = along[n - 1] || 1
  for (let i = 0; i < n; i++) {
    swT.subVectors(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize()
    if (i === 0) {
      // A first normal square to the path: whichever axis is least along it.
      swN.set(Math.abs(swT.y) < 0.9 ? 0 : 1, Math.abs(swT.y) < 0.9 ? 1 : 0, 0)
      swN.sub(swB.copy(swT).multiplyScalar(swN.dot(swT))).normalize()
    } else {
      swQ.setFromUnitVectors(swPrev, swT)
      swN.applyQuaternion(swQ)
    }
    swPrev.copy(swT)
    swB.crossVectors(swT, swN).normalize()
    const r = radii[i]
    for (let k = 0; k <= seg; k++) {
      const a = (k / seg) * Math.PI * 2
      const cx = Math.cos(a) * r * sq[1]
      const cy = Math.sin(a) * r * sq[0]
      pos.push(pts[i].x + swN.x * cx + swB.x * cy, pts[i].y + swN.y * cx + swB.y * cy, pts[i].z + swN.z * cx + swB.z * cy)
      uv.push(k / seg, along[i] / len)
    }
  }
  for (let i = 0; i < n - 1; i++)
    for (let k = 0; k < seg; k++) {
      const a = i * (seg + 1) + k
      const b = a + seg + 1
      idx.push(a, a + 1, b, a + 1, b + 1, b)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  g.userData.len = len
  return g
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
    // A negative size: the shader varies each repeat (VARY).
    const sz = !pt.fit && VARY.has(pt.tile) ? -size : size
    for (let k = 0; k < n; k++) tr.set([u0, v0, sz], k * 3)
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

const MAP_FRAG = `#ifdef USE_MAP
  vec2 rpL = 1.0 - abs( mod( vMapUv, 2.0 ) - 1.0 );
  float rpV = step( rpTile.z, 0.0 );
  float rpH = fract( sin( dot( floor( vMapUv ), vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
  rpL = mix( rpL, 1.0 - rpL, rpV * step( 0.5, vec2( rpH, fract( rpH * 2.0 ) ) ) );
  vec4 rpT = texture2D( map, rpTile.xy + rpL * abs( rpTile.z ) );
  rpT.rgb *= 1.0 + rpV * ( fract( rpH * 7.0 ) - 0.5 ) * 0.08;
  diffuseColor *= rpT;
#endif`

/** Each vertex knows its tile (tileR: corner u, v and size); its uv, in tiles, is wrapped there per pixel, mirrored so it has no seam. The varied tiles (size < 0): each repeat flipped its own way by a hash of its cell and shaded ±4 %, the second scale that hides the repetition. */
function tiled<M extends THREE.Material>(m: M): M {
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 tileR;\nvarying vec3 rpTile;').replace('#include <begin_vertex>', '#include <begin_vertex>\nrpTile = tileR;')
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 rpTile;').replace('#include <map_fragment>', MAP_FRAG)
  }
  m.customProgramCacheKey = () => 'realprop2'
  // A copy (an engine heating its object's own material) keeps the wrapping.
  const clone = m.clone.bind(m)
  m.clone = () => tiled(clone() as M)
  return m
}

type Mats = { solid: THREE.Material; glass: THREE.Material; glow: THREE.Material; flat: THREE.Material }
const mats = new Map<string, Mats>()
/** The three materials every realistic prop shares (one-sided: the turned shells carry their own inside, see lathe), per tier (made once, kept: one atlas). « simple »: Lambert; above, standard ones the scene's sky lights (MiniLook's environment). */
export function propMats(tier: MiniTier): Mats {
  const std = tier === 'normal' || tier === 'haute'
  const key = std ? 'std' : 'lam'
  let m = mats.get(key)
  if (m) return m
  const map = propAtlas()
  m = {
    solid: tiled(std ? new THREE.MeshStandardMaterial({ map, vertexColors: true, flatShading: true, roughness: 0.72, metalness: 0 }) : new THREE.MeshLambertMaterial({ map, vertexColors: true, flatShading: true })),
    glass: tiled(std ? new THREE.MeshStandardMaterial({ map, vertexColors: true, transparent: true, opacity: 0.42, depthWrite: false, roughness: 0.08, metalness: 0 }) : new THREE.MeshLambertMaterial({ map, vertexColors: true, transparent: true, opacity: 0.42, depthWrite: false })),
    glow: tiled(new THREE.MeshBasicMaterial({ map, vertexColors: true, toneMapped: false })),
    flat: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
  }
  for (const x of Object.values(m)) x.userData.noMini = true
  mats.set(key, m)
  return m
}

/* ---------- The tier ---------- */

// In development, ?realprops=0 keeps phase 1 only (the light and finish) without these props: to measure what they cost.
const NO_REAL = import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).get('realprops') === '0'
/** The tier the realistic props draw at (the update's, « off » while it's shut). */
export function useRealTier(): MiniTier {
  const t = useMiniTier()
  return NO_REAL ? 'off' : t
}

/* ---------- Built props, shared and counted ---------- */

export type Recipe = (b: Builder, q: Q) => void
export type Made = { solid: THREE.BufferGeometry | null; glass: THREE.BufferGeometry | null; glow: THREE.BufferGeometry | null; flat: THREE.BufferGeometry | null; users: number }
const built = new Map<string, Made>()

export const qOf = (tier: MiniTier): Q => ({ lo: tier === 'simple', hi: tier === 'haute' })

/** A recipe built afresh, not shared: the caller owns its layers and disposes them (a scene merging many copies). */
export function bake(recipe: Recipe, q: Q): Omit<Made, 'users'> {
  const k = new Builder(q.lo)
  recipe(k, q)
  return { solid: merge(k.solid), glass: merge(k.glass), glow: merge(k.glow), flat: merge(k.flat) }
}

function take(key: string, recipe: Recipe, q: Q): Made {
  let b = built.get(key)
  if (!b) {
    const k = new Builder(q.lo)
    recipe(k, q)
    b = { solid: merge(k.solid), glass: merge(k.glass), glow: merge(k.glow), flat: merge(k.flat), users: 0 }
    built.set(key, b)
  }
  return b
}

/** A recipe's merged layers, built on first use for this tier, freed a moment after the last user goes (a scene that draws them its own way, instanced, uses this). */
export function useRealBuilt(id: string, recipe: Recipe, tier: MiniTier): Made {
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
        b.flat?.dispose()
      }, 4000)
    }
  }, [b, key])
  return b
}

/** A recipe drawn: its merged layers (one draw call each). */
export function RealMesh({ id, recipe, tier }: { id: string; recipe: Recipe; tier: MiniTier }) {
  const b = useRealBuilt(id, recipe, tier)
  const m = propMats(tier)
  return (
    <>
      {b.flat && <mesh geometry={b.flat} material={m.flat} receiveShadow />}
      {b.solid && <mesh geometry={b.solid} material={m.solid} castShadow receiveShadow />}
      {b.glow && <mesh geometry={b.glow} material={m.glow} />}
      {b.glass && <mesh geometry={b.glass} material={m.glass} renderOrder={1} />}
    </>
  )
}
