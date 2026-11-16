// « Gérer mon quartier » (update « mon-quartier », backend sims/monquartier.go; maquette 3 of the plan): the
// quartier's level and reputation, what its buildings bring a day and what waits in them (collected the tax
// off, under the rents' daily limit), each building with its people at work (hired or let go), and what the
// next levels unlock; « Construire » opens the building sheet. Its name and who may visit are at the bottom.

import { useCallback, useEffect, useState } from 'react'
import { Check, ChevronDown, Hammer, HandCoins, Lock, Minus, Pencil, Plus, Star, Users, X } from 'lucide-react'
import { api, errorText } from '../../lib/api'
import type { QuartierBuilding, QuartierView } from '../../lib/types'
import { SIM_CHANGED } from '../../lib/live'
import { amount } from '../../game/rules'
import { iconFor } from '../icons'
import { Sheet } from '../Sheet'
import { IconTile } from '../ui'
import { t } from '../../lib/i18n'
import { Construire, Q, type QuartierSheetProps } from './Construire'

/** What a building's tile says under its name. */
function line(b: QuartierBuilding): string {
  const day = b.perDay ?? 0
  if (b.staffMax && b.staff === 0) return t('Fermé : embauche quelqu’un')
  if (day > 0 && b.staffMax) return t('+{0} Djai/j · {1} au travail', { 0: amount(day), 1: b.staff })
  if (day > 0) return t('+{0} Djai/j', { 0: amount(day) })
  if (b.kind === 'grin') return t('Les habitués passent')
  return t('Ouvert')
}

