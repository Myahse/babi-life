import { useEffect, useState } from 'react'
import { Clapperboard, RefreshCw, X } from 'lucide-react'
import { EPOCH, clock } from '../game/rules'
import { serverNow } from '../lib/worldClock'
import { t as tr, tx } from '../lib/i18n'

// The ciné-club's films (backend game/cinema.go CineClub), watched for real
// from the Sim's seat: the film's own video on its makers' channel, in the
// player its site gives to be shown elsewhere (YouTube's, without its
// cookies), from the moment the séance has got to. Every player in the room
// is at the same moment of it: where it starts comes from the séance's
// time, not from when the player taps. Where YouTube's player won't play (a
// phone, an app that blocks it), « Autre lecteur » plays the same film's
// file (its copy at the Internet Archive) in the browser's own, at the same
// moment.

/** Seconds into the film now, from its séance's start (a game minute). */
const into = (at: number) => (serverNow() - (EPOCH + at * 60000)) / 1000

/** The button under the séance: a countdown till it starts, then « Regarder le film ». */
export function FilmButton({ at, onWatch }: { at: number; onWatch: () => void }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])
  const s = into(at)
  if (s < 0)
    return (
      <div className="card animate-pop mt-2 flex items-center gap-2 p-2.5 text-sm font-extrabold text-[var(--color-ink-soft)]">
        <Clapperboard size={18} /> {tx('Le film commence à {time} : installe-toi.', { time: clock(at).time })}
      </div>
    )
  return (
    <button className="btn animate-pop mt-2 w-full !py-2.5" onClick={onWatch}>
      <Clapperboard size={18} /> {tr('Regarder le film')}
    </button>
  )
}

/** The film on the whole screen, at the séance's moment; closed, the Sim stays in its seat. */
export function FilmPlayer({ video, at, title, credit, file, onClose }: { video: string; at: number; title: string; credit?: string; /** The film as a file, for the browser's own player. */ file?: string; onClose: () => void }) {
  // Where the séance is when the player opens (it plays on from there).
  const [start] = useState(() => Math.max(0, Math.floor(into(at))))
  const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(video)}?start=${start}&autoplay=1&playsinline=1&rel=0&modestbranding=1`
  const [own, setOwn] = useState(false)
  return (
    <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-black/95 p-3" role="dialog" aria-label={title}>
      <div className="mb-2 flex w-full max-w-4xl items-center gap-2 text-white">
        <Clapperboard size={18} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-[17px] leading-tight font-extrabold">{title}</div>
          {credit && <div className="truncate text-[11px] font-bold opacity-70">{credit}</div>}
        </div>
        {file && (
          <button className="flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-xs font-extrabold text-white" onClick={() => setOwn((o) => !o)}>
            <RefreshCw size={14} /> {own ? tr('Lecteur YouTube') : tr('Autre lecteur')}
          </button>
        )}
        <button className="icon-btn shrink-0 bg-white/15 text-white" onClick={onClose} aria-label={tr('Fermer le film')}>
          <X size={22} strokeWidth={2.6} />
        </button>
      </div>
      <div className="relative aspect-video w-full max-w-4xl overflow-hidden rounded-xl bg-black">
        {own && file ? (
          // The browser's own player, put where the séance is now (and again if it falls behind while it loads).
          <video
            className="absolute inset-0 h-full w-full"
            src={file}
            controls
            autoPlay
            playsInline
            onLoadedMetadata={(e) => (e.currentTarget.currentTime = Math.max(0, into(at)))}
            onPlaying={(e) => {
              if (Math.abs(e.currentTarget.currentTime - into(at)) > 8) e.currentTarget.currentTime = Math.max(0, into(at))
            }}
          />
        ) : (
          <iframe className="absolute inset-0 h-full w-full" src={src} title={title} allow={tr('autoplay; encrypted-media; picture-in-picture; fullscreen')} allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
        )}
      </div>
    </div>
  )
}
