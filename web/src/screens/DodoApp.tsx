import { useEffect, useState } from 'react'
import { BedDouble, House, KeyRound, MapPin, Moon, Star, Users } from 'lucide-react'
import { api, ApiError, type LotWhere } from '../lib/api'
import type { DodoListing, DodoView, Interaction, Sim, World } from '../lib/types'
import { amount, duration, openAt } from '../game/rules'
import { aCommune, capital } from '../lib/french'
import { iconFor } from '../components/icons'
import { CommunePicker } from '../components/Lots'
import type { Act } from './phoneApps'

// Dodo, homes let by the night (backend game/dodo.go, sims/dodo.go): in any
// commune of any town, booked from wherever one is. The game's own hosts'
// places, and the houses players built and let; once there, the home is
// one's own for the nights booked (sleep, shower, cook, TV, friends over).
// One's other houses can be let here too: the guests' nights are paid in.

/** A listing's « photo »: painted from its seed (the walls, the roof, the sky), by kind of home. */
function Photo({ l }: { l: DodoListing }) {
  const hues = [18, 32, 190, 140, 280, 350, 45, 205]
  const h = hues[l.seed % hues.length]
  const sky = l.seed % 3 === 0 ? 'linear-gradient(180deg,#ffb27a,#ffd9a8)' : 'linear-gradient(180deg,#8fc8f2,#cfe8fa)'
  const tall = l.type === 'appart' || l.type === 'duplex'
  return (
    <div className="relative h-28 overflow-hidden rounded-2xl" style={{ background: sky }}>
      <div className="absolute inset-x-0 bottom-0 h-6" style={{ background: l.type === 'villa' ? '#4f9a46' : '#c9b08a' }} />
      {l.type === 'villa' && <div className="absolute bottom-1.5 left-4 h-3 w-16 rounded-md bg-[#38bdf8]" />}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2" style={{ width: tall ? 86 : 104, height: tall ? 72 : 46, background: `hsl(${h} 45% 82%)`, borderRadius: 6 }}>
        <div className="absolute -top-3 left-[-6px] right-[-6px] h-4 rounded-sm" style={{ background: `hsl(${h} 35% 38%)` }} />
        {[...Array(tall ? 6 : 3)].map((_, i) => (
          <div key={i} className="absolute h-3 w-4 rounded-[2px] bg-[#2b3a55]/80" style={{ left: 10 + (i % 3) * 26, top: tall ? 10 + Math.floor(i / 3) * 24 : 12 }} />
        ))}
        <div className="absolute bottom-0 left-1/2 h-5 w-4 -translate-x-1/2 rounded-t-sm" style={{ background: `hsl(${h} 35% 30%)` }} />
      </div>
      {l.full && <span className="absolute top-2 left-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-extrabold text-white">Complet ce soir</span>}
      {l.hostSim && <span className="absolute top-2 right-2 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-extrabold text-[#5b21b6]">Maison de joueur</span>}
    </div>
  )
}

