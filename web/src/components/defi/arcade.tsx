import { useEffect, useRef, useState } from 'react'

// What the games of the salle de jeux vidéo share (Foot, Course, Combat,
// Moustiques): a canvas of a fixed size in game units, scaled to fit its box
// (sharp on a phone), the loop that runs them (the time step held short when
// a frame is late, so nothing goes through a wall), the hands on a phone (a
// stick that follows the thumb, buttons held down) and on a computer (the
// keys held), the count before the start.

/** The game's canvas: w × h in game units, as big as its box allows, drawn with ctx in those units. */
export function useCanvas(w: number, h: number) {
  const ref = useRef<HTMLCanvasElement>(null)
  const scale = useRef(1)
  useEffect(() => {
    const c = ref.current
    if (!c?.parentElement) return
    const fit = () => {
      const box = c.parentElement!.getBoundingClientRect()
      const k = Math.min(box.width / w, box.height / h)
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      c.style.width = `${w * k}px`
      c.style.height = `${h * k}px`
      c.width = Math.round(w * k * dpr)
      c.height = Math.round(h * k * dpr)
      scale.current = k * dpr
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(c.parentElement)
    return () => ro.disconnect()
  }, [w, h])
  /** The context, set to game units (call each frame). */
  const ctx = () => {
    const c = ref.current?.getContext('2d')
    if (!c) return null
    c.setTransform(scale.current, 0, 0, scale.current, 0, 0)
    return c
  }
  return { ref, ctx }
}

/** The game loop: step(dt in s, t since start in s), each frame while running. */
export function useLoop(step: (dt: number, t: number) => void, running = true) {
  const fn = useRef(step)
  fn.current = step
  useEffect(() => {
    if (!running) return
    let raf = 0
    let last = performance.now()
    const t0 = last
    const tick = (now: number) => {
      fn.current(Math.min(0.05, (now - last) / 1000), (now - t0) / 1000)
      last = now
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [running])
}

/** The keys held down (by e.code), for the games on a computer. */
export function useKeys() {
  const keys = useRef(new Set<string>())
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (/^(Arrow|Space)/.test(e.code)) e.preventDefault()
      keys.current.add(e.code)
    }
    const up = (e: KeyboardEvent) => keys.current.delete(e.code)
    const blur = () => keys.current.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => (window.removeEventListener('keydown', down), window.removeEventListener('keyup', up), window.removeEventListener('blur', blur))
  }, [])
  return keys
}

/** Held down: on while the finger (or the mouse) is on it. */
export const hold = (on: () => void, off: () => void) => ({
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => (e.currentTarget.setPointerCapture(e.pointerId), on()),
  onPointerUp: off,
  onPointerCancel: off,
  onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
})

/** A round button of the pad (held or tapped). */
export function PadButton({ label, color, size = 64, on, off, dim }: { label: string; color: string; size?: number; on: () => void; off?: () => void; dim?: boolean }) {
  return (
    <button
      className={`grid touch-none place-items-center rounded-full font-display text-[13px] leading-none font-extrabold text-white shadow-[0_5px_0_rgba(0,0,0,0.35)] select-none active:translate-y-1 ${dim ? 'opacity-40' : ''}`}
      style={{ width: size, height: size, background: color }}
      {...hold(on, off ?? (() => undefined))}
    >
      {label}
    </button>
  )
}

/**
 * The stick: where the thumb lands in its area is the middle, the way it's
 * pushed (up to 44 px) the direction, -1…1 each way (y down). Drawn under
 * the thumb while held.
 */
export function Stick({ value, className = '' }: { value: { x: number; y: number }; className?: string }) {
  const [at, setAt] = useState<{ ox: number; oy: number; x: number; y: number } | null>(null)
  const R = 44
  const set = (ox: number, oy: number, cx: number, cy: number) => {
    let [dx, dy] = [cx - ox, cy - oy]
    const d = Math.hypot(dx, dy)
    if (d > R) (dx = (dx / d) * R), (dy = (dy / d) * R)
    value.x = dx / R
    value.y = dy / R
    setAt({ ox, oy, x: dx, y: dy })
  }
  const end = () => ((value.x = 0), (value.y = 0), setAt(null))
  return (
    <div
      className={`relative touch-none select-none ${className}`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        const b = e.currentTarget.getBoundingClientRect()
        set(e.clientX - b.left, e.clientY - b.top, e.clientX - b.left, e.clientY - b.top)
      }}
      onPointerMove={(e) => {
        if (!at) return
        const b = e.currentTarget.getBoundingClientRect()
        set(at.ox, at.oy, e.clientX - b.left, e.clientY - b.top)
      }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      {at ? (
        <>
          <span className="pointer-events-none absolute h-[100px] w-[100px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/40 bg-white/10" style={{ left: at.ox, top: at.oy }} />
          <span className="pointer-events-none absolute h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70 shadow-[0_3px_0_rgba(0,0,0,0.3)]" style={{ left: at.ox + at.x, top: at.oy + at.y }} />
        </>
      ) : (
        <span className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center text-[11px] font-extrabold text-white/50">Pose le pouce
          <br />
          ici pour bouger
        </span>
      )}
    </div>
  )
}

/** 3, 2, 1, then go (0), then nothing (-1): the count over the game; it plays from 0. */
export function useCount(from = 3) {
  const [n, setN] = useState(from)
  useEffect(() => {
    if (n < 0) return
    const t = setTimeout(() => setN(n - 1), 800)
    return () => clearTimeout(t)
  }, [n])
  return n
}

export function Count({ n, go = 'Go !' }: { n: number; go?: string }) {
  if (n < 0) return null
  return (
    <div key={n} className="animate-pop pointer-events-none absolute inset-0 grid place-items-center font-display text-[72px] font-extrabold text-white [text-shadow:0_4px_0_rgba(0,0,0,0.4)]">
      {n > 0 ? n : go}
    </div>
  )
}

/** A rectangle of a block figure, the way the game draws its people (and cars, and mosquitoes). */
export function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
}

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
