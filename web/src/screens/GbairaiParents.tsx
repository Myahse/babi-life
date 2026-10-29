import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, CheckCheck } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import type { ChatMessage, ParentChat, Sim } from '../lib/types'
import { familyCast } from '../avatar/Family'
import { previewOf } from '../components/Stickers'
import { ChatAvatar, ChatScreen, clock } from '../components/ChatScreen'

/**
 * Papa and maman in a child's Gbairai (update « gbairai-parents », backend
 * sims/gbairaiparents.go): from 3, the two contacts at the top of the list,
 * dressed as the family can afford (avatar/Family). The child writes what it
 * wants, and they answer a few seconds later, as parents do.
 */
export function ParentChats({ sim }: { sim: Sim }) {
  const [chats, setChats] = useState<ParentChat[] | null>(null)
  const [open, setOpen] = useState<ParentChat | null>(null)
  const cast = useMemo(() => familyCast(sim.family || 'poignon', sim.look), [sim.family, sim.look])
  useEffect(() => {
    if (open) return
    let stop = false
    const load = () => api.parentChats(sim.id).then((c) => !stop && setChats(c), () => undefined)
    void load()
    const t = setInterval(load, 15_000)
    return () => {
      stop = true
      clearInterval(t)
    }
  }, [sim.id, open])
  if (!chats) return null
  const look = (c: ParentChat) => cast[c.who].look
  return (
    <>
      <ul>
        {chats.map((c) => (
          <li key={c.who}>
            <button className="flex w-full items-center gap-3 px-1 py-2 text-left active:bg-black/[0.04]" onClick={() => setOpen(c)}>
              <ChatAvatar look={look(c)} gender={c.gender} size={50} />
              <span className="min-w-0 flex-1 border-b border-black/[0.06] pb-2.5">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[16px] font-extrabold text-[#111b21]">{c.name}</span>
                  {c.last && <span className={`shrink-0 text-[12px] font-semibold ${c.unread > 0 ? 'text-[#c2410c]' : 'text-[#667781]'}`}>{clock(c.last.at)}</span>}
                </span>
                <span className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1 text-[14px] font-medium text-[#667781]">
                    {c.typing ? (
                      <span className="truncate font-bold text-[#2fb344]">en train d’écrire…</span>
                    ) : (
                      <>
                        {c.last?.mine && (c.last.readAt ? <CheckCheck size={16} className="shrink-0 text-[#2b9ce8]" /> : <Check size={16} className="shrink-0" />)}
                        <span className="truncate">{c.last ? previewOf(c.last.body) : c.who === 'papa' ? 'Écris à ton papa !' : 'Écris à ta maman !'}</span>
                      </>
                    )}
                  </span>
                  {c.unread > 0 && <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-[#c2410c] px-1.5 text-[11px] font-extrabold text-white">{c.unread}</span>}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {open && <ParentThread sim={sim} chat={open} look={look(open)} onBack={() => setOpen(null)} />}
    </>
  )
}

function ParentThread({ sim, chat, look, onBack }: { sim: Sim; chat: ParentChat; look: ReturnType<typeof familyCast>['papa']['look']; onBack: () => void }) {
  const [msgs, setMsgs] = useState<ChatMessage[]>([])
  const [typing, setTyping] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const last = useRef(0)
  // The thread, then what's new: every 4 s, every second and a half while they're writing back.
  useEffect(() => {
    let stop = false
    let t: ReturnType<typeof setTimeout>
    const poll = () =>
      api
        .parentThread(sim.id, chat.who, last.current)
        .then((r) => {
          if (stop) return
          setTyping(r.typing)
          if (r.messages.length) last.current = r.messages[r.messages.length - 1].id
          // Their answer: our messages before it are read.
          const answer = r.messages.filter((m) => !m.mine).at(-1)
          setMsgs((old) => [...old.map((o) => (answer && o.mine && !o.readAt && o.id < answer.id ? { ...o, readAt: answer.at } : o)), ...r.messages.filter((x) => !old.some((o) => o.id === x.id))])
          t = setTimeout(poll, r.typing ? 1500 : 4000)
        })
        .catch(() => !stop && (t = setTimeout(poll, 4000)))
    void poll()
    return () => {
      stop = true
      clearTimeout(t)
    }
  }, [sim.id, chat.who])
  const send = async (body: string) => {
    try {
      const m = await api.parentWrite(sim.id, chat.who, body)
      setMsgs((old) => [...old, m])
      setTyping(true)
      setNote(null)
      return true
    } catch (e) {
      setNote(e instanceof ApiError ? e.message : 'Pas de réseau, réessaie.')
      return false
    }
  }

  return (
    <ChatScreen
      title={chat.name}
      subtitle={typing ? undefined : chat.who === 'papa' ? 'ton papa' : 'ta maman'}
      avatar={<ChatAvatar look={look} gender={chat.gender} size={40} />}
      onBack={onBack}
      lines={msgs.map((m) => ({ ...m, readAt: m.mine ? (m.readAt ?? null) : undefined }))}
      notice={`Écris à ${chat.who === 'papa' ? 'ton papa' : 'ta maman'} ce que tu veux : ${chat.who === 'papa' ? 'il' : 'elle'} te répond. Ne donne jamais ton adresse, ton numéro ni ton mot de passe, à personne.`}
      empty={`Dis bonjour à ${chat.who === 'papa' ? 'ton papa' : 'ta maman'} !`}
      placeholder="Message"
      onSend={send}
      typing={typing ? chat.name : undefined}
      note={note}
    />
  )
}
