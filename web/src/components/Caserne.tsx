import { useState } from 'react'
import { Check, ChevronDown, ChevronUp, Shield, GraduationCap } from 'lucide-react'
import { api } from '../lib/api'
import type { Interaction, PlaceKind, Sim } from '../lib/types'
import type { Act } from '../screens/phoneApps'
import { iconFor } from './icons'
import { duration } from '../game/rules'
import { t as tr, tx } from '../lib/i18n'

// L'armée (update « armee », backend game/armee.go, sims/armee.go): the service militaire at the caserne,
// the EMPT's internat. While one is lived the Sim lives there: this card shows the round (« semaine 2/3 »),
// its drills (each one played; under 50, again) and the place's everyday (the meal, the shower, the bed).
// Folded, only the chip stays; busy, only the chip.

/** The everyday of each program (backend game.InProgram), besides its drills. */
const LIFE: Record<string, string[]> = {
  service: ['caserne-ordinaire', 'caserne-douche', 'caserne-dortoir', 'service-quitter'],
  empt: ['empt-refectoire', 'empt-douche', 'empt-dortoir', 'empt-quitter'],
}

/** The actions a Sim may see at the caserne or the EMPT (the place's menu): the drills only for the program lived, the sign-ups only outside one. */
export function armeeShows(id: string, sim: Sim): boolean {
  const st = sim.life?.armee?.stay
  const a = sim.life?.armee
  const inProgram = (p: string) => (p === 'service' ? id.startsWith('caserne-') || id === 'service-quitter' : (id.startsWith('empt-') && !id.startsWith('empt-concours')) || id === 'empt-quitter')
  if (inProgram('service')) return st?.program === 'service'
  if (inProgram('empt')) return st?.program === 'empt'
  if (id === 'service-engager') return !st && !a?.service
  if (id === 'armee-engager') return !st && sim.career !== 'armee'
  if (id === 'empt-concours-ecrit') return !st && !a?.empt && (a?.ecrit ?? 0) < 50
  if (id === 'empt-concours-physique') return !st && !a?.empt && (a?.physique ?? 0) < 50
  return true
}

export function CasernePanel({ sim, kinds, run }: { sim: Sim; kinds: Record<string, PlaceKind>; run: Act }) {
  const [folded, setFolded] = useState(false)
  const st = sim.life!.armee!.stay!
  const empt = st.program === 'empt'
  const kind = kinds[empt ? 'empt' : 'caserne']
  const busy = sim.activity?.placeId === st.place
  const its = kind?.interactions ?? []
  const steps = st.steps.map((id) => its.find((it) => it.id === id)).filter((x): x is Interaction => !!x)
  const life = LIFE[st.program].map((id) => its.find((it) => it.id === id)).filter((x): x is Interaction => !!x)
  const n = st.done.length
  const all = st.steps.length
  const round = Math.min(st.round + 1, st.rounds)
  const I = empt ? GraduationCap : Shield
  const play = (it: Interaction) => void run(it.label, it.icon, empt ? 'empt' : 'caserne', () => api.interact(sim.id, st.place, it.id))
  const chip = (
    <button className="hud pointer-events-auto flex items-center gap-2 rounded-full py-1.5 pr-3 pl-1.5 text-[13px] font-extrabold" onClick={() => setFolded((f) => !f)} data-caserne-chip>
      <span className="grid h-7 w-7 place-items-center rounded-full bg-[#4f5b36] text-white">
        <I size={15} strokeWidth={2.6} />
      </span>
      {empt ? tx('EMPT · trimestre {round}/{rounds}', { round, rounds: st.rounds }) : tx('Service · semaine {round}/{rounds}', { round, rounds: st.rounds })}
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-black/10">
        <span className="block h-full rounded-full bg-[#6b8e23] transition-[width] duration-500" style={{ width: `${((st.round * all + n) / (st.rounds * all)) * 100}%` }} />
      </span>
    </button>
  )
  return (
    <>
      <div className="pointer-events-none absolute top-[max(4.75rem,calc(var(--sat,env(safe-area-inset-top))+4.25rem))] left-3 z-20">{chip}</div>
      {!busy && (
        <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 flex justify-center p-3 pb-[max(0.75rem,var(--sab,env(safe-area-inset-bottom)))]">
          <div className="sheet animate-up w-full max-w-[440px] rounded-[26px] p-4" data-caserne>
            <button className="flex w-full items-start gap-2 text-left" onClick={() => setFolded((f) => !f)}>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-extrabold tracking-wider text-[var(--color-ink-soft)] uppercase">{empt ? tr('École militaire préparatoire technique') : tr('Caserne du Bataillon des Lagunes')}</span>
                <span className="font-display block text-[20px] leading-tight font-extrabold">{empt ? tx('Trimestre {round} sur {rounds}', { round, rounds: st.rounds }) : tx('Semaine de classes {round} sur {rounds}', { round, rounds: st.rounds })}</span>
                <span className="block text-[12.5px] font-bold text-[var(--color-ink-soft)]">{tx('{n} exercice(s) sur {all} validé(s) : chacun se joue, 50 au moins pour qu’il compte.', { n, all })}</span>
              </span>
              {folded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
            {!folded && (
              <>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {steps.map((it) => {
                    const ok = st.done.includes(it.id)
                    const Icon = iconFor(it.icon)
                    return (
                      <button key={it.id} disabled={ok} data-drill={it.id} className={`flex items-center gap-2 rounded-2xl px-2.5 py-2 text-left text-[12.5px] leading-tight font-extrabold active:scale-95 ${ok ? 'bg-[#d3f9d8]' : 'bg-[#eef3e2] ring-2 ring-[#9bb068]'}`} onClick={() => play(it)}>
                        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${ok ? 'bg-[var(--color-emerald)] text-white' : 'bg-white'}`}>{ok ? <Check size={16} strokeWidth={3} /> : <Icon size={16} />}</span>
                        <span className="min-w-0">
                          {it.label}
                          <span className="block text-[10.5px] font-bold text-[var(--color-ink-soft)]">{ok ? tr('Validé !') : tr('À jouer')}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {life.map((it) => {
                    const Icon = iconFor(it.icon)
                    const quit = it.id.endsWith('quitter')
                    return (
                      <button key={it.id} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-extrabold active:scale-95 ${quit ? 'text-[#c92a2a]' : 'bg-black/[0.05]'}`} onClick={() => (!quit || confirm(tr('Quitter maintenant ? Tu n’auras pas ton papier.'))) && play(it)}>
                        <Icon size={14} /> {it.label}
                        {!quit && <span className="font-bold text-[var(--color-ink-soft)]">· {duration(it.minutes)}</span>}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
