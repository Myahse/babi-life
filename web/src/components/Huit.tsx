import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Flag, RotateCcw, RotateCw, Spade, X } from 'lucide-react'
import { api, errorText } from '../lib/api'
import { haptic } from '../lib/native'
import type { DameInvite, HuitGame, HuitStep } from '../lib/types'
import { fcfa } from '../game/rules'
import { IconTile } from './ui'
import { StakeSheet } from './Stake'
import { PVP_IN } from '../lib/live'
import { MoveClock } from './pvp/MoveClock'
import { CardBack, PixelSuit, PlayingCard, SUITS, SUIT_NAMES, cardH, cardName, isJoker, rankOf, suitOf, RED, INK } from './PlayingCards'

// 8 américain at the table (backend game/huit.go plays the rules): the
// others round the top with their cards face down, the deck and the pile in
// the middle, the player's hand fanned at the bottom, the cards that go
// lifted. Every move is seen: the cards are dealt one by one at the start, a
// card played flies from the hand (or the player's seat) onto the pile and
// turns over, a card drawn flies from the deck. The game's players answer
// with the move: their moves are played out one after the other. Against a
// friend, the table is asked again every few seconds while they play. The
// stake picker, and the banner for a challenge to answer.

export const HUIT_COLORS: [string, string] = ['#2fa36b', '#0b6b3a']
/** The table: the game's green, lit in the middle, a wax print faint on it. */
const FELT = 'radial-gradient(ellipse at 50% 38%, #14a866, #087a45 58%, #04502d)'
/** Each seat's colour, for its round. */
const SEAT_COLORS = ['#ff7a00', '#7b5cff', '#3ba7ff', '#ff4d6d', '#00b86b']

const cards = (n = 0) => (n === 1 ? 'une carte' : `${n} cartes`)
const wait = (ms: number) => new Promise((ok) => setTimeout(ok, ms))

/** What a step was, told: « Kader pose le 2 de cœur : le suivant pioche 3, ou pose un 2. » */
function told(s: HuitStep, g: HuitGame) {
  const me = s.seat === g.you
  const who = me ? 'Tu' : (g.seats[s.seat]?.name ?? '…')
  if (s.kind === 'draw') return `${who} ${me ? 'pioches' : 'pioche'} ${cards(s.drawn)}.`
  if (s.kind === 'pass') return `${who} ${me ? 'gardes' : 'garde'} la carte piochée et ${me ? 'passes' : 'passe'}.`
  let t = `${who} ${me ? 'poses' : 'pose'} ${cardName(s.card)}`
  if (s.won) return `${t} et ${me ? 'tu gagnes' : 'gagne'} !`
  const r = rankOf(s.card)
  if (r === 8) t += ` et ${me ? 'demandes' : 'demande'} ${SUIT_NAMES[s.suit]} ${SUITS[s.suit]}`
  else if (isJoker(s.card)) t += ' : le suivant pioche 6, ou pose un joker'
  else if (r === 2) t += ' : le suivant pioche 3, ou pose un 2'
  else if (r === 1) t += ' : le suivant pose un as, ou pioche une carte et passe'
  else if (r === 10 || r === 11) t += g.seats.length === 2 ? ` et ${me ? 'rejoues' : 'rejoue'}` : ' : le sens change'
  if (s.forgot) t += me ? '. Tu as oublié de dire « carte » : 2 cartes de pénalité' : `. ${who} oublie de dire « carte » : 2 cartes`
  else if (s.carte) t += ` · « Carte ! »`
  return t + '.'
}

/** How much to put down at the table: typed, or for nothing. */
export function HuitStake({ against, max, money, onPick, onClose }: { against: string; max: number; money: number; onPick: (stake: number) => void; onClose: () => void }) {
  return <StakeSheet label="Une partie de 8 américain" against={against} icon={Spade} colors={HUIT_COLORS} note="Chacun met la même mise sur la table ; le premier qui n'a plus de cartes prend tout." max={max} money={money} onPick={onPick} onClose={onClose} />
}

