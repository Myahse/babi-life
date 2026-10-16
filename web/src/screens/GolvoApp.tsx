import { useState } from 'react'
import { Bike, ChevronLeft, Clock3, MapPin, PhoneCall } from 'lucide-react'
import type { Commune, Dish, Place, Sim, World } from '../lib/types'
import { amount, openAt, openingLabel } from '../game/rules'
import { routeIn } from '../game/roads'
import { iconFor } from '../components/icons'
import { IconTile } from '../components/ui'

/** A Golvo order on its way. */
export type Delivery = { place: Place; commune: Commune; dish: Dish; fee: number; minutes: number; courier: string; start: number; lost: number; stage: 'kitchen' | 'road' | 'here' }

export const DELIVERY_SECONDS_PER_MIN = 3 // the courier's minutes go by quickly
const COURIERS = ['Ibrahim', 'Seydou', 'Junior', 'Lassina', 'Fabrice', 'Arouna', 'Koné', 'Ange']

// Mirrors world.DeliveryQuote.
export function deliveryQuote(world: World, from: string, to: string) {
  const km = from === to ? 1.5 : (routeIn(world, 'abidjan', from, to)?.km ?? 10)
  return { fee: 500 + 100 * Math.max(0, Math.floor(km) - 3), minutes: 6 + Math.round(km * 0.5) }
}

export function newDelivery(world: World, sim: Sim, place: Place, commune: Commune, dish: Dish): Delivery {
  const q = deliveryQuote(world, commune.id, sim.commune)
  // Sometimes the courier gets lost and calls for the way.
  const lost = Math.random() < 0.15 ? 3 : 0
  return { place, commune, dish, ...q, courier: COURIERS[Math.floor(Math.random() * COURIERS.length)], start: Date.now(), lost, stage: 'kitchen' }
}

/** Seconds left, and what's happening, for a delivery at time now. */
export function deliveryState(d: Delivery, now: number) {
  const total = (d.minutes + d.lost) * DELIVERY_SECONDS_PER_MIN
  const gone = (now - d.start) / 1000
  const left = Math.max(0, total - gone)
  const stage: Delivery['stage'] = left <= 0 ? 'here' : gone < total * 0.3 ? 'kitchen' : 'road'
  const lostNow = d.lost > 0 && stage === 'road' && gone < total * 0.6
  return { left, stage, progress: Math.min(1, gone / total), lostNow, minutesLeft: Math.max(1, Math.ceil(left / DELIVERY_SECONDS_PER_MIN)) }
}

/**
 * Golvo, the game's food delivery (modelled on Glovo): the maquis, restaurants
 * and clubs of Abidjan, their menus, and a courier on a moto.
 */
