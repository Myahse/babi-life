import { useEffect, useRef, useState, type ReactNode } from 'react'
import { MapPin, Radio, Users } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import type { DirectPost, GrinMessage, Sim, World } from '../lib/types'
import { ReportSheet } from '../components/Social'
import { ChatScreen, type ChatLine } from '../components/ChatScreen'
import { aCommune, deNom } from '../lib/french'

/**
 * Le grin, in Gbairai (backend sims/grin.go): the public chat, where people
 * sit and talk, like round the teapot. Two group chats: « Tout Babi » for
 * everyone, « Ma commune » for those of the commune the Sim is in, each
 * opened full screen like a group on the phone (the names in colour). New
 * messages every 4 s while it's open. Links and numbers are masked; a
 * message can be reported. In « Tout Babi », Babi Direct (backend
 * sims/babidirect.go) tells what happens in the game, between the players'
 * messages: the communes' happenings, the stadiums, Bet225's results, the
 * players' big moments. Everyone can react to its posts.
 */

// Babi Direct: the game's own account, its picture and colour.
const DIRECT_COLOR = '#0c8599'
const DIRECT_AVATAR = (
  <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full text-white" style={{ background: DIRECT_COLOR }}>
    <Radio size={17} strokeWidth={2.4} />
  </span>
)

