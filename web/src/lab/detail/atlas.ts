import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { canvasTexture, newCanvas } from '../../lib/canvas'

// The detailed Sim's toolkit (prototype, lab only): boxes whose six faces are
// painted texel by texel into one atlas per look, then merged into one mesh per
// body segment. So a Sim is still a handful of draw calls (one per bone, one
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

/** One texel is 2 cm everywhere: the head is 16 texels a side (today's is 8, with half pixels). */
export const TX = 0.02
const SIZE = 256

const rgbCache = new Map<string, [number, number, number]>()
function rgb(hex: string): [number, number, number] {
  let c = rgbCache.get(hex)
  if (!c) {
    const n = parseInt(hex.slice(1), 16)
    rgbCache.set(hex, (c = [n >> 16, (n >> 8) & 255, n & 255]))
  }
  return c
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
}

/** Builds one look: its atlas, and the boxes of each body segment. */
export class Kit {
  data = new Uint8ClampedArray(SIZE * SIZE * 4)
  segs = new Map<string, THREE.BufferGeometry[]>()
  boxes = 0
  private x = 1
  private y = 1
  private rowH = 0

  private alloc(w: number, h: number): [number, number] {
    if (this.x + w + 1 > SIZE) {
      this.x = 1
      this.y += this.rowH + 1
      this.rowH = 0
    }
    if (this.y + h + 1 > SIZE) throw new Error('detail atlas full')
    const at: [number, number] = [this.x, this.y]
    this.x += w + 1
    this.rowH = Math.max(this.rowH, h)
    return at
  }

  /** Adds a box to a segment, painting its six faces into the atlas. */
  add(seg: string, spec: BoxSpec) {
    const [sx, sy, sz] = spec.s
    const [W, H, D] = spec.t ?? ([sx, sy, sz].map((v) => Math.max(1, Math.round(v / TX))) as V3)
    const [u, v] = this.alloc(2 * (D + W), D + H)
    // BoxGeometry's face order, each as [x, y, w, h] in the atlas.
    const rects: [F, number, number, number, number][] = [
      ['px', u + D + W, v + D, D, H],
      ['nx', u, v + D, D, H],
      ['py', u + D, v, W, D],
      ['ny', u + D + W, v, W, D],
      ['pz', u + D, v + D, W, H],
      ['nz', u + 2 * D + W, v + D, W, H],
    ]
    const paint: Paint = typeof spec.paint === 'string' ? ((c: string) => () => c)(spec.paint) : spec.paint
    const bv = spec.bevel ?? 1
    for (const [f, x0, y0, w, h] of rects)
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const c = paint(f, x, y, w, h, x0 + x, y0 + y)
          const i = ((y0 + y) * SIZE + x0 + x) * 4
          if (!c) {
            this.data[i + 3] = 0
            continue
          }
          const [r, g, b] = shade(rgb(c), bevel(f, x, y, w, h) * bv)
          this.data[i] = r
          this.data[i + 1] = g
          this.data[i + 2] = b
          this.data[i + 3] = 255
        }
    const g = new THREE.BoxGeometry(sx, sy, sz)
    const uv = g.attributes.uv
    rects.forEach(([, x0, y0, w, h], k) => {
      for (let n = k * 4; n < k * 4 + 4; n++) {
        const [a, b] = [uv.getX(n), uv.getY(n)]
        uv.setXY(n, (x0 + a * w) / SIZE, 1 - (y0 + (1 - b) * h) / SIZE)
      }
    })
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...(spec.p ?? [0, 0, 0])), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(spec.r ?? [0, 0, 0]))), new THREE.Vector3(1, 1, 1))
    g.applyMatrix4(m)
    let list = this.segs.get(seg)
    if (!list) this.segs.set(seg, (list = []))
    list.push(g)
    this.boxes++
  }

  /** The atlas as a crisp pixel texture, and every segment merged into one geometry. */
  finish() {
    const c = newCanvas(SIZE, SIZE)
    c.getContext('2d')!.putImageData(new ImageData(this.data, SIZE, SIZE), 0, 0)
    const t = canvasTexture(c)
    t.magFilter = THREE.NearestFilter
    t.minFilter = THREE.NearestMipmapLinearFilter
    t.generateMipmaps = true
    t.anisotropy = 4
    t.colorSpace = THREE.SRGBColorSpace
    const geos: Record<string, THREE.BufferGeometry> = {}
    for (const [k, list] of this.segs) {
      geos[k] = mergeGeometries(list, false)!
      for (const g of list) g.dispose()
    }
    return { texture: t, geos, boxes: this.boxes }
  }
}
