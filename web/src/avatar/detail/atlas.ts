import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { canvasTexture, newCanvas } from '../../lib/canvas'
import { faceUVs, newBox } from '../../world3d/bevel'

// The detailed Sim's toolkit (DetailHuman): boxes whose six faces are painted
// texel by texel into one atlas per look, then merged into one mesh per body
// segment. So a Sim is still a handful of draw calls (one per bone, one
// material) however many little boxes it is made of: ears, a thumb, a collar,
// a buckle, the knot of a foulard, each lock of hair.

export type V3 = [number, number, number]
/** A box's faces: +x, -x, +y (top), -y (bottom), +z (front), -z (back). */
export type F = 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz'
/**
 * The colour of one texel of a face (null: see-through). x, y count from the top left of the face
 * as seen from outside, upright (on the top face, y = 0 is at the back); w, h are the face's size in
 * texels; ax, ay the texel in the atlas, so a print runs on across neighbouring faces.
 */
export type Paint = (f: F, x: number, y: number, w: number, h: number, ax: number, ay: number) => string | null

/** One texel is 2 cm everywhere: the head is 16 texels a side (BlockHuman's is 8, with half pixels). */
export const TX = 0.02
/** The atlas is this wide; only as tall as the look needs (a power of two). */
const WIDTH = 256

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [n >> 16, (n >> 8) & 255, n & 255]
}

/** Where a face sits on a side, 0 at the back to 1 at the front (on the ±x faces), for hairlines and sideburns. */
export function frontness(f: F, x: number, w: number) {
  const k = w > 1 ? x / (w - 1) : 0.5
  return f === 'px' ? 1 - k : f === 'nx' ? k : f === 'pz' ? 1 : 0
}

/**
 * The bevel and ambient occlusion baked in every box: the top edge of a side catches the light,
 * its bottom edge and its corners sit in shade, the underside is dark.
 */
function bevel(f: F, x: number, y: number, w: number, h: number) {
  if (f === 'py') return 0.05 - (x === 0 || x === w - 1 || y === 0 || y === h - 1 ? 0.03 : 0)
  if (f === 'ny') return -0.16
  let k = 0
  if (h > 2 && y === 0) k += 0.06
  if (h > 2 && y === h - 1) k -= 0.09
  if (w > 2 && (x === 0 || x === w - 1)) k -= 0.05
  return k
}

function shade([r, g, b]: [number, number, number], k: number): [number, number, number] {
  if (k === 0) return [r, g, b]
  return k < 0 ? [r * (1 + k), g * (1 + k), b * (1 + k)] : [r + (255 - r) * k, g + (255 - g) * k, b + (255 - b) * k]
}

export type BoxSpec = {
  /** Size in metres. */
  s: V3
  /** Centre, in the segment's frame. */
  p?: V3
  /** Euler rotation. */
  r?: V3
  /** Texels across, up and deep (default: the size at 2 cm a texel). */
  t?: V3
  paint: Paint | string
  /** How strong the baked bevel is (0: none). */
  bevel?: number
  /** The head's face: its front's texels are handed back as they were painted (the expressions, avatar/face.tsx). */
  face?: boolean
  /**
   * What the box is made of, for the finer atlas (Kit `sub` 2, « persos-realistes »): 'cloth' gets a weave
   * (a twill on denim), 'hair' strands, 'skin' its pores, 'smooth' is upscaled with rounded diagonals (the
   * face), 'flat' nothing. Bare skin met on a cloth box is told by its colour and left as skin.
   */
  fx?: Fx
}
export type Fx = 'cloth' | 'hair' | 'skin' | 'smooth' | 'flat'

/** A cheap integer hash in [0, 1) (the finer atlas's weave and pores). */
const ihash = (x: number, y: number) => ((Math.imul(x + 101, 73856093) ^ Math.imul(y + 37, 19349663)) >>> 0) / 4294967296
type RGB = [number, number, number] | null
const near = (a: RGB, b: RGB, d = 40) => (a === null || b === null ? a === b : Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < d)

/**
 * Scale2x (EPX) over a grid of colours, with colours compared loosely (the grain jitters them): each
 * texel becomes four, its corners taking a neighbour's colour where two neighbours meet on a diagonal.
 * A face's lines and curves come out rounder instead of in steps, and nothing new is invented.
 */
