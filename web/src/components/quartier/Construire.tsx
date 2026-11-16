// « Construire » (update « mon-quartier », backend sims/monquartier.go; maquette 4 of the plan): what can be
// opened in one's quartier at its level, each with its price and what it does; one picked, « Placer »
// pays for it on the spot (the slot given, or the first free one), then hands the kind and the spot to the
// 3D world (onPlace) so it appears in the street. What the next levels unlock is shown below, greyed.

import { useEffect, useState } from 'react'
import { Lock, MapPin, X } from 'lucide-react'
import { api, errorText } from '../../lib/api'
import type { QuartierView } from '../../lib/types'
import { SIM_CHANGED } from '../../lib/live'
import { amount } from '../../game/rules'
import { iconFor } from '../icons'
import { Sheet } from '../Sheet'
import { IconTile } from '../ui'
import { t } from '../../lib/i18n'

export type QuartierSheetProps = {
  simId: string
  onClose: () => void
  /** Called once a building is paid for: its kind and the spot (slot) it takes in the quartier's layout. */
  onPlace: (kind: string, slot: number) => void
}

// The quartier's palette (maquette 3 and 4): cream cards, the street's orange.
export const Q = { cream: '#fbf5ea', card: '#fffdf8', tile: '#fff6e9', line: '#ecdcc4', orange: '#e8731f', ink: '#2a1d14', soft: '#7a6250', green: '#1c7a4a' }

export function Construire({ simId, onClose, onPlace, slot, view: given }: QuartierSheetProps & { slot?: number; view?: QuartierView }) {
  const [view, setView] = useState<QuartierView | null>(given ?? null)
  const [pick, setPick] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let gone = false
    if (!given) api.quartier(simId).then((v) => !gone && setView(v), (e) => !gone && setError(errorText(e)))
    return () => {
      gone = true
    }
  }, [simId, given])
  const money = view?.money ?? null
  const open = (view?.unlocks ?? []).filter((u) => !u.locked && u.built < u.max)
  const later = (view?.unlocks ?? []).filter((u) => u.locked)
  const chosen = open.find((u) => u.kind === pick) ?? null
  useEffect(() => {
    if (!pick && open.length) setPick(open.find((u) => money === null || u.price <= money)?.kind ?? open[0].kind)
  }, [open, pick, money])
  const place = async (close: () => void) => {
    if (!chosen) return
    setBusy(true)
    setError('')
    try {
      const r = await api.quartierBuild(simId, chosen.kind, slot ?? -1)
      window.dispatchEvent(new CustomEvent(SIM_CHANGED, { detail: simId }))
      onPlace(chosen.kind, r.data?.slot ?? slot ?? -1)
      close()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Sheet onClose={onClose} z="z-40" className="max-h-[88dvh] lg:w-[420px]">
      {(close) => (
        <div className="flex min-h-0 flex-col rounded-t-[28px] px-4 pt-7 lg:rounded-[28px]" style={{ background: Q.cream, color: Q.ink }}>
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold tracking-[0.08em] uppercase" style={{ color: Q.orange }}>
                {t('Construire')} · {view?.name ?? t('Mon quartier')}
              </div>
              <h3 className="font-display text-[22px] leading-tight font-extrabold">{t('Que veux-tu ouvrir ?')}</h3>
            </div>
            <button className="grid size-9 shrink-0 place-items-center rounded-full bg-black/5" aria-label={t('Fermer')} onClick={close}>
              <X size={18} />
            </button>
          </div>
          {money !== null && <p className="mt-0.5 text-xs font-semibold" style={{ color: Q.soft }}>{t('Tu as {0} Djai', { 0: amount(money) })}</p>}

          <div className="-mx-4 mt-3 min-h-0 flex-1 overflow-y-auto px-4 pb-2">
            {!view && !error && <p className="py-8 text-center text-sm font-semibold" style={{ color: Q.soft }}>{t('Chargement…')}</p>}
            {view && open.length === 0 && <p className="rounded-2xl p-3 text-sm font-semibold" style={{ background: Q.tile, color: Q.soft }}>{t('Tout ce que ton niveau permet est déjà construit. Fais monter ta réputation pour débloquer la suite.')}</p>}
            <ul className="space-y-2">
              {open.map((u) => {
                const on = u.kind === pick
                const short = money !== null && u.price > money
                return (
                  <li key={u.kind}>
                    <button
                      className="flex w-full items-start gap-3 rounded-2xl border-2 p-3 text-left transition-[transform,border-color] duration-150 active:scale-[0.98]"
                      style={{ background: Q.card, borderColor: on ? Q.orange : Q.line }}
                      aria-pressed={on}
                      onClick={() => setPick(u.kind)}
                    >
                      <IconTile icon={iconFor(u.icon)} colors={on ? ['#ffb066', Q.orange] : ['#f3e3cb', '#e2c9a4']} size={40} />
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[15px] font-extrabold">{u.label}</span>
                          <span className="shrink-0 text-sm font-extrabold" style={{ color: short ? '#c0392b' : Q.orange }}>
                            {t('{0} Djai', { 0: amount(u.price) })}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-xs font-semibold" style={{ color: Q.soft }}>
                          {u.about}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
            {later.length > 0 && (
              <>
                <div className="mt-4 mb-1.5 text-[11px] font-bold tracking-[0.08em] uppercase" style={{ color: Q.soft }}>
                  {t('Aux prochains niveaux')}
                </div>
                <ul className="grid grid-cols-2 gap-1.5">
                  {later.map((u) => (
                    <li key={u.kind} className="flex items-center gap-2 rounded-xl border p-2 opacity-60" style={{ background: Q.tile, borderColor: Q.line }}>
                      <Lock size={14} className="shrink-0" />
                      <span className="min-w-0 leading-tight">
                        <span className="block truncate text-xs font-extrabold">{u.label}</span>
                        <span className="block text-[11px] font-semibold" style={{ color: Q.soft }}>
                          {t('Niveau {0}', { 0: u.level })}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {error && <p className="mt-1 text-sm font-bold text-[#c0392b]">{error}</p>}
          <button
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[16px] font-extrabold text-white shadow-[0_4px_0_#b5560f] transition-transform active:translate-y-[2px] active:shadow-[0_2px_0_#b5560f] disabled:opacity-50"
            style={{ background: Q.orange }}
            disabled={!chosen || busy || (money !== null && chosen.price > money)}
            onClick={() => void place(close)}
          >
            <MapPin size={18} /> {chosen ? t('Placer : {0}', { 0: chosen.label }) : t('Placer')}
          </button>
        </div>
      )}
    </Sheet>
  )
}
