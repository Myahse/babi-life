import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { ArrowLeft, Ban, Check, CheckCheck, EllipsisVertical, Keyboard, Lock, Reply, Send, Smile, UserCheck, X } from 'lucide-react'
import type { Look, Quote, Sim } from '../lib/types'
import { Portrait } from '../avatar/portrait'
import { EmojiPanel, StickerView, stickerOf } from './Stickers'
import { SharedCard, cardPreview, isCard } from './SharedCard'

type Gender = Sim['gender']

// A conversation laid out the way everybody knows from their phone's
// messaging app: full screen, a coloured bar on top (back, photo, name, the
// menu), the patterned wallpaper, the days in little pills, bubbles with
// their tail (theirs white on the left, mine on the right), the time and the
// ticks in the corner of each bubble (blue once read), and at the bottom the
// round message box with the emoji inside and the round send button. Used by
// Gbairai's chats with a friend and by the grin's two group chats. A post of
// the game (Babi Direct, in « Tout Babi ») is a group message with its own
// round picture and colour, and the reactions under it. With the update
// « repondre-message », a message is answered by swiping it right, a long
// press, or « Répondre » (tap, or the arrow on hover): the reply quotes it,
// and a tap on the quote goes back to it.

export type ChatLine = {
  id: number
  mine: boolean
  body: string
  at: string
  /** Mine only: read by the other (blue ticks); undefined in a group. */
  readAt?: string | null
  /** In a group: who wrote it (a player's portrait, or an account's own picture and colour). */
  sender?: { key: string; name: string; sub?: string; look?: Look; gender?: Gender; friend?: boolean; avatar?: ReactNode; color?: string }
  /** Reactions under the message: how many of each, mine, and those one can give. */
  reactions?: { counts: Record<string, number>; mine: string; choices: string[] }
  /** The message it answers, and a short quote of it. */
  replyTo?: number
  quote?: Quote
}

export type ChatMenuItem = { label: string; onClick: () => void; danger?: boolean }

const HEADER = '#c2410c'
const MINE = '#ffe2c4'
const THEIRS = '#ffffff'
// The names in a group, each person always the same colour.
const NAME_COLORS = ['#c2410c', '#1971c2', '#2f9e44', '#9c36b5', '#e8590c', '#0c8599', '#d6336c', '#5f3dc4', '#a61e4d', '#087f5b']
// The wallpaper: little doodles, faint, over the warm beige.
const WALLPAPER = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120" fill="none" stroke="#d8cbb9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="20" r="7"/><path d="M60 12l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6-4.5-4 6-1z"/><path d="M98 18c-4-5-11-1-8 5l8 8 8-8c3-6-4-10-8-5z"/><path d="M14 64h16M22 56v16"/><rect x="52" y="54" width="18" height="14" rx="3"/><path d="M90 70c6-10 14-10 20 0"/><circle cx="20" cy="102" r="3"/><circle cx="32" cy="98" r="2"/><path d="M56 98q8-10 16 0t16 0"/><path d="M100 94l8 12h-16z"/></svg>`,
)}")`

