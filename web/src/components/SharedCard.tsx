import { useEffect, useState } from 'react'
import { GraduationCap, Car, Check, Clock3, Coffee, Gamepad2, Joystick, Link2, Send, ShoppingCart, Swords, Ticket, Trophy, Users, Waves, X, type LucideIcon } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { share as shareOut } from '../lib/native'
import { DEFI, TICKET, defiSharing, useShare, type Sharing } from '../lib/share'
import type { BetView, Chat, LotoTicket } from '../lib/types'
import { pickLabel } from '../screens/BetApp'
import type { DefiKind } from './Defi'
import { IconTile } from './ui'

// What the chats draw as a card instead of words (lib/share.ts): a ticket someone shared (the bet
// as it stands, its matches ticked as they end; a Loto ticket and its draw), with « Jouer le
// même » for a bet; a défi's score to beat, with « Relever le défi ». And the sheet that sends one:
// to a friend in Gbairai, to everyone in the grin, or outside the game (a link).

const DEFI_NAMES: Record<DefiKind, { title: string; icon: LucideIcon; colors: [string, string] }> = {
  the: { title: 'Le thé du grin', icon: Coffee, colors: ['#ff9a3c', '#c8641e'] },
  ski: { title: 'Le slalom de Boulay', icon: Waves, colors: ['#3ba7ff', '#1c6fd6'] },
  courses: { title: 'La liste de courses', icon: ShoppingCart, colors: ['#00b86b', '#00894f'] },
  foot: { title: 'Le foot à la console', icon: Gamepad2, colors: ['#ff9a3c', '#e8590c'] },
  course: { title: 'La course à deux', icon: Car, colors: ['#4dabf7', '#1c7ed6'] },
  combat: { title: 'Le combat de rue', icon: Swords, colors: ['#ff6b6b', '#c92a2a'] },
  arcade: { title: 'Moustiques !', icon: Joystick, colors: ['#b197fc', '#7048e8'] },
  ecole: { title: 'La leçon du maître', icon: GraduationCap, colors: ['#4dabf7', '#1864ab'] },
}
const APPS: Record<string, string> = { bet225: 'Bet225', parisfoot: 'ParisFoot' }
const nf = (n: number) => n.toLocaleString('fr-FR')

/** Is this message a card (a ticket, a défi)? */
export const isCard = (body: string) => TICKET.test(body.trim()) || DEFI.test(body.trim())

/** What a card says in a list or a notification. */
export function cardPreview(body: string) {
  const d = DEFI.exec(body.trim())
  if (d) return `🏆 Défi : ${DEFI_NAMES[d[1] as DefiKind].title}, ${d[2]}/100`
  const t = TICKET.exec(body.trim())
  if (t) return t[1] === 'bet' ? '🎫 Un ticket de pari' : '🎫 Un ticket Loto Chance'
  return null
}

/** The card a message draws. */
export function SharedCard({ body, mine, from }: { body: string; mine: boolean; /** Who sent it (a défi: who to beat). */ from?: string }) {
  const d = DEFI.exec(body.trim())
  if (d) return <DefiCard kind={d[1] as DefiKind} score={Number(d[2])} mine={mine} from={from} />
  const t = TICKET.exec(body.trim())
  if (t) return <TicketCard kind={t[1]} ref_={t[2]} sig={t[3]} mine={mine} />
  return null
}

function DefiCard({ kind, score, mine, from }: { kind: DefiKind; score: number; mine: boolean; from?: string }) {
  const d = DEFI_NAMES[kind]
  const challengeWith = useShare((s) => s.challengeWith)
  return (
    <div className="w-[230px] overflow-hidden rounded-2xl bg-white shadow-[0_1px_0.5px_rgba(0,0,0,0.13)]">
      <div className="flex items-center gap-2.5 p-2.5" style={{ background: `linear-gradient(135deg, ${d.colors[0]}, ${d.colors[1]})` }}>
        <IconTile icon={d.icon} colors={['#ffffff33', '#ffffff22']} size={38} />
        <div className="min-w-0 leading-tight text-white">
          <div className="text-[10px] font-extrabold tracking-wide uppercase opacity-85">Défi</div>
          <div className="truncate font-display text-[15px] font-extrabold">{d.title}</div>
        </div>
      </div>
      <div className="px-3 pt-2 pb-3 text-center">
        <div className="font-display text-[34px] leading-none font-extrabold text-[var(--color-ink)]">
          {score}
          <span className="text-[14px] text-[var(--color-ink-soft)]">/100</span>
        </div>
        <p className="mt-1 text-[12.5px] leading-snug font-bold text-[var(--color-ink-soft)]">{mine ? 'Ton score : à battre !' : `${from ?? 'Ton ami·e'} te défie. Tu fais mieux ?`}</p>
        {!mine && (
          <button className="btn mt-2 !min-h-0 w-full !bg-[#ffc233] !py-2 !text-[13px] !text-[#16161c] shadow-[0_4px_0_#e09a00]" onClick={() => challengeWith({ kind, score, from: from ?? 'Ton ami·e' })}>
            <Trophy size={15} /> Relever le défi
          </button>
        )}
      </div>
    </div>
  )
}

