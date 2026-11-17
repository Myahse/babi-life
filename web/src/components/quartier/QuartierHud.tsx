import { lazy, Suspense, useEffect, useMemo, useState, type ComponentType } from 'react'
import { Building2, CalendarDays, ChevronRight, Globe, Hammer, Home, LogOut, Map as MapIcon, MapPin, MessageCircle, Navigation, Settings, Star, Users, Utensils, X } from 'lucide-react'
import type { Player, Sim, World } from '../../lib/types'
import { t as tr, tx } from '../../lib/i18n'
import { IconTile } from '../ui'
import { TravelCTA } from '../TravelCTA'
import type { OnTravel } from '../TravelCTA'
import type { HubView, QuartierKind, QuartierTodo as QuartierTodoT, QuartierView } from '../../world3d/quartier/types'
import type { QLot } from '../../world3d/quartier/store'
import { quartierKindName, type QuartierState } from './useQuartier'
import { quartierApi, quartierMockOn } from './mock'
import { whereabouts } from '../../world3d/whereabouts'

// The quartier's screens over the street (update « mon-quartier », plan-quartier maquettes 2, 5, 6 and 7):
// « À faire maintenant », the level and « Gérer » / « Aller à Babi », the edge of the quartier, the hub
// « Rejoindre Babi en ligne », « Rentrer au quartier » in the open city, and a friend's quartier visited.

