import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { ChevronLeft, CircleDot, Plane, Spade, Ticket, TrendingUp } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { haptic } from '../lib/native'
import { useSession } from '../store/session'
import type { ActionResult, BlackjackView, RouletteBet, RouletteSpin, ScratchResult, ScratchTicket, Sim, World } from '../lib/types'
import { CardBack, PlayingCard } from '../components/PlayingCards'
import type { Act } from './phoneApps'
import { StakeField, stakeOK } from '../components/StakeField'
import { Envol } from './casino/Envol'
import { Trade } from './casino/Trade'

/**
 * Babi Casino (backend game/casino.go, sims/casino.go): the roulette with its
 * one zero, le 21 against the bank, the tickets à gratter, L'Envol and Babi
 * Trade (casino/Envol.tsx, casino/Trade.tsx). Every round is
 * drawn on the server and paid at once; the app shows it (the wheel turning,
 * the cards dealt, the silver scratched) and then tells the game. The game's
 * money only, adults only, a number of rounds a day.
 */

const nf = (n: number) => n.toLocaleString('fr-FR')
const errText = (e: unknown) => (e instanceof ApiError && e.status === 0 ? 'Hors ligne' : e instanceof Error ? e.message : 'Erreur')
type Props = { world: World; sim: Sim; act: Act; /** While a round is shown (the wheel turning, a ticket under its silver): the money as it was, so a sync doesn't tell the result first. */ hold: (money: number | null) => void }

