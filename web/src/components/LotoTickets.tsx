import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { LotoTicket } from '../lib/types'
import { t as tr, tx } from '../lib/i18n'

// The Sim's Loto Chance tickets at the kiosk (backend sims/loto.go): those
// waiting for their draw, with the time left; those drawn, the five balls
// coming out one by one the first time one looks (then as they came out),
// the ticket's numbers lit among them, what it brought.

const SEEN = 'babi.loto.seen'
const seen = (): number[] => {
  try {
    return JSON.parse(localStorage.getItem(SEEN) ?? '[]')
  } catch {
    return []
  }
}
const markSeen = (id: number) => {
  try {
    localStorage.setItem(SEEN, JSON.stringify([...seen().filter((x) => x !== id), id].slice(-60)))
  } catch {
    // Private window: shown again next time.
  }
}

/** The chances of a ticket of 1, 2 or 3 numbers (all among the 5 drawn out of 90): C(5,k) / C(90,k). */
export const LOTO_ODDS: Record<number, number> = { 1: 18, 2: 400.5, 3: 11748 }

function Ball({ n, hit, delay }: { n: number; hit: boolean; delay: number }) {
  return (
    <span className="animate-pop grid h-7 w-7 place-items-center rounded-full text-[12px] font-black tabular-nums shadow-[inset_-2px_-3px_4px_rgba(0,0,0,0.25),0_2px_4px_rgba(0,0,0,0.3)]" style={{ animationDelay: `${delay}ms`, animationFillMode: 'backwards', background: hit ? 'radial-gradient(circle at 35% 30%,#fff3b0,#f2b705 60%,#c48a00)' : 'radial-gradient(circle at 35% 30%,#ffffff,#e9ecef 60%,#adb5bd)', color: hit ? '#5a3a00' : '#141416' }}>
      {n}
    </span>
  )
}

const left = (at: number) => {
  const s = Math.max(0, at - Date.now() / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.ceil((s % 3600) / 60)
  return h ? tr('dans {h} h {0}', { h, 0: String(m).padStart(2, '0') }) : tr('dans {m} min', { m })
}

export function LotoTickets({ simId, refresh }: { simId: string; /** Changes when a ticket was just bought. */ refresh?: number }) {
  const [tickets, setTickets] = useState<LotoTicket[] | null>(null)
  const [, tick] = useState(0)
  const [fresh] = useState(() => new Set(seen()))
  useEffect(() => {
    let live = true
    const load = () => api.myLoto(simId).then((t) => live && setTickets(t), () => undefined)
    void load()
    // Each minute: the time left, and a draw that has just been made.
    const t = setInterval(() => (tick((x) => x + 1), void load()), 60_000)
    return () => ((live = false), clearInterval(t))
  }, [simId, refresh])
  useEffect(() => {
    for (const t of tickets ?? []) if (t.drawn) markSeen(t.id)
  }, [tickets])
  if (!tickets?.length) return null
  const shown = tickets.slice(0, 5)
  return (
    <div className="mt-2 space-y-1.5">
      <div className="text-[10px] font-extrabold tracking-wider text-[var(--color-ink-soft)] uppercase">{tr('Mes tickets')}</div>
      {shown.map((t) => {
        const anim = t.drawn && !fresh.has(t.id)
        return (
          <div key={t.id} className={`rounded-xl px-2 py-1.5 ${t.status === 'won' ? 'bg-[#fff4cc]' : 'bg-[var(--color-canvas)]'}`}>
            <div className="flex items-center justify-between gap-1 text-[11px] font-extrabold">
              <span className="min-w-0 truncate">
                {tx('« {name} » · {0} · {1} Djai', { name: t.name, 0: t.numbers.join('-'), 1: t.stake.toLocaleString('fr-FR') })}
              </span>
              <span className={`shrink-0 ${t.status === 'won' ? 'text-[#b07a00]' : t.status === 'lost' ? 'text-[var(--color-ink-soft)]' : 'text-[#f26b1d]'}`}>{t.status === 'won' ? `+${t.payout.toLocaleString('fr-FR')}` : t.status === 'lost' ? tr('Perdu') : t.drawn ? tr('Tirage…') : left(t.draw)}</span>
            </div>
            {t.drawn && (
              <div className="mt-1 flex gap-1">
                {t.drawn.map((n, i) => (
                  <Ball key={n} n={n} hit={t.numbers.includes(n)} delay={anim ? 350 + i * 700 : 0} />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
