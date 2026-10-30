import * as THREE from 'three'
import { AlphaType, BlendMode, ClipOp, ColorType, FillType, PaintStyle, Skia, StrokeCap, StrokeJoin, TileMode, type SkCanvas, type SkFont, type SkPaint, type SkPathBuilder, type SkShader, type SkSurface, type SkTypeface } from '@shopify/react-native-skia'

// The canvas in the app (native/; React Native picks this file over canvas.ts): the game paints
// a Sim's clothes, the shops' signs, the windows' lights on a canvas, as in the browser. Here the
// same calls paint with Skia, off screen, and three.js gets the pixels (a data texture). Only what
// the game uses: rectangles, paths, arcs, text, gradients, pixels read and written back.

/** The fonts the game paints with, by family name (loaded at start, registerFont); else the phone's. */
const fonts = new Map<string, SkTypeface>()
export function registerFont(family: string, face: SkTypeface) {
  fonts.set(family.toLowerCase(), face)
}
const system = () => Skia.FontMgr.System()

type Style = string | Gradient
type State = { fill: Style; stroke: Style; lineWidth: number; alpha: number; font: string; align: CanvasTextAlign; baseline: CanvasTextBaseline; cap: CanvasLineCap; join: CanvasLineJoin; op: string; dash: number[] }
const START: State = { fill: '#000', stroke: '#000', lineWidth: 1, alpha: 1, font: '10px sans-serif', align: 'start', baseline: 'alphabetic', cap: 'butt', join: 'miter', op: 'source-over', dash: [] }

const OPS: Record<string, BlendMode> = { 'source-over': BlendMode.SrcOver, 'destination-out': BlendMode.DstOut, 'destination-in': BlendMode.DstIn, 'source-atop': BlendMode.SrcATop, 'source-in': BlendMode.SrcIn, lighter: BlendMode.Plus, multiply: BlendMode.Multiply, screen: BlendMode.Screen, overlay: BlendMode.Overlay, copy: BlendMode.Src }

/** A gradient, as canvas makes them: stops added, then painted with. */
class Gradient {
  stops: [number, string][] = []
  constructor(private make: (colors: Float32Array[], pos: number[]) => SkShader) {}
  addColorStop(at: number, color: string) {
    this.stops.push([at, color])
  }
  shader() {
    const s = [...this.stops].sort((a, b) => a[0] - b[0])
    return this.make(
      s.map(([, c]) => Skia.Color(c)),
      s.map(([p]) => p),
    )
  }
}

