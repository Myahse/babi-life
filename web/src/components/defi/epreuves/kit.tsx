import { useEffect, useRef, useState, type ReactNode } from 'react'
import { t } from '../../../lib/i18n'

// The épreuves' kit (index.tsx): a canvas the size of the screen drawn every frame, the finger (or the
// mouse) on it, a few sounds made in the browser, and the bar on top (the time left, what's done).

export type Frame = { g: CanvasRenderingContext2D; w: number; h: number; t: number; dt: number }
export type Touch = { kind: 'down' | 'move' | 'up'; x: number; y: number }

/** The game's canvas: `frame` draws it (t: seconds since it began, dt: since the last frame), `touch` hears the finger. */
export function Canvas({ frame, touch }: { frame: (f: Frame) => void; touch?: (e: Touch) => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const draw = useRef(frame)
  const hear = useRef(touch)
  draw.current = frame
  hear.current = touch
  useEffect(() => {
    const c = ref.current!
    const g = c.getContext('2d')!
    let raf = 0
    let last = performance.now()
    const t0 = last
    const loop = (now: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = c.clientWidth
      const h = c.clientHeight
      if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
        c.width = Math.round(w * dpr)
        c.height = Math.round(h * dpr)
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      draw.current({ g, w, h, t: (now - t0) / 1000, dt: Math.min(0.05, (now - last) / 1000) })
      last = now
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
  const at = (e: React.PointerEvent, kind: Touch['kind']) => {
    const r = ref.current!.getBoundingClientRect()
    hear.current?.({ kind, x: e.clientX - r.left, y: e.clientY - r.top })
  }
  return (
    <canvas
      ref={ref}
      className="absolute inset-0 h-full w-full touch-none"
      onPointerDown={(e) => {
        ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
        at(e, 'down')
      }}
      onPointerMove={(e) => at(e, 'move')}
      onPointerUp={(e) => at(e, 'up')}
      onPointerCancel={(e) => at(e, 'up')}
    />
  )
}

/** The bar on top: the épreuve's name, what's done, the time left. */
export function Hud({ title, left, done, children }: { title: string; left?: number; done?: string; children?: ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-2 p-3 pt-[max(12px,env(safe-area-inset-top))] pr-12 text-white">
      <div className="rounded-full bg-black/45 px-3 py-1 text-xs font-extrabold">{title}</div>
      <div className="flex items-center gap-2">
        {children}
        {done && <div className="rounded-full bg-black/45 px-3 py-1 text-sm font-extrabold">{done}</div>}
        {left !== undefined && <div className={`rounded-full px-3 py-1 text-sm font-extrabold tabular-nums ${left <= 5 ? 'bg-[#e03131]' : 'bg-black/45'}`}>{Math.max(0, Math.ceil(left))} s</div>}
      </div>
    </div>
  )
}

/** A big word in the middle a moment (« Trouvé ! », « Raté… »). */
export function Flash({ text, at }: { text: string; at: number }) {
  if (!text) return null
  return (
    <div key={at} className="animate-pop pointer-events-none absolute inset-x-0 top-[38%] z-10 text-center font-display text-4xl font-extrabold text-white drop-shadow-[0_3px_0_rgba(0,0,0,0.5)]">
      {text}
    </div>
  )
}

/** The HUD's state, set from the frame without re-rendering every frame (at most ~10 times a second). */
export function useHud<T>(init: T): [T, (v: T) => void] {
  const [v, setV] = useState(init)
  const last = useRef(0)
  const set = (n: T) => {
    const now = performance.now()
    if (now - last.current > 90) {
      last.current = now
      setV(n)
    }
  }
  return [v, set]
}

let ac: AudioContext | null = null
/** The browser's sound (made when first needed, after a touch). */
export function audio() {
  if (typeof window === 'undefined') return null
  try {
    ac ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    if (ac.state === 'suspended') void ac.resume()
    return ac
  } catch {
    return null
  }
}

/** A note: its pitch, length, loudness, and where (-1 left … 1 right). */
export function beep(freq: number, len = 0.12, vol = 0.15, { type = 'sine', pan = 0, to }: { type?: OscillatorType; pan?: number; to?: number } = {}) {
  const c = audio()
  if (!c) return
  const at = c.currentTime
  const o = c.createOscillator()
  const g = c.createGain()
  const p = c.createStereoPanner ? c.createStereoPanner() : null
  o.type = type
  o.frequency.setValueAtTime(freq, at)
  if (to) o.frequency.exponentialRampToValueAtTime(to, at + len)
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), at + 0.015)
  g.gain.exponentialRampToValueAtTime(0.0001, at + len)
  if (p) {
    p.pan.value = Math.max(-1, Math.min(1, pan))
    o.connect(g).connect(p).connect(c.destination)
  } else o.connect(g).connect(c.destination)
  o.start(at)
  o.stop(at + len + 0.05)
}

/** A knock (a step on the tin, a box falling): a short noise. */
export function knock(vol = 0.3, pan = 0, low = 900) {
  const c = audio()
  if (!c) return
  const len = 0.09
  const b = c.createBuffer(1, Math.round(c.sampleRate * len), c.sampleRate)
  const d = b.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3)
  const s = c.createBufferSource()
  s.buffer = b
  const f = c.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = low
  const g = c.createGain()
  g.gain.value = vol
  const p = c.createStereoPanner ? c.createStereoPanner() : null
  if (p) {
    p.pan.value = Math.max(-1, Math.min(1, pan))
    s.connect(f).connect(g).connect(p).connect(c.destination)
  } else s.connect(f).connect(g).connect(c.destination)
  s.start()
}

/** A random number between a and b. */
export const rnd = (a: number, b: number) => a + Math.random() * (b - a)
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

// —— The effects (FxLayer, over every épreuve, index.tsx): a burst of bits where it went right, the score
// floating up, the screen shaking where it went wrong, the phone's buzz, confetti at the end. The games
// call fx.good / fx.bad / fx.win with the spot (in the game's own coordinates, or fx.local(e) from a click).

type Bit = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; spin: number; rect: boolean }
type Floater = { text: string; x: number; y: number; life: number; color: string }
const FX = { bits: [] as Bit[], floats: [] as Floater[], shake: 0, rect: { left: 0, top: 0 } as { left: number; top: number } }

