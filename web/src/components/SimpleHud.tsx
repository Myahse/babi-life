import { memo, useEffect, useState, type ReactNode, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Hand, Home, Map as MapIcon, MapPin, MessageCircle, Send, Smartphone, Smile, Star, Users, X, Heart, Sparkles, Eye } from 'lucide-react'
import { api } from '../lib/api'
import type { GrinMessage, Look, Player, Sim, World } from '../lib/types'
import { Portrait } from '../avatar/portrait'
import { NEEDS, lifeOf } from '../game/rules'
import { moodColor, openPanel } from '../game/vie'
import { MotiveRing } from './ui'
import { PnjFacts } from './PnjFacts'
import { haptic } from '../lib/native'
import { t as tr, tn } from '../lib/i18n'

// The calmer game screen (update « ecran-simple »): one bar of five at the bottom (Ici, Maison, Carte,
// Téléphone, Moi), Tout Babi's grin and who is here just above it, and everything else in those five
// or shown only when it matters (screens/Play.tsx keeps the old layout while the update is shut).
// Few elements, each memoised on plain values: Play re-renders often, these mostly don't. Their actions
// come through one ref (`HudActs`), so a new closure in Play never re-renders them.

export type HudTab = 'ici' | 'maison' | 'carte' | 'phone' | 'moi'
export type HudActs = {
  tab: (t: HudTab) => void
  /** The players here (`focus`: one of them first). */
  who: (focus: string | null) => void
  /** The grin (Tout Babi, the commune, Babi Infos), full screen. */
  causer: () => void
  greet: (p: Player) => void
  invite: (p: Player) => void
}

/** The bar at the bottom. */
export const BottomBar = memo(function BottomBar({
  hud,
  at,
  unseen,
  msgs,
  alert,
  ringColor,
  ringPct,
  look,
  gender,
  stage,
}: {
  hud: RefObject<HudActs | null>
  /** Where the Sim is: out (« Ici » lit) or at home (« Maison » lit). */ at: 'ici' | 'maison' | null
  unseen: number
  /** New Gbairai messages (a green bubble on the phone). */ msgs: number
  /** A need running out: a red dot on « Moi ». */ alert: boolean
  /** The mood's colour and how full its ring is (0..100): plain values, so the bar keeps still when Play re-renders. */ ringColor: string
  ringPct: number
  look: Look
  gender: Sim['gender']
  stage?: string
}) {
  const tap = (t: HudTab) => () => (haptic('light'), hud.current?.tab(t))
  const cls = (on: boolean) =>
    `relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[18px] py-1 text-[11px] leading-none font-extrabold transition active:scale-90 short:flex-row short:gap-1.5 short:py-0 ${on ? 'bg-[var(--color-canvas)] text-[var(--color-ink)]' : 'text-[var(--color-ink-soft)]'}`
  const dot = (n: number, color: string, side = '-right-0.5') =>
    n > 0 && (
      <span className={`absolute -top-1 ${side} grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10.5px] text-white ring-2 ring-white`} style={{ background: color }}>
        {n > 99 ? '99+' : n}
      </span>
    )
  return (
    <nav className="hud pointer-events-auto flex h-14 w-full items-stretch gap-0.5 rounded-[24px] p-1 lg:w-[460px] short:h-12" aria-label={tr('Menu du jeu')}>
      <button data-tour="ou-aller" className={cls(at === 'ici')} onClick={tap('ici')}>
        <MapPin size={22} strokeWidth={2.5} className="text-[var(--color-orange)]" />
        {tr('Ici')}
      </button>
      <button className={cls(at === 'maison')} onClick={tap('maison')}>
        <Home size={22} strokeWidth={2.5} className="text-[#7048e8]" />
        {tr('Maison')}
      </button>
      <button data-tour="carte" className={cls(false)} onClick={tap('carte')}>
        <MapIcon size={22} strokeWidth={2.5} className="text-[var(--color-emerald)]" />
        {tr('Carte')}
      </button>
      <button data-tour="phone" className={cls(false)} onClick={tap('phone')}>
        <span className="relative">
          <Smartphone size={22} strokeWidth={2.5} className="text-[#e8590c]" />
          {dot(unseen, 'var(--color-rose)', '-right-3')}
          {dot(msgs, '#25a35a', '-left-3')}
        </span>
        {tr('Téléphone')}
      </button>
      <button data-tour="besoins" className={cls(false)} onClick={tap('moi')} aria-label={alert ? tr('Moi : un besoin à remplir') : tr('Moi')}>
        <span className="relative block rounded-full p-[2px]" style={{ background: `conic-gradient(${ringColor} ${Math.round(ringPct) * 3.6}deg, #e7e9f2 0)` }}>
          <span className="block h-[22px] w-[22px] overflow-hidden rounded-full border-[1.5px] border-white bg-gradient-to-b from-[#ffe7c7] to-[#ffb27a]">
            <Portrait look={look} gender={gender} framing="head" stage={stage} />
          </span>
          {alert && <span className="absolute -top-0.5 -right-1 h-3 w-3 animate-pulse rounded-full bg-[var(--color-rose)] ring-2 ring-white" />}
        </span>
        {tr('Moi')}
      </button>
    </nav>
  )
})

