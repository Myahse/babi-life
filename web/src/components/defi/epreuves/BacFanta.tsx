import { useEffect, useMemo, useState } from 'react'
import { Flash, Hud, beep, fx } from './kit'
import { Bust3D } from './bust'
import { setExpression } from '../../../avatar/expressions'
import { t } from '../../../lib/i18n'

// « Le bac de Fanta », chapter 2 (game/epreuves.go): the night before the bac, the garba eaten, now the
// philo. Fanta's revision cards face down, two by two: each philosopher has his idea somewhere among them.
// Turn two: the philosopher and his idea, they stay up; not the pair, they go back down. All the pairs
// before the time's out, in as few turns as can be.

const TIME = 75
const PAIRS: [string, string][] = [
  ['Descartes', '« Je pense, donc je suis »'],
  ['Socrate', '« Connais-toi toi-même »'],
  ['Sartre', '« L’existence précède l’essence »'],
  ['Rousseau', 'Le contrat social'],
  ['Pascal', '« Le cœur a ses raisons… »'],
  ['Platon', 'L’allégorie de la caverne'],
  ['Kant', 'L’impératif catégorique'],
  ['Nietzsche', '« Dieu est mort »'],
]

type Card = { pair: number; text: string; who: boolean }

export default function BacFanta({ onEnd }: { onEnd: (score: number) => void }) {
  const cards = useMemo<Card[]>(
    () =>
      PAIRS.flatMap(([a, b], i) => [
        { pair: i, text: a, who: true },
        { pair: i, text: b, who: false },
      ]).sort(() => Math.random() - 0.5),
    [],
  )
  const [up, setUp] = useState<number[]>([])
  const [done, setDone] = useState<Set<number>>(new Set())
  const [turns, setTurns] = useState(0)
  const [left, setLeft] = useState(TIME)
  const [flash, setFlash] = useState({ text: '', at: 0 })
  const [over, setOver] = useState(false)

  useEffect(() => {
    if (over) return
    const id = setInterval(() => setLeft((l) => l - 0.25), 250)
    return () => clearInterval(id)
  }, [over])
  useEffect(() => {
    if (over || (left > 0 && done.size < PAIRS.length)) return
    setOver(true)
    const all = done.size === PAIRS.length
    // All found: 70, and up to 30 more for few turns (8 is perfect) and time left.
    const score = all ? Math.round(70 + Math.max(0, 1 - (turns - 8) / 16) * 20 + (left / TIME) * 10) : Math.round((done.size / PAIRS.length) * 65)
    if (all) setFlash({ text: t('Prête pour le bac !'), at: Date.now() })
    setTimeout(() => onEnd(Math.min(100, score)), 1000)
  }, [left, done, turns, over, onEnd])

  const flip = (i: number, at: { x: number; y: number }) => {
    if (over || up.includes(i) || done.has(cards[i].pair) || up.length >= 2) return
    const next = [...up, i]
    setUp(next)
    beep(600, 0.05, 0.06)
    if (next.length < 2) return
    setTurns((n) => n + 1)
    const [a, b] = next.map((k) => cards[k])
    if (a.pair === b.pair) {
      beep(660, 0.12, 0.12)
      beep(880, 0.18, 0.12)
      fx.good(at.x, at.y, t('La paire !'))
      setExpression('fanta', 'laugh', 1300)
      if (done.size + 1 === PAIRS.length) fx.win()
      setTimeout(() => (setDone((d) => new Set(d).add(a.pair)), setUp([])), 350)
    } else (fx.shake(4), setExpression('fanta', 'thinking', 1200), setTimeout(() => setUp([]), 900))
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-[linear-gradient(#2b2d5c,#1a1b3a)]">
      <Hud title={t('Réviser la philo')} left={left} done={`${done.size}/${PAIRS.length}`} />
      {/* Fanta revising with you, in 3D: she laughs at a pair, frowns when it's not */}
      <div className="mx-auto mt-14 h-20 w-20 shrink-0 overflow-hidden rounded-full bg-[radial-gradient(circle_at_50%_35%,#4c6ef5,#1a1b3a)] shadow">
        <Bust3D seed={808} gender="femme" faceId="fanta" over={{ hair: 'braids', outfit: 'casual', outfitColor: '#ffd43b', accessory: 'glasses' }} className="h-full w-full" cam={[0, 1.5, 1.5]} look={[0, 1.42, 0]} />
      </div>
      <div className="mx-auto mt-1 grid w-full max-w-[460px] flex-1 grid-cols-4 content-center gap-2 p-3">
        {cards.map((c, i) => {
          const shown = up.includes(i) || done.has(c.pair)
          return (
            <button
              key={i}
              onClick={(e) => flip(i, fx.local(e))}
              className={`flex aspect-[3/4] items-center justify-center rounded-xl p-1 text-center text-[11px] leading-tight font-extrabold shadow-[0_3px_0_rgba(0,0,0,0.35)] transition active:scale-95 ${shown ? (done.has(c.pair) ? 'bg-[#d3f9d8] text-[#1b4332]' : c.who ? 'bg-[#fff4e6] text-[#7a3a12]' : 'bg-[#fff9db] text-[#3d2b1f]') : 'bg-[#4c6ef5] text-white'}`}
            >
              {shown ? <span className={c.who ? 'font-display text-[13px]' : 'italic'}>{c.text}</span> : <span className="font-display text-2xl">?</span>}
            </button>
          )
        })}
      </div>
      <Flash text={flash.text} at={flash.at} />
      <p className="pb-4 text-center text-xs font-bold text-white/75">{t('Retourne deux fiches : le philosophe et son idée. {n} tours', { n: turns })}</p>
    </div>
  )
}
