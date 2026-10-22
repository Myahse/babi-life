import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Flag, RotateCcw, RotateCw, Spade, Star, X } from 'lucide-react'
import { api } from '../lib/api'
import type { DameInvite, HuitGame, HuitStep } from '../lib/types'
import { fcfa } from '../game/rules'
import { IconTile } from './ui'
import { StakeSheet } from './Stake'

// 8 américain at the table (backend game/huit.go plays the rules): the
// others at the top with how many cards they hold, the deck and the card
// played on in the middle, the player's hand at the bottom, the cards that
// go lifted. The game's players answer with the move: what each one did is
// told one after the other. Against a friend, the table is asked again every
// few seconds while they play. The stake picker, and the banner for a
// challenge to answer.

export const HUIT_COLORS: [string, string] = ['#2fa36b', '#0b6b3a']
const FELT = 'radial-gradient(ellipse at 50% 35%, #1f8a55, #0b5a33 70%, #073f24)'

/** A card: 0–51 is suit × 13 + value − 1, 52 and 53 the jokers (lib/types.ts HuitStep). */
const SUITS = ['♣', '♦', '♥', '♠']
const SUIT_NAMES = ['trèfle', 'carreau', 'cœur', 'pique']
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'V', 'D', 'R']
const VALUE_NAMES = ['as', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'valet', 'dame', 'roi']
const isJoker = (c: number) => c >= 52
const rankOf = (c: number) => (isJoker(c) ? 0 : (c % 13) + 1)
const suitOf = (c: number) => (isJoker(c) ? -1 : Math.floor(c / 13))
const isRed = (c: number) => (isJoker(c) ? c === 52 : suitOf(c) === 1 || suitOf(c) === 2)

/** « l'as de cœur », « le 7 de pique », « la dame de trèfle », « un joker ». */
export function cardName(c: number) {
  if (isJoker(c)) return 'un joker'
  const v = VALUE_NAMES[rankOf(c) - 1]
  return `${v === 'as' ? "l'" : v === 'dame' ? 'la ' : 'le '}${v} de ${SUIT_NAMES[suitOf(c)]}`
}

const cards = (n = 0) => (n === 1 ? 'une carte' : `${n} cartes`)

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

/** A card face up: its value and suit in the corners, the suit (or the figure) in the middle. */
export function PlayingCard({ c, w = 58, dim, up, onClick }: { c: number; w?: number; dim?: boolean; up?: boolean; onClick?: () => void }) {
  const h = Math.round(w * 1.42)
  const color = isRed(c) ? '#d81b3f' : '#16161c'
  const Tag = onClick ? 'button' : 'div'
  const base = `relative shrink-0 overflow-hidden rounded-[9px] border border-black/15 bg-white shadow-[0_3px_8px_-3px_rgba(0,0,0,0.55)] transition-transform ${up ? '-translate-y-2.5' : ''} ${dim ? 'brightness-75 saturate-50' : ''}`
  if (isJoker(c)) {
    return (
      <Tag className={base} style={{ width: w, height: h }} onClick={onClick} aria-label="Joker">
        <span className="absolute inset-0 grid place-items-center">
          <Star size={w * 0.46} strokeWidth={2.2} color={color} fill={c === 52 ? '#ffd166' : '#e6e7ee'} />
        </span>
        <span className="absolute top-1 left-1 font-display leading-none font-extrabold [writing-mode:vertical-rl]" style={{ color, fontSize: w * 0.17 }}>
          JOKER
        </span>
      </Tag>
    )
  }
  const r = rankOf(c)
  const s = SUITS[suitOf(c)]
  const face = r >= 11
  return (
    <Tag className={base} style={{ width: w, height: h }} onClick={onClick} aria-label={cardName(c)}>
      <span className="absolute top-0.5 left-1 text-center leading-none font-extrabold" style={{ color, fontSize: w * 0.25 }}>
        {VALUES[r - 1]}
        <br />
        <span style={{ fontSize: w * 0.22 }}>{s}</span>
      </span>
      <span className="absolute inset-0 grid place-items-center" style={{ color }}>
        {face ? (
          <span className="grid place-items-center rounded-md border-2 font-display leading-none font-extrabold" style={{ borderColor: color, width: w * 0.5, height: w * 0.62, fontSize: w * 0.3, background: isRed(c) ? '#fff0f3' : '#f1f2f6' }}>
            {VALUES[r - 1]}
          </span>
        ) : (
          <span style={{ fontSize: w * 0.5, lineHeight: 1 }}>{s}</span>
        )}
      </span>
      <span className="absolute right-1 bottom-0.5 rotate-180 text-center leading-none font-extrabold" style={{ color, fontSize: w * 0.25 }}>
        {VALUES[r - 1]}
      </span>
    </Tag>
  )
}

