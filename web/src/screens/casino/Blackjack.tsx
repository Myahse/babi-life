import { useEffect, useRef, useState, type ReactNode } from 'react'
import { api, ApiError } from '../../lib/api'
import { haptic } from '../../lib/native'
import { sfx } from '../../lib/sfx'
import type { BlackjackMove, BlackjackResult, BlackjackView, Sim, World } from '../../lib/types'
import type { Act } from '../phoneApps'
import { CardBack, PlayingCard } from '../../components/PlayingCards'
import { StakeField, stakeOK } from '../../components/StakeField'
import { pct, useCasinoRates } from '../../lib/casino'
import { GameHistory } from '../../components/GameHistory'
import { RulesFold } from '../../components/RulesFold'

/**
 * Le 21 of Babi Casino (backend game/casino.go): against the bank, which draws
 * to 17. The cards slide off the shoe one after the other; a pair can be split
 * into two hands, each with its own stake; when the bank shows an ace, it
 * offers the insurance first. At the end the bank turns its card and draws,
 * card by card, before the result is told. The shoe stays on the server.
 */

const nf = (n: number) => n.toLocaleString('fr-FR')
const errText = (e: unknown) => (e instanceof ApiError && e.status === 0 ? 'Hors ligne' : e instanceof Error ? e.message : 'Erreur')
const STAGGER = 260

type Props = { world: World; sim: Sim; act: Act; hold: (money: number | null) => void }

const RESULT: Record<BlackjackResult, { text: string; tone: string }> = {
  blackjack: { text: 'Blackjack ! Payé 3 pour 2', tone: '#ffcc33' },
  gagne: { text: 'Gagné !', tone: '#7cfc9a' },
  egalite: { text: 'Égalité : ta mise revient', tone: '#ffffff' },
  perdu: { text: 'La banque gagne', tone: '#ffb3b3' },
  saute: { text: 'Plus de 21 : tu as sauté', tone: '#ffb3b3' },
}
// A hand's own word, once split (« la main » : feminine).
const SEAT_RESULT: Record<BlackjackResult, string> = { blackjack: 'Blackjack', gagne: 'Gagnée', egalite: 'Égalité', perdu: 'Perdue', saute: 'Sautée' }

/** A hand's total, the ace as 11 when it fits (as game.HandTotal). */
function total(cards: number[]) {
  let t = 0
  let ace = false
  for (const c of cards) {
    t += Math.min(10, (c % 13) + 1)
    if (c % 13 === 0) ace = true
  }
  return ace && t + 10 <= 21 ? t + 10 : t
}

/**
 * The cards new since the last view, in the order the croupier lays them: for a
 * new round one to the player, one to the bank, the second to the player, the
 * bank's face down; then the player's cards, then the bank's.
 */
function dealOrder(before: BlackjackView | null, now: BlackjackView) {
  const order = new Map<string, number>()
  const add = (k: string) => order.set(k, order.size)
  if (!before || before.done) {
    now.hands.forEach((_, i) => add(`p${i}-0`))
    if (now.dealer.length) add('d0')
    now.hands.forEach((h, i) => h.cards.slice(1).forEach((_, j) => add(`p${i}-${j + 1}`)))
    now.dealer.slice(1).forEach((_, j) => add(`d${j + 1}`))
    if (!now.done) add('back')
    return order
  }
  now.hands.forEach((h, i) => {
    const was = before.hands[i]?.cards ?? []
    h.cards.forEach((c, j) => was[j] !== c && add(`p${i}-${j}`))
  })
  now.dealer.forEach((c, j) => before.dealer[j] !== c && add(`d${j}`))
  return order
}

/** What the croupier says. */
function croupier(h: BlackjackView | null) {
  if (!h) return 'Faites vos jeux.'
  if (h.offer) return 'La banque montre un as. Une assurance ?'
  if (!h.done) return h.hands.length > 1 ? `Main ${h.at + 1} sur 2 : carte ou pas ?` : h.canSplit ? 'Une paire ! Tu peux séparer.' : 'Carte ou pas ?'
  if (h.dealer.length === 2 && h.shown === 21) return 'Blackjack de la banque.'
  if (h.hands.every((x) => total(x.cards) > 21)) return 'Plus de 21 : la banque ramasse.'
  if (h.shown > 21) return `La banque saute à ${h.shown} !`
  return `La banque fait ${h.shown}.`
}

