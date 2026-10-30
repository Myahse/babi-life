import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, TriangleAlert } from 'lucide-react'
import { api, ApiError, errorText } from '../../lib/api'
import { haptic } from '../../lib/native'
import type { Sim, TradeCall, TradeState, World } from '../../lib/types'
import type { Act } from '../phoneApps'
import { StakeField, stakeOK } from '../../components/StakeField'
import { pct, useCasinoRates } from '../../lib/casino'
import { GameHistory } from '../../components/GameHistory'
import { RulesFold } from '../../components/RulesFold'
import { t as tl, tx } from '../../lib/i18n'

/**
 * Babi Trade (backend game/envol.go, sims/trade.go), in Babi Casino: made-up
 * prices of cacao, coffee and gold, moving every second at random, the same
 * for every player; a call that one will be higher (hausse) or lower (baisse)
 * in 30 s, 1 or 2 min. Right, the stake paid back TradePays times; the same
 * price, the stake back; wrong, lost. A game of chance, and said so on the
 * screen: the chart tells nothing of what comes.
 */

const nf = (n: number) => n.toLocaleString('fr-FR')
const price = (p: number) =>
  p.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
const errText = (e: unknown) => (e instanceof ApiError && e.status === 0 ? tl('Hors ligne') : errorText(e, tl('Erreur')))
const length = (s: number) => (s < 60 ? `${s} s` : `${s / 60} min`)
const UP = '#2fd27a'
const DOWN = '#ff5a6a'

type Props = { world: World; sim: Sim; act: Act }

