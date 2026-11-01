import { useEffect, useState } from 'react'
import { ChevronDown, ShieldCheck } from 'lucide-react'
import { api, errorText, type CasinoLimits as Limits } from '../lib/api'
import { t as tr, tx, locale } from '../lib/i18n'

// « Mes limites » (backend sims/limits.go): the player sets the most they stake a day at the money games,
// all of them together (the casino, the machines, the bingo), or takes a break from them. Lower: at once;
// higher or none: in 24 hours. A break can't be cut short. Folded until opened.

const nf = (n: number) => n.toLocaleString(locale())
const when = (iso: string) => new Date(iso).toLocaleString(locale(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const CHOICES = [1000, 5000, 20000, 50000, 0]

export function CasinoLimits({ tick }: { tick?: unknown }) {
  const [open, setOpen] = useState(false)
  const [l, setL] = useState<Limits | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<'24h' | '7j' | '30j' | null>(null)
  useEffect(() => {
    if (!open) return
    api.casinoLimits().then(setL, (e) => setError(errorText(e, tr('Erreur'))))
  }, [open, tick])
  const set = async (b: Parameters<typeof api.setCasinoLimits>[0]) => {
    setBusy(true)
    setError(null)
    try {
      setL(await api.setCasinoLimits(b))
      setConfirm(null)
    } catch (e) {
      setError(errorText(e, tr('Erreur')))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="mt-3 rounded-2xl bg-black/25 text-white">
      <button className="flex w-full items-center gap-2 px-3 py-2.5 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <ShieldCheck size={18} className="shrink-0 text-[#7cfc9a]" />
        <span className="flex-1 text-[14px] font-extrabold">{tr('Mes limites')}</span>
        {l?.pauseUntil ? <span className="text-[11.5px] font-bold text-[#ffe08a]">{tr('En pause')}</span> : l && l.daily > 0 ? <span className="text-[11.5px] font-bold text-white/70">{tx('{0} Djai par jour', { 0: nf(l.daily) })}</span> : null}
        <ChevronDown size={18} className={`transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-3 pb-3 text-[12.5px] leading-snug font-bold">
          {!l ? (
            <p className="text-white/60">{error ?? tr('Chargement…')}</p>
          ) : (
            <>
              <p className="text-white/75">{tr("Pour tous les jeux d'argent ensemble : le casino, les machines et le bingo. Baisser compte tout de suite ; monter ou enlever, seulement dans 24 heures.")}</p>
              <div className="mt-2 rounded-xl bg-white/10 px-3 py-2">
                {tx("Misé aujourd'hui : {0} Djai", { 0: nf(l.today) })}
                {l.daily > 0 && <> · {tx('reste {0}', { 0: nf(Math.max(0, l.daily - l.today)) })}</>}
              </div>
              {l.pauseUntil ? (
                <p className="mt-2 rounded-xl bg-[#ffe08a]/15 px-3 py-2 text-[#ffe08a]">{tx("En pause jusqu'au {0}. Les jeux d'argent reviennent à la fin de ta pause.", { 0: when(l.pauseUntil) })}</p>
              ) : (
                <>
                  <div className="mt-3 text-[11px] font-extrabold tracking-wider text-white/60 uppercase">{tr('Mise maximale par jour')}</div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {CHOICES.map((c) => {
                      const on = (l.pending ?? l.daily) === c
                      return (
                        <button key={c} disabled={busy} className={`rounded-full px-3 py-1.5 text-[12.5px] font-extrabold transition active:scale-95 ${on ? 'bg-[#ffcc33] text-[#0b3d26]' : 'bg-white/15'}`} onClick={() => void set({ daily: c })}>
                          {c ? nf(c) : tr('Aucune')}
                        </button>
                      )
                    })}
                  </div>
                  {l.pending !== undefined && l.pendingAt && <p className="mt-2 text-white/70">{tx('Ta nouvelle limite ({0}) compte à partir du {1}.', { 0: l.pending ? tx('{0} Djai', { 0: nf(l.pending) }) : tr('aucune'), 1: when(l.pendingAt) })}</p>}
                  <div className="mt-3 text-[11px] font-extrabold tracking-wider text-white/60 uppercase">{tr('Faire une pause')}</div>
                  {confirm ? (
                    <div className="mt-1.5 rounded-xl bg-white/10 p-2.5">
                      <p>{tr("Pendant la pause, plus de jeux d'argent, et on ne peut pas l'arrêter avant la fin. Sûr ?")}</p>
                      <div className="mt-2 flex gap-2">
                        <button disabled={busy} className="flex-1 rounded-full bg-[#ffcc33] py-1.5 font-extrabold text-[#0b3d26]" onClick={() => void set({ pause: confirm })}>
                          {tr('Oui, faire la pause')}
                        </button>
                        <button className="flex-1 rounded-full bg-white/15 py-1.5 font-extrabold" onClick={() => setConfirm(null)}>
                          {tr('Annuler')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1.5 flex gap-1.5">
                      {(
                        [
                          ['24h', tr('24 heures')],
                          ['7j', tr('7 jours')],
                          ['30j', tr('30 jours')],
                        ] as const
                      ).map(([k, label]) => (
                        <button key={k} className="flex-1 rounded-full bg-white/15 py-1.5 text-[12.5px] font-extrabold transition active:scale-95" onClick={() => setConfirm(k)}>
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
              {error && <p className="mt-2 text-[#ffb3b3]">{error}</p>}
            </>
          )}
        </div>
      )}
    </div>
  )
}
