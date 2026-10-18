import { useEffect, useRef, useState } from 'react'
import { Send, UserCheck } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import type { GrinMessage, Sim, World } from '../lib/types'
import { Portrait } from '../avatar/portrait'
import { ReportSheet } from '../components/Social'

/**
 * Le grin, in Gbairai (backend sims/grin.go): the public chat, where people
 * sit and talk, like round the teapot. « Tout Babi » for everyone, « Ma
 * commune » for those of the commune the Sim is in. New messages every 4 s
 * while it's open. Links and numbers are masked; a message can be reported.
 */
export function Grin({ world, sim }: { world: World; sim: Sim }) {
  const [room, setRoom] = useState<'babi' | 'commune'>('babi')
  const [msgs, setMsgs] = useState<GrinMessage[]>([])
  const [text, setText] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const [reporting, setReporting] = useState<GrinMessage | null>(null)
  const [sending, setSending] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  const last = useRef(0)
  const communeName = (id: string) => world.cities.flatMap((c) => c.communes).find((c) => c.id === id)?.name ?? id

  useEffect(() => {
    let stop = false
    last.current = 0
    setMsgs([])
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
  useEffect(() => end.current?.scrollIntoView({ block: 'end' }), [msgs.length])

  const send = async () => {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    try {
      const r = await api.sayGrin(sim.id, room, body)
      setText('')
      setNote(null)
      last.current = Math.max(last.current, r.id)
      setMsgs((old) => [...old, { id: r.id, sim: sim.id, firstName: sim.firstName, gender: sim.gender, look: sim.look, commune: sim.commune, mine: true, friend: false, body: r.body, at: new Date().toISOString() }])
    } catch (e) {
      setNote(e instanceof ApiError ? e.message : 'Pas de réseau, réessaie.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-full min-h-[440px] flex-col">
      <div className="flex gap-1 rounded-full bg-[var(--color-canvas)] p-1">
        {(
          [
            ['babi', 'Tout Babi'],
            ['commune', `Ma commune · ${communeName(sim.commune)}`],
          ] as const
        ).map(([id, label]) => (
          <button key={id} onClick={() => setRoom(id)} className={`min-w-0 flex-1 truncate rounded-full px-2 py-1.5 text-xs font-extrabold ${room === id ? 'bg-white shadow-sm' : 'text-[var(--color-ink-soft)]'}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto py-3">
        {msgs.length === 0 && <p className="py-6 text-center text-sm font-bold text-[var(--color-ink-soft)]">C'est calme au grin. Lance la discussion !</p>}
        {msgs.map((m) => (
          <div key={m.id} className={`flex items-end gap-2 ${m.mine ? 'flex-row-reverse' : ''}`}>
            {!m.mine && (
              <span className="block h-8 w-8 shrink-0 overflow-hidden rounded-full bg-[var(--color-canvas)]">
                <Portrait look={m.look} gender={m.gender} framing="head" />
              </span>
            )}
            <div className={`max-w-[78%] rounded-2xl px-3 py-2 ${m.mine ? 'rounded-br-sm bg-[#ffe0c7] text-[#4a2200]' : 'rounded-bl-sm bg-[var(--color-canvas)]'}`}>
              {!m.mine && (
                <div className="flex items-center gap-1 text-[11px] font-extrabold text-[#f0590c]">
                  {m.firstName}
                  {m.friend && <UserCheck size={11} aria-label="ami" />}
                  <span className="font-bold text-[var(--color-ink-soft)]">· {communeName(m.commune)}</span>
                </div>
              )}
              <p className="text-[14px] leading-snug font-bold whitespace-pre-wrap">{m.body}</p>
              <div className="mt-0.5 flex justify-end gap-2 text-[10px] font-bold opacity-60">
                {!m.mine && (
                  <button className="underline" onClick={() => setReporting(m)}>
                    signaler
                  </button>
                )}
                {new Date(m.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      {note && <p className="mb-2 rounded-xl bg-[#fff4e8] px-3 py-2 text-xs font-bold text-[#7a3a00]">{note}</p>}
      {reporting && (
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
          rows={1}
          placeholder={room === 'babi' ? 'Écris à tout Babi…' : `Écris à ${communeName(sim.commune)}…`}
          className="field max-h-28 min-h-[44px] flex-1 resize-none !rounded-2xl !py-2.5"
        />
        <button type="submit" disabled={sending || !text.trim()} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#f0590c] text-white disabled:opacity-40" aria-label="Envoyer">
          <Send size={18} strokeWidth={2.6} />
        </button>
      </form>
      <p className="mt-1.5 text-center text-[10px] font-bold text-[var(--color-ink-soft)]">Public : tout le monde peut lire. Liens et numéros masqués.</p>
    </div>
  )
}
