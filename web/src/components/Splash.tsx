import { useEffect, useState } from 'react'
import { SplashDancer } from './SplashDancer'

// Loading: the Abidjan dusk, a blocky perso dancing the coupé-décalé over its
// shadow (SplashDancer), « Babi Life » letter by letter, a light running along the bar, and
// a little word of the street changing every few seconds.

const TIPS = [
  'On chauffe le garba…',
  'Le gbaka arrive, monte vite !',
  'On réveille le quartier…',
  'Les vendeuses installent leurs tables…',
  'Le maquis allume ses lampes…',
  'On cherche la monnaie pour le woro-woro…',
  'Le soleil se lève sur la lagune…',
]

export function Splash({ label, className = 'bg-[var(--color-night)]' }: { /** What's loading, instead of the street's words. */ label?: string; className?: string }) {
  const [tip, setTip] = useState(() => Math.floor(Math.random() * TIPS.length))
  useEffect(() => {
    if (label) return
    const t = setInterval(() => setTip((k) => (k + 1) % TIPS.length), 3200)
    return () => clearInterval(t)
  }, [label])
  return (
    <div className={`relative grid h-full w-full place-items-center overflow-hidden text-white ${className}`} role="status" aria-live="polite">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_45%_at_50%_62%,rgba(255,138,26,0.35),transparent_70%)]" aria-hidden />
      <div className="splash-sun pointer-events-none absolute top-[56%] left-1/2 -ml-[110px] h-[220px] w-[220px] rounded-full bg-[radial-gradient(circle,rgba(255,194,51,0.35),transparent_65%)]" aria-hidden />
      <div className="relative flex flex-col items-center">
        {/* A perso dancing the coupé-décalé while it loads */}
        <SplashDancer size={92} />
        <div className="splash-shadow mt-2 h-2.5 w-14 rounded-[50%] bg-black/45 blur-[2px]" aria-hidden />
        <div className="mt-4 font-display text-[34px] leading-none font-extrabold tracking-[-0.02em]" aria-label="Babi Life">
          {[...'Babi Life'].map((c, i) => (
            <span key={i} className={`splash-letter ${i > 4 ? 'text-[var(--color-orange)]' : ''}`} style={{ animationDelay: `${250 + i * 45}ms` }} aria-hidden>
              {c === ' ' ? ' ' : c}
            </span>
          ))}
        </div>
        <div className="mt-6 h-1.5 w-44 overflow-hidden rounded-full bg-white/12">
          <div className="splash-bar h-full w-full" />
        </div>
        <p key={label ?? tip} className="splash-tip mt-4 h-5 text-sm font-bold text-white/70">
          {label ?? TIPS[tip]}
        </p>
      </div>
    </div>
  )
}
