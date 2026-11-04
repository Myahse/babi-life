import { useEffect, useRef, useState } from 'react'
import { Mic, X } from 'lucide-react'
import { t as tr } from '../lib/i18n'

// What the tennis and volleyball matches share on the screen (TennisMatch.tsx, VolleyMatch.tsx): the
// stick, the held buttons, the commentator's line, the replay's film bars, the countdown, the close
// button, the keys. Written into a plain object the match's loop reads every frame.

export type Hands = { mx: number; mz: number; held: Record<string, boolean> }

/** The run stick, bottom left: writes mx, mz (-1…1; up the screen is mz < 0). */
export function Stick({ hands }: { hands: React.MutableRefObject<Hands> }) {
  const base = useRef<HTMLDivElement>(null)
  const [knob, setKnob] = useState({ x: 0, y: 0, on: false })
  const release = () => {
    hands.current.mx = hands.current.mz = 0
    setKnob({ x: 0, y: 0, on: false })
  }
  const move = (e: React.PointerEvent) => {
    const r = base.current!.getBoundingClientRect()
    const R = r.width * 0.38
    let dx = e.clientX - (r.left + r.width / 2)
    let dy = e.clientY - (r.top + r.height / 2)
    const d = Math.hypot(dx, dy)
    if (d > R) [dx, dy] = [(dx / d) * R, (dy / d) * R]
    setKnob({ x: dx, y: dy, on: true })
    const m = Math.hypot(dx, dy) / R
    const k = m < 0.12 ? 0 : (m - 0.12) / 0.88 / (m || 1)
    hands.current.mx = (dx / R) * k
    hands.current.mz = (dy / R) * k
  }
  useEffect(() => () => void (hands.current.mx = hands.current.mz = 0), [hands])
  return (
    <div
      ref={base}
      role="slider"
      aria-label={tr('Courir et viser')}
      aria-valuetext={knob.on ? tr('en course') : tr('à l’arrêt')}
      className="pointer-events-auto relative grid h-32 w-32 shrink-0 touch-none place-items-center rounded-full border-4 border-white/50 bg-[#0f1230]/35"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        move(e)
      }}
      onPointerMove={(e) => knob.on && move(e)}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <span className="block h-14 w-14 rounded-full bg-[#ff8200] shadow-[0_6px_16px_-6px_rgba(224,90,0,0.9)]" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  )
}

/** A button held (its key in `hands.held` true while the finger is on it). */
export function Hold({ hands, k, label, sub, color, big, dim, keyName }: { hands: React.MutableRefObject<Hands>; k: string; label: string; sub?: string; color: string; big?: boolean; dim?: boolean; keyName?: string }) {
  const down = (e: React.PointerEvent) => {
    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    hands.current.held[k] = true
  }
  const up = () => void (hands.current.held[k] = false)
  return (
    <button
      className={`pointer-events-auto relative grid place-items-center rounded-full font-display leading-tight font-extrabold text-white shadow-[0_6px_0_rgba(0,0,0,0.25)] transition-opacity active:translate-y-[3px] active:shadow-[0_3px_0_rgba(0,0,0,0.25)] ${big ? 'h-20 w-20 text-base' : 'h-16 w-16 text-xs'} ${dim ? 'opacity-45' : ''}`}
      style={{ background: color }}
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={up}
    >
      <span>
        {label}
        {sub && <span className="block text-[9px] font-bold opacity-85">{sub}</span>}
      </span>
      {keyName && <span className="absolute -top-1 -right-1 rounded-md bg-black/60 px-1 text-[9px] font-bold">{keyName}</span>}
    </button>
  )
}

