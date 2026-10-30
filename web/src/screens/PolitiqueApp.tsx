import { useEffect, useMemo, useState } from 'react'
import { Check, Crown, Flag, Landmark, Medal, Megaphone, Shield, Sparkles, Users, Vote, type LucideIcon } from 'lucide-react'
import { ApiError, api } from '../lib/api'
import type { Candidate, Commune, Crew, Election, Party, Politics, Sim, World } from '../lib/types'
import { Chip, IconTile } from '../components/ui'
import { lifeOf } from '../game/rules'
import { Presidence, Terrain, abidjan } from './politique/Presidence'
import { t as tr, tx } from '../lib/i18n'

// « Politique »: the city's political life (backend/internal/politics).
// Présidence: the president's week (politique/Presidence.tsx): the speech,
// the measures, the citizens' stars, the Fête de la Nation. Élections: the
// president of the republic and the mayor of one's commune, every week: one
// stands till Sunday, campaigns from Friday 18 h to Saturday night (in the
// app, and in the street: tours, militants, the meeting at the stadium),
// votes on Sunday at a town hall, hears the results on Monday at 9 h. Partis: found one,
// join one. Gouvernement: the president names ministers and deputies, who sit
// at the Palais présidentiel. Mairie: the mayor's word to the commune. Gang:
// the players' crews, their tag over the name. Sociétés: the secret societies.

type Tab = 'presidence' | 'elections' | 'partis' | 'gouvernement' | 'mairie' | 'gang' | 'societes'
const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'presidence', label: tr('Présidence'), icon: Medal },
  { id: 'elections', label: tr('Élections'), icon: Vote },
  { id: 'partis', label: tr('Partis'), icon: Flag },
  { id: 'gouvernement', label: tr('Gouvernement'), icon: Crown },
  { id: 'mairie', label: tr('Mairie'), icon: Landmark },
  { id: 'gang', label: tr('Gang'), icon: Shield },
  { id: 'societes', label: tr('Sociétés'), icon: Sparkles },
]

const F = (n: number) => `${n.toLocaleString('fr-FR')} F`
const failure = (e: unknown) => (e instanceof ApiError ? e.message : tr('Pas de réseau : réessaie dans un instant.'))
const when = (iso: string) => new Date(iso).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
const SWATCHES = ['#ff7a00', '#00a862', '#2a6cf0', '#e83e8c', '#7048e8', '#e8590c', '#0097c4', '#111827']

type Props = { world: World; sim: Sim; commune: Commune; /** The place the Sim is in (a mairie: it can vote). */ at: string | null; onWalk: (id: string) => void }

export function PolitiqueApp({ world, sim, commune, at, onWalk }: Props) {
  const [tab, setTab] = useState<Tab>('presidence')
  const [p, setP] = useState<Politics | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const load = () => api.politics(sim.id).then(setP).catch((e) => setError(failure(e)))
  useEffect(() => void load(), [sim.id]) // eslint-disable-line react-hooks/exhaustive-deps
  // Every change goes through here: done, the summary is read again and the answer shown.
  const run = async (call: () => Promise<{ text?: string } | unknown>) => {
    setError(null)
    setNote(null)
    try {
      const r = (await call()) as { text?: string } | undefined
      if (r?.text) setNote(r.text)
      await load()
      return true
    } catch (e) {
      setError(failure(e))
      return false
    }
  }
  const city = world.cities.find((c) => c.id === sim.homeCity) ?? world.cities[0]
  const minor = useMemo(() => lifeOf(world, sim).minor, [world, sim])

  return (
    <div className="space-y-3">
      <div className="no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-extrabold transition ${tab === t.id ? 'bg-[var(--color-ink)] text-white' : 'bg-[var(--color-canvas)] text-[var(--color-ink-soft)]'}`}>
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>
      {error && <p className="rounded-xl bg-[#fff1f0] px-3 py-2 text-sm font-bold text-[#b42318]">{error}</p>}
      {note && !error && (
        <p className="flex items-start gap-2 rounded-xl bg-[#e9fbf0] px-3 py-2 text-sm font-bold text-[#0f7a3f]">
          <Check size={16} className="mt-0.5 shrink-0" /> {note}
        </p>
      )}
      {!p ? (
        <p className="text-sm font-bold text-[var(--color-ink-soft)]">{tr('Chargement…')}</p>
      ) : tab === 'presidence' ? (
        <Presidence p={p} sim={sim} city={city} run={run} onWalk={onWalk} minor={minor} />
      ) : tab === 'elections' ? (
        <Elections p={p} sim={sim} city={city} commune={commune} at={at} run={run} onWalk={onWalk} minor={minor} />
      ) : tab === 'partis' ? (
        <Parties p={p} sim={sim} run={run} />
      ) : tab === 'gouvernement' ? (
        <Government p={p} sim={sim} city={city} run={run} />
      ) : tab === 'mairie' ? (
        <Mairie p={p} sim={sim} city={city} commune={commune} run={run} onWalk={onWalk} />
      ) : tab === 'gang' ? (
        <Gang p={p} sim={sim} city={city} run={run} />
      ) : (
        <Societies p={p} sim={sim} run={run} />
      )}
    </div>
  )
}

