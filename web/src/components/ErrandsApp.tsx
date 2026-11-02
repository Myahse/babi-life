import { useEffect, useState } from 'react'
import { BookOpen, Check, HandHelping, Moon, Navigation } from 'lucide-react'
import { api, errorText } from '../lib/api'
import type { Errand, QuartierStory, Sim } from '../lib/types'
import { Portrait } from '../avatar/portrait'
import { randomLook } from '../avatar/options'
import { rng } from '../world3d/themes'
import { amount } from '../game/rules'
import { t } from '../lib/i18n'

// The quartier's demandes, in the phone (backend sims/errands.go, the update
// « demandes »): who asks what today, the step each is at, « Y aller » to the
// nearest place for the next one, and the thanks once it's done.

export function ErrandsApp({ sim, onGo }: { sim: Sim; onGo: (kind: string) => void }) {
  const [list, setList] = useState<Errand[] | null>(null)
  const [story, setStory] = useState<QuartierStory | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    api
      .errands(sim.id)
      .then((r) => (setList(r.errands), setStory(r.story ?? null)))
      .catch((e) => setErr(errorText(e, t('Le quartier ne répond pas. Réessaie.'))))
    // The journal moves on as activities end: read again then.
  }, [sim.id, sim.activity?.end])
  if (err) return <p className="p-2 text-sm font-bold text-[#c92a2a]">{err}</p>
  if (!list) return <p className="p-2 text-sm font-bold text-[var(--color-ink-soft)]">…</p>
  if (!list.length && !story) return <p className="p-2 text-sm font-bold text-[var(--color-ink-soft)]">{t("Personne n'a rien à te demander aujourd'hui. Reviens demain !")}</p>
  const left = list.filter((e) => !e.done).length
  return (
    <div className="space-y-3">
      <p className="text-sm font-bold text-[var(--color-ink-soft)]">{left ? t('Les gens de ton quartier comptent sur toi. Nouvelles demandes chaque jour à minuit.') : t('Tout est fait pour aujourd’hui : le quartier te remercie ! Nouvelles demandes à minuit.')}</p>
      {story && <StoryCard s={story} onGo={onGo} />}
      {list.map((e) => (
        <ErrandCard key={e.id} e={e} onGo={onGo} />
      ))}
    </div>
  )
}