/** A row of cards, overlapping when they don't fit in `room`; `place(j)` names the j-th card's place in the deal order. */
function Cards({ cards, w, room, place, order, round, back }: { cards: number[]; w: number; room: number; place: (j: number) => string; order: Map<string, number>; round: number; back?: boolean }) {
  const n = cards.length + (back ? 1 : 0)
  const gap = n > 1 ? Math.min(6, (room - n * w) / (n - 1)) : 0
  // Keyed by the round and the card too: a card swapped in its place (a split) is dealt anew.
  const slot = (k: string, key: string, j: number, card: ReactNode) => {
    const at = order.get(k)
    return (
      <div key={key} className={at === undefined ? '' : 'animate-deal'} style={{ marginLeft: j ? gap : 0, animationDelay: at === undefined ? undefined : `${at * STAGGER}ms` }}>
        {card}
      </div>
    )
  }
  return (
    <div className="flex items-center justify-center">
      {cards.map((c, j) => slot(place(j), `${round}-${place(j)}-${c}`, j, <PlayingCard c={c} w={w} />))}
      {back && slot('back', `${round}-back`, cards.length, <CardBack w={w} />)}
    </div>
  )
}

export function Blackjack({ world, sim, act, hold }: Props) {
  const stakes = world.casino?.stakes ?? [100, 500, 1000]
  const [hand, setHand] = useState<BlackjackView | null>(null)
  const br = useCasinoRates()['21']
  // The view before the last move, to tell which cards are new, and the round's number, to deal a new round afresh.
  const [before, setBefore] = useState<BlackjackView | null>(null)
  const [round, setRound] = useState(0)
  const [stake, setStake] = useState(stakes[0])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const timers = useRef<number[]>([])
  useEffect(() => {
    void api
      .blackjack(sim.id)
      .then((r) => setHand(r.hand))
      .catch(() => undefined)
  }, [sim.id])
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout)
      hold(null)
    },
    [hold],
  )
  const later = (ms: number, f: () => void) => timers.current.push(window.setTimeout(f, ms))

  const move = async (m: BlackjackMove) => {
    setBusy(true)
    setError('')
    hold(sim.money)
    try {
      const res = await api.blackjackMove(sim.id, m, m === 'distribuer' ? stake : 0)
      const h = res.outcome.data as BlackjackView
      const was = m === 'distribuer' ? null : hand
      const n = dealOrder(was, h).size
      if (m === 'distribuer') setRound((r) => r + 1)
      setBefore(was)
      setHand(h)
      for (let k = 0; k < n; k++) later(k * STAGGER, () => sfx.card())
      if (m === 'assurance') sfx.chip()
      // The money and the word once the last card is down.
      later(n * STAGGER + 200, () => {
        hold(null)
        if (!h.done) return
        const paid = h.paid ?? 0
        haptic(paid > h.staked ? 'success' : 'light')
        if (paid > h.staked) sfx.win(h.result === 'blackjack')
        else if (paid === h.staked) sfx.chip()
        else sfx.lose()
      })
      void act('Le 21', 'dice-5', 'casino', async () => res)
    } catch (e) {
      hold(null)
      setError(errText(e))
    } finally {
      setBusy(false)
    }
  }

  const order = hand ? dealOrder(before, hand) : new Map<string, number>()
  const reveal = order.size * STAGGER
  const playing = hand && !hand.done
  const seat = hand ? hand.hands[Math.min(hand.at, hand.hands.length - 1)] : null
  const split = (hand?.hands.length ?? 0) > 1
  const half = Math.floor((hand?.stake ?? 0) / 2)
  const r = hand?.done && hand.result ? RESULT[hand.result] : null
  const gold = { background: 'linear-gradient(180deg,#ffe27a,#ff9f1a)', color: '#5a1a00' }
  const slate = { background: 'linear-gradient(180deg,#5b6280,#2b2f45)' }
  return (
    <div>
      <div className="rounded-[26px] border-4 border-[#7a4a1e] bg-[radial-gradient(circle_at_50%_30%,#1f8a55,#0d5c35)] p-3 shadow-[inset_0_0_24px_rgba(0,0,0,0.35)]">
        <div className="text-center text-[10.5px] font-extrabold tracking-[0.2em] text-[#ffcc33]/80 uppercase">La banque tire jusqu'à 17</div>
        <div key={`${round}-${croupier(hand)}`} className="animate-pop mt-1 text-center text-[13.5px] font-extrabold text-white" style={{ animationDelay: hand?.done ? `${reveal}ms` : undefined }}>
          « {croupier(hand)} »
        </div>
        <div className="mt-2 flex min-h-[90px] items-center justify-center">
          {hand ? <Cards cards={hand.dealer} w={56} room={300} place={(j) => `d${j}`} order={order} round={round} back={!hand.done} /> : <span className="text-[13px] font-bold text-white/60">La banque attend ta mise.</span>}
        </div>
        {hand && (
          <div className="text-center text-[13px] font-extrabold text-white/85">
            Banque :{' '}
            <span key={`${round}-${hand.shown}`} className="animate-pop inline-block" style={{ animationDelay: hand.done ? `${reveal}ms` : undefined }}>
              {hand.shown}
            </span>
            {(hand.insurance ?? 0) > 0 && <span className="ml-2 rounded-full bg-[#ffcc33]/20 px-2 py-0.5 text-[11px] text-[#ffcc33]">assuré · {nf(hand.insurance!)}</span>}
          </div>
        )}
        <div className="my-3 h-px bg-[#ffcc33]/30" />
        {hand && (
          <div className={split ? 'grid grid-cols-2 gap-2' : ''}>
            {hand.hands.map((x, i) => {
              const now = playing && split && i === hand.at
              return (
                <div key={i} className={`rounded-2xl p-1.5 transition ${now ? 'bg-white/10 ring-2 ring-[#ffcc33]' : ''} ${playing && split && i !== hand.at ? 'opacity-60' : ''}`}>
                  <div className="flex min-h-[90px] items-center justify-center">
                    <Cards cards={x.cards} w={split ? 44 : 58} room={split ? 140 : 300} place={(j) => `p${i}-${j}`} order={order} round={round} />
                  </div>
                  <div className="text-center text-[14px] font-extrabold">
                    {split ? `Main ${i + 1}` : 'Toi'} : {total(x.cards)}
                    {x.doubled ? ' · doublé' : ''}
                    <span className="block text-[11.5px] text-white/70">mise {nf(x.stake)}</span>
                  </div>
                  {split && hand.done && x.result && (
                    <div className="animate-pop mt-1 text-center text-[12px] font-extrabold" style={{ animationDelay: `${reveal}ms`, color: RESULT[x.result].tone }}>
                      {SEAT_RESULT[x.result]}
                      {(x.paid ?? 0) > 0 ? ` · ${nf(x.paid!)}` : ''}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
        {r && (
          <div key={round} className="animate-pop mt-2 rounded-2xl bg-black/30 p-2 text-center font-display text-[18px] font-extrabold" style={{ color: r.tone, animationDelay: `${reveal}ms` }}>
            {r.text}
            {!split && !hand?.insurance && (hand?.paid ?? 0) > 0 && hand?.result !== 'egalite' ? ` · +${nf(hand!.paid!)} Djai` : ''}
            {(split || (hand?.insurance ?? 0) > 0) && (
              <span className="block font-sans text-[12px] text-white/80">
                Reçu {nf(hand?.paid ?? 0)} pour {nf(hand!.staked)} misés
              </span>
            )}
          </div>
        )}
      </div>
      {error && <p className="mt-2 text-center text-[13px] font-bold text-[#ffb3b3]">{error}</p>}
      {playing && hand.offer ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button className="btn !py-3" style={gold} disabled={busy || sim.money < half} onClick={() => void move('assurance')}>
              Assurance · {nf(half)}
            </button>
            <button className="btn !py-3" style={slate} disabled={busy} onClick={() => void move('non')}>
              Non merci
            </button>
          </div>
          <p className="mt-2 text-center text-[11.5px] font-bold text-white/60">L'assurance coûte la moitié de ta mise et paie 2 pour 1 si la banque a un blackjack.</p>
        </>
      ) : playing ? (
        <div className={`mt-3 grid gap-2 ${hand.canSplit ? 'grid-cols-4' : 'grid-cols-3'}`}>
          <button className="btn !px-1 !py-3" disabled={busy} onClick={() => void move('tirer')}>
            Tirer
          </button>
          <button className="btn !px-1 !py-3" style={slate} disabled={busy} onClick={() => void move('rester')}>
            Rester
          </button>
          <button className="btn !px-1 !py-3" style={gold} disabled={busy || seat!.cards.length !== 2 || sim.money < seat!.stake} onClick={() => void move('doubler')}>
            Doubler
          </button>
          {hand.canSplit && (
            <button className="btn !px-1 !py-3" style={{ background: 'linear-gradient(180deg,#c08bff,#6a1ee0)' }} disabled={busy || sim.money < hand.stake} onClick={() => void move('separer')}>
              Séparer
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="mt-3">
            <StakeField usual={stakes} value={stake} onChange={setStake} money={sim.money} disabled={busy} />
          </div>
          <button className="btn mt-2 w-full !py-3" style={gold} disabled={busy || !stakeOK(stake, stakes) || sim.money < stake} onClick={() => void move('distribuer')}>
            {sim.money < stake ? "Pas assez d'argent" : `Distribuer · ${nf(stake)}`}
          </button>
        </>
      )}
      <RulesFold>
        Approche 21 sans le dépasser. Les figures valent 10, l'as 1 ou 11. Doubler : ta mise doublée, une seule carte de plus. Séparer : une paire devient deux mains, une mise de plus.
        {/* At a rate the team set (lib/casino.ts), the house's commission on the net winnings (the server's game.Commission21). */}
        {br?.set && br.rate < 0.985 ? ` Taux de retour ${pct(br.rate)} : la maison garde ${pct(Math.min(1, (0.985 - br.rate) / 0.4577))} du gain net.` : ` Taux de retour ${pct(0.985)}.`}
      </RulesFold>
      <GameHistory simId={sim.id} jeu="21" tick={hand?.done} />
    </div>
  )
}
