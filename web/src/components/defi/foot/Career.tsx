import { Splash } from '../../Splash'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, Trophy, UserMinus, UserPlus } from 'lucide-react'
import type { ActionResult, FootCareerView, FootRecruit, Look } from '../../../lib/types'
import { api, errorText } from '../../../lib/api'
import { LENGTHS, Shirt, Stars } from './Hub'
import { CLUBS, clubOf, foeFor, kitsFor, LEVELS, teamOf, type Team } from './teams'
import { matchScore, scoreOf } from './sim'
import { t as tr, tx } from '../../../lib/i18n'

// Babi Foot's career: the club of the Sim's neighbourhood (foot/teams.ts
// clubOf, by its home commune) in a league of eight drawn among the others,
// seven matchdays a season (everyone meets everyone once), the table, the
// honours season after season. The market (backend game/footcareer.go):
// players signed for Djai make the side stronger; let go, they're gone for
// nothing. The season is kept on the server (sims/footcareer.go) and on the
// phone (offline, the labs); the signings are the server's.

const StreetMatch = lazy(() => import('../../../streetball/StreetMatch'))

/** A game's score: home side first. */
export type Res = { a: string; b: string; ga: number; gb: number }
export type Season = { n: number; size: 5 | 11; level: number; length: number; league: string[]; day: number; results: Res[][]; honours: { n: number; place: number }[] }
export type Row = { id: string; p: number; w: number; d: number; l: number; gf: number; ga: number; pts: number }

export const DAYS = 7
const KEY = 'babi.foot.career'
/** What a signing adds to the side's stars, by his own. */
const BONUS: Record<number, number> = { 3: 0.15, 4: 0.3, 5: 0.5 }
const POSTS: Record<FootRecruit['post'], string> = { G: tr('Gardien'), D: tr('Défenseur'), M: tr('Milieu'), A: tr('Attaquant') }
/** Where a signing plays, by place in the side (the player's own place, the five's 2 and the eleven's 9, isn't given). */
const PLACES: Record<5 | 11, Record<FootRecruit['post'], number[]>> = {
  5: { G: [0], D: [1], M: [3], A: [4] },
  11: { G: [0], D: [1, 2, 3, 4], M: [5, 6, 7], A: [8, 10] },
}

/** A new season: the player's club and seven others drawn (Babi FC is everyone's club when no commune's is theirs). */
export function newSeason(club: string, o: { size: 5 | 11; level: number; length: number }, prev: Season | null, rnd = Math.random): Season {
  const pool = CLUBS.filter((t) => t.id !== club && t.id !== 'babi').map((t) => t.id)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return { n: (prev?.n ?? 0) + 1, ...o, league: [club, ...pool.slice(0, 7)], day: 0, results: [], honours: prev?.honours ?? [] }
}

/** A matchday's games, by the circle (the first side stays, the others turn): everyone meets everyone once in seven days; the player's side at home every other day. */
export function fixtures(league: string[], day: number): [string, string][] {
  const n = league.length
  const rest = league.slice(1)
  const at = [league[0], ...rest.map((_, i) => rest[(i + day) % (n - 1)])]
  const out: [string, string][] = []
  for (let i = 0; i < n / 2; i++) out.push(i === 0 && day % 2 ? [at[n - 1 - i], at[i]] : [at[i], at[n - 1 - i]])
  return out
}

/** The table: three points a win, one a draw; then the goal difference, the goals scored. */
export function tableOf(s: Season): Row[] {
  const rows = new Map(s.league.map((id) => [id, { id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }]))
  for (const day of s.results)
    for (const r of day) {
      const [a, b] = [rows.get(r.a), rows.get(r.b)]
      if (!a || !b) continue
      for (const [x, f, g] of [
        [a, r.ga, r.gb],
        [b, r.gb, r.ga],
      ] as const) {
        x.p++
        x.gf += f
        x.ga += g
        if (f > g) (x.w++, (x.pts += 3))
        else if (f === g) (x.d++, x.pts++)
        else x.l++
      }
    }
  return [...rows.values()].sort((x, y) => y.pts - x.pts || y.gf - y.ga - (x.gf - x.ga) || y.gf - x.gf || s.league.indexOf(x.id) - s.league.indexOf(y.id))
}

