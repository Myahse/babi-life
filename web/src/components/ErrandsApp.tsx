import { lazy, Suspense, useEffect, useState } from 'react'
import { BookOpen, Check, Clapperboard, HandHelping, Map as MapIcon, Moon, Navigation, Plane, Sparkles, Square, Volume2 } from 'lucide-react'
import { api, errorText } from '../lib/api'
import type { Errand, ErrandStep, QuartierStory, Sim, StoriesView, StoryOffer } from '../lib/types'
import { Portrait } from '../avatar/portrait'
import { randomLook } from '../avatar/options'
import { rng } from '../world3d/themes'
import { amount } from '../game/rules'
import { t } from '../lib/i18n'
import { narrate, useNarrated } from '../lib/narration'
import { PROLOGUES, loadScenario } from './prologue/lines'
import type { Scenario } from './prologue/types'

// The stories' prologues as a film and as a comic (components/prologue), loaded when opened.
const PrologueFilm = lazy(() => import('./prologue/PrologueFilm').then((m) => ({ default: m.PrologueFilm })))
const PrologueBD = lazy(() => import('./prologue/PrologueBD').then((m) => ({ default: m.PrologueBD })))

// The quartier's demandes, in the phone (backend sims/errands.go, the update
// « demandes »): who asks what today, the step each is at, « Y aller » to the
// nearest place for the next one, and the thanks once it's done.

export function ErrandsApp({ sim, onGo }: { sim: Sim; onGo: (step: ErrandStep) => void }) {
  const [list, setList] = useState<Errand[] | null>(null)
  const [stories, setStories] = useState<StoriesView>({})
  const [err, setErr] = useState('')
  const [picking, setPicking] = useState('')
  const story = stories.story ?? null
  const pick = async (id: string) => {
    setPicking(id)
    try {
      setStories(await api.pickStory(sim.id, id))
    } catch (e) {
      setErr(errorText(e, t('Le quartier ne répond pas. Réessaie.')))
    } finally {
      setPicking('')
    }
  }
  useEffect(() => {
    api
      .errands(sim.id)
      .then((r) => (setList(r.errands), setStories(r)))
      .catch((e) => setErr(errorText(e, t('Le quartier ne répond pas. Réessaie.'))))
    // The journal moves on as activities end: read again then.
  }, [sim.id, sim.activity?.end])
  if (err) return <p className="p-2 text-sm font-bold text-[#c92a2a]">{err}</p>
  if (!list) return <p className="p-2 text-sm font-bold text-[var(--color-ink-soft)]">…</p>
  if (!list.length && !story && !stories.choices?.length) return <p className="p-2 text-sm font-bold text-[var(--color-ink-soft)]">{t("Personne n'a rien à te demander aujourd'hui. Reviens demain !")}</p>
  const left = list.filter((e) => !e.done).length
  return (
    <div className="space-y-3">
      <p className="text-sm font-bold text-[var(--color-ink-soft)]">{left ? t('Les gens de ton quartier comptent sur toi. Nouvelles demandes chaque jour à minuit.') : t('Tout est fait pour aujourd’hui : le quartier te remercie ! Nouvelles demandes à minuit.')}</p>
      {story && <StoryCard s={story} sim={sim} onGo={onGo} />}
      {!story && !!stories.choices?.length && <StoryChoice offers={stories.choices} tomorrow={!!stories.startsTomorrow} picking={picking} onPick={(id) => void pick(id)} />}
      {list.map((e) => (
        <ErrandCard key={e.id} e={e} sim={sim} onGo={onGo} />
      ))}
    </div>
  )
}

/** The story under way: its title and chapter, today's ask and steps, or « la suite demain ». */
function StoryCard({ s, sim, onGo }: { s: QuartierStory; sim: Sim; onGo: (step: ErrandStep) => void }) {
  const look = randomLook(s.gender, rng(`errand:${s.giver}`))
  const next = s.steps[s.step]
  return (
    <div className="rounded-2xl bg-gradient-to-b from-[#fff3d6] to-[#ffe7b3] p-3 shadow-[inset_0_0_0_2px_#ffd36e]">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-extrabold tracking-wide text-[#a86800] uppercase">
        <BookOpen size={14} strokeWidth={2.6} /> {t('Histoire · chapitre {n} sur {of}', { n: s.chapter + 1, of: s.chapters })}
      </div>
      <div className="font-display text-[18px] leading-tight font-extrabold">{s.title}</div>
      {/* The prologue: told in full before the first step, then folded away, to read again. */}
      {s.chapter === 0 && s.step === 0 && !s.waiting ? (
        <>
          <p className="mt-1.5 text-[13px] leading-snug font-semibold text-[#7a5200] italic">{s.prologue}</p>
          <Watch id={s.id} />
          <Listen id={s.id} />
        </>
      ) : (
        <details className="mt-1">
          <summary className="cursor-pointer text-[12px] font-extrabold text-[#a86800]">{t("Le début de l'histoire")}</summary>
          <p className="mt-1 text-[13px] leading-snug font-semibold text-[#7a5200] italic">{s.prologue}</p>
          <Watch id={s.id} />
          <Listen id={s.id} />
        </details>
      )}
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
            <button className="btn mt-2 w-full !py-2" onClick={() => onGo(next)}>
              {next.city && next.city !== sim.city ? (
                <>
                  <MapIcon size={16} strokeWidth={2.6} /> {t('Voyager')}
                </>
              ) : (
                <>
                  <Navigation size={16} strokeWidth={2.6} /> {t('Y aller')}
                </>
              )}
            </button>
          )}
        </>
      )}
    </div>
  )
}