/**
 * The top's one card, under the money and the hour: the first of `items` (the caller puts what matters most
 * first) and a « +N » beside it for the others, a tap showing the next one in its place. A player found the
 * top too full when each had its own pill: they slid under one another.
 */
export function OneCard({ items }: { items: (false | null | undefined | 0 | '' | { key: string; node: ReactNode })[] }) {
  const list = items.filter((x): x is { key: string; node: ReactNode } => !!x)
  const [at, setAt] = useState(0)
  // Something new on top: back to it.
  const first = list[0]?.key
  useEffect(() => setAt(0), [first])
  if (!list.length) return null
  const i = at % list.length
  const it = list[i]
  return (
    <div className="flex max-w-full min-w-0 items-center gap-1.5 lg:max-w-sm">
      <div key={it.key} className="animate-pop min-w-0">
        {it.node}
      </div>
      {list.length > 1 && (
        <button
          className="hud pointer-events-auto grid h-8 min-w-8 shrink-0 place-items-center rounded-full px-2 text-[12px] font-extrabold text-[var(--color-ink-soft)] active:scale-90"
          onClick={() => (haptic('light'), setAt(i + 1))}
          aria-label={tn(list.length - 1, 'Voir l’autre ({n})', 'Voir les {n} autres')}
        >
          +{list.length - 1}
        </button>
      )}
    </div>
  )
}

// Tout Babi's last lines, kept between mounts (the strip comes and goes with the sheets): the Sim, the last id read.
const grinCache = { key: '', last: 0, lines: [] as GrinMessage[] }

