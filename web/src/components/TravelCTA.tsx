import { ArrowRight, Bus, CarTaxiFront, Clock3 } from 'lucide-react'
import type { Sim, World } from '../lib/types'
import { amount, duration, trip } from '../game/rules'
import { Chip, Coin, IconTile } from './ui'

export type OnTravel = (cityId: string, communeId: string, label: string) => void

/** "Take a taxi there": the ride, its time and its fare, in one button. */
export function TravelCTA({ world, sim, cityId, communeId, onTravel }: { world: World; sim: Sim; cityId: string; communeId: string; onTravel: OnTravel }) {
  const fromCity = world.cities.find((c) => c.id === sim.city)!
  const from = fromCity.communes.find((c) => c.id === sim.commune)!
  const toCity = world.cities.find((c) => c.id === cityId)!
  const to = toCity.communes.find((c) => c.id === communeId)!
  const t = trip(fromCity.id, from, toCity.id, to)
  const bus = t.mode === 'car'
  const label = bus ? `En car vers ${toCity.name}` : `En taxi vers ${to.name}`
  const broke = sim.money < t.fare
  return (
    <div className="rounded-2xl border border-[#ffe0c2] bg-[#fff7ef] p-3">
      <div className="mb-2.5 flex items-center gap-2.5">
        <IconTile icon={bus ? Bus : CarTaxiFront} colors={['#ffa040', '#ff6a00']} size={40} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="font-display text-base font-extrabold">{bus ? 'Prendre le car' : 'Prendre un taxi'}</div>
          <div className="flex min-w-0 items-center gap-1 text-xs font-bold text-[var(--color-ink-soft)]">
            <span className="truncate">{from.name}</span>
            <ArrowRight size={12} strokeWidth={3} className="shrink-0" />
            <span className="truncate">{to.name}</span>
          </div>
        </div>
        <Chip>
          <Clock3 size={12} /> {duration(t.minutes)}
        </Chip>
      </div>
      <button className="btn w-full" disabled={broke || !!sim.activity} onClick={() => onTravel(cityId, communeId, label)}>
        {broke ? 'Pas assez de francs' : sim.activity ? 'Ton Sim est occupé·e' : 'Y aller'} · <Coin size={20} /> {amount(t.fare)}
      </button>
    </div>
  )
}
