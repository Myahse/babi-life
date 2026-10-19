import { useEffect, useRef, useState } from 'react'
import { Ban, ChevronLeft, Flag, Send, ShieldCheck } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import type { Chat, ChatMessage, Sim, World } from '../lib/types'
import { Portrait } from '../avatar/portrait'
import { ReportSheet } from '../components/Social'
import { Stories } from './Stories'
import { Grin } from './Grin'
import { NotifyBanner } from '../components/NotifyPrompt'

/**
 * Gbairai: write to the players your Sim has made friends with in the game,
 * and only to them (backend sims/gbairai.go). Links and phone numbers are
 * masked; a friend can be blocked, a message reported. The chat asks for new
 * messages every few seconds while it is open, the list every half-minute.
 */

/** Gbairai: the friends' chats, and the grin (the public chat). */
export function GbairaiApp({ world, sim }: { world: World; sim: Sim }) {
  const [tab, setTab] = useState<'amis' | 'grin'>('amis')
  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex gap-1 border-b border-black/5">
        {(
          [
            ['amis', 'Discussions'],
            ['grin', 'Le grin'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`flex-1 border-b-2 py-2 text-sm font-extrabold ${tab === id ? 'border-[#f0590c] text-[#f0590c]' : 'border-transparent text-[var(--color-ink-soft)]'}`}>
            {label}
          </button>
        ))}
      </div>
      <NotifyBanner what="quand un ami t’écrit" />
      {tab === 'grin' ? <Grin world={world} sim={sim} /> : <Chats world={world} sim={sim} />}
    </div>
  )
}

