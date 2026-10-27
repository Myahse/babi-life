import { useEffect, useState } from 'react'
import { Car, Fuel, Gauge, KeyRound, MapPin, Warehouse } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import type { Garage, ParkingKind, Sim, VehicleModel, World } from '../lib/types'
import { amount } from '../game/rules'
import { topSpeed, type Driven } from '../world3d/drive'
import type { Act } from './phoneApps'

// Bolide (backend game/vehicles.go, sims/garage.go): a vélo, a moto, a car,
// new, in the colour one picks, and the place to keep it (a bike rack, a moto
// parking, a garage, bought in the commune one is in). Then « Conduire »: the
// Sim drives it in the street (world3d/drive.ts). A vehicle sells back.

type Tab = 'velo' | 'moto' | 'voiture' | 'garage'
const TABS: { id: Tab; label: string }[] = [
  { id: 'velo', label: 'Vélos' },
  { id: 'moto', label: 'Motos' },
  { id: 'voiture', label: 'Voitures' },
  { id: 'garage', label: 'Mon garage' },
]

/** A vehicle seen from the side, in its colour: the bike's frame, the moto's tank, the car's body by its model. */
export function VehicleArt({ body, color, width = 150 }: { body: string; color: string; width?: number }) {
  const wheel = (x: number, r: number, thin = false) => (
    <g key={x}>
      <circle cx={x} cy={46 - r} r={r} fill={thin ? 'none' : '#1b1b20'} stroke="#1b1b20" strokeWidth={thin ? 2.4 : 0} />
      <circle cx={x} cy={46 - r} r={r * (thin ? 0.18 : 0.45)} fill="#c3c7cf" />
    </g>
  )
  if (body === 'velo')
    return (
      <svg width={width} height={(width * 50) / 120} viewBox="0 0 120 50" aria-hidden>
        {wheel(30, 15, true)}
        {wheel(90, 15, true)}
        <path d="M30 31 L52 31 L72 14 L46 14 Z M52 31 L44 10 M72 14 L90 31 M72 14 L70 6" stroke={color} strokeWidth={4} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        <rect x={38} y={6} width={14} height={4} rx={2} fill="#1b1b20" />
        <rect x={64} y={3} width={12} height={4} rx={2} fill="#1b1b20" />
      </svg>
    )
  if (body === 'moto')
    return (
      <svg width={width} height={(width * 50) / 120} viewBox="0 0 120 50" aria-hidden>
        {wheel(26, 13)}
        {wheel(94, 13)}
        <path d="M26 33 L50 26 L84 26 L94 33" stroke="#3a3f4b" strokeWidth={5} fill="none" strokeLinecap="round" />
        <path d="M48 26 Q52 12 72 14 L84 26 Z" fill={color} />
        <rect x={30} y={17} width={26} height={7} rx={3.5} fill="#1b1b20" />
        <path d="M84 26 L90 8 L98 8" stroke="#c3c7cf" strokeWidth={3} fill="none" strokeLinecap="round" />
        <rect x={96} y={10} width={6} height={6} rx={2} fill="#fff7c2" />
      </svg>
    )
  // Cars: how long, how tall, how high off the ground.
  const [len, tall, lift] = ({ saloon: [104, 22, 0], berline: [112, 22, 0], suv: [108, 28, 3], '4x4': [110, 30, 5], limo: [118, 20, 0], cruiser: [112, 31, 5], pickup: [118, 29, 6], hyper: [108, 15, 0] } as Record<string, number[]>)[body] ?? [104, 22, 0]
  const x0 = (120 - len) / 2
  const base = 38 - lift
  const roof = base - tall
  return (
    <svg width={width} height={(width * 50) / 120} viewBox="0 0 120 50" aria-hidden>
      <path d={`M${x0} ${base} L${x0} ${base - tall * 0.45} Q${x0 + 2} ${roof + tall * 0.42} ${x0 + len * 0.2} ${roof + tall * 0.4} L${x0 + len * 0.3} ${roof} L${x0 + len * 0.72} ${roof} L${x0 + len * 0.84} ${roof + tall * 0.42} Q${x0 + len} ${roof + tall * 0.45} ${x0 + len} ${base - tall * 0.3} L${x0 + len} ${base} Z`} fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth={1} />
      <path d={`M${x0 + len * 0.33} ${roof + 3} L${x0 + len * 0.7} ${roof + 3} L${x0 + len * 0.8} ${roof + tall * 0.4} L${x0 + len * 0.26} ${roof + tall * 0.4} Z`} fill="#2b3a55" opacity={0.85} />
      <rect x={x0 + len * 0.52} y={roof + 3} width={2} height={tall * 0.37} fill={color} />
      <rect x={x0 + len - 4} y={base - tall * 0.28} width={4} height={4} rx={1} fill="#fff7c2" />
      <rect x={x0} y={base - tall * 0.28} width={3} height={4} rx={1} fill="#e03131" />
      {wheel(x0 + len * 0.2, 9 + lift / 2)}
      {wheel(x0 + len * 0.8, 9 + lift / 2)}
    </svg>
  )
}

