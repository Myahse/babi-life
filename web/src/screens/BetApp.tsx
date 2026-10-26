import { useShare } from '../lib/share'
import { useEffect, useMemo, useState } from 'react'
import { Check, Clock3, Radio, Send, Trash2, X } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import type { BetRounds, BetView, Sim, Sport, VirtualMatch } from '../lib/types'
import type { Act } from './phoneApps'
import { NotifyBanner } from '../components/NotifyPrompt'
import { GameHistory } from '../components/GameHistory'

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
/** A pick's name in its sport: basketball's points line, tennis's three sets. */
export const pickLabel = (m: Pick<VirtualMatch, 'sport' | 'line'> | undefined, pick: string) => {
  if (m?.sport === 'basket' && (pick === 'plus' || pick === 'moins')) return `${pick === 'plus' ? '+' : '-'}${String(m.line ?? '').replace('.', ',')} pts`
  if (m?.sport === 'tennis' && pick === 'btsOui') return '3 sets'
  if (m?.sport === 'tennis' && pick === 'btsNon') return '2 sets'
  return PICK[pick]
}
const SPORTS: { id: Sport; label: string; icon: string }[] = [
  { id: 'foot', label: 'Foot', icon: '⚽' },
  { id: 'basket', label: 'Basket', icon: '🏀' },
  { id: 'tennis', label: 'Tennis', icon: '🎾' },
]
type Leg = { match: VirtualMatch; pick: keyof VirtualMatch['odds'] }

/** A match counts towards a combined bet's boost from these odds (backend sims/bets.go, BoostMinOdds). */
const BOOST_MIN_ODDS = 1.3

