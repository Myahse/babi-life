import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronLeft, Minus, Plus, Radio, Trophy, Users } from 'lucide-react'
import { api } from '../lib/api'
import { haptic } from '../lib/native'
import { useSession } from '../store/session'
import type { BingoCard, BingoGame, BingoRoom, BingoState, Sim, World } from '../lib/types'
import type { Act } from './phoneApps'
import { BingoMark } from '../components/AppLogo'
import { StakeField, stakeOK } from '../components/StakeField'
import { pct, useCasinoRates } from '../lib/casino'
import { GameHistory } from '../components/GameHistory'
import { RulesFold } from '../components/RulesFold'
import { t as tr, tx } from '../lib/i18n'

/**
 * Babi Bingo (backend game/bingo.go, sims/bingo.go): four rooms whose draws
 * follow one another all day, the same balls for every player at the same
 * time. Cards are bought for a room's next draw; while it runs, the balls
 * come out one by one and the cards mark themselves; once it's over, each
 * card is paid its best prize. The game's money only, adults only.
 */

const nf = (n: number) => n.toLocaleString('fr-FR')
const clockOf = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Each room's colours. */
const ROOM_LOOK: Record<string, { from: string; to: string; tag: string }> = {
  bingo75: { from: '#ff4fa3', to: '#b0127a', tag: 'B-I-N-G-O' },
  loto90: { from: '#ffb020', to: '#d9480f', tag: tr('La quine') },
  bingo80: { from: '#3ec7ff', to: '#2155d6', tag: tr('4 × 4') },
  eclair30: { from: '#a3e635', to: '#15803d', tag: tr('1 partie / minute') },
}

/** A ball's colour: Bingo 75's by its letter, the others by tens. */
function ballColour(game: string, n: number) {
  if (game === 'bingo75') return ['#2f7cf6', '#e5383b', '#8a8fa3', '#1fa64a', '#f59f00'][Math.floor((n - 1) / 15)]
  const tens = ['#2f7cf6', '#e5383b', '#1fa64a', '#f59f00', '#8b5cf6', '#ec4899', '#0ea5a4', '#f97316', '#64748b', '#2f7cf6']
  return tens[Math.floor((n - 1) / 10) % tens.length]
}

function Ball({ game, n, size = 34, pop = false }: { game: string; n: number; size?: number; pop?: boolean }) {
  // A coloured ball, its number on a white disc in the middle, a shine at its top.
  return (
    <span className={`relative grid shrink-0 place-items-center rounded-full ${pop ? 'animate-pop' : ''}`} style={{ width: size, height: size, background: `radial-gradient(circle at 35% 25%, #ffffff66, transparent 40%), ${ballColour(game, n)}`, boxShadow: `inset 0 -${size / 12}px 0 rgba(0,0,0,0.2)` }}>
      <span className="grid place-items-center rounded-full bg-white font-display font-extrabold text-[#1b1d21]" style={{ width: size * 0.62, height: size * 0.62, fontSize: size * (n > 9 ? 0.32 : 0.38) }}>
        {n}
      </span>
    </span>
  )
}

/* ---------- What a card has, what it lacks ---------- */

/** The cells of each pattern a card is judged on (backend game/bingo.go, bingoReached). */
function patterns(g: BingoGame) {
  const at = (r: number, c: number) => r * g.cols + c
  const rows = [...Array(g.rows)].map((_, r) => [...Array(g.cols)].map((__, c) => at(r, c)))
  const square = g.rows === g.cols
  const cols = square ? [...Array(g.cols)].map((_, c) => [...Array(g.rows)].map((__, r) => at(r, c))) : []
  const diags = square ? [[...Array(g.rows)].map((_, i) => at(i, i)), [...Array(g.rows)].map((_, i) => at(i, g.cols - 1 - i))] : []
  const m = Math.floor(g.rows / 2)
  return {
    lines: [...rows, ...cols, ...diags],
    rows,
    diags,
    coins: [at(0, 0), at(0, g.cols - 1), at(g.rows - 1, 0), at(g.rows - 1, g.cols - 1)],
    carre: [at(m - 1, m - 1), at(m - 1, m), at(m, m - 1), at(m, m)],
    all: [...Array(g.rows * g.cols)].map((_, i) => i),
  }
}