export function CasinoApp({ world, sim, act, onConfirmAdult }: Omit<Props, 'hold'> & { onConfirmAdult: () => Promise<void> }) {
  const adult = useSession((s) => !!s.user?.adult)
  const [table, setTable] = useState<'roulette' | '21' | 'grattage' | 'envol' | 'trade' | null>(null)
  const [held, hold] = useState<number | null>(null)
  const roundsLeft = (world.casino?.perDay ?? 300) - (sim.today?.casino?.times ?? 0)
  const shell = '-mx-3 -mt-1 min-h-full p-3 pb-6 text-white'
  const bg = { background: 'radial-gradient(circle at 50% 0%, #1f7a4d, #0b3d26 55%, #06210f)' }
  if (!adult)
    return (
      <div className={shell} style={bg}>
        <Brand />
        <div className="mt-4 rounded-2xl bg-black/25 p-4 text-sm font-bold">
          <p>Babi Casino est réservé aux joueurs de 18 ans et plus. On y joue avec l'argent du jeu seulement.</p>
          <button className="btn mt-3 w-full !py-2" onClick={() => void onConfirmAdult()}>
            J’ai 18 ans ou plus
          </button>
        </div>
      </div>
    )
  const back = (title: string) => (
    <div className="mb-3 flex items-center gap-2">
      <button className="icon-btn bg-white/15 text-white" onClick={() => setTable(null)} aria-label="Retour au casino">
        <ChevronLeft size={22} />
      </button>
      <div className="min-w-0 flex-1 font-display text-[22px] font-extrabold">{title}</div>
      <span className="rounded-full bg-black/30 px-2.5 py-1 text-[13px] font-extrabold">{nf(held ?? sim.money)} Djai</span>
    </div>
  )
  if (table === 'roulette')
    return (
      <div className={shell} style={bg}>
        {back('La roulette')}
        <Roulette world={world} sim={sim} act={act} hold={hold} />
      </div>
    )
  if (table === '21')
    return (
      <div className={shell} style={bg}>
        {back('Le 21')}
        <Blackjack world={world} sim={sim} act={act} hold={hold} />
      </div>
    )
  if (table === 'grattage')
    return (
      <div className={shell} style={bg}>
        {back('Tickets à gratter')}
        <Scratch world={world} sim={sim} act={act} hold={hold} />
      </div>
    )
  if (table === 'envol')
    return (
      <div className={shell} style={bg}>
        {back("L'Envol")}
        <Envol world={world} sim={sim} act={act} />
      </div>
    )
  if (table === 'trade')
    return (
      <div className={shell} style={{ background: 'radial-gradient(circle at 50% 0%, #1d3b7a, #0b1530 55%, #050a1a)' }}>
        {back('Babi Trade')}
        <Trade world={world} sim={sim} act={act} />
      </div>
    )
  const tiles = [
    { id: 'roulette' as const, title: 'La roulette', text: 'Le rouge, le noir, ton numéro plein payé 35 fois. Un seul zéro.', icon: CircleDot, colours: ['#e5383b', '#7a0f1f'] },
    { id: '21' as const, title: 'Le 21', text: 'Contre la banque : approche 21 sans le dépasser. Blackjack payé 3 pour 2.', icon: Spade, colours: ['#2b2f45', '#0f1222'] },
    { id: 'grattage' as const, title: 'Tickets à gratter', text: 'Pinda, Akwaba, Super Banco : trois fois la même somme, tu la gagnes.', icon: Ticket, colours: ['#ffcc33', '#d98a00'] },
    { id: 'envol' as const, title: "L'Envol", text: "L'avion décolle, le multiplicateur monte : encaisse avant qu'il parte !", icon: Plane, colours: ['#ff5a7a', '#8a1238'] },
    { id: 'trade' as const, title: 'Babi Trade', text: 'Cacao, café, or : hausse ou baisse dans 30 s ? Un jeu de hasard, pas du trading.', icon: TrendingUp, colours: ['#3d8bff', '#16307a'] },
  ]
  return (
    <div className={shell} style={bg}>
      <Brand />
      <div className="mt-3 grid gap-2.5">
        {tiles.map((t) => (
          <button key={t.id} className="flex items-center gap-3 rounded-[22px] bg-white/10 p-3 text-left shadow-[0_3px_0_rgba(0,0,0,0.25)] transition active:scale-[0.98]" onClick={() => setTable(t.id)}>
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[18px]" style={{ background: `linear-gradient(160deg, ${t.colours[0]}, ${t.colours[1]})` }}>
              <t.icon size={28} strokeWidth={2.4} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[19px] font-extrabold">{t.title}</span>
              <span className="block text-[12.5px] leading-snug font-bold text-white/75">{t.text}</span>
            </span>
          </button>
        ))}
      </div>
      <p className="mt-4 text-center text-[11.5px] leading-snug font-bold text-white/60">
        Argent du jeu seulement · 18 ans et plus · encore {Math.max(0, roundsLeft)} tours aujourd'hui.
        <br />
        La roulette rend 36 pour 37 misés, le 21 un peu moins que ce qu'on mise, les tickets environ deux tiers de leur prix, L'Envol 95 %, Babi Trade 92,5 %.
      </p>
    </div>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-[#ffcc33] text-[#0b3d26]">
        <Spade size={24} strokeWidth={2.6} />
      </span>
      <div>
        <div className="font-display text-[24px] leading-none font-extrabold text-[#ffcc33]">Babi Casino</div>
        <div className="text-[12px] font-bold text-white/75">Roulette, 21, tickets, Envol et Trade</div>
      </div>
    </div>
  )
}

/* ---------- La roulette ---------- */

/** The wheel's numbers, round from the zero (the European wheel). */
const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26]
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])
const pocket = (n: number) => (n === 0 ? '#0a8f4a' : RED.has(n) ? '#c8102e' : '#1b1d21')
const STEP = 360 / 37