/** A message of one to a few emoji alone: drawn big, as on the phone. */
export const bigEmoji = (body: string) => /^(\p{Extended_Pictographic}|\p{Regional_Indicator}|‍|️|\p{Emoji_Modifier}){1,8}$/u.test(body.trim()) && [...body.trim()].length <= 8
export const clock = (at: string) => new Date(at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
const dayOf = (at: string) => new Date(at).toDateString()
function dayLabel(at: string) {
  const d = new Date(at)
  const today = new Date()
  const yesterday = new Date(Date.now() - 86_400_000)
  if (d.toDateString() === today.toDateString()) return 'Aujourd’hui'
  if (d.toDateString() === yesterday.toDateString()) return 'Hier'
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}
function nameColor(key: string) {
  let h = 0
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return NAME_COLORS[h % NAME_COLORS.length]
}
/** What a quote says of a message: « Sticker », a card's line, or the text's first line. */
export function quoteText(body: string, kind?: Quote['kind']) {
  if (kind === 'photo') return 'Photo'
  const st = stickerOf(body)
  if (kind === 'sticker' || st) return st ? `Sticker ${st.emoji}` : 'Sticker'
  return cardPreview(body) ?? body.split('\n')[0]
}

/** The quoted message, in a bubble or above the box: the coloured bar, who wrote it, two lines. */
export function QuoteBlock({ q, color, onClick }: { q: Quote; color: string; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick} className="mb-1 flex w-full min-w-0 overflow-hidden rounded-md bg-black/[0.06] text-left">
      <span className="w-1 shrink-0" style={{ background: q.deleted ? '#8696a0' : color }} />
      <span className="min-w-0 flex-1 px-2 py-1">
        {q.deleted ? (
          <span className="flex items-center gap-1 text-[12.5px] font-semibold text-[#667781] italic">
            <Ban size={12} /> Message supprimé
          </span>
        ) : (
          <>
            <span className="block truncate text-[12.5px] font-extrabold" style={{ color }}>
              {q.mine ? 'Toi' : q.name}
            </span>
            <span className="line-clamp-2 text-[12.5px] leading-snug font-medium break-words text-[#54656f]">{quoteText(q.body, q.kind)}</span>
          </>
        )}
      </span>
    </button>
  )
}

/** A message's row: swiped right (touch) or held down, it's the one answered. */
function SwipeRow({ enabled, onReply, children, className, lit }: { enabled: boolean; onReply: () => void; children: ReactNode; className: string; lit: boolean }) {
  const [dx, setDx] = useState(0)
  const g = useRef<{ x: number; y: number; id: number; swiping: boolean; timer?: ReturnType<typeof setTimeout> } | null>(null)
  const held = useRef(false)
  const clear = () => {
    if (g.current?.timer) clearTimeout(g.current.timer)
  }
  const down = (e: ReactPointerEvent) => {
    if (!enabled || (e.pointerType === 'mouse' && e.button !== 0)) return
    held.current = false
    g.current = {
      x: e.clientX,
      y: e.clientY,
      id: e.pointerId,
      swiping: false,
      timer: setTimeout(() => {
        if (!g.current || g.current.swiping) return
        held.current = true
        navigator.vibrate?.(15)
        onReply()
      }, 450),
    }
  }
  const move = (e: ReactPointerEvent) => {
    const s = g.current
    if (!s || s.id !== e.pointerId) return
    const x = e.clientX - s.x
    const y = e.clientY - s.y
    if (!s.swiping && (Math.abs(x) > 8 || Math.abs(y) > 8)) {
      clear()
      // Up and down is scrolling; only a touch swipes.
      if (e.pointerType !== 'touch' || Math.abs(y) > Math.abs(x) || x < 0) {
        g.current = null
        return
      }
      s.swiping = true
    }
    if (s.swiping) setDx(Math.max(0, Math.min(80, x)))
  }
  const up = () => {
    clear()
    if (g.current?.swiping && dx >= 56) onReply()
    g.current = null
    setDx(0)
  }
  return (
    <div
      className={`relative -mx-3 px-3 transition-colors duration-500 ${enabled ? 'pointer-coarse:select-none' : ''} ${lit ? 'bg-[#c2410c]/15' : ''}`}
      style={enabled ? { touchAction: 'pan-y' } : undefined}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onClickCapture={(e) => {
        // A long press that answered isn't a tap too.
        if (held.current) e.stopPropagation()
        held.current = false
      }}
    >
      {dx > 0 && (
        <span className="absolute top-1/2 left-1 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#54656f] shadow-sm" style={{ opacity: Math.min(1, dx / 56) }}>
          <Reply size={17} />
        </span>
      )}
      <div className={className} style={dx ? { transform: `translateX(${dx}px)` } : { transition: 'transform 0.15s' }}>
        {children}
      </div>
    </div>
  )
}

/** The round photo in the bar or beside a group message. */
export function ChatAvatar({ look, gender, size = 40, children }: { look: Look; gender: Gender; size?: number; children?: ReactNode }) {
  return (
    <span className="relative block shrink-0 overflow-hidden rounded-full bg-[#e9e3da]" style={{ width: size, height: size }}>
      <Portrait look={look} gender={gender} framing="head" />
      {children}
    </span>
  )
}