const GOOD = ['#ffd43b', '#69db7c', '#ffffff', '#74c0fc']
const BAD = ['#ff6b6b', '#c92a2a', '#ffa8a8']

export const fx = {
  /** A burst of bits at a spot. */
  burst(x: number, y: number, colors: string[] = GOOD, n = 16, power = 220) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const v = power * (0.4 + Math.random() * 0.6)
      FX.bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, life: 0, max: 0.5 + Math.random() * 0.4, color: colors[i % colors.length], size: 3 + Math.random() * 4, spin: Math.random() * 6, rect: Math.random() < 0.5 })
    }
  },
  /** Words floating up from a spot (« +1 », « Raté »). */
  float(text: string, x: number, y: number, color = '#ffffff') {
    FX.floats.push({ text, x, y, life: 0, color })
  },
  /** The screen shakes. */
  shake(power = 10) {
    FX.shake = Math.max(FX.shake, power)
  },
  /** Well done there: the bits, the words, a light buzz. */
  good(x: number, y: number, text = '+1') {
    fx.burst(x, y)
    fx.float(text, x, y - 10, '#ffe066')
    buzz('light')
  },
  /** Wrong there: the screen shakes, red, the phone buzzes. */
  bad(x: number, y: number, text = '') {
    fx.burst(x, y, BAD, 10, 160)
    if (text) fx.float(text, x, y - 10, '#ff8787')
    fx.shake(9)
    buzz('error')
  },
  /** The end, won: confetti across the screen. */
  win(w = window.innerWidth) {
    for (let i = 0; i < 70; i++)
      FX.bits.push({
        x: Math.random() * w,
        y: -10 - Math.random() * 80,
        vx: (Math.random() - 0.5) * 80,
        vy: 80 + Math.random() * 160,
        life: 0,
        max: 2 + Math.random(),
        color: ['#ffd43b', '#ff6b6b', '#69db7c', '#74c0fc', '#da77f2'][i % 5],
        size: 5 + Math.random() * 4,
        spin: Math.random() * 6,
        rect: true,
      })
    buzz('success')
  },
  /** A click's spot in the games' coordinates (the DOM games). */
  local(e: { clientX: number; clientY: number }) {
    return { x: e.clientX - FX.rect.left, y: e.clientY - FX.rect.top }
  },
}