function Wheel({ turn, size = 230 }: { turn: number; size?: number }) {
  const r = size / 2
  const wedges = useMemo(
    () =>
      WHEEL.map((n, i) => {
        const a0 = ((i - 0.5) * STEP - 90) * (Math.PI / 180)
        const a1 = ((i + 0.5) * STEP - 90) * (Math.PI / 180)
        const R = r - 6
        const d = `M ${r} ${r} L ${r + R * Math.cos(a0)} ${r + R * Math.sin(a0)} A ${R} ${R} 0 0 1 ${r + R * Math.cos(a1)} ${r + R * Math.sin(a1)} Z`
        return { n, i, d }
      }),
    [r],
  )
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: `rotate(${turn}deg)`, transition: 'transform 4.2s cubic-bezier(0.15, 0.7, 0.1, 1)' }}>
        <circle cx={r} cy={r} r={r} fill="#7a4a1e" />
        <circle cx={r} cy={r} r={r - 3} fill="#d9a520" />
        {wedges.map((w) => (
          <path key={w.n} d={w.d} fill={pocket(w.n)} stroke="#d9a520" strokeWidth="0.8" />
        ))}
        {wedges.map((w) => (
          <text key={`t${w.n}`} x={r} y={18} textAnchor="middle" fontSize={size / 24} fontWeight="800" fill="#fff" transform={`rotate(${w.i * STEP} ${r} ${r})`}>
            {w.n}
          </text>
        ))}
        <circle cx={r} cy={r} r={r * 0.55} fill="#6b3f17" />
        <circle cx={r} cy={r} r={r * 0.42} fill="#8a5a24" stroke="#d9a520" strokeWidth="2" />
        {[0, 1, 2, 3].map((k) => (
          <rect key={k} x={r - 2} y={r - r * 0.36} width={4} height={r * 0.72} rx={2} fill="#d9a520" transform={`rotate(${k * 45} ${r} ${r})`} />
        ))}
        <circle cx={r} cy={r} r={r * 0.09} fill="#ffcc33" />
      </svg>
      {/* Where the ball stops: the top pocket */}
      <span className="absolute top-[14px] left-1/2 h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.6)]" />
      <span className="absolute -top-1 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[8px] border-t-[12px] border-x-transparent border-t-[#ffcc33]" />
    </div>
  )
}

type Spot = { kind: string; number?: number; label: string; bg?: string; span?: number }
const keyOf = (b: { kind: string; number?: number }) => `${b.kind}:${b.number ?? ''}`
const short = (n: number) => (n >= 1000 ? `${n / 1000}k` : String(n))

