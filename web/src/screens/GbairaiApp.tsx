import { useEffect, useRef, useState } from 'react'
import { Check, CheckCheck } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import type { Chat, ChatMessage, Sim, World } from '../lib/types'
import { ReportSheet } from '../components/Social'
import { Stories } from './Stories'
import { Grin } from './Grin'
import { NotifyBanner } from '../components/NotifyPrompt'
import { previewOf } from '../components/Stickers'
import { ChatAvatar, ChatScreen, clock, type ChatLine } from '../components/ChatScreen'
import { keyOpen, useFeatures } from '../lib/features'
import { ParentChats } from './GbairaiParents'

/**
 * Gbairai: write to the players your Sim has made friends with in the game,
 * and only to them (backend sims/gbairai.go). Links and phone numbers are
 * masked; a friend can be blocked, a message reported. The chat asks for new
 * messages every few seconds while it is open, the list every half-minute.
 * Laid out like the messaging app everybody has on their phone: the list of
 * chats, and each chat full screen (components/ChatScreen).
 */

/**
 * Gbairai: the friends' chats, and the grin (the public chat). A child has papa and maman at the
 * top (update « gbairai-parents »); before its phone, without « gbairai-bebe », only them.
 */
export function GbairaiApp({ world, sim, parents, friends = true }: { world: World; sim: Sim; parents?: boolean; friends?: boolean }) {
  const [tab, setTab] = useState<'amis' | 'grin'>('amis')
  if (!friends)
    return (
      <div className="flex h-full flex-col">
        <p className="mb-1 px-1 text-[13px] font-bold text-[var(--color-ink-soft)]">Tes contacts : papa et maman. Tes amis viendront avec ton téléphone, à 12 ans.</p>
        {parents && <ParentChats sim={sim} />}
      </div>
    )
  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex gap-1 border-b border-black/5">
        {(
          [
            ['amis', 'Discussions'],
            ['grin', 'Le grin'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`flex-1 border-b-[3px] py-2.5 text-[15px] font-extrabold ${tab === id ? 'border-[#c2410c] text-[#c2410c]' : 'border-transparent text-[var(--color-ink-soft)]'}`}>
            {label}
          </button>
        ))}
      </div>
      <NotifyBanner what="quand un ami t’écrit" />
      {tab === 'grin' ? <Grin world={world} sim={sim} /> : <Chats world={world} sim={sim} parents={parents} />}
    </div>
  )
}

