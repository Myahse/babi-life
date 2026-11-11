import { useEffect, useRef, useState } from 'react'
import { Bell, BellRing, CalendarClock, ChevronRight, MapPin, Trophy, Users } from 'lucide-react'
import { api, ApiError, type RendezVousItem } from '../lib/api'
import type { Sim, World } from '../lib/types'
import { serverNow } from '../lib/worldClock'
import { aCommune } from '../lib/french'
import { clockTime, locale, t as tr, tn } from '../lib/i18n'
import { openRendezVous } from '../lib/rendezvous'

/**
 * Les rendez-vous de la semaine (update « rendez-vous », backend game/rendezvous.go, sims/rendezvous.go):
 * the phone's « Rendez-vous » app, each one with its countdown, « J'y serai » (a reminder a quarter of an
 * hour before) and, while it's on, « En cours, rejoins ! » with the one tap that leads there. Also a strip
 * in Gbairai (screens/Grin.tsx) that opens the app. Abidjan's clock is UTC: the times are shown so.
 */

/** The week's rendez-vous, asked again every minute while something shows them. */
export function useRendezVous(simId: string, on: boolean) {
  const [items, setItems] = useState<RendezVousItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // « J'y serai » still on its way: a list read meanwhile keeps the player's choice.
  const pending = useRef(new Map<string, boolean>())
  useEffect(() => {
    if (!on) return
    let live = true
    const load = () =>
      api
        .rendezvous(simId)
        .then((r) => live && (setItems(r.items.map((x) => (pending.current.has(x.key) && x.mine !== pending.current.get(x.key) ? { ...x, mine: pending.current.get(x.key)!, going: Math.max(0, x.going + (pending.current.get(x.key) ? 1 : -1)) } : x))), setError(null)))
        .catch((e) => live && setError(e instanceof ApiError ? e.message : tr('Pas de réseau, réessaie.')))
    void load()
    const t = setInterval(load, 60_000)
    return () => ((live = false), clearInterval(t))
  }, [simId, on])
  return { items, setItems, error, pending: pending.current }
}

/** Re-renders every few seconds (the countdowns). */
function useTick(ms: number) {
  const [, set] = useState(0)
  useEffect(() => {
    const t = setInterval(() => set((n) => n + 1), ms)
    return () => clearInterval(t)
  }, [ms])
  return serverNow()
}

/** « 2 j 3 h », « 1 h 20 », « 12 min »: how long until (or how long still). */
export function span(ms: number) {
  const m = Math.max(1, Math.ceil(ms / 60_000))
  if (m < 60) return tr('{0} min', { 0: m })
  const h = Math.floor(m / 60)
  if (h < 24) return m % 60 ? tr('{0} h {1}', { 0: h, 1: String(m % 60).padStart(2, '0') }) : tr('{0} h', { 0: h })
  const d = Math.floor(h / 24)
  return h % 24 ? tr('{0} j {1} h', { 0: d, 1: h % 24 }) : tr('{0} j', { 0: d })
}

/** « samedi 16 h – 18 h » (Abidjan's clock, UTC). */
function when(it: RendezVousItem, now: number) {
  const from = new Date(it.from)
  const to = new Date(it.until)
  const day = from.toLocaleDateString(locale(), { weekday: 'long', timeZone: 'UTC' })
  const today = new Date(now).toISOString().slice(0, 10) === it.from.slice(0, 10)
  const tomorrow = new Date(now + 86_400_000).toISOString().slice(0, 10) === it.from.slice(0, 10)
  const d = today ? tr("aujourd'hui") : tomorrow ? tr('demain') : day
  return tr('{0}, {1} – {2}', { 0: d, 1: clockTime(from.getUTCHours(), from.getUTCMinutes()), 2: clockTime(to.getUTCHours(), to.getUTCMinutes()) })
}

/** The colours of each mode's card. */
const TONE: Record<RendezVousItem['mode'], [string, string]> = {
  maquis: ['#ffb347', '#e8590c'],
  soiree: ['#d0a2ff', '#7048e8'],
  dames: ['#ffd36e', '#c98a00'],
  foot: ['#69e2a0', '#00a862'],
  politique: ['#8c9eff', '#3d4fd6'],
}

