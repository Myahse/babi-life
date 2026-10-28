import { useEffect, useRef, useState } from 'react'
import { Play, SkipForward, Volume2 } from 'lucide-react'
import { Logo } from './ui'
import { playCinematic, stopCinematic } from '../world3d/cinematic'

// The arrival (update « arrivee »): the first time in the game, before Koffi's
// tuto. The camera flies over the player's commune, its roads and its people
// (world3d/cinematic.tsx), « Bienvenue à Babi Life », then Awa's welcome
// (public/video/akwaba.mp4, marketing/scripts/bienvenue.md). Each part can be
// skipped; it's seen once (on this browser).

const KEY = 'babi.arrivee'
export const arrivalDue = () => {
  try {
    return localStorage.getItem(KEY) !== 'done'
  } catch {
    return false
  }
}
const seen = () => {
  try {
    localStorage.setItem(KEY, 'done')
  } catch {
    /* private window */
  }
}

const FLIGHT = 13

export function Arrival({ commune, firstName, onEnd }: { commune: string; firstName: string; onEnd: () => void }) {
  const [part, setPart] = useState<'fly' | 'title' | 'awa' | 'watch'>('fly')
  const [t, setT] = useState(0)
  const end = () => {
    stopCinematic()
    seen()
    onEnd()
  }
  // The flight, a moment after the street is there; then the title.
  useEffect(() => {
    if (part !== 'fly') return
    let gone = false
    const since = performance.now()
    const tick = setInterval(() => setT((performance.now() - since) / 1000), 200)
    const go = setTimeout(() => void playCinematic(FLIGHT).then(() => !gone && setPart('title')), 600)
    return () => ((gone = true), clearInterval(tick), clearTimeout(go))
  }, [part])
  useEffect(() => {
    // (In development, a capture can hold it: globalThis.__holdArrival.)
    if (part !== 'title' || (import.meta.env.DEV && (globalThis as { __holdArrival?: boolean }).__holdArrival)) return
    const k = setTimeout(() => setPart('awa'), 3200)
    return () => clearTimeout(k)
  }, [part])
  const video = useRef<HTMLVideoElement>(null)
  useEffect(() => () => stopCinematic(), [])

  const skip = (
    <button className="pointer-events-auto fixed top-[max(0.9rem,env(safe-area-inset-top))] right-3 z-[92] flex items-center gap-1.5 rounded-full bg-black/45 px-3.5 py-2 text-[13px] font-extrabold text-white backdrop-blur" onClick={part === 'fly' ? () => (stopCinematic(), setPart('title')) : end}>
      Passer <SkipForward size={15} />
    </button>
  )

  if (part === 'fly')
    return (
      <div className="pointer-events-none fixed inset-0 z-[90]">
        {/* Black bars, as at the cinema */}
        <div className="absolute inset-x-0 top-0 h-[9vh] bg-black" />
        <div className="absolute inset-x-0 bottom-0 h-[9vh] bg-black" />
        {skip}
        <div className="absolute bottom-[13vh] left-5 text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.7)]" style={{ opacity: Math.min(1, Math.max(0, (t - 1.5) / 0.8)) * Math.min(1, Math.max(0, (FLIGHT - 2.5 - t) / 0.8)) }}>
          <div className="text-[13px] font-extrabold tracking-[0.25em] uppercase opacity-85">Abidjan</div>
          <div className="font-display text-[42px] leading-none font-extrabold">{commune}</div>
          <div className="mt-1 text-[15px] font-bold opacity-90">Les rues, les gens, la vie… ta vie commence ici.</div>
        </div>
      </div>
    )

  if (part === 'title')
    return (
      <div className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-5 bg-gradient-to-b from-[#ff8a3d] to-[#e8590c] px-8 text-center text-white" onClick={() => setPart('awa')}>
        {skip}
        <div className="animate-pop">
          <Logo size={72} tone="dark" />
        </div>
        <h1 className="animate-pop font-display text-[44px] leading-[0.95] font-extrabold">
          Bienvenue à<br />
          Babi Life, {firstName} !
        </h1>
        <p className="text-[16px] font-bold opacity-90">La vie à Abidjan, dans ton téléphone.</p>
      </div>
    )

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black">
      {skip}
      {part === 'awa' ? (
        // Sound needs a touch first: Awa's picture, and « Regarder ».
        <button className="relative h-full max-h-[100dvh] w-auto" onClick={() => (setPart('watch'), setTimeout(() => void video.current?.play().catch(() => undefined), 0))}>
          <img src="/video/akwaba.jpg" alt="" className="h-full max-h-[100dvh] w-auto object-contain opacity-80" />
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
            <span className="grid h-20 w-20 place-items-center rounded-full bg-[var(--color-orange)] shadow-xl">
              <Play size={38} fill="currentColor" />
            </span>
            <span className="rounded-full bg-black/50 px-4 py-2 text-[16px] font-extrabold">Awa a un message pour toi</span>
            <span className="flex items-center gap-1.5 text-[13px] font-bold opacity-85">
              <Volume2 size={15} /> Monte le son !
            </span>
          </span>
        </button>
      ) : null}
      {/* H.264 for most; WebM for the browsers without it */}
      <video ref={video} poster="/video/akwaba.jpg" playsInline preload="auto" className={part === 'watch' ? 'h-full max-h-[100dvh] w-auto' : 'hidden'} onEnded={end}>
        <source src="/video/akwaba.mp4" type="video/mp4" />
        <source src="/video/akwaba.webm" type="video/webm" />
      </video>
    </div>
  )
}
