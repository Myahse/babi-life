import type { LucideIcon } from 'lucide-react'
import { Moon, Sun } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'

/** A flat rounded-square tile with a white icon: the game's icon language. */
export function IconTile({ icon: Icon, colors, size = 44, radius, className = '', style }: { icon: LucideIcon; colors: [string, string]; size?: number; radius?: number; className?: string; style?: CSSProperties }) {
  return (
    <span
      className={`relative inline-grid shrink-0 place-items-center text-white ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: radius ?? size * 0.3,
        background: colors[1],
        ...style,
      }}
    >
      <Icon size={size * 0.48} strokeWidth={2.2} />
    </span>
  )
}

/** A gold coin, used for every FCFA amount. */
export function Coin({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="shrink-0">
      <circle cx="12" cy="13" r="10" fill="#e09a00" />
      <circle cx="12" cy="11.5" r="10" fill="#ffc233" />
      <circle cx="12" cy="11.5" r="7" fill="none" stroke="#e09a00" strokeWidth="1.5" opacity="0.6" />
      <text x="12" y="15.3" textAnchor="middle" fontSize="10" fontWeight="800" fill="#b06d00" fontFamily="Baloo 2">F</text>
      <ellipse cx="8.5" cy="7.5" rx="3" ry="1.6" fill="#fff" opacity="0.55" transform="rotate(-25 8.5 7.5)" />
    </svg>
  )
}

/** The losange above every Sim, in the colours of the flag when happy. */
export function Plumbob({ color = '#00b86b', size = 20, className = '' }: { color?: string; size?: number; className?: string }) {
  return (
    <span className={`inline-block animate-float ${className}`} style={{ perspective: 200 }}>
      <svg width={size} height={size * 1.6} viewBox="0 0 40 64" className="animate-spin-y drop-shadow-[0_4px_6px_rgba(0,0,0,0.3)]" aria-hidden>
        <path d="M20 0 40 32 20 64 0 32Z" fill={color} />
        <path d="M20 0 40 32H20Z" fill="#fff" opacity="0.4" />
        <path d="M20 0 0 32h20Z" fill="#fff" opacity="0.15" />
        <path d="M0 32h20v32Z" fill="#000" opacity="0.2" />
      </svg>
    </span>
  )
}

/** Circular motive gauge (Sims-style need indicator). */
export function MotiveRing({ value, icon: Icon, label, size = 52 }: { value: number; icon: LucideIcon; label?: string; size?: number }) {
  const color = needColor(value)
  const r = size / 2 - 4
  const c = 2 * Math.PI * r
  const low = value < 25
  return (
    <div className="flex flex-col items-center gap-1" title={label ? `${label} : ${Math.round(value)} %` : undefined}>
      <div className={`relative ${low ? 'animate-pulse' : ''}`} style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="#fff" stroke="#eceef6" strokeWidth="5" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - value / 100)}
            style={{ transition: 'stroke-dashoffset 700ms ease, stroke 400ms' }}
          />
        </svg>
        <span className="absolute inset-0 grid place-items-center" style={{ color }}>
          <Icon size={size * 0.4} strokeWidth={2.6} />
        </span>
      </div>
      {label && <span className="text-[11px] leading-none font-extrabold text-[var(--color-ink-soft)]">{label}</span>}
    </div>
  )
}

export function needColor(v: number) {
  if (v >= 60) return '#00b86b'
  if (v >= 30) return '#ffa000'
  return '#ff3d57'
}

export function Chip({ children, tone = 'neutral', className = '' }: { children: ReactNode; tone?: 'neutral' | 'gold' | 'good' | 'bad' | 'dark'; className?: string }) {
  const tones = {
    neutral: 'bg-[var(--color-canvas)] text-[var(--color-ink-soft)]',
    gold: 'bg-[#fff4d6] text-[#a86800]',
    good: 'bg-[#e3f9ee] text-[var(--color-emerald-deep)]',
    bad: 'bg-[#ffe8ec] text-[#d81b3f]',
    dark: 'bg-black/35 text-white',
  }
  return <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-extrabold whitespace-nowrap ${tones[tone]} ${className}`}>{children}</span>
}

export function DayNight({ night, size = 18 }: { night: boolean; size?: number }) {
  return night ? <Moon size={size} className="text-[var(--color-violet)]" fill="currentColor" /> : <Sun size={size} className="text-[var(--color-orange)]" fill="currentColor" />
}

/** The app mark: a green plumbob over the Abidjan sun, as on the home-screen icon. */
export function LogoMark({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={`shrink-0 ${className}`} aria-hidden>
      <defs>
        <linearGradient id="lm-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b1f4b" />
          <stop offset="1" stopColor="#7a2f6e" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#lm-sky)" />
      <circle cx="32" cy="42" r="18" fill="#ff8a1a" />
      <path d="M8 64V46h7v-6h6v24M43 64V40h7v6h6v18" fill="#0f1230" opacity="0.9" />
      <path d="M32 9 43 26 32 43 21 26Z" fill="#00b86b" />
      <path d="M32 9 43 26H32Z" fill="#fff" opacity="0.38" />
      <path d="M21 26h11v17Z" fill="#000" opacity="0.18" />
    </svg>
  )
}

/** The logo: the mark and the wordmark "Ivoire Life" on one line. */
export function Logo({ size = 40, tone = 'light', className = '' }: { size?: number; tone?: 'light' | 'dark'; className?: string }) {
  return (
    <span className={`inline-flex items-center select-none ${className}`} style={{ gap: size * 0.28 }} aria-label="Ivoire Life">
      <LogoMark size={size} />
      <span className="font-display leading-none font-extrabold tracking-[-0.02em]" style={{ fontSize: size * 0.62 }} aria-hidden>
        <span className={tone === 'light' ? 'text-white' : 'text-[var(--color-ink)]'}>Ivoire </span>
        <span className="text-[var(--color-orange)]">Life</span>
      </span>
    </span>
  )
}

/** A tappable list row: icon tile, title, subtitle and a trailing slot. */
export function Row({ icon, colors, title, sub, onClick, children }: { icon: LucideIcon; colors: [string, string]; title: string; sub: string; onClick: () => void; children?: ReactNode }) {
  return (
    <li>
      <button onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl border border-[var(--color-line)] bg-white p-2.5 text-left transition hover:border-[#d6d9e5] hover:bg-[#fbfbfd] active:scale-[0.99]">
        <IconTile icon={icon} colors={colors} size={46} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-[17px] leading-tight font-extrabold">{title}</span>
          <span className="block truncate text-xs font-semibold text-[var(--color-ink-soft)]">{sub}</span>
        </span>
        {children}
      </button>
    </li>
  )
}
