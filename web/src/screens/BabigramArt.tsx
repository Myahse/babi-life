import { useEffect, useRef, useState } from 'react'
import type { GramAccount, GramPost, Look } from '../lib/types'
import { randomLook } from '../avatar/options'
import { snapshot } from '../avatar/portrait'
import { rng } from '../world3d/themes'
import { shrink } from '../world3d/snapshot'
import { t as tr } from '../lib/i18n'

// Babigram's pictures: the filters (shown live as a CSS filter, then baked
// into the JPEG pixel by pixel, so what is posted looks the same on every
// browser, including those whose canvas ignores ctx.filter), and the photos
// of the game's accounts, which aren't files: each is painted once on a 2D
// canvas from its scene and seed (the sky, the sea, the maquis' lights…),
// with the account's Sim from the shared portrait renderer when there's
// someone in it, then kept in memory as a JPEG.

/* ---------- Filters ---------- */

type Op = ['saturate' | 'hue-rotate' | 'sepia' | 'grayscale' | 'brightness' | 'contrast', number]
export type GramFilter = { id: string; label: string; ops: Op[]; vignette?: boolean }

export const FILTERS: GramFilter[] = [
  { id: '', label: tr('Normal'), ops: [] },
  { id: 'lagune', label: tr('Lagune'), ops: [['saturate', 1.15], ['hue-rotate', -10], ['contrast', 1.05], ['brightness', 1.03]] },
  { id: 'bassam', label: tr('Bassam'), ops: [['saturate', 1.4], ['contrast', 1.1], ['brightness', 1.05]] },
  { id: 'harmattan', label: tr('Harmattan'), ops: [['sepia', 0.35], ['saturate', 1.2], ['contrast', 0.95], ['brightness', 1.06]] },
  { id: 'maquis', label: tr('Maquis'), ops: [['sepia', 0.2], ['saturate', 1.35], ['hue-rotate', -12], ['contrast', 1.1]], vignette: true },
  { id: 'attieke', label: tr('Attiéké'), ops: [['brightness', 1.12], ['contrast', 0.88], ['saturate', 0.85]] },
  { id: 'cacao', label: tr('Cacao'), ops: [['sepia', 0.55], ['contrast', 1.05], ['brightness', 0.96]], vignette: true },
  { id: 'plateau', label: 'Plateau', ops: [['grayscale', 1], ['contrast', 1.15]] },
  { id: 'nuit', label: tr('Nuit'), ops: [['contrast', 1.2], ['brightness', 0.9], ['saturate', 1.1], ['hue-rotate', 12]], vignette: true },
]
export const findFilter = (id?: string) => FILTERS.find((f) => f.id === (id ?? '')) ?? FILTERS[0]

export const cssFilter = (f: GramFilter) => (f.ops.length ? f.ops.map(([k, v]) => (k === 'hue-rotate' ? `${k}(${v}deg)` : `${k}(${v})`)).join(' ') : 'none')
/** The vignette of a filter, over a picture (CSS). */
export const VIGNETTE = 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.38) 100%)'

/** A 3×4 colour matrix (rows r, g, b: three factors and an offset), as the Filter Effects spec defines each CSS filter. */
type M = number[]
function opMatrix([k, v]: Op): M {
  const a = 1 - v
  switch (k) {
    case 'saturate':
      return [0.213 + 0.787 * v, 0.715 - 0.715 * v, 0.072 - 0.072 * v, 0, 0.213 - 0.213 * v, 0.715 + 0.285 * v, 0.072 - 0.072 * v, 0, 0.213 - 0.213 * v, 0.715 - 0.715 * v, 0.072 + 0.928 * v, 0]
    case 'hue-rotate': {
      const r = (v * Math.PI) / 180
      const c = Math.cos(r)
      const s = Math.sin(r)
      return [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928, 0, 0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283, 0, 0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072, 0]
    }
    case 'sepia':
      return [0.393 + 0.607 * a, 0.769 - 0.769 * a, 0.189 - 0.189 * a, 0, 0.349 - 0.349 * a, 0.686 + 0.314 * a, 0.168 - 0.168 * a, 0, 0.272 - 0.272 * a, 0.534 - 0.534 * a, 0.131 + 0.869 * a, 0]
    case 'grayscale':
      return [0.2126 + 0.7874 * a, 0.7152 - 0.7152 * a, 0.0722 - 0.0722 * a, 0, 0.2126 - 0.2126 * a, 0.7152 + 0.2848 * a, 0.0722 - 0.0722 * a, 0, 0.2126 - 0.2126 * a, 0.7152 - 0.7152 * a, 0.0722 + 0.9278 * a, 0]
    case 'brightness':
      return [v, 0, 0, 0, 0, v, 0, 0, 0, 0, v, 0]
    case 'contrast':
      return [v, 0, 0, 0.5 - 0.5 * v, 0, v, 0, 0.5 - 0.5 * v, 0, 0, v, 0.5 - 0.5 * v]
  }
}
/** b after a. */
function compose(a: M, b: M): M {
  const out: M = []
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) out.push(b[r * 4] * a[c] + b[r * 4 + 1] * a[4 + c] + b[r * 4 + 2] * a[8 + c] + (c === 3 ? b[r * 4 + 3] : 0))
  }
  return out
}

