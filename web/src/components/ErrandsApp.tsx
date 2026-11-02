import { useEffect, useState } from 'react'
import { Check, HandHelping, Navigation } from 'lucide-react'
import { api, errorText } from '../lib/api'
import type { Errand, Sim } from '../lib/types'
import { Portrait } from '../avatar/portrait'
import { randomLook } from '../avatar/options'
import { rng } from '../world3d/themes'
import { amount } from '../game/rules'
import { t } from '../lib/i18n'

// The quartier's demandes, in the phone (backend sims/errands.go, the update
// « demandes »): who asks what today, the step each is at, « Y aller » to the
// nearest place for the next one, and the thanks once it's done.

export function ErrandsApp({ sim, onGo }: { sim: Sim; onGo: (kind: string) => void }) {
  const [list, setList] = useState<Errand[] | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    api
      .errands(sim.id)
      .then((r) => setList(r.errands))
      .catch((e) => setErr(errorText(e, t('Le quartier ne répond pas. Réessaie.'))))
    // The journal moves on as activities end: read again then.
  }, [sim.id, sim.activity?.end])
  if (err) return <p className="p-2 text-sm font-bold text-[#c92a2a]">{err}</p>
  if (!list) return <p className="p-2 text-sm font-bold text-[var(--color-ink-soft)]">…</p>
  if (!list.length) return <p className="p-2 text-sm font-bold text-[var(--color-ink-soft)]">{t("Personne n'a rien à te demander aujourd'hui. Reviens demain !")}</p>
  const left = list.filter((e) => !e.done).length
  return (
    <div className="space-y-3">
      <p className="text-sm font-bold text-[var(--color-ink-soft)]">{left ? t('Les gens de ton quartier comptent sur toi. Nouvelles demandes chaque jour à minuit.') : t('Tout est fait pour aujourd’hui : le quartier te remercie ! Nouvelles demandes à minuit.')}</p>
      {list.map((e) => (
        <ErrandCard key={e.id} e={e} onGo={onGo} />
      ))}
    </div>
  )
}

function ErrandCard({ e, onGo }: { e: Errand; onGo: (kind: string) => void }) {
  const look = randomLook(e.gender, rng(`errand:${e.giver}`))
  const next = e.steps[e.step]
  return (
    <div className={`rounded-2xl p-3 ${e.done ? 'bg-[#ebfbee]' : 'bg-[var(--color-canvas)]'}`}>
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-gradient-to-b from-[#ffd36e] to-[#ff8a3d] ring-2 ring-white">
          <Portrait look={look} gender={e.gender} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-[16px] leading-tight font-extrabold">{e.giver}</div>
          <div className="text-xs font-bold text-[var(--color-ink-soft)]">{e.role}</div>
        </div>
        <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[11px] font-extrabold text-[#a86800]">{t('+{0} Djai', { 0: amount(e.reward) })}</span>
      </div>
      <p className="mt-2 rounded-2xl bg-white p-2.5 text-[13.5px] leading-snug font-bold">« {e.done ? e.thanks : e.ask} »</p>
      <ul className="mt-2 space-y-1">
        {e.steps.map((s, i) => (
          <li key={i} className={`flex items-center gap-2 text-[13px] font-bold ${i < e.step || e.done ? 'text-[#2b8a3e]' : i === e.step ? '' : 'text-[var(--color-ink-soft)]'}`}>
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${i < e.step || e.done ? 'bg-[#2b8a3e] text-white' : 'bg-white shadow-[inset_0_0_0_2px_var(--color-line)]'}`}>{(i < e.step || e.done) && <Check size={13} strokeWidth={3} />}</span>
            {s.text}
          </li>
        ))}
      </ul>
      {!e.done && next && (
        <button className="btn mt-2 w-full !py-2" onClick={() => onGo(next.kind)}>
          <Navigation size={16} strokeWidth={2.6} /> {t('Y aller')}
        </button>
      )}
    </div>
  )
}

/**
 * The HUD chip: the demandes left today, always in sight, so there's always
 * something to go and do; a tap opens them in the phone. `seen` changes when
 * the Sim's journal does (an activity ended), to read them again.
 */
export function ErrandsChip({ sim, seen, onOpen }: { sim: Sim; seen: unknown; onOpen: () => void }) {
  const [left, setLeft] = useState<number | null>(null)
  useEffect(() => {
    api
      .errands(sim.id)
      .then((r) => setLeft(r.errands.filter((e) => !e.done).length))
      .catch(() => setLeft(null))
  }, [sim.id, seen])
  if (left === null) return null
  return (
    <button className="hud pointer-events-auto relative flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-extrabold transition active:scale-95" onClick={onOpen} aria-label={t('Demandes du quartier')}>
      <HandHelping size={18} strokeWidth={2.6} className={left ? 'text-[#2b8a3e]' : 'text-[var(--color-ink-soft)]'} />
      <span className="max-sm:hidden short:hidden">{left ? t('Demandes') : t('Tout est fait')}</span>
      {left > 0 && <span className="absolute -top-1.5 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#2b8a3e] px-1 text-[11px] text-white ring-2 ring-white">{left}</span>}
    </button>
  )
}
