import * as THREE from 'three'
import { absUrl } from '../dom/origin'

// three.js for the game's code on the phone: all of it, except what reads a
// browser canvas or fetches a picture by the page's address. A canvas here is
// Skia's (web/src/lib/canvas.native.ts): its texture takes its pixels.

export * from 'three'

type Painted = { width: number; height: number; pixels: () => Uint8Array }
const painted = (c: unknown): c is Painted => !!c && typeof (c as Painted).pixels === 'function'

/** A painted canvas's pixels for three.js (rows turned over: a texture starts at the bottom); painted again, `needsUpdate = true` takes them anew. */
class PaintedTexture extends THREE.DataTexture {
  // (Not `source`: a three.js texture has its own.)
  private painted?: Painted
  readonly isCanvasTexture = true
  constructor(c: Painted, mapping?: THREE.Mapping, wrapS?: THREE.Wrapping, wrapT?: THREE.Wrapping, magFilter?: THREE.MagnificationTextureFilter, minFilter?: THREE.MinificationTextureFilter, format?: THREE.PixelFormat, type?: THREE.TextureDataType, anisotropy?: number) {
    super(new Uint8Array(Math.max(1, c.width) * Math.max(1, c.height) * 4), c.width, c.height, format ?? THREE.RGBAFormat, type, mapping, wrapS, wrapT, magFilter ?? THREE.LinearFilter, minFilter ?? THREE.LinearMipmapLinearFilter, anisotropy)
    this.painted = c
    // As a canvas texture is drawn (a data texture's own are pixel sharp, without mipmaps).
    this.generateMipmaps = true
    this.take()
  }
  private take() {
    const c = this.painted
    if (!c) return
    const { width: w, height: h } = c
    const px = c.pixels()
    const img = this.image as { data: Uint8Array; width: number; height: number }
    if (img.width !== w || img.height !== h || img.data.length !== w * h * 4) Object.assign(img, { data: new Uint8Array(w * h * 4), width: w, height: h })
    const row = w * 4
    for (let y = 0; y < h; y++) img.data.set(px.subarray(y * row, (y + 1) * row), (h - 1 - y) * row)
  }
  override set needsUpdate(v: boolean) {
    if (v && this.painted) this.take()
    super.needsUpdate = v
  }
}

/** new THREE.CanvasTexture(canvas): a Skia canvas's pixels; a browser's canvas (the look in a browser, react-native-web) as three.js has it. */
export const CanvasTexture = function CanvasTexture(canvas: unknown, ...rest: unknown[]) {
  return painted(canvas) ? new PaintedTexture(canvas, ...(rest as [])) : new THREE.CanvasTexture(canvas as HTMLCanvasElement, ...(rest as []))
} as unknown as typeof THREE.CanvasTexture

/** Pictures by the site's address (/textures/…) fetched from the site; React Three Fiber's loader does the rest. */
export class TextureLoader extends THREE.TextureLoader {
  override load(...[url, ...rest]: Parameters<THREE.TextureLoader['load']>) {
    return super.load(absUrl(url), ...rest)
  }
}
