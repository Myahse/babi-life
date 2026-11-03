import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Play, Volume2, VolumeX, X } from 'lucide-react'
import { Shot3D } from './Shot3D'
import type { Scenario } from './types'
import { lineAudio, plain } from './lines'
import { playSfx } from './sfx'
import { t as tr } from '../../lib/i18n'

// A story's prologue as a film (types.ts): its shots one after the other in 3D, a little letterboxed,
// each line said (its MP3, tools/voix/prologues.mjs) and written under, the speaker's name over it; the
// title at the start, « À toi de jouer » at the end. A shot lasts its time, or its line's if longer.
// « Passer » goes to the end.

export function PrologueFilm({ scenario, onClose }: { scenario: Scenario; onClose: () => void }) {
  const [i, setI] = useState(0)
  const [t, setT] = useState(0)
  const [muted, setMuted] = useState(false)
  const [done, setDone] = useState(false)
  // Each line's sound, and how long it lasts once known.
  const audio = useMemo(() => scenario.shots.map((s, k) => (s.line ? lineAudio(scenario.id, k) : null)), [scenario])
  const lengths = useRef<number[]>([])
  useEffect(() => {
    audio.forEach((a, k) => a && a.addEventListener('loadedmetadata', () => (lengths.current[k] = a.duration)))
    return () => audio.forEach((a) => a?.pause())
  }, [audio])
  const shot = scenario.shots[i]
  const dur = Math.max(shot.dur, (lengths.current[i] ?? 0) + 0.7)
  // The clock: the shot's seconds; its line said as it starts.
  useEffect(() => {
    if (done) return
    const a = audio[i]
    if (a) {
      a.currentTime = 0
      a.muted = muted
      void a.play().catch(() => undefined)
    }
    // Its sound (the comic's word), as it starts.
    playSfx(scenario.shots[i].bd?.sfx, muted)
    let last = performance.now()
    let tt = 0
    let raf = 0
    const tick = (now: number) => {
      tt += Math.min(0.1, (now - last) / 1000)
      last = now
      setT(tt)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => (cancelAnimationFrame(raf), a?.pause())
  }, [i, done]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (done || t < dur) return
    if (i + 1 < scenario.shots.length) {
      setT(0)
      setI(i + 1)
    } else setDone(true)
  }, [t, dur, i, done, scenario.shots.length])
  useEffect(() => audio.forEach((a) => a && (a.muted = muted)), [muted, audio])
  const who = shot.line && shot.line.who !== 'narr' ? scenario.cast[shot.line.who]?.name : ''
  return (
    <div className="fixed inset-0 z-[95] flex flex-col bg-black">
      {/* Upright, the picture in a 3:4 frame in the middle, the line under it; wide, the whole screen. */}
      <div className="relative flex-1 portrait:flex portrait:flex-col portrait:justify-center">
        <div className="relative h-full portrait:h-auto portrait:aspect-[3/4] portrait:max-h-[72%] portrait:w-full">
          <Canvas shadows dpr={[1, 2]} camera={{ fov: 40, near: 0.1, far: 120 }} gl={{ antialias: true }}>
            <Shot3D scenario={scenario} shot={shot} t={Math.min(t, dur)} />
          </Canvas>
          {/* The letterbox (wide) */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[7%] bg-black portrait:hidden" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[7%] bg-black portrait:hidden" />
        </div>
        {/* The title, over the first shot */}
        {i === 0 && t < 3.2 && (
          <div className="pointer-events-none absolute inset-x-0 top-[14%] text-center" style={{ opacity: Math.min(1, t * 2, (3.2 - t) * 2) }}>
            <div className="text-[12px] font-extrabold tracking-[0.3em] text-white/80 uppercase drop-shadow">{tr('Les histoires du quartier')}</div>
            <div className="font-display text-[34px] leading-tight font-extrabold text-white drop-shadow-[0_3px_8px_rgba(0,0,0,0.6)]">{scenario.title}</div>
          </div>
        )}
        {/* The line, under */}
        {shot.line && !done && t > 0.3 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-[9%] flex justify-center px-4 portrait:bottom-[max(1.5rem,var(--sab,env(safe-area-inset-bottom)))]">
            <div className="max-w-[560px] rounded-2xl bg-black/65 px-4 py-2.5 text-center backdrop-blur-sm">
              {who && <div className="text-[12px] font-extrabold tracking-wide text-[#ffc233] uppercase">{who}</div>}
              <div className={`text-[16px] leading-snug font-bold text-white ${who ? '' : 'italic'}`}>{plain(shot.line.text)}</div>
            </div>
          </div>
        )}
        <div className="absolute top-[max(0.75rem,var(--sat,env(safe-area-inset-top)))] right-3 flex gap-2">
          <button className="grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white" onClick={() => setMuted(!muted)} aria-label={muted ? tr('Remettre le son') : tr('Couper le son')}>
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          {!done && (
            <button className="rounded-full bg-black/50 px-3 text-[13px] font-extrabold text-white" onClick={() => setDone(true)}>
              {tr('Passer')}
            </button>
          )}
          <button className="grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white" onClick={onClose} aria-label={tr('Fermer')}>
            <X size={18} />
          </button>
        </div>
        {/* The end: to play */}
        {done && (
          <div className="absolute inset-0 grid place-items-center bg-black/55 p-6 text-center">
            <div className="animate-pop max-w-[420px]">
              <div className="font-display text-[28px] leading-tight font-extrabold text-white">{scenario.title}</div>
              <p className="mt-2 text-[15px] font-bold text-white/85">{scenario.end ?? tr('À toi de jouer.')}</p>
              <button className="btn mt-5 !px-6 !py-3 !text-base" onClick={onClose}>
                <Play size={18} /> {tr('À toi de jouer')}
              </button>
              <button className="mt-3 block w-full text-[13px] font-bold text-white/70 underline" onClick={() => (setDone(false), setT(0), setI(0))}>
                {tr('Revoir')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
