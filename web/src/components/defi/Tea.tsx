import { useEffect, useRef, useState } from 'react'
import { Pixels, STOVE, TEAPOT } from './Pixels'
import { haptic } from '../../lib/native'
import { t, tx } from '../../lib/i18n'

// Le défi du thé, as it's made at the grin: three little glasses. Held down,
// « Verser » pours, and the hand lifts the teapot higher and higher: poured
// from high, the tea foams (that's the art of it), but too high it splashes
// all round the glass. Let go, the teapot comes back down; pour again. Fill up
// to the line, not over, and serve. Each glass a little harder (the hand
// lifts faster), as the glasses go: bitter, then sweet, then sweeter.

const GLASSES = [
  { line: t('Le premier, amer comme la mort'), rise: 0.62 },
  { line: t('Le deuxième, doux comme la vie'), rise: 0.8 },
  { line: t("Le troisième, sucré comme l'amour"), rise: 1 },
]
/** How high (0–1) the stream foams without splashing. */
const ZONE: [number, number] = [0.55, 0.8]
/** Of the glass a second, pouring. */
const FILL = 0.2
/** The line to fill up to, on the glass. */
const LINE = 0.85
/** How far up the teapot goes (px) at the top of the gesture. */
const REACH = 200

type Glass = { fill: number; foam: number; spill: number }

/** A glass's score out of 100: filled to the line, the foam, nothing splashed. */
function glassScore(g: Glass) {
  const filled = g.fill > 1 ? 0 : 40 * Math.max(0, 1 - Math.abs(g.fill - LINE) / 0.25)
  const foam = 45 * Math.min(1, g.foam / 0.6)
  const clean = g.spill < 0.03 ? 15 : 0
  return Math.round(Math.max(0, Math.min(100, filled + foam + clean - Math.min(30, g.spill * 60))))
}
const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n)