function Chats({ world, sim, parents }: { world: World; sim: Sim; parents?: boolean }) {
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

  return (
    <div>
      <Stories sim={sim} realPhotos={!!world.config.realPhotos} />
      {error && <p className="rounded-2xl bg-[#ffe3e3] p-3 text-sm font-bold text-[#c92a2a]">{error}</p>}
      {chats === null && !error && <p className="p-3 text-sm font-bold text-[var(--color-ink-soft)]">Chargement…</p>}
      {parents && <ParentChats sim={sim} />}
      {chats?.length === 0 && <p className="p-3 text-sm font-bold text-[var(--color-ink-soft)]">Pas encore d'amis à qui écrire. Va saluer les joueurs de ta commune : ils apparaîtront ici.</p>}
      <ul>
        {chats?.map((c) => (
          <li key={c.friend.id}>
            <button className="flex w-full items-center gap-3 px-1 py-2 text-left active:bg-black/[0.04]" onClick={() => setOpen(c)}>
              <ChatAvatar look={c.friend.look} gender={c.friend.gender} size={50}>
                {c.friend.online && <span className="absolute right-0.5 bottom-0.5 h-3 w-3 rounded-full bg-[#2fb344] ring-2 ring-white" />}
              </ChatAvatar>
              <span className="min-w-0 flex-1 border-b border-black/[0.06] pb-2.5">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[16px] font-extrabold text-[#111b21]">{c.friend.firstName}</span>
                  {c.last && <span className={`shrink-0 text-[12px] font-semibold ${c.unread > 0 ? 'text-[#c2410c]' : 'text-[#667781]'}`}>{stamp(c.last.at)}</span>}
                </span>
                <span className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1 text-[14px] font-medium text-[#667781]">
                    {c.last?.mine && !c.blocked && (c.last.readAt ? <CheckCheck size={16} className="shrink-0 text-[#2b9ce8]" /> : <Check size={16} className="shrink-0" />)}
                    <span className="truncate">{c.blocked ? 'Bloqué·e' : c.last ? previewOf(c.last.body) : 'Dis-lui bonjour !'}</span>
                  </span>
                  {c.unread > 0 && <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-[#c2410c] px-1.5 text-[11px] font-extrabold text-white">{c.unread}</span>}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {open && <Thread sim={sim} chat={open} onBack={() => setOpen(null)} />}
    </div>
  )
}

function Thread({ sim, chat, onBack }: { sim: Sim; chat: Chat; onBack: () => void }) {
  const [msgs, setMsgs] = useState<ChatMessage[]>([])
  const [blocked, setBlocked] = useState(!!chat.blocked)
  const [note, setNote] = useState<string | null>(null)
  const [reporting, setReporting] = useState<ChatMessage | 'friend' | null>(null)
  const last = useRef(0)
  const feats = useFeatures()

  // The thread, then the new ones every 4 s.
  useEffect(() => {
    let stop = false
    const poll = () =>
      api
        .thread(sim.id, chat.friend.id, last.current)
        .then((m) => {
          if (stop || !m.length) return
          last.current = m[m.length - 1].id
          setMsgs((old) => [...old.map((o) => m.find((x) => x.id === o.id) ?? o), ...m.filter((x) => !old.some((o) => o.id === x.id))])
        })
        .catch(() => undefined)
    void poll()
    const t = setInterval(poll, 4000)
    return () => {
      stop = true
      clearInterval(t)
    }
  }, [sim.id, chat.friend.id])

  // « … écrit » both ways: every 2 s, say whether a message is being written (a key pressed in
  // the last 4 s, something in the box) and hear whether the friend is.
  const [friendTyping, setFriendTyping] = useState(false)
  const typed = useRef({ at: 0, text: false })
  useEffect(() => {
    let stop = false
    const tell = () => {
      const now = typed.current.text && Date.now() - typed.current.at < 4000
      api.typing(sim.id, chat.friend.id, now).then((r) => !stop && setFriendTyping(r.typing), () => undefined)
    }
    const t = setInterval(tell, 2000)
    return () => {
      stop = true
      clearInterval(t)
    }
  }, [sim.id, chat.friend.id])
  // A message from the friend has come: they've stopped writing it.
  const lastFromFriend = msgs.filter((m) => !m.mine).at(-1)?.id
  useEffect(() => setFriendTyping(false), [lastFromFriend])

  const send = async (body: string, replyTo?: ChatLine) => {
    typed.current = { at: 0, text: false }
    try {
      const m = await api.write(sim.id, chat.friend.id, body, replyTo?.id)
      last.current = Math.max(last.current, m.id)
      setMsgs((old) => [...old, m])
      setNote(null)
      return true
    } catch (e) {
      setNote(e instanceof ApiError ? e.message : 'Pas de réseau, réessaie.')
      return false
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
    <ChatScreen
      title={chat.friend.firstName}
      subtitle={blocked ? 'Bloqué·e' : chat.friend.online ? 'en ligne' : 'hors ligne'}
      avatar={<ChatAvatar look={chat.friend.look} gender={chat.friend.gender} size={40} />}
      onBack={onBack}
      menu={[
        { label: blocked ? 'Débloquer' : 'Bloquer', onClick: () => void toggleBlock(), danger: !blocked },
        { label: `Signaler ${chat.friend.firstName}`, onClick: () => setReporting('friend'), danger: true },
      ]}
      lines={msgs.map((m) => ({ ...m, readAt: m.mine ? (m.readAt ?? null) : undefined }))}
      notice="Tu écris seulement à tes amis du jeu. Les liens et les numéros sont masqués. Un souci ? Touche le message pour le signaler."
      empty={`Écris le premier message à ${chat.friend.firstName}.`}
      placeholder="Message"
      locked={blocked ? 'Bloqué·e' : undefined}
      onSend={send}
      canReply={keyOpen(feats, 'repondre-message')}
      typing={friendTyping && !blocked ? chat.friend.firstName : undefined}
      onTyping={(text) => (typed.current = { at: Date.now(), text })}
      onReport={(m) => setReporting(msgs.find((x) => x.id === m.id) ?? null)}
      note={note}
      below={
        reporting && (
          <div className="mb-2">
            <ReportSheet title={reporting === 'friend' ? `Signaler ${chat.friend.firstName}` : 'Signaler ce message'} onPick={(r) => void report(r)} onCancel={() => setReporting(null)} note="La personne est bloquée tout de suite ; l'équipe regarde le signalement." />
          </div>
        )
      }
    />
  )
}

function stamp(at: string) {
  const d = new Date(at)
  if (d.toDateString() === new Date().toDateString()) return clock(at)
  if (d.toDateString() === new Date(Date.now() - 86_400_000).toDateString()) return 'Hier'
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