function Roulette({ world, sim, act, hold }: Props) {
  const chips = world.casino?.chips ?? [100, 500, 1000, 2000]
  const maxTotal = world.casino?.maxTotal ?? 5000
  const maxBets = world.casino?.maxBets ?? 10
  const [chip, setChip] = useState(chips[0])
  const [bets, setBets] = useState<Record<string, RouletteBet>>({})
  const [turn, setTurn] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<RouletteSpin | null>(null)
  const [error, setError] = useState('')
  const total = Object.values(bets).reduce((t, b) => t + b.stake, 0)
  const place = (s: Spot) => {
    if (spinning) return
    setResult(null)
    setError('')
    const k = keyOf(s)
    if (!stakeOK(chip, chips, maxTotal)) return setError(`Un jeton de ${nf(chips[0])} à ${nf(maxTotal)} Djai.`)
    if (total + chip > maxTotal) return setError(`${nf(maxTotal)} Djai au plus sur le tapis.`)
    if (!bets[k] && Object.keys(bets).length >= maxBets) return setError(`${maxBets} mises au plus.`)
    haptic('light')
    setBets((b) => ({ ...b, [k]: { kind: s.kind, number: s.number, stake: (b[k]?.stake ?? 0) + chip } }))
  }
  const spin = async () => {
    if (!total || spinning) return
    if (sim.money < total) return setError("Pas assez d'argent pour ces mises.")
    setSpinning(true)
    setResult(null)
    setError('')
    hold(sim.money)
    let res: ActionResult
    try {
      res = await api.roulette(sim.id, Object.values(bets))
    } catch (e) {
      setSpinning(false)
      hold(null)
      return setError(errText(e))
    }
    const data = res.outcome.data as RouletteSpin
    // Round the wheel five times and more, to the pocket at the top.
    const i = WHEEL.indexOf(data.number)
    setTurn((t) => {
      const base = t - (((t % 360) + 360) % 360)
      return base - 360 * 5 - i * STEP
    })
    await new Promise((r) => setTimeout(r, 4300))
    setResult(data)
    setSpinning(false)
    hold(null)
    haptic(data.back > 0 ? 'success' : 'light')
    void act('Roulette', 'dice-5', 'casino', async () => res)
  }
  const won = (s: Spot) => {
    if (!result) return false
    const b = Object.values(bets).findIndex((x) => keyOf(x) === keyOf(s))
    return b >= 0 && result.wins[b] > 0
  }
  const cell = (s: Spot, extra = '') => {
    const b = bets[keyOf(s)]
    const hit = result && s.kind === 'plein' && s.number === result.number
    return (
      <button
        key={keyOf(s)}
        className={`relative grid h-8 place-items-center rounded-[5px] text-[11px] font-extrabold text-white ${hit ? 'ring-2 ring-[#ffcc33]' : ''} ${won(s) ? 'ring-2 ring-[#7cfc9a]' : ''} ${extra}`}
        style={{ background: s.bg ?? 'rgba(255,255,255,0.1)', gridColumn: s.span ? `span ${s.span}` : undefined }}
        onClick={() => place(s)}
      >
        {s.label}
        {b && <span className="absolute -top-1.5 -right-1 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-white bg-[#ffcc33] px-0.5 text-[9px] text-[#5a1a00]">{short(b.stake)}</span>}
      </button>
    )
  }
  const rows = [3, 2, 1].map((r) => [...Array(12)].map((_, c) => c * 3 + r))
  return (
    <div>
      <Wheel turn={turn} />
      <div className="mt-2 grid h-12 place-items-center">
        {result ? (
          <div className="animate-pop flex items-center gap-2 text-center">
            <span className="grid h-10 w-10 place-items-center rounded-full font-display text-[18px] font-extrabold" style={{ background: pocket(result.number) }}>
              {result.number}
            </span>
            <span className="font-extrabold">{result.back > 0 ? <span className="text-[#ffcc33]">Tu récupères {nf(result.back)} Djai !</span> : 'Rien pour toi ce tour-ci.'}</span>
          </div>
        ) : (
          <span className="text-[13px] font-bold text-white/70">{spinning ? 'La bille tourne…' : 'Pose tes jetons sur le tapis, puis lance.'}</span>
        )}
      </div>
      {/* The cloth: the zero, the numbers in three rows, the columns; the dozens, the even chances */}
      <div className="rounded-[14px] border-2 border-[#d9a520]/60 bg-[#0d5c35] p-1.5">
        <div className="grid gap-[3px]" style={{ gridTemplateColumns: '26px repeat(12, minmax(0, 1fr)) 26px' }}>
          <div className="row-span-3 grid">{cell({ kind: 'plein', number: 0, label: '0', bg: pocket(0) }, '!h-full')}</div>
          {rows.map((row, ri) => (
            <div key={ri} className="contents">
              {row.map((n) => cell({ kind: 'plein', number: n, label: String(n), bg: pocket(n) }))}
              {cell({ kind: 'colonne', number: 3 - ri, label: '2:1' })}
            </div>
          ))}
        </div>
        <div className="mt-[3px] grid grid-cols-3 gap-[3px]">
          {cell({ kind: 'douzaine', number: 1, label: '1 à 12' })}
          {cell({ kind: 'douzaine', number: 2, label: '13 à 24' })}
          {cell({ kind: 'douzaine', number: 3, label: '25 à 36' })}
        </div>
        <div className="mt-[3px] grid grid-cols-6 gap-[3px]">
          {cell({ kind: 'manque', label: '1-18' })}
          {cell({ kind: 'pair', label: 'Pair' })}
          {cell({ kind: 'rouge', label: '◆', bg: '#c8102e' })}
          {cell({ kind: 'noir', label: '◆', bg: '#1b1d21' })}
          {cell({ kind: 'impair', label: 'Impair' })}
          {cell({ kind: 'passe', label: '19-36' })}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        {chips.map((c) => (
          <button key={c} className={`grid h-11 flex-1 place-items-center rounded-full border-[3px] border-dashed text-[13px] font-extrabold ${chip === c ? 'border-white bg-[#ffcc33] text-[#5a1a00]' : 'border-white/50 bg-white/10'}`} onClick={() => setChip(c)}>
            {nf(c)}
          </button>
        ))}
      </div>
      <div className="mt-2">
        <StakeField usual={chips} value={chip} onChange={setChip} max={maxTotal} label="Ou tape ton jeton" chips={false} disabled={spinning} />
      </div>
      <div className="mt-2 text-center text-[12.5px] font-bold text-white/80">
        Sur le tapis : {nf(total)} / {nf(maxTotal)} Djai
      </div>
      {error && <p className="mt-1 text-center text-[13px] font-bold text-[#ffb3b3]">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button className="rounded-full bg-white/15 px-4 py-2.5 text-[14px] font-extrabold disabled:opacity-50" disabled={spinning || !total} onClick={() => (setBets({}), setResult(null))}>
          Effacer
        </button>
        <button className="btn flex-1 !py-2.5" style={{ background: 'linear-gradient(180deg,#ffe27a,#ff9f1a)', color: '#5a1a00' }} disabled={spinning || !total || sim.money < total} onClick={() => void spin()}>
          {spinning ? 'Rien ne va plus…' : `Lancer la bille · ${nf(total)}`}
        </button>
      </div>
      <p className="mt-2 text-center text-[11.5px] font-bold text-white/55">Plein ×35 · douzaine et colonne ×2 · rouge, noir, pair, impair, 1-18, 19-36 ×1. Le zéro gagne pour la banque.</p>
    </div>
  )
}

/* ---------- Le 21 ---------- */

const RESULT: Record<string, { text: string; tone: string }> = {
  blackjack: { text: 'Blackjack ! Payé 3 pour 2', tone: '#ffcc33' },
  gagne: { text: 'Gagné !', tone: '#7cfc9a' },
  egalite: { text: 'Égalité : ta mise revient', tone: '#ffffff' },
  perdu: { text: 'La banque gagne', tone: '#ffb3b3' },
  saute: { text: 'Plus de 21 : tu as sauté', tone: '#ffb3b3' },
}

function Blackjack({ world, sim, act }: Props) {
  const stakes = world.casino?.stakes ?? [100, 500, 1000]
  const [hand, setHand] = useState<BlackjackView | null>(null)
  const [stake, setStake] = useState(stakes[0])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    void api
      .blackjack(sim.id)
      .then((r) => setHand(r.hand))
      .catch(() => undefined)
  }, [sim.id])
  const move = async (m: 'distribuer' | 'tirer' | 'rester' | 'doubler') => {
    setBusy(true)
    setError('')
    try {
      const res = await api.blackjackMove(sim.id, m, m === 'distribuer' ? stake : 0)
      const h = res.outcome.data as BlackjackView
      setHand(h)
      haptic(h.done && (h.paid ?? 0) > h.stake ? 'success' : 'light')
      void act('Le 21', 'dice-5', 'casino', async () => res)
    } catch (e) {
      setError(errText(e))
    } finally {
      setBusy(false)
    }
  }
  const playing = hand && !hand.done
  const r = hand?.done ? RESULT[hand.result ?? ''] : null
  return (
    <div>
      <div className="rounded-[26px] border-4 border-[#7a4a1e] bg-[radial-gradient(circle_at_50%_30%,#1f8a55,#0d5c35)] p-3 shadow-[inset_0_0_24px_rgba(0,0,0,0.35)]">
        <div className="text-center text-[11px] font-extrabold tracking-[0.2em] text-[#ffcc33]/80 uppercase">La banque tire jusqu'à 17</div>
        <div className="mt-2 flex min-h-[96px] items-center justify-center gap-1.5">
          {hand ? (
            <>
              {hand.dealer.map((c, i) => (
                <div key={`${i}-${c}`} className="animate-pop">
                  <PlayingCard c={c} w={58} />
                </div>
              ))}
              {!hand.done && <CardBack w={58} />}
            </>
          ) : (
            <span className="text-[13px] font-bold text-white/60">La banque attend ta mise.</span>
          )}
        </div>
        {hand && <div className="text-center text-[13px] font-extrabold text-white/85">Banque : {hand.shown}</div>}
        <div className="my-3 h-px bg-[#ffcc33]/30" />
        <div className="flex min-h-[96px] items-center justify-center gap-1.5">
          {hand?.player.map((c, i) => (
            <div key={`${i}-${c}`} className="animate-pop">
              <PlayingCard c={c} w={58} />
            </div>
          ))}
        </div>
        {hand && (
          <div className="text-center text-[15px] font-extrabold">
            Toi : {hand.total}
            {hand.doubled ? ' · doublé' : ''} · mise {nf(hand.stake)}
          </div>
        )}
        {r && (
          <div className="animate-pop mt-2 rounded-2xl bg-black/30 p-2 text-center font-display text-[18px] font-extrabold" style={{ color: r.tone }}>
            {r.text}
            {(hand?.paid ?? 0) > 0 && hand?.result !== 'egalite' ? ` · +${nf(hand!.paid!)} Djai` : ''}
          </div>
        )}
      </div>
      {error && <p className="mt-2 text-center text-[13px] font-bold text-[#ffb3b3]">{error}</p>}
      {playing ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <button className="btn !py-3" disabled={busy} onClick={() => void move('tirer')}>
            Tirer
          </button>
          <button className="btn !py-3" style={{ background: 'linear-gradient(180deg,#5b6280,#2b2f45)' }} disabled={busy} onClick={() => void move('rester')}>
            Rester
          </button>
          <button className="btn !py-3" style={{ background: 'linear-gradient(180deg,#ffe27a,#ff9f1a)', color: '#5a1a00' }} disabled={busy || hand!.player.length !== 2 || sim.money < hand!.stake} onClick={() => void move('doubler')}>
            Doubler
          </button>
        </div>
      ) : (
        <>
          <div className="mt-3">
            <StakeField usual={stakes} value={stake} onChange={setStake} money={sim.money} disabled={busy} />
          </div>
          <button className="btn mt-2 w-full !py-3" style={{ background: 'linear-gradient(180deg,#ffe27a,#ff9f1a)', color: '#5a1a00' }} disabled={busy || !stakeOK(stake, stakes) || sim.money < stake} onClick={() => void move('distribuer')}>
            {sim.money < stake ? "Pas assez d'argent" : `Distribuer · ${nf(stake)}`}
          </button>
        </>
      )}
      <p className="mt-2 text-center text-[11.5px] font-bold text-white/55">Approche 21 sans le dépasser. Les figures valent 10, l'as 1 ou 11. Doubler : ta mise doublée, une seule carte de plus.</p>
    </div>
  )
}

