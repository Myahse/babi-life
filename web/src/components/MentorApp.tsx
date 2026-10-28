import { useEffect, useState } from 'react'
import { HandCoins, Lightbulb } from 'lucide-react'
import { api, errorText } from '../lib/api'
import type { ActionResult, Mentor, Sim } from '../lib/types'
import { Portrait } from '../avatar/portrait'
import { randomLook } from '../avatar/options'
import { rng } from '../world3d/themes'

// The family's mentor, in the phone (backend sims/mentor.go): who they are,
// what they said when they took the Sim under their wing; ask for advice any
// time, for a hand once a game week at most.

export function MentorApp({ sim, onResult }: { sim: Sim; onResult: (r: ActionResult) => void }) {
  const [m, setM] = useState<{ mentor: Mentor; helpIn: number } | null>(null)
  const [said, setSaid] = useState<{ ok: boolean; text: string }[]>([])
  const [busy, setBusy] = useState(false)
  const load = () => api.mentor(sim.id).then(setM).catch(() => setSaid([{ ok: false, text: 'Ton mentor ne répond pas. Réessaie.' }]))
  useEffect(() => void load(), [sim.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const ask = async (what: 'conseil' | 'aide') => {
    setBusy(true)
    try {
      const r = await api.askMentor(sim.id, what)
      onResult(r)
      setSaid((s) => [...s.slice(-4), { ok: true, text: r.outcome.text }])
      void load()
    } catch (e) {
      setSaid((s) => [...s.slice(-4), { ok: false, text: errorText(e, 'Erreur') }])
    } finally {
      setBusy(false)
    }
  }
  if (!m) return <p className="p-2 text-sm font-bold text-[var(--color-ink-soft)]">…</p>
  const look = randomLook(m.mentor.gender, rng(`mentor:${m.mentor.family}`))
  const days = Math.ceil(m.helpIn / (24 * 60))
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-2xl bg-[var(--color-canvas)] p-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-gradient-to-b from-[#ffd36e] to-[#ff8a3d] ring-2 ring-white">
          <Portrait look={look} gender={m.mentor.gender} />
        </div>
        <div className="min-w-0">
          <div className="font-display text-[19px] leading-tight font-extrabold">{m.mentor.name}</div>
          <div className="text-xs font-bold text-[var(--color-ink-soft)]">{m.mentor.title}</div>
        </div>
      </div>
      <p className="rounded-2xl bg-white p-3 text-[14px] leading-snug font-bold shadow-[inset_0_0_0_2px_var(--color-line)]">« {m.mentor.intro} »</p>
      <div className="grid gap-2">
        <button className="btn !py-2.5" disabled={busy} onClick={() => void ask('conseil')}>
          <Lightbulb size={17} /> Demander un conseil
        </button>
        <button className="btn !bg-[var(--color-canvas)] !py-2.5 !text-[var(--color-ink)]" disabled={busy} onClick={() => void ask('aide')}>
          <HandCoins size={17} /> {m.helpIn > 0 ? `Un coup de main (dans ${days} jour${days > 1 ? 's' : ''})` : 'Demander un coup de main'}
        </button>
      </div>
      {said.map((l, i) => (
        <p key={i} className={`rounded-2xl p-3 text-[13.5px] leading-snug font-bold ${l.ok ? 'bg-[#fff8e1]' : 'bg-[#ffe3e3] text-[#c92a2a]'}`}>
          {l.text}
        </p>
      ))}
    </div>
  )
}
