import { Car, ShoppingBag, Bike, HandCoins, MessageCircleMore, Trophy, Clapperboard } from 'lucide-react'

// Logos of the phone's store apps. Invented brands: their own colours and
// marks, nodding to the services they are modelled on.

/** Waye's penguin. */
function Penguin({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <ellipse cx="24" cy="27" rx="13" ry="16" fill="#14213d" />
      <ellipse cx="24" cy="30" rx="8.5" ry="11.5" fill="#fff" />
      <circle cx="20" cy="18" r="2.6" fill="#fff" />
      <circle cx="28" cy="18" r="2.6" fill="#fff" />
      <circle cx="20.6" cy="18.4" r="1.2" fill="#14213d" />
      <circle cx="27.4" cy="18.4" r="1.2" fill="#14213d" />
      <path d="M21 22.5 L24 25.5 L27 22.5 Z" fill="#ffb703" />
      <path d="M17 42 q3 -2 6 0 M25 42 q3 -2 6 0" stroke="#ffb703" strokeWidth="2.6" fill="none" strokeLinecap="round" />
    </svg>
  )
}

/** Tikitoko's mark: a play button in a speech bubble, in the flag's orange and green. */
function TikiNote({ size }: { size: number }) {
  const bubble = 'M10 12a6 6 0 0 1 6-6h16a6 6 0 0 1 6 6v14a6 6 0 0 1-6 6H22l-7 6v-6h1a6 6 0 0 1-6-6z'
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path d={bubble} fill="#12c48b" transform="translate(2 2)" />
      <path d={bubble} fill="#ff7a00" />
      <path d="M21 13.5v11l9-5.5z" fill="#fff" />
    </svg>
  )
}

/** Babigram's mark: a little print, tilted, with the sun going down on the lagoon, and the shutter's dot. */
function GramPrint({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <g transform="rotate(-8 24 24)">
        <rect x="9" y="8" width="30" height="33" rx="4" fill="#fff" />
        <rect x="12.5" y="11.5" width="23" height="20" rx="2" fill="#ffb347" />
        <circle cx="24" cy="24" r="5" fill="#fff4c2" />
        <path d="M12.5 25.5q3-2 5.75 0t5.75 0 5.75 0 5.75 0V29.5a2 2 0 0 1-2 2h-19a2 2 0 0 1-2-2z" fill="#0f9d8a" />
        <circle cx="33.5" cy="36" r="1.8" fill="#0f9d8a" />
      </g>
    </svg>
  )
}