/* ---------- Les tickets à gratter ---------- */

const TICKET_LOOK: Record<string, [string, string]> = {
  pinda: ['#7cd957', '#2f8f2f'],
  akwaba: ['#ff8a3d', '#d93f0b'],
  banco: ['#c08bff', '#6a1ee0'],
}

function Scratch({ world, sim, act, hold }: Props) {
  const tickets = world.casino?.tickets ?? []
  const [bought, setBought] = useState<{ res: ActionResult; data: ScratchResult; t: ScratchTicket } | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const buy = async (t: ScratchTicket) => {
    setBusy(true)
    setError('')
    try {
      hold(sim.money - t.price)
      const res = await api.scratch(sim.id, t.id)
      setBought({ res, data: res.outcome.data as ScratchResult, t })
      setRevealed(false)
    } catch (e) {
      hold(null)
      setError(errText(e))
    } finally {
      setBusy(false)
    }
  }
  // Left with its silver on (back to the casino): the money as it is.
  useEffect(() => () => hold(null), []) // eslint-disable-line react-hooks/exhaustive-deps
  const reveal = () => {
    if (!bought || revealed) return
    setRevealed(true)
    hold(null)
    haptic(bought.data.prize > 0 ? 'success' : 'light')
    const text = bought.data.prize > 0 ? `Ticket ${bought.t.name} : tu gagnes ${nf(bought.data.prize)} Djai !` : `Ticket ${bought.t.name} : perdu.`
    void act(`Ticket ${bought.t.name}`, 'dice-5', 'casino', async () => ({ ...bought.res, outcome: { ...bought.res.outcome, text } }))
  }
  if (bought)
    return (
      <div>
        <ScratchCard key={bought.res.sim.money + bought.data.cells.join()} t={bought.t} data={bought.data} revealed={revealed} onReveal={reveal} />
        {revealed ? (
          <>
            <div className={`animate-pop mt-3 rounded-2xl p-3 text-center font-display text-[20px] font-extrabold ${bought.data.prize > 0 ? 'bg-[#ffcc33] text-[#5a1a00]' : 'bg-black/30'}`}>
              {bought.data.prize > 0 ? `Gagné : ${nf(bought.data.prize)} Djai !` : 'Pas de chance cette fois.'}
            </div>
            <div className="mt-2 flex gap-2">
              <button className="rounded-full bg-white/15 px-4 py-2.5 text-[14px] font-extrabold" onClick={() => setBought(null)}>
                Autre ticket
              </button>
              <button className="btn flex-1 !py-2.5" disabled={busy || sim.money < bought.t.price} onClick={() => void buy(bought.t)}>
                Rejouer · {nf(bought.t.price)}
              </button>
            </div>
          </>
        ) : (
          <button className="mt-3 w-full rounded-full bg-white/15 py-2.5 text-[14px] font-extrabold" onClick={reveal}>
            Tout gratter
          </button>
        )}
        {error && <p className="mt-2 text-center text-[13px] font-bold text-[#ffb3b3]">{error}</p>}
      </div>
    )
  return (
    <div className="grid gap-2.5">
      {tickets.map((t) => {
        const [a, b] = TICKET_LOOK[t.id] ?? ['#ffcc33', '#d98a00']
        const top = t.prizes[t.prizes.length - 1].amount
        const odds = t.prizes.reduce((k, p) => k + 1 / p.odds, 0)
        return (
          <button key={t.id} className="relative overflow-hidden rounded-[22px] p-3 text-left shadow-[0_3px_0_rgba(0,0,0,0.25)] transition active:scale-[0.98] disabled:opacity-60" style={{ background: `linear-gradient(135deg, ${a}, ${b})` }} disabled={busy || sim.money < t.price} onClick={() => void buy(t)}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-display text-[24px] leading-none font-extrabold">{t.name}</div>
                <div className="mt-1 text-[12.5px] leading-snug font-bold text-white/90">{t.about}</div>
              </div>
              <span className="rounded-full bg-black/25 px-2.5 py-1 text-[14px] font-extrabold whitespace-nowrap">{nf(t.price)} Djai</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[11.5px] font-extrabold">
              <span className="rounded-full bg-white px-2 py-0.5 text-[#5a1a00]">Gros lot {nf(top)}</span>
              <span className="rounded-full bg-black/25 px-2 py-0.5">1 ticket sur {Math.round(1 / odds)} gagne</span>
            </div>
          </button>
        )
      })}
      {error && <p className="text-center text-[13px] font-bold text-[#ffb3b3]">{error}</p>}
    </div>
  )
}

