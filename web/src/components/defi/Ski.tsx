import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { worldTime } from '../../lib/worldClock'
import { resetSki, skiDefi, skiScore, type SkiGate } from '../../world3d/defiSki'

// Le défi du ski nautique, over the water-skiing at Île Boulay (BoulayScene's
// Skier skis it): held down, ◀ and ▶ take the skier out to one side of the
// boat's wake or the other, round each buoy on the outside; at the ramps,
// back in the middle and « Sauter » just before it, for a jump with a turn in
// the air. The buttons and how it's going, over the 3D.

const SAID: Record<NonNullable<SkiGate['result']>, [string, string]> = {
  ok: ['Bouée !', '#2fb344'],
  miss: ['Raté !', '#e03131'],
  jump: ['Saut ! Une vrille !', '#ffc233'],
  hop: ['Petit saut', '#74c0fc'],
}

export function SkiDefi({ onEnd }: { onEnd: (score: number) => void }) {
  const [gates, setGates] = useState<SkiGate[]>([])
  const [count, setCount] = useState(4)
  useEffect(() => {
    resetSki()
    skiDefi.requested = true
    let ended = false
    const t = setInterval(() => {
      setGates(skiDefi.gates.map((g) => ({ ...g })))
      setCount(skiDefi.active ? Math.ceil(skiDefi.t0 - worldTime()) : 4)
      if (skiDefi.done && !ended) {
        ended = true
        setTimeout(() => onEnd(skiScore(skiDefi.gates)), 700)
      }
    }, 100)
    return () => {
      clearInterval(t)
      resetSki()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const judged = gates.filter((g) => g.result)
  const last = judged[judged.length - 1]
  const hold = (dir: -1 | 1) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId)
      skiDefi.steer = dir
    },
    onPointerUp: () => (skiDefi.steer = 0),
    onPointerCancel: () => (skiDefi.steer = 0),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  })
  // The keyboard too: the arrows, the space bar to jump.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') skiDefi.steer = -1
      if (e.key === 'ArrowRight') skiDefi.steer = 1
      if (e.code === 'Space') skiDefi.jumpAt = worldTime()
    }
    // Letting go of one arrow stops only its own way (the other may be held already).
    const up = (e: KeyboardEvent) => ((e.key === 'ArrowLeft' && skiDefi.steer < 0) || (e.key === 'ArrowRight' && skiDefi.steer > 0)) && (skiDefi.steer = 0)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => (window.removeEventListener('keydown', down), window.removeEventListener('keyup', up))
  }, [])
  const next = gates.find((g) => !g.result)
  return (
    <div className="pointer-events-none flex h-full flex-col justify-between">
      {/* The gates: done (their colour), to come */}
      <div className="px-3 pt-3">
        <div className="hud mx-auto flex w-fit items-center gap-1.5 rounded-full px-3 py-2">
          {(gates.length ? gates : Array.from({ length: 12 }, () => null)).map((g, k) => (
            <span key={k} className={`grid place-items-center ${g?.side === 0 ? 'h-4 w-6 rounded-[4px]' : 'h-4 w-4 rounded-full'}`} style={{ background: g?.result ? SAID[g.result][1] : g === next ? '#ff7a00' : 'rgba(22,26,43,0.15)' }} />
          ))}
        </div>
        {count > 0 && count < 4 && <div key={count} className="animate-pop mt-16 text-center font-display text-[72px] leading-none font-extrabold text-white [text-shadow:0_4px_0_rgba(0,0,0,0.35)]">{count}</div>}
        {count === 0 && !last && <div className="animate-pop mt-16 text-center font-display text-[48px] font-extrabold text-white [text-shadow:0_4px_0_rgba(0,0,0,0.35)]">Partez !</div>}
        {last && (
          <div key={judged.length} className="animate-pop mt-14 text-center font-display text-[34px] font-extrabold [text-shadow:0_3px_0_rgba(0,0,0,0.4)]" style={{ color: SAID[last.result!][1] }}>
            {SAID[last.result!][0]}
          </div>
        )}
        {next && count <= 0 && <div className="mt-2 text-center text-[14px] font-extrabold text-white [text-shadow:0_2px_0_rgba(0,0,0,0.5)]">{next.side === 0 ? 'Tremplin : au milieu, puis « Sauter » !' : next.side > 0 ? 'Bouée à droite : passe à sa droite ▶' : '◀ Bouée à gauche : passe à sa gauche'}</div>}
      </div>
      {/* The hands: left, jump, right */}
      <div className="pointer-events-auto flex items-end justify-between gap-3 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <button className="grid h-20 w-20 touch-none place-items-center rounded-full bg-white/90 text-[var(--color-ink)] shadow-[0_6px_0_rgba(0,0,0,0.25)] select-none active:translate-y-1" {...hold(-1)} aria-label="À gauche">
          <ChevronLeft size={44} strokeWidth={3} />
        </button>
        <button className="mb-2 h-16 flex-1 touch-none rounded-full bg-[#ffc233] font-display text-[20px] font-extrabold text-[#16161c] shadow-[0_6px_0_#e09a00] select-none active:translate-y-1" onPointerDown={() => (skiDefi.jumpAt = worldTime())}>
          Sauter
        </button>
        <button className="grid h-20 w-20 touch-none place-items-center rounded-full bg-white/90 text-[var(--color-ink)] shadow-[0_6px_0_rgba(0,0,0,0.25)] select-none active:translate-y-1" {...hold(1)} aria-label="À droite">
          <ChevronRight size={44} strokeWidth={3} />
        </button>
      </div>
    </div>
  )
}
