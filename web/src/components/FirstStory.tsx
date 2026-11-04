import { Suspense, lazy, useEffect, useState } from 'react'
import { BookOpen, Clapperboard, Plane } from 'lucide-react'
import { api } from '../lib/api'
import type { Sim, StoryOffer } from '../lib/types'
import { hasFilm, loadScenario } from './prologue/lines'
import type { Scenario } from './prologue/types'
import { Sheet } from './Sheet'
import { t } from '../lib/i18n'

const PrologueFilm = lazy(() => import('./prologue/PrologueFilm').then((m) => ({ default: m.PrologueFilm })))

// Straight after the tuto (Play.tsx), the best of the game first: « Ta première histoire ». The stories
// offered (backend sims/histoires.go), each its giver and what it starts with; one tapped, it's begun and
// its prologue's film plays, then the player is in it (the goal under the mini-map shows the step).
// Nothing to show (a story already under way, none offered, the update closed): it's over at once.

export function FirstStory({ sim, onDone }: { sim: Sim; onDone: () => void }) {
  const [offers, setOffers] = useState<StoryOffer[] | null>(null)
  const [film, setFilm] = useState<Scenario | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    api
      .errands(sim.id)
      .then((r) => (!r.story && r.choices?.length && !r.startsTomorrow ? setOffers(r.choices) : onDone()))
      .catch(onDone)
  }, [sim.id, onDone])

  const pick = async (o: StoryOffer) => {
    if (busy) return
    setBusy(true)
    try {
      await api.pickStory(sim.id, o.id)
      const s = hasFilm(o.id) ? await loadScenario(o.id) : null
      if (s) setFilm(s)
      else onDone()
    } catch {
      onDone()
    }
  }

  if (film)
    return (
      <Suspense fallback={null}>
        <PrologueFilm scenario={film} onClose={onDone} />
      </Suspense>
    )
  if (!offers) return null
  return (
    <Sheet onClose={onDone} className="max-h-[85%] overflow-y-auto p-4 lg:w-[460px]">
      {(close) => (
        <>
          <div className="-mx-4 -mt-4 mb-3 rounded-t-[28px] bg-[linear-gradient(180deg,#7048e833,#7048e800)] px-4 pt-6 pb-2">
            <div className="label">{t('Ta première histoire')}</div>
            <div className="font-display text-[23px] leading-tight font-extrabold">{t('Le quartier a besoin de toi')}</div>
            <p className="mt-1 text-[13px] font-bold text-[var(--color-ink-soft)]">{t('Choisis une histoire : un chapitre par jour, un film pour chacun, et une épreuve rien qu’à elle.')}</p>
          </div>
          <div className="grid gap-2.5">
            {offers.map((o) => (
              <button key={o.id} disabled={busy} onClick={() => void pick(o)} className="rounded-[20px] bg-white p-3.5 text-left shadow-sm ring-1 ring-black/5 transition active:scale-[0.98] disabled:opacity-60">
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#7048e8] text-white">
                    <BookOpen size={18} strokeWidth={2.6} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-[16.5px] leading-tight font-extrabold">{o.title}</span>
                    <span className="block text-[12px] font-bold text-[var(--color-ink-soft)]">
                      {o.giver} · {t('{n} chapitres', { n: o.chapters })}
                      {o.trips?.length ? (
                        <span className="ml-1 inline-flex items-center gap-0.5">
                          · <Plane size={11} strokeWidth={2.8} /> {o.trips.join(', ')}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </div>
                <p className="mt-2 line-clamp-3 text-[13px] leading-snug font-semibold text-[var(--color-ink)]">« {o.teaser} »</p>
                <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-[#1a1410] px-3.5 py-1.5 text-[12.5px] font-extrabold text-[#ffd43b]">
                  <Clapperboard size={14} strokeWidth={2.6} /> {hasFilm(o.id) ? t('Commencer · le film') : t('Commencer')}
                </span>
              </button>
            ))}
          </div>
          <button className="mt-3 w-full rounded-2xl py-2.5 text-sm font-extrabold text-[var(--color-ink-soft)]" onClick={close}>
            {t('Plus tard (dans l’appli « Demandes »)')}
          </button>
        </>
      )}
    </Sheet>
  )
}