export function scale2x(src: RGB[], w: number, h: number): RGB[] {
  const out: RGB[] = new Array(w * h * 4)
  const at = (x: number, y: number) => src[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))]
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const P = at(x, y)
      const A = at(x, y - 1)
      const B = at(x + 1, y)
      const C = at(x - 1, y)
      const D = at(x, y + 1)
      const o = (2 * y * 2 * w) + 2 * x
      out[o] = near(C, A) && !near(C, D) && !near(A, B) ? A : P
      out[o + 1] = near(A, B) && !near(A, C) && !near(B, D) ? B : P
      out[o + 2 * w] = near(D, C) && !near(D, B) && !near(C, A) ? C : P
      out[o + 2 * w + 1] = near(B, D) && !near(B, A) && !near(D, C) ? D : P
    }
  return out
}

/** The finer atlas's touch on one texel (gx, gy: the texel in the atlas): a weave, strands, pores. */
function touch(fx: Fx, c: [number, number, number], gx: number, gy: number, skin: RGB): [number, number, number] {
  if (fx === 'flat') return c
  const n = ihash(gx, gy) - 0.5
  let k = 0
  if (fx === 'skin' || fx === 'smooth') k = n * 0.03
  else if (fx === 'hair') k = n * 0.24 + ((gx * 2 + gy * 3) % 7 === 0 ? 0.1 : (gx + gy * 2) % 5 === 0 ? -0.12 : 0)
  else if (skin && (near(c, skin, 34) || near(c, [skin[0] * 0.86, skin[1] * 0.86, skin[2] * 0.86], 30))) k = n * 0.03
  else if (c[2] > c[0] + 25 && c[2] >= c[1] && c[2] > 70) k = (gx + gy) % 4 < 2 ? 0.07 : -0.05 + n * 0.03 // denim's twill
  else k = ((gx ^ gy) & 1 ? 0.035 : -0.035) + n * 0.035 // a plain weave
  return shade(c, k)
}

type Rect = [F, number, number, number, number]
type Pending = { seg: string; spec: BoxSpec; W: number; H: number; D: number }

/**
 * Builds one look: its atlas, and the boxes of each body segment. The boxes are laid out on the
 * atlas once all are known, tallest first, so most looks fit in 256×128.
 */
export class Kit {
  private boxesIn: Pending[] = []
  /** Atlas texels per texel of the boxes (2: a texel of 1 cm, « persos-realistes »). */
  readonly sub: number
  private skin: RGB
  constructor(o: { sub?: number; skin?: string } = {}) {
    this.sub = o.sub ?? 1
    this.skin = o.skin ? rgb(o.skin) : null
  }
  get boxes() {
    return this.boxesIn.length
  }

  /** Adds a box to a segment (painted into the atlas at finish). */
  add(seg: string, spec: BoxSpec) {
    const [sx, sy, sz] = spec.s
    const [W, H, D] = spec.t ?? ([sx, sy, sz].map((v) => Math.max(1, Math.round(v / TX))) as V3)
    this.boxesIn.push({ seg, spec, W, H, D })
  }

