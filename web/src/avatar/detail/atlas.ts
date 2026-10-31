import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { canvasTexture, newCanvas } from '../../lib/canvas'

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
}

type Rect = [F, number, number, number, number]
type Pending = { seg: string; spec: BoxSpec; W: number; H: number; D: number }

/**
 * Builds one look: its atlas, and the boxes of each body segment. The boxes are laid out on the
 * atlas once all are known, tallest first, so most looks fit in 256×128.
 */
export class Kit {
  private boxesIn: Pending[] = []
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
    const data = new Uint8ClampedArray(WIDTH * height * 4)
    const segs = new Map<string, THREE.BufferGeometry[]>()
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
      for (const [f, x0, y0, w, h] of rects)
        for (let yy = 0; yy < h; yy++)
          for (let xx = 0; xx < w; xx++) {
            const c = paint(f, xx, yy, w, h, x0 + xx, y0 + yy)
            if (!c) continue // left see-through
            const i = ((y0 + yy) * WIDTH + x0 + xx) * 4
            const [r, g, b] = shade(rgb(c), bevel(f, xx, yy, w, h) * bv)
            data[i] = r
            data[i + 1] = g
            data[i + 2] = b
            data[i + 3] = 255
          }
      const g = new THREE.BoxGeometry(...spec.s)
      g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...(spec.p ?? [0, 0, 0])), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(spec.r ?? [0, 0, 0]))), new THREE.Vector3(1, 1, 1)))
      const uv = g.attributes.uv
      rects.forEach(([, x0, y0, w, h], f) => {
        for (let k = f * 4; k < f * 4 + 4; k++) {
          const [a, b] = [uv.getX(k), uv.getY(k)]
          uv.setXY(k, (x0 + a * w) / WIDTH, 1 - (y0 + (1 - b) * h) / height)
        }
      })
      let list = segs.get(seg)
      if (!list) segs.set(seg, (list = []))
      list.push(g)
    })
    const c = newCanvas(WIDTH, height)
    c.getContext('2d')!.putImageData(new ImageData(data, WIDTH, height), 0, 0)
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
    return { texture: t, geos, boxes: this.boxes, tris, height }
  }
}