export function RendezVousApp({ world, sim, onGo }: { world: World; sim: Sim; onGo: (it: RendezVousItem) => void }) {
  const { items, setItems, error, pending } = useRendezVous(sim.id, true)
  const now = useTick(15_000)
  const [note, setNote] = useState<string | null>(null)
  const [pop, setPop] = useState<string | null>(null)
  const communeName = (id?: string) => (id ? (world.cities.flatMap((c) => c.communes).find((c) => c.id === id)?.name ?? id) : '')
  const update = (key: string, patch: Partial<RendezVousItem>) => setItems((list) => list && list.map((x) => (x.key === key ? { ...x, ...patch } : x)))
  const remind = (it: RendezVousItem) => {
    const on = !it.mine
    // At once on the screen (the server confirms the count).
    update(it.key, { mine: on, going: Math.max(0, it.going + (on ? 1 : -1)) })
    if (on) setPop(it.key)
    pending.set(it.key, on)
    api
      .rendezvousSet(sim.id, it.key, { remind: on })
      .then((r) => update(it.key, { going: r.going, mine: on }))
      .catch((e) => (update(it.key, { mine: !on, going: it.going }), setNote(e instanceof ApiError ? e.message : tr('Pas de réseau, réessaie.'))))
      .finally(() => pending.delete(it.key))
  }
  const go = (it: RendezVousItem) => {
    void api.rendezvousSet(sim.id, it.key, { join: true }).catch(() => undefined)
    onGo(it)
  }
  if (error && !items) return <p className="mt-6 text-center text-sm font-semibold text-[var(--color-ink-soft)]">{error}</p>
  if (!items) return <p className="mt-6 text-center text-sm font-semibold text-[var(--color-ink-soft)]">{tr('Chargement…')}</p>
  return (
    <div className="pt-3">
      <p className="mb-3 text-[13px] font-semibold text-[var(--color-ink-soft)]">{tr("Chaque semaine, à heure fixe (heure d'Abidjan). Touche « J'y serai » : on te prévient un quart d'heure avant.")}</p>
      {note && <p className="mb-2 rounded-xl bg-[#fff1e6] px-3 py-2 text-[13px] font-semibold text-[#c2410c]">{note}</p>}
      {items.length === 0 && <p className="mt-6 text-center text-sm font-semibold text-[var(--color-ink-soft)]">{tr('Pas de rendez-vous cette semaine.')}</p>}
      <ul className="motion-stagger space-y-2.5">
        {items.map((it) => {
          const from = Date.parse(it.from)
          const until = Date.parse(it.until)
          const live = now >= from && now < until
          const where = it.commune ? aCommune(communeName(it.commune)) : ''
          const [c1, c2] = TONE[it.mode]
          return (
            <li key={it.key} className={`relative overflow-hidden rounded-[22px] border bg-white p-3 shadow-[0_2px_10px_rgba(0,0,0,0.06)] ${live ? 'border-transparent ring-2 ring-[#00a862]' : 'border-black/[0.06]'}`}>
              <div className="flex items-start gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] text-[26px] shadow-[inset_0_-3px_0_rgba(0,0,0,0.18)]" style={{ background: `linear-gradient(160deg, ${c1}, ${c2})` }}>
                  {it.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  {live ? (
                    <span className="mb-0.5 inline-flex items-center gap-1.5 rounded-full bg-[#00a862] px-2 py-0.5 text-[11px] font-extrabold tracking-wide text-white uppercase">
                      <span className="h-1.5 w-1.5 animate-ping rounded-full bg-white" />
                      {tr('En cours — rejoins !')}
                    </span>
                  ) : (
                    <span className="mb-0.5 inline-flex items-center gap-1 text-[12px] font-extrabold" style={{ color: c2 }}>
                      <CalendarClock size={13} strokeWidth={2.6} />
                      {tr('Dans {0}', { 0: span(from - now) })}
                    </span>
                  )}
                  <h4 className="font-display text-[16px] leading-tight font-extrabold text-[#111]">{it.label}</h4>
                  <p className="mt-0.5 text-[12.5px] font-semibold text-[var(--color-ink-soft)]">
                    {when(it, now)}
                    {where && (
                      <span className="ml-1 inline-flex items-center gap-0.5">
                        <MapPin size={12} className="-mt-0.5" /> {where}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-[13px] leading-snug text-[#333]">{it.about}</p>
              <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[#fff6d6] px-2 py-0.5 text-[12px] font-extrabold text-[#9a6700]">
                <Trophy size={12} /> {it.bonus}
              </p>
              {it.ranking && it.ranking.length > 0 && (
                <ol className="mt-2 space-y-0.5 rounded-xl bg-[#f6f7fb] px-3 py-2 text-[12.5px] font-bold text-[#333]">
                  {it.ranking.map((r, i) => (
                    <li key={r.sim} className={`flex justify-between ${r.sim === sim.id ? 'text-[#c2410c]' : ''}`}>
                      <span>
                        {i + 1}. {r.name}
                      </span>
                      <span>{tn(r.points, '{n} point', '{n} points')}</span>
                    </li>
                  ))}
                </ol>
              )}
              <div className="mt-2.5 flex items-center gap-2">
                <span className="flex min-w-0 flex-1 items-center gap-1 text-[12px] font-bold text-[var(--color-ink-soft)]">
                  <Users size={13} />
                  <span className="truncate">{live ? (it.joined ? tn(it.joined, '{n} y est', '{n} y sont') : tr('Sois le premier à y aller !')) : it.going ? tn(it.going, '{n} y sera', '{n} y seront') : tr('Sois le premier à dire oui !')}</span>
                </span>
                {live ? (
                  <button className="flex items-center gap-1 rounded-full bg-[#00a862] px-4 py-2 text-[14px] font-extrabold text-white shadow-[0_3px_0_#007a46] transition-transform active:translate-y-[2px] active:scale-95 active:shadow-none" onClick={() => go(it)}>
                    {tr('Y aller')}
                    <ChevronRight size={16} strokeWidth={3} />
                  </button>
                ) : (
                  <button
                    className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13.5px] font-extrabold transition-transform active:scale-95 ${it.mine ? 'bg-[#111] text-white' : 'border-2 text-[#111]'} ${pop === it.key ? 'animate-[rdv-pop_0.35s_ease-out]' : ''}`}
                    style={it.mine ? undefined : { borderColor: c2 }}
                    onAnimationEnd={() => setPop(null)}
                    onClick={() => remind(it)}
                    aria-pressed={it.mine}
                  >
                    {it.mine ? <BellRing size={15} /> : <Bell size={15} />}
                    {it.mine ? tr('Tu y seras') : tr("J'y serai")}
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      <style>{'@keyframes rdv-pop{0%{transform:scale(1)}40%{transform:scale(1.14)}100%{transform:scale(1)}}'}</style>
    </div>
  )
}

/** The strip in Gbairai (Babi Infos, the grin's list): the rendez-vous on now, or the next one, and its countdown; a tap opens the app. */
export function RendezVousStrip({ sim }: { sim: Sim }) {
  const { items } = useRendezVous(sim.id, true)
  const now = useTick(20_000)
  const it = items?.find((x) => Date.parse(x.until) > now) ?? null
  if (!it) return null
  const live = now >= Date.parse(it.from)
  return (
    <button className={`flex w-full items-center gap-2.5 px-3 py-2 text-left active:opacity-80 ${live ? 'bg-[#00a862] text-white' : 'bg-[#fff6d6] text-[#5c4300]'}`} onClick={openRendezVous}>
      <span className="text-[20px]">{it.emoji}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-extrabold">{live ? tr('En cours — rejoins ! {0}', { 0: it.label }) : it.label}</span>
        <span className="block truncate text-[12px] font-semibold opacity-80">{live ? tr('Encore {0}', { 0: span(Date.parse(it.until) - now) }) : tr('Dans {0} · Rendez-vous de la semaine', { 0: span(Date.parse(it.from) - now) })}</span>
      </span>
      <ChevronRight size={18} strokeWidth={2.6} />
    </button>
  )
}
