import { useEffect, useRef } from 'react'
import type { Look } from '../lib/types'

// A ride in town, short (the update « trajet-court »): no waiting for the whole
// way. A short screen: the taxi, the woro-woro, the gbaka or the moto-taxi pulls
// up, the perso climbs in, and it's off; then there (the vehicle drops the Sim in
// the street and speeds off: world3d/open/tripDrop.tsx). Not long: three seconds.

export const TRIP_LOADING_MS = 3200

type Kind = 'taxi' | 'woro' | 'gbaka' | 'moto' | 'car'
const kindOf = (mode: string): Kind => (mode === 'woro' ? 'woro' : mode === 'gbaka' ? 'gbaka' : mode === 'moto' ? 'moto' : mode === 'compteur' || mode === 'taxi' ? 'taxi' : 'car')
const NAME: Record<Kind, string> = { taxi: 'le taxi compteur', woro: 'le woro-woro', gbaka: 'le gbaka', moto: 'la moto-taxi', car: 'la voiture' }

/** The vehicle from the side, facing left: its body in its colour, the windows, the wheels turning. */
function Side({ kind, color, trim }: { kind: Kind; color: string; trim?: string }) {
  const wheel = (cx: number) => (
    <g className="trip-wheel" style={{ transformOrigin: `${cx}px 62px` }}>
      <circle cx={cx} cy="62" r="11" fill="#1d1d20" />
      <circle cx={cx} cy="62" r="5" fill="#9aa1a8" />
      <rect x={cx - 1} y="52" width="2" height="20" fill="#5a5f66" />
    </g>
  )
  if (kind === 'moto')
    return (
      <svg width="120" height="80" viewBox="0 0 120 80" aria-hidden>
        <path d="M30 50 L58 34 L86 40 L96 50 Z" fill={color} stroke="#1d1d20" strokeWidth="2" />
        <path d="M24 44 L36 30" stroke="#1d1d20" strokeWidth="4" />
        <rect x="56" y="30" width="26" height="6" rx="3" fill="#2b2b2b" />
        {/* The driver, his helmet */}
        <rect x="44" y="12" width="12" height="22" rx="4" fill="#3d5a80" />
        <circle cx="48" cy="9" r="7" fill="#f2c94c" />
        {wheel(26)}
        {wheel(94)}
      </svg>
    )
  const long = kind === 'gbaka' ? 190 : 150
  return (
    <svg width={long} height="80" viewBox={`0 0 ${long} 80`} aria-hidden>
      {kind === 'gbaka' ? (
        <path d={`M6 58 L6 22 Q8 10 22 10 L${long - 14} 10 Q${long - 4} 10 ${long - 4} 22 L${long - 4} 58 Z`} fill={color} stroke="#1d1d20" strokeWidth="2.5" />
      ) : (
        <path d={`M6 58 L8 40 Q10 34 22 32 L40 16 Q44 12 52 12 L${long - 50} 12 Q${long - 40} 12 ${long - 32} 22 L${long - 22} 32 Q${long - 6} 34 ${long - 4} 44 L${long - 4} 58 Z`} fill={color} stroke="#1d1d20" strokeWidth="2.5" />
      )}
      {/* The windows */}
      {kind === 'gbaka'
        ? [0, 1, 2, 3, 4].map((i) => <rect key={i} x={18 + i * 32} y="16" width="26" height="18" rx="3" fill="#b9e3f5" stroke="#1d1d20" strokeWidth="1.5" />)
        : [
            <path key="a" d="M44 18 L54 16 L72 16 L72 32 L32 32 Z" fill="#b9e3f5" stroke="#1d1d20" strokeWidth="1.5" />,
            <path key="b" d={`M78 16 L${long - 52} 16 Q${long - 44} 18 ${long - 38} 32 L78 32 Z`} fill="#b9e3f5" stroke="#1d1d20" strokeWidth="1.5" />,
          ]}
      {trim && <rect x="8" y="40" width={long - 14} height="5" fill={trim} />}
      {kind === 'taxi' && <rect x={long / 2 - 14} y="4" width="28" height="9" rx="2" fill="#fff3bf" stroke="#1d1d20" strokeWidth="1.5" />}
      {kind === 'gbaka' && <text x={long / 2} y="52" textAnchor="middle" fontSize="11" fontWeight="800" fill="#1d1d20">ADJAMÉ · YOP</text>}
      {wheel(kind === 'gbaka' ? 34 : 34)}
      {wheel(long - 34)}
    </svg>
  )
}