export function GolvoApp({ world, sim, delivery, onOrder, onCancel, onCollect }: { world: World; sim: Sim; delivery: Delivery | null; onOrder: (d: Delivery) => void; onCancel: () => void; onCollect: () => void }) {
  const [shop, setShop] = useState<{ place: Place; commune: Commune } | null>(null)
  const abidjan = world.cities.find((c) => c.id === 'abidjan')!
  const shops = abidjan.communes
    .flatMap((c) => c.places.filter((p) => world.menus?.[p.kind] && !p.closed).map((p) => ({ place: p, commune: c, q: deliveryQuote(world, c.id, sim.commune) })))
    .sort((a, b) => a.q.minutes - b.q.minutes)
  const dishOpen = (d: Dish) => openAt({ id: d.id, label: d.label, icon: d.icon, minutes: d.minutes, cost: d.price, effect: {}, minHour: d.minHour, maxHour: d.maxHour } as never, sim.gameMinutes)

  if (sim.city !== 'abidjan') return <p className="p-3 text-sm font-bold text-[var(--color-ink-soft)]">Golvo ne livre qu'à Abidjan.</p>

  if (delivery) {
    const st = deliveryState(delivery, Date.now())
    return (
      <div className="space-y-3">
        <Header />
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[var(--color-line)]">
          <div className="label">{delivery.place.name}</div>
          <div className="font-display text-xl leading-tight font-extrabold">{delivery.dish.label}</div>
          <div className="mt-3 text-sm font-extrabold">
            {st.stage === 'kitchen' ? 'En cuisine…' : st.stage === 'here' ? `${delivery.courier} est là !` : `${delivery.courier} arrive à moto · ${st.minutesLeft} min`}
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--color-canvas)]">
            <div className="h-full rounded-full bg-[#ffb703] transition-[width] duration-1000 ease-linear" style={{ width: `${st.progress * 100}%` }} />
          </div>
          {st.lostNow && (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-[#fff4d6] p-2.5 text-sm font-bold">
              <PhoneCall size={16} className="mt-0.5 shrink-0" /> {delivery.courier} t'appelle : « Je suis à {delivery.commune.id === sim.commune ? 'côté' : sim.commune === 'yopougon' ? 'Siporex' : 'la mairie'}, c'est où exactement chez toi ? »
            </div>
          )}
        </div>
        {st.stage === 'here' ? (
          <button className="btn btn-emerald w-full" disabled={!!sim.activity} onClick={onCollect}>
            {sim.activity ? 'Ton perso est occupé·e' : `Récupérer et manger · ${amount(delivery.dish.price + delivery.fee)} F`}
          </button>
        ) : (
          st.stage === 'kitchen' && (
            <button className="btn btn-soft w-full" onClick={onCancel}>
              Annuler la commande
            </button>
          )
        )}
        <p className="text-xs font-bold text-[var(--color-ink-soft)]">Tu paies à la livraison : {amount(delivery.dish.price)} F + {amount(delivery.fee)} F de livraison.</p>
      </div>
    )
  }

  if (shop) {
    const q = deliveryQuote(world, shop.commune.id, sim.commune)
    return (
      <div className="space-y-3">
        <button className="flex items-center gap-1 text-sm font-extrabold text-[#0b6e4f]" onClick={() => setShop(null)}>
          <ChevronLeft size={16} /> Restaurants
        </button>
        <div>
          <div className="font-display text-2xl leading-tight font-extrabold">{shop.place.name}</div>
          <div className="text-xs font-bold text-[var(--color-ink-soft)]">
            {shop.commune.name} · livraison {amount(q.fee)} F · ~{q.minutes} min
          </div>
        </div>
        <ul className="space-y-2">
          {(world.menus?.[shop.place.kind] ?? []).map((d) => {
            const open = dishOpen(d)
            const total = d.price + q.fee
            return (
              <li key={d.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-[var(--color-line)]">
                <IconTile icon={iconFor(d.icon)} colors={['#ffd45c', '#ffb703']} size={44} style={{ color: '#0b6e4f' }} />
                <div className="min-w-0 flex-1">
                  <div className="font-extrabold leading-tight">{d.label}</div>
                  <div className="text-xs font-bold text-[var(--color-ink-soft)]">{open ? `${amount(d.price)} F` : `Fermé · ${openingLabel({ minHour: d.minHour, maxHour: d.maxHour } as never)}`}</div>
                </div>
                <button className="btn !bg-[#0b6e4f] !px-3 !py-2 !text-sm" disabled={!open || sim.money < total || !!sim.activity} onClick={() => onOrder(newDelivery(world, sim, shop.place, shop.commune, d))}>
                  {sim.money < total ? 'Trop cher' : 'Commander'}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <Header />
      <ul className="space-y-2">
        {shops.map(({ place, commune, q }) => {
          const open = (world.menus?.[place.kind] ?? []).some(dishOpen)
          return (
            <li key={place.id}>
              <button className={`flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left ring-1 ring-[var(--color-line)] active:scale-[0.99] ${open ? '' : 'opacity-55'}`} onClick={() => setShop({ place, commune })}>
                <IconTile icon={iconFor(world.kinds[place.kind]?.icon ?? 'utensils')} colors={['#ffd45c', '#ffb703']} size={44} style={{ color: '#0b6e4f' }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-extrabold leading-tight">{place.name}</div>
                  <div className="flex items-center gap-2 text-xs font-bold text-[var(--color-ink-soft)]">
                    <span className="flex items-center gap-0.5">
                      <MapPin size={11} /> {commune.name}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Clock3 size={11} /> {q.minutes} min
                    </span>
                    <span>{amount(q.fee)} F</span>
                  </div>
                </div>
                <span className={`text-[11px] font-extrabold ${open ? 'text-[#0b6e4f]' : 'text-[var(--color-ink-soft)]'}`}>{open ? 'Ouvert' : 'Fermé'}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Header() {
  return (
    <div className="rounded-2xl bg-[linear-gradient(160deg,#ffd45c,#ffb703)] p-4 text-[#0b4a35]">
      <div className="flex items-center gap-2 text-xs font-extrabold tracking-wider uppercase">
        <Bike size={14} /> Golvo
      </div>
      <div className="font-display text-2xl leading-tight font-extrabold">Les maquis livrés où tu es</div>
    </div>
  )
}
