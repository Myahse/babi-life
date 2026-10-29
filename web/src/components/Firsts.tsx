import { useEffect, useRef, useState } from 'react'
import { Check, Sparkles, X } from 'lucide-react'
import { api } from '../lib/api'
import type { ActionResult } from '../lib/types'
import { iconFor as iconOf } from './icons'

// A baby's « premières fois » (update « premieres-fois », backend
// sims/firsts.go): a chip « Premières fois 3/8 » that opens the list (what's
// done, what brings the others), and a card when a new one comes. And its
// choices that count (update « choix-bebe »): the toy it goes for, its first
// word, chosen while it does « Choisir parmi les jouets », « Dire son premier
// mot ».

type View = Awaited<ReturnType<typeof api.firsts>>

/** The list, fetched again when `again` changes (an action started or ended). */
export function useFirsts(simId: string, on: boolean, again: string) {
  const [view, setView] = useState<View | null>(null)
  useEffect(() => {
    if (!on) return
    let gone = false
    api
      .firsts(simId)
      .then((v) => !gone && setView(v))
      .catch(() => undefined)
    return () => void (gone = true)
  }, [simId, on, again])
  return [view, setView] as const
}

/** The chip, and the card for each new « première fois ». */
export function FirstsChip({ view, className = '' }: { view: View; className?: string }) {
  const [open, setOpen] = useState(false)
  const [fresh, setFresh] = useState<View['list'][number] | null>(null)
  const known = useRef<string[] | null>(null)
  useEffect(() => {
    const was = known.current
    known.current = view.done
    if (!was) return
    const nu = view.done.find((d) => !was.includes(d))
    const f = nu && view.list.find((x) => x.id === nu)
    if (!f) return
    setFresh(f)
    const k = setTimeout(() => setFresh(null), 4500)
    return () => clearTimeout(k)
  }, [view])
  const n = view.done.length
  const all = view.list.length
  return (
    <>
      <button className={`hud pointer-events-auto flex items-center gap-2 rounded-full py-1.5 pr-3 pl-1.5 text-[13px] font-extrabold ${className}`} onClick={() => setOpen(true)}>
        <span className="grid h-7 w-7 place-items-center rounded-full bg-[#ffd43b] text-[#16161c]">
          <Sparkles size={15} strokeWidth={2.6} />
        </span>
        Premières fois {n}/{all}
        <span className="h-1.5 w-12 overflow-hidden rounded-full bg-black/10">
          <span className="block h-full rounded-full bg-[var(--color-emerald)]" style={{ width: `${(n / all) * 100}%` }} />
        </span>
      </button>
      {fresh && (
        <div className="animate-pop pointer-events-none fixed inset-x-4 top-[30%] z-[60] mx-auto max-w-[360px] rounded-[26px] bg-white p-5 text-center shadow-2xl">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#ffd43b] text-[#16161c]">{(() => { const I = iconOf(fresh.icon); return <I size={28} strokeWidth={2.4} /> })()}</div>
          <div className="mt-2 text-[12px] font-extrabold tracking-wider text-[var(--color-orange)] uppercase">Première fois !</div>
          <div className="font-display text-[22px] leading-tight font-extrabold text-[var(--color-ink)]">{fresh.label}</div>
          <div className="mt-1 text-[13px] font-bold text-[var(--color-ink-soft)]">
            {view.done.length}/{view.list.length} premières fois
          </div>
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-[#0f1230]/55 backdrop-blur-[3px] lg:items-center lg:justify-center" onClick={() => setOpen(false)}>
          <div className="sheet animate-up w-full rounded-t-[28px] px-5 pt-5 lg:w-[420px] lg:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-display text-[22px] font-extrabold">Mes premières fois</div>
                <div className="text-[13px] font-bold text-[var(--color-ink-soft)]">
                  {n === all ? 'Toutes ! Le bébé est aux anges.' : `${n} sur ${all} : fais ce qu'il faut pour les autres`}
                </div>
              </div>
              <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Fermer">
                <X size={20} />
              </button>
            </div>
            <ul className="mt-3 space-y-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
              {view.list.map((f) => {
                const done = view.done.includes(f.id)
                const I = iconOf(f.icon)
                return (
                  <li key={f.id} className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${done ? 'bg-[#d3f9d8]' : 'bg-black/[0.04]'}`}>
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${done ? 'bg-[var(--color-emerald)] text-white' : 'bg-white text-[var(--color-ink-soft)]'}`}>{done ? <Check size={18} strokeWidth={3} /> : <I size={18} />}</span>
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block text-[14px] font-extrabold">{f.label}</span>
                      <span className="block text-[12px] font-bold text-[var(--color-ink-soft)]">{done ? 'Fait !' : f.how}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  )
}

/** The choice of the moment (« jouets »: the toy, « premier-mot »: the word), once; nothing if already made. */
export function ChoiceSheet({ simId, kind, view, onResult, onDone }: { simId: string; kind: 'talent' | 'mot'; view: View; onResult: (r: ActionResult) => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  if (kind === 'talent' ? view.talent : view.word) return null
  const pick = async (value: string) => {
    setBusy(true)
    try {
      onResult(await api.choose(simId, kind, value))
    } catch {
      // Already chosen (another device): nothing more to choose.
    }
    onDone()
  }
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-[#0f1230]/55 backdrop-blur-[3px] lg:items-center lg:justify-center">
      <div className="sheet animate-up w-full rounded-t-[28px] px-5 pt-5 lg:w-[420px] lg:rounded-[28px]">
        <div className="font-display text-[22px] font-extrabold">{kind === 'talent' ? 'Quel jouet attraper ?' : 'Son premier mot ?'}</div>
        <p className="mt-1 text-[13px] font-bold text-[var(--color-ink-soft)]">{kind === 'talent' ? "Ce qu'il choisit, l'enfant le gardera : un talent pour toute la vie." : 'Toute la famille va le répéter, et on l’entendra encore longtemps. On ne choisit qu’une fois.'}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {kind === 'talent'
            ? view.talents.map((t) => {
                const I = iconOf(t.icon)
                return (
                  <button key={t.id} disabled={busy} className="flex flex-col items-center gap-1.5 rounded-2xl bg-black/[0.04] p-3 text-center active:scale-95" onClick={() => void pick(t.id)}>
                    <span className="grid h-11 w-11 place-items-center rounded-full bg-[#ffd43b] text-[#16161c]">
                      <I size={22} />
                    </span>
                    <span className="text-[14px] font-extrabold">{t.label}</span>
                    <span className="text-[11px] leading-snug font-bold text-[var(--color-ink-soft)]">{t.gift}</span>
                  </button>
                )
              })
            : view.words.map((w) => (
                <button key={w} disabled={busy} className="rounded-2xl bg-black/[0.04] px-3 py-4 font-display text-[18px] font-extrabold active:scale-95" onClick={() => void pick(w)}>
                  « {w} »
                </button>
              ))}
        </div>
      </div>
    </div>
  )
}
