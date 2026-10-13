import * as THREE from 'three'

// Procedural wax prints, so every colour × motif works without image assets.
// Textures are cached: many Sims can share the same fabric.

const cache = new Map<string, THREE.CanvasTexture>()

/** Mix a hex colour towards black (amount < 0) or white (amount > 0). */
export function tint(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16)
  const mix = (c: number) => Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount)
  const [r, g, b] = [mix(n >> 16), mix((n >> 8) & 255), mix(n & 255)]
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
}

export function waxTexture(color: string, motif: string) {
  const key = `${color}|${motif}`
  const hit = cache.get(key)
  if (hit) return hit

  const S = 256
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')!
  const light = luminance(color) > 0.7
  const ink = light ? '#7a2e0e' : '#1d120b'
  const cream = light ? '#ff7a00' : '#fff3dc'
  const accent = light ? '#00a862' : tint(color, 0.45)
  g.fillStyle = color
  g.fillRect(0, 0, S, S)
  g.lineCap = 'round'

  switch (motif) {
    case 'losanges':
      for (let y = 0; y < 4; y++)
        for (let x = 0; x < 4; x++) {
          const cx = x * 64 + (y % 2) * 32 + 16
          const cy = y * 64 + 32
          diamond(g, cx, cy, 26, cream)
          diamond(g, cx, cy, 16, ink)
          diamond(g, cx, cy, 7, accent)
        }
      break
    case 'feuilles':
      for (let y = 0; y < 4; y++)
        for (let x = 0; x < 4; x++) {
          const cx = x * 64 + 32 + (y % 2) * 16
          const cy = y * 64 + 32
          g.save()
          g.translate(cx, cy)
          g.rotate(((x + y) % 2 ? 1 : -1) * 0.7)
          g.fillStyle = cream
          ellipse(g, 0, 0, 12, 26)
          g.fillStyle = ink
          ellipse(g, 0, 0, 6, 20)
          g.strokeStyle = accent
          g.lineWidth = 2
          g.beginPath()
          g.moveTo(0, -20)
          g.lineTo(0, 20)
          g.stroke()
          g.restore()
        }
      break
    case 'rayures':
      for (let y = 0; y < S; y += 32) {
        g.strokeStyle = cream
        g.lineWidth = 7
        zigzag(g, y + 8)
        g.strokeStyle = ink
        g.lineWidth = 4
        zigzag(g, y + 22)
      }
      break
    default: // cercles
      for (let y = 0; y < 4; y++)
        for (let x = 0; x < 4; x++) {
          const cx = x * 64 + (y % 2) * 32 + 16
          const cy = y * 64 + 32
          ring(g, cx, cy, 24, cream, 7)
          ring(g, cx, cy, 14, accent, 4)
          g.fillStyle = ink
          g.beginPath()
          g.arc(cx, cy, 6, 0, Math.PI * 2)
          g.fill()
        }
  }

  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  t.repeat.set(5, 3)
  cache.set(key, t)
  return t
}

function diamond(g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  g.fillStyle = fill
  g.beginPath()
  g.moveTo(x, y - r)
  g.lineTo(x + r * 0.7, y)
  g.lineTo(x, y + r)
  g.lineTo(x - r * 0.7, y)
  g.closePath()
  g.fill()
}

function ring(g: CanvasRenderingContext2D, x: number, y: number, r: number, stroke: string, w: number) {
  g.strokeStyle = stroke
  g.lineWidth = w
  g.beginPath()
  g.arc(x, y, r, 0, Math.PI * 2)
  g.stroke()
}

function ellipse(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  g.beginPath()
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  g.fill()
}

function zigzag(g: CanvasRenderingContext2D, y: number) {
  g.beginPath()
  for (let x = 0; x <= 256; x += 16) g.lineTo(x, y + ((x / 16) % 2 ? 7 : -7))
  g.stroke()
}