/** The keyboard into the same hands: arrows / WASD / ZQSD run, the letters hold the buttons. */
export function useKeys(hands: React.MutableRefObject<Hands>, map: Record<string, string>) {
  useEffect(() => {
    const down = new Set<string>()
    const sync = () => {
      const x = (down.has('ArrowRight') || down.has('KeyD') ? 1 : 0) - (down.has('ArrowLeft') || down.has('KeyA') || down.has('KeyQ') ? 1 : 0)
      const z = (down.has('ArrowDown') || down.has('KeyS') ? 1 : 0) - (down.has('ArrowUp') || down.has('KeyW') || down.has('KeyZ') ? 1 : 0)
      const m = Math.hypot(x, z) || 1
      hands.current.mx = x / m
      hands.current.mz = z / m
      // (Two keys may hold the same button: either one.)
      for (const k of new Set(Object.values(map))) hands.current.held[k] = Object.entries(map).some(([code, v]) => v === k && down.has(code))
    }
    const on = (e: KeyboardEvent) => {
      if (e.repeat) return
      down.add(e.code)
      sync()
    }
    const off = (e: KeyboardEvent) => {
      down.delete(e.code)
      sync()
    }
    window.addEventListener('keydown', on)
    window.addEventListener('keyup', off)
    return () => {
      window.removeEventListener('keydown', on)
      window.removeEventListener('keyup', off)
    }
  }, [hands, map])
}

/** The commentator's line (above the buttons on a phone held upright). */
export function Comment({ text, k }: { text: string; k: number }) {
  const upright = typeof window !== 'undefined' && window.innerHeight > window.innerWidth
  return (
    <div className="pointer-events-none absolute inset-x-0 px-4 text-center" style={{ bottom: upright ? 'calc(206px + var(--sab, env(safe-area-inset-bottom)))' : 'calc(10px + var(--sab, env(safe-area-inset-bottom)))' }}>
      <span key={k} className="animate-up inline-flex max-w-[22rem] items-center gap-1.5 rounded-xl bg-[#0f1230]/80 px-3 py-1.5 text-left text-xs font-bold text-white shadow">
        <Mic size={14} className="shrink-0 text-[#ffd43b]" />
        {text}
      </span>
    </div>
  )
}

/** The replay's film bars and « Ralenti » sign; a tap skips it. */
export function ReplayBars({ onSkip }: { onSkip: () => void }) {
  return (
    <button className="absolute inset-0 z-10 flex flex-col justify-between" onClick={onSkip} aria-label={tr('Passer le ralenti')}>
      <span className="block h-[7%] w-full bg-black/70" />
      <span className="pointer-events-none absolute top-[calc(7%+2.6rem)] left-3 rounded-md bg-[#e03131] px-2 py-0.5 font-display text-sm font-extrabold tracking-widest text-white">{tr('RALENTI')}</span>
      <span className="pointer-events-none absolute right-3 bottom-[calc(7%+0.6rem)] rounded-md bg-black/50 px-2 py-0.5 text-[11px] font-bold text-white">{tr('Touche pour passer')}</span>
      <span className="block h-[7%] w-full bg-black/70" />
    </button>
  )
}

/** The big « 3, 2, 1, Jouez ! ». */
export function Countdown({ time }: { time: number }) {
  if (time >= 1) return null
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      <div key={Math.ceil(-time)} className="animate-up font-display text-[110px] leading-none font-extrabold text-white drop-shadow-[0_6px_0_rgba(0,0,0,0.35)]">
        {time < 0 ? Math.ceil(-time) : tr('Jouez !')}
      </div>
    </div>
  )
}

export function Close({ onClick }: { onClick: () => void }) {
  return (
    <button className="pointer-events-auto grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#0f1230]/70 text-white" onClick={onClick} aria-label={tr('Quitter le match')}>
      <X size={22} />
    </button>
  )
}

/** The umpire's or the referee's word, big in the middle (« Faute ! », « 15-0 »). */
export function Call({ text, k, tone = 'yellow' }: { text: string; k: number; tone?: 'yellow' | 'red' }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[max(5.2rem,calc(var(--sat,env(safe-area-inset-top))+4.6rem))] text-center">
      <span key={k} className={`animate-up inline-block rounded-2xl px-4 py-2 font-display text-2xl font-extrabold shadow-lg ${tone === 'red' ? 'bg-[#e03131] text-white' : 'bg-[#ffd43b] text-[#141416]'}`}>
        {text}
      </span>
    </div>
  )
}

export const upright = (size: { width: number; height: number }) => size.height > size.width * 1.1