export function ChatScreen({
  title,
  subtitle,
  avatar,
  onBack,
  menu,
  lines,
  notice,
  empty,
  placeholder,
  locked,
  onSend,
  onReport,
  onReact,
  note,
  below,
  typing,
  onTyping,
  canReply,
}: {
  title: string
  subtitle?: string
  avatar: ReactNode
  onBack: () => void
  menu?: ChatMenuItem[]
  lines: ChatLine[]
  /** The yellow note at the top of the conversation. */
  notice: string
  empty?: string
  placeholder: string
  /** Writing closed (blocked): the box says why. */
  locked?: string
  /** Send a message (an answer to `replyTo`); true when it went. */
  onSend: (body: string, replyTo?: ChatLine) => Promise<boolean>
  onReport?: (line: ChatLine) => void
  /** React to a line that takes reactions ("" takes mine back). */
  onReact?: (line: ChatLine, emoji: string) => void
  note?: string | null
  below?: ReactNode
  /** Who is writing back right now (« Kofi »): the header says so, and a bubble of dots waits at the bottom. */
  typing?: string
  /** The text in the box changed: whether there is something being written. */
  onTyping?: (writing: boolean) => void
  /** Messages can be answered one by one (the update « repondre-message »). */
  canReply?: boolean
}) {
  const [text, setText] = useState('')
  const [panel, setPanel] = useState<'emoji' | 'stickers' | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [picked, setPicked] = useState<number | null>(null)
  const [sending, setSending] = useState(false)
  const [replying, setReplying] = useState<ChatLine | null>(null)
  const [flash, setFlash] = useState<number | null>(null)
  const box = useRef<HTMLTextAreaElement>(null)
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [lines.length, !!typing])

  const send = async (body: string, sticker = false) => {
    if (!body.trim() || sending || locked) return
    setSending(true)
    try {
      if (await onSend(body.trim(), replying ?? undefined)) {
        setReplying(null)
        if (sticker) setPanel(null)
        else setText('')
      }
    } finally {
      setSending(false)
    }
  }

  const replyTo = (m: ChatLine) => {
    setPicked(null)
    setReplying(m)
    if (!locked) box.current?.focus()
  }
  // Who wrote a line, as a quote names them.
  const authorOf = (m: ChatLine) => (m.mine ? 'Toi' : (m.sender?.name ?? title))
  const colorOf = (m: { mine: boolean; sender?: ChatLine['sender'] }) => (m.mine ? HEADER : (m.sender?.color ?? (m.sender ? nameColor(m.sender.key) : '#1971c2')))
  // The quote's original: brought into view, lit up a moment.
  const goTo = (id: number) => {
    const el = document.getElementById(`chat-line-${id}`)
    if (!el) return
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    setFlash(id)
    setTimeout(() => setFlash((f) => (f === id ? null : f)), 1400)
  }

  return (
    <div className="fixed inset-0 z-[70] flex justify-center bg-black/60">
      <div className="flex h-full w-full max-w-[480px] flex-col" style={{ background: '#efe6da' }}>
        {/* The bar */}
        <div className="flex items-center gap-2 px-2 pt-[max(env(safe-area-inset-top),8px)] pb-2 text-white shadow-md" style={{ background: HEADER }}>
          <button className="grid h-10 w-9 place-items-center rounded-full active:bg-white/15" onClick={onBack} aria-label="Retour">
            <ArrowLeft size={22} strokeWidth={2.4} />
          </button>
          {avatar}
          <span className="min-w-0 flex-1 pl-1">
            <span className="block truncate text-[16px] leading-tight font-extrabold">{title}</span>
            {typing ? <span className="block truncate text-[12px] font-semibold opacity-85">écrit…</span> : subtitle && <span className="block truncate text-[12px] font-semibold opacity-85">{subtitle}</span>}
          </span>
          {menu && menu.length > 0 && (
            <span className="relative">
              <button className="grid h-10 w-10 place-items-center rounded-full active:bg-white/15" onClick={() => setMenuOpen((o) => !o)} aria-label="Menu">
                <EllipsisVertical size={22} />
              </button>
              {menuOpen && (
                <>
                  <button className="fixed inset-0 z-10 cursor-default" aria-label="Fermer le menu" onClick={() => setMenuOpen(false)} />
                  <div className="absolute top-11 right-0 z-20 min-w-[190px] overflow-hidden rounded-xl bg-white py-1 text-[15px] font-semibold text-[#1f2328] shadow-xl">
                    {menu.map((m) => (
                      <button key={m.label} className={`block w-full px-4 py-3 text-left active:bg-black/5 ${m.danger ? 'text-[#c92a2a]' : ''}`} onClick={() => (setMenuOpen(false), m.onClick())}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </span>
          )}
        </div>

        {/* The conversation */}
        <div className="flex-1 overflow-y-auto px-3 py-2" style={{ backgroundImage: WALLPAPER }} onClick={() => setPicked(null)}>
          <p className="mx-auto my-2 flex max-w-[330px] items-start gap-1.5 rounded-lg bg-[#fff3c4] px-3 py-2 text-center text-[12px] leading-snug font-semibold text-[#5c4a00] shadow-sm">
            <Lock size={12} className="mt-0.5 shrink-0" />
            <span>{notice}</span>
          </p>
          {lines.length === 0 && empty && <p className="mx-auto my-6 w-fit rounded-lg bg-white/85 px-3 py-1.5 text-center text-[13px] font-semibold text-[#54656f] shadow-sm">{empty}</p>}
          {lines.map((m, i) => {
            const prev = lines[i - 1]
            const newDay = !prev || dayOf(prev.at) !== dayOf(m.at)
            const first = newDay || !prev || prev.mine !== m.mine || prev.sender?.key !== m.sender?.key
            const st = stickerOf(m.body)
            const card = !st && isCard(m.body)
            const big = !st && !card && bigEmoji(m.body)
            const bare = !!st || big || card
            const group = !!m.sender && !m.mine
            const reportable = !!onReport && !m.mine && !m.reactions
            const replyable = !!canReply && !m.reactions && !locked
            const original = m.quote && m.replyTo !== undefined ? lines.find((l) => l.id === m.replyTo) : undefined
            const quote = m.quote && (
              <QuoteBlock q={m.quote} color={m.quote.deleted ? '#8696a0' : original ? colorOf(original) : m.quote.mine ? HEADER : '#1971c2'} onClick={m.quote.deleted || m.replyTo === undefined ? undefined : () => goTo(m.replyTo!)} />
            )
            const ticks = m.mine && m.readAt !== undefined ? (m.readAt ? <CheckCheck size={15} className="text-[#2b9ce8]" /> : <Check size={15} className="opacity-60" />) : null
            const stamp = (
              <span className="flex items-center gap-0.5 text-[11px] leading-none font-semibold text-[#667781]">
                {clock(m.at)}
                {ticks}
              </span>
            )
            return (
              <div key={m.id} id={`chat-line-${m.id}`}>
                {newDay && (
                  <div className="my-2 flex justify-center">
                    <span className="rounded-lg bg-white/90 px-2.5 py-1 text-[12px] font-semibold text-[#54656f] shadow-sm first-letter:uppercase">{dayLabel(m.at)}</span>
                  </div>
                )}
                <SwipeRow enabled={replyable} onReply={() => replyTo(m)} lit={flash === m.id} className={`group flex items-start gap-1.5 ${m.mine ? 'justify-end' : 'justify-start'} ${first ? 'mt-2' : 'mt-0.5'}`}>
                  {replyable && m.mine && (
                    <button className="hidden self-center rounded-full p-1 text-[#54656f] opacity-0 group-hover:opacity-100 pointer-fine:block" onClick={(e) => (e.stopPropagation(), replyTo(m))} aria-label="Répondre">
                      <Reply size={16} />
                    </button>
                  )}
                  {group && (first ? (m.sender!.avatar ?? (m.sender!.look && m.sender!.gender ? <ChatAvatar look={m.sender!.look} gender={m.sender!.gender} size={30} /> : <span className="w-[30px] shrink-0" />)) : <span className="w-[30px] shrink-0" />)}
                  <div className={`relative max-w-[78%] ${bare ? '' : 'rounded-lg px-2 pt-1.5 pb-1 shadow-[0_1px_0.5px_rgba(0,0,0,0.13)]'} ${!bare && first ? (m.mine ? 'rounded-tr-none' : 'rounded-tl-none') : ''}`} style={bare ? undefined : { background: m.mine ? MINE : THEIRS }} onClick={(e) => (e.stopPropagation(), (reportable || replyable) && setPicked((p) => (p === m.id ? null : m.id)))} onContextMenu={(e) => (e.preventDefault(), !replyable && reportable && setPicked(m.id))}>
                    {!bare && first && (
                      <svg viewBox="0 0 8 13" className={`absolute top-0 h-[13px] w-2 ${m.mine ? '-right-2' : '-left-2'}`} aria-hidden>
                        <path d={m.mine ? 'M0 0H8L0 13z' : 'M8 0H0L8 13z'} fill={m.mine ? MINE : THEIRS} />
                      </svg>
                    )}
                    {group && first && (
                      <div className="mb-0.5 flex items-center gap-1 text-[13px] font-extrabold" style={{ color: m.sender!.color ?? nameColor(m.sender!.key) }}>
                        {m.sender!.name}
                        {m.sender!.friend && <UserCheck size={12} aria-label="ami" />}
                        {m.sender!.sub && <span className="font-semibold text-[#8696a0]">· {m.sender!.sub}</span>}
                      </div>
                    )}
                    {quote && (bare ? <div className="rounded-lg bg-white/90 p-1 shadow-sm">{quote}</div> : quote)}
                    {card ? (
                      <div className={`flex flex-col gap-1 ${m.mine ? 'items-end' : 'items-start'}`}>
                        <SharedCard body={m.body} mine={m.mine} from={m.sender?.name ?? title} />
                        <span className="rounded-full bg-white/85 px-1.5 py-0.5 shadow-sm">{stamp}</span>
                      </div>
                    ) : st ? (
                      <div className="flex flex-col items-end gap-1">
                        <StickerView s={st} />
                        <span className="rounded-full bg-white/85 px-1.5 py-0.5 shadow-sm">{stamp}</span>
                      </div>
                    ) : big ? (
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[44px] leading-none">{m.body}</span>
                        <span className="rounded-full bg-white/85 px-1.5 py-0.5 shadow-sm">{stamp}</span>
                      </div>
                    ) : m.reactions ? (
                      <>
                        <p className="text-[14.5px] leading-[1.35] font-medium break-words whitespace-pre-wrap text-[#111b21]">{m.body}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          {m.reactions.choices.map((e) => {
                            const n = m.reactions!.counts[e] ?? 0
                            const on = m.reactions!.mine === e
                            return (
                              <button key={e} disabled={!onReact} onClick={(ev) => (ev.stopPropagation(), onReact?.(m, on ? '' : e))} className={`flex h-7 items-center gap-0.5 rounded-full px-2 text-[14px] leading-none ${on ? 'bg-[#ffe2c4] ring-1 ring-[#c2410c]' : 'bg-[#f0ebe4]'}`} aria-label={on ? `Retirer ${e}` : `Réagir ${e}`} aria-pressed={on}>
                                {e}
                                {n > 0 && <span className={`text-[12px] font-extrabold ${on ? 'text-[#c2410c]' : 'text-[#54656f]'}`}>{n}</span>}
                              </button>
                            )
                          })}
                          <span className="ml-auto pl-1">{stamp}</span>
                        </div>
                      </>
                    ) : (
                      <p className="text-[14.5px] leading-[1.35] font-medium break-words whitespace-pre-wrap text-[#111b21]">
                        {m.body}
                        {/* Room for the time, so the last line doesn't run under it */}
                        <span className={`inline-block ${ticks ? 'w-[62px]' : 'w-[42px]'}`} />
                        <span className="absolute right-2 bottom-1">{stamp}</span>
                      </p>
                    )}
                    {picked === m.id && (reportable || replyable) && (
                      <div className={`absolute top-full z-10 mt-1 flex overflow-hidden rounded-lg bg-white text-[13px] font-bold whitespace-nowrap shadow-lg ${m.mine ? 'right-0' : 'left-0'}`}>
                        {replyable && (
                          <button className="flex items-center gap-1 px-3 py-1.5 text-[#111b21] active:bg-black/5" onClick={(e) => (e.stopPropagation(), replyTo(m))}>
                            <Reply size={14} /> Répondre
                          </button>
                        )}
                        {reportable && onReport && (
                          <button className="px-3 py-1.5 text-[#c92a2a] active:bg-black/5" onClick={(e) => (e.stopPropagation(), setPicked(null), onReport(m))}>
                            Signaler ce message
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {replyable && !m.mine && (
                    <button className="hidden self-center rounded-full p-1 text-[#54656f] opacity-0 group-hover:opacity-100 pointer-fine:block" onClick={(e) => (e.stopPropagation(), replyTo(m))} aria-label="Répondre">
                      <Reply size={16} />
                    </button>
                  )}
                </SwipeRow>
              </div>
            )
          })}
          {typing && (
            <div className="motion-pop flex justify-start px-1" aria-live="polite">
              <div className="flex items-center gap-1 rounded-[10px] rounded-tl-none bg-white px-3.5 py-3 shadow-sm" aria-label={`${typing} écrit…`}>
                <span className="motion-typing" />
                <span className="motion-typing [animation-delay:0.15s]" />
                <span className="motion-typing [animation-delay:0.3s]" />
              </div>
            </div>
          )}
          <div ref={end} className="h-1" />
        </div>

        {/* The box */}
        <div className="bg-[#f0ebe4] px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom),8px)]">
          {note && <p className="mb-1.5 rounded-lg bg-[#fff3c4] px-3 py-2 text-xs font-bold text-[#5c4a00]">{note}</p>}
          {below}
          {replying && !locked && (
            <div className="motion-pop mb-1.5 flex items-start gap-1 rounded-xl bg-white p-1.5 shadow-sm">
              <div className="min-w-0 flex-1">
                <QuoteBlock q={{ name: authorOf(replying), body: replying.body, kind: 'text' }} color={colorOf(replying)} onClick={() => goTo(replying.id)} />
              </div>
              <button type="button" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#54656f] active:bg-black/5" onClick={() => setReplying(null)} aria-label="Ne pas répondre à ce message">
                <X size={18} />
              </button>
            </div>
          )}
          {panel && !locked && <EmojiPanel tab={panel} onTab={setPanel} onEmoji={(e) => setText((t) => (t + e).slice(0, 500))} onSticker={(s) => void send(`[sticker:${s.id}]`, true)} />}
          <form
            className="flex items-end gap-1.5"
            onSubmit={(e) => {
              e.preventDefault()
              void send(text)
            }}
          >
            <div className="flex min-h-[46px] flex-1 items-end rounded-[24px] bg-white pr-3 shadow-sm">
              <button type="button" disabled={!!locked} onClick={() => setPanel((p) => (p ? null : 'emoji'))} className="grid h-[46px] w-11 shrink-0 place-items-center text-[#54656f] disabled:opacity-40" aria-label={panel ? 'Clavier' : 'Emoji et stickers'}>
                {panel ? <Keyboard size={22} /> : <Smile size={23} />}
              </button>
              <textarea
                ref={box}
                value={text}
                onChange={(e) => (setText(e.target.value.slice(0, 500)), onTyping?.(!!e.target.value.trim()))}
                onFocus={() => setPanel(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void send(text)
                  }
                }}
                disabled={!!locked}
                rows={1}
                placeholder={locked ?? placeholder}
                className="max-h-28 min-h-[46px] flex-1 resize-none bg-transparent py-3 text-[15px] font-medium text-[#111b21] outline-none placeholder:text-[#8696a0]"
              />
            </div>
            <button type="submit" disabled={!!locked || sending || !text.trim()} className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full text-white shadow-sm disabled:opacity-50" style={{ background: HEADER }} aria-label="Envoyer">
              <Send size={20} strokeWidth={2.4} className="-mr-0.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
