import { useEffect, useState } from 'react'
import { Check, Circle, Siren } from 'lucide-react'
import { api } from '../lib/api'
import { duration } from '../game/rules'
import { t as tr, tx } from '../lib/i18n'

// Les braquages on the screen (the update « braquages », backend sims/braquage.go braquageView): the Sim
// wanted after a job got away with (a chip, the hours left), and at a bank, where its big job stands
// (scouted, the gear ready, the crew: two at least).

export type BraquageView = { record: number; crew: number; wantedUntil?: number; bank?: string; prepared?: boolean }

/** Where the Sim's robberies stand, read again when `again` changes (an action, an activity ended). */
export function useBraquage(simId: string, on: boolean, again: string) {
  const [v, setV] = useState<BraquageView | null>(null)
  useEffect(() => {
    if (!on) return
    let gone = false
    api
      .braquage(simId)
      .then((r) => !gone && setV(r))
      .catch(() => undefined)
    return () => void (gone = true)
  }, [simId, on, again])
  return on ? v : null
}

/** « Recherché·e » over the street: the police looking, the time left. */
export function WantedChip({ v, now, className = '' }: { v: BraquageView; now: number; className?: string }) {
  const left = (v.wantedUntil ?? 0) - now
  if (left <= 0) return null
  return (
    <div className={`hud pointer-events-none flex items-center gap-2 rounded-full bg-[#c92a2a] py-1.5 pr-3 pl-1.5 text-[13px] font-extrabold text-white ${className}`} role="status">
      <span className="grid h-7 w-7 animate-pulse place-items-center rounded-full bg-white text-[#c92a2a]">
        <Siren size={15} strokeWidth={2.6} />
      </span>
      {tx('Recherché·e · encore {0}', { 0: duration(left) })}
    </div>
  )
}

/** At a bank: the big job's plan, step by step (sims/braquage.go: scouted here less than 3 days ago, the gear, two in the crew). */
export function BankPlan({ v, placeId }: { v: BraquageView; placeId: string }) {
  const scouted = v.bank === placeId
  const steps: [boolean, string][] = [
    [scouted, scouted ? tr('Lieux repérés') : tr('Repérer les lieux (en journée)')],
    [scouted && !!v.prepared, tr('Matériel prêt (masques, sacs, la moto)')],
    [v.crew >= 2, tr('Équipe : {0}/2 complices', { 0: Math.min(v.crew, 3) })],
  ]
  return (
    <div className="min-w-0 rounded-[20px] bg-[#fff0f0] p-3">
      <div className="label text-[#c92a2a]">{tr('Le gros coup')}</div>
      <ul className="mt-1 space-y-1">
        {steps.map(([done, label]) => (
          <li key={label} className={`flex items-center gap-2 text-[13px] font-bold ${done ? 'text-[#2b8a3e]' : 'text-[var(--color-ink-soft)]'}`}>
            {done ? <Check size={15} strokeWidth={3} /> : <Circle size={13} />} {label}
          </li>
        ))}
      </ul>
      {v.bank && !scouted && <p className="mt-1 text-[11px] font-bold text-[var(--color-ink-soft)]">{tr('Tu as repéré une autre banque : ici, il faut tout recommencer.')}</p>}
      {v.wantedUntil && <p className="mt-1 text-[11px] font-bold text-[#c92a2a]">{tr('Tu es recherché·e : la police a plus de chances de t’attraper.')}</p>}
    </div>
  )
}
