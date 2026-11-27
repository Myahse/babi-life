import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { Sim } from '../../lib/types'
import type { Act } from '../../screens/phoneApps'
import { t } from '../../lib/i18n'
import { amount } from '../../game/rules'
import { MILKED, type FermeAct, type FermeBody, type FermeView } from '../../lib/ferme'

// At the plot's place (the update « agriculture »; the place's card, screens/Play.tsx): the Sim's own plot here and
// what it needs now, each a button that sends the Sim to do it at the plot, in 3D (backend sims/fermeTravail.go),
// as the « Ferme » app's do. The rest (renting, selling, the animals bought) is in the app.

type Step = { act: FermeAct; label: string; icon: string; body?: FermeBody; cost?: number }

export function FermeHere({ sim, placeId, act, onDone, onApp }: { sim: Sim; placeId: string; act: Act; /** The card closed: the Sim goes to work. */ onDone: () => void; onApp: () => void }) {
  const [view, setView] = useState<FermeView | null>(null)
  useEffect(() => {
    void api.ferme(sim.id, 'voir').then(
      (r) => r.data && setView(r.data),
      () => undefined,
    )
  }, [sim.id, sim.activity?.end])
  if (!view) return null
  const offre = view.offres.find((o) => o.place === placeId)
  const plot = view.ferme.plots?.find((p) => p.offre === offre?.id)
  const busy = !!sim.activity
  const steps: Step[] = []
  if (plot && offre && view.here[plot.id]) {
    const c = plot.champ
    const zone = offre.zone
    const raining = view.meteo[zone]?.[0] === 'pluie'
    if (c.stage === 'friche') steps.push({ act: 'defricher', label: t('Défricher à la machette'), icon: 'axe' })
    if (c.stage === 'defriche') steps.push({ act: 'labourer', label: t('Labourer à la daba'), icon: 'shovel' })
    if (c.stage === 'laboure')
      for (const id of offre.crops) {
        const k = view.cultures.find((x) => x.id === id)
        if (!k || !k.zones.includes(zone) || (k.sow?.length && !k.sow.includes(view.month))) continue
        steps.push({ act: 'semer', label: t('Semer : {0}', { 0: k.label }), icon: 'sprout', body: { crop: k.id, score: 60 }, cost: k.seed * offre.rows })
        if (steps.length >= 4) break
      }
    if (c.stage === 'pousse') {
      if (c.watered !== view.today && !raining) steps.push({ act: 'arroser', label: t('Arroser'), icon: 'droplets' })
      if (c.weeds) steps.push({ act: 'desherber', label: t('Désherber'), icon: 'shovel' })
      if (c.pest) steps.push({ act: 'traiter', label: t('Traiter au neem'), icon: 'spray-can', cost: view.rules.treat })
    }
    if (c.stage === 'mur') steps.push({ act: 'recolter', label: t('Récolter'), icon: 'wheat' })
    for (const e of plot.pens ?? []) {
      const b = view.betes.find((x) => x.id === e.kind)
      if (!b || e.adults + (e.young ?? 0) === 0) continue
      const body = { kind: b.id }
      if (e.fed !== view.today && e.grazed !== view.today) steps.push({ act: 'nourrir', label: t('Nourrir : {0}', { 0: b.label }), icon: 'wheat', body, cost: b.feed * (e.adults + (e.young ?? 0)) })
      if (!b.pond && e.watered !== view.today) steps.push({ act: 'abreuver', label: t('Abreuver : {0}', { 0: b.label }), icon: 'droplets', body })
      if (e.eggs) steps.push({ act: 'oeufs', label: t('Ramasser les œufs ({n})', { n: e.eggs }), icon: 'egg', body: { ...body, score: 70 } })
      if (MILKED.has(b.id) && e.milked !== view.today) steps.push({ act: 'traire', label: t('Traire : {0}', { 0: b.label }), icon: 'milk', body })
      if (b.graze && e.fed !== view.today && e.grazed !== view.today) steps.push({ act: 'paturage', label: t('Mener au pâturage : {0}', { 0: b.label }), icon: 'footprints', body: { ...body, score: 60 }, cost: b.herder })
    }
    for (const pr of view.produits) if ((pr.id === 'feves-sechees' || pr.id === 'cafe-seche') && pr.from && (view.ferme.grenier?.[pr.from] ?? 0) > 0) steps.push({ act: 'transformer', label: pr.do ?? pr.label, icon: 'sun', body: { product: pr.id } })
  }
  return (
    <div className="mb-3 rounded-[20px] bg-[#ebfbee] p-3">
      <div className="label">{t('Ma parcelle')}</div>
      {!plot ? (
        <p className="mt-1 text-[13px] leading-snug font-bold text-[var(--color-ink-soft)]">{t('Tu n’as pas de parcelle ici : loue-la ou achète-la dans l’appli Ferme.')}</p>
      ) : steps.length ? (
        <div className="mt-2 grid gap-1.5">
          {steps.map((s) => (
            <button
              key={s.act + (s.body?.kind ?? s.body?.crop ?? s.body?.product ?? '')}
              disabled={busy || (s.cost ?? 0) > sim.money}
              className="flex items-center justify-between gap-2 rounded-2xl bg-white px-3 py-2.5 text-left text-[14px] font-extrabold shadow-sm transition active:scale-[0.98] disabled:opacity-55"
              onClick={() => void act(s.label, s.icon, 'life', () => api.ferme(sim.id, s.act, { ...s.body, plot: plot.id, work: true })).then((ok) => ok && onDone())}
            >
              <span>{s.label}</span>
              {!!s.cost && <span className="text-[12px] text-[var(--color-ink-soft)]">{amount(s.cost)} F</span>}
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-[13px] leading-snug font-bold text-[var(--color-ink-soft)]">{t('Rien à faire aux champs pour l’instant : tout est en ordre.')}</p>
      )}
      <button className="mt-2 text-[13px] font-extrabold text-[#2b8a3e] underline" onClick={onApp}>
        {t('Ouvrir l’appli Ferme')}
      </button>
    </div>
  )
}