function buzz(kind: 'light' | 'error' | 'success') {
  // (lib/native: the app's haptics, the browser's vibration; imported lazily, the lab page has no app.)
  void import('../../../lib/native').then((m) => m.haptic(kind)).catch(() => {})
}

/** The effects' layer over the game, and the shake applied to the game (`target`). */
export function FxLayer({ target }: { target: React.RefObject<HTMLDivElement | null> }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    FX.bits = []
    FX.floats = []
    FX.shake = 0
    const c = ref.current!
    const g = c.getContext('2d')!
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = c.clientWidth
      const h = c.clientHeight
      const r = c.getBoundingClientRect()
      FX.rect = { left: r.left, top: r.top }
      if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
        c.width = Math.round(w * dpr)
        c.height = Math.round(h * dpr)
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, w, h)
      // The vignette: the edges a little darker, the eye to the middle.
      const v = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75)
      v.addColorStop(0, 'rgba(0,0,0,0)')
      v.addColorStop(1, 'rgba(0,0,0,0.28)')
      g.fillStyle = v
      g.fillRect(0, 0, w, h)
      FX.bits = FX.bits.filter((b) => (b.life += dt) < b.max)
      for (const b of FX.bits) {
        b.vy += 420 * dt
        b.x += b.vx * dt
        b.y += b.vy * dt
        g.globalAlpha = Math.max(0, 1 - b.life / b.max)
        g.fillStyle = b.color
        g.save()
        g.translate(b.x, b.y)
        g.rotate(b.spin + b.life * 8)
        if (b.rect) g.fillRect(-b.size / 2, -b.size / 4, b.size, b.size / 2)
        else {
          g.beginPath()
          g.arc(0, 0, b.size / 2, 0, Math.PI * 2)
          g.fill()
        }
        g.restore()
      }
      FX.floats = FX.floats.filter((f) => (f.life += dt) < 0.9)
      g.textAlign = 'center'
      for (const f of FX.floats) {
        const k = f.life / 0.9
        g.globalAlpha = 1 - k * k
        g.font = `900 ${Math.round(22 + 8 * Math.sin(Math.min(1, k * 4) * Math.PI))}px sans-serif`
        g.lineWidth = 4
        g.strokeStyle = 'rgba(0,0,0,0.55)'
        g.strokeText(f.text, f.x, f.y - k * 50)
        g.fillStyle = f.color
        g.fillText(f.text, f.x, f.y - k * 50)
      }
      g.globalAlpha = 1
      g.textAlign = 'left'
      // The shake, on the game under.
      FX.shake = Math.max(0, FX.shake - dt * 40)
      const el = target.current
      if (el) el.style.transform = FX.shake > 0.3 ? `translate(${(Math.random() - 0.5) * FX.shake}px, ${(Math.random() - 0.5) * FX.shake}px)` : ''
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [target])
  return <canvas ref={ref} className="pointer-events-none absolute inset-0 z-30 h-full w-full" />
}

/** 3, 2, 1, « Partez ! » before the game begins (its clock starts after). */
export function Countdown({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(3)
  useEffect(() => {
    const id = setTimeout(
      () => {
        if (n > 0) beep(n === 1 ? 660 : 520, 0.12, 0.14)
        else beep(990, 0.3, 0.16)
        if (n < 0) onDone()
        else setN(n - 1)
      },
      n === 3 ? 150 : 650,
    )
    return () => clearTimeout(id)
  }, [n, onDone])
  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-black/35">
      {n >= 0 && (
        <div key={n} className="animate-pop font-display text-[92px] leading-none font-extrabold text-white drop-shadow-[0_6px_0_rgba(0,0,0,0.45)]">
          {n > 0 ? n : t('Partez !')}
        </div>
      )}
    </div>
  )
}