export function BolideApp({ world, sim, act, onDrive }: { world: World; sim: Sim; act: Act; /** « Conduire »: the phone put away, the Sim at the wheel. */ onDrive: (v: Driven) => void }) {
  const [tab, setTab] = useState<Tab>('moto')
  const [garage, setGarage] = useState<Garage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [colors, setColors] = useState<Record<string, string>>({})
  const load = () =>
    api
      .garage(sim.id)
      .then(setGarage)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Pas de réseau'))
  useEffect(() => void load(), [sim.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const done = (p: Promise<boolean>) => p.then((ok) => ok && void load())
  const models = world.vehicles ?? []
  const kinds = world.parkings ?? []
  const communeName = (city: string, commune: string) => world.cities.find((c) => c.id === city)?.communes.find((c) => c.id === commune)?.name ?? commune
  const here = communeName(sim.city, sim.commune)
  /** A place with room for a kind of vehicle (in any commune), and the place to buy if there's none. */
  const roomFor = (kind: VehicleModel['kind']) =>
    garage?.parkings.some((p) => {
      const k = kinds.find((x) => x.id === p.kind)
      return k?.for === kind && p.used < k.slots
    }) ?? false
  const buyParking = (k: ParkingKind) => done(act(`${k.name} à ${here}`, 'warehouse', 'transport', () => api.garageAct(sim.id, 'parking', { kind: k.id })))

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-2xl bg-gradient-to-br from-[#ff5c5c] to-[#b3121f] p-3 text-white">
        <Gauge size={28} strokeWidth={2.4} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="font-display text-[19px] font-extrabold">Bolide</div>
          <div className="text-[12px] font-bold text-white/85">Ton vélo, ta moto, ta voiture</div>
        </div>
        <div className="text-right text-[12px] font-extrabold">
          <div className="text-white/75">Ton solde</div>
          {amount(sim.money)}
        </div>
      </div>
      <div className="segmented grid grid-cols-4">
        {TABS.map((t) => (
          <button key={t.id} aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {error && <p className="text-sm font-bold text-[var(--color-rose)]">{error}</p>}

      {tab !== 'garage' &&
        models
          .filter((m) => m.kind === tab)
          .map((m) => {
            const color = colors[m.id] ?? m.colors[0]
            const parking = kinds.find((k) => k.for === m.kind)
            const room = roomFor(m.kind)
            return (
              <div key={m.id} className="card overflow-hidden">
                <div className="grid place-items-center bg-gradient-to-b from-[#eef2fb] to-[#dfe5f2] py-3">
                  <VehicleArt body={m.body} color={color} width={190} />
                </div>
                <div className="p-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-[17px] leading-tight font-extrabold">{m.name}</div>
                      <div className="mt-0.5 flex flex-wrap gap-x-3 text-[12px] font-extrabold text-[var(--color-ink-soft)]">
                        <span className="flex items-center gap-1">
                          <Gauge size={13} /> {m.topSpeed} km/h
                        </span>
                        <span className="flex items-center gap-1">
                          <Fuel size={13} /> {m.fuelPerKm ? `${m.fuelPerKm} Djai/km` : 'Rien : tes jambes'}
                        </span>
                      </div>
                    </div>
                    <div className="font-display text-[16px] font-extrabold whitespace-nowrap">{amount(m.price)}</div>
                  </div>
                  <p className="mt-1.5 text-[13px] leading-snug font-bold text-[var(--color-ink-soft)]">{m.about}</p>
                  {/* The colour */}
                  <div className="mt-2 flex gap-2">
                    {m.colors.map((c) => (
                      <button key={c} className={`h-7 w-7 rounded-full ring-offset-2 ${c === color ? 'ring-2 ring-[var(--color-ink)]' : 'ring-1 ring-black/15'}`} style={{ background: c }} onClick={() => setColors({ ...colors, [m.id]: c })} aria-label="Couleur" />
                    ))}
                  </div>
                  {room ? (
                    <button className="btn mt-3 w-full !py-2.5 !text-sm" disabled={sim.money < m.price} onClick={() => done(act(m.name, 'car', 'transport', () => api.garageAct(sim.id, 'buy', { model: m.id, color })))}>
                      <KeyRound size={16} /> Acheter · {amount(m.price)}
                    </button>
                  ) : (
                    parking && (
                      <div className="mt-3 rounded-2xl bg-[var(--color-canvas)] p-2.5">
                        <div className="text-[13px] leading-snug font-extrabold">Il te faut d'abord une place où le garder.</div>
                        <div className="text-[12px] font-bold text-[var(--color-ink-soft)]">
                          {parking.name} à {here} : {parking.slots} places. {parking.about}
                        </div>
                        <button className="btn btn-soft mt-2 w-full !py-2 !text-sm" disabled={sim.money < parking.price} onClick={() => buyParking(parking)}>
                          <Warehouse size={16} /> {parking.name} · {amount(parking.price)}
                        </button>
                      </div>
                    )
                  )}
                </div>
              </div>
            )
          })}

      {tab === 'garage' && garage && (
        <>
          <div className="label">Mes véhicules</div>
          {!garage.vehicles.length && <p className="text-sm font-bold text-[var(--color-ink-soft)]">Pas encore de véhicule : choisis un vélo, une moto ou une voiture.</p>}
          {garage.vehicles.map((v) => {
            const m = models.find((x) => x.id === v.model)
            const p = garage.parkings.find((x) => x.id === v.parking)
            if (!m) return null
            return (
              <div key={v.id} className="card flex items-center gap-3 p-3">
                <div className="shrink-0 rounded-xl bg-[var(--color-canvas)] p-1">
                  <VehicleArt body={m.body} color={v.color} width={84} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-[15px] font-extrabold">{m.name}</div>
                  <div className="flex items-center gap-1 text-[12px] font-bold text-[var(--color-ink-soft)]">
                    <MapPin size={12} /> {p ? `${kinds.find((k) => k.id === p.kind)?.name} à ${communeName(p.city, p.commune)}` : 'Dans la rue'} · {v.km.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km
                  </div>
                  <div className="mt-1.5 flex gap-1.5">
                    <button className="btn !px-3 !py-1.5 !text-xs" disabled={!!sim.activity} onClick={() => onDrive({ id: v.id, kind: m.kind, body: m.body, color: v.color, name: m.name, top: topSpeed(m.topSpeed) })}>
                      <Car size={14} /> Conduire
                    </button>
                    <button className="btn btn-soft !px-3 !py-1.5 !text-xs" onClick={() => done(act(`Revendre ${m.name}`, 'banknote', 'transport', () => api.garageAct(sim.id, 'sell', { vehicle: v.id })))}>
                      Revendre · {amount(Math.round((m.price * 0.6) / 1000) * 1000)}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
          <div className="label pt-1">Mes places</div>
          {garage.parkings.map((p) => {
            const k = kinds.find((x) => x.id === p.kind)
            return (
              <div key={p.id} className="flex items-center gap-2 rounded-2xl bg-[var(--color-canvas)] px-3 py-2 text-[13px] font-extrabold">
                <Warehouse size={16} className="text-[var(--color-orange)]" />
                <span className="min-w-0 flex-1 truncate">
                  {k?.name} à {communeName(p.city, p.commune)}
                </span>
                <span className="text-[var(--color-ink-soft)]">
                  {p.used} / {k?.slots}
                </span>
              </div>
            )
          })}
          <div className="label pt-1">Une place de plus, ici à {here}</div>
          {kinds.map((k) => (
            <button key={k.id} className="card flex w-full items-center gap-3 p-3 text-left" disabled={sim.money < k.price} onClick={() => buyParking(k)}>
              <Warehouse size={22} className="shrink-0 text-[var(--color-orange)]" />
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[15px] font-extrabold">
                  {k.name} · {k.slots} places
                </span>
                <span className="block text-[12px] leading-snug font-bold text-[var(--color-ink-soft)]">{k.about}</span>
              </span>
              <span className="font-display text-[14px] font-extrabold whitespace-nowrap">{amount(k.price)}</span>
            </button>
          ))}
        </>
      )}
    </div>
  )
}
