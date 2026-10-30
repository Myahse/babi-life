import { Plane, PlaneTakeoff } from 'lucide-react'
import type { Sim, World } from '../lib/types'
import { keyOpen, useFeatures } from '../lib/features'
import { aCommune } from '../lib/french'
import { amount, duration, ageOf } from '../game/rules'
import { airportOf, flightsFrom } from '../game/voyages'
import type { OnTravel } from './TravelCTA'
import { Coin } from './ui'
import { t as tr, tx } from '../lib/i18n'

// The airline's app (the update « voyages-villes »): Air Lagune's flights from
// the airport of the city the Sim is in to every other one, with the time in
// the air and the price of a seat. At the airport, a tap and the Sim boards;
// elsewhere in the city, the app sends it there first (the ride across town).

export function AirLaguneApp({ world, sim, onTravel }: { world: World; sim: Sim; onTravel: OnTravel }) {
  const feats = useFeatures()
  const flights = flightsFrom(world, sim.city, (k) => keyOpen(feats, k)).sort((a, b) => a.km - b.km)
  const airport = airportOf(world, sim.city)
  const here = !!airport && airport.commune.id === sim.commune
  // Babies and children don't fly alone (backend sims: errTooSmallToTravel).
  const small = ageOf(world, sim.bornAt ?? 0, sim.gameMinutes) < 12
  return (
    <div className="space-y-3">
      <div className="rounded-[22px] bg-gradient-to-br from-[#4dabf7] to-[#1d4ed8] p-4 text-white">
        <div className="flex items-center gap-2 font-display text-xl font-extrabold">
          <Plane size={22} fill="#f08a24" /> {tr('Air Lagune')}
        </div>
        <p className="mt-1 text-sm font-bold text-white/85">{airport ? tx('Vols au départ de : {0}', { 0: airport.place.name }) : tr("Pas d'aéroport ici.")}</p>
      </div>
      {airport && !here && (
        <div className="rounded-2xl bg-[#eef4ff] p-3 text-sm font-bold text-[#1d4ed8]">
          <p className="mb-2">{tx("Les vols partent de l'{0}, {1} : vas-y d'abord.", { 0: airport.place.name, 1: aCommune(airport.commune.name) })}</p>
          <button className="btn w-full !bg-[#1d4ed8]" disabled={!!sim.activity || small} onClick={() => onTravel(sim.city, airport.commune.id, tr("Vers l'aéroport"))}>
            <PlaneTakeoff size={18} /> {tr("Aller à l'aéroport")}
          </button>
        </div>
      )}
      <ul className="space-y-1.5">
        {flights.map((f) => (
          <li key={f.to} className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2.5 shadow-sm">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-extrabold">{f.toName}</span>
              <span className="block truncate text-xs font-bold text-[var(--color-ink-soft)]">{tx('{0} km · {1} de vol', { 0: f.km, 1: duration(f.game ?? f.minutes) })}</span>
            </span>
            <button className="btn !bg-[#1d4ed8] !px-3 !py-2 !text-xs" disabled={!here || small || !!sim.activity || sim.money < f.fare} onClick={() => onTravel(f.to, f.commune, tr('Vol pour {name}', { name: f.toName }), { app: 'avion' }, f.fare)}>
              {here ? tr('Embarquer') : ''} <Coin size={16} /> {amount(f.fare)}
            </button>
          </li>
        ))}
      </ul>
      {small && <p className="text-center text-xs font-bold text-[var(--color-ink-soft)]">{tr('Trop petit·e pour prendre l’avion seul·e.')}</p>}
    </div>
  )
}
