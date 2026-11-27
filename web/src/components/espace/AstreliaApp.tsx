import { useEffect, useState } from 'react'
import { CalendarClock, MapPin, Rocket, Ticket, TicketX, Timer } from 'lucide-react'
import type { Sim, World } from '../../lib/types'
import { api } from '../../lib/api'
import { keyOpen, useFeatures } from '../../lib/features'
import { t as tr, tx } from '../../lib/i18n'
import { amount } from '../../game/rules'
import { clockLabel } from '../../game/voyages'
import { ESPACE_KEY, launchRules, launchTimetable, nextLaunch, ROCKET, type Launch, type Spaceport } from '../../lib/espace'
import type { Act } from '../../screens/phoneApps'
import type { OnTravel } from '../TravelCTA'
import { Coin } from '../ui'
import { countdown, liveMinute } from './countdown'

// The agency's app (the update « espace », backend game/espace.go; lib/espace.ts works the timetable out on the
// phone): the next launches from each spaceport open to the Sim (crewed and cargo, the « reporté » ones too), the
// ticket held with its own countdown to the next crewed launch, and its cancelling before boarding (80 % back,
// backend sims/espaceTerre.go), the way to the pad, the prices. Nothing here is bought: tickets are sold at the pad.

/** The Sim's game minute, ticking every second. */
function useNow(gameMinutes: number) {
  const [now, setNow] = useState(() => liveMinute(gameMinutes))
  useEffect(() => {
    const at = performance.now()
    const id = setInterval(() => setNow(liveMinute(gameMinutes + (performance.now() - at) / 60000)), 1000)
    return () => clearInterval(id)
  }, [gameMinutes])
  return now
}