/** The story under way: its title and chapter, today's ask and steps, or « la suite demain ». */
function StoryCard({ s, onGo }: { s: QuartierStory; onGo: (kind: string) => void }) {
  const look = randomLook(s.gender, rng(`errand:${s.giver}`))
  const next = s.steps[s.step]
  return (
    <div className="rounded-2xl bg-gradient-to-b from-[#fff3d6] to-[#ffe7b3] p-3 shadow-[inset_0_0_0_2px_#ffd36e]">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-extrabold tracking-wide text-[#a86800] uppercase">
        <BookOpen size={14} strokeWidth={2.6} /> {t('Histoire · chapitre {n} sur {of}', { n: s.chapter + 1, of: s.chapters })}
      </div>
      <div className="font-display text-[18px] leading-tight font-extrabold">{s.title}</div>
      <div className="mt-2 flex items-center gap-3">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-gradient-to-b from-[#ffd36e] to-[#ff8a3d] ring-2 ring-white">
          <Portrait look={look} gender={s.gender} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-[16px] leading-tight font-extrabold">{s.giver}</div>
          <div className="text-xs font-bold text-[var(--color-ink-soft)]">{s.role}</div>
        </div>
        {!s.waiting && <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[11px] font-extrabold text-[#a86800]">{t('+{0} Djai', { 0: amount(s.reward) })}</span>}
      </div>
      {s.waiting ? (
        <>
          {s.said && <p className="mt-2 rounded-2xl bg-white p-2.5 text-[13.5px] leading-snug font-bold">« {s.said} »</p>}
          <p className="mt-2 flex items-center gap-2 text-[13px] font-extrabold text-[#a86800]">
            <Moon size={15} strokeWidth={2.6} /> {s.chapter ? t('La suite demain.') : t('Rendez-vous demain pour une nouvelle histoire.')}
          </p>
        </>
      ) : (
        <>
          <p className="mt-2 rounded-2xl bg-white p-2.5 text-[13.5px] leading-snug font-bold">« {s.ask} »</p>
          <ul className="mt-2 space-y-1">
            {s.steps.map((st, i) => (
              <li key={i} className={`flex items-center gap-2 text-[13px] font-bold ${i < s.step ? 'text-[#2b8a3e]' : i === s.step ? '' : 'text-[var(--color-ink-soft)]'}`}>
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${i < s.step ? 'bg-[#2b8a3e] text-white' : 'bg-white shadow-[inset_0_0_0_2px_var(--color-line)]'}`}>{i < s.step && <Check size={13} strokeWidth={3} />}</span>
                {st.text}
              </li>
            ))}
          </ul>
          {next && (
            <button className="btn mt-2 w-full !py-2" onClick={() => onGo(next.kind)}>
              <Navigation size={16} strokeWidth={2.6} /> {t('Y aller')}
            </button>
          )}
        </>
      )}
    </div>
  )
}

function ErrandCard({ e, onGo }: { e: Errand; onGo: (kind: string) => void }) {
  const look = randomLook(e.gender, rng(`errand:${e.giver}`))
  const next = e.steps[e.step]
  return (
    <div className={`rounded-2xl p-3 ${e.done ? 'bg-[#ebfbee]' : 'bg-[var(--color-canvas)]'}`}>
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-gradient-to-b from-[#ffd36e] to-[#ff8a3d] ring-2 ring-white">
          <Portrait look={look} gender={e.gender} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-[16px] leading-tight font-extrabold">{e.giver}</div>
          <div className="text-xs font-bold text-[var(--color-ink-soft)]">{e.role}</div>
        </div>
        <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[11px] font-extrabold text-[#a86800]">{t('+{0} Djai', { 0: amount(e.reward) })}</span>
      </div>
      <p className="mt-2 rounded-2xl bg-white p-2.5 text-[13.5px] leading-snug font-bold">« {e.done ? e.thanks : e.ask} »</p>
      <ul className="mt-2 space-y-1">
        {e.steps.map((s, i) => (
          <li key={i} className={`flex items-center gap-2 text-[13px] font-bold ${i < e.step || e.done ? 'text-[#2b8a3e]' : i === e.step ? '' : 'text-[var(--color-ink-soft)]'}`}>
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${i < e.step || e.done ? 'bg-[#2b8a3e] text-white' : 'bg-white shadow-[inset_0_0_0_2px_var(--color-line)]'}`}>{(i < e.step || e.done) && <Check size={13} strokeWidth={3} />}</span>
            {s.text}
          </li>
        ))}
      </ul>
      {!e.done && next && (
        <button className="btn mt-2 w-full !py-2" onClick={() => onGo(next.kind)}>
          <Navigation size={16} strokeWidth={2.6} /> {t('Y aller')}
        </button>
      )}
    </div>
  )
}

/**
 * The HUD chip: the demandes left today, always in sight, so there's always
 * something to go and do; a tap opens them in the phone. `seen` changes when
 * the Sim's journal does (an activity ended), to read them again.
 */
export function ErrandsChip({ sim, seen, onOpen }: { sim: Sim; seen: unknown; onOpen: () => void }) {
  const [left, setLeft] = useState<number | null>(null)
  useEffect(() => {
    api
      .errands(sim.id)
      .then((r) => setLeft(r.errands.filter((e) => !e.done).length + (r.story && !r.story.waiting ? 1 : 0)))
      .catch(() => setLeft(null))
  }, [sim.id, seen])
  if (left === null) return null
  return (
    <button className="hud pointer-events-auto relative flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-extrabold transition active:scale-95" onClick={onOpen} aria-label={t('Demandes du quartier')}>
      <HandHelping size={18} strokeWidth={2.6} className={left ? 'text-[#2b8a3e]' : 'text-[var(--color-ink-soft)]'} />
      <span className="max-sm:hidden short:hidden">{left ? t('Demandes') : t('Tout est fait')}</span>
      {left > 0 && <span className="absolute -top-1.5 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#2b8a3e] px-1 text-[11px] text-white ring-2 ring-white">{left}</span>}
    </button>
  )
}
