import { useEffect, useRef, useState } from 'react'
import { Flash, Hud, beep } from './kit'
import { t } from '../../../lib/i18n'

// « La recette de Mémé Ahou », chapter 1 (game/epreuves.go): « prouve-moi que tu as du goût ». Mémé Ahou
// gives the sauce graine's seasonings one after another, each its mark on the pot's gauge (« jusque-là,
// pas plus »): hold the button to pour, let go on the mark. Too little, it's flat; too much, ruined. Five
// seasonings, her look at the end.

const INGREDIENTS = () => [
  { name: t('L’huile rouge'), color: '#e8590c', speed: 34 },
  { name: t('Le sel'), color: '#f1f3f5', speed: 26 },
  { name: t('Le piment'), color: '#c92a2a', speed: 40 },
  { name: t('Le poisson fumé'), color: '#8a5a2b', speed: 30 },
  { name: t('L’aubergine'), color: '#5f3dc4', speed: 36 },
]

export default function RecetteAhou({ onEnd }: { onEnd: (score: number) => void }) {
  const list = useRef(INGREDIENTS()).current
  const marks = useRef(list.map(() => 35 + Math.random() * 50)).current
  const [k, setK] = useState(0)
  const [level, setLevel] = useState(0)
  const [pouring, setPouring] = useState(false)
  const [scores, setScores] = useState<number[]>([])
  const [flash, setFlash] = useState({ text: '', at: 0 })
  const last = useRef(0)

  useEffect(() => {
    if (!pouring) return
    last.current = performance.now()
    let raf = 0
    const step = (n: number) => {
      const dt = (n - last.current) / 1000
      last.current = n
      setLevel((l) => Math.min(100, l + list[k].speed * dt))
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    const pour = setInterval(() => beep(180 + Math.random() * 60, 0.05, 0.03, { type: 'triangle' }), 90)
    return () => (cancelAnimationFrame(raf), clearInterval(pour))
  }, [pouring, k, list])

  const stop = () => {
    if (!pouring) return
    setPouring(false)
    const off = Math.abs(level - marks[k])
    // Within 3 on the gauge: perfect; past 25 off: nothing.
    const sc = Math.max(0, Math.min(100, Math.round(100 - Math.max(0, off - 3) * 4.5)))
    const next = [...scores, sc]
    setScores(next)
    beep(sc >= 80 ? 880 : sc >= 50 ? 660 : 220, 0.2, 0.12, { type: sc >= 50 ? 'sine' : 'square' })
    setFlash({ text: sc >= 85 ? t('Mémé hoche la tête') : sc >= 50 ? t('Hmm… ça ira') : level > marks[k] ? t('Trop ! Aïe aïe aïe') : t('Pas assez…'), at: Date.now() })
    setTimeout(() => {
      if (k + 1 >= list.length) onEnd(Math.round(next.reduce((a, b) => a + b, 0) / next.length))
      else (setK(k + 1), setLevel(0))
    }, 900)
  }

  const ing = list[k]
  return (
    <div className="absolute inset-0 flex flex-col items-center bg-[linear-gradient(#7a4a2a,#3d2414)] text-white select-none">
      <Hud title={t('La sauce de Mémé Ahou')} done={`${Math.min(k + 1, list.length)}/${list.length}`} />
      <div className="mt-20 text-center">
        <div className="text-xs font-bold text-white/70">{t('Mémé Ahou : « Mets-moi…')}</div>
        <div className="font-display text-2xl font-extrabold" style={{ color: ing.color === '#f1f3f5' ? '#fff' : ing.color }}>
          {ing.name} {t('jusqu’au trait »')}
        </div>
      </div>
      {/* The pot, its gauge with Mémé's mark */}
      <div className="relative mt-6 flex flex-1 items-end pb-6">
        <div className="relative h-[300px] w-[150px] overflow-hidden rounded-b-[60px] rounded-t-xl border-4 border-[#212529] bg-[#343a40]">
          <div className="absolute inset-x-0 bottom-0 transition-[height] duration-75" style={{ height: `${level}%`, background: `linear-gradient(${ing.color}, #5c3a21)` }} />
          <div className="absolute inset-x-0 border-t-4 border-dashed border-[#ffd43b]" style={{ bottom: `${marks[k]}%` }} />
          <div className="absolute -right-0 text-[10px] font-extrabold text-[#ffd43b]" style={{ bottom: `calc(${marks[k]}% + 2px)` }}>
            {t('Mémé')}
          </div>
          {pouring && <div className="absolute top-0 left-1/2 h-full w-2 -translate-x-1/2" style={{ background: ing.color, opacity: 0.8 }} />}
        </div>
      </div>
      <button
        className="mb-[max(20px,env(safe-area-inset-bottom))] h-20 w-[min(90%,340px)] rounded-[28px] bg-[#ffd43b] font-display text-xl font-extrabold text-[#3d2414] shadow-[0_6px_0_#b08900] active:translate-y-1"
        onPointerDown={() => scores.length === k && setPouring(true)}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
      >
        {pouring ? t('Ça coule…') : t('Garde appuyé pour verser')}
      </button>
      <Flash text={flash.text} at={flash.at} />
    </div>
  )
}
