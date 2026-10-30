import { useEffect, useState } from 'react'
import { ArrowRight, Bike, Bus, Car, CarTaxiFront, Clock3, Hand, HandCoins, Minus, Plane, Plus, TrainFront, UserRound } from 'lucide-react'
import type { Ride, Sim, StreetRide, World } from '../lib/types'
import { actionLength, ageOf, amount, duration, rideQuote, trip } from '../game/rules'
import { discounted, fareOff, PUBLIC_RIDES } from '../lib/civic'
import { classFare, compteurQuote, GBAKA, gbakaQuote, inkOn, METRO, metroQuote, MOTO, motoQuote } from '../game/rides'
import { keyOpen, useFeatures } from '../lib/features'
import { Chip, Coin, IconTile } from './ui'
import { aCommune } from '../lib/french'
import { api } from '../lib/api'
import { driving } from '../world3d/drive'
import { t as tr, tx, locale } from '../lib/i18n'
import { airportOf, clockLabel, coachCompany, coachTo, flightTo, gareOf, nextCoach, TRAVEL_KEY } from '../game/voyages'

/** fare: the price shown (per seat at the roadside, the quote for an app). */
export type OnTravel = (cityId: string, communeId: string, label: string, ride?: Ride, fare?: number) => void

// How likely a driver takes an offer on a "propose your price" app (mirrors world.OfferChance).
const offerChance = (offer: number, quote: number) => Math.max(0, Math.min(1, (offer / quote - 0.6) / 0.4))

type Choice = { id: string; name: string; colors: string[]; minutes: number; fare: number; app?: 'fixed' | 'offer'; classes?: boolean; /** Waited for at the roadside: which one the player wants. */ street?: StreetRide; /** One of the Sim's own vehicles, driven there. */ own?: { id: number; kind: 'velo' | 'moto' | 'voiture'; name: string } }

