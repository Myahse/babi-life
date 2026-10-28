import { lazy, Suspense, useEffect, useState } from 'react'
import { SplashDancer } from './SplashDancer'

// The game's own perso, dancing, once three.js has come (it's big: the flat one meanwhile).
const SplashAvatar = lazy(() => import('./SplashAvatar'))

// Loading: on a plain warm background, the game's perso dancing over its
// shadow (SplashAvatar, the flat SplashDancer till 3D is there), « Babi Life » letter by letter, a light running along the bar, and
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

export function Splash({ label, className }: { /** What's loading, instead of the street's words. */ label?: string; /** Another background (a dark one: the words in white). */ className?: string }) {
  // Plain and warm by default, no gradient; on a dark background of its own (the stadium's green), white words.
  const light = !className
  const [tip, setTip] = useState(() => Math.floor(Math.random() * TIPS.length))
  useEffect(() => {
    if (label) return
    const t = setInterval(() => setTip((k) => (k + 1) % TIPS.length), 3200)
    return () => clearInterval(t)
  }, [label])
  return (
    <div className={`relative grid h-full w-full place-items-center overflow-hidden ${light ? 'bg-[#fff4e8] text-[var(--color-ink)]' : `text-white ${className}`}`} role="status" aria-live="polite">
      <div className="relative flex flex-col items-center">
        {/* A perso dancing while it loads: the game's own in 3D, the flat one till it's there */}
        <Suspense fallback={<SplashDancer size={92} />}>
          <SplashAvatar size={150} />
        </Suspense>
        <div className={`splash-shadow mt-1 h-2.5 w-14 rounded-[50%] blur-[2px] ${light ? 'bg-black/15' : 'bg-black/45'}`} aria-hidden />
        <div className="mt-4 font-display text-[34px] leading-none font-extrabold tracking-[-0.02em]" aria-label="Babi Life">
          {[...'Babi Life'].map((c, i) => (
            <span key={i} className={`splash-letter ${i > 4 ? 'text-[var(--color-orange)]' : ''}`} style={{ animationDelay: `${250 + i * 45}ms` }} aria-hidden>
              {c === ' ' ? ' ' : c}
            </span>
          ))}
        </div>
        <div className={`mt-6 h-1.5 w-44 overflow-hidden rounded-full ${light ? 'bg-black/10' : 'bg-white/12'}`}>
          <div className="splash-bar h-full w-full" />
        </div>
        <p key={label ?? tip} className={`splash-tip mt-4 h-5 text-sm font-bold ${light ? 'text-[var(--color-ink-soft)]' : 'text-white/70'}`}>
          {label ?? TIPS[tip]}
        </p>
      </div>
    </div>
  )
}