function Chats({ world, sim }: { world: World; sim: Sim }) {
  const [chats, setChats] = useState<Chat[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<Chat | null>(null)
  useEffect(() => {
    if (open) return
    let stop = false
    const load = () =>
      api
        .chats(sim.id)
        .then((c) => !stop && (setChats(c), setError(null)))
        .catch((e) => !stop && setError(e instanceof ApiError ? e.message : 'Pas de réseau'))
    void load()
    const t = setInterval(load, 30_000)
    return () => {
      stop = true
      clearInterval(t)
    }
  }, [sim.id, open])

  if (open) return <Thread sim={sim} chat={open} onBack={() => setOpen(null)} />
  return (
    <div className="space-y-2">
      <Stories sim={sim} realPhotos={!!world.config.realPhotos} />
      <p className="flex items-start gap-2 rounded-2xl bg-[#fff4e8] p-3 text-xs leading-snug font-bold text-[var(--color-ink-soft)]">
        <ShieldCheck size={16} className="mt-0.5 shrink-0 text-[#f0590c]" />
        Tu écris seulement aux joueurs devenus tes amis dans le jeu (salue-les dans la rue). Les liens et les numéros sont masqués. Un souci ? Signale le message.
      </p>
      {error && <p className="rounded-2xl bg-[#ffe3e3] p-3 text-sm font-bold text-[#c92a2a]">{error}</p>}
      {chats === null && !error && <p className="p-3 text-sm font-bold text-[var(--color-ink-soft)]">Chargement…</p>}
      {chats?.length === 0 && <p className="p-3 text-sm font-bold text-[var(--color-ink-soft)]">Pas encore d'amis à qui écrire. Va saluer les joueurs de ta commune : ils apparaîtront ici.</p>}
      <ul className="space-y-1.5">
        {chats?.map((c) => (
          <li key={c.friend.id}>
            <button className="flex w-full items-center gap-3 rounded-2xl bg-[var(--color-canvas)] p-2.5 text-left active:scale-[0.98]" onClick={() => setOpen(c)}>
              <span className="relative block h-12 w-12 shrink-0 overflow-hidden rounded-full bg-white">
                <Portrait look={c.friend.look} gender={c.friend.gender} framing="head" />
                {c.friend.online && <span className="absolute right-0.5 bottom-0.5 h-3 w-3 rounded-full bg-[#2fb344] ring-2 ring-white" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-display text-[15px] font-extrabold">{c.friend.firstName}</span>
                  {c.last && <span className="shrink-0 text-[11px] font-bold text-[var(--color-ink-soft)]">{stamp(c.last.at)}</span>}
                </span>
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-bold text-[var(--color-ink-soft)]">{c.blocked ? 'Bloqué·e' : c.last ? `${c.last.mine ? 'Toi : ' : ''}${c.last.body}` : 'Dis-lui bonjour !'}</span>
                  {c.unread > 0 && <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-[#f0590c] px-1.5 text-[11px] font-extrabold text-white">{c.unread}</span>}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Thread({ sim, chat, onBack }: { sim: Sim; chat: Chat; onBack: () => void }) {
  const [msgs, setMsgs] = useState<ChatMessage[]>([])
  const [text, setText] = useState('')
  const [blocked, setBlocked] = useState(!!chat.blocked)
  const [note, setNote] = useState<string | null>(null)
  const [reporting, setReporting] = useState<ChatMessage | 'friend' | null>(null)
  const [sending, setSending] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  const last = useRef(0)

  // The thread, then the new ones every 4 s.
  useEffect(() => {
    let stop = false
    const poll = () =>
      api
        .thread(sim.id, chat.friend.id, last.current)
        .then((m) => {
          if (stop || !m.length) return
          last.current = m[m.length - 1].id
          setMsgs((old) => [...old, ...m.filter((x) => !old.some((o) => o.id === x.id))])
        })
        .catch(() => undefined)
    void poll()
    const t = setInterval(poll, 4000)
    return () => {
      stop = true
      clearInterval(t)
    }
  }, [sim.id, chat.friend.id])
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [msgs.length])

  const send = async () => {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    try {
      const m = await api.write(sim.id, chat.friend.id, body)
      setText('')
      last.current = Math.max(last.current, m.id)
      setMsgs((old) => [...old, m])
      setNote(null)
    } catch (e) {
      setNote(e instanceof ApiError ? e.message : 'Pas de réseau, réessaie.')
    } finally {
      setSending(false)
    }
  }
  const toggleBlock = async () => {
    try {
      const r = await api.block(sim.id, chat.friend.id, !blocked)
      setBlocked(r.blocked)
      setNote(r.blocked ? `${chat.friend.firstName} est bloqué·e : vous ne pouvez plus vous écrire.` : `${chat.friend.firstName} est débloqué·e.`)
    } catch (e) {
      setNote(e instanceof ApiError ? e.message : 'Pas de réseau, réessaie.')
    }
  }
  const report = async (reason: string) => {
    const target = reporting
    setReporting(null)
    try {
      const r = await api.report(sim.id, chat.friend.id, reason, target && target !== 'friend' ? target.id : undefined)
      setBlocked(true)
      setNote(r.text)
    } catch (e) {
      setNote(e instanceof ApiError ? e.message : 'Pas de réseau, réessaie.')
    }
  }

  return (
    <div className="flex h-full min-h-[420px] flex-col">
      <div className="flex items-center gap-2 border-b border-black/5 pb-2">
        <button className="icon-btn bg-[var(--color-canvas)]" onClick={onBack} aria-label="Retour aux discussions">
          <ChevronLeft size={20} strokeWidth={2.6} />
        </button>
        <span className="block h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[var(--color-canvas)]">
          <Portrait look={chat.friend.look} gender={chat.friend.gender} framing="head" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-[15px] font-extrabold">{chat.friend.firstName}</span>
          <span className="block text-[11px] font-bold text-[var(--color-ink-soft)]">{chat.friend.online ? 'En ligne' : 'Hors ligne'}</span>
        </span>
        <button className="icon-btn bg-[var(--color-canvas)]" onClick={() => setReporting('friend')} aria-label="Signaler">
          <Flag size={18} />
        </button>
        <button className={`icon-btn ${blocked ? 'bg-[#ffe3e3] text-[#c92a2a]' : 'bg-[var(--color-canvas)]'}`} onClick={() => void toggleBlock()} aria-label={blocked ? 'Débloquer' : 'Bloquer'}>
          <Ban size={18} />
        </button>
      </div>

      <div className="flex-1 space-y-1.5 overflow-y-auto py-3">
        {msgs.length === 0 && <p className="py-6 text-center text-sm font-bold text-[var(--color-ink-soft)]">Écris le premier message à {chat.friend.firstName}.</p>}
        {msgs.map((m) => (
          <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
            <div className={`group relative max-w-[80%] rounded-2xl px-3 py-2 text-[14px] leading-snug font-bold whitespace-pre-wrap ${m.mine ? 'rounded-br-sm bg-[#ffe0c7] text-[#4a2200]' : 'rounded-bl-sm bg-[var(--color-canvas)]'}`}>
              {m.body}
              <span className="mt-0.5 flex items-center justify-end gap-2 text-[10px] font-bold opacity-60">
                {!m.mine && (
                  <button className="underline" onClick={() => setReporting(m)}>
                    signaler
                  </button>
                )}
                {time(m.at)}
                {m.mine && (m.readAt ? ' · lu' : '')}
              </span>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>

      {note && <p className="mb-2 rounded-xl bg-[#fff4e8] px-3 py-2 text-xs font-bold text-[#7a3a00]">{note}</p>}
      {reporting && (
        <div className="mb-2">
          <ReportSheet title={reporting === 'friend' ? `Signaler ${chat.friend.firstName}` : 'Signaler ce message'} onPick={(r) => void report(r)} onCancel={() => setReporting(null)} note="La personne est bloquée tout de suite ; l'équipe regarde le signalement." />
        </div>
      )}
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void send()
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 500))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send()
            }
          }}
          disabled={blocked}
          rows={1}
          placeholder={blocked ? 'Bloqué·e' : 'Écris un message…'}
          className="field max-h-28 min-h-[44px] flex-1 resize-none !rounded-2xl !py-2.5"
        />
        <button type="submit" disabled={blocked || sending || !text.trim()} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#f0590c] text-white disabled:opacity-40" aria-label="Envoyer">
          <Send size={18} strokeWidth={2.6} />
        </button>
      </form>
    </div>
  )
}

const time = (at: string) => new Date(at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
function stamp(at: string) {
  const d = new Date(at)
  return Date.now() - d.getTime() < 20 * 3600_000 ? time(at) : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