/** The story's beginning as a film or a comic (components/prologue), for a story whose prologue is written. */
function Watch({ id }: { id: string }) {
  const [open, setOpen] = useState<{ kind: 'film' | 'bd'; s: Scenario } | null>(null)
  if (!PROLOGUES.includes(id)) return null
  const show = (kind: 'film' | 'bd') => void loadScenario(id).then((s) => s && setOpen({ kind, s }))
  return (
    <>
      <div className="mt-2 flex gap-2">
        <button className="flex items-center gap-1.5 rounded-full bg-[#1a1410] px-3.5 py-1.5 text-[12.5px] font-extrabold text-[#ffd43b] active:scale-95" onClick={() => show('film')}>
          <Clapperboard size={14} strokeWidth={2.6} /> {t('Le film')}
        </button>
        <button className="flex items-center gap-1.5 rounded-full bg-[#1f8f88] px-3.5 py-1.5 text-[12.5px] font-extrabold text-[#fbf5e6] active:scale-95" onClick={() => show('bd')}>
          <BookOpen size={14} strokeWidth={2.6} /> {t('La BD')}
        </button>
      </div>
      {open && <Suspense fallback={null}>{open.kind === 'film' ? <PrologueFilm scenario={open.s} onClose={() => setOpen(null)} /> : <PrologueBD scenario={open.s} onClose={() => setOpen(null)} />}</Suspense>}
    </>
  )
}

/** « Écouter » : the prologue read by the narrator, for a story whose voice is recorded (lib/narration.ts). */
function Listen({ id }: { id: string }) {
  const on = useNarrated(id)
  const [playing, setPlaying] = useState(false)
  if (!on) return null
  return (
    <button className="mt-1.5 flex items-center gap-1.5 rounded-full bg-[#fff8e1] px-3 py-1 text-[12px] font-extrabold text-[#a86800] active:scale-95" onClick={() => setPlaying(narrate(id, () => setPlaying(false)))}>
      {playing ? <Square size={13} strokeWidth={2.8} /> : <Volume2 size={14} strokeWidth={2.6} />} {playing ? t('Arrêter') : t('Écouter')}
    </button>
  )
}

/** No story under way: pick the next among a few, each with who tells it, how it starts and where it goes. */
function StoryChoice({ offers, tomorrow, picking, onPick }: { offers: StoryOffer[]; tomorrow: boolean; picking: string; onPick: (id: string) => void }) {
  return (
    <div className="rounded-2xl bg-gradient-to-b from-[#fff3d6] to-[#ffe7b3] p-3 shadow-[inset_0_0_0_2px_#ffd36e]">
      <div className="flex items-center gap-1.5 text-[11px] font-extrabold tracking-wide text-[#a86800] uppercase">
        <Sparkles size={14} strokeWidth={2.6} /> {t('Nouvelle histoire')}
      </div>
      <div className="font-display text-[18px] leading-tight font-extrabold">{t('Choisis ta prochaine histoire')}</div>
      <p className="mt-0.5 text-[12.5px] font-bold text-[var(--color-ink-soft)]">{tomorrow ? t('Elle commencera demain : un chapitre par jour.') : t('Un chapitre par jour. Les autres attendront ton retour.')}</p>
      <div className="mt-2 space-y-2">
        {offers.map((o) => (
          <div key={o.id} className="rounded-2xl bg-white p-2.5">
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gradient-to-b from-[#ffd36e] to-[#ff8a3d] ring-2 ring-white">
                <Portrait look={randomLook(o.gender, rng(`errand:${o.giver}`))} gender={o.gender} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display text-[15.5px] leading-tight font-extrabold">{o.title}</div>
                <div className="truncate text-[11.5px] font-bold text-[var(--color-ink-soft)]">
                  {o.giver} · {o.role}
                </div>
              </div>
            </div>
            <p className="mt-1.5 text-[13px] leading-snug font-semibold text-[var(--color-ink-soft)] italic">{o.prologue}</p>
            <Watch id={o.id} />
            <Listen id={o.id} />
            <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] font-extrabold">
              <span className="rounded-full bg-[var(--color-canvas)] px-2 py-0.5 text-[var(--color-ink-soft)]">{t('{n} chapitres', { n: o.chapters })}</span>
              {!!o.trips?.length && (
                <span className="flex items-center gap-1 rounded-full bg-[#e7f5ff] px-2 py-0.5 text-[#1971c2]">
                  <Plane size={11} strokeWidth={2.8} /> {t('Voyage : {0}', { 0: o.trips.join(', ') })}
                </span>
              )}
              {o.adults && <span className="rounded-full bg-[#fff0f6] px-2 py-0.5 text-[#c2255c]">{t('18 ans et plus')}</span>}
            </div>
            <button className="btn mt-2 w-full !py-2" disabled={!!picking} onClick={() => onPick(o.id)}>
              <BookOpen size={16} strokeWidth={2.6} /> {picking === o.id ? '…' : t('Commencer cette histoire')}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function ErrandCard({ e, sim, onGo }: { e: Errand; sim: Sim; onGo: (step: ErrandStep) => void }) {
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
        <button className="btn mt-2 w-full !py-2" onClick={() => onGo(next)}>
          {next.city && next.city !== sim.city ? (
            <>
              <MapIcon size={16} strokeWidth={2.6} /> {t('Voyager')}
            </>
          ) : (
            <>
              <Navigation size={16} strokeWidth={2.6} /> {t('Y aller')}
            </>
          )}
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
      .then((r) => setLeft(r.errands.filter((e) => !e.done).length + ((r.story && !r.story.waiting) || (!r.story && r.choices?.length && !r.startsTomorrow) ? 1 : 0)))
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