// —— People, drawn the same everywhere (the crowds, the players, the climber): a shadow, legs, a rounded
// body with its arms, a head, hair or a cap, a bag.
export type PersonLook = { shirt: string; skin?: string; pants?: string; cap?: string; hair?: string; bag?: string; dir?: number; bob?: number; arms?: 'down' | 'up' | 'wave'; size?: number }

export function drawPerson(g: CanvasRenderingContext2D, x: number, y: number, p: PersonLook) {
  const z = 14 * (p.size ?? 1)
  const dir = p.dir ?? 1
  const yy = y + (p.bob ?? 0)
  const skin = p.skin ?? '#6b4430'
  g.save()
  // The shadow on the ground.
  g.fillStyle = 'rgba(0,0,0,0.22)'
  g.beginPath()
  g.ellipse(x, y + z * 0.85, z * 0.75, z * 0.22, 0, 0, Math.PI * 2)
  g.fill()
  // Legs.
  g.strokeStyle = p.pants ?? '#343a40'
  g.lineCap = 'round'
  g.lineWidth = z * 0.32
  g.beginPath()
  g.moveTo(x - z * 0.2, yy)
  g.lineTo(x - z * 0.25, yy + z * 0.8)
  g.moveTo(x + z * 0.2, yy)
  g.lineTo(x + z * 0.25, yy + z * 0.8)
  g.stroke()
  // The bag behind.
  if (p.bag) {
    g.fillStyle = p.bag
    roundRect(g, x - dir * z * 0.85, yy - z * 1.3, z * 0.5, z * 0.95, z * 0.15)
    g.fill()
  }
  // Arms.
  g.strokeStyle = skin
  g.lineWidth = z * 0.22
  const up = p.arms === 'up'
  const wave = p.arms === 'wave'
  g.beginPath()
  g.moveTo(x - z * 0.5, yy - z * 1.15)
  g.lineTo(x - z * (up ? 0.75 : 0.65), yy - z * (up ? 2.1 : 0.35))
  g.moveTo(x + z * 0.5, yy - z * 1.15)
  g.lineTo(x + z * (up || wave ? 0.75 : 0.65), yy - z * (up || wave ? 2.1 : 0.35))
  g.stroke()
  // The body: a rounded shirt.
  g.fillStyle = p.shirt
  roundRect(g, x - z * 0.55, yy - z * 1.45, z * 1.1, z * 1.5, z * 0.35)
  g.fill()
  g.fillStyle = 'rgba(255,255,255,0.18)'
  roundRect(g, x - z * 0.45, yy - z * 1.38, z * 0.35, z * 1.2, z * 0.2)
  g.fill()
  // The head, the hair, the eyes.
  g.fillStyle = skin
  g.beginPath()
  g.arc(x, yy - z * 1.9, z * 0.45, 0, Math.PI * 2)
  g.fill()
  if (p.cap) {
    g.fillStyle = p.cap
    g.beginPath()
    g.arc(x, yy - z * 2.0, z * 0.47, Math.PI, 0)
    g.fill()
    g.fillRect(x + (dir > 0 ? 0 : -z * 0.75), yy - z * 2.02, z * 0.75, z * 0.12)
  } else {
    g.fillStyle = p.hair ?? '#1a1a1a'
    g.beginPath()
    g.arc(x, yy - z * 2.0, z * 0.46, Math.PI * 1.05, Math.PI * 1.95)
    g.fill()
  }
  g.fillStyle = '#111'
  g.fillRect(x + dir * z * 0.08, yy - z * 1.95, z * 0.1, z * 0.1)
  g.fillRect(x + dir * z * 0.26, yy - z * 1.95, z * 0.1, z * 0.1)
  g.restore()
}

export function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}