/**
 * "Go there", and how. In Abidjan, the player chooses: the woro-woro (your
 * commune's colour, a seat each), the taxi compteur (orange, the whole car),
 * the gbaka (the cheapest, the slowest, squeezed in), each waited for at the
 * roadside; the moto-taxi (the quickest, one behind the driver), straight
 * away; or an app (Gnango at a fixed price, iDrive at the price you propose).
 * Elsewhere the town's taxi or a moto-taxi, and between cities the car. With
 * the update « voyages-villes », between cities: the coach from the gare
 * routière at its next departure, or the plane from the airport (to get there
 * first, the ride across town).
 * Shows the way (bridges included), time and fare.
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

  const gbaka = gbakaQuote(t)
  // The métro (line 1), once its update is open: between two communes with a station.
  const feats = useFeatures()
  const metro = keyOpen(feats, 'metro') && fromCity.id === cityId ? metroQuote(world, cityId, from.id, to.id) : null
  const moto = motoQuote(t)
  // Between cities, « voyages-villes » open: the coach from the gare at its hour, the plane from the airport.
  const voyages = bus && keyOpen(feats, TRAVEL_KEY)
  const coach = voyages ? coachTo(world, fromCity.id, cityId) : null
  const flight = voyages ? flightTo(world, fromCity.id, cityId, (k) => keyOpen(feats, k)) : null
  const company = coachCompany(world, coach?.company)
  const departs = coach ? nextCoach(coach, sim.gameMinutes) : null
  const choices: Choice[] = []
  // One's own vehicles first (the Bolide app): driven there, only the petrol to pay (and the 3e pont's
  // toll in a car), a little quicker than a taxi; the bike only in town.
  const [garage, setGarage] = useState<{ id: number; model: string; color: string }[]>([])
  useEffect(() => {
    if (!sim.apps?.includes('bolide')) return
    let live = true
    api.garage(sim.id).then((g) => live && setGarage(g.vehicles), () => undefined)
    return () => void (live = false)
  }, [sim.id, sim.apps])
  for (const v of garage) {
    const m = world.vehicles?.find((x) => x.id === v.model)
    if (!m || (m.kind === 'velo' && bus)) continue
    const fuel = m.fuelPerKm ? Math.ceil(((t.path?.km ?? 0) * m.fuelPerKm) / 25) * 25 : 0
    choices.push({ id: `own:${v.id}`, name: m.name.split(' ')[0], colors: [v.color], minutes: Math.max(1, Math.round((t.minutes * 4) / 5)), fare: fuel + (m.kind === 'voiture' ? (t.toll ?? 0) : 0), own: { id: v.id, kind: m.kind, name: m.name } })
  }
  if (voyages) {
    if (coach) choices.push({ id: 'car', name: tr('Car'), colors: [company.body, company.stripe], minutes: coach.minutes, fare: coach.fare })
    if (flight) choices.push({ id: 'avion', name: tr('Avion'), colors: ['#1d4ed8'], minutes: flight.minutes, fare: flight.fare })
  } else if (bus) choices.push({ id: 'car', name: tr('Car'), colors: ['#00b86b'], minutes: t.minutes, fare: t.fare })
  else {
    if (world.compteur?.cities.includes(cityId)) {
      if (woro) choices.push({ id: 'woro', name: tr('Woro'), colors: [woro.color!], minutes: t.minutes, fare: t.fare * party, street: 'woro' })
      choices.push({ id: 'compteur', name: tr('Taxi'), colors: [world.compteur.color], minutes: meter.minutes, fare: meter.fare, street: 'compteur' })
      choices.push({ id: 'gbaka', name: tr('Gbaka'), colors: [GBAKA], minutes: gbaka.minutes, fare: gbaka.fare * party, street: 'gbaka' })
    } else choices.push({ id: 'taxi', name: tr('Taxi'), colors: ['#ff7a00'], minutes: t.minutes, fare: t.fare })
    if (metro) choices.push({ id: 'metro', name: tr('Métro'), colors: [METRO], minutes: metro.minutes, fare: metro.fare * party })
    choices.push({ id: 'moto', name: tr('Moto'), colors: [MOTO], minutes: moto.minutes, fare: moto.fare })
    for (const a of world.rideApps ?? []) {
      if (!a.cities.includes(cityId) || !sim.apps?.includes(a.id)) continue
      // An app with kinds of car: the cheapest here, the choice in the app.
      choices.push({ id: a.id, name: a.name, colors: ['#161a2b'], minutes: quote.minutes, fare: a.model === 'offer' ? offer : classFare(quote.fare, a.classes?.[0]), app: a.model, classes: !!a.classes?.length })
    }
  }
  // The president's « transport » measure: the public transport at half price (lib/civic.ts).
  const off = fareOff(world, sim)
  if (off) for (const c of choices) if (PUBLIC_RIDES.has(c.id)) c.fare = discounted(c.fare, off)
  const [pick, setPick] = useState(choices[0].id)
  // One's own vehicle chosen first, once the garage is known (the one at the wheel, if driving), unless another was picked.
  const [chose, setChose] = useState(false)
  useEffect(() => {
    if (chose) return
    const own = choices.find((x) => x.own && x.own.id === driving()?.id) ?? choices.find((x) => x.own)
    if (own) setPick(own.id)
  }, [garage]) // eslint-disable-line react-hooks/exhaustive-deps
  const c = choices.find((x) => x.id === pick) ?? choices[0]
  // The coach and the plane leave from the gare and the airport: not there, the way there first.
  const base = voyages && (c.id === 'car' || c.id === 'avion') ? (c.id === 'car' ? gareOf(world, fromCity.id) : airportOf(world, fromCity.id)) : null
  const away = !!base && base.commune.id !== sim.commune
  const noCoach = voyages && c.id === 'car' && departs === null

  // Ride apps that would work here but aren't on the phone yet.
  const missing = bus ? [] : (world.rideApps ?? []).filter((a) => a.cities.includes(cityId) && !sim.apps?.includes(a.id)).map((a) => a.name)
  // Babies and children don't take the road alone.
  const small = (() => {
    const age = ageOf(world, sim.bornAt ?? 0, sim.gameMinutes)
    return age < 12
  })()
  const broke = sim.money < c.fare
  const chance = c.app === 'offer' ? offerChance(offer, quote.fare) : 1
  const title = c.own ? tr('Y aller en {name}', { name: c.own.name }) : c.id === 'avion' ? tr("Prendre l'avion") : bus ? tr('Prendre le car') : c.app ? tr('Commander un {name}', { name: c.name }) : c.street === 'woro' ? tr('Prendre le woro-woro') : c.street === 'gbaka' ? tr('Prendre le gbaka') : c.id === 'moto' ? tr('Prendre un moto-taxi') : c.id === 'metro' ? tr('Prendre le métro') : tr('Prendre un taxi')
  const color = c.colors[0]
  const go = () => {
    if (c.own) return onTravel(cityId, communeId, tr('En {name} vers {name2}', { name: c.own.name, name2: to.name }), { vehicle: c.own.id, party: c.own.kind === 'voiture' ? party : 1 }, c.fare)
    if (voyages && c.id === 'car' && coach) return onTravel(cityId, coach.commune, tr('En car vers {name}', { name: toCity.name }), { app: 'car' }, c.fare)
    if (voyages && c.id === 'avion' && flight) return onTravel(cityId, flight.commune, tr('Vol pour {name}', { name: toCity.name }), { app: 'avion' }, c.fare)
    if (bus || c.id === 'taxi') return onTravel(cityId, communeId, bus ? tr('En car vers {name}', { name: toCity.name }) : tr('En taxi vers {name}', { name: to.name }))
    // At the roadside, its fare is worked out from a woro-woro seat (RideFlow).
    if (c.street) return onTravel(cityId, communeId, tr('Vers {name}', { name: to.name }), { app: `street:${c.street}`, party }, t.fare)
    if (c.id === 'metro') return onTravel(cityId, communeId, tr('En métro vers {name}', { name: to.name }), { app: 'metro', party }, c.fare)
    if (c.id === 'moto') return onTravel(cityId, communeId, tr('En moto-taxi vers {name}', { name: to.name }), { app: 'moto' }, moto.fare)
    onTravel(cityId, communeId, tr('En {name} vers {name2}', { name: c.name, name2: to.name }), { app: c.id, offer: c.app === 'offer' ? offer : undefined, party }, quote.fare)
  }

  return (
    <div className="rounded-2xl border border-[#ffe0c2] bg-[#fff7ef] p-3">
      <div className="mb-2 flex items-center gap-2.5">
        <IconTile icon={c.own ? (c.own.kind === 'voiture' ? Car : Bike) : c.id === 'avion' ? Plane : bus || c.street === 'gbaka' ? Bus : c.id === 'moto' ? Bike : c.id === 'metro' ? TrainFront : c.app ? Car : c.street ? Hand : CarTaxiFront} colors={[color, color]} style={{ color: inkOn(color), boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)' }} size={40} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate font-display text-base font-extrabold">{title}</div>
          <div className="flex min-w-0 items-center gap-1 text-xs font-bold text-[var(--color-ink-soft)]">
            <span className="truncate">{from.name}</span>
            <ArrowRight size={12} strokeWidth={3} className="shrink-0" />
            <span className="truncate">{to.name}</span>
          </div>
        </div>
        <Chip>
          <Clock3 size={12} /> {duration(actionLength(c.minutes))}
        </Chip>
      </div>

      {t.path && (
        <p className="mb-2 text-xs font-bold text-[var(--color-ink-soft)]">
          {tx('{0} km{1}{2}', { 0: t.path.km.toLocaleString(locale()), 1: t.path.bridges.length ? tr(' · par le {0}', { 0: t.path.bridges.join(tr(' puis le ')) }) : '', 2: t.toll ? tr(' · péage {0} Djai compris', { 0: amount(t.toll) }) : '' })}
        </p>
      )}

      {choices.length > 1 && (
        <div className="segmented mb-2.5" role="tablist" aria-label={tr('Moyen de transport')}>
          {choices.map((x) => (
            <button key={x.id} role="tab" aria-selected={pick === x.id} aria-label={x.name} onClick={() => (setPick(x.id), setChose(true))} className="min-w-0 !px-0.5 !py-1.5 text-[12.5px] leading-tight whitespace-nowrap">
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

      {voyages && (c.id === 'car' || c.id === 'avion') && (
        <p className="mb-2.5 text-xs font-bold text-[var(--color-ink-soft)]">
          {c.id === 'car' && coach
            ? departs === null
              ? tx("Plus de car aujourd'hui : le premier part à {0}.", { 0: clockLabel(coach.first) })
              : tx('{0} · départ à {1} · {2} km de route, arrivée à la gare routière.', { 0: company.name, 1: clockLabel(departs), 2: coach.km.toLocaleString(locale()) })
            : flight
              ? tx("{0} · {1} km à vol d'oiseau, atterrissage à l'aéroport.", { 0: flight.airline, 1: flight.km.toLocaleString(locale()) })
              : null}
        </p>
      )}
      {away && base && (
        <div className="mb-2.5">
          <p className="mb-2 text-xs font-bold text-[var(--color-ink-soft)]">{c.id === 'car' ? tx("Les cars partent de la {0}, {1} : vas-y d'abord.", { 0: base.place.name, 1: aCommune(base.commune.name) }) : tx("Les vols partent de l'{0}, {1} : vas-y d'abord.", { 0: base.place.name, 1: aCommune(base.commune.name) })}</p>
          <TravelCTA world={world} sim={sim} cityId={fromCity.id} communeId={base.commune.id} onTravel={onTravel} />
        </div>
      )}

      {missing.length > 0 && <p className="mb-2 text-[11px] font-bold text-[var(--color-ink-soft)]">{missing.join(tr(' et '))} {tr(': à installer depuis le Store du téléphone.')}</p>}

      {c.own && (
        <p className="mb-2.5 text-xs font-bold text-[var(--color-ink-soft)]">
          {tx("Tu conduis : pas de course à payer, seulement l'essence{0} ({1} Djai). À l'arrivée, tu es au volant : le GPS t'emmène où tu veux.", { 0: c.own.kind === 'voiture' && t.toll ? tr(' et le péage') : '', 1: amount(c.fare) })}
        </p>
      )}
      {(c.street || c.id === 'moto') && (
        <p className="mb-2.5 text-xs font-bold text-[var(--color-ink-soft)]">
          {c.street === 'woro'
            ? tr("Attends au bord de la route le woro-woro {0} : {1} Djai la place, s'il va {2} et a de la place.", { 0: woro?.label ?? '', 1: amount(t.fare), 2: aCommune(to.name) })
            : c.street === 'gbaka'
              ? tr("Attends le gbaka au bord de la route : l'apprenti crie où il va. {0} Djai la place, on se serre, il s'arrête souvent.", { 0: amount(gbaka.fare) })
              : c.street === 'compteur'
                ? tr("Fais signe à un taxi compteur libre (~{0} Djai la course) : il t'emmène tout droit.", { 0: amount(meter.fare) })
                : tr("Un moto-taxi t'emmène tout de suite : le plus rapide entre les voitures, une seule personne derrière.")}
        </p>
      )}

      {c.app === 'offer' && (
        <div className="mb-2.5 rounded-xl bg-white p-2.5">
          <div className="flex items-center justify-between text-xs font-extrabold">
            <span className="flex items-center gap-1 text-[var(--color-ink-soft)]">
              <HandCoins size={14} /> {tr('Ton prix')}
            </span>
            <span className={chance >= 0.75 ? 'text-[var(--color-emerald-deep)]' : chance >= 0.35 ? 'text-[#a35200]' : 'text-[#d81b3f]'}>
              {chance >= 0.75 ? tr('Un chauffeur va accepter') : chance >= 0.35 ? tr('Peut-être…') : chance > 0 ? tr('Peu de chances') : tr('Personne ne viendra')}
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
            aria-label={tr('Prix proposé')}
          />
        </div>
      )}

      {!bus && c.id !== 'taxi' && c.id !== 'moto' && (!c.own || c.own.kind === 'voiture') && (
        <div className="mb-2.5 flex items-center gap-2 text-xs font-extrabold text-[var(--color-ink-soft)]">
          <UserRound size={14} /> {tr('Vous êtes')}
          <button className="icon-btn h-7 w-7 bg-white" onClick={() => setParty(Math.max(1, party - 1))} disabled={party <= 1} aria-label={tr('Un de moins')}>
            <Minus size={14} />
          </button>
          <span className="w-4 text-center text-sm text-[var(--color-ink)] tabular-nums">{party}</span>
          <button className="icon-btn h-7 w-7 bg-white" onClick={() => setParty(Math.min(4, party + 1))} disabled={party >= 4} aria-label={tr('Un de plus')}>
            <Plus size={14} />
          </button>
          <span className="ml-auto text-[11px]">{c.street === 'woro' || c.street === 'gbaka' ? tr('une place chacun') : tr('une seule course')}</span>
        </div>
      )}

      {!away && <button className="btn w-full" disabled={small || broke || !!sim.activity || chance <= 0 || noCoach} onClick={go}>
        {small ? tr('Trop petit·e pour y aller seul·e') : broke ? tr('Pas assez de francs') : sim.activity ? tr('Ton perso est occupé·e') : noCoach ? tr('Plus de car ce soir') : c.own ? tr('Prendre le volant') : voyages && c.id === 'avion' ? tr('Embarquer') : voyages && c.id === 'car' ? tr('Acheter le billet') : c.street ? tr('Aller au bord de la route') : c.classes ? tr('Ouvrir {name}', { name: c.name }) : c.app ? (c.app === 'offer' ? tr('Proposer') : tr('Commander')) : tr('Y aller')}
        {!c.street && (
          <>
            {' '}
            · {c.classes ? tr('dès ') : ''}
            <Coin size={20} /> {amount(c.fare)}
          </>
        )}
      </button>}
    </div>
  )
}