/** The matchday played: the player's game as it ended, the others by the console; the season's place in the honours once it's over. */
export function playDay(s: Season, club: string, mine: number, theirs: number, rnd = Math.random): Season {
  const day = fixtures(s.league, s.day).map(([a, b]): Res => {
    if (a === club) return { a, b, ga: mine, gb: theirs }
    if (b === club) return { a, b, ga: theirs, gb: mine }
    const [ga, gb] = scoreOf(teamOf(a), teamOf(b), s.size, rnd)
    return { a, b, ga, gb }
  })
  const next: Season = { ...s, results: [...s.results, day], day: s.day + 1 }
  if (next.day >= DAYS) next.honours = [...s.honours, { n: s.n, place: tableOf(next).findIndex((r) => r.id === club) + 1 }]
  return next
}

/** The side's strength in stars: the club's, and what its signings add (two and a half at most). */
export const strengthOf = (club: Team, squad: FootRecruit[]) =>
  club.stars +
  Math.min(
    2.5,
    squad.reduce((t, p) => t + (BONUS[p.stars] ?? 0), 0),
  )

/** The side's names by place: the signings where they play, the others the usual ones. */
function namesOf(size: 5 | 11, squad: FootRecruit[]): [string[], string[]] {
  const mates: string[] = []
  const used = new Set<number>()
  for (const p of squad) {
    const i = PLACES[size][p.post].find((k) => !used.has(k))
    if (i === undefined) continue
    used.add(i)
    mates[i] = p.name.split(' ').slice(-1)[0]
  }
  return [mates, []]
}

/** A season read back (the server's, the phone's): null if it isn't one. */
function asSeason(raw: unknown): Season | null {
  const s = raw as Season | null
  if (!s || (s.size !== 5 && s.size !== 11) || !Array.isArray(s.league) || s.league.length !== 8 || !s.league.every((id) => teamOf(id).id === id) || !Array.isArray(s.results) || typeof s.day !== 'number') return null
  return { ...s, honours: Array.isArray(s.honours) ? s.honours : [] }
}

function loadLocal(): { club: string; season: Season | null } | null {
  try {
    const k = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { club: string; season: unknown } | null
    if (k && teamOf(k.club).id === k.club) return { club: k.club, season: asSeason(k.season) }
  } catch {
    /* none kept */
  }
  return null
}
function saveLocal(club: string, season: Season) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ club, season }))
  } catch {
    /* private mode */
  }
}

const place = (n: number) => (n === 1 ? '1er' : `${n}e`)

type Me = { look: Look; gender: 'femme' | 'homme'; money?: number; homeCommune?: string }