export function applyFilter(ctx: CanvasRenderingContext2D, w: number, h: number, f: GramFilter) {
  if (f.ops.length) {
    const m = f.ops.map(opMatrix).reduce(compose)
    const img = ctx.getImageData(0, 0, w, h)
    const d = img.data
    const o0 = m[3] * 255
    const o1 = m[7] * 255
    const o2 = m[11] * 255
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i]
      const g = d[i + 1]
      const b = d[i + 2]
      d[i] = m[0] * r + m[1] * g + m[2] * b + o0
      d[i + 1] = m[4] * r + m[5] * g + m[6] * b + o1
      d[i + 2] = m[8] * r + m[9] * g + m[10] * b + o2
    }
    ctx.putImageData(img, 0, 0)
  }
  if (f.vignette) vignette(ctx, w, h, 0.38)
}

function vignette(ctx: CanvasRenderingContext2D, w: number, h: number, alpha: number) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.38, w / 2, h / 2, Math.hypot(w, h) / 2)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, `rgba(0,0,0,${alpha})`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
}

export const ratioOf = (r: 'carre' | 'portrait') => (r === 'portrait' ? 4 / 5 : 1)

export function loadImage(src: string) {
  return new Promise<HTMLImageElement>((ok, fail) => {
    const img = new Image()
    // A photo in the bucket comes from another origin: ask for it with CORS, or the canvas can't be read.
    if (/^https?:/.test(src)) img.crossOrigin = 'anonymous'
    img.onload = () => ok(img)
    img.onerror = fail
    img.src = src
  })
}

/**
 * A picture kept as a data URL: a gallery photo's object URL is revoked as
 * soon as its thumbnail goes, and the photo must still be there to filter
 * and post. A bucket photo that can't be read stays a link.
 */
export async function keepPicture(src: string) {
  if (src.startsWith('data:')) return src
  try {
    return shrink(await loadImage(src))
  } catch {
    return src
  }
}

/**
 * The photo as it will be posted: cropped to the square or 4:5 from the
 * middle, at most 720 px wide, the filter baked in, a JPEG under the
 * server's 300 KB. Null when the picture can't be read (a bucket photo
 * without CORS): then the gallery photo goes as it is.
 */
export async function bake(src: string, ratio: 'carre' | 'portrait', filter: GramFilter): Promise<string | null> {
  try {
    const img = await loadImage(src)
    const k = ratioOf(ratio)
    let cw = img.width
    let ch = cw / k
    if (ch > img.height) (ch = img.height), (cw = ch * k)
    const w = Math.round(Math.min(720, cw))
    const h = Math.round(w / k)
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(img, (img.width - cw) / 2, (img.height - ch) / 2, cw, ch, 0, 0, w, h)
    applyFilter(ctx, w, h, filter)
    for (const q of [0.86, 0.75, 0.62, 0.5]) {
      const url = c.toDataURL('image/jpeg', q)
      if (url.length * 0.75 < 290_000) return url
    }
    return null
  } catch {
    return null
  }
}

/* ---------- The game's accounts ---------- */

const looks = new Map<string, Required<Look>>()
/** The look of one of the game's accounts: always the same for its handle. */
export function npcLook(a: GramAccount) {
  let l = looks.get(a.handle)
  if (!l) looks.set(a.handle, (l = randomLook(a.gender, rng(`babigram:${a.handle}`))))
  return l
}
/** The look and gender to draw an account with (a player's own, or the game's). */
export const accountLook = (a: GramAccount) => ({ look: a.author?.look ?? npcLook(a), gender: a.author?.gender ?? a.gender })

const painted = new Map<string, Promise<string>>()
let queue: Promise<unknown> = Promise.resolve()

/** The painting of a game's post, queued (one at a time keeps the phone smooth) and cached. */
export function paintPost(p: GramPost): Promise<string> {
  const key = `${p.account.handle}:${p.scene}:${p.seed}:${p.ratio}`
  let job = painted.get(key)
  if (!job) {
    job = queue.then(() => paint(p))
    queue = job.catch(() => undefined)
    painted.set(key, job)
    // Keep the memory in check: the oldest paintings go first.
    if (painted.size > 90) painted.delete(painted.keys().next().value!)
  }
  return job
}