export function AstreliaApp({ world, sim, act, onTravel }: { world: World; sim: Sim; act: Act; onTravel: OnTravel }) {
  const feats = useFeatures()
  const rules = launchRules(world)
  const now = useNow(sim.gameMinutes)
  const e = sim.life?.espace
  const ports = rules.spaceports.filter((s) => keyOpen(feats, ESPACE_KEY) && (!s.key || keyOpen(feats, s.key)))
  // The spaceport of the town the Sim is in first (else the hub).
  const here = ports.find((s) => s.id === sim.city)
  const home = here ?? ports[0]
  const ticket = e?.ticket
  const dest = ticket ? rules.destinations.find((d) => d.id === ticket.dest) : undefined
  const boarding = sim.activity?.kind === 'travel' && sim.activity.trip?.mode === ROCKET
  const [sure, setSure] = useState(false)
  const back = ticket ? Math.min(ticket.paid, Math.floor((ticket.paid * rules.refund) / 100)) : 0
  const next = home ? nextLaunch(home.id, now + rules.preflight, rules) : undefined
  return (
    <div className="space-y-3">
      <div className="rounded-[22px] bg-gradient-to-br from-[#1c3d6e] to-[#0b1a33] p-4 text-white">
        <div className="flex items-center gap-2 font-display text-xl font-extrabold">
          <Rocket size={22} className="text-[#ffa94d]" /> {rules.agency}
        </div>
        <p className="mt-1 text-sm font-bold text-white/80">{tr('Les lancements de la fusée Calao, ton billet, le compte à rebours.')}</p>
      </div>

      {/* The ticket held */}
      {ticket && dest ? (
        <section className="rounded-[22px] bg-[#fff4e8] p-3.5">
          <div className="flex items-center gap-2 font-extrabold">
            <Ticket size={18} className="text-[#ff7a00]" />
            <span className="min-w-0 flex-1 truncate">{tx('Billet pour la {0}', { 0: dest.name })}</span>
            <span className="text-xs font-bold text-[var(--color-ink-soft)]">
              {dest.rocket} · {dest.ship}
            </span>
          </div>
          {next && home && (
            <div className="mt-2 flex items-center gap-3 rounded-2xl bg-white p-3">
              <Timer size={28} className="shrink-0 text-[#1c3d6e]" />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-[var(--color-ink-soft)]">{tx('Prochain lancement habité de {0}, {1}', { 0: home.name, 1: clockLabel(next.at) })}</span>
                <span className="block font-display text-3xl font-extrabold tabular-nums">T-{countdown(next.at, now)}</span>
              </span>
            </div>
          )}
          <p className="mt-2 text-xs font-bold text-[var(--color-ink-soft)]">{tx('Embarquement au pas de tir, {0} min avant le décollage. Payé {1} F ; annulé avant l’embarquement, {2} F te sont rendus.', { 0: rules.boardWindow, 1: amount(ticket.paid), 2: amount(back) })}</p>
          {home && sim.city === home.id && sim.commune !== home.commune && (
            <button className="btn mt-2 w-full !bg-[#1c3d6e]" disabled={!!sim.activity} onClick={() => onTravel(home.id, home.commune, tr('Vers le pas de tir'))}>
              <MapPin size={18} /> {tr('Aller au pas de tir')}
            </button>
          )}
          {!sure ? (
            <button className="btn mt-2 w-full !bg-white !text-[#c92a2a]" disabled={boarding} onClick={() => setSure(true)}>
              <TicketX size={18} /> {boarding ? tr('Embarquement commencé : le billet ne se rend plus') : tr('Annuler mon billet')}
            </button>
          ) : (
            <div className="mt-2 flex gap-2">
              <button className="btn flex-1 !bg-white !text-[var(--color-ink)]" onClick={() => setSure(false)}>
                {tr('Garder')}
              </button>
              <button className="btn flex-1 !bg-[#c92a2a]" disabled={boarding} onClick={() => (setSure(false), act(tr('Annuler mon billet'), 'ticket-x', 'spatioport', () => api.espaceCancel(sim.id)))}>
                {tx('Rendre ({0} F)', { 0: amount(back) })}
              </button>
            </div>
          )}
        </section>
      ) : e?.voyage ? (
        <section className="rounded-[22px] bg-[#eef4ff] p-3.5 text-sm font-bold text-[#1c3d6e]">{tr('Tu es en mission là-haut. Le retour sur Terre se fait depuis le sas.')}</section>
      ) : (
        <section className="rounded-[22px] bg-[#eef4ff] p-3.5 text-sm font-bold text-[#1c3d6e]">
          <p>{tr('Pas de billet. Les billets se prennent au pas de tir, dès 18 ans : la station, la Lune, Mars.')}</p>
          {home && sim.city === home.id && sim.commune !== home.commune && (
            <button className="btn mt-2 w-full !bg-[#1c3d6e]" disabled={!!sim.activity} onClick={() => onTravel(home.id, home.commune, tr('Vers le pas de tir'))}>
              <MapPin size={18} /> {tr('Aller au pas de tir')}
            </button>
          )}
        </section>
      )}

      {/* The timetable */}
      <section>
        <h4 className="label mb-2 flex items-center gap-1.5">
          <CalendarClock size={14} /> {tr('Prochains lancements')}
        </h4>
        <ul className="space-y-2">
          {ports.map((sp) => (
            <PortRow key={sp.id} sp={sp} now={now} mine={sp.id === sim.city} rules={rules} />
          ))}
        </ul>
      </section>

      {/* The prices */}
      <section className="rounded-[22px] bg-white p-3 shadow-sm">
        <h4 className="label mb-2">{tr('Les billets (retour compris)')}</h4>
        <ul className="space-y-1 text-sm font-bold">
          {rules.destinations.map((d) => (
            <li key={d.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate">{d.name}</span>
              <Coin size={14} /> {amount(d.price)}
            </li>
          ))}
          <li className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate">{tr('Saut suborbital (4 minutes en apesanteur)')}</span>
            <Coin size={14} /> {amount(rules.suborbital)}
          </li>
        </ul>
        <p className="mt-2 text-xs font-bold text-[var(--color-ink-soft)]">{tr('Sur Terre aussi : le centre des visiteurs, la centrifugeuse, le vol parabolique de l’Albatros 0G, et les lancements à regarder depuis la plage (gratuit).')}</p>
      </section>
    </div>
  )
}

function PortRow({ sp, now, mine, rules }: { sp: Spaceport; now: number; mine: boolean; rules: ReturnType<typeof launchRules> }) {
  const list: Launch[] = launchTimetable(sp.id, Math.floor(now), Math.floor(now) + 6 * 60, rules).slice(0, 4)
  return (
    <li className={`rounded-2xl bg-white px-3 py-2.5 shadow-sm ${mine ? 'ring-2 ring-[#ff7a00]' : ''}`}>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-extrabold">{sp.name}</span>
        {mine && <span className="rounded-full bg-[#fff4e8] px-2 py-0.5 text-[11px] font-extrabold text-[#e8590c]">{tr('ici')}</span>}
      </div>
      <ul className="mt-1.5 space-y-1">
        {list.map((l, i) => (
          <li key={`${l.at}:${l.crewed}`} className={`flex items-center gap-2 text-xs font-bold ${l.scrub ? 'text-[var(--color-ink-soft)] line-through' : ''}`}>
            <span className="w-14 tabular-nums">{clockLabel(l.at)}</span>
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ${l.crewed ? 'bg-[#1c3d6e] text-white' : 'bg-[var(--color-canvas)]'}`}>{l.crewed ? tr('habité') : tr('cargo')}</span>
            <span className="min-w-0 flex-1 truncate">{l.scrub ? tr('lancement reporté') : i === 0 || l.at - now < 60 ? `T-${countdown(l.at, now)}` : ''}</span>
          </li>
        ))}
      </ul>
    </li>
  )
}