/** Maquette 2: the one thing to do now, the arrow on the ground leading there. */
export function QuartierTodo({ view, onGo, onManage, short }: { view: QuartierView; onGo: () => void; onManage: () => void; /** No room for the card (a small phone, sideways): one line, its buttons round. */ short?: boolean }) {
  const todo = view.todo
  if (!todo) return null
  const build = todo.kind === 'build' || todo.kind === 'goal'
  if (short)
    return (
      <div className="hud pointer-events-auto flex w-[min(100%,300px)] items-center gap-1.5 rounded-2xl py-1.5 pr-1.5 pl-2.5 text-left">
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-[9.5px] font-extrabold tracking-wide text-[#e8731f] uppercase">{tr('À faire maintenant')}</span>
          <span className="block truncate font-display text-[13px] font-extrabold">{todo.text}</span>
        </span>
        {todo.target && (
          <button className="btn !h-8 !w-8 shrink-0 !bg-[#e8731f] !p-0" onClick={onGo} aria-label={tr('Y aller')}>
            <Navigation size={15} />
          </button>
        )}
        {build && (
          <button className="btn btn-soft !h-8 !w-8 shrink-0 !p-0" onClick={onManage} aria-label={tr('Construire')}>
            <Hammer size={15} />
          </button>
        )}
      </div>
    )
  return (
    <div className="hud pointer-events-auto w-[min(100%,300px)] rounded-2xl p-2.5 text-left">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-extrabold tracking-wide text-[#e8731f] uppercase">{tr('À faire maintenant')}</span>
        <Navigation size={13} className="text-[#e8731f]" />
      </div>
      <div className="mt-0.5 font-display text-[14px] leading-tight font-extrabold">{todo.text}</div>
      <div className="mt-2 flex gap-1.5">
        {todo.target && (
          <button className="btn flex-1 !bg-[#e8731f] !py-1.5 !text-xs" onClick={onGo}>
            {tr('Y aller')}
          </button>
        )}
        {build && (
          <button className="btn btn-soft flex-1 !py-1.5 !text-xs" onClick={onManage}>
            {tr('Construire')}
          </button>
        )}
      </div>
    </div>
  )
}

/** The quartier's level, its reputation, and the two ways out of the street's view: manage it, or Babi en ligne. */
export function QuartierBar({ view, visiting, onManage, onBabi, short }: { view: QuartierView; visiting: boolean; onManage: () => void; onBabi: () => void; /** No room (a small phone, sideways): one line, its buttons round. */ short?: boolean }) {
  if (short)
    return (
      <div className="pointer-events-auto flex max-w-full items-center gap-1.5">
        <div className="hud flex min-w-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-extrabold">
          <Home size={13} className="shrink-0 text-[#1c7a4a]" />
          <span className="truncate">{tx('{0} · niveau {1}', { 0: view.name, 1: view.level })}</span>
          <Star size={12} className="shrink-0 text-[#e8a01f]" fill="#e8a01f" />
          <span className="tnum">{view.reputation}</span>
        </div>
        {!visiting && (
          <button className="btn btn-soft !h-8 !w-8 shrink-0 !p-0" onClick={onManage} aria-label={tr('Gérer')}>
            <Settings size={15} />
          </button>
        )}
        <button className="btn !h-8 !w-8 shrink-0 !bg-[#1c7a4a] !p-0" onClick={onBabi} aria-label={tr('Aller à Babi')}>
          <Globe size={15} />
        </button>
      </div>
    )
  return (
    <div className="pointer-events-auto flex w-full flex-col items-start gap-1.5">
      <div className="hud flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-extrabold">
        <Home size={13} className="text-[#1c7a4a]" />
        <span className="truncate">{tx('{0} · niveau {1}', { 0: view.name, 1: view.level })}</span>
        <Star size={12} className="text-[#e8a01f]" fill="#e8a01f" />
        <span className="tnum">{view.reputation}</span>
      </div>
      <div className={`grid w-full gap-1.5 ${visiting ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {/* (Visiting: the way home is on the welcome card.) */}
        {!visiting && (
          <button className="btn btn-soft !py-1.5 !text-xs" onClick={onManage}>
            {tr('Gérer')}
          </button>
        )}
        <button className="btn !bg-[#1c7a4a] !py-1.5 !text-xs" onClick={onBabi}>
          {tr('Aller à Babi')}
        </button>
      </div>
    </div>
  )
}

/** Walked out of the quartier (its streets end there): Babi en ligne, or back. */
export function LeaveQuartier({ onBabi, onStay, short }: { onBabi: () => void; onStay: () => void; /** No room (a small phone, sideways): one line, its buttons round. */ short?: boolean }) {
  if (short)
    return (
      <div className="hud pointer-events-auto flex w-[min(100%,300px)] items-center gap-1.5 rounded-2xl py-1.5 pr-1.5 pl-3 text-left">
        <span className="min-w-0 flex-1 truncate font-display text-[13px] font-extrabold">{tr('Tu sors de ton quartier')}</span>
        <button className="btn btn-soft !h-8 shrink-0 !px-2.5 !py-0 !text-xs" onClick={onStay}>
          {tr('Rester')}
        </button>
        <button className="btn !h-8 !w-8 shrink-0 !bg-[#1c7a4a] !p-0" onClick={onBabi} aria-label={tr('Aller à Babi')}>
          <Globe size={15} />
        </button>
      </div>
    )
  return (
    <div className="hud pointer-events-auto w-[min(100%,320px)] rounded-2xl p-3 text-left">
      <div className="font-display text-[15px] leading-tight font-extrabold">{tr('Tu sors de ton quartier')}</div>
      <div className="mt-0.5 text-xs font-bold text-[var(--color-ink-soft)]">{tr('Aller à Babi ? Le reste de la ville, avec tous les joueurs.')}</div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <button className="btn btn-soft !py-1.5 !text-xs" onClick={onStay}>
          {tr('Rester')}
        </button>
        <button className="btn !bg-[#1c7a4a] !py-1.5 !text-xs" onClick={onBabi}>
          {tr('Aller à Babi')}
        </button>
      </div>
    </div>
  )
}

/** On a lot: which one, the way back to the quartier's view (as The Sims' neighbourhood button), and what one does
 * there: « Gérer » one's building, « Construire ici » on a free lot; « À faire maintenant » under it. */
export function LotBar({ lot, quartier, visiting, todo, onVue, onTodo, onManage, onBuild }: { /** The lot the Sim stands by (useLotHere), else null: the quartier's name only. */ lot: QLot | null; quartier: string; visiting: boolean; todo?: QuartierTodoT | null; onVue: () => void; onTodo: () => void; onManage: () => void; onBuild: () => void }) {
  const free = lot?.kind === 'free' && !visiting
  const mine = lot?.kind === 'mine' && !visiting
  return (
    <div className="pointer-events-auto flex w-full flex-col items-start gap-1.5" data-lot-bar={lot?.id ?? ''}>
      <div className="hud flex w-full items-center gap-2 rounded-2xl p-1.5 pl-3 text-left">
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[10px] font-extrabold tracking-wide text-[#e8731f] uppercase">{free ? tr('Terrain libre') : lot ? lot.what : visiting ? tr('En visite') : tr('Dans ton quartier')}</div>
          <div className="truncate font-display text-[14px] font-extrabold">{free ? tr('Construire ici') : lot ? lot.name : quartier}</div>
        </div>
        {free && (
          <button className="btn shrink-0 !bg-[#e8731f] !px-2.5 !py-1.5 !text-xs" onClick={onBuild} aria-label={tr('Construire ici')}>
            <Hammer size={14} />
          </button>
        )}
        {mine && (
          <button className="btn btn-soft shrink-0 !px-2.5 !py-1.5 !text-xs" onClick={onManage}>
            {tr('Gérer')}
          </button>
        )}
        <button className="btn flex shrink-0 items-center gap-1 !bg-[#e8731f] !px-2.5 !py-1.5 !text-xs" onClick={onVue}>
          <MapIcon size={14} /> {tr('Vue du quartier')}
        </button>
      </div>
      {todo && (
        <button className="hud w-full rounded-2xl px-3 py-1.5 text-left active:scale-[0.99]" onClick={onTodo}>
          <div className="flex items-center gap-1.5 text-[10px] font-extrabold tracking-wide text-[#e8731f] uppercase">
            <Navigation size={11} /> {tr('À faire maintenant')}
          </div>
          <div className="truncate text-[12px] font-extrabold">{todo.text}</div>
        </button>
      )}
    </div>
  )
}

/** How near (m) the Sim must be to a lot's middle for the bar to name it; a little further to let go of it (no flicker between two). */
const HERE_R = 26
const HERE_KEEP = 34

/**
 * The lot the Sim stands by in the quartier's world now (the nearest within a few metres), looked at twice a second
 * from where it is (whereabouts.sim): the bar follows it as it walks, and says the quartier's name away from every
 * lot. Until the Sim has been set down at the lot it went to (its first moments in the street), that lot.
 */
export function useLotHere(lots: QLot[], on: boolean, entry: QLot | null): QLot | null {
  const [here, setHere] = useState<QLot | null>(entry)
  useEffect(() => {
    if (!on) return setHere(null)
    let cur: QLot | null = entry
    setHere(entry)
    const t0 = performance.now()
    let placed = !entry
    const look = () => {
      const [x, z] = whereabouts.sim
      // (Set down by its lot, or a while gone by: from then on, wherever it is.)
      if (!placed && entry && (Math.hypot(entry.at[0] - x, entry.at[1] - z) < 60 || performance.now() - t0 > 12000)) placed = true
      if (!placed) return
      // (One's own home and buildings first, before a big place next door whose middle is nearer: the market, the school.)
      const far = (l: QLot) => Math.hypot(l.at[0] - x, l.at[1] - z) - (l.kind === 'home' || l.kind === 'mine' ? 8 : 0)
      let best: QLot | null = null
      let bd = Infinity
      for (const l of lots) {
        const d = far(l)
        if (d < (l.id === cur?.id ? HERE_KEEP : HERE_R) && d < bd) {
          best = l
          bd = d
        }
      }
      // (The one held keeps it while still near enough, unless another is clearly nearer.)
      const held = cur && lots.find((l) => l.id === cur!.id)
      if (held && best && best.id !== held.id && far(held) < HERE_KEEP && bd > far(held) - 6) best = held
      if ((best?.id ?? null) !== (cur?.id ?? null)) {
        cur = best
        setHere(best)
      }
    }
    look()
    const k = setInterval(look, 500)
    return () => clearInterval(k)
  }, [lots, on, entry?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  return on ? here : null
}

/** At the edge of the quartier's own world (the lagoon, the forest, the motorway's wall): Babi, the whole city, is beyond; or stay. */
export function LeaveLot({ onBabi, onStay }: { onBabi: () => void; onStay: () => void }) {
  return (
    <div className="hud pointer-events-auto w-[min(100%,320px)] rounded-2xl p-3 text-left" data-edge>
      <div className="font-display text-[15px] leading-tight font-extrabold">{tr('Le bout de ton quartier')}</div>
      <div className="mt-0.5 text-xs font-bold text-[var(--color-ink-soft)]">{tr('Au-delà, c’est Babi : toute la ville.')}</div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <button className="btn btn-soft !py-1.5 !text-xs" onClick={onStay}>
          {tr('Rester')}
        </button>
        <button className="btn !bg-[#1c7a4a] !py-1.5 !text-xs" onClick={onBabi}>
          {tr('Aller à Babi')}
        </button>
      </div>
    </div>
  )
}

/** Maquette 6: in the open city, where one is and how many play here, and the way home. */
export function BabiBar({ communeName, online, onHome }: { communeName: string; online: number; onHome: () => void }) {
  return (
    <div className="pointer-events-auto flex flex-col items-start gap-1.5">
      <div className="hud flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-extrabold">
        <span>{tx('Babi en ligne · {0}', { 0: communeName })}</span>
        <span className="h-2 w-2 rounded-full bg-[#2fb36b]" />
        <span className="tnum">{online}</span>
      </div>
      <button className="btn flex items-center gap-1.5 !bg-[#e8731f] !px-4 !py-2 !text-sm" onClick={onHome}>
        <Home size={15} /> {tr('Rentrer au quartier')}
      </button>
    </div>
  )
}

/** Maquette 7: at a friend's, what's open there. */
export function VisitCard({ view, onEat, onWord, onHome, short }: { view: QuartierView; onEat?: () => void; onWord: () => void; onHome: () => void; /** No room (a small phone, sideways): one line, its buttons round. */ short?: boolean }) {
  const open = view.buildings.filter((b) => b.opened && b.kind !== 'maison')
  const who = view.ownerName ?? view.name
  if (short)
    return (
      <div className="hud pointer-events-auto flex w-[min(100%,300px)] items-center gap-1.5 rounded-2xl py-1.5 pr-1.5 pl-3 text-left">
        <span className="min-w-0 flex-1 truncate font-display text-[13px] font-extrabold">{tr('Bienvenue chez {0}', { 0: who })}</span>
        <button className="btn btn-soft !h-8 !w-8 shrink-0 !p-0" onClick={onWord} aria-label={tr('Laisser un mot')}>
          <MessageCircle size={15} />
        </button>
        <button className="btn !h-8 !w-8 shrink-0 !bg-[#e8731f] !p-0" disabled={!onEat} onClick={onEat} aria-label={tr('Manger au maquis')}>
          <Utensils size={15} />
        </button>
        <button className="btn btn-soft !h-8 !w-8 shrink-0 !p-0" onClick={onHome} aria-label={tr('Rentrer')}>
          <LogOut size={15} />
        </button>
      </div>
    )
  return (
    <div className="hud pointer-events-auto w-[min(100%,320px)] rounded-2xl p-2.5 text-left">
      <div className="text-[10px] font-extrabold tracking-wide text-[#2c6fb7] uppercase">{tx('Visite · {0} (niv. {1})', { 0: view.name, 1: view.level })}</div>
      <div className="font-display text-[15px] leading-tight font-extrabold">{tr('Bienvenue chez {0}', { 0: who })}</div>
      {open.length > 0 && <div className="mt-0.5 text-xs font-bold text-[var(--color-ink-soft)]">{open.map((b) => b.label || quartierKindName(b.kind as QuartierKind)).join(' · ')}</div>}
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <button className="btn btn-soft !px-1 !py-1.5 !text-xs" onClick={onWord}>
          {tr('Laisser un mot')}
        </button>
        <button className="btn !bg-[#e8731f] !px-1 !py-1.5 !text-xs" disabled={!onEat} onClick={onEat}>
          <Utensils size={12} className="mr-0.5 inline" /> {tr('Manger au maquis')}
        </button>
        <button className="btn btn-soft !px-1 !py-1.5 !text-xs" onClick={onHome}>
          <LogOut size={12} className="mr-0.5 inline" /> {tr('Rentrer')}
        </button>
      </div>
    </div>
  )
}

const hourOf = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : tr('{0} h', { 0: d.getHours() })
}

/** Maquette 5: « Rejoindre Babi en ligne »: the communes with their players, the events, a friend's quartier; then the taxi. */
export function HubSheet({ world, sim, friends, dest: dest0, onTravel, onHere, onVisit, onClose }: { world: World; sim: Sim; friends: Player[]; /** Opened on a commune already (a visit by taxi). */ dest?: string; onTravel: OnTravel; /** The commune one is in: the open city at once, no taxi. */ onHere: () => void; onVisit: (owner: string) => void; onClose: () => void }) {
  const [hub, setHub] = useState<HubView | null>(null)
  const [dest, setDest] = useState<string | null>(dest0 ?? null)
  useEffect(() => {
    quartierApi
      .quartierHub()
      .then(setHub)
      .catch(() => setHub({ online: 0, communes: [], events: [] }))
  }, [])
  // (The mock, in development: a friend to visit.)
  if (!friends.length && quartierMockOn()) friends = [{ id: 'mock-bintou', firstName: 'Bintou' } as Player]
  const city = world.cities.find((c) => c.id === sim.city) ?? world.cities[0]
  const name = (id: string) => city.communes.find((c) => c.id === id)?.name ?? id
  // Every commune of the city, the busiest first (those the hub has nothing on, after).
  const rows = useMemo(() => {
    const by = new Map((hub?.communes ?? []).map((c) => [c.commune, c]))
    return city.communes.map((c) => ({ id: c.id, name: c.name, online: by.get(c.id)?.online ?? 0, highlights: by.get(c.id)?.highlights ?? [] })).sort((a, b) => b.online - a.online)
  }, [hub, city])
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end bg-[#0f1230]/55 backdrop-blur-[3px] lg:items-center lg:justify-center" onClick={onClose}>
      <div className="sheet animate-up flex max-h-[86vh] w-full flex-col overflow-hidden rounded-t-[28px] pb-[max(1rem,var(--sab,env(safe-area-inset-bottom)))] lg:w-[460px] lg:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 p-4 pb-2">
          <IconTile icon={Users} colors={['#4fbf85', '#1c7a4a']} size={48} />
          <div className="min-w-0 flex-1">
            <div className="label">{tr('Rejoindre')}</div>
            <div className="font-display text-[22px] leading-tight font-extrabold">{tr('Babi en ligne')}</div>
            {hub && <div className="text-xs font-bold text-[var(--color-ink-soft)]">{tx('{0} joueurs en ce moment', { 0: hub.online })}</div>}
          </div>
          <button className="icon-btn bg-[var(--color-canvas)]" onClick={onClose} aria-label={tr('Fermer')}>
            <X size={22} strokeWidth={2.6} />
          </button>
        </div>
        <div className="space-y-1.5 overflow-y-auto px-4 pt-1 pb-2">
          {dest ? (
            <>
              <button className="flex items-center gap-1 text-xs font-extrabold text-[var(--color-ink-soft)]" onClick={() => setDest(null)}>
                <ChevronRight size={14} className="rotate-180" /> {tr('Les communes')}
              </button>
              <div className="font-display text-[18px] font-extrabold">{tr('Vers {0}', { 0: name(dest) })}</div>
              {dest === sim.commune ? (
                <button className="btn w-full !bg-[#1c7a4a]" onClick={onHere}>
                  {tr('Y aller à pied')}
                </button>
              ) : (
                <TravelCTA world={world} sim={sim} cityId={city.id} communeId={dest} onTravel={onTravel} />
              )}
            </>
          ) : (
            <>
              {(hub?.events ?? []).map((e) => (
                <button key={`${e.title}${e.at}`} className="flex w-full items-center gap-3 rounded-2xl bg-[#fde6d2] p-2.5 text-left active:scale-[0.99]" onClick={() => setDest(e.commune)}>
                  <CalendarDays size={18} className="shrink-0 text-[#e8731f]" />
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="truncate font-display text-[15px] font-extrabold">{e.title}</div>
                    <div className="truncate text-xs font-bold text-[var(--color-ink-soft)]">{tx('{0} · {1} · {2} inscrits', { 0: name(e.commune), 1: hourOf(e.at), 2: e.count })}</div>
                  </div>
                </button>
              ))}
              {rows.map((c) => (
                <button key={c.id} className="flex w-full items-center gap-3 rounded-2xl border border-[var(--color-line)] bg-white p-2.5 text-left active:scale-[0.99]" onClick={() => setDest(c.id)}>
                  <MapPin size={18} className={`shrink-0 ${c.id === sim.commune ? 'text-[#2563eb]' : 'text-[#e8731f]'}`} />
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="truncate font-display text-[15px] font-extrabold">{c.name}</div>
                    {c.highlights.length > 0 && <div className="truncate text-xs font-bold text-[var(--color-ink-soft)]">{c.highlights.join(', ')}</div>}
                  </div>
                  <span className="tnum shrink-0 rounded-full bg-[#e9f9ef] px-2 py-0.5 text-[11px] font-extrabold text-[#1c7a4a]">{tx('{0} en ligne', { 0: c.online })}</span>
                </button>
              ))}
              {friends.length > 0 && (
                <>
                  <div className="label px-1 pt-1">{tr('Les quartiers de tes ami·es')}</div>
                  {friends.slice(0, 8).map((f) => (
                    <button key={f.id} className="flex w-full items-center gap-3 rounded-2xl border border-[var(--color-line)] bg-white p-2.5 text-left active:scale-[0.99]" onClick={() => onVisit(f.id)}>
                      <Building2 size={18} className="shrink-0 text-[#2c6fb7]" />
                      <div className="min-w-0 flex-1 truncate font-display text-[15px] font-extrabold">{tr('Quartier de {0}', { 0: f.firstName })}</div>
                      <span className="text-xs font-extrabold text-[#2c6fb7]">{tr('Visiter')}</span>
                    </button>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// The management sheets are the server side's (components/quartier/GererQuartier.tsx, Construire.tsx): loaded
// only when there, else a plain sheet of the quartier stands in.
type SheetProps = { simId: string; onClose: () => void; onPlace: (kind: string, slot: number) => void }
const SHEETS = import.meta.glob<Record<string, ComponentType<SheetProps>>>('./GererQuartier.tsx')
const loadGerer = SHEETS['./GererQuartier.tsx']
const Gerer = loadGerer ? lazy(() => loadGerer().then((m) => ({ default: m.default ?? m.GererQuartier }))) : null

export function ManageSheet({ view, simId, onClose, onChanged }: { view: QuartierView; simId: string; onClose: () => void; onChanged: () => void }) {
  if (Gerer)
    return (
      <Suspense fallback={null}>
        <Gerer simId={simId} onClose={() => (onChanged(), onClose())} onPlace={() => onChanged()} />
      </Suspense>
    )
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end bg-[#0f1230]/55 backdrop-blur-[3px] lg:items-center lg:justify-center" onClick={onClose}>
      <div className="sheet animate-up flex max-h-[80vh] w-full flex-col overflow-hidden rounded-t-[28px] pb-[max(1rem,var(--sab,env(safe-area-inset-bottom)))] lg:w-[460px] lg:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 p-4 pb-2">
          <IconTile icon={Home} colors={['#4fbf85', '#1c7a4a']} size={48} />
          <div className="min-w-0 flex-1">
            <div className="label">{tx('Niveau {0}', { 0: view.level })}</div>
            <div className="font-display text-[22px] leading-tight font-extrabold">{view.name}</div>
          </div>
          <button className="icon-btn bg-[var(--color-canvas)]" onClick={onClose} aria-label={tr('Fermer')}>
            <X size={22} strokeWidth={2.6} />
          </button>
        </div>
        <div className="space-y-1.5 overflow-y-auto px-4 pt-1 pb-2">
          <div className="text-xs font-bold text-[var(--color-ink-soft)]">{view.next ? tx('Réputation {0} / {1}', { 0: view.reputation, 1: view.next.reputation }) : tx('Réputation {0}', { 0: view.reputation })}</div>
          {view.buildings.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-2xl border border-[var(--color-line)] bg-white p-2.5 text-sm font-extrabold">
              <span>{b.label || quartierKindName(b.kind as QuartierKind)}</span>
              {!!b.perDay && <span className="tnum text-xs text-[#1c7a4a]">{tx('+ {0} F/j', { 0: b.perDay })}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export type { QuartierState }
