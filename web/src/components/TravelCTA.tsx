import { useState } from 'react'
import { ArrowRight, Bus, Car, CarTaxiFront, Clock3, Hand, HandCoins, Minus, Plus, UserRound } from 'lucide-react'
import type { Ride, Sim, World } from '../lib/types'
import { amount, duration, rideQuote, trip } from '../game/rules'
import { compteurQuote, inkOn } from '../game/rides'
import { Chip, Coin, IconTile } from './ui'

/** fare: the price shown (per seat at the roadside, the quote for an app). */
export type OnTravel = (cityId: string, communeId: string, label: string, ride?: Ride, fare?: number) => void

// How likely a driver takes an offer on a "propose your price" app (mirrors world.OfferChance).
const offerChance = (offer: number, quote: number) => Math.max(0, Math.min(1, (offer / quote - 0.6) / 0.4))

type Choice = { id: string; name: string; colors: string[]; minutes: number; fare: number; app?: 'fixed' | 'offer' }

/**
 * "Go there". In Abidjan: wait at the roadside for a woro-woro (your
 * commune's colour) or a taxi compteur (orange), or book an app (Gnango at a
 * fixed price, iDrive at the price you propose). Elsewhere the town's taxi,
 * and between cities the car. Shows the way (bridges included), time and fare.
 */
export function TravelCTA({ world, sim, cityId, communeId, onTravel }: { world: World; sim: Sim; cityId: string; communeId: string; onTravel: OnTravel }) {
  const fromCity = world.cities.find((c) => c.id === sim.city)!
  const from = fromCity.communes.find((c) => c.id === sim.commune)!
  const toCity = world.cities.find((c) => c.id === cityId)!
  const to = toCity.communes.find((c) => c.id === communeId)!
  const t = trip(fromCity.id, from, toCity.id, to, world)
  const bus = t.mode === 'car'
  const quote = rideQuote(t)
  const meter = compteurQuote(t)
  const [offer, setOffer] = useState(() => Math.round((quote.fare * 0.85) / 100) * 100)
  const [party, setParty] = useState(1)
  const woro = from.woro && !from.woro.none ? from.woro : null

  const choices: Choice[] = []
  if (bus) choices.push({ id: 'car', name: 'Car', colors: ['#00b86b'], minutes: t.minutes, fare: t.fare })
  else {
    if (world.compteur?.cities.includes(cityId)) choices.push({ id: 'street', name: 'Bord de route', colors: woro ? [woro.color!, world.compteur.color] : [world.compteur.color], minutes: woro ? t.minutes : meter.minutes, fare: woro ? t.fare * party : meter.fare })
    else choices.push({ id: 'taxi', name: 'Taxi', colors: ['#ff7a00'], minutes: t.minutes, fare: t.fare })
    for (const a of world.rideApps ?? []) {
      if (!a.cities.includes(cityId)) continue
      choices.push({ id: a.id, name: a.name, colors: ['#161a2b'], minutes: quote.minutes, fare: a.model === 'offer' ? offer : quote.fare, app: a.model })
    }
  }
  const [pick, setPick] = useState(choices[0].id)
  const c = choices.find((x) => x.id === pick) ?? choices[0]

  const broke = sim.money < c.fare
  const chance = c.app === 'offer' ? offerChance(offer, quote.fare) : 1
  const title = bus ? 'Prendre le car' : c.app ? `Commander un ${c.name}` : c.id === 'street' ? 'Héler un taxi' : 'Prendre un taxi'
  const color = c.colors[0]
  const go = () => {
    if (bus || c.id === 'taxi') return onTravel(cityId, communeId, bus ? `En car vers ${toCity.name}` : `En taxi vers ${to.name}`)
    if (c.id === 'street') return onTravel(cityId, communeId, `Vers ${to.name}`, { app: 'street', party }, t.fare)
    onTravel(cityId, communeId, `En ${c.name} vers ${to.name}`, { app: c.id, offer: c.app === 'offer' ? offer : undefined, party }, quote.fare)
  }

  return (
    <div className="rounded-2xl border border-[#ffe0c2] bg-[#fff7ef] p-3">
      <div className="mb-2 flex items-center gap-2.5">
        <IconTile icon={bus ? Bus : c.app ? Car : c.id === 'street' ? Hand : CarTaxiFront} colors={[color, color]} style={{ color: inkOn(color), boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)' }} size={40} />
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

      {t.path && (
        <p className="mb-2 text-xs font-bold text-[var(--color-ink-soft)]">
          {t.path.km.toLocaleString('fr-FR')} km{t.path.bridges.length ? ` · par le ${t.path.bridges.join(' puis le ')}` : ''}
        </p>
      )}

      {choices.length > 1 && (
        <div className="segmented mb-2.5" role="tablist" aria-label="Moyen de transport">
          {choices.map((x) => (
            <button key={x.id} role="tab" aria-selected={pick === x.id} aria-label={x.name} onClick={() => setPick(x.id)} className="min-w-0 !px-0.5 !py-1.5 text-[12.5px] leading-tight whitespace-nowrap">
              <span className="flex flex-col items-center justify-center gap-1">
                <span className="flex gap-0.5">
                  {x.colors.map((col) => (
                    <span key={col} className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/15" style={{ background: col }} />
                  ))}
                </span>
                <span className="truncate">{x.name}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {c.id === 'street' && (
        <p className="mb-2.5 text-xs font-bold text-[var(--color-ink-soft)]">
          {woro ? `Attends au bord de la route : woro-woro ${woro.label} (${amount(t.fare)} F la place, s'il va à ${to.name} et a de la place) ou taxi compteur libre (~${amount(meter.fare)} F).` : `Pas de woro-woro à ${from.name} : attends un taxi compteur libre (~${amount(meter.fare)} F).`}
        </p>
      )}

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

      {!bus && c.id !== 'taxi' && (
        <div className="mb-2.5 flex items-center gap-2 text-xs font-extrabold text-[var(--color-ink-soft)]">
          <UserRound size={14} /> Vous êtes
          <button className="icon-btn h-7 w-7 bg-white" onClick={() => setParty(Math.max(1, party - 1))} disabled={party <= 1} aria-label="Un de moins">
            <Minus size={14} />
          </button>
          <span className="w-4 text-center text-sm text-[var(--color-ink)] tabular-nums">{party}</span>
          <button className="icon-btn h-7 w-7 bg-white" onClick={() => setParty(Math.min(4, party + 1))} disabled={party >= 4} aria-label="Un de plus">
            <Plus size={14} />
          </button>
          <span className="ml-auto text-[11px]">{c.id === 'street' && woro ? 'une place chacun' : 'une seule course'}</span>
        </div>
      )}

      <button className="btn w-full" disabled={broke || !!sim.activity || chance <= 0} onClick={go}>
        {broke ? 'Pas assez de francs' : sim.activity ? 'Ton Sim est occupé·e' : c.id === 'street' ? 'Aller au bord de la route' : c.app ? (c.app === 'offer' ? 'Proposer' : 'Commander') : 'Y aller'}
        {c.id !== 'street' && (
          <>
            {' '}
            · <Coin size={20} /> {amount(c.fare)}
          </>
        )}
      </button>
    </div>
  )
}