/** Who is here and Tout Babi's grin: a slim strip over the bar. */
export const PlaceStrip = memo(function PlaceStrip({
  hud,
  simId,
  where,
  players,
  place,
  here,
  invites,
  online,
  canChat,
  canInvite,
}: {
  hud: RefObject<HudActs | null>
  simId: string
  commune: string
  /** The place or the commune, as said. */ where: string
  /** The commune's players (around's list, kept as is so the strip stays memoised). */ players: Player[]
  /** In a place: only those doing something there. */ place: string | null
  /** How many players here. */ here: number
  invites: number
  /** Players in the game right now, everywhere (around.online). */ online: number
  /** Gbairai's grin open to this Sim (backend sims/grin.go: the same rule). */ canChat: boolean
  /** Doing something others can come and share. */ canInvite: boolean
}) {
  const key = simId
  const [lines, setLines] = useState<GrinMessage[]>(() => (grinCache.key === key ? grinCache.lines : []))
  useEffect(() => {
    if (!canChat) return
    if (grinCache.key !== key) Object.assign(grinCache, { key, last: 0, lines: [] })
    setLines(grinCache.lines)
    let stop = false
    const poll = () => {
      if (document.visibilityState !== 'visible') return
      api
        .grin(simId, 'babi', grinCache.last)
        .then((r) => {
          if (stop || !r.messages.length || grinCache.key !== key) return
          grinCache.last = r.messages[r.messages.length - 1].id
          grinCache.lines = [...grinCache.lines, ...r.messages].slice(-2)
          setLines(grinCache.lines)
        })
        .catch(() => undefined)
    }
    poll()
    const t = setInterval(poll, 4000)
    return () => {
      stop = true
      clearInterval(t)
    }
  }, [key, simId, canChat])
  // The real players first, then the game's (PNJ); three faces.
  const list = place ? players.filter((p) => p.activity?.placeId === place) : players
  const shown = [...list].sort((a, b) => Number(!!a.npc) - Number(!!b.npc)).slice(0, 3)
  const [sel, setSel] = useState<Player | null>(null)
  useEffect(() => {
    if (sel && !list.some((p) => p.id === sel.id)) setSel(null)
  }, [list, sel])
  return (
    <div className="pointer-events-auto relative w-full lg:w-[380px]" data-hud="strip">
      {sel && <PlayerCard p={sel} hud={hud} canInvite={canInvite} onClose={() => setSel(null)} />}
      <div className="hud flex items-center gap-2 rounded-[20px] py-1.5 pr-1.5 pl-2 short:py-1">
        <div className="min-w-0 flex-1">
          {/* Who is here: their faces (a tap: that one), the count and where (a tap: everyone). */}
          <div className="flex min-w-0 items-center gap-1.5">
            {shown.length > 0 && (
              <div className="flex shrink-0 items-center">
                {shown.map((p, i) => (
                  <button
                    key={p.id}
                    className={`relative -ml-1.5 block h-[22px] w-[22px] overflow-hidden rounded-full border-[1.5px] bg-gradient-to-b from-[#dbeafe] to-[#93c5fd] transition first:ml-0 active:scale-90 ${p.npc ? 'border-[#c4b5fd]' : 'border-[#22c55e]'}`}
                    style={{ zIndex: 3 - i }}
                    onClick={() => (haptic('light'), setSel(p))}
                    aria-label={p.username ? `@${p.username}` : p.firstName}
                  >
                    <Portrait look={p.look} gender={p.gender} framing="head" stage={p.stage} />
                  </button>
                ))}
              </div>
            )}
            <button className="relative flex min-w-0 items-center gap-1 rounded-lg text-left text-[12px] leading-none font-extrabold active:opacity-70" onClick={() => hud.current?.who(null)}>
              {here > 0 && <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#22c55e]" />}
              <span className="shrink-0 whitespace-nowrap">{here > 0 ? tn(here, '{n} joueur ici', '{n} joueurs ici') : tr('Personne ici')}</span>
              <span className="truncate font-bold text-[var(--color-ink-soft)]">· {where}</span>
              {invites > 0 && <span className="ml-0.5 grid h-[18px] min-w-[18px] shrink-0 place-items-center rounded-full bg-[var(--color-rose)] px-1 text-[10px] text-white">{invites}</span>}
            </button>
            {/* Everyone in the game now, all over the country (a tap: the list, « Tout Babi »). */}
            {online > 0 && (
              <button className="ml-auto flex shrink-0 items-center gap-1 rounded-full bg-[#22c55e]/15 px-2 py-0.5 text-[11px] leading-none font-extrabold text-[#15803d] active:opacity-70" onClick={() => hud.current?.who(null)}>
                <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
                {tn(online, '{n} en ligne', '{n} en ligne')}
              </button>
            )}
          </div>
          {/* The grin's last words (a tap: the grin). */}
          <button className="mt-1 block w-full min-w-0 text-left leading-[14px] active:opacity-70" onClick={() => canChat && hud.current?.causer()} disabled={!canChat}>
            {canChat && lines.length > 0 ? (
              lines.map((m, i) => (
                <span key={m.id} className={`block truncate text-[11.5px] font-semibold ${i === lines.length - 1 ? 'motion-rise' : 'text-[var(--color-ink-soft)]'} short:[&:not(:last-child)]:hidden`}>
                  <span className="font-extrabold" style={{ color: m.mine ? 'var(--color-orange)' : m.npc ? '#7048e8' : '#2563eb' }}>
                    {m.mine ? tr('Toi') : m.npc ? tr('{0} (PNJ)', { 0: m.firstName }) : m.firstName}
                  </span>{' '}
                  {stripBody(m.body)}
                </span>
              ))
            ) : (
              <span className="block truncate text-[11.5px] font-semibold text-[var(--color-ink-soft)]">{canChat ? tr('Tout Babi est calme. Dis bonjour à tout le monde !') : tr('Le grin du quartier s’ouvre avec Gbairai.')}</span>
            )}
          </button>
        </div>
        {canChat && (
          <button className="btn shrink-0 flex-col !gap-0.5 !rounded-2xl !px-3 !py-1.5 !text-[12px] short:flex-row short:!gap-1" onClick={() => (haptic('light'), hud.current?.causer())}>
            <MessageCircle size={18} strokeWidth={2.6} /> {tr('Causer')}
          </button>
        )}
      </div>
    </div>
  )
})

/** A line of the strip: a shared card said in words (the grin draws it whole). */
const stripBody = (body: string) => (body.startsWith('[ticket:papier:') ? tr('🪪 Un papier montré') : body.startsWith('[ticket:') ? tr('🎫 Un ticket de pari') : body.startsWith('[defi:') || body.startsWith('[jeu:') ? tr('🏆 Un défi à relever') : body)

/** One player tapped in the strip: greet, invite, or see them, one tap each. */
function PlayerCard({ p, hud, canInvite, onClose }: { p: Player; hud: RefObject<HudActs | null>; canInvite: boolean; onClose: () => void }) {
  const name = p.username ? `@${p.username}` : p.firstName
  return (
    <div className="card animate-pop absolute inset-x-0 bottom-[calc(100%+6px)] p-2.5" data-card>
      <div className="flex items-center gap-2.5">
        <span className="block h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gradient-to-b from-[#dbeafe] to-[#93c5fd]">
          <Portrait look={p.look} gender={p.gender} framing="head" stage={p.stage} />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate font-display text-[15px] font-extrabold">
            <span className={p.npc ? 'text-[#7048e8]' : undefined}>{name}</span>
            {p.npc && <span className="ml-1 rounded-full bg-[#7048e8] px-1.5 py-px align-middle text-[9px] font-extrabold tracking-wide text-white">{tr('PNJ')}</span>}
            {p.friend && <Heart size={13} className="ml-1 inline fill-[#e0245e] text-[#e0245e]" />}
          </div>
          <div className="truncate text-[11.5px] font-bold text-[var(--color-ink-soft)]">{p.activity ? `${p.activity.label} · ${p.activity.placeName}` : tr('Se promène dans le quartier')}</div>
        </div>
        <button className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-black/5 active:scale-90" onClick={onClose} aria-label={tr('Fermer')}>
          <X size={16} strokeWidth={2.8} />
        </button>
      </div>
      {p.npc && p.life && <PnjFacts life={p.life} compact />}
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <button className="btn !bg-[#22c55e] !px-1 !py-2 !text-xs" onClick={() => (haptic('medium'), hud.current?.greet(p), onClose())}>
          <Hand size={15} /> {tr('Saluer')}
        </button>
        <button className="btn !bg-[#2563eb] !px-1 !py-2 !text-xs" disabled={!canInvite} onClick={() => (hud.current?.invite(p), onClose())} title={canInvite ? undefined : tr("Pour inviter, commence d'abord une activité dans un lieu du quartier.")}>
          <Send size={15} /> {tr('Inviter')}
        </button>
        <button className="btn btn-soft !px-1 !py-2 !text-xs" onClick={() => (hud.current?.who(p.id), onClose())}>
          <Users size={15} /> {tr('Voir')}
        </button>
      </div>
    </div>
  )
}

/** « Moi »: the needs in full, the mode vie's panels, the quick settings. */
export function MoiSheet({
  sim,
  world,
  onClose,
  title,
  view,
  onView,
  onEmotes,
  vie,
  tools,
}: {
  sim: Sim
  world: World
  onClose: () => void
  /** The name as shown (the crew, the @). */ title: string
  /** The next view's name (the camera), when it can change. */ view?: string
  onView?: () => void
  onEmotes?: () => void
  /** Le mode vie's panels (update « mode-vie »). */ vie: boolean
  /** The sound, the clear screen, the testers' tools. */ tools: ReactNode
}) {
  const life = lifeOf(world, sim)
  const pick = (p: 'mood' | 'skills' | 'relations' | 'envies') => (haptic('light'), onClose(), openPanel(p))
  const tile = 'tile flex min-w-0 flex-col items-center justify-center gap-1 p-2.5 text-center text-[12px] font-extrabold leading-tight active:scale-95'
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end bg-[#0f1230]/45 backdrop-blur-[2px] lg:items-center lg:justify-center" onClick={onClose}>
      <div className="sheet animate-up w-full rounded-t-[28px] p-4 pb-[max(1rem,var(--sab,env(safe-area-inset-bottom)))] lg:w-[460px] lg:rounded-[28px] short:max-h-[92vh] short:overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <span className="block h-12 w-12 shrink-0 overflow-hidden rounded-full bg-gradient-to-b from-[#ffe7c7] to-[#ffb27a]">
            <Portrait look={sim.look} gender={sim.gender} framing="head" stage={life.stage?.id} />
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate font-display text-[19px] font-extrabold">{title}</div>
            <div className="truncate text-[12px] font-bold text-[var(--color-ink-soft)]">
              {life.stage?.label ?? ''} · {life.age < 1 ? tr("moins d'un an") : tn(life.age, '{n} an', '{n} ans')}
            </div>
          </div>
          <Link to="/profil" viewTransition className="btn btn-soft shrink-0 !px-3 !py-2 !text-xs">
            {tr('Mon profil')} <ChevronRight size={14} strokeWidth={3} />
          </Link>
          <button className="icon-btn shrink-0 bg-[var(--color-canvas)]" onClick={onClose} aria-label={tr('Fermer')}>
            <X size={20} strokeWidth={2.6} />
          </button>
        </div>
        <div className="label mt-4 mb-1.5">{tr('Tes besoins')}</div>
        <div className="flex justify-between gap-1 rounded-2xl bg-[var(--color-canvas)] px-2 py-2">
          {NEEDS.map((n) => (
            <MotiveRing key={n.key} value={sim.needs[n.key]} icon={n.icon} label={n.label} size={50} />
          ))}
        </div>
        {vie && (
          <>
            <div className="label mt-4 mb-1.5">{tr('Ta vie')}</div>
            <div className="grid grid-cols-4 gap-1.5">
              <button className={tile} onClick={() => pick('mood')}>
                <span className="grid h-8 w-8 place-items-center rounded-full text-white" style={{ background: moodColor(sim.mood) ?? '#00b86b' }}>
                  <Smile size={18} strokeWidth={2.6} />
                </span>
                <span className="w-full truncate">{sim.mood?.label ?? tr('Humeur')}</span>
              </button>
              <button className={tile} onClick={() => pick('skills')}>
                <Star size={24} strokeWidth={2.6} className="text-[#ffa000]" />
                {tr('Compétences')}
              </button>
              <button className={tile} onClick={() => pick('relations')}>
                <Users size={24} strokeWidth={2.6} className="text-[#e0245e]" />
                {tr('Relations')}
              </button>
              <button className={tile} onClick={() => pick('envies')}>
                <Sparkles size={24} strokeWidth={2.6} className="text-[#7048e8]" />
                {tr('Envies')}
              </button>
            </div>
          </>
        )}
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {onEmotes && (
            <button className={tile} onClick={() => (onClose(), onEmotes())}>
              <Smile size={22} strokeWidth={2.6} className="text-[var(--color-orange)]" />
              {tr('Émotes')}
            </button>
          )}
          {onView && view && (
            <button className={tile} onClick={onView}>
              <Eye size={22} strokeWidth={2.6} className="text-[var(--color-emerald)]" />
              {view}
            </button>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">{tools}</div>
      </div>
    </div>
  )
}