export function DodoApp({ world, sim, act, onMap }: { world: World; sim: Sim; act: Act; onMap: () => void }) {
  const [where, setWhere] = useState<LotWhere>({ city: sim.city, commune: sim.commune })
  const [data, setData] = useState<DodoView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [prices, setPrices] = useState<Record<number, string>>({})
  const load = () =>
    api
      .dodo(sim.id, where)
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Pas de réseau'))
  useEffect(() => void load(), [sim.id, where.city, where.commune]) // eslint-disable-line react-hooks/exhaustive-deps
  const done = (p: Promise<boolean>) =>
    p.then((ok) => {
      if (ok) void load()
    })

  const communeOf = (city: string, commune: string) => world.cities.find((c) => c.id === city)?.communes.find((c) => c.id === commune)?.name ?? commune
  const stay = data?.stay?.kind === 'dodo' && data.stay.until > sim.gameMinutes ? data.stay : null
  const there = !!stay && sim.city === stay.city && sim.commune === stay.commune
  const doHere = (world.kinds.logement?.interactions ?? []) as Interaction[]

  if (error) return <p className="text-sm font-bold text-[#d81b3f]">{error}</p>
  if (!data) return <p className="text-sm font-bold text-[var(--color-ink-soft)]">Chargement de Dodo…</p>
  return (
    <div className="space-y-4">
      {/* The stay under way: where, till when, what to do there */}
      {stay && (
        <section className="rounded-[20px] bg-[#efe9ff] p-3">
          <div className="label mb-1 flex items-center gap-1.5 !text-[#5b21b6]">
            <KeyRound size={13} /> Ton séjour
          </div>
          <p className="font-display text-[17px] leading-tight font-extrabold">{stay.name}</p>
          <p className="mt-0.5 text-xs font-bold text-[var(--color-ink-soft)]">
            {capital(aCommune(communeOf(stay.city, stay.commune)))} · encore {duration(stay.until - sim.gameMinutes)}
          </p>
          {there ? (
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {doHere.map((it) => {
                const I = iconFor(it.icon)
                const ok = openAt(it, sim.gameMinutes) && sim.money >= it.cost && !sim.activity
                return (
                  <button key={it.id} disabled={!ok} className="flex items-center gap-2 rounded-xl bg-white px-2.5 py-2 text-left text-xs font-extrabold disabled:opacity-50" onClick={() => void act(it.label, it.icon, 'home', () => api.interact(sim.id, 'logement', it.id))}>
                    <I size={16} className="shrink-0 text-[#7c3aed]" />
                    <span className="min-w-0">
                      {it.label}
                      {it.cost ? ` · ${amount(it.cost)}` : ''}
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <button className="mt-2 w-full rounded-xl bg-[#7c3aed] py-2 text-sm font-extrabold text-white" onClick={onMap}>
              <MapPin size={14} className="mr-1 inline" /> Y aller : les clés t'attendent
            </button>
          )}
          <button className="mt-2 text-xs font-extrabold text-[#7c3aed]" onClick={() => void done(act('Rendre les clés', 'key-round', 'home', () => api.endStay(sim.id)))}>
            Rendre les clés avant la fin
          </button>
        </section>
      )}

      {/* Homes for rent: anywhere */}
      <section>
        <CommunePicker label="Où dormir ?" sim={sim} where={where} onChange={setWhere} />
        {!data.adult && <p className="mb-2 rounded-xl bg-[var(--color-canvas)] p-2.5 text-xs font-bold">À partir de 18 ans : tu peux regarder, pas encore réserver.</p>}
        <ul className="space-y-3">
          {data.listings.map((l) => (
            <li key={l.id} className="rounded-[20px] bg-[var(--color-canvas)] p-2">
              <button className="block w-full text-left" onClick={() => setOpen(open === l.id ? null : l.id)}>
                <Photo l={l} />
                <div className="mt-2 flex items-start gap-2 px-1">
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block text-sm font-extrabold">{l.title}</span>
                    <span className="mt-0.5 block text-xs font-semibold text-[var(--color-ink-soft)]">
                      {l.typeName} · chez {l.host}
                    </span>
                  </span>
                  {l.rating > 0 ? (
                    <span className="flex shrink-0 items-center gap-0.5 text-xs font-extrabold">
                      <Star size={12} className="fill-current text-[#f59e0b]" /> {l.rating.toFixed(2).replace('.', ',')} ({l.reviews})
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-[#ede9fe] px-2 py-0.5 text-[11px] font-extrabold text-[#5b21b6]">Nouveau</span>
                  )}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1 px-1">
                  <span className="mr-auto text-sm font-extrabold">
                    {amount(l.night)} Djai <span className="text-xs font-bold text-[var(--color-ink-soft)]">/ nuit</span>
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-bold text-[var(--color-ink-soft)]">
                    <Users size={11} /> {l.guests}
                  </span>
                </div>
              </button>
              {open === l.id && (
                <div className="mt-2 space-y-1.5 px-1 pb-1">
                  <div className="flex flex-wrap gap-1">
                    {l.has.map((x) => (
                      <span key={x} className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold">
                        {x}
                      </span>
                    ))}
                  </div>
                  {l.mine ? (
                    <p className="text-xs font-bold text-[var(--color-ink-soft)]">C'est ta maison : elle est en ligne.</p>
                  ) : (
                    data.lengths.map((len) => {
                      const price = Math.round((l.night * len.rate) / 500) * 500
                      return (
                        <div key={len.id} className="flex items-center gap-2 rounded-xl bg-white px-3 py-1.5">
                          <BedDouble size={14} className="shrink-0 text-[#7c3aed]" />
                          <span className="min-w-0 flex-1 text-sm font-extrabold">{len.label}</span>
                          <button
                            className="shrink-0 rounded-xl bg-[#7c3aed] px-3 py-1.5 text-sm font-extrabold text-white disabled:opacity-50"
                            disabled={l.full || !!stay || !data.adult || sim.money < price}
                            onClick={() => void done(act(`Dodo : ${l.title}`, 'key-round', 'home', () => api.dodoBook(sim.id, l.id, len.id)))}
                          >
                            {l.full ? 'Complet' : sim.money < price ? 'Trop cher' : `${amount(price)} Djai`}
                          </button>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Letting one's own houses */}
      <section className="rounded-[20px] bg-[#f5f3ff] p-3">
        <div className="label mb-1 flex items-center gap-1.5">
          <House size={13} /> Louer ta maison
        </div>
        <p className="mb-2 text-xs font-semibold text-[var(--color-ink-soft)]">
          Une maison sur un de tes autres terrains (pas celle où tu vis) ? Les voyageurs te paient la nuit, Dodo garde {Math.round(data.fee * 100)} %.
        </p>
        {data.mine.map((m) => (
          <div key={m.id} className="mb-2 rounded-xl bg-white p-2.5">
            <p className="text-sm font-extrabold">{m.title}</p>
            <p className="text-xs font-semibold text-[var(--color-ink-soft)]">
              {capital(aCommune(communeOf(m.city, m.commune)))} · {amount(m.night)} Djai la nuit · {m.stays} séjour{m.stays > 1 ? 's' : ''} · {amount(m.earned)} Djai gagnés
              {m.busy ? ' · un voyageur est là' : ''}
            </p>
            <div className="mt-1.5 flex gap-1.5">
              <input className="input !py-1.5 text-sm" inputMode="numeric" placeholder={String(m.night)} value={prices[m.lot] ?? ''} onChange={(e) => setPrices((p) => ({ ...p, [m.lot]: e.target.value.replace(/\D/g, '') }))} aria-label="Prix de la nuit" />
              <button className="shrink-0 rounded-xl bg-[#7c3aed] px-3 text-xs font-extrabold text-white" onClick={() => void done(act('Nouveau prix', 'house', 'home', () => api.dodoList(sim.id, m.lot, Number(prices[m.lot] || m.night), m.title)))}>
                Changer
              </button>
              <button className="shrink-0 rounded-xl bg-[var(--color-canvas)] px-3 text-xs font-extrabold" onClick={() => void done(act('Retirer de Dodo', 'house', 'home', () => api.dodoUnlist(sim.id, m.lot)))}>
                Retirer
              </button>
            </div>
          </div>
        ))}
        {data.lettable.map((p) => {
          const suggested = Math.round((data.studio * 1.6) / 500) * 500
          return (
            <div key={p.id} className="mb-2 rounded-xl bg-white p-2.5">
              <p className="text-sm font-extrabold">
                Ta maison {aCommune(communeOf(p.lot!.city, p.lot!.commune))} · {p.lot!.area} m²
              </p>
              <div className="mt-1.5 flex gap-1.5">
                <input className="input !py-1.5 text-sm" inputMode="numeric" placeholder={`${suggested} Djai la nuit`} value={prices[p.id] ?? ''} onChange={(e) => setPrices((x) => ({ ...x, [p.id]: e.target.value.replace(/\D/g, '') }))} aria-label="Prix de la nuit" />
                <button className="shrink-0 rounded-xl bg-[#7c3aed] px-3 text-xs font-extrabold text-white" onClick={() => void done(act('Mettre sur Dodo', 'house', 'home', () => api.dodoList(sim.id, p.id, Number(prices[p.id] || suggested))))}>
                  Mettre en location
                </button>
              </div>
            </div>
          )
        })}
        {!data.mine.length && !data.lettable.length && (
          <p className="flex items-center gap-2 text-xs font-bold text-[var(--color-ink-soft)]">
            <Moon size={14} className="shrink-0" /> Achète un autre terrain et bâtis-y une maison (appli Logement) : tu pourras la louer ici.
          </p>
        )}
      </section>
    </div>
  )
}
