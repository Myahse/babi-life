import { useEffect, useState } from 'react'
import { Heart, House } from 'lucide-react'
import { api } from '../lib/api'
import type { ActionResult } from '../lib/types'

// « Retrouver ma famille de la liste » (update « famille-liste »): a perso made
// on the wish list before the account took it over was born into another
// family. Its player is offered the list's one back: take it, or keep their
// own. Answered either way, the card never comes again (the server keeps it).

type Offer = NonNullable<Awaited<ReturnType<typeof api.listedFamily>>['offer']>

export function ListedFamily({ simId, onResult }: { simId: string; onResult: (res: ActionResult) => void }) {
  const [offer, setOffer] = useState<Offer | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let gone = false
    api
      .listedFamily(simId)
      .then((r) => !gone && setOffer(r.offer))
      .catch(() => undefined)
    return () => void (gone = true)
  }, [simId])
  if (!offer) return null
  const answer = async (accept: boolean) => {
    setBusy(true)
    try {
      onResult(await api.answerListedFamily(simId, accept))
    } catch {
      // Already answered elsewhere: nothing left to choose.
    }
    setOffer(null)
  }
  return (
    <div className="absolute inset-0 z-[49] flex flex-col justify-end bg-[#0f1230]/55 backdrop-blur-[3px] lg:items-center lg:justify-center">
      <div className="sheet animate-up w-full overflow-hidden rounded-t-[28px] !p-0 lg:w-[440px] lg:rounded-[28px]">
        <div className="bg-[var(--color-orange)] px-5 pt-5 pb-6 text-white">
          <span className="inline-flex -rotate-3 items-center gap-1.5 rounded-xl border-2 border-white bg-[#ffd43b] px-2.5 py-1 text-[13px] font-extrabold tracking-wide text-[#16161c] shadow-[0_4px_0_rgba(0,0,0,0.18)]">
            <Heart size={15} strokeWidth={2.8} /> TA FAMILLE
          </span>
          <div className="mt-3 font-display text-[27px] leading-[1.05] font-extrabold">Ta famille de la liste t'attend</div>
          <div className="mt-1 text-[13px] font-bold text-white/85">celle tirée au sort quand tu t'es inscrit·e</div>
        </div>
        <div className="h-1.5 bg-[var(--color-emerald)]" />
        <div className="space-y-2.5 px-5 pt-4">
          <p className="text-[15px] leading-snug font-bold text-[var(--color-ink)]">
            Sur la liste d'attente, tu étais né·e dans une famille <b>{offer.family.label.toLowerCase()}</b> à {offer.commune}. Tu veux la retrouver ?
          </p>
          <p className="flex gap-2 text-[13px] leading-snug font-bold text-[var(--color-ink-soft)]">
            <House size={16} className="mt-0.5 shrink-0" /> Si tu habites encore chez tes parents, ta maison devient la leur. Sinon, tu gardes ton chez-toi. Tu ne choisis qu'une fois.
          </p>
        </div>
        <div className="space-y-2 px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <button className="btn w-full" disabled={busy} onClick={() => void answer(true)}>
            Oui, je retrouve ma famille
          </button>
          <button className="btn btn-soft w-full" disabled={busy} onClick={() => void answer(false)}>
            Non, je garde la mienne
          </button>
        </div>
      </div>
    </div>
  )
}
