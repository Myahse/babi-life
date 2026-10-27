import { useEffect, useState } from 'react'
import { ChevronDown, History } from 'lucide-react'
import { api, type HistRound, type Historique, type HistTotal, errorText } from '../lib/api'
import { keyOpen, useFeatures } from '../lib/features'

// The « Historique » of a money game (backend sims/historique.go): the Sim's
// last rounds there, and what came of today and of the last seven days. Folded
// until opened; an update the team opens from the admin (« historique »).

const nf = (n: number) => n.toLocaleString('fr-FR')
const STATUS: Record<HistRound['status'], [string, string]> = {
  won: ['Gagné', '#7cfc9a'],
  lost: ['Perdu', '#ff9a9a'],
  tie: ['Remboursé', '#ffe08a'],
  open: ['En cours', '#c9d6ff'],
}
const when = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

function Total({ label, t }: { label: string; t: HistTotal }) {
  const net = t.back - t.staked
  return (
    <div className="rounded-2xl bg-black/25 px-3 py-2">
      <div className="text-[10px] font-extrabold tracking-wider text-white/60 uppercase">{label}</div>
      <div className="font-display text-[17px] leading-tight font-extrabold" style={{ color: net > 0 ? '#7cfc9a' : net < 0 ? '#ff9a9a' : undefined }}>
        {net > 0 ? '+' : ''}
        {nf(net)} Djai
      </div>
      <div className="text-[11px] font-bold text-white/60">
        {t.rounds} partie{t.rounds > 1 ? 's' : ''} · misé {nf(t.staked)} · rendu {nf(t.back)}
      </div>
    </div>
  )
}

/** `jeu`: machines, roulette, 21, tickets, bingo, envol, trade, loto, bet225 or parisfoot. `tick`: changes after each round (asked again). */
export function GameHistory({ simId, jeu, tick }: { simId: string; jeu: string; tick?: unknown }) {
  const feats = useFeatures()
  const [open, setOpen] = useState(false)
  const [h, setH] = useState<Historique | null>(null)
  const [more, setMore] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!open) return
    let alive = true
    api.historique(simId, jeu).then(
      (x) => alive && (setH(x), setMore(x.rounds.length >= 50), setError('')),
      (e: Error) => alive && setError(e.message),
    )
    return () => {
      alive = false
    }
  }, [open, simId, jeu, tick])
  if (!keyOpen(feats, 'historique')) return null
  const next = async () => {
    const last = h?.rounds[h.rounds.length - 1]
    if (!h || !last) return
    try {
      const x = await api.historique(simId, jeu, last.at)
      setH({ ...h, rounds: [...h.rounds, ...x.rounds] })
      setMore(x.rounds.length >= 50)
    } catch (e) {
      setError(errorText(e, 'Pas de réseau'))
    }
  }
  return (
    <div className="mt-3">
      <button className="flex w-full items-center justify-center gap-1.5 text-[13px] font-extrabold text-[#ffcc33]" onClick={() => setOpen((o) => !o)}>
        <History size={16} /> Historique <ChevronDown size={16} className={`transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="animate-pop mt-2 rounded-2xl bg-black/25 p-3 text-white">
          {error && <p className="text-[12.5px] font-bold text-[#ffb3b3]">{error}</p>}
          {!h && !error && <p className="text-[12.5px] font-bold text-white/60">…</p>}
          {h && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Total label="Aujourd'hui" t={h.today} />
                <Total label="7 derniers jours" t={h.week} />
              </div>
              {h.rounds.length === 0 ? (
                <p className="mt-3 text-center text-[12.5px] font-bold text-white/60">Pas encore de partie ici.</p>
              ) : (
                <ul className="mt-3 divide-y divide-white/10">
                  {h.rounds.map((r, i) => {
                    const [label, colour] = STATUS[r.status] ?? STATUS.lost
                    return (
                      <li key={`${r.at}-${i}`} className="flex items-center gap-2 py-1.5 text-[12.5px] font-bold">
                        <span className="w-[86px] shrink-0 text-white/55">{when(r.at)}</span>
                        <span className="min-w-0 flex-1 truncate text-white/85">{r.detail || '—'}</span>
                        <span className="shrink-0 text-white/60">{nf(r.stake)}</span>
                        <span className="w-[86px] shrink-0 text-right" style={{ color: colour }}>
                          {r.status === 'won' ? `+${nf(r.payout)}` : label}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
              {more && (
                <button className="mt-2 w-full rounded-full bg-white/10 py-2 text-[12.5px] font-extrabold" onClick={() => void next()}>
                  Plus ancien
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