function TicketCard({ kind, ref_, sig, mine }: { kind: string; ref_: string; sig: string; mine: boolean }) {
  const [t, setT] = useState<{ owner: string; bet?: BetView; loto?: LotoTicket } | null | 'gone'>(null)
  useEffect(() => {
    let live = true
    const load = () => api.sharedTicket(kind, ref_, sig).then((r) => live && setT(r), () => live && setT((x) => x ?? 'gone'))
    load()
    // While it's in play, the matches tick as they end.
    const i = setInterval(load, 20000)
    return () => {
      live = false
      clearInterval(i)
    }
  }, [kind, ref_, sig])
  if (t === 'gone') return <p className="px-2 py-1 text-[13px] font-bold text-[#667781] italic">Ce ticket n'existe plus.</p>
  if (!t) return <div className="h-[120px] w-[230px] animate-pulse rounded-2xl bg-white/80" />
  const status = t.bet?.status ?? t.loto?.status ?? 'open'
  const payout = t.bet?.payout ?? t.loto?.payout ?? 0
  return (
    <div className="w-[240px] rounded-2xl border-2 border-dashed border-[#c4b5fd] bg-white p-2.5 text-[var(--color-ink)]">
      <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-[#6b6390]">
        <Ticket size={13} />
        <span className="min-w-0 flex-1 truncate">
          {mine ? 'Mon ticket' : `Le ticket de ${t.owner}`} · {t.bet ? (APPS[t.bet.app] ?? t.bet.app) : 'Loto Chance'}
        </span>
      </div>
      {t.bet && (
        <ul className="mt-1.5 space-y-1 text-[12px] font-bold">
          {t.bet.legs.map((l) => (
            <li key={l.match} className="flex items-center gap-1.5">
              <span className="min-w-0 flex-1 truncate">{l.label}</span>
              <span className="shrink-0 rounded bg-[#ede9fe] px-1.5">{pickLabel(undefined, l.pick)}</span>
              {l.score && <span className="shrink-0 tabular-nums">{l.score.join(':')}</span>}
              {l.won === null ? <Clock3 size={13} className="shrink-0 text-[#a78bfa]" /> : l.won ? <Check size={13} className="shrink-0 text-[#16a34a]" /> : <X size={13} className="shrink-0 text-[#dc2626]" />}
            </li>
          ))}
        </ul>
      )}
      {t.loto && (
        <div className="mt-1.5">
          <div className="text-[12px] font-extrabold">{t.loto.name}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {t.loto.numbers.map((n) => (
              <span key={n} className={`grid h-7 w-7 place-items-center rounded-full text-[12px] font-extrabold ${t.loto!.drawn?.includes(n) ? 'bg-[#16a34a] text-white' : 'bg-[#ffd43b] text-[#16161c]'}`}>
                {n}
              </span>
            ))}
          </div>
          {t.loto.drawn && <div className="mt-1 text-[11px] font-bold text-[#6b6390]">Tirés : {t.loto.drawn.join(' · ')}</div>}
        </div>
      )}
      <div className="mt-2 flex items-end justify-between border-t border-dashed border-[#ddd6fe] pt-1.5 text-[11.5px] font-extrabold">
        <span>
          Mise {nf(t.bet?.stake ?? t.loto?.stake ?? 0)}
          {t.bet && ` · cote ${t.bet.odds.toFixed(2)}`}
        </span>
        <span className={`-rotate-6 rounded border-2 px-1.5 py-0.5 text-[10px] tracking-wider ${status === 'won' ? 'border-[#16a34a] text-[#16a34a]' : status === 'lost' ? 'border-[#dc2626] text-[#dc2626]' : 'border-[#7c3aed] text-[#7c3aed]'}`}>
          {status === 'won' ? `GAGNANT +${nf(payout)}` : status === 'lost' ? 'PERDANT' : 'EN JEU'}
        </span>
      </div>
      {!mine && t.bet && status === 'open' && <PlaySame bet={t.bet} />}
    </div>
  )
}

/** The same picks, with one's own stake (before the first kick-off: the server says if it's too late). */
function PlaySame({ bet }: { bet: BetView }) {
  const { simId, apply } = useShare()
  const [open, setOpen] = useState(false)
  const [said, setSaid] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const play = async (stake: number) => {
    if (!simId) return
    setBusy(true)
    try {
      const r = await api.placeBet(simId, bet.app, stake, bet.legs.map((l) => ({ match: l.match, pick: l.pick })))
      apply?.(r)
      setSaid(`C'est joué : ${nf(stake)} Djai sur le même ticket !`)
      setOpen(false)
    } catch (e) {
      setSaid(e instanceof ApiError ? e.message : 'Pas possible pour le moment.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="mt-2">
      {said && <p className="mb-1 text-[11.5px] leading-snug font-bold text-[#5b21b6]">{said}</p>}
      {open ? (
        <div className="grid grid-cols-4 gap-1">
          {[500, 1000, 2000, 5000].map((v) => (
            <button key={v} disabled={busy} className="rounded-lg bg-[#5b21b6] py-1.5 text-[11px] font-extrabold text-white disabled:opacity-50" onClick={() => void play(v)}>
              {nf(v)}
            </button>
          ))}
        </div>
      ) : (
        <button className="w-full rounded-lg bg-[#5b21b6] py-1.5 text-[12px] font-extrabold text-white" onClick={() => setOpen(true)}>
          Jouer le même ticket
        </button>
      )}
    </div>
  )
}

/** Where to send what's shared: a friend in Gbairai, everyone in the grin, or outside the game. */
export function ShareSheet({ sharing, onClose }: { sharing: Sharing; onClose: () => void }) {
  const simId = useShare((s) => s.simId)
  const [friends, setFriends] = useState<Chat[] | null>(null)
  const [said, setSaid] = useState<string | null>(null)
  useEffect(() => {
    if (simId)
      void api
        .chats(simId)
        .then((c) => setFriends(c.filter((x) => !x.blocked)))
        .catch(() => setFriends([]))
  }, [simId])
  const send = async (to: () => Promise<unknown>, done: string) => {
    try {
      await to()
      setSaid(done)
      setTimeout(onClose, 1100)
    } catch (e) {
      setSaid(e instanceof ApiError ? e.message : 'Pas envoyé. Réessaie.')
    }
  }
  const out = async () => {
    const l = sharing.link!
    if (await shareOut(l.text, l.url).catch(() => false)) return onClose()
    await navigator.clipboard?.writeText(`${l.text} ${l.url}`).catch(() => {})
    setSaid('Lien copié : colle-le où tu veux !')
  }
  return (
    <div className="absolute inset-0 z-[60] flex flex-col justify-end bg-[#0f1230]/55" onClick={onClose}>
      <div className="sheet animate-up max-h-[80%] overflow-y-auto rounded-t-[28px] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <IconTile icon={Send} colors={['#ffa040', '#ff6a00']} size={42} />
          <div className="min-w-0 flex-1 font-display text-[19px] font-extrabold">{sharing.title}</div>
          <button className="icon-btn bg-[var(--color-canvas)]" onClick={onClose} aria-label="Fermer">
            <X size={20} />
          </button>
        </div>
        {said && <p className="mt-3 rounded-xl bg-[#e6fcf5] px-3 py-2 text-[13px] font-extrabold text-[#087f5b]">{said}</p>}
        <div className="label mt-4">Dans le grin</div>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          {(['babi', 'commune'] as const).map((room) => (
            <button key={room} className="btn btn-soft !min-h-0 !py-2.5 !text-[13px]" onClick={() => void send(() => api.sayGrin(simId!, room, sharing.body), 'Envoyé dans le grin !')}>
              <Users size={15} /> {room === 'babi' ? 'Tout Babi' : 'Ma commune'}
            </button>
          ))}
        </div>
        <div className="label mt-4">À un·e ami·e (Gbairai)</div>
        <ul className="mt-1.5 space-y-1.5">
          {friends === null && <li className="h-10 animate-pulse rounded-xl bg-[var(--color-canvas)]" />}
          {friends?.length === 0 && <li className="text-[13px] font-bold text-[var(--color-ink-soft)]">Pas encore d'ami·e dans le jeu : fais connaissance dans la rue !</li>}
          {friends?.map((c) => (
            <li key={c.friend.id}>
              <button className="flex w-full items-center gap-2 rounded-xl bg-[var(--color-canvas)] px-3 py-2 text-left text-[14px] font-extrabold" onClick={() => void send(() => api.write(simId!, c.friend.id, sharing.body), `Envoyé à ${c.friend.firstName} !`)}>
                <span className="min-w-0 flex-1 truncate">{c.friend.firstName}</span>
                <Send size={15} className="text-[var(--color-orange)]" />
              </button>
            </li>
          ))}
        </ul>
        {sharing.link && (
          <button className="btn btn-emerald mt-4 w-full" onClick={() => void out()}>
            <Link2 size={17} /> WhatsApp, et ailleurs
          </button>
        )}
      </div>
    </div>
  )
}

/** « Défier quelqu'un » after a défi: its score to beat, to send. */
export function ChallengeButton({ kind, score, title }: { kind: DefiKind; score: number; title: string }) {
  const share = useShare((s) => s.share)
  return (
    <button className="btn btn-soft mt-2 w-full !py-2.5 !text-sm" onClick={() => share(defiSharing(kind, score, title))}>
      <Send size={15} /> Défier quelqu’un
    </button>
  )
}
