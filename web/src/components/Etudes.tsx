import { useCallback, useEffect, useState } from 'react'
import { Award, BedDouble, BookOpen, Check, GraduationCap, Landmark, Lock, MapPin, School, X } from 'lucide-react'
import { api, ApiError, type EtudesSchool, type EtudesView } from '../lib/api'
import type { ActionResult, Sim } from '../lib/types'
import { fcfa } from '../game/rules'
import { Chip, IconTile } from './ui'
import { locale, t as tr } from '../lib/i18n'

/**
 * Le parcours d'études (update « parcours-etudes », backend game/etudes.go and sims/etudes.go): the
 * phone's « Études » app. Where the Sim stands (the lycée's classes, the BEPC, the bac and its série; the
 * university's semester, its classes, its partiel, the fees), where to go for the next step and what it
 * asks, the diplomas, and the jobs that ask for one. The enrolment is done here, on the spot.
 */

type Act = (label: string, icon: string, kind: string, call: () => Promise<ActionResult>) => Promise<boolean>

const mark = (n: number) => n.toLocaleString(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })
/** The mention a mark is worth (backend game.Mention). */
const mention = (n: number) => (n >= 16 ? tr('Très bien') : n >= 14 ? tr('Bien') : n >= 12 ? tr('Assez bien') : n >= 10 ? tr('Passable') : '')
/** When the next session opens (a game minute: today or tomorrow at that hour). */
const sessionAt = (m: number, now: number) => {
  const hm = `${Math.floor((m % 1440) / 60)} h ${String(m % 60).padStart(2, '0')}`
  return Math.floor(m / 1440) === Math.floor(now / 1440) ? tr('aujourd’hui à {0}', { 0: hm }) : tr('demain à {0}', { 0: hm })
}
const EXAM_NAMES: Record<string, string> = { 'examen-bepc': 'BEPC', 'bac-serie-a': tr('Bac série A'), 'bac-serie-c': tr('Bac série C'), 'bac-serie-d': tr('Bac série D') }
const SERIE_COLORS: Record<string, [string, string]> = { A: ['#ffa94d', '#e8590c'], C: ['#74c0fc', '#1c7ed6'], D: ['#8ce99a', '#2b8a3e'] }

function Card({ children, tone = 'white' }: { children: React.ReactNode; tone?: 'white' | 'warm' | 'cool' }) {
  const bg = tone === 'warm' ? 'bg-[#fff4e8]' : tone === 'cool' ? 'bg-[#eef4ff]' : 'bg-white shadow-[0_1px_0_rgba(15,18,48,0.08)]'
  return <div className={`rounded-[20px] p-3 ${bg}`}>{children}</div>
}

/** One step of the way: done (its mark), now, or later (what it asks). */
function Step({ done, title, sub, icon }: { done: boolean; title: string; sub: string; icon: typeof Award }) {
  return (
    <div className="flex items-start gap-3" data-etude-step={done ? 'done' : 'todo'}>
      <IconTile icon={done ? Check : icon} colors={done ? ['#69db7c', '#2b8a3e'] : ['#d9dde8', '#9aa1b5']} size={36} />
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block font-display text-[15px] font-extrabold">{title}</span>
        <span className="mt-0.5 block text-[12px] font-bold text-[var(--color-ink-soft)]">{sub}</span>
      </span>
    </div>
  )
}

/** A bar of n parts, `done` filled. */
function Bar({ done, of, color = '#6c47ff' }: { done: number; of: number; color?: string }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: of }, (_, i) => (
        <span key={i} className="h-2 flex-1 rounded-full" style={{ background: i < done ? color : '#e3e6ef' }} />
      ))}
    </div>
  )
}