/** A challenge to answer, or one's game going on: under the top bar, like an invitation. */
export function HuitBanner({ game, onAccept, onDecline, onOpen }: { game: DameInvite; onAccept: () => void; onDecline: () => void; onOpen: () => void }) {
  const asked = game.status === 'invited' && !game.mine
  return (
    <div className="card animate-pop pointer-events-auto w-full p-3">
      <div className="flex items-center gap-3">
        <IconTile icon={Spade} colors={HUIT_COLORS} size={42} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="label">{asked ? `${game.fromName} te défie au 8 américain` : game.status === 'invited' ? 'Ton défi au 8 américain' : 'Partie de 8 américain en cours'}</div>
          <div className="font-display text-[15px] font-extrabold">{game.stake > 0 ? `Mise : ${fcfa(game.stake)} chacun` : 'Pour le plaisir'}</div>
        </div>
        {!asked && (
          <button className="btn !py-2 !text-sm" style={{ background: HUIT_COLORS[1] }} onClick={onOpen}>
            {game.status === 'invited' ? 'Voir' : 'Reprendre'}
          </button>
        )}
      </div>
      {asked && (
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <button className="btn btn-soft !py-2 !text-sm" onClick={onDecline}>
            Pas maintenant
          </button>
          <button className="btn !py-2 !text-sm" style={{ background: HUIT_COLORS[1] }} onClick={onAccept}>
            <Spade size={16} /> On joue
          </button>
        </div>
      )}
    </div>
  )
}

/** The order the hand is shown in: by suit, then value; the jokers last. */
const handOrder = (a: number, b: number) => (isJoker(a) ? 99 : suitOf(a) * 14 + rankOf(a)) - (isJoker(b) ? 99 : suitOf(b) * 14 + rankOf(b))

/** The games already dealt out on this phone: the deal is shown once, when the game begins. */
const dealtGames = new Set<number>()

/** A point on the table (px from its top left corner), how a card is turned there (degrees), and its width. */
type Pt = { x: number; y: number; r: number; w: number }
/** A card on its way: face up (`card`), face down (null), or turning over as it goes (`flip`). */
type Flight = { id: number; card: number | null; from: Pt; to: Pt; flip?: boolean; dur: number; done: () => void }

