import { useState } from 'react'
import { Crown, Megaphone, PartyPopper, Star, Users } from 'lucide-react'
import { api } from '../../lib/api'
import type { Election, Politics, Sim, StateEvent, World } from '../../lib/types'
import { Chip, IconTile } from '../../components/ui'

// The president's week in the Politique app (backend politics/presidency.go):
// who governs till Monday 9 h, their speech and addresses to the nation, the
// two measures decreed for everyone, the citizens' stars (one a day), the
// Fête de la Nation at the stadium. And, for a candidate, the campaign in
// the street: the tours, the militants called, the meeting at the stadium.

type Run = (call: () => Promise<unknown>) => Promise<boolean>
type City = World['cities'][number]

const F = (n: number) => `${n.toLocaleString('fr-FR')} F`
const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
/** A moment on Abidjan's clock (UTC): « samedi 31 octobre à 15 h ». */
export function abidjan(iso: string | number | Date) {
  const d = new Date(iso)
  const m = d.getUTCMinutes()
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} à ${d.getUTCHours()} h${m ? ` ${String(m).padStart(2, '0')}` : ''}`
}
/** The full hours from `from` to `to` (Abidjan's clock), for a big day's start. */
function hours(from: number, to: number) {
  const out: Date[] = []
  const t = new Date(Math.ceil(from / 3_600_000) * 3_600_000)
  for (; t.getTime() <= to; t.setTime(t.getTime() + 3_600_000)) out.push(new Date(t))
  return out
}
const stadiumsOf = (city: City) => city.communes.flatMap((c) => c.places.filter((x) => x.kind === 'stade'))
const placeName = (city: City, id: string) => city.communes.flatMap((c) => c.places).find((x) => x.id === id)?.name ?? id

/** A big day at the stadium, and the way there. */
function EventRow({ e, city, onWalk }: { e: StateEvent; city: City; onWalk: (id: string) => void }) {
  const live = Date.now() >= Date.parse(e.startsAt) - 30 * 60_000
  return (
    <li className="flex items-center gap-2 rounded-2xl bg-white p-2.5">
      <IconTile icon={e.kind === 'fete' ? PartyPopper : Megaphone} colors={e.kind === 'fete' ? ['#ffd54f', '#ff8f00'] : [e.color || '#8c9eff', '#3d4fd6']} size={36} />
      <div className="min-w-0 flex-1 leading-tight">
        <div className="text-sm font-extrabold">{e.kind === 'fete' ? 'Fête de la Nation' : `Meeting de ${e.name}`}</div>
        <div className="text-[11.5px] font-bold text-[var(--color-ink-soft)]">
          {abidjan(e.startsAt)} · {placeName(city, e.place)}
          {e.guests ? ` · ${e.guests} venu${e.guests > 1 ? 's' : ''}` : ''}
        </div>
      </div>
      <button className="btn-soft shrink-0 rounded-full px-3 py-1.5 text-xs font-extrabold" onClick={() => onWalk(e.place)}>
        {live ? 'Y aller' : 'Voir'}
      </button>
    </li>
  )
}

/** A stadium and an hour, for the Fête or a meeting. */
function BigDayForm({ city, from, to, label, onPick }: { city: City; from: number; to: number; label: string; onPick: (place: string, at: string) => void }) {
  const stadiums = stadiumsOf(city)
  const slots = hours(Math.max(from, Date.now() + 15 * 60_000), to)
  const [place, setPlace] = useState(stadiums[0]?.id ?? '')
  const [at, setAt] = useState(slots[0]?.toISOString() ?? '')
  if (!stadiums.length || !slots.length) return <p className="text-xs font-semibold text-[var(--color-ink-soft)]">Pas de stade ou plus d’heure libre d’ici là.</p>
  return (
    <div className="space-y-2">
      <select className="input w-full !py-2 text-sm font-bold" value={place} onChange={(x) => setPlace(x.target.value)}>
        {stadiums.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <select className="input w-full !py-2 text-sm font-bold" value={at} onChange={(x) => setAt(x.target.value)}>
        {slots.map((d) => (
          <option key={d.toISOString()} value={d.toISOString()}>
            {abidjan(d)}
          </option>
        ))}
      </select>
      <button className="btn w-full !py-2 !text-sm" onClick={() => onPick(place, at)}>
        {label}
      </button>
    </div>
  )
}

/* ---------- The president's week ---------- */

export function Presidence({ p, sim, city, run, onWalk, minor }: { p: Politics; sim: Sim; city: City; run: Run; onWalk: (id: string) => void; minor: boolean }) {
  const w = p.week
  const mine = w?.sim === sim.id
  const [text, setText] = useState('')
  const spoke = !!w?.words.some((x) => x.kind === 'discours')
  const measure = (id: string) => p.measures.find((m) => m.id === id)
  const others = p.events.filter((e) => e.kind === 'meeting' || e.id !== w?.fete?.id)
  return (
    <div className="space-y-4">
      {!w ? (
        <div className="flex items-start gap-3 rounded-[22px] bg-[#fff8e1] p-4">
          <IconTile icon={Crown} colors={['#ffd54f', '#ff8f00']} size={44} />
          <div className="min-w-0 text-sm font-semibold text-[var(--color-ink-soft)]">
            <div className="font-display text-lg leading-tight font-extrabold text-[var(--color-ink)]">Pas de président·e cette semaine</div>
            {p.president ? `Les résultats de la présidentielle tombent ${abidjan(p.president.resultsAt)}. ` : ''}Présente-toi (onglet Élections) : un·e président·e par semaine.
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-3 rounded-[22px] bg-[#fff8e1] p-4">
            <IconTile icon={Crown} colors={['#ffd54f', '#ff8f00']} size={44} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-display text-lg leading-tight font-extrabold">
                  {w.name}
                  {mine ? ' (toi)' : ''}
                </span>
                {w.acronym && (
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-extrabold text-white" style={{ background: w.color || '#111827' }}>
                    {w.acronym}
                  </span>
                )}
              </div>
              <div className="text-xs font-bold text-[var(--color-ink-soft)]">Président·e de la République jusqu’au {abidjan(w.until)}</div>
              <div className="mt-1 flex items-center gap-1 text-sm font-extrabold text-[#b26a00]">
                <Star size={15} className="fill-current" />
                {w.rating.count ? `${w.rating.avg.toFixed(1).replace('.', ',')} / 5 · ${w.rating.count} note${w.rating.count > 1 ? 's' : ''}` : 'Pas encore noté·e'}
              </div>
            </div>
          </div>
          {!mine && !minor && (
            <section className="rounded-[22px] bg-[var(--color-canvas)] p-3">
              <div className="text-sm font-extrabold">Ta note du jour</div>
              <p className="text-xs font-semibold text-[var(--color-ink-soft)]">Une fois par jour. Si {w.name.split(' ')[0]} se représente, sa note pèse sur sa campagne.</p>
              <div className="mt-2 flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} aria-label={`${n} étoile${n > 1 ? 's' : ''}`} disabled={w.rating.mine > 0} className={`grid h-10 flex-1 place-items-center rounded-xl ${n <= w.rating.mine ? 'bg-[#ffb300] text-white' : 'bg-white text-[#b26a00]'} disabled:opacity-90`} onClick={() => void run(() => api.ratePresident(sim.id, n))}>
                    <Star size={20} className={n <= w.rating.mine ? 'fill-current' : ''} />
                  </button>
                ))}
              </div>
            </section>
          )}
          <section className="space-y-2 rounded-[22px] bg-[var(--color-canvas)] p-3">
            <div className="flex items-center justify-between">
              <h4 className="font-display text-base font-extrabold">Les mesures de la semaine</h4>
              <Chip tone="neutral">
                {w.measures.length} / {p.rules.measures}
              </Chip>
            </div>
            {w.measures.length === 0 && <p className="text-sm font-semibold text-[var(--color-ink-soft)]">{mine ? 'Décrète tes deux mesures : elles valent pour tous les joueurs jusqu’à lundi 9 h.' : 'Rien de décrété pour l’instant.'}</p>}
            <ul className="space-y-1.5">
              {w.measures.map((id) => (
                <li key={id} className="rounded-2xl bg-white p-2.5">
                  <div className="text-sm font-extrabold text-[#0f7a3f]">{measure(id)?.label ?? id}</div>
                  <div className="text-xs font-semibold text-[var(--color-ink-soft)]">{measure(id)?.about}</div>
                </li>
              ))}
            </ul>
            {mine && w.measures.length < p.rules.measures && (
              <ul className="space-y-1.5">
                {p.measures
                  .filter((m) => !w.measures.includes(m.id))
                  .map((m) => (
                    <li key={m.id} className="flex items-center gap-2 rounded-2xl border border-dashed border-[#c9cfe0] p-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold">{m.label}</div>
                        <div className="text-[11px] font-semibold text-[var(--color-ink-soft)]">{m.about}</div>
                      </div>
                      <button className="btn shrink-0 !py-1.5 !text-xs" onClick={() => void run(() => api.decree(sim.id, m.id))}>
                        Décréter
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </section>
          <section className="space-y-2 rounded-[22px] bg-[var(--color-canvas)] p-3">
            <h4 className="font-display text-base font-extrabold">Ses mots à la nation</h4>
            {mine && (
              <div className="space-y-2 rounded-2xl bg-white p-3">
                <div className="text-sm font-extrabold">{spoke ? 'Ton adresse du jour' : 'Ton discours d’investiture'}</div>
                <p className="text-xs font-semibold text-[var(--color-ink-soft)]">{spoke ? 'Une par jour : tous les joueurs la reçoivent.' : 'Dis ce que tu vas faire cette semaine : tous les joueurs le reçoivent.'}</p>
                <textarea value={text} onChange={(x) => setText(x.target.value.slice(0, spoke ? 600 : 1500))} rows={4} placeholder={spoke ? 'Ivoiriens, Ivoiriennes…' : 'Ivoiriens, Ivoiriennes, cette semaine, je…'} className="input w-full resize-none text-sm font-semibold" />
                <button className="btn w-full !py-2 !text-sm" disabled={text.trim().length < (spoke ? 10 : 20)} onClick={() => void run(() => api.speak(sim.id, spoke ? 'adresse' : 'discours', text)).then((ok) => ok && setText(''))}>
                  {spoke ? 'S’adresser à la nation' : 'Prononcer le discours'}
                </button>
              </div>
            )}
            {w.words.length === 0 && !mine && <p className="text-sm font-semibold text-[var(--color-ink-soft)]">Pas encore de discours.</p>}
            <ul className="space-y-1.5">
              {w.words.map((x) => (
                <li key={x.at} className="rounded-2xl bg-white p-3">
                  <div className="text-[11px] font-extrabold tracking-wide text-[var(--color-ink-soft)] uppercase">
                    {x.kind === 'discours' ? 'Discours d’investiture' : 'Adresse à la nation'} · {abidjan(x.at)}
                  </div>
                  <p className="mt-1 text-sm leading-snug font-semibold whitespace-pre-wrap">« {x.text} »</p>
                </li>
              ))}
            </ul>
          </section>
          <section className="space-y-2 rounded-[22px] bg-[var(--color-canvas)] p-3">
            <h4 className="font-display text-base font-extrabold">La Fête de la Nation</h4>
            {w.fete ? (
              <ul>
                <EventRow e={w.fete} city={city} onWalk={onWalk} />
              </ul>
            ) : mine ? (
              <>
                <p className="text-xs font-semibold text-[var(--color-ink-soft)]">Une par semaine, {p.rules.feteHours} h au stade, entrée libre : musique, artistes, et toute la ville qui danse. Tous les joueurs sont prévenus.</p>
                <BigDayForm city={city} from={Date.now()} to={Date.parse(w.until) - p.rules.feteHours * 3_600_000} label="Annoncer la fête" onPick={(place, at) => void run(() => api.fete(sim.id, place, at))} />
              </>
            ) : (
              <p className="text-sm font-semibold text-[var(--color-ink-soft)]">Pas encore annoncée.</p>
            )}
          </section>
        </>
      )}
      {others.length > 0 && (
        <section className="space-y-2">
          <h4 className="label">Au stade</h4>
          <ul className="space-y-1.5">
            {others.map((e) => (
              <EventRow key={e.id} e={e} city={city} onWalk={onWalk} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

/* ---------- The campaign in the street (a candidate's) ---------- */

export function Terrain({ e, p, sim, city, run }: { e: Election; p: Politics; sim: Sim; city: City; run: Run }) {
  const forPresident = e.kind === 'president'
  const communes = city.communes.filter((c) => c.admin?.mairie)
  const [commune, setCommune] = useState(forPresident ? sim.homeCommune : (e.commune ?? sim.homeCommune))
  const [pay, setPay] = useState(2000)
  const [slots, setSlots] = useState(5)
  const now = Date.now()
  const opens = Date.parse(e.campaignAt)
  const votes = Date.parse(e.votesAt)
  const calls = p.myCalls.filter((c) => c.election === e.id)
  const meeting = p.myEvents.find((x) => x.kind === 'meeting')
  const name = (id: string) => city.communes.find((c) => c.id === id)?.name ?? id
  const r = p.rules
  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-[#eef2ff] p-2.5 text-xs font-semibold text-[#3d4fd6]">
        <b>Sur le terrain</b> : va dans une mairie, un marché ou un maquis {forPresident ? 'de n’importe quelle commune' : 'de ta commune'} et choisis « Faire campagne ici » : +{r.tourPoints} pts dans la commune ({F(r.tourCost)}), une fois par lieu{now < opens ? `, dès ${abidjan(e.campaignAt)}` : ''}.
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-sm font-extrabold">
          <Users size={15} /> Tes militants
        </div>
        <p className="text-xs font-semibold text-[var(--color-ink-soft)]">Les membres de ton parti sont prévenus ; chacun qui milite dans la commune pendant la campagne te rapporte +{r.militantPoints} pts. Tu paies d’avance ; ce qui n’est pas pris te revient aux résultats.</p>
        {forPresident && (
          <select className="input w-full !py-2 text-sm font-bold" value={commune} onChange={(x) => setCommune(x.target.value)}>
            {communes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px] font-bold text-[var(--color-ink-soft)]">
            Paie de chacun
            <input className="input mt-0.5 w-full !py-1.5 text-sm font-bold" inputMode="numeric" value={pay} onChange={(x) => setPay(Number(x.target.value.replace(/\D/g, '').slice(0, 5)) || 0)} />
          </label>
          <label className="text-[11px] font-bold text-[var(--color-ink-soft)]">
            Militants
            <input className="input mt-0.5 w-full !py-1.5 text-sm font-bold" inputMode="numeric" value={slots} onChange={(x) => setSlots(Number(x.target.value.replace(/\D/g, '').slice(0, 2)) || 0)} />
          </label>
        </div>
        <button className="btn w-full !py-2 !text-sm" disabled={pay < r.payMin || pay > r.payMax || slots < 1 || slots > r.slotsMax || now >= votes} onClick={() => void run(() => api.callMilitants(sim.id, e.id, forPresident ? commune : (e.commune ?? sim.homeCommune), pay, slots))}>
          {pay < r.payMin || pay > r.payMax ? `De ${F(r.payMin)} à ${F(r.payMax)} chacun` : slots < 1 || slots > r.slotsMax ? `1 à ${r.slotsMax} militants` : `Appeler ${slots} militant${slots > 1 ? 's' : ''} · ${F(pay * slots)}`}
        </button>
        {calls.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-xl bg-[var(--color-canvas)] px-3 py-1.5 text-xs font-bold">
            <span>
              {name(c.commune)} · {F(c.pay)} chacun
            </span>
            <span>
              {c.taken} / {c.slots} venus
            </span>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-sm font-extrabold">
          <Megaphone size={15} /> Ton meeting au stade
        </div>
        {meeting ? (
          <p className="rounded-xl bg-[var(--color-canvas)] px-3 py-2 text-xs font-bold">
            {abidjan(meeting.startsAt)} au {placeName(city, meeting.place)} · {meeting.guests} venu{meeting.guests > 1 ? 's' : ''} pour l’instant
          </p>
        ) : (
          <>
            <p className="text-xs font-semibold text-[var(--color-ink-soft)]">
              Un par campagne, {r.meetingHours} h, pendant la campagne : +{r.meetingPoints} pts {forPresident ? 'partout' : 'dans ta commune'}, et +{r.meetingGuest} par personne venue (jusqu’à {r.meetingGuests}). Tout le monde est prévenu.
            </p>
            <BigDayForm city={city} from={opens} to={votes - r.meetingHours * 3_600_000} label={`Annoncer mon meeting · ${F(r.meetingCost)}`} onPick={(place, at) => void run(() => api.meeting(sim.id, e.id, place, at))} />
          </>
        )}
      </div>
    </div>
  )
}
