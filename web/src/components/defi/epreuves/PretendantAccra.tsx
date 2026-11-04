import { useEffect, useMemo, useState } from 'react'
import { Flash, Hud, beep, fx } from './kit'
import { t } from '../../../lib/i18n'

// « Le prétendant d'Accra », chapter 2 (game/epreuves.go): at the market, what a real kente is worth, and
// how to tell it: the hand-woven strips repeat their blocks in a strict order, the copy gets it wrong.
// Each strip has a block missing: pick the one the weaver would have put there. Eight strips, the
// patterns longer and finer as they go.

const TIME = 60
const ROUNDS = 8
const COLORS = ['#f2b705', '#1b7f3b', '#c1121f', '#111111', '#1d4e89']
type Block = { c: number; m: number } // colour, motif (0 bars, 1 zigzag, 2 checks)

function strip(round: number) {
  const period = 2 + Math.min(3, Math.floor(round / 2))
  const twoWay = round >= 4
  const base: Block[] = Array.from({ length: period }, () => ({ c: Math.floor(Math.random() * COLORS.length), m: twoWay ? Math.floor(Math.random() * 3) : 0 }))
  // Not all the same.
  if (base.every((b) => b.c === base[0].c && b.m === base[0].m)) base[0] = { c: (base[0].c + 1) % COLORS.length, m: base[0].m }
  const len = period * 2 + 2
  const blocks = Array.from({ length: len }, (_, i) => base[i % period])
  const hole = period + Math.floor(Math.random() * (len - period))
  const right = blocks[hole]
  const opts: Block[] = [right]
  while (opts.length < 4) {
    const o = { c: Math.floor(Math.random() * COLORS.length), m: twoWay ? Math.floor(Math.random() * 3) : 0 }
    if (!opts.some((x) => x.c === o.c && x.m === o.m)) opts.push(o)
  }
  return { blocks, hole, right, opts: opts.sort(() => Math.random() - 0.5) }
}

export default function PretendantAccra({ onEnd }: { onEnd: (score: number) => void }) {
  const [round, setRound] = useState(0)
  const s = useMemo(() => strip(round), [round])
  const [good, setGood] = useState(0)
  const [left, setLeft] = useState(TIME)
  const [picked, setPicked] = useState<number | null>(null)
  const [flash, setFlash] = useState({ text: '', at: 0 })
  const [over, setOver] = useState(false)

  useEffect(() => {
    if (over) return
    const id = setInterval(() => setLeft((l) => l - 0.25), 250)
    return () => clearInterval(id)
  }, [over])
  useEffect(() => {
    if (over || left > 0) return
    setOver(true)
    onEnd(Math.round((good / ROUNDS) * 85))
  }, [left, over, good, onEnd])

  const pick = (i: number, e: React.MouseEvent) => {
    if (picked !== null || over) return
    const spot = fx.local(e)
    const o = s.opts[i]
    const ok = o.c === s.right.c && o.m === s.right.m
    setPicked(i)
    const g = good + (ok ? 1 : 0)
    if (ok) (setGood(g), beep(700, 0.1, 0.12), fx.good(spot.x, spot.y, t('Tissé main !')))
    else (beep(170, 0.25, 0.12, { type: 'square' }), fx.bad(spot.x, spot.y, t('Copie !')))
    setTimeout(() => {
      setPicked(null)
      if (round + 1 >= ROUNDS) {
        setOver(true)
        const score = Math.round((g / ROUNDS) * 85 + (g === ROUNDS ? Math.max(0, left / TIME) * 15 : 0))
        if (score >= 80) fx.win()
        setFlash({ text: g >= 6 ? t('Tu connais le kente !') : t('Il faudra demander aux tisserands…'), at: Date.now() })
        setTimeout(() => onEnd(score), 900)
      } else setRound(round + 1)
    }, 800)
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center bg-[linear-gradient(#fff3bf,#f2b705)] px-4 select-none">
      <Hud title={t('Le vrai kente')} left={left} done={`${Math.min(round + 1, ROUNDS)}/${ROUNDS}`} />
      <div className="mt-20 text-center text-sm font-extrabold text-[#5c3a06]">{t('Quel bloc manque à la bande tissée ?')}</div>
      {/* The strip, its hole */}
      <div className="mt-4 flex w-full max-w-[460px] flex-wrap justify-center gap-1 rounded-xl bg-[#3d2b1f] p-2 shadow-lg">
        {s.blocks.map((b, i) => (
          <div key={`${round}-${i}`} className="h-14 w-11">
            {i === s.hole ? <div className="grid h-full w-full place-items-center rounded-md border-2 border-dashed border-white/80 font-display text-2xl text-white">?</div> : <Kente b={b} />}
          </div>
        ))}
      </div>
      <div className="mt-auto mb-[max(20px,env(safe-area-inset-bottom))] grid w-full max-w-[380px] grid-cols-4 gap-3">
        {s.opts.map((o, i) => {
          const ok = o.c === s.right.c && o.m === s.right.m
          return (
            <button key={`${round}-${i}`} onClick={(e) => pick(i, e)} className={`h-20 rounded-xl p-1 shadow-[0_5px_0_rgba(0,0,0,0.3)] transition active:translate-y-1 ${picked !== null ? (ok ? 'bg-[#2f9e44]' : picked === i ? 'bg-[#e03131]' : 'bg-white') : 'bg-white'}`}>
              <Kente b={o} />
            </button>
          )
        })}
      </div>
      <Flash text={flash.text} at={flash.at} />
    </div>
  )
}

function Kente({ b }: { b: Block }) {
  const c = COLORS[b.c]
  const alt = b.c === 0 ? '#111111' : '#f2b705'
  const bg = b.m === 0 ? `repeating-linear-gradient(0deg, ${c} 0 7px, ${alt} 7px 10px)` : b.m === 1 ? `repeating-linear-gradient(45deg, ${c} 0 6px, ${alt} 6px 9px)` : `repeating-conic-gradient(${c} 0 25%, ${alt} 0 50%) 0 0 / 12px 12px`
  return <div className="h-full w-full rounded-md" style={{ background: bg }} />
}
