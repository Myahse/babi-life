import { useEffect, useRef, useState, type ReactNode } from 'react'

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
