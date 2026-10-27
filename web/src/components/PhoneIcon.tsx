import type { LucideIcon } from 'lucide-react'

// The phone's home-screen icons, as on a real smartphone: the rounded square
// with its gradient, the light on its top, a thin edge, the white glyph with
// a little shadow; some apps drawn as their own (the map, the messages, the
// camera, the photos, the friends).

const DRAWN: Record<string, (s: number) => React.ReactNode> = {
  map: (s) => (
    <svg viewBox="0 0 60 60" width={s} height={s}>
      <rect width="60" height="60" fill="#e9f5e1" />
      <path d="M0 40 L60 22 L60 30 L0 48Z" fill="#ffd166" />
      <path d="M20 0 L28 0 L40 60 L32 60Z" fill="#fff" />
      <path d="M0 14 C20 18 34 10 60 12 L60 16 C34 14 20 22 0 18Z" fill="#9ad0ff" />
      <rect x="40" y="36" width="14" height="10" rx="2" fill="#7bd389" />
      <path d="M30 14c-5.5 0-9.5 4-9.5 9.2 0 7 9.5 15.8 9.5 15.8s9.5-8.8 9.5-15.8C39.5 18 35.5 14 30 14z" fill="#ff3b30" />
      <circle cx="30" cy="23" r="3.6" fill="#fff" />
    </svg>
  ),
  messages: (s) => (
    <svg viewBox="0 0 60 60" width={s} height={s}>
      <defs>
        <linearGradient id="pi-msg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#67f07a" />
          <stop offset="1" stopColor="#0bbf2f" />
        </linearGradient>
      </defs>
      <rect width="60" height="60" fill="url(#pi-msg)" />
      <path d="M30 13c-10.5 0-19 6.9-19 15.4 0 4.8 2.7 9.1 7 11.9-.4 2.6-1.8 5-3.6 6.7 3.6-.2 7-1.6 9.4-3.6 2 .5 4 .8 6.2.8 10.5 0 19-6.9 19-15.4S40.5 13 30 13z" fill="#fff" />
    </svg>
  ),
  camera: (s) => (
    <svg viewBox="0 0 60 60" width={s} height={s}>
      <defs>
        <linearGradient id="pi-cam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9ecef" />
          <stop offset="1" stopColor="#adb5bd" />
        </linearGradient>
      </defs>
      <rect width="60" height="60" fill="url(#pi-cam)" />
      <rect x="9" y="19" width="42" height="27" rx="6" fill="#2b2f36" />
      <rect x="22" y="14" width="16" height="7" rx="2.5" fill="#2b2f36" />
      <circle cx="30" cy="32.5" r="9.5" fill="#495057" stroke="#dee2e6" strokeWidth="2" />
      <circle cx="30" cy="32.5" r="5" fill="#1c7ed6" />
      <circle cx="28" cy="30.5" r="1.6" fill="#fff" opacity="0.8" />
      <circle cx="45" cy="24" r="1.8" fill="#ffd43b" />
    </svg>
  ),
  galerie: (s) => (
    <svg viewBox="0 0 60 60" width={s} height={s}>
      <rect width="60" height="60" fill="#fff" />
      {['#ff9f1c', '#ffd43b', '#94d82d', '#20c997', '#339af0', '#845ef7', '#f06595', '#ff6b6b'].map((c, i) => (
        <ellipse key={c} cx="30" cy="19" rx="5.5" ry="11" fill={c} opacity="0.85" transform={`rotate(${i * 45} 30 30)`} />
      ))}
    </svg>
  ),
  friends: (s) => (
    <svg viewBox="0 0 60 60" width={s} height={s}>
      <defs>
        <linearGradient id="pi-fr" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffa8c5" />
          <stop offset="1" stopColor="#e83e8c" />
        </linearGradient>
      </defs>
      <rect width="60" height="60" fill="url(#pi-fr)" />
      <circle cx="22" cy="24" r="7" fill="#fff" opacity="0.85" />
      <path d="M9 45c1-7.5 6.5-12 13-12s12 4.5 13 12z" fill="#fff" opacity="0.85" />
      <circle cx="38" cy="22" r="8" fill="#fff" />
      <path d="M23 46c1-8.5 7.5-13.5 15-13.5S52 37.5 53 46z" fill="#fff" />
    </svg>
  ),
}

export function PhoneIcon({ id, icon: Icon, colors, size = 56 }: { id: string; icon: LucideIcon; colors: [string, string]; size?: number }) {
  const r = Math.round(size * 0.235)
  const drawn = DRAWN[id]
  return (
    <span className="relative inline-block shrink-0 overflow-hidden shadow-[0_6px_14px_-6px_rgba(0,0,0,0.45)]" style={{ width: size, height: size, borderRadius: r }}>
      {drawn ? (
        drawn(size)
      ) : (
        <span className="grid h-full w-full place-items-center" style={{ background: `linear-gradient(160deg, ${colors[0]} 0%, ${colors[1]} 100%)` }}>
          <Icon size={Math.round(size * 0.5)} strokeWidth={2.1} color="#fff" style={{ filter: 'drop-shadow(0 1.5px 1.5px rgba(0,0,0,0.25))' }} />
        </span>
      )}
      {/* The light on the top, and the thin edge. */}
      <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.28), rgba(255,255,255,0))' }} />
      <span className="pointer-events-none absolute inset-0" style={{ borderRadius: r, boxShadow: 'inset 0 0 0 0.5px rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.12)' }} />
    </span>
  )
}
