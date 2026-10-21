import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, Clapperboard, Crown, Footprints, MapPin, Ticket } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import type { CinemaFilm, CinemaProgram, CinemaSeats, CinemaSession, CinemaTicket, Sim, World } from '../lib/types'
import { fcfa } from '../game/rules'
import type { Act } from './phoneApps'

// Kinéo, the game's cinemas (backend game/cinema.go, sims/cinema.go), as the
// real chains' apps do it: what's on at Cap Sud or at Sococé, day by day;
// a session's room plan, the seats picked; paid with the Sim's money; the
// ticket with its code in « Mes billets », to show at the door (from three
// quarters of an hour before the film to twenty minutes in).

const CINEMAS = [
  { id: 'marcory-kineo', short: 'Cap Sud', where: 'Marcory', city: 'abidjan', commune: 'marcory' },
  { id: 'cocody-kineo', short: 'Sococé', where: 'Deux-Plateaux', city: 'abidjan', commune: 'cocody' },
]
const DAYS = ['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.', 'Dim.']
const RED = '#c8102e'

const clock = (m: number) => `${Math.floor((m % 1440) / 60)}:${String(m % 60).padStart(2, '0')}`
const dayLabel = (day: number, today: number) => (day === today ? "Aujourd'hui" : day === today + 1 ? 'Demain' : DAYS[day % 7])
const hm = (min: number) => `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`

/** A film's poster: its two colours, its title, its genre and length. */
function Poster({ f, small }: { f: CinemaFilm; small?: boolean }) {
  return (
    <div className={`relative shrink-0 overflow-hidden rounded-xl text-white shadow-[0_6px_14px_-8px_rgba(0,0,0,0.6)] ${small ? 'h-24 w-16' : 'h-32 w-[88px]'}`} style={{ background: `linear-gradient(160deg, ${f.colors[0]}, ${f.colors[1]})` }}>
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
      <div className={`absolute inset-x-1.5 bottom-1.5 font-display leading-[1.05] font-extrabold ${small ? 'text-[10px]' : 'text-[12px]'}`}>{f.title}</div>
      <span className="absolute top-1.5 left-1.5 rounded bg-black/55 px-1 text-[9px] font-extrabold">{f.rating === 'Tous publics' ? 'TP' : f.rating}</span>
    </div>
  )
}