/** A card face down: the game's colours. */
function CardBack({ w = 22 }: { w?: number }) {
  return <span className="block shrink-0 rounded-[4px] border-2 border-white shadow-[0_2px_4px_rgba(0,0,0,0.4)]" style={{ width: w, height: Math.round(w * 1.42), background: 'repeating-linear-gradient(45deg,#ff7a00 0 4px,#e85d00 4px 8px)' }} />
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

/** The game: the table, whose turn it is, what was done, the result; to give up, to play again. */
export function HuitSheet({ simId, onClose, onAgain, onMoney }: { simId: string; onClose: () => void; /** At the game's table: the same again (their names, the stake). */ onAgain?: (npcs: string[], stake: number) => void; /** The money moved (a game over): the Sim to be fetched again. */ onMoney?: () => void }) {
  const [game, setGame] = useState<HuitGame | null>(null)
  // The game's players' moves, told one after the other: the step shown, and the card it put down.
  const [replay, setReplay] = useState<{ text: string; top?: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [carte, setCarte] = useState(false)
  const [asking, setAsking] = useState<number | null>(null)
  const [confirm, setConfirm] = useState(false)
  const done = useRef(false)
  const load = useCallback(async () => {
    const r = await api.huit(simId).catch(() => null)
    if (r) setGame(r.game)
  }, [simId])
  useEffect(() => {
    void load()
  }, [load])
  const friend = !!game && game.seats.some((s, i) => i !== game.you && !s.npc)
  // A friend's turn, or a challenge not yet answered: asked again every few seconds.
  const waiting = !!game && friend && ((game.status === 'playing' && game.turn !== game.you) || (game.status === 'invited' && game.you === 0))
  useEffect(() => {
    if (!waiting) return
    const t = setInterval(() => document.visibilityState === 'visible' && void load(), 2500)
    return () => clearInterval(t)
  }, [waiting, load])
  useEffect(() => {
    if (game?.status === 'done' && !done.current && !replay) {
      done.current = true
      onMoney?.()
    }
  }, [game?.status, replay]) // eslint-disable-line react-hooks/exhaustive-deps

  // The hand's width: the cards overlap to fit it.
  const handRef = useRef<HTMLDivElement>(null)
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
    const r = await api.huitAct(simId, game.id, action, play ? { ...play, carte } : undefined).catch((e: unknown) => (setError(e instanceof Error ? e.message : 'Erreur'), null))
    setCarte(false)
    if (r) {
      // The Sim's own move told, then each of the game's players' after it.
      const steps = r.game.steps ?? []
      setGame(r.game)
      for (const [k, s] of steps.entries()) {
        if (steps.length === 1) break
        setReplay({ text: told(s, r.game), top: s.kind === 'play' ? s.card : undefined })
        await new Promise((ok) => setTimeout(ok, k === 0 ? 700 : s.kind === 'play' ? 900 : 650))
      }
      setReplay(null)
    }
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
  if (!game) {
    return (
      <div className="absolute inset-0 z-40 grid place-items-center bg-[#0f1230]/40" onClick={onClose}>
        <div className="card p-4 font-display font-extrabold">On distribue les cartes…</div>
      </div>
    )
  }
  const mine = game.status === 'playing' && game.turn === game.you && !replay
  const legal = new Set(mine ? (game.legal ?? []) : [])
  const others = game.seats.map((s, i) => ({ ...s, i })).filter((s) => s.i !== game.you)
  const last = game.steps?.length ? game.steps[game.steps.length - 1] : null
  const over = game.status === 'done' || game.status === 'declined' || game.status === 'expired'
  const won = game.status === 'done' && game.winner === game.you
  const top = replay?.top ?? game.top
  const status =
    replay?.text ??
    (over
      ? (game.text ?? 'Partie finie.')
      : game.status === 'invited'
        ? game.you === 0
          ? `En attente de la réponse de ${others[0]?.name}…`
          : `${others[0]?.name} te défie.`
        : mine
          ? (last && last.seat !== game.you ? `${told(last, game)} ` : '') +
            (game.drawn >= 0
            ? `Tu as pioché ${cardName(game.drawn)} : elle va, pose-la ou passe.`
            : game.owed > 0
              ? `À toi : pose ${game.by === 2 ? 'un 2 ou un joker' : 'un joker'}, ou pioche ${game.owed}.`
              : game.ace
                ? 'À toi : pose un as, ou pioche une carte et passe.'
                : legal.size
                  ? 'À toi de jouer.'
                  : 'Aucune carte ne va : pioche.')
          : last && game.status === 'playing'
            ? `${told(last, game)} ${game.seats[game.turn]?.name} joue…`
            : `${game.seats[game.turn]?.name} joue…`)
  // The hand fits its width: the cards overlap when there are many.
  const cw = width < 360 ? 54 : 60
  const step = hand.length > 1 ? Math.min(cw + 4, (width - cw) / (hand.length - 1)) : cw

  return (
    <div className="absolute inset-0 z-40 flex flex-col text-white" style={{ background: FELT }}>
      {/* The top: the stake, to give up, to leave */}
      <div className="flex items-center gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
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

      {/* The others: their name, their cards face down, « carte ! » at one */}
      <div className="mt-3 flex gap-2 px-3">
        {others.map((s) => (
          <div key={s.i} className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 transition-colors ${game.turn === s.i && game.status === 'playing' ? 'bg-white/20 ring-2 ring-[#ffd166]' : 'bg-black/15'}`}>
            <div className="flex max-w-full items-center gap-1.5">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#ff7a00] text-[11px] font-extrabold">{s.name.slice(0, 1)}</span>
              <span className="truncate text-[13px] font-extrabold">{s.name}</span>
            </div>
            <div className="flex h-[31px] items-center pl-2.5">
              {Array.from({ length: Math.min(s.cards, 9) }, (_, k) => (
                <span key={k} className="-ml-2.5">
                  <CardBack />
                </span>
              ))}
            </div>
            <span className={`text-[11px] font-extrabold ${s.cards === 1 ? 'text-[#ffd166]' : 'text-white/80'}`}>{s.cards === 1 ? '« Carte ! »' : cards(s.cards)}</span>
          </div>
        ))}
      </div>

      {/* The middle: the deck, the card played on, what's asked */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
        <div className="flex items-center gap-6">
          <button className="relative disabled:opacity-60" disabled={!mine || game.drawn >= 0 || busy} onClick={() => void act('draw')} aria-label="Piocher">
            <span className="absolute top-1 left-1">
              <CardBack w={64} />
            </span>
            <CardBack w={64} />
            <span className="absolute -right-2 -bottom-2 rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-extrabold">{game.deck}</span>
          </button>
          <div className="relative">
            {isJoker(top) && top === game.top && game.under !== top && (
              <span className="absolute top-0 -left-5 -rotate-12">
                <PlayingCard c={game.under} w={74} />
              </span>
            )}
            <span key={top} className="animate-pop relative block">
              <PlayingCard c={top} w={74} />
            </span>
          </div>
          {game.dir === 1 ? <RotateCw size={22} className="text-white/60" aria-label="Sens des aiguilles d'une montre" /> : <RotateCcw size={22} className="text-white/60" aria-label="Sens inverse" />}
        </div>
        <div className="flex min-h-[28px] flex-wrap justify-center gap-1.5 px-3">
          {game.suit >= 0 && !replay && (
            <span className="rounded-full bg-white px-3 py-1 text-[13px] font-extrabold" style={{ color: game.suit === 1 || game.suit === 2 ? '#d81b3f' : '#16161c' }}>
              Demandé : {SUITS[game.suit]} {SUIT_NAMES[game.suit]}
            </span>
          )}
          {game.owed > 0 && !replay && <span className="rounded-full bg-[#d81b3f] px-3 py-1 text-[13px] font-extrabold">+{game.owed} à piocher</span>}
          {game.ace && !replay && <span className="rounded-full bg-[#ffd166] px-3 py-1 text-[13px] font-extrabold text-[#16161c]">As : un as, ou on pioche</span>}
        </div>
        <p className={`min-h-[40px] px-5 text-center text-[14px] leading-snug font-extrabold ${won ? 'text-[#ffd166]' : ''}`}>{error ?? status}</p>
      </div>

      {/* The hand: the cards that go lifted */}
      <div className="px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mb-1 flex items-center justify-between text-[12px] font-extrabold text-white/80">
          <span>
            {game.seats[game.you]?.name} (toi) · {cards(hand.length)}
          </span>
          {mine && hand.length === 2 && (
            <button className={`rounded-full px-3 py-1 text-[12px] font-extrabold transition-colors ${carte ? 'bg-[#ffd166] text-[#16161c]' : 'bg-white/15'}`} onClick={() => setCarte(!carte)}>
              {carte ? '« Carte ! » dit' : 'Dire « Carte ! »'}
            </button>
          )}
        </div>
        <div ref={handRef} className="flex h-[100px] items-end pt-3">
          {hand.map((c, k) => (
            <span key={c} style={{ marginLeft: k ? step - cw : 0, zIndex: k }}>
              <PlayingCard c={c} w={cw} up={legal.has(c)} dim={mine && !legal.has(c)} onClick={() => tap(c)} />
            </span>
          ))}
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
            <button className="btn col-span-2 !py-2.5 !text-sm" style={{ background: '#ff7a00' }} disabled={!mine || busy} onClick={() => void act('draw')}>
              {game.owed > 0 ? `Piocher ${game.owed}` : game.ace ? 'Piocher une carte et passer' : 'Piocher'}
            </button>
          )}
        </div>
      </div>

      {/* An 8: the suit to ask for */}
      {asking !== null && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-black/45 p-6" onClick={() => setAsking(null)}>
          <div className="w-full max-w-[320px] rounded-[24px] bg-white p-4 text-[var(--color-ink)]" onClick={(e) => e.stopPropagation()}>
            <p className="text-center font-display text-[17px] font-extrabold">Tu demandes quelle couleur ?</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {SUITS.map((s, k) => (
                <button key={s} className="flex items-center justify-center gap-2 rounded-2xl bg-[var(--color-canvas)] py-3 text-[15px] font-extrabold" style={{ color: k === 1 || k === 2 ? '#d81b3f' : '#16161c' }} onClick={() => (setAsking(null), void act('play', { card: asking, suit: k }))}>
                  <span className="text-2xl leading-none">{s}</span> {SUIT_NAMES[k]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
