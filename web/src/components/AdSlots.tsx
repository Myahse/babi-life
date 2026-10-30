import { useEffect, useRef } from 'react'
import { ExternalLink, Megaphone } from 'lucide-react'
import { openAd, seen, type LiveAd } from '../lib/ads'
import { t } from '../lib/i18n'

// Babi Pub in the apps (lib/ads.ts): a full-screen slide between
// Tikitoko's videos, a sponsored post in Babigram's feed. Marked
// « Sponsorisé »; a tap on « En savoir plus » opens the advertiser's link
// outside the game. Counted as seen once on screen.

/** Every this many posts, an ad (when there are any). */
export const AD_EVERY = { tikitoko: 5, babigram: 4 }

/** The feed with an ad slipped in every `every` posts, the ads in turn. */
export function withAds<T>(posts: T[], ads: LiveAd[], every: number): ({ post: T } | { ad: LiveAd; key: string })[] {
  const out: ({ post: T } | { ad: LiveAd; key: string })[] = []
  posts.forEach((post, i) => {
    out.push({ post })
    if (ads.length && (i + 1) % every === 0) out.push({ ad: ads[Math.floor(i / every) % ads.length], key: `ad${i}` })
  })
  return out
}

function Media({ ad, play, className }: { ad: LiveAd; play: boolean; className: string }) {
  const v = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const el = v.current
    if (!el) return
    if (play) void el.play().catch(() => undefined)
    else el.pause()
  }, [play])
  return ad.type === 'video' ? <video ref={v} src={ad.url} loop muted playsInline preload="metadata" className={className} /> : <img src={ad.url} alt={ad.title} draggable={false} className={className} />
}

/** Seen once, the first time it's on screen. */
function useSeen(commune: string, ad: LiveAd, on: boolean) {
  const done = useRef(false)
  useEffect(() => {
    if (!on || done.current) return
    done.current = true
    seen(commune, ad.id)
  }, [on, commune, ad.id])
}

/** Tikitoko: the ad as a full-screen slide, like a video. */
export function TikiAd({ ad, commune, active }: { ad: LiveAd; commune: string; active: boolean }) {
  useSeen(commune, ad, active)
  return (
    <section className="relative grid h-full w-full snap-start snap-always place-items-center overflow-hidden bg-black select-none">
      <Media ad={ad} play={active} className="max-h-full w-full object-contain" />
      <span className="absolute top-[max(3.5rem,calc(env(safe-area-inset-top)+3rem))] left-3 flex items-center gap-1 rounded-md bg-white/20 px-2 py-0.5 text-[11px] font-extrabold text-white backdrop-blur">
        <Megaphone size={12} /> {t('Sponsorisé')}
      </span>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pt-16 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-white">
        <p className="text-[15px] font-extrabold">{ad.advertiser}</p>
        <p className="text-[13.5px] font-semibold text-white/85">{ad.title}</p>
        {ad.link && (
          <button onClick={() => openAd(ad)} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#fe2c55] py-2.5 text-[14px] font-extrabold active:scale-[0.98]">
            {t('En savoir plus')} <ExternalLink size={15} />
          </button>
        )}
      </div>
    </section>
  )
}

/** Babigram: the ad as a sponsored post. */
export function GramAd({ ad, commune }: { ad: LiveAd; commune: string }) {
  const box = useRef<HTMLElement>(null)
  const shown = useRef(false)
  useEffect(() => {
    const el = box.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !shown.current) {
        shown.current = true
        seen(commune, ad.id)
      }
    }, { threshold: 0.6 })
    io.observe(el)
    return () => io.disconnect()
  }, [commune, ad.id])
  return (
    <article ref={box} className="pb-3">
      <header className="flex items-center gap-2.5 px-3 py-2">
        <span className="grid h-[34px] w-[34px] place-items-center rounded-full bg-[#fff1e3] text-[var(--color-orange)]">
          <Megaphone size={17} />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[13.5px] font-extrabold">{ad.advertiser}</p>
          <p className="text-[12px] font-semibold text-black/60">{t('Sponsorisé')}</p>
        </div>
      </header>
      <div className="relative w-full overflow-hidden bg-[#f0f0f2]">
        <Media ad={ad} play className="block w-full" />
      </div>
      {ad.link && (
        <button onClick={() => openAd(ad)} className="flex w-full items-center justify-between border-b border-black/5 bg-[#f7f7f8] px-3 py-2.5 text-[13.5px] font-extrabold text-[#3b82f6]">
          {t('En savoir plus')} <ExternalLink size={16} />
        </button>
      )}
      <p className="px-3 pt-2 text-[13.5px] leading-snug">
        <span className="font-extrabold">{ad.advertiser}</span> {ad.title}
      </p>
    </article>
  )
}