/** A CSS font (« bold 28px 'Baloo 2', sans-serif ») as a Skia font. */
const fontCache = new Map<string, SkFont>()
function skFont(css: string) {
  let f = fontCache.get(css)
  if (f) return f
  const size = Number(/(\d+(?:\.\d+)?)px/.exec(css)?.[1] ?? 10)
  const family = (css.split(/\d+(?:\.\d+)?px/)[1] ?? '').split(',').map((x) => x.trim().replace(/^['"]|['"]$/g, ''))
  const weight = /\bbold\b/.test(css) ? 700 : Number(/\b([1-9]00)\b/.exec(css)?.[1] ?? 400)
  let face: SkTypeface | null = null
  for (const name of family) {
    face = fonts.get(`${name.toLowerCase()}|${weight}`) ?? fonts.get(name.toLowerCase()) ?? null
    if (face) break
  }
  face ??= system().matchFamilyStyle(family.find((n) => !/serif|sans|system/.test(n)) ?? 'sans-serif', { weight })
  f = Skia.Font(face, size)
  fontCache.set(css, f)
  return f
}

class Context2D {
  private s: State = { ...START }
  private stack: State[] = []
  private path: SkPathBuilder = Skia.PathBuilder.Make()
  constructor(readonly canvas: SkiaCanvas) {}
  private get c(): SkCanvas {
    return this.canvas.sk()
  }

  get fillStyle() {
    return this.s.fill as unknown as string
  }
  set fillStyle(v: string | CanvasGradient | CanvasPattern) {
    this.s.fill = v as unknown as Style
  }
  get strokeStyle() {
    return this.s.stroke as unknown as string
  }
  set strokeStyle(v: string | CanvasGradient | CanvasPattern) {
    this.s.stroke = v as unknown as Style
  }
  get lineWidth() {
    return this.s.lineWidth
  }
  set lineWidth(v: number) {
    this.s.lineWidth = v
  }
  get globalAlpha() {
    return this.s.alpha
  }
  set globalAlpha(v: number) {
    this.s.alpha = v
  }
  get font() {
    return this.s.font
  }
  set font(v: string) {
    this.s.font = v
  }
  get textAlign() {
    return this.s.align
  }
  set textAlign(v: CanvasTextAlign) {
    this.s.align = v
  }
  get textBaseline() {
    return this.s.baseline
  }
  set textBaseline(v: CanvasTextBaseline) {
    this.s.baseline = v
  }
  get lineCap() {
    return this.s.cap
  }
  set lineCap(v: CanvasLineCap) {
    this.s.cap = v
  }
  get lineJoin() {
    return this.s.join
  }
  set lineJoin(v: CanvasLineJoin) {
    this.s.join = v
  }
  get globalCompositeOperation() {
    return this.s.op as GlobalCompositeOperation
  }
  set globalCompositeOperation(v: GlobalCompositeOperation) {
    this.s.op = v
  }
  // Not painted in the app (soft shadows, filters, smoothing): accepted, ignored.
  imageSmoothingEnabled = false
  shadowBlur = 0
  shadowColor = 'transparent'
  shadowOffsetX = 0
  shadowOffsetY = 0
  filter = 'none'
  letterSpacing = '0px'

  setLineDash(d: number[]) {
    this.s.dash = d
  }
  getLineDash() {
    return this.s.dash
  }

  private paint(stroke: boolean): SkPaint {
    const p = Skia.Paint()
    p.setAntiAlias(true)
    p.setStyle(stroke ? PaintStyle.Stroke : PaintStyle.Fill)
    const style = stroke ? this.s.stroke : this.s.fill
    if (style instanceof Gradient) {
      p.setShader(style.shader())
      p.setAlphaf(this.s.alpha)
    } else {
      p.setColor(Skia.Color(style))
      p.setAlphaf(p.getAlphaf() * this.s.alpha)
    }
    if (stroke) {
      p.setStrokeWidth(this.s.lineWidth)
      p.setStrokeCap(this.s.cap === 'round' ? StrokeCap.Round : this.s.cap === 'square' ? StrokeCap.Square : StrokeCap.Butt)
      p.setStrokeJoin(this.s.join === 'round' ? StrokeJoin.Round : this.s.join === 'bevel' ? StrokeJoin.Bevel : StrokeJoin.Miter)
      if (this.s.dash.length) p.setPathEffect(Skia.PathEffect.MakeDash(this.s.dash.length % 2 ? [...this.s.dash, ...this.s.dash] : this.s.dash, 0))
    }
    if (this.s.op !== 'source-over') p.setBlendMode(OPS[this.s.op] ?? BlendMode.SrcOver)
    return p
  }

  save() {
    this.stack.push({ ...this.s, dash: [...this.s.dash] })
    this.c.save()
  }
  restore() {
    const s = this.stack.pop()
    if (!s) return
    this.s = s
    this.c.restore()
  }
  translate(x: number, y: number) {
    this.c.translate(x, y)
  }
  rotate(a: number) {
    this.c.rotate((a * 180) / Math.PI, 0, 0)
  }
  scale(x: number, y: number) {
    this.c.scale(x, y)
  }
  /** (Only from a fresh canvas in the game: it sets, from nothing.) */
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number) {
    this.c.concat(Skia.Matrix([a, c, e, b, d, f, 0, 0, 1]))
  }

  fillRect(x: number, y: number, w: number, h: number) {
    this.c.drawRect(Skia.XYWHRect(x, y, w, h), this.paint(false))
  }
  strokeRect(x: number, y: number, w: number, h: number) {
    this.c.drawRect(Skia.XYWHRect(x, y, w, h), this.paint(true))
  }
  clearRect(x: number, y: number, w: number, h: number) {
    const p = Skia.Paint()
    p.setBlendMode(BlendMode.Clear)
    this.c.drawRect(Skia.XYWHRect(x, y, w, h), p)
  }

  beginPath() {
    this.path = Skia.PathBuilder.Make()
  }
  closePath() {
    this.path.close()
  }
  moveTo(x: number, y: number) {
    this.path.moveTo(x, y)
  }
  lineTo(x: number, y: number) {
    if (this.path.isEmpty()) this.path.moveTo(x, y)
    else this.path.lineTo(x, y)
  }
  quadraticCurveTo(cx: number, cy: number, x: number, y: number) {
    this.path.quadTo(cx, cy, x, y)
  }
  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number) {
    this.path.cubicTo(c1x, c1y, c2x, c2y, x, y)
  }
  arcTo(x1: number, y1: number, x2: number, y2: number, r: number) {
    if (this.path.isEmpty()) this.path.moveTo(x1, y1)
    this.path.arcToTangent(x1, y1, x2, y2, r)
  }
  rect(x: number, y: number, w: number, h: number) {
    this.path.addRect(Skia.XYWHRect(x, y, w, h))
  }
  roundRect(x: number, y: number, w: number, h: number, r: number | DOMPointInit | (number | DOMPointInit)[] = 0) {
    const first = Array.isArray(r) ? r[0] : r
    const rr = typeof first === 'number' ? first : (first?.x ?? 0)
    this.path.addRRect(Skia.RRectXY(Skia.XYWHRect(x, y, w, h), rr, rr))
  }
  /** The canvas's sweep, from where to where, which way round. */
  private sweep(start: number, end: number, ccw: boolean) {
    const full = Math.PI * 2
    let s = end - start
    if (!ccw) s = s >= full ? full : ((s % full) + full) % full
    else s = -s >= full ? -full : (((s % full) - full) % full) % full || (s === 0 ? 0 : -full)
    return (s * 180) / Math.PI
  }
  arc(x: number, y: number, r: number, start: number, end: number, ccw = false) {
    this.ellipse(x, y, r, r, 0, start, end, ccw)
  }
  ellipse(x: number, y: number, rx: number, ry: number, rotation: number, start: number, end: number, ccw = false) {
    const oval = Skia.XYWHRect(x - rx, y - ry, rx * 2, ry * 2)
    const sweep = this.sweep(start, end, ccw)
    const part = Skia.PathBuilder.Make()
    if (Math.abs(sweep) >= 359.99) part.addOval(oval, sweep < 0)
    else part.arcToOval(oval, (start * 180) / Math.PI, sweep, true)
    if (rotation) part.transform(Skia.Matrix().translate(x, y).rotate(rotation).translate(-x, -y))
    this.path.addPath(part.build(), undefined, !this.path.isEmpty())
  }
  fill(rule?: CanvasFillRule | Path2D) {
    this.path.setFillType(rule === 'evenodd' ? FillType.EvenOdd : FillType.Winding)
    this.c.drawPath(this.path.build(), this.paint(false))
  }
  stroke() {
    this.c.drawPath(this.path.build(), this.paint(true))
  }
  clip() {
    this.c.clipPath(this.path.build(), ClipOp.Intersect, true)
  }

  measureText(text: string) {
    const f = skFont(this.s.font)
    const w = f.measureText(text).width
    const m = f.getMetrics()
    return { width: w, actualBoundingBoxAscent: -m.ascent, actualBoundingBoxDescent: m.descent, actualBoundingBoxLeft: 0, actualBoundingBoxRight: w, fontBoundingBoxAscent: -m.ascent, fontBoundingBoxDescent: m.descent } as TextMetrics
  }
  private text(t: string, x: number, y: number, max: number | undefined, stroke: boolean) {
    const f = skFont(this.s.font)
    const m = f.getMetrics()
    let w = f.measureText(t).width
    const squeeze = max !== undefined && w > max ? max / w : 1
    w *= squeeze
    const a = this.s.align
    const dx = a === 'center' ? -w / 2 : a === 'right' || a === 'end' ? -w : 0
    const b = this.s.baseline
    const dy = b === 'top' || b === 'hanging' ? -m.ascent : b === 'middle' ? -(m.ascent + m.descent) / 2 : b === 'bottom' || b === 'ideographic' ? -m.descent : 0
    this.c.save()
    this.c.translate(x + dx, y + dy)
    if (squeeze !== 1) this.c.scale(squeeze, 1)
    this.c.drawText(t, 0, 0, this.paint(stroke), f)
    this.c.restore()
  }
  fillText(t: string, x: number, y: number, max?: number) {
    this.text(t, x, y, max, false)
  }
  strokeText(t: string, x: number, y: number, max?: number) {
    this.text(t, x, y, max, true)
  }

  createLinearGradient(x0: number, y0: number, x1: number, y1: number) {
    return new Gradient((colors, pos) => Skia.Shader.MakeLinearGradient({ x: x0, y: y0 }, { x: x1, y: y1 }, colors, pos, TileMode.Clamp)) as unknown as CanvasGradient
  }
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number) {
    return new Gradient((colors, pos) => Skia.Shader.MakeTwoPointConicalGradient({ x: x0, y: y0 }, r0, { x: x1, y: y1 }, r1, colors, pos, TileMode.Clamp)) as unknown as CanvasGradient
  }

  /** Another painted canvas, or a picture loaded (an <img>), drawn on this one (the whole of it, or a part, at a size). */
  drawImage(src: SkiaCanvas | SkImageElement, ...a: number[]) {
    const img = src instanceof SkImageElement ? src.image : src.surface.makeImageSnapshot()
    if (!img) return
    const p = Skia.Paint()
    p.setAlphaf(this.s.alpha)
    if (a.length <= 2) this.c.drawImage(img, a[0] ?? 0, a[1] ?? 0, p)
    else if (a.length === 4) this.c.drawImageRect(img, Skia.XYWHRect(0, 0, src.width, src.height), Skia.XYWHRect(a[0], a[1], a[2], a[3]), p)
    else this.c.drawImageRect(img, Skia.XYWHRect(a[0], a[1], a[2], a[3]), Skia.XYWHRect(a[4], a[5], a[6], a[7]), p)
  }

  getImageData(x: number, y: number, w: number, h: number) {
    const px = this.canvas.surface.getCanvas().readPixels(x, y, { width: w, height: h, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul }) as Uint8Array | null
    return { data: new Uint8ClampedArray(px ?? new Uint8Array(w * h * 4)), width: w, height: h, colorSpace: 'srgb' } as ImageData
  }
  createImageData(w: number, h: number) {
    return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h, colorSpace: 'srgb' } as ImageData
  }
  putImageData(img: ImageData, x: number, y: number) {
    const info = { width: img.width, height: img.height, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul }
    const pic = Skia.Image.MakeImage(info, Skia.Data.fromBytes(new Uint8Array(img.data.buffer, img.data.byteOffset, img.data.byteLength)), img.width * 4)
    if (!pic) return
    const p = Skia.Paint()
    p.setBlendMode(BlendMode.Src)
    this.c.save()
    this.c.concat(Skia.Matrix(this.c.getTotalMatrix()).invert()!)
    this.c.drawImage(pic, x, y, p)
    this.c.restore()
  }
}

