import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { ChevronRight, Play, Volume2, VolumeX, X } from 'lucide-react'
import { Shot3D } from './Shot3D'
import type { Scenario } from './types'
import { lineAudio, plain } from './lines'
import { playSfx } from './sfx'
import { t as tr } from '../../lib/i18n'

// A story's prologue as an animated comic (types.ts): a page of panels, one coming after the other (a tap,
// or by itself once its line is said), each its shot as a picture (public/prologues/<id>/<n>.jpg, drawn
// by tools/prologues/panels.mjs; not drawn yet: the shot itself, live), slowly zooming; the narrator in a
// yellow box, the cast in white bubbles, a sound written big. Each line said as its panel comes.

function Panel({ scenario, n, on }: { scenario: Scenario; n: number; on: boolean }) {
  const shot = scenario.shots[n]
  const [drawn, setDrawn] = useState(true)
  const line = shot.line
  const narr = line?.who === 'narr'
  const who = line && !narr ? scenario.cast[line.who]?.name : ''
  const right = shot.bd?.side === 'right'
  return (
    <div className="bd-in relative overflow-hidden border-[3px] border-[#1a1410] bg-[#1a1410] shadow-[4px_4px_0_#1a1410]" style={{ aspectRatio: n === 0 ? '16/9' : n % 3 === 2 ? '16/10' : '4/3' }}>
      {drawn ? (
        <img src={`/prologues/${scenario.id}/${n}.jpg`} alt="" className="bd-zoom absolute inset-0 h-full w-full object-cover" onError={() => setDrawn(false)} />
      ) : on ? (
        <Canvas className="!absolute inset-0" dpr={[1, 1.5]} camera={{ fov: 40, near: 0.1, far: 120 }}>
          <Shot3D scenario={scenario} shot={shot} t={shot.dur * 0.55} />
        </Canvas>
      ) : (
        <div className="absolute inset-0 bg-[#2b2f45]" />
      )}
      {line && narr && <div className="bd-pop absolute top-2 left-2 max-w-[78%] border-2 border-[#1a1410] bg-[#ffd43b] px-2.5 py-1.5 text-[13.5px] leading-snug font-extrabold text-[#1a1410] shadow-[2px_2px_0_#1a1410]">{plain(line.text)}</div>}
      {line && !narr && (
        <div className={`bd-pop absolute bottom-3 max-w-[74%] ${right ? 'right-3' : 'left-3'}`}>
          <div className="relative rounded-[18px] border-2 border-[#1a1410] bg-white px-3 py-2 text-[14px] leading-snug font-extrabold text-[#1a1410]">
            {who && <div className="text-[10.5px] tracking-wide text-[#c2410c] uppercase">{who}</div>}
            {plain(line.text)}
            <span className={`absolute -top-[11px] ${right ? 'right-6' : 'left-6'} h-0 w-0 border-x-[9px] border-b-[12px] border-x-transparent border-b-[#1a1410]`} />
            <span className={`absolute -top-[8px] ${right ? 'right-[26px]' : 'left-[26px]'} h-0 w-0 border-x-[7px] border-b-[10px] border-x-transparent border-b-white`} />
          </div>
        </div>
      )}
      {shot.bd?.sfx && (
        <div
          className="bd-sfx pointer-events-none absolute top-[38%] right-3 -rotate-6 font-display text-[30px] font-extrabold text-[#ffd43b]"
          style={{
            WebkitTextStroke: '2px #1a1410',
            textShadow: '3px 3px 0 #1a1410',
          }}
        >
          {shot.bd.sfx}
        </div>
      )}
    </div>
  )
}

export function PrologueBD({ scenario, onClose }: { scenario: Scenario; onClose: () => void }) {
  const [k, setK] = useState(0)
  const [muted, setMuted] = useState(false)
  const [auto, setAuto] = useState(true)
  const audio = useMemo(() => scenario.shots.map((s, n) => (s.line ? lineAudio(scenario.id, n) : null)), [scenario])
  const page = useRef<HTMLDivElement>(null)
  const end = k >= scenario.shots.length
  // Each panel as it comes: into view, its line said; then the next by itself (after its line, or its time).
  useEffect(() => {
    page.current?.lastElementChild?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    })
    if (end) return
    audio.forEach((a) => a?.pause())
    const a = audio[k]
    playSfx(scenario.shots[k]?.bd?.sfx, muted)
    let next: ReturnType<typeof setTimeout> | undefined
    const go = () => auto && (next = setTimeout(() => setK((x) => (x === k ? x + 1 : x)), 900))
    if (a && !muted) {
      a.currentTime = 0
      a.onended = go
      a.onerror = () => (next = setTimeout(() => auto && setK((x) => (x === k ? x + 1 : x)), scenario.shots[k].dur * 1000))
      void a.play().catch(() => (next = setTimeout(() => auto && setK((x) => (x === k ? x + 1 : x)), scenario.shots[k].dur * 1000)))
    } else next = setTimeout(() => auto && setK((x) => (x === k ? x + 1 : x)), scenario.shots[k].dur * 1000)
    return () => {
      if (next) clearTimeout(next)
      if (a) a.onended = null
    }
  }, [k, muted, auto]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => audio.forEach((a) => a?.pause()), [audio])
  return (
    <div className="fixed inset-0 z-[95] flex flex-col bg-[#efe4cc]">
      <div className="flex items-center gap-2 border-b-[3px] border-[#1a1410] bg-[#1f8f88] px-3 py-2 pt-[max(0.5rem,var(--sat,env(safe-area-inset-top)))] text-[#fbf5e6]">
        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] font-extrabold tracking-[0.25em] uppercase opacity-80">{tr('Les histoires du quartier')}</div>
          <div className="truncate font-display text-[19px] leading-tight font-extrabold">{scenario.title}</div>
        </div>
        <button className="grid h-9 w-9 place-items-center rounded-full bg-black/25" onClick={() => setMuted(!muted)} aria-label={muted ? tr('Remettre le son') : tr('Couper le son')}>
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
        <button className="grid h-9 w-9 place-items-center rounded-full bg-black/25" onClick={onClose} aria-label={tr('Fermer')}>
          <X size={18} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3" onClick={() => !end && (setAuto(false), setK(k + 1))}>
        <div ref={page} className="mx-auto flex max-w-[520px] flex-col gap-3 pb-24">
          {scenario.shots.slice(0, Math.min(k + 1, scenario.shots.length)).map((_, n) => (
            <Panel key={n} scenario={scenario} n={n} on={n === k} />
          ))}
          {end && (
            <div className="bd-in border-[3px] border-[#1a1410] bg-[#26332c] p-5 text-center text-[#f1eee4] shadow-[4px_4px_0_#1a1410]">
              <p className="text-[16px] font-bold">{scenario.end ?? tr('À toi de jouer.')}</p>
              <button className="btn mt-4 !px-6 !py-3 !text-base" onClick={onClose}>
                <Play size={18} /> {tr('À toi de jouer')}
              </button>
              <button className="mt-3 block w-full text-[13px] font-bold underline opacity-75" onClick={(e) => (e.stopPropagation(), setAuto(true), setK(0))}>
                {tr('Relire')}
              </button>
            </div>
          )}
        </div>
      </div>
      {!end && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-3 pb-[max(0.75rem,var(--sab,env(safe-area-inset-bottom)))]">
          <button className="btn pointer-events-auto !px-5 !py-2.5" onClick={() => (setAuto(false), setK(k + 1))}>
            {tr('Suite')} <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  )
}