/** Dodo's mark: a little house asleep under the moon. */
function DodoHouse({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path d="M33 7a8 8 0 1 0 8 10 6.5 6.5 0 1 1-8-10z" fill="#ffe08a" />
      <path d="M9 25 24 13l15 12v15a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2z" fill="#fff" />
      <path d="M20 42V32h8v10" fill="#7c3aed" />
      <path d="M14 26h5M14 30h3" stroke="#c4b5fd" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

const LOOK: Record<string, { bg: string; fg: string; mark: (s: number) => React.ReactNode }> = {
  waye: { bg: 'linear-gradient(160deg,#5fd3ff,#1aa6e6)', fg: '#fff', mark: (s) => <Penguin size={s} /> },
  golvo: { bg: 'linear-gradient(160deg,#ffd45c,#ffb703)', fg: '#0b6e4f', mark: (s) => <Bike size={s} strokeWidth={2.4} /> },
  gnango: { bg: 'linear-gradient(160deg,#2b2f45,#141416)', fg: '#ffd166', mark: (s) => <Car size={s} strokeWidth={2.4} /> },
  idrive: { bg: 'linear-gradient(160deg,#d7ff4f,#a6e10f)', fg: '#141416', mark: (s) => <HandCoins size={s} strokeWidth={2.4} /> },
  babigram: { bg: 'linear-gradient(160deg,#2ec4b6,#0f9d8a 55%,#14532d)', fg: '#0f9d8a', mark: (s) => <GramPrint size={s} /> },
  tikitoko: { bg: 'linear-gradient(160deg,#23232d,#101015)', fg: '#ff7a00', mark: (s) => <TikiNote size={s} /> },
  bet225: { bg: 'linear-gradient(160deg,#17291f,#0e1a14)', fg: '#22c55e', mark: (s) => <span style={{ fontSize: s * 0.42, fontWeight: 900, letterSpacing: -1 }}>225</span> },
  parisfoot: { bg: 'linear-gradient(160deg,#a78bfa,#6d28d9)', fg: '#fff', mark: (s) => <Trophy size={s} strokeWidth={2.4} /> },
  gbairai: { bg: 'linear-gradient(160deg,#ff9f43,#f0590c)', fg: '#fff', mark: (s) => <MessageCircleMore size={s} strokeWidth={2.4} /> },
  dodo: { bg: 'linear-gradient(160deg,#8b5cf6,#4c1d95)', fg: '#7c3aed', mark: (s) => <DodoHouse size={s} /> },
  kineo: { bg: 'linear-gradient(160deg,#e63946,#6b0716)', fg: '#c8102e', mark: (s) => <Clapperboard size={s} strokeWidth={2.4} color="#fff" /> },
  dames: { bg: 'linear-gradient(160deg,#c8894a,#5c3317)', fg: '#8a4b1f', mark: (s) => <Draughts size={s} /> },
  huit: { bg: 'linear-gradient(160deg,#2f9e44,#0b5d2a)', fg: '#1b7a3a', mark: (s) => <Cards size={s} /> },
  store: { bg: 'linear-gradient(160deg,#7aa7ff,#3b5bfd)', fg: '#fff', mark: (s) => <ShoppingBag size={s} strokeWidth={2.4} /> },
}

/** Dames 225: a white man on a dark one, as stacked on the board when crowned. */
function Draughts({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <ellipse cx="12" cy="15.5" rx="8" ry="3.2" fill="#1b120c" />
      <rect x="4" y="12.5" width="16" height="3" fill="#1b120c" />
      <ellipse cx="12" cy="12.5" rx="8" ry="3.2" fill="#3a2716" />
      <ellipse cx="12" cy="10" rx="8" ry="3.2" fill="#e9dcc3" />
      <rect x="4" y="7" width="16" height="3" fill="#e9dcc3" />
      <ellipse cx="12" cy="7" rx="8" ry="3.2" fill="#fff8ea" />
      <ellipse cx="12" cy="7" rx="4.2" ry="1.6" fill="none" stroke="#c8a676" strokeWidth="0.9" />
    </svg>
  )
}

/** 8 américain: two cards fanned, the 8 on top. */
function Cards({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <rect x="3.5" y="4.5" width="11" height="15" rx="2" transform="rotate(-12 9 12)" fill="#fff" stroke="#0b5d2a" strokeWidth="0.8" />
      <rect x="9" y="4" width="11" height="15" rx="2" transform="rotate(10 14.5 11.5)" fill="#fff" stroke="#0b5d2a" strokeWidth="0.8" />
      <text x="14.6" y="14.6" textAnchor="middle" fontSize="8.5" fontWeight="900" fill="#c92a2a" transform="rotate(10 14.5 11.5)">
        8
      </text>
    </svg>
  )
}

export const appColor = (id: string) => LOOK[id]?.fg ?? '#161a2b'

export function AppLogo({ id, size = 60, radius = 18 }: { id: string; size?: number; radius?: number }) {
  const l = LOOK[id] ?? LOOK.store
  return (
    <span className="relative inline-grid shrink-0 place-items-center shadow-[0_6px_14px_-6px_rgba(0,0,0,0.35)]" style={{ width: size, height: size, borderRadius: radius, background: l.bg, color: l.fg }}>
      {l.mark(Math.round(size * (id === 'waye' || id === 'tikitoko' || id === 'babigram' ? 0.78 : 0.5)))}
    </span>
  )
}