/** The perso walking up and climbing in: a little figure in its colours. */
function Figure({ look }: { look: Look }) {
  return (
    <svg width="26" height="56" viewBox="0 0 26 56" aria-hidden>
      <circle cx="13" cy="8" r="7" fill={look.skin} />
      <rect x="5" y="16" width="16" height="20" rx="4" fill={look.outfitColor ?? '#ff7a00'} />
      <rect x="6" y="35" width="6" height="18" rx="2" fill={look.bottomColor || '#2b3a55'} className="trip-leg-a" />
      <rect x="14" y="35" width="6" height="18" rx="2" fill={look.bottomColor || '#2b3a55'} className="trip-leg-b" />
    </svg>
  )
}

export function TripLoading({ mode, to, look, color, trim, onDone }: { mode: string; /** Where to: the commune's name. */ to: string; look: Look; /** The vehicle's colours (game/rides rideLook). */ color?: string; trim?: string; onDone: () => void }) {
  const kind = kindOf(mode)
  const done = useRef(onDone)
  done.current = onDone
  useEffect(() => {
    const t = setTimeout(() => done.current(), TRIP_LOADING_MS)
    return () => clearTimeout(t)
  }, [])
  const body = color ?? (kind === 'taxi' ? '#ff8c1a' : kind === 'gbaka' ? '#2f9e44' : kind === 'moto' ? '#c92a2a' : '#4dabf7')
  return (
    <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center gap-5 overflow-hidden p-6" style={{ background: 'linear-gradient(#ffcf8a 0%, #ffb065 45%, #6b6f78 45%, #55595f 100%)' }}>
      <style>{`
        @keyframes trip-in { from { transform: translateX(110vw) } to { transform: translateX(0) } }
        @keyframes trip-out { 0% { transform: translateX(0) } 100% { transform: translateX(-130vw) } }
        @keyframes trip-walk { 0% { transform: translateX(-40vw); opacity: 1 } 85% { transform: translateX(0); opacity: 1 } 100% { transform: translateX(0) scale(0.9); opacity: 0 } }
        @keyframes trip-lines { from { background-position: 0 0 } to { background-position: -160px 0 } }
        @keyframes trip-spin { to { transform: rotate(360deg) } }
        @keyframes trip-step { 0%,100% { transform: rotate(14deg) } 50% { transform: rotate(-14deg) } }
        @keyframes trip-bar { from { width: 0 } to { width: 100% } }
        .trip-wheel { animation: trip-spin 0.35s linear infinite }
        .trip-leg-a { transform-origin: 9px 35px; animation: trip-step 0.3s ease-in-out infinite }
        .trip-leg-b { transform-origin: 17px 35px; animation: trip-step 0.3s ease-in-out infinite reverse }
      `}</style>
      {/* The city behind, far away */}
      <div className="absolute inset-x-0 top-[22%] flex h-[23%] items-end justify-around opacity-40">
        {[38, 62, 46, 80, 54, 70, 42].map((h, i) => (
          <span key={i} className="w-[9%] rounded-t-md bg-[#8a5a3a]" style={{ height: `${h}%` }} />
        ))}
      </div>
      {/* The road, its lines going by once off */}
      <div className="absolute inset-x-0 top-[62%] h-1.5" style={{ background: 'repeating-linear-gradient(90deg, #fff 0 40px, transparent 40px 80px)', animation: 'trip-lines 0.4s linear infinite 1.6s' }} />
      <div className="absolute inset-x-0 top-[47%] z-10 h-24">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2" style={{ animation: `trip-in 0.8s cubic-bezier(.2,.8,.3,1) both, trip-out 1.4s cubic-bezier(.6,0,.9,.6) 1.8s forwards` }}>
          <Side kind={kind} color={body} trim={trim} />
        </div>
        <div className="absolute bottom-0 left-[calc(50%-10px)]" style={{ animation: 'trip-walk 0.9s linear 0.8s both' }}>
          <Figure look={look} />
        </div>
      </div>
      <div className="relative z-10 mt-auto w-full max-w-[340px] text-center">
        <div className="font-display text-[20px] font-extrabold text-white [text-shadow:0_2px_0_rgba(0,0,0,0.35)]">En route pour {to}</div>
        <div className="text-[13px] font-extrabold text-white/85">Tu montes dans {NAME[kind]}…</div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-black/25">
          <div className="h-full rounded-full bg-[#ffc233]" style={{ animation: `trip-bar ${TRIP_LOADING_MS}ms linear forwards` }} />
        </div>
      </div>
    </div>
  )
}