export function GererQuartier({ simId, onClose, onPlace }: QuartierSheetProps) {
  const [view, setView] = useState<QuartierView | null>(null)
  const [error, setError] = useState('')
  const [said, setSaid] = useState('')
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState<number | null>(null)
  const [build, setBuild] = useState(false)
  const [naming, setNaming] = useState<string | null>(null)
  const load = useCallback(() => api.quartier(simId).then(setView, (e) => setError(errorText(e))), [simId])
  useEffect(() => {
    void load()
  }, [load])

  // An action on the quartier: its answer said, the Sim (money) and the quartier read again.
  const run = async (call: () => Promise<{ outcome: { text: string } }>) => {
    setBusy(true)
    setError('')
    try {
      const r = await call()
      setSaid(r.outcome.text)
      window.dispatchEvent(new CustomEvent(SIM_CHANGED, { detail: simId }))
      await load()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }
  const edit = async (change: { name?: string; visitsMode?: 'tous' | 'amis' }) => {
    try {
      const r = await api.quartierEdit(simId, change)
      setView((v) => v && { ...v, ...r })
      setNaming(null)
    } catch (e) {
      setError(errorText(e))
    }
  }

  if (build)
    return (
      <Construire
        simId={simId}
        view={view ?? undefined}
        onClose={() => (setBuild(false), void load())}
        onPlace={(kind, slot) => {
          onPlace(kind, slot)
          void load()
        }}
      />
    )

  const rep = view?.reputation ?? 0
  const from = view ? [0, 100, 300, 700, 1500][view.level - 1] ?? 0 : 0
  const to = view?.next?.reputation
  const progress = to ? Math.max(0, Math.min(1, (rep - from) / Math.max(1, to - from))) : 1
  const locked = (view?.unlocks ?? []).filter((u) => u.locked)
  return (
    <Sheet onClose={onClose} className="max-h-[90dvh] lg:w-[420px]">
      {(close) => (
        <div className="flex min-h-0 flex-col rounded-t-[28px] px-4 pt-7 lg:rounded-[28px]" style={{ background: Q.cream, color: Q.ink }}>
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              {naming === null ? (
                <h3 className="flex items-center gap-1.5 font-display text-[22px] leading-tight font-extrabold">
                  <span className="truncate">{view?.name ?? t('Mon quartier')}</span>
                  {view && (
                    <button className="grid size-7 shrink-0 place-items-center rounded-full bg-black/5" aria-label={t('Renommer')} onClick={() => setNaming(view.name)}>
                      <Pencil size={13} />
                    </button>
                  )}
                </h3>
              ) : (
                <form
                  className="flex items-center gap-1.5"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void edit({ name: naming })
                  }}
                >
                  <input className="min-w-0 flex-1 rounded-xl border-2 bg-white px-2.5 py-1.5 text-[16px] font-bold" style={{ borderColor: Q.line }} value={naming} maxLength={40} autoFocus onChange={(e) => setNaming(e.target.value)} />
                  <button className="grid size-9 place-items-center rounded-full text-white" style={{ background: Q.orange }} aria-label={t('Valider')}>
                    <Check size={17} />
                  </button>
                </form>
              )}
              {view && <div className="text-xs font-semibold" style={{ color: Q.soft }}>{view.communeName}</div>}
            </div>
            {view && (
              <span className="mt-1 shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold text-white" style={{ background: Q.orange }}>
                {t('Niveau {0}', { 0: view.level })}
              </span>
            )}
            <button className="grid size-9 shrink-0 place-items-center rounded-full bg-black/5" aria-label={t('Fermer')} onClick={close}>
              <X size={18} />
            </button>
          </div>

          <div className="-mx-4 mt-3 min-h-0 flex-1 overflow-y-auto px-4 pb-2">
            {!view && !error && <p className="py-10 text-center text-sm font-semibold" style={{ color: Q.soft }}>{t('Chargement…')}</p>}
            {view && (
              <>
                <div className="rounded-2xl p-3" style={{ background: Q.card }}>
                  <div className="flex items-center justify-between text-sm font-bold">
                    <span className="flex items-center gap-1">
                      <Star size={14} fill={Q.orange} color={Q.orange} /> {t('Réputation')}
                    </span>
                    <span>{to ? `${amount(rep)} / ${amount(to)}` : amount(rep)}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full" style={{ background: '#eadcc6' }}>
                    <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${progress * 100}%`, background: Q.orange }} />
                  </div>
                  {view.next && (
                    <p className="mt-1 text-[11px] font-semibold" style={{ color: Q.soft }}>
                      {t('Niveau {0} à {1} : de nouveaux bâtiments', { 0: view.next.level, 1: amount(view.next.reputation) })}
                    </p>
                  )}
                </div>

                <div className="mt-2 flex items-center gap-3 rounded-2xl p-3" style={{ background: Q.card }}>
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="text-xs font-bold" style={{ color: Q.soft }}>
                      {t('Revenus du jour')}
                    </div>
                    <div className="text-[20px] font-extrabold" style={{ color: Q.green }}>
                      {t('+{0} Djai', { 0: amount(view.perDay ?? 0) })}
                    </div>
                    <div className="text-[11px] font-semibold" style={{ color: Q.soft }}>
                      {t('{0} Djai t’attendent · encore {1} encaissables aujourd’hui', { 0: amount(view.pending ?? 0), 1: amount(view.left ?? 0) })}
                    </div>
                  </div>
                  <button
                    className="flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-extrabold text-white transition-transform active:scale-95 disabled:opacity-40"
                    style={{ background: Q.green }}
                    disabled={busy || !view.pending || !view.left}
                    onClick={() => void run(() => api.quartierCollect(simId))}
                  >
                    <HandCoins size={16} /> {t('Encaisser')}
                  </button>
                </div>

                {said && <p className="mt-2 rounded-xl px-3 py-2 text-xs font-bold" style={{ background: '#e3f2e8', color: Q.green }}>{said}</p>}

                <div className="mt-3 grid grid-cols-2 gap-1.5">
                  {view.home && (
                    <div className="rounded-xl border p-2.5" style={{ background: Q.tile, borderColor: Q.line }}>
                      <div className="flex items-center gap-1.5 text-[13px] font-extrabold">
                        <IconTile icon={iconFor('house')} colors={['#ffb066', Q.orange]} size={24} /> <span className="truncate">{t('Ma maison')}</span>
                      </div>
                      <div className="mt-0.5 text-[11px] font-semibold" style={{ color: Q.soft }}>
                        {t('Chez toi')}
                      </div>
                    </div>
                  )}
                  {view.buildings.map((b) => (
                    <button key={b.id} className="rounded-xl border p-2.5 text-left transition-transform active:scale-[0.97]" style={{ background: Q.tile, borderColor: open === b.id ? Q.orange : Q.line }} aria-expanded={open === b.id} onClick={() => setOpen(open === b.id ? null : b.id)}>
                      <div className="flex items-center gap-1.5 text-[13px] font-extrabold">
                        <IconTile icon={iconFor(b.icon)} colors={['#ffb066', Q.orange]} size={24} /> <span className="min-w-0 flex-1 truncate">{b.label}</span>
                        <ChevronDown size={14} className={`shrink-0 transition-transform ${open === b.id ? 'rotate-180' : ''}`} />
                      </div>
                      <div className="mt-0.5 text-[11px] font-semibold" style={{ color: b.staffMax && !b.staff ? '#c0392b' : Q.soft }}>
                        {line(b)}
                      </div>
                    </button>
                  ))}
                  {locked.map((u) => (
                    <div key={u.kind} className="rounded-xl border p-2.5 opacity-50" style={{ background: Q.tile, borderColor: Q.line }}>
                      <div className="flex items-center gap-1.5 text-[13px] font-extrabold">
                        <Lock size={13} className="shrink-0" /> <span className="truncate">{u.label}</span>
                      </div>
                      <div className="mt-0.5 text-[11px] font-semibold" style={{ color: Q.soft }}>
                        {t('Niveau {0}', { 0: u.level })}
                      </div>
                    </div>
                  ))}
                </div>

                {(() => {
                  const b = view.buildings.find((x) => x.id === open)
                  if (!b) return null
                  return (
                    <div className="mt-2 rounded-2xl p-3" style={{ background: Q.card }}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 leading-tight">
                          <div className="truncate text-sm font-extrabold">{b.label}</div>
                          <div className="text-[11px] font-semibold" style={{ color: Q.soft }}>
                            {t('{0} Djai t’attendent', { 0: amount(b.pending ?? 0) })}
                          </div>
                        </div>
                        <button className="flex shrink-0 items-center gap-1 rounded-xl px-2.5 py-2 text-xs font-extrabold text-white disabled:opacity-40" style={{ background: Q.green }} disabled={busy || !b.pending || !view.left} onClick={() => void run(() => api.quartierCollect(simId, b.id))}>
                          <HandCoins size={14} /> {t('Encaisser')}
                        </button>
                      </div>
                      {!!b.staffMax && (
                        <div className="mt-2 flex items-center gap-2">
                          <Users size={15} style={{ color: Q.soft }} />
                          <span className="flex-1 text-xs font-bold">{t('{0} sur {1} au travail', { 0: b.staff, 1: b.staffMax })}</span>
                          <button className="grid size-9 place-items-center rounded-full border-2 disabled:opacity-40" style={{ borderColor: Q.line }} aria-label={t('Renvoyer quelqu’un')} disabled={busy || b.staff <= 0} onClick={() => void run(() => api.quartierStaff(simId, b.id, -1))}>
                            <Minus size={16} />
                          </button>
                          <button className="grid size-9 place-items-center rounded-full text-white disabled:opacity-40" style={{ background: Q.orange }} aria-label={t('Embaucher')} disabled={busy || b.staff >= b.staffMax} onClick={() => void run(() => api.quartierStaff(simId, b.id, 1))}>
                            <Plus size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })()}

                <div className="mt-3 flex items-center gap-2 rounded-2xl p-3" style={{ background: Q.card }}>
                  <span className="flex-1 text-xs font-bold">{t('Qui peut visiter ?')}</span>
                  {(['tous', 'amis'] as const).map((m) => (
                    <button key={m} className="rounded-full px-3 py-1.5 text-xs font-extrabold" style={view.visitsMode === m ? { background: Q.ink, color: '#fff' } : { background: '#efe3cf', color: '#5a4332' }} aria-pressed={view.visitsMode === m} onClick={() => void edit({ visitsMode: m })}>
                      {m === 'tous' ? t('Tout le monde') : t('Mes amis')}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {error && <p className="mt-1 text-sm font-bold text-[#c0392b]">{error}</p>}
          <button
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[16px] font-extrabold text-white shadow-[0_4px_0_#b5560f] transition-transform active:translate-y-[2px] active:shadow-[0_2px_0_#b5560f] disabled:opacity-50"
            style={{ background: Q.orange }}
            disabled={!view}
            onClick={() => setBuild(true)}
          >
            <Hammer size={18} /> {t('Construire')}
          </button>
        </div>
      )}
    </Sheet>
  )
}