/** For each prize still to be had, the fewest numbers the card lacks for it. */
function lacking(g: BingoGame, card: number[], out: Set<number>) {
  const p = patterns(g)
  const miss = (cells: number[]) => cells.filter((i) => card[i] !== 0 && !out.has(card[i])).length
  const two = (sets: number[][]) => {
    const m = sets.map(miss).sort((a, b) => a - b)
    return (m[0] ?? 99) + (m[1] ?? 99)
  }
  const of: Record<string, number> = {
    ligne: Math.min(...p.lines.map(miss)),
    deux: two(p.lines),
    quine: Math.min(...p.rows.map(miss)),
    double: two(p.rows),
    coins: miss(p.coins),
    x: miss([...p.diags[0] ?? [], ...p.diags[1] ?? []]),
    carre: miss(p.carre),
    plein: miss(p.all),
  }
  return g.prizes.map((pr) => ({ prize: pr, missing: of[pr.id] ?? 99 }))
}

/** The line said under a card while its draw runs: a prize within reach. */
function nearLine(g: BingoGame, card: number[], balls: number[]) {
  const out = new Set(balls)
  const left = lacking(g, card, out).filter((x) => balls.length < x.prize.within && x.missing <= x.prize.within - balls.length)
  const done = [...left].reverse().find((x) => x.missing === 0)
  if (done) return { tone: 'win' as const, text: `${done.prize.label} ! ×${done.prize.times}` }
  const close = left.filter((x) => x.missing <= 2).sort((a, b) => a.missing - b.missing || b.prize.times - a.prize.times)[0]
  if (close) return { tone: 'near' as const, text: tr('Plus que {missing} numéro{0} pour {1} !', { missing: close.missing, 0: close.missing > 1 ? 's' : '', 1: close.prize.label.toLowerCase() }) }
  return null
}

/* ---------- A card ---------- */

function Card({ g, card, balls, small = false }: { g: BingoGame; card: BingoCard; balls: number[]; small?: boolean }) {
  const out = new Set(balls)
  const last = balls[balls.length - 1]
  const near = !small && card.status === 'open' && balls.length > 0 ? nearLine(g, card.numbers, balls) : null
  // The cells share the card's width: square ones, a little taller on the loto's 9 columns.
  const width = small ? g.cols * 20 : g.cols > 5 ? '100%' : Math.min(340, g.cols * 70)
  const font = small ? 10 : g.cols > 5 ? 14 : g.cols === 3 ? 22 : 17
  return (
    <div className={`rounded-[18px] bg-white p-2 shadow-[0_2px_0_rgba(0,0,0,0.08)] ${card.status === 'won' ? 'ring-4 ring-[#ffcc33]' : ''}`} style={{ width: small ? undefined : width, maxWidth: '100%' }}>
      {g.id === 'bingo75' && !small && (
        <div className="mb-1 grid grid-cols-5 gap-[3px]">
          {['B', 'I', 'N', 'G', 'O'].map((l, i) => (
            <span key={l} className="text-center font-display text-[15px] font-extrabold" style={{ color: ballColour('bingo75', i * 15 + 1) }}>
              {l}
            </span>
          ))}
        </div>
      )}
      <div className="grid" style={{ gridTemplateColumns: `repeat(${g.cols}, ${small ? '18px' : 'minmax(0, 1fr)'})`, gap: small ? 2 : 3 }}>
        {card.numbers.map((n, i) => {
          const free = n === 0 && g.free && i === Math.floor(g.rows / 2) * g.cols + Math.floor(g.cols / 2)
          const hit = n !== 0 && out.has(n)
          return (
            <span
              key={i}
              className={`relative grid place-items-center rounded-[8px] font-display font-extrabold ${small ? 'h-[18px]' : g.cols > 5 ? 'aspect-[4/5]' : 'aspect-square'} ${n === 0 && !free ? 'bg-[#eef0f6]' : 'bg-[#f7f4ee] text-[#1b1d21]'}`}
              style={{ fontSize: font }}
            >
              {free ? '★' : n !== 0 ? n : ''}
              {(hit || free) && (
                <span className={`absolute grid aspect-square place-items-center rounded-full text-white ${small ? 'inset-[1px]' : 'top-1/2 left-1/2 w-[84%] -translate-x-1/2 -translate-y-1/2'} ${n === last ? 'animate-pop' : ''}`} style={{ background: free ? '#ffcc33' : '#e0245ecc', fontSize: font }}>
                  {free ? '★' : n}
                </span>
              )}
            </span>
          )
        })}
      </div>
      {!small && (
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-2 px-1 text-[12px] font-extrabold">
          <span className="text-[#6b7083]">{nf(card.stake)} {tr('Djai')}</span>
          {card.status === 'won' ? (
            <span className="text-[#b07800]">
              {card.prize} · +{nf(card.payout ?? 0)}
            </span>
          ) : card.status === 'lost' ? (
            <span className="text-[#8a8fa3]">{tr('Rien cette fois')}</span>
          ) : near ? (
            <span className={near.tone === 'win' ? 'text-[#b07800]' : 'text-[#e0245e]'}>{near.text}</span>
          ) : null}
        </div>
      )}
    </div>
  )
}