type Run = (call: () => Promise<unknown>) => Promise<boolean>
const communeName = (city: World['cities'][number], id?: string) => city.communes.find((c) => c.id === id)?.name ?? id ?? ''

/* ---------- Élections ---------- */

function Elections({ p, sim, city, commune, at, run, onWalk, minor }: { p: Politics; sim: Sim; city: World['cities'][number]; commune: Commune; at: string | null; run: Run; onWalk: (id: string) => void; minor: boolean }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-[22px] bg-[#eef2ff] p-4">
        <IconTile icon={Vote} colors={['#8c9eff', '#3d4fd6']} size={44} />
        <div className="min-w-0 text-sm font-semibold text-[var(--color-ink-soft)]">
          <div className="font-display text-lg leading-tight font-extrabold text-[var(--color-ink)]">{tr('Un·e président·e par semaine')}</div>
          {tx('On se présente pendant la semaine, on fait campagne du vendredi 18 h au samedi soir, on vote le dimanche à la mairie, et les résultats tombent le lundi à 9 h. {mandatesAMonth} mandats par mois au plus. Ton vote vaut {playerWeight} voix de la foule.', { mandatesAMonth: p.rules.mandatesAMonth, playerWeight: p.playerWeight })}
        </div>
      </div>
      <ElectionCard title={tr('La présidentielle')} e={p.president} last={p.lastPresident} p={p} sim={sim} city={city} commune={commune} at={at} run={run} onWalk={onWalk} minor={minor} />
      <ElectionCard title={tr('La mairie {0}', { 0: deOf(communeName(city, sim.homeCommune)) })} e={p.mayor} last={p.lastMayor} p={p} sim={sim} city={city} commune={commune} at={at} run={run} onWalk={onWalk} minor={minor} />
    </div>
  )
}

const deOf = (name: string) => (name === 'Plateau' ? tr('du Plateau') : /^[AEIOUÉ]/.test(name) ? `d'${name}` : `de ${name}`)