/** A canvas: a Skia surface this size, its 2D context, its pixels. */
class SkiaCanvas {
  surface!: SkSurface
  private ctx: Context2D
  private w = 0
  private h = 0
  constructor(width: number, height: number) {
    this.w = width
    this.h = height
    this.make()
    this.ctx = new Context2D(this)
  }
  private make() {
    this.surface = Skia.Surface.Make(Math.max(1, this.w), Math.max(1, this.h))!
  }
  get width() {
    return this.w
  }
  // Resized: blank again, as a canvas is.
  set width(v: number) {
    this.w = v
    this.make()
  }
  get height() {
    return this.h
  }
  set height(v: number) {
    this.h = v
    this.make()
  }
  sk() {
    return this.surface.getCanvas()
  }
  getContext() {
    return this.ctx as unknown as CanvasRenderingContext2D
  }
  /** The pixels, rows from the top. */
  pixels() {
    this.surface.flush()
    return (this.sk().readPixels(0, 0, { width: this.w, height: this.h, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul }) as Uint8Array | null) ?? new Uint8Array(this.w * this.h * 4)
  }
  toDataURL() {
    return `data:image/png;base64,${this.surface.makeImageSnapshot().encodeToBase64()}`
  }
}

/**
 * A picture to paint with (new Image(), an <img> made by hand): its address
 * set, it's fetched and decoded by Skia, then onload (or onerror), as in the
 * browser; drawImage takes it.
 */
