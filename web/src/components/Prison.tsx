import { useState } from 'react'
import { Check, Gavel, Lock, Shield, X } from 'lucide-react'
import { api } from '../lib/api'
import type { PlaceKind, Sim } from '../lib/types'
import type { Act } from '../screens/phoneApps'
import { iconFor } from './icons'
import { duration } from '../game/rules'
import { t as tr, tx } from '../lib/i18n'

// Prison at the MACA (the update « braquages », backend game/prison.go, sims/prison.go): caught after a
// robbery, the Sim lives its sentence there. Free between two things, this card: the étapes asked (the
// cantine, the promenade, the atelier, the parloir, a class; the juge last) and the MACA's actions;
// busy, the usual activity card and, over it, the chip of the étapes. All done and the juge seen: out.

/** The MACA's place id (sims.PrisonPlaceID); each étape's interaction is « prison-<étape> ». */
export const PRISON_PLACE = 'maca'

export function PrisonPanel({ sim, kind, run }: { sim: Sim; kind?: PlaceKind; run: Act }) {
  const [list, setList] = useState(false)
  const p = sim.prison!
  const busy = sim.activity?.placeId === PRISON_PLACE
  const n = p.done.length
  const all = p.steps.length
  const ready = p.steps.every((id) => id === 'juge' || p.done.includes(id))
  const its = kind?.interactions ?? []
  const labelOf = (id: string) => its.find((it) => it.id === `prison-${id}`)?.label ?? id
  const chip = (
    <button className="hud pointer-events-auto flex items-center gap-2 rounded-full py-1.5 pr-3 pl-1.5 text-[13px] font-extrabold" onClick={() => setList(true)}>
      <span className="grid h-7 w-7 place-items-center rounded-full bg-[#343a40] text-white">
        <Shield size={15} strokeWidth={2.6} />
      </span>
      {tx('MACA · étapes {n}/{all}', { n, all })}
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-black/10">
        <span className="block h-full rounded-full bg-[var(--color-emerald)]" style={{ width: `${(n / all) * 100}%` }} />
      </span>
    </button>
  )
  const steps = (
    <ul className="space-y-1.5">
      {p.steps.map((id) => {
        const done = p.done.includes(id)
        const locked = id === 'juge' && !ready
        const I = id === 'juge' ? Gavel : iconFor(its.find((it) => it.id === `prison-${id}`)?.icon ?? 'shield')
        return (
          <li key={id} className={`flex items-center gap-2.5 rounded-2xl px-2.5 py-1.5 ${done ? 'bg-[#d3f9d8]' : 'bg-black/[0.04]'}`}>
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${done ? 'bg-[var(--color-emerald)] text-white' : 'bg-white text-[var(--color-ink-soft)]'}`}>{done ? <Check size={16} strokeWidth={3} /> : locked ? <Lock size={15} /> : <I size={16} />}</span>
            <span className="min-w-0 flex-1 text-[13px] leading-tight font-extrabold">
              {labelOf(id)}
              <span className="block text-[11px] font-bold text-[var(--color-ink-soft)]">{done ? tr('Fait !') : locked ? tr('Quand les autres étapes sont faites') : tr('À faire')}</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
  return (
    <>
      <div className="pointer-events-none absolute top-[max(4.75rem,calc(var(--sat,env(safe-area-inset-top))+4.25rem))] left-3 z-20">{chip}</div>
      {!busy && (
        <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 flex justify-center p-3 pb-[max(0.75rem,var(--sab,env(safe-area-inset-bottom)))]">
          <div className="sheet animate-up w-full max-w-[440px] rounded-[26px] p-4">
            <div className="text-[11px] font-extrabold tracking-wider text-[var(--color-ink-soft)] uppercase">{tr('Maison d’arrêt et de correction d’Abidjan')}</div>
            <div className="font-display text-[20px] leading-tight font-extrabold">{ready ? tr('Il ne reste que le juge') : tr('En prison à la MACA')}</div>
            <div className="text-[12.5px] font-bold text-[var(--color-ink-soft)]">{tx('Fais tes {all} étapes pour sortir : {n} déjà faites.', { n, all })}</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {its.map((it) => {
                const step = p.steps.find((id) => it.id === `prison-${id}`)
                const done = !!step && p.done.includes(step)
                const locked = it.id === 'prison-juge' && !ready
                if (it.id === 'prison-juge' && !p.steps.includes('juge')) return null
                const I = iconFor(it.icon)
                return (
                  <button key={it.id} disabled={locked} className={`flex items-center gap-2 rounded-2xl px-2.5 py-2 text-left text-[12.5px] leading-tight font-extrabold active:scale-95 disabled:opacity-45 ${step && !done ? 'bg-[#fff3bf] ring-2 ring-[#ffd43b]' : 'bg-black/[0.04]'}`} onClick={() => void run(it.label, it.icon, 'prison', () => api.interact(sim.id, PRISON_PLACE, it.id))}>
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white">{locked ? <Lock size={15} /> : <I size={16} />}</span>
                    <span className="min-w-0">
                      {it.label}
                      <span className="block text-[10.5px] font-bold text-[var(--color-ink-soft)]">
                        {duration(it.minutes)}
                        {step && !done ? ` · ${tr('étape')}` : ''}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
      {list && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-[#0f1230]/55 backdrop-blur-[3px] lg:items-center lg:justify-center" onClick={() => setList(false)}>
          <div className="sheet animate-up w-full rounded-t-[28px] px-5 pt-5 pb-[max(1rem,var(--sab,env(safe-area-inset-bottom)))] lg:w-[420px] lg:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="font-display text-[22px] font-extrabold">{tr('Mes étapes à la MACA')}</div>
                <div className="text-[13px] font-bold text-[var(--color-ink-soft)]">{tx('{n} sur {all} : toutes faites et le juge vu, tu sors', { n, all })}</div>
              </div>
              <button className="icon-btn" onClick={() => setList(false)} aria-label={tr('Fermer')}>
                <X size={20} />
              </button>
            </div>
            {steps}
          </div>
        </div>
      )}
    </>
  )
}
