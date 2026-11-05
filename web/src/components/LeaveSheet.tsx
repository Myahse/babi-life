import { Heart, LogOut } from 'lucide-react'
import { Portrait } from '../avatar/portrait'
import type { Sim } from '../lib/types'
import { clock } from '../game/rules'
import { t } from '../lib/i18n'

// « Sortir » on the profile: one last word before the account signs out. The Sim waiting,
// what's on in Babi at this hour, and the reminder that leaving the app is enough (the Sim
// is paused while nobody plays). « Je reste » first; signing out stays one tap away.

/** What Babi is up to at this hour of the game's day. */
function nowInBabi(hour: number) {
  if (hour < 6) return t('les boîtes de nuit sont encore pleines')
  if (hour < 11) return t('le garba du matin est tout chaud')
  if (hour < 15) return t("c'est l'heure du déjeuner au maquis")
  if (hour < 19) return t('les matchs commencent au quartier')
  return t('la Rue Princesse s’allume')
}

export function LeaveSheet({ sim, onStay, onLeave, onClose }: { sim: Sim; /** « Je reste »: back into the game. */ onStay: () => void; onLeave: () => void; /** Tapped beside the sheet: just closed. */ onClose: () => void }) {
  const c = clock(sim.gameMinutes)
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-[#0f1230]/55 backdrop-blur-[3px] lg:items-center lg:justify-center" onClick={onClose}>
      <div className="sheet animate-up w-full rounded-t-[28px] p-5 pb-[max(1.25rem,var(--sab,env(safe-area-inset-bottom)))] lg:w-[420px] lg:rounded-[28px]" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-center gap-3">
          <span className="block h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-[#ffe8cc]">
            <Portrait look={sim.look} gender={sim.gender} framing="head" />
          </span>
          <div className="min-w-0">
            <div className="font-display text-[22px] leading-tight font-extrabold">{t('Tu pars déjà ?')}</div>
            <p className="mt-1 text-[14px] leading-snug font-bold text-[var(--color-ink-soft)]">{t('{firstName} va t’attendre… Il est {hour} h à Babi : {now}.', { firstName: sim.firstName, hour: c.hour, now: nowInBabi(c.hour) })}</p>
          </div>
        </div>
        <p className="mt-4 rounded-2xl bg-[#e6fcf5] px-3.5 py-2.5 text-[13.5px] leading-snug font-bold text-[var(--color-emerald-deep)]">
          {t("Pas besoin de te déconnecter : ferme simplement l'appli. Ta vie à Babi se met en pause et tu reprends là où tu en étais.")}
        </p>
        <button className="btn mt-4 w-full" onClick={onStay} autoFocus>
          <Heart size={18} /> {t('Je reste à Babi')}
        </button>
        <button className="mt-2 flex w-full items-center justify-center gap-1.5 py-2 text-[14px] font-extrabold text-[var(--color-ink-soft)] underline underline-offset-4" onClick={onLeave}>
          <LogOut size={15} /> {t('Me déconnecter quand même')}
        </button>
      </div>
    </div>
  )
}