export function Career({ me, simId, onEnd, onBack, onResult }: { me: Me; simId: string; onEnd: (score: number) => void; onBack: () => void; /** A signing's answer (the Sim's money). */ onResult?: (r: ActionResult) => void }) {
  const [view, setView] = useState<FootCareerView | null>(null)
  const [club, setClub] = useState(() => clubOf(me.homeCommune).id)
  const [season, setSeason] = useState<Season | null>(null)
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)
  const [tab, setTab] = useState<'table' | 'squad' | 'market'>('table')
  const [playing, setPlaying] = useState(false)
  const [round, setRound] = useState(0)
  const [after, setAfter] = useState<{ score: number; day: Res[]; won: number } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [money, setMoney] = useState(me.money)
  useEffect(() => setMoney(me.money), [me.money])
  useEffect(() => {
    let live = true
    api
      .footCareer(simId)
      .then((v) => {
        if (!live) return
        setView(v)
        if (v.career && teamOf(v.career.club).id === v.career.club) {
          setClub(v.career.club)
          setSeason(asSeason(v.career.season))
        }
      })
      .catch(() => {
        if (!live) return
        // No server (offline, the labs): the phone's copy.
        setOffline(true)
        const kept = loadLocal()
        if (kept) {
          setClub(kept.club)
          setSeason(kept.season)
        }
      })
      .finally(() => live && setLoading(false))
    return () => {
      live = false
    }
  }, [simId])
  const mine = teamOf(club)
  const market = view?.market ?? []
  const squad = (view?.career?.squad ?? []).map((id) => market.find((p) => p.id === id)).filter((p): p is FootRecruit => !!p)
  const strength = strengthOf(mine, squad)
  const fx = season && season.day < DAYS ? fixtures(season.league, season.day).find((f) => f.includes(club)) : undefined
  const theirs = fx ? teamOf(fx[0] === club ? fx[1] : fx[0]) : null
  const away = !!fx && fx[1] === club
  // Kept from render to render: a new one would start the match over.
  const rules = useMemo(
    () =>
      season && theirs
        ? {
            size: season.size,
            referee: true,
            switching: true,
            length: LENGTHS[season.size][season.length] ?? LENGTHS[season.size][1],
            foe: foeFor(LEVELS[season.level]?.foe ?? 1, { ...mine, stars: strength }, theirs),
            names: namesOf(season.size, squad),
          }
        : null,
    // The signings change the strength; the rest of the season, the matchday.
    [season?.n, season?.day, theirs?.id, strength],
  )
  const save = (s: Season) => {
    setSeason(s)
    saveLocal(club, s)
    if (offline) return
    api
      .footSave(simId, club, s)
      .then(setView)
      .catch(() => setNote(tr('Pas de réseau : la saison est gardée sur le téléphone.')))
  }
  const sign = async (p: FootRecruit) => {
    setBusy(p.id)
    setNote(null)
    try {
      const r = await api.footSign(simId, p.id)
      onResult?.(r)
      if (r.sim) setMoney(r.sim.money)
      setNote(r.outcome.text)
      setView(await api.footCareer(simId))
    } catch (e) {
      setNote(errorText(e, tr('Pas possible pour le moment.')))
    } finally {
      setBusy(null)
    }
  }
  const release = async (p: FootRecruit) => {
    setBusy(p.id)
    setNote(null)
    try {
      setView(await api.footRelease(simId, p.id))
      setNote(tr('{name} quitte le club.', { name: p.name }))
    } catch (e) {
      setNote(errorText(e, tr('Pas possible pour le moment.')))
    } finally {
      setBusy(null)
    }
  }
  const shell = 'flex h-full flex-col overflow-y-auto bg-[radial-gradient(circle_at_50%_0%,#1f7a3f,#0b2e1a_70%)] px-4 pt-12 pb-6 text-white'
  const header = (sub?: string) => (
    <div className="flex items-center gap-2">
      <button className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-black/30" onClick={onBack} aria-label={tr('Retour')}>
        <ChevronLeft size={20} />
      </button>
      <div className="min-w-0">
        <div className="font-display text-[26px] leading-tight font-extrabold">{tr('Carrière')}</div>
        {sub && <div className="truncate text-[12px] font-bold text-white/65">{sub}</div>}
      </div>
    </div>
  )

  if (loading) return <div className={`${shell} items-center justify-center font-display text-xl font-extrabold`}>{tr("Le club t'attend…")}</div>

  if (playing && theirs && rules && season)
    return (
      <Suspense fallback={<Splash className="bg-[#0b2e1a]" label={tr('Journée {0} : {name} contre {name2}…', { 0: season.day + 1, name: mine.name, name2: theirs.name })} />}>
        <StreetMatch
          key={round}
          sport="foot"
          name={tr('Toi')}
          look={me.look}
          gender={me.gender}
          rules={rules}
          teams={[mine.name, theirs.name]}
          shorts={[mine.short, theirs.short]}
          kits={kitsFor(mine, theirs)}
          // Left mid-match: back to the club, the match to play again; played out, the matchday goes on.
          onExit={(r) => {
            setPlaying(false)
            if (!r) return
            const next = playDay(season, club, r.score[0], r.score[1])
            save(next)
            setAfter({ score: matchScore(r.score[0], r.score[1]), day: next.results[next.results.length - 1], won: r.score[0] - r.score[1] })
          }}
        />
      </Suspense>
    )

  // The matchday over: its results, then the défi's score.
  if (after && season)
    return (
      <div className={shell}>
        {header(tr('Saison {n} · Journée {day}/{DAYS}', { n: season.n, day: season.day, DAYS }))}
        <div className="card animate-pop mt-4 p-4 text-[var(--color-ink)]">
          <div className="label">{tr('Journée')} {season.day}</div>
          <div className="mt-1 font-display text-[22px] leading-tight font-extrabold">{after.won > 0 ? 'Victoire !' : after.won === 0 ? tr('Match nul') : tr('Défaite…')}</div>
          <ul className="mt-2 space-y-1">
            {after.day.map((r) => (
              <li key={r.a} className={`flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-[13px] font-extrabold ${r.a === club || r.b === club ? 'bg-[#fff3c4]' : 'bg-[var(--color-canvas)]'}`}>
                <span className="flex-1 truncate text-right">{teamOf(r.a).name}</span>
                <span className="tabular-nums">
                  {r.ga} - {r.gb}
                </span>
                <span className="flex-1 truncate">{teamOf(r.b).name}</span>
              </li>
            ))}
          </ul>
          {season.day >= DAYS && <p className="mt-2 text-center text-[14px] font-extrabold">{tx('Saison terminée : {0} du championnat.', { 0: place(season.honours[season.honours.length - 1]?.place ?? 0) })}</p>}
          <button className="btn mt-3 w-full" onClick={() => onEnd(after.score)}>
            {tr('Voir le résultat')}
          </button>
        </div>
      </div>
    )

  // No season yet: the club, the format, the difficulty, the length.
  if (!season) return <Start club={mine} onBack={onBack} onStart={(o) => save(newSeason(club, o, null))} />

  const table = tableOf(season)
  const over = season.day >= DAYS
  const last = season.honours[season.honours.length - 1]
  return (
    <div className={shell}>
      {header(tr('Saison {n} · {0} · {size} contre {size}', { n: season.n, 0: over ? tr('terminée') : tr('Journée {0}/{DAYS}', { 0: season.day + 1, DAYS }), size: season.size }))}
      <div className="mt-3 flex items-center gap-3 rounded-[20px] bg-white/10 p-3 ring-1 ring-white/12">
        <Shirt color={mine.home} size={44} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-[19px] leading-tight font-extrabold">{mine.name}</div>
          <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-white/70">
            <Stars n={Math.round(Math.min(5, strength))} /> {squad.length > 0 && tr('+{0} avec les recrues', { 0: (strength - mine.stars).toFixed(2).replace(/\.?0+$/, '') })}
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-[22px] leading-none font-extrabold">{place(table.findIndex((r) => r.id === club) + 1)}</div>
          <div className="text-[10.5px] font-bold text-white/60">{tr('au classement')}</div>
        </div>
      </div>
      {over ? (
        <div className="mt-3 rounded-[20px] bg-white/10 p-3 text-center ring-1 ring-white/12">
          <Trophy size={28} className={`mx-auto ${last?.place === 1 ? 'text-[#ffd43b]' : 'text-white/50'}`} />
          <div className="mt-1 font-display text-[19px] font-extrabold">{last?.place === 1 ? tr('{name} champion !', { name: mine.name }) : tr('Saison finie à la {0} place', { 0: place(last?.place ?? 0) })}</div>
          <button className="btn mt-3 w-full !bg-[#ffd43b] !py-3 !text-[#16161c] shadow-[0_4px_0_#e09a00]" onClick={() => save(newSeason(club, { size: season.size, level: season.level, length: season.length }, season))}>
            {tr('Nouvelle saison')}
          </button>
        </div>
      ) : (
        theirs && (
          <div className="mt-3 rounded-[20px] bg-white/10 p-3 ring-1 ring-white/12">
            <div className="text-[11px] font-extrabold tracking-wide text-white/60 uppercase">
              {tx('Journée {0} · {1}', { 0: season.day + 1, 1: away ? tr('à l’extérieur') : tr('à domicile') })}
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <Shirt color={theirs.home} size={30} />
              <span className="min-w-0 flex-1 truncate font-display text-[17px] font-extrabold">{tr('contre')} {theirs.name}</span>
              <Stars n={theirs.stars} />
            </div>
            <button
              className="btn mt-3 w-full !bg-[#ffd43b] !py-3 !text-[#16161c] shadow-[0_4px_0_#e09a00]"
              onClick={() => {
                setRound((r) => r + 1)
                setPlaying(true)
              }}
            >
              {tx('Jouer la journée {0}', { 0: season.day + 1 })}
            </button>
          </div>
        )
      )}
      <div className="mt-4 flex rounded-full bg-black/30 p-0.5 text-[12.5px] font-extrabold">
        {(
          [
            ['table', tr('Classement')],
            ['squad', tr('Effectif')],
            ['market', tr('Transferts')],
          ] as const
        ).map(([k, label]) => (
          <button key={k} className={`flex-1 rounded-full py-1.5 ${tab === k ? 'bg-white text-[#0b2e1a]' : 'text-white/75'}`} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>
      {note && <div className="mt-2 rounded-xl bg-black/30 px-3 py-2 text-[12.5px] font-bold">{note}</div>}
      {tab === 'table' && (
        <div className="mt-2 overflow-hidden rounded-[16px] bg-black/25 text-[12px] font-extrabold">
          <div className="grid grid-cols-[1.4rem_1fr_repeat(5,1.6rem)] gap-x-1 px-2 py-1.5 text-[10px] text-white/55 uppercase">
            <span>#</span>
            <span>{tr('Club')}</span>
            <span className="text-center">{tr('J')}</span>
            <span className="text-center">{tr('G')}</span>
            <span className="text-center">{tr('N')}</span>
            <span className="text-center">+/-</span>
            <span className="text-center">{tr('Pts')}</span>
          </div>
          {table.map((r, k) => {
            const t = teamOf(r.id)
            return (
              <div key={r.id} className={`grid grid-cols-[1.4rem_1fr_repeat(5,1.6rem)] items-center gap-x-1 px-2 py-1.5 tabular-nums ${r.id === club ? 'bg-[#ffd43b]/20 text-[#ffd43b]' : ''}`}>
                <span>{k + 1}</span>
                <span className="flex min-w-0 items-center gap-1.5">
                  <Shirt color={t.home} size={15} />
                  <span className="truncate">{t.name}</span>
                </span>
                <span className="text-center">{r.p}</span>
                <span className="text-center">{r.w}</span>
                <span className="text-center">{r.d}</span>
                <span className="text-center">{r.gf - r.ga > 0 ? `+${r.gf - r.ga}` : r.gf - r.ga}</span>
                <span className="text-center">{r.pts}</span>
              </div>
            )
          })}
        </div>
      )}
      {tab === 'squad' && (
        <div className="mt-2 space-y-1.5">
          <div className="text-[12px] font-bold text-white/70">
            {tx('Recrues : {length}/{0}. Libérer un joueur ne rapporte rien.', { length: squad.length, 0: view?.max ?? 5 })}
          </div>
          {squad.length === 0 && <div className="rounded-[16px] bg-black/25 px-3 py-3 text-[13px] font-bold text-white/75">{tr("Pas encore de recrue : l'équipe du quartier joue avec ses gars. Va voir les transferts.")}</div>}
          {squad.map((p) => (
            <div key={p.id} className="flex items-center gap-2 rounded-[16px] bg-black/25 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-extrabold">{p.name}</div>
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-white/60">
                  {POSTS[p.post]} <Stars n={p.stars} size={10} />
                </div>
              </div>
              <button className="flex items-center gap-1 rounded-full bg-white/12 px-2.5 py-1.5 text-[12px] font-extrabold disabled:opacity-40" disabled={busy !== null || offline} onClick={() => void release(p)}>
                <UserMinus size={14} /> {tr('Libérer')}
              </button>
            </div>
          ))}
          {season.honours.length > 0 && (
            <div className="pt-2">
              <div className="text-[11px] font-extrabold tracking-wide text-white/60 uppercase">{tr('Palmarès')}</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {season.honours.map((h) => (
                  <span key={h.n} className={`rounded-full px-2.5 py-1 text-[11.5px] font-extrabold ${h.place === 1 ? 'bg-[#ffd43b] text-[#16161c]' : 'bg-black/25'}`}>
                    {tx('Saison {n} : {0}', { n: h.n, 0: place(h.place) })}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {tab === 'market' && (
        <div className="mt-2 space-y-1.5">
          <div className="text-[12px] font-bold text-white/70">{offline ? tr('Le marché ouvre quand ton perso est en ligne.') : tr('Ton argent : {0} Djai. Une recrue se paie une fois et reste au club.', { 0: (money ?? 0).toLocaleString('fr-FR') })}</div>
          {market.map((p) => {
            const owned = squad.some((q) => q.id === p.id)
            const full = squad.length >= (view?.max ?? 5)
            return (
              <div key={p.id} className="flex items-center gap-2 rounded-[16px] bg-black/25 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-extrabold">{p.name}</div>
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-white/60">
                    {POSTS[p.post]} <Stars n={p.stars} size={10} />
                  </div>
                </div>
                <button
                  className="flex items-center gap-1 rounded-full bg-[#ffd43b] px-2.5 py-1.5 text-[12px] font-extrabold text-[#16161c] disabled:bg-white/15 disabled:text-white/60"
                  disabled={owned || full || busy !== null || offline || (money !== undefined && money < p.price)}
                  onClick={() => void sign(p)}
                >
                  {owned ? (
                    tr('Au club')
                  ) : (
                    <>
                      <UserPlus size={14} /> {p.price.toLocaleString('fr-FR')}
                    </>
                  )}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** The career begun: the neighbourhood's club, and how the seasons are played. */
function Start({ club, onStart, onBack }: { club: Team; onStart: (o: { size: 5 | 11; level: number; length: number }) => void; onBack: () => void }) {
  const [size, setSize] = useState<5 | 11>(5)
  const [level, setLevel] = useState(1)
  const [length, setLength] = useState(1)
  const chip = (on: boolean) => `rounded-full px-3 py-1.5 text-[12.5px] font-extrabold transition ${on ? 'bg-[#ffd43b] text-[#16161c]' : 'bg-black/25 text-white/85'}`
  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[radial-gradient(circle_at_50%_0%,#1f7a3f,#0b2e1a_70%)] px-4 pt-12 pb-6 text-white">
      <div className="flex items-center gap-2">
        <button className="grid h-9 w-9 place-items-center rounded-full bg-black/30" onClick={onBack} aria-label={tr('Retour')}>
          <ChevronLeft size={20} />
        </button>
        <div className="font-display text-[26px] leading-tight font-extrabold">{tr('Carrière')}</div>
      </div>
      <div className="mt-4 flex flex-col items-center rounded-[22px] bg-white/10 p-4 text-center ring-1 ring-white/12">
        <Shirt color={club.home} size={64} />
        <div className="mt-1 font-display text-[22px] leading-tight font-extrabold">{club.name}</div>
        <Stars n={club.stars} size={13} />
        <p className="mt-2 text-[13px] leading-snug font-bold text-white/75">
          {tr("Le club de ton quartier. Une saison : sept journées contre sept clubs tirés au sort, le classement, et le titre au bout. Des recrues au marché des transferts, payées en Djai, rendent l'équipe plus forte.")}
        </p>
      </div>
      <div className="mt-3">
        <div className="text-[11px] font-extrabold tracking-wide text-white/60 uppercase">{tr('Format')}</div>
        <div className="mt-1 flex gap-1.5">
          {([5, 11] as const).map((n) => (
            <button key={n} className={chip(size === n)} onClick={() => setSize(n)}>
              {tx('{n} contre {n}', { n })}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3">
        <div className="text-[11px] font-extrabold tracking-wide text-white/60 uppercase">{tr('Difficulté')}</div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {LEVELS.map((l, k) => (
            <button key={l.id} className={chip(level === k)} onClick={() => setLevel(k)}>
              {l.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3">
        <div className="text-[11px] font-extrabold tracking-wide text-white/60 uppercase">{tr("Durée d'un match")}</div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {LENGTHS[size].map((sec, k) => (
            <button key={sec} className={chip(length === k)} onClick={() => setLength(k)}>
              {tx('{0} min', { 0: sec / 60 })}
            </button>
          ))}
        </div>
      </div>
      <button className="btn mt-5 w-full !bg-[#ffd43b] !py-3 !text-[#16161c] shadow-[0_4px_0_#e09a00]" onClick={() => onStart({ size, level, length })}>
        {tr('Commencer la saison')}
      </button>
    </div>
  )
}
