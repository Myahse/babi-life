import { useEffect, useState } from 'react'
import { LandPlot, Maximize2, Ruler } from 'lucide-react'
import { api, ApiError, type LotWhere } from '../lib/api'
import { useWorld } from '../store/world'
import type { LotOffer, Plot, Sim } from '../lib/types'
import { amount } from '../game/rules'
import { aCommune, capital } from '../lib/french'
import { keyOpen, useFeatures } from '../lib/features'
import { LotMap } from './LotMap'
import { useLotPlace } from '../store/lotPlace'

/**
 * The lots for sale (sims/plot.go): 150 to 600 m², priced by the m² of the
 * commune, deed (ACD) and notary included. Any commune of any town, chosen in
 * the list (where the Sim is at first): one buys land from afar, as people do.
 * Two lots at most in a commune: there, the ones one has can also grow (the
 * house stays, the difference is paid).
 */
export type Buy = (size: string, label: string, where: LotWhere, upgrade?: number, spot?: { lat: number; lng: number }) => Promise<boolean>
export function LotOffers({ sim, buy, onLoaded, version = 0 }: { sim: Sim; buy: Buy; onLoaded?: (lots: Plot[]) => void; version?: number }) {
  const [where, setWhere] = useState<LotWhere>({ city: sim.city, commune: sim.commune })
  const [data, setData] = useState<Awaited<ReturnType<typeof api.lots>> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  // A new lot: where it goes, picked on the map first (an update: lot-carte).
  const onMap = keyOpen(useFeatures(), 'lot-carte')
  const [placing, setPlacing] = useState<LotOffer | null>(null)
  // The commune the Sim is in, seen in 3D: the lot is set right there, in the world.
  const shown = useLotPlace((s) => s.shown)
  const inWorld = shown === where.commune && sim.city === where.city && sim.commune === where.commune
  const load = () =>
    api
      .lots(sim.id, where)
      .then((d) => (setData(d), onLoaded?.(d.lots)))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Pas de réseau'))
  useEffect(() => void load(), [sim.id, where.city, where.commune, version]) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <p className="text-sm font-bold text-[#d81b3f]">{error}</p>
  if (!data) return <p className="text-sm font-bold text-[var(--color-ink-soft)]">Chargement des terrains…</p>
  if (!data.adult) return <p className="rounded-2xl bg-[var(--color-canvas)] p-3 text-sm font-bold">Tu vis chez tes parents. À 18 ans, tu pourras acheter ton terrain et bâtir ta maison.</p>
  const fresh = data.offers.filter((o) => o.possible && !o.upgrade)
  const grow = data.offers.filter((o) => o.possible && o.upgrade)
  const here = data.lots.filter((l) => l.lot?.city === where.city && l.lot?.commune === where.commune)
  const name = data.offers[0]?.name ?? ''
  const owned = (c: string, cm: string) => data.lots.filter((l) => l.lot?.city === c && l.lot?.commune === cm).length
  const row = (o: LotOffer) => {
    const from = o.upgrade ? data.lots.find((l) => l.id === o.upgrade)?.lot : null
    const k = `${o.id}:${o.upgrade ?? 0}`
    return (
      <li key={k} className={`flex items-center gap-3 rounded-[20px] bg-[var(--color-canvas)] p-2.5 ${sim.money < o.payable ? 'opacity-60' : ''}`}>
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#e8f6ee] text-[#1a8a4a]">{o.upgrade ? <Maximize2 size={22} /> : <LandPlot size={24} />}</span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block font-display text-[16px] font-extrabold">{from ? `${from.area} → ${o.area} m²` : `${o.area} m² · ${o.label}`}</span>
          <span className="flex items-center gap-1 text-xs font-semibold text-[var(--color-ink-soft)]">
            <Ruler size={11} /> {o.w} × {o.d} m · {amount(o.payable)} Djai{o.upgrade ? ' (la différence)' : ''}
          </span>
        </span>
        <button
          className="btn shrink-0 !px-3 !py-2 !text-sm"
          disabled={!!busy || sim.money < o.payable}
          onClick={async () => {
            if (onMap && !o.upgrade && inWorld) {
              const label = `Terrain de ${o.area} m²`
              return useLotPlace.getState().start({
                w: o.w,
                d: o.d,
                price: o.payable,
                label: `Acheter ici · ${amount(o.payable)} Djai`,
                onPick: async (spot) => {
                  const ok = await buy(o.id, label, where, 0, spot)
                  if (ok) await load()
                  return ok
                },
              })
            }
            if (onMap && !o.upgrade) return setPlacing(o)
            setBusy(k)
            if (await buy(o.id, o.upgrade ? `Agrandir le terrain : ${o.area} m²` : `Terrain de ${o.area} m²`, where, o.upgrade)) await load()
            setBusy(null)
          }}
        >
          {busy === k ? '…' : sim.money < o.payable ? 'Trop cher' : o.upgrade ? 'Agrandir' : onMap ? 'Choisir où' : 'Acheter'}
        </button>
      </li>
    )
  }
  return (
    <div>
      <CommunePicker label="Où acheter ?" sim={sim} where={where} onChange={setWhere} mark={(c, cm) => (owned(c, cm) ? `${owned(c, cm)} terrain${owned(c, cm) > 1 ? 's' : ''} à toi` : '')} />
      <p className="mb-2 text-xs font-semibold text-[var(--color-ink-soft)]">
        {capital(aCommune(name))} : {amount(data.offers[0]?.perM2 ?? 0)} Djai le m², plus {Math.round(data.fees * 100)} % pour l'ACD et le notaire. {data.perCommune} terrains au plus par commune, {data.max} en tout.
      </p>
      {fresh.length > 0 ? (
        <ul className="space-y-2">{fresh.map(row)}</ul>
      ) : (
        <p className="rounded-2xl bg-[var(--color-canvas)] p-3 text-sm font-bold text-[var(--color-ink-soft)]">
          {data.lots.length >= data.max ? `Tu as déjà ${data.max} terrains : vends-en un pour en acheter un autre.` : `Tu as déjà ${here.length} terrains ${aCommune(name)} : c'est le maximum ici. Agrandis-en un, ou choisis une autre commune.`}
        </p>
      )}
      {grow.length > 0 && (
        <>
          <h5 className="label mt-3 mb-1">Agrandir {here.length > 1 ? 'tes terrains' : 'ton terrain'} {aCommune(name)}</h5>
          <ul className="space-y-2">{grow.map(row)}</ul>
        </>
      )}
      {placing && (
        <LotMap
          sim={sim}
          city={where.city}
          commune={where.commune}
          w={placing.w}
          d={placing.d}
          price={placing.payable}
          onClose={() => setPlacing(null)}
          onPick={async (spot) => {
            const ok = await buy(placing.id, `Terrain de ${placing.area} m²`, where, 0, spot ?? undefined)
            if (ok) await load()
            return ok
          }}
        />
      )}
    </div>
  )
}

/** Any commune of any town, by town: where to buy land or rent (« tu es ici » marked, and what mark() says). */
export function CommunePicker({ label, sim, where, onChange, mark }: { label: string; sim: Sim; where: LotWhere; onChange: (w: LotWhere) => void; mark?: (city: string, commune: string) => string }) {
  const world = useWorld((s) => s.world)
  if (!world) return null
  return (
    <label className="mb-2 block">
      <span className="label">{label}</span>
      <select className="input mt-1 text-base" value={`${where.city}/${where.commune}`} onChange={(e) => (([city, commune]) => onChange({ city, commune }))(e.target.value.split('/'))}>
        {world.cities.map((c) => (
          <optgroup key={c.id} label={c.name}>
            {c.communes.map((cm) => {
              const notes = [c.id === sim.city && cm.id === sim.commune ? 'tu es ici' : '', mark?.(c.id, cm.id) ?? ''].filter(Boolean)
              return (
                <option key={cm.id} value={`${c.id}/${cm.id}`}>
                  {cm.name}
                  {notes.length ? ` (${notes.join(', ')})` : ''}
                </option>
              )
            })}
          </optgroup>
        ))}
      </select>
    </label>
  )
}
