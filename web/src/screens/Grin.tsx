import { useEffect, useRef, useState, type ReactNode } from 'react'
import { MapPin, Users } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import type { GrinMessage, Sim, World } from '../lib/types'
import { ReportSheet } from '../components/Social'
import { ChatScreen } from '../components/ChatScreen'

/**
 * Le grin, in Gbairai (backend sims/grin.go): the public chat, where people
 * sit and talk, like round the teapot. Two group chats: « Tout Babi » for
 * everyone, « Ma commune » for those of the commune the Sim is in, each
 * opened full screen like a group on the phone (the names in colour). New
 * messages every 4 s while it's open. Links and numbers are masked; a
 * message can be reported.
 */
export function Grin({ world, sim }: { world: World; sim: Sim }) {
  const [room, setRoom] = useState<'babi' | 'commune' | null>(null)
  const communeName = (id: string) => world.cities.flatMap((c) => c.communes).find((c) => c.id === id)?.name ?? id
  const rooms = [
    { id: 'babi' as const, name: 'Tout Babi', sub: 'Le grin de tous les joueurs', icon: <Users size={24} />, bg: '#c2410c' },
    { id: 'commune' as const, name: `Ma commune · ${communeName(sim.commune)}`, sub: `Ceux qui sont à ${communeName(sim.commune)}`, icon: <MapPin size={24} />, bg: '#2f9e44' },
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
  const [note, setNote] = useState<string | null>(null)
  const [reporting, setReporting] = useState<GrinMessage | null>(null)
  const last = useRef(0)

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

  const people = new Set(msgs.filter((m) => !m.mine).map((m) => m.firstName))
  return (
    <ChatScreen
      title={title}
      subtitle={people.size ? [...people].slice(0, 4).join(', ') + (people.size > 4 ? '…' : '') + ', toi' : 'Public'}
      avatar={
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white ring-2 ring-white/30" style={{ background: icon.bg }}>
          {icon.icon}
        </span>
      }
      onBack={onBack}
      lines={msgs.map((m) => ({ id: m.id, mine: m.mine, body: m.body, at: m.at, sender: { key: m.sim, name: m.firstName, sub: communeName(m.commune), look: m.look, gender: m.gender, friend: m.friend } }))}
      notice="Le grin est public : tout le monde peut lire. Les liens et les numéros sont masqués. Touche un message pour le signaler."
      empty="C'est calme au grin. Lance la discussion !"
      placeholder={room === 'babi' ? 'Écris à tout Babi' : `Écris à ${communeName(sim.commune)}`}
      onSend={send}
      onReport={(l) => setReporting(msgs.find((m) => m.id === l.id) ?? null)}
      note={note}
      below={
        reporting && (
          <div className="mb-2">
            <ReportSheet
              title={`Signaler le message de ${reporting.firstName}`}
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