/* ---------- The app ---------- */

export function BingoApp({ world, sim, act, onConfirmAdult }: { world: World; sim: Sim; act: Act; onConfirmAdult: () => Promise<void> }) {
  const adult = useSession((s) => !!s.user?.adult)
  // The prizes as each room pays them now: scaled by the casino's rate when the team set one (lib/casino.ts).
  const rate = useCasinoRates().bingo
  const games = useMemo(
    () =>
      (world.bingo?.games ?? []).map((g) => {
        const k = rate?.set ? rate.rate / (rate.variants?.[g.id] ?? rate.natural) : 1
        return k === 1 ? g : { ...g, prizes: g.prizes.map((p) => ({ ...p, times: Math.floor(p.times * k * 100) / 100 })) }
      }),
    [world.bingo, rate],
  )
  const [st, setSt] = useState<BingoState | null>(null)
  const [offset, setOffset] = useState(0)
  const [roomId, setRoomId] = useState<string | null>(null)
  const [, tick] = useState(0)
  const paid = useRef(new Set<number>())
  const load = async () => {
    const t0 = Date.now()
    const s = await api.bingo(sim.id).catch(() => null)
    if (!s) return
    setOffset(s.now - Math.round((t0 + Date.now()) / 2))
    setSt(s)
  }
  // The rooms read again every 2 s in a room (a ball comes out every 2 or so), every 5 s in the lobby.
  useEffect(() => {
    void load()
    const t = setInterval(load, roomId ? 2000 : 5000)
    return () => clearInterval(t)
  }, [roomId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 500)
    return () => clearInterval(t)
  }, [])
  // The cards whose draw is over: settled and paid (the wins come into the journal).
  useEffect(() => {
    const done = (st?.mine ?? []).filter((c) => c.status !== 'open' && !paid.current.has(c.id))
    if (!done.length) return
    done.forEach((c) => paid.current.add(c.id))
    if (done.some((c) => c.status === 'won')) haptic('success')
    void act(tr('Babi Bingo'), 'trophy', 'bingo', () => api.bingoPay(sim.id))
  }, [st]) // eslint-disable-line react-hooks/exhaustive-deps
  const now = Date.now() + offset
  const cardsLeft = (world.bingo?.perDay ?? 120) - (sim.today?.bingo?.times ?? 0)

  if (!adult)
    return (
      <div className="-mx-3 -mt-1 min-h-full bg-gradient-to-b from-[#7b2ff7] to-[#2a0a52] p-4 text-white">
        <Brand />
        <div className="mt-4 rounded-2xl bg-white/10 p-4 text-sm font-bold">
          <p>{tr("Babi Bingo est réservé aux joueurs de 18 ans et plus. On y joue avec l'argent du jeu seulement.")}</p>
          <button className="btn mt-3 w-full !py-2" onClick={() => void onConfirmAdult()}>
            {tr('J’ai 18 ans ou plus')}
          </button>
        </div>
      </div>
    )

  const room = st?.rooms.find((r) => r.game === roomId)
  const g = games.find((x) => x.id === roomId)
  if (room && g) return <Room g={g} room={room} st={st!} now={now} sim={sim} act={act} cardsLeft={cardsLeft} stakes={world.bingo?.stakes ?? [100]} perDraw={world.bingo?.perDraw ?? 4} onBack={() => setRoomId(null)} reload={load} />

  return (
    <div className="-mx-3 -mt-1 min-h-full bg-gradient-to-b from-[#7b2ff7] via-[#4c1d95] to-[#1e0b3a] p-3 pb-6 text-white">
      <Brand />
      <div className="mt-3 grid gap-2.5">
        {games.map((game) => {
          const r = st?.rooms.find((x) => x.game === game.id)
          const look = ROOM_LOOK[game.id]
          const live = r && !r.over
          const held = st?.mine.filter((c) => c.game === game.id && c.draw === r?.next).length ?? 0
          const top = game.prizes[game.prizes.length - 1]
          return (
            <button key={game.id} className="relative overflow-hidden rounded-[22px] p-3 text-left shadow-[0_4px_0_rgba(0,0,0,0.25)] transition active:scale-[0.98]" style={{ background: `linear-gradient(135deg, ${look.from}, ${look.to})` }} onClick={() => setRoomId(game.id)}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-extrabold tracking-widest text-white/80 uppercase">{look.tag}</div>
                  <div className="font-display text-[22px] leading-tight font-extrabold">{game.name}</div>
                  <div className="mt-0.5 text-[12px] leading-snug font-bold text-white/85">{game.about}</div>
                </div>
                {r && r.balls.length > 0 && <Ball game={game.id} n={r.balls[r.balls.length - 1]} size={44} />}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px] font-extrabold">
                {live ? (
                  <span className="flex items-center gap-1 rounded-full bg-black/25 px-2 py-0.5">
                    <Radio size={12} className="animate-pulse" /> {tx('En direct · boule {length}/{drawn}', { length: r.balls.length, drawn: game.drawn })}
                  </span>
                ) : (
                  <span className="rounded-full bg-black/25 px-2 py-0.5">{tr('Prochaine partie dans')} {r ? clockOf(r.nextAt - now) : '…'}</span>
                )}
                <span className="flex items-center gap-1 rounded-full bg-black/25 px-2 py-0.5">
                  <Users size={12} /> {(r?.players ?? 0) + (r?.waiting ?? 0)}
                </span>
                <span className="rounded-full bg-[#ffcc33] px-2 py-0.5 text-[#5a1a00]">
                  {tx('{label} ×{0}', { label: top.label, 0: nf(top.times) })}
                </span>
                {held > 0 && <span className="rounded-full bg-white px-2 py-0.5 text-[#4c1d95]">{held} {tx('carton{0} pris', { 0: held > 1 ? 's' : '' })}</span>}
              </div>
            </button>
          )
        })}
      </div>
      {(st?.winners.length ?? 0) > 0 && (
        <div className="mt-4 rounded-[20px] bg-white/10 p-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-extrabold tracking-wider text-[#ffcc33] uppercase">
            <Trophy size={14} /> {tr('Les derniers gagnants')}
          </div>
          {st!.winners.map((w, i) => (
            <div key={i} className="flex items-center gap-2 py-1 text-[13px] font-bold">
              <span className="min-w-0 flex-1 truncate">
                {w.mine ? tr('Toi') : w.name} · <span className="text-white/70">{games.find((x) => x.id === w.game)?.name}</span>
              </span>
              <span className="text-white/80">{w.prize}</span>
              <span className="font-extrabold text-[#ffcc33]">+{nf(w.payout)}</span>
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 text-center text-[11.5px] leading-snug font-bold text-white/60">
        {tx("Argent du jeu seulement · 18 ans et plus · encore {0} cartons aujourd'hui.", { 0: Math.max(0, cardsLeft) })}
      </p>
      <RulesFold>{tx("Comme tous les jeux d'argent, le bingo garde un peu plus qu'il ne rend : taux de retour {0}, soit environ {1} Djai rendus pour 100 misés.", { 0: pct(rate?.rate ?? 0.857), 1: Math.round((rate?.rate ?? 0.857) * 100) })}</RulesFold>
      <GameHistory simId={sim.id} jeu="bingo" />
    </div>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <BingoMark size={44} />
      <div>
        <div className="font-display text-[24px] leading-none font-extrabold">{tr('Babi Bingo')}</div>
        <div className="text-[12px] font-bold text-white/75">{tr('Le bingo en direct, toute la journée')}</div>
      </div>
    </div>
  )
}

/* ---------- A room ---------- */

function Room({ g, room, st, now, sim, act, cardsLeft, stakes, perDraw, onBack, reload }: { g: BingoGame; room: BingoRoom; st: BingoState; now: number; sim: Sim; act: Act; cardsLeft: number; stakes: number[]; perDraw: number; onBack: () => void; reload: () => Promise<void> }) {
  const look = ROOM_LOOK[g.id]
  const [stake, setStake] = useState(stakes[0])
  const [count, setCount] = useState(1)
  const [board, setBoard] = useState(false)
  const [busy, setBusy] = useState(false)
  const playing = useMemo(() => st.mine.filter((c) => c.game === g.id && c.draw === room.draw), [st.mine, g.id, room.draw])
  const next = useMemo(() => st.mine.filter((c) => c.game === g.id && c.draw === room.next), [st.mine, g.id, room.next])
  const free = Math.max(0, Math.min(perDraw - next.length, cardsLeft))
  const n = Math.min(count, Math.max(1, free))
  const ball = room.balls[room.balls.length - 1]
  const won = playing.filter((c) => c.status === 'won').reduce((t, c) => t + (c.payout ?? 0), 0)
  const buy = async () => {
    setBusy(true)
    const ok = await act(tr('Babi Bingo'), 'trophy', 'bingo', () => api.buyBingo(sim.id, g.id, n, stake))
    setBusy(false)
    if (ok) {
      haptic('light')
      await reload()
    }
  }
  return (
    <div className="-mx-3 -mt-1 min-h-full pb-6" style={{ background: `linear-gradient(180deg, ${look.from}, ${look.to} 45%, #1e0b3a)` }}>
      <div className="flex items-center gap-2 p-3 text-white">
        <button className="icon-btn bg-white/20 text-white" onClick={onBack} aria-label={tr('Retour')}>
          <ChevronLeft size={22} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="font-display text-[22px] leading-none font-extrabold">{g.name}</div>
          <div className="text-[12px] font-bold text-white/80">
            {room.over ? tr('Partie terminée') : tr('En direct · {players} joueur{0}', { players: room.players, 0: room.players > 1 ? 's' : '' })}
          </div>
        </div>
        <span className="rounded-full bg-black/25 px-2.5 py-1 text-[13px] font-extrabold text-white">{nf(sim.money)} {tr('Djai')}</span>
      </div>

      {/* The ball out, the ones before it */}
      <div className="mx-3 rounded-[24px] bg-black/25 p-3 text-white">
        <div className="flex items-center gap-3">
          {ball ? <Ball key={room.balls.length} game={g.id} n={ball} size={72} pop /> : <span className="grid h-[72px] w-[72px] place-items-center rounded-full bg-white/10 text-[12px] font-bold">…</span>}
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-extrabold tracking-wider text-white/70 uppercase">
              {tx('Boule {length} / {drawn}', { length: room.balls.length, drawn: g.drawn })}
            </div>
            <div className="mt-1 flex gap-1">
              {room.balls
                .slice(-6, -1)
                .reverse()
                .map((b) => (
                  <Ball key={b} game={g.id} n={b} size={28} />
                ))}
            </div>
          </div>
        </div>
        {/* The prizes, each within its number of balls: gone once its balls are out */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {g.prizes.map((p) => {
            const gone = room.balls.length >= p.within
            return (
              <span key={p.id} className={`rounded-full px-2 py-0.5 text-[11.5px] font-extrabold ${gone ? 'bg-white/10 text-white/40 line-through' : 'bg-white/20'}`}>
                {tx('{label} en {within} · ×{0}', { label: p.label, within: p.within, 0: nf(p.times) })}
              </span>
            )
          })}
        </div>
        <button className="mt-2 flex items-center gap-1 text-[12px] font-extrabold text-white/80" onClick={() => setBoard((b) => !b)}>
          {tr('Le tableau des boules')} <ChevronDown size={14} className={board ? 'rotate-180' : ''} />
        </button>
        {board && (
          <div className="mt-2 grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${g.balls > 30 ? 10 : 10}, minmax(0, 1fr))` }}>
            {[...Array(g.balls)].map((_, i) => {
              const out = room.balls.includes(i + 1)
              return (
                <span key={i} className="grid h-6 place-items-center rounded-[6px] text-[11px] font-extrabold" style={{ background: out ? ballColour(g.id, i + 1) : 'rgba(255,255,255,0.08)', color: out ? '#fff' : 'rgba(255,255,255,0.45)' }}>
                  {i + 1}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* The cards on this draw */}
      {playing.length > 0 && (
        <div className="mt-3 px-3">
          {room.over && (
            <div className={`animate-pop mb-2 rounded-2xl p-3 text-center font-extrabold ${won > 0 ? 'bg-[#ffcc33] text-[#5a1a00]' : 'bg-white/15 text-white'}`}>
              {won > 0 ? tr('Bravo ! Tes cartons gagnent {0} Djai', { 0: nf(won) }) : tr('Pas de gain cette fois. La prochaine partie arrive !')}
            </div>
          )}
          <div className="mb-1.5 text-[12px] font-extrabold tracking-wider text-white/80 uppercase">{tr('Tes cartons de cette partie')}</div>
          <div className="flex flex-col items-center gap-2">
            {playing.map((c) => (
              <Card key={c.id} g={g} card={c} balls={room.balls} />
            ))}
          </div>
        </div>
      )}

      {/* Cards for the next draw */}
      <div className="mx-3 mt-3 rounded-[24px] bg-white p-3">
        <div className="flex items-center justify-between">
          <div className="font-display text-[17px] font-extrabold text-[#1b1d21]">{tr('Prochaine partie')}</div>
          <div className="text-[13px] font-extrabold text-[#e0245e]">{tr('dans')} {clockOf(room.nextAt - now)}</div>
        </div>
        <div className="text-[12px] font-bold text-[#6b7083]">
          {tx('{0} · {perDraw} cartons au plus', { 0: room.waiting > 0 ? tr('{waiting} joueur{0} déjà inscrit{0}', { waiting: room.waiting, 0: room.waiting > 1 ? 's' : '' }) : tr('Sois le premier inscrit'), perDraw })}
        </div>
        {next.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {next.map((c) => (
              <Card key={c.id} g={g} card={c} balls={[]} small />
            ))}
          </div>
        )}
        {free > 0 ? (
          <>
            <div className="mt-3">
              <StakeField usual={stakes} value={stake} onChange={setStake} look="light" label={tr('Ou tape le prix du carton')} disabled={busy} />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button className="icon-btn bg-[#f1ecfb] text-[#4c1d95]" onClick={() => setCount((c) => Math.max(1, c - 1))} aria-label={tr('Un carton de moins')}>
                <Minus size={18} />
              </button>
              <span className="w-[74px] text-center font-display text-[15px] leading-tight font-extrabold text-[#1b1d21]">
                {tx('{n} carton{0}', { n, 0: n > 1 ? 's' : '' })}
              </span>
              <button className="icon-btn bg-[#f1ecfb] text-[#4c1d95]" onClick={() => setCount((c) => Math.min(free, c + 1))} aria-label={tr('Un carton de plus')}>
                <Plus size={18} />
              </button>
              <button className="btn flex-1 !px-2 !py-2.5 text-[15px] whitespace-nowrap" style={{ background: 'linear-gradient(180deg,#9b5cff,#6a1ee0)' }} disabled={busy || !stakeOK(stake, stakes) || sim.money < n * stake} onClick={() => void buy()}>
                {sim.money < n * stake ? tr("Pas assez d'argent") : tr('Prendre {0}', { 0: nf(n * stake) })}
              </button>
            </div>
          </>
        ) : (
          <p className="mt-2 text-[13px] font-bold text-[#6b7083]">{cardsLeft <= 0 ? tr("Assez de cartons pour aujourd'hui : reviens demain.") : tr('Tu as tous tes cartons pour cette partie.')}</p>
        )}
      </div>
    </div>
  )
}