export function TeaDefi({ onEnd }: { onEnd: (score: number) => void }) {
  const [glass, setGlass] = useState(0)
  const st = useRef({ h: 0, pouring: false, fill: 0, foam: 0, spill: 0 })
  const [, redraw] = useState(0)
  const [scores, setScores] = useState<number[]>([])
  const [served, setServed] = useState<{ score: number; foam: number; filled: boolean } | null>(null)
  const servedRef = useRef(false)

  const serve = () => {
    if (servedRef.current) return
    servedRef.current = true
    const s = st.current
    s.pouring = false
    const score = glassScore(s)
    haptic(s.fill > 1 ? 'error' : score >= 50 ? 'success' : 'medium')
    setServed({ score, foam: s.foam >= 0.55 ? 3 : s.foam >= 0.3 ? 2 : s.foam >= 0.1 ? 1 : 0, filled: s.fill <= 1 && Math.abs(s.fill - LINE) < 0.1 })
    const all = [...scores, score]
    setScores(all)
    setTimeout(() => {
      if (glass + 1 >= GLASSES.length) return onEnd(Math.round(all.reduce((a, b) => a + b, 0) / all.length))
      Object.assign(st.current, { h: 0, pouring: false, fill: 0, foam: 0, spill: 0 })
      servedRef.current = false
      setServed(null)
      setGlass(glass + 1)
    }, 1600)
  }

  // The hand and the tea, every frame.
  useEffect(() => {
    let last = performance.now()
    let raf = 0
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const s = st.current
      if (!servedRef.current) {
        if (s.pouring) {
          s.h = Math.min(1, s.h + GLASSES[glass].rise * dt)
          s.fill += FILL * dt
          if (s.h >= ZONE[0] && s.h <= ZONE[1]) s.foam += 0.5 * dt
          else if (s.h < ZONE[0]) s.foam += 0.08 * (s.h / ZONE[0]) * dt
          else s.spill += 0.5 * dt
          // Over the brim: served as it is.
          if (s.fill >= 1.05) serve()
        } else s.h = Math.max(0, s.h - 1.6 * dt)
      }
      redraw((n) => n + 1)
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [glass]) // eslint-disable-line react-hooks/exhaustive-deps
  // The space bar pours too, on a computer.
  useEffect(() => {
    const down = (e: KeyboardEvent) => e.code === 'Space' && (e.preventDefault(), (st.current.pouring = true))
    const up = (e: KeyboardEvent) => e.code === 'Space' && (st.current.pouring = false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => (window.removeEventListener('keydown', down), window.removeEventListener('keyup', up))
  }, [])

  const s = st.current
  const pouring = s.pouring && !served
  const splashing = pouring && s.h > ZONE[1]
  const foaming = pouring && s.h >= ZONE[0] && s.h <= ZONE[1]
  const tea = Math.min(1, s.fill)
  const foam = Math.min(tea, Math.min(0.3, s.foam * 0.4))
  // The glass on the table; the teapot over it, its spout just above the glass's middle.
  const GLASS = { w: 54, h: 82 }
  const potW = 96
  // The spout's height over the teapot's foot (px): where the stream comes from.
  const SPOUT = 30
  const lift = 26 + s.h * REACH
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pt-3 text-white">
        <div className="leading-tight">
          <div className="font-display text-[13px] font-extrabold tracking-wider text-white/70">{tx('VERRE {0} / 3', { 0: glass + 1 })}</div>
          <div className="font-display text-[16px] font-extrabold">{GLASSES[glass].line}</div>
        </div>
        <div className="flex gap-1">
          {GLASSES.map((_, k) => (
            <span key={k} className={`grid h-8 w-8 place-items-center rounded-full font-display text-[13px] font-extrabold ${k < scores.length ? 'bg-[#ffc233] text-[#16161c]' : k === glass ? 'bg-white/25' : 'bg-white/10'}`}>
              {k < scores.length ? scores[k] : k + 1}
            </span>
          ))}
        </div>
      </div>

      {/* The scene: the stove, the glass on the low table, the teapot in the hand; the height on the side */}
      <div className="relative mx-3 mt-3 min-h-0 flex-1 overflow-hidden rounded-[24px]" style={{ background: 'linear-gradient(#1b1f4b, #3d2a3e 55%, #6b3d22)' }}>
        {[[12, 10], [30, 18], [64, 8], [82, 22], [48, 14]].map(([x, y]) => (
          <span key={x} className="absolute h-1 w-1 rounded-full bg-white/70" style={{ left: `${x}%`, top: `${y}%` }} />
        ))}
        <div className="absolute inset-x-0 bottom-0 h-[30%]" style={{ background: 'linear-gradient(#9c6a3c 0 8px, #7a4a22 8px)' }} />
        {/* The stove, its coals breathing */}
        <div className="absolute bottom-[30%] left-[6%] translate-y-[38%]">
          <span className="absolute -top-6 left-1/2 h-14 w-24 -translate-x-1/2 animate-pulse rounded-full bg-[#ff8a00]/35 blur-xl" />
          <Pixels rows={STOVE.rows} palette={STOVE.palette} width={84} />
        </div>
        {/* The glass: the tea, the foam on it, the line */}
        <div className="absolute bottom-[30%] left-1/2 -translate-x-1/2 translate-y-[6px] overflow-hidden" style={{ width: GLASS.w, height: GLASS.h, borderRadius: '6px 6px 14px 14px', background: 'rgba(255,255,255,0.12)', boxShadow: 'inset 0 0 0 3px rgba(255,255,255,0.75)' }}>
          <span className="absolute inset-x-[3px] bottom-[3px]" style={{ height: `calc(${(tea - foam) * 100}% - 3px)`, background: 'linear-gradient(#c8641e, #7d3410)', borderRadius: '0 0 11px 11px' }} />
          <span className="absolute inset-x-[3px]" style={{ bottom: `${(tea - foam) * 100}%`, height: `${foam * 100}%`, background: 'radial-gradient(circle at 30% 40%, #fff 0 2px, transparent 2.5px) 0 0 / 9px 8px, radial-gradient(circle at 70% 60%, #fff 0 1.5px, transparent 2px) 0 0 / 7px 7px, #fbe9c6' }} />
          <span className="absolute inset-x-0 border-t-2 border-dashed border-[#ffc233]" style={{ bottom: `${LINE * 100}%` }} />
          {s.fill > 1 && <span className="absolute inset-0 animate-pulse bg-[#e03131]/30" />}
        </div>
        <span className="absolute bottom-[30%] left-1/2 translate-x-[34px] -translate-y-[66px] font-display text-[11px] font-extrabold text-[#ffc233]">{t('← le trait')}</span>
        {/* The glasses served, lined up on the table */}
        <div className="absolute right-[8%] bottom-[30%] flex translate-y-[4px] gap-1.5">
          {scores.map((sc, k) => (
            <span key={k} className="animate-pop relative block overflow-hidden" style={{ width: 22, height: 34, borderRadius: '3px 3px 7px 7px', boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.75)', background: 'linear-gradient(#fbe9c6 0 26%, #c8641e 26% 100%)' }}>
              <span className="absolute inset-x-0 -top-0.5 text-center text-[8px] font-extrabold text-[#7d3410]">{sc}</span>
            </span>
          ))}
        </div>
        {/* The stream from the spout to the glass: foaming in the right height, splashing over it */}
        {pouring && (
          <span className={`absolute left-1/2 w-[4px] -translate-x-1/2 rounded-full ${splashing ? 'animate-pulse' : ''}`} style={{ bottom: `calc(30% + ${GLASS.h * tea - 6}px)`, height: lift + GLASS.h * (1 - tea) + SPOUT, background: 'linear-gradient(#e08a3c, #b65a1a)', transform: splashing ? `translateX(${Math.sin(performance.now() / 40) * 3 - 2}px)` : undefined }} />
        )}
        {splashing &&
          [-34, -22, 26, 38].map((x, k) => (
            <span key={x} className="absolute h-[5px] w-[5px] bg-[#c8641e]" style={{ left: `calc(50% + ${x}px)`, bottom: `calc(30% + ${GLASS.h * 0.9 + ((performance.now() / 6 + k * 40) % 30)}px)` }} />
          ))}
        {foaming && <span className="absolute left-1/2 -translate-x-1/2 font-display text-[12px] font-extrabold text-[#fbe9c6]" style={{ bottom: `calc(30% + ${GLASS.h + 8}px)`, marginLeft: 40 }}>{t('ça mousse !')}</span>}
        {/* The teapot, lifted; tipped when pouring */}
        <div className="absolute" style={{ left: `calc(50% - ${potW - 6}px)`, bottom: `calc(30% + ${GLASS.h + lift - 10}px)`, transform: pouring ? 'rotate(24deg)' : 'rotate(4deg)', transformOrigin: '94% 40%', transition: 'transform 140ms' }}>
          <Pixels rows={TEAPOT.rows} palette={TEAPOT.palette} width={potW} />
        </div>
        {/* How high: the gold for the foam, the red where it splashes */}
        <div className="absolute right-3 bottom-[30%] w-3 overflow-visible rounded-full" style={{ height: REACH, marginBottom: GLASS.h + 16, background: `linear-gradient(to top, rgba(255,255,255,0.25) 0 ${ZONE[0] * 100}%, #ffc233 ${ZONE[0] * 100}% ${ZONE[1] * 100}%, #e03131 ${ZONE[1] * 100}%)` }}>
          <span className="absolute -left-2 h-0 w-0 border-y-[6px] border-l-[8px] border-y-transparent border-l-white" style={{ bottom: `calc(${s.h * 100}% - 6px)` }} />
        </div>
        {/* A glass served: how it was */}
        {served && (
          <div className="animate-pop absolute inset-x-6 top-6 rounded-[20px] bg-white/95 p-3 text-center text-[var(--color-ink)]">
            <div className="font-display text-[22px] font-extrabold">{served.score} / 100</div>
            <div className="text-[13px] font-extrabold text-[var(--color-ink-soft)]">
              {t('Mousse')} <span className="text-[#e09a00]">{stars(served.foam)}</span> · {served.filled ? t('pile au trait') : s.fill > 1 ? t('ça déborde !') : s.fill < LINE ? t('pas assez rempli') : t('un peu trop')}
            </div>
          </div>
        )}
      </div>

      {/* The hands: pour (held), serve */}
      <div className="grid grid-cols-[1fr_auto] gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          className="btn touch-none !py-4 !text-base select-none"
          style={{ background: pouring ? '#e05a00' : '#ff7a00', transform: pouring ? 'scale(0.97)' : undefined }}
          disabled={!!served}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            st.current.pouring = true
          }}
          onPointerUp={() => (st.current.pouring = false)}
          onPointerCancel={() => (st.current.pouring = false)}
          onContextMenu={(e) => e.preventDefault()}
        >
          {pouring ? t('Ça coule… lâche pour reposer') : t('Garde appuyé : verser')}
        </button>
        <button className="btn !bg-[var(--color-emerald)] !px-5 !py-4 !text-base" disabled={!!served || s.fill < 0.4} onClick={serve}>
          {t('Servir')}
        </button>
      </div>
    </div>
  )
}
