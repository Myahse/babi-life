import { Car, ShoppingBag, Bike, HandCoins, MessageCircleMore } from 'lucide-react'

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

const LOOK: Record<string, { bg: string; fg: string; mark: (s: number) => React.ReactNode }> = {
  waye: { bg: 'linear-gradient(160deg,#5fd3ff,#1aa6e6)', fg: '#fff', mark: (s) => <Penguin size={s} /> },
  golvo: { bg: 'linear-gradient(160deg,#ffd45c,#ffb703)', fg: '#0b6e4f', mark: (s) => <Bike size={s} strokeWidth={2.4} /> },
  gnango: { bg: 'linear-gradient(160deg,#2b2f45,#141416)', fg: '#ffd166', mark: (s) => <Car size={s} strokeWidth={2.4} /> },
  idrive: { bg: 'linear-gradient(160deg,#d7ff4f,#a6e10f)', fg: '#141416', mark: (s) => <HandCoins size={s} strokeWidth={2.4} /> },
  tikitoko: { bg: 'linear-gradient(160deg,#23232d,#101015)', fg: '#ff7a00', mark: (s) => <TikiNote size={s} /> },
  gbairai: { bg: 'linear-gradient(160deg,#ff9f43,#f0590c)', fg: '#fff', mark: (s) => <MessageCircleMore size={s} strokeWidth={2.4} /> },
  store: { bg: 'linear-gradient(160deg,#7aa7ff,#3b5bfd)', fg: '#fff', mark: (s) => <ShoppingBag size={s} strokeWidth={2.4} /> },
}

export const appColor = (id: string) => LOOK[id]?.fg ?? '#161a2b'

export function AppLogo({ id, size = 60, radius = 18 }: { id: string; size?: number; radius?: number }) {
  const l = LOOK[id] ?? LOOK.store
  return (
    <span className="relative inline-grid shrink-0 place-items-center shadow-[0_6px_14px_-6px_rgba(0,0,0,0.35)]" style={{ width: size, height: size, borderRadius: radius, background: l.bg, color: l.fg }}>
      {l.mark(Math.round(size * (id === 'waye' || id === 'tikitoko' ? 0.78 : 0.5)))}
    </span>
  )
}
