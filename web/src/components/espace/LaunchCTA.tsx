import { Rocket, Undo2 } from 'lucide-react'
import type { Sim, World } from '../../lib/types'
import { t as tr } from '../../lib/i18n'
import { clockLabel } from '../../game/voyages'
import { IconTile } from '../ui'
import { destinationOf, isSpaceCity, launchRules, nextLaunch, ROCKET, spaceportAt, spaceportOf } from '../../lib/espace'
import type { OnTravel } from '../TravelCTA'

// The rocket in the place's sheet (backend sims/espace.go): at the pad, boarding for the next launch with one's
// ticket; up there, the way back to Earth (it always works). Workstream A's placeholder: C's LaunchCTA (with the
// Astrélia app's countdown) replaces it.
export function LaunchCTA({ world, sim, onTravel }: { world: World; sim: Sim; onTravel: OnTravel }) {
  const rules = launchRules(world)
  const e = sim.life?.espace
  if (isSpaceCity(sim.city)) {
    const sp = spaceportOf(world, e?.voyage?.from ?? 'sassandra') ?? rules.spaceports[0]
    const v = e?.voyage
    const d = destinationOf(world, sim.city)
    const cruising = !!v && !v.arrived && (v.rounds ?? 0) > 0
    return (
      <div className="mt-2 flex flex-col gap-2">
        {cruising && d && (
          <p className="text-xs font-bold text-[var(--color-ink-soft)]">
            {tr('Croisière vers {name} : étape {n} sur {of}, {done} tâches de bord sur {steps} faites.', { name: d.name, n: (v!.round ?? 0) + 1, of: v!.rounds, done: v!.done?.length ?? 0, steps: v!.steps?.length ?? 0 })}
          </p>
        )}
        <button className="tile flex w-full items-center gap-3 p-2.5 text-left" disabled={!!sim.activity} onClick={() => onTravel(sp.id, sp.splash, tr('Retour sur Terre'), { app: ROCKET }, 0)}>
          <IconTile icon={Undo2} colors={['#74c0fc', '#1d4ed8']} size={40} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-extrabold">{tr('Rentrer sur Terre')}</span>
            <span className="block text-xs font-bold text-[var(--color-ink-soft)]">{sp.landing === 'steppe' ? tr('Atterrissage dans la steppe, à {name}', { name: sp.name }) : tr('Amerrissage au large, puis {name}', { name: sp.name })}</span>
          </span>
        </button>
      </div>
    )
  }
  const sp = spaceportAt(world, sim.city, sim.commune)
  if (!sp) return null
  const ticket = e?.ticket
  const d = ticket ? rules.destinations.find((x) => x.id === ticket.dest) : undefined
  const l = nextLaunch(sp.id, sim.gameMinutes + rules.preflight, rules)
  const wait = e?.launchNow ? rules.preflight : l.at - sim.gameMinutes
  const open = wait <= rules.boardWindow
  return (
    <div className="mt-2">
      {d ? (
        <button className="tile flex w-full items-center gap-3 p-2.5 text-left disabled:opacity-60" disabled={!open || !!sim.activity} onClick={() => onTravel(d.city, d.commune, tr('Embarquer pour {name}', { name: d.name }), { app: ROCKET }, 0)}>
          <IconTile icon={Rocket} colors={['#ffa94d', '#ff7a00']} size={40} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-extrabold">{tr('Embarquer pour {name}', { name: d.name })}</span>
            <span className="block text-xs font-bold text-[var(--color-ink-soft)]">
              {open ? tr('Décollage {at} : la préparation commence', { at: e?.launchNow ? tr('tout de suite') : clockLabel(l.at) }) : tr('Prochain lancement {at} : l’embarquement ouvre {n} min avant', { at: clockLabel(l.at), n: rules.boardWindow })}
            </span>
          </span>
        </button>
      ) : (
        <p className="text-xs font-bold text-[var(--color-ink-soft)]">{tr('Prochain lancement habité {at}. Achète ton billet ci-dessus pour embarquer.', { at: clockLabel(l.at) })}</p>
      )}
    </div>
  )
}
