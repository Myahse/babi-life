// « Tes immeubles » in the Logement app (update « immobilier », backend sims/estate.go): one's buildings
// that pay. For each: its tenants, how well it's kept, the money waiting (collected the tax off, up to the
// day's limit), the works that make it like new; on the ground floor, the shop opened there and the people
// working in it, hired and let go. Built from a building's plan on a big lot (BuildMode), like a house.

import { useEffect, useState } from 'react'
import { Building2, Hammer, HandCoins, UserMinus, UserPlus, Users, Wrench } from 'lucide-react'
import { api } from '../lib/api'
import type { EstatesView, Sim } from '../lib/types'
import type { Act } from '../screens/phoneApps'
import { amount, duration } from '../game/rules'
import { aCommune } from '../lib/french'
import { iconFor } from './icons'
import { Chip, Coin, IconTile } from './ui'
import { t as tr, tx } from '../lib/i18n'

/** A gauge: how full or how well kept, 0–1. */
function Bar({ value, tone }: { value: number; tone: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-black/10">
      <div className="h-full rounded-full" style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`, background: tone }} />
    </div>
  )
}

export function Immo({ sim, act }: { sim: Sim; act: Act }) {
  const [view, setView] = useState<EstatesView | null>(null)
  const [version, setVersion] = useState(0)
  useEffect(() => {
    let gone = false
    api.estates(sim.id).then((v) => !gone && setView(v), () => !gone && setView(null))
    return () => {
      gone = true
    }
  }, [sim.id, version])
  const run = async (label: string, icon: string, call: () => ReturnType<typeof api.estateCollect>) => (await act(label, icon, 'home', call)) && setVersion((v) => v + 1)
  if (!view) return null
  const waiting = view.estates.reduce((n, e) => n + Math.max(0, e.pending), 0)
  return (
    <section className="rounded-[20px] bg-[#eef1ff] p-3">
      <h4 className="label mb-1 flex items-center gap-1.5">
        <Building2 size={14} /> {view.estates.length > 1 ? tr('Tes immeubles ({length})', { length: view.estates.length }) : tr('Tes immeubles')}
      </h4>
      {view.estates.length === 0 ? (
        <p className="text-sm leading-snug font-bold text-[var(--color-ink-soft)]">
          {tr("Après ta maison, deviens propriétaire. Achète une parcelle de 1 000 m² (un immeuble de rapport, ou un immeuble avec un commerce en bas) ou un îlot de 2 500 m² (une tour de bureaux), puis choisis son plan dans « Construire ». Les locataires paient chaque jour ; ici, tu encaisses.")}
        </p>
      ) : (
        <>
          <p className="mb-2 text-xs font-semibold text-[var(--color-ink-soft)]">
            {tx("Les loyers t'attendent dans chaque immeuble ({days} jours au plus). À l'encaissement, {0} % d'impôts ; encore {1} Djai encaissables aujourd'hui.", { days: view.days, 0: Math.round(view.tax * 100), 1: amount(view.left) })}
          </p>
          {view.estates.length > 1 && (
            <button className="btn mb-2 w-full !py-2 !text-sm" disabled={waiting <= 0 || view.left <= 0} onClick={() => run(tr('Tout encaisser'), 'hand-coins', () => api.estateCollect(sim.id))}>
              <HandCoins size={16} /> {tx('Tout encaisser · {0} Djai', { 0: amount(waiting) })}
            </button>
          )}
          <ul className="space-y-2">
            {view.estates.map((e) => {
              const shop = view.shops.find((k) => k.id === e.shop)
              return (
                <li key={e.lot} className="rounded-[18px] bg-white p-3">
                  <div className="flex items-center gap-3">
                    <IconTile icon={Building2} colors={e.kind === 'tour' ? ['#7b8cff', '#3a46c9'] : ['#ffb44d', '#ff7a00']} size={44} />
                    <div className="min-w-0 flex-1 leading-tight">
                      <div className="truncate font-display text-[16px] font-extrabold">{e.label}</div>
                      <div className="text-xs font-semibold text-[var(--color-ink-soft)]">{aCommune(e.name)}</div>
                    </div>
                    {e.building > 0 ? (
                      <Chip tone="gold">
                        <Hammer size={12} /> {tx('Chantier · {0}', { 0: duration(e.building) })}
                      </Chip>
                    ) : (
                      <Chip tone={e.gross >= 0 ? 'good' : 'bad'}>
                        {tx('{0} Djai/jour', { 0: amount(e.gross) })}
                      </Chip>
                    )}
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs font-bold text-[var(--color-ink-soft)]">
                    <span>
                      {e.kind === 'tour' ? tx('Bureaux loués : {0}/{1}', { 0: e.tenants, 1: e.units }) : tx('Appartements loués : {0}/{1}', { 0: e.tenants, 1: e.units })}
                    </span>
                    <span>{tx('Entretien : {0} %', { 0: Math.round(e.upkeep) })}</span>
                    <Bar value={e.tenants / e.units} tone="#00b86b" />
                    <Bar value={e.upkeep / 100} tone={e.upkeep < 40 ? '#ff3d57' : e.upkeep < 70 ? '#ffa000' : '#2a6cf0'} />
                    <span className="col-span-2">{tx('{0} Djai par {1} et par jour', { 0: amount(e.rent), 1: e.kind === 'tour' ? tr('bureau') : tr('appartement') })}</span>
                  </div>
                  {e.building === 0 && e.upkeep < 60 && <p className="mt-1 text-xs font-bold text-[#d81b3f]">{tr("L'immeuble se dégrade : les locataires s'en vont si tu ne fais pas les travaux.")}</p>}

                  <div className="mt-2 flex gap-2">
                    <button className="btn flex-1 !px-2 !py-2 !text-sm" disabled={e.building > 0 || e.pending <= 0 || view.left <= 0} onClick={() => run(tr('Encaisser les loyers'), 'hand-coins', () => api.estateCollect(sim.id, e.lot))}>
                      <Coin size={15} /> {tx('Encaisser {0}', { 0: amount(Math.max(0, e.pending)) })}
                    </button>
                    <button className="btn btn-soft flex-1 !px-2 !py-2 !text-sm" disabled={e.building > 0 || e.repair <= 0 || e.upkeep >= 99.5 || sim.money < e.repair} onClick={() => run(tr("Rénover l'immeuble"), 'wrench', () => api.estateRepair(sim.id, e.lot))}>
                      <Wrench size={15} /> {tx('Rénover · {0}', { 0: amount(e.repair) })}
                    </button>
                  </div>
                  {e.pending < 0 && <p className="mt-1 text-xs font-bold text-[#d81b3f]">{tx('Ton commerce perd de l’argent : {0} Djai de salaires à payer.', { 0: amount(-e.pending) })}</p>}

                  {e.hasShop && (
                    <div className="mt-3 rounded-2xl bg-[var(--color-canvas)] p-2.5">
                      {!shop ? (
                        <>
                          <div className="label mb-1.5">{tr('Le rez-de-chaussée : ouvre un commerce')}</div>
                          <ul className="space-y-1.5">
                            {view.shops.map((k) => (
                              <li key={k.id} className="flex items-center gap-2">
                                <IconTile icon={iconFor(k.icon)} colors={['#ff8a65', '#ff3d57']} size={34} />
                                <span className="min-w-0 flex-1 leading-tight">
                                  <span className="block truncate text-sm font-extrabold">{k.label}</span>
                                  <span className="block text-[11px] font-semibold text-[var(--color-ink-soft)]">{tx("jusqu'à {0} employés", { 0: k.staff })}</span>
                                </span>
                                <button className="btn shrink-0 !px-2.5 !py-1.5 !text-xs" disabled={e.building > 0 || sim.money < k.fitOut} onClick={() => run(tr('Ouvrir : {0}', { 0: k.label }), k.icon, () => api.estateShop(sim.id, e.lot, k.id))}>
                                  <Coin size={13} /> {amount(k.fitOut)}
                                </button>
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <IconTile icon={iconFor(shop.icon)} colors={['#ff8a65', '#ff3d57']} size={34} />
                            <span className="min-w-0 flex-1 leading-tight">
                              <span className="block truncate text-sm font-extrabold">{shop.label}</span>
                              <span className="block text-[11px] font-semibold text-[var(--color-ink-soft)]">
                                {e.staff.length ? tx('{0} Djai de ventes par jour, {1} Djai de salaires', { 0: amount(e.sales), 1: amount(e.staff.length * view.wage) }) : tr('Fermé : personne pour y travailler')}
                              </span>
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {e.staff.map((p) => (
                              <span key={p.name} className="flex items-center gap-1 rounded-full bg-white py-1 pr-1 pl-2.5 text-xs font-extrabold">
                                <Users size={12} /> {p.name}
                                <button className="grid h-6 w-6 place-items-center rounded-full bg-[#ffe8ec] text-[#d81b3f]" aria-label={tr('Renvoyer {0}', { 0: p.name })} onClick={() => run(tr('Renvoyer {0}', { 0: p.name }), 'user-minus', () => api.estateFire(sim.id, e.lot, p.name))}>
                                  <UserMinus size={12} />
                                </button>
                              </span>
                            ))}
                          </div>
                          <button className="btn btn-soft mt-2 w-full !py-1.5 !text-xs" disabled={e.staff.length >= shop.staff} onClick={() => run(tr('Embaucher'), 'user-plus', () => api.estateHire(sim.id, e.lot))}>
                            <UserPlus size={14} /> {e.staff.length >= shop.staff ? tr('Le commerce est au complet') : tx('Embaucher quelqu’un · {0} Djai par jour', { 0: amount(view.wage) })}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}