/** A card flying from one point of the table to another, then gone (what it lands on shows it). */
function Flying({ f }: { f: Flight }) {
  const ref = useRef<HTMLDivElement>(null)
  const w = f.to.w
  const h = cardH(w)
  useLayoutEffect(() => {
    const at = (p: Pt, turned: boolean) => `translate(${p.x - w / 2}px, ${p.y - h / 2}px) rotate(${p.r}deg) scale(${p.w / w}) perspective(700px) rotateY(${turned ? 180 : 0}deg)`
    // Up off the table on the way, a little bigger, back down where it lands.
    const mid: Pt = { x: (f.from.x + f.to.x) / 2, y: (f.from.y + f.to.y) / 2 - 18, r: (f.from.r + f.to.r) / 2, w: Math.max(f.from.w, f.to.w) * 1.08 }
    const a = ref.current!.animate([{ transform: at(f.from, !!f.flip) }, { transform: at(mid, false), offset: 0.55 }, { transform: at(f.to, false) }], { duration: f.dur, easing: 'cubic-bezier(.35,.75,.3,1)', fill: 'forwards' })
    a.onfinish = f.done
    return () => a.cancel()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div ref={ref} className="pointer-events-none absolute top-0 left-0 z-30 [transform-style:preserve-3d]" style={{ width: w, height: h }}>
      {f.card === null ? (
        <CardBack w={w} />
      ) : (
        <>
          <div className="absolute inset-0 [backface-visibility:hidden]">
            <PlayingCard c={f.card} w={w} />
          </div>
          {f.flip && (
            <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
              <CardBack w={w} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** How a card lies on the pile: a little askew, the same for the same card on every phone. */
const askew = (c: number) => ({ r: ((c * 47) % 25) - 12, x: ((c * 31) % 11) - 5, y: ((c * 17) % 9) - 4 })

/** The game: the table, whose turn it is, what was done, the result; to give up, to play again. */
export function HuitSheet({ simId, onClose, onAgain, onMoney }: { simId: string; onClose: () => void; /** At the game's table: the same again (their names, the stake). */ onAgain?: (npcs: string[], stake: number) => void; /** The money moved (a game over): the Sim to be fetched again. */ onMoney?: () => void }) {
  const [game, setGame] = useState<HuitGame | null>(null)
  // The moves being played out: what's told, and the table as it was then (the cards each one
  // holds, the deck, the card on top) while the game itself is already where they lead.
  const [replay, setReplay] = useState<string | null>(null)
  const [table, setTable] = useState<{ counts: number[]; deck: number; top: number; under: number } | null>(null)
  // The Sim's cards not in the hand yet (flying in) or any more (flying out).
  const [away, setAway] = useState<ReadonlySet<number>>(new Set())
  const [flights, setFlights] = useState<Flight[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [carte, setCarte] = useState(false)
  const [asking, setAsking] = useState<number | null>(null)
  const [confirm, setConfirm] = useState(false)
  const done = useRef(false)
  // Where things are on the table, for the cards to fly between them.
  const rootRef = useRef<HTMLDivElement>(null)
  const deckRef = useRef<HTMLButtonElement>(null)
  const pileRef = useRef<HTMLDivElement>(null)
  const seatRefs = useRef<(HTMLDivElement | null)[]>([])
  const handRef = useRef<HTMLDivElement>(null)
  const nextFlight = useRef(0)
  /** The steps last played out (a friend's moves come back again and again while it's their turn). */
  const seenSteps = useRef('')

  const fly = (card: number | null, from: Pt, to: Pt, flip = false, dur = 380) =>
    new Promise<void>((landed) => {
      const id = ++nextFlight.current
      setFlights((fs) => [...fs, { id, card, from, to, flip, dur, done: () => (setFlights((all) => all.filter((x) => x.id !== id)), landed()) }])
    })
  /** The middle of an element on the table. */
  const at = (el: Element | null | undefined, w: number, r = 0): Pt => {
    const root = rootRef.current?.getBoundingClientRect()
    const b = el?.getBoundingClientRect()
    if (!root || !b) return { x: 0, y: 0, r, w }
    return { x: b.left + b.width / 2 - root.left, y: b.top + b.height / 2 - root.top, r, w }
  }
  const slot = (c: number) => {
    const el = handRef.current?.querySelector(`[data-card="${c}"]`)
    return at(el, Number(el?.getAttribute('data-w') ?? 60), Number(el?.getAttribute('data-rot') ?? 0))
  }
  const deckAt = () => at(deckRef.current, 64)
  const pileAt = (c: number) => {
    const p = at(pileRef.current, 74)
    const k = askew(c)
    return { ...p, x: p.x + k.x, y: p.y + k.y, r: k.r }
  }
  const seatAt = (i: number) => at(seatRefs.current[i], 22, 0)

  /** The cards dealt one by one round the table, seven each, then the first card turned up. */
  const deal = async (g: HuitGame) => {
    const n = g.seats.length
    const counts = new Array<number>(n).fill(0)
    const mine = [...g.hand].sort(handOrder)
    const total = g.seats.reduce((s, x) => s + x.cards, 0)
    let deck = g.deck + total + 1
    setTable({ counts: [...counts], deck, top: -1, under: -1 })
    setAway(new Set(mine))
    setReplay('On distribue les cartes…')
    await wait(250)
    const all: Promise<void>[] = []
    for (let round = 0; round < Math.max(...g.seats.map((x) => x.cards)); round++) {
      for (let k = 0; k < n; k++) {
        // From the player after the dealer round to the dealer, as at a real table.
        const seat = (g.you + 1 + k) % n
        if (round >= g.seats[seat].cards) continue
        const card = seat === g.you ? mine[round] : null
        deck--
        setTable((t) => t && { ...t, deck })
        all.push(
          fly(card, deckAt(), card === null ? seatAt(seat) : slot(card), card !== null, 330).then(() => {
            counts[seat]++
            setTable((t) => t && { ...t, counts: [...counts] })
            if (card !== null) setAway((a) => new Set([...a].filter((x) => x !== card)))
          }),
        )
        await wait(75)
      }
    }
    await Promise.all(all)
    setReplay('La première carte est retournée.')
    await fly(g.top, deckAt(), pileAt(g.top), true, 420)
    setTable(null)
    setReplay(null)
  }

  /**
   * The steps played out, from `from` on: each card played flies from the hand of whoever played it
   * onto the pile, turning over; each card drawn flies from the deck; what each one did is told.
   * The table shown is worked back from where the game is now.
   */
  const playOut = async (g: HuitGame, from: number, top: number, under: number) => {
    const steps = g.steps ?? []
    if (from >= steps.length) return
    const counts = g.seats.map((x) => x.cards)
    let deck = g.deck
    for (let k = steps.length - 1; k >= from; k--) {
      const s = steps[k]
      if (s.kind === 'play') counts[s.seat]++
      if (s.kind === 'draw') {
        counts[s.seat] -= s.drawn ?? 0
        deck += s.drawn ?? 0
      }
    }
    setTable({ counts: [...counts], deck, top, under })
    for (let k = from; k < steps.length; k++) {
      const s = steps[k]
      setReplay(told(s, g))
      if (s.kind === 'play') {
        const card = s.card
        if (s.seat === g.you) {
          // The Sim's own card, seen from a friend's game on its return: from the hand.
          await fly(card, slot(card), pileAt(card), false, 380)
        } else {
          await fly(card, seatAt(s.seat), pileAt(card), true, 460)
        }
        counts[s.seat]--
        under = top
        top = card
        setTable({ counts: [...counts], deck, top, under })
        await wait(s.won ? 900 : 420)
      } else if (s.kind === 'draw') {
        const n = s.drawn ?? 0
        const mine = s.seat === g.you ? (s.cards ?? []) : []
        if (mine.length) setAway((a) => new Set([...a, ...mine]))
        const all: Promise<void>[] = []
        for (let j = 0; j < Math.min(n, 6); j++) {
          deck = Math.max(0, deck - 1)
          setTable((t) => t && { ...t, deck })
          const card = mine[j] ?? null
          all.push(
            fly(card, deckAt(), card === null ? seatAt(s.seat) : slot(card), card !== null, 360).then(() => {
              counts[s.seat]++
              setTable((t) => t && { ...t, counts: [...counts] })
              if (card !== null) setAway((a) => new Set([...a].filter((x) => x !== card)))
            }),
          )
          await wait(110)
        }
        await Promise.all(all)
        // More than six (a joker's six and more): the rest at once.
        counts[s.seat] += Math.max(0, n - 6)
        if (mine.length > 6) setAway((a) => new Set([...a].filter((x) => !mine.includes(x))))
        setTable({ counts: [...counts], deck, top, under })
        await wait(380)
      } else {
        await wait(750)
      }
    }
    setReplay(null)
    setTable(null)
  }

  const load = useCallback(async () => {
    const r = await api.huit(simId).catch(() => null)
    if (r) setGame(r.game)
    return r?.game ?? null
  }, [simId])
  // Opened: a game just begun is dealt out first.
  useEffect(() => {
    void load().then((g) => {
      if (!g) return
      seenSteps.current = JSON.stringify(g.steps ?? [])
      if (g.status === 'playing' && !g.steps?.length && !dealtGames.has(g.id) && g.seats.every((x) => x.cards === 7)) {
        dealtGames.add(g.id)
        setBusy(true)
        void deal(g).finally(() => setBusy(false))
      }
    })
  }, [load]) // eslint-disable-line react-hooks/exhaustive-deps
  const friend = !!game && game.seats.some((s, i) => i !== game.you && !s.npc)
  // A friend's turn, or a challenge not yet answered: asked again every few seconds; their move,
  // once it comes, played out like the game's players'.
  const waiting = !!game && friend && ((game.status === 'playing' && game.turn !== game.you) || (game.status === 'invited' && game.you === 0))
  useEffect(() => {
    if (!waiting) return
    const tick = async () => {
      if (document.visibilityState !== 'visible' || busy) return
      const before = game
      const r = await api.huit(simId).catch(() => null)
      const g = r?.game
      if (!g) return
      const sig = JSON.stringify(g.steps ?? [])
      setGame(g)
      if (sig !== seenSteps.current && before && g.steps?.length) {
        seenSteps.current = sig
        setBusy(true)
        await playOut(g, 0, before.top, before.under)
        setBusy(false)
      }
    }
    const t = setInterval(tick, 2500)
    // Against a player on the spot: its move comes at once (the server says so, lib/live.ts).
    window.addEventListener(PVP_IN, tick)
    return () => (clearInterval(t), window.removeEventListener(PVP_IN, tick))
  }, [waiting, busy, game, simId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (game?.status === 'done' && !done.current && !replay) {
      done.current = true
      onMoney?.()
    }
  }, [game?.status, replay]) // eslint-disable-line react-hooks/exhaustive-deps

  // The hand's width: the fan fits it.
  const [width, setWidth] = useState(340)
  useLayoutEffect(() => {
    const el = handRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [game === null]) // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (action: 'play' | 'draw' | 'pass', play?: { card: number; suit: number }) => {
    if (!game || busy) return
    setBusy(true)
    setError(null)
    const before = game
    // The card played leaves the hand at once, onto the pile, while the server answers.
    let out: Promise<void> | null = null
    if (play) {
      haptic('light')
      out = fly(play.card, slot(play.card), pileAt(play.card), false, 380)
      setAway((a) => new Set([...a, play.card]))
    }
    const r = await api.huitAct(simId, game.id, action, play ? { ...play, carte } : undefined).catch((e: unknown) => (setError(errorText(e, 'Erreur')), null))
    setCarte(false)
    await out
    if (r) {
      const steps = r.game.steps ?? []
      seenSteps.current = JSON.stringify(steps)
      const mine = steps[0]
      // The pile as it is once the Sim's card is on it; the cards the Sim drew, still to come.
      const top = mine?.kind === 'play' ? mine.card : before.top
      const under = mine?.kind === 'play' ? before.top : before.under
      if (mine?.kind === 'draw' && mine.cards?.length) setAway((a) => new Set([...a, ...mine.cards!]))
      setTable({ counts: before.seats.map((x) => x.cards), deck: before.deck, top, under })
      setGame(r.game)
      // A frame for the hand to be laid out with the new cards (where they fly to).
      await wait(30)
      if (mine?.kind === 'draw') await playOut(r.game, 0, top, under)
      else await playOut(r.game, 1, top, under)
    }
    setAway(new Set())
    setTable(null)
    setBusy(false)
  }
  const tap = (c: number) => {
    if (!game?.legal?.includes(c) || busy) return
    if (rankOf(c) === 8) return setAsking(c)
    void act('play', { card: c, suit: -1 })
  }
  const resign = async () => {
    if (!game) return
    setConfirm(false)
    const r = await api.huitAct(simId, game.id, 'resign').catch(() => null)
    if (r) setGame(r.game)
  }

  const hand = useMemo(() => [...(game?.hand ?? [])].sort(handOrder), [game?.hand])
  // The cards seen on the pile, the last on top (a few under it, askew, as on a real table).
  const shownTop = table ? table.top : (game?.top ?? -1)
  const [pile, setPile] = useState<number[]>([])
  useEffect(() => {
    if (shownTop < 0) return
    setPile((p) => (p[p.length - 1] === shownTop ? p : [...p.filter((c) => c !== shownTop), shownTop].slice(-4)))
  }, [shownTop])
  useEffect(() => {
    // Opened on a game going on: the card under the top one too.
    if (game && game.under !== game.top && game.under >= 0) setPile((p) => (p.length ? p : [game.under, game.top]))
  }, [game?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!game) {
    return (
      <div className="absolute inset-0 z-40 grid place-items-center bg-[#0f1230]/40" onClick={onClose}>
        <div className="card p-4 font-display font-extrabold">On distribue les cartes…</div>
      </div>
    )
  }
  const mine = game.status === 'playing' && game.turn === game.you && !replay && !busy
  const legal = new Set(mine ? (game.legal ?? []) : [])
  const others = game.seats.map((s, i) => ({ ...s, i })).filter((s) => s.i !== game.you)
  const last = game.steps?.length ? game.steps[game.steps.length - 1] : null
  const over = game.status === 'done' || game.status === 'declined' || game.status === 'expired'
  const won = game.status === 'done' && game.winner === game.you
  const deckLeft = table?.deck ?? game.deck
  const status =
    replay ??
    (over
      ? (game.text ?? 'Partie finie.')
      : game.status === 'invited'
        ? game.you === 0
          ? `En attente de la réponse de ${others[0]?.name}…`
          : `${others[0]?.name} te défie.`
        : busy && !table
          ? '…'
          : game.turn === game.you
            ? (last && last.seat !== game.you ? `${told(last, game)} ` : '') +
              (game.drawn >= 0
                ? `Tu as pioché ${cardName(game.drawn)} : elle va, pose-la ou passe.`
                : game.owed > 0
                  ? `À toi : pose ${game.by === 2 ? 'un 2 ou un joker' : 'un joker'}, ou pioche ${game.owed}.`
                  : game.ace
                    ? 'À toi : pose un as, ou pioche une carte et passe.'
                    : (game.legal?.length ?? 0)
                      ? 'À toi de jouer.'
                      : 'Aucune carte ne va : pioche.')
            : `${game.seats[game.turn]?.name} joue…`)
  // Whose turn it shows: during the moves played out, nobody's (each move is told).
  const turn = game.status === 'playing' && !replay && !table ? game.turn : -1

  // The hand in a fan: the cards turned a little round a point under the hand, overlapping to fit.
  const cw = width < 360 ? 60 : 66
  const n = hand.length
  const stepX = n > 1 ? Math.min(cw * 0.7, (width - cw - 6) / (n - 1)) : 0
  const stepA = n > 1 ? Math.min(6, 44 / (n - 1)) : 0

  return (
    <div ref={rootRef} className="absolute inset-0 z-40 flex flex-col overflow-hidden text-white" style={{ background: FELT }}>
      {/* The wax print, faint on the cloth */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'repeating-radial-gradient(circle at 0 0, #fff 0 2px, transparent 2px 14px), repeating-radial-gradient(circle at 14px 14px, #fff 0 1.5px, transparent 1.5px 14px)', backgroundSize: '28px 28px' }} />
      {/* The top: the stake, to give up, to leave */}
      <div className="relative flex items-center gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="min-w-0 flex-1 leading-tight">
          <div className="font-display text-[13px] font-extrabold tracking-wider text-white/70">8 AMÉRICAIN</div>
          <div className="truncate text-sm font-extrabold">{game.stake > 0 ? `${fcfa(game.stake)} chacun · ${fcfa(game.pot)} sur la table` : 'Pour le plaisir'}</div>
        </div>
        {game.status === 'playing' &&
          (confirm ? (
            <>
              <button className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-extrabold" onClick={() => setConfirm(false)}>
                Non, je joue
              </button>
              <button className="rounded-full bg-[#d81b3f] px-3 py-1.5 text-xs font-extrabold" onClick={() => void resign()}>
                J'abandonne
              </button>
            </>
          ) : (
            <button className="grid h-9 w-9 place-items-center rounded-full bg-white/15" onClick={() => setConfirm(true)} aria-label="Abandonner">
              <Flag size={16} />
            </button>
          ))}
        <button className="grid h-9 w-9 place-items-center rounded-full bg-white/15" onClick={onClose} aria-label="Fermer">
          <X size={18} />
        </button>
      </div>

      {/* The others round the table: their round, their name, their cards face down in a little fan */}
      <div className="relative mt-3 flex justify-center gap-2 px-3">
        {others.map((s) => {
          const held = table ? table.counts[s.i] : s.cards
          const playing = turn === s.i
          return (
            <div key={s.i} className={`relative flex max-w-[48%] min-w-0 flex-1 flex-col items-center gap-1 rounded-[20px] px-2 pt-2 pb-1.5 transition-colors ${playing ? 'bg-white/20' : 'bg-black/15'}`}>
              <div className="flex max-w-full items-center gap-1.5">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full font-display text-[15px] font-extrabold ${playing ? 'animate-pulse ring-[3px] ring-[#ffc233]' : 'ring-2 ring-white/40'}`} style={{ background: SEAT_COLORS[s.i % SEAT_COLORS.length] }}>
                  {s.name.slice(0, 1)}
                </span>
                <span className="truncate font-display text-[14px] font-extrabold">{s.name}</span>
              </div>
              <div ref={(el) => void (seatRefs.current[s.i] = el)} className="relative h-[40px] w-[96px]">
                {Array.from({ length: Math.min(held, 10) }, (_, k) => {
                  const mid = (Math.min(held, 10) - 1) / 2
                  return (
                    <span key={k} className="absolute bottom-0 left-1/2 origin-bottom" style={{ transform: `translateX(${(k - mid) * 7 - 11}px) rotate(${(k - mid) * 7}deg)` }}>
                      <CardBack w={22} />
                    </span>
                  )
                })}
              </div>
              <span className={`text-[11px] font-extrabold ${held === 1 ? 'text-[#ffc233]' : 'text-white/80'}`}>{cards(held)}</span>
              {/* One card left: they say it */}
              {held === 1 && game.status === 'playing' && shownTop >= 0 && <span className="animate-pop absolute -top-2 -right-1 rounded-full rounded-bl-none bg-[#ffc233] px-2 py-0.5 font-display text-[12px] font-extrabold text-[#16161c] shadow">« Carte ! »</span>}
            </div>
          )
        })}
      </div>

      {/* The middle: the deck, the pile, which way it goes, what's asked */}
      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
        <div className="flex items-center gap-7">
          <button ref={deckRef} className="relative disabled:opacity-100" disabled={!mine || game.drawn >= 0} onClick={() => void act('draw')} aria-label="Piocher">
            {deckLeft > 2 && (
              <span className="absolute top-[5px] left-[4px]">
                <CardBack w={64} />
              </span>
            )}
            {deckLeft > 1 && (
              <span className="absolute top-[2.5px] left-[2px]">
                <CardBack w={64} />
              </span>
            )}
            <span className={`relative block ${mine && game.drawn < 0 && !legal.size ? 'animate-pulse' : ''}`}>
              <CardBack w={64} />
            </span>
            <span className="absolute -right-2 -bottom-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-extrabold">{deckLeft}</span>
          </button>
          <div ref={pileRef} className="relative" style={{ width: 74, height: cardH(74) }}>
            <span className="absolute inset-0 rounded-[10px] border-2 border-dashed border-white/25" />
            {pile.map((c, k) => {
              const a = askew(c)
              return (
                <span key={`${c}-${k}`} className="absolute top-0 left-0" style={{ transform: `translate(${a.x}px, ${a.y}px) rotate(${a.r}deg)`, filter: k < pile.length - 1 ? 'brightness(0.9)' : undefined }}>
                  <PlayingCard c={c} w={74} />
                </span>
              )
            })}
          </div>
          {game.dir === 1 ? <RotateCw size={24} className="text-white/60" aria-label="Sens des aiguilles d'une montre" /> : <RotateCcw size={24} className="text-white/60" aria-label="Sens inverse" />}
        </div>
        <div className="flex min-h-[28px] flex-wrap justify-center gap-1.5 px-3">
          {game.suit >= 0 && !replay && (
            <span className="animate-pop rounded-full bg-white px-3 py-1 text-[13px] font-extrabold" style={{ color: game.suit === 1 || game.suit === 2 ? RED : INK }}>
              <span className="inline-flex items-center gap-1.5">
                Demandé : <PixelSuit suit={game.suit} size={15} /> {SUIT_NAMES[game.suit]}
              </span>
            </span>
          )}
          {game.owed > 0 && !replay && <span className="animate-pop rounded-full bg-[#d81b3f] px-3 py-1 text-[13px] font-extrabold">+{game.owed} à piocher</span>}
          {game.ace && !replay && <span className="animate-pop rounded-full bg-[#ffc233] px-3 py-1 text-[13px] font-extrabold text-[#16161c]">As : un as, ou on pioche</span>}
        </div>
        <p key={status} className={`animate-pop min-h-[40px] max-w-[360px] rounded-2xl bg-black/20 px-4 py-2 text-center text-[14px] leading-snug font-extrabold ${won ? 'text-[#ffc233]' : ''}`}>
          {error ?? status}
        </p>
        {game.live && game.status === 'playing' && <MoveClock deadline={game.deadline} dark />}
      </div>

      {/* The hand, in a fan: the cards that go lifted, the others dimmed on one's turn */}
      <div className="relative px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mb-1 flex items-center justify-between text-[12px] font-extrabold text-white/80">
          <span className="flex items-center gap-1.5">
            <span className={`grid h-6 w-6 place-items-center rounded-full font-display text-[12px] ${turn === game.you ? 'ring-[3px] ring-[#ffc233]' : ''}`} style={{ background: SEAT_COLORS[game.you % SEAT_COLORS.length] }}>
              {game.seats[game.you]?.name.slice(0, 1)}
            </span>
            {game.seats[game.you]?.name} (toi) · {cards(hand.length)}
          </span>
          {mine && hand.length === 2 && (
            <button className={`rounded-full px-3 py-1 text-[12px] font-extrabold transition-colors ${carte ? 'bg-[#ffc233] text-[#16161c]' : 'bg-white/15'}`} onClick={() => setCarte(!carte)}>
              {carte ? '« Carte ! » dit' : 'Dire « Carte ! »'}
            </button>
          )}
        </div>
        <div ref={handRef} className="relative" style={{ height: cardH(cw) + 30 }}>
          {hand.map((c, k) => {
            const off = k - (n - 1) / 2
            const rot = off * stepA
            const lift = legal.has(c) ? 16 : 0
            return (
              <div
                key={c}
                data-card={c}
                data-rot={rot}
                data-w={cw}
                className="absolute top-[22px] origin-bottom transition-[transform,opacity] duration-300"
                style={{ left: width / 2 - cw / 2 + off * stepX, zIndex: k, transform: `translateY(${Math.abs(off) ** 1.7 * 1.1 - lift}px) rotate(${rot}deg)`, opacity: away.has(c) ? 0 : 1 }}
              >
                <PlayingCard c={c} w={cw} up={legal.has(c)} dim={mine && !legal.has(c)} onClick={() => tap(c)} />
              </div>
            )
          })}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {over ? (
            <>
              <button className="btn btn-soft !py-2.5 !text-sm" onClick={onClose}>
                Se lever
              </button>
              <button className="btn !py-2.5 !text-sm" style={{ background: '#ff7a00' }} disabled={friend || !onAgain} onClick={() => onAgain?.(others.map((s) => s.name), game.stake)}>
                <RotateCcw size={15} /> Une autre
              </button>
            </>
          ) : game.status === 'invited' ? (
            <button className="btn btn-soft col-span-2 !py-2.5 !text-sm" onClick={onClose}>
              Attendre sa réponse
            </button>
          ) : game.drawn >= 0 && mine ? (
            <>
              <button className="btn btn-soft !py-2.5 !text-sm" disabled={busy} onClick={() => void act('pass')}>
                Garder et passer
              </button>
              <button className="btn !py-2.5 !text-sm" style={{ background: '#ff7a00' }} disabled={busy} onClick={() => tap(game.drawn)}>
                Poser {cardName(game.drawn).replace(/^(le |la |l'|un )/, '')}
              </button>
            </>
          ) : (
            <button className="btn col-span-2 !py-2.5 !text-sm" style={{ background: '#ff7a00' }} disabled={!mine} onClick={() => void act('draw')}>
              {game.owed > 0 ? `Piocher ${game.owed}` : game.ace ? 'Piocher une carte et passer' : 'Piocher'}
            </button>
          )}
        </div>
      </div>

      {/* The cards on their way */}
      {flights.map((f) => (
        <Flying key={f.id} f={f} />
      ))}

      {/* An 8: the suit to ask for */}
      {asking !== null && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-black/45 p-6" onClick={() => setAsking(null)}>
          <div className="animate-pop w-full max-w-[320px] rounded-[24px] bg-white p-4 text-[var(--color-ink)]" onClick={(e) => e.stopPropagation()}>
            <p className="text-center font-display text-[17px] font-extrabold">Tu demandes quelle couleur ?</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {SUITS.map((s, k) => (
                <button key={s} className="flex items-center justify-center gap-2 rounded-2xl bg-[var(--color-canvas)] py-3 text-[15px] font-extrabold" style={{ color: k === 1 || k === 2 ? RED : INK }} onClick={() => (setAsking(null), void act('play', { card: asking, suit: k }))}>
                  <PixelSuit suit={k} size={22} /> {SUIT_NAMES[k]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
