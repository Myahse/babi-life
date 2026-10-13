import { useState } from 'react'
import { ArrowRight, Bus, Car, CarTaxiFront, Clock3, HandCoins } from 'lucide-react'
import type { Ride, Sim, World } from '../lib/types'
import { amount, duration, rideQuote, trip } from '../game/rules'
import { compteurQuote, inkOn, rideLook } from '../game/rides'
import { Chip, Coin, IconTile } from './ui'

export type OnTravel = (cityId: string, communeId: string, label: string, ride?: Ride) => void

// How likely a driver takes an offer on a "propose your price" app (mirrors world.OfferChance).
const offerChance = (offer: number, quote: number) => Math.max(0, Math.min(1, (offer / quote - 0.6) / 0.4))

type Choice = { id: string; name: string; color: string; trim?: string; minutes: number; fare: number; app?: 'fixed' | 'offer'; ride?: Ride }

/**
 * "Take a taxi there". In Abidjan: the woro-woro in your commune's colour, the
 * orange taxi compteur, or an app (Gnango at a fixed price, iDrive at the
 * price you propose). Between cities, the car. Time and fare on one button.
 */
export function TravelCTA({ world, sim, cityId, communeId, onTravel }: { world: World; sim: Sim; cityId: string; communeId: string; onTravel: OnTravel }) {
  const fromCity = world.cities.find((c) => c.id === sim.city)!
  const from = fromCity.communes.find((c) => c.id === sim.commune)!
  const toCity = world.cities.find((c) => c.id === cityId)!
  const to = toCity.communes.find((c) => c.id === communeId)!
  const t = trip(fromCity.id, from, toCity.id, to)
  const bus = t.mode === 'car'
  const quote = rideQuote(t)
  const [offer, setOffer] = useState(() => Math.round((quote.fare * 0.85) / 100) * 100)

  const choices: Choice[] = []
  if (bus) choices.push({ id: 'car', name: 'Car', color: '#00b86b', minutes: t.minutes, fare: t.fare })
  else {
    if (world.compteur?.cities.includes(cityId)) {
      if (from.woro && !from.woro.none) choices.push({ id: 'woro', name: 'Woro-woro', color: from.woro.color!, trim: from.woro.trim, minutes: t.minutes, fare: t.fare, ride: { app: 'woro' } })
      const q = compteurQuote(t)
      choices.push({ id: 'compteur', name: 'Compteur', color: world.compteur.color, minutes: q.minutes, fare: q.fare, ride: { app: 'compteur' } })
    } else choices.push({ id: 'taxi', name: 'Taxi', color: '#ff7a00', minutes: t.minutes, fare: t.fare })
    for (const a of world.rideApps ?? []) {
      if (!a.cities.includes(cityId)) continue
      const fare = a.model === 'offer' ? offer : quote.fare
      choices.push({ id: a.id, name: a.name, color: '#161a2b', minutes: quote.minutes, fare, app: a.model, ride: { app: a.id, offer: a.model === 'offer' ? offer : undefined } })
    }
  }
  const [pick, setPick] = useState(choices[0].id)
  const c = choices.find((x) => x.id === pick) ?? choices[0]
  const look = rideLook(world, c.id === 'taxi' ? 'taxi' : c.id, from)

  const broke = sim.money < c.fare
  const label = bus ? `En car vers ${toCity.name}` : `${look.how} vers ${to.name}`
  const chance = c.app === 'offer' ? offerChance(offer, quote.fare) : 1
  const title = bus ? 'Prendre le car' : c.app ? `Commander un ${c.name}` : c.id === 'woro' ? `Woro-woro ${from.woro?.label ?? ''}` : c.id === 'compteur' ? 'Taxi compteur' : 'Prendre un taxi'

  return (
    <div className="rounded-2xl border border-[#ffe0c2] bg-[#fff7ef] p-3">
      <div className="mb-2.5 flex items-center gap-2.5">
        <IconTile icon={bus ? Bus : c.app ? Car : CarTaxiFront} colors={[c.color, c.color]} style={{ color: inkOn(c.color), boxShadow: c.trim ? `inset 0 -7px 0 ${c.trim}` : 'inset 0 0 0 1px rgba(0,0,0,0.08)' }} size={40} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate font-display text-base font-extrabold">{title}</div>
          <div className="flex min-w-0 items-center gap-1 text-xs font-bold text-[var(--color-ink-soft)]">
            <span className="truncate">{from.name}</span>
            <ArrowRight size={12} strokeWidth={3} className="shrink-0" />
            <span className="truncate">{to.name}</span>
          </div>
        </div>
        <Chip>
          <Clock3 size={12} /> {duration(c.minutes)}
        </Chip>
      </div>

      {choices.length > 1 && (
        <div className="segmented mb-2.5" role="tablist" aria-label="Moyen de transport">
          {choices.map((x) => (
            <button key={x.id} role="tab" aria-selected={pick === x.id} aria-label={x.name} onClick={() => setPick(x.id)} className="min-w-0 !px-0.5 !py-1.5 text-[12.5px] leading-tight whitespace-nowrap">
              <span className="flex flex-col items-center justify-center gap-1">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/15" style={{ background: x.trim ? `linear-gradient(${x.color} 55%, ${x.trim} 55%)` : x.color }} />
                <span className="truncate">{x.id === 'woro' ? 'Woro' : x.name}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {c.id === 'woro' && <p className="mb-2.5 text-xs font-bold text-[var(--color-ink-soft)]">Le taxi communal de {from.name}, partagé : le moins cher.</p>}
      {c.id === 'compteur' && <p className="mb-2.5 text-xs font-bold text-[var(--color-ink-soft)]">{from.woro?.none ? `Pas de woro-woro à ${from.name} : le taxi orange, payé au compteur.` : 'Le taxi orange, payé au compteur, rien que pour toi.'}</p>}

      {c.app === 'offer' && (
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

      <button className="btn w-full" disabled={broke || !!sim.activity} onClick={() => onTravel(cityId, communeId, label, c.ride)}>
        {broke ? 'Pas assez de francs' : sim.activity ? 'Ton Sim est occupé·e' : c.app ? (c.app === 'offer' ? 'Proposer' : 'Commander') : bus ? 'Y aller' : 'Appeler'} · <Coin size={20} /> {amount(c.fare)}
      </button>
    </div>
  )
}
