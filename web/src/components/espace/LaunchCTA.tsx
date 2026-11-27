import { useEffect, useState } from 'react'
import { Rocket, Timer, Undo2 } from 'lucide-react'
import type { Sim, World } from '../../lib/types'
import { t as tr } from '../../lib/i18n'
import { clockLabel } from '../../game/voyages'
import { IconTile } from '../ui'
import { destinationOf, isSpaceCity, launchRules, launchTimetable, nextLaunch, ROCKET, spaceportAt, spaceportOf } from '../../lib/espace'
import type { OnTravel } from '../TravelCTA'
import { countdown, liveMinute } from './countdown'

// The rocket in the place's sheet (backend sims/espace.go): at the pad, the next launches and the countdown to the
// next crewed one (live, to the second), then boarding with one's ticket once the window opens (20 minutes
// before); up there, the way back to Earth (it always works), and the cruise's progress.

/** The Sim's game minute, ticking every second. */
function useNow(gameMinutes: number) {
  const [now, setNow] = useState(() => liveMinute(gameMinutes))
  useEffect(() => {
    const at = performance.now()
    const id = setInterval(() => setNow(liveMinute(gameMinutes + (performance.now() - at) / 60000)), 1000)
    return () => clearInterval(id)
  }, [gameMinutes])
  return Math.max(now, gameMinutes)
}

export function LaunchCTA({ world, sim, onTravel }: { world: World; sim: Sim; onTravel: OnTravel }) {
  const rules = launchRules(world)
  const e = sim.life?.espace
  const now = useNow(sim.gameMinutes)
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
  const l = nextLaunch(sp.id, Math.floor(now) + rules.preflight, rules)
  const wait = e?.launchNow ? rules.preflight : l.at - now
  const open = wait <= rules.boardWindow
  // The next few, crewed and cargo, the « reporté » ones struck through.
  const soon = launchTimetable(sp.id, Math.floor(now), Math.floor(now) + 4 * 60, rules).slice(0, 3)
  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="flex items-center gap-3 rounded-2xl bg-[#0b1a33] p-3 text-white">
        <Timer size={26} className="shrink-0 text-[#ffa94d]" />
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold text-white/75">{tr('Prochain lancement habité, {at}', { at: e?.launchNow ? tr('tout de suite') : clockLabel(l.at) })}</span>
          <span className="block font-display text-2xl font-extrabold tabular-nums">T-{countdown(e?.launchNow ? now + rules.preflight : l.at, now)}</span>
        </span>
        <span className="flex flex-col items-end gap-0.5 text-[11px] font-bold text-white/75">
          {soon.map((x) => (
            <span key={`${x.at}:${x.crewed}`} className={x.scrub ? 'line-through opacity-60' : ''}>
              {clockLabel(x.at)} · {x.scrub ? tr('reporté') : x.crewed ? tr('habité') : tr('cargo')}
            </span>
          ))}
        </span>
      </div>
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
