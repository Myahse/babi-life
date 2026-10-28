import { useCallback, useRef, useState, type ReactNode } from 'react'

// The game's sheets (an action menu, a chat, what's going on): the world
// dims behind, the sheet comes up on a spring from the bottom (in the middle
// on a computer), and goes back down when it closes: by its own button, a
// tap outside, or pulling its bar down (or flicking it).

/** Closing after the sheet went back down: `close` plays it, then calls onClose. */
export function useClosing(onClose: () => void, ms = 220) {
  const [closing, setClosing] = useState(false)
  const once = useRef(false)
  const done = useRef(onClose)
  done.current = onClose
  const close = useCallback(() => {
    if (once.current) return
    once.current = true
    setClosing(true)
    setTimeout(() => done.current(), ms)
  }, [ms])
  return [closing, close] as const
}

export function Sheet({ onClose, children, className = '', z = 'z-30', dim = 'bg-[#0f1230]/55 backdrop-blur-[3px]', grab = true }: {
  onClose: () => void
  /** What's in it; given `close` to close it with its animation (from its own buttons). */
  children: ReactNode | ((close: () => void) => ReactNode)
  /** The sheet itself: its width, padding, height. */
  className?: string
  z?: string
  /** The dimming behind it. */
  dim?: string
  /** The bar on top, pulled down to close. */
  grab?: boolean
}) {
  const [closing, close] = useClosing(onClose)
  const panel = useRef<HTMLDivElement>(null)
  const drag = useRef<{ y: number; dy: number; t: number; v: number } | null>(null)
  const down = (e: React.PointerEvent) => {
    drag.current = { y: e.clientY, dy: 0, t: e.timeStamp, v: 0 }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const move = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || !panel.current) return
    const raw = e.clientY - d.y
    // Its speed (px/ms, smoothed), for a flick down.
    const dt = Math.max(1, e.timeStamp - d.t)
    d.v = 0.7 * ((raw - d.dy) / dt) + 0.3 * d.v
    d.t = e.timeStamp
    d.dy = raw
    // Pulled up, it resists like a phone's sheet; down, it follows the finger.
    const y = raw > 0 ? raw : -Math.sqrt(-raw) * 2
    panel.current.style.transition = 'none'
    panel.current.style.transform = `translateY(${y}px)`
  }
  const up = () => {
    const d = drag.current
    drag.current = null
    if (!d || !panel.current) return
    if (d.dy > 90 || (d.dy > 24 && d.v > 0.6)) return close()
    panel.current.style.transition = 'transform 0.35s var(--ease-spring)'
    panel.current.style.transform = ''
  }
  return (
    <div className={`motion-backdrop absolute inset-0 ${z} flex flex-col justify-end ${dim} lg:items-center lg:justify-center`} data-closing={closing || undefined} onClick={close}>
      <div ref={panel} className={`sheet motion-sheet relative flex w-full flex-col rounded-t-[28px] pb-[max(1rem,env(safe-area-inset-bottom))] lg:rounded-[28px] ${className}`} data-closing={closing || undefined} onClick={(e) => e.stopPropagation()}>
        {grab && <div className="sheet-grab absolute inset-x-0 top-0 z-10 h-7 touch-none pt-2 lg:hidden" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-hidden />}
        {typeof children === 'function' ? children(close) : children}
      </div>
    </div>
  )
}