/** A ticket: its nine amounts under a silver coat, scratched with a finger (or a mouse). */
function ScratchCard({ t, data, revealed, onReveal }: { t: ScratchTicket; data: ScratchResult; revealed: boolean; onReveal: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const down = useRef(false)
  const strokes = useRef(0)
  const [a, b] = TICKET_LOOK[t.id] ?? ['#ffcc33', '#d98a00']
  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const g = c.getContext('2d')!
    const r = c.getBoundingClientRect()
    c.width = Math.round(r.width * 2)
    c.height = Math.round(r.height * 2)
    const grad = g.createLinearGradient(0, 0, c.width, c.height)
    grad.addColorStop(0, '#d7dbe2')
    grad.addColorStop(0.5, '#a9afba')
    grad.addColorStop(1, '#cfd3da')
    g.fillStyle = grad
    g.fillRect(0, 0, c.width, c.height)
    g.fillStyle = 'rgba(255,255,255,0.55)'
    g.font = `800 ${c.width / 14}px system-ui, sans-serif`
    g.textAlign = 'center'
    for (let y = 1; y <= 3; y++) g.fillText('GRATTE ICI', c.width / 2, (c.height * y) / 3.6)
  }, [])
  const scratch = (e: RPointerEvent<HTMLCanvasElement>) => {
    if (!down.current || revealed) return
    const c = canvas.current!
    const g = c.getContext('2d')!
    const r = c.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * c.width
    const y = ((e.clientY - r.top) / r.height) * c.height
    g.globalCompositeOperation = 'destination-out'
    g.beginPath()
    g.arc(x, y, c.width / 14, 0, Math.PI * 2)
    g.fill()
    // Now and then, how much is scratched: past half, the rest falls off.
    if (++strokes.current % 12 === 0) {
      const px = g.getImageData(0, 0, c.width, c.height).data
      let clear = 0
      let n = 0
      for (let i = 3; i < px.length; i += 4 * 16) {
        n++
        if (px[i] === 0) clear++
      }
      if (clear / n > 0.5) onReveal()
    }
  }
  const counts = data.cells.reduce<Record<number, number>>((m, v) => ((m[v] = (m[v] ?? 0) + 1), m), {})
  return (
    <div className="rounded-[22px] p-3 shadow-[0_4px_0_rgba(0,0,0,0.3)]" style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-display text-[22px] font-extrabold">{t.name}</span>
        <span className="text-[12px] font-extrabold text-white/85">3 fois la même somme = gagné</span>
      </div>
      <div className="relative">
        <div className="grid grid-cols-3 gap-2 rounded-[16px] bg-[#fffaf0] p-2">
          {data.cells.map((v, i) => (
            <div key={i} className={`grid h-[72px] place-items-center rounded-[12px] text-center font-display text-[17px] leading-tight font-extrabold ${revealed && counts[v] >= 3 ? 'bg-[#ffcc33] text-[#5a1a00]' : 'bg-white text-[#1b1d21]'}`}>
              {nf(v)}
              <span className="block text-[10px] font-bold text-[#8a8fa3]">Djai</span>
            </div>
          ))}
        </div>
        <canvas
          ref={canvas}
          className={`absolute inset-0 h-full w-full touch-none rounded-[16px] transition-opacity duration-500 ${revealed ? 'pointer-events-none opacity-0' : ''}`}
          onPointerDown={(e) => ((down.current = true), e.currentTarget.setPointerCapture(e.pointerId), scratch(e))}
          onPointerMove={scratch}
          onPointerUp={() => (down.current = false)}
          onPointerCancel={() => (down.current = false)}
        />
      </div>
    </div>
  )
}
