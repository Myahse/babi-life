import { useEffect, useMemo, useState } from 'react'
import { Check, Clock3, Radio, Trash2, X } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import type { BetRounds, BetView, Sim, VirtualMatch } from '../lib/types'
import type { Act } from './phoneApps'

/**
 * The betting apps (backend game/betting.go, sims/bets.go), on the Babi
 * virtual football: a round of six matches every quarter of an hour, bets
 * open for ten minutes, the match played in three. Bet225 has more markets
 * shown and a boost on combined bets of 3 matches or more; ParisFoot is
 * simpler, with a little better odds. The game's money only, adults only.
 */

type Brand = { id: 'bet225' | 'parisfoot'; name: string; bg: string; card: string; accent: string; ink: string; all: boolean }
export const BRANDS: Record<'bet225' | 'parisfoot', Brand> = {
  bet225: { id: 'bet225', name: 'Bet225', bg: '#0e1a14', card: '#17291f', accent: '#22c55e', ink: '#0e1a14', all: true },
  parisfoot: { id: 'parisfoot', name: 'ParisFoot', bg: '#1b1530', card: '#272043', accent: '#a78bfa', ink: '#1b1530', all: false },
}

const PICK: Record<string, string> = { '1': '1', N: 'N', '2': '2', plus: '+2,5 buts', moins: '-2,5 buts', btsOui: 'Les 2 marquent', btsNon: 'Pas les 2' }
type Leg = { match: VirtualMatch; pick: keyof VirtualMatch['odds'] }
const nf = (n: number) => n.toLocaleString('fr-FR')
const clockOf = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`

export function BetApp({ sim, act, app }: { sim: Sim; act: Act; app: 'bet225' | 'parisfoot' }) {
  const b = BRANDS[app]
  const [tab, setTab] = useState<'matchs' | 'live' | 'paris'>('matchs')
  const [data, setData] = useState<BetRounds | null>(null)
  const [bets, setBets] = useState<BetView[]>([])
  const [slip, setSlip] = useState<Leg[]>([])
  const [stake, setStake] = useState(500)
  const [note, setNote] = useState<string | null>(null)
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))

  // The rounds, every 10 s; the bets settled when the app opens, then every 30 s.
  useEffect(() => {
    let stop = false
    const load = () => api.betRounds(app).then((d) => !stop && setData(d), () => undefined)
    const settle = () =>
      void act('Vérifier mes paris', 'trophy', 'money', () => api.settleBets(sim.id)).then(() => api.myBets(sim.id).then((x) => !stop && setBets(x), () => undefined))
    void load()
    settle()
    const t1 = setInterval(load, 10_000)
    const t2 = setInterval(settle, 30_000)
    const t3 = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => {
      stop = true
      clearInterval(t1)
      clearInterval(t2)
      clearInterval(t3)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim.id, app])

  const open = data?.rounds.filter((r) => r.kickoff > now) ?? []
  const live = data?.rounds.filter((r) => r.kickoff <= now) ?? []
  const odds = useMemo(() => {
    const raw = slip.reduce((k, l) => k * l.match.odds[l.pick], 1)
    const boost = slip.length >= 3 ? 1 + (data?.boost ?? 0) * (slip.length - 2) : 1
    return Math.min(1000, Math.round(raw * boost * 100) / 100)
  }, [slip, data])

  const toggle = (match: VirtualMatch, pick: Leg['pick']) => {
    setNote(null)
    setSlip((s) => {
      const same = s.find((l) => l.match.key === match.key)
      if (same?.pick === pick) return s.filter((l) => l.match.key !== match.key)
      return [...s.filter((l) => l.match.key !== match.key), { match, pick }].slice(0, 8)
    })
  }
  const place = async () => {
    try {
      const ok = await act(slip.length > 1 ? 'Combiné' : 'Pari', 'trophy', 'money', () => api.placeBet(sim.id, app, stake, slip.map((l) => ({ match: l.match.key, pick: l.pick }))))
      if (ok) {
        setSlip([])
        setNote('Pari validé ! Suis-le dans « Mes paris ».')
        void api.myBets(sim.id).then(setBets, () => undefined)
      }
    } catch (e) {
      setNote(e instanceof ApiError ? e.message : 'Pas de réseau')
    }
  }

  const Odd = ({ m, pick }: { m: VirtualMatch; pick: Leg['pick'] }) => {
    const on = slip.some((l) => l.match.key === m.key && l.pick === pick)
    return (
      <button onClick={() => toggle(m, pick)} className="flex min-w-0 flex-1 flex-col items-center rounded-lg py-1.5 text-[11px] font-bold transition active:scale-95" style={{ background: on ? b.accent : 'rgba(255,255,255,.07)', color: on ? b.ink : '#fff' }}>
        <span className="opacity-70">{PICK[pick]}</span>
        <span className="text-[14px] font-extrabold tabular-nums">{m.odds[pick].toFixed(2)}</span>
      </button>
    )
  }

  return (
    <div className="-mx-3 -mt-1 min-h-full px-3 pt-2 pb-4 text-white" style={{ background: b.bg }}>
      <div className="flex items-center justify-between">
        <span className="font-display text-xl font-extrabold" style={{ color: b.accent }}>
          {b.name}
        </span>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-extrabold tabular-nums">{nf(sim.money)} Djai</span>
      </div>
      <div className="mt-2 flex gap-1 rounded-full bg-white/10 p-1">
        {(
          [
            ['matchs', 'Matchs'],
            ['live', 'En direct'],
            ['paris', `Mes paris${bets.some((x) => x.status === 'open') ? ` (${bets.filter((x) => x.status === 'open').length})` : ''}`],
          ] as const
        ).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className="flex-1 rounded-full py-1.5 text-xs font-extrabold" style={tab === id ? { background: b.accent, color: b.ink } : { color: 'rgba(255,255,255,.7)' }}>
            {label}
          </button>
        ))}
      </div>
      {note && <p className="mt-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold">{note}</p>}

      {tab === 'matchs' &&
        open.map((r) => (
          <section key={r.round} className="mt-3">
            <div className="mb-1.5 flex items-center justify-between text-[11px] font-extrabold tracking-wide text-white/60 uppercase">
              <span>Championnat virtuel de Babi</span>
              <span className="flex items-center gap-1">
                <Clock3 size={12} /> coup d'envoi dans {clockOf(r.kickoff - now)}
              </span>
            </div>
            <div className="space-y-2">
              {r.matches.map((m) => (
                <div key={m.key} className="rounded-xl p-2.5" style={{ background: b.card }}>
                  <div className="mb-1.5 text-[13px] font-extrabold">
                    {m.home} <span className="text-white/50">–</span> {m.away}
                  </div>
                  <div className="flex gap-1.5">
                    <Odd m={m} pick="1" />
                    <Odd m={m} pick="N" />
                    <Odd m={m} pick="2" />
                  </div>
                  {b.all && (
                    <div className="mt-1.5 flex gap-1.5">
                      <Odd m={m} pick="plus" />
                      <Odd m={m} pick="moins" />
                      <Odd m={m} pick="btsOui" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}

      {tab === 'live' &&
        live.map((r) => (
          <section key={r.round} className="mt-3">
            <div className="mb-1.5 flex items-center gap-1 text-[11px] font-extrabold tracking-wide text-white/60 uppercase">
              {r.matches[0].minute < 90 ? (
                <>
                  <Radio size={12} className="animate-pulse text-[#ef4444]" /> En direct
                </>
              ) : (
                'Résultats'
              )}
            </div>
            <div className="space-y-1.5">
              {r.matches.map((m) => (
                <div key={m.key} className="flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-bold" style={{ background: b.card }}>
                  <span className="w-9 shrink-0 text-[11px] text-white/60 tabular-nums">{m.minute ? `${m.minute}'` : '–'}</span>
                  <span className="min-w-0 flex-1 truncate">{m.home}</span>
                  <span className="shrink-0 rounded-md bg-white/10 px-2 py-0.5 font-extrabold tabular-nums">{m.score ? `${m.score[0]} - ${m.score[1]}` : 'vs'}</span>
                  <span className="min-w-0 flex-1 truncate text-right">{m.away}</span>
                </div>
              ))}
            </div>
          </section>
        ))}

      {tab === 'paris' && (
        <div className="mt-3 space-y-2">
          {bets.length === 0 && <p className="text-center text-sm font-bold text-white/60">Pas encore de pari.</p>}
          {bets.map((x) => (
            <div key={x.id} className="rounded-xl p-3" style={{ background: b.card }}>
              <div className="flex items-center justify-between text-xs font-extrabold">
                <span className="text-white/60">
                  {x.legs.length > 1 ? `Combiné · ${x.legs.length} matchs` : 'Simple'} · {x.app === 'bet225' ? 'Bet225' : 'ParisFoot'}
                </span>
                <span className={`rounded-full px-2 py-0.5 ${x.status === 'won' ? 'bg-[#16a34a]' : x.status === 'lost' ? 'bg-[#7f1d1d]' : 'bg-white/15'}`}>{x.status === 'won' ? `Gagné +${nf(x.payout)} Djai` : x.status === 'lost' ? 'Perdu' : 'En cours'}</span>
              </div>
              <ul className="mt-2 space-y-1 text-[12px] font-bold">
                {x.legs.map((l) => (
                  <li key={l.match} className="flex items-center gap-2">
                    {l.won === null ? <Clock3 size={13} className="shrink-0 text-white/50" /> : l.won ? <Check size={13} className="shrink-0 text-[#22c55e]" /> : <X size={13} className="shrink-0 text-[#ef4444]" />}
                    <span className="min-w-0 flex-1 truncate">{l.label}</span>
                    <span className="shrink-0 text-white/70">{PICK[l.pick]}</span>
                    {l.score && <span className="shrink-0 tabular-nums">{l.score.join('-')}</span>}
                    <span className="shrink-0 tabular-nums" style={{ color: b.accent }}>
                      {l.odds.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex justify-between text-xs font-extrabold text-white/70">
                <span>Mise {nf(x.stake)} Djai</span>
                <span>Cote {x.odds.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-6 text-center text-[10px] font-bold text-white/40">Argent du jeu seulement, dès 18 ans dans le jeu. Dans la vraie vie, les paris peuvent rendre accro.</p>

      {/* The bet slip */}
      {slip.length > 0 && (
        <div className="sticky bottom-2 z-10 mt-4 rounded-2xl p-3 shadow-[0_-10px_30px_-10px_rgba(0,0,0,0.6)]" style={{ background: b.card, border: `1px solid ${b.accent}55` }}>
          <div className="flex items-center justify-between text-xs font-extrabold">
            <span>{slip.length > 1 ? `Combiné · ${slip.length} matchs` : 'Pari simple'}</span>
            <button className="flex items-center gap-1 text-white/60" onClick={() => setSlip([])}>
              <Trash2 size={12} /> Vider
            </button>
          </div>
          <ul className="mt-1.5 max-h-24 space-y-0.5 overflow-y-auto text-[11px] font-bold text-white/80">
            {slip.map((l) => (
              <li key={l.match.key} className="flex justify-between gap-2">
                <span className="truncate">
                  {l.match.home} – {l.match.away}
                </span>
                <span className="shrink-0">
                  {PICK[l.pick]} · {l.match.odds[l.pick].toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
          {slip.length >= 3 && !!data?.boost && <p className="mt-1 text-[11px] font-extrabold" style={{ color: b.accent }}>Boost combiné : +{Math.round(data.boost * (slip.length - 2) * 100)} % sur la cote</p>}
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              min={100}
              max={50000}
              step={100}
              value={stake}
              onChange={(e) => setStake(Math.max(0, Math.min(50000, Number(e.target.value) || 0)))}
              className="w-24 rounded-lg bg-white/10 px-2 py-2 text-sm font-extrabold text-white outline-none"
            />
            <div className="min-w-0 flex-1 text-[11px] font-bold text-white/70">
              Cote <b className="text-white">{odds.toFixed(2)}</b> · gain <b style={{ color: b.accent }}>{nf(Math.floor(stake * odds))} Djai</b>
            </div>
            <button disabled={stake < 100 || stake > sim.money} onClick={() => void place()} className="rounded-lg px-4 py-2 text-sm font-extrabold disabled:opacity-40" style={{ background: b.accent, color: b.ink }}>
              Parier
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