export function KineoApp({ world, sim, act, onWalk, onMap, onClose }: { world: World; sim: Sim; act: Act; onWalk: (id: string) => void; onMap: () => void; onClose: () => void }) {
  const [tab, setTab] = useState<'program' | 'tickets'>('program')
  const [cinema, setCinema] = useState(() => (sim.commune === 'cocody' ? CINEMAS[1].id : CINEMAS[0].id))
  const [day, setDay] = useState<number | undefined>(undefined)
  const [prog, setProg] = useState<CinemaProgram | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<CinemaSession | null>(null)
  useEffect(() => {
    setProg(null)
    api
      .cinemaProgram(cinema, day)
      .then((p) => (setProg(p), setError(null)))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Pas de réseau'))
  }, [cinema, day])

  if (session && prog) {
    return (
      <SeatPicker
        cinema={cinema}
        session={session}
        sim={sim}
        onBack={() => setSession(null)}
        onPay={async (seats) => {
          const ok = await act(`Billets Kinéo`, 'clapperboard', 'cinema', () => api.cinemaBuy(sim.id, { cinema, salle: session.salle, at: session.at, seats }))
          if (ok) {
            setSession(null)
            setTab('tickets')
          }
          return ok
        }}
      />
    )
  }
  const films = prog ? prog.films.filter((f) => prog.sessions.some((s) => s.film === f.id)) : []
  return (
    <div className="-mx-4 -mt-2">
      {/* The brand's bar: the cinema, the two tabs */}
      <div className="px-4 pt-2 pb-3 text-white" style={{ background: `linear-gradient(160deg, ${RED}, #6b0716)` }}>
        <div className="flex items-center justify-between">
          <div className="font-display text-2xl font-extrabold tracking-wide">KINÉO</div>
          <div className="flex rounded-full bg-black/25 p-0.5 text-xs font-extrabold">
            {(['program', 'tickets'] as const).map((t) => (
              <button key={t} className={`rounded-full px-3 py-1 ${tab === t ? 'bg-white text-[#6b0716]' : ''}`} onClick={() => setTab(t)}>
                {t === 'program' ? "À l'affiche" : 'Mes billets'}
              </button>
            ))}
          </div>
        </div>
        {tab === 'program' && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {CINEMAS.map((c) => (
              <button key={c.id} className={`rounded-2xl px-3 py-2 text-left ${cinema === c.id ? 'bg-white text-[var(--color-ink)]' : 'bg-white/15'}`} onClick={() => (setCinema(c.id), setDay(undefined))}>
                <div className="font-display text-[15px] font-extrabold">Kinéo {c.short}</div>
                <div className="flex items-center gap-1 text-[11px] font-bold opacity-75">
                  <MapPin size={11} /> {c.where}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      {tab === 'tickets' ? (
        <Tickets world={world} sim={sim} act={act} onWalk={onWalk} onMap={onMap} onClose={onClose} />
      ) : (
        <div className="px-4 pt-3">
          {/* The week's days */}
          {prog && (
            <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-2">
              {Array.from({ length: 7 }, (_, k) => prog.today + k).map((d) => (
                <button key={d} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-extrabold ${d === prog.day ? 'text-white' : 'bg-[var(--color-canvas)] text-[var(--color-ink-soft)]'}`} style={d === prog.day ? { background: RED } : undefined} onClick={() => setDay(d)}>
                  {dayLabel(d, prog.today)}
                </button>
              ))}
            </div>
          )}
          {error && <p className="py-6 text-center text-sm font-bold text-[var(--color-ink-soft)]">{error}</p>}
          {!prog && !error && <p className="py-6 text-center text-sm font-bold text-[var(--color-ink-soft)]">Le programme arrive…</p>}
          {prog && films.length === 0 && <p className="py-6 text-center text-sm font-bold text-[var(--color-ink-soft)]">Plus de séance aujourd'hui : regarde demain.</p>}
          <ul className="space-y-3 pb-4">
            {films.map((f) => (
              <li key={f.id} className="flex gap-3 rounded-[20px] bg-white p-2.5 shadow-[0_4px_12px_-8px_rgba(0,0,0,0.3)]">
                <Poster f={f} />
                <div className="min-w-0 flex-1">
                  <div className="font-display text-[15px] leading-tight font-extrabold">{f.title}</div>
                  <div className="mt-0.5 text-[11px] font-extrabold text-[var(--color-ink-soft)]">
                    {f.genre} · {hm(f.minutes)} · {f.rating}
                  </div>
                  <p className="mt-1 line-clamp-2 text-[12px] leading-snug font-bold text-[var(--color-ink-soft)]">{f.tagline}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {prog!.sessions
                      .filter((s) => s.film === f.id)
                      .map((s) => (
                        <button key={`${s.salle}-${s.at}`} disabled={s.left === 0} className="rounded-xl border-2 px-2 py-1 text-left disabled:opacity-40" style={{ borderColor: s.vip ? '#c9a227' : '#e6e1d8' }} onClick={() => setSession(s)}>
                          <div className="flex items-center gap-1 font-display text-[14px] leading-none font-extrabold">
                            {clock(s.at)}
                            {s.vip && <Crown size={11} color="#c9a227" />}
                          </div>
                          <div className="text-[10px] font-extrabold text-[var(--color-ink-soft)]">{s.left === 0 ? 'Complet' : s.left < 15 ? `${s.left} places` : `Salle ${s.salle}`}</div>
                        </button>
                      ))}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/** The room's plan: the screen at the top, the seats in rows (A at the front), the aisles; taken, free, picked. */
function SeatPicker({ cinema, session, sim, onBack, onPay }: { cinema: string; session: CinemaSession; sim: Sim; onBack: () => void; onPay: (seats: string[]) => Promise<boolean> }) {
  const [data, setData] = useState<CinemaSeats | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    void api.cinemaSeats(cinema, session.salle, session.at).then(setData, () => undefined)
  }, [cinema, session])
  const taken = useMemo(() => new Set(data?.taken ?? []), [data])
  if (!data) return <p className="py-10 text-center text-sm font-bold text-[var(--color-ink-soft)]">Le plan de la salle arrive…</p>
  const s = data.salle
  const total = picked.length * session.price
  const toggle = (n: string) => setPicked((p) => (p.includes(n) ? p.filter((x) => x !== n) : p.length >= 6 ? p : [...p, n]))
  const cell = s.vip ? 'h-6 w-6' : 'h-[13px] w-[13px]'
  return (
    <div>
      <button className="mb-2 flex items-center gap-1 text-sm font-extrabold text-[var(--color-ink-soft)]" onClick={onBack}>
        <ChevronLeft size={16} /> Séances
      </button>
      <div className="flex gap-3">
        <Poster f={data.film} small />
        <div className="min-w-0">
          <div className="font-display text-[17px] leading-tight font-extrabold">{data.film.title}</div>
          <div className="mt-1 text-xs font-extrabold text-[var(--color-ink-soft)]">
            {s.name} · {clock(session.at)} · {fcfa(session.price)} la place
          </div>
          {s.vip && <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#fff4d6] px-2 py-0.5 text-[11px] font-extrabold text-[#8a6a10]"><Crown size={11} /> Fauteuils VIP inclinables, service en salle</div>}
        </div>
      </div>
      {/* The screen */}
      <div className="mx-auto mt-4 h-2 w-4/5 rounded-[50%] bg-gradient-to-b from-[#9fd3f2] to-transparent" />
      <div className="mb-2 text-center text-[10px] font-extrabold tracking-[0.3em] text-[var(--color-ink-soft)]">ÉCRAN</div>
      <div className="flex flex-col items-center gap-[3px] overflow-x-auto pb-1">
        {Array.from({ length: s.rows }, (_, r) => (
          <div key={r} className="flex items-center gap-[3px]">
            <span className="w-3 text-[9px] font-extrabold text-[var(--color-ink-soft)]">{String.fromCharCode(65 + r)}</span>
            {Array.from({ length: s.cols }, (_, c) => {
              const n = `${String.fromCharCode(65 + r)}${c + 1}`
              const gone = taken.has(n)
              const mine = picked.includes(n)
              return (
                <span key={c} className="flex">
                  <button aria-label={n} disabled={gone} className={`${cell} rounded-[3px] ${gone ? 'bg-[#cfcac0]' : mine ? '' : 'border border-[#bdb6a8] bg-white'}`} style={mine ? { background: RED } : undefined} onClick={() => toggle(n)} />
                  {s.aisles.includes(c + 1) && <span className="w-2" />}
                </span>
              )
            })}
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-center gap-3 text-[10px] font-extrabold text-[var(--color-ink-soft)]">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm border border-[#bdb6a8] bg-white" /> Libre</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-[#cfcac0]" /> Prise</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: RED }} /> Ta place</span>
      </div>
      <div className="sticky bottom-0 mt-3 rounded-2xl bg-white p-3 shadow-[0_-6px_16px_-10px_rgba(0,0,0,0.3)]">
        <div className="flex items-center justify-between text-sm font-extrabold">
          <span>{picked.length ? `${picked.length} place${picked.length > 1 ? 's' : ''} · ${picked.join(', ')}` : 'Touche une place libre (6 au plus)'}</span>
          <span>{fcfa(total)}</span>
        </div>
        <button className="btn mt-2 w-full !py-2.5 text-white" style={{ background: RED }} disabled={!picked.length || busy || total > sim.money} onClick={() => (setBusy(true), void onPay(picked).finally(() => setBusy(false)))}>
          <Ticket size={16} /> {total > sim.money ? 'Pas assez d’argent' : 'Payer'}
        </button>
      </div>
    </div>
  )
}

/** A ticket's code drawn as a QR-like square, the same for the same code. */
function Code({ code }: { code: string }) {
  const cells = useMemo(() => {
    let h = 2166136261
    const out: boolean[] = []
    for (let i = 0; i < 21 * 21; i++) {
      h = Math.imul(h ^ code.charCodeAt(i % code.length) ^ i, 16777619)
      out.push(((h >>> 13) & 1) === 1)
    }
    return out
  }, [code])
  const finder = (x: number, y: number) => [[0, 0], [14, 0], [0, 14]].some(([fx, fy]) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7)
  const inFinder = (x: number, y: number) => [[0, 0], [14, 0], [0, 14]].some(([fx, fy]) => { const [dx, dy] = [x - fx, y - fy]; return dx >= 0 && dx < 7 && dy >= 0 && dy < 7 && (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4)) })
  return (
    <svg viewBox="0 0 21 21" className="h-20 w-20 shrink-0 rounded-md bg-white p-0.5" shapeRendering="crispEdges">
      {cells.map((on, i) => {
        const [x, y] = [i % 21, Math.floor(i / 21)]
        const dark = finder(x, y) ? inFinder(x, y) : on
        return dark ? <rect key={i} x={x} y={y} width={1} height={1} fill="#141416" /> : null
      })}
    </svg>
  )
}

/** The Sim's tickets: coming, and the one whose doors are open now (go in), or just used. */
function Tickets({ world, sim, act, onWalk, onMap, onClose }: { world: World; sim: Sim; act: Act; onWalk: (id: string) => void; onMap: () => void; onClose: () => void }) {
  const [list, setList] = useState<{ tickets: CinemaTicket[]; now: number } | null>(null)
  const load = () => void api.cinemaTickets(sim.id).then(setList, () => undefined)
  useEffect(load, [sim.id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!list) return <p className="py-10 text-center text-sm font-bold text-[var(--color-ink-soft)]">Tes billets arrivent…</p>
  if (!list.tickets.length) return <p className="px-6 py-10 text-center text-sm font-bold text-[var(--color-ink-soft)]">Pas de billet pour l'instant. Choisis un film dans « À l'affiche ».</p>
  return (
    <ul className="space-y-3 px-4 pt-3 pb-4">
      {list.tickets.map((t) => {
        const c = CINEMAS.find((x) => x.id === t.cinema)!
        const here = sim.city === c.city && sim.commune === c.commune
        const open = !t.used && list.now >= t.at - 45 && list.now <= t.at + 20
        const late = !t.used && list.now > t.at + 20
        const place = world.cities.find((x) => x.id === c.city)?.communes.find((x) => x.id === c.commune)?.places.find((p) => p.id === t.cinema)
        return (
          <li key={t.id} className="overflow-hidden rounded-[20px] bg-white shadow-[0_4px_12px_-8px_rgba(0,0,0,0.3)]">
            <div className="flex items-center gap-2 px-3 py-2 text-white" style={{ background: `linear-gradient(90deg, ${RED}, #6b0716)` }}>
              <Clapperboard size={15} />
              <span className="font-display text-[14px] font-extrabold">{t.cinemaName}</span>
              <span className="ml-auto text-xs font-extrabold">{t.used ? 'Utilisé' : late ? 'Expiré' : `${dayLabel(Math.floor(t.at / 1440), Math.floor(list.now / 1440))} · ${clock(t.at)}`}</span>
            </div>
            <div className="flex gap-3 p-3">
              <Code code={t.code} />
              <div className="min-w-0 flex-1 text-sm">
                <div className="font-display text-[15px] leading-tight font-extrabold">{t.title}</div>
                <div className="mt-1 text-xs font-extrabold text-[var(--color-ink-soft)]">
                  {t.salleName} · {t.seats.length > 1 ? 'places' : 'place'} {t.seats.join(', ')}
                </div>
                <div className="mt-0.5 text-[11px] font-bold text-[var(--color-ink-soft)]">
                  {t.code} · {fcfa(t.price)}
                </div>
              </div>
            </div>
            {!t.used && !late && (
              <div className="px-3 pb-3">
                {open && here ? (
                  <button className="btn w-full !py-2 text-white" style={{ background: RED }} onClick={() => void act('Entrer dans la salle', 'clapperboard', 'cinema', () => api.cinemaUse(sim.id, t.id)).then((ok) => (ok ? onClose() : load()))}>
                    <Ticket size={15} /> Présenter le billet et entrer
                  </button>
                ) : here && place ? (
                  <button className="btn btn-soft w-full !py-2 !text-sm" onClick={() => (onClose(), onWalk(place.id))}>
                    <Footprints size={15} /> Y aller {open ? '' : `(portes ouvertes à ${clock(t.at - 45)})`}
                  </button>
                ) : (
                  <button className="btn btn-soft w-full !py-2 !text-sm" onClick={onMap}>
                    <MapPin size={15} /> {c.where} : y aller
                  </button>
                )}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