function ElectionCard({ title, e, last, p, sim, city, commune, at, run, onWalk, minor }: { title: string; e: Election | null; last: Election | null; p: Politics; sim: Sim; city: World['cities'][number]; commune: Commune; at: string | null; run: Run; onWalk: (id: string) => void; minor: boolean }) {
  const [programme, setProgramme] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [actCommune, setActCommune] = useState(sim.homeCommune)
  if (!e) return null
  const now = Date.now()
  const voting = now >= Date.parse(e.votesAt) && now < Date.parse(e.closesAt)
  // Standing: till the vote; campaigning: from Friday 18 h to the vote.
  const campaign = now < Date.parse(e.votesAt)
  const campaignOn = now >= Date.parse(e.campaignAt) && campaign
  const phase = voting ? tr('Vote ouvert') : campaignOn ? tr('Campagne') : campaign ? tr('Candidatures') : tr('Dépouillement')
  const me = e.candidates.find((c) => c.sim === sim.id)
  const forPresident = e.kind === 'president'
  const canRun = campaign && !me && !!p.party && (forPresident ? p.party.leader === sim.id && p.mandatesLeft > 0 : sim.homeCommune === e.commune) && !minor
  const whyNot = !p.party
    ? tr('Il faut un parti pour se présenter (onglet Partis).')
    : forPresident && p.party.leader !== sim.id
      ? tr('À la présidentielle, c’est le chef du parti qui se présente.')
      : forPresident && p.mandatesLeft <= 0
        ? tr('{mandatesAMonth} mandats ce mois-ci : c’est la limite. Le mois prochain !', { mandatesAMonth: p.rules.mandatesAMonth })
        : !forPresident && sim.homeCommune !== e.commune
          ? tr('On se présente à la mairie de sa commune.')
          : ''
  // At a town hall: any of the city's for the president, the commune's own for its mayor.
  const atPlace = at ? city.communes.flatMap((c) => c.places).find((x) => x.id === at) : undefined
  const atMairie = !!atPlace && atPlace.kind === 'mairie' && (forPresident || at === commune.admin?.mairie || city.communes.find((c) => c.id === e.commune)?.admin?.mairie === at)
  const myMairie = city.communes.find((c) => c.id === sim.homeCommune)?.admin?.mairie
  const deposit = forPresident ? p.deposits.president : p.deposits.maire
  return (
    <section className="space-y-2 rounded-[22px] bg-[var(--color-canvas)] p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-display text-base font-extrabold">{title}</h4>
        <Chip tone={voting || campaignOn ? 'good' : 'neutral'}>{phase}</Chip>
      </div>
      <p className="text-xs font-bold text-[var(--color-ink-soft)]">
        {voting
          ? tr('Vote jusqu’au {0}. Résultats {1}.', { 0: abidjan(e.closesAt), 1: abidjan(e.resultsAt) })
          : campaign
            ? tr('Campagne {0} → {1}. Vote jusqu’au {2}. Résultats {3}.', { 0: abidjan(e.campaignAt), 1: abidjan(e.votesAt), 2: abidjan(e.closesAt), 3: abidjan(e.resultsAt) })
            : tr('Résultats {0}.', { 0: abidjan(e.resultsAt) })}
      </p>
      {e.candidates.length === 0 && <p className="text-sm font-semibold text-[var(--color-ink-soft)]">{tr('Personne ne s’est encore présenté. Un parti, un programme, une caution de')} {F(deposit)} {tr(': à toi.')}</p>}
      <ul className="space-y-2">
        {e.candidates.map((c) => (
          <CandidateRow key={c.sim} c={c} mine={c.sim === sim.id} voted={e.myVote === c.sim} open={open === c.sim} onOpen={() => setOpen(open === c.sim ? null : c.sim)}>
            {voting && !e.myVote && !minor && (atMairie ? (
              <button className="btn !py-1.5 !text-xs" onClick={() => void run(() => api.vote(sim.id, e.id, c.sim, at!))}>
                {tr('Voter')}
              </button>
            ) : null)}
          </CandidateRow>
        ))}
      </ul>
      {voting && !e.myVote && !minor && !atMairie && e.candidates.length > 0 && (
        <div className="flex items-center justify-between gap-2 rounded-2xl bg-white p-2.5 text-xs font-bold text-[var(--color-ink-soft)]">
          <span>{tx('On vote à la mairie{0} : vas-y, puis reviens ici.', { 0: forPresident ? '' : ` ${deOf(communeName(city, e.commune))}` })}</span>
          {myMairie && (
            <button className="btn-soft shrink-0 rounded-full px-3 py-1.5 text-xs font-extrabold" onClick={() => onWalk(myMairie)}>
              {tr('Y aller')}
            </button>
          )}
        </div>
      )}
      {e.myVote && <p className="text-xs font-bold text-[#0f7a3f]">{tr('Tu as voté. L’encre sur ton doigt le prouve.')}</p>}
      {me && campaign && (
        <div className="space-y-2 rounded-2xl bg-white p-3">
          <div className="text-sm font-extrabold">{tr('Ta campagne')}</div>
          <p className="text-xs font-semibold text-[var(--color-ink-soft)]">
            {campaignOn ? tr('Chaque action convainc une part de la foule ; les affiches et les tournées comptent dans leur commune, la radio partout.') : tr('La campagne ouvre {0}. D’ici là, appelle tes militants et prépare ton meeting.', { 0: abidjan(e.campaignAt) })}
          </p>
          {!forPresident ? null : (
            <select className="input w-full !py-2 text-sm font-bold" value={actCommune} onChange={(x) => setActCommune(x.target.value)}>
              {city.communes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <ul className="space-y-1.5">
            {p.campaignActs.map((a) => (
              <li key={a.id} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold">{a.label}</div>
                  <div className="text-[11px] font-semibold text-[var(--color-ink-soft)]">
                    {tx('+{points} pts {0}', { points: a.points, 0: a.scope === 'all' ? 'partout' : forPresident ? `à ${communeName(city, actCommune)}` : tr('dans ta commune') })}
                  </div>
                </div>
                <button className="btn shrink-0 !py-1.5 !text-xs" disabled={!campaignOn} onClick={() => void run(() => api.campaign(sim.id, e.id, a.id, a.scope === 'commune' ? (forPresident ? actCommune : (e.commune ?? sim.homeCommune)) : ''))}>
                  {F(a.cost)}
                </button>
              </li>
            ))}
          </ul>
          <Terrain e={e} p={p} sim={sim} city={city} run={run} />
        </div>
      )}
      {canRun && (
        <div className="space-y-2 rounded-2xl bg-white p-3">
          <div className="text-sm font-extrabold">{tr('Te présenter')}</div>
          <p className="text-xs font-semibold text-[var(--color-ink-soft)]">{tr('Dis aux gens pourquoi voter pour toi. Caution :')} {F(deposit)}.</p>
          <textarea value={programme} onChange={(x) => setProgramme(x.target.value.slice(0, 600))} rows={3} placeholder={tr('Mon programme : des routes sans nids-de-poule, un marché couvert, le courant tout le temps…')} className="input w-full resize-none text-sm font-semibold" />
          <button className="btn w-full !py-2 !text-sm" disabled={programme.trim().length < 20} onClick={() => void run(() => api.declare(sim.id, e.id, programme)).then((ok) => ok && setProgramme(''))}>
            {tr('Déposer ma candidature')}
          </button>
        </div>
      )}
      {campaign && !me && !canRun && whyNot && <p className="text-xs font-semibold text-[var(--color-ink-soft)]">{whyNot}</p>}
      {last && last.candidates.length > 0 && (
        <details className="rounded-2xl bg-white p-3 text-sm">
          <summary className="cursor-pointer font-extrabold">{tr('Les derniers résultats')}</summary>
          <ul className="mt-2 space-y-1">
            {last.candidates.map((c) => {
              const score = c.votes * p.playerWeight + c.npcVotes
              return (
                <li key={c.sim} className="flex items-center justify-between gap-2">
                  <span className="font-bold">
                    {c.sim === last.winner ? '🏆 ' : ''}
                    {c.name}
                    {c.acronym ? ` (${c.acronym})` : ''}
                  </span>
                  <span className="tnum text-xs font-bold text-[var(--color-ink-soft)]">{last.turnout ? Math.round((score * 100) / last.turnout) : 0} %</span>
                </li>
              )
            })}
          </ul>
        </details>
      )}
    </section>
  )
}

function CandidateRow({ c, mine, voted, open, onOpen, children }: { c: Candidate; mine: boolean; voted: boolean; open: boolean; onOpen: () => void; children?: React.ReactNode }) {
  return (
    <li className="rounded-2xl bg-white p-2.5">
      <div className="flex items-center gap-2">
        <button className="min-w-0 flex-1 text-left" onClick={onOpen}>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-sm font-extrabold">
              {c.name}
              {mine ? ' (toi)' : ''}
            </span>
            {c.acronym && (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-extrabold text-white" style={{ background: c.color || '#111827' }}>
                {c.acronym}
              </span>
            )}
            {voted && <Chip tone="good">{tr('ton vote')}</Chip>}
          </div>
          <div className="text-[11px] font-bold text-[var(--color-ink-soft)]">{tx('Campagne : {points} pts ·', { points: c.points })} {open ? 'replier' : tr('lire le programme')}</div>
        </button>
        {children}
      </div>
      {open && <p className="mt-2 text-sm leading-snug font-semibold whitespace-pre-wrap">{c.programme}</p>}
    </li>
  )
}

/* ---------- Partis ---------- */

function Parties({ p, sim, run }: { p: Politics; sim: Sim; run: Run }) {
  const [list, setList] = useState<Party[] | null>(null)
  const [form, setForm] = useState({ name: '', acronym: '', color: SWATCHES[0], slogan: '' })
  const [founding, setFounding] = useState(false)
  const refresh = () => api.parties().then((r) => setList(r.parties)).catch(() => setList([]))
  useEffect(() => void refresh(), [p.party?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="space-y-4">
      {p.party ? (
        <div className="space-y-2 rounded-[22px] p-4 text-white" style={{ background: p.party.color }}>
          <div className="font-display text-lg leading-tight font-extrabold">
            {p.party.name} · {p.party.acronym}
          </div>
          {p.party.slogan && <p className="text-sm font-semibold opacity-90">« {p.party.slogan} »</p>}
          <p className="text-xs font-bold opacity-90">
            {tx('{members} membre{0} · {1}', { members: p.party.members, 0: p.party.members > 1 ? 's' : '', 1: p.party.leader === sim.id ? tr('tu diriges le parti') : tr('dirigé par {leaderName}', { leaderName: p.party.leaderName }) })}
          </p>
          <button className="btn-white rounded-full px-3 py-1.5 text-xs font-extrabold" onClick={() => void run(() => api.leaveParty(sim.id))}>
            {tr('Rendre ma carte')}
          </button>
        </div>
      ) : (
        <div className="space-y-2 rounded-[22px] bg-[#fff4e8] p-4">
          <div className="font-display text-lg leading-tight font-extrabold">{tr('Pas encore de parti')}</div>
          <p className="text-sm font-semibold text-[var(--color-ink-soft)]">{tr('Entre dans un parti, ou fonde le tien (')}{F(p.fees.party)}{tr(') : son chef se présente à la présidentielle, ses membres aux mairies.')}</p>
          {!founding ? (
            <button className="btn !py-2 !text-sm" onClick={() => setFounding(true)}>
              {tr('Fonder un parti')}
            </button>
          ) : (
            <div className="space-y-2">
              <input className="input w-full text-sm font-bold" placeholder={tr('Nom du parti')} value={form.name} onChange={(x) => setForm({ ...form, name: x.target.value.slice(0, 40) })} />
              <div className="flex gap-2">
                <input className="input w-24 text-sm font-bold uppercase" placeholder={tr('Sigle')} value={form.acronym} onChange={(x) => setForm({ ...form, acronym: x.target.value.toUpperCase().slice(0, 6) })} />
                <input className="input min-w-0 flex-1 text-sm font-bold" placeholder={tr('Slogan')} value={form.slogan} onChange={(x) => setForm({ ...form, slogan: x.target.value.slice(0, 80) })} />
              </div>
              <Swatches value={form.color} onPick={(c) => setForm({ ...form, color: c })} />
              <button className="btn w-full !py-2 !text-sm" disabled={form.name.trim().length < 4 || form.acronym.length < 2} onClick={() => void run(() => api.foundParty(sim.id, form)).then((ok) => ok && setFounding(false))}>
                {tr('Fonder ·')} {F(p.fees.party)}
              </button>
            </div>
          )}
        </div>
      )}
      <section>
        <h4 className="label mb-2">{tr('Les partis')}</h4>
        {list === null ? (
          <p className="text-sm font-bold text-[var(--color-ink-soft)]">{tr('Chargement…')}</p>
        ) : list.length === 0 ? (
          <p className="text-sm font-bold text-[var(--color-ink-soft)]">{tr('Aucun parti pour l’instant. Le premier sera le tien.')}</p>
        ) : (
          <ul className="space-y-2">
            {list.map((x) => (
              <li key={x.id} className="flex items-center gap-2.5 rounded-[20px] bg-[var(--color-canvas)] p-2.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[11px] font-extrabold text-white" style={{ background: x.color }}>
                  {x.acronym}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-extrabold">{x.name}</div>
                  <div className="text-[11px] font-bold text-[var(--color-ink-soft)]">
                    {tx('{members} membre{0} · chef : {leaderName} {1}', { members: x.members, 0: x.members > 1 ? 's' : '', leaderName: x.leaderName, 1: x.slogan ? ` · « ${x.slogan} »` : '' })}
                  </div>
                </div>
                {!p.party && (
                  <button className="btn shrink-0 !py-1.5 !text-xs" onClick={() => void run(() => api.joinParty(sim.id, x.id))}>
                    {tr('Entrer')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Swatches({ value, onPick }: { value: string; onPick: (c: string) => void }) {
  return (
    <div className="flex gap-1.5">
      {SWATCHES.map((c) => (
        <button key={c} type="button" aria-label={c} onClick={() => onPick(c)} className={`h-7 w-7 rounded-full ring-2 ring-offset-2 ${value === c ? 'ring-[var(--color-ink)]' : 'ring-transparent'}`} style={{ background: c }} />
      ))}
    </div>
  )
}

/* ---------- Gouvernement ---------- */

function Government({ p, sim, city, run }: { p: Politics; sim: Sim; city: World['cities'][number]; run: Run }) {
  const president = p.government.find((h) => h.office === 'president')
  const iAm = president?.sim === sim.id
  const [naming, setNaming] = useState<string | null>(null)
  const portfolios = [
    ['economie', tr("Ministre de l'Économie")], ['sante', tr('Ministre de la Santé')], ['education', tr("Ministre de l'Éducation")], ['securite', tr('Ministre de la Sécurité')],
    ['transports', tr('Ministre des Transports')], ['sport', tr('Ministre des Sports')], ['culture', tr('Ministre de la Culture')], ['jeunesse', tr('Ministre de la Jeunesse')],
  ] as const
  const holder = (office: string) => p.government.find((h) => h.office === office)
  const Seat = ({ office, label }: { office: string; label: string }) => {
    const h = holder(office)
    return (
      <li className="flex items-center gap-2 rounded-2xl bg-white p-2">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold text-[var(--color-ink-soft)]">{label}</div>
          <div className="truncate text-sm font-extrabold">{h ? `${h.name}${h.acronym ? ` (${h.acronym})` : ''}` : tr('Poste libre')}</div>
        </div>
        {iAm && (
          <button className="btn-soft shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold" onClick={() => setNaming(office)}>
            {h ? tr('Changer') : tr('Nommer')}
          </button>
        )}
      </li>
    )
  }
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-[22px] bg-[#fff8dc] p-4">
        <IconTile icon={Crown} colors={['#ffe066', '#f5a000']} size={44} />
        <div className="min-w-0">
          <div className="font-display text-lg leading-tight font-extrabold">{president ? `${president.label} ${president.name}` : tr('Pas de président·e')}</div>
          <p className="text-sm font-semibold text-[var(--color-ink-soft)]">
            {president ? tr('Élu·e jusqu’au {0}, payé·e {1} par jour. Ses ministres et les députés siègent avec lui au Palais présidentiel, au Plateau.', { 0: when(president.until), 1: F(p.pay.president) }) : tr('La présidentielle le désignera : vois Élections.')}
          </p>
        </div>
      </div>
      {naming && <Naming office={naming} sim={sim} onDone={() => setNaming(null)} run={run} />}
      <section>
        <h4 className="label mb-2">{tr('Les ministres ·')} {F(p.pay.ministre)} {tr('par jour')}</h4>
        <ul className="space-y-1.5">
          {portfolios.map(([id, label]) => (
            <Seat key={id} office={`ministre:${id}`} label={label} />
          ))}
        </ul>
      </section>
      <section>
        <h4 className="label mb-2">{tr('Les députés ·')} {F(p.pay.depute)} {tr('par jour')}</h4>
        <ul className="space-y-1.5">
          {city.communes
            .filter((c) => c.admin?.mairie)
            .map((c) => (
              <Seat key={c.id} office={`depute:${c.id}`} label={tr('Député·e {0}', { 0: deOf(c.name) })} />
            ))}
        </ul>
      </section>
    </div>
  )
}

function Naming({ office, sim, onDone, run }: { office: string; sim: Sim; onDone: () => void; run: Run }) {
  const [q, setQ] = useState('')
  const [found, setFound] = useState<{ id: string; firstName: string; lastName: string; username: string; commune: string }[]>([])
  useEffect(() => {
    if (q.trim().length < 2) return setFound([])
    const t = setTimeout(() => void api.searchSims(q).then((r) => setFound(r.sims)).catch(() => setFound([])), 250)
    return () => clearTimeout(t)
  }, [q])
  return (
    <div className="space-y-2 rounded-2xl bg-[var(--color-canvas)] p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-extrabold">{tr('Qui nommer ?')}</span>
        <button className="text-xs font-bold text-[var(--color-ink-soft)]" onClick={onDone}>
          {tr('Fermer')}
        </button>
      </div>
      <input className="input w-full text-sm font-bold" placeholder={tr('Prénom, nom ou @pseudo')} value={q} onChange={(x) => setQ(x.target.value)} autoFocus />
      <ul className="space-y-1">
        {found.map((f) => (
          <li key={f.id}>
            <button className="flex w-full items-center justify-between rounded-xl bg-white px-3 py-2 text-left text-sm font-bold" onClick={() => void run(() => api.nameOffice(sim.id, office, f.id)).then((ok) => ok && onDone())}>
              <span>
                {f.firstName} {f.lastName}
                {f.username ? <span className="text-[var(--color-ink-soft)]"> @{f.username}</span> : null}
              </span>
              <Users size={14} />
            </button>
          </li>
        ))}
      </ul>
      <button className="text-xs font-bold text-[#b42318]" onClick={() => void run(() => api.nameOffice(sim.id, office, '')).then((ok) => ok && onDone())}>
        {tr('Libérer le poste')}
      </button>
    </div>
  )
}

/* ---------- Mairie ---------- */

function Mairie({ p, sim, city, commune, run, onWalk }: { p: Politics; sim: Sim; city: World['cities'][number]; commune: Commune; run: Run; onWalk: (id: string) => void }) {
  const mine = city.communes.find((c) => c.id === sim.homeCommune)
  const mayor = p.mayors.find((h) => h.office === `maire:${sim.homeCommune}`)
  const iAm = mayor?.sim === sim.id
  const [text, setText] = useState('')
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-[22px] bg-[#e9fbf0] p-4">
        <IconTile icon={Landmark} colors={['#69e2a0', '#00a862']} size={44} />
        <div className="min-w-0">
          <div className="font-display text-lg leading-tight font-extrabold">{tr('Mairie')} {deOf(mine?.name ?? '')}</div>
          <p className="text-sm font-semibold text-[var(--color-ink-soft)]">
            {mayor ? tr('{label} : {name}{0}, jusqu’au {1}. Payé·e {2} par jour.', { label: mayor.label, name: mayor.name, 0: mayor.acronym ? ` (${mayor.acronym})` : '', 1: when(mayor.until), 2: F(p.pay.maire) }) : tr('Pas encore de maire : les municipales le désigneront (Élections).')}
          </p>
          {mine?.admin?.mairie && mine.id === commune.id && (
            <button className="btn-soft mt-2 rounded-full px-3 py-1.5 text-xs font-extrabold" onClick={() => onWalk(mine.admin!.mairie)}>
              {tr('Aller à la mairie')}
            </button>
          )}
        </div>
      </div>
      {iAm && (
        <div className="space-y-2 rounded-2xl bg-[var(--color-canvas)] p-3">
          <div className="text-sm font-extrabold">{tr('Ton mot à la commune')}</div>
          <p className="text-xs font-semibold text-[var(--color-ink-soft)]">{tr('Un communiqué par jour, reçu par tous les habitants dans leurs Messages.')}</p>
          <textarea value={text} onChange={(x) => setText(x.target.value.slice(0, 300))} rows={3} placeholder={tr('Chers habitants, …')} className="input w-full resize-none text-sm font-semibold" />
          <button className="btn w-full !py-2 !text-sm" disabled={text.trim().length < 5} onClick={() => void run(() => api.communique(sim.id, text)).then((ok) => ok && setText(''))}>
            <Megaphone size={14} /> {tr('Publier')}
          </button>
        </div>
      )}
      <section>
        <h4 className="label mb-2">{tr('Les derniers communiqués')}</h4>
        {p.communiques.length === 0 ? (
          <p className="text-sm font-bold text-[var(--color-ink-soft)]">{tr('Rien pour l’instant.')}</p>
        ) : (
          <ul className="space-y-2">
            {p.communiques.map((c, i) => (
              <li key={i} className="rounded-2xl bg-[var(--color-canvas)] p-3 text-sm font-semibold whitespace-pre-wrap">
                {c}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h4 className="label mb-2">{tr('Les maires de la ville')}</h4>
        <ul className="space-y-1.5">
          {city.communes
            .filter((c) => c.admin?.mairie)
            .map((c) => {
              const h = p.mayors.find((x) => x.office === `maire:${c.id}`)
              return (
                <li key={c.id} className="flex items-center justify-between gap-2 rounded-2xl bg-[var(--color-canvas)] px-3 py-2 text-sm">
                  <span className="font-extrabold">{c.name}</span>
                  <span className="truncate font-bold text-[var(--color-ink-soft)]">{h ? `${h.name}${h.acronym ? ` (${h.acronym})` : ''}` : '—'}</span>
                </li>
              )
            })}
        </ul>
      </section>
    </div>
  )
}

/* ---------- Gang ---------- */

function Gang({ p, sim, city, run }: { p: Politics; sim: Sim; city: World['cities'][number]; run: Run }) {
  const [list, setList] = useState<Crew[] | null>(null)
  const [form, setForm] = useState({ name: '', tag: '', color: SWATCHES[7] })
  const [founding, setFounding] = useState(false)
  const [fund, setFund] = useState(5000)
  useEffect(() => void api.crews().then((r) => setList(r.crews)).catch(() => setList([])), [p.crew?.id, p.crew?.size]) // eslint-disable-line react-hooks/exhaustive-deps
  const c = p.crew
  const lead = c?.leader === sim.id
  return (
    <div className="space-y-4">
      {c ? (
        <div className="space-y-2 rounded-[22px] p-4 text-white" style={{ background: c.color }}>
          <div className="font-display text-lg leading-tight font-extrabold">
            [{c.tag}] {c.name}
          </div>
          <p className="text-xs font-bold opacity-90">
            {tx('Quartier : {0} · {size} membre{1} · caisse', { 0: communeName(city, c.commune), size: c.size, 1: c.size > 1 ? 's' : '' })} {F(c.treasury)}
          </p>
          <p className="text-xs font-semibold opacity-90">{tr('Ton tag s’affiche au-dessus de toi ; dans ton quartier, les nouchis des couloirs te laissent passer.')}</p>
          <ul className="space-y-1">
            {c.members?.map((m) => (
              <li key={m.sim} className="flex items-center justify-between gap-2 rounded-xl bg-white/15 px-2.5 py-1.5 text-sm">
                <span className="truncate font-bold">
                  {m.name}
                  <span className="opacity-80"> · {m.role}</span>
                </span>
                {lead && m.sim !== sim.id && (
                  <span className="flex shrink-0 gap-1">
                    {m.role !== 'bras-droit' && (
                      <button className="rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-extrabold" onClick={() => void run(() => api.kickCrew(sim.id, m.sim, 'bras-droit'))}>
                        {tr('Bras droit')}
                      </button>
                    )}
                    <button className="rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-extrabold" onClick={() => void run(() => api.kickCrew(sim.id, m.sim))}>
                      {tr('Virer')}
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
          {lead && c.requests && c.requests.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-extrabold uppercase opacity-90">{tr('Ils demandent à entrer')}</div>
              {c.requests.map((m) => (
                <div key={m.sim} className="flex items-center justify-between gap-2 rounded-xl bg-white/15 px-2.5 py-1.5 text-sm">
                  <span className="truncate font-bold">{m.name}</span>
                  <span className="flex shrink-0 gap-1">
                    <button className="rounded-full bg-white px-2 py-0.5 text-[10px] font-extrabold text-[var(--color-ink)]" onClick={() => void run(() => api.answerCrew(sim.id, m.sim, false))}>
                      {tr('Oui')}
                    </button>
                    <button className="rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-extrabold" onClick={() => void run(() => api.answerCrew(sim.id, m.sim, true))}>
                      {tr('Non')}
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <input type="number" min={1000} step={1000} className="input w-28 !py-1.5 text-sm font-bold" value={fund} onChange={(x) => setFund(Number(x.target.value))} />
            <button className="btn-white rounded-full px-3 py-1.5 text-xs font-extrabold" onClick={() => void run(() => api.fundCrew(sim.id, fund))}>
              {tr('Mettre dans la caisse')}
            </button>
            <button className="ml-auto rounded-full bg-black/30 px-3 py-1.5 text-xs font-extrabold" onClick={() => void run(() => api.leaveCrew(sim.id))}>
              {tr('Quitter')}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2 rounded-[22px] bg-[#f3f4f6] p-4">
          <div className="font-display text-lg leading-tight font-extrabold">{tr('Pas de gang')}</div>
          <p className="text-sm font-semibold text-[var(--color-ink-soft)]">{tr('Demande à entrer dans un gang, ou monte le tien (')}{F(p.fees.crew)}{tr(') : ton quartier, c’est celui où tu habites.')}</p>
          {!founding ? (
            <button className="btn !py-2 !text-sm" onClick={() => setFounding(true)}>
              {tr('Monter un gang')}
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input className="input min-w-0 flex-1 text-sm font-bold" placeholder={tr('Nom du gang')} value={form.name} onChange={(x) => setForm({ ...form, name: x.target.value.slice(0, 24) })} />
                <input className="input w-20 text-sm font-bold uppercase" placeholder={tr('TAG')} value={form.tag} onChange={(x) => setForm({ ...form, tag: x.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) })} />
              </div>
              <Swatches value={form.color} onPick={(c) => setForm({ ...form, color: c })} />
              <button className="btn w-full !py-2 !text-sm" disabled={form.name.trim().length < 3 || form.tag.length < 2} onClick={() => void run(() => api.foundCrew(sim.id, form)).then((ok) => ok && setFounding(false))}>
                {tr('Monter ·')} {F(p.fees.crew)}
              </button>
            </div>
          )}
        </div>
      )}
      <section>
        <h4 className="label mb-2">{tr('Les gangs de la ville')}</h4>
        {list === null ? (
          <p className="text-sm font-bold text-[var(--color-ink-soft)]">{tr('Chargement…')}</p>
        ) : list.length === 0 ? (
          <p className="text-sm font-bold text-[var(--color-ink-soft)]">{tr('Aucun gang pour l’instant.')}</p>
        ) : (
          <ul className="space-y-2">
            {list.map((x) => (
              <li key={x.id} className="flex items-center gap-2.5 rounded-[20px] bg-[var(--color-canvas)] p-2.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[11px] font-extrabold text-white" style={{ background: x.color }}>
                  {x.tag}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-extrabold">{x.name}</div>
                  <div className="text-[11px] font-bold text-[var(--color-ink-soft)]">
                    {tx('{0} · {size} membre{1} · chef : {leaderName}', { 0: communeName(city, x.commune), size: x.size, 1: x.size > 1 ? 's' : '', leaderName: x.leaderName })}
                  </div>
                </div>
                {!c && (
                  <button className="btn shrink-0 !py-1.5 !text-xs" onClick={() => void run(() => api.askCrew(sim.id, x.id))}>
                    {tr('Demander')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

/* ---------- Sociétés ---------- */

function Societies({ p, sim, run }: { p: Politics; sim: Sim; run: Run }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 rounded-[22px] bg-[#1b1b2f] p-4 text-white">
        <IconTile icon={Sparkles} colors={['#c49bff', '#7048e8']} size={44} />
        <div className="min-w-0 text-sm font-semibold opacity-90">
          <div className="font-display text-lg leading-tight font-extrabold opacity-100">{tr('On n’en parle pas')}</div>
          {tr('Des sociétés discrètes, une initiation, des cotisations chaque lundi, et des portes qui s’ouvrent. Qui ne paie plus n’en est plus.')}
        </div>
      </div>
      <ul className="space-y-2">
        {p.sects.map((s) => {
          const mine = p.sect === s.id
          return (
            <li key={s.id} className={`space-y-1.5 rounded-[20px] p-3 ${mine ? 'bg-[#1b1b2f] text-white' : 'bg-[var(--color-canvas)]'}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="font-display text-base font-extrabold">{s.name}</div>
                {mine && <Chip tone="gold">{tr('initié·e')}</Chip>}
              </div>
              <p className={`text-xs font-semibold italic ${mine ? 'opacity-80' : 'text-[var(--color-ink-soft)]'}`}>« {s.motto} »</p>
              <p className="text-sm font-semibold">{s.perk}</p>
              {s.risk && <p className={`text-xs font-semibold ${mine ? 'opacity-80' : 'text-[#b42318]'}`}>{s.risk}</p>}
              <div className="flex items-center justify-between gap-2 text-xs font-bold">
                <span className={mine ? 'opacity-80' : 'text-[var(--color-ink-soft)]'}>
                  {tr('Initiation')} {F(s.fee)} · {F(s.dues)} {tr('chaque lundi')}
                </span>
                {mine ? (
                  <button className="rounded-full bg-white/20 px-3 py-1.5 font-extrabold" onClick={() => void run(() => api.setSect(sim.id, ''))}>
                    {tr('Quitter')}
                  </button>
                ) : !p.sect ? (
                  <button className="btn !py-1.5 !text-xs" onClick={() => void run(() => api.setSect(sim.id, s.id))}>
                    {tr('Être initié·e')}
                  </button>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

