import { useEffect, useRef, useState } from 'react'
import { Zap } from 'lucide-react'
import { listenKeys, pad, sprint } from '../world3d/input'

const RADIUS = 52 // how far the knob travels, px

/** The on-screen pad: drag the knob to walk the Sim; it springs back on release. */
export function Joystick({ disabled = false, className = '' }: { disabled?: boolean; className?: string }) {
  const base = useRef<HTMLDivElement>(null)
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const [active, setActive] = useState(false)

  useEffect(() => listenKeys(), [])
  useEffect(() => {
    if (disabled) release()
  }, [disabled])
  // Never leave the Sim walking when the pad goes away.
  useEffect(() => () => release(), [])

  function release() {
    pad.x = pad.y = 0
    setKnob({ x: 0, y: 0 })
    setActive(false)
  }

  function move(e: React.PointerEvent) {
    const r = base.current!.getBoundingClientRect()
    let dx = e.clientX - (r.left + r.width / 2)
    let dy = e.clientY - (r.top + r.height / 2)
    const d = Math.hypot(dx, dy)
    if (d > RADIUS) {
      dx = (dx / d) * RADIUS
      dy = (dy / d) * RADIUS
    }
    setKnob({ x: dx, y: dy })
    // A small dead zone so a resting thumb doesn't drift.
    const m = Math.hypot(dx, dy) / RADIUS
    const k = m < 0.15 ? 0 : (m - 0.15) / 0.85 / (m || 1)
    pad.x = (dx / RADIUS) * k
    pad.y = (-dy / RADIUS) * k
  }

  return (
    <div
      ref={base}
      role="slider"
      aria-label="Déplacer le Sim"
      aria-valuetext={active ? 'en marche' : 'à l’arrêt'}
      className={`hud relative grid h-[132px] w-[132px] touch-none place-items-center rounded-full transition-opacity select-none ${disabled ? 'pointer-events-none opacity-40' : ''} ${className}`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        setActive(true)
        move(e)
      }}
      onPointerMove={(e) => active && move(e)}
      onPointerUp={release}
      onPointerCancel={release}
    >
      {/* Direction ticks */}
      {[0, 90, 180, 270].map((a) => (
        <span key={a} className="absolute h-2 w-2 rounded-full bg-[var(--color-ink)]/15" style={{ transform: `rotate(${a}deg) translateY(-52px)` }} />
      ))}
      <span
        className={`block h-14 w-14 rounded-full bg-[var(--color-orange)] shadow-[0_6px_16px_-6px_rgba(224,90,0,0.9)] ${active ? '' : 'transition-transform duration-200 ease-[var(--ease-spring)]'}`}
        style={{ transform: `translate(${knob.x}px, ${knob.y}px) scale(${active ? 1.06 : 1})` }}
      />
    </div>
  )
}

/** Run (or walk again): a toggle, as Shift on a keyboard. */
export function RunButton() {
  const [on, setOn] = useState(sprint.on)
  useEffect(() => () => void (sprint.on = false), [])
  return (
    <button
      className={`pointer-events-auto mb-2 ml-1 flex h-12 items-center gap-1.5 rounded-full px-4 text-sm font-extrabold shadow-[0_8px_20px_-10px_rgba(0,0,0,0.6)] transition active:scale-95 ${on ? 'bg-[var(--color-orange)] text-white' : 'hud'}`}
      onClick={() => {
        sprint.on = !on
        setOn(!on)
      }}
      aria-pressed={on}
    >
      <Zap size={18} strokeWidth={2.6} className={on ? '' : 'text-[var(--color-orange)]'} /> {on ? 'Je cours' : 'Courir'}
    </button>
  )
}