export function Grin({ world, sim }: { world: World; sim: Sim }) {
  const [room, setRoom] = useState<'babi' | 'commune' | null>(null)
  const communeName = (id: string) => world.cities.flatMap((c) => c.communes).find((c) => c.id === id)?.name ?? id
  const rooms = [
    { id: 'babi' as const, name: 'Tout Babi', sub: 'Tous les joueurs, et Babi Direct : ce qui se passe dans le jeu', icon: <Users size={24} />, bg: '#c2410c' },
    { id: 'commune' as const, name: `Ma commune · ${communeName(sim.commune)}`, sub: `Ceux qui sont ${aCommune(communeName(sim.commune))}`, icon: <MapPin size={24} />, bg: '#2f9e44' },
  ]
  return (
    <div>
      <ul>
        {rooms.map((r) => (
          <li key={r.id}>
            <button className="flex w-full items-center gap-3 px-1 py-2 text-left active:bg-black/[0.04]" onClick={() => setRoom(r.id)}>
              <span className="grid h-[50px] w-[50px] shrink-0 place-items-center rounded-full text-white" style={{ background: r.bg }}>
                {r.icon}
              </span>
              <span className="min-w-0 flex-1 border-b border-black/[0.06] pb-2.5">
                <span className="block truncate text-[16px] font-extrabold text-[#111b21]">{r.name}</span>
                <span className="mt-0.5 block truncate text-[14px] font-medium text-[#667781]">{r.sub}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-center text-[12px] font-semibold text-[var(--color-ink-soft)]">Public : tout le monde peut lire. Liens et numéros masqués.</p>
      {room && <Room sim={sim} room={room} title={rooms.find((r) => r.id === room)!.name} icon={rooms.find((r) => r.id === room)!} communeName={communeName} onBack={() => setRoom(null)} />}
    </div>
  )
}

function Room({ sim, room, title, icon, communeName, onBack }: { sim: Sim; room: 'babi' | 'commune'; title: string; icon: { icon: ReactNode; bg: string }; communeName: (id: string) => string; onBack: () => void }) {
  const [msgs, setMsgs] = useState<GrinMessage[]>([])
  const [posts, setPosts] = useState<DirectPost[]>([])
  const [choices, setChoices] = useState<string[]>([])
  const [note, setNote] = useState<string | null>(null)
  const [reporting, setReporting] = useState<GrinMessage | null>(null)
  const last = useRef(0)
  const lastPost = useRef(0)

  useEffect(() => {
    let stop = false
    last.current = 0
    const poll = () =>
      api
        .grin(sim.id, room, last.current)
        .then((r) => {
          if (stop || !r.messages.length) return
          last.current = r.messages[r.messages.length - 1].id
          setMsgs((old) => [...old, ...r.messages.filter((m) => !old.some((o) => o.id === m.id))].slice(-200))
        })
        .catch((e) => !stop && setNote(e instanceof ApiError ? e.message : 'Pas de réseau'))
    void poll()
    const t = setInterval(poll, 4000)
    return () => {
      stop = true
      clearInterval(t)
    }
  }, [sim.id, room])

  // Babi Direct, in « Tout Babi » only: the new posts every 4 s, all of them
  // again every half-minute or so (the reactions move).
  useEffect(() => {
    let stop = false
    let tick = 0
    lastPost.current = 0
    setPosts([])
    const poll = () => {
      const after = tick++ % 8 === 0 ? 0 : lastPost.current
      return api
        .direct(sim.id, after)
        .then((r) => {
          if (stop) return
          setChoices(r.reactions)
          if (!r.posts.length) return
          lastPost.current = Math.max(lastPost.current, ...r.posts.map((p) => p.id))
          setPosts((old) => [...old.map((o) => r.posts.find((p) => p.id === o.id) ?? o), ...r.posts.filter((p) => !old.some((o) => o.id === p.id))].slice(-100))
        })
        .catch(() => undefined)
    }
    const t = room === 'babi' ? setInterval(poll, 4000) : undefined
    if (room === 'babi') void poll()
    return () => {
      stop = true
      clearInterval(t)
    }
  }, [sim.id, room])

  const send = async (body: string) => {
    try {
      const r = await api.sayGrin(sim.id, room, body)
      setNote(null)
      last.current = Math.max(last.current, r.id)
      setMsgs((old) => [...old, { id: r.id, sim: sim.id, firstName: sim.firstName, gender: sim.gender, look: sim.look, commune: sim.commune, mine: true, friend: false, body: r.body, at: new Date().toISOString() }])
      return true
    } catch (e) {
      setNote(e instanceof ApiError ? e.message : 'Pas de réseau, réessaie.')
      return false
    }
  }

  // A reaction shows at once; the server's count follows.
  const react = (line: ChatLine, emoji: string) => {
    const id = -line.id
    const bump = (p: DirectPost): DirectPost => {
      const counts = { ...p.reactions }
      if (p.mine) counts[p.mine] = Math.max(0, (counts[p.mine] ?? 1) - 1)
      if (emoji) counts[emoji] = (counts[emoji] ?? 0) + 1
      return { ...p, reactions: counts, mine: emoji }
    }
    setPosts((old) => old.map((p) => (p.id === id ? bump(p) : p)))
    api
      .reactDirect(sim.id, id, emoji)
      .then((r) => setPosts((old) => old.map((p) => (p.id === id ? { ...p, reactions: r.reactions, mine: r.mine } : p))))
      .catch((e) => setNote(e instanceof ApiError ? e.message : 'Pas de réseau, réessaie.'))
  }

  const people = new Set(msgs.filter((m) => !m.mine).map((m) => m.firstName))
  const lines: ChatLine[] = [
    ...msgs.map((m) => ({ id: m.id, mine: m.mine, body: m.body, at: m.at, sender: { key: m.sim, name: m.firstName, sub: communeName(m.commune), look: m.look, gender: m.gender, friend: m.friend } })),
    ...posts.map((p) => ({
      id: -p.id,
      mine: false,
      body: `${p.emoji} ${p.body}`,
      at: p.at,
      sender: { key: 'babi-direct', name: 'Babi Direct', sub: p.kind === 'bet' ? 'Bet225' : p.commune ? communeName(p.commune) : undefined, avatar: DIRECT_AVATAR, color: DIRECT_COLOR },
      reactions: { counts: p.reactions, mine: p.mine, choices },
    })),
  ]
  if (posts.length) lines.sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
  return (
    <ChatScreen
      title={title}
      subtitle={people.size ? [...people].slice(0, 4).join(', ') + (people.size > 4 ? '…' : '') + ', toi' : room === 'babi' ? 'Public · Babi Direct' : 'Public'}
      avatar={
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white ring-2 ring-white/30" style={{ background: icon.bg }}>
          {icon.icon}
        </span>
      }
      onBack={onBack}
      lines={lines}
      notice={room === 'babi' ? 'Le grin est public : tout le monde peut lire. Les liens et les numéros sont masqués. Babi Direct raconte ce qui se passe dans le jeu : réagis à ses nouvelles ! Touche un message pour le signaler.' : 'Le grin est public : tout le monde peut lire. Les liens et les numéros sont masqués. Touche un message pour le signaler.'}
      empty="C'est calme au grin. Lance la discussion !"
      placeholder={room === 'babi' ? 'Écris à tout Babi' : `Écris ${aCommune(communeName(sim.commune))}`}
      onSend={send}
      onReport={(l) => setReporting(msgs.find((m) => m.id === l.id) ?? null)}
      onReact={react}
      note={note}
      below={
        reporting && (
          <div className="mb-2">
            <ReportSheet
              title={`Signaler le message ${deNom(reporting.firstName)}`}
              onCancel={() => setReporting(null)}
              onPick={(reason) =>
                void api
                  .reportGrin(sim.id, reporting.id, reason)
                  .then((r) => {
                    setMsgs((old) => old.filter((x) => x.sim !== reporting.sim))
                    setReporting(null)
                    setNote(r.text)
                  })
                  .catch((e) => setNote(e instanceof ApiError ? e.message : 'Pas de réseau, réessaie.'))
              }
              note="Tu ne verras plus ses messages ; l'équipe regarde le signalement."
            />
          </div>
        )
      }
    />
  )
}
