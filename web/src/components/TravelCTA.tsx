import { useState } from 'react'
import { ArrowRight, Bus, Car, CarTaxiFront, Clock3, HandCoins } from 'lucide-react'
import type { Ride, RideApp, Sim, World } from '../lib/types'
import { amount, duration, rideQuote, trip } from '../game/rules'
import { Chip, Coin, IconTile } from './ui'

export type OnTravel = (cityId: string, communeId: string, label: string, ride?: Ride) => void

// How likely a driver takes an offer on a "propose your price" app (mirrors world.OfferChance).
const offerChance = (offer: number, quote: number) => Math.max(0, Math.min(1, (offer / quote - 0.6) / 0.4))

/**
 * "Take a taxi there": the shared taxi, or a ride-hailing app inside a city
 * (Yango at a fixed price, inDrive at the price you propose), between cities
 * the car. Time and fare on one button.
 */
export function TravelCTA({ world, sim, cityId, communeId, onTravel }: { world: World; sim: Sim; cityId: string; communeId: string; onTravel: OnTravel }) {
  const fromCity = world.cities.find((c) => c.id === sim.city)!
  const from = fromCity.communes.find((c) => c.id === sim.commune)!
  const toCity = world.cities.find((c) => c.id === cityId)!
  const to = toCity.communes.find((c) => c.id === communeId)!
  const t = trip(fromCity.id, from, toCity.id, to)
  const bus = t.mode === 'car'
  const apps = bus ? [] : (world.rideApps ?? []).filter((a) => a.cities.includes(cityId))
  const [choice, setChoice] = useState<string>('taxi')
  const app: RideApp | undefined = apps.find((a) => a.id === choice)
  const quote = rideQuote(t)
  const [offer, setOffer] = useState(() => Math.round((quote.fare * 0.85) / 100) * 100)

  const minutes = app ? quote.minutes : t.minutes
  const fare = !app ? t.fare : app.model === 'offer' ? offer : quote.fare
  const broke = sim.money < fare
  const label = bus ? `En car vers ${toCity.name}` : app ? `En ${app.name} vers ${to.name}` : `En taxi vers ${to.name}`
  const chance = app?.model === 'offer' ? offerChance(offer, quote.fare) : 1

  return (
    <div className="rounded-2xl border border-[#ffe0c2] bg-[#fff7ef] p-3">
      <div className="mb-2.5 flex items-center gap-2.5">
        <IconTile icon={bus ? Bus : app ? Car : CarTaxiFront} colors={['#ffa040', '#ff6a00']} size={40} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="font-display text-base font-extrabold">{bus ? 'Prendre le car' : app ? `Commander un ${app.name}` : 'Prendre un taxi'}</div>
          <div className="flex min-w-0 items-center gap-1 text-xs font-bold text-[var(--color-ink-soft)]">
            <span className="truncate">{from.name}</span>
            <ArrowRight size={12} strokeWidth={3} className="shrink-0" />
            <span className="truncate">{to.name}</span>
          </div>
        </div>
        <Chip>
          <Clock3 size={12} /> {duration(minutes)}
        </Chip>
      </div>

      {apps.length > 0 && (
        <div className="segmented mb-2.5" role="tablist" aria-label="Moyen de transport">
          {[{ id: 'taxi', name: 'Taxi' }, ...apps].map((a) => (
            <button key={a.id} role="tab" aria-selected={choice === a.id} onClick={() => setChoice(a.id)}>
              {a.name}
            </button>
          ))}
        </div>
      )}

      {app?.model === 'offer' && (
        <div className="mb-2.5 rounded-xl bg-white p-2.5">
          <div className="flex items-center justify-between text-xs font-extrabold">
            <span className="flex items-center gap-1 text-[var(--color-ink-soft)]">
              <HandCoins size={14} /> Ton prix
            </span>
            <span className={chance >= 0.75 ? 'text-[var(--color-emerald-deep)]' : chance >= 0.35 ? 'text-[#a35200]' : 'text-[#d81b3f]'}>
              {chance >= 0.75 ? 'Un chauffeur va accepter' : chance >= 0.35 ? 'Peut-être…' : chance > 0 ? 'Peu de chances' : 'Personne ne viendra'}
            </span>
          </div>
          <input
            type="range"
            min={Math.round((quote.fare * 0.5) / 100) * 100}
            max={Math.round((quote.fare * 1.2) / 100) * 100}
            step={100}
            value={offer}
            onChange={(e) => setOffer(Number(e.target.value))}
            className="mt-1 w-full accent-[var(--color-orange)]"
            aria-label="Prix proposé"
          />
        </div>
      )}

      <button className="btn w-full" disabled={broke || !!sim.activity} onClick={() => onTravel(cityId, communeId, label, app ? { app: app.id, offer: app.model === 'offer' ? offer : undefined } : undefined)}>
        {broke ? 'Pas assez de francs' : sim.activity ? 'Ton Sim est occupé·e' : app ? (app.model === 'offer' ? 'Proposer' : 'Commander') : 'Y aller'} · <Coin size={20} /> {amount(fare)}
      </button>
    </div>
  )
}
