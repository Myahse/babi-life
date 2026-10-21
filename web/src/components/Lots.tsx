import { useEffect, useState } from 'react'
import { LandPlot, Ruler } from 'lucide-react'
import { api, ApiError, type LotWhere } from '../lib/api'
import { useWorld } from '../store/world'
import type { Lot, LotOffer, Sim } from '../lib/types'
import { amount } from '../game/rules'
import { aCommune, capital } from '../lib/french'

/**
 * The lots for sale (sims/plot.go): 150 to 600 m², priced by the m² of the
 * commune, deed (ACD) and notary included. Any commune of any town, chosen in
 * the list (where the Sim is at first): one buys land from afar, as people do.
 * With a lot there already, only the bigger ones, for the difference.
 */
export function LotOffers({ sim, buy, onLoaded }: { sim: Sim; buy: (size: string, label: string, where: LotWhere) => Promise<boolean>; onLoaded?: (lot: Lot | null) => void }) {
  const world = useWorld((s) => s.world)
  const [where, setWhere] = useState<LotWhere>({ city: sim.city, commune: sim.commune })
  const [data, setData] = useState<{ offers: LotOffer[]; lot: Lot | null; fees: number; adult: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const load = () =>
    api
      .lots(sim.id, where)
      .then((d) => (setData(d), onLoaded?.(d.lot)))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Pas de réseau'))
  useEffect(() => void load(), [sim.id, where.city, where.commune]) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <p className="text-sm font-bold text-[#d81b3f]">{error}</p>
  if (!data) return <p className="text-sm font-bold text-[var(--color-ink-soft)]">Chargement des terrains…</p>
  if (!data.adult) return <p className="rounded-2xl bg-[var(--color-canvas)] p-3 text-sm font-bold">Tu vis chez tes parents. À 18 ans, tu pourras acheter ton terrain et bâtir ta maison.</p>
  const offers = data.offers.filter((o) => o.possible)
  const name = data.offers[0]?.name ?? ''
  return (
    <div>
      {world && (
        <label className="mb-2 block">
          <span className="label">Où acheter ?</span>
          <select className="input mt-1 text-base" value={`${where.city}/${where.commune}`} onChange={(e) => (([city, commune]) => setWhere({ city, commune }))(e.target.value.split('/'))}>
            {world.cities.map((c) => (
              <optgroup key={c.id} label={c.name}>
                {c.communes.map((cm) => (
                  <option key={cm.id} value={`${c.id}/${cm.id}`}>
                    {cm.name}
                    {c.id === sim.city && cm.id === sim.commune ? ' (tu es ici)' : ''}
                    {data.lot && c.id === data.lot.city && cm.id === data.lot.commune ? ' (ton terrain)' : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      )}
      <p className="mb-2 text-xs font-semibold text-[var(--color-ink-soft)]">
        {capital(aCommune(name))} : {amount(data.offers[0]?.perM2 ?? 0)} Djai le m², plus {Math.round(data.fees * 100)} % pour l'ACD et le notaire.
        {data.lot && data.lot.city === where.city && data.lot.commune === where.commune ? ' Ton terrain grandit : ta maison reste, tu paies la différence.' : data.lot ? " Ailleurs, l'ancien terrain (vide) est revendu à 90 %." : ''}
      </p>
      {offers.length === 0 && <p className="text-sm font-bold text-[var(--color-ink-soft)]">Tu as déjà le plus grand terrain ici.</p>}
      <ul className="space-y-2">
        {offers.map((o) => (
          <li key={o.id} className={`flex items-center gap-3 rounded-[20px] bg-[var(--color-canvas)] p-2.5 ${sim.money < o.payable ? 'opacity-60' : ''}`}>
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#e8f6ee] text-[#1a8a4a]">
              <LandPlot size={24} />
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block font-display text-[16px] font-extrabold">
                {o.area} m² · {o.label}
              </span>
              <span className="flex items-center gap-1 text-xs font-semibold text-[var(--color-ink-soft)]">
                <Ruler size={11} /> {o.w} × {o.d} m · {amount(o.payable)} Djai{o.upgrade ? ' (différence)' : ''}
              </span>
            </span>
            <button
              className="btn shrink-0 !px-3 !py-2 !text-sm"
              disabled={!!busy || sim.money < o.payable}
              onClick={async () => {
                setBusy(o.id)
                if (await buy(o.id, `Terrain de ${o.area} m²`, where)) await load()
                setBusy(null)
              }}
            >
              {busy === o.id ? '…' : sim.money < o.payable ? 'Trop cher' : 'Acheter'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