  /** Paints every box into the atlas, a crisp pixel texture, and merges each segment into one geometry. */
  finish() {
    // Shelf packing, tallest first: [u, v] for each box.
    const order = this.boxesIn.map((_, i) => i).sort((a, b) => this.boxesIn[b].D + this.boxesIn[b].H - (this.boxesIn[a].D + this.boxesIn[a].H))
    const at: [number, number][] = []
    let [x, y, rowH] = [1, 1, 0]
    for (const i of order) {
      const { W, H, D } = this.boxesIn[i]
      const [w, h] = [2 * (D + W), D + H]
      if (x + w + 1 > WIDTH) {
        x = 1
        y += rowH + 1
        rowH = 0
      }
      if (y + h + 1 > WIDTH) throw new Error('detail atlas full')
      at[i] = [x, y]
      x += w + 1
      rowH = Math.max(rowH, h)
    }
    const used = y + rowH + 1
    let height = 32
    while (height < used) height *= 2
    // The boxes are laid out in texels; the atlas holds sub×sub of its own per texel (the same UVs).
    const S = this.sub
    const AW = WIDTH * S
    const data = new Uint8ClampedArray(AW * height * S * 4)
    const segs = new Map<string, THREE.BufferGeometry[]>()
    let face: Uint8ClampedArray | undefined
    const put = (i: number, c: [number, number, number]) => {
      data[i] = c[0]
      data[i + 1] = c[1]
      data[i + 2] = c[2]
      data[i + 3] = 255
    }
    this.boxesIn.forEach(({ seg, spec, W, H, D }, n) => {
      const [u, v] = at[n]
      // BoxGeometry's face order, each as [x, y, w, h] in the atlas.
      const rects: Rect[] = [
        ['px', u + D + W, v + D, D, H],
        ['nx', u, v + D, D, H],
        ['py', u + D, v, W, D],
        ['ny', u + D + W, v, W, D],
        ['pz', u + D, v + D, W, H],
        ['nz', u + 2 * D + W, v + D, W, H],
      ]
      const paint: Paint = typeof spec.paint === 'string' ? ((c: string) => () => c)(spec.paint) : spec.paint
      const bv = spec.bevel ?? 1
      for (const [f, x0, y0, w, h] of rects) {
        const grid: RGB[] = new Array(w * h)
        for (let yy = 0; yy < h; yy++)
          for (let xx = 0; xx < w; xx++) {
            const c = paint(f, xx, yy, w, h, x0 + xx, y0 + yy)
            grid[yy * w + xx] = c ? rgb(c) : null // null: left see-through
          }
        if (spec.face && f === 'pz') {
          // The front as painted, row by row (W×H texels, RGBA), shaded at its own size.
          face = new Uint8ClampedArray(w * h * 4)
          for (let yy = 0; yy < h; yy++)
            for (let xx = 0; xx < w; xx++) {
              const c = grid[yy * w + xx]
              if (!c) continue
              const s = shade(c, bevel(f, xx, yy, w, h) * bv)
              face.set([s[0], s[1], s[2], 255], (yy * w + xx) * 4)
            }
        }
        if (S === 1) {
          for (let yy = 0; yy < h; yy++)
            for (let xx = 0; xx < w; xx++) {
              const c = grid[yy * w + xx]
              if (c) put(((y0 + yy) * WIDTH + x0 + xx) * 4, shade(c, bevel(f, xx, yy, w, h) * bv))
            }
          continue
        }
        // The finer atlas: the texels upscaled (rounded on the face), the bevel a finer line, the weave.
        const fx = spec.fx ?? 'cloth'
        const fine = fx === 'smooth' && S === 2 ? scale2x(grid, w, h) : null
        const [fw, fh] = [w * S, h * S]
        for (let yy = 0; yy < fh; yy++)
          for (let xx = 0; xx < fw; xx++) {
            const c = fine ? fine[yy * fw + xx] : grid[Math.floor(yy / S) * w + Math.floor(xx / S)]
            if (!c) continue
            const gx = x0 * S + xx
            const gy = y0 * S + yy
            put((gy * AW + gx) * 4, touch(fx, shade(c, bevel(f, xx, yy, fw, fh) * bv), gx, gy, this.skin))
          }
      }
      const g = newBox(...spec.s)
      g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...(spec.p ?? [0, 0, 0])), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(spec.r ?? [0, 0, 0]))), new THREE.Vector3(1, 1, 1)))
      faceUVs(g, (f, a, b) => {
        const [, x0, y0, w, h] = rects[f]
        return [(x0 + a * w) / WIDTH, 1 - (y0 + (1 - b) * h) / height]
      })
      let list = segs.get(seg)
      if (!list) segs.set(seg, (list = []))
      list.push(g)
    })
    const c = newCanvas(AW, height * S)
    c.getContext('2d')!.putImageData(new ImageData(data, AW, height * S), 0, 0)
    const t = canvasTexture(c)
    t.magFilter = THREE.NearestFilter
    t.minFilter = THREE.NearestMipmapLinearFilter
    t.generateMipmaps = true
    t.anisotropy = 4
    t.colorSpace = THREE.SRGBColorSpace
    t.needsUpdate = true
    const geos: Record<string, THREE.BufferGeometry> = {}
    let tris = 0
    for (const [k, list] of segs) {
      const merged = mergeGeometries(list, false)!
      geos[k] = merged
      tris += merged.index ? merged.index.count / 3 : 0
      for (const g of list) g.dispose()
    }
    return { texture: t, geos, boxes: this.boxes, tris, height, face }
  }
}