export function Trade({ world, sim, act }: Props) {
  const cfg = world.casino?.trade ?? {
    assets: [],
    stakes: [100, 500, 1000],
    secs: [30, 60, 120],
    pays: 1.85,
    open: 3,
  }
  const [asset, setAsset] = useState(cfg.assets[0]?.id ?? 'cacao')
  const [st, setSt] = useState<TradeState | null>(null)
  const [stake, setStake] = useState(cfg.stakes[2] ?? cfg.stakes[0])
  const [secs, setSecs] = useState(cfg.secs[0])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const settled = useRef(new Set<number>())
  const told = useRef(new Set<number>())
  const [flash, setFlash] = useState<{ text: string; good: boolean } | null>(null)

  // The price, second by second.
  useEffect(() => {
    let stop = false
    let inFlight = false
    const load = () => {
      if (inFlight) return
      inFlight = true
      void api
        .trade(sim.id, asset)
        .then((s) => !stop && setSt(s))
        .catch(() => undefined)
        .finally(() => (inFlight = false))
    }
    load()
    const t = setInterval(load, 1000)
    return () => {
      stop = true
      clearInterval(t)
    }
  }, [sim.id, asset])

  // A call whose time is up: settled (paid), then its end told once.
  useEffect(() => {
    if (!st) return
    const due = st.calls.filter((c) => c.status === 'open' && c.expiryAt <= st.now && !settled.current.has(c.id))
    if (due.length) {
      due.forEach((c) => settled.current.add(c.id))
      void act(tl('Babi Trade'), 'dice-5', 'casino', () => api.settleBets(sim.id))
    }
    for (const c of st.calls) {
      if (c.status === 'open' || told.current.has(c.id) || !settled.current.has(c.id)) continue
      told.current.add(c.id)
      const label = cfg.assets.find((a) => a.id === c.asset)?.label ?? c.asset
      const way = c.dir === 'hausse' ? tl('à la hausse') : tl('à la baisse')
      const text = c.status === 'won' ? tl('{label} {way} : gagné, +{0} Djai', { label, way, 0: nf(c.payout ?? 0) }) : c.status === 'tie' ? tl("{label} : le cours n'a pas bougé, ta mise revient", { label }) : tl('{label} {way} : perdu', { label, way })
      setFlash({ text, good: c.status !== 'lost' })
      haptic(c.status === 'won' ? 'success' : 'light')
    }
  }, [st]) // eslint-disable-line react-hooks/exhaustive-deps

  const call = async (dir: 'hausse' | 'baisse') => {
    setBusy(true)
    setError('')
    setFlash(null)
    try {
      const res = await api.tradeCall(sim.id, asset, dir, stake, secs)
      haptic('light')
      void act(tl('Babi Trade'), 'dice-5', 'casino', async () => res)
      const c = res.outcome.data as TradeCall
      setSt((s) => (s ? { ...s, calls: [c, ...s.calls] } : s))
    } catch (e) {
      setError(errText(e))
    } finally {
      setBusy(false)
    }
  }

  const prices = st?.asset === asset ? st.prices : []
  const last = prices[prices.length - 1]
  const open = (st?.calls ?? []).filter((c) => c.status === 'open')
  const full = open.length >= cfg.open
  // What a right call pays now: 2 × the casino's rate when the team set one (lib/casino.ts), else as the game says.
  const tr = useCasinoRates().trade
  const pays = tr?.set ? 2 * tr.rate : cfg.pays
  const gain = Math.floor(stake * pays)
  // The session (an hour) closes: a call must end before (the next one opens at another price).
  const closesIn = st ? st.closes - st.now : 3600
  const fits = (s: number) => s < closesIn
  const shut = !fits(cfg.secs[0])
  return (
    <div>
      <div className="grid grid-cols-3 gap-1.5">
        {cfg.assets.map((a) => {
          const p = st?.last[a.id]
          return (
            <button key={a.id} className={`rounded-2xl px-2 py-2 text-left ${asset === a.id ? 'bg-white text-[#0b1530]' : 'bg-white/10'}`} onClick={() => setAsset(a.id)}>
              <div className="text-[13px] font-extrabold">{a.label}</div>
              <div className="text-[11.5px] font-bold opacity-75">{p ? price(p) : '…'}</div>
            </button>
          )
        })}
      </div>
      <Chart prices={prices} from={st?.from ?? 0} now={st?.now ?? 0} calls={open.filter((c) => c.asset === asset && c.expiryAt > (st?.now ?? 0))} />
      <div className="mt-1 flex items-center justify-between text-[12px] font-bold text-white/65">
        <span>
          {cfg.assets.find((a) => a.id === asset)?.unit ?? ''} {tx('· séance close dans {0}:{1}', { 0: Math.floor(closesIn / 60), 1: String(closesIn % 60).padStart(2, '0') })}
        </span>
        {last !== undefined && <span className="font-extrabold text-white">{price(last)} {tl('F')}</span>}
      </div>
      {flash && (
        <div className="animate-pop mt-2 rounded-2xl bg-black/30 p-2 text-center text-[14px] font-extrabold" style={{ color: flash.good ? '#7cfc9a' : '#ffb3b3' }}>
          {flash.text}
        </div>
      )}
      {error && <p className="mt-2 text-center text-[13px] font-bold text-[#ffb3b3]">{error}</p>}
      <div className="mt-3 rounded-[22px] bg-black/25 p-3">
        <StakeField usual={cfg.stakes} value={stake} onChange={setStake} money={sim.money} disabled={busy} />
        <div className="mt-2 flex items-center gap-1.5">
          <span className="shrink-0 text-[12px] font-extrabold text-white/70">{tl('Dans')}</span>
          {cfg.secs.map((s) => (
            <button key={s} className={`flex-1 rounded-full py-1.5 text-[12.5px] font-extrabold disabled:opacity-35 ${secs === s ? 'bg-white text-[#0b1530]' : 'bg-white/12'}`} disabled={!fits(s)} onClick={() => setSecs(s)}>
              {length(s)}
            </button>
          ))}
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          {(['hausse', 'baisse'] as const).map((d) => (
            <button
              key={d}
              className="btn !py-3 !text-white"
              style={{
                background: d === 'hausse' ? `linear-gradient(180deg,#5cf09c,${UP} 40%,#14864a)` : `linear-gradient(180deg,#ff8c97,${DOWN} 40%,#b3192b)`,
              }}
              disabled={busy || !last || full || !fits(secs) || !stakeOK(stake, cfg.stakes) || sim.money < stake}
              onClick={() => void call(d)}
            >
              <span className="flex flex-col items-center leading-tight">
                <span className="flex items-center gap-1 font-display text-[19px] font-extrabold">
                  {d === 'hausse' ? <ArrowUp size={20} strokeWidth={3} /> : <ArrowDown size={20} strokeWidth={3} />}
                  {d === 'hausse' ? tl('Hausse') : tl('Baisse')}
                </span>
                <span className="text-[11.5px] font-bold opacity-90">{tl('gagne')} {nf(gain)}</span>
              </span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-center text-[11.5px] font-bold text-white/60">
          {full
            ? tl("{open} paris ouverts au plus : attends qu'un se termine.", { open: cfg.open })
            : shut
              ? tl('La séance ferme : la prochaine ouvre dans {closesIn} s, à un nouveau cours.', { closesIn })
              : !fits(secs)
                ? tl('La séance ferme avant la fin de ce pari : prends une durée plus courte.')
                : sim.money < stake
                  ? tl("Pas assez d'argent pour cette mise.")
                  : tl("Juste : {0} fois ta mise. Le cours n'a pas bougé : ta mise revient. Faux : elle est perdue.", { 0: (Math.round(pays * 100) / 100).toLocaleString('fr-FR') })}
        </p>
      </div>
      {!!st?.calls.length && (
        <div className="mt-3 rounded-[22px] bg-black/20 p-3">
          <div className="mb-1.5 text-[12px] font-extrabold tracking-wide text-white/60 uppercase">{tl('Tes paris')}</div>
          {st.calls.map((c) => (
            <CallRow key={c.id} c={c} now={st.now} current={st.last[c.asset]} label={cfg.assets.find((a) => a.id === c.asset)?.label ?? c.asset} />
          ))}
        </div>
      )}
      <div className="mt-3 flex gap-2 rounded-[18px] border border-[#ffcc33]/40 bg-[#ffcc33]/10 p-3 text-[12px] leading-snug font-bold text-[#ffe7a3]">
        <TriangleAlert size={18} className="mt-0.5 shrink-0" />
        <span>
          {tl("Ce n'est pas du vrai trading : les cours sont tirés au hasard chaque seconde, la courbe ne dit rien de la suite, et le jeu garde une part des mises. Le marché ouvre par séances d'une heure, chacune à un nouveau cours : un pari se termine avant la clôture. Dans la vraie vie, les « options binaires » et les « traders » qui promettent de doubler ton argent sur les réseaux sont presque toujours des arnaques.")}
        </span>
      </div>
      <RulesFold>{tx('Un bon pari paie ×{0} ta mise ; un mauvais, ta mise est perdue. Le jeu garde en moyenne {1} des mises (taux de retour {2}).', { 0: pays.toFixed(2).replace('.', ','), 1: pct(1 - pays / 2), 2: pct(pays / 2) })}</RulesFold>
      <GameHistory simId={sim.id} jeu="trade" tick={(st?.calls ?? []).filter((c) => c.status !== 'open').length} />
    </div>
  )
}

function CallRow({ c, now, current, label }: { c: TradeCall; now: number; current?: number; label: string }) {
  const end = c.exitPrice ?? (c.status === 'open' ? current : undefined)
  const ahead = end !== undefined && (c.dir === 'hausse' ? end > c.entryPrice : end < c.entryPrice)
  const left = Math.max(0, c.expiryAt - now)
  const state =
    c.status === 'open'
      ? left > 0
        ? tl("{left} s · {0} pour l'instant", { left, 0: ahead ? 'gagnant' : end === c.entryPrice ? tl('égal') : 'perdant' })
        : tl('terminé…')
      : c.status === 'won'
        ? tl('gagné · +{0}', { 0: nf(c.payout ?? 0) })
        : c.status === 'tie'
          ? tl('égalité · mise rendue')
          : 'perdu'
  const colour = c.status === 'won' || (c.status === 'open' && ahead) ? '#7cfc9a' : c.status === 'tie' ? '#ffffff' : '#ff9aa4'
  return (
    <div className="flex items-center gap-2 py-1.5 text-[13px] font-bold">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full" style={{ background: c.dir === 'hausse' ? UP : DOWN }}>
        {c.dir === 'hausse' ? <ArrowUp size={16} strokeWidth={3} /> : <ArrowDown size={16} strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block">
          {label} · {nf(c.stake)}
        </span>
        <span className="block text-[11.5px] text-white/60">
          {price(c.entryPrice)}
          {end !== undefined ? ` → ${price(end)}` : ''}
        </span>
      </span>
      <span className="shrink-0 text-right text-[12px] font-extrabold" style={{ color: colour }}>
        {state}
      </span>
    </div>
  )
}

/** The last minutes of the price, a line; the open calls' entry prices across it. */
function Chart({ prices, from, now, calls }: { prices: number[]; from: number; now: number; calls: TradeCall[] }) {
  const W = 320
  const H = 170
  const pad = 10
  const right = 62
  if (prices.length < 2) return <div className="mt-2 h-[170px] animate-pulse rounded-[22px] bg-black/30" />
  const levels = [...prices, ...calls.map((c) => c.entryPrice)]
  let lo = Math.min(...levels)
  let hi = Math.max(...levels)
  const room = Math.max((hi - lo) * 0.12, hi * 0.0004)
  lo -= room
  hi += room
  const px = (i: number) => pad + (i / (prices.length - 1)) * (W - pad - right)
  const py = (p: number) => pad + (1 - (p - lo) / (hi - lo)) * (H - 2 * pad)
  const line = prices.map((p, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)},${py(p).toFixed(1)}`).join(' ')
  const lastP = prices[prices.length - 1]
  const up = lastP >= prices[0]
  const colour = up ? UP : DOWN
  return (
    <div className="relative mt-2 overflow-hidden rounded-[22px] bg-[linear-gradient(180deg,#0e1a3a,#070d22)] shadow-[inset_0_0_24px_rgba(0,0,0,0.5)]">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full">
        <defs>
          <linearGradient id="trade-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={colour} stopOpacity="0.35" />
            <stop offset="1" stopColor={colour} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.2, 0.4, 0.6, 0.8].map((f) => (
          <line key={f} x1={pad} x2={W - right} y1={f * H} y2={f * H} stroke="#ffffff" strokeOpacity="0.06" />
        ))}
        <path d={`${line} L${px(prices.length - 1).toFixed(1)},${H} L${pad},${H} Z`} fill="url(#trade-fill)" />
        <path d={line} fill="none" stroke={colour} strokeWidth="2.2" strokeLinejoin="round" />
        {calls.map((c) => {
          const y = py(c.entryPrice)
          const i = c.entryAt - from
          const x = i >= 0 ? px(i) : pad
          const tint = c.dir === 'hausse' ? UP : DOWN
          return (
            <g key={c.id}>
              <line x1={x} x2={W - right} y1={y} y2={y} stroke={tint} strokeWidth="1.4" strokeDasharray="4 3" />
              <circle cx={x} cy={y} r="3.5" fill={tint} />
              <text x={W - right + 4} y={y + 3.5} fill={tint} fontSize="10" fontWeight="800">
                {c.dir === 'hausse' ? '▲' : '▼'} {Math.max(0, c.expiryAt - now)} s
              </text>
            </g>
          )
        })}
        <circle cx={px(prices.length - 1)} cy={py(lastP)} r="4" fill={colour}>
          <animate attributeName="r" values="4;6;4" dur="1s" repeatCount="indefinite" />
        </circle>
        <rect x={W - right + 2} y={py(lastP) - 9} width={right - 4} height="18" rx="9" fill={colour} />
        <text x={W - right / 2} y={py(lastP) + 4} fill="#06101f" fontSize="10.5" fontWeight="900" textAnchor="middle">
          {price(lastP)}
        </text>
      </svg>
    </div>
  )
}