/** The boost of a combined bet: from 3 matches at BOOST_MIN_ODDS or more, a share for each beyond 2. */
function boostOf(slip: Leg[], share: number) {
  const n = slip.filter((l) => l.match.odds[l.pick] >= BOOST_MIN_ODDS).length
  return n >= 3 ? 1 + share * (n - 2) : 1
}
const nf = (n: number) => n.toLocaleString('fr-FR')
const clockOf = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`

/** « Partager » a ticket: to a friend, to the grin (components/SharedCard.tsx draws it there). */
function ShareTicket({ simId, id, className = '' }: { simId: string; id: number; className?: string }) {
  const share = useShare((s) => s.share)
  const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true)
    try {
      const { ref } = await api.shareTicket(simId, 'bet', id)
      share({ title: 'Partager mon ticket', body: ref })
    } finally {
      setBusy(false)
    }
  }
  return (
    <button disabled={busy} className={`flex items-center gap-1 text-[11px] font-extrabold disabled:opacity-50 ${className}`} onClick={() => void go()}>
      <Send size={12} /> Partager
    </button>
  )
}

export function BetApp({ sim, act, app }: { sim: Sim; act: Act; app: 'bet225' | 'parisfoot' }) {
  const s = useBetting(sim, act, app)
  return (
    <>
      <NotifyBanner what="quand les matchs de ton pari sont finis" dark={app === 'bet225'} />
      {app === 'parisfoot' ? <ParisFoot sim={sim} s={s} /> : <Bet225 sim={sim} s={s} />}
      {/* What the bets came to: today, the week, the last ones (on a dark card, in both apps). */}
      <div className="mx-3 mb-4 rounded-[22px] bg-[#0f1230] px-3 pb-3 pt-1">
        <GameHistory simId={sim.id} jeu={app} tick={s.bets.filter((b) => b.status !== 'open').length} />
      </div>
    </>
  )
}

/** What both apps do the same way: the rounds, the bets placed on this app, the slip. */
function useBetting(sim: Sim, act: Act, app: 'bet225' | 'parisfoot') {
  const b = BRANDS[app]
  const [tab, setTab] = useState<'matchs' | 'live' | 'paris'>('matchs')
  const [sport, setSport] = useState<Sport>('foot')
  const [data, setData] = useState<BetRounds | null>(null)
  const [bets, setBets] = useState<BetView[]>([])
  const [slip, setSlip] = useState<Leg[]>([])
  const [stake, setStake] = useState(500)
  const [note, setNote] = useState<string | null>(null)
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))

  // The rounds, every 10 s; the bets settled when the app opens, then every 30 s.
  useEffect(() => {
    let stop = false
    const load = () => api.betRounds(app, sport).then((d) => !stop && setData(d), () => undefined)
    const settle = () =>
      void act('Vérifier mes paris', 'trophy', 'money', () => api.settleBets(sim.id)).then(() => api.myBets(sim.id, app).then((x) => !stop && setBets(x), () => undefined))
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
  }, [sim.id, app, sport])

  const open = data?.rounds.filter((r) => r.kickoff > now) ?? []
  const live = data?.rounds.filter((r) => r.kickoff <= now) ?? []
  const odds = useMemo(() => {
    const raw = slip.reduce((k, l) => k * l.match.odds[l.pick], 1)
    const boost = boostOf(slip, data?.boost ?? 0)
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
        setNote(app === 'parisfoot' ? 'Ticket validé ! Suis-le dans « Mes tickets ».' : 'Pari validé ! Suis-le dans « Mes paris ».')
        void api.myBets(sim.id, app).then(setBets, () => undefined)
      }
    } catch (e) {
      setNote(e instanceof ApiError ? e.message : 'Pas de réseau')
    }
  }

  return { b, tab, setTab, sport, setSport, data, bets, slip, setSlip, stake, setStake, note, now, open, live, odds, toggle, place }
}

type Betting = ReturnType<typeof useBetting>

/** Bet225: dark, every market, a boost on big combined bets. */
function Bet225({ sim, s }: { sim: Sim; s: Betting }) {
  const { b, tab, setTab, sport, setSport, data, bets, slip, setSlip, stake, setStake, note, now, open, live, odds, toggle, place } = s
  // A render function, not a component: declared in here it would be a new component on every
  // tick of the clock, so every button was remounted each second and a tap could be lost.
  const odd = (m: VirtualMatch, pick: Leg['pick']) => {
    const on = slip.some((l) => l.match.key === m.key && l.pick === pick)
    // A market the sport doesn't have (no draw in basketball or tennis).
    if (!m.odds[pick]) return null
    return (
      <button onClick={() => toggle(m, pick)} className="flex min-w-0 flex-1 flex-col items-center rounded-lg py-1.5 text-[11px] font-bold transition active:scale-95" style={{ background: on ? b.accent : 'rgba(255,255,255,.07)', color: on ? b.ink : '#fff' }}>
        <span className="opacity-70">{pickLabel(m, pick)}</span>
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
      {/* The sports */}
      <div className="mt-2 flex gap-1.5 overflow-x-auto">
        {SPORTS.map((x) => (
          <button key={x.id} onClick={() => setSport(x.id)} className="flex shrink-0 items-center gap-1 rounded-lg px-3 py-1 text-xs font-extrabold" style={sport === x.id ? { background: '#ffffff', color: b.ink } : { background: 'rgba(255,255,255,.08)', color: 'rgba(255,255,255,.75)' }}>
            {x.icon} {x.label}
          </button>
        ))}
      </div>
      {note && <p className="mt-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold">{note}</p>}

      {tab === 'matchs' &&
        open.map((r) => (
          <section key={r.round} className="mt-3">
            <div className="mb-1.5 flex items-center justify-between text-[11px] font-extrabold tracking-wide text-white/60 uppercase">
              <span>{data?.league ?? ''}</span>
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
                    {odd(m, '1')}
                    {odd(m, 'N')}
                    {odd(m, '2')}
                  </div>
                  {b.all && (
                    <div className="mt-1.5 flex gap-1.5">
                      {odd(m, 'plus')}
                      {odd(m, 'moins')}
                      {odd(m, 'btsOui')}
                      {m.sport === 'tennis' && odd(m, 'btsNon')}
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
                    <span className="shrink-0 text-white/70">{pickLabel(undefined, l.pick)}</span>
                    {l.score && <span className="shrink-0 tabular-nums">{l.score.join('-')}</span>}
                    <span className="shrink-0 tabular-nums" style={{ color: b.accent }}>
                      {l.odds.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex items-center justify-between text-xs font-extrabold text-white/70">
                <span>Mise {nf(x.stake)} Djai</span>
                <span>Cote {x.odds.toFixed(2)}</span>
                <ShareTicket simId={sim.id} id={x.id} className="rounded-full bg-white/15 px-2.5 py-1 text-white" />
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
                  {pickLabel(l.match, l.pick)} · {l.match.odds[l.pick].toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
          {slip.length >= 3 && !!data?.boost && <p className="mt-1 text-[11px] font-extrabold" style={{ color: b.accent }}>{boostOf(slip, data.boost) > 1 ? `Boost combiné : +${Math.round((boostOf(slip, data.boost) - 1) * 100)} % sur la cote` : `Boost dès 3 matchs à ${BOOST_MIN_ODDS.toFixed(2).replace('.', ',')} ou plus`}</p>}
          <StakeInput stake={stake} setStake={setStake} money={sim.money} dark accent={b.accent} />
          <div className="mt-2 flex items-center gap-2">
            <div className="min-w-0 flex-1 text-[11px] font-bold text-white/70">
              Cote <b className="text-white">{odds.toFixed(2)}</b> · gain <b style={{ color: b.accent }}>{nf(Math.floor(stake * odds))} Djai</b>
            </div>
            <button disabled={stake < MIN_STAKE || stake > MAX_STAKE || stake > sim.money} onClick={() => void place()} className="rounded-lg px-4 py-2 text-sm font-extrabold disabled:opacity-40" style={{ background: b.accent, color: b.ink }}>
              Parier
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const STAKES = [200, 500, 1000, 2000, 5000]
/** The bets the API takes (backend/internal/sims/bets.go MinStake, MaxStake). */
const MIN_STAKE = 100
const MAX_STAKE = 50000

/**
 * The stake: any amount typed (from 100 to 50 000 Djai, and no more than
 * one has), or a tap on a usual amount, or « Max ». What's typed stays as
 * typed while typing; it's checked, not changed under the fingers.
 */
function StakeInput({ stake, setStake, money, dark, accent }: { stake: number; setStake: (v: number) => void; money: number; /** Bet225's dark slip, else ParisFoot's light one. */ dark?: boolean; accent: string }) {
  const [text, setText] = useState(String(stake))
  useEffect(() => {
    if (Number(text.replace(/\D/g, '')) !== stake) setText(String(stake))
  }, [stake]) // eslint-disable-line react-hooks/exhaustive-deps
  const max = Math.min(MAX_STAKE, Math.floor(money))
  const why = stake < MIN_STAKE ? `${nf(MIN_STAKE)} Djai au moins` : stake > MAX_STAKE ? `${nf(MAX_STAKE)} Djai au plus` : stake > money ? "Tu n'as pas assez" : ''
  const chip = (v: number, label: string) => (
    <button key={label} onClick={() => setStake(v)} disabled={v > money || v < MIN_STAKE} className={`flex-1 rounded-md border py-1.5 text-[11px] font-extrabold disabled:opacity-40 ${dark ? 'border-white/15' : 'border-[#ddd6fe]'}`} style={stake === v ? { background: accent, color: '#fff', borderColor: accent } : undefined}>
      {label}
    </button>
  )
  return (
    <div className="mt-2">
      <label className={`flex items-center gap-2 rounded-lg px-3 py-2 ${dark ? 'bg-white/10 text-white' : 'border border-[#ddd6fe] bg-white text-[#1b1530]'}`}>
        <span className={`text-[11px] font-extrabold uppercase ${dark ? 'text-white/60' : 'text-[#6b6390]'}`}>Mise</span>
        <input
          inputMode="numeric"
          value={text}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, 6)
            setText(digits)
            setStake(Number(digits) || 0)
          }}
          className="min-w-0 flex-1 bg-transparent text-right text-base font-extrabold outline-none"
          aria-label="Mise en Djai"
        />
        <span className={`text-xs font-bold ${dark ? 'text-white/60' : 'text-[#6b6390]'}`}>Djai</span>
      </label>
      <div className="mt-1.5 flex gap-1.5">
        {STAKES.map((v) => chip(v, nf(v)))}
        {chip(max, 'Max')}
      </div>
      {why && <p className="mt-1 text-[11px] font-bold text-[#e03131]">{why}</p>}
    </div>
  )
}

/**
 * ParisFoot: light and simple, its own league (the « Ligue des Régions »),
 * the classic 1 N 2 grid, tickets with a stamp, the stake in a tap.
 */
function ParisFoot({ sim, s }: { sim: Sim; s: Betting }) {
  const { b, tab, setTab, sport, setSport, data, bets, slip, setSlip, stake, setStake, note, now, open, live, odds, toggle, place } = s
  const next = open[0]
  const running = bets.filter((x) => x.status === 'open').length
  // A render function, not a component (see Bet225's odd).
  const cell = (m: VirtualMatch, pick: Leg['pick']) => {
    const on = slip.some((l) => l.match.key === m.key && l.pick === pick)
    if (!m.odds[pick]) return null
    return (
      <button onClick={() => toggle(m, pick)} className="flex h-11 w-12 shrink-0 flex-col items-center justify-center rounded-md border text-[13px] font-extrabold tabular-nums transition active:scale-95" style={on ? { background: b.accent, borderColor: b.accent, color: '#fff' } : { background: '#fff', borderColor: '#ddd6fe', color: '#1b1530' }}>
        <span className="text-[9px] font-bold opacity-60">{pick}</span>
        {m.odds[pick].toFixed(2)}
      </button>
    )
  }
  return (
    <div className="-mx-3 -mt-1 min-h-full bg-[#f5f3ff] pb-4 text-[#1b1530]">
      <div className="bg-[#5b21b6] px-4 pt-3 pb-2 text-white">
        <div className="flex items-center justify-between">
          <span className="font-display text-xl font-extrabold tracking-tight">
            Paris<span className="text-[#fde047]">Foot</span>
          </span>
          <span className="text-xs font-extrabold tabular-nums">Solde {nf(sim.money)} Djai</span>
        </div>
        <div className="text-[11px] font-bold text-white/70">{data?.league ?? ''} · une journée toutes les 15 min</div>
        <div className="mt-2 flex gap-1.5">
          {SPORTS.map((x) => (
            <button key={x.id} onClick={() => setSport(x.id)} className="rounded-full px-3 py-0.5 text-xs font-extrabold" style={sport === x.id ? { background: '#fde047', color: '#1b1530' } : { background: 'rgba(255,255,255,.14)' }}>
              {x.icon} {x.label}
            </button>
          ))}
        </div>
        <div className="mt-2 flex">
          {(
            [
              ['matchs', 'Grille'],
              ['live', 'Résultats'],
              ['paris', `Mes tickets${running ? ` · ${running}` : ''}`],
            ] as const
          ).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className="flex-1 border-b-[3px] pb-1.5 text-xs font-extrabold" style={tab === id ? { borderColor: '#fde047' } : { borderColor: 'transparent', color: 'rgba(255,255,255,.65)' }}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="px-3">
        {note && <p className="mt-2 rounded-lg bg-[#ede9fe] px-3 py-2 text-xs font-bold">{note}</p>}

        {tab === 'matchs' && next && (
          <section className="mt-3 overflow-hidden rounded-xl bg-white shadow-sm">
            <div className="flex items-center justify-between bg-[#ede9fe] px-3 py-2 text-[11px] font-extrabold">
              <span>Journée {(next.round % 38) + 1}</span>
              <span className="flex items-center gap-1 text-[#5b21b6]">
                <Clock3 size={12} /> clôture dans {clockOf(next.kickoff - now)}
              </span>
            </div>
            <div className="divide-y divide-[#ede9fe]">
              {next.matches.map((m) => (
                <div key={m.key} className="flex items-center gap-1.5 px-3 py-2">
                  <div className="min-w-0 flex-1 text-[13px] leading-tight font-bold">
                    <div className="truncate">{m.home}</div>
                    <div className="truncate text-[#6b6390]">{m.away}</div>
                  </div>
                  {cell(m, '1')}
                  {cell(m, 'N')}
                  {cell(m, '2')}
                </div>
              ))}
            </div>
          </section>
        )}
        {tab === 'matchs' && open.length > 1 && <p className="mt-2 text-center text-[11px] font-bold text-[#6b6390]">Journée suivante dans {clockOf(open[1].kickoff - now)}</p>}

        {tab === 'live' &&
          [...live].reverse().map((r) => (
            <section key={r.round} className="mt-3 overflow-hidden rounded-xl bg-white shadow-sm">
              <div className="flex items-center gap-1.5 bg-[#ede9fe] px-3 py-2 text-[11px] font-extrabold">
                {r.matches[0].minute < 90 ? (
                  <>
                    <Radio size={12} className="animate-pulse text-[#dc2626]" /> Journée {(r.round % 38) + 1} · {r.matches[0].minute}'
                  </>
                ) : (
                  <>Journée {(r.round % 38) + 1} · terminé</>
                )}
              </div>
              {r.matches.map((m) => (
                <div key={m.key} className="border-t border-[#ede9fe] px-3 py-1.5">
                  <div className="flex items-center text-[13px] font-bold">
                    <span className="min-w-0 flex-1 truncate">{m.home}</span>
                    <span className="mx-2 w-12 shrink-0 rounded bg-[#1b1530] py-0.5 text-center font-extrabold text-white tabular-nums">{m.score ? `${m.score[0]} : ${m.score[1]}` : '–'}</span>
                    <span className="min-w-0 flex-1 truncate text-right">{m.away}</span>
                  </div>
                  {!!m.goals?.length && <div className="mt-0.5 truncate text-[10px] font-bold text-[#6b6390]">⚽ {m.goals.join(' · ')}</div>}
                </div>
              ))}
            </section>
          ))}

        {tab === 'paris' && (
          <div className="mt-3 space-y-3">
            {bets.length === 0 && <p className="mt-6 text-center text-sm font-bold text-[#6b6390]">Pas encore de ticket sur ParisFoot.</p>}
            {bets.map((x) => (
              <div key={x.id} className="relative rounded-xl border-2 border-dashed border-[#c4b5fd] bg-white p-3">
                <div className="flex items-center justify-between text-[11px] font-extrabold text-[#6b6390]">
                  <span>Ticket n° {x.id}</span>
                  <span>{new Date(x.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <ul className="mt-1.5 space-y-1 text-[12px] font-bold">
                  {x.legs.map((l) => (
                    <li key={l.match} className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate">{l.label}</span>
                      <span className="shrink-0 rounded bg-[#ede9fe] px-1.5">{pickLabel(undefined, l.pick)}</span>
                      {l.score && <span className="shrink-0 tabular-nums">{l.score.join(':')}</span>}
                      {l.won === null ? <Clock3 size={13} className="shrink-0 text-[#a78bfa]" /> : l.won ? <Check size={13} className="shrink-0 text-[#16a34a]" /> : <X size={13} className="shrink-0 text-[#dc2626]" />}
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex items-end justify-between border-t border-dashed border-[#ddd6fe] pt-2 text-xs font-extrabold">
                  <span>
                    Mise {nf(x.stake)} · cote {x.odds.toFixed(2)}
                  </span>
                  <span className={`-rotate-6 rounded border-2 px-2 py-0.5 text-[11px] tracking-wider ${x.status === 'won' ? 'border-[#16a34a] text-[#16a34a]' : x.status === 'lost' ? 'border-[#dc2626] text-[#dc2626]' : 'border-[#7c3aed] text-[#7c3aed]'}`}>
                    {x.status === 'won' ? `GAGNANT +${nf(x.payout)}` : x.status === 'lost' ? 'PERDANT' : 'EN JEU'}
                  </span>
                </div>
                <ShareTicket simId={sim.id} id={x.id} className="mt-2 w-full justify-center rounded-lg bg-[#ede9fe] py-1.5 text-[#5b21b6]" />
              </div>
            ))}
          </div>
        )}

        <p className="mt-6 text-center text-[10px] font-bold text-[#6b6390]">Argent du jeu seulement, dès 18 ans dans le jeu. Dans la vraie vie, les paris peuvent rendre accro.</p>
      </div>

      {/* The ticket being filled in */}
      {slip.length > 0 && (
        <div className="sticky bottom-2 z-10 mx-3 mt-4 rounded-xl border-2 border-[#7c3aed] bg-white p-3 shadow-[0_-10px_30px_-12px_rgba(91,33,182,0.5)]">
          <div className="flex items-center justify-between text-xs font-extrabold">
            <span>Mon ticket · {slip.length} match{slip.length > 1 ? 's' : ''}</span>
            <button className="flex items-center gap-1 text-[#6b6390]" onClick={() => setSlip([])}>
              <Trash2 size={12} /> Effacer
            </button>
          </div>
          <StakeInput stake={stake} setStake={setStake} money={sim.money} accent="#5b21b6" />
          <button disabled={stake < MIN_STAKE || stake > MAX_STAKE || stake > sim.money} onClick={() => void place()} className="mt-2 w-full rounded-lg bg-[#5b21b6] py-2.5 text-sm font-extrabold text-white disabled:opacity-40">
            Valider le ticket · gain {nf(Math.floor(stake * odds))} Djai
          </button>
        </div>
      )}
    </div>
  )
}