export function EtudesApp({ sim, act, onGo }: { sim: Sim; act: Act; /** « Y aller »: to that place (walking in the commune, else the map). */ onGo: (place: { id: string; city: string; commune: string }) => void }) {
  const [v, setV] = useState<EtudesView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [school, setSchool] = useState<string | null>(null)
  const [sure, setSure] = useState(false)
  const load = useCallback(() => {
    api
      .etudes(sim.id)
      .then(setV)
      .catch((e) => setError(e instanceof ApiError ? e.message : tr('Pas de réseau, réessaie.')))
  }, [sim.id])
  // Again whenever the Sim changes (a class counted, an exam passed, a semester validated).
  const key = `${JSON.stringify(sim.life?.etudes ?? null)}${sim.city}${sim.commune}${sim.money >= 0}`
  useEffect(load, [load, key])
  if (error && !v) return <p className="p-4 text-center text-sm font-bold text-[var(--color-ink-soft)]">{error}</p>
  if (!v)
    return (
      <div className="space-y-2 p-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[72px] animate-pulse rounded-2xl bg-black/5" />
        ))}
      </div>
    )
  const e = v.etudes
  const teen = v.minor && v.age >= 12
  const now = sim.gameMinutes
  const bepcWait = !e.bepc && (e.bepcNext ?? 0) > now ? e.bepcNext! : 0
  const bacWait = !e.bac && !e.oral && (e.bacNext ?? 0) > now ? e.bacNext! : 0
  // The subjects' coefficients, as « Maths ×5 · Physique-chimie ×5… ».
  const coefs = (exam: string) => (v.plans?.[exam] ?? []).map((s) => `${s.label} ×${s.coef}`).join(' · ')
  const doIt = (label: string, icon: string, body: Parameters<typeof api.etudesAct>[1]) => act(label, icon, 'universite', () => api.etudesAct(sim.id, body)).then(load)
  const go = (s: { id?: string; place?: string; city: string; commune: string }) => onGo({ id: s.id ?? s.place!, city: s.city, commune: s.commune })
  const GoBtn = ({ to, here }: { to: { id?: string; place?: string; city: string; commune: string }; here?: boolean }) => (
    <button className="btn btn-soft !min-h-0 shrink-0 !px-2.5 !py-2 !text-[12px]" onClick={() => go(to)}>
      <MapPin size={14} /> {here ? tr('Y aller') : tr('Carte')}
    </button>
  )
  // The lycées nearest first: the Sim's own city, its commune at the top.
  const lycees = [...v.lycees].filter((l) => l.city === sim.city).sort((a, b) => Number(b.here) - Number(a.here))

  const lycee = (teen || !e.bac) && (
    <section className="space-y-2" data-etudes="lycee">
      <h3 className="px-1 text-[12px] font-extrabold tracking-wide text-[var(--color-ink-soft)] uppercase">{v.minor ? tr('Collège et lycée') : tr('Le bac en candidat libre')}</h3>
      <Card>
        <div className="space-y-3">
          {v.minor && <Step done={(e.cours ?? 0) >= v.rules.bonusCours} icon={School} title={tr('Les cours au lycée : {0}', { 0: e.cours ?? 0 })} sub={(e.cours ?? 0) >= v.rules.bonusCours ? tr('En semaine, de 7 h à 17 h, dans un lycée. Tes notes de l’année ajoutent jusqu’à +{0} point sur 20 à tes examens (tu en as +{1}).', { 0: v.rules.bonusMax, 1: mark(v.rules.bonus) }) : tr('En semaine, de 7 h à 17 h, dans un lycée. Suis au moins {0} cours : tes notes de l’année ajouteront alors jusqu’à +{1} point sur 20 à tes examens.', { 0: v.rules.bonusCours, 1: v.rules.bonusMax })} />}
          <Step
            done={!!e.bepc}
            icon={BookOpen}
            title={e.bepc ? tr('BEPC : {0}/20', { 0: mark(e.bepc.note) }) : tr('Le BEPC')}
            sub={e.bepc ? [mention(e.bepc.note), e.bepc.school].filter(Boolean).join(' · ') || tr('Obtenu') : bepcWait ? tr('Recalé·e à la dernière session : la prochaine ouvre {0}. Révise d’ici là.', { 0: sessionAt(bepcWait, now) }) : v.minor ? tr('Au lycée, dès {0} ans (tu as {1} ans) : 15 questions, 20 secondes chacune. Il faut 10/20.', { 0: v.rules.bepcAge, 1: v.age }) : tr('Dans un lycée, en candidat libre : {0}. Il faut 10/20.', { 0: fcfa(v.rules.bepcFee) })}
          />
          <Step
            done={!!e.bac}
            icon={Award}
            title={e.bac ? (e.bac.serie ? tr('Bac série {0} : {1}/20', { 0: e.bac.serie, 1: mark(e.bac.note) }) : tr('Bac : {0}/20', { 0: mark(e.bac.note) })) : e.oral ? tr('Second tour, série {0}', { 0: e.oral.serie ?? '' }) : tr('Le bac')}
            sub={
              e.bac
                ? tr('Obtenu, mention {0} : l’université t’attend à 18 ans.', { 0: mention(e.bac.note) })
                : e.oral
                  ? tr('{0}/20 au premier tour. Au lycée, « Passer l’oral du second tour » : {1} questions, il faut arriver à 10/20.', { 0: mark(e.oral.note), 1: v.rules.oralQuestions })
                  : !e.bepc
                    ? tr('Après le BEPC.')
                    : bacWait
                      ? tr('Recalé·e à la dernière session : la prochaine ouvre {0}. Révise d’ici là.', { 0: sessionAt(bacWait, now) })
                      : v.minor
                        ? tr('Au lycée, dès {0} ans, en série A, C ou D : 15 questions, 20 secondes chacune. Il faut 10/20 ; entre {1} et 10, un oral.', { 0: v.rules.bacAge, 1: v.rules.oralLow })
                        : tr('Dans un lycée, en candidat libre : {0}, en série A, C ou D.', { 0: fcfa(v.rules.bacFee) })
            }
          />
          {e.last && (
            <div className="rounded-2xl bg-[#f4f6fb] p-2.5" data-etudes-last={e.last.exam}>
              <div className="flex items-center justify-between text-[12.5px] font-extrabold">
                <span>{tr('Dernière session : {0}', { 0: EXAM_NAMES[e.last.exam] ?? e.last.exam })}</span>
                <span className={e.last.note >= 10 ? 'text-[#2b8a3e]' : 'text-[#c92a2a]'}>{tr('{0}/20', { 0: mark(e.last.note) })}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {(v.plans?.[e.last.exam] ?? []).map((s) => {
                  const [r, n] = e.last!.copie[s.id] ?? [0, 0]
                  return (
                    <Chip key={s.id} tone={n && r / n >= 0.5 ? 'good' : 'neutral'}>
                      {s.label} {r}/{n} · ×{s.coef}
                    </Chip>
                  )
                })}
                {!!e.last.bonus && <Chip tone="gold">{tr('Année +{0}', { 0: mark(e.last.bonus) })}</Chip>}
              </div>
            </div>
          )}
        </div>
      </Card>
      {!e.bac && (
        <div className="grid grid-cols-1 gap-2">
          {v.series.map((s) => (
            <div key={s.id} className="flex items-start gap-3 rounded-2xl bg-white p-2.5" data-serie={s.id}>
              <IconTile icon={GraduationCap} colors={SERIE_COLORS[s.id] ?? ['#ccc', '#999']} size={34} />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block font-display text-[14px] font-extrabold">{s.label}</span>
                <span className="mt-0.5 block text-[12px] font-bold text-[var(--color-ink-soft)]">{s.hint}</span>
                {coefs(`bac-serie-${s.id.toLowerCase()}`) && <span className="mt-1 block text-[11.5px] font-bold text-[#5f3dc4]">{tr('Coefficients : {0}', { 0: coefs(`bac-serie-${s.id.toLowerCase()}`) })}</span>}
              </span>
            </div>
          ))}
          <p className="px-1 text-[11.5px] leading-snug font-bold text-[var(--color-ink-soft)]">{tr('Sélectif : médecine et pharmacie demandent un bac C ou D avec au moins Assez bien (12/20) ; l’INP-HB, un bac C ou D avec au moins Bien (14/20). Recalé·e, la session suivante ouvre 24 h plus tard.')}</p>
        </div>
      )}
      {teen && (
        <Card tone="cool">
          <div className="flex items-center gap-3">
            <IconTile icon={BedDouble} colors={['#9775fa', '#5f3dc4']} size={40} />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block font-display text-[15px] font-extrabold">{e.internat ? tr('Interne au {0}', { 0: e.lyceeName ?? '' }) : tr('L’internat')}</span>
              <span className="mt-0.5 block text-[12px] font-bold text-[var(--color-ink-soft)]">{tr('Du dimanche soir au vendredi : le dortoir, l’étude du soir (18 h–21 h), le réveil à 5 h 30, la cantine. Le week-end, la maison.')}</span>
            </span>
          </div>
          {e.internat ? (
            <button className="btn btn-soft mt-2 w-full !py-2 !text-[13px]" onClick={() => void doIt(tr('Passer externe'), 'house', { action: 'externat' })}>
              {tr('Passer externe (dormir à la maison)')}
            </button>
          ) : (
            <p className="mt-2 text-[12px] font-bold text-[#5f3dc4]">{tr('La famille t’y inscrit : choisis le lycée ci-dessous.')}</p>
          )}
        </Card>
      )}
      <ul className="space-y-2">
        {lycees.map((l) => (
          <li key={l.id} className="flex items-center gap-3 rounded-2xl bg-white p-2.5" data-lycee={l.id}>
            <IconTile icon={School} colors={['#ffc56b', '#e8590c']} size={38} />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate font-display text-[14px] font-extrabold">{l.name}</span>
              <span className="mt-0.5 block truncate text-[12px] font-bold text-[var(--color-ink-soft)]">{l.where}</span>
            </span>
            {teen && !(e.internat && e.lycee === l.id) && (
              <button className="btn btn-soft !min-h-0 shrink-0 !px-2.5 !py-2 !text-[12px]" onClick={() => void doIt(tr('L’internat'), 'bed-double', { action: 'internat', place: l.id })}>
                {tr('Interne')}
              </button>
            )}
            <GoBtn to={l} here={l.here} />
          </li>
        ))}
        {lycees.length === 0 && <p className="px-1 text-[12px] font-bold text-[var(--color-ink-soft)]">{tr('Pas de lycée dans cette ville : il y en a à Abidjan, Yamoussoukro, Bouaké, Daloa, Korhogo, Man, San-Pédro et Grand-Bassam.')}</p>}
      </ul>
    </section>
  )

  const c = e.cursus
  const cs = c ? v.schools.find((s) => s.place === c.place) : undefined
  const today = c && Math.floor(sim.gameMinutes / 1440) === c.day ? c.today : 0
  const cursus = c && (
    <Card tone="cool">
      <div className="flex items-start gap-3" data-cursus={`${c.degree}:${c.filiere}`}>
        <IconTile icon={GraduationCap} colors={['#4dabf7', '#3b2fc9']} size={44} />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block font-display text-[17px] font-extrabold">{v.labels[`${c.degree}:${c.filiere}`] ?? c.degree}</span>
          <span className="mt-0.5 block text-[12px] font-bold text-[var(--color-ink-soft)]">{c.school}</span>
        </span>
        {cs && <GoBtn to={cs} here={cs.here} />}
      </div>
      <div className="mt-3 space-y-1">
        <div className="flex justify-between text-[12px] font-extrabold">
          <span>{tr('Semestre {0}/{1}', { 0: c.semestre, 1: c.semestres })}</span>
          <span className="text-[var(--color-ink-soft)]">{tr('{0} validé(s)', { 0: c.notes?.length ?? 0 })}</span>
        </div>
        <Bar done={c.notes?.length ?? 0} of={c.semestres} color="#3b2fc9" />
      </div>
      <div className="mt-3 space-y-1">
        <div className="flex justify-between text-[12px] font-extrabold">
          <span>{tr('Cours en amphi : {0}/{1}', { 0: c.cours, 1: v.rules.semesterCours })}</span>
          <span className="text-[var(--color-ink-soft)]">{tr('aujourd’hui {0}/{1}', { 0: today, 1: v.rules.coursPerDay })}</span>
        </div>
        <Bar done={c.cours} of={v.rules.semesterCours} color="#1c7ed6" />
      </div>
      <p className="mt-2 text-[12.5px] leading-snug font-bold" data-partiel={c.cours >= v.rules.partielCours || c.retake ? 'ouvert' : 'ferme'}>
        {c.due
          ? tr('Réinscription à payer : {0}. Les cours reprennent une fois payée.', { 0: fcfa(c.due) })
          : c.retake
            ? tr('Partiel raté ({0}/20) : le rattrapage t’attend, sans refaire les cours.', { 0: mark(c.last ?? 0) })
            : c.cours >= v.rules.partielCours
              ? tr('Le partiel du semestre {0} est ouvert : « Passer le partiel » à l’université, en semaine de 8 h à 12 h. Plus de cours suivis = meilleure note.', { 0: c.semestre })
              : tr('Encore {0} cours avant le partiel (« Suivre un cours en amphi », en semaine de 7 h à 16 h, {1} comptés par jour au plus).', { 0: v.rules.partielCours - c.cours, 1: v.rules.coursPerDay })}
      </p>
      {(c.notes?.length ?? 0) > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {c.notes!.map((n, i) => (
            <Chip key={i} tone={n >= 14 ? 'good' : 'neutral'}>
              {tr('S{0} · {1}/20', { 0: i + 1, 1: mark(n) })}
            </Chip>
          ))}
        </div>
      )}
      <div className="mt-3 flex gap-2">
        {!!c.due && (
          <button className="btn flex-1 !py-2 !text-[13px]" onClick={() => void doIt(tr('Réinscription'), 'graduation-cap', { action: 'reinscription' })}>
            {tr('Payer {0}', { 0: fcfa(c.due) })}
          </button>
        )}
        {sure ? (
          <>
            <button className="btn btn-soft flex-1 !py-2 !text-[13px] !text-[#c92a2a]" onClick={() => (setSure(false), void doIt(tr('Abandonner'), 'door-open', { action: 'abandon' }))}>
              {tr('Oui, abandonner')}
            </button>
            <button className="btn btn-soft !py-2 !text-[13px]" onClick={() => setSure(false)} aria-label={tr('Annuler')}>
              <X size={16} />
            </button>
          </>
        ) : (
          <button className="btn btn-soft !py-2 !text-[13px]" onClick={() => setSure(true)}>
            {tr('Abandonner')}
          </button>
        )}
      </div>
    </Card>
  )

  const offer = (s: EtudesSchool, o: { degree: string; filiere: string }) => {
    const k = `${o.degree}:${o.filiere}`
    const why = s.why[k]
    const d = v.degrees.find((x) => x.id === o.degree)
    return (
      <li key={k} className="flex items-center gap-2 border-t border-dashed border-[var(--color-line)] py-2 first:border-t-0" data-offer={k}>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-[13.5px] font-extrabold">{v.labels[k] ?? k}</span>
          <span className={`mt-0.5 block text-[11.5px] font-bold ${why ? 'text-[#c25400]' : 'text-[var(--color-ink-soft)]'}`}>{why ?? tr('{0} semestres · {1} par an', { 0: d?.semesters ?? 0, 1: fcfa(s.fees[k] ?? 0) })}</span>
        </span>
        {!why && s.here && (
          <button className="btn !min-h-0 shrink-0 !px-3 !py-2 !text-[12px]" disabled={sim.money < (s.fees[k] ?? 0)} onClick={() => void doIt(tr('Inscription'), 'graduation-cap', { action: 'inscription', place: s.place, degree: o.degree, filiere: o.filiere })}>
            {tr('S’inscrire')}
          </button>
        )}
        {why && <Lock size={15} className="shrink-0 text-[var(--color-ink-soft)]" />}
      </li>
    )
  }

  const universities = !v.minor && !c && (
    <section className="space-y-2" data-etudes="universites">
      <h3 className="px-1 text-[12px] font-extrabold tracking-wide text-[var(--color-ink-soft)] uppercase">{tr('S’inscrire à l’université')}</h3>
      <p className="px-1 text-[12px] leading-snug font-bold text-[var(--color-ink-soft)]">
        {e.bac ? tr('L’inscription se fait sur place : va à l’université, puis choisis ta formation ici. Tu paies l’année tout de suite.') : tr('Il faut d’abord le bac (en candidat libre, dans un lycée).')}
      </p>
      {[...v.schools]
        .sort((a, b) => Number(b.here) - Number(a.here) || Number(b.city === sim.city) - Number(a.city === sim.city))
        .map((s) => (
          <div key={s.place} className="rounded-[20px] bg-white p-3 shadow-[0_1px_0_rgba(15,18,48,0.08)]" data-school={s.place}>
            <button className="flex w-full items-center gap-3 text-left" onClick={() => setSchool(school === s.place ? null : s.place)}>
              <IconTile icon={Landmark} colors={s.public ? ['#69db7c', '#2b8a3e'] : ['#ffc56b', '#e8590c']} size={40} />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate font-display text-[15px] font-extrabold">{s.name}</span>
                <span className="mt-0.5 block text-[12px] font-bold text-[var(--color-ink-soft)]">
                  {s.where} · {s.public ? tr('public') : tr('privé')} · {tr('dès {0}/an', { 0: fcfa(Math.min(...Object.values(s.fees))) })} · {tr('{0} formations', { 0: s.offers.length })}
                </span>
              </span>
              {s.here && <Chip tone="good">{tr('Ici')}</Chip>}
            </button>
            {school === s.place && (
              <div className="mt-2">
                {!s.here && (
                  <div className="mb-1 flex items-center gap-2 rounded-xl bg-[#fff4e8] px-2.5 py-2">
                    <span className="min-w-0 flex-1 text-[12px] font-bold text-[#a85a00]">{tr('Va sur place pour t’inscrire.')}</span>
                    <GoBtn to={s} here={s.city === sim.city && s.commune === sim.commune} />
                  </div>
                )}
                <ul>{s.offers.map((o) => offer(s, o))}</ul>
              </div>
            )}
          </div>
        ))}
    </section>
  )

  const dips = e.diplomes ?? []
  const diplomas = (dips.length > 0 || e.bepc || e.bac) && (
    <section className="space-y-2" data-etudes="diplomes">
      <h3 className="px-1 text-[12px] font-extrabold tracking-wide text-[var(--color-ink-soft)] uppercase">{tr('Mes diplômes')}</h3>
      {[...dips.map((d) => ({ k: `${d.degree}:${d.filiere}`, title: v.labels[`${d.degree}:${d.filiere}`] ?? d.degree, sub: d.school, note: d.note })), ...(e.bac ? [{ k: 'bac', title: e.bac.serie ? tr('Baccalauréat série {0}', { 0: e.bac.serie }) : tr('Baccalauréat'), sub: [e.bac.oral ? tr('au second tour') : '', e.bac.school ?? ''].filter(Boolean).join(' · '), note: e.bac.note }] : []), ...(e.bepc ? [{ k: 'bepc', title: tr('BEPC'), sub: e.bepc.school ?? '', note: e.bepc.note }] : [])].map((d) => (
        <div key={d.k} className="flex items-center gap-3 rounded-2xl bg-white p-2.5" data-diplome={d.k}>
          <IconTile icon={Award} colors={['#9775fa', '#5f3dc4']} size={38} />
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate font-display text-[14px] font-extrabold">{d.title}</span>
            <span className="mt-0.5 block truncate text-[12px] font-bold text-[var(--color-ink-soft)]">{[mention(d.note) && tr('Mention {0}', { 0: mention(d.note) }), d.sub].filter(Boolean).join(' · ')}</span>
          </span>
          <Chip tone="gold">{tr('{0}/20', { 0: mark(d.note) })}</Chip>
        </div>
      ))}
      <p className="px-1 text-[11.5px] font-bold text-[var(--color-ink-soft)]">{tr('Ils sont aussi dans l’appli Papiers (documents de jeu, sans valeur dans la vraie vie).')}</p>
    </section>
  )

  const jobs = (
    <section className="space-y-2" data-etudes="metiers">
      <h3 className="px-1 text-[12px] font-extrabold tracking-wide text-[var(--color-ink-soft)] uppercase">{tr('Les métiers qui demandent un diplôme')}</h3>
      <Card tone="warm">
        <ul className="space-y-1.5">
          {Object.entries(v.gates).map(([id, g]) => (
            <li key={id} className="flex items-start gap-2 text-[12.5px] leading-snug font-bold" data-gate={id}>
              {g.met ? <Check size={15} className="mt-0.5 shrink-0 text-[#2b8a3e]" /> : <Lock size={15} className="mt-0.5 shrink-0 text-[#a85a00]" />}
              <span>{tr('{career} : pour passer {title}, il faut {label}.', { career: g.career, title: g.title, label: g.label })}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11.5px] font-bold text-[var(--color-ink-soft)]">{tr('Tout le monde peut commencer en bas de l’échelle, et un diplôme fait commencer plus haut. Ceux qui ont déjà leur poste le gardent.')}</p>
      </Card>
    </section>
  )

  return (
    <div className="space-y-4 p-3 pb-6" data-etudes-app>
      {error && <p className="text-center text-[12px] font-bold text-[#c92a2a]">{error}</p>}
      {cursus}
      {lycee}
      {universities}
      {diplomas}
      {!v.minor && jobs}
    </div>
  )
}