export class SkImageElement {
  image: ReturnType<typeof Skia.Image.MakeImageFromEncoded> = null
  onload: ((e?: any) => void) | null = null
  onerror: ((e?: any) => void) | null = null
  crossOrigin: string | null = null
  decoding = 'async'
  complete = false
  private address = ''
  private listeners: Record<string, ((e?: any) => void)[]> = {}
  get src() {
    return this.address
  }
  set src(v: string) {
    this.address = v
    this.complete = false
    const done = (ok: boolean) => {
      this.complete = true
      for (const f of [ok ? this.onload : this.onerror, ...(this.listeners[ok ? 'load' : 'error'] ?? [])]) f?.({ type: ok ? 'load' : 'error', target: this })
    }
    const data = v.startsWith('data:') ? Promise.resolve(Skia.Data.fromBase64(v.slice(v.indexOf(',') + 1))) : Skia.Data.fromURI(v.startsWith('/') ? `https://www.lifeinbabi.com${v}` : v)
    data
      .then((d) => {
        this.image = Skia.Image.MakeImageFromEncoded(d)
        done(!!this.image)
      })
      .catch(() => done(false))
  }
  get width() {
    return this.image?.width() ?? 0
  }
  get height() {
    return this.image?.height() ?? 0
  }
  get naturalWidth() {
    return this.width
  }
  get naturalHeight() {
    return this.height
  }
  addEventListener(type: string, f: (e?: any) => void) {
    ;(this.listeners[type] ??= []).push(f)
  }
  removeEventListener(type: string, f: (e?: any) => void) {
    this.listeners[type] = (this.listeners[type] ?? []).filter((x) => x !== f)
  }
  decode() {
    return new Promise<void>((ok, fail) => (this.complete ? (this.image ? ok() : fail()) : (this.addEventListener('load', () => ok()), this.addEventListener('error', () => fail()))))
  }
}

/** A blank canvas this size. */
export function newCanvas(width: number, height: number): HTMLCanvasElement {
  return new SkiaCanvas(width, height) as unknown as HTMLCanvasElement
}

/** The texture of a painted canvas. */
// (three's CanvasTexture is the app's own, native/src/shims/three.ts: it takes the Skia canvas's pixels.)
export const canvasTexture = (c: HTMLCanvasElement): THREE.Texture => new THREE.CanvasTexture(c)

/** A painted canvas as a picture (a swatch): a data URL. */
export const canvasUrl = (c: HTMLCanvasElement) => (c as unknown as SkiaCanvas).toDataURL()