const W = 600
type Ctx = CanvasRenderingContext2D
type R = () => number

function grad(ctx: Ctx, y0: number, y1: number, stops: string[], x0 = 0, x1 = 0) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1)
  stops.forEach((s, i) => g.addColorStop(i / Math.max(1, stops.length - 1), s))
  return g
}
function glow(ctx: Ctx, x: number, y: number, r: number, color: string, alpha = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, color)
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.globalAlpha = alpha
  ctx.fillStyle = g
  ctx.fillRect(x - r, y - r, r * 2, r * 2)
  ctx.globalAlpha = 1
}
const pick = <T,>(r: R, a: readonly T[]) => a[Math.floor(r() * a.length) % a.length]

function palm(ctx: Ctx, x: number, base: number, h: number, lean: number, color: string, leaf: string) {
  ctx.strokeStyle = color
  ctx.lineWidth = h * 0.05
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x, base)
  ctx.quadraticCurveTo(x + lean * 0.3, base - h * 0.5, x + lean, base - h)
  ctx.stroke()
  const tx = x + lean
  const ty = base - h
  ctx.fillStyle = leaf
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI + (i / 6) * Math.PI + (i % 2 ? 0.15 : -0.1)
    ctx.save()
    ctx.translate(tx, ty)
    ctx.rotate(a)
    ctx.beginPath()
    ctx.ellipse(h * 0.2, h * 0.04, h * 0.22, h * 0.045, 0.25, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

function skyline(ctx: Ctx, r: R, base: number, h: number, color: string, lit: string | null) {
  let x = -10
  while (x < W + 10) {
    const bw = 24 + r() * 46
    const bh = h * (0.25 + r() * (r() < 0.2 ? 1 : 0.55))
    ctx.fillStyle = color
    ctx.fillRect(x, base - bh, bw, bh)
    if (lit) {
      ctx.fillStyle = lit
      for (let wy = base - bh + 6; wy < base - 6; wy += 9) for (let wx = x + 4; wx < x + bw - 5; wx += 8) if (r() < 0.45) ctx.fillRect(wx, wy, 3.5, 4.5)
    }
    x += bw + 2 + r() * 6
  }
}

function water(ctx: Ctx, r: R, top: number, H: number, colors: string[], sparkle: string) {
  ctx.fillStyle = grad(ctx, top, H, colors)
  ctx.fillRect(0, top, W, H - top)
  ctx.strokeStyle = sparkle
  ctx.lineWidth = 2
  for (let i = 0; i < 40; i++) {
    const y = top + Math.pow(r(), 1.6) * (H - top)
    const x = r() * W
    const len = 10 + ((y - top) / (H - top)) * 50
    ctx.globalAlpha = 0.25 + r() * 0.35
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + len, y)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

function waxBackdrop(ctx: Ctx, r: R, H: number) {
  const palettes = [
    ['#f2b705', '#d6336c', '#0f9d8a', '#14213d'],
    ['#ff7a00', '#2a6cf0', '#f4efe6', '#7a1f3d'],
    ['#00a862', '#ffd166', '#b02e0c', '#17171a'],
    ['#7b5cff', '#ff9f43', '#74c0fc', '#f4efe6'],
  ]
  const [bg, a, b, c] = pick(r, palettes)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  const s = 70 + r() * 30
  const motif = Math.floor(r() * 3)
  for (let y = -s / 2, row = 0; y < H + s; y += s, row++) {
    for (let x = row % 2 ? -s / 2 : 0; x < W + s; x += s) {
      ctx.save()
      ctx.translate(x, y)
      if (motif === 0) {
        for (const [rad, col] of [[s * 0.42, a], [s * 0.3, c], [s * 0.18, b], [s * 0.07, a]] as const) {
          ctx.fillStyle = col
          ctx.beginPath()
          ctx.arc(0, 0, rad, 0, Math.PI * 2)
          ctx.fill()
        }
      } else if (motif === 1) {
        ctx.rotate(Math.PI / 4)
        ctx.fillStyle = a
        ctx.fillRect(-s * 0.3, -s * 0.3, s * 0.6, s * 0.6)
        ctx.fillStyle = c
        ctx.fillRect(-s * 0.18, -s * 0.18, s * 0.36, s * 0.36)
        ctx.fillStyle = b
        ctx.fillRect(-s * 0.07, -s * 0.07, s * 0.14, s * 0.14)
      } else {
        ctx.fillStyle = a
        ctx.beginPath()
        ctx.ellipse(0, 0, s * 0.45, s * 0.2, 0.6, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = c
        ctx.beginPath()
        ctx.ellipse(0, 0, s * 0.3, s * 0.1, 0.6, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = b
        ctx.beginPath()
        ctx.arc(s * 0.5, s * 0.1, s * 0.08, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }
  }
  // A soft studio light on the cloth.
  glow(ctx, W * 0.5, H * 0.35, W * 0.8, 'rgba(255,255,255,0.35)')
}

function plate(ctx: Ctx, r: R, cx: number, cy: number, s: number, caption: string) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  ctx.beginPath()
  ctx.ellipse(cx + 6, cy + 10, s, s * 0.42, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fbfaf6'
  ctx.beginPath()
  ctx.ellipse(cx, cy, s, s * 0.42, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#e4ded2'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.ellipse(cx, cy, s * 0.8, s * 0.33, 0, 0, Math.PI * 2)
  ctx.stroke()
  // What the caption says is on the plate, else any of the three.
  const said = /poulet/i.test(caption) ? 0 : /garba/i.test(caption) ? 1 : /alloco/i.test(caption) ? 2 : -1
  const pickDish = Math.floor(r() * 3)
  const dish = said >= 0 ? said : pickDish
  if (dish !== 2) {
    // Attiéké: a mound of little grains.
    for (let i = 0; i < 260; i++) {
      const a = r() * Math.PI * 2
      const d = Math.sqrt(r())
      ctx.fillStyle = r() < 0.5 ? '#f3e7c4' : '#e8d9a8'
      ctx.beginPath()
      ctx.arc(cx - s * 0.25 + Math.cos(a) * d * s * 0.42, cy - Math.sin(a) * d * s * 0.17 - (1 - d) * 14, 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  if (dish === 0) {
    // Poulet braisé.
    ctx.fillStyle = grad(ctx, cy - 40, cy + 20, ['#c4682a', '#7a3412'])
    ctx.beginPath()
    ctx.ellipse(cx + s * 0.3, cy - 8, s * 0.32, s * 0.17, -0.3, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(60,20,5,0.5)'
    ctx.lineWidth = 3
    for (let i = 0; i < 4; i++) {
      ctx.beginPath()
      ctx.moveTo(cx + s * 0.12 + i * 18, cy - 28)
      ctx.lineTo(cx + s * 0.2 + i * 18, cy + 6)
      ctx.stroke()
    }
  } else if (dish === 1) {
    // Garba: the fried fish.
    ctx.fillStyle = grad(ctx, cy - 30, cy + 20, ['#d89a3c', '#8a5418'])
    ctx.beginPath()
    ctx.ellipse(cx + s * 0.28, cy - 4, s * 0.34, s * 0.12, 0.15, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(cx + s * 0.6, cy - 4)
    ctx.lineTo(cx + s * 0.78, cy - 22)
    ctx.lineTo(cx + s * 0.78, cy + 14)
    ctx.fill()
  } else {
    // Alloco: golden plantain slices.
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = r() < 0.5 ? '#f2a516' : '#d9820b'
      ctx.beginPath()
      ctx.ellipse(cx + (r() - 0.5) * s * 1.2, cy + (r() - 0.5) * s * 0.4, 20, 11, r() * 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  // Tomato, onion and the piment.
  for (let i = 0; i < 3; i++) {
    const x = cx - s * 0.55 + i * 22
    ctx.fillStyle = '#e03131'
    ctx.beginPath()
    ctx.arc(x, cy + s * 0.18, 12, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ffc9c9'
    ctx.beginPath()
    ctx.arc(x, cy + s * 0.18, 6, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = '#2f9e44'
  ctx.beginPath()
  ctx.ellipse(cx + s * 0.05, cy + s * 0.25, 18, 5, 0.4, 0, Math.PI * 2)
  ctx.fill()
}

function basket(ctx: Ctx, r: R, cx: number, cy: number, s: number) {
  const fruit = pick(r, [
    ['#e03131', '#c92a2a', 11],
    ['#ffa94d', '#f59f00', 14],
    ['#94d82d', '#f59f00', 13],
    ['#862e9c', '#5f3dc4', 12],
    ['#e8590c', '#2f9e44', 8],
  ] as const)
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI
    const d = Math.sqrt(r())
    const x = cx + Math.cos(a) * d * s * 0.85
    const y = cy - Math.sin(a) * d * s * 0.45
    ctx.fillStyle = r() < 0.5 ? fruit[0] : fruit[1]
    ctx.beginPath()
    ctx.arc(x, y, fruit[2] + r() * 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.beginPath()
    ctx.arc(x - 3, y - 3, 3, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = grad(ctx, cy, cy + s * 0.5, ['#b5803f', '#7a4f1f'])
  ctx.beginPath()
  ctx.ellipse(cx, cy, s, s * 0.22, 0, 0, Math.PI)
  ctx.lineTo(cx - s * 0.8, cy + s * 0.45)
  ctx.lineTo(cx + s * 0.8, cy + s * 0.45)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(60,30,5,0.35)'
  ctx.lineWidth = 2
  for (let y = cy + 8; y < cy + s * 0.45; y += 9) {
    ctx.beginPath()
    ctx.moveTo(cx - s * 0.9, y)
    ctx.lineTo(cx + s * 0.9, y)
    ctx.stroke()
  }
}

function vehicle(ctx: Ctx, r: R, x: number, y: number) {
  const color = pick(r, ['#ff7a00', '#f2b705', '#2a6cf0', '#00a862', '#e03131'])
  const w = 150 + r() * 40
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.roundRect(x, y - 52, w, 42, 10)
  ctx.fill()
  ctx.beginPath()
  ctx.roundRect(x + w * 0.18, y - 82, w * 0.55, 34, 10)
  ctx.fill()
  ctx.fillStyle = '#bfe3ff'
  ctx.fillRect(x + w * 0.24, y - 76, w * 0.2, 22)
  ctx.fillRect(x + w * 0.48, y - 76, w * 0.2, 22)
  ctx.fillStyle = '#1b1b22'
  for (const wx of [x + w * 0.22, x + w * 0.78]) {
    ctx.beginPath()
    ctx.arc(wx, y - 8, 15, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** Paints a scene; says where a person stands (or none). */
function scene(ctx: Ctx, r: R, kind: string, H: number) {
  switch (kind) {
    case 'plage': {
      const hz = H * 0.46
      ctx.fillStyle = grad(ctx, 0, hz, ['#5fb6f5', '#bfe6ff', '#eef8ff'])
      ctx.fillRect(0, 0, W, hz)
      glow(ctx, W * (0.2 + r() * 0.6), H * 0.14, 120, 'rgba(255,250,220,0.95)')
      water(ctx, r, hz, H * 0.68, ['#1873b8', '#2fa4d6', '#7fd6ea'], '#ffffff')
      ctx.fillStyle = grad(ctx, H * 0.64, H, ['#f6e2b3', '#e9c587'])
      ctx.beginPath()
      ctx.moveTo(0, H * 0.68)
      for (let x = 0; x <= W; x += 30) ctx.lineTo(x, H * 0.66 + Math.sin(x / 70 + r()) * 8)
      ctx.lineTo(W, H)
      ctx.lineTo(0, H)
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'
      ctx.lineWidth = 4
      ctx.beginPath()
      for (let x = 0; x <= W; x += 30) ctx.lineTo(x, H * 0.665 + Math.sin(x / 70) * 8)
      ctx.stroke()
      const left = r() < 0.5
      palm(ctx, left ? 40 : W - 40, H * 0.95, H * 0.75, left ? 70 : -70, '#7a5230', '#2f9e44')
      if (r() < 0.6) {
        const ux = W * (0.25 + r() * 0.5)
        ctx.strokeStyle = '#ddd'
        ctx.lineWidth = 5
        ctx.beginPath()
        ctx.moveTo(ux, H * 0.62)
        ctx.lineTo(ux + 6, H * 0.86)
        ctx.stroke()
        const cols = ['#ff7a00', '#ffffff', '#00a862']
        for (let i = 0; i < 6; i++) {
          ctx.fillStyle = cols[i % 3]
          ctx.beginPath()
          ctx.moveTo(ux, H * 0.6)
          ctx.arc(ux, H * 0.62, 90, Math.PI + (i / 6) * Math.PI, Math.PI + ((i + 1) / 6) * Math.PI)
          ctx.fill()
        }
      }
      return
    }
    case 'lagune': {
      const hz = H * 0.5
      ctx.fillStyle = grad(ctx, 0, hz, ['#86c5f0', '#cfe8f7', '#fde8c8'])
      ctx.fillRect(0, 0, W, hz)
      skyline(ctx, r, hz, H * 0.32, '#6d83a3', 'rgba(255,240,200,0.55)')
      water(ctx, r, hz, H, ['#3d7fa6', '#245f86', '#183f5e'], '#d0ecff')
      // The bridge's deck and its piers.
      ctx.fillStyle = '#4a5568'
      ctx.fillRect(0, hz + 18, W, 9)
      for (let x = 20; x < W; x += 70) ctx.fillRect(x, hz + 26, 6, 18)
      // A pirogue.
      const px = W * (0.2 + r() * 0.5)
      const py = H * (0.72 + r() * 0.12)
      ctx.fillStyle = '#4a2c14'
      ctx.beginPath()
      ctx.moveTo(px - 90, py - 8)
      ctx.quadraticCurveTo(px, py + 26, px + 90, py - 8)
      ctx.quadraticCurveTo(px, py + 6, px - 90, py - 8)
      ctx.fill()
      ctx.fillStyle = '#1b1b22'
      ctx.beginPath()
      ctx.arc(px + 10, py - 34, 9, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillRect(px + 4, py - 26, 12, 26)
      ctx.strokeStyle = '#1b1b22'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(px + 16, py - 20)
      ctx.lineTo(px + 60, py + 30)
      ctx.stroke()
      return
    }
    case 'coucher': {
      const hz = H * 0.6
      ctx.fillStyle = grad(ctx, 0, hz, ['#2b1d5c', '#7b2a77', '#e0306a', '#ff8a3d', '#ffd27a'])
      ctx.fillRect(0, 0, W, hz)
      const sx = W * (0.3 + r() * 0.4)
      glow(ctx, sx, hz, 220, 'rgba(255,214,120,0.9)')
      ctx.fillStyle = '#ffe08a'
      ctx.beginPath()
      ctx.arc(sx, hz, 62, Math.PI, 0)
      ctx.fill()
      water(ctx, r, hz, H, ['#7a2d5e', '#3f1d4a', '#1d1030'], '#ffb26b')
      ctx.fillStyle = 'rgba(255,200,110,0.55)'
      for (let y = hz + 6; y < H; y += 14) ctx.fillRect(sx - 60 + (r() - 0.5) * 30, y, 120 * (1 - (y - hz) / (H - hz)) + 20, 4)
      palm(ctx, 50, H * 0.98, H * 0.7, 80, '#1a1030', '#1a1030')
      if (r() < 0.6) palm(ctx, W - 30, H, H * 0.55, -60, '#1a1030', '#1a1030')
      return
    }
    case 'maquis': {
      ctx.fillStyle = grad(ctx, 0, H, ['#2a1408', '#5a2a0e', '#8a4614'])
      ctx.fillRect(0, 0, W, H)
      for (let i = 0; i < 2; i++) {
        const y0 = H * (0.08 + i * 0.12)
        ctx.strokeStyle = 'rgba(30,15,5,0.9)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(0, y0)
        ctx.quadraticCurveTo(W / 2, y0 + 70, W, y0)
        ctx.stroke()
        for (let k = 1; k < 10; k++) {
          const t = k / 10
          const x = t * W
          const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * (y0 + 70) + t * t * y0
          const col = pick(r, ['rgba(255,214,120,0.95)', 'rgba(255,140,80,0.9)', 'rgba(120,220,255,0.85)', 'rgba(255,120,200,0.85)'])
          glow(ctx, x, y + 10, 28, col)
          ctx.fillStyle = '#fff6d8'
          ctx.beginPath()
          ctx.arc(x, y + 10, 5, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      return
    }
    case 'marche': {
      ctx.fillStyle = grad(ctx, 0, H, ['#f4d9a8', '#d9a066', '#a8683a'])
      ctx.fillRect(0, 0, W, H)
      const [a, b] = pick(r, [['#e03131', '#ffd43b'], ['#1c7ed6', '#ffffff'], ['#2f9e44', '#ffd43b'], ['#ff7a00', '#ffffff']] as const)
      for (let x = 0, i = 0; x < W; x += 50, i++) {
        ctx.fillStyle = i % 2 ? a : b
        ctx.fillRect(x, 0, 50, H * 0.16)
        ctx.beginPath()
        ctx.arc(x + 25, H * 0.16, 25, 0, Math.PI)
        ctx.fill()
      }
      ctx.fillStyle = 'rgba(80,40,10,0.35)'
      ctx.fillRect(0, H * 0.62, W, H * 0.38)
      return
    }
    case 'rue': {
      ctx.fillStyle = grad(ctx, 0, H * 0.5, ['#62b0ec', '#cbe8fb'])
      ctx.fillRect(0, 0, W, H * 0.6)
      let x = -20
      while (x < W) {
        const bw = 120 + r() * 90
        const bh = H * (0.35 + r() * 0.3)
        const top = H * 0.72 - bh
        ctx.fillStyle = pick(r, ['#f4c27a', '#f1a37c', '#7cc6b9', '#f4efe6', '#e7d27c', '#c9a0dc', '#9fc6f0'])
        ctx.fillRect(x, top, bw, bh)
        ctx.fillStyle = 'rgba(0,0,0,0.12)'
        ctx.fillRect(x + bw - 8, top, 8, bh)
        for (let wy = top + 20; wy < H * 0.6; wy += 46) {
          for (let wx = x + 14; wx < x + bw - 30; wx += 40) {
            ctx.fillStyle = '#3b4a5c'
            ctx.fillRect(wx, wy, 22, 28)
            ctx.fillStyle = 'rgba(255,255,255,0.25)'
            ctx.fillRect(wx, wy, 22, 8)
          }
        }
        if (r() < 0.6) {
          ctx.fillStyle = pick(r, ['#e03131', '#2a6cf0', '#00a862', '#ff7a00'])
          ctx.fillRect(x + 10, H * 0.6, bw - 30, 26)
          ctx.fillStyle = '#fff'
          ctx.font = 'bold 16px system-ui, sans-serif'
          ctx.fillText(pick(r, ['ALIMENTATION', 'COUTURE', 'CABINE', 'PHARMACIE', 'MAQUIS', 'COIFFURE']), x + 18, H * 0.6 + 19)
        }
        x += bw + 4
      }
      ctx.fillStyle = '#c9c4ba'
      ctx.fillRect(0, H * 0.72, W, H * 0.05)
      ctx.fillStyle = '#4b4f58'
      ctx.fillRect(0, H * 0.77, W, H * 0.23)
      ctx.fillStyle = '#f4efe6'
      for (let lx = 10; lx < W; lx += 90) ctx.fillRect(lx, H * 0.88, 50, 6)
      vehicle(ctx, r, W * (0.05 + r() * 0.5), H * 0.86)
      return
    }
    case 'nuit': {
      ctx.fillStyle = grad(ctx, 0, H, ['#070b24', '#1b2552', '#3a2a63'])
      ctx.fillRect(0, 0, W, H)
      // A crescent moon: a full one, bitten by the night.
      const mx = W * (0.15 + r() * 0.7)
      ctx.fillStyle = '#fff8dc'
      ctx.beginPath()
      ctx.arc(mx, H * 0.12, 24, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#0a0f2c'
      ctx.beginPath()
      ctx.arc(mx + 10, H * 0.11, 22, 0, Math.PI * 2)
      ctx.fill()
      skyline(ctx, r, H * 0.78, H * 0.55, '#141a38', 'rgba(255,214,120,0.85)')
      for (let i = 0; i < 28; i++) glow(ctx, r() * W, H * (0.5 + r() * 0.5), 20 + r() * 40, pick(r, ['rgba(255,190,90,0.7)', 'rgba(255,90,140,0.6)', 'rgba(120,200,255,0.6)', 'rgba(255,240,180,0.7)']), 0.7)
      return
    }
    case 'stade': {
      ctx.fillStyle = '#1d2433'
      ctx.fillRect(0, 0, W, H * 0.5)
      const crowd = ['#ff7a00', '#ffffff', '#00a862', '#ffd43b', '#e9ecef']
      for (let y = H * 0.1; y < H * 0.48; y += 11) for (let x = (y / 11) % 2 ? 4 : 0; x < W; x += 9) {
        ctx.fillStyle = crowd[Math.floor(r() * crowd.length)]
        ctx.globalAlpha = 0.55 + r() * 0.45
        ctx.fillRect(x, y, 6, 7)
      }
      ctx.globalAlpha = 1
      for (const lx of [W * 0.12, W * 0.88]) {
        ctx.fillStyle = '#9aa5b8'
        ctx.fillRect(lx - 3, 0, 6, H * 0.12)
        glow(ctx, lx, H * 0.04, 90, 'rgba(255,255,240,0.95)')
      }
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = i % 2 ? '#2f9e44' : '#37b24d'
        ctx.fillRect(0, H * 0.5 + (i * H * 0.5) / 8, W, H * 0.5 / 8 + 1)
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.ellipse(W / 2, H * 0.78, 140, 50, 0, 0, Math.PI * 2)
      ctx.moveTo(0, H * 0.78)
      ctx.lineTo(W, H * 0.78)
      ctx.stroke()
      return
    }
    case 'studio':
      waxBackdrop(ctx, r, H)
      return
    default: {
      // jardin
      ctx.fillStyle = grad(ctx, 0, H, ['#a9e34b', '#51cf66', '#2b8a3e'])
      ctx.fillRect(0, 0, W, H)
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = 'rgba(255,255,230,0.12)'
        ctx.beginPath()
        ctx.moveTo(W * (0.1 + i * 0.25), 0)
        ctx.lineTo(W * (0.2 + i * 0.25), 0)
        ctx.lineTo(W * (0.05 + i * 0.25), H)
        ctx.lineTo(W * (-0.05 + i * 0.25), H)
        ctx.fill()
      }
      for (let i = 0; i < 18; i++) {
        const x = r() * W
        const y = r() * H
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(r() * Math.PI * 2)
        ctx.fillStyle = pick(r, ['#2b8a3e', '#37b24d', '#1e6b30', '#5c940d'])
        ctx.beginPath()
        ctx.ellipse(0, 0, 70, 26, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(-60, 0)
        ctx.lineTo(60, 0)
        ctx.stroke()
        ctx.restore()
      }
      // Hibiscus and frangipani among the leaves.
      for (let i = 0; i < 9; i++) {
        const x = r() * W
        const y = H * (0.15 + r() * 0.8)
        const big = 18 + r() * 16
        const [petal, heart] = pick(r, [['#e03131', '#ffd43b'], ['#f783ac', '#fff3bf'], ['#ffffff', '#ffd43b'], ['#ff922b', '#c92a2a']] as const)
        ctx.fillStyle = petal
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2 + i
          ctx.beginPath()
          ctx.ellipse(x + Math.cos(a) * big * 0.7, y + Math.sin(a) * big * 0.7, big * 0.75, big * 0.45, a, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.fillStyle = heart
        ctx.beginPath()
        ctx.arc(x, y, big * 0.3, 0, Math.PI * 2)
        ctx.fill()
      }
      return
    }
  }
}

/** What's in front, once the person (if any) is in: the plate, the baskets, the table. */
function foreground(ctx: Ctx, r: R, kind: string, H: number, person: boolean, caption: string) {
  if (kind === 'maquis') {
    ctx.fillStyle = grad(ctx, H * 0.68, H, ['#9c5a2a', '#6b3a17'])
    ctx.fillRect(0, H * 0.7, W, H * 0.3)
    ctx.strokeStyle = 'rgba(40,20,5,0.4)'
    ctx.lineWidth = 2
    for (let y = H * 0.74; y < H; y += 26) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(W, y)
      ctx.stroke()
    }
    plate(ctx, r, person ? W * 0.62 : W * 0.5, person ? H * 0.86 : H * 0.8, person ? 120 : 170, caption)
    // The bottle.
    const bx = person ? W * 0.14 : W * 0.85
    ctx.fillStyle = pick(r, ['#2f6b2f', '#6b3a17', '#c92a2a'])
    ctx.beginPath()
    ctx.roundRect(bx - 22, H * 0.56, 44, H * 0.28, 10)
    ctx.fill()
    ctx.fillRect(bx - 8, H * 0.49, 16, H * 0.08)
    ctx.fillStyle = '#f4efe6'
    ctx.fillRect(bx - 22, H * 0.66, 44, 34)
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.fillRect(bx - 14, H * 0.58, 6, H * 0.22)
  } else if (kind === 'marche') {
    const n = person ? 2 : 3
    for (let i = 0; i < n; i++) basket(ctx, r, (W / (n + 1)) * (i + 1) + (r() - 0.5) * 30, H * (person ? 0.84 : 0.7 + (i % 2) * 0.12), person ? 95 : 110)
  }
}

async function paint(p: GramPost): Promise<string> {
  const H = Math.round(W / ratioOf(p.ratio))
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  const kind = p.scene ?? 'rue'
  const r = rng(`${p.account.handle}:${kind}:${p.seed ?? 0}`)
  scene(ctx, r, kind, H)
  // Someone in the picture: always in the studio, often elsewhere; the food and the market are often alone.
  const chance = kind === 'studio' ? 1 : kind === 'maquis' ? 0.4 : kind === 'marche' ? 0.3 : 0.55
  const person = r() < chance
  if (person) {
    const { look, gender } = accountLook(p.account)
    const shot = await snapshot(look, gender, 'bust').catch(() => null)
    if (shot) {
      const img = await loadImage(shot)
      const s = W * (kind === 'studio' ? 1.02 : 0.86)
      const x = W / 2 - s / 2 + (kind === 'studio' ? 0 : (r() - 0.5) * W * 0.3)
      ctx.drawImage(img, x, H - s + (kind === 'studio' ? 0 : H * 0.04), s, s)
    }
  }
  foreground(ctx, r, kind, H, person, p.caption)
  vignette(ctx, W, H, 0.22)
  applyFilter(ctx, W, H, findFilter(['', 'lagune', 'bassam', 'harmattan', 'attieke'][Math.floor(r() * 5)]))
  return c.toDataURL('image/jpeg', 0.84)
}

/** One of the game's photos: painted once it's near the screen (not before), then from memory. */
export function NpcPhoto({ post, className = '' }: { post: GramPost; className?: string }) {
  const box = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    const el = box.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') return setNear(true)
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && (setNear(true), io.disconnect()), { rootMargin: '400px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    if (!near) return
    let live = true
    void paintPost(post).then((s) => live && setSrc(s)).catch(() => undefined)
    return () => {
      live = false
    }
  }, [near, post.id]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div ref={box} className={className}>
      {src ? <img src={src} alt={post.caption || tr('Photo de @{handle}', { handle: post.account.handle })} draggable={false} className="motion-gram-in h-full w-full object-cover" /> : <div className="h-full w-full animate-pulse bg-[#ececf0]" />}
    </div>
  )
}
